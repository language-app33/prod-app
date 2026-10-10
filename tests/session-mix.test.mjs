// @ts-check
/*
 * The session mix, on its own: which cards a session practises.
 *
 * Everything here is the rule as the owner set it, one line at a time —
 * see the head of src/session-mix.ts — asserted on plain rows, with no
 * cards, schedules or app behind them. tests/session.test.mjs asserts the
 * same rule through the app's own session builder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const {
  mixSession,
  roomForNew,
  inLearningOf,
  isBehind,
  isRecent,
  SHARES,
  MAX_IN_LEARNING,
  RECENT_GAP,
  BEHIND_DAYS,
} = await import(path.join(here, "..", "src", "session-mix.ts"));

const AT = Date.UTC(2026, 9, 10, 12, 0, 0);
const HOUR = 3600000;
const DAY = 24 * HOUR;

/** @typedef {"new" | "learning" | "cleared" | "learnt"} Standing */

/**
 * One row of a pool.
 * @param {string} id
 * @param {Standing} standing
 * @param {Partial<{ due: number, lastSeen: number, overdue: boolean, askedFor: boolean, ridesWith: string[] }>} [over]
 */
const row = (id, standing, over = {}) => ({
  card: id,
  id,
  standing,
  due: standing === "new" ? 0 : AT - HOUR,
  lastSeen: standing === "new" ? 0 : AT - DAY,
  overdue: false,
  askedFor: false,
  ...over,
});
/** @param {string} prefix @param {number} n @param {Standing} standing @param {any} [over] */
const rows = (prefix, n, standing, over = {}) =>
  Array.from({ length: n }, (_, i) => row(`${prefix}${i + 1}`, standing, over));

const OPTS = { places: 10, at: AT, dayCards: 10 };
/** @param {any} mix */
const firstIds = (mix, n = mix.placed) => mix.cards.slice(0, n).map((/** @type {any} */ c) => c.id);
/** @param {string[]} list @param {string} prefix */
const howMany = (list, prefix) => list.filter((id) => id.startsWith(prefix)).length;

test("the shares are forty, thirty and thirty, and add up to the whole", () => {
  assert.deepEqual(SHARES, { learning: 0.4, cleared: 0.3, learnt: 0.3 });
  assert.equal(MAX_IN_LEARNING, 20);
  assert.equal(RECENT_GAP, 3 * HOUR);
  assert.equal(BEHIND_DAYS, 3);
});

test("with plenty of each, ten places are four in learning, three Cleared and three Learnt", () => {
  const pool = [...rows("l", 10, "learning"), ...rows("c", 10, "cleared"), ...rows("t", 10, "learnt")];
  const mix = mixSession(pool, OPTS);
  const placed = firstIds(mix);
  assert.equal(mix.placed, 10);
  assert.deepEqual([howMany(placed, "l"), howMany(placed, "c"), howMany(placed, "t")], [4, 3, 3]);
});

test("and the shares are interleaved, so a session cut short still holds the mix", () => {
  const pool = [...rows("l", 10, "learning"), ...rows("c", 10, "cleared"), ...rows("t", 10, "learnt")];
  const firstFive = firstIds(mixSession(pool, OPTS), 5);
  for (const prefix of ["l", "c", "t"]) assert.ok(howMany(firstFive, prefix) >= 1, `no ${prefix} in ${firstFive.join(" ")}`);
});

test("an empty share's places go to overdue Cleared, then overdue Learnt, then learning", () => {
  /* No Learnt cards due: their three places go to the Cleared cards left. */
  const noLearnt = mixSession([...rows("l", 10, "learning"), ...rows("c", 10, "cleared")], OPTS);
  assert.deepEqual([howMany(firstIds(noLearnt), "l"), howMany(firstIds(noLearnt), "c")], [4, 6]);
  /* Nothing Cleared either: the Learnt cards take what is left before learning does. */
  const learntOnly = mixSession([...rows("l", 10, "learning"), ...rows("t", 10, "learnt")], OPTS);
  assert.deepEqual([howMany(firstIds(learntOnly), "l"), howMany(firstIds(learntOnly), "t")], [4, 6]);
  /* No reviews at all: everything to learning. */
  const learningOnly = mixSession(rows("l", 10, "learning"), OPTS);
  assert.equal(howMany(firstIds(learningOnly), "l"), 10);
});

test("cards not yet due come after everything that is", () => {
  const pool = [...rows("a", 5, "cleared", { due: AT + DAY }), ...rows("c", 2, "cleared")];
  const mix = mixSession(pool, OPTS);
  assert.deepEqual(mix.cards.map((/** @type {any} */ c) => c.id).slice(0, 2), ["c1", "c2"]);
  assert.ok(mix.cards.some((/** @type {any} */ c) => c.id.startsWith("a")), "and they still fill the session");
});

test("new cards come in only to fill the learning share's gap", () => {
  /* Two in learning, plenty of reviews: two of the four learning places are
     a gap, and two new cards fill it — no more. */
  const pool = [...rows("l", 2, "learning"), ...rows("c", 10, "cleared"), ...rows("t", 10, "learnt"), ...rows("n", 30, "new")];
  const mix = mixSession(pool, OPTS);
  assert.equal(mix.newcomers, 2);
  assert.equal(howMany(firstIds(mix), "n"), 2);
  assert.ok(!mix.cards.slice(mix.placed).some((/** @type {any} */ c) => c.id.startsWith("n")), "and none tops the session up");
});

test("a pool of nothing but new cards opens a session's places of them", () => {
  const mix = mixSession(rows("n", 60, "new"), OPTS);
  assert.equal(mix.newcomers, 10);
  assert.equal(mix.cards.length, 10);
});

test("never more than twenty cards in learning", () => {
  const nineteen = mixSession([...rows("l", 19, "learning", { lastSeen: AT - HOUR }), ...rows("n", 10, "new")], OPTS);
  assert.equal(nineteen.newcomers, 1, "room for one more");
  const twenty = mixSession([...rows("l", 20, "learning", { lastSeen: AT - HOUR }), ...rows("n", 10, "new")], OPTS);
  assert.equal(twenty.newcomers, 0);
  assert.equal(roomForNew([...rows("l", 20, "learning")], OPTS), 0);
  assert.equal(inLearningOf([...rows("l", 7, "learning"), ...rows("c", 3, "cleared")]), 7);
});

test("a card practised in the last three hours is left out, and comes last", () => {
  const recent = rows("r", 4, "learning", { lastSeen: AT - HOUR });
  const older = rows("o", 4, "learning", { lastSeen: AT - 4 * HOUR });
  const mix = mixSession([...recent, ...older], OPTS);
  assert.deepEqual(firstIds(mix), ["o1", "o2", "o3", "o4"]);
  assert.deepEqual(mix.cards.slice(4).map((/** @type {any} */ c) => c.id), ["r1", "r2", "r3", "r4"],
    "still there, behind everything, so a pool of nothing else is still a session");
  assert.equal(isRecent({ lastSeen: AT - 3 * HOUR + 1, overdue: false }, AT), true);
  assert.equal(isRecent({ lastSeen: AT - 3 * HOUR, overdue: false }, AT), false, "the gap has an end");
});

test("unless a review on it was already overdue", () => {
  const backlog = rows("b", 3, "cleared", { lastSeen: AT - HOUR, due: AT - DAY, overdue: true });
  const mix = mixSession([...backlog, ...rows("t", 3, "learnt")], OPTS);
  for (const id of ["b1", "b2", "b3"]) assert.ok(firstIds(mix).includes(id), `${id} was held back`);
});

test("coming back within three hours makes room for new cards; waiting does not", () => {
  const justPractised = rows("l", 4, "learning", { lastSeen: AT - HOUR });
  const back = mixSession([...justPractised, ...rows("n", 10, "new")], OPTS);
  assert.ok(back.newcomers > 0, "nothing new for somebody back within the hour");
  const thisMorning = rows("l", 10, "learning", { lastSeen: AT - 5 * HOUR });
  const later = mixSession([...thisMorning, ...rows("n", 10, "new")], OPTS);
  assert.equal(later.newcomers, 0, "new cards while ten in learning were waiting");
});

test("no new cards while overdue reviews add up to more than three days' practice", () => {
  /* A day is ten cards here, so thirty overdue is the line. */
  const atLine = [...rows("c", 30, "cleared"), ...rows("n", 10, "new")];
  assert.equal(isBehind(atLine, OPTS), false);
  assert.ok(mixSession(atLine, OPTS).newcomers > 0);
  const past = [...rows("c", 31, "cleared"), ...rows("n", 10, "new")];
  const mix = mixSession(past, OPTS);
  assert.equal(mix.behind, true);
  assert.equal(mix.newcomers, 0);
  assert.equal(roomForNew(past, OPTS), 0);
  /* And a day is never read as less than a session's places. */
  assert.equal(isBehind(rows("c", 31, "cleared"), { ...OPTS, dayCards: 1 }), true);
  assert.equal(isBehind(rows("c", 29, "cleared"), { ...OPTS, dayCards: 1 }), false);
});

test("a card asked for by name comes first, on top of the shares", () => {
  const asked = row("asked", "learnt", { due: AT + 30 * DAY, askedFor: true });
  const pool = [...rows("l", 10, "learning"), ...rows("c", 10, "cleared"), ...rows("t", 10, "learnt"), asked];
  const mix = mixSession(pool, OPTS);
  assert.equal(mix.cards[0].id, "asked");
  assert.equal(mix.placed, 10, "and the shares still have all ten places");
});

test("a digit card comes in with its word and takes no place of its own", () => {
  const word = row("w", "new");
  const digit = row("d", "new", { ridesWith: ["w"] });
  const mix = mixSession([word, digit], OPTS);
  const order = mix.cards.map((/** @type {any} */ c) => c.id);
  assert.deepEqual(order, ["w", "d"], "right behind its word");
  assert.equal(mix.newcomers, 1, "the word is the one new card");
  /* A digit whose word nobody has met does not come in on its own. */
  const alone = mixSession([row("d", "new", { ridesWith: ["x"] }), row("x", "new", { due: 0 })], { ...OPTS, places: 1 });
  assert.ok(alone.cards.findIndex((/** @type {any} */ c) => c.id === "d") > alone.cards.findIndex((/** @type {any} */ c) => c.id === "x"));
  /* One whose word is met comes in up front. */
  const met = mixSession([...rows("c", 10, "cleared"), row("w", "learnt", { due: AT + DAY }), row("d", "new", { ridesWith: ["w"] })], OPTS);
  assert.equal(met.cards[0].id, "d");
});

test("cards all practised a moment ago still come nearest-due first", () => {
  const pool = [row("far", "learnt", { due: AT + 60 * DAY, lastSeen: AT - 10 }), row("soon", "learnt", { due: AT + DAY, lastSeen: AT - 20 })];
  assert.deepEqual(mixSession(pool, OPTS).cards.map((/** @type {any} */ c) => c.id), ["soon", "far"]);
});
