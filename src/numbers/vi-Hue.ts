/*
 * Huế Vietnamese numbers.
 *
 * Fourteen boxes against the Semitic pair's sixty, because the language is
 * regular: *five hundred* really is *five* and *hundred* said one after
 * the other, so nothing above ten has to be written down. What it asks for
 * instead is the three multiplier words on their own, which is why their
 * boxes are labelled *hundred* rather than *100* — one hundred has the
 * *one* said out loud, and a box holding *one hundred* could not build
 * five hundred.
 *
 * The irregularity is all in company, and it is not grammar: *five* is one
 * word alone and another after a ten, *one* is one word alone and another
 * after two tens, *ten* is one word alone and another after a digit. Those
 * are the same word wearing a different face inside a bigger number, which
 * is what the `company` face is for and why it is not gender or construct
 * state dressed up.
 *
 * And one thing that is a shape rather than a word: **a place that is not
 * the leading one says its empty hundreds out loud**, so 1,005 has *no
 * hundred* in the middle of it. Dropping them would leave the digits
 * unreadable, which is a fact about how this language keeps its columns
 * straight and not a fact about any of its words.
 */
import type {
  Composer,
  FormKey,
  NumberSystem,
  Range,
  RenderCtx,
  Rendering,
  SlotSpec,
} from "./types.ts";
import { NUMBER_CEILING } from "./types.ts";
import { Build } from "./build.ts";
import type { VerbSpec } from "../types.ts";

export const VI_COMPOSER_VERSION = 1;

const COUNTING: FormKey[] = ["standalone"];
const IN_COMPANY: FormKey[] = ["standalone", "company"];

/** The four units that change shape inside a bigger number, and what to
    tell the teacher about each. Everything else is said as it is. */
const COMPANY_HINT: Record<number, string> = {
  0: "The word that marks an empty place, as in a hundred and five.",
  1: "The form after two tens or more, as in twenty-one.",
  4: "The form after two tens or more, as in twenty-four.",
  5: "The form after any ten, as in fifteen.",
  10: "The form after a digit, as in twenty.",
};

export const VI_SLOTS: SlotSpec[] = [
  ...Array.from({ length: 11 }, (_, v) => ({
    slot: `unit.${v}`,
    formKeys: COMPANY_HINT[v] ? IN_COMPANY : COUNTING,
    label: String(v),
    group: "units",
    hint: COMPANY_HINT[v],
  })),
  {
    slot: "hundred.n",
    formKeys: COUNTING,
    label: "hundred",
    group: "scales",
    hint: "The bare word, without the one in front: the app says the one.",
  },
  { slot: "thousand.n", formKeys: COUNTING, label: "thousand", group: "scales" },
  { slot: "million.n", formKeys: COUNTING, label: "million", group: "scales" },
];

export const VI_RANGES: Range[] = [
  { id: "numbers:0-10", kind: "numbers", label: "Numbers 0 to 10", from: 0, to: 10 },
  { id: "numbers:11-99", kind: "numbers", label: "Numbers 11 to 99", from: 11, to: 99 },
  { id: "numbers:100-999", kind: "numbers", label: "Numbers 100 to 999", from: 100, to: 999 },
  { id: "numbers:1000+", kind: "numbers", label: "Numbers over a thousand", from: 1000, to: NUMBER_CEILING },
  /* No counting range: nothing in this language agrees with what it
     counts, so there is no second skill there to schedule. */
];

export const VI_NUMBER_TABLE: VerbSpec = {
  persons: [{ id: "company", label: "inside a bigger number" }],
  tenses: [{ id: "number", label: "number" }],
  label: "the form in company",
  gate: "word",
};

const FALLBACK: Record<FormKey, FormKey[]> = {
  standalone: ["standalone"],
  /* A word with no changed form is said as it is, which is nearly all of
     them — so this borrows silently rather than reporting a gap under
     every box the teacher was right to leave empty. */
  company: ["company", "standalone"],
  m: ["standalone"],
  f: ["standalone"],
  "construct.m": ["standalone"],
  "construct.f": ["standalone"],
};

const build = (sys: NumberSystem) => new Build(sys, VI_SLOTS, FALLBACK);

/** Ten to 99. `tens` is how many tens: one is the plain word for ten and
    the rest are a digit followed by ten's own changed form. */
function under100(b: Build, n: number): string {
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  const head =
    tens === 1
      ? b.word("unit.10", "standalone")
      : [b.word(`unit.${tens}`, "standalone"), b.word("unit.10", "company")].filter(Boolean).join(" ");
  if (!unit) return head;
  /* One and four change only after two tens or more; five changes after
     any ten at all. */
  const changes = unit === 5 || ((unit === 1 || unit === 4) && tens >= 2);
  const tail = b.word(`unit.${unit}`, changes ? "company" : "standalone");
  return [head, tail].filter(Boolean).join(" ");
}

/** One to 999 as a place in a bigger number. */
function place(b: Build, n: number, leading: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const bits: string[] = [];
  if (hundreds || !leading) {
    const digit = b.word(`unit.${hundreds}`, "standalone");
    const word = b.word("hundred.n", "standalone");
    bits.push([digit, word].filter(Boolean).join(" "));
  }
  if (rest) {
    if (rest < 10 && bits.length) {
      /* A place with nothing in its tens needs the marker that says so.
         It is nought's own form in company, so the teacher writes it in
         the box beside nought rather than the app shipping a word nobody
         chose. */
      const filler = b.word("unit.0", "company");
      const unit = b.word(`unit.${rest}`, "standalone");
      bits.push([filler, unit].filter(Boolean).join(" "));
    } else {
      bits.push(rest < 10 ? b.word(`unit.${rest}`, "standalone") : under100(b, rest));
    }
  }
  return bits.filter(Boolean).join(" ");
}

function scale(b: Build, count: number, slot: string, leading: boolean): string {
  if (!count) return "";
  const said = place(b, count, leading);
  const word = b.word(slot, "standalone");
  return [said, word].filter(Boolean).join(" ");
}

export function renderVi(n: number, sys: NumberSystem, ctx: RenderCtx = {}): Rendering {
  const b = build(sys);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > NUMBER_CEILING) {
    b.warn({ code: "out-of-range", detail: String(n) });
    return { text: "", tokens: [], warnings: b.warnings };
  }

  const written = b.override(n, "standalone");
  const said = (() => {
    if (written) return written;
    if (n === 0) return b.word("unit.0", "standalone");
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const rest = n % 1000;
    const parts = [
      scale(b, millions, "million.n", true),
      scale(b, thousands, "thousand.n", !millions),
      rest ? place(b, rest, !millions && !thousands) : "",
    ];
    return parts.filter(Boolean).join(" ");
  })();

  /* Nothing here agrees with anything, so a noun is simply put after the
     number — and the singular, because this language does not have a
     plural to choose. */
  if (!ctx.noun) return { text: said, tokens: b.tokens, warnings: b.warnings };
  const word = String(ctx.noun.sg || "").trim();
  if (word) b.tokens.push({ text: word, noun: ctx.noun.id });
  return {
    text: [said, word].filter(Boolean).join(" "),
    tokens: b.tokens,
    nounForm: "sg",
    warnings: b.warnings,
  };
}

export const viComposer: Composer = {
  id: "vi-Hue",
  version: VI_COMPOSER_VERSION,
  requiredSlots: () => VI_SLOTS,
  table: () => VI_NUMBER_TABLE,
  ranges: () => VI_RANGES,
  render: renderVi,
};
