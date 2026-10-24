// @ts-check
/*
 * A deck's quality — see src/deck-quality.ts.
 *
 * Every number here was worked out by hand from the owner's rules before
 * the test was run: 55 points for words met in sentences (two for the word
 * itself, one for each other form, half the card each), 10 for sentences
 * well made, 5 for each of seven smaller checks, and the points of a check
 * with nothing to measure shared among the rest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deckQuality, formIn, formsToMeet, qualityTone, unknownFinder, wantsSentences } from "../src/deck-quality.ts";
import { LANGUAGES } from "../src/languages.ts";
import { ALT_SEP } from "../src/answers.ts";
import { must } from "./helpers.mjs";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];
const he = LANGUAGES["he-IL"];

/** @param {any} q @param {string} key */
const checkOf = (q, key) => q.checks.find((/** @type {any} */ c) => c.key === key);
/** @param {any} q @param {string} id */
const rowOf = (q, id) => q.words.find((/** @type {any} */ w) => w.id === id);
/** @param {number} a @param {number} b @param {string} [what] */
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what || ""} ${a} ≠ ${b}`);

/* ---- what is asked to be in sentences ---- */

test("each form a student is asked is counted once: the word itself wants two sentences, the rest one", () => {
  const card = {
    id: "book", lang: "ar-PS", category: "noun",
    forms: [
      { id: "book", ar: "كتاب", en: "book" },
      { id: "books", ar: "كتب", en: "books" },
      { id: "same", ar: "كتب", en: "books, spelt again" },
      { id: "off", ar: "كتيب", en: "booklet", ask: false },
      { id: "empty", ar: "", en: "nothing written" },
    ],
  };
  assert.deepEqual(formsToMeet(card), [{ ar: "كتاب", need: 2 }, { ar: "كتب", need: 1 }]);
});

test("names, and cards there only to fill blanks, are not asked to be in sentences", () => {
  assert.equal(wantsSentences({ id: "a", category: "noun", forms: [{ ar: "باب", en: "door" }] }, ar), true);
  assert.equal(wantsSentences({ id: "b", category: "person", forms: [{ ar: "سارة", en: "Sarah" }] }, ar), false);
  assert.equal(wantsSentences({ id: "c", category: "place", forms: [{ ar: "نابلس", en: "Nablus" }] }, ar), false);
  assert.equal(wantsSentences({ id: "d", fills: ["name"], drill: false, forms: [{ ar: "رامي", en: "Rami" }] }, ar), false);
  assert.equal(wantsSentences({ id: "e", forms: [{ ar: "سكّر الباب من فضلك", en: "close the door please" }] }, ar), false,
    "a phrase is a sentence, not a word");
});

/* ---- a deck worked out whole ---- */

test("a small deck, scored by hand", () => {
  const coffee = { id: "w1", lang: "vi-Hue", category: "noun",
    forms: [{ id: "w1", ar: "cà phê", en: "coffee", lat: "", clips: ["h1"], images: ["i1"] }] };
  const drink = { id: "s1", lang: "vi-Hue", uses: ["w1"],
    forms: [{ id: "s1", ar: "tôi uống cà phê", en: "I drink coffee", lat: "", clips: ["h2"] }] };
  const known = [coffee, drink,
    { id: "k1", lang: "vi-Hue", category: "pronoun", forms: [{ ar: "tôi", en: "I" }] },
    { id: "k2", lang: "vi-Hue", category: "verb", forms: [{ ar: "uống", en: "to drink" }] }];
  const q = deckQuality([coffee, drink], { lang: vi, pool: known, known });
  /* The word is in one sentence of the two it wants: half of 55. The one
     sentence is linked and knows all its words: 10. Recordings, pictures,
     no repeats, nothing long: 5 each. No conversation: 0. Pronunciation
     and review have nothing to measure in Vietnamese with no blanks, so
     the 90 points left are scaled to 100. (27.5 + 10 + 20) / 90. */
  assert.equal(checkOf(q, "words").share, 0.5);
  assert.equal(checkOf(q, "sentences").share, 1);
  assert.equal(checkOf(q, "pronunciation").applies, false, "Vietnamese is written in Latin letters");
  assert.equal(checkOf(q, "reviewed").applies, false, "nothing has a blank");
  assert.equal(checkOf(q, "scene").share, 0);
  assert.equal(q.score, Math.round((57.5 * 100) / 90));
  assert.equal(q.fixes[0].key, "words", "the change worth most comes first");
  assert.match(q.fixes[0].text, /1 word needs more sentences/);
  assert.ok(q.fixes.some((f) => f.key === "scene"));
});

test("a deck with nothing to learn from is not scored, and a deck of words alone scores low", () => {
  assert.equal(deckQuality([], { lang: ar, pool: [] }).score, null);
  const names = [{ id: "n", category: "person", forms: [{ ar: "سارة", en: "Sarah" }] }];
  assert.equal(deckQuality(names, { lang: ar, pool: names }).score, null);
  const door = { id: "d", lang: "ar-PS", category: "noun",
    forms: [{ ar: "باب", en: "door", lat: "baab", clips: ["c"], images: ["i"] }] };
  const q = deckQuality([door], { lang: ar, pool: [door] });
  assert.equal(checkOf(q, "words").applies, true);
  assert.equal(checkOf(q, "sentences").applies, true, "no sentences is not spared, it is nothing earned");
  /* Recordings, pictures, pronunciation, no repeats: 20 of 90 — review
     and length have nothing to measure. */
  assert.equal(q.score, Math.round((20 * 100) / 90));
  assert.ok(q.fixes.some((f) => f.key === "sentences"));
});

/* ---- what counts as a word being in a sentence ---- */

test("a confirmed link counts, for the form the sentence holds; an unconfirmed one does not", () => {
  const book = { id: "book", lang: "ar-PS", category: "noun",
    forms: [{ id: "book", ar: "كتاب", en: "book" }, { id: "books", ar: "كتب", en: "books" }] };
  const one = { id: "s1", lang: "ar-PS", uses: ["book"], forms: [{ ar: "عندي كتاب", en: "I have a book" }] };
  const two = { id: "s2", lang: "ar-PS", uses: ["book"], forms: [{ ar: "الكتب هون", en: "the books are here" }] };
  const three = { id: "s3", lang: "ar-PS", forms: [{ ar: "وين الكتاب", en: "where is the book" }] };
  const pool = [book, one, two, three];
  const q = deckQuality(pool, { lang: ar, pool, pending: true });
  assert.deepEqual(rowOf(q, "book").forms, [{ ar: "كتاب", need: 2, met: 1 }, { ar: "كتب", need: 1, met: 1 }],
    "the plural is met in the sentence that has the plural; the unconfirmed sentence counts for nothing");
  assert.equal(rowOf(q, "book").share, 0.75);
  const confirm = q.fixes.find((f) => f.key === "confirm");
  assert.ok(confirm, "the link nobody has confirmed is offered");
  assert.match(confirm.text, /1 link between a word and a sentence in this deck is waiting/);
  /* Confirming it takes the card from 0.75 to 1: a quarter of 55, scaled
     to the 95 points the checks besides the conversation share. */
  const total = q.checks.filter((c) => c.applies && c.key !== "scene").reduce((t, c) => t + c.weight, 0);
  assert.ok(Math.abs(confirm.gain - (55 * 0.25 * 95) / total) < 1e-9);

  const elsewhere = deckQuality([book], { lang: ar, pool });
  assert.equal(rowOf(elsewhere, "book").share, 0, "a sentence in another deck does not count");
});

/* A verb behind a blank, agreeing with the pronoun beside it. */
const pronoun = (/** @type {string} */ person, /** @type {string} */ word, /** @type {string} */ en, /** @type {Record<string, string>} */ picks = {}, created = 1) => ({
  id: `p-${person}`, lang: "ar-PS", category: "pronoun", person, created,
  forms: [{ id: `p-${person}`, ar: word, en, lat: en, ...picks }],
});
const speak = {
  id: "speak", lang: "ar-PS", category: "verb", created: 6,
  forms: [
    { id: "speak", ar: "حكى", en: "to speak", lat: "haka" },
    { id: "v-pres-i", row: "present", col: "i", ar: "بحكي", en: "speak", lat: "bahki" },
    { id: "v-pres-he", row: "present", col: "he", ar: "بيحكي", en: "speaks", lat: "biyihki" },
    { id: "v-pres-she", row: "present", col: "she", ar: "بتحكي", en: "speaks", lat: "btihki" },
    { id: "v-pres-they", row: "present", col: "they", ar: "بيحكوا", en: "speak", lat: "biyihku" },
    { id: "v-past-i", row: "past", col: "i", ar: "حكيت", en: "spoke", lat: "hakeet" },
    { id: "v-past-he", row: "past", col: "he", ar: "حكى", en: "spoke", lat: "haka" },
    { id: "v-past-she", row: "past", col: "she", ar: "حكت", en: "spoke", lat: "hakat" },
  ],
};
const pronouns = [
  pronoun("i", "أنا", "I", {}, 1),
  pronoun("he", "هو", "he", { number: "singular", gender: "masculine" }, 2),
  pronoun("she", "هي", "she", { number: "singular", gender: "feminine" }, 3),
  pronoun("they", "هم", "they", { number: "plural" }, 4),
];
const speaking = (/** @type {any} */ tenses, /** @type {any} */ review) => ({
  id: "s", lang: "ar-PS", sentence: true, created: 9, ...(review ? { review } : {}),
  forms: [{ id: "s", ar: "{{pronoun}} {{verb}} عربي", en: "{{pronoun}} {{verb}} Arabic", lat: "{{pronoun}} {{verb}} arabi",
    ...(tenses ? { tenses: { verb: tenses } } : {}) }],
});

test("one sentence with a blank that takes every form covers all of them", () => {
  const frame = speaking(null, null);
  const pool = [...pronouns, speak, frame];
  const q = deckQuality([speak, frame], { lang: ar, pool });
  /* Every person of both tenses stands in it once; the he-past is the
     verb's own word, which wants two. Half of a half, plus every other
     form: 0.25 + 0.5. */
  const row = rowOf(q, "speak");
  assert.equal(row.forms.length, 7, "the he-past and the card's own word are one");
  assert.ok(row.forms.every((/** @type {any} */ f) => f.met === 1), JSON.stringify(row.forms));
  assert.equal(row.share, 0.75);
});

test("a blank that takes only some forms covers exactly those", () => {
  const frame = speaking(["present"], null);
  const pool = [...pronouns, speak, frame];
  const row = rowOf(deckQuality([speak, frame], { lang: ar, pool }), "speak");
  const met = Object.fromEntries(row.forms.map((/** @type {any} */ f) => [f.ar, f.met]));
  assert.deepEqual(met, { "حكى": 0, "بحكي": 1, "بيحكي": 1, "بتحكي": 1, "بيحكوا": 1, "حكيت": 0, "حكت": 0 });
  /* Four of the six other forms: 0.5 × 4/6. */
  assert.ok(Math.abs(row.share - 1 / 3) < 1e-9);
});

test("a blank counts only in the sentences review lets through", () => {
  const frame = speaking(["present"], { ok: [] });
  const pool = [...pronouns, speak, frame];
  const q = deckQuality([speak, frame], { lang: ar, pool });
  assert.equal(rowOf(q, "speak").share, 0, "reviewed, and nothing approved: nothing is asked");
  assert.equal(checkOf(q, "reviewed").share, 0, "and the card is waiting for review");
});

test("a verb's own examples are sentences for the forms they show", () => {
  const want = {
    id: "eat", lang: "ar-PS", category: "verb",
    forms: [
      { id: "eat", ar: "أكل", en: "to eat" },
      { id: "sub-i", row: "subjunctive", col: "i", ar: "آكل", en: "eat" },
      { id: "sub-she", row: "subjunctive", col: "she", ar: "تاكل", en: "eat" },
    ],
    examples: [{ ar: "لازم {{verb}}", en: "{{verb-who}} must {{verb-plain}}" }],
  };
  const row = rowOf(deckQuality([want], { lang: ar, pool: [want] }), "eat");
  const met = Object.fromEntries(row.forms.map((/** @type {any} */ f) => [f.ar, f.met]));
  assert.deepEqual(met, { "أكل": 0, "آكل": 1, "تاكل": 1 });
});

/* ---- sentences well made ---- */

test("a sentence loses its points for a word no deck of the course teaches, or for teaching no word", () => {
  const door = { id: "door", lang: "ar-PS", category: "noun", forms: [{ ar: "باب", en: "door" }] };
  const shut = { id: "shut", lang: "ar-PS", category: "verb", forms: [{ ar: "سكّر", en: "close" }] };
  const good = { id: "g", lang: "ar-PS", uses: ["door"], forms: [{ ar: "سكّر الباب", en: "close the door" }] };
  const odd = { id: "o", lang: "ar-PS", uses: ["door"], forms: [{ ar: "افتح الباب", en: "open the door" }] };
  const bare = { id: "b", lang: "ar-PS", forms: [{ ar: "سكّر الباب", en: "close the door" }] };
  const known = [door, shut];
  const q = deckQuality([door, good, odd, bare], { lang: ar, pool: known, known });
  near(checkOf(q, "sentences").share, 1 / 3, "only the first is linked and knows all its words");
  const unknown = q.fixes.find((f) => f.key === "unknown");
  assert.ok(unknown);
  assert.match(unknown.text, /1 sentence uses a word no deck in the course teaches \(افتح\)/);
  assert.ok(q.fixes.some((f) => f.key === "unlinked"));
});

test("small words that hold a sentence together are never unknown", () => {
  const find = unknownFinder([{ id: "b", category: "noun", forms: [{ ar: "بيت", en: "house" }] }], ar);
  assert.deepEqual(find("في البيت"), [], "في is a preposition, البيت is the house");
  assert.deepEqual(find("{{name}} في البيت"), [], "and a blank is filled with something");
  assert.deepEqual(find("في البيت الكبير"), ["الكبير"]);
});

/* ---- the smaller checks ---- */

test("the smaller checks each count their own share", () => {
  const word = (/** @type {string} */ id, /** @type {string} */ w, /** @type {string} */ en, extra = {}) =>
    ({ id, lang: "ar-PS", category: "noun", forms: [{ ar: w, en, ...extra }] });
  const a = word("a", "باب", "door", { lat: "baab", clips: ["c"] });
  const b = word("b", "باب", "door");
  const c = word("c", "بيت", "house", { images: ["i"] });
  const long = { id: "l", lang: "ar-PS", uses: ["a"], forms: [{ ar: Array(14).fill("باب").join(" "), en: "doors" }] };
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"], lines: [{ ar: "باب", en: "door", who: 0 }, { ar: "بيت", en: "house", who: 1 }] };
  const deck = [a, b, c, long, scene];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  near(checkOf(q, "repeats").share, 1 - 1 / 3, "two cards for door: one of three is a repeat");
  near(checkOf(q, "pictures").share, 1 / 3);
  /* Units: three word forms, the long sentence, two lines. One recorded,
     one with its pronunciation. */
  near(checkOf(q, "recordings").share, 1 - 5 / 6);
  near(checkOf(q, "pronunciation").share, 1 - 5 / 6);
  near(checkOf(q, "long").share, 2 / 3, "the fourteen-word sentence is long; the lines are not");
  assert.equal(checkOf(q, "scene").share, 1);
});

test("the colours change at 80 and 50", () => {
  assert.equal(qualityTone(80), "good");
  assert.equal(qualityTone(79), "fair");
  assert.equal(qualityTone(50), "fair");
  assert.equal(qualityTone(49), "poor");
});

/* ---- the lookup the list of decks relies on ---- */

test("looking a word up by its key answers what the matcher answers", () => {
  /** @type {[any, string[], string[]][]} */
  const cases = [
    [ar, ["الكتاب", "وبالكتاب", "كتابها", "كتب", "باب", "البيت", "مكتبة"], ["كتاب", "كتب", "باب", "بيت", "مكتب"]],
    [vi, ["cà phê", "ma", "má", "Má"], ["cà phê", "ma", "má"]],
    [he, ["הספר", "וספר", "ספרים", "בית"], ["ספר", "בית", "ספרים"]],
  ];
  for (const [lang, tokens, words] of cases) {
    const keyed = lang.context.keyed;
    for (const t of tokens) {
      for (const w of words) {
        assert.equal(keyed.token(t).includes(keyed.word(w)), lang.context.matches(t, w), `${lang.id}: ${t} / ${w}`);
      }
    }
  }
});

/* ---- which form a linked sentence holds ---- */

/** @param {string} id @param {string[]} forms @param {string} [category] */
const wordCard = (id, forms, category = "adjective") => ({
  id, lang: "ar-PS", category, forms: forms.map((w, i) => ({ id: i ? `${id}-${i}` : id, ar: w, en: `${id} ${i}` })),
});
/** @param {string} id @param {string | string[]} said @param {string[]} uses */
const sentenceCard = (id, said, uses) => ({
  id, lang: "ar-PS", uses,
  forms: (Array.isArray(said) ? said : [said]).map((w, i) => ({ id: i ? `${id}-${i}` : id, ar: w, en: id })),
});
/** @param {any} q @param {string} id */
const metOf = (q, id) => Object.fromEntries(rowOf(q, id).forms.map((/** @type {any} */ f) => [f.ar, f.met]));

test("a feminine made with ة credits the feminine, not the masculine inside it", () => {
  const understand = wordCard("understand", ["فاهم", "فاهمة"]);
  const sorry = sentenceCard("s1", "آسفة، مش فاهمة.", ["understand"]);
  const deck = [understand, sorry];
  assert.deepEqual(metOf(deckQuality(deck, { lang: ar, pool: deck }), "understand"), { "فاهم": 0, "فاهمة": 1 });

  const plain = sentenceCard("s2", "مش فاهم", ["understand"]);
  const deck2 = [understand, plain];
  assert.deepEqual(metOf(deckQuality(deck2, { lang: ar, pool: deck2 }), "understand"), { "فاهم": 1, "فاهمة": 0 });
});

test("each of a masculine and feminine pair is credited from its own sentence", () => {
  const tired = wordCard("tired", ["تعبان", "تعبانة"]);
  const she = sentenceCard("she", "هي تعبانة", ["tired"]);
  const he = sentenceCard("he", "هو تعبان", ["tired"]);
  const deck = [tired, she, he];
  assert.deepEqual(metOf(deckQuality(deck, { lang: ar, pool: deck }), "tired"), { "تعبان": 1, "تعبانة": 1 });
});

test("a card with only the masculine is still credited from a sentence with the feminine", () => {
  const tired = wordCard("tired", ["تعبان"]);
  const she = sentenceCard("she", "هي تعبانة", ["tired"]);
  const deck = [tired, she];
  assert.deepEqual(metOf(deckQuality(deck, { lang: ar, pool: deck }), "tired"), { "تعبان": 1 });
});

test("a word with a possessive or a prefix glued to it still credits the plain form", () => {
  const book = wordCard("book", ["كتاب", "كتب"], "noun");
  const job = wordCard("job", ["وظيفة", "وظائف"], "noun");
  const want = wordCard("want", ["بدي", "بدك", "بده"], "verb");
  const yours = sentenceCard("s1", "وين كتابك؟", ["book"]);
  const hers = sentenceCard("s2", "أخذت كتابها معها", ["book"]);
  const theJob = sentenceCard("s3", "الوظيفة صعبة", ["job"]);
  const andYou = sentenceCard("s4", "وبدك قهوة؟", ["want"]);
  const deck = [book, job, want, yours, hers, theJob, andYou];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  assert.deepEqual(metOf(q, "book"), { "كتاب": 2, "كتب": 0 });
  assert.deepEqual(metOf(q, "job"), { "وظيفة": 1, "وظائف": 0 });
  assert.deepEqual(metOf(q, "want"), { "بدي": 0, "بدك": 1, "بده": 0 });
});

test("the word a blank took is matched to the form spelt like it, marks aside", () => {
  const forms = [{ ar: "فاهم" }, { ar: "فاهمة" }];
  assert.equal(formIn("فاهمَة", forms, ar), forms[1]);
  assert.equal(formIn("فاهِم", forms, ar), forms[0]);
});

/* ---- a form with several accepted answers ---- */

test("a sentence with two accepted answers is read answer by answer, as one sentence", () => {
  const fine = wordCard("fine", ["تمام"], "adjective");
  const all = { id: "all", lang: "ar-PS", category: "pronoun", forms: [{ ar: "كلشي", en: "everything" }] };
  const it = { id: "it", lang: "ar-PS", category: "pronoun", forms: [{ ar: "كله", en: "all of it" }] };
  const both = sentenceCard("s", ["كلشي تمام", "كله تمام"].join(ALT_SEP), ["fine"]);
  const known = [fine, all, it, both];
  const q = deckQuality([fine, both], { lang: ar, pool: known, known });
  assert.equal(checkOf(q, "sentences").share, 1, "no untaught word, and linked");
  assert.ok(!q.fixes.some((f) => f.key === "unknown" || f.key === "both"), JSON.stringify(q.fixes));
  assert.deepEqual(metOf(q, "fine"), { "تمام": 1 }, "found in both answers, and counted once");
});

test("each answer of a word teaches a word for other sentences", () => {
  const howAreYou = { id: "how", lang: "ar-PS", category: "expression",
    forms: [{ ar: ["كيف حالَك؟", "كيفَك؟"].join(ALT_SEP), en: "how are you" }] };
  const find = unknownFinder([howAreYou], ar);
  assert.deepEqual(find("كيفك"), []);
  assert.deepEqual(find("كيف حالك"), []);
});

test("a word form with several answers is met by a sentence holding any one of them", () => {
  const howAreYou = { id: "how", lang: "ar-PS", category: "expression",
    forms: [{ ar: ["كيف حالَك؟", "كيفَك؟"].join(ALT_SEP), en: "how are you" }] };
  const hi = sentenceCard("s", "مرحبا، كيفك اليوم؟", ["how"]);
  const deck = [howAreYou, hi];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  assert.equal(rowOf(q, "how").forms[0].met, 1);
});

test("a card is too long when any of its answers is", () => {
  const short = "سكّر الباب";
  const long = Array(14).fill("باب").join(" ");
  const door = wordCard("door", ["باب"], "noun");
  const card = sentenceCard("s", [short, long].join(ALT_SEP), ["door"]);
  const q = deckQuality([door, card], { lang: ar, pool: [door, card] });
  assert.equal(checkOf(q, "long").share, 0, "one sentence, and it is too long");
  assert.match(must(q.fixes.find((f) => f.key === "long"), "the long fix").text, /^1 sentence is longer/);
});

/* ---- every version of a sentence card ---- */

test("every version of a sentence card is read, and one card is still one sentence", () => {
  const want = wordCard("want", ["بدي", "بدك", "بده"], "verb");
  const book = wordCard("book", ["كتاب"], "noun");
  const card = sentenceCard("s", ["بدي كتاب", "بدك كتاب؟"], ["want", "book"]);
  const deck = [want, book, card];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  assert.deepEqual(metOf(q, "want"), { "بدي": 1, "بدك": 1, "بده": 0 }, "the second version credits بدك");
  assert.deepEqual(metOf(q, "book"), { "كتاب": 1 }, "كتاب in both versions is in one sentence");
});

test("a card is flawed, unrecorded or unspelt when any of its versions is", () => {
  const want = wordCard("want", ["بدي"], "verb");
  const book = wordCard("book", ["كتاب"], "noun");
  const card = { id: "s", lang: "ar-PS", uses: ["want"], forms: [
    { id: "s", ar: "بدي كتاب", en: "I want a book", lat: "biddi ktaab", clips: ["c"] },
    { id: "s-1", ar: "بدي كتاب جديد", en: "I want a new book" },
  ] };
  const known = [want, book, card];
  const q = deckQuality([want, book, card], { lang: ar, pool: known, known });
  assert.equal(checkOf(q, "sentences").share, 0, "جديد is in the second version, and nothing teaches it");
  assert.match(must(q.fixes.find((f) => f.key === "unknown"), "the unknown fix").text, /\(جديد\)/);
  /* Units: the two word forms and the one sentence. */
  near(checkOf(q, "recordings").share, 0, "the words have none, and the sentence's second version none");
  const recorded = { ...card, forms: card.forms.map((f) => ({ ...f, clips: ["c"], lat: "x" })) };
  const q2 = deckQuality([want, book, recorded], { lang: ar, pool: known, known });
  near(checkOf(q2, "recordings").share, 1 / 3);
  near(checkOf(q2, "pronunciation").share, 1 / 3);
});

/* ---- each fix worth what it alone would add ---- */

test("sentences with two flaws are a fix of their own, and neither single fix claims them", () => {
  const vw = (/** @type {string} */ id, /** @type {string} */ w, extra = {}) =>
    ({ id, lang: "vi-Hue", category: "noun", forms: [{ id, ar: w, en: id, clips: ["c"], images: ["i"], ...extra }] });
  const coffee = vw("w1", "cà phê");
  const vs = (/** @type {string} */ id, /** @type {string} */ w, /** @type {string[]} */ uses) =>
    ({ id, lang: "vi-Hue", uses, forms: [{ id, ar: w, en: id, clips: ["c"] }] });
  const good = [vs("s1", "tôi uống cà phê", ["w1"]), vs("s2", "tôi thích cà phê", ["w1"])];
  const bad = [vs("b1", "tôi ăn phở", []), vs("b2", "tôi ăn cơm", [])];
  const scene = { id: "sc", lang: "vi-Hue", speakers: ["A", "B"],
    lines: [{ ar: "tôi uống cà phê", en: "I drink coffee", who: 0, uses: ["w1"], clips: ["c"] }] };
  const taught = [vw("k1", "tôi"), vw("k2", "uống"), vw("k3", "thích")];
  const deck = [coffee, ...good, ...bad, scene];
  const score = (/** @type {any[]} */ cards, /** @type {any[]} */ more = []) => {
    const known = [...cards, ...taught, ...more];
    return deckQuality(cards, { lang: vi, pool: known, known });
  };
  const q = score(deck);
  assert.ok(!q.fixes.some((f) => f.key === "unlinked"), "linking alone mends nothing");
  assert.ok(!q.fixes.some((f) => f.key === "unknown"), "teaching the words alone mends nothing");
  const both = must(q.fixes.find((f) => f.key === "both"), "the fix for both");
  assert.match(both.text, /^2 sentences need both a link to a word card and their words taught \(ăn, phở, cơm\)/);

  const linked = deck.map((c) => (c.id === "b1" || c.id === "b2" ? { ...c, uses: ["w1"] } : c));
  assert.equal(score(linked).score, q.score, "linking them alone leaves the score where it was");
  const words = ["ăn", "phở", "cơm"].map((w, i) => vw(`t${i}`, w));
  assert.equal(score(deck, words).score, q.score, "and so does teaching their words alone");
  const mended = score(linked, words);
  assert.equal(mended.score, 100);
  /* The raw gain: 2 of 5 sentences' share of the 10, scaled to 95 of 85. */
  near(both.gain, (10 * 2 / 5) * 95 / 85);
});

/* ---- a line picked from a sentence of the deck ---- */

test("a line picked from a sentence card of the deck is not a second sentence", () => {
  const book = wordCard("book", ["كتاب"], "noun");
  const have = sentenceCard("have", "عندي كتاب", ["book"]);
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"],
    lines: [{ ar: "عندي كتاب", en: "have", who: 0, from: "have", uses: ["book"] }, { ar: "تمام", en: "fine", who: 1 }] };
  const deck = [book, have, scene];
  const q = deckQuality(deck, { lang: ar, pool: deck });
  assert.deepEqual(metOf(q, "book"), { "كتاب": 1 }, "still 1 of the 2 it wants");
  assert.equal(checkOf(q, "scene").share, 1, "and the conversation still counts as one");

  const alone = deckQuality([book, scene], { lang: ar, pool: deck });
  assert.deepEqual(metOf(alone, "book"), { "كتاب": 1 }, "without the card in the deck, the line is the sentence");
});

/* ---- a conversation switched off ----
   A safeguard: the editor cannot switch a conversation off, so only a
   hand-made import or a card from before 0.179 could arrive like this.
   See docs/AUDIT-what-teachers-can-make.md. */

test("a conversation switched off is no sentences and no conversation", () => {
  const book = wordCard("book", ["كتاب"], "noun");
  const have = sentenceCard("have", "عندي كتاب", ["book"]);
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"],
    lines: [{ ar: "وين الكتاب؟", en: "where is the book", who: 0, uses: ["book"] }] };
  const on = deckQuality([book, have, scene], { lang: ar, pool: [book, have, scene] });
  const off = deckQuality([book, have, { ...scene, drill: false }], { lang: ar, pool: [book, have, scene] });
  assert.deepEqual(metOf(on, "book"), { "كتاب": 2 });
  assert.deepEqual(metOf(off, "book"), { "كتاب": 1 });
  assert.equal(checkOf(on, "scene").share, 1);
  assert.equal(checkOf(off, "scene").share, 0);
  assert.ok(must(off.score, "a score") < must(on.score, "a score"));
});

/* ---- a line with no words ---- */

test("a line or card with no letters in it is not a sentence", () => {
  const book = wordCard("book", ["كتاب"], "noun");
  const lines = [{ ar: "عندي كتاب", en: "I have a book", who: 0, uses: ["book"] }];
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"], lines };
  const dotted = { ...scene, lines: [...lines, { ar: ".", en: ".", who: 1 }] };
  const dot = sentenceCard("dot", "…", []);
  const plain = deckQuality([book, scene], { lang: ar, pool: [book, scene] });
  const withDot = deckQuality([book, dotted, dot], { lang: ar, pool: [book, dotted, dot] });
  assert.equal(withDot.score, plain.score);
  assert.deepEqual(withDot.checks, plain.checks);
  assert.deepEqual(withDot.fixes, plain.fixes);
});

/* ---- the conversation's own 5 points ---- */

test("where every check applies, the score is the points earned, as it always was", () => {
  const frame = speaking(null, null);
  const book = { id: "book", lang: "ar-PS", category: "noun",
    forms: [{ id: "book", ar: "كتاب", en: "book", lat: "ktaab", clips: ["c"], images: ["i"] }] };
  const have = { id: "have", lang: "ar-PS", uses: ["book"],
    forms: [{ id: "have", ar: "عندي كتاب", en: "I have a book", lat: "3indi ktaab" }] };
  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"],
    lines: [{ ar: "وين الكتاب؟", en: "where", who: 0, uses: ["book"], clips: ["c"], lat: "ween" }] };
  const deck = [speak, book, frame, have, scene];
  const pool = [...pronouns, ...deck];
  const q = deckQuality(deck, { lang: ar, pool });
  assert.ok(q.checks.every((/** @type {any} */ c) => c.applies), JSON.stringify(q.checks));
  const earned = q.checks.reduce((/** @type {number} */ t, /** @type {any} */ c) => t + c.weight * c.share, 0);
  assert.equal(q.score, Math.round(earned));
});

test("a conversation is worth 5 points whatever else applies", () => {
  const here = { id: "here", lang: "ar-PS", category: "adverb", forms: [{ ar: "هون", en: "here" }] };
  /* One sentence with a blank, reviewed and approved, linked through its
     blank, and every word in it taught. */
  const frame = { id: "f", lang: "ar-PS", sentence: true, review: { ok: ["k"] },
    forms: [{ id: "f", ar: "{{name}} هون", en: "{{name}} is here" }] };
  const partsOf = () => [{ id: "f", combos: 1, cut: false, list: [{ key: "k", ar: "سارة هون", en: "Sarah is here", lat: "", took: {} }] }];
  const known = [here, frame];
  const q = deckQuality([frame], { lang: ar, pool: known, known, partsOf });
  /* Sentences, review and length apply, and share the 95: all earned. */
  assert.equal(q.score, 95, "it was 80, the conversation's points being a fifth of what applied");
  assert.equal(must(q.fixes.find((f) => f.key === "scene"), "the conversation fix").gain, 5);

  const scene = { id: "sc", lang: "ar-PS", speakers: ["A", "B"],
    lines: [{ ar: "هون", en: "here", who: 0, uses: ["here"], clips: ["c"], lat: "hoon" }] };
  const withScene = deckQuality([frame, scene], { lang: ar, pool: [...known, scene], known, partsOf });
  assert.equal(withScene.score, 100);
});

/* ---- a form with two answers, recorded and spelt answer by answer ---- */

test("a form with two answers is recorded and spelt only when each answer is", () => {
  /** @param {any[]} answers @returns {any} */
  const fineWith = (answers) => ({ id: "fine", lang: "ar-PS", category: "adjective", forms: [{
    id: "fine", en: "fine", images: ["i"],
    ar: answers.map((a) => a.text).join(ALT_SEP),
    lat: answers.map((a) => a.lat).join(ALT_SEP),
    clips: [...new Set(answers.flatMap((a) => a.clips || []))],
    answers,
  }] });
  const half = fineWith([{ text: "تمام", lat: "tamaam", clips: ["c1"] }, { text: "منيح", lat: "" }]);
  const q = deckQuality([half], { lang: ar, pool: [half] });
  assert.equal(checkOf(q, "recordings").share, 0, "the second answer has no voice");
  assert.equal(checkOf(q, "pronunciation").share, 0, "and no pronunciation");

  const whole = fineWith([{ text: "تمام", lat: "tamaam", clips: ["c1"] }, { text: "منيح", lat: "mniih", clips: ["c2"] }]);
  const q2 = deckQuality([whole], { lang: ar, pool: [whole] });
  assert.equal(checkOf(q2, "recordings").share, 1);
  assert.equal(checkOf(q2, "pronunciation").share, 1);

  /* A card from before answers had recordings of their own shares the
     form's among them, and reads as it always did. */
  const old = { id: "old", lang: "ar-PS", category: "adjective", forms: [{
    id: "old", en: "fine", ar: ["تمام", "منيح"].join(ALT_SEP), lat: ["tamaam", "mniih"].join(ALT_SEP), clips: ["c1"] }] };
  assert.equal(checkOf(deckQuality([old], { lang: ar, pool: [old] }), "recordings").share, 1);
});
