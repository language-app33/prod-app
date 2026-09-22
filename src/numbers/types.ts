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
export type FormKey = "standalone" | "m" | "f" | "construct.m" | "construct.f";

export const FORM_KEYS: FormKey[] = ["standalone", "m", "f", "construct.m", "construct.f"];

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
  /** A transliteration per form, where the teacher gave one. Not composed
      into a number yet — see the backlog. */
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
  /** What it means, where the teacher wants it said in words. */
  en?: string;
  audio?: string[];
}

/** A part of the day, over hours of the 24-hour clock. */
export interface Period {
  slot: string;
  text: string;
  en?: string;
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
export interface Composer {
  id: LangId;
  version: number;
  requiredSlots(): SlotSpec[];
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

/* ---- the ceiling ---- */

/**
 * The largest number anything here will reach for.
 *
 * Above this is not a language's problem but a typing one, and no
 * exercise is improved by eight digits. It was the ceiling before this
 * directory existed and it is unchanged.
 */
export const NUMBER_CEILING = 9999999;
