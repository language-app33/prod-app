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
import { PASSES_TO_LEARN, cameRound, cleared, freshState, reschedule, topLevelOf } from "./scheduler.ts";
import { levelOf } from "./languages.ts";
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
  /**
   * What this form's blanks were filled with, where it had any, as fillForm
   * recorded it.
   *
   * On the mark rather than beside the question, because one answer marks
   * more than one form and only one of them is the sentence: a grid marks
   * five words off one question, and a sentence credits every word that
   * stood in it. Writing the sentence's record onto the words it borrowed
   * would say each of them had been met with itself.
   */
  filled?: Record<string, string> | null;
  /**
   * The key this mark is filed under, where it is not the question's own.
   *
   * One answer may be evidence for two different things. A range of
   * numbers is one: answering it says the learner is getting better at
   * counting, which is the skill's own key, and it says they read the
   * word for forty and knew what it meant, which is the ordinary key that
   * word's card climbs. Both are true, and filing the second under the
   * first would write a schedule for a question no card is ever asked.
   *
   * Absent on nearly every mark, which is filed under the question.
   */
  under?: string;
}

/**
 * One word that stood in a sentence's blank.
 *
 * The caller resolves these, because which card lent a word and how far it
 * has got with it are facts about the rest of the deck — this module is
 * handed the answers.
 */
export interface Filler {
  /** The card it came from. */
  id: string;
  /** Which of that card's forms lent the word — null for its own. */
  subId: string | null;
  /** Whether that form's own ladder includes the key that was asked. */
  asked: boolean;
  /**
   * Whether its own schedule for that key is **under way and due** — not
   * merely open. A key the word has never been asked in its own right is
   * not started from inside a sentence; see fillerMarks.
   */
  ready: boolean;
}

/**
 * The words that stood in a sentence's blanks, credited for the answer.
 *
 * A sentence is a card made of blanks and the vocabulary fills them, so
 * answering one is answering about the words in it: writing *the book is
 * big* in the script is writing each of those two words in the script.
 * Until now only the sentence was marked, and the words it borrowed got
 * nothing — so a learner could write a noun correctly a dozen times inside
 * sentences and the app went on believing they had never produced it.
 *
 * Three rules, and the first two are the matching grid's, which is the
 * other exercise where one answer is about several words:
 *
 *   * **Only on a right answer.** A grid knows which word was mismatched;
 *     a sentence does not. A wrong answer says something in it was wrong
 *     and not which part, so it blames none of them — where a right one is
 *     unambiguous about every word in it.
 *   * **The schedule moves only where that word's own was under way and
 *     due.** A word dealt into a grid to fill it out is credited without
 *     its schedule moving, and the same holds here: the sentence is what
 *     was due, and being mentioned in one is not a reason to push a word
 *     further out than it had earned. Where the word *was* due, the
 *     answer is its answer — a sentence keeps a review up to date.
 *
 *     What it cannot do is *start* one. A key the word has never been
 *     asked on its own is left alone, because the top of the ladder is
 *     writing a word from its meaning with nothing on the screen to go
 *     on, and inside a sentence there is a whole sentence on the screen.
 *     Letting that open the rung would be graduating the strictest
 *     question in the app on the strength of a cued answer.
 *   * **Only exercises the word itself climbs.** A sentence may be asked
 *     something its fillers are not, so the key is checked against the
 *     filler's own ladder rather than assumed — the same rule the "too
 *     easy" lift got wrong by reading the question instead of the card.
 *
 * It is "good" rather than "easy": the word was produced inside a sentence
 * that was on the screen, which is a cued answer, and the ladder's whole
 * shape is that a cue is worth less than recall from the meaning alone.
 */
export function fillerMarks(
  fillers: Filler[],
  verdict: Pick<Verdict, "correct">,
  practice?: boolean,
): Mark[] {
  if (!verdict.correct) return [];
  const seen: Set<string> = new Set();
  const out: Mark[] = [];
  for (const f of fillers || []) {
    if (!f || !f.asked || !f.id) continue;
    /* One card may stand in two blanks of one sentence, and it is one word
       either way. */
    const at = `${f.id} ${f.subId || ""}`;
    if (seen.has(at)) continue;
    seen.add(at);
    out.push({
      id: f.id,
      subId: f.subId,
      rating: "good",
      correct: true,
      advance: !practice && f.ready,
    });
  }
  return out;
}

/** Everything about the question the marks were made on. */
export interface Asking {
  /** The schedule key that was asked — the exercise, and which answer. */
  type: string;
  /** Which level that key stands on, for the record of values met. */
  level?: number;
  /** Which values are worth recording as met — the ones with no ladder. */
  keepMet?: (ref: string) => boolean;
  /**
   * The schedule keys a form climbs with, for the one judgement this
   * module cannot make on its own: whether the card had already climbed
   * its whole ladder before this answer, and whether the question asked
   * stands on the top of it. Both together are what lets an answer count
   * towards a pass — see `markedState`.
   *
   * Passed as a function of the form rather than as a list, because one
   * answer marks several cards: a word standing in somebody else's
   * sentence is credited on its own ladder, and its ladder is not the
   * ladder of the sentence that carried it.
   *
   * Absent in a caller that does not care — a test marking one answer,
   * say — and then nothing counts towards a pass, which is the safe way
   * round: a pass never appears by accident.
   */
  keysOf?: (unit: Form) => string[];
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
  counting?: boolean,
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
  /*
   * And the pass, where this was the top of a cleared card's ladder.
   *
   * Three things have to be true together, and `counting` — worked out by
   * the caller, which is the only place that can see the rest of the card
   * — carries the two this function could not know: that the card had
   * already climbed before this answer, and that the question is on the
   * top of its own ladder. What is left here is the one the state itself
   * knows: that the question came round rather than being practised.
   *
   * A wrong answer puts it back to nought, wherever the card is. That is
   * the decision that a word just forgotten has not been kept, and it is
   * the reason a typo is not allowed to reach this far — one letter out
   * is re-asked instead, so an evening's carelessness does not cost a
   * learner four days. See `typoed` below.
   */
  if (!mark.correct) s.passes = 0;
  else if (counting && mark.advance && cameRound(before, clock)) {
    s.passes = Math.min(PASSES_TO_LEARN, (before.passes || 0) + 1);
  }
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
  filled?: Record<string, string> | null,
): Item {
  const at = now(asking.clock);
  const target = targetOf(item, subId);
  if (!target) return item;
  const met = noteMet(
    target.met,
    filled,
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
    const key = mark.under || asking.type;
    const before = (target.s && target.s[key]) || freshState();
    /* Whether this answer can count towards a pass: the form's own ladder,
       already climbed, and the question asked standing on the top of it.
       Read before the mark is written, so the answer that clears a card
       is part of the clearing rather than the first pass of it. */
    const keys = (asking.keysOf && asking.keysOf(target)) || [];
    const counting =
      keys.length > 0 &&
      levelOf(key) === topLevelOf(keys) &&
      cleared(keys, (k) => target.s && target.s[k]);
    out[idx] = withMark(
      item,
      mark.subId,
      markedState(before, mark, asking.how, asking.clock, counting),
      { ...asking, type: key },
      mark.filled,
    );
    any = true;
  }
  return any ? out : null;
}
