/*
 * The order a session comes in, and what a wrong answer does to it.
 *
 * Both of these decide what a learner actually sees, and neither had a test
 * — which is how "the same card twice running" and "the identical question
 * stuck on the end" survived as long as they did. They are plain functions
 * of a list, so they can be checked here rather than by playing a session.
 *
 * The third is the mark a learner puts on a card, which the session builder
 * and the count on the home screen both read through one function.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".session-build");

/* Bundled the way the smoke harness and the card tests do it: the trainer
   is JSX and imports React, and nothing in it touches a browser on the way
   in. React is left external, and node resolves that from node_modules
   relative to the file doing the importing. */
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { varyTypes, requeueMissed, isUrgent, buildSession, buildManualSession, installIndexes,
  fillersIn, buildNumberSession, numberFillers, isMadeUpNumber, NUMBER_SESSION_SIZE,
  NUMBERS_PER_BAND, buildWeakSession, weakness, isWeak } = await import(path.join(out, "trainer.js"));
const { TYPES, NUMBER_EQUIVALENT } = await import(path.join(here, "..", "src", "languages.ts"));
const { FRONT_DOOR_CAP } = await import(path.join(here, "..", "src", "scheduler.ts"));

/** @param {string} id @param {string} type */
const q = (id, type) => ({ id, type, subId: null });
/** @param {any[]} list */
const ids = (list) => list.map((/** @type {any} */ x) => x.id).join(" ");
/** Any two questions side by side about the same card. */
const backToBack = (/** @type {any[]} */ list) =>
  list.some((/** @type {any} */ x, /** @type {number} */ i) => i > 0 && x.id === list[i - 1].id);

/* ------------------------------------------------------------------
   Spacing a session out
   ------------------------------------------------------------------ */

test("a session of two forms each does not ask one card twice running", () => {
  /* Three cards, two exercises apiece, arriving grouped by card — which is
     how the interleave hands them over. */
  const list = [
    q("a", "ar2en"), q("a", "en2ar"),
    q("b", "ar2en"), q("b", "en2ar"),
    q("c", "ar2en"), q("c", "en2ar"),
  ];
  const got = varyTypes(list);
  assert.equal(got.length, list.length, "nothing is lost or invented");
  assert.equal(backToBack(got), false, `same card twice running: ${ids(got)}`);
});

test("the card comes before the exercise type when it cannot have both", () => {
  /*
   * The old order of the fallbacks, and the whole of this fix.
   *
   * Two cards, and only one exercise type between them beyond the opener.
   * A pass that asks for a different type first has nowhere to go and
   * takes another angle on the card just asked; asking for a different
   * card first gets two words in a row, said the same way, which is the
   * far smaller sin.
   */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("b", "ar2en")];
  const got = varyTypes(list);
  assert.equal(got.length, 3);
  assert.deepEqual(ids(got), "a b a", "the other word goes between, said the same way");
});

test("a card with nothing to alternate with is still dealt", () => {
  /* One card, three exercises: there is no other card, so it is asked three
     times and the pass must not drop or loop on any of them. */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("a", "tr2ar")];
  const got = varyTypes(list);
  assert.equal(got.length, 3);
  assert.deepEqual(
    [...new Set(got.map((/** @type {any} */ x) => x.type))].sort(),
    ["ar2en", "en2ar", "tr2ar"],
    "each of them once"
  );
});

test("an empty queue comes back empty", () => {
  assert.deepEqual(varyTypes([]), []);
});

/* ------------------------------------------------------------------
   A question answered wrong
   ------------------------------------------------------------------ */

test("a missed question goes to the back of what is left", () => {
  /* The gap is the size of the rest of the session, which is what makes it
     a retest rather than a copy: a long session re-asks it in fifteen
     questions' time, a short one in three. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("c", "ar2en"), q("d", "ar2en"), q("e", "ar2en")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a b c d e a");
  assert.equal(got.length, 6, "one question more than there was");
});

test("it is the same question, not a different one about the card", () => {
  /* Deliberate: the point of asking again is to test the thing that
     failed. What was wrong was where it went, not what it was. */
  const list = [q("a", "en2ar"), q("b", "ar2en"), q("c", "ar2en"), q("d", "ar2en")];
  const got = requeueMissed(list, 1, list[0]);
  const again = got.slice(1).find((/** @type {any} */ x) => x.id === "a");
  assert.equal(again.type, "en2ar");
});

test("two misses on one card do not land side by side", () => {
  /* The fault. Both retries went onto the end blind, so a card whose two
     questions were both missed finished the session twice in a row. */
  let list = [q("a", "ar2en"), q("b", "ar2en"), q("a", "en2ar"), q("c", "ar2en"), q("d", "ar2en")];
  list = requeueMissed(list, 1, list[0]);
  const second = list.findIndex((/** @type {any} */ x) => x.id === "a" && x.type === "en2ar");
  list = requeueMissed(list, second + 1, list[second]);
  assert.equal(backToBack(list), false, `same card twice running: ${ids(list)}`);
});

test("a retry comes forward off the card's own question at the end of the queue", () => {
  /* The same rule the queue was built with, and it has to hold on both
     sides: stopping in front of the card's other question is as bad as
     stopping behind it. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("c", "ar2en"), q("a", "en2ar")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a b a c a");
  assert.equal(backToBack(got), false);
});

test("and where nothing at the back is clear, it goes to the back anyway", () => {
  /* Everything left is the card's own, so there is no clean slot to find
     and the end is where it used to go. */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("a", "tr2ar")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a a a a");
});

test("missing the last question of a session still asks it again", () => {
  /* Standing next to itself is only a fault while there is something to
     stand between. Dropping it instead would end a session of one question
     the moment it was got wrong, having taught nothing. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("z", "ar2en")];
  const got = requeueMissed(list, 3, list[2]);
  assert.deepEqual(ids(got), "a b z z");
});

test("what is already answered is never moved", () => {
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("b", "ar2en")];
  /* Both of "a"'s questions are behind us; the second was the miss. */
  const got = requeueMissed(list, 2, list[1]);
  assert.deepEqual(
    ids(got.slice(0, 2)),
    "a a",
    "the answered pair stays exactly where it was"
  );
  assert.equal(got.length, 4);
});

/* ------------------------------------------------------------------
   A card the learner asked for
   ------------------------------------------------------------------ */

/* Enough of a card to be dealt: two exercises are the minimum anything is
   asked on, and the script plus a meaning is what supports them. */
const settings = { language: "ar-PS" };
/** @param {any} over */
const card = (over) => ({
  id: "c1", lang: "ar-PS", kind: "word", tags: [], created: 0,
  forms: [{ id: "c1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s: {} }],
  ...over,
});

test("an unmarked card is not urgent", () => {
  assert.equal(isUrgent(card({}), settings), false);
});

test("a marked card is urgent, whatever its schedule says", () => {
  /* Far future on everything it could be asked: without the mark this card
     is not waiting for anything. */
  const far = Date.now() + 400 * 86400000;
  /** @type {Record<string, any>} */
  const s = {};
  for (const t of ["ar2en", "en2ar", "ar2pick", "en2pick", "match", "tr2ar"]) {
    s[t] = { phase: "review", step: 0, ease: 2.5, interval: 300, due: far,
      reps: 9, lapses: 0, right: 9, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0 };
  }
  const it = card({ priority: true, forms: [{ id: "c1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s }] });
  assert.equal(isUrgent(it, settings), true);
});

test("a marked card with nothing to ask is not urgent", () => {
  /* The guard that keeps the home screen honest: a card with one word and
     nothing to pair it with supports no exercise, so marking it must not
     count it as waiting for a session that would then not include it. */
  const bare = card({ priority: true, forms: [{ id: "c1", ar: "كِتاب", en: "", lat: "", lang: "ar-PS", s: {} }] });
  assert.equal(isUrgent(bare, settings), false);
});

/* ------------------------------------------------------------------
   Dealing a session

   What a learner is actually handed. It was a plain function of its
   arguments and always had been, but half of what it reads is a set of
   module-level maps that only a render knew how to fill — where each word
   turns up, what fills each blank, which cells are behind a gate — so the
   whole of it was unreachable from here. `installIndexes` fills them from a
   list of cards, which is the seam that was missing rather than a shortcut
   past anything.

   The shape of a session is fixed and the numbers are in one place, so
   what is asserted here is the rules rather than the numbers: no card is
   half the session, nothing new arrives while a pile is waiting, and a
   form that cannot be asked is not dealt.
   ------------------------------------------------------------------ */

/** Every card is in, which is what a session with no deck chosen means. */
const anyDeck = () => true;

/**
 * A plain word, ready to be dealt: two exercises' worth of material and
 * nothing answered.
 * @param {string} id @param {string} ar @param {string} en
 * @param {Record<string, any>} [over]
 * @returns {any} A card, loosely: these fixtures are written to be read,
 * and pinning every field would say less about the rule under test.
 */
const word = (id, ar, en, over = {}) => ({
  id, tags: [], created: Number(id.replace(/\D/g, "")) || 1, lang: "ar-PS", kind: "word",
  forms: [{ id, ar, en, lat: en, lang: "ar-PS", s: {} }],
  ...over,
});

/** A deck of them, named so the assertions can read. */
const deckOf = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => word(`w${i + 1}`, `كلمة${i + 1}`, `word ${i + 1}`));

/** Deal one, with the indexes filled the way a render fills them. */
const deal = (/** @type {any[]} */ items, /** @type {Record<string, any>} */ over = {}) => {
  installIndexes(items, settings);
  return buildSession({ items, settings, inDeck: anyDeck, ...over });
};

test("a session is dealt from the cards in hand", () => {
  const got = deal(deckOf(12));
  assert.equal(got.reason, null, "there was something to ask");
  assert.ok(got.exercises.length > 1, `${got.exercises.length} questions`);
  /* Every question names a card that is actually in the deck, and an
     exercise that exists. */
  for (const ex of got.exercises) {
    assert.ok(ex.id, "a question names its card");
    assert.ok(ex.type, "and its exercise");
  }
});

/** A card in review and due, so it is one the session may reach. */
const due = () => ({
  phase: "review", step: 0, ease: 2.5, interval: 4, due: Date.now() - 86400000,
  reps: 4, lapses: 0, right: 4, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1], updated: 1,
});
/** A deck of them: met, due, and waiting. */
const dueDeck = (/** @type {number} */ n) =>
  deckOf(n).map((it) => ({
    ...it,
    forms: [{ ...it.forms[0], s: { ar2en: due(), en2ar: due(), tr2ar: due() } }],
  }));

test("a course does not arrive all at once, however many words are waiting", () => {
  /*
   * New words are introduced only while there is room at the front door.
   * A course of sixty strangers is not sixty words tonight — it is what
   * the door admits, met properly, with the rest waiting. Getting this
   * wrong in the other direction is a first week of sixty words met once
   * each and nothing learnt.
   *
   * The bound is the door and not the session: the old rule was three a
   * session, which meant ten short sittings in an evening were thirty new
   * words for the same work. See FRONT_DOOR_CAP.
   */
  const got = deal(deckOf(60));
  const cards = new Set(got.exercises.map((/** @type {any} */ e) => e.id));
  assert.ok(cards.size <= FRONT_DOOR_CAP, `${cards.size} new words opened at once`);
  assert.ok(cards.size >= 1, "and at least one");
});

test("a session of due cards is spread over several rather than spent on one", () => {
  /* The complaint the fixed session shape came from: an eighteen-question
     session that was six cards asked three ways each. Nine words, asked
     two ways, is the shape now — what is asserted is that no one card is
     half of it. */
  const got = deal(dueDeck(14));
  const perCard = new Map();
  for (const ex of got.exercises) perCard.set(ex.id, (perCard.get(ex.id) || 0) + 1);
  assert.ok(perCard.size >= 5, `${perCard.size} cards in the session`);
  for (const [id, n] of perCard) {
    assert.ok(n <= got.exercises.length / 3, `${id} has ${n} of ${got.exercises.length}`);
  }
});

test("nothing new is dealt while a pile of new cards is already in hand", () => {
  /*
   * New cards are introduced only while there is room: beyond the few a
   * session may open, nothing new is dealt while ten are already being
   * learnt. Without it a first week is forty words met once each.
   */
  const learning = deckOf(14).map((/** @type {any} */ it) => ({
    ...it,
    forms: [{ ...it.forms[0], s: { ar2en: { phase: "learning", step: 0, ease: 2.5, interval: 0,
      due: 0, reps: 1, lapses: 0, right: 0, wrong: 1, skips: 0, near: 0, hints: 0, hist: [0], updated: 1 } } }],
  }));
  const fresh = Array.from({ length: 6 }, (_, i) => word(`n${i + 1}`, `جديد${i + 1}`, `new ${i + 1}`));
  const got = deal(learning.concat(fresh));
  const dealtNew = new Set(got.exercises.map((/** @type {any} */ e) => e.id))
    .size === 0 ? [] : [...new Set(got.exercises.map((/** @type {any} */ e) => e.id))]
      .filter((id) => String(id).startsWith("n"));
  assert.equal(dealtNew.length, 0, `new cards dealt anyway: ${dealtNew.join(",")}`);
});

test("a deck with nothing to ask says so rather than coming back empty", () => {
  /* Each reason is a sentence the button can say, which is the difference
     between an empty session and one that looks broken. */
  assert.equal(deal([]).reason, "none-drillable");
  /* A card with no meaning supports nothing, so there is nothing to ask of
     it either. */
  assert.equal(deal([word("w1", "كلمة", "")]).reason, "none-drillable");
});

/*
 * A verb whose own word is empty is its table, and the table is dealt.
 *
 * Since 0.200 the box a dictionary lists a verb under may be left blank,
 * and the card's own word is read off that box — so such a card reaches
 * the learner with nothing in its own word and its forms full. Asking the
 * card's own word alone would have hidden the whole verb from every
 * session while its table sat there waiting to be practised.
 */
test("a verb with nothing in its own word is dealt through its table", () => {
  const verb = word("v1", "", "", {
    category: "verb",
    name: "to eat",
    forms: [
      { id: "v1", ar: "", en: "", lat: "", lang: "ar-PS", s: {} },
      { id: "v-present-he", ar: "بياكل", en: "he eats", lat: "byaakul",
        row: "present", col: "he", lang: "ar-PS", s: {} },
      { id: "v-present-she", ar: "بتاكل", en: "she eats", lat: "btaakul",
        row: "present", col: "she", lang: "ar-PS", s: {} },
    ],
  });
  const got = deal([verb]);
  assert.equal(got.reason, null, "there was something to ask");
  const asked = got.exercises.map((/** @type {any} */ e) => e.subId || e.id);
  assert.ok(asked.includes("v-present-he"),
    `the table was not dealt: ${asked.join(", ") || "(nothing)"}`);
  /* And the empty word itself is asked nothing, having nothing to ask. */
  assert.equal(asked.includes("v1"), false,
    "the card's own word has no material, so it is not a question");
});

test("a card the learner asked for is dealt however far off it was", () => {
  /* The mark is the whole feature: a card three weeks out comes back now.
     It opens the session, so it is in the first handful whatever else is
     waiting. */
  const far = { phase: "review", step: 0, ease: 2.5, interval: 60, due: Date.now() + 60 * 86400000,
    reps: 9, lapses: 0, right: 9, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1], updated: 1 };
  const deck = deckOf(6).map((it) => ({ ...it, forms: [{ ...it.forms[0], s: { ar2en: far, en2ar: far } }] }));
  const asked = { ...deck[5], priority: true };
  const got = deal(deck.slice(0, 5).concat([asked]));
  assert.ok(got.exercises.some((/** @type {any} */ e) => e.id === asked.id),
    "the card that was asked for is in the session");
});

test("a form the teacher keeps without asking about is never dealt", () => {
  /*
   * The gate a dealt session and a hand-built one now share. A table
   * written out for a student to read is not twenty-one more questions a
   * day, and the plural below is the one thing left to ask.
   */
  const kept = word("w1", "كِتاب", "book", {
    forms: [
      { id: "w1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s: {} },
      { id: "quiet", ar: "كُتُب", en: "books", lat: "kutub", lang: "ar-PS", ask: false, s: {} },
    ],
  });
  const got = deal([kept].concat(deckOf(6)));
  assert.ok(!got.exercises.some((/** @type {any} */ e) => e.subId === "quiet"),
    "the form switched off is not asked");
});

test("a session built by hand climbs the same ladder a dealt one does", () => {
  /*
   * It used to walk every form of the chosen cards itself and apply
   * neither gate, so a form kept without being asked about was drilled
   * there — the one place in the app where the teacher's answer was
   * ignored.
   */
  const kept = word("w1", "كِتاب", "book", {
    forms: [
      { id: "w1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s: {} },
      { id: "quiet", ar: "كُتُب", en: "books", lat: "kutub", lang: "ar-PS", ask: false, s: {} },
    ],
  });
  const items = [kept].concat(deckOf(4));
  installIndexes(items, settings);
  const got = buildManualSession({
    items, settings, ids: items.map((i) => i.id), mode: "regular", count: 20,
  });
  assert.equal(got.reason, null, got.reason || "");
  assert.ok(!got.exercises.some((/** @type {any} */ e) => e.subId === "quiet"),
    "the form switched off is not asked by hand either");
});

test("a value is not a question, however it was chosen", () => {
  /* "Raphael" is in the deck to fill somebody else's sentence, and "what
     does Raphael mean" is not a question. A dealt session has always
     honoured that; a hand-built one picking the deck a frame lives in used
     to drill the names in it. */
  const value = word("rafa", "رافائيل", "Raphael", { fills: "name", drill: false });
  const items = [value].concat(deckOf(5));
  installIndexes(items, settings);
  const dealt = buildSession({ items, settings, inDeck: anyDeck });
  const byHand = buildManualSession({
    items, settings, ids: items.map((i) => i.id), mode: "regular", count: 20,
  });
  for (const [what, got] of [["dealt", dealt], ["by hand", byHand]]) {
    assert.ok(!got.exercises.some((/** @type {any} */ e) => e.id === "rafa"),
      `the value was asked in the ${what} session`);
  }
});

test("a sentence is not dealt until there is a word to put in it", () => {
  /*
   * A frame whose blanks have nothing to fill them is not a hard question,
   * it is an unanswerable one — and the card it teaches nothing about is
   * the frame. It comes back by itself the moment a value catches up.
   */
  const frame = word("f1", "اسمي {{name}}", "my name is {{name}}");
  /* Beside cards that are due rather than new, so the frame is the one new
     card in the deck and the room kept for new ones is not the thing being
     measured. */
  const rest = dueDeck(3);
  const starved = [frame].concat(rest);
  installIndexes(starved, settings);
  const without = buildSession({ items: starved, settings, inDeck: anyDeck });
  assert.ok(!without.exercises.some((/** @type {any} */ e) => e.id === "f1"),
    "nothing fills it, so it is not asked");

  /* With a name in the deck it is dealt. The value itself is not: it is
     there to be borrowed. */
  const value = word("rafa", "رافائيل", "Raphael", { fills: "name", drill: false });
  const fed = [frame, value].concat(rest);
  installIndexes(fed, settings);
  const with_ = buildSession({ items: fed, settings, inDeck: anyDeck });
  assert.ok(with_.exercises.some((/** @type {any} */ e) => e.id === "f1"),
    "with a name to put in it, it is");
});

test("nor when the only word for it has no form that agrees with the rest", () => {
  /*
   * An adjective lends its own word and the sentence goes back to its card
   * for the form that agrees with the noun beside it. A teacher who left
   * that box empty leaves this turn with nothing to put in the hole.
   *
   * Counting what was in the pools called that fillable, so the frame was
   * dealt — and then drawn with its own braces on the screen, marked
   * against them, and, because the turn only moves on a right answer,
   * asked again in every session after it. One walk now decides both.
   */
  const frame = word("f2", "الـ{{noun}} {{adjective}}", "the {{adjective}} {{noun}}");
  const noun = word("n1", "سيارة", "car", {
    fills: "noun", category: "noun", drill: false,
    forms: [{ id: "n1", ar: "سيارة", en: "car", lat: "sayyaara", lang: "ar-PS", s: {},
      number: "singular", gender: "feminine", human: "thing" }],
  });
  /* The feminine box left empty, which is the whole of the case. */
  const blank = word("a1", "كبير", "big", {
    fills: "adjective", category: "adjective", drill: false,
    forms: [
      { id: "a1", ar: "كبير", en: "big", lat: "kabiir", lang: "ar-PS", s: {} },
      { id: "a1-f", ar: "", en: "big", lat: "", lang: "ar-PS", s: {}, row: "agreement", col: "feminine" },
    ],
  });
  const rest = dueDeck(3);
  installIndexes([frame, noun, blank].concat(rest), settings);
  const short = buildSession({ items: [frame, noun, blank].concat(rest), settings, inDeck: anyDeck });
  assert.ok(!short.exercises.some((/** @type {any} */ e) => e.id === "f2"),
    "there is no sentence to make, so none is asked");

  /* Filled in, it is a question like any other. */
  const whole = word("a1", "كبير", "big", {
    fills: "adjective", category: "adjective", drill: false,
    forms: [
      { id: "a1", ar: "كبير", en: "big", lat: "kabiir", lang: "ar-PS", s: {} },
      { id: "a1-f", ar: "كبيرة", en: "big", lat: "kabiira", lang: "ar-PS", s: {}, row: "agreement", col: "feminine" },
    ],
  });
  installIndexes([frame, noun, whole].concat(rest), settings);
  const full = buildSession({ items: [frame, noun, whole].concat(rest), settings, inDeck: anyDeck });
  assert.ok(full.exercises.some((/** @type {any} */ e) => e.id === "f2"),
    "with the feminine written down, it is");
});

test("a verb's later rows are not dealt before the row above is known", () => {
  /*
   * One tense of a verb is ever new at a time. The gate is read off the
   * same set every reader goes through, so a session cannot deal a cell
   * the progress screen calls unreached.
   */
  const verb = /** @type {any} */ ({
    id: "v1", tags: [], created: 1, lang: "ar-PS", kind: "word", category: "verb",
    forms: [
      { id: "v1", ar: "أكل", en: "to eat", lat: "akal", lang: "ar-PS", s: {} },
      { id: "c-pres-he", ar: "بياكل", en: "he eats", lat: "byaakul", lang: "ar-PS",
        row: "present", col: "he", s: {} },
      { id: "c-past-she", ar: "أكلت", en: "she ate", lat: "akalat", lang: "ar-PS",
        row: "past", col: "she", s: {} },
    ],
  });
  const items = [verb].concat(deckOf(5));
  installIndexes(items, settings);
  const got = buildSession({ items, settings, inDeck: anyDeck });
  assert.ok(!got.exercises.some((/** @type {any} */ e) => e.subId === "c-past-she"),
    "the past is not dealt while the present is unlearnt");
});

test("the same deck deals a different session next time", () => {
  /* Everything the ordering calls equal is shuffled, so leaving a session
     half way through and starting another is not the same questions in the
     same order. */
  const items = dueDeck(14);
  installIndexes(items, settings);
  const runs = Array.from({ length: 6 }, () =>
    buildSession({ items, settings, inDeck: anyDeck }).exercises
      .map((/** @type {any} */ e) => `${e.id}:${e.type}`).join(" "));
  assert.ok(new Set(runs).size > 1, "six sessions from one deck were identical");
});

/*
 * Every exercise settled and none of them due, so the card is one a
 * session can only reach by going past the due line — which is the only
 * place the rule below applies. Set over every type there is, because a
 * single untouched exercise would make the card due on its own.
 */
const settledWord = (
  /** @type {string} */ id,
  /** @type {number} */ dueInDays,
  /** @type {number} */ seenMinutesAgo,
) => {
  const at = Date.now();
  const st = {
    phase: "review", step: 0, ease: 2.5, interval: 30, due: at + dueInDays * 86400000,
    reps: 6, lapses: 0, right: 6, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1],
    updated: at - seenMinutesAgo * 60000,
  };
  const w = word(id, `كلمة${id}`, `word ${id}`);
  return {
    ...w,
    forms: [{ ...w.forms[0], s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, st])) }],
  };
};

test("a sitting reaches past the words the last one just did", () => {
  /*
   * The thirtieth session of a day, in the small.
   *
   * Nothing is due, so the session reaches past the due line — and what it
   * reached for was the nearest thing to due and nothing else, which is
   * the same handful of words every time however often the learner came
   * back. Here the words just practised are also the nearest to due, so
   * the old rule would deal every one of them and none of the rest.
   */
  const justDone = ["j1", "j2", "j3", "j4", "j5", "j6"].map((id) => settledWord(id, 1, 10));
  const rested = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => settledWord(id, 20, 3 * 24 * 60));
  const got = deal(justDone.concat(rested));
  const dealt = new Set(got.exercises.map((/** @type {any} */ e) => e.id));
  for (const it of rested) {
    assert.ok(dealt.has(it.id), `${it.id} was passed over for a word just practised`);
  }
});

test("but anything actually due still comes first", () => {
  /* The care this rule needs: it decides the order a session reaches past
     the due line in, and must never hold back work that is genuinely
     waiting — a card due this morning is due whether or not it was also
     practised at breakfast. */
  const dueNow = dueDeck(9).map((it) => ({
    ...it,
    forms: [{ ...it.forms[0], s: { ...it.forms[0].s, ar2en: { ...it.forms[0].s.ar2en, updated: Date.now() } } }],
  }));
  const rested = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => settledWord(id, 20, 3 * 24 * 60));
  const got = deal(dueNow.concat(rested));
  const dealt = new Set(got.exercises.map((/** @type {any} */ e) => e.id));
  const reached = rested.filter((it) => dealt.has(it.id)).length;
  assert.equal(reached, 0, `${reached} cards ahead of schedule came before cards that were due`);
});

/* ------------------------------------------------------------------
   The weak-skills session

   One button, and what it opens: everything going wrong and nothing else,
   worst first. The rule it turns on is per *exercise* rather than per
   card, which is the whole difference between this and the Fix mistakes
   mode on the Build screen — so what is asserted here is that a card
   failing one way is drilled that way and not on the readings it has
   always got right.
   ------------------------------------------------------------------ */

/** An exercise with a given history behind it, and otherwise ordinary. */
const withHist = (/** @type {number[]} */ hist) => ({
  phase: "review", step: 0, ease: 2.0, interval: 1, due: Date.now() - 86400000,
  reps: hist.length, lapses: 0, right: hist.filter(Boolean).length,
  wrong: hist.filter((x) => !x).length, skips: 0, near: 0, hints: 0, hist, updated: 1,
});

/** A card going wrong on one exercise, and untouched on the rest. */
const slipping = (/** @type {string} */ id, /** @type {number[]} */ hist, type = "ar2en") =>
  word(id, `كلمة-${id}`, `word ${id}`, {
    forms: [{ id, ar: `كلمة-${id}`, en: `word ${id}`, lat: `kalima-${id}`, lang: "ar-PS",
      s: { [type]: withHist(hist) } }],
  });

/** Built the way a render builds it, like `deal` above. */
const weak = (/** @type {any[]} */ items, /** @type {Record<string, any>} */ over = {}) => {
  installIndexes(items, settings);
  return buildWeakSession({ items, settings, inDeck: anyDeck, ...over });
};

test("how badly one exercise is going, in three answers", () => {
  /* Wrong twice running is the gap — the app's own test for one, and what
     shuts the levels above a question. */
  assert.equal(weakness(withHist([0, 0])), 2);
  assert.equal(weakness(withHist([1, 0, 0])), 2);
  /* A single miss in the last two outings is the slip. */
  assert.equal(weakness(withHist([0])), 1);
  assert.equal(weakness(withHist([0, 1])), 1);
  assert.equal(weakness(withHist([1, 0])), 1);
  /* Going fine, and put right two outings ago, are both nothing to fix. */
  assert.equal(weakness(withHist([1, 1])), 0);
  assert.equal(weakness(withHist([0, 1, 1])), 0);
  /* A card from before the history existed carries an empty one, and reads
     as nothing to fix rather than as never having been right. */
  assert.equal(weakness(withHist([])), 0);
  assert.equal(weakness(null), 0);
});

test("a weak session asks the exercises that went wrong, and nothing else", () => {
  /* The card is failing one way. Everything else in the deck is fine, and
     the card's own other exercises are fine — so one question is the whole
     of what is going wrong, and padding it out with readings this learner
     has never missed is what the button would be lying about. */
  const items = [slipping("s1", [0, 0])].concat(deckOf(6));
  const got = weak(items);
  assert.equal(got.reason, null, got.reason || "");
  assert.deepEqual([...new Set(got.exercises.map((/** @type {any} */ e) => e.id))], ["s1"],
    "only the card that is slipping");
  assert.ok(got.exercises.every((/** @type {any} */ e) => e.type === "ar2en"),
    `and only the exercise that slipped: ${got.exercises.map((/** @type {any} */ e) => e.type).join(" ")}`);
});

test("the one thing you keep failing is a session on its own", () => {
  /* Every other session is refused for want of variety, because one
     exercise repeated is a poor way to meet new material. It is exactly
     the right way to fix the thing you keep getting wrong. */
  const got = weak([slipping("s1", [0, 0])].concat(deckOf(3)));
  assert.equal(got.reason, null, got.reason || "");
  assert.equal(got.exercises.length, 1);
});

test("wrong twice running is asked before a single slip", () => {
  const got = weak([slipping("once", [1, 0]), slipping("twice", [0, 0])].concat(deckOf(4)));
  assert.equal(got.exercises.length, 2, "both are in it");
  assert.equal(got.exercises[0].id, "twice", "and the gap leads the slip");
});

test("a deck with nothing going wrong says so rather than building a session", () => {
  /* The reason is a sentence the button can say, which is the difference
     between an empty session and a button that looks broken. */
  assert.equal(weak(deckOf(6)).reason, "nothing-weak");
  assert.equal(weak([]).reason, "none-drillable");
});

test("an exercise the ladder has not opened is not drilled, however badly it went", () => {
  /*
   * Writing a word from its meaning is the fourth level and opens only
   * when everything under it holds. A history of misses on a question the
   * app is not putting to anybody is not work waiting to be done — it is
   * the level below being recovered first, which is what this session is
   * for.
   */
  const got = weak([slipping("s1", [0, 0], "en2ar")].concat(deckOf(4)));
  assert.equal(got.reason, "nothing-weak");
});

test("no one card is the whole of a weak session", () => {
  /*
   * The cap a dealt session puts on how many forms of one card a sitting
   * takes, kept here: a verb lays out twenty cells, and twenty questions
   * about one word is the complaint that cap exists for. The worst-going
   * forms are the ones it keeps.
   */
  const many = word("v1", "أكل", "to eat", {
    category: "verb",
    forms: ["a", "b", "c", "d"].map((k) => ({
      id: k === "a" ? "v1" : `c-${k}`, ar: `أكل-${k}`, en: `ate ${k}`, lat: `akal-${k}`,
      lang: "ar-PS", s: { ar2en: withHist([0, 0]) },
    })),
  });
  const got = weak([many].concat(deckOf(4)));
  const forms = new Set(got.exercises.map((/** @type {any} */ e) => e.subId || "own"));
  assert.ok(forms.size <= 2, `${forms.size} forms of one card in the session`);
});

test("every form with something wrong on it is asked before any is asked twice", () => {
  /* Dealt a round at a time, like the session the app deals itself: a
     learner with twenty cards slipping gets twenty first questions, not
     six cards drilled to death. */
  const items = Array.from({ length: 12 }, (_, i) => slipping(`s${i + 1}`, [0, 0]));
  const got = weak(items);
  const perCard = new Map();
  for (const ex of got.exercises) perCard.set(ex.id, (perCard.get(ex.id) || 0) + 1);
  assert.ok(perCard.size >= 10, `${perCard.size} cards in the session`);
  for (const [id, n] of perCard) assert.equal(n, 1, `${id} was asked ${n} times`);
});

test("the count beside the button and the session it opens are the same test", () => {
  /* A number promising cards the session would not include is the fault
     the home screen has had before — see countReady. Both read isWeak. */
  const items = [slipping("s1", [0, 0]), slipping("s2", [1, 0])].concat(deckOf(4));
  installIndexes(items, settings);
  const counted = items.filter((it) => isWeak(it, settings)).map((it) => it.id);
  assert.deepEqual(counted, ["s1", "s2"]);
  const got = buildWeakSession({ items, settings, inDeck: anyDeck });
  assert.deepEqual(
    [...new Set(got.exercises.map((/** @type {any} */ e) => e.id))].sort(),
    counted.sort(),
    "the cards counted are the cards asked",
  );
});

/* ------------------------------------------------------------------
   The words that stood in a sentence's blanks

   Which card lent the word a sentence was filled with, and how far that
   card has itself got with the exercise being asked. Both are facts about
   the rest of the deck, so this is the half of crediting a filler that
   only the app can answer — the rule it feeds is fillerMarks, in
   tests/grade.test.mjs.
   ------------------------------------------------------------------ */

/** A schedule that is long since done, for opening a table's gate. */
const mature = () => ({
  phase: "review", step: 0, ease: 2.5, interval: 30, due: Date.now() + 30 * 86400000,
  reps: 9, lapses: 0, right: 9, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1], updated: 1,
});

/** The form a question is actually asked of, filled in as the app fills it. */
const askedForm = (/** @type {any} */ frame, /** @type {Record<string, string>} */ filled) =>
  ({ ...frame.forms[0], filled });

test("a sentence names the card that lent each word it was filled with", () => {
  const frame = word("f1", "{{noun}} كبير", "a big {{noun}}");
  const noun = word("n1", "كِتاب", "book", { category: "noun" });
  const items = [frame, noun];
  installIndexes(items, settings);
  const found = fillersIn(askedForm(frame, { noun: "n1" }), "ar2en", settings);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "n1", "the noun's own card");
  assert.equal(found[0].subId, null, "lent by its own word");
  assert.equal(found[0].asked, true, "and reading it is on its ladder");
});

test("a word is not credited for an exercise it does not climb", () => {
  /* A card with no recording has nothing on the listening exercises, and a
     sentence asked one of them has taught nothing about the word. */
  const frame = word("f1", "{{noun}} كبير", "a big {{noun}}");
  const noun = word("n1", "كِتاب", "book", { category: "noun" });
  installIndexes([frame, noun], settings);
  const found = fillersIn(askedForm(frame, { noun: "n1" }), "rec2en", settings);
  assert.equal(found.length, 1);
  assert.equal(found[0].asked, false, "with no recording, there is nothing to hear");
});

test("a sentence keeps a word's review up to date but does not open a rung", () => {
  /*
   * Under way and due, rather than merely open: the top of the ladder is
   * writing a word from its meaning with nothing on the screen, and inside
   * a sentence there is a whole sentence on the screen.
   */
  const frame = word("f1", "{{noun}} كبير", "a big {{noun}}");
  const overdue = { phase: "review", step: 0, ease: 2.5, interval: 4, due: Date.now() - 86400000,
    reps: 4, lapses: 0, right: 4, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1], updated: 1 };
  const asked = word("n1", "كِتاب", "book", { category: "noun" });
  asked.forms[0].s = { ar2en: overdue };
  installIndexes([frame, asked], settings);
  assert.equal(fillersIn(askedForm(frame, { noun: "n1" }), "ar2en", settings)[0].ready, true,
    "a review that has come round is this answer's to satisfy");

  /* Never asked on its own: open, perhaps, but not started from in here. */
  const untouched = word("n2", "قلم", "pen", { category: "noun" });
  installIndexes([frame, untouched], settings);
  assert.equal(fillersIn(askedForm(frame, { noun: "n2" }), "ar2en", settings)[0].ready, false,
    "an exercise the word has never been asked is left alone");
});

test("an adjective is credited on the form that actually stood in the sentence", () => {
  /*
   * An adjective lends its own word and the sentence goes back to its
   * table for the form that agrees — كتاب كبير, سيارة كبيرة — so what
   * stood in the blank is a cell nothing lent. It is that cell the answer
   * is about, and it has a schedule of its own.
   */
  const frame = word("f1", "{{noun}} {{adjective}}", "a {{adjective}} {{noun}}");
  const adj = {
    id: "a1", tags: [], created: 2, lang: "ar-PS", kind: "word", category: "adjective",
    forms: [
      { id: "a1", ar: "كبير", en: "big", lat: "kabiir", lang: "ar-PS", s: {} },
      { id: "a-fem", ar: "كبيرة", en: "big (f)", lat: "kabiira", lang: "ar-PS",
        row: "agreement", col: "feminine", s: {} },
    ],
  };
  const noun = word("n1", "سيّارة", "car", { category: "noun" });
  installIndexes([frame, adj, noun], settings);
  /* The feminine cell is what the sentence put up. */
  const found = fillersIn(askedForm(frame, { noun: "n1", adjective: "a-fem" }), "ar2en", settings);
  const fem = must(found.find((/** @type {any} */ f) => f.id === "a1"), "the adjective");
  assert.equal(fem.subId, "a-fem", "the cell that agreed, not the word it came from");
  assert.ok(found.some((/** @type {any} */ f) => f.id === "n1"), "and the noun beside it");

  /*
   * And it is credited only once the word it is a form of has been learnt,
   * because that is when the table opens at all. Not a rule of its own:
   * `laddered` is the one list every reader goes through, and a cell
   * behind its gate climbs with nothing. In practice the two agree — an
   * adjective whose own word is unmet cannot fill a blank either — and
   * this is where they are held together.
   */
  assert.equal(fem.asked, false, "an unlearnt adjective's cell is behind its gate");
  const learnt = {
    ...adj,
    forms: [{ ...adj.forms[0], s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, mature()])) },
      adj.forms[1]],
  };
  installIndexes([frame, learnt, noun], settings);
  const opened = fillersIn(askedForm(frame, { noun: "n1", adjective: "a-fem" }), "ar2en", settings);
  assert.equal(must(opened.find((/** @type {any} */ f) => f.id === "a1"), "the adjective").asked, true,
    "and once the word is known, the form that stood in the blank is credited");
});

test("a verb's own place in its own sentence is not credited from above", () => {
  /*
   * A verb card's sentence fills that slot out of its own table rather
   * than from the deck, so the word standing there is the card's own
   * content — its ladder is the table's gate to open, not something the
   * sentence above it has earned.
   */
  const verb = /** @type {any} */ ({
    id: "v1", tags: [], created: 1, lang: "ar-PS", kind: "word", category: "verb",
    forms: [
      { id: "v1", ar: "أكل", en: "to eat", lat: "akal", lang: "ar-PS", s: {} },
      { id: "v-sent", ar: "{{name}} {{verb}}", en: "{{name}} {{verb}}", lat: "",
        lang: "ar-PS", row: "past", s: {} },
      { id: "v-past-he", ar: "أكل", en: "he ate", lat: "akal", lang: "ar-PS",
        row: "past", col: "he", s: {} },
    ],
  });
  const name = word("p1", "سارة", "Sarah", { category: "name", fills: "name", drill: false });
  installIndexes([verb, name], settings);
  const sentence = { ...verb.forms[1], filled: { name: "p1", verb: "v-past-he" } };
  const found = fillersIn(/** @type {any} */ (sentence), "ar2en", settings);
  assert.ok(!found.some((/** @type {any} */ f) => f.subId === "v-past-he"),
    "the verb's own cell is left to its table");
});

test("a sentence filled from nothing credits nothing", () => {
  const frame = word("f1", "{{noun}} كبير", "a big {{noun}}");
  installIndexes([frame], settings);
  assert.deepEqual(fillersIn(frame.forms[0], "ar2en", settings), [],
    "a question that was never filled in has no words to credit");
  /* And a name nothing in the deck answers to is not invented. */
  assert.deepEqual(fillersIn(askedForm(frame, { noun: "nosuchcard" }), "ar2en", settings), []);
});

test("a value that is never practised keeps the record the sentence holds", () => {
  /*
   * "Raphael" is in the deck to fill somebody else's sentence, and "what
   * does Raphael mean" is not a question — so it has no ladder and a
   * schedule written on it would be one nothing ever reads. How far such a
   * value has been met is `met` on the frame, which is the case that field
   * exists for. The two kinds of value answer differently, and a drilled
   * word beside it is still credited.
   */
  const frame = word("f1", "اسمي {{name}} و {{noun}}", "my name is {{name}} and {{noun}}");
  const value = word("p1", "رافائيل", "Raphael", { fills: "name", drill: false });
  const noun = word("n1", "كِتاب", "book", { category: "noun" });
  installIndexes([frame, value, noun], settings);
  const found = fillersIn(askedForm(frame, { name: "p1", noun: "n1" }), "ar2en", settings);
  assert.deepEqual(found.map((/** @type {any} */ f) => f.id), ["n1"],
    "the noun is credited and the name is left to the frame's own record");
});

/* ------------------------------------------------------------------
   Being due orders a session; it does not gate one

   The app used to deal only cards that were due, which meant a learner
   partway through its own pacing of new cards met that pacing as silence:
   ten cards in four minutes, then seven with nothing on offer, four times
   over, and then nothing at all for the rest of the day. Somebody who had
   caught up got the same silence for the opposite reason.

   These are the rules that replaced it. The scheduler's own tests cover
   what an early answer is worth; these cover what is dealt.
   ------------------------------------------------------------------ */

const DAY_MS = 86400000;

/** A card already learnt, whose next review is `inDays` away. */
const settled = (/** @type {string} */ id, /** @type {number} */ inDays) => {
  const w = word(id, `كلمة${id}`, `word ${id}`);
  const due = Date.now() + inDays * DAY_MS;
  const state = { phase: "review", step: 0, ease: 2.5, interval: 10, due,
    reps: 4, right: 4, wrong: 0, lapses: 0, skips: 0, near: 0, hints: 0,
    updated: Date.now(), hist: [] };
  /* Every exercise the card supports, so nothing is merely unopened. */
  w.forms[0].s = Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, { ...state }]));
  return w;
};

test("a learner who is up to date is still dealt a session", () => {
  /* Twelve cards, none of them due for a week. The old answer was an empty
     session and a greyed-out button. */
  const items = Array.from({ length: 12 }, (_, i) => settled(`s${i + 1}`, 7));
  const got = deal(items);
  assert.equal(got.reason, null, `still refused: ${got.reason}`);
  assert.ok(got.exercises.length > 1, `${got.exercises.length} questions`);
});

test("and the session says how much of it was actually waiting", () => {
  /* What the screen at the end reads, so practising ahead is never
     mistaken for getting through the schedule. */
  const got = deal(Array.from({ length: 12 }, (_, i) => settled(`s${i + 1}`, 7)));
  assert.equal(got.due, 0, "none of them were due");
  assert.ok((got.items || 0) > 0, "but cards were dealt");
});

/* Which cards a session took. The order questions are *asked* in is the
   interleave's business — it spaces a card's own exercises apart and
   shuffles what the due list calls equal — so what is asserted here is
   which cards got in, which is what being due decides. */
const dealtCards = (/** @type {any} */ got) =>
  new Set(got.exercises.map((/** @type {any} */ x) => x.id));

test("an overdue card is taken ahead of cards that are not due", () => {
  /* More cards than a session holds, so getting in is a choice rather than
     a formality. */
  const far = Array.from({ length: 30 }, (_, i) => settled(`f${i + 1}`, 30 + i));
  const got = deal(far.concat([settled("late", -5)]));
  assert.ok(dealtCards(got).has("late"), "the overdue card was left out");
  assert.equal(got.due, 1, "and it is counted as the one that was waiting");
});

test("with nothing due, the nearest to due is taken and the furthest is not", () => {
  const far = Array.from({ length: 30 }, (_, i) => settled(`f${i + 1}`, 60 + i));
  const got = deal(far.concat([settled("soon", 1)]));
  const dealt = dealtCards(got);
  assert.ok(dealt.has("soon"), "the nearest card was left out");
  assert.ok(!dealt.has("f30"), "the furthest card was taken anyway");
});

test("practising ahead never brings in more new words than there is room for", () => {
  /* More practice means more of what you hold, never more than you can
     take on at once. */
  const got = deal(deckOf(60));
  const dealt = new Set(got.exercises.map((/** @type {any} */ x) => x.id));
  assert.ok(dealt.size <= FRONT_DOOR_CAP, `${dealt.size} new words in one session`);
});

/*
 * More cards asked for than a session would ordinarily hold.
 *
 * How many cards a session takes is worked out from how long it is and
 * what a card costs to ask — nine of these, and five where each card
 * carries a second form. That is the right question about the cards the
 * app picks and the wrong one about the cards a learner picked: somebody
 * who marked eight was handed five of them, a different five each sitting,
 * by a screen that had said each one was in their next session. The
 * session grows to hold them instead.
 */
test("every card the learner asked for is dealt, however many there are", () => {
  const deck = Array.from({ length: 30 }, (_, i) => settled(`f${i + 1}`, 30 + i));
  for (const n of [3, 8, 12]) {
    const asked = Array.from({ length: n }, (_, i) => ({
      ...settled(`a${i + 1}`, 60),
      priority: true,
    }));
    const dealt = dealtCards(deal(deck.concat(asked)));
    const missing = asked.map((it) => it.id).filter((id) => !dealt.has(id));
    assert.equal(missing.length, 0, `${n} marked, and these were left out: ${missing.join(" ")}`);
  }
});

test("and a card with a second form on it is no harder to ask for", () => {
  /* The ordinary shape of a course card, and the one where the old
     arithmetic bought the fewest places. */
  /** @param {string} id @param {number} inDays */
  const pair = (id, inDays) => {
    const w = settled(id, inDays);
    return { ...w, forms: w.forms.concat([{ ...w.forms[0], id: `${id}-f1`, ar: `${w.forms[0].ar}ات`, en: `${w.forms[0].en}s` }]) };
  };
  const deck = Array.from({ length: 30 }, (_, i) => pair(`f${i + 1}`, 30 + i));
  const asked = Array.from({ length: 8 }, (_, i) => ({ ...pair(`a${i + 1}`, 60), priority: true }));
  const dealt = dealtCards(deal(deck.concat(asked)));
  const missing = asked.map((it) => it.id).filter((id) => !dealt.has(id));
  assert.equal(missing.length, 0, `left out: ${missing.join(" ")}`);
});

test("and a session nobody has marked anything in is the size it always was", () => {
  /* The other half of the rule: the reach above is bought by the marks, so
     a learner who has made none is dealt exactly what they were before. */
  const deck = Array.from({ length: 30 }, (_, i) => settled(`f${i + 1}`, -1));
  const got = deal(deck);
  assert.ok(got.exercises.length <= 18, `${got.exercises.length} questions with nothing marked`);
});

/** A word met but not yet recognisable: a gap shorter than the bar. */
const learningWord = (/** @type {string} */ id) => {
  const w = word(id, `كلمة${id}`, `word ${id}`);
  const state = { phase: "review", step: 0, ease: 2.5, interval: 1,
    due: Date.now() + DAY_MS, reps: 2, right: 2, wrong: 0, lapses: 0, skips: 0,
    near: 0, hints: 0, updated: Date.now(), hist: [] };
  w.forms[0].s = Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, { ...state }]));
  return w;
};

test("a full front door stops new words, and does not stop the held ones being practised", () => {
  /* The wall itself, and the whole point of the two pools. The front door
     is full of words the learner cannot recognise yet, so nothing new may
     come in — and they used to be told there was nothing to practise while
     holding a handful of words they were midway through learning. */
  const held = Array.from({ length: FRONT_DOOR_CAP }, (_, i) => learningWord(`h${i + 1}`));
  const waiting = deckOf(20);
  const got = deal(held.concat(waiting));
  assert.equal(got.reason, null, `refused: ${got.reason}`);
  const dealt = new Set(got.exercises.map((/** @type {any} */ x) => x.id));
  assert.ok(
    [...dealt].every((id) => String(id).startsWith("h")),
    `let a new word in past a full door: ${[...dealt].join(" ")}`,
  );
});

test("and a word leaves the front door as soon as it can be recognised", () => {
  /* The release valve. These have a gap past the bar, so they are through
     the door and no longer block a newcomer, even though they are nowhere
     near finished with their ladder. */
  const known = Array.from({ length: FRONT_DOOR_CAP }, (_, i) => settled(`k${i + 1}`, 1));
  const got = deal(known.concat(deckOf(20)));
  const dealt = new Set(got.exercises.map((/** @type {any} */ x) => x.id));
  assert.ok(
    [...dealt].some((id) => String(id).startsWith("w")),
    `no new word got in behind recognised ones: ${[...dealt].join(" ")}`,
  );
});


/* ------------------------------------------------------------------
   A sitting of made-up numbers

   The practice is not dealt from the deck: it builds numbers out of the
   teacher's parts and asks about those. So what is worth checking is that
   it never reaches past what the parts can build, that a made-up number is
   never mistaken for a card, and that a right answer lands on the parts
   rather than on the number — which is the whole of how it is scheduled.
   ------------------------------------------------------------------ */

/** A number part card, as a learner's device holds one. */
const part = (/** @type {number} */ value, /** @type {string} */ ar, /** @type {any} */ over = {}) => ({
  id: `p${value}`, tags: [], created: 1, lang: "ar-PS", kind: "word",
  category: "number", value,
  forms: [{ id: `p${value}`, ar, en: String(value), lat: "", lang: "ar-PS", s: {} }],
  ...over,
});

/** Units alone: enough for nought to ten and nothing above it. */
const UNITS = ["صفر", "واحد", "اتنين", "تلاتة", "أربعة", "خمسة", "ستة", "سبعة", "تمانية", "تسعة", "عشرة"]
  .map((w, i) => part(i, w));

/** And the teens and tens on top, which opens everything below a hundred. */
const TO_NINETY_NINE = UNITS.concat(
  ["حداعش", "اتناعش", "تلاتطاعش", "أربعطاعش", "خمسطاعش", "ستطاعش", "سبعطاعش", "تمنطاعش", "تسعطاعش"]
    .map((w, i) => part(11 + i, w)),
  ["عشرين", "تلاتين", "أربعين", "خمسين", "ستين", "سبعين", "تمانين", "تسعين"]
    .map((w, i) => part(20 + i * 10, w)),
);

/** Deterministic, so an assertion about the range is about the range. */
const steady = () => {
  let seed = 11;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
};

const numbers = (/** @type {any[]} */ items, /** @type {any} */ over = {}) =>
  buildNumberSession({ items, settings, langId: "ar-PS", random: steady(), ...over });

test("a numbers practice asks about numbers that were never cards", () => {
  const built = numbers(TO_NINETY_NINE);
  assert.equal(built.reason, null);
  assert.equal(built.exercises.length, NUMBER_SESSION_SIZE);
  /* Every question is about something in the preview list rather than
     about one of the parts: the parts are what it was built from. */
  const held = new Set(built.preview.map((/** @type {any} */ i) => i.id));
  for (const ex of built.exercises) {
    assert.ok(held.has(ex.id), `${ex.id} is not in the sitting's own material`);
    assert.ok(isMadeUpNumber({ id: ex.id }));
  }
  /* And none of them is a card this device has. */
  const real = new Set(TO_NINETY_NINE.map((/** @type {any} */ i) => i.id));
  for (const made of built.preview) assert.equal(real.has(made.id), false);
});

test("a made-up number is never dealt, listed or counted as a card", () => {
  const built = numbers(TO_NINETY_NINE);
  for (const made of built.preview) {
    assert.equal(made.drill, false, "a number the app invented is not practised in its own right");
    assert.ok(made.value >= 0, "it knows what it is worth");
    assert.ok(Array.isArray(made.used) && made.used.length, "and which parts stood in it");
  }
});

test("the practice never reaches past what the parts can build", () => {
  /* Units alone: nothing above ten can be said, so nothing above ten is
     asked however wide the ramp is wound. */
  const built = numbers(UNITS, { reach: 8 });
  assert.equal(built.bands, 1, "one band opens and no more");
  for (const made of built.preview) {
    assert.ok(made.value <= 10, `${made.value} is above what the deck can build`);
  }
  /* With the teens and tens in, it reaches ninety-nine and no further. */
  const wider = numbers(TO_NINETY_NINE, { reach: 8 });
  assert.equal(wider.bands, 3);
  for (const made of wider.preview) assert.ok(made.value <= 99, `${made.value} is above ninety-nine`);
});

test("a deck with no number words builds no sitting at all", () => {
  const built = numbers(deckOf(6));
  assert.deepEqual(built.exercises, []);
  assert.equal(built.reason, "no-parts");
  /* And one whose language does not say how its numbers go together says
     which of the two is wrong, rather than looking like an empty deck. */
  const noRules = buildNumberSession({
    items: TO_NINETY_NINE, settings, langId: "xx-Nowhere", random: steady(),
  });
  assert.equal(noRules.reason, "no-numbers");
});

test("the sitting starts where the last one left off and widens as it goes", () => {
  /* Starting narrow: the first questions are in the lowest band, and the
     range has opened by the end. */
  const built = numbers(TO_NINETY_NINE, { reach: 1 });
  const at = (/** @type {number} */ i) =>
    must(built.preview.find((/** @type {any} */ p) => p.id === built.exercises[i].id), "asked").value;
  for (let i = 0; i < NUMBERS_PER_BAND; i += 1) {
    assert.ok(at(i) <= 10, `question ${i + 1} should still be in the first band`);
  }
  assert.ok(built.width > 1, "the sitting widened");
  /* And one that starts wide is wide from the first question. */
  const wide = numbers(TO_NINETY_NINE, { reach: 3 });
  assert.equal(wide.width, 3);
});

test("a picking question brings wrong answers worth confusing with the right one", () => {
  const built = numbers(TO_NINETY_NINE, { reach: 3 });
  const picks = built.exercises.filter((/** @type {any} */ e) => e.type === "fig2pick");
  assert.ok(picks.length, "the sitting asks some by picking");
  for (const p of picks) {
    assert.equal((p.mates || []).length, 3, "three wrong answers beside the right one");
    /* Every one of them is a number, spelled by the same pack, and none of
       them is the answer. */
    for (const mate of p.mates) {
      assert.ok(isMadeUpNumber({ id: mate.id }));
      assert.notEqual(mate.id, p.id);
    }
  }
});

test("all three ways of asking are used", () => {
  const built = numbers(TO_NINETY_NINE);
  const asked = new Set(built.exercises.map((/** @type {any} */ e) => e.type));
  assert.deepEqual([...asked].sort(), ["fig2num", "fig2pick", "num2fig"]);
  /* And none of them is a type anything schedules: a number is not a card
     and climbs no ladder. */
  for (const type of asked) assert.equal(TYPES.includes(type), false, `${type} must not be scheduled`);
});

test("answering a number credits the parts that stood in it, not the number", () => {
  const built = numbers(TO_NINETY_NINE, { reach: 3 });
  const made = must(built.preview.find((/** @type {any} */ p) => p.value > 20 && p.value % 10 !== 0), "a built number");
  /** @type {Map<number, any>} */
  const parts = new Map(TO_NINETY_NINE.map((/** @type {any} */ p) => [p.value, p]));
  /* Reading a number off the screen is evidence for the ordinary question
     that asks what a word means, and it is the part cards it lands on. */
  const key = NUMBER_EQUIVALENT.num2fig;
  assert.equal(key, "ar2en");
  const found = numberFillers(made, parts, key, settings);
  assert.deepEqual(
    found.map((/** @type {any} */ f) => f.id).sort(),
    made.used.map((/** @type {number} */ v) => `p${v}`).sort(),
    "every part that stood in the number is credited",
  );
  for (const f of found) {
    assert.equal(f.subId, null, "the part's own word, not one of its forms");
    assert.equal(f.asked, true, "and under a question that card actually climbs");
    assert.equal(f.ready, false, "a part never asked on its own is not started from inside a number");
  }
});

test("a part the learner does not hold is not credited", () => {
  const built = numbers(TO_NINETY_NINE, { reach: 3 });
  const made = must(built.preview.find((/** @type {any} */ p) => p.value > 20), "a built number");
  assert.deepEqual(numberFillers(made, new Map(), "ar2en", settings), [],
    "nothing is invented for a part that is not there",
  );
});