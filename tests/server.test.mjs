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
import { leadOf } from "../src/cards.ts";

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

/* A card's forms, as a saved card carries them: the card's own word first
   and its other forms after. Written out here rather than imported so
   these tests read a saved card the way a client would, off the JSON. */
/* A recording is stored under the hash of its own bytes and fetched by
   it, so a name that is not one names nothing — see clipList. */
/** @param {number} n */
const clipId = (n) => String(n).padStart(64, "0");
/** @param {any} card */
const lead = (card) => card.forms[0];
/** @param {any} card */
const subs = (card) => card.forms.slice(1);
/**
 * A card to save, from its word and its other forms — the shape the app
 * sends.
 * @param {Record<string, any>} word
 * @param {Record<string, any>[]} [rest]
 * @param {Record<string, any>} [over]
 */
const carded = (word, rest = [], over = {}) => ({
  id: "", lang: "ar-PS", forms: [word, ...rest], ...over,
});

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
 * A verb's table is made of sub-forms, so it travels down the pipe every
 * other form does. Two things the server has to get right for that to
 * work, and both of them were wrong before it was asked to: a cell has to
 * come back still knowing where it sits, and a whole table has to fit.
 *
 * The cap mattered more than it looks. Twelve sub-forms is more alternate
 * spellings than any word has ever wanted, and it is half of Arabic's
 * smallest useful table — so a teacher would have filled in twenty-four
 * forms, saved, and got back the first twelve with no error anywhere.
 */
test("a verb's cells come back knowing where they sit, and a whole table fits", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = made.json.key;

  /* Eight persons across three tenses, which is what Arabic declares. */
  const persons = ["i", "you-m", "you-f", "he", "she", "we", "you-pl", "they"];
  const cells = [];
  for (const row of ["present", "past", "command"]) {
    for (const col of persons) {
      cells.push({ ar: `${row}-${col}`, en: `${col} ${row}`, lat: "", row, col });
    }
  }

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "أكل", en: "to eat" }, cells), decks: [] },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(subs(saved.json.card).length, 24, "the whole table survived the save");

  const she = subs(saved.json.card).find(
    (/** @type {Record<string, any>} */ s) => s.row === "past" && s.col === "she",
  );
  assert.ok(she, "the she-past cell came back placed");
  assert.equal(she.ar, "past-she");

  /* And what the teacher calls it. A verb with no infinitive is saved as
     the form a dictionary lists, so without a name a list reads "أكل · he
     ate" — one cell of the table rather than the verb. The server stores
     it as given: a name is the teacher's words, and nothing here knows one
     language from another. */
  const named = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "أكل", en: "he ate" }, cells,
                         { id: saved.json.card.id, name: "to eat" }), decks: [] },
  });
  assert.equal(named.json.card.name, "to eat", "the name came back");
  /* And a card with none does not start carrying one that says something. */
  assert.equal(saved.json.card.name, "", "a card nobody named is not given a name");

  /* Half a position places nothing, so neither half is kept: a form
     carrying a row and no column would read as a cell of a row with no
     person, and the table would file it under nobody. */
  const odd = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "شرب", en: "to drink" }, [
        { ar: "شربت", en: "drank", lat: "", row: "past" },
        { ar: "بيشرب", en: "drinks", lat: "", row: "pre sent!", col: "he" },
      ]),
      decks: [],
    },
  });
  assert.equal(subs(odd.json.card)[0].row, undefined, "a row with no column is not a position");
  assert.equal(subs(odd.json.card)[0].col, undefined);
  /* And what is kept is narrowed to the shape a language pack can name. */
  assert.equal(subs(odd.json.card)[1].row, "present");

  /* An ordinary card gains no fields it never had. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "شمس", en: "sun" }, [{ ar: "شموس", en: "suns", lat: "" }]), decks: [] },
  });
  assert.equal("row" in subs(plain.json.card)[0], false, "no empty position on a plain form");
  assert.equal("id" in subs(plain.json.card)[0], false, "and no name on a form that came without one");
});

/*
 * Which tenses a sentence's blanks ask their verbs for.
 *
 * A frame is the only thing that knows when what it describes happened, so
 * it is the only thing that can say which rows of a verb's table belong in
 * it. The server stores the answer without knowing what a tense is: the
 * blank's name is narrowed the way every name that goes between braces is,
 * the rows to the shape a pack can name, and a frame that has narrowed
 * nothing carries nothing.
 */
test("a sentence's blanks come back saying which tenses they ask for", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rami" } });
  const key = made.json.key;

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({
        ar: "مبارح {{name}} {{verb}}",
        en: "yesterday {{name}} {{verb}}",
        lat: "mbaari7 {{name}} {{verb}}",
        tenses: { " VERB ": ["past", "past", "com mand!"], nothing: [] },
      }, [], { sentence: true }),
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(lead(saved.json.card).tenses, { verb: ["past", "command"] },
    "the name is narrowed, the rows are narrowed, and each row is kept once");

  /* A blank that admits every tense says nothing, which is what an absent
     answer has always meant — so nothing is stored for it. */
  const open = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "{{name}} {{verb}}", en: "{{name}} {{verb}}", lat: "{{name}} {{verb}}" },
                   [], { sentence: true }),
      decks: [],
    },
  });
  assert.equal("tenses" in lead(open.json.card), false, "no empty map on a frame that narrows nothing");
});

/*
 * And what kind of card it is, which is settled when the card is made.
 *
 * A word, a sentence or a conversation. The editor asks once, while the
 * card is being written and nothing can be lost by any answer, and never
 * again — but the editor is not the only thing that can reach this
 * endpoint. A build that has not caught up, a save queued on a device
 * before the rule existed, or a card pasted in can all claim a kind the
 * stored card is not, so the kind is taken from the card as stored.
 */
test("a card cannot be made into another kind of card", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Sami" } });
  const key = made.json.key;
  const save = (/** @type {Record<string, any>} */ card) =>
    api("/api/courses?action=save-card", { method: "POST", key, body: { card, decks: [] } });

  /* A sentence, said so by the teacher rather than read off its braces. */
  const frame = await save({
    id: "", lang: "ar-PS", sentence: true,
    forms: [{ ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}" }],
  });
  assert.equal(frame.status, 200, frame.text);
  assert.equal(frame.json.card.sentence, true, "it was made as a sentence");

  /* Saved again as a word — braces gone, the flag flipped — and it is
     still a sentence. Before 0.180 this stored a word, and every card
     whose blank asked for this frame was asking for something else. */
  const asWord = await save({
    id: frame.json.card.id, lang: "ar-PS", sentence: false,
    forms: [{ ar: "اسمي", en: "my name is", lat: "ismi" }],
  });
  assert.equal(asWord.status, 200, asWord.text);
  assert.equal(asWord.json.card.sentence, true, "a sentence stays a sentence");
  assert.equal(leadOf(asWord.json.card).ar, "اسمي", "and the words it was saved with are kept");

  /* The same the other way: a word is not turned into a sentence. */
  const word = await save({
    id: "", lang: "ar-PS", forms: [{ ar: "كِتاب", en: "book", lat: "kitaab" }],
  });
  assert.equal(word.json.card.sentence, false, "it was made as a word");
  const asFrame = await save({
    id: word.json.card.id, lang: "ar-PS", sentence: true,
    forms: [{ ar: "كِتاب", en: "book", lat: "kitaab" }],
  });
  assert.equal(asFrame.json.card.sentence, false, "a word stays a word");

  /* And a conversation keeps its turns: emptying them is the one edit
     that would stop it being one. */
  const talk = await save({
    id: "", lang: "ar-PS",
    forms: [{ ar: "", en: "At the door", lat: "" }],
    speakers: ["Layla", "Karim"],
    lines: [
      { who: 0, ar: "مرحبا", en: "hello", lat: "marhaba" },
      { who: 1, ar: "أهلا", en: "hi", lat: "ahlan" },
    ],
  });
  assert.equal(talk.json.card.lines.length, 2, "it was made as a conversation");
  const emptied = await save({
    id: talk.json.card.id, lang: "ar-PS",
    forms: [{ ar: "مرحبا", en: "hello", lat: "marhaba" }],
    lines: [],
  });
  assert.equal(emptied.json.card.lines.length, 2, "a conversation stays a conversation");
  assert.equal(emptied.json.card.sentence, false);

  /* A word that arrives carrying turns does not become one either. */
  const withTurns = await save({
    id: word.json.card.id, lang: "ar-PS",
    forms: [{ ar: "كِتاب", en: "book", lat: "kitaab" }],
    lines: [{ who: 0, ar: "مرحبا", en: "hello", lat: "" }],
  });
  assert.deepEqual(withTurns.json.card.lines, [], "turns on a word are not a conversation");
});

/*
 * What the teacher says a word is.
 *
 * Stored as given and narrowed to the shape an id can take: which
 * categories exist is the language pack's business, and the server does
 * not know one language from another. A card written before the question
 * existed carries none, and passes through unchanged.
 */
test("a card keeps what the teacher says it is", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dina" } });
  const key = made.json.key;

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "كِتاب", en: "book", lang: "ar-PS", category: "noun" }, decks: [] },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.json.card.category, "noun", "it came back");

  /* And it is the card's to change: a noun written as one can be corrected. */
  const again = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: saved.json.card.id, ar: "كِتاب", en: "book", lang: "ar-PS", category: "PREPOSITION!" }, decks: [] },
  });
  assert.equal(again.json.card.category, "preposition", "narrowed to the shape an id can take");

  /* A card that says nothing says nothing — not "word", not a guess. */
  const quiet = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", ar: "شمس", en: "sun", lang: "ar-PS" }, decks: [] },
  });
  assert.equal(quiet.json.card.category, "", "nobody has said what it is");
});

/*
 * A form's name, and whose table a cell is in.
 *
 * Both are what makes the pronouns on the end of a word a property of the
 * form rather than of the card: the plural takes the same endings and has
 * eight of its own, so a cell has to be able to say which form it is a
 * form of. A name the server dropped would be a cell pointing at nothing
 * the moment the card came back.
 */
test("a form keeps its name, and a cell keeps whose table it is in", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rami" } });
  const key = made.json.key;

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "كِتاب", en: "book" }, [
        { id: "fpl", ar: "كُتُب", en: "books", lat: "" },
        { ar: "كتابي", en: "my book", lat: "", row: "attached", col: "me" },
        { id: "fx1", of: "fpl", ar: "كتبي", en: "my books", lat: "", row: "attached", col: "me" },
      ]),
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  const [plural, mine, ours] = subs(saved.json.card);
  assert.equal(plural.id, "fpl", "the form kept its name");
  assert.equal("of" in mine, false, "a cell of the card's own table names no owner");
  assert.equal(ours.of, "fpl", "and one of the plural's names the plural");
  assert.equal(ours.id, "fx1");

  /* Narrowed to the shape an id can take, like every other id on the
     document — and an owner without a position is not an owner, because a
     form that is not a cell is in no table at all. */
  const odd = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "قلم", en: "pen" }, [
        { ar: "قلمي", en: "my pen", lat: "", row: "attached", col: "me", of: "f PL!" },
        { ar: "أقلام", en: "pens", lat: "", of: "fpl" },
      ]),
      decks: [],
    },
  });
  assert.equal(subs(odd.json.card)[0].of, "fpl");
  assert.equal("of" in subs(odd.json.card)[1], false, "a form with no position is in nobody's table");
});

/*
 * Which forms of a card are asked about.
 *
 * A teacher may want a table on the card for a student to read rather than
 * to be drilled on, and until this the only way to stop a form being asked
 * was to delete it — taking its recordings and every student's progress
 * with it. The server keeps the answer the way it keeps a position: as
 * given, knowing nothing about what it means.
 */
test("a form can be kept without being asked about, and says so both ways", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = made.json.key;

  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "كِتاب", en: "book" }, [
        { ar: "كتابي", en: "my book", lat: "", row: "attached", col: "me", ask: false },
        { ar: "كُتُب", en: "books", lat: "" },
      ]),
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(subs(saved.json.card)[0].ask, false, "the cell kept out of the drill says so");
  assert.equal("ask" in subs(saved.json.card)[1], false, "and an ordinary form gains no field");
  assert.equal("ask" in lead(saved.json.card), false,
    "the card's own word is asked unless it says otherwise, and it is a form like the rest");

  /* And switching the card's own word off and on again comes back on. The
     saved card is the old one with these fields written over it, so a
     field left out here would leave the last answer standing for ever —
     which is the bug `drill` already has a comment about. */
  const quiet = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "كِتاب", en: "book", ask: false }, [], { id: saved.json.card.id }), decks: [] },
  });
  assert.equal(lead(quiet.json.card).ask, false);
  const loud = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "كِتاب", en: "book" }, [], { id: saved.json.card.id }), decks: [] },
  });
  assert.equal("ask" in lead(loud.json.card), false, "switched back on rather than left where it was");
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
      card: carded({ ar: "اسمي {{name}}", en: "My name is {{name}}", lat: "ismi {{name}}" }),
      decks: [deckId],
    },
  });
  /* The values, in no deck at all, and not practised in their own right. */
  const value = (/** @type {string} */ ar, /** @type {string} */ en) =>
    api("/api/courses?action=save-card", {
      method: "POST", key,
      body: {
        card: carded({ ar, en, lat: en.toLowerCase() }, [], { fills: "name", drill: false }),
        decks: [],
      },
    });
  await value("رافائيل", "Raphael");
  await value("فيكتور", "Victor");
  /* And one in another language, which is not a variation on the sentence
     but a different sentence. */
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "Tâm", en: "Tam" }, [], { lang: "vi-HUE", fills: "name", drill: false }),
      decks: [],
    },
  });

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Omar" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });

  const first = await api("/api/courses?action=my-material", { key: student.json.key });
  const sent = (first.json.cards || []).flatMap((/** @type {any} */ d) => d.cards);
  assert.deepEqual(
    sent.filter((/** @type {any} */ c) => c.fills).map((/** @type {any} */ c) => lead(c).en).sort(),
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
      .map((/** @type {any} */ c) => lead(c).en)
      .sort(),
    ["Raphael", "Sarah", "Victor"]
  );
});

/*
 * And the other two ways a blank names what fills it.
 *
 * A blank is filled four ways, and only one of them was ever bundled. A
 * card that answers by the kind of word it said it was — `{{noun}}` — and
 * one that answers to the ID its teacher gave it — `{{colour-red}}` —
 * both sat in no deck and so never reached the student at all: the
 * sentence arrived with a hole nothing on the device could fill, and was
 * quietly never dealt. The teacher saw it working, because the editor's
 * examples read the whole library.
 */
test("a deck's phrases are also sent the cards a kind of word and an ID fill", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yara" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Things", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Arabic 2", language: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key, body: { deckId, courseId: course.json.course.id },
  });
  /* Two frames in the deck: one asking for any noun, one for a named card. */
  for (const [ar, en] of [["الـ{{noun}} كبير", "the {{noun}} is big"], ["{{colour-red}} غامق", "{{colour-red}} is dark"]]) {
    await api("/api/courses?action=save-card", {
      method: "POST", key,
      body: { card: carded({ ar, en, lat: en }, [], { sentence: true }), decks: [deckId] },
    });
  }
  /* A noun, which says what it is and names no group at all. */
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "باب", en: "door", lat: "baab" }, [], { category: "noun" }), decks: [] },
  });
  /* And a card answering to its own ID, likewise in no deck and tagged
     with nothing. */
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "أحمر", en: "red", lat: "aHmar" }, [], { ref: "colour-red" }), decks: [] },
  });

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Lina" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });

  const mine = await api("/api/courses?action=my-material", { key: student.json.key });
  const sent = (mine.json.cards || []).flatMap((/** @type {any} */ d) => d.cards).map((/** @type {any} */ c) => lead(c).en);
  assert.ok(sent.includes("door"), "the noun never reached the student, so {{noun}} had nothing in it");
  assert.ok(sent.includes("red"), "the named card never reached the student, so {{colour-red}} had nothing in it");
});

/*
 * And what a client that says nothing at all gets.
 *
 * "Not a sentence" and "did not say" are different answers, and the server
 * read both as the first. A build from before 0.176 says nothing about
 * this by definition, so every sentence it saved arrived here and was
 * pinned as a word with its own braces in it — lent into other cards'
 * holes, drawn as a word, and refused by the editor on every later save
 * until somebody deleted the braces. A card with a hole in it is a
 * sentence, which is how it was always read and is now what is stored.
 */
test("a card that says nothing about being a sentence is read by its holes", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rania" } });
  const key = made.json.key;
  const save = (/** @type {Record<string, any>} */ card) =>
    api("/api/courses?action=save-card", { method: "POST", key, body: { card, decks: [] } });

  /* No `sentence` field at all, which is what an older build sends. */
  const old = await save({
    id: "", lang: "ar-PS",
    forms: [{ ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}" }],
  });
  assert.equal(old.status, 200, old.text);
  assert.equal(old.json.card.sentence, true, "a card with a hole in it is a sentence");

  /* And one that says outright that it is a word, while carrying a hole:
     the invariant the rest of this rests on is that only a sentence may
     have a blank, so it is settled by reading rather than by refusing. */
  const contrary = await save({
    id: "", lang: "ar-PS", sentence: false,
    forms: [{ ar: "الـ{{noun}} كبير", en: "the {{noun}} is big", lat: "" }],
  });
  assert.equal(contrary.json.card.sentence, true);

  /* A word with no holes is untouched by any of it. */
  const plain = await save({ id: "", lang: "ar-PS", forms: [{ ar: "باب", en: "door", lat: "baab" }] });
  assert.equal(plain.json.card.sentence, false);
});

/*
 * Two saves at once, and neither of them lost.
 *
 * Every list here was read, changed in memory and written back whole, and
 * the lock inside the store serialises the write without seeing the read
 * before it. So two saves in flight — two tabs, two co-teachers, a queued
 * draft draining while somebody types — each read the list as it was and
 * the second wrote its copy over the first. What that costs is a card
 * that was saved, stored, and in no deck and no collection: nothing
 * afterwards looks for it, and nobody is told.
 */
test("cards saved at the same moment all reach the deck and the collection", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Suha" } });
  const key = made.json.key;
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Lesson 1", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;

  /* Eight at once, which is what a paste of a list looks like from here. */
  const saves = Array.from({ length: 8 }, (_, i) =>
    api("/api/courses?action=save-card", {
      method: "POST", key,
      body: { card: carded({ ar: `كلمة${i}`, en: `word ${i}`, lat: `word${i}` }), decks: [deckId] },
    }));
  const done = await Promise.all(saves);
  for (const r of done) assert.equal(r.status, 200, r.text);
  const saveIds = done.map((r) => r.json.card.id).sort();

  const mine = await api("/api/courses?action=my-cards", { key });
  assert.deepEqual(
    mine.json.cards.map((/** @type {any} */ c) => c.id).sort(),
    saveIds,
    "a card was saved into nobody's collection",
  );
  const decks = await api("/api/courses?action=my-decks", { key });
  const back = decks.json.decks.find((/** @type {any} */ d) => d.id === deckId);
  assert.equal(back.cardCount, 8, "a card was saved into no deck");

  /* And deleting several at once leaves the rest where they were. */
  const gone = saveIds.slice(0, 3);
  const cut = await api("/api/courses?action=delete-cards", { method: "POST", key, body: { cardIds: gone } });
  assert.equal(cut.status, 200, cut.text);
  const after = await api("/api/courses?action=my-cards", { key });
  assert.deepEqual(
    after.json.cards.map((/** @type {any} */ c) => c.id).sort(),
    saveIds.filter((id) => !gone.includes(id)),
  );
});

/*
 * Two cards answering to one name.
 *
 * The editor refuses a taken ID while the teacher is looking at it, which
 * is where the refusal says something useful. Nothing said so for the
 * saves that never went through that screen, and two cards answering to
 * one `{{x}}` is the one thing an ID exists to prevent: neither of them
 * can be pointed at afterwards.
 */
test("an ID another card already answers to is refused", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Hadi" } });
  const key = made.json.key;
  const save = (/** @type {Record<string, any>} */ card) =>
    api("/api/courses?action=save-card", { method: "POST", key, body: { card, decks: [] } });

  const red = await save({ id: "", lang: "ar-PS", ref: "colour-red", forms: [{ ar: "أحمر", en: "red", lat: "" }] });
  assert.equal(red.json.card.ref, "colour-red");

  const twin = await save({ id: "", lang: "ar-PS", ref: "colour-red", forms: [{ ar: "قرمزي", en: "crimson", lat: "" }] });
  assert.equal(twin.status, 409, twin.text);
  assert.equal(twin.json.error, "ref-taken");

  /* A free name is saved as ever, and the card that already holds one may
     be saved again without tripping over itself. */
  const blue = await save({ id: "", lang: "ar-PS", ref: "colour-blue", forms: [{ ar: "أزرق", en: "blue", lat: "" }] });
  assert.equal(blue.status, 200, blue.text);
  const again = await save({
    id: red.json.card.id, lang: "ar-PS", ref: "colour-red", forms: [{ ar: "أحمر", en: "red", lat: "aHmar" }],
  });
  assert.equal(again.status, 200, again.text);
  assert.equal(lead(again.json.card).lat, "aHmar", "its own ID is not a clash with itself");
});

/*
 * One word, more than one hole.
 *
 * A word stands in more than one kind of hole as soon as a teacher writes
 * a second frame about it — a name that is also a greeting — and saying so
 * used to take a second card carrying the same word, which is the same
 * word learnt twice and two schedules for it. So `fills` is a list, a card
 * written when it was one name is read as the list of one it always meant,
 * and a card that fills none carries the field not at all — which is what
 * every reader of it still tests for.
 */
test("a card can say it fills several blanks, and reaches every deck that leaves one", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dana" } });
  const key = made.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Greetings", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title: "Arabic 1", language: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key, body: { deckId, courseId: course.json.course.id },
  });
  /* One frame leaving each of the two holes. */
  for (const [ar, en] of [["اسمي {{name}}", "My name is {{name}}"], ["{{greeting}}!", "{{greeting}}!"]]) {
    await api("/api/courses?action=save-card", {
      method: "POST", key, body: { card: carded({ ar, en, lat: "" }), decks: [deckId] },
    });
  }

  /* The word that stands in both, named once on one card. */
  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: carded({ ar: "مرحبا", en: "Marhaba", lat: "marhaba" }, [],
        { fills: ["Name", "greeting", "name"], drill: false }),
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(saved.json.card.fills, ["name", "greeting"],
    "the names were not narrowed, lowered and said once");

  /* A card written when this was one name is stored as the list of one. */
  const older = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "سارة", en: "Sarah", lat: "" }, [], { fills: "name", drill: false }), decks: [] },
  });
  assert.deepEqual(older.json.card.fills, ["name"]);

  /* And a card that fills none carries the field not at all, which is what
     it has always been on an ordinary card. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: carded({ ar: "شمس", en: "sun", lat: "" }), decks: [deckId] },
  });
  assert.equal("fills" in plain.json.card, false, "an ordinary card started carrying an empty one");

  /* Taking a name off puts the card back to being an ordinary one rather
     than leaving what it used to fill standing. */
  const off = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: { ...carded({ ar: "سارة", en: "Sarah", lat: "" }, [], { fills: [], drill: false }), id: older.json.card.id },
      decks: [],
    },
  });
  assert.equal("fills" in off.json.card, false, "what it used to fill was left standing");

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Ziad" } });
  await api("/api/courses?action=assign-student", {
    method: "POST", key, body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });
  const mine = await api("/api/courses?action=my-material", { key: student.json.key });
  const sent = (mine.json.cards || []).flatMap((/** @type {any} */ d) => d.cards);
  assert.deepEqual(
    sent.filter((/** @type {any} */ c) => c.fills).map((/** @type {any} */ c) => lead(c).en).sort(),
    ["Marhaba"],
    "the word standing in both holes did not travel with the deck"
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
    body: { card: carded({ ar: "كتاب / سفر", en: "book", lat: " / safar" }), decks: [] },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(lead(saved.json.card).lat, " / safar", "the gap was trimmed away");
  assert.equal(lead(saved.json.card).ar, "كتاب / سفر");
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
      card: carded(
        { ar: "كِتاب", en: "book", clips: ["a".repeat(64)], slowClips: ["b".repeat(64)] },
        [{ ar: "كُتُب", en: "books", slowClips: ["c".repeat(64)] }]
      ),
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(lead(saved.json.card).clips, ["a".repeat(64)]);
  assert.deepEqual(lead(saved.json.card).slowClips, ["b".repeat(64)]);
  assert.deepEqual(subs(saved.json.card)[0].slowClips, ["c".repeat(64)]);
  /* A form recorded only slowly still answers the ordinary question with a
     list, not with nothing: every reader of a card takes both as arrays. */
  assert.deepEqual(subs(saved.json.card)[0].clips, []);

  /* And a card that says nothing about the slow ones has an empty list. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key, body: { card: carded({ ar: "بيت", en: "house" }), decks: [] },
  });
  assert.deepEqual(lead(plain.json.card).slowClips, []);
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

/*
 * The half of a report the learner cannot be expected to type out.
 *
 * "It marked me wrong" cannot be acted on without the answer it marked, and
 * a report from a card in a deck nobody can name is a report that has to be
 * hunted for. Both used to be thrown away at the door: the app never sent
 * them and the server would not have kept them.
 */
test("a report carries what was answered, how it was marked, and where the card came from", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nadia" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Omar" } });

  const sent = await api("/api/courses?action=report-flag", {
    method: "POST",
    key: student.json.key,
    body: {
      kind: "strict",
      cardId: "card-answered",
      exercise: "ar2en",
      language: "ar-PS",
      prompt: "مَدْرَسة",
      meaning: "school",
      courseId: "course-7",
      deckId: "deck-3",
      answer: "  school ",
      verdict: "wrong",
      release: "0.157 (abc1234)",
    },
  });
  assert.equal(sent.status, 200, sent.text);

  const mine = must(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    "the report just sent"
  );
  /* Untrimmed on purpose. A trailing space is exactly the sort of thing
     that turns a right answer into a wrong one, and it is the one detail a
     learner writing the report out by hand would never think to mention. */
  assert.equal(mine.answer, "  school ", "what they put, character for character");
  assert.equal(mine.verdict, "wrong", "and what the app made of it");
  assert.equal(mine.courseId, "course-7");
  assert.equal(mine.deckId, "deck-3");
  assert.equal(mine.release, "0.157 (abc1234)", "on the build they were running");
});

test("a verdict the app never sends is stored as nothing, not as itself", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yusra" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const sent = await api("/api/courses?action=report-flag", {
    method: "POST",
    key,
    /* An open field here would put whatever anyone posted onto the admin
       screen and into an export, exactly as an open `kind` would. */
    body: { kind: "data", cardId: "c9", verdict: "<script>alert(1)</script>" },
  });
  assert.equal(sent.status, 200, sent.text);
  const mine = must(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    "the report just sent"
  );
  assert.equal(mine.verdict, "", "an unknown verdict reads as 'not recorded'");
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
    method: "POST", key, body: { card: carded({ ar, en }), decks: [deck.id] },
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
    method: "POST", key,
    body: { card: { ...edited, forms: [{ ...lead(edited), en: "home" }] }, decks: [deck.id] },
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
  assert.equal(lead(opened.json.card).ar, "كِتاب");
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
    method: "POST", key, body: { card: carded({ ar: "شمس", en: "sun" }), decks: [deck.id] },
  })).json.card;
  /* Saved again, so it is past rev 1 — the number a missing one would be
     compared against if the code guessed. */
  card = (await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { ...card, forms: [{ ...lead(card), lat: "shams" }] }, decks: [deck.id] },
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
  assert.equal(lead(opened.json.card).en, "sun");
});

/*
 * The shape a card was stored in before 0.138, cleared when it is saved.
 *
 * A card was its own first form: the word on the card, its other forms in
 * `subs` beside it. One `forms` list replaced both, and a save spread the
 * stored record under the new fields — so a card written before that kept a
 * second, stale copy of its word for ever, sent it to every reader, and
 * offered any of them the wrong half. The card editor read that half until
 * the release this test arrived in.
 */
test("saving a card clears the shape it was stored in before one list of forms", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dana" } });
  const key = made.json.key;

  /* A card as an older build wrote one, put straight into the store: the
     word on the card, the rest in `subs`, and grammar flat beside them. */
  const { getStore } = await import("../server/store.js");
  const store = getStore("arabic-courses");
  const aged = {
    id: "kaged0000", owner: made.json.user.handle, lang: "ar-PS", rev: 3,
    ar: "كِتاب", en: "book", lat: "kitaab", gender: "masculine",
    clips: [clipId(7)], slowClips: [], answers: [{ text: "كِتاب", lat: "kitaab" }],
    subs: [{ ar: "كُتُب", en: "books", lat: "kutub" }],
    created: 1, updated: 1,
  };
  await store.set(`card:${aged.id}`, JSON.stringify(aged));
  await store.set(`owncards:${made.json.user.handle}`, JSON.stringify([aged.id]));

  /* The teacher opens it and saves it, in the shape the app sends now. */
  const saved = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: aged.id, lang: "ar-PS",
        forms: [
          { id: aged.id, ar: "كِتاب", en: "book", lat: "kitaab", gender: "masculine", clips: [clipId(7)] },
          { id: "fpl", ar: "كُتُب", en: "books", lat: "kutub" },
        ],
      },
      decks: [],
    },
  });
  assert.equal(saved.status, 200, saved.text);
  const card = saved.json.card;
  assert.equal(lead(card).ar, "كِتاب", "the word is where a card keeps it");
  assert.equal(subs(card).length, 1);
  for (const gone of ["ar", "en", "lat", "clips", "slowClips", "answers", "subs", "gender"]) {
    assert.equal(card[gone], undefined, `the card no longer carries ${gone} of its own`);
  }
  /* And on disk, not merely in the answer. */
  const onDisk = JSON.parse((await store.get(`card:${aged.id}`, { type: "text" })) || "null");
  assert.equal(onDisk.subs, undefined, "nor on disk");
  assert.equal(onDisk.ar, undefined);
  assert.equal(onDisk.forms.length, 2);
});

/*
 * What the whitelist cut, said out loud.
 *
 * Every cap here is a guard against a runaway client, and each of them did
 * its work in silence: a teacher who wrote a thirteenth turn got "Saved"
 * and a card with twelve turns in it, with nothing on any screen to say
 * which one had gone.
 */
test("a card that does not fit says what was left out", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Faris" } });
  const key = made.json.key;

  /* A thirteenth turn and a fifth speaker, both past the cap. */
  const scene = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", lang: "ar-PS", forms: [{ ar: "", en: "At the door", lat: "" }],
        speakers: ["A", "B", "C", "D", "E"],
        lines: Array.from({ length: 13 }, (_, i) => ({ who: 0, ar: `س${i}`, en: `line ${i}`, lat: "" })),
      },
      decks: [],
    },
  });
  assert.equal(scene.status, 200, scene.text);
  assert.equal(scene.json.card.lines.length, 12);
  assert.deepEqual(scene.json.trimmed, ["1 turn", "1 speaker"],
    "named, and counted, in the teacher's own terms");

  /* Recordings, over the forms that were kept. */
  const loud = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", lang: "ar-PS",
        forms: [{ ar: "باب", en: "door", lat: "baab", clips: Array.from({ length: 14 }, (_, i) => clipId(i)) }],
      },
      decks: [],
    },
  });
  assert.deepEqual(loud.json.trimmed, ["2 recordings"]);

  /* And a name no recording could ever have. A clip is stored under the
     hash of its own bytes and fetched by it, so anything else names
     nothing that can be played — it was kept anyway, twelve per form
     across sixty-five forms, which is a card a client can make as large
     as it likes and every student then downloads. */
  const junk = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", lang: "ar-PS",
        forms: [{ ar: "شبّاك", en: "window", lat: "shubbaak", clips: [clipId(4), "x".repeat(9000), "nope"] }],
      },
      decks: [],
    },
  });
  assert.deepEqual(lead(junk.json.card).clips, [clipId(4)], "only a name a recording can have is kept");
  assert.deepEqual(junk.json.trimmed, ["2 recordings"]);

  /* And an ordinary card says nothing at all, so the client has nothing to
     report. */
  const plain = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", lang: "ar-PS", forms: [{ ar: "شمس", en: "sun", lat: "shams" }] }, decks: [] },
  });
  assert.equal(plain.json.trimmed, undefined);
});

/*
 * A backup that contains a conversation's recordings.
 *
 * Clip hashes are only discoverable from the cards that use them, so the
 * backup reads every card to know what a complete one holds — and it read
 * the forms alone. A line of a scene is drilled in its own right and
 * carries recordings of its own, so a backup of a course with a
 * conversation in it came out without a word of the conversation audible,
 * and nothing said so: the manifest's own count agreed with itself.
 */
test("a backup counts the recordings on a conversation's turns", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nour" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const scene = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: {
        id: "", lang: "ar-PS",
        forms: [{ ar: "", en: "At the door", lat: "", clips: [clipId(1)] }],
        speakers: ["A", "B"],
        lines: [
          { who: 0, ar: "مرحبا", en: "hello", lat: "", clips: [clipId(2)] },
          { who: 1, ar: "أهلا", en: "hi", lat: "", slowClips: [clipId(3)] },
        ],
      },
      decks: [],
    },
  });
  assert.equal(scene.status, 200, scene.text);
  assert.equal(scene.json.card.lines[0].clips[0], clipId(2), "the turn's recording is stored");

  const got = await api("/api/courses?action=admin-backup-manifest", { key });
  assert.equal(got.status, 200, got.text);
  const planned = got.json.manifest.plan
    .filter((/** @type {any} */ c) => c.kind === "clip")
    .flatMap((/** @type {any} */ c) => c.keys);
  for (const [what, hash] of [["the card's own", clipId(1)], ["the turn's", clipId(2)], ["the slow turn's", clipId(3)]]) {
    assert.ok(planned.includes(`clip:${hash}`), `${what} recording is in the backup`);
  }
  assert.equal(got.json.manifest.counts.clips, planned.length, "and the count agrees with the plan");
});

/*
 * Reported problems were the one thing on the site a backup did not hold.
 *
 * A restore is additive, so nothing was actively destroyed — but a site
 * rebuilt from a file came back without a single outstanding report, and
 * the file gave no sign that anything was missing. They are small, they are
 * somebody's words about a card that is in the file beside them, and they
 * are the list of what is still wrong.
 */
test("a backup carries reported problems, and a restore puts them back", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Salma" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const sent = await api("/api/courses?action=report-flag", {
    method: "POST", key,
    body: { kind: "data", note: "the recording is silent", cardId: "c-backed-up", exercise: "ar2en" },
  });
  assert.equal(sent.status, 200, sent.text);

  const got = await api("/api/courses?action=admin-backup-manifest", { key });
  const planned = got.json.manifest.plan
    .filter((/** @type {any} */ c) => c.kind === "flag")
    .flatMap((/** @type {any} */ c) => c.keys);
  assert.ok(planned.includes(`flag:${sent.json.id}`), "the report is in the plan");
  assert.equal(got.json.manifest.counts.flags, planned.length, "and the count agrees with it");
  assert.ok(
    (got.json.manifest.indexes.flags || []).includes(sent.json.id),
    "with the index that makes them findable again"
  );

  /* And the chunk actually holds it: a plan naming a key nothing fetches is
     a backup that passes its own check and restores nothing. */
  const chunk = await api("/api/courses?action=admin-backup-chunk", {
    method: "POST", key, body: { keys: [`flag:${sent.json.id}`] },
  });
  const record = must(chunk.json.records[`flag:${sent.json.id}`], "the report in the chunk");
  assert.equal(record.note, "the recording is silent");

  /* Cleared from the site, then put back from the file. */
  await api("/api/courses?action=admin-delete-flags", {
    method: "POST", key, body: { flagIds: [sent.json.id] },
  });
  assert.equal(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    undefined,
    "gone from the site"
  );

  const put = await api("/api/courses?action=admin-restore-chunk", {
    method: "POST", key,
    body: { records: { [`flag:${sent.json.id}`]: record, "index:flags": [sent.json.id] } },
  });
  assert.equal(put.status, 200, put.text);
  const back = must(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    "the restored report"
  );
  assert.equal(back.note, "the recording is silent", "and it reads as it did");
});

/* Clearing the site offers reports as a part of their own. They outlive the
   cards they are about by design — that is what the copy of the question is
   for — so clearing the cards must not quietly take the list of what was
   wrong with them. */
test("reported problems are cleared on their own say-so, not with the cards", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Hiba" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const sent = await api("/api/courses?action=report-flag", {
    method: "POST", key, body: { kind: "strict", cardId: "c-kept", exercise: "ar2en" },
  });

  const cards = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: ADMIN_KEY, parts: ["cards"] },
  });
  assert.equal(cards.status, 200, cards.text);
  assert.ok(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    "clearing the cards leaves the reports about them"
  );

  /* Every report on the site, not just this one — these tests share a
     store, so what is counted is "at least the one just made" and what is
     checked is that this one went. */
  const asked = await api("/api/courses?action=admin-clear", {
    method: "POST", key, body: { adminKey: ADMIN_KEY, parts: ["flags"] },
  });
  assert.ok(asked.json.removed.flags >= 1, "and asking for them clears them");
  assert.equal(
    overviewOf(await api("/api/courses?action=admin-overview", { key }))
      .flags.find((f) => f.id === sent.json.id),
    undefined
  );
});

/* ------------------------------------------------------------------
   A shared document that cannot be read

   The worst failure the app had. A host dying mid-write can leave the
   stored document truncated, and this endpoint answered that with exactly
   what it answers a first sync: nothing stored. The device then pushed as a
   first write, the store refused because a file existed, the device
   re-pulled, pushed again, was refused again, and gave up — for every
   device on that passphrase, for ever, behind "Sync failed", with nothing
   from that moment on ever leaving the phone.
   ------------------------------------------------------------------ */

/* What a host dying mid-write leaves: the document's own file, overwritten
   in place, with the copy behind it untouched. */
/** @param {string} token @param {string} bytes */
async function damage(token, bytes) {
  const { getStore } = await import("../server/store.js");
  const { writeFile } = await import("node:fs/promises");
  const store = getStore("arabic-trainer");
  const key = createHash("sha256").update(`arabic-trainer:${token}`).digest("hex");
  await writeFile(path.join(store.directory, encodeURIComponent(key)), bytes, "utf8");
}

test("a damaged shared document is recovered rather than locking every device out", async () => {
  const token = createHash("sha256").update("damaged").digest("hex");
  await api("/api/sync", { method: "POST", token, body: { data: { items: [{ id: "a" }] } } });
  const one = await api("/api/sync", { token });
  await api("/api/sync", {
    method: "POST", token,
    body: { etag: one.json.etag, data: { items: [{ id: "a" }, { id: "b" }] } },
  });

  /* The host dies mid-write: the right name, the wrong length. Written
     straight to the file, because that is what a crash does — going
     through the store would rotate the copy behind it, which is the thing
     under test. */
  await damage(token, "{ half a doc");

  const pull = await api("/api/sync", { token });
  assert.equal(pull.status, 200);
  assert.equal(pull.json.lost, "recovered", "it says the copy was damaged");
  assert.equal(pull.json.data.items.length, 1, "and hands back the copy behind it");
  assert.ok(pull.json.etag, "with an ETag, which is what lets the device replace the wreckage");

  /* And the device's ordinary next push goes through, which is the whole
     point: no lockout. */
  const heal = await api("/api/sync", {
    method: "POST", token,
    body: { etag: pull.json.etag, data: { items: [{ id: "a" }, { id: "b" }, { id: "c" }] } },
  });
  assert.equal(heal.status, 200, heal.text);
  assert.equal((await api("/api/sync", { token })).json.data.items.length, 3);
});

test("with nothing readable behind it, the device is still not locked out", async () => {
  const token = createHash("sha256").update("nothing-behind").digest("hex");
  /* A first write, then damage — so the copy behind it is the absent one. */
  await api("/api/sync", { method: "POST", token, body: { data: { items: [{ id: "a" }] } } });
  await damage(token, "");

  const pull = await api("/api/sync", { token });
  assert.equal(pull.json.lost, "unreadable", "it says so rather than pretending");
  assert.equal(pull.json.data, null);
  assert.ok(pull.json.etag);
  const heal = await api("/api/sync", {
    method: "POST", token,
    body: { etag: pull.json.etag, data: { items: [{ id: "z" }] } },
  });
  assert.equal(heal.status, 200, "this device's copy replaces it");
});

test("a push that would empty a document that is not empty is refused", async () => {
  /* There is no legitimate way to reach this: a device with nothing on it
     pulls before it pushes, so what it sends carries whatever was there.
     What is left is a merge that lost everything, and one request is
     enough to make that permanent. */
  const token = createHash("sha256").update("would-empty").digest("hex");
  await api("/api/sync", { method: "POST", token, body: { data: { items: [{ id: "a" }, { id: "b" }] } } });
  const read = await api("/api/sync", { token });

  const wipe = await api("/api/sync", {
    method: "POST", token,
    body: { etag: read.json.etag, data: { items: [] } },
  });
  assert.equal(wipe.status, 409);
  assert.equal(wipe.json.error, "would-empty");
  assert.equal(wipe.json.held, 2, "and says what it is protecting");
  assert.equal((await api("/api/sync", { token })).json.data.items.length, 2, "untouched");

  /* A learner who has genuinely removed every card has the headstones to
     show for it, and says so. */
  const meant = await api("/api/sync", {
    method: "POST", token,
    body: { etag: read.json.etag, data: { items: [], tombstones: { a: 1, b: 1 } }, allowEmpty: true },
  });
  assert.equal(meant.status, 200, meant.text);
  assert.deepEqual((await api("/api/sync", { token })).json.data.items, []);
});

/* ================= a language's numbers, and its clock =================

   A number system is in no deck: it is the words a language builds its
   numbers out of, and they are a fact about the language rather than
   about one lesson. That is the same position a card filling a blank is
   in, and it has the same consequence — nothing a student's device
   compares against moves when one is written, so the version has to be
   told about it by hand or a corrected word reaches nobody. */

/** A small but complete system, the shape the editor saves. */
const numberSystem = (/** @type {Record<string, any>} */ over = {}) => ({
  id: "",
  languageId: "ar-PS",
  composerVersion: 1,
  lexemes: {
    "unit.1": { slot: "unit.1", forms: { standalone: "one", f: "one-f" } },
    "unit.2": { slot: "unit.2", forms: { standalone: "two" } },
    connector: { slot: "connector", forms: { standalone: "and" } },
  },
  overrides: { 300: { text: "three-hundred" } },
  nouns: [{ id: "book", sg: "book", dual: "two-books", pl: "books", gender: "m", en: "book" }],
  audioPolicy: "components",
  rev: 0,
  created: 0,
  updated: 1000,
  ...over,
});

test("a teacher's numbers are saved, read back, and minted an id of their own", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rania" } });
  const key = made.json.key;

  assert.deepEqual((await api("/api/courses?action=my-systems", { key })).json.systems, []);

  const saved = await api("/api/courses?action=save-system", {
    method: "POST", key, body: { kind: "numbers", system: numberSystem() },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.match(saved.json.system.id, /^n[0-9a-f]{12}$/);
  assert.equal(saved.json.system.owner, made.json.user.handle);
  assert.equal(saved.json.system.rev, 1, "the first save is revision one");
  assert.equal(saved.json.system.lexemes["unit.1"].forms.f, "one-f");
  assert.equal(saved.json.system.overrides["300"].text, "three-hundred");

  /* Saved again under the same id, not a second system: one per teacher
     per language is the whole filing rule. */
  const again = await api("/api/courses?action=save-system", {
    method: "POST", key,
    body: { kind: "numbers", system: { ...numberSystem(), rev: saved.json.system.rev } },
  });
  assert.equal(again.json.system.id, saved.json.system.id);
  assert.equal(again.json.system.rev, 2);
  assert.equal(again.json.system.created, saved.json.system.created, "the day it was made does not move");

  const listed = await api("/api/courses?action=my-systems", { key });
  assert.equal(listed.json.systems.length, 1);
  assert.equal(listed.json.systems[0].id, saved.json.system.id);

  /* And a clock is a second document beside it, pointing at the first. */
  const time = await api("/api/courses?action=save-system", {
    method: "POST", key,
    body: {
      kind: "times",
      system: {
        id: "", languageId: "ar-PS", numberSystemId: saved.json.system.id,
        lexemes: { "hour.word": { slot: "hour.word", forms: { standalone: "hour" } } },
        minuteNoun: { id: "minute", sg: "minute", pl: "minutes", gender: "f", en: "minute" },
        minuteExprs: { 15: { text: "quarter", refHour: "same" } },
        periods: [], clock: "12h", overrides: {}, audioPolicy: "components",
        rev: 0, created: 0, updated: 1000,
      },
    },
  });
  assert.equal(time.status, 200, time.text);
  assert.match(time.json.system.id, /^t[0-9a-f]{12}$/);
  assert.equal(time.json.system.numberSystemId, saved.json.system.id);
  assert.equal((await api("/api/courses?action=my-systems", { key })).json.systems.length, 2);
});

/*
 * What a build before the number system stored on a number card.
 *
 * Written onto the record rather than sent, because the server does not
 * take a `value` from anybody any more: there are no parts to be one of.
 * A value already there is kept and read — which is the whole of what the
 * lift below has to work from — so this is how a card written by the old
 * screen is put in front of it.
 * @param {string} id @param {number} value
 */
async function storeValue(/** @type {string} */ id, /** @type {number} */ value) {
  const { getStore } = await import("../server/store.js");
  const store = getStore("arabic-courses");
  const card = JSON.parse(must(await store.get(`card:${id}`), `card ${id}`));
  await store.set(`card:${id}`, JSON.stringify({ ...card, value }));
}

test("a teacher who filled in the old Numbers screen finds their words in the new one", async () => {
  /*
   * A lift on read, in the mould every other migration here is: it runs
   * the first time the screen is opened, it builds a system where there
   * is none, and it deletes nothing. The cards stay where they are, with
   * their recordings and every student's progress on them; they are
   * marked as having been read, and a later release takes them.
   */
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Huda" } });
  const key = made.json.key;

  /* The old shape: a card per part, findable by the value on it. */
  const written = [];
  for (const [value, word, feminine] of [
    [1, "wahad", "wahde"],
    [2, "tnen", "tinten"],
    [20, "ishrin", ""],
    [100, "miyye", ""],
    [300, "tultmiyye", ""],
  ]) {
    /** @type {Record<string, any>[]} */
    const forms = [{ ar: word, en: String(value), lat: "" }];
    if (feminine) forms.push({ ar: feminine, en: String(value), lat: "", row: "counted", col: "feminine" });
    const saved = await api("/api/courses?action=save-card", {
      method: "POST", key,
      body: { card: { id: "", lang: "ar-PS", forms, category: "number" }, decks: [] },
    });
    assert.equal(saved.status, 200, saved.text);
    await storeValue(saved.json.card.id, Number(value));
    written.push(saved.json.card.id);
  }

  const first = await api("/api/courses?action=my-systems", { key });
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.systems.length, 1, "opening the screen built one");
  const sys = first.json.systems[0];
  assert.equal(sys.languageId, "ar-PS");
  assert.equal(sys.lexemes["unit.1"].forms.standalone, "wahad");
  assert.equal(sys.lexemes["unit.1"].forms.f, "wahde", "and the cell came across as a face");
  assert.equal(sys.lexemes["ten.20"].forms.standalone, "ishrin");
  assert.equal(sys.lexemes["hundred.1"].forms.standalone, "miyye");
  /* Three hundred is one word in this dialect and always was, so it is a
     number the teacher wrote out rather than a box. */
  assert.equal(sys.overrides["300"].text, "tultmiyye");
  /* And every box says which card it came from, which is what lets a
     device hand a learner's year on a word to the card that replaces it. */
  assert.equal(sys.migratedFrom["unit.1"], written[0]);
  assert.equal(sys.migratedFrom["override:300"], written[4]);

  /* Nothing was deleted, and the cards say they have been read. */
  const cards = await api("/api/courses?action=my-cards", { key });
  assert.equal(cards.json.cards.length, written.length, "every card is still there");
  for (const card of cards.json.cards) assert.equal(card.derived, true, `${card.id} should be marked`);

  /* Run again and nothing happens: a system that exists is never rebuilt. */
  const again = await api("/api/courses?action=my-systems", { key });
  assert.equal(again.json.systems.length, 1);
  assert.equal(again.json.systems[0].id, sys.id);
  assert.deepEqual(again.json.systems[0].lexemes, sys.lexemes);

  /* And a correction made afterwards is not undone by opening it again. */
  await api("/api/courses?action=save-system", {
    method: "POST", key,
    body: {
      kind: "numbers",
      system: { ...sys, rev: sys.rev, lexemes: { ...sys.lexemes, "ten.20": { slot: "ten.20", forms: { standalone: "ishreen" } } } },
    },
  });
  const after = await api("/api/courses?action=my-systems", { key });
  assert.equal(after.json.systems[0].lexemes["ten.20"].forms.standalone, "ishreen");
});

test("a teacher with no number cards gets no system built for them", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Sami" } });
  const key = made.json.key;
  await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", lang: "ar-PS", forms: [{ ar: "kitaab", en: "book", lat: "" }] }, decks: [] },
  });
  assert.deepEqual((await api("/api/courses?action=my-systems", { key })).json.systems, []);
});

test("a number card keeps what it was worth, and no save can give one a new value", async () => {
  /*
   * The one field of the old model that is kept rather than dropped.
   *
   * Nothing writes a value any more — there are no parts to be one of —
   * so a value that arrives is ignored like any other field nobody
   * writes. But the value already on a card is the only record of which
   * box it fills, and it is what the lift reads. Stripping it on the next
   * save would pull the mapping out from under the migration, and a
   * teacher fixing a typo on the word for forty would be the one who did
   * it.
   */
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nabil" } });
  const key = made.json.key;
  const first = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: { id: "", lang: "ar-PS", forms: [{ ar: "arba3iin", en: "40", lat: "" }], value: 40 }, decks: [] },
  });
  assert.equal(first.json.card.value, undefined, "a value sent in is not taken");

  await storeValue(first.json.card.id, 40);
  const again = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: {
      card: { id: first.json.card.id, lang: "ar-PS", forms: [{ ar: "arba3een", en: "40", lat: "" }], value: 70 },
      decks: [],
    },
  });
  assert.equal(again.status, 200, again.text);
  assert.equal(again.json.card.value, 40, "the stored value survives a save, and cannot be changed by one");
  assert.equal(leadOf(again.json.card).ar, "arba3een", "and the rest of the card is saved as sent");
});

test("a class whose teacher never opened the screen still gets their numbers", async () => {
  /*
   * The migration runs from the students' own poll as well, because a
   * teacher who never opens the number screen would otherwise leave a
   * class with a shelf of number cards and no system to build a range
   * out of. Once per person, ever — the index is stamped — so the poll
   * that every device makes every few minutes does not read a whole
   * collection each time.
   */
  const teacher = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Rania" } });
  const tKey = teacher.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key: tKey, body: { adminKey: ADMIN_KEY } });
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key: tKey, body: { title: "Numbers", lang: "ar-PS" },
  });
  const deckId = deck.json.deck.id;
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key: tKey, body: { title: "Arabic 1", language: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key: tKey, body: { deckId, courseId: course.json.course.id },
  });
  for (const [value, word] of [[1, "wahad"], [2, "tnen"], [20, "ishrin"]]) {
    const saved = await api("/api/courses?action=save-card", {
      method: "POST", key: tKey,
      body: {
        card: { id: "", lang: "ar-PS", forms: [{ ar: word, en: String(value), lat: "" }], category: "number" },
        decks: [deckId],
      },
    });
    await storeValue(saved.json.card.id, Number(value));
  }

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dana" } });
  const sKey = student.json.key;
  await api("/api/courses?action=assign-student", {
    method: "POST", key: tKey,
    body: { courseId: course.json.course.id, handle: student.json.user.handle },
  });

  const material = await api("/api/courses?action=my-material", { key: sKey });
  assert.equal(material.status, 200, material.text);
  const systems = material.json.systems || [];
  assert.equal(systems.length, 1, "the student's own poll read the teacher's cards across");
  assert.equal(systems[0].lexemes["ten.20"].forms.standalone, "ishrin");
  /* And the teacher opening the screen afterwards finds the same one
     rather than a second. */
  const mine = await api("/api/courses?action=my-systems", { key: tKey });
  assert.equal(mine.json.systems.length, 1);
  assert.equal(mine.json.systems[0].id, systems[0].id);
});

test("a save built on an older copy is refused, and hands back the one that is there", async () => {
  /*
   * Whole-document last-write-wins, said out loud. Two teachers editing
   * one lexicon across a sync would otherwise lose an afternoon in
   * silence: merging them field by field would make a lexicon neither
   * wrote, and overwriting would make one of them wonder where their work
   * went. Refusing is the third answer, and the only one that can be
   * explained to the person it happened to.
   */
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Faris" } });
  const key = made.json.key;

  const first = await api("/api/courses?action=save-system", {
    method: "POST", key, body: { kind: "numbers", system: numberSystem() },
  });
  assert.equal(first.status, 200, first.text);
  await api("/api/courses?action=save-system", {
    method: "POST", key, body: { kind: "numbers", system: numberSystem({ rev: 1 }) },
  });

  /* A save from a device that loaded revision one and never saw the
     second. Its clock is irrelevant, which is the point: what it is
     refused on is a revision it has actually seen. */
  const stale = await api("/api/courses?action=save-system", {
    method: "POST", key,
    body: {
      kind: "numbers",
      system: numberSystem({
        rev: 1,
        updated: Date.now() + 60 * 60 * 1000,
        lexemes: { "unit.1": { slot: "unit.1", forms: { standalone: "wrong" } } },
      }),
    },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.error, "stale-system");
  assert.equal(stale.json.system.lexemes["unit.1"].forms.standalone, "one", "and it is the live one");

  /* The document on the site is untouched by the refusal. */
  const held = (await api("/api/courses?action=my-systems", { key })).json.systems[0];
  assert.equal(held.lexemes["unit.1"].forms.standalone, "one");
  assert.equal(held.rev, 2, "a refused save is not a revision");
});

test("a system that is not one is refused rather than stored half-read", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Dana" } });
  const key = made.json.key;
  for (const system of [null, 7, "words", {}, { id: "x" }, { languageId: "" }]) {
    const res = await api("/api/courses?action=save-system", {
      method: "POST", key, body: { kind: "numbers", system },
    });
    assert.equal(res.status, 400, JSON.stringify(system));
    assert.ok(["not-a-system", "no-language"].includes(res.json.error), res.text);
  }
  assert.deepEqual((await api("/api/courses?action=my-systems", { key })).json.systems, []);
});

test("a teacher's numbers reach their students, and the version moves when a word changes", async () => {
  const teacher = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Maha" } });
  const tkey = teacher.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key: tkey, body: { adminKey: ADMIN_KEY } });
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key: tkey, body: { title: "Arabic 1", language: "ar-PS" },
  });
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key: tkey, body: { title: "Lesson 1", description: "", lang: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key: tkey, body: { deckId: deck.json.deck.id, courseId: course.json.course.id },
  });

  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Nour" } });
  const skey = student.json.key;
  await api("/api/courses?action=join-course", {
    method: "POST", key: skey, body: { code: course.json.course.code },
  });

  const before = await api("/api/courses?action=my-material", { key: skey });
  assert.equal(before.status, 200, before.text);
  assert.deepEqual(before.json.systems, [], "nothing yet");

  await api("/api/courses?action=save-system", {
    method: "POST", key: tkey, body: { kind: "numbers", system: numberSystem() },
  });

  const after = await api("/api/courses?action=my-material", { key: skey });
  assert.equal(after.json.systems.length, 1, "the student has the teacher's numbers");
  assert.equal(after.json.systems[0].lexemes["unit.1"].forms.standalone, "one");
  assert.notEqual(after.json.version, before.json.version, "and the version says something moved");

  /* The whole point of folding the revision in: correcting one word moves
     nothing else on the site, so without it the correction reaches nobody. */
  await api("/api/courses?action=save-system", {
    method: "POST", key: tkey,
    body: {
      kind: "numbers",
      system: numberSystem({
        rev: 1,
        lexemes: { "unit.1": { slot: "unit.1", forms: { standalone: "wahad" } } },
      }),
    },
  });
  const corrected = await api("/api/courses?action=my-material", { key: skey });
  assert.notEqual(corrected.json.version, after.json.version, "a corrected word moves the version");
  assert.equal(corrected.json.systems[0].lexemes["unit.1"].forms.standalone, "wahad");

  /* And an unchanged site still answers `unchanged`, so the poll stays cheap. */
  const nothing = await api(
    `/api/courses?action=my-material&version=${encodeURIComponent(corrected.json.version)}`,
    { key: skey },
  );
  assert.equal(nothing.json.unchanged, true);
});

test("a system in a language nobody is learning is not sent", async () => {
  const teacher = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Tariq" } });
  const tkey = teacher.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key: tkey, body: { adminKey: ADMIN_KEY } });
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key: tkey, body: { title: "Arabic 2", language: "ar-PS" },
  });
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key: tkey, body: { title: "Lesson 1", description: "", lang: "ar-PS" },
  });
  await api("/api/courses?action=attach-deck", {
    method: "POST", key: tkey, body: { deckId: deck.json.deck.id, courseId: course.json.course.id },
  });
  const student = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Lina" } });
  await api("/api/courses?action=join-course", {
    method: "POST", key: student.json.key, body: { code: course.json.course.code },
  });

  await api("/api/courses?action=save-system", {
    method: "POST", key: tkey, body: { kind: "numbers", system: numberSystem() },
  });
  await api("/api/courses?action=save-system", {
    method: "POST", key: tkey,
    body: { kind: "numbers", system: numberSystem({ languageId: "he-IL" }) },
  });

  const got = await api("/api/courses?action=my-material", { key: student.json.key });
  assert.deepEqual(
    got.json.systems.map((/** @type {any} */ s) => s.languageId),
    ["ar-PS"],
    "a teacher's Hebrew does not follow their Arabic students around",
  );
});

test("a backup holds a teacher's numbers, and a restore puts them back", async () => {
  const admin = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Yara" } });
  const key = admin.json.key;
  await api("/api/courses?action=claim-admin", { method: "POST", key, body: { adminKey: ADMIN_KEY } });

  const saved = await api("/api/courses?action=save-system", {
    method: "POST", key,
    body: {
      kind: "numbers",
      system: numberSystem({
        lexemes: {
          "unit.1": { slot: "unit.1", forms: { standalone: "one" }, audio: { standalone: [clipId(7)] } },
        },
      }),
    },
  });
  const id = saved.json.system.id;

  const manifest = await api("/api/courses?action=admin-backup-manifest", { key });
  const planned = manifest.json.manifest.plan.flatMap((/** @type {any} */ c) => c.keys);
  assert.ok(planned.includes(`numsys:${id}`), "the system is in the plan");
  assert.ok(
    planned.includes(`mysystems:${admin.json.user.handle}`),
    "and the index that says which system is which",
  );
  /* A recording a system refers to is reachable from nothing else, so a
     backup that did not read the systems would leave it out — the same
     bug a card's recordings had before clipsOfCard existed. */
  assert.ok(planned.includes(`clip:${clipId(7)}`), "and the recording it refers to");
  assert.ok(manifest.json.manifest.counts.systems >= 1, "and it is counted");

  const chunk = await api("/api/courses?action=admin-backup-chunk", {
    method: "POST", key, body: { keys: [`numsys:${id}`] },
  });
  const record = must(chunk.json.records[`numsys:${id}`], "the system in the chunk");
  assert.equal(record.lexemes["unit.1"].forms.standalone, "one");

  /* Deleted from the site, then put back from the file. */
  await api("/api/courses?action=delete-system", {
    method: "POST", key, body: { kind: "numbers", languageId: "ar-PS" },
  });
  assert.deepEqual((await api("/api/courses?action=my-systems", { key })).json.systems, []);

  const put = await api("/api/courses?action=admin-restore-chunk", {
    method: "POST", key,
    body: {
      records: {
        [`numsys:${id}`]: record,
        [`mysystems:${admin.json.user.handle}`]: { numbers: { "ar-PS": id }, times: {} },
      },
    },
  });
  assert.equal(put.status, 200, put.text);
  assert.equal(put.json.written, 2, "a prefix the allowlist has not got is skipped in silence");
  const back = (await api("/api/courses?action=my-systems", { key })).json.systems;
  assert.equal(back.length, 1);
  assert.equal(back[0].lexemes["unit.1"].forms.standalone, "one");
});

test("closing an account takes its numbers with it", async () => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Omar" } });
  const key = made.json.key;
  const saved = await api("/api/courses?action=save-system", {
    method: "POST", key, body: { kind: "numbers", system: numberSystem() },
  });
  const id = saved.json.system.id;

  const closed = await api("/api/courses?action=delete-account", { method: "POST", key, body: {} });
  assert.equal(closed.status, 200, closed.text);

  const { getStore } = await import("../server/store.js");
  const store = getStore("arabic-courses");
  assert.equal(await store.get(`numsys:${id}`, { type: "text" }), null, "the system is gone");
  assert.equal(
    await store.get(`mysystems:${made.json.user.handle}`, { type: "text" }),
    null,
    "and the index that pointed at it",
  );
});

test("an unreadable record fails the request rather than reading as absent", async () => {
  /*
   * Every list on the courses endpoint filters out what it could not read
   * and answers `ok`, so one unreadable record came back as a complete
   * answer with that record missing — and on a student's device a course
   * card missing from the answer is a card the teacher withdrew: removed,
   * and marked deleted so the next sync removes it from their other
   * devices too. A disk hiccup destroyed a learner's progress on a whole
   * deck, everywhere.
   */
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName: "Ziad" } });
  const key = made.json.key;
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title: "Lesson 1", description: "", lang: "ar-PS" },
  });
  assert.equal(deck.status, 200, deck.text);

  const { getStore } = await import("../server/store.js");
  const store = getStore("arabic-courses");
  await store.set(`deck:${deck.json.deck.id}`, "{ not json");

  const listed = await api("/api/courses?action=my-decks", { key });
  assert.equal(listed.status, 500, "the request fails");
  assert.equal(listed.json.error, "server");
  assert.match(String(listed.json.detail), /unreadable/, "and says what could not be read");

  /*
   * And then it is put back, because every test in this file shares one
   * store: a deck left unreadable makes every later listing fail for
   * everybody, which is the assertion above coming true somewhere nobody
   * was looking. It cost an afternoon once.
   */
  await store.set(`deck:${deck.json.deck.id}`, JSON.stringify(deck.json.deck));
  const after = await api("/api/courses?action=my-decks", { key });
  assert.equal(after.status, 200, `the store was left broken: ${after.text.slice(0, 200)}`);
});

/* ==================================================================
   The actions nothing had ever requested

   Ten of the endpoint's forty-six, found by reading which ones the tests
   never named: a teacher deleting or detaching a deck, a recording being
   uploaded, the two ways material is listed, and five things an
   administrator can do. Every one has a wrapper in `src/courses-api.ts`,
   so every one is reached by the app. Two of them — the deck pair — are
   the actions the progress-durability audit found destroying a learner's
   work, which is the strongest argument for their being here.
   ================================================================== */

/** An account, and its key. */
const someone = async (/** @type {string} */ displayName) => {
  const made = await api("/api/courses?action=signup", { method: "POST", body: { displayName } });
  assert.equal(made.status, 200, made.text);
  return { key: made.json.key, handle: made.json.user.handle };
};

/** An account that has claimed the admin key, which is what may make courses. */
const anAdmin = async (/** @type {string} */ displayName) => {
  const who = await someone(displayName);
  const claim = await api("/api/courses?action=claim-admin", {
    method: "POST", key: who.key, body: { adminKey: ADMIN_KEY },
  });
  assert.equal(claim.status, 200, claim.text);
  return who;
};

/** A deck with one card in it, owned by whoever's key this is. */
const aDeck = async (/** @type {string} */ key, /** @type {string} */ title) => {
  const deck = await api("/api/courses?action=create-deck", {
    method: "POST", key, body: { title, lang: "ar-PS" },
  });
  assert.equal(deck.status, 200, deck.text);
  const id = deck.json.deck.id;
  const card = await api("/api/courses?action=save-card", {
    method: "POST", key,
    body: { card: carded({ ar: "كتاب", en: "book", lat: "kitaab" }), decks: [id] },
  });
  assert.equal(card.status, 200, card.text);
  return { id, cardId: card.json.card.id };
};

/** A course, made by an administrator. */
const aCourse = async (/** @type {string} */ key, /** @type {string} */ title) => {
  const course = await api("/api/courses?action=create-course", {
    method: "POST", key, body: { title, language: "ar-PS" },
  });
  assert.equal(course.status, 200, course.text);
  return course.json.course;
};

/* ---- decks: taking one away, and taking it out of a course ---- */

test("deleting a deck takes it off every course, and leaves the cards in the library", () => {
  return (async () => {
    const teacher = await anAdmin("Nadia");
    const { id: deckId, cardId } = await aDeck(teacher.key, "Lesson 1");
    const course = await aCourse(teacher.key, "Arabic 1");
    await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId, courseId: course.id },
    });

    const gone = await api("/api/courses?action=delete-deck", {
      method: "POST", key: teacher.key, body: { deckId },
    });
    assert.equal(gone.status, 200, gone.text);

    /* Off the course it was attached to — and the course itself stays. */
    const decks = await api(`/api/courses?action=course-decks&course=${course.id}`, { key: teacher.key });
    assert.equal(decks.status, 200, decks.text);
    assert.deepEqual(decks.json.decks.map((/** @type {any} */ d) => d.id), [],
      "the deleted deck is still listed against its course");

    /* Out of the teacher's own list. */
    const mine = await api("/api/courses?action=my-decks", { key: teacher.key });
    assert.ok(!mine.json.decks.some((/** @type {any} */ d) => d.id === deckId), "still in my decks");

    /* And the card it held is the teacher's own and stays theirs: a deck
       is a folder, not a bag the cards live inside. */
    const cards = await api("/api/courses?action=my-cards", { key: teacher.key });
    assert.ok(cards.json.cards.some((/** @type {any} */ c) => c.id === cardId),
      "deleting the deck took its cards with it");
  })();
});

test("a deck nobody owns and a deck somebody else owns are both refused", () => {
  return (async () => {
    const mine = await anAdmin("Omar");
    const stranger = await someone("Rania");
    const { id: deckId } = await aDeck(mine.key, "Mine");

    const missing = await api("/api/courses?action=delete-deck", {
      method: "POST", key: mine.key, body: { deckId: "dnope" },
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.json.error, "no-deck");

    const theirs = await api("/api/courses?action=delete-deck", {
      method: "POST", key: stranger.key, body: { deckId },
    });
    assert.equal(theirs.status, 403);
    assert.equal(theirs.json.error, "not-yours");
    /* And it is still there, which is what a refusal has to mean. */
    const still = await api("/api/courses?action=my-decks", { key: mine.key });
    assert.ok(still.json.decks.some((/** @type {any} */ d) => d.id === deckId));
  })();
});

test("detaching a deck leaves the deck alone, and only the course loses it", () => {
  return (async () => {
    const teacher = await anAdmin("Hana");
    const { id: deckId, cardId } = await aDeck(teacher.key, "Lesson 2");
    const one = await aCourse(teacher.key, "Arabic A");
    const two = await aCourse(teacher.key, "Arabic B");
    for (const c of [one, two]) {
      await api("/api/courses?action=attach-deck", {
        method: "POST", key: teacher.key, body: { deckId, courseId: c.id },
      });
    }

    const off = await api("/api/courses?action=detach-deck", {
      method: "POST", key: teacher.key, body: { deckId, courseId: one.id },
    });
    assert.equal(off.status, 200, off.text);

    const gone = await api(`/api/courses?action=course-decks&course=${one.id}`, { key: teacher.key });
    assert.deepEqual(gone.json.decks.map((/** @type {any} */ d) => d.id), []);
    /* The other course keeps it: detaching is about one link, not the deck. */
    const kept = await api(`/api/courses?action=course-decks&course=${two.id}`, { key: teacher.key });
    assert.deepEqual(kept.json.decks.map((/** @type {any} */ d) => d.id), [deckId]);
    /* And the deck and its cards are untouched. */
    const cards = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: teacher.key });
    assert.equal(cards.status, 200, cards.text);
    assert.deepEqual(cards.json.cards.map((/** @type {any} */ c) => c.id), [cardId]);
  })();
});

test("a teacher of neither the deck nor the course cannot attach one to the other", () => {
  return (async () => {
    /*
     * Both halves are asked, and until now every teacher in these tests
     * was an administrator — which passes the second half whatever the
     * first says, so the check could have been inverted and nothing would
     * have noticed. This one teaches a course and owns a deck, and the
     * course and the deck are not the same pair.
     */
    const boss = await anAdmin("Layla");
    const teacher = await someone("Samir");
    const mine = await aDeck(teacher.key, "Samir's deck");
    const hers = await aDeck(boss.key, "Layla's deck");
    const theirCourse = await aCourse(boss.key, "Taught by Samir");
    const otherCourse = await aCourse(boss.key, "Taught by nobody");
    await api("/api/courses?action=assign-teacher", {
      method: "POST", key: boss.key, body: { courseId: theirCourse.id, handle: teacher.handle },
    });

    /* Their own deck onto a course they do not teach. */
    const notTeaching = await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId: mine.id, courseId: otherCourse.id },
    });
    assert.equal(notTeaching.status, 403, notTeaching.text);
    assert.equal(notTeaching.json.error, "not-teaching");

    /* Somebody else's deck onto a course they do teach. */
    const notTheirs = await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId: hers.id, courseId: theirCourse.id },
    });
    assert.equal(notTheirs.status, 403, notTheirs.text);
    assert.equal(notTheirs.json.error, "not-yours");

    /* And with both halves true it goes through, so the refusals above are
       the rule doing its job rather than the endpoint being shut. */
    const allowed = await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId: mine.id, courseId: theirCourse.id },
    });
    assert.equal(allowed.status, 200, allowed.text);
  })();
});

/* ---- what a course holds, and who may look ---- */

test("a course's decks are listed to the people in it and to nobody else", () => {
  return (async () => {
    const teacher = await anAdmin("Zaid");
    const student = await someone("Maya");
    const outsider = await someone("Faris");
    const { id: deckId } = await aDeck(teacher.key, "Week 1");
    const course = await aCourse(teacher.key, "Arabic 2");
    await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId, courseId: course.id },
    });
    await api("/api/courses?action=assign-student", {
      method: "POST", key: teacher.key, body: { courseId: course.id, handle: student.handle },
    });

    const asStudent = await api(`/api/courses?action=course-decks&course=${course.id}`, { key: student.key });
    assert.equal(asStudent.status, 200, asStudent.text);
    assert.deepEqual(asStudent.json.decks.map((/** @type {any} */ d) => d.id), [deckId]);
    assert.equal(asStudent.json.decks[0].ownerName, "Zaid", "who wrote it");
    assert.equal(asStudent.json.decks[0].cardCount, 1, "and how much is in it");
    /* The join code is how somebody gets in, so it is never handed to
       somebody who is already in. */
    assert.equal(asStudent.json.course.code, undefined);

    const asOutsider = await api(`/api/courses?action=course-decks&course=${course.id}`, { key: outsider.key });
    assert.equal(asOutsider.status, 403);
    assert.equal(asOutsider.json.error, "not-in-course");

    const missing = await api("/api/courses?action=course-decks&course=cnope", { key: teacher.key });
    assert.equal(missing.status, 404);
  })();
});

test("a deck's cards are readable by its owner and by the course it is in, and not by a stranger", () => {
  return (async () => {
    const teacher = await anAdmin("Bilal");
    const student = await someone("Dina");
    const stranger = await someone("Kamal");
    const { id: deckId, cardId } = await aDeck(teacher.key, "Week 2");
    const course = await aCourse(teacher.key, "Arabic 3");

    const asOwner = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: teacher.key });
    assert.equal(asOwner.status, 200, asOwner.text);
    assert.deepEqual(asOwner.json.cards.map((/** @type {any} */ c) => c.id), [cardId]);
    assert.ok(asOwner.json.version, "with the deck's version, which is what a refresh compares");

    /* Before it is attached, somebody in the course is a stranger to it. */
    const tooEarly = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: student.key });
    assert.equal(tooEarly.status, 403);

    await api("/api/courses?action=attach-deck", {
      method: "POST", key: teacher.key, body: { deckId, courseId: course.id },
    });
    await api("/api/courses?action=assign-student", {
      method: "POST", key: teacher.key, body: { courseId: course.id, handle: student.handle },
    });
    const asStudent = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: student.key });
    assert.equal(asStudent.status, 200, asStudent.text);
    assert.deepEqual(asStudent.json.cards.map((/** @type {any} */ c) => c.id), [cardId]);

    const asStranger = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: stranger.key });
    assert.equal(asStranger.status, 403);
    assert.equal(asStranger.json.error, "no-access");

    const missing = await api("/api/courses?action=deck-cards&deck=dnope", { key: teacher.key });
    assert.equal(missing.status, 404);
  })();
});

/* ---- recordings ---- */

test("a recording is stored under the hash of its own bytes, and stored once", () => {
  return (async () => {
    const teacher = await anAdmin("Suha");
    const hash = "b".repeat(64);
    const data = "data:audio/webm;base64,AAAABBBB";

    const first = await api("/api/courses?action=put-clip", {
      method: "POST", key: teacher.key, body: { hash, data },
    });
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json.deduplicated, false, "the first upload stores it");

    const again = await api("/api/courses?action=put-clip", {
      method: "POST", key: teacher.key, body: { hash, data },
    });
    assert.equal(again.json.deduplicated, true, "and the second says it was already here");

    const back = await api(`/api/courses?action=clip&hash=${hash}`, { key: teacher.key });
    assert.equal(back.status, 200, back.text);
    assert.equal(back.json.data, data);
  })();
});

test("a recording with no name, no data or too much of it is refused", () => {
  return (async () => {
    const teacher = await anAdmin("Ghada");
    const data = "data:audio/webm;base64,AAAA";

    const unnamed = await api("/api/courses?action=put-clip", {
      method: "POST", key: teacher.key, body: { hash: "not-a-hash", data },
    });
    assert.equal(unnamed.status, 400);
    assert.equal(unnamed.json.error, "bad-hash");

    /* Nothing to store, and more than may be stored, are one refusal: an
       empty clip is as useless as an enormous one, and neither is worth a
       key of its own. */
    const empty = await api("/api/courses?action=put-clip", {
      method: "POST", key: teacher.key, body: { hash: "c".repeat(64), data: "" },
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.json.error, "bad-clip");

    const huge = await api("/api/courses?action=put-clip", {
      method: "POST", key: teacher.key, body: { hash: "d".repeat(64), data: "x".repeat(1024 * 1024 + 1) },
    });
    assert.equal(huge.status, 400, huge.text);
    assert.equal(huge.json.error, "bad-clip");

    /* And neither was written. */
    for (const h of ["c".repeat(64), "d".repeat(64)]) {
      const back = await api(`/api/courses?action=clip&hash=${h}`, { key: teacher.key });
      assert.equal(back.status, 404, `${h} was stored anyway`);
    }
  })();
});

/* ---- what an administrator can do ---- */

test("removing a person takes their account, their key and their place on every roster", () => {
  return (async () => {
    const boss = await anAdmin("Iman");
    const going = await someone("Tariq");
    const staying = await someone("Nour");
    const course = await aCourse(boss.key, "Arabic 4");
    for (const who of [going, staying]) {
      await api("/api/courses?action=assign-student", {
        method: "POST", key: boss.key, body: { courseId: course.id, handle: who.handle },
      });
    }

    const gone = await api("/api/courses?action=admin-delete-user", {
      method: "POST", key: boss.key, body: { handle: going.handle },
    });
    assert.equal(gone.status, 200, gone.text);

    /* Their key stops working, which is the part that matters most. */
    const tries = await api("/api/courses?action=whoami", { key: going.key });
    assert.equal(tries.status, 401);

    /* Off the roster — and the person beside them is still on it, which is
       what says the filter took the right one away. */
    const roster = await api("/api/courses?action=admin-overview", { key: boss.key });
    const row = must(
      overviewOf(roster).courses.find((/** @type {any} */ c) => c.id === course.id),
      "the course",
    );
    assert.ok(!row.students.includes(going.handle), "still on the roster");
    assert.ok(row.students.includes(staying.handle), "and it took the wrong person off");
  })();
});

test("removing somebody who is not there says so, and your own account has its own door", () => {
  return (async () => {
    const boss = await anAdmin("Rami");
    const missing = await api("/api/courses?action=admin-delete-user", {
      method: "POST", key: boss.key, body: { handle: "nobody-0000" },
    });
    assert.equal(missing.status, 404, missing.text);
    assert.equal(missing.json.error, "no-user");

    /* Closing your own account is the same walk and needs no administrator,
       so this one is pointed at the door with its own name. */
    const self = await api("/api/courses?action=admin-delete-user", {
      method: "POST", key: boss.key, body: { handle: boss.handle },
    });
    assert.equal(self.status, 400);
    assert.equal(self.json.error, "use-delete-account");
    /* And they are still here. */
    assert.equal((await api("/api/courses?action=whoami", { key: boss.key })).status, 200);
  })();
});

test("removing a course releases its decks rather than destroying them", () => {
  return (async () => {
    const boss = await anAdmin("Salma");
    const { id: deckId, cardId } = await aDeck(boss.key, "Week 3");
    const course = await aCourse(boss.key, "Arabic 5");
    await api("/api/courses?action=attach-deck", {
      method: "POST", key: boss.key, body: { deckId, courseId: course.id },
    });

    const gone = await api("/api/courses?action=admin-delete-course", {
      method: "POST", key: boss.key, body: { courseId: course.id },
    });
    assert.equal(gone.status, 200, gone.text);

    const overview = await api("/api/courses?action=admin-overview", { key: boss.key });
    assert.ok(!overviewOf(overview).courses.some((/** @type {any} */ c) => c.id === course.id));

    /* The deck belongs to the teacher who made it, and so do its cards. */
    const mine = await api("/api/courses?action=my-decks", { key: boss.key });
    const deck = must(mine.json.decks.find((/** @type {any} */ d) => d.id === deckId), "the deck");
    assert.equal(deck.cardCount, 1);
    const cards = await api(`/api/courses?action=deck-cards&deck=${deckId}`, { key: boss.key });
    assert.deepEqual(cards.json.cards.map((/** @type {any} */ c) => c.id), [cardId]);

    const missing = await api("/api/courses?action=admin-delete-course", {
      method: "POST", key: boss.key, body: { courseId: "cnope" },
    });
    assert.equal(missing.status, 404);
  })();
});

test("a key can be reissued, and the old one stops working that moment", () => {
  return (async () => {
    const boss = await anAdmin("Widad");
    const who = await someone("Basim");
    const before = await api("/api/courses?action=whoami", { key: who.key });
    assert.equal(before.status, 200);

    const issued = await api("/api/courses?action=admin-reissue-key", {
      method: "POST", key: boss.key, body: { handle: who.handle },
    });
    assert.equal(issued.status, 200, issued.text);
    assert.ok(issued.json.key, "a new key comes back, since nobody can look one up later");
    assert.notEqual(issued.json.key, who.key);

    assert.equal((await api("/api/courses?action=whoami", { key: who.key })).status, 401,
      "the old key still signs in");
    const now = await api("/api/courses?action=whoami", { key: issued.json.key });
    assert.equal(now.status, 200, now.text);
    assert.equal(now.json.user.handle, who.handle, "and it is the same person");

    const missing = await api("/api/courses?action=admin-reissue-key", {
      method: "POST", key: boss.key, body: { handle: "nobody-0000" },
    });
    assert.equal(missing.status, 404);
  })();
});

test("one of a course's two join codes can be replaced without disturbing the other", () => {
  return (async () => {
    /* Retiring a leaked teacher code must not turn away a whole class. */
    const boss = await anAdmin("Hadil");
    const course = await aCourse(boss.key, "Arabic 6");
    const overview = () => api("/api/courses?action=admin-overview", { key: boss.key })
      .then((r) => must(overviewOf(r).courses.find((/** @type {any} */ c) => c.id === course.id), "the course"));

    const was = await overview();
    const swapped = await api("/api/courses?action=admin-new-code", {
      method: "POST", key: boss.key, body: { courseId: course.id, which: "teacher" },
    });
    assert.equal(swapped.status, 200, swapped.text);
    assert.equal(swapped.json.which, "teacherCode", "it answers with the field it replaced");

    const now = await overview();
    assert.notEqual(now.teacherCode, was.teacherCode, "the teacher code is the same as it was");
    assert.equal(now.code, was.code, "and the student code was replaced too");

    /* The retired code no longer lets anybody in. */
    const student = await someone("Yusuf");
    const stale = await api("/api/courses?action=join-course", {
      method: "POST", key: student.key, body: { code: was.teacherCode },
    });
    assert.equal(stale.status, 404, stale.text);
    /* And the new one does. */
    const fresh = await api("/api/courses?action=join-course", {
      method: "POST", key: student.key, body: { code: now.teacherCode },
    });
    assert.equal(fresh.status, 200, fresh.text);
  })();
});

test("a course made before there was a language to set can be given one", () => {
  return (async () => {
    const boss = await anAdmin("Manal");
    const course = await aCourse(boss.key, "Arabic 7");
    const set = await api("/api/courses?action=admin-course-language", {
      method: "POST", key: boss.key, body: { courseId: course.id, language: "he-IL" },
    });
    assert.equal(set.status, 200, set.text);
    assert.equal(set.json.language, "he-IL");

    const overview = await api("/api/courses?action=admin-overview", { key: boss.key });
    const row = must(
      overviewOf(overview).courses.find((/** @type {any} */ c) => c.id === course.id),
      "the course",
    );
    assert.equal(row.language, "he-IL");

    const blank = await api("/api/courses?action=admin-course-language", {
      method: "POST", key: boss.key, body: { courseId: course.id, language: "  " },
    });
    assert.equal(blank.status, 400);
    assert.equal(blank.json.error, "language-required");
  })();
});

test("none of the administrator's actions are open to somebody who is not one", () => {
  return (async () => {
    const boss = await anAdmin("Ahlam");
    const ordinary = await someone("Jamil");
    const course = await aCourse(boss.key, "Arabic 8");
    for (const [action, body] of /** @type {[string, any][]} */ ([
      ["admin-overview", null],
      ["admin-delete-user", { handle: boss.handle }],
      ["admin-delete-course", { courseId: course.id }],
      ["admin-reissue-key", { handle: boss.handle }],
      ["admin-new-code", { courseId: course.id }],
      ["admin-course-language", { courseId: course.id, language: "he-IL" }],
    ])) {
      const res = await api(`/api/courses?action=${action}`, {
        method: body ? "POST" : "GET", key: ordinary.key, ...(body ? { body } : {}),
      });
      assert.equal(res.status, 403, `${action} answered ${res.status}: ${res.text}`);
    }
    /* And the administrator is still there to prove the calls were real. */
    assert.equal((await api("/api/courses?action=whoami", { key: boss.key })).status, 200);
  })();
});

/* ---- the transport itself ---- */

test("a body past the limit is refused with an answer, not by hanging up", () => {
  return (async () => {
    /*
     * It used to destroy the socket, so the 413 the server then wrote had
     * nowhere to go and the client saw a connection reset — which it could
     * only report as "something went wrong". The rest of the body is read
     * and thrown away so the refusal can be written on a socket that is
     * still open.
     */
    const teacher = await anAdmin("Rawan");
    const res = await api("/api/courses?action=save-card", {
      method: "POST", key: teacher.key,
      body: { card: carded({ ar: "ك", en: "b", lat: "b", note: "x".repeat(12 * 1024 * 1024) }), decks: [] },
    });
    assert.equal(res.status, 413, res.text.slice(0, 200));
    assert.equal(res.json.error, "too-large");
    assert.match(res.type, /application\/json/);
  })();
});

test("a method the server does not serve is refused as JSON", () => {
  return (async () => {
    const res = await fetch(`${origin}/not-an-api-path`, { method: "PUT" });
    assert.equal(res.status, 405);
    assert.deepEqual(await res.json(), { error: "method" });
  })();
});

/* ---- recordings and documents on the sync endpoint ----

   Clips live under their own keys so a document sync does not have to
   carry them, and `?audio=` is how one is addressed. The three methods
   and the refusals were reached by nothing. */

test("a recording is written, read back and removed under its own key", async () => {
  const token = createHash("sha256").update("a clip passphrase").digest("hex");
  const id = "clip_abc-123";
  const data = "data:audio/webm;base64,AAAABBBB";

  const missing = await api(`/api/sync?audio=${id}`, { token });
  assert.equal(missing.status, 404, missing.text);
  assert.equal(missing.json.error, "not-found");

  const put = await api(`/api/sync?audio=${id}`, { method: "POST", token, body: { data } });
  assert.equal(put.status, 200, put.text);

  const got = await api(`/api/sync?audio=${id}`, { token });
  assert.equal(got.status, 200, got.text);
  assert.equal(got.json.data, data);
  assert.equal(got.json.id, id);

  /* A recording is keyed by the passphrase as well as its own id, so
     another person's token finds nothing under the same name. */
  const elsewhere = createHash("sha256").update("somebody else").digest("hex");
  const theirs = await api(`/api/sync?audio=${id}`, { token: elsewhere });
  assert.equal(theirs.status, 404);

  const gone = await api(`/api/sync?audio=${id}`, { method: "DELETE", token });
  assert.equal(gone.status, 200, gone.text);
  assert.equal((await api(`/api/sync?audio=${id}`, { token })).status, 404);
});

test("a recording with a name that is not one, or nothing in it, is refused", async () => {
  const token = createHash("sha256").update("another clip passphrase").digest("hex");

  const badId = await api("/api/sync?audio=has%20a%20space", { token });
  assert.equal(badId.status, 400);
  assert.equal(badId.json.error, "bad-id");

  const empty = await api("/api/sync?audio=c1", { method: "POST", token, body: { data: "" } });
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, "no-data");

  const notJson = await fetch(`${origin}/api/sync?audio=c1`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-token": token },
    body: "{ not json",
  });
  assert.equal(notJson.status, 400);
  assert.equal((await notJson.json()).error, "bad-json");
});

test("a recording past the limit is refused by size, and nothing is stored", async () => {
  const token = createHash("sha256").update("a third clip passphrase").digest("hex");
  const huge = await api("/api/sync?audio=big", {
    method: "POST", token, body: { data: "x".repeat(4 * 1024 * 1024 + 1) },
  });
  assert.equal(huge.status, 413, huge.text.slice(0, 120));
  assert.equal(huge.json.error, "too-large");
  assert.equal((await api("/api/sync?audio=big", { token })).status, 404, "it was stored anyway");
});

test("a document can be forgotten, which is how an old key is cleared", async () => {
  /* The one delete the app ever issues: a document left behind under a
     private key an older build used, once this device has synced under
     the shared one. */
  const token = createHash("sha256").update("a passphrase to forget").digest("hex");
  await api("/api/sync", { method: "POST", token, body: { data: { items: [{ id: "a" }] } } });
  assert.deepEqual((await api("/api/sync", { token })).json.data, { items: [{ id: "a" }] });

  const gone = await api("/api/sync", { method: "DELETE", token });
  assert.equal(gone.status, 200, gone.text);
  assert.deepEqual((await api("/api/sync", { token })).json, { etag: null, data: null });
});

test("a push that would empty a document that is not empty is refused, and says how much is there", async () => {
  /*
   * There is no legitimate way to reach it: a device with nothing on it
   * pulls before it pushes, so its merge adopts whatever is here. What is
   * left is a merge that lost everything, and one request would make that
   * permanent.
   */
  const token = createHash("sha256").update("a passphrase worth keeping").digest("hex");
  const first = await api("/api/sync", {
    method: "POST", token, body: { data: { items: [{ id: "a" }, { id: "b" }] } },
  });
  assert.equal(first.status, 200, first.text);

  const wipe = await api("/api/sync", {
    method: "POST", token, body: { etag: first.json.etag, data: { items: [] } },
  });
  assert.equal(wipe.status, 409, wipe.text);
  assert.equal(wipe.json.error, "would-empty");
  assert.equal(wipe.json.held, 2, "and says what it is holding");
  /* Nothing was written. */
  assert.equal((await api("/api/sync", { token })).json.data.items.length, 2);

  /* And a learner who has genuinely removed every card says so with the
     headstones, which is what lets the write through. */
  const said = await api("/api/sync", {
    method: "POST", token,
    body: { etag: first.json.etag, data: { items: [] }, allowEmpty: true },
  });
  assert.equal(said.status, 200, said.text);
  assert.deepEqual((await api("/api/sync", { token })).json.data.items, []);
});

test("a method the sync endpoint does not serve is refused as JSON", async () => {
  const token = createHash("sha256").update("a passphrase for a bad method").digest("hex");
  const res = await fetch(`${origin}/api/sync`, { method: "PATCH", headers: { "x-sync-token": token } });
  assert.equal(res.status, 405);
  assert.deepEqual(await res.json(), { error: "method" });
});
