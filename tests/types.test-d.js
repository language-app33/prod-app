/*
 * Tests for the types themselves.
 *
 * Not run by node. Every line below is checked by `npm run typecheck`, and
 * the assertions are the @ts-expect-error comments: tsc reports an unused
 * directive as an error of its own, so a line marked as wrong that quietly
 * starts compiling fails the build. That is the only way to test that
 * something is *rejected*, and rejection is the whole point of the types.
 *
 * Named .test-d.js so `node --test tests/*.test.mjs` does not try to run
 * it, the way the ecosystem's type-test files are named.
 */
import * as API from "../src/courses-api.ts";
import { langOf } from "../src/languages.ts";

/** @type {import("../src/types.ts").Settings} */
const settings = { language: "ar-PS" };

const base = /** @type {const} */ ({
  kind: "data", note: "", cardId: "k9f2a1b3c4d5",
  exercise: "ar2en", subId: null, prompt: "كِتاب", meaning: "book",
});

/*
 * The bug this whole exercise is named after. langOf() returns the language
 * pack; the report wants its id. It read perfectly well, was accepted by
 * every reader it passed, and reached the server as "[object Object]".
 */
export function packWhereIdWanted() {
  // @ts-expect-error the pack, not its id
  return API.reportFlag({ ...base, language: langOf(settings) });
}

/* And the shape that is actually right. */
export function idAsWanted() {
  return API.reportFlag({ ...base, language: langOf(settings).id });
}

/* A kind the app does not offer cannot be reported: the server refuses it
   at run time, and there is no reason to find that out over the network. */
export function unknownKind() {
  // @ts-expect-error "vibes" is not one of the three
  return API.reportFlag({ ...base, kind: "vibes", language: "ar-PS" });
}

/* The other half of the same story: a card has two names, and only one of
   them means anything to the server. This one cannot be caught by type —
   both are strings — which is why it is a test in cards.test.mjs and a
   note here rather than an assertion. */
