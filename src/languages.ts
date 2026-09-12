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
import type { Derived, ExerciseSpec, GrammarDim, Lang, LangId, Settings, Verdicts } from "./types.ts";
/* The one import here, and it goes the way every import in this file has
   to: dialogs.ts knows nothing about languages, so there is no cycle. It
   holds the shape of a scene, which marking a part and an ordering both
   have to read. */
import { DIALOG_KIND, SELF_ALL, isDialog, linesOf, orderIsRight, partAnswers, yourLines } from "./dialogs.ts";
import { answersOf } from "./answers.ts";
import type { AnswerField } from "./answers.ts";


/* The exercise types on offer. This is the registry everything derives from —
   which states a card carries, what a session may pick, what the settings
   list, what an export has columns for — so retiring a type is one edit here
   and its definition stays below. */
export const TYPES = [
  "match", "ar2en", "rec2en", "tr2ar", "rec2ar", "en2ar", "ctx2pick", "ctx2ar", "rec2ctx", "rec2attr",
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
    /* Its own rung, above reading a word on its own: a word is told apart
       from others only once it has been met alone. Through the learning
       steps is enough to get there — the grid is still recognition, and
       the four-day bar the rest of the ladder asks would keep a learner's
       first week without a grid at all. */
    level: 2,
    opensOn: "graduated",
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
     was also their first chance to get it wrong. */
  ctx2pick: {
    level: 1,
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
     rung above reading the scene, and beside choosing the reply. */
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
export const isListening = (type?: string | null): boolean =>
  !!type && !!EX[type] && EX[type].promptField === "audio";

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
): string =>
  isDialog(card) ? DIALOG_KIND : (card && card.kind) || guessKind(card && (card.ar || card.en || card.lat), lang);

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
  return fullG === fullE ? { ok: true, reason: "exact" } : { ok: false, reason: "harakat" };
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
    grammar: ["number", "gender"],
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
    /* Leniency the teacher can set, and what each one means. */
    options: [
      {
        key: "tashkeel",
        label: "Harakat when typing",
        choices: [
          ["either", "Either form"],
          ["required", "Must be typed"],
          ["ignore", "Never checked"],
        ],
        help:
          "Either form takes the bare letters or the fully vocalised spelling from one stored entry — but typed harakat have to be the right ones.",
      },
      {
        key: "ignoreHamza",
        label: "Hamza and final letters",
        toggle: true,
        help: "Lenient accepts ا for أ إ آ, و for ؤ, ي for ى and ئ, ه for ة, and a dropped ء. Strict wants every hamza where it is written.",
      },
    ],
    rules: [
      "Cards hold the Arabic script, an English meaning, and a transliteration. Any two of the three are enough to practice it.",
      "A student may type the bare consonants or the fully vocalised spelling and both are accepted — but harakat that are typed must be correct. A wrong vowel is marked wrong; a missing one is not.",
      "By default ا is accepted for أ إ آ, و for ؤ, ي for ى and ئ, and ه for ة, because those distinctions are learnt later than the words themselves. Each learner can turn that off under Settings — Hamza and final letters.",
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
    options: [
      {
        key: "tones",
        label: "Tone marks when typing",
        choices: [
          ["either", "Either form"],
          ["required", "Must be typed"],
          ["ignore", "Never checked"],
        ],
        help:
          "Either form accepts the word with or without its tone marks — but a tone that is typed has to be the right one.",
      },
    ],
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
    options: [
      {
        key: "niqqud",
        label: "Niqqud when typing",
        choices: [
          ["either", "Either form"],
          ["required", "Must be typed"],
          ["ignore", "Never checked"],
        ],
        help:
          "Either form takes the bare letters or the fully pointed spelling from one stored entry — but typed niqqud have to be the right ones.",
      },
      {
        key: "foldFinals",
        label: "Final letters",
        toggle: true,
        help: "Lenient accepts כ מ נ פ צ at the end of a word for ך ם ן ף ץ.",
      },
    ],
    rules: [
      "Cards hold the Hebrew, an English meaning, and a transliteration. Any two of the three are enough to practice it.",
      "A student may type the bare letters or the fully pointed spelling and both are accepted — but niqqud that are typed must be correct. A wrong vowel is marked wrong; a missing one is not.",
      "By default the ordinary shape of a letter is accepted at the end of a word for its final form, because the finals are learnt later than the words themselves. A teacher can tighten this per course.",
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

export function exOf(type: string, lang: Lang = activeLang()) {
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

export function compareAr(given: string, expected: string, settings: Settings) {
  const mode = settings.tashkeel || "either";
  const hamza = settings.ignoreHamza;
  const skelG = normAr(given, { stripTashkeel: true, ignoreHamza: hamza });
  const skelE = normAr(expected, { stripTashkeel: true, ignoreHamza: hamza });

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

  const fullG = normAr(given, { stripTashkeel: false, ignoreHamza: hamza });
  const fullE = normAr(expected, { stripTashkeel: false, ignoreHamza: hamza });
  return fullG === fullE ? { ok: true, reason: "exact" } : { ok: false, reason: "harakat" };
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

export function checkAnswer(typed: string, item: Record<string, any>, type: string, settings: Settings) {
  const spec = EX[type];
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

/* The rung an exercise stands on, read off the definitions the same way.
   Recognising a word alone is 1, telling it apart from others is 2,
   producing it from a cue — its pronunciation, its sound — is 3, and
   producing it from the meaning alone is 4. The scheduler opens a rung for
   a form only once everything below it has reached the rung's bar; the
   table here only says which rung is which. Anything unknown is treated as
   the bottom rung, so a stored session naming a retired type still resolves. */
export const levelOf = (type: string): number => (EX[type] && EX[type].level) || 1;

/* And what the rungs below must reach for it to open: mastered unless the
   exercise says graduated is enough. */
export const barOf = (type: string): "graduated" | "mastered" =>
  (EX[type] && EX[type].opensOn) || "mastered";

export function defaultTypes(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of TYPES) out[t] = true;
  return out;
}

/* Every leniency setting any language offers, at its first choice. */
export function defaultLanguageOptions(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const lang of Object.values(LANGUAGES)) {
    for (const opt of lang.options || []) {
      if (opt.toggle) out[opt.key] = true;
      else if (opt.choices && opt.choices.length) out[opt.key] = opt.choices[0][0];
    }
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
