// @ts-check
/*
 * Hebrew and Huế Vietnamese, ported onto the new composer contract.
 *
 * These two languages already built their numbers, and they have been in
 * front of learners since 0.152. So the question here is not "is this
 * right" — somebody answered that once already — but **"is this the
 * same"**, and that is a much sharper question to ask.
 *
 * The golden tables are how it is asked. Every row in them was generated
 * from the shipping implementation, before a line of the new one ran, so
 * a row that changes here is a learner seeing something new. While both
 * implementations were in the tree this file also ran them side by side
 * over five thousand numbers, character for character; that test went
 * with the old module, and the tables are what it left behind.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { renderHe } from "../src/numbers/he-IL.ts";
import { renderVi } from "../src/numbers/vi-Hue.ts";
import { composerFor, composerLanguages, timeComposerFor } from "../src/numbers/index.ts";
import { NUMBER_CEILING } from "../src/numbers/types.ts";

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));

const HE = load("he-IL.numbers.json");
const VI = load("vi-Hue.numbers.json");

const CASES = {
  "he-IL": { golden: HE, render: renderHe },
  "vi-Hue": { golden: VI, render: renderVi },
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
     and have nobody yet who knows its clock, which is where Huế still
     stands. */
  assert.ok(timeComposerFor("ar-PS"));
  assert.ok(timeComposerFor("he-IL"));
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
