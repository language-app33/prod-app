/*
 * Numbers: built rather than memorised.
 *
 * A learner who knows *forty* and *seven* knows *forty-seven*, and nobody
 * should have to be taught it as a third word. So a number card is not one
 * number: it is a **part**, and the app makes up as many numbers as it
 * likes out of the parts a teacher has written down.
 *
 * The division of labour is the whole point of this file:
 *
 *   * **The language pack knows how numbers are put together.** The order
 *     the parts go in, what joins them, which form a part takes in
 *     company — all of it is `spell` on the pack, and nothing here looks
 *     inside what it returns. Arabic puts the unit before the ten and a و
 *     before every chunk; Hebrew puts the ten before the unit and a ו
 *     before only the last; Huế says *không trăm lẻ* in the middle of a
 *     thousand and changes *năm* to *lăm* after a ten. None of that is
 *     knowledge this file has, or could be given without becoming three
 *     languages wearing one coat.
 *
 *   * **This file knows what a part's card looks like, and how far a deck
 *     reaches.** Finding the card for forty, reading the alternate form a
 *     pack asked for, testing whether a stretch of the number line can be
 *     built at all, and choosing what to ask next.
 *
 * The rule that keeps a learner honest is `spell` returning null. A pack
 * that cannot find a part gives up, and everything here treats that as
 * *out of range* rather than papering over it — which is why a deck that
 * stops at ten is never asked for a hundred, and why the reach a teacher
 * is shown is the truth rather than a hope.
 *
 * Pure: no React, no storage, no clock. Imports the language pack's
 * accessors and nothing else.
 */

import type {
  CardForm,
  Lang,
  NumberBand,
  NumberCell,
  NumberCtx,
  NumberPart,
  NumberSpec,
  Spelling,
} from "./types.ts";

/* ---- what the pack declares ---- */

/** How this language builds its numbers, or null where it does not say. */
export const numbersOf = (lang: Lang | null | undefined): NumberSpec | null =>
  (lang && lang.numbers) || null;

/** Whether numbers can be built in this language at all. */
export const teachesNumbers = (lang: Lang | null | undefined): boolean =>
  !!numbersOf(lang);

/** Every part the teacher is asked for, in the order the groups declare. */
export function partsOf(lang: Lang | null | undefined): NumberPart[] {
  const spec = numbersOf(lang);
  if (!spec) return [];
  const out: NumberPart[] = [];
  for (const g of spec.groups || []) for (const p of g.parts || []) out.push(p);
  return out;
}

/** The extra boxes a value carries — Huế's *lăm* beside its *năm*. */
export function cellsFor(lang: Lang | null | undefined, value: number): NumberCell[] {
  const spec = numbersOf(lang);
  return (spec && spec.cells && spec.cells(value)) || [];
}

/** What a part's card is glossed as. The digits, unless the pack says
    otherwise — Huế's box for 100 holds *trăm*, which means *hundred* and
    not *one hundred*. */
export const glossOf = (part: NumberPart): string =>
  part.gloss !== undefined ? part.gloss : String(part.value);

/** And what its box is called, which defaults the same way. */
export const labelOf = (part: NumberPart): string =>
  part.label !== undefined ? part.label : String(part.value);

/* ---- finding the teacher's parts ---- */

/**
 * Whether a card is a part, and which value it holds.
 *
 * `value` is written by the Numbers screen and by the card editor, and is
 * the only thing that makes a number card findable: two teachers will
 * write *forty* and *أربعين* and neither string says what it is worth.
 * A card without one is an ordinary card that happens to be about a
 * number, and is not used to build anything.
 */
export function valueOf(card: { value?: unknown } | null | undefined): number | null {
  const raw = card && (card as { value?: unknown }).value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

/**
 * The parts a collection holds, by value.
 *
 * Later cards do not displace earlier ones: where two cards claim the same
 * value the first is kept, so a duplicate written by accident cannot
 * silently change what every number in the language sounds like. The
 * teacher's Numbers screen writes one card per value and edits it in
 * place, so the second is always the accident.
 */
export function partCards<T extends { lang?: string; value?: unknown }>(
  cards: T[],
  langId?: string,
): Map<number, T> {
  const out = new Map<number, T>();
  for (const c of cards || []) {
    if (!c) continue;
    if (langId && c.lang !== langId) continue;
    const v = valueOf(c);
    if (v === null || out.has(v)) continue;
    out.set(v, c);
  }
  return out;
}

/** A card's own word — the first form, which is what every reader of a
    card treats as the word itself. */
const ownWord = (card: { forms?: CardForm[] } | null | undefined): string =>
  String(((card && card.forms && card.forms[0]) || { ar: "" }).ar || "").trim();

/**
 * A named alternate form of a card — the cell a pack asks for by column.
 *
 * Matched on the column alone, and deliberately: a pack names its own
 * cells and the app has no business knowing which table they sit in.
 * A cell with nothing typed in it reads as absent, which is what lets a
 * pack fall back to the card's own word — Huế's *ba* has no special form
 * after a ten, so *hai mươi ba* is built from the plain word.
 */
const cellWord = (
  card: { forms?: CardForm[] } | null | undefined,
  col: string,
): string => {
  for (const f of (card && card.forms) || []) {
    if (f && f.col === col) {
      const t = String(f.ar || "").trim();
      if (t) return t;
    }
  }
  return "";
};

/**
 * What a pack's `spell` is handed.
 *
 * Both lookups answer "" for something the teacher has not written, which
 * is the signal a pack tests to give up on a number it cannot build.
 */
export function ctxOf(parts: Map<number, { forms?: CardForm[] }>): NumberCtx {
  return {
    word: (value) => ownWord(parts.get(value)),
    cell: (value, id) => cellWord(parts.get(value), id),
  };
}

/* ---- spelling ---- */

/** The largest number the practice will ever reach for, whatever a pack's
    top band says. Numbers above this are not a language's problem but a
    typing one, and no exercise here is improved by eight digits. */
export const NUMBER_CEILING = 9999999;

/**
 * A number written out in this language, or null where the teacher has
 * not written the parts for it.
 *
 * The guard rails are here rather than in each pack: a value that is not a
 * whole number in range is refused before a pack ever sees it, so three
 * `spell` implementations need not each remember to check.
 */
export function spell(
  lang: Lang | null | undefined,
  parts: Map<number, { forms?: CardForm[] }>,
  value: number,
): Spelling | null {
  const spec = numbersOf(lang);
  if (!spec) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > NUMBER_CEILING) return null;
  let out: Spelling | null = null;
  try {
    out = spec.spell(value, ctxOf(parts));
  } catch {
    /* A pack that throws is a pack with a bug, and the learner should get
       a number it can build rather than a broken screen. The reach report
       shows the hole, which is where a teacher can act on it. */
    return null;
  }
  if (!out || !String(out.text || "").trim()) return null;
  return { text: String(out.text).trim(), used: (out.used || []).filter((v) => typeof v === "number") };
}

/* ---- how far a deck reaches ---- */

/** The bands a pack declares, smallest first and inside the ceiling. */
export function bandsOf(lang: Lang | null | undefined): NumberBand[] {
  const spec = numbersOf(lang);
  if (!spec) return [];
  return (spec.bands || [])
    .filter((b) => b && b.to >= b.from && b.from >= 0 && b.from <= NUMBER_CEILING)
    .map((b) => ({ ...b, to: Math.min(b.to, NUMBER_CEILING) }));
}

/**
 * The numbers a band is tested with.
 *
 * A band is only worth offering if the whole of it can be built, so the
 * probe has to find the awkward cases rather than a comfortable spread:
 * the ends, a scatter across the middle, and — the ones that actually
 * catch a missing part — every round number and every shape with a zero
 * inside it, which is where a language's joining rules live. Huế says
 * *một nghìn không trăm lẻ năm* for 1,005 and nothing else in the band
 * would have asked for it.
 *
 * Deterministic, so the reach a teacher is shown and the range a learner
 * is asked from can never disagree.
 */
export function probeOf(band: NumberBand): number[] {
  const { from, to } = band;
  const out: number[] = [from, to];
  const span = to - from;
  for (let k = 1; k <= 9; k += 1) out.push(from + Math.floor((span * k) / 10));
  /* Round numbers and interior zeros, at every scale the band spans. */
  for (let unit = 10; unit <= to; unit *= 10) {
    const first = Math.ceil(from / unit) * unit;
    if (first <= to) out.push(first);
    const last = Math.floor(to / unit) * unit;
    if (last >= from) out.push(last);
    /* One past a round number — 1,001 and 1,010 are where a language
       either has a filler word or does not. */
    if (first + 1 <= to) out.push(first + 1);
    if (first + unit / 10 <= to && unit >= 100) out.push(first + unit / 10);
  }
  const seen = new Set<number>();
  return out.filter((v) => {
    if (v < from || v > to || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

/**
 * Which bands this collection can be asked from.
 *
 * A prefix, always: the bands are a ramp, and a deck that can build a
 * thousand but not a hundred is a deck with a hole in it rather than a
 * learner ready for thousands. Stopping at the first gap is also what
 * makes the teacher's reach honest — it names the band that is missing
 * parts instead of quietly skipping it.
 */
export function openBands(
  lang: Lang | null | undefined,
  parts: Map<number, { forms?: CardForm[] }>,
): NumberBand[] {
  const out: NumberBand[] = [];
  for (const band of bandsOf(lang)) {
    const whole = probeOf(band).every((v) => !!spell(lang, parts, v));
    if (!whole) break;
    out.push(band);
  }
  return out;
}

/**
 * Which band a number falls in, or -1 where none covers it.
 *
 * What the practice remembers a learner by: the widest band they have
 * answered in. Read off the pack's own bands rather than from the size of
 * the number, so a language that laid its number line out differently
 * would be remembered by its own steps.
 */
export function bandIndexOf(lang: Lang | null | undefined, value: number): number {
  return bandsOf(lang).findIndex((b) => value >= b.from && value <= b.to);
}

/** The highest number this collection can be asked for, or -1 for none. */
export function reachOf(
  lang: Lang | null | undefined,
  parts: Map<number, { forms?: CardForm[] }>,
): number {
  const open = openBands(lang, parts);
  return open.length ? open[open.length - 1].to : -1;
}

/**
 * Which parts a band is still waiting for.
 *
 * What the teacher's screen puts under a band that will not open: the
 * values whose boxes are empty and which something in the band asked for.
 * Read off the probe rather than guessed, so it names the parts that are
 * actually in the way.
 */
export function missingFor(
  lang: Lang | null | undefined,
  parts: Map<number, { forms?: CardForm[] }>,
  band: NumberBand,
): number[] {
  const have = new Set<number>();
  for (const [v, card] of parts) if (ownWord(card)) have.add(v);
  const wanted = new Set<number>();
  for (const p of partsOf(lang)) {
    if (have.has(p.value)) continue;
    /* A part is in this band's way if it sits inside the band, or if it is
       a multiplier the band needs — a thousand is not in the band 1,000
       to 9,999 by its value alone once the band starts above it. */
    if (p.value >= band.from && p.value <= band.to) wanted.add(p.value);
    else if (p.value <= band.to) wanted.add(p.value);
  }
  return [...wanted].sort((a, b) => a - b);
}

/* ---- choosing what to ask ---- */

/**
 * The numbers worth offering as wrong answers beside this one.
 *
 * Confusion is the point: 74 for 47, 470 for 47, 57 for 47. A wrong answer
 * nobody could believe is not a wrong answer, and four random numbers
 * would make the question a reading test rather than a listening one.
 * Language-agnostic — what these look like written down is the pack's
 * business, and only the ones it can spell survive.
 */
export function confusablesOf(value: number): number[] {
  const out: number[] = [];
  const digits = String(value);
  /* The same digits the other way round — the classic. */
  const flipped = Number([...digits].reverse().join(""));
  if (flipped !== value) out.push(flipped);
  /* A place out, either way. */
  out.push(value * 10, Math.floor(value / 10));
  /* One ten and one unit away, which is where a mishearing lands. */
  out.push(value + 10, value - 10, value + 1, value - 1);
  /* Two digits swapped, for the longer ones. */
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

/**
 * How wide the practice is reaching, as a number of bands.
 *
 * The ramp, and the reason the practice does not open on a million: it
 * starts in the lowest band the deck can build and widens by one every
 * time a few answers come back right, narrowing again on a miss. So a
 * learner walks up to seven figures over a sitting or two instead of
 * being dropped into them, and a learner who is struggling is taken back
 * down without being told off.
 *
 * `RIGHT_TO_WIDEN` is three because two is a coin flip on a question with
 * four options.
 */
export const RIGHT_TO_WIDEN = 3;

export interface Ramp {
  /** How many bands are in play, at least one. */
  width: number;
  /** Right answers since the last widening or miss. */
  run: number;
}

export const freshRamp = (): Ramp => ({ width: 1, run: 0 });

/** Where the ramp stands after an answer. */
export function stepRamp(ramp: Ramp, correct: boolean, open: number): Ramp {
  const width = Math.max(1, Math.min(ramp.width, Math.max(1, open)));
  if (!correct) return { width: Math.max(1, width - 1), run: 0 };
  const run = ramp.run + 1;
  if (run < RIGHT_TO_WIDEN) return { width, run };
  return { width: Math.min(Math.max(1, open), width + 1), run: 0 };
}

/**
 * A number to ask, and what it is made of.
 *
 * Drawn from the bands in play, leaning on the widest — the band just
 * opened is the one worth practising, and a ramp that kept asking for
 * single digits would never get anywhere. `avoid` keeps a sitting from
 * repeating itself, and is given up rather than looped forever when a
 * band is small: there are eleven numbers below eleven, and a practice
 * that refused to repeat any of them would end after eleven questions.
 */
export function pickNumber(
  lang: Lang | null | undefined,
  parts: Map<number, { forms?: CardForm[] }>,
  bands: NumberBand[],
  width: number,
  rnd: () => number,
  avoid: Set<number>,
): { value: number; spelled: Spelling } | null {
  const inPlay = bands.slice(0, Math.max(1, Math.min(width, bands.length)));
  if (!inPlay.length) return null;
  /* The top band twice as often as the rest, which is what makes the ramp
     felt rather than merely recorded. */
  const weighted: NumberBand[] = [];
  inPlay.forEach((b, i) => {
    weighted.push(b);
    if (i === inPlay.length - 1 && inPlay.length > 1) weighted.push(b);
  });
  for (let tries = 0; tries < 60; tries += 1) {
    const band = weighted[Math.floor(rnd() * weighted.length)] || inPlay[0];
    const value = band.from + Math.floor(rnd() * (band.to - band.from + 1));
    if (avoid.has(value) && tries < 40) continue;
    const spelled = spell(lang, parts, value);
    if (spelled) return { value, spelled };
  }
  return null;
}
