// @ts-check
/*
 * How soon a deck could be learnt.
 *
 * The forecast is the app's own rules played forward — buildSession deals,
 * gradeInto marks, the Progress screen's own test says when a card is
 * learnt — so these tests hold what the forecast adds on top of them: that
 * more practice is never later, that the earliest date is a floor under
 * every pace, that a finished deck is said to be finished, and that the
 * app's question indexes are put back after every slice of work.
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
  deckForecast,
  earliestForecast,
  installIndexes,
  setOfflineNow,
  setAudibleClips,
  paceWords,
  forecastWords,
  marksForAnswer,
} = await import(path.join(out, "trainer.js"));
const { TYPES } = await import(path.join(here, "..", "src", "languages.ts"));

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

/** Run a forecast to its answer, counting the slices and the restores. */
function answer(/** @type {any} */ run) {
  let slices = 0;
  while (!run.step(200)) slices += 1;
  return { at: run.result(), slices: slices + 1 };
}

test("more practice is never a later date", () => {
  let restores = 0;
  const restore = () => {
    restores += 1;
    installIndexes(collection, settings);
  };
  restore();
  const at = (/** @type {number} */ sessionsPerDay) =>
    answer(deckForecast({ collection, deckOf, settings, sessionsPerDay, from: FROM, restore })).at;
  const once = at(1);
  const thrice = at(3);
  const often = at(12);
  console.log(
    `    twelve-card deck: one a day ${((once - FROM) / DAY).toFixed(1)} days, ` +
      `three ${((thrice - FROM) / DAY).toFixed(1)}, twelve ${((often - FROM) / DAY).toFixed(1)}`,
  );
  assert.ok(once !== null && thrice !== null && often !== null, "a forecast never finished");
  assert.ok(thrice <= once, "three sittings a day finished later than one");
  assert.ok(often <= thrice, "twelve sittings a day finished later than three");
  assert.ok(once > FROM, "a deck of strangers was learnt at once");
  assert.ok(restores > 1, "the indexes were never put back");
});

test("the earliest date is a floor under every pace", () => {
  const restore = () => installIndexes(collection, settings);
  restore();
  const floor = answer(earliestForecast({ collection, deckOf, settings, from: FROM, restore })).at;
  const keen = answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: 12, from: FROM, restore })).at;
  assert.ok(floor !== null, "the earliest date never came");
  assert.ok(floor <= keen, "twelve sittings a day beat the earliest possible date");
  /* And it is a real wait, not an instant: a word needs reviews on later
     days before it counts as learnt, whatever the practice. */
  assert.ok(floor - FROM >= 2 * DAY, `learnt ${((floor - FROM) / DAY).toFixed(1)} days out`);
});

test("every slice of work puts the app's indexes back before it returns", () => {
  let depth = 0;
  let lastWasRestore = false;
  const restore = () => {
    depth += 1;
    lastWasRestore = true;
    installIndexes(collection, settings);
  };
  restore();
  const run = deckForecast({ collection, deckOf, settings, sessionsPerDay: 2, from: FROM, restore });
  let slices = 0;
  for (;;) {
    lastWasRestore = false;
    const done = run.step(5);
    slices += 1;
    assert.ok(lastWasRestore, `slice ${slices} returned with the forecast's indexes still installed`);
    if (done) break;
  }
  assert.ok(depth >= slices);
});

test("a deck already learnt is said to be learnt now", () => {
  const learntState = {
    phase: "review", step: 0, ease: 2.5, interval: 60, due: FROM + 30 * DAY, reps: 8, right: 8, wrong: 0,
    lapses: 0, skips: 0, near: 0, hints: 0, updated: FROM - DAY, hist: [], passes: 2,
  };
  const done = collection.map((it) =>
    deckOf(it)
      ? { ...it, forms: [{ ...it.forms[0], s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, { ...learntState }])) }] }
      : it,
  );
  const restore = () => installIndexes(done, settings);
  restore();
  const got = answer(deckForecast({ collection: done, deckOf, settings, sessionsPerDay: 1, from: FROM, restore }));
  assert.equal(got.at, FROM);
});

test("no practice at all is no pace, rather than a date", () => {
  const restore = () => installIndexes(collection, settings);
  const got = answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: 0, from: FROM, restore }));
  assert.equal(got.at, null);
});

test("the pace is said as sittings a day, to a decimal under one", () => {
  assert.equal(paceWords(18 * 12), "about 12 sessions a day");
  assert.equal(paceWords(18), "about 1 session a day");
  assert.equal(paceWords(9), "about 0.5 sessions a day");
  assert.equal(paceWords(1), "about 0.1 sessions a day");
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
