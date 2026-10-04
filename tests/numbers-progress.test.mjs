/*
 * Progress on numbers, word by word.
 *
 * Three claims. A number part filed into a deck knows the words it is built
 * from. A part's questions lean towards a word of it the learner has not
 * learnt yet, so every word comes up rather than the ones the number line
 * is thick with. And a part is learnt only once every one of its words is,
 * however its own reviews have gone.
 *
 * Nothing here holds a word of Arabic: the words are the golden system's.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

/* Seeded before the trainer is imported — see numbers-session.test.mjs. */
let rolling = 20261004 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".numbers-progress-build");
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
const { buildSession, installIndexes, cardStandings, partsOf } = await import(path.join(out, "trainer.js"));
const { generate, fileIntoDecks, componentId, isRangeSkill, steeredAsk } = await import(
  path.join(here, "..", "src", "numbers", "generate.ts")
);
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { TYPES, levelOf } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState, standing } = await import(path.join(here, "..", "src", "scheduler.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {any} */
const TIME = load("ar-PS.times.json").system;
const SETS = [{ numbers: SYS, times: TIME }];
const SET = { composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME };
const settings = { language: "ar-PS" };

const generated = generate({ ...SET, tag: "Numbers", now: 1750000000000 });
/* Every part in one deck, the way a teacher's deck brings them. */
const filed = fileIntoDecks(generated.items, SET, [
  { title: "Numbers", parts: generated.items.filter(isRangeSkill).map((/** @type {any} */ it) => it.range.id) },
]);
const PART = "numbers:20-99";
const partId = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === PART), PART).id;
const ninety = componentId(SYS.id, "ten.90");

/** A schedule kept: right twice running, both passes made, next due later. */
const kept = () => ({
  ...freshState(), phase: "review", interval: 30, due: Date.now() + 30 * 86400000,
  reps: 4, right: 4, hist: [1, 1, 1, 1], passes: 2, updated: Date.now() - 86400000,
});

/** Every exercise on a card kept, so the card is learnt. */
const learntCard = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({ ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, kept()])) })),
});

/** The collection with every card learnt but the ones named. */
const allLearntBut = (/** @type {string[]} */ ids) =>
  filed.map((/** @type {any} */ it) => (ids.includes(it.id) ? it : learntCard(it)));

test("a part filed into a deck carries the words it is built from", () => {
  const part = must(filed.find((/** @type {any} */ it) => it.id === partId), PART);
  const parts = new Set(part.parts);
  assert.ok(parts.has(ninety), "20 to 99 does not know it is built with ninety");
  assert.ok(parts.has(componentId(SYS.id, "connector")), "nor with the word that joins");
  assert.ok(parts.has(componentId(SYS.id, "unit.4")), "nor with four");
  /* Every one of them is a card the learner holds. */
  const ids = new Set(filed.map((/** @type {any} */ it) => it.id));
  for (const id of parts) assert.ok(ids.has(id), `${id} is in no card`);
});

test("a question is steered to a number that stands on a word not yet learnt", () => {
  const part = must(filed.find((/** @type {any} */ it) => it.id === partId), PART);
  for (let i = 0; i < 40; i += 1) {
    const ask = must(steeredAsk(part.range, `seed ${i}`, SET, new Set([ninety])), "no asking");
    assert.ok(ask.value >= 90 && ask.value <= 99, `asked ${ask.value} to bring in ninety`);
  }
  /* Nothing waiting, nothing to steer: the ordinary draw stands. */
  assert.equal(steeredAsk(part.range, "seed", SET, new Set()), null);
});

/** A word recognised — its first level right twice running — and no more,
    so it is not learnt yet. */
const recognisedOnly = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f, /** @type {number} */ i) => (i ? f : {
    ...f,
    s: Object.fromEntries(TYPES.filter((/** @type {string} */ t) => levelOf(t) === 1).map((/** @type {string} */ t) => [t, {
      ...freshState(), phase: "review", interval: 4, due: Date.now() - 86400000,
      reps: 2, right: 2, hist: [1, 1], updated: Date.now() - 86400000,
    }])),
  })),
});

test("dealt in a session, every question on the part brings in the word still to learn", () => {
  /* Recognised but not learnt: a number may stand on it, and the part
     leans towards the numbers that do. A word not even recognised is
     another matter — see the test below. */
  const items = allLearntBut([ninety, partId]).map((/** @type {any} */ it) => (it.id === ninety ? recognisedOnly(it) : it));
  installIndexes(items, settings);
  let asked = 0;
  for (let i = 0; i < 6; i += 1) {
    const got = buildSession({ items, settings, inDeck: () => true, systems: SETS, practice: true, includeAll: true });
    for (const ex of got.exercises) {
      if (ex.id !== partId || !ex.ask) continue;
      asked += 1;
      assert.ok(ex.ask.value >= 90 && ex.ask.value <= 99, `asked ${ex.ask.value} while ninety is not learnt`);
    }
  }
  assert.ok(asked > 0, "the part was never dealt");
});

test("a word not yet recognised is never asked inside a number", () => {
  const items = allLearntBut([ninety, partId]);
  installIndexes(items, settings);
  let asked = 0;
  for (let i = 0; i < 6; i += 1) {
    const got = buildSession({ items, settings, inDeck: () => true, systems: SETS, practice: true, includeAll: true });
    for (const ex of got.exercises) {
      if (ex.id !== partId || !ex.ask) continue;
      asked += 1;
      assert.ok(ex.ask.value < 90, `asked ${ex.ask.value} before ninety was recognised`);
    }
  }
  assert.ok(asked > 0, "the part was never dealt, though every other word is learnt");
});

test("a part is learnt only once every word it is built from is", () => {
  const held = allLearntBut([ninety]);
  const part = must(held.find((/** @type {any} */ it) => it.id === partId), PART);
  const at = must(standing(cardStandings(part, settings, held)), "no standing");
  assert.equal(at.status, "cleared", "learnt while ninety is not");
  assert.equal(at.held, 1);
  const words = partsOf(part, held, settings);
  assert.equal(words.filter((/** @type {any} */ p) => p.validated === false).length, 1);

  /* Ninety learnt, and nothing holds it back. */
  const all = allLearntBut([]);
  const done = must(standing(cardStandings(must(all.find((/** @type {any} */ it) => it.id === partId), PART), settings, all)), "no standing");
  assert.equal(done.status, "done");
  /* And read on its own, without the collection, the part is what its own
     ladder says — the one card's line, which cannot see its words. */
  assert.equal(must(standing(cardStandings(part, settings)), "no standing").status, "done");
});
