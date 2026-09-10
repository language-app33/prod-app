import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeData, compactItem, isFreshState, syncClips, clipIdsIn } from "../src/sync.js";
import { TYPES } from "../src/languages.js";
/** @import { Doc, Item, WireDoc } from "../src/types.js" */

const fresh = () => ({
  phase: "new", step: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0,
  right: 0, wrong: 0, skips: 0, near: 0, hist: [], updated: 0,
});
/* Imported, not copied. This list was written out by hand with a comment
   saying it must track the real one, and then it didn't: the two context
   exercises were added to the app and never here, so every merge assertion
   below had been running against a stale set of six for as long as they
   had existed. sync.js itself still imports nothing — but a test has no
   reason not to. */
const states = () => Object.fromEntries(TYPES.map((t) => [t, fresh()]));
/* A card that has never been answered has no schedule at all, and the app
   says so the same way — see statesOf in the trainer. */
/**
 * @param {Item} it
 * @returns {Record<string, any>}
 */
const statesOf = (it) => it.s || {};
/* Likewise the other forms: a card need not have any, and the fixtures
   here all do. */
/**
 * @param {Item} it
 * @returns {Item[]}
 */
const formsOf = (it) => /** @type {Item[]} */ (it.subs || []);

/**
 * Stand in for the network with something that answers only what the sync
 * client asks: whether it worked, and the JSON.
 *
 * Cast rather than completed for the same reason the smoke harness casts
 * its stubs — a whole Response would say less about what the client uses.
 * @param {(url: string, opts: { method?: string, body?: string }) => any} answer
 */
const stubFetch = (answer) => {
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (
    async (/** @type {any} */ url, /** @type {any} */ opts = {}) => answer(String(url), opts)
  ));
};
/* A card as the app makes one — `created` included, because every card
   the app has ever written has one and a fixture without it would be
   testing a shape nothing produces. */
/**
 * @param {string} id
 * @param {Record<string, any>} [extra]
 * @returns {Item}
 */
const item = (id, extra = {}) => ({
  id, ar: "كتاب", en: "book", lat: "kitaab", tags: [], created: 0, updated: 0,
  s: states(), subs: [{ id: `${id}-f0`, ar: "كتب", en: "books", lat: "", s: states() }], ...extra,
});

test("a state that was never answered is fresh; any answer is not", () => {
  assert.equal(isFreshState(fresh()), true);
  assert.equal(isFreshState(undefined), true);
  assert.equal(isFreshState({ ...fresh(), reps: 1 }), false);
  assert.equal(isFreshState({ ...fresh(), hist: [1] }), false);
  assert.equal(isFreshState({ ...fresh(), updated: 5 }), false);
  assert.equal(isFreshState({ ...fresh(), phase: "learning" }), false);
});

test("compactItem drops untouched states from the card and its forms, and shrinks a card about 4x", () => {
  const it = item("a");
  statesOf(it).ar2en = { ...fresh(), reps: 3, phase: "review", updated: 10 };
  const slim = compactItem(it);
  assert.deepEqual(Object.keys(statesOf(slim)), ["ar2en"]);
  assert.deepEqual(Object.keys(statesOf(/** @type {Item} */ ((slim.subs || [])[0]))), []);
  const ratio = JSON.stringify(it).length / JSON.stringify(slim).length;
  assert.ok(ratio > 3, `expected >3x, got ${ratio.toFixed(2)}x`);
});

test("merging a sparse remote against a full local keeps every answered state", () => {
  const local = doc([item("a")]);
  statesOf(local.items[0]).en2ar = { ...fresh(), reps: 2, updated: 50 };
  const remoteItem = compactItem(item("a"));
  statesOf(remoteItem).ar2en = { ...fresh(), reps: 5, updated: 100 };
  /* Sparse on purpose: this is a document from a device that wrote out
     only what it had answered, which is what compactItem is for. */
  /** @type {WireDoc} */
  const remote = { items: [remoteItem], tombstones: {}, log: {} };
  const merged = mergeData(local, remote);
  const s = statesOf(merged.items[0]);
  assert.equal(s.ar2en.reps, 5, "remote answer kept");
  assert.equal(s.en2ar.reps, 2, "local answer kept when remote omitted it");
  assert.equal((merged.items[0].subs || [])[0].id, "a-f0");
});

test("merge is idempotent on sparse documents", () => {
  const a = doc([compactItem(item("a"))]);
  const b = doc([compactItem(item("b"))]);
  const once = mergeData(a, b);
  const twice = mergeData(once, b);
  assert.deepEqual(twice.items.map((i) => i.id).sort(), ["a", "b"]);
  assert.deepEqual(twice.items, mergeData(twice, b).items);
});

/* ------------------------------------------------------------------
   Two devices, one card

   Everything above merges data that does not disagree — different
   exercise types, different cards. None of it says what happens when a
   phone and a laptop change the same thing, which is the case the whole
   merge exists for and the one where work gets lost. These pin it.

   The rule throughout is last-writer-wins on `updated`. Where that costs
   something, the cost is written down rather than asserted away.
   ------------------------------------------------------------------ */

/* One card, as it stands on the server before either device touches it. */
/**
 * @param {Record<string, any>} [extra]
 * @returns {Item}
 */
const shared = (extra = {}) => ({
  id: "c1", ar: "كتاب", en: "book", lat: "kitaab", tags: [], created: 0, updated: 100,
  s: states(), subs: [{ id: "c1-f0", ar: "كتب", en: "books", lat: "", s: states() }], ...extra,
});
/* `version` because this is the device's own document, and that always
   has one: EMPTY sets it and every write carries it through. */
/**
 * @param {Item[]} items
 * @param {Partial<Doc>} [extra]
 * @returns {Doc}
 */
const doc = (items, extra = {}) => ({
  version: 3, items, tombstones: {}, log: {}, settings: {}, settingsUpdated: 0, ...extra,
});

test("two devices edit the same field: the later edit wins", () => {
  const phone = shared({ en: "a book", updated: 200 });
  const laptop = shared({ en: "the book", updated: 300 });
  assert.equal(mergeData(doc([phone]), doc([laptop])).items[0].en, "the book");
  /* And the other way round, so it is the timestamp deciding and not the
     order the two documents happen to arrive in. */
  assert.equal(mergeData(doc([laptop]), doc([phone])).items[0].en, "the book");
});

test("two devices edit different fields of one card: the earlier edit is still lost", () => {
  /* This is the cost of last-writer-wins on a whole card, and it is worth
     stating plainly: the phone's correction to the transliteration is
     dropped even though the laptop never touched that field. Merging text
     field by field would need a timestamp per field, which cards do not
     carry. */
  const phone = shared({ lat: "kitaab (corrected)", updated: 200 });
  const laptop = shared({ en: "the book", updated: 300 });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.equal(out.en, "the book", "the later device's edit is kept");
  assert.equal(out.lat, "kitaab", "and the earlier device's edit to another field is not");
});

test("two devices answer different exercises on one card: both answers survive", () => {
  /* The point of merging progress type by type rather than taking one
     side's whole record. Drill on the bus, drill at the desk, keep both. */
  const phone = shared({ updated: 200 });
  statesOf(phone).ar2en = { ...fresh(), reps: 3, updated: 210 };
  const laptop = shared({ updated: 300 });
  statesOf(laptop).en2ar = { ...fresh(), reps: 7, updated: 310 };
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.equal(statesOf(out).ar2en.reps, 3, "the phone's work on one exercise");
  assert.equal(statesOf(out).en2ar.reps, 7, "the laptop's work on another");
});

test("an exercise only the other device has answered is carried across", () => {
  /* Both directions, because they are different branches. A device that
     has never answered a type drops it when it compacts, so the incoming
     document is the only place that answer exists — take the union and it
     survives, take either side's key list and it does not. */
  const untouched = shared({ updated: 100 });
  delete statesOf(untouched).en2ar;
  const answered = shared({ updated: 200 });
  statesOf(answered).en2ar = { ...fresh(), reps: 6, updated: 210 };

  assert.equal(statesOf(mergeData(doc([untouched]), doc([answered])).items[0]).en2ar.reps, 6,
    "the incoming answer is kept when this device has no record of that exercise");
  assert.equal(statesOf(mergeData(doc([answered]), doc([untouched])).items[0]).en2ar.reps, 6,
    "and it is kept when the roles are reversed");
});

test("two devices answer the same exercise: the later answer wins, by its own clock", () => {
  const phone = shared({ updated: 900 });
  statesOf(phone).ar2en = { ...fresh(), reps: 3, interval: 5, updated: 100 };
  const laptop = shared({ updated: 100 });
  statesOf(laptop).ar2en = { ...fresh(), reps: 9, interval: 40, updated: 900 };
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  /* Note the card's own `updated` says the phone edited last, but progress
     is decided per exercise type by that state's own stamp — so the
     laptop's more recent answer is the one kept. */
  assert.equal(statesOf(out).ar2en.reps, 9);
  assert.equal(statesOf(out).ar2en.interval, 40);
});

test("progress on a form survives a text edit made on the other device", () => {
  const phone = shared({ updated: 200 });
  statesOf(formsOf(phone)[0]).ar2en = { ...fresh(), reps: 4, updated: 250 };
  const laptop = shared({ en: "the book", updated: 300 });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.equal(out.en, "the book", "the laptop's text edit is kept");
  assert.equal(statesOf(formsOf(out)[0]).ar2en.reps, 4, "and the phone's work on the plural is not thrown away");
});

test("a form added on the losing device is dropped", () => {
  /* Recorded, not endorsed. Which forms a card has is taken whole from
     whichever device wrote last, so a form added on the other one goes.
     The alternative — taking the union — would resurrect forms that had
     been deliberately deleted, because forms carry no timestamp and no
     tombstone of their own. Neither answer is right; this is the one the
     code gives, and the fix is a per-form stamp rather than a different
     choice between these two. */
  const phone = shared({ updated: 200 });
  formsOf(phone).push(item("c1-f1", { ar: "كتابان", en: "two books", subs: [] }));
  const laptop = shared({ en: "the book", updated: 300 });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.deepEqual(formsOf(out).map((f) => f.id), ["c1-f0"], "the added form is gone");

  /* The same card, with the phone editing last, keeps it — which is what
     makes this a race and not a rule. */
  const other = mergeData(doc([shared({ en: "the book", updated: 100 })]), doc([phone])).items[0];
  assert.deepEqual(formsOf(other).map((f) => f.id), ["c1-f0", "c1-f1"]);
});

test("a recording added on the losing device is dropped", () => {
  /* Same shape as the form above, and worth its own test because a lost
     recording cannot be retyped. */
  const phone = shared({ updated: 200, recs: [{ id: "r-phone" }] });
  const laptop = shared({ en: "the book", updated: 300, recs: [] });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.deepEqual(out.recs, [], "the phone's recording is not carried across");
});

test("a card deleted on one device stays deleted unless the other edited it later", () => {
  /* Real timestamps, not the small numbers the tests above use: a deletion
     is forgotten once it is a month old, so a tombstone stamped in 1970 is
     swept away before it can delete anything. */
  const deletedAt = Date.now() - 60 * 1000;
  const deleting = doc([], { tombstones: { c1: deletedAt } });

  assert.equal(mergeData(doc([shared({ updated: deletedAt + 1000 })]), deleting).items.length, 1,
    "an edit after the deletion brings the card back");
  assert.equal(mergeData(doc([shared({ updated: deletedAt - 1000 })]), deleting).items.length, 0,
    "an edit before it does not");
});

test("a deletion older than a month is forgotten, and stops deleting", () => {
  const ancient = Date.now() - 400 * 86400000;
  const out = mergeData(doc([shared({ updated: ancient - 1000 })]), doc([], { tombstones: { c1: ancient } }));
  assert.equal(out.items.length, 1, "the card comes back");
  assert.deepEqual(out.tombstones, {}, "and the tombstone is swept up rather than kept forever");
});

test("settings are one object, so a toggle on the losing device is lost", () => {
  /* Another cost worth naming: settings merge whole rather than key by
     key. Turn on listening exercises on the phone and change the theme on
     the laptop a minute later, and the listening change goes. */
  const phone = doc([], { settings: { types: { rec2en: true }, theme: "dark" }, settingsUpdated: 200 });
  const laptop = doc([], { settings: { types: { rec2en: false }, theme: "light" }, settingsUpdated: 300 });
  const out = mergeData(phone, laptop);
  assert.equal(out.settings.theme, "light");
  assert.equal(out.settings.types.rec2en, false, "the phone's change to a different setting is lost");
  assert.equal(out.settingsUpdated, 300);
});

test("merging a conflict twice changes nothing the second time", () => {
  /* Sync merges, pushes, and on a 409 pulls and merges again. If a second
     merge moved anything, two devices could push each other back and
     forth without ever settling. */
  const phone = shared({ en: "a book", updated: 200 });
  statesOf(phone).ar2en = { ...fresh(), reps: 3, updated: 210 };
  const laptop = shared({ en: "the book", updated: 300 });
  statesOf(laptop).en2ar = { ...fresh(), reps: 7, updated: 310 };
  const once = mergeData(doc([phone]), doc([laptop]));
  const twice = mergeData(once, doc([laptop]));
  assert.deepEqual(twice.items, once.items);
});

test("the exercise types this file merges are the ones the app has", () => {
  /* The list used to be copied here by hand and drifted by two. */
  assert.ok(TYPES.length >= 6, `only ${TYPES.length} types`);
  assert.deepEqual(Object.keys(states()).sort(), [...TYPES].sort());
});

test("syncClips never uploads an object URL and never fetches what is already local", async () => {
  /** @type {WireDoc} */
  const data = { items: [item("x", { recs: [{ id: "here" }, { id: "there" }], subs: [] })] };
  /** @type {[string | null, unknown][]} */
  const pushed = [];
  /** @type {(string | null)[]} */
  const pulled = [];
  stubFetch((url, opts) => {
    const id = new URL(url, "http://x").searchParams.get("audio");
    if (opts.method === "POST") {
      pushed.push([id, JSON.parse(opts.body || "{}").data]);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    pulled.push(id);
    return { ok: true, status: 200, json: async () => ({ data: "data:audio/webm;base64,AAAA" }) };
  });
  /** @type {[string, string][]} */
  const written = [];
  const res = await syncClips("t".repeat(64), data, {
    hasLocal: async (id) => id === "here",
    readLocal: async (id) => (id === "here" ? "blob:https://app/uuid" : null),
    writeLocal: async (/** @type {string} */ id, /** @type {string} */ url) => {
      written.push([id, url]);
    },
    uploaded: [],
  });
  assert.deepEqual(pushed, [], "a blob: URL must not be sent as a recording");
  assert.deepEqual(pulled, ["there"], "only the missing clip is fetched");
  assert.deepEqual(written, [["there", "data:audio/webm;base64,AAAA"]]);
  assert.equal(res.pulled, 1);
  assert.equal(res.pushed, 0);
});

test("syncClips uploads a real data URL once and remembers it", async () => {
  /** @type {WireDoc} */
  const data = { items: [item("x", { recs: [{ id: "mine" }], subs: [] })] };
  /** @type {string[]} */
  const pushed = [];
  stubFetch((url, opts) => {
    if (opts.method === "POST") {
      pushed.push(JSON.parse(opts.body || "{}").data.slice(0, 5));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  const hooks = {
    hasLocal: async () => true,
    readLocal: async () => "data:audio/webm;base64,BBBB",
    writeLocal: async () => {},
    uploaded: [],
  };
  const first = await syncClips("t".repeat(64), data, hooks);
  assert.deepEqual(pushed, ["data:"]);
  assert.deepEqual(first.uploaded, ["mine"]);
  const second = await syncClips("t".repeat(64), data, { ...hooks, uploaded: first.uploaded });
  assert.equal(pushed.length, 1, "already-uploaded clips are not sent again");
  assert.equal(second.pushed, 0);
});

test("clipIdsIn walks cards and their forms", () => {
  /** @type {WireDoc} */
  const data = {
    items: [
      item("x", { recs: [{ id: "a" }], subs: [{ id: "x-f0", ar: "", en: "", lat: "", recs: [{ id: "b" }] }] }),
      item("y", { recs: [], subs: [] }),
    ],
  };
  assert.deepEqual(clipIdsIn(data), ["a", "b"]);
});
