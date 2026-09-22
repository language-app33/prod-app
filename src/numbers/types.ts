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
 * Named for **what the word stands with**, not for what it looks like.
 * That matters in Arabic, where the numeral that goes before a masculine
 * noun is the one that looks feminine: a teacher filling a box labelled
 * "before a masculine noun" writes the right word without anyone having
 * to agree about what to call it, and the reversed polarity of three to
 * ten is written down rather than known — the same bargain the `counted`
 * table struck before this.
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
   * from its transliteration opens. It is **not** joined into a whole
   * number: where the pieces sit against each other is a fact about the
   * script that the tokens do not carry, and a joined-up romanisation
   * would be wrong wherever a one-letter connector attaches. That is on
   * the backlog; a number the teacher wrote out has its own.
   */
  lat?: Partial<Record<FormKey, string>>;
  /** Clip hashes per form, as a card's form holds them. */
  audio?: Partial<Record<FormKey, string[]>>;
}

/**
 * A noun the agreement exercise counts.
 *
 * Here rather than read off the teacher's noun cards because no card
 * carries a dual: the grammar axis this app declares is singular, plural
 * or neither. Reading real cards waits on that axis gaining a dual, which
 * is append-only work and on the backlog; until then the handful of nouns
 * an exercise needs are written where the numbers are.
 */
export interface CountedNoun {
  id: string;
  sg: string;
  dual?: string;
  pl: string;
  gender: "m" | "f";
  en: string;
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
  group: string;
  /** A slot the composer can compose around — `hundred.n` where every
      hundred is written out as an override. Its absence is not a gap. */
  optional?: boolean;
}

/**
 * A stretch of what can be asked, and the unit the scheduler deals.
 *
 * A range is not a classification of numbers; it is a thing a learner
 * gets better at. Which is why *counting nouns* and *telling the time to
 * the exact minute* are ranges beside *0 to 10*: each is a skill with its
 * own schedule, opened only once everything it needs can be rendered.
 */
export interface Range {
  id: string;
  kind: "numbers" | "time";
  label: string;
  /** For numbers, the ends of the stretch. For a time range, the hours. */
  from: number;
  to: number;
  /** Whether its questions count a noun. */
  counted?: boolean;
  /** For a time range: which minute marks it draws from. */
  marks?: number[];
  style?: TimeStyle;
  period?: boolean;
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

export interface Composer {
  id: LangId;
  version: number;
  requiredSlots(): SlotSpec[];
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
 * The largest number anything here will reach for.
 *
 * Above this is not a language's problem but a typing one, and no
 * exercise is improved by eight digits. It was the ceiling before this
 * directory existed and it is unchanged.
 */
export const NUMBER_CEILING = 9999999;
