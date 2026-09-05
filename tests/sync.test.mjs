import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeData, compactItem, isFreshState, syncClips, clipIdsIn } from "../src/sync.js";

const fresh = () => ({
  phase: "new", step: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0,
  right: 0, wrong: 0, skips: 0, near: 0, hist: [], updated: 0,
});
/* Written out rather than imported, so sync.js can stay free of imports.
   Must track TYPES in src/languages.js. */
const TYPES = ["ar2en", "rec2en", "tr2ar", "rec2ar", "en2ar", "rec2attr"];
const states = () => Object.fromEntries(TYPES.map((t) => [t, fresh()]));
const item = (id, extra = {}) => ({
  id, ar: "كتاب", en: "book", lat: "kitaab", tags: [], updated: 0,
  s: states(), subs: [{ id: `${id}-f0`, ar: "كتب", en: "books", s: states() }], ...extra,
});

test("a state that was never answered is fresh; any answer is not", () => {
  assert.equal(isFreshState(fresh()), true);
  assert.equal(isFreshState(undefined), true);
  assert.equal(isFreshState({ ...fresh(), reps: 1 }), false);
  assert.equal(isFreshState({ ...fresh(), hist: [1] }), false);
  assert.equal(isFreshState({ ...fresh(), updated: 5 }), false);
  assert.equal(isFreshState({ ...fresh(), phase: "learning" }), false);
});

test("compactItem drops untouched states from the card and its forms, and shrinks a card about 4x", () => {
  const it = item("a");
  it.s.ar2en = { ...fresh(), reps: 3, phase: "review", updated: 10 };
  const slim = compactItem(it);
  assert.deepEqual(Object.keys(slim.s), ["ar2en"]);
  assert.deepEqual(Object.keys(slim.subs[0].s), []);
  const ratio = JSON.stringify(it).length / JSON.stringify(slim).length;
  assert.ok(ratio > 3, `expected >3x, got ${ratio.toFixed(2)}x`);
});

test("merging a sparse remote against a full local keeps every answered state", () => {
  const local = { items: [item("a")], tombstones: {}, log: {}, settings: {}, settingsUpdated: 0 };
  local.items[0].s.en2ar = { ...fresh(), reps: 2, updated: 50 };
  const remoteItem = compactItem(item("a"));
  remoteItem.s.ar2en = { ...fresh(), reps: 5, updated: 100 };
  const remote = { items: [remoteItem], tombstones: {}, log: {} };
  const merged = mergeData(local, remote);
  const s = merged.items[0].s;
  assert.equal(s.ar2en.reps, 5, "remote answer kept");
  assert.equal(s.en2ar.reps, 2, "local answer kept when remote omitted it");
  assert.equal(merged.items[0].subs[0].id, "a-f0");
});

test("merge is idempotent on sparse documents", () => {
  const a = { items: [compactItem(item("a"))], tombstones: {}, log: {} };
  const b = { items: [compactItem(item("b"))], tombstones: {}, log: {} };
  const once = mergeData(a, b);
  const twice = mergeData(once, b);
  assert.deepEqual(twice.items.map((i) => i.id).sort(), ["a", "b"]);
  assert.deepEqual(twice.items, mergeData(twice, b).items);
});

test("syncClips never uploads an object URL and never fetches what is already local", async () => {
  const data = { items: [{ id: "x", recs: [{ id: "here" }, { id: "there" }], subs: [] }] };
  const pushed = [];
  const pulled = [];
  globalThis.fetch = async (url, opts = {}) => {
    const id = new URL(url, "http://x").searchParams.get("audio");
    if (opts.method === "POST") {
      pushed.push([id, JSON.parse(opts.body).data]);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    pulled.push(id);
    return { ok: true, status: 200, json: async () => ({ data: "data:audio/webm;base64,AAAA" }) };
  };
  const written = [];
  const res = await syncClips("t".repeat(64), data, {
    hasLocal: async (id) => id === "here",
    readLocal: async (id) => (id === "here" ? "blob:https://app/uuid" : null),
    writeLocal: async (id, url) => written.push([id, url]),
    uploaded: [],
  });
  assert.deepEqual(pushed, [], "a blob: URL must not be sent as a recording");
  assert.deepEqual(pulled, ["there"], "only the missing clip is fetched");
  assert.deepEqual(written, [["there", "data:audio/webm;base64,AAAA"]]);
  assert.equal(res.pulled, 1);
  assert.equal(res.pushed, 0);
});

test("syncClips uploads a real data URL once and remembers it", async () => {
  const data = { items: [{ id: "x", recs: [{ id: "mine" }], subs: [] }] };
  const pushed = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (opts.method === "POST") {
      pushed.push(JSON.parse(opts.body).data.slice(0, 5));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const hooks = {
    hasLocal: async () => true,
    readLocal: async () => "data:audio/webm;base64,BBBB",
    writeLocal: async () => {},
    uploaded: [],
  };
  const first = await syncClips("t".repeat(64), data, hooks);
  assert.deepEqual(pushed, ["data:"]);
  assert.deepEqual(first.uploaded, ["mine"]);
  const second = await syncClips("t".repeat(64), data, { ...hooks, uploaded: first.uploaded });
  assert.equal(pushed.length, 1, "already-uploaded clips are not sent again");
  assert.equal(second.pushed, 0);
});

test("clipIdsIn walks cards and their forms", () => {
  const data = { items: [{ recs: [{ id: "a" }], subs: [{ recs: [{ id: "b" }] }] }, { recs: [] }] };
  assert.deepEqual(clipIdsIn(data), ["a", "b"]);
});
