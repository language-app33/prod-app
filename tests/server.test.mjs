/*
 * The server as the browser meets it: over a socket, through the same
 * routing, with nothing stubbed. The first test is the one that matters —
 * making the first account and signing in with the key it hands back was
 * what failed before, and it failed because no endpoint existed at all.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = await mkdtemp(path.join(tmpdir(), "taleb-server-"));
process.env.DATA_DIR = dir;
const { createApp } = await import("../server/index.js");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

/* Deliberately not the app's client: this checks the wire, so it reads the
   body as text and parses it the same way a browser would have to. */
async function api(pathname, { method = "GET", key, token, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (key) headers["x-key"] = key;
  if (token) headers["x-sync-token"] = token;
  const res = await fetch(`${origin}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }
  return { status: res.status, json, text, type: res.headers.get("content-type") || "" };
}

test("the first account can be made, and its key signs in", async () => {
  const made = await api("/api/courses?action=signup", {
    method: "POST",
    body: { displayName: "Sara" },
  });
  assert.equal(made.status, 200, made.text);
  assert.equal(made.json.ok, true);
  assert.match(made.json.user.handle, /^sara-[0-9a-f]{4}$/);
  assert.ok(made.json.key, "signing up returns a key");

  const me = await api("/api/courses?action=whoami", { key: made.json.key });
  assert.equal(me.status, 200, me.text);
  assert.equal(me.json.user.handle, made.json.user.handle);
  /* The digest is the only thing stored, so it must never come back out. */
  assert.equal(me.json.user.keyHash, undefined);
});

test("a key that was never issued is refused as JSON, not as a crash", async () => {
  const res = await api("/api/courses?action=whoami", { key: "amber-cedar-willow-opal-0000" });
  assert.equal(res.status, 401);
  assert.equal(res.json.error, "bad-key");
  assert.match(res.type, /application\/json/);
});

test("two accounts with the same name get different handles and keys", async () => {
  const one = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Sara" } });
  const two = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Sara" } });
  assert.notEqual(one.json.user.handle, two.json.user.handle);
  assert.notEqual(one.json.key, two.json.key);
});

test("an account with no name is refused", async () => {
  const res = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "  " } });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, "name-required");
});

test("an action the server doesn't know says so", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Ali" } });
  const res = await api("/api/courses?action=not-a-thing", { key: made.json.key });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, "unknown-action");
});

test("sync stores a document and refuses a write built on a stale read", async () => {
  const token = createHash("sha256").update("a passphrase").digest("hex");

  const empty = await api("/api/sync", { token });
  assert.deepEqual(empty.json, { etag: null, data: null });

  const first = await api("/api/sync", { method: "POST", token, body: { data: { items: [1] } } });
  assert.equal(first.status, 200, first.text);
  assert.ok(first.json.etag);

  const stale = await api("/api/sync", {
    method: "POST",
    token,
    body: { etag: "0000000000000000", data: { items: [2] } },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error, "conflict");

  const read = await api("/api/sync", { token });
  assert.deepEqual(read.json.data, { items: [1] });

  const fresh = await api("/api/sync", {
    method: "POST",
    token,
    body: { etag: read.json.etag, data: { items: [3] } },
  });
  assert.equal(fresh.status, 200);
  assert.deepEqual((await api("/api/sync", { token })).json.data, { items: [3] });
});

test("a sync token that isn't a digest is refused", async () => {
  const res = await api("/api/sync", { token: "not-a-digest" });
  assert.equal(res.status, 401);
  assert.equal(res.json.error, "bad-token");
});

/*
 * The version endpoint exists so the app can tell "the deploy failed" from
 * "the deploy worked and this browser is still holding the old copy". That
 * only works if it reports what is in dist, so that is what it reads.
 */
test("the deployed version is whatever is in dist, read fresh", async () => {
  const { writeFile, mkdir, rm: remove } = await import("node:fs/promises");
  const distDir = path.join(dir, "dist-for-version");
  await mkdir(distDir, { recursive: true });

  /* A server pointed at a dist of our own, so the file can be changed
     underneath it. */
  process.env.DIST_DIR = distDir;
  const mod = await import(`../server/index.js?version-test`);
  const own = mod.createApp();
  await new Promise((resolve) => own.listen(0, "127.0.0.1", resolve));
  const at = `http://127.0.0.1:${own.address().port}/api/version`;

  const unbuilt = await fetch(at);
  assert.equal(unbuilt.status, 404, "no dist yet, so nothing to report");
  assert.equal((await unbuilt.json()).error, "unbuilt");

  await writeFile(path.join(distDir, "version.json"), JSON.stringify({ commit: "aaaaaaa", builtAt: "x" }));
  const first = await fetch(at);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).commit, "aaaaaaa");
  /* Never cached: a stale answer here is the one thing that would make the
     whole check useless. */
  assert.match(first.headers.get("cache-control") || "", /no-store/);

  /* A deploy, as far as this endpoint can see one. */
  await writeFile(path.join(distDir, "version.json"), JSON.stringify({ commit: "bbbbbbb", builtAt: "y" }));
  assert.equal((await (await fetch(at)).json()).commit, "bbbbbbb");

  await new Promise((resolve) => own.close(resolve));
  await remove(distDir, { recursive: true, force: true });
  delete process.env.DIST_DIR;
});

/*
 * A phrase says which words it teaches. The pairing is the teacher's, not
 * the app's — the app only ever suggests one — so the server has to keep
 * exactly what it was told and nothing more.
 */
test("a card remembers which words it teaches, and keeps the list clean", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rana" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: process.env.ADMIN_KEY || "" } });

  const word = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "باب", en: "door", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(word.status, 200, word.text);
  const wordId = word.json.card.id;

  const phrase = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "سكّر الباب", en: "close the door", lang: "ar-PS", uses: [wordId] }, decks: [] },
  });
  assert.equal(phrase.status, 200, phrase.text);
  assert.deepEqual(phrase.json.card.uses, [wordId]);

  /* Duplicates collapse and anything that is not an id is dropped, because
     these are written into a document and read back as identity. */
  const messy = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: { id: phrase.json.card.id, ar: "سكّر الباب", en: "close the door", lang: "ar-PS",
              uses: [wordId, wordId, "../etc/passwd", "", null] },
      decks: [],
    },
  });
  assert.deepEqual(messy.json.card.uses, [wordId, "etcpasswd"]);

  /* A card that says nothing about it has an empty list, not a missing
     field: the reader should never have to guard. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "شمس", en: "sun", lang: "ar-PS" }, decks: [] },
  });
  assert.deepEqual(plain.json.card.uses, []);
});

test("an unknown /api path answers JSON, never the app shell", async () => {
  const res = await api("/api/nothing-here");
  assert.equal(res.status, 404);
  assert.equal(res.json.error, "unknown-endpoint");
  assert.match(res.type, /application\/json/);
  assert.doesNotMatch(res.text, /<html/i);
});

test("a route belonging to the app is answered by the shell, not a 404", async () => {
  const res = await fetch(`${origin}/some/app/route`);
  const text = await res.text();
  /* dist/ exists only after a build; when it doesn't, the server says so
     plainly rather than pretending to serve an app. */
  if (res.status === 404) {
    assert.match(text, /has not been built/);
  } else {
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/html/);
  }
});

test("a path climbing out of dist cannot read the repository", async () => {
  const res = await fetch(`${origin}/../package.json`);
  const text = await res.text();
  assert.doesNotMatch(text, /"dependencies"/);
});

/*
 * Stopping. A deploy sends SIGTERM, and how the process answers decides
 * whether a routine restart reads as a crash: without a handler Node dies on
 * the signal, npm reports its child as failed, and the log fills with red on
 * every deploy. This has to be an actual process — the handler is installed
 * only when the server is run directly, not when a test imports createApp.
 */
test("SIGTERM stops it cleanly, and npm has nothing to report", async () => {
  const { spawn } = await import("node:child_process");
  const here = path.dirname(new URL(import.meta.url).pathname);
  const entry = path.join(here, "..", "server", "index.js");
  const home = await mkdtemp(path.join(tmpdir(), "taleb-stop-"));

  const child = spawn(process.execPath, [entry], {
    /* An explicit port, high and unlikely to be taken: PORT=0 would not mean
       "any free port" here, because Number("0") is falsy and the server falls
       back to 3000 — which might be something else's. */
    env: { ...process.env, DATA_DIR: home, PORT: "45871" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let out = "";
  child.stdout.on("data", (b) => (out += b));
  child.stderr.on("data", (b) => (out += b));

  /* Wait until it is actually up: signalling mid-startup would prove
     nothing about the handler. */
  await new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => reject(new Error(`never started: ${out}`)), 10000);
    const look = setInterval(() => {
      if (/listening on/.test(out)) {
        clearInterval(look);
        clearTimeout(giveUp);
        resolve();
      }
    }, 50);
  });

  const stopped = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  child.kill("SIGTERM");
  const { code, signal } = await stopped;

  await rm(home, { recursive: true, force: true });

  /* Zero and by its own hand: a process killed by the signal would report
     signal "SIGTERM" and a null code, which is what npm turns into an
     error block. */
  assert.equal(signal, null, `killed by a signal rather than exiting: ${out}`);
  assert.equal(code, 0, out);
  assert.match(out, /finishing what's in flight/);
  assert.match(out, /stopped/);
});
