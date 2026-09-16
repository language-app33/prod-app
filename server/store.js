/**
 * A write refused by its condition reports modified: false rather than
 * throwing; the sync endpoint turns that into a 409.
 * @typedef {{ onlyIfNew?: boolean, onlyIfMatch?: string }} WriteCondition
 */
/*
 * Storage, in the shape the endpoints already expect.
 *
 * The two endpoints were written against Netlify Blobs and use a small,
 * closed part of it: get, getWithMetadata, set — including the conditional
 * writes the sync endpoint relies on — and delete. Nothing lists keys;
 * everything is reached from an "index:" key. That is little enough to
 * serve out of a directory, which is what this does, so moving off Netlify
 * did not mean rewriting the endpoints.
 *
 * One document per file under DATA_DIR/<store>/. Writes go to a temporary
 * file and are renamed into place, so a reader sees either the old document
 * or the new one and never half of either.
 *
 * **And the bytes are flushed before the rename, with one previous copy
 * kept beside the document.** The rename alone is enough for a process that
 * dies: the old file is still there. It is not enough for a *host* that
 * dies — power loss, a killed container — because the data may still be in
 * the page cache while the rename has landed, and what comes back is a file
 * of the right name and the wrong length. That is the worst failure this
 * store has: a document nobody can parse reads as a document nobody has
 * written, and the sync endpoint then refuses every push for ever. So the
 * temporary file is fsynced, the directory entry is fsynced after the
 * rename, and the copy being replaced is hard-linked aside first, which
 * costs one link per write and gives the endpoint something to fall back
 * to.
 *
 * The ETag is a digest of the content, so two documents with the same bytes
 * share an ETag. That is what the sync endpoint wants: a write that would
 * not change anything cannot be a lost update.
 */

import { createHash } from "node:crypto";
import { link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

/*
 * Where documents go, in order of preference:
 *
 *   DATA_DIR                   set deliberately, so it wins
 *   RAILWAY_VOLUME_MOUNT_PATH  set by the host when a volume is attached
 *   ./data                     nothing was configured
 *
 * The middle one is the point of this: a host that mounts a volume says so
 * in the environment, and picking that up means attaching the volume is the
 * whole job. Getting it wrong is otherwise silent — the app runs perfectly
 * and writes to a disk that is thrown away on the next deploy.
 */
export function resolveDataRoot(env = process.env, cwd = process.cwd()) {
  if (env.DATA_DIR) return { root: env.DATA_DIR, from: "DATA_DIR", durable: true };
  if (env.RAILWAY_VOLUME_MOUNT_PATH) {
    return {
      root: env.RAILWAY_VOLUME_MOUNT_PATH,
      from: "RAILWAY_VOLUME_MOUNT_PATH",
      durable: true,
    };
  }
  /* Durable only if this happens to be a real disk, which on most hosts it
     is not. The caller says so at startup rather than letting it pass. */
  return { root: path.join(cwd, "data"), from: "default", durable: false };
}

const resolved = resolveDataRoot();
const ROOT = resolved.root;

/** @type {(text: string) => string} */
const etagOf = (text) => createHash("sha256").update(text).digest("hex").slice(0, 32);

/* Keys carry colons and are otherwise arbitrary, so they are percent-encoded
   rather than trusted as filenames. Encoding is reversible, which keeps the
   directory legible when something has to be looked at by hand. */
/** @type {(dir: string, key: string) => string} */
const fileFor = (dir, key) => path.join(dir, encodeURIComponent(key));

/* The copy kept of whatever a write replaced. One deep: it is a floor
   under a document that cannot be read, not a history. */
/** @type {(dir: string, key: string) => string} */
const previousFor = (dir, key) => `${fileFor(dir, key)}.prev`;

/*
 * Flush a directory entry, so a rename survives the host and not merely the
 * process.
 *
 * Best effort by design. Some filesystems refuse to open a directory for
 * writing and some refuse the fsync, and on both the rename has still
 * happened — so a failure here is quieter than the alternative of failing a
 * write that went through.
 */
/** @param {string} dir */
async function syncDir(dir) {
  let handle = null;
  try {
    handle = await open(dir, "r");
    await handle.sync();
  } catch (err) {
    /* Nothing to do about it and nothing worth failing for. */
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

/*
 * A conditional write reads the current document and then writes, and those
 * two halves must not interleave with another request's. One process serves
 * every request, so a promise chain per key is a sufficient lock — and,
 * unlike a lock file, it cannot be left behind by a crash.
 */
/** @type {Map<string, Promise<any>>} */
const chains = new Map();

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
function underLock(key, work) {
  const previous = chains.get(key) || Promise.resolve();
  /* Chain on settlement rather than success: one failed write must not
     wedge the key for the life of the process. */
  const next = previous.then(work, work);
  const settled = next.then(
    () => {},
    () => {},
  );
  chains.set(key, settled);
  /* Drop the entry once nothing is queued behind it, so a long-lived
     process does not keep a promise per key it has ever written. */
  settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return next;
}

/** @param {string} name */
export function getStore(name) {
  const dir = path.join(ROOT, encodeURIComponent(name));
  /** @type {Promise<string | undefined> | null} */
  let ready = null;
  const ensureDir = () => (ready = ready || mkdir(dir, { recursive: true }));

  /** @param {string} key */
  async function readRaw(key) {
    try {
      return await readFile(fileFor(dir, key), "utf8");
    } catch (err) {
      if (err && /** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * @param {string} key
   * @param {string} text
   */
  async function writeRaw(key, text) {
    await ensureDir();
    const target = fileFor(dir, key);
    /* The temporary file has to sit in the same directory: rename is only
       atomic within one filesystem. */
    const temp = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    try {
      /* Written and flushed before anything points at it, so what the
         rename publishes is on the disk and not merely in the cache. */
      const handle = await open(temp, "w");
      try {
        await handle.writeFile(text, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      /*
       * The copy being replaced, kept aside by a hard link.
       *
       * A link rather than a copy because it costs nothing and because the
       * document is never absent for an instant: renaming the old file out
       * of the way would leave a window in which a read — which does not
       * take the lock — sees nothing at all, and "nothing stored" is the
       * very answer that makes an unreadable document unrecoverable.
       *
       * Best effort throughout: there is nothing to keep on a first write,
       * and a filesystem that will not link is a filesystem where this
       * store still works.
       */
      await unlink(previousFor(dir, key)).catch(() => {});
      await link(target, previousFor(dir, key)).catch(() => {});
      await rename(temp, target);
      await syncDir(dir);
    } catch (err) {
      await unlink(temp).catch(() => {});
      throw err;
    }
  }

  return {
    /* The endpoints only ever ask for text, and consistency describes
       Netlify's edge, which a single process does not have: every read here
       is strong, so the option is accepted and ignored. */
    /**
     * @param {string} key
     * @param {{ type?: string, consistency?: string }} [_opts] Accepted and ignored, as above.
     */
    async get(key, _opts) {
      return readRaw(key);
    },

    /**
     * @param {string} key
     * @param {{ type?: string, consistency?: string }} [_opts] Accepted and ignored, as above.
     */
    async getWithMetadata(key, _opts) {
      const data = await readRaw(key);
      if (data === null) return null;
      return { data, etag: etagOf(data) };
    },

    /**
     * The copy the last write replaced, where one was kept.
     *
     * For one caller: the sync endpoint, when the document it holds cannot
     * be parsed. Everything else reads the document itself and should not
     * know this exists.
     * @param {string} key
     */
    async getPrevious(key) {
      try {
        return await readFile(previousFor(dir, key), "utf8");
      } catch (err) {
        if (err && /** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
        throw err;
      }
    },

    /*
     * Netlify's contract, which the sync endpoint depends on:
     *   onlyIfNew    write only when nothing is stored under the key
     *   onlyIfMatch  write only when the stored ETag is the one given
     * A refused write reports modified: false rather than throwing, and the
     * endpoint turns that into a 409.
     */
    /**
     * @param {string} key
     * @param {unknown} value
     * @param {WriteCondition} [opts]
     */
    async set(key, value, opts = {}) {
      const text = String(value);
      return underLock(`${dir} ${key}`, async () => {
        if (opts.onlyIfNew || opts.onlyIfMatch) {
          const current = await readRaw(key);
          if (opts.onlyIfNew && current !== null) return { modified: false };
          if (opts.onlyIfMatch) {
            if (current === null) return { modified: false };
            if (etagOf(current) !== opts.onlyIfMatch) return { modified: false };
          }
        }
        await writeRaw(key, text);
        return { modified: true, etag: etagOf(text) };
      });
    },

    /* Under the lock, like a conditional write: a delete that interleaved
       with one would let the write report an ETag for a document that no
       longer exists. */
    /** @param {string} key */
    async delete(key) {
      return underLock(`${dir} ${key}`, async () => {
        for (const at of [fileFor(dir, key), previousFor(dir, key)]) {
          try {
            await unlink(at);
          } catch (err) {
            /* Deleting what isn't there is not a failure; the endpoints
               delete optimistically in several places. */
            if (!err || /** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") throw err;
          }
        }
      });
    },

    /* So the server can say where documents are going when it starts. */
    get directory() {
      return dir;
    },
  };
}

export const dataRoot = ROOT;
export const dataRootFrom = resolved.from;
export const dataRootDurable = resolved.durable;
