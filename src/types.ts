/*
 * The records the app and the server pass between them.
 *
 * Types only: this module has no runtime value and compiles to nothing.
 * It exists so that the two sides of every request describe the same
 * thing. Before it, each side knew the shape of a card only by having
 * been written next to code that made one, which is how a language pack
 * came to be sent where a language id was wanted — the app was happy to
 * send it and the server was happy to receive it.
 *
 * These describe what is actually stored, not what would be tidy. Where a
 * field is optional it is because records written by an older build do
 * not have it, and the readers all cope; saying so here is what stops a
 * reader being written that does not.
 *
 * A TypeScript file imports them the ordinary way:
 *
 *     import type { Card, Flag } from "./types.ts";
 *
 * and one still written in JavaScript says the same thing in a comment:
 *
 *     \@import { Card, Flag } from "./types.ts"
 */

/*
 * The one shape this file borrows rather than declaring.
 *
 * A skill is a stretch of what a language's numbers and clock can be
 * asked over, and it is declared beside the composers that answer for it.
 * Aliased on the way in because the browser has a `Range` of its own and
 * the two would be told apart by nothing but where you were standing.
 */
import type { Range as SkillRange } from "./numbers/types.ts";
export type { SkillRange };

/**
 * A language's id — "ar-PS", "vi-Hue". The key into LANGUAGES, and what is
 * stored on a card, a course and a report.
 *
 * Not the language pack itself. The two are easy to confuse and the
 * confusion is invisible at a glance, because a pack has an `id` and reads
 * perfectly well right up until it is sent somewhere expecting the string.
 */
export type LangId = string;

/** Milliseconds since the epoch, as Date.now() gives them. */
export type Millis = number;

/* ---- exercises and grammar ---- */

/**
 * One exercise type: what it shows, what it asks for, and what a card must
 * carry for it to be askable at all. The registry everything derives from —
 * which states a card keeps, what a session may pick, what the settings
 * list — so retiring a type is one edit.
 */
export interface ExerciseSpec {
  instruction: string;
  /** May contain {Script}/{translit} placeholders. */
  label: string;
  short: string;
  /** Fields a card must have for this to be asked. */
  needs: string[];
  question: string;
  placeholder: string;
  /** "audio" marks the listening exercises. */
  promptField: string;
  answerField: string;
  answerMode: string;
  hintField?: string;
  hintLabel?: string;
  hintHideLabel?: string;
  /**
   * Whether the hint is the answer by another route — the transliteration
   * of the very word being asked for, rather than a nudge towards it. Such
   * a hint is never opened by itself, however the setting reads, and an
   * answer written with it up is marked as a near miss: it is the question
   * one level down, and counting it as the question asked was how writing
   * from the meaning came to be graduated by people who had only ever read
   * the word off the screen.
   */
  hintTells?: boolean;
  /** Recognition rather than production. */
  gentle?: boolean;
  /**
   * Where it stands on the ladder a form climbs: 1 recognises the word on
   * its own, 2 tells it apart from others, 3 produces it from a cue, 4
   * produces it from its meaning alone. A level opens only once every
   * exercise below it that the form supports has reached the level's bar —
   * see openTypes in the scheduler.
   */
  level: 1 | 2 | 3 | 4;
  /*
   * There is no bar here. It belongs to the level rather than to the
   * exercise — 0.103 said so in a comment and still wrote it out on each
   * of the nine exercises that share one, with a test to hold them in
   * step — so it is now declared once per level, in LEVEL_BARS in
   * languages.ts, and `barOf` reads it off the level an exercise stands
   * on. Nothing can disagree with anything.
   */
  /** Still defined so stored states can be read. */
  retired?: boolean;
  /** Asks a derived property rather than the word. */
  quizAttr?: boolean;
  /**
   * Asked of a whole scene, or of one line of one. Anything without it is
   * asked of an ordinary word or form, and the three never mix.
   */
  dialog?: "card" | "line";
  /**
   * Met rather than answered: never scheduled, never marked, and not in
   * TYPES.
   */
  intro?: boolean;
  /**
   * What the few answers offered are: a line of the conversation, a word —
   * one that could fill a gap, or the one a meaning belongs to — a meaning
   * for the word on screen, or the meanings of a whole grid of words.
   * Absent means a choice between classes of sound, which is graded
   * differently.
   */
  picks?: "reply" | "word" | "meaning" | "pair";
}

/* ---- a verb's table ----

   The two axes a verb's forms are laid out on. Which of them exist, what
   they are called and what order they are taught in is the language pack's
   answer and never the app's: Arabic declares eight persons and three
   tenses, Huế one person and four, and a language whose verbs do not vary
   declares no table at all. Nothing outside the pack knows what a tense
   is — only that a table has rows and columns and that a cell is one thing
   to learn. See src/verbs.ts. */

/**
 * One column: who is doing it.
 *
 * `picks` is what makes a verb agree with whatever fills a sentence. A
 * column naming the grammar values a subject must carry — singular and
 * feminine for *she* — is chosen when a filler carries them, so
 * "{{name}} [verb] {{object}}" filled with Sarah asks for the *she* form
 * without anything being added to Sarah. A column with no `picks` is never
 * chosen that way, which is right for *I*, *you* and *we*: no noun dropped
 * into a subject is ever the first or second person.
 */
export interface VerbPerson {
  id: string;
  /** What the learner is shown — "she", "you (f)". "" where none is wanted. */
  label: string;
  /**
   * The grammar values on a filler that call for this column — one set,
   * or several where more than one kind of filler does. Arabic's feminine
   * adjective is called for by a feminine singular noun *and* by a plural
   * of things, which no single set of values names; each alternative is
   * matched on its own, and the most specific match across every column
   * wins.
   */
  picks?: Record<string, string> | Record<string, string>[];
}

/** One row: when it happened, or what mood it is in. */
export interface VerbTense {
  id: string;
  label: string;
}

/**
 * A table of a word's forms: its columns, and its rows in teaching order.
 *
 * Named for the verb's, which was the first, and the shape has stayed the
 * verb's: rows and columns, and a cell is one thing to learn. A language
 * declares as many as it lays out — see `tables` on the pack — and every
 * reader takes the table it is handed rather than asking which one it is.
 * Three facts a table carries about itself beyond its axes are below.
 */
export interface VerbSpec {
  persons: VerbPerson[];
  tenses: VerbTense[];
  /**
   * What its cells wait on before they are asked.
   *
   * `rows`: one row is ever new at a time, the next opening when the one
   * above it is mastered — a verb's tenses, which are not as hard as each
   * other. `word`: every cell waits on the word it is a form of being
   * known, and once that word is learnt each cell is asked one exercise a
   * level rather than all of them — the pronouns on the end of a word, the
   * feminine of an adjective. Absent reads as `word`, which is the rule
   * every one-row table has followed since there was one.
   */
  gate?: "rows" | "word";
  /**
   * Whether every form of the card carries one, or the card does.
   *
   * The plural takes the same pronouns the singular does and has eight of
   * its own, so that table hangs off each form. A verb's table, and an
   * adjective's feminine and plural, belong to the card: there is one of
   * them, and the card is the word. Absent means the card's.
   */
  perForm?: boolean;
  /** What to call it to a teacher — "attached pronouns", "feminine and
      plural". Absent on the verb's, which is called by its rows. */
  label?: string;
  /**
   * What the card's own word is, where the cells are the other shapes of
   * it: an adjective's word is the masculine, and the table holds the
   * feminine, the plural and the dual.
   *
   * Said so the word can be named alongside them instead of being the one
   * with no name. It was "Form 1" and then "The main form", and both are
   * the app talking about its own screen — beside three boxes called
   * feminine, plural and dual, the honest fourth name is the fourth shape.
   * Which shape that is, is the language's answer and not the app's.
   *
   * Absent where the cells are not shapes of the word: the pronouns on the
   * end of it are a different word each, and a verb says which cell a
   * dictionary lists it under with `citation` instead.
   */
  base?: string;
  /**
   * Which cell of the table is the verb as a dictionary names it.
   *
   * Arabic has no infinitive: *to eat* is listed under أكل, which is the
   * he-past form and so a cell of this very table. Without saying so, a
   * card's own word and that cell are the same word drilled twice —
   * asked, marked and scheduled as if they were two things to learn.
   *
   * Naming it says they are one. The card's word keeps its face and its
   * dictionary meaning, and the cell is what is practised.
   *
   * Absent where the language has a form of its own for the purpose: Huế
   * cites the bare verb, which is a card's word and not a cell, and
   * English would cite an infinitive. There is nothing to reconcile in
   * either, and nothing changes for them.
   */
  citation?: { row: string; col: string };
}

/**
 * One thing a word can be: a noun, a verb, a name.
 *
 * What a card is was guessed until 0.137 — a verb if its table had
 * anything in it, a word if its text was short — and the guessing is what
 * let a saved card open as something it was not. The teacher says it now,
 * once, and the editor follows: which table it is offered, and (later)
 * which blank in somebody else's sentence it can stand in.
 *
 * Which categories exist is the language pack's answer, like everything
 * else about a language. `table` names one the pack declares — a noun
 * takes the pronouns on its end, a verb has its persons and tenses — and
 * a category naming a table the pack has not got simply has none.
 */
export interface WordCategory {
  id: string;
  /** What the teacher is shown — "Noun". */
  label: string;
  /** The line under it saying what it means. */
  note: string;
  /** The table it lays out, by the name the pack declares it under. */
  table?: string;
  /**
   * No longer offered, but still read.
   *
   * A kind of word the app has stopped asking about keeps its definition
   * so that a card saved while it was offered goes on saying what it is —
   * on the screen, in an export and in storage — rather than becoming a
   * card of no kind at all. It is left out of the radio and out of
   * anything that reads a card's shape from the kinds a pack declares.
   */
  retired?: boolean;
  /**
   * Which grammar axes a word of this kind is asked about, of the ones
   * the pack declares — a preposition has neither number nor gender, a
   * name has both because the verb beside it reads them. Absent means
   * every axis the pack has, which is what every kind was asked until
   * 0.140. Display and editing only: what is stored is never narrowed by
   * this, so a value written before it existed is kept.
   */
  grammar?: string[];
}

/** A grammatical axis a word varies along — number, gender, addressee. */
export interface GrammarDim {
  label: string;
  field: string;
  required: boolean;
  /**
   * What answering it is for, in the words a teacher would want before
   * they answer rather than after. An axis that tells a card's forms
   * apart needs none — a reader picking between "sg." and "pl." knows
   * what they are doing — so this is for the ones that decide what
   * happens somewhere else on some other card.
   */
  help?: string;
  /** [stored value, what to show]. */
  options: [string, string][];
  /**
   * How a value reads on a form's tag — "sg.", "f." — where it reads at
   * all. A value mapped to "" is deliberately silent: N/A names nothing,
   * and whether a noun is a person or a thing decides what agrees with it
   * without being a way of telling its forms apart. Absent means the
   * option's own label.
   */
  short?: Record<string, string>;
  /**
   * How a value reads where the picker is too narrow for its name —
   * "sg.", "m.". Never silent, unlike `short`: a row of radios with a
   * blank beside one of them is a choice nobody can make. Absent means
   * the option's own label, which is what a value short enough to stand
   * as it is wants.
   */
  brief?: Record<string, string>;
  /** What a new or unreadable value becomes. */
  default?: string;
  /**
   * Whether the axis is a fact about the card rather than about one of its
   * accepted answers.
   *
   * Most of them are about the answer: two spellings may be a masculine
   * and a feminine, which is why grammar moved onto the answer at all. One
   * is not — whether a noun is a person or a thing is as true of its plural
   * as of its singular, and of both its spellings — and asking it of every
   * answer is asking a card to disagree with itself about something it
   * cannot disagree about. Asked once, beside the kind of word; stored on
   * every form, which is where the agreement rules read it.
   */
  perCard?: boolean;
  retired?: boolean;
}

/* ---- a language ----

   The pack in LANGUAGES: everything language-specific in one object, which
   is what lets the rest of the app know nothing about any particular
   language. Optional means genuinely absent from at least one pack today,
   not merely forgettable — Hebrew declares no scale, Vietnamese no script
   regex, and only Vietnamese has a lexical axis. Writing that down is what
   stops a reader assuming all three are always there. */

/** One row of the importer's worked example, in this language. */
export interface LangSample {
  ar: string;
  en: string;
  lat: string;
}

/**
 * Something computed from a word rather than stored on it — a root, a
 * spelling with the tone taken off. `compute` returns the key that gathers
 * words together.
 */
export interface Derived {
  id: string;
  label: string;
  compute: (word: string) => string;
  /** Whether it gathers words in the Progress tab. */
  groups: boolean;
  /** Whether it can be asked as an exercise. */
  quizzable: boolean;
  /** What to call the words it gathers, in this language's terms. */
  heading?: string;
  short?: string;
  /** The classes it is graded in, which may be fewer than the language writes. */
  classes?: { id: string; label: string; merges: string[] }[];
}

/**
 * How strictly a language marks what is typed.
 *
 * A fact about the language, which is why it lives in the pack: whether a
 * missing haraka is a mistake or merely an incomplete spelling is Arabic's
 * answer, not a learner's. It used to be a row of Exact/Lenient controls
 * under Settings — with labels, choices and help text declared here for
 * them — and asking a beginner to rule on hamza before they could read one
 * was never a fair question. The pack rules instead; each key is read by
 * the pack's own `check`.
 */
export type LangMarking = Record<string, string | boolean>;

/**
 * What each shade of not-quite-right is called. The tiers are the same in
 * every language; only the words for them differ.
 */
export interface Verdicts {
  partial: string;
  missing: string;
  near: string;
  bare: string;
}

/**
 * How this language finds one of its words inside a run of them.
 *
 * `matches` is asked of one token, or of several joined, so a word that is
 * itself several tokens is found the same way a single one is. `tokens`
 * splits a phrase where whitespace is the wrong seam; none does yet.
 * `skip` names the words never worth a card of their own — the particles
 * and prepositions — which is the one part of that question the app cannot
 * work out and the language always knows.
 */
export interface LangContext {
  matches: (token: string, word: string) => boolean;
  tokens?: (text: string) => string[];
  skip?: string[];
}

/** The on-screen keyboard a language offers, where its script wants one. */
export interface LangKeys {
  rows: string[][];
  extras: string[];
  marks: string[];
  marksLabel: string;
}

/**
 * A language pack. Everything language-specific lives here, so that
 * divergent copies of a grader or an editor cannot exist.
 */
export interface Lang {
  id: LangId;
  name: string;
  nativeName: string;
  /**
   * Written out rather than left as a string, because it is handed straight
   * to an element's dir attribute.
   */
  direction: "rtl" | "ltr";
  scriptLabel: string;
  /**
   * The same word, written in the language.
   *
   * The placeholder in the box a teacher writes the language into, and the
   * only thing on that line saying which script is wanted. The label above
   * it used to say "Arabic script and transliteration", which named two
   * fields in one heading and still left the box itself empty — a box with
   * a name over it and nothing in it says nothing about what goes in it.
   *
   * Short: the name of the language, not of the dialect — `nativeName` is
   * the dialect, and at the length of a sentence it is not a placeholder.
   */
  scriptNative: string;
  scriptShort: string;
  /** How to recognise the script. Latin-written languages have none. */
  script?: RegExp;
  /** Type scale against Arabic, which is 1 by definition. */
  scale?: number;
  leading?: number;
  sample: LangSample[];
  translitLabel: string;
  /** Which axes of GRAMMAR this language uses. */
  grammar: string[];
  verdicts: Verdicts;
  derived: Derived[];
  similarityKey: (word: string) => string;
  similarityMode: string;
  context: LangContext;
  translitDrilled: boolean;
  formsLabel: string;
  fontStack: string;
  keys: LangKeys;
  check: (given: string, expected: string, settings?: any) => any;
  /**
   * One character, folded the way this language's marking folds it when it
   * is deciding whether two spellings are the same word.
   *
   * What it is for is showing a learner *which* letter they got wrong —
   * see `spellRuns` in src/spelling.ts, which lines the two spellings up
   * and can only do it in letters the language agrees are letters. Two
   * characters are the same letter when they fold the same; a character
   * that folds to nothing is not a letter to get wrong, which is how a
   * harakat, a tone mark and a space stay out of it.
   *
   * The same fold the check itself uses for its skeleton, so the marks on
   * the screen cannot contradict the verdict beside them. A pack that
   * declares none has its answers marked exactly as before and nothing
   * highlighted.
   */
  letter?: (ch: string, settings?: any) => string;
  marking: LangMarking;
  rules: string[];
  /** Only where the language has one. */
  lexical?: { key: string; label: string; help: string };
  /**
   * The tables this language lays a word's forms out in, by name.
   *
   * `verb` is the persons and tenses, where verbs vary; `attached` the
   * pronouns on the end of a word; `agreement` an adjective's feminine and
   * plural; `counted` a number's feminine. A pack declares the ones it
   * has and none of the rest — a noun in Huế is a noun with nothing laid
   * out under it. Two of them used to be named fields here, and a third
   * table would have been a third field, a third accessor and a third
   * branch wherever the two were told apart.
   */
  tables?: Record<string, VerbSpec>;
  /**
   * What a word can be in this language, in the order the teacher is asked.
   * A pack without a list is asked nothing, and its cards say what they are
   * the way every card did before this — by what they hold.
   */
  categories?: WordCategory[];
  /**
   * A pack's own rule for word/phrase/sentence. None has one yet;
   * guessKind() reads it.
   */
  guessKind?: (text: string) => string;
  /**
   * How this language builds its numbers, where anybody has said: which
   * boxes a teacher fills, which faces each takes, which ranges a learner
   * is scheduled on, and how a number is put together out of the words
   * they wrote. Declared beside the pack in src/numbers/, which holds the
   * rules and not a word of any language. A pack without one teaches
   * numbers the way it teaches any other word, one card at a time.
   */
  composer?: import("./numbers/types.ts").Composer | null;
  /** And how it tells the time, which is a separate answer: a language
      may build numbers and have nobody yet who knows its clock. */
  times?: import("./numbers/types.ts").TimeComposer | null;
}

/**
 * The learner's settings, as the document stores them.
 *
 * Deliberately open: most keys are the leniency options a language pack
 * declares, so which ones exist depends on the language and cannot be
 * listed here. `language` is the one every reader relies on, and the one
 * worth naming.
 */
export type Settings = { language?: LangId } & Record<string, any>;

/**
 * A session built by hand on the Build screen and kept.
 *
 * The cards are named by id rather than copied: a saved session is a way
 * back to the same material, not a snapshot of it, so a card edited since
 * is practised as it now reads and one withdrawn since simply drops out.
 * It rides in `settings`, which is what the whole document already syncs
 * as one last-writer-wins blob — right for something a person changes a
 * handful of times, and the reason it is not a top-level list with a merge
 * rule of its own.
 */
export interface SavedSession {
  id: string;
  name: string;
  /** The cards it was built from. Some may no longer exist. */
  ids: string[];
  /** Which of MODES it was built in. */
  mode: string;
  /** Questions to ask; 999 where the length is a stretch of time instead. */
  count: number;
  /** Minutes to run for, or 0 where the length is a number of questions. */
  minutes: number;
  created: Millis;
}

/* ---- people ---- */

/**
 * An account, as everything but the server sees it. The sign-in key is
 * never part of this: only its digest is stored, on the server's own copy.
 */
export interface User {
  /** Public, permanent, what rosters point at. */
  handle: string;
  /** Public, editable, cosmetic. */
  displayName: string;
  admin: boolean;
  created: Millis;
  /** Signed in or asked who they are. */
  lastSeen?: Millis;
  /** The app said a session was practiced. */
  lastLearned?: Millis;
  /** A card or deck was actually made or changed. */
  lastTaught?: Millis;
}

/* ---- material ---- */

/**
 * One accepted way of saying the same thing — a plural, a second dialect
 * form. Practiced on its own, so it carries its own recordings.
 */
export interface CardForm {
  /** The word in the language's own script. */
  ar: string;
  /** What it means. */
  en: string;
  /** How it is pronounced, in Latin letters. */
  lat: string;
  /** Recording hashes, said at ordinary speed. */
  clips?: string[];
  /**
   * The same, said slowly. Kept apart rather than mixed in with the others:
   * which one a learner is hearing is the whole point of having both, and a
   * list that lost track of it would be a list of recordings at unknown
   * speeds.
   */
  slowClips?: string[];
  /** Picture hashes — what this form means, shown. At most four; see
      ImageScreen. */
  images?: string[];
  /**
   * Where this form sits in its card's verb table: which tense, which
   * person. Both or neither — one without the other places nothing.
   *
   * A cell of a conjugation table is a sub-form and nothing more, which is
   * why there is no separate list of them: a sub-form is already an
   * alternate form drilled on its own, with its own recordings and its own
   * progress, and that is exactly what a cell is. These two fields say
   * where in the table it sits, and src/verbs.ts is the only place that
   * reads them.
   */
  row?: string;
  col?: string;
  /**
   * Whose table this cell sits in: the id of the form it is a form of, or
   * absent for the card's own word.
   *
   * A verb's table belongs to the card — there is one of it, and the card
   * is the verb — so its cells say nothing here. The pronouns a word takes
   * on its end belong to a *form*: the plural takes the same endings and
   * has eight of its own, so every form carries a table and a cell names
   * which. Absent is what every cell written before this carries, and
   * means the card's own word.
   */
  of?: string;
  /**
   * What this form is called, for as long as anything points at it.
   *
   * Sub-forms used to be told apart by where they sat in the list, which
   * a cell cannot name — inserting a form above another moved every
   * student's progress down a place — and which nothing could point at.
   * Minted by the editor, stored, and never shown.
   */
  id?: string;
  /**
   * Whether this form is asked about. Absent means yes, which is what
   * every form written before this meant and what anything added to a card
   * later means.
   *
   * A teacher may want a form on the card without it being drilled — a
   * table of conjugations written out for a student to read, a rare plural
   * worth recording and not worth asking for. Until this, the only way to
   * stop a form being asked was to delete it, which took its recordings
   * and every student's progress on it with it.
   *
   * Not to be confused with a card's `drill`, which is about the whole
   * card: a value that fills somebody else's blank and is never a question
   * of its own. This is one form of one card, and a card whose every form
   * is switched off is simply a card with nothing to ask.
   */
  ask?: boolean;
  /**
   * Whether this form may be lent to a card with a blank in it — "big" in
   * *the {{adjective}} book*, "Raphael" in *my name is {{name}}*.
   *
   * The other half of the same question, and a separate answer since
   * 0.179: a word can be worth meeting inside somebody else's sentence
   * without being a question of its own, and worth asking on its own
   * without being dropped into every frame that has a hole of its name.
   * Until then `ask` answered both, so the only way to stop a form being
   * asked was to stop it being lent as well.
   *
   * Absent means whatever `ask` says, which is what every form written
   * before this meant: a form nobody asked about lent nothing. So a
   * stored card is read exactly as it was written, and the editor writes
   * this out only where the two answers differ.
   */
  lend?: boolean;
  /**
   * Which tenses each of a sentence's blanks wants its verbs to stand in:
   * the blank's name, and the rows of the table it admits.
   *
   * A verb card is right to carry every tense, and the frame is what says
   * when the thing happened. "Yesterday {{name}} {{verb}} an apple" was
   * met as the present, the past and the command one after another, and
   * two of those say something nobody means — so the sentence is where
   * that is settled, because it is the only place that can settle it.
   *
   * **Absent, and an empty list, both mean every tense**, which is what
   * every card written before this says and what a frame about nothing in
   * particular wants: there is nothing to migrate, and a blank nobody has
   * thought about is filled exactly as it was. Only rows narrow — a word
   * of a kind that has no tenses, a name standing in the same hole, is
   * there whatever is ticked. See slotRows and standsInRows in
   * src/verbs.ts, which are the one answer to both halves.
   *
   * On the form because a blank is left in a form's own words, beside the
   * frame's record of which values it has already been met with. One
   * answer for the card all the same: every form of a sentence leaves the
   * same blanks, so the editor writes the same map onto each of them.
   */
  tenses?: Record<string, string[]>;
}

/**
 * A card, as the server stores it.
 *
 * The grammatical axes a language declares (number, gender, addressee, a
 * classifier) are stored flat on the card under their own names, which is
 * why this is indexable: the server takes whatever grammarFields() lists
 * without knowing which language uses which.
 */
export type Card = {
  id: string;
  owner?: string;
  lang: LangId;
  /** The card's own word first, then the alternates it carries. */
  forms: CardForm[];
  note?: string;
  /**
   * What the teacher says this word is — a noun, a verb, a name. One of
   * the ids the language pack declares; see WordCategory.
   *
   * Absent on every card written before it was asked, and on any the
   * teacher has not answered for. What follows from it is the editor's
   * business: nothing about how a card is drilled reads this.
   */
  category?: string;
  /**
   * Whether this card's words have been read into a number system.
   *
   * Numbers used to be fifty-five cards with a `value` on each; they are
   * one document now, and the migration that built it marked the cards it
   * read rather than deleting them. A card carries recordings and
   * somebody's progress, and neither is the migration's to throw away —
   * so they stay where they are, in whatever decks they are in, and a
   * later release takes them.
   *
   * Absent on every card that is not one of those, which is nearly all of
   * them.
   */
  derived?: boolean;
  /**
   * The variables this card can stand in for, where it is a value rather
   * than something to learn: a card saying `name` fills every {{name}} in
   * every phrase of the same language. Empty on an ordinary card.
   *
   * One name or several — a word stands in more than one kind of hole as
   * soon as a teacher writes a second frame about it. A card written
   * before that carries the one name as a plain string, and is read
   * exactly the same: see `fillNames`, which is the one answer and which
   * the server reads it through too.
   */
  fills?: string | string[];
  /**
   * Whether this card is a sentence — a frame with holes in it that other
   * cards are dropped into — rather than a word.
   *
   * The teacher's answer, given in the editor and kept. Until 0.176 it was
   * worked out from the braces in the card's own words instead, so the
   * question the editor asked was thrown away the moment it was answered:
   * a sentence written before its first blank came back as a word, and a
   * blank typed into a word made it a sentence whether or not anybody
   * meant that.
   *
   * Absent on every card written before this, and read then as it always
   * was — a card with a hole in it is a sentence. That is the whole of the
   * migration; see `isSentence`, which is the one answer. Stored only
   * where it is true, because a word may not carry a blank and so has
   * nothing to say here.
   */
  sentence?: boolean;
  /**
   * The ID the teacher gave this card, so another card can borrow *this*
   * word by name: "{{colour-red}} is heavy".
   *
   * Not the `id` above, which the app mints and nobody types. This is the
   * teacher's, chosen when the card is written, unique across the cards
   * they can see, and the same shape as anything else that goes between
   * braces — see cardRef, which is the one answer to what it says.
   *
   * Absent on a card written before it was asked for. Such a card is
   * borrowed the way it always was, through the tags it carries, and is
   * simply not reachable by name until somebody gives it an ID.
   */
  ref?: string;
  /**
   * What to call the card in a list, where its own words do not name it.
   *
   * A verb in a language with no infinitive is saved as the form a
   * dictionary lists — Arabic's he-past — so a list read "أكل · he ate",
   * which names one cell of its table rather than the verb. A sentence is
   * saved as a frame, so a list read "{{name}} is heavy", which names the
   * hole in it rather than what it is for. A name is the teacher's answer
   * to both. Absent on every other card, which is named by the word it
   * teaches.
   */
  name?: string;
  /**
   * Whether the card is practised in its own right. Absent means yes, which
   * is what every card written before variables existed meant. A value —
   * "Raphael" — is turned off: it is there to fill a hole in somebody
   * else's sentence, and asking what it means is not a question.
   */
  drill?: boolean;
  uses?: string[];
  lines?: (CardForm & { who?: number; uses?: string[] })[];
  speakers?: string[];
  you?: number | null;
  rev?: number;
  created?: Millis;
  updated?: Millis;
  inDecks?: string[];
  decks?: string[];
} & Record<string, unknown>;

/** Where a deck sits in a course, and since when. */
export interface DeckLink {
  courseId: string;
  addedAt?: Millis;
}

export interface Deck {
  id: string;
  owner: string;
  title: string;
  description?: string;
  lang: LangId;
  /** Moves whenever the deck's cards change. */
  version?: number;
  courses: DeckLink[];
  cardIds?: string[];
  cardCount?: number;
  updated?: Millis;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  language: LangId;
  teachers: string[];
  students: string[];
  decks: string[];
  /** Handed round a class. */
  code?: string;
  /** Gives authority over the material. */
  teacherCode?: string;
  created?: Millis;
}

/**
 * The administrator's whole view of the site, as admin-overview answers it.
 */
export interface AdminOverview {
  users: (User & {
    teaching: { title: string; language?: LangId }[];
    studying: { title: string; language?: LangId }[];
  })[];
  courses: Course[];
  decks: (Deck & { cardCount: number; ownerName: string; courseTitles: string[] })[];
  flags: Flag[];
}

/* ---- the schedule ---- */

/**
 * How one exercise type on one card is going. States that have never been
 * answered are not stored, so every field here is present once it exists.
 */
export interface ExerciseState {
  /** "new" | "learning" | "review" | "relearning". */
  phase: string;
  step: number;
  ease: number;
  /** In days. */
  interval: number;
  due: Millis;
  reps: number;
  lapses: number;
  right: number;
  wrong: number;
  skips: number;
  near: number;
  /**
   * How often it was answered with the hint up. Counted on every exercise
   * that offers one, so that "answered right" and "answered right while
   * looking at the pronunciation" are not the same number; on the ones
   * whose hint is the answer by another route it also costs the answer its
   * good mark — see hintTells.
   */
  hints: number;
  /**
   * The last six outings, 1 right and 0 wrong. Numbers rather than booleans
   * because they are what the stored documents already hold.
   *
   * It carries the ladder as well as the record. Two of these right in a
   * row is what opens the level above, and two wrong in a row is what
   * shuts it — see `solid` and `missedTwice` in the scheduler.
   */
  hist: number[];
  /**
   * How many times this question has come round of its own accord, since
   * the card climbed, and been answered right.
   *
   * Nought, one or two; two on every exercise at the top of a card's
   * ladder is what makes the card *learnt* rather than merely climbed. Only
   * an answer given when the question was actually due counts, so no
   * amount of practice in one evening can make it up — see `passesMade`.
   * A miss puts it back to nought.
   *
   * Absent on a document written before it existed, which reads as nought:
   * a card climbed under the old rules has its passes still to make, and
   * makes them on the next two reviews, which is what those reviews were
   * always going to be.
   */
  passes?: number;
  updated: Millis;
}

/**
 * One question in a session's queue: which card, which of its forms, and
 * which exercise to ask.
 *
 * It is a plan rather than the question itself — nothing here is the
 * wording on screen. `resolveUnit` turns the two ids back into the card
 * and the form, and the exercise is built from those at the moment it is
 * shown, so a card edited mid-session is asked as it now reads.
 */
export interface Question {
  /** The card. */
  id: string;
  /**
   * Which of its extra forms, when the question is about one of those
   * rather than the card itself.
   */
  subId?: string | null;
  /** The exercise, keyed into EX. */
  type: string;
  /** The phrase the word is stood in, for the exercises that need one. */
  ctx?: string;
  /**
   * The other words in the grid, when the question is a matching grid.
   * Every one of them is asked and marked in its own right; the card
   * above is only the first of them.
   */
  mates?: { id: string; subId: string | null }[];
  /**
   * Which number or time this asking of a range is about.
   *
   * Drawn when the queue is built and never stored: the same rule the
   * phrase a word is stood in follows, and for the same reason — a
   * question that changed under the learner between being dealt and being
   * answered would be a different bug every time. What a right answer
   * moves is the skill's own schedule and the cards whose words stood in
   * the rendering; the number itself is thrown away with the sitting.
   */
  ask?: import("./numbers/types.ts").Ask;
  /**
   * The wrong answers beside it, already said in words.
   *
   * A range brings its own, because which numbers are worth confusing is
   * arithmetic and which of them can be said is the composer's business.
   * Drawing from the learner's vocabulary instead would put a book and a
   * house beside a number and make the question a reading test.
   */
  options?: string[];
}

/**
 * Where the time and the jitter come from. Defaulted at the scheduler
 * rather than at each call site, so a caller that says nothing gets the
 * real world and a test that passes one object gets a world that holds
 * still.
 */
export interface Clock {
  now?: () => number;
  random?: () => number;
}

/* ---- the device's own document ---- */

/**
 * One of a card's forms: the card itself, or one of the other ways the
 * same thing is said.
 *
 * A form is the unit an exercise is actually about — it is what carries
 * the wording, the recordings and the schedule. A card is a form plus
 * everything that belongs to the card as a whole: which decks it is in,
 * whether it is locked, where it came from. The scheduler walks forms; the
 * card list shows cards. Keeping them apart is what stops a sub-form being
 * handed somewhere that will ask it which decks it is in — it has none.
 */
export type Form = Record<string, any> & {
  id: string;
  ar: string;
  en: string;
  lat: string;
  note?: string;
  lang?: LangId;
  recs?: any[];
  /* The recordings, at the two speeds, exactly as CardForm holds them —
     a form on a device and a form on the server carry the same ones. */
  clips?: string[];
  slowClips?: string[];
  /* Its pictures, by hash, as CardForm holds them. */
  images?: string[];
  s?: Record<string, ExerciseState>;
  /* Whether this form is asked about at all. Absent means yes — see
     CardForm, where the teacher sets it. A form switched off keeps its
     wording, its recordings and whatever schedule it had; it is simply
     never dealt. */
  ask?: boolean;
  /* And whether it may be lent to a card with a blank in it. Absent means
     whatever `ask` says — see CardForm, where the teacher sets it. */
  lend?: boolean;
  /* How far this form has been asked with each of the values that fill its
     holes — "slot:valueId" to the highest level it was met at. Only for a
     value with no ladder of its own to be read instead; see valuesAt in
     variables.ts. Absent on every form that leaves no hole, which is nearly
     all of them. */
  met?: Record<string, number>;
  created?: Millis;
  updated?: Millis;
};

/**
 * A line of a dialog: a form, said by somebody, that may name the word
 * cards it uses.
 *
 * It is a Form and not a thing of its own because it is drilled like one —
 * its own wording, its own recordings, its own progress. `who` indexes the
 * card's `speakers`; `uses` is the same list a phrase card carries, and is
 * what lets a scene stand in for a phrase in the gap-fill.
 */
export type Line = Form & { who?: number; uses?: string[] };

/**
 * A card as it lives on a device: the teacher's wording plus this
 * learner's progress.
 *
 * Its id is not the server's id for the same card — course material
 * arrives named srv<cardId> — which is what `source` is for. Reporting the
 * wrong one of the two is invisible here, because both are strings, so the
 * comment is the whole warning the type can give.
 *
 * The index signature is what lets a language's own grammar fields — which
 * differ per language and are not knowable here — sit alongside the ones
 * every card has. It also means an unlisted field reads as `any`, so the
 * fields worth checking are the ones written out.
 *
 * A dialog is one of these too: `lines` holds the conversation, `speakers`
 * names who is in it, and `you` says which of them the learner plays — or
 * is null, where the card leaves that to the question.
 */
/**
 * A card on a device: the forms it is made of, and the facts that belong
 * to the card as a whole.
 *
 * It *was* a form with a list of other forms beside it — the card's own
 * word lived on the card, and its alternates in `subs`, which is two
 * shapes for one kind of thing. Every per-form fact then had to be
 * declared twice and handled twice, and the two drifted: a sub-form had no
 * name of its own until 0.131, a cell of a pronoun table had to invent a
 * way of saying "I belong to the card's own word", and each new per-form
 * field was written once for the lead and once for the rest.
 *
 * One list now, the card's own word first. `forms[0]` is what a list
 * shows, what a search matches and what a sentence borrows — see leadOf in
 * cards.ts, which is how every reader asks for it.
 */
export type Item = {
  id: string;
  /** Which language it is in. A device holds more than one. */
  lang?: LangId;
  kind?: string;
  tags: string[];
  /** The card's own word first, then the alternates it carries. */
  forms: Form[];
  /** What the card as a whole is about, where the teacher wrote one. */
  note?: string;
  /** The variables this card stands in for, where it is a value. See Card. */
  fills?: string | string[];
  /** The ID the teacher gave it, which a blank may ask for by name. See Card. */
  ref?: string;
  /** What to call it in a list, where its own words do not name it. See Card. */
  name?: string;
  /** What the teacher says the word is — a noun, a verb, a name. See Card. */
  category?: string;
  /** Whether it is practised in its own right. Absent means yes. See Card. */
  drill?: boolean;
  /**
   * When the learner last said whether they want this card next, so that
   * the answer survives a merge.
   *
   * `priority` alone did not. A merge takes a card whole from whichever
   * device touched it last and merges only the schedules underneath, and
   * every graded answer stamps the card — so a mark set on one device was
   * dropped the moment the other device merely answered the card, or
   * answered a sentence the card stood in. With a time on it the merge can
   * take the later answer instead of the later card.
   *
   * Set whenever the mark is turned on *or off*, which is why `priority`
   * is stored as `false` rather than removed: "no longer wanted, as of
   * then" is an answer and has to beat an older yes.
   */
  priorityAt?: Millis;
  /**
   * When every schedule on this card was last sent back to the beginning.
   *
   * A reset writes blank schedules, and a blank schedule is exactly what
   * the app makes for one that was never stored — so it is left off the
   * wire and off the disk, and the merge kept whatever the other side
   * still had. The reset was undone seconds later by the server's own
   * copy, with the message saying it had worked.
   *
   * The stamp travels instead, merges by taking the later, and any state
   * older than it is dropped: a reset is a fact about the card, where the
   * absence of a schedule is not.
   */
  reset?: Millis;
  /** Which of the teacher's other cards this one teaches by containing them. */
  uses?: string[];
  flags?: any[];
  lines?: Line[];
  speakers?: string[];
  you?: number | null;
  /**
   * Where a card the learner did not write came from.
   *
   * Two sorts, because there are two ways material arrives: a teacher's
   * card, which came out of a deck in a course, and a word out of a
   * language's number system, which is in no deck at all. Both are
   * refreshed by being made again from their source and folded over what
   * the learner has earned, which is why both say where they came from
   * rather than only that they are not the learner's own.
   */
  source?:
    | { courseId: string; deckId: string; cardId: string; rev: number }
    | { systemId: string; slot: string };
  locked?: boolean;
  /**
   * The stretch of what can be asked that this item *is*, where it is a
   * skill rather than a word.
   *
   * A range holds a schedule and no words: what it is asked is made up
   * when the queue is built, out of the system it came from, and thrown
   * away with the sitting. Nothing about it reaches the disk but the
   * schedule — see src/numbers/generate.ts.
   */
  range?: SkillRange;
  /**
   * The learner has asked for this card.
   *
   * Theirs, not the teacher's — it is set from the learner's own card list
   * and survives a course refresh, which `foldCourses` has to be told
   * about because that otherwise takes the teacher's card whole. While it
   * is on, the card is ready whatever its schedule says and comes first in
   * every session; nothing about the schedule underneath it moves.
   */
  priority?: boolean;
  created: Millis;
  updated?: Millis;
};

/**
 * What was set aside when a course card went away: its schedules and its
 * record of the words it has been asked with, by the name of the form each
 * belonged to, and when it was parked.
 *
 * Keyed by form name rather than held as forms, because the card that
 * comes back is the teacher's and may have been edited in the meantime —
 * what is being restored is the progress, not the wording.
 */
export interface Parked {
  at: Millis;
  forms: Record<string, { s?: Record<string, ExerciseState>; met?: Record<string, number> }>;
  lines?: Record<string, { s?: Record<string, ExerciseState>; met?: Record<string, number> }>;
  /**
   * And what the learner had said about wanting this card next, which
   * rides on the card rather than on any of its forms and so is not
   * covered by the two above.
   *
   * A card can go missing for reasons that are nobody's decision — see
   * `parked` in Doc — and the refresh that brought it home handed back
   * every schedule and quietly dropped the mark, so a learner whose deck
   * was detached and reattached found the cards they had asked for no
   * longer in their sessions and nothing anywhere saying why.
   */
  priority?: boolean;
  priorityAt?: Millis;
}

/**
 * The whole document one person's devices share, as it goes over the wire.
 * Merging two of these is idempotent: the same input twice changes
 * nothing.
 */
export interface Doc {
  version: number;
  items: Item[];
  /** Withdrawn cards, so a sync does not hand them back. */
  tombstones: Record<string, Millis>;
  /**
   * The progress of course cards that are no longer in the material,
   * kept in case they come back.
   *
   * A course refresh treats a card missing from the answer as one the
   * teacher withdrew: removed, and tombstoned so the next sync removes it
   * from this learner's other devices too. That is right about the card
   * and was wrong about the work: a card can be missing for reasons that
   * have nothing to do with a teacher deciding anything — a deck detached
   * and reattached, a student briefly removed from a course, one
   * unreadable record on the server — and every one of those destroyed
   * the learner's progress on the whole deck, everywhere, for good.
   *
   * So the card goes and the work is set aside here, by the card's id,
   * and put back if the card returns. Nothing else reads this: it is a
   * drawer, not a second copy of the document. Pruned on the same
   * schedule as the headstones above.
   */
  parked?: Record<string, Parked>;
  log: Record<string, any>;
  /**
   * What the ladder did each day: how many cards moved up a level, how
   * many cleared, how many were learnt.
   *
   * Filed by the learner's own day, beside the count of questions in
   * `log`, and the only record in the document of *change* rather than of
   * where things stand. Everything else here is a stock-take: this is
   * what lets Progress say what a day and a week came to, which no amount
   * of reading the cards can reconstruct once they have moved on.
   *
   * Counted per card and once per kind: a card that moves up a level in
   * the morning and clears at night is in both tallies, and one answered
   * twice on the same rung is in neither.
   *
   * Absent on a document written before it existed, which reads as no
   * history — so the lines that read it simply say nothing until a day
   * has been recorded.
   */
  moves?: Record<string, DayMoves>;
  /** Every document has them; EMPTY is where the defaults live. */
  settings: Settings;
  settingsUpdated?: Millis;
}

/**
 * One day's movement on the ladder.
 *
 * Three counts rather than one, because they are three different things
 * to be told: a card moving up a rung is ordinary progress, a card
 * clearing is the evening's work finished, and a card being learnt is the
 * only one of the three that is permanent.
 */
export interface DayMoves {
  up: number;
  cleared: number;
  learnt: number;
}

/**
 * A document as it arrives: from the server, from an import, or from a
 * device on an older build.
 *
 * Every field is optional because every reader already treats it that way
 * — mergeData guards items, tombstones, log and settings one at a time,
 * and has to, since a document written a year ago carries only the fields
 * that existed then. A `Doc` is what this device holds and always
 * complete; this is what it is handed.
 */
export type WireDoc = Partial<Doc>;

/* ---- reported problems ---- */

/** Which of the four things a learner said — three complaints, and "too
    easy", which is a shortcut up the ladder rather than a report and is
    never sent to the server. */
export type FlagKind = "strict" | "data" | "easy" | "other";

/**
 * What has become of a flagged card since the report was sent. Worked out
 * when the report is read, never stored.
 *
 * "here" also covers a report too old to compare — nothing is claimed
 * about a card whose revision at the time was never recorded.
 */
export type CardState = "here" | "edited" | "gone" | "absent";

/**
 * How the question the learner flagged had gone for them.
 *
 * The report says a card is wrong; this says what the card did to the
 * person who said so, which is most of what "wrong" meant. A card marked
 * "right" and flagged is a different bug from one marked "wrong" and
 * flagged, and without this the two read identically.
 *
 * "unanswered" is a flag raised before the answer was sent — the menu is
 * open on the question as well as on the verdict — and is not the same as
 * "skipped", which is an answer of a kind.
 */
export type FlagVerdict = "right" | "near" | "wrong" | "shown" | "skipped" | "unanswered";

/**
 * A problem a learner reported from the answer screen.
 *
 * It carries a copy of the question rather than a pointer to it, because
 * the card can be edited or withdrawn between the report and somebody
 * reading it, and an id alone would then say nothing.
 */
export interface Flag {
  id: string;
  kind: FlagKind;
  /** The learner's own words. Required for "other". */
  note: string;
  /** Who sent it. */
  handle: string;
  /** Their name when they sent it. */
  handleName: string;
  /** The card's id **on the server**, not the device's. */
  cardId: string;
  /** Whether the site held that card when this arrived. */
  cardKnown?: boolean;
  /** The card's revision then, for spotting an edit since. */
  cardRev?: number;
  /** Which exercise type was being asked. */
  exercise: string;
  /** Which form of the card, if not the main one. */
  subId: string | null;
  language: LangId;
  /** The question as it was asked. */
  prompt: string;
  meaning: string;
  at: Millis;
  /**
   * Where the card reached the learner from: the course and the deck it
   * arrived in. Absent on a card the learner made themselves, which came
   * through neither, and on every report sent before this was recorded.
   *
   * Worth having because a bad card is usually a bad *batch* of cards, and
   * the deck is the thing to go and look at.
   */
  courseId?: string;
  deckId?: string;
  /**
   * What the learner put, and what the app made of it.
   *
   * The half of a report the learner cannot be expected to type out. "It
   * marked me wrong" is unanswerable without knowing what they wrote; with
   * it, the report usually names its own bug.
   *
   * `answer` is empty where there was nothing typed — a question answered
   * by tapping, or flagged before it was answered at all.
   */
  answer?: string;
  verdict?: FlagVerdict;
  /** Which build of the app they were on: release, then commit. */
  release?: string;
  /** Added when the report is read, never stored. */
  cardState?: CardState;
}
