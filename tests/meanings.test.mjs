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

/* ------------------------------------------------------------------
   For the teacher
   ------------------------------------------------------------------ */

import path from "node:path";
import { build } from "esbuild";
import {
  anotherMeaningOf,
  anotherWordDraft,
  cardsSharingChange,
  carryWordChanges,
  meaningsOnCard,
  sharedWith,
  splitByMeaning,
  wordChanges,
} from "../src/meanings.ts";

/** @returns {any} */
const teacherCard = () => ({
  id: "c1",
  lang: "ar-PS",
  ref: "sabir",
  clue: "the plant",
  decks: ["d1"],
  category: "noun",
  forms: [
    { id: "", ar: "صَبِر", en: "cactus", lat: "sabir", clips: ["a"], images: ["pic"] },
    { id: "pl", ar: "صبر", en: "cacti", lat: "subur", clips: ["b"] },
  ],
});

test("another meaning keeps the word, its forms and recordings, and empties what it means", () => {
  const copy = /** @type {any} */ (anotherMeaningOf(teacherCard()));
  assert.equal(copy.id, "");
  assert.equal(copy.ref, undefined, "the ID belongs to the original");
  assert.equal(copy.clue, undefined, "so does the clue");
  assert.equal(copy.decks, undefined, "and it starts in no deck");
  assert.equal(copy.category, "noun");
  assert.deepEqual(copy.forms.map((/** @type {any} */ f) => [f.ar, f.lat, f.en, f.clips, f.images]), [
    ["صَبِر", "sabir", "", ["a"], undefined],
    ["صبر", "subur", "", ["b"], undefined],
  ]);
});

test("another word for the meaning starts with the meaning only", () => {
  assert.deepEqual(anotherWordDraft(teacherCard(), teacherCard().forms[0]), { en: "cactus" });
});

test("the cards sharing a word or a meaning, as the teacher types", () => {
  const cards = [card("p", "صَبِر", "patience"), card("s", "صح", "right"), card("k", "كتاب", "book")];
  const both = sharedWith(cards, { id: "", lang: "ar-PS" }, { id: "", ar: "صَبِر", en: "right", lat: "" });
  assert.deepEqual(both.word.map((c) => c.id), ["p"]);
  assert.deepEqual(both.meaning.map((c) => c.id), ["s"]);
  assert.deepEqual(sharedWith(cards, { id: "p", lang: "ar-PS" }, cards[0].forms[0]).word, [], "never itself");
});

test("a spelling fix is offered to the cards still saying the old thing, and carried there", () => {
  const before = teacherCard();
  const after = before.forms.map((/** @type {any} */ f, /** @type {number} */ i) => (i === 0 ? { ...f, ar: "صَبْر" } : f));
  const changes = wordChanges(before, after);
  assert.deepEqual(changes.map((c) => c.to), [{ ar: "صَبْر" }]);
  const copy = { ...anotherMeaningOf(before), id: "c2", forms: anotherMeaningOf(before).forms.map((/** @type {any} */ f) => ({ ...f, en: "patience" })) };
  const unrelated = card("k", "كتاب", "book");
  assert.deepEqual(cardsSharingChange([before, copy, unrelated], { id: "c1", lang: "ar-PS" }, changes).map((c) => c.id), ["c2"]);
  const moved = /** @type {any} */ (carryWordChanges(copy, changes));
  assert.equal(moved.forms[0].ar, "صَبْر");
  assert.equal(moved.forms[0].en, "patience", "what it means is untouched");
  assert.equal(carryWordChanges(unrelated, changes), null);
});

test("a card with two meanings is offered for splitting, and split into one card each", () => {
  const two = { ...teacherCard(), forms: [{ id: "", ar: "صَبِر", en: "cactus / patience", lat: "sabir", images: ["pic"] }] };
  assert.deepEqual(meaningsOnCard(two), ["cactus", "patience"]);
  assert.deepEqual(meaningsOnCard({ ...two, together: true }), [], "not once the teacher said to keep it");
  assert.deepEqual(meaningsOnCard({ ...two, sentence: true }), [], "nor a sentence");
  const { kept, made } = splitByMeaning(two);
  assert.equal(kept.forms[0].en, "cactus");
  assert.deepEqual(kept.forms[0].images, ["pic"]);
  assert.equal(made.length, 1);
  assert.equal(made[0].id, "");
  assert.equal(made[0].splitFrom, "c1");
  assert.equal(made[0].forms[0].en, "patience");
  assert.equal(made[0].forms[0].images, undefined);
  assert.deepEqual(made[0].decks, ["d1"], "in the same decks");
});

test("a learner's device starts a split card where the original stood", async () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const out = path.join(here, ".meanings-build");
  await build({
    entryPoints: [path.join(here, "..", "src", "shared.tsx")],
    outfile: path.join(out, "shared.js"),
    bundle: true,
    format: "esm",
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    logLevel: "silent",
  });
  const { cardToItem, foldCourses } = await import(path.join(out, "shared.js"));
  const original = cardToItem({ id: "orig1", lang: "ar-PS", forms: [{ ar: "صَبِر", en: "cactus" }] }, "Deck", "c", "d", () => ({}));
  const learnt = { phase: "review", step: 0, ease: 2.5, interval: 9, due: 1, reps: 4, lapses: 0, right: 4, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1] };
  original.forms[0].s = { ar2en: learnt };
  const split = cardToItem({ id: "new1", lang: "ar-PS", splitFrom: "orig1", forms: [{ ar: "صَبِر", en: "patience" }] }, "Deck", "c", "d", () => ({}));
  const keptOriginal = cardToItem({ id: "orig1", lang: "ar-PS", forms: [{ ar: "صَبِر", en: "cactus" }] }, "Deck", "c", "d", () => ({}));
  const { items } = foldCourses([original], [keptOriginal, split]);
  const arrived = items.find((/** @type {any} */ i) => i.id === split.id);
  assert.equal(arrived.forms[0].s.ar2en.interval, 9);
  const stays = items.find((/** @type {any} */ i) => i.id === original.id);
  assert.equal(stays.forms[0].s.ar2en.interval, 9, "and the original keeps its own");
});
