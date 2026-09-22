/*
 * Numbers and times as a learner actually meets them: dealt into a
 * session, and marked.
 *
 * The words a system builds are checked against a golden table a speaker
 * signed, and that part is thorough. What no test had ever done was ask
 * for a *question* — so the path from a teacher's number document to a
 * question on a learner's screen, which is the whole point of the
 * feature, ran only in a browser. A range that stopped being dealt, or
 * one dealt with two options, or an answer filed under a key nothing
 * reads, would have passed the whole suite.
 *
 * The die is seeded, for the same reason the smoke walk's is: a session
 * is built with chance in it, so an unseeded run would be a slightly
 * different test each time and a failure here could not be reproduced.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

/* Seeded before the trainer is imported, because a module-level draw
   would otherwise happen against the real one. Numerical Recipes'
   constants: a plain linear congruential generator, which is all this
   needs. */
let rolling = 20260922 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".numbers-build");
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
const { buildSession, installIndexes } = await import(path.join(out, "trainer.js"));
const { generate, isRangeSkill } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { renderAsk } = await import(path.join(here, "..", "src", "numbers", "range.ts"));
const { PICK_OPTIONS } = await import(path.join(here, "..", "src", "chance.ts"));
const { EX, NUMBER_EQUIVALENT, TYPES, levelOf } = await import(path.join(here, "..", "src", "languages.ts"));
const { gradeInto } = await import(path.join(here, "..", "src", "grade.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {any} */
const TIME = load("ar-PS.times.json").system;
const SETS = [{ numbers: SYS, times: TIME }];
const settings = { language: "ar-PS" };

const generated = generate({
  composer: arComposer,
  sys: SYS,
  timeComposer: arTimeComposer,
  timeSys: TIME,
  tag: "Numbers",
  now: 1750000000000,
});

/** Every skill in the system, which is what a range question is dealt from. */
const skills = () => generated.items.filter(isRangeSkill);

/** A schedule answered right twice and due, so the level above has opened. */
const solid = () => ({
  ...freshState(), phase: "review", interval: 4, due: Date.now() - 86400000,
  reps: 2, right: 2, hist: [1, 1], updated: Date.now() - 86400000,
});

/** The same skills, with the given exercises already climbed. */
const climbed = (/** @type {string[]} */ types) =>
  skills().map((/** @type {any} */ it) => ({
    ...it,
    forms: [{ ...it.forms[0], s: Object.fromEntries(types.map((t) => [t, solid()])) }],
  }));

/** Deal one, the way a render does. */
const deal = (/** @type {any[]} */ items) => {
  installIndexes(items, settings);
  return buildSession({ items, settings, inDeck: () => true, systems: SETS });
};

/** Several sessions' questions, since which ones come up is drawn. */
const over = (/** @type {any[]} */ items, /** @type {number} */ rounds) => {
  const all = [];
  for (let i = 0; i < rounds; i += 1) all.push(...deal(items).exercises);
  return all;
};

/* ------------------------------------------------------------------
   Dealt
   ------------------------------------------------------------------ */

test("a system's ranges are dealt as questions, each with a number to say", () => {
  const got = deal(skills());
  assert.equal(got.reason, null, got.reason || "");
  assert.ok(got.exercises.length > 0, "nothing was asked at all");

  for (const ex of got.exercises) {
    const skill = must(skills().find((/** @type {any} */ s) => s.id === ex.id), `the skill ${ex.id}`);
    /* Every question is one the range supports and stands on a level. */
    assert.ok(TYPES.includes(ex.type), `${ex.type} is not an exercise`);
    assert.ok(levelOf(ex.type) >= 1, `${ex.type} stands on no level`);
    /* And it carries what is being asked, which is made up when the
       question is dealt and thrown away with the sitting — a range holds
       no words of its own. */
    const ask = must(ex.ask, `${ex.id} was dealt with nothing to ask`);
    assert.equal(ask.rangeId, skill.range.id);
    if (ask.kind === "numbers") {
      assert.ok(ask.value >= skill.range.from && ask.value <= skill.range.to,
        `${ask.value} is outside ${skill.range.from}-${skill.range.to}`);
    } else {
      assert.equal(ask.kind, "time");
      assert.ok(ask.value >= 0 && ask.value <= 23, `hour ${ask.value}`);
      assert.ok((ask.minute || 0) >= 0 && (ask.minute || 0) <= 59, `minute ${ask.minute}`);
    }
  }
});

test("what is asked can actually be said, in the words the teacher wrote", () => {
  /* The rule that keeps a range off the list until the whole of it can be
     built: a question the composer cannot finish is a question with no
     right answer. */
  for (const ex of over(skills(), 6)) {
    const said = renderAsk(must(ex.ask, "an ask"), arComposer, SYS, arTimeComposer, TIME);
    assert.ok(said.text && said.text.trim(), `${ex.id} ${ex.type} said nothing`);
    assert.deepEqual(said.warnings.filter((/** @type {any} */ w) => w.code !== "rounded"), [],
      `${ex.id} ${ex.type}: ${JSON.stringify(said.warnings)}`);
  }
});

test("both kinds are offered: a number to read and a clock to read", () => {
  const kinds = new Set(over(skills(), 8).map((/** @type {any} */ e) => must(e.ask, "an ask").kind));
  assert.deepEqual([...kinds].sort(), ["numbers", "time"]);
});

/* ------------------------------------------------------------------
   The few answers a pick question offers
   ------------------------------------------------------------------ */

test("a number to choose between offers three wrong answers, all of them sayable and distinct", () => {
  /*
   * The wrong answers are numbers worth confusing with the right one —
   * seventy-four beside forty-seven — and only the ones the composer can
   * actually say. Drawn from the learner's vocabulary instead, the
   * question would be a reading test with a number in it.
   */
  const picks = over(climbed(["num2fig", "time2fig"]), 12)
    .filter((/** @type {any} */ e) => EX[e.type] && EX[e.type].picks === "word");
  assert.ok(picks.length > 0, "no question that offers a choice was ever dealt");

  const withOptions = picks.filter((/** @type {any} */ e) => e.options);
  assert.ok(withOptions.length > 0, "not one of them carried any options");

  for (const ex of withOptions) {
    const right = renderAsk(must(ex.ask, "an ask"), arComposer, SYS, arTimeComposer, TIME).text;
    assert.equal(ex.options.length, PICK_OPTIONS - 1,
      `${ex.id}: ${ex.options.length} wrong answers, not ${PICK_OPTIONS - 1}`);
    assert.equal(new Set(ex.options).size, ex.options.length, `two read alike: ${ex.options.join(" / ")}`);
    assert.ok(!ex.options.includes(right), `the right answer was offered as a wrong one: ${right}`);
    for (const o of ex.options) assert.ok(o && o.trim(), "a blank option");
  }
});

test("and one that cannot find three is asked another way rather than with two", () => {
  /*
   * The same fallback the matching grid makes. A question with two
   * options is a coin toss dressed as a question, so the whole of what is
   * dropped is the choosing: the range is still asked, by being written
   * out instead.
   */
  const picks = over(climbed(["num2fig", "time2fig"]), 12)
    .filter((/** @type {any} */ e) => EX[e.type] && EX[e.type].picks === "word");
  const short = picks.filter((/** @type {any} */ e) => !e.options);
  assert.ok(short.length > 0, "no question was ever short of wrong answers, so this rule is untested");
  for (const ex of short) {
    assert.equal(ex.options, undefined, "it was dealt with some options after all");
    assert.ok(ex.ask, "and it is still a question");
  }
});

/* ------------------------------------------------------------------
   Marked
   ------------------------------------------------------------------ */

test("answering a range files the answer against the range's own skill", () => {
  const [skill] = skills();
  const asking = { type: "num2fig", clock: { now: () => 1_700_000_000_000, random: () => 0.5 } };
  const graded = must(
    gradeInto([skill], [{ id: skill.id, subId: null, rating: "good", correct: true, advance: true }], asking),
    "something written",
  );
  const s = must(must(graded[0].forms, "its forms")[0].s, "its schedule");
  assert.ok(s.num2fig, "the skill's own key was not written");
  assert.equal(s.num2fig.right, 1);
  assert.ok(s.num2fig.due > 1_700_000_000_000, "and it was scheduled to come back");
});

test("a wrong answer on a range is a wrong answer like any other", () => {
  const [skill] = skills();
  const asking = { type: "num2fig", clock: { now: () => 1_700_000_000_000, random: () => 0.5 } };
  const graded = must(
    gradeInto([skill], [{ id: skill.id, subId: null, rating: "again", correct: false, advance: true }], asking),
    "something written",
  );
  const s = must(must(graded[0].forms, "its forms")[0].s, "its schedule");
  assert.equal(s.num2fig.wrong, 1);
  assert.deepEqual(s.num2fig.hist, [0]);
  assert.equal(s.num2fig.phase, "learning", "and it comes back within the sitting");
});

test("every exercise a range is asked has an ordinary key to credit its words under", () => {
  /*
   * A right answer says two things and files both: that the learner is
   * getting better at the range, on its own key, and that they read the
   * word for forty and knew what it meant, on each component card's
   * ordinary key. No card climbs a ladder called "num2fig", so a mark
   * written under that name would be a schedule nothing ever reads.
   */
  const asked = new Set(over(climbed(["num2fig", "time2fig"]), 10).map((/** @type {any} */ e) => e.type));
  assert.ok(asked.size > 1, "only one kind of question was ever dealt");
  for (const type of asked) {
    const under = NUMBER_EQUIVALENT[type];
    assert.ok(under, `${type} has no ordinary key to credit a word under`);
    assert.ok(TYPES.includes(under), `${type} credits words under "${under}", which is not an exercise`);
    /* And it is a key an ordinary word actually climbs, which is the
       whole reason the mapping exists. */
    assert.ok(!NUMBER_EQUIVALENT[under], `${type} maps to another range key`);
  }
});
