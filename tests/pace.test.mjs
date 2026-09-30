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

const { buildSession, installIndexes, setOfflineNow, setAudibleClips, laddered, inHandFor } = await import(
  path.join(out, "trainer.js")
);
const { gradeInto } = await import(path.join(root, "src", "grade.ts"));
const {
  mastered,
  cleared,
  learnt,
  unitsOf,
  dayKey,
  typicalDay,
  MASTERED_DAYS,
  PASSES_TO_LEARN,
  FRONT_DOOR_CAP,
  IN_HAND_CAP,
  IN_HAND_MAX,
} = await import(path.join(root, "src", "scheduler.ts"));
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
function sitDown(
  /** @type {any[]} */ items,
  /** @type {number} */ at,
  /** @type {number} */ budget,
  /** @type {Record<string, number>} */ log = {},
) {
  const clock = { now: () => at, random: () => 0.5 };
  installIndexes(items, settings);
  /* Read off the learner's own log, as the app reads it, so how much they
     practise sizes how much they may hold. */
  const perDay = typicalDay(log, clock);
  /* Built at the moment the learner sits down. The builder reads the
     wall clock — what is due, what was asked half an hour ago and rests —
     and left alone it would read today's date against cards dated to
     this simulation's calendar, so everything would look overdue and the
     order would be a shuffle of the whole hand. */
  const wall = Date.now;
  Date.now = () => at;
  let built;
  try {
    built = buildSession({ items, settings, inDeck: () => true, budget, perDay });
  } finally {
    Date.now = wall;
  }
  const day = dayKey(at);
  let cards = items;
  /** @type {Set<string>} */
  const dealt = new Set();
  for (const ex of built.exercises || []) {
    dealt.add(ex.id);
    log[day] = (log[day] || 0) + 1;
    const marks = [{ id: ex.id, subId: ex.subId || null, rating: "good", correct: true, advance: true }];
    /* A grid is a question about every word in it, and the app marks each
       of them — moving a word's schedule only where its own question was
       due. Marking the first word alone, as this did until 0.281, had every
       other word in a grid climb as if it had never been asked, and
       understated what a learner gets through. */
    for (const m of ex.mates || []) {
      const it = cards.find((/** @type {any} */ c) => c.id === m.id);
      const u = it && unitsOf(it).find((/** @type {any} */ x) => (m.subId ? x.unit.id === m.subId : !x.isSub));
      const st = u && u.unit.s && u.unit.s[ex.type];
      dealt.add(m.id);
      marks.push({
        id: m.id,
        subId: m.subId || null,
        rating: "good",
        correct: true,
        advance: !st || st.phase === "new" || (st.due || 0) <= at,
      });
    }
    /* Handed the ladder, as the app hands it, so the passes that turn a
       cleared card into a learnt one are counted here too. Without it the
       simulation would measure the climb and nothing that follows it,
       which is half of what this release changed. */
    const next = gradeInto(cards, marks, {
      type: ex.type,
      clock,
      how: {},
      keysOf: (/** @type {any} */ unit) => laddered(unit, settings),
    });
    if (next) cards = next;
  }
  return { cards, asked: (built.exercises || []).length, dealt, perDay };
}

/**
 * A learner's life, day by day.
 *
 * @param {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number }} how
 */
function live({ cards, days, budget = 18, sessionsPerDay = 1 }) {
  let items = cards;
  let asked = 0;
  /** @type {Record<string, number>} */
  const log = {};
  /* When each word was first put to the learner, and when it reached the
     top of its ladder. Both read off the cards afterwards rather than
     tracked here, except the first, which nothing on a card records. */
  /** @type {Map<string, number>} */
  const firstSeen = new Map();
  /** @type {Map<string, number>} */
  const mastery = new Map();
  /* And the two this release is about: the day a card had been up every
     level it has, and the day it had come back twice since and been kept.
     Effort is meant to move the first and not the second. */
  /** @type {Map<string, number>} */
  const clearedOn = new Map();
  /** @type {Map<string, number>} */
  const learntOn = new Map();
  /* And each day's rotation: how many times a card was dealt, and how
     many different cards those deals were. The first over the second is
     how often the same word came round that day, which is the number a
     learner practising all day actually feels. */
  /** @type {{ deals: number, distinct: number }[]} */
  const daily = [];

  for (let d = 0; d < days; d += 1) {
    let deals = 0;
    /** @type {Set<string>} */
    const today = new Set();
    for (let s = 0; s < sessionsPerDay; s += 1) {
      /* Spread through the day so a second session is genuinely later. */
      const at = START + d * DAY + s * 3600000;
      const ran = sitDown(items, at, budget, log);
      items = ran.cards;
      asked += ran.asked;
      deals += ran.dealt.size;
      for (const id of ran.dealt) today.add(id);
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
        const up = unitsOf(it).every((/** @type {any} */ u) => {
          const keys = laddered(u.unit, settings);
          return keys.length > 0 && cleared(keys, (/** @type {string} */ k) => (u.unit.s || {})[k]);
        });
        if (up && !clearedOn.has(it.id)) clearedOn.set(it.id, d);
        const kept = unitsOf(it).every((/** @type {any} */ u) => {
          const keys = laddered(u.unit, settings);
          return keys.length > 0 && learnt(keys, (/** @type {string} */ k) => (u.unit.s || {})[k]);
        });
        if (kept && !learntOn.has(it.id)) learntOn.set(it.id, d);
      }
    }
    daily.push({ deals, distinct: today.size });
  }

  const days_to_master = [...mastery.entries()].map(([id, d]) => d - (firstSeen.get(id) ?? 0));
  const since = (/** @type {Map<string, number>} */ m) =>
    [...m.entries()].map(([id, d]) => d - (firstSeen.get(id) ?? 0)).sort((a, b) => a - b);
  const median = (/** @type {number[]} */ xs) => (xs.length ? xs[Math.floor(xs.length / 2)] : null);
  const toClear = since(clearedOn);
  const toLearn = since(learntOn);
  return {
    met: firstSeen.size,
    mastered: mastery.size,
    cleared: clearedOn.size,
    learnt: learntOn.size,
    medianDaysToClear: median(toClear),
    medianDaysToLearn: median(toLearn),
    /* The gap between the two, per card: what the passes cost, which is
       the one thing effort is not allowed to shorten. */
    medianPassDays: median(
      [...learntOn.entries()]
        .filter(([id]) => clearedOn.has(id))
        .map(([id, d]) => d - (clearedOn.get(id) ?? 0))
        .sort((a, b) => a - b),
    ),
    asked,
    daily,
    /* The day each word was first met, for counting what arrived when. */
    firstSeen,
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
  /* How far past the pool the learner's own practice allowed at the time
     they sat down — nought or less, always. */
  let peakOver = -Infinity;
  /** @type {Record<string, number>} */
  const log = {};
  for (let d = 0; d < how.days; d += 1) {
    for (let s2 = 0; s2 < (how.sessionsPerDay || 1); s2 += 1) {
      const at = START + d * DAY + s2 * 3600000;
      const ran = sitDown(items, at, how.budget || 18, log);
      items = ran.cards;
      const counts = handCounts(items, settings);
      peakFront = Math.max(peakFront, counts.front);
      peakInHand = Math.max(peakInHand, counts.inHand);
      peakOver = Math.max(peakOver, counts.inHand - inHandFor(ran.perDay));
    }
  }
  return { peakFront, peakInHand, peakOver };
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
  /* Plus whatever was cleared that day: since 0.272 a word cleared leaves
     the front door at once and lets the next one in, so a keen first day
     can meet an eleventh. What may never happen is more than the front
     door's worth being learnt at once — see the test after this one. */
  assert.ok(
    often.met <= FRONT_DOOR_CAP + often.cleared,
    `ten sittings met ${often.met} words, past a front door of ${FRONT_DOOR_CAP} ` +
      `and the ${often.cleared} cleared`,
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
  /* A cleared word lets the next in the same day; see the test above. */
  assert.ok(first.met <= FRONT_DOOR_CAP + first.cleared,
    `${first.met} words on the first day, ${first.cleared} of them cleared`);
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
  /* The keen learner's pool is larger than sixty — it is sized to what
     their day reaches — but it is still a pool: never past what their own
     practice allowed when they sat down, and never past the ceiling. */
  assert.ok(peaks.peakOver <= 0, `words in hand went ${peaks.peakOver} past what practice allowed`);
  assert.ok(peaks.peakInHand <= IN_HAND_MAX, `words in hand reached ${peaks.peakInHand}`);
});

/* ------------------------------------------------------------------
   Effort buys the climb; time buys the keeping

   The release this was written for split what used to be one thing. A
   level used to open on a *gap* — through the learning steps below, four
   days of interval for the writing — so the ladder could only be climbed
   at the speed a calendar allows and an evening's work bought nothing.
   Now a level opens on two right answers in a row, and the gap is asked
   afterwards instead, as the two passes a card makes before it counts as
   learnt.

   So there are two claims to hold on to, and they pull opposite ways.
   Practising harder has to move the first. Nothing may move the second.

   These are read as directions rather than as numbers. The session
   builder shuffles what its ranking calls equal, using the real random
   rather than the clock handed in, so every figure this file prints moves
   a little between runs — which is worth knowing before reading any
   single line of its output as a result.
   ------------------------------------------------------------------ */

test("practising hard clears a card faster than practising once a day", () => {
  const steady = live({ cards: courseOf(60), days: 12, sessionsPerDay: 1 });
  const keen = live({ cards: courseOf(60), days: 12, sessionsPerDay: 8 });
  console.log(
    `    to clear a card: once a day ${steady.medianDaysToClear}, ` +
      `eight sittings a day ${keen.medianDaysToClear} days`,
  );
  assert.ok(keen.cleared > 0, "the keen learner cleared nothing in a fortnight");
  assert.ok(
    (keen.medianDaysToClear ?? 99) < (steady.medianDaysToClear ?? 99),
    `keen ${keen.medianDaysToClear} against steady ${steady.medianDaysToClear}: ` +
      "an evening's work bought nothing, which is the whole fault this release was for",
  );
});

test("and no amount of practice shortens the passes that follow", () => {
  /*
   * The other half, and the one that matters more. A pass is counted only
   * on an answer given when the question came round of its own accord, so
   * a learner drilling a card all evening cannot make one — and the two
   * of them sit behind gaps that start at a day and grow. Two reviews is
   * therefore never less than two days for anybody, and in practice
   * closer to four.
   */
  const keen = live({ cards: courseOf(60), days: 20, sessionsPerDay: 8 });
  console.log(
    `    eight sittings a day: cleared ${keen.cleared}, learnt ${keen.learnt}, ` +
      `median ${keen.medianPassDays} days from cleared to learnt`,
  );
  assert.ok(keen.learnt > 0, "nothing was ever kept");
  assert.ok(
    (keen.medianPassDays ?? 0) >= PASSES_TO_LEARN,
    `${keen.medianPassDays} days for ${PASSES_TO_LEARN} passes: a pass was made without a day passing`,
  );
  /* And cleared is genuinely ahead of learnt, which is what gives a
     learner something to see on the day they do the work. */
  assert.ok(keen.cleared >= keen.learnt, "more cards learnt than cleared, which cannot happen");
});

/* ------------------------------------------------------------------
   The learner who sits down all day, a month in

   Every test above asks whether new words arrive. None asked how often
   the *same* word does, which is how somebody practising fifteen times a
   day came to be dealt sixty words two or three times each, every day,
   with nothing new for a fortnight — and every test here stayed green.

   Measured on a 400-word course over sixty days, every answer right, with
   the simulation's clock fixed in 0.283 (before it, much of the app read
   today's date instead of the simulated one, and every figure printed
   here was off):

   |                                   | 0.279 | 0.280 pool grows | 0.281 climbers first, pool ×2 |
   |-----------------------------------|-------|------------------|-------------------------------|
   | 15 a day: words learnt            | 120   | 248              | about 275                     |
   | 15 a day: a card dealt, per day   | 5.4   | 3.8              | about 2.5                     |
   | 3 a day: words learnt             | 78    | 78               | about 60                      |
   | 1 a day: words learnt             | 23    | 24               | 24                            |

   Two things are still true and not what this test holds. At fifteen a
   day the pool fills around day twenty-five and new words stop for about
   three weeks, until the first words met stand at three-week gaps
   everywhere. And three a day is just past the keen line, where the
   climbers-first rule costs more than it gives: about 60 learnt against
   78. See DECISIONS.md.
   ------------------------------------------------------------------ */

test("fifteen sittings a day keep meeting new words, and meet the same card less", () => {
  const days = 60;
  const got = live({ cards: courseOf(400), days, sessionsPerDay: 15 });
  const late = got.daily.slice(30);
  const deals = late.reduce((n, d) => n + d.deals, 0);
  const distinct = late.reduce((n, d) => n + d.distinct, 0);
  const perCard = deals / Math.max(1, distinct);
  console.log(
    `    fifteen sittings a day: met ${got.met}, learnt ${got.learnt} in ${days} days; ` +
      `days 31–60 each card dealt ${perCard.toFixed(2)} times a day`,
  );
  /* See the table above for what these were before. The bounds sit well
     clear of both the old figures and the new on purpose — see the note
     above "Effort buys the climb" on why every figure here moves a little
     between runs. */
  assert.ok(got.met >= 300, `only ${got.met} words met in ${days} days`);
  assert.ok(got.learnt >= 220, `only ${got.learnt} words learnt in ${days} days`);
  assert.ok(perCard < 3.2, `each card came round ${perCard.toFixed(2)} times a day`);
});

test("and a once-a-day learner's reviews are never crowded out by the climbers", () => {
  /*
   * The case that decided where the keen line sits. Put the words still
   * climbing first for everybody and a once-a-day learner's nine places
   * go to them every day: the reviews that turn a cleared word into a
   * learnt one are crowded out, and what they learn falls away — measured
   * as none at all in sixty days under the simulation's old clock. Below
   * the line nothing about their order changed, and this holds them at
   * what they learnt before 0.281 (about two dozen in sixty days).
   */
  const got = live({ cards: courseOf(400), days: 60, sessionsPerDay: 1 });
  console.log(`    one sitting a day: met ${got.met}, learnt ${got.learnt} in 60 days`);
  assert.ok(got.learnt >= 12, `a once-a-day learner learnt ${got.learnt} words in sixty days`);
});

test("and the pool only grows for somebody who practises a lot", () => {
  /* Up to about three sittings a day the pool is the fixed sixty it
     always was — two words for each of the nine a sitting reaches is
     eighteen a sitting. */
  assert.equal(inHandFor(18), IN_HAND_CAP);
  assert.equal(inHandFor(54), IN_HAND_CAP);
  assert.equal(inHandFor(0), IN_HAND_CAP);
  assert.equal(inHandFor(undefined), IN_HAND_CAP);
  assert.equal(inHandFor(270), 270, "fifteen sittings of eighteen: two words for each of 135");
  assert.equal(inHandFor(100000), IN_HAND_MAX, "and a runaway day stops at the ceiling");
});
