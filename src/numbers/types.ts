/*
 * What a number system is, and what a composer is asked.
 *
 * The split this directory exists for: **the words are data and the
 * joining is code.** A teacher writes down the words their language builds
 * its numbers out of — one box per slot, one box per form a slot takes in
 * company — and a composer written here puts them together. There is no
 * rule language for a teacher to learn, and no list of nine million
 * numbers for anyone to type.
 *
 * Which means the one thing no file in this directory may hold is a word.
 * A composer knows slot names, an order and a join; the words come from
 * the system it is handed or from a golden table a speaker signed. That is
 * checkable, and tests/language-isolation.test.mjs checks it: the first
 * Arabic or Hebrew letter under src/numbers/ fails the build.
 *
 * Pure: no React, no storage, no clock, no randomness. A composer is
 * *total* — out of range, an empty system, a slot the teacher never filled
 * are all a rendering with a warning on it, never an exception. A number
 * system is somebody's work, and half of it read is worth more to them
 * than a broken screen.
 */
import type { LangId, Millis, VerbSpec } from "../types.ts";

/* ---- the words ---- */

/**
 * Which face of a word is wanted.
 *
 * Named for **what the word stands with**, not for what it looks like, so
 * a box says where its word goes and nobody has to agree about what to
 * call the shape of it. Which faces a slot offers, and what each box is
 * labelled, is each language's own: Hebrew's three to ten change with the
 * noun's gender, Palestinian Arabic's do not, and `construct.m` is the one
 * word before any noun there — see `SlotSpec.faceLabels`.
 */
export type FormKey = "standalone" | "m" | "f" | "construct.m" | "construct.f" | "company";

export const FORM_KEYS: FormKey[] = [
  "standalone",
  "m",
  "f",
  "construct.m",
  "construct.f",
  /*
   * The face a word wears inside a bigger number for no grammatical
   * reason at all.
   *
   * Huế is why this exists and not Arabic: *five* is one word on its own
   * and another after a ten, *one* is one word on its own and another
   * after two tens, and *nought* has a form that means "the place here is
   * empty" — a hundred, nothing, and five. None of that is gender or
   * construct state; it is a word changing shape in company, which is a
   * thing a language may do and no axis this app already had could hold.
   */
  "company",
];

/** The three faces of a counted noun a numeral may call for. */
export type NounForm = "sg" | "dual" | "pl";

/**
 * One slot's words: what the teacher typed, and what was recorded for it.
 *
 * `forms` is partial on purpose. A slot whose language has one face has
 * one box; a box nobody filled reads as absent and the composer falls
 * back through `m` to `standalone`, saying so in a warning rather than
 * inventing a word.
 */
export interface Lexeme {
  slot: string;
  forms: Partial<Record<FormKey, string>>;
  /**
   * How each form sounds, where the teacher wrote it down.
   *
   * It goes onto the card this word becomes, beside the script, exactly
   * as a transliteration does on a card somebody typed — so a learner
   * meets the pronunciation, and the exercise that asks for the script
   * from its transliteration opens. A whole number's is read along its
   * rendered text for the answer screen — see `sayAlong` — but it is not
   * marked against, so no range asks for the script from it. That is on
   * the backlog; a number the teacher wrote out has its own.
   */
  lat?: Partial<Record<FormKey, string>>;
  /** Clip hashes per form, as a card's form holds them. */
  audio?: Partial<Record<FormKey, string[]>>;
}

/**
 * A noun the agreement exercise counts.
 *
 * Read off the teacher's own noun cards — see nouns.ts — since 0.316: a
 * noun's answers can say singular, plural and dual, which was the one
 * thing that kept them out. The list a system used to carry of its own is
 * gone, and a system's `nouns` is filled in from the cards wherever it is
 * rendered rather than stored. The clock's word for *minute* is still one
 * of these, written on the clock, because it is not a card anybody keeps.
 */
export interface CountedNoun {
  id: string;
  sg: string;
  dual?: string;
  pl: string;
  gender: "m" | "f";
  en: string;
  /** The English of the plural, where the card says it — *children*,
      which no rule makes out of *child*. */
  enPl?: string;
  /**
   * The plural as it is said after three to ten, where that is not the
   * plural itself.
   *
   * A handful of Palestinian nouns — days, months — take a *t* there that
   * they have nowhere else: *khams tiyyām*, five days, beside *ayyām*.
   * It belongs to the noun, so it is written on the noun's own card, and
   * a noun without one is counted with its plural as every other noun is.
   */
  plCounted?: string;
  /** Whether it is a person or a thing, as the card says, so what stands
      beside a counted phrase in a sentence agrees with it. */
  human?: string;
}

/** What a teacher may hand-correct: one number, or one number in one
    face of it. Keyed "300" or "3|construct.f". */
export interface Override {
  text: string;
  lat?: string;
  audio?: string[];
}

export type AudioPolicy = "components";

/**
 * A language's numbers, as one teacher wrote them.
 *
 * One document per teacher per language, stored and delivered the way a
 * card that fills a blank is: in no deck, sent with every course of its
 * language, its revision folded into the material version so a change
 * reaches a student without anything else having to move.
 */
export interface NumberSystem {
  id: string;
  owner: string;
  languageId: LangId;
  /** The composer this was last checked against. A bump marks every
      override as worth re-reading, and changes nothing by itself. */
  composerVersion: number;
  lexemes: Record<string, Lexeme>;
  overrides: Record<string, Override>;
  nouns: CountedNoun[];
  audioPolicy: AudioPolicy;
  /** A recording for a whole number the composer would otherwise build
      out of parts — keyed like an override. */
  curatedAudio?: Record<string, string[]>;
  /** Which cards this system was seeded from, by slot or override key.
      Written once by the migration and read by a device deciding whose
      progress a component card inherits. */
  migratedFrom?: Record<string, string>;
  rev: number;
  created: Millis;
  updated: Millis;
}

/* ---- times ---- */

/**
 * What is said for one five-minute mark.
 *
 * `refHour` is the whole of why a time is not just two numbers: a quarter
 * *to* eight is said with eight in it and happens at seven, so the hour
 * the numeral renders is not the hour the clock shows. The period is
 * picked from the hour the clock shows, which is what keeps a quarter to
 * one in the afternoon out of the morning.
 */
export interface MinuteExpr {
  text: string;
  refHour: "same" | "next";
  /**
   * Whether it is said in front of the hour rather than after it.
   *
   * A fact about the words and not about the clock, which is why it is
   * written beside the expression rather than decided in code: one
   * language says *the hour three, less a quarter* and another says *a
   * quarter to three*, and both are counting back from the same hour.
   * Absent means after, which is what every expression written before
   * this was.
   */
  lead?: boolean;
  /** What it means, where the teacher wants it said in words. */
  en?: string;
  /** And how it sounds, which goes onto the card it becomes. */
  lat?: string;
  audio?: string[];
}

/** A part of the day, over hours of the 24-hour clock. */
export interface Period {
  slot: string;
  text: string;
  en?: string;
  /** How it sounds, which goes onto the card it becomes. */
  lat?: string;
  fromHour: number;
  toHour: number;
  audio?: string[];
}

/** The marks a colloquial time is rounded to. */
export const MINUTE_MARKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export interface TimeSystem {
  id: string;
  owner: string;
  languageId: LangId;
  /** The numbers this reads its hours and minutes from. */
  numberSystemId: string;
  composerVersion: number;
  /** `hour.word`, `connector.past`, `connector.to`. */
  lexemes: Record<string, Lexeme>;
  /**
   * The word for *minute*, as a thing that gets counted.
   *
   * A counted noun rather than a lexeme, and that is the whole of decision
   * four: the exact style says its minutes by handing this to the number
   * composer, so one minute, two minutes and five minutes come out right
   * for the same reason one book, two books and five books do, and this
   * module has no agreement in it to get wrong.
   */
  minuteNoun: CountedNoun;
  minuteExprs: Record<string, MinuteExpr>;
  periods: Period[];
  clock: "12h" | "24h";
  /** Keyed "07:45" or "07:45|exact". */
  overrides: Record<string, Override>;
  audioPolicy: AudioPolicy;
  curatedAudio?: Record<string, string[]>;
  rev: number;
  created: Millis;
  updated: Millis;
}

/* ---- what a composer answers ---- */

/**
 * One piece of a rendering, and where it came from.
 *
 * Every token names its lexeme or its override, which is what lets a right
 * answer credit the cards the words are on — the same crediting a sentence
 * does for the words that filled its blanks — and what lets a property
 * test assert that nothing was invented.
 */
export interface Token {
  text: string;
  slot?: string;
  formKey?: FormKey;
  /** The override key this came from, where one did. */
  override?: string;
  /** A noun standing in a counted phrase, which is the system's and not a
      lexeme's. */
  noun?: string;
}

export type WarningCode =
  | "missing-slot"
  | "missing-form"
  | "missing-noun-form"
  | "rounded"
  | "out-of-range"
  | "no-minute-expression"
  | "no-number-system";

/** Something the rendering could not do properly, said in a way the
    editor can put under the box that would fix it. */
export interface Warning {
  code: WarningCode;
  slot?: string;
  formKey?: FormKey;
  detail?: string;
}

export interface Rendering {
  text: string;
  tokens: Token[];
  /** Which face of the counted noun this numeral called for, where one
      was counted. */
  nounForm?: NounForm;
  warnings: Warning[];
}

/** What agreement the rendering has to make. */
export interface RenderCtx {
  /** An unnamed referent's gender — the hour, which is feminine wherever
      the word for *hour* is. */
  gender?: "m" | "f";
  /** A noun actually being counted, which also decides the word order. */
  noun?: CountedNoun;
}

/** One box on the teacher's grid. */
export interface SlotSpec {
  slot: string;
  formKeys: FormKey[];
  label: string;
  hint?: string;
  /** What a box is called where this language calls it something other
      than the shared name — Arabic's one word before a noun, which is
      stored as `construct.m` and is not about masculine nouns at all. */
  faceLabels?: Partial<Record<FormKey, string>>;
  group: string;
  /** A slot the composer can compose around — `hundred.n` where every
      hundred is written out as an override. Its absence is not a gap. */
  optional?: boolean;
}

/**
 * A stretch of what can be asked, and the unit the scheduler deals.
 *
 * A range is not a classification of numbers; it is a thing a learner
 * gets better at. Which is why *telling the time to the exact minute* is
 * a range beside *0 to 9*: each is a skill with its own schedule, opened
 * only once everything it needs can be rendered. Counting a noun is a
 * question a stretch asks, not a range — see `counts`.
 */
export interface Range {
  id: string;
  kind: "numbers" | "time";
  label: string;
  /** For numbers, the ends of the stretch. For a time range, the hours. */
  from: number;
  to: number;
  /** Whether its questions count a noun. Set on the view of a stretch
      the counting question is asked from — see `countingOf` — and on
      nothing that is stored. */
  counted?: boolean;
  /** Whether a stretch is counted with too: *3 books* as well as *3*.
      Each language says so, because a language with nothing to agree has
      nothing to ask. */
  counts?: boolean;
  /** For a time range: which minute marks it draws from. */
  marks?: number[];
  style?: TimeStyle;
  period?: boolean;
  /** The part this one was split out of, where it was: what carries a
      learner's progress, a deck's choice of parts and a sentence's blank
      across the split. See `partsNow`, `partTags` and `handOnSplit`. */
  was?: string;
}

/**
 * How one language puts its numbers together.
 *
 * `render` is the whole of it. Everything else says what the teacher is
 * asked for and how the forms lay out as a card's cells.
 */
/**
 * A number card as the app stored one before systems existed.
 *
 * The card's own word, and whatever named cells the old `counted` table
 * carried beside it. Handed to a composer because how those map onto the
 * faces a system holds is a fact about the language and nothing else:
 * Arabic kept the counting form on the card and the feminine in a cell,
 * and Hebrew kept the *masculine* on the card and the form you count with
 * in the cell. Reading both the same way would have turned every Hebrew
 * number round.
 */
export interface OldCard {
  word: string;
  cells: Record<string, string>;
}

/**
 * A box that used to be two, where its teacher wrote a different word in
 * each and has not yet said which of them is theirs.
 *
 * Arabic's three to nineteen had a word before a masculine noun and
 * another before a feminine one until 0.321, when they became one word.
 * `kind` says whether the two are a box's words or a correction written
 * for one of the genders.
 */
export interface TwoWords {
  n: number;
  kind: "box" | "correction";
  /** The slot, or the correction's key, the question is about. */
  key: string;
  /** What is said before a masculine noun now — the word kept if nobody
      says otherwise. */
  masculine: string;
  /** What was written for a feminine noun. */
  feminine: string;
}

export interface Composer {
  id: LangId;
  version: number;
  requiredSlots(): SlotSpec[];
  /** Where a system written before this composer's boxes were merged holds
      two words for one box — see TwoWords. Absent where none ever were. */
  twoWords?(sys: NumberSystem): TwoWords[];
  /** The answer to one of them, as the system it leaves. */
  keepOne?(sys: NumberSystem, q: TwoWords, keep: "masculine" | "feminine"): NumberSystem;
  /** The system with whatever is not a question folded into the boxes it
      has now — what the editor opens on. The same object where nothing
      needed folding. */
  tidy?(sys: NumberSystem): NumberSystem;
  /** What one of those becomes, in this language. */
  liftCard(old: OldCard): Partial<Record<FormKey, string>>;
  /** How a lexeme's forms sit as cells of a component card's table. */
  table(): VerbSpec;
  ranges(): Range[];
  render(n: number, sys: NumberSystem, ctx?: RenderCtx): Rendering;
}

export type TimeStyle = "colloquial" | "exact";

export interface TimeCtx {
  style: TimeStyle;
  /** Whether to say which part of the day it is. */
  period?: boolean;
}

export interface TimeRendering extends Rendering {
  /** The hour actually said, on the 12-hour clock. */
  hour12: number;
  /** The minute mark looked up, where the colloquial style used one. */
  minuteMark?: number;
  period?: string;
  /**
   * The recordings to play, in order.
   *
   * The one place two clips are joined: a time may be its hour and its
   * minute expression said one after the other. Nothing inside a *number*
   * is ever stitched, because the joins are where a dialect lives.
   */
  clips?: string[][];
}

export interface TimeComposer {
  id: LangId;
  version: number;
  requiredSlots(): SlotSpec[];
  ranges(): Range[];
  renderTime(
    h: number,
    m: number,
    time: TimeSystem,
    numbers: NumberSystem | null,
    ctx: TimeCtx,
  ): TimeRendering;
}

/**
 * What one asking of a range is about.
 *
 * Everything needed to render it again, so a retry is the same question.
 * Declared here rather than beside the sampler because a card's queue
 * entry carries one and the shapes a record can hold live together.
 */
export interface Ask {
  rangeId: string;
  kind: "numbers" | "time";
  value: number;
  minute?: number;
  nounId?: string;
  style?: TimeStyle;
  period?: boolean;
}

/* ---- the ceiling ---- */

/**
 * The largest number anything here will reach for: eleven digits.
 *
 * It was seven, from before this directory existed, until a teacher
 * checking a number typed nine digits and was answered for the first
 * seven of them. Eleven is what the owner asked for in 0.390 — the
 * billions, which every language here has one more word for, and no
 * further.
 */
export const NUMBER_CEILING = 99999999999;

/*
 * The stretches of the number line, the same in every language.
 *
 * They were four — 0 to 10, 11 to 99, 100 to 999 and over a thousand —
 * and the first two are now three: a learner's first sitting is the
 * digits, the teens are a pattern of their own in every language here,
 * and 20 to 99 is the tens and the joining word. Ten went with the teens
 * because it is the first number with two figures, and where a language
 * builds its teens on it (Hebrew, Vietnamese) it is where they start. The
 * two old parts are named in `was`, so nothing anybody had on them is lost.
 *
 * The billions are a part of their own rather than the top of the
 * thousands, because they need a word no system had before 0.390: a part
 * opens only when everything in it can be said, and the thousands
 * reaching to the ceiling would have closed for every language until its
 * teacher wrote *billion*. Up to 999,999,999 is said with the words for
 * a million and below, so the thousands stay as open as they were.
 */
export const NUMBER_RANGES: Range[] = [
  { id: "numbers:0-9", kind: "numbers", label: "Numbers 0 to 9", from: 0, to: 9, was: "numbers:0-10" },
  { id: "numbers:10-19", kind: "numbers", label: "Numbers 10 to 19", from: 10, to: 19, was: "numbers:11-99" },
  { id: "numbers:20-99", kind: "numbers", label: "Numbers 20 to 99", from: 20, to: 99, was: "numbers:11-99" },
  { id: "numbers:100-999", kind: "numbers", label: "Numbers 100 to 999", from: 100, to: 999 },
  { id: "numbers:1000+", kind: "numbers", label: "Numbers 1,000 to 999,999,999", from: 1000, to: 999999999 },
  {
    id: "numbers:1000000000+",
    kind: "numbers",
    label: "Numbers 1,000,000,000 and over",
    from: 1000000000,
    to: NUMBER_CEILING,
  },
];

/**
 * The tag a stretch answers to in a sentence: its own two ends, or its
 * bottom and `-plus` where it is the open one at the top.
 *
 * Read off the ends rather than the id, because the id of 1,000 to
 * 999,999,999 is still `numbers:1000+` from when it was the top: written
 * the old way, its tag and the run of it with the billions above would
 * both have been `1000-plus`, and the name would not say which a sentence
 * meant. `1000-plus` is the run — 1,000 to the top, which is what it
 * meant when it was written. A part no longer in the list, which only a
 * `was` names, keeps the tag it had.
 */
export function stretchTag(id: string): string {
  const range = NUMBER_RANGES.find((r) => r.id === id);
  if (!range) return id.replace(/^numbers:/, "").replace(/\+$/, "-plus");
  return range.to >= NUMBER_CEILING ? `${range.from}-plus` : `${range.from}-${range.to}`;
}

/*
 * Counting things, inside the stretches rather than beside them.
 *
 * It was three parts of its own — 1 and 2, 3 to 10, 11 to 20 — drawn
 * where the counted word changes shape. A teacher thinks of numbers in
 * stretches and of counting as one more thing to know about each number,
 * so a stretch is counted with now, and the counting question is one of
 * its questions: at the top of its ladder, beside writing the number out,
 * and only once the teacher's noun cards can be counted across all of it.
 * See DECISIONS.md, "Counting is a question a stretch asks".
 */
export const COUNTING_STRETCHES: Range[] = NUMBER_RANGES.map((r) => ({ ...r, counts: true }));

/**
 * The view of a stretch a counting question is asked from: the same
 * stretch, from one rather than nought — nobody counts nought books — and
 * marked as counting, which is what every draw, probe and filler reads.
 */
export const countingOf = (range: Range): Range => ({ ...range, from: Math.max(1, range.from), counted: true });

/** The three counting parts there used to be, and the stretch each one
    went into: the one that holds most of its numbers. */
export const MERGED_INTO: Record<string, string> = {
  "numbers:count-1-2": "numbers:0-9",
  "numbers:count-3-10": "numbers:0-9",
  "numbers:count-11-20": "numbers:10-19",
};

/**
 * Where a stretch's counting question finds what a learner had earned on
 * the counting parts it replaced, best first: the part holding most of
 * its numbers, then the one counting range there was before those.
 */
export const COUNTING_WAS: Record<string, string[]> = {
  "numbers:0-9": ["numbers:count-3-10", "numbers:count-1-2", "numbers:agreement"],
  "numbers:10-19": ["numbers:count-11-20", "numbers:agreement"],
};

/**
 * A deck's parts as the parts there are now.
 *
 * A deck stores the parts it holds by id, and a deck that held 11 to 99
 * before the split holds an id no part has any more. Read through this,
 * it holds every part that came out of it — 10 to 19 and 20 to 99 —
 * which is what the teacher chose. A counting part reads as the stretch
 * it went into; anything else is left as it is.
 */
export function partsNow(parts: string[]): string[] {
  const out: string[] = [];
  for (const id of parts) {
    const into = MERGED_INTO[id] ? [MERGED_INTO[id]] : NUMBER_RANGES.filter((r) => r.was === id).map((r) => r.id);
    for (const now of into.length ? into : [id]) if (!out.includes(now)) out.push(now);
  }
  return out;
}
