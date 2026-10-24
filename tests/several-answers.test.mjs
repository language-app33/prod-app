// @ts-check
/*
 * A word or a sentence with more than one accepted answer, wherever the
 * app looks for a word inside a sentence; and a word the teacher said is a
 * word, though it has a space in it. See docs/AUDIT-what-teachers-can-make.md,
 * findings 4 and 5, and the owner's answers to them in 0.468.
 *
 * Several answers are kept in one text with a separator between them (see
 * answers.ts). Read whole, that text is one long "word" found in no
 * sentence: a card accepting تمام or منيح was never practised inside one,
 * never offered under "Words this teaches", and listed as in no phrase.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

import { buildContextIndex, wordsOffered } from "../src/context-index.ts";
import { linkReport, unknownWords } from "../src/context-links.ts";
import { sentenceWords } from "../src/sentence-words.ts";
import { LANGUAGES, checkAnswer, contextCoverage } from "../src/languages.ts";
import { ALT_SEP } from "../src/answers.ts";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];

/** @param {string[]} xs */
const two = (...xs) => xs.join(ALT_SEP);

const fine = { id: "fine", lang: "ar-PS", category: "adjective", created: 1,
  forms: [{ id: "fine", ar: two("تمام", "منيح"), en: "fine", lat: two("tamaam", "mniih") }] };
/** @param {string} id @param {string} said @param {string[]} [uses] @returns {any} */
const sentence = (id, said, uses = []) => ({ id, lang: "ar-PS", uses, created: 2, forms: [{ id, ar: said, en: id, lat: "" }] });
const imFine = sentence("s1", "أنا تمام", ["fine"]);
const allWell = sentence("s2", "كلشي منيح هون", ["fine"]);

/* A Vietnamese noun of two syllables, which the teacher said is a noun. */
const coffee = { id: "coffee", lang: "vi-Hue", category: "noun", created: 1, forms: [{ id: "coffee", ar: "cà phê", en: "coffee", lat: "" }] };
const drink = { id: "drink", lang: "vi-Hue", uses: ["coffee"], created: 2, forms: [{ id: "drink", ar: "tôi uống cà phê", en: "I drink coffee", lat: "" }] };

/* ---- the gap-fill ---- */

test("the gap-fill finds a word by each of its answers, and says which one the sentence holds", () => {
  const index = buildContextIndex(/** @type {any} */ ([fine, imFine, allWell]), /** @type {any} */ (ar));
  const found = Object.fromEntries((index.get("fine") || []).map((c) => [c.id, [c.word, c.answer, c.slot]]));
  assert.deepEqual(found, { s1: ["تمام", 0, 1], s2: ["منيح", 1, 1] });
});

test("a sentence with two answers is shown as the one that holds the word", () => {
  const it = { id: "kollo", lang: "ar-PS", category: "pronoun", forms: [{ id: "kollo", ar: "كله", en: "all of it", lat: "" }] };
  const both = sentence("s3", two("كلشي تمام", "كله تمام"), ["kollo"]);
  const ctx = must((buildContextIndex(/** @type {any} */ ([it, both]), /** @type {any} */ (ar)).get("kollo") || [])[0], "the sentence");
  assert.equal(ctx.ar, "كله تمام");
  assert.equal(ctx.slot, 0);
  assert.equal(ctx.answer, undefined, "a word with one answer says nothing about which");
});

test("a word with one answer is found as it always was", () => {
  const book = { id: "book", lang: "ar-PS", category: "noun", forms: [{ id: "book", ar: "كتاب", en: "book", lat: "" }] };
  const ctx = must((buildContextIndex(/** @type {any} */ ([book, sentence("s", "عندي كتاب", ["book"])]), /** @type {any} */ (ar)).get("book") || [])[0], "the sentence");
  assert.deepEqual({ ...ctx }, { id: "s", ar: "عندي كتاب", en: "s", recs: [], slot: 1, span: 1, word: "كتاب" });
});

/* ---- the editor ---- */

test("Words this teaches offers a word by any of its answers, and a word the teacher called a word", () => {
  assert.deepEqual(wordsOffered("كلشي منيح هون", /** @type {any} */ ([fine]), /** @type {any} */ (ar)).map((o) => o.card.id), ["fine"]);
  assert.deepEqual(wordsOffered("tôi uống cà phê", /** @type {any} */ ([coffee]), /** @type {any} */ (vi)).map((o) => o.card.id), ["coffee"]);
  /* With no word type, a card is still guessed from its text: the question
     the owner has still to answer. */
  const unsaid = { id: "x", lang: "vi-Hue", forms: [{ id: "x", ar: "cà phê", en: "coffee", lat: "" }] };
  assert.deepEqual(wordsOffered("tôi uống cà phê", /** @type {any} */ ([unsaid]), /** @type {any} */ (vi)), []);
});

test("the editor's sentence check knows a word by any of its answers, and a word the teacher called a word", () => {
  const said = sentenceWords("أنا تمام", /** @type {any} */ ([fine]), /** @type {any} */ (ar));
  assert.deepEqual(said.hits.map((h) => h.card.id), ["fine"]);
  assert.ok(!said.bare.includes("تمام"), said.bare.join(", "));
  assert.deepEqual(sentenceWords("tôi uống cà phê", /** @type {any} */ ([coffee]), /** @type {any} */ (vi)).hits.map((h) => h.card.id), ["coffee"]);
});

/* ---- In context ---- */

test("the In context tab offers the link, and does not list the word as in no phrase", () => {
  const thanks = sentence("s4", "الحمد لله كلشي منيح هون");
  const report = linkReport([fine, thanks], /** @type {any} */ (ar));
  assert.deepEqual(report.toConfirm.map((p) => [p.container.id, p.word.id]), [["s4", "fine"]]);
  assert.deepEqual(report.bare, []);
  assert.ok(!unknownWords([fine, thanks], /** @type {any} */ (ar)).some((m) => m.forms.includes("منيح")));
});

test("a deck's own In context section counts them as the words they are", () => {
  const arabic = contextCoverage([fine, imFine], ar);
  assert.equal(arabic.counts.word, 1);
  assert.equal(arabic.covered, 1);
  const vietnamese = contextCoverage([coffee, drink], vi);
  assert.equal(vietnamese.counts.word, 1);
  assert.equal(vietnamese.covered, 1);
});

/* ---- the question, as the trainer asks it ---- */

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".several-answers-build");
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
const { installIndexes, pickContext, resolveQuestion } = await import(path.join(out, "trainer.js"));

const settings = { language: "ar-PS", strict: false, types: {}, kinds: {} };
const cards = [fine, imFine, allWell];

test("in a sentence, the only right answer is the one the sentence holds", () => {
  installIndexes(cards, settings);
  const typed = must(resolveQuestion(cards, { id: "fine", subId: null, type: "ctx2ar", ctx: "s1" }, false, []), "the question");
  assert.equal(typed.unit.ar, "تمام");
  assert.equal(checkAnswer("تمام", typed.unit, "ctx2ar", settings).ok, true);
  assert.equal(checkAnswer("منيح", typed.unit, "ctx2ar", settings).ok, false, "a word the sentence does not say");
  const other = must(resolveQuestion(cards, { id: "fine", subId: null, type: "ctx2ar", ctx: "s2" }, false, []), "the other sentence");
  assert.equal(other.unit.ar, "منيح");
  /* The choice asked about the second answer, in a sentence holding the
     first, is asked about the first: the sentence decides. */
  const chosen = must(resolveQuestion(cards, { id: "fine", subId: null, type: "ctx2pick@1", ctx: "s1" }, false, []), "the choice");
  assert.equal(chosen.unit.ar, "تمام");
});

test("a question not asked in a sentence still accepts every answer", () => {
  installIndexes(cards, settings);
  const r = must(resolveQuestion(cards, { id: "fine", subId: null, type: "en2ar" }, false, []), "the question");
  assert.equal(checkAnswer("تمام", r.unit, "en2ar", settings).ok, true);
  assert.equal(checkAnswer("منيح", r.unit, "en2ar", settings).ok, true);
});

test("a question about one answer is asked in a sentence holding that answer", () => {
  installIndexes(cards, settings);
  assert.equal(must(pickContext(fine.forms[0], "ctx2pick"), "the first answer's").id, "s1");
  assert.equal(must(pickContext(fine.forms[0], "ctx2pick@1"), "the second answer's").id, "s2");
  /* One accepted answer for every sentence: nothing to choose between. */
  installIndexes([fine, imFine], settings);
  assert.equal(must(pickContext(fine.forms[0], "ctx2pick@1"), "the only sentence").id, "s1");
});
