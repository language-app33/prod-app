import { test } from "node:test";
import assert from "node:assert/strict";
import { liftSubtypeTags, liftSubtypeTagsIn } from "../src/subtype-tags.ts";
import { LANGUAGES } from "../src/languages.ts";

const lang = /** @type {any} */ (LANGUAGES)["ar-PS"];

test("a card with no subtype takes the one its tag names, and the tag goes", () => {
  const out = liftSubtypeTags({ id: "a", fills: ["name", "colour"] }, lang);
  assert.equal(out && out.category, "name");
  assert.deepEqual(out && out.fills, ["colour"]);
});

test("a card of that subtype just loses the tag", () => {
  const out = liftSubtypeTags({ id: "a", category: "name", fills: ["name"] }, lang);
  assert.equal(out && out.category, "name");
  assert.equal(out && out.fills, undefined);
});

test("a card of another subtype keeps it, and the tag still goes", () => {
  const out = liftSubtypeTags({ id: "a", category: "noun", fills: ["name", "colour"] }, lang);
  assert.equal(out && out.category, "noun");
  assert.deepEqual(out && out.fills, ["colour"]);
});

test("a custom {{word}} tag goes without setting a subtype", () => {
  const out = liftSubtypeTags({ id: "a", fills: ["word"] }, lang);
  assert.equal(out && out.category, "");
  assert.equal(out && out.fills, undefined);
});

test("nothing to fold is no change, and so is running it twice", () => {
  assert.equal(liftSubtypeTags({ id: "a", fills: ["colour"] }, lang), null);
  const once = liftSubtypeTags({ id: "a", fills: ["name"] }, lang);
  assert.equal(liftSubtypeTags(once, lang), null);
});

test("a sentence, or a card in a language nobody knows, is left alone", () => {
  assert.equal(liftSubtypeTags({ id: "a", sentence: true, fills: ["name"] }, lang), null);
  assert.equal(liftSubtypeTagsIn({ id: "a", fills: ["name"] }, "xx-XX"), null);
});
