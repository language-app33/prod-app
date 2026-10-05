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
  heardWhole,
  openRanges,
  probeOf,
  rangeChecks,
  recordedWhole,
  renderAsk,
  seeded,
} from "../src/numbers/range.ts";
import { NUMBER_CEILING, countingOf } from "../src/numbers/types.ts";

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
    "numbers:0-9",
    "numbers:10-19",
    "numbers:20-99",
    "numbers:100-999",
    "numbers:1000+",
    "time:hours",
    "time:quarters-halves",
    "time:fives",
    "time:exact-minutes",
    "time:periods",
  ]);
});

test("a system with no clock opens its numbers and nothing else", () => {
  assert.deepEqual(ids(openRanges(arComposer, SYS)), [
    "numbers:0-9",
    "numbers:10-19",
    "numbers:20-99",
    "numbers:100-999",
    "numbers:1000+",
  ]);
  /* And every stretch is counted with: the system's nouns can be said
     at every number of each of them. */
  for (const check of rangeChecks(arComposer, SYS)) {
    assert.equal(check.counting && check.counting.open, true, `${check.range.id} counts`);
  }
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
    ["numbers:0-9", "numbers:10-19"],
  );
  /* Counting goes with them: open where the stretch is, and never on a
     stretch that is shut. */
  assert.deepEqual(
    checks.filter((c) => c.counting && c.counting.open).map((c) => c.range.id),
    ["numbers:0-9", "numbers:10-19"],
  );
  /* And says what is in the way of the one that shut. */
  const shut = must(checks.find((c) => c.range.id === "numbers:20-99"), "20-99");
  assert.deepEqual(
    blocking(shut.warnings).map((w) => w.slot),
    ["ten.70"],
  );
});

test("counting is a question a stretch asks, and never holds the stretch back", () => {
  /* There are no counting parts: every stretch is counted with, and
     nothing else is a range. */
  assert.ok(arComposer.ranges().every((r) => !r.counted));
  assert.ok(arComposer.ranges().filter((r) => r.kind === "numbers").every((r) => r.counts));
  /* Having nothing to count shuts the counting and nothing else, and is
     said in its own terms rather than as a missing box. */
  const noNouns = { ...SYS, nouns: [] };
  const checks = rangeChecks(arComposer, noNouns);
  assert.ok(checks.every((c) => c.open), "every stretch still opens");
  for (const check of checks) {
    const counting = must(check.counting, check.range.id);
    assert.equal(counting.open, false);
    assert.deepEqual(counting.warnings.map((w) => w.code), ["missing-noun-form"]);
  }
  /* And a noun short of the plural counts nowhere three to ten is said,
     while the stretches above go on counting with it. */
  const noPlural = { ...SYS, nouns: SYS.nouns.map((/** @type {any} */ n) => ({ ...n, pl: "" })) };
  const by = new Map(rangeChecks(arComposer, noPlural).map((c) => [c.range.id, c]));
  assert.equal(must(by.get("numbers:0-9"), "0-9").open, true);
  assert.equal(must(by.get("numbers:0-9"), "0-9").counting?.open, false);
  assert.equal(must(by.get("numbers:20-99"), "20-99").counting?.open, true);
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
    /* Counted with in 0 to 9, which is where three is said before a noun. */
    must(rangeChecks(arComposer, thin).find((c) => c.range.id === "numbers:0-9"), "0 to 9").counting,
    "counting in 0 to 9",
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
    const top = Math.min(range.to, range.from + 3000);
    for (let v = range.from; v <= top; v += 1) {
      assert.deepEqual(blocking(arComposer.render(v, SYS).warnings), [], `${range.id}: ${v}`);
    }
  }
  /* The same of counting: a stretch counted with can count every noun it
     opened on at every number in it, not only the ones it probed. */
  for (const range of arComposer.ranges()) {
    const view = countingOf(range);
    const top = Math.min(view.to, view.from + 3000);
    for (const noun of SYS.nouns) {
      for (let v = view.from; v <= top; v += 7) {
        assert.deepEqual(blocking(arComposer.render(v, SYS, { noun }).warnings), [], `${range.id}: ${v} ${noun.id}`);
      }
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
  const range = must(arComposer.ranges().find((r) => r.id === "numbers:20-99"), "20-99");
  for (let i = 0; i < 200; i += 1) {
    const asked = renderAsk(askFor(range, `s${i}`, SYS), arComposer, SYS);
    assert.ok(asked.text, "nothing to show");
    assert.equal(asked.digits, String(asked.ask.value));
    assert.deepEqual(blocking(asked.warnings), []);
  }
});

test("a counted question says what it is counting, in both languages", () => {
  const range = countingOf(must(arComposer.ranges().find((r) => r.counts), "a stretch counted with"));
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

/* ---- what the answer screen says besides ---- */

/** The golden system with a transliteration in every box, each naming
    the box it is in, so what was joined can be read back off the result. */
const transliterated = (/** @type {any} */ sys) => ({
  ...sys,
  lexemes: Object.fromEntries(
    Object.entries(sys.lexemes).map(([slot, lex]) => [
      slot,
      { ...lex, lat: Object.fromEntries(Object.keys(lex.forms).map((key) => [key, `${slot}/${key}`])) },
    ]),
  ),
  overrides: Object.fromEntries(
    Object.entries(sys.overrides || {}).map(([key, over]) => [key, { ...over, lat: `over/${key}` }]),
  ),
});
const LAT = transliterated(SYS);
const num = (/** @type {number} */ value) => ({ rangeId: "numbers:x", kind: /** @type {"numbers"} */ ("numbers"), value });

test("a built number is transliterated out of its words, the connector joined to the word it leans on", () => {
  /* Twenty-five is five, then the connector attached to twenty: the
     space in the script is a space in the transliteration, and the join
     with none is a hyphen. */
  assert.equal(
    renderAsk(num(25), arComposer, LAT).lat,
    "unit.5/standalone connector/standalone-ten.20/standalone",
  );
  /* A number the teacher wrote out is said the way they wrote it out. */
  assert.equal(renderAsk(num(300), arComposer, LAT).lat, "over/300");
  /* And one asked for in a face the box borrows from is read off the
     face the word is actually written in. */
  assert.equal(renderAsk(num(7), arComposer, LAT).lat, "unit.7/standalone");
});

test("a connector already written with its hyphen is not given a second", () => {
  const sys = { ...LAT, lexemes: { ...LAT.lexemes, connector: { ...LAT.lexemes.connector, lat: { standalone: "w-" } } } };
  assert.equal(renderAsk(num(25), arComposer, sys).lat, "unit.5/standalone w-ten.20/standalone");
});

test("a number with one word nobody transliterated has no transliteration at all", () => {
  const holed = { ...LAT, lexemes: { ...LAT.lexemes, connector: { ...LAT.lexemes.connector, lat: {} } } };
  assert.equal(renderAsk(num(25), arComposer, holed).lat, "");
  /* Its words without the connector still have theirs. */
  assert.equal(renderAsk(num(7), arComposer, holed).lat, "unit.7/standalone");
  assert.equal(renderAsk(num(25), arComposer, SYS).lat, "");
});

test("a time is transliterated out of its words as well", () => {
  const time = {
    ...transliterated(TIME),
    minuteExprs: Object.fromEntries(
      Object.entries(TIME.minuteExprs).map(([mark, expr]) => [mark, { ...expr, lat: `min/${mark}` }]),
    ),
  };
  const got = renderAsk(
    { rangeId: "time:x", kind: "time", value: 7, minute: 15, style: "colloquial" },
    arComposer,
    LAT,
    arTimeComposer,
    time,
  );
  assert.ok(got.lat && got.lat.startsWith("hour.word/standalone unit.7/"), got.lat);
  assert.ok(got.lat.endsWith("-min/15"), got.lat);
});

/** The golden system with one recording, on one face of one box. */
const recorded = (/** @type {string} */ slot, /** @type {string} */ key) => ({
  ...SYS,
  lexemes: { ...SYS.lexemes, [slot]: { ...SYS.lexemes[slot], audio: { [key]: ["clip0000"] } } },
});

test("a number recorded whole is heard, and one built out of parts is not", () => {
  const sys = recorded("unit.7", "standalone");
  assert.deepEqual(renderAsk(num(7), arComposer, sys).recs, ["clip0000"]);
  assert.deepEqual(heardWhole(7, renderAsk(num(7), arComposer, sys).tokens, sys), ["clip0000"]);
  /* Seventeen has its own box and no recording in it; forty-seven has
     seven in it, and nothing inside a number is ever stitched. */
  assert.deepEqual(renderAsk(num(17), arComposer, sys).recs, []);
  assert.deepEqual(renderAsk(num(47), arComposer, sys).recs, []);
  /* One asked for with a masculine word is the counting one, recorded once. */
  assert.deepEqual(renderAsk(num(1), arComposer, recorded("unit.1", "standalone")).recs, ["clip0000"]);
  /* A whole number recorded as such. */
  const curated = { ...SYS, curatedAudio: { 47: ["clip0047"] } };
  assert.deepEqual(renderAsk(num(47), arComposer, curated).recs, ["clip0047"]);
});

test("an asking is recorded only where the whole of it was", () => {
  const sys = recorded("unit.7", "standalone");
  assert.equal(recordedWhole(num(7), arComposer, sys), true);
  assert.equal(recordedWhole(num(47), arComposer, sys), false);
  assert.equal(recordedWhole(num(7), arComposer, SYS), false);
  /* A counted phrase has its noun in it, and nobody recorded the two together. */
  assert.equal(recordedWhole({ ...num(7), nounId: SYS.nouns[0].id }, arComposer, sys), false);
  assert.equal(recordedWhole(num(7), null, sys), false);
});
