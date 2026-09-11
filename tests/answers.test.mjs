/*
 * Accepted answers, and which transliteration belongs to which.
 *
 * A card may accept more than one spelling, and each is its own word with
 * its own pronunciation. They are stored as two strings read together by
 * position, which is the whole of the link — so what matters here is that
 * position survives everything the editor does to it, and that nothing
 * downstream has to guess.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  answerForTurn,
  answerRows,
  answersOf,
  joinAlternatives,
  packAnswers,
  saidAnswers,
  splitAlternatives,
  withAnswer,
} from "../src/answers.js";
import { canAsk, unmetNeeds } from "../src/offers.js";
import { EX, LANGUAGES, checkAnswer } from "../src/languages.js";

const ar = LANGUAGES["ar-PS"];

/* Two spellings of one meaning, each said its own way. Written in the
   Latin alphabet here for the same reason every other test is: what is
   being checked is the pairing, not the script. */
/** @returns {any} */
const two = () => ({ id: "w1", ar: "kitaab-script / safar-script", lat: "kitaab / safar", en: "book", recs: [], s: {} });

test("each accepted answer carries its own transliteration", () => {
  assert.deepEqual(answersOf(two()), [
    { ar: "kitaab-script", lat: "kitaab", at: 0 },
    { ar: "safar-script", lat: "safar", at: 1 },
  ]);
});

test("a card with one of each is what it always was", () => {
  /* Every card written before this existed. Nothing to migrate: one answer
     and one transliteration already pair correctly. */
  assert.deepEqual(answersOf({ ar: "bayt", lat: "bayt-said" }), [
    { ar: "bayt", lat: "bayt-said", at: 0 },
  ]);
  assert.deepEqual(answersOf({ ar: "bayt" }), [{ ar: "bayt", lat: "", at: 0 }]);
});

test("a transliteration written for the second answer stays with the second", () => {
  /* The thing that can go wrong with pairing by position: dropping the
     blank would hand the second answer's pronunciation to the first, which
     is worse than having none. */
  const form = { ar: "one / two", lat: " / two-said" };
  assert.deepEqual(answersOf(form), [
    { ar: "one", lat: "", at: 0 },
    { ar: "two", lat: "two-said", at: 1 },
  ]);
  assert.deepEqual(saidAnswers(form).map((a) => a.ar), ["two"], "only one can be asked how it sounds");
});

test("an answer with no spelling is not an answer, and takes its cell with it", () => {
  /* A row somebody started and left. Kept, it would be an accepted answer
     of nothing — and every transliteration after it would slide. */
  assert.deepEqual(answersOf({ ar: " / two", lat: "one-said / two-said" }), [
    { ar: "two", lat: "two-said", at: 1 },
  ]);
});

test("the editor writes both strings at once, so they cannot drift", () => {
  const packed = packAnswers([
    { ar: "one", lat: "" },
    { ar: "two", lat: "two-said" },
  ]);
  assert.deepEqual(packed, { ar: "one / two", lat: " / two-said" },
    "the blank holds the first answer's place");
  /* And what comes back out is what went in. */
  assert.deepEqual(answersOf(packed).map((a) => [a.ar, a.lat]), [["one", ""], ["two", "two-said"]]);

  /* A row with nothing in it at all is dropped whole rather than leaving a
     hole in both strings. */
  assert.deepEqual(packAnswers([{ ar: "one", lat: "one-said" }, { ar: "", lat: "" }]),
    { ar: "one", lat: "one-said" });
  /* Including a transliteration typed with no answer beside it: there is
     nothing for it to be the pronunciation of. */
  assert.deepEqual(packAnswers([{ ar: "", lat: "orphan" }]), { ar: "", lat: "" });
});

test("the rows an editor opens on are never none", () => {
  assert.deepEqual(answerRows({}), [{ ar: "", lat: "" }]);
  assert.deepEqual(answerRows({ ar: "one / two", lat: "one-said" }), [
    { ar: "one", lat: "one-said" },
    { ar: "two", lat: "" },
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
  const one = withAnswer(two(), saidAnswers(two())[1]);
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
  const turn = (f, n) => answerForTurn(f, n) || { ar: "", lat: "" };
  assert.equal(turn(form, 0).ar, "kitaab-script");
  assert.equal(turn(form, 1).ar, "safar-script");
  assert.equal(turn(form, 2).ar, "kitaab-script", "and round again");
  assert.equal(turn(form, 1).lat, "safar", "each with its own");

  /* An answer with no transliteration is not in the rotation: there is no
     question to ask about how it sounds. */
  const half = { ar: "one / two", lat: " / two-said" };
  assert.equal(turn(half, 0).ar, "two");
  assert.equal(turn(half, 1).ar, "two");
  assert.equal(answerForTurn({ ar: "one", lat: "" }), null, "and a card with none asks nothing");
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
