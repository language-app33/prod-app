/*
 * Copying reported problems out of the app.
 *
 * What is being checked here is a *format*, which is an odd thing to test
 * until you notice what it is for: the export exists so that somebody who
 * did not meet the problem can read it and say what the bug is. Every
 * assertion below is really the same one — that a report taken out of the
 * app still answers the questions somebody fixing the card would ask.
 *
 * So the interesting cases are the incomplete ones. A card deleted since,
 * a card never fetched, a report from a build that did not record what the
 * learner typed: each of those has to read as "this is not known" rather
 * than as "this was empty", because the two send whoever reads it in
 * opposite directions.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";

const { flagsToText } = await import("../src/flag-export.ts");

/* Fixed answers for everything that would otherwise come from a language
   pack, a course record or the reader's own locale — which is the whole
   reason those are passed in rather than imported. */
const names = {
  kind: (/** @type {string} */ k) => (k === "strict" ? "My answer should have been accepted" : k),
  exercise: (/** @type {string} */ lang, /** @type {string} */ type) =>
    type === "ar2en" ? `Arabic script → English (${lang})` : type,
  course: (/** @type {string} */ id) => (id === "c1" ? "Beginners Arabic" : ""),
  deck: (/** @type {string} */ id) => (id === "d1" ? "Around town" : ""),
  when: (/** @type {number} */ at) => `at ${at}`,
};

/** @param {Record<string, any>} [over] */
const flag = (over = {}) => ({
  id: "f1",
  kind: "strict",
  note: "I wrote school and it said no",
  handle: "tariq",
  handleName: "Tariq",
  cardId: "k1",
  exercise: "ar2en",
  subId: null,
  language: "ar-PS",
  prompt: "مدرسة",
  meaning: "school",
  at: 1000,
  courseId: "c1",
  deckId: "d1",
  answer: "school",
  verdict: "wrong",
  release: "0.157 (abc1234)",
  cardState: "here",
  ...over,
});

/** @param {Record<string, any>} [over] */
const card = (over = {}) => ({
  id: "k1",
  lang: "ar-PS",
  forms: [{ ar: "مدرسة", en: "school", lat: "madrasa" }],
  rev: 3,
  ...over,
});

/** @param {any[]} flags @param {Record<string, any>} [cards] */
const text = (flags, cards) =>
  flagsToText(flags, { names, cards, at: 9000, release: "0.157 (abc1234)" });

test("a report carries the question, the answer and the verdict together", () => {
  const out = text([flag()], { k1: card() });
  assert.match(out, /My answer should have been accepted/);
  assert.match(out, /Their words: *I wrote school and it said no/);
  assert.match(out, /Reporter: *Tariq \(tariq\)/);
  assert.match(out, /Asked: *مدرسة/);
  assert.match(out, /Meaning: *school/);
  assert.match(out, /Marked: *wrong/);
  assert.match(out, /Arabic script → English \(ar-PS\)/, "the exercise by its own name");
  assert.match(out, /Course: *Beginners Arabic \(c1\)/, "named, with the id still there to grep");
  assert.match(out, /Deck: *Around town \(d1\)/);
  assert.match(out, /Sent: *at 1000, on app 0\.157 \(abc1234\)/);
});

/* The point of keeping the answer at all is the trailing space and the
   missing letter, and both are invisible unquoted — which is how "it marked
   my answer wrong" stays unanswerable with the answer in front of you. */
test("what the learner typed is quoted, so a stray space is visible", () => {
  const out = text([flag({ answer: "school " })], { k1: card() });
  assert.match(out, /They put: *"school "/);
});

test("the card is written out as it stands now, forms and all", () => {
  const out = text(
    [flag()],
    {
      k1: card({
        forms: [
          { ar: "مدرسة", en: "school", lat: "madrasa", clips: ["h1"] },
          { ar: "مدارس", en: "schools", lat: "madaris", ask: false },
        ],
        note: "irregular plural",
        category: "noun",
        updated: 8000,
      }),
    }
  );
  assert.match(out, /The card as it stands now:/);
  assert.match(out, /word *مدرسة — school — madrasa {2}\[has a recording\]/);
  assert.match(out, /form 2 *مدارس — schools — madaris {2}\[never asked\]/);
  assert.match(out, /note *irregular plural/);
  assert.match(out, /category *noun/);
  assert.match(out, /revision *3, last saved at 8000/);
});

/*
 * Three different silences, and they must not read alike.
 *
 * "Deleted since" tells you the report may be spent. "Not looked up" tells
 * you nothing about the card at all. An export that printed the same line
 * for both would have somebody closing a report whose card is still there.
 */
test("a card that is gone says so; a card that was never fetched says nothing", () => {
  const gone = text([flag({ cardState: "gone" })], { k1: null });
  assert.match(gone, /Card: *k1 — deleted since this was reported/);
  assert.match(gone, /The card is not on the site any more/);

  const unasked = text([flag()], {});
  assert.match(unasked, /Card: *k1$/m, "the id, with nothing claimed after it");
  assert.doesNotMatch(unasked, /not on the site/);
  assert.doesNotMatch(unasked, /The card as it stands now/);
});

test("a card edited since the report says so, because the report may be spent", () => {
  const out = text([flag({ cardState: "edited" })], { k1: card({ rev: 9 }) });
  assert.match(out, /Card: *k1 — edited since this was reported, so it may already be fixed/);
});

/*
 * Reports sent before the app recorded any of this are still reports. What
 * they must not do is read as though the learner answered with nothing.
 */
test("a report from an older build leaves those lines out and says why", () => {
  const old = flag({
    answer: undefined, verdict: undefined, release: undefined,
    courseId: undefined, deckId: undefined,
  });
  const out = text([old], { k1: card() });
  assert.doesNotMatch(out, /They put:/);
  assert.doesNotMatch(out, /Marked:/);
  assert.doesNotMatch(out, /Course:/);
  assert.match(out, /older version of the app/, "with one line saying why they are thin");
  assert.match(out, /Asked: *مدرسة/, "and everything they do carry still there");
});

test("the head counts the thin ones rather than tarring the whole export", () => {
  const out = text([flag(), flag({ id: "f2", verdict: undefined })], { k1: card() });
  assert.match(out, /1 of these was sent by an older version/);
  const all = text([flag({ verdict: undefined }), flag({ id: "f2", verdict: undefined })], {});
  assert.match(all, /These were all sent by an older version/);
});

/*
 * An export pasted into an assistant reads as a job to start, and what
 * comes back is a pile of edits nobody agreed to. The standing instruction
 * at the top asks for the plan first, and it has to be at the *top*: an
 * instruction under the thing it governs is an instruction read second.
 */
test("the export opens by asking for a plan in plain words, not for fixes", () => {
  const out = text([flag()], {});
  assert.match(out, /Do not start fixing anything/);
  assert.match(out, /no file names, no code, no jargon/);
  assert.match(out, /Wait for me to say go/);
  assert.ok(
    out.indexOf("READ THIS FIRST") < out.indexOf("── report 1"),
    "and it comes before the reports it is about"
  );
});

test("the instruction is there even when nothing has been reported", () => {
  assert.match(text([], {}), /Do not start fixing anything/);
});

/* The head is one paragraph and each report is another. Without that, the
   blank line that separates reports separates every line of the preamble
   too, and a ten-report export opens with a page of double-spaced prose. */
test("the head reads as a paragraph, not as one line per line", () => {
  const out = text([flag()], {});
  assert.match(out, /1 report, newest first\.\nExported at 9000/);
  assert.match(out, /where it has, the report says so\.\n\n── report 1 of 1/);
});

test("every report is numbered, in the order it was given", () => {
  const out = text([flag({ id: "a" }), flag({ id: "b" }), flag({ id: "c" })], {});
  assert.match(out, /report 1 of 3/);
  assert.match(out, /report 3 of 3/);
  const at = ["report 1 of 3", "report 2 of 3", "report 3 of 3"].map((s) => out.indexOf(s));
  assert.deepEqual(at.slice().sort((x, y) => x - y), at, "and they run in order down the page");
});

/* The two verdicts that read least and matter most: a card flagged after
   being marked right accepts something it should not, and one flagged after
   its answer was given away is usually unguessable. Neither is "wrong". */
test("being marked right, or having been shown the answer, is not the same as wrong", () => {
  assert.match(text([flag({ verdict: "right" })], {}), /Marked: *right$/m);
  assert.match(text([flag({ verdict: "shown" })], {}), /they had asked to be shown the answer/);
  assert.match(text([flag({ verdict: "unanswered" })], {}), /they flagged the question itself/);
});

test("a paragraph of somebody's words keeps its shape under its label", () => {
  const out = text([flag({ note: "first line\nsecond line" })], {});
  const lines = out.split("\n");
  const at = lines.findIndex((l) => l.startsWith("Their words:"));
  assert.ok(at > 0, "the note is there");
  assert.match(must(lines[at + 1], "the line under it"), /^ +second line$/);
});

test("nothing reported says so, rather than producing an empty file", () => {
  const out = text([], {});
  assert.match(out, /Nothing has been reported/);
  assert.doesNotMatch(out, /report 1 of/);
});

/*
 * The one that shipped broken.
 *
 * A card's word used to live as fields of the card itself with its
 * alternates in `subs`, and cards written that way and never re-saved are
 * still in the store exactly like that — the server hands back what it
 * holds, unmigrated. Reading `card.forms` found nothing on any of them, so
 * every report about one exported as a heading, a revision number and no
 * card at all.
 *
 * Nothing caught it: a card saved through the server is normalised on the
 * way in, so every fixture in this file and every card any test could
 * create came back in the new shape. It took a real export off the real
 * site. Hence a fixture written by hand, in the shape the store actually
 * holds.
 */
test("a card still stored in the old shape is written out, not left blank", () => {
  const out = text([flag()], {
    k1: {
      id: "k1", lang: "ar-PS", rev: 6,
      ar: "عندي سؤال", en: "I have a question", lat: "3indi su2al",
      subs: [{ ar: "عندنا سؤال", en: "we have a question", lat: "3indna su2al" }],
    },
  });
  assert.match(out, /word *عندي سؤال — I have a question — 3indi su2al/);
  assert.match(out, /form 2 *عندنا سؤال — we have a question — 3indna su2al/);
});

test("a conversation card is written out by its lines, not by its empty word", () => {
  const out = text([flag()], {
    k1: card({
      forms: [{ ar: "", en: "At the door", lat: "" }],
      lines: [
        { ar: "مرحبا", en: "hello", lat: "marhaba" },
        { ar: "أهلا", en: "hi", lat: "ahlan" },
      ],
    }),
  });
  assert.match(out, /line 1 *مرحبا — hello — marhaba/);
  assert.match(out, /line 2 *أهلا — hi — ahlan/);
});
