/*
 * The app must not know any language's rules.
 *
 * Every language-specific decision — how an answer is marked, what makes two
 * words related, which prefixes attach to a word, what to call a shade of
 * wrong — lives in a language pack and is reached through a generic name.
 * The app asks; the pack answers; a pack that stays silent means the feature
 * is simply absent for that language, which is the expected case rather than
 * a failure.
 *
 * The rule is easy to state and easy to break by accident: someone reaches
 * for arTokenIsWord because it is right there and it works, and a year later
 * a third language arrives and nothing fits. So it is a test, not a comment.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { readdirSync } from "node:fs";
import * as LANG from "../src/languages.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
/* Named without an extension, and resolved to whichever one exists: the
   app is moving from JavaScript to TypeScript a module at a time, and a
   list pinned to ".js" would drop a file out of this guard on the day it
   was converted — silently, which is the one way a guard fails badly. */
const src = (/** @type {string} */ stem) => {
  for (const ext of [".jsx", ".tsx", ".ts", ".js"]) {
    const at = path.join(here, "..", "src", stem + ext);
    if (existsSync(at)) return at;
  }
  throw new Error(`no source file for ${stem}`);
};

/*
 * Everything that renders or drives the app: every module directly under
 * src/, read off the directory. languages is the one file allowed to know
 * about languages, so it is not among them.
 *
 * It was a list of twelve until 0.309, and the list had rotted the way
 * lists do: sentence blanks, verb tables, the pronouns screen, the review
 * of sentences and the number editor had all been written since, and
 * none of them was checked. Read off the directory, a file added
 * tomorrow is checked tomorrow.
 */
const APP_FILES = readdirSync(new URL("../src/", import.meta.url))
  .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.d\.ts$/.test(f))
  .map((f) => f.replace(/\.(tsx?|jsx?)$/, ""))
  .filter((stem) => stem !== "languages");

test("the files checked are the app, not a handful of it", () => {
  /* Guards the guard: a directory read that found nothing would pass
     every test below in silence. */
  assert.ok(APP_FILES.length >= 30, `only ${APP_FILES.length} app files found`);
  for (const want of ["ArabicTrainer", "variables", "verbs", "review", "pronouns-editor", "number-system-editor"]) {
    assert.ok(APP_FILES.includes(want), `${want} should be checked`);
  }
});

/*
 * The source with its comments taken out. A comment saying that أنا is *I*
 * is an explanation, and the app's comments are full of them; what may not
 * be in a file is a word of a language in its *code*. Block comments go
 * whole — JSX's braced ones with them — and a line comment only where it
 * starts its line or follows code, so "https://" inside a string survives.
 */
const codeOf = (/** @type {string} */ source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/([;,{}()\]])\s*\/\/[^\n"'`]*$/gm, "$1");

/*
 * And the composers, which are held to something stricter.
 *
 * `src/numbers/` is where each language's number rules live, so the rule
 * above — do not know about a language — cannot apply to it. What applies
 * instead is the condition the directory exists under: **the words are
 * data and the joining is code**, so a composer may know that the unit
 * comes before the ten and may not know a single word of any language.
 * Every syllable comes from the system the teacher typed, or from a
 * golden table a speaker signed.
 *
 * Read off the directory rather than listed, because a list is the thing
 * that rots: a file added tomorrow is checked tomorrow, without anybody
 * remembering. That is also why this walks a directory where the rest of
 * the file resolves stems — the guard that skips a file passes in
 * silence, which is the one way a guard fails badly.
 */
const composerFiles = () => {
  const dir = new URL("../src/numbers/", import.meta.url);
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ name: `src/numbers/${f}`, at: new URL(f, dir) }));
};

/* A name belongs to one language if it is prefixed with that language, in
   either of the two spellings the file uses: ar/Ar for Arabic, vi/Viet for
   Vietnamese, he/He for Hebrew. Add a prefix here when a fourth arrives. */
const LANGUAGE_SPECIFIC = /^(ar|vi|he)[A-Z]|^(norm|check|split)(Ar|Viet|He)$/;

/**
 * @param {string} source
 * @returns {string[]}
 */
function importedNames(source) {
  const m = source.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/languages\.(?:js|ts)["']/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((x) => x.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

test("the exports the app may not reach for are the ones named for a language", () => {
  /* Guards the guard: if the naming convention were abandoned the regex
     below would quietly match nothing and this file would pass for ever. */
  const flagged = Object.keys(LANG).filter((n) => LANGUAGE_SPECIFIC.test(n));
  assert.ok(flagged.length >= 6, `only ${flagged.length} language-specific exports found: ${flagged.join(", ")}`);
  for (const want of ["arTokenIsWord", "arSkeleton", "checkAr", "viTokenIsWord", "checkViet", "normAr", "checkHe", "heTokenIsWord", "normHe"]) {
    assert.ok(flagged.includes(want), `${want} should be recognised as language-specific`);
  }
});

for (const file of APP_FILES) {
  test(`${file} imports nothing that belongs to one language`, async () => {
    const source = await readFile(src(file), "utf8");
    const bad = importedNames(source).filter((n) => LANGUAGE_SPECIFIC.test(n));
    assert.deepEqual(
      bad,
      [],
      `${file} imports ${bad.join(", ")} — ask the language pack instead ` +
        `(supportsContext, findWordSlot, guessKind, langOf(...).check, and so on)`,
    );
  });

}

/*
 * The other way the rule gets broken: not by importing the Arabic matcher
 * but by writing a second copy of it in the app — a list of prefixes, a
 * regex of letters. That shows up as script in a file that should have
 * none.
 *
 * A blanket "no Arabic characters" test would be wrong: the onboarding
 * wordmark, the placeholder in the card sheet and the gallery's specimens
 * are all legitimately in Arabic, and forbidding them would only push
 * sample data into escape sequences where nobody can read it. So every
 * Arabic string in the app is listed here instead. A new one fails this
 * test, and the answer is either "it is presentation, add it to the list"
 * or "it is a rule, move it to the pack".
 *
 * Arabic and Hebrew, whose blocks sit side by side and are scanned as one
 * range. Vietnamese is written in the Latin alphabet and cannot be told
 * apart from ordinary text by character range.
 */
/* Keyed by file, and only the files that hold any. */
/** @type {Record<string, string[]>} */
/* Keyed by the same extension-free name APP_FILES uses, so converting a
   file does not silently empty its allowlist. Nothing a learner meets is
   here any more: the card sheet's placeholder now comes from the pack, and
   the first screen's wordmark is the app's name, Taleb33. */
const ALLOWED_SCRIPT = {
  /* Specimens, which are the point of a gallery. The third is the he-past
     of "to eat" — the form a dictionary lists a verb under, which is what a
     card with a name of its own is named instead of. */
  gallery: ["كِتَاب", "كُتُب", "أكل"],
  /* Examples of what each element holds, which are the point of the list. */
  "screen-elements": ["كِتاب", "الكتاب كبير", "كُتُب", "السَّلامُ عَلَيْكُم", "٤٧", "٠١٢٣٤٥٦٧٨٩"],
  /* Specimens of each text style, on the admin screen that lists them. */
  "text-styles": ["كِتَاب", "الكِتَاب كَبِير", "اسْمِي لَيْلَى وَأَنَا مِن فِلَسْطِين"],
};

/*
 * And Vietnamese, which a character range cannot find whole — it is the
 * Latin alphabet — but whose words carry letters no English word does:
 * ă â đ ê ô ơ ư, and the vowels with tone marks on them. A word holding one
 * of those, in a file's code, is a word of the language.
 */
/** @type {Record<string, string[]>} */
const ALLOWED_VIETNAMESE = {
  /* The gallery's specimen of the language switch names the language. */
  gallery: ["Huế"],
};

for (const file of APP_FILES) {
  test(`${file} holds no Arabic or Hebrew beyond the strings already accounted for`, async () => {
    const source = codeOf(await readFile(src(file), "utf8"));
    const runs = [...new Set((source.match(/[\u0590-\u06FF][\u0590-\u06FF\s]*/g) || []).map((x) => x.trim()).filter(Boolean))];
    const unexpected = runs.filter((r) => !(ALLOWED_SCRIPT[file] || []).includes(r));
    assert.deepEqual(
      unexpected,
      [],
      `${file} gained Arabic or Hebrew text: ${unexpected.join(", ")} — if it is a rule it belongs in the ` +
        `language pack; if it is something to look at, add it to ALLOWED_SCRIPT`,
    );
  });
}

for (const file of APP_FILES) {
  test(`${file} holds no Vietnamese beyond the words already accounted for`, async () => {
    const source = codeOf(await readFile(src(file), "utf8"));
    const words = [...new Set(source.match(/\p{L}*[ăâđêôơưĂÂĐÊÔƠƯ\u1EA0-\u1EF9]\p{L}*/gu) || [])];
    const unexpected = words.filter((w) => !(ALLOWED_VIETNAMESE[file] || []).includes(w));
    assert.deepEqual(
      unexpected,
      [],
      `${file} gained Vietnamese text: ${unexpected.join(", ")} — if it is a rule it belongs in the ` +
        `language pack; if it is something to look at, add it to ALLOWED_VIETNAMESE`,
    );
  });
}

test("the scans see a language when it is there", () => {
  /* The guard on the two scans above: comments are stripped before them,
     and a stripper that ate code too would pass everything. */
  assert.equal(codeOf('const a = "كتاب"; // كتاب').includes("كتاب"), true);
  assert.equal(codeOf("/* كتاب */ const b = 1;").includes("كتاب"), false);
  assert.equal(codeOf('const u = "https://x"; const v = "ơ";').includes("ơ"), true);
});

test("no composer holds a word of any language", async () => {
  const files = composerFiles();
  assert.ok(files.length >= 4, `only ${files.length} composers found — the scan is wrong, not the source`);
  for (const { name, at } of files) {
    const source = await readFile(at, "utf8");
    const runs = [...new Set((source.match(/[\u0590-\u06FF]+/g) || []))];
    assert.deepEqual(
      runs,
      [],
      `${name} holds words: ${runs.join(", ")} — a composer knows slot names and an order, ` +
        `never a syllable. The words belong in the teacher's system or in a golden table.`,
    );
  }
});

test("a composer is reached through the registry, never by its language's name", async () => {
  /* The other half of the same rule. An app file that imported the Arabic
     composer directly would be a screen that knows about Arabic, which is
     what composerFor exists to prevent. */
  for (const file of APP_FILES) {
    let source;
    try {
      source = await readFile(src(file), "utf8");
    } catch (e) {
      continue; /* a screen this release has not written yet */
    }
    const bad = [...source.matchAll(/from\s*["']\.\/numbers\/([\w.-]+)\.tsx?["']/g)]
      .map((m) => m[1])
      /* `nouns` reads a teacher's noun cards for the counting questions:
         word-free, and no composer in it. `spans` names runs of the
         stretches, which are the same in every language. */
      .filter((mod) => !["index", "types", "schema", "range", "generate", "nouns", "spans"].includes(mod));
    assert.deepEqual(
      bad,
      [],
      `${file} reaches into src/numbers/${bad.join(", ")} — ask composerFor(langId) instead`,
    );
  }
});

test("every pack that offers context exercises can actually match a word", () => {
  /* supportsContext is what the app tests before offering anything; a pack
     declaring the block without the function would pass that test and then
     fail at the moment a learner met the question. */
  for (const [id, lang] of Object.entries(LANG.LANGUAGES)) {
    if (!lang.context) continue;
    assert.equal(typeof lang.context.matches, "function", `${id} declares context without matches`);
    if (lang.context.tokens) assert.equal(typeof lang.context.tokens, "function", id);
  }
});
