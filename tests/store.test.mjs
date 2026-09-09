// @ts-check
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/* The store reads DATA_DIR once, when it is first imported, so the
   temporary directory has to be in place before the import. */
const dir = await mkdtemp(path.join(tmpdir(), "taleb-store-"));
process.env.DATA_DIR = dir;
const { getStore, resolveDataRoot } = await import("../server/store.js");

after(() => rm(dir, { recursive: true, force: true }));

test("a document round-trips, and a missing one reads as null", async () => {
  const store = getStore("t1");
  assert.equal(await store.get("user:sara"), null);
  await store.set("user:sara", JSON.stringify({ handle: "sara" }));
  assert.deepEqual(JSON.parse(await store.get("user:sara")), { handle: "sara" });
});

test("keys with colons and slashes stay separate documents", async () => {
  const store = getStore("t2");
  await store.set("card:a/b", "one");
  await store.set("card:a%2Fb", "two");
  assert.equal(await store.get("card:a/b"), "one");
  assert.equal(await store.get("card:a%2Fb"), "two");
});

test("getWithMetadata reports an ETag that follows the content", async () => {
  const store = getStore("t3");
  assert.equal(await store.getWithMetadata("doc"), null);
  await store.set("doc", "first");
  const a = await store.getWithMetadata("doc");
  await store.set("doc", "second");
  const b = await store.getWithMetadata("doc");
  assert.equal(a.data, "first");
  assert.equal(b.data, "second");
  assert.notEqual(a.etag, b.etag);
});

test("onlyIfNew writes once and then refuses", async () => {
  const store = getStore("t4");
  const first = await store.set("doc", "one", { onlyIfNew: true });
  const second = await store.set("doc", "two", { onlyIfNew: true });
  assert.equal(first.modified, true);
  assert.equal(second.modified, false);
  assert.equal(await store.get("doc"), "one");
});

test("onlyIfMatch refuses a write built on a stale read", async () => {
  const store = getStore("t5");
  await store.set("doc", "one");
  const { etag } = await store.getWithMetadata("doc");

  /* Somebody else writes in between, so the ETag the caller holds is no
     longer the current one. */
  await store.set("doc", "two");
  const stale = await store.set("doc", "three", { onlyIfMatch: etag });
  assert.equal(stale.modified, false);
  assert.equal(await store.get("doc"), "two");

  const current = await store.getWithMetadata("doc");
  const fresh = await store.set("doc", "four", { onlyIfMatch: current.etag });
  assert.equal(fresh.modified, true);
  assert.equal(await store.get("doc"), "four");
});

test("onlyIfMatch against a document that is gone does not recreate it", async () => {
  const store = getStore("t6");
  await store.set("doc", "one");
  const { etag } = await store.getWithMetadata("doc");
  await store.delete("doc");
  const result = await store.set("doc", "two", { onlyIfMatch: etag });
  assert.equal(result.modified, false);
  assert.equal(await store.get("doc"), null);
});

test("deleting what was never there is not an error", async () => {
  const store = getStore("t7");
  await store.delete("never-written");
});

test("concurrent onlyIfMatch writes on one ETag: exactly one wins", async () => {
  const store = getStore("t8");
  await store.set("doc", "base");
  const { etag } = await store.getWithMetadata("doc");

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => store.set("doc", `w${i}`, { onlyIfMatch: etag })),
  );
  assert.equal(results.filter((r) => r.modified).length, 1);
});

test("two stores keep their own documents under one key", async () => {
  const a = getStore("space-a");
  const b = getStore("space-b");
  await a.set("doc", "from a");
  await b.set("doc", "from b");
  assert.equal(await a.get("doc"), "from a");
  assert.equal(await b.get("doc"), "from b");
});

/* Where documents land is the difference between a working deployment and
   one that quietly discards every account at the next deploy, so the order
   is pinned rather than left to be read off the code. */
test("DATA_DIR wins over an attached volume", () => {
  const got = resolveDataRoot(
    { DATA_DIR: "/mnt/chosen", RAILWAY_VOLUME_MOUNT_PATH: "/mnt/volume" },
    "/app",
  );
  assert.equal(got.root, "/mnt/chosen");
  assert.equal(got.durable, true);
});

test("an attached volume is used without anything being configured", () => {
  const got = resolveDataRoot({ RAILWAY_VOLUME_MOUNT_PATH: "/mnt/volume" }, "/app");
  assert.equal(got.root, "/mnt/volume");
  assert.equal(got.from, "RAILWAY_VOLUME_MOUNT_PATH");
  assert.equal(got.durable, true);
});

test("with neither, the fallback is reported as not durable", () => {
  const got = resolveDataRoot({}, "/app");
  assert.equal(got.root, path.join("/app", "data"));
  assert.equal(got.durable, false);
});
