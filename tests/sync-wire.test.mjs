/*
 * The round trip: pull, merge, push — and every way the server can say no.
 *
 * `mergeData` is covered twenty-nine ways in `tests/sync.test.mjs`. What
 * uses it was covered by nothing at all: the fetch, the conditional write,
 * the one retry when another device wrote in between, and the four
 * refusals the server can answer with. That is the same corner the
 * progress-durability audit's first finding lived in — a document the
 * server could not read locking every device out of sync for good — and
 * the fix for that was tested on the server and not here, on the side that
 * has to do something sensible with the answer.
 *
 * Nothing here needs a browser. The client reaches the network through one
 * `fetch`, so a stub that answers what the server would is the whole of
 * the harness, and every assertion is about what the client sent or what
 * it did with what came back.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { syncOnce, drainRemote, forgetRemote, pullClip, pushClip, MAX_DOC_BYTES } from "../src/sync.ts";
import { TYPES } from "../src/languages.ts";
import { must } from "./helpers.mjs";

const TOKEN = "a".repeat(64);

const fresh = () => ({
  phase: "new", step: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0,
  right: 0, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0,
});
const states = () => Object.fromEntries(TYPES.map((t) => [t, fresh()]));

/** A card as the device holds one. @returns {any} */
const item = (/** @type {string} */ id, /** @type {Record<string, any>} */ over = {}) => ({
  id, tags: [], created: 0, updated: 100,
  forms: [{ id, ar: "كتاب", en: "book", lat: "kitaab", s: states() }],
  ...over,
});

/** A document as the device holds one. @returns {any} */
const doc = (/** @type {any[]} */ items, /** @type {Record<string, any>} */ extra = {}) => ({
  version: 3, items, tombstones: {}, parked: {}, log: {}, moves: {},
  settings: {}, settingsUpdated: 0, ...extra,
});

/**
 * A stand-in server, recording what it was asked.
 *
 * `answers` is a list of replies to give in order — the client makes one
 * request per step of the round trip, and what a test is usually about is
 * what it does on the second. Each reply is `{ status, body }`; a missing
 * one is a test that expected fewer requests than the client made, and
 * says so rather than answering something plausible.
 *
 * Cast rather than completed: what is here is what the client reaches for,
 * and a whole Response would say less about that, not more.
 *
 * @param {{ status?: number, body?: any }[]} answers
 */
const serverSaying = (answers) => {
  /** @type {{ method: string, url: string, body: any }[]} */
  const sent = [];
  let at = 0;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (
    async (/** @type {any} */ url, /** @type {any} */ opts = {}) => {
      const body = opts.body ? JSON.parse(String(opts.body)) : null;
      sent.push({ method: opts.method || "GET", url: String(url), body });
      const say = answers[at++];
      if (!say) throw new Error(`the client made request ${at}, and only ${answers.length} were prepared`);
      const status = say.status === undefined ? 200 : say.status;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => say.body,
      };
    }
  ));
  return sent;
};

/* The two shapes the endpoint answers a read with. */
const held = (/** @type {any} */ data, /** @type {string | null} */ etag = "e1") => ({ etag, data });
const neverSynced = () => ({ etag: null, data: null });

/* ------------------------------------------------------------------
   The ordinary round trip
   ------------------------------------------------------------------ */

test("a first sync sends the document as a first write", () => {
  /* Nothing there: the push carries a null ETag, which is what tells the
     server to refuse if a document has appeared in the meantime. */
  const sent = serverSaying([{ body: neverSynced() }, { body: { ok: true, etag: "e1" } }]);
  return syncOnce(doc([item("a")]), TOKEN).then((out) => {
    assert.equal(sent.length, 2, "one read and one write");
    assert.equal(sent[0].method, "GET");
    assert.equal(sent[1].method, "POST");
    assert.equal(must(sent[1].body, "the push body").etag, null, "a first write claims no ETag");
    assert.deepEqual(must(sent[1].body, "the push body").data.items.map((/** @type {any} */ i) => i.id), ["a"]);
    assert.equal(out.changed, false, "nothing came back that this device did not have");
  });
});

test("what the other device had is merged in, and the merge is what goes up", () => {
  const theirs = doc([item("b")]);
  const sent = serverSaying([{ body: held(theirs) }, { body: { ok: true, etag: "e2" } }]);
  return syncOnce(doc([item("a")]), TOKEN).then((out) => {
    assert.deepEqual(out.merged.items.map((/** @type {any} */ i) => i.id).sort(), ["a", "b"]);
    assert.deepEqual(
      must(sent[1].body, "the push body").data.items.map((/** @type {any} */ i) => i.id).sort(),
      ["a", "b"],
      "and both go back up, so the other device's copy is not the only one",
    );
    assert.equal(must(sent[1].body, "the push body").etag, "e1", "the write is conditional on what was read");
    assert.equal(out.changed, true, "the caller is told to adopt the merge");
  });
});

test("the token goes in the header on every request, and never in the URL", () => {
  /* The passphrase's digest is what the whole document is keyed by. In a
     URL it would reach the server's logs, and a proxy's. */
  const sent = serverSaying([{ body: neverSynced() }, { body: { ok: true, etag: "e1" } }]);
  return syncOnce(doc([item("a")]), TOKEN).then(() => {
    for (const r of sent) assert.doesNotMatch(r.url, /a{16}/, `token in the URL: ${r.url}`);
  });
});

test("what goes up is the wire form: no device-only fields, and no untouched schedules", () => {
  /*
   * Every form carries one state per exercise type and most have never
   * been touched. Writing them out cost about four kilobytes a card and
   * put a ceiling near a thousand cards, past which the server refused the
   * document and sync stopped for good.
   */
  const it = item("a");
  it.forms[0].s.ar2en = { ...fresh(), reps: 3, updated: 10 };
  const local = doc([it], {
    syncedAt: 999,
    dirty: true,
    /* Each of these is work a learner did that lives beside the cards: the
       drawer of progress on withdrawn cards, the headstones that stop a
       deleted card coming back, the day tallies the Progress tab reads. A
       wire form that dropped any of them would lose it on every device but
       the one it happened on. */
    parked: { withdrawn: { at: 5, forms: { withdrawn: { s: { ar2en: { ...fresh(), reps: 9 } } } } } },
    tombstones: { removed: 7 },
    log: { "2026-09-22": 12 },
    moves: { "2026-09-22": { up: 1, cleared: 2, learnt: 3 } },
    settings: { language: "ar-PS" },
    settingsUpdated: 42,
  });
  const sent = serverSaying([{ body: neverSynced() }, { body: { ok: true, etag: "e1" } }]);
  return syncOnce(local, TOKEN).then(() => {
    const up = must(sent[1].body, "the push body").data;
    assert.deepEqual(Object.keys(up.items[0].forms[0].s), ["ar2en"], "only what has been answered");
    assert.equal(up.syncedAt, undefined, "and nothing this device keeps for itself");
    assert.equal(up.dirty, undefined);
    /* The fields the document is actually made of go, with what is in them. */
    assert.equal(up.parked.withdrawn.forms.withdrawn.s.ar2en.reps, 9, "the drawer travels");
    assert.deepEqual(up.tombstones, { removed: 7 });
    assert.deepEqual(up.log, { "2026-09-22": 12 });
    assert.deepEqual(up.moves, { "2026-09-22": { up: 1, cleared: 2, learnt: 3 } });
    assert.deepEqual(up.settings, { language: "ar-PS" });
    assert.equal(up.settingsUpdated, 42, "and the stamp that says when they were changed");
  });
});

test("a device with nothing on it does not claim to have emptied the collection", () => {
  /*
   * The server refuses a push that would empty a document that is not
   * empty, because the only way to reach that is a merge that lost
   * everything. `allowEmpty` is how a learner who has genuinely removed
   * every card says so, and it is the headstones that prove it.
   */
  const sent = serverSaying([
    { body: neverSynced() }, { body: { ok: true, etag: "e1" } },
    { body: neverSynced() }, { body: { ok: true, etag: "e1" } },
    { body: neverSynced() }, { body: { ok: true, etag: "e1" } },
  ]);
  return syncOnce(doc([]), TOKEN)
    .then(() => {
      assert.equal(must(sent[1].body, "the push body").allowEmpty, false,
        "nothing to send and nothing deleted is not an emptying");
      return syncOnce(doc([], { tombstones: { gone: Date.now() } }), TOKEN);
    })
    .then(() => {
      assert.equal(must(sent[3].body, "the push body").allowEmpty, true,
        "every card removed, with the headstones to show for it");
      return syncOnce(doc([item("a")], { tombstones: { gone: Date.now() } }), TOKEN);
    })
    .then(() => {
      assert.equal(must(sent[5].body, "the push body").allowEmpty, false,
        "a document with a card in it is never an emptying, whatever was deleted");
    });
});

/* ------------------------------------------------------------------
   Another device wrote in between
   ------------------------------------------------------------------ */

test("a write refused as stale is redone once, against what is there now", () => {
  /*
   * The ETag is what stops a device overwriting work it never read. When
   * it is refused, the answer is not to write anyway: it is to read what
   * landed, merge that in too, and write again — which is the only way the
   * other device's answers survive.
   */
  const first = doc([item("a")]);
  const landed = doc([item("c")]);
  const sent = serverSaying([
    { body: held(first, "e1") },
    { status: 409, body: { error: "conflict" } },
    { body: held(landed, "e9") },
    { body: { ok: true, etag: "e10" } },
  ]);
  return syncOnce(doc([item("b")]), TOKEN).then((out) => {
    assert.equal(sent.length, 4, "read, refused write, read again, write");
    assert.equal(must(sent[3].body, "the second push").etag, "e9",
      "the second write is conditional on the second read");
    assert.deepEqual(
      must(sent[3].body, "the second push").data.items.map((/** @type {any} */ i) => i.id).sort(),
      ["a", "b", "c"],
      "and carries all three devices' cards",
    );
    assert.deepEqual(out.merged.items.map((/** @type {any} */ i) => i.id).sort(), ["a", "b", "c"]);
  });
});

test("refused twice is given up on rather than retried for ever", () => {
  const sent = serverSaying([
    { body: held(doc([]), "e1") },
    { status: 409, body: { error: "conflict" } },
    { body: held(doc([]), "e2") },
    { status: 409, body: { error: "conflict" } },
  ]);
  return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "conflict" })
    .then(() => assert.equal(sent.length, 4, "two reads and two writes, and then it stops"));
});

test("a refusal to empty the document is a fault on this device, and is not retried", () => {
  /*
   * It shares its status with an ordinary conflict and means something
   * else entirely: retrying would only ask again with the same empty
   * document. The caller is told by name so it can say so.
   */
  const sent = serverSaying([
    { body: held(doc([item("a")]), "e1") },
    { status: 409, body: { error: "would-empty", held: 12 } },
  ]);
  return assert.rejects(syncOnce(doc([]), TOKEN), { message: "would-empty" })
    .then(() => assert.equal(sent.length, 2, "it did not read again and try once more"));
});

/* ------------------------------------------------------------------
   The refusals, each said by its own name

   Every one of these reaches a learner as a line on the sync row, so a
   client that lumped them together would be an app that can only ever say
   "Sync failed".
   ------------------------------------------------------------------ */

test("a passphrase the server does not recognise is named, from either half", () => {
  serverSaying([{ status: 401, body: { error: "bad-token" } }]);
  return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "bad-passphrase" })
    .then(() => {
      serverSaying([{ body: neverSynced() }, { status: 401, body: { error: "bad-token" } }]);
      return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "bad-passphrase" });
    });
});

test("a document past the server's limit is named, because it never syncs again until it shrinks", () => {
  serverSaying([{ body: neverSynced() }, { status: 413, body: { error: "too-large" } }]);
  return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "too-large" });
});

test("and any other failure carries the status, rather than being swallowed", () => {
  serverSaying([{ status: 500, body: { error: "server" } }]);
  return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "pull-failed-500" })
    .then(() => {
      serverSaying([{ body: neverSynced() }, { status: 500, body: { error: "server" } }]);
      return assert.rejects(syncOnce(doc([item("a")]), TOKEN), { message: "push-failed-500" });
    });
});

/* ------------------------------------------------------------------
   The document the server could not read
   ------------------------------------------------------------------ */

test("a shared copy the server had to recover is reported, not passed over in silence", () => {
  /*
   * The server hands back what it could recover and says the copy it was
   * asked for was not readable. What is on this device is safe; what
   * another device synced and this one never pulled went with it, and the
   * learner is owed that sentence rather than a green tick.
   */
  serverSaying([{ body: { ...held(doc([item("a")])), lost: "recovered" } }, { body: { ok: true, etag: "e2" } }]);
  return syncOnce(doc([item("b")]), TOKEN).then((out) => {
    assert.equal(out.lost, "recovered");
    assert.deepEqual(out.merged.items.map((/** @type {any} */ i) => i.id).sort(), ["a", "b"],
      "and what could be recovered is merged in like any other document");
  });
});

test("and one with nothing left behind it is reported differently", () => {
  serverSaying([{ body: { etag: "e1", data: null, lost: "unreadable" } }, { body: { ok: true, etag: "e2" } }]);
  return syncOnce(doc([item("b")]), TOKEN).then((out) => {
    assert.equal(out.lost, "unreadable");
    assert.deepEqual(out.merged.items.map((/** @type {any} */ i) => i.id), ["b"],
      "this device's own work is untouched");
  });
});

test("nothing lost says nothing", () => {
  serverSaying([{ body: held(doc([])) }, { body: { ok: true, etag: "e2" } }]);
  return syncOnce(doc([item("a")]), TOKEN).then((out) => assert.equal(out.lost, ""));
});

test("a copy recovered on the second read is reported too", () => {
  /* The retry after a stale write is a second chance to be told, and the
     word from either read is worth saying. */
  serverSaying([
    { body: held(doc([]), "e1") },
    { status: 409, body: { error: "conflict" } },
    { body: { ...held(doc([]), "e2"), lost: "recovered" } },
    { body: { ok: true, etag: "e3" } },
  ]);
  return syncOnce(doc([item("a")]), TOKEN).then((out) => assert.equal(out.lost, "recovered"));
});

/* ------------------------------------------------------------------
   The limit this side knows about
   ------------------------------------------------------------------ */

test("the document limit is the one the server counts to", () => {
  /* Four megabytes, in bytes — counted by length it was counting UTF-16
     units, so a document written in Arabic was refused at roughly half the
     size of one written in Latin letters. */
  assert.equal(MAX_DOC_BYTES, 4 * 1024 * 1024);
});

/* ------------------------------------------------------------------
   The document an older build left behind
   ------------------------------------------------------------------ */

test("a document under an old key is read and merged before it is deleted", () => {
  /*
   * It used to be deleted on the assumption that it held nothing this
   * device lacked — true of this device's own old key, and not true if
   * another device had synced under the same passphrase and this one never
   * pulled.
   */
  const sent = serverSaying([{ body: held(doc([item("old")])) }, { body: { ok: true } }]);
  return drainRemote(TOKEN, doc([item("a")])).then((merged) => {
    assert.deepEqual(merged.items.map((/** @type {any} */ i) => i.id).sort(), ["a", "old"]);
    assert.equal(sent[1].method, "DELETE", "and then it goes");
  });
});

test("and one that cannot be read is deleted anyway, having nothing to lose", () => {
  const sent = serverSaying([{ status: 500, body: { error: "server" } }, { body: { ok: true } }]);
  return drainRemote(TOKEN, doc([item("a")])).then((merged) => {
    assert.deepEqual(merged.items.map((/** @type {any} */ i) => i.id), ["a"], "this device's own, untouched");
    assert.equal(sent[1].method, "DELETE");
  });
});

test("forgetting a document asks for exactly that", () => {
  const sent = serverSaying([{ body: { ok: true } }]);
  return forgetRemote(TOKEN).then(() => {
    assert.equal(sent.length, 1);
    assert.equal(sent[0].method, "DELETE");
  });
});

/* ------------------------------------------------------------------
   Recordings, which travel under their own keys
   ------------------------------------------------------------------ */

test("a recording the server has not got reads as absent rather than as a failure", () => {
  /* The difference decides whether the clip is asked for again next sync
     or the whole sync is abandoned. */
  serverSaying([{ status: 404, body: { error: "not-found" } }]);
  return pullClip(TOKEN, "c1").then((got) => assert.equal(got, null));
});

test("a recording that is there comes back as its data", () => {
  serverSaying([{ body: { id: "c1", data: "data:audio/webm;base64,AAAA" } }]);
  return pullClip(TOKEN, "c1").then((got) => assert.equal(got, "data:audio/webm;base64,AAAA"));
});

test("and any other answer about a recording is a failure, by status", () => {
  serverSaying([{ status: 500, body: { error: "server" } }]);
  return assert.rejects(pullClip(TOKEN, "c1"), { message: "clip-pull-500" })
    .then(() => {
      serverSaying([{ status: 413, body: { error: "too-large" } }]);
      return assert.rejects(pushClip(TOKEN, "c1", "data:audio/webm;base64,AAAA"), { message: "clip-push-413" });
    });
});

test("a recording is sent under its own id, with the data in the body", () => {
  const sent = serverSaying([{ body: { ok: true, id: "c1" } }]);
  return pushClip(TOKEN, "c1", "data:audio/webm;base64,AAAA").then((ok) => {
    assert.equal(ok, true);
    assert.match(sent[0].url, /audio=c1/);
    assert.equal(must(sent[0].body, "the body").data, "data:audio/webm;base64,AAAA");
  });
});
