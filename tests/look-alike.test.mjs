// @ts-check
/*
 * Every answer on a screen looks like it could be the right one.
 *
 * A question offering a few answers, or a grid of pairs, is only a
 * question while its answers cannot be told apart by their shape. A
 * number beside three words, or a sentence beside three single words, is
 * chosen by somebody who knows none of them — the fault a learner
 * reported. So this deals sessions from a collection of every shape at
 * once and holds each screen to one shape, and holds a number's wrong
 * answers to the numbers worth confusing with it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

/* Seeded before the trainer is imported, as every session test is. */
let rolling = 20261009 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".look-alike-build");
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { buildSession, installIndexes, pickChoices, resolveQuestion, shapeOfUnit } = await import(path.join(out, "trainer.js"));
const { generate } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { EX, TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));
const { PICK_OPTIONS } = await import(path.join(here, "..", "src", "chance.ts"));
const { confusablesOf } = await import(path.join(here, "..", "src", "numbers", "range.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
const SYS = load("ar-PS.numbers.json").system;
const TIME = load("ar-PS.times.json").system;
const SETS = [{ numbers: SYS, times: TIME }];
const settings = { language: "ar-PS" };
const NOW = Date.now();
const DAY = 86400000;

/* ---- material: every shape at once ---- */

/** @param {string} id @param {string} kind @param {string} ar @param {string} en */
const card = (id, kind, ar, en) => ({
  id, tags: ["Deck"], created: 1, lang: "ar-PS", kind,
  forms: [{ id, ar, en, lat: id, lang: "ar-PS", s: {} }],
});
const WORDS = Array.from({ length: 20 }, (_, i) => card(`w${i}`, "word", `كلمة${i}`, `word${i}`));
const PHRASES = Array.from({ length: 6 }, (_, i) => card(`p${i}`, "phrase", `جملة ${i}`, `short phrase ${i}`));
/* Two sentences: one too few to stand beside each other in anything. */
const SENTENCES = [
  card("s0", "sentence", "وين المحطة لو سمحت؟", "Where is the station, please?"),
  card("s1", "sentence", "بدي أروح عالبيت هلأ.", "I want to go home now."),
];
const NUMBERS = generate({ composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME, now: 1 }).items;
const MATERIAL = [...WORDS, ...PHRASES, ...SENTENCES, ...NUMBERS];

/** Everything climbed and due, so every level is open and dealt. */
const solid = () => ({ ...freshState(), phase: "review", interval: 4, due: NOW - DAY, reps: 2, right: 2, hist: [1, 1], updated: NOW - 5 * DAY });
const climbed = (/** @type {any[]} */ items) =>
  items.map((it) => ({
    ...it,
    forms: (it.forms || []).map((/** @type {any} */ f) => ({ ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, solid()])) })),
  }));

const ITEMS = climbed(MATERIAL);
installIndexes(ITEMS, settings, SETS);

/** Every form the learner holds but this one: what a question may draw from. */
const others = (/** @type {any} */ unit) =>
  ITEMS.flatMap((it) => (it.forms || []).filter((/** @type {any} */ f) => f.ar && f.en && f.id !== unit.id));

const CHOICE = TYPES.filter((/** @type {string} */ t) => EX[t].picks === "meaning" || EX[t].picks === "word");

/** Many sessions' questions, since which come up is drawn. */
const dealt = (/** @type {number} */ rounds) => {
  const all = [];
  for (let i = 0; i < rounds; i += 1) {
    all.push(...buildSession({ items: ITEMS, settings, inDeck: () => true, systems: SETS }).exercises);
  }
  return all;
};
const QUESTIONS = dealt(30);

/* ---- grids ---- */

test("every grid dealt stands one shape beside itself", () => {
  const grids = QUESTIONS.filter((q) => q.mates && q.mates.length);
  assert.ok(grids.length > 0, "no grid was dealt to look at");
  for (const q of grids) {
    const units = [q, ...q.mates].map((m) => resolveQuestion(ITEMS, { ...m, type: q.type }, false, SETS));
    const shapes = new Set(units.map((r) => shapeOfUnit(r && r.unit)));
    assert.equal(shapes.size, 1, `a grid of ${[...shapes].join(" and ")}: ${units.map((r) => r && r.unit.ar).join(" / ")}`);
  }
});

/* ---- choices ---- */

test("a card with too few of its own shape is never asked to be chosen among others", () => {
  /* Two sentences: either one has a single other sentence beside it, and
     three single words beside a sentence would give it away. */
  const onSentences = QUESTIONS.filter((q) => CHOICE.includes(q.type) && SENTENCES.some((c) => c.id === q.id));
  assert.deepEqual(onSentences.map((q) => `${q.id} ${q.type}`), []);
  const inGrids = QUESTIONS.filter((q) => EX[q.type].picks === "pair" && [q.id, ...(q.mates || []).map((/** @type {any} */ m) => m.id)].some((id) => SENTENCES.some((c) => c.id === id)));
  assert.deepEqual(inGrids.map((q) => `${q.id} ${q.type}`), [], "nor stood in a grid");
});

test("every choice question dealt puts up four answers of one shape", () => {
  const asked = QUESTIONS.filter((q) => CHOICE.includes(q.type));
  assert.ok(asked.length > 0, "no choice question was dealt to look at");
  for (const q of asked) {
    const r = resolveQuestion(ITEMS, q, false, SETS);
    if (!r) continue;
    const picks = EX[q.type].picks;
    const got = pickChoices({ item: r.unit, parentItem: r.parent, picks, pool: others(r.unit), seed: `${q.id} ${q.type}`, systems: SETS });
    const shown = /** @type {string[]} */ (got.map((/** @type {any} */ w) => (picks === "meaning" ? w.en : w.ar)));
    assert.equal(got.length, PICK_OPTIONS, `${q.type} on ${r.unit.ar}: ${shown.join(" / ")}`);
    const made = got.filter((/** @type {any} */ w) => String(w.id).startsWith("near:"));
    const shapes = new Set(got.filter((/** @type {any} */ w) => !made.includes(w)).map(shapeOfUnit));
    if (made.length) shapes.add("number");
    assert.equal(shapes.size, 1, `${q.type} on ${r.unit.ar}: ${shown.join(" / ")}`);
  }
});

/* ---- numbers ---- */

const formOf = (/** @type {string} */ slot) => {
  const it = ITEMS.find((i) => i.id === `sys:${SYS.id}:${slot}`);
  return { it, unit: it.forms[0] };
};

test("a number's meaning is chosen from numbers worth confusing with it", () => {
  const { it, unit } = formOf("unit.5");
  const got = pickChoices({ item: unit, parentItem: it, picks: "meaning", pool: others(unit), seed: "s", systems: SETS });
  const shown = /** @type {string[]} */ (got.map((/** @type {any} */ w) => w.en));
  assert.equal(got.length, PICK_OPTIONS);
  assert.ok(shown.includes("5"));
  const near = confusablesOf(5).map(String);
  for (const t of shown.filter((t) => t !== "5")) assert.ok(near.includes(t), `${t} is not a number worth confusing with 5: ${shown.join(" / ")}`);
});

test("and a number's word from the words for those numbers, said as briefly", () => {
  const { it, unit } = formOf("ten.40");
  const got = pickChoices({ item: unit, parentItem: it, picks: "word", pool: others(unit), seed: "s", systems: SETS });
  const shown = /** @type {string[]} */ (got.map((/** @type {any} */ w) => w.ar));
  assert.equal(got.length, PICK_OPTIONS, shown.join(" / "));
  assert.ok(shown.includes(unit.ar));
  /* Forty is one word, so nothing said in three — forty-one — stands
     beside it. */
  for (const t of shown) assert.ok(!/\s/.test(t), `${t} is longer than ${unit.ar}: ${shown.join(" / ")}`);
  assert.ok(!shown.some((t) => WORDS.some((c) => c.forms[0].ar === t)), "and no word that is not a number");
});

test("a number written in thousands is offered numbers written the same way", () => {
  const { it, unit } = formOf("thousand.1");
  const got = pickChoices({ item: unit, parentItem: it, picks: "meaning", pool: others(unit), seed: "s", systems: SETS });
  const shown = /** @type {string[]} */ (got.map((/** @type {any} */ w) => w.en));
  assert.ok(shown.includes("1,000"));
  assert.ok(shown.includes("10,000") || shown.some((t) => !/,/.test(t) && Number(t) < 1000), shown.join(" / "));
  assert.ok(!shown.includes("10000"), "never a big number without its commas beside one with them");
});
