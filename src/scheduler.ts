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
import { TYPES, levelOf } from "./languages.ts";
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
    passes: 0,
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

/*
 * How long a card counts as just practised.
 *
 * Two hours, and it decides one thing only: the order cards are reached
 * for once there is nothing actually due. A session that reaches past the
 * due line takes the nearest thing to due first, which is right on the
 * first sitting of a day and wrong on the tenth — the nearest thing to due
 * is the same handful of cards all day, so somebody who practises again
 * and again is handed the same words while the rest of what they are
 * learning sits untouched.
 *
 * So a card answered within the window goes behind one that has not been,
 * and nothing else about the order changes. Long enough that a run of
 * sittings works through what the learner holds rather than looping over
 * nine cards; short enough that an evening's practice is not still shaping
 * what they are offered the next morning.
 */
export const JUST_PRACTISED = 120 * MIN;

/**
 * Whether this card was answered inside that window.
 *
 * `lastSeen` is when any of its exercises was last answered — nought for a
 * card never touched, which is never "just practised".
 */
export function justPractised(lastSeen: number, clock: Clock = REAL_CLOCK): boolean {
  return !!lastSeen && timeOf(clock) - lastSeen < JUST_PRACTISED;
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

  /*
   * A card answered before it asks to be is counted, and moves nothing.
   *
   * This is the rule that lets the app offer practice whenever somebody
   * wants it. Everything above still applies — the answer is counted, and
   * getting it wrong still pulls the card back, in the branch above this
   * one — but a right answer given early leaves the gap and the date
   * exactly where the last real answer put them. The card comes back when
   * it was always going to.
   *
   * What stood here instead was a gap that grew from the time actually
   * waited, and it had a hole in it that got worse the harder somebody
   * practised. Answering early set the next date to *now* plus the gap, so
   * the wait already banked was thrown away and started again; and the
   * wait it grew from had a floor of one day, so a card drilled every
   * twenty minutes was credited with a day's retention it had not earned.
   * The two together held a card at a gap of about three days for ever:
   * every answer re-dated it, no answer ever grew it, and three days is
   * under the four-day bar that says a word is recognised. A learner
   * practising thirty times a day therefore never mastered a single word,
   * never emptied the front door, and was dealt the same ten words for
   * ever — which is exactly what they reported.
   *
   * The invariant the lines below depend on is the other half of why this
   * is the right place to stop: a review card's last answer is read back
   * out of `due` minus `interval`, so moving one of them without the
   * other would make every later reading of "how long did they wait" a
   * lie. Leaving both is what keeps that sound.
   */
  if ((s.due || 0) > at) return s;

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
   * Only an answer given on time or late reaches this, so what it works
   * out is never less than the interval — the cap below is what it is
   * for. An early answer returned above.
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
   * And the gap grows from what was actually waited out, which by here is
   * the interval itself or more.
   *
   * The floor of one day is what a card carrying no usable date falls back
   * on — an older build wrote no `due`, and there is nothing to work a
   * wait out from. It used to catch early answers too, and crediting a
   * card drilled twenty minutes ago with a day's retention is how the
   * three-day ceiling above came about. Early answers no longer reach it.
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
  /* And an answer can never take a card backwards: a gap that has been
     earned stands until the card is actually missed, which is handled far
     above and is the one thing that shortens one. */
  next = Math.max(next, s.interval || 1);
  s.interval = Math.min(MAX_DAYS, Math.max(1, next));
  s.due = inDays(s.interval);
  return s;
}

/**
 * Whether this question came round of its own accord, rather than being
 * gone looking for.
 *
 * The same test `reschedule` makes before it grows a gap, asked by name so
 * that what counts towards a pass and what counts towards an interval
 * cannot drift apart. In review, and due: a question still on its learning
 * steps has not yet been away from the learner, and one answered early was
 * chosen by them rather than by the schedule.
 *
 * It is the whole of why a pass cannot be crammed. Everything else about
 * this release lets effort buy progress; this is the one place it cannot,
 * and it is deliberately the same line that already stops a drilled card
 * from inflating its own gaps.
 */
export function cameRound(s: ExerciseState, clock: Clock = REAL_CLOCK): boolean {
  return s.phase === "review" && !!s.due && s.due <= timeOf(clock);
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
 * Right twice running, on the same question — and what opens the level
 * above it.
 *
 * The mirror of `missedTwice`, read off the same record and for the same
 * reason. Two rights on the end of `hist` is answered, put away, answered
 * again: not a guess, and not one lucky sitting. Two wrongs is the gap
 * that shuts the level. So the rule is one sentence in both directions —
 * **two right in a row opens a level, two wrong in a row closes it** —
 * and a single answer either way moves nothing, which is the grace
 * `holding` used to carry.
 *
 * Walking back from the end is what gives that grace without anything
 * stored. The most recent pair to agree with itself is the verdict: a
 * question right, right, then missed once reads back (0,1) — no pair —
 * then (1,1), and stands. Miss it again and the pair on the end is (0,0),
 * which closes the level exactly as it always did. A question that has
 * never managed two of either in a row has established nothing and is not
 * solid, which is also what an empty `hist` says and why a document
 * written before `hist` existed reads as unclimbed rather than as
 * finished.
 *
 * **What this replaced.** A level used to open on a *gap*: through the
 * learning steps for the cued levels, four days of interval for writing
 * from the meaning. That made the ladder a clock rather than a record of
 * what the learner had done, and it is why an evening's work could not
 * move a word: the four-day bar on the top level and the four-day bar
 * under it ran end to end, so the fastest a card could be learnt was
 * eight days however hard anybody tried. The gap has not gone anywhere —
 * it is what `passes` below now asks, after the climb rather than during
 * it, and it is still what lets a new word out of the front door. See
 * `recognised`.
 */
export function solid(s: ExerciseState): boolean {
  const h = s.hist || [];
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i] && h[i - 1]) return true;
    if (!h[i] && !h[i - 1]) return false;
  }
  /*
   * And a question answered before any of this was recorded is taken at
   * its schedule's word.
   *
   * `hist` has been written on every marked answer since 0.155; the
   * ladder only began reading it here. A card at a ninety-day gap that
   * was last answered before that carries an empty history, and without
   * this line it would read as having climbed nothing — the levels above
   * would shut and a learner would be asked what a word they have known
   * for a year means. Being in review is what the two cued levels used to
   * ask, so this is the old bar, applied only where there is nothing else
   * to go on.
   *
   * It is generous at the top, where the old bar was four days rather
   * than review at all. Deliberately: the card reads as climbed and has
   * its two passes still to make, which it makes on its next two reviews
   * — which is what those reviews were always going to be. The
   * alternative is taking a word away from somebody who has it.
   *
   * One answer is enough to leave this behind, and from then on the
   * record decides. A history of one is information and is not treated as
   * silence: it says the question has been answered once since the app
   * started counting, which is not twice.
   */
  return h.length === 0 && s.phase === "review";
}

/**
 * The states to write so that a form climbs one level of its ladder, and
 * no further — what "this was too easy" does.
 *
 * Applied to every key below the *next* level, because that is what opens
 * a level (see openTypes) — so climbing from three re-raises levels one
 * and two as well. A form with no level above the one asked has its whole
 * ladder written, which is what "done" means at the top. The next level's
 * own keys are not touched, so the one after it stays shut.
 *
 * Written directly rather than through `reschedule` with an "easy": a key
 * already in review would be pushed far past where it was, and the count
 * of right answers — which is what rotates a card's spellings and blanks —
 * would move for questions never answered. A key already solid is left
 * alone; one that is not is given the two right answers in a row the
 * ladder asks for, and stamped now so a sync keeps it.
 *
 * A key already in review keeps the gap it had. "Too easy" is a statement
 * about the *ladder* — stop asking me this, I can write the word — and
 * under the rule above the ladder is a record of answers rather than of
 * gaps. Writing a four-day interval here as well would hand the card its
 * passes too, and those are the one thing that cannot be claimed: they
 * are what the learner has to come back for.
 *
 * A key that is *not* in review is put there at a day, because that is
 * the other half of what the learner asked for: a key left new or sitting
 * on a ten-minute learning step would be dealt again the moment the
 * session was rebuilt, which is the app going on asking the question it
 * was just told not to.
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
  const under = next === undefined ? keys : keys.filter((k) => levelOf(k) < next);
  const out: Record<string, ExerciseState> = {};
  for (const k of under) {
    const s = stateOf(k) || freshState();
    if (solid(s)) continue;
    const hist = (s.hist || []).concat([1, 1]).slice(-6);
    const grown =
      s.phase === "review"
        ? {}
        : { phase: "review", step: 0, interval: Math.max(s.interval || 0, GRADUATE_DAYS), due: at + Math.max(s.interval || 0, GRADUATE_DAYS) * DAY };
    out[k] = { ...s, ...grown, hist, updated: at };
  }
  return out;
}

/** Whether a form has a level above the one this key is on — false at the
    top, where liftLevel writes the whole ladder instead of moving it up. */
export const hasLevelAbove = (keys: string[], key: string): boolean =>
  keys.some((k) => levelOf(k) > levelOf(key));

/* ------------------------------------------------------------------
   The ladder

   A form is recognised before it is produced. Every exercise stands on a
   level — recognising the word alone, telling it apart from others,
   production from a cue, production from the meaning — and a level is open
   for a form only once every exercise on the levels below it that the form
   supports has been answered right twice running. `solid`, above, and one
   rule for all four levels rather than a table of bars.

   **The ladder is climbed by answering, and kept by coming back.** Those
   were one thing and are now two. A level used to open on a gap — through
   the learning steps below, a four-day interval for the writing — which
   meant the ladder could only be climbed at the speed a calendar allows:
   four days for the lower levels to mature and four more for the top one,
   in that order, so eight days was the floor for anybody however hard
   they worked. An evening's work bought nothing a week's idleness did not.

   Now an evening's work climbs the card, and what the gap used to prove
   is asked afterwards instead, of the top of the ladder, where it means
   the most: see `passes` below. A card that has climbed is not yet learnt.

   Nothing about the order changed, and nothing about the grace. A form
   with no recording has nothing on level three but its transliteration,
   and that alone is what it must reach to open level four; a form with
   nothing at all on a level passes straight through it. Missing a
   question twice running still closes the levels above it until it is
   recovered — one miss is forgiven, and that is `solid` read from the
   other end.
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
    const lower = types.filter((t) => levelOf(t) < level);
    /* Through `solid`, so one miss below does not shut this level and two
       running do — see there. The screen reads the same judgement through
       `standings`, and a test walks every combination to keep the two from
       drifting. */
    const reached = lower.every((t) => {
      const s = stateOf(t);
      return !!s && solid(s);
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
  return types
    .filter((t) => levelOf(t) < level)
    .every((t) => {
      const s = stateOf(t);
      return !!s && solid(s);
    });
}

/* ------------------------------------------------------------------
   Climbed, and then learnt

   The ladder says what a card may be asked. These two say what the
   learner has actually got, and they are deliberately not the same thing:
   a card is **climbed** when it has been up every level it has material
   for, and **learnt** when it has come back twice since and been right.

   Climbing is bought with effort and can all happen in one evening.
   Being learnt cannot: the two passes are counted only on answers given
   when the question came round of its own accord, which is the one thing
   practising harder cannot manufacture — see `passes`, and the early
   return in `reschedule` that is the same idea one layer down.

   Which is the whole of what this release did. Effort used to buy
   nothing, because the ladder was a clock; now effort buys the climb and
   time buys the keeping, and the two are shown to the learner under those
   two names.
   ------------------------------------------------------------------ */

/**
 * Whether a form has been up every level it has material for.
 *
 * Every key solid — the same reading `openTypes` makes on its way up, run
 * to the top instead of stopping at the first closed level. A form nobody
 * has answered has climbed nothing, as in `reachedLevel` and for the same
 * reason.
 */
export function climbed(
  types: string[],
  stateOf: (type: string) => ExerciseState | null | undefined,
): boolean {
  if (!types.length) return false;
  return types.every((t) => {
    const s = stateOf(t);
    return !!s && solid(s);
  });
}

/**
 * The top of a form's own ladder — the highest level it has material for.
 *
 * Read off the keys rather than from TOP_LEVEL, because a card with no
 * phrase and no recording may top out at writing from a cue, and a
 * conversation at putting a scene in order. Asking those to pass at a
 * level they have nothing on would make them learnt the moment they
 * climbed, with nothing ever checked.
 */
export const topLevelOf = (types: string[]): number =>
  types.reduce((top, t) => Math.max(top, levelOf(t)), 0);

/**
 * How many passes a form has made — nought, one or two.
 *
 * A pass is every exercise on the top of its ladder answered right, on
 * time, since the card climbed. Two of them and the card is learnt.
 *
 * **Counted per exercise and reported as the weakest**, which is what
 * makes "two passes" true of the card rather than of whichever question
 * happened to come up. Where a card's top level holds one exercise — most
 * of them — the two readings are the same number.
 *
 * **Why the top level alone.** The alternative was every question the
 * card has, and it makes the badge hostage to the deal: a session hands a
 * card two of its eight questions, so "learnt" would land whenever the
 * last straggler happened to be dealt rather than when anything was
 * proved. Writing the word from its meaning is the question that subsumes
 * the others, and it is the one worth waiting on. The others have not
 * stopped being asked — they keep their own gaps and come round on their
 * own, and missing one of them twice running still shuts the levels above
 * and takes the card back off learnt, which is the guard that makes this
 * safe rather than merely shorter.
 */
export const PASSES_TO_LEARN = 2;

export function passesMade(
  types: string[],
  stateOf: (type: string) => ExerciseState | null | undefined,
): number {
  const top = types.filter((t) => levelOf(t) === topLevelOf(types));
  if (!top.length) return 0;
  return top.reduce((least, t) => {
    const s = stateOf(t);
    return Math.min(least, (s && s.passes) || 0);
  }, PASSES_TO_LEARN);
}

/**
 * Whether the learner has kept this form, and not merely climbed it.
 *
 * Climbed and two passes made. Both are read afresh, so a card that has
 * slipped back down the ladder is not learnt however many passes it once
 * had — the passes are still on it, and come back with it.
 */
export function learnt(
  types: string[],
  stateOf: (type: string) => ExerciseState | null | undefined,
): boolean {
  return climbed(types, stateOf) && passesMade(types, stateOf) >= PASSES_TO_LEARN;
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
   * "climbed" — the top of the ladder, up but not yet kept: every
   *   question answered right twice running, and the passes still to
   *   make. Only ever the top row, because it is the only one with
   *   nothing above it to open.
   * "done" — solid enough that the level above it opens, and at the top
   *   of the ladder the card's passes made as well, which is *learnt*.
   * "paused" — it had opened, and a slip further down has shut it again.
   */
  status: string;
  /**
   * How many passes the card has made, of the two that turn climbed into
   * learnt — on the top row only, and nought everywhere else.
   *
   * On the row rather than beside the list because that is where a screen
   * reads it: the one line a card puts up is its standing, and "climbed,
   * one pass of two" is the whole of what a learner needs told.
   */
  passes: number;
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
  /* And how many passes the card has made, which is its weakest form's —
     read off each form's *own* top level rather than off the card's,
     because a plural that tops out at writing from a cue makes its passes
     there and has nothing on the level above to make them on. Same
     reading `passesMade` makes, and a family is as far along as its
     weakest form, the way the rest of this function has it. */
  let passes = PASSES_TO_LEARN;
  for (const { unit } of unitsOf(it)) {
    const keys = typesOf(unit);
    if (keys.length) passes = Math.min(passes, passesMade(keys, (k) => unit.s && unit.s[k]));
    for (const t of keys) {
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
    /* Counted over this level and everything under it — see `done` above. */
    const under = levels.filter((l) => l <= level).flatMap((l) => at.get(l) || []);
    /* The same `solid` openTypes gates on, so a single miss neither shuts
       a level nor reports one as paused. */
    const done = under.filter((s) => !!s && solid(s)).length;
    const met = here.some(answered);
    const finished = done === under.length;
    /* The top of the ladder is the one row with nothing above it to open,
       so "done" there cannot mean what it means lower down. It is climbed
       until the passes are made and learnt after — and the difference is
       the whole of what this release added, said in the one place every
       screen reads. */
    const top = level === levels[levels.length - 1];
    const kept = !top || passes >= PASSES_TO_LEARN;
    out.push({
      level,
      status: finished
        ? kept
          ? "done"
          : "climbed"
        : !open
        ? met && allMetBelow
          ? "paused"
          : "none"
        : met
        ? "learning"
        : "none",
      done,
      of: under.length,
      passes: top ? passes : 0,
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
  /* Climbed is the top row as much as done is, and it is where the work
     is: the card is up the ladder and coming back to be kept. Reporting
     the rung under it instead would say a learner had further to climb
     than they have. */
  if (last.status === "done" || last.status === "climbed") return last;
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
