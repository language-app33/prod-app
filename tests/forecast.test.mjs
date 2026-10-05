// @ts-check
/*
 * How soon some cards could be learnt, and prep mode.
 *
 * Since 0.287 the estimates are simple arithmetic over where the cards
 * stand (workloadOf) rather than the rules played forward. These tests hold
 * the arithmetic to what it promises — work counted off a card's own ladder,
 * more practice never later, the calendar floor, a finished deck finished —
 * and say nothing about whether it matches the rules: keeping it in step
 * with them is by hand, as the note over workloadOf says.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".forecast-build");

await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});

const {
  workloadOf,
  learntAtPace,
  earliestOf,
  readyFor,
  LEARN_DAYS,
  CLEAR_DAYS,
  PROGRESS_SHARE,
  installIndexes,
  setOfflineNow,
  setAudibleClips,
  paceWords,
  forecastWords,
  leastWords,
  marksForAnswer,
  readyWords,
  prepToday,
  tallyAnswer,
  prepGlance,
  prepOf,
  prepStart,
  prepDaysLeft,
  prepStatus,
  prepDeckOf,
  buildSession,
} = await import(path.join(out, "trainer.js"));
const { TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { FRONT_DOOR_CAP, PASSES_TO_LEARN } = await import(path.join(here, "..", "src", "scheduler.ts"));

setOfflineNow(false);
setAudibleClips(null);

const settings = { language: "ar-PS" };
const DAY = 86400000;
const FROM = new Date(2026, 9, 1, 9, 0, 0).getTime();

/** @param {number} i @param {string} deck */
const word = (i, deck) => ({
  id: `w${i}`,
  tags: [deck],
  created: 1,
  lang: "ar-PS",
  kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS", s: {} }],
});

/* Sixty words, twelve of them the deck. */
const collection = Array.from({ length: 60 }, (_, i) => word(i + 1, i < 12 ? "deck" : "other"));
const deckOf = (/** @type {any} */ it) => (it.tags || []).includes("deck");

const deck = () => collection.filter(deckOf);
const learntState = {
  phase: "review", step: 0, ease: 2.5, interval: 60, due: FROM + 30 * DAY, reps: 8, right: 8, wrong: 0,
  lapses: 0, skips: 0, near: 0, hints: 0, updated: FROM - DAY, hist: [], passes: 2,
};
const withStates = (/** @type {any} */ it, /** @type {any} */ state) => ({
  ...it,
  forms: [{ ...it.forms[0], s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, { ...state }])) }],
});

test("the work is counted off each card's own ladder", () => {
  installIndexes(collection, settings);
  const one = workloadOf([deck()[0]], settings, FROM);
  const all = workloadOf(deck(), settings, FROM);
  assert.equal(all.left, 12);
  assert.ok(one.questions > 0, "a card never met needs nothing");
  assert.equal(all.questions, 12 * one.questions, "twelve like cards are twelve times one");
  /* Two right answers for every question on its ladder, and a pass on each
     question at the top — so at least twice as many as the passes. */
  assert.ok(one.questions >= 2 * PASSES_TO_LEARN, `${one.questions} questions`);
  assert.equal(all.sessions, all.questions / (18 * PROGRESS_SHARE));
});

test("a card part way up needs less than one never met", () => {
  installIndexes(collection, settings);
  const fresh = workloadOf([deck()[0]], settings, FROM);
  const rightOnce = { ...learntState, phase: "learning", interval: 0, passes: 0, hist: [1], due: FROM };
  const partway = workloadOf([withStates(deck()[0], rightOnce)], settings, FROM);
  assert.ok(partway.questions < fresh.questions, `${partway.questions} against ${fresh.questions}`);
});

test("a learnt deck needs nothing, and is learnt now", () => {
  installIndexes(collection, settings);
  const done = deck().map((it) => withStates(it, learntState));
  const w = workloadOf(done, settings, FROM);
  assert.deepEqual(w, { left: 0, questions: 0, sessions: 0, earliestDays: 0 });
  assert.equal(learntAtPace(w, 1, FROM), FROM);
  assert.deepEqual(readyFor(w, FROM + 10 * DAY, FROM), { kind: "already" });
});

test("new words come in ten at a time, so a big deck has a later floor", () => {
  installIndexes(collection, settings);
  assert.equal(workloadOf(deck(), settings, FROM).earliestDays, LEARN_DAYS + Math.ceil(12 / FRONT_DOOR_CAP) - 1);
  assert.equal(workloadOf(collection.slice(0, 40), settings, FROM).earliestDays, LEARN_DAYS + 3);
  assert.equal(workloadOf(deck().slice(0, 5), settings, FROM).earliestDays, LEARN_DAYS);
});

test("more practice is never a later date, and never earlier than the floor", () => {
  installIndexes(collection, settings);
  const w = workloadOf(deck(), settings, FROM);
  const at = (/** @type {number} */ n) => /** @type {number} */ (learntAtPace(w, n, FROM));
  assert.ok(at(1) >= at(3) && at(3) >= at(12) && at(12) >= at(100));
  assert.equal(at(1000), earliestOf(w, FROM).at, "past enough practice, the floor is the date");
  assert.equal(learntAtPace(w, 0, FROM), null, "no practice is no date");
});

test("being ready by a date: the work spread over the days, or too soon", () => {
  installIndexes(collection, settings);
  const w = workloadOf(deck(), settings, FROM);
  const roomy = readyFor(w, FROM + 40 * DAY, FROM);
  assert.equal(roomy.kind, "rate");
  if (roomy.kind === "rate") assert.ok(Math.abs(roomy.rate - w.sessions / 40) < 1e-9);
  const tight = readyFor(w, FROM + 2 * DAY, FROM);
  assert.equal(tight.kind, "late");
  if (tight.kind === "late") assert.equal(tight.earliest, earliestOf(w, FROM).at);
});

test("the pace is said as sittings a day, to a decimal under one", () => {
  assert.equal(paceWords(18 * 12), "about 12 sessions a day");
  assert.equal(paceWords(18), "about 1 session a day");
  assert.equal(paceWords(9), "about 0.5 sessions a day");
  assert.equal(paceWords(1), "about 0.1 sessions a day");
});

test("the least practice is said rounded up, so the pace named gets there", () => {
  assert.equal(leastWords(19.2), "About 20 sessions a day");
  assert.equal(leastWords(2), "About 2 sessions a day");
  assert.equal(leastWords(1), "About 1 session a day");
  assert.equal(leastWords(0.43), "About 0.5 sessions a day");
  assert.equal(leastWords(0.01), "About 0.1 sessions a day");
});

test("a forecast date says how far off it is", () => {
  assert.match(forecastWords(FROM + 5 * DAY, FROM), /\(in 5 days\)$/);
  assert.match(forecastWords(FROM + 3600000, FROM), /\(today\)$/);
  assert.match(forecastWords(FROM + DAY, FROM), /\(tomorrow\)$/);
  assert.equal(forecastWords(null, FROM), "more than two years away");
});

test("an answer is marked by the one function the question screen uses", () => {
  /* The forecast marks what marksForAnswer says a real answer marks, so a
     change to what an answer counts for reaches the dates too. A grid is a
     question about every word in it. */
  const [a, b, c] = collection;
  const exercise = { id: a.id, subId: null, type: "match", mates: [{ id: b.id, subId: null }, { id: c.id, subId: null }] };
  const marks = marksForAnswer({
    exercise,
    item: a.forms[0],
    parentItem: a,
    asking: collection,
    settings,
    systems: [],
    correct: true,
    rating: "good",
    practice: false,
    grid: [a, b, c].map((it) => ({ unit: it.forms[0], right: true })),
  });
  assert.deepEqual(marks.map((/** @type {any} */ m) => m.id).sort(), [a.id, b.id, c.id].sort());
  assert.ok(marks.every((/** @type {any} */ m) => m.correct), "a right grid marked a word wrong");
});

/* ------------------------------------------------------------------
   Prep mode
   ------------------------------------------------------------------ */

test("a prep is read only when it is whole", () => {
  assert.equal(prepOf({}), null);
  assert.equal(prepOf({ prep: { name: "", date: "2026-10-20", decks: ["deck"] } }), null, "no name");
  assert.equal(prepOf({ prep: { name: "Exam", date: "20/10/2026", decks: ["deck"] } }), null, "a date not from a date input");
  assert.equal(prepOf({ prep: { name: "Exam", date: "2026-10-20", decks: [] } }), null, "no decks");
  assert.deepEqual(prepOf({ prep: { name: " Exam ", date: "2026-10-20", decks: ["deck"] } }), {
    name: "Exam",
    date: "2026-10-20",
    decks: ["deck"],
  });
});

test("a prep's deadline is the start of its day, and its days are counted to it", () => {
  assert.equal(prepStart("2026-10-20"), new Date(2026, 9, 20).getTime());
  assert.equal(prepDaysLeft("2026-10-02", FROM), 1, "tomorrow is a day away");
  assert.equal(prepDaysLeft("2026-10-11", FROM), 10);
});

test("a prep is active until its day, done once its decks are learnt", () => {
  const prep = { name: "Exam", date: "2026-10-20", decks: ["deck"] };
  installIndexes(collection, settings);
  assert.equal(prepStatus(prep, collection, settings, FROM), "active");
  assert.equal(prepStatus(prep, collection, settings, prepStart("2026-10-20")), "past", "its day has come");
  assert.equal(prepStatus({ ...prep, decks: ["nowhere"] }, collection, settings, FROM), "empty");
});

test("a prep session is dealt from the prep's decks alone", () => {
  installIndexes(collection, settings);
  const built = buildSession({ items: collection, settings, inDeck: prepDeckOf(["deck"]) });
  assert.ok(built.exercises.length > 0, "nothing dealt");
  for (const ex of built.exercises) {
    assert.ok(deckOf(collection.find((/** @type {any} */ c) => c.id === ex.id)), `${ex.id} is not in the prep's decks`);
  }
});

test("what a prep's forecast says", () => {
  const date = "2026-10-20";
  assert.match(readyWords({ kind: "already" }, date, 0), /already learnt/);
  assert.match(readyWords({ kind: "rate", rate: 5.2 }, date, 36), /^About 6 sessions a day will get you ready before .+\. You're doing about 2 sessions a day at the moment\.$/);
  assert.match(readyWords({ kind: "rate", rate: 5.2 }, date, 0), /^About 6 sessions a day will get you ready before [^.]+\.$/);
  assert.match(readyWords({ kind: "late", earliest: FROM + 30 * DAY }, date, 0), /can't be fully ready before .+ the earliest is/);
});

test("the home screen's prep tile says whether the pace gets you there", () => {
  const on = prepGlance(12, { kind: "rate", rate: 2 }, 54, 0);
  assert.deepEqual([on.days, on.tone, on.status, on.detail], [12, "good", "On track", ""]);
  const more = prepGlance(12, { kind: "rate", rate: 5.2 }, 36, 0);
  assert.deepEqual([more.tone, more.status], ["push", ""]);
  assert.equal(more.detail, "About 6 sessions a day will get you ready");
  assert.equal(prepGlance(1, { kind: "rate", rate: 0.4 }, 0, 0).detail, "About 0.4 sessions a day will get you ready");
  const late = prepGlance(3, { kind: "late", earliest: FROM + 6 * DAY }, 36, 0);
  assert.deepEqual([late.tone, late.status], ["late", "Too soon"]);
  assert.match(late.detail, /^Too soon to learn it all — the earliest you could be ready is .+\(in \d+ days\)$/);
  assert.match(prepGlance(3, { kind: "late", earliest: null }, 0, 0).detail, /more than two years$/);
  /* The line says the same figure as today's goal, made this morning: 13
     sessions done of 30 days' worth leave the live rate at 13, and both
     say 14 — the rate before today's work, rounded up. */
  const midday = prepGlance(30, { kind: "rate", rate: 13 }, 0, 13 * 18);
  assert.deepEqual([midday.done, midday.goal], [13, 14]);
  assert.match(midday.detail, /^About 14 sessions a day will get you ready/);
  const all = prepGlance(5, { kind: "already" }, 36, 0);
  assert.deepEqual([all.days, all.tone, all.status, all.detail], [5, "good", "All learnt", ""]);
});

test("only a question on a prep card counts towards the prep, whatever session asked it", () => {
  /* The goal is counted off the prep's cards, so today's sessions are
     too: a question on another deck is practice, and fills the log, but
     moves the prep nowhere and so does not fill its count. */
  const inPrep = prepDeckOf(["Lesson 1", "Lesson 2"]);
  const lesson = { id: "a", tags: ["Lesson 2"] };
  const other = { id: "b", tags: ["Holiday words"] };
  assert.equal(inPrep(/** @type {any} */ (lesson)), true);
  assert.equal(inPrep(/** @type {any} */ (other)), false);

  const day = "2026-10-02";
  let doc = { log: { [day]: 5 }, prepLog: { [day]: 3 } };
  doc = { ...doc, ...tallyAnswer(doc, day, inPrep(/** @type {any} */ (lesson))) };
  assert.deepEqual([doc.log[day], doc.prepLog[day]], [6, 4], "a prep card: both counts");
  doc = { ...doc, ...tallyAnswer(doc, day, inPrep(/** @type {any} */ (other))) };
  assert.deepEqual([doc.log[day], doc.prepLog[day]], [7, 4], "another deck: the log alone");
  /* A document from before the count existed starts it at one. */
  const old = tallyAnswer({ log: {} }, day, true);
  assert.deepEqual(old, { log: { [day]: 1 }, prepLog: { [day]: 1 } });
  assert.equal(tallyAnswer({ log: {} }, day, false).prepLog, undefined, "and does not invent one");
});

test("the home screen counts today's sessions against what today needs", () => {
  /* 18 questions to a session. Nothing done: the rate, rounded up. */
  assert.deepEqual(prepToday(10, { kind: "rate", rate: 2.3 }, 0), { done: 0, goal: 3 });
  assert.deepEqual(prepToday(10, { kind: "rate", rate: 2.3 }, 0), { done: 0, goal: 3 });
  /* Two sessions done, and the rate read afterwards has fallen by about
     what they did: the goal stays where it was this morning. */
  assert.deepEqual(prepToday(10, { kind: "rate", rate: 2.1 }, 36), { done: 2, goal: 3 });
  assert.equal(prepGlance(10, { kind: "rate", rate: 2.1 }, 0, 36).goal, 3);
  /* A session half done is not counted yet. */
  assert.equal(prepToday(10, { kind: "rate", rate: 2.1 }, 45).done, 2);
  assert.deepEqual(
    (({ done, goal }) => ({ done, goal }))(prepGlance(10, { kind: "rate", rate: 1.8 }, 0, 54)),
    { done: 3, goal: 3 },
  );
  /* Under a session a day still asks for one today. */
  assert.equal(prepGlance(1, { kind: "rate", rate: 0.4 }, 0, 0).goal, 1);
  /* No rate to keep to: just what was done. */
  assert.equal(prepGlance(3, { kind: "late", earliest: null }, 0, 0).goal, null);
  assert.equal(prepGlance(3, { kind: "late", earliest: null }, 0, 18).done, 1);
});

test("a sentence whose words are not cleared yet starts after them", () => {
  /* A sentence can be asked nothing until the words in its blanks are
     cleared, so its own days to learn start once they are. */
  const frame = {
    id: "f1", tags: ["deck"], created: 1, lang: "ar-PS", kind: "word",
    forms: [{ id: "f1", ar: "{{noun}} كبير", en: "a big {{noun}}", lat: "", lang: "ar-PS", s: {} }],
  };
  const noun = { ...word(99, "deck"), category: "noun" };
  installIndexes([frame, noun], settings);
  assert.equal(workloadOf([frame], settings, FROM).earliestDays, CLEAR_DAYS + LEARN_DAYS);
  const cleared = withStates(noun, { ...learntState, passes: 0, hist: [1, 1] });
  installIndexes([frame, cleared], settings);
  assert.equal(workloadOf([frame], settings, FROM).earliestDays, LEARN_DAYS, "and no later once they are");
});
