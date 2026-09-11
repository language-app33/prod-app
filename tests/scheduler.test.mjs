/*
 * When a card comes back.
 *
 * None of this could be tested before: it lived inside a .jsx file that
 * `node --test` cannot import, and it read the clock and the random number
 * generator out of the global scope. Both are passed in now, so every
 * assertion below is an exact number rather than a range.
 *
 * The clock stands still at T. The jitter is pinned per test: the interval
 * maths multiplies by 0.95 + random() * 0.1, so random() = 0.5 means no
 * jitter at all and the arithmetic is the plain SM-2 arithmetic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  MIN,
  MAX_DAYS,
  MIN_EASE,
  MAX_EASE,
  MATURE_DAYS,
  LEARN_STEPS,
  GRADUATE_DAYS,
  EASY_DAYS,
  RELEARN_STEP,
  freshState,
  freshStates,
  reschedule,
  stateReady,
  maturity,
  difficulty,
  difficultyScore,
  unitsOf,
  familyMaturity,
  itemDifficulty,
  formatGap,
  dayKey,
  shuffled,
  inOrder,
  dueRank,
} from "../src/scheduler.ts";
import { TYPES } from "../src/languages.js";
/** @import { ExerciseState, Item } from "../src/types.js" */

/* A Tuesday, so nothing depends on it being midnight or a month boundary. */
const T = Date.UTC(2026, 8, 8, 12, 0, 0);
const still = { now: () => T, random: () => 0.5 }; // 0.5 -> fuzz of exactly 1
/** @param {number} random */
const clock = (random) => ({ now: () => T, random: () => random });

/* A state partway through review, so the interval maths has something to
   multiply. */
/* Built from freshState rather than written out: a state the app holds is
   always complete — freshState fills every field and nothing removes one —
   so a fixture with only the two fields a reader happens to look at would
   be testing a shape that cannot occur, and would go on passing if that
   reader started looking at a third. */
/**
 * @param {Partial<ExerciseState>} [over]
 * @returns {ExerciseState}
 */
const reviewing = (over = {}) => ({ ...freshState(), phase: "review", interval: 10, ease: 2.5, ...over });

/**
 * @param {Partial<ExerciseState>} [over]
 * @returns {ExerciseState}
 */
const state = (over = {}) => ({ ...freshState(), ...over });

/* ------------------------------------------------------------------
   Learning a card for the first time
   ------------------------------------------------------------------ */

test("a new card answered well climbs the learning ladder one step", () => {
  const first = reschedule(freshState(), "good", still);
  assert.equal(first.phase, "learning");
  assert.equal(first.step, 1);
  /* The second rung of the ladder, in minutes from now. */
  assert.equal(first.due, T + LEARN_STEPS[1] * MIN);
  assert.equal(first.reps, 1);
  assert.equal(first.right, 1);
  assert.equal(first.wrong, 0);
});

/* The promises, written out. Checking a result against the constant that
   produced it is a sentence that cannot be false; these are the numbers a
   learner would actually notice changing. */
test("the ladder and the first intervals are the ones promised", () => {
  assert.deepEqual(LEARN_STEPS, [1, 10], "a minute, then ten");
  assert.equal(GRADUATE_DAYS, 1, "graduating earns a day");
  assert.equal(EASY_DAYS, 4, "Easy on a new card earns four");
  assert.equal(RELEARN_STEP, 10, "a forgotten card comes back in ten minutes");
});

test("answering well off the last rung graduates it to review", () => {
  const last = { ...freshState(), phase: "learning", step: LEARN_STEPS.length - 1 };
  const out = reschedule(last, "good", still);
  assert.equal(out.phase, "review");
  assert.equal(out.interval, 1);
  assert.equal(out.due, T + DAY);
});

test("Easy on a new card skips the ladder entirely", () => {
  const out = reschedule(freshState(), "easy", still);
  assert.equal(out.phase, "review");
  assert.equal(out.interval, 4);
  assert.equal(out.due, T + 4 * DAY);
});

test("getting it wrong while learning drops back to the first rung", () => {
  const half = { ...freshState(), phase: "learning", step: 1 };
  const out = reschedule(half, "again", still);
  assert.equal(out.phase, "learning");
  assert.equal(out.step, 0);
  assert.equal(out.due, T + LEARN_STEPS[0] * MIN);
});

test("a near miss while learning holds the rung rather than losing it", () => {
  const half = { ...freshState(), phase: "learning", step: 1 };
  const out = reschedule(half, "hard", still);
  assert.equal(out.step, 1, "the rung is kept");
  assert.equal(out.due, T + LEARN_STEPS[1] * MIN);
  /* But it is still counted as wrong, so the progress screen tells the
     truth about it. */
  assert.equal(out.wrong, 1);
  assert.equal(out.right, 0);
});

/* ------------------------------------------------------------------
   Reviewing
   ------------------------------------------------------------------ */

test("a good answer multiplies the interval by the card's own ease", () => {
  const out = reschedule(reviewing(), "good", still);
  assert.equal(out.interval, 25, "10 days at ease 2.5");
  assert.equal(out.due, T + 25 * DAY);
  assert.equal(out.ease, 2.5, "a plain good answer leaves ease alone");
});

test("a near miss stretches the interval only slightly, and costs ease", () => {
  const out = reschedule(reviewing(), "hard", still);
  assert.equal(out.ease, 2.35);
  assert.equal(out.interval, 12, "10 days times the fixed 1.2");
});

test("Easy pays more than good, and buys ease", () => {
  const out = reschedule(reviewing(), "easy", still);
  assert.equal(out.ease, 2.65);
  assert.equal(out.interval, 34, "10 days times 2.65 times 1.3, rounded");
  assert.ok(out.interval > reschedule(reviewing(), "good", still).interval);
});

test("the jitter is ±5% and never more", () => {
  /* Same card, three different draws. The spread is what stops a hundred
     cards learnt in one evening all coming back on one evening. */
  const low = reschedule(reviewing(), "good", clock(0)).interval;
  const mid = reschedule(reviewing(), "good", clock(0.5)).interval;
  const high = reschedule(reviewing(), "good", clock(0.999999)).interval;
  assert.equal(low, 24, "25 days less 5%");
  assert.equal(mid, 25);
  assert.equal(high, 26, "25 days plus 5%");
  assert.ok(low < high);
});

/* ------------------------------------------------------------------
   Forgetting
   ------------------------------------------------------------------ */

test("forgetting a reviewed card halves it, costs ease, and counts a lapse", () => {
  const out = reschedule(reviewing({ interval: 30 }), "again", still);
  assert.equal(out.phase, "relearning");
  assert.equal(out.lapses, 1);
  assert.equal(out.ease, 2.3, "0.2 off");
  assert.equal(out.interval, 15, "halved");
  assert.equal(out.due, T + RELEARN_STEP * MIN, "and it comes back in minutes, not days");
});

test("relearning returns to review at the interval it was left at", () => {
  const out = reschedule({ ...freshState(), phase: "relearning", interval: 15 }, "good", still);
  assert.equal(out.phase, "review");
  assert.equal(out.interval, 15);
  assert.equal(out.due, T + 15 * DAY);
});

test("failing again while relearning does not halve it twice", () => {
  const out = reschedule({ ...freshState(), phase: "relearning", interval: 15, lapses: 1 }, "again", still);
  assert.equal(out.interval, 15, "the interval is untouched");
  assert.equal(out.lapses, 1, "and it is not counted as a second lapse");
  assert.equal(out.due, T + RELEARN_STEP * MIN);
});

/* ------------------------------------------------------------------
   The limits
   ------------------------------------------------------------------ */

test("the limits are the ones promised", () => {
  assert.equal(MIN_EASE, 1.3, "a card can get this much harder than default and no more");
  assert.equal(MAX_EASE, 3.0);
  assert.equal(MAX_DAYS, 365, "a year");
});

test("ease cannot fall below its floor however often a card is failed", () => {
  let s = reviewing({ ease: 1.4 });
  for (let i = 0; i < 10; i += 1) s = reschedule({ ...s, phase: "review" }, "again", still);
  assert.equal(s.ease, 1.3);
});

test("ease cannot rise above its ceiling however often a card is easy", () => {
  let s = reviewing({ ease: 2.9 });
  for (let i = 0; i < 10; i += 1) s = reschedule(s, "easy", still);
  assert.equal(s.ease, 3.0);
});

test("an interval never exceeds a year, and never collapses to zero", () => {
  const far = reschedule(reviewing({ interval: 365 }), "easy", still);
  assert.equal(far.interval, 365, "a year is the ceiling, and Easy cannot lift it");
  const tiny = reschedule(reviewing({ interval: 0 }), "hard", still);
  assert.ok(tiny.interval >= 1, `got ${tiny.interval}`);
});

test("rescheduling never mutates the state it was given", () => {
  const before = reviewing();
  const copy = JSON.parse(JSON.stringify(before));
  reschedule(before, "again", still);
  assert.deepEqual(before, copy);
});

/* ------------------------------------------------------------------
   Reading a state
   ------------------------------------------------------------------ */

test("a card is ready when its due time has come, and not before", () => {
  assert.equal(stateReady(state({ phase: "review", due: T - 1 }), still), true);
  assert.equal(stateReady(state({ phase: "review", due: T }), still), true, "exactly due counts as ready");
  assert.equal(stateReady(state({ phase: "review", due: T + 1 }), still), false);
});

test("a card never answered is ready, even with no state at all", () => {
  assert.equal(stateReady(undefined, still), true, "the render before a lift catches up");
  assert.equal(stateReady(freshState(), still), true);
});

test("maturity is new, then learning, then young, then mature", () => {
  assert.equal(maturity(freshState()), "new");
  assert.equal(maturity(state({ phase: "learning", interval: 0 })), "learning");
  assert.equal(maturity(state({ phase: "relearning", interval: 40 })), "learning",
    "a card being relearnt is not mature, however long its interval was");
  /* Written out rather than expressed in MATURE_DAYS: a threshold checked
     against itself is a sentence that cannot be false, and moving the
     constant would move this test silently along with it. Three weeks is
     the promise, so three weeks is what is written down. */
  assert.equal(MATURE_DAYS, 21, "three weeks");
  assert.equal(maturity(state({ phase: "review", interval: 20 })), "young");
  assert.equal(maturity(state({ phase: "review", interval: 21 })), "mature");
});

test("difficulty needs two attempts before it says anything", () => {
  assert.equal(difficulty(state({ right: 1, wrong: 0 })), "unrated");
  assert.equal(difficulty(state({ right: 2, wrong: 0, ease: 2.5 })), "easy");
});

test("a card failed repeatedly scores harder than one answered cleanly", () => {
  const clean = difficultyScore(state({ right: 10, wrong: 0, ease: 2.5 }));
  const rough = difficultyScore(state({ right: 2, wrong: 8, ease: 1.8, lapses: 3 }));
  assert.ok(rough > clean, `${rough} should exceed ${clean}`);
  assert.equal(clean, 0);
  assert.ok(rough <= 100 && rough >= 0, "the score stays inside 0-100");
});

/* ------------------------------------------------------------------
   A card and its forms
   ------------------------------------------------------------------ */

const twoTypes = () => ["ar2en", "en2ar"];

/* A card, complete, so the fixtures below stand for something the app can
   actually hold. Only `s` and `subs` are ever varied here — the rest is
   what every card carries and what the family readers walk past. */
/**
 * @param {Partial<Item>} [over]
 * @returns {Item}
 */
const card = (over = {}) => ({
  id: "a", ar: "كتاب", en: "book", lat: "kitaab", tags: [], created: 0, updated: 0,
  s: freshStates(), subs: [], ...over,
});

test("a family is only as grown-up as its weakest form", () => {
  const grown = { ar2en: state({ phase: "review", interval: 40 }), en2ar: state({ phase: "review", interval: 40 }) };
  const item = card({ s: grown, subs: [card({ id: "a-f0", s: { ar2en: freshState(), en2ar: freshState() } })] });
  assert.equal(familyMaturity(card({ s: grown }), twoTypes), "mature");
  assert.equal(familyMaturity(item, twoTypes), "new",
    "one untouched plural holds the whole family at new");
});

test("a family is as hard as its hardest form", () => {
  const easy = state({ right: 10, wrong: 0, ease: 2.5 });
  const hard = state({ right: 1, wrong: 9, ease: 1.4, lapses: 4, skips: 3 });
  const item = card({
    s: { ar2en: easy, en2ar: easy },
    subs: [card({ id: "a-f0", s: { ar2en: hard, en2ar: easy } })],
  });
  assert.equal(itemDifficulty(item, twoTypes), "hard");
  assert.equal(itemDifficulty(card({ s: { ar2en: easy, en2ar: easy } }), twoTypes), "easy");
});

test("a card whose types are all unsupported reports new, not a crash", () => {
  /* This is the shape behind a real hole: switch off every exercise type a
     card supports and it stays in the New pile with nothing ever offered.
     The maths does not crash on it, which is why the hole is quiet. */
  assert.equal(familyMaturity(card({ s: {} }), () => []), "new");
  assert.equal(itemDifficulty(card({ s: {} }), () => []), "unrated");
});

test("unitsOf lists the card first, then each of its forms", () => {
  const item = card({ subs: [card({ id: "b" }), card({ id: "c" })] });
  assert.deepEqual(unitsOf(item).map((u) => [u.unit.id, u.isSub]),
    [["a", false], ["b", true], ["c", true]]);
  assert.deepEqual(unitsOf(card()).map((u) => u.unit.id), ["a"], "a card with no forms");
  assert.deepEqual(unitsOf(undefined).map((u) => u.unit), [undefined], "and no crash on nothing");
});

test("a fresh card carries one state per exercise type", () => {
  const s = freshStates();
  assert.deepEqual(Object.keys(s).sort(), [...TYPES].sort(),
    "every type the app knows about, so a new type cannot arrive stateless");
  for (const t of TYPES) assert.equal(s[t].phase, "new");
});

/* ------------------------------------------------------------------
   Saying when, in words
   ------------------------------------------------------------------ */

test("a gap is said in the largest unit that still reads as a number", () => {
  assert.equal(formatGap(0), "now");
  assert.equal(formatGap(-5000), "now", "already overdue is still now");
  assert.equal(formatGap(30 * 1000), "1m", "under a minute rounds up, never to zero");
  assert.equal(formatGap(45 * MIN), "45m");
  assert.equal(formatGap(3 * 60 * MIN), "3h");
  assert.equal(formatGap(5 * DAY), "5d");
  assert.equal(formatGap(60 * DAY), "2mo");
  assert.equal(formatGap(400 * DAY), "1.1y");
});

test("the activity log buckets by UTC day", () => {
  assert.equal(dayKey(T), "2026-09-08");
  assert.equal(dayKey(undefined, still), "2026-09-08", "and defaults to the clock it is given");
  /* Recorded rather than asserted as correct: this is UTC, not the
     learner's own day, so an evening session west of Greenwich lands on
     tomorrow. Nothing reads the log yet. */
  assert.equal(dayKey(Date.UTC(2026, 8, 8, 23, 30)), "2026-09-08");
  assert.equal(dayKey(Date.UTC(2026, 8, 9, 0, 30)), "2026-09-09");
});

/* --- random among equals --------------------------------------------
   A session is built out of orderings that leave ties, and the ties used
   to keep whatever order the document happened to hold. That is what made
   leaving a session and starting another give back the same questions in
   the same order.
   --------------------------------------------------------------------- */

test("a shuffle keeps everything and moves it", () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  /* A jitter that always says "the first one" rotates a Fisher-Yates
     shuffle by one, which is a permutation nobody could mistake for the
     input. A jitter of 1 would be the identity — every element swapped
     with itself — which is a shuffle that did nothing and would have
     proved nothing. */
  const out = shuffled(list, clock(0));
  assert.deepEqual([...out].sort((a, b) => a - b), list, "nothing gained or lost");
  assert.notDeepEqual(out, list, "and it actually moved");
  /* The list handed in is never the list handed back: the callers hold
     the original, and some of them read it again afterwards. */
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("ranking still decides, and chance only settles what it calls equal", () => {
  const list = [
    { id: "a", rank: 2 },
    { id: "b", rank: 0 },
    { id: "c", rank: 1 },
    { id: "d", rank: 0 },
    { id: "e", rank: 0 },
  ];
  const out = inOrder(list, (x) => x.rank, clock(0));
  assert.deepEqual(out.map((x) => x.rank), [0, 0, 0, 1, 2], "a lower rank always comes first");
  assert.deepEqual(
    out.slice(0, 3).map((x) => x.id).sort(),
    ["b", "d", "e"],
    "and the ones it called equal are all still there",
  );
  assert.notDeepEqual(
    out.slice(0, 3).map((x) => x.id),
    ["b", "d", "e"],
    "in an order the document did not decide",
  );
});

test("everything already due is equally due", () => {
  /* The false precision that made two sessions built a minute apart
     identical: a card due last week is not more urgent than one due this
     morning, so ordering by the exact moment was ordering by nothing. */
  assert.equal(dueRank(T - 7 * DAY, still), 0);
  assert.equal(dueRank(T - MIN, still), 0);
  assert.equal(dueRank(T, still), 0, "due exactly now is due");
  assert.equal(dueRank(0, still), 0, "a card that has never been asked is due");
  /* What is not due yet keeps its own time, so a practice session that
     reaches past what is due reaches for the nearest thing first. */
  assert.equal(dueRank(T + DAY, still), T + DAY);
  assert.ok(dueRank(T + DAY, still) < dueRank(T + 2 * DAY, still));
});

test("so two sessions built from the same cards are not the same session", () => {
  /* The shape of the bug, in the small: five cards, all due, all equal.
     Ordering them is the first thing a session does, and doing it twice
     should not give the same answer twice. */
  const cards = ["a", "b", "c", "d", "e"].map((id) => ({ id, due: T - DAY }));
  const seen = new Set();
  let rolls = 0;
  /* A jitter that walks, so this is a real draw rather than one fixed
     permutation asserted twice. */
  const walking = { now: () => T, random: () => ((rolls = (rolls * 7 + 3) % 97), rolls / 97) };
  for (let i = 0; i < 8; i++) {
    seen.add(inOrder(cards, (c) => dueRank(c.due, walking), walking).map((c) => c.id).join(","));
  }
  assert.ok(seen.size > 1, `eight sessions came out as ${seen.size} order(s)`);
});
