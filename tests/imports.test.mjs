/*
 * A teacher's import, read against what they already have — the owner's
 * rules in src/imports.ts: the same card, the same word, or new; a deck
 * the teacher has is added to; links between cards follow them to their
 * new ids; and everything imported is Ready for review.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORTED_STATUS, matchImport, mediaOf, mentions, readImportFile, remapIds, tickedAtFirst, toSave,
} from "../src/imports.ts";

/** @param {string} id @param {string} ar @param {string} en @param {Record<string, any>} [over] */
const card = (id, ar, en, over = {}) => ({ id, lang: "ar-PS", forms: [{ ar, en, lat: "" }], ...over });
const hash = (/** @type {number} */ n) => String(n).padStart(64, "0");

/** @param {any[]} cards @param {any[]} [decks] @param {Record<string, string>} [more] */
const fileOf = (cards, decks = [], more = {}) => ({
  format: "language-app-backup",
  manifest: { version: 1 },
  records: Object.fromEntries([
    ...cards.map((c) => [`card:${c.id}`, c]),
    ...decks.map((d) => [`deck:${d.id}`, d]),
    ...Object.entries(more),
  ]),
});

test("a file that is not an export says so", () => {
  assert.equal(typeof readImportFile({ items: [] }), "string");
  assert.equal(typeof readImportFile(fileOf([])), "string", "nor one with nothing in it");
});

test("each card is new, the same card, or the same word", () => {
  const file = /** @type {any} */ (readImportFile(fileOf([
    card("k1", "طنجرة", "pot"),
    card("k2", "كاسة", "cup"),
    card("k3", "صحن", "plate"),
  ])));
  const have = /** @type {any[]} */ ([card("k1", "طنجرة", "cooking pot"), card("k9", "كاسة ", "glass")]);
  const { cards } = matchImport(file, have, []);
  const kinds = Object.fromEntries(cards.map((m) => [m.card.id, m.kind]));
  assert.deepEqual(kinds, { k1: "same", k2: "sameWord", k3: "new" });
  assert.equal(cards.find((m) => m.card.id === "k2")?.existing?.id, "k9", "the card of yours it matched");
  assert.deepEqual(cards.filter(tickedAtFirst).map((m) => m.card.id), ["k3"], "only the new is ticked");
});

test("a word in another language is not the same word", () => {
  const file = /** @type {any} */ (readImportFile(fileOf([card("k2", "bàn", "table", { lang: "vi-Hue" })])));
  const { cards } = matchImport(file, /** @type {any[]} */ ([card("k9", "bàn", "table")]), []);
  assert.equal(cards[0].kind, "new");
});

test("a deck you have is added to, by id or by its name in its language", () => {
  const decks = [
    { id: "d1", title: "Kitchen", lang: "ar-PS", cardIds: ["k1"] },
    { id: "d2", title: " home ", lang: "ar-PS", cardIds: [] },
    { id: "d3", title: "Home", lang: "vi-Hue", cardIds: [] },
  ];
  const file = /** @type {any} */ (readImportFile(fileOf([card("k1", "طنجرة", "pot")], decks)));
  const mine = /** @type {any[]} */ ([
    { id: "d1", title: "Renamed", lang: "ar-PS" },
    { id: "x", title: "Home", lang: "ar-PS" },
  ]);
  const { decks: matched, cards } = matchImport(file, [], mine);
  assert.deepEqual(matched.map((m) => m.existing?.id), ["d1", "x", undefined]);
  assert.deepEqual(cards[0].inDecks, ["d1"], "and a card knows the file's decks it is in");
});

test("a card is saved as new, Ready for review, without what the server keeps", () => {
  const saved = /** @type {any} */ (toSave(/** @type {any} */ (card("k1", "طنجرة", "pot", {
    owner: "someone", rev: 4, created: 1, updated: 2, inDecks: ["d1"], decks: ["d1"], status: "published",
  })), ""));
  assert.equal(saved.id, "");
  assert.equal(saved.status, IMPORTED_STATUS);
  assert.equal(IMPORTED_STATUS, "review");
  for (const k of ["owner", "rev", "created", "updated", "inDecks", "decks"]) assert.equal(saved[k], undefined, k);
  assert.equal(saved.forms[0].en, "pot");
});

test("links between cards follow them to their new ids", () => {
  const phrase = card("k5", "الطنجرة كبيرة", "the pot is big", {
    uses: ["k1", "k2"],
    lines: [{ ar: "x", en: "y", uses: ["k1"] }],
  });
  const moved = new Map([["k1", "kNEW"]]);
  assert.ok(mentions(phrase, new Set(["k1"])));
  assert.ok(!mentions(phrase, new Set(["k7"])));
  const out = /** @type {any} */ (remapIds(phrase, moved));
  assert.deepEqual(out.uses, ["kNEW", "k2"]);
  assert.deepEqual(out.lines[0].uses, ["kNEW"]);
  assert.equal(out.forms[0].en, "the pot is big", "and nothing else changes");
});

test("only the recordings and pictures of the cards going in are uploaded", () => {
  const raw = fileOf(
    [card("k1", "طنجرة", "pot", { forms: [{ ar: "طنجرة", en: "pot", clips: [hash(1)], images: [hash(3)] }] }),
     card("k2", "كاسة", "cup", { forms: [{ ar: "كاسة", en: "cup", clips: [hash(2)] }] })],
    [],
    { [`clip:${hash(1)}`]: "a", [`clip:${hash(2)}`]: "b", [`image:${hash(3)}`]: "data:image/png;base64,AA==" }
  );
  const file = /** @type {any} */ (readImportFile(raw));
  const got = mediaOf([file.cards.find((/** @type {any} */ c) => c.id === "k1")], file);
  assert.deepEqual(got, { clips: [hash(1)], images: [hash(3)] });
});
