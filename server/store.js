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
 * The ETag is a digest of the content, so two documents with the same bytes
 * share an ETag. That is what the sync endpoint wants: a write that would
 * not change anything cannot be a lost update.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
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
      await writeFile(temp, text, "utf8");
      await rename(temp, target);
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

    /** @param {string} key */
    async delete(key) {
      try {
        await unlink(fileFor(dir, key));
      } catch (err) {
        /* Deleting what isn't there is not a failure; the endpoints delete
           optimistically in several places. */
        if (!err || /** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") throw err;
      }
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
