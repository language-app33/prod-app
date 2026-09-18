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
  MASTERED_DAYS,
  FRONT_DOOR_CAP,
  IN_HAND_CAP,
  recognised,
  LEARN_STEPS,
  GRADUATE_DAYS,
  EASY_DAYS,
  RELEARN_STEP,
  freshState,
  freshStates,
  reschedule,
  liftLevel,
  hasLevelAbove,
  stateReady,
  maturity,
  difficulty,
  difficultyScore,
  unitsOf,
  familyMaturity,
  itemDifficulty,
  graduated,
  mastered,
  missedTwice,
  openTypes,
  reachedLevel,
  standings,
  standing,
  turnOf,
  roomForNew,
  formatGap,
  dayKey,
  shuffled,
  inOrder,
  dueRank,
  justPractised,
  JUST_PRACTISED,
} from "../src/scheduler.ts";
import { EX, LEVEL_BARS, TYPES, barOf, levelOf } from "../src/languages.ts";
import { must } from "./helpers.mjs";
/** @import { ExerciseState, Item } from "../src/types.ts" */

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

/*
 * A question got wrong, once and twice running.
 *
 * The difference is the whole of the two-strike rule: one miss leaves the
 * levels above open, and a second closes them. Both are in relearning —
 * the schedule treats them identically — so what tells them apart is the
 * record of the last outings, which is what `holding` reads.
 */
const slipped = (/** @type {number} */ interval) =>
  state({ phase: "relearning", interval, reps: 4, right: 3, wrong: 1, hist: [1, 1, 0] });
const slippedTwice = (/** @type {number} */ interval) =>
  state({ phase: "relearning", interval, reps: 5, right: 3, wrong: 2, hist: [1, 0, 0] });

/* ------------------------------------------------------------------
   Learning a card for the first time
   ------------------------------------------------------------------ */

test("a new card answered well climbs the learning ladder one step", () => {
  const first = reschedule(freshState(), "good", still);
  assert.equal(first.phase, "learning");
  assert.equal(first.step, 1);
  /* The second level of the ladder, in minutes from now. */
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

test("answering well off the last level graduates it to review", () => {
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

test("getting it wrong while learning drops back to the first level", () => {
  const half = { ...freshState(), phase: "learning", step: 1 };
  const out = reschedule(half, "again", still);
  assert.equal(out.phase, "learning");
  assert.equal(out.step, 0);
  assert.equal(out.due, T + LEARN_STEPS[0] * MIN);
});

test("a near miss while learning holds the level rather than losing it", () => {
  const half = { ...freshState(), phase: "learning", step: 1 };
  const out = reschedule(half, "hard", still);
  assert.equal(out.step, 1, "the level is kept");
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

test("a near miss always moves the interval, however short it is", () => {
  /* 1.2 times one day rounds back to one day, and so does 1.2 times two.
     A learner whose fault is always the same small one — the right letters
     with the wrong tone, the wrong haraka — was answering every review of
     a word that way and staying at a one-day interval for ever: never
     mastered, so never past the level that exercise stands on, and nothing
     on the screen to say why the writing never arrived. */
  assert.equal(reschedule(reviewing({ interval: 1 }), "hard", still).interval, 2);
  assert.equal(reschedule(reviewing({ interval: 2 }), "hard", still).interval, 3);
  assert.equal(reschedule(reviewing({ interval: 3 }), "hard", still).interval, 4);
  /* Far enough along and the multiplier is already worth more than the
     floor, which is where it stays in charge. */
  assert.equal(reschedule(reviewing({ interval: 10 }), "hard", still).interval, 12);
  /* Nearly right over and over does reach the bar, rather than standing
     still short of it — four near misses from a standing start.

     Each one is answered when the card asks for it rather than four times
     in the same instant, because a gap now grows from the time actually
     waited: four answers in one second are one second's worth of evidence
     and rightly move the card once. Coming back when asked is what the
     learner this test is about actually does. */
  let s = reviewing({ interval: 1 });
  const path = [];
  let at = T;
  for (let i = 0; i < 4; i += 1) {
    /* Answered on its due date, which is where it was put last time. */
    const onTime = { now: () => at, random: () => 0.5 };
    s = reschedule(s, "hard", onTime);
    path.push(s.interval);
    at = s.due;
  }
  assert.deepEqual(path, [2, 3, 4, 5]);
  assert.equal(mastered(s), true, `nearly right four times reaches the bar: ${path.join(" → ")}`);
  /* And it is still a hard answer: the ease falls every time, so the card
     goes on being treated as a difficult one. */
  assert.ok(s.ease < 2.5, `${s.ease}`);
  assert.equal(s.wrong, 4, "and it is still counted as wrong, four times");
  /* The ceiling still holds. */
  assert.equal(reschedule(reviewing({ interval: MAX_DAYS }), "hard", still).interval, MAX_DAYS);
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
 * @param {Record<string, any>} [over]
 * @returns {Item}
 */
const card = (over = {}) => {
  const { s, subs, ar, en, lat, id, ...rest } = over;
  return /** @type {Item} */ ({
    id: id || "a", tags: [], created: 0, updated: 0,
    forms: [
      {
        id: id || "a",
        ar: ar || "كتاب", en: en || "book", lat: lat || "kitaab",
        s: s || freshStates(),
      },
      /* A form written as a card, for the fixtures that build one that
         way: what is wanted from it is its forms, not its wrapper. */
      ...(subs || []).flatMap((/** @type {any} */ sub) => sub.forms || [sub]),
    ],
    ...rest,
  });
};

test("a family is only as grown-up as its weakest form", () => {
  const grown = { ar2en: state({ phase: "review", interval: 40 }), en2ar: state({ phase: "review", interval: 40 }) };
  const item = card({ s: grown, subs: [card({ id: "a-f0", s: { ar2en: freshState(), en2ar: freshState() } })] });
  assert.equal(familyMaturity(card({ s: grown }), twoTypes), "mature");
  assert.equal(familyMaturity(item, twoTypes), "learning",
    "one untouched plural holds the whole family at learning: met, not done");
  const young = { ar2en: state({ phase: "review", interval: 40 }), en2ar: state({ phase: "review", interval: 3 }) };
  assert.equal(familyMaturity(card({ s: young }), twoTypes), "young");
});

test("new means never met, whatever the card could be asked", () => {
  assert.equal(familyMaturity(card(), twoTypes), "new", "nothing answered anywhere");
  /* A card whose reading is mature and whose writing has not been asked
     yet is being learnt, and reads as such — it used to read as new, which
     put a card three weeks in beside one written this morning. */
  const half = { ar2en: state({ phase: "review", interval: 40 }), en2ar: freshState() };
  assert.equal(familyMaturity(card({ s: half }), twoTypes), "learning");
  /* A type with no record at all counts as untouched, the way the app
     reads a fresh state — an absent record is not a mature one. */
  assert.equal(familyMaturity(card({ s: { ar2en: state({ phase: "review", interval: 40 }) } }), twoTypes), "learning");
});

test("a card stands where its least-finished exercise does", () => {
  /* One reading for the whole card, taken from its worst part: a word you
     can read and cannot write is a word you are still learning. */
  const at = (/** @type {any} */ c) => familyMaturity(c, twoTypes);
  assert.equal(at(card({ id: "n" })), "new", "never met");
  assert.equal(
    at(card({ id: "l", s: { ar2en: state({ phase: "learning" }), en2ar: freshState() } })),
    "learning",
  );
  assert.equal(
    at(card({ id: "y", s: { ar2en: state({ phase: "review", interval: 2 }), en2ar: state({ phase: "review", interval: 2 }) } })),
    "young",
  );
  assert.equal(
    at(card({ id: "m", s: { ar2en: state({ phase: "review", interval: 40 }), en2ar: state({ phase: "review", interval: 40 }) } })),
    "mature",
  );
});

test("a level that has opened and not been answered still fills the learner's hands", () => {
  /* The reading in review for a week, the writing open since this morning
     and never asked: learning, because the writing is work that has
     arrived. It looks like an accident of the counting and it was nearly
     changed on that basis — pass the unanswered ones over and the ten-card
     cap stops filling up in the first week. Simulated over a hundred and
     twenty days it admitted about five more cards and mastered three
     fewer, because the session budget did not grow with them. Written down
     here so the next reader measures before changing it. */
  const climbing = card({
    s: { ar2en: state({ phase: "review", interval: 6 }), en2ar: freshState() },
  });
  assert.equal(familyMaturity(climbing, twoTypes), "learning");
});

/* ---- the ladder ---- */

test("mastered is four days of interval in review, and nothing less", () => {
  assert.equal(mastered(freshState()), false, "never asked");
  assert.equal(mastered(state({ phase: "learning", step: 1 })), false, "still on the learning steps");
  assert.equal(mastered(state({ phase: "review", interval: 1 })), false, "graduated this morning");
  assert.equal(mastered(state({ phase: "review", interval: MASTERED_DAYS - 1 })), false);
  assert.equal(mastered(state({ phase: "review", interval: MASTERED_DAYS })), true);
  assert.equal(mastered(state({ phase: "review", interval: 40 })), true, "mature is mastered too");
  assert.equal(mastered(state({ phase: "relearning", interval: 20 })), false, "a lapse closes it again");
  /* "Easy" on a new card lands on exactly the threshold: the learner said
     it was easy and is taken at their word. */
  assert.equal(mastered(reschedule(freshState(), "easy", still)), true);
  assert.equal(mastered(reschedule(reschedule(freshState(), "good", still), "good", still)), false,
    "graduating the steps is two right answers ten minutes apart, which is not knowing a word");
});

test("a cued level opens on graduated, and writing from the meaning on mastered", () => {
  /* Recognition, production from a cue, production from the meaning: one
     of each, so the three levels are each one exercise wide. */
  const ladder = ["ar2en", "tr2ar", "en2ar"];
  const grad = state({ phase: "review", interval: 1 });
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  assert.deepEqual(openTypes(ladder, table({})), ["ar2en"], "a fresh form is asked to recognise, nothing else");
  assert.deepEqual(openTypes(ladder, table({ ar2en: state({ phase: "learning", step: 1 }) })), ["ar2en"],
    "one right answer is still on the steps, and the steps are the bar");
  /* Writing from a cue is still cued — the pronunciation is on the screen —
     so through the learning steps and in review is what earns it. Asking
     four days here held a card on recognition alone for a week or more. */
  assert.deepEqual(openTypes(ladder, table({ ar2en: grad })), ["ar2en", "tr2ar"],
    "graduated on the reading opens writing from a cue");
  /* But not the level above it: with nothing on the screen to go on, the
     four-day bar still stands. */
  assert.deepEqual(openTypes(ladder, table({ ar2en: grad, tr2ar: grad })), ["ar2en", "tr2ar"],
    "graduated is not enough for writing from the meaning alone");
  assert.deepEqual(openTypes(ladder, table({ ar2en: done, tr2ar: grad })), ["ar2en", "tr2ar"],
    "every exercise below it has to be mastered, not just the bottom one");
  assert.deepEqual(openTypes(ladder, table({ ar2en: done, tr2ar: done })), ["ar2en", "tr2ar", "en2ar"]);
  assert.deepEqual(openTypes(ladder, table({ ar2en: done, tr2ar: done, en2ar: done })), ladder, "and stays open");
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: slippedTwice(10), tr2ar: done, en2ar: done })),
    ["ar2en"],
    "missing the bottom twice running closes everything above it until it is recovered"
  );
  /* And once does not. One miss is as often a lapse of attention as a gap
     in knowing, and the question is coming back in ten minutes either
     way. */
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: slipped(10), tr2ar: done, en2ar: done })).length,
    ladder.length,
    "a single miss leaves the levels above open"
  );
});

test("the bar belongs to the level, not to whichever exercises a card happens to carry", () => {
  /* Two cards, each with one exercise on the second level: the grid on one
     and the gap-fill on the other, which is what a card in a deck too
     small for a grid is left with. They used to climb by different rules —
     the bar was the loosest any exercise on the level declared, and only
     the grid declared one — so the same word in a small deck waited for
     mastery where in a large one it waited for graduation. */
  const grad = state({ phase: "review", interval: 1 });
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  assert.deepEqual(openTypes(["ar2en", "match", "en2ar"], table({ ar2en: grad })), ["ar2en", "match"]);
  assert.deepEqual(openTypes(["ar2en", "ctx2pick", "en2ar"], table({ ar2en: grad })), ["ar2en", "ctx2pick"]);
  /* And the table says it once per level rather than once per exercise, so
     there is nothing for two exercises to disagree about. This replaced an
     invariant test that held every exercise on a level to the same answer
     and named the offender: worth having while the fact was written out
     nine times, and nothing to check now that it is written once. */
  for (const t of TYPES) {
    assert.equal(barOf(t), LEVEL_BARS[levelOf(t)], `${t}: the bar is its level's`);
  }
  /* The bars themselves, which are the rule the app teaches by: every cued
     level on graduated, and writing from the meaning alone on mastered.
     Levels 2 and 3 show the learner the word or its sound; level 4 gives
     them nothing but what it means. */
  assert.deepEqual(
    [1, 2, 3, 4].map((l) => LEVEL_BARS[l]),
    ["graduated", "graduated", "graduated", "mastered"],
    "everything under the writing opens on graduation; the writing asks four days"
  );
});

test("a level with nothing on it is passed straight through", () => {
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  /* No recording and no transliteration: nothing stands on level three, so
     mastering the reading and the grid is what opens the writing. */
  assert.deepEqual(openTypes(["match", "ar2en", "en2ar"], (t) => ({ match: done, ar2en: done })[t]),
    ["ar2en", "match", "en2ar"]);
  /* Every exercise on a level has to reach the bar, not just one — and the
     grid stands above reading the word alone. */
  assert.deepEqual(openTypes(["match", "rec2en", "ar2en", "en2ar"], (t) => ({ match: done, ar2en: done, rec2en: freshState() })[t]),
    ["rec2en", "ar2en"]);
  assert.deepEqual(openTypes([], () => undefined), [], "nothing supported, nothing open");
  /* Level by level, and within a level in the order the caller gave: the
     ladder decides what is open, and the list's own order does not. */
  assert.deepEqual(openTypes(["en2ar", "ar2en", "match"], (t) => ({ match: done, ar2en: done })[t]),
    ["ar2en", "match", "en2ar"]);
});

test("the whole cued half of the ladder is climbed on graduated", () => {
  const ladder = ["ar2en", "match", "tr2ar", "en2ar"];
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  const grad = state({ phase: "review", interval: 1 });
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  assert.deepEqual(openTypes(ladder, table({})), ["ar2en"], "a word never met is read alone, and not yet told apart");
  assert.deepEqual(openTypes(ladder, table({ ar2en: state({ phase: "learning", step: 1 }) })), ["ar2en"],
    "one right answer is still on the steps");
  assert.deepEqual(openTypes(ladder, table({ ar2en: grad })), ["ar2en", "match"],
    "graduated is enough for the grid — it is still recognition");
  /* And on up: the grid graduated opens writing from a cue, so a word read
     and told apart is asked for within days rather than within a fortnight.
     This is the whole of the change — it used to stop here. */
  assert.deepEqual(openTypes(ladder, table({ ar2en: grad, match: grad })), ["ar2en", "match", "tr2ar"],
    "and the grid graduated opens writing it from a cue");
  /* Writing from the meaning alone is the one level that still waits for
     four days on everything below it. */
  assert.deepEqual(openTypes(ladder, table({ ar2en: grad, match: grad, tr2ar: grad })), ["ar2en", "match", "tr2ar"],
    "three graduated levels still do not open writing from the meaning");
  assert.deepEqual(openTypes(ladder, table({ ar2en: done, match: done, tr2ar: done })), ladder,
    "mastering all three does");
  assert.deepEqual(openTypes(ladder, table({ ar2en: slippedTwice(10), match: done })), ["ar2en"],
    "and missing the reading twice running takes the grid away until it is back in review");
  assert.deepEqual(openTypes(ladder, table({ ar2en: slipped(10), match: done })),
    ["ar2en", "match", "tr2ar"],
    "where one miss leaves the reading counting as graduated, so nothing below the top shuts");
  assert.equal(graduated(state({ phase: "review", interval: 1 })), true);
  assert.equal(graduated(state({ phase: "relearning", interval: 10 })), false);
  assert.equal(graduated(freshState()), false);
});

test("the settings say which level each exercise stands on, and every one has a level", () => {
  for (const t of TYPES) assert.ok([1, 2, 3, 4].includes(levelOf(t)), `${t} has a level`);
  /* The gentle half of the set is the two bottom levels — recognising a
     word alone, then among others — so "Get started" and the ladder agree
     about what recognition is. */
  for (const t of TYPES) {
    if (levelOf(t) === 1) assert.ok(EX[t].gentle, `${t}: the bottom level is gentle`);
    if (EX[t].gentle) assert.ok(levelOf(t) <= 2, `${t}: gentle is never production`);
  }
  /* The second level is the one that asks which word it is rather than
     what it means: the grid, and the two that offer the word among four. */
  assert.deepEqual(TYPES.filter((t) => levelOf(t) === 2), ["match", "en2pick", "ctx2pick"]);
  assert.deepEqual(TYPES.filter((t) => levelOf(t) === 1), ["ar2pick", "ar2en", "rec2en", "dlgwhole"]);
  assert.equal(levelOf("no-such-exercise"), 1, "an unknown type is read as the bottom level, not a crash");
});

/* ---- room for what is new ---- */

test("a new word is earned, by one of the words in hand being learnt", () => {
  /* Two pools and no third thing. There is deliberately no per-session and
     no per-day allowance in here: ten short sittings in an evening used to
     be thirty new words where one long sitting was three, for the same
     work, because the allowance was counted in sessions. */
  const empty = { front: 0, inHand: 0 };
  assert.equal(roomForNew(empty), FRONT_DOOR_CAP, "an empty hand opens the front door wide");
  assert.equal(roomForNew({ front: FRONT_DOOR_CAP - 1, inHand: 0 }), 1, "the last place at the door");
  assert.equal(roomForNew({ front: FRONT_DOOR_CAP, inHand: 0 }), 0, "the door is full");
  assert.equal(roomForNew({ front: FRONT_DOOR_CAP + 5, inHand: 0 }), 0, "and never negative");

  /* The second pool is the ceiling on total load, and it binds on its own:
     a learner may be recognising everything they hold and still be holding
     too much of it. */
  assert.equal(roomForNew({ front: 0, inHand: IN_HAND_CAP }), 0, "too much in hand already");
  assert.equal(roomForNew({ front: 0, inHand: IN_HAND_CAP - 2 }), 2, "two places left in hand");
  assert.ok(IN_HAND_CAP > FRONT_DOOR_CAP, "the door is the narrower of the two");
});

test("a word is recognised when every rung of its first level is mastered", () => {
  /* Four days, which is the same bar that opens the level above it — so
     "learnt" means one thing in this app rather than two. */
  const first = TYPES.filter((/** @type {string} */ t) => levelOf(t) === 1);
  const all = (/** @type {any} */ st) => () => st;
  assert.equal(recognised(first, all(state({ phase: "review", interval: MASTERED_DAYS }))), true);
  assert.equal(recognised(first, all(state({ phase: "review", interval: MASTERED_DAYS - 1 }))), false);
  assert.equal(recognised(first, all(freshState())), false, "never answered is not recognised");
  assert.equal(recognised([], all(freshState())), true, "no first-level material: nothing to recognise");
  /* Higher rungs are not asked about: a word is through the door as soon
     as it can be recognised, and goes on climbing behind the newcomers. */
  const mixed = (/** @type {string} */ t) =>
    levelOf(t) === 1 ? state({ phase: "review", interval: MASTERED_DAYS }) : freshState();
  assert.equal(recognised(TYPES, mixed), true, "the climb does not hold the door");
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
  assert.deepEqual(unitsOf(undefined).map((u) => u.unit.id), [""],
    "and no crash on nothing: one blank form, which is what a card with no words has");
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

test("a card just answered is known to have been just answered", () => {
  /* Which is what stops a session that has run out of due cards reaching
     for the same nine words every twenty minutes all day. */
  assert.equal(justPractised(T - MIN, still), true);
  assert.equal(justPractised(T - JUST_PRACTISED + MIN, still), true);
  assert.equal(justPractised(T - JUST_PRACTISED, still), false, "the window has an end");
  assert.equal(justPractised(T - DAY, still), false);
  assert.equal(justPractised(0, still), false, "a card never answered is not one just answered");
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

/* ------------------------------------------------------------------
   Where a card stands on the ladder

   The same four levels openTypes gates on, said as a person can be told
   them. The tests that matter are the ones holding the two together: what
   a screen says and what the scheduler does have to be one answer.
   ------------------------------------------------------------------ */

/* One exercise on each level, so a level is a single thing to reach. */
const rungs = () => ["ar2en", "match", "tr2ar", "en2ar"];
/** @param {Record<string, ExerciseState>} s */
const climber = (s) => card({ s });

test("a card is on one level, and every level below it is done", () => {
  const grad = state({ phase: "review", interval: 1 });
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const at = (/** @type {Record<string, ExerciseState>} */ s) =>
    standings(climber(s), rungs);

  /* Never met: on the bottom level, not started. Every level it has
     material for is listed, so a screen can show the whole climb. */
  assert.deepEqual(at({}).map((r) => [r.level, r.status]),
    [[1, "none"], [2, "none"], [3, "none"], [4, "none"]]);
  assert.equal(must(standing(at({})), "a standing").level, 1);
  assert.equal(must(standing(at({})), "a standing").status, "none");

  /* Answered once and still on the learning steps: learning, and nothing
     above it has opened. */
  const started = at({ ar2en: state({ phase: "learning", step: 1 }) });
  assert.deepEqual(started.map((r) => r.status), ["learning", "none", "none", "none"]);
  assert.equal(must(standing(started), "a standing").level, 1);

  /* Through the steps and in review: the bottom level is done and the card
     has moved up, with nothing answered there yet. */
  const up = at({ ar2en: grad });
  assert.deepEqual(up.map((r) => r.status), ["done", "none", "none", "none"]);
  assert.equal(must(standing(up), "a standing").level, 2);
  assert.equal(must(standing(up), "a standing").status, "none");

  /* And on up. The writing waits for four days from everything under it,
     which is why the third level is not done on graduation alone. */
  const two = at({ ar2en: grad, match: grad });
  assert.deepEqual(two.map((r) => r.status), ["done", "done", "none", "none"]);
  assert.equal(must(standing(two), "a standing").level, 3);
  const three = at({ ar2en: done, match: done, tr2ar: done });
  assert.deepEqual(three.map((r) => r.status), ["done", "done", "done", "none"]);
  assert.equal(must(standing(three), "a standing").level, 4);

  /* Everything done is the one state that names the card rather than a
     level: there is nothing above left to open. */
  const all = at({ ar2en: done, match: done, tr2ar: done, en2ar: done });
  assert.deepEqual(all.map((r) => r.status), ["done", "done", "done", "done"]);
  assert.equal(must(standing(all), "a standing").status, "done");
});

test("a level a card has no material for is not one of its levels", () => {
  /* A scene has nothing to be told apart from and nothing to write from
     its meaning: it stands on the first and third levels only, and the
     ladder passes the other two straight through. Listing them as "not
     started" would be pointing a learner at work that does not exist. */
  const scene = card({ s: {} });
  const rows = standings(scene, () => ["dlgwhole", "dlgorder"]);
  assert.deepEqual(rows.map((r) => r.level), [1, 3]);
  /* And a card with nothing askable at all has no standing to show. */
  assert.deepEqual(standings(card({ s: {} }), () => []), []);
  assert.equal(standing([]), null);
});

/* ------------------------------------------------------------------
   One slip is a wobble; two is a gap

   Pausing is not a rule of its own — it falls out of a miss taking a
   question out of review, and a level only opening when everything below
   it is in review. So these are about `holding`, which is the one place
   that judgement is softened, and about the three readers staying level
   with each other.
   ------------------------------------------------------------------ */

test("two misses running is what the ladder counts, not two misses", () => {
  assert.equal(missedTwice(state({ hist: [1, 1, 0] })), false, "one miss");
  assert.equal(missedTwice(state({ hist: [1, 0, 0] })), true, "and a second on top of it");
  /* Recovering in between is the whole difference: that is two slips, not
     two running. */
  assert.equal(missedTwice(state({ hist: [0, 1, 0] })), false, "right in between clears it");
  assert.equal(missedTwice(state({ hist: [0, 0, 1] })), false, "and a right answer since");
});

test("a card from before any of this was recorded is not treated as failing", () => {
  /* Documents written before the history existed carry an empty one, and
     `[].every()` is true — so without the length guard every old card
     would read as having just missed twice and pause on the spot. */
  assert.equal(missedTwice(state({ hist: [] })), false, "nothing recorded");
  assert.equal(missedTwice(state({ hist: [0] })), false, "one outing recorded");
  assert.equal(missedTwice(freshState()), false, "and a state with no history at all");
});

test("one miss does not shut the levels above, and a second does", () => {
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const ladder = (/** @type {any} */ first) =>
    standings(
      climber({ ar2en: first, match: done, tr2ar: done, en2ar: state({ phase: "learning", step: 1 }) }),
      rungs,
    ).map((r) => r.status);

  assert.deepEqual(ladder(done), ["done", "done", "done", "learning"], "nothing missed");
  assert.deepEqual(ladder(slipped(8)), ["done", "done", "done", "learning"],
    "one miss changes nothing about the ladder");
  assert.deepEqual(ladder(slippedTwice(8)), ["learning", "paused", "paused", "paused"],
    "a second miss on the same question shuts them");
});

test("the grace forgives, it does not promote", () => {
  /* A word that had only ever scraped into review must not have its first
     miss hold open a level it was never good enough for. At the top the
     bar is a four-day gap, and a miss halves it — so a word that only just
     reached the top can fall under the bar on its own merits and shut the
     level whatever its history says. */
  const ladder = ["ar2en", "match", "tr2ar", "en2ar"];
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  /* Halved to three days by the miss: under the top level's bar. */
  const short = state({ ...slipped(MASTERED_DAYS - 1) });
  assert.ok(
    !openTypes(ladder, table({ ar2en: short, match: done, tr2ar: done })).includes("en2ar"),
    "a gap under the bar does not hold the top level open",
  );
  /* Where the halved gap still clears the bar, one miss is forgiven all
     the way up. */
  const long = slipped(10);
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: long, match: done, tr2ar: done })),
    ladder,
    "a gap still over the bar keeps every level open",
  );
  /* And the limit of that, written down because it is wider than it looks:
     every miss halves the gap, so a word missed repeatedly walks itself
     under the bar and closes the top level on a miss the strike count
     would have forgiven. Ten days, missed, recovered, missed again is
     three. The forgiveness is for the miss, not for the shrinking. */
  const worn = state({ ...slipped(3) });
  assert.ok(
    !openTypes(ladder, table({ ar2en: worn, match: done, tr2ar: done })).includes("en2ar"),
    "a gap worn down by repeated misses shuts the top level on merit",
  );
});

test("missing a question below twice pauses the levels above rather than losing them", () => {
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  /* Three levels mastered, the writing met once — then the reading is
     forgotten, twice running. The levels above shut, and what was done
     there is still done: nothing is lost, it is waiting. */
  const rows = standings(
    climber({
      ar2en: slippedTwice(8),
      match: done,
      tr2ar: done,
      en2ar: state({ phase: "learning", step: 1 }),
    }),
    rungs,
  );
  assert.deepEqual(rows.map((r) => r.status), ["learning", "paused", "paused", "paused"]);
  /* The card is shown at the level it had reached, not at the rung it has
     been dropped to: "level 4, paused" is the sentence that explains where
     the writing went. */
  assert.equal(must(standing(rows), "a standing").level, 4);
  assert.equal(must(standing(rows), "a standing").status, "paused");
  /* A level shut but never answered is simply not started, not paused —
     there is nothing there to be waiting. */
  const early = standings(climber({ ar2en: state({ phase: "learning", step: 1 }) }), rungs);
  assert.deepEqual(early.map((r) => r.status), ["learning", "none", "none", "none"]);
});

test("the count on a level is what has to hold for the next one to open", () => {
  const grad = state({ phase: "review", interval: 1 });
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const at = (/** @type {Record<string, ExerciseState>} */ s) => standings(climber(s), rungs);
  /* Counted over the level and everything under it, because that is what
     openTypes asks — the writing wants four days from the reading too, not
     only from the level below it. So the count reaching its total and the
     level being done are the same fact, and cannot drift apart. */
  /** @type {Record<string, ExerciseState>[]} */
  const tables = [{}, { ar2en: grad }, { ar2en: grad, match: grad }, { ar2en: done, match: done, tr2ar: done }];
  for (const table of tables) {
    for (const row of at(table)) {
      assert.equal(row.done === row.of, row.status === "done",
        `level ${row.level}: ${row.done} of ${row.of} but ${row.status}`);
    }
  }
  assert.deepEqual(at({}).map((r) => `${r.done}/${r.of}`), ["0/1", "0/2", "0/3", "0/4"]);
  assert.deepEqual(at({ ar2en: grad }).map((r) => `${r.done}/${r.of}`), ["1/1", "1/2", "0/3", "0/4"]);
  /* The third level asks a stricter bar than the two below it were held
     to, so reaching it can put the count back to nothing. That is honest:
     the goal moved, and none of it has held for four days yet. */
  assert.deepEqual(at({ ar2en: grad, match: grad }).map((r) => `${r.done}/${r.of}`),
    ["1/1", "2/2", "0/3", "0/4"]);
});

test("a level is done exactly when the scheduler opens the one above it", () => {
  /* The claim the whole thing rests on: what a learner is told and what
     the app deals from are one answer said twice. Walked over every state
     a rung can be in, on every rung. */
  const shapes = [
    freshState(),
    state({ phase: "learning", step: 1 }),
    state({ phase: "review", interval: 1 }),
    state({ phase: "review", interval: MASTERED_DAYS }),
    state({ phase: "relearning", interval: 9 }),
  ];
  const ladder = rungs();
  let checked = 0;
  for (const a of shapes) {
    for (const b of shapes) {
      for (const c of shapes) {
        /** @type {Record<string, ExerciseState>} */
        const s = { ar2en: a, match: b, tr2ar: c };
        const open = new Set(openTypes(ladder, (t) => s[t]).map(levelOf));
        for (const row of standings(climber(s), rungs)) {
          if (row.level >= 4) continue;
          assert.equal(row.status === "done", open.has(row.level + 1),
            `level ${row.level} says ${row.status} but level ${row.level + 1} is ${open.has(row.level + 1) ? "open" : "shut"}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 300, `${checked} combinations`);
});

test("a family is only as far up the ladder as its weakest form", () => {
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const grown = { ar2en: done, match: done, tr2ar: done, en2ar: done };
  assert.equal(must(standing(standings(card({ s: grown }), rungs)), "a standing").status, "done");
  /* One plural nobody has met holds the whole card on the bottom level,
     exactly as it holds the card out of the session's higher levels. */
  const withSub = card({ s: grown, subs: [card({ id: "a-f0", s: {} })] });
  const rows = standings(withSub, rungs);
  assert.equal(must(standing(rows), "a standing").level, 1);
  assert.equal(must(standing(rows), "a standing").status, "learning");
  /* And the levels above it read as not started rather than paused. A
     level nobody has got to is not a level something slipped out of, and
     saying "paused" would send a learner looking for a mistake they never
     made. */
  assert.deepEqual(rows.map((r) => r.status), ["learning", "none", "none", "none"]);
});


test("what a card shows next turns on getting it right, not on being asked", () => {
  /*
   * The bug this is here to stop coming back: which values fill a card's
   * holes, which phrase it is shown in, which of its spellings is put up
   * and which of its meanings is asked about are all rotated on this
   * count, and the count used to be every attempt. So a learner who
   * missed "My name is Sarah" was asked "My name is Youssef" a moment
   * later — a sentence nobody had taught them, and one their own miss had
   * turned up. Miss that and the next was a third name. The card's word
   * was learnt long before the card could be.
   */
  let s = freshState();
  assert.equal(turnOf(s), 0, "nothing answered yet is the first turn");
  s = reschedule(s, "again", still);
  assert.equal(turnOf(s), 0, "drawing a blank leaves the question where it was");
  s = reschedule(s, "hard", still);
  assert.equal(turnOf(s), 0, "and so does being nearly right");
  s = reschedule(s, "good", still);
  assert.equal(turnOf(s), 1, "getting it right is what moves it on");
  /* And on it goes, so somebody answering well still meets every one of a
     card's variations before meeting any of them twice. */
  s = reschedule(s, "good", still);
  s = reschedule(s, "easy", still);
  assert.equal(turnOf(s), 3);
  /* A miss much later still holds rather than skipping ahead. */
  const held = turnOf(reschedule(s, "again", still));
  assert.equal(held, 3);
  /* No state at all is the first turn too — a form that has never been
     asked carries no record of it. */
  assert.equal(turnOf(null), 0);
  assert.equal(turnOf(undefined), 0);
});

test("how far a form has climbed, for a card standing in somebody else's sentence", () => {
  /* openTypes answers "what may this be asked". This answers "how much of
     it does the learner know", which is what a value filling a hole in a
     phrase has to answer: the name in "My name is ___" is read, or written,
     by whoever is answering the phrase. */
  const ladder = ["ar2en", "tr2ar", "en2ar"];
  const grad = state({ phase: "review", interval: 1 });
  const done = state({ phase: "review", interval: MASTERED_DAYS });
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];

  /* The addition openTypes has no use for: level one is open on every card
     from the day it arrives, which is a fact about the ladder and not about
     the learner. A form nobody has answered has reached nothing — which is
     the whole bug, since that is the word that ended up inside a sentence
     somebody was asked to write. */
  assert.equal(reachedLevel(ladder, table({}), 1), false,
    "a card nobody has answered has got nowhere, whatever its levels say");
  assert.equal(
    reachedLevel(ladder, table({ ar2en: state({ phase: "learning", step: 1 }) }), 1),
    true,
    "one answer is enough to have met it");

  /* And above that it is openTypes' own test, level by level. */
  const met = { ar2en: state({ phase: "learning", step: 1 }) };
  assert.equal(reachedLevel(ladder, table(met), 2), false, "met is not yet graduated");
  assert.equal(reachedLevel(ladder, table({ ar2en: grad }), 2), true);
  assert.equal(reachedLevel(ladder, table({ ar2en: grad }), 3), true,
    "writing from a cue asks the same bar of the level below it");
  assert.equal(reachedLevel(ladder, table({ ar2en: grad, tr2ar: grad }), 4), false,
    "writing from the meaning keeps the four-day bar");
  assert.equal(reachedLevel(ladder, table({ ar2en: done, tr2ar: done }), 4), true);

  /* A level the form has no material for is passed straight through, as in
     openTypes — so a word with no recording is not held back from a level
     it has nothing standing on. */
  assert.equal(reachedLevel(["ar2en"], table({ ar2en: done }), 4), true,
    "nothing below to be waiting on");
});

/* ------------------------------------------------------------------
   "This was too easy": one level up, and no further
   ------------------------------------------------------------------ */

/* A word's whole ladder, as laddered hands it in: three exercises a level. */
const LADDER = ["ar2pick", "ar2en", "rec2en", "match", "en2pick", "ctx2pick", "tr2ar", "rec2ar", "rec2attr", "en2ar", "ctx2ar", "rec2ctx"];
/** @param {Record<string, any>} have */
const stateIn = (have) => (/** @type {string} */ k) => have[k];

test("from the bottom, every level-one exercise is graduated and nothing above appears", () => {
  const out = liftLevel(LADDER, stateIn({}), "ar2en", still);
  assert.deepEqual(Object.keys(out).sort(), ["ar2en", "ar2pick", "rec2en"]);
  for (const s of Object.values(out)) {
    assert.equal(graduated(s), true);
    assert.equal(s.phase, "review");
    assert.equal(s.interval, GRADUATE_DAYS, "the smallest interval that meets the bar");
    assert.equal(s.updated, T, "stamped, so a sync keeps it");
    assert.equal(s.due, T + GRADUATE_DAYS * DAY);
  }
  /* The next level's own exercises are not touched, so the one after it stays shut. */
  assert.equal("match" in out, false);
});

test("from level two, levels one and two are graduated", () => {
  const out = liftLevel(LADDER, stateIn({}), "en2pick", still);
  assert.deepEqual(Object.keys(out).sort(), ["ar2en", "ar2pick", "ctx2pick", "en2pick", "match", "rec2en"]);
});

test("from level three, everything below four is mastered — the bar the top asks of it", () => {
  /* A level-one exercise merely graduated is raised to mastered as well:
     opening level four asks more of levels one and two than opening level
     three did. */
  const had = { ar2en: state({ phase: "review", interval: 1 }) };
  const out = liftLevel(LADDER, stateIn(had), "tr2ar", still);
  assert.equal(Object.keys(out).length, 9);
  for (const s of Object.values(out)) assert.equal(mastered(s), true);
  assert.equal(out.ar2en.interval, MASTERED_DAYS, "raised from graduated to the mastered bar");
  assert.equal("en2ar" in out, false, "and level four itself is untouched");
});

test("at the top there is nothing to open, so the form is counted as mastered throughout", () => {
  const out = liftLevel(LADDER, stateIn({}), "en2ar", still);
  assert.equal(Object.keys(out).length, LADDER.length);
  for (const s of Object.values(out)) assert.equal(mastered(s), true);
  assert.equal(hasLevelAbove(LADDER, "en2ar"), false);
  assert.equal(hasLevelAbove(LADDER, "tr2ar"), true);
});

test("a state already at the bar is left alone, and a longer interval is kept", () => {
  const had = {
    ar2pick: state({ phase: "review", interval: 12 }),
    ar2en: state({ phase: "learning", interval: 0 }),
    rec2en: state({ phase: "relearning", interval: 3 }),
  };
  const out = liftLevel(LADDER, stateIn(had), "ar2en", still);
  assert.equal("ar2pick" in out, false, "already graduated: not written at all");
  assert.equal(out.ar2en.phase, "review");
  assert.equal(out.rec2en.phase, "review", "relearning is not graduated, so it is");
  assert.equal(out.rec2en.interval, 3, "and keeps the interval it had, being above the bar's");
  /* Nothing here touches the count that rotates a card's spellings. */
  assert.equal(out.ar2en.right, had.ar2en.right);
  assert.equal(out.ar2en.reps, had.ar2en.reps);
});

test("a level the form has no exercise at is passed over, as openTypes passes it", () => {
  /* A verb's cell asked one exercise a level: lifting from its level-two
     key touches its level-one and level-two keys and opens level three. */
  const eased = ["ar2en", "match", "tr2ar", "en2ar"];
  const out = liftLevel(eased, stateIn({}), "match", still);
  assert.deepEqual(Object.keys(out).sort(), ["ar2en", "match"]);
});

/* ------------------------------------------------------------------
   A gap grows from the time actually waited

   Practice is no longer gated on a card being due, so a learner with a
   free hour can answer a card minutes after they last saw it. The rule
   that makes that safe: you never get credit for waiting longer than you
   did, and answering early never takes a card backwards.
   ------------------------------------------------------------------ */

/** A review card last answered `ago` days back, so its gap is `interval`. */
const waited = (/** @type {number} */ interval, /** @type {number} */ ago) => ({
  ...freshState(),
  phase: "review",
  interval,
  ease: 2.5,
  /* Where the last answer put it: the moment it was answered plus its gap. */
  due: T - ago * DAY + interval * DAY,
  reps: 4,
  right: 4,
});

test("answering on the day it asks for is exactly what it always was", () => {
  /* The regression that matters most: every learner who uses the app the
     way it intends must see no change at all from any of this. */
  for (const interval of [1, 3, 10, 30, 180]) {
    assert.equal(
      reschedule(waited(interval, interval), "good", still).interval,
      /* The ceiling still applies, as it did before: 180 days times the
         ease is past a year, and a year is as far as anything goes. */
      Math.min(MAX_DAYS, Math.round(interval * 2.5)),
      `a ${interval}-day card answered on time`,
    );
  }
});

test("and answering late is worth what answering on time is, not more", () => {
  /* A collection left for a month is not evidence of a month's retention
     of every card in it. Treating it as such is how a forgotten pile
     inflates itself out of reach. */
  assert.equal(
    reschedule(waited(10, 90), "good", still).interval,
    reschedule(waited(10, 10), "good", still).interval,
  );
});

test("answering straight after the last time does not move the card", () => {
  /* The hour on the train: drilling a card you have just seen is welcome,
     and it is worth nothing towards when the card comes back. */
  const s = reschedule(waited(30, 0), "good", still);
  assert.equal(s.interval, 30, "the gap stands");
  assert.equal(s.right, 5, "but the right answer is counted");
});

test("answering halfway through the gap moves nothing at all", () => {
  /* It used to grow the gap a little, on the reasoning that half a wait is
     half the evidence. The half it did not say out loud was that it also
     re-dated the card from the moment of the early answer, throwing away
     the wait already banked — so a card practised often enough never
     accumulated a wait, and never grew. It comes back when it was always
     going to, and grows then. */
  const s = reschedule(waited(20, 10), "good", still);
  assert.equal(s.interval, 20, "the gap stands");
  assert.equal(s.due, T + 10 * DAY, "and so does the date it was already coming back on");
});

test("and the date stands however many times it is answered early", () => {
  /* The bug this pair of tests exists for. Every early answer used to set
     the next date to *now* plus the gap, so somebody practising every
     twenty minutes pushed the card ahead of themselves all day and it
     never once fell due. Its gap could then only ever grow from the floor
     of one day, which tops out at three — under the four-day bar that says
     a word is recognised, so no word ever left the front door and no new
     word could arrive. */
  let s = waited(3, 0);
  const wasDue = s.due;
  for (let i = 0; i < 30; i += 1) s = reschedule(s, "good", still);
  assert.equal(s.due, wasDue, "still coming back when it always was");
  assert.equal(s.interval, 3, "on the gap it had");
  assert.equal(s.reps, 34, "and every answer was counted");
});

test("a card practised all day still grows when it finally falls due", () => {
  /* The other half: the wait is banked rather than spent, so the answer
     that lands on the day it asks for is worth the whole step. */
  let s = waited(3, 0);
  for (let i = 0; i < 30; i += 1) s = reschedule(s, "good", still);
  /* Three days later, when it actually asks. */
  const onTheDay = { now: () => T + 3 * DAY, random: () => 0.5 };
  const grown = reschedule(s, "good", onTheDay);
  assert.ok(grown.interval >= MASTERED_DAYS, `it reaches the bar: ${grown.interval}`);
});

test("no amount of early practice can push a card further out", () => {
  /* Twenty answers in one sitting used to be twenty multiplications. This
     is the property that lets the app offer unlimited practice at all. */
  let s = waited(30, 0);
  for (let i = 0; i < 20; i += 1) s = reschedule(s, "good", still);
  assert.equal(s.interval, 30, "still a thirty-day card");
  assert.equal(s.reps, 24, "and every answer was counted");
});

test("getting it wrong counts in full, however early it was", () => {
  /* Forgetting is news whenever it arrives, and it is the one thing that
     must not be softened by the rule above. */
  const s = reschedule(waited(30, 0), "again", still);
  assert.equal(s.phase, "relearning");
  assert.equal(s.interval, 15, "the gap is halved as it always was");
  assert.equal(s.lapses, 1);
});

test("a card with no due date recorded is scheduled as it always was", () => {
  /* Written by a build before any of this. There is nothing to work a wait
     out from, so it falls back to the full step rather than to nothing. */
  const old = { ...freshState(), phase: "review", interval: 10, ease: 2.5, due: 0 };
  assert.equal(reschedule(old, "good", still).interval, 25);
});
