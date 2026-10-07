// @ts-check
/*
 * One card per meaning, in practice: what a learner holding two cards
 * that share a side is asked, and what they are told.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");
const out = path.join(here, ".meanings-build");

await build({
  entryPoints: [path.join(root, "src", "ArabicTrainer.tsx")],
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

const { enabledTypes, installIndexes, siblingsAsked } = await import(path.join(out, "trainer.js"));
const { DEFAULT_LANGUAGE, EX } = await import(path.join(root, "src", "languages.ts"));
const { clueFor } = await import(path.join(root, "src", "meanings.ts"));

const settings = { language: DEFAULT_LANGUAGE };

/**
 * A card with one form, a pronunciation and a recording.
 * @param {string} id @param {string} ar @param {string} en @param {number} created
 * @returns {any}
 */
const card = (id, ar, en, created) => ({
  id,
  lang: DEFAULT_LANGUAGE,
  tags: [],
  created,
  forms: [{ id, ar, en, lat: "sabir", lang: DEFAULT_LANGUAGE, s: {}, recs: [{ id: `${id}-clip` }] }],
});

const cactus = card("cactus", "صَبِر", "cactus", 1);
const patience = card("patience", "صَبِر", "patience", 2);
const book = card("book", "كتاب", "book", 3);
const lead = (/** @type {any} */ c) => c.forms[0];

/** The questions only about the word among a list of types. */
const aboutWord = (/** @type {string[]} */ types) =>
  types.map((t) => t.split("@")[0]).filter((t) => ["tr2ar", "rec2ar"].includes(t));

test("the word is read and spelt on the card made first, not on both", () => {
  installIndexes([cactus, patience, book], settings);
  assert.ok(aboutWord(enabledTypes(lead(cactus), settings)).length > 0, "the first card keeps them");
  assert.deepEqual(aboutWord(enabledTypes(lead(patience), settings)), [], "the second leaves them");
  assert.ok(
    enabledTypes(lead(patience), settings).some((/** @type {string} */ t) => t.startsWith("ar2en")),
    "and is still asked what it means",
  );
});

test("a learner with only one of the cards is asked everything on it", () => {
  installIndexes([patience, book], settings);
  assert.ok(aboutWord(enabledTypes(lead(patience), settings)).length > 0);
});

test("asked what صَبِر means, the other card is the one ruled out", () => {
  installIndexes([cactus, patience, book], settings);
  const sibs = siblingsAsked(cactus, lead(cactus), EX.ar2en, settings);
  assert.deepEqual(sibs.map((/** @type {any} */ s) => s.card.id), ["patience"]);
  assert.equal(clueFor(cactus, sibs, "en"), "not patience");
  assert.equal(clueFor({ ...cactus, clue: "the plant" }, sibs, "en"), "the plant");
  /* Written from its meaning, nothing is unclear: "cactus" is one card. */
  assert.deepEqual(siblingsAsked(cactus, lead(cactus), EX.en2ar, settings), []);
});

test("asked to write 'right', the other word for it is the one ruled out", () => {
  const sahh = card("sahh", "صح", "right / correct", 4);
  const yamin = card("yamin", "يمين", "right", 5);
  installIndexes([sahh, yamin, book], settings);
  const sibs = siblingsAsked(yamin, lead(yamin), EX.en2ar, settings);
  assert.deepEqual(sibs.map((/** @type {any} */ s) => s.card.id), ["sahh"]);
  assert.equal(clueFor(yamin, sibs, "ar"), "not صح");
});
