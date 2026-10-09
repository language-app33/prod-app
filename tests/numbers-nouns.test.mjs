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
import { blocking, countable, probeOf, rangeChecks } from "../src/numbers/range.ts";
import { fillerCards, FILLERS_PER_PART, homesOf, partTags } from "../src/numbers/generate.ts";
import { countingOf } from "../src/numbers/types.ts";
import { fillersFor } from "../src/card-facts.ts";
import { LANGUAGES } from "../src/languages.ts";
import { sentencesOf } from "../src/review.ts";
import { fieldsLost, fillForm } from "../src/variables.ts";

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

test("a noun card's plural after three to ten is read with the rest", () => {
  const card = nounCard("book");
  /* A made-up word: what is tested is that it is read, not what it is. */
  card.forms.push({ ar: "P", en: "", lat: "", number: "counted", gender: "masculine" });
  const noun = must(must(readNounCard(card), "book").noun, "noun");
  assert.equal(noun.plCounted, "P");
  /* And a card without one has none, rather than an empty one. */
  assert.equal("plCounted" in must(must(readNounCard(nounCard("book")), "book").noun, "noun"), false);
});

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

test("a person with both sides is counted with the plural and pair of its own word's side", () => {
  /* A card for a teacher carries the masculine and the feminine, and the
     feminine plural may well have been written first. Counting the
     masculine singular with it would say "three teachers" in two genders
     at once. Placeholders rather than words: what is tested is which
     answer is taken. */
  const card = {
    id: "teacher", lang: "ar-PS", category: "noun",
    forms: [
      { ar: "M-SG", en: "teacher", lat: "", number: "singular", gender: "masculine", human: "person" },
      { ar: "F-SG", en: "teacher", lat: "", number: "singular", gender: "feminine", human: "person" },
      { ar: "F-PL", en: "teachers", lat: "", number: "plural", gender: "feminine", human: "person" },
      { ar: "F-DU", en: "two teachers", lat: "", number: "dual", gender: "feminine", human: "person" },
      { ar: "M-PL", en: "teachers", lat: "", number: "plural", gender: "masculine", human: "person" },
      { ar: "M-DU", en: "two teachers", lat: "", number: "dual", gender: "masculine", human: "person" },
    ],
  };
  const noun = must(must(readNounCard(card), "teacher").noun, "noun");
  assert.equal(noun.sg, "M-SG");
  assert.equal(noun.pl, "M-PL");
  assert.equal(noun.dual, "M-DU");
  assert.equal(noun.gender, "m");
  /* A plural that says no gender is anybody's, as it always was. */
  const plain = { ...card, forms: [card.forms[0], { ...card.forms[2], gender: "" }] };
  assert.equal(must(must(readNounCard(plain), "plain").noun, "noun").pl, "F-PL");
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

test("a stretch counts the nouns it can say whole, and counts as soon as one can be", () => {
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book", { dual: false }), nounCard("girl")], "ar-PS"));
  const stretch = (/** @type {string} */ id) => countingOf(must(arComposer.ranges().find((r) => r.id === id), id));
  /* Two of a thing is its pair form in Arabic, so a noun without one is
     not counted in 0 to 9, which says two — and is from 10 to 19 up,
     which never does. */
  assert.deepEqual(countable(stretch("numbers:0-9"), arComposer, sys).map((n) => n.id), ["girl"]);
  assert.deepEqual(countable(stretch("numbers:10-19"), arComposer, sys).map((n) => n.id), ["book", "girl"]);
  const counting = rangeChecks(arComposer, sys).filter((c) => c.counting && c.counting.open).map((c) => c.range.id);
  assert.ok(counting.includes("numbers:0-9"), "one finished noun is enough to count with");
  /* And with no noun able to say two at all, 0 to 9 is not counted with
     and says which form is missing — while it is still asked its numbers,
     and the stretches above it still count. */
  const none = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book", { dual: false })], "ar-PS"));
  const checks = rangeChecks(arComposer, none);
  const low = must(checks.find((c) => c.range.id === "numbers:0-9"), "0-9");
  assert.equal(low.open, true);
  const shut = must(low.counting, "counting in 0-9");
  assert.equal(shut.open, false);
  assert.ok(shut.warnings.some((w) => w.code === "missing-noun-form" && String(w.detail).endsWith(".dual")));
  assert.equal(must(checks.find((c) => c.range.id === "numbers:10-19"), "10-19").counting?.open, true);
});

test("nouns are judged by kind, and the answer is the one rendering each would give", () => {
  /* Counting is checked once per kind of noun — its gender and which of
     its faces are written — so a collection of hundreds is quick. Held to
     the slow way here, over every gap a noun card can have. */
  const base = SYS.nouns[0];
  /** @type {any[]} */
  const nouns = [];
  for (const gender of ["m", "f"]) {
    for (let mask = 0; mask < 8; mask += 1) {
      for (const copy of [0, 1]) {
        nouns.push({
          ...base, id: `n${gender}${mask}${copy}`, gender,
          sg: mask & 1 ? base.sg : "", dual: mask & 2 ? base.dual : "", pl: mask & 4 ? base.pl : "",
        });
      }
    }
  }
  const sys = { ...SYS, nouns };
  for (const range of arComposer.ranges()) {
    const view = countingOf(range);
    /** @type {any[]} */
    const slow = nouns.filter((noun) =>
      probeOf(view).every((/** @type {number} */ v) => !blocking(arComposer.render(v, sys, { noun }).warnings).length));
    assert.deepEqual(countable(view, arComposer, sys).map((n) => n.id), slow.map((n) => n.id), range.id);
  }
});

test("with no noun cards at all, counting waits on something to count", () => {
  const checks = rangeChecks(arComposer, { ...SYS, nouns: [] }).filter((c) => c.counting);
  assert.equal(checks.length, 6, "every stretch is counted with");
  for (const c of checks) {
    assert.equal(c.open, true, "and is asked its numbers all the same");
    assert.equal(c.counting?.open, false);
    assert.equal(c.counting?.warnings[0].detail, "no nouns to count");
  }
});

/* ---- which part a box is on ---- */

test("each box is on the screen of the first part that needs it", () => {
  const homes = homesOf(arComposer);
  assert.equal(homes.get("unit.7"), "numbers:0-9");
  assert.equal(homes.get("teen.13"), "numbers:10-19");
  assert.equal(homes.get("ten.40"), "numbers:20-99");
  assert.equal(homes.get("connector"), "numbers:20-99");
  assert.equal(homes.get("hundred.2"), "numbers:100-999");
  assert.equal(homes.get("thousand.1"), "numbers:1000+");
  assert.equal(homes.get("billion.1"), "numbers:1000000000+");
  /* Every box the language asks for is somewhere. */
  for (const spec of arComposer.requiredSlots()) assert.ok(homes.get(spec.slot), `${spec.slot} is on no screen`);
  for (const spec of heComposer.requiredSlots()) assert.ok(homesOf(heComposer).get(spec.slot), `${spec.slot} is on no screen`);
});

/* ---- numbers standing in sentences ---- */

/** The fillers one part lends. @param {any[]} made @param {string} part */
const of = (made, part) => made.filter((c) => c.source && c.source.slot === `fill:${part}`);

test("each part answers to a tag of its own and a general one, the same in every language", () => {
  const stretches = (/** @type {any} */ composer) => composer.ranges().filter((/** @type {any} */ r) => r.kind === "numbers");
  const tags = (/** @type {any} */ composer) => stretches(composer).map(partTags);
  assert.deepEqual(tags(arComposer), [
    /* The parts split out of 0 to 10 and 11 to 99 still answer to the old
       tags, so a sentence written with {{11-99}} before the split is filled. */
    ["0-9", "0-10", "number"], ["10-19", "11-99", "number"], ["20-99", "11-99", "number"],
    ["100-999", "number"], ["1000-999999999", "number"], ["1000000000-plus", "number"],
  ]);
  assert.deepEqual(tags(heComposer), tags(arComposer));
  /* And counting, from each stretch, under tags of its own. */
  assert.deepEqual(stretches(arComposer).map((/** @type {any} */ r) => partTags(countingOf(r))), [
    ["count-0-9", "count"], ["count-10-19", "count"], ["count-20-99", "count"],
    ["count-100-999", "count"], ["count-1000-999999999", "count"], ["count-1000000000-plus", "count"],
  ]);
});

test("a part fills its tags with its numbers, written out", () => {
  const sys = { ...SYS, nouns: [] };
  const made = of(fillerCards(arComposer, sys), "numbers:0-9");
  assert.equal(made.length, 10, "the whole of 0 to 9");
  for (const card of made) {
    assert.deepEqual(card.fills, ["0-9", "0-10", "number"]);
    assert.equal(card.drill, false, "borrowed by a sentence, never asked on its own");
    assert.equal(card.kind, "phrase", "kept out of {{word}}");
    assert.ok(card.forms[0].ar);
  }
  assert.deepEqual(made.map((c) => c.forms[0].en), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  /* The same numbers on every device: made twice, the same ids. */
  assert.deepEqual(of(fillerCards(arComposer, sys), "numbers:0-9").map((c) => c.id), made.map((c) => c.id));
  /* And with no nouns, nothing counted is lent. */
  assert.equal(fillerCards(arComposer, sys).filter((c) => (c.fills || []).includes("count")).length, 0);
});

test("a bigger part lends an even spread of itself, not its first dozen", () => {
  const made = of(fillerCards(arComposer, { ...SYS, nouns: [] }), "numbers:20-99");
  assert.ok(made.length > 0 && made.length <= FILLERS_PER_PART);
  const values = made.map((c) => Number(c.forms[0].en));
  assert.ok(Math.max(...values) - Math.min(...values) > 40, `${values} is bunched up`);
});

test("a stretch fills a counting blank with the number in its counting form, and no noun", () => {
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns([nounCard("book"), nounCard("girl")], "ar-PS"));
  const counted = (/** @type {string} */ part) =>
    of(fillerCards(arComposer, sys), part).filter((c) => (c.fills || []).includes("count"));
  const made = counted("numbers:0-9");
  assert.ok(made.length > 0);
  const nouns = [GOLD.book, GOLD.girl].flatMap((n) => [n.sg, n.pl, n.dual]);
  for (const card of made) {
    const form = /** @type {any} */ (card.forms[0]);
    const n = Number(form.en);
    assert.ok(n >= 1 && n <= 9, `${form.en}: nobody counts nought books`);
    assert.equal(form.en, String(n), "the number, and no thing beside it");
    for (const word of nouns) assert.ok(!String(form.ar).split(" ").includes(word), `${form.ar} brings a noun`);
    /* Its own tag and the general one — and the old counting part's tag
       that held this number, so a sentence written with {{count-3-10}}
       is still filled. */
    assert.deepEqual(card.fills, ["count-0-9", n <= 2 ? "count-1-2" : "count-3-10", "count"]);
    assert.equal(form.number, n === 1 ? "singular" : n === 2 ? "dual" : "plural", form.en);
  }
  /* Three before a noun is not three counted aloud. */
  const three = made.find((c) => /** @type {any} */ (c.forms[0]).en === "3");
  const plain = of(fillerCards(arComposer, sys), "numbers:0-9").find((c) => /** @type {any} */ (c.forms[0]).en === "3");
  assert.ok(three && plain);
  assert.notEqual(/** @type {any} */ (three.forms[0]).ar, /** @type {any} */ (plain.forms[0]).ar);
  /* Never a plain number's blank, and never a plain number in a counting
     one. */
  assert.ok(made.every((c) => !(c.fills || []).includes("number")));
  const plains = of(fillerCards(arComposer, sys), "numbers:0-9").filter((c) => !(c.fills || []).includes("count"));
  assert.ok(plains.length && plains.every((c) => !(c.fills || []).some((/** @type {string} */ t) => t.startsWith("count"))));
});

test("a sentence asking for a part's blank is shown the part's numbers on the teacher's screen", () => {
  const sys = { ...SYS, nouns: [] };
  const sentence = { id: "s1", lang: "ar-PS", sentence: true, forms: [{ ar: "{{0-10}}", en: "I am {{0-10}}", lat: "" }] };
  const pool = /** @type {any[]} */ ([sentence, ...fillerCards(arComposer, sys)]);
  const got = fillersFor(sentence.forms[0], pool, LANGUAGES["ar-PS"]);
  assert.equal(got["0-10"].length, 10, "the old tag, filled from 0 to 9");
  assert.equal(got["0-10"][3].en, "3");
});

test("a part that cannot be said yet lends nothing to the sentences that ask for it", () => {
  const sys = { ...SYS, nouns: [], lexemes: {} };
  assert.deepEqual(fillerCards(arComposer, sys), []);
});

test("a counting blank with a noun blank after it counts that noun", () => {
  const cards = [nounCard("book"), nounCard("girl")];
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns(cards, "ar-PS"));
  const lang = LANGUAGES["ar-PS"];
  const sentence = {
    id: "s1", lang: "ar-PS", sentence: true,
    forms: [{ id: "s1", ar: "عندي {{count-0-9}} {{noun}}", en: "I have {{count-0-9}}{{noun}}.", lat: "" }],
  };
  const pool = /** @type {any[]} */ ([sentence, ...cards, ...fillerCards(arComposer, sys)]);
  const { list } = sentencesOf(sentence, sentence.forms[0], pool, lang);
  assert.ok(list.length > 0);
  for (const s of list) {
    /* The number counts the noun drawn beside it, and the noun is not
       said a second time. */
    assert.match(s.en, /^I have \d+ (book|girl)s?\.$/, s.en);
    const noun = s.took.noun.card;
    assert.ok(s.en.includes(noun), `${s.en} counts ${noun}`);
    assert.doesNotMatch(s.ar, /\{\{/);
  }
  assert.ok(list.some((s) => s.took.noun.card === "book") && list.some((s) => s.took.noun.card === "girl"));
  /* Once per number and noun: the plural and the pair add nothing. */
  assert.equal(new Set(list.map((s) => s.en)).size, list.length);
  /* Two books is the dual alone, and still counted. */
  assert.ok(list.some((s) => s.en === "I have 2 books." && s.ar === `عندي ${GOLD.book.dual}`), list.map((s) => s.en).join(" | "));
  /* With no noun blank after it, the counting blank brings no noun: the
     teacher writes it. And two, said only by its noun, is not offered. */
  const alone = { ...sentence.forms[0], ar: "عندي {{count-0-9}} كتب", en: "I have {{count-0-9}} books" };
  const own = sentencesOf(sentence, alone, pool, lang).list;
  assert.ok(own.length > 0);
  for (const s of own) {
    assert.match(s.en, /^I have \d+ books$/);
    assert.notEqual(s.en, "I have 2 books");
    assert.equal(s.ar.split(" ").filter((w) => w === GOLD.book.pl).length, 1, s.ar);
  }
});

/* A system whose every word has a transliteration — made up, and made of
   the slot it is said by, since what is tested is that it is carried. */
const SAID = (/** @type {any} */ sys) => ({
  ...sys,
  lexemes: Object.fromEntries(Object.entries(sys.lexemes).map(([slot, lex]) => [slot, {
    .../** @type {any} */ (lex),
    lat: Object.fromEntries(Object.keys(/** @type {any} */ (lex).forms || {}).map((k) => [k, `${slot}/${k}`])),
  }])),
});
/** A noun card with a transliteration on every answer. */
const saidNoun = (/** @type {string} */ id) => {
  const card = nounCard(id);
  card.forms = card.forms.map((f) => ({ ...f, lat: `${id}-${f.number}` }));
  return card;
};

test("a number in a sentence is said in the transliteration the system and the noun card give it", () => {
  const cards = [saidNoun("book"), saidNoun("girl")];
  const sys = withNouns(SAID({ ...SYS, nouns: [] }), countedNouns(cards, "ar-PS"));
  const lang = LANGUAGES["ar-PS"];
  const sentence = {
    id: "s1", lang: "ar-PS", sentence: true,
    forms: [{ id: "s1", ar: "عندي {{count-0-9}} {{noun}}", en: "I have {{count-0-9}} {{noun}}", lat: "3indi {{count-0-9}} {{noun}}" }],
  };
  const pool = /** @type {any[]} */ ([sentence, ...cards, ...fillerCards(arComposer, sys)]);
  const { list } = sentencesOf(sentence, sentence.forms[0], pool, lang);
  assert.ok(list.length > 0);
  for (const s of list) {
    assert.doesNotMatch(s.lat, /\{\{/, s.lat);
    assert.match(s.lat, /^3indi \S/, s.lat);
    /* The noun counted is said as its card says it, once. */
    assert.equal((s.lat.match(new RegExp(s.took.noun.card, "g")) || []).length, 1, s.lat);
  }
  /* And a counting blank with nothing after it, in its own words alone. */
  const alone = { ...sentence.forms[0], ar: "عندي {{count-0-9}} كتب", en: "I have {{count-0-9}} books", lat: "3indi {{count-0-9}} kutub" };
  for (const s of sentencesOf(sentence, alone, pool, lang).list) {
    assert.match(s.lat, /^3indi \S+.* kutub$/, s.lat);
    assert.doesNotMatch(s.lat, /book-|\{\{/, s.lat);
  }
  /* A plain number too. */
  const plain = { ...sentence.forms[0], ar: "{{0-9}}", en: "{{0-9}}", lat: "{{0-9}}" };
  for (const s of sentencesOf(sentence, plain, pool, lang).list) assert.ok(s.lat && !s.lat.includes("{{"), s.lat);
});

test("a sentence whose number has no transliteration is still a sentence, with no transliteration", () => {
  /* The golden system has none written. */
  const cards = [saidNoun("book")];
  const sys = withNouns({ ...SYS, nouns: [] }, countedNouns(cards, "ar-PS"));
  const lang = LANGUAGES["ar-PS"];
  const sentence = {
    id: "s1", lang: "ar-PS", sentence: true,
    forms: [{ id: "s1", ar: "عندي {{count-0-9}} {{noun}}", en: "I have {{count-0-9}} {{noun}}", lat: "3indi {{count-0-9}} {{noun}}" }],
  };
  const pool = /** @type {any[]} */ ([sentence, ...cards, ...fillerCards(arComposer, sys)]);
  const { list } = sentencesOf(sentence, sentence.forms[0], pool, lang);
  assert.ok(list.length > 0, "every sentence is still made");
  for (const s of list) {
    /* Two books is the noun's pair alone, with no number word, so it is
       said whole; every other number is not. */
    if (s.en === "I have 2 books") assert.equal(s.lat, "3indi book-dual");
    else assert.equal(s.lat, "", "no line, rather than one with a blank's name in it");
    assert.match(s.en, /^I have \d+ books?$/);
    assert.doesNotMatch(s.ar, /\{\{/);
  }
});

test("a word with no English leaves the sentence's English out, and its transliteration in", () => {
  const value = (/** @type {any} */ v) => ({ id: "", ...v });
  const form = { ar: "أنا {{name}}", en: "I am {{name}}", lat: "ana {{name}}", answers: [{ text: "أنا {{name}}", lat: "ana {{name}}" }] };
  const unsaid = { name: value({ ar: "سامي", en: "", lat: "sami" }) };
  const filled = /** @type {any} */ (fillForm(form, unsaid));
  assert.equal(filled.en, "");
  assert.equal(filled.lat, "ana sami");
  assert.deepEqual(fieldsLost(form, unsaid), ["en"]);
  const unspelt = { name: value({ ar: "سامي", en: "Sami", lat: "", proper: true }) };
  const other = /** @type {any} */ (fillForm(form, unspelt));
  assert.equal(other.lat, "");
  assert.equal(other.answers[0].lat, "");
  assert.equal(other.en, "I am Sami");
  assert.deepEqual(fieldsLost(form, unspelt), ["lat"]);
  /* A sentence with no transliteration of its own loses nothing. */
  assert.deepEqual(fieldsLost({ ...form, lat: "" }, unspelt), []);
  /* And a blank nothing was offered for still stands, as a visible bug. */
  assert.equal(/** @type {any} */ (fillForm(form, {})).lat, "ana {{name}}");
});
