/*
 * Accepted answers: what belongs to which.
 *
 * A card may accept more than one, and each is its own word — said its own
 * way and carrying its own grammar. So what matters here is that nothing
 * gets handed to the wrong answer: not a transliteration, not a gender, and
 * not by a migration reading a card written before any of this existed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  answerForTurn,
  answerGiven,
  answerRows,
  answersOf,
  joinAlternatives,
  packAnswers,
  readAnswer,
  saidAnswers,
  splitAlternatives,
  withAnswer,
} from "../src/answers.ts";
import { canAsk, unmetNeeds } from "../src/offers.js";
import { EX, LANGUAGES, answerFields, checkAnswer, labelFor } from "../src/languages.js";

const ar = LANGUAGES["ar-PS"];
/* What a stored answer may carry, as the grammar table declares it. */
const fields = answerFields();

/* Two spellings of one meaning, each said its own way. Written in the
   Latin alphabet here for the same reason every other test is: what is
   being checked is the pairing, not the script. */
/** @returns {any} */
const two = () => ({ id: "w1", ar: "kitaab-script / safar-script", lat: "kitaab / safar", en: "book", recs: [], s: {} });

test("each accepted answer carries its own transliteration", () => {
  assert.deepEqual(answersOf(two(), fields), [
    { text: "kitaab-script", lat: "kitaab", at: 0 },
    { text: "safar-script", lat: "safar", at: 1 },
  ]);
});

test("a card with one of each is what it always was", () => {
  /* Every card written before this existed. Nothing to migrate: one answer
     and one transliteration already pair correctly. */
  assert.deepEqual(answersOf({ ar: "bayt", lat: "bayt-said" }, fields), [
    { text: "bayt", lat: "bayt-said", at: 0 },
  ]);
  assert.deepEqual(answersOf({ ar: "bayt" }, fields), [{ text: "bayt", lat: "", at: 0 }]);
});

test("a transliteration written for the second answer stays with the second", () => {
  /* The thing that can go wrong with pairing by position: dropping the
     blank would hand the second answer's pronunciation to the first, which
     is worse than having none. */
  const form = { ar: "one / two", lat: " / two-said" };
  assert.deepEqual(answersOf(form, fields), [
    { text: "one", lat: "", at: 0 },
    { text: "two", lat: "two-said", at: 1 },
  ]);
  assert.deepEqual(saidAnswers(form, fields).map((a) => a.text), ["two"], "only one can be asked how it sounds");
});

test("an answer with no spelling is not an answer, and takes its cell with it", () => {
  /* A row somebody started and left. Kept, it would be an accepted answer
     of nothing — and every transliteration after it would slide. */
  assert.deepEqual(answersOf({ ar: " / two", lat: "one-said / two-said" }, fields), [
    { text: "two", lat: "two-said", at: 1 },
  ]);
});

test("the editor writes both strings at once, so they cannot drift", () => {
  const packed = packAnswers([
    { text: "one", lat: "" },
    { text: "two", lat: "two-said" },
  ], fields);
  assert.deepEqual(packed.ar, "one / two");
  assert.deepEqual(packed.lat, " / two-said", "the blank holds the first answer's place");
  /* And what comes back out is what went in. */
  assert.deepEqual(answersOf(packed, fields).map((a) => [a.text, a.lat]), [["one", ""], ["two", "two-said"]]);

  /* A row with nothing in it at all is dropped whole rather than leaving a
     hole in either place. */
  const one = packAnswers([{ text: "one", lat: "one-said" }, { text: "", lat: "" }], fields);
  assert.deepEqual([one.ar, one.lat], ["one", "one-said"]);
  assert.equal(one.answers.length, 1);
  /* Including a transliteration typed with no answer beside it: there is
     nothing for it to be the pronunciation of. */
  assert.deepEqual(packAnswers([{ text: "", lat: "orphan" }], fields).answers, []);
});

test("the rows an editor opens on are never none", () => {
  assert.deepEqual(answerRows({}, fields), [{ text: "", lat: "" }]);
  assert.deepEqual(answerRows({ ar: "one / two", lat: "one-said" }, fields), [
    { text: "one", lat: "one-said" },
    { text: "two", lat: "" },
  ]);
});

test("splitting keeps blanks and joining drops only the trailing ones", () => {
  assert.deepEqual(splitAlternatives("a / b"), ["a", "b"]);
  assert.deepEqual(splitAlternatives("a ; b"), ["a", "b"], "the other separator people typed by hand");
  assert.deepEqual(splitAlternatives(""), [""]);
  assert.equal(joinAlternatives(["a", "", "b"]), "a /  / b", "a blank in the middle is holding a place");
  assert.equal(joinAlternatives(["a", "", ""]), "a", "blanks at the end are rows nobody filled in");
  assert.equal(joinAlternatives(["", ""]), "");
});

test("a question about how a card sounds is a question about one answer", () => {
  /* Narrowed to the pair being asked about, so the prompt, the marking and
     the answer screen all read one form. Asked of the whole card, "how is
     this pronounced" has two answers and "write this in the script" would
     accept a word the question never mentioned. */
  const one = withAnswer(two(), saidAnswers(two(), fields)[1]);
  assert.equal(one.ar, "safar-script");
  assert.equal(one.lat, "safar");
  assert.equal(one.en, "book", "everything else about the form travels with it");

  /* And the marking follows: the other spelling is now wrong, because the
     question was about this one. */
  assert.equal(checkAnswer("safar-script", one, "tr2ar", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("kitaab-script", one, "tr2ar", { language: "ar-PS" }).ok, false);
  /* Where the whole card would have accepted either. */
  assert.equal(checkAnswer("kitaab-script", two(), "tr2ar", { language: "ar-PS" }).ok, true);
});

test("a card with two of them is drilled on both, one at a time", () => {
  /* Rotated by how often the exercise has been asked, like the phrase a
     word is shown in: nothing is drawn, so the same count is the same
     question and a re-render does not swap the word under a learner. */
  const form = two();
  /** @param {any} f @param {number} n */
  const turn = (f, n) => answerForTurn(f, n, fields) || { text: "", lat: "" };
  assert.equal(turn(form, 0).text, "kitaab-script");
  assert.equal(turn(form, 1).text, "safar-script");
  assert.equal(turn(form, 2).text, "kitaab-script", "and round again");
  assert.equal(turn(form, 1).lat, "safar", "each with its own");

  /* An answer with no transliteration is not in the rotation: there is no
     question to ask about how it sounds. */
  const half = { ar: "one / two", lat: " / two-said" };
  assert.equal(turn(half, 0).text, "two");
  assert.equal(turn(half, 1).text, "two");
  assert.equal(answerForTurn({ ar: "one", lat: "" }, 0, fields), null, "and a card with none asks nothing");
});

test("what a pronunciation exercise waits for is an answer that has one", () => {
  /* Not merely a transliteration somewhere on the card. A form accepting
     two spellings with a transliteration for only the second can be asked
     — about the second. */
  const half = { ...two(), lat: " / safar" };
  assert.deepEqual(unmetNeeds(half, EX.tr2ar, null, []), []);
  assert.equal(canAsk({ unit: half, scene: null, contexts: [] }, "tr2ar", ar), true);

  /* And one with no transliteration against any answer cannot. */
  const none = { ...two(), lat: "" };
  assert.deepEqual(unmetNeeds(none, EX.tr2ar, null, []), ["lat"]);
  assert.equal(canAsk({ unit: none, scene: null, contexts: [] }, "ar2tr", ar), false);
});


/* --- grammar belongs to the answer, not to the form ---

   "I'm happy" said by a man and by a woman is one thing to know with two
   right answers that differ by a syllable and by a gender. A single
   "masculine" over the pair described one of them and lied about the
   other, and a learner who wrote the feminine was told they had written a
   masculine word. */

/** A card written before answers carried anything: one set of values, flat
    on the form, and two accepted answers underneath them. */
/** @returns {any} */
const beforeTheChange = () => ({
  id: "w2",
  ar: "mabsuut / mabsuuta",
  lat: "mabsuut-said / mabsuuta-said",
  en: "happy",
  number: "singular",
  gender: "masculine",
  recs: [],
  s: {},
});

test("a card written before the change reads as one answer per set of values", () => {
  /* The migration, stated as what it must not change: every answer keeps
     the grammar the form carried, because that is what it meant when there
     was one set of it. Nothing is invented and nothing is dropped. */
  const lifted = answersOf(beforeTheChange(), fields);
  assert.deepEqual(lifted, [
    { number: "singular", gender: "masculine", text: "mabsuut", lat: "mabsuut-said", at: 0 },
    { number: "singular", gender: "masculine", text: "mabsuuta", lat: "mabsuuta-said", at: 1 },
  ]);
  /* And a card with one answer — every ordinary card ever written — comes
     through in every particular. */
  assert.deepEqual(answersOf({ ar: "bayt", lat: "beit", gender: "masculine" }, fields), [
    { gender: "masculine", text: "bayt", lat: "beit", at: 0 },
  ]);
});

test("a migrated card can then be corrected one answer at a time", () => {
  /* The point of the migration: what it produces is editable per answer,
     which the shape it replaced could not express at all. */
  const lifted = answersOf(beforeTheChange(), fields);
  const fixed = lifted.map((a) => (a.text === "mabsuuta" ? { ...a, gender: "feminine" } : a));
  const packed = packAnswers(fixed, fields);
  assert.deepEqual(packed.answers.map((a) => [a.text, a.gender]), [
    ["mabsuut", "masculine"],
    ["mabsuuta", "feminine"],
  ]);
  /* The delimited strings the server and every export read are written from
     the same list, so they cannot drift from it. */
  assert.equal(packed.ar, "mabsuut / mabsuuta");
  assert.equal(packed.lat, "mabsuut-said / mabsuuta-said");
  /* And reading it back gives what went in. */
  assert.deepEqual(answersOf(packed, fields).map((a) => a.gender), ["masculine", "feminine"]);
});

test("an alternate answer of a different gender keeps its own", () => {
  const card = packAnswers(
    [
      { text: "mabsuut", lat: "mabsuut-said", gender: "masculine", number: "singular" },
      { text: "mabsuuta", lat: "mabsuuta-said", gender: "feminine", number: "singular" },
    ],
    fields,
  );

  /* Both are right, because both are accepted answers of one card. */
  const asked = { ...card, en: "happy", s: {} };
  assert.equal(checkAnswer("mabsuut", asked, "en2ar", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("mabsuuta", asked, "en2ar", { language: "ar-PS" }).ok, true);

  /* And the screen can say which one was written, which is the whole
     reason the gender is down here rather than up on the form. */
  const matches = (/** @type {string} */ a, /** @type {string} */ b) => a.trim() === b.trim();
  /** @param {string} typed */
  const gave = (typed) => answerGiven(typed, asked, matches, fields) || { gender: "none" };
  assert.equal(gave("mabsuuta").gender, "feminine");
  assert.equal(gave("mabsuut").gender, "masculine");
  assert.equal(labelFor(gave("mabsuuta"), ar), "sg. f.");
  assert.equal(labelFor(gave("mabsuut"), ar), "sg. m.");
  /* Nothing they did not write. */
  assert.equal(answerGiven("something else", asked, matches, fields), null);
  assert.equal(answerGiven("", asked, matches, fields), null);
});

test("a stored answer is narrowed to what the language declares", () => {
  /* The schema at the door. A document is somebody's cards, so nothing
     throws: a value no language offers becomes no value, a field nobody
     asked for is not carried forward, and what is left is readable. */
  const read = readAnswer(
    { text: " kitaab ", lat: 7, gender: "wobbly", number: "plural", nonsense: "hello" },
    fields,
  );
  assert.deepEqual(read, { text: "kitaab", lat: "7", number: "plural" });
  assert.equal("gender" in read, false, "a gender no language offers is not a gender");
  assert.equal("nonsense" in read, false, "a stored shape must not accumulate");
  assert.deepEqual(readAnswer(null, fields), { text: "", lat: "" });
  assert.deepEqual(readAnswer("just a string", fields), { text: "", lat: "" });
});

test("the delimited strings win where the array disagrees with them", () => {
  /* Two places hold the words, because `ar` and `lat` are what the server,
     an export and every card list read. Which wins has to be said once:
     the strings do, because they are what the rest of the app edits — a
     CSV import writes them, a card arrives from the server carrying them
     — and an array that no longer matches is a stale cache of a card that
     has moved on. */
  const card = packAnswers([{ text: "one", lat: "one-said", gender: "masculine" }], fields);
  assert.equal(answersOf(card, fields)[0].gender, "masculine", "in step, the array is read");

  const edited = { ...card, ar: "two" };
  assert.deepEqual(answersOf(edited, fields).map((a) => a.text), ["two"]);
  assert.equal(answersOf(edited, fields)[0].gender, undefined,
    "a stale entry does not describe a word it is no longer about");

  /* Clearing the transliteration clears it, whatever the array remembers —
     which is what a card stripped down to its recordings relies on. */
  assert.deepEqual(answersOf({ ...card, lat: "" }, fields).map((a) => a.lat), [""]);
});
