/*
 * The cards of a number system keeping step with their words.
 *
 * Two rules, both about cards that stand for words rather than being words:
 *
 *   * A figure comes in with its word — ٣ the session تلاتة is met — and
 *     starts on writing it where the word is already cleared.
 *   * A number part is never further up than its weakest member, and once
 *     every member is cleared it goes straight to its top.
 *
 * Nothing here holds a word of Arabic: the words are the golden system's.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

let rolling = 20261009 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".numbers-follow-build");
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
const { buildSession, cardStandings, creditNumbers, installIndexes, laddered, rangeCapsOf, wordsOfDigit } = await import(
  path.join(out, "trainer.js")
);
const { generate, fileIntoDecks, isRangeSkill, isNumeralCard, numeralId } = await import(
  path.join(here, "..", "src", "numbers", "generate.ts")
);
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { LANGUAGES, TYPES, levelOf } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState, openTypes, solid, standing, topLevelOf } = await import(path.join(here, "..", "src", "scheduler.ts"));

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
const zeroToNine = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"), "0 to 9");

/** A schedule kept: right every time, both passes made, next due later. */
const kept = () => ({
  ...freshState(), phase: "review", interval: 30, due: Date.now() + 30 * 86400000,
  reps: 4, right: 4, hist: [1, 1, 1, 1], passes: 2, updated: Date.now() - 86400000,
});

/** Every exercise kept on every form of the card. */
const keptAll = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({ ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, kept()])) })),
});

/** The card's own word answered once, right, and nothing else. */
const metOnce = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f, /** @type {number} */ i) =>
    i ? f : { ...f, s: { ...f.s, ar2en: { ...freshState(), phase: "learning", reps: 1, right: 1, hist: [1], updated: Date.now() - 3600000 } } }),
});

const wordOf = (/** @type {number} */ d) => {
  const digit = must(filed.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, d)), `figure ${d}`);
  return must(wordsOfDigit(digit, filed)[0], `the word for ${d}`);
};

test("each figure knows the word it goes with", () => {
  for (let d = 0; d <= 9; d++) {
    const digit = must(filed.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, d)), `figure ${d}`);
    const words = wordsOfDigit(digit, filed);
    assert.ok(words.length, `no word for ${d}`);
    assert.ok(words.every((/** @type {any} */ w) => w.numeral === digit.numeral && !isNumeralCard(w) && !isRangeSkill(w)));
  }
});

test("a figure comes in with its word, and not ahead of the words", () => {
  const three = wordOf(3);
  const items = filed.map((/** @type {any} */ it) => (it.id === three.id ? metOnce(it) : it));
  installIndexes(items, settings, SETS);
  const dealtIds = new Set();
  for (let i = 0; i < 6; i++) {
    const got = buildSession({ items, settings, inDeck: () => true, systems: SETS }).exercises.map((/** @type {any} */ ex) => ex.id);
    for (const id of got) dealtIds.add(id);
  }
  assert.ok(dealtIds.has(numeralId(SYS.id, 3)), "three's figure did not come in with three");
  /* A figure whose word nobody has met is not let in on its own. */
  const unmet = [0, 1, 2, 4, 5, 6, 7, 8, 9].map((d) => numeralId(SYS.id, d)).filter((id) => dealtIds.has(id));
  for (const id of unmet) {
    const d = Number(id.slice(-1));
    assert.ok(dealtIds.has(wordOf(d).id), `figure ${d} came in without its word`);
  }
});

test("a figure starts on writing where its word is already cleared, and only then", () => {
  const three = wordOf(3);
  const items = filed.map((/** @type {any} */ it) => (it.id === three.id ? keptAll(it) : it));
  installIndexes(items, settings, SETS);
  const credited = creditNumbers(items, settings);
  const figure = must(credited.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, 3)), "figure 3");
  const unit = figure.forms[0];
  const keys = laddered(unit, settings);
  const open = openTypes(keys, (/** @type {string} */ k) => unit.s[k]);
  assert.ok(open.includes("fig2dig"), `writing the figure is not open: ${open.join(" ")}`);
  assert.ok(solid(unit.s.dig2fig), "reading it was not counted");
  /* Four's word is not cleared, so four's figure is left as it was. */
  const four = must(credited.find((/** @type {any} */ it) => it.id === numeralId(SYS.id, 4)), "figure 4");
  assert.deepEqual(four.forms[0].s, {});
  /* And a figure already answered is not written over. */
  const answered = items.map((/** @type {any} */ it) => (it.id === numeralId(SYS.id, 3) ? metOnce({ ...it, forms: [{ ...it.forms[0], s: { dig2fig: { ...freshState(), phase: "learning", reps: 1, wrong: 1, hist: [0], updated: 1 } } }] }) : it));
  installIndexes(answered, settings, SETS);
  const again = must(creditNumbers(answered, settings).find((/** @type {any} */ it) => it.id === numeralId(SYS.id, 3)), "figure 3");
  assert.deepEqual(again.forms[0].s.dig2fig.hist, [0]);
});

test("a part is no further up than its weakest member", () => {
  /* Every word and figure of 0 to 9 kept, and the part itself, but eight. */
  const eight = wordOf(8);
  const items = filed.map((/** @type {any} */ it) => (it.id === eight.id ? it : keptAll(it)));
  installIndexes(items, settings, SETS);
  const part = must(items.find((/** @type {any} */ it) => it.id === zeroToNine.id), "0 to 9");
  const rows = cardStandings(part, settings, items);
  const at = must(standing(rows), "no standing");
  assert.equal(at.level, 1, "further up than eight, which has not been started");
  assert.equal(at.status, "learning");
  /* And it is asked no further up either. */
  const caps = rangeCapsOf(items, settings);
  assert.equal(caps.get(part.forms[0].id), 1);

  /* Eight cleared, and the part is where its own answers put it. */
  const all = filed.map(keptAll);
  installIndexes(all, settings, SETS);
  const whole = must(all.find((/** @type {any} */ it) => it.id === zeroToNine.id), "0 to 9");
  assert.equal(must(standing(cardStandings(whole, settings, all)), "no standing").status, "done");
  assert.equal(rangeCapsOf(all, settings).has(whole.forms[0].id), false);
});

test("once every member is cleared, a part goes straight to its top", () => {
  /* Every word and figure kept; the parts themselves never answered. */
  const items = filed.map((/** @type {any} */ it) => (isRangeSkill(it) ? it : keptAll(it)));
  installIndexes(items, settings, SETS);
  const credited = creditNumbers(items, settings);
  const part = must(credited.find((/** @type {any} */ it) => it.id === zeroToNine.id), "0 to 9");
  const unit = part.forms[0];
  const keys = laddered(unit, settings);
  const top = topLevelOf(keys);
  const open = openTypes(keys, (/** @type {string} */ k) => unit.s[k]);
  assert.ok(open.some((/** @type {string} */ k) => levelOf(k) === top), `the top is not open: ${open.join(" ")}`);
  /* Its top is still its own to answer. */
  assert.ok(keys.filter((/** @type {string} */ k) => levelOf(k) === top).every((/** @type {string} */ k) => !unit.s[k] || !solid(unit.s[k])));

  /* One member not cleared, and nothing is written. */
  const eight = wordOf(8);
  const short = items.map((/** @type {any} */ it) => (it.id === eight.id ? filed.find((/** @type {any} */ f) => f.id === it.id) : it));
  installIndexes(short, settings, SETS);
  const untouched = must(creditNumbers(short, settings).find((/** @type {any} */ it) => it.id === zeroToNine.id), "0 to 9");
  assert.deepEqual(untouched.forms[0].s, {});
});
