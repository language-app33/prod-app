/*
 * Marking an answer.
 *
 * What happens to a learner's progress when they press Continue: what the
 * answer counts as, what that does to the schedule of the form it was
 * about, and where the result is written back on the card.
 *
 * It lived inside the screen, as a function closed over ten pieces of
 * React state — whether the hint was up, whether the answer had been
 * shown, what the grader said, which question was flagged as too easy.
 * That meant the one path that writes a learner's progress could not be
 * called at all without a browser, so the only thing testing it was a
 * jsdom walk that answered a single question and checked that *a* verdict
 * appeared on screen. A mark filed against the wrong form, or against the
 * wrong one of a card's two spellings, would have passed every check the
 * project had.
 *
 * So: a plain module, no React, no imports from the screen, and the two
 * impure things — the clock and where the answer came from — passed in.
 * The screen gathers its state, asks these three questions and applies the
 * answer:
 *
 *     const verdict = verdictOf({ checked, toldAnswer, overridden, skipped });
 *     const marks = [{ id, subId, ...verdict, advance: !practice }];
 *     const next = gradeInto(items, marks, { type, ... });
 *
 * This is the same move the scheduler made when it came out of the screen:
 * that file's own comment says the part of the app that decides what you
 * practise had no tests because it could not have any. This is the part
 * that decides what you have *learnt*, and it was in the same position.
 */

import type { Clock, ExerciseState, Form, Item } from "./types.ts";
import { freshState, reschedule } from "./scheduler.ts";
import { formsOf, leadOf } from "./cards.ts";
import { linesOf } from "./dialogs.ts";
import { noteMet } from "./variables.ts";

/**
 * What a language's grader said about what was typed.
 *
 * `ok` is whether it was accepted; `reason` is which shade of not-quite it
 * was, in the pack's own vocabulary. Open, because which reasons exist is
 * the language's answer — this module only knows that three of them are
 * near misses.
 */
export interface Checked {
  ok?: boolean;
  reason?: string;
}

/**
 * How the answer came to be given, beyond whether it was right.
 *
 * `toldAnswer` is the answer having been put on the screen — by the hint
 * that spells it out another way, which is the question one level down.
 * `overridden` is the learner saying the marking was too strict, which is
 * the one way a verdict is overturned by hand. `skipped` is "I don't
 * know".
 */
export interface Answered {
  checked?: Checked | null;
  toldAnswer?: boolean;
  overridden?: boolean;
  skipped?: boolean;
  /** Whether the nudge was open when the answer was sent. */
  hintAtAnswer?: boolean;
}

/** What the marking of one answer comes to. */
export interface Verdict {
  correct: boolean;
  near: boolean;
  /** What the scheduler is told: "good", "hard" or "again". */
  rating: string;
}

/*
 * The shades of not-quite-right that are still nearly right.
 *
 * Which reasons a pack returns is its own business; that some of them mean
 * "the right word, spelt not quite" is the app's. A near miss is the
 * mistake a learner makes over and over while they are learning, and
 * treating it as a blank is what sat such a card at a one-day interval for
 * ever — see reschedule, which gives it a floor.
 */
const NEARLY = ["near", "harakat", "missing"];

/**
 * What the answer counts as.
 *
 * A shown answer is a miss. Writing the word with its transliteration up
 * is the question one level down, so it is marked as that question was
 * nearly answered: the schedule moves gently, the card comes back before
 * the session ends, and the ladder is not climbed on it. Counting it as
 * knowing the word is how a learner with the nudge open graduated writing
 * from the meaning without once having done it.
 *
 * A near miss is "hard" rather than "again": it keeps the card in review
 * with a gentle penalty instead of halving its interval and sending it
 * back to relearning. It is still re-asked before the session ends.
 */
export function verdictOf({ checked, toldAnswer, overridden, skipped }: Answered): Verdict {
  const correct = !toldAnswer && !!(overridden || (checked && checked.ok && !skipped));
  const near =
    !correct && !skipped && !!checked && NEARLY.includes(String(checked.reason || ""));
  return { correct, near, rating: correct ? "good" : near || toldAnswer ? "hard" : "again" };
}

/**
 * One word this answer marks.
 *
 * Usually the one question on screen. A matching grid is five questions at
 * once, so it is five of these: every word in it is asked, marked and
 * scheduled in its own right, on the pair put to it and whatever the rest
 * of the grid did.
 *
 * `advance` is whether the schedule moves. Practice never advances one on
 * a success, and nor does a word dealt into a grid to fill it out that was
 * not due: the right answer counts, and the card comes back when it was
 * always going to. A miss is a miss wherever it happens.
 */
export interface Mark {
  id: string;
  subId: string | null;
  rating: string;
  correct: boolean;
  advance: boolean;
}

/** Everything about the question the marks were made on. */
export interface Asking {
  /** The schedule key that was asked — the exercise, and which answer. */
  type: string;
  /** Which level that key stands on, for the record of values met. */
  level?: number;
  /** What the question's blanks were filled with, as fillForm recorded it. */
  filledWith?: Record<string, string> | null;
  /** Which values are worth recording as met — the ones with no ladder. */
  keepMet?: (ref: string) => boolean;
  /**
   * The one question a lift has already moved up its ladder, where there
   * is one: the answer given to it is neither rewarded nor lapsed. Any
   * other word on the same grid is still marked.
   */
  spare?: { id: string; subId: string | null } | null;
  how?: Answered;
  clock?: Clock;
}

const now = (clock?: Clock) => (clock && clock.now ? clock.now() : Date.now());

/**
 * The state to write for one form, from the one it had.
 *
 * Through `reschedule` where the schedule moves, and by hand where it does
 * not — practice counts a right answer without moving the card. The counts
 * beside it are kept whether or not the schedule moved, because they are
 * what the progress screen and the difficulty reading are made of: a skip
 * is a skip, and "answered right" and "answered right with the
 * pronunciation on the screen" are two different numbers.
 */
export function markedState(
  before: ExerciseState,
  mark: Pick<Mark, "rating" | "correct" | "advance">,
  how: Answered = {},
  clock?: Clock,
): ExerciseState {
  const { checked, skipped, hintAtAnswer } = how;
  let s: ExerciseState;
  if (mark.advance || mark.rating !== "good") {
    s = reschedule(before, mark.rating, clock);
  } else {
    s = { ...before };
    s.right += 1;
    s.reps += 1;
  }
  if (skipped) s.skips = (s.skips || 0) + 1;
  if (hintAtAnswer) s.hints = (s.hints || 0) + 1;
  /* A near miss is counted as one however it was scheduled, which is what
     keeps the numbers on the progress screen true. */
  if (checked && !checked.ok && NEARLY.includes(String(checked.reason || ""))) {
    s.near = (s.near || 0) + 1;
  }
  s.hist = (s.hist || []).concat([mark.correct ? 1 : 0]).slice(-6);
  s.updated = now(clock);
  return s;
}

/**
 * Which form of a card a mark is about.
 *
 * A turn of a conversation is its own list; everything else is a form of
 * the card, and the card's own word is the first of those. Null where the
 * card no longer carries it, which is a card withdrawn while it was on
 * screen.
 */
export function targetOf(item: Item, subId: string | null): Form | null {
  if (!subId) return leadOf(item);
  return (
    formsOf(item).find((x) => x.id === subId) ||
    linesOf(item).find((x) => x.id === subId) ||
    null
  );
}

/**
 * One card, with one mark written onto the form it was about.
 *
 * The form keeps everything else it had — its words, its recordings, every
 * other key of its schedule — and gains the one key this answer was about,
 * and the record of which of its blanks has now been filled with which
 * word.
 *
 * That record is written from what the question was actually filled with,
 * rather than by working the values out a second time: doing it again
 * would read a count this very grading is about to move. Only for the
 * values with no ladder of their own — everything else is gated on its own
 * progress and needs nothing written down — and on any answer rather than
 * only a right one, because the question is whether the learner has seen
 * the word and getting it wrong is still having seen it.
 */
export function withMark(
  item: Item,
  subId: string | null,
  state: ExerciseState,
  asking: Asking,
): Item {
  const at = now(asking.clock);
  const target = targetOf(item, subId);
  if (!target) return item;
  const met = noteMet(
    target.met,
    asking.filledWith,
    asking.level || 1,
    asking.keepMet || (() => true),
  );
  const grown = <T extends Form>(x: T): T => ({
    ...x,
    s: { ...x.s, [asking.type]: state },
    ...(met ? { met } : null),
    updated: at,
  });
  const isLine = !!subId && linesOf(item).some((x) => x.id === subId);
  const asked = subId || leadOf(item).id;
  return {
    ...item,
    ...(isLine
      ? { lines: linesOf(item).map((x) => (x.id === subId ? grown(x) : x)) }
      : { forms: formsOf(item).map((x) => (x.id === asked ? grown(x) : x)) }),
    updated: at,
  };
}

/**
 * Every mark of one answer, written into the cards.
 *
 * The whole of what pressing Continue does to a document, as a function of
 * it. Comes back **null** where nothing was written at all — every card
 * withdrawn, or the one question marked being the one a lift already moved
 * — so the caller can leave the document exactly as it was rather than
 * saving a copy that differs in nothing.
 *
 * A card named by a mark that is no longer here is passed over rather than
 * failing: a teacher can withdraw a card while it is on the screen, and
 * the answer to that is the rest of the grid, not an exception.
 */
export function gradeInto(items: Item[], marks: Mark[], asking: Asking): Item[] | null {
  const out = items.slice();
  let any = false;
  for (const mark of marks) {
    const idx = out.findIndex((i) => i.id === mark.id);
    if (idx < 0) continue;
    const item = out[idx];
    const target = targetOf(item, mark.subId);
    if (!target) continue;
    /* The question a lift already moved. It counts as answered — the
       session moves on and the day's tally is kept — and the answer given
       to it changes nothing. */
    const spare = asking.spare;
    if (spare && spare.id === mark.id && (spare.subId || null) === (mark.subId || null)) {
      any = true;
      continue;
    }
    const before = (target.s && target.s[asking.type]) || freshState();
    out[idx] = withMark(
      item,
      mark.subId,
      markedState(before, mark, asking.how, asking.clock),
      asking,
    );
    any = true;
  }
  return any ? out : null;
}
