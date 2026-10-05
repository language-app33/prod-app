/*
 * A number is learnt in the figures its language writes it in.
 *
 * Arabic writes three as ٣, and that is what a learner meets on a price or
 * a bus. So in a language with figures of its own, the top of a number's
 * ladder — where a card's passes are made, and so what "learnt" waits on —
 * asks from those figures alone: ٣ for the word, ٤٧ for a stretch, ٠٧:١٥
 * for the clock. On a key of its own, so a number learnt from 3 before
 * this is asked again from ٣ rather than counted as having been.
 *
 * A language that writes numbers the way English does is untouched.
 *
 * Nothing here holds a word of Arabic: the words are the golden system's.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".numbers-figures-build");
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
const { cardStandings, installIndexes, laddered, marksForAnswer, ownFigures } = await import(path.join(out, "trainer.js"));
const { generate, fileIntoDecks, componentId, isRangeSkill } = await import(
  path.join(here, "..", "src", "numbers", "generate.ts")
);
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { askFor, renderAsk } = await import(path.join(here, "..", "src", "numbers", "range.ts"));
const { LANGUAGES, TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
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
const AR = LANGUAGES["ar-PS"];

const generated = generate({ ...SET, now: 1750000000000, numerals: AR.numerals });
const filed = fileIntoDecks(generated.items, SET, [
  { title: "Numbers", parts: generated.items.filter(isRangeSkill).map((/** @type {any} */ it) => it.range.id) },
]);
const byId = (/** @type {string} */ id) => must(filed.find((/** @type {any} */ it) => it.id === id), id);
const rangeOf = (/** @type {string} */ id) =>
  must(filed.find((/** @type {any} */ it) => it.range && it.range.id === id), id);
const three = byId(componentId(SYS.id, "unit.3"));
const stretch = rangeOf("numbers:20-99");

/** A schedule kept: right every time, both passes made, next due later. */
const kept = () => ({
  ...freshState(), phase: "review", interval: 30, due: Date.now() + 30 * 86400000,
  reps: 4, right: 4, hist: [1, 1, 1, 1], passes: 2, updated: Date.now() - 86400000,
});

/** Every exercise but the ones named kept, on every form of the card. */
const keptBut = (/** @type {any} */ it, /** @type {string[]} */ left) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({
    ...f,
    s: Object.fromEntries(TYPES.filter((/** @type {string} */ t) => !left.includes(t)).map((/** @type {string} */ t) => [t, kept()])),
  })),
});

const statusOf = (/** @type {any} */ it) => must(standing(cardStandings(it, settings)), "no standing").status;

test("Arabic writes a number in its own figures, a clock's too", () => {
  assert.equal(ownFigures(AR, "47"), "٤٧");
  assert.equal(ownFigures(AR, "1000"), "١٬٠٠٠");
  assert.equal(ownFigures(AR, "07:15"), "٠٧:١٥");
  /* A language that writes them the English way has nothing to add. */
  assert.equal(ownFigures(LANGUAGES["he-IL"], "47"), "");
  assert.equal(ownFigures(AR, ""), "");
});

test("a number card is written out from its figures, never from the English ones", () => {
  assert.equal(three.numeral, "٣");
  for (const form of three.forms) {
    assert.equal(form.numeral, "٣", `${form.id} carries no figure to be asked from`);
    const keys = laddered(form, settings);
    assert.ok(keys.includes("own2ar"), `${form.id} is not asked from ٣`);
    assert.ok(!keys.includes("en2ar"), `${form.id} is still asked from 3`);
  }
  /* A word that is not one number keeps the question it always had. */
  const joiner = byId(componentId(SYS.id, "connector"));
  const keys = laddered(joiner.forms[0], settings);
  assert.ok(keys.includes("en2ar") && !keys.includes("own2ar"));
});

test("a time written out by hand is asked from the clock in its own figures", () => {
  const noon = must(
    filed.find((/** @type {any} */ it) => it.source && /^override:\d+:\d+/.test(it.source.slot) && it.source.systemId === TIME.id),
    "no time written out by hand",
  );
  assert.equal(noon.numeral, ownFigures(AR, noon.forms[0].en));
  assert.match(noon.numeral, /^[٠-٩]+:[٠-٩]+$/);
  assert.ok(laddered(noon.forms[0], settings).includes("own2ar"));
});

test("a stretch and the clock are written out from their figures too", () => {
  const keys = laddered(stretch.forms[0], settings);
  assert.ok(keys.includes("own2num") && !keys.includes("fig2num"));
  const clock = must(filed.find((/** @type {any} */ it) => it.range && it.range.kind === "time"), "no clock");
  const times = laddered(clock.forms[0], settings);
  assert.ok(times.includes("own2time") && !times.includes("fig2time"));
});

test("a number learnt from the English figures is not learnt until it is from its own", () => {
  /* Everything it had before this kept, both passes made — and nothing on
     the Arabic figures yet, which is a learner from before this release. */
  assert.notEqual(statusOf(keptBut(three, ["own2ar"])), "done");
  assert.equal(statusOf(keptBut(three, [])), "done");
  assert.notEqual(statusOf(keptBut(stretch, ["own2num"])), "done");
  assert.equal(statusOf(keptBut(stretch, [])), "done");
});

test("answering a number from its figures credits its words on the same question", () => {
  const items = filed.map((/** @type {any} */ it) => keptBut(it, []));
  installIndexes(items, settings, SETS);
  const part = must(items.find((/** @type {any} */ it) => it.id === stretch.id), "no part");
  /* 43: a ten, a unit and the word that joins them. */
  const ask = { ...askFor(part.range, "seed", SYS, arComposer), value: 43 };
  const said = renderAsk(ask, arComposer, SYS, arTimeComposer, TIME);
  const marks = marksForAnswer({
    exercise: { id: part.id, subId: null, type: "own2num", ask },
    item: { ...part.forms[0], ar: said.text, en: said.digits, numeral: ownFigures(AR, said.digits), tokens: said.tokens },
    parentItem: part,
    asking: items,
    settings,
    systems: SETS,
    correct: true,
    rating: "good",
    practice: false,
    grid: null,
  });
  const under = new Map(marks.filter((/** @type {any} */ m) => m.under).map((/** @type {any} */ m) => [m.id, m.under]));
  assert.equal(under.get(componentId(SYS.id, "unit.3")), "own2ar", "three is read as ٣");
  assert.equal(under.get(componentId(SYS.id, "ten.40")), "own2ar", "forty is read as ٤٠");
  assert.equal(under.get(componentId(SYS.id, "connector")), "en2ar", "the joining word has no figure of its own");
});

test("a language that writes numbers the English way is untouched", () => {
  const plain = generate({ ...SET, now: 1750000000000 });
  for (const it of plain.items) {
    assert.equal(it.numeral, undefined);
    for (const form of it.forms) {
      assert.equal(form.numeral, undefined);
      assert.equal(form.rangeFigures, undefined);
    }
  }
});
