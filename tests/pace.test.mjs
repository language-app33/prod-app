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

const { buildSession, installIndexes, setOfflineNow, setAudibleClips, laddered, mixCardsOf, NEW_PER_DAY } = await import(
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
} = await import(path.join(root, "src", "scheduler.ts"));
const { MAX_IN_LEARNING, inLearningOf } = await import(path.join(root, "src", "session-mix.ts"));
const { SESSION_SIZE } = await import(path.join(root, "src", "session-layout.ts"));

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
 * A course shaped like a teacher's rather than a list of identical words.
 *
 * Mostly nouns, every other one with its plural as a second form drilled
 * in its own right; some adjectives with their feminine; and every tenth
 * card a sentence built out of them, which can be asked nothing until its
 * words are cleared. Spread through the course in the order a teacher
 * would write it, so a sentence turns up after the words it is made of.
 */
function mixedCourseOf(/** @type {number} */ n) {
  /** @type {any[]} */
  const out = [];
  for (let i = 1; out.length < n; i += 1) {
    if (i % 10 === 0) {
      out.push({
        id: `s${i}`, lang: "ar-PS", sentence: true, created: i,
        forms: [{ id: `s${i}`, ar: `{{noun}} {{adjective}} ${i}`, en: `a {{adjective}} {{noun}} ${i}`, lat: `{{noun}} {{adjective}} ${i}` }],
      });
    } else if (i % 7 === 0) {
      out.push({
        id: `a${i}`, lang: "ar-PS", category: "adjective", created: i,
        forms: [
          { id: `a${i}`, ar: `صفة${i}`, en: `adjective ${i}`, lat: `sifa${i}` },
          { id: `a${i}-f`, ar: `صفة${i}ة`, en: `adjective ${i}`, lat: `sifa${i}e`, row: "agreement", col: "feminine" },
        ],
      });
    } else {
      const gender = i % 3 ? "masculine" : "feminine";
      /** @type {any[]} */
      const forms = [{ id: `n${i}`, ar: `اسم${i}`, en: `noun ${i}`, lat: `ism${i}`, number: "singular", gender, human: "thing" }];
      if (i % 2) forms.push({ id: `n${i}-p`, ar: `اسماء${i}`, en: `nouns ${i}`, lat: `asma${i}`, number: "plural", gender, human: "thing" });
      out.push({ id: `n${i}`, lang: "ar-PS", category: "noun", created: i, forms });
    }
  }
  return out;
}

/*
 * A learner who forgets.
 *
 * Every other learner in this file answers everything right, which makes
 * them the upper bound on pace and blind to the one cost the caps exist
 * for: words forgotten because too many are in play at once. This one has
 * a memory of each form, hidden from the app, and answers from it.
 *
 * The model is the usual one and deliberately simple. Each form has a
 * strength in days; the chance of recalling it falls away with the time
 * since it was last seen, as exp(-days / strength). Recalling it makes it
 * stronger, and by more the closer it was to being lost — so the same
 * word answered five times in an hour gains a little, and answered after a
 * gap gains a lot. Missing it weakens it, but never below where it was
 * the first time it was seen: a miss shows the answer and the app asks it
 * again before the sitting ends, so a missed word is taught again rather
 * than lost.
 *
 * Calibrated to the common figures rather than fitted to anything here: a
 * word met in one sitting and got right twice there is recalled about two
 * times in three the next day, and one recalled after a day's gap lasts
 * about five more. Words differ in how hard they
 * are, and `memory` scales the whole learner: 1 is typical, 0.5 somebody
 * who struggles.
 *
 * Seeded, so the learner's luck is the same from one run to the next and
 * only the session builder's shuffle moves the figures.
 */
const SEEN_STRENGTH = 1;
const FLOOR = 0.3;
const GROWTH = 3;
const LAPSE = 0.4;

/** @param {number} seed */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How hard a word is, from 0.6 to 1.6, fixed by its id. */
function hardness(/** @type {string} */ id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 0.6 + ((h >>> 0) % 1000) / 1000;
}

function forgetter({ memory = 1, seed = 1 } = {}) {
  const roll = seeded(seed);
  /** @type {Map<string, { strength: number, last: number }>} */
  const held = new Map();
  let answered = 0;
  let right = 0;
  const recall = (/** @type {{ strength: number, last: number }} */ m, /** @type {number} */ at) =>
    Math.exp(-Math.max(0, at - m.last) / DAY / m.strength);
  return {
    /** Answer a question on one form at `at`; true when it was right. */
    answer(/** @type {string} */ itemId, /** @type {string | null} */ subId, /** @type {number} */ at) {
      const key = `${itemId}/${subId || ""}`;
      const gain = memory / hardness(itemId);
      const m = held.get(key);
      /* The first time a form is put to the learner it is being taught,
         with the answer in front of them. It is seen, not recalled. */
      if (!m) {
        held.set(key, { strength: SEEN_STRENGTH * gain, last: at });
        return true;
      }
      const r = recall(m, at);
      const ok = roll() < r;
      answered += 1;
      if (ok) right += 1;
      m.strength = ok ? m.strength * (1 + gain * (FLOOR + GROWTH * (1 - r))) : Math.max(SEEN_STRENGTH * gain, m.strength * LAPSE);
      m.last = at;
      return ok;
    },
    /**
     * What the learner would get right if tested at `at` with no more
     * practice: summed over the words met, each as its weakest form.
     */
    knownAt(/** @type {number} */ at) {
      /** @type {Map<string, number>} */
      const worst = new Map();
      for (const [key, m] of held) {
        const id = key.split("/")[0];
        worst.set(id, Math.min(worst.get(id) ?? 1, recall(m, at)));
      }
      let sum = 0;
      for (const r of worst.values()) sum += r;
      return sum;
    },
    accuracy: () => (answered ? right / answered : 1),
  };
}

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
  /** @type {ReturnType<typeof forgetter> | null} */ learner = null,
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
  let nth = 0;
  for (const ex of built.exercises || []) {
    nth += 1;
    dealt.add(ex.id);
    log[day] = (log[day] || 0) + 1;
    /* A learner who forgets answers from memory; one who doesn't, right.
       The questions in a sitting are a minute apart, so a form asked twice
       in one is a minute's gap rather than none. */
    const asked = at + nth * 60000;
    const ok = !learner || learner.answer(ex.id, ex.subId || null, asked);
    const marks = [{ id: ex.id, subId: ex.subId || null, rating: ok ? "good" : "again", correct: ok, advance: true }];
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
      const mateOk = !learner || learner.answer(m.id, m.subId || null, asked);
      marks.push({
        id: m.id,
        subId: m.subId || null,
        rating: mateOk ? "good" : "again",
        correct: mateOk,
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
 * @param {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number, learner?: ReturnType<typeof forgetter> | null }} how
 */
function live({ cards, days, budget = SESSION_SIZE, sessionsPerDay = 1, learner = null }) {
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
      const ran = sitDown(items, at, budget, log, learner);
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
    /* For a learner who forgets: what they would get right the morning
       after the last day, and a month after that with no practice at all
       — the honest measure of what the course left them with. */
    knownNow: learner ? learner.knownAt(START + days * DAY) : null,
    knownInAMonth: learner ? learner.knownAt(START + (days + 30) * DAY) : null,
    accuracy: learner ? learner.accuracy() : 1,
    /* The day each word was first met, for counting what arrived when. */
    firstSeen,
    /* The number the last attempt at this regressed. */
    medianDaysToMaster: days_to_master.length
      ? days_to_master.sort((a, b) => a - b)[Math.floor(days_to_master.length / 2)]
      : null,
  };
}

/** The same life, watching how many cards are ever in learning at once. */
function liveKeeping(/** @type {{ cards: any[], days: number, budget?: number, sessionsPerDay?: number }} */ how) {
  let items = how.cards;
  let peakLearning = 0;
  /** @type {Record<string, number>} */
  const log = {};
  for (let d = 0; d < how.days; d += 1) {
    for (let s2 = 0; s2 < (how.sessionsPerDay || 1); s2 += 1) {
      const at = START + d * DAY + s2 * 3600000;
      const ran = sitDown(items, at, how.budget || SESSION_SIZE, log);
      items = ran.cards;
      peakLearning = Math.max(peakLearning, inLearningOf(mixCardsOf(items, items, settings)));
    }
  }
  return { peakLearning };
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

test("no quota is counted in sessions: one sitting can open a session's worth", () => {
  /* Under the old rule this was three, whatever the learner's state. */
  const day = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1, budget: 20 });
  console.log(`    one twenty-question sitting met ${day.met} words`);
  assert.ok(day.met > 3, `still rationed per session: ${day.met}`);
});

test("and twenty in learning bounds a day however many sittings it holds", () => {
  /* Ten sittings in an evening is the case that started this. Coming back
     within three hours does bring new cards in — that is how somebody who
     practises often has more on the go — but never past twenty in learning,
     plus whatever was cleared that day and so left room behind it. */
  const once = live({ cards: courseOf(300), days: 1, sessionsPerDay: 1 });
  const often = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10 });
  console.log(`    in one day: one sitting met ${once.met}, ten sittings met ${often.met}`);
  assert.ok(
    often.met <= MAX_IN_LEARNING + often.cleared,
    `ten sittings met ${often.met} words, past ${MAX_IN_LEARNING} in learning and the ${often.cleared} cleared`,
  );
});

test("twenty in learning is never exceeded, however hard the learner goes", () => {
  for (const sessionsPerDay of [1, 3, 30]) {
    const lived = liveKeeping({ cards: courseOf(300), days: sessionsPerDay === 30 ? 10 : 60, sessionsPerDay });
    assert.ok(lived.peakLearning <= MAX_IN_LEARNING,
      `${sessionsPerDay} a day: ${lived.peakLearning} in learning, past ${MAX_IN_LEARNING}`);
  }
});

test("a course arrives gradually rather than all at once", () => {
  const first = live({ cards: courseOf(300), days: 1, sessionsPerDay: 10, budget: 20 });
  /* A cleared word lets the next in the same day; see the test above. */
  assert.ok(first.met <= MAX_IN_LEARNING + first.cleared,
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
    hard.met > MAX_IN_LEARNING,
    `stuck at ${hard.met} words: nothing in learning ever cleared, so no new word came in`,
  );
  assert.ok(hard.mastered > 0, "nothing reached the top of its ladder");
});

test("and doing too much never beats doing the right amount", () => {
  /* The other side of it, and the property the limit exists for: the keen
     learner may meet more words — they have genuinely cleared more — but
     never holds more than twenty in learning, so practice cannot buy its
     way past the pacing. */
  const steady = live({ cards: courseOf(60), days: 10, sessionsPerDay: 1 });
  const keen = live({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(keen.met >= steady.met, `${keen.met} against ${steady.met}`);
  const peaks = liveKeeping({ cards: courseOf(60), days: 10, sessionsPerDay: 30 });
  assert.ok(peaks.peakLearning <= MAX_IN_LEARNING, `${peaks.peakLearning} in learning`);
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

test("new cards arrive as fast as the prep forecast's floor assumes, and no faster", () => {
  /* The forecast says the soonest a prep could be ready, and reads new
     cards as arriving NEW_PER_DAY a day at most. Measured here on the
     learner who practises most and never gets anything wrong, and held to
     it: a change to the mix that moves this moves the forecast too. */
  const fast = live({ cards: courseOf(300), days: 10, sessionsPerDay: 15 });
  const perDay = Math.max(...[...Array(10).keys()].map((d) => [...fast.firstSeen.values()].filter((x) => x === d).length));
  console.log(`    fifteen sittings a day, never wrong: at most ${perDay} new cards in a day`);
  assert.ok(Math.abs(perDay - NEW_PER_DAY) <= NEW_PER_DAY / 5,
    `${perDay} new cards in a day against the forecast's ${NEW_PER_DAY}: measure it again and set it`);
});

/* ------------------------------------------------------------------
   A learner who forgets, on a course shaped like a teacher's

   Every figure above is a learner who never gets anything wrong, on a
   course of identical words. That can show what letting more words in
   gains and never what it costs, so every limit in the app was set
   without seeing its cost. These are the same lives with a learner who
   forgets (see `forgetter`) on a mixed course (see `mixedCourseOf`), and
   what they report is the outcome that matters: how many words the
   learner would actually get right, the morning after and a month later.
   ------------------------------------------------------------------ */

/** @type {Map<string, ReturnType<typeof live>>} */
const lived = new Map();
/* Each life is lived once and read by whichever test asks, because the
   keen one takes minutes. */
const honestLife = (/** @type {{ sessionsPerDay: number, memory?: number }} */ how) => {
  const key = `${how.sessionsPerDay}/${how.memory ?? 1}`;
  if (!lived.has(key)) {
    lived.set(key, live({
      cards: mixedCourseOf(400),
      days: 90,
      sessionsPerDay: how.sessionsPerDay,
      learner: forgetter({ memory: how.memory ?? 1, seed: 7 }),
    }));
  }
  return /** @type {ReturnType<typeof live>} */ (lived.get(key));
};

const report = (/** @type {string} */ who, /** @type {ReturnType<typeof live>} */ got) =>
  console.log(
    `    ${who}: met ${got.met}, cleared ${got.cleared}, learnt ${got.learnt}; ` +
      `${Math.round(got.accuracy * 100)}% of answers right; ` +
      `would know ${Math.round(got.knownNow ?? 0)} the next morning, ${Math.round(got.knownInAMonth ?? 0)} a month on`,
  );

test("a learner who forgets: what ninety days leave them knowing", () => {
  for (const sittings of [1, 3, 15]) {
    const got = honestLife({ sessionsPerDay: sittings });
    report(`${sittings} a day, typical memory`, got);
    assert.ok(got.met > 0 && (got.knownNow ?? 0) > 0, `${sittings} a day learnt nothing`);
  }
});

test("a learner who struggles is given fewer new words, not more to forget", () => {
  /* The claim the caps rest on and nothing had measured: somebody who
     keeps forgetting has words that never settle, those words hold their
     places, and new ones slow down on their own. */
  const typical = honestLife({ sessionsPerDay: 3 });
  const weak = honestLife({ sessionsPerDay: 3, memory: 0.5 });
  report("3 a day, typical memory", typical);
  report("3 a day, struggling", weak);
  assert.ok(weak.met <= typical.met, `the struggling learner met ${weak.met} against ${typical.met}`);
});

