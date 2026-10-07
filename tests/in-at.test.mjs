/*
 * In and at, in Palestinian: في and بـ.
 *
 * بالشغل is what people say for "at work", في الشغل is what a textbook
 * writes, and فالشغل is the first written the way it sounds. A learner who
 * writes any of them has written the dialect. What is not accepted is the
 * swap where the two prepositions mean different things — بـ as *by*, في as
 * *there is* — or where the question was a recording of one of them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { alsoAcceptedInAt, checkAnswer, meansPlace, taughtInAt, trTaughtInAt } from "../src/languages.ts";

const PS = { language: "ar-PS" };
/** @param {string} ar @param {string} en @param {string} [lat] */
const card = (ar, en, lat) => ({ id: "c", ar, en, lat });
/** @param {string} typed @param {Record<string, any>} item @param {string} type @param {Record<string, any>} [settings] */
const ok = (typed, item, type, settings = PS) => checkAnswer(typed, item, type, settings).ok;

test("في before the article is also met by فالـ and بالـ", () => {
  const atWork = card("في الشغل", "at work");
  assert.equal(ok("في الشغل", atWork, "en2ar"), true);
  assert.equal(ok("فالشغل", atWork, "en2ar"), true);
  assert.equal(ok("ف الشغل", atWork, "en2ar"), true);
  assert.equal(ok("بالشغل", atWork, "en2ar"), true);
  assert.equal(ok("ب الشغل", atWork, "en2ar"), true);
});

test("a card written with بالـ is met by في when it means a place", () => {
  const atWork = card("بالشغل", "at work");
  assert.equal(ok("في الشغل", atWork, "en2ar"), true);
  assert.equal(ok("فالشغل", atWork, "en2ar"), true);
});

test("بـ meaning by or with is not swapped for في", () => {
  assert.equal(ok("في السيارة", card("بالسيارة", "by car"), "en2ar"), false);
});

test("في meaning there is is not swapped for بـ", () => {
  assert.equal(ok("بناس", card("في ناس", "there are people"), "en2ar"), false);
});

test("بـ on a word without the article needs the meaning to say it is a place", () => {
  assert.equal(ok("ببيتي", card("في بيتي", "in my house"), "en2ar"), true);
  assert.equal(ok("ببيتي", card("في بيتي", ""), "en2ar"), false);
});

test("فالـ on a card is left alone: it is as often so, the", () => {
  assert.equal(ok("في الولد", card("فالولد", "so the boy"), "en2ar"), false);
});

test("inside a phrase, and with the harakat", () => {
  assert.equal(ok("أنا بالبيت", card("أنا في البيت", "I'm at home"), "en2ar"), true);
  assert.equal(ok("بِالبَيْت", card("فِي البَيْت", "at home"), "en2ar"), true);
  assert.equal(ok("فِي البَيْت", card("بِالبَيْت", "at home"), "en2ar"), true);
});

test("a recording is written down as it was said: the spelling, not the other preposition", () => {
  const atWork = card("في الشغل", "at work");
  assert.equal(ok("فالشغل", atWork, "rec2ar"), true);
  assert.equal(ok("بالشغل", atWork, "rec2ar"), false);
});

test("the romanisation takes bi for fi, and keeps the sun letter", () => {
  const atWork = card("في الشغل", "at work", "fi sh-shughl");
  assert.equal(ok("fish-shughl", atWork, "ar2tr"), true);
  assert.equal(ok("bish-shughl", atWork, "ar2tr"), true);
  assert.equal(ok("bi sh-shughl", atWork, "ar2tr"), true);
  assert.equal(ok("fil-shughl", atWork, "ar2tr"), false);
  assert.equal(ok("bil-bet", card("في البيت", "at home", "fi l-bet"), "ar2tr"), true);
  assert.equal(ok("fish-shughl", card("بالشغل", "at work", "bish-shughl"), "ar2tr"), true);
  assert.equal(ok("bi nas", card("في ناس", "there are people", "fi nas"), "ar2tr"), false);
});

test("other languages are marked as they were", () => {
  assert.equal(ok("bi", card("fi", "in"), "en2ar", { language: "vi-Hue" }), false);
});

test("what reads as a place", () => {
  assert.equal(meansPlace("at work"), true);
  assert.equal(meansPlace("in the house"), true);
  assert.equal(meansPlace("by car"), false);
  assert.equal(meansPlace("there are people in the house"), false);
  assert.equal(meansPlace(""), null);
});

test("written with في where people say بـ: right, with the everyday form beside it", () => {
  const r = checkAnswer("أنا في الشغل", card("أنا بالشغل", "I'm at work"), "en2ar", PS);
  assert.equal(r.ok, true);
  assert.equal(r.usual, "أنا بالشغل");
  assert.equal(checkAnswer("أنا بالشغل", card("أنا بالشغل", "I'm at work"), "en2ar", PS).usual, undefined);
  assert.equal(checkAnswer("fi sh-shughl", card("بالشغل", "at work", "bish-shughl"), "ar2tr", PS).usual, "bi sh-shughl");
  /* Not where it was heard: the recording said في. */
  assert.equal(checkAnswer("في الشغل", card("في الشغل", "at work"), "rec2ar", PS).usual, undefined);
});

test("what is taught: بـ before the article where the card means a place", () => {
  assert.deepEqual(taughtInAt({ ar: "أنا في الشغل", lat: "ana fi sh-shughl", en: "I'm at work" }), {
    ar: "أنا بالشغل",
    lat: "ana bi sh-shughl",
  });
  assert.equal(trTaughtInAt("fiš-šuġl"), "biš-šuġl");
  assert.equal(trTaughtInAt("fil-bēt"), "bil-bēt");
  assert.equal(trTaughtInAt("Fi l-bēt"), "Bi l-bēt");
  assert.equal(trTaughtInAt("fi nās"), "fi nās");
  assert.equal(taughtInAt({ ar: "في بيتي", en: "in my house" }), null);
  assert.equal(taughtInAt({ ar: "في ناس", en: "there are people" }), null);
  assert.equal(taughtInAt({ ar: "في الشغل", en: "" }), null);
});

test("a question showing the taught form still takes the card's own wording", () => {
  const shown = { ...card("بالشغل", "at work"), taughtFrom: { ar: "في الشغل", lat: "" } };
  assert.equal(ok("في الشغل", shown, "en2ar"), true);
});

test("the teacher's lists put the other versions under the sentence", () => {
  assert.deepEqual(alsoAcceptedInAt("أنا بالشغل", "I'm at work"), ["أنا في الشغل", "أنا فالشغل"]);
  assert.deepEqual(alsoAcceptedInAt("بالسيارة", "by car"), []);
});
