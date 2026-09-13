/*
 * A verb's forms, as a table over the card's own sub-forms.
 *
 * Three promises are checked here, and they are the three the feature is
 * made of. A cell is a sub-form and nothing more, so everything that walks
 * sub-forms keeps working. The rows open one at a time, so a learner is
 * never handed the present, the past and the command in one week. And the
 * verb agrees with whatever fills the sentence around it, out of grammar
 * the cards already carry.
 *
 * The fourth thing checked is the one that is easiest to lose: that none
 * of it knows what a tense is. Every assertion about Arabic below has a
 * Vietnamese twin, because a table one column wide is the whole
 * language-agnostic claim.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  VERB_SLOT,
  agreedCell,
  cellAt,
  cellIsOpen,
  cellsOf,
  colOf,
  composeEnglish,
  framesOf,
  isCell,
  isFrame,
  isVerb,
  openRows,
  personFor,
  personsOf,
  rowOf,
  subjectSlot,
  tableCount,
  tableOf,
  tensesOf,
} from "../src/verbs.ts";
import { LANGUAGES, teachesVerbs, verbOf } from "../src/languages.ts";
import { slotsOf } from "../src/variables.ts";
import { must } from "./helpers.mjs";

const arabic = must(verbOf(LANGUAGES["ar-PS"]), "the Arabic verb table");
const viet = must(verbOf(LANGUAGES["vi-Hue"]), "the Vietnamese verb table");

/* "To eat", as a teacher would leave it: the present filled in, the past
   filled in, and a command that exists for the three persons it can be
   addressed to and for nobody else. */
/** @param {string} row @param {string} col @param {string} ar @param {string} en @returns {any} */
const cell = (row, col, ar, en) => ({ id: `s-${row}-${col}`, row, col, ar, en, lat: "" });

const toEat = {
  id: "eat",
  ar: "أكل",
  en: "to eat",
  subs: [
    cell("present", "i", "باكل", "I eat"),
    cell("present", "he", "بياكل", "he eats"),
    cell("present", "she", "بتاكل", "she eats"),
    cell("present", "they", "بياكلوا", "they eat"),
    cell("past", "he", "أكل", "he ate"),
    cell("past", "she", "أكلت", "she ate"),
    cell("past", "they", "أكلوا", "they ate"),
    cell("command", "you-m", "كول", "you (m): eat!"),
  ],
};

/* And "to eat" in Huế, which is one word and three markers. */
const toEatViet = {
  id: "an",
  ar: "ăn",
  en: "to eat",
  subs: [
    cell("plain", "any", "ăn", "eat"),
    cell("past", "any", "đã ăn", "ate"),
  ],
};

const MASTERED = "review";
const LEARNING = "learning";

test("a cell is a sub-form carrying where it sits, and nothing more", () => {
  const one = must(cellAt(toEat, "past", "she"), "the she-past cell");
  assert.equal(one.ar, "أكلت");
  assert.equal(rowOf(one), "past");
  assert.equal(colOf(one), "she");
  assert.ok(isCell(one));

  /* Both halves or neither. A form carrying one of them places nothing,
     and guessing the other would file a word under a person nobody said
     it was. */
  assert.equal(isCell({ row: "past" }), false);
  assert.equal(isCell({ col: "she" }), false);
  assert.equal(isCell({ ar: "كتاب", en: "book" }), false);
});

test("an ordinary card has no table, and nothing here throws on one", () => {
  const book = { id: "b", ar: "كِتاب", en: "book", subs: [{ id: "s1", ar: "كُتُب", en: "books" }] };
  assert.equal(isVerb(book), false);
  assert.deepEqual(cellsOf(book), []);
  assert.equal(cellAt(book, "past", "she"), null);

  /* And on nothing at all, which is what a half-written draft is. */
  assert.equal(isVerb(null), false);
  assert.deepEqual(cellsOf(undefined), []);
  assert.equal(rowOf(null), "");
  assert.equal(cellAt(null, "past", "she"), null);
  assert.deepEqual(openRows(null, null, () => true), []);
});

test("the alternate forms of a verb card are still alternate forms", () => {
  /* A verb may have a plural or a second dialect spelling like any other
     word. Those are not cells, and must not be swept into the table. */
  const withSub = { ...toEat, subs: toEat.subs.concat([{ id: "s9", ar: "ياكل", en: "eats" }]) };
  assert.equal(cellsOf(withSub).length, 8);
  assert.equal(cellAt(withSub, "present", "we"), null);
});

test("a cell's English is composed from the row and the column", () => {
  assert.equal(composeEnglish(arabic, "past", "she", "ate"), "she ate");
  assert.equal(composeEnglish(arabic, "present", "i", "eat"), "I eat");
  /* A command is addressed to somebody rather than said about them, and
     the language says so on the row. */
  assert.equal(composeEnglish(arabic, "command", "you-m", "eat!"), "you (m): eat!");
  /* Nothing to compose from is nothing, not a bare pronoun. */
  assert.equal(composeEnglish(arabic, "past", "she", ""), "");
  /* A language whose verbs do not vary by person has an unlabelled column,
     and its row's English stands alone. */
  assert.equal(composeEnglish(viet, "past", "any", "ate"), "ate");
});

test("the subject's grammar picks the column", () => {
  const she = must(personFor(arabic, { number: "singular", gender: "feminine" }), "she");
  assert.equal(she.id, "she");
  const he = must(personFor(arabic, { number: "singular", gender: "masculine" }), "he");
  assert.equal(he.id, "he");
  /* "they" asks for number alone, so either gender reaches it. */
  assert.equal(must(personFor(arabic, { number: "plural", gender: "feminine" }), "they").id, "they");
  assert.equal(must(personFor(arabic, { number: "plural" }), "they").id, "they");
});

test("the most specific column wins, whatever order they are declared in", () => {
  /* "she" asks for number and gender; "they" for number alone. A singular
     feminine matches only one of them, but the rule that decides is the
     count of what was asked for, not the order — so a pack can declare a
     general column and a narrow one without ranking them by hand. */
  const spec = /** @type {import("../src/types.ts").VerbSpec} */ ({
    persons: [
      { id: "any-sing", label: "one of them", picks: { number: "singular" } },
      { id: "she", label: "she", picks: { number: "singular", gender: "feminine" } },
    ],
    tenses: [{ id: "past", label: "past" }],
  });
  assert.equal(must(personFor(spec, { number: "singular", gender: "feminine" }), "she").id, "she");
  assert.equal(
    must(personFor(spec, { number: "singular", gender: "masculine" }), "the loose one").id,
    "any-sing",
  );
});

test("nothing in the subject picks nothing", () => {
  /* A column with no `picks` is never chosen this way, which is right for
     I, you and we: no noun dropped into a subject is ever the first or
     second person. */
  assert.equal(personFor(arabic, {}), null);
  assert.equal(personFor(arabic, null), null);
  assert.equal(personFor(arabic, { gender: "feminine" }), null);
  /* And a language that declares no agreement never agrees. */
  assert.equal(personFor(viet, { number: "singular", gender: "feminine" }), null);
});

test("the sentence takes the form its subject calls for", () => {
  const sarah = { number: "singular", gender: "feminine" };
  const ahmad = { number: "singular", gender: "masculine" };
  const kids = { number: "plural" };

  assert.equal(must(agreedCell(toEat, arabic, "past", sarah), "she ate").ar, "أكلت");
  assert.equal(must(agreedCell(toEat, arabic, "past", ahmad), "he ate").ar, "أكل");
  assert.equal(must(agreedCell(toEat, arabic, "past", kids), "they ate").ar, "أكلوا");
  /* The row is the sentence's: the same subject, a different tense. */
  assert.equal(must(agreedCell(toEat, arabic, "present", sarah), "she eats").ar, "بتاكل");
});

test("a sentence wanting a form the teacher left blank asks nothing", () => {
  /* There is no command for "she", and no "we" anywhere in this card. The
     answer is nothing rather than an invented form or a nearby one. */
  assert.equal(agreedCell(toEat, arabic, "command", { number: "singular", gender: "feminine" }), null);
  assert.equal(agreedCell(toEat, arabic, "past", { number: "singular", gender: "neutral" }), null);
});

test("the verb's own hole is the one no card fills", () => {
  const frame = { ar: "{{name}} {{verb}} {{object}}", en: "{{name}} {{verb}} {{object}}", lat: "" };
  const slots = slotsOf(frame);
  assert.deepEqual(slots, ["name", VERB_SLOT, "object"]);
  /* The subject is the first hole that is not the verb's own, taken by
     position so a teacher does not have to say it twice. */
  assert.equal(subjectSlot(slots), "name");
  assert.equal(subjectSlot([VERB_SLOT]), "");
});

test("a sentence has a row and no column; a cell has both", () => {
  const frame = { id: "f1", row: "past", ar: "{{name}} {{verb}} {{object}}", en: "", lat: "" };
  const card = { ...toEat, subs: toEat.subs.concat([frame]) };
  assert.ok(isFrame(frame));
  assert.equal(isCell(frame), false);
  assert.deepEqual(framesOf(card).map((f) => f.id), ["f1"]);
  /* And a sentence is not swept into the table it draws from. */
  assert.equal(cellsOf(card).length, 8);
});

test("the first row is open and the next waits on it", () => {
  const fresh = openRows(toEat, arabic, () => false);
  assert.deepEqual(fresh, ["present"]);

  /* Every cell of the present mastered, so the past opens — and the
     command does not, because the past has not been touched. */
  const done = new Set(["present"]);
  const open = openRows(toEat, arabic, (c) => done.has(rowOf(c)));
  assert.deepEqual(open, ["present", "past"]);

  const both = new Set(["present", "past"]);
  assert.deepEqual(openRows(toEat, arabic, (c) => both.has(rowOf(c))), [
    "present",
    "past",
    "command",
  ]);
});

test("one cell short of mastered holds the row shut", () => {
  const all = cellsOf(toEat);
  const laggard = must(all.find((c) => rowOf(c) === "present" && colOf(c) === "she"), "she-present");
  const open = openRows(toEat, arabic, (c) => c.id !== laggard.id);
  assert.deepEqual(open, ["present"]);
});

test("a lapse closes the rows above it", () => {
  /* Nothing here does that on purpose: the test of mastery is read as it
     now stands, so a row that falls back shuts the ones under it by the
     same rule that opened them. */
  /** @type {Record<string, string>} */
  const states = { present: MASTERED, past: MASTERED, command: LEARNING };
  const before = openRows(toEat, arabic, (c) => states[rowOf(c)] === MASTERED);
  assert.deepEqual(before, ["present", "past", "command"]);

  states.present = LEARNING;
  const after = openRows(toEat, arabic, (c) => states[rowOf(c)] === MASTERED);
  assert.deepEqual(after, ["present"]);
});

test("a row the teacher left blank is passed straight through", () => {
  /* Nothing there to master, so it cannot be what the rows below are
     waiting on — the alternative is a table that can never open past a gap
     somebody left. */
  const noPast = { ...toEat, subs: toEat.subs.filter((c) => c.row !== "past") };
  const open = openRows(noPast, arabic, (c) => rowOf(c) === "present");
  assert.deepEqual(open, ["present", "past", "command"]);
});

test("a cell of a closed row is not open, and a non-cell always is", () => {
  const she = must(cellAt(toEat, "past", "she"), "she ate");
  assert.equal(cellIsOpen(toEat, arabic, she, () => false), false);
  assert.equal(cellIsOpen(toEat, arabic, she, () => true), true);
  /* An ordinary form was never behind this gate. */
  assert.equal(cellIsOpen(toEat, arabic, { ar: "كتاب" }, () => false), true);
});

test("the table is crossed row by row, in teaching order", () => {
  const all = tableOf(toEat, arabic);
  assert.equal(all.length, tensesOf(arabic).length * personsOf(arabic).length);
  assert.equal(all[0].row, "present");
  assert.equal(all[0].col, "i");
  /* Within a row, the language's own order of persons — so I and you come
     before they, wherever a caller deals from this. */
  assert.deepEqual(
    all.slice(0, 3).map((c) => c.col),
    ["i", "you-m", "you-f"],
  );
  const { filled, blank } = tableCount(toEat, arabic);
  assert.equal(filled, 8);
  assert.equal(filled + blank, all.length);
});

test("Vietnamese is the same code over a table one column wide", () => {
  assert.ok(teachesVerbs(LANGUAGES["vi-Hue"]));
  assert.equal(personsOf(viet).length, 1);
  assert.equal(tensesOf(viet).length, 4);

  assert.equal(must(cellAt(toEatViet, "past", "any"), "đã ăn").ar, "đã ăn");
  assert.equal(tableCount(toEatViet, viet).filled, 2);

  /* Its rows gate exactly as Arabic's do. */
  assert.deepEqual(openRows(toEatViet, viet, () => false), ["plain"]);
  assert.deepEqual(
    openRows(toEatViet, viet, (c) => rowOf(c) === "plain"),
    ["plain", "past"],
  );
  /* And past that, the rows nobody has written cells for fall through. */
  assert.deepEqual(openRows(toEatViet, viet, () => true), [
    "plain",
    "past",
    "ongoing",
    "future",
  ]);
});

test("a language that lays out no verbs has no table", () => {
  const bare = /** @type {any} */ ({ id: "xx", name: "Nowhere", grammar: [] });
  assert.equal(teachesVerbs(bare), false);
  assert.equal(verbOf(bare), null);
  assert.deepEqual(tensesOf(null), []);
  assert.deepEqual(personsOf(null), []);
  assert.deepEqual(tableOf(toEat, null), []);
  assert.equal(agreedCell(toEat, null, "past", { number: "plural" }), null);
});
