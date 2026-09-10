/** @import { Clock, ExerciseState, Form, Item } from "./types.js" */
/*
 * When a card comes back.
 *
 * This is the spaced-repetition maths, and it lived inside the screen file
 * until it was moved here — which meant the one part of the app that
 * decides what you practise, and when, had no tests at all. It could not
 * have any: `node --test` cannot import a .jsx file, and every function
 * read the clock and the random number generator straight out of the
 * global scope, so "a good answer on a ten-day interval gives twenty-four
 * to twenty-seven days" was not a sentence a test could write down.
 *
 * So: a plain module, no React, no imports from the app, and the two
 * impure things — the time and the jitter — passed in. The app calls these
 * exactly as it did before, because the real clock is the default. A test
 * passes a fixed one and gets an answer it can assert on.
 *
 *     reschedule(state, "good")                       // the real clock
 *     reschedule(state, "good", { now: () => T })     // a clock that stands still
 *
 * Nothing here reads the DOM, React state, or any module-level mutable.
 * Every function is a function of its arguments.
 */

import { TYPES } from "./languages.js";

export const DAY = 86400000;
export const MIN = 60000;

/* The learning ladder, in minutes, then the review parameters in days. */
export const LEARN_STEPS = [1, 10];
export const RELEARN_STEP = 10;
export const GRADUATE_DAYS = 1;
export const EASY_DAYS = 4;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_DAYS = 365;
export const MATURE_DAYS = 21;

/*
 * The clock and the jitter. Defaulted here rather than at each call site,
 * so a caller that says nothing gets the real world and a test that passes
 * one object gets a world that holds still.
 */
export const REAL_CLOCK = { now: Date.now, random: Math.random };
/** @type {(clock?: Clock) => number} */
const timeOf = (clock) => (clock && clock.now ? clock.now() : Date.now());
/** @type {(clock?: Clock) => number} */
const jitterOf = (clock) => (clock && clock.random ? clock.random() : Math.random());

/** @type {(e: number) => number} */
const clampEase = (e) => Math.max(MIN_EASE, Math.min(MAX_EASE, e));

/* ±5%, so a hundred cards learnt on one evening do not all come back on
   one evening. */
/** @type {(clock?: Clock) => number} */
const fuzz = (clock) => 0.95 + jitterOf(clock) * 0.1;

export function freshState() {
  return {
    phase: "new",
    step: 0,
    ease: 2.5,
    interval: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    right: 0,
    wrong: 0,
    skips: 0,
    near: 0,
    hist: [],
    updated: 0,
  };
}

/* One fresh state per exercise type. Takes the list so the caller decides
   what "every type" means — the app passes the real one. */
/**
 * @param {string[]} [types]
 * @returns {Record<string, ExerciseState>}
 */
export function freshStates(types = TYPES) {
  /** @type {Record<string, ExerciseState>} */
  const s = {};
  for (const t of types) s[t] = freshState();
  return s;
}

/* ------------------------------------------------------------------
   Spaced repetition (SM-2)
   ------------------------------------------------------------------ */

/**
 * @param {ExerciseState} prev
 * @param {string} rating
 * @param {Clock} [clock]
 * @returns {ExerciseState}
 */
export function reschedule(prev, rating, clock = REAL_CLOCK) {
  const at = timeOf(clock);
  /** @type {(n: number) => number} */
  const inDays = (n) => at + n * DAY;
  const s = { ...prev };
  s.reps += 1;
  /* "hard" is a near miss, not a success: it is scheduled gently but it is
     still counted as wrong, so the numbers on the progress screen are true. */
  if (rating === "again" || rating === "hard") s.wrong += 1;
  else s.right += 1;

  if (s.phase === "new" || s.phase === "learning") {
    if (rating === "again") {
      s.phase = "learning";
      s.step = 0;
      s.due = at + LEARN_STEPS[0] * MIN;
    } else if (rating === "easy") {
      s.phase = "review";
      s.step = 0;
      s.interval = EASY_DAYS;
      s.due = inDays(EASY_DAYS);
    } else if (rating === "hard") {
      s.phase = "learning";
      s.due = at + LEARN_STEPS[Math.min(s.step, LEARN_STEPS.length - 1)] * MIN;
    } else {
      const next = s.step + 1;
      if (next >= LEARN_STEPS.length) {
        s.phase = "review";
        s.step = 0;
        s.interval = GRADUATE_DAYS;
        s.due = inDays(GRADUATE_DAYS);
      } else {
        s.phase = "learning";
        s.step = next;
        s.due = at + LEARN_STEPS[next] * MIN;
      }
    }
    return s;
  }

  if (s.phase === "relearning") {
    if (rating === "again") {
      s.due = at + RELEARN_STEP * MIN;
    } else {
      s.phase = "review";
      s.interval = Math.max(1, s.interval);
      s.due = inDays(s.interval);
    }
    return s;
  }

  if (rating === "again") {
    s.lapses += 1;
    s.ease = clampEase(s.ease - 0.2);
    s.interval = Math.max(1, Math.round(s.interval * 0.5));
    s.phase = "relearning";
    s.due = at + RELEARN_STEP * MIN;
    return s;
  }

  let mult;
  if (rating === "hard") {
    s.ease = clampEase(s.ease - 0.15);
    mult = 1.2;
  } else if (rating === "easy") {
    s.ease = clampEase(s.ease + 0.15);
    mult = s.ease * 1.3;
  } else {
    mult = s.ease;
  }
  const base = Math.max(1, s.interval || 1);
  s.interval = Math.min(MAX_DAYS, Math.max(1, Math.round(base * mult * fuzz(clock))));
  s.due = inDays(s.interval);
  return s;
}

/* A state with no record yet has never been asked and so is ready by
   definition. In memory every state should exist; this is the guard for
   the render that happens before a lift catches up. */
/**
 * @param {ExerciseState | null | undefined} s
 * @param {Clock} [clock]
 */
export function stateReady(s, clock = REAL_CLOCK) {
  return !s || s.phase === "new" || (s.due || 0) <= timeOf(clock);
}

/** @param {ExerciseState} s Read on entry with no guard, unlike stateReady. */
export function maturity(s) {
  if (s.phase === "new") return "new";
  if (s.phase === "learning" || s.phase === "relearning") return "learning";
  return s.interval >= MATURE_DAYS ? "mature" : "young";
}

export const MATURITY_ORDER = ["new", "learning", "young", "mature"];

/* ------------------------------------------------------------------
   Automatic difficulty
   ------------------------------------------------------------------ */

/** @param {ExerciseState} s Read on entry with no guard, unlike stateReady. */
export function difficultyScore(s) {
  const attempts = (s.right || 0) + (s.wrong || 0);
  if (!attempts) return 0;
  const raw =
    ((s.wrong || 0) / attempts) * 40 +
    Math.min(s.lapses || 0, 5) * 6 +
    Math.min(s.skips || 0, 5) * 8 +
    (2.5 - (s.ease || 2.5)) * 20 -
    Math.min(s.near || 0, 5) * 3;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** @param {ExerciseState} s Read on entry with no guard, unlike stateReady. */
export function difficulty(s) {
  if ((s.right || 0) + (s.wrong || 0) < 2) return "unrated";
  const score = difficultyScore(s);
  if (score < 22) return "easy";
  if (score < 50) return "steady";
  return "hard";
}

/* ------------------------------------------------------------------
   A card and its forms, taken together
   ------------------------------------------------------------------ */

/* A card, then each of its forms — a plural, a feminine — each of which
   carries its own progress. */
/**
 * A card and its other forms, each drilled in its own right.
 *
 * What comes back are forms, not cards: the card is the first of them, and
 * the rest carry no tags, no lock and no deck. Everything downstream reads
 * the wording and the schedule, which is all a form has and all it needs.
 *
 * Takes nothing as well as a card: callers walk whatever they were handed
 * — a card looked up by an id that has since been withdrawn, most often —
 * and the guard below is what makes that a one-entry list rather than a
 * crash. The tests cover it, so the signature says it.
 * @param {Item | null | undefined} item
 * @returns {{ unit: Form, isSub: boolean }[]}
 */
export function unitsOf(item) {
  /** @type {{ unit: Form, isSub: boolean }[]} */
  const units = [{ unit: /** @type {Form} */ (item), isSub: false }];
  for (const sb of (item && item.subs) || []) units.push({ unit: sb, isSub: true });
  return units;
}

/*
 * A family counts as learnt only when every one of its forms is, so both
 * of these take the weakest link across the card and its forms.
 *
 * `typesOf` says which exercise types a given form supports. It is passed
 * in because the answer depends on the language pack and on the index of
 * phrases that show a word in use — neither of which belongs in here.
 */
/**
 * @param {Item} it
 * @param {(unit: Form) => string[]} typesOf
 */
export function familyMaturity(it, typesOf) {
  let worst = null;
  for (const { unit } of unitsOf(it)) {
    for (const t of typesOf(unit)) {
      const st = unit.s && unit.s[t];
      if (!st) continue;
      const m = maturity(st);
      if (worst === null || MATURITY_ORDER.indexOf(m) < MATURITY_ORDER.indexOf(worst)) worst = m;
    }
  }
  return worst || "new";
}

/**
 * @param {Item} it
 * @param {(unit: Form) => string[]} typesOf
 */
export function itemDifficulty(it, typesOf) {
  const rated = [];
  for (const { unit } of unitsOf(it)) {
    for (const t of typesOf(unit)) {
      const st = unit.s && unit.s[t];
      if (!st) continue;
      const d = difficulty(st);
      if (d !== "unrated") rated.push(d);
    }
  }
  if (!rated.length) return "unrated";
  if (rated.includes("hard")) return "hard";
  if (rated.includes("steady")) return "steady";
  return "easy";
}

/* ------------------------------------------------------------------
   Saying when, in words
   ------------------------------------------------------------------ */

/** @param {number} ms */
export function formatGap(ms) {
  if (ms <= 0) return "now";
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 31) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

/*
 * Which day an answer belongs to, for the activity log.
 *
 * This is UTC, not the learner's own day, so an evening session west of
 * Greenwich is filed under tomorrow. Nothing reads the log yet, so it is
 * recorded here rather than fixed: whoever builds the first streak or
 * heatmap needs to pass the learner's offset in, and should find this
 * paragraph when they do.
 */
/**
 * @param {number} [t]
 * @param {Clock} [clock]
 */
export function dayKey(t, clock = REAL_CLOCK) {
  return new Date(t === undefined ? timeOf(clock) : t).toISOString().slice(0, 10);
}
