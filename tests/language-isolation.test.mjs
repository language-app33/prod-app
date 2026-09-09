// @ts-check
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
import path from "node:path";
import * as LANG from "../src/languages.js";

const here = path.dirname(new URL(import.meta.url).pathname);
const src = (name) => path.join(here, "..", "src", name);

/* Everything that renders or drives the app. languages.js is the one file
   allowed to know about languages, so it is not in this list. */
const APP_FILES = ["ArabicTrainer.jsx", "spaces.jsx", "shared.jsx", "gallery.jsx", "screen-elements.js", "sync.js", "storage.js", "courses-api.js", "scheduler.js"];

/* A name belongs to one language if it is prefixed with that language, in
   either of the two spellings the file uses: ar/Ar for Arabic, vi/Viet for
   Vietnamese, he/He for Hebrew. Add a prefix here when a fourth arrives. */
const LANGUAGE_SPECIFIC = /^(ar|vi|he)[A-Z]|^(norm|check|split)(Ar|Viet|He)$/;

function importedNames(source) {
  const m = source.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/languages\.js["']/);
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
const ALLOWED_SCRIPT = {
  /* The card sheet's placeholder — "the form". Behind OWN_CARDS, so unreachable.
     The importer's worked example used to be here too; it now comes from the
     pack of whichever language is being learnt. */
  "ArabicTrainer.jsx": ["الشكل"],
  /* The wordmark on the first screen: "vocabulary". */
  "spaces.jsx": ["مُفْرَدات"],
  /* Specimens, which are the point of a gallery. */
  "gallery.jsx": ["كِتَاب", "كُتُب"],
  /* Examples of what each element holds, which are the point of the list. */
  "screen-elements.js": ["كِتاب", "الكتاب كبير", "كُتُب"],
};

for (const file of APP_FILES) {
  test(`${file} holds no Arabic or Hebrew beyond the strings already accounted for`, async () => {
    const source = await readFile(src(file), "utf8");
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
