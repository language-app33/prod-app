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
/** @import { Derived, ExerciseSpec, GrammarDim, Lang, LangId, Settings } from "./types.js" */


/* The exercise types on offer. This is the registry everything derives from —
   which states a card carries, what a session may pick, what the settings
   list, what an export has columns for — so retiring a type is one edit here
   and its definition stays below. */
export const TYPES = ["ar2en", "rec2en", "tr2ar", "rec2ar", "en2ar", "ctx2ar", "rec2ctx", "rec2attr"];

/** @type {Record<string, ExerciseSpec>} */
export const EX = {
  ar2en: {
    instruction: "Write this card in English",
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
    retired: true,
    instruction: "Write this card in {translit}",
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
    instruction: "Write this card in {script}",
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
    instruction: "Write this card in {script}",
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
  ctx2ar: {
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
};

/* An exercise that plays a recording and asks what was in it. The listening
   ones are exactly the specs prompted by audio — named here, beside the table
   it reads, so a fourth of them needs no second edit anywhere else. */
/* Takes nothing as well as a name: it is asked about whatever a stored
   session holds, which may name an exercise that has since been retired,
   or nothing at all. */
/** @type {(type?: string | null) => boolean} */
export const isListening = (type) => !!type && !!EX[type] && EX[type].promptField === "audio";

/* "na" maps to nothing on purpose: a form whose number does not apply should
   carry no number label at all, not the letters "na". labelFor falls back to
   the raw value for anything missing here, so the empty string is load
   bearing. */
/** @type {Record<string, string>} */
export const NUMBER_SHORT = { singular: "sg.", plural: "pl.", na: "" };

/** @type {Record<string, string>} */
export const GENDER_SHORT = { masculine: "m.", feminine: "f.", neutral: "n." };

/**
 * @param {string} a
 * @param {string} b
 */
export function editDistance(a, b) {
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

   A word, a phrase, or a sentence. It decides what a learner can filter
   practice down to, how the script is typeset, and — the reason it is being
   taken seriously now — whether a card can serve as a context for the words
   inside it.

   It lives here rather than in the app because the answer is the language's
   business: "a space means more than one word" holds for Arabic and
   Vietnamese and fails flatly for a script written without spaces between
   words. A pack that needs a different rule declares `guessKind` and the app
   is none the wiser; every other pack gets this one.
   ------------------------------------------------------------------ */

/* Sentence-ending punctuation, Latin and Arabic. */
const SENTENCE_MARK = /[.!?،؛؟]/;

/**
 * @param {string | null} [text]  Whatever the card holds, which for an empty field is nothing at all.
 * @param {{ guessKind?: (text: string) => string } | null} [lang]  A pack, or as much of one as the caller has: only its own rule is read.
 * @returns {string}
 */
export function guessKind(text, lang = null) {
  const t = String(text || "").trim();
  const own = lang && lang.guessKind;
  if (own) return own(t);
  if (!t) return "word";
  /* Punctuation, or four words or more: long enough to be a sentence
     whether or not it was punctuated. */
  if (SENTENCE_MARK.test(t) || t.split(/\s+/).length >= 4) return "sentence";
  return /\s/.test(t) ? "phrase" : "word";
}

/**
 * @param {Record<string, any>} [src]
 * @returns {Record<string, string>}
 */
export function dimValues(src = {}) {
  /** @type {Record<string, string>} */
  const out = {};
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

/* How a form is named in the card list: "pl. f." in Arabic, "elder" in
   Vietnamese. Only the dimensions this language uses get a mention. */
/**
 * @param {Record<string, any>} unit
 * @param {Lang} [lang]
 */
export function labelFor(unit, lang = activeLang()) {
  const bits = [];
  for (const dim of dimsOf(lang)) {
    const value = unit[dim.field];
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

/**
 * @param {string} s
 * @param {{ stripTones?: boolean }} opts
 */
export function normViet(s, { stripTones }) {
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
/**
 * @param {Partial<Lang> | null} [lang]
 * @returns {lang is Lang}
 */
export function supportsContext(lang) {
  return !!(lang && lang.context && lang.context.matches);
}

/**
 * @param {string} text
 * @param {Lang} lang
 */
export function contextTokens(text, lang) {
  const own = lang && lang.context && lang.context.tokens;
  const t = String(text || "").trim();
  if (!t) return [];
  return own ? own(t) : t.split(/\s+/);
}

/*
 * Which token of `phrase` is `word`, or -1. The index, not the text: it is
 * what a fill-the-gap question needs in order to blank the right one.
 */
/**
 * @param {string} phrase
 * @param {string} word
 * @param {Partial<Lang>} lang  A language that declares no context answers -1, which is the point.
 */
export function findWordSlot(phrase, word, lang) {
  if (!supportsContext(lang) || !phrase || !word) return -1;
  const tokens = contextTokens(phrase, lang);
  for (let i = 0; i < tokens.length; i++) {
    if (lang.context.matches(tokens[i], word)) return i;
  }
  return -1;
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
 * @param {Record<string, any>[]} cards
 * @param {Partial<Lang>} lang  A language that declares no context is reported as unsupported, not as empty.
 */
export function contextCoverage(cards, lang) {
  const empty = { supported: false, words: [], counts: { word: 0, phrase: 0, sentence: 0 }, covered: 0, links: 0 };
  if (!supportsContext(lang)) return empty;

  /** @type {Record<string, number>} */
  const counts = { word: 0, phrase: 0, sentence: 0 };
  /** @type {Record<string, any>[]} */
  const words = [];
  /** @type {Record<string, any>[]} */
  const contexts = [];
  for (const c of cards || []) {
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

   Peeled rather than pattern-matched, because the combinations multiply and
   a list of them goes stale. Two peels deep is enough for anything real,
   and the remainder must keep three letters: Arabic words are built on
   three consonants, so a two-letter remainder is the sign of having peeled
   away the word itself rather than a prefix.

   It will still occasionally offer a wrong match — كتاب peels to تاب, which
   is a word. That is why a match is a suggestion for the teacher to accept,
   never a fact the app acts on by itself. */
const AR_PROCLITICS = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];

/**
 * @param {string} token
 * @param {number} [depth]
 */
export function arWordStems(token, depth = 2) {
  const out = [token];
  /** @type {(s: string, left: number) => void} */
  const peel = (s, left) => {
    if (left <= 0) return;
    for (const p of AR_PROCLITICS) {
      if (!s.startsWith(p)) continue;
      const rest = s.slice(p.length);
      if (rest.length < 3 || out.includes(rest)) continue;
      out.push(rest);
      peel(rest, left - 1);
    }
  };
  peel(token, depth);
  return out;
}

/**
 * @param {string} token
 * @param {string} word
 */
export function arTokenIsWord(token, word) {
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
/**
 * @param {string} token
 * @param {string} word
 */
export function viTokenIsWord(token, word) {
  const opts = { stripTones: false };
  const w = normViet(word, opts);
  return !!w && normViet(token, opts) === w;
}

/**
 * @param {string} given
 * @param {string} expected
 * @param {Settings} settings
 */
export function checkViet(given, expected, settings) {
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

/** @type {Record<string, GrammarDim>} */
export const GRAMMAR = {
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

/** @type {(lang: Lang) => GrammarDim[]} */
export const dimsOf = (lang) => (lang.grammar || []).map((k) => GRAMMAR[k]).filter(Boolean);

/* Every value any dimension can hold, for validating stored cards without
   knowing which language wrote them. */
/** @type {Record<string, string[]>} */
export const DIM_VALUES = {};
for (const dim of Object.values(GRAMMAR)) {
  DIM_VALUES[dim.field] = (DIM_VALUES[dim.field] || []).concat(dim.options.map(([v]) => v));
}

/* The marks that carry tone. Deliberately not the ones that build letters —
   the circumflex of â, the breve of ă, the horn of ơ — which are spelling,
   not tone. */
/** @type {Record<string, string>} */
export const VI_TONE_OF = {
  "\u0300": "huyen",
  "\u0301": "sac",
  "\u0309": "hoi",
  "\u0303": "nga",
  "\u0323": "nang",
};

/* One tone per syllable, joined, so a two-syllable word has a signature of
   its own and minimal pairs still line up. */
/** @param {string} text */
export function viTone(text) {
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
/** @param {string} text */
export function viBare(text) {
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
/** @param {string} ar */
export function arSimilarityKey(ar) {
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
/** @param {string} text */
export function arRootKey(text) {
  let x = normAr(text, { stripTashkeel: true, ignoreHamza: true }).replace(WEAK_LETTERS, "");
  if (x.startsWith("\u0645") && x.length >= 4) x = x.slice(1);
  if (x.endsWith("\u0647") && x.length >= 4) x = x.slice(0, -1);
  return x.length >= 3 ? x : "";
}

/** @param {string} text */
export function arSkeleton(text) {
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

/**
 * @param {Derived} attr
 * @param {string} text
 */
export function derivedValue(attr, text) {
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

/** @type {(lang: Lang) => Derived[]} */
export const attrsOf = (lang) => lang.derived || [];

/** @type {(lang: Lang) => Derived | null} */
export const quizAttrOf = (lang) => attrsOf(lang).find((a) => a.quizzable) || null;

/** @type {(lang: Lang) => Derived | null} */
export const groupAttrOf = (lang) => attrsOf(lang).find((a) => a.groups) || null;

/* Collapse a value to the class it is graded in. Huế does not distinguish
   hỏi from ngã in speech, so a listening exercise must not either — but the
   spelling does distinguish them, so this is never applied to typing. */
/**
 * @param {Derived} attr
 * @param {string} value
 */
export function gradeClass(attr, value) {
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
/** @type {Record<string, string>} */
const HE_FINAL_OF = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/**
 * @param {string} s
 * @param {{ stripNiqqud?: boolean, foldFinals?: boolean }} opts
 */
export function normHe(s, { stripNiqqud, foldFinals }) {
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
/**
 * @param {string} given
 * @param {string} expected
 * @param {Settings} settings
 */
export function compareHe(given, expected, settings) {
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
/**
 * @param {string} given
 * @param {string} expected
 * @param {Settings} settings
 */
export function checkHe(given, expected, settings) {
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
/** @param {string} text */
export function heRootKey(text) {
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
/** @param {string} text */
export function heSimilarityKey(text) {
  return normHe(text, { stripNiqqud: true, foldFinals: true }).replace(/[וי\s]/g, "");
}

/* Which words a recorded phrase teaches. Peeled like Arabic's, two deep,
   and the remainder must keep two letters — Hebrew has real two-letter
   words, אב and יד among them, where Arabic has none. */
/**
 * @param {string} token
 * @param {number} [depth]
 */
export function heWordStems(token, depth = 2) {
  const out = [token];
  /** @type {(s: string, left: number) => void} */
  const peel = (s, left) => {
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

/**
 * @param {string} token
 * @param {string} word
 */
export function heTokenIsWord(token, word) {
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
/**
 * @param {string} text
 * @param {Lang} [lang]
 */
export function inScript(text, lang = activeLang()) {
  return !!(lang && lang.script && lang.script.test(String(text || "")));
}

/** @type {Record<LangId, Lang>} */
export const LANGUAGES = {
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
    context: { matches: arTokenIsWord },
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
        help: "Lenient accepts ا for أ إ آ, ي for ى, and ه for ة.",
      },
    ],
    rules: [
      "Cards hold the Arabic script, an English meaning, and a transliteration. Any two of the three are enough to practice it.",
      "A student may type the bare consonants or the fully vocalised spelling and both are accepted — but harakat that are typed must be correct. A wrong vowel is marked wrong; a missing one is not.",
      "By default ا is accepted for أ إ آ, ي for ى, and ه for ة, because those distinctions are learnt later than the words themselves. A teacher can tighten this per course.",
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
    context: { matches: viTokenIsWord },
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
    context: { matches: heTokenIsWord },
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
/** @type {(n: unknown) => number} */
const positive = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1);

/* Asked for one field, so that is what they ask for: a caller wanting to
   know how large a script wants to be need not have a whole pack in hand,
   and `unknown` rather than `number` because `positive` exists precisely
   to survive a pack that wrote something a calc() could not use. */
/** @type {(lang?: { scale?: unknown } | null) => number} */
export const scaleOf = (lang) => positive(lang && lang.scale);
/** @type {(lang?: { leading?: unknown } | null) => number} */
export const leadingOf = (lang) => positive(lang && lang.leading);

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
/** @param {{ scale?: unknown, leading?: unknown }} lang */
export function scriptVars(lang) {
  return {
    "--sscale": String(scaleOf(lang)),
    "--sleading": String(leadingOf(lang)),
    "--lscale": String(LATIN_SCALE),
  };
}

export const DEFAULT_LANGUAGE = "ar-PS";

/** @type {(settings: Settings) => Lang} */
export const langOf = (settings) =>
  LANGUAGES[settings.language || DEFAULT_LANGUAGE] || LANGUAGES[DEFAULT_LANGUAGE];

/* One language is being learnt at a time, and a handful of pure helpers deep
   in the scheduler need to know which — they are called from places that have
   no settings to hand. The root component keeps this in step. */
export let ACTIVE_LANG_ID = DEFAULT_LANGUAGE;

export const activeLang = () => LANGUAGES[ACTIVE_LANG_ID] || LANGUAGES[DEFAULT_LANGUAGE];

/** @param {LangId} id */
export function setActiveLang(id) {
  if (LANGUAGES[id]) ACTIVE_LANG_ID = id;
}

/* Exercise names are written with the language left blank and filled in here,
   so a Vietnamese student is never told to write something in Arabic. */
export const EX_CACHE = new Map();

/**
 * @param {string} type
 * @param {Lang} [lang]
 */
export function exOf(type, lang = activeLang()) {
  const spec = EX[type];
  if (!spec) return null;
  const key = `${type}\u0000${lang.id}`;
  const hit = EX_CACHE.get(key);
  if (hit) return hit;

  const attr = quizAttrOf(lang);
  /** @type {(s: string) => string} */
  const fill = (s) =>
    String(s)
      .replace(/\{Script\}/g, cap(lang.scriptLabel))
      .replace(/\{script\}/g, lang.scriptLabel.toLowerCase())
      .replace(/\{S\}/g, lang.scriptShort || "?")
      .replace(/\{Translit\}/g, cap(lang.translitLabel))
      .replace(/\{translit\}/g, lang.translitLabel.toLowerCase())
      .replace(/\{attr\}/g, attr ? attr.label : "sound")
      .replace(/\{A\}/g, attr ? attr.short || "?" : "?");

  /** @type {Record<string, any>} */
  const out = { ...spec };
  for (const f of ["instruction", "label", "short", "question", "placeholder", "hintLabel", "hintHideLabel"]) {
    if (out[f]) out[f] = fill(out[f]);
  }
  EX_CACHE.set(key, out);
  return out;
}

/** @type {(s: string) => string} */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const TATWEEL = /\u0640/g;

export const AR_PUNCT = /[.,!?;:"'()[\]،؛؟«»]/g;

/*
 * Invisible characters are the quietest way for a correct answer to be
 * rejected: right-to-left marks, zero-width joiners and non-breaking
 * spaces ride along with Arabic text from keyboards and clipboards, and
 * nothing on screen shows they are there. Strip them before comparing.
 */
export const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** @param {string} s */
export function stripInvisible(s) {
  return String(s || "").replace(INVISIBLE, "").replace(/\u00a0/g, " ");
}

/** @param {string} s */
export function sortMarks(s) {
  return s.replace(
    /([\u0621-\u064A])([\u064B-\u0652\u0670]+)/g,
    (_, base, marks) => base + marks.split("").sort().join("")
  );
}

/**
 * @param {string} s
 * @param {{ stripTashkeel?: boolean, ignoreHamza?: boolean }} opts
 */
export function normAr(s, { stripTashkeel, ignoreHamza }) {
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

/** @param {string} s */
export function normEn(s) {
  let x = stripInvisible(s).trim().toLowerCase();
  x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  x = x.replace(/[-\u2010\u2013\u2014_/]/g, " "); // hyphenation is not a spelling test
  x = x.replace(/[.,!?;:'"()[\]]/g, "").replace(/\s+/g, " ").trim();
  return x.replace(LEADING, "");
}

/* Transliteration is marked leniently: schemes vary, and the point is
   the sounds, not somebody's choice of macrons. */
/** @param {string} s */
export function normTr(s) {
  let x = stripInvisible(s).trim().toLowerCase();
  x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // ā -> a, ṣ -> s
  x = x.replace(/[ʿʾʼʻ'`‘’]/g, ""); // ayn, hamza, apostrophes
  x = x.replace(/[-‐–_]/g, " ");
  x = x.replace(/[.,!?;:"()[\]]/g, "");
  return x.replace(/\s+/g, " ").trim();
}

/** @type {(x: string) => string} */
export const tight = (x) => x.replace(/\s+/g, "");

/*
 * The alternatives a field may hold, plus the whole field as written —
 * so a card storing "office / desk" accepts "desk" and also accepts
 * "office / desk" typed out in full.
 */
/**
 * @param {string} expected
 * @param {RegExp} sep
 */
export function splitForms(expected, sep) {
  const whole = String(expected).trim();
  const parts = whole.split(sep).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.concat([whole]) : parts;
}

/**
 * @param {string} given
 * @param {string} expected
 */
export function checkEn(given, expected) {
  const g = normEn(given);
  if (!g) return { ok: false, reason: "wrong" };
  const forms = splitForms(expected, /[/;,]/).map(normEn);
  if (forms.includes(g)) return { ok: true, reason: "exact" };
  const near = forms.some((e) => editDistance(g, e) <= Math.max(1, Math.round(e.length * 0.25)));
  return { ok: false, reason: near ? "near" : "wrong" };
}

/**
 * @param {string} given
 * @param {string} expected
 */
export function checkTr(given, expected) {
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

/**
 * @param {string} given
 * @param {string} expected
 * @param {Settings} settings
 */
export function compareAr(given, expected, settings) {
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

/** @type {Record<string, number>} */
export const AR_RANK = { wrong: 0, near: 1, missing: 2, harakat: 3 };

/**
 * @param {string} given
 * @param {string} expected
 * @param {Settings} settings
 */
export function checkAr(given, expected, settings) {
  let worst = { ok: false, reason: "wrong" };
  for (const form of splitForms(expected, /[/;]/)) {
    const r = compareAr(given, form, settings);
    if (r.ok) return r;
    if (AR_RANK[r.reason] > AR_RANK[worst.reason]) worst = r;
  }
  return worst;
}

/**
 * @param {string} typed
 * @param {Record<string, any>} item
 * @param {string} type
 * @param {Settings} settings
 */
export function checkAnswer(typed, item, type, settings) {
  const spec = EX[type];
  const mode = spec.answerMode;
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
/** @type {Record<string, string>} */
export const VERDICT_FALLBACK = {
  partial: "Right letters, wrong marks",
  missing: "Letters right — add the marks",
  near: "Very close",
  bare: "The marks are above — worth a look.",
};

/**
 * @param {Lang | null | undefined} lang
 * @param {string} key
 */
export function verdictWord(lang, key) {
  const own = /** @type {Record<string, string>} */ (lang && lang.verdicts) || {};
  return own[key] || VERDICT_FALLBACK[key];
}

/**
 * @param {Record<string, any>} result
 * @param {Lang} [lang]
 */
export function verdictText(result, lang) {
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

/** @returns {Record<string, boolean>} */
export function defaultTypes() {
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const t of TYPES) out[t] = true;
  return out;
}

/* Every leniency setting any language offers, at its first choice. */
/** @returns {Record<string, string | boolean>} */
export function defaultLanguageOptions() {
  /** @type {Record<string, string | boolean>} */
  const out = {};
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

/* "pl", "plural", "PL." all mean the same thing, whichever axis it is. */
/**
 * @param {GrammarDim} dim
 * @param {unknown} value
 */
export function normDimValue(dim, value) {
  const x = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!x) return dim.required ? dim.options[0][0] : "";
  for (const [v] of dim.options) if (v === x) return v;
  for (const [v] of dim.options) if (x.startsWith(v.slice(0, 2))) return v;
  for (const [v] of dim.options) if (v.startsWith(x)) return v;
  return dim.required ? dim.options[0][0] : "";
}
