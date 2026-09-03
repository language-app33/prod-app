import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAr, checkViet, checkEn, dimValues, grammarFields } from "../src/languages.js";

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
