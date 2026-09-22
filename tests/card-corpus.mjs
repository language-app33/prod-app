/*
 * The example cards the two parity tests run over.
 *
 * One per kind of card and per feature that puts something on a card: a
 * word with two accepted answers, a word with the pronouns on its end, a
 * verb with its table, a sentence with two blanks, a conversation, a number
 * part, a value nobody is asked about, and a card written in the shape the
 * app stored before forms were one list.
 *
 * They are written out as cards *as the server holds them*, because that is
 * what the read-out is handed and what the editor's save produces. What
 * stops that drifting from the editor is the first test in
 * `tests/card-facts.test.mjs`: it takes the keys `writtenCard` actually
 * emits — from the function itself, not from a list — and the fields the
 * card record documents, and fails when one of them is carried by no card
 * here.
 *
 * Adding a field to a card therefore fails `tests/card-facts.test.mjs` with
 * "no example card carries this", and adding it here fails
 * `tests/card-readout.test.mjs` with "the read-out does not show this". That
 * is the whole mechanism; see src/card-facts.ts for why it is built this
 * way.
 */

const AR = "ar-PS";
const VI = "vi-Hue";

/* A hash is what a recording is keyed by. Anything of the right shape will
   do: nothing here plays one. */
const CLIP = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const SLOW = "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1";

/* A word with everything a plain word can carry: two accepted answers that
   differ in their grammar, both speeds of recording, a note, an ID, two
   group tags, and the words it says it teaches. */
const noun = {
  id: "srv-noun",
  owner: "teacher@example.com",
  lang: AR,
  category: "noun",
  sentence: false,
  ref: "book",
  fills: ["thing", "gift"],
  uses: ["srv-value"],
  note: "The commonest word in the first lesson.",
  drill: true,
  rev: 4,
  created: 1700000000000,
  updated: 1700000900000,
  decks: ["deck-1"],
  inDecks: ["deck-1"],
  forms: [
    {
      id: "f1",
      ar: "كِتاب / الكِتاب",
      en: "book",
      lat: "kitaab / il-kitaab",
      number: "singular",
      gender: "masculine",
      human: "thing",
      clips: [CLIP],
      slowClips: [SLOW],
      answers: [
        { text: "كِتاب", lat: "kitaab", number: "singular", gender: "masculine" },
        { text: "الكِتاب", lat: "il-kitaab", number: "singular", gender: "masculine" },
      ],
      ask: true,
      lend: true,
    },
    {
      id: "f2",
      ar: "كُتُب",
      en: "books",
      lat: "kutub",
      number: "plural",
      gender: "masculine",
      human: "thing",
      /* Written down for a student to read, and lent to the sentences that
         want a plural — the two ticks pulling in different directions,
         which is the case that needs both to be on the screen. */
      ask: false,
      lend: true,
    },
  ],
};

/* The pronouns on the end of a word: a table per form, so the cells say
   whose they are. One of them is kept without being asked. */
const attached = {
  id: "srv-attached",
  lang: AR,
  category: "noun",
  sentence: false,
  decks: ["deck-1"],
  forms: [
    { id: "g1", ar: "عِند", en: "at", lat: "3ind", number: "na", human: "thing" },
    { id: "g2", ar: "كِتاب", en: "book", lat: "kitaab", number: "singular" },
    {
      id: "g3",
      ar: "عِندي",
      en: "I have",
      lat: "3indi",
      row: "attached",
      col: "me",
      clips: [CLIP],
    },
    {
      id: "g4",
      ar: "عِندها",
      en: "she has",
      lat: "3indha",
      row: "attached",
      col: "her",
      ask: false,
      lend: false,
    },
    /* One hanging off the second form rather than off the card's own word,
       which is what `of` is for. */
    { id: "g5", ar: "كِتابي", en: "my book", lat: "kitaabi", row: "attached", col: "me", of: "g2" },
  ],
};

/* A verb, whose table belongs to the card, saved as the form a dictionary
   lists — which is why it carries a name. */
const verb = {
  id: "srv-verb",
  lang: AR,
  category: "verb",
  sentence: false,
  name: "to eat",
  decks: ["deck-2"],
  forms: [
    { id: "v1", ar: "أكل", en: "to eat", lat: "akal" },
    { id: "v2", ar: "أكل", en: "he ate", lat: "akal", row: "past", col: "he" },
    { id: "v3", ar: "أكلت", en: "she ate", lat: "akalat", row: "past", col: "she", clips: [CLIP] },
    { id: "v4", ar: "بياكل", en: "he eats", lat: "byaakul", row: "present", col: "he", ask: false },
  ],
};

/* A sentence: a frame with two holes in it, which fills nothing itself. */
const sentence = {
  id: "srv-sentence",
  lang: AR,
  sentence: true,
  category: "",
  name: "{{name}} has a {{thing}}",
  decks: ["deck-2"],
  forms: [
    {
      id: "s1",
      ar: "عِند {{name}} {{thing}}",
      en: "{{name}} has a {{thing}}",
      lat: "3ind {{name}} {{thing}}",
    },
  ],
};

/* A sentence that has narrowed a blank: the verbs in it stand in the past
   and nowhere else, which is the one thing about a blank that is the
   teacher's answer rather than a fact read off the card's own words. */
const tensed = {
  id: "srv-tensed",
  lang: AR,
  sentence: true,
  category: "",
  name: "yesterday {{name}} {{verb}}",
  decks: ["deck-2"],
  forms: [
    {
      id: "y1",
      ar: "مبارح {{name}} {{verb}}",
      en: "yesterday {{name}} {{verb}}",
      lat: "mbaari7 {{name}} {{verb}}",
      tenses: { verb: ["past"] },
    },
  ],
};

/* A value: there to stand in somebody else's hole, and not a question of
   its own. */
const value = {
  id: "srv-value",
  lang: AR,
  category: "name",
  sentence: false,
  fills: "name",
  drill: false,
  decks: [],
  forms: [
    {
      id: "n1",
      ar: "رافائيل",
      en: "Raphael",
      lat: "rafaa'iil",
      number: "singular",
      gender: "masculine",
      human: "person",
      ask: false,
      lend: true,
    },
  ],
};

/* A number card from before the language's numbers were one system: it
   carries what it was worth, and the kind of word nobody is offered any
   more. Neither is written now and a card that has them keeps them, which
   is the second reason the read-out walks the card instead of mirroring
   the editor. */
const part = {
  id: "srv-part",
  lang: AR,
  category: "number",
  value: 40,
  decks: ["deck-2"],
  forms: [{ id: "p1", ar: "أربعين", en: "forty", lat: "arba3iin" }],
};

/* A conversation: its name is the card's own word, its setting the note,
   and its turns are the lesson. */
const scene = {
  id: "srv-scene",
  lang: AR,
  kind: "dialog",
  note: "Two neighbours meet at the door.",
  speakers: ["Layla", "Karim"],
  you: 1,
  decks: ["deck-1"],
  forms: [{ id: "t0", ar: "", en: "At the door", lat: "" }],
  lines: [
    { id: "l1", who: 0, ar: "سلام", en: "peace", lat: "salaam", clips: [CLIP] },
    { id: "l2", who: 1, ar: "وعليكم السلام", en: "and upon you peace", lat: "w-3aleikum is-salaam", uses: ["srv-noun"] },
    { id: "l3", who: 0, ar: "وين {{thing}}", en: "where is the {{thing}}", lat: "ween {{thing}}", ask: false },
  ],
};

/*
 * A card in the shape the app stored before 0.138: the card is its own
 * first form, with the rest in `subs` beside it. Carries the value of a
 * retired axis too — `register`, which no pack declares any more and which
 * a card that has one keeps.
 *
 * In Huế, because that is the pack with a lexical axis of its own, and a
 * value stored under one has to reach the screen as well.
 */
const legacy = {
  id: "srv-legacy",
  lang: VI,
  category: "noun",
  decks: ["deck-3"],
  ar: "con mèo",
  en: "cat",
  lat: "con mèo",
  classifier: "con",
  register: "peer",
  subs: [{ id: "m2", ar: "mèo", en: "cat (bare)", lat: "mèo", classifier: "con" }],
};

/**
 * The cards, each with what it is there to cover. `what` is what a failure
 * names, so it says the case rather than the card.
 *
 * Typed as the open record every reader of a card takes, rather than left to
 * be inferred: a card is what the server holds, and the app's own doors
 * narrow it — see `Held` in card-facts.ts.
 *
 * @type {{ what: string, card: Record<string, any> }[]}
 */
export const CORPUS = [
  { what: "a word with two accepted answers, both speeds of recording and a form kept unasked", card: noun },
  { what: "a word with the pronouns on its end, on two of its forms", card: attached },
  { what: "a verb with its table, saved as the form a dictionary lists", card: verb },
  { what: "a sentence with two blanks in it", card: sentence },
  { what: "a sentence whose verb blank asks for one tense", card: tensed },
  { what: "a value that fills other cards' blanks and is not asked itself", card: value },
  { what: "a number card from before the number system, carrying what it was worth", card: part },
  { what: "a conversation with its speakers, its setting and a turn kept unasked", card: scene },
  { what: "a card in the shape stored before forms were one list, with a retired axis and a lexical one", card: legacy },
];

/** The decks the cards above are filed in, for a read-out that names them. */
export const DECKS = [
  { id: "deck-1", title: "Lesson 1" },
  { id: "deck-2", title: "Lesson 2" },
  { id: "deck-3", title: "Huế basics" },
];

/** And the collection they sit in, which is what the teacher's screen has:
    a blank's words and a tag's count are facts about all of them. */
export const POOL = CORPUS.map((row) => row.card);
