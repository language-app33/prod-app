/*
 * Progress on numbers, word by word.
 *
 * Three claims. A number part filed into a deck knows the words it is built
 * from. A part's questions lean towards a word of it the learner has not
 * learnt yet, so every word comes up rather than the ones the number line
 * is thick with. And a part is learnt only once every one of its words is,
 * however its own reviews have gone.
 *
 * Nothing here holds a word of Arabic: the words are the golden system's.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { must } from "./helpers.mjs";

/* Seeded before the trainer is imported — see numbers-session.test.mjs. */
let rolling = 20261004 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".numbers-progress-build");
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
const { buildSession, installIndexes, cardStandings, partsOf, climbOf, towardsLearnt, workloadOf } = await import(path.join(out, "trainer.js"));
const { generate, fileIntoDecks, componentId, isRangeSkill, steeredAsk } = await import(
  path.join(here, "..", "src", "numbers", "generate.ts")
);
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState, standing } = await import(path.join(here, "..", "src", "scheduler.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {any} */
const TIME = load("ar-PS.times.json").system;
const SETS = [{ numbers: SYS, times: TIME }];
const SET = { composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME };
const settings = { language: "ar-PS" };

const generated = generate({ ...SET, now: 1750000000000 });
/* Every part in one deck, the way a teacher's deck brings them. */
const filed = fileIntoDecks(generated.items, SET, [
  { title: "Numbers", parts: generated.items.filter(isRangeSkill).map((/** @type {any} */ it) => it.range.id) },
]);
const PART = "numbers:20-99";
const partId = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === PART), PART).id;
const ninety = componentId(SYS.id, "ten.90");

/** A schedule kept: right twice running, both passes made, next due later. */
const kept = () => ({
  ...freshState(), phase: "review", interval: 30, due: Date.now() + 30 * 86400000,
  reps: 4, right: 4, hist: [1, 1, 1, 1], passes: 2, updated: Date.now() - 86400000,
});

/** Every exercise on a card kept, so the card is learnt. */
const learntCard = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({ ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, kept()])) })),
});

/** The collection with every card learnt but the ones named. */
const allLearntBut = (/** @type {string[]} */ ids) =>
  filed.map((/** @type {any} */ it) => (ids.includes(it.id) ? it : learntCard(it)));

test("a part filed into a deck carries the words it is built from", () => {
  const part = must(filed.find((/** @type {any} */ it) => it.id === partId), PART);
  const parts = new Set(part.parts);
  assert.ok(parts.has(ninety), "20 to 99 does not know it is built with ninety");
  assert.ok(parts.has(componentId(SYS.id, "connector")), "nor with the word that joins");
  assert.ok(parts.has(componentId(SYS.id, "unit.4")), "nor with four");
  /* Every one of them is a card the learner holds. */
  const ids = new Set(filed.map((/** @type {any} */ it) => it.id));
  for (const id of parts) assert.ok(ids.has(id), `${id} is in no card`);
});

test("a question is steered to a number that stands on a word not yet learnt", () => {
  const part = must(filed.find((/** @type {any} */ it) => it.id === partId), PART);
  for (let i = 0; i < 40; i += 1) {
    const ask = must(steeredAsk(part.range, `seed ${i}`, SET, new Set([ninety])), "no asking");
    assert.ok(ask.value >= 90 && ask.value <= 99, `asked ${ask.value} to bring in ninety`);
  }
  /* Nothing waiting, nothing to steer: the ordinary draw stands. */
  assert.equal(steeredAsk(part.range, "seed", SET, new Set()), null);
});

/** A word cleared — every level right twice running, its faces too — and
    no more, so it is not learnt yet: it has its two passes still to make. */
const clearedOnly = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({
    ...f,
    s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, {
      ...freshState(), phase: "review", interval: 4, due: Date.now() - 86400000,
      reps: 2, right: 2, hist: [1, 1], updated: Date.now() - 86400000,
    }])),
  })),
});

test("dealt in a session, every question on the part brings in the word still to learn", () => {
  /* Cleared but not learnt: a number may stand on it, and the part leans
     towards the numbers that do. A word not yet cleared is another matter
     — see the test below. */
  const items = allLearntBut([ninety, partId]).map((/** @type {any} */ it) => (it.id === ninety ? clearedOnly(it) : it));
  installIndexes(items, settings);
  let asked = 0;
  for (let i = 0; i < 6; i += 1) {
    const got = buildSession({ items, settings, inDeck: () => true, systems: SETS, practice: true, includeAll: true });
    for (const ex of got.exercises) {
      if (ex.id !== partId || !ex.ask) continue;
      asked += 1;
      assert.ok(ex.ask.value >= 90 && ex.ask.value <= 99, `asked ${ex.ask.value} while ninety is not learnt`);
    }
  }
  assert.ok(asked > 0, "the part was never dealt");
});

test("a word not yet cleared is never asked inside a number", () => {
  const items = allLearntBut([ninety, partId]);
  installIndexes(items, settings);
  let asked = 0;
  for (let i = 0; i < 6; i += 1) {
    const got = buildSession({ items, settings, inDeck: () => true, systems: SETS, practice: true, includeAll: true });
    for (const ex of got.exercises) {
      if (ex.id !== partId || !ex.ask) continue;
      asked += 1;
      assert.ok(ex.ask.value < 90, `asked ${ex.ask.value} before ninety was cleared`);
    }
  }
  assert.ok(asked > 0, "the part was never dealt, though every other word is learnt");
});

test("a part is learnt only once every word it is built from is known", () => {
  const held = allLearntBut([ninety]);
  const part = must(held.find((/** @type {any} */ it) => it.id === partId), PART);
  const rows = cardStandings(part, settings, held);
  const at = must(standing(rows), "no standing");
  /* And no further up than ninety, which has not been started: the part
     is on ninety's level, still being learnt, whatever its own answers. */
  assert.equal(at.level, 1, "further up than its weakest word");
  assert.equal(at.status, "learning");
  assert.ok(rows.slice(1).every((/** @type {any} */ r) => r.status === "none"));
  assert.equal(rows[rows.length - 1].held, 1);
  const words = partsOf(part, held, settings);
  assert.equal(words.filter((/** @type {any} */ p) => p.validated === false).length, 1);

  /* Ninety learnt, and nothing holds it back. */
  const all = allLearntBut([]);
  const done = must(standing(cardStandings(must(all.find((/** @type {any} */ it) => it.id === partId), PART), settings, all)), "no standing");
  assert.equal(done.status, "done");
  /* And read on its own, without the collection, the part is what its own
     ladder says — the one card's line, which cannot see its words. */
  assert.equal(must(standing(cardStandings(part, settings)), "no standing").status, "done");
});

test("known is cleared, not learnt: a word still making its own reviews holds nothing back", () => {
  /* Since 0.368. Learnt asked every word and all ten figures to have made
     their passes at the same moment, and one slip anywhere put a part back,
     so 0 to 9 sat at Cleared for weeks. */
  const items = allLearntBut([ninety]).map((/** @type {any} */ it) => (it.id === ninety ? clearedOnly(it) : it));
  const part = must(items.find((/** @type {any} */ it) => it.id === partId), PART);
  const at = must(standing(cardStandings(part, settings, items)), "no standing");
  assert.equal(at.status, "done", "held back by a word that is cleared");
  /* The word itself is still not learnt, and the page of a part's words
     still says so. */
  const word = must(partsOf(part, items, settings).find((/** @type {any} */ p) => p.card.id === ninety), "ninety");
  assert.equal(word.validated, false);
  assert.equal(word.known, true);
});

/*
 * How far along a deck of numbers is, counted over every number in it.
 *
 * A number waiting on its stretch has nothing to ask yet, and the
 * percentages used to leave it out for that: a deck of every number read
 * 90% to a learner who knew the words for 0 to 9, and fell to 50% once 0 to
 * 9 was learnt and 10 to 19 opened. The ring on the home screen, a saved
 * session's tile, the prep's and the Progress tab's decks all read
 * climbOf's sum — see towardsLearnt.
 */
test("a deck of numbers counts the numbers still waiting, so its percentage only goes up", () => {
  const partOf = (/** @type {string} */ rid) =>
    must(filed.find((/** @type {any} */ it) => it.range && it.range.id === rid), rid);
  /** The ids of a part and every word it is built from. */
  const whole = (/** @type {string} */ rid) => [partOf(rid).id, ...(partOf(rid).parts || [])];
  const climbWith = (/** @type {string[]} */ learnt) => {
    const items = filed.map((/** @type {any} */ it) => (learnt.includes(it.id) ? learntCard(it) : it));
    installIndexes(items, settings);
    return climbOf(items, settings, items);
  };

  const steps = [
    [],
    [...(partOf("numbers:0-9").parts || [])],
    whole("numbers:0-9"),
    [...whole("numbers:0-9"), ...whole("numbers:10-19")],
    [...whole("numbers:0-9"), ...whole("numbers:10-19"), ...whole("numbers:20-99")],
    filed.map((/** @type {any} */ it) => it.id),
  ].map(climbWith);

  for (const step of steps) assert.equal(step.n, filed.length, "a number waiting on its stretch was left out");
  assert.equal(steps[0].pct, 0);
  /* Ten words of forty-nine, not ten of the eleven 0 to 9 holds. */
  assert.ok(steps[1].pct <= 25, `${steps[1].pct}% for knowing the words for 0 to 9`);
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i].pct >= steps[i - 1].pct, `went from ${steps[i - 1].pct}% to ${steps[i].pct}% by learning more`);
  }
  assert.equal(steps[steps.length - 1].pct, 100);

  /* A waiting number nobody has begun stands on the bottom level, not
     started: on no level for anything that deals or shows a card, and
     counted all the same. */
  installIndexes(filed, settings);
  const thousands = partOf("numbers:1000+");
  assert.deepEqual(cardStandings(thousands, settings, filed), [], "1,000 and up is not waiting");
  const fresh = must(towardsLearnt(thousands, settings, filed), "a waiting part counts");
  assert.equal(fresh.at.level, 1);
  assert.equal(fresh.share, 0);
});

test("the work left on a deck of numbers counts the numbers still waiting", () => {
  installIndexes(filed, settings);
  const counted = filed.filter((/** @type {any} */ it) => towardsLearnt(it, settings, filed)).length;
  const asked = filed.filter((/** @type {any} */ it) => standing(cardStandings(it, settings, filed))).length;
  assert.ok(asked < counted, "nothing is waiting, so this proves nothing");
  const w = workloadOf(filed, settings);
  assert.equal(w.left, counted, "a number waiting on its stretch is work the deck has left");
  /* And the work on a waiting part is its whole ladder, not nothing. */
  const thousands = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:1000+"), "1000+");
  assert.ok(workloadOf([thousands], settings).questions > 0, "a waiting part needs no answers");
});

/** Missed twice running, so the level it is on shuts. */
const missed = () => ({
  ...freshState(), phase: "relearn", interval: 1, due: Date.now(),
  reps: 6, right: 4, wrong: 2, hist: [1, 1, 1, 1, 0, 0], passes: 2, updated: Date.now() - 3600000,
});
const slipped = (/** @type {any} */ it) => ({
  ...it,
  forms: it.forms.map((/** @type {any} */ f) => ({ ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, missed()])) })),
});
const four = componentId(SYS.id, "unit.4");

test("a slip below a stretch keeps what the numbers above it had earned", () => {
  /* Everything learnt, then the word for four and 0 to 9's own questions
     both missed twice running: neither way through is open, so every
     stretch above 0 to 9 waits again. Their words are still learnt, and the
     percentage says so rather than counting them as nothing. */
  const zeroToNine = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"), "0 to 9");
  const items = allLearntBut([four, zeroToNine.id]).map((/** @type {any} */ it) =>
    (it.id === four || it.id === zeroToNine.id ? slipped(it) : it));
  installIndexes(items, settings);
  const tens = must(items.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:20-99"), "20 to 99");
  assert.deepEqual(cardStandings(tens, settings, items), [], "20 to 99 is not waiting on the slip");
  assert.deepEqual(cardStandings(must(items.find((/** @type {any} */ it) => it.id === ninety), "ninety"), settings, items), [],
    "nor is its word for ninety");
  const climb = climbOf(items, settings, items);
  assert.equal(climb.n, filed.length);
  /* Short of learnt: four, and the parts built with it — nothing else. */
  const short = items.filter((/** @type {any} */ it) => {
    const at = towardsLearnt(it, settings, items);
    return at && at.at.status !== "done";
  });
  assert.equal(climb.learnt, filed.length - short.length);
  for (const it of short) {
    assert.ok(it.id === four || it.id === zeroToNine.id || (it.range && (it.parts || []).includes(four)), `${it.id} is short of learnt`);
  }
});

/*
 * Since 0.368 a stretch opens on its words and not on the questions about
 * the stretch below as a whole. Those come up about once in thirty
 * questions of a numbers session, so waiting on them held 10 to 19 shut
 * for days after the words for 0 to 9 were all known.
 */
test("a stretch opens once the words below it are cleared, before the stretch below's own questions are", () => {
  const zeroToNine = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"), "0 to 9");
  const tenToNineteen = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:10-19"), "10 to 19");
  const below = new Set(zeroToNine.parts || []);
  assert.ok(below.size >= 10, "0 to 9 knows the words it is built from");
  /* The words for 0 to 9 cleared, and nothing else touched: 0 to 9 itself
     has never been asked. */
  const items = filed.map((/** @type {any} */ it) => (below.has(it.id) ? clearedOnly(it) : it));
  installIndexes(items, settings);
  const asked = cardStandings(must(items.find((/** @type {any} */ it) => it.id === tenToNineteen.id), "10 to 19"), settings, items);
  assert.ok(asked.length > 0, "10 to 19 is still waiting on 0 to 9's own questions");

  /* And one word short of that, it waits. */
  const [one] = [...below];
  const short = items.map((/** @type {any} */ it) => (it.id === one ? filed.find((/** @type {any} */ f) => f.id === one) : it));
  installIndexes(short, settings);
  assert.deepEqual(cardStandings(must(short.find((/** @type {any} */ it) => it.id === tenToNineteen.id), "10 to 19"), settings, short), [],
    "10 to 19 opened with a word for 0 to 9 not yet cleared");
});

test("and the stretch below's own questions still open it, whatever its words say", () => {
  /* The way through until 0.368, kept beside the new one: 0 to 9's own
     questions cleared and its words not, and 10 to 19 is open. */
  const zeroToNine = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"), "0 to 9");
  const tenToNineteen = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:10-19"), "10 to 19");
  const items = filed.map((/** @type {any} */ it) => (it.id === zeroToNine.id ? clearedOnly(it) : it));
  installIndexes(items, settings);
  assert.ok(cardStandings(must(items.find((/** @type {any} */ it) => it.id === tenToNineteen.id), "10 to 19"), settings, items).length > 0);
});

test("a slip on the stretch's own questions no longer shuts the stretch above while its words are known", () => {
  const zeroToNine = must(filed.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:0-9"), "0 to 9");
  const items = allLearntBut([zeroToNine.id]).map((/** @type {any} */ it) => (it.id === zeroToNine.id ? slipped(it) : it));
  installIndexes(items, settings);
  const tens = must(items.find((/** @type {any} */ it) => it.range && it.range.id === "numbers:20-99"), "20 to 99");
  assert.ok(cardStandings(tens, settings, items).length > 0, "20 to 99 shut by a slip on 0 to 9's own questions");
});
