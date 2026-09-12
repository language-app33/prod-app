/*
 * The server as the browser meets it: over a socket, through the same
 * routing, with nothing stubbed. The first test is the one that matters —
 * making the first account and signing in with the key it hands back was
 * what failed before, and it failed because no endpoint existed at all.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = await mkdtemp(path.join(tmpdir(), "taleb-server-"));
process.env.DATA_DIR = dir;
/*
 * An admin key, so the tests below that claim admin actually get it. Every
 * one of them passed `process.env.ADMIN_KEY || ""`, which the server
 * refuses outright when the variable is unset — and none checked the
 * answer, so they had all been running as ordinary accounts and asserting
 * nothing about the admin paths they were named after.
 */
const ADMIN_KEY = "test-admin-key";
process.env.ADMIN_KEY = ADMIN_KEY;
const { createApp } = await import("../server/index.js");

/**
 * Start a server on a port the machine picks, and say where it landed.
 *
 * `address()` answers for the whole family of servers, including the ones
 * on a unix socket that report a path rather than a port. These are always
 * on a port, and this is where that is said once.
 * @param {import("node:http").Server} server
 * @returns {Promise<string>}
 */
async function listenSomewhere(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const at = server.address();
  if (!at || typeof at === "string") throw new Error("expected a port, got a socket");
  return `http://127.0.0.1:${at.port}`;
}

/**
 * What the admin overview answered, named.
 *
 * The endpoint's answer is JSON and arrives untyped, so saying here which
 * record it is is what makes the navigation below checked: a test that
 * reads a field the overview does not carry is then a failure at the
 * checker rather than an `undefined` compared against `undefined`.
 * @param {{ json: any }} r
 * @returns {import("../src/types.ts").AdminOverview}
 */
const overviewOf = (r) => r.json;

/**
 * The courses a person is in, as `my-courses` answers.
 * @param {{ json: any }} r
 * @returns {import("../src/types.ts").Course[]}
 */
const coursesOf = (r) => r.json.courses;

const server = createApp();
const origin = await listenSomewhere(server);

after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/* Deliberately not the app's client: this checks the wire, so it reads the
   body as text and parses it the same way a browser would have to. */
/**
 * One request against the running server, with the two headers the two
 * endpoints authenticate by.
 * @param {string} pathname
 * @param {{ method?: string, key?: string, token?: string, body?: unknown }} [opts]
 */
async function api(pathname, { method = "GET", key, token, body } = {}) {
  /** @type {Record<string, string>} */
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
  /* The query string is a cache-buster: it makes Node load a second copy
     of the module, so this server reads DIST_DIR afresh. The checker
     resolves the specifier literally and finds no such file. */
  // @ts-expect-error the ?query is for Node's module cache, not for a path
  const mod = await import(`../server/index.js?version-test`);
  const own = mod.createApp();
  const at = `${await listenSomewhere(own)}/api/version`;

  const unbuilt = await fetch(at);
  assert.equal(unbuilt.status, 404, "no dist yet, so nothing to report");
  assert.equal((await unbuilt.json()).error, "unbuilt");

  await writeFile(path.join(distDir, "version.json"), JSON.stringify({ release: "0.1", commit: "aaaaaaa", builtAt: "x" }));
  const first = await fetch(at);
  assert.equal(first.status, 200);
  const served = await first.json();
  assert.equal(served.commit, "aaaaaaa");
  assert.equal(served.release, "0.1", "the release is passed through, not dropped");
  /* Never cached: a stale answer here is the one thing that would make the
     whole check useless. */
  assert.match(first.headers.get("cache-control") || "", /no-store/);

  /* A deploy, as far as this endpoint can see one. */
  await writeFile(path.join(distDir, "version.json"), JSON.stringify({ release: "0.2", commit: "bbbbbbb", builtAt: "y" }));
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
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

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

/*
 * A conversation is a card like any other, so it reaches a student down
 * the same pipe: saved here, stored whole, handed out in the material
 * payload. What the server has to keep is the turns in order, who says
 * each one, and which words each line teaches — and it has to keep them
 * without knowing what a dialog is.
 */
test("a card can hold a conversation, and keeps its turns in order", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Samir" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const word = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "سلام", en: "peace", lang: "ar-PS" }, decks: [] },
  });
  const wordId = word.json.card.id;

  const scene = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", ar: "", en: "At the door", lang: "ar-PS",
        note: "Two neighbours meet in the morning",
        speakers: ["Layla", "Karim"],
        you: 1,
        lines: [
          { who: 0, ar: "سلام", en: "peace", uses: [wordId, wordId, "../etc/passwd"] },
          { who: 1, ar: "وسلام", en: "and peace", clips: ["a".repeat(64)] },
          { who: 0, ar: "كيف حالك", en: "how are you" },
        ],
      },
      decks: [],
    },
  });
  assert.equal(scene.status, 200, scene.text);
  const held = scene.json.card;
  assert.deepEqual(held.speakers, ["Layla", "Karim"]);
  assert.equal(held.you, 1);
  assert.equal(held.lines.length, 3);
  assert.deepEqual(held.lines.map((/** @type {any} */ l) => l.who), [0, 1, 0]);
  assert.equal(held.lines[2].en, "how are you");
  /* A line's recordings are kept the way a form's are, and a line with
     none still answers with a list. */
  assert.deepEqual(held.lines[1].clips, ["a".repeat(64)]);
  assert.deepEqual(held.lines[2].clips, []);
  /* And the words a line teaches are cleaned exactly as a card's are:
     these are written into a document and read back as identity. */
  assert.deepEqual(held.lines[0].uses, [wordId, "etcpasswd"]);
  assert.deepEqual(held.lines[1].uses, []);

  /* A scene need not say whose part the student takes, and one that does
     not must come back not saying it. Rounding an absent part down to 0
     would hand every such scene to the speaker who opens it — a real
     answer, silently invented, and the wrong one. */
  const open = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", ar: "", en: "Either way", lang: "ar-PS",
        speakers: ["Layla", "Karim"], you: null,
        lines: [{ who: 0, ar: "سلام", en: "peace" }, { who: 1, ar: "وسلام", en: "and peace" }],
      },
      decks: [],
    },
  });
  assert.equal(open.status, 200, open.text);
  assert.equal(open.json.card.you, null, "nobody's part, kept as nobody's");
  /* Zero is not nothing: it is the speaker who opens the scene. */
  const first = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", ar: "", en: "Layla's", lang: "ar-PS",
        speakers: ["Layla", "Karim"], you: 0,
        lines: [{ who: 0, ar: "سلام", en: "peace" }, { who: 1, ar: "وسلام", en: "and peace" }],
      },
      decks: [],
    },
  });
  assert.equal(first.json.card.you, 0);

  /* A student gets it through the material payload, whole. */
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Scenes", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;
  await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { ...held, id: held.id }, decks: [deckId] },
  });
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Beginners", language: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key, body: { deckId, courseId: course.json.course.id },
  });
  /* Asked for as the student it is for, which is the only way material is
     ever handed out. */
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yara" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });
  const material = await api("/api/courses?action=my-material", { key: student.json.key });
  const handed = (material.json.cards || [])
    .flatMap((/** @type {any} */ d) => d.cards)
    .find((/** @type {any} */ c) => c.id === held.id);
  assert.ok(handed, "the conversation never reached the student");
  assert.equal(handed.lines.length, 3, "a scene reached them with turns missing");
  assert.equal(handed.speakers[1], "Karim");
});

/*
 * The values a deck's phrases need travel with it.
 *
 * A card that fills a variable is in no deck — that is the point of it: it
 * is borrowed by whichever phrase has a hole of its name — so nothing about
 * it moves when it is written, and the version a student's device compares
 * against would never budge. Both halves are checked here: that the values
 * are sent at all, and that writing one is a change the student hears
 * about.
 */
test("a deck's phrases are sent with the cards that fill their variables", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Introductions", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Arabic 1", language: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key, body: { deckId, courseId: course.json.course.id },
  });
  /* The frame, in the deck. */
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: { id: "", ar: "اسمي {{name}}", en: "My name is {{name}}", lat: "ismi {{name}}", lang: "ar-PS" },
      decks: [deckId],
    },
  });
  /* The values, in no deck at all, and not practised in their own right. */
  const value = (/** @type {string} */ ar, /** @type {string} */ en) =>
    api("/api/courses?action=save-card", {
      method: "POST", key,
      body: { card: { id: "", ar, en, lat: en.toLowerCase(), lang: "ar-PS", fills: "name", drill: false }, decks: [] },
    });
  await value("رافائيل", "Raphael");
  await value("فيكتور", "Victor");
  /* And one in another language, which is not a variation on the sentence
     but a different sentence. */
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "Tâm", en: "Tam", lang: "vi-HUE", fills: "name", drill: false }, decks: [] },
  });

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Omar" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });

  const first = await api("/api/courses?action=my-material", { key: student.json.key });
  const sent = (first.json.cards || []).flatMap((/** @type {any} */ d) => d.cards);
  assert.deepEqual(
    sent.filter((/** @type {any} */ c) => c.fills).map((/** @type {any} */ c) => c.en).sort(),
    ["Raphael", "Victor"],
    "the values a deck's phrases need did not travel with it"
  );
  assert.equal(
    sent.every((/** @type {any} */ c) => !c.fills || c.drill === false),
    true,
    "a value arrived as something to practise on its own"
  );

  /* Nothing has changed, so the next ask costs a few bytes. */
  const again = await api(`/api/courses?action=my-material&version=${first.json.version}`, {
    key: student.json.key,
  });
  assert.equal(again.json.unchanged, true, "the version moved when nothing had");

  /* And a name added today reaches them today, though it belongs to no
     deck and nothing else about the course has moved. */
  await value("سارة", "Sarah");
  const after = await api(`/api/courses?action=my-material&version=${first.json.version}`, {
    key: student.json.key,
  });
  assert.notEqual(after.json.unchanged, true, "a new value never reached the student");
  assert.deepEqual(
    (after.json.cards || [])
      .flatMap((/** @type {any} */ d) => d.cards)
      .filter((/** @type {any} */ c) => c.fills)
      .map((/** @type {any} */ c) => c.en)
      .sort(),
    ["Raphael", "Sarah", "Victor"]
  );
});

/*
 * An ordinary card is not changed by passing through a server that knows
 * about conversations: it comes back with no turns and nobody in it.
 */
test("a card keeps the gap that pairs an answer with how it is said", async () => {
  /* Two accepted spellings, a transliteration for the second only. The
     blank before it is holding the first answer's place — trimmed away,
     "safar" would come back as the pronunciation of the wrong word. */
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rami" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "كتاب / سفر", en: "book", lat: " / safar", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.json.card.lat, " / safar", "the gap was trimmed away");
  assert.equal(saved.json.card.ar, "كتاب / سفر");
});

test("and a word is not turned into a conversation by being saved", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Hana" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "شمس", en: "sun", lang: "ar-PS" }, decks: [] },
  });
  assert.deepEqual(plain.json.card.lines, []);
  assert.deepEqual(plain.json.card.speakers, []);
});

/*
 * The two speeds a word can be recorded at. They are two lists on the card
 * rather than one list with a mark on each entry, so the server has to keep
 * both — a card that came back with its slow recordings dropped would have
 * lost them at the next save, quietly and for good.
 */
test("a card keeps its recordings at both speeds, on every form", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", ar: "كِتاب", en: "book", lang: "ar-PS",
        clips: ["a".repeat(64)], slowClips: ["b".repeat(64)],
        subs: [{ ar: "كُتُب", en: "books", slowClips: ["c".repeat(64)] }],
      },
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(saved.json.card.clips, ["a".repeat(64)]);
  assert.deepEqual(saved.json.card.slowClips, ["b".repeat(64)]);
  assert.deepEqual(saved.json.card.subs[0].slowClips, ["c".repeat(64)]);
  /* A form recorded only slowly still answers the ordinary question with a
     list, not with nothing: every reader of a card takes both as arrays. */
  assert.deepEqual(saved.json.card.subs[0].clips, []);

  /* And a card that says nothing about the slow ones has an empty list. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "بيت", en: "house", lang: "ar-PS" }, decks: [] },
  });
  assert.deepEqual(plain.json.card.slowClips, []);
});

/*
 * When a card was made. Nothing recorded it before, so sorting a card list
 * by "added" had nothing to sort by.
 */
test("a new card is stamped with when it was made, and editing does not move it", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dana" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const first = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "شمس", en: "sun", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(first.status, 200, first.text);
  const { id, created, updated } = first.json.card;
  assert.equal(typeof created, "number");
  assert.equal(created, updated, "made and last changed at the same moment");

  await new Promise((r) => setTimeout(r, 5));
  const again = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id, ar: "شمس", en: "the sun", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(again.json.card.created, created, "editing must not move when it was added");
  assert.ok(again.json.card.updated > created, "but it does move when it was changed");

  /* And a client cannot set it: the date a card was made is the server's to
     say, or a backdated card would sort ahead of everything. */
  const lying = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id, ar: "شمس", en: "sun", lang: "ar-PS", created: 1 }, decks: [] },
  });
  assert.equal(lying.json.card.created, created);
});

/*
 * The three moments the admin screen shows for a person. They answer three
 * different questions — somebody who opens the app every morning and never
 * practices looks like a diligent student under one "last active" line — so
 * each has to move only for its own kind of work.
 */
test("signing in, practising and writing a card are recorded apart", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nour" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const handle = made.json.user.handle;
  const mine = async () => {
    const r = await api("/api/courses?action=admin-overview", { key });
    return must(overviewOf(r).users.find((u) => u.handle === handle), `user ${handle}`);
  };

  /* Signing up counts as being seen, and as nothing else: an account that
     has never been opened must not look like one that has been used. */
  let u = await mine();
  const seenAt = must(u.lastSeen, "lastSeen after signing up");
  assert.equal(u.lastLearned, undefined, "a new account has not practiced");
  assert.equal(u.lastTaught, undefined, "a new account has not written anything");

  await new Promise((r) => setTimeout(r, 5));
  await api("/api/courses?action=practiced", { method: "POST", key, body: {} });
  const practiced = await mine();
  const learnedAt = must(practiced.lastLearned, "lastLearned after practising");
  assert.ok(learnedAt > seenAt, "practising was not recorded");
  assert.equal(practiced.lastTaught, undefined, "practising is not teaching work");

  await new Promise((r) => setTimeout(r, 5));
  const card = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { id: "", ar: "قمر", en: "moon", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(card.status, 200, card.text);
  const taught = await mine();
  const taughtAt = must(taught.lastTaught, "lastTaught after writing a card");
  assert.ok(taughtAt > learnedAt, "writing a card was not recorded");
  assert.equal(taught.lastLearned, learnedAt, "writing a card is not practising");

  /* Making a deck counts too, and later than the card did. */
  await new Promise((r) => setTimeout(r, 5));
  await api("/api/courses?action=create-deck", { method: "POST", key, body: { title: "Lesson 1" } });
  const deck = await mine();
  const deckAt = must(deck.lastTaught, "lastTaught after making a deck");
  assert.ok(deckAt > taughtAt, "making a deck was not recorded");

  /* Reading is not work: opening the app moves being seen and nothing else. */
  await new Promise((r) => setTimeout(r, 5));
  await api("/api/courses?action=whoami", { key });
  const seen = await mine();
  assert.ok(
    must(seen.lastSeen, "lastSeen after signing in") > must(deck.lastSeen, "lastSeen before"),
    "signing in did not move being seen"
  );
  assert.equal(seen.lastTaught, deckAt, "reading is not teaching work");
  assert.equal(seen.lastLearned, deck.lastLearned, "reading is not practising");
});

test("a teaching action that is refused is not recorded as work done", async () => {
  const owner = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yara" } });
  const other = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Fadi" } });
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key: owner.json.key, body: { title: "Yara's deck" },
  });
  assert.equal(deck.status, 200, deck.text);

  const refused = await api("/api/courses?action=rename-deck", {
    method: "POST", key: other.json.key, body: { deckId: deck.json.deck.id, title: "Mine now" },
  });
  assert.equal(refused.status, 403);

  const me = await api("/api/courses?action=whoami", { key: other.json.key });
  assert.equal(me.json.user.lastTaught, undefined, "an attempt that was refused is not work");
});

test("practising cannot be reported without a key", async () => {
  const res = await api("/api/courses?action=practiced", { method: "POST", body: {} });
  assert.equal(res.status, 401);
  assert.equal(res.json.error, "bad-key");
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
  await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => reject(new Error(`never started: ${out}`)), 10000);
    const look = setInterval(() => {
      if (/listening on/.test(out)) {
        clearInterval(look);
        clearTimeout(giveUp);
        resolve();
      }
    }, 50);
  }));

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

/*
 * Renaming a course.
 *
 * The title is a label: decks, memberships and join codes are all keyed by
 * the course's id, so a rename must change what people see and nothing
 * else. These check both halves of that — the new name sticks, and
 * everything hanging off the course survives it.
 */
test("an admin can rename a course, and nothing else about it moves", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = made.json.key;
  const claimed = await api("/api/courses?action=claim-admin", {
    method: "POST", key, body: { adminKey: ADMIN_KEY },
  });
  assert.equal(claimed.status, 200, "the admin claim has to actually succeed, or this proves nothing");

  const created = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Beginer Arabic", language: "ar-PS" },
  });
  assert.equal(created.status, 200, created.text);
  const before = created.json.course;

  /* Someone in it and a deck attached, so the rename has something to
     leave undisturbed. */
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Omar" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: before.id, handle: student.json.user.handle },
  });
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Lesson 1", lang: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key, body: { deckId: deck.json.deck.id, courseId: before.id },
  });

  const renamed = await api("/api/courses?action=admin-rename-course", {
    method: "POST", key, body: { courseId: before.id, title: "  Beginner Arabic  " },
  });
  assert.equal(renamed.status, 200, renamed.text);
  assert.equal(renamed.json.title, "Beginner Arabic", "trimmed on the way in");

  const list = await api("/api/courses?action=admin-overview", { key });
  const after = must(overviewOf(list).courses.find((c) => c.id === before.id), "the renamed course");
  assert.equal(after.title, "Beginner Arabic");
  assert.equal(after.id, before.id, "the id is what everything else is keyed by");
  assert.equal(after.code, before.code, "the student code still works");
  assert.equal(after.teacherCode, before.teacherCode, "and so does the teacher code");
  assert.equal(after.language, before.language);
  assert.deepEqual(after.students, [student.json.user.handle], "the roster is untouched");
  assert.deepEqual(after.decks, before.decks.concat([deck.json.deck.id]), "and the deck is still attached");

  /* And the student still reaches it, which is the thing a broken rename
     would quietly take away. */
  const theirs = await api("/api/courses?action=my-courses", { key: student.json.key });
  const stillTheirs = must(
    coursesOf(theirs).find((c) => c.id === before.id),
    "the renamed course, from the student's side"
  );
  assert.equal(stillTheirs.title, "Beginner Arabic");
});

test("a course cannot be renamed to nothing, and only an admin can rename one", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yara" } });
  await api("/api/courses?action=claim-admin", {
    method: "POST", key: admin.json.key, body: { adminKey: ADMIN_KEY },
  });
  const course = (await api("/api/courses?action=create-course", {
    method: "POST", key: admin.json.key, body: { title: "Keeps Its Name", language: "ar-PS" },
  })).json.course;

  for (const title of ["", "   "]) {
    const res = await api("/api/courses?action=admin-rename-course", {
      method: "POST", key: admin.json.key, body: { courseId: course.id, title },
    });
    assert.equal(res.status, 400, `"${title}" should be refused`);
    assert.equal(res.json.error, "title-required");
  }

  /* An ordinary account, which is what most people signing in are. */
  const other = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Sami" } });
  const refused = await api("/api/courses?action=admin-rename-course", {
    method: "POST", key: other.json.key, body: { courseId: course.id, title: "Mine Now" },
  });
  assert.equal(refused.status, 403);

  const missing = await api("/api/courses?action=admin-rename-course", {
    method: "POST", key: admin.json.key, body: { courseId: "c-nope", title: "Ghost" },
  });
  assert.equal(missing.status, 404);

  const still = must(
    overviewOf(await api("/api/courses?action=admin-overview", { key: admin.json.key }))
      .courses.find((c) => c.id === course.id),
    "the course that kept its name"
  );
  assert.equal(still.title, "Keeps Its Name", "none of that changed the name");
});

/*
 * Someone can teach a course and study it. The two are separate
 * memberships on purpose — a teacher only gets the course's cards in their
 * own practice if they are enrolled as a student too — so creating a
 * person accepts both at once rather than making it two errands.
 */
test("a new person can be created into both roles at once", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Hana" } });
  const key = admin.json.key;
  const claimed = await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  assert.equal(claimed.status, 200, "the admin claim has to succeed for the rest to mean anything");

  const course = (await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Both Roles", language: "ar-PS" },
  })).json.course;

  const made = await api("/api/courses?action=admin-create-user", {
    method: "POST", key,
    body: { displayName: "Sami Haddad", courseId: course.id, roles: ["teacher", "student"] },
  });
  assert.equal(made.status, 200, made.text);
  const h = made.json.user.handle;

  const after = must(
    overviewOf(await api("/api/courses?action=admin-overview", { key })).courses
      .find((c) => c.id === course.id),
    "the course just joined"
  );
  assert.deepEqual(after.teachers, [h], "teaching");
  assert.deepEqual(after.students, [h], "and studying, from the one request");

  /* One role only still works, and is still the default shape. */
  const one = await api("/api/courses?action=admin-create-user", {
    method: "POST", key, body: { displayName: "Rana", courseId: course.id, roles: ["student"] },
  });
  const rana = one.json.user.handle;
  const two = must(overviewOf(await api("/api/courses?action=admin-overview", { key }))
    .courses.find((c) => c.id === course.id), "the course after adding Rana");
  assert.deepEqual(two.teachers, [h], "Rana is not made a teacher");
  assert.deepEqual(two.students, [h, rana]);

  /* Neither role: an account, in no course. */
  const none = await api("/api/courses?action=admin-create-user", {
    method: "POST", key, body: { displayName: "Nobody", courseId: course.id, roles: [] },
  });
  const three = must(overviewOf(await api("/api/courses?action=admin-overview", { key }))
    .courses.find((c) => c.id === course.id), "the course after adding nobody");
  assert.equal(three.teachers.length + three.students.length, 3, "nobody was added");
  assert.ok(none.json.user.handle, "but the account exists");

  /* A tab left open across the deploy sends the old single `role`, and must
     still add the role it meant rather than falling back to teacher. */
  const old = await api("/api/courses?action=admin-create-user", {
    method: "POST", key, body: { displayName: "Legacy", courseId: course.id, role: "student" },
  });
  const four = must(overviewOf(await api("/api/courses?action=admin-overview", { key }))
    .courses.find((c) => c.id === course.id), "the course after the legacy role");
  assert.ok(four.students.includes(old.json.user.handle), "added as the student they asked for");
  assert.ok(!four.teachers.includes(old.json.user.handle));
});

/*
 * Dropping one role must leave the other standing. This is the shape behind
 * the fault the roster had: one remove button that took both.
 */
test("removing one role leaves the other, and removing the last one leaves the course", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Farah" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const course = (await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Two Roles", language: "ar-PS" },
  })).json.course;
  const p = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dual" } });
  const h = p.json.user.handle;

  await api("/api/courses?action=assign-teacher", { method: "POST", key, body: { courseId: course.id, handle: h } });
  await api("/api/courses?action=assign-student", { method: "POST", key, body: { courseId: course.id, handle: h } });

  const seen = async () => must(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .courses.find((c) => c.id === course.id),
    "the course whose roles are being changed"
  );
  const both = await seen();
  assert.deepEqual([both.teachers, both.students], [[h], [h]]);

  await api("/api/courses?action=remove-member", { method: "POST", key, body: { courseId: course.id, handle: h, role: "teacher" } });
  const one = await seen();
  assert.deepEqual(one.teachers, [], "the teaching role is dropped");
  assert.deepEqual(one.students, [h], "and the studying one is not");

  await api("/api/courses?action=remove-member", { method: "POST", key, body: { courseId: course.id, handle: h, role: "student" } });
  const gone = await seen();
  assert.deepEqual([gone.teachers, gone.students], [[], []], "and the last one takes them out");
});

/*
 * Clearing the site.
 *
 * The only endpoint that removes things wholesale, so what is checked is
 * mostly what it refuses: a signed-in administrator without the deploy's
 * key, the key without an administrator, and a request naming nothing. What
 * it does do is take the parts it was given and leave the rest alone —
 * clearing the recordings out of a site whose cards are wanted is the case
 * this exists for.
 */
test("clearing takes the parts it is given, and refuses without the deploy's key", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Hala" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const course = (await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Clearable", language: "ar-PS" },
  })).json.course;
  const card = (await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "كتاب", en: "book", lang: "ar-PS", clips: ["a".repeat(64)] }, decks: [] },
  })).json.card;

  /* An administrator is not enough: the key is what says this was meant. */
  const noKey = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { parts: ["courses"] },
  });
  assert.equal(noKey.status, 403, noKey.text);
  assert.equal(noKey.json.error, "bad-key");
  const wrongKey = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: "not-it", parts: ["courses"] },
  });
  assert.equal(wrongKey.status, 403);

  /* And the key is not enough either: it is asked for on top of the
     account, not instead of it. */
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nour" } });
  const notAdmin = await api("/api/courses?action=admin-clear", {
    method: "POST", key: student.json.key, body: { adminKey: ADMIN_KEY, parts: ["courses"] },
  });
  assert.equal(notAdmin.status, 403);
  assert.equal(notAdmin.json.error, "admin-only");

  const nothing = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: ADMIN_KEY, parts: [] },
  });
  assert.equal(nothing.status, 400);
  assert.equal(nothing.json.error, "nothing-chosen");

  /* Nothing above touched anything. */
  const before = overviewOf(await api("/api/courses?action=admin-overview", { key }));
  assert.ok(before.courses.some((/** @type {any} */ c) => c.id === course.id), "the course is still there");

  /* One part, and only that part. */
  const cleared = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: ADMIN_KEY, parts: ["courses"] },
  });
  assert.equal(cleared.status, 200, cleared.text);
  assert.equal(cleared.json.removed.courses >= 1, true);
  assert.equal(cleared.json.removed.cards, 0, "cards were not asked for");

  const after = overviewOf(await api("/api/courses?action=admin-overview", { key }));
  assert.equal(after.courses.length, 0, "the courses are gone");
  assert.ok(
    (await api(`/api/courses?action=admin-card&card=${card.id}`, { key })).json.card,
    "and the card is not"
  );

  /* The administrator doing the clearing keeps their own account, or the
     site is left with no way in but a fresh signup. */
  const people = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: ADMIN_KEY, parts: ["people", "cards", "clips"] },
  });
  assert.equal(people.status, 200, people.text);
  const left = overviewOf(await api("/api/courses?action=admin-overview", { key }));
  assert.deepEqual(left.users.map((/** @type {any} */ u) => u.handle), [admin.json.user.handle],
    "only the administrator who cleared it is left");
  assert.equal(
    (await api(`/api/courses?action=admin-card&card=${card.id}`, { key })).status,
    404,
    "and the cards went with the rest"
  );
});

/*
 * Reporting a bad question.
 *
 * The learner's own document never reaches anyone who could fix a card —
 * the server cannot read it — so a flag is its own record here, and this is
 * the whole of its life: a student sends one, the administrator reads it
 * with the rest of the overview, and clears it once the card is fixed.
 */
test("a student's flag reaches the administrator, and says who sent it and when", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rania" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Tariq" } });

  const before = Date.now();
  const sent = await api("/api/courses?action=report-flag", {
    method: "POST",
    key: student.json.key,
    body: {
      kind: "strict",
      cardId: "card-1",
      exercise: "ar2en",
      language: "ar-PS",
      prompt: "كِتاب",
      meaning: "book",
    },
  });
  assert.equal(sent.status, 200, sent.text);

  const seen = overviewOf(await api("/api/courses?action=admin-overview", { key })).flags;
  const mine = seen.find((f) => f.id === sent.json.id);
  assert.ok(mine, "the flag is in the overview");
  assert.equal(mine.kind, "strict");
  assert.equal(mine.handle, student.json.user.handle, "by which user");
  assert.equal(mine.handleName, "Tariq", "under the name an administrator would recognise");
  assert.ok(mine.at >= before && mine.at <= Date.now(), "and when");
  assert.equal(mine.prompt, "كِتاب", "with a copy of the question, not just the card id");

  /* Renaming does not leave two people in the list. */
  await api("/api/courses?action=rename", {
    method: "POST", key: student.json.key, body: { displayName: "Tariq S" },
  });
  const renamed = must(overviewOf(await api("/api/courses?action=admin-overview", { key }))
    .flags.find((f) => f.id === sent.json.id), "the flag after its sender was renamed");
  assert.equal(renamed.handleName, "Tariq S");

  /* Cleared, and gone for good. */
  const cleared = await api("/api/courses?action=admin-delete-flags", {
    method: "POST", key, body: { flagIds: [sent.json.id] },
  });
  assert.equal(cleared.json.deleted, 1);
  const after = overviewOf(await api("/api/courses?action=admin-overview", { key })).flags;
  assert.equal(after.find((f) => f.id === sent.json.id), undefined, "and it does not come back");
});

test("a flag nobody could act on is refused, and only an administrator reads them", async () => {
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Layla" } });
  const key = student.json.key;

  const unknown = await api("/api/courses?action=report-flag", {
    method: "POST", key, body: { kind: "vibes", cardId: "c1" },
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.error, "bad-flag");

  /* "Something else" says nothing on its own, so it has to say something. */
  const empty = await api("/api/courses?action=report-flag", {
    method: "POST", key, body: { kind: "other", note: "   ", cardId: "c1" },
  });
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, "note-required");

  const said = await api("/api/courses?action=report-flag", {
    method: "POST", key, body: { kind: "other", note: "  the recording is silent  ", cardId: "c1" },
  });
  assert.equal(said.status, 200, said.text);

  /* Reading them is the administrator's, and so is clearing them. */
  const nosy = await api("/api/courses?action=admin-overview", { key });
  assert.equal(nosy.status, 403);
  const clearing = await api("/api/courses?action=admin-delete-flags", {
    method: "POST", key, body: { flagIds: [said.json.id] },
  });
  assert.equal(clearing.status, 403);

  /* Signing in is the whole of the permission to send one: the people who
     meet a bad card are the students. */
  const anon = await api("/api/courses?action=report-flag", {
    method: "POST", body: { kind: "data", cardId: "c1" },
  });
  assert.equal(anon.status, 401);
});

/*
 * A report is worth acting on while the card it describes is still the one
 * that was reported. Three things can have happened to it since, and the
 * overview says which — otherwise every report has to be opened to find out
 * that it was already dealt with.
 */
test("a flag says what became of its card: edited, deleted, or never the site's", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Maha" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nour" } });

  const deck = (await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Flagged Lesson", lang: "ar-PS" },
  })).json.deck;
  const make = async (/** @type {string} */ ar, /** @type {string} */ en) => (await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { ar, en, lang: "ar-PS" }, decks: [deck.id] },
  })).json.card;
  const untouched = await make("كِتاب", "book");
  const edited = await make("بيت", "house");
  const deleted = await make("باب", "door");

  const flag = async (/** @type {string} */ cardId) => (await api("/api/courses?action=report-flag", {
    method: "POST", key: student.json.key,
    body: { kind: "data", cardId, exercise: "ar2en", language: "ar-PS" },
  })).json.id;
  const ids = {
    untouched: await flag(untouched.id),
    edited: await flag(edited.id),
    deleted: await flag(deleted.id),
    /* A card the site does not hold at all. Missing for a different reason
       than a deleted one: nothing was lost between the report and now. */
    absent: await flag("no-such-card"),
    /* Course material reaches a device under a prefixed id, and for one
       release the app reported that rather than the card's own. Those
       reports are about a card that is sitting right there. */
    prefixed: await flag(`srv${untouched.id}`),
  };

  await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { ...edited, en: "home" }, decks: [deck.id] },
  });
  await api("/api/courses?action=delete-card", { method: "POST", key, body: { cardId: deleted.id } });

  const seen = overviewOf(await api("/api/courses?action=admin-overview", { key })).flags;
  const stateOf = (/** @type {string} */ id) => seen.find((f) => f.id === id)?.cardState;
  assert.equal(stateOf(ids.untouched), "here", "a card nobody has touched says nothing");
  assert.equal(stateOf(ids.edited), "edited", "one saved since may already be fixed");
  assert.equal(stateOf(ids.deleted), "gone", "and one deleted since cannot be opened");
  assert.equal(stateOf(ids.absent), "absent", "a card the site never held is not a deleted one");
  /* The bug this heals: every one of these read as a card that could not
     be found, about material the learner did not make and cannot change. */
  assert.equal(stateOf(ids.prefixed), "here", "a report naming the device's own id still finds the card");
  const healed = must(seen.find((f) => f.id === ids.prefixed), "the flag sent under the device's id");
  assert.equal(healed.cardId, untouched.id, "and it is handed back under the card's real id");

  /* And the card itself can be read from here, which is the only way in:
     Admin lists decks, not cards. */
  const opened = await api(`/api/courses?action=admin-card&card=${untouched.id}`, { key });
  assert.equal(opened.status, 200, opened.text);
  assert.equal(opened.json.card.ar, "كِتاب");
  assert.deepEqual(opened.json.card.decks, [deck.id], "with the decks it is in, for the readout");

  const missing = await api(`/api/courses?action=admin-card&card=${deleted.id}`, { key });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error, "no-card");

  const prefixed = await api(`/api/courses?action=admin-card&card=srv${untouched.id}`, { key });
  assert.equal(prefixed.status, 200, "including one asked for under the id a report of that vintage carries");
  assert.equal(prefixed.json.card.id, untouched.id);

  const nosy = await api(`/api/courses?action=admin-card&card=${untouched.id}`, { key: student.json.key });
  assert.equal(nosy.status, 403, "a student cannot read any card they please");
});

/*
 * A report made before the card's revision was recorded says nothing about
 * whether the card has changed — but it must still say whether there is one
 * to open, and it must not claim an edit it cannot know about. Written
 * against a flag record of that vintage, because that is what is on disk.
 */
test("an older report still finds its card, and does not invent an edit", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Iman" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const deck = (await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Older Reports", lang: "ar-PS" },
  })).json.deck;
  let card = (await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { ar: "شمس", en: "sun", lang: "ar-PS" }, decks: [deck.id] },
  })).json.card;
  /* Saved again, so it is past rev 1 — the number a missing one would be
     compared against if the code guessed. */
  card = (await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: { ...card, lat: "shams" }, decks: [deck.id] },
  })).json.card;
  assert.ok(card.rev > 1, "the card has been saved more than once");

  /* A flag as the release before this one wrote them: no cardKnown, no
     cardRev, and the device's own id for the card. */
  const { getStore } = await import("../server/store.js");
  const store = getStore("arabic-courses");
  const old = {
    id: "aged00000000dead", kind: "data", note: "", handle: admin.json.user.handle,
    handleName: "Iman", cardId: `srv${card.id}`, exercise: "ar2en", subId: null,
    language: "ar-PS", prompt: "شمس", meaning: "sun", at: Date.now() - 60000,
  };
  await store.set(`flag:${old.id}`, JSON.stringify(old));
  const index = JSON.parse((await store.get("index:flags", { type: "text" })) || "[]");
  await store.set("index:flags", JSON.stringify(index.concat([old.id])));

  const seen = must(overviewOf(await api("/api/courses?action=admin-overview", { key }))
    .flags.find((f) => f.id === old.id), "the flag written before revisions were kept");
  assert.equal(seen.cardState, "here", "nothing is claimed about a card it cannot compare");
  assert.equal(seen.cardId, card.id, "and it names the card the way the site does");

  const opened = await api(`/api/courses?action=admin-card&card=${seen.cardId}`, { key });
  assert.equal(opened.status, 200, "so the card it points at actually opens");
  assert.equal(opened.json.card.en, "sun");
});
