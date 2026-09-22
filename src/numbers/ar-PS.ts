/*
 * Palestinian Arabic numbers.
 *
 * Nothing in this file is a word. It knows which slots the language has,
 * which face of a word each position calls for, the order the pieces go
 * in and how the connector attaches — and it asks the teacher's system
 * for every syllable of it.
 *
 * The rules it does know, all of them about shape rather than sound:
 *
 *   * **Chunks, largest first, joined by the connector**, which attaches
 *     to the front of the word after it: a hundred, *and* twenty, *and*
 *     five. Every piece after the first wears one, which is what makes the
 *     join uniform.
 *   * **The unit before the ten**, the opposite of English and of Hebrew.
 *   * **Only one and two inflect for gender**, so the hour is feminine at
 *     one and two o'clock and plain at three. Asking the other units for a
 *     gendered form would be asking a teacher to fill in boxes that hold
 *     the same word twice.
 *   * **Counting a noun changes the shape of the phrase, not only the
 *     word.** One is said after its noun; two is the noun's dual with no
 *     numeral at all; three to ten take a form of their own and the
 *     noun's plural; everything above eleven takes the noun's singular.
 *     Which is why `render` places the noun rather than handing back a
 *     numeral and leaving the caller to guess.
 *   * **The fused hundreds and thousands are overrides, not compositions.**
 *     Three hundred is one word in this dialect and cannot be built out of
 *     *three* and *hundred*; the system carries it as a hand-written
 *     number and the composer reaches for that before it tries to build.
 *     `hundred.n` and `thousand.n` are there for a teacher whose dialect
 *     does build them, and are optional for one whose does not.
 */
import type {
  Composer,
  CountedNoun,
  FormKey,
  Lexeme,
  NounForm,
  NumberSystem,
  Range,
  RenderCtx,
  Rendering,
  SlotSpec,
  Token,
  Warning,
} from "./types.ts";
import { NUMBER_CEILING } from "./types.ts";
import type { VerbSpec } from "../types.ts";

/** Bumped when a change here could make an existing override wrong. */
export const AR_COMPOSER_VERSION = 1;

/* ---- the slots ---- */

const run = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

/** Counting aloud, and the two faces a numeral takes beside a noun. */
const COUNTING: FormKey[] = ["standalone"];
const GENDERED: FormKey[] = ["standalone", "m", "f"];
const CONSTRUCT: FormKey[] = ["standalone", "construct.m", "construct.f"];

export const AR_SLOTS: SlotSpec[] = [
  ...run(0, 10, 1).map((v) => ({
    slot: `unit.${v}`,
    formKeys: v === 0 ? COUNTING : v <= 2 ? GENDERED : CONSTRUCT,
    label: String(v),
    group: "units",
    hint:
      v === 1 || v === 2
        ? "Gender only: one and two agree with what they count."
        : v >= 3
        ? "The counting form, and the form that goes before a noun."
        : undefined,
  })),
  ...run(11, 19, 1).map((v) => ({
    slot: `teen.${v}`,
    formKeys: CONSTRUCT,
    label: String(v),
    group: "teens",
    hint: "One word. The second box is the form before a noun, where your dialect has one.",
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
    label: "hundred",
    group: "hundreds",
    optional: true,
    hint: "The bare word, for a dialect that says three hundred as two words. Leave it empty and write 300 to 900 out below.",
  },
  { slot: "thousand.1", formKeys: COUNTING, label: "1,000", group: "thousands" },
  { slot: "thousand.2", formKeys: COUNTING, label: "2,000", group: "thousands" },
  {
    slot: "thousand.n",
    formKeys: COUNTING,
    label: "thousands",
    group: "thousands",
    optional: true,
    hint: "The plural, as in three thousand. Leave it empty and write 3,000 to 9,000 out below.",
  },
  { slot: "million.1", formKeys: COUNTING, label: "1,000,000", group: "millions" },
  { slot: "million.2", formKeys: COUNTING, label: "2,000,000", group: "millions" },
  {
    slot: "million.n",
    formKeys: COUNTING,
    label: "millions",
    group: "millions",
    optional: true,
    hint: "The plural, as in three million.",
  },
  {
    slot: "connector",
    formKeys: COUNTING,
    label: "and",
    group: "joining",
    hint: "What goes between the pieces of a number — and in front of the word after it, with no space.",
  },
];

const SLOT_SPEC = new Map(AR_SLOTS.map((s) => [s.slot, s]));

/**
 * The ranges a learner is scheduled on.
 *
 * Four stretches of the number line and one skill that is not a stretch
 * at all: counting a noun is a different thing to know from saying a
 * number, and a learner solid on one is routinely lost on the other.
 */
export const AR_RANGES: Range[] = [
  { id: "numbers:0-10", kind: "numbers", label: "Numbers 0 to 10", from: 0, to: 10 },
  { id: "numbers:11-99", kind: "numbers", label: "Numbers 11 to 99", from: 11, to: 99 },
  { id: "numbers:100-999", kind: "numbers", label: "Numbers 100 to 999", from: 100, to: 999 },
  { id: "numbers:1000+", kind: "numbers", label: "Numbers over a thousand", from: 1000, to: NUMBER_CEILING },
  { id: "numbers:agreement", kind: "numbers", label: "Counting things", from: 1, to: 20, counted: true },
];

/*
 * How the forms lay out as cells of the component card.
 *
 * One row, a column per face, and the two construct columns pick on the
 * gender of whatever they stand before — the same shape the `counted`
 * table had, with the construct forms it never had a column for.
 */
export const AR_NUMBER_TABLE: VerbSpec = {
  persons: [
    { id: "m", label: "with a masculine word", picks: { gender: "masculine" } },
    { id: "f", label: "with a feminine word", picks: { gender: "feminine" } },
    { id: "construct.m", label: "before a masculine noun" },
    { id: "construct.f", label: "before a feminine noun" },
  ],
  tenses: [{ id: "number", label: "number" }],
  label: "the forms a number takes",
  gate: "word",
};

/* ---- reading the system ---- */

/**
 * Which faces to try, in order, for one that was asked for.
 *
 * Across the two genders only where the two are usually the same word:
 * the form before a masculine noun and the form before a feminine one are
 * one word in this dialect more often than not, so borrowing is right
 * there. It is wrong between the masculine and feminine of *one*, which
 * are two words a learner has to tell apart, and answering with the one
 * the teacher did not mean is a mistake nobody can see.
 */
const FALLBACK: Record<FormKey, FormKey[]> = {
  standalone: ["standalone"],
  m: ["m", "standalone"],
  f: ["f", "standalone"],
  "construct.m": ["construct.m", "construct.f", "m", "standalone"],
  "construct.f": ["construct.f", "construct.m", "f", "standalone"],
};

const textOf = (lex: Lexeme | undefined, key: FormKey): string =>
  String((lex && lex.forms && lex.forms[key]) || "").trim();

/**
 * What a rendering is built up in.
 *
 * Pieces and tokens are kept apart because they are different questions:
 * the pieces are what is said, and the tokens are what is credited. A
 * connector is one token however many joins it made.
 */
class Build {
  sys: NumberSystem;
  tokens: Token[] = [];
  warnings: Warning[] = [];
  private seen = new Set<string>();

  constructor(sys: NumberSystem) {
    this.sys = sys;
  }

  warn(w: Warning) {
    const key = `${w.code}:${w.slot || ""}:${w.formKey || ""}:${w.detail || ""}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(w);
  }

  /** The word for one slot in one face, or an empty string and a warning. */
  word(slot: string, want: FormKey): string {
    const spec = SLOT_SPEC.get(slot);
    const lex = this.sys.lexemes ? this.sys.lexemes[slot] : undefined;
    /* A face the slot does not offer is not a gap — it is a question this
       slot has no answer to, and the counting form is the answer. */
    const asked = spec && spec.formKeys.includes(want) ? want : "standalone";
    for (const key of FALLBACK[asked]) {
      const text = textOf(lex, key);
      if (!text) continue;
      if (key !== asked) this.warn({ code: "missing-form", slot, formKey: asked });
      this.tokens.push({ text, slot, formKey: key });
      return text;
    }
    this.warn({ code: "missing-slot", slot, formKey: asked });
    return "";
  }

  /** A number the teacher wrote out by hand, in this face if they gave one. */
  override(n: number, key: FormKey): string {
    const table = this.sys.overrides || {};
    for (const k of key === "standalone" ? [String(n)] : [`${n}|${key}`, String(n)]) {
      const text = String((table[k] && table[k].text) || "").trim();
      if (text) {
        this.tokens.push({ text, override: k });
        return text;
      }
    }
    return "";
  }

  /** The connector, recorded once however often it is used. */
  join(pieces: string[]): string {
    const live = pieces.filter(Boolean);
    if (live.length < 2) return live.join(" ");
    const lex = this.sys.lexemes ? this.sys.lexemes.connector : undefined;
    const conn = textOf(lex, "standalone");
    if (!conn) {
      this.warn({ code: "missing-slot", slot: "connector", formKey: "standalone" });
      return live.join(" ");
    }
    if (!this.tokens.some((t) => t.slot === "connector")) {
      this.tokens.push({ text: conn, slot: "connector", formKey: "standalone" });
    }
    /* The connector attaches to the word after it and is spaced from the
       word before: "a hundred and-five", one word out of two. */
    return live.reduce((a, b) => `${a} ${conn}${b}`);
  }
}

/* ---- composing ---- */

const genderKey = (g: "m" | "f" | undefined, construct: boolean): FormKey =>
  construct ? (g === "f" ? "construct.f" : "construct.m") : g === "f" ? "f" : "m";

/**
 * Whether gender is a question this number asks at all.
 *
 * One and two inflect and nothing else does, so 21 and 32 ask it of their
 * unit and 30 does not ask it at all. Said here once rather than at the
 * four places that would otherwise each have to remember.
 */
const inflects = (n: number): boolean => n === 1 || n === 2;

/** Which face the whole rendering stands in, for looking up an override. */
function topKey(n: number, gender: "m" | "f" | undefined, counted: boolean): FormKey {
  if (counted && n >= 3 && n <= 19) return genderKey(gender, true);
  if (counted && inflects(n)) return genderKey(gender, false);
  if (!counted && gender && inflects(n)) return genderKey(gender, false);
  return "standalone";
}

/** Nought to 999, as it is said inside anything larger. */
function under1000(b: Build, n: number, gender: "m" | "f" | undefined): string {
  const pieces: string[] = [];
  const hundreds = Math.floor(n / 100) * 100;
  const tail = n % 100;

  if (hundreds) {
    const written = b.override(hundreds, "standalone");
    if (written) pieces.push(written);
    else if (hundreds === 100) pieces.push(b.word("hundred.1", "standalone"));
    else if (hundreds === 200) pieces.push(b.word("hundred.2", "standalone"));
    else {
      /* Three hundred as two words, for a dialect that says it that way.
         The unit goes in front in its before-a-noun form, because a
         hundred is the noun it is counting. */
      const unit = b.word(`unit.${hundreds / 100}`, "construct.m");
      const word = b.word("hundred.n", "standalone");
      pieces.push([unit, word].filter(Boolean).join(" "));
    }
  }

  if (tail) {
    const written = b.override(tail, topKey(tail, gender, false));
    if (written) pieces.push(written);
    else if (tail <= 10) pieces.push(b.word(`unit.${tail}`, inflects(tail) ? genderKey(gender, false) : "standalone"));
    else if (tail <= 19) pieces.push(b.word(`teen.${tail}`, "standalone"));
    else if (tail % 10 === 0) pieces.push(b.word(`ten.${tail}`, "standalone"));
    else {
      /* The unit first, which is this language's whole difference from
         the one next door. */
      const u = tail % 10;
      const unit = b.word(`unit.${u}`, inflects(u) ? genderKey(gender, false) : "standalone");
      const ten = b.word(`ten.${tail - u}`, "standalone");
      pieces.push(b.join([unit, ten]));
    }
  }

  return b.join(pieces);
}

/**
 * A scale word with its count in front — three thousand, eleven thousand.
 *
 * Under eleven the count and the scale fuse or agree, so the whole thing
 * is either written out by the teacher or built from the scale's own
 * singular, dual and plural. From eleven the count is simply said and the
 * scale goes back to its singular, which is the rule that carries the rest
 * of the number line.
 */
function scale(b: Build, count: number, unit: number, name: string): string {
  if (!count) return "";
  const whole = b.override(count * unit, "standalone");
  if (whole) return whole;
  if (count === 1) return b.word(`${name}.1`, "standalone");
  if (count === 2) return b.word(`${name}.2`, "standalone");
  if (count <= 10) {
    const said = b.word(`unit.${count}`, "construct.m");
    const word = b.word(`${name}.n`, "standalone");
    return [said, word].filter(Boolean).join(" ");
  }
  const said = under1000(b, count, undefined);
  const word = b.word(`${name}.1`, "standalone");
  return [said, word].filter(Boolean).join(" ");
}

/** The numeral alone, in whichever face was asked for. */
function numeral(b: Build, n: number, gender: "m" | "f" | undefined, counted: boolean): string {
  const written = b.override(n, topKey(n, gender, counted));
  if (written) return written;

  if (counted && n >= 3 && n <= 10) return b.word(`unit.${n}`, genderKey(gender, true));
  if (counted && n >= 11 && n <= 19) return b.word(`teen.${n}`, genderKey(gender, true));
  /* Nought has no chunks to be built out of, so it is said before the
     building starts rather than falling through it and coming out empty. */
  if (n === 0) return b.word("unit.0", "standalone");

  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  const pieces = [
    scale(b, millions, 1000000, "million"),
    scale(b, thousands, 1000, "thousand"),
    rest ? under1000(b, rest, gender) : "",
  ];
  return b.join(pieces);
}

/**
 * Which face of the counted noun a numeral calls for.
 *
 * The part of the rule a learner gets wrong for years, and the reason the
 * agreement range exists: the plural is only ever used from three to ten,
 * and everything above eleven goes back to the singular.
 */
function nounFormFor(n: number): NounForm {
  if (n === 2) return "dual";
  if (n >= 3 && n <= 10) return "pl";
  if (n === 0) return "pl";
  return "sg";
}

/** The noun in the face the numeral asked for, falling back to the
    singular and saying so rather than leaving a hole in the phrase. */
function nounText(b: Build, noun: CountedNoun, form: NounForm): string {
  const want = form === "dual" ? noun.dual : form === "pl" ? noun.pl : noun.sg;
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

/**
 * A number, in words, with whatever it is counting beside it.
 *
 * Total: out of range, an empty system and a slot nobody filled all come
 * back as a rendering with a warning on it. Nothing here throws, and
 * nothing deals a question out of a rendering that warned.
 */
export function renderAr(n: number, sys: NumberSystem, ctx: RenderCtx = {}): Rendering {
  const b = new Build(sys);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > NUMBER_CEILING) {
    b.warn({ code: "out-of-range", detail: String(n) });
    return { text: "", tokens: [], warnings: b.warnings };
  }

  const noun = ctx.noun;
  const gender = noun ? noun.gender : ctx.gender;
  if (!noun) {
    const text = numeral(b, n, gender, false);
    return { text, tokens: b.tokens, warnings: b.warnings };
  }

  const form = nounFormFor(n);
  /* Two of a thing is the thing's dual and no numeral at all: "two books"
     is one word, the dual of *book*, with nothing in it that says two. It
     is the one place a number is said by not being said, and the reason
     this returns a phrase rather than a numeral. */
  if (n === 2) {
    const text = nounText(b, noun, "dual");
    return { text, tokens: b.tokens, nounForm: "dual", warnings: b.warnings };
  }

  const said = numeral(b, n, gender, true);
  const word = nounText(b, noun, form);
  /* One follows its noun; everything else leads. */
  const text = (n === 1 ? [word, said] : [said, word]).filter(Boolean).join(" ");
  return { text, tokens: b.tokens, nounForm: form, warnings: b.warnings };
}

export const arComposer: Composer = {
  id: "ar-PS",
  version: AR_COMPOSER_VERSION,
  requiredSlots: () => AR_SLOTS,
  table: () => AR_NUMBER_TABLE,
  ranges: () => AR_RANGES,
  render: renderAr,
};
