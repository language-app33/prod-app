/*
 * The feedback lines that name a form are whole sentences with gaps,
 * filled by name — see src/wording.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { say } from "../src/wording.ts";

test("a line naming a form is one sentence, its gaps filled", () => {
  assert.equal(say("wroteForm", { form: "feminine" }), "You wrote the feminine one.");
  assert.equal(say("blankForm", { word: "tired", form: "plural" }), "tired: plural");
  /* A blank whose word has no English says the form alone. */
  assert.equal(say("blankForm", { word: "", form: "plural" }), "plural");
});
