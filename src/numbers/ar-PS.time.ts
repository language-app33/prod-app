/*
 * Palestinian Arabic times.
 *
 * A time is a number with a feminine noun in front of it. That is not a
 * simplification — it is the design: the hour is the number composer
 * asked for a feminine referent, because the word for *hour* is feminine,
 * and the minutes in the exact style are the number composer asked to
 * count the word for *minute*. **There is no agreement in this file**, so
 * a fault in "two minutes" is a fault in the number composer and is fixed
 * once, for books and minutes together.
 *
 * What is here instead is what a clock has that a number does not:
 *
 *   * **The minute expressions**, which are the teacher's and not built:
 *     *a quarter*, *a third*, *half*, *half and five*. Twelve marks, five
 *     minutes apart, each with the connector its shape calls for.
 *   * **The hour that is said is not always the hour it is.** A quarter
 *     to eight happens at seven, so the expression says which hour it
 *     counts from and the numeral follows it.
 *   * **And the part of the day is read off the hour the clock actually
 *     shows**, never off the shifted one. A quarter to one in the
 *     afternoon is in the afternoon; picking the period after the shift
 *     would have filed it under the morning, which is the kind of fault
 *     that is right eleven times out of twelve and then embarrasses
 *     somebody.
 */
import type {
  CountedNoun,
  MinuteExpr,
  NumberSystem,
  Range,
  Rendering,
  SlotSpec,
  TimeComposer,
  TimeCtx,
  TimeRendering,
  TimeSystem,
  Token,
  Warning,
} from "./types.ts";
import { MINUTE_MARKS } from "./types.ts";
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

/* ---- reading the system ---- */

const wordOf = (time: TimeSystem, slot: string): string =>
  String(((time.lexemes || {})[slot] || { forms: {} }).forms.standalone || "").trim();

const clipsOf = (time: TimeSystem, slot: string): string[] =>
  (((time.lexemes || {})[slot] || { forms: {} }).audio || {}).standalone || [];

/** The hour as a clock with twelve numbers on it says it. */
export const hour12Of = (h: number): number => ((h + 11) % 12) + 1;

/**
 * The nearest five-minute mark, and the hour it carries into.
 *
 * Two to midnight is not five to midnight rounded down to nothing: it is
 * midnight. So the rounding may carry, and the carry has to happen before
 * anything else reads the hour — the part of the day included, since a
 * minute before one in the afternoon is in the afternoon and a minute
 * before one in the morning is not.
 */
export function roundToMark(h: number, m: number): { hour: number; mark: number } {
  const raw = Math.round(m / 5) * 5;
  return raw >= 60 ? { hour: (h + 1) % 24, mark: 0 } : { hour: h, mark: raw };
}

/**
 * Which part of the day an hour falls in.
 *
 * Ranges may wrap midnight, because one of them always does: the night
 * is the hours after ten and the hours before five, which is two stretches
 * of the clock and one part of the day.
 */
export function periodFor(time: TimeSystem, h: number) {
  for (const p of time.periods || []) {
    const from = Number(p.fromHour);
    const to = Number(p.toHour);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (from <= to ? h >= from && h <= to : h >= from || h <= to) return p;
  }
  return null;
}

const overrideOf = (time: TimeSystem, h: number, m: number, style: string) => {
  const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const table = time.overrides || {};
  for (const k of [`${key}|${style}`, key]) {
    const text = String((table[k] && table[k].text) || "").trim();
    if (text) return { text, key: k, audio: (table[k] && table[k].audio) || (time.curatedAudio || {})[k] };
  }
  return null;
};

/* ---- composing ---- */

/**
 * A time, said the way this dialect says it.
 *
 * Total, like the number composer: a system with nothing in it comes back
 * as a rendering with warnings, never as an exception.
 */
export function renderArTime(
  h: number,
  m: number,
  time: TimeSystem,
  numbers: NumberSystem | null,
  ctx: TimeCtx,
): TimeRendering {
  const warnings: Warning[] = [];
  const tokens: Token[] = [];
  const style = ctx.style === "exact" ? "exact" : "colloquial";
  const blank = (text: string): TimeRendering => ({
    text,
    tokens,
    warnings,
    hour12: hour12Of(Number(h) || 0),
  });

  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    warnings.push({ code: "out-of-range", detail: `${h}:${m}` });
    return blank("");
  }
  if (!numbers) {
    warnings.push({ code: "no-number-system" });
    return blank("");
  }

  const shown = overrideOf(time, h, m, style);

  /* Which minute mark is said, and which hour it counts from. The
     colloquial style rounds — and says so, so a teacher's preview and a
     learner's clock face never disagree about what was asked. */
  let mark: number | undefined;
  let expr: MinuteExpr | undefined;
  /* The hour the clock shows, after any carry the rounding made. Every
     reading of the hour below is of this one, except the numeral's. */
  let onClock = h;
  let said = h;
  if (style === "colloquial") {
    const rounded = roundToMark(h, m);
    onClock = rounded.hour;
    mark = rounded.mark;
    said = onClock;
    if (mark !== m) warnings.push({ code: "rounded", detail: `${m} to ${mark}` });
    expr = (time.minuteExprs || {})[String(mark)];
    if (!expr && mark !== 0) warnings.push({ code: "no-minute-expression", detail: String(mark) });
    if (expr && expr.refHour === "next") said = (onClock + 1) % 24;
  }

  const hour12 = hour12Of(said);
  /* The part of the day comes off the hour the clock shows, never off the
     hour that is said. See the note at the top. */
  const period = ctx.period ? periodFor(time, onClock) : null;

  if (shown) {
    tokens.push({ text: shown.text, override: shown.key });
    const withPeriod = period ? `${shown.text} ${period.text}` : shown.text;
    if (period) tokens.push({ text: period.text, slot: `period.${period.slot}` });
    return {
      text: withPeriod,
      tokens,
      warnings,
      hour12,
      minuteMark: mark,
      period: period ? period.text : undefined,
      clips: shown.audio && shown.audio.length ? [shown.audio] : undefined,
    };
  }

  const hourWord = wordOf(time, "hour.word");
  if (!hourWord) warnings.push({ code: "missing-slot", slot: "hour.word" });
  else tokens.push({ text: hourWord, slot: "hour.word", formKey: "standalone" });

  /* The hour numeral: the number composer, asked for a feminine referent,
     because the word for *hour* is feminine and the numeral agrees with
     it. Nothing about that rule lives here. */
  const hourNum: Rendering = renderAr(hour12, numbers, { gender: "f" });
  warnings.push(...hourNum.warnings);
  tokens.push(...hourNum.tokens);

  const pieces = [hourWord, hourNum.text].filter(Boolean);
  const clips: string[][] = [];
  const hourClips = clipsOf(time, "hour.word");
  if (hourClips.length) clips.push(hourClips);

  if (style === "exact") {
    if (m) {
      const past = wordOf(time, "connector.past");
      if (!past) warnings.push({ code: "missing-slot", slot: "connector.past" });
      else tokens.push({ text: past, slot: "connector.past", formKey: "standalone" });
      /* And the minutes, counted like anything else that gets counted. */
      const noun: CountedNoun = time.minuteNoun;
      const mins = renderAr(m, numbers, { noun });
      warnings.push(...mins.warnings);
      tokens.push(...mins.tokens);
      pieces.push(past ? `${past}${mins.text}` : mins.text);
    }
  } else if (mark && expr) {
    const attach = expr.refHour === "next" ? wordOf(time, "connector.to") : wordOf(time, "connector.past");
    const slot = expr.refHour === "next" ? "connector.to" : "connector.past";
    if (!attach) warnings.push({ code: "missing-slot", slot });
    else tokens.push({ text: attach, slot, formKey: "standalone" });
    tokens.push({ text: expr.text, slot: `minute.${mark}` });
    /* "And" attaches to the word after it; "to" is a word of its own. */
    pieces.push(
      expr.refHour === "next"
        ? [attach, expr.text].filter(Boolean).join(" ")
        : attach
        ? `${attach}${expr.text}`
        : expr.text,
    );
    if (expr.audio && expr.audio.length) clips.push(expr.audio);
  }

  if (period) {
    pieces.push(period.text);
    tokens.push({ text: period.text, slot: `period.${period.slot}` });
    if (period.audio && period.audio.length) clips.push(period.audio);
  }

  return {
    text: pieces.filter(Boolean).join(" "),
    tokens,
    warnings,
    hour12,
    minuteMark: mark,
    period: period ? period.text : undefined,
    /* Two recordings at most, played one after the other: the hour and
       the minutes. Nothing inside a number is ever stitched. */
    clips: clips.length ? clips : undefined,
  };
}

export const arTimeComposer: TimeComposer = {
  id: "ar-PS",
  version: AR_TIME_COMPOSER_VERSION,
  requiredSlots: () => AR_TIME_SLOTS,
  ranges: () => AR_TIME_RANGES,
  renderTime: renderArTime,
};
