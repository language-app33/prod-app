/*
 * The order a session comes in, and what a wrong answer does to it.
 *
 * Both of these decide what a learner actually sees, and neither had a test
 * — which is how "the same card twice running" and "the identical question
 * stuck on the end" survived as long as they did. They are plain functions
 * of a list, so they can be checked here rather than by playing a session.
 *
 * The third is the mark a learner puts on a card, which the session builder
 * and the count on the home screen both read through one function.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".session-build");

/* Bundled the way the smoke harness and the card tests do it: the trainer
   is JSX and imports React, and nothing in it touches a browser on the way
   in. React is left external, and node resolves that from node_modules
   relative to the file doing the importing. */
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { varyTypes, requeueMissed, isUrgent } = await import(path.join(out, "trainer.js"));

/** @param {string} id @param {string} type */
const q = (id, type) => ({ id, type, subId: null });
/** @param {any[]} list */
const ids = (list) => list.map((/** @type {any} */ x) => x.id).join(" ");
/** Any two questions side by side about the same card. */
const backToBack = (/** @type {any[]} */ list) =>
  list.some((/** @type {any} */ x, /** @type {number} */ i) => i > 0 && x.id === list[i - 1].id);

/* ------------------------------------------------------------------
   Spacing a session out
   ------------------------------------------------------------------ */

test("a session of two forms each does not ask one card twice running", () => {
  /* Three cards, two exercises apiece, arriving grouped by card — which is
     how the interleave hands them over. */
  const list = [
    q("a", "ar2en"), q("a", "en2ar"),
    q("b", "ar2en"), q("b", "en2ar"),
    q("c", "ar2en"), q("c", "en2ar"),
  ];
  const got = varyTypes(list);
  assert.equal(got.length, list.length, "nothing is lost or invented");
  assert.equal(backToBack(got), false, `same card twice running: ${ids(got)}`);
});

test("the card comes before the exercise type when it cannot have both", () => {
  /*
   * The old order of the fallbacks, and the whole of this fix.
   *
   * Two cards, and only one exercise type between them beyond the opener.
   * A pass that asks for a different type first has nowhere to go and
   * takes another angle on the card just asked; asking for a different
   * card first gets two words in a row, said the same way, which is the
   * far smaller sin.
   */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("b", "ar2en")];
  const got = varyTypes(list);
  assert.equal(got.length, 3);
  assert.deepEqual(ids(got), "a b a", "the other word goes between, said the same way");
});

test("a card with nothing to alternate with is still dealt", () => {
  /* One card, three exercises: there is no other card, so it is asked three
     times and the pass must not drop or loop on any of them. */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("a", "tr2ar")];
  const got = varyTypes(list);
  assert.equal(got.length, 3);
  assert.deepEqual(
    [...new Set(got.map((/** @type {any} */ x) => x.type))].sort(),
    ["ar2en", "en2ar", "tr2ar"],
    "each of them once"
  );
});

test("an empty queue comes back empty", () => {
  assert.deepEqual(varyTypes([]), []);
});

/* ------------------------------------------------------------------
   A question answered wrong
   ------------------------------------------------------------------ */

test("a missed question goes to the back of what is left", () => {
  /* The gap is the size of the rest of the session, which is what makes it
     a retest rather than a copy: a long session re-asks it in fifteen
     questions' time, a short one in three. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("c", "ar2en"), q("d", "ar2en"), q("e", "ar2en")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a b c d e a");
  assert.equal(got.length, 6, "one question more than there was");
});

test("it is the same question, not a different one about the card", () => {
  /* Deliberate: the point of asking again is to test the thing that
     failed. What was wrong was where it went, not what it was. */
  const list = [q("a", "en2ar"), q("b", "ar2en"), q("c", "ar2en"), q("d", "ar2en")];
  const got = requeueMissed(list, 1, list[0]);
  const again = got.slice(1).find((/** @type {any} */ x) => x.id === "a");
  assert.equal(again.type, "en2ar");
});

test("two misses on one card do not land side by side", () => {
  /* The fault. Both retries went onto the end blind, so a card whose two
     questions were both missed finished the session twice in a row. */
  let list = [q("a", "ar2en"), q("b", "ar2en"), q("a", "en2ar"), q("c", "ar2en"), q("d", "ar2en")];
  list = requeueMissed(list, 1, list[0]);
  const second = list.findIndex((/** @type {any} */ x) => x.id === "a" && x.type === "en2ar");
  list = requeueMissed(list, second + 1, list[second]);
  assert.equal(backToBack(list), false, `same card twice running: ${ids(list)}`);
});

test("a retry comes forward off the card's own question at the end of the queue", () => {
  /* The same rule the queue was built with, and it has to hold on both
     sides: stopping in front of the card's other question is as bad as
     stopping behind it. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("c", "ar2en"), q("a", "en2ar")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a b a c a");
  assert.equal(backToBack(got), false);
});

test("and where nothing at the back is clear, it goes to the back anyway", () => {
  /* Everything left is the card's own, so there is no clean slot to find
     and the end is where it used to go. */
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("a", "tr2ar")];
  const got = requeueMissed(list, 1, list[0]);
  assert.deepEqual(ids(got), "a a a a");
});

test("missing the last question of a session still asks it again", () => {
  /* Standing next to itself is only a fault while there is something to
     stand between. Dropping it instead would end a session of one question
     the moment it was got wrong, having taught nothing. */
  const list = [q("a", "ar2en"), q("b", "ar2en"), q("z", "ar2en")];
  const got = requeueMissed(list, 3, list[2]);
  assert.deepEqual(ids(got), "a b z z");
});

test("what is already answered is never moved", () => {
  const list = [q("a", "ar2en"), q("a", "en2ar"), q("b", "ar2en")];
  /* Both of "a"'s questions are behind us; the second was the miss. */
  const got = requeueMissed(list, 2, list[1]);
  assert.deepEqual(
    ids(got.slice(0, 2)),
    "a a",
    "the answered pair stays exactly where it was"
  );
  assert.equal(got.length, 4);
});

/* ------------------------------------------------------------------
   A card the learner asked for
   ------------------------------------------------------------------ */

/* Enough of a card to be dealt: two exercises are the minimum anything is
   asked on, and the script plus a meaning is what supports them. */
const settings = { language: "ar-PS", kinds: { word: true } };
/** @param {any} over */
const card = (over) => ({
  id: "c1", lang: "ar-PS", kind: "word", tags: [], created: 0,
  forms: [{ id: "c1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s: {} }],
  ...over,
});

test("an unmarked card is not urgent", () => {
  assert.equal(isUrgent(card({}), settings), false);
});

test("a marked card is urgent, whatever its schedule says", () => {
  /* Far future on everything it could be asked: without the mark this card
     is not waiting for anything. */
  const far = Date.now() + 400 * 86400000;
  /** @type {Record<string, any>} */
  const s = {};
  for (const t of ["ar2en", "en2ar", "ar2pick", "en2pick", "match", "tr2ar"]) {
    s[t] = { phase: "review", step: 0, ease: 2.5, interval: 300, due: far,
      reps: 9, lapses: 0, right: 9, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0 };
  }
  const it = card({ priority: true, forms: [{ id: "c1", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", s }] });
  assert.equal(isUrgent(it, settings), true);
});

test("a marked card with nothing to ask is not urgent", () => {
  /* The guard that keeps the home screen honest: a card with one word and
     nothing to pair it with supports no exercise, so marking it must not
     count it as waiting for a session that would then not include it. */
  const bare = card({ priority: true, forms: [{ id: "c1", ar: "كِتاب", en: "", lat: "", lang: "ar-PS", s: {} }] });
  assert.equal(isUrgent(bare, settings), false);
});
