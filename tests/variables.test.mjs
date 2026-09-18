/*
 * A hole in a card, and the cards that fill it.
 *
 * "My name is Raphael" learnt as one lump is a sentence somebody can say
 * once; the same frame met as Raphael, then Victor, then Sarah is a
 * sentence they can say about anyone. What is checked here is that the
 * substitution keeps its promises: the same value in every field of one
 * question, a different one next time round, and nothing drawn at random.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fillForm,
  fillText,
  hasSlots,
  slotTrouble,
  slotsIn,
  slotsOf,
  splitSlots,
  valueOf,
  valuesOf,
  lentBy,
  isLent,
  valuesFor,
  valuesForTurn,
  fillsOf,
  valuesAt,
  metKey,
  metAt,
  noteMet,
  mergeMet,
  refOf,
  WORD_SLOT,
} from "../src/variables.ts";
import { canAsk, unmetNeeds } from "../src/offers.ts";
import { EX, LANGUAGES, needLabel } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];

/* The worked example, in the Latin alphabet for the same reason every other
   test is: what is being checked is the substitution, not the script. */
/** @returns {any} */
const frame = () => ({
  id: "p1",
  ar: "ismi {{name}}",
  en: "My name is {{name}}",
  lat: "ismi {{name}}",
  recs: [],
  s: {},
});
/** @param {string} id @param {string} en @returns {any} */
const value = (id, en) => ({ id, fills: "name", ar: `${en}-script`, en, lat: en.toLowerCase() });

test("a card names the variables it leaves open, once each", () => {
  assert.deepEqual(slotsIn("My name is {{name}}"), ["name"]);
  assert.deepEqual(slotsIn("{{name}} and {{name}}"), ["name"], "one hole filled twice");
  assert.deepEqual(slotsIn("{{a}} meets {{b}}"), ["a", "b"]);
  assert.deepEqual(slotsIn("nothing here"), []);
  /* Folded, so a keyboard that capitalises the first letter of a line does
     not quietly make a second variable that looks like the first. */
  assert.deepEqual(slotsIn("{{Name}}"), ["name"]);
  assert.deepEqual(slotsIn("{{ name }}"), ["name"], "spaces will happen");
  /* Not a template language: anything past a name is not a hole. */
  assert.deepEqual(slotsIn("{{name|upper}}"), []);
  assert.deepEqual(slotsIn("{name}"), []);
  assert.deepEqual(slotsOf(frame()), ["name"]);
  assert.equal(hasSlots(frame()), true);
  assert.equal(hasSlots({ ar: "bayt", en: "house" }), false);
});

test("every field with words in it leaves the same holes", () => {
  /* The failure this catches: a frame whose English has a hole and whose
     script has not is a question that asks for a name and marks an answer
     that never contained one. */
  assert.equal(slotTrouble(frame()), null);
  const half = { ...frame(), ar: "ismi" };
  assert.deepEqual(slotTrouble(half), { field: "ar", missing: ["name"], extra: [] });
  /* A field nobody filled in is not disagreeing — a card with no
     transliteration is an ordinary card, not a broken one. */
  assert.equal(slotTrouble({ ...frame(), lat: "" }), null);
  /* And a field with a hole of its own that nothing else has. */
  const odd = { ...frame(), lat: "ismi {{name}} {{age}}" };
  assert.deepEqual(slotTrouble(odd), { field: "ar", missing: ["age"], extra: [] });
  assert.equal(slotTrouble({ ar: "bayt", en: "house" }), null, "no holes, no trouble");
});

test("what can fill a hole is a card that says so, in the same language", () => {
  const pool = [
    { ...value("v1", "Raphael"), lang: "ar-PS" },
    { ...value("v2", "Victor"), lang: "ar-PS" },
    /* A Vietnamese name in an Arabic frame is not a variation on the
       sentence, it is a different sentence. */
    { ...value("v3", "Sarah"), lang: "vi-HUE" },
    /* An ordinary card fills nothing, whatever it says. */
    { id: "w1", ar: "bayt", en: "house", lang: "ar-PS" },
    /* And a value with no word in it would fill the hole with nothing. */
    { id: "v4", fills: "name", ar: "", en: "Blank", lang: "ar-PS" },
  ];
  const found = valuesFor(frame(), pool, "ar-PS");
  assert.deepEqual(Object.keys(found), ["name"]);
  assert.deepEqual(found.name.map((v) => v.en), ["Raphael", "Victor"]);
  /* A card with no holes asks for nothing. */
  assert.deepEqual(valuesFor({ ar: "bayt", en: "house" }, pool, "ar-PS"), {});
});

test("a value lends its first accepted answer, not the whole field", () => {
  /* A value card may accept two spellings, and "kitaab / safar" dropped
     whole into a sentence is not a sentence. */
  const two = { id: "v9", fills: "name", ar: "raafi / rafa", en: "Raphael", lat: "raafi / rafa" };
  assert.deepEqual(valueOf(two), { id: "v9", ar: "raafi", en: "Raphael", lat: "raafi" });
});

test("one value per question, in every field at once", () => {
  const took = { name: { id: "v1", ar: "Raphael-script", en: "Raphael", lat: "raphael" } };
  const filled = fillForm(frame(), took);
  assert.equal(filled.ar, "ismi Raphael-script");
  assert.equal(filled.en, "My name is Raphael");
  assert.equal(filled.lat, "ismi raphael");
  assert.equal(filled.id, "p1", "everything else about the card travels with it");
  /* Which value it took, for anything that has to say so. */
  assert.deepEqual(filled.filled, { name: "v1" });

  /* The accepted answers are written from `ar` and would otherwise still
     hold the frame — which answersOf prefers where the two agree, so a
     stale one would mark the question against "ismi {{name}}". */
  const withAnswers = { ...frame(), answers: [{ text: "ismi {{name}}", lat: "ismi {{name}}" }] };
  assert.deepEqual(fillForm(withAnswers, took).answers, [
    { text: "ismi Raphael-script", lat: "ismi raphael" },
  ]);

  /* A hole nobody offered a value for is left standing rather than blanked:
     a visible {{name}} is a bug report, a silent gap is a mystery. */
  assert.equal(fillText("My name is {{name}}", {}, "en"), "My name is {{name}}");
  assert.equal(fillForm(frame(), null).en, "My name is {{name}}");
});

test("a card with two names is met as both, one at a time", () => {
  /* Rotated by how often the exercise has been asked, like the phrase a
     word is shown in and the accepted answer a pronunciation question is
     about: nothing is drawn, so the same count is the same sentence and a
     re-render cannot swap the name under somebody mid-answer. */
  const have = { name: [value("v1", "Raphael"), value("v2", "Victor"), value("v3", "Sarah")].map((v) => valueOf(v)) };
  const at = (/** @type {number} */ n) => (valuesForTurn(["name"], have, n) || { name: value("", "") }).name.en;
  assert.equal(at(0), "Raphael");
  assert.equal(at(1), "Victor");
  assert.equal(at(2), "Sarah");
  assert.equal(at(3), "Raphael", "and round again");
  assert.equal(at(-2), "Sarah", "however the count arrives");

  /* Two holes turn like an odometer rather than in lockstep: with two
     variables of two values each, sharing an index would only ever show two
     of the four sentences the card can make. */
  const pair = {
    who: [valueOf(value("a", "Ann")), valueOf(value("b", "Ben"))],
    what: [valueOf({ ...value("c", "tea"), fills: "what" }), valueOf({ ...value("d", "milk"), fills: "what" })],
  };
  const seen = [0, 1, 2, 3].map((n) => {
    const took = valuesForTurn(["who", "what"], pair, n) || {};
    return `${(took.who || {}).en} ${(took.what || {}).en}`;
  });
  assert.deepEqual(seen, ["Ann tea", "Ben tea", "Ann milk", "Ben milk"]);
  assert.equal(new Set(seen).size, 4, "every combination before any repeat");

  /* Nothing at all where a hole has nothing to put in it. */
  assert.equal(valuesForTurn(["name"], { name: [] }, 0), null);
  assert.equal(valuesForTurn(["name"], {}, 0), null);
});

test("a hole with nothing in it is not a question, and says which hole", () => {
  const empty = unmetNeeds(frame(), EX.ar2en, null, [], { name: [] });
  assert.deepEqual(empty, ["fills:name"]);
  assert.equal(
    canAsk({ unit: frame(), scene: null, contexts: [], values: { name: [] } }, "ar2en", ar),
    false
  );
  /* Named, because "a card that fills {{name}}" is a job somebody can go
     and do where "a value" is a riddle. */
  assert.match(needLabel("fills:name", ar), /\{\{name\}\}/);
  assert.match(needLabel("fills:name,age", ar), /\{\{name\}\} and \{\{age\}\}/);

  /* And with something to put in it, the ordinary exercises come back. */
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(frame(), EX.ar2en, null, [], have), []);
  assert.equal(canAsk({ unit: frame(), scene: null, contexts: [], values: have }, "ar2en", ar), true);
  assert.equal(canAsk({ unit: frame(), scene: null, contexts: [], values: have }, "en2ar", ar), true);
});

test("a frame is not one of the words in a matching grid", () => {
  /* The grid puts five words up at once and only narrows the one being
     asked, so a frame standing in the company would show the hole it left
     open. It is refused for the same reason a recording is, and says so. */
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(frame(), EX.match, null, [], have, 99), ["fixed"]);
  assert.equal(
    canAsk({ unit: frame(), scene: null, contexts: [], values: have, mates: 99 }, "match", ar),
    false
  );
  /* An ordinary word with company is asked it. */
  const word = { id: "w1", ar: "bayt", en: "house", lat: "beit", recs: [], s: {} };
  assert.deepEqual(unmetNeeds(word, EX.match, null, [], {}, 99), []);
  assert.equal(canAsk({ unit: word, scene: null, contexts: [], mates: 99 }, "match", ar), true);
  /* And a word with nobody to stand beside it is not: the question is the
     company it keeps. */
  assert.deepEqual(unmetNeeds(word, EX.match, null, [], {}, 0), ["mates"]);
});

test("a card whose words change cannot be the one on a recording", () => {
  /* The cost of the feature, and it is reported rather than quietly
     dropped: a teacher who writes a variable into a card with four
     recordings on it should be told where the listening exercises went. */
  const heard = { ...frame(), recs: [{ id: "a".repeat(64) }] };
  const have = { name: [valueOf(value("v1", "Raphael"))] };
  assert.deepEqual(unmetNeeds(heard, EX.rec2en, null, [], have), ["fixed"]);
  assert.equal(canAsk({ unit: heard, scene: null, contexts: [], values: have }, "rec2en", ar), false);
  assert.match(needLabel("fixed", ar), /recording/);

  /* The same card, without the hole, is asked by ear as it always was. */
  const fixed = { ...heard, ar: "ismi rafa", en: "My name is Raphael", lat: "ismi rafa" };
  assert.deepEqual(unmetNeeds(fixed, EX.rec2en, null, [], {}), []);
  assert.equal(canAsk({ unit: fixed, scene: null, contexts: [], values: {} }, "rec2en", ar), true);
});

/*
 * The one hole nobody has to say they fill.
 *
 * Every other variable is a name a teacher invents and then writes on each
 * card that stands in it. That is right for a hole with a particular sort
 * of thing in it and wrong for the commonest frame there is — "I like
 * ____" — where what goes in is simply a word the learner knows. Naming
 * every word in the deck one at a time to say so is filing, not teaching.
 */
test("any word fills {{word}}, with nothing written on it", () => {
  const word = { id: "w1", ar: "kitaab", en: "book", lat: "kitaab" };
  assert.deepEqual(fillsOf(word, "word"), [WORD_SLOT]);

  /* And a card that also names a slot of its own stands in both. */
  const named = { id: "n1", ar: "Raphael", en: "Raphael", lat: "", fills: "name" };
  assert.deepEqual(fillsOf(named, "word"), ["name", WORD_SLOT]);

  /* Saying it fills `word` adds nothing: it already did. */
  assert.deepEqual(fillsOf({ ...word, fills: "word" }, "word"), ["word"]);
});

test("only a word fills it, and never a card with a hole of its own", () => {
  const phrase = { id: "p1", ar: "sukkir il-baab", en: "close the door", lat: "" };
  assert.deepEqual(fillsOf(phrase, "phrase"), []);
  assert.deepEqual(fillsOf(phrase, "sentence"), []);
  assert.deepEqual(fillsOf(phrase, "dialog"), []);

  /* A frame dropped into somebody else's hole is a sentence with a gap
     where the point was — and dropped into its own, a sentence inside
     itself. It fills nothing at all, whatever it says: naming a slot by
     hand was the one exception to that rule and it is gone. */
  const frame = { id: "f1", ar: "bḥibb {{word}}", en: "I like {{word}}", lat: "" };
  assert.deepEqual(fillsOf(frame, "word"), []);
  assert.deepEqual(fillsOf({ ...frame, fills: "thing" }, "word"), []);
  assert.deepEqual(fillsOf({ ...frame, fills: "thing", category: "noun" }, ""), []);

  /* A caller with no opinion about kinds gets the named slot alone, which
     is what every card did before this existed. */
  assert.deepEqual(fillsOf({ ar: "Raphael", en: "Raphael", fills: "name" }, ""), ["name"]);
  assert.deepEqual(fillsOf({ ar: "kitaab", en: "book" }, ""), []);
});

test("a frame with {{word}} in it is filled from the whole vocabulary", () => {
  const frame = { ar: "bḥibb {{word}}", en: "I like {{word}}", lat: "bḥibb {{word}}" };
  const pool = [
    { id: "w1", ar: "kitaab", en: "book", lat: "kitaab", lang: "ar-PS" },
    { id: "w2", ar: "beit", en: "house", lat: "beit", lang: "ar-PS" },
    /* Not a word, so not a filler. */
    { id: "p1", ar: "sukkir il-baab", en: "close the door", lat: "", lang: "ar-PS" },
    /* Another language's word is a different sentence, not a variation. */
    { id: "v1", ar: "nhà", en: "house", lat: "", lang: "vi-Hue" },
  ];
  /** @param {any} c */
  const kind = (c) => (String(c.ar || "").includes(" ") ? "phrase" : "word");
  const have = valuesFor(frame, pool, "ar-PS", kind);
  assert.deepEqual(have.word.map((/** @type {any} */ v) => v.ar), ["kitaab", "beit"]);

  /* And without being told what a kind is, the hole has nothing in it —
     which is what keeps this module ignorant of every language. */
  assert.deepEqual(valuesFor(frame, pool, "ar-PS").word, []);
});

test("a named hole and the built-in one fill from different cards", () => {
  const frame = { ar: "{{name}} bḥibb {{word}}", en: "{{name}} likes {{word}}", lat: "" };
  const pool = [
    { id: "n1", ar: "Raphael", en: "Raphael", lat: "", fills: "name", lang: "ar-PS" },
    { id: "w1", ar: "kitaab", en: "book", lat: "", lang: "ar-PS" },
  ];
  const have = valuesFor(frame, pool, "ar-PS", () => "word");
  /* Raphael is a word too, so he stands in both — which is right: "Raphael
     likes Raphael" is a sentence, and a rule to forbid it would be a rule
     about names. */
  assert.deepEqual(have.name.map((/** @type {any} */ v) => v.ar), ["Raphael"]);
  assert.deepEqual(have.word.map((/** @type {any} */ v) => v.ar), ["Raphael", "kitaab"]);
});

/* --- what a card says it is, and every form it has ---

   Two ways a card fills a hole without being told to, one about the card
   and one about its forms. Both exist so that a teacher writes a sentence
   and the vocabulary joins in, rather than writing a name on every card
   one at a time. */

test("a blank named after a kind of word is filled by the words of that kind", () => {
  const noun = { id: "n1", ar: "kitaab", en: "book", lat: "", category: "noun" };
  /* It stands in {{noun}} because it says it is one, and in {{word}}
     because everything does. */
  assert.deepEqual(fillsOf(noun, "word"), ["word", "noun"]);
  /* And it is asked of the card, not of this module: which names a
     language declares is the language pack's business, so a category
     nobody declares still fills a hole of its own name. */
  assert.deepEqual(fillsOf({ ...noun, category: "clitic" }, ""), ["clitic"]);
  /* A card nobody has answered for fills nothing extra. */
  assert.deepEqual(fillsOf({ id: "x", ar: "kitaab", en: "book" }, ""), []);
  /* A name the teacher wrote by hand and a kind of word are two answers
     and both are kept, in that order. */
  assert.deepEqual(fillsOf({ ...noun, fills: "thing" }, ""), ["thing", "noun"]);
  /* Saying it fills the kind it is adds nothing: it already did. */
  assert.deepEqual(fillsOf({ ...noun, fills: "noun" }, ""), ["noun"]);

  /* A frame is not a filler, whatever it says it is: a sentence dropped
     into somebody else's hole is a sentence with a gap in it. */
  const said = { id: "f1", ar: "{{noun}} kbiir", en: "the {{noun}} is big", lat: "", category: "noun" };
  assert.deepEqual(fillsOf(said, "phrase"), []);
});

test("a sentence draws its blanks from the cards that say what they are", () => {
  const frame = { ar: "{{noun}} {{adjective}}", en: "the {{noun}} is {{adjective}}", lat: "" };
  const pool = [
    { id: "n1", ar: "kitaab", en: "book", lat: "", category: "noun", lang: "ar-PS" },
    { id: "n2", ar: "beit", en: "house", lat: "", category: "noun", lang: "ar-PS" },
    { id: "a1", ar: "kbiir", en: "big", lat: "", category: "adjective", lang: "ar-PS" },
    /* A verb is neither of the two holes this sentence leaves. */
    { id: "v1", ar: "akal", en: "ate", lat: "", category: "verb", lang: "ar-PS" },
  ];
  const have = valuesFor(frame, pool, "ar-PS");
  assert.deepEqual(have.noun.map((/** @type {any} */ v) => v.ar), ["kitaab", "beit"]);
  assert.deepEqual(have.adjective.map((/** @type {any} */ v) => v.ar), ["kbiir"]);
});

test("every form of a card lends itself, each under its own name", () => {
  const card = {
    id: "c1",
    forms: [
      { id: "c1", ar: "kitaab", en: "book", lat: "kitaab" },
      { id: "c1-f0", ar: "kutub", en: "books", lat: "kutub" },
    ],
  };
  assert.deepEqual(valuesOf(card).map((v) => [v.id, v.ar]),
    [["c1", "kitaab"], ["c1-f0", "kutub"]]);

  /* The name matters: how far the learner has climbed is a fact about a
     form, and so is a frame's record of having met one. */
  assert.deepEqual(lentBy(card).map((l) => l.form.en), ["book", "books"]);

  /* A form the teacher keeps without asking about lends nothing — which
     is what one tick for two questions could only mean, and what an
     absent `lend` still means. And a form with no word in it would fill
     the hole with nothing. */
  const mixed = {
    id: "c2",
    forms: [
      { id: "c2", ar: "qalam", en: "pen", lat: "" },
      { id: "c2-f0", ar: "aqlaam", en: "pens", lat: "", ask: false },
      { id: "c2-f1", ar: "", en: "nothing", lat: "" },
    ],
  };
  assert.deepEqual(valuesOf(mixed).map((v) => v.id), ["c2"]);

  /* A card's own word answers to the card where the form carries no name
     of its own, because that is what it was called before forms had names
     and what every record already written points at. */
  const old = { id: "c3", forms: [{ ar: "shams", en: "sun", lat: "" }] };
  assert.deepEqual(valuesOf(old).map((v) => v.id), ["c3"]);

  /* Handed a plain form — a line of a conversation, a unit the scheduler
     is holding — it is its own single lending. */
  assert.deepEqual(valuesOf({ id: "l1", ar: "salaam", en: "peace", lat: "" }).map((v) => v.id), ["l1"]);
});

test("being asked and being lent are two answers on one form", () => {
  /* Since 0.159 a form says both, because a word can be worth meeting
     inside somebody else's sentence without being a question of its own —
     that is what a value card is — and worth asking on its own without
     being dropped into every frame with a hole of its name. */
  assert.equal(isLent({ ar: "raafaa2iil" }), true, "nothing said is lent");
  assert.equal(isLent({ ar: "raafaa2iil", ask: false }), false,
    "and a card written before this lends exactly while it is asked");
  assert.equal(isLent({ ar: "raafaa2iil", ask: false, lend: true }), true,
    "a name is lent everywhere and asked nowhere");
  assert.equal(isLent({ ar: "kitaab", lend: false }), false,
    "and a word can be asked without standing in for anything");

  const card = {
    id: "n", lang: "ar-PS", fills: "name",
    forms: [
      { id: "n", ar: "raafaa2iil", en: "Raphael", lat: "", ask: false, lend: true },
      { id: "n-f0", ar: "raafii", en: "Raphael", lat: "", ask: false },
    ],
  };
  assert.deepEqual(valuesOf(card).map((v) => v.id), ["n"],
    "the one that says it is lent, and not the one that only says it is not asked");
  const frame = { ar: "ismi {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}" };
  assert.deepEqual(valuesFor(frame, [card], "ar-PS").name.map((/** @type {any} */ v) => v.ar),
    ["raafaa2iil"]);
});

test("a caller may say which of a card's forms it lends, and this module does not ask why", () => {
  /* An adjective lends its own word and the sentence picks the agreeing
     form — but which cards those are is a language's answer, so it is
     handed in as a predicate over forms. */
  const card = {
    id: "big", lang: "ar-PS", category: "adjective",
    forms: [
      { id: "big", ar: "kbiir", en: "big", lat: "" },
      { id: "big-f", ar: "kbiire", en: "big", lat: "", row: "agreement", col: "feminine" },
    ],
  };
  assert.deepEqual(valuesOf(card).map((v) => v.id), ["big", "big-f"], "everything, unless told otherwise");
  assert.deepEqual(valuesOf(card, [], (f) => !f.row).map((v) => v.id), ["big"]);
  assert.deepEqual(lentBy(card, [], (f) => !f.row).map((l) => l.form.ar), ["kbiir"]);
  const frame = { ar: "{{adjective}}", en: "{{adjective}}", lat: "" };
  assert.deepEqual(valuesFor(frame, [card], "ar-PS", undefined, (c, f) => !f.row).adjective.map((/** @type {any} */ v) => v.id), ["big"]);
  assert.deepEqual(valuesFor(frame, [card], "ar-PS").adjective.map((/** @type {any} */ v) => v.id), ["big", "big-f"]);
});

test("a plural stands in a sentence its singular does not", () => {
  const frame = { ar: "{{noun}} hown", en: "{{noun}} here", lat: "" };
  const pool = [{
    id: "c1", lang: "ar-PS", category: "noun",
    forms: [
      { id: "c1", ar: "kitaab", en: "book", lat: "" },
      { id: "c1-f0", ar: "kutub", en: "books", lat: "" },
    ],
  }];
  assert.deepEqual(valuesFor(frame, pool, "ar-PS").noun.map((/** @type {any} */ v) => v.en),
    ["book", "books"]);
});

/* --- a frame, cut into words and holes ---

   A card is listed as it was written, so the braces reach the screen and
   something has to draw them differently from the words around them. */

test("a frame comes apart into what is written and what is a hole", () => {
  assert.deepEqual(splitSlots("اسمي {{name}}"), [
    { text: "اسمي " },
    { text: "{{name}}", slot: "name" },
  ]);
  /* Two holes, and the words between and around them. */
  assert.deepEqual(splitSlots("{{name}} bḥibb {{food}}!"), [
    { text: "{{name}}", slot: "name" },
    { text: " bḥibb " },
    { text: "{{food}}", slot: "food" },
    { text: "!" },
  ]);
});

test("the pieces put back together are the string that was cut", () => {
  /* The point of the cut is how each piece is drawn, so losing or moving
     a character would change what the card says. */
  for (const line of [
    "اسمي {{name}}",
    "{{name}} bḥibb {{food}}!",
    "no holes at all",
    "{{ Name }} trimmed and folded",
    "",
    "{{a}}{{b}}",
  ]) {
    assert.equal(splitSlots(line).map((r) => r.text).join(""), line, line);
  }
});

test("a card with nothing in it is one plain piece, or none", () => {
  assert.deepEqual(splitSlots("kitaab"), [{ text: "kitaab" }]);
  assert.deepEqual(splitSlots(""), []);
  assert.deepEqual(splitSlots(null), []);
  assert.deepEqual(splitSlots(undefined), []);
});

test("a hole is named the way every other reader of it names it", () => {
  /* slotsIn folds the case and trims the spaces; a cut that disagreed
     would mark a run as a hole the rest of the app has never heard of. */
  const line = "{{ Name }} and {{NAME}}";
  const cut = splitSlots(line).filter((r) => r.slot).map((r) => r.slot);
  assert.deepEqual([...new Set(cut)], slotsIn(line));
});

/*
 * How far along a value has to be to stand in a hole.
 *
 * The bug this is about: a hole was filled from every card that could fill
 * it, whatever the learner had met, so "I like {{word}}" reached the whole
 * vocabulary and *English → script* on it asked for a sentence containing a
 * word nobody had ever seen. That is not a hard question, it is one with no
 * answer, and the level it was asked at is what makes it so.
 */
const val = (/** @type {string} */ id) => ({ id, ar: id, en: id, lat: id });

test("a value stands in a hole only as far up as it has climbed itself", () => {
  const list = [val("new"), val("met"), val("known"), val("written")];
  /** @type {Record<string, number>} */
  const climbed = { new: 0, met: 1, known: 2, written: 4 };
  const reach = (/** @type {any} */ v) => climbed[v.id];
  const at = (/** @type {number} */ level) =>
    valuesAt(list, "word", level, reach).map((/** @type {any} */ v) => v.id);

  /* Level one asks what a word means, and a word nobody has answered is
     not one to read a sentence off. */
  assert.deepEqual(at(1), ["met", "known", "written"]);
  assert.deepEqual(at(2), ["known", "written"]);
  /* Writing it from its meaning, which is the top: only a word the learner
     can already write from its meaning. */
  assert.deepEqual(at(4), ["written"]);
});

test("and a value with no ladder is read off the frame that teaches it", () => {
  /* Raphael is never drilled on its own — "what does Raphael mean" is not a
     question — so it has no progress of its own, ever. reach comes back
     null for those, and what is read instead is how far this frame has
     already been asked with it. */
  const list = [val("raphael"), val("sarah")];
  const reach = () => null;
  const at = (/** @type {number} */ level, /** @type {any} */ met = null) =>
    valuesAt(list, "name", level, reach, met).map((/** @type {any} */ v) => v.id);

  /* The bottom level is where they are introduced: nothing is below it to
     have been seen at. */
  assert.deepEqual(at(1), ["raphael", "sarah"]);
  /* And one level above wherever each has got to, and no further. */
  assert.deepEqual(at(2, { "name:raphael": 1 }), ["raphael"]);
  assert.deepEqual(at(3, { "name:raphael": 1 }), []);
  assert.deepEqual(at(3, { "name:raphael": 2, "name:sarah": 3 }), ["raphael", "sarah"]);
});

test("a hole records which of its values it has been asked with", () => {
  assert.equal(metKey("name", val("raphael")), "name:raphael");
  /* A value with no id is pointed at by its script, which is what fillForm
     writes and therefore what comes back to be recorded. */
  assert.equal(refOf({ ar: "رافاييل", en: "Raphael", lat: "rafa" }), "رافاييل");

  const once = noteMet({}, { name: "raphael" }, 2);
  assert.deepEqual(once, { "name:raphael": 2 });
  assert.equal(metAt(once, "name", val("raphael")), 2);
  assert.equal(metAt(once, "name", val("sarah")), 0);

  /* A high-water mark: a lower level changes nothing, and nothing moved
     comes back as null so a caller can tell there is nothing to write. */
  assert.equal(noteMet(once, { name: "raphael" }, 1), null);
  assert.deepEqual(noteMet(once, { name: "raphael" }, 4), { "name:raphael": 4 });

  /* Null on a card that leaves no hole, which is nearly all of them —
     returning a fresh empty record instead had every card in the document
     start carrying one the first time it was answered. */
  assert.equal(noteMet(undefined, undefined, 1), null);

  /* Only the values the caller says are worth recording — the ones with no
     ladder of their own. A frame drawing on the whole vocabulary would
     otherwise write a line per word. */
  assert.equal(noteMet({}, { word: "kitaab" }, 3, () => false), null);
});

test("and two devices' records merge by taking the further of the two", () => {
  assert.deepEqual(
    mergeMet({ "name:raphael": 1, "name:sarah": 3 }, { "name:raphael": 4 }),
    { "name:raphael": 4, "name:sarah": 3 }
  );
  /* Idempotent and order-free, which is all sync asks of anything it
     merges. */
  const a = { "name:raphael": 2 };
  const b = { "name:raphael": 3, "name:victor": 1 };
  assert.deepEqual(mergeMet(a, b), mergeMet(b, a));
  assert.deepEqual(mergeMet(mergeMet(a, b), b), mergeMet(a, b));
  /* And a form with no record does not start carrying an empty one. */
  assert.equal(mergeMet(null, null), undefined);
  assert.equal(mergeMet({}, {}), undefined);
});
