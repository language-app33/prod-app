// @ts-check
/*
 * How fast a learner gets through a course.
 *
 * This file exists because the last person to change the rules that ration
 * new words left a note asking the next one to measure first — and the
 * measurement itself was a sentence in a comment, with nothing to re-run.
 * So it is written down here, as something that answers the question again
 * whenever somebody asks it.
 *
 * A simulated learner sits down some number of days in a row, is dealt a
 * session, and answers it. The scheduler and the session builder are both
 * pure with the clock passed in, so none of this needs a browser, a
 * server, or a person.
 *
 * What it measures is deliberately the three numbers that argue with each
 * other: how many words were *met*, how many were *mastered*, and how long
 * a word took to reach the top of its ladder. Loosening a cap always
 * improves the first and can quietly ruin the other two, which is exactly
 * what happened the last time this was tried.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");
const out = path.join(here, ".pace-build");

await build({
  entryPoints: [path.join(root, "src", "ArabicTrainer.tsx")],
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

const { buildSession, installIndexes, setOfflineNow, setAudibleClips } = await import(
  path.join(out, "trainer.js")
);
const { gradeInto } = await import(path.join(root, "src", "grade.ts"));
const { mastered, unitsOf, MASTERED_DAYS, FRONT_DOOR_CAP, IN_HAND_CAP } = await import(
  path.join(root, "src", "scheduler.ts")
);
const { handCounts } = await import(path.join(out, "trainer.js"));

const DAY = 86400000;
const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const settings = { language: "ar-PS" };

/* Nothing here is about the network; say so once and leave it. */
setOfflineNow(false);
setAudibleClips(null);

/** A plain word with enough on it to be asked several ways. */
const word = (/** @type {number} */ i) => ({
  id: `w${i}`,
  tags: [],
  created: 1,
  lang: "ar-PS",
  kind: "word",
  forms: [{ id: `w${i}`, ar: `كلمة${i}`, en: `word ${i}`, lat: `kalima${i}`, lang: "ar-PS", s: {} }],
});

const courseOf = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => word(i + 1));

/**
 * Sit down and work through one session.
 *
 * Every question is answered right, which is the kindest case and
 * therefore the *upper bound* on how fast anyone gets through a course. A
 * real learner is slower. If the ceiling is too low for a perfect learner
 * it is certainly too low for a real one.
 *
 * @returns the cards as they stand afterwards.
 */
function sitDown(/** @type {any[]} */ items, /** @type {number} */ at, /** @type {number} */ budget) {
  const clock = { now: () => at, random: () => 0.5 };
  installIndexes(items, settings);
  const built = buildSession({ items, settings, inDeck: () => true, budget });
  let cards = items;
  for (const ex of built.exercises || []) {
    const marks = [{ id: ex.id, subId: ex.subId || null, rating: "good", correct: true, advance: true }];
    const next = gradeInto(cards, marks, { type: ex.type, clock, how: {} });
    if (next) cards = next;
  }
  return { cards, asked: (built.exercises || []).length };
}

/**
 * A learner's life, day by day.
 *
 * @param {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number }} how
 */
function live({ cards, days, budget = 18, sessionsPerDay = 1 }) {
  let items = cards;
  let asked = 0;
  /* When each word was first put to the learner, and when it reached the
     top of its ladder. Both read off the cards afterwards rather than
     tracked here, except the first, which nothing on a card records. */
  /** @type {Map<string, number>} */
  const firstSeen = new Map();
  /** @type {Map<string, number>} */
  const mastery = new Map();

  for (let d = 0; d < days; d += 1) {
    for (let s = 0; s < sessionsPerDay; s += 1) {
      /* Spread through the day so a second session is genuinely later. */
      const at = START + d * DAY + s * 3600000;
      const ran = sitDown(items, at, budget);
      items = ran.cards;
      asked += ran.asked;
      for (const it of items) {
        const met = unitsOf(it).some((/** @type {any} */ u) =>
          Object.values(u.unit.s || {}).some((/** @type {any} */ st) => (st.reps || 0) > 0),
        );
        if (met && !firstSeen.has(it.id)) firstSeen.set(it.id, d);
        if (!mastery.has(it.id)) {
          const all = unitsOf(it).every((/** @type {any} */ u) => {
            const states = Object.values(u.unit.s || {});
            return states.length > 0 && states.every((/** @type {any} */ st) => mastered(st));
          });
          if (all) mastery.set(it.id, d);
        }
      }
    }
  }

  const days_to_master = [...mastery.entries()].map(([id, d]) => d - (firstSeen.get(id) ?? 0));
  return {
    met: firstSeen.size,
    mastered: mastery.size,
    asked,
    /* The number the last attempt at this regressed. */
    medianDaysToMaster: days_to_master.length
      ? days_to_master.sort((a, b) => a - b)[Math.floor(days_to_master.length / 2)]
      : null,
  };
}

/** The same life, watching how full the two pools ever get. */
function liveKeeping(/** @type {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number }} */ how) {
  let items = how.cards;
  let peakFront = 0;
  let peakInHand = 0;
  for (let d = 0; d < how.days; d += 1) {
    for (let s2 = 0; s2 < (how.sessionsPerDay || 1); s2 += 1) {
      const at = START + d * DAY + s2 * 3600000;
      items = sitDown(items, at, how.budget || 18).cards;
      const counts = handCounts(items, settings);
      peakFront = Math.max(peakFront, counts.front);
      peakInHand = Math.max(peakInHand, counts.inHand);
    }
  }
  return { peakFront, peakInHand };
}

/* ------------------------------------------------------------------
   What the rules are worth
   ------------------------------------------------------------------ */

test("a diligent learner's first ninety days, as the app stands", () => {
  /* One short session a day, every day, every answer right. Printed rather
     than asserted tightly: this is the baseline any change is read
     against, and pinning it to the exact number would make it a test of
     arithmetic rather than of pace. */
  const got = live({ cards: courseOf(300), days: 90 });
  console.log(
    `    90 days, one session a day: met ${got.met}, mastered ${got.mastered}, ` +
      `${got.asked} questions, median ${got.medianDaysToMaster} days to master`,
  );
  assert.ok(got.met > 0, "nothing was ever met");
  assert.ok(got.met < 300, "the whole course arrived at once");
});

/*
 * What "practising more must not buy more new words" actually means.
 *
 * Not that the two learners meet the same number — under a design where
 * new words are released by old ones graduating, reviewing more *does*
 * graduate more, and so meets more. That is the rule working, not leaking.
 *
 * What must not exist is a quota counted in sessions. The old rule was
 * three a session, so ten short sittings in an evening were thirty new
 * words while one long sitting was three: the same effort, a tenfold
 * difference, decided by how the learner happened to break up their time.
 * What is asserted is that the standing pools bound intake, and nothing
 * about the shape of a sitting does.
 */

test("no quota is counted in sessions: one sitting can fill the front door", () => {
  /* Under the old rule this was three, whatever the learner's state. */
  const day = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1, budget: 20 });
  console.log(`    one twenty-question sitting met ${day.met} words`);
  assert.ok(day.met > 3, `still rationed per session: ${day.met}`);
});

test("and the front door bounds a day however many sittings it holds", () => {
  /* Ten sittings in an evening is the case that started this. Intake is
     bounded by what the learner has standing, not multiplied by ten. */
  const once = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1 });
  const often = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10 });
  console.log(`    in one day: one sitting met ${once.met}, ten sittings met ${often.met}`);
  assert.ok(
    often.met <= FRONT_DOOR_CAP,
    `ten sittings met ${often.met} words, past a front door of ${FRONT_DOOR_CAP}`,
  );
});

test("neither pool is ever exceeded, however hard the learner goes", () => {
  const items = courseOf(300);
  const lived = liveKeeping({ cards: items, days: 60, sessionsPerDay: 3 });
  assert.ok(
    lived.peakFront <= FRONT_DOOR_CAP,
    `front door reached ${lived.peakFront}, past ${FRONT_DOOR_CAP}`,
  );
  assert.ok(
    lived.peakInHand <= IN_HAND_CAP,
    `words in hand reached ${lived.peakInHand}, past ${IN_HAND_CAP}`,
  );
});

test("a course arrives gradually rather than all at once", () => {
  const first = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10, budget: 20 });
  assert.ok(first.met <= FRONT_DOOR_CAP, `${first.met} words on the first day`);
  assert.ok(first.met >= 5, `only ${first.met} words on a whole first day`);
});

test("a word reaches the top of its ladder in a knowable time", () => {
  /* MASTERED_DAYS is the bar each rung is held to, so a word cannot be
     mastered faster than that however well it is answered. */
  const got = live({ cards: courseOf(60), days: 120 });
  assert.ok(got.mastered > 0, "nothing was mastered in a hundred and twenty days");
  assert.ok(
    (got.medianDaysToMaster ?? 0) >= MASTERED_DAYS,
    `mastered in ${got.medianDaysToMaster} days, faster than the bar`,
  );
});

/*
 * The learner who does far too much.
 *
 * Every case above sits down once or twice a day, which is why this file
 * reported healthy numbers through several releases in which somebody
 * practising hard learnt nothing at all. An early answer used to re-date
 * the card it was about, so a learner who came back every twenty minutes
 * pushed every card ahead of themselves all day and none ever fell due;
 * the gap each one was allowed to grow from was therefore always about
 * nought, floored at a day, and topped out under the four-day bar that
 * releases a new word. Ten words met in a fortnight, and never an
 * eleventh, for as long as they kept it up.
 *
 * Kept deliberately as a *pace* test rather than a unit one: the fault was
 * invisible in any single call to the scheduler and only appeared in the
 * shape of a fortnight.
 */
test("practising all day never stops a learner meeting new words", () => {
  const hard = live({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  console.log(
    `    thirty sittings a day for ten days: met ${hard.met}, mastered ${hard.mastered}, ` +
      `${hard.asked} questions`,
  );
  assert.ok(
    hard.met > FRONT_DOOR_CAP,
    `stuck at ${hard.met} words: the front door never emptied, so no new word was released`,
  );
  assert.ok(hard.mastered > 0, "nothing reached the top of its ladder");
});

test("and doing too much never beats doing the right amount", () => {
  /* The other side of it, and the property the caps exist for: the keen
     learner may meet more words — they have genuinely graduated more — but
     the standing pools still bound what they carry, so practice cannot buy
     its way past the pacing. */
  const steady = live({ cards: courseOf(60), days: 10, sessionsPerDay: 1 });
  const keen = live({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(keen.met >= steady.met, `${keen.met} against ${steady.met}`);
  const peaks = liveKeeping({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(peaks.peakFront <= FRONT_DOOR_CAP, `front door reached ${peaks.peakFront}`);
  assert.ok(peaks.peakInHand <= IN_HAND_CAP, `words in hand reached ${peaks.peakInHand}`);
});
