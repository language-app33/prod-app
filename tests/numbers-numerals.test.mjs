/*
 * The ten figures a language writes its numbers in, and writing in them.
 *
 * Arabic writes three as ٣, in Eastern Arabic numerals, and a learner has
 * to read them and write them both. So a number system in such a language
 * brings ten cards, ٠ to ٩, each read first (٤ → 4) and written after
 * (4 → ٤). Once those are cleared, every stretch of the numbers and the
 * clock is asked to write in them too — 47 → ٤٧, and the number in words
 * → ٤٧ — and none of it is learnt until the ten are.
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
const out = path.join(here, ".numbers-numerals-build");
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
const { cardStandings, climbOf, installIndexes, laddered, numeralsKnownOf } = await import(path.join(out, "trainer.js"));
const { generate, fileIntoDecks, isRangeSkill, isNumeralCard, numeralId } = await import(
  path.join(here, "..", "src", "numbers", "generate.ts")
);
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { LANGUAGES, TYPES, EX, checkAnswer, exOf } = await import(path.join(here, "..", "src", "languages.ts"));
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
const rangeOf = (/** @type {string} */ id) =>
  must(filed.find((/** @type {any} */ it) => it.range && it.range.id === id), id);
const clockOf = () => must(filed.find((/** @type {any} */ it) => it.range && it.range.kind === "time"), "no clock");

/** A schedule kept: right every time, both passes made, next due later. */
const kept = () => ({
  ...freshState(), phase: "review", interval: 30, due: Date.now() + 30 * 86400000,
  reps: 4, right: 4, hist: [1, 1, 1, 1], passes: 2, updated: Date.now() - 86400000,
});

/** Every exercise kept on every form of the card, but the ones named. */
const keptBut = (/** @type {any} */ it, /** @type {string[]} */ left = []) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({
    ...f,
    s: Object.fromEntries(TYPES.filter((/** @type {string} */ t) => !left.includes(t)).map((/** @type {string} */ t) => [t, kept()])),
  })),
});

/** The collection with every card kept, and the figure cards as `figures` says. */
const collection = (/** @type {(it: any) => any} */ figures) =>
  filed.map((/** @type {any} */ it) => (isNumeralCard(it) ? figures(it) : keptBut(it)));

const statusOf = (/** @type {any} */ it, /** @type {any[]} */ among) =>
  must(standing(cardStandings(it, settings, among)), "no standing");

test("Arabic brings a card for each of its ten figures, and nothing else does", () => {
  const figures = generated.items.filter(isNumeralCard);
  assert.equal(figures.length, 10);
  const four = must(figures.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, 4)), "no four");
  assert.equal(four.numeral, AR.numerals(4));
  assert.equal(four.forms[0].en, "4");
  assert.equal(four.forms[0].ar, "", "a figure has no word to be asked");
  /* Filed wherever the system's parts are. */
  assert.ok(filed.filter(isNumeralCard).every((/** @type {any} */ it) => it.tags.includes("Numbers")));
  /* A language writing numbers the English way has none. */
  const plain = generate({ ...SET, now: 1750000000000 });
  assert.equal(plain.items.filter(isNumeralCard).length, 0);
});

test("a figure is read first and written after, and asked nothing else", () => {
  installIndexes(collection((it) => it), settings, SETS);
  const four = must(filed.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, 4)), "no four");
  assert.deepEqual(laddered(four.forms[0], settings), ["dig2fig", "fig2dig"]);
  assert.equal(EX.dig2fig.level, 1);
  assert.equal(EX.fig2dig.level, 3);
});

test("a stretch is asked to write in the figures only once the ten are cleared", () => {
  const stretch = rangeOf("numbers:20-99");
  /* Not one figure answered: the questions that write in them are not on
     the ladder, so the stretch is not held back by figures never met. */
  const fresh = collection((it) => it);
  installIndexes(fresh, settings, SETS);
  assert.equal(numeralsKnownOf(fresh, settings).get(SYS.id), false);
  let keys = laddered(fresh.find((/** @type {any} */ it) => it.id === stretch.id).forms[0], settings);
  assert.ok(!keys.includes("fig2own") && !keys.includes("ar2own"), keys.join(" "));
  let clock = laddered(fresh.find((/** @type {any} */ it) => it.id === clockOf().id).forms[0], settings);
  assert.ok(!clock.includes("clock2own") && !clock.includes("time2own"), clock.join(" "));

  /* All ten cleared: both questions join the stretch, and the clock's. */
  const known = collection((it) => keptBut(it));
  installIndexes(known, settings, SETS);
  assert.equal(numeralsKnownOf(known, settings).get(SYS.id), true);
  keys = laddered(known.find((/** @type {any} */ it) => it.id === stretch.id).forms[0], settings);
  assert.ok(keys.includes("fig2own") && keys.includes("ar2own"), keys.join(" "));
  clock = laddered(known.find((/** @type {any} */ it) => it.id === clockOf().id).forms[0], settings);
  assert.ok(clock.includes("clock2own") && clock.includes("time2own"), clock.join(" "));

  /* One figure slipping back off cleared takes them away again. */
  const slipped = collection((it) => (it.id === numeralId(SYS.id, 6) ? keptBut(it, ["fig2dig"]) : keptBut(it)));
  installIndexes(slipped, settings, SETS);
  keys = laddered(slipped.find((/** @type {any} */ it) => it.id === stretch.id).forms[0], settings);
  assert.ok(!keys.includes("fig2own"), keys.join(" "));
});

test("a number is not learnt until the ten figures are, and the screen says which are left", () => {
  const stretch = rangeOf("numbers:20-99");
  /* Every word and every question on the stretch kept, and three of the
     figures not yet written. */
  const three = [numeralId(SYS.id, 2), numeralId(SYS.id, 5), numeralId(SYS.id, 8)];
  const waiting = collection((it) => (three.includes(it.id) ? keptBut(it, ["fig2dig"]) : keptBut(it)));
  installIndexes(waiting, settings, SETS);
  const at = statusOf(waiting.find((/** @type {any} */ it) => it.id === stretch.id), waiting);
  assert.equal(at.status, "cleared");
  assert.equal(at.heldFigures, 3);
  /* And the deck it is in is short of a hundred for it. */
  assert.ok(climbOf(waiting, settings, waiting).pct < 100);

  const all = collection((it) => keptBut(it));
  installIndexes(all, settings, SETS);
  assert.equal(statusOf(all.find((/** @type {any} */ it) => it.id === stretch.id), all).status, "done");
  assert.equal(climbOf(all, settings, all).pct, 100);
});

test("writing in the figures is marked on the figures", () => {
  const ask = (/** @type {string} */ typed, /** @type {string} */ want, /** @type {string} */ type = "fig2own") =>
    checkAnswer(typed, { numeral: want }, type, settings);
  const w = AR.numerals;
  assert.equal(ask(w(47), w(47)).ok, true);
  assert.equal(ask(w(48), w(47)).ok, false);
  /* The right number in the figures English uses is not it, and says so. */
  const western = ask("47", w(47));
  assert.equal(western.ok, false);
  assert.equal(western.western, true);
  assert.notEqual(ask("48", w(47)).western, true);
  /* Grouping is notation. */
  assert.equal(ask(w(1) + w(0) + w(0) + w(0), w(1000)).ok, true);
  /* A clock: the leading nought may be left off; copied from the figures
     it is the same half of the day, read from the words either. */
  const quarter = `${w(0)}${w(7)}:${w(1)}${w(5)}`;
  assert.equal(ask(`${w(7)}:${w(1)}${w(5)}`, quarter, "clock2own").ok, true);
  assert.equal(ask(`${w(1)}${w(9)}:${w(1)}${w(5)}`, quarter, "clock2own").ok, false);
  assert.equal(ask(`${w(1)}${w(9)}:${w(1)}${w(5)}`, quarter, "time2own").ok, true);
  /* Reading a figure is not answered by copying it back. */
  assert.equal(checkAnswer("4", { en: "4", numeral: w(4) }, "dig2fig", settings).ok, true);
  assert.equal(checkAnswer(w(4), { en: "4", numeral: w(4) }, "dig2fig", settings).ok, false);
});

test("each kind of figure goes by its own name", () => {
  assert.match(exOf("fig2own", AR).label, /^Arabic numerals → Eastern Arabic numerals$/);
  assert.match(exOf("fig2own", AR).instruction, /Eastern Arabic numerals \(.+\)$/);
  assert.match(exOf("num2fig", AR).label, /Arabic numerals$/);
  assert.match(exOf("own2ar", AR).label, /^Eastern Arabic numerals → /);
  assert.match(exOf("dig2fig", AR).instruction, /Arabic numerals \(123\)/);
  /* And nothing a learner reads calls them figures any more. */
  for (const t of TYPES) {
    const spec = exOf(t, AR);
    for (const f of ["instruction", "label", "question"]) {
      assert.doesNotMatch(String(spec[f] || ""), /\bfigures?\b/i, `${t} ${f}: ${spec[f]}`);
    }
  }
});
