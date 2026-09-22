import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeData, compactItem, isFreshState, syncClips, clipIdsIn } from "../src/sync.ts";
import { TYPES } from "../src/languages.ts";
import { must } from "./helpers.mjs";
/** @import { Doc, Item, WireDoc } from "../src/types.ts" */

const fresh = () => ({
  phase: "new", step: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0,
  right: 0, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0,
});
/* Imported, not copied. This list was written out by hand with a comment
   saying it must track the real one, and then it didn't: the two context
   exercises were added to the app and never here, so every merge assertion
   below had been running against a stale set of six for as long as they
   had existed. sync.ts itself still imports nothing — but a test has no
   reason not to. */
const states = () => Object.fromEntries(TYPES.map((t) => [t, fresh()]));
/* A card that has never been answered has no schedule at all, and the app
   says so the same way — see statesOf in the trainer. */
/* A card's own word is the first of its forms, and its schedule is that
   form's — which is what every one of these reads. */
/**
 * @param {any} it
 * @returns {Record<string, any>}
 */
const statesOf = (it) => ((it && it.forms ? leadOf(it) : it) || {}).s || {};

/* The same card with something different written on its own word — which
   is a form's field now, not the card's. */
/**
 * @param {Record<string, any>} extra
 * @param {Record<string, any>} word
 * @returns {any}
 */
const worded = (extra, word) => {
  const it = shared(extra);
  return { ...it, forms: [{ ...it.forms[0], ...word }, ...it.forms.slice(1)] };
};
/**
 * @param {any} it
 * @returns {any}
 */
const leadOf = (it) => (it.forms || [])[0] || {};
/* And the alternates it carries, which is every form after the first. */
/**
 * @param {any} it
 * @returns {any[]}
 */
const formsOf = (it) => (it.forms || []).slice(1);

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
  id, tags: [], created: 0, updated: 0,
  forms: [
    { id, ar: "كتاب", en: "book", lat: "kitaab", s: states() },
    { id: `${id}-f0`, ar: "كتب", en: "books", lat: "", s: states() },
  ],
  ...extra,
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
  assert.deepEqual(Object.keys(statesOf(formsOf(slim)[0])), []);
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
  assert.equal(formsOf(merged.items[0])[0].id, "a-f0");
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
  id: "c1", tags: [], created: 0, updated: 100,
  forms: [
    { id: "c1", ar: "كتاب", en: "book", lat: "kitaab", s: states() },
    { id: "c1-f0", ar: "كتب", en: "books", lat: "", s: states() },
  ],
  ...extra,
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
  const phone = worded({ updated: 200 }, { en: "a book" });
  const laptop = worded({ updated: 300 }, { en: "the book" });
  assert.equal(leadOf(mergeData(doc([phone]), doc([laptop])).items[0]).en, "the book");
  /* And the other way round, so it is the timestamp deciding and not the
     order the two documents happen to arrive in. */
  assert.equal(leadOf(mergeData(doc([laptop]), doc([phone])).items[0]).en, "the book");
});

test("two devices edit different fields of one card: the earlier edit is still lost", () => {
  /* This is the cost of last-writer-wins on a whole card, and it is worth
     stating plainly: the phone's correction to the transliteration is
     dropped even though the laptop never touched that field. Merging text
     field by field would need a timestamp per field, which cards do not
     carry. */
  const phone = worded({ updated: 200 }, { lat: "kitaab (corrected)" });
  const laptop = worded({ updated: 300 }, { en: "the book" });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.equal(leadOf(out).en, "the book", "the later device's edit is kept");
  assert.equal(leadOf(out).lat, "kitaab", "and the earlier device's edit to another field is not");
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

test("and the same for a turn of a conversation, which keeps its own progress", () => {
  /*
   * A scene's turns are a second list beside its forms, each drilled and
   * scheduled in its own right — so they need the same type-by-type merge,
   * and for the same reason. Practising a scene on two devices and losing
   * one device's work would be the fault this whole file exists to catch,
   * one list over.
   */
  /* Cast, as the fixtures above are: what a merge reads of a scene is its
     turns and their schedules.
     @returns {Item} */
  const scene = (
    /** @type {Record<string, any>} */ over,
    /** @type {Record<string, any>} */ lineStates,
  ) => /** @type {Item} */ (/** @type {unknown} */ ({
    id: "c2", tags: [], created: 0, updated: 100,
    forms: [{ id: "c2", ar: "", en: "At the door", lat: "", s: states() }],
    lines: [
      { id: "c2-l0", ar: "مرحبا", en: "hello", s: { ...states(), ...lineStates } },
      { id: "c2-l1", ar: "أهلا", en: "hi", s: states() },
    ],
    ...over,
  }));
  const phone = scene({ updated: 200 }, { dlgpick: { ...fresh(), reps: 3, updated: 210 } });
  const laptop = scene({ updated: 300 }, { rec2en: { ...fresh(), reps: 7, updated: 310 } });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  const turn = must(must(out.lines, "the turns")[0], "the first turn").s;
  assert.equal(must(turn, "its schedule").dlgpick.reps, 3, "the phone's work on the turn");
  assert.equal(must(turn, "its schedule").rec2en.reps, 7, "and the laptop's");
  /* The turn nobody answered comes through untouched rather than being
     dropped along the way. */
  assert.equal(must(out.lines, "the turns").length, 2);
  assert.equal(must(out.lines, "the turns")[1].en, "hi");
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
  const laptop = worded({ updated: 300 }, { en: "the book" });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.equal(leadOf(out).en, "the book", "the laptop's text edit is kept");
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
  phone.forms.push({ id: "c1-f1", ar: "كتابان", en: "two books", lat: "", s: states() });
  const laptop = worded({ updated: 300 }, { en: "the book" });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.deepEqual(formsOf(out).map((f) => f.id), ["c1-f0"], "the added form is gone");

  /* The same card, with the phone editing last, keeps it — which is what
     makes this a race and not a rule. */
  const other = mergeData(doc([worded({ updated: 100 }, { en: "the book" })]), doc([phone])).items[0];
  assert.deepEqual(formsOf(other).map((f) => f.id), ["c1-f0", "c1-f1"]);
});

test("a recording added on the losing device is dropped", () => {
  /* Same shape as the form above, and worth its own test because a lost
     recording cannot be retyped. */
  const phone = worded({ updated: 200 }, { recs: [{ id: "r-phone" }] });
  const laptop = worded({ updated: 300 }, { en: "the book", recs: [] });
  const out = mergeData(doc([phone]), doc([laptop])).items[0];
  assert.deepEqual(leadOf(out).recs, [], "the phone's recording is not carried across");
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

test("settings are one object, so a change on the losing device is lost", () => {
  /* Another cost worth naming: settings merge whole rather than key by
     key. Turn the sounds down on the phone and change the theme on the
     laptop a minute later, and the sound change goes. */
  const phone = doc([], { settings: { sounds: "off", theme: "dark" }, settingsUpdated: 200 });
  const laptop = doc([], { settings: { sounds: "loud", theme: "light" }, settingsUpdated: 300 });
  const out = mergeData(phone, laptop);
  assert.equal(out.settings.theme, "light");
  assert.equal(out.settings.sounds, "loud", "the phone's change to a different setting is lost");
  assert.equal(out.settingsUpdated, 300);

  /* And the other way round, so it is the later stamp that is kept rather
     than whichever side the merge happened to read second. The stamp is
     what the *next* merge compares against, so a merge that lowered it
     would hand the settings back to the other device on the sync after
     this one. */
  const back = mergeData(laptop, phone);
  assert.equal(back.settings.theme, "light", "this device's own later change stands");
  assert.equal(back.settingsUpdated, 300, "and the stamp still says when it happened");
});

test("merging a conflict twice changes nothing the second time", () => {
  /* Sync merges, pushes, and on a 409 pulls and merges again. If a second
     merge moved anything, two devices could push each other back and
     forth without ever settling. */
  const phone = worded({ updated: 200 }, { en: "a book" });
  statesOf(phone).ar2en = { ...fresh(), reps: 3, updated: 210 };
  const laptop = worded({ updated: 300 }, { en: "the book" });
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
  const data = { items: [item("x", { forms: [{ id: "x", ar: "", en: "", lat: "", recs: [{ id: "here" }, { id: "there" }] }] })] };
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
  const data = { items: [item("x", { forms: [{ id: "x", ar: "", en: "", lat: "", recs: [{ id: "mine" }] }] })] };
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
      item("x", { forms: [
        { id: "x", ar: "", en: "", lat: "", recs: [{ id: "a" }] },
        { id: "x-f0", ar: "", en: "", lat: "", recs: [{ id: "b" }] },
      ] }),
      item("y", { forms: [{ id: "y", ar: "", en: "", lat: "", recs: [] }] }),
    ],
  };
  assert.deepEqual(clipIdsIn(data), ["a", "b"]);
});

test("which of a frame's values each device has met merges by taking the further", () => {
  /* A frame — "My name is {{name}}" — records how far it has been asked
     with each of the names that fill it, because a name that is never
     drilled on its own has no progress anywhere else to read. Two devices
     each learn some of it, and neither may lose the other's work. */
  const mine = /** @type {Doc} */ ({
    version: 3,
    items: [item("k1", {
      forms: [
        { id: "k1", ar: "كتاب", en: "book", lat: "", s: states(), met: { "name:raphael": 3, "name:sarah": 1 } },
        { id: "k1-f0", ar: "كتب", en: "books", lat: "", s: states(), met: { "name:victor": 2 } },
      ],
    })],
    tombstones: {}, log: {}, settings: {},
  });
  const theirs = /** @type {WireDoc} */ ({
    version: 3,
    items: [item("k1", {
      forms: [
        { id: "k1", ar: "كتاب", en: "book", lat: "", s: states(), met: { "name:raphael": 1, "name:sarah": 4 } },
        { id: "k1-f0", ar: "كتب", en: "books", lat: "", s: states(), met: { "name:victor": 1 } },
      ],
    })],
    tombstones: {}, log: {},
  });

  const merged = mergeData(mine, theirs).items[0];
  assert.deepEqual(leadOf(merged).met, { "name:raphael": 3, "name:sarah": 4 },
    "the further of the two, key by key, so neither device loses a level");
  assert.deepEqual(formsOf(merged)[0].met, { "name:victor": 2 },
    "and the other forms carry their own record, as they carry their own progress");

  /* The one thing sync asks of anything it merges. */
  const twice = mergeData(mergeData(mine, theirs), theirs).items[0];
  assert.deepEqual(leadOf(twice).met, leadOf(merged).met, "merging is idempotent");

  /* And a card that has no such record does not start carrying an empty
     one: an ordinary word leaves no hole and has nothing to remember. */
  const plain = mergeData(
    /** @type {Doc} */ ({ version: 3, items: [item("k2")], tombstones: {}, log: {}, settings: {} }),
    /** @type {WireDoc} */ ({ version: 3, items: [item("k2")], tombstones: {}, log: {} })
  ).items[0];
  assert.equal("met" in leadOf(plain), false);
});

/* ------------------------------------------------------------------
   The three things a merge used to undo

   A card sent back to the beginning, a card the learner asked for next,
   and the work of a card that went away. Each is the learner's own rather
   than the teacher's, and each was quietly lost to the other device's
   copy.
   ------------------------------------------------------------------ */

test("a card sent back to the beginning stays there, whichever device is asked", () => {
  /* Pressing reset writes blank schedules — which is exactly what a card
     that was never answered has, so they are left off the wire, and the
     other device's old answers were handed straight back. The stamp is
     what the merge reads instead: anything answered before it is no
     longer evidence. */
  const RESET = 1000;
  const cleared = worded({ updated: RESET, reset: RESET }, { s: {} });
  const stale = worded({ updated: 500 }, { en: "book" });
  statesOf(stale).ar2en = { ...fresh(), reps: 6, updated: 500 };
  leadOf(stale).met = { "name:sarah": 2 };

  for (const [a, b, which] of [[cleared, stale, "reset first"], [stale, cleared, "reset second"]]) {
    const out = mergeData(doc([a]), doc([b])).items[0];
    assert.equal(statesOf(out).ar2en, undefined, `the old schedule is gone (${which})`);
    assert.equal(out.reset, RESET, `and the card still says when (${which})`);
    assert.equal("met" in leadOf(out), false, `as is what it had been filled with (${which})`);
  }

  /* What was answered after the reset is work, not history, and stays. */
  const after = worded({ updated: 1200 }, {});
  statesOf(after).ar2en = { ...fresh(), reps: 1, updated: 1200 };
  const kept = mergeData(doc([cleared]), doc([after])).items[0];
  assert.equal(statesOf(kept).ar2en.reps, 1, "the answer given since the reset is kept");
});

test("the mark a learner put on a card survives the other device answering it", () => {
  /* Every graded answer stamps the whole card, so the device that merely
     answered this one was almost always the later writer — and taking the
     card whole from it dropped the mark the phone had just set. The mark
     carries its own stamp now and is read by that. */
  const marked = shared({ updated: 200, priority: true, priorityAt: 200 });
  const answered = worded({ updated: 300 }, {});
  statesOf(answered).ar2en = { ...fresh(), reps: 1, updated: 300 };
  const out = mergeData(doc([marked]), doc([answered])).items[0];
  assert.equal(out.priority, true, "the mark stands");
  assert.equal(out.priorityAt, 200);
  assert.equal(statesOf(out).ar2en.reps, 1, "and the answer is kept beside it");

  /* And taking the mark off is a thing the learner said too, so the later
     of the two words wins in both directions. */
  const unmarked = shared({ updated: 250, priority: false, priorityAt: 400 });
  const off = mergeData(doc([marked]), doc([unmarked])).items[0];
  assert.equal(off.priority, false, "the later word wins when it is to clear the mark");
  assert.equal(off.priorityAt, 400);

  /* A card nobody ever marked does not come back marked. */
  const plain = mergeData(doc([shared({ updated: 200 })]), doc([shared({ updated: 300 })])).items[0];
  assert.equal(plain.priority, undefined);
});

test("work set aside when a card went away is kept by whichever device saw it go last", () => {
  /* The drawer ages out on the same schedule as the headstones, so these
     stamps are real ones: a card parked in 1970 is a card already let go. */
  const today = Date.now();
  /** @param {number} reps @param {number} at */
  const saved = (reps, at) => ({ at, forms: { c1: { s: { ar2en: { ...fresh(), reps, updated: at } } } } });
  const mine = doc([], {
    parked: { c1: saved(4, today - 1000), gone: { at: 1, forms: { gone: { s: {} } } } },
  });
  /** @type {WireDoc} */
  const theirs = {
    items: [], tombstones: {}, log: {},
    parked: { c1: saved(1, today - 3000), c2: saved(2, today - 2000) },
  };
  const out = mergeData(mine, theirs);
  const drawer = /** @type {Record<string, any>} */ (out.parked);
  assert.equal(drawer.c1.at, today - 1000, "the later parking wins");
  assert.equal(drawer.c1.forms.c1.s.ar2en.reps, 4);
  assert.ok(drawer.c2, "a card only the other device saw go is kept too");
  assert.equal(drawer.gone, undefined,
    "and one set aside longer ago than a headstone lasts is let go");
  assert.deepEqual(mergeData(out, theirs).parked, out.parked, "merging is idempotent");
});

test("two devices that parked one card at the same moment keep this device's copy", () => {
  /*
   * The tie in the rule above. Neither parking is later, so something has
   * to decide, and what decides is that the device doing the merging keeps
   * what it had — which is what makes a merge re-run on the same device
   * come back the same. (Two devices in this position each keep their own
   * until one of them parks again; the stamps are milliseconds, so it
   * takes both seeing the same card go in the same millisecond.)
   */
  const at = Date.now() - 1000;
  /** @param {number} reps */
  const saved = (reps) => ({ at, forms: { c1: { s: { ar2en: { ...fresh(), reps, updated: at } } } } });
  const mine = doc([], { parked: { c1: saved(4) } });
  /** @type {WireDoc} */
  const theirs = { items: [], tombstones: {}, log: {}, parked: { c1: saved(1) } };
  const out = mergeData(mine, theirs);
  const drawer = /** @type {Record<string, any>} */ (out.parked);
  assert.equal(drawer.c1.forms.c1.s.ar2en.reps, 4, "this device's copy stands");
  assert.deepEqual(mergeData(out, theirs).parked, out.parked, "and stands again on a re-merge");
});

/* ------------------------------------------------------------------
   What the ladder did, merged

   The one record in the document of *change* rather than of where things
   stand, which means it is also the one that cannot be checked against
   the cards afterwards. So the merge has to be the kind that survives
   being run twice — the same rule the activity log beside it uses.
   ------------------------------------------------------------------ */

const moved = (/** @type {Record<string, any>} */ moves) => doc([], { moves });

test("a day's movement takes the larger of two devices, never the sum", () => {
  /* The same evening synced twice must not read as twice the evening.
     Adding them is the obvious rule and the wrong one: a phone that syncs
     three times would triple a day nobody worked harder on. */
  const phone = moved({ "2026-09-20": { up: 3, cleared: 1, learnt: 0 } });
  const laptop = moved({ "2026-09-20": { up: 2, cleared: 1, learnt: 2 } });
  const both = mergeData(phone, laptop).moves || {};
  assert.deepEqual(both["2026-09-20"], { up: 3, cleared: 1, learnt: 2 },
    "each count taken on its own merits");
  /* Idempotent, and the same answer whichever way round. */
  assert.deepEqual((mergeData(mergeData(phone, laptop), laptop).moves || {})["2026-09-20"],
    { up: 3, cleared: 1, learnt: 2 }, "merging twice changes nothing");
  assert.deepEqual((mergeData(laptop, phone).moves || {})["2026-09-20"],
    { up: 3, cleared: 1, learnt: 2 }, "and neither side is privileged");
});

test("a day only one device recorded survives the merge either way round", () => {
  const tuesday = moved({ "2026-09-15": { up: 4, cleared: 0, learnt: 1 } });
  const empty = doc([]);
  assert.deepEqual((mergeData(empty, tuesday).moves || {})["2026-09-15"],
    { up: 4, cleared: 0, learnt: 1 });
  assert.deepEqual((mergeData(tuesday, empty).moves || {})["2026-09-15"],
    { up: 4, cleared: 0, learnt: 1 });
});

test("a document written before any of this was recorded merges to nothing rather than crashing", () => {
  /* Every field of an arriving document is optional, because one written
     a year ago carries only what existed then. */
  const old = /** @type {any} */ ({ version: 3, items: [], tombstones: {}, log: {} });
  assert.deepEqual(mergeData(doc([]), old).moves, {});
});
