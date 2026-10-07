// @ts-check
/*
 * A sentence whose blank is filled by a word with no English, or no
 * transliteration, is still a sentence — shown without that line — and
 * is kept away only from the questions made of the missing line.
 *
 * Asked of the trainer itself, built as the app is, because the question
 * type is what decides: translating into English needs the English, and
 * typing a transliteration needs one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".missing-lines-build");
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
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

/** @returns {any} */
const name = (/** @type {string} */ id, /** @type {string} */ en, /** @type {string} */ lat, /** @type {number} */ created) => ({
  id, lang: "ar-PS", kind: "word", category: "name", fills: "name", drill: false, tags: [], created,
  forms: [{ id, ar: `سامي${created}`, en, lat, lang: "ar-PS", human: "person", gender: "masculine", number: "singular", s: {} }],
});
const WHOLE = name("whole", "Sami", "sami", 1);
const NO_EN = name("noen", "", "rami", 2);
const NO_LAT = name("nolat", "Hadi", "", 3);
/** @returns {any} */
const sentence = (/** @type {number} */ right, /** @type {string} */ type) => ({
  id: "s1", lang: "ar-PS", kind: "phrase", tags: [], created: 10,
  forms: [{ id: "s1", ar: "أنا {{name}}", en: "I am {{name}}", lat: "ana {{name}}", lang: "ar-PS", s: { [type]: { right } } }],
});
const settings = { language: "ar-PS" };

/** Every sentence a question type is shown, over a few turns. */
const shown = (/** @type {string} */ type) => {
  const seen = [];
  for (let right = 0; right < 6; right++) {
    const items = [WHOLE, NO_EN, NO_LAT, sentence(right, type)];
    trainer.installIndexes(items, settings);
    const f = trainer.castQuestion(items, { id: "s1", subId: null, type }, true);
    if (f) seen.push({ ar: f.ar, en: f.en, lat: f.lat });
  }
  return seen;
};

test("a question in English is never asked of a filling with no English", () => {
  for (const type of ["ar2en", "en2ar"]) {
    const seen = shown(type);
    assert.ok(seen.length > 0, type);
    for (const f of seen) {
      assert.ok(f.en && !f.en.includes("{{"), `${type}: ${JSON.stringify(f)}`);
      assert.notEqual(f.ar, "أنا سامي2", `${type} asked the name with no English`);
    }
    assert.ok(seen.some((f) => f.ar === "أنا سامي3"), `${type} still asks the name with no transliteration`);
  }
});

test("a question in transliteration is never asked of a filling with no transliteration", () => {
  for (const type of ["ar2tr", "tr2ar"]) {
    const seen = shown(type);
    assert.ok(seen.length > 0, type);
    for (const f of seen) {
      assert.ok(f.lat && !f.lat.includes("{{"), `${type}: ${JSON.stringify(f)}`);
      assert.notEqual(f.ar, "أنا سامي3", `${type} asked the name with no transliteration`);
    }
    /* The one with no English is asked here, with no English line. */
    const noEn = seen.find((f) => f.ar === "أنا سامي2");
    assert.ok(noEn, `${type} still asks the name with no English`);
    assert.equal(noEn.en, "");
  }
});
