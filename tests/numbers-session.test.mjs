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
const { buildSession, buildManualSession, buildWeakSession, installIndexes, tokenCards } = await import(path.join(out, "trainer.js"));
const { generate, isRangeSkill } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { askFor, renderAsk } = await import(path.join(here, "..", "src", "numbers", "range.ts"));
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

/** And every stretch of the number line cleared but the top one, so the
    big numbers are dealt — each waits on the stretch below it. */
const opened = (/** @type {any[]} */ items) =>
  items.map((/** @type {any} */ it) =>
    ["numbers:0-9", "numbers:10-19", "numbers:20-99", "numbers:100-999"].includes(it.range.id)
      ? { ...it, forms: [{ ...it.forms[0], s: { ...Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, solid()])), ...it.forms[0].s } }] }
      : it);

/** The skills, with the named ones cleared at every exercise there is. */
const clearedOnly = (/** @type {string[]} */ ids) =>
  skills().map((/** @type {any} */ it) =>
    ids.includes(it.range.id)
      ? { ...it, forms: [{ ...it.forms[0], s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, solid()])) }] }
      : it);

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
  const picks = over(opened(climbed(["num2fig", "time2fig"])), 12)
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
   * out instead. Zero is the number that is short — nothing is a digit
   * away from it below — so it is looked for where it lives, in 0 to 9:
   * the skill under forty ids over eight sessions, since which number a
   * skill is asked is drawn from its id and its turn.
   */
  const zeroToNine = must(
    climbed(["num2fig"]).find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"),
    "0 to 9",
  );
  const digits = Array.from({ length: 40 }, (_, i) => ({ ...zeroToNine, id: `${zeroToNine.id}#${i}` }));
  const picks = over(digits, 8)
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

/* ------------------------------------------------------------------
   Which word cards an answer credits
   ------------------------------------------------------------------ */

/** The cards a rendered asking credits, as `slot@form` names. @param {any} ask @param {any[]} pool */
const credited = (ask, pool = generated.items) =>
  /** @type {string[]} */ (tokenCards(renderAsk(ask, arComposer, SYS, arTimeComposer, TIME).tokens, SYS.id, TIME.id, pool)
    .map((/** @type {any} */ { card, form }) => `${card.id.split(":").slice(2).join(":")}@${form.id.split("~").pop()}`));

test("a time credits the clock's own words, not only the numbers in it", () => {
  /* Looked up under the numbers alone, "quarter past" and "in the
     evening" were never credited however often they were read. */
  const quarter = credited({ rangeId: "time:quarters-halves", kind: "time", value: 7, minute: 15, style: "colloquial", period: false });
  assert.ok(quarter.some((c) => c.startsWith("min.15@")), quarter.join(" "));
  assert.ok(quarter.some((c) => c.startsWith("hour.word@")), quarter.join(" "));
  const evening = credited({ rangeId: "time:periods", kind: "time", value: 19, minute: 0, style: "colloquial", period: true });
  assert.ok(evening.some((c) => c.startsWith("period.")), evening.join(" "));
  /* And every word of every time a learner can be asked is a card. */
  for (const range of arTimeComposer.ranges()) {
    for (let i = 0; i < 60; i += 1) {
      const ask = askFor(range, `t${i}`, SYS, arComposer, TIME, arTimeComposer);
      const words = renderAsk(ask, arComposer, SYS, arTimeComposer, TIME).tokens.filter((/** @type {any} */ t) => t.slot || t.override);
      assert.equal(credited(ask).length >= words.length, true, `${range.id}: ${words.length} words, ${credited(ask).length} credited`);
    }
  }
});

test("a numeral is credited on the face it was said in", () => {
  /* The hour is feminine, so one o'clock says the feminine one — the
     form of its own a learner climbs for it, not the counting form. */
  const one = credited({ rangeId: "time:hours", kind: "time", value: 1, minute: 0, style: "colloquial", period: false });
  assert.ok(one.includes("unit.1@f"), one.join(" "));
  assert.ok(!one.includes("unit.1@standalone"), one.join(" "));
});

test("a counted noun is credited on its own card, on the form the number called for", () => {
  const book = {
    id: "c-book", lang: "ar-PS", kind: "word", tags: [],
    forms: [
      { id: "c-book", ar: SYS.nouns[0].sg, en: "book", lat: "", s: {} },
      { id: "c-book-pl", ar: SYS.nouns[0].pl, en: "books", lat: "", s: {} },
    ],
  };
  const sys = { ...SYS, nouns: [{ ...SYS.nouns[0], id: "c-book" }] };
  const tokens = renderAsk({ rangeId: "numbers:count-3-10", kind: "numbers", value: 3, nounId: "c-book" }, arComposer, sys).tokens;
  const got = tokenCards(tokens, sys.id, "", [...generated.items, book]);
  const noun = got.find((/** @type {any} */ c) => c.card.id === "c-book");
  assert.ok(noun, "the noun's card was not credited");
  assert.equal(must(noun, "noun").form.id, "c-book-pl", "three books is the plural read");
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

/* ------------------------------------------------------------------
   Built by hand, and the weak-skills sitting
   ------------------------------------------------------------------ */

/** Every question in a session about a range carries a number that can be said. */
const allSaid = (/** @type {any[]} */ exercises, /** @type {string} */ how) => {
  const ranged = exercises.filter((/** @type {any} */ e) => isRangeSkill({ id: e.id }));
  assert.ok(ranged.length > 0, `${how}: no range was asked at all, so this proves nothing`);
  for (const ex of ranged) {
    const ask = must(ex.ask, `${how}: ${ex.id} ${ex.type} was dealt with nothing to ask`);
    const said = renderAsk(ask, arComposer, SYS, arTimeComposer, TIME);
    assert.ok(said.text && said.text.trim(), `${how}: ${ex.id} ${ex.type} said nothing`);
  }
};

test("a session built by hand draws a number for every range it asks, in every mode", () => {
  /*
   * The custom practice screen was the one door that never drew one: its
   * modes other than Regular took the skills like any card and dealt them
   * bare, and the learner met "Read the number" over an empty space.
   */
  const items = climbed(["num2fig", "time2fig"]);
  installIndexes(items, settings);
  const ids = items.map((/** @type {any} */ i) => i.id);
  for (const mode of ["regular", "ultimate", "started"]) {
    const got = buildManualSession({ items, settings, ids, mode, count: 45, systems: SETS });
    assert.equal(got.reason, null, `${mode}: ${got.reason}`);
    allSaid(got.exercises, mode);
  }
});

test("and so does a sitting of what is going wrong", () => {
  const missed = { ...solid(), phase: "learning", wrong: 2, hist: [0, 0], due: Date.now() - 1000 };
  const items = skills().map((/** @type {any} */ it) => ({
    ...it,
    forms: [{ ...it.forms[0], s: { num2fig: missed, time2fig: missed } }],
  }));
  installIndexes(items, settings);
  const got = buildWeakSession({ items, settings, inDeck: () => true, systems: SETS });
  assert.equal(got.reason, null, got.reason || "");
  allSaid(got.exercises, "weak");
});

test("a range whose system is not on this device is not asked by hand either", () => {
  const items = climbed(["num2fig", "time2fig"]);
  installIndexes(items, settings);
  const got = buildManualSession({
    items, settings, ids: items.map((/** @type {any} */ i) => i.id), mode: "ultimate", systems: [],
  });
  assert.equal(got.exercises.length, 0, "a range was dealt with no system to say it");
});

/* ------------------------------------------------------------------
   The words first

   A learner who knows *forty* and *seven* knows *forty-seven* — and one
   who does not know *forty* yet cannot be asked it. A number waits until
   every word in it is recognised: its meaning answered right twice
   running, which is what opens level two of the word's own ladder.
   ------------------------------------------------------------------ */

const { companyOf, contextIndexOf } = await import(path.join(out, "trainer.js"));
const { wordsOfAsk, isFromSystem } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));

/** The cards the system made that are words rather than skills. */
const words = () => generated.items.filter((/** @type {any} */ it) => !isRangeSkill(it));

/** A word with every exercise on the given levels climbed. */
const climbedTo = (/** @type {any} */ it, /** @type {(level: number) => boolean} */ on) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f, /** @type {number} */ i) =>
    i ? f : { ...f, s: Object.fromEntries(TYPES.filter((/** @type {string} */ t) => on(levelOf(t))).map((/** @type {string} */ t) => [t, solid()])) }),
});
/** Recognised, and nothing more. */
const recognised = (/** @type {any} */ it) => climbedTo(it, (l) => l === 1);
/** Every exercise climbed, so any of them can be dealt. */
const known = (/** @type {any} */ it) => climbedTo(it, () => true);

const SET = { composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME };
const IDS = new Set(words().map((/** @type {any} */ it) => it.id));
const rangeOf = (/** @type {string} */ id) =>
  must(skills().find((/** @type {any} */ s) => s.range.id === id), `the range ${id}`);

/** Deal with everything held but only some of it in the deck. */
const dealIn = (/** @type {any[]} */ items, /** @type {(it: any) => boolean} */ inDeck) => {
  installIndexes(items, settings);
  return buildSession({ items, settings, inDeck, includeAll: true, systems: SETS });
};

test("no number is asked while none of its words is recognised", () => {
  const items = skills().concat(words());
  const asked = [];
  for (let i = 0; i < 10; i += 1) asked.push(...dealIn(items, () => true).exercises);
  assert.ok(asked.length > 0, "nothing was asked at all — the words should have been");
  assert.deepEqual(asked.filter((e) => isRangeSkill(e)).map((e) => e.id), [], "a number was asked before its words");
});

test("a number is asked once its words are recognised, and only numbers whose words are", () => {
  const fortySeven = wordsOfAsk({ rangeId: "numbers:20-99", kind: "numbers", value: 47 }, SET, IDS);
  assert.ok(fortySeven.size >= 2, `47 is built of ${[...fortySeven].join(", ")}`);
  /* The stretches under it cleared, which 20 to 99 waits on as well. */
  const items = clearedOnly(["numbers:0-9", "numbers:10-19"])
    .concat(words().map((/** @type {any} */ w) => (fortySeven.has(w.id) ? recognised(w) : w)));
  const range = rangeOf("numbers:20-99");

  const asked = [];
  for (let i = 0; i < 20; i += 1) {
    asked.push(...dealIn(items, (it) => it.id === range.id).exercises.filter((/** @type {any} */ e) => e.ask));
  }
  assert.ok(asked.length > 0, "the range was never asked, though 47 can be said");
  for (const ex of asked) {
    for (const id of wordsOfAsk(ex.ask, SET, IDS)) {
      assert.ok(fortySeven.has(id), `${ex.ask.value} was asked, and ${id} is not recognised`);
    }
  }
});

test("a learner who recognises every word can be asked every range", () => {
  /* Against what is dealt with no words held at all, which waits on
     nothing: counting needs noun cards this fixture does not have. */
  const asks = (/** @type {any[]} */ items, /** @type {any} */ skill) =>
    dealIn(items, (it) => it.id === skill.id).exercises.filter((/** @type {any} */ e) => e.ask).length > 0;
  /* Every stretch of the number line under the top one cleared, since
     each waits on the one below it. */
  const items = opened(skills()).concat(words().map(recognised));
  const free = skills().filter((/** @type {any} */ skill) => asks(opened(skills()), skill));
  assert.ok(free.length >= 8, `only ${free.length} ranges could be asked at all`);
  for (const skill of free) assert.ok(asks(items, skill), `${skill.range.id} was not asked`);
});

test("custom practice holds a number back the same way", () => {
  const items = skills().concat(words());
  installIndexes(items, settings);
  const got = buildManualSession({
    items, settings, ids: items.map((/** @type {any} */ it) => it.id), mode: "ultimate", systems: SETS,
  });
  assert.deepEqual(got.exercises.filter((/** @type {any} */ e) => isRangeSkill(e)).map((/** @type {any} */ e) => e.id), []);
});

/* ------------------------------------------------------------------
   Numbers and nothing else

   A session of numbers alone keeps to them: no sentence from another
   deck, and the wrong answers beside a word are other number words.
   ------------------------------------------------------------------ */

test("a session of numbers alone borrows no sentence, and a mixed one still may", () => {
  /* From the die's first throw, whatever the tests above it dealt: whether
     seven comes up in twenty sittings is chance, and every change to what
     an earlier test deals moved this one's share of it. */
  rolling = 20260922 >>> 0;
  const seven = must(words().find((/** @type {any} */ w) => w.id.endsWith(":unit.7")), "the word for seven");
  const phrase = {
    id: "p1", lang: "ar-PS", kind: "phrase", tags: [], created: 1, uses: [seven.id],
    forms: [{ id: "p1", ar: `عندي ${seven.forms[0].ar} كتب`, en: "I have seven books", lat: "", lang: "ar-PS", uses: [seven.id], s: {} }],
  };
  const items = words().map((/** @type {any} */ w) => (w.id === seven.id ? known(w) : w)).concat([phrase]);
  /* The sentence is somewhere seven turns up, so a mixed session has it
     to borrow — which is what makes the first half of this mean anything. */
  assert.ok((contextIndexOf(items, settings).get(seven.forms[0].id) || []).length > 0, "seven has no sentence to borrow");

  const numbersOnly = [];
  const mixed = [];
  for (let i = 0; i < 20; i += 1) {
    numbersOnly.push(...dealIn(items, (it) => isFromSystem(it)).exercises);
    mixed.push(...dealIn(items, () => true).exercises);
  }
  const ofSeven = (/** @type {any[]} */ list) => list.filter((e) => e.id === seven.id);
  assert.ok(ofSeven(numbersOnly).length > 0, "seven was never asked");
  assert.deepEqual(ofSeven(numbersOnly).filter((e) => e.ctx).map((e) => e.type), [], "a numbers session borrowed a sentence");
  assert.ok(numbersOnly.every((e) => e.within === "numbers"), "a question in it was not kept to the numbers");
  assert.ok(ofSeven(mixed).some((e) => e.ctx), "a mixed session never stood seven in its sentence");
  assert.ok(mixed.every((e) => e.within === undefined), "a mixed session was kept to the numbers");
});

test("a question kept to the numbers draws its company from number words alone", () => {
  const house = {
    id: "w1", lang: "ar-PS", kind: "word", tags: [], created: 1,
    forms: [{ id: "w1", ar: "بيت", en: "house", lat: "beit", lang: "ar-PS", s: {} }],
  };
  const items = words().concat([house]);
  const kept = companyOf(items, { id: words()[0].id, type: "ar2pick", within: "numbers" });
  assert.ok(kept.length > 3, "too few number words to pick from");
  assert.ok(kept.every((/** @type {any} */ it) => isFromSystem(it)), "something other than a number was in the company");
  assert.equal(companyOf(items, { id: words()[0].id, type: "ar2pick" }).length, items.length, "an ordinary question lost its company");
});

/* ------------------------------------------------------------------
   Bottom up
   ------------------------------------------------------------------ */

/** Which skills a few sessions dealt anything from. */
const dealtFrom = (/** @type {any[]} */ items) =>
  new Set(over(items, 8).map((/** @type {any} */ e) => must(e.ask, "an ask").rangeId));

test("a stretch of the number line waits until the one below it is cleared", () => {
  const fresh = dealtFrom(skills());
  assert.ok(fresh.has("numbers:0-9"), "the first stretch is not dealt");
  for (const id of ["numbers:10-19", "numbers:20-99", "numbers:100-999", "numbers:1000+"]) {
    assert.ok(!fresh.has(id), `${id} was dealt before the stretch below it was cleared`);
  }
  /* The clock is not a stretch of the number line, and waits on nothing. */
  assert.ok([...fresh].some((id) => id.startsWith("time:")), "the clock was held back");

  const next = dealtFrom(clearedOnly(["numbers:0-9"]));
  assert.ok(next.has("numbers:10-19"), "10 to 19 did not open once 0 to 9 was cleared");
  assert.ok(!next.has("numbers:20-99"), "20 to 99 opened on 0 to 9 alone");
});

test("and waits all the way down, not just on the stretch beside it", () => {
  /* 10 to 19 cleared and 0 to 9 not: progress made before the rule. */
  const got = dealtFrom(clearedOnly(["numbers:10-19"]));
  assert.ok(!got.has("numbers:20-99"), "20 to 99 opened over an uncleared 0 to 9");
  assert.ok(!got.has("numbers:10-19"), "10 to 19 was dealt over an uncleared 0 to 9");
});

test("a stretch the learner was never handed holds nothing back", () => {
  /* A deck that teaches 10 to 19 and not the numbers under it. */
  const got = dealtFrom(skills().filter((/** @type {any} */ it) => it.range.id !== "numbers:0-9"));
  assert.ok(got.has("numbers:10-19"), "10 to 19 waited on a stretch that is not here");
  assert.ok(!got.has("numbers:20-99"), "20 to 99 did not wait on 10 to 19");
});

/* Last, because the die is shared: a test placed earlier would move every
   draw after it. */
test("a stretch's counting question counts a thing from the stretch, and nothing else on it does", () => {
  /* Counting stands on the top of a stretch's ladder, beside writing the
     number out, so it is dealt once the stretch can be read and chosen. */
  const items = climbed(["num2fig", "rec2fig", "fig2pick"]).filter((/** @type {any} */ it) => it.range.kind === "numbers");
  const asked = over(items, 12);
  const counting = asked.filter((/** @type {any} */ e) => e.type === "count2phrase");
  assert.ok(counting.length > 0, "no counting question was dealt");
  for (const ex of counting) {
    const skill = must(items.find((/** @type {any} */ s) => s.id === ex.id), ex.id);
    const ask = must(ex.ask, `${ex.id} counted nothing`);
    assert.ok(SYS.nouns.some((/** @type {any} */ n) => n.id === ask.nounId), `${ex.id} counted ${ask.nounId}`);
    assert.ok(ask.value >= Math.max(1, skill.range.from) && ask.value <= skill.range.to, `${ask.value} in ${skill.range.id}`);
    assert.match(renderAsk(ask, arComposer, SYS).en, /^\d+ \S+/);
  }
  for (const ex of asked.filter((/** @type {any} */ e) => e.type !== "count2phrase")) {
    assert.equal(must(ex.ask, ex.id).nounId, undefined, `${ex.type} on ${ex.id} counted a thing`);
  }
});

test("counting does not hold back the stretch above: 0 to 9 cleared on its numbers opens 10 to 19", () => {
  const numbersOnly = skills().map((/** @type {any} */ it) =>
    it.range.id === "numbers:0-9"
      ? { ...it, forms: [{ ...it.forms[0], s: Object.fromEntries(TYPES.filter((/** @type {string} */ t) => t !== "count2phrase").map((/** @type {string} */ t) => [t, solid()])) }] }
      : it);
  assert.ok(dealtFrom(numbersOnly).has("numbers:10-19"), "10 to 19 waited on counting in 0 to 9");
});

/* ------------------------------------------------------------------
   The words come in bottom up too

   A word waits with the stretch whose screen it is on — the word for
   ninety with 20 to 99, a million with the thousands and up — and a number
   written out by hand with the stretch its number is in. A beginner's
   first sessions are the digits and the clock, and nothing from the top
   of the number line.
   ------------------------------------------------------------------ */

const { homesOf } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const HOMES = homesOf(arComposer);
/** The stretch a word card is on, or "" for the clock's words. */
const homeOf = (/** @type {any} */ it) => {
  const slot = String(it.source.slot);
  if (slot.startsWith("override:")) {
    const n = Number(slot.slice(9).split("|")[0]);
    return n >= 1000 ? "numbers:1000+" : n >= 100 ? "numbers:100-999" : n >= 20 ? "numbers:20-99" : n >= 10 ? "numbers:10-19" : "numbers:0-9";
  }
  return it.source.systemId === SYS.id ? HOMES.get(slot) || "" : "";
};
/** Which stretches' words a few sessions asked, and whether the clock's were. */
const wordsFrom = (/** @type {any[]} */ items) => {
  const byId = new Map(items.map((it) => [it.id, it]));
  const asked = over(items, 6).map((/** @type {any} */ e) => byId.get(e.id)).filter((it) => it && !isRangeSkill(it));
  return new Set(asked.map((it) => homeOf(it) || "clock"));
};

test("a beginner is asked the words of 0 to 9 and the clock, and nothing higher", () => {
  const got = wordsFrom(skills().concat(words()));
  assert.ok(got.has("numbers:0-9"), "the digits were not asked");
  assert.ok(got.has("clock"), "the clock's words were held back");
  for (const id of ["numbers:10-19", "numbers:20-99", "numbers:100-999", "numbers:1000+"]) {
    assert.ok(!got.has(id), `a word of ${id} was asked before the stretch below it was cleared`);
  }
});

test("a stretch's words come in when it opens, and the next stretch's still wait", () => {
  const got = wordsFrom(clearedOnly(["numbers:0-9"]).concat(words()));
  assert.ok(got.has("numbers:10-19"), "the teens did not come in once 0 to 9 was cleared");
  assert.ok(!got.has("numbers:20-99"), "the tens came in on 0 to 9 alone");
  /* Written out by hand: 300 waits with 100 to 999 like the boxes do. */
  assert.ok(!got.has("numbers:100-999"), "a number written out came in before its stretch");
});

test("a word whose stretch the learner was never handed waits on nothing", () => {
  /* A deck that teaches 10 to 19 without 0 to 9: its words come straight in. */
  const got = wordsFrom(skills().filter((/** @type {any} */ it) => it.range.id !== "numbers:0-9").concat(words()));
  assert.ok(got.has("numbers:10-19"), "the teens waited on a stretch that is not here");
  assert.ok(!got.has("numbers:20-99"), "the tens did not wait on 10 to 19");
});

test("a beginner's session of numbers is full, and all of it is words they can be asked", () => {
  /* The words waiting with a stretch that has not opened have nothing to
     ask. They used to take the places new cards are given anyway, so a
     session of twenty built from the numbers alone came out as two or four
     questions on one card. */
  const items = skills().filter((/** @type {any} */ it) => it.range.kind === "numbers").concat(words().filter((/** @type {any} */ it) => it.source.systemId === SYS.id));
  installIndexes(items, settings);
  const byId = new Map(items.map((/** @type {any} */ it) => [it.id, it]));
  const ids = items.map((/** @type {any} */ it) => it.id);
  for (let i = 0; i < 5; i += 1) {
    const got = buildManualSession({ items, settings, ids, mode: "regular", count: 20, systems: SETS });
    assert.ok(got.exercises.length >= 16, `only ${got.exercises.length} questions`);
    for (const ex of got.exercises) assert.equal(homeOf(byId.get(ex.id)), "numbers:0-9", `${ex.id} was asked`);
  }
});
