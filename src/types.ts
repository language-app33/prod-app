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
   answer and never the app's: Arabic declares seven persons and three
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
  /** The grammar values on a subject that call for this column. */
  picks?: Record<string, string>;
}

/** One row: when it happened, or what mood it is in. */
export interface VerbTense {
  id: string;
  label: string;
}

/** A language's verb table: its columns, and its rows in teaching order. */
export interface VerbSpec {
  persons: VerbPerson[];
  tenses: VerbTense[];
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
  table?: "verb" | "attached";
}

/** A grammatical axis a word varies along — number, gender, addressee. */
export interface GrammarDim {
  label: string;
  field: string;
  required: boolean;
  /** [stored value, what to show]. */
  options: [string, string][];
  /** What a new or unreadable value becomes. */
  default?: string;
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

/** A leniency the teacher can set on a course. */
export interface LangOption {
  key: string;
  label: string;
  help: string;
  /** Absent on a plain on/off. */
  choices?: [string, string][];
  toggle?: boolean;
}

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
  options: LangOption[];
  rules: string[];
  /** Only where the language has one. */
  lexical?: { key: string; label: string; help: string };
  /**
   * How this language lays a verb out, where it lays one out at all. A
   * pack without it teaches verbs as ordinary cards, which is every pack
   * before this existed.
   */
  verb?: VerbSpec;
  /** The pronouns this language attaches to the end of a word, where it
      attaches any. One row, and a column per pronoun — see ATTACHED_TABLE. */
  attached?: VerbSpec;
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
   * The variable this card can stand in for, where it is a value rather
   * than something to learn: a card saying `name` fills every {{name}} in
   * every phrase of the same language. Empty on an ordinary card.
   */
  fills?: string;
  /**
   * What to call the card in a list, where its own words do not name it.
   *
   * A verb in a language with no infinitive is saved as the form a
   * dictionary lists — Arabic's he-past — so a list read "أكل · he ate",
   * which names one cell of its table rather than the verb. A name is the
   * teacher's answer to that. Absent on every other card, which is named
   * by the word it teaches.
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
   */
  hist: number[];
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
  s?: Record<string, ExerciseState>;
  /* Whether this form is asked about at all. Absent means yes — see
     CardForm, where the teacher sets it. A form switched off keeps its
     wording, its recordings and whatever schedule it had; it is simply
     never dealt. */
  ask?: boolean;
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
  /** The variable this card stands in for, where it is a value. See Card. */
  fills?: string;
  /** What to call it in a list, where its own words do not name it. See Card. */
  name?: string;
  /** What the teacher says the word is — a noun, a verb, a name. See Card. */
  category?: string;
  /** Whether it is practised in its own right. Absent means yes. See Card. */
  drill?: boolean;
  /** Which of the teacher's other cards this one teaches by containing them. */
  uses?: string[];
  flags?: any[];
  lines?: Line[];
  speakers?: string[];
  you?: number | null;
  source?: { courseId: string; deckId: string; cardId: string; rev: number };
  locked?: boolean;
  created: Millis;
  updated?: Millis;
};

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
  log: Record<string, any>;
  /** Every document has them; EMPTY is where the defaults live. */
  settings: Settings;
  settingsUpdated?: Millis;
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

/** Which of the three things a learner said was wrong. */
export type FlagKind = "strict" | "data" | "other";

/**
 * What has become of a flagged card since the report was sent. Worked out
 * when the report is read, never stored.
 *
 * "here" also covers a report too old to compare — nothing is claimed
 * about a card whose revision at the time was never recorded.
 */
export type CardState = "here" | "edited" | "gone" | "absent";

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
  /** Added when the report is read, never stored. */
  cardState?: CardState;
}
