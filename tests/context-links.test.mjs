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

import { linkReport, pairsIn, unknownWords, MINE_FROM_TOKENS } from "../src/context-links.ts";
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

/*
 * Conversations.
 *
 * A scene keeps its words in its turns and has no text of its own, so a
 * report that read `ar` off each card saw straight past every one a
 * teacher had written. Everything below is the same three questions asked
 * of a scene instead of a phrase — and the point of asking them is that
 * the session builder had been treating those same turns as contexts all
 * along, so the report was contradicting the app.
 */

/** A scene whose first turn uses a word and says so, and whose second uses
    one and does not. */
const scene = () =>
  card({
    id: "d-shop",
    ar: "",
    en: "At the shop",
    speakers: ["Layla", "Karim"],
    you: null,
    lines: [
      { who: 0, ar: "سكّر الباب من فضلك", en: "close the door please", uses: ["w-door"] },
      { who: 1, ar: "أخذت كتابها معها", en: "she took her book with her", uses: [] },
    ],
  });

test("a word used in a turn of a conversation counts as used", () => {
  const cards = [
    card({ id: "w-door", ar: "باب", en: "door" }),
    card({ id: "w-book", ar: "كتاب", en: "book" }),
    scene(),
  ];
  const { bare, confirmed, toConfirm, coverage } = linkReport(cards, ar);
  assert.deepEqual(bare, [], "both words turn up in the scene, so neither is bare");
  assert.deepEqual(
    confirmed.map((p) => p.word.id),
    ["w-door"],
    "the turn that says which word it teaches is a confirmed link",
  );
  assert.deepEqual(
    toConfirm.map((p) => p.word.id),
    ["w-book"],
    "and the turn that does not is one to confirm",
  );
  assert.deepEqual(coverage, { words: 2, covered: 1, links: 1 });
});

test("a turn is offered as itself: which card, which line, and who says it", () => {
  /* Confirming the link has to write it onto the turn rather than the
     card, because a scene has no `uses` of its own that would mean
     anything — the session builder reads a line's own. */
  const [pair] = linkReport([card({ id: "w-book", ar: "كتاب", en: "book" }), scene()], ar).toConfirm;
  assert.ok(pair, "the turn using the word was not offered");
  assert.equal(pair.container.cardId, "d-shop", "the card to open, and to save");
  assert.equal(pair.container.line, 1, "the turn to write the link onto");
  assert.equal(pair.container.who, "Karim", "read as a turn rather than a phrase from nowhere");
  assert.equal(pair.container.id, "d-shop#1", "two turns of one scene are two rows");
  /* An ordinary phrase says the same three things, so the screen has one
     shape of row rather than two. */
  const [plain] = linkReport(deck(), ar).toConfirm;
  assert.equal(plain.container.cardId, "p-took");
  assert.equal(plain.container.line, null);
  assert.equal(plain.container.who, "");
});

test("and words a conversation keeps using are worth a card like any others", () => {
  const missing = unknownWords([scene()], ar);
  const texts = missing.map((m) => m.text);
  assert.ok(texts.includes("كتابها"), `nothing was mined from the turns: ${texts.join(" ")}`);
  assert.equal(missing[0].examples[0].cardId, "d-shop", "and the example opens the scene it came from");
});

test("a scene is never itself a word waiting for somewhere to be used", () => {
  /* It has no text, so an earlier reading would have made it a nought-token
     card — which is shorter than two, and would have put every conversation
     in the deck on the list of bare words. */
  const { bare, coverage } = linkReport([scene()], ar);
  assert.deepEqual(bare, []);
  assert.equal((coverage || { words: -1 }).words, 0);
});
