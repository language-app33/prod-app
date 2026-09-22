// @ts-check
/*
 * A teacher's old number cards, as a system.
 *
 * What is worth holding down here is the pair of promises the migration
 * makes, because both are the kind nobody notices being broken:
 *
 *   * **Nothing is invented.** The old model never asked for the form a
 *     numeral takes before a noun, so those boxes come across empty and
 *     the editor shows them as gaps. A migration that guessed would be
 *     one nobody could tell had guessed.
 *   * **It says where every box came from.** That is the whole of why a
 *     learner's year on the word for forty survives the change: a device
 *     reads `migratedFrom` and hands the schedule to the card that
 *     replaces it.
 *
 * And Hebrew is turned round, which is the one case where reading the two
 * packs the same way would have been silently wrong in every number.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { must } from "./helpers.mjs";
import { arComposer } from "../src/numbers/ar-PS.ts";
import { heComposer } from "../src/numbers/he-IL.ts";
import { viComposer } from "../src/numbers/vi-Hue.ts";
import { migrateCards, oldCardOf, slotForValue } from "../src/numbers/migrate.ts";
import { emptyNumberSystem } from "../src/numbers/schema.ts";
import { renderAr } from "../src/numbers/ar-PS.ts";

const NOW = 1750000000000;
const base = (/** @type {string} */ lang) => emptyNumberSystem("n1", "lena", lang, NOW, 1);

/** A number card as the old screen wrote one. */
const card = (
  /** @type {string} */ id,
  /** @type {number} */ value,
  /** @type {string} */ word,
  /** @type {Record<string, string>} */ cells = {},
) => ({
  id,
  value,
  lang: "ar-PS",
  forms: [{ ar: word, en: String(value), lat: "" }].concat(
    Object.entries(cells).map(([col, text]) => ({ ar: text, en: String(value), lat: "", row: "counted", col })),
  ),
});

/* ---- which box a value goes in ---- */

test("a value maps onto the box it is, or onto nothing at all", () => {
  assert.equal(slotForValue(0), "unit.0");
  assert.equal(slotForValue(7), "unit.7");
  assert.equal(slotForValue(10), "unit.10");
  assert.equal(slotForValue(11), "teen.11");
  assert.equal(slotForValue(19), "teen.19");
  assert.equal(slotForValue(20), "ten.20");
  assert.equal(slotForValue(90), "ten.90");
  assert.equal(slotForValue(100), "hundred.1");
  assert.equal(slotForValue(200), "hundred.2");
  assert.equal(slotForValue(1000), "thousand.1");
  assert.equal(slotForValue(2000), "thousand.2");
  assert.equal(slotForValue(1000000), "million.1");
  assert.equal(slotForValue(2000000), "million.2");
  /* And everything else is a number somebody wrote out in full, which is
     exactly what a correction is — the fused hundreds among them. */
  for (const v of [21, 47, 300, 900, 3000, 9000, 3000000, 1525]) {
    assert.equal(slotForValue(v), null, String(v));
  }
  for (const v of [-1, 1.5, 10000000, NaN]) assert.equal(slotForValue(v), null, String(v));
});

test("a card's own word and its cells are read apart", () => {
  const old = oldCardOf(card("k1", 3, "three", { feminine: "three-f" }));
  assert.equal(old.word, "three");
  assert.deepEqual(old.cells, { feminine: "three-f" });
  assert.deepEqual(oldCardOf({ id: "k", forms: [] }), { word: "", cells: {} });
  assert.deepEqual(oldCardOf({ id: "k" }), { word: "", cells: {} });
});

/* ---- what a migration builds ---- */

test("the boxes a teacher filled come across, and the rest become corrections", () => {
  const got = migrateCards(
    [
      card("k0", 0, "sifr"),
      card("k1", 1, "wahad", { feminine: "wahde" }),
      card("k20", 20, "ishrin"),
      card("k100", 100, "miyye"),
      card("k300", 300, "tultmiyye"),
      card("k3000", 3000, "tlat-talaf"),
    ],
    arComposer,
    base("ar-PS"),
  );
  assert.equal(got.filled, 4);
  assert.equal(got.written, 2);
  assert.deepEqual(Object.keys(got.system.lexemes).sort(), ["ten.20", "unit.0", "unit.1", "hundred.1"].sort());
  assert.deepEqual(Object.keys(got.system.overrides).sort(), ["300", "3000"]);
  assert.equal(got.system.overrides["300"].text, "tultmiyye");
  /* And the one that had a cell brought it across as a face. */
  assert.equal(got.system.lexemes["unit.1"].forms.standalone, "wahad");
  assert.equal(got.system.lexemes["unit.1"].forms.f, "wahde");
});

test("nothing the old model could not say is invented", () => {
  const got = migrateCards([card("k3", 3, "tlate", { feminine: "tlat" })], arComposer, base("ar-PS"));
  const forms = got.system.lexemes["unit.3"].forms;
  /* The form before a noun was never asked for, so it comes across empty
     and the editor shows it as the gap it is. */
  assert.equal(forms["construct.m"], undefined);
  assert.equal(forms["construct.f"], undefined);
  assert.equal(forms.standalone, "tlate");
});

test("Hebrew is turned round, because its old cards were the other way up", () => {
  /* The card carried the masculine, because that is what stands beside a
     noun, and the cell carried the form you count with. A system holds
     counting first, everywhere. Reading the two packs the same way would
     have been wrong in every Hebrew number and right in every Arabic
     one, which is the worst shape a bug can have. */
  const got = migrateCards(
    [{ ...card("k3", 3, "shlosha", { feminine: "shalosh" }), lang: "he-IL" }],
    heComposer,
    base("he-IL"),
  );
  const forms = got.system.lexemes["unit.3"].forms;
  assert.equal(forms.standalone, "shalosh", "counting is what a slot's first box is for");
  assert.equal(forms.m, "shlosha");
  assert.equal(forms.f, "shalosh");
  /* A card the teacher never filled a cell on keeps its word in both
     places rather than losing half of itself. */
  const thin = migrateCards(
    [{ ...card("k4", 4, "arba'a"), lang: "he-IL" }],
    heComposer,
    base("he-IL"),
  );
  assert.equal(thin.system.lexemes["unit.4"].forms.standalone, "arba'a");
  assert.equal(thin.system.lexemes["unit.4"].forms.m, "arba'a");
});

test("Huế's two cells are one face, because they were always one idea", () => {
  const got = migrateCards(
    [
      { ...card("k5", 5, "năm", { "after-ten": "lăm" }), lang: "vi-Hue" },
      { ...card("k0", 0, "không", { "empty-place": "lẻ" }), lang: "vi-Hue" },
    ],
    viComposer,
    base("vi-Hue"),
  );
  assert.equal(got.system.lexemes["unit.5"].forms.company, "lăm");
  assert.equal(got.system.lexemes["unit.0"].forms.company, "lẻ");
});

/* ---- the promise a learner's progress rests on ---- */

test("every box says which card it came from", () => {
  const got = migrateCards(
    [card("k7", 7, "sab'a"), card("k300", 300, "tultmiyye")],
    arComposer,
    base("ar-PS"),
  );
  const from = must(got.system.migratedFrom, "migratedFrom");
  assert.equal(from["unit.7"], "k7");
  assert.equal(from["override:300"], "k300");
  assert.deepEqual(got.fromCards.sort(), ["k300", "k7"]);
});

/* ---- running it twice ---- */

test("the first card claiming a value keeps it", () => {
  /* The rule the old model read parts by: a duplicate written by accident
     must not silently change what every number in the language sounds
     like. */
  const got = migrateCards(
    [card("k7", 7, "first"), card("k7b", 7, "second")],
    arComposer,
    base("ar-PS"),
  );
  assert.equal(got.system.lexemes["unit.7"].forms.standalone, "first");
  assert.equal(got.filled, 1);
});

test("a card with no word in it fills nothing", () => {
  const got = migrateCards(
    [card("k7", 7, "   "), { id: "k8", value: 8 }, { id: "k9", lang: "ar-PS", forms: [] }],
    arComposer,
    base("ar-PS"),
  );
  assert.deepEqual(got.system.lexemes, {});
  assert.deepEqual(got.system.overrides, {});
  assert.equal(got.filled + got.written, 0);
});

test("a migration run over its own result changes nothing", () => {
  /* It is only ever run where no system exists, but a thing that runs at
     the door is a thing that will be run twice one day. */
  const cards = [card("k1", 1, "wahad", { feminine: "wahde" }), card("k300", 300, "tultmiyye")];
  const once = migrateCards(cards, arComposer, base("ar-PS"));
  const twice = migrateCards(cards, arComposer, once.system);
  assert.deepEqual(twice.system.lexemes, once.system.lexemes);
  assert.deepEqual(twice.system.overrides, once.system.overrides);
});

/* ---- and it is a system that actually says something ---- */

test("what comes out of a full collection can say the numbers it was built from", () => {
  /* The end-to-end claim: a teacher who had filled in the old screen
     opens the new one and finds their language working, not a grid of
     empty boxes with their words somewhere else. */
  const cards = [];
  const words = ["sifr", "wahad", "tnen", "tlate", "arb'a", "khamse", "sitte", "sab'a", "tmanye", "tis'a", "ashara"];
  words.forEach((w, v) => cards.push(card(`u${v}`, v, w)));
  const teens = ["hdash", "tnash", "tletash", "arbatash", "khamstash", "sittash", "sabatash", "tmantash", "tisatash"];
  teens.forEach((w, i) => cards.push(card(`t${i}`, 11 + i, w)));
  const tens = ["ishrin", "tlatin", "arb'in", "khamsin", "sittin", "sab'in", "tmanin", "tis'in"];
  tens.forEach((w, i) => cards.push(card(`d${i}`, 20 + i * 10, w)));
  cards.push(card("c", 100, "miyye"));

  const got = migrateCards(cards, arComposer, base("ar-PS"));
  /* The joining word was never a card, so it is the one gap a teacher has
     to fill in afterwards — and the editor says so. */
  const withJoin = {
    ...got.system,
    lexemes: { ...got.system.lexemes, connector: { slot: "connector", forms: { standalone: "w" } } },
  };
  assert.equal(renderAr(47, withJoin).text, "sab'a warb'in");
  assert.equal(renderAr(115, withJoin).text, "miyye wkhamstash");
  assert.deepEqual(renderAr(99, withJoin).warnings, []);
});
