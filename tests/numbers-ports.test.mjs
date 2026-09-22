// @ts-check
/*
 * Hebrew and Huế Vietnamese, ported onto the new composer contract.
 *
 * These two languages already built their numbers, and they have been in
 * front of learners since 0.152. So the question here is not "is this
 * right" — somebody answered that once already — but **"is this the
 * same"**, and that is a much sharper question to ask.
 *
 * It is asked twice. The golden tables were generated from the shipping
 * implementation, so a row that changes is a learner seeing something
 * new. And while both implementations are still in the tree, this file
 * runs them side by side over three hundred numbers: same words in, same
 * words out, character for character. That second test goes when the old
 * module does, which is what the tables are for.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { LANGUAGES } from "../src/languages.ts";
import { partCards, spell } from "../src/numbers.ts";
import { renderHe } from "../src/numbers/he-IL.ts";
import { renderVi } from "../src/numbers/vi-Hue.ts";
import { composerFor, composerLanguages, timeComposerFor } from "../src/numbers/index.ts";
import { NUMBER_CEILING } from "../src/numbers/types.ts";

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));

const HE = load("he-IL.numbers.json");
const VI = load("vi-Hue.numbers.json");

/* The decks the old implementation reads, built from the very lexemes the
   new one reads, so the two are given the same words and nothing else. */

/** @param {any} sys @returns {(slot: string, key?: string) => string} */
const wordOf = (sys) => (slot, key = "standalone") =>
  ((sys.lexemes[slot] || { forms: {} }).forms || {})[key] || "";

/** @param {string} langId @param {Record<string, string>} words @param {Record<string, Record<string,string>>} cells */
function deckOf(langId, words, cells = {}) {
  /** @type {any[]} */
  const cards = [];
  for (const [value, ar] of Object.entries(words)) {
    if (!ar) continue;
    const v = Number(value);
    /** @type {any[]} */
    const forms = [{ ar, en: String(v), lat: "" }];
    for (const [col, text] of Object.entries(cells[v] || {})) {
      if (text) forms.push({ ar: text, en: String(v), lat: "", row: "counted", col });
    }
    cards.push({ id: `n${v}`, lang: langId, value: v, category: "number", forms });
  }
  return partCards(cards, langId);
}

/* Hebrew: the old deck held the masculine on the card and the feminine in
   a cell beside it, which is the storage this port turns round. */
const heDeck = (() => {
  const w = wordOf(HE.system);
  /** @type {Record<string, string>} */
  const words = {};
  /** @type {Record<string, Record<string, string>>} */
  const cells = {};
  words[0] = w("unit.0");
  for (let v = 1; v <= 10; v += 1) {
    words[v] = w(`unit.${v}`, "m");
    cells[v] = { feminine: w(`unit.${v}`) };
  }
  for (let v = 11; v <= 19; v += 1) {
    words[v] = w(`teen.${v}`, "m");
    cells[v] = { feminine: w(`teen.${v}`) };
  }
  for (let v = 20; v <= 90; v += 10) words[v] = w(`ten.${v}`);
  words[100] = w("hundred.1");
  words[200] = w("hundred.2");
  for (let k = 3; k <= 9; k += 1) words[k * 100] = `${w(`unit.${k}`)} ${w("hundred.n")}`;
  words[1000] = w("thousand.1");
  words[2000] = w("thousand.2");
  for (let k = 3; k <= 9; k += 1) words[k * 1000] = `${w(`unit.${k}`, "construct.m")} ${w("thousand.n")}`;
  words[1000000] = w("million.1");
  words[2000000] = w("million.2");
  for (let k = 3; k <= 9; k += 1) words[k * 1000000] = `${w(`unit.${k}`, "m")} ${w("million.n")}`;
  return deckOf("he-IL", words, cells);
})();

const viDeck = (() => {
  const w = wordOf(VI.system);
  /** @type {Record<string, string>} */
  const words = {};
  /** @type {Record<string, Record<string, string>>} */
  const cells = {};
  for (let v = 0; v <= 10; v += 1) {
    words[v] = w(`unit.${v}`);
    const company = w(`unit.${v}`, "company");
    if (company) cells[v] = v === 0 ? { "empty-place": company } : { "after-ten": company };
  }
  words[100] = w("hundred.n");
  words[1000] = w("thousand.n");
  words[1000000] = w("million.n");
  return deckOf("vi-Hue", words, cells);
})();

const CASES = {
  "he-IL": { golden: HE, render: renderHe, deck: heDeck, lang: LANGUAGES["he-IL"] },
  "vi-Hue": { golden: VI, render: renderVi, deck: viDeck, lang: LANGUAGES["vi-Hue"] },
};

/* ---- the tables ---- */

for (const [langId, { golden, render }] of Object.entries(CASES)) {
  test(`${langId} says every number in its table the way the table says it`, () => {
    assert.ok(golden.cases.length >= 250, `${langId}: ${golden.cases.length} rows`);
    for (const row of golden.cases) {
      const got = render(row.n, golden.system);
      assert.equal(got.text, row.text, `${langId} ${row.n}`);
      assert.deepEqual(got.warnings, [], `${langId} ${row.n} warned`);
    }
  });
}

/* ---- the same, said twice ---- */

for (const [langId, { golden, render, deck, lang }] of Object.entries(CASES)) {
  test(`${langId} is the same after the port as before it`, () => {
    /* Delete this when src/numbers.ts goes. Until then it is the strongest
       thing that can be said about a rewrite: two implementations, one set
       of words, three hundred numbers, no difference. */
    const check = (/** @type {number} */ v) => {
      const before = spell(lang, deck, v);
      const after = render(v, golden.system);
      assert.ok(before, `${langId}: the old implementation could not say ${v}`);
      assert.equal(after.text, must(before, "before").text, `${langId} ${v}`);
    };
    for (let v = 0; v <= 2000; v += 1) check(v);
    let seed = 99;
    for (let i = 0; i < 3000; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      check(Math.floor((seed / 2147483648) * (NUMBER_CEILING + 1)));
    }
    for (const v of [9999, 10000, 99999, 100000, 999999, 1000000, 1000001, 9999999]) check(v);
  });
}

/* ---- what each language asks for ---- */

test("Huế asks for a third of the boxes the Semitic pair do, and they ask for fewer than they did", () => {
  const he = must(composerFor("he-IL"), "he").requiredSlots();
  const vi = must(composerFor("vi-Hue"), "vi").requiredSlots();
  const ar = must(composerFor("ar-PS"), "ar").requiredSlots();
  assert.ok(vi.length * 2 < ar.length, `${vi.length} against ${ar.length}`);
  assert.equal(he.length, ar.length, "the two Semitic packs ask for the same boxes");
  /* Fifty-five before this, because every hundred, thousand and million
     was a box of its own. Saying *one*, *two* and *the plural* instead
     takes seventeen rows off the screen a teacher has to fill in, and the
     dialects that fuse them write those out as corrections instead. */
  assert.ok(ar.length < 40, `${ar.length} boxes is more than the old screen asked for`);
  /* And the reason: Huế is regular, so its scale words are bare and it has
     no hundreds or thousands to write out one at a time. */
  assert.deepEqual(
    vi.filter((s) => s.group === "scales").map((s) => s.slot),
    ["hundred.n", "thousand.n", "million.n"],
  );
});

test("a language with nothing to agree with schedules no counting range", () => {
  const vi = must(composerFor("vi-Hue"), "vi").ranges();
  assert.equal(vi.some((r) => r.counted), false);
  for (const id of ["ar-PS", "he-IL"]) {
    assert.ok(must(composerFor(id), id).ranges().some((r) => r.counted), id);
  }
});

test("Huế puts a noun after the number and changes neither", () => {
  const noun = { id: "book", sg: "sách", pl: "sách", gender: /** @type {const} */ ("m"), en: "book" };
  const got = renderVi(5, VI.system, { noun });
  assert.equal(got.nounForm, "sg");
  assert.ok(got.text.endsWith("sách"));
});

test("Hebrew counts in the feminine and keeps the masculine for a word beside it", () => {
  /* The rule that made Hebrew worth porting carefully: reading 3 off a
     page is one word, three books is another, and the count in front of a
     scale word is the second of them. */
  const abstract = renderHe(3, HE.system).text;
  const masculine = renderHe(3, HE.system, { gender: "m" }).text;
  assert.notEqual(abstract, masculine);
  assert.equal(renderHe(3, HE.system, { gender: "f" }).text, abstract);
  /* Eleven thousand counts the masculine way, which is the one place in a
     number where the form you count with is wrong. */
  assert.ok(renderHe(11000, HE.system).text.startsWith(renderHe(11, HE.system, { gender: "m" }).text));
});

/* ---- the registry ---- */

test("the registry answers by language and says nothing about any of them", () => {
  assert.deepEqual(composerLanguages().sort(), ["ar-PS", "he-IL", "vi-Hue"]);
  for (const id of composerLanguages()) {
    const composer = must(composerFor(id), id);
    assert.equal(composer.id, id, "a composer knows which language it is");
    assert.ok(composer.version >= 1);
    assert.ok(composer.requiredSlots().length);
    assert.ok(composer.ranges().length);
  }
  assert.equal(composerFor("xx-XX"), null);
  assert.equal(composerFor(null), null);
  /* Telling the time is a separate answer: a language may build numbers
     and have nobody yet who knows its clock. */
  assert.ok(timeComposerFor("ar-PS"));
  assert.equal(timeComposerFor("he-IL"), null);
  assert.equal(timeComposerFor("vi-Hue"), null);
});

test("every composer is total: nothing throws and nothing is said off the end", () => {
  for (const id of composerLanguages()) {
    const composer = must(composerFor(id), id);
    const empty = {
      id: "x", owner: "", languageId: id, composerVersion: 1, lexemes: {},
      overrides: {}, nouns: [], audioPolicy: /** @type {const} */ ("components"),
      rev: 0, created: 0, updated: 0,
    };
    for (const v of [-1, 0, 1.5, 47, NUMBER_CEILING, NUMBER_CEILING + 1, NaN]) {
      const got = composer.render(v, empty);
      assert.equal(typeof got.text, "string", `${id} ${v}`);
      assert.ok(Array.isArray(got.tokens));
      assert.ok(got.warnings.length, `${id} ${v} should say what is missing`);
    }
  }
});
