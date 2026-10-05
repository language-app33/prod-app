// @ts-check
/*
 * An answer that is a number in figures, and nothing else.
 *
 * Two things follow from it and both are held here: the answer box asks a
 * phone for its number pad, and the answer is marked as a number — exact
 * or wrong, with the notation forgiven — rather than as an English word,
 * where a comma is two answers and one letter out is a typo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { answersInFigures, checkAnswer, numeralMeanings } from "../src/languages.ts";

const SETTINGS = { language: "ar-PS" };
const meaning = (/** @type {string} */ en) => ({ ar: "x", en });
const mark = (/** @type {string} */ typed, /** @type {string} */ en, key = "ar2en") => checkAnswer(typed, meaning(en), key, SETTINGS);

test("the number pad comes up where the answer is figures and nothing else", () => {
  assert.equal(answersInFigures(meaning(""), "num2fig"), true, "write the number in figures");
  assert.equal(answersInFigures(meaning(""), "rec2fig"), true, "listen, then write it in figures");
  for (const en of ["5", "40", "1,000", "1,000,000", "10384", "5 / 6"]) {
    assert.equal(answersInFigures(meaning(en), "ar2en"), true, `the meaning ${en}`);
    assert.equal(answersInFigures(meaning(en), "rec2en"), true, `the meaning ${en}, heard`);
  }
});

test("and nowhere else", () => {
  /* Any word among the meanings means letters can answer it. */
  for (const en of ["five", "five / 5", "3 books", "hundred", "1, 2", ""]) {
    assert.equal(answersInFigures(meaning(en), "ar2en"), false, `the meaning ${JSON.stringify(en)}`);
  }
  /* A time has a colon, and a number pad has none. */
  assert.equal(answersInFigures({ ar: "x", en: "7:15" }, "time2fig"), false);
  /* An answer in the script is a word in the language, whatever it means. */
  assert.equal(answersInFigures(meaning("5"), "en2ar"), false);
  assert.equal(answersInFigures(meaning("5"), "ar2pick"), false, "nothing is typed");
  assert.equal(answersInFigures(null, "num2fig"), false);
});

test("a comma in a number is grouping, not a second answer", () => {
  assert.deepEqual(numeralMeanings("1,000,000"), ["1,000,000"]);
  assert.equal(mark("1", "1,000").ok, false, "1 is not the word for a thousand");
  assert.equal(mark("000", "1,000").ok, false);
  assert.equal(mark("2", "2,000").ok, false);
  for (const typed of ["1000", "1,000", "1 000", "1.000", "١٠٠٠", "01000"]) {
    assert.equal(mark(typed, "1,000").ok, true, `${typed} is a thousand`);
  }
});

test("a number one figure out is another number, not a typo and not nearly", () => {
  assert.deepEqual(mark("3000", "2,000"), { ok: false, reason: "wrong" });
  assert.deepEqual(mark("1001", "1,000"), { ok: false, reason: "wrong" });
  assert.deepEqual(mark("10385", "10384"), { ok: false, reason: "wrong" });
  assert.deepEqual(mark("7", "8"), { ok: false, reason: "wrong" }, "not 'very close'");
  assert.deepEqual(mark("4", "40"), { ok: false, reason: "wrong" });
  assert.deepEqual(mark("8", "8"), { ok: true, reason: "exact" });
  assert.equal(mark("6", "5 / 6").ok, true, "either of two numbers");
  assert.equal(mark("eight", "8").ok, false, "a number asked for in figures");
});

test("a meaning in words is marked as English, as before", () => {
  assert.equal(mark("tiref", "tired").ok, true, "one letter out of a word is a slip");
  assert.equal(mark("five", "five / 5").ok, true);
  assert.equal(mark("5", "five / 5").ok, true);
});
