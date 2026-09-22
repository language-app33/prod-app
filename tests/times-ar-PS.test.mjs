// @ts-check
/*
 * Palestinian Arabic times, against a table.
 *
 * Same bargain as the numbers: a table a speaker can read, and property
 * tests underneath it for the claims that cannot be listed one at a time.
 *
 * The claim worth testing hardest is the one the whole design rests on —
 * **the time composer has no agreement in it.** So there are tests here
 * that a minute said in a time is the same string as a minute counted by
 * the number composer, and that a fault introduced into the number system
 * shows up in the clock. If those ever stop being true, somebody has
 * written a second answer to a question that already had one.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { renderAr } from "../src/numbers/ar-PS.ts";
import { arTimeComposer, hour12Of, periodFor, renderArTime, roundToMark } from "../src/numbers/ar-PS.time.ts";

const numbers = JSON.parse(
  readFileSync(new URL("./golden/ar-PS.numbers.json", import.meta.url), "utf8"),
);
const golden = JSON.parse(
  readFileSync(new URL("./golden/ar-PS.times.json", import.meta.url), "utf8"),
);
/** @type {any} */
const NUM = numbers.system;
/** @type {any} */
const SYS = golden.system;
/** @type {any[]} */
const CASES = golden.cases;

const seeded = (/** @type {number} */ start) => {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
};

/** @param {number} h @param {number} m @param {any} [ctx] */
const say = (h, m, ctx = { style: "colloquial" }) => renderArTime(h, m, SYS, NUM, ctx);

/* ---- the table ---- */

test("every time in the golden table is said the way the table says it", () => {
  assert.ok(CASES.length >= 60, `the table should be worth having: ${CASES.length} rows`);
  for (const row of CASES) {
    const got = say(row.h, row.m, { style: row.style, period: !!row.period });
    const where = `${row.h}:${String(row.m).padStart(2, "0")} ${row.style}${row.period ? " + period" : ""}`;
    assert.equal(got.text, row.text, where);
    assert.equal(got.hour12, row.hour12, `${where} hour`);
    const codes = got.warnings.map((w) => w.code);
    assert.deepEqual(codes, row.rounded ? ["rounded"] : [], `${where} warnings`);
  }
});

test("the table marks the rows nobody has confirmed, with the question on each", () => {
  const checked = CASES.filter((/** @type {any} */ c) => c.check);
  assert.ok(checked.length > 0, "a table with nothing to check is a table nobody read");
  for (const row of checked) {
    assert.ok(String(row.check).length > 20, `${row.h}:${row.m}: say what is in doubt`);
  }
  if (golden.reviewedBy) assert.ok(golden.reviewedOn, "a review has a date on it");
});

/* ---- the clock itself ---- */

test("the twelve-hour clock has no nought on it and no thirteen", () => {
  const seen = new Set();
  for (let h = 0; h <= 23; h += 1) {
    const twelve = hour12Of(h);
    assert.ok(twelve >= 1 && twelve <= 12, `${h} reads as ${twelve}`);
    seen.add(twelve);
  }
  assert.equal(seen.size, 12);
  /* Noon and midnight are both twelve, which is the one thing about a
     clock face everybody knows and every modulo gets wrong first. */
  assert.equal(hour12Of(0), 12);
  assert.equal(hour12Of(12), 12);
  assert.equal(hour12Of(13), 1);
  assert.equal(hour12Of(23), 11);
});

test("rounding to five may carry into the next hour", () => {
  assert.deepEqual(roundToMark(7, 0), { hour: 7, mark: 0 });
  assert.deepEqual(roundToMark(7, 2), { hour: 7, mark: 0 });
  assert.deepEqual(roundToMark(7, 3), { hour: 7, mark: 5 });
  assert.deepEqual(roundToMark(7, 57), { hour: 7, mark: 55 });
  /* Two minutes to eight is eight o'clock, not eight o'clock with nothing
     said about it — and, with a period on, it is whatever part of the day
     eight belongs to. */
  assert.deepEqual(roundToMark(7, 58), { hour: 8, mark: 0 });
  assert.deepEqual(roundToMark(23, 59), { hour: 0, mark: 0 });
});

test("the part of the day comes off the hour the clock shows, not the hour that is said", () => {
  /* A quarter to one in the afternoon says *one* and happens at twelve.
     Reading the period off the one would file it under the small hours. */
  const said = say(12, 45, { style: "colloquial", period: true });
  assert.equal(said.hour12, 1);
  assert.equal(said.period, must(periodFor(SYS, 12), "noon").text);
  assert.notEqual(said.period, (periodFor(SYS, 13) || { text: "" }).text === said.period ? "" : said.period);
  /* And the same at the other end of the day. */
  const night = say(23, 45, { style: "colloquial", period: true });
  assert.equal(night.hour12, 12);
  assert.equal(night.period, must(periodFor(SYS, 23), "night").text);
});

test("a part of the day may wrap round midnight, because one of them always does", () => {
  const night = must(periodFor(SYS, 23), "23");
  assert.equal(must(periodFor(SYS, 0), "0").slot, night.slot);
  assert.equal(must(periodFor(SYS, 3), "3").slot, night.slot);
  assert.notEqual(must(periodFor(SYS, 5), "5").slot, night.slot);
  /* Every hour of the day belongs somewhere, or a question would be
     asked with nothing to say at the end of it. */
  for (let h = 0; h <= 23; h += 1) assert.ok(periodFor(SYS, h), `${h} is in no part of the day`);
});

/* ---- the whole clock ---- */

test("every time on the clock can be said, both ways, and says itself the same twice", () => {
  for (let h = 0; h <= 23; h += 1) {
    for (let m = 0; m <= 59; m += 1) {
      for (const style of ["colloquial", "exact"]) {
        const got = say(h, m, { style });
        const where = `${h}:${String(m).padStart(2, "0")} ${style}`;
        assert.ok(got.text, `nothing came back for ${where}`);
        const bad = got.warnings.filter((w) => w.code !== "rounded");
        assert.deepEqual(bad, [], `${where} warned`);
        assert.equal(say(h, m, { style }).text, got.text, `${where} is not the same twice`);
      }
    }
  }
});

test("only the colloquial style rounds, and it says when it did", () => {
  for (let m = 0; m <= 59; m += 1) {
    const loose = say(7, m, { style: "colloquial" });
    const exact = say(7, m, { style: "exact" });
    assert.deepEqual(exact.warnings, [], `exact ${m} should never round`);
    const rounded = loose.warnings.some((w) => w.code === "rounded");
    assert.equal(rounded, m % 5 !== 0, `colloquial ${m}`);
  }
});

test("nothing off the clock is said at all", () => {
  for (const [h, m] of [[-1, 0], [24, 0], [7, -1], [7, 60], [1.5, 0], [7, NaN]]) {
    const got = say(h, m, { style: "colloquial" });
    assert.equal(got.text, "");
    assert.deepEqual(
      got.warnings.map((w) => w.code),
      ["out-of-range"],
      `${h}:${m}`,
    );
  }
});

/* ---- the claim the design rests on ---- */

test("the minutes of an exact time are the number composer counting minutes, and nothing else", () => {
  const noun = SYS.minuteNoun;
  for (let m = 1; m <= 59; m += 1) {
    const counted = renderAr(m, NUM, { noun });
    const time = say(7, m, { style: "exact" });
    assert.ok(time.text.endsWith(counted.text), `${m}: the clock said something the numbers did not`);
  }
});

test("the hour of a time is the number composer asked for a feminine word", () => {
  for (let h = 0; h <= 23; h += 1) {
    const twelve = hour12Of(h);
    const numeral = renderAr(twelve, NUM, { gender: "f" });
    /* On the hour, in the style this table has not overridden — an
       override is a whole time written out and has no hour in it to
       compare against, which is the point of one. */
    assert.ok(say(h, 0, { style: "exact" }).text.endsWith(numeral.text), `${h}`);
  }
  /* And it is the feminine that is asked for, which is the whole reason
     one and two have a second box: half past one is not half past *one*
     said the way a man is counted. */
  assert.notEqual(renderAr(1, NUM, { gender: "f" }).text, renderAr(1, NUM, { gender: "m" }).text);
  assert.notEqual(renderAr(2, NUM, { gender: "f" }).text, renderAr(2, NUM, { gender: "m" }).text);
});

test("a hole in the number system shows up in the clock", () => {
  /* Which is the point of there being one composer: a word nobody typed
     is missing from the time as well, reported against the box that would
     fix it, and not quietly replaced with something plausible. */
  const holed = { ...NUM, lexemes: { ...NUM.lexemes } };
  delete holed.lexemes["unit.7"];
  const got = renderArTime(7, 0, SYS, holed, { style: "colloquial" });
  assert.deepEqual(got.warnings, [{ code: "missing-slot", slot: "unit.7", formKey: "standalone" }]);
  /* And one o'clock names the feminine box, because one is a number that
     has one and seven is not. */
  const noOne = { ...NUM, lexemes: { ...NUM.lexemes } };
  delete noOne.lexemes["unit.1"];
  assert.deepEqual(renderArTime(1, 0, SYS, noOne, { style: "colloquial" }).warnings, [
    { code: "missing-slot", slot: "unit.1", formKey: "f" },
  ]);
});

test("a time without a number system is refused rather than half said", () => {
  const got = renderArTime(7, 0, SYS, null, { style: "colloquial" });
  assert.equal(got.text, "");
  assert.deepEqual(got.warnings, [{ code: "no-number-system" }]);
});

/* ---- the teacher's corrections ---- */

test("a time the teacher wrote out beats one the app would build, in that style alone", () => {
  const got = say(12, 0, { style: "colloquial" });
  assert.equal(got.text, "الساعة اتناعش الضهر");
  assert.deepEqual(
    got.tokens.map((t) => t.override),
    ["12:00|colloquial"],
  );
  /* And the other style is untouched, because a correction to how you say
     something at midday is not a correction to how you count minutes. */
  assert.equal(say(12, 0, { style: "exact" }).text, "الساعة اتناعش");
});

test("an override without a style covers both", () => {
  const mine = { ...SYS, overrides: { ...SYS.overrides, "06:30": { text: "الساعة ستة ونص الصبح" } } };
  for (const style of /** @type {const} */ (["colloquial", "exact"])) {
    assert.equal(renderArTime(6, 30, mine, NUM, { style }).text, "الساعة ستة ونص الصبح");
  }
});

/* ---- a missing expression ---- */

test("a five-minute mark nobody wrote is named, not guessed at", () => {
  const thin = { ...SYS, minuteExprs: { ...SYS.minuteExprs } };
  delete thin.minuteExprs["20"];
  const got = renderArTime(7, 20, thin, NUM, { style: "colloquial" });
  assert.deepEqual(
    got.warnings.map((w) => w.code),
    ["no-minute-expression"],
  );
  /* The hour is still said, so a teacher's preview shows what is there. */
  assert.ok(got.text.includes("سبعة"));
  /* And the marks that were written are unaffected. */
  assert.deepEqual(renderArTime(7, 15, thin, NUM, { style: "colloquial" }).warnings, []);
});

/* ---- what is scheduled ---- */

test("the time ranges are five skills, each saying what it draws from", () => {
  const ranges = arTimeComposer.ranges();
  assert.deepEqual(
    ranges.map((r) => r.id),
    ["time:hours", "time:quarters-halves", "time:fives", "time:exact-minutes", "time:periods"],
  );
  for (const r of ranges) {
    assert.equal(r.kind, "time");
    assert.ok(r.label, `${r.id} has no name`);
    assert.equal(r.from, 0);
    assert.equal(r.to, 23);
    if (r.marks) for (const m of r.marks) assert.equal(m % 5, 0, `${r.id} draws from ${m}`);
  }
  /* The exact-minute range is the only one that is not on the five-minute
     marks, and the only one that counts a noun. */
  const exact = must(ranges.find((r) => r.id === "time:exact-minutes"), "exact");
  assert.equal(exact.marks, undefined);
  assert.equal(exact.style, "exact");
  /* And the period range is the only one that asks for the part of day. */
  assert.equal(must(ranges.find((r) => r.id === "time:periods"), "periods").period, true);
  assert.equal(ranges.filter((r) => r.period).length, 1);
});

test("the three clock words are asked for, and nothing else is", () => {
  assert.deepEqual(
    arTimeComposer.requiredSlots().map((s) => s.slot),
    ["hour.word", "connector.past", "connector.to"],
  );
  for (const s of arTimeComposer.requiredSlots()) {
    assert.deepEqual(s.formKeys, ["standalone"], `${s.slot} asks for a face a clock word has not got`);
    assert.ok(s.hint, `${s.slot} has nothing to tell the teacher`);
  }
});

test("the clock is steady under a seeded sweep of it", () => {
  const rnd = seeded(29);
  for (let i = 0; i < 2000; i += 1) {
    const h = Math.floor(rnd() * 24);
    const m = Math.floor(rnd() * 60);
    const style = rnd() < 0.5 ? "colloquial" : "exact";
    const got = say(h, m, { style, period: rnd() < 0.5 });
    assert.ok(got.text, `${h}:${m} ${style}`);
    assert.ok(got.hour12 >= 1 && got.hour12 <= 12);
    for (const token of got.tokens) assert.ok(token.text, `${h}:${m} credited an empty piece`);
  }
});
