// @ts-check
/*
 * Counting with the teacher's noun cards, and numbers standing in
 * sentences.
 *
 * Three claims. A noun card is read for what it can be counted with —
 * its singular, plural, pair form and gender — and a card missing one
 * says which. A counting part opens on any noun it can say whole, so one
 * unfinished card does not hold the rest back. And a part that names a
 * blank fills it, with the same numbers on every device for the same
 * system.
 *
 * Nothing here holds a word of Arabic: the words are the golden system's
 * and the noun cards borrow its nouns, which is the rule for every file
 * that tests a composer.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { arComposer } from "../src/numbers/ar-PS.ts";
import { heComposer } from "../src/numbers/he-IL.ts";
import { countedNouns, readNounCard, readNouns, setsWithNouns, withNouns } from "../src/numbers/nouns.ts";
import { countable, rangeChecks } from "../src/numbers/range.ts";
import { fillerCards, FILLERS_PER_PART, homesOf, partTags } from "../src/numbers/generate.ts";
import { fillersFor } from "../src/card-facts.ts";
import { LANGUAGES } from "../src/languages.ts";

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {Record<string, any>} */
const GOLD = Object.fromEntries(SYS.nouns.map((/** @type {any} */ n) => [n.id, n]));

/**
 * A noun card the way the editor saves one: the card's own word first,
 * then its other forms, each saying which number it is.
 * @param {string} id
 * @param {{ sg?: boolean, pl?: boolean, dual?: boolean, gender?: string, enPl?: string }} [has]
 */
function nounCard(id, has = {}) {
  const gold = GOLD[id];
  const want = { sg: true, pl: true, dual: true, gender: gold.gender === "f" ? "feminine" : "masculine", ...has };
  /** @type {any[]} */
  const forms = [];
  if (want.sg) forms.push({ ar: gold.sg, en: gold.en, lat: "", number: "singular", gender: want.gender || "" });
  if (want.pl) forms.push({ ar: gold.pl, en: want.enPl || `${gold.en}s`, lat: "", number: "plural", gender: want.gender || "" });
  if (want.dual) forms.push({ ar: gold.dual, en: `two ${gold.en}s`, lat: "", number: "dual", gender: want.gender || "" });
  return { id, lang: "ar-PS", category: "noun", forms };
}

/* ---- reading a card ---- */

test("a noun card is read for its singular, plural, pair form and gender", () => {
  const read = must(readNounCard(nounCard("book", { enPl: "books" })), "book");
  assert.deepEqual(read.missing, []);
  const noun = must(read.noun, "noun");
  assert.equal(noun.sg, GOLD.book.sg);
  assert.equal(noun.pl, GOLD.book.pl);
  assert.equal(noun.dual, GOLD.book.dual);
  assert.equal(noun.gender, "m");
  assert.equal(noun.en, "book");
  /* The English plural is the card's own where it says one that is not
     the singular. */
  assert.equal(must(readNounCard(nounCard("girl", { enPl: "young women" })), "girl").noun?.enPl, "young women");
});

test("a card that is not a noun is not read, and one short of a form says which", () => {
  assert.equal(readNounCard({ ...nounCard("book"), category: "verb" }), null);
  assert.deepEqual(must(readNounCard(nounCard("book", { pl: false })), "book").missing, ["plural"]);
  assert.deepEqual(must(readNounCard(nounCard("book", { gender: "" })), "book").missing, ["gender"]);
  /* No pair form is not a gap here: whether the language needs one is the
     composer's to say, and a part that does finds out by rendering. */
  const noDual = must(readNounCard(nounCard("book", { dual: false })), "book");
  assert.deepEqual(noDual.missing, []);
  assert.equal(must(noDual.noun, "noun").dual, undefined);
});

test("the nouns of one language come back in the order of their ids, whatever order the cards are in", () => {
  const cards = [nounCard("girl"), { ...nounCard("book"), lang: "he-IL" }, nounCard("book")];
  assert.deepEqual(readNouns(cards, "ar-PS").map((r) => r.id), ["book", "girl"]);
  assert.deepEqual(countedNouns(cards, "he-IL").map((n) => n.id), ["book"]);
});

test("a system given the nouns it already has is the same object", () => {
  const nouns = countedNouns([nounCard("book")], "ar-PS");
  const once = withNouns({ ...SYS, nouns: [] }, nouns);
  assert.equal(withNouns(once, countedNouns([nounCard("book")], "ar-PS")), once);
  const sets = [{ numbers: once, times: null }];
  assert.equal(setsWithNouns(sets, [nounCard("book")])[0], sets[0]);
});

/* ---- which nouns a counting part counts ---- */

test("a counting part counts the nouns it can say whole, and opens on any one of them", () => {
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book", { dual: false }), nounCard("girl")], "ar-PS"));
  const range = (/** @type {string} */ id) => must(arComposer.ranges().find((r) => r.id === id), id);
  /* Two of a thing is its pair form in Arabic, so a noun without one is
     counted from three and not at one and two. */
  assert.deepEqual(countable(range("numbers:count-1-2"), arComposer, sys).map((n) => n.id), ["girl"]);
  assert.deepEqual(countable(range("numbers:count-3-10"), arComposer, sys).map((n) => n.id), ["book", "girl"]);
  const open = rangeChecks(arComposer, sys).filter((c) => c.range.counted && c.open).map((c) => c.range.id);
  assert.ok(open.includes("numbers:count-1-2"), "one finished noun opens the part");
  /* And with no noun able to say two at all, the part is shut and says
     which form is missing. */
  const none = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book", { dual: false })], "ar-PS"));
  const shut = must(rangeChecks(arComposer, none).find((c) => c.range.id === "numbers:count-1-2"), "1-2");
  assert.equal(shut.open, false);
  assert.ok(shut.warnings.some((w) => w.code === "missing-noun-form" && String(w.detail).endsWith(".dual")));
});

test("with no noun cards at all, counting waits on something to count", () => {
  const checks = rangeChecks(arComposer, { ...SYS, nouns: [] }).filter((c) => c.range.counted);
  assert.ok(checks.length > 0);
  for (const c of checks) {
    assert.equal(c.open, false);
    assert.equal(c.warnings[0].detail, "no nouns to count");
  }
});

/* ---- which part a box is on ---- */

test("each box is on the screen of the first part that needs it", () => {
  const homes = homesOf(arComposer);
  assert.equal(homes.get("unit.7"), "numbers:0-10");
  assert.equal(homes.get("teen.13"), "numbers:11-99");
  assert.equal(homes.get("ten.40"), "numbers:11-99");
  assert.equal(homes.get("connector"), "numbers:11-99");
  assert.equal(homes.get("hundred.2"), "numbers:100-999");
  assert.equal(homes.get("thousand.1"), "numbers:1000+");
  /* Every box the language asks for is somewhere. */
  for (const spec of arComposer.requiredSlots()) assert.ok(homes.get(spec.slot), `${spec.slot} is on no screen`);
  for (const spec of heComposer.requiredSlots()) assert.ok(homesOf(heComposer).get(spec.slot), `${spec.slot} is on no screen`);
});

/* ---- numbers standing in sentences ---- */

/** The fillers one part lends. @param {any[]} made @param {string} part */
const of = (made, part) => made.filter((c) => c.source && c.source.slot === `fill:${part}`);

test("each part answers to a tag of its own and a general one, the same in every language", () => {
  const tags = (/** @type {any} */ composer) => composer.ranges().filter((/** @type {any} */ r) => r.kind === "numbers").map(partTags);
  assert.deepEqual(tags(arComposer), [
    ["0-10", "number"], ["11-99", "number"], ["100-999", "number"], ["1000-plus", "number"],
    ["count-1-2", "count"], ["count-3-10", "count"], ["count-11-20", "count"],
  ]);
  assert.deepEqual(tags(heComposer), tags(arComposer));
});

test("a part fills its tags with its numbers, written out", () => {
  const sys = { ...SYS, nouns: [] };
  const made = of(fillerCards(arComposer, sys), "numbers:0-10");
  assert.equal(made.length, 11, "the whole of 0 to 10");
  for (const card of made) {
    assert.deepEqual(card.fills, ["0-10", "number"]);
    assert.equal(card.drill, false, "borrowed by a sentence, never asked on its own");
    assert.equal(card.kind, "phrase", "kept out of {{word}}");
    assert.ok(card.forms[0].ar);
  }
  assert.deepEqual(made.map((c) => c.forms[0].en), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  /* The same numbers on every device: made twice, the same ids. */
  assert.deepEqual(of(fillerCards(arComposer, sys), "numbers:0-10").map((c) => c.id), made.map((c) => c.id));
  /* And with no nouns, no counting part lends anything. */
  assert.equal(fillerCards(arComposer, sys).filter((c) => (c.fills || []).includes("count")).length, 0);
});

test("a bigger part lends an even spread of itself, not its first dozen", () => {
  const made = of(fillerCards(arComposer, { ...SYS, nouns: [] }), "numbers:11-99");
  assert.ok(made.length > 0 && made.length <= FILLERS_PER_PART);
  const values = made.map((c) => Number(c.forms[0].en));
  assert.ok(Math.max(...values) - Math.min(...values) > 40, `${values} is bunched up`);
});

test("a counting part fills its blank with a number and a thing, saying which number the thing is", () => {
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book"), nounCard("girl")], "ar-PS"));
  const made = of(fillerCards(arComposer, sys), "numbers:count-3-10");
  assert.ok(made.length > 0);
  for (const card of made) {
    const form = /** @type {any} */ (card.forms[0]);
    assert.deepEqual(card.fills, ["count-3-10", "count"]);
    assert.match(form.en, /^\d+ (book|girl)s$/);
    assert.equal(form.number, "plural", "three to ten count the plural");
    assert.ok(["masculine", "feminine"].includes(form.gender));
  }
});

test("a sentence asking for a part's blank is shown the part's numbers on the teacher's screen", () => {
  const sys = { ...SYS, nouns: [] };
  const sentence = { id: "s1", lang: "ar-PS", sentence: true, forms: [{ ar: "{{0-10}}", en: "I am {{0-10}}", lat: "" }] };
  const pool = /** @type {any[]} */ ([sentence, ...fillerCards(arComposer, sys)]);
  const got = fillersFor(sentence.forms[0], pool, LANGUAGES["ar-PS"]);
  assert.equal(got["0-10"].length, 11);
  assert.equal(got["0-10"][3].en, "3");
});

test("a part that cannot be said yet lends nothing to the sentences that ask for it", () => {
  const sys = { ...SYS, nouns: [], lexemes: {} };
  assert.deepEqual(fillerCards(arComposer, sys), []);
});
