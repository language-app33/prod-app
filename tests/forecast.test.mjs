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
  leastWords,
  marksForAnswer,
  readyForecast,
  readyWords,
  prepOf,
  prepStart,
  prepDaysLeft,
  prepStatus,
  prepDeckOf,
  buildSession,
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

/** Midnight at the start of a moment's day. */
const dayOf = (/** @type {number} */ t) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

test("the same deck at the same pace gives the same date every time", () => {
  /* A forecast rolls its own dice from a fixed seed. Without that, two
     paces could not be compared — a slower one could win on a lucky shuffle
     — and the date would move each time the screen was opened. */
  const restore = () => installIndexes(collection, settings);
  restore();
  const once = () => answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: 3, from: FROM, restore })).at;
  assert.equal(once(), once());
});

test("the earliest date names the least practice that reaches it, and that practice does", () => {
  const restore = () => installIndexes(collection, settings);
  restore();
  const run = earliestForecast({ collection, deckOf, settings, from: FROM, restore });
  const floor = answer(run).at;
  const least = run.rate();
  console.log(`    earliest: ${((floor - FROM) / DAY).toFixed(1)} days out, at ${leastWords(least)}`);
  assert.ok(floor !== null && least !== null, "no earliest date or no practice named");
  /* Rounded up as it is said, the practice named gets there. */
  const said = least >= 2 ? Math.ceil(least) : Math.ceil(least * 10) / 10;
  const at = answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: said, from: FROM, restore })).at;
  assert.ok(at !== null && dayOf(at) <= dayOf(floor), `${said} a day finished ${at && (at - FROM) / DAY} days out`);
  /* And markedly less does not: the practice named is not a round number
     picked from the top of the search. */
  const less = answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: least / 2, from: FROM, restore })).at;
  assert.ok(less === null || dayOf(less) > dayOf(floor), `half of ${least} a day still finished by the earliest day`);
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

test("being ready by a date says how much practice it takes, or that it cannot be done", () => {
  const restore = () => installIndexes(collection, settings);
  restore();
  const take = (/** @type {number} */ days) => {
    const run = readyForecast({ collection, deckOf, settings, from: FROM, by: FROM + days * DAY, restore });
    while (!run.step(200));
    return run.result();
  };
  const roomy = take(40);
  const tight = take(2);
  console.log(`    twelve-card deck: in 40 days ${JSON.stringify(roomy)}, in 2 days ${JSON.stringify(tight)}`);
  assert.equal(roomy.kind, "rate", "forty days was not enough");
  assert.equal(tight.kind, "late", "two days was enough for a deck of strangers");
  /* And what forty days takes, practised, gets there. */
  if (roomy.kind === "rate") {
    const said = roomy.rate >= 2 ? Math.ceil(roomy.rate) : Math.ceil(roomy.rate * 10) / 10;
    const at = answer(deckForecast({ collection, deckOf, settings, sessionsPerDay: said, from: FROM, restore })).at;
    assert.ok(at !== null && at < FROM + 40 * DAY, `${said} a day was not ready in forty days`);
  }
});

test("what a prep's forecast says", () => {
  const date = "2026-10-20";
  assert.match(readyWords(undefined, date, 0), /Working out/);
  assert.match(readyWords({ kind: "already" }, date, 0), /already learnt/);
  assert.match(readyWords({ kind: "rate", rate: 5.2 }, date, 36), /^About 6 sessions a day will get you ready before .+\. You're doing about 2 sessions a day at the moment\.$/);
  assert.match(readyWords({ kind: "rate", rate: 5.2 }, date, 0), /^About 6 sessions a day will get you ready before [^.]+\.$/);
  assert.match(readyWords({ kind: "late", earliest: FROM + 30 * DAY }, date, 0), /can't be fully ready before .+ the earliest is/);
});
