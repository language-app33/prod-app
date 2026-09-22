/*
 * Modern Hebrew numbers.
 *
 * The same parts as Arabic and the opposite habits, which is why the two
 * are written twice rather than once with an argument:
 *
 *   * **The ten before the unit**, and **one connector in the whole
 *     number** rather than one before every chunk — so 1,525 has a single
 *     joining word in it, in front of the last word. Which means the
 *     pieces cannot be joined chunk by chunk: where the connector goes is
 *     a fact about the whole number, so everything below hands back a
 *     *list* and only the top joins it.
 *   * **Counting in the abstract is feminine.** Reading 5 off a page is
 *     one word and five books is another, so the counting form is what a
 *     slot holds first and the masculine is a face beside it — the
 *     opposite of the way this app stored it before, and the reason the
 *     migration has to turn the old cards round rather than copy them.
 *   * **Except in front of a scale word**, which is a masculine noun, so
 *     eleven thousand is counted the masculine way. It is the one place in
 *     a number where the feminine is wrong.
 *   * **And the bound form before *thousands* is a form of its own** —
 *     neither the masculine nor the feminine — which the hundreds do not
 *     use and the millions do not either.
 */
import type {
  Composer,
  CountedNoun,
  FormKey,
  NounForm,
  NumberSystem,
  Range,
  RenderCtx,
  Rendering,
  SlotSpec,
} from "./types.ts";
import { NUMBER_CEILING } from "./types.ts";
import { Build } from "./build.ts";
import type { VerbSpec } from "../types.ts";

export const HE_COMPOSER_VERSION = 1;

const run = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

const COUNTING: FormKey[] = ["standalone"];
const GENDERED: FormKey[] = ["standalone", "m", "f"];
const BOUND: FormKey[] = ["standalone", "m", "f", "construct.m"];
const PAIRED: FormKey[] = ["standalone", "m", "f", "construct.m", "construct.f"];

export const HE_SLOTS: SlotSpec[] = [
  ...run(0, 10, 1).map((v) => ({
    slot: `unit.${v}`,
    formKeys: v === 0 ? COUNTING : v === 1 || v === 10 ? GENDERED : v === 2 ? PAIRED : BOUND,
    label: String(v),
    group: "units",
    hint:
      v === 0
        ? undefined
        : v <= 2
        ? "The form you count with, and the forms that go with a word."
        : "The form you count with, the two that go with a word, and the bound form used before thousands.",
  })),
  ...run(11, 19, 1).map((v) => ({
    slot: `teen.${v}`,
    formKeys: GENDERED,
    label: String(v),
    group: "teens",
  })),
  ...run(20, 90, 10).map((v) => ({
    slot: `ten.${v}`,
    formKeys: COUNTING,
    label: String(v),
    group: "tens",
  })),
  { slot: "hundred.1", formKeys: COUNTING, label: "100", group: "hundreds" },
  { slot: "hundred.2", formKeys: COUNTING, label: "200", group: "hundreds" },
  {
    slot: "hundred.n",
    formKeys: COUNTING,
    label: "hundreds",
    group: "hundreds",
    hint: "The plural, as in three hundred. The count in front of it is the one you count with.",
  },
  { slot: "thousand.1", formKeys: COUNTING, label: "1,000", group: "thousands" },
  { slot: "thousand.2", formKeys: COUNTING, label: "2,000", group: "thousands" },
  {
    slot: "thousand.n",
    formKeys: COUNTING,
    label: "thousands",
    group: "thousands",
    hint: "The plural, as in three thousand. The count in front of it is the bound form.",
  },
  { slot: "million.1", formKeys: COUNTING, label: "1,000,000", group: "millions" },
  { slot: "million.2", formKeys: COUNTING, label: "2,000,000", group: "millions" },
  {
    slot: "million.n",
    formKeys: COUNTING,
    label: "million",
    group: "millions",
    hint: "The word after a count, as in three million. It does not take a plural here.",
  },
  {
    slot: "connector",
    formKeys: COUNTING,
    label: "and",
    group: "joining",
    hint: "One per number, in front of the last word, with no space after it.",
  },
];

export const HE_RANGES: Range[] = [
  { id: "numbers:0-10", kind: "numbers", label: "Numbers 0 to 10", from: 0, to: 10 },
  { id: "numbers:11-99", kind: "numbers", label: "Numbers 11 to 99", from: 11, to: 99 },
  { id: "numbers:100-999", kind: "numbers", label: "Numbers 100 to 999", from: 100, to: 999 },
  { id: "numbers:1000+", kind: "numbers", label: "Numbers over a thousand", from: 1000, to: NUMBER_CEILING },
  { id: "numbers:agreement", kind: "numbers", label: "Counting things", from: 1, to: 20, counted: true },
];

export const HE_NUMBER_TABLE: VerbSpec = {
  persons: [
    { id: "m", label: "with a masculine word", picks: { gender: "masculine" } },
    { id: "f", label: "with a feminine word", picks: { gender: "feminine" } },
    { id: "construct.m", label: "before thousands" },
    { id: "construct.f", label: "before a feminine word, bound" },
  ],
  tenses: [{ id: "number", label: "number" }],
  label: "the forms a number takes",
  gate: "word",
};

const FALLBACK: Record<FormKey, FormKey[]> = {
  standalone: ["standalone"],
  /* The masculine is a different word from the one you count with, so it
     borrows from nothing: a number counted the wrong way is a mistake
     nobody can see, and an empty box is one a teacher can. */
  m: ["m"],
  f: ["f", "standalone"],
  "construct.m": ["construct.m", "m"],
  "construct.f": ["construct.f", "f", "standalone"],
  company: ["company", "standalone"],
};

const build = (sys: NumberSystem) => new Build(sys, HE_SLOTS, FALLBACK);

/**
 * Where the connector goes: in front of the last word and nowhere else.
 *
 * Used for the number as a whole and again inside a count, since
 * twenty-one thousand carries its connector inside the twenty-one rather
 * than before the thousand.
 */
function join(b: Build, of: string[]): string {
  const live = of.filter(Boolean);
  if (live.length < 2) return live.join(" ");
  const conn = b.connector();
  if (!conn) return live.join(" ");
  return `${live.slice(0, -1).join(" ")} ${conn}${live[live.length - 1]}`;
}

/** Nought to 999 as a list of words, because where the connector goes is
    not this function's business. `how` is which face to count in. */
function under1000(b: Build, n: number, how: FormKey): string[] {
  const out: string[] = [];
  const hundreds = Math.floor(n / 100) * 100;
  const tail = n % 100;

  if (hundreds) {
    const written = b.override(hundreds, "standalone");
    if (written) out.push(written);
    else if (hundreds === 100) out.push(b.word("hundred.1", "standalone"));
    else if (hundreds === 200) out.push(b.word("hundred.2", "standalone"));
    else {
      /* The count in front of *hundreds* is the one you count with,
         whatever the number as a whole is doing. */
      const unit = b.word(`unit.${hundreds / 100}`, "standalone");
      const word = b.word("hundred.n", "standalone");
      out.push([unit, word].filter(Boolean).join(" "));
    }
  }

  if (tail) {
    const written = b.override(tail, how);
    if (written) out.push(written);
    else if (tail <= 10) out.push(b.word(`unit.${tail}`, how));
    else if (tail <= 19) out.push(b.word(`teen.${tail}`, how));
    else if (tail % 10 === 0) out.push(b.word(`ten.${tail}`, "standalone"));
    else {
      /* The ten first, which is this language's whole difference from the
         one next door. */
      out.push(b.word(`ten.${tail - (tail % 10)}`, "standalone"));
      out.push(b.word(`unit.${tail % 10}`, how));
    }
  }

  return out.filter(Boolean);
}

/**
 * A scale word with its count in front.
 *
 * `countKey` is the one thing the two scales disagree about: thousands
 * take the bound form and millions take the masculine, and both are
 * masculine nouns so neither takes the form you count with.
 */
function scale(b: Build, count: number, unit: number, name: string, countKey: FormKey): string {
  if (!count) return "";
  const whole = b.override(count * unit, "standalone");
  if (whole) return whole;
  if (count === 1) return b.word(`${name}.1`, "standalone");
  if (count === 2) return b.word(`${name}.2`, "standalone");
  /* Three to nine take the bound form and the scale's plural. **Ten does
     not** — it is counted the masculine way with the scale's singular
     after it, which is what this app has said since 0.152 and is what a
     port has no business changing on its own. The written language would
     have the bound form here too; that is a question for whoever reads
     the Hebrew table, and it is in the backlog under their name. */
  if (count >= 3 && count <= 9) {
    const said = b.word(`unit.${count}`, countKey);
    const word = b.word(`${name}.n`, "standalone");
    return [said, word].filter(Boolean).join(" ");
  }
  const said = join(b, under1000(b, count, "m"));
  const word = b.word(`${name}.1`, "standalone");
  return [said, word].filter(Boolean).join(" ");
}

function numeral(b: Build, n: number, how: FormKey): string {
  const written = b.override(n, how);
  if (written) return written;
  if (n === 0) return b.word("unit.0", "standalone");

  const pieces: string[] = [];
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  const m = scale(b, millions, 1000000, "million", "m");
  if (m) pieces.push(m);
  const t = scale(b, thousands, 1000, "thousand", "construct.m");
  if (t) pieces.push(t);
  if (rest) pieces.push(...under1000(b, rest, how));
  return join(b, pieces);
}

/** Hebrew has no dual to count with: everything past one is the plural. */
const nounFormFor = (n: number): NounForm => (n === 1 ? "sg" : "pl");

function nounText(b: Build, noun: CountedNoun, form: NounForm): string {
  const want = form === "pl" ? noun.pl : noun.sg;
  const text = String(want || "").trim();
  if (text) {
    b.tokens.push({ text, noun: noun.id });
    return text;
  }
  b.warn({ code: "missing-noun-form", detail: `${noun.id}.${form}` });
  const fallback = String(noun.sg || "").trim();
  if (fallback) b.tokens.push({ text: fallback, noun: noun.id });
  return fallback;
}

export function renderHe(n: number, sys: NumberSystem, ctx: RenderCtx = {}): Rendering {
  const b = build(sys);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > NUMBER_CEILING) {
    b.warn({ code: "out-of-range", detail: String(n) });
    return { text: "", tokens: [], warnings: b.warnings };
  }

  const noun = ctx.noun;
  if (!noun) {
    /* Counting in the abstract, unless somebody named a gender — which is
       what the hour does. */
    const how: FormKey = ctx.gender === "m" ? "m" : ctx.gender === "f" ? "f" : "standalone";
    return { text: numeral(b, n, how), tokens: b.tokens, warnings: b.warnings };
  }

  const form = nounFormFor(n);
  /* Two is the bound form in front of the plural, which is the one shape
     that is not simply "the numeral, then the noun". */
  const how: FormKey = n === 2 ? (noun.gender === "f" ? "construct.f" : "construct.m") : noun.gender;
  const said = numeral(b, n, how);
  const word = nounText(b, noun, form);
  const text = (n === 1 ? [word, said] : [said, word]).filter(Boolean).join(" ");
  return { text, tokens: b.tokens, nounForm: form, warnings: b.warnings };
}

/**
 * An old number card, as faces — and this one is turned round.
 *
 * The old storage kept the **masculine** on the card, because that is the
 * form that stands beside a noun, and put the form you count with in a
 * cell beside it. A system holds them the other way up: counting is what
 * a slot's first box is for, everywhere. So the cell becomes the word and
 * the word becomes the masculine, and a card with no cell — one the
 * teacher never filled in — keeps its word in both places rather than
 * losing half of itself.
 */
export const liftHeCard = (old: { word: string; cells: Record<string, string> }) => {
  const word = String(old.word || "").trim();
  const counting = String(old.cells.feminine || "").trim() || word;
  return {
    ...(counting ? { standalone: counting, f: counting } : null),
    ...(word ? { m: word } : null),
  };
};

export const heComposer: Composer = {
  id: "he-IL",
  version: HE_COMPOSER_VERSION,
  requiredSlots: () => HE_SLOTS,
  liftCard: liftHeCard,
  table: () => HE_NUMBER_TABLE,
  ranges: () => HE_RANGES,
  render: renderHe,
};
