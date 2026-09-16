/*
 * Marking an answer.
 *
 * The one path that writes a learner's progress. It used to be a function
 * closed over ten pieces of React state, so none of this could be asked at
 * all without a browser — and the only thing watching it was a jsdom walk
 * that answered a single question and checked that *a* verdict appeared on
 * screen. A mark filed against the wrong form, or against the wrong one of
 * a card's two spellings, or one that moved a schedule practice should have
 * left alone, would have passed every check the project had.
 *
 * The clock is passed in, as the scheduler's is, so "this is the state it
 * writes" is a sentence a test can finish.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { fillerMarks, gradeInto, markedState, targetOf, verdictOf } from "../src/grade.ts";
import { freshState, DAY } from "../src/scheduler.ts";
import { must } from "./helpers.mjs";

/* gradeInto answers null where it wrote nothing, and a form carries a
   schedule only once it has one — both of which the tests below are about,
   so where a test means "it wrote this" it says so through these rather
   than guarding every read. */
/** @param {any[]} items @param {any[]} marks @param {any} asking */
const wrote = (items, marks, asking) =>
  must(gradeInto(items, marks, asking), "something written");
/** @param {any} form @param {string} key */
const keyOf = (form, key) => must(must(form, "the form").s, "its schedule")[key];

const T = 1_700_000_000_000;
const clock = { now: () => T, random: () => 0.5 };

/** A state that has been answered and is sitting in review. */
const inReview = (/** @type {number} */ interval) => ({
  ...freshState(), phase: "review", interval, due: T - DAY, reps: 4, right: 4, updated: T - DAY,
});

/** A card with a word, a plural and a turn or two. */
const card = (/** @type {Record<string, any>} */ over = {}) => ({
  id: "k", tags: [], created: 1, lang: "ar-PS",
  forms: [
    { id: "k", ar: "كِتاب", en: "book", lat: "kitaab", s: {} },
    { id: "fpl", ar: "كُتُب", en: "books", lat: "kutub", s: {} },
  ],
  ...over,
});

/* ---- what the answer counts as ---- */

test("a right answer is good, a blank is again, a near miss is hard", () => {
  assert.deepEqual(verdictOf({ checked: { ok: true } }),
    { correct: true, near: false, rating: "good" });
  assert.deepEqual(verdictOf({ checked: { ok: false, reason: "wrong" } }),
    { correct: false, near: false, rating: "again" });
  /* Right letters, wrong tone; right word, marks missing; one letter out.
     Scheduled gently rather than halved and sent back to relearning. */
  for (const reason of ["near", "harakat", "missing"]) {
    assert.deepEqual(verdictOf({ checked: { ok: false, reason } }),
      { correct: false, near: true, rating: "hard" }, reason);
  }
});

test("a skip is a miss, and not a near one however it was spelt", () => {
  /* "I don't know" with something half-typed in the box is not nearly
     right: nothing was offered. */
  assert.deepEqual(verdictOf({ skipped: true, checked: { ok: false, reason: "near" } }),
    { correct: false, near: false, rating: "again" });
  /* And a skip cannot be right even if the grader would have accepted it. */
  assert.equal(verdictOf({ skipped: true, checked: { ok: true } }).correct, false);
});

test("an answer written with the answer on the screen is a near miss, never a pass", () => {
  /*
   * The nudge on two questions is the word itself said another way, so
   * writing it with that up is the question one level down. Counting it as
   * knowing the word is how a learner with the nudge open graduated
   * writing from the meaning without once having done it.
   */
  assert.deepEqual(verdictOf({ toldAnswer: true, checked: { ok: true } }),
    { correct: false, near: false, rating: "hard" });
  /* And it outranks the override: "too strict" is about the marking, and
     nothing was marked. */
  assert.equal(verdictOf({ toldAnswer: true, overridden: true }).correct, false);
});

test("too strict overturns the grader, which is the one thing that does", () => {
  assert.deepEqual(verdictOf({ overridden: true, checked: { ok: false, reason: "wrong" } }),
    { correct: true, near: false, rating: "good" });
});

/* ---- what that writes ---- */

test("a right answer in review moves the schedule on", () => {
  const before = inReview(10);
  const s = markedState(before, { rating: "good", correct: true, advance: true }, {}, clock);
  assert.equal(s.phase, "review");
  assert.ok(s.interval > 10, `${s.interval} is further out than 10`);
  assert.equal(s.right, 5);
  assert.equal(s.updated, T, "and is stamped now, so a sync keeps it");
  assert.deepEqual(s.hist, [1]);
  assert.notEqual(before.interval, s.interval, "the state handed in is not touched");
});

test("practice counts a right answer without moving the card", () => {
  /*
   * The point of practice: a card comes back when it was always going to.
   * A miss is still a miss, because getting it wrong is news wherever it
   * happened.
   */
  const before = inReview(10);
  const kept = markedState(before, { rating: "good", correct: true, advance: false }, {}, clock);
  assert.equal(kept.interval, 10, "the interval stands");
  assert.equal(kept.due, before.due, "and so does when it comes back");
  assert.equal(kept.right, 5, "but the right answer is counted");
  assert.equal(kept.reps, 5);

  const missed = markedState(before, { rating: "again", correct: false, advance: false }, {}, clock);
  assert.equal(missed.phase, "relearning", "a miss lands whether or not it was practice");
});

test("the counts beside the schedule are kept whether or not it moved", () => {
  /* They are what the progress screen and the difficulty reading are made
     of. A hint is counted wherever one is offered, not only where taking it
     costs the mark: "answered right" and "answered right with the
     pronunciation on the screen" are two different numbers. */
  const s = markedState(
    freshState(),
    { rating: "again", correct: false, advance: true },
    { skipped: true, hintAtAnswer: true, checked: { ok: false, reason: "harakat" } },
    clock,
  );
  assert.equal(s.skips, 1);
  assert.equal(s.hints, 1);
  assert.equal(s.near, 1);
  assert.deepEqual(s.hist, [0]);
});

test("the last six outings are kept, and no more", () => {
  let s = { ...freshState(), hist: [1, 1, 1, 1, 1, 1] };
  s = markedState(s, { rating: "again", correct: false, advance: true }, {}, clock);
  assert.deepEqual(s.hist, [1, 1, 1, 1, 1, 0]);
  assert.equal(s.hist.length, 6);
});

/* ---- where it is written ---- */

test("a mark is filed against the form that was asked", () => {
  const graded = wrote([card()], [
    { id: "k", subId: "fpl", rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock });
  const it = graded[0];
  assert.equal(keyOf(it.forms[0], "ar2en"), undefined, "the card's own word is untouched");
  assert.ok(keyOf(it.forms[1], "ar2en"), "and the plural has the mark");
  assert.equal(keyOf(it.forms[1], "ar2en").right, 1);
});

test("a mark on the card's own word goes to the first of its forms", () => {
  const graded = wrote([card()], [
    { id: "k", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock });
  assert.ok(keyOf(graded[0].forms[0], "ar2en"));
  assert.equal(keyOf(graded[0].forms[1], "ar2en"), undefined);
});

test("which of a card's two spellings was asked is the key's to say", () => {
  /*
   * Each accepted spelling is practised in its own right, under a key that
   * names which — "ar2en" for the first, "ar2en@1" for the second. A mark
   * written under the bare name would credit the wrong word, and the one
   * that was answered would read as never asked.
   */
  const graded = wrote([card()], [
    { id: "k", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en@1", clock });
  const s = must(graded[0].forms[0].s, "its schedule");
  assert.ok(s["ar2en@1"], "the second spelling's schedule is the one written");
  assert.equal(s["ar2en"], undefined, "and the first one's is left alone");
});

test("a turn of a conversation is marked on its own list", () => {
  const scene = card({
    forms: [{ id: "k", ar: "", en: "At the door", lat: "", s: {} }],
    lines: [
      { id: "k-l0", ar: "مرحبا", en: "hello", s: {} },
      { id: "k-l1", ar: "أهلا", en: "hi", s: {} },
    ],
  });
  const graded = wrote([scene], [
    { id: "k", subId: "k-l1", rating: "good", correct: true, advance: true },
  ], { type: "dlgpick", clock });
  assert.ok(keyOf(must(graded[0].lines, "the turns")[1], "dlgpick"), "the turn that was asked");
  assert.equal(keyOf(must(graded[0].lines, "the turns")[0], "dlgpick"), undefined, "and not the one beside it");
  assert.equal(keyOf(graded[0].forms[0], "dlgpick"), undefined, "nor the scene itself");
});

test("a grid marks every word in it, each on its own pair", () => {
  /*
   * Five questions at once. A word dealt in to fill the grid out that was
   * not due is credited without its schedule moving; a miss is a miss
   * wherever it happens.
   */
  const two = [
    card(),
    { ...card({ id: "k2" }), forms: [{ id: "k2", ar: "قلم", en: "pen", lat: "qalam", s: {} }] },
  ];
  const graded = wrote(two, [
    { id: "k", subId: null, rating: "good", correct: true, advance: true },
    { id: "k2", subId: null, rating: "again", correct: false, advance: true },
  ], { type: "match", clock });
  assert.equal(keyOf(graded[0].forms[0], "match").right, 1);
  assert.equal(keyOf(graded[1].forms[0], "match").wrong, 1);
  assert.equal(keyOf(graded[1].forms[0], "match").phase, "learning", "the miss lands on its own card");
});

test("a card withdrawn while it was on screen is passed over, not thrown at", () => {
  /* A teacher can withdraw a card mid-session, and the answer to that is
     the rest of the grid. */
  const graded = wrote([card()], [
    { id: "gone", subId: null, rating: "good", correct: true, advance: true },
    { id: "k", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock });
  assert.ok(graded, "something was written");
  assert.ok(keyOf(graded[0].forms[0], "ar2en"));
});

test("nothing written at all leaves the document exactly as it was", () => {
  /* So a save is not made of a copy that differs in nothing — which is
     what `null` is for, and what the caller checks. */
  assert.equal(gradeInto([card()], [
    { id: "gone", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock }), null);
  assert.equal(gradeInto([card()], [], { type: "ar2en", clock }), null);
  /* And a form the card does not carry is not invented. */
  assert.equal(gradeInto([card()], [
    { id: "k", subId: "nosuchform", rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock }), null);
});

test("the question a lift already moved is answered, and not marked again", () => {
  /*
   * "This was too easy" writes the ladder on the spot, so the answer given
   * to that question is neither rewarded nor lapsed — but it still counts
   * as answered, or the session would stall on it. Any other word on the
   * same grid is marked as usual.
   */
  const two = [card(), { ...card({ id: "k2" }), forms: [{ id: "k2", ar: "قلم", en: "pen", s: {} }] }];
  const graded = wrote(two, [
    { id: "k", subId: null, rating: "again", correct: false, advance: true },
    { id: "k2", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en", spare: { id: "k", subId: null }, clock });
  assert.ok(graded, "the answer counted");
  assert.equal(keyOf(graded[0].forms[0], "ar2en"), undefined, "the lifted question is left where it is");
  assert.ok(keyOf(graded[1].forms[0], "ar2en"), "and the other word on the grid is marked");
  /* The spare names a question, not a card: the same card's plural is
     still marked. */
  const alsoPlural = wrote([card()], [
    { id: "k", subId: "fpl", rating: "good", correct: true, advance: true },
  ], { type: "ar2en", spare: { id: "k", subId: null }, clock });
  assert.ok(keyOf(alsoPlural[0].forms[1], "ar2en"));
});

/* ---- and what the question was filled with ---- */

test("a frame records the words it was filled with, at the level it was asked", () => {
  const frame = card({
    forms: [{ id: "k", ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}", s: {} }],
  });
  const graded = wrote([frame], [
    { id: "k", subId: null, rating: "good", correct: true, advance: true,
      filled: { name: "rafa" } },
  ], { type: "ar2en", level: 1, clock });
  assert.deepEqual(graded[0].forms[0].met, { "name:rafa": 1 });

  /* A high-water mark: asked again lower down, it does not go backwards. */
  const again = wrote(graded, [
    { id: "k", subId: null, rating: "good", correct: true, advance: true,
      filled: { name: "rafa" } },
  ], { type: "en2ar", level: 4, clock });
  assert.deepEqual(again[0].forms[0].met, { "name:rafa": 4 });
  const down = wrote(again, [
    { id: "k", subId: null, rating: "good", correct: true, advance: true,
      filled: { name: "rafa" } },
  ], { type: "ar2en", level: 1, clock });
  assert.deepEqual(down[0].forms[0].met, { "name:rafa": 4 });
});

test("only the values with no ladder of their own are written down", () => {
  /* Everything else is gated on its own progress and needs nothing
     recorded, which is what keeps this small on a frame drawing on the
     whole vocabulary. */
  const frame = card({
    forms: [{ id: "k", ar: "{{word}} كبير", en: "a big {{word}}", lat: "", s: {} }],
  });
  const graded = wrote([frame], [
    { id: "k", subId: null, rating: "good", correct: true, advance: true,
      filled: { word: "kbook" } },
  ], { type: "ar2en", level: 1, keepMet: () => false, clock });
  assert.equal(graded[0].forms[0].met, undefined, "a drilled word records nothing");
});

test("a card that leaves no hole does not start carrying an empty record", () => {
  const graded = wrote([card()], [
    { id: "k", subId: null, rating: "good", correct: true, advance: true },
  ], { type: "ar2en", level: 1, clock });
  assert.equal(graded[0].forms[0].met, undefined);
});

test("a wrong answer still records having seen the word", () => {
  /* The question is whether the learner has met it, and getting it wrong
     is still having met it. */
  const frame = card({
    forms: [{ id: "k", ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "", s: {} }],
  });
  const graded = wrote([frame], [
    { id: "k", subId: null, rating: "again", correct: false, advance: true,
      filled: { name: "rafa" } },
  ], { type: "ar2en", level: 1, clock });
  assert.deepEqual(graded[0].forms[0].met, { "name:rafa": 1 });
});

/* ---- which form a mark is about ---- */

test("a form is found by name, wherever it sits", () => {
  const it = card();
  assert.equal(must(targetOf(/** @type {any} */ (it), null), "the lead").id, "k",
    "no name means the card's own word");
  assert.equal(must(targetOf(/** @type {any} */ (it), "fpl"), "the plural").id, "fpl");
  assert.equal(targetOf(/** @type {any} */ (it), "nope"), null);
});

test("the card and the form it wrote both carry the time it happened", () => {
  const graded = wrote([card()], [
    { id: "k", subId: "fpl", rating: "good", correct: true, advance: true },
  ], { type: "ar2en", clock });
  assert.equal(graded[0].updated, T, "so a merge knows which side is newer");
  assert.equal(graded[0].forms[1].updated, T);
  assert.equal(keyOf(graded[0].forms[1], "ar2en").updated, T);
});

/* ------------------------------------------------------------------
   The words that stood in a sentence's blanks

   A sentence is a card made of blanks and the vocabulary fills them, so
   answering one is answering about the words in it. Only the sentence used
   to be marked: a learner could write a noun correctly a dozen times
   inside sentences and the app went on believing they had never produced
   it.
   ------------------------------------------------------------------ */

/** @param {Record<string, any>} over */
const filler = (over = {}) => ({ id: "n1", subId: null, asked: true, ready: false, ...over });

test("a right answer credits every word that stood in the sentence", () => {
  const marks = fillerMarks(
    [filler({ id: "noun" }), filler({ id: "adj" })],
    { correct: true },
  );
  assert.deepEqual(marks.map((m) => m.id), ["noun", "adj"]);
  for (const m of marks) {
    assert.equal(m.rating, "good");
    assert.equal(m.correct, true);
  }
});

test("a wrong answer blames none of them", () => {
  /* A grid knows which word was mismatched; a sentence does not. Something
     in it was wrong and there is no saying which part, so nothing is
     recorded against the words it borrowed. */
  assert.deepEqual(fillerMarks([filler(), filler({ id: "adj" })], { correct: false }), []);
});

test("a word is credited only on an exercise it climbs itself", () => {
  /*
   * A sentence may be asked something its fillers are not — and writing a
   * state for an exercise a card can never be dealt is the mistake the
   * "too easy" lift made by reading the question instead of the card.
   */
  const marks = fillerMarks(
    [filler({ id: "noun", asked: true }), filler({ id: "adj", asked: false })],
    { correct: true },
  );
  assert.deepEqual(marks.map((m) => m.id), ["noun"]);
});

test("the schedule moves only where that word's own was under way and due", () => {
  /*
   * Being mentioned in a sentence is not a reason to push a word further
   * out than it had earned — the same rule a grid applies to a word dealt
   * in to fill it out. Where the word was itself due, the answer is its
   * answer.
   */
  const marks = fillerMarks(
    [filler({ id: "due", ready: true }), filler({ id: "notdue", ready: false })],
    { correct: true },
  );
  assert.equal(must(marks.find((m) => m.id === "due"), "the due word").advance, true);
  assert.equal(must(marks.find((m) => m.id === "notdue"), "the other").advance, false);
  /* And practice moves nothing, here as everywhere. */
  const inPractice = fillerMarks([filler({ id: "due", ready: true })], { correct: true }, true);
  assert.equal(inPractice[0].advance, false);
});

test("one card standing in two blanks of one sentence is one word", () => {
  const marks = fillerMarks(
    [filler({ id: "noun" }), filler({ id: "noun" })],
    { correct: true },
  );
  assert.equal(marks.length, 1);
  /* Two different forms of one card are two words, though: the plural is
     not the singular. */
  assert.equal(fillerMarks(
    [filler({ id: "noun", subId: null }), filler({ id: "noun", subId: "fpl" })],
    { correct: true },
  ).length, 2);
});

test("nothing stood in the blanks, nothing is credited", () => {
  assert.deepEqual(fillerMarks([], { correct: true }), []);
  assert.deepEqual(fillerMarks(/** @type {any} */ (null), { correct: true }), []);
});

test("a sentence's own record of what filled it does not reach the words it borrowed", () => {
  /*
   * `met` is the sentence's note of which value it has been asked with,
   * and it is keyed by slot. Written onto a word the sentence borrowed it
   * would say that word had been met with itself — which is why what a
   * question was filled with rides on the mark rather than beside the
   * question now that one answer marks several cards.
   */
  const frame = {
    id: "f", tags: [], created: 1, lang: "ar-PS",
    forms: [{ id: "f", ar: "{{noun}} كبير", en: "a big {{noun}}", lat: "", s: {} }],
  };
  const noun = {
    id: "n", tags: [], created: 1, lang: "ar-PS",
    forms: [{ id: "n", ar: "كِتاب", en: "book", lat: "kitaab", s: {} }],
  };
  const graded = wrote(
    [frame, noun],
    [
      { id: "f", subId: null, rating: "good", correct: true, advance: true,
        filled: { noun: "n" } },
      ...fillerMarks([{ id: "n", subId: null, asked: true, ready: false }], { correct: true }),
    ],
    { type: "ar2en", level: 1, clock },
  );
  assert.deepEqual(graded[0].forms[0].met, { "noun:n": 1 }, "the sentence keeps the record");
  assert.equal(graded[1].forms[0].met, undefined, "and the word it borrowed carries none");
  assert.ok(keyOf(graded[1].forms[0], "ar2en"), "but is credited for the answer");
  assert.equal(keyOf(graded[1].forms[0], "ar2en").right, 1);
});
