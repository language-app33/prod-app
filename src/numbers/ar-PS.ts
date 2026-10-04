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
 *     one and two o'clock and plain at three. Three to nineteen have a
 *     form of their own before a noun, and it is **one** form: *khams
 *     wlād*, *khams banāt*. The written language's reversed agreement is
 *     not the dialect's, and asking a teacher for a word before a
 *     masculine noun and another before a feminine one was asking them to
 *     write the same word twice — or to write the written language's two
 *     and have it taught as the dialect. See DECISIONS.md, 0.321.
 *   * **Counting a noun changes the shape of the phrase, not only the
 *     word.** One is said after its noun; two is the noun's dual with no
 *     numeral at all; three to ten take a form of their own and the
 *     noun's plural — or, for the few nouns that have one, the plural they
 *     take only there, *tiyyām* beside *ayyām*; everything above eleven
 *     takes the noun's singular. Which is why `render` places the noun
 *     rather than handing back a numeral and leaving the caller to guess.
 *   * **The fused hundreds and thousands are overrides, not compositions.**
 *     Three hundred is one word in this dialect and cannot be built out of
 *     *three* and *hundred*; the system carries it as a hand-written
 *     number and the composer reaches for that before it tries to build.
 *     `hundred.n` and `thousand.n` are there for a teacher whose dialect
 *     does build them, and are optional for one whose does not.
 */
import type {
  Composer,
  FormKey,
  NounForm,
  NumberSystem,
  Range,
  RenderCtx,
  Rendering,
  SlotSpec,
  TwoWords,
} from "./types.ts";
import { COUNTING_STRETCHES, NUMBER_CEILING } from "./types.ts";
import { Build } from "./build.ts";
import { chunksOf, genderKeyOf, nounTextOf } from "./compose.ts";
import { overrideId } from "./generate.ts";
import type { VerbSpec } from "../types.ts";

/** Bumped when a change here could make an existing override wrong.
    2: one word before a noun for three to nineteen, whatever its gender. */
export const AR_COMPOSER_VERSION = 2;

/* ---- the slots ---- */

const run = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

/**
 * Counting aloud, and the faces a numeral takes beside a noun.
 *
 * From three to nineteen that is one face, stored as `construct.m` and
 * called what it is. `construct.f` is not a box any more; a system written
 * while it was is read in `beforeNoun`, and its teacher is asked which of
 * the two words they say — see `twoWordsBeforeNoun`.
 */
const COUNTING: FormKey[] = ["standalone"];
const GENDERED: FormKey[] = ["standalone", "m", "f"];
const CONSTRUCT: FormKey[] = ["standalone", "construct.m"];
const BEFORE_A_NOUN = { "construct.m": "before a noun" };

export const AR_SLOTS: SlotSpec[] = [
  ...run(0, 10, 1).map((v) => ({
    slot: `unit.${v}`,
    formKeys: v === 0 ? COUNTING : v <= 2 ? GENDERED : CONSTRUCT,
    ...(v >= 3 ? { faceLabels: BEFORE_A_NOUN } : null),
    label: String(v),
    group: "units",
    hint:
      v === 1 || v === 2
        ? "One and two agree with what they count, so they have a word for each gender."
        : v >= 3
        ? "The counting form, and the form that goes before a noun — the same before a masculine or a feminine one."
        : undefined,
  })),
  ...run(11, 19, 1).map((v) => ({
    slot: `teen.${v}`,
    formKeys: CONSTRUCT,
    faceLabels: BEFORE_A_NOUN,
    label: String(v),
    group: "teens",
    hint: "One word. The second box is the form before a noun, where your dialect has one — the same for either gender.",
  })),
  ...run(20, 90, 10).map((v) => ({
    slot: `ten.${v}`,
    formKeys: COUNTING,
    label: String(v),
    group: "tens",
  })),
  { slot: "hundred.1", formKeys: COUNTING, label: "100", group: "hundreds" },
  { slot: "hundred.2", formKeys: COUNTING, label: "200", group: "hundreds" },
  /* Three hundred to nine hundred are one word each in this dialect, so
     each has a box beside a hundred and two hundred. They were written
     out under the samples until 0.334, which is where nobody looked for a
     word; tidyHundreds moves what was written there into these. */
  ...run(3, 9, 1).map((k) => ({
    slot: `hundred.${k}`,
    formKeys: COUNTING,
    label: String(k * 100),
    group: "hundreds",
    optional: true,
  })),
  {
    slot: "hundred.n",
    formKeys: COUNTING,
    label: "hundred",
    group: "hundreds",
    optional: true,
    hint: "The bare word, only for a dialect that says three hundred as two words. If yours says each of 300 to 900 as one word, write those in their boxes above and leave this empty.",
  },
  { slot: "thousand.1", formKeys: COUNTING, label: "1,000", group: "thousands" },
  { slot: "thousand.2", formKeys: COUNTING, label: "2,000", group: "thousands" },
  {
    slot: "thousand.n",
    formKeys: COUNTING,
    label: "thousands",
    group: "thousands",
    optional: true,
    hint: "The plural, as it is said after three to ten — with the t it takes there, as in three thousand. If yours says each of 3,000 to 10,000 as one word, leave it empty and write them out: tap each one under How the app says them, below.",
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
    group: "connecting words",
    hint: "What goes between the pieces of a number — and in front of the word after it, with no space.",
  },
];

/**
 * The ranges a learner is scheduled on: the five stretches of the number
 * line, each counted with as well — a learner solid on saying a number is
 * routinely lost on saying three of something, so every stretch asks
 * both. See COUNTING_STRETCHES.
 */
export const AR_RANGES: Range[] = COUNTING_STRETCHES;

/*
 * How the forms lay out as cells of the component card.
 *
 * One row, a column per face: the two genders of one and two, and the one
 * word three to nineteen take before a noun of either.
 */
export const AR_NUMBER_TABLE: VerbSpec = {
  persons: [
    { id: "m", label: "with a masculine word", picks: { gender: "masculine" } },
    { id: "f", label: "with a feminine word", picks: { gender: "feminine" } },
    { id: "construct.m", label: "before a noun" },
  ],
  tenses: [{ id: "number", label: "number" }],
  label: "the forms a number takes",
  gate: "word",
};

/* ---- reading the system ---- */

/**
 * Which faces to try, in order, for one that was asked for.
 *
 * Never across the genders of one and two, which are two words a learner
 * has to tell apart: answering with the one the teacher did not mean is a
 * mistake nobody can see. The word before a noun falls back to the
 * counting form, which is the nearest thing a teacher has written.
 */
const FALLBACK: Record<FormKey, FormKey[]> = {
  standalone: ["standalone"],
  m: ["m", "standalone"],
  f: ["f", "standalone"],
  "construct.m": ["construct.m", "m", "standalone"],
  /* Not a face any slot offers since 0.321 — see beforeNoun, which reads
     what a system written before then still holds. */
  "construct.f": ["construct.m", "m", "standalone"],
  /* Not a face this language has. Declared so the table is complete and
     a fourth language adding one cannot make this file stop compiling
     without anybody noticing. */
  company: ["company", "standalone"],
};

/**
 * The connector attaches to the word after it and is spaced from the word
 * before: "a hundred and-five", one word out of two. A language whose
 * joining word stands alone would write this differently, which is why it
 * is here and not in the shared bookkeeping.
 */
function join(b: Build, pieces: string[]): string {
  const live = pieces.filter(Boolean);
  if (live.length < 2) return live.join(" ");
  const conn = b.connector();
  if (!conn) return live.join(" ");
  return live.reduce((a, c) => `${a} ${conn}${c}`);
}

const build = (sys: NumberSystem) => new Build(sys, AR_SLOTS, FALLBACK);

/* ---- what a system written before 0.321 may still hold ---- */

const textOf = (sys: NumberSystem, slot: string, key: FormKey): string =>
  String((((sys.lexemes || {})[slot] || { forms: {} }).forms || {})[key] || "").trim();

const overrideText = (sys: NumberSystem, key: string): string =>
  String(((sys.overrides || {})[key] || { text: "" }).text || "").trim();

/** The slot three to nineteen keep their word before a noun in. */
const slotOf = (n: number): string => (n <= 10 ? `unit.${n}` : `teen.${n}`);

/**
 * Where a teacher wrote two different words before a noun for one number,
 * and has not yet said which of them they say.
 *
 * Until 0.321 three to nineteen had a box before a masculine noun and
 * another before a feminine one. Most teachers wrote one word twice, or
 * one box only, and those systems simply read as one word. One who wrote
 * two different words is asked which is theirs, and until they answer
 * their students are told exactly what they were told before — the second
 * word before a feminine noun. A correction written for one gender is the
 * same question about a whole number.
 */
export function twoWordsBeforeNoun(sys: NumberSystem): TwoWords[] {
  const out: TwoWords[] = [];
  for (let n = 3; n <= 19; n += 1) {
    const slot = slotOf(n);
    const m = textOf(sys, slot, "construct.m");
    const f = textOf(sys, slot, "construct.f");
    if (m && f && m !== f) out.push({ n, kind: "box", key: slot, masculine: m, feminine: f });
    const fo = overrideText(sys, `${n}|construct.f`);
    if (!fo) continue;
    const mo = overrideText(sys, `${n}|construct.m`) || overrideText(sys, String(n)) || m || f;
    if (fo !== mo) out.push({ n, kind: "correction", key: `${n}|construct.f`, masculine: mo, feminine: fo });
  }
  return out;
}

/**
 * The answer to one of those questions, as the system it leaves.
 *
 * Keeping either word leaves one: the box holds it and the feminine box is
 * emptied, with whatever was recorded for the word that went. A correction
 * kept for a feminine noun becomes the correction for every noun.
 */
export function keepOneWord(sys: NumberSystem, q: TwoWords, keep: "masculine" | "feminine"): NumberSystem {
  if (q.kind === "box") {
    const lex = (sys.lexemes || {})[q.key];
    if (!lex) return sys;
    /* The kept word goes into the one box with its own transliteration and
       recording, or with none — never with the other word's. */
    const settle = <T,>(rec: Partial<Record<FormKey, T>> | undefined): Partial<Record<FormKey, T>> | undefined => {
      if (!rec) return rec;
      const next = { ...rec };
      if (keep === "feminine") {
        if (rec["construct.f"] !== undefined) next["construct.m"] = rec["construct.f"];
        else delete next["construct.m"];
      }
      delete next["construct.f"];
      return next;
    };
    const lat = settle(lex.lat);
    const audio = settle(lex.audio);
    return {
      ...sys,
      lexemes: {
        ...sys.lexemes,
        [q.key]: {
          ...lex,
          forms: settle(lex.forms) || {},
          ...(lat ? { lat } : null),
          ...(audio ? { audio } : null),
        },
      },
      updated: Date.now(),
    };
  }
  const overrides = { ...(sys.overrides || {}) };
  const had = overrides[q.key];
  delete overrides[q.key];
  if (keep === "feminine" && had) overrides[`${q.n}|construct.m`] = had;
  return { ...sys, overrides, updated: Date.now() };
}

/**
 * A system with everything that is not a question folded into one box.
 *
 * Most systems written before 0.321 hold one word in both boxes, or a word
 * in the feminine box only. Both read as one word already (`beforeNoun`),
 * but left as they are the editor would show an empty box where a word is
 * in use, and a stale copy would turn into a question the moment the
 * teacher changed the box it copies. So the editor opens on this: the same
 * words, in the one box, and only two different words left to ask about.
 * The same object back where there is nothing to fold.
 */
export function tidyBeforeNoun(sys: NumberSystem): NumberSystem {
  let out = sys;
  for (let n = 3; n <= 19; n += 1) {
    const slot = slotOf(n);
    const m = textOf(out, slot, "construct.m");
    const f = textOf(out, slot, "construct.f");
    const has = (out.lexemes[slot] || { forms: {} }).forms || {};
    if ("construct.f" in has && (!f || !m || f === m)) {
      out = keepOneWord(out, { n, kind: "box", key: slot, masculine: m, feminine: f }, !m && f ? "feminine" : "masculine");
    }
    const key = `${n}|construct.f`;
    if (key in (out.overrides || {}) && overrideText(out, key) === overrideText(out, `${n}|construct.m`)) {
      out = keepOneWord(out, { n, kind: "correction", key, masculine: "", feminine: "" }, "masculine");
    }
  }
  return out;
}

/* ---- three hundred to nine hundred, written out before they had boxes ---- */

/**
 * A system with the hundreds a teacher wrote out moved into their boxes.
 *
 * Until 0.334 three hundred to nine hundred had no box, and a teacher
 * wrote each out under the samples, where it was kept as a number written
 * out by hand. The editor opens on this so those words are in the boxes
 * where the teacher now looks for them, with their transliteration and
 * recording, and `migratedFrom` names the card each was learnt on so a
 * learner's progress on it goes across — see handOn. A box that already
 * holds a word keeps it, and the written-out word stays the correction it
 * was. The same object back where there is nothing to move.
 */
export function tidyHundreds(sys: NumberSystem): NumberSystem {
  let out = sys;
  for (let k = 3; k <= 9; k += 1) {
    const key = String(k * 100);
    const slot = `hundred.${k}`;
    const over = (out.overrides || {})[key];
    const text = overrideText(out, key);
    if (!over || !text || textOf(out, slot, "standalone")) continue;
    const overrides = { ...out.overrides };
    delete overrides[key];
    const lat = String(over.lat || "").trim();
    const audio = over.audio && over.audio.length ? over.audio : (out.curatedAudio || {})[key];
    const curated = { ...(out.curatedAudio || {}) };
    delete curated[key];
    out = {
      ...out,
      lexemes: {
        ...out.lexemes,
        [slot]: {
          slot,
          forms: { standalone: text },
          ...(lat ? { lat: { standalone: lat } } : null),
          ...(audio && audio.length ? { audio: { standalone: audio } } : null),
        },
      },
      overrides,
      ...(out.curatedAudio ? { curatedAudio: curated } : null),
      migratedFrom: { ...(out.migratedFrom || {}), [slot]: overrideId(out.id, key) },
      updated: Date.now(),
    };
  }
  return out;
}

/* ---- composing ---- */

const genderKey = genderKeyOf;

/**
 * Whether gender is a question this number asks at all.
 *
 * One and two inflect and nothing else does, so 21 and 32 ask it of their
 * unit and 30 does not ask it at all. Said here once rather than at the
 * four places that would otherwise each have to remember.
 */
const inflects = (n: number): boolean => n === 1 || n === 2;

/**
 * The word three to nineteen take before a noun — one word, whatever the
 * noun's gender.
 *
 * Two readings of a system written before there was one box, and nothing
 * else: a word written only in the old box before a feminine noun is the
 * word, and a feminine word that differs from the masculine one is still
 * said before a feminine noun until its teacher picks — see TwoWords.
 */
function beforeNoun(b: Build, slot: string, gender: "m" | "f" | undefined): string {
  const sys = b.sys as NumberSystem;
  const m = textOf(sys, slot, "construct.m");
  const f = textOf(sys, slot, "construct.f");
  if (f && (!m || (gender === "f" && f !== m))) {
    b.tokens.push({ text: f, slot, formKey: "construct.f" });
    return f;
  }
  return b.word(slot, "construct.m");
}

/** Which face the whole rendering stands in, for looking up an override. */
function topKey(sys: NumberSystem, n: number, gender: "m" | "f" | undefined, counted: boolean): FormKey {
  if (counted && n >= 3 && n <= 19) {
    /* A correction a teacher wrote before a feminine noun is read for one
       until they say which of their two words they say. */
    return gender === "f" && overrideText(sys, `${n}|construct.f`) ? "construct.f" : "construct.m";
  }
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
    const k = hundreds / 100;
    if (written) pieces.push(written);
    else if (k <= 2 || b.has(`hundred.${k}`) || !b.has("hundred.n")) {
      /* The word of its own, which is how this dialect says every round
         hundred; and the box to fill where neither it nor the bare word
         for building it is written. */
      pieces.push(b.word(`hundred.${k}`, "standalone"));
    } else {
      /* Three hundred as two words, for a dialect that says it that way.
         The unit goes in front in its before-a-noun form, because a
         hundred is the noun it is counting. */
      const unit = beforeNoun(b, `unit.${hundreds / 100}`, undefined);
      const word = b.word("hundred.n", "standalone");
      pieces.push([unit, word].filter(Boolean).join(" "));
    }
  }

  if (tail) {
    const written = b.override(tail, topKey(b.sys as NumberSystem, tail, gender, false));
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
      pieces.push(join(b, [unit, ten]));
    }
  }

  return join(b, pieces);
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
    const said = beforeNoun(b, `unit.${count}`, undefined);
    const word = b.word(`${name}.n`, "standalone");
    return [said, word].filter(Boolean).join(" ");
  }
  const said = under1000(b, count, undefined);
  const word = b.word(`${name}.1`, "standalone");
  return [said, word].filter(Boolean).join(" ");
}

/** The numeral alone, in whichever face was asked for. */
function numeral(b: Build, n: number, gender: "m" | "f" | undefined, counted: boolean): string {
  const written = b.override(n, topKey(b.sys as NumberSystem, n, gender, counted));
  if (written) return written;

  if (counted && n >= 3 && n <= 19) return beforeNoun(b, slotOf(n), gender);
  /* Nought has no chunks to be built out of, so it is said before the
     building starts rather than falling through it and coming out empty. */
  if (n === 0) return b.word("unit.0", "standalone");

  const { millions, thousands, rest } = chunksOf(n);
  const pieces = [
    scale(b, millions, 1000000, "million"),
    scale(b, thousands, 1000, "thousand"),
    rest ? under1000(b, rest, gender) : "",
  ];
  return join(b, pieces);
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

/**
 * A number, in words, with whatever it is counting beside it.
 *
 * Total: out of range, an empty system and a slot nobody filled all come
 * back as a rendering with a warning on it. Nothing here throws, and
 * nothing deals a question out of a rendering that warned.
 */
export function renderAr(n: number, sys: NumberSystem, ctx: RenderCtx = {}): Rendering {
  const b = build(sys);
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
    const text = nounTextOf(b, noun, "dual");
    return { text, tokens: b.tokens, nounForm: "dual", warnings: b.warnings };
  }

  const said = numeral(b, n, gender, true);
  /* The few nouns with a plural of their own after three to ten — *tiyyām*
     for days — say it here and nowhere else. The rest say their plural. */
  const counted = n >= 3 && n <= 10 ? String(noun.plCounted || "").trim() : "";
  if (counted) b.tokens.push({ text: counted, noun: noun.id });
  const word = counted || nounTextOf(b, noun, form);
  /* One follows its noun; everything else leads. */
  const text = (n === 1 ? [word, said] : [said, word]).filter(Boolean).join(" ");
  return { text, tokens: b.tokens, nounForm: form, warnings: b.warnings };
}

/**
 * An old number card, as faces.
 *
 * The card's own word was the one you count with, and the single cell the
 * old table had was the form that goes with a feminine word. The forms
 * that go directly before a noun were never asked for — nothing in the
 * app could say them — so they come across empty, and the editor shows
 * them as the gaps they are rather than guessing.
 */
export const liftArCard = (old: { word: string; cells: Record<string, string> }) => {
  const word = String(old.word || "").trim();
  const feminine = String(old.cells.feminine || "").trim();
  return {
    ...(word ? { standalone: word, m: word } : null),
    ...(feminine ? { f: feminine } : null),
  };
};

export const arComposer: Composer = {
  id: "ar-PS",
  version: AR_COMPOSER_VERSION,
  requiredSlots: () => AR_SLOTS,
  twoWords: twoWordsBeforeNoun,
  keepOne: keepOneWord,
  tidy: (sys) => tidyHundreds(tidyBeforeNoun(sys)),
  liftCard: liftArCard,
  table: () => AR_NUMBER_TABLE,
  ranges: () => AR_RANGES,
  render: renderAr,
};
