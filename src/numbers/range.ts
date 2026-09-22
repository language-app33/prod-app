/*
 * Which ranges can be asked, and what to ask in one.
 *
 * A range is a skill rather than a stretch of the number line: *numbers up
 * to ten*, *counting things*, *telling the hour*. It is scheduled like a
 * card and it holds a schedule like a card — and what it does *not* hold
 * is any of the numbers it is about. They are made up when the queue is
 * built and thrown away with the sitting, which has been the rule since
 * numbers were first built rather than memorised.
 *
 * Two questions live here, and they are different:
 *
 *   * **Can this range be asked at all?** Answered by rendering a fixed
 *     probe of it and looking for anything blocking. Deterministic, so
 *     the reach a teacher is shown and the range a learner is asked from
 *     can never disagree — the same reason the old probe was.
 *   * **What does it ask this time?** Answered from a seed made of the
 *     skill, the exercise and the number of right answers so far. Which
 *     means a missed question comes back as *the same number* and a right
 *     one moves on: the rule every other thing that varies between
 *     askings already follows.
 *
 * Pure, and no clock: the seed is handed in.
 */
import type {
  Ask,
  Composer,
  CountedNoun,
  NounForm,
  NumberSystem,
  Range,
  Rendering,
  TimeComposer,
  TimeSystem,
  Token,
  Warning,
  WarningCode,
} from "./types.ts";
import { NUMBER_CEILING } from "./types.ts";
import { hash } from "../chance.ts";

/* ---- what stops a range ---- */

/**
 * The warnings that mean a question cannot honestly be asked.
 *
 * A missing *word* is one of these; a missing *face* of a word is not.
 * Falling back from the form before a feminine noun to the form before a
 * masculine one usually produces the right string and always produces a
 * string, so it is a gap a teacher should see in the editor and not a
 * reason to withhold a whole skill from a learner. Rounding is never
 * blocking: it is what the colloquial style is for.
 */
const BLOCKING = new Set<WarningCode>([
  "missing-slot",
  "missing-noun-form",
  "no-minute-expression",
  "no-number-system",
  "out-of-range",
]);

export const blocking = (warnings: Warning[]): Warning[] =>
  (warnings || []).filter((w) => BLOCKING.has(w.code));

/* ---- a deterministic probe ---- */

/**
 * The numbers a range is tested with.
 *
 * A range is only worth offering if the whole of it can be built, so the
 * probe has to find the awkward cases rather than a comfortable spread:
 * the ends, a scatter across the middle, every round number, and every
 * shape with a nothing inside it, which is where a language's joining
 * rules live. Carried over from the band probe it replaces, which found
 * these cases for three languages.
 */
export function probeOf(range: Range): number[] {
  const { from, to } = range;
  /*
   * Counting is probed by shape rather than by spread.
   *
   * What varies when a noun is counted is not how big the number is but
   * which shape it puts the phrase in — one, two, the three-to-ten run,
   * the teens, and everything above twenty. A spread across the range
   * would land on four of those and miss the fifth, and the fifth is
   * where the gap would be.
   */
  if (range.counted) {
    const shapes = [1, 2, 3, 4, 9, 10, 11, 12, 19, 20, 21, 100];
    return shapes.filter((v) => v >= from && v <= to);
  }
  const out: number[] = [from, to];
  const span = to - from;
  for (let k = 1; k <= 9; k += 1) out.push(from + Math.floor((span * k) / 10));
  for (let unit = 10; unit <= to; unit *= 10) {
    const first = Math.ceil(from / unit) * unit;
    if (first <= to) out.push(first);
    const last = Math.floor(to / unit) * unit;
    if (last >= from) out.push(last);
    /* One past a round number: 1,001 and 1,010 are where a language
       either has a filler word or does not. */
    if (first + 1 <= to) out.push(first + 1);
    if (unit >= 100 && first + unit / 10 <= to) out.push(first + unit / 10);
  }
  const seen = new Set<number>();
  return out.filter((v) => {
    if (v < from || v > to || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

/** The times a clock range is tested with: every hour, every mark it
    draws from, and the two minutes either side of an hour. */
export function timeProbeOf(range: Range): { h: number; m: number }[] {
  const out: { h: number; m: number }[] = [];
  const marks = range.marks || [0, 1, 7, 15, 29, 30, 31, 45, 58, 59];
  for (let h = 0; h <= 23; h += 1) for (const m of marks) out.push({ h, m });
  return out;
}

/* ---- can it be asked ---- */

export interface RangeCheck {
  range: Range;
  open: boolean;
  /** What is in the way, where anything is. */
  warnings: Warning[];
}

const warnKey = (w: Warning) => `${w.code}:${w.slot || ""}:${w.formKey || ""}:${w.detail || ""}`;

const merged = (lists: Warning[][]): Warning[] => {
  const seen = new Set<string>();
  const out: Warning[] = [];
  for (const list of lists) {
    for (const w of list) {
      if (seen.has(warnKey(w))) continue;
      seen.add(warnKey(w));
      out.push(w);
    }
  }
  return out;
};

/**
 * Every range this language has, with whether it can be asked and what is
 * in the way of the ones that cannot.
 *
 * The stretches of the number line are a **prefix**, as the bands they
 * replace were: a system that can build a thousand but not a hundred has
 * a hole in it rather than a learner ready for thousands, and stopping at
 * the first gap is what makes the reach a teacher is shown honest. The
 * clock ranges are a prefix among themselves for the same reason —
 * nobody wants the exact minute before the hour. Counting things is
 * neither, because it is not harder than any of them; it is a different
 * thing to know, and it opens on its own merits.
 */
export function rangeChecks(
  composer: Composer | null,
  sys: NumberSystem | null,
  timeComposer?: TimeComposer | null,
  timeSys?: TimeSystem | null,
): RangeCheck[] {
  if (!composer || !sys) return [];
  const out: RangeCheck[] = [];

  let broken = false;
  for (const range of composer.ranges()) {
    const lists: Warning[][] = [];
    if (range.counted) {
      /* Nothing to count is not a gap in the lexicon; it is a teacher who
         has not said what to count yet, and it is said in its own terms. */
      if (!sys.nouns.length) {
        out.push({
          range,
          open: false,
          warnings: [{ code: "missing-noun-form", detail: "no nouns to count" }],
        });
        continue;
      }
      for (const noun of sys.nouns) {
        for (const n of probeOf(range)) lists.push(composer.render(n, sys, { noun }).warnings);
      }
    } else {
      for (const n of probeOf(range)) lists.push(composer.render(n, sys).warnings);
    }
    const warnings = merged(lists);
    const open = !blocking(warnings).length && !(broken && !range.counted);
    if (!range.counted && blocking(warnings).length) broken = true;
    out.push({ range, open, warnings });
  }

  if (timeComposer && timeSys) {
    let timeBroken = false;
    for (const range of timeComposer.ranges()) {
      const lists: Warning[][] = [];
      for (const { h, m } of timeProbeOf(range)) {
        lists.push(
          timeComposer.renderTime(h, m, timeSys, sys, {
            style: range.style || "colloquial",
            period: !!range.period,
          }).warnings,
        );
      }
      const warnings = merged(lists);
      const open = !blocking(warnings).length && !timeBroken;
      if (blocking(warnings).length) timeBroken = true;
      out.push({ range, open, warnings });
    }
  }

  return out;
}

export const openRanges = (
  composer: Composer | null,
  sys: NumberSystem | null,
  timeComposer?: TimeComposer | null,
  timeSys?: TimeSystem | null,
): Range[] =>
  rangeChecks(composer, sys, timeComposer, timeSys)
    .filter((c) => c.open)
    .map((c) => c.range);

/* ---- what to ask ---- */

/**
 * A little generator from a string seed.
 *
 * `hash` is the app's own FNV-1a, already used wherever a draw has to be
 * the same on a re-render; this turns it into a stream so a question can
 * draw more than one thing from one seed. Not the scheduler's shuffling,
 * which is real chance thrown once — a question that changed under a
 * learner between the asking and the marking would be a different bug
 * every time.
 */
export type { Ask };

export function seeded(seed: string): () => number {
  let state = (hash(seed) || 1) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Draw one asking of a range.
 *
 * The draw is the seed's, so the same seed is the same question. What the
 * caller varies is the count of right answers, which is what makes a
 * missed question come back unchanged and a right one move on.
 */
export function askFor(range: Range, seed: string, sys: NumberSystem): Ask {
  const rnd = seeded(`${range.id} ${seed}`);
  if (range.kind === "time") {
    const h = Math.floor(rnd() * 24);
    const marks = range.marks;
    const minute = marks && marks.length ? marks[Math.floor(rnd() * marks.length)] : Math.floor(rnd() * 60);
    return {
      rangeId: range.id,
      kind: "time",
      value: h,
      minute,
      style: range.style || "colloquial",
      period: !!range.period,
    };
  }
  const span = Math.max(0, Math.min(range.to, NUMBER_CEILING) - range.from);
  const value = range.from + Math.floor(rnd() * (span + 1));
  if (!range.counted) return { rangeId: range.id, kind: "numbers", value };
  const nouns = sys.nouns || [];
  const noun = nouns.length ? nouns[Math.floor(rnd() * nouns.length)] : null;
  return { rangeId: range.id, kind: "numbers", value, nounId: noun ? noun.id : undefined };
}

/** What a question shows, and what answers it. */
export interface Asked {
  ask: Ask;
  /** The words. */
  text: string;
  /** The figures, which are what a digits answer is marked against. */
  digits: string;
  /** What it means in English, where there is anything to say. */
  en: string;
  tokens: Token[];
  warnings: Warning[];
  nounForm?: NounForm;
  hour?: number;
  minute?: number;
  clips?: string[][];
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Render one asking.
 *
 * Total, like everything else here: an asking that cannot be rendered
 * comes back with warnings on it and is simply not dealt.
 */
export function renderAsk(
  ask: Ask,
  composer: Composer | null,
  sys: NumberSystem | null,
  timeComposer?: TimeComposer | null,
  timeSys?: TimeSystem | null,
): Asked {
  const empty: Asked = { ask, text: "", digits: "", en: "", tokens: [], warnings: [{ code: "no-number-system" }] };
  if (!composer || !sys) return empty;

  if (ask.kind === "time") {
    if (!timeComposer || !timeSys) return empty;
    const m = typeof ask.minute === "number" ? ask.minute : 0;
    const got = timeComposer.renderTime(ask.value, m, timeSys, sys, {
      style: ask.style || "colloquial",
      period: !!ask.period,
    });
    /* The figures are the time as a clock shows it — and on a rounded
       colloquial asking, the time actually *said*, not the one drawn.
       Marking the learner against a minute the words never mentioned
       would be marking them on the rounding. */
    const shownMinute = typeof got.minuteMark === "number" ? got.minuteMark : m;
    const shownHour = carriedHour(ask.value, m, got.minuteMark);
    return {
      ask,
      text: got.text,
      digits: `${pad(shownHour)}:${pad(shownMinute)}`,
      en: got.period ? `${got.hour12}:${pad(shownMinute)}` : "",
      tokens: got.tokens,
      warnings: got.warnings,
      hour: shownHour,
      minute: shownMinute,
      clips: got.clips,
    };
  }

  const noun = ask.nounId ? (sys.nouns || []).find((n) => n.id === ask.nounId) : undefined;
  const got: Rendering = composer.render(ask.value, sys, noun ? { noun } : {});
  return {
    ask,
    text: got.text,
    digits: String(ask.value),
    en: noun ? `${ask.value} ${englishFor(noun, got.nounForm)}` : String(ask.value),
    tokens: got.tokens,
    warnings: got.warnings,
    nounForm: got.nounForm,
  };
}

/** Which hour the clock shows once a colloquial rounding has carried. */
function carriedHour(h: number, m: number, mark: number | undefined): number {
  if (typeof mark !== "number") return h;
  return m >= 58 && mark === 0 ? (h + 1) % 24 : h;
}

/** "3 books", "1 book" — the English a counted phrase is asked in. */
function englishFor(noun: CountedNoun, form: NounForm | undefined): string {
  const word = String(noun.en || noun.id || "").trim();
  if (!word) return "";
  if (form === "sg") return word;
  /* English has one plural and no dual, so the two that are not singular
     are both said the same way. An irregular plural is the teacher's to
     write; this is a cue, not a lesson in English. */
  return /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

/* ---- wrong answers worth offering ---- */

/**
 * The numbers worth offering beside this one.
 *
 * Confusion is the point: 74 for 47, 470 for 47, 57 for 47. A wrong
 * answer nobody could believe is not a wrong answer, and four random
 * numbers would make the question a reading test rather than a listening
 * one. Language-agnostic: what these look like written down is the
 * composer's business, and only the ones it can say survive.
 */
export function confusablesOf(value: number): number[] {
  const out: number[] = [];
  const digits = String(value);
  const flipped = Number([...digits].reverse().join(""));
  if (flipped !== value) out.push(flipped);
  out.push(value * 10, Math.floor(value / 10));
  out.push(value + 10, value - 10, value + 1, value - 1);
  if (digits.length >= 3) {
    for (let i = 0; i + 1 < digits.length; i += 1) {
      const d = [...digits];
      [d[i], d[i + 1]] = [d[i + 1], d[i]];
      out.push(Number(d.join("")));
    }
  }
  const seen = new Set<number>([value]);
  return out.filter((v) => {
    if (!Number.isInteger(v) || v < 0 || v > NUMBER_CEILING || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

/** The times worth offering beside this one: an hour out, a mark out, and
    the two the hour hand is easily read as. */
export function confusableTimes(h: number, m: number, marks: number[]): { h: number; m: number }[] {
  const out: { h: number; m: number }[] = [];
  const near = marks.length ? marks : [0, 15, 30, 45];
  const at = near.indexOf(m);
  if (at >= 0) {
    out.push({ h, m: near[(at + 1) % near.length] });
    out.push({ h, m: near[(at - 1 + near.length) % near.length] });
  }
  out.push({ h: (h + 1) % 24, m });
  out.push({ h: (h + 23) % 24, m });
  /* The commonest misreading of a dial: the hour and minute hands the
     other way round. */
  const swapped = Math.round(m / 5) % 12;
  if (swapped !== h % 12) out.push({ h: swapped === 0 ? 12 : swapped, m: (h % 12) * 5 });
  const seen = new Set<string>([`${h}:${m}`]);
  return out.filter((t) => {
    const key = `${t.h}:${t.m}`;
    if (seen.has(key) || t.h < 0 || t.h > 23 || t.m < 0 || t.m > 59) return false;
    seen.add(key);
    return true;
  });
}
