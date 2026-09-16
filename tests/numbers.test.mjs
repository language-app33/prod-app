/*
 * Numbers built out of parts.
 *
 * The point of the feature is that a learner who knows *forty* and *seven*
 * can be asked *forty-seven*, so the thing worth testing is the spelling
 * itself: every case below is a number a speaker would recognise, written
 * out in full, against parts written the way a teacher would write them.
 *
 * Three languages, because the whole claim is that the app knows none of
 * this. Arabic puts the unit first and a و before every chunk; Hebrew puts
 * the ten first and one ו in the whole number; Huế is regular and changes
 * its words in company. If any of those rules leaked out of a pack and
 * into src/numbers.ts, two of these three sets would start failing.
 *
 * The second thing tested is the giving up. A deck that stops at ten must
 * not be asked for a hundred, and the band that will not open is how the
 * app knows — so the reach is checked against decks with holes in them,
 * not only against complete ones.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { LANGUAGES, NUMBER_EQUIVALENT, TYPES, checkAnswer, exOf } from "../src/languages.ts";
import { must } from "./helpers.mjs";
import {
  NUMBER_CEILING,
  bandsOf,
  cellsFor,
  confusablesOf,
  freshRamp,
  openBands,
  partCards,
  partsOf,
  pickNumber,
  probeOf,
  reachOf,
  spell,
  stepRamp,
  teachesNumbers,
} from "../src/numbers.ts";

/* ---- decks, written the way a teacher would write them ---- */

/**
 * A deck of number cards from a plain map of value to word, plus any
 * cells. `cells` is keyed value → column → word, which is the shape the
 * Numbers screen saves.
 */
/**
 * @param {string} langId
 * @param {Record<string|number, string>} words
 * @param {Record<string|number, Record<string, string>>} [cells]
 * @returns {Map<number, any>}
 */
function deckOf(langId, words, cells = {}) {
  /** @type {any[]} */
  const cards = [];
  for (const [value, ar] of Object.entries(words)) {
    const v = Number(value);
    /** @type {any[]} */
    const forms = [{ ar, en: String(v), lat: "" }];
    for (const [col, text] of Object.entries(cells[v] || {})) {
      forms.push({ ar: text, en: String(v), lat: "", row: "counted", col });
    }
    cards.push({ id: `n${v}`, lang: langId, value: v, category: "number", forms });
  }
  return partCards(cards, langId);
}

/**
 * @param {number} from @param {number} to @param {number} step
 * @param {string[]} words
 * @returns {Record<number, string>}
 */
const run = (from, to, step, words) => {
  /** @type {Record<number, string>} */
  const out = {};
  let i = 0;
  for (let v = from; v <= to; v += step) {
    out[v] = words[i];
    i += 1;
  }
  return out;
};

/* Palestinian Arabic, unpointed as a teacher would type it. */
const AR_WORDS = {
  ...run(0, 10, 1, ["صفر", "واحد", "اتنين", "تلاتة", "أربعة", "خمسة", "ستة", "سبعة", "تمانية", "تسعة", "عشرة"]),
  ...run(11, 19, 1, ["حداعش", "اتناعش", "تلاتطاعش", "أربعطاعش", "خمسطاعش", "ستطاعش", "سبعطاعش", "تمنطاعش", "تسعطاعش"]),
  ...run(20, 90, 10, ["عشرين", "تلاتين", "أربعين", "خمسين", "ستين", "سبعين", "تمانين", "تسعين"]),
  ...run(100, 900, 100, ["مية", "ميتين", "تلتمية", "أربعمية", "خمسمية", "ستمية", "سبعمية", "تمنمية", "تسعمية"]),
  ...run(1000, 9000, 1000, ["ألف", "ألفين", "تلات آلاف", "أربع آلاف", "خمس آلاف", "ست آلاف", "سبع آلاف", "تمن آلاف", "تسع آلاف"]),
  ...run(1000000, 9000000, 1000000, ["مليون", "مليونين", "تلات ملايين", "أربع ملايين", "خمس ملايين", "ست ملايين", "سبع ملايين", "تمن ملايين", "تسع ملايين"]),
};

/* Modern Hebrew. The card's own word is the masculine one that stands
   beside a noun; the feminine cell is what counting aloud uses. */
const HE_WORDS = {
  ...run(0, 10, 1, ["אפס", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה", "עשרה"]),
  ...run(11, 19, 1, ["אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר", "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"]),
  ...run(20, 90, 10, ["עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"]),
  ...run(100, 900, 100, ["מאה", "מאתיים", "שלוש מאות", "ארבע מאות", "חמש מאות", "שש מאות", "שבע מאות", "שמונה מאות", "תשע מאות"]),
  ...run(1000, 9000, 1000, ["אלף", "אלפיים", "שלושת אלפים", "ארבעת אלפים", "חמשת אלפים", "ששת אלפים", "שבעת אלפים", "שמונת אלפים", "תשעת אלפים"]),
  ...run(1000000, 9000000, 1000000, ["מיליון", "שני מיליון", "שלושה מיליון", "ארבעה מיליון", "חמישה מיליון", "שישה מיליון", "שבעה מיליון", "שמונה מיליון", "תשעה מיליון"]),
};

/** @type {Record<string, Record<string, string>>} */
const HE_FEMININE = {};
{
  const fem = run(1, 10, 1, ["אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר"]);
  const teens = run(11, 19, 1, [
    "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה",
    "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה",
  ]);
  for (const [v, w] of Object.entries({ ...fem, ...teens })) HE_FEMININE[v] = { feminine: w };
}

/* Huế Vietnamese: eleven words and three bare multipliers. */
const VI_WORDS = {
  ...run(0, 10, 1, ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"]),
  100: "trăm",
  1000: "nghìn",
  1000000: "triệu",
};

const VI_CELLS = {
  0: { "empty-place": "lẻ" },
  1: { "after-ten": "mốt" },
  4: { "after-ten": "tư" },
  5: { "after-ten": "lăm" },
  10: { "after-ten": "mươi" },
};

const AR = LANGUAGES["ar-PS"];
const HE = LANGUAGES["he-IL"];
const VI = LANGUAGES["vi-Hue"];

const arDeck = deckOf("ar-PS", AR_WORDS);
const heDeck = deckOf("he-IL", HE_WORDS, HE_FEMININE);
const viDeck = deckOf("vi-Hue", VI_WORDS, VI_CELLS);

/**
 * @param {any} lang @param {Map<number, any>} deck @param {number} value
 * @returns {string | null}
 */
const say = (lang, deck, value) => {
  const out = spell(lang, deck, value);
  return out ? out.text : null;
};

/** Every pack, with a deck complete enough to reach millions. */
const EVERY = [
  { name: "Arabic", lang: AR, deck: arDeck },
  { name: "Hebrew", lang: HE, deck: heDeck },
  { name: "Vietnamese", lang: VI, deck: viDeck },
];

/* ---- the spellings ---- */

test("Palestinian Arabic says the unit before the ten, joined by و", () => {
  const cases = {
    0: "صفر",
    7: "سبعة",
    10: "عشرة",
    15: "خمسطاعش",
    20: "عشرين",
    21: "واحد وعشرين",
    47: "سبعة وأربعين",
    99: "تسعة وتسعين",
    100: "مية",
    105: "مية وخمسة",
    115: "مية وخمسطاعش",
    250: "ميتين وخمسين",
    525: "خمسمية وخمسة وعشرين",
    999: "تسعمية وتسعة وتسعين",
    1000: "ألف",
    1525: "ألف وخمسمية وخمسة وعشرين",
    3000: "تلات آلاف",
    11000: "حداعش ألف",
    45000: "خمسة وأربعين ألف",
    100000: "مية ألف",
    1000000: "مليون",
    1500000: "مليون وخمسمية ألف",
    3000000: "تلات ملايين",
  };
  for (const [value, want] of Object.entries(cases)) {
    assert.equal(say(AR, arDeck, Number(value)), want, `Arabic ${value}`);
  }
});

test("Modern Hebrew says the ten before the unit, with one ו in the number", () => {
  const cases = {
    0: "אפס",
    5: "חמש",
    10: "עשר",
    15: "חמש עשרה",
    20: "עשרים",
    25: "עשרים וחמש",
    47: "ארבעים ושבע",
    100: "מאה",
    105: "מאה וחמש",
    120: "מאה ועשרים",
    125: "מאה עשרים וחמש",
    525: "חמש מאות עשרים וחמש",
    1000: "אלף",
    1525: "אלף חמש מאות עשרים וחמש",
    3000: "שלושת אלפים",
    /* The count in front of אלף is masculine — it is no longer counting
       in the abstract — so this is the one place the card's own word is
       used instead of its feminine. */
    11000: "אחד עשר אלף",
    21000: "עשרים ואחד אלף",
    21525: "עשרים ואחד אלף חמש מאות עשרים וחמש",
    1000000: "מיליון",
  };
  for (const [value, want] of Object.entries(cases)) {
    assert.equal(say(HE, heDeck, Number(value)), want, `Hebrew ${value}`);
  }
});

test("Hebrew counts in the feminine, and keeps the masculine on the card", () => {
  /* The card's own word is the one that stands beside a noun; what the
     practice asks for is the one you count with. */
  assert.equal(say(HE, heDeck, 3), "שלוש");
  assert.equal((heDeck.get(3) || { forms: [] }).forms[0].ar, "שלושה");
  /* With no feminine written, counting falls back to the card's word
     rather than refusing to build the number. */
  const bare = deckOf("he-IL", HE_WORDS);
  assert.equal(say(HE, bare, 3), "שלושה");
});

test("Huế Vietnamese changes its words in company", () => {
  const cases = {
    0: "không",
    5: "năm",
    10: "mười",
    11: "mười một",
    14: "mười bốn",
    15: "mười lăm",
    20: "hai mươi",
    21: "hai mươi mốt",
    24: "hai mươi tư",
    25: "hai mươi lăm",
    47: "bốn mươi bảy",
    99: "chín mươi chín",
    100: "một trăm",
    105: "một trăm lẻ năm",
    115: "một trăm mười lăm",
    121: "một trăm hai mươi mốt",
    500: "năm trăm",
    525: "năm trăm hai mươi lăm",
    1000: "một nghìn",
    1005: "một nghìn không trăm lẻ năm",
    1050: "một nghìn không trăm năm mươi",
    1525: "một nghìn năm trăm hai mươi lăm",
    100000: "một trăm nghìn",
    1000000: "một triệu",
    1000005: "một triệu không trăm lẻ năm",
  };
  for (const [value, want] of Object.entries(cases)) {
    assert.equal(say(VI, viDeck, Number(value)), want, `Vietnamese ${value}`);
  }
});

test("a card written for the whole number beats building one", () => {
  /* The teacher's override, and the answer to anything a pack gets wrong:
     write the number down and it is used as written. */
  const withOwn = deckOf("ar-PS", { ...AR_WORDS, 47: "سبعة وأربعين بالضبط" });
  assert.equal(say(AR, withOwn, 47), "سبعة وأربعين بالضبط");
  const out = spell(AR, withOwn, 47);
  assert.deepEqual((out || { used: [] }).used, [47]);
});

test("a number says which parts stood in it, so they can be credited", () => {
  const out = spell(AR, arDeck, 1525);
  assert.deepEqual((out || { used: [] }).used, [1000, 500, 5, 20]);
  const vi = spell(VI, viDeck, 25);
  /* Two and ten build twenty, and five is the word that changed. */
  assert.deepEqual((vi || { used: [] }).used.sort((a, b) => a - b), [2, 5, 10]);
});

/* ---- giving up ---- */

test("a deck that stops at ten is never asked for a hundred", () => {
  const small = deckOf("ar-PS", run(0, 10, 1, [
    "صفر", "واحد", "اتنين", "تلاتة", "أربعة", "خمسة", "ستة", "سبعة", "تمانية", "تسعة", "عشرة",
  ]));
  assert.equal(say(AR, small, 7), "سبعة");
  assert.equal(say(AR, small, 47), null);
  assert.equal(say(AR, small, 100), null);
  const open = openBands(AR, small);
  assert.deepEqual(open.map((b) => b.id), ["units"]);
  assert.equal(reachOf(AR, small), 10);
});

test("the reach stops at the first hole rather than skipping it", () => {
  /* Every part but one ten. The tens band cannot be built, so nothing
     above it is offered either, however complete the hundreds are. */
  const holed = new Map(arDeck);
  holed.delete(70);
  const open = openBands(AR, holed);
  assert.deepEqual(open.map((b) => b.id), ["units", "teens"]);
  assert.equal(say(AR, holed, 71), null);
  assert.equal(say(AR, holed, 61), "واحد وستين");
});

test("a complete deck reaches millions in every language", () => {
  for (const { name, lang, deck } of EVERY) {
    assert.equal(reachOf(lang, deck), NUMBER_CEILING, `${name} reach`);
    assert.equal(openBands(lang, deck).length, bandsOf(lang).length, `${name} bands`);
  }
});

test("every number in every open band can actually be built", () => {
  /* The promise the reach makes. A band is offered only if the whole of it
     works, so a sweep of it must not turn up a hole — this is what would
     catch a probe that looked in all the easy places. */
  for (const { name, lang, deck } of EVERY) {
    for (let v = 0; v <= 2000; v += 1) {
      assert.ok(say(lang, deck, v), `${name} could not build ${v}`);
    }
    for (const v of [4004, 10010, 12345, 90909, 100100, 999999, 1000001, 7654321, 9999999]) {
      assert.ok(say(lang, deck, v), `${name} could not build ${v}`);
    }
  }
});

test("nothing outside the range is spelled", () => {
  assert.equal(spell(AR, arDeck, -1), null);
  assert.equal(spell(AR, arDeck, 1.5), null);
  assert.equal(spell(AR, arDeck, NUMBER_CEILING + 1), null);
  assert.ok(spell(AR, arDeck, NUMBER_CEILING));
});

/* ---- what the teacher is asked for, and what the app knows ---- */

test("each pack asks for its own parts, and Huế asks for far fewer", () => {
  assert.ok(teachesNumbers(AR) && teachesNumbers(HE) && teachesNumbers(VI));
  assert.equal(partsOf(AR).length, 55);
  assert.equal(partsOf(HE).length, 55);
  assert.equal(partsOf(VI).length, 14);
  /* The multiplier boxes hold the bare word, so they are glossed as one
     rather than as the number they multiply by. */
  const hundred = partsOf(VI).find((p) => p.value === 100);
  assert.equal((hundred || {}).gloss, "hundred");
  assert.equal((partsOf(AR).find((p) => p.value === 100) || {}).gloss, undefined);
});

test("cells are asked for only where a language has them", () => {
  assert.deepEqual(cellsFor(VI, 5).map((c) => c.id), ["after-ten"]);
  assert.deepEqual(cellsFor(VI, 0).map((c) => c.id), ["empty-place"]);
  assert.deepEqual(cellsFor(VI, 3), []);
  assert.deepEqual(cellsFor(HE, 3).map((c) => c.id), ["feminine"]);
  assert.deepEqual(cellsFor(HE, 100), []);
  /* Every cell a pack asks for names a column its own table declares, or
     the teacher would be filling in a box nothing reads. */
  for (const lang of [AR, HE, VI]) {
    const table = (lang.tables || {}).counted;
    assert.ok(table, `${lang.id} has no counted table`);
    const cols = new Set((table.persons || []).map((p) => p.id));
    const rows = new Set((table.tenses || []).map((t) => t.id));
    for (const part of partsOf(lang)) {
      for (const cell of cellsFor(lang, part.value)) {
        assert.ok(cols.has(cell.id), `${lang.id} has no column ${cell.id}`);
        assert.ok(rows.has(cell.row), `${lang.id} has no row ${cell.row}`);
      }
    }
  }
});

test("a band's probe stays inside it and looks at the awkward shapes", () => {
  for (const band of bandsOf(AR)) {
    const probe = probeOf(band);
    assert.ok(probe.length > 0);
    for (const v of probe) assert.ok(v >= band.from && v <= band.to, `${v} outside ${band.id}`);
    assert.equal(new Set(probe).size, probe.length, `${band.id} probes twice`);
  }
  /* The thousands band has to try a number with a nothing in the middle,
     which is the shape that needs a joining word in Huế. */
  const thousands = bandsOf(AR).find((b) => b.id === "thousands");
  assert.ok(thousands);
  assert.ok(probeOf(thousands).some((v) => v % 1000 !== 0 && v % 1000 < 100));
});

/* ---- the ramp ---- */

test("the practice widens after three right and narrows on a miss", () => {
  let ramp = freshRamp();
  assert.equal(ramp.width, 1);
  ramp = stepRamp(ramp, true, 8);
  ramp = stepRamp(ramp, true, 8);
  assert.equal(ramp.width, 1, "two right is not enough");
  ramp = stepRamp(ramp, true, 8);
  assert.equal(ramp.width, 2);
  ramp = stepRamp(ramp, false, 8);
  assert.equal(ramp.width, 1);
  assert.equal(ramp.run, 0, "a miss puts the run back to nothing");
});

test("the ramp never reaches past what the deck can build", () => {
  let ramp = { width: 1, run: 0 };
  for (let i = 0; i < 40; i += 1) ramp = stepRamp(ramp, true, 2);
  assert.equal(ramp.width, 2);
  /* And a deck that shrank under a ramp already wound up is pulled back
     rather than left pointing at a band that no longer opens. */
  assert.equal(stepRamp({ width: 6, run: 0 }, true, 2).width, 2);
});

test("a number never goes below one band", () => {
  assert.equal(stepRamp({ width: 1, run: 0 }, false, 8).width, 1);
});

/* ---- choosing what to ask ---- */

test("what is asked comes out of the bands in play and nothing above", () => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const bands = bandsOf(AR);
  for (let i = 0; i < 200; i += 1) {
    const got = pickNumber(AR, arDeck, bands, 2, rnd, new Set());
    assert.ok(got, "found nothing to ask");
    assert.ok(got.value <= bands[1].to, `${got.value} is above the bands in play`);
    assert.ok(got.spelled.text);
  }
});

test("a deck with nothing in it is asked nothing", () => {
  const empty = partCards([], "ar-PS");
  assert.equal(pickNumber(AR, empty, bandsOf(AR), 1, Math.random, new Set()), null);
  assert.equal(reachOf(AR, empty), -1);
});

test("wrong answers are numbers worth confusing with the right one", () => {
  const near = confusablesOf(47);
  assert.ok(near.includes(74), "the digits the other way round");
  assert.ok(near.includes(470), "a place out");
  assert.ok(near.includes(57), "a ten out");
  assert.ok(!near.includes(47), "never the answer itself");
  for (const v of confusablesOf(0)) assert.ok(v >= 0, "nothing below zero");
  for (const v of confusablesOf(NUMBER_CEILING)) assert.ok(v <= NUMBER_CEILING);
});

test("a card without a value is not a part", () => {
  const cards = [
    { id: "a", lang: "ar-PS", forms: [{ ar: "كتاب", en: "book", lat: "" }] },
    { id: "b", lang: "ar-PS", value: "40", forms: [{ ar: "أربعين", en: "40", lat: "" }] },
    { id: "c", lang: "ar-PS", value: -3, forms: [{ ar: "x", en: "", lat: "" }] },
    { id: "d", lang: "ar-PS", value: 40, forms: [{ ar: "أربعين", en: "40", lat: "" }] },
    { id: "e", lang: "ar-PS", value: 40, forms: [{ ar: "أربعون", en: "40", lat: "" }] },
  ];
  const parts = partCards(/** @type {any[]} */ (cards), "ar-PS");
  assert.equal(parts.size, 1);
  /* The first card claiming a value keeps it: a duplicate written by
     accident must not silently change what every number sounds like. */
  assert.equal((parts.get(40) || {}).id, "d");
});

test("parts are read only from the language being asked about", () => {
  const mixed = [
    { id: "a", lang: "ar-PS", value: 5, forms: [{ ar: "خمسة", en: "5", lat: "" }] },
    { id: "b", lang: "vi-Hue", value: 5, forms: [{ ar: "năm", en: "5", lat: "" }] },
  ];
  assert.equal((partCards(mixed, "vi-Hue").get(5) || {}).id, "b");
  assert.equal((partCards(mixed, "ar-PS").get(5) || {}).id, "a");
});

/* ---- the questions a number is asked ---- */

test("the three number questions are real exercises, and none is scheduled", () => {
  for (const lang of [AR, HE, VI]) {
    for (const [asked, stands] of Object.entries(NUMBER_EQUIVALENT)) {
      const spec = exOf(asked, lang);
      assert.ok(spec, `${lang.id} cannot describe ${asked}`);
      assert.ok(spec.instruction && spec.question, `${asked} has nothing to put on screen`);
      /* Never scheduled: a number is not a card and climbs no ladder, so
         nothing may deal these or store a state for one. */
      assert.equal(TYPES.includes(asked), false, `${asked} must stay out of TYPES`);
      /* And what it stands in for is an ordinary exercise that is. */
      assert.ok(TYPES.includes(stands), `${stands} should be a scheduled exercise`);
      /* The pair has to agree about which way round the question goes, or
         a number would credit a part for the opposite skill. */
      assert.equal(spec.promptField, must(exOf(stands, lang), stands).promptField, `${asked} prompts differently from ${stands}`);
      assert.equal(spec.answerField, must(exOf(stands, lang), stands).answerField, `${asked} answers differently from ${stands}`);
    }
  }
});

test("reading a number asks for figures and writing one asks for the script", () => {
  const read = must(exOf("num2fig", AR), "num2fig");
  assert.equal(read.promptField, "ar");
  assert.equal(read.answerField, "en");
  const write = must(exOf("fig2num", AR), "fig2num");
  assert.equal(write.promptField, "en");
  assert.equal(write.answerField, "ar");
  /* And the picking one puts the written-out numbers up as the choices. */
  const pick = must(exOf("fig2pick", AR), "fig2pick");
  assert.equal(pick.answerMode, "choice");
  assert.equal(pick.picks, "word");
});

test("a number answered in figures is right or wrong, never nearly right", () => {
  /* The rule this mode exists for. English answers are marked with an
     edit distance, which is right for a word and a disaster for a number:
     every single digit is one edit from every other, so 2 for 4 came back
     "very close" and was marked more kindly than a miss. */
  const asked = { en: "47", ar: "سبعة وأربعين", lat: "" };
  const mark = (/** @type {string} */ typed) => checkAnswer(typed, asked, "num2fig", { language: "ar-PS" });
  assert.deepEqual(mark("47"), { ok: true, reason: "exact" });
  for (const wrong of ["48", "46", "4", "7", "74", "470"]) {
    assert.deepEqual(mark(wrong), { ok: false, reason: "wrong" }, `${wrong} is not nearly 47`);
  }
  /* Notation is forgiven, because it is not knowledge. */
  const thousands = { en: "1525", ar: "ألف وخمسمية وخمسة وعشرين", lat: "" };
  for (const written of ["1525", "1,525", "1 525", "1.525", "01525", "+1525"]) {
    assert.equal(
      checkAnswer(written, thousands, "num2fig", { language: "ar-PS" }).ok, true,
      `${written} is one thousand five hundred and twenty-five`,
    );
  }
  /* And the digits an Arabic or Persian keyboard writes. */
  assert.equal(mark("٤٧").ok, true, "Arabic-Indic digits are the same number");
  assert.equal(mark("۴۷").ok, true, "and so are the Persian ones");
  assert.equal(mark("٤٨").ok, false, "but they are still marked");
  /* Words are not figures, whatever they say. */
  for (const notANumber of ["", "   ", "forty-seven", "4a7"]) {
    assert.equal(mark(notANumber).ok, false, `"${notANumber}" is not figures`);
  }
});
