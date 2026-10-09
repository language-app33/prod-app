/*
 * "Keeps its capital letters" (0.411): the tick on a card, the verb's and
 * the pronoun's *I* kept by their column, and the one-time tick on the
 * cards the old list of words caught.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { subtypeTakesCapitals, takesCapitals, tickCapitals } from "../src/capitals.ts";
import { fillText, lentBy, SPEAKER_COLUMNS, valueOf } from "../src/variables.ts";
import { aboutPersons, LANGUAGES, verbOf } from "../src/languages.ts";
import { personsOf } from "../src/verbs.ts";

const word = (/** @type {string} */ en, /** @type {Record<string, any>} */ more = {}) => ({ id: "w", lang: "vi-Hue", forms: [{ ar: "x", lat: "", en }], ...more });

test("the tick is offered on words, and not on names, verbs and the like", () => {
  for (const kind of ["noun", "adjective", "other", "pronoun", ""]) assert.ok(subtypeTakesCapitals(kind), kind);
  for (const kind of ["person", "place", "name", "number", "verb", "preposition", "demonstrative"]) {
    assert.ok(!subtypeTakesCapitals(kind), kind);
  }
  assert.ok(takesCapitals(word("Monday", { category: "noun" })));
  assert.ok(!takesCapitals({ id: "s", sentence: true, forms: [{ ar: "x {{noun}}", en: "x {{noun}}", lat: "" }] }));
});

test("a ticked card keeps its capitals in a sentence; an unticked one does not", () => {
  const monday = word("on Monday", { category: "other", capitals: true });
  assert.equal(valueOf(monday).keepsCase, true);
  assert.equal(fillText("See you {{word}}", { word: valueOf(monday) }, "en"), "See you on Monday");
  const plain = word("on Monday", { category: "other" });
  assert.equal(fillText("See you {{word}}", { word: valueOf(plain) }, "en"), "See you on monday");
  /* Every form of a ticked card, not only its own word. */
  const two = { ...monday, forms: [{ ar: "x", lat: "", en: "Arabic" }, { id: "f1", ar: "y", lat: "", en: "Arabic" }] };
  assert.ok(lentBy(two).every((l) => l.value.keepsCase));
});

test("a verb's I keeps its capital by its column, with no tick", () => {
  const cell = (/** @type {string} */ col, /** @type {string} */ en) => ({ id: `e-${col}`, row: "present", col, ar: col, en, lat: "" });
  const eat = {
    id: "eat", lang: "ar-PS", category: "verb",
    forms: [{ ar: "أكل", en: "to eat", lat: "" }, cell("i", "I eat"), cell("i-f", "I eat"), cell("he", "He eats")],
  };
  const said = Object.fromEntries(lentBy(eat).map((l) => [l.form.col || "own", fillText("Every day {{verb}}", { verb: l.value }, "en")]));
  assert.equal(said.i, "Every day I eat");
  assert.equal(said["i-f"], "Every day I eat");
  assert.equal(said.he, "Every day he eats", "any other column is cased as usual");
});

test("the pronoun I the Pronouns screen wrote keeps its capital, and is not offered the tick", () => {
  const ana = { id: "p-i", lang: "ar-PS", category: "pronoun", person: "i", forms: [{ ar: "أنا", en: "I", lat: "ana" }] };
  assert.equal(fillText("Today {{pronoun}} am here", { pronoun: valueOf(ana) }, "en"), "Today I am here");
  assert.equal(tickCapitals(ana), null);
});

test("an adjective said about I reads I am, mid-sentence", () => {
  const ar = LANGUAGES["ar-PS"];
  const tired = { id: "t", lang: "ar-PS", category: "adjective", forms: [{ ar: "تعبان", en: "Tired", lat: "" }] };
  const values = aboutPersons(ar, tired, valueOf(tired));
  const lines = values.map((v) => fillText("Today {{adjective-is}}", { "adjective-is": v }, "en"));
  assert.ok(lines.some((l) => l.includes("I am tired")), lines.join(" | "));
  assert.ok(lines.every((l) => !/\bi am\b/.test(l) && !/Tired/.test(l)), lines.join(" | "));
});

test("the speaker's columns are the ones every language calls I", () => {
  for (const lang of Object.values(LANGUAGES)) {
    for (const p of personsOf(verbOf(lang))) {
      const isI = /^I\b/.test(p.label);
      assert.equal(SPEAKER_COLUMNS.has(p.id), isI, `${lang.id}: ${p.id} (${p.label})`);
    }
  }
});

test("the one-time tick catches what the old list kept, and nothing else", () => {
  assert.equal(tickCapitals(word("Monday", { category: "noun" }))?.capitals, true);
  assert.equal(tickCapitals(word("I'm fine", { category: "other" }))?.capitals, true);
  assert.equal(tickCapitals(word("Arabic coffee", { category: "noun" }))?.capitals, true);
  assert.equal(tickCapitals(word("I am hot", { category: "adjective" }))?.capitals, true);
  assert.equal(tickCapitals(word("Coffee", { category: "noun" })), null, "not a word the list named");
  assert.equal(tickCapitals(word("monday", { category: "noun" })), null, "typed small: a tick would change nothing");
  assert.equal(tickCapitals(word("Monday", { category: "verb" })), null, "a verb is not offered the tick");
  assert.equal(tickCapitals(word("Monday", { category: "noun", capitals: false })), null, "a no stays a no");
  const once = tickCapitals(word("Monday", { category: "noun" }));
  assert.equal(tickCapitals(once), null, "the second time changes nothing");
});
