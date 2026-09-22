/*
 * Modern Hebrew times.
 *
 * The same shape as the dialect next door and the same renderer — the
 * shared clock in compose.ts — because a clock is almost entirely not a
 * language: the hour is the number composer asked for a feminine referent,
 * the exact minutes are the number composer counting the word for
 * *minute*, and the rest is arithmetic. **There is no agreement in this
 * file**, and there is not a word of Hebrew in it either.
 *
 * Two things this language answers differently, and both are answered in
 * the system a teacher writes rather than here:
 *
 *   * **The word that opens a time is optional in speech.** A box left
 *     empty is a clock that says the numeral alone, which is what people
 *     do; a teacher who wants it said writes it, and then it is said every
 *     time. So its absence is not a gap here, where next door it is — the
 *     one thing the shared clock has to be told, and told by the pack.
 *   * **Counting back may put the minutes first.** *A quarter to three*
 *     says the quarter before the hour, where the dialect next door says
 *     the hour and then takes a quarter off it. That is a fact about the
 *     expression and is written beside it — `lead` on a minute
 *     expression — so nothing in code decides it and a teacher can
 *     correct it.
 *
 * Which means everything below is this language's answers to *what is
 * asked for* and *what a learner is scheduled on*, and nothing else.
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
import { renderHe } from "./he-IL.ts";

export const HE_TIME_COMPOSER_VERSION = 1;

/** The words a clock needs that a number has not already got. */
export const HE_TIME_SLOTS: SlotSpec[] = [
  {
    slot: "hour.word",
    formKeys: ["standalone"],
    label: "hour",
    group: "clock words",
    optional: true,
    hint: "The word that opens a time, where your speakers say one. Leave it empty and a time is the numeral alone.",
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
    hint: "What stands between the minutes and the hour they are counted back from.",
  },
];

/**
 * What a learner is scheduled on.
 *
 * The same ladder the other clock uses, and for the same reason: whole
 * hours are one thing to know, the three expressions anybody uses all day
 * are the next, the rest of the five-minute marks the next, and the exact
 * minute is a different skill again because it is the only one that counts
 * a noun. The part of the day is last and is its own range because it is
 * the one thing about a time that a clock face cannot show.
 */
export const HE_TIME_RANGES: Range[] = [
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

/** A time, out of the shared clock and this language's numbers. */
export const renderHeTime = (
  h: number,
  m: number,
  time: TimeSystem,
  numbers: NumberSystem | null,
  ctx: TimeCtx,
): TimeRendering => renderClock(h, m, time, numbers, ctx, { render: renderHe, hourWord: "optional" });

export const heTimeComposer: TimeComposer = {
  id: "he-IL",
  version: HE_TIME_COMPOSER_VERSION,
  requiredSlots: () => HE_TIME_SLOTS,
  ranges: () => HE_TIME_RANGES,
  renderTime: renderHeTime,
};
