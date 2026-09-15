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
  citationOf,
  citedCell,
  citedWord,
  colOf,
  framesOf,
  isCell,
  isCitation,
  isFrame,
  ownSlot,
  picksOf,
  agreeWith,
  agreedValue,
  hasCells,
  cellsIn,
  openRows,
  personFor,
  personsOf,
  rowOf,
  subjectSlot,
  tableCount,
  tableOf,
  tensesOf,
} from "../src/verbs.ts";
import { LANGUAGES, attachedOf, takesAttached, teachesVerbs, verbOf, specOf } from "../src/languages.ts";
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
  assert.equal(hasCells(book, arabic), false);
  assert.deepEqual(cellsOf(book), []);
  assert.equal(cellAt(book, "past", "she"), null);

  /* And on nothing at all, which is what a half-written draft is. */
  assert.equal(hasCells(null, arabic), false);
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

test("a cell says what it was given, and nothing is derived from it", () => {
  /* There was a compose step here, making a cell's English from the row's
     and the column's label. It is gone: English inflects the present, so
     "eat" across a row gave "he eat" beside "I eat", and a rule that knew
     better would be a rule about English in a file that knows no language.
     What a cell means is now only ever what somebody typed, which is what
     this checks — read it back exactly, whatever the row and column. */
  assert.equal(must(cellAt(toEat, "present", "he"), "he eats").en, "he eats");
  assert.equal(must(cellAt(toEat, "present", "i"), "I eat").en, "I eat");
  assert.equal(must(cellAt(toEat, "command", "you-m"), "the command").en, "you (m): eat!");
  assert.equal(must(cellAt(toEatViet, "past", "any"), "đã ăn").en, "ate");
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

test("the verb's hole is its own only in its own sentence", () => {
  /* On the card's own sentence — a row and no column — {{verb}} is filled
     from the table below it, and no card in the deck fills it. */
  const own = { id: "f1", row: "past", ar: "{{name}} {{verb}}", en: "", lat: "" };
  assert.equal(ownSlot(own), VERB_SLOT);

  /* Anywhere else it is an ordinary blank named after a kind of word,
     filled by the verbs the teacher has written — which is what lets a
     sentence card ask for one at all. Until 0.139 it was always the
     card's own, so a sentence could name every kind of word its language
     declared except the one a sentence most needs. */
  const sentence = { id: "s1", ar: "{{name}} {{verb}}", en: "", lat: "" };
  assert.equal(ownSlot(sentence), "");
  assert.equal(ownSlot({ id: "c1", row: "past", col: "he", ar: "أكل", en: "", lat: "" }), "",
    "and a cell of the table is not a sentence at all");
  assert.equal(ownSlot(null), "");
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

/*
 * The form a dictionary lists, where the language has no infinitive.
 *
 * Arabic's *to eat* is listed under أكل, which is the he-past and so a
 * cell of this very table. Said plainly: a card's own word and that cell
 * are one word. Left unsaid, they are one word drilled twice — asked,
 * marked and scheduled as though they were two things to learn.
 */
test("a language says which cell a dictionary would list, or says nothing", () => {
  assert.deepEqual(citationOf(arabic), { row: "past", col: "he" });
  /* Huế cites the bare verb, which is a card's word and not a cell of
     anything, so there is nothing to reconcile. */
  assert.equal(citationOf(viet), null);
  assert.equal(citationOf(null), null);

  /* A pack naming a cell its own table has not got is naming nothing.
     Taken at its word, a card's own form would be silenced in favour of a
     cell that can never exist. */
  const wrong = { persons: personsOf(arabic), tenses: tensesOf(arabic), citation: { row: "future", col: "he" } };
  assert.equal(citationOf(wrong), null);
  const alsoWrong = { persons: personsOf(arabic), tenses: tensesOf(arabic), citation: { row: "past", col: "nobody" } };
  assert.equal(citationOf(alsoWrong), null);
});

test("the cited cell is the one it names, and only that one", () => {
  assert.ok(isCitation(arabic, must(cellAt(toEat, "past", "he"), "he ate")));
  assert.equal(isCitation(arabic, must(cellAt(toEat, "past", "she"), "she ate")), false);
  assert.equal(isCitation(arabic, must(cellAt(toEat, "present", "he"), "he eats")), false);
  /* A language that cites nothing cites nothing. */
  assert.equal(isCitation(viet, must(cellAt(toEatViet, "plain", "any"), "ăn")), false);
  assert.equal(isCitation(arabic, { ar: "kitaab" }), false);
});

test("the card's word is stood in for only where the cell is actually written", () => {
  assert.equal(must(citedCell(toEat, arabic), "the cited cell").ar, "أكل");
  /* Left blank, the card's word is all there is of the verb, and goes on
     being practised as itself rather than being silenced for nothing. */
  const noPast = { ...toEat, subs: toEat.subs.filter((c) => !(c.row === "past" && c.col === "he")) };
  assert.equal(citedCell(noPast, arabic), null);
  /* And a language that cites nothing never stands in for anything. */
  assert.equal(citedCell(toEatViet, viet), null);
});

test("the cited cell is open from the start, whatever row it sits in", () => {
  /* Arabic cites the past, which is the second row. Without the exception
     a learner would hold a card reading "to eat" whose word they were not
     shown until the whole present tense was mastered. */
  const he = must(cellAt(toEat, "past", "he"), "he ate");
  assert.equal(cellIsOpen(toEat, arabic, he, () => false), true);

  /* The rest of its row still waits its turn. */
  const she = must(cellAt(toEat, "past", "she"), "she ate");
  assert.equal(cellIsOpen(toEat, arabic, she, () => false), false);

  /* And the row itself is still an ordinary row: the command opens once
     every cell of the past is mastered, the cited one included. */
  const done = new Set(["present"]);
  assert.deepEqual(openRows(toEat, arabic, (c) => done.has(rowOf(c))), ["present", "past"]);
});

/* --- the card's own word, off the cell that stands in for it ---

   Where a language cites a cell, the editor stops asking for the card's
   word a second time and reads it off the table. The card is still saved
   with a word of its own — the face every list shows, what a search
   matches — so where that word comes from is worth pinning down. */

test("the cited cell becomes the card's own word", () => {
  const own = { ar: "", en: "", lat: "", clips: [], slowClips: [], number: "singular" };
  const word = citedWord(own, must(citedCell(toEat, arabic), "the cited cell"));
  assert.equal(word.ar, "أكل");
  assert.equal(word.en, "he ate");
  /* Everything that is a fact about the card rather than about the cell
     stays: a cell knows a word, not which deck it is in. */
  assert.equal(word.number, "singular");
});

test("an empty cell leaves an empty word, not the last one typed", () => {
  /* Which is what lets the editor refuse a verb whose dictionary form has
     been left blank, rather than quietly saving a card labelled with a
     word no cell holds. */
  const own = { ar: "أكل", en: "to eat", lat: "akal", clips: [], slowClips: [] };
  assert.deepEqual(
    { ar: citedWord(own, null).ar, en: citedWord(own, null).en, lat: citedWord(own, null).lat },
    { ar: "", en: "", lat: "" },
  );
});

test("the recordings travel with the word, so the card's face can be heard", () => {
  const heard = { row: "past", col: "he", ar: "أكل", en: "he ate", lat: "akal", clips: ["c1"], slowClips: ["c2"] };
  const word = citedWord({ ar: "", en: "", lat: "", clips: [], slowClips: [] }, heard);
  assert.deepEqual(word.clips, ["c1"]);
  assert.deepEqual(word.slowClips, ["c2"]);
});

test("a language that cites nothing has no cell to take a word from", () => {
  /* Huế cites the bare verb, which is a word and not a cell — so its card
     keeps the block the other two no longer show, and citedWord is never
     reached. The guard is citationOf, and this is what it answers. */
  assert.equal(citationOf(viet), null);
  assert.deepEqual(citationOf(arabic), { row: "past", col: "he" });
});

/*
 * Two tables on one card, told apart by the row a cell sits in.
 *
 * A verb's persons and tenses, and the pronouns a word takes on its end,
 * are both tables of sub-forms — so "has a cell" stopped being the same
 * question as "is a verb" the moment there were two. A cell belongs to
 * whichever table declares its row, and the rows of one are names no other
 * uses.
 */
test("a card's cells belong to the table that declares their row", () => {
  const attached = must(attachedOf(LANGUAGES["ar-PS"]), "the Arabic attached-pronoun table");
  const book = {
    id: "book",
    ar: "كِتاب",
    en: "book",
    subs: [
      { id: "a-me", row: "attached", col: "me", ar: "كتابي", en: "my book", lat: "" },
      { id: "a-you", row: "attached", col: "you-m", ar: "كتابك", en: "your book", lat: "" },
    ],
  };

  /* A word with pronouns on it is not a verb, which is the whole reason
     this question takes a table. Read the other way round, a verb is not a
     word that takes pronouns. */
  assert.equal(hasCells(book, attached), true);
  assert.equal(hasCells(book, arabic), false);
  assert.equal(hasCells(toEat, arabic), true);
  assert.equal(hasCells(toEat, attached), false);

  assert.deepEqual(cellsIn(book, attached).map((c) => c.col), ["me", "you-m"]);
  assert.deepEqual(cellsIn(book, arabic), []);

  /* One row, so the table is a line of it. Its cells are read by the same
     functions a verb's are, which is what made it cheap. */
  assert.equal(tensesOf(attached).length, 1);
  assert.equal(personsOf(attached).length, 8);
  assert.equal(tableOf(book, attached).length, 8);
  assert.deepEqual(tableCount(book, attached), { filled: 2, blank: 6 });
  assert.equal(must(cellAt(book, "attached", "me"), "the me cell").ar, "كتابي");

  /* And nothing about agreement: a sentence does not choose between my
     book and your book by looking at who is in it. */
  assert.equal(personFor(attached, { number: "singular", gender: "feminine" }), null);
});

test("and a language that attaches none has no such table", () => {
  assert.equal(attachedOf(LANGUAGES["vi-Hue"]), null);
  assert.equal(takesAttached(LANGUAGES["vi-Hue"]), false);
  assert.equal(takesAttached(LANGUAGES["ar-PS"]), true);
  assert.equal(takesAttached(LANGUAGES["he-IL"]), true);
  /* Asked of nothing, it comes back empty rather than throwing — the same
     answer every function here gives a half-written draft. */
  assert.deepEqual(cellsIn(null, attachedOf(LANGUAGES["vi-Hue"])), []);
  assert.equal(hasCells({ subs: [] }, null), false);
});

/*
 * Whose table a cell is in.
 *
 * The pronouns a word takes on its end belong to a *form*, not to the
 * card: the plural takes the same endings and has eight of its own. So
 * every form carries a table and a cell says which — and two of them have
 * a *me* apiece, which is exactly what a row and a column alone cannot
 * tell apart.
 */
test("two forms of one word each have their own table", () => {
  const attached = must(attachedOf(LANGUAGES["ar-PS"]), "the Arabic attached-pronoun table");
  const book = {
    id: "book",
    ar: "كِتاب",
    en: "book",
    subs: [
      /* The plural, as a form of the card. */
      { id: "pl", ar: "كتب", en: "books", lat: "" },
      /* The singular's pronouns, which name no owner: the card's own word.
         This is what every cell written before 0.131 looks like. */
      { id: "a-me", row: "attached", col: "me", ar: "كتابي", en: "my book", lat: "" },
      /* And the plural's, which name theirs. */
      { id: "p-me", of: "pl", row: "attached", col: "me", ar: "كتبي", en: "my books", lat: "" },
      { id: "p-you", of: "pl", row: "attached", col: "you-m", ar: "كتبك", en: "your books", lat: "" },
    ],
  };

  /* Asked about one table, one table's cells come back. */
  assert.deepEqual(cellsIn(book, attached, "").map((c) => c.id), ["a-me"]);
  assert.deepEqual(cellsIn(book, attached, "pl").map((c) => c.id), ["p-me", "p-you"]);
  /* Asked about the card, all of them: whether this card has such a table
     at all is a different question from what one table holds. */
  assert.deepEqual(cellsIn(book, attached).map((c) => c.id), ["a-me", "p-me", "p-you"]);
  assert.equal(hasCells(book, attached, "pl"), true);
  assert.equal(hasCells(book, attached, "nobody"), false);

  /* And a cell is looked up in a named table, because two of them sit at
     the same row and column. Without the owner this was whichever was
     typed first. */
  assert.equal(must(cellAt(book, "attached", "me"), "the word's own me").ar, "كتابي");
  assert.equal(must(cellAt(book, "attached", "me", "pl"), "the plural's me").ar, "كتبي");
  assert.equal(cellAt(book, "attached", "you-m"), null);

  /* Which is what the teacher's grid is drawn from: eight boxes per form,
     filled from that form's own cells. */
  assert.deepEqual(tableCount(book, attached), { filled: 1, blank: 7 });
  assert.deepEqual(tableCount(book, attached, "pl"), { filled: 2, blank: 6 });
});

/*
 * A verb's table is the card's, and passes no owner at all — so nothing
 * about a verb changed. The gate down the rows is the place that would
 * show it if anything had: it reads the cells of a table, and reading the
 * wrong ones would open every row at once or none of them.
 */
test("a verb's table is unaffected by whose table a cell is in", () => {
  assert.deepEqual(openRows(toEat, arabic, () => false), ["present"]);
  assert.deepEqual(openRows(toEat, arabic, () => true), ["present", "past", "command"]);
  const she = must(cellAt(toEat, "past", "she"), "she ate");
  assert.equal(cellIsOpen(toEat, arabic, she, () => false), false);
  assert.equal(cellIsOpen(toEat, arabic, she, () => true), true);
  assert.equal(must(citedCell(toEat, arabic), "the cited cell").en, "he ate");
});

/*
 * And a row of one form's table is held up by that form's cells, not by
 * another's. One table mastered while the other is untouched opens the
 * rows of the first and none of the second.
 */
test("a row waits on its own table's cells", () => {
  /* Two tables of a verb's shape on one card, which is not a card anybody
     writes — but it is the only way to ask this of a table with more than
     one row, and what it checks is the rule rather than the card. */
  const doubled = {
    id: "both",
    subs: [
      { id: "mine-present", row: "present", col: "i", ar: "a", en: "a", lat: "" },
      { id: "mine-past", row: "past", col: "i", ar: "b", en: "b", lat: "" },
      { id: "yours-present", of: "other", row: "present", col: "i", ar: "c", en: "c", lat: "" },
      { id: "yours-past", of: "other", row: "past", col: "i", ar: "d", en: "d", lat: "" },
    ],
  };
  const done = new Set(["mine-present"]);
  /* The card's own table has its present mastered, so its past opens —
     and stops there, its own past being untouched. */
  assert.deepEqual(openRows(doubled, arabic, (c) => done.has(c.id)), ["present", "past"]);
  /* The other form's has not, so it stands where it was. */
  assert.deepEqual(openRows(doubled, arabic, (c) => done.has(c.id), "other"), ["present"]);
  /* Which is what cellIsOpen answers for a cell, off the cell's own
     owner — the caller never has to say. */
  const theirs = must(cellAt(doubled, "past", "i", "other"), "the other form's past");
  assert.equal(cellIsOpen(doubled, arabic, theirs, (c) => done.has(c.id)), false);
  const ours = must(cellAt(doubled, "past", "i"), "the card's own past");
  assert.equal(cellIsOpen(doubled, arabic, ours, (c) => done.has(c.id)), true);
});

/* ------------------------------------------------------------------
   Agreement out of a one-row table

   An adjective lends its own word into a hole, and the sentence goes back
   to its card for the form that agrees with the noun beside it. The rule
   is the verb's — a column picks on the filler's grammar, most specific
   wins — with two things added: a column may be called for by more than
   one kind of filler, and "no column" means the word itself.
   ------------------------------------------------------------------ */

const arAgree = must(specOf(LANGUAGES["ar-PS"], "agreement"), "Arabic agreement");
const big = {
  id: "big", ar: "كبير", en: "big", lat: "kbiir",
  subs: [
    { id: "big-f", row: "agreement", col: "feminine", ar: "كبيرة", en: "big", lat: "kbiire" },
    { id: "big-pl", row: "agreement", col: "plural", ar: "كبار", en: "big", lat: "kbaar" },
  ],
};
const own = { id: "big", ar: "كبير", en: "big", lat: "kbiir" };
/** @param {Record<string, string>} grammar */
const beside = (grammar) => ({ grammar });

test("a column may be called for by more than one kind of filler", () => {
  assert.deepEqual(picksOf({ id: "x", label: "" }), []);
  assert.deepEqual(picksOf({ id: "x", label: "", picks: { a: "1" } }), [{ a: "1" }]);
  assert.deepEqual(picksOf({ id: "x", label: "", picks: [{ a: "1" }, { b: "2" }] }), [{ a: "1" }, { b: "2" }]);
  /* Arabic's feminine adjective: a feminine singular noun, or a plural of
     things. A plural of people goes to the plural column, which asks for
     two things and so beats the alternative that asks for one. */
  assert.equal(must(personFor(arAgree, { number: "singular", gender: "feminine" }), "f").id, "feminine");
  assert.equal(must(personFor(arAgree, { number: "plural", human: "thing", gender: "masculine" }), "pl thing").id, "feminine");
  assert.equal(must(personFor(arAgree, { number: "plural", human: "person", gender: "masculine" }), "pl person").id, "plural");
  assert.equal(personFor(arAgree, { number: "singular", gender: "masculine" }), null, "nothing picks the word itself");
});

test("an agreeing filler reads the first other hole, which is the verb's rule too", () => {
  assert.equal(agreeWith(["noun", "adjective"], "adjective"), "noun");
  assert.equal(agreeWith(["adjective", "noun"], "adjective"), "noun");
  assert.equal(agreeWith(["name", "verb", "object"], "verb"), subjectSlot(["name", "verb", "object"]));
  assert.equal(agreeWith(["adjective"], "adjective"), "", "nothing to agree with");
});

test("the form that agrees: the cell a column picks, the word where none does, nothing where the cell is blank", () => {
  assert.deepEqual(agreedValue(big, arAgree, own, beside({ number: "singular", gender: "feminine", human: "thing" })),
    { id: "big-f", ar: "كبيرة", en: "big", lat: "kbiire" });
  assert.deepEqual(agreedValue(big, arAgree, own, beside({ number: "plural", gender: "masculine", human: "thing" })),
    { id: "big-f", ar: "كبيرة", en: "big", lat: "kbiire" }, "a plural of things takes the feminine singular");
  assert.deepEqual(agreedValue(big, arAgree, own, beside({ number: "plural", gender: "masculine", human: "person" })),
    { id: "big-pl", ar: "كبار", en: "big", lat: "kbaar" }, "and a plural of people the plural");
  assert.equal(agreedValue(big, arAgree, own, beside({ number: "singular", gender: "masculine", human: "thing" })), own,
    "a masculine singular noun wants the word itself");
  assert.equal(agreedValue(big, arAgree, own, null), own, "and so does nothing to agree with");
  /* A cell the teacher left blank is nothing to ask — the rule a verb's
     own sentence already follows. */
  const half = { ...big, subs: [big.subs[0], { ...big.subs[1], ar: "" }] };
  assert.equal(agreedValue(half, arAgree, own, beside({ number: "plural", human: "person" })), null);
  /* A table with more than one row cannot say which, so nothing agrees
     out of it here: that is the verb's own sentence's job. */
  assert.equal(agreedValue(big, arabic, own, beside({ number: "singular", gender: "feminine" })), own);
});

test("a number agrees by the noun's gender alone, and the cell says the rest", () => {
  const counted = must(specOf(LANGUAGES["ar-PS"], "counted"), "counted");
  const three = { id: "3", ar: "ثلاثة", en: "three", lat: "", subs: [{ id: "3-f", row: "counted", col: "feminine", ar: "ثلاث", en: "three", lat: "" }] };
  const word = { id: "3", ar: "ثلاثة", en: "three", lat: "" };
  assert.equal(must(agreedValue(three, counted, word, beside({ number: "plural", gender: "feminine", human: "thing" })), "f").ar, "ثلاث");
  assert.equal(agreedValue(three, counted, word, beside({ number: "plural", gender: "masculine", human: "thing" })), word);
});

test("Hebrew agrees in number and gender at once", () => {
  const he = must(specOf(LANGUAGES["he-IL"], "agreement"), "Hebrew agreement");
  const card = { id: "g", ar: "גדול", en: "big", lat: "", subs: [
    { id: "g-f", row: "agreement", col: "feminine", ar: "גדולה", en: "big", lat: "" },
    { id: "g-mp", row: "agreement", col: "masc-plural", ar: "גדולים", en: "big", lat: "" },
    { id: "g-fp", row: "agreement", col: "fem-plural", ar: "גדולות", en: "big", lat: "" },
  ] };
  const word = { id: "g", ar: "גדול", en: "big", lat: "" };
  assert.equal(must(agreedValue(card, he, word, beside({ number: "plural", gender: "feminine" })), "fp").ar, "גדולות");
  assert.equal(must(agreedValue(card, he, word, beside({ number: "plural", gender: "masculine" })), "mp").ar, "גדולים");
  assert.equal(agreedValue(card, he, word, beside({ number: "singular", gender: "masculine" })), word);
});
