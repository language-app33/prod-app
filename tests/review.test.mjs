// @ts-check
/*
 * A teacher's review of the sentences a frame makes — see src/review.ts.
 *
 * Three things have to hold for the gate to mean anything, and each is a
 * test here:
 *
 *   * a sentence is named by exactly the words a student sees, so an edit
 *     to the frame or to a word that fills it makes a new, unapproved
 *     sentence and changes nothing else;
 *   * the teacher's list is the list a student is asked from, agreement
 *     and all — a review of different sentences is no review;
 *   * a student's device shows a reviewed card only in the sentences on
 *     its approved list, and a struck one never.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { must } from "./helpers.mjs";
import {
  cardSentences,
  holedParts,
  isSentenceKey,
  narrowed,
  passes,
  REVIEW_CEILING,
  reviewState,
  sentenceKey,
  sentencesOf,
  toReview,
} from "../src/review.ts";
import { LANGUAGES } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];

/* ---- what a sentence is called ---- */

test("a sentence is named by the three things a student sees, and nothing else", () => {
  const one = sentenceKey({ ar: "اسمي رامي", lat: "ismi Rami", en: "my name is Rami" });
  assert.ok(isSentenceKey(one), one);
  assert.equal(one, sentenceKey({ ar: " اسمي رامي ", lat: "ismi Rami", en: "my name is Rami " }),
    "space around a field is not a different sentence");
  assert.notEqual(one, sentenceKey({ ar: "اسمي سامي", lat: "ismi Rami", en: "my name is Rami" }),
    "another word in the script is");
  assert.notEqual(one, sentenceKey({ ar: "اسمي رامي", lat: "ismi Ramy", en: "my name is Rami" }),
    "and so is another way of saying it");
  assert.notEqual(one, sentenceKey({ ar: "اسمي رامي", lat: "ismi Rami", en: "I am Rami" }),
    "and another meaning");
});

test("a sentence is shown when it is approved and not struck; an unreviewed card shows everything", () => {
  const k = sentenceKey({ ar: "a" });
  assert.equal(passes(null, k), true, "a card never reviewed is asked as it always was");
  assert.equal(passes({ ok: [] }, k), false, "reviewed and not approved is not shown");
  assert.equal(passes({ ok: [k] }, k), true);
  assert.equal(passes({ ok: [k], no: [k] }, k), false, "struck wins over an older approval");
});

test("the parts of a card that are filled are its asked forms and turns with a blank", () => {
  const card = {
    id: "c",
    forms: [
      { id: "c", ar: "اسمي {{name}}", en: "my name is {{name}}" },
      { id: "q", ar: "بلا فراغ", en: "no blank" },
      { id: "r", ar: "{{name}} هون", en: "{{name}} is here", ask: false },
    ],
    lines: [{ id: "l1", ar: "مرحبا {{name}}", en: "hello {{name}}" }, { id: "l2", ar: "أهلين", en: "hi" }],
  };
  assert.deepEqual(holedParts(card).map((p) => p.id), ["c", "l1"]);
  assert.deepEqual(holedParts({ id: "w", forms: [{ ar: "باب", en: "door" }] }), []);
});

/* ---- the list the teacher reads is the list a student is asked from ---- */

const noun = (/** @type {string} */ id, /** @type {string} */ word, /** @type {string} */ en, /** @type {string} */ gender, created = 1) => ({
  id, lang: "ar-PS", category: "noun", created,
  forms: [{ id, ar: word, en, lat: en, number: "singular", gender, human: "thing" }],
});
const big = {
  id: "big", lang: "ar-PS", category: "adjective", created: 5,
  forms: [
    { id: "big", ar: "كبير", en: "big", lat: "kbiir" },
    { id: "big-f", ar: "كبيرة", en: "big", lat: "kbiire", row: "agreement", col: "feminine" },
  ],
};
const frame = {
  id: "f", lang: "ar-PS", sentence: true, created: 9,
  forms: [{ id: "f", ar: "{{noun}} {{adjective}}", en: "a {{adjective}} {{noun}}", lat: "{{noun}} {{adjective}}" }],
};

test("the teacher's list puts the agreeing form beside its noun, as the student is shown it", () => {
  const pool = [noun("house", "بيت", "house", "masculine", 1), noun("car", "سيارة", "car", "feminine", 2), big, frame];
  const [part] = cardSentences(frame, pool, ar);
  const said = part.list.map((s) => s.ar);
  assert.ok(said.includes("بيت كبير"), said.join(" | "));
  assert.ok(said.includes("سيارة كبيرة"), "the feminine beside a feminine noun, not the word as lent");
  assert.ok(!said.includes("سيارة كبير"), "which is the sentence the old preview listed and nobody is asked");
  const car = must(part.list.find((s) => s.ar === "سيارة كبيرة"), "the car sentence");
  assert.equal(car.lat, "car kbiire");
  assert.equal(car.en, "a big car");
  assert.equal(car.key, sentenceKey(car), "and each is named by what it says");
  assert.equal(car.took.noun.card, "car", "with the card behind each blank");
});

test("where a card stands: never reviewed, reviewed with sentences waiting, and too many to read", () => {
  const pool = [noun("house", "بيت", "house", "masculine", 1), noun("car", "سيارة", "car", "feminine", 2), big, frame];
  const legacy = reviewState(frame, pool, ar);
  assert.equal(legacy.kind, "legacy");
  assert.equal(legacy.sentences, 2);
  assert.ok(toReview(legacy), "a card from before review is on the list to go back to");

  const [part] = cardSentences(frame, pool, ar);
  const house = must(part.list.find((s) => s.ar === "بيت كبير"), "house");
  const half = reviewState({ ...frame, review: { ok: [house.key], no: [] } }, pool, ar);
  assert.deepEqual([half.kind, half.approved, half.struck, half.waiting], ["gated", 1, 0, 1]);
  assert.ok(toReview(half));

  const car = must(part.list.find((s) => s.ar === "سيارة كبيرة"), "car");
  const done = reviewState({ ...frame, review: { ok: [house.key], no: [car.key] } }, pool, ar);
  assert.deepEqual([done.approved, done.struck, done.waiting], [1, 1, 0]);
  assert.equal(toReview(done), false, "read and answered, so nothing waits");

  /* A word added to the collection makes a new sentence, which waits; the
     two already answered stay answered. */
  const more = [...pool, noun("room", "غرفة", "room", "feminine", 3)];
  const grown = reviewState({ ...frame, review: { ok: [house.key], no: [car.key] } }, more, ar);
  assert.deepEqual([grown.approved, grown.struck, grown.waiting], [1, 1, 1]);

  /* And a frame over the ceiling cannot be approved as it is. */
  const names = Array.from({ length: REVIEW_CEILING + 20 }, (_, i) => ({
    id: `n${i}`, lang: "ar-PS", fills: ["name"], drill: false, created: 10 + i,
    forms: [{ id: `n${i}`, ar: `اسم${i}`, en: `Name${i}`, lat: `Name${i}` }],
  }));
  const wide = { id: "w", lang: "ar-PS", sentence: true, forms: [{ id: "w", ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "" }] };
  const over = reviewState(wide, [...names, wide], ar);
  assert.equal(over.over, true);
  assert.equal(over.sentences, REVIEW_CEILING + 20);
});

test("a frame's sentences are walked once each, and a first page only past the walking limit", () => {
  const names = Array.from({ length: 30 }, (_, i) => ({
    id: `n${i}`, lang: "ar-PS", fills: ["name"], created: i,
    forms: [{ id: `n${i}`, ar: `اسم${i}`, en: `N${i}`, lat: "" }],
  }));
  const two = { id: "t", lang: "ar-PS", sentence: true,
    forms: [{ id: "t", ar: "{{name}} و {{name2}}", en: "{{name}} and {{name2}}", lat: "" }] };
  const pool = [...names.map((n) => ({ ...n, fills: ["name", "name2"] })), two];
  const walked = sentencesOf(two, two.forms[0], pool, ar, 100);
  assert.equal(walked.combos, 900);
  assert.equal(walked.cut, true, "more combinations than it will walk");
  assert.equal(walked.list.length, 100);
});

/* ---- narrowing a blank ---- */

test("narrowing renames the blank everywhere it is written and tags the words picked", () => {
  const card = {
    id: "f", lang: "ar-PS", sentence: true,
    forms: [
      { id: "f", ar: "أكلت {{noun}}", en: "I ate {{ noun }}", lat: "akalt {{noun}}", tenses: { noun: ["past"] } },
      { id: "g", ar: "بدي {{noun}}", en: "I want {{noun}}", lat: "" },
    ],
  };
  const bread = { id: "b", fills: "snack", forms: [{ ar: "خبز" }] };
  const apple = { id: "a", forms: [{ ar: "تفاحة" }] };
  const already = { id: "c", fills: ["food"], forms: [{ ar: "جبنة" }] };
  const done = must(narrowed(card, "noun", "food", [bread, apple, already]), "narrowed");
  assert.equal(done.frame.forms[0].ar, "أكلت {{food}}");
  assert.equal(done.frame.forms[0].en, "I ate {{food}}", "spaced braces too");
  assert.equal(done.frame.forms[1].ar, "بدي {{food}}", "and on every form of the card");
  assert.deepEqual(done.frame.forms[0].tenses, { food: ["past"] }, "the tenses the blank asked for move with it");
  assert.deepEqual(done.fillers.map((c) => [c.id, c.fills]), [["b", ["snack", "food"]], ["a", ["food"]]],
    "a card already in the group is left alone");
  assert.equal(narrowed(card, "noun", "noun", [bread]), null, "renaming to itself is nothing");
});

/* ---- the gate, on a student's device ---- */

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".review-build");
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
const { installIndexes, castQuestion } = await import(path.join(out, "trainer.js"));

const settings = { language: "ar-PS" };
const nameCard = (/** @type {string} */ id, /** @type {string} */ word, /** @type {string} */ en, /** @type {number} */ created) => ({
  id, lang: "ar-PS", kind: "word", tags: [], created, fills: ["name"], drill: false,
  forms: [{ id, ar: word, en, lat: en, lang: "ar-PS", s: {} }],
});
/** @param {Record<string, any>} [over] */
const sentenceItem = (over = {}) => ({
  id: "S", lang: "ar-PS", kind: "phrase", tags: [], created: 1, sentence: true,
  forms: [{
    id: "S", ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}", lang: "ar-PS", s: {},
    /* Every name already met at the top of the ladder, so none is held
       back by how far the learner has got — the gate under test is the
       teacher's, not the learner's. */
    met: { "name:n1": 9, "name:n2": 9, "name:n3": 9 },
  }],
  ...over,
});
const names = [nameCard("n1", "سامي", "Sami", 2), nameCard("n2", "رامي", "Rami", 3), nameCard("n3", "هادي", "Hadi", 4)];
const rami = sentenceKey({ ar: "اسمي رامي", lat: "ismi Rami", en: "my name is Rami" });
const ask = { id: "S", subId: null, type: "ar2en" };

/** @param {Record<string, any>} item */
function asked(item) {
  const items = [item, ...names];
  installIndexes(items, settings);
  return castQuestion(items, ask);
}

test("a card never reviewed is filled as it always was", () => {
  const unit = must(asked(sentenceItem()), "the question");
  assert.equal(unit.ar, "اسمي سامي", "the first name, on the first turn");
});

test("a reviewed card is filled only with a sentence the teacher approved", () => {
  const unit = must(asked(sentenceItem({ review: { ok: [rami] } })), "the question");
  assert.equal(unit.ar, "اسمي رامي", "the turn walks on to the approved sentence");
  assert.equal(unit.reviewKey, rami, "and the question carries its name, for a report about it");
});

test("a reviewed card with nothing approved, or only struck sentences, is not filled at all", () => {
  for (const review of [{ ok: [] }, { ok: [rami], no: [rami] }]) {
    const unit = must(asked(sentenceItem({ review })), "the question");
    assert.match(String(unit.ar), /\{\{name\}\}/, JSON.stringify(review));
  }
});

test("a teacher trying their own card out sees it whatever its review", () => {
  const item = sentenceItem({ review: { ok: [] } });
  const items = [item, ...names];
  installIndexes(items, settings);
  const unit = must(castQuestion(items, ask, true), "the preview");
  assert.equal(unit.ar, "اسمي سامي");
});

/*
 * The teacher's list and the student's device name a sentence the same
 * way — the one property the whole gate rests on. Approved from the list,
 * carried through the same conversion course material takes, and asked on
 * the device: the agreeing form and all.
 */
await build({
  entryPoints: [path.join(here, "..", "src", "shared.tsx")],
  outfile: path.join(out, "shared.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { cardToItem } = await import(path.join(out, "shared.js"));

test("a sentence approved on the teacher's list is the sentence a student's device asks", () => {
  const pool = [
    { ...noun("house", "بيت", "house", "masculine", 1), drill: false },
    { ...noun("car", "سيارة", "car", "feminine", 2), drill: false },
    { ...big, drill: false },
    frame,
  ];
  const [part] = cardSentences(frame, pool, ar);
  const car = must(part.list.find((s) => s.ar === "سيارة كبيرة"), "the car sentence");
  const reviewed = pool.map((c) => (c.id === "f" ? { ...c, review: { ok: [car.key], no: [] } } : c));
  const items = reviewed.map((c) => cardToItem(c, "Deck", "course", "deck", () => ({})));
  const f = must(items.find((/** @type {any} */ i) => i.id === "srvf"), "the frame on the device");
  f.forms[0].met = { "noun:srvhouse": 9, "noun:srvcar": 9, "adjective:srvbig": 9 };
  installIndexes(items, settings);
  const unit = must(castQuestion(items, { id: "srvf", subId: null, type: "ar2en" }), "the question");
  assert.equal(unit.ar, "سيارة كبيرة");
  assert.equal(unit.reviewKey, car.key);
});
