/*
 * What a teacher's material says about itself.
 *
 * Three lists — links to confirm, words that turn up in nothing, words
 * nothing teaches — read off a pile of cards. All three are proposals, so
 * what matters here is that they propose the right things and, more
 * importantly, that they do not propose wrong ones: a suggestion list a
 * teacher learns to ignore is worse than no list.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { linkReport, pairsIn, unknownWords, MINE_FROM_TOKENS } from "../src/context-links.js";
import { LANGUAGES } from "../src/languages.js";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];

/** @param {Record<string, any>} x */
const card = (x) => ({ en: "", uses: [], ...x });

/* A word, a phrase that uses it and says so, and a phrase that uses it and
   does not. */
const deck = () => [
  card({ id: "w-door", ar: "باب", en: "door" }),
  card({ id: "w-book", ar: "كتاب", en: "book" }),
  card({ id: "p-shut", ar: "سكّر الباب من فضلك", en: "close the door please", uses: ["w-door"] }),
  card({ id: "p-took", ar: "أخذت كتابها معها", en: "she took her book with her" }),
];

test("a phrase that uses a word and does not say so is a link to confirm", () => {
  const { toConfirm, confirmed } = linkReport(deck(), ar);
  assert.deepEqual(
    toConfirm.map((p) => [p.container.id, p.word.id]),
    [["p-took", "w-book"]],
    "the one pairing nobody has ticked",
  );
  assert.deepEqual(
    confirmed.map((p) => [p.container.id, p.word.id]),
    [["p-shut", "w-door"]],
    "and the one somebody has",
  );
});

test("a word carrying a pronoun still counts as the word", () => {
  /* كتابها is her book. Before the matcher learned to peel what is stuck
     on the end, a phrase using a word in the ordinary way — with somebody
     owning it — taught that word to nobody. */
  const found = pairsIn(deck(), ar).find((p) => p.word.id === "w-book");
  assert.ok(found, "كتابها was not recognised as كتاب");
  assert.equal(found.at, 1, "and the gap-fill needs to know which word to blank");
  assert.equal(found.len, 1);
});

test("a word of two syllables is found inside a sentence", () => {
  /* Vietnamese words are mostly compounds, and matching one token at a
     time meant most of the language could never be taught in context. */
  const cards = [
    card({ id: "w", ar: "cà phê", en: "coffee" }),
    card({ id: "s", ar: "tôi uống cà phê mỗi sáng", en: "I drink coffee every morning" }),
  ];
  const [pair] = pairsIn(cards, vi);
  assert.ok(pair, "the compound was not found");
  assert.equal(pair.word.id, "w");
  assert.deepEqual([pair.at, pair.len], [2, 2], "and it spans both of its syllables");
});

test("a word nothing contains is bare, which is not the same as unlinked", () => {
  const cards = deck().concat([card({ id: "w-sun", ar: "شمس", en: "sun" })]);
  const { bare, toConfirm } = linkReport(cards, ar);
  assert.deepEqual(bare.map((w) => w.id), ["w-sun"]);
  /* The distinction the screen is built on: one of these is a tick away
     and the other needs a phrase writing. */
  assert.ok(
    !toConfirm.some((p) => p.word.id === "w-sun"),
    "a word in nothing cannot be a link waiting to be confirmed",
  );
});

test("words the phrases keep using and no card covers are offered", () => {
  const cards = [
    card({ id: "w-door", ar: "باب", en: "door" }),
    card({ id: "p1", ar: "سكّر الباب من فضلك", en: "close the door please" }),
    card({ id: "p2", ar: "فتحت الشباك من فضلك", en: "she opened the window please" }),
  ];
  const missing = unknownWords(cards, ar);
  const texts = missing.map((m) => m.text);
  assert.ok(texts.includes("الشباك"), `the window is not offered: ${texts.join(" ")}`);
  /* Not the word that already has a card, in any of its forms. */
  assert.ok(!texts.includes("الباب"), "a word already taught was offered again");
  /* And not the particles. "من فضلك" is in both phrases and is exactly
     what a list nobody reads twice begins with. */
  assert.ok(!texts.includes("من"), "a preposition was offered as a card");
});

test("forms of one word are one suggestion, and the plainest form leads", () => {
  const cards = [
    card({ id: "p1", ar: "أخذت الكتاب معها", en: "she took the book" }),
    card({ id: "p2", ar: "قرأت كتاب أخي", en: "I read my brother's book" }),
    card({ id: "p3", ar: "كتابها على الطاولة", en: "her book is on the table" }),
  ];
  const book = unknownWords(cards, ar).find((m) => m.forms.some((f) => f.includes("كتاب")));
  assert.ok(book, "the word all three phrases use was not gathered");
  assert.equal(book.count, 3, "three phrases, one suggestion");
  assert.equal(book.text, "كتاب", "and the form offered is the word, not the word with something on it");
  assert.ok(book.examples.length >= 1 && book.examples.length <= 3, "shown with a phrase or three to judge it by");
});

test("nothing is mined from a card too short to be a phrase", () => {
  /* Two tokens is as likely to be one compound word as it is to be a
     phrase, and offering each half of a word as a card of its own is how a
     suggestion list stops being read. */
  const cards = [card({ id: "w", ar: "cà phê", en: "coffee" })];
  assert.deepEqual(unknownWords(cards, vi), []);
  assert.equal(MINE_FROM_TOKENS, 3);
});

test("the most used word is offered first", () => {
  const cards = [
    card({ id: "p1", ar: "الشمس فوق البيت الكبير", en: "the sun is above the big house" }),
    card({ id: "p2", ar: "البيت الكبير جميل جدا", en: "the big house is very pretty" }),
    card({ id: "p3", ar: "دخلت البيت مع أختي", en: "I entered the house with my sister" }),
  ];
  const missing = unknownWords(cards, ar);
  assert.equal(missing[0].count, 3, "three phrases use it, so it is the one worth writing next");
  assert.ok(
    missing[0].forms.some((f) => f.includes("بيت")),
    `the house was not what came first: ${missing.map((m) => m.text).join(" ")}`,
  );
  /* Written with the article in all three, so that is what is offered: the
     suggestion is the first line of a card somebody else finishes, not a
     card. Where the bare form does appear somewhere, it wins — which is
     what the test above this one holds. */
  assert.equal(missing[0].text, "البيت");
  assert.ok(missing[0].count >= missing[missing.length - 1].count, "and the list runs down from there");
});

test("a language that cannot find a word inside a phrase reports nothing", () => {
  /* Rather than reporting emptiness, which reads as "you have no work to
     do" instead of "this cannot be measured here". */
  const report = linkReport(deck(), /** @type {any} */ ({ id: "xx", name: "Nowhere" }));
  assert.equal(report.supported, false);
  assert.deepEqual(report.toConfirm, []);
  assert.equal(report.coverage, null);
});

test("the coverage number counts words that could be taught in context", () => {
  const coverage = linkReport(deck(), ar).coverage || { words: 0, covered: 0, links: 0 };
  assert.equal(coverage.words, 2, "two cards short enough to turn up inside another");
  assert.equal(coverage.covered, 1, "one of them is taught inside a phrase today");
  assert.equal(coverage.links, 1);
});
