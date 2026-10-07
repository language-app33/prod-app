// @ts-check
/*
 * A face of a number that counts things is asked with a thing to count.
 *
 * *Three* before a noun, *one* with a feminine word: practised bare, they
 * are half a phrase. So the face is asked as a small sentence made under
 * the hood — the number and one of the learner's nouns in the shape that
 * number puts it in — and never on its own. Four claims: which faces those
 * are, read off the composer; which pairings a face can be asked as, and
 * that a noun not yet cleared is never one of them; that a face is asked
 * nothing that would show it bare; and that a session deals the phrase,
 * credits the noun, and leaves the face quiet while there is no noun.
 *
 * Nothing here holds a word of Arabic or Hebrew: the words are the golden
 * systems', and the noun cards borrow the golden nouns.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

let rolling = 20261007 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".counted-faces-build");
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
const { buildSession, installIndexes, resolveQuestion } = await import(path.join(out, "trainer.js"));
const { generate, faceAsk, componentId } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { heComposer } = await import(path.join(here, "..", "src", "numbers", "he-IL.ts"));
const { canAsk, COUNTED_FACE_TYPES } = await import(path.join(here, "..", "src", "offers.ts"));
const { LANGUAGES, TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const AR = load("ar-PS.numbers.json").system;
/** @type {any} */
const HE = load("he-IL.numbers.json").system;
const NOW = 1750000000000;

/** The faces a system's cards carry, by slot and face, with where each counts. */
const facesOf = (/** @type {any} */ composer, /** @type {any} */ sys) => {
  /** @type {Record<string, number[] | undefined>} */
  const out = {};
  for (const card of generate({ composer, sys, now: NOW }).items) {
    const slot = card.source && card.source.slot;
    for (const f of card.forms) if (f.col) out[`${slot}/${f.col}`] = f.countedAt;
  }
  return out;
};

/* ---- which faces count things ---- */

test("Arabic: three to nineteen before a noun, and one, count things at their own number", () => {
  const faces = facesOf(arComposer, AR);
  for (const n of [3, 7, 10]) assert.deepEqual(faces[`unit.${n}/construct.m`], [n], `unit.${n}`);
  for (const n of [11, 19]) assert.deepEqual(faces[`teen.${n}/construct.m`], [n], `teen.${n}`);
  assert.deepEqual(faces["unit.1/m"], [1]);
  assert.deepEqual(faces["unit.1/f"], [1]);
});

test("Arabic two's gendered words meet a noun only inside twenty-two, so that is where they are asked", () => {
  const faces = facesOf(arComposer, AR);
  assert.deepEqual(faces["unit.2/m"], [22]);
  assert.deepEqual(faces["unit.2/f"], [22]);
});

test("Hebrew: the gendered words count things, and the bound form before thousands does not", () => {
  const faces = facesOf(heComposer, HE);
  assert.deepEqual(faces["unit.3/m"], [3]);
  assert.deepEqual(faces["unit.3/f"], [3]);
  assert.deepEqual(faces["teen.15/f"], [15]);
  assert.deepEqual(faces["unit.2/construct.m"], [2]);
  assert.deepEqual(faces["unit.2/m"], [22]);
  assert.equal(faces["unit.3/construct.m"], undefined, "before thousands is asked as it always was");
});

test("the card's own word is never a face that counts", () => {
  for (const card of generate({ composer: arComposer, sys: AR, now: NOW }).items) {
    assert.equal(card.forms[0].countedAt, undefined, card.id);
  }
});

/* ---- the pairings ---- */

const SET = { composer: arComposer, sys: AR };
const everyone = () => true;

test("a face is asked as its number with a noun, a different noun as the seed moves", () => {
  const seen = new Set();
  for (let turn = 0; turn < 30; turn += 1) {
    const ask = must(faceAsk("unit.3", "construct.m", [3], String(turn), SET, new Set(), everyone), "an asking");
    assert.equal(ask.value, 3);
    const noun = must(AR.nouns.find((/** @type {any} */ n) => n.id === ask.nounId), "a known noun");
    const said = arComposer.render(3, AR, { noun });
    assert.ok(said.tokens.some((/** @type {any} */ t) => t.slot === "unit.3" && t.formKey === "construct.m"));
    assert.ok(said.tokens.some((/** @type {any} */ t) => t.noun === noun.id), "the noun stands in it");
    seen.add(ask.nounId);
  }
  assert.ok(seen.size > 1, "more than one noun over thirty turns");
});

test("the same seed asks the same pairing, so a missed one comes back unchanged", () => {
  const a = faceAsk("unit.5", "construct.m", [5], "x", SET, new Set(), everyone);
  const b = faceAsk("unit.5", "construct.m", [5], "x", SET, new Set(), everyone);
  assert.deepEqual(a, b);
});

test("a gendered face is paired only with a noun of its gender", () => {
  for (let turn = 0; turn < 20; turn += 1) {
    const ask = must(faceAsk("unit.1", "f", [1], String(turn), SET, new Set(), everyone), "an asking");
    const noun = AR.nouns.find((/** @type {any} */ n) => n.id === ask.nounId);
    assert.equal(noun.gender, "f");
  }
});

test("only a noun the learner has cleared, in the shape the number puts it in", () => {
  /* The plural of book alone is not yet cleared. */
  const knows = (/** @type {string} */ id, /** @type {any} */ t) =>
    !(id === "book" && t && t.text === AR.nouns.find((/** @type {any} */ n) => n.id === "book").pl);
  for (let turn = 0; turn < 20; turn += 1) {
    const ask = must(faceAsk("unit.3", "construct.m", [3], String(turn), SET, new Set(), knows), "an asking");
    assert.notEqual(ask.nounId, "book");
  }
  assert.equal(faceAsk("unit.3", "construct.m", [3], "x", SET, new Set(), () => false), null, "no noun, no question");
});

test("twenty-two waits on twenty too, but not on the face being practised", () => {
  const twenty = componentId(AR.id, "ten.20");
  const two = componentId(AR.id, "unit.2");
  const ids = new Set([twenty, two]);
  assert.equal(faceAsk("unit.2", "m", [22], "x", SET, ids, (/** @type {string} */ id) => id !== twenty), null);
  assert.ok(faceAsk("unit.2", "m", [22], "x", SET, ids, (/** @type {string} */ id) => id !== two));
});

/* ---- what a face is asked ---- */

test("a face that counts is asked only the phrase read and written, never bare", () => {
  const lang = LANGUAGES["ar-PS"];
  const unit = { id: "f", ar: "x", en: "three", lat: "x", numeral: "3", countedAt: [3], recs: [{ id: "r" }] };
  const on = { unit, scene: null, contexts: [], mates: 99, pictured: 99, heard: 99 };
  const asked = TYPES.filter((/** @type {string} */ t) => canAsk(on, t, lang));
  assert.ok(asked.length, "something is asked");
  for (const t of asked) assert.ok(COUNTED_FACE_TYPES.includes(t), t);
  const bare = { ...unit, countedAt: undefined };
  assert.ok(TYPES.filter((/** @type {string} */ t) => canAsk({ ...on, unit: bare }, t, lang)).length > asked.length);
});

/* ---- in a session ---- */

const settings = { language: "ar-PS" };
const SETS = [{ numbers: AR }];
const solid = () => ({
  ...freshState(), phase: "review", interval: 4, due: Date.now() - 86400000,
  reps: 2, right: 2, hist: [1, 1], updated: Date.now() - 86400000,
});
const allSolid = () => Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, solid()]));

/** A noun card made of a golden noun, every form cleared or not. */
const nounCard = (/** @type {any} */ n, /** @type {boolean} */ known) => ({
  id: n.id, lang: "ar-PS", category: "noun", tags: [],
  forms: [
    { id: `${n.id}-sg`, ar: n.sg, en: n.en, lat: "", number: "singular", s: known ? allSolid() : {} },
    { id: `${n.id}-pl`, ar: n.pl, en: `${n.en}s`, lat: "", number: "plural", s: known ? allSolid() : {} },
    { id: `${n.id}-du`, ar: n.dual, en: `two ${n.en}s`, lat: "", number: "dual", s: known ? allSolid() : {} },
  ],
});

/** The number words with their own word well known, so their tables are
    open, and the faces under them never asked. */
const numberCards = () =>
  generate({ composer: arComposer, sys: AR, now: NOW }).items
    .filter((/** @type {any} */ it) => !it.range && it.source && /^unit\.[1-9]$/.test(it.source.slot))
    .map((/** @type {any} */ it) => ({
      ...it,
      forms: it.forms.map((/** @type {any} */ f, /** @type {number} */ i) => (i === 0 ? { ...f, s: allSolid() } : f)),
    }));

const faceQuestions = (/** @type {any[]} */ items, /** @type {number} */ rounds) => {
  installIndexes(items, settings, SETS);
  const found = [];
  for (let i = 0; i < rounds; i += 1) {
    const { exercises } = buildSession({ items, settings, inDeck: () => true, systems: SETS, includeAll: true, budget: 80 });
    for (const ex of exercises) {
      const card = items.find((it) => it.id === ex.id);
      const unit = card && ex.subId && card.forms.find((/** @type {any} */ f) => f.id === ex.subId);
      if (unit && unit.countedAt) found.push({ ex, card, unit });
    }
  }
  return found;
};

test("a session deals a counting face as the number with a learnt noun, and credits the noun", () => {
  const nouns = AR.nouns.filter((/** @type {any} */ n) => n.id !== "minute");
  const items = [...numberCards(), ...nouns.map((/** @type {any} */ n) => nounCard(n, true))];
  const found = faceQuestions(items, 6);
  assert.ok(found.length, "some counting face was dealt");
  for (const { ex, card, unit } of found) {
    assert.ok(ex.ask && ex.ask.nounId, "drawn with a noun");
    const noun = must(AR.nouns.find((/** @type {any} */ n) => n.id === ex.ask.nounId), "noun");
    const shown = must(resolveQuestion(items, ex, false, SETS), "resolved");
    assert.notEqual(shown.unit.ar, unit.ar, "not the bare word");
    assert.match(shown.unit.ar, new RegExp([noun.sg, noun.pl, noun.dual].join("|")), "the noun is in the phrase");
    assert.match(shown.unit.en, new RegExp(`^${ex.ask.value} `), "the meaning is the count and the thing");
    assert.equal(shown.unit.id, unit.id, "marked on the face itself");
    assert.ok(shown.unit.tokens.some((/** @type {any} */ t) => t.noun === noun.id), "the noun is credited");
    assert.ok(
      !shown.unit.tokens.some((/** @type {any} */ t) => t.slot === card.source.slot && t.formKey === unit.col),
      "the face is not credited twice",
    );
  }
});

test("with no noun learnt yet, a counting face is not dealt at all", () => {
  const items = [...numberCards(), ...AR.nouns.map((/** @type {any} */ n) => nounCard(n, false))];
  assert.equal(faceQuestions(items, 6).length, 0);
});
