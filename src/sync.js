/** @import { Doc, ExerciseState, Form, Item, WireDoc } from "./types.ts" */
/*
 * Sync client.
 *
 * Merge strategy: last writer wins, but per exercise state rather than
 * per document. Every exercise state and every item carries an `updated`
 * timestamp; merging keeps whichever side is newer for each one
 * independently. Studying on two devices in the same day only loses
 * something if both touched the same exercise of the same item between
 * syncs — and then the later answer wins, which is the right answer.
 *
 * Merging is idempotent: merging twice gives the same result as once.
 */

const ENDPOINT = "/api/sync";
const CFG_KEY = "arabic-trainer:sync-config";
const TOMBSTONE_DAYS = 180;

/* ---------------- config, kept out of the synced document ---------------- */

/*
 * The passphrase is kept here in plain text alongside its digest, so it
 * can be shown again when setting up another device. It never leaves the
 * device — only the digest is sent — but it does mean anyone with access
 * to this browser profile can read it.
 */
export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { token: "", phrase: "", lastSync: 0, uploaded: [], ...JSON.parse(raw) };
  } catch (e) {
    /* nothing saved */
  }
  return { token: "", phrase: "", lastSync: 0, uploaded: [] };
}

/** @param {Record<string, any>} cfg */
export function saveSyncConfig(cfg) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* storage full or blocked */
  }
}

/* The passphrase itself never leaves the device — only its digest. */
/** @param {string} passphrase */
export async function tokenFor(passphrase) {
  const bytes = new TextEncoder().encode(String(passphrase).trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function suggestPassphrase() {
  const words = [
    "amber", "cedar", "harbour", "lantern", "meadow", "quartz", "raven", "saffron",
    "thistle", "velvet", "willow", "cobalt", "ember", "fjord", "gable", "indigo",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${pick()}-${Math.floor(Math.random() * 900 + 100)}`;
}

/* ---------------- merge ---------------- */

/* Progress for one form: each exercise type kept from whichever device
   answered it most recently, so two devices drilling different exercises
   both keep their work. */
/**
 * @param {Record<string, ExerciseState>} [sa]
 * @param {Record<string, ExerciseState>} [sb]
 * @returns {Record<string, ExerciseState>}
 */
function mergeStates(sa = {}, sb = {}) {
  /** @type {Record<string, ExerciseState>} */
  const s = {};
  for (const t of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    if (!sa[t]) s[t] = sb[t];
    else if (!sb[t]) s[t] = sa[t];
    else s[t] = (sa[t].updated || 0) >= (sb[t].updated || 0) ? sa[t] : sb[t];
  }
  return s;
}

/**
 * @param {Item} a
 * @param {Item} b
 * @returns {Item}
 */
function mergeItem(a, b) {
  // Text fields, tags, kind and note come from whichever was edited last.
  const base = (a.updated || 0) >= (b.updated || 0) ? a : b;
  const other = base === a ? b : a;

  /* The other forms of the card carry their own progress, and it merges the
     same way — by form, then by exercise type. Taking the whole list from
     one side threw away the other device's work on any form it had drilled. */
  const subs = (base.subs || []).map((sb) => {
    const twin = (other.subs || []).find((/** @type {Form} */ x) => x.id === sb.id);
    return twin ? { ...sb, s: mergeStates(sb.s, twin.s) } : sb;
  });

  /* The lines of a dialog, for the same reason: each carries its own
     progress, and a device that drilled line three has work the other one
     has not seen. The wording comes from whichever side was edited last,
     as everything else on the card does. */
  const lines = (/** @type {any} */ (base).lines || []).map((/** @type {Form} */ ln) => {
    const twin = (/** @type {any} */ (other).lines || []).find(
      (/** @type {Form} */ x) => x.id === ln.id
    );
    return twin ? { ...ln, s: mergeStates(ln.s, twin.s) } : ln;
  });

  return {
    ...base,
    s: mergeStates(a.s, b.s),
    subs,
    .../** @type {any} */ (lines.length ? { lines } : null),
  };
}

/**
 * @param {Doc} local
 * @param {WireDoc | null} remote  Whatever came back, which may be from an older build.
 * @returns {Doc}
 */
export function mergeData(local, remote) {
  if (!remote || !Array.isArray(remote.items)) return local;

  /* --- items --- */
  const mine = new Map((local.items || []).map((it) => [it.id, it]));
  const merged = [];
  const seen = new Set();

  for (const theirs of remote.items) {
    const ours = mine.get(theirs.id);
    merged.push(ours ? mergeItem(ours, theirs) : theirs);
    seen.add(theirs.id);
  }
  for (const ours of local.items || []) {
    if (!seen.has(ours.id)) merged.push(ours);
  }

  /* --- deletions --- */
  const tombstones = { ...(remote.tombstones || {}) };
  for (const [id, ts] of Object.entries(local.tombstones || {})) {
    tombstones[id] = Math.max(ts, tombstones[id] || 0);
  }
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86400000;
  for (const id of Object.keys(tombstones)) {
    if (tombstones[id] < cutoff) delete tombstones[id];
  }
  // A deletion wins unless the item was edited after it was deleted.
  const items = merged.filter(
    (it) => !(tombstones[it.id] && tombstones[it.id] >= (it.updated || 0))
  );

  /* --- activity log: max per day, so re-merging can't inflate it --- */
  const log = { ...(remote.log || {}) };
  for (const [day, n] of Object.entries(local.log || {})) {
    log[day] = Math.max(n, log[day] || 0);
  }

  /* --- settings: whichever was changed last --- */
  const settings =
    (local.settingsUpdated || 0) >= (remote.settingsUpdated || 0)
      ? local.settings
      : remote.settings;

  return {
    ...local,
    items,
    tombstones,
    log,
    settings: { ...local.settings, ...settings },
    settingsUpdated: Math.max(local.settingsUpdated || 0, remote.settingsUpdated || 0),
  };
}

/* ---------------- transport ---------------- */

/* A hung request would leave the sync dot spinning until the app is
   reloaded; past the deadline it counts as a failed sync and the next
   one starts clean. */
const SYNC_TIMEOUT_MS = 30000;

/**
 * @param {string} url
 * @param {RequestInit} [opts]
 */
async function fetchT(url, opts = {}) {
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: abort.signal });
  } finally {
    clearTimeout(deadline);
  }
}

/** @param {string} token */
async function pull(token) {
  const res = await fetchT(ENDPOINT, { headers: { "x-sync-token": token } });
  if (res.status === 401) throw new Error("bad-passphrase");
  if (!res.ok) throw new Error(`pull-failed-${res.status}`);
  return res.json();
}

/**
 * @param {string} token
 * @param {string | null} etag
 * @param {Doc} data
 */
async function push(token, etag, data) {
  const res = await fetchT(ENDPOINT, {
    method: "POST",
    headers: { "x-sync-token": token, "content-type": "application/json" },
    body: JSON.stringify({ etag, data }),
  });
  if (res.status === 409) return { conflict: true };
  if (res.status === 401) throw new Error("bad-passphrase");
  if (!res.ok) throw new Error(`push-failed-${res.status}`);
  return res.json();
}

/* ---------------- size ----------------

   Every form carries one state per exercise type, six in all, and most of
   them have never been touched. Writing those out cost about 4KB per card
   and put a hard ceiling near a thousand cards, at which point the server
   refused the document and sync failed for good. A state that has never
   been answered is exactly what the app makes for a missing one on load, so
   it is left out here and recreated there. In memory every state is always
   present; only what is stored and sent is sparse. */

/** @param {ExerciseState | null | undefined} s */
export function isFreshState(s) {
  return (
    !s ||
    (s.phase === "new" &&
      !s.reps &&
      !s.lapses &&
      !s.skips &&
      !s.near &&
      !s.updated &&
      !(s.hist && s.hist.length))
  );
}

/**
 * @param {Record<string, ExerciseState>} [s]
 * @returns {Record<string, ExerciseState>}
 */
function compactStates(s) {
  /** @type {Record<string, ExerciseState>} */
  const out = {};
  for (const [t, st] of Object.entries(s || {})) if (!isFreshState(st)) out[t] = st;
  return out;
}

/**
 * @param {Item} it
 * @returns {Item}
 */
export function compactItem(it) {
  const lines = /** @type {any} */ (it).lines;
  return {
    ...it,
    s: compactStates(it.s),
    subs: (it.subs || []).map((sb) => ({ ...sb, s: compactStates(sb.s) })),
    /* A scene's lines carry states the same way, and a scene is several
       forms' worth of them. Left out where there are none, so an ordinary
       card does not start travelling with an empty list. */
    .../** @type {any} */ (
      lines ? { lines: lines.map((/** @type {any} */ ln) => ({ ...ln, s: compactStates(ln.s) })) } : null
    ),
  };
}

/* Strip anything device-specific before it goes up, and every state that
   says nothing. */
/**
 * @param {Doc} data
 * @returns {Doc}
 */
function forWire(data) {
  return {
    version: data.version,
    items: (data.items || []).map(compactItem),
    tombstones: data.tombstones || {},
    log: data.log || {},
    settings: data.settings,
    settingsUpdated: data.settingsUpdated || 0,
  };
}

/*
 * One round trip: pull, merge, push. Returns the merged document and
 * whether it differs from what we had, so the caller can adopt it.
 */
/**
 * @param {Doc} local
 * @param {string} token
 */
export async function syncOnce(local, token) {
  let { etag, data: remote } = await pull(token);
  let merged = mergeData(local, remote);

  let result = await push(token, etag, forWire(merged));

  // Someone else wrote between our read and our write — redo it once.
  if (result.conflict) {
    const again = await pull(token);
    merged = mergeData(merged, again.data);
    result = await push(token, again.etag, forWire(merged));
    if (result.conflict) throw new Error("conflict");
  }

  const changed = JSON.stringify(forWire(local)) !== JSON.stringify(forWire(merged));
  return { merged, changed };
}

/* ------------------------------------------------------------------
   Clip transport

   Clips are immutable and addressed by id, so reconciling is simple:
   fetch anything the document references that isn't on this device, and
   upload anything on this device the server hasn't seen. A local ledger
   of uploaded ids keeps this from re-checking every clip every sync.
   ------------------------------------------------------------------ */

/**
 * @param {string} token
 * @param {string} id
 */
export async function pullClip(token, id) {
  const res = await fetchT(`${ENDPOINT}?audio=${encodeURIComponent(id)}`, {
    headers: { "x-sync-token": token },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`clip-pull-${res.status}`);
  const body = await res.json();
  return body.data || null;
}

/**
 * @param {string} token
 * @param {string} id
 * @param {string} dataUrl
 */
export async function pushClip(token, id, dataUrl) {
  const res = await fetchT(`${ENDPOINT}?audio=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "x-sync-token": token, "content-type": "application/json" },
    body: JSON.stringify({ data: dataUrl }),
  });
  if (!res.ok) throw new Error(`clip-push-${res.status}`);
  return true;
}

/* Every recording id the document refers to, across items, their forms and
   the lines of a dialog. A line's recording is a recording like any other:
   left out of here it would be dropped from the device it was made on. */
/** @param {WireDoc} data  Only the items are read, so a partial document will do. */
export function clipIdsIn(data) {
  const ids = [];
  for (const it of data.items || []) {
    for (const r of it.recs || []) ids.push(r.id);
    for (const sb of it.subs || []) for (const r of sb.recs || []) ids.push(r.id);
    for (const ln of /** @type {any} */ (it).lines || []) {
      for (const r of ln.recs || []) ids.push(r.id);
    }
  }
  return ids;
}

/*
 * Reconcile clips after the document has merged.
 *  hasLocal(id)  -> boolean. Must only look at this device's store: no
 *                   network, and nothing created as a side effect.
 *  readLocal(id) -> data URL (data:audio/...;base64,...) or null. An object
 *                   URL is not a recording; sending one stored a "blob:"
 *                   string on the server and an empty clip on every other
 *                   device.
 *  writeLocal(id, url)
 * Returns counts so the caller can report progress.
 */
/* Clips the server said it doesn't have. Remembered for this session only,
   so one sync's worth of 404s isn't asked again on the next — but a clip
   uploaded from another device later is still found after a reload. */
const KNOWN_MISSING = new Set();

/**
 * @param {string} token
 * @param {WireDoc} data  Only the items are read, so a partial document will do.
 * @param {{
 *   hasLocal: (id: string) => boolean | Promise<boolean>,
 *   readLocal: (id: string) => Promise<string | null>,
 *   writeLocal: (id: string, url: string) => void | Promise<void>,
 *   uploaded?: Iterable<string>,
 * }} store
 */
export async function syncClips(token, data, { hasLocal, readLocal, writeLocal, uploaded }) {
  const ids = clipIdsIn(data);
  let pulled = 0;
  let pushed = 0;
  const known = new Set(uploaded || []);

  /* Clips are small and independent, so a fresh device fetching a course's
     worth of recordings shouldn't queue them one behind another. A few at a
     time keeps it quick without hammering the endpoint. */
  const queue = ids.slice();
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (id === undefined) return;
      try {
        const here = await hasLocal(id);
        if (!here) {
          if (KNOWN_MISSING.has(id)) continue;
          const url = await pullClip(token, id);
          if (url) {
            await writeLocal(id, url);
            pulled += 1;
            known.add(id);
            KNOWN_MISSING.delete(id);
          } else {
            KNOWN_MISSING.add(id);
          }
        } else if (!known.has(id)) {
          const url = await readLocal(id);
          if (url && /^data:/.test(url)) {
            await pushClip(token, id, url);
            pushed += 1;
            known.add(id);
            KNOWN_MISSING.delete(id);
          }
        }
      } catch (e) {
        /* leave it for the next sync */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, ids.length || 1) }, worker));
  return { pulled, pushed, uploaded: [...known] };
}

/** @param {string} token */
export async function forgetRemote(token) {
  await fetchT(ENDPOINT, { method: "DELETE", headers: { "x-sync-token": token } });
}
