import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAr,
  checkViet,
  checkEn,
  dimValues,
  grammarFields,
  labelFor,
  normDimValue,
  GRAMMAR,
  LANGUAGES,
  TYPES,
  EX,
} from "../src/languages.js";

test("Arabic: bare letters accepted, wrong harakat rejected, missing harakat depends on setting", () => {
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "either" }).ok, true);
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "required" }).reason, "missing");
  assert.equal(checkAr("كُتَاب", "كِتَاب", { tashkeel: "either" }).reason, "harakat");
});

test("Vietnamese: tone marks behave like harakat; đ is its own letter", () => {
  assert.equal(checkViet("ma", "má", { tones: "either" }).ok, true);
  assert.equal(checkViet("ma", "má", { tones: "required" }).reason, "missing");
  assert.equal(checkViet("mà", "má", { tones: "either" }).reason, "harakat");
  assert.equal(checkViet("di", "đi", { tones: "either" }).ok, false);
});

test("English: leading articles and alternatives are forgiven", () => {
  assert.equal(checkEn("the book", "book").ok, true);
  assert.equal(checkEn("desk", "office / desk").ok, true);
  assert.equal(checkEn("bok", "book").reason, "near");
});

test("dimValues carries every declared field, including a Vietnamese classifier", () => {
  const out = dimValues({ number: "plural", classifier: " con " });
  assert.equal(out.number, "plural");
  assert.equal(out.classifier, "con");
  for (const f of grammarFields()) assert.ok(f in out, `missing ${f}`);
});

/* --- number, and its "not applicable" --- */

test("a new form's number is the one the language declares, not the first option listed", () => {
  /* The order of options is what a stored value is matched against, so the
     default has to be stated rather than inferred from position. */
  assert.equal(GRAMMAR.number.options[0][0], "singular");
  assert.equal(GRAMMAR.number.default, "na");
  assert.equal(dimValues({}).number, "na");
});

test("a number already stored keeps its meaning", () => {
  /* The point of not reordering the options: an existing card must not be
     retranslated by the arrival of a new one. */
  assert.equal(dimValues({ number: "singular" }).number, "singular");
  assert.equal(dimValues({ number: "plural" }).number, "plural");
});

test("an imported \"n/a\" lands on N/A", () => {
  assert.equal(normDimValue(GRAMMAR.number, "n/a"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "N/A"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "na"), "na");
  /* And the two that were there before still win their own prefixes. */
  assert.equal(normDimValue(GRAMMAR.number, "pl"), "plural");
  assert.equal(normDimValue(GRAMMAR.number, "sing"), "singular");
});

test("a form whose number doesn't apply carries no number label", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.equal(labelFor({ number: "na", gender: "" }, ar), "");
  assert.equal(labelFor({ number: "na", gender: "feminine" }, ar), "f.");
  assert.equal(labelFor({ number: "plural", gender: "feminine" }, ar), "pl. f.");
});

/* --- the retired exercise --- */

test("typing the transliteration is not offered", () => {
  assert.equal(TYPES.includes("ar2tr"), false);
  /* Reading one still is: it is the prompt there, not the answer. */
  assert.equal(TYPES.includes("tr2ar"), true);
  assert.equal(TYPES.every((t) => EX[t].answerField !== "lat"), true);
});

test("the retired definition stays, so a stored reference still resolves", () => {
  /* exOf returns null for an unknown key and its callers dereference it, so
     deleting the entry would turn old data into a crash. */
  assert.ok(EX.ar2tr);
  assert.equal(EX.ar2tr.retired, true);
});
