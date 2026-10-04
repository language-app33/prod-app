// @ts-check
/*
 * Every practice session fills to the length chosen.
 *
 * A session that comes out short is the kind of fault nobody sees in a
 * test of one rule: two or four questions where twenty were asked for,
 * because new words that could not be asked yet took the places new
 * words are given (0.341), or because a session guessed how many cards it
 * needed and never went back for more. So this walks every kind of
 * session against several kinds of learner and of material, and holds
 * each one to its length.
 *
 * **The only sessions allowed to be short are the ones in AGREED**, each
 * with its reason and the exact size it comes out at — agreed with the
 * owner, and the one reason agreed is that there is not enough material:
 * every card the session may use, asked as often as a session asks one
 * (MAX_ASKS_PER_UNIT, four). Anything else short is a failure. An entry is
 * an exact number rather than a "may be short", so a bug cannot hide
 * behind one, and an entry nothing matches is a failure too, so the list
 * cannot rot.
 *
 * What counts: questions, and a matching grid is as many questions as the
 * words in it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

/* Seeded before the trainer is imported: a session is built with chance in
   it, and an unseeded run would be a different test each time. */
let rolling = 20261004 >>> 0;
Math.random = () => {
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".session-fill-build");
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});
const { buildSession, buildManualSession, buildWeakSession, installIndexes } = await import(path.join(out, "trainer.js"));
const { generate } = await import(path.join(here, "..", "src", "numbers", "generate.ts"));
const { arComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.ts"));
const { arTimeComposer } = await import(path.join(here, "..", "src", "numbers", "ar-PS.time.ts"));
const { TYPES } = await import(path.join(here, "..", "src", "languages.ts"));
const { freshState } = await import(path.join(here, "..", "src", "scheduler.ts"));

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
const SYS = load("ar-PS.numbers.json").system;
const TIME = load("ar-PS.times.json").system;
const SETS = [{ numbers: SYS, times: TIME }];
const settings = { language: "ar-PS" };
const DAY = 86400000;
const NOW = Date.now();

/* ---- material ---- */

/** A plain word with enough on it to be asked several ways. */
const word = (/** @type {number} */ i) => ({
  id: `w${i}`, tags: ["Deck"], created: i, lang: "ar-PS", kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS", s: {} }],
});
const words = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => word(i + 1));
/** A teacher's whole number system and clock, as cards and skills. */
const numbers = () =>
  generate({ composer: arComposer, sys: SYS, timeComposer: arTimeComposer, timeSys: TIME, now: 1 }).items;

/** @type {Record<string, () => any[]>} */
const MATERIAL = {
  "40 words": () => words(40),
  numbers,
  "numbers and words": () => numbers().concat(words(40)),
  "3 words": () => words(3),
};

/* ---- learners ---- */

/** @param {Record<string, any>} over */
const state = (over) => ({ ...freshState(), ...over });
const solidDue = () => state({ phase: "review", interval: 4, due: NOW - DAY, reps: 2, right: 2, hist: [1, 1], updated: NOW - 5 * DAY });
const solidLater = () => state({ phase: "review", interval: 20, due: NOW + 10 * DAY, reps: 4, right: 4, hist: [1, 1], updated: NOW - 3600000 });
const missed = () => state({ phase: "learning", interval: 0, due: NOW - 1000, reps: 2, right: 0, wrong: 2, hist: [0, 0], updated: NOW - DAY });

/** Every card's own word given a state, where `pick` names one for it.
    @param {any[]} items @param {(i: number) => (() => any) | null} pick */
const withStates = (items, pick) =>
  items.map((it, i) => {
    const s = pick(i);
    return s
      ? { ...it, forms: it.forms.map((/** @type {any} */ f, /** @type {number} */ j) => (j ? f : { ...f, s: Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, s()])) })) }
      : it;
  });

/** @type {Record<string, (items: any[]) => any[]>} */
const LEARNERS = {
  /* Nothing answered yet. */
  beginner: (items) => items,
  /* Every other card climbed and due, the rest new. */
  halfway: (items) => withStates(items, (i) => (i % 2 ? null : solidDue)),
  "all due": (items) => withStates(items, () => solidDue),
  /* Everything answered an hour ago and not due for ten days. */
  "nothing due": (items) => withStates(items, () => solidLater),
  /* One card in three missed twice running. */
  struggling: (items) => withStates(items, (i) => (i % 3 ? solidDue : missed)),
};

/* ---- sessions ---- */

const LENGTHS = [10, 20, 40];

/**
 * Every kind of session there is, by the name the screens give it.
 * @type {Record<string, (items: any[], length: number) => { exercises: any[], reason?: string | null }>}
 */
const SESSIONS = {
  /* The home screen's Start session. */
  everyday: (items, length) => buildSession({ items, settings, inDeck: () => true, budget: length, systems: SETS }),
  /* Build a session, in each of its styles. */
  regular: (items, length) => buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "regular", count: length, systems: SETS }),
  "get started": (items, length) => buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "started", count: length, systems: SETS }),
  "not seen lately": (items, length) => buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "unseen", count: length, systems: SETS }),
  "fix mistakes": (items, length) => buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "mistakes", count: length, systems: SETS }),
  /* What is going wrong. */
  "weak skills": (items, length) => buildWeakSession({ items, settings, inDeck: () => true, budget: length, systems: SETS }),
};
/* A timed session is Regular given minutes rather than a count: six
   questions a minute. */
const TIMED_MINUTES = 5;
const timed = (/** @type {any[]} */ items) =>
  buildManualSession({ items, settings, ids: items.map((i) => i.id), mode: "regular", minutes: TIMED_MINUTES, systems: SETS });

/** Questions, with a grid counted as the words in it. @param {{ exercises: any[] }} s */
const questions = (s) => s.exercises.reduce((n, e) => n + 1 + (e.mates || []).length, 0);

/* ---- what is agreed to be short ---- */

/**
 * The sessions that may come out short, agreed ahead of time.
 *
 * One reason only: **not enough material** — the session has used every
 * card it may, each asked as many times as a session asks one. The size is
 * that number exactly, worked out beside it. A session holds a card to
 * four askings (MAX_ASKS_PER_UNIT in the app).
 *
 * @type {{ session: string, material: string, learner?: string, size: number, why: string }[]}
 */
const AGREED = [
  ...["everyday", "regular", "get started"].map((session) => ({
    session, material: "3 words", size: 3 * 4,
    why: "three words, each asked four times",
  })),
  { session: "not seen lately", material: "3 words", learner: "beginner", size: 3 * 4,
    why: "three words never seen, each asked four times" },
  { session: "not seen lately", material: "3 words", learner: "halfway", size: 1 * 4,
    why: "one word of the three not seen lately (the new one; the other two were practised five days ago), asked four times" },
  ...["fix mistakes", "weak skills"].map((session) => ({
    session, material: "3 words", learner: "struggling", size: 1 * 4,
    why: "one word of the three going wrong, asked four times",
  })),
  /* Nothing qualifies at all. */
  ...["fix mistakes", "weak skills"].flatMap((session) =>
    ["beginner", "halfway", "all due", "nothing due"].flatMap((learner) =>
      Object.keys(MATERIAL).map((material) => ({
        session, material, learner, size: 0, why: "nothing is going wrong, and this session is only what is going wrong",
      })))),
  ...["all due", "nothing due", "struggling"].flatMap((learner) =>
    ["40 words", "3 words"].map((material) => ({
      session: "not seen lately", material, learner, size: 0,
      why: "every word was practised in the last few days",
    }))),
];

/** The agreed size for one session, or null where it must fill. */
const agreed = (/** @type {string} */ session, /** @type {string} */ material, /** @type {string} */ learner) =>
  AGREED.find((a) => a.session === session && a.material === material && (!a.learner || a.learner === learner)) || null;

/* ---- the walk ---- */

const used = new Set();

for (const [material, make] of Object.entries(MATERIAL)) {
  for (const [learner, become] of Object.entries(LEARNERS)) {
    test(`every session fills: ${material}, ${learner}`, () => {
      const items = become(make());
      installIndexes(items, settings, SETS);
      const short = [];
      /* Three times over, since which cards a session takes is drawn. */
      for (let draw = 0; draw < 3; draw += 1) {
        for (const [session, run] of Object.entries(SESSIONS)) {
          const rule = agreed(session, material, learner);
          for (const length of LENGTHS) {
            const got = questions(run(items, length));
            const want = rule ? Math.min(length, rule.size) : length;
            if (rule && rule.size < length) used.add(rule);
            /* A grid may carry a session a few words past its length,
               never short of it — and an agreed size is exact. */
            const ok = rule && rule.size < length ? got === want : got >= want;
            if (!ok) short.push(`${session} of ${length}: ${got} questions, ${rule && rule.size < length ? `agreed ${want} (${rule.why})` : `wanted ${want}`}`);
          }
        }
        const minutes = questions(timed(items));
        const rule = agreed("regular", material, learner);
        const want = Math.min(TIMED_MINUTES * 6, rule ? rule.size : Infinity);
        if (minutes < want) short.push(`timed ${TIMED_MINUTES} minutes: ${minutes} questions, wanted ${want}`);
      }
      assert.deepEqual([...new Set(short)], [], "short sessions that were not agreed");
    });
  }
}

test("everything agreed to be short is still a case that happens", () => {
  /* Run after the walk: an entry nothing matched is a promise about a
     session that no longer exists, and would quietly excuse the next one
     that does. */
  const stale = AGREED.filter((a) => !used.has(a)).map((a) => `${a.session}, ${a.material}${a.learner ? `, ${a.learner}` : ""}`);
  assert.deepEqual(stale, []);
});

test("a struggling learner's mistakes session is never empty", () => {
  /* The other half of the agreed empties: "nothing is going wrong" must
     not be what a session says when something is. */
  for (const material of Object.keys(MATERIAL)) {
    const items = LEARNERS.struggling(MATERIAL[material]());
    installIndexes(items, settings, SETS);
    assert.ok(questions(SESSIONS["fix mistakes"](items, 10)) > 0, material);
    assert.ok(questions(SESSIONS["weak skills"](items, 10)) > 0, material);
  }
});
