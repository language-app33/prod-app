// @ts-check
/*
 * Modern Hebrew times, against a table.
 *
 * The second clock, and the first one written on the shared renderer — so
 * what this file is really holding down is that *sharing it changed
 * nothing*. Two languages, one piece of arithmetic, and every difference
 * between them written in the system a teacher fills in rather than in
 * code:
 *
 *   * **The word that opens a time is optional here.** A teacher who
 *     writes nothing in that box gets the numeral on its own, and the
 *     skill is still offered — where next door the same empty box
 *     withholds it. That is the one thing the pack tells the clock.
 *   * **Counting back puts the minutes first.** *A quarter to three*
 *     rather than *three less a quarter*, with the joining word leaning on
 *     the hour. That is written beside the expression, not decided here.
 *
 * And the claim the whole design rests on, asked of this language too:
 * **the time composer has no agreement in it.** A minute said in a time is
 * the same string as a minute counted by the number composer, character
 * for character.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { renderHe } from "../src/numbers/he-IL.ts";
import { heTimeComposer, renderHeTime } from "../src/numbers/he-IL.time.ts";
import { hour12Of } from "../src/numbers/compose.ts";
import { blocking, timeProbeOf } from "../src/numbers/range.ts";

const numbers = JSON.parse(
  readFileSync(new URL("./golden/he-IL.numbers.json", import.meta.url), "utf8"),
);
const golden = JSON.parse(
  readFileSync(new URL("./golden/he-IL.times.json", import.meta.url), "utf8"),
);
/** @type {any} */
const NUM = numbers.system;
/** @type {any} */
const SYS = golden.system;
/** @type {any[]} */
const CASES = golden.cases;

/** @param {number} h @param {number} m @param {any} [ctx] */
const say = (h, m, ctx = { style: "colloquial" }) => renderHeTime(h, m, SYS, NUM, ctx);

/* ---- the table ---- */

test("every time in the golden table is said the way the table says it", () => {
  assert.ok(CASES.length >= 50, `the table should be worth having: ${CASES.length} rows`);
  for (const row of CASES) {
    const got = say(row.h, row.m, { style: row.style, period: !!row.period });
    const where = `${row.h}:${String(row.m).padStart(2, "0")} ${row.style}${row.period ? " + period" : ""}`;
    assert.equal(got.text, row.text, where);
    assert.equal(got.hour12, row.hour12, `${where} hour`);
    if (row.said) assert.equal(got.period, row.said, `${where} part of the day`);
    assert.deepEqual(blocking(got.warnings), [], `${where} could not be said`);
  }
});

test("the table says out loud that nobody has read it yet", () => {
  /* The Arabic numbers table is a fence around what has shipped; this one
     is a set of claims waiting for somebody who speaks the language. A
     table that quietly looked like the first kind would be the worst of
     both. */
  assert.equal(golden.reviewedBy, "", "if a speaker has read this, say who and drop this test");
  assert.ok(golden.note.join(" ").includes("NOT yet read by a speaker"));
  const checked = CASES.filter((/** @type {any} */ r) => r.check);
  assert.ok(checked.length >= 6, `${checked.length} rows are marked as worth a second opinion`);
  for (const row of checked) {
    assert.ok(row.check.length > 30, `${row.h}:${row.m} is queried in ${row.check.length} characters`);
  }
});

/* ---- what this language does that the other one does not ---- */

test("a time is the numeral on its own, and the skill is still offered", () => {
  /* The word that opens a time is said in the written language and left
     out in speech. An empty box here is a choice and not a gap, so it
     must not withhold a range — which is the one thing the pack tells the
     shared clock. */
  assert.equal(SYS.lexemes["hour.word"], undefined, "the fixture leaves it empty on purpose");
  for (const range of heTimeComposer.ranges()) {
    for (const probe of timeProbeOf(range)) {
      const got = say(probe.h, probe.m, { style: range.style, period: !!range.period });
      assert.deepEqual(
        blocking(got.warnings),
        [],
        `${range.id} at ${probe.h}:${probe.m}: ${JSON.stringify(got.warnings)}`,
      );
      assert.ok(got.text, `${range.id} at ${probe.h}:${probe.m} said nothing`);
    }
  }
});

test("and a teacher who writes that word has it said every time", () => {
  const withWord = {
    ...SYS,
    lexemes: { ...SYS.lexemes, "hour.word": { slot: "hour.word", forms: { standalone: "X" } } },
  };
  const got = renderHeTime(7, 0, withWord, NUM, { style: "colloquial" });
  assert.ok(got.text.startsWith("X "), got.text);
});

test("counting back puts the minutes first, with the joining word on the hour", () => {
  /* The shape this language has and the other one does not, and it is
     data: `lead` on the expression. Nothing in code knows which language
     is which. */
  const quarter = must(SYS.minuteExprs["45"], "quarter to");
  assert.equal(quarter.lead, true);
  const to = must(SYS.lexemes["connector.to"], "to").forms.standalone;
  const eight = renderHe(8, NUM, { gender: "f" }).text;
  assert.equal(say(7, 45).text, `${quarter.text} ${to}${eight}`);
  /* And counting on is the other way round, with the joining word on the
     minutes — the same shape the dialect next door uses all day. */
  const past = must(SYS.lexemes["connector.past"], "past").forms.standalone;
  const seven = renderHe(7, NUM, { gender: "f" }).text;
  assert.equal(say(7, 15).text, `${seven} ${past}${must(SYS.minuteExprs["15"], "quarter past").text}`);
});

/* ---- and the claim the design rests on ---- */

test("the minutes in a time are the number composer counting, character for character", () => {
  for (const m of [1, 2, 3, 7, 11, 21, 30, 59]) {
    const counted = renderHe(m, NUM, { noun: SYS.minuteNoun });
    const said = say(7, m, { style: "exact" });
    assert.ok(said.text.endsWith(counted.text), `${m}: "${said.text}" should end with "${counted.text}"`);
  }
});

test("the hour is the number composer asked for a feminine word", () => {
  for (let h = 0; h < 24; h += 1) {
    const said = say(h, 0);
    assert.equal(said.text, renderHe(hour12Of(h), NUM, { gender: "f" }).text, String(h));
  }
});

test("a fault in the numbers shows up in the clock, because there is one answer", () => {
  const broken = { ...NUM, lexemes: { ...NUM.lexemes } };
  delete broken.lexemes["unit.3"];
  const got = renderHeTime(3, 0, SYS, broken, { style: "colloquial" });
  assert.ok(blocking(got.warnings).length, "the clock should report what the numbers could not say");
});

/* ---- total, like everything else here ---- */

test("nothing throws and nothing is said off the end of the clock", () => {
  for (const [h, m] of [[-1, 0], [24, 0], [0, -1], [0, 60], [1.5, 0], [NaN, NaN]]) {
    const got = renderHeTime(h, m, SYS, NUM, { style: "colloquial" });
    assert.equal(got.text, "", `${h}:${m}`);
    assert.ok(got.warnings.length, `${h}:${m} should say why`);
  }
  const none = renderHeTime(7, 0, SYS, null, { style: "colloquial" });
  assert.equal(none.text, "");
  assert.ok(none.warnings.some((/** @type {any} */ w) => w.code === "no-number-system"));
});
