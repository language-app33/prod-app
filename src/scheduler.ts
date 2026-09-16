/*
 * When a card comes back.
 *
 * This is the spaced-repetition maths, and it lived inside the screen file
 * until it was moved here — which meant the one part of the app that
 * decides what you practise, and when, had no tests at all. It could not
 * have any: it was unreachable from a test, and every function
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

import type { Clock, ExerciseState, Form, Item } from "./types.ts";
import { TYPES, barAfterLevel, barOf, levelOf } from "./languages.ts";
import { leadOf, subFormsOf } from "./cards.ts";

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
 * When an exercise counts as mastered, which is what opens the next level of
 * the ladder for a form — see openTypes below.
 *
 * Four days of interval, in review. Graduating the learning steps is two
 * right answers ten minutes apart, which is not knowing a word; recalling
 * it the next day and again a few days after that is, and that is where
 * the interval first reaches four. It is also where an "easy" on a new
 * card lands, so a learner who says a word is easy is taken at their word.
 * Mature — three weeks — would hold a word at recognition for a month
 * before it could be written, which is the wrong month to spend.
 */
export const MASTERED_DAYS = 4;

/*
 * How many words may be in hand at once — two pools, and the only thing
 * that decides when a learner meets a new word.
 *
 * A word is *earned* rather than issued: one enters when one leaves. There
 * is no quota counted in sessions and none counted in days, so a learner
 * who sits for two minutes and one who sits for an hour are rationed by
 * what they have standing rather than by how they spent their evening.
 * That was the whole fault of what stood here before — three a session
 * meant ten short sittings were thirty new words and one long sitting was
 * three, for the same work.
 *
 * **The front door** is words the learner cannot yet recognise: met, and
 * short of a four-day gap on the first rung of the ladder. It is what
 * stops a new course arriving all at once, and it is small because these
 * are the words that cost the most to hold — nothing about them is known
 * yet, and every one of them is a stranger.
 *
 * **In hand** is everything not yet fully settled, at any height of the
 * ladder. It is the ceiling on total load, so a short session is never
 * spread so thin across half-learnt words that none of them moves.
 *
 * A word leaves the front door early, as soon as it is recognisable, and
 * goes on climbing against the second cap without blocking a newcomer
 * behind it. That is the difference between these two and the pair they
 * replace: the old ones both counted a word as "in learning" whenever any
 * exercise on it was unfinished — including one that had opened that
 * morning and never been asked — so a word held its place for its whole
 * climb through four levels and the pool never drained.
 *
 * The numbers were measured rather than chosen: see tests/pace.test.mjs,
 * which plays out a simulated learner and reports what a course costs in
 * days. Change one and run it.
 */
export const FRONT_DOOR_CAP = 10;
export const IN_HAND_CAP = 60;

/*
 * The clock and the jitter. Defaulted here rather than at each call site,
 * so a caller that says nothing gets the real world and a test that passes
 * one object gets a world that holds still.
 */
export const REAL_CLOCK = { now: Date.now, random: Math.random };

const timeOf = (clock?: Clock) => (clock && clock.now ? clock.now() : Date.now());

const jitterOf = (clock?: Clock) => (clock && clock.random ? clock.random() : Math.random());


const clampEase = (e: number) => Math.max(MIN_EASE, Math.min(MAX_EASE, e));

/* ±5%, so a hundred cards learnt on one evening do not all come back on
   one evening. */

const fuzz = (clock?: Clock) => 0.95 + jitterOf(clock) * 0.1;

export function freshState(): ExerciseState {
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
    hints: 0,
    hist: [],
    updated: 0,
  };
}

/* One fresh state per exercise type. Takes the list so the caller decides
   what "every type" means — the app passes the real one. */

export function freshStates(types: string[] = TYPES): Record<string, ExerciseState> {
  const s: Record<string, ExerciseState> = {};
  for (const t of types) s[t] = freshState();
  return s;
}

/* ------------------------------------------------------------------
   Random among equals

   A session is built out of orderings — the most overdue card first, the
   easiest first, the readiest exercise first — and every one of those
   leaves ties. Sorting alone keeps ties in whatever order the cards
   happen to sit in the document, which is an accident of when they were
   added and never changes: leave a session half way through and start
   another, and it is the same questions in the same order, because
   nothing in the building of one ever rolled a die.

   So: the orderings stand, and what they leave equal is shuffled. A card
   due three days ago does not outrank one due three hours ago — both are
   simply due — and which of them is asked first is exactly the sort of
   thing that should differ between one sitting and the next.

   The jitter is passed in, like the clock, so a test gets an order it can
   write down and the app gets a real one.
   ------------------------------------------------------------------ */

/**
 * A permutation, by Fisher–Yates. Never the same array back.
 */
export function shuffled<T>(list: T[], clock: Clock = REAL_CLOCK): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(jitterOf(clock) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/*
 * Ordered by rank, shuffled within each rank.
 *
 * The whole of the randomness in a session comes through here, which is
 * what keeps it from ever reordering something the design meant: a lower
 * rank always comes first, and the die is only thrown between things the
 * ranking itself called equal.
 */

export function inOrder<T>(list: T[], rankOf: (x: T) => number, clock: Clock = REAL_CLOCK): T[] {
  const byRank = new Map<number, T[]>();
  for (const x of list) {
    const r = rankOf(x);
    byRank.set(r, (byRank.get(r) || []).concat([x]));
  }
  return [...byRank.keys()]
    .sort((a, b) => a - b)
    .flatMap((r) => shuffled(byRank.get(r) || [], clock));
}

/*
 * How overdue a card is, to the only precision that means anything.
 *
 * Everything already due ranks the same. The alternative is ordering by
 * the exact moment each card fell due, which is false precision — a card
 * due this morning is not more urgent than one due last week in any sense
 * a learner would recognise — and it is what made two sessions built a
 * minute apart identical down to the last question.
 *
 * A card that is not due yet keeps its own time, because a practice
 * session that reaches past what is due should still reach for the
 * nearest thing first.
 */

export function dueRank(due: number, clock: Clock = REAL_CLOCK): number {
  return (due || 0) <= timeOf(clock) ? 0 : due;
}

/* ------------------------------------------------------------------
   Spaced repetition (SM-2)
   ------------------------------------------------------------------ */


export function reschedule(prev: ExerciseState, rating: string, clock: Clock = REAL_CLOCK): ExerciseState {
  const at = timeOf(clock);
  const inDays = (n: number) => at + n * DAY;
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
  /*
   * How long the learner actually went without seeing this card.
   *
   * A review card's gap is written into its own two fields: it was last
   * answered at `due` minus `interval`, because that is how the line at
   * the foot of this branch set them. So this needs nothing stored that
   * was not already there, and a card from an older build reads the same.
   *
   * Capped at the interval, so answering late is worth exactly what
   * answering on time is: a card left for three weeks when it asked for
   * one is not evidence of three weeks' retention of anything, and
   * treating it as such is how a forgotten collection inflates itself.
   * That cap is also what keeps every on-time and overdue answer byte for
   * byte what it was before this existed.
   */
  const waited = s.interval - (s.due - at) / DAY;
  /*
   * And the gap only grows from what was actually waited out.
   *
   * Practice is no longer gated on a card being due, so a learner with a
   * free hour can answer a card minutes after they last saw it. Multiplying
   * its existing month by the ease then would push it out to six weeks on
   * the evidence of a ten-minute memory — and a keen evening would empty
   * the next two months. Growing from what was waited instead means an
   * early answer is worth what it is worth: something when the card was
   * nearly due, almost nothing when it was not.
   */
  const base = Math.max(1, Math.min(s.interval || 1, waited));
  let next = Math.round(base * mult * fuzz(clock));
  /*
   * A near miss still moves.
   *
   * 1.2 times a one-day interval rounds back to one day, and so does 1.2
   * times two; only from three does the multiplier carry the interval past
   * where it started. A near miss is the mistake a learner makes over and
   * over while they are learning — the right letters with the wrong tone,
   * the wrong haraka, one letter out — so somebody whose fault is always
   * that one sat at a one-day interval for ever: never mastered, therefore
   * never past the level it stands on, and nothing on the screen to say
   * why the writing never arrived.
   *
   * So the floor: nearly right is worth at least a day more than last
   * time. The ease still falls, so the card is still treated as a hard
   * one; what it cannot do any more is stand still.
   */
  if (rating === "hard") next = Math.max(next, base + 1);
  /*
   * An early answer can help or do nothing. It can never take a card
   * backwards.
   *
   * Without this, drilling a card the day after a month-long gap was set
   * would grow from one day and hand back an interval of two or three —
   * so practising something you know well would be punished by having it
   * thrown at you all week. Getting it *wrong* still pulls it back, up
   * above, because that is real news whenever it arrives.
   */
  next = Math.max(next, s.interval || 1);
  s.interval = Math.min(MAX_DAYS, Math.max(1, next));
  s.due = inDays(s.interval);
  return s;
}

/* A state with no record yet has never been asked and so is ready by
   definition. In memory every state should exist; this is the guard for
   the render that happens before a lift catches up. */

export function stateReady(s: ExerciseState | null | undefined, clock: Clock = REAL_CLOCK): boolean {
  return !s || s.phase === "new" || (s.due || 0) <= timeOf(clock);
}

/* Read on entry with no guard, unlike stateReady. */
export function maturity(s: ExerciseState): string {
  if (s.phase === "new") return "new";
  if (s.phase === "learning" || s.phase === "relearning") return "learning";
  return s.interval >= MATURE_DAYS ? "mature" : "young";
}

export const MATURITY_ORDER = ["new", "learning", "young", "mature"];

/**
 * Which turn of a card's variations this asking is.
 *
 * Several things about a question vary between askings and are rotated
 * rather than drawn, so that a card with three of something is met as all
 * three before it is met as any of them twice: which values fill its
 * holes, which phrase it is shown in, which of its accepted spellings is
 * put up, and which of its meanings is asked about.
 *
 * The turn is how often the exercise has been answered *right*, and it
 * used to be how often it had been asked at all. That was the bug a
 * learner felt as never getting anywhere on a card with a variable in it:
 * miss "My name is Sarah" and the re-ask a moment later was "My name is
 * Youssef" — a sentence they had not been taught yet, keyed on a count
 * their miss had just moved on. Miss that and the next was a third name.
 * The card's own word was learnt long before the card could be, because
 * every attempt was a fresh question and none of them was ever the one
 * just failed.
 *
 * So it turns on a success. Get it wrong, or nearly right, and the same
 * question comes back until it is answered — which is the whole of what a
 * re-ask is for. Answer them all right and the variety is exactly what it
 * was.
 */
export function turnOf(s: ExerciseState | null | undefined): number {
  return (s && s.right) || 0;
}

/* Read on entry with no guard, unlike stateReady. */
export function mastered(s: ExerciseState): boolean {
  return s.phase === "review" && (s.interval || 0) >= MASTERED_DAYS;
}

/* Through the learning steps and in review, at whatever interval. A lapse
   takes it back out until the relearning step is passed. */
export function graduated(s: ExerciseState): boolean {
  return s.phase === "review";
}

/*
 * Wrong twice running, on the same question.
 *
 * `hist` is the only record with an order to it: the last six outings, 1
 * right and 0 wrong, written on every marked answer. Two zeros on the end
 * of it is wrong, seen again, wrong again, with nothing right in between —
 * and one right answer anywhere in those two slots clears it.
 *
 * The length guard is load bearing rather than defensive. A document
 * written before `hist` existed carries an empty one, and `[].every()` is
 * true, so without it every old card would read as having just failed
 * twice. `hasRecentMistake` in the trainer meets the same case and answers
 * it the same way.
 *
 * A near miss counts as wrong here, as it does in every other count the
 * app keeps: it is scheduled gently and it is still not knowing the word.
 */
export function missedTwice(s: ExerciseState): boolean {
  const h = s.hist || [];
  return h.length >= 2 && h.slice(-2).every((x) => !x);
}

/*
 * Whether this exercise holds the levels above it open.
 *
 * The bar itself is unchanged and is still what a level is *reached* by.
 * What this adds is one slip's grace: getting a question wrong once no
 * longer shuts everything above it, because a single miss is as often a
 * lapse of attention as a gap in knowing. Wrong twice running is the gap,
 * and that closes them exactly as a single miss used to.
 *
 * Nothing about how a miss is *scheduled* changes. The question still
 * comes back in ten minutes, still costs the word its ease, still halves
 * the gap. This decides one thing only: whether the ladder above it shuts
 * while that is being put right.
 *
 * The last clause is what keeps the grace honest. Read without it, a word
 * that had only ever scraped into review would have its first miss hold
 * open a level it was never good enough for — grace that promotes rather
 * than forgives. Asking the bar what it makes of the state *but for the
 * lapse* answers that: at the lower levels, being in relearning proves it
 * had graduated, so the grace always applies; at the top, where the bar is
 * a four-day gap and a miss halves it, a word that only just reached the
 * top can fall under the bar on its own merits and still shut the level.
 * Narrow — gaps outgrow it within a fortnight — and the right way to be
 * wrong.
 */
export function holding(s: ExerciseState, bar: (st: ExerciseState) => boolean): boolean {
  if (bar(s)) return true;
  if (s.phase !== "relearning" || missedTwice(s)) return false;
  return bar({ ...s, phase: "review" });
}

/**
 * The states to write so that a form climbs one level of its ladder, and
 * no further — what "this was too easy" does.
 *
 * The bar is the *next* level's, applied to every key below it, because
 * that is what opens a level (see openTypes): graduated for levels two and
 * three, mastered for four — so climbing from three re-raises levels one
 * and two as well. A form with no level above the one asked is counted as
 * mastered throughout, which is what "done" means at the top. The next
 * level's own keys are not touched, so the one after it stays shut.
 *
 * Written directly rather than through `reschedule` with an "easy": a key
 * already in review would be pushed far past where it was, and the count
 * of right answers — which is what rotates a card's spellings and blanks —
 * would move for questions never answered. A state already at the bar is
 * left alone; one that is not becomes a review state at the smallest
 * interval that meets the bar, keeping any larger interval it already had,
 * and stamped now so a sync keeps it.
 *
 * The keys are the form's own ladder, handed in, so a level the form has
 * no material at is simply absent — the same reading openTypes makes.
 */
export function liftLevel(
  keys: string[],
  stateOf: (key: string) => ExerciseState | null | undefined,
  key: string,
  clock: Clock = REAL_CLOCK,
): Record<string, ExerciseState> {
  const at = timeOf(clock);
  const from = levelOf(key);
  const levels = [...new Set(keys.map(levelOf))].sort((a, b) => a - b);
  const next = levels.find((l) => l > from);
  const bar = next === undefined ? "mastered" : barAfterLevel(next - 1);
  const under = next === undefined ? keys : keys.filter((k) => levelOf(k) < next);
  const met = bar === "graduated" ? graduated : mastered;
  const days = bar === "graduated" ? GRADUATE_DAYS : MASTERED_DAYS;
  const out: Record<string, ExerciseState> = {};
  for (const k of under) {
    const s = stateOf(k) || freshState();
    if (met(s)) continue;
    const interval = Math.max(s.interval || 0, days);
    out[k] = { ...s, phase: "review", step: 0, interval, due: at + interval * DAY, updated: at };
  }
  return out;
}

/** Whether a form has a level above the one this key is on — false at the
    top, where liftLevel counts it as mastered instead of moving it up. */
export const hasLevelAbove = (keys: string[], key: string): boolean =>
  keys.some((k) => levelOf(k) > levelOf(key));

/* ------------------------------------------------------------------
   The ladder

   A form is recognised before it is produced. Every exercise stands on a
   level — recognising the word alone, telling it apart from others,
   production from a cue, production from the meaning — and a level is open
   for a form only once every exercise on the levels below it that the form
   supports has reached the level's bar.

   The bar is graduated — through the learning steps and in review, at
   whatever interval — for the two levels that are still cued: telling a
   word apart from others, and writing it from a pronunciation or a
   recording that carries it. Both show the learner the word, neither is
   recall from the meaning alone, and asking a four-day interval of every
   recognition exercise first held a card on multiple choice for a week or
   more before it was ever asked for the word.

   Level four — writing it from its meaning, with nothing on the screen to
   go on — keeps the four-day bar, so the strict gate stands where
   production from memory actually begins.

   Which bar a level asks is the level's own business, and is written down
   once each in LEVEL_BARS in languages.ts. A form with no recording has
   nothing on level three but its transliteration, and that alone is what
   it must reach to open level four; a form with nothing at all on a level
   passes straight through it.

   Whether the bar is met is read afresh every time, so missing a question
   on the bottom level twice running closes the ones above it until it is
   recovered: somebody who can no longer read a word is not asked to write
   it. One miss is forgiven — see `holding`.
   ------------------------------------------------------------------ */

/**
 * Which of a form's exercises may be asked now.
 *
 * `types` is what the form supports — in the settings, in the material —
 * and what comes back is that list with the closed levels taken out, in
 * the same order. `stateOf` is passed rather than the form, so the caller
 * decides where a state comes from and a test can hand in a table.
 */
export function openTypes(types: string[], stateOf: (type: string) => ExerciseState | null | undefined): string[] {
  const out: string[] = [];
  const levels = [...new Set(types.map(levelOf))].sort((a, b) => a - b);
  for (const level of levels) {
    const here = types.filter((t) => levelOf(t) === level);
    /* The bar belongs to the level rather than to the exercise, so every
       card reaches a level the same way whichever of its exercises happen
       to stand there — see LEVEL_BARS in languages.ts. Asked of the first
       here because they all answer alike; `here` is never empty, being the
       exercises the level was read off. */
    const bar = barOf(here[0]) === "graduated" ? graduated : mastered;
    const lower = types.filter((t) => levelOf(t) < level);
    /* Through `holding`, so one miss below does not shut this level — see
       there. The screen reads the same judgement through `standings`, and
       a test walks every combination to keep the two from drifting. */
    const reached = lower.every((t) => {
      const s = stateOf(t);
      return !!s && holding(s, bar);
    });
    if (!reached) break;
    out.push(...here);
  }
  return out;
}

/**
 * How far up the ladder a form has actually climbed.
 *
 * openTypes answers "what may this be asked", which is the session's
 * question. This answers "how much of this does the learner know", which is
 * the question a card standing inside somebody else's sentence has to
 * answer: a name filling a hole in a phrase is read, or written, by
 * whoever is answering the phrase, so it has to be at least as far along as
 * the phrase is being asked.
 *
 * The same test openTypes makes on its way up, asked about one level rather
 * than returned as a list — including that a level the form has no material
 * for is passed straight through, so a word with no recording is not held
 * back from a level it has nothing standing on.
 *
 * With one addition openTypes has no use for: **a form nobody has answered
 * has reached nothing.** Level one is open on every card from the day it
 * arrives, which is a fact about the ladder rather than about the learner,
 * and reading it as knowledge is exactly how a word nobody has met ends up
 * inside a sentence somebody is being asked to write.
 */
export function reachedLevel(
  types: string[],
  stateOf: (type: string) => ExerciseState | null | undefined,
  level: number,
): boolean {
  const met = types.some((t) => {
    const s = stateOf(t);
    return !!s && s.phase !== "new";
  });
  if (!met) return false;
  /* The bar this level asks of everything under it, which is the bar
     openTypes reads off the level itself — barAfterLevel(level - 1) is
     LEVEL_BARS[level], named from the other end. */
  const bar = barAfterLevel(level - 1) === "graduated" ? graduated : mastered;
  return types
    .filter((t) => levelOf(t) < level)
    .every((t) => {
      const s = stateOf(t);
      return !!s && holding(s, bar);
    });
}

/* ------------------------------------------------------------------
   Room for what is new
   ------------------------------------------------------------------ */

/**
 * Whether the learner can recognise this word yet.
 *
 * Every rung of its first level mastered — a four-day gap, which is the
 * same bar that opens the level above it, so "learnt" means one thing in
 * this app rather than two. A word that carries no first-level material at
 * all has nothing to recognise and is through the door by definition.
 */
export function recognised(
  types: string[],
  stateOf: (type: string) => ExerciseState | null | undefined,
): boolean {
  const first = types.filter((t) => levelOf(t) === 1);
  if (!first.length) return true;
  return first.every((t) => {
    const s = stateOf(t);
    return !!s && mastered(s);
  });
}

/**
 * How many new words there is room for.
 *
 * The smaller of the two remainders, and nothing else: no per-session
 * allowance, no per-day allowance. See the caps above for why.
 *
 * `front` is words met and not yet recognisable; `inHand` is everything
 * not yet fully settled. Both are counted over everything the learner
 * holds in this language, not over the deck in front of them — the deck is
 * what they chose to look at, the load is what they carry.
 */
export function roomForNew(counts: { front: number; inHand: number }): number {
  return Math.max(
    0,
    Math.min(FRONT_DOOR_CAP - (counts.front || 0), IN_HAND_CAP - (counts.inHand || 0)),
  );
}

/* ------------------------------------------------------------------
   Automatic difficulty
   ------------------------------------------------------------------ */

/* Read on entry with no guard, unlike stateReady. */
export function difficultyScore(s: ExerciseState): number {
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

/* Read on entry with no guard, unlike stateReady. */
export function difficulty(s: ExerciseState): string {
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
/* A card and every form of it that is drilled on its own: its other
   spellings, and the turns of a conversation. What is due, how mature a
   card is and how hard it has proved are all counted over these. */
export interface Unit {
  unit: Form;
  isSub: boolean;
}

/**
 * A card and its other forms, each drilled in its own right.
 *
 * What comes back are forms, not cards: the card's own word is the first
 * of them, and none of them carries the tags, the lock or the deck those
 * belong to the card. Everything downstream reads the wording and the
 * schedule, which is all a form has and all it needs.
 *
 * Takes nothing as well as a card: callers walk whatever they were handed
 * — a card looked up by an id that has since been withdrawn, most often —
 * and a blank lead form is what makes that a one-entry list rather than a
 * crash. The tests cover it, so the signature says it.
 */
export function unitsOf(item: Item | null | undefined): Unit[] {
  const units: Unit[] = [{ unit: leadOf(item), isSub: false }];
  for (const sb of subFormsOf(item)) units.push({ unit: sb, isSub: true });
  /* The lines of a dialog, which are drilled in their own right exactly as
     the other forms of a word are: same three fields, same progress, same
     place in a session. They come through here rather than through a
     second walk of their own, so everything downstream — what is due, how
     mature a card is, how hard it has proved — counts a line without
     having been told what a dialog is. */
  for (const ln of (item && (item as Item & { lines?: Form[] }).lines) || []) {
    units.push({ unit: ln, isSub: true });
  }
  return units;
}

/**
 * Whether a form is asked about at all.
 *
 * The teacher's answer, off the form itself: a table of conjugations
 * written out for a student to read rather than to be drilled on, a rare
 * plural worth recording and not worth asking for. Absent means yes, which
 * is what every form written before this said and what anything added to a
 * card later says.
 *
 * It is a fact about the form and not about the schedule, which is why it
 * is one line: everything that decides what to ask reads it through
 * `laddered` in the app, and a form switched off comes back with no keys at
 * all — nothing to deal, nothing outstanding on the progress screen, and
 * every state it had kept exactly where it was for the day it is switched
 * back on.
 */
export const isAsked = (unit: Form | null | undefined): boolean =>
  !!unit && unit.ask !== false;

/*
 * A family counts as learnt only when every one of its forms is, so both
 * of these take the weakest link across the card and its forms.
 *
 * `typesOf` says which exercise types a given form supports. It is passed
 * in because the answer depends on the language pack and on the index of
 * phrases that show a word in use — neither of which belongs in here.
 * The app passes the open levels, so a card is judged on what it can be
 * asked and not held at "new" by a level it has not reached.
 */

/*
 * New means never met: every exercise untouched. A card with one exercise
 * answered and another not yet — the next level just opened, a plural not
 * yet asked — is being learnt, and says so; before this it read as new,
 * which put a card three weeks in beside one written this morning.
 */
export function familyMaturity(it: Item, typesOf: (unit: Form) => string[]): string {
  let worst: string | null = null;
  let met = false;
  for (const { unit } of unitsOf(it)) {
    for (const t of typesOf(unit)) {
      const st = unit.s && unit.s[t];
      const m = st ? maturity(st) : "new";
      if (m !== "new") met = true;
      if (worst === null || MATURITY_ORDER.indexOf(m) < MATURITY_ORDER.indexOf(worst)) worst = m;
    }
  }
  if (!met) return "new";
  return worst === "new" ? "learning" : worst || "new";
}

/*
 * There used to be a `phaseCounts` here, adding the four phases up across a
 * learner's whole collection, and a long note over it arguing that an
 * exercise on a just-opened level should hold its card at *learning*.
 *
 * Nothing counts phases in the aggregate any more. What rations new words
 * is two pools — see FRONT_DOOR_CAP — and what a learner is shown is the
 * ladder, which is `standings` below and reads levels rather than phases.
 * The count was left behind by that change, with a comment saying the
 * progress screen read it, which it did not.
 *
 * The argument it carried is still true and still load-bearing, so it sits
 * on `familyMaturity` above, which is where it applies: work that has
 * arrived is work in hand whether or not it has been touched. The
 * measurement it cited is `tests/pace.test.mjs` now, and can be re-run.
 */


export function itemDifficulty(it: Item, typesOf: (unit: Form) => string[]): string {
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
   Where a card stands on the ladder

   The same four levels openTypes gates on, read as something a person can
   be told: which level a card is on, and how it is going there. One
   vocabulary for the scheduler and the screen, so the two cannot come to
   disagree about how far along a word is — which they had, the progress
   screen saying a card was a third learnt while the app had it two levels
   up and asking it to be written.

   A level a card has no material for does not appear at all. A scene has
   nothing on the second or fourth level, a word with no recording and no
   phrase may have nothing on the third, and openTypes passes those
   straight through — so showing them as "not started" would set a learner
   looking for work that does not exist.
   ------------------------------------------------------------------ */

export interface Standing {
  /** Which level, as the exercise table numbers them. */
  level: number;
  /**
   * "none" — open, and nothing on it answered yet.
   * "learning" — open, something answered, not all of it solid.
   * "done" — solid enough that the level above it opens.
   * "paused" — it had opened, and a slip further down has shut it again.
   */
  status: string;
  /**
   * How many of the exercises that must hold for the next level to open
   * are there yet, and how many there are. That is everything on this
   * level *and under it*, because that is what openTypes asks: the
   * writing wants four days from the reading too, not just from the
   * level below it. So `done === of` is exactly "this level is done",
   * and the two can never drift apart.
   */
  done: number;
  of: number;
}

/**
 * Every level this card has material on, lowest first.
 *
 * `typesOf` gives the schedule keys a form climbs with, as openTypes is
 * given them — the caller decides whether that means everything the card
 * supports or only what the learner has switched on.
 *
 * A family is only as far up as its weakest form, the way familyMaturity
 * is: a plural nobody has met holds its card on the level that plural is
 * on. That is also what the scheduler does, so the screen agrees with it.
 */
export function standings(it: Item, typesOf: (unit: Form) => string[]): Standing[] {
  /* Every key the card climbs with, filed under its level. */
  const at: Map<number, (ExerciseState | null | undefined)[]> = new Map();
  for (const { unit } of unitsOf(it)) {
    for (const t of typesOf(unit)) {
      const level = levelOf(t);
      at.set(level, (at.get(level) || []).concat([unit.s && unit.s[t]]));
    }
  }
  const levels = [...at.keys()].sort((a, b) => a - b);
  const out: Standing[] = [];
  /* The bottom level is open from the first session; each one after it
     opens when the one below is done. Exactly openTypes' own loop. */
  let open = true;
  /* And whether everything under this level has been answered at least
     once, which is what tells a level shut by a slip from one that was
     never reached. A card whose plural has not been met holds its whole
     family on the bottom level — the levels above it are not paused,
     they have not been got to. */
  let allMetBelow = true;
  const answered = (s: ExerciseState | null | undefined) => !!s && s.phase !== "new";
  for (const level of levels) {
    const here = at.get(level) || [];
    const bar = barAfterLevel(level) === "graduated" ? graduated : mastered;
    /* Counted over this level and everything under it — see `done` above. */
    const under = levels.filter((l) => l <= level).flatMap((l) => at.get(l) || []);
    /* The same `holding` openTypes gates on, so a single miss neither
       shuts a level nor reports one as paused. */
    const done = under.filter((s) => !!s && holding(s, bar)).length;
    const met = here.some(answered);
    const finished = done === under.length;
    out.push({
      level,
      status: finished
        ? "done"
        : !open
        ? met && allMetBelow
          ? "paused"
          : "none"
        : met
        ? "learning"
        : "none",
      done,
      of: under.length,
    });
    open = finished;
    allMetBelow = allMetBelow && here.every(answered);
  }
  return out;
}

/**
 * The one of them to put on a card: where the work is.
 *
 * Every level below the card's own is done and every level above it is
 * shut, so one level and one word is the whole of it — until a slip
 * further down shuts a level that had been opened, which is the one thing
 * a learner cannot otherwise make sense of. Then it is the highest level
 * they had got to, said to be paused, rather than the rung they have been
 * dropped to: "level four, paused" is the sentence that explains where the
 * writing went.
 *
 * Takes the list rather than the card, so a screen that shows both the
 * headline and the levels under it walks the card once.
 *
 * Null where the card has nothing to practise at all.
 */
export function standing(all: Standing[]): Standing | null {
  if (!all.length) return null;
  const last = all[all.length - 1];
  if (last.status === "done") return last;
  const paused = all.filter((s) => s.status === "paused");
  if (paused.length) return paused[paused.length - 1];
  return all.find((s) => s.status !== "done") || last;
}

/* ------------------------------------------------------------------
   Saying when, in words
   ------------------------------------------------------------------ */


export function formatGap(ms: number): string {
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
export function dayKey(t?: number, clock: Clock = REAL_CLOCK): string {
  return new Date(t === undefined ? timeOf(clock) : t).toISOString().slice(0, 10);
}
