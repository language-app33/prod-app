// @ts-check
/*
 * Which ranges can be asked, and what one asks.
 *
 * Two claims worth holding down hard, because both are the kind that is
 * true for months and then quietly is not:
 *
 *   * **A range is offered only if the whole of it can be built.** The
 *     probe has to find the awkward shapes rather than a comfortable
 *     spread, and the test for that is to sweep the range properly and
 *     find nothing the probe missed.
 *   * **The same seed is the same question.** A missed question comes
 *     back unchanged and a right answer moves on, which is what the count
 *     of right answers is doing in the seed. A drift here would be
 *     invisible: the learner would simply be asked something else.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { arComposer } from "../src/numbers/ar-PS.ts";
import { arTimeComposer } from "../src/numbers/ar-PS.time.ts";
import {
  askFor,
  blocking,
  confusableTimes,
  confusablesOf,
  openRanges,
  probeOf,
  rangeChecks,
  renderAsk,
  seeded,
} from "../src/numbers/range.ts";
import { NUMBER_CEILING } from "../src/numbers/types.ts";

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {any} */
const TIME = load("ar-PS.times.json").system;

const ids = (/** @type {any[]} */ ranges) => ranges.map((r) => r.id);

/* ---- what opens ---- */

test("a complete system opens every range it has", () => {
  const open = openRanges(arComposer, SYS, arTimeComposer, TIME);
  assert.deepEqual(ids(open), [
    "numbers:0-10",
    "numbers:11-99",
    "numbers:100-999",
    "numbers:1000+",
    "numbers:agreement",
    "time:hours",
    "time:quarters-halves",
    "time:fives",
    "time:exact-minutes",
    "time:periods",
  ]);
});

test("a system with no clock opens its numbers and nothing else", () => {
  assert.deepEqual(ids(openRanges(arComposer, SYS)), [
    "numbers:0-10",
    "numbers:11-99",
    "numbers:100-999",
    "numbers:1000+",
    "numbers:agreement",
  ]);
  assert.deepEqual(openRanges(null, SYS), []);
  assert.deepEqual(openRanges(arComposer, null), []);
});

test("the stretches of the number line stop at the first hole", () => {
  /* A system that can build a thousand and not a seventy has a hole in
     it, not a learner ready for thousands. */
  const holed = { ...SYS, lexemes: { ...SYS.lexemes } };
  delete holed.lexemes["ten.70"];
  const checks = rangeChecks(arComposer, holed);
  assert.deepEqual(
    checks.filter((c) => c.open).map((c) => c.range.id),
    ["numbers:0-10", "numbers:agreement"],
  );
  /* And says what is in the way of the one that shut. */
  const shut = must(checks.find((c) => c.range.id === "numbers:11-99"), "11-99");
  assert.deepEqual(
    blocking(shut.warnings).map((w) => w.slot),
    ["ten.70"],
  );
});

test("counting things is its own skill and does not wait on the number line", () => {
  /* It is not harder than saying a number, it is a different thing to
     know — so it opens on its own merits even where the big numbers do
     not. The test above is the other half of this one. */
  const small = { ...SYS, lexemes: { ...SYS.lexemes } };
  delete small.lexemes["ten.70"];
  assert.ok(openRanges(arComposer, small).some((r) => r.counted));
  /* What does shut it is having nothing to count, which is said in its
     own terms rather than as a missing box. */
  const noNouns = { ...SYS, nouns: [] };
  const check = must(
    rangeChecks(arComposer, noNouns).find((c) => c.range.counted),
    "agreement",
  );
  assert.equal(check.open, false);
  assert.deepEqual(check.warnings.map((w) => w.code), ["missing-noun-form"]);
});

test("the clock ranges stop at the first hole too, and in teaching order", () => {
  const thin = { ...TIME, minuteExprs: { ...TIME.minuteExprs } };
  delete thin.minuteExprs["20"];
  const open = ids(openRanges(arComposer, SYS, arTimeComposer, thin));
  /* Quarters and halves do not use the missing mark, so they stand; the
     five-minute range does, and everything after it waits. */
  assert.ok(open.includes("time:hours"));
  assert.ok(open.includes("time:quarters-halves"));
  assert.equal(open.includes("time:fives"), false);
  assert.equal(open.includes("time:exact-minutes"), false);
});

test("a missing face shuts nothing, because it still says something", () => {
  /* Falling back from the form before a feminine noun to the form before
     a masculine one usually says the right thing and always says
     something. A gap a teacher should see is not a reason to withhold a
     skill from a learner. */
  const thin = { ...SYS, lexemes: { ...SYS.lexemes } };
  thin.lexemes["unit.3"] = { slot: "unit.3", forms: { standalone: thin.lexemes["unit.3"].forms.standalone } };
  const check = must(
    rangeChecks(arComposer, thin).find((c) => c.range.counted),
    "agreement",
  );
  assert.equal(check.open, true);
  assert.ok(check.warnings.some((w) => w.code === "missing-form"), "and it is still reported");
  assert.deepEqual(blocking(check.warnings), []);
});

/* ---- the probe is honest ---- */

test("what the probe says about a range is true of the whole of it", () => {
  /* The promise a range makes. Offered only if all of it works — so a
     proper sweep must not turn up a hole the probe was comfortable
     enough to miss. */
  for (const range of arComposer.ranges()) {
    if (range.counted) continue;
    const top = Math.min(range.to, range.from + 3000);
    for (let v = range.from; v <= top; v += 1) {
      assert.deepEqual(blocking(arComposer.render(v, SYS).warnings), [], `${range.id}: ${v}`);
    }
  }
  /* And the probe stays inside its range and never asks twice. */
  for (const range of arComposer.ranges()) {
    const probe = probeOf(range);
    assert.ok(probe.length > 0, range.id);
    assert.equal(new Set(probe).size, probe.length, `${range.id} probes twice`);
    for (const v of probe) assert.ok(v >= range.from && v <= range.to, `${v} outside ${range.id}`);
  }
});

test("the thousands probe looks at a number with a nothing in the middle of it", () => {
  const range = must(arComposer.ranges().find((r) => r.id === "numbers:1000+"), "thousands");
  assert.ok(probeOf(range).some((v) => v % 1000 !== 0 && v % 1000 < 100));
});

/* ---- the same seed is the same question ---- */

test("a seed draws the same question twice, and a run of seeds draws a range of them", () => {
  for (const range of arComposer.ranges().concat(arTimeComposer.ranges())) {
    for (const seed of ["k 3", "k 4", "other 0"]) {
      assert.deepEqual(askFor(range, seed, SYS), askFor(range, seed, SYS), `${range.id} is not steady`);
    }
    /* The count of right answers is what moves, so a right answer is what
       moves the question on. Said over a run rather than over one step,
       because a range of eleven numbers will draw the same one twice
       often enough and that is not a fault. */
    const drawn = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(askFor(range, `k ${i}`, SYS))),
    );
    assert.ok(drawn.size > 5, `${range.id} drew only ${drawn.size} different questions in forty`);
  }
});

test("a drawn question lands inside the range it was drawn from", () => {
  for (const range of arComposer.ranges().concat(arTimeComposer.ranges())) {
    for (let i = 0; i < 500; i += 1) {
      const ask = askFor(range, `seed ${i}`, SYS);
      if (range.kind === "time") {
        assert.ok(ask.value >= 0 && ask.value <= 23, `${range.id} hour ${ask.value}`);
        const m = must(ask.minute, "minute");
        assert.ok(m >= 0 && m <= 59, `${range.id} minute ${m}`);
        if (range.marks) assert.ok(range.marks.includes(m), `${range.id} drew ${m}`);
      } else {
        assert.ok(ask.value >= range.from && ask.value <= range.to, `${range.id} drew ${ask.value}`);
      }
      if (range.counted) {
        assert.ok(
          SYS.nouns.some((/** @type {any} */ n) => n.id === ask.nounId),
          `${range.id} drew a noun nobody wrote`,
        );
      }
    }
  }
});

test("the generator is a generator, not a constant", () => {
  const rnd = seeded("x");
  const drawn = Array.from({ length: 50 }, rnd);
  assert.equal(new Set(drawn).size > 40, true, "it repeats itself");
  for (const v of drawn) assert.ok(v >= 0 && v < 1, `${v} is not a fraction`);
  assert.deepEqual(Array.from({ length: 50 }, seeded("x")), drawn, "and the same seed is the same stream");
});

/* ---- what a question shows ---- */

test("a number question shows the words and is answered in figures", () => {
  const range = must(arComposer.ranges().find((r) => r.id === "numbers:11-99"), "11-99");
  for (let i = 0; i < 200; i += 1) {
    const asked = renderAsk(askFor(range, `s${i}`, SYS), arComposer, SYS);
    assert.ok(asked.text, "nothing to show");
    assert.equal(asked.digits, String(asked.ask.value));
    assert.deepEqual(blocking(asked.warnings), []);
  }
});

test("a counted question says what it is counting, in both languages", () => {
  const range = must(arComposer.ranges().find((r) => r.counted), "agreement");
  const asked = renderAsk({ rangeId: range.id, kind: "numbers", value: 3, nounId: "book" }, arComposer, SYS);
  assert.equal(asked.en, "3 books");
  assert.equal(asked.nounForm, "pl");
  assert.equal(renderAsk({ rangeId: range.id, kind: "numbers", value: 1, nounId: "book" }, arComposer, SYS).en, "1 book");
  /* Two is the one that is not a numeral at all, and the English still
     has to say two. */
  const two = renderAsk({ rangeId: range.id, kind: "numbers", value: 2, nounId: "book" }, arComposer, SYS);
  assert.equal(two.en, "2 books");
  assert.equal(two.nounForm, "dual");
});

test("a time question is answered against the time it actually said", () => {
  /* The colloquial style rounds, so marking a learner against the minute
     that was *drawn* would be marking them on the rounding rather than on
     the clock. */
  const asked = renderAsk(
    { rangeId: "time:fives", kind: "time", value: 7, minute: 45, style: "colloquial" },
    arComposer, SYS, arTimeComposer, TIME,
  );
  assert.equal(asked.digits, "07:45");
  assert.equal(asked.hour, 7, "the hour the clock shows, not the one that is said");
  assert.equal(asked.minute, 45);
  /* And when the rounding carries, the figures carry with it. */
  const carried = renderAsk(
    { rangeId: "time:exact-minutes", kind: "time", value: 23, minute: 58, style: "colloquial" },
    arComposer, SYS, arTimeComposer, TIME,
  );
  assert.equal(carried.digits, "00:00");
  assert.equal(carried.hour, 0);
});

test("a question with nothing behind it is empty rather than wrong", () => {
  const nowhere = renderAsk({ rangeId: "x", kind: "numbers", value: 3 }, null, null);
  assert.equal(nowhere.text, "");
  assert.ok(nowhere.warnings.length);
  const noClock = renderAsk({ rangeId: "t", kind: "time", value: 7, minute: 0 }, arComposer, SYS);
  assert.equal(noClock.text, "");
  assert.ok(noClock.warnings.length);
});

/* ---- wrong answers ---- */

test("the wrong answers beside a number are ones worth confusing with it", () => {
  const near = confusablesOf(47);
  assert.ok(near.includes(74), "the digits the other way round");
  assert.ok(near.includes(470), "a place out");
  assert.ok(near.includes(57), "a ten out");
  assert.ok(!near.includes(47), "never the answer itself");
  for (const v of confusablesOf(0)) assert.ok(v >= 0, "nothing below nought");
  for (const v of confusablesOf(NUMBER_CEILING)) assert.ok(v <= NUMBER_CEILING);
});

test("the wrong answers beside a time are the misreadings of a clock face", () => {
  const near = confusableTimes(7, 15, [0, 15, 30, 45]);
  assert.ok(near.some((t) => t.h === 7 && t.m === 30), "a mark out");
  assert.ok(near.some((t) => t.h === 8 && t.m === 15), "an hour out");
  /* The commonest misreading of a dial: the two hands the other way
     round. Quarter past seven read as three o'clock and thirty-five. */
  assert.ok(near.some((t) => t.h === 3 && t.m === 35), "the hands swapped");
  assert.equal(near.some((t) => t.h === 7 && t.m === 15), false, "never the answer itself");
  for (const t of confusableTimes(0, 0, [0, 15, 30, 45])) {
    assert.ok(t.h >= 0 && t.h <= 23 && t.m >= 0 && t.m <= 59, `${t.h}:${t.m}`);
  }
});

test("no wrong answer is offered twice, however few marks the clock has", () => {
  /*
   * A language whose clock says only the hour and the half has two marks,
   * so the mark before and the mark after a time are the same mark — and
   * on the hour, both of them are the time being asked. Offered as they
   * come, that question puts the right answer up as a wrong one, twice.
   *
   * The same guard keeps any two options apart, so this asks for that
   * rather than for the one case: every time offered is distinct, and none
   * of them is the answer.
   */
  for (const [h, m, marks] of /** @type {[number, number, number[]][]} */ ([
    [7, 0, [0, 30]],
    [7, 30, [30]],
    [0, 0, [0, 30]],
    [12, 0, [0, 15, 30, 45]],
    [23, 45, [0, 15, 30, 45]],
  ])) {
    const near = confusableTimes(h, m, marks);
    const keys = near.map((t) => `${t.h}:${t.m}`);
    const where = `${h}:${String(m).padStart(2, "0")} with marks ${marks.join(",")}`;
    assert.equal(new Set(keys).size, keys.length, `${where} offered one twice: ${keys.join(" ")}`);
    assert.ok(!keys.includes(`${h}:${m}`), `${where} offered the answer itself`);
    for (const t of near) {
      assert.ok(t.h >= 0 && t.h <= 23 && t.m >= 0 && t.m <= 59, `${where} offered ${t.h}:${t.m}`);
    }
  }
});
