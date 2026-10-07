/*
 * A number blank over several stretches: `{{0-99}}` for 0 to 9, 10 to 19
 * and 20 to 99 ticked together. What it is called, what fills it, and
 * that each stretch comes up in turn rather than one after another.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arComposer } from "../src/numbers/ar-PS.ts";
import { fillerCards } from "../src/numbers/generate.ts";
import { mixed, readSpan, spanTag, spansThrough } from "../src/numbers/spans.ts";
import { fillersFor } from "../src/card-facts.ts";
import { fillsOf, valuesForTurn } from "../src/variables.ts";
import { LANGUAGES } from "../src/languages.ts";

/** @type {any} */
const SYS = JSON.parse(readFileSync(new URL("./golden/ar-PS.numbers.json", import.meta.url), "utf8")).system;

/* Which stretch a filler came from, off its id. */
const stretch = (/** @type {any} */ v) => (/:fill:numbers:([^:]+):/.exec(v.id) || [])[1];

test("a run of stretches is named from its bottom to its top, and read back", () => {
  const cases = [
    [{ counted: false, from: 0, to: 0 }, "0-9"],
    [{ counted: false, from: 0, to: 2 }, "0-99"],
    [{ counted: false, from: 1, to: 3 }, "10-999"],
    [{ counted: false, from: 2, to: 4 }, "20-plus"],
    [{ counted: false, from: 4, to: 4 }, "1000-plus"],
    [{ counted: false, from: 0, to: 4 }, "number"],
    [{ counted: true, from: 0, to: 2 }, "count-0-99"],
    [{ counted: true, from: 0, to: 4 }, "count"],
  ];
  for (const [span, name] of cases) {
    assert.equal(spanTag(/** @type {any} */ (span)), name);
    assert.deepEqual(readSpan(/** @type {string} */ (name)), span);
  }
  /* The old names open on the stretches they stand for. */
  assert.deepEqual(readSpan("11-99"), { counted: false, from: 1, to: 2 });
  assert.deepEqual(readSpan("count-3-10"), { counted: true, from: 0, to: 0 });
  assert.equal(readSpan("name"), null);
});

test("a stretch's own tag is inside every run that holds it, and nothing else is", () => {
  assert.deepEqual(spansThrough("10-19"), ["0-19", "0-99", "0-999", "10-99", "10-999", "10-plus"]);
  assert.deepEqual(spansThrough("count-0-9"), ["count-0-19", "count-0-99", "count-0-999"]);
  for (const name of ["number", "count", "0-99", "0-10", "name"]) assert.deepEqual(spansThrough(name), [], name);
});

test("a filler stands in every run its stretch is inside", () => {
  const made = /** @type {any[]} */ (fillerCards(arComposer, { ...SYS, nouns: [] }));
  const teen = made.find((c) => c.source.slot === "fill:numbers:10-19");
  const big = made.find((c) => c.source.slot === "fill:numbers:100-999");
  assert.ok(fillsOf(teen).includes("0-99") && fillsOf(teen).includes("10-plus"));
  assert.ok(!fillsOf(big).includes("0-99"));
  assert.ok(fillsOf(big).includes("0-999"));
});

test("{{0-99}} is filled from all three stretches, taking them in turn", () => {
  const sentence = { id: "s1", lang: "ar-PS", sentence: true, forms: [{ ar: "{{0-99}}", en: "I am {{0-99}}", lat: "" }] };
  const pool = /** @type {any[]} */ ([sentence, ...fillerCards(arComposer, { ...SYS, nouns: [] })]);
  const got = fillersFor(sentence.forms[0], pool, LANGUAGES["ar-PS"]);
  const from = new Set(got["0-99"].map(stretch));
  assert.deepEqual([...from].sort(), ["0-9", "10-19", "20-99"]);
  /* The first three turns are one of each, and so is any three in a row
     while all three still have numbers left. */
  const turns = [0, 1, 2, 3, 4, 5].map((t) => stretch(/** @type {any} */ (valuesForTurn(["0-99"], got, t))["0-99"]));
  assert.deepEqual(turns, ["0-9", "10-19", "20-99", "0-9", "10-19", "20-99"]);
  /* And the same count is the same number. */
  assert.deepEqual(valuesForTurn(["0-99"], got, 4), valuesForTurn(["0-99"], got, 4));
});

test("a blank of one stretch, or any other blank, keeps its order", () => {
  const list = [{ id: "sys:a:fill:numbers:20-99:40" }, { id: "sys:a:fill:numbers:0-9:3" }];
  assert.equal(mixed("0-9", list), list);
  assert.equal(mixed("name", list), list);
  assert.deepEqual(mixed("0-99", list).map((v) => v.id), ["sys:a:fill:numbers:0-9:3", "sys:a:fill:numbers:20-99:40"]);
});
