/*
 * Which ranges can be asked, and what to ask in one.
 *
 * A range is a skill rather than a stretch of the number line: *numbers up
 * to nine*, *telling the hour* — and a stretch of numbers counts things
 * too, see `countingOf`. It is scheduled like a
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
  FormKey,
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
import { NUMBER_CEILING, countingOf } from "./types.ts";
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
   * Counting is probed by shape as well as by spread.
   *
   * What varies when a noun is counted is not how big the number is but
   * which shape it puts the phrase in — one, two, the three-to-ten run,
   * the teens, and everything above twenty. A spread across the range
   * would land on four of those and miss the fifth, and the fifth is
   * where the gap would be. The spread is kept beside them because a
   * counting question asks from the whole of its stretch, and a number
   * before a noun can reach for a face of a word the bare number never
   * does — the feminine seven inside forty-seven, in Hebrew.
   */
  if (range.counted) {
    const shapes = [1, 2, 3, 4, 9, 10, 11, 12, 19, 20, 21, 100, 1000];
    const spread = probeOf({ ...range, counted: false });
    return [...new Set(shapes.filter((v) => v >= from && v <= to).concat(spread))].sort((a, b) => a - b);
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
  /* Every round hundred and every round thousand up to ten of them. A
     spread lands on 369 and 459 and never on 300 or 400, and those are
     the numbers a language most often says as one word of its own:
     Palestinian 300 to 900 and 3,000 to 10,000 are. The thousands have
     no box, so a teacher writes each out from this list. Leaving them out
     hid them from the teacher and from the check that a part is ready. */
  for (const unit of [100, 1000]) {
    for (let k = 1; k <= 10; k += 1) out.push(k * unit);
  }
  const seen = new Set<number>();
  return out
    .filter((v) => {
      if (v < from || v > to || seen.has(v)) return false;
      seen.add(v);
      return true;
    })
    .sort((a, b) => a - b);
}

/** The times a clock range is tested with: every hour, every mark it
    draws from, and the two minutes either side of an hour. */
export function timeProbeOf(range: Range): { h: number; m: number }[] {
  const out: { h: number; m: number }[] = [];
  const marks = range.marks || [0, 1, 7, 15, 29, 30, 31, 45, 58, 59];
  for (let h = 0; h <= 23; h += 1) for (const m of marks) out.push({ h, m });
  return out;
}

/* ---- what can be counted ---- */

/*
 * Remembered per system, because a system is the same object for as long
 * as nothing in it changes and the answer is asked on every draw: every
 * noun rendered at every shape of every counting part.
 */
const COUNTABLE: WeakMap<NumberSystem, Map<string, CountedNoun[]>> = new WeakMap();

/**
 * The nouns a stretch can be counted with: the ones it can say at every
 * number it probes — handed the stretch's counting view, see countingOf.
 *
 * A noun card without a dual is a noun the language's *two* cannot count,
 * and one without a plural is no use from three to ten — but either is a
 * perfectly good noun for the other stretches. So a noun is judged per
 * stretch, by rendering it, and the counting question opens on any noun
 * the stretch can say whole. Before
 * the nouns came off the cards, one noun short of a face held the whole
 * part back; with every noun in the collection in play, that would have
 * held back every part for good.
 */
export function countable(range: Range, composer: Composer | null, sys: NumberSystem): CountedNoun[] {
  if (!range.counted || !composer) return sys.nouns || [];
  let held = COUNTABLE.get(sys);
  if (!held) {
    held = new Map();
    COUNTABLE.set(sys, held);
  }
  const key = `${range.id}|${range.from}`;
  const had = held.get(key);
  if (had) return had;
  const out = (sys.nouns || []).filter((noun) => !blocking(countingWarnings(range, composer, sys, noun)).length);
  held.set(key, out);
  return out;
}

/*
 * What can stop a noun being counted is which of its faces are written
 * and which gender it is — the gender picks the numeral's face, and a
 * missing face is a missing word. Never the words themselves. So nouns
 * alike in those are alike in what they can be counted with, and are
 * rendered once between them: a teacher with two hundred noun cards has
 * a handful of kinds of noun, and a stretch's probe is forty numbers.
 */
const kindOf = (noun: CountedNoun): string =>
  [noun.gender, ...(["sg", "dual", "pl", "plCounted"] as const).map((k) => (String(noun[k] || "").trim() ? 1 : 0))].join("");

const KINDS: WeakMap<NumberSystem, Map<string, Warning[]>> = new WeakMap();

/**
 * Everything counting this noun across a stretch's probe warns about —
 * worked out once per kind of noun, see kindOf, and remembered per system.
 * A warning that names a noun names the first of its kind, which is the
 * one rendered.
 */
export function countingWarnings(range: Range, composer: Composer, sys: NumberSystem, noun: CountedNoun): Warning[] {
  let held = KINDS.get(sys);
  if (!held) {
    held = new Map();
    KINDS.set(sys, held);
  }
  const key = `${range.id}|${range.from}|${kindOf(noun)}`;
  const had = held.get(key);
  if (had) return had;
  const out = merged(probeOf(range).map((n) => composer.render(n, sys, { noun }).warnings));
  held.set(key, out);
  return out;
}

/* ---- can it be asked ---- */

export interface RangeCheck {
  range: Range;
  open: boolean;
  /** What is in the way, where anything is. */
  warnings: Warning[];
  /**
   * Whether the stretch can be counted with as well, and what is in the
   * way of that — on a stretch that counts, and nowhere else. Apart from
   * `open` on purpose: a stretch is asked on its numbers alone, and the
   * counting question joins it once a noun card can be counted across
   * all of it. Never open on a stretch that is not.
   */
  counting?: { open: boolean; warnings: Warning[] };
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
 * Whether a stretch can be counted with: some noun it can say whole at
 * every number it probes. Where there is none, every noun's gaps are
 * reported, which is what tells the teacher which card to finish; and
 * where there are no nouns at all, that is said in its own terms — it is
 * a teacher who has not written a noun card yet, not a gap in the words.
 */
export function countingCheck(
  range: Range,
  composer: Composer,
  sys: NumberSystem,
): { open: boolean; warnings: Warning[] } {
  if (!sys.nouns || !sys.nouns.length) {
    return { open: false, warnings: [{ code: "missing-noun-form", detail: "no nouns to count" }] };
  }
  const view = countingOf(range);
  const able = countable(view, composer, sys);
  const warnings = merged((able.length ? able : sys.nouns).map((noun) => countingWarnings(view, composer, sys, noun)));
  return { open: able.length > 0 && !blocking(warnings).length, warnings };
}

/**
 * Every range this language has, with whether it can be asked and what is
 * in the way of the ones that cannot.
 *
 * The stretches of the number line are a **prefix**, as the bands they
 * replace were: a system that can build a thousand but not a hundred has
 * a hole in it rather than a learner ready for thousands, and stopping at
 * the first gap is what makes the reach a teacher is shown honest. The
 * clock ranges are a prefix among themselves for the same reason —
 * nobody wants the exact minute before the hour. Counting is neither: it
 * is a question a stretch asks once the stretch is open and a noun can be
 * counted across it, and it never holds the stretch back.
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
    for (const n of probeOf(range)) lists.push(composer.render(n, sys).warnings);
    const warnings = merged(lists);
    const open = !blocking(warnings).length && !broken;
    if (blocking(warnings).length) broken = true;
    if (!range.counts) {
      out.push({ range, open, warnings });
      continue;
    }
    const counting = countingCheck(range, composer, sys);
    out.push({ range, open, warnings, counting: { ...counting, open: open && counting.open } });
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
export function askFor(range: Range, seed: string, sys: NumberSystem, composer?: Composer | null): Ask {
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
  /* One draw is 32 bits, which the billions outrun: on its own it would
     land every twenty-third number or so, and never on the rest. A second
     draw fills in below it there — and only there, so every range that
     fits in one draw asks exactly what it always asked. */
  const fine = span + 1 > 4294967296 ? rnd() + rnd() / 4294967296 : rnd();
  const value = range.from + Math.floor(fine * (span + 1));
  if (!range.counted) return { rangeId: range.id, kind: "numbers", value };
  /* Only the nouns this part can say whole, where the composer is to hand
     to say which — see countable. */
  const nouns = composer ? countable(range, composer, sys) : sys.nouns || [];
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
  /** How it sounds, put together from what the teacher wrote beside each
      word — empty unless every word in it has one. See `sayAlong`. */
  lat?: string;
  /** A recording of the whole number, where one exists. See `heardWhole`. */
  recs?: string[];
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
      lat: sayAlong(got.text, got.tokens, [timeSys, sys]),
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
    lat: sayAlong(got.text, got.tokens, [sys]),
    recs: noun ? [] : heardWhole(ask.value, got.tokens, sys),
  };
}

/* ---- what else a learner is shown about it ---- */

const trimmed = (s: unknown) => String(s == null ? "" : s).trim();

/**
 * The faces of one slot that are written the way this token was.
 *
 * A token names the face it was looked up under, but what the teacher
 * recorded or transliterated may sit under another face with the same
 * word in it — *one* asked for with a masculine word is the counting
 * *one*, and the recording was made once, in the first box.
 */
function facesLike(sys: NumberSystem | TimeSystem, t: Token): FormKey[] {
  const lex = t.slot ? (sys.lexemes || {})[t.slot] : undefined;
  if (!lex) return [];
  const keys = Object.keys(lex.forms || {}) as FormKey[];
  const same = keys.filter((k) => trimmed(lex.forms[k]) === t.text);
  return t.formKey && same.includes(t.formKey) ? [t.formKey, ...same.filter((k) => k !== t.formKey)] : same;
}

/** How one token is said, where the teacher wrote it — or nothing. */
function latOfToken(t: Token, systems: (NumberSystem | TimeSystem | null | undefined)[]): string {
  for (const sys of systems) {
    if (!sys) continue;
    if (t.override) {
      const over = (sys.overrides || {})[t.override];
      if (over && trimmed(over.text) === t.text) return trimmed(over.lat);
      continue;
    }
    if (!t.slot) continue;
    for (const k of facesLike(sys, t)) {
      const lat = trimmed(((sys.lexemes[t.slot] || {}).lat || {})[k]);
      if (lat) return lat;
    }
    const time = sys as TimeSystem;
    if (t.slot.startsWith("minute.") && time.minuteExprs) {
      const expr = time.minuteExprs[t.slot.slice("minute.".length)];
      if (expr && trimmed(expr.text) === t.text && trimmed(expr.lat)) return trimmed(expr.lat);
    }
    if (t.slot.startsWith("period.") && time.periods) {
      const period = time.periods.find((p) => `period.${p.slot}` === t.slot && trimmed(p.text) === t.text);
      if (period && trimmed(period.lat)) return trimmed(period.lat);
    }
  }
  return "";
}

/**
 * How a whole number sounds, out of how each of its words does.
 *
 * The words come from the rendering itself, read left to right against
 * the pieces it was made of: the composer knows the order and the join,
 * and the text it hands back already carries both, so nothing about any
 * language is decided here. A piece that runs straight into the next one
 * with no space — a connector attached to the word after it — is joined
 * to it with a hyphen, which is how a transliteration usually writes a
 * prefix and the one way of writing it that cannot be mistaken for two
 * words.
 *
 * All or nothing: a number with one word nobody transliterated has no
 * transliteration, rather than one with a hole in it a learner would read
 * as the whole.
 */
export function sayAlong(
  text: string,
  tokens: Token[],
  systems: (NumberSystem | TimeSystem | null | undefined)[],
): string {
  const said = trimmed(text);
  if (!said) return "";
  const pieces = new Map<string, string>();
  for (const t of tokens) {
    const word = trimmed(t.text);
    if (!word || pieces.has(word)) continue;
    const lat = latOfToken({ ...t, text: word }, systems);
    if (!lat) return "";
    pieces.set(word, lat);
  }
  /* Longest first, so a word is never read as a shorter word that
     happens to start it. Backtracks where that guess was wrong. */
  const words = [...pieces.keys()].sort((a, b) => b.length - a.length);
  const walk = (at: number): string | null => {
    if (at >= said.length) return "";
    for (const w of words) {
      if (!said.startsWith(w, at)) continue;
      let next = at + w.length;
      const lat = pieces.get(w) || "";
      if (next >= said.length) return lat;
      let spaced = false;
      while (next < said.length && /\s/.test(said[next])) {
        next += 1;
        spaced = true;
      }
      const rest = walk(next);
      if (rest === null) continue;
      if (spaced) return `${lat} ${rest}`;
      return /-$/.test(lat) ? `${lat}${rest}` : `${lat}-${rest}`;
    }
    return null;
  };
  return walk(0) || "";
}

/**
 * A recording of the whole number, where there is one.
 *
 * Nothing inside a number is ever stitched, so this is a number the
 * teacher recorded whole — written out by hand, or one word in a box —
 * and nothing else. Forty-seven built out of *seven* and *forty* has no
 * recording, and is not given two.
 */
export function heardWhole(value: number, tokens: Token[], sys: NumberSystem): string[] {
  const curated = (sys.curatedAudio || {})[String(value)];
  if (curated && curated.length) return curated;
  if (tokens.length !== 1) return [];
  const t = tokens[0];
  if (t.override) {
    const over = (sys.overrides || {})[t.override];
    return (over && over.audio && over.audio.length ? over.audio : (sys.curatedAudio || {})[t.override]) || [];
  }
  const audio = ((t.slot && sys.lexemes[t.slot]) || { audio: {} }).audio || {};
  for (const k of facesLike(sys, t)) {
    const clips = audio[k];
    if (clips && clips.length) return clips;
  }
  return [];
}

/**
 * Whether an asking has a recording to play — which a listening question
 * needs to be a question at all. A counted phrase never has: its noun is
 * said with the number and nobody recorded the two together.
 */
export function recordedWhole(ask: Ask, composer: Composer | null, sys: NumberSystem): boolean {
  if (ask.kind !== "numbers" || ask.nounId || !composer) return false;
  const got = composer.render(ask.value, sys, {});
  return !!got.text && heardWhole(ask.value, got.tokens, sys).length > 0;
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
  /* The card's own plural, where it says one — *children*, *mice*. */
  if (noun.enPl) return noun.enPl;
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
