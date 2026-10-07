/*
 * One card per meaning: which cards share a side, and what a question
 * says about it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  answersAlike,
  clueFor,
  leavesWordToSibling,
  onlyAboutWord,
  siblingAnswerNote,
  siblingIndexOf,
  siblingsOf,
  sideOf,
  wordKey,
} from "../src/meanings.ts";

/**
 * @param {string} id @param {string} ar @param {string} en
 * @param {Record<string, any>} [extra]
 * @returns {any}
 */
const card = (id, ar, en, extra = {}) => ({
  id,
  lang: "ar-PS",
  tags: [],
  forms: [{ id: `${id}-f`, ar, en, lat: "" }],
  created: 1,
  ...extra,
});
const langOf = (/** @type {any} */ c) => c.lang;
const unit = (/** @type {any} */ c) => c.forms[0];

const cactus = card("cactus", "صَبِر", "cactus", { created: 1 });
const patience = card("patience", "صَبِر", "patience", { created: 2 });
const sahh = card("sahh", "صح", "right / correct");
const yamin = card("yamin", "يمين", "right");
const kitab = card("kitab", "كتاب", "book");

test("a card sharing the word is a sibling when the word is shown, not the meaning", () => {
  const index = siblingIndexOf([cactus, patience, kitab], langOf);
  const word = siblingsOf(index, cactus, unit(cactus), "word", "ar-PS");
  assert.deepEqual(word.map((s) => s.card.id), ["patience"]);
  assert.deepEqual(siblingsOf(index, cactus, unit(cactus), "meaning", "ar-PS"), []);
});

test("a card sharing one accepted meaning is a sibling when the meaning is shown", () => {
  const index = siblingIndexOf([sahh, yamin, kitab], langOf);
  assert.deepEqual(siblingsOf(index, yamin, unit(yamin), "meaning", "ar-PS").map((s) => s.card.id), ["sahh"]);
  assert.deepEqual(siblingsOf(index, sahh, unit(sahh), "meaning", "ar-PS").map((s) => s.card.id), ["yamin"]);
  assert.deepEqual(siblingsOf(index, yamin, unit(yamin), "word", "ar-PS"), []);
});

test("only cards in play count: another language, a value, a switched-off form", () => {
  const hebrew = card("he", "ימין", "right", { lang: "he" });
  const value = card("val", "يمين", "right", { drill: false });
  const off = card("off", "شمال", "right");
  off.forms[0].ask = false;
  const index = siblingIndexOf([yamin, hebrew, value, off], langOf);
  assert.deepEqual(siblingsOf(index, yamin, unit(yamin), "meaning", "ar-PS"), []);
});

test("a card studied alone has no siblings, so nothing changes", () => {
  const index = siblingIndexOf([cactus, kitab], langOf);
  assert.deepEqual(siblingsOf(index, cactus, unit(cactus), "word", "ar-PS"), []);
  assert.equal(clueFor(cactus, [], "en"), "");
});

test("another form of the same card is never its sibling", () => {
  const twoForms = card("t", "معلم", "teacher");
  twoForms.forms.push({ id: "t-2", ar: "معلمة", en: "teacher", lat: "" });
  const index = siblingIndexOf([twoForms], langOf);
  assert.deepEqual(siblingsOf(index, twoForms, twoForms.forms[0], "meaning", "ar-PS"), []);
});

test("vowel marks tell words apart; spacing and end punctuation do not", () => {
  assert.notEqual(wordKey("صَبْر"), wordKey("صَبِر"));
  assert.equal(wordKey(" صح! "), wordKey("صح"));
});

test("the clue is the teacher's when written, otherwise the other answers ruled out", () => {
  const index = siblingIndexOf([cactus, patience], langOf);
  const sibs = siblingsOf(index, cactus, unit(cactus), "word", "ar-PS");
  assert.equal(clueFor(cactus, sibs, "en"), "not patience");
  assert.equal(clueFor({ ...cactus, clue: "the plant" }, sibs, "en"), "the plant");
  const meaningSibs = siblingsOf(siblingIndexOf([sahh, yamin], langOf), yamin, unit(yamin), "meaning", "ar-PS");
  assert.equal(clueFor(yamin, meaningSibs, "ar"), "not صح");
});

test("a sibling answered the same way is no ambiguity", () => {
  const a = { id: "a", ar: "صَبِر", en: "cactus", lat: "sabir" };
  const b = { id: "b", ar: "صَبِر", en: "patience", lat: "sabir" };
  assert.equal(answersAlike(a, b, "lat"), true);
  assert.equal(answersAlike(a, b, "en"), false);
});

test("which side a prompt shows", () => {
  assert.equal(sideOf("ar"), "word");
  assert.equal(sideOf("audio"), "word");
  assert.equal(sideOf("en"), "meaning");
  assert.equal(sideOf("images"), null);
  assert.equal(sideOf("context"), null);
});

test("questions only about the word are left to the card made first", () => {
  const index = siblingIndexOf([cactus, patience], langOf);
  assert.equal(leavesWordToSibling(index, cactus, unit(cactus), "ar-PS"), false);
  assert.equal(leavesWordToSibling(index, patience, unit(patience), "ar-PS"), true);
  assert.equal(onlyAboutWord({ promptField: "ar", answerField: "lat" }), true);
  assert.equal(onlyAboutWord({ promptField: "audio", answerField: "ar" }), true);
  assert.equal(onlyAboutWord({ promptField: "ar", answerField: "en" }), false);
  assert.equal(onlyAboutWord({ promptField: "en", answerField: "ar" }), false);
});

test("the note for giving the other card's answer", () => {
  assert.equal(
    siblingAnswerNote("word", { card: patience, unit: unit(patience) }, "en"),
    "Yes, it also means “patience”. Now the other meaning.",
  );
  assert.equal(siblingAnswerNote("meaning", { card: sahh, unit: unit(sahh) }, "ar"), "Yes, صح means that too. Now the other one.");
});
