// @ts-check
/*
 * Palestinian Arabic numbers, against a table.
 *
 * The table is the test. `tests/golden/ar-PS.numbers.json` holds a lexicon
 * written the way a teacher would write it and about a hundred and thirty
 * numbers written out in full, and the composer has to agree with every
 * one of them. It is JSON rather than JavaScript for one reason: somebody
 * who speaks the language has to be able to read and correct it without
 * being shown a programming language first.
 *
 * Underneath it, property tests over the whole range — which is where the
 * claims that cannot be listed live: that nothing is invented, that every
 * piece of a number comes from a box the teacher filled, that an override
 * always wins, and that a system with holes in it warns instead of lying.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { must } from "./helpers.mjs";
import { AR_SLOTS, arComposer, renderAr } from "../src/numbers/ar-PS.ts";
import { NUMBER_CEILING } from "../src/numbers/types.ts";

const golden = JSON.parse(
  readFileSync(new URL("./golden/ar-PS.numbers.json", import.meta.url), "utf8"),
);
/** @type {any} */
const SYS = golden.system;
/** @type {any[]} */
const CASES = golden.cases;

/** @param {string} id */
const nounOf = (id) => must(SYS.nouns.find((/** @type {any} */ n) => n.id === id), `noun ${id}`);

/** A little linear congruential generator, so a property test that fails
    fails the same way on the next run. The same one the numbers tests
    have used since they were written. */
const seeded = (/** @type {number} */ start) => {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
};

/* ---- the table ---- */

test("every number in the golden table is said the way the table says it", () => {
  assert.ok(CASES.length >= 120, `the table should be worth having: ${CASES.length} rows`);
  for (const row of CASES) {
    const ctx = row.noun ? { noun: nounOf(row.noun) } : row.gender ? { gender: row.gender } : {};
    const got = renderAr(row.n, SYS, ctx);
    const where = `${row.n}${row.noun ? ` ${row.noun}` : ""}${row.gender ? ` (${row.gender})` : ""}`;
    assert.equal(got.text, row.text, where);
    if (row.nounForm) assert.equal(got.nounForm, row.nounForm, `${where} noun form`);
    assert.deepEqual(got.warnings, [], `${where} should render cleanly`);
  }
});

test("the table says which of its rows nobody has confirmed", () => {
  /* The rows this plan guessed at are marked, and the mark carries the
     question rather than a bare flag — a reviewer reads the file, not
     this test. What is asserted is only that a marked row says why. */
  const checked = CASES.filter((/** @type {any} */ c) => c.check);
  assert.ok(checked.length > 0, "a table with nothing to check is a table nobody read");
  for (const row of checked) {
    assert.equal(typeof row.check, "string");
    assert.ok(row.check.length > 20, `${row.n}: say what is in doubt`);
  }
  /* And that nobody has quietly signed it off by writing a name in
     without going through the rows. */
  if (golden.reviewedBy) assert.ok(golden.reviewedOn, "a review has a date on it");
});

/* ---- the whole range ---- */

test("every number up to the ceiling can be said, and says itself the same way twice", () => {
  const check = (/** @type {number} */ v) => {
    const got = renderAr(v, SYS);
    assert.ok(got.text, `nothing came back for ${v}`);
    assert.deepEqual(got.warnings, [], `${v} warned`);
    const again = renderAr(v, SYS);
    assert.equal(again.text, got.text, `${v} is not the same twice`);
  };
  for (let v = 0; v <= 2000; v += 1) check(v);
  const rnd = seeded(7);
  for (let i = 0; i < 5000; i += 1) check(Math.floor(rnd() * (NUMBER_CEILING + 1)));
  for (const v of [9999, 10000, 99999, 100000, 999999, 1000000, 1000001, 9999999]) check(v);
});

test("nothing in a number is invented: every piece of it comes from a box", () => {
  const slots = new Set(AR_SLOTS.map((s) => s.slot));
  const rnd = seeded(11);
  for (let i = 0; i < 3000; i += 1) {
    const v = Math.floor(rnd() * (NUMBER_CEILING + 1));
    const got = renderAr(v, SYS);
    for (const token of got.tokens) {
      if (token.override) {
        assert.ok(SYS.overrides[token.override], `${v}: override ${token.override} is not in the system`);
        continue;
      }
      const slot = must(token.slot, `a token of ${v} with no slot`);
      assert.ok(slots.has(slot), `${v}: ${slot} is not a slot this language has`);
      const lex = must(SYS.lexemes[slot], `${v}: ${slot} is not in the system`);
      assert.equal(lex.forms[must(token.formKey, "form key")], token.text, `${v}: ${slot} said something else`);
    }
    /* And every piece of it is actually in it. */
    for (const token of got.tokens) {
      if (token.slot === "connector") continue;
      assert.ok(got.text.includes(token.text), `${v}: ${token.text} is credited and not said`);
    }
  }
});

test("a number the teacher wrote out beats one the app would build", () => {
  const mine = { ...SYS, overrides: { ...SYS.overrides, 47: { text: "سبعة وأربعين بالضبط" } } };
  assert.equal(renderAr(47, mine).text, "سبعة وأربعين بالضبط");
  assert.deepEqual(
    renderAr(47, mine).tokens.map((/** @type {any} */ t) => t.override),
    ["47"],
  );
  /* And inside a bigger number, because a chunk is where the fusing
     happens — three hundred is one word and 1,300 has it in the middle. */
  assert.ok(renderAr(1347, mine).text.includes("سبعة وأربعين بالضبط"));
});

test("an override may be for one face of a number and not for the others", () => {
  const mine = { ...SYS, overrides: { ...SYS.overrides, "3|construct.f": { text: "تلاث" } } };
  assert.equal(renderAr(3, mine, { noun: nounOf("girl") }).text, "تلاث بنات");
  assert.equal(renderAr(3, mine, { noun: nounOf("book") }).text, "تلات كتب");
  assert.equal(renderAr(3, mine).text, "تلاتة");
});

test("a system with a hole in it says which box would fill it", () => {
  const holed = { ...SYS, lexemes: { ...SYS.lexemes } };
  delete holed.lexemes["ten.70"];
  const got = renderAr(71, holed);
  assert.deepEqual(got.warnings, [{ code: "missing-slot", slot: "ten.70", formKey: "standalone" }]);
  /* And still says as much of the number as it can, because a teacher
     looking at a preview wants to see what is there. */
  assert.ok(got.text.includes("واحد"));
  /* Nothing above it is dragged down: 61 is fine. */
  assert.deepEqual(renderAr(61, holed).warnings, []);
});

test("a face nobody filled falls back to one that is filled, and says so", () => {
  const thin = { ...SYS, lexemes: { ...SYS.lexemes, "unit.3": { slot: "unit.3", forms: { standalone: "تلاتة" } } } };
  const got = renderAr(3, thin, { noun: nounOf("book") });
  assert.equal(got.text, "تلاتة كتب");
  assert.deepEqual(got.warnings, [{ code: "missing-form", slot: "unit.3", formKey: "construct.m" }]);
});

test("a system with nothing in it is empty, not broken", () => {
  const bare = { ...SYS, lexemes: {}, overrides: {} };
  for (const v of [0, 7, 47, 1525, 9999999]) {
    const got = renderAr(v, bare);
    assert.equal(got.text, "");
    assert.ok(got.warnings.length, `${v} should say what is missing`);
  }
});

test("nothing outside the range is said at all", () => {
  for (const v of [-1, 1.5, NUMBER_CEILING + 1, NaN, Infinity]) {
    const got = renderAr(v, SYS);
    assert.equal(got.text, "");
    assert.deepEqual(
      got.warnings.map((/** @type {any} */ w) => w.code),
      ["out-of-range"],
      `${v}`,
    );
  }
});

/* ---- counting things ---- */

test("counting changes the shape of the phrase, not only the word", () => {
  const book = nounOf("book");
  /* One follows its noun, two is the dual with no numeral in it at all,
     three to ten take the plural, and eleven goes back to the singular.
     Four different shapes, which is why this is a skill of its own. */
  assert.equal(renderAr(1, SYS, { noun: book }).nounForm, "sg");
  assert.equal(renderAr(2, SYS, { noun: book }).nounForm, "dual");
  assert.equal(renderAr(2, SYS, { noun: book }).text, book.dual);
  assert.equal(renderAr(5, SYS, { noun: book }).nounForm, "pl");
  assert.equal(renderAr(11, SYS, { noun: book }).nounForm, "sg");
  assert.equal(renderAr(100, SYS, { noun: book }).nounForm, "sg");
  for (let n = 3; n <= 10; n += 1) {
    assert.equal(renderAr(n, SYS, { noun: book }).nounForm, "pl", `${n}`);
  }
  for (let n = 11; n <= 99; n += 1) {
    assert.equal(renderAr(n, SYS, { noun: book }).nounForm, "sg", `${n}`);
  }
});

test("a noun with no dual is counted anyway, and the gap is named", () => {
  const noPlural = { id: "x", sg: "شي", pl: "أشيا", gender: /** @type {const} */ ("m"), en: "thing" };
  const got = renderAr(2, SYS, { noun: noPlural });
  assert.equal(got.text, "شي");
  assert.deepEqual(got.warnings, [{ code: "missing-noun-form", detail: "x.dual" }]);
});

test("the noun's gender is what the numeral agrees with", () => {
  assert.equal(renderAr(1, SYS, { noun: nounOf("book") }).text, "كتاب واحد");
  assert.equal(renderAr(1, SYS, { noun: nounOf("girl") }).text, "بنت واحدة");
  assert.equal(renderAr(21, SYS, { noun: nounOf("book") }).text, "واحد وعشرين كتاب");
  assert.equal(renderAr(21, SYS, { noun: nounOf("girl") }).text, "واحدة وعشرين بنت");
});

/* ---- what the teacher is asked for ---- */

test("the boxes the teacher is asked for cover everything a number reaches", () => {
  const asked = new Set(AR_SLOTS.map((s) => s.slot));
  const rnd = seeded(13);
  for (let i = 0; i < 2000; i += 1) {
    const v = Math.floor(rnd() * (NUMBER_CEILING + 1));
    for (const token of renderAr(v, SYS).tokens) {
      if (token.override) continue;
      assert.ok(asked.has(must(token.slot, "slot")), `${v} wants ${token.slot}, which nobody is asked for`);
    }
  }
  /* Every box has a label and sits in a group, or the editor has nothing
     to draw. */
  for (const slot of AR_SLOTS) {
    assert.ok(slot.label, `${slot.slot} has no label`);
    assert.ok(slot.group, `${slot.slot} is in no group`);
    assert.ok(slot.formKeys.length, `${slot.slot} asks for nothing`);
    assert.equal(slot.formKeys[0], "standalone", `${slot.slot} should lead with the counting form`);
  }
  assert.equal(asked.size, AR_SLOTS.length, "a slot is asked for twice");
});

test("the composer names itself and its ranges", () => {
  assert.equal(arComposer.id, "ar-PS");
  assert.ok(arComposer.version >= 1);
  const ranges = arComposer.ranges();
  assert.deepEqual(
    ranges.map((r) => r.id),
    ["numbers:0-10", "numbers:11-99", "numbers:100-999", "numbers:1000+", "numbers:agreement"],
  );
  for (const r of ranges) {
    assert.ok(r.from <= r.to, `${r.id} is back to front`);
    assert.ok(r.to <= NUMBER_CEILING, `${r.id} reaches past the ceiling`);
    assert.ok(r.label, `${r.id} has no name`);
  }
  /* The one range that is not a stretch of the number line says so. */
  assert.equal(must(ranges.find((r) => r.id === "numbers:agreement"), "agreement").counted, true);
});

test("no composer holds a word of any language", () => {
  /* The condition the whole directory exists under, checked here as well
     as in tests/language-isolation.test.mjs — twice, because this is the
     file somebody adding a language will have open, and a rule you meet
     where you are working is a rule you keep. */
  const dir = new URL("../src/numbers/", import.meta.url);
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.length >= 3, "the composers should be here");
  for (const file of files) {
    const source = readFileSync(new URL(file, dir), "utf8");
    const runs = source.match(/[֐-ۿ]+/g) || [];
    assert.deepEqual(runs, [], `src/numbers/${file} holds words: ${runs.join(", ")}`);
  }
});

test("the table of forms is a table the app already knows how to draw", () => {
  const table = arComposer.table();
  assert.ok(table.persons.length >= 2);
  assert.equal(table.tenses.length, 1, "a number's forms are one row");
  for (const p of table.persons) assert.ok(p.label, `${p.id} has no label`);
  /* Every column is a face the slots actually ask for, or a teacher would
     be filling in a box nothing reads. */
  const faces = new Set(AR_SLOTS.flatMap((s) => s.formKeys));
  for (const p of table.persons) assert.ok(faces.has(/** @type {any} */ (p.id)), `${p.id} is nobody's box`);
});
