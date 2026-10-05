// @ts-check
/*
 * What a sentence's blanks can be filled with, worked out once and kept.
 *
 * 0.262 had a verb beside another blank stand in it once per tense, and
 * working that out read the verb's whole table again for every one of its
 * cells — for every sentence, for every question type, after every answer.
 * Moving on from an answer took three times as long as it had, and longer
 * the more verbs and sentences a learner held. 0.333 keeps three answers
 * rather than working them out again: the filled cells of each row of a
 * card's table, which words each blank of each sentence admits, and each
 * pack's tables.
 *
 * Keeping an answer goes wrong in two ways, and each is tried here:
 *
 *   * something it was read from changes and the old answer is read
 *     anyway — an edited verb has to reach the sentences it stands in;
 *   * it depends on something it was not kept against — the language a
 *     card with none of its own is read in moves while a question in
 *     another language is on screen, with no index being rebuilt.
 *
 * Remembered against afresh: the same source bundled more than once, so
 * that one copy has been asked everything before and another has not. Both
 * are set up the same number of times, in the same order, because the
 * setting up is not neutral: how far each word has climbed is worked out
 * part-way through it, reading some of what the last setting up decided,
 * so the very first one after opening the app reads a little differently
 * from every one after it. That is the app's own order, older than this
 * and nothing to do with what is kept here, so it is held level on both
 * sides.
 *
 * And the point of it, last: a large collection is dealt in a fraction of
 * the time it took while every answer was worked out from nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { rowLead } from "../src/verbs.ts";
import { LANGUAGES, tensedOf } from "../src/languages.ts";
import { isLent } from "../src/variables.ts";

const here = path.dirname(new URL(import.meta.url).pathname);

/** @param {string} name */
async function copy(name) {
  const out = path.join(here, ".blank-pools-build", name);
  await build({
    entryPoints: ["ArabicTrainer.tsx", "languages.ts"].map((f) => path.join(here, "..", "src", f)),
    outdir: out,
    bundle: true,
    splitting: true,
    format: "esm",
    jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    logLevel: "silent",
    define: {
      "process.env.NODE_ENV": '"production"',
      __APP_RELEASE__: '"0"',
      __APP_VERSION__: '"test"',
      __BUILT_AT__: '"0"',
    },
  });
  const trainer = await import(pathToFileURL(path.join(out, "ArabicTrainer.js")).href);
  const langs = await import(pathToFileURL(path.join(out, "languages.js")).href);
  return { trainer, langs };
}
const warm = await copy("warm");
const cold = await copy("cold");

/* One clock and one die for everything, so two copies asked the same
   question in the same order give the same answer. */
const NOW = Date.UTC(2026, 9, 4, 9, 0, 0);
const DAY = 86400000;
Date.now = () => NOW;
let rolling = 1;
Math.random = () => ((rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0) / 4294967296);
const seed = (/** @type {number} */ n) => { rolling = n; };

/* ---- a collection ---- */

const LETTERS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
/** A made-up word, the same one every time it is asked for. */
const word = (/** @type {number} */ n, /** @type {number} */ len = 4) => {
  let out = "";
  for (let i = 0; i < len; i++) out += LETTERS[(n * 7 + i * 13 + ((n >> 3) % 5)) % LETTERS.length];
  return out;
};
/* Every exercise up and kept, and nothing due until tomorrow: a word a
   blank may be filled with at any level, which nothing deals of its own. */
const KEYS = ["ar2pick", "ar2en", "rec2en", "match", "en2pick", "ctx2pick", "tr2ar", "rec2ar", "en2ar", "ctx2ar"];
const kept = () =>
  Object.fromEntries(KEYS.map((k) => [k, {
    phase: "review", step: 0, ease: 2.5, interval: 5, due: NOW + DAY, reps: 4, lapses: 0, right: 4,
    wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1, 1], passes: 2, updated: NOW - DAY,
  }]));
const CELLS = [["past", "he"], ["past", "she"], ["past", "i"], ["past", "we"], ["present", "he"], ["present", "she"], ["present", "i"], ["present", "you-m"], ["command", "you-m"]];

/**
 * A verb laid out in its table, its language on every form as a course
 * card carries it. `lang` is left off where asked, the way a card saved
 * before the app knew about languages was.
 * @param {number} i
 * @param {string | null} [lang]
 * @returns {any}
 */
const verb = (i, lang = "ar-PS") => ({
  id: `v${i}`, ...(lang ? { lang } : {}), kind: "word", category: "verb", name: `to do ${i}`, tags: ["Verbs"],
  /* Older than everything else where it names no language, as such a card
     is — which also puts it first in line for a blank. */
  created: lang ? 100 + i : i - 100,
  forms: [
    { id: `v${i}`, ar: word(i), en: `to do ${i}`, lat: `do${i}`, ...(lang ? { lang } : {}), s: kept() },
    ...CELLS.map(([row, col], j) => ({ id: `v${i}-${j}`, ar: word(i * 11 + j, 5), en: `${col} ${row} ${i}`, lat: `v${i}${j}`, row, col, ...(lang ? { lang } : {}), s: kept() })),
  ],
});
/** @returns {any} */
const name = (/** @type {number} */ i) => ({
  id: `n${i}`, lang: "ar-PS", kind: "word", category: "name", fills: "name", drill: false, tags: [], created: i,
  forms: [{ id: `n${i}`, ar: word(500 + i, 5), en: `Name${i}`, lat: `name${i}`, lang: "ar-PS", number: "singular", gender: i % 2 ? "feminine" : "masculine", human: "person", s: {} }],
});
/** @returns {any} */
const noun = (/** @type {number} */ i) => ({
  id: `w${i}`, lang: "ar-PS", kind: "word", category: "noun", tags: [`Lesson ${i % 12}`], created: 200 + i,
  forms: [
    { id: `w${i}`, ar: word(900 + i), en: `thing ${i}`, lat: `thing${i}`, lang: "ar-PS", number: "singular", gender: "masculine", s: i % 3 ? {} : kept() },
    { id: `w${i}-p`, ar: word(1900 + i), en: `things ${i}`, lat: `things${i}`, lang: "ar-PS", number: "plural", gender: "masculine", s: {} },
  ],
});
/* Two blanks, so the verb agrees with the name beside it; every other one
   narrowed to the past as well. */
/** @returns {any} */
const frame = (/** @type {number} */ i) => ({
  id: `s${i}`, lang: "ar-PS", kind: "phrase", tags: [`Lesson ${i % 12}`], created: 300 + i,
  forms: [{
    id: `s${i}`, ar: `مبارح {{name}} {{verb}} ${word(700 + i)}`, en: `yesterday {{name}} {{verb}} (${i})`,
    lat: `mbaari7 {{name}} {{verb}} ${i}`, lang: "ar-PS", s: {}, ...(i % 2 ? { tenses: { verb: ["past"] } } : {}),
  }],
});
/**
 * @param {{ verbs: number, frames: number, nouns: number, names: number }} n
 * @returns {any[]}
 */
const collection = (n) => [
  ...Array.from({ length: n.verbs }, (_, i) => verb(i + 1)),
  ...Array.from({ length: n.names }, (_, i) => name(i + 1)),
  ...Array.from({ length: n.nouns }, (_, i) => noun(i + 1)),
  ...Array.from({ length: n.frames }, (_, i) => frame(i + 1)),
];
const settings = { language: "ar-PS" };

/* A question on each level, so a blank is filled from what the learner
   has met at the bottom and from what they can write at the top. */
const ASKED_AS = ["ar2en", "en2pick", "tr2ar", "en2ar"];

/**
 * Every sentence filled as a learner would be shown it.
 * @param {{ trainer: any, langs: any }} at
 * @param {any[]} items
 */
function filled(at, items) {
  const out = [];
  for (const it of items) {
    if (!/\{\{/.test(it.forms[0].ar)) continue;
    for (const type of ASKED_AS) {
      seed(7);
      const f = at.trainer.castQuestion(items, { id: it.id, subId: null, type });
      out.push([it.id, type, f ? f.ar : null]);
    }
  }
  return out;
}

/**
 * And what a session is dealt, filled as it would be shown.
 * @param {{ trainer: any, langs: any }} at
 * @param {any[]} items
 */
function dealt(at, items) {
  seed(11);
  const built = at.trainer.buildSession({ items, settings, inDeck: () => true, perDay: 60 });
  return built.exercises.map((/** @type {any} */ ex) => {
    seed(13);
    const f = at.trainer.castQuestion(items, ex);
    return [ex.id, ex.subId, ex.type, f ? f.ar : null];
  });
}

/* ---- a verb's row ---- */

test("the cell that leads a row is read off the card as it is now", () => {
  const ar = LANGUAGES["ar-PS"];
  const spec = tensedOf(ar, "verb");
  const card = verb(1);
  /* The language lists I before he, so the past's I leads it. */
  const was = rowLead(card, spec, "past", isLent);
  assert.equal(was && was.col, "i");
  /* Emptied the way an edit empties it: a new card, the old one left be. */
  const edited = { ...card, forms: card.forms.map((/** @type {any} */ f) => (f.row === "past" && f.col === "i" ? { ...f, ar: "" } : f)) };
  const now = rowLead(edited, spec, "past", isLent);
  assert.equal(now && now.col, "he", "the edited card is read afresh");
  assert.equal(rowLead(card, spec, "past", isLent), was, "and the card it replaced still says what it said");
});

/* ---- remembered against afresh ---- */

test("an edited verb reaches the sentences it stands in", () => {
  const before = collection({ verbs: 12, frames: 16, nouns: 20, names: 4 });
  warm.trainer.installIndexes(before, settings);
  filled(warm, before);
  dealt(warm, before);
  /* Every verb edited the way the app edits one — a new object — with a
     cell emptied, one rewritten, and one added in a person nobody had. */
  const after = before.map((it) => {
    if (it.category !== "verb") return it;
    const forms = it.forms.map((/** @type {any} */ f) =>
      f.row === "past" && f.col === "i" ? { ...f, ar: "" } : f.row === "present" && f.col === "he" ? { ...f, ar: `${f.ar}و` } : f,
    );
    forms.push({ id: `${it.id}-new`, ar: word(4000), en: "they past", lat: "", row: "past", col: "they", s: kept() });
    return { ...it, forms };
  });
  warm.trainer.installIndexes(after, settings);
  /* Set up on the cards as they were and then as they are, as the warm
     copy was, and asked nothing in between. */
  cold.trainer.installIndexes(before, settings);
  cold.trainer.installIndexes(after, settings);
  assert.deepEqual(filled(warm, after), filled(cold, after));
  assert.deepEqual(dealt(warm, after), dealt(cold, after));
});

test("a card with no language of its own is read in the language on screen", async () => {
  /* Verbs saved before cards said which language they were in, and a
     Huế card, which is what puts a Huế question on screen. */
  const items = collection({ verbs: 8, frames: 12, nouns: 12, names: 4 })
    .concat([verb(90, null), verb(91, null), verb(92, null)])
    .concat([{ id: "vi1", lang: "vi-Hue", kind: "word", tags: [], created: 1, forms: [{ id: "vi1", ar: "nhà", en: "house", lat: "nha", lang: "vi-Hue", s: {} }] }]);
  /* Three copies set up once each, so the only thing that differs between
     them is what they were asked and in which language. */
  const [before, after, arabic] = await Promise.all([copy("lang-before"), copy("lang-after"), copy("lang-arabic")]);
  /* Asked first in the app's own language, as a render does, and then
     again once the question on screen has moved it. */
  before.trainer.installIndexes(items, settings);
  filled(before, items);
  before.langs.setActiveLang("vi-Hue");
  const remembered = filled(before, items);
  /* Asked only once the language had moved. */
  after.trainer.installIndexes(items, settings);
  after.langs.setActiveLang("vi-Hue");
  const afresh = filled(after, items);
  /* Only worth asking if the language makes a difference here: the old
     verbs stand in these blanks in Arabic and not in Huế. */
  arabic.trainer.installIndexes(items, settings);
  assert.notDeepEqual(afresh, filled(arabic, items), "the old verbs read differently in the two languages");
  assert.deepEqual(remembered, afresh);
});

/* ---- and what it was for ---- */

test("a large collection is dealt in under a second", () => {
  /* About the size the slowdown was measured at: seventy verbs and a
     hundred and ten sentences beside them, every verb kept so that every
     one can stand in a blank. Fresh cards each time, which is the dearest
     case — the app's own launch — since nothing about them is remembered
     yet. Setting this up and dealing it took about seven seconds before
     0.333 and takes about a quarter of a second now; the bar is set well
     clear of both, so a slow machine does not fail it and the old cost
     would. */
  const times = [];
  for (let run = 0; run < 3; run++) {
    const items = collection({ verbs: 70, frames: 110, nouns: 300, names: 24 });
    const t0 = performance.now();
    cold.trainer.installIndexes(items, settings);
    seed(17);
    const built = cold.trainer.buildSession({ items, settings, inDeck: () => true, perDay: 60 });
    times.push(performance.now() - t0);
    assert.ok(built.exercises.length > 0);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[1] < 1000, `dealing took ${times[1].toFixed(0)} ms`);
});
