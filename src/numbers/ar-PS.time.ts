/*
 * Palestinian Arabic times.
 *
 * Three words, five ranges and a renderer that is one line, because a
 * clock is almost entirely not a language: the hour is the number
 * composer asked for a feminine referent, the minutes in the exact style
 * are the number composer counting the word for *minute*, and rounding,
 * carrying and reading the part of the day are arithmetic. All of that is
 * in compose.ts and serves every language that tells the time.
 *
 * **There is no agreement in this file**, so a fault in "two minutes" is a
 * fault in the number composer and is fixed once, for books and minutes
 * together.
 *
 * What is here is this dialect's answers: which words a clock needs that a
 * number has not already got, and what a learner is scheduled on.
 */
import type {
  NumberSystem,
  Range,
  SlotSpec,
  TimeComposer,
  TimeCtx,
  TimeRendering,
  TimeSystem,
} from "./types.ts";
import { MINUTE_MARKS } from "./types.ts";
import { renderClock } from "./compose.ts";
import { renderAr } from "./ar-PS.ts";

export const AR_TIME_COMPOSER_VERSION = 1;

/** The three words a clock needs that a number has not already got. */
export const AR_TIME_SLOTS: SlotSpec[] = [
  {
    slot: "hour.word",
    formKeys: ["standalone"],
    label: "hour",
    group: "clock words",
    hint: "The word that opens a time — as in “the hour is seven”.",
  },
  {
    slot: "connector.past",
    formKeys: ["standalone"],
    label: "past",
    group: "clock words",
    hint: "What joins the minutes on, and attaches to the word after it.",
  },
  {
    slot: "connector.to",
    formKeys: ["standalone"],
    label: "to",
    group: "clock words",
    hint: "What stands before the minutes when they are counted back from the next hour.",
  },
];

/**
 * What a learner is scheduled on.
 *
 * Whole hours first, then the three expressions anybody uses all day,
 * then the rest of the five-minute marks, then the exact minute — which
 * is a different skill again, since it is the only one that counts a
 * noun. The part of the day is last and is its own range because it is
 * the one thing about a time that a clock face cannot show.
 */
export const AR_TIME_RANGES: Range[] = [
  { id: "time:hours", kind: "time", label: "Telling the hour", from: 0, to: 23, marks: [0], style: "colloquial" },
  {
    id: "time:quarters-halves",
    kind: "time",
    label: "Quarters and half past",
    from: 0,
    to: 23,
    marks: [0, 15, 30, 45],
    style: "colloquial",
  },
  {
    id: "time:fives",
    kind: "time",
    label: "Every five minutes",
    from: 0,
    to: 23,
    marks: MINUTE_MARKS,
    style: "colloquial",
  },
  { id: "time:exact-minutes", kind: "time", label: "To the minute", from: 0, to: 23, style: "exact" },
  {
    id: "time:periods",
    kind: "time",
    label: "Which part of the day",
    from: 0,
    to: 23,
    marks: [0, 15, 30, 45],
    style: "colloquial",
    period: true,
  },
];

/**
 * A time, said the way this dialect says it.
 *
 * The whole of it: the shared clock, handed this language's numbers. The
 * dialect's habits are in the system a teacher wrote — which expression
 * goes on which mark, whether it counts from this hour or the next, and
 * what each part of the day is called.
 */
export const renderArTime = (
  h: number,
  m: number,
  time: TimeSystem,
  numbers: NumberSystem | null,
  ctx: TimeCtx,
): TimeRendering => renderClock(h, m, time, numbers, ctx, { render: renderAr });

export const arTimeComposer: TimeComposer = {
  id: "ar-PS",
  version: AR_TIME_COMPOSER_VERSION,
  requiredSlots: () => AR_TIME_SLOTS,
  ranges: () => AR_TIME_RANGES,
  renderTime: renderArTime,
};
