/*
 * The language layer.
 *
 * Everything that differs between the languages this app can teach lives
 * here and nowhere else: the script and its direction, the on-screen keys,
 * the grammatical axes a word varies along, the properties read out of its
 * spelling, how an answer is judged, and what each shade of wrong is called.
 *
 * It exists because these facts were written twice — once in the trainer and
 * once in the teacher's card editor — and the two drifted, so a Vietnamese
 * card was offered Arabic number and gender. Both now import from here.
 * Adding a language means adding an entry to LANGUAGES and nothing else.
 *
 * Nothing in this file imports from the app, so it can be read and tested
 * on its own.
 */
import type {
  Derived,
  ExerciseSpec,
  GrammarDim,
  Lang,
  LangId,
  NumberBand,
  NumberCell,
  NumberCtx,
  NumberSpec,
  Settings,
  Spelling,
  Verdicts,
  VerbPerson,
  VerbSpec,
  WordCategory,
} from "./types.ts";
/* The one import here, and it goes the way every import in this file has
   to: dialogs.ts knows nothing about languages, so there is no cycle. It
   holds the shape of a scene, which marking a part and an ordering both
   have to read. */
import { DIALOG_KIND, SELF_ALL, isDialog, linesOf, orderIsRight, partAnswers, yourLines } from "./dialogs.ts";
import { answersOf } from "./answers.ts";
import { leadOf } from "./cards.ts";
import type { AnswerField, WithAnswers } from "./answers.ts";


/* The exercise types on offer. This is the registry everything derives from —
   which states a card carries, what a session may pick, what the settings
   list, what an export has columns for — so retiring a type is one edit here
   and its definition stays below. */
/* In the order a card climbs them — see `level` on each definition below,
   and openTypes in the scheduler. A session asks a unit its exercises in
   this order, so the easiest of whatever it was dealt comes first. The
   conversation exercises are kept together at the end rather than filed
   among the words: they are asked of a scene or a turn in one, never of a
   word, so the two families never stand in the same queue for a unit. */
/**
 * Which ordinary exercise a made-up number's question is evidence for.
 *
 * A number is not a card and climbs no ladder, but the parts that stood in
 * it are cards and do — and what reading *forty-seven* off the screen
 * proves about أربعين is exactly what `ar2en` asks of it. So a number
 * question is marked against those part cards under the ordinary key it
 * stands in for, and the three number keys are themselves never scheduled
 * or stored. Every key here is in TYPES below; every key it maps from is
 * deliberately not.
 */
export const NUMBER_EQUIVALENT: Record<string, string> = {
  num2fig: "ar2en",
  fig2num: "en2ar",
  fig2pick: "en2pick",
};

export const TYPES = [
  /* 1: what does it mean */
  "ar2pick", "ar2en", "rec2en",
  /* 2: which one is it */
  "match", "en2pick", "ctx2pick",
  /* 3: write it from a cue */
  "tr2ar", "rec2ar", "rec2attr",
  /* 4: write it from its meaning */
  "en2ar", "ctx2ar", "rec2ctx",
  /* and a conversation, on its own levels: 1, 3, 3 */
  "dlgwhole", "dlgpick", "dlgorder",
];

export const EX: Record<string, ExerciseSpec> = {
  /* The gentlest question in the app, and the only one that asks nothing of
     a card beyond a word and its meaning — so it is the one exercise every
     card can do on the day it is written, with no recording, no phrase
     linked to it and no second form.

     It is also the only one that puts words beside each other. Every other
     question holds up one word and asks about it; telling apart two words
     that could be confused is a different thing to know, and it cannot be
     asked one word at a time. Which words stand together is therefore the
     exercise — see matchSet and the pool it is handed. */
  match: {
    /* Its own level, above reading a word on its own: a word is told apart
       from others only once it has been met alone. Through the learning
       steps is enough to get there — the grid is still recognition, and a
       four-day bar in front of it would keep a learner's first week
       without a grid at all. What every level below the writing asks now;
       see LEVEL_BARS. */
    level: 2,
    instruction: "Match each word to its meaning",
    label: "Match the pairs",
    short: "Pairs",
    needs: ["ar", "en", "mates"],
    question: "Match each word to its meaning",
    placeholder: "",
    /* The grid is the question and the answer at once, the way a scene is
       when it is being put in order: nothing goes above the answer box. */
    promptField: "pairs",
    answerField: "en",
    answerMode: "choice",
    picks: "pair",
    gentle: true,
  },
  /* The first thing ever asked of a word: here it is, which of these four
     is what it means. Nothing is written and nothing is produced — the
     answer is on the screen, and all it asks is that the word be told from
     three others. It is where a card starts, and the only thing below
     writing the meaning out.

     Like the grid, it needs company: three other cards to draw the wrong
     answers from, because a wrong answer nobody could believe is not a
     wrong answer. Same need, same count — see `mates`. */
  ar2pick: {
    level: 1,
    instruction: "Choose the meaning",
    label: "{Script} → choose",
    short: "{S}→?",
    needs: ["ar", "en", "mates"],
    question: "What does this mean?",
    placeholder: "",
    promptField: "ar",
    answerField: "en",
    answerMode: "choice",
    picks: "meaning",
    gentle: true,
  },
  ar2en: {
    level: 1,
    instruction: "Write in English",
    label: "{Script} → English",
    short: "{S}→E",
    needs: ["ar", "en"],
    question: "What does this mean?",
    placeholder: "Type the English",
    promptField: "ar",
    answerField: "en",
    hintField: "lat",
    hintLabel: "Show {translit}",
    hintHideLabel: "Hide {translit}",
    answerMode: "en",
    /* Recognition rather than production: read it, do not write it. What
       "Get started" is made of. */
    gentle: true,
  },
  /* Retired. Asking for a romanisation graded somebody's spelling of it
     rather than their Arabic — "kitaab", "kitāb" and "kitab" are the same
     knowledge — and writing one was never a goal of the app. It is out of
     TYPES, so nothing offers it and no card carries a state for it. The
     definition stays, like GRAMMAR.register, because exOf returns null for an
     unknown key and its callers dereference the result: a stored or exported
     reference to the type must still resolve to a label rather than crash. */
  ar2tr: {
    level: 3,
    retired: true,
    instruction: "Write in {translit}",
    label: "{Script} → {translit}",
    short: "{S}→T",
    needs: ["ar", "lat"],
    question: "How is this pronounced?",
    placeholder: "Type the {translit}",
    promptField: "ar",
    answerField: "lat",
    hintField: "en",
    hintLabel: "Show meaning",
    hintHideLabel: "Hide meaning",
    answerMode: "tr",
  },
  tr2ar: {
    /* Production, but from a cue that carries the word: the pronunciation
       is on the screen and what is asked is how it is spelt. */
    level: 3,
    instruction: "Write in {script}",
    label: "{Translit} → {script}",
    short: "T→{S}",
    needs: ["lat", "ar"],
    question: "Write this in {script}",
    placeholder: "",
    promptField: "lat",
    answerField: "ar",
    hintField: "en",
    hintLabel: "Show meaning",
    hintHideLabel: "Hide meaning",
    answerMode: "ar",
  },
  /* Listening exercises carry no hint. Anything shown before answering — the
     meaning, the spelling, the transliteration — is the answer by another
     route, and the point is to work it out from the sound. */
  rec2en: {
    level: 1,
    instruction: "Listen, then write it in English",
    label: "Listen → English",
    short: "L→E",
    needs: ["recs", "en"],
    question: "What does this mean?",
    placeholder: "Type the English",
    promptField: "audio",
    answerField: "en",
    answerMode: "en",
    gentle: true,
  },
  rec2ar: {
    level: 3,
    instruction: "Listen, then write it in {script}",
    label: "Listen → {script}",
    short: "L→{S}",
    needs: ["recs", "ar"],
    question: "Write what you hear",
    placeholder: "",
    promptField: "audio",
    answerField: "ar",
    answerMode: "ar",
  },
  en2ar: {
    level: 4,
    instruction: "Write in {script}",
    label: "English → {script}",
    short: "E→{S}",
    needs: ["en", "ar"],
    question: "Write this in {script}",
    placeholder: "",
    promptField: "en",
    answerField: "ar",
    hintField: "lat",
    hintLabel: "Show {translit}",
    hintHideLabel: "Hide {translit}",
    /* The transliteration of the word being asked for, which is the word:
       read it and all that is left is to spell out what it says, which is
       the level below this one. So it is not opened for you, and taking it
       costs the answer its good mark. */
    hintTells: true,
    answerMode: "ar",
  },
  /* Identify a derived property of the word from its recording. Which
     property is a matter for the language: the pack names one and this
     exercise drills it. A language that declares none never sees this. */
  /* The same word, somewhere different each time.
     A phrase the teacher recorded that contains this word is shown with the
     word taken out. Nothing here is invented: the sentence is one they
     wrote, and the only thing the app does is decide which one to show and
     which word to remove. */
  /* The gentle half of the gap-fill, and the one a word should meet first.
     Reading a word inside a phrase is recognition; writing it there is
     production, and every other word in the app is recognised before it is
     produced. This was the one place that skipped straight to the hard
     half, which is why a learner's first meeting with a word in context
     was also their first chance to get it wrong.

     On the second level for the same reason en2pick is: what it asks for
     is the word, picked out of four, and a word is asked for only once
     what it means is known. */
  ctx2pick: {
    level: 2,
    instruction: "Which word is missing?",
    label: "In a phrase → choose",
    short: "P→C",
    needs: ["ar", "contexts"],
    question: "Which word is missing?",
    placeholder: "",
    promptField: "context",
    answerField: "ar",
    answerMode: "choice",
    picks: "word",
    gentle: true,
  },
  /* The other way round, and a level up: the meaning is given and the word
     itself has to be picked out of four. Recognising a spelling is not
     writing one — the answer is still on the screen — but it is the first
     question about the word rather than about what it means, which is why
     it stands with the grid rather than below it.

     A card is not asked this until its meaning is known: the level below
     is where "what does this mean" lives, and there is nothing to
     recognise the spelling of until then. */
  en2pick: {
    level: 2,
    instruction: "Choose the word",
    label: "English → choose",
    short: "E→?",
    needs: ["en", "ar", "mates"],
    question: "Which one means this?",
    placeholder: "",
    promptField: "en",
    answerField: "ar",
    answerMode: "choice",
    picks: "word",
    gentle: true,
  },
  ctx2ar: {
    level: 4,
    instruction: "Fill the gap",
    label: "In a phrase → {script}",
    short: "P→{S}",
    needs: ["ar", "contexts"],
    question: "Which word is missing?",
    placeholder: "",
    promptField: "context",
    answerField: "ar",
    hintField: "lat",
    hintLabel: "Show {translit}",
    hintHideLabel: "Hide {translit}",
    /* As in English → {script}: the hint is the word itself, said another
       way. */
    hintTells: true,
    answerMode: "ar",
  },
  /* And the same again by ear. Harder than hearing the word alone, which is
     the point: a word inside running speech is what it will sound like when
     it is met for real. */
  rec2ctx: {
    level: 4,
    instruction: "Listen to the phrase, then write this word",
    label: "Phrase heard → {script}",
    short: "H→{S}",
    needs: ["ar", "contextAudio"],
    question: "Which word did you hear?",
    placeholder: "",
    promptField: "audio",
    answerField: "ar",
    answerMode: "ar",
  },
  /* ---- a number, made up on the spot ---------------------------------
     Three questions asked of a number the app has built out of the
     teacher's parts, rather than of a card. Not in TYPES, and for the
     same reason the read-through is not: nothing schedules them and
     nothing carries a state for them. A number is not a card, so there is
     no ladder for it to climb — what a right answer moves is the parts
     that stood in it, the way a sentence credits the words that filled
     its blanks.

     They are ordinary exercise definitions all the same, because the
     screen that asks a question reads `promptField`, `answerMode` and the
     rest, and a question asked any other way would be a second
     implementation of the only screen there is. */
  num2fig: {
    level: 1,
    instruction: "Read the number, then write it in figures",
    label: "{Script} → figures",
    short: "{S}→#",
    needs: ["ar", "en"],
    question: "Which number is this?",
    placeholder: "Type the figures",
    promptField: "ar",
    answerField: "en",
    /* Figures, not English: exact or wrong, and no edit distance. See
       checkAnswer — a number is not nearly another number. */
    answerMode: "fig",
    gentle: true,
  },
  fig2num: {
    level: 4,
    instruction: "Write this number in {script}",
    label: "Figures → {script}",
    short: "#→{S}",
    needs: ["ar", "en"],
    question: "Write this number out",
    placeholder: "",
    promptField: "en",
    answerField: "ar",
    answerMode: "ar",
  },
  fig2pick: {
    level: 2,
    instruction: "Choose the number",
    label: "Figures → choose",
    short: "#→?",
    needs: ["ar", "en", "mates"],
    question: "Which one is this number?",
    placeholder: "",
    promptField: "en",
    answerField: "ar",
    answerMode: "choice",
    picks: "word",
    gentle: true,
  },

  rec2attr: {
    level: 3,
    instruction: "Listen, then choose the {attr}",
    label: "Listen → {attr}",
    short: "L→{A}",
    needs: ["recs", "ar"],
    question: "Which {attr} do you hear?",
    placeholder: "",
    promptField: "audio",
    answerField: "ar",
    answerMode: "choice",
    quizAttr: true,
  },

  /* ---- a conversation, and a part in it -------------------------
     Five exercises on a dialog card, plus the read-through that is not
     one. `dialog` says which of the three things an exercise is asked of
     — a scene, a line inside one, or an ordinary word — and availableTypes
     refuses every other pairing, so a word can never be asked to put
     itself in order and a scene can never be asked what it means.

     `promptField: "scene"` means the question is the conversation so far
     rather than a field on a card. None of them is `audio`, so none is a
     listening exercise: a recording on a line is offered beside it where
     there is one, and changes nothing when there is not. */

  /* Not in TYPES, and deliberately: nothing schedules a read-through and
     nothing marks it. It is put in front of the first question a scene
     asks in a session, because a dialog should never open with a blank. */
  dlgread: {
    level: 1,
    instruction: "Read the scene",
    label: "Read a scene",
    short: "Read",
    needs: ["dialog"],
    dialog: "card",
    question: "Read it through",
    placeholder: "",
    promptField: "scene",
    answerField: "",
    answerMode: "read",
    intro: true,
    gentle: true,
  },
  /* Retired. Translating one line of a conversation is the word question
     with a speaker's name over it: what makes a line worth having is the
     turn before it and the turn after, and asked on its own it had
     neither. Reading the whole scene took its place. */
  dlg2en: {
    level: 1,
    retired: true,
    instruction: "Write this line in English",
    label: "A line → English",
    short: "D→E",
    needs: ["line", "en"],
    dialog: "line",
    question: "What does this line mean?",
    placeholder: "Type the English",
    promptField: "scene",
    answerField: "en",
    hintField: "lat",
    hintLabel: "Show {translit}",
    hintHideLabel: "Hide {translit}",
    answerMode: "en",
    gentle: true,
  },
  /*
   * The whole conversation, read.
   *
   * The one exercise that asks what a scene is actually for: not what one
   * line means or which reply comes next, but whether a page of two people
   * talking can be read and followed. The script is all that is on screen;
   * the transliteration and the meaning are each a tap away, taken when
   * they are needed rather than given.
   *
   * Marked by the learner, because nobody else is in the room. "Did you
   * get all of it" is a question only they can answer, and an app that
   * pretended to check it would be marking something it never saw — so it
   * asks, plainly, and takes the answer. Which makes it worth answering
   * honestly: the schedule is theirs, and a scene they said they followed
   * comes back later than one they did not.
   */
  dlgwhole: {
    level: 1,
    instruction: "Read the whole conversation",
    label: "Read a scene through",
    short: "Whole",
    needs: ["dialog"],
    dialog: "card",
    question: "Could you follow all of it?",
    placeholder: "",
    promptField: "scene",
    answerField: "",
    answerMode: "self",
    /* Recognition, and the gentlest kind: reading with the meaning a tap
       away is where a scene starts. */
    gentle: true,
  },
  dlgpick: {
    level: 3,
    instruction: "Choose what you say next",
    label: "Choose the reply",
    short: "Pick",
    needs: ["line", "reply", "choices"],
    dialog: "line",
    question: "Which reply fits?",
    placeholder: "",
    promptField: "scene",
    answerField: "ar",
    answerMode: "choice",
    picks: "reply",
  },
  /* Retired. Writing your own next turn from scratch asked a learner to
     invent one particular sentence out of the several that would do, and
     marked every other one wrong. Choosing the reply asks the same
     question and can be answered. */
  dlgreply: {
    level: 4,
    retired: true,
    instruction: "Your turn — write it in {script}",
    label: "Your turn → {script}",
    short: "You→{S}",
    needs: ["line", "reply", "ar"],
    dialog: "line",
    question: "What do you say?",
    placeholder: "",
    promptField: "scene",
    answerField: "ar",
    /* The meaning, not the {translit}: what you are meant to say is a
       nudge, and how it is spelled is the answer. */
    hintField: "en",
    hintLabel: "Show meaning",
    hintHideLabel: "Hide meaning",
    answerMode: "ar",
  },
  /* Putting lines in order is choosing among them, not writing them: a
     level above reading the scene, and beside choosing the reply. */
  dlgorder: {
    level: 3,
    instruction: "Put the scene back in order",
    label: "Put a scene in order",
    short: "Order",
    needs: ["dialog", "order"],
    dialog: "card",
    question: "Which line comes first?",
    placeholder: "",
    promptField: "scene",
    answerField: "",
    answerMode: "order",
  },
  /* Retired. Every turn of a scene typed out at once was the longest
     answer in the app and the least forgiving: one missed mark in the
     third line made the whole conversation wrong. */
  dlgplay: {
    level: 4,
    retired: true,
    instruction: "Play your part in {script}",
    label: "Play a part",
    short: "Part",
    needs: ["dialog", "part"],
    dialog: "card",
    question: "Hold up your end",
    placeholder: "",
    promptField: "scene",
    answerField: "ar",
    answerMode: "part",
  },
};

/* An exercise that plays a recording and asks what was in it. The listening
   ones are exactly the specs prompted by audio — named here, beside the table
   it reads, so a fourth of them needs no second edit anywhere else. */
/* Takes nothing as well as a name: it is asked about whatever a stored
   session holds, which may name an exercise that has since been retired,
   or nothing at all. */
/* ---- a schedule key ----

   What a card records progress against. It used to be the exercise type
   alone, and mostly still is — but a card may accept more than one word,
   and knowing one spelling is not knowing the other. So where a question
   shows a single accepted answer (see showsOneAnswer above), each answer
   carries its own progress, and the key says which:

       "ar2en"     the first accepted answer, or the only one
       "ar2en@1"   the second

   The first answer keeps the bare type deliberately. Every card written
   before this reads back exactly as it did, sync goes on merging state key
   by key without being told anything, and a card with one answer — which
   is almost all of them — has no suffix anywhere in its document.

   Everything that looks an exercise up goes through typeOf first, so a key
   can be handed to any of it. */

const KEY_SEP = "@";

/** The key a type and an answer are recorded under. */
export const keyFor = (type: string, at = 0): string =>
  at > 0 ? `${type}${KEY_SEP}${at}` : String(type);

/** The exercise a key is about, whichever kind of key it is. */
export const typeOf = (key: string): string => String(key || "").split(KEY_SEP)[0];

/** And which accepted answer. Zero for a bare type. */
export const answerOf = (key: string): number =>
  Math.max(0, Math.floor(Number(String(key || "").split(KEY_SEP)[1]) || 0));

export const isListening = (key?: string | null): boolean => {
  const spec = key ? EX[typeOf(key)] : null;
  return !!spec && spec.promptField === "audio";
};

/* "na" maps to nothing on purpose: a form whose number does not apply should
   carry no number label at all, not the letters "na". labelFor falls back to
   the raw value for anything missing here, so the empty string is load
   bearing. */
export const NUMBER_SHORT: Record<string, string> = { singular: "sg.", plural: "pl.", na: "" };

export const GENDER_SHORT: Record<string, string> = { masculine: "m.", feminine: "f.", neutral: "n." };

export function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/* The grammatical values a card carries. Which of them mean anything is the
   language's business; a card simply keeps whatever it was given, so material
   written for one language survives a look through another. */
/* ------------------------------------------------------------------
   What kind of thing a card is

   A word, a phrase, a sentence, or a conversation. It decides what a
   learner can filter practice down to, how the script is typeset, and —
   the reason it is being taken seriously now — whether a card can serve as
   a context for the words inside it.

   It lives here rather than in the app because the answer is the language's
   business: "a space means more than one word" holds for Arabic and
   Vietnamese and fails flatly for a script written without spaces between
   words. A pack that needs a different rule declares `guessKind` and the app
   is none the wiser; every other pack gets this one.
   ------------------------------------------------------------------ */

/* Sentence-ending punctuation, Latin and Arabic. */
const SENTENCE_MARK = /[.!?،؛؟]/;

/*
 * The kinds there are, named once.
 *
 * A conversation is one of them. It was built later than the other three
 * and for a while it read as a separate sort of thing — its own button to
 * make one, its own word for the editor that made it — which is not what
 * it is: it is a card, with turns on it instead of a word. Every screen
 * that names a kind reads this list, so there is one answer to "what can a
 * card be" rather than one per screen.
 *
 * The first three are read off the text by guessKind below; the fourth is
 * the teacher's own decision, because nothing about a line of script says
 * whether somebody else was going to answer it.
 */
export const CARD_KINDS = [
  { key: "word", label: "Word", one: "a word" },
  { key: "phrase", label: "Phrase", one: "a phrase" },
  { key: "sentence", label: "Sentence", one: "a sentence" },
  { key: DIALOG_KIND, label: "Conversation", one: "a conversation" },
];

export const kindLabel = (kind?: string): string =>
  (CARD_KINDS.find((k) => k.key === kind) || CARD_KINDS[0]).label;

/* What a stored card is, asked of the card rather than of a label on it:
   a card with turns is a conversation, and everything else is read off
   its text. See isDialog — the turns are the fact. */
export const kindOf = (
  card: Record<string, any>,
  lang: { guessKind?: (text: string) => string } | null = null,
): string => {
  if (isDialog(card)) return DIALOG_KIND;
  if (card && card.kind) return card.kind;
  /* Guessed from the card's own word, which since 0.138 is the first of
     its forms rather than the card itself. A plain form is its own lead,
     so a caller holding one reads the same answer. */
  const word = leadOf(card);
  return guessKind(word.ar || word.en || word.lat, lang);
};

/**
 * @param text  Whatever the card holds, which for an empty field is nothing at all.
 * @param lang  A pack, or as much of one as the caller has: only its own rule is read.
 */
export function guessKind(text?: string | null, lang: { guessKind?: (text: string) => string } | null = null): string {
  const t = String(text || "").trim();
  const own = lang && lang.guessKind;
  if (own) return own(t);
  if (!t) return "word";
  /* Punctuation, or four words or more: long enough to be a sentence
     whether or not it was punctuated. */
  if (SENTENCE_MARK.test(t) || t.split(/\s+/).length >= 4) return "sentence";
  return /\s/.test(t) ? "phrase" : "word";
}

export function dimValues(src: Record<string, any> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dim of Object.values(GRAMMAR)) {
    const allowed = dim.options.map(([v]) => v);
    const given = src[dim.field];
    /* Where a dimension declares a default, that is what a new or unreadable
       value becomes — so what a blank form starts as is the language's call
       rather than an accident of which option happens to be listed first. */
    out[dim.field] = allowed.includes(given)
      ? given
      : dim.required
      ? dim.default || allowed[0]
      : "";
  }
  for (const lang of Object.values(LANGUAGES)) {
    if (lang.lexical) {
      const k = lang.lexical.key;
      out[k] = typeof src[k] === "string" ? src[k].trim() : "";
    }
  }
  return out;
}

/*
 * How a form is named in the card list: "pl. f." in Arabic, "elder" in
 * Vietnamese. Only the dimensions this language uses get a mention.
 *
 * Takes a form or one of its answers, because grammar lives on the answer
 * now and a form is named after what it accepts. Where a form is handed in
 * whole, its first answer speaks for it — which is exactly right for the
 * job this does: saying which of a card's forms is being asked about. A
 * question narrowed to one accepted answer hands that answer's values in
 * directly (see withAnswer), so what the tag says is what is on screen.
 */
export function labelFor(unit: Record<string, any>, lang: Lang = activeLang()) {
  const bits = [];
  const dims = dimsOf(lang);
  /* Its own values where it has any — an answer, or a form written before
     the change — and otherwise the first answer's. */
  const own = dims.some((dim) => unit && unit[dim.field]);
  const named = own ? unit : answersOf(unit, answerFields())[0] || {};
  for (const dim of dims) {
    const value = named[dim.field];
    if (!value) continue;
    /* ?? rather than ||, so a value whose short form is deliberately empty —
       N/A, which should name nothing — stays empty instead of falling back to
       its own id. An unknown value still falls back, which is the point of
       the fallback. */
    if (dim.field === "number") bits.push(NUMBER_SHORT[value] ?? value);
    else if (dim.field === "gender") bits.push(GENDER_SHORT[value] ?? value);
    else if (dim.short) bits.push(dim.short[value] ?? value);
    else {
      const opt = dim.options.find(([v]) => v === value);
      bits.push(opt ? opt[1] : value);
    }
  }
  return bits.filter(Boolean).join(" ");
}

export const AR_KEY_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز", "ظ"],
];

export const AR_EXTRAS = ["أ", "إ", "آ", "ـ", "،", "؟"];

export const AR_MARKS = ["\u064E", "\u064F", "\u0650", "\u0652", "\u0651", "\u064B", "\u064C", "\u064D"];

export const VI_KEY_ROWS = [
  ["ă", "â", "đ", "ê", "ô", "ơ", "ư"],
  ["à", "á", "ả", "ã", "ạ", "è", "é", "ẻ", "ẽ", "ẹ"],
  ["ì", "í", "ỉ", "ĩ", "ị", "ò", "ó", "ỏ", "õ", "ọ"],
  ["ù", "ú", "ủ", "ũ", "ụ", "ỳ", "ý", "ỷ", "ỹ", "ỵ"],
];

export const VI_EXTRAS = ["ằ", "ắ", "ẳ", "ẵ", "ặ", "ầ", "ấ", "ẩ", "ẫ", "ậ"];

export const VI_MARKS = ["\u0300", "\u0301", "\u0309", "\u0303", "\u0323"];

/* Tone marks are to Vietnamese roughly what harakat are to Arabic: part of
   the spelling, but not always typed. */
export const VI_TONES = /[\u0300\u0301\u0303\u0309\u0323]/;

export function normViet(s: string, { stripTones }: { stripTones?: boolean }) {
  let x = stripInvisible(s).trim().toLowerCase().normalize("NFD");
  if (stripTones) x = x.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "");
  /* Đ is a letter in its own right, not a d with a mark: it survives NFD
     untouched, and it is not folded into d — the rules promise that typing
     d for đ is marked wrong, and for a while this line quietly broke that
     promise by doing exactly the folding it said it didn't. */
  x = x.replace(/[.,!?;:'"()[\]]/g, "").replace(/[-\u2010\u2013_]/g, " ");
  return x.replace(/\s+/g, " ").trim().normalize("NFC");
}

/* ------------------------------------------------------------------
   Finding a word inside a phrase

   A phrase the teacher recorded that contains a word the teacher also
   teaches is a context for that word — and it is the one kind of variety
   this app can offer without inventing content, because the teacher already
   wrote it when they added the phrase.

   Every part of "does this phrase contain this word" is the language's
   business and none of it is the app's. Arabic glues ال and و and ب onto
   the front of a word, so الكتاب contains كتاب; Vietnamese glues nothing to
   anything; a script written without spaces between words would not even
   agree about where a token starts. So a pack that wants this declares a
   `context` block, and a pack that does not simply has no context
   exercises. That is the expected case, not a failure.

     context: {
       tokens?: (text) => string[]   // defaults to splitting on whitespace
       matches: (token, word) => boolean
     }

   Matching is token-by-token rather than by substring on purpose. A
   substring hit gives a position in the *normalised* text, and normalising
   Arabic drops harakat, so that position means nothing in the text a
   learner would actually be shown. A token index survives, which is what
   lets the same match blank the right word later.
   ------------------------------------------------------------------ */

/* A predicate rather than a boolean, so that passing it says something:
   everything below it may read `lang.context.matches` without asking
   again whether this language has one. */
export function supportsContext(lang?: Partial<Lang> | null): lang is Lang {
  return !!(lang && lang.context && lang.context.matches);
}

export function contextTokens(text: string, lang: Lang) {
  const own = lang && lang.context && lang.context.tokens;
  const t = String(text || "").trim();
  if (!t) return [];
  return own ? own(t) : t.split(/\s+/);
}

/*
 * Where `word` sits inside `phrase`: which token it starts at, and how many
 * it takes. Null when it is not there.
 *
 * The count is the word's own — a card that reads "cà phê" is two tokens
 * wherever it turns up, so two tokens of the phrase are joined and offered
 * to the language's matcher together. That is the whole of what it takes
 * to find a compound inside a sentence, and it needs nothing from the pack
 * beyond the matcher it already declares: a language whose words are one
 * token asks the same question it always asked.
 *
 * A span rather than an index because the gap-fill blanks what it finds,
 * and blanking one syllable of a two-syllable word is a question with a
 * clue in it.
 */
/**
 * @param lang  A language that declares no context finds nothing, which is the point.
 */
export function findWordSpan(phrase: string, word: string, lang: Partial<Lang>): { at: number; len: number } | null {
  if (!supportsContext(lang) || !phrase || !word) return null;
  const tokens = contextTokens(phrase, lang);
  const len = Math.min(contextTokens(word, lang).length, MAX_WORD_TOKENS);
  if (!len || len > tokens.length) return null;
  for (let i = 0; i + len <= tokens.length; i++) {
    const window = len === 1 ? tokens[i] : tokens.slice(i, i + len).join(" ");
    if (lang.context.matches(window, word)) return { at: i, len };
  }
  return null;
}

/* A card longer than this is not a word anybody is going to find inside a
   sentence, and pairing every card with every window of every other one is
   the sort of work that grows with the square of a deck. */
const MAX_WORD_TOKENS = 6;

/*
 * The same question, answered as an index. Kept because most of the app
 * only ever asks "is it in there, and where does it start".
 */
export function findWordSlot(phrase: string, word: string, lang: Partial<Lang>) {
  const span = findWordSpan(phrase, word, lang);
  return span ? span.at : -1;
}

/*
 * What a card would need before an exercise could be asked of it.
 *
 * Said in the words a person uses about their own card — "a recording",
 * "the meaning" — rather than the field names the table is written in.
 * It exists for the screen that lists every exercise a card could have and
 * greys out the ones it cannot: a greyed-out button that does not say why
 * is a puzzle, and the answer is always something small and fixable.
 *
 * Language-aware, because two of these have a different name in every
 * language: the script and the second writing.
 */
/**
 * @param need  One of an exercise's `needs`.
 */
export function needLabel(need: string, lang: Partial<Lang>) {
  /* The transliteration's label is lowered, because these are sentence
     fragments and the pack's labels are titles: a card is waiting for "the
     transliteration", not for "the Transliteration". The script's is not,
     because it is a name — the word wanted is "the word in Arabic script",
     and "arabic" is wrong in the middle of a line as much as at the start
     of one. */
  const script = (lang && lang.scriptLabel) || "the script";
  const translit = ((lang && lang.translitLabel) || "a romanisation").toLowerCase();
  /* A variable with nothing to put in it names itself: "a card that fills
     {{name}}" is a job somebody can go and do, where "a value" is a riddle.
     The names travel in the need itself, because which variable is short is
     a fact about this card rather than about the exercise. */
  if (need.startsWith("fills:")) {
    const wanted = need.slice(6).split(",").filter(Boolean);
    if (wanted.length) {
      return `a card that fills ${wanted.map((n) => `{{${n}}}`).join(" and ")}`;
    }
  }
  const names: Record<string, string> = {
    mates: "a few more cards in this language",
    ar: `the word in ${script}`,
    en: "the meaning",
    lat: `the ${translit}`,
    recs: "a recording",
    /* Not a field to fill in: a card whose words vary cannot be the one on
       a recording, so hearing it is the one thing a variable costs. */
    fixed: "words that don't change — neither a recording nor a grid can follow a variable",
    contexts: "a phrase that uses it",
    contextAudio: "a recorded phrase that uses it",
    dialog: "a conversation",
    line: "a line of a conversation",
    reply: "something said before it",
    choices: "a third line to choose between",
    order: "three lines or more",
    part: "a part to play",
  };
  return names[need] || need;
}

/*
 * Words not worth a card of their own.
 *
 * Every language has a few dozen: the prepositions, the particles, the
 * words that hold a sentence together and mean nothing much alone. They
 * are worth naming because the app now offers a teacher the words their
 * own phrases contain and no card covers — and a list of suggestions whose
 * first ten entries are "in", "of" and "the" is a list nobody reads twice.
 *
 * Pack data rather than app data: which words these are is the one part of
 * the question the app cannot work out, and the one part a language always
 * knows. A pack that names none loses nothing but a little noise.
 */
export function isFunctionWord(word: string, lang: Partial<Lang>) {
  const own = (lang && lang.context && lang.context.skip) || [];
  if (!own.length) return false;
  const matches = lang && lang.context && lang.context.matches;
  if (!matches) return false;
  return own.some((w) => matches(word, w));
}

/*
 * How much of a collection is already teachable in context.
 *
 * Given cards, pairs every word card with the phrase and sentence cards
 * that contain it. Nothing is written and nothing is decided: this is the
 * number that says whether context exercises are worth building for a
 * given deck, and it comes from real material rather than a guess.
 *
 * Cards are the teacher's shape — { id, ar, en, kind } — so this can be run
 * from the teaching space without loading a learner's progress.
 */
/**
 * @param lang  A language that declares no context is reported as unsupported, not as empty.
 */
export function contextCoverage(cards: Record<string, any>[], lang: Partial<Lang>) {
  const empty = {
    supported: false, words: [], counts: { word: 0, phrase: 0, sentence: 0, dialog: 0 }, covered: 0, links: 0,
  };
  if (!supportsContext(lang)) return empty;

  const counts: Record<string, number> = { word: 0, phrase: 0, sentence: 0, dialog: 0 };
  const words: Record<string, any>[] = [];
  const contexts: Record<string, any>[] = [];
  for (const c of cards || []) {
    /* A conversation has no text of its own — its words are in its turns —
       so it stands here as its turns. Counted as the one card it is, and
       matched as the several phrases it holds: reading `ar` off the card
       found an empty string, so every scene a teacher wrote counted for
       nothing in this number. */
    if (isDialog(c)) {
      counts.dialog += 1;
      for (const line of linesOf(c)) {
        if (line && line.ar) contexts.push({ id: c.id, ar: line.ar, en: line.en || "" });
      }
      continue;
    }
    const kind = c.kind || guessKind(c.ar || c.en || c.lat, lang);
    counts[kind] = (counts[kind] || 0) + 1;
    if (kind === "word") words.push(c);
    else contexts.push(c);
  }

  let links = 0;
  const out = words.map((w) => {
    /* Every context, not just the first: the point of the exercise is that
       a word turns up somewhere different each time it comes round. */
    const found = contexts.filter((c) => findWordSlot(c.ar, w.ar, lang) >= 0);
    links += found.length;
    return { id: w.id, ar: w.ar, en: w.en, contexts: found.map((c) => ({ id: c.id, ar: c.ar, en: c.en })) };
  });

  return {
    supported: true,
    counts,
    words: out.sort((a, b) => b.contexts.length - a.contexts.length),
    covered: out.filter((w) => w.contexts.length > 0).length,
    links,
  };
}

/* ---- Arabic ----
   Proclitics: the conjunctions و and ف, the prepositions ب ل ك, and the
   article ال, which stack — وبالكتاب is one token and four pieces.

   Enclitics: the pronouns that attach to the end — كتابك is your book and
   كتابها is hers, and a learner meeting either of them is meeting كتاب.
   A word carrying one was invisible to this until now, so a phrase that
   used the word in the ordinary way — with somebody owning it — taught
   the word to nobody.

   Peeled rather than pattern-matched, because the combinations multiply and
   a list of them goes stale. Two peels deep at each end is enough for
   anything real, and the remainder must keep three letters: Arabic words
   are built on three consonants, so a two-letter remainder is the sign of
   having peeled away the word itself rather than an affix.

   It will still occasionally offer a wrong match — كتاب peels to تاب, which
   is a word. That is why a match is a suggestion for the teacher to accept,
   never a fact the app acts on by itself. */
const AR_PROCLITICS = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];

/* Longest first, so كتابهم peels هم rather than م and then stops. The
   single ي is left out on purpose: it is the first person possessive and
   also the last letter of a great many words, and peeling it turns كرسي
   into كرس. */
const AR_ENCLITICS = ["هما", "كما", "هنّ", "كنّ", "هن", "كن", "هم", "كم", "نا", "ها", "ه", "ك"];

const AR_STEM_FLOOR = 3;

export function arWordStems(token: string, depth = 2) {
  const out = [token];
  const peel = (list: string[], take: (s: string) => string | null, left: number): void => {
    if (left <= 0) return;
    for (const found of list) {
      /* Each affix is tried against everything peeled so far, so a word
         wrapped at both ends — وبكتابهم — comes apart from either side. */
      for (const s of out.slice()) {
        if (!s.startsWith(found) && !s.endsWith(found)) continue;
        const rest = take(s);
        if (!rest || rest.length < AR_STEM_FLOOR || out.includes(rest)) continue;
        out.push(rest);
      }
    }
  };
  for (let i = 0; i < depth; i++) {
    peel(AR_PROCLITICS, (s) => {
      const p = AR_PROCLITICS.find((x) => s.startsWith(x));
      return p ? s.slice(p.length) : null;
    }, 1);
    peel(AR_ENCLITICS, (s) => {
      const e = AR_ENCLITICS.find((x) => s.endsWith(x));
      return e ? s.slice(0, -e.length) : null;
    }, 1);
  }
  return out;
}

export function arTokenIsWord(token: string, word: string) {
  const opts = { stripTashkeel: true, ignoreHamza: true };
  const w = normAr(word, opts);
  if (!w) return false;
  const t = normAr(token, opts);
  if (!t) return false;
  return arWordStems(t).includes(w);
}

/* ---- Vietnamese ----
   Nothing is glued to anything, so a token is the word or it is not. Tones
   are kept: ma and má are different words, and treating them as the same
   one would be the same mistake the checker refuses to make. */
export function viTokenIsWord(token: string, word: string) {
  const opts = { stripTones: false };
  const w = normViet(word, opts);
  return !!w && normViet(token, opts) === w;
}

export function checkViet(given: string, expected: string, settings: Settings) {
  const mode = settings.tones || "either";
  const forms = splitForms(expected, /[/;]/);
  let worst = { ok: false, reason: "wrong" };

  for (const form of forms) {
    const bareG = normViet(given, { stripTones: true });
    const bareE = normViet(form, { stripTones: true });
    if (!bareG) continue;
    if (bareG !== bareE) {
      const near = editDistance(bareG, bareE) <= Math.max(1, Math.round(bareE.length * 0.2));
      if (near && worst.reason === "wrong") worst = { ok: false, reason: "near" };
      continue;
    }
    if (mode === "ignore") return { ok: true, reason: "letters-only" };

    const givenHas = VI_TONES.test(given.normalize("NFD"));
    const storedHas = VI_TONES.test(form.normalize("NFD"));
    if (!storedHas) return { ok: true, reason: givenHas ? "unchecked" : "letters-only" };
    if (!givenHas) {
      if (mode === "required") {
        worst = { ok: false, reason: "missing" };
        continue;
      }
      return { ok: true, reason: "bare" };
    }
    const fullG = normViet(given, { stripTones: false });
    const fullE = normViet(form, { stripTones: false });
    if (fullG === fullE) return { ok: true, reason: "exact" };
    worst = { ok: false, reason: "harakat" }; // wrong tone
  }
  return worst;
}

export const GRAMMAR: Record<string, GrammarDim> = {
  number: {
    label: "Number",
    field: "number",
    required: true,
    /* "na" is last, and deliberately not first: an unrecognised or missing
       value falls back to `default` where one is declared, but normDimValue
       still matches options in order, and reordering these would change what
       a stored value already means. */
    options: [
      ["singular", "singular"],
      ["plural", "plural"],
      ["na", "N/A"],
    ],
    /* Most words a teacher writes are not usefully singular or plural, and
       guessing wrong labels every form in the card list. Start at "doesn't
       apply" and let them say otherwise. */
    default: "na",
  },
  gender: {
    label: "Gender",
    field: "gender",
    required: false,
    options: [
      ["masculine", "masculine"],
      ["feminine", "feminine"],
      ["neutral", "neutral"],
    ],
  },
  /* Whether a noun is a person or a thing. Not a way of telling its forms
     apart — nothing is ever asked "the person one" — but the fact that
     decides what agrees with it: in Arabic a plural of things takes the
     feminine singular adjective (كتب كبيرة) and a plural of people the
     plural (معلمين كبار). Animals count as things. Silent on every tag,
     which `short` says; starts as a thing, because most nouns are. */
  human: {
    label: "Person or thing",
    field: "human",
    required: true,
    options: [
      ["thing", "a thing"],
      ["person", "a person"],
    ],
    default: "thing",
    short: { thing: "", person: "" },
  },
  /* Retired. Addressee turned out not to be a property of a word — chó is
     chó whoever is listening — but of an utterance containing an address
     term, and those are better held as plain forms of one card. No language
     declares this axis any more. The definition stays so that cards saved
     while it existed keep their value in storage and export instead of
     having it silently stripped. */
  register: {
    label: "Addressee",
    field: "register",
    required: false,
    retired: true,
    options: [
      ["em", "younger (em)"],
      ["peer", "peer (anh / chị)"],
      ["elder", "elder (bác)"],
    ],
  },
};

export const dimsOf = (lang: Lang): GrammarDim[] =>
  (lang.grammar || []).map((k) => GRAMMAR[k]).filter(Boolean);

/**
 * The axes a word of one kind is asked about: the kind's own list where
 * it has one, and the pack's otherwise — always within the pack's, so the
 * shared category list can name an axis and a language without it is
 * untouched. What is *stored* is never narrowed by this; see dimValues.
 */
export const dimsFor = (
  lang: Lang | null | undefined,
  category: string | null | undefined,
): GrammarDim[] => {
  if (!lang) return [];
  const kind = categoryOf(lang, category);
  const own = kind && kind.grammar;
  return own ? dimsOf(lang).filter((d) => own.includes(d.field)) : dimsOf(lang);
};

/*
 * The persons a language with subject agreement declares, ready to be
 * spread into a pack.
 *
 * Here rather than written out twice because Arabic and Hebrew mark a verb
 * for the same seven — the two are not related by accident — and a pack
 * that wants six or nine simply writes its own. Nothing reads this but the
 * packs below.
 *
 * `picks` is the agreement rule, and it is deliberately only on the third
 * person: those are the columns a *noun* in the subject can call for. A
 * sentence filled with Sarah wants "she", one filled with the children
 * wants "they", and nothing a teacher drops into a hole is ever "I" or
 * "you" — a frame that wants those says so itself. "they" asks for number
 * alone, so a plural of either gender reaches it; the two singulars ask
 * for both and therefore win over it wherever they match, by the
 * most-specific rule in verbs.ts.
 */
const SUBJECT_PERSONS: VerbPerson[] = [
  { id: "i", label: "I" },
  { id: "you-m", label: "you (m)" },
  { id: "you-f", label: "you (f)" },
  { id: "he", label: "he", picks: { number: "singular", gender: "masculine" } },
  { id: "she", label: "she", picks: { number: "singular", gender: "feminine" } },
  { id: "we", label: "we" },
  { id: "they", label: "they", picks: { number: "plural" } },
];

/*
 * The pronouns a word takes on its end, for a language that attaches them.
 *
 * Arabic and Hebrew write "my book" as one word, and the same endings carry
 * a preposition: عند is *at*, عندي is *I have*. Those are forms of the word
 * and things to learn, and until now there was nowhere to put them — the
 * verb table has an axis for who is doing it and none for who it is about.
 *
 * One row, because there is only one thing varying. Everything else about
 * it is a table like any other, which is what lets it be declared this way
 * and read by the functions the verb table already uses.
 *
 * The columns name the pronoun that attaches rather than what it does to
 * the word, because what it does differs: -ي on كتاب is *my* and on عند is
 * *I*. Each cell's English is typed, as every cell's is, and that is where
 * the difference is said.
 *
 * No `picks`. Agreement is a rule about the subject of a sentence, and
 * nothing here is a subject: a frame does not choose between كتابي and
 * كتابك by looking at who is in it.
 */
const ATTACHED_PERSONS: VerbPerson[] = [
  { id: "me", label: "me" },
  { id: "you-m", label: "you (m)" },
  { id: "you-f", label: "you (f)" },
  { id: "him", label: "him" },
  { id: "her", label: "her" },
  { id: "us", label: "us" },
  { id: "you-pl", label: "you (pl)" },
  { id: "them", label: "them" },
];

/* Declared once and spread into both packs, the way the persons above are:
   the row is named rather than numbered so that a cell says which table it
   is in wherever it turns up, and no other table may use the name. */
const ATTACHED_TABLE: VerbSpec = {
  persons: ATTACHED_PERSONS,
  tenses: [{ id: "attached", label: "attached pronouns" }],
  label: "attached pronouns",
  /* Every cell waits on the word it is on the end of, and every form of
     the word carries a table of its own: the plural takes the same
     endings and has eight of its own. */
  gate: "word",
  perForm: true,
};

/*
 * The forms an adjective takes to agree with its noun.
 *
 * The card's own word is the masculine singular and is not a cell; the
 * cells are the other forms. One row, like the pronouns, and for the same
 * reason: one thing varies. Unlike the pronouns, the columns carry
 * `picks`, because these *are* chosen by looking at what is beside them —
 * سيارة wants كبيرة — which is the whole point of laying them out. A
 * plural of people takes the plural; a plural of things takes the
 * feminine singular, which is what the person-or-thing axis on a noun is
 * for, and what 0.141 reads.
 */
const AR_AGREEMENT: VerbSpec = {
  persons: [
    {
      id: "feminine",
      label: "feminine",
      /* A feminine singular noun, or a plural of things — كتب كبيرة. The
         second is one key against the plural column's two, so a plural
         of people goes to the plural column and everything else plural
         comes here, which is the rule. */
      picks: [
        { number: "singular", gender: "feminine" },
        { number: "plural", human: "thing" },
      ],
    },
    { id: "plural", label: "plural", picks: { number: "plural", human: "person" } },
  ],
  tenses: [{ id: "agreement", label: "agreement" }],
  label: "feminine and plural",
  gate: "word",
};

/* Hebrew agrees in both at once, so the plural is two cells. */
const HE_AGREEMENT: VerbSpec = {
  persons: [
    { id: "feminine", label: "feminine", picks: { number: "singular", gender: "feminine" } },
    { id: "masc-plural", label: "masculine plural", picks: { number: "plural", gender: "masculine" } },
    { id: "fem-plural", label: "feminine plural", picks: { number: "plural", gender: "feminine" } },
  ],
  tenses: [{ id: "agreement", label: "agreement" }],
  label: "feminine, masculine plural and feminine plural",
  gate: "word",
};

/*
 * The form a number takes with a feminine noun.
 *
 * Its own table rather than the adjective's with a cell left blank, and
 * the reason is the picks: the noun a number counts is plural, so an
 * agreement table's plural column would fire on every one of them and
 * select a cell nobody fills. A number's column picks on gender alone.
 * Which form goes in which box is the teacher's typing — ثلاثة in the
 * word, ثلاث here — so the reversed agreement of three to ten is written
 * down rather than known.
 */
const COUNTED_TABLE: VerbSpec = {
  persons: [{ id: "feminine", label: "feminine", picks: { gender: "feminine" } }],
  tenses: [{ id: "counted", label: "counted" }],
  label: "feminine",
  gate: "word",
};

/* ---- how a language builds its numbers ----

   Declared once per pack, because this is the part that is genuinely
   different everywhere: Arabic says the unit before the ten and puts a و
   in front of every chunk, Hebrew says the ten before the unit and puts a
   ו in front of only the last, and Huế changes the word for five when it
   follows a ten and says *không trăm* — no hundred — in the middle of a
   thousand so that the places still line up.

   None of that is in src/numbers.ts, and none of it should be. What the
   app knows is how to find the card a part is written on and how far a
   deck reaches; what a pack knows is the language. The test of the split
   is that a fourth language should be addable here and nowhere else.

   Two rules every `spell` below follows:

     * **Ask for a part, and give up if it is not there.** `ctx.word` is ""
       for a box the teacher has not filled, and returning null is how a
       deck that stops at ten is never asked for a hundred.
     * **Say what was used.** The values in `used` are the cards that stood
       in the number, and they are what a right answer credits.

   The bands are the one thing they share, so they are declared once and
   spread in. They are a ramp rather than a classification — each is a
   stretch the practice opens only once everything below it can be built —
   which is why they are the same shape in three languages that agree
   about nothing else. */
const NUMBER_BANDS: NumberBand[] = [
  { id: "units", label: "0 to 10", from: 0, to: 10 },
  { id: "teens", label: "11 to 20", from: 11, to: 20 },
  { id: "tens", label: "21 to 99", from: 21, to: 99 },
  { id: "hundreds", label: "100 to 999", from: 100, to: 999 },
  { id: "thousands", label: "1,000 to 9,999", from: 1000, to: 9999 },
  { id: "tens-of-thousands", label: "10,000 to 99,999", from: 10000, to: 99999 },
  { id: "hundreds-of-thousands", label: "100,000 to 999,999", from: 100000, to: 999999 },
  { id: "millions", label: "1,000,000 to 9,999,999", from: 1000000, to: 9999999 },
];

/** A run of values — the tens are 20, 30 … 90, which is tedious to write
    out three times and easy to get wrong once. */
const numRun = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

/*
 * Arabic and Hebrew ask for the same boxes: every unit, every teen as its
 * own word, the tens, and every hundred and thousand because both fuse
 * them — خمسمية is not خمسة followed by مية, and שלוש מאות is two words
 * where תשע מאות is two different ones. A language that built its
 * hundreds regularly would declare one box for *hundred* and let the
 * pack multiply, the way Huế does below.
 */
const SEMITIC_NUMBER_GROUPS = [
  {
    id: "units",
    label: "Zero to ten",
    note: "The words everything else is built out of.",
    parts: numRun(0, 10, 1).map((value) => ({ value })),
  },
  {
    id: "teens",
    label: "Eleven to nineteen",
    note: "Each is its own word rather than a ten and a unit.",
    parts: numRun(11, 19, 1).map((value) => ({ value })),
  },
  {
    id: "tens",
    label: "The tens",
    note: "Twenty to ninety. Everything between them is built from these and a unit.",
    parts: numRun(20, 90, 10).map((value) => ({ value })),
  },
  {
    id: "hundreds",
    label: "The hundreds",
    note: "One hundred to nine hundred, each written out — the hundreds fuse with the unit in front of them, so they cannot be built.",
    parts: numRun(100, 900, 100).map((value) => ({ value })),
  },
  {
    id: "thousands",
    label: "The thousands",
    note: "One thousand to nine thousand. Anything above nine thousand is built from these.",
    parts: numRun(1000, 9000, 1000).map((value) => ({ value })),
  },
  {
    id: "millions",
    label: "The millions",
    note: "One million to nine million.",
    parts: numRun(1000000, 9000000, 1000000).map((value) => ({ value })),
  },
];

/**
 * The feminine box beside a unit, which both Semitic packs already lay
 * out as the `counted` table and which the Numbers screen is simply
 * another way into.
 *
 * Arabic's `spell` does not read it — counting aloud in Arabic uses the
 * form the card's own word already holds — but an adjective agreeing with
 * a counted noun does, which is what 0.141 added. Hebrew's `spell` does
 * read it: counting in the abstract is feminine there, so *three* said on
 * its own is שלוש and not שלושה.
 */
const semiticNumberCells = (value: number): NumberCell[] =>
  value >= 1 && value <= 19
    ? [{ id: "feminine", row: "counted", label: "feminine", hint: "The form used with a feminine noun." }]
    : [];

/**
 * Palestinian Arabic.
 *
 * Chunks, largest first, joined by و — مية وخمسة وعشرين. Inside a chunk
 * the unit comes before the ten and takes the same و, which is why the
 * join is uniform: every piece after the first wears one.
 */
const AR_NUMBERS: NumberSpec = {
  groups: SEMITIC_NUMBER_GROUPS,
  bands: NUMBER_BANDS,
  cells: semiticNumberCells,
  spell(value: number, ctx: NumberCtx): Spelling | null {
    /* A card written for the whole number wins over building one, which is
       how anything this pack gets wrong can be overridden by the teacher
       simply writing it down. */
    const exact = ctx.word(value);
    if (exact) return { text: exact, used: [value] };

    const used: number[] = [];
    /* One to 999, as it is said inside a larger number. */
    const under1000 = (n: number): string | null => {
      const bits: string[] = [];
      const take = (v: number): boolean => {
        const w = ctx.word(v);
        if (!w) return false;
        bits.push(w);
        used.push(v);
        return true;
      };
      const hundreds = Math.floor(n / 100) * 100;
      const tail = n % 100;
      if (hundreds && !take(hundreds)) return null;
      if (tail) {
        /* The teens are words in their own right and the tens are round,
           so only what is left needs a unit and a ten put together. */
        if (tail <= 19 || tail % 10 === 0) {
          if (!take(tail)) return null;
        } else if (!take(tail % 10) || !take(tail - (tail % 10))) return null;
      }
      return bits.length ? bits.join(" و") : null;
    };

    const chunks: string[] = [];
    /* A scale said as its own word where the teacher wrote one — تلات
       آلاف is a box on the screen — and counted out where they did not,
       which is what carries eleven thousand. */
    const scale = (count: number, unit: number): boolean => {
      if (!count) return true;
      const whole = ctx.word(count * unit);
      if (whole) {
        chunks.push(whole);
        used.push(count * unit);
        return true;
      }
      const said = under1000(count);
      const word = ctx.word(unit);
      if (!said || !word) return false;
      chunks.push(`${said} ${word}`);
      used.push(unit);
      return true;
    };

    if (!scale(Math.floor(value / 1000000), 1000000)) return null;
    if (!scale(Math.floor((value % 1000000) / 1000), 1000)) return null;
    const rest = value % 1000;
    if (rest) {
      const said = under1000(rest);
      if (!said) return null;
      chunks.push(said);
    }
    if (!chunks.length) return null;
    return { text: chunks.join(" و"), used };
  },
};

/**
 * Modern Hebrew.
 *
 * The same parts and the opposite habits: the ten before the unit —
 * עשרים וחמש — and a ו in front of the last word only, so 1,525 is אלף
 * חמש מאות עשרים וחמש with a single ו in it. Pieces are therefore kept
 * flat rather than in chunks: where the ו goes is a fact about the whole
 * number, not about each part of it.
 *
 * And it counts in the feminine. A number said on its own — reading 5 out
 * loud, counting to ten — is חמש, not חמשה, so the feminine cell is
 * preferred over the card's own word wherever the teacher has filled it
 * in, and the card's own word carries on being the masculine one that
 * stands beside a noun.
 */
const HE_NUMBERS: NumberSpec = {
  groups: SEMITIC_NUMBER_GROUPS,
  bands: NUMBER_BANDS,
  cells: semiticNumberCells,
  spell(value: number, ctx: NumberCtx): Spelling | null {
    const pick = (v: number): string => ctx.cell(v, "feminine") || ctx.word(v);
    const exact = pick(value);
    if (exact) return { text: exact, used: [value] };

    const used: number[] = [];
    const pieces: string[] = [];
    /* `how` is which face of a word to use: counting in the abstract is
       feminine, and a count standing in front of a scale word is not. */
    const under1000 = (n: number, how: (v: number) => string = pick): string[] | null => {
      const out: string[] = [];
      const take = (v: number): boolean => {
        const w = how(v);
        if (!w) return false;
        out.push(w);
        used.push(v);
        return true;
      };
      const hundreds = Math.floor(n / 100) * 100;
      const tail = n % 100;
      if (hundreds && !take(hundreds)) return null;
      if (tail) {
        if (tail <= 19 || tail % 10 === 0) {
          if (!take(tail)) return null;
        } else if (!take(tail - (tail % 10)) || !take(tail % 10)) return null;
      }
      return out.length ? out : null;
    };

    /* Where the ו goes: in front of the last word and nowhere else, so
       1,525 has one in it and not three. Used for the number as a whole
       and again inside a count — twenty-one thousand is עשרים ואחד אלף,
       with the ו inside the count rather than before אלף. */
    const join = (of: string[]): string =>
      of.length === 1 ? of[0] : `${of.slice(0, -1).join(" ")} ו${of[of.length - 1]}`;

    const scale = (count: number, unit: number): boolean => {
      if (!count) return true;
      const whole = pick(count * unit);
      if (whole) {
        pieces.push(whole);
        used.push(count * unit);
        return true;
      }
      /* The count in front of a scale word is masculine, because אלף is a
         masculine noun and this is no longer counting in the abstract:
         eleven thousand is אחד עשר אלף, not אחת עשרה אלף. It is the one
         place in a number where the feminine is wrong, and the reason the
         masculine stays on the card rather than being replaced by it. */
      const said = under1000(count, ctx.word);
      const word = pick(unit);
      if (!said || !word) return false;
      pieces.push(`${join(said)} ${word}`);
      used.push(unit);
      return true;
    };

    if (!scale(Math.floor(value / 1000000), 1000000)) return null;
    if (!scale(Math.floor((value % 1000000) / 1000), 1000)) return null;
    const rest = value % 1000;
    if (rest) {
      const said = under1000(rest);
      if (!said) return null;
      pieces.push(...said);
    }
    if (!pieces.length) return null;
    return { text: join(pieces), used };
  },
};

/*
 * Huế Vietnamese.
 *
 * Eleven boxes and three words, against the Semitic packs' fifty-five:
 * the language is regular, so *năm trăm* is five and hundred said one
 * after the other and there is nothing to write down for it. What it asks
 * for instead is the three multiplier words on their own — trăm, nghìn,
 * triệu — which is why those boxes are glossed *hundred* rather than
 * *100*: one hundred is *một trăm*, with the one said out loud, and a box
 * holding *một trăm* could not be used to build five hundred.
 *
 * The irregularity is all in company. *Năm* is five and *mười lăm* is
 * fifteen; *một* is one and *hai mươi mốt* is twenty-one; *mười* is ten
 * and *hai mươi* is twenty. Each of those is the same word wearing a
 * different face inside a bigger number, so each is a cell on its own
 * card and the teacher writes it once.
 */
const VI_MULTIPLIERS = new Set([100, 1000, 1000000]);

const VI_NUMBERS: NumberSpec = {
  groups: [
    {
      id: "units",
      label: "Zero to ten",
      note: "The words everything else is built out of.",
      parts: numRun(0, 10, 1).map((value) => ({ value })),
    },
    {
      id: "scales",
      label: "Hundred, thousand, million",
      note: "The bare words on their own, without the one in front: the app says the one. Write trăm, not một trăm.",
      parts: [
        { value: 100, label: "hundred", gloss: "hundred", hint: "As in năm trăm — five hundred." },
        { value: 1000, label: "thousand", gloss: "thousand", hint: "nghìn or ngàn, whichever you teach." },
        { value: 1000000, label: "million", gloss: "million" },
      ],
    },
  ],
  bands: NUMBER_BANDS,
  /* The four words that change inside a bigger number. Every other unit
     is said exactly as it is, so every other box has nothing beside it. */
  cells: (value: number): NumberCell[] => {
    if (value === 0) {
      return [
        {
          id: "empty-place",
          row: "counted",
          label: "empty place",
          hint: "As in một trăm lẻ năm — one hundred and five.",
        },
      ];
    }
    const hints: Record<number, string> = {
      1: "As in hai mươi mốt — twenty-one.",
      4: "As in hai mươi tư — twenty-four.",
      5: "As in mười lăm — fifteen.",
      10: "As in hai mươi — twenty.",
    };
    return hints[value]
      ? [{ id: "after-ten", row: "counted", label: "after a ten", hint: hints[value] }]
      : [];
  },
  spell(value: number, ctx: NumberCtx): Spelling | null {
    /* Every box but the three multipliers is the name of its own number,
       so only those three are skipped here: the box for 100 holds *trăm*,
       and answering 100 with it would be answering *hundred*. */
    if (!VI_MULTIPLIERS.has(value)) {
      const exact = ctx.word(value);
      if (exact) return { text: exact, used: [value] };
    }

    const used: number[] = [];
    const take = (v: number): string | null => {
      const w = ctx.word(v);
      if (!w) return null;
      used.push(v);
      return w;
    };
    /* The changed form where there is one, and the plain word where there
       is not: *ba* is *ba* wherever it stands. */
    const inCompany = (v: number): string | null => {
      const cell = ctx.cell(v, "after-ten");
      if (cell) {
        used.push(v);
        return cell;
      }
      return take(v);
    };

    /* 10 to 99. `tens` is how many tens — 1 is mười and the rest are the
       digit followed by mươi, which is ten's own changed form. */
    const under100 = (n: number): string | null => {
      const tens = Math.floor(n / 10);
      const unit = n % 10;
      let head: string | null;
      if (tens === 1) head = take(10);
      else {
        const digit = take(tens);
        const tenWord = inCompany(10);
        head = digit && tenWord ? `${digit} ${tenWord}` : null;
      }
      if (!head) return null;
      if (!unit) return head;
      /* One and four only change after two tens or more — *mười một* but
         *hai mươi mốt*. Five changes after any ten at all. */
      const changes = unit === 5 || ((unit === 1 || unit === 4) && tens >= 2);
      const tail = changes ? inCompany(unit) : take(unit);
      return tail ? `${head} ${tail}` : null;
    };

    /* 1 to 999, as a place in a bigger number. A place that is not the
       leading one says its empty hundreds out loud — 1,005 is một nghìn
       không trăm lẻ năm — because dropping them would leave the digits
       unreadable. */
    const place = (n: number, leading: boolean): string | null => {
      const hundreds = Math.floor(n / 100);
      const rest = n % 100;
      const bits: string[] = [];
      if (hundreds || !leading) {
        const digit = take(hundreds);
        const hundredWord = take(100);
        if (!digit || !hundredWord) return null;
        bits.push(`${digit} ${hundredWord}`);
      }
      if (rest) {
        /* Under ten with a hundred in front of it needs the marker that
           says the tens place is empty. It is the zero card's own form in
           company — không is nothing and lẻ is a place with nothing in it
           — so the teacher writes it in the box beside zero rather than
           the pack shipping a word nobody chose. */
        if (rest < 10 && bits.length) {
          const filler = ctx.cell(0, "empty-place");
          const unit = take(rest);
          if (!filler || !unit) return null;
          used.push(0);
          bits.push(`${filler} ${unit}`);
        } else {
          const said = rest < 10 ? take(rest) : under100(rest);
          if (!said) return null;
          bits.push(said);
        }
      }
      return bits.length ? bits.join(" ") : null;
    };

    const parts: string[] = [];
    const scale = (count: number, unit: number, leading: boolean): boolean => {
      if (!count) return true;
      const said = place(count, leading);
      const word = take(unit);
      if (!said || !word) return false;
      parts.push(`${said} ${word}`);
      return true;
    };

    const millions = Math.floor(value / 1000000);
    const thousands = Math.floor((value % 1000000) / 1000);
    const rest = value % 1000;
    if (!scale(millions, 1000000, true)) return null;
    if (!scale(thousands, 1000, !millions)) return null;
    if (rest) {
      const said = place(rest, !millions && !thousands);
      if (!said) return null;
      parts.push(said);
    }
    if (!parts.length) return null;
    return { text: parts.join(" "), used };
  },
};

/* ---- what a word can be ----

   The list a teacher picks from, declared once and spread into every pack
   the way the tables above are. Parts of speech are not the same
   everywhere, so this is a language's answer and not the app's — no pack
   differs today, and the day one does it says so here rather than
   anywhere else.

   Four of them name a table, and each says which grammar axes a word of
   its kind is asked about. A verb is offered its persons and tenses, a
   noun and a preposition the pronouns that go on their end, an adjective
   its feminine and plural, a number its feminine; the rest are the word
   and whatever forms the teacher writes. A category naming a table the
   pack has not got — a noun in Huế, which attaches nothing — simply has
   none, and an axis the pack has not got is not asked either. */
const WORD_CATEGORIES: WordCategory[] = [
  {
    id: "noun",
    label: "Noun",
    note: "A thing: a book, a house, a morning.",
    table: "attached",
    grammar: ["number", "gender", "human"],
  },
  {
    id: "verb",
    label: "Verb",
    note: "Something done, with its persons and tenses laid out in a table.",
    table: "verb",
    grammar: [],
  },
  {
    id: "adjective",
    label: "Adjective",
    note: "A description: big, red, tired — with the forms it takes beside a noun.",
    table: "agreement",
    /* Its number and gender are its table. */
    grammar: [],
  },
  {
    id: "preposition",
    label: "Preposition",
    note: "at, with, for — and in some languages they take the same endings a noun does.",
    table: "attached",
    grammar: [],
  },
  {
    id: "pronoun",
    label: "Pronoun",
    note: "I, you, she — the word itself, not an ending.",
    grammar: ["number", "gender"],
  },
  {
    id: "name",
    label: "Name",
    note: "A particular person or place: Sarah, Nablus.",
    /* Both, though a name is nearly always singular: the verb beside it in
       a sentence reads number and gender together to choose between he
       and she, and a name with no number would silently stop agreeing. */
    grammar: ["number", "gender"],
  },
  {
    id: "number",
    label: "Number",
    note: "One, two, three, and the words built on them — with the form a feminine noun takes.",
    table: "counted",
    grammar: [],
  },
  {
    id: "other",
    label: "Something else",
    note: "A greeting, a particle, a phrase — anything the list above does not cover.",
    grammar: [],
  },
];

/** What a word can be in this language, in the order it is asked. */
export const categoriesOf = (lang: Lang | null | undefined): WordCategory[] =>
  (lang && lang.categories) || [];

/** One of them by its id, or null — including for a card written before the
    question was asked, and for an id no pack declares. */
export const categoryOf = (
  lang: Lang | null | undefined,
  id: string | null | undefined,
): WordCategory | null =>
  categoriesOf(lang).find((c) => c.id === String(id || "")) || null;

/**
 * What the teacher is shown for it — "Noun" — and "" where the card has
 * not been asked or says something this pack does not declare.
 */
export const categoryLabel = (
  lang: Lang | null | undefined,
  id: string | null | undefined,
): string => (categoryOf(lang, id) || { label: "" }).label;

/**
 * The tables this language lays a word's forms out in, by name, in the
 * order the pack declares them — which is the order a card carrying more
 * than one is read in. Only the ones with rows and columns: a table with
 * nothing on either axis lays out nothing, and nobody should have to ask.
 */
export const tablesOf = (lang: Lang | null | undefined): Record<string, VerbSpec> => {
  const out: Record<string, VerbSpec> = {};
  for (const [name, spec] of Object.entries((lang && lang.tables) || {})) {
    if (spec && spec.tenses.length > 0 && spec.persons.length > 0) out[name] = spec;
  }
  return out;
};

/** One of them by name, or null where the pack has no such table. */
export const specOf = (lang: Lang | null | undefined, name: string | null | undefined): VerbSpec | null =>
  (name && tablesOf(lang)[name]) || null;

/** The rows and columns a language lays its verbs out on, where it has any.
    Kept by name: a verb's own sentence and the dictionary form both want
    the verb table in particular, not whichever table a card happens to
    carry. */
export const verbOf = (lang: Lang | null | undefined): VerbSpec | null => specOf(lang, "verb");

/** And the pronouns it attaches to a word, where it attaches any. */
export const attachedOf = (lang: Lang | null | undefined): VerbSpec | null => specOf(lang, "attached");

/** Whether this language attaches pronouns to a word at all. */
export const takesAttached = (lang: Lang | null | undefined): boolean => !!attachedOf(lang);

/** Whether this language lays verbs out in a table at all. */
export const teachesVerbs = (lang: Lang | null | undefined): boolean => !!verbOf(lang);

/**
 * The table a word of this kind agrees out of, where it has one: one row,
 * and a column that picks. That is what a sentence reads to put كبيرة
 * beside سيارة — the pronouns on the end of a word pick nothing, and a
 * verb's three rows need a sentence to say which, so neither is one.
 */
/**
 * Which of a card's forms it lends into a hole.
 *
 * A card whose forms agree with what they stand beside — an adjective, a
 * number — lends its own word only, and the sentence picks the agreeing
 * form: one that arrived by turn would stand beside the wrong noun. Every
 * other card lends every form it has, which is 0.139's rule unchanged. One
 * answer, read by the session, the teacher's preview and the teaching
 * space alike, so the three never disagree about which words are in a
 * hole.
 */
export const lendsForm = (
  lang: Lang | null | undefined,
  card: { category?: string } | null | undefined,
): ((form: Record<string, unknown>) => boolean) => {
  const spec = agreementOf(lang, card && card.category);
  if (!spec) return () => true;
  const rows = new Set(spec.tenses.map((t) => t.id));
  return (form) => !rows.has(String((form && form.row) || ""));
};

export const agreementOf = (
  lang: Lang | null | undefined,
  category: string | null | undefined,
): VerbSpec | null => {
  const kind = categoryOf(lang, category);
  const spec = kind ? specOf(lang, kind.table) : null;
  if (!spec || spec.tenses.length !== 1) return null;
  return spec.persons.some((p) => p.picks && Object.keys(p.picks).length) ? spec : null;
};

/* Every value any dimension can hold, for validating stored cards without
   knowing which language wrote them. */
export const DIM_VALUES: Record<string, string[]> = {};
for (const dim of Object.values(GRAMMAR)) {
  DIM_VALUES[dim.field] = (DIM_VALUES[dim.field] || []).concat(dim.options.map(([v]) => v));
}

/* The marks that carry tone. Deliberately not the ones that build letters —
   the circumflex of â, the breve of ă, the horn of ơ — which are spelling,
   not tone. */
export const VI_TONE_OF: Record<string, string> = {
  "\u0300": "huyen",
  "\u0301": "sac",
  "\u0309": "hoi",
  "\u0303": "nga",
  "\u0323": "nang",
};

/* One tone per syllable, joined, so a two-syllable word has a signature of
   its own and minimal pairs still line up. */
export function viTone(text: string) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words
    .map((w) => {
      for (const ch of w.normalize("NFD")) if (VI_TONE_OF[ch]) return VI_TONE_OF[ch];
      return "ngang";
    })
    .join(".");
}

/* The word with its tone lifted off. Two cards that share this and differ in
   tone are a minimal pair — the thing worth drilling. */
export function viBare(text: string) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0309\u0303\u0323]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/* A rough consonantal skeleton: enough to gather a root family, not real
   morphology. */
/* Weak letters carry the vowelling rather than the root, so they are dropped
   when asking whether two words are related. */
export const WEAK_LETTERS = /[\u0627\u0648\u064A\u0649\u0621\u0623\u0625\u0622\s]/g;

/* Rough consonant skeleton. Two words sharing three of these usually share a
   root, which is the similarity that matters most in Arabic. */
export function arSimilarityKey(ar: string) {
  return normAr(ar, { stripTashkeel: true, ignoreHamza: true }).replace(WEAK_LETTERS, "");
}

/*
 * The root a word is built on, near enough to gather a family.
 *
 * Arabic builds words by pouring three consonants into a pattern, so كتاب,
 * كاتب and مكتب are the same root wearing different shapes. Seeing them
 * together is the moment the root system stops being a rumour, and it costs
 * nothing: it is read off spellings the teacher already typed.
 *
 * Near enough, not right. Real morphology is a hard problem and this is
 * three rules:
 *   - drop the letters that carry vowelling rather than the root;
 *   - drop a leading م, the commonest nominal prefix, but only while three
 *     letters remain, or مال would collapse to nothing;
 *   - drop a trailing ه, which is where a feminine ة has landed by then.
 *
 * A key under three letters is no key at all — two consonants gather words
 * with nothing to do with each other — so it returns nothing and the word
 * simply has no family.
 *
 * arSkeleton, which this replaces as the grouping, only stripped harakat
 * and folded hamza. It left the word intact, so no two words ever shared a
 * key and the family it was meant to gather was always empty. It stays
 * because similarity still reads it.
 */
export function arRootKey(text: string) {
  let x = normAr(text, { stripTashkeel: true, ignoreHamza: true }).replace(WEAK_LETTERS, "");
  if (x.startsWith("\u0645") && x.length >= 4) x = x.slice(1);
  if (x.endsWith("\u0647") && x.length >= 4) x = x.slice(0, -1);
  return x.length >= 3 ? x : "";
}

export function arSkeleton(text: string) {
  const bare = stripInvisible(String(text || ""))
    .normalize("NFC")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0621-\u0626]/g, "\u0627")
    .replace(/[^\u0627-\u064A]/g, "");
  return bare;
}

/* Computing a tone is cheap, but it happens once per card per render pass
   while grouping, so keep the last few thousand answers. */
export const DERIVED_CACHE = new Map();

export function derivedValue(attr: Derived, text: string) {
  if (!attr || !text) return "";
  const key = `${attr.id}\u0000${text}`;
  const hit = DERIVED_CACHE.get(key);
  if (hit !== undefined) return hit;
  let val = "";
  try {
    val = attr.compute(text) || "";
  } catch (e) {
    val = "";
  }
  if (DERIVED_CACHE.size > 4000) DERIVED_CACHE.clear();
  DERIVED_CACHE.set(key, val);
  return val;
}

export const attrsOf = (lang: Lang): Derived[] => lang.derived || [];

export const quizAttrOf = (lang: Lang): Derived | null => attrsOf(lang).find((a) => a.quizzable) || null;

export const groupAttrOf = (lang: Lang): Derived | null => attrsOf(lang).find((a) => a.groups) || null;

/* Collapse a value to the class it is graded in. Huế does not distinguish
   hỏi from ngã in speech, so a listening exercise must not either — but the
   spelling does distinguish them, so this is never applied to typing. */
export function gradeClass(attr: Derived, value: string) {
  if (!attr || !attr.classes) return value;
  /* Held by name: the guard above does not reach inside the closure. */
  const classes = attr.classes;
  return String(value)
    .split(".")
    .map((part) => {
      const cls = classes.find((c) => c.merges.includes(part));
      return cls ? cls.id : part;
    })
    .join(".");
}


/* ---- Hebrew ----
   Everything Hebrew knows about itself, in one place like the two above.
   The app reaches it only through the pack. */

/* The standard Israeli layout, plus the two final-letter keys where the
   layout puts them. */
export const HE_KEY_ROWS = [
  ["ק", "ר", "א", "ט", "ו", "ן", "ם", "פ"],
  ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"],
  ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ"],
];

export const HE_EXTRAS = ["־", "׳", "״", ",", "?"];

/* The niqqud, in the order a beginner meets them: the vowels, then the
   dagesh and the shin and sin dots, then the reduced vowels. */
export const HE_MARKS = [
  "ַ", "ָ", "ֶ", "ֵ", "ִ", "ֹ", "ֻ", "ְ",
  "ּ", "ׁ", "ׂ", "ֲ", "ֱ", "ֳ",
];

/* Everything that sits on a letter rather than beside it: the points, the
   dagesh and rafe, the shin and sin dots, and the cantillation nobody
   types. Not the maqaf, paseq or sof pasuq — those are punctuation. */
const NIQQUD_CLASS = "\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7";
export const NIQQUD = new RegExp(`[${NIQQUD_CLASS}]`, "g");
export const HAS_NIQQUD = new RegExp(`[${NIQQUD_CLASS}]`);
const HE_MARK_RUN = new RegExp(`([\\u05D0-\\u05EA])([${NIQQUD_CLASS}]+)`, "g");

export const HE_PUNCT = /[.,!?;:"'()[\]־׀׃׳״«»]/g;

/* Five letters take another shape at the end of a word. A beginner who
   types the ordinary shape there has spelt the word, not misspelt it, so
   folding the finals is a leniency the pack offers. */
const HE_FINALS = /[ךםןףץ]/g;
const HE_FINAL_OF: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

export function normHe(s: string, { stripNiqqud, foldFinals }: { stripNiqqud?: boolean; foldFinals?: boolean }) {
  let x = stripInvisible(s).trim();
  /* Either the marks go, or they are put in one order so that a dagesh
     typed before a vowel and one typed after it compare equal. */
  x = stripNiqqud
    ? x.replace(NIQQUD, "")
    : x.replace(HE_MARK_RUN, (_, base, marks) => base + marks.split("").sort().join(""));
  if (foldFinals) x = x.replace(HE_FINALS, (c) => HE_FINAL_OF[c]);
  return x.replace(HE_PUNCT, "").replace(/\s+/g, " ").trim();
}

/* The same two-stage judgement as Arabic: the letters first, and only if
   those agree, the marks — so a student may type the bare word or the
   fully pointed one, and the marks they do type have to be right. */
export function compareHe(given: string, expected: string, settings: Settings) {
  const mode = settings.niqqud || "either";
  const fold = settings.foldFinals;
  const skelG = normHe(given, { stripNiqqud: true, foldFinals: fold });
  const skelE = normHe(expected, { stripNiqqud: true, foldFinals: fold });

  if (!skelG) return { ok: false, reason: "wrong" };
  if (skelG !== skelE) {
    const near = editDistance(skelG, skelE) <= Math.max(1, Math.round(skelE.length * 0.2));
    return { ok: false, reason: near ? "near" : "wrong" };
  }
  if (mode === "ignore") return { ok: true, reason: "letters-only" };

  const givenHas = HAS_NIQQUD.test(given);
  const storedHas = HAS_NIQQUD.test(expected);
  if (!storedHas) return { ok: true, reason: givenHas ? "unchecked" : "letters-only" };
  if (!givenHas) {
    return mode === "required" ? { ok: false, reason: "missing" } : { ok: true, reason: "bare" };
  }

  const fullG = normHe(given, { stripNiqqud: false, foldFinals: fold });
  const fullE = normHe(expected, { stripNiqqud: false, foldFinals: fold });
  if (fullG === fullE) return { ok: true, reason: "exact" };
  /* Some of the niqqud, all of them right — the same rule Arabic reads,
     out of the same function, because it is one rule about marked scripts
     and not two. */
  if (mode !== "required" && typedMarksRight(fullG, fullE, HAS_NIQQUD)) {
    return { ok: true, reason: "bare" };
  }
  return { ok: false, reason: "harakat" };
}

/* The four tiers rank the same way in every marked script, so Arabic's
   order is reused rather than restated. */
export function checkHe(given: string, expected: string, settings: Settings) {
  let worst = { ok: false, reason: "wrong" };
  for (const form of splitForms(expected, /[/;]/)) {
    const r = compareHe(given, form, settings);
    if (r.ok) return r;
    if (AR_RANK[r.reason] > AR_RANK[worst.reason]) worst = r;
  }
  return worst;
}

/* What attaches to the front of a Hebrew word: the article, "and", and the
   one-letter prepositions, singly or "and" plus one of the others. */
const HE_PREFIXES = ["וה", "וב", "ול", "ומ", "וכ", "וש", "שה", "כש", "ה", "ו", "ב", "ל", "מ", "כ", "ש"];

/*
 * The root a word is built on, near enough to gather a family — the same
 * job arRootKey does, for a language built the same way: three consonants
 * poured into patterns, so כתב, כותב, מכתב and כתיבה are one root in four
 * shapes. Read off spellings the teacher already typed; nothing is looked
 * up.
 *
 * Near enough, not right. Four rules, each applied only while three
 * letters remain, so that a root which truly holds one of these letters
 * keeps it:
 *   - drop a plural ending or a feminine ה from the end;
 *   - drop a leading מ, the commonest noun prefix — and only that. The
 *     article and the one-letter prepositions are peeled when matching a
 *     word inside a phrase, not here: half the roots in the language start
 *     with one of those letters, and a key that took ש off שמירה would
 *     file guarding under the wrong family;
 *   - drop the vowel letters ו and י of full spelling, which carry the
 *     vowelling rather than the root;
 *   - and a key under three letters is no key: two consonants gather words
 *     with nothing to do with each other, so the word simply has no family.
 *
 * The finals are folded first, so the endings below are written with the
 * ordinary מ. Weak roots — where a root letter vanishes in some forms —
 * will sometimes come out as two keys for one family. Fewer families,
 * never wrong ones, is the side to err on.
 */
export function heRootKey(text: string) {
  let x = normHe(text, { stripNiqqud: true, foldFinals: true }).replace(/\s+/g, "");
  if (!x) return "";
  for (const suf of ["ימ", "ות", "ה"]) {
    if (x.endsWith(suf) && x.length - suf.length >= 3) {
      x = x.slice(0, -suf.length);
      break;
    }
  }
  if (x.startsWith("מ") && x.length >= 4) x = x.slice(1);
  while (x.length > 3 && /[וי]/.test(x)) x = x.replace(/[וי]/, "");
  return x.length >= 3 ? x : "";
}

/* Rough consonant skeleton, for the scheduler's sense of which words feel
   related: the vowel letters out, the rest in any order. */
export function heSimilarityKey(text: string) {
  return normHe(text, { stripNiqqud: true, foldFinals: true }).replace(/[וי\s]/g, "");
}

/* Which words a recorded phrase teaches. Peeled like Arabic's, two deep,
   and the remainder must keep two letters — Hebrew has real two-letter
   words, אב and יד among them, where Arabic has none. */
export function heWordStems(token: string, depth = 2) {
  const out = [token];
  const peel = (s: string, left: number): void => {
    if (left <= 0) return;
    for (const p of HE_PREFIXES) {
      if (!s.startsWith(p)) continue;
      const rest = s.slice(p.length);
      if (rest.length < 2 || out.includes(rest)) continue;
      out.push(rest);
      peel(rest, left - 1);
    }
  };
  peel(token, depth);
  return out;
}

export function heTokenIsWord(token: string, word: string) {
  const opts = { stripNiqqud: true, foldFinals: true };
  const w = normHe(word, opts);
  if (!w) return false;
  const t = normHe(token, opts);
  if (!t) return false;
  return heWordStems(t).includes(w);
}

/* Whether a string is written in the language's own script. The importer
   asks this to work out which column holds the word when a row arrives
   without a header. A language written in the Latin alphabet declares no
   script, and the importer falls back to column order. */
export function inScript(text: string, lang: Lang = activeLang()) {
  return !!(lang && lang.script && lang.script.test(String(text || "")));
}

export const LANGUAGES: Record<LangId, Lang> = {
  "ar-PS": {
    id: "ar-PS",
    name: "Palestinian Arabic",
    nativeName: "اللهجة الفلسطينية",
    direction: "rtl",
    scriptLabel: "Arabic script",
    scriptShort: "A",
    script: /[\u0600-\u06FF]/,
    /* The type scale every script rule multiplies by. font-size sets the em
       box, not the height of a letter, and how much of that box a script
       fills differs: Arabic leaves room above for harakat and below for the
       tails of ب and ج, so an Arabic word at 54px looks the size a Latin
       word looks at rather less. The sizes in the stylesheet were tuned by
       eye against this script, so Arabic is 1 by definition and every other
       pack is measured against it. */
    scale: 1,
    leading: 1,
    /* Two rows for the importer's worked example, in this language. */
    sample: [
      { ar: "كِتاب", en: "book", lat: "kitāb" },
      { ar: "واحِد", en: "one", lat: "" },
    ],
    translitLabel: "Transliteration",
    /* And whether a noun is a person or a thing, which is what an
       adjective beside a plural reads — see GRAMMAR.human. */
    grammar: ["number", "gender", "human"],
    /* A verb is marked for who is doing it and when, so its forms are laid
       out on those two axes. The tenses are in the order they are taught,
       which is the order they open in: what you do before what you did,
       and the command last — it is the one a beginner hears more than they
       say. */
    tables: {
      verb: {
        persons: SUBJECT_PERSONS,
        tenses: [
          { id: "present", label: "present" },
          { id: "past", label: "past" },
          { id: "command", label: "command" },
        ],
        /* There is no infinitive. A dictionary lists أكل — he ate — and
           that is a cell of this table, so the card's own word and that
           cell are one word, not two things to learn. */
        citation: { row: "past", col: "he" },
        gate: "rows",
      },
      /* And the pronouns that attach to the end of a word — كتابي is my
         book, عندي is I have. See ATTACHED_TABLE. */
      attached: ATTACHED_TABLE,
      /* What an adjective becomes beside a feminine or a plural noun, and
         what a number becomes beside a feminine one. */
      agreement: AR_AGREEMENT,
      counted: COUNTED_TABLE,
    },
    /* And what a teacher says a word is. The shared list: nothing about
       Arabic asks for a category of its own. */
    categories: WORD_CATEGORIES,
    /* Unit before ten, و in front of every chunk. See AR_NUMBERS. */
    numbers: AR_NUMBERS,
    /* What each shade of not-quite-right is called here. The tiers are the
       same in every language; only the words for them differ. */
    verdicts: {
      partial: "Right letters, wrong harakat",
      missing: "Letters right — add the harakat",
      near: "Very close",
      bare: "The harakat are above — worth a look.",
    },
    derived: [
      {
        id: "root",
        label: "root",
        compute: arRootKey,
        groups: true,
        quizzable: false,
        /* What to call the words this gathers, in Arabic's own terms. The
           app renders this sentence and does not compose one, because the
           relation it describes is not the same relation in every
           language: here it is a shared root, in Huế it is a shared
           spelling with a different tone. */
        heading: "Built on the same root",
      },
    ],
    /* What makes two words feel related, for grouping a session: sharing
       consonants, in any order — the shape of a root. */
    similarityKey: arSimilarityKey,
    similarityMode: "chars",
    /* Which words a recorded phrase teaches. The article and the one-letter
       conjunctions and prepositions attach to the front of a word here, so
       الكتاب and وبالكتاب are both the word كتاب wearing something. */
    /* The particles, prepositions and pronouns that hold a sentence
       together. Written unpointed: they go through the same matcher the
       phrases do, which strips the harakat before comparing. */
    context: {
      matches: arTokenIsWord,
      skip: ["من", "في", "على", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "الذي",
             "التي", "أن", "إن", "لا", "ما", "هل", "يا", "قد", "كان", "هو", "هي",
             "أنا", "أنت", "نحن", "كل", "بعض", "عند", "بين", "بعد", "قبل"],
    },
    /* A romanisation of an Arabic word is a different rendering of it, so
       going between the two is a real exercise. */
    translitDrilled: true,
    formsLabel: "Other forms — plurals, feminines",
    fontStack:
      '"Noto Naskh Arabic", "Amiri", "Scheherazade New", "Traditional Arabic", "Geeza Pro", "Al Bayan", serif',
    keys: { rows: AR_KEY_ROWS, extras: AR_EXTRAS, marks: AR_MARKS, marksLabel: "ً ٌ ٍ" },
    check: (given, expected, settings) => checkAr(given, expected, settings),
    /* The skeleton, one character at a time — the same fold compareAr
       measures its letters on, so what is highlighted and what is marked
       are the same answer. A harakat, a tatweel and a space all fold to
       nothing, which is what keeps them out of the lining-up. */
    letter: (ch, settings) =>
      tight(normAr(ch, { stripTashkeel: true, ignoreHamza: !!(settings || {}).ignoreHamza })),
    /*
     * How strictly typing is marked.
     *
     * `tashkeel: "either"` takes the bare letters or the fully vocalised
     * spelling from one stored entry — but typed harakat have to be the
     * right ones, so a wrong vowel is wrong and a missing one is merely
     * incomplete. **Missing means missing, however many:** a word typed
     * with one of its three harakat, and that one right, is judged on the
     * one it has. Until 0.165 it was all or nothing, so typing none of
     * them was accepted and typing one correctly was refused — the rule
     * these packs have always stated, read the wrong way round by the
     * code that enforced it. `ignoreHamza` accepts ا for أ إ آ, و for ؤ, ي for ى and
     * ئ, ه for ة, and a dropped ء, because those distinctions are learnt
     * later than the words that carry them.
     */
    marking: { tashkeel: "either", ignoreHamza: true },
    rules: [
      "Cards hold the Arabic script, an English meaning, and a transliteration. Any two of the three are enough to practice it.",
      "A student may type the bare consonants or the fully vocalised spelling and both are accepted — but harakat that are typed must be correct. A wrong vowel is marked wrong; a missing one is not.",
      "ا is accepted for أ إ آ, و for ؤ, ي for ى and ئ, and ه for ة, because those distinctions are learnt later than the words themselves.",
      "Transliteration is marked most leniently of all: macrons, dots under letters, ʿayn marks, apostrophes and where the hyphens fall are all ignored, since schemes vary between textbooks.",
      "Invisible characters that Arabic keyboards insert — right-to-left marks and zero-width joiners — are stripped before comparing, so an answer that looks correct is treated as correct.",
      "Words with several forms — plurals, feminines — are held on one card as separate forms. Each is learnt in its own right, and the card is not counted as learnt until all of them are.",
      "The on-screen keyboard follows the standard Arabic layout, with a separate row for harakat.",
    ],
  },

  "vi-Hue": {
    id: "vi-Hue",
    name: "Huế Vietnamese",
    nativeName: "tiếng Huế",
    direction: "ltr",
    scriptLabel: "Vietnamese",
    scriptShort: "V",
    /* Latin script fills far more of its em box than Arabic does, so the
       sizes tuned for Arabic came out oversized here. A starting guess,
       meant to be adjusted by eye. */
    scale: 0.78,
    leading: 0.85,
    sample: [
      { ar: "sách", en: "book", lat: "" },
      { ar: "một", en: "one", lat: "" },
    ],
    translitLabel: "Pronunciation note",
    /* Nothing declines, and nothing about a word varies by who is being
       addressed — greetings and thanks that do vary are held as forms of
       one card, unlabelled. So: no grammatical axes at all. */
    grammar: [],
    /* A noun is not usable without its classifier, and which one it takes is
       simply memorised — the job gender does in Arabic. */
    lexical: { key: "classifier", label: "Classifier", help: "con, cái, cây, quả …" },
    /* Nothing about a verb changes for who is doing it — ăn is ăn whoever
       eats — so there is one column, and it is unlabelled: "đã ăn" is what
       the learner is asked, not "any: đã ăn". What does change is when, and
       that is a word in front rather than a different word, which makes the
       rows markers rather than tenses. The bare verb is taught first and
       everything else hangs off it.

       This is the whole language-agnostic claim in one pack: the same
       editor and the same exercises, over a table one column wide. */
    tables: {
      verb: {
        persons: [{ id: "any", label: "" }],
        tenses: [
          { id: "plain", label: "plain" },
          { id: "past", label: "past (đã)" },
          { id: "ongoing", label: "ongoing (đang)" },
          { id: "future", label: "future (sẽ)" },
        ],
        gate: "rows",
      },
      /*
       * The forms a number takes inside a bigger one.
       *
       * The same table name the Semitic packs use for a number's feminine,
       * and deliberately: what the table is called is how a card finds it —
       * the Number category names `counted` in every pack — and what is in
       * it is the language's own business. Huế has no genders to agree
       * with and every reason to lay a number out: *năm* is five and
       * *mười lăm* is fifteen, which is one word with two faces and so a
       * cell, exactly as an adjective's feminine is.
       *
       * Two columns, because two different things change: a unit standing
       * after a ten, and the zero that marks a place with nothing in it.
       * Neither picks, because nothing here is chosen by looking at a word
       * beside it — the pack's `spell` asks for the cell it wants by name.
       */
      counted: {
        persons: [
          { id: "after-ten", label: "after a ten" },
          { id: "empty-place", label: "empty place" },
        ],
        tenses: [{ id: "counted", label: "in a bigger number" }],
        label: "the forms inside a bigger number",
        gate: "word",
      },
    },
    /* The same list, and it attaches no pronouns and nothing agrees — so
       a noun here is a noun with nothing laid out under it, and so is an
       adjective, which is what a category naming a table the pack has not
       got means. */
    categories: WORD_CATEGORIES,
    /* Regular, so eleven boxes and three bare multiplier words; the
       irregularity is all in company. See VI_NUMBERS. */
    numbers: VI_NUMBERS,
    verdicts: {
      partial: "Right letters, wrong tone",
      missing: "Letters right — add the tone marks",
      near: "Very close",
      bare: "The tone marks are above — worth a look.",
    },
    derived: [
      {
        id: "tone",
        label: "tone",
        short: "T",
        compute: viTone,
        groups: false,
        quizzable: true,
        /* Huế merges hỏi and ngã in speech. The spelling keeps them apart, so
           this applies to listening only — never to what a student types.
           A northern pack would list six here and change nothing else. */
        classes: [
          { id: "ngang", label: "Ngang — level", merges: ["ngang"] },
          { id: "huyen", label: "Huyền — falling", merges: ["huyen"] },
          { id: "sac", label: "Sắc — rising", merges: ["sac"] },
          { id: "hoi", label: "Hỏi / Ngã — dipping", merges: ["hoi", "nga"] },
          { id: "nang", label: "Nặng — heavy", merges: ["nang"] },
        ],
      },
      {
        id: "bare",
        label: "spelling without tone",
        compute: viBare,
        groups: true,
        quizzable: false,
        heading: "Also spelt this way, with a different tone",
      },
    ],
    /* Words that differ only in tone are close relatives, not strangers —
       and that is the only spelling relation that means anything here, so the
       keys are compared whole. Letter overlap would call ban and nab related. */
    similarityKey: viBare,
    similarityMode: "exact",
    /* Nothing attaches to anything, so a token either is the word or is
       not — but the tone has to match, because má and ma are two words. */
    context: {
      matches: viTokenIsWord,
      skip: ["là", "và", "của", "có", "không", "được", "một", "các", "những",
             "này", "đó", "ở", "cho", "với", "thì", "mà", "rằng", "đã", "sẽ",
             "cũng", "rất", "nhưng", "khi", "để", "về", "ra", "vào"],
    },
    /* Vietnamese is already written in the Latin alphabet, so a "type the
       transliteration" exercise would ask for the word already on screen.
       The pronunciation note is a note; it is not drilled. */
    translitDrilled: false,
    formsLabel: "Other forms",
    fontStack: '"Be Vietnam Pro", "Noto Sans", system-ui, sans-serif',
    keys: { rows: VI_KEY_ROWS, extras: VI_EXTRAS, marks: VI_MARKS, marksLabel: "◌̀ ◌́ ◌̉" },
    check: (given, expected, settings) => checkViet(given, expected, settings),
    /* Tones off, as the skeleton is: a word written with the wrong tone is
       the right letters, and the verdict already has a sentence for it.
       The spaces stay out of it — every syllable here is its own word, so
       what they separate is words and not letters. */
    letter: (ch) => normViet(ch, { stripTones: true }).replace(/\s+/g, ""),
    /* The word is accepted with or without its tone marks — but a tone
       that is typed has to be the right one. */
    marking: { tones: "either" },
    rules: [
      "Cards hold the Vietnamese spelling, an English meaning, and an optional pronunciation note. Any two of the three are enough to practice it.",
      "Tone marks work the way harakat do in Arabic: a student may type the word with or without them, but a tone that is typed must be correct. Writing má for mà is wrong; writing ma is merely incomplete.",
      "Đ is treated as its own letter rather than a d with a mark, so typing d for đ is not accepted.",
      "The six tones of the northern standard are not those of Huế speech. Cards should carry the spelling as written; the recording is what teaches the tone.",
      "Recordings matter more here than in a language with a phonetic script, so the listening exercises are worth using from the first lesson.",
      "The on-screen keys carry the vowels Vietnamese needs and a row of tone marks, for students without a Vietnamese keyboard.",
    ],
  },

  "he-IL": {
    id: "he-IL",
    name: "Modern Hebrew",
    nativeName: "עברית",
    direction: "rtl",
    scriptLabel: "Hebrew",
    scriptShort: "H",
    script: /[֐-׿]/,
    sample: [
      { ar: "סֵפֶר", en: "book", lat: "sefer" },
      { ar: "אֶחָד", en: "one", lat: "" },
    ],
    translitLabel: "Transliteration",
    /* Nouns carry number and gender, and adjectives agree with both —
       the same two axes Arabic declares. */
    grammar: ["number", "gender"],
    /* Marked for the same seven persons as Arabic, and for the same reason
       — so the same columns, declared once above. The rows are its own:
       Hebrew's future is a form of the verb rather than a word in front of
       it, and is taught after the past. */
    tables: {
      verb: {
        persons: SUBJECT_PERSONS,
        tenses: [
          { id: "present", label: "present" },
          { id: "past", label: "past" },
          { id: "future", label: "future" },
          { id: "command", label: "command" },
        ],
        /* Cited the same way and for the same reason as Arabic: the
           he-past is the form a dictionary lists, and it is a cell of
           this table. */
        citation: { row: "past", col: "he" },
        gate: "rows",
      },
      /* The same endings, and the same reason: ספרי is my book. */
      attached: ATTACHED_TABLE,
      /* An adjective agrees in number and gender at once, so the plural is
         two cells; a number takes a feminine form as in Arabic. */
      agreement: HE_AGREEMENT,
      counted: COUNTED_TABLE,
    },
    categories: WORD_CATEGORIES,
    /* Ten before unit, one ו in the whole number, and counted in the
       feminine. See HE_NUMBERS. */
    numbers: HE_NUMBERS,
    verdicts: {
      partial: "Right letters, wrong niqqud",
      missing: "Letters right — add the niqqud",
      near: "Very close",
      bare: "The niqqud are above — worth a look.",
    },
    derived: [
      {
        id: "root",
        label: "root",
        compute: heRootKey,
        groups: true,
        quizzable: false,
        heading: "Built on the same root",
      },
    ],
    similarityKey: heSimilarityKey,
    similarityMode: "chars",
    context: {
      matches: heTokenIsWord,
      skip: ["של", "את", "על", "עם", "אל", "כי", "לא", "גם", "אבל", "זה", "זאת",
             "הוא", "היא", "אני", "אתה", "אנחנו", "מה", "מי", "כל", "אם", "או"],
    },
    /* A romanisation of a Hebrew word is a different rendering of it, so
       going between the two is a real exercise. */
    translitDrilled: true,
    formsLabel: "Other forms — plurals, feminines",
    fontStack:
      '"Noto Serif Hebrew", "Noto Sans Hebrew", "Frank Ruehl CLM", "David CLM", "David", "Arial Hebrew", "Times New Roman", serif',
    keys: { rows: HE_KEY_ROWS, extras: HE_EXTRAS, marks: HE_MARKS, marksLabel: "◌ָ ◌ַ ◌ִ" },
    check: (given, expected, settings) => checkHe(given, expected, settings),
    /* The bare letters, with a final folded to its ordinary shape where
       the learner has said that is how they want to be marked — the same
       skeleton compareHe measures on. */
    letter: (ch, settings) =>
      normHe(ch, { stripNiqqud: true, foldFinals: !!(settings || {}).foldFinals })
        .replace(/\s+/g, ""),
    /* The bare letters or the fully pointed spelling, from one stored
       entry — but typed niqqud have to be the right ones, and a point left
       off is a point left off whether it is one of them or all of them;
       and the ordinary shape of a letter is accepted at the end of a word
       for its final form, כ מ נ פ צ for ך ם ן ף ץ. */
    marking: { niqqud: "either", foldFinals: true },
    rules: [
      "Cards hold the Hebrew, an English meaning, and a transliteration. Any two of the three are enough to practice it.",
      "A student may type the bare letters or the fully pointed spelling and both are accepted — but niqqud that are typed must be correct. A wrong vowel is marked wrong; a missing one is not.",
      "The ordinary shape of a letter is accepted at the end of a word for its final form, because the finals are learnt later than the words themselves.",
      "Transliteration is marked most leniently of all: macrons, dots, apostrophes and where the hyphens fall are all ignored, since schemes vary between textbooks.",
      "Invisible characters that Hebrew keyboards insert — right-to-left marks and zero-width joiners — are stripped before comparing, so an answer that looks correct is treated as correct.",
      "Words with several forms — plurals, feminines — are held on one card as separate forms. Each is learnt in its own right, and the card is not counted as learnt until all of them are.",
      "The on-screen keyboard follows the standard Israeli layout, with a separate row for niqqud.",
    ],
  },
};


/* ------------------------------------------------------------------
   The type scale

   A pack may say how large its script wants to be relative to the sizes
   in the stylesheet, which were tuned against Arabic. Both default to 1,
   so a pack that says nothing — Hebrew today — renders exactly as it did
   before this existed, and adding a language never means touching CSS.

   Read as CSS custom properties: every script rule multiplies its
   font-size by --sscale and its line-height by --sleading, and both fall
   back to 1 wherever they are unset.
   ------------------------------------------------------------------ */
const positive = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1);

/* Asked for one field, so that is what they ask for: a caller wanting to
   know how large a script wants to be need not have a whole pack in hand,
   and `unknown` rather than `number` because `positive` exists precisely
   to survive a pack that wrote something a calc() could not use. */
export const scaleOf = (lang?: { scale?: unknown } | null): number => positive(lang && lang.scale);
export const leadingOf = (lang?: { leading?: unknown } | null): number => positive(lang && lang.leading);

/*
 * Every size in the app was tuned by eye against Arabic, and a meaning or
 * a romanisation is Latin whatever is being taught. Latin sets more of its
 * body on the line than Arabic does — Arabic spends part of its em on the
 * harakat above and the tails below — so Latin at an Arabic-tuned size
 * reads as the louder of the two, which is backwards: the meaning is not
 * the thing being learnt.
 *
 * This is the same correction Vietnamese carries, and for the same reason:
 * Vietnamese is Latin. So it is Vietnamese's own number, and in a
 * Vietnamese course the taught word and its meaning come out at one size
 * again, as they should.
 */
const LATIN_SCALE = 0.78;

/* The properties, ready to spread into a style object beside whatever
   font-family the caller is already setting from the same pack.

   --sscale and --sleading are the taught script's; --lscale belongs to the
   Latin beside it and is the same whichever language that is. */
export function scriptVars(lang: { scale?: unknown; leading?: unknown }) {
  return {
    "--sscale": String(scaleOf(lang)),
    "--sleading": String(leadingOf(lang)),
    "--lscale": String(LATIN_SCALE),
  };
}

export const DEFAULT_LANGUAGE = "ar-PS";

export const langOf = (settings: Settings): Lang =>
  LANGUAGES[settings.language || DEFAULT_LANGUAGE] || LANGUAGES[DEFAULT_LANGUAGE];

/* One language is being learnt at a time, and a handful of pure helpers deep
   in the scheduler need to know which — they are called from places that have
   no settings to hand. The root component keeps this in step. */
export let ACTIVE_LANG_ID = DEFAULT_LANGUAGE;

export const activeLang = () => LANGUAGES[ACTIVE_LANG_ID] || LANGUAGES[DEFAULT_LANGUAGE];

export function setActiveLang(id: LangId) {
  if (LANGUAGES[id]) ACTIVE_LANG_ID = id;
}

/* Exercise names are written with the language left blank and filled in here,
   so a Vietnamese student is never told to write something in Arabic. */
export const EX_CACHE = new Map();

export function exOf(named: string, lang: Lang = activeLang()) {
  /* Takes a schedule key as readily as a type: the wording of a question is
     the same whichever accepted answer it happens to be about. */
  const type = typeOf(named);
  const spec = EX[type];
  if (!spec) return null;
  const key = `${type}\u0000${lang.id}`;
  const hit = EX_CACHE.get(key);
  if (hit) return hit;

  const attr = quizAttrOf(lang);
  /*
   * The two labels are different parts of speech, and that — not where they
   * land in a sentence — decides their case.
   *
   * A script's label is a name: Arabic script, Vietnamese, Hebrew. It keeps
   * its capital in the middle of a line as much as at the start, so both
   * spellings of the placeholder fill the same way and "write in arabic
   * script" is gone. A transliteration's label is a common noun —
   * "transliteration", "pronunciation note" — so it lowers mid-sentence and
   * {Translit} is there for the places it begins one.
   */
  const fill = (s: string): string =>
    String(s)
      .replace(/\{Script\}/g, cap(lang.scriptLabel))
      .replace(/\{script\}/g, cap(lang.scriptLabel))
      .replace(/\{S\}/g, lang.scriptShort || "?")
      .replace(/\{Translit\}/g, cap(lang.translitLabel))
      .replace(/\{translit\}/g, lang.translitLabel.toLowerCase())
      .replace(/\{attr\}/g, attr ? attr.label : "sound")
      .replace(/\{A\}/g, attr ? attr.short || "?" : "?");

  const out: Record<string, any> = { ...spec };
  for (const f of ["instruction", "label", "short", "question", "placeholder", "hintLabel", "hintHideLabel"]) {
    if (out[f]) out[f] = fill(out[f]);
  }
  EX_CACHE.set(key, out);
  return out;
}

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const TATWEEL = /\u0640/g;

export const AR_PUNCT = /[.,!?;:"'()[\]،؛؟«»]/g;

/*
 * Invisible characters are the quietest way for a correct answer to be
 * rejected: right-to-left marks, zero-width joiners and non-breaking
 * spaces ride along with Arabic text from keyboards and clipboards, and
 * nothing on screen shows they are there. Strip them before comparing.
 *
 * The second quietest is a letter that is the right letter in the wrong
 * encoding. Unicode carries every joined shape of an Arabic letter as a
 * character of its own — the "presentation forms", ﻋ ﻨ ﺪ for the ع ن د
 * that begin, continue and end a word — and Hebrew has its pointed
 * letters the same way. A word spelt in those looks identical, comes
 * from some keyboards and most clipboards, and was marked as wrong in
 * every letter: not a near miss but a different word. NFKC folds each
 * shape back to the letter it is a shape of, and is applied before
 * anything else reads the text, so every language's comparison sees
 * base letters and nothing downstream has to know the forms exist.
 */
export const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function stripInvisible(s: string) {
  return String(s || "").normalize("NFKC").replace(INVISIBLE, "").replace(/\u00a0/g, " ");
}

export function sortMarks(s: string) {
  return s.replace(
    /([\u0621-\u064A])([\u064B-\u0652\u0670]+)/g,
    (_, base, marks) => base + marks.split("").sort().join("")
  );
}

export function normAr(s: string, { stripTashkeel, ignoreHamza }: { stripTashkeel?: boolean; ignoreHamza?: boolean }) {
  let x = stripInvisible(s).trim().replace(TATWEEL, "");
  x = stripTashkeel ? x.replace(TASHKEEL, "") : sortMarks(x);
  if (ignoreHamza) {
    x = x
      .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
      .replace(/\u0649/g, "\u064A")
      .replace(/\u0629/g, "\u0647")
      .replace(/\u0624/g, "\u0648")
      .replace(/\u0626/g, "\u064A")
      .replace(/\u0621/g, "");
  }
  return x.replace(AR_PUNCT, "").replace(/\s+/g, " ").trim();
}

/* Articles a learner may or may not type. Dropped before comparing, so
   "book" and "the book" are the same answer. */
const LEADING = /^(to|the|a|an)\s+/;

export function normEn(s: string) {
  let x = stripInvisible(s).trim().toLowerCase();
  x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  x = x.replace(/[-\u2010\u2013\u2014_/]/g, " "); // hyphenation is not a spelling test
  x = x.replace(/[.,!?;:'"()[\]]/g, "").replace(/\s+/g, " ").trim();
  return x.replace(LEADING, "");
}

/* Transliteration is marked leniently: schemes vary, and the point is
   the sounds, not somebody's choice of macrons. */
export function normTr(s: string) {
  let x = stripInvisible(s).trim().toLowerCase();
  x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // ā -> a, ṣ -> s
  x = x.replace(/[ʿʾʼʻ'`‘’]/g, ""); // ayn, hamza, apostrophes
  x = x.replace(/[-‐–_]/g, " ");
  x = x.replace(/[.,!?;:"()[\]]/g, "");
  return x.replace(/\s+/g, " ").trim();
}

export const tight = (x: string): string => x.replace(/\s+/g, "");

/*
 * The alternatives a field may hold, plus the whole field as written —
 * so a card storing "office / desk" accepts "desk" and also accepts
 * "office / desk" typed out in full.
 */
export function splitForms(expected: string, sep: RegExp) {
  const whole = String(expected).trim();
  const parts = whole.split(sep).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.concat([whole]) : parts;
}

export function checkEn(given: string, expected: string) {
  const g = normEn(given);
  if (!g) return { ok: false, reason: "wrong" };
  const forms = splitForms(expected, /[/;,]/).map(normEn);
  if (forms.includes(g)) return { ok: true, reason: "exact" };
  const near = forms.some((e) => editDistance(g, e) <= Math.max(1, Math.round(e.length * 0.25)));
  return { ok: false, reason: near ? "near" : "wrong" };
}

export function checkTr(given: string, expected: string) {
  const g = normTr(given);
  if (!g) return { ok: false, reason: "wrong" };
  const forms = splitForms(expected, /[/;,]/).map(normTr);
  if (forms.includes(g)) return { ok: true, reason: "exact" };
  // Where the spaces and hyphens fall is a matter of scheme, not knowledge.
  if (forms.some((e) => tight(e) === tight(g))) return { ok: true, reason: "exact" };
  const near = forms.some((e) => editDistance(g, e) <= Math.max(1, Math.round(e.length * 0.2)));
  return { ok: false, reason: near ? "near" : "wrong" };
}

export const HAS_TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;

/*
 * Compared with the spaces taken out of both sides.
 *
 * Where a word ends and the next begins is a matter of convention in
 * Arabic, not of knowing the word. الحمد لله is written joined as often as
 * it is written apart, and so are عبد الله and إن شاء الله; a learner who
 * types الحمدلله has spelt every letter of it correctly. Compared as
 * written, that answer was one character short of the stored one, which
 * put it inside the near-miss band: "Very close", marked wrong, and the
 * exercise sent round again over a space.
 *
 * The rule is already the app's own, one script over. Transliteration has
 * said since it was written that where the spaces and hyphens fall is a
 * matter of scheme rather than knowledge, and folds them away before
 * deciding. This is that same sentence, applied to the script the scheme
 * is a transliteration of.
 *
 * Both comparisons lose their spaces, not just the first: an answer with
 * the harakat right and the space missing is not a mistake in the
 * vowelling, and marking it as one would be the same bug a tier up. The
 * edit distance is measured on the tightened forms too, so a genuine slip
 * is judged by its letters and never by the gaps between them.
 *
 * Vietnamese is deliberately not given this: there every syllable is its
 * own word and the spaces carry the meaning. Hebrew is built like Arabic
 * and could take the same rule, but nothing has asked for it yet.
 */
/*
 * Whether every mark the learner actually typed is one the word carries.
 *
 * The rule the two marked scripts share, and the one a learner reported:
 * **a mark you type has to be right; a mark you leave off is forgiven.**
 * It used to be all or nothing — type no harakat at all and the answer is
 * accepted, type one of the three correctly and the answer is refused —
 * so a learner who knew more of the word than the one beside them was
 * marked down for it, and the closer they got to the full spelling the
 * worse they did until the moment they got all of it.
 *
 * That was never anybody's intention. "The marks you type have to be the
 * right ones" is what the rules have always said, and leaving one off is
 * not typing a wrong one; it is the same thing as leaving them all off,
 * which has always been accepted.
 *
 * Both strings arrive normalised, and the caller has already found their
 * letters equal — that is the first stage of the judgement and this is the
 * second — so walking the two in step pairs each letter with itself. A
 * letter the learner left bare is passed over; a letter they marked is
 * held to what the word carries there, and *subset* rather than equal, for
 * the same reason: a letter with a shadda and a fatha on it, typed with
 * the shadda alone, has had nothing wrong written on it.
 */
function typedMarksRight(given: string, expected: string, marks: RegExp): boolean {
  const at = (s: string) => {
    const out: { base: string; marks: Set<string> }[] = [];
    for (const ch of s) {
      if (marks.test(ch)) {
        if (out.length) out[out.length - 1].marks.add(ch);
        continue;
      }
      out.push({ base: ch, marks: new Set<string>() });
    }
    return out;
  };
  const mine = at(given);
  const theirs = at(expected);
  /* Letters equal is the caller's finding, so this cannot differ — and if
     it ever did, the old all-or-nothing answer is the safe one. */
  if (mine.length !== theirs.length) return given === expected;
  for (let i = 0; i < mine.length; i++) {
    if (mine[i].base !== theirs[i].base) return false;
    for (const mark of mine[i].marks) if (!theirs[i].marks.has(mark)) return false;
  }
  return true;
}

export function compareAr(given: string, expected: string, settings: Settings) {
  const mode = settings.tashkeel || "either";
  const hamza = settings.ignoreHamza;
  const skelG = tight(normAr(given, { stripTashkeel: true, ignoreHamza: hamza }));
  const skelE = tight(normAr(expected, { stripTashkeel: true, ignoreHamza: hamza }));

  if (!skelG) return { ok: false, reason: "wrong" };
  if (skelG !== skelE) {
    const near = editDistance(skelG, skelE) <= Math.max(1, Math.round(skelE.length * 0.2));
    return { ok: false, reason: near ? "near" : "wrong" };
  }
  if (mode === "ignore") return { ok: true, reason: "letters-only" };

  const givenHas = HAS_TASHKEEL.test(given);
  const storedHas = HAS_TASHKEEL.test(expected);
  if (!storedHas) return { ok: true, reason: givenHas ? "unchecked" : "letters-only" };
  if (!givenHas) {
    return mode === "required" ? { ok: false, reason: "missing" } : { ok: true, reason: "bare" };
  }

  const fullG = tight(normAr(given, { stripTashkeel: false, ignoreHamza: hamza }));
  const fullE = tight(normAr(expected, { stripTashkeel: false, ignoreHamza: hamza }));
  if (fullG === fullE) return { ok: true, reason: "exact" };
  /* Some of the harakat, all of them right. Marked the way a word typed
     bare is, because that is what it is: fewer marks than the word
     carries, and none of them wrong. `required` is the mode that asks for
     the whole vocalisation, and there this is still short of it. */
  if (mode !== "required" && typedMarksRight(fullG, fullE, HAS_TASHKEEL)) {
    return { ok: true, reason: "bare" };
  }
  return { ok: false, reason: "harakat" };
}

export const AR_RANK: Record<string, number> = { wrong: 0, near: 1, missing: 2, harakat: 3 };

export function checkAr(given: string, expected: string, settings: Settings) {
  let worst = { ok: false, reason: "wrong" };
  for (const form of splitForms(expected, /[/;]/)) {
    const r = compareAr(given, form, settings);
    if (r.ok) return r;
    if (AR_RANK[r.reason] > AR_RANK[worst.reason]) worst = r;
  }
  return worst;
}

export function checkAnswer(typed: string, item: Record<string, any>, key: string, settings: Settings) {
  const spec = EX[typeOf(key)];
  const mode = spec.answerMode;
  /* Nothing to mark: a read-through is met, not answered. It is here so
     that every exercise can be handed to one function, rather than the
     screen remembering which ones to keep away from it. */
  if (mode === "read") return { ok: true, reason: "read" };
  /*
   * Marked by the learner.
   *
   * Nobody else was in the room while they read it, so the only honest
   * marking is theirs. What comes back is their own answer, and the
   * reason says so rather than saying "wrong" — a scene they could not
   * quite follow is a scene to come back to, not a mistake they made.
   */
  if (mode === "self") {
    return String(typed || "") === SELF_ALL
      ? { ok: true, reason: "exact" }
      : { ok: false, reason: "self" };
  }
  /* The scene, rebuilt. Right is the order it was written in and there is
     no near miss: two lines swapped is a conversation that did not
     happen. */
  if (mode === "order") {
    return orderIsRight(String(typed || ""), item)
      ? { ok: true, reason: "exact" }
      : { ok: false, reason: "wrong" };
  }
  /*
   * A whole part, marked as one thing.
   *
   * Each turn goes through the language's own marking, so a missing mark
   * in the third line is the near miss it would be on its own; the part
   * is right only when every turn is. What comes back for a miss is the
   * kindest of the misses, because the schedule reads it: three turns
   * right and one short of its harakat is a card to nudge, not one to
   * send back to the start.
   */
  if (mode === "part") {
    const turns = yourLines(item);
    const said = partAnswers(String(typed || ""));
    let best = { ok: false, reason: "wrong" };
    let allRight = turns.length > 0;
    for (let i = 0; i < turns.length; i++) {
      const r = langOf(settings).check(said[i] || "", turns[i].ar, settings);
      if (r.ok) continue;
      allRight = false;
      if (AR_RANK[r.reason] > AR_RANK[best.reason]) best = r;
    }
    return allRight ? { ok: true, reason: "exact" } : best;
  }
  /* One of a few answers, chosen rather than typed — a line of a scene, or
     a word missing from a phrase. What came back is the text itself, so it
     is compared as text. Whitespace only, because both sides are wording
     the app put on the screen. */
  if (mode === "choice" && spec.picks) {
    const want = String(item[spec.answerField] || "").replace(/\s+/g, " ").trim();
    const got = String(typed || "").replace(/\s+/g, " ").trim();
    if (!got) return { ok: false, reason: "wrong" };
    return got === want ? { ok: true, reason: "exact" } : { ok: false, reason: "wrong" };
  }
  // A property picked from a list rather than typed. Graded in the classes the
  // language actually distinguishes by ear, which may be fewer than it writes.
  if (mode === "choice") {
    const attr = quizAttrOf(langOf(settings));
    if (!attr) return { ok: false, reason: "wrong" };
    const want = gradeClass(attr, derivedValue(attr, item[spec.answerField]));
    const got = gradeClass(attr, String(typed || ""));
    if (!got) return { ok: false, reason: "wrong" };
    return got === want ? { ok: true, reason: "exact" } : { ok: false, reason: "wrong" };
  }
  const expected = item[spec.answerField];
  /*
   * Figures, where the answer is a number rather than a word.
   *
   * Exact or wrong, with no near tier — and that is the whole point of it
   * being its own mode. English answers are marked with an edit distance,
   * which is right for a word: *bok* is a learner who knows *book*. On a
   * number it is a disaster, because every single-digit answer is one
   * edit from every other, so 2 for 4 came back "very close" and was
   * marked more kindly than a miss. Three is not nearly eight.
   *
   * What is forgiven is notation and not knowledge: the grouping marks a
   * reader puts in by habit, and the digits an Arabic or Persian keyboard
   * writes them with. ٤٧ and 47 are the same number, and a learner typing
   * the digits their own keyboard makes should not be told they are
   * wrong.
   */
  if (mode === "fig") {
    const figures = (s: unknown) =>
      String(s == null ? "" : s)
        /* Arabic-Indic and Extended Arabic-Indic digits, folded to the
           ones the card is stored with. */
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
        /* Thousands separators, in the several shapes they are written:
           spaces of every width, commas, full stops, apostrophes, and the
           Arabic thousands mark. */
        .replace(/[\s,._'\u00A0\u2009\u202F\u066C]/g, "")
        /* A number written with no sign on it, so a stray plus is not the
           difference between right and wrong. */
        .replace(/^\+/, "");
    const got = figures(typed);
    if (!got || !/^\d+$/.test(got)) return { ok: false, reason: "wrong" };
    /* Leading zeros are notation too: 047 is 47 written out of habit. */
    const same = String(Number(got)) === String(Number(figures(expected)));
    return same ? { ok: true, reason: "exact" } : { ok: false, reason: "wrong" };
  }
  // "ar" means "the target language's own script", whatever that is.
  if (mode === "ar") return langOf(settings).check(typed, expected, settings);
  if (mode === "tr") return checkTr(typed, expected);
  return checkEn(typed, expected);
}

/* The tiers are the same everywhere; each language supplies its own words for
   them. "harakat" is the historical name of the partial-credit tier and stays
   as the internal code so stored progress keeps its meaning. */
export const VERDICT_FALLBACK: Verdicts = {
  partial: "Right letters, wrong marks",
  missing: "Letters right — add the marks",
  near: "Very close",
  bare: "The marks are above — worth a look.",
};

/**
 * @param key  One of the four tiers, named rather than left
 *   an open string: the fallback below has a word for each of them and for
 *   nothing else, so a key it has never heard of would read as no verdict
 *   at all rather than as a mistake.
 */
export function verdictWord(lang: Lang | null | undefined, key: keyof Verdicts) {
  const own = (lang && lang.verdicts) || VERDICT_FALLBACK;
  return own[key] || VERDICT_FALLBACK[key];
}

export function verdictText(result: Record<string, any>, lang?: Lang) {
  if (!result) return "";
  if (result.ok) return "Correct";
  if (result.reason === "harakat") return verdictWord(lang, "partial");
  if (result.reason === "missing") return verdictWord(lang, "missing");
  if (result.reason === "near") return verdictWord(lang, "near");
  return "Not quite";
}

/* ------------------------------------------------------------------
   Defaults

   Written out of the declarations above rather than beside them, so a new
   language or a new exercise type cannot arrive without one.
   ------------------------------------------------------------------ */

/* Everything a card can support is drilled unless it is turned off. A
   recording is the only way to practice a language by ear, so leaving those
   exercises off by default meant recordings were made and never heard. */
/* The gentler half of the set, read off the definitions rather than kept
   as a second list beside them. The app used to hold one, and a new type
   had to be remembered in two places or "Get started" quietly never offered
   it. */
export const EASY_TYPES = TYPES.filter((t) => EX[t].gentle);

/* The level an exercise stands on, read off the definitions the same way.
   Recognising a word alone is 1, telling it apart from others is 2,
   producing it from a cue — its pronunciation, its sound — is 3, and
   producing it from the meaning alone is 4. The scheduler opens a level for
   a form only once everything below it has reached the level's bar; the
   table here only says which level is which. Anything unknown is treated as
   the bottom level, so a stored session naming a retired type still resolves. */
export const levelOf = (key: string): number => {
  const spec = EX[typeOf(key)];
  return (spec && spec.level) || 1;
};

/*
 * Whether this question shows one accepted answer, or keeps them all.
 *
 * A card may accept more than one word — كتاب or سفر, مبسوط or مبسوطة —
 * and what to do about that depends on whether the question *shows* the
 * word or *asks for* it.
 *
 * Showing them all is always wrong. Both spellings put up together read as
 * one long word with a slash through it, and a tile carrying two of them
 * is the longest tile in the grid, which is the answer given away by its
 * shape rather than by its meaning. So every question that puts the word
 * on screen — above the question, in the four to choose between, in a
 * column of a grid — puts up one, rotated so that both are met.
 *
 * Accepting them all is the point. Asked to write the word in the script,
 * a learner who knows the other spelling knows the word, and marking them
 * wrong for it is the bug that the second accepted answer exists to
 * prevent. So a question that is typed in the script keeps every one.
 *
 * Pronunciation is the exception that proves it: it types the script and
 * still narrows, because it names one spelling by asking how *that* one is
 * said, and accepting the other would mark the wrong thing right.
 *
 * Here rather than in the trainer so the rule can be read, and checked
 * against every exercise at once, without rendering anything.
 */
export function showsOneAnswer(key: string): boolean {
  const spec = EX[typeOf(key)];
  if (!spec) return true;
  if (spec.needs.includes("lat")) return true;
  return !(spec.answerMode === "ar" && spec.answerField === "ar");
}

/*
 * The schedule keys one form carries for one exercise.
 *
 * A card may accept more than one word, and knowing one of them is not
 * knowing the word beside it. So wherever a question shows a single
 * accepted answer, each answer is asked and scheduled in its own right,
 * exactly as each cell of a verb's table is, and the key says which.
 *
 * The questions that accept every spelling get one key, because there is
 * one question there: asked to write a word from its meaning, a learner
 * who writes either of them has answered it.
 *
 * One answer, or none written, is the bare type — which is every card
 * written before this, unchanged.
 */
export function keysFor(form: WithAnswers | null | undefined, type: string): string[] {
  if (!showsOneAnswer(type)) return [typeOf(type)];
  const many = answersOf(form, answerFields()).length;
  if (many < 2) return [typeOf(type)];
  return Array.from({ length: many }, (_, at) => keyFor(typeOf(type), at));
}

/*
 * What a level asks of the levels below it before it opens.
 *
 * *Graduated* is through the learning steps and in review at all;
 * *mastered* is in review with four days of interval or more, which is a
 * further right answer the next day and another a few days after that.
 *
 * The two cued levels — telling a word apart from others, and writing it
 * from a pronunciation or a recording that carries it — open on
 * graduated, the way the matching grid has since 0.85 and for the same
 * reason. Asking a four-day interval of every recognition exercise first
 * meant four right answers each, three days at the very fastest, and in
 * practice a week or more of a card being asked nothing but which of
 * four: new cards went on arriving at the bottom while nothing climbed,
 * which is the passive-vocabulary plateau written into the schedule. A
 * cued question is not recall from the meaning alone, and a first
 * fortnight that never asks for the word is the wrong fortnight.
 *
 * Level four keeps the four-day bar, so the strict gate stands exactly
 * where production from the meaning alone begins — the one place where
 * opening early means asking for something that has not been taught yet.
 * Missing a question below twice running still closes the levels above,
 * because graduated is false in relearning — see `holding` in the
 * scheduler, which is what forgives the first miss.
 *
 * Written once per level rather than on each exercise. It was on each of
 * them for a day: nine declarations of one fact, kept in step by a test,
 * with the level-one entries saying "mastered" for a bar nothing reads and
 * `openTypes` quietly taking the loosest of whatever a card happened to
 * carry — so a card whose only level-two exercise was the gap-fill could
 * climb by a stricter rule than the card beside it. Level 1 is here for
 * completeness; nothing stands below it, so it opens from the first
 * session whatever it says.
 */
/* The top of the ladder, read off the bars rather than written down twice:
   a fifth level would be a line in the table below and nothing else. */
export const TOP_LEVEL = 4;

export const LEVEL_BARS: Record<number, "graduated" | "mastered"> = {
  1: "graduated",
  2: "graduated",
  3: "graduated",
  4: "mastered",
};

/* And what the levels below an exercise must reach for it to open, which
   is the bar of the level it stands on. */
export const barOf = (key: string): "graduated" | "mastered" => LEVEL_BARS[levelOf(key)] || "mastered";

/* Read the other way round: what a level has to reach to be done with —
   which is whatever the level above it asks of everything below. The top of
   the ladder has nothing above it and asks the strictest the app has, so
   "done" means the same thing there as everywhere else: nothing is left to
   open, and the card is learnt. */
export const barAfterLevel = (level: number): "graduated" | "mastered" =>
  LEVEL_BARS[level + 1] || "mastered";

/* How every language marks what is typed, gathered into the one flat
   record the settings are stored as and the pack `check` functions read. */
export function defaultMarking(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const lang of Object.values(LANGUAGES)) {
    Object.assign(out, lang.marking || {});
  }
  return out;
}

/* The card fields that hold a grammatical value, plus the lexical ones. Used
   by anything that has to list them — import, export, storage. */
export function grammarFields() {
  const out = Object.values(GRAMMAR).map((d) => d.field);
  for (const lang of Object.values(LANGUAGES)) {
    if (lang.lexical && !out.includes(lang.lexical.key)) out.push(lang.lexical.key);
  }
  return out;
}

/*
 * The same list, with what each field will accept.
 *
 * What an answer may carry, in the shape answers.ts narrows against — the
 * grammar table is the authority on both, and this is how it says so
 * without answers.ts having to import it (which would be a cycle, since
 * marking an answer reads that file).
 *
 * A lexical key takes any text — a Vietnamese classifier is a word, not a
 * choice from a list — so its allowed list is empty, which readAnswer
 * reads as "anything non-empty".
 */
export function answerFields(): AnswerField[] {
  const out = Object.values(GRAMMAR).map((d) => ({
    field: d.field,
    allowed: d.options.map(([value]) => value),
  }));
  for (const lang of Object.values(LANGUAGES)) {
    const lexical = lang.lexical;
    if (lexical && !out.some((f) => f.field === lexical.key)) {
      out.push({ field: lexical.key, allowed: [] });
    }
  }
  return out;
}

/* "pl", "plural", "PL." all mean the same thing, whichever axis it is. */
export function normDimValue(dim: GrammarDim, value: unknown) {
  const x = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!x) return dim.required ? dim.options[0][0] : "";
  for (const [v] of dim.options) if (v === x) return v;
  for (const [v] of dim.options) if (x.startsWith(v.slice(0, 2))) return v;
  for (const [v] of dim.options) if (v.startsWith(x)) return v;
  return dim.required ? dim.options[0][0] : "";
}
