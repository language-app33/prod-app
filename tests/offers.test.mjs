/*
 * What a card can be asked, and what the rest are waiting for.
 *
 * The screen this feeds greys out the exercises a card cannot do and says
 * why, so the interesting assertions are about the greyed-out ones: that
 * the reason is the true one, and that things which are not about missing
 * data are left out altogether rather than shown as impossible.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { offersFor, canAsk, unmetNeeds } from "../src/offers.js";
import { EX, LANGUAGES } from "../src/languages.js";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];

/** @returns {any} */
const word = (/** @type {Record<string, any>} */ over = {}) => ({
  id: "w1", ar: "كِتاب", en: "book", lat: "kitaab", recs: [], s: {}, ...over,
});

/** @param {any} card @param {any} [opts] */
const offers = (card, opts = {}) =>
  offersFor({
    units: [{ unit: card, isSub: false, scene: null }],
    lang: opts.lang || ar,
    contextsFor: () => opts.contexts || [],
    enabled: opts.enabled,
  });

/** @param {any[]} list @param {string} type */
const find = (list, type) => list.find((o) => o.type === type);

test("a full card can be asked what it has the fields for", () => {
  const list = offers(word({ recs: [{ id: "r1" }] }));
  assert.equal(find(list, "ar2en").ready, true, "script and meaning");
  assert.equal(find(list, "en2ar").ready, true);
  assert.equal(find(list, "rec2en").ready, true, "and a recording makes it listenable");
  assert.deepEqual(find(list, "ar2en").missing, []);
});

test("and the ones it cannot do say what they are waiting for", () => {
  const list = offers(word());
  const listening = find(list, "rec2en");
  assert.equal(listening.ready, false);
  assert.deepEqual(listening.missing, ["a recording"], "not a field name");
  /* The reasons are the language's own words for its own things. */
  assert.deepEqual(find(list, "ctx2ar").missing, ["a phrase that uses it"]);
  assert.deepEqual(find(offers(word({ en: "" })), "ar2en").missing, ["the meaning"]);
});

test("a phrase that uses the word is what the gap-fill was waiting for", () => {
  const withPhrase = offers(word(), { contexts: [{ id: "p1", ar: "الكتاب كبير", recs: [] }] });
  assert.equal(find(withPhrase, "ctx2ar").ready, true);
  assert.equal(find(withPhrase, "ctx2pick").ready, true, "and choosing it out of a few");
  /* Hearing the phrase needs the phrase to have been recorded, which is a
     different thing from the word having been. */
  assert.equal(find(withPhrase, "rec2ctx").ready, false);
  assert.deepEqual(find(withPhrase, "rec2ctx").missing, ["a recorded phrase that uses it"]);
  const recorded = offers(word(), { contexts: [{ id: "p1", ar: "الكتاب كبير", recs: [{ id: "r" }] }] });
  assert.equal(find(recorded, "rec2ctx").ready, true);
});

test("what is not about this shape of card is left out, not greyed out", () => {
  /* A word is not waiting for a conversation. Showing "Play a part" as
     impossible on every word card in the app would be answering a
     question nobody asked, forty times. */
  const list = offers(word());
  assert.equal(find(list, "dlgwhole"), undefined);
  assert.equal(find(list, "dlgorder"), undefined);
  assert.equal(find(list, "dlgpick"), undefined);
});

test("nor is what the language never drills", () => {
  /* Vietnamese is written in the Latin alphabet, so going to and from a
     romanisation would be asking for the word already on the screen. */
  const list = offers(word({ ar: "cà phê", lat: "" }), { lang: vi });
  assert.equal(find(list, "tr2ar"), undefined, "Vietnamese does not drill its romanisation");
  assert.ok(find(list, "ar2en"), "but it is asked what a word means like everyone else");
  /* Arabic does drill it, so there it is offered — and greyed out when the
     card has no romanisation on it. */
  const bare = offers(word({ lat: "" }));
  assert.equal(find(bare, "tr2ar").ready, false);
  assert.deepEqual(find(bare, "tr2ar").missing, ["the transliteration"]);
});

test("a conversation is offered what a conversation can be asked", () => {
  /** @type {any} */
  const scene = {
    id: "d1", kind: "dialog", ar: "", en: "At the door", lat: "", recs: [], s: {},
    speakers: ["Layla", "Karim"], you: 1,
    lines: [
      { id: "l1", who: 0, ar: "سلام", en: "peace", lat: "", recs: [], s: {} },
      { id: "l2", who: 1, ar: "وسلام", en: "and peace", lat: "", recs: [], s: {} },
      { id: "l3", who: 0, ar: "كيف حالك", en: "how are you", lat: "", recs: [], s: {} },
    ],
  };
  const list = offersFor({
    units: [
      { unit: scene, isSub: false, scene: null },
      ...scene.lines.map((/** @type {any} */ l, /** @type {number} */ at) => ({
        unit: l,
        isSub: true,
        scene: { card: scene, at },
      })),
    ],
    lang: ar,
  });
  assert.equal(find(list, "dlgorder").ready, true, "three lines is a puzzle");
  assert.equal(find(list, "dlgwhole").ready, true, "and a scene is always a scene to read");
  /* Asked of the line that can answer it: the first line has nothing said
     before it, so the reply comes from one that has. */
  assert.equal(find(list, "dlgpick").subId, "l2");
  /* The three that went are not offered at all — not greyed out, which
     would be answering a question nobody asked about an exercise that no
     longer exists. */
  for (const gone of ["dlg2en", "dlgreply", "dlgplay"]) {
    assert.equal(find(list, gone), undefined, `${gone} is still on the list`);
  }
  /* And a word exercise is never offered of a scene. */
  assert.equal(find(list, "ar2en"), undefined);
  assert.equal(find(list, "en2ar"), undefined);
});

test("a two-line scene says what the whole-scene puzzles are waiting for", () => {
  /** @type {any} */
  const scene = {
    id: "d2", kind: "dialog", ar: "", en: "Short", lat: "", recs: [], s: {},
    speakers: ["A", "B"], you: 1,
    lines: [
      { id: "l1", who: 0, ar: "سلام", en: "peace", lat: "", recs: [], s: {} },
      { id: "l2", who: 1, ar: "وسلام", en: "and peace", lat: "", recs: [], s: {} },
    ],
  };
  const list = offersFor({
    units: [
      { unit: scene, isSub: false, scene: null },
      ...scene.lines.map((/** @type {any} */ l, /** @type {number} */ at) => ({
        unit: l,
        isSub: true,
        scene: { card: scene, at },
      })),
    ],
    lang: ar,
  });
  assert.equal(find(list, "dlgorder").ready, false);
  assert.deepEqual(find(list, "dlgorder").missing, ["three lines or more"]);
  assert.equal(find(list, "dlgwhole").ready, true, "two lines is still a scene to read");
});

test("an exercise switched off is still worth trying, and says so", () => {
  const list = offers(word(), { enabled: (/** @type {string} */ t) => t !== "en2ar" });
  assert.equal(find(list, "en2ar").ready, true, "the card can do it");
  assert.equal(find(list, "en2ar").off, true, "a student would not be asked it");
  assert.equal(find(list, "ar2en").off, false);
});

test("the list reads in the order a learner would meet them", () => {
  /* The exercise table runs from recognition to production, and reading
     this list top to bottom should read the same way. */
  const types = offers(word({ recs: [{ id: "r" }] })).map((o) => o.type);
  assert.ok(types.indexOf("ar2en") < types.indexOf("en2ar"), "reading before writing");
  assert.ok(types.indexOf("ctx2pick") < types.indexOf("ctx2ar"), "choosing before typing");
  assert.ok(types.every((t) => !EX[t].retired), "and nothing retired is offered at all");
});

test("the same question answers both screens", () => {
  /* canAsk is what the session builder reads to decide whether a card
     supports an exercise; the list above is the same answer with the
     reason attached. Two implementations would be two apps disagreeing
     about what a card can do. */
  const card = word();
  const on = { unit: card, scene: null, contexts: [] };
  assert.equal(canAsk(on, "ar2en", ar), true);
  assert.equal(canAsk(on, "rec2en", ar), false);
  assert.deepEqual(unmetNeeds(card, EX.rec2en, null, []), ["recs"]);
  assert.equal(find(offers(card), "rec2en").ready, canAsk(on, "rec2en", ar));
});
