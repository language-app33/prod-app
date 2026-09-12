/*
 * A hole in a card, and the cards that fill it.
 *
 * "My name is Raphael" learnt as one lump is a sentence somebody can say
 * once; the same frame met as Raphael, then Victor, then Sarah is a
 * sentence they can say about anyone. What is checked here is that the
 * substitution keeps its promises: the same value in every field of one
 * question, a different one next time round, and nothing drawn at random.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fillForm,
  fillText,
  hasSlots,
  slotTrouble,
  slotsIn,
  slotsOf,
  valueOf,
  valuesFor,
  valuesForTurn,
} from "../src/variables.ts";
import { canAsk, unmetNeeds } from "../src/offers.ts";
import { EX, LANGUAGES, needLabel } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];

/* The worked example, in the Latin alphabet for the same reason every other
   test is: what is being checked is the substitution, not the script. */
/** @returns {any} */
const frame = () => ({
  id: "p1",
  ar: "ismi {{name}}",
  en: "My name is {{name}}",
  lat: "ismi {{name}}",
  recs: [],
  s: {},
});
/** @param {string} id @param {string} en @returns {any} */
const value = (id, en) => ({ id, fills: "name", ar: `${en}-script`, en, lat: en.toLowerCase() });

test("a card names the variables it leaves open, once each", () => {
  assert.deepEqual(slotsIn("My name is {{name}}"), ["name"]);
  assert.deepEqual(slotsIn("{{name}} and {{name}}"), ["name"], "one hole filled twice");
  assert.deepEqual(slotsIn("{{a}} meets {{b}}"), ["a", "b"]);
  assert.deepEqual(slotsIn("nothing here"), []);
  /* Folded, so a keyboard that capitalises the first letter of a line does
     not quietly make a second variable that looks like the first. */
  assert.deepEqual(slotsIn("{{Name}}"), ["name"]);
  assert.deepEqual(slotsIn("{{ name }}"), ["name"], "spaces will happen");
  /* Not a template language: anything past a name is not a hole. */
  assert.deepEqual(slotsIn("{{name|upper}}"), []);
  assert.deepEqual(slotsIn("{name}"), []);
  assert.deepEqual(slotsOf(frame()), ["name"]);
  assert.equal(hasSlots(frame()), true);
  assert.equal(hasSlots({ ar: "bayt", en: "house" }), false);
});

test("every field with words in it leaves the same holes", () => {
  /* The failure this catches: a frame whose English has a hole and whose
     script has not is a question that asks for a name and marks an answer
     that never contained one. */
  assert.equal(slotTrouble(frame()), null);
  const half = { ...frame(), ar: "ismi" };
  assert.deepEqual(slotTrouble(half), { field: "ar", missing: ["name"], extra: [] });
  /* A field nobody filled in is not disagreeing — a card with no
     transliteration is an ordinary card, not a broken one. */
  assert.equal(slotTrouble({ ...frame(), lat: "" }), null);
  /* And a field with a hole of its own that nothing else has. */
  const odd = { ...frame(), lat: "ismi {{name}} {{age}}" };
  assert.deepEqual(slotTrouble(odd), { field: "ar", missing: ["age"], extra: [] });
  assert.equal(slotTrouble({ ar: "bayt", en: "house" }), null, "no holes, no trouble");
});

test("what can fill a hole is a card that says so, in the same language", () => {
  const pool = [
    { ...value("v1", "Raphael"), lang: "ar-PS" },
    { ...value("v2", "Victor"), lang: "ar-PS" },
    /* A Vietnamese name in an Arabic frame is not a variation on the
       sentence, it is a different sentence. */
    { ...value("v3", "Sarah"), lang: "vi-HUE" },
    /* An ordinary card fills nothing, whatever it says. */
    { id: "w1", ar: "bayt", en: "house", lang: "ar-PS" },
    /* And a value with no word in it would fill the hole with nothing. */
    { id: "v4", fills: "name", ar: "", en: "Blank", lang: "ar-PS" },
  ];
  const found = valuesFor(frame(), pool, "ar-PS");
  assert.deepEqual(Object.keys(found), ["name"]);
  assert.deepEqual(found.name.map((v) => v.en), ["Raphael", "Victor"]);
  /* A card with no holes asks for nothing. */
  assert.deepEqual(valuesFor({ ar: "bayt", en: "house" }, pool, "ar-PS"), {});
});

test("a value lends its first accepted answer, not the whole field", () => {
  /* A value card may accept two spellings, and "kitaab / safar" dropped
     whole into a sentence is not a sentence. */
  const two = { id: "v9", fills: "name", ar: "raafi / rafa", en: "Raphael", lat: "raafi / rafa" };
  assert.deepEqual(valueOf(two), { id: "v9", ar: "raafi", en: "Raphael", lat: "raafi" });
});

test("one value per question, in every field at once", () => {
  const took = { name: { id: "v1", ar: "Raphael-script", en: "Raphael", lat: "raphael" } };
  const filled = fillForm(frame(), took);
  assert.equal(filled.ar, "ismi Raphael-script");
  assert.equal(filled.en, "My name is Raphael");
  assert.equal(filled.lat, "ismi raphael");
  assert.equal(filled.id, "p1", "everything else about the card travels with it");
  /* Which value it took, for anything that has to say so. */
  assert.deepEqual(filled.filled, { name: "v1" });

  /* The accepted answers are written from `ar` and would otherwise still
     hold the frame — which answersOf prefers where the two agree, so a
     stale one would mark the question against "ismi {{name}}". */
  const withAnswers = { ...frame(), answers: [{ text: "ismi {{name}}", lat: "ismi {{name}}" }] };
  assert.deepEqual(fillForm(withAnswers, took).answers, [
    { text: "ismi Raphael-script", lat: "ismi raphael" },
  ]);

  /* A hole nobody offered a value for is left standing rather than blanked:
     a visible {{name}} is a bug report, a silent gap is a mystery. */
  assert.equal(fillText("My name is {{name}}", {}, "en"), "My name is {{name}}");
  assert.equal(fillForm(frame(), null).en, "My name is {{name}}");
});

test("a card with two names is met as both, one at a time", () => {
  /* Rotated by how often the exercise has been asked, like the phrase a
     word is shown in and the accepted answer a pronunciation question is
     about: nothing is drawn, so the same count is the same sentence and a
     re-render cannot swap the name under somebody mid-answer. */
  const have = { name: [value("v1", "Raphael"), value("v2", "Victor"), value("v3", "Sarah")].map((v) => valueOf(v)) };
  const at = (/** @type {number} */ n) => (valuesForTurn(["name"], have, n) || { name: value("", "") }).name.en;
  assert.equal(at(0), "Raphael");
  assert.equal(at(1), "Victor");
  assert.equal(at(2), "Sarah");
  assert.equal(at(3), "Raphael", "and round again");
  assert.equal(at(-2), "Sarah", "however the count arrives");

  /* Two holes turn like an odometer rather than in lockstep: with two
     variables of two values each, sharing an index would only ever show two
     of the four sentences the card can make. */
  const pair = {
    who: [valueOf(value("a", "Ann")), valueOf(value("b", "Ben"))],
    what: [valueOf({ ...value("c", "tea"), fills: "what" }), valueOf({ ...value("d", "milk"), fills: "what" })],
  };
  const seen = [0, 1, 2, 3].map((n) => {
    const took = valuesForTurn(["who", "what"], pair, n) || {};
    return `${(took.who || {}).en} ${(took.what || {}).en}`;
  });
  assert.deepEqual(seen, ["Ann tea", "Ben tea", "Ann milk", "Ben milk"]);
  assert.equal(new Set(seen).size, 4, "every combination before any repeat");

  /* Nothing at all where a hole has nothing to put in it. */
  assert.equal(valuesForTurn(["name"], { name: [] }, 0), null);
  assert.equal(valuesForTurn(["name"], {}, 0), null);
});

test("a hole with nothing in it is not a question, and says which hole", () => {
  const empty = unmetNeeds(frame(), EX.ar2en, null, [], { name: [] });
  assert.deepEqual(empty, ["fills:name"]);
  assert.equal(
    canAsk({ unit: frame(), scene: null, contexts: [], values: { name: [] } }, "ar2en", ar),
    false
  );
  /* Named, because "a card that fills {{name}}" is a job somebody can go
     and do where "a value" is a riddle. */
  assert.match(needLabel("fills:name", ar), /\{\{name\}\}/);
  assert.match(needLabel("fills:name,age", ar), /\{\{name\}\} and \{\{age\}\}/);

  /* And with something to put in it, the ordinary exercises come back. */
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(frame(), EX.ar2en, null, [], have), []);
  assert.equal(canAsk({ unit: frame(), scene: null, contexts: [], values: have }, "ar2en", ar), true);
  assert.equal(canAsk({ unit: frame(), scene: null, contexts: [], values: have }, "en2ar", ar), true);
});

test("a frame is not one of the words in a matching grid", () => {
  /* The grid puts five words up at once and only narrows the one being
     asked, so a frame standing in the company would show the hole it left
     open. It is refused for the same reason a recording is, and says so. */
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(frame(), EX.match, null, [], have, 99), ["fixed"]);
  assert.equal(
    canAsk({ unit: frame(), scene: null, contexts: [], values: have, mates: 99 }, "match", ar),
    false
  );
  /* An ordinary word with company is asked it. */
  const word = { id: "w1", ar: "bayt", en: "house", lat: "beit", recs: [], s: {} };
  assert.deepEqual(unmetNeeds(word, EX.match, null, [], {}, 99), []);
  assert.equal(canAsk({ unit: word, scene: null, contexts: [], mates: 99 }, "match", ar), true);
  /* And a word with nobody to stand beside it is not: the question is the
     company it keeps. */
  assert.deepEqual(unmetNeeds(word, EX.match, null, [], {}, 0), ["mates"]);
});

test("a card whose words change cannot be the one on a recording", () => {
  /* The cost of the feature, and it is reported rather than quietly
     dropped: a teacher who writes a variable into a card with four
     recordings on it should be told where the listening exercises went. */
  const heard = { ...frame(), recs: [{ id: "a".repeat(64) }] };
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(heard, EX.rec2en, null, [], have), ["fixed"]);
  assert.equal(canAsk({ unit: heard, scene: null, contexts: [], values: have }, "rec2en", ar), false);
  assert.match(needLabel("fixed", ar), /recording/);

  /* The same card, without the hole, is asked by ear as it always was. */
  const fixed = { ...heard, ar: "ismi rafa", en: "My name is Raphael", lat: "ismi rafa" };
  assert.deepEqual(unmetNeeds(fixed, EX.rec2en, null, [], {}), []);
  assert.equal(canAsk({ unit: fixed, scene: null, contexts: [], values: {} }, "rec2en", ar), true);
});
