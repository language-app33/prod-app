// @ts-check
/*
 * Work that could not be sent yet.
 *
 * The app promises that anything done while disconnected is kept and sent
 * when a connection returns. For everything a learner *learns* that was
 * always true — it travels in the document. For the two things they can do
 * that are messages to somebody else, it was not: a problem reported about
 * a card was tried once and dropped, and a card a teacher had just written
 * went with the connection that failed to carry it.
 *
 * So these are the rules that promise now rests on, and every one of them
 * is a way it could quietly stop being true again.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

/* A stand-in for the browser's store, installed before the module is
   imported so its lazy reads find it. Node has no localStorage of its own,
   which is the whole reason outbox.ts reaches for it through globalThis. */
function fakeStorage() {
  /** @type {Map<string, string>} */
  const held = new Map();
  return {
    getItem: (/** @type {string} */ k) => (held.has(k) ? held.get(k) : null),
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => held.set(k, String(v)),
    removeItem: (/** @type {string} */ k) => held.delete(k),
    key: (/** @type {number} */ i) => [...held.keys()][i] ?? null,
    clear: () => held.clear(),
    get length() {
      return held.size;
    },
  };
}

const store = fakeStorage();
Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });

const {
  OUTBOX_CAP,
  drainOutbox,
  drop,
  fresh,
  keep,
  loadOutbox,
  pendingOf,
  saveOutbox,
  waiting,
  withKept,
  without,
} = await import("../src/outbox.ts");

const DAY = 86400000;

/* ------------------------------------------------------------------
   The pure core
   ------------------------------------------------------------------ */

test("one kind of waiting work never sends another's", () => {
  let list = withKept([], "flag", { note: "a" }, 1, "f1");
  list = withKept(list, "card", { id: "c" }, 2, "c1");
  list = withKept(list, "flag", { note: "b" }, 3, "f2");

  assert.deepEqual(pendingOf(list, "flag").map((p) => p.id), ["f1", "f2"]);
  assert.deepEqual(pendingOf(list, "card").map((p) => p.id), ["c1"]);
});

test("what is waiting comes back oldest first, which is the order to send it", () => {
  /* Kept out of order on purpose: a device whose clock jumped, or two
     writes in the same millisecond, must not decide the order. */
  let list = withKept([], "flag", {}, 300, "third");
  list = withKept(list, "flag", {}, 100, "first");
  list = withKept(list, "flag", {}, 200, "second");
  assert.deepEqual(pendingOf(list, "flag").map((p) => p.id), ["first", "second", "third"]);
});

test("past the cap the oldest goes, not the newest", () => {
  /* The newest is the thing somebody still remembers writing, and losing
     it is the loss they would notice. */
  /** @type {import("../src/outbox.ts").Pending[]} */
  let list = [];
  for (let i = 0; i < OUTBOX_CAP + 5; i++) {
    list = withKept(list, "flag", { n: i }, i + 1, `f${i}`);
  }
  const mine = pendingOf(list, "flag");
  assert.equal(mine.length, OUTBOX_CAP, "the cap holds");
  assert.equal(mine[mine.length - 1].id, `f${OUTBOX_CAP + 4}`, "the newest is still there");
  assert.equal(mine[0].id, "f5", "and the five oldest are the ones that went");
});

test("one kind filling up does not push another kind out", () => {
  let list = withKept([], "card", { id: "mine" }, 1, "c1");
  for (let i = 0; i < OUTBOX_CAP + 10; i++) {
    list = withKept(list, "flag", { n: i }, i + 2, `f${i}`);
  }
  assert.deepEqual(
    pendingOf(list, "card").map((p) => p.id),
    ["c1"],
    "a teacher's unsent card survives a run of reported problems",
  );
});

test("anything too old to be worth sending is dropped", () => {
  const now = 100 * DAY;
  const list = [
    { id: "old", kind: "flag", at: now - 20 * DAY, body: {} },
    { id: "new", kind: "flag", at: now - 1 * DAY, body: {} },
  ];
  assert.deepEqual(fresh(list, now).map((p) => p.id), ["new"]);
});

test("removing one leaves the rest alone", () => {
  let list = withKept([], "flag", {}, 1, "a");
  list = withKept(list, "flag", {}, 2, "b");
  assert.deepEqual(without(list, "a").map((p) => p.id), ["b"]);
  assert.deepEqual(without(list, "nobody").map((p) => p.id), ["a", "b"], "a miss changes nothing");
});

/* ------------------------------------------------------------------
   The store
   ------------------------------------------------------------------ */

test("what is kept survives being read back", () => {
  store.clear();
  keep("flag", { note: "the audio is wrong" });
  const [held] = pendingOf(loadOutbox(), "flag");
  assert.deepEqual(held.body, { note: "the audio is wrong" });
  assert.equal(waiting("flag"), 1);
});

test("a store that refuses to answer reads as nothing waiting, not as a crash", () => {
  /* A private window with storage switched off. The app has to go on
     working; what it must not do is throw on the way past. */
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    },
    configurable: true,
  });
  assert.deepEqual(loadOutbox(), []);
  assert.equal(waiting("flag"), 0);
  assert.doesNotThrow(() => saveOutbox([{ id: "x", kind: "flag", at: 1, body: {} }]));
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
});

test("nonsense in the store reads as nothing waiting", () => {
  store.clear();
  store.setItem("arabic-trainer:outbox", "{not json");
  assert.deepEqual(loadOutbox(), []);
  store.setItem("arabic-trainer:outbox", JSON.stringify([{ nothing: true }, null]));
  assert.deepEqual(loadOutbox(), [], "and an entry with no name is not an entry");
});

/* ------------------------------------------------------------------
   Sending it
   ------------------------------------------------------------------ */

test("what goes up is taken out of the queue", async () => {
  store.clear();
  keep("flag", { n: 1 });
  keep("flag", { n: 2 });

  /** @type {unknown[]} */
  const sent = [];
  const out = await drainOutbox("flag", async (body) => {
    sent.push(body);
    return "sent";
  });

  assert.deepEqual(sent, [{ n: 1 }, { n: 2 }], "oldest first");
  assert.equal(out.sent, 2);
  assert.equal(out.left, 0);
  assert.equal(waiting("flag"), 0, "and nothing is sent twice on the next drain");
});

test("a refusal is dropped rather than asked again for ever", async () => {
  /* The card it was about has gone, or the account has. Asking again would
     be told the same thing, and the queue would never empty. */
  store.clear();
  keep("flag", { n: 1 });
  const out = await drainOutbox("flag", async () => "drop");
  assert.equal(out.sent, 0);
  assert.equal(waiting("flag"), 0);
});

test("a connection that is still down keeps everything, and stops trying", async () => {
  store.clear();
  keep("flag", { n: 1 });
  keep("flag", { n: 2 });
  let tries = 0;
  const out = await drainOutbox("flag", async () => {
    tries += 1;
    return "keep";
  });
  assert.equal(tries, 1, "one request tests the connection; the rest wait behind it");
  assert.equal(out.sent, 0);
  assert.equal(waiting("flag"), 2, "and nothing was lost by trying");
});

test("a sender that throws is treated as the connection, not as a refusal", async () => {
  /* The difference matters: a thrown sender must never be the reason a
     teacher's card is discarded. */
  store.clear();
  keep("card", { id: "c1" });
  await drainOutbox("card", async () => {
    throw new Error("boom");
  });
  assert.equal(waiting("card"), 1);
});

test("one kind's drain leaves the other kind's work alone", async () => {
  store.clear();
  keep("flag", { n: 1 });
  keep("card", { id: "c1" });
  await drainOutbox("flag", async () => "sent");
  assert.equal(waiting("flag"), 0);
  assert.equal(waiting("card"), 1);
});

test("dropping one by name leaves the rest", () => {
  store.clear();
  const first = keep("flag", { n: 1 });
  keep("flag", { n: 2 });
  drop(first.id);
  assert.deepEqual(pendingOf(loadOutbox(), "flag").map((p) => p.body), [{ n: 2 }]);
});
