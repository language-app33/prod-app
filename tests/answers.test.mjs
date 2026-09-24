/*
 * Accepted answers: what belongs to which.
 *
 * A card may accept more than one, and each is its own word — said its own
 * way and carrying its own grammar. So what matters here is that nothing
 * gets handed to the wrong answer: not a transliteration, not a gender, and
 * not by a migration reading a card written before any of this existed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  answerAt,
  answerForTurn,
  answerGiven,
  answerRows,
  answersOf,
  joinAlternatives,
  meaningForTurn,
  meaningsOf,
  packAnswers,
  readAnswer,
  saidAnswers,
  splitAlternatives,
  withAnswer,
} from "../src/answers.ts";
import { canAsk, unmetNeeds } from "../src/offers.ts";
import {
  EX,
  LANGUAGES,
  TYPES,
  answerFields,
  checkAnswer,
  labelFor,
  showsOneAnswer,
  answerOf,
  exOf,
  isListening,
  keyFor,
  keysFor,
  levelOf,
  typeOf,
} from "../src/languages.ts";
import { openTypes } from "../src/scheduler.ts";
import { must } from "./helpers.mjs";

const ar = LANGUAGES["ar-PS"];
/* What a stored answer may carry, as the grammar table declares it. */
const fields = answerFields();

/* An answer's words and its grammar, without the two lists of recordings
   every read hands back. Those are checked on their own further down; up
   here they would be four extra lines in every expectation, about
   something the test is not about.

   Both lists are there whether or not there is anything in them, because
   an absent list and an empty one mean different things to `withAnswer` —
   which is the one thing about them these older assertions would
   otherwise be quietly asserting. */
/** @param {any} answer */
const bare = ({ clips: _c, slowClips: _s, ...rest }) => rest;
/** @param {any[]} list */
const said = (list) => list.map(bare);

/* Two spellings of one meaning, each said its own way. Written in the
   Latin alphabet here for the same reason every other test is: what is
   being checked is the pairing, not the script. */
/** @returns {any} */
const two = () => ({ id: "w1", ar: "kitaab-script / safar-script", lat: "kitaab / safar", en: "book", recs: [], s: {} });

test("each accepted answer carries its own transliteration", () => {
  assert.deepEqual(said(answersOf(two(), fields)), [
    { text: "kitaab-script", lat: "kitaab", at: 0 },
    { text: "safar-script", lat: "safar", at: 1 },
  ]);
});

test("a card with one of each is what it always was", () => {
  /* Every card written before this existed. Nothing to migrate: one answer
     and one transliteration already pair correctly. */
  assert.deepEqual(said(answersOf({ ar: "bayt", lat: "bayt-said" }, fields)), [
    { text: "bayt", lat: "bayt-said", at: 0 },
  ]);
  assert.deepEqual(said(answersOf({ ar: "bayt" }, fields)), [{ text: "bayt", lat: "", at: 0 }]);
});

test("a transliteration written for the second answer stays with the second", () => {
  /* The thing that can go wrong with pairing by position: dropping the
     blank would hand the second answer's pronunciation to the first, which
     is worse than having none. */
  const form = { ar: "one / two", lat: " / two-said" };
  assert.deepEqual(said(answersOf(form, fields)), [
    { text: "one", lat: "", at: 0 },
    { text: "two", lat: "two-said", at: 1 },
  ]);
  assert.deepEqual(saidAnswers(form, fields).map((a) => a.text), ["two"], "only one can be asked how it sounds");
});

test("an answer with no spelling is not an answer, and takes its cell with it", () => {
  /* A row somebody started and left. Kept, it would be an accepted answer
     of nothing — and every transliteration after it would slide. */
  assert.deepEqual(said(answersOf({ ar: " / two", lat: "one-said / two-said" }, fields)), [
    { text: "two", lat: "two-said", at: 1 },
  ]);
});

test("the editor writes both strings at once, so they cannot drift", () => {
  const packed = packAnswers([
    { text: "one", lat: "" },
    { text: "two", lat: "two-said" },
  ], fields);
  assert.deepEqual(packed.ar, "one / two");
  assert.deepEqual(packed.lat, " / two-said", "the blank holds the first answer's place");
  /* And what comes back out is what went in. */
  assert.deepEqual(answersOf(packed, fields).map((a) => [a.text, a.lat]), [["one", ""], ["two", "two-said"]]);

  /* A row with nothing in it at all is dropped whole rather than leaving a
     hole in either place. */
  const one = packAnswers([{ text: "one", lat: "one-said" }, { text: "", lat: "" }], fields);
  assert.deepEqual([one.ar, one.lat], ["one", "one-said"]);
  assert.equal(one.answers.length, 1);
  /* Including a transliteration typed with no answer beside it: there is
     nothing for it to be the pronunciation of. */
  assert.deepEqual(packAnswers([{ text: "", lat: "orphan" }], fields).answers, []);
});

test("the rows an editor opens on are never none", () => {
  assert.deepEqual(said(answerRows({}, fields)), [{ text: "", lat: "" }]);
  assert.deepEqual(said(answerRows({ ar: "one / two", lat: "one-said" }, fields)), [
    { text: "one", lat: "one-said" },
    { text: "two", lat: "" },
  ]);
});

test("splitting keeps blanks and joining drops only the trailing ones", () => {
  assert.deepEqual(splitAlternatives("a / b"), ["a", "b"]);
  assert.deepEqual(splitAlternatives("a ; b"), ["a", "b"], "the other separator people typed by hand");
  assert.deepEqual(splitAlternatives(""), [""]);
  assert.equal(joinAlternatives(["a", "", "b"]), "a /  / b", "a blank in the middle is holding a place");
  assert.equal(joinAlternatives(["a", "", ""]), "a", "blanks at the end are rows nobody filled in");
  assert.equal(joinAlternatives(["", ""]), "");
});

/* ---- and how each of them sounds ----------------------------------
   A recording belongs to the answer it is of, for the reason its gender
   does: two accepted answers are two words, said two ways. What these
   check is that the move takes nothing away from a card written before
   it — and that an answer nobody recorded is silent rather than borrowing
   the one beside it, which is the whole failure being fixed. */

/* A recording is named by the hash of its own bytes. Any string will do
   here: what is being checked is which answer holds which name. */
const RECS = { a: "clip-a", b: "clip-b", slow: "clip-a-slow" };

test("a recording belongs to the answer it is of", () => {
  const packed = packAnswers([
    { text: "one", lat: "one-said", clips: [RECS.a], slowClips: [RECS.slow] },
    { text: "two", lat: "two-said", clips: [RECS.b] },
  ], fields);
  assert.deepEqual(packed.answers.map((a) => a.clips), [[RECS.a], [RECS.b]]);
  assert.deepEqual(packed.answers.map((a) => a.slowClips), [[RECS.slow], undefined],
    "an answer nobody recorded stores no empty list");
  /* And the form carries every one of them, once each. That is what the
     server, an export and every card list read, and it is what says which
     recordings the card still points at — a clip nothing points at is
     deleted. */
  assert.deepEqual(packed.clips, [RECS.a, RECS.b]);
  assert.deepEqual(packed.slowClips, [RECS.slow]);

  /* Read back, each answer has its own again. */
  assert.deepEqual(answersOf(packed, fields).map((a) => a.clips), [[RECS.a], [RECS.b]]);
});

test("a card recorded before they belonged to an answer gives its clips to each", () => {
  /* The migration, stated as what it must not change. One answer and one
     set of recordings already pair correctly; two answers and one set
     meant the card's, and still do until somebody says otherwise. */
  const old = { ar: "one / two", lat: "one-said / two-said", clips: [RECS.a], slowClips: [] };
  assert.deepEqual(answersOf(old, fields).map((a) => a.clips), [[RECS.a], [RECS.a]]);
  assert.deepEqual(answersOf({ ar: "bayt", clips: [RECS.a] }, fields)[0].clips, [RECS.a]);
});

test("a question about one answer plays that answer's recording", () => {
  /* `recs` is the shape a device keeps its audio in, and its id is the
     clip name the answer carries — which is all the matching needs. */
  const card = {
    ...packAnswers([
      { text: "one", lat: "one-said", clips: [RECS.a] },
      { text: "two", lat: "two-said", clips: [RECS.b] },
    ], fields),
    en: "book",
    recs: [{ id: RECS.a, speed: "regular" }, { id: RECS.b, speed: "regular" }],
  };
  const second = withAnswer(card, answersOf(card, fields)[1]);
  assert.deepEqual(second.recs.map((r) => r.id), [RECS.b]);
  const first = withAnswer(card, answersOf(card, fields)[0]);
  assert.deepEqual(first.recs.map((r) => r.id), [RECS.a]);
});

test("an answer nobody recorded is silent rather than borrowing the other's", () => {
  const card = {
    ...packAnswers([
      { text: "one", lat: "one-said" },
      { text: "two", lat: "two-said", clips: [RECS.b] },
    ], fields),
    recs: [{ id: RECS.b, speed: "regular" }],
  };
  assert.deepEqual(withAnswer(card, answersOf(card, fields)[0]).recs, [],
    "the one thing a card must not do is play the wrong word");
  assert.deepEqual(withAnswer(card, answersOf(card, fields)[1]).recs.map((r) => r.id), [RECS.b]);
});

test("a card whose answers name no recordings keeps the ones it had", () => {
  /* Every card written before this. Its clips are the card's, they are
     not claimed by either answer, and narrowing to one answer leaves them
     exactly where they were. */
  const card = {
    ar: "one / two",
    lat: "one-said / two-said",
    answers: [{ text: "one", lat: "one-said" }, { text: "two", lat: "two-said" }],
    recs: [{ id: RECS.a, speed: "regular" }],
  };
  assert.deepEqual(withAnswer(card, { text: "one", lat: "one-said" }).recs.map((r) => r.id), [RECS.a]);
});

test("a question about how a card sounds is a question about one answer", () => {
  /* Narrowed to the pair being asked about, so the prompt, the marking and
     the answer screen all read one form. Asked of the whole card, "how is
     this pronounced" has two answers and "write this in the script" would
     accept a word the question never mentioned. */
  const one = withAnswer(two(), saidAnswers(two(), fields)[1]);
  assert.equal(one.ar, "safar-script");
  assert.equal(one.lat, "safar");
  assert.equal(one.en, "book", "everything else about the form travels with it");

  /* And the marking follows: the other spelling is now wrong, because the
     question was about this one. */
  assert.equal(checkAnswer("safar-script", one, "tr2ar", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("kitaab-script", one, "tr2ar", { language: "ar-PS" }).ok, false);
  /* Where the whole card would have accepted either. */
  assert.equal(checkAnswer("kitaab-script", two(), "tr2ar", { language: "ar-PS" }).ok, true);
});

test("a card with two of them is drilled on both, one at a time", () => {
  /* Rotated by how often the exercise has been asked, like the phrase a
     word is shown in: nothing is drawn, so the same count is the same
     question and a re-render does not swap the word under a learner. */
  const form = two();
  /** @param {any} f @param {number} n */
  const turn = (f, n) => answerForTurn(f, n, fields) || { text: "", lat: "" };
  assert.equal(turn(form, 0).text, "kitaab-script");
  assert.equal(turn(form, 1).text, "safar-script");
  assert.equal(turn(form, 2).text, "kitaab-script", "and round again");
  assert.equal(turn(form, 1).lat, "safar", "each with its own");

  /* An answer with no transliteration is not in the rotation: there is no
     question to ask about how it sounds. */
  const half = { ar: "one / two", lat: " / two-said" };
  assert.equal(turn(half, 0).text, "two");
  assert.equal(turn(half, 1).text, "two");
  assert.equal(answerForTurn({ ar: "one", lat: "" }, 0, fields), null, "and a card with none asks nothing");
});

test("what a pronunciation exercise waits for is an answer that has one", () => {
  /* Not merely a transliteration somewhere on the card. A form accepting
     two spellings with a transliteration for only the second can be asked
     — about the second. */
  const half = { ...two(), lat: " / safar" };
  assert.deepEqual(unmetNeeds(half, EX.tr2ar, null, []), []);
  assert.equal(canAsk({ unit: half, scene: null, contexts: [] }, "tr2ar", ar), true);

  /* And one with no transliteration against any answer cannot. */
  const none = { ...two(), lat: "" };
  assert.deepEqual(unmetNeeds(none, EX.tr2ar, null, []), ["lat"]);
  assert.equal(canAsk({ unit: none, scene: null, contexts: [] }, "ar2tr", ar), false);
});


/* --- grammar belongs to the answer, not to the form ---

   "I'm happy" said by a man and by a woman is one thing to know with two
   right answers that differ by a syllable and by a gender. A single
   "masculine" over the pair described one of them and lied about the
   other, and a learner who wrote the feminine was told they had written a
   masculine word. */

/** A card written before answers carried anything: one set of values, flat
    on the form, and two accepted answers underneath them. */
/** @returns {any} */
const beforeTheChange = () => ({
  id: "w2",
  ar: "mabsuut / mabsuuta",
  lat: "mabsuut-said / mabsuuta-said",
  en: "happy",
  number: "singular",
  gender: "masculine",
  recs: [],
  s: {},
});

test("a card written before the change reads as one answer per set of values", () => {
  /* The migration, stated as what it must not change: every answer keeps
     the grammar the form carried, because that is what it meant when there
     was one set of it. Nothing is invented and nothing is dropped. */
  const lifted = answersOf(beforeTheChange(), fields);
  assert.deepEqual(said(lifted), [
    { number: "singular", gender: "masculine", text: "mabsuut", lat: "mabsuut-said", at: 0 },
    { number: "singular", gender: "masculine", text: "mabsuuta", lat: "mabsuuta-said", at: 1 },
  ]);
  /* And a card with one answer — every ordinary card ever written — comes
     through in every particular. */
  assert.deepEqual(said(answersOf({ ar: "bayt", lat: "beit", gender: "masculine" }, fields)), [
    { gender: "masculine", text: "bayt", lat: "beit", at: 0 },
  ]);
});

test("a migrated card can then be corrected one answer at a time", () => {
  /* The point of the migration: what it produces is editable per answer,
     which the shape it replaced could not express at all. */
  const lifted = answersOf(beforeTheChange(), fields);
  const fixed = lifted.map((a) => (a.text === "mabsuuta" ? { ...a, gender: "feminine" } : a));
  const packed = packAnswers(fixed, fields);
  assert.deepEqual(packed.answers.map((a) => [a.text, a.gender]), [
    ["mabsuut", "masculine"],
    ["mabsuuta", "feminine"],
  ]);
  /* The delimited strings the server and every export read are written from
     the same list, so they cannot drift from it. */
  assert.equal(packed.ar, "mabsuut / mabsuuta");
  assert.equal(packed.lat, "mabsuut-said / mabsuuta-said");
  /* And reading it back gives what went in. */
  assert.deepEqual(answersOf(packed, fields).map((a) => a.gender), ["masculine", "feminine"]);
});

test("an alternate answer of a different gender keeps its own", () => {
  const card = packAnswers(
    [
      { text: "mabsuut", lat: "mabsuut-said", gender: "masculine", number: "singular" },
      { text: "mabsuuta", lat: "mabsuuta-said", gender: "feminine", number: "singular" },
    ],
    fields,
  );

  /* Both are right, because both are accepted answers of one card. */
  const asked = { ...card, en: "happy", s: {} };
  assert.equal(checkAnswer("mabsuut", asked, "en2ar", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("mabsuuta", asked, "en2ar", { language: "ar-PS" }).ok, true);

  /* And the screen can say which one was written, which is the whole
     reason the gender is down here rather than up on the form. */
  const matches = (/** @type {string} */ a, /** @type {string} */ b) => a.trim() === b.trim();
  /** @param {string} typed */
  const gave = (typed) => answerGiven(typed, asked, matches, fields) || { gender: "none" };
  assert.equal(gave("mabsuuta").gender, "feminine");
  assert.equal(gave("mabsuut").gender, "masculine");
  assert.equal(labelFor(gave("mabsuuta"), ar), "sg. f.");
  assert.equal(labelFor(gave("mabsuut"), ar), "sg. m.");
  /* Nothing they did not write. */
  assert.equal(answerGiven("something else", asked, matches, fields), null);
  assert.equal(answerGiven("", asked, matches, fields), null);
});

test("a stored answer is narrowed to what the language declares", () => {
  /* The schema at the door. A document is somebody's cards, so nothing
     throws: a value no language offers becomes no value, a field nobody
     asked for is not carried forward, and what is left is readable. */
  const read = readAnswer(
    { text: " kitaab ", lat: 7, gender: "wobbly", number: "plural", nonsense: "hello" },
    fields,
  );
  assert.deepEqual(bare(read), { text: "kitaab", lat: "7", number: "plural" });
  assert.equal("gender" in read, false, "a gender no language offers is not a gender");
  assert.equal("nonsense" in read, false, "a stored shape must not accumulate");
  assert.deepEqual(bare(readAnswer(null, fields)), { text: "", lat: "" });
  assert.deepEqual(bare(readAnswer("just a string", fields)), { text: "", lat: "" });
});

test("the delimited strings win where the array disagrees with them", () => {
  /* Two places hold the words, because `ar` and `lat` are what the server,
     an export and every card list read. Which wins has to be said once:
     the strings do, because they are what the rest of the app edits — a
     CSV import writes them, a card arrives from the server carrying them
     — and an array that no longer matches is a stale cache of a card that
     has moved on. */
  const card = packAnswers([{ text: "one", lat: "one-said", gender: "masculine" }], fields);
  assert.equal(answersOf(card, fields)[0].gender, "masculine", "in step, the array is read");

  const edited = { ...card, ar: "two" };
  assert.deepEqual(answersOf(edited, fields).map((a) => a.text), ["two"]);
  assert.equal(answersOf(edited, fields)[0].gender, undefined,
    "a stale entry does not describe a word it is no longer about");

  /* Clearing the transliteration clears it, whatever the array remembers —
     which is what a card stripped down to its recordings relies on. */
  assert.deepEqual(answersOf({ ...card, lat: "" }, fields).map((a) => a.lat), [""]);
});

/* ---- the other side of the card: what it means ---- */

test("a card that means two things means both of them", () => {
  /* The same convention as the answers, on the English side: one stored
     string with " / " between them, and a ; where somebody typed one. */
  assert.deepEqual(meaningsOf({ en: "office / desk" }), ["office", "desk"]);
  assert.deepEqual(meaningsOf({ en: "office; desk" }), ["office", "desk"]);
  assert.deepEqual(meaningsOf({ en: " office " }), ["office"]);
  assert.deepEqual(meaningsOf({ en: "" }), []);
  assert.deepEqual(meaningsOf(null), []);
});

test("a comma inside one meaning is not a second meaning", () => {
  /* The checker splits on a comma too, and is right to: a card written by
     hand may separate two meanings that way, and marking is where being
     generous costs nothing. Reading one here would cut a phrase in half
     and show a learner one clause of it as the question. */
  assert.deepEqual(meaningsOf({ en: "close the door, please" }), ["close the door, please"]);
  assert.equal(meaningForTurn({ en: "close the door, please" }), "close the door, please");
  /* And it is still marked as generously as it ever was. */
  assert.equal(checkAnswer("please", { en: "close the door, please" }, "ar2en", { language: "ar-PS" }).ok, true);
});

test("asked to write a card from its meaning, one meaning is the question", () => {
  /* Both are accepted the other way round — asked what the word means,
     "office" and "desk" are each right. Asked for the word, showing both
     asks neither: it reads as one English phrase with a slash in it, and
     it hands over more of the card than the question meant to. */
  const form = { ar: "maktab-script", lat: "maktab", en: "office / desk" };
  assert.equal(checkAnswer("desk", form, "ar2en", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("office", form, "ar2en", { language: "ar-PS" }).ok, true);
  assert.equal(meaningForTurn(form), "office", "and one of them is shown");

  /* Rotated by how often the exercise has been asked, like the answer a
     pronunciation question is about: a card that means two things is asked
     from both, one at a time, and nothing is drawn — the same count is the
     same question, so a re-render does not swap it under a learner. */
  assert.equal(meaningForTurn(form, 1), "desk");
  assert.equal(meaningForTurn(form, 2), "office", "and round again");
  assert.equal(meaningForTurn(form, -3), "desk", "however the count arrives");

  /* What is accepted does not move with it. The answer is the word, and a
     card accepting two spellings still accepts either — narrowing the
     question narrows the question. */
  const asked = { ...form, ar: "maktab-script / maktib-script", en: meaningForTurn(form, 1) };
  assert.equal(checkAnswer("maktab-script", asked, "en2ar", { language: "ar-PS" }).ok, true);
  assert.equal(checkAnswer("maktib-script", asked, "en2ar", { language: "ar-PS" }).ok, true);
});

test("a card with nothing written for its meaning is asked nothing", () => {
  /* Which is the state this exercise is never offered in, so there is
     nothing to narrow and nothing to put on screen. */
  assert.equal(meaningForTurn({ ar: "bayt" }), "");
  assert.equal(meaningForTurn({ ar: "bayt", en: " " }), "");
  assert.deepEqual(unmetNeeds({ ...two(), en: "" }, EX.en2ar, null, []), ["en"]);
});

/*
 * One accepted answer on the screen, every accepted answer in the marking.
 *
 * A card may accept كتاب or سفر. Put up together they read as one long
 * word with a slash through it, and on a tile they are the longest tile in
 * the grid — the answer given away by its shape rather than by its
 * meaning. But typed, either is right, and marking the second one wrong is
 * the bug the second answer exists to prevent.
 *
 * The two halves of that are checked here against every exercise there is,
 * so a type added later cannot quietly pick the wrong side.
 */
test("every question shows one accepted answer, and the typed ones still take any", () => {
  for (const type of TYPES) {
    const spec = EX[type];
    const typesTheScript = spec.answerMode === "ar" && spec.answerField === "ar";
    const bySound = spec.needs.includes("lat");
    assert.equal(
      showsOneAnswer(type),
      bySound || !typesTheScript,
      `${type} is on the wrong side of the rule`,
    );
  }

  /* The ones that keep every answer are exactly the ones that ask for the
     word to be written out. Named rather than counted, so that retiring or
     adding one of them is a visible edit here.

     Listening is in the list and is worth saying why. A recording belongs
     to the form, not to one of its accepted answers, so nothing knows
     which spelling was actually said — and marking somebody wrong for
     writing the other one, on a guess, is worse than accepting both. */
  const keepsAll = TYPES.filter((t) => !showsOneAnswer(t));
  assert.deepEqual(keepsAll, [
    "rec2ar", "en2ar", "img2ar", "ctx2ar", "rec2ctx",
    /* And the four that ask for a number or a time to be written out. A
       skill has exactly one way of saying what it drew, so narrowing it
       would be narrowing a list of one — the rule holds trivially here
       and is listed rather than excepted, so the day a composer offers a
       second wording this says so. */
    "fig2num", "count2phrase", "fig2time", "clock2time",
  ]);

  /* And pronunciation is the one that types the script and narrows anyway,
     because it asks how *that* spelling is said. */
  assert.equal(showsOneAnswer("tr2ar"), true);
  assert.equal(EX.tr2ar.answerMode, "ar");
});

test("which answer is shown is rotated, not drawn", () => {
  const form = {
    ar: "kitaab / safar",
    lat: "kitaab / safar",
    en: "book",
  };
  /* Every one of them is met before any is met twice, and the same count
     is the same question — so a re-render cannot swap the word under
     somebody halfway through answering. */
  assert.equal(must(answerAt(form, 0), "the first").text, "kitaab");
  assert.equal(must(answerAt(form, 1), "the second").text, "safar");
  assert.equal(must(answerAt(form, 2), "round again").text, "kitaab");
  assert.equal(must(answerAt(form, -1), "however the count arrives").text, "safar");

  /* Unlike answerForTurn, it does not need a pronunciation written: a
     question that merely shows the word can show any of them. */
  const quiet = { ar: "kitaab / safar", lat: "", en: "book" };
  assert.equal(must(answerAt(quiet, 1), "the second, unsaid").text, "safar");
  assert.equal(answerForTurn(quiet, 1), null);

  /* Nothing to narrow is nothing, not a crash. */
  assert.equal(answerAt({ ar: "", en: "book" }), null);
  assert.equal(answerAt(null), null);
});

/*
 * A second accepted answer is a second thing to learn.
 *
 * A card may accept two words for one meaning. Knowing one of them is not
 * knowing the other, so each carries its own progress — the same rule a
 * verb's table already follows, where every person and tense is scheduled
 * on its own.
 *
 * What makes it safe to turn on for cards that already exist is the shape
 * of the key: the first answer keeps the bare exercise name, so every
 * schedule ever written reads back exactly as it did, and sync goes on
 * merging state name by name without being told anything.
 */
test("the first answer keeps the bare name, and the rest are numbered", () => {
  assert.equal(keyFor("ar2en", 0), "ar2en");
  assert.equal(keyFor("ar2en"), "ar2en");
  assert.equal(keyFor("ar2en", 1), "ar2en@1");

  assert.equal(typeOf("ar2en"), "ar2en");
  assert.equal(typeOf("ar2en@1"), "ar2en");
  assert.equal(answerOf("ar2en"), 0);
  assert.equal(answerOf("ar2en@1"), 1);

  /* Nothing sensible in, nothing sharp out: these read keys off stored
     documents, and a document is somebody's cards. */
  assert.equal(typeOf(""), "");
  assert.equal(answerOf("ar2en@"), 0);
  assert.equal(answerOf("ar2en@nonsense"), 0);
  assert.equal(answerOf("ar2en@-2"), 0);
});

test("everything that looks up an exercise takes a key as readily as a type", () => {
  for (const type of TYPES) {
    const key = keyFor(type, 1);
    assert.equal(levelOf(key), levelOf(type), `${type}: level`);
    assert.equal(isListening(key), isListening(type), `${type}: listening`);
    assert.equal(showsOneAnswer(key), showsOneAnswer(type), `${type}: the rule`);
    const one = must(exOf(key, LANGUAGES["ar-PS"]), `${type}: wording`);
    assert.equal(one.instruction, must(exOf(type, LANGUAGES["ar-PS"]), type).instruction);
  }
  /* An unknown key is the bottom of the ladder, like an unknown type: a
     stored session naming a retired exercise still resolves. */
  assert.equal(levelOf("gone@3"), 1);
  assert.equal(exOf("gone@3", LANGUAGES["ar-PS"]), null);
});

test("a card with one answer is scheduled exactly as it always was", () => {
  const one = { ar: "kitaab", lat: "kitaab", en: "book" };
  for (const type of TYPES) assert.deepEqual(keysFor(one, type), [type], type);
  /* And a card with nothing written for the word at all. */
  assert.deepEqual(keysFor({ ar: "", en: "book" }, "ar2en"), ["ar2en"]);
  assert.deepEqual(keysFor(null, "ar2en"), ["ar2en"]);
});

test("a card with two answers carries a schedule for each, where it shows one", () => {
  const two = { ar: "kitaab / safar", lat: "kitaab / safar", en: "book" };

  /* Reading the word, telling it apart, hearing it: two questions, two
     schedules. */
  assert.deepEqual(keysFor(two, "ar2en"), ["ar2en", "ar2en@1"]);
  assert.deepEqual(keysFor(two, "ar2pick"), ["ar2pick", "ar2pick@1"]);
  assert.deepEqual(keysFor(two, "match"), ["match", "match@1"]);

  /* Writing it from its meaning is one question, because either spelling
     answers it — so one schedule, and no suffix anywhere. */
  assert.deepEqual(keysFor(two, "en2ar"), ["en2ar"]);
  assert.deepEqual(keysFor(two, "ctx2ar"), ["ctx2ar"]);

  /* Which is exactly the rule from further up this file, applied. */
  for (const type of TYPES) {
    assert.equal(
      keysFor(two, type).length > 1,
      showsOneAnswer(type),
      `${type} splits when and only when it shows one answer`,
    );
  }
});

test("the ladder reads a key the way it read a type", () => {
  /* The second answer climbs its own ladder: right twice running at level
     one on the first spelling does not open the level above on the
     second. */
  const done = { phase: "review", interval: 30, hist: [1, 1] };
  const keys = ["ar2en", "ar2en@1", "en2ar"];
  /** @type {Record<string, any>} */
  const states = { ar2en: done };
  const open = openTypes(keys, (k) => states[k]);
  /* Level 1 is open for both spellings — nothing below it to reach — and
     level 4 is shut, because the second spelling has not been read yet. */
  assert.deepEqual(open, ["ar2en", "ar2en@1"]);

  states["ar2en@1"] = done;
  assert.deepEqual(openTypes(keys, (k) => states[k]), ["ar2en", "ar2en@1", "en2ar"]);
});

test("a picture chosen is right when it is one of the card's pictures", () => {
  const item = { ar: "فنجان", en: "cup", lat: "finjaan", images: ["a".repeat(64), "b".repeat(64)] };
  const s = { language: "ar-PS" };
  assert.equal(checkAnswer("a".repeat(64), item, "rec2img", s).ok, true);
  assert.equal(checkAnswer("b".repeat(64), item, "rec2img", s).ok, true, "any of its pictures");
  assert.equal(checkAnswer("c".repeat(64), item, "rec2img", s).ok, false, "another card's");
  assert.equal(checkAnswer("", item, "rec2img", s).ok, false, "nothing chosen");
});
