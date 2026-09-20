import type { Doc, ExerciseState, Form, Item, Parked, WireDoc } from "./types.ts";
import { mergeMet } from "./variables.ts";
import { formsOf } from "./cards.ts";
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

export function saveSyncConfig(cfg: Record<string, any>) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* storage full or blocked */
  }
}

/* The passphrase itself never leaves the device — only its digest. */
export async function tokenFor(passphrase: string) {
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
function mergeStates(
  sa: Record<string, ExerciseState> = {},
  sb: Record<string, ExerciseState> = {},
  /*
   * When this card was last sent back to the beginning, if it was.
   *
   * A reset writes a blank schedule, which is exactly what the app makes
   * for one that was never stored — so it is left off the wire, and this
   * kept whatever the other side still held. Anything answered before the
   * reset is not evidence any more, so it is dropped rather than merged.
   */
  since = 0,
): Record<string, ExerciseState> {
  const s: Record<string, ExerciseState> = {};
  const live = (st: ExerciseState | undefined) =>
    st && (!since || (st.updated || 0) >= since) ? st : undefined;
  for (const t of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    const a = live(sa[t]);
    const b = live(sb[t]);
    if (!a && !b) continue;
    if (!a) s[t] = b as ExerciseState;
    else if (!b) s[t] = a;
    else s[t] = (a.updated || 0) >= (b.updated || 0) ? a : b;
  }
  return s;
}

function mergeItem(a: Item, b: Item): Item {
  // Text fields, tags, kind and note come from whichever was edited last.
  const base = (a.updated || 0) >= (b.updated || 0) ? a : b;
  const other = base === a ? b : a;
  /* The later of the two resets, which every schedule below is read
     against: a card sent back to the beginning stays there. */
  const reset = Math.max(Number(a.reset) || 0, Number(b.reset) || 0);
  /*
   * And what the learner said about wanting this card next, which is the
   * one fact on the card that is theirs rather than the teacher's.
   *
   * Taken by its own stamp rather than with the rest of the card. Every
   * graded answer stamps the card, so the side that merely answered it was
   * usually the later one — and `...base` then dropped a mark the other
   * device had just set. Where neither side says when, the card that was
   * touched last still decides, which is how every mark written before
   * this reads.
   */
  const spoke = (it: Item) => Number(it.priorityAt) || 0;
  const wants = spoke(a) || spoke(b) ? (spoke(a) >= spoke(b) ? a : b) : base;

  /* Every form of the card carries its own progress, and it merges the
     same way — by form, then by exercise type. Taking the whole list from
     one side threw away the other device's work on any form it had drilled.
     The card's own word is the first of them and merges with the rest; it
     used to be a second piece of code beside this one. */
  const forms = formsOf(base).map((f) => {
    const twin = formsOf(other).find((x) => x.id === f.id);
    if (!twin && !reset) return f;
    return {
      ...f,
      s: mergeStates(f.s, twin ? twin.s : {}, reset),
      ...metOf(f, twin || f, reset),
    };
  });

  /* The lines of a dialog, for the same reason: each carries its own
     progress, and a device that drilled line three has work the other one
     has not seen. The wording comes from whichever side was edited last,
     as everything else on the card does. */
  const lines = (base.lines || []).map((ln) => {
    const twin = (other.lines || []).find((x) => x.id === ln.id);
    if (!twin && !reset) return ln;
    return {
      ...ln,
      s: mergeStates(ln.s, twin ? twin.s : {}, reset),
      ...metOf(ln, twin || ln, reset),
    };
  });

  return {
    ...base,
    forms,
    ...(lines.length ? { lines } : null),
    /* Both of the facts that are the learner's own rather than the
       card's, each taken by its own stamp — see above. */
    ...(reset ? { reset } : null),
    ...(wants.priorityAt
      ? { priority: !!wants.priority, priorityAt: wants.priorityAt }
      : wants.priority
      ? { priority: true }
      : { priority: undefined }),
  };
}

/*
 * Which of a frame's values each device has met, merged.
 *
 * A record of how far a hole has been filled with each value, and a
 * high-water mark per key — so the merge is a max, which is the same
 * answer whichever device arrives first and the same answer again if it
 * arrives twice. Spread rather than assigned, so a form that has no such
 * record does not start carrying an empty one. */
const metOf = (
  a: Form,
  b: Form,
  /* A reset clears this too — which of a sentence's blanks has been filled
     with which word is something the app learnt about this learner. There
     is no stamp inside the record to read, so the whole of it goes: the
     reset side carries none, and taking the other side's would be putting
     back what was just cleared. */
  reset = 0,
): { met?: Record<string, number> } => {
  if (reset) return {};
  const met = mergeMet(a && a.met, b && b.met);
  return met ? { met } : {};
};

/**
 * @param remote  Whatever came back, which may be from an older build.
 */
export function mergeData(local: Doc, remote: WireDoc | null): Doc {
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

  /*
   * --- the drawer of withdrawn work ---
   *
   * Union by card, and where both sides have one the later parking wins:
   * a device that saw the card go away holds what it had, and a device
   * that never saw it has nothing to add. It is pruned on the same
   * schedule as the headstones, so a card gone for good does not sit here
   * for ever.
   */
  const parked: Record<string, Parked> = { ...(remote.parked || {}) };
  for (const [id, saved] of Object.entries(local.parked || {})) {
    const had = parked[id];
    if (!had || (saved.at || 0) >= (had.at || 0)) parked[id] = saved;
  }
  for (const id of Object.keys(parked)) {
    if ((parked[id].at || 0) < cutoff) delete parked[id];
  }

  /* --- activity log: max per day, so re-merging can't inflate it --- */
  const log = { ...(remote.log || {}) };
  for (const [day, n] of Object.entries(local.log || {})) {
    log[day] = Math.max(n, log[day] || 0);
  }

  /* --- and what the ladder did, by the same rule, one count at a time.
     Adding them would double a day every time a device synced twice; the
     larger of the two is the honest answer, and it is what the cards
     themselves will bear out. A day recorded on the phone and not on the
     laptop survives either way round. --- */
  const moves: Record<string, { up: number; cleared: number; learnt: number }> = {};
  for (const day of new Set([...Object.keys(remote.moves || {}), ...Object.keys(local.moves || {})])) {
    const a = (remote.moves || {})[day] || { up: 0, cleared: 0, learnt: 0 };
    const b = (local.moves || {})[day] || { up: 0, cleared: 0, learnt: 0 };
    moves[day] = {
      up: Math.max(a.up || 0, b.up || 0),
      cleared: Math.max(a.cleared || 0, b.cleared || 0),
      learnt: Math.max(a.learnt || 0, b.learnt || 0),
    };
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
    parked,
    log,
    moves,
    settings: { ...local.settings, ...settings },
    settingsUpdated: Math.max(local.settingsUpdated || 0, remote.settingsUpdated || 0),
  };
}

/* ---------------- transport ---------------- */

/* A hung request would leave the sync dot spinning until the app is
   reloaded; past the deadline it counts as a failed sync and the next
   one starts clean. */
const SYNC_TIMEOUT_MS = 30000;

async function fetchT(url: string, opts: RequestInit = {}) {
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: abort.signal });
  } finally {
    clearTimeout(deadline);
  }
}

async function pull(token: string) {
  const res = await fetchT(ENDPOINT, { headers: { "x-sync-token": token } });
  if (res.status === 401) throw new Error("bad-passphrase");
  if (!res.ok) throw new Error(`pull-failed-${res.status}`);
  return res.json();
}

async function push(token: string, etag: string | null, data: Doc) {
  const res = await fetchT(ENDPOINT, {
    method: "POST",
    headers: { "x-sync-token": token, "content-type": "application/json" },
    body: JSON.stringify({
      etag,
      data,
      /*
       * Whether this device means to send nothing.
       *
       * The server refuses a push that would empty a document that is not
       * empty, because the only way to reach that is a merge that lost
       * everything — a device with nothing on it pulls first, so what it
       * sends carries whatever was there. A learner who has genuinely
       * removed every card has the headstones to show for it, and that is
       * what this says.
       */
      allowEmpty:
        !(data.items || []).length && Object.keys(data.tombstones || {}).length > 0,
    }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    /* Two different refusals share the code. A conflict is retried; a push
       that would empty the document is a bug on this device and retrying
       it would only ask again. */
    if (body && body.error === "would-empty") throw new Error("would-empty");
    return { conflict: true };
  }
  if (res.status === 401) throw new Error("bad-passphrase");
  /* Said by name, so the app can explain it rather than reporting that
     sync failed for no stated reason. A document past the limit never
     syncs again until it is smaller, which is worth saying out loud. */
  if (res.status === 413) throw new Error("too-large");
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

export function isFreshState(s: ExerciseState | null | undefined) {
  return (
    !s ||
    (s.phase === "new" &&
      !s.reps &&
      !s.lapses &&
      !s.skips &&
      !s.near &&
      !s.hints &&
      !s.updated &&
      !(s.hist && s.hist.length))
  );
}

function compactStates(s?: Record<string, ExerciseState>): Record<string, ExerciseState> {
  const out: Record<string, ExerciseState> = {};
  for (const [t, st] of Object.entries(s || {})) if (!isFreshState(st)) out[t] = st;
  return out;
}

export function compactItem(it: Item): Item {
  const lines = it.lines;
  return {
    ...it,
    forms: formsOf(it).map((f) => ({ ...f, s: compactStates(f.s) })),
    /* A scene's lines carry states the same way, and a scene is several
       forms' worth of them. Left out where there are none, so an ordinary
       card does not start travelling with an empty list. */
    ...(lines ? { lines: lines.map((ln) => ({ ...ln, s: compactStates(ln.s) })) } : null),
  };
}

/* Strip anything device-specific before it goes up, and every state that
   says nothing. */
function forWire(data: Doc): Doc {
  return {
    version: data.version,
    items: (data.items || []).map(compactItem),
    tombstones: data.tombstones || {},
    parked: data.parked || {},
    log: data.log || {},
    moves: data.moves || {},
    settings: data.settings,
    settingsUpdated: data.settingsUpdated || 0,
  };
}

/*
 * One round trip: pull, merge, push. Returns the merged document and
 * whether it differs from what we had, so the caller can adopt it.
 */
/*
 * The limit the server refuses a document past, and the point at which it
 * is worth saying so.
 *
 * Past the limit, sync stops for good: everything a learner does after it
 * stays on one device, and all they were told was that sync failed. The
 * warning exists so that the first they hear of it is not the day they lose
 * a phone. In bytes, which is what the server counts — measured by length
 * it was counting UTF-16 units, so a document written in Arabic hit the
 * ceiling at roughly half the size of one written in Latin letters.
 */
export const MAX_DOC_BYTES = 4 * 1024 * 1024;
const WARN_AT = 0.75;

/*
 * And the ceiling on this side of the wire, which is the lower of the two
 * and was never checked.
 *
 * The document is kept in the browser's ordinary key-value store, which
 * the common browsers cap around five megabytes of UTF-16 — and it shares
 * that cap with the account, the sync settings, the courses and the queue
 * of work waiting to go up. A document that outgrows it does not fail to
 * sync; it fails to *save*, on a device that goes on showing every answer
 * as though it had been recorded.
 *
 * Measured in UTF-16 units here on purpose, because that is what the store
 * counts, where the server counts bytes. The same Arabic document is
 * therefore nearer the server's limit and further from this one, which is
 * exactly why both have to be asked rather than one standing in for the
 * other.
 */
export const MAX_LOCAL_UNITS = 5 * 1024 * 1024;
/* Earlier than the wire's warning: this failure is quieter, and the way
   out of it — removing recordings — takes longer than one sitting. */
const LOCAL_WARN_AT = 0.7;

/**
 * How big the document is, against both of the limits it has to live
 * under, and whether either is close enough to be worth saying.
 */
export function docSize(data: Doc): {
  bytes: number;
  limit: number;
  tight: boolean;
  units: number;
  localLimit: number;
  localTight: boolean;
} {
  const wire = JSON.stringify(forWire(data));
  const bytes = new TextEncoder().encode(wire).length;
  /* What the device stores is the document, not the wire form — but the
     two differ only in the fields sync leaves behind, so the wire form is
     a fair and cheap measure of it. */
  const units = wire.length;
  return {
    bytes,
    limit: MAX_DOC_BYTES,
    tight: bytes > MAX_DOC_BYTES * WARN_AT,
    units,
    localLimit: MAX_LOCAL_UNITS,
    localTight: units > MAX_LOCAL_UNITS * LOCAL_WARN_AT,
  };
}

export async function syncOnce(local: Doc, token: string) {
  let { etag, data: remote, lost } = await pull(token);
  let merged = mergeData(local, remote);

  let result = await push(token, etag, forWire(merged));

  // Someone else wrote between our read and our write — redo it once.
  if (result.conflict) {
    const again = await pull(token);
    merged = mergeData(merged, again.data);
    if (again.lost) lost = again.lost;
    result = await push(token, again.etag, forWire(merged));
    if (result.conflict) throw new Error("conflict");
  }

  const changed = JSON.stringify(forWire(local)) !== JSON.stringify(forWire(merged));
  /*
   * `lost` where the shared copy could not be read and this sync replaced
   * it. Worth telling the learner: what was on this device is safe, and
   * anything another device had synced and this one never pulled went with
   * it. "recovered" is the copy behind it standing in, "unreadable" is
   * nothing left to stand in.
   */
  return { merged, changed, lost: (lost as string) || "" };
}

/* ------------------------------------------------------------------
   Clip transport

   Clips are immutable and addressed by id, so reconciling is simple:
   fetch anything the document references that isn't on this device, and
   upload anything on this device the server hasn't seen. A local ledger
   of uploaded ids keeps this from re-checking every clip every sync.
   ------------------------------------------------------------------ */

export async function pullClip(token: string, id: string) {
  const res = await fetchT(`${ENDPOINT}?audio=${encodeURIComponent(id)}`, {
    headers: { "x-sync-token": token },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`clip-pull-${res.status}`);
  const body = await res.json();
  return body.data || null;
}

export async function pushClip(token: string, id: string, dataUrl: string) {
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
/** @param data  Only the items are read, so a partial document will do. */
export function clipIdsIn(data: WireDoc) {
  const ids = [];
  for (const it of data.items || []) {
    /* The card's own word and each of its forms, which is what formsOf
       hands out in one list. */
    for (const f of formsOf(it)) for (const r of f.recs || []) ids.push(r.id);
    for (const ln of it.lines || []) {
      for (const r of ln.recs || []) ids.push(r.id);
    }
  }
  return ids;
}

/*
 * This device's recordings, as the three things syncing them needs to ask.
 * Passed in rather than imported: what a clip is stored in differs between
 * the app (IndexedDB) and a test (a Map), and this module has no business
 * knowing which.
 */
export interface ClipStore {
  /** Must only look at this device's store: no network, and nothing
      created as a side effect. */
  hasLocal: (id: string) => boolean | Promise<boolean>;
  /** A data URL (data:audio/...;base64,...), or null. An object URL is not
      a recording — sending one stored a "blob:" string on the server and an
      empty clip on every other device. */
  readLocal: (id: string) => Promise<string | null>;
  writeLocal: (id: string, url: string) => void | Promise<void>;
  /** Clips this device has already sent up, so they are not offered again. */
  uploaded?: Iterable<string>;
}

/* Clips the server said it doesn't have. Remembered for this session only,
   so one sync's worth of 404s isn't asked again on the next — but a clip
   uploaded from another device later is still found after a reload. */
const KNOWN_MISSING = new Set();

/**
 * Reconcile clips after the document has merged. Returns counts so the
 * caller can report progress.
 * @param data  Only the items are read, so a partial document will do.
 */
export async function syncClips(
  token: string,
  data: WireDoc,
  { hasLocal, readLocal, writeLocal, uploaded }: ClipStore,
) {
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

/**
 * Take in whatever a document holds, then delete it.
 *
 * For the one caller: a document left behind under a private key an older
 * build used, once this device has synced under the shared one. That used
 * to be deleted on the assumption it held nothing this device lacked —
 * true of this device's own old key, and not true if another device had
 * synced progress under the same passphrase that this one never pulled. It
 * was deleted without ever being read.
 *
 * So it is read first and merged in, and the caller is handed the result to
 * adopt. The delete happens either way: a document that cannot be read is
 * a document with nothing to lose.
 */
export async function drainRemote(token: string, local: Doc): Promise<Doc> {
  let merged = local;
  try {
    const { data } = await pull(token);
    merged = mergeData(local, data);
  } catch (e) {
    /* Nothing readable there, which is the ordinary case. */
  }
  await forgetRemote(token);
  return merged;
}

export async function forgetRemote(token: string) {
  await fetchT(ENDPOINT, { method: "DELETE", headers: { "x-sync-token": token } });
}
