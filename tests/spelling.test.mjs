/*
 * Where a spelling went wrong.
 *
 * "Not quite" and the right answer underneath is a true thing to say and a
 * poor thing to learn from. What is checked here is that the pointing
 * finger points at the right letter — and, just as much, that it stays
 * down where there is nothing to point at, because a mark that
 * contradicts the verdict beside it is worse than no mark at all.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { TYPO_MIN_LETTERS, spellDistance, spellRuns, typoed } from "../src/spelling.ts";
import { LANGUAGES } from "../src/languages.ts";
import { must } from "./helpers.mjs";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi-Hue"];
const he = LANGUAGES["he-IL"];

/** One side of a marking, as a string with the marked stretches in [ ]. */
const show = (/** @type {import("../src/spelling.ts").Run[]} */ runs) =>
  runs.map((r) => (r.wrong ? `[${r.text}]` : r.text)).join("");

/** How a language folds one character — every pack here declares one. */
const foldOf = (/** @type {any} */ lang, /** @type {any} */ settings) =>
  /** @type {(ch: string) => string} */ (
    (ch) => must(lang.letter, `${lang.id} declares a fold`)(ch, settings)
  );

/** The marking, through a language's own fold. */
const mark = (
  /** @type {any} */ lang,
  /** @type {string} */ given,
  /** @type {string | string[]} */ expected,
  /** @type {any} */ settings = {},
) => spellRuns(given, expected, foldOf(lang, settings));

test("a letter written in place of another is marked on both sides", () => {
  const m = mark(ar, "كتاف", "كتاب");
  assert.equal(m.wrong, true);
  assert.equal(show(m.yours), "كتا[ف]");
  assert.equal(show(m.theirs), "كتا[ب]");
});

test("a letter left out is marked on the answer, where it is the only mark there is", () => {
  const m = mark(ar, "كتب", "كتاب");
  assert.equal(m.wrong, true);
  /* Nothing they wrote is wrong — every letter of it is in the word. What
     is wrong is what is not there, and it can only be shown on the answer:
     this is the half the feature would be useless without. */
  assert.equal(show(m.yours), "كتب");
  assert.equal(show(m.theirs), "كت[ا]ب");
});

test("a letter too many is marked in what they wrote", () => {
  const m = mark(ar, "كتااب", "كتاب");
  assert.equal(show(m.yours), "كت[ا]اب");
  assert.equal(show(m.theirs), "كتاب");
});

test("what is not a letter is never a mistake, and never lost", () => {
  /* A harakat is not a letter: the word is spelt right, and the verdict
     that marks it down has its own sentence about the marks. */
  const marks = mark(ar, "كِتاب", "كتاب");
  assert.equal(marks.wrong, false);
  assert.equal(show(marks.yours), "كِتاب", "the harakat came back out");

  /* Nor is a space. Where a word ends and the next begins is a matter of
     convention in Arabic, which is why the marking folds them away too. */
  const space = mark(ar, "الحمدلله", "الحمد لله");
  assert.equal(space.wrong, false);
  assert.equal(show(space.theirs), "الحمد لله", "the space came back out");
});

test("a harakat is highlighted with the letter it sits on, not beside it", () => {
  const m = mark(ar, "كِتاف", "كتاب");
  /* The mark rides on its letter, so the highlight is one stretch and not
     a letter, a gap, and a floating vowel. */
  assert.equal(show(m.yours), "كِتا[ف]");
});

test("what a language folds together is not a mistake in it", () => {
  /* A learner who has said hamza is not being tested is not told they got
     a letter wrong for typing ا where the card says أ. The fold is the
     marking's own, so the two answers cannot disagree. */
  assert.equal(mark(ar, "احمد", "أحمد", { ignoreHamza: true }).wrong, false);
  assert.equal(mark(ar, "احمد", "أحمد", { ignoreHamza: false }).wrong, true);
});

test("the closest of several accepted spellings is the one marked against", () => {
  /* A card taking كتاب and سفر should say "you were reaching for this one,
     and here is the letter" rather than hold up whichever the teacher
     typed first. */
  const m = mark(ar, "سفف", ["كتاب", "سفر"]);
  assert.equal(show(m.yours), "سف[ف]");
  assert.equal(show(m.theirs), "سف[ر]");
  /* And an answer that is simply one of them has nothing marked at all. */
  assert.equal(mark(ar, "سفر", ["كتاب", "سفر"]).wrong, false);
});

test("a tone is not a letter in Huế, and a horn is", () => {
  /* Each of these is the marking's own answer, read back through the fold
     the marking uses — which is the whole reason the fold is the pack's
     and not this module's. A word typed without its tones is accepted, so
     there is no letter to point at; ơ and o are two letters and the check
     says so, so there is. */
  const tones = { tones: "either" };
  assert.equal(vi.check("cam ơn", "cảm ơn", tones).ok, true);
  assert.equal(mark(vi, "cam ơn", "cảm ơn", tones).wrong, false, "a bare tone is not a letter");

  assert.equal(vi.check("cam on", "cảm ơn", tones).ok, false);
  const horn = mark(vi, "cam on", "cảm ơn", tones);
  assert.equal(show(horn.yours), "cam [o]n", "the horn is a letter of its own");
  assert.equal(show(horn.theirs), "cảm [ơ]n");

  const m = mark(vi, "cảm ơm", "cảm ơn", tones);
  assert.equal(show(m.yours), "cảm ơ[m]");
});

test("a word with nothing of the answer in it is not a misspelling", () => {
  /* Every letter wrong is a word they did not know rather than one they
     spelt wrong, and painting all of it says nothing the verdict has not
     said. */
  assert.equal(mark(ar, "سفر", "كتاب").wrong, false);
  /* But a word one letter short still carries its mark — on the answer,
     which is the only side that case has one. */
  const short = mark(ar, "كتب", "كتاب");
  assert.equal(short.wrong, true);
  assert.equal(show(short.theirs), "كت[ا]ب");
});

test("Hebrew marks its letters and not its niqqud", () => {
  assert.equal(mark(he, "ספר", "ספר").wrong, false);
  const m = mark(he, "ספד", "ספר");
  assert.equal(show(m.yours), "ספ[ד]");
  assert.equal(show(m.theirs), "ספ[ר]");
});

test("nothing to mark comes back whole and unmarked", () => {
  for (const [given, expected] of [
    ["", "كتاب"],
    ["كتاب", ""],
    ["كتاب", "كتاب"],
  ]) {
    const m = spellRuns(given, expected, foldOf(ar, {}));
    assert.equal(m.wrong, false, `${given || "(nothing)"} vs ${expected || "(nothing)"}`);
  }
  /* A language that declares no fold has its answers marked exactly as
     before and nothing highlighted — the one thing a pack must be able to
     opt out of without every reader learning about it. */
  const none = spellRuns("كتاف", "كتاب", null);
  assert.equal(none.wrong, false);
  assert.equal(show(none.yours), "كتاف");
  assert.equal(show(none.theirs), "كتاب");
});

test("every character comes back, in order, whatever was marked", () => {
  /* The runs are what the screen draws in place of the word, so joining
     them has to give the word back — anything else is a letter the learner
     typed and cannot see. */
  const cases = [
    ["كتاف", "كتاب"],
    ["كِتَاب", "كتاب"],
    ["الحمدلله", "الحمد لله"],
    ["سفف", "كتاب / سفر"],
    ["ا", "كتاب"],
  ];
  for (const [given, expected] of cases) {
    const m = mark(ar, given, expected);
    assert.equal(m.yours.map((r) => r.text).join(""), given, `yours: ${given}`);
    assert.equal(
      m.theirs.map((r) => r.text).join(""),
      Array.isArray(expected) ? expected[0] : expected,
      `theirs: ${expected}`,
    );
  }
});

/* ------------------------------------------------------------------
   One letter out is a slip of the finger

   The benefit of the doubt, and deliberately a narrow one: the question
   is asked again rather than counted as a miss, so a mistyped letter
   cannot put a card's passes back to nought and cost four days. What is
   checked here is mostly where the doubt runs out — two letters, and
   short words, where one letter is a different word rather than a slip.
   ------------------------------------------------------------------ */

/** Whether a language would read this answer as a typo. */
const slip = (
  /** @type {any} */ lang,
  /** @type {string} */ given,
  /** @type {string | string[]} */ expected,
  /** @type {any} */ settings = {},
) => typoed(given, expected, foldOf(lang, settings));

test("a typo is one letter out, in any of the three ways a letter goes wrong", () => {
  /* كِتاب — four letters, so long enough for one of them to be a slip. */
  assert.equal(slip(ar, "كتاب", "كتاب"), false, "a right answer is not a typo");
  assert.equal(slip(ar, "كتاث", "كتاب"), true, "one letter written in place of another");
  assert.equal(slip(ar, "كتا", "كتاب"), true, "one letter left out");
  assert.equal(slip(ar, "كتااب", "كتاب"), true, "one letter too many");
  assert.equal(slip(ar, "كثاث", "كتاب"), false, "two letters out is not a typo");
  assert.equal(slip(ar, "", "كتاب"), false, "and nothing written is not a typo either");
});

test("the doubt runs out on a short word, where one letter is a different word", () => {
  /* بيت — three letters. One of them is a third of the word, and this
     script is full of three-letter words a letter apart. */
  assert.equal(slip(ar, "بنت", "بيت"), false, "three letters is under the bar");
  assert.equal(slip(ar, "كتاب", "كتاث"), true, "four is over it");
  assert.equal(TYPO_MIN_LETTERS, 4);
  /* And the bar is the *answer's* length, not the typed word's — which is
     what keeps a letter left out of a four-letter word a typo, since what
     is on the screen is then three letters long. */
  assert.equal(slip(ar, "كتا", "كتاب"), true);
});

test("what counts as a letter is the language's own fold, here as everywhere", () => {
  /* Harakat fold to nothing, so they neither lengthen a word nor count as
     a letter to get wrong: a spelling right in its letters and wrong in
     its marks is nought letters out, which is the near miss the pack
     already has a verdict for and not a typo. */
  assert.equal(slip(ar, "كِتاب", "كتاب"), false, "harakat are not a letter out");
  assert.equal(slip(ar, "كَتاث", "كتاب"), true, "and do not stop the letter under them being one");
  /* Vietnamese tones the same way, where the pack folds them. */
  assert.equal(spellDistance("khống", "không", foldOf(vi, {})), 0,
    "a tone mark folds away, so the word is nought letters out");
  assert.equal(spellDistance("khong", "không", foldOf(vi, {})), 1,
    "but ô and o are two letters and not one letter marked");
});

test("the closest accepted spelling is the one judged against", () => {
  /* A card taking two words is judged on the one the learner was plainly
     reaching for, as the marking is — not on whichever the teacher typed
     first. */
  assert.equal(slip(ar, "سفار", ["كتاب", "سفر"]), false, "two out of the near one, not one out of the far");
  assert.equal(slip(ar, "كتاث", ["كتاب", "سفر"]), true);
});
