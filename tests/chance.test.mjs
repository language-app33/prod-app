/*
 * The matching grids: how a session's pair questions are dealt into grids,
 * and how a grid puts its two columns up.
 *
 * Nothing here reads a clock or a global, so every assertion is exact:
 * the dealing is a function of the words and the shuffling a function of
 * the seed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_PAIR_WORDS, PAIR_DECOYS, PAIR_WORDS, matchGroups, matchSet } from "../src/chance.ts";

/** @param {string} id @param {string} [ar] @param {string} [en] */
const word = (id, ar = `ع${id}`, en = `meaning ${id}`) => ({ id, ar, en });
/** @param {number} n @param {string} [prefix] */
const words = (n, prefix = "w") => Array.from({ length: n }, (_, i) => word(`${prefix}${i}`));
const textOf = (/** @type {{ar: string}} */ w) => w.ar;
const meaningOf = (/** @type {{en: string}} */ w) => w.en;
const ids = (/** @type {{id: string}[]} */ list) => list.map((w) => w.id);

test("every word the session means to ask is dealt, five to a grid", () => {
  const { grids, dropped } = matchGroups({ wanting: words(5), spares: [], textOf, meaningOf });
  assert.equal(grids.length, 1);
  assert.deepEqual(ids(grids[0]).sort(), ids(words(5)).sort());
  assert.deepEqual(dropped, []);
});

test("more than a grid's worth is dealt round, not five and the rest", () => {
  const { grids, dropped } = matchGroups({ wanting: words(6), spares: [], textOf, meaningOf });
  assert.equal(grids.length, 2, "six words are two grids");
  assert.deepEqual(grids.map((g) => g.length), [3, 3], "three each, not five and one");
  assert.deepEqual(dropped, []);
  assert.equal(new Set(grids.flat().map((w) => w.id)).size, 6, "and no word twice");
});

test("a short grid is filled out from the spares, the most alike first", () => {
  const asked = [word("a", "كتاب", "book")];
  const spares = [
    word("far", "قلم", "pen"),
    word("kin", "كاتب", "writer"), // shares the root of كتاب
    word("other", "باب", "door"),
    word("more", "مكتب", "office"), // and so does this
    word("last", "شمس", "sun"),
    word("extra", "قمر", "moon"),
  ];
  /* Two words are alike when they share three letters — a stand-in for
     the language's own reading of it. */
  const likeness = (/** @type {{ar: string}} */ x, /** @type {{ar: string}} */ y) =>
    [...new Set(x.ar)].filter((ch) => y.ar.includes(ch)).length >= 3 ? 1 : 0;
  const { grids } = matchGroups({ wanting: asked, spares, textOf, meaningOf, likeness });
  assert.equal(grids.length, 1);
  assert.equal(grids[0].length, PAIR_WORDS, "filled to the full five");
  assert.equal(grids[0][0].id, "a", "the asked word leads");
  const dealt = ids(grids[0]);
  assert.ok(dealt.includes("kin") && dealt.includes("more"), "the two that resemble it are in");
  assert.deepEqual(dealt.slice(1, 3), ["kin", "more"], "and they are dealt before the rest");
  assert.ok(!dealt.includes("extra"), "and one spare is left over");
});

test("with no likeness to go on, the spares are taken in the order given", () => {
  const { grids } = matchGroups({ wanting: [word("a")], spares: words(6, "s"), textOf, meaningOf });
  assert.deepEqual(ids(grids[0]), ["a", "s0", "s1", "s2", "s3"], "most overdue first is the caller's order");
});

test("a grid that cannot be filled to the minimum is not dealt", () => {
  const { grids, dropped } = matchGroups({ wanting: words(2), spares: [], textOf, meaningOf });
  assert.deepEqual(grids, [], `two words is under the minimum of ${MIN_PAIR_WORDS}`);
  assert.deepEqual(ids(dropped), ["w0", "w1"], "and both come back to be asked some other way");
  /* One spare gets it there. */
  const filled = matchGroups({ wanting: words(2), spares: [word("s")], textOf, meaningOf });
  assert.equal(filled.grids.length, 1);
  assert.equal(filled.grids[0].length, MIN_PAIR_WORDS);
  assert.deepEqual(filled.dropped, []);
});

test("a spare is never dealt into two grids, and never makes a grid of its own", () => {
  const { grids, dropped } = matchGroups({ wanting: words(6), spares: words(3, "s"), textOf, meaningOf });
  const all = grids.flat().map((w) => w.id);
  assert.equal(new Set(all).size, all.length, "nothing twice");
  assert.deepEqual(grids.map((g) => g.length).sort(), [4, 5], "three spares shared between two grids of three");
  assert.deepEqual(dropped, []);
  /* Spares alone: nobody asked for them, so there is nothing to deal. */
  const none = matchGroups({ wanting: [], spares: words(5, "s"), textOf, meaningOf });
  assert.deepEqual(none, { grids: [], dropped: [] });
});

test("two words reading the same, or meaning the same, never share a grid", () => {
  const twins = [word("a", "بيت", "house"), word("b", "منزل", "house"), word("c", "بيت", "home")];
  const { grids, dropped } = matchGroups({ wanting: twins, spares: [], textOf, meaningOf, min: 1 });
  for (const g of grids) {
    assert.equal(new Set(g.map((w) => w.en)).size, g.length, "no meaning twice in a grid");
    assert.equal(new Set(g.map((w) => w.ar)).size, g.length, "no wording twice in a grid");
  }
  assert.equal(grids.flat().length + dropped.length, 3, "every word is either dealt or handed back");
  /* And a spare that would clash is passed over for one that does not. */
  const filled = matchGroups({
    wanting: [word("a", "بيت", "house")],
    spares: [word("s0", "دار", "house"), word("s1", "قلم", "pen"), word("s2", "بيت", "home"), word("s3", "باب", "door")],
    textOf,
    meaningOf,
  });
  assert.deepEqual(ids(filled.grids[0]), ["a", "s1", "s3"]);
});

test("a word with nothing written on one side is not asked", () => {
  const { grids, dropped } = matchGroups({
    wanting: [word("a"), word("blank", "كلمة", ""), word("b"), word("c")],
    spares: [word("s", "", "nothing")],
    textOf,
    meaningOf,
  });
  assert.deepEqual(ids(dropped), ["blank"]);
  assert.deepEqual(ids(grids[0]).sort(), ["a", "b", "c"], "and the blank spare was not dealt either");
});

test("the grid puts every dealt word up, and spare meanings beside them", () => {
  const dealt = words(5);
  const pool = words(4, "p");
  const grid = matchSet({ answers: dealt, pool, seed: "one", textOf, meaningOf });
  assert.deepEqual(ids(grid.words).sort(), ids(dealt).sort(), "the words are exactly what was dealt");
  assert.equal(grid.meanings.length, PAIR_WORDS + PAIR_DECOYS, "five meanings and two spares");
  for (const w of dealt) assert.ok(grid.meanings.includes(w.en), `${w.id}'s meaning is up`);
  assert.equal(new Set(grid.meanings).size, grid.meanings.length, "no meaning twice");
});

test("the same seed deals the same grid, and another seed another", () => {
  const dealt = words(5);
  const pool = words(4, "p");
  const a = matchSet({ answers: dealt, pool, seed: "one", textOf, meaningOf });
  const b = matchSet({ answers: dealt, pool, seed: "one", textOf, meaningOf });
  assert.deepEqual(a, b, "a re-render is not a new question");
  const c = matchSet({ answers: dealt, pool, seed: "two", textOf, meaningOf });
  assert.notDeepEqual(ids(a.words), ids(c.words), "another asking, another order");
});

test("a spare meaning never repeats one already up", () => {
  const dealt = [word("a", "كتاب", "book"), word("b", "قلم", "pen"), word("c", "باب", "door")];
  const pool = [word("p0", "مجلد", "book"), word("p1", "كتاب", "volume"), word("p2", "شمس", "sun"), word("p3", "قمر", "moon")];
  const grid = matchSet({ answers: dealt, pool, seed: "x", textOf, meaningOf });
  assert.equal(grid.meanings.filter((m) => m === "book").length, 1, "the pool's second 'book' is passed over");
  assert.ok(!grid.meanings.includes("volume"), "and so is a second كتاب, which would pair right and mark wrong");
  assert.deepEqual([...grid.meanings].sort(), ["book", "door", "moon", "pen", "sun"]);
});
