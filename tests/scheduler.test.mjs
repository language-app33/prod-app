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
  mastered,
  missedTwice,
  openTypes,
  reachedLevel,
  solid,
  cleared,
  learnt,
  passesMade,
  topLevelOf,
  cameRound,
  movedTo,
  recentDays,
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
import { EX, TYPES, levelOf } from "../src/languages.ts";
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

/*
 * A question answered right twice running, and one answered right once.
 *
 * The ladder is read off the record of answers now rather than off the
 * gap — `solid` in the scheduler — so these two are the whole of what
 * opens a level and what does not. The interval is set to something
 * plausible so that nothing reading a schedule off these states reads a
 * card with no history at all; the ladder itself does not look at it.
 */
const sure = (/** @type {Partial<ExerciseState>} */ over = {}) =>
  state({ phase: "review", interval: 3, reps: 2, right: 2, hist: [1, 1], ...over });
const once = () => state({ phase: "review", interval: 1, reps: 1, right: 1, hist: [1] });

/* The same, with its passes made: what turns a cleared card into a learnt
   one. Only ever read on the top of a form's own ladder. */
const kept = () => sure({ passes: 2 });

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

test("a card relearned from nothing comes back a day later, not the same moment", () => {
  /*
   * The floor under the line above. A card can reach relearning with no
   * usable interval — one halved from a single day rounds to nought, and a
   * card written by an older build carries none at all — and without the
   * floor it would graduate to review due *now*, which is a card that
   * never leaves the session it was missed in.
   */
  for (const interval of [0, undefined]) {
    const out = reschedule(
      { ...freshState(), phase: "relearning", ...(interval === undefined ? {} : { interval }) },
      "good",
      still,
    );
    assert.equal(out.phase, "review", `interval ${interval}`);
    assert.equal(out.interval, 1, `interval ${interval}: a day at the least`);
    assert.equal(out.due, T + DAY, `interval ${interval}`);
  }
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

/*
 * And the two numbers the README states in words.
 *
 * Every other test that touches these imports them, so the assertion moves
 * with the constant and changing one goes green — which is the right shape
 * for a rule ("nothing new past the cap") and the wrong one for a number a
 * person decided. `tests/pace.test.mjs` measures what they cost a learner
 * in days and would report a change; this is what makes changing one go
 * red, so it is a decision rather than a drift. README, *A new word is
 * earned by learning one*: "at most ten words the learner cannot yet
 * recognise, and at most sixty in hand altogether".
 */
test("the two pools are the sizes the README says they are", () => {
  assert.equal(FRONT_DOOR_CAP, 10, "words not yet recognisable");
  assert.equal(IN_HAND_CAP, 60, "words in hand altogether");
});

test("a minute and a day are what they are everywhere else", () => {
  /* Read by every interval in the file, and by the app's own "3mo" line. */
  assert.equal(MIN, 60 * 1000);
  assert.equal(DAY, 24 * 60 * 60 * 1000);
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

/*
 * The weights themselves, and the two thresholds over them.
 *
 * Not arithmetic for its own sake: this score is the whole of what
 * `itemDifficulty` reads, and that is what orders a session — easiest
 * first, through DIFF_RANK in the trainer. So every number here decides
 * which card a learner meets first, and until this test each of them could
 * be changed without anything going red. Each case below names the one
 * term it is about and states what it contributes.
 */
test("each term of the difficulty score is worth what it says it is", () => {
  /* Nothing attempted is nothing to say, whatever else is on the state. */
  assert.equal(difficultyScore(state({ right: 0, wrong: 0, lapses: 4, skips: 4 })), 0);

  /* Wrong answers: the share of attempts that went wrong, times 40. Half
     wrong is 20. */
  assert.equal(difficultyScore(state({ right: 5, wrong: 5, ease: 2.5 })), 20);
  assert.equal(difficultyScore(state({ right: 0, wrong: 4, ease: 2.5 })), 40);

  /* Lapses: six each, and no more than five of them count. */
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, lapses: 1 })), 6);
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, lapses: 5 })), 30);
  assert.equal(
    difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, lapses: 9 })),
    difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, lapses: 5 })),
    "past five, another lapse adds nothing",
  );

  /* Skips: eight each, capped the same way. A skip is worth more than a
     lapse because it is the learner saying they do not know it at all. */
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, skips: 1 })), 8);
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, skips: 5 })), 40);
  assert.equal(
    difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, skips: 9 })),
    40,
    "past five, another skip adds nothing either",
  );

  /* Ease: twenty per point below 2.5, which is where every card starts. */
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.0 })), 10);
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 1.5 })), 20);

  /* Near misses pull the other way — three each, capped at five — because
     a learner who is close is not finding the card hard in the way a
     learner who is blank is. */
  assert.equal(difficultyScore(state({ right: 2, wrong: 2, ease: 2.5, near: 1 })), 20 - 3);
  assert.equal(difficultyScore(state({ right: 2, wrong: 2, ease: 2.5, near: 9 })), 20 - 15);

  /* And the whole thing is held inside nought and a hundred. */
  assert.equal(difficultyScore(state({ right: 4, wrong: 0, ease: 2.5, near: 5 })), 0);
  assert.equal(
    difficultyScore(state({ right: 0, wrong: 9, ease: MIN_EASE, lapses: 9, skips: 9 })),
    100,
  );
});

test("the two thresholds that turn the score into a word", () => {
  /* Read off difficultyScore so the cases cannot drift from the formula:
     each state below is built to land exactly on its side of a boundary. */
  const scored = (/** @type {Partial<ExerciseState>} */ over) => {
    const s = state({ right: 4, wrong: 0, ease: 2.5, ...over });
    return { score: difficultyScore(s), word: difficulty(s) };
  };
  /* 21 is easy and 22 is steady: the boundary is exclusive below. */
  const justEasy = scored({ lapses: 3, near: 1 }); // 18 - 3 = 15
  assert.equal(justEasy.score, 15);
  assert.equal(justEasy.word, "easy");
  const atBoundary = scored({ skips: 1, ease: 1.8 }); // 8 + 14 = 22
  assert.equal(atBoundary.score, 22);
  assert.equal(atBoundary.word, "steady", "22 is not easy");
  /* And 50 is where steady becomes hard, the same way round. */
  const justSteady = scored({ right: 1, wrong: 1, lapses: 1, skips: 1 }); // 20 + 6 + 8 = 34
  assert.equal(justSteady.word, "steady");
  const hard = scored({ right: 0, wrong: 4, lapses: 2 }); // 40 + 12 = 52
  assert.equal(hard.score, 52);
  assert.equal(hard.word, "hard");
});

test("a card is as hard as its hardest rated exercise, and unrated until one is", () => {
  /* What the session builder actually asks, which is about the card and
     not about one of its schedules: the ordering reads this. */
  /* Cast, as the fixture below this one is: what `itemDifficulty` reads of
     a card is its forms and their schedules, and writing out every other
     field a card carries would say less about that, not more.
     @returns {Item} */
  const formed = (/** @type {Record<string, any>} */ s) => /** @type {Item} */ (/** @type {unknown} */ ({
    id: "k", tags: [], created: 1, forms: [{ id: "k", ar: "كتاب", en: "book", s }],
  }));
  const everyType = () => ["ar2en", "en2ar"];
  const easy = state({ right: 4, wrong: 0, ease: 2.5 });
  const hard = state({ right: 0, wrong: 4, ease: 2.5, lapses: 2 });
  const once = state({ right: 1, wrong: 0, ease: 2.5 }); // unrated: one attempt

  assert.equal(itemDifficulty(formed({}), everyType), "unrated", "nothing answered");
  assert.equal(itemDifficulty(formed({ ar2en: once }), everyType), "unrated",
    "one attempt says nothing, so the card says nothing");
  assert.equal(itemDifficulty(formed({ ar2en: easy }), everyType), "easy");
  /* One hard exercise makes the card hard, however well the rest is going
     — which is the point: the card that needs the work goes first. */
  assert.equal(itemDifficulty(formed({ ar2en: easy, en2ar: hard }), everyType), "hard");
  /* And an unrated exercise beside a rated one is passed over rather than
     dragging the card back to unrated. */
  assert.equal(itemDifficulty(formed({ ar2en: easy, en2ar: once }), everyType), "easy");
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

test("a level opens on two right answers in a row, whatever the gap says", () => {
  /* Recognition, production from a cue, production from the meaning: one
     of each, so the three levels are each one exercise wide. */
  const ladder = ["ar2en", "tr2ar", "en2ar"];
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  assert.deepEqual(openTypes(ladder, table({})), ["ar2en"], "a fresh form is asked to recognise, nothing else");
  assert.deepEqual(openTypes(ladder, table({ ar2en: once() })), ["ar2en"],
    "one right answer is not two, however long the card has been in review");
  assert.deepEqual(openTypes(ladder, table({ ar2en: sure() })), ["ar2en", "tr2ar"],
    "right twice running on the reading opens writing from a cue");
  assert.deepEqual(openTypes(ladder, table({ ar2en: sure(), tr2ar: once() })), ["ar2en", "tr2ar"],
    "and every exercise below has to be there, not just the bottom one");
  assert.deepEqual(openTypes(ladder, table({ ar2en: sure(), tr2ar: sure() })), ladder,
    "which is the whole ladder, and nothing waited for a calendar");
  /* The bar a gap used to set is gone from here entirely. A card at a
     four-day interval that has only been right once is not up; a card
     answered twice this morning is. */
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: state({ phase: "review", interval: MASTERED_DAYS, hist: [1] }) })),
    ["ar2en"],
    "a long gap with one right answer under it opens nothing"
  );
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: sure({ interval: 1, phase: "review" }) })),
    ["ar2en", "tr2ar"],
    "and an evening's two right answers open the level above the same day"
  );
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: slippedTwice(10), tr2ar: sure(), en2ar: sure() })),
    ["ar2en"],
    "missing the bottom twice running closes everything above it until it is recovered"
  );
  /* And once does not. One miss is as often a lapse of attention as a gap
     in knowing, and the question is coming back in ten minutes either
     way. */
  assert.deepEqual(
    openTypes(ladder, table({ ar2en: slipped(10), tr2ar: sure(), en2ar: sure() })).length,
    ladder.length,
    "a single miss leaves the levels above open"
  );
});

test("one rule for every level, whatever exercises a card happens to carry", () => {
  /* Two cards, each with one exercise on the second level: the grid on one
     and the gap-fill on the other, which is what a card in a deck too
     small for a grid is left with. They used to climb by different rules —
     the bar was the loosest any exercise on the level declared, and only
     the grid declared one — then by a table of bars written once per
     level, and now by no table at all. */
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  assert.deepEqual(openTypes(["ar2en", "match", "en2ar"], table({ ar2en: sure() })), ["ar2en", "match"]);
  assert.deepEqual(openTypes(["ar2en", "ctx2pick", "en2ar"], table({ ar2en: sure() })), ["ar2en", "ctx2pick"]);
  /* The rule itself, read off `solid` rather than off anything declared:
     the most recent pair of answers to agree with itself is the verdict,
     in both directions. */
  assert.equal(solid(state({ hist: [1, 1] })), true, "right twice running");
  assert.equal(solid(state({ hist: [1, 1, 0] })), true, "one miss after it is forgiven");
  assert.equal(solid(state({ hist: [1, 1, 0, 0] })), false, "and two are not");
  assert.equal(solid(state({ hist: [1, 1, 0, 0, 1, 1] })), true, "recovered by two more");
  assert.equal(solid(state({ hist: [1] })), false, "one answer establishes nothing");
  assert.equal(solid(state({ hist: [1, 0, 1, 0] })), false, "nor does alternating");
  assert.equal(solid(freshState()), false, "and a card never answered has cleared nothing");
  /* A question answered before outings were recorded is taken at its
     schedule's word — see `solid`. Documents written before 0.155 carry an
     empty history, and reading those as uncleared would take a word away
     from somebody who has known it for a year. */
  assert.equal(solid(state({ hist: [], phase: "review", interval: 90 })), true,
    "no record at all, and plainly established");
  assert.equal(solid(state({ hist: [], phase: "learning", step: 1 })), false,
    "no record and not in review is not established");
  assert.equal(solid(state({ hist: [1], phase: "review", interval: 90 })), false,
    "and one recorded answer is information, not silence");
});

test("a level with nothing on it is passed straight through", () => {
  const done = sure();
  /* No recording and no transliteration: nothing stands on level three, so
     the reading and the grid are what open the writing. */
  assert.deepEqual(openTypes(["match", "ar2en", "en2ar"], (t) => ({ match: done, ar2en: done })[t]),
    ["ar2en", "match", "en2ar"]);
  /* Every exercise on a level has to be there, not just one — and the
     grid stands above reading the word alone. */
  assert.deepEqual(openTypes(["match", "rec2en", "ar2en", "en2ar"], (t) => ({ match: done, ar2en: done, rec2en: freshState() })[t]),
    ["rec2en", "ar2en"]);
  assert.deepEqual(openTypes([], () => undefined), [], "nothing supported, nothing open");
  /* Level by level, and within a level in the order the caller gave: the
     ladder decides what is open, and the list's own order does not. */
  assert.deepEqual(openTypes(["en2ar", "ar2en", "match"], (t) => ({ match: done, ar2en: done })[t]),
    ["ar2en", "match", "en2ar"]);
});

test("a whole ladder can be cleared in one sitting, and is not learnt for it", () => {
  const ladder = ["ar2en", "match", "tr2ar", "en2ar"];
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  assert.deepEqual(openTypes(ladder, table({})), ["ar2en"], "a word never met is read alone, and not yet told apart");
  assert.deepEqual(openTypes(ladder, table({ ar2en: once() })), ["ar2en"], "one right answer is still one");
  assert.deepEqual(openTypes(ladder, table({ ar2en: sure() })), ["ar2en", "match"]);
  assert.deepEqual(openTypes(ladder, table({ ar2en: sure(), match: sure() })), ["ar2en", "match", "tr2ar"]);
  /* And the top opens off the same two answers as every level under it.
     This is the whole of the change: the four-day bar that used to stand
     here made eight days the floor for anybody, however hard they
     worked. */
  const up = table({ ar2en: sure(), match: sure(), tr2ar: sure() });
  assert.deepEqual(openTypes(ladder, up), ladder, "writing from the meaning opens on the same rule");

  /* Cleared is not learnt. Every rung up, no passes made: the card has
     been to the top and has not yet come back. */
  const all = table({ ar2en: sure(), match: sure(), tr2ar: sure(), en2ar: sure() });
  assert.equal(cleared(ladder, all), true);
  assert.equal(passesMade(ladder, all), 0);
  assert.equal(learnt(ladder, all), false, "up the ladder is not the same as kept");
  /* One pass, then two. Counted on the top of the ladder alone — see
     passesMade — so what the reading is doing does not enter into it. */
  const half = table({ ar2en: sure(), match: sure(), tr2ar: sure(), en2ar: sure({ passes: 1 }) });
  assert.equal(passesMade(ladder, half), 1);
  assert.equal(learnt(ladder, half), false, "one return is not two");
  const both = table({ ar2en: sure(), match: sure(), tr2ar: sure(), en2ar: kept() });
  assert.equal(learnt(ladder, both), true);
  /* And a slip below takes the badge away again, which is the guard that
     makes counting passes at the top alone safe: the other questions keep
     coming round, and failing one of them twice running un-climbs the
     card however many passes its writing has made. */
  const slippedBelow = table({ ar2en: slippedTwice(10), match: sure(), tr2ar: sure(), en2ar: kept() });
  assert.equal(cleared(ladder, slippedBelow), false);
  assert.equal(learnt(ladder, slippedBelow), false, "a word that can no longer be read is not a word kept");
  assert.equal(passesMade(ladder, slippedBelow), 2, "and the passes are still on it, for when it is back");
  /* The top of a ladder is the ladder's own, not the table's. A card with
     nothing above writing from a cue makes its passes there. */
  assert.equal(topLevelOf(["ar2en", "match", "tr2ar"]), 3);
  assert.equal(topLevelOf(ladder), 4);
  assert.equal(
    learnt(["ar2en", "match", "tr2ar"], table({ ar2en: sure(), match: sure(), tr2ar: kept() })),
    true,
    "a card with no writing from the meaning is kept on the top rung it has"
  );
});

test("a pass is a question that came round, not one gone looking for", () => {
  const at = (/** @type {number} */ ms) => ({ now: () => ms });
  const due = state({ phase: "review", interval: 3, due: T });
  assert.equal(cameRound(due, at(T)), true, "due to the minute");
  assert.equal(cameRound(due, at(T + DAY)), true, "and overdue");
  assert.equal(cameRound(due, at(T - MIN)), false, "a minute early is early");
  assert.equal(cameRound(state({ phase: "learning", step: 1, due: T }), at(T)), false,
    "a question still on its learning steps has not been away from anybody");
  assert.equal(cameRound(freshState(), at(T)), false, "and one never answered has not come round");
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
  assert.deepEqual(TYPES.filter((t) => levelOf(t) === 2), [
    "match", "en2pick", "img2pick", "ctx2pick",
    /* Picking a number out of four, and showing a time on a dial. Both
       put the answer on the screen and ask which one it is. */
    "fig2pick", "time2dial",
  ]);
  assert.deepEqual(TYPES.filter((t) => levelOf(t) === 1), [
    "ar2pick", "ar2en", "rec2en", "rec2img", "dlgwhole",
    "num2fig", "rec2fig", "time2fig",
  ]);
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
  const done = sure();
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

  /* Right twice running: the bottom level is done and the card has moved
     up, with nothing answered there yet. */
  const up = at({ ar2en: done });
  assert.deepEqual(up.map((r) => r.status), ["done", "none", "none", "none"]);
  assert.equal(must(standing(up), "a standing").level, 2);
  assert.equal(must(standing(up), "a standing").status, "none");

  /* And on up, by the same rule each time. */
  const two = at({ ar2en: done, match: done });
  assert.deepEqual(two.map((r) => r.status), ["done", "done", "none", "none"]);
  assert.equal(must(standing(two), "a standing").level, 3);
  const three = at({ ar2en: done, match: done, tr2ar: done });
  assert.deepEqual(three.map((r) => r.status), ["done", "done", "done", "none"]);
  assert.equal(must(standing(three), "a standing").level, 4);

  /* The top of the ladder reached is *cleared*, which names the card
     rather than a level — and is not yet learnt. The row carries how many
     of the two passes are made, so the one line a screen shows can say
     what is left. */
  const all = at({ ar2en: done, match: done, tr2ar: done, en2ar: done });
  assert.deepEqual(all.map((r) => r.status), ["done", "done", "done", "cleared"]);
  assert.equal(must(standing(all), "a standing").status, "cleared");
  assert.equal(must(standing(all), "a standing").passes, 0);

  /* One pass made, then both — and only then does the card read as
     learnt. */
  const half = at({ ar2en: done, match: done, tr2ar: done, en2ar: sure({ passes: 1 }) });
  assert.equal(must(standing(half), "a standing").status, "cleared");
  assert.equal(must(standing(half), "a standing").passes, 1);
  const kept2 = at({ ar2en: done, match: done, tr2ar: done, en2ar: kept() });
  assert.deepEqual(kept2.map((r) => r.status), ["done", "done", "done", "done"]);
  assert.equal(must(standing(kept2), "a standing").status, "done");
  /* Passes are read off the top of the ladder alone, so a lower rung
     carrying one by some accident of history changes nothing. */
  const oddly = at({ ar2en: sure({ passes: 2 }), match: done, tr2ar: done, en2ar: done });
  assert.equal(must(standing(oddly), "a standing").status, "cleared");
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
  const done = sure();
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

test("the grace is one slip, and the gap has nothing to do with it", () => {
  /* The grace used to be a judgement about the interval — whether the
     halved gap still cleared the level's bar — which made it wider on
     some cards than on others and let a word worn down by repeated misses
     shut a level on a miss the strike count forgave. It is now the plain
     thing it always read as: one miss forgiven, two not, and the gap is
     nobody's business here.
     */
  const ladder = ["ar2en", "match", "tr2ar", "en2ar"];
  const table = (/** @type {Record<string, ExerciseState>} */ s) => (/** @type {string} */ t) => s[t];
  const done = sure();
  /* A miss halves the gap, so the same slip carries wildly different
     intervals. Every one of them holds the ladder open, because the
     record of answers is the same in each. */
  for (const interval of [MASTERED_DAYS - 1, 3, 10, 40]) {
    assert.deepEqual(
      openTypes(ladder, table({ ar2en: slipped(interval), match: done, tr2ar: done })),
      ladder,
      `one miss at a gap of ${interval} days leaves every level open`,
    );
  }
  /* And the second miss shuts them at every one of those gaps too. */
  for (const interval of [MASTERED_DAYS - 1, 3, 10, 40]) {
    assert.deepEqual(
      openTypes(ladder, table({ ar2en: slippedTwice(interval), match: done, tr2ar: done })),
      ["ar2en"],
      `two misses at a gap of ${interval} days shut them`,
    );
  }
});

test("missing a question below twice pauses the levels above rather than losing them", () => {
  const done = sure();
  /* Three levels up, the writing met once — then the reading is
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
  const done = sure();
  const at = (/** @type {Record<string, ExerciseState>} */ s) => standings(climber(s), rungs);
  /* Counted over the level and everything under it, because that is what
     openTypes asks. So the count reaching its total and the level being
     done are the same fact, and cannot drift apart — with the top row the
     one exception, where the count is full and the card reads as cleared
     until its passes are made. */
  /** @type {Record<string, ExerciseState>[]} */
  const tables = [{}, { ar2en: done }, { ar2en: done, match: done }, { ar2en: done, match: done, tr2ar: done }];
  for (const table of tables) {
    for (const row of at(table)) {
      assert.equal(row.done === row.of, row.status === "done",
        `level ${row.level}: ${row.done} of ${row.of} but ${row.status}`);
    }
  }
  assert.deepEqual(at({}).map((r) => `${r.done}/${r.of}`), ["0/1", "0/2", "0/3", "0/4"]);
  assert.deepEqual(at({ ar2en: done }).map((r) => `${r.done}/${r.of}`), ["1/1", "1/2", "1/3", "1/4"]);
  /* One rule for every level now, so the count only ever goes up: nothing
     below can be put back to nothing by reaching a stricter rung, because
     there is no stricter rung. */
  assert.deepEqual(at({ ar2en: done, match: done }).map((r) => `${r.done}/${r.of}`),
    ["1/1", "2/2", "2/3", "2/4"]);
});

test("a level is done exactly when the scheduler opens the one above it", () => {
  /* The claim the whole thing rests on: what a learner is told and what
     the app deals from are one answer said twice. Walked over every state
     a rung can be in, on every rung. */
  const shapes = [
    freshState(),
    state({ phase: "learning", step: 1, hist: [1] }),
    once(),
    sure(),
    slipped(9),
    slippedTwice(9),
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
  const grown = { ar2en: sure(), match: sure(), tr2ar: sure(), en2ar: kept() };
  assert.equal(must(standing(standings(card({ s: grown }), rungs)), "a standing").status, "done");
  /* And the passes are the weakest form's too, so one plural still making
     them holds the card at cleared however finished its own word is. */
  const lagging = card({ s: grown, subs: [card({ id: "a-f1", s: { ...grown, en2ar: sure({ passes: 1 }) } })] });
  const behind = must(standing(standings(lagging, rungs)), "a standing");
  assert.equal(behind.status, "cleared");
  assert.equal(behind.passes, 1);
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
  const done = sure();
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
  const met = { ar2en: state({ phase: "learning", step: 1, hist: [1] }) };
  assert.equal(reachedLevel(ladder, table(met), 2), false, "met once is not right twice running");
  assert.equal(reachedLevel(ladder, table({ ar2en: done }), 2), true);
  assert.equal(reachedLevel(ladder, table({ ar2en: done }), 3), true,
    "and one rule means the level above asks no more of it");
  assert.equal(reachedLevel(ladder, table({ ar2en: done, tr2ar: once() }), 4), false,
    "every exercise below has to be there");
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

test("from the bottom, every level-one exercise is solid and nothing above appears", () => {
  const out = liftLevel(LADDER, stateIn({}), "ar2en", still);
  assert.deepEqual(Object.keys(out).sort(), ["ar2en", "ar2pick", "rec2en"]);
  for (const s of Object.values(out)) {
    assert.equal(solid(s), true, "two right answers in a row, which is what the ladder asks");
    assert.equal(s.phase, "review", "and a key never answered is put into review rather than left new");
    assert.equal(s.interval, GRADUATE_DAYS);
    assert.equal(s.updated, T, "stamped, so a sync keeps it");
    assert.equal(s.due, T + GRADUATE_DAYS * DAY);
    assert.equal(s.passes || 0, 0, "the passes are the one thing a lift cannot claim");
  }
  /* The next level's own exercises are not touched, so the one after it stays shut. */
  assert.equal("match" in out, false);
});

test("from level two, levels one and two are lifted", () => {
  const out = liftLevel(LADDER, stateIn({}), "en2pick", still);
  assert.deepEqual(Object.keys(out).sort(), ["ar2en", "ar2pick", "ctx2pick", "en2pick", "match", "rec2en"]);
});

test("from level three, every key below four is lifted and level four is not", () => {
  const had = { ar2en: once() };
  const out = liftLevel(LADDER, stateIn(had), "tr2ar", still);
  assert.equal(Object.keys(out).length, 9);
  for (const s of Object.values(out)) assert.equal(solid(s), true);
  assert.equal("en2ar" in out, false, "and level four itself is untouched");
});

test("at the top there is nothing to open, so the whole ladder is lifted", () => {
  const out = liftLevel(LADDER, stateIn({}), "en2ar", still);
  assert.equal(Object.keys(out).length, LADDER.length);
  for (const s of Object.values(out)) assert.equal(solid(s), true);
  assert.equal(hasLevelAbove(LADDER, "en2ar"), false);
  assert.equal(hasLevelAbove(LADDER, "tr2ar"), true);
  /* Cleared, and not learnt: "too easy" is a statement about the ladder,
     and the two passes are what the learner has to come back for. A lift
     that handed those over would make a card learnt on a button. */
  assert.equal(cleared(LADDER, (k) => out[k]), true);
  assert.equal(learnt(LADDER, (k) => out[k]), false);
});

test("a key already solid is left alone, and the schedule it had is kept", () => {
  const had = {
    ar2pick: sure({ interval: 12 }),
    ar2en: state({ phase: "learning", interval: 0 }),
    rec2en: state({ phase: "relearning", interval: 3, hist: [1, 0] }),
  };
  const out = liftLevel(LADDER, stateIn(had), "ar2en", still);
  assert.equal("ar2pick" in out, false, "already solid: not written at all");
  assert.equal(out.ar2en.phase, "review");
  assert.equal(out.rec2en.phase, "review",
    "a key not in review is put there, so the question is not dealt again straight away");
  assert.equal(out.rec2en.interval, 3, "keeping the gap it had, which is already over a day");
  assert.equal(solid(out.rec2en), true, "and is up the ladder all the same");
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

/* ------------------------------------------------------------------
   What moved

   Everything above says where a card stands. This says what changed,
   which is the one thing a stock-take cannot reconstruct: once a card has
   moved, nothing on it records that it moved today rather than a
   fortnight ago.
   ------------------------------------------------------------------ */

/** A standing, as the screens read one. */
const at = (/** @type {number} */ level, /** @type {string} */ status) =>
  ({ level, status, done: 0, of: 1, passes: 0 });

test("a card is reported as moved up, cleared or learnt, and never as slipping", () => {
  assert.equal(movedTo(at(1, "learning"), at(2, "none")), "up", "a rung gained");
  assert.equal(movedTo(at(2, "none"), at(2, "learning")), null,
    "answering on the same rung is not a move");
  assert.equal(movedTo(null, at(1, "learning")), null,
    "and meeting a card for the first time is not a move up");
  assert.equal(movedTo(at(4, "learning"), at(4, "cleared")), "cleared");
  assert.equal(movedTo(at(4, "cleared"), at(4, "done")), "learnt");
  /* Reported once. A card already there has not moved there again — which
     is what keeps a second answer on a cleared card from counting a
     second time. */
  assert.equal(movedTo(at(4, "cleared"), at(4, "cleared")), null);
  assert.equal(movedTo(at(4, "done"), at(4, "done")), null);
  /* The larger of the two where both happened at once: a card that rises
     to the top rung and clears on the same answer is one piece of news. */
  assert.equal(movedTo(at(3, "learning"), at(4, "cleared")), "cleared");
  assert.equal(movedTo(at(3, "learning"), at(4, "done")), "learnt");
  /* And nothing at all for going backwards, at any distance. */
  assert.equal(movedTo(at(4, "done"), at(1, "learning")), null, "a card that slipped");
  assert.equal(movedTo(at(4, "cleared"), at(2, "paused")), null, "or paused");
  assert.equal(movedTo(at(2, "learning"), null), null, "or has nothing to practise at all");
});

test("the day a card moved is the learner's own day, not Greenwich's", () => {
  /* The note that used to stand over dayKey asked whoever first read the
     log back to fix this, which is what "Today — 3 cards moved up" now
     needs: an evening session west of Greenwich was being filed under
     tomorrow, so a learner's own evening's work was never under "today".
     Read against the local parts, which is what a learner would write. */
  const evening = new Date(2026, 8, 20, 21, 30, 0);
  assert.equal(dayKey(evening.getTime()), "2026-09-20");
  const earlyHours = new Date(2026, 8, 21, 0, 30, 0);
  assert.equal(dayKey(earlyHours.getTime()), "2026-09-21", "and midnight still turns the day over");
  /* Whatever the offset, the date is the one on the wall. */
  assert.equal(dayKey(new Date(2026, 0, 1, 23, 59, 59).getTime()), "2026-01-01");
  assert.equal(dayKey(new Date(2026, 11, 31, 0, 0, 1).getTime()), "2026-12-31");
});

test("a week is the last seven days, today first, with no day dropped or repeated", () => {
  const days = recentDays(7, { now: () => new Date(2026, 8, 20, 21, 0, 0).getTime(), random: () => 0.5 });
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-09-20", "today leads");
  assert.equal(days[6], "2026-09-14");
  assert.equal(new Set(days).size, 7, "no day twice");
  /* Walked from midday rather than by taking a day off the clock, so an
     hour gained or lost in the middle of the week cannot swallow one. */
  const spring = recentDays(7, { now: () => new Date(2026, 2, 31, 2, 0, 0).getTime(), random: () => 0.5 });
  assert.equal(new Set(spring).size, 7, "no day twice across a clock change");
  assert.equal(spring[0], "2026-03-31");
});
