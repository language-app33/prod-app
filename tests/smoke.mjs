/* Renders the real app in jsdom against a stubbed server, and checks that
   the paths changed in this round actually run: sync keyed to the sign-in
   key, my-material with a version, legacy document cleanup, sparse
   storage. Run with: node tests/smoke.mjs */
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import path from "node:path";
import { must } from "./helpers.mjs";

/*
 * One generator, seeded, for the whole walk.
 *
 * The app rolls a die in every place a session is built — which of the
 * cards that are equally due comes first, which two exercises a form gets,
 * which words fill a matching grid — and it all comes through Math.random.
 * So this harness answered a slightly different app on every run, and the
 * comments below record what that cost: a check that "failed about one run
 * in seven" and was loosened until it passed, and a handful of others
 * written to accept whichever tile came first.
 *
 * Seeded rather than frozen. A fixed sequence still varies *within* a run
 * — two sessions built a minute apart are still different sessions, which
 * is a thing this file checks — while being the same sequence on the next
 * run, so a failure here can be reproduced and a flake cannot be mistaken
 * for a fix. SMOKE_SEED takes another one, for when a walk should be tried
 * against several.
 *
 * The clock is left alone. Ids, `created` stamps and the save debounce all
 * read it, and a frozen one is a different kind of unreal.
 */
const SEED = Number(process.env.SMOKE_SEED || 20260916) >>> 0;
let rolling = SEED || 1;
Math.random = () => {
  /* Numerical Recipes' constants: a plain linear congruential generator,
     which is all this needs — nobody is drawing lottery numbers. */
  rolling = (Math.imul(rolling, 1664525) + 1013904223) >>> 0;
  return rolling / 4294967296;
};

/* Built inside the project so the bundle's bare "react" imports resolve to
   the project's node_modules. */
import { mkdirSync, rmSync } from "node:fs";
const out = path.resolve("tests/.smoke-build");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({
  entryPoints: [
    "src/ArabicTrainer.tsx",
    "src/storage.ts",
    "src/gallery.tsx",
    "src/shared.tsx",
    /* The teaching space is loaded lazily by the app and is not walked
       here, so the one screen in it worth driving is named on its own. */
    "src/number-system-editor.tsx",
  ],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: out,
  jsx: "automatic",
  platform: "browser",
  /* One React: the bundle imports the same copy the test renders with. */
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  logLevel: "silent",
  /* The same three vite freezes into a real build, so the version line is
     exercised here the way it actually ships rather than through its
     "no one defined this" fallback. */
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0.1"',
    __APP_VERSION__: '"abc1234"',
    __BUILT_AT__: '"2026-09-05T13:00:00.000Z"',
  },
});

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "https://taleb.test/",
  pretendToBeVisual: true,
});
const w = dom.window;

/*
 * The browser APIs jsdom does not bring, stood in for.
 *
 * Every one of these is a deliberate part-implementation: the app touches
 * a corner of each, and what is here is that corner. They are cast rather
 * than completed because completing them would be writing a browser —
 * `matchMedia` would gain a `media`, a `dispatchEvent` and an `onchange`
 * that nothing reads, and the stub would say less about what the app uses,
 * not more.
 */
const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
const anyWindow = /** @type {Record<string, any>} */ (/** @type {unknown} */ (w));

for (const k of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"]) {
  Object.defineProperty(globalThis, k, { value: anyWindow[k], configurable: true, writable: true });
}
anyWindow.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
anyGlobal.matchMedia = anyWindow.matchMedia;
w.URL.createObjectURL = () => "blob:https://taleb.test/x";
w.URL.revokeObjectURL = () => {};
globalThis.URL.createObjectURL = w.URL.createObjectURL;
globalThis.URL.revokeObjectURL = w.URL.revokeObjectURL;
anyGlobal.Audio = class { play() { return Promise.resolve(); } pause() {} };
anyWindow.Audio = anyGlobal.Audio;
Object.defineProperty(w, "crypto", { value: globalThis.crypto, configurable: true });
delete anyWindow.indexedDB; // exercise the no-IndexedDB fallback path

/* ---- the fake server ---- */
/** @type {string[]} */
const calls = [];
/* The bodies of any flags reported, so what was sent can be read rather
   than merely counted. */
/** @type {any[]} */
const reported = [];
/* The decks made through the UI, so a walk can check what was actually
   asked for rather than only what the screen then showed. */
/** @type {any[]} */
const madeDecks = [];
/* `data` is the wire document: JSON as the sync endpoint stores it, which
   the checks below navigate field by field. */
/** @type {Map<string, { etag: string, data: any }>} */
const remoteDocs = new Map(); // token -> {etag, data}
const account = { handle: "sara-4f2a", displayName: "Sara", key: "amber-cedar-harbour-lantern-1a2b", admin: false };
/* Two meanings, in the convention every card uses for them: both are right
   when the question is what the word means, and one of them is the question
   when the word is what is being asked for. */
const card = {
  id: "k111111111111", owner: "t-1", ar: "كتاب", en: "book / notebook", lat: "kitaab", note: "", lang: "ar-PS",
  number: "singular", gender: "masculine", classifier: "", clips: ["a".repeat(64)],
  subs: [{ ar: "كتب", en: "books", lat: "kutub", number: "plural", gender: "", classifier: "", clips: [] }],
  rev: 2, updated: 1,
};
/* A phrase, and one that contains the word above — which is the shape the
   whole "meet a word in context" idea rests on. It is here mainly to prove
   that a course card is no longer labelled a word whatever it holds. */
const phrase = {
  id: "k222222222222", owner: "t-1", ar: "الكتاب كبير", en: "the book is big", lat: "il-kitaab kbiir",
  note: "", lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  /* And it says so, the way a teacher confirms it in their own editor.
     That one field is what turns two cards into a word met in use. */
  uses: ["k111111111111"],
  clips: [], subs: [], rev: 1, updated: 1,
};
/* A conversation, exactly as the server stores one: turns, speakers, and
   no label saying "this is a conversation" — because the server has never
   had a field for one. Nothing names a part, either, which is the ordinary
   case now.

   Written out here rather than saved through the editor because that is
   how the teacher's own screens actually receive it, and the bug this
   fixture exists for was a screen reading a stored card wrongly. */
const talk = {
  id: "k333333333333", owner: "t-1", ar: "", en: "At the door", lat: "",
  note: "Two neighbours meet", lang: "ar-PS",
  speakers: ["Layla", "Karim"],
  you: null,
  lines: [
    { who: 0, ar: "سلام", en: "peace", lat: "", clips: [], slowClips: [], uses: [] },
    { who: 1, ar: "وعليكم السلام", en: "and upon you peace", lat: "", clips: [], slowClips: [], uses: [] },
    /* This turn uses a word the teacher teaches and does not say so, which
       is what the In context tab is for — and a conversation used to be
       invisible to it. */
    { who: 0, ar: "وين الكتاب", en: "where is the book", lat: "", clips: [], slowClips: [], uses: [] },
  ],
  clips: [], subs: [], rev: 1, updated: 1,
};
/* A phrase with a hole in it, and the cards that fill it. The frame is in
   the deck; the values are in none at all, which is the whole point of them
   — they reach a student because the deck's phrases ask for them, not
   because anybody filed them under Lesson 1. */
const frameCard = {
  id: "k444444444444", owner: "t-1", ar: "اسمي {{name}}", en: "My name is {{name}}",
  lat: "ismi {{name}}", note: "", lang: "ar-PS", number: "singular", gender: "masculine",
  classifier: "", clips: [], subs: [], uses: [], rev: 1, updated: 1, created: 1,
};
/** @param {string} id @param {string} ar @param {string} en @param {string} lat */
const nameCard = (id, ar, en, lat) => ({
  id, owner: "t-1", ar, en, lat, note: "", lang: "ar-PS", number: "singular",
  gender: "masculine", classifier: "", clips: [], subs: [], uses: [],
  /* What makes it a value: which variable it fills, and that it is never a
     question of its own. */
  fills: "name", drill: false, rev: 1, updated: 1,
  /* When each was made, which is the order the values are offered in — the
     rotation walks that list, and a card with no date would take today's
     and sort against the others by luck. Every card the server has ever
     stored carries one. */
  created: ar === "رافائيل" ? 2 : 3,
});
/* A card whose two forms mean the same thing in English, which is the one
   shape a prompt cannot settle by itself: "teacher" is either of them, so
   asked to write it a learner has no way to know which was wanted and
   writing the other is marked wrong for knowing the word. In no deck, so
   nothing a learner counts moves. */
const twoGenders = {
  id: "k777777777777", owner: "t-1", ar: "مدرس", en: "teacher", lat: "mudarris",
  note: "", lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  clips: [], uses: [], rev: 1, updated: 1, created: 4,
  /* And what the teacher says it is, which since 0.139 is also what it
     fills: a blank named after a kind of word takes the words of that
     kind, so a sentence saying {{noun}} is met with this one — and with
     its feminine, because every form of a card lends itself. */
  category: "noun",
  subs: [{
    ar: "مدرسة", en: "teacher", lat: "mudarrisa",
    number: "singular", gender: "feminine", classifier: "", clips: [],
  }],
};
/* A word with pronouns on its end, as a teacher saved it: one cell, in the
   attached table's row. It is here to be *reopened* — the editor used to
   read any cell as a verb's, seed the dictionary form, and open the card on
   the verb table with its pronouns put aside, which a save then dropped. */
const penWithPronouns = {
  id: "k888888888888", owner: "t-1", ar: "قلم", en: "pen", lat: "qalam",
  note: "", lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  clips: [], uses: [], rev: 1, updated: 1, created: 5,
  subs: [{
    ar: "قلمي", en: "my pen", lat: "qalami",
    number: "singular", gender: "", classifier: "", clips: [],
    row: "attached", col: "me",
  }],
};
/* An adjective as a teacher saved it: the word, and one cell of the table
   it agrees out of. Here to be reopened — a card carrying a table should
   open on that table, whichever it is, and this is the first table that is
   neither a verb's nor the pronouns. */
const bigWithForms = {
  id: "k999999999999", owner: "t-1", ar: "كبير", en: "big", lat: "kbiir",
  note: "", lang: "ar-PS", number: "singular", gender: "masculine", classifier: "",
  category: "adjective",
  clips: [], uses: [], rev: 1, updated: 1, created: 6,
  subs: [{
    ar: "كبيرة", en: "big (f)", lat: "kbiire",
    number: "singular", gender: "feminine", classifier: "", clips: [],
    row: "agreement", col: "feminine",
  }],
};
/* A verb as a teacher saved it: the word a dictionary lists, and cells in
   two of the three rows Arabic declares. It is here so that a sentence
   leaving a {{verb}} blank has verbs behind it — which is what the tense
   question further down is asked about, and what it narrows. */
const toEat = {
  id: "kaaaaaaaaaaaa", owner: "t-1", ar: "أكل", en: "to eat", lat: "akal",
  note: "", lang: "ar-PS", name: "to eat", category: "verb",
  clips: [], uses: [], rev: 1, updated: 1, created: 7,
  subs: [
    { ar: "أكل", en: "he ate", lat: "akal", row: "past", col: "he", clips: [] },
    { ar: "أكلت", en: "she ate", lat: "akalat", row: "past", col: "she", clips: [] },
    { ar: "بياكل", en: "he eats", lat: "byaakul", row: "present", col: "he", clips: [] },
  ],
};
const rafa = nameCard("k555555555555", "رافائيل", "Raphael", "rafaa'iil");
const viktor = nameCard("k666666666666", "فيكتور", "Victor", "fiktoor");
let materialHits = 0;
let versionHits = 0;
/* The build the bundle was compiled with — see the define above — so the
   app and the server agree until a test makes them disagree. */
let deployedVersion = { release: "0.1", commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
/**
 * The whole server, as far as the app is concerned.
 *
 * Duck-typed on purpose: it answers with the two readers the clients
 * actually use — json() and text() — rather than a whole Response, and it
 * takes the three request fields they actually send. What the app touches
 * is what is written here, so a change to what it touches fails here
 * instead of being quietly satisfied by a fuller stand-in.
 * @param {string | URL | Request} input
 * @param {{ method?: string, body?: string, headers?: Record<string, string> }} [opts]
 */
const fakeFetch = async (input, opts = {}) => {
  const url = new URL(String(input), "https://taleb.test");
  const method = opts.method || "GET";
  const action = url.searchParams.get("action");
  calls.push(`${method} ${url.pathname}${action ? "?action=" + action : ""}${url.searchParams.get("audio") ? "?audio" : ""}`);
  /* Both readers, because the courses client reads the body as text and
     the sync client calls json(). A stub that offered only one would let a
     change to either slip through here. */
  /**
   * @param {unknown} body
   * @param {number} [status]
   */
  const json = (body, status = 200) => ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  /* Whatever the "server" is serving. Set per test, so the corner menu can
     be shown both a matching build and a newer one. Counted, because the
     Check button's whole job is to ask again. */
  if (url.pathname === "/api/version") {
    versionHits += 1;
    return json(deployedVersion);
  }

  if (url.pathname === "/api/courses") {
    if (action === "whoami") return json({ ok: true, user: { ...account, key: undefined } });
    if (action === "my-material") {
      materialHits += 1;
      const version = "v-abc";
      if (url.searchParams.get("version") === version) return json({ ok: true, unchanged: true, version, teaches: true });
      return json({
        ok: true, version, teaches: true,
        courses: [{ id: "c1", title: "Arabic 101", language: "ar-PS", decks: ["d1"], role: "student", studying: true, teaching: false }],
        decks: [
          { id: "d1", title: "Lesson 1", owner: "t-1", cardIds: [card.id, phrase.id], cardCount: 2, courseId: "c1", courseTitle: "Arabic 101", courseLanguage: "ar-PS", courses: [{ courseId: "c1", addedAt: 1 }], version: 3 },
          /* A second deck, holding the phrase with a hole in it. Its own,
             so that what a session over Lesson 1 asks is what it always
             asked — and so the values below are seen arriving with the deck
             that needs them rather than with any deck at all. */
          { id: "d2", title: "Introductions", owner: "t-1", cardIds: [frameCard.id], cardCount: 1, courseId: "c1", courseTitle: "Arabic 101", courseLanguage: "ar-PS", courses: [{ courseId: "c1", addedAt: 2 }], version: 1 },
          /* A third deck, holding a card that is already in the first. A
             card in two decks is in both, and nothing here had one — so
             the screens that count a deck's cards were counting each card
             under whichever deck happened to carry it first, and nothing
             said so. */
          { id: "d3", title: "Review", owner: "t-1", cardIds: [card.id], cardCount: 1, courseId: "c1", courseTitle: "Arabic 101", courseLanguage: "ar-PS", courses: [{ courseId: "c1", addedAt: 3 }], version: 1 },
        ],
        /* Each deck's own cards, and — as the server bundles them — the
           values its phrases leave holes for. The book is sent twice,
           because it is in two decks; the two names are sent with the deck
           whose phrase needs them and are in no deck at all. */
        cards: [
          { deckId: "d1", cards: [card, phrase] },
          { deckId: "d2", cards: [frameCard, rafa, viktor] },
          { deckId: "d3", cards: [card] },
        ],
      });
    }
    /* What a teacher's own space is built from. The same two cards the
       course hands out, which is what makes them worth trying an exercise
       on: one has a recording and one does not, and one is a phrase that
       teaches the other. */
    if (action === "my-courses") {
      return json({
        ok: true,
        courses: [
          { id: "c1", title: "Arabic 101", language: "ar-PS", decks: ["d1"], students: [], teachers: [account.handle], role: "teacher" },
        ],
      });
    }
    if (action === "my-decks") {
      return json({
        ok: true,
        decks: [
          { id: "d1", title: "Lesson 1", owner: account.handle, lang: "ar-PS", cardIds: [card.id, phrase.id], cardCount: 2, courses: [{ courseId: "c1", addedAt: 1 }] },
          { id: "d2", title: "Introductions", owner: account.handle, lang: "ar-PS", cardIds: [frameCard.id], cardCount: 1, courses: [{ courseId: "c1", addedAt: 2 }] },
        ],
      });
    }
    if (action === "my-cards") {
      return json({
        ok: true,
        cards: [
          { ...card, decks: ["d1"] },
          { ...phrase, decks: ["d1"] },
          { ...talk, decks: [] },
          { ...frameCard, decks: ["d2"] },
          { ...rafa, decks: [] },
          { ...viktor, decks: [] },
          { ...twoGenders, decks: [] },
          { ...penWithPronouns, decks: [] },
          { ...bigWithForms, decks: [] },
          { ...toEat, decks: [] },
        ],
      });
    }
    if (action === "create-deck") {
      const body = JSON.parse(opts.body || "{}");
      madeDecks.push(body);
      return json({
        ok: true,
        deck: {
          id: `d${madeDecks.length + 1}`,
          title: body.title,
          owner: account.handle,
          lang: body.lang || "ar-PS",
          cardIds: [],
          cardCount: 0,
          courses: [],
        },
      });
    }
    if (action === "clip") return json({ error: "not-found" }, 404);
    if (action === "report-flag") {
      reported.push(JSON.parse(opts.body || "{}"));
      return json({ ok: true, id: "flag-1" });
    }
    return json({ error: "unknown-action" }, 400);
  }
  if (url.pathname === "/api/sync") {
    const token = (opts.headers || {})["x-sync-token"] || "";
    if (url.searchParams.get("audio")) return json({ error: "not-found" }, 404);
    if (method === "GET") {
      const doc = remoteDocs.get(token);
      return json(doc ? { etag: doc.etag, data: doc.data } : { etag: null, data: null });
    }
    if (method === "POST") {
      const body = JSON.parse(opts.body || "{}");
      const etag = `e${remoteDocs.size + 1}-${Date.now()}`;
      remoteDocs.set(token, { etag, data: body.data });
      return json({ ok: true, etag });
    }
    if (method === "DELETE") {
      remoteDocs.delete(token);
      return json({ ok: true });
    }
  }
  return json({ error: "nope" }, 404);
};
anyWindow.fetch = anyGlobal.fetch = fakeFetch;

/* A card climbed: every exercise it could be asked, mastered, and none of
   them due again until tomorrow. What a card looks like on a device where
   it has been practised for a fortnight.
 *
 * Two walks below need cards in that state, because most of what the app
 * can ask only opens once the levels under it are mastered: the matching
 * grid wants three cards the learner has met, the gentle half of the
 * gap-fill sits above knowing what the word means, and writing the script
 * sits above both.
 *
 * Nothing due is what keeps them in that state. An ordinary session asks
 * what is due and reaches past it only on a card that has something due —
 * so a card with nothing due is not in one at all, and none of the walks
 * that give questions up can lapse one of these and close the level above
 * it. The walk that does ask them is Ultimate, which asks every exercise a
 * card has open whether it is due or not. */
const CLIMBABLE = [
  "ar2pick", "ar2en", "rec2en", "match", "en2pick", "ctx2pick",
  "tr2ar", "rec2ar", "en2ar", "ctx2ar",
];
const climbed = () =>
  Object.fromEntries(
    CLIMBABLE.map((t) => [
      t,
      { phase: "review", reps: 3, interval: 5, due: Date.now() + 86400000, updated: 5 },
    ])
  );

/* And the same card two returns later: up every level and kept.
 *
 * Clearing is bought with effort and can all happen in one evening; being
 * learnt cannot, because the two passes are only counted on answers given
 * when the question came round of its own accord. So a card in this state
 * is not one a walk can produce — it is days of real time — and without
 * one in the fixture the Learnt tile is empty and everything the Progress
 * screen says about a learnt card goes unchecked.
 *
 * The passes are the whole of the difference: nothing here is due any
 * sooner or asked any differently, so a card handed this instead of
 * `climbed` sits where it sat and is filed one tile further along. */
const kept = () =>
  Object.fromEntries(
    Object.entries(climbed()).map(([t, s]) => [t, { ...s, passes: 2 }])
  );

/* ---- what the device held before this build: a signed-in account and a
   document from an older build carrying its own private sync key ---- */
localStorage.setItem("arabic-account", JSON.stringify(account));
const legacyKey = "raven-saffron-thistle-velvet-9f9f";
localStorage.setItem("arabic-trainer:arabic-trainer-v3", JSON.stringify({
  version: 3, items: [], tombstones: {}, log: {}, settings: { language: "ar-PS" },
  account: { handle: "me-0000", displayName: "Me", key: legacyKey },
}));
/** @param {string} s */
const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const legacyToken = await sha(legacyKey);
const realToken = await sha(account.key);
remoteDocs.set(legacyToken, { etag: "old", data: { version: 3, items: [], tombstones: {}, log: {}, settings: {} } });
/* And, under the real token, a document written by an older client: a card
   with one state, no rec2attr, no flags, no subs — the shape that used to
   crash the first render after a sync. */
remoteDocs.set(realToken, {
  etag: "e0",
  data: {
    version: 3, tombstones: {}, log: {}, settings: { language: "ar-PS" }, settingsUpdated: 1,
    items: [
      { id: "oldclient1", ar: "بيت", en: "house", lat: "beit", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5, s: { ar2en: { phase: "review", reps: 3, interval: 2, due: 0, updated: 5 } } },
      /* A v2 card, whose three skills predate exercise types. Its "read"
         skill was typing the transliteration, which is retired — so it must
         be dropped rather than lifted into a state for an exercise nothing
         offers, which would then be stored and synced forever. */
      { id: "v2card", ar: "باب", en: "door", lat: "baab", kind: "word", tags: [],
        created: 1, updated: 5,
        s: { mean: { box: 2, due: 0, right: 3, wrong: 1 }, read: { box: 2, due: 0, right: 2, wrong: 0 } } },
      /* Two more cards in the same state as each other and due at the same
         moment, so that "six sessions are not one session six times" has
         something to be random about that no other walk can spend. It used
         to lean on the conversation being unmet, which made the test a
         hostage to whatever the walk before it had answered. */
      /* Two cards a fortnight in. Nothing else in the fixture has climbed,
         which is the ordinary state of a deck and what keeps every other
         walk on recognition. */
      { id: "tied1", ar: "شمس", en: "sun", lat: "shams", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5, s: climbed() },
      { id: "tied2", ar: "قمر", en: "moon", lat: "qamar", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5, s: climbed() },
      /* And two in the same state as each other and due at the same moment,
         so that "six sessions are not one session six times" has something
         to be random about that no other walk can spend. It used to lean on
         the conversation being unmet, which made the test a hostage to
         whatever the walk before it had answered. */
      /* Answered exactly as often, and as well, as the v2 card above: a
         session puts the easiest first, so three cards of one difficulty
         are three that can lead it and one is a session that always opens
         the same way. */
      { id: "spare1", ar: "نجم", en: "star", lat: "najm", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5,
        s: { ar2en: { phase: "review", reps: 4, right: 3, wrong: 1, interval: 2, due: 0, updated: 5 } } },
      { id: "spare2", ar: "ورد", en: "roses", lat: "ward", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5,
        s: { ar2en: { phase: "review", reps: 4, right: 3, wrong: 1, interval: 2, due: 0, updated: 5 } } },
      /* And the course card for كتاب, met on this device before today: the
         teacher owns its wording and the student owns its progress, so what
         is stored here is progress alone and the wording is overwritten by
         the material when it arrives. It has climbed the same two levels,
         which is what opens the gap-fill's gentle half on it — and what
         gives the matching grid a third word to deal, since a grid is only
         ever filled from cards the learner has already met. */
      /* And the course card for كتاب, climbed on this device before today:
         the teacher owns its wording and the student owns its progress, so
         what is stored here is progress alone and the wording is written
         over by the material when it arrives. It is the card the seeded
         phrase teaches, so climbing it is what opens the gap-fill's gentle
         half — and it is the matching grid's third word.

         Its plural is climbed with it. A family is in a session when any
         one of its forms has something due, so a plural left untouched
         would carry the whole card into sessions that are meant to leave
         it alone. */
      /* And it is the one card in the fixture that has been *kept* as
         well as climbed — see `kept` — so that the Learnt tile on Progress
         has something behind it. It changes nothing about what is due or
         what can be asked of it, which is what makes it safe to be the
         card two other walks lean on. */
      { id: "srvk111111111111", ar: "كتاب", en: "book", lat: "kitaab", kind: "word", tags: ["Lesson 1"],
        created: 1, updated: 5, s: kept(),
        subs: [{ id: "srvk111111111111-f0", ar: "كتب", en: "books", lat: "kutub", s: kept() }] },
      /* One card in a second language, which is what makes this device a
         two-language one: the switch at the top of Learning is there for
         somebody learning more than one and nobody else, so without this
         there would be nothing to press.

         Climbed, and so not due — the walks below deal sessions out of
         what is waiting, and a card that is never waiting cannot turn an
         Arabic walk into a Vietnamese question. What it changes is the
         count of cards and the list of languages, which is the whole of
         what it is here for. */
      { id: "vicard1", ar: "nhà", en: "house", lat: "nha", kind: "word", tags: ["Huế"],
        lang: "vi-Hue", created: 1, updated: 5, s: climbed() },
    ],
  },
});

/* ---- render ---- */
/** @type {string[]} */
const errors = [];
const origError = console.error;
console.error = (/** @type {unknown[]} */ ...a) => { errors.push(a.map(String).join(" ")); };
/* ".js" whatever the source was called: this is esbuild's output, and it
   writes JavaScript however the entry point was spelt. */
const { storage } = await import(path.join(out, "storage.js"));
anyWindow.storage = anyGlobal.window.storage = storage;
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const App = (await import(path.join(out, "ArabicTrainer.js"))).default;
const mount = document.getElementById("root");
if (!mount) throw new Error("the jsdom page has no #root to render into");
const root = createRoot(mount);
root.render(React.createElement(App));

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);   // load, whoami, my-material, first sync
// a second refresh should hit the version and come back unchanged
w.dispatchEvent(new w.Event("focus"));
await sleep(600);

const text = document.body.textContent || "";
/** @type {string[]} */
const results = [];
/**
 * @param {string} label
 * @param {unknown} ok
 * @param {string} [detail]
 */
const check = (label, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);

/*
 * A card's forms, off the JSON — the card's own word first, then its
 * alternates. Written out here rather than imported, because these checks
 * read the app's two documents as a device would find them on disk.
 */
/** @param {any} it */
const formsIn = (it) => ((it && it.forms) || []);
/** @param {any} it */
const lead = (it) => formsIn(it)[0] || {};
/* The same card with its own word written over — the fixtures below build
   variants of a stored card, and a card's word is the first of its forms.
 */
const reworded = (/** @type {any} */ it, /** @type {Record<string, any>} */ word) => ({ ...it, forms: [{ ...lead(it), ...word }, ...formsIn(it).slice(1)] });

/*
 * Say what happened, whatever happened.
 *
 * The checks are printed at the end and the app's own console is held in
 * `errors` until then, so a walk that died halfway used to print a stack
 * trace and nothing else: the run that most needed explaining was the one
 * that said least, and the app's complaint about why it had crashed was
 * sitting in an array nobody read. Both are printed on the way out now, by
 * whichever exit is taken.
 */
/** @param {string} [why] */
function report(why) {
  console.error = origError;
  if (why) console.log(`\n${why}`);
  console.log(results.join("\n"));
  if (errors.length) console.log("\nthe app said:\n  " + errors.join("\n  "));
}
/** @param {unknown} err */
const died = (err) => {
  report("DIED partway through. Everything up to that point:");
  origError("\n", err);
  process.exit(1);
};
process.on("uncaughtException", died);
process.on("unhandledRejection", died);

/* The home screen opens on the climb — the ring and the band beside it —
   rather than on a count of what is due. */
const homeCard = () => document.querySelector(".at-card[data-ready]");
check("app rendered the home screen", !!homeCard() && !!document.querySelector(".at-climb"), text.slice(0, 80).replace(/\s+/g, " "));
check("and it says how far along the collection is, drawn and in words",
  /\d+ of \d+ cards? learnt/.test(text.replace(/\s+/g, " ")) &&
    !!document.querySelector(".at-climbring .fill") &&
    !!document.querySelector(".at-climbband i"),
  (document.querySelector(".at-climb")?.textContent || "nothing drawn").replace(/\s+/g, " "));
/* And none of the lines that used to crowd it. */
check("and none of the text that used to sit around it",
  !/Cards ready to practice|Each form is asked|waiting to be introduced|sitting out/.test(text),
  text.replace(/\s+/g, " ").slice(0, 160));
check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
check("whoami asked once", calls.filter((c) => c.includes("whoami")).length === 1);
check("material fetched via one request, no my-courses/course-decks/deck-cards", !calls.some((c) => /my-courses|course-decks|deck-cards/.test(c)) && materialHits >= 1, calls.join(", "));
check("second refresh was answered 'unchanged' (version round-tripped)", materialHits >= 2);
check("synced under the sign-in key's token", remoteDocs.has(realToken));
check("legacy private document deleted", !remoteDocs.has(legacyToken), calls.filter((c) => c.startsWith("DELETE")).join(","));
const stored = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
check("stored document no longer carries an account", !("account" in stored));
/* Everything below reads the app's own two documents — the one in storage
   and the one on the wire — as the JSON they are. */
/** @type {Record<string, any>} */
const byId = Object.fromEntries(stored.items.map((/** @type {any} */ i) => [i.id, i]));
check("both course cards and every old card landed in storage", stored.items.length === 12 && byId["srv" + card.id] && byId["srv" + phrase.id] && byId.oldclient1 && byId.v2card, `items=${stored.items.map((/** @type {any} */ i) => i.id).join(",")}`);
/* And the values the deck's phrases need, which are in no deck at all: they
   arrive because a phrase leaves a hole of their name, carrying what makes
   them values rather than cards to learn. */
check("the cards that fill a variable arrive with the deck that needs them",
  !!byId["srv" + rafa.id] &&
    JSON.stringify(byId["srv" + rafa.id].fills) === JSON.stringify(["name"]) &&
    byId["srv" + rafa.id].drill === false,
  JSON.stringify(byId["srv" + rafa.id] ? { fills: byId["srv" + rafa.id].fills, drill: byId["srv" + rafa.id].drill } : "not here"));
check("and the phrase with the hole in it arrives as written",
  !!byId["srv" + frameCard.id] && lead(byId["srv" + frameCard.id]).en === "My name is {{name}}",
  byId["srv" + frameCard.id] ? lead(byId["srv" + frameCard.id]).en : "no frame card");

/* What a course card is, rather than what it used to be told it was. Every
   one of them arrived labelled "word" — which is why the practice filter did
   nothing on course material, and why the app could not see that this phrase
   contains that word. */
check("a one-word course card is a word", byId["srv" + card.id].kind === "word", byId["srv" + card.id].kind);
check("and a course card holding a phrase is a phrase, not a word",
  byId["srv" + phrase.id].kind === "phrase", byId["srv" + phrase.id].kind);
check("the old client's card kept its one answered state and gained nothing spurious", byId.oldclient1 && Object.keys(lead(byId.oldclient1).s).join() === "ar2en" && lead(byId.oldclient1).s.ar2en.reps === 3);
/* The v2 card's "mean" skill becomes ar2en; its "read" skill named the
   retired exercise and must not come back as a state for it. */
check("a v2 card's skills lift onto types that exist, and no further",
  byId.v2card && lead(byId.v2card).s.ar2en && lead(byId.v2card).s.ar2en.reps === 4,
  byId.v2card ? `states=${Object.keys(lead(byId.v2card).s).join(",")}` : "no v2 card");
check("a v2 card gains no state for the retired exercise",
  byId.v2card && !("ar2tr" in lead(byId.v2card).s),
  byId.v2card ? `states=${Object.keys(lead(byId.v2card).s).join(",")}` : "no v2 card");
/* On the phrase, which nobody has answered. The word card beside it in the
   same deck arrived carrying progress made on another device, which is the
   other half of the same rule: what is stored is what was answered. */
check("untouched states are not stored",
  byId["srv" + phrase.id] && Object.keys(lead(byId["srv" + phrase.id]).s || {}).length === 0,
  Object.keys(lead(byId["srv" + phrase.id]).s || {}).join(",") || "none");
/* Seven of the nine: the two values are held and never counted. A card
   that fills a hole in somebody else's sentence is not a card waiting to be
   practised, and counting it would promise a session that never comes. */
/* Six: every card with something to do on a level it has reached. The two
   values are not among them, which is the thing this is here for — and nor
   are the three climbed above, whose next review is tomorrow. A card with
   nothing due is not a card waiting to be practised. */
/* Counted off the attribute the home card carries rather than off a line of
   text: the number came off the screen when the climb went on it, and what
   is being tested here is the counting, not the wording. */
check("every card with something due counts, and a value is never one", homeCard()?.getAttribute("data-ready") === "6", homeCard()?.getAttribute("data-ready") ?? "no home card");
const wire = remoteDocs.get(realToken)?.data;
/* Sparse means one thing: no state written out for an exercise type that was
   never answered. Keys from an older schema — v2's mean/read/write — ride
   along untouched, because sync unions whatever keys either side has so that
   a device on one build never strips what a device on another still needs.
   That is deliberate, and the reason a retired type's state is left alone
   rather than filtered out of the document. */
const V2_KEYS = ["mean", "read", "write"];
const statesIn = (/** @type {any} */ i) => lead(i).s || {};
const typeStates = (/** @type {any} */ i) => Object.keys(statesIn(i)).filter((k) => !V2_KEYS.includes(k));
/* Answered, that is: a state is on the wire because something was written
   to it, never because a type exists. */
check("wire document is sparse and has no account", wire && !("account" in wire) && wire.items.every((/** @type {any} */ i) => typeStates(i).every((k) => (statesIn(i)[k].reps || 0) > 0)), wire ? wire.items.map((/** @type {any} */ i) => `${i.id}:${Object.keys(statesIn(i)).join("/") || "-"}`).join(" ") : "no wire doc");
check("the retired exercise is never written into the document", wire && wire.items.every((/** @type {any} */ i) => !("ar2tr" in statesIn(i))), wire ? wire.items.map((/** @type {any} */ i) => `${i.id}:${Object.keys(statesIn(i)).join("/") || "-"}`).join(" ") : "no wire doc");
check("clip sync uploaded nothing (no blob: URLs)", !calls.some((c) => c.startsWith("POST /api/sync?audio")));
check("clip sync did not fetch course recordings as a side effect", !calls.some((c) => c.includes("action=clip")), calls.filter((c) => c.includes("clip")).join(","));

/* ---- the manual session builder, now rendered through Screen ---- */
/** @param {RegExp} re */
const clickNamed = (re) => {
  const b = buttonNamed(re);
  if (b) b.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  return !!b;
};
/** @param {Element | null | undefined} el */
const click = (el) => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
/** @param {RegExp} re */
const buttonNamed = (re) =>
  [...document.querySelectorAll("button")].find((b) => re.test(b.textContent || ""));

/*
 * Play the matching grid, if that is what is up.
 *
 * Every other question on this screen is answered by typing into one box or
 * pressing one of a few buttons, and each walk below knew how to do both. A
 * grid is neither, and it cannot be given up on either — it has no input to
 * leave empty and its Check stays dead until every word has a meaning — so a
 * walk that met one simply stopped, and every check after it failed for
 * want of a screen rather than for anything wrong.
 *
 * Paired in the order the tiles happen to stand, so some come out right and
 * some wrong. That is deliberate: what these walks are about is that the
 * grid takes an answer and marks it, not that a test can read Arabic.
 *
 * Returns what it saw, so a walk that cares can check it, and false when
 * there was no grid to play.
 */
async function playGrid() {
  if (!document.querySelector('[data-el="answer-match"]')) return false;
  const words = () => [...document.querySelectorAll('[data-el="match-word"]')];
  const meanings = () => [...document.querySelectorAll('[data-el="match-meaning"]')];
  const seen = {
    words: words().length,
    meanings: meanings().length,
    /* What it put up, so a caller can say what was in it and not only how
       many: which words stand together is the exercise. */
    text: [...words(), ...meanings()].map((el) => (el.textContent || "").trim()).join(" · "),
    /* Each meaning on its own, to be told apart from the others: two tiles
       reading alike make a pairing nobody can get right. */
    meaningText: meanings().map((el) => (el.textContent || "").trim()),
    /* And how it is laid out: two columns, the language being learnt first.
       The stylesheet puts them side by side; this is the order they are
       written in, which is what decides which side each lands on. */
    columns: document.querySelectorAll('[data-el="answer-match"] .at-matchcol').length,
    firstColumn: (() => {
      const first = document.querySelector('[data-el="answer-match"] .at-matchcol');
      if (!first) return "none";
      const el = first.querySelector("[data-el]");
      return el && el.getAttribute("data-el") === "match-word" ? "words" : "meanings";
    })(),
    checkedEarly: false,
    marked: false,
    /* How many pairs were made meaning first. A grid is started from
       whichever column the learner is reading, so half the pairs below are
       made the other way round, and this is what says they took. */
    fromRight: 0,
  };
  const early = document.querySelector('[data-el="check-button"]');
  seen.checkedEarly = !!early && /** @type {HTMLButtonElement} */ (early).disabled;
  for (let k = 0; k < seen.words; k++) {
    /* Every other pair begun from the meanings side, which is the same
       pairing made by the other gesture: tap the meaning, then its word. */
    const rightFirst = k % 2 === 1;
    click(rightFirst ? meanings()[k] : words()[k]);
    await sleep(25);
    click(rightFirst ? words()[k] : meanings()[k]);
    await sleep(25);
    if (rightFirst && words()[k].classList.contains("paired")) seen.fromRight += 1;
  }
  click(document.querySelector('[data-el="check-button"]'));
  await sleep(250);
  seen.marked =
    !!document.querySelector('[data-el="verdict"]') &&
    document.querySelectorAll(".at-matchtile.right, .at-matchtile.wrong").length > 0;
  return seen;
}

/*
 * The on-screen keys button, checked wherever a question asking for the
 * script turns up.
 *
 * It used to be a labelled button in the flow under the answer box and is
 * now an icon in the field's corner. Which question it is met on is not
 * this walk's business — only two of the seeded cards have climbed far
 * enough to be asked for the script at all — so it is a function called
 * from whichever walk meets one first, and it runs once.
 *
 */
/** @param {Element} field  The script input on screen. */
async function checkKeys(field) {
  const wrap = field.parentElement;
  if (!wrap) return false;
  check("the answer field carries the keys button in its corner",
    wrap.classList.contains("at-inputwrap") && !!wrap.querySelector(".at-keybtn"),
    wrap.className);
  /* Which side it takes is settled by this class, not by the stylesheet
     guessing: the seeded course is Arabic, so it is the left. */
  check("and the wrapper says which end of the line that is",
    wrap.classList.contains("rtl"), wrap.className);
  check("and nothing is left of the labelled button under the box",
    !document.querySelector(".at-kbtoggle") && !/Show on-screen keys/.test(document.body.textContent || ""));

  /* It says what it is and whether it is on, which is all a button with
     no words on it has to go on. */
  const keys = must(wrap.querySelector(".at-keybtn"), "the keys button in the answer field");
  check("the icon-only button is named for a screen reader",
    keys.getAttribute("aria-label") === "On-screen keys" && keys.getAttribute("aria-pressed") !== null,
    `${keys.getAttribute("aria-label")} / pressed=${keys.getAttribute("aria-pressed")}`);

  const wasOpen = !!document.querySelector(".at-kb");
  click(keys);
  await sleep(120);
  check("and it opens and closes the keys",
    !!document.querySelector(".at-kb") !== wasOpen,
    `was ${wasOpen ? "open" : "shut"}, now ${document.querySelector(".at-kb") ? "open" : "shut"}`);
  check("the button shows which it is",
    must(wrap.querySelector(".at-keybtn"), "the keys button").getAttribute("aria-pressed") === String(!wasOpen));
  click(wrap.querySelector(".at-keybtn"));
  await sleep(120);
  return true;
}

/**
 * A button by its label, described whether or not it is there.
 *
 * The walk below asks three things of the same button — that it exists,
 * whether it is disabled, and what it says — and asked each separately,
 * which re-read the DOM between them and left every use to cope with a
 * miss again. Read once, said three ways.
 * @param {RegExp} re
 */
const buttonState = (re) => {
  const b = buttonNamed(re);
  return { there: !!b, disabled: !!b && b.disabled, label: (b && b.textContent) || "" };
};

check("the manual session builder opens", clickNamed(/Build a session|Choose what to practice|Pick cards/) || true);
await sleep(300);
if (/of 3|of 4|Build a session/.test(document.body.textContent)) {
  check("session builder rendered in a Screen with its footer", !!document.querySelector(".at-screenfoot, .at-screenhead"));

  /* Nothing is chosen for you. Every step of this used to open with an
     answer already lit — Ultimate on the first screen, twenty questions on
     the last — which reads as a decision made rather than one to make, and
     Ultimate is the longest session on offer to hand somebody by default. */
  const modeCards = [...document.querySelectorAll(".at-modecard")];
  check("the modes are all offered, none of them chosen", modeCards.length > 1 && !modeCards.some((b) => b.classList.contains("on")),
    `${modeCards.length} modes, ${modeCards.filter((b) => b.classList.contains("on")).map((b) => (b.textContent || "").slice(0, 12)).join(",") || "none"} lit`);

  const next = () => buttonState(/^(Next|Choose a mode|Choose at least one card)$/);
  check("and you cannot go on until you choose one", next().there && next().disabled, next().label || "no button");
  check("the button says what is missing rather than sitting dead", next().there && /Choose a mode/.test(next().label),
    next().label);

  click(modeCards.find((b) => /Regular/.test(b.textContent || "")));
  await sleep(80);
  check("choosing one lets you go on", next().there && !next().disabled && /^Next$/.test(next().label),
    next().label);

  /* Cards, which had no default and still should not. */
  clickNamed(/^(Next|Choose a mode|Choose at least one card)$/);
  await sleep(120);
  check("no card is chosen for you either", !document.querySelector(".at-tagpick.on, .at-minicard.on"));
  /* Introductions rather than Everything: the walks further down need the
     climbed cards untouched, and a hand-built session asks a card every
     exercise it has open whether it is due or not — so the one deck none
     of them is in is the one to practise here. */
  const everything = [...document.querySelectorAll(".at-tagpickmain")].find((b) => /Introductions/.test(b.textContent));
  click(everything);
  await sleep(80);
  clickNamed(/^(Next|Choose a mode|Choose at least one card)$/);
  await sleep(120);

  /* Length: two segmented controls, and on opening neither should have a
     segment lit. */
  const lit = [...document.querySelectorAll(".at-lengthgroup .on, .at-lengthgroup [aria-checked=true], .at-lengthgroup [aria-selected=true]")];
  check("no length is chosen for you", lit.length === 0, lit.map((e) => e.textContent).join(","));
  const start = () => buttonState(/^(Start|Choose a length)$/);
  check("and it says so instead of starting a session you did not describe",
    start().there && start().disabled && /Choose a length/.test(start().label),
    start().label || "no button");

  click([...document.querySelectorAll(".at-lengthgroup button")].find((b) => (b.textContent || "").trim() === "10"));
  await sleep(80);
  check("choosing a length is all that was left", start().there && !start().disabled && /^Start$/.test(start().label),
    start().label);

  /* Keeping it, which is the other half of what the last step is for.
     Several minutes of picking used to be spent again the next morning. */
  const keepBox = [...document.querySelectorAll(".at-formblock")]
    .find((d) => /Keep this session/.test(d.textContent || ""));
  check("the last step offers to keep the session", !!keepBox,
    (document.querySelector(".at-screenbody") || { textContent: "" }).textContent.slice(-90));
  const nameBox = keepBox && keepBox.querySelector("input");
  if (nameBox) {
    /* Named, because a list of "Regular · 6 cards" tells nobody which was
       which. */
    const setInput = must(
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
      "the input's value descriptor"
    ).set;
    must(setInput, "the input's value setter").call(nameBox, "Thursday's verbs");
    nameBox.dispatchEvent(new w.Event("input", { bubbles: true }));
    await sleep(60);
    clickNamed(/^Save$/);
    await sleep(150);
    check("saving it says so, rather than looking like nothing happened",
      !!buttonNamed(/^Saved$/), buttonState(/^Saved?$/).label || "no button");
    check("and Start is still the way on — keeping one is not practising it",
      start().there && !start().disabled, start().label);
  }

  /* The whole point of the walk: it still builds. Two new blocking
     conditions are two new ways to wedge the builder shut. */
  clickNamed(/^(Start|Choose a length)$/);
  await sleep(400);
  check("a hand-built session actually starts", !!document.querySelector(".at-instruction"),
    document.body.textContent.slice(0, 120));

  /* Everything below reads a question that is typed into: the names on
     its parts, the hint, the answer screen under it. Most of a session is
     not one — the first two levels of the ladder are answered by tapping —
     so walk forward until one comes up.

     Short, and deliberately: every step of it gives a card up, and the
     walks after this one need a deck that is still due. A card met for
     the first time is asked what it means, in writing, which is the
     second exercise on the bottom level — so this is a step or two, not
     a session. */
  let typedField = null;
  for (let i = 0; i < 12 && !typedField; i++) {
    typedField = document.querySelector('[data-el="answer-input"]');
    if (typedField) break;
    /* A grid has no "I don't know": it is paired and checked instead. */
    if (document.querySelector('[data-el="answer-match"]')) await playGrid();
    else click(buttonNamed(/^I don't know$/));
    await sleep(150);
    click(buttonNamed(/Continue|Next/));
    await sleep(250);
  }
  check("a question that is typed into was reached", !!typedField,
    (document.body.textContent || "").slice(0, 90));

  /* Names on the parts of a question and an answer. They are how a change
     gets asked for — "make question-prompt bigger" — so the thing worth
     testing is that they are there, that they mean one element each, and
     that the gap above the answer box is real rather than a class React
     threw away. */
  {
    const named = () =>
      [...document.querySelectorAll(".at-exercise [data-el]")].map((e) => e.getAttribute("data-el"));

    const asking = named();
    for (const want of ["question-instruction", "question-prompt", "answer-box", "answer-input", "check-button", "dont-know-button"]) {
      check(`the question names ${want}`, asking.includes(want), asking.join(" "));
    }

    /* One name, one element — except the minimal pairs, which are a list
       and are named as one. */
    const dupes = asking.filter((n, i) => n !== "minimal-pair" && asking.indexOf(n) !== i);
    check("each name means exactly one thing", dupes.length === 0, dupes.join(", "));

    /* A block comment written without braces in a JSX children position is
       not a comment — it is text, and it renders. Nothing else here would
       have caught it: every name was present and every class was right,
       and the card simply had a paragraph of source code across the top. */
    const card = must(document.querySelector(".at-exercise"), "the exercise card");
    check("no source comment leaked into the card",
      !/\/\*|\*\/|data-el name/.test(card.textContent || ""),
      (card.textContent || "").slice(0, 100));

    /* The gap that a duplicated className attribute used to swallow. */
    const box = document.querySelector('[data-el="answer-box"]');
    check("the answer box keeps the gap above it",
      box && box.classList.contains("at-mt4"), box ? box.className : "no answer box");

    /* And the hint button says which field it reveals, in the language's
       own word for it. */
    /* Icon-only now, and sitting in the row with "I don't know" — so what
       it is called lives in its accessible name rather than in its text,
       and that is the thing worth holding to. */
    const hint = document.querySelector(".at-hintbtn");
    check("the hint button names the field it shows",
      !hint || /Show transliteration|Show meaning/.test(hint.getAttribute("aria-label") || ""),
      hint ? `aria-label=${hint.getAttribute("aria-label")} text=${JSON.stringify(hint.textContent)}` : "no hint on this exercise");
    check("and it carries no words of its own",
      !hint || !hint.textContent.trim(), hint ? JSON.stringify(hint.textContent) : "");
    check("it stands with the other ways out of the question",
      !hint || !!hint.closest(".at-row"),
      hint ? (hint.parentElement || {}).className : "");

    /* A revealed hint goes through one wrapper whichever field it came
       from, which is what lets a meaning and a transliteration be set at
       the same size. jsdom has no stylesheet, so the structure is what can
       be checked here; the sizes are measured in the browser. */
    if (hint) {
      click(hint);
      await sleep(150);
      const val = document.querySelector('[data-el="hint-value"]');
      check("the revealed hint sits in the one slot that sizes it",
        !!val && val.classList.contains("at-hintvalue") && !!val.firstElementChild,
        val ? val.className : "no hint value");
      check("and the value inside it is named too",
        !!val && !!val.firstElementChild &&
          val.firstElementChild.getAttribute("data-el") === "hint-value-text",
        val && val.firstElementChild ? val.firstElementChild.outerHTML.slice(0, 60) : "");
    }

    /* Now answer it, so the second half of the card can be looked at. */
    click(buttonNamed(/^I don't know$/));
    await sleep(250);
    const answered = named();
    for (const want of ["verdict", "answer-value", "continue-button", "flag-button"]) {
      check(`the answer names ${want}`, answered.includes(want), answered.join(" "));
    }
    const dupes2 = answered.filter((n, i) => n !== "related-word" && answered.indexOf(n) !== i);
    check("and each of those means one thing too", dupes2.length === 0, dupes2.join(", "));

    /* The extras open closed, behind one tap. The answer is what you came
       back for; five blocks of context under it is a page to scroll past
       rather than a thing to read. */
    check("what is not the answer starts put away",
      !document.querySelector('[data-el="also"]'), "the box is open before it is asked for");
    const moreBtn = document.querySelector('[data-el="also-toggle"]');
    check("and there is an invitation to open it",
      !!moreBtn && /Learn more/.test(moreBtn.textContent), moreBtn ? moreBtn.textContent : "no toggle");
    check("which says whether it is open", moreBtn && moreBtn.getAttribute("aria-expanded") === "false",
      moreBtn ? String(moreBtn.getAttribute("aria-expanded")) : "");
    click(moreBtn);
    await sleep(120);

    /* Everything that is not the answer, in one box. The members are each
       conditional, so what matters is that whichever turned up are inside
       it and in the order they are meant to read in. */
    const alsoBox = document.querySelector('[data-el="also"]');
    check("what is not the answer is gathered into a box",
      !!alsoBox && alsoBox.classList.contains("at-alsobox") && !!alsoBox.closest(".at-exercise"),
      alsoBox ? alsoBox.className : "no box");
    const inBox = alsoBox ? [...alsoBox.children].map((e) => e.getAttribute("data-el")) : [];
    const FAMILY = ["also-context", "also-script", "also-hint", "also-audio", "related-words"];
    check("and everything in it is one of the blocks that were loose on the page",
      inBox.length > 0 && inBox.every((n) => FAMILY.includes(n || "")), inBox.join(" ") || "empty");
    /* It used to sit three blocks below its own siblings, under the notes. */
    const heard = inBox.indexOf("also-audio");
    check("how it sounds sits with its siblings, not below the notes",
      heard === -1 || heard === inBox.length - 1 || inBox.indexOf("related-words") > heard,
      inBox.join(" "));
    check("the box holds only what it was given, never an empty shell",
      !alsoBox || alsoBox.children.length > 0, String(alsoBox && alsoBox.children.length));
    /* The notes are about the answer, not about learning more, so they
       stay outside it. */
    check("the card's own notes stay outside the box",
      !alsoBox || !inBox.includes("card-note"), inBox.join(" "));

    /* The way on sits where the hint, the nudge and the check sat: same
       bar, same place on the screen, so a long answer can never push it
       out of reach. */
    const cont = document.querySelector('[data-el="continue-button"]');
    const contBar = cont && cont.parentElement;
    check("continue is in the bar pinned to the foot of the screen",
      !!contBar && contBar.classList.contains("at-answerbar"),
      contBar ? contBar.className : "no continue button");
    check("and it is the only thing in it, so it takes the whole width",
      !!contBar && contBar.children.length === 1,
      contBar ? String(contBar.children.length) : "");

    /* Flagging is pinned with it, one step above. It used to trail below
       the answer, so on a long one you had to scroll to reach the button
       that says "this question is wrong" — the moment you least want to go
       looking. Above the bar rather than in it: it is not the way on. */
    const foot = cont && cont.closest(".at-foot");
    const flag = document.querySelector('[data-el="flag-button"]');
    check("the flag is pinned to the foot with continue",
      !!foot && !!flag && foot.contains(flag), foot ? foot.className : "no foot");
    check("and it sits above the bar, not inside it",
      !!flag && !!flag.closest(".at-footextra") && !flag.closest(".at-answerbar"),
      flag && flag.parentElement ? flag.parentElement.className : "no flag");
    check("the bar is the last thing in the foot, so the flag is above it",
      !!foot && !!foot.lastElementChild && foot.lastElementChild.classList.contains("at-answerbar"),
      foot ? [...foot.children].map((c) => c.className).join(" | ") : "");

    /* What can be wrong, as cards rather than as a list of labels: a title
       saying what it is and a line saying when to pick it. The labels alone
       left two of the four to be guessed at, and a guessed flag is worse
       than none — it is a report that sends whoever reads it to the wrong
       thing. */
    click(flag);
    await sleep(80);
    const menu = document.querySelector('[data-el="flag-menu"]');
    const opts = menu ? [...menu.querySelectorAll(".at-flagopt")] : [];
    check("the flag button opens the menu, and says that it has",
      !!menu && !!flag && flag.getAttribute("aria-expanded") === "true",
      menu && flag ? String(flag.getAttribute("aria-expanded")) : "no menu");
    check("it offers the four things a learner can say, too easy third", opts.length === 4 &&
      /too easy/.test(opts[2].textContent || "") && /Something else/.test(opts[3].textContent || ""),
      opts.map((o) => (o.querySelector(".at-flagopt-title") || {}).textContent).join(" | "));
    check("and says what too easy does",
      /graduate this card to the next level/.test((opts[2] && opts[2].textContent) || ""),
      (opts[2] && opts[2].textContent) || "(no third option)");

    check("each is a card: what it is, and when to pick it",
      opts.length > 0 && opts.every((o) =>
        o.querySelector(".at-flagopt-title") && o.querySelector(".at-flagopt-what")),
      opts.map((o) => o.innerHTML.slice(0, 40)).join(" | "));
    /* The menu stands on top of the flag button, so it has to say what it
       is itself — otherwise the screen holds three options and nothing
       naming what they are options about. */
    check("and the menu says what it is",
      /Flag a problem/.test(
        (document.querySelector('[data-el="flag-menu-label"]') || {}).textContent || ""),
      (menu && menu.textContent || "").slice(0, 40));

    /* Everything is there from the start: the box for the option that has
       to be said in words, and the two buttons that act on the choice. The
       box used to take the place of the list one press in, and the buttons
       came with it — so until you had picked, there was nothing on screen
       to press but the options themselves, and picking sent. */
    const noteBox = document.querySelector('[data-el="flag-note"]');
    const noteInput = document.querySelector('[data-el="flag-note-input"]');
    check("Something else brings its box with it, before anything is picked",
      !!noteBox && !!noteInput && !!menu && menu.contains(noteBox),
      noteBox ? "" : "no note box");
    check("and Back and Send are on screen from the start",
      !!buttonNamed(/^Back$/) && !!buttonNamed(/^Send$/),
      [...document.querySelectorAll(".at-flagmenu button")].map((b) => b.textContent).join(" | "));
    check("Send waits for one of them to be picked",
      buttonState(/^Send$/).disabled, String(buttonState(/^Send$/).disabled));

    /* Picking is now picking: nothing leaves the device until Send. */
    const somethingElse = opts.find((o) => /Something else/.test(o.textContent));
    click(somethingElse);
    await sleep(80);
    check("picking Something else says so rather than sending",
      !!somethingElse && somethingElse.getAttribute("aria-pressed") === "true" &&
        !calls.some((c) => c.includes("report-flag")),
      somethingElse ? String(somethingElse.getAttribute("aria-pressed")) : "no option");
    check("and it still waits, because it is the one that has to be said in words",
      buttonState(/^Send$/).disabled, String(buttonState(/^Send$/).disabled));

    /* jsdom's value setter is the React-controlled one, so the change has
       to be made the way a keystroke makes it. */
    const setValue = must(
      Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value"),
      "the textarea's value descriptor"
    ).set;
    must(setValue, "the textarea's value setter")
      .call(must(noteInput, "the flag note box"), "the recording plays a different word");
    must(noteInput, "the flag note box").dispatchEvent(new w.Event("input", { bubbles: true }));
    await sleep(60);
    check("typing enables it", !buttonState(/^Send$/).disabled);
    clickNamed(/^Send$/);
    await sleep(120);
    check("sending reports it to the server",
      calls.some((c) => c.includes("report-flag")), calls.slice(-3).join(", "));
    /* What is sent has to be readable at the other end months later, by an
       administrator who never saw the card: the typed words, the question
       itself, and a language named by its id rather than by handing over
       the whole pack. */
    const sentFlag = reported[reported.length - 1] || {};
    check("what it sends carries the person's own words",
      sentFlag.kind === "other" && sentFlag.note === "the recording plays a different word",
      JSON.stringify(sentFlag).slice(0, 120));
    check("and the question, with the language named as an id",
      typeof sentFlag.language === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(sentFlag.language) &&
        !!sentFlag.cardId && !!sentFlag.exercise && !!sentFlag.prompt,
      JSON.stringify(sentFlag).slice(0, 200));
    /* The card named the way the server names it, not the way this device
       does. Course material arrives as items called srv<cardId>, and a
       report carrying that id points at a card nobody can open — which is
       what it did for a release: every one of them read on screen as a
       card the site had never held. */
    check("the card is named by its id on the server, not this device's",
      typeof sentFlag.cardId === "string" && !/^srv/.test(sentFlag.cardId),
      String(sentFlag.cardId));
    /* And the half of the report the learner cannot be expected to write
       out: what they put, what the app made of it, and which build they
       were on. All three are gathered from screen state at the moment the
       menu is used, so nothing but a walk like this one can tell whether
       they are actually being read — a unit test would be asserting
       against its own fixture. */
    check("it carries what the app made of the answer, and which build they were on",
      ["right", "near", "wrong", "shown", "skipped", "unanswered"].includes(sentFlag.verdict) &&
        /^\S+ \(\S+\)$/.test(String(sentFlag.release || "")),
      `verdict=${sentFlag.verdict} release=${sentFlag.release}`);
    /* A flag raised on the question rather than on the verdict is the
       ordinary way to report an unanswerable one, and it must not read as
       an answer of nothing. */
    check("a question flagged before it was answered says so, rather than reading as wrong",
      sentFlag.verdict !== "wrong" || typeof sentFlag.answer === "string",
      `verdict=${sentFlag.verdict} answer=${JSON.stringify(sentFlag.answer)}`);
    /* Where the card came from. This one is a course card, so it has a
       deck behind it; a card the learner made would send neither. */
    check("and where the card reached them from",
      !!sentFlag.deckId && !!sentFlag.courseId,
      `course=${sentFlag.courseId} deck=${sentFlag.deckId}`);
    const flagBtn = document.querySelector('[data-el="flag-button"]');
    check("the menu closes and the button says so",
      !document.querySelector('[data-el="flag-menu"]') &&
        /Flagged/.test((flagBtn && flagBtn.textContent) || ""),
      (flagBtn && flagBtn.textContent) || "no flag button");

    /* ---- too easy: one level up, on the spot ----
       Not a report: nothing is posted, and the form that was asked has
       every exercise on its level counted as learnt before the menu has
       closed. After the report above, on the same question: the two are
       different things and a learner may do both. */
    {
      click(document.querySelector('[data-el="flag-button"]'));
      await sleep(80);
      const easyOpt = [...document.querySelectorAll('[data-el="flag-menu"] .at-flagopt')]
        .find((o) => /too easy/.test(o.textContent || ""));
      const before = calls.filter((c) => c.includes("report-flag")).length;
      click(easyOpt);
      await sleep(60);
      clickNamed(/^Send$/);
      await sleep(800);
      check("too easy is not sent anywhere",
        calls.filter((c) => c.includes("report-flag")).length === before, calls.slice(-2).join(", "));
      check("and says what it did",
        /Moved up a level|Already at the top/.test(document.body.textContent || ""),
        ((document.querySelector(".at-snack") || {}).textContent || "").trim() || "(nothing said)");
      const doc = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
      /* Which keys were written just now, per form. */
      const freshOf = (/** @type {any} */ f) =>
        Object.entries(f.s || {}).filter(
          ([, st]) => /** @type {any} */ (st).phase === "review" &&
            Date.now() - (/** @type {any} */ (st).updated || 0) < 10000,
        );
      const lifted = (doc.items || [])
        .flatMap((/** @type {any} */ i) => [...(i.forms || []), ...(i.lines || [])])
        .filter((/** @type {any} */ f) => {
          const fresh = freshOf(f);
          /* One stamp: the whole level goes up in a single write, which is
             what says it was the lift and not a graded answer. */
          return fresh.length >= 1 &&
            new Set(fresh.map(([, st]) => /** @type {any} */ (st).updated)).size === 1;
        });
      const keys = lifted[0] ? freshOf(lifted[0]).map(([k]) => k) : [];
      check("the form that was asked has its level counted as learnt, in one stamp",
        lifted.length === 1,
        `${lifted.length} forms lifted: ${keys.join(",")}`);
      /*
       * And only for exercises the card can actually be asked.
       *
       * This walk flags a sentence card — "اسمي {{name}}" — and a card
       * whose words change is never asked to be told apart from others:
       * there is nothing stable to put beside it, so `ar2pick` and the
       * grid are not on its ladder at all. The lift used to read that
       * ladder off the question instead of off the card, and a question
       * has had its blanks filled in by the time anybody sees it — so the
       * filled copy looked like an ordinary phrase, claimed every
       * exercise, and the lift wrote a review state for one the card can
       * never be dealt while leaving the level it was really on shut.
       *
       * Named rather than derived because deriving it would be
       * re-implementing which exercises a card supports, which is the
       * thing under test. The rule itself is asserted directly in
       * tests/cards.test.mjs.
       */
      check("and writes nothing for an exercise a card with a blank cannot be asked",
        !keys.includes("ar2pick") && !keys.includes("match") && !keys.includes("en2pick"),
        keys.join(",") || "(nothing written)");
      const flagBtnEasy = document.querySelector('[data-el="flag-button"]');
      check("and the menu closes",
        !document.querySelector('[data-el="flag-menu"]') && /Flagged/.test((flagBtnEasy && flagBtnEasy.textContent) || ""),
        (flagBtnEasy && flagBtnEasy.textContent) || "no flag button");
    }

    /* The naming scheme, kept honest. A -label or a -text is the second or
       third name of a block, so the block itself has to exist and has to be
       the thing wrapping them — otherwise there is no name for "move the
       whole 'this is how it's pronounced' section", which is exactly the
       kind of thing this vocabulary is for. Three blocks had labels and
       values and no name of their own until this test was written. */
    const inCard = [...document.querySelectorAll(".at-exercise [data-el]")];
    const all = new Set(inCard.map((e) => e.getAttribute("data-el")));
    const orphans = [];
    for (const el of inCard) {
      const n = el.getAttribute("data-el") || "";
      const m = /^(.*)-(label|text)$/.exec(n);
      if (!m) continue;
      const block = document.querySelector(`[data-el="${m[1]}"]`);
      if (!block) orphans.push(`${n} has no ${m[1]}`);
      else if (!block.contains(el)) orphans.push(`${n} is not inside ${m[1]}`);
    }
    check("every -label and -text sits inside a block of the same name",
      orphans.length === 0, orphans.join("; "));
    /* Which extras a card has depends on which exercise the session
       picked, and that is not the same every run — so what is checked is
       that whatever turned up is one of the named blocks, not that a
       particular one did. */
    check("the blocks that hold the extras after an answer are named",
      ["also-hint", "also-context", "also-script", "also-audio", "related-words"].some((n) => all.has(n)),
      [...all].filter((n) => (n || "").startsWith("also") || n === "related-words").join(" ") || "none on this card");

    click(buttonNamed(/Continue|Next/));
    await sleep(300);
  }

  /* The band of empty page above a question. 66px of the root's padding is
     room for the fixed chrome, and none of that chrome renders during an
     exercise — so the class that takes the room back has to be on while a
     question is up, and off the moment it isn't. */
  const root = must(document.querySelector(".at"), "the app's root element");
  check("an exercise reclaims the room reserved for the chrome",
    root.classList.contains("in-exercise"), root.className);

  /* Out again, so the rest of the run starts its own session rather than
     inheriting this one. */
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Leave session"));
  await sleep(120);
  click(buttonNamed(/^Leave$/));
  await sleep(250);
  check("and you can leave it again", !document.querySelector(".at-instruction"),
    (document.body.textContent || "").slice(0, 80));
  const back = must(document.querySelector(".at"), "the app's root element");
  check("and gives it back, so the chrome has somewhere to sit",
    !back.classList.contains("in-exercise"), back.className);

  /* And the session kept a few steps ago, which is only worth keeping if
     there is a way back to it. */
  check("a kept session puts a way back to it on the home screen",
    !!buttonNamed(/^Saved sessions$/),
    [...document.querySelectorAll("button")].map((b) => b.textContent).join("|").slice(0, 120));
  if (buttonNamed(/^Saved sessions$/)) {
    clickNamed(/^Saved sessions$/);
    await sleep(250);
    check("and it is there under the name it was given",
      /Thursday's verbs/.test(document.body.textContent || ""),
      (document.body.textContent || "").slice(0, 120));
    /* Built from the cards it named rather than replayed: the point of
       keeping a description instead of a snapshot. */
    clickNamed(/^Start$/);
    await sleep(500);
    check("and starting it builds the session again",
      !!document.querySelector(".at-instruction"),
      (document.body.textContent || "").slice(0, 100));
    click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Leave session"));
    await sleep(120);
    clickNamed(/^Leave$/);
    await sleep(250);
  }

  /* Kept for the browser check, which needs cards to have a session at
     all and cannot make them through the UI in reasonable time. */
  if (process.env.DUMP_DOC) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.DUMP_DOC, localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "");
  }
}

/* ---- the version line ----
   It answers two questions: "which version am I on?", which wants the
   release number in the headline, and "is what I merged actually
   running?", which only the commit can answer. So the checks are that
   both are shown, that the release leads, and that it does not claim to
   be current when the server is serving something else — which for an
   installed app is the ordinary case for a minute after a deploy, not an
   exotic one. */
{
  const openMenu = async () => {
    click(document.querySelector(".at-cornerbtn"));
    await sleep(150);
  };

  await openMenu();
  const ver = document.querySelector(".at-cver");
  check("the corner menu carries a version", !!ver,
    ver ? "" : document.querySelector(".at-cmenu") ? "menu open, no version line" : "the menu did not open");
  const verHead = ver && ver.querySelector("b");
  const verWhen = ver && ver.querySelector("i");
  check("the headline is the release, not a hash",
    !!verHead && /^Version 0\.1\b/.test((verHead.textContent || "").trim()),
    (verHead && verHead.textContent) || "");
  check("it names the build this bundle came from", !!ver && /abc1234/.test(ver.textContent || ""),
    (ver && ver.textContent) || "");
  check("it says when, so two deploys in a day are distinguishable",
    !!verWhen && /\d/.test(verWhen.textContent || ""), (verWhen && verWhen.textContent) || "");
  /* Three looks, side by side, one lit — rather than one button that
     cycled and made you tap twice to go back one. */
  const appearance = document.querySelector(".at-cseg .at-segmented");
  const looks = appearance ? [...appearance.querySelectorAll("button")] : [];
  check("Appearance is one picker with its options side by side",
    looks.length === 3, `${looks.length} options`);
  /* One control, not three buttons: the options are inside the track,
     which is the element carrying the picker's own name. */
  check("and they are inside the track rather than beside it",
    looks.every((b) => b.parentElement === appearance && b.classList.contains("at-seg")),
    looks.map((b) => b.className).join(" | "));
  check("and exactly one of them is lit",
    looks.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1,
    looks.map((b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`).join(" "));

  const verBtn = ver && ver.querySelector(".at-cverbtn");
  check("nothing to reload when it is the deployed one",
    !!ver && !ver.classList.contains("stale") && !!verBtn && /^Check$/.test(verBtn.textContent.trim()),
    verBtn ? verBtn.textContent : "no button");

  /* The button's whole job: ask again, without closing and reopening the
     menu, which was the only way to re-check before it existed. */
  {
    const before = versionHits;
    click(verBtn);
    await sleep(80);
    check("Check asks the server again", versionHits > before, `${before} → ${versionHits}`);
    const after = document.querySelector(".at-cver");
    check("and the menu is still open, so the answer can be read",
      !!after && !!document.querySelector(".at-cmenu"));
    check("nothing changes when nothing has changed",
      !!after && !after.classList.contains("stale"), (after && after.className) || "");
    /* Nothing on the line moved, so without a word the button reads as
       dead. */
    const said = document.querySelector(".at-snack");
    check("and it says so, rather than looking like a dead button",
      !!said && /latest version/i.test(said.textContent), (said && said.textContent) || "nothing said");
  }

  /* The sync row states where sync has got to; the button is the only
     thing that starts one. The whole row used to be the button, so
     reading the state meant risking the action — and the state is the
     part you open the menu for. */
  {
    const row = [...document.querySelectorAll(".at-cline")].find((r) => r.querySelector(".at-cact"));
    check("the sync row is a label, not a button", !!row && row.tagName !== "BUTTON",
      row ? row.tagName : "no sync row");
    const act = row && row.querySelector(".at-cact");
    check("and Sync now is a button of its own", !!act && act.tagName === "BUTTON",
      act ? `${act.tagName} "${act.textContent.trim()}"` : "none");
    const syncs = () => calls.filter((c) => c === "POST /api/sync").length;
    const before = syncs();
    click(must(row, "the sync row").querySelector(".at-clinetext"));
    await sleep(90);
    check("tapping the row starts nothing", syncs() === before, `${before} → ${syncs()}`);
    click(act);
    await sleep(140);
    check("tapping the button syncs", syncs() > before, `${before} → ${syncs()}`);
  }

  /* A deploy that landed while the menu was open: found by pressing the
     button, not by reopening the menu. */
  {
    deployedVersion = { release: "0.2", commit: "9999999", builtAt: "2026-09-05T15:00:00.000Z" };
    click(document.querySelector(".at-cverbtn"));
    await sleep(80);
    const found = document.querySelector(".at-cver");
    const btn = found && found.querySelector(".at-cverbtn");
    check("Check finds a deploy that landed while the menu was open",
      !!found && found.classList.contains("stale") && /9999999/.test(found.textContent),
      (found && found.textContent) || "");
    check("and the button becomes the one that fixes it",
      !!btn && /^Reload$/.test(btn.textContent.trim()), btn ? btn.textContent : "no button");
    deployedVersion = { release: "0.1", commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
    click(document.querySelector(".at-cornerbtn"));
    await sleep(50);
    await openMenu();
    await sleep(60);
  }

  /* A deploy lands while this bundle is the one in hand. */
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
  deployedVersion = { release: "0.2", commit: "def5678", builtAt: "2026-09-05T14:00:00.000Z" };
  await openMenu();
  await sleep(60);
  const stale = document.querySelector(".at-cver");
  check("a newer deploy is reported rather than passed over",
    !!stale && stale.classList.contains("stale") && /def5678/.test(stale.textContent),
    (stale && stale.textContent) || "");
  check("and it offers the one thing that fixes it", !!stale && !!stale.querySelector(".at-cverbtn"));
  /* Updating used to take a press and two refreshes. The worker skips
     waiting and claims the page, so a deployed one takes charge as soon as
     it has installed — but nothing told the page, so the tab went on
     running the build it loaded with and only the *next* navigation showed
     the new one. Pressing Reload before the handover had finished put you
     back at the start of it.

     jsdom has no service worker and will not let location.reload be
     stubbed, so neither half can be watched here — what is checked is that
     both are still wired up. The behaviour itself is checked in a real
     browser, against two real builds and a real worker, which is the only
     place it can be. */
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(path.resolve("src/ArabicTrainer.tsx"), "utf8");
    const updates = readFileSync(path.resolve("src/updates.ts"), "utf8");
    const watching = updates.slice(updates.indexOf("export function watchForUpdates"));
    const applying = updates.slice(updates.indexOf("export function applyUpdate"));
    check("the page takes the handover itself, without being asked",
      /addEventListener\("controllerchange"/.test(watching) && /reloadOnce\(\)/.test(watching),
      "nothing reloads when a new worker takes over");
    check("but not on a first install, which updates nothing",
      /wasControlled/.test(watching), "a first install would reload for nothing");
    check("and not on top of a question being answered",
      /held/.test(watching) && /holdUpdates/.test(updates),
      "a reload could land mid-session");
    check("Reload waits for the new worker to take control",
      /addEventListener\("controllerchange"/.test(applying), "no controllerchange listener");
    check("and it does not reload the moment it is pressed",
      !/await reg\.update\(\);\s*\n\s*window\.location\.reload/.test(applying));
    check("and it says it is working while it waits",
      /Reloading/.test(src), "the button gives no sign it was pressed");
  }

  check("the newer deploy is named by its release too", !!stale && /0\.2/.test(stale.textContent),
    (stale && stale.textContent) || "");

  /* Same build, differently labelled. Only the commit decides: a release
     string that disagreed would otherwise send everyone to Reload for
     nothing. */
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
  deployedVersion = { release: "0.9", commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
  await openMenu();
  await sleep(60);
  const relabelled = document.querySelector(".at-cver");
  const relabelledBtn = relabelled && relabelled.querySelector(".at-cverbtn");
  check("a relabelled release on the same build is not a new deploy",
    !!relabelled && !relabelled.classList.contains("stale") &&
      !!relabelledBtn && /^Check$/.test(relabelledBtn.textContent.trim()),
    (relabelled && relabelled.textContent) || "");

  /* Offline is not a failed deploy, and must not be shown as one. */
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
  const realFetch = w.fetch;
  w.fetch = globalThis.fetch = async (input, opts) => {
    if (String(input).includes("/api/version")) throw new Error("offline");
    return realFetch(input, opts);
  };
  await openMenu();
  await sleep(60);
  const offline = document.querySelector(".at-cver");
  check("unreachable is not reported as out of date",
    !!offline && !offline.classList.contains("stale") && /abc1234/.test(offline.textContent),
    (offline && offline.textContent) || "");
  w.fetch = globalThis.fetch = realFetch;

  /*
   * And what the menu says about sync while there is no connection.
   *
   * It used to say one sentence — "Offline — will retry" — for every way a
   * sync can fail, including the two that never clear by themselves. So a
   * learner whose passphrase had been refused was told, for ever, that
   * they were offline and it would sort itself out. Now the line says
   * which it is, and being offline says where the work is rather than only
   * what is missing.
   */
  const wasOnline = Object.getOwnPropertyDescriptor(w.navigator, "onLine");
  Object.defineProperty(w.navigator, "onLine", { value: false, configurable: true });
  w.dispatchEvent(new w.Event("offline"));
  await sleep(60);
  /* The menu is already open from the check above — asked rather than
     assumed, so this reads the same whether or not that changes. */
  if (!document.querySelector(".at-cmenu")) await openMenu();
  await sleep(60);
  const line = document.querySelector(".at-clinetext");
  check("offline, the sync line says so and says the work is safe",
    !!line && /offline/i.test(line.textContent) && /this device/i.test(line.textContent),
    (line && line.textContent) || "no sync line in the menu");
  const dot = document.querySelector(".at-cmenu .at-cdot");
  check("and the dot stands for offline rather than for a failure",
    !!dot && dot.className.includes("off"), (dot && dot.className) || "no dot");
  if (document.querySelector(".at-cmenu")) {
    click(document.querySelector(".at-cornerbtn"));
    await sleep(40);
  }
  if (wasOnline) Object.defineProperty(w.navigator, "onLine", wasOnline);
  else Object.defineProperty(w.navigator, "onLine", { value: true, configurable: true });
  w.dispatchEvent(new w.Event("online"));
  await sleep(60);

  deployedVersion = { release: "0.1", commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
  /* The snackbar the Check raised outlives this block — it dwells for four
     seconds — and the gallery below counts what is on screen. Dismissed
     here rather than there, because the pill is portalled outside the menu
     and clicking it closes the menu with it. */
  click(document.querySelector(".at-snackx"));
  await sleep(40);
}

/* ---- the card tiles, in the student's list ----
   They carried the language, the decks the card was in, how many forms it
   had and how many recordings — four facts in a tile you scan past. Now:
   the word, what it means, and when it was added, in the same tile the
   progress screen uses, three to a row. */
{
  click(buttonNamed(/^Cards$/));
  await sleep(400);
  const tiles = [...document.querySelectorAll(".at-cardgrid .at-minicard")];
  check("the student's cards are tiles from the library, not a copy of one",
    tiles.length > 0,
    tiles.length ? tiles[0].className : `no tile — ${document.body.textContent.slice(0, 80).replace(/\s+/g, " ")}`);
  /* The tile for a known card, found by the word itself rather than by
     being first in a list nothing here decides the order of — and matched
     whole, because "كتاب" sits inside "الكتاب كبير" and a substring match
     reads the phrase's tile as the word's. */
  const tile = tiles.find((t) => ((t.querySelector(".ar") || {}).textContent || "").trim() === card.ar);
  const shown = tile ? tile.textContent : "";
  check("a tile says the word, its meaning and when it was added",
    !!tile &&
      ((tile.querySelector(".at-minien") || {}).textContent || "").trim() === card.en &&
      /\d/.test(((tile.querySelector(".at-minimeta") || {}).textContent || "")),
    shown.replace(/\s+/g, " ").trim() ||
      tiles.map((t) => (t.textContent || "").replace(/\s+/g, " ").slice(0, 16)).join(" | ") || "(no tile)");
  check("and nothing about decks, forms, recordings or the language",
    !!tile && !tile.querySelector(".at-minidecks, .at-flag") && !/form|♪|Arabic/i.test(shown),
    shown.replace(/\s+/g, " ").trim() || "(no tile)");

  /* A frame is listed as it was written, holes and all — drawn the way
     the editor draws them since 0.179: the blank's name, and not the
     braces it is stored as, which are a storage format and are on no
     screen any more. The name is Latin inside a line sized for the
     taught script, and left plain it came out larger and heavier than
     the Arabic beside it, so the hole is marked for the stylesheet to
     size it as the Latin it is. What it is marked with is checked here,
     and what that costs in size in layers.test.mjs. */
  {
    const frameTile = tiles.find((t) => !!t.querySelector(".ar .at-slot"));
    const face = frameTile && frameTile.querySelector(".ar");
    const holes = face ? [...face.querySelectorAll(".at-slot")] : [];
    check("a frame's tile marks the hole in it",
      holes.length === 1 && holes[0].textContent === "name",
      face ? `${holes.length} marked in "${face.textContent}"` : "no frame tile");
    /* The words around it are left alone: marking the whole line would
       shrink the card's own script to the size of its blank. */
    check("and marks only the hole",
      !!face && face.textContent.replace("name", "").trim() === "اسمي",
      face ? face.textContent : "no frame tile");
    check("and the braces it is stored with are not on the tile",
      !!face && !/[{}]/.test(face.textContent || ""),
      face ? face.textContent : "no frame tile");
  }

  click(buttonNamed(/^Home$/));
  await sleep(300);
}

/* ---- a progress tile opens the card ----
   Every other small card in the app opens when you tap it. These showed
   you how far along a card was and then had nothing to say when you
   asked to see it, which is the moment you most want to.

   The cards behind a count are the only list of them on this screen now:
   the collapsible deck sections, which carried their own copy of every
   card, are gone. */
{
  click(buttonNamed(/^Progress$/));
  await sleep(400);
  const opener = /** @type {HTMLButtonElement[]} */ ([
    ...document.querySelectorAll("button.at-rung"),
  ]).find((b) => !b.disabled);
  click(opener);
  await sleep(250);
  const tile = document.querySelector(".at-cardgrid .at-minicard");
  /* Not a real button — two of these carry Edit and Delete inside them —
     but a keyboard has to reach it and Enter has to open it. */
  check("a progress tile can be tapped and tabbed to",
    !!tile && tile.getAttribute("role") === "button" && tile.getAttribute("tabindex") === "0",
    tile ? `role=${tile.getAttribute("role")} tabindex=${tile.getAttribute("tabindex")}` : "no tile");
  /* Opened with the keyboard rather than the mouse, so the handler that
     makes the role true is the one under test. */
  if (tile) tile.dispatchEvent(new anyWindow.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await sleep(300);
  const open = document.querySelector(".at-screen .at-readout, .at-readout");
  check("tapping one opens the whole card", !!open,
    (document.body.textContent || "").slice(0, 100).replace(/\s+/g, " "));
  /* The same readout the Cards tab opens, not a second description of a
     card written for this screen. */
  const tileWord = tile && tile.querySelector(".ar");
  check("and it is the card the tile was showing",
    !!open && !!tileWord && (open.textContent || "").includes((tileWord.textContent || "").trim()),
    open ? (open.textContent || "").slice(0, 60).replace(/\s+/g, " ") : "(nothing open)");
  /* Which decks a card came in, and which language pack it belongs to, are
     a teacher's questions about their own material. The student opened the
     card to look at the card. */
  const readout = open ? (open.textContent || "") : "";
  check("and it stops at the card, without the shelf it came off",
    !!open && !/Where it lives/i.test(readout) && !/In no deck/i.test(readout),
    readout.replace(/\s+/g, " ").slice(0, 120) || "(nothing open)");
  click([...document.querySelectorAll("button")].find((b) => /^(Back|Done|Close)$/i.test(b.textContent || "") || b.getAttribute("aria-label") === "Back"));
  await sleep(250);
  /* And put the list away again, so the walk below starts where it thinks
     it does: pressing a count toggles it, and this one is already open. */
  click(opener);
  await sleep(200);

  /* ---- and the counts at the top open too ----
     A number you want to see the cards behind is a number worth pressing.
     They were plain text, so the only way to find out which cards were
     still new was to read every deck. */
  const counts = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("button.at-rung")]);
  /* Every card, then one per level of the ladder, then the ones that have
     been all the way up, then the ones that have stuck. They used to be
     the four maturities. */
  check("every count at the top is a button", counts.length === 7, `${counts.length} tiles`);
  const live = counts.find((b) => !b.disabled);
  check("a count with cards behind it can be pressed", !!live,
    counts.map((b) => `${(b.textContent || "").replace(/\s+/g, " ")}${b.disabled ? " (off)" : ""}`).join(" · "));
  const said = Number(((live || {}).textContent || "").trim().match(/^\d+/));
  click(live);
  await sleep(300);
  const shown = document.querySelectorAll(".at-cardgrid .at-minicard");
  check("pressing it shows that many cards, at the size they come smallest",
    shown.length === said, `said ${said}, showed ${shown.length}`);
  /* And this one — every card at once — carries no bars: its cards are
     spread over every level, so one card's 40% and another's would be
     forty per cent of different climbs. The bars belong under a level,
     where they measure the same thing on every tile. */
  check("but the list of every card carries no bars, which would compare different climbs",
    !/All cards/.test((live || {}).textContent || "") ||
      ![...shown].some((t) => t.querySelector(".at-minibar")),
    `${[...shown].filter((t) => t.querySelector(".at-minibar")).length} of ${shown.length} barred`);
  /* On a screen of its own, titled by the tile that opened it. They used
     to open as a strip under the grid, which put a list of any length
     between the tiles and everything below them — reading it meant
     scrolling past the tiles, and getting back meant scrolling up to find
     the one that was open and pressing it again. */
  const openHead = () =>
    (([...document.querySelectorAll(".at-screen.over .at-screenhead h2")].pop() || {}).textContent || "").trim();
  const pressed = /** @type {any} */ (live || null);
  check("and they open on a screen of their own, named after the tile",
    !!openHead() && !!pressed && (pressed.textContent || "").includes(openHead()),
    `screen "${openHead()}", tile "${pressed ? (pressed.textContent || "").replace(/\s+/g, " ").trim() : "none"}"`);
  check("the tile says it opens one, rather than claiming to expand",
    !!pressed && pressed.getAttribute("aria-haspopup") === "dialog" && !pressed.getAttribute("aria-expanded"),
    pressed ? `haspopup=${pressed.getAttribute("aria-haspopup")} expanded=${pressed.getAttribute("aria-expanded")}` : "no tile");
  /* And Back is the way out, the same as every other screen in the app.
     The topmost screen's Back, not the first one found: a walk above this
     left its own screen open underneath, and screens stack. */
  const topScreen = [...document.querySelectorAll(".at-screen.over")].pop();
  click([...(topScreen ? topScreen.querySelectorAll("button") : [])]
    .find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(250);
  check("and Back is the way out of them",
    document.querySelectorAll(".at-cardgrid .at-minicard").length === 0,
    `${document.querySelectorAll(".at-cardgrid .at-minicard").length} still up`);
  check("which brings the tiles back",
    document.querySelectorAll("button.at-rung").length === 7,
    `${document.querySelectorAll("button.at-rung").length} tiles`);

  /* ---- the tiles say what a level asks, not what number it is ----
     Six of these used to share one row, which on a phone is three columns
     of eight-point capitals: a row of numbers whose captions could not be
     read, on the screen whose job is saying where you are. */
  {
    const named = counts.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim());
    check("every tile says what its level asks, in words",
      counts.length === 7 && named.every((t) => /[A-Za-z]{3}/.test(t)) &&
        !named.some((t) => /^\d+\s*Level \d+$/.test(t)),
      named.join(" · "));
    check("in the same words a card's own screen uses",
      named.some((t) => /What it means/.test(t)) && named.some((t) => /Learnt/.test(t)),
      named.join(" · "));
    /* Cleared stands between the top level and Learnt, which is the whole
       reason it exists: a card worked all the way up tonight used to be
       filed under "write it from its meaning" beside cards that had only
       just reached that rung. */
    check("and a card up its whole ladder is counted apart from one still on the top rung",
      named.findIndex((t) => /Cleared/.test(t)) ===
        named.findIndex((t) => /Learnt/.test(t)) - 1 &&
        named.some((t) => /Cleared/.test(t)),
      named.join(" · "));
    check("and each carries a drawing of what it asks",
      counts.every((b) => !!b.querySelector("svg")),
      `${counts.filter((b) => b.querySelector("svg")).length} of ${counts.length} drawn`);
    /* Learnt is what the other five are climbing towards, so it is the one
       that has to carry across a room. */
    const learnt = counts.find((b) => /Learnt/.test(b.textContent || ""));
    check("with Learnt marked out from the rest",
      !!learnt && learnt.className.includes("learnt"),
      learnt ? learnt.className : "no Learnt tile");
  }

  /* ---- and the two at the top say when each card comes back ----
     Cleared and Learnt are the tiles where the climb is over and what is
     left is time. The bar a level's list draws would be full on every card
     there — a column of hundreds telling two cards apart from nothing — so
     each one says when it is next asked instead. That was on the card's
     own screen and nowhere in the list, which left a card coming back
     tonight looking exactly like one coming back in a month. */
  {
    const top = counts.filter((b) => /Cleared|Learnt/.test(b.textContent || ""));
    check("both tiles at the top of the ladder are there to open", top.length === 2,
      counts.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()).join(" · "));
    const openable = top.filter((b) => !b.disabled);
    /* Asserted rather than assumed: with neither tile holding a card the
       three checks below would pass by never running, and the fixture is
       what puts cards up there. */
    check("and at least one of them has cards behind it", openable.length > 0,
      top.map((b) => `${(b.textContent || "").replace(/\s+/g, " ").trim()}${b.disabled ? " (off)" : ""}`).join(" · "));
    for (const tile of openable) {
      const name = (tile.textContent || "").replace(/\s+/g, " ").trim().replace(/^\d+\s*/, "");
      click(tile);
      await sleep(300);
      const cards = [...document.querySelectorAll(".at-cardgrid .at-minicard")];
      const said = cards.map((t) => ((t.querySelector(".at-minimeta") || {}).textContent || "").trim());
      check(`${name}: every card says when it is next reviewed`,
        cards.length > 0 && said.every((l) => /^(Next review in \S+|Review due now)$/.test(l)),
        said.join(" · ").slice(0, 140) || "(no small print)");
      /* As how long away it is, rather than a date to count from: hours
         while it is hours, days once it is days. */
      check(`${name}: as a gap, in hours or days`,
        said.every((l) => l === "Review due now" || /in \d+(\.\d+)?(m|h|d|mo|y)$/.test(l)),
        said.join(" · ").slice(0, 140));
      /* And no bar, which is the whole reason there is a line here at all. */
      check(`${name}: and no bar, which would be full on every one of them`,
        !cards.some((t) => t.querySelector(".at-minibar")),
        `${cards.filter((t) => t.querySelector(".at-minibar")).length} of ${cards.length} barred`);
      const over = [...document.querySelectorAll(".at-screen.over")].pop();
      click([...(over ? over.querySelectorAll("button") : [])]
        .find((b) => b.getAttribute("aria-label") === "Back"));
      await sleep(250);
    }
  }

  /* ---- and the decks, as how far each is from finished ----
     The ladder says where the cards are; this says where the decks are,
     which is the question somebody working through a course has. A
     percentage rather than a count, because a deck of thirty and a deck of
     three hundred are not comparable by how many cards are left. */
  {
    const decks = [...document.querySelectorAll(".at-deckstat")];
    check("each deck being studied has a tile of its own", decks.length > 0,
      `${decks.length} decks`);
    const said = decks.map((d) => (d.textContent || "").replace(/\s+/g, " ").trim());
    /* A card in two decks is in both, and a deck reaches this side of the
       app as a tag on a card — so a card kept under the first deck that
       carried it had left every other deck it is in. The book is in Lesson
       1 and in Review; without both tiles here, one of them is counting a
       card it holds as somebody else's. */
    const named = (/** @type {string} */ name) =>
      decks.find((d) => new RegExp(`^${name}`).test((d.textContent || "").trim()));
    check("a deck holding a card that is also in another deck still counts it",
      !!named("Review"), said.join(" · ") || "(no deck tiles)");
    check("and the deck it was already in counts it too",
      !!named("Lesson 1"), said.join(" · ") || "(no deck tiles)");
    const countOf = (/** @type {any} */ d) =>
      d ? ((d.querySelector(".at-deckstatnote") || {}).textContent || "").trim() : "";
    /* Review holds the book and nothing else. Lesson 1 is unchanged by the
       book also being in Review — a card in two decks is in both, not moved
       from one to the other. */
    check("each counting the cards it actually holds",
      /of 1 card fully learnt$/.test(countOf(named("Review"))) &&
        /of 7 cards fully learnt$/.test(countOf(named("Lesson 1"))),
      `Review: ${countOf(named("Review"))} · Lesson 1: ${countOf(named("Lesson 1"))}`);
    /* And a value is in no deck. "Raphael" is sent with whichever deck's
       phrase leaves a hole of its name, which is not the same as being
       filed in it — so Introductions holds its one phrase and not the two
       names borrowed to fill it. */
    check("while a value borrowed by a deck is not counted as one of its cards",
      !named("Introductions") || /of 1 card fully learnt/.test(countOf(named("Introductions"))),
      countOf(named("Introductions")) || "(no Introductions tile)");
    /* Read off the figure itself rather than the tile's text: a deck
       called "Lesson 1" beside 42% reads as 142 when the two are run
       together, which is how this check first passed while measuring
       nothing. */
    const pctOf = (/** @type {Element} */ d) =>
      ((d.querySelector("b") || {}).textContent || "").trim();
    check("saying how much of it is learnt, as a percentage",
      decks.every((d) => /^\d+%$/.test(pctOf(d))),
      decks.map(pctOf).join(" · "));
    check("and drawn as a bar of the same width as the number",
      decks.every((d) => {
        const bar = /** @type {any} */ (d.querySelector(".at-deckbar > span"));
        return !!bar && bar.style.width === pctOf(d);
      }),
      decks.map((d) => {
        const bar = /** @type {any} */ (d.querySelector(".at-deckbar > span"));
        return bar ? bar.style.width : "no bar";
      }).join(" · "));
    /* The bar is the number again, so a screen reader is told once. */
    check("the bar is drawing, and not read out twice",
      decks.every((d) => {
        const bar = d.querySelector(".at-deckbar");
        return !!bar && bar.getAttribute("aria-hidden") === "true";
      }));
    /* And how many are finished outright, which is a different fact from
       the figure above it now that the figure counts the levels in
       between: one says how far the deck has got, the other how much of it
       is behind you for good. It said "learnt" while the two were the same
       number. */
    check("and beside it, how many of its cards are finished outright",
      decks.every((d) => /\d+ of \d+ cards? fully learnt/.test((d.textContent || "").replace(/\s+/g, " "))),
      said.join(" · "));
  }

  /* ---- and a level's cards come out grouped by how they are going ----
     Every card under a level tile is on that level, so what tells them
     apart is the status: paused first, because it is the one that means
     something slipped and the list is paged. "Cards" pressed above is the
     one tile that is not grouped — its cards are spread over every level,
     and a run would mean nothing. */
  /* A level tile says what its level asks — "What it means" — and carries
     the number underneath, so it is the number that names it here rather
     than the whole of its text. */
  const levelTile = counts.find(
    (b) => !b.disabled && /Level \d/.test((b.textContent || "").replace(/\s+/g, " ")),
  );
  check("a level has cards behind it", !!levelTile,
    counts.map((b) => (b.textContent || "").replace(/\s+/g, " ")).join(" · "));
  click(levelTile);
  await sleep(300);
  const heads = [...document.querySelectorAll(".at-cardgrid .at-grouphead")];
  const headed = heads.map((h) => (h.textContent || "").replace(/\s+/g, " ").trim());
  check("the cards under it are grouped by how they are going", heads.length > 1,
    headed.join(" · ") || "no headings");
  /* Named in the order the runs are declared in, and never one the cards
     are not in: a heading over nothing is a run that should not be drawn. */
  /* The count sits against the label with a gap laid on by the styles
     rather than a space in the markup, so there is nothing between them
     to match. */
  check("and each heading is a status, with how many are in it",
    heads.length > 0 && headed.every((h) => /^(Paused|Learning|Not started)\s*\d+$/.test(h)),
    headed.join(" · ") || "no headings");
  /* ---- and each of them says how far it has got on that level ----
     The headings say which of three states a card is in, which is the
     difference between started and not. This is the difference between a
     card nearly through the level and one that has just begun, and those
     look identical under "Learning" without it. */
  {
    const tiles = [...document.querySelectorAll(".at-cardgrid .at-minicard")];
    const pctOf = (/** @type {Element} */ t) =>
      ((t.querySelector(".at-minibar b") || {}).textContent || "").trim();
    check("every card under a level says how far it has got on it, as a percentage",
      tiles.length > 0 && tiles.every((t) => /^\d+%$/.test(pctOf(t))),
      tiles.map(pctOf).map((p) => p || "(none)").join(" · ") || "no tiles");
    /* Read off the bar itself rather than the tile's text, the way the
       deck bars are: a number beside a word runs into it. */
    check("and the bar beside it is drawn to the width of that number",
      tiles.every((t) => {
        const fill = /** @type {any} */ (t.querySelector(".at-minibarrail > span"));
        return !!fill && fill.style.width === pctOf(t);
      }),
      tiles.map((t) => {
        const fill = /** @type {any} */ (t.querySelector(".at-minibarrail > span"));
        return fill ? fill.style.width : "no bar";
      }).join(" · "));
    /* The bar is the number again, so a screen reader is told once. */
    check("the bar is drawing, and not read out twice",
      tiles.every((t) => {
        const rail = t.querySelector(".at-minibarrail");
        return !!rail && rail.getAttribute("aria-hidden") === "true";
      }));
    /* And it is never full: a card whose level is done has moved up and is
       under the next tile along. */
    check("and none of them is full, because a finished level is the next tile",
      tiles.every((t) => Number(pctOf(t).replace("%", "")) < 100),
      tiles.map(pctOf).join(" · "));
  }

  /* The counts are of the whole run, so they add up to the number on the
     tile whichever page the list is showing. */
  const inRuns = headed.reduce((n, h) => n + Number(h.match(/\d+$/)), 0);
  const onTile = Number(((levelTile || {}).textContent || "").trim().match(/^\d+/));
  check("and the runs together are the number on the tile", inRuns === onTile,
    `runs ${inRuns}, tile ${onTile}`);
  click(levelTile);
  await sleep(200);

  click(buttonNamed(/^Home$/));
  await sleep(300);
}

/* ---- the language switch ----
   This device has cards in two languages, so the switch is there. What it
   decides is meant to hold over the whole of Learning, and the count at
   the top of Progress is the cheapest place to watch it do that: switch a
   language off and its cards leave, everywhere. */
{
  click(buttonNamed(/^Progress$/));
  await sleep(400);
  /* The first tile is "Cards" — every card that is anywhere on the ladder. */
  const cardCount = () =>
    Number(((document.querySelector("button.at-rung") || {}).textContent || "").trim().match(/^\d+/));
  const both = cardCount();
  const swBtn = () => document.querySelector(".at-langbtn");
  const swSaid = () => {
    const b = swBtn();
    return b ? String(b.getAttribute("aria-label")) : "nothing in the chrome bar";
  };
  check("somebody learning two languages gets a switch for them", !!swBtn(), swSaid());
  check("and it says every language is on, without naming any of them",
    ((swBtn() || {}).textContent || "").trim() === "All", ((swBtn() || {}).textContent || "").trim());

  click(swBtn());
  await sleep(200);
  const rows = () => [...document.querySelectorAll(".at-langmenu .at-ck")];
  check("pressing it opens the languages being learnt", rows().length === 2,
    rows().map((r) => (r.textContent || "").replace(/\s+/g, " ")).join(" · ") || "nothing opened");
  check("with every one of them ticked to start with",
    rows().length > 0 && rows().every((r) => r.getAttribute("aria-checked") === "true"),
    rows().map((r) => r.getAttribute("aria-checked")).join(","));

  /* Switch the second language off. */
  const viRow = rows().find((r) => /Vietnamese/.test(r.textContent || ""));
  check("the list names the languages", !!viRow,
    rows().map((r) => (r.textContent || "").replace(/\s+/g, " ")).join(" · "));
  click(viRow);
  await sleep(300);
  check("switching one off says which one is left, on the button itself",
    ((swBtn() || {}).textContent || "").trim() === "AR", ((swBtn() || {}).textContent || "").trim());
  check("and its cards go from the rest of Learning", cardCount() === both - 1,
    `${both} with both, ${cardCount()} with one`);

  /* The last one on stays on: an app with no languages in it is a blank
     screen with nothing to say why. */
  const arRow = rows().find((r) => /Arabic/.test(r.textContent || ""));
  click(arRow);
  await sleep(250);
  check("the last language on cannot be switched off",
    !!arRow && arRow.getAttribute("aria-checked") === "true" && cardCount() === both - 1,
    `${arRow ? arRow.getAttribute("aria-checked") : "no row"}, ${cardCount()} cards`);
  check("and the row says why rather than just refusing",
    /the only one on/i.test((arRow || {}).textContent || ""),
    ((arRow || {}).textContent || "").replace(/\s+/g, " "));

  /* And back on again, which is the state everything else expects. */
  click(rows().find((r) => /Vietnamese/.test(r.textContent || "")));
  await sleep(300);
  check("switching it back on brings its cards back",
    cardCount() === both && ((swBtn() || {}).textContent || "").trim() === "All",
    `${cardCount()} cards, button says ${((swBtn() || {}).textContent || "").trim()}`);
  /* Anywhere outside it puts it away. */
  click(document.querySelector(".at-brand"));
  await sleep(200);
  check("and pressing away from it closes it",
    !document.querySelector(".at-langmenu"),
    document.querySelector(".at-langmenu") ? "still open" : "put away");

  click(buttonNamed(/^Home$/));
  await sleep(300);
}

/* ---- a session: start, answer one card, continue ---- */
/* What this card already carries. Two walks above answer a question each,
   and which card they draw is a matter of chance — so "one answer writes
   one state" has to be counted from here rather than from nothing, which
   is what made this fail about one run in seven. */
/** @param {any} it */
const stateKeys = (it) =>
  [...Object.keys((it || {}).s || {}), ...((it || {}).subs || []).flatMap((/** @type {any} */ sb) => Object.keys(sb.s || {}))];
const beforeStates = stateKeys(
  JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "{}").items
    ?.find((/** @type {any} */ i) => i.id === "srv" + card.id)
).length;
/* ---- the weak-skills button sits under Start session ----
   Its own walk at the foot of this file drives it on a deck with something
   actually going wrong. Here it is the offer itself: on the ordinary home
   screen it is there, nothing is written beside it, and when there is
   nothing to fix it is dimmed and says so on being pressed rather than
   swallowing the press. */
{
  const weakBtn = buttonNamed(/^Weak skills$/);
  check("the home screen offers a weak-skills session", !!weakBtn,
    (document.body.textContent || "").slice(0, 120).replace(/\s+/g, " "));
  const row = weakBtn && weakBtn.closest(".at-row");
  check("and nothing is written beside it either way",
    !!row && !/slipping/.test(row.textContent || ""),
    row ? (row.textContent || "").replace(/\s+/g, " ") : "no row");
  /* Dimmed here — this learner has nothing going wrong — and dimmed is not
     dead: the press arrives and comes back with the reason. */
  const dimmed = !!weakBtn && weakBtn.getAttribute("aria-disabled") === "true";
  check("with nothing slipping, the button is dimmed and still takes a press",
    dimmed && !weakBtn.disabled,
    weakBtn ? `aria-disabled=${weakBtn.getAttribute("aria-disabled")} disabled=${weakBtn.disabled}` : "no button");
  if (dimmed) {
    click(weakBtn);
    await sleep(200);
    const said = document.querySelector(".at-snack");
    check("and pressing it says why nothing happened, rather than nothing at all",
      !!said && /no weak skill to fix right now/i.test(said.textContent || ""),
      said ? (said.textContent || "").replace(/\s+/g, " ") : "nothing said");
    /* And it started no session: the whole point of the dimming. */
    check("and no session starts from it", !document.querySelector(".at-instruction"),
      (document.querySelector(".at-instruction") || {}).textContent || "none");
    const shut = document.querySelector(".at-snackx");
    if (shut) click(shut);
    await sleep(200);
  }
}
click(buttonNamed(/^Start session$/));
await sleep(400);
const instruction = document.querySelector(".at-instruction");
check("a session started and shows an exercise", !!instruction, (instruction && instruction.textContent) || "");
const input = document.querySelector(".at-answerbox input");
const choice = document.querySelector(".at-answerbox .at-chips button");
/* A question answered by tapping one of a few: which word this is, or
   which of these meanings it has. Whichever tile is first will do — this
   walk is about a session starting and an answer being marked, not about
   reading Arabic. */
const tile = document.querySelector('[data-el="answer-choices"] .at-reply');
if (input) {
  const lang = input.getAttribute("lang");
  check(
    "answer input is declared as the card's language (or none for English), never hard-coded 'ar'",
    lang === null || lang === "ar-PS",
    `lang=${lang}, exercise: ${instruction && instruction.textContent}`
  );
  const setter = must(
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
    "the input's value descriptor"
  ).set;
  must(setter, "the input's value setter").call(input, "book");
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(50);
  click(buttonNamed(/^Check$/));
} else if (choice || tile) {
  click(choice || tile);
  await sleep(50);
  click(buttonNamed(/^Check$/));
} else if (await playGrid()) {
  /* A grid answers itself, Check and all. */
} else {
  check("found something to answer with", false, document.body.textContent.slice(0, 200));
}
await sleep(200);
check("the answer was marked", /The answer is:|Incorrect\.|Not all of them|Correct!|Good job!|Nicely done!|Great!/.test(document.body.textContent),
  (document.querySelector('[data-el="verdict"]') || {}).textContent || (document.body.textContent || "").slice(0, 80));
click(buttonNamed(/Continue|Next/));
await sleep(900); // the 600 ms save debounce
const after = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
const answered = after.items.find((/** @type {any} */ i) => i.id === "srv" + card.id) || { s: {}, subs: [] };
check("the course card is still in storage after the session", after.items.some((/** @type {any} */ i) => i.id === "srv" + card.id), `items=${after.items.map((/** @type {any} */ i) => i.id).join(",")}`);
const storedStates = stateKeys(answered);
check("answering one question writes one state, and nothing untouched",
  storedStates.length - beforeStates <= 1,
  `stored states: ${storedStates.join(",")} · ${beforeStates} before the session`);
check("no console errors during the session", errors.length === 0, errors.slice(0, 3).join(" | "));

/* ---- the component gallery ----
   Every specimen in it is a real component called with real props, so
   rendering the whole thing is what catches a prop shape that has drifted:
   the gallery is only worth having if it is right. */
{
  const before = errors.length;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { ComponentGallery } = await import(path.join(out, "gallery.js"));
  const galleryRoot = createRoot(host);
  galleryRoot.render(React.createElement(ComponentGallery));
  await sleep(400);

  const shown = host.textContent;
  check("the gallery renders", /Every reusable component/.test(shown), shown.slice(0, 80));
  check("no console errors rendering the gallery", errors.length === before,
    errors.slice(before, before + 3).join(" | "));

  /* Named rather than counted: a component quietly dropped from the gallery
     is the way it stops being a full list. */
  const missing = [
    "Lede", "Help", "Meta", "Notice", "Button", "IconButton", "Segmented", "Field",
    "CheckList", "LanguageRadio", "ModeSelector", "Section", "Tabs", "Screen",
    "SpaceFrame", "Empty", "Stat", "Tile", "TileNote", "CardTile", "CardReadout",
    "ItemList", "ConfirmModal", "PlayButton", "ClipList", "Icon", "LanguageTag",
    "Snackbar", "KeysButton", "FilterBar",
  ].filter((n) => !shown.includes(n));
  check("every component in the library has a row", missing.length === 0, `missing: ${missing.join(", ")}`);

  /* A card the teacher has named is listed under that name rather than
     under its own words — a verb whose word is the form a dictionary lists
     names one cell of its table, not the verb. The name is the headline,
     and it stands in for the meaning line rather than sitting above it, so
     "to eat" is not followed by "he ate" correcting it. Drawn in the
     interface face rather than the taught script's: a name is whatever was
     typed, and every size in the stylesheet is tuned against the script. */
  const named = host.querySelector(".at-mininame");
  check("a card with a name of its own is listed under it",
    !!named && /to eat/.test(named.textContent || ""),
    named ? (named.textContent || "").trim() : "(no named tile)");
  const namedTile = named ? named.closest(".at-minicard") : null;
  check("and the script it is built on is still shown underneath",
    !!namedTile && /\u0623\u0643\u0644/.test((namedTile.querySelector(".ar") || {}).textContent || ""),
    namedTile ? (namedTile.textContent || "").replace(/\s+/g, " ").trim() : "(no tile)");
  check("while the dictionary form's own meaning is not",
    !!namedTile && !/he ate/.test(namedTile.textContent || ""),
    namedTile ? (namedTile.textContent || "").replace(/\s+/g, " ").trim() : "(no tile)");

  /* The specimens have to actually render something, not just be listed. */
  check("specimens rendered, not just names", host.querySelectorAll(".at-galvbody").length >= 30,
    `${host.querySelectorAll(".at-galvbody").length} specimens`);

  /* Every place a component turns up has a name a person would use.
     Without this, adding a screen quietly falls through to its function
     name with the capitals spaced out — readable, but not the answer to
     "where would I see this?", and nothing would say so. */
  {
    const { placeOf } = await import(path.join(out, "gallery.js"));
    const { COMPONENT_USES } = await import(path.resolve("src/component-uses.js"));
    const nameless = new Set();
    for (const uses of Object.values(COMPONENT_USES)) {
      for (const use of uses) if (!placeOf(use).known) nameless.add(use.where);
    }
    check("every place a component is used has a name in plain words",
      nameless.size === 0, [...nameless].join(", ") || "all named");
  }

  /* The picker's two widths, named the way they are asked for. "Full
     size" said nothing about which dimension; the difference is width. */
  const segRow = [...host.querySelectorAll(".at-galrow")]
    .find((r) => (r.querySelector(".at-galname") || {}).textContent === "Segmented");
  const variants = segRow
    ? [...segRow.querySelectorAll(".at-galvlabel")].map((e) => e.textContent)
    : [];
  check("the picker's variants say compact from full-width",
    variants.some((t) => /full-width/.test(t)) && !variants.some((t) => /full size/.test(t)),
    variants.join(" | ") || "no Segmented row");

  /* Numbers to point at. Counted while rendering, so the way they break is
     by carrying on from where the last render left off — 1, 2, 3 on the
     first pass and 36, 37, 38 on the next — which is why the sequence
     itself is what is checked rather than merely that a badge exists. */
  const badges = [...host.querySelectorAll(".at-galrow")]
    .map((r) => (r.querySelector(".at-galid") || {}).textContent || "");
  check("every component carries a number, counting from one in order",
    badges.length > 20 && badges.every((b, i) => Number(b) === i + 1),
    `${badges.length} rows, ${badges.slice(0, 3).join(",")} … ${badges.slice(-2).join(",")}`);
  const subs = [...host.querySelectorAll(".at-galid.sub")].map((e) => e.textContent);
  check("and every specimen is numbered under its own component",
    subs.length > 20 && subs.every((t) => /^\d+\.\d+$/.test(t)),
    `${subs.length} specimens, e.g. ${subs.slice(0, 3).join(" ")}`);
  check("the icon set is laid out", host.querySelectorAll(".at-galicon").length >= 30,
    `${host.querySelectorAll(".at-galicon").length} icons`);
  /* The snackbar, driven the way the app drives it: the gallery's own
     buttons go through useSnackbarState, so this exercises the hook, the
     portal and the styles' one contract — that it lands inside `.at` and
     not on the body, where it would render themeless. */
  {
    const raise = [...host.querySelectorAll(".at-galrow")]
      /* Past the entry's number badge, which is the first thing in the
         head now — matching from the very start would find nothing. */
      .find((r) => /^\d*\s*Snackbar/.test(r.textContent))
      ;
    const good = raise && [...raise.querySelectorAll("button")].find((b) => b.textContent === "good");
    click(good);
    await sleep(60);
    const pill = document.querySelector(".at-snack");
    check("a snackbar appears when one is raised", !!pill && /Kitaab saved/.test(pill.textContent),
      (pill && pill.textContent) || "nothing showed");
    check("it is announced to a screen reader", !!pill && pill.getAttribute("role") === "status");

    const warn = raise && [...raise.querySelectorAll("button")].find((b) => b.textContent === "warn");
    click(warn);
    await sleep(60);
    check("a second message replaces the first rather than stacking",
      document.querySelectorAll(".at-snack").length === 1,
      `${document.querySelectorAll(".at-snack").length} on screen`);
  }

  /* The confirmation, for the same contract as the snackbar and one more.
     `--z-modal` is the highest layer in the app, but a z-index only ranks an
     element against its siblings: a confirmation left where it was written —
     inside a space frame, which is itself a layer — was sealed into that
     frame and a screen opened over the frame covered it, however high the
     modal's own number went. That was the restore-backup bug: the question
     appeared only once you left the screen that asked it. So what is checked
     is where it lands, not what it is numbered. */
  {
    const modalRow = [...host.querySelectorAll(".at-galrow")]
      .find((r) => /^\d*\s*ConfirmModal/.test(r.textContent));
    const open = modalRow && [...modalRow.querySelectorAll("button")]
      .find((b) => b.textContent === "Show the modal");
    click(open);
    await sleep(60);

    const back = document.querySelector(".at-modalback");
    check("a confirmation appears when one is asked", !!back && /A confirm modal/.test(back.textContent),
      (back && back.textContent.slice(0, 40)) || "nothing showed");
    check("it leaves the layer it was written in",
      !!back && !host.contains(back), back ? "still inside its parent" : "no modal");
    check("and lands in the app root, where the theme and the screens are",
      !!back && back.parentElement === (document.querySelector(".at") || document.body),
      back ? `parent: ${(back.parentElement || {}).className}` : "no modal");

    const cancel = back && [...back.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
    click(cancel);
    await sleep(60);
    check("and goes when it is answered", !document.querySelector(".at-modalback"));
  }

  galleryRoot.unmount();
  host.remove();
  check("it goes with the component that raised it", !document.querySelector(".at-snack"));
}

/* ---- the text styles ----
   Beside the gallery on the same tab, and the same promise: every row is
   the real class on a real element, so rendering the lot is what catches a
   specimen that has stopped being the style it claims to be. The sizes it
   shows are measured off those specimens in a browser; here there is no
   stylesheet, so what is checked is that it says so by falling back to the
   stylesheet's own words rather than reporting the browser's 16px default
   for everything. */
{
  const before = errors.length;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { TextStyles } = await import(path.join(out, "gallery.js"));
  const stylesRoot = createRoot(host);
  stylesRoot.render(React.createElement(TextStyles));
  await sleep(200);

  const shown = host.textContent;
  check("the text styles render", /Every size a person actually reads/.test(shown), shown.slice(0, 80));
  check("no console errors rendering the text styles", errors.length === before,
    errors.slice(before, before + 3).join(" | "));

  const { TEXT_STYLES } = await import(path.resolve("src/text-styles.ts"));
  const listed = TEXT_STYLES.flatMap((/** @type {any} */ [, styles]) => styles);
  const drawn = [...host.querySelectorAll("[data-ts]")].map((e) => e.getAttribute("data-ts"));
  const undrawn = listed
    .map((/** @type {any} */ s) => s.name)
    .filter((/** @type {string} */ n) => !drawn.includes(n));
  check("every style listed is drawn as a specimen", undrawn.length === 0,
    `not drawn: ${undrawn.join(", ")}`);

  /* No stylesheet, so no measurement — and a row with nothing measured
     shows what the stylesheet says instead of a number that would be the
     browser's default dressed up as the app's. */
  check("with no stylesheet applied it falls back to the declared size",
    shown.includes("var(--fs-md)") && shown.includes("calc(54px * var(--sscale, 1))"),
    shown.slice(0, 200));

  stylesRoot.unmount();
  host.remove();
}

/* ---- the app chrome cannot be wedged hidden ----
   The space selector and corner menu are hidden by a body class while a
   screen is open. It used to come off only when a counter emptied, so an
   entry that outlived its component hid the chrome until the page was
   reloaded. */
{
  const { Screen } = await import(path.join(out, "shared.js"));
  const host = document.createElement("div");
  document.body.appendChild(host);
  const screenRoot = createRoot(host);

  check("no screen open to start with", !document.body.classList.contains("at-screening"),
    `body="${document.body.className}"`);

  screenRoot.render(React.createElement(Screen, { title: "A screen", onBack() {} }, "body"));
  await sleep(100);
  check("a screen hides the chrome", document.body.classList.contains("at-screening"));

  screenRoot.render(null);
  await sleep(100);
  check("closing it brings the chrome back", !document.body.classList.contains("at-screening"));

  /* The leak the old counter could not recover from: a screen whose element
     is gone from the document while its entry stays behind. Its root is
     abandoned rather than unmounted, which is what a leak is. */
  const leakHost = document.createElement("div");
  document.body.appendChild(leakHost);
  createRoot(leakHost).render(React.createElement(Screen, { title: "Leaked", onBack() {} }, "body"));
  await sleep(100);
  const open = document.querySelectorAll(".at-screen.over");
  open[open.length - 1].remove();
  check("the leaked screen is out of the document", !document.querySelector(".at-screen.over"));

  /* Any screen opening and closing afterwards must clear it. */
  screenRoot.render(React.createElement(Screen, { title: "Another", onBack() {} }, "body"));
  await sleep(100);
  screenRoot.render(null);
  await sleep(100);
  check("a leaked screen does not hide the chrome for good",
    !document.body.classList.contains("at-screening"),
    `body="${document.body.className}"`);

  screenRoot.unmount();
  host.remove();
  leakHost.remove();
}

/* ---- "can't listen right now" ----
   The queue rewrite, driven directly: it is a pure function over a queue, an
   index, the cards and the settings, which is the whole reason it is one. */
{
  const { requeueUnaskable, setOfflineNow, setAudibleClips, soundLevelOf, noCardsYet,
          SOUNDS, SOUND_LEVELS, setSounds, PRAISE, WRONG_VERDICT, praiseFor } =
    await import(path.join(out, "ArabicTrainer.js"));

  /* The verdict. A miss says the same thing every time and hands over to
     the answer below it; praise rotates so a long session does not repeat
     itself, and rotates in order — random would repeat, which is the one
     thing rotating is for. */
  check("a miss names what happened and points at the answer",
    /^Incorrect\./.test(WRONG_VERDICT) && /:$/.test(WRONG_VERDICT), WRONG_VERDICT);
  check("praise is the four phrases, in order",
    [0, 1, 2, 3].every((i) => praiseFor(i) === PRAISE[i]),
    [0, 1, 2, 3].map(praiseFor).join(" "));
  check("and it comes round again rather than running out",
    praiseFor(4) === PRAISE[0] && praiseFor(9) === PRAISE[1], `${praiseFor(4)} / ${praiseFor(9)}`);
  check("no two in a row are the same",
    [0, 1, 2, 3, 4, 5].every((i) => praiseFor(i) !== praiseFor(i + 1)),
    [0, 1, 2, 3, 4, 5, 6].map(praiseFor).join(" "));

  /* Several accepted answers are one stored string with " / " between
     them — the convention every existing card uses — edited as one field
     per answer. The split has to take the ; a teacher may have typed by
     hand too, and an added field left empty must leave nothing behind. */
  const { splitAlternatives, joinAlternatives } = await import(path.join(out, "shared.js"));
  check("a stored \"a / b\" opens as two answers",
    JSON.stringify(splitAlternatives("book / notebook")) === JSON.stringify(["book", "notebook"]),
    JSON.stringify(splitAlternatives("book / notebook")));
  check("and a ; typed by hand is honoured too",
    JSON.stringify(splitAlternatives("book; notebook")) === JSON.stringify(["book", "notebook"]),
    JSON.stringify(splitAlternatives("book; notebook")));
  check("an empty field opens as one empty answer, never none",
    JSON.stringify(splitAlternatives("")) === JSON.stringify([""]), JSON.stringify(splitAlternatives("")));
  check("two answers store as the slash convention the checker reads",
    joinAlternatives(["book", " notebook "]) === "book / notebook", joinAlternatives(["book", " notebook "]));
  check("an added answer left empty leaves nothing behind",
    joinAlternatives(["book", ""]) === "book", JSON.stringify(joinAlternatives(["book", ""])));

  /*
   * The feedback sounds, added up rather than listened to.
   *
   * There is no audio engine out here, so each sound is played against a
   * stub that records what it scheduled: when each note starts, how long
   * it runs, and the level it ramps to — which already carries the loud
   * multiplier, because that is applied inside the player.
   *
   * Two things worth knowing and impossible to hear from a test: that
   * turning the volume up has not pushed the sum of overlapping notes
   * past full scale, where it would clip into a rasp; and that the four
   * sounds you get during a session are long enough to register as a
   * verdict rather than a click.
   */
  /*
   * Every note one sound schedules, as a level and a span.
   *
   * The stub stands in for an AudioContext and answers only what the sound
   * engine reaches for, which is what makes it a check of the engine and
   * not of the browser.
   */
  /** @param {string} kind */
  const played = (kind) => {
    /** @type {{ at: number, level: number, ends: number }[]} */
    const notes = [];
    const stub = {
      currentTime: 0,
      createOscillator: () => ({
        type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      }),
      createGain: () => {
        const n = { at: 0, level: 0, ends: 0 };
        notes.push(n);
        return {
          gain: {
            /**
             * @param {number} v
             * @param {number} t
             */
            setValueAtTime(v, t) { n.at = t; },
            /**
             * @param {number} v
             * @param {number} t
             */
            exponentialRampToValueAtTime(v, t) {
              if (v > n.level) n.level = v;
              if (t > n.ends) n.ends = t;
            },
          },
          connect() {},
        };
      },
      destination: {},
    };
    SOUNDS[kind](/** @type {AudioContext} */ (/** @type {unknown} */ (stub)));
    return notes;
  };
  /* The worst moment: every note that is still sounding at the loudest
     one's peak, added together. Exponential decay means this over-counts,
     which is the direction a headroom check should err in. */
/** @typedef {{ at: number, level: number, ends: number }} Note */
  /** @param {Note[]} notes */
  const loudest = (notes) =>
    Math.max(...notes.map((n) => notes.filter((o) => o.at <= n.at && o.ends >= n.at)
      .reduce((sum, o) => sum + o.level, 0)));
  /** @param {Note[]} notes */
  const runs = (notes) => Math.max(...notes.map((n) => n.ends)) - Math.min(...notes.map((n) => n.at));

  setSounds("loud");
  check("loud is louder than it was", SOUND_LEVELS.loud > 2.6, String(SOUND_LEVELS.loud));
  for (const kind of Object.keys(SOUNDS)) {
    const peak = loudest(played(kind));
    check(`${kind} has headroom at loud`, peak < 1, `${peak.toFixed(2)} of full scale`);
  }
  /* The four you hear in a session: right, wrong, given up, and moving on. */
  /** @type {[string, number][]} */
  const HEARD = [["correct", 0.55], ["wrong", 0.55], ["warn", 0.35], ["tick", 0.14]];
  for (const [kind, least] of HEARD) {
    const len = runs(played(kind));
    check(`${kind} lasts long enough to be noticed`, len >= least,
      `${len.toFixed(2)}s, wanted ${least}s`);
  }
  setSounds("off");
  check("off schedules nothing at all", played("correct").length === 0);
  setSounds("loud");

  /* Why a student has no cards, said the same way on all three screens
     that have to say it. Home and Progress used to tell someone already
     in a course to join one — Home with a button to do it with — while
     the Cards tab got it right, which is what three hand-written
     sentences buys you. */
  check("nobody in a course is told to join one",
    !/join/i.test(noCardsYet(1)) && !/join/i.test(noCardsYet(4)),
    `${noCardsYet(1)} / ${noCardsYet(4)}`);
  check("one course is one course, and it holds no cards",
    noCardsYet(1) === "You're in 1 course, but there are no cards in it yet.", noCardsYet(1));
  check("several courses agree with themselves",
    noCardsYet(3) === "You're in 3 courses, but there are no cards in them yet.", noCardsYet(3));
  /* Someone in no course is the one person the invitation is for. */
  check("and someone in none is invited to join",
    /join a course/i.test(noCardsYet(0)), noCardsYet(0));

  /* One sentence, three screens: the drift is what the helper exists to
     stop, so the source is checked for a second copy of it. */
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(path.resolve("src/ArabicTrainer.tsx"), "utf8");
    const invites = src.split("Join a course and").length - 1;
    check("the invitation is written once, not once per screen", invites === 1,
      `${invites} copies`);
    const uses = src.split("noCardsYet(").length - 1;
    check("and every screen that says it calls the same function", uses >= 4,
      `${uses} mentions, one of them the declaration`);

    /* Arriving somewhere starts at the top of it. jsdom reports every
       scrollTop as 0 whether or not anything reset it, so this cannot be
       checked by driving the app here — it is checked in a browser, and
       what is checked here is that the wiring is still present. Three
       scrollers, because the app has three: the page for the learner's
       tabs, the frame's own body for a space's tabs, and a screen's body
       for a screen that replaces another. */
    const shared = readFileSync(path.resolve("src/shared.tsx"), "utf8");
    check("the learner's tabs put the page back to the top",
      /useScrollTop\(`\$\{space\}:\$\{tab\}`\)/.test(src));
    check("a space's tabs put its own panel back",
      /useEffect\(\(\) => \{\s*if \(bodyRef\.current\) bodyRef\.current\.scrollTop = 0;\s*\}, \[tab\]\)/.test(shared));
    check("and a screen replacing another starts at its own top",
      /useEffect\(\(\) => \{\s*if \(bodyRef\.current\) bodyRef\.current\.scrollTop = 0;\s*\}, \[title\]\)/.test(shared));
  }

  /* The sound setting used to be a boolean and is now a level, and a
     document written before the change still says true. It has to keep
     working, and it has to mean loud rather than soft — the reason this
     became a choice at all is that "on" was too quiet to hear. */
  check("a sound setting stored as a boolean still means something",
    soundLevelOf(true) === "loud" && soundLevelOf(false) === "off",
    `${soundLevelOf(true)} / ${soundLevelOf(false)}`);
  check("and the three levels mean themselves",
    ["loud", "soft", "off"].every((l) => soundLevelOf(l) === l));
  check("a setting nobody wrote is loud, which is the new default",
    soundLevelOf(undefined) === "loud" && soundLevelOf(null) === "loud",
    `${soundLevelOf(undefined)} / ${soundLevelOf(null)}`);
  /* Anything unrecognised plays rather than falling silent: a learner who
     hears nothing assumes the app is broken, where one who hears something
     unexpected reaches for the setting. */
  check("something unrecognised is not silence", soundLevelOf("banana") === "loud");
  const stored2 = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  /** @type {Record<string, any>} */
  const byId2 = Object.fromEntries(stored2.items.map((/** @type {any} */ i) => [i.id, i]));
  /* oldclient1 is ar + en + lat and has no recordings, so it supports the
     reading and writing types and none of the listening ones. */
  const card1 = byId2.oldclient1;
  const set = stored2.settings;

  const queue = [
    { id: card1.id, subId: null, type: "ar2en" },
    { id: card1.id, subId: null, type: "rec2en" },
    { id: card1.id, subId: null, type: "rec2ar" },
    { id: card1.id, subId: null, type: "en2ar" },
  ];
  const out2 = requeueUnaskable(queue, 1, stored2.items, set);

  check("the answered questions are left exactly as they were",
    out2[0] === queue[0], `first=${JSON.stringify(out2[0])}`);
  check("no listening exercise survives the rewrite",
    out2.every((/** @type {any} */ e) => !["rec2en", "rec2ar", "rec2attr"].includes(e.type)),
    out2.map((/** @type {any} */ e) => e.type).join(","));
  check("the question in front of you is replaced, not skipped",
    out2.length > 1 && out2[1].id === card1.id && out2[1].type !== "rec2en",
    out2.map((/** @type {any} */ e) => e.type).join(","));
  /* Prefer a question the card is not already being asked. Which type that
     turns out to be is the table's business — asserting the name of it here
     only pinned the order exercises are declared in, and broke the day a new
     one was added. What matters is that the substitute is a question this
     card is not already down for. */
  /* On a card that has earned more than one level: oldclient1 is still on
     recognition, where reading is the only question it has not been
     asked, and repeating that is what the next check is about. The walks
     above have been answering "I don't know", which closes levels, so the
     card is handed in with its bottom level mastered rather than read off
     the device — the rewrite reads states from the items it is given. */
  const done = { phase: "review", reps: 3, interval: 5, due: 0, updated: 5 };
  const card2 = reworded(byId2.tied1, { s: { ...lead(byId2.tied1).s, ar2en: done, match: done } });
  const one = requeueUnaskable(
    [
      { id: card2.id, subId: null, type: "ar2en" },
      { id: card2.id, subId: null, type: "rec2en" },
      { id: card2.id, subId: null, type: "en2ar" },
    ],
    1,
    stored2.items.map((/** @type {any} */ i) => (i.id === card2.id ? card2 : i)),
    set,
  );
  check("a substitute avoids what the card is already being asked",
    !!one[1] && !["ar2en", "en2ar", "rec2en"].includes(one[1].type),
    one.map((/** @type {any} */ e) => e.type).join(","));

  /* And when every alternative is already queued, repeat one rather than
     drop the practice — the card is still worth answering. */
  check("with nothing free it still substitutes rather than dropping",
    out2.length === queue.length, out2.map((/** @type {any} */ e) => e.type).join(","));

  /* A card with nothing but sound to offer, once the sound has gone: the
     entry goes rather than sitting in the queue unanswerable.

     Driven through the connection, which is the case this is really about —
     a queue built with a recording in it, carried into a tunnel. While the
     recording can still be played the question is perfectly askable and
     must be left exactly where it is, which is the check underneath. */
  const soundOnly = {
    ...reworded(card1, { id: "soundonly", en: "", lat: "", recs: [{ id: "z".repeat(64) }] }),
    id: "soundonly",
  };
  const soundQueue = [{ id: "soundonly", subId: null, type: "rec2ar" }];
  const withSound = stored2.items.concat([soundOnly]);

  const kept = requeueUnaskable(soundQueue, 0, withSound, set);
  check("a recording that can still be played is left alone",
    kept.length === 1 && kept[0].type === "rec2ar", JSON.stringify(kept));

  setOfflineNow(true);
  setAudibleClips(new Set());
  const dropped = requeueUnaskable(soundQueue, 0, withSound, set);
  setOfflineNow(false);
  setAudibleClips(null);
  check("and a card that can only be listened to drops out once it cannot be heard",
    dropped.length === 0, JSON.stringify(dropped));

  /* Nothing to do when there is nothing to listen to. */
  const untouched = requeueUnaskable(queue.filter((e) => e.type === "ar2en"), 0, stored2.items, set);
  check("a queue with no listening exercises is returned unchanged",
    untouched.length === 1 && untouched[0].type === "ar2en");
}


/* ---- a conversation, met and practised ----
   The dialog feature end to end, through the real screens: a scene of
   four turns arrives the way every card arrives — from a teacher, over
   sync — and is then met in a session. Read through first, because a
   scene never opens with a blank, and afterwards drilled a line and a
   whole scene at a time.

   Nothing in it has a recording, which is the point: a silent scene
   supports every exercise there is.

   Filed in a deck of its own, so the session below is only this scene. A
   session drawn from everything would be a coin toss over which questions
   came up, and a test that passes four times in five is worse than none.

   Written rather than typed into the editor because making your own cards
   is switched off in this build — OWN_CARDS — so the learner's card sheet
   is not in the bundle to drive. What a teacher writes is checked where a
   teacher writes it, in tests/server.test.mjs. */
{
  /** The React-controlled value setter, the way a keystroke sets one. */
  const typeInto = (/** @type {any} */ el, /** @type {string} */ value) => {
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    const setter = must(Object.getOwnPropertyDescriptor(proto, "value"), "the value descriptor").set;
    must(setter, "the value setter").call(el, value);
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
    return true;
  };

  /* Whatever the walk above left running, this starts from the home
     screen: a session on screen is a screen over the tabs, and clicking
     underneath it does nothing at all. */
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }

  const sceneSpeakers = ["Layla", "Karim"];
  /* With how each line sounds on it, so that reading the scene through has
     both things to reveal and they can be told apart. */
  const said = [
    { ar: "سلام", en: "peace", lat: "salaam", who: 0 },
    { ar: "وسلام", en: "and peace", lat: "wa salaam", who: 1 },
    { ar: "كيف حالك", en: "how are you", lat: "kayf haalak", who: 0 },
    { ar: "بخير", en: "well", lat: "bikhayr", who: 1 },
  ];
  const remote = must(remoteDocs.get(realToken), "the synced document");
  remote.data = {
    ...remote.data,
    items: remote.data.items.concat([
      {
        id: "scene1",
        kind: "dialog",
        ar: "",
        en: "At the door",
        lat: "",
        note: "Two neighbours meet in the morning",
        tags: ["Scenes"],
        speakers: sceneSpeakers,
        /* Nobody's part: the teacher wrote a scene worth holding up from
           either end and was not made to pick a side. The question picks
           one, and picks the other next time. */
        you: null,
        lines: said.map((l, i) => ({
          id: `sl${i + 1}`,
          who: l.who,
          ar: l.ar,
          en: l.en,
          lat: l.lat,
          /* The first line contains a word this learner already has, so
             the scene also becomes somewhere that word turned up. */
          uses: i === 0 ? ["oldclient1"] : [],
          recs: [],
        })),
        created: 2,
        updated: 9,
      },
    ]),
  };
  remote.etag = "e-scene";
  w.dispatchEvent(new w.Event("focus"));
  await sleep(1600);

  const doc = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  const scene = (doc.items || []).find((/** @type {any} */ i) => i.id === "scene1");
  check("a conversation arrives as one card with its lines on it",
    !!scene && (scene.lines || []).length === 4 && (scene.speakers || []).length === 2,
    scene ? `${(scene.lines || []).length} lines` : "no dialog stored");
  check("with each turn carrying who said it, what it means and its own id",
    !!scene &&
      scene.lines.every((/** @type {any} */ l, /** @type {number} */ i) =>
        l.id && l.en === said[i].en && l.who === said[i].who) &&
      scene.lines.every((/** @type {any} */ l) => (l.recs || []).length === 0),
    scene ? JSON.stringify(scene.lines[0]).slice(0, 110) : "");
  /* Stored sparse, like every other unit: a line nobody has answered yet
     keeps no states at all, and they are put back on load. The states it
     earns by being answered are checked at the end of the session
     below. */
  check("and a turn nobody has answered yet is stored without a schedule",
    !!scene && scene.lines.every((/** @type {any} */ l) => Object.keys(l.s || {}).length === 0),
    scene ? JSON.stringify(scene.lines.map((/** @type {any} */ l) => Object.keys(l.s || {}).length)) : "");

  /* ---- practise it ---- */
  click(buttonNamed(/^Home$/));
  await sleep(300);
  click(buttonNamed(/Build a session|Choose what to practice|Pick cards/));
  await sleep(300);
  click([...document.querySelectorAll(".at-modecard")].find((b) => /Regular/.test(b.textContent || "")));
  await sleep(60);
  clickNamed(/^(Next|Choose a mode|Choose at least one card)$/);
  await sleep(150);
  const deck = [...document.querySelectorAll(".at-tagpickmain")].find((b) => /Scenes/.test(b.textContent || ""));
  check("the scene's own deck is there to practise from", !!deck,
    [...document.querySelectorAll(".at-tagpickmain")].map((b) => (b.textContent || "").slice(0, 12)).join("|"));
  click(deck);
  await sleep(80);
  clickNamed(/^(Next|Choose at least one card)$/);
  await sleep(150);
  click([...document.querySelectorAll(".at-lengthgroup button")].find((b) => (b.textContent || "").trim() === "10"));
  await sleep(60);
  clickNamed(/^(Start|Choose a length)$/);
  await sleep(500);

  const instruction = () => (document.querySelector(".at-instruction") || {}).textContent || "";
  const checkBtn = () => document.querySelector('[data-el="check-button"]');
  const verdict = () => (document.querySelector('[data-el="verdict"]') || {}).textContent || "";
  const praised = () => /Correct|Good job|Nicely done|Great/.test(verdict());

  check("a session built from one conversation starts on that conversation",
    !!document.querySelector('[data-el="scene"]'), instruction() || "no question");
  /* The first thing a scene ever does is show itself. Nothing is marked,
     there is no way to be wrong, and the only way on is having read it. */
  check("and it opens by reading the scene through, not with a blank",
    /Read the scene/.test(instruction()) &&
      !document.querySelector('[data-el="dont-know-button"]') &&
      !document.querySelector('[data-el="answer-input"]'),
    `${instruction()} / ${(checkBtn() || {}).textContent || "no button"}`);
  check("the read-through shows every line, with who said it and what it means",
    document.querySelectorAll('[data-el="scene-line"]').length === 4 &&
      document.querySelectorAll('[data-el="scene-line-meaning"]').length === 4 &&
      /Layla/.test(document.body.textContent || ""),
    `${document.querySelectorAll('[data-el="scene-line"]').length} lines shown`);
  check("and the way on says what it is", /read it/i.test((checkBtn() || {}).textContent || ""),
    (checkBtn() || {}).textContent || "no button");
  /* Two people, one down each side, so whose turn it is is seen rather
     than read. The opener leads and they alternate from there. */
  const sides = [...document.querySelectorAll('[data-el="scene-line"]')].map((el) =>
    el.classList.contains("side0") ? 0 : el.classList.contains("side1") ? 1 : null
  );
  check("a two-hander is laid out with one speaker down each side",
    !!document.querySelector('[data-el="scene"].sided') && sides.join("") === "0101",
    `${(document.querySelector('[data-el="scene"]') || {}).className || "no scene"} · ${sides.join(",")}`);

  click(checkBtn());
  await sleep(300);

  /* Then the questions themselves, each answered the way its own control
     is used. The walk records which ones turned up. */
  const met = new Set();
  for (let n = 0; n < 14 && document.querySelector(".at-instruction"); n++) {
    const asked = instruction();
    const order = document.querySelector('[data-el="answer-order"]');
    const self = document.querySelector('[data-el="answer-self"]');
    const choices = document.querySelector('[data-el="answer-choices"]');
    if (/Read the scene/.test(asked)) {
      met.add("read-again");
      click(checkBtn());
      await sleep(250);
      continue;
    }
    if (order) {
      met.add("order");
      /* Tapped into place, in the order the scene was written: the taps
         are the answer, so this is somebody getting it right. */
      for (const line of said) {
        /* Matched on the whole line, not on part of one: "سلام" sits
           inside "وسلام", and a substring match taps the wrong turn. */
        click(
          [...order.querySelectorAll("button")].find(
            (b) => ((b.querySelector(".at-arabic") || {}).textContent || "").trim() === line.ar
          )
        );
        await sleep(40);
      }
    } else if (self) {
      met.add("whole");
      /* The script is what is on screen; how it sounds and what it means
         are each a tap away. Both taken here, to prove they arrive — a
         reader would take one or neither. */
      check("reading a scene through shows the script and nothing else",
        document.querySelectorAll('[data-el="scene-line-text"]').length === 4 &&
          document.querySelectorAll('[data-el="scene-line-said"]').length === 0 &&
          document.querySelectorAll('[data-el="scene-line-meaning"]').length === 0,
        `${document.querySelectorAll('[data-el="scene-line-meaning"]').length} meanings up front`);
      click(document.querySelector('[data-el="reveal-meaning"]'));
      await sleep(120);
      check("and the meaning is a tap away",
        document.querySelectorAll('[data-el="scene-line-meaning"]').length === 4,
        `${document.querySelectorAll('[data-el="scene-line-meaning"]').length} shown`);
      click(document.querySelector('[data-el="reveal-said"]'));
      await sleep(120);
      check("as is how it sounds, separately",
        document.querySelectorAll('[data-el="scene-line-said"]').length === 4,
        `${document.querySelectorAll('[data-el="scene-line-said"]').length} shown`);
      /* And the reader says whether they followed it, because nobody else
         was in the room. */
      const answers = [...self.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
      check("then the reader marks it themselves",
        answers.length === 2 && /all of it/i.test(answers[0]),
        answers.join(" | ") || "(nothing to answer with)");
      click(self.querySelector("button"));
      await sleep(60);
    } else if (choices) {
      met.add("pick");
      /* The reply that actually comes next: the scene on screen ends with
         the blank, so the turn wanted is the one after the last line
         shown with words in it. Matched whole, since one line of this
         scene sits inside another. */
      const shown = [...document.querySelectorAll('[data-el="scene-line-text"]')].map(
        (e) => (e.textContent || "").trim()
      );
      const last = said.findIndex((l) => l.ar === shown[shown.length - 1]);
      const want = (said[last + 1] || {}).ar;
      click(
        [...choices.querySelectorAll("button")].find(
          (b) => ((b.querySelector(".at-arabic") || {}).textContent || "").trim() === want
        ) || choices.querySelector("button")
      );
      await sleep(40);
    } else {
      met.add(/mean/i.test(asked) ? "meaning" : "reply");
      typeInto(document.querySelector('[data-el="answer-input"]'), "something");
      await sleep(40);
    }
    click(checkBtn());
    await sleep(250);
    if (!document.querySelector('[data-el="verdict"]')) {
      check(`answering "${asked.slice(0, 34)}" produced a verdict`, false,
        (document.body.textContent || "").slice(0, 100).replace(/\s+/g, " "));
      break;
    }
    if (met.has("order") && !met.has("order-marked")) {
      met.add("order-marked");
      check("putting the lines back in the order they were said is marked right", praised(), verdict());
    }
    if (met.has("whole") && !met.has("whole-marked")) {
      met.add("whole-marked");
      check("saying you followed the whole scene is taken at your word", praised(), verdict());
    }
    if (met.has("pick") && !met.has("pick-marked")) {
      met.add("pick-marked");
      check("choosing the reply that actually comes next is marked right", praised(), verdict());
    }
    click(buttonNamed(/^Continue$/));
    await sleep(250);
  }

  /* A scene nobody has read yet is on the bottom level of the ladder: it is
     read through, and read again for marking, and nothing harder. Putting
     it in order and choosing a reply wait until the reading is mastered,
     which no walk can be — so what is checked is that the reading is
     asked and marked, and that the harder questions are not. */
  check("a session on one new scene asks it to be read, and marks that",
    met.has("whole") && met.has("whole-marked"), [...met].join(", ") || "nothing asked");
  check("and asks nothing harder of it until the reading is mastered",
    !met.has("order") && !met.has("pick"), [...met].join(", "));
  check("and the scene is not read through twice in one session",
    !met.has("read-again"), [...met].join(", "));

  /* Answers are written to the device 600ms after the last one, so the
     document is read once that has had time to happen. Reading straight
     after the final Continue caught it mid-flight. */
  await sleep(900);
  const afterDoc = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  const afterScene = (afterDoc.items || []).find((/** @type {any} */ i) => i.id === "scene1");
  const answered = (/** @type {any} */ u) =>
    Object.values((u && u.s) || {}).some((/** @type {any} */ st) => (st.reps || 0) > 0);
  check("what was answered is recorded against the line it was about",
    !!afterScene && (afterScene.lines || []).concat(formsIn(afterScene)).some(answered),
    afterScene ? JSON.stringify((afterScene.lines || []).map((/** @type {any} */ l) => Object.keys(l.s || {}).length)) : "");
  /* The read-through leaves nothing behind: it is an introduction, not an
     exercise, so there is nothing to schedule and nothing to store. */
  check("but the read-through is not scheduled, because it was never marked",
    !!afterScene && !("dlgread" in (lead(afterScene).s || {})),
    afterScene ? Object.keys(lead(afterScene).s || {}).join(",") : "");

  /* A scene of three exercises runs out inside the loop above, so what is
     on screen is the end of the session rather than the middle of one —
     and a finished session is a screen over the tabs, not a tab. */
  if (buttonNamed(/^Done$/)) {
    click(buttonNamed(/^Done$/));
    await sleep(250);
  }
  click(buttonNamed(/^Home$/));
  await sleep(200);
}

/* ---- leaving a session and starting another ----
   The bug this was written for: a session was built out of orderings that
   left ties — everything due ranks together, everything nobody has been
   wrong about is equally easy — and the ties kept whatever order the
   document happened to hold. Nothing in building one ever rolled a die,
   so leaving half way through and starting again gave back the same
   questions in the same order, for good.

   Six sessions, each abandoned on the first question. They do not have to
   differ from each other one by one — with a handful of cards two draws
   can coincide — but six identical ones is the old behaviour exactly. */
{
  /* Whatever is on screen from the walk above. */
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
  click(buttonNamed(/^Home$/));
  await sleep(300);

  /** What a session opens with, as a string.
   *
   *  The answer surface is part of it, not just the prompt: a matching grid
   *  puts its words where an answer goes and asks nothing above them, so
   *  reading the prompt alone made every grid in the app look like the same
   *  question and this guard went blind to a whole exercise. */
  const queueNow = () => {
    const el = document.querySelector('[data-el="session-count"]');
    const asked = (document.querySelector(".at-instruction") || {}).textContent || "";
    const prompt = (document.querySelector('[data-el="question-prompt"]') || {}).textContent || "";
    const answer = (document.querySelector(".at-answerbox") || {}).textContent || "";
    return `${(el || {}).textContent || "?"}|${asked}|${prompt}|${answer}`.replace(/\s+/g, " ");
  };

  const openings = [];
  for (let n = 0; n < 6; n++) {
    click(buttonNamed(/^Start session$/));
    await sleep(450);
    if (!document.querySelector(".at-instruction")) {
      check("a session starts from the home screen", false,
        (document.body.textContent || "").slice(0, 90).replace(/\s+/g, " "));
      break;
    }
    openings.push(queueNow());
    /* Left in the middle, which is the whole point: nothing is answered,
       so nothing about the cards has changed and the next session is
       built from exactly the same state. */
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(350);
  }

  check("six sessions built from the same cards are not one session six times",
    new Set(openings).size > 1,
    `${new Set(openings).size} distinct opening(s): ${openings[0] || "none"}`);
  check("and every one of them actually started", openings.length === 6, `${openings.length} started`);
}

/* ---- a word, and the phrase it turns up in ----
   The seeded course holds كتاب and "الكتاب كبير", and the phrase says it
   teaches the word. What that link is worth is the whole of this block:
   the word can be chosen out of the phrase before it has to be written
   into it, and the phrase is shown after any question about the word
   rather than only the two built out of it.

   Driven through Ultimate, which asks every type a card supports, so
   which questions come up is not a draw — everything else about a session
   now is. */
{
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
  click(buttonNamed(/^Home$/));
  await sleep(300);
  click(buttonNamed(/Build a session|Choose what to practice|Pick cards/));
  await sleep(300);
  click([...document.querySelectorAll(".at-modecard")].find((b) => /Ultimate/.test(b.textContent || "")));
  await sleep(80);
  clickNamed(/^(Next|Choose a mode|Choose at least one card)$/);
  await sleep(150);
  const lesson = [...document.querySelectorAll(".at-tagpickmain")].find((b) => /Lesson 1/.test(b.textContent || ""));
  click(lesson);
  await sleep(80);
  clickNamed(/^(Next|Choose at least one card|Start|Choose a length)$/);
  await sleep(200);
  clickNamed(/^(Start|Choose a length)$/);
  await sleep(500);

  const instruction = () => (document.querySelector(".at-instruction") || {}).textContent || "";
  const prompt = () => (document.querySelector('[data-el="question-prompt"]') || {}).textContent || "";
  let sawPicker = false;
  let pickerOptions = 0;
  let pickerHadTheWord = false;
  /* The matching grid, met on the way past: it answers nothing this walk is
     about, but it is a question the session now deals, and worth reporting
     on where it is met. */
  /** @type {Awaited<ReturnType<typeof playGrid>>} */
  let grid = false;
  let sawWhereItTurnedUp = 0;
  let sawOnAPlainQuestion = false;
  /* The two that put four whole cards up and ask which one: the meanings
     of the word on screen, and the word a meaning belongs to. What is
     checked of each is that its tiles are drawn from the right side of the
     card — an English tile set in the script's size and direction is the
     bug this catches. */
  /** @type {{options: number, script: number} | null} */
  let meaningTiles = null;
  /** @type {{options: number, script: number} | null} */
  let wordTiles = null;
  /* And the on-screen keys, which need a question asking for the script.
     Ultimate asks every exercise a card has open, and two of these cards
     have the writing open, so one comes up here without being hunted. */
  let sawKeys = false;
  /* Whether the frame came up. Not one of the things this walk waits for —
     it is one card among several and a session has a budget, so hunting it
     here only exhausts the turns — but worth knowing, because what is
     checked about it below is worth nothing if it never came up. */
  let sawFrame = false;
  /* Whether "Choose the meaning" left anything behind. It puts up the word
     and its meaning between the question and the answer, and used to end
     with no Learn more at all — the box showed whatever the exercise offers
     as a hint *during* the question, and that one offers none. */
  /** @type {{ box: boolean, said: string } | null} */
  let alsoOnMeaning = null;

  /* Walk until this block has met everything it asserts, rather than for a
     fixed number of turns.

     A count was a bad measure twice over. A session does not end when the
     queue is walked once — a question given up on comes round again — so no
     cap reaches the end of one; and Ultimate shuffles, so a cap that only
     just covered the queue decided by draw whether the one question this
     block is about fell inside it. Every exercise added to the app tightened
     that, and adding the thirteenth is what made it fail. */
  const metEverything = () =>
    sawPicker && !!grid && sawWhereItTurnedUp > 0 && sawOnAPlainQuestion && sawKeys &&
    !!meaningTiles && !!wordTiles;
  let asked_ = 0;
  for (let n = 0; n < 120 && !metEverything() && document.querySelector(".at-instruction"); n++) {
    asked_ = n + 1;
    const asked = instruction();
    const gapped = /____/.test(prompt());
    const choices = document.querySelector('[data-el="answer-choices"]');
    const contextQuestion = gapped || /phrase/i.test(asked);

    const scriptField = document.querySelector(".at-answerbox .at-input.ar");
    if (scriptField && !sawKeys) sawKeys = await checkKeys(scriptField);
    /* The frame, recognised by its own words rather than by the name that
       fills it — which one that is is the very thing under test. */
    if (/اسمي|My name is/.test(prompt() + " " + document.body.textContent)) sawFrame = true;

    if (choices && gapped) {
      /* Move one: the gentle half of the gap-fill. The word is chosen out
         of a few before it ever has to be spelled into the gap. */
      sawPicker = true;
      const options = [...choices.querySelectorAll("button")];
      pickerOptions = options.length;
      pickerHadTheWord = options.some((b) => (b.textContent || "").includes("كتاب"));
      click(options[0]);
      await sleep(40);
    } else if (choices) {
      const tiles = [...choices.querySelectorAll("button")];
      const seen = {
        options: tiles.length,
        script: tiles.filter((b) => !!b.querySelector(".at-arabic")).length,
      };
      if (/Choose the meaning/.test(asked)) meaningTiles = seen;
      if (/Choose the word/.test(asked)) wordTiles = seen;
      click(tiles[0]);
      await sleep(40);
    } else if (document.querySelector('[data-el="answer-match"]')) {
      grid = (await playGrid()) || grid;
    } else if (document.querySelector('[data-el="answer-input"]')) {
      click(buttonNamed(/^I don't know$/));
      await sleep(200);
    } else if (document.querySelector('[data-el="check-button"]')) {
      click(document.querySelector('[data-el="check-button"]'));
      await sleep(200);
    }
    if (!document.querySelector('[data-el="verdict"]')) {
      click(document.querySelector('[data-el="check-button"]'));
      await sleep(250);
    }

    /* Move two: what the answer screen says about where the word lives.
       Behind "Learn more", which is where everything that is not the
       answer lives. */
    const more = document.querySelector('[data-el="also-toggle"]');
    if (/Choose the meaning/.test(asked) && !alsoOnMeaning) {
      if (more) click(more);
      await sleep(120);
      alsoOnMeaning = {
        box: !!more,
        said: ((document.querySelector('[data-el="also-hint"]') || {}).textContent || "")
          .replace(/\s+/g, " ").trim(),
      };
    }
    if (more) {
      click(more);
      await sleep(120);
      const where = document.querySelector('[data-el="also-context"]');
      if (where && /الكتاب كبير/.test(where.textContent || "")) {
        sawWhereItTurnedUp += 1;
        if (!contextQuestion) sawOnAPlainQuestion = true;
      }
    }
    click(buttonNamed(/^Continue$/));
    await sleep(200);
  }

  /* If the walk ran out of turns, everything below is reporting on half a
     session and the failures under it are noise. Said here, once, with the
     question it gave up on. */
  check("the walk met every question this block is about, without running out of turns",
    metEverything(),
    `${asked_} answered, last on "${instruction()}" — picker:${sawPicker} grid:${!!grid} context:${sawWhereItTurnedUp} plain:${sawOnAPlainQuestion} keys:${sawKeys} frame:${sawFrame}`
      .replace(/\s+/g, " "));
  check("a question asking for the script was reached, so the keys were looked at",
    sawKeys, "no card in this deck has the writing open");

  /* The gentlest question there is: the word, and four meanings to choose
     between. It is where a card starts, so every card in the deck is asked
     it. */
  /* The third field. The question showed the word and the answer showed
     its meaning, so how it is pronounced is the one thing nobody said —
     and where the box had nothing at all, it is now what is in it. */
  check("choosing what a word means still leaves something worth knowing behind",
    !!alsoOnMeaning && alsoOnMeaning.box,
    !alsoOnMeaning
      ? "that question never came up"
      : alsoOnMeaning.box
        ? "the box was there"
        : "the question was asked and left nothing behind");
  check("which is the field the question never showed",
    !!alsoOnMeaning && /pronounced/.test(alsoOnMeaning.said),
    (alsoOnMeaning && alsoOnMeaning.said) || "(nothing in the box)");

  check("a word can be met by choosing what it means, out of a few",
    !!meaningTiles && meaningTiles.options > 1,
    meaningTiles ? `${meaningTiles.options} meanings offered` : "never asked");
  check("and the meanings are set as meanings, not as words in the script",
    !!meaningTiles && meaningTiles.script === 0,
    meaningTiles ? `${meaningTiles.script} of ${meaningTiles.options} tiles in the script` : "never asked");
  /* And the other way round, a level up. */
  check("a word can be chosen out of a few from its meaning",
    !!wordTiles && wordTiles.options > 1,
    wordTiles ? `${wordTiles.options} words offered` : "never asked");
  check("and those tiles are the words themselves, in the script",
    !!wordTiles && wordTiles.script === wordTiles.options,
    wordTiles ? `${wordTiles.script} of ${wordTiles.options} tiles in the script` : "never asked");

  /* The matching grid, which every card can be asked because it wants
     nothing but a word and a meaning. */
  check("a session deals the matching grid alongside everything else",
    !!grid && grid.words > 1, grid ? `${grid.words} words, ${grid.meanings} meanings` : "never dealt");
  check("and puts up more meanings than words, so the last pair is never free",
    !!grid && grid.meanings > grid.words, grid ? `${grid.words} words, ${grid.meanings} meanings` : "never dealt");
  check("a half-paired grid is not an answer to it",
    !!grid && grid.checkedEarly, String(grid && grid.checkedEarly));
  /* Pairing runs from the first tile down, so this is also the guard on
     the first one: the tiles are held by where they are, and a grid whose
     first meaning counted as "unpaired" could never be finished. */
  check("and pairing them all is, and gets marked",
    !!grid && grid.marked, String(grid && grid.marked));
  /* Half the pairs above were begun from the meanings, and the grid was
     finished and marked all the same: a learner reading down the right-hand
     column starts there rather than crossing the screen first. */
  check("a pair in the grid can be begun from either side",
    !!grid && grid.fromRight > 0,
    grid ? `${grid.fromRight} of ${Math.floor(grid.words / 2)} pairs made meaning first` : "never dealt");
  /* Reported four times in one evening: two tiles reading alike cannot be
     told apart by anybody, a right pairing is as likely to be marked wrong
     as right, and both learners gave up and pressed "I don't know". */
  check("no two meanings in a grid read alike, which would make it a guess",
    !!grid && new Set(grid.meaningText || []).size === (grid.meaningText || []).length,
    grid ? (grid.meaningText || []).join(" · ") : "never dealt");
  /* The two lists are two columns, the language being learnt first and
     English second — which the stylesheet lays side by side at every width.
     jsdom has no layout to measure, so what is checked here is the order
     the columns are written in; that they sit beside each other rather than
     stacking is measured in a browser. */
  check("the words are one column and the meanings another, in that order",
    !!grid && grid.columns === 2 && grid.firstColumn === "words",
    grid ? `${grid.columns} columns, first holds ${grid.firstColumn}` : "never dealt");

  /* And what is never in one: a frame, whose hole is filled only for the
     card being asked, and a value, which is in the deck to fill somebody
     else's sentence rather than to be told apart from four other words. */
  check("no frame and no value ever stands in the grid",
    !!grid && !/\{\{|Raphael|Victor|رافائيل|فيكتور|My name is/.test(grid.text || ""),
    (grid && grid.text) ? (grid.text || "").replace(/\s+/g, " ").slice(0, 90) : "never dealt");

  check("a word can be chosen out of the phrase before it has to be written into it",
    sawPicker, sawPicker ? "the gap was offered as a choice" : "no question offered it");
  check("and the choice is between a few real words, one of them right",
    pickerOptions > 1 && pickerHadTheWord, `${pickerOptions} offered, the right one among them: ${pickerHadTheWord}`);
  check("the phrase a word turns up in is shown after the question",
    sawWhereItTurnedUp > 0, `shown after ${sawWhereItTurnedUp} answers`);
  check("including after questions that are not about the phrase at all",
    sawOnAPlainQuestion,
    sawOnAPlainQuestion
      ? "which is the thing that changed: the link pays out everywhere now"
      : "it only paid out on the questions built from it");
}

/* ---- a frame remembers which of its names it has been met with ----

   A name like Raphael is never drilled on its own — "what does Raphael
   mean" is not a question — so it has no progress anywhere to read, and the
   frame is the only place it is ever met. That is what this record is for:
   a value with no ladder of its own may stand one level above the highest
   it has already been seen at, so nobody is asked to write a sentence
   containing a word they have never been shown. Written on any answer,
   right or wrong, because the question is whether they have seen it.

   A session of its own, on the deck the frame is actually in. The walk
   above is dealt from Lesson 1, which the frame is not in — hunting it
   there only ran the turns out, and a check that fires on some runs and not
   others is one that will stop firing without saying so.

   The rule itself is checked in tests/variables.test.mjs, over every
   combination rather than the one a session happens to deal. What is
   checked here is the wiring: that a real question, answered in the real
   app, leaves the record the rule reads. */
{
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
  click(buttonNamed(/^Home$/));
  await sleep(300);
  click(buttonNamed(/Build a session|Choose what to practice|Pick cards/));
  await sleep(300);
  click([...document.querySelectorAll(".at-modecard")].find((b) => /Ultimate/.test(b.textContent || "")));
  await sleep(80);
  clickNamed(/^(Next|Choose a mode|Choose at least one card)$/);
  await sleep(150);
  const intro = [...document.querySelectorAll(".at-tagpickmain")]
    .find((b) => /Introductions/.test(b.textContent || ""));
  check("the deck the frame is in can be practised on its own", !!intro,
    [...document.querySelectorAll(".at-tagpickmain")].map((b) => (b.textContent || "").slice(0, 20)).join(" | "));
  click(intro);
  await sleep(80);
  clickNamed(/^(Next|Choose at least one card|Start|Choose a length)$/);
  await sleep(200);
  clickNamed(/^(Start|Choose a length)$/);
  await sleep(500);

  /* The question comes up filled: the hole is filled before anybody sees
     it, and a visible {{name}} is the bug this whole gate could have
     introduced. */
  const shown = (document.body.textContent || "").replace(/\s+/g, " ");
  check("a frame is asked with its hole filled, and never with the braces showing",
    /\u0627\u0633\u0645\u064a|My name is/.test(shown) && !/\{\{/.test(shown),
    shown.slice(0, 120));
  /* And the deck's three cards are one question's worth, not three: the two
     names in it are values, and a hand-built session used to drill them as
     cards in their own right — which a dealt one has never done, and which
     is the one thing "practised on its own" is switched off to prevent. */
  const counter = (shown.match(/\d+ \/ \d+/) || ["(no counter)"])[0];
  check("and the names that fill it are not themselves asked",
    counter === "1 / 1", `${counter} — the deck holds a frame and the two names that fill it`);

  /* Answer it, however it was asked. */
  const choices = document.querySelector('[data-el="answer-choices"]');
  if (choices) {
    click([...choices.querySelectorAll("button")][0]);
    await sleep(60);
  } else if (document.querySelector('[data-el="answer-input"]')) {
    click(buttonNamed(/^I don't know$/));
    await sleep(200);
  }
  if (!document.querySelector('[data-el="verdict"]')) {
    click(document.querySelector('[data-el="check-button"]'));
    await sleep(250);
  }
  click(buttonNamed(/^Continue$/));
  /* Answers reach the device 600ms after the last one; read once that has
     had time to happen, as the scene walk above does. */
  await sleep(900);

  const raw = w.localStorage.getItem("arabic-trainer:arabic-trainer-v3");
  const doc = raw ? JSON.parse(raw) : { items: [] };
  const frame = (doc.items || []).find((/** @type {any} */ i) => /k444444444444/.test(i.id || ""));
  const met = lead(frame).met || {};
  const keys = Object.keys(met);
  check("answering it records which name it was asked with",
    keys.length > 0 && keys.every((k) => /^name:srvk[56]/.test(k)),
    JSON.stringify(met));
  check("at the level the question stood on",
    keys.every((k) => Number.isInteger(met[k]) && met[k] >= 1 && met[k] <= 4),
    JSON.stringify(met));

  /* And no card without a hole keeps one: the first cut of this wrote an
     empty record onto every card in the document the moment it was
     answered. */
  const forms = (doc.items || []).flatMap((/** @type {any} */ i) =>
    formsIn(i).concat(i.lines || []));
  check("while a card with no hole in it keeps no such record",
    forms.every((/** @type {any} */ f) => !f.met || Object.keys(f.met).length > 0) &&
      forms.some((/** @type {any} */ f) => /k111111111111/.test(f.id || "") && !f.met),
    `${forms.filter((/** @type {any} */ f) => f.met).length} of ${forms.length} forms carry one`);

  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
}

/* ---- a card the learner asks for ----
   High priority is the one place a learner overrides the schedule: they
   mark a card in their own card list and it is in the very next session,
   however far off its review was. Driven through the real screens, because
   what makes it worth having is that the mark reaches the session — and
   between the two sit the ready count, the card list and the builder. */
{
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
  click(buttonNamed(/^Cards$/));
  await sleep(400);

  const tileOf = (/** @type {Element} */ el) => el && el.closest(".at-minicard");
  const firstTile = must(document.querySelector(".at-cardgrid .at-minicard"), "a card to mark");
  const marked = (firstTile.textContent || "").slice(0, 24);
  click(firstTile);
  await sleep(350);

  const markBtn = buttonNamed(/^Mark as high priority$/);
  check("a learner can mark a card high priority from their own card list", !!markBtn,
    (document.body.textContent || "").slice(-160).replace(/\s+/g, " "));
  click(markBtn);
  await sleep(300);
  check("and the button then says how to take it off",
    !!buttonNamed(/High priority — tap to clear/),
    (document.body.textContent || "").slice(-120).replace(/\s+/g, " "));

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(350);
  const priTiles = [...document.querySelectorAll(".at-cardgrid .at-minipri")];
  check("the list says which card it was", priTiles.length === 1,
    `${priTiles.length} tiles marked`);
  const priTile = priTiles.length ? tileOf(priTiles[0]) : null;
  check("and it is the one that was marked",
    !!priTile && (priTile.textContent || "").includes(marked.trim().slice(0, 8)),
    `${(priTile && priTile.textContent) || "none"} vs ${marked}`);

  /* And into a session, which is the whole point of the mark. A marked
     card opens the session, so the first question is about it. */
  click(buttonNamed(/^Home$/));
  await sleep(400);
  click(buttonNamed(/^Start session$/));
  await sleep(500);
  const asked = (document.querySelector('[data-el="question-prompt"]') || {}).textContent || "";
  const answers = (document.querySelector(".at-answerbox") || {}).textContent || "";
  /* Which card the first question is about, not merely that there is one.
     This used to check that a session had started at all — which it would
     have done with or without the mark, so the one thing the mark is for
     was the one thing nobody was asking about. The card's own script is
     what names it: it is on the tile that was marked and on the screen it
     is asked on, whichever way round the question goes. */
  const scriptOf = (/** @type {string} */ s) =>
    (s.match(/[؀-ۿݐ-ݿЀ-ӿ]+/) || [""])[0];
  const markedScript = scriptOf(marked);
  check("a marked card opens the very next session",
    !!markedScript && `${asked} ${answers}`.includes(markedScript),
    `marked ${markedScript || marked} · asked ${asked.slice(0, 40)} · ${answers.slice(0, 60)}`);

  /* Take the mark off again and the card list agrees. Marked for ever is
     what the setting says it is, so the way out has to work. */
  click(document.querySelector('[data-el="leave-session"]'));
  await sleep(150);
  click(buttonNamed(/^Leave$/));
  await sleep(350);
  click(buttonNamed(/^Cards$/));
  await sleep(400);
  click(must(document.querySelector(".at-cardgrid .at-minipri"), "the marked tile").closest(".at-minicard"));
  await sleep(350);
  click(must(buttonNamed(/High priority — tap to clear/), "the button that clears it"));
  await sleep(300);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(350);
  check("clearing the mark takes it off the card list",
    document.querySelectorAll(".at-cardgrid .at-minipri").length === 0,
    `${document.querySelectorAll(".at-cardgrid .at-minipri").length} still marked`);
  check("and the question it was asked was about a real card",
    asked.length > 0 || answers.length > 0,
    `prompt=${asked.slice(0, 40)} answers=${answers.slice(0, 40)}`);
}

/* ---- every exercise a card could be asked, on the teacher's card ----
   A teacher writing cards could not see what a student is actually asked.
   The foot of a card in the teaching space now lists every exercise that
   card could be asked, one button each, with the ones it cannot do out of
   reach and saying what they are waiting for. Pressing one runs that
   question for real, through the screen a student is asked on.

   The seeded phrase is the card to look at: script and meaning, no
   recording, and it teaches the word — so it can be read and written and
   not heard, which is the split this is here to show. */
{
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }

  /* First: it is gone from the student's side, where it was built by
     mistake. A learner opening their own card gets the card. */
  click(buttonNamed(/^Cards$/));
  await sleep(400);
  click(document.querySelector(".at-cardgrid .at-minicard"));
  await sleep(300);
  check("a student's card screen does not offer exercises to try",
    document.querySelectorAll(".at-try").length === 0,
    `${document.querySelectorAll(".at-try").length} on the learner's card`);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(250);

  /* Into the teaching space, which this person now teaches in. */
  const toTeaching = [...document.querySelectorAll(".at-spacebtn")]
    .find((b) => /Teaching/i.test(b.getAttribute("aria-label") || ""));
  check("a teacher can reach the teaching space", !!toTeaching,
    [...document.querySelectorAll(".at-spacebtn")].map((b) => b.getAttribute("aria-label")).join(","));
  click(toTeaching);
  await sleep(700);

  /* The teaching space's own Cards tab. Both spaces have one, and the
     learner's nav is still in the document behind this, so the tab is
     taken from inside the frame rather than by name alone. */
  /* The space is a screen over the app, which is what "bare" marks. The
     learner's own nav and card list are still in the document behind it,
     so everything below is looked for inside the frame. */
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  check("the teaching space has a Cards tab of its own", teachTabs.length > 0,
    [...frame.querySelectorAll('[role="tab"], .at-tab')].map((b) => b.textContent).join("|"));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);
  const teachTiles = [...frame.querySelectorAll(".at-minicard")];
  const phraseTile = teachTiles.find((t) => (t.textContent || "").includes("the book is big"));
  check("their own cards are listed there", !!phraseTile,
    teachTiles.map((t) => (t.textContent || "").slice(0, 18)).join(" | ") || "no cards");
  click(phraseTile);
  await sleep(450);

  /* The other half of the same split: the panel the student's card screen
     drops is the one a teacher came here for, so it is still on this one.
     The card opens over the space rather than inside its frame, so the
     readout is taken as the last one in the document — the student's is
     closed by now. */
  const teachRead = [...document.querySelectorAll(".at-readout")].pop();
  check("a teacher's card still says which decks it lives in",
    !!teachRead && /Where it lives/i.test(teachRead.textContent || ""),
    teachRead ? (teachRead.textContent || "").replace(/\s+/g, " ").slice(0, 120) : "(no readout)");

  const tries = () => /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll(".at-try")]);
  check("a card in the teaching space lists the exercises it could be asked",
    tries().length > 1, `${tries().length} offered`);
  const enabled = tries().filter((b) => !b.disabled);
  const disabled = tries().filter((b) => b.disabled);
  check("the ones it has the data for can be pressed", enabled.length > 0,
    `${enabled.length} of ${tries().length}`);
  /* The phrase has no recording, so every listening exercise is here and
     out of reach — the half that had to be built deliberately rather than
     by leaving them out. */
  check("and the ones it cannot do are shown too, out of reach",
    disabled.length > 0, `${disabled.length} greyed out`);
  check("each of those says what it is waiting for",
    disabled.every((b) => /Needs /.test(b.textContent || "")),
    disabled.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 2).join(" | "));
  check("a recording is what the listening ones are waiting for",
    disabled.some((b) => /recording/.test(b.textContent || "")),
    disabled.map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()).join(" | ").slice(0, 110));
  check("and a button nobody can press still names itself",
    disabled.every((b) => /—/.test(b.getAttribute("aria-label") || "")),
    (disabled[0] && disabled[0].getAttribute("aria-label")) || "");

  /* Pressing one runs that question, on the teacher's own card, through
     the screen a student is asked on. */
  const before = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  click(enabled[0]);
  await sleep(600);
  check("pressing one runs that question on the teacher's own card",
    !!document.querySelector(".at-instruction") &&
      /الكتاب كبير/.test((document.querySelector('[data-el="question-prompt"]') || {}).textContent || ""),
    ((document.querySelector(".at-instruction") || {}).textContent || "no question") +
      " · " + ((document.querySelector('[data-el="question-prompt"]') || {}).textContent || ""));
  /* One question has no "how far through are you". "1 / 1" and a bar that
     can only be empty or full answer a question nobody asked. */
  check("and it says nothing about how far through you are",
    !document.querySelector('[data-el="session-count"]') &&
      !document.querySelector('[data-el="session-progress"]'),
    `${document.querySelector('[data-el="session-count"]') ? "count " : ""}${
      document.querySelector('[data-el="session-progress"]') ? "bar" : ""}` || "neither");
  check("but the way out is still there",
    !!document.querySelector('[data-el="leave-session"]'),
    document.querySelector('[data-el="leave-session"]') ? "the close button" : "nothing to close it with");

  /* Answering it puts the teacher back on the card it was about. There is
     no score to show and nothing left to do, so the screen that used to
     say so was a tap between the answer and the card. */
  click(buttonNamed(/^I don't know$/) || document.querySelector('[data-el="check-button"]'));
  await sleep(300);
  check("a trial question can be answered", !!document.querySelector('[data-el="verdict"]'),
    (document.body.textContent || "").slice(0, 70).replace(/\s+/g, " "));
  click(buttonNamed(/^Continue$/));
  await sleep(700);
  check("and Continue goes straight back, with no screen in between",
    !/That's the exercise/.test(document.body.textContent || ""),
    (document.body.textContent || "").slice(0, 70).replace(/\s+/g, " "));
  const landed = [...document.querySelectorAll(".at-readout")].pop();
  check("landing on the card that was being tested",
    !!landed && (landed.textContent || "").includes("الكتاب كبير") &&
      !document.querySelector(".at-instruction"),
    landed ? (landed.textContent || "").replace(/\s+/g, " ").slice(0, 70) : "no card open");
  check("with its exercises there to try again",
    document.querySelectorAll(".at-try").length > 1,
    `${document.querySelectorAll(".at-try").length} offered`);

  /* And the other way out — closing it unanswered — asks nothing and
     lands in the same place. */
  click(tries().filter((b) => !b.disabled)[0]);
  await sleep(600);
  click(document.querySelector('[data-el="leave-session"]'));
  await sleep(500);
  check("leaving a trial asks no questions",
    !buttonNamed(/^Leave$/) && !/Leave this session/.test(document.body.textContent || ""),
    (document.body.textContent || "").slice(0, 80).replace(/\s+/g, " "));
  const backOnCard = [...document.querySelectorAll(".at-readout")].pop();
  check("and it goes back to the card it was asked about",
    !!backOnCard && (backOnCard.textContent || "").includes("الكتاب كبير") &&
      !document.querySelector(".at-instruction"),
    backOnCard ? (backOnCard.textContent || "").replace(/\s+/g, " ").slice(0, 70) : "no card open");

  /* And nothing about it was recorded. The card is the teacher's own
     material, not something this device is learning. */
  const after = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  check("a trial leaves the document exactly as it found it",
    JSON.stringify(after.items) === JSON.stringify(before.items),
    `${(after.items || []).length} cards before and after`);
  check("and adds nothing to the day's count",
    JSON.stringify(after.log) === JSON.stringify(before.log),
    `${JSON.stringify(after.log)} vs ${JSON.stringify(before.log)}`);
}

/* ---- one meaning is one question ----
   A card may mean two things — "book / notebook" — and both are right when
   the question is what it means. Asked for the word instead, the meaning is
   the question, and showing both asked neither: the prompt read as one
   English phrase with a slash through the middle of it, and a card that
   means two things gave away more of itself than the question meant to.

   Driven through the teacher's own trial, because that asks one named
   exercise rather than whichever one a shuffled queue reaches. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);

  const wordTile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("كتاب"));
  check("the card that means two things is listed with both of them",
    !!wordTile && /book\s*\/\s*notebook/.test(wordTile.textContent || ""),
    wordTile ? (wordTile.textContent || "").replace(/\s+/g, " ").slice(0, 60) : "no tile");
  click(wordTile);
  await sleep(450);

  const toScript = [...document.querySelectorAll(".at-try")]
    .find((b) => /^Try English → Arabic script$/.test(b.getAttribute("aria-label") || ""));
  check("writing it from its meaning is one of the exercises offered", !!toScript,
    [...document.querySelectorAll(".at-try")].map((b) => b.getAttribute("aria-label")).join(" | "));
  click(toScript);
  await sleep(600);

  const prompt = () =>
    ((document.querySelector('[data-el="question-prompt"]') || {}).textContent || "").replace(/\s+/g, " ").trim();

  /* The line above it, while a question is on screen. It named the card —
     "Write this card in Arabic script" — which is the thing underneath it,
     and it lowered the language's own name, which is a name wherever it
     lands. */
  const asked = () =>
    ((document.querySelector(".at-instruction") || {}).textContent || "").replace(/\s+/g, " ").trim();
  check("the line above the question says what to do, without naming the card",
    asked() === "Write in Arabic script", asked() || "(no instruction)");
  /* Which of the two it is depends on how often the card has been asked
     this, and this one has been through a session already — so what is
     checked is that it is one of them and whole, rather than which. */
  check("the question shows one meaning, not the pair",
    ["book", "notebook"].includes(prompt()),
    `${prompt() || "(no prompt)"} · ${(document.querySelector(".at-instruction") || {}).textContent || ""}`);

  /* And what is accepted is untouched: the answer is the word, and the
     question narrowing to one meaning does not narrow that. */
  const scriptInput = document.querySelector('[data-el="answer-input"]');
  check("with the script asked for in the answer box",
    !!scriptInput && scriptInput.getAttribute("lang") === "ar-PS",
    scriptInput ? `lang=${scriptInput.getAttribute("lang")}` : "no answer input");
  if (scriptInput) {
    const setter = must(
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
      "the input's value descriptor",
    ).set;
    must(setter, "the input's value setter").call(scriptInput, card.ar);
    scriptInput.dispatchEvent(new w.Event("input", { bubbles: true }));
    await sleep(60);
    click(buttonNamed(/^Check$/));
    await sleep(300);
    check("and the word itself is still the answer",
      /Correct|Good job|Nicely done|Great/.test((document.querySelector('[data-el="verdict"]') || {}).textContent || ""),
      (document.querySelector('[data-el="verdict"]') || {}).textContent || "(no verdict)");
    click(buttonNamed(/^Continue$/));
    await sleep(700);
  } else {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(500);
  }
}

/* ---- a misspelt answer says which letter ----

   "Not quite" and the word underneath was the whole of what a misspelling
   came back with, and on a script a learner is still learning to read,
   finding the one letter that differs is most of the work and the part
   they are least able to do. One letter is wrong; the screen now says
   which — in what they wrote, and in the answer, because a letter left
   out has no mark on their side at all. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);
  const bookTile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => /book/.test(t.textContent || ""));
  click(bookTile);
  await sleep(450);
  const tryScript = [...document.querySelectorAll(".at-try")]
    .find((b) => /^Try English → Arabic script$/.test(b.getAttribute("aria-label") || ""));
  check("the card offers writing it from its meaning, to try a misspelling on",
    !!tryScript,
    [...document.querySelectorAll(".at-try")].map((b) => b.getAttribute("aria-label")).join(" | "));
  click(tryScript);
  await sleep(600);

  const box = document.querySelector('[data-el="answer-input"]');
  const setValue = must(
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
    "the input's value descriptor",
  ).set;
  /* One letter out of four is a typo, and since 0.202 a typo is not marked
     at all: the question is asked again, once, and the second try is what
     counts. So the first attempt here is spent on the benefit of the
     doubt — and on checking that the app does not point at the letter
     while the retry is still to come, which would make the retry a
     copying exercise. */
  const typeIn = (/** @type {string} */ word) => {
    must(setValue, "the input's value setter").call(box, word);
    if (box) box.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  typeIn("كتاف");
  await sleep(60);
  click(buttonNamed(/^Check$/));
  await sleep(350);

  const spelt = () => /** @type {any} */ (document.querySelector('[data-el="answer-spelt"]'));
  check("one letter out is given the benefit of the doubt and asked again",
    !!document.querySelector('[data-el="answer-input"]') && !document.querySelector('[data-el="verdict"]'),
    document.querySelector('[data-el="verdict"]')
      ? `marked instead: ${(document.querySelector('[data-el="verdict"]') || {}).textContent}`
      : "asked again");
  check("and the retry is not told which letter was wrong",
    !spelt(),
    spelt() ? `marked: ${(spelt().textContent || "").trim()}` : "nothing pointed at");
  check("with the box emptied to write it again",
    ((/** @type {any} */ (document.querySelector('[data-el="answer-input"]')) || {}).value || "") === "",
    `"${(/** @type {any} */ (document.querySelector('[data-el="answer-input"]')) || {}).value}"`);

  /* Wrong a second time, and now it is a miss with the full marking under
     it — which is the behaviour every check below was written for. */
  typeIn("كتاف");
  await sleep(60);
  click(buttonNamed(/^Check$/));
  await sleep(350);

  const marksIn = (/** @type {Element | null} */ el) =>
    [...(el ? el.querySelectorAll("mark.at-spellwrong") : [])]
      .map((m) => (m.textContent || "").trim());
  check("a misspelt answer is marked wrong, as it was before",
    /Not quite|Very close/.test(
      ((document.querySelector('[data-el="verdict"]') || {}).textContent || "") +
        ((document.querySelector('[data-el="verdict-reason"]') || {}).textContent || "")),
    (document.querySelector('[data-el="verdict"]') || {}).textContent || "(no verdict)");
  check("and what they wrote comes back with the wrong letter highlighted",
    !!spelt() && JSON.stringify(marksIn(spelt())) === JSON.stringify(["ف"]),
    spelt() ? `${(spelt().textContent || "").trim()} · marked ${marksIn(spelt()).join(", ") || "nothing"}` : "(not shown)");
  /* The whole word, not just the letter: the runs are what is drawn in
     place of what they typed, so anything missing from them is a letter
     they wrote and can no longer see. */
  check("with the rest of the word still there around it",
    !!spelt() && (spelt().textContent || "").trim() === "كتاف",
    spelt() ? `"${(spelt().textContent || "").trim()}"` : "(not shown)");
  /* And the box is not shown twice: the answer they wrote is already the
     thing on the screen, so the marked one stands where it stood. */
  check("and stands where the answer box stood, rather than under it",
    !document.querySelector('[data-el="answer-input"]'),
    document.querySelector('[data-el="answer-input"]') ? "both are on screen" : "in its place");
  /* The other half. A letter written wrong is marked on both sides; a
     letter left out can only be marked here. */
  const right = document.querySelector('[data-el="answer-value-text"]');
  check("and the answer underneath marks the letter that should have been there",
    !!right && JSON.stringify(marksIn(right)) === JSON.stringify(["ب"]),
    right ? `${(right.textContent || "").trim()} · marked ${marksIn(right).join(", ") || "nothing"}` : "(no answer shown)");

  click(buttonNamed(/^Continue$/));
  await sleep(700);
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(500);
  }
}

/* ---- what kind of word a card is, wherever it is asked ----

   A drop-down since 0.183, shutting to the answer with a pencil beside it:
   on most cards it is answered once and then read, and a column of radio
   buttons standing open above the word itself is a decision nobody is
   making, in the way of the fields they came to fill in. So every walk
   below opens the list before reading it — by the pencil where there is an
   answer, and by the button where there is not. At the top level because
   four walks in three blocks ask the same question. */
const wordKindBtn = () => /** @type {any} */ ([...document.querySelectorAll(".at-choosebtn")]
  .find((b) => /^What subtype/.test(b.getAttribute("aria-label") || "")) || null);
const wordKindPencil = () => /** @type {any} */ ([...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Change what subtype this card is") || null);
/* What the word-kind row is showing, read off the row the pencil is on:
   the card's own type wears the same shut row, one section above. */
const wordKindSaid = () => {
  const row = wordKindPencil() ? wordKindPencil().closest(".at-shutrow") : null;
  return ((row && row.querySelector(".at-shutname") || {}).textContent || "").trim();
};
/* "This card" — the block every editor opens with, and what it asks. What
   a card is called lives in it since 0.194: a verb's name and a sentence's
   are facts about the card, in the same class as what kind of card it is
   and what kind of word, so they are asked where those are and wear the
   same heading rather than a framed section of their own. */
const thisCardBlock = () => /** @type {any} */ ([...document.querySelectorAll(".at-formblock")]
  .find((b) => /^This card$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()))
  || null);
/* The questions it asks, in the order it asks them. */
const thisCardAsks = () => {
  const block = thisCardBlock();
  return block ? [...block.querySelectorAll(".at-label")].map((l) => (l.textContent || "").trim()) : [];
};
const cardNameField = () => {
  const block = thisCardBlock();
  return /** @type {any} */ ((block && [...block.querySelectorAll(".at-field")]
    .find((f) => /^Name$/.test(((f.querySelector(".at-label") || {}).textContent || "").trim())))
    || null);
};
const formRows = () => [...document.querySelectorAll(
  '[role="radiogroup"][aria-label="What subtype"] .at-tickrow')];
const openWordKind = async () => {
  if (formRows().length) return;
  click(wordKindPencil() || wordKindBtn());
  await sleep(250);
};
/* Choosing one: open the list where it is shut, tick the answer, and let
   the screen settle — which is a table appearing or going. */
const pickKind = async (/** @type {RegExp} */ want) => {
  await openWordKind();
  const row = formRows().find((r) => want.test((r.textContent || "").trim()));
  click(row ? row.querySelector("input") : null);
  await sleep(320);
};

/* ---- a conversation, opened by the teacher who wrote it ----
   Opening one from Teaching > Cards put the word editor up: one script
   box, one meaning, and the whole scene out of reach behind it. A stored
   card carries its turns but no label saying it is a conversation, and
   every teacher's screen was asking the label.

   Which side the student takes is asked here too, and is allowed to go
   unanswered — a scene worth holding up from either end should not make a
   teacher commit to one before the second line is written. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);

  const talkTile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("At the door"));
  check("a conversation is listed with the teacher's other cards", !!talkTile,
    [...frame.querySelectorAll(".at-minicard")].map((t) => (t.textContent || "").slice(0, 16)).join(" | "));
  click(talkTile);
  await sleep(450);

  /* The readout first: a scene reads as a scene, which is the same
     question about the same stored card. */
  const read = [...document.querySelectorAll(".at-readout")].pop();
  check("opening it shows the whole conversation, not one word of it",
    !!read && document.querySelectorAll(".at-readout .at-sceneline").length === 3,
    `${document.querySelectorAll(".at-readout .at-sceneline").length} turns shown`);
  check("and it says the part is nobody's until the question picks one",
    !!read && /Not set/.test(read.textContent || ""),
    read ? (read.textContent || "").replace(/\s+/g, " ").slice(-140) : "(no readout)");
  /* Read the same way it is practised: one speaker down each side. */
  const readSides = read
    ? [...read.querySelectorAll(".at-sceneline")].map((el) =>
        el.classList.contains("side0") ? 0 : el.classList.contains("side1") ? 1 : null
      )
    : [];
  check("and the scene reads with one speaker down each side",
    !!read && !!read.querySelector(".at-scene.sided") && readSides.join("") === "010",
    readSides.join(",") || "(no turns)");

  click([...document.querySelectorAll("button")].find((b) => /^Edit$/.test((b.textContent || "").trim())));
  await sleep(450);

  /* The bug, in one assertion: which editor came up. */
  const heading = (
    [...document.querySelectorAll(".at-screenhead h2")].pop() || {}
  ).textContent || "";
  check("editing it opens the conversation editor, not the word editor",
    /conversation/i.test(document.body.textContent || "") &&
      document.querySelectorAll(".at-formblock").length > 3,
    `${heading || "(no title)"} · ${document.querySelectorAll(".at-formblock").length} blocks`);
  /* And it is an editor for a card, which this one happens to be a
     conversation. A screen called "Edit conversation" said the opposite. */
  check("it is still the card editor, saying which kind of card this is",
    /^Edit card$/.test(heading.trim()) &&
      /This card/.test(document.body.textContent || ""),
    heading.trim() || "(no title)");
  /* And written the same way. A column of identical blocks made a teacher
     read the "who says it" picker on every one to see the shape of what
     they had; the shape is the shape of the page now. */
  const editSides = [...document.querySelectorAll(".at-screen.over .at-formblock")]
    .map((el) => (el.classList.contains("side0") ? 0 : el.classList.contains("side1") ? 1 : null))
    .filter((x) => x !== null);
  check("and each turn is written on its speaker's side",
    editSides.join("") === "010", editSides.join(",") || "(no sided blocks)");

  check("with every turn there to edit",
    [...document.querySelectorAll("input")].filter((i) => /^What line \d+ means$/.test(i.getAttribute("aria-label") || "")).length === 3,
    `${[...document.querySelectorAll("input")].filter((i) => /^What line/.test(i.getAttribute("aria-label") || "")).length} turns`);

  /* And the part is offered as a question the teacher may decline. */
  const parts = [...document.querySelectorAll('[role="group"][aria-label="The student plays"] .at-seg')];
  check("the student's part offers 'either' alongside the named parts",
    parts.length === 3 && /Either/.test(parts[0].textContent || ""),
    parts.map((b) => b.textContent).join(" | ") || "(no part picker)");
  check("and 'either' is what an unset card comes back on",
    !!parts[0] && parts[0].getAttribute("aria-pressed") === "true",
    parts.map((b) => `${b.textContent}=${b.getAttribute("aria-pressed")}`).join(" "));

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);

  /* ---- somewhere to put them that does not exist yet ----

     Selecting thirty cards and then finding no deck for them used to mean
     leaving to make one, which threw the selection away: the way out of
     the screen was to lose the work that got you there. */
  const cardsFrame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  click(cardsFrame.querySelector(".at-selectbtn"));
  await sleep(200);
  const firstPick = cardsFrame.querySelector(".at-ckbox.pick");
  check("cards can be selected in the teaching space", !!firstPick,
    cardsFrame.querySelectorAll(".at-tilewrap").length + " tiles");
  click(firstPick);
  await sleep(200);
  check("and ticking one raises the bulk actions", !!document.querySelector(".at-bulkfloat"),
    (document.body.textContent || "").slice(-80));
  clickNamed(/^Add to a deck$/);
  await sleep(300);
  check("the deck screen offers to make one on the spot", !!buttonNamed(/^New deck$/),
    [...document.querySelectorAll("button")].map((b) => b.textContent).join("|").slice(-120));
  clickNamed(/^New deck$/);
  await sleep(200);
  const deckName = [...document.querySelectorAll(".at-formblock")]
    .find((d) => /New deck/.test(d.textContent || ""));
  const deckInput = deckName && deckName.querySelector("input");
  if (deckInput) {
    const setInput = must(
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
      "the input's value descriptor"
    ).set;
    must(setInput, "the input's value setter").call(deckInput, "Week 3 · Verbs");
    deckInput.dispatchEvent(new w.Event("input", { bubbles: true }));
    await sleep(80);
    clickNamed(/^Create$/);
    await sleep(400);
    check("making one takes the language from the cards going into it",
      madeDecks.length === 1 && madeDecks[0].lang === "ar-PS",
      JSON.stringify(madeDecks[0] || null));
    const rows = [...document.querySelectorAll(".at-tickrow")];
    const made = rows.find((r) => /Week 3/.test(r.textContent || ""));
    check("the new deck joins the list", !!made,
      rows.map((r) => (r.textContent || "").slice(0, 14)).join(" | ") || "no decks listed");
    /* Ticked, because it is the one they were about to choose: choosing it
       again by hand is a step that says nothing. */
    check("and is already ticked, which is why it was made",
      !!made && !!made.querySelector("input:checked"),
      made ? (made.textContent || "").slice(0, 40) : "");
  }
  clickNamed(/^Cancel$/);
  await sleep(250);
  click(cardsFrame.querySelector(".at-selectbtn"));
  await sleep(200);

  /* ---- and the report sees it ----
     A conversation keeps its words in its turns, so a report reading the
     card's own text saw nothing in it: words taught only through dialogue
     read as bare, and the turns using them never came up to confirm. The
     session builder had been drilling those same words inside those same
     turns all along. */
  const inFrame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const ctxTab = [...inFrame.querySelectorAll("button")].find((b) => /^In context$/.test(b.textContent || ""));
  click(ctxTab);
  await sleep(500);

  const rows = [...inFrame.querySelectorAll(".at-findrow")].map((r) => (r.textContent || "").replace(/\s+/g, " "));
  const turnRow = rows.find((t) => t.includes("وين الكتاب"));
  check("a turn of a conversation is offered as somewhere a word turns up",
    !!turnRow, rows.slice(0, 3).join(" // ") || "no rows at all");
  check("and it reads as a turn, with the person who says it",
    !!turnRow && /Layla says/.test(turnRow), turnRow || "(no row)");
  /* The counterpart: the word is no longer listed as turning up nowhere.
     Matched on the whole word rather than on the text of the panel — the
     phrase card "الكتاب كبير" is two tokens, so it is word-shaped itself
     and legitimately bare, and it has the word inside it. */
  const barePanel = [...inFrame.querySelectorAll(".at-panel")]
    .find((p) => /Words in no phrase/.test((p.querySelector(".at-eyebrow") || {}).textContent || ""));
  const bareWords = barePanel
    ? [...barePanel.querySelectorAll(".at-tag")].map((b) => (b.textContent || "").trim())
    : [];
  check("a word said in a conversation is not a word in no phrase",
    !!barePanel && !bareWords.includes("كتاب"),
    bareWords.join(" | ") || "(nothing bare)");

  /* ---- one way to make a card, whatever kind of card it is ----
     A conversation had a button of its own in a deck's card list, which
     made it read as a separate sort of thing to make — and meant this tab,
     with only the one New button, could not make one at all. The kind is
     the first field in the editor now. */
  const toCards = [...inFrame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(toCards[toCards.length - 1]);
  await sleep(450);
  check("there is no second button for making a conversation",
    !buttonNamed(/^New conversation$/),
    buttonNamed(/^New conversation$/) ? "one is still offered" : "just New card");
  click([...inFrame.querySelectorAll("button")].find((b) => /^New card$/.test((b.textContent || "").trim())));
  await sleep(450);

  /* The three shapes a card comes in, asked before the editor opens.

     It was the first field inside the editor until 0.187, which put a
     teacher in a screen for making a card and then asked what sort of card
     it was going to be. The three are not variations on one form — a
     conversation has speakers and turns where a word has forms — so the
     question comes first and what opens is a screen for making that one. */
  const kindRows = () => [...document.querySelectorAll(
    '[role="radiogroup"][aria-label="What kind of card is this?"] .at-tickrow')];
  check("New card asks what kind of card it is, before the editor",
    kindRows().length === 3 &&
      /^Word or phrase/.test((kindRows()[0].textContent || "").trim()) &&
      /^Sentence/.test((kindRows()[1].textContent || "").trim()) &&
      /^Conversation/.test((kindRows()[2].textContent || "").trim()),
    kindRows().map((r) => (r.textContent || "").slice(0, 18)).join(" | ") || "(no kind picker)");
  check("each of the three saying what it is",
    kindRows().length === 3 && kindRows().every((r) => !!r.querySelector("i")),
    kindRows().map((r) => ((r.querySelector("i") || {}).textContent || "—").slice(0, 30)).join(" | "));
  check("and nothing chosen for the teacher, because nothing here can be worked out",
    kindRows().every((r) => !(/** @type {any} */ (r.querySelector("input")).checked)),
    kindRows().map((r) => /** @type {any} */ (r.querySelector("input")).checked).join(" "));
  const startBtn = () => /** @type {any} */ (buttonNamed(/^Start the card$/) || null);
  check("and there is no way on until one is picked",
    !!startBtn() && startBtn().disabled,
    startBtn() ? (startBtn().disabled ? "refused" : "offered") : "(no button)");

  /* Picking one opens the editor for that one — named for it, and asking
     nothing further about it. */
  const pickCardKind = async (/** @type {RegExp} */ want) => {
    const row = kindRows().find((r) => want.test((r.textContent || "").trim()));
    click(row ? row.querySelector("input") : null);
    await sleep(200);
    click(startBtn());
    await sleep(450);
  };
  const screenTitle = () =>
    ((document.querySelector(".at-screen.over .at-screenhead h2") || {}).textContent || "").trim();
  const leaveScreen = async () => {
    click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
    await sleep(350);
  };
  const newCard = async () => {
    click([...document.querySelectorAll("button")].find((b) => /^New card$/.test((b.textContent || "").trim())));
    await sleep(450);
  };

  /* A conversation is made the same way as everything else: by answering
     this question. It had a button of its own once, and then a segment
     inside the editor that turned a half-written word into one. */
  await pickCardKind(/^Conversation/);
  const talkEditor = [...document.querySelectorAll(".at-screen.over")].pop();
  const talkText = talkEditor ? (talkEditor.textContent || "").replace(/\s+/g, " ") : "";
  check("picking Conversation opens the editor for one",
    /The scene/.test(talkText) && /Who is in it/.test(talkText) &&
      [...document.querySelectorAll('[role="group"][aria-label="Who says line 1"]')].length === 1,
    talkText.slice(0, 100) || "(no editor open)");
  check("and the screen is named for what is being made",
    screenTitle() === "New conversation", screenTitle() || "(no title)");

  await leaveScreen();
  await newCard();
  await pickCardKind(/^Word or phrase/);
  check("and picking the ordinary kind opens a screen for that one, named for it",
    screenTitle() === "New word or phrase", screenTitle() || "(no editor)");
  check("which says what kind of card it is and does not ask again",
    !document.querySelector('[role="group"][aria-label="The kind of card"]') &&
      /The type of card cannot be changed/.test(document.body.textContent || ""),
    document.querySelector('[role="group"][aria-label="The kind of card"]')
      ? "still asked" : "said, not asked");
  /* And, underneath, what kind of word it is — which is a second question
     and not a third answer to the first. The list is the language's own,
     and what follows from the answer is which table the card is offered.

     A drop-down since 0.183, and the answer shuts to a row with a pencil
     on it: on most cards this is answered once and then read, and a column
     of radio buttons standing open above the word itself is a decision
     nobody is making, in the way of the fields they came to fill in. So
     the list has to be opened before it can be read — by the pencil where
     there is an answer, and by the button where there is not. */
  check("and what kind of word it is, as a question of its own",
    !!wordKindBtn(),
    wordKindBtn() ? (wordKindBtn().textContent || "").trim() : "(nothing asked)");
  check("and nothing has been said yet, so the button says so and the list is shut",
    !!wordKindBtn() && /Not said yet/.test(wordKindBtn().textContent || "") && !formRows().length,
    `${wordKindBtn() ? (wordKindBtn().textContent || "").trim() : "(no button)"} · ${formRows().length} rows`);
  await openWordKind();
  check("and opening it lists what the language lets a word be",
    formRows().length > 2 &&
      /^Noun/.test((formRows()[0].textContent || "").trim()) &&
      formRows().some((r) => /^Verb/.test((r.textContent || "").trim())),
    formRows().map((r) => (r.textContent || "").slice(0, 16)).join(" | ") || "(nothing asked)");
  /* Each answer says what it gets you, which is what a row of ticks is for
     and what a track of segments cannot hold. */
  check("each of them saying what it gets you",
    formRows().every((r) => !!r.querySelector("i")),
    formRows().map((r) => ((r.querySelector("i") || {}).textContent || "—")).join(" | "));
  /* And a click anywhere else puts it away again, the rule every menu on
     this screen goes by. */
  click(document.querySelector(".at-screenhead h2"));
  await sleep(200);
  check("and a click outside puts the list away without answering it",
    !formRows().length && !!wordKindBtn() && /Not said yet/.test(wordKindBtn().textContent || ""),
    wordKindBtn() ? (wordKindBtn().textContent || "").trim() : "(no button)");

  /* ---- where the card goes, beside what kind of card it is ----
     Both are facts about the card rather than about its words, and this
     one decides whether a student ever sees it — so it is a button at the
     top rather than the section of ticks that used to be several hundred
     pixels below, under everything about the words. */
  {
    /* The outline of a pill that is not there yet. It is the whole of the
       control while the card is in nothing, and it says what pressing it
       is for rather than what the state is — "In no deck" was a true
       thing to read and no invitation to do anything about it. */
    const addBtn = () => /** @type {any} */ (document.querySelector(".at-deckadd"));
    const pills = () => [...document.querySelectorAll(".at-deckpill .nm")]
      .map((n) => (n.textContent || "").trim());
    check("a new card says where it goes, at the top", !!addBtn(),
      addBtn() ? (addBtn().textContent || "").trim() : "no button");
    /* A section of its own, directly under what kind of card this is: it
       is a fact about the card rather than about the kind, and at the foot
       of that block it read as one more thing about the kind. */
    const named = () => [...document.querySelectorAll(".at-formblock .at-formnum")]
      .map((n) => (n.textContent || "").trim());
    check("and the decks are a section of their own, under the kind of card",
      named().indexOf("Decks") === named().indexOf("This card") + 1 &&
        !!addBtn() && !!addBtn().closest(".at-formblock") &&
        /^Decks$/.test(((addBtn().closest(".at-formblock").querySelector(".at-formnum") || {}).textContent || "").trim()),
      named().join(" | "));
    check("and says it is in none yet, as the offer to put it in one",
      !pills().length && /add this card to a deck/i.test(addBtn() ? addBtn().textContent || "" : ""),
      `${pills().length} pills · ${addBtn() ? (addBtn().textContent || "").trim() : "no button"}`);
    check("the decks are put away until asked for", !document.querySelector(".at-choosemenu"));

    click(addBtn());
    await sleep(200);
    const menu = document.querySelector(".at-choosemenu");
    const rows = menu ? [...menu.querySelectorAll(".at-deckpick")] : [];
    check("pressing it opens the decks as a list to pick from", rows.length > 0,
      `${rows.length} decks offered`);
    const firstDeck = ((rows[0] && rows[0].querySelector("b")) || {}).textContent || "";
    click(rows[0]);
    await sleep(200);
    /* And what picking one leaves is the deck itself, standing in the
       section — the count that used to be on the button said how many and
       never which. */
    check("picking one stands it in the section as a deck of its own",
      pills().length === 1 && pills()[0] === firstDeck.trim(),
      pills().join(" | ") || "(no decks named)");
    check("and the row now says it is added rather than offering to add it",
      /added/i.test(((rows[0].querySelector(".at-deckmark") || {}).textContent || "")),
      ((rows[0].querySelector(".at-deckmark") || {}).textContent || "").trim() || "(no mark)");
    check("and the list stays open, because you are usually picking more than one",
      !!document.querySelector(".at-choosemenu"));
    /* A click anywhere else puts it away — the rule the language switch
       goes by, read off the click on the way down. */
    click(document.querySelector(".at-screenhead h2"));
    await sleep(200);
    check("a click outside puts it away", !document.querySelector(".at-choosemenu"));
    check("and the deck it was put in is still named",
      pills().length === 1 && pills()[0] === firstDeck.trim(),
      pills().join(" | ") || "(no decks named)");
    /* Out again from the pill itself, which is where a teacher looking at
       the deck they want rid of already is. */
    const drop = () => /** @type {any} */ (document.querySelector(".at-deckdrop"));
    check("the deck carries the cross that takes the card out of it", !!drop());
    click(drop());
    await sleep(200);
    check("and pressing it leaves the card in no deck, offering one again",
      !pills().length && /add this card to a deck/i.test(addBtn() ? addBtn().textContent || "" : ""),
      `${pills().length} pills · ${addBtn() ? (addBtn().textContent || "").trim() : "no button"}`);
  }

  /* ---- each accepted answer, and how that one is said ----
     A card may accept two spellings, and each is its own word with its own
     pronunciation. One transliteration under the pair belonged to one of
     them and lied about the other — and a question built from it could
     show one pronunciation and mark the other spelling right. */
  /* Boxes rather than inputs: a sentence's fields hold its blanks as
     pills, which an input cannot — see fieldNamed below. */
  const saidFields = () =>
    [...document.querySelectorAll("input, [contenteditable]")].filter((i) =>
      /^Transliteration$|^Transliteration of accepted answer \d+$/.test(i.getAttribute("aria-label") || "")
    );
  check("a card written in a script asks how its answer is said, beside it",
    saidFields().length === 1, `${saidFields().length} fields`);
  const addAnswer = [...document.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-label") === "Add another accepted answer");
  check("and another answer can be added", !!addAnswer,
    addAnswer ? "the + beside the last one" : "no add button");
  click(addAnswer);
  await sleep(250);
  check("a second accepted answer brings its own transliteration",
    saidFields().length === 2,
    saidFields().map((i) => i.getAttribute("aria-label")).join(" | ") || "none");
  check("each saying which answer it belongs to",
    saidFields().every((i, n) => (i.getAttribute("aria-label") || "").endsWith(String(n + 1))),
    saidFields().map((i) => i.getAttribute("aria-label")).join(" | "));
  /* And its own grammar. Two accepted answers may be a masculine and a
     feminine — one thing to know, two right answers — so what each one is
     grammatically belongs to it rather than to the card over both. */
  const grammarBtns = () =>
    [...document.querySelectorAll("button")].filter((b) =>
      /^Grammar of accepted answer \d+$/.test(b.getAttribute("aria-label") || "")
    );
  check("each accepted answer carries its own grammar",
    grammarBtns().length === 2,
    grammarBtns().map((b) => b.getAttribute("aria-label")).join(" | ") || "none");
  click(grammarBtns()[1]);
  await sleep(200);
  /* A radiogroup per axis since 0.188 — one line of radios rather than a
     stack of segmented tracks — so the pickers are found by the role the
     control actually has. */
  const genderGroup = document.querySelector('[role="radiogroup"][aria-label="Gender of accepted answer 2"]');
  check("and opens onto the pickers for that answer alone",
    !!genderGroup &&
      !document.querySelector('[role="radiogroup"][aria-label="Gender of accepted answer 1"]'),
    genderGroup ? "the second answer's" : "(no pickers)");
  /* Every value of the axis is on the line, named rather than counted:
     a picker that dropped one would still pass a count. */
  const genderPicks = [...(genderGroup ? genderGroup.querySelectorAll('input[type="radio"]') : [])]
    .map((i) => i.getAttribute("aria-label") || "");
  check("with every value of the axis on the one line, and a way back to none",
    ["not set", "masculine", "feminine", "neutral"].every((v) => genderPicks.includes(v)),
    genderPicks.join(" | ") || "(no radios)");
  click(
    [...(genderGroup ? genderGroup.querySelectorAll('input[type="radio"]') : [])]
      .find((b) => /feminine/i.test(b.getAttribute("aria-label") || ""))
  );
  await sleep(200);
  check("choosing one names that answer without touching the other",
    /sg\. f\.|f\./.test((grammarBtns()[1] || {}).textContent || "") &&
      !/f\./.test((grammarBtns()[0] || {}).textContent || ""),
    grammarBtns().map((b) => (b.textContent || "").trim()).join(" | "));

  /* And removing an answer takes its pronunciation with it, which is the
     whole guard against the two stored lists drifting apart. */
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Remove this answer"));
  await sleep(250);
  check("removing an answer takes its transliteration with it",
    saidFields().length === 1, `${saidFields().length} left`);

  /* ---- a hole has to be left in every field, or in none ----
     A frame whose English has a hole and whose script has not is a question
     that asks for a name and marks an answer that never contained one. The
     editor is where somebody can still fix it, so it is refused here rather
     than discovered in a session. */
  /* The fields are labelled by the text above them rather than by an
     aria-label, so they are found the way the eye finds them: the block
     holding that label, and the box in it.

     A sentence's fields are not <input>s since 0.179 — they hold the
     blanks of the sentence as pills, which an input cannot — so the box
     is whichever of the two is there, and what it holds is read rather
     than taken off .value. A verb's table, the numbers and every other
     box on this screen are still inputs. */
  const boxIn = (/** @type {any} */ field) =>
    field ? field.querySelector("[contenteditable], input") : null;
  const fieldNamed = (/** @type {RegExp} */ re) => {
    const field = [...document.querySelectorAll(".at-formblock.main .at-field")].find((f) =>
      re.test(((f.querySelector(".at-label") || {}).textContent || "").trim())
    );
    return boxIn(field);
  };
  /** What a box holds, with its blanks read back as what a card stores. */
  const readField = (/** @type {any} */ el) => {
    if (!el) return "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value;
    let out = "";
    /** @param {any} node */
    const walk = (node) => {
      if (node.nodeType === 3) {
        out += node.nodeValue || "";
        return;
      }
      const slot = node.getAttribute && node.getAttribute("data-slot");
      if (slot) {
        out += `{{${slot}}}`;
        return;
      }
      [...node.childNodes].forEach(walk);
    };
    [...el.childNodes].forEach(walk);
    return out.split("\u200B").join("");
  };
  /** The blanks standing in a box, in the order they are written. */
  const pillsIn = (/** @type {any} */ el) =>
    el ? [...el.querySelectorAll("[data-slot]")].map((n) => n.getAttribute("data-slot")) : [];
  /** The React-controlled value setter, the way a keystroke sets one. */
  const typeInto = (/** @type {any} */ el, /** @type {string} */ value) => {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute("contenteditable") === "true") {
      el.textContent = value;
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
      return true;
    }
    const proto = el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    const setter = must(Object.getOwnPropertyDescriptor(proto, "value"), "the value descriptor").set;
    must(setter, "the value setter").call(el, value);
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
    return true;
  };
  const saveBtn = () => /** @type {any} */ (buttonNamed(/^Save$|^Saving…$/) || null);

  /* ---- the card's ID ----

     The other way a blank is filled. A group tag is a set of words a
     sentence will take any of; a card's own ID is the name that reaches
     that one word — "{{colour-red}} is heavy". Offered on every new card,
     checked against everything else that answers to a name while the
     teacher is still looking at it, and shut with a tick once it is free.

     Offered, not demanded. Until 0.182 a new card could not be saved
     without one, so the commonest job on this screen — write a word, save
     it — waited on a decision about a card that did not exist yet, behind
     a Save that stayed grey with nothing saying why. Most cards are never
     pointed at by name. */
  {
    const idBox = () => /** @type {any} */ (
      [...document.querySelectorAll("input")].find((i) => i.getAttribute("aria-label") === "The card's ID") || null);
    const withLabel = (/** @type {string} */ label) => /** @type {any} */ (
      [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label) || null);
    const idName = () => (((document.querySelector(".at-idname") || {}).textContent) || "").trim();

    check("a new card is offered an ID", !!idBox(),
      idBox() ? "offered" : "no such field");
    check("and says it is optional",
      /Optional\./.test(((document.querySelector(".at-part") && document.body.textContent) || "")) &&
        /needs to point at this card by name/.test(document.body.textContent || ""),
      ([...document.querySelectorAll(".at-hint")].map((h) => (h.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /^Optional\./.test(t))) || "(nothing said)");

    /* A card is its words, and with those written it can be saved —
       nameless, which is what nearly every card is. */
    typeInto(fieldNamed(/^Arabic script and transliteration$/i), "شمس");
    await sleep(80);
    typeInto(fieldNamed(/^English$/), "sun");
    await sleep(200);
    check("and a card with its words is saved without one",
      !!saveBtn() && !saveBtn().disabled && !idBox().value,
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"} with the ID box empty`);

    /* Narrowed as it is typed to what can go between braces, so a teacher
       typing "Name Is!" is not handed "nameis" by a save they have already
       forgotten about. */
    typeInto(idBox(), "Name Is!");
    await sleep(200);
    check("what is typed is narrowed to what a blank can be called",
      /Kept as/.test((document.body.textContent || "")) &&
        /nameis/.test((document.body.textContent || "")),
      ([...document.querySelectorAll(".at-hint")].map((h) => (h.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /^Kept as/.test(t))) || "(nothing said)");

    /* A name a group tag already answers to is taken: both go between
       braces, so they are one namespace or they are two cards answering to
       one name. Nothing is said about a name that is free — the rim is the
       whole of "yes". */
    typeInto(idBox(), "name");
    await sleep(200);
    check("a name something else answers to is refused, and says so",
      /already/.test((document.body.textContent || "")) && !!withLabel("Lock this ID") &&
        withLabel("Lock this ID").disabled,
      ([...document.querySelectorAll(".at-formneed.unmet")].map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /already/.test(t))) || "(nothing said)");

    /* And a kind of word is taken too, since 0.189: a card called `noun`
       would be one more thing answering to `{{noun}}`, beside every noun
       in the language — which is the one thing an ID is for preventing. */
    typeInto(idBox(), "verb");
    await sleep(200);
    check("a kind of word is taken as surely as another card's name is",
      !!withLabel("Lock this ID") && withLabel("Lock this ID").disabled &&
        /that is a kind of word/.test(document.body.textContent || ""),
      ([...document.querySelectorAll(".at-formneed.unmet")].map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /kind of word/.test(t))) || "(nothing said)");

    typeInto(idBox(), "name-is");
    await sleep(200);
    check("and a free one lights the tick, with nothing else said",
      !!withLabel("Lock this ID") && !withLabel("Lock this ID").disabled,
      withLabel("Lock this ID") ? "offered" : "no tick");

    /* The tick shuts the box, which is the state a saved card opens in —
       an ID is written once and read a hundred times, and a box you can
       type in is a box you can type in by accident. */
    click(withLabel("Lock this ID"));
    await sleep(250);
    check("the tick shuts the box and the ID is read rather than typed",
      !idBox() && idName() === "name-is",
      idName() || "(still a field)");
    check("and the pencil opens it again", !!withLabel("Edit this ID"),
      withLabel("Edit this ID") ? "there" : "no way back in");
    click(withLabel("Edit this ID"));
    await sleep(250);
    check("which puts the name back in the box, as it was",
      !!idBox() && idBox().value === "name-is",
      idBox() ? idBox().value : "(no field)");
    click(withLabel("Lock this ID"));
    await sleep(250);
  }

  typeInto(fieldNamed(/^Arabic script and transliteration$/i), "ismi");
  await sleep(80);
  typeInto(fieldNamed(/^English$/), "My name is {{name}}");
  await sleep(200);

  /* ---- only a sentence may have a blank ----

     The card on screen is a word, and it has just had braces typed into
     it. Until 0.176 the app answered that for the teacher by quietly
     calling the card a sentence — which on a word with a table under it
     hid the table and offered to drop every box in it on the next save.
     It is refused now, and both ways out are named, because the two
     things it can mean are opposite and only the teacher knows which. */
  check("a blank typed into a word is refused rather than quietly allowed",
    !!saveBtn() && saveBtn().disabled &&
      /only a sentence can have one/.test(document.body.textContent || ""),
    ([...document.querySelectorAll(".at-formneed.unmet")].map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
      .find((t) => /only a sentence/.test(t))) || "(nothing said)");
  /* One way out, since 0.187: the kind was answered before this screen
     opened, so there is nothing here to call a sentence. */
  check("and the way out is named: take the braces out, or start a sentence",
    /Take the braces out of its words/.test(document.body.textContent || "") &&
      /start a new card and pick Sentence/.test(document.body.textContent || ""),
    ([...document.querySelectorAll(".at-hint")].map((h) => (h.textContent || "").replace(/\s+/g, " ").trim())
      .find((t) => /Take the braces out/.test(t))) || "(nothing said)");

  /* So a sentence is made as one, from the beginning — which is the whole
     of what changed in 0.187. */
  await leaveScreen();
  await newCard();
  await pickCardKind(/^Sentence/);
  check("a sentence is made by saying so before the editor, not by typing braces",
    screenTitle() === "New sentence" &&
      !/only a sentence can have one/.test(document.body.textContent || ""),
    screenTitle() || "(no editor)");
  typeInto(fieldNamed(/^Arabic script and transliteration$/i), "ismi");
  await sleep(80);
  typeInto(fieldNamed(/^English$/), "My name is {{name}}");
  await sleep(300);
  check("a card with a hole in one field only cannot be saved",
    !!saveBtn() && saveBtn().disabled,
    `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}`);
  check("and the editor says which field is short of it",
    /is missing\s+name\b/.test(document.body.textContent || ""),
    ([...document.querySelectorAll(".at-formneed.unmet")].map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())[0]) || "(nothing said)");
  typeInto(fieldNamed(/^Arabic script and transliteration$/i), "ismi {{name}}");
  await sleep(200);
  check("and it can be saved once every field leaves the same hole",
    !!saveBtn() && !saveBtn().disabled,
    `save is ${saveBtn() && saveBtn().disabled ? "still refused" : "offered"}`);

  /* ---- which way a field with blanks in it reads ----

     A blank is drawn as a pill and a blank's name is Latin, so a field
     that asked the browser to lay itself out by its own first strong
     character — dir="auto" — was answered about the pill. An Arabic
     sentence beginning with a blank came out running left to right, and
     so did a field holding nothing but blanks, which every field of a
     frame is while it is being written. The words decide now, and where
     there are none the language does. */
  {
    const script = () => fieldNamed(/^Arabic script and transliteration$/i);
    const dirOfScript = () => (script() ? script().getAttribute("dir") : "(no field)");
    typeInto(script(), "{{name}}");
    await sleep(200);
    check("a field holding nothing but blanks reads the way the language does",
      dirOfScript() === "rtl", `dir=${dirOfScript()}`);
    typeInto(script(), "{{name}} اسمي");
    await sleep(200);
    check("and so does an Arabic sentence that begins with one",
      dirOfScript() === "rtl", `dir=${dirOfScript()}`);
    /* And what the teacher wrote still decides, which is what laying a
       field out by its own text was for: a phrase in another script does
       not take the deck's direction. */
    typeInto(script(), "ismi {{name}}");
    await sleep(200);
    check("while the words themselves still decide where there are any",
      dirOfScript() === "ltr", `dir=${dirOfScript()}`);
  }

  /* ---- blanks ----

     The section was called Variables and did two opposite jobs at once,
     under ninety words explaining a syntax the teacher typed by hand into
     three fields that had to agree. What is checked here is the part that
     makes the rest possible: the braces are written by a button, into
     every field at once, so the fields cannot disagree. */
  {
    const blanks = () => [...document.querySelectorAll(".at-formblock")]
      .find((b) => /^Blanks$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
    /* Which half of the section a thing is in. The block is named
       subsections doing opposite jobs and each has a box and a list, so a
       selector over the whole block would answer about whichever came
       first — and "the list under this heading" is the actual claim.
       Each subsection is a panel of its own since 0.179, so the claim is
       "inside the panel this heading names". */
    const half = (/** @type {RegExp} */ re) => {
      const block = blanks();
      if (!block) return [];
      const part = [...block.querySelectorAll(".at-part")].find((p) => {
        const line = p.querySelector(".at-groupline");
        return !!line && re.test((line.textContent || "").trim());
      });
      return part ? [...part.children].filter((k) => !k.classList.contains("at-groupline")) : [];
    };
    const inHalf = (/** @type {RegExp} */ re, /** @type {string} */ sel) =>
      half(re).flatMap((n) => [
        ...(n.matches(sel) ? [n] : []),
        ...n.querySelectorAll(sel),
      ]);
    const HOLES = /^Blanks in this card$/;
    /* The heading of the folded half carries the count of what is behind
       it — "Examples of this card with filled blanks · 2 examples" — so it
       is matched from the front rather than whole. */
    const SHOWN = /^Examples of this card with filled blanks/;
    const CARDID = /^The card’s ID$/;
    const FILLS = /^The card’s group tags$/;

    check("the section is called Blanks, not Variables", !!blanks(),
      [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));
    /* The sentences a student will be asked, filled from the cards that
       exist — the explanation that replaced the paragraphs. Each is three
       lines and not one: the sentence in the script, how it is said, and
       what it means. So the transliteration is written here too, because
       an example is only all three where the card has all three.

       They are a named subsection of their own since 0.174: they are not a
       fact about the holes but the card itself, as a student meets it, and
       a list worth reading down is worth a heading saying what it is. It
       is folded away until it is asked for, because the list is now every
       filling the card has rather than the first few of them. */
    typeInto(saidFields()[0], "ismi {{name}}");
    await sleep(200);
    const examples = () => inHalf(SHOWN, ".at-askedline")
      .map((line) => ({
        ar: (((line.querySelector(".at-askedscript") || {}).textContent) || "").trim(),
        lat: (((line.querySelector(".at-askedsaid") || {}).textContent) || "").trim(),
        en: (((line.querySelector(".at-askedmeans") || {}).textContent) || "").trim(),
      }));
    const asked = () => examples().map((e) => [e.ar, e.lat, e.en].join(" · "));
    const fold = () => /** @type {any} */ (
      [...((blanks() || document).querySelectorAll(".at-groupfold"))]
        .find((b) => SHOWN.test(((b.querySelector("span") || {}).textContent) || "")) || null);
    check("the filled examples are a named subsection, not a preface to the holes",
      !!fold() && !inHalf(HOLES, ".at-askedline").length,
      [...((blanks() || document).querySelectorAll(".at-groupline"))]
        .map((g) => (g.textContent || "").replace(/\s+/g, " ").trim()).join(" | ") || "(no headings)");
    /* Folded to start with, and the heading is the thing that opens it:
       every filling of a frame the whole vocabulary fills is a list nobody
       asked to scroll past to reach the rest of the card. */
    check("and it is folded away until it is asked for",
      !!fold() && fold().getAttribute("aria-expanded") === "false" && !examples().length,
      fold() ? `${fold().getAttribute("aria-expanded")} · ${examples().length} lines` : "(no heading)");
    check("with the heading saying how many are in there, so it need not be opened to be answered",
      !!fold() && /2 examples/.test((fold().textContent || "").replace(/\s+/g, " ")),
      fold() ? (fold().textContent || "").replace(/\s+/g, " ").trim() : "(no heading)");
    click(fold());
    await sleep(200);
    check("and pressing it opens the list",
      !!fold() && fold().getAttribute("aria-expanded") === "true" && examples().length > 0,
      `${examples().length} shown`);
    check("and shows the sentences a student will actually be asked",
      asked().length > 0 && asked().every((line) => !/\{\{/.test(line)),
      asked().join(" / ") || "(none shown)");
    check("each one a different word, so one card does not print the same sentence twice",
      new Set(asked()).size === asked().length, asked().join(" / "));
    /* All of them, not the first few: the question a teacher has — is the
       right vocabulary behind this blank — is asked of the whole list. */
    check("as many examples as the card has fillings, not a handful of them",
      asked().length === 2, `${asked().length} shown`);
    check("and the section says the same number as what the card is met as",
      /\b2 sentences\b/.test((((blanks() || document).querySelector(".at-formrole") || {}).textContent) || ""),
      ((((blanks() || document).querySelector(".at-formrole") || {}).textContent) || "").trim() || "(nothing said)");
    /* The English alone is the one line of the question a learner is never
       asked to produce, so a preview of an Arabic frame that showed it
       alone was a preview of everything except the Arabic. */
    check("each one in the script, in how it is said, and in what it means",
      examples().length > 0 && examples().every((e) =>
        /\u0631\u0627\u0641|\u0641\u064a\u0643/.test(e.ar) && /^ismi /.test(e.lat) && /^My name is /.test(e.en)),
      asked().join(" / ") || "(none shown)");
    /* And back out, so the walk below goes on from the card it had. */
    typeInto(saidFields()[0], "");
    await sleep(200);
    check("the blank is named as a fact about the card",
      [...(blanks() || document).querySelectorAll(".at-blankchip")]
        .map((c) => (c.textContent || "").trim()).includes("name"),
      [...(blanks() || document).querySelectorAll(".at-blankchip")].map((c) => c.textContent).join(", ") || "(none)");

    /* ---- and pointing at one says what will be put in it ----

       The chip said the blank's name and stopped there, which is the least
       of what a teacher wants to know about it: the three sentences above
       show three of its words standing in the frame, and every other word
       behind it was a question only answerable by leaving the card. */
    {
      const chip = () => /** @type {any} */ (
        [...(blanks() || document).querySelectorAll(".at-blankchip")]
          .find((c) => (c.textContent || "").trim() === "name") || null);
      const panel = () => (blanks() || document).querySelector(".at-blankfills");
      check("a blank is something to point at, not a label",
        !!chip() && chip().tagName === "BUTTON",
        chip() ? chip().tagName.toLowerCase() : "(no chip)");
      check("and says nothing until it is pointed at", !panel(),
        panel() ? "already open" : "closed");
      chip().dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true }));
      await sleep(200);
      const words = () => [...((panel() || document).querySelectorAll(".at-filllist li"))]
        .map((li) => ({
          ar: (((li.querySelector("b") || {}).textContent) || "").trim(),
          lat: (((li.querySelector("em") || {}).textContent) || "").trim(),
          en: (((li.querySelector("i") || {}).textContent) || "").trim(),
        }));
      check("hovering it lists the words that will fill it", !!panel() && words().length > 0,
        words().map((v) => v.en).join(", ") || "(nothing shown)");
      check("each in the script, in how it is said, and in what it means",
        words().length > 0 && words().every((v) => v.ar && v.lat && v.en),
        words().map((v) => `${v.ar} ${v.lat} ${v.en}`).join(" | ") || "(nothing shown)");
      check("which is every card that says it fills the blank, not only the three above",
        words().some((v) => /^Raphael$/.test(v.en)) && words().some((v) => /^Victor$/.test(v.en)),
        words().map((v) => v.en).join(", ") || "(nothing shown)");
      check("and how many fill it, which is whether the blank has the right words behind it",
        /\b2 words fill it\b/.test(((panel() || {}).textContent) || ""),
        (((panel() || document).querySelector(".at-eyebrow") || {}).textContent || "").trim() || "(nothing said)");
      chip().dispatchEvent(new w.MouseEvent("mouseout", { bubbles: true }));
      await sleep(200);
      check("and it goes away again on the way out", !panel(),
        panel() ? "still open" : "closed");
    }

    /* ---- and what the card leaves is read off the card ----

       This half went through a menu and then a tick list before it was a
       readout, and the tick list was the instructive mistake: it was every
       blank in the language with the card's two ticked, so a tick sat
       beside {{verb}} on a card with no verb in it, under a heading saying
       these are the blanks in this card. What a card leaves is in its own
       words — the braces are in the text — so there is nothing to decide
       and nothing to tick. It says what is there. */
    const ar = () => /** @type {any} */ (fieldNamed(/^Arabic script and transliteration$/i));
    const en = () => /** @type {any} */ (fieldNamed(/^English$/));
    const chips = () => inHalf(HOLES, ".at-blankchip")
      .map((c) => (c.textContent || "").trim());
    check("this half decides nothing: no list of blanks, and nothing to tick",
      !inHalf(HOLES, ".at-ticklist").length && !inHalf(HOLES, "input[type=checkbox]").length,
      `${inHalf(HOLES, ".at-tickrow").length} ticks, ${inHalf(HOLES, ".at-choosebtn").length} menus`);

    /* Taken out of the card's words, it is gone from here — and the half
       says what to write instead of listing what could be written. */
    typeInto(ar(), "ismi");
    await sleep(80);
    typeInto(en(), "My name is");
    await sleep(250);
    check("a card with no blank in its words shows none",
      chips().length === 0,
      chips().join(", ") || "(none)");
    check("and says where one is put in, which is beside the words themselves",
      /Blank/.test(((half(HOLES).map((n) => n.textContent || "").join(" ")) || "")),
      (half(HOLES).map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /None yet/.test(t))) || "(nothing said)");

    /* ---- a blank is put in, not typed ----

       Writing one meant typing the braces, the name and the spelling, and
       then the same name again in each of the other fields, with nothing
       on screen to say whether it matched what the other cards call it. A
       name half a letter out matched nothing for ever and looked exactly
       like one that matched: the last silent failure on this screen.

       So each field a sentence has carries a bar — the blanks the card
       already knows, and a button for one it does not — and the card is
       on "ismi" / "My name is" with no blanks at all, which is where a
       sentence is actually written from. */
    {
      const addIn = (/** @type {RegExp} */ re) => /** @type {any} */ (
        [...document.querySelectorAll(".at-blankadd")]
          .find((b) => re.test(b.getAttribute("aria-label") || "")) || null);
      const chip = (/** @type {RegExp} */ re) => /** @type {any} */ (
        [...document.querySelectorAll(".at-blankput")]
          .find((b) => re.test(b.getAttribute("aria-label") || "")) || null);
      const sheet = () => document.querySelector(".at-sheet");
      const rows = () => [...((sheet() || document).querySelectorAll(".at-blanklist button"))]
        .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim());
      const rowFor = (/** @type {RegExp} */ re) => /** @type {any} */ (
        [...((sheet() || document).querySelectorAll(".at-blanklist button"))]
          .find((b) => re.test((((b.querySelector("b") || {}).textContent) || "").trim())) || null);

      check("every field a sentence has offers to put a blank into it",
        !!addIn(/into Arabic script$/) && !!addIn(/into Transliteration$/) && !!addIn(/into English$/),
        [...document.querySelectorAll(".at-blankadd")]
          .map((b) => b.getAttribute("aria-label")).join(" | ") || "(no buttons)");

      click(addIn(/into English$/));
      await sleep(300);
      check("the button opens a sheet of the blanks this language has",
        !!sheet() && rows().length > 0, rows().slice(0, 3).join(" / ") || "(nothing offered)");
      /* The one thing a teacher cannot tell from a name: whether the hole
         they are about to write has anything to fill it. */
      check("each saying what would stand in it, and how many words do today",
        !!rowFor(/^name$/) &&
          /2 words behind it/.test((rowFor(/^name$/).textContent || "").replace(/\s+/g, " ")),
        rowFor(/^name$/)
          ? (rowFor(/^name$/).textContent || "").replace(/\s+/g, " ").trim()
          : "(no row for name)");
      /* Four kinds of name reach a card and the sheet says which is which,
         because they are four different questions: anything at all, a kind
         of word, a group somebody made, and one card by the ID it answers
         to. Two of the four are in this collection today. */
      check("and which kind of name it is, because the four are not the same question",
        /Any word/.test((rowFor(/^word$/) || {}).textContent || "") &&
          /Kind of word/.test((rowFor(/^noun$/) || {}).textContent || ""),
        rows().join(" / ") || "(nothing offered)");
      /* And it is named the way it is named everywhere else on the
         screen. The braces are how a card is stored; nothing asks a
         teacher to read them. */
      check("and names it as the blank it is, not as the braces it is stored as",
        !/[{}]/.test(rows().join(" ")), rows().slice(0, 3).join(" / "));

      click(rowFor(/^name$/));
      await sleep(300);
      const enNow = () => /** @type {any} */ (fieldNamed(/^English$/));
      check("choosing one puts it into the field it was asked from",
        readField(enNow()) === "My name is {{name}}",
        readField(enNow()) || "(no field)");
      check("and the sheet closes behind it", !sheet(), sheet() ? "still open" : "closed");

      /* ---- and it is in the words, not beside them ----

         The bar used to carry a chip for every blank the card knew,
         marked as in this field or not, which was two pictures of one
         thing the moment the field itself could draw a blank where it
         stands. The field has it; the bar is what the field cannot say. */
      check("the blank is a pill inside the field itself",
        JSON.stringify(pillsIn(enNow())) === JSON.stringify(["name"]),
        JSON.stringify(pillsIn(enNow())));
      check("and the field that has it is not offered it again on the bar",
        !chip(/into English$/),
        (chip(/into English$/) || {}).getAttribute?.("aria-label") || "not offered");

      /* The other half of the bargain, and the thing that used to be typed
         twice: a blank belongs to the card, so the moment one field has it
         the others offer it — which is the rule the save has always
         enforced and never once helped anybody keep. */
      check("the other fields then offer the same blank, rather than waiting to be typed",
        !!chip(/^Put the name blank into Arabic script$/) &&
          !!chip(/^Put the name blank into Transliteration$/),
        [...document.querySelectorAll(".at-blankput")]
          .map((b) => b.getAttribute("aria-label")).join(" | ") || "(no chips)");

      click(chip(/^Put the name blank into Arabic script$/));
      await sleep(300);
      const arNow = () => /** @type {any} */ (fieldNamed(/^Arabic script and transliteration$/i));
      check("and one tap puts it there too",
        readField(arNow()) === "ismi {{name}}", readField(arNow()) || "(no field)");
      check("with a space around it, because a blank is a word and is spaced like one",
        !/\S\{\{/.test(readField(arNow())) && !/\}\}\S/.test(readField(arNow())),
        readField(arNow()) || "(no field)");

      /* ---- and the cross on it takes it off ----

         The blank is in the sentence, so what takes it out is on the
         blank: one cross, and it goes from the form's three fields
         together — a blank taken out of the English alone is the
         disagreement the bar exists to keep a teacher out of. */
      click(enNow().querySelector("[data-off]"));
      await sleep(300);
      check("the cross on a blank takes it out of every field of the form",
        readField(enNow()) === "My name is" && readField(arNow()) === "ismi",
        `English "${readField(enNow())}", script "${readField(arNow())}"`);
      check("and the card is left whole rather than half a blank short",
        !!saveBtn() && !saveBtn().disabled && !pillsIn(enNow()).length && !pillsIn(arNow()).length,
        `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}, ` +
          `${pillsIn(enNow()).length + pillsIn(arNow()).length} pills left`);
    }

    /* And written back into the words, it is read off them again. Into
       every field, because a card whose English has a hole and whose
       script has not cannot be saved — which this half is where you find
       out about. */
    typeInto(ar(), "ismi {{name}}");
    await sleep(80);
    typeInto(en(), "My name is {{name}}");
    await sleep(300);
    check("and a blank written into the words is read off them",
      JSON.stringify(chips()) === JSON.stringify(["name"]),
      chips().join(", ") || "(none)");
    check("so the fields agree, and the card saves",
      !!saveBtn() && !saveBtn().disabled && !/is missing \{\{/.test(document.body.textContent || ""),
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}`);

    /* ---- and a sentence is a kind of card in its own right ----

       A card made of blanks is what the blanks are for, and until 0.139
       there was no way to say you were writing one: the teacher typed
       braces into a word card and hoped. Saying so puts the card's own
       editor up — the sentence, its blanks, and nothing about parts of
       speech or tables, because a sentence is not a word. */
    const blockNames = () =>
      [...document.querySelectorAll(".at-formnum")].map((n) => (n.textContent || "").trim());

    check("the editor is the sentence's own, named after what is in it",
      blockNames().includes("The sentence"), blockNames().join(" | "));
    /* And asks what to call it, exactly as a verb is asked. A sentence is
       saved as a frame with a hole in it, so a list of sentences reads as
       a list of holes unless the teacher says what each one is for. */
    const sentenceName = cardNameField();
    check("a sentence can be given a name to be listed under, as a verb can",
      !!sentenceName, thisCardAsks().join(" | "));
    /* In "This card" with the other facts about the card, and not in a
       framed section of its own between the card and its words. */
    check("and it is asked in This card, above the sentence itself",
      !!sentenceName && thisCardAsks().includes("Name") &&
        !blockNames().includes("What to call it"),
      `${thisCardAsks().join(" | ")} · ${blockNames().join(" | ")}`);
    check("and says what a blank one falls back to, and that nothing is asked about it",
      !!sentenceName && /listed and searched/.test(sentenceName.textContent || "") &&
        /blanks and all/.test(sentenceName.textContent || "") &&
        /Nobody is ever asked this/.test(sentenceName.textContent || ""),
      sentenceName ? (sentenceName.textContent || "").replace(/\s+/g, " ").slice(0, 160) : "(no field)");
    /* The control itself, not the list behind it: the list is on screen
       only while it is open, so a card that is still asked and shut would
       pass a check that only looked for the rows. */
    check("and stops asking what kind of word it is, because it is not one",
      !wordKindBtn() && !wordKindPencil() &&
        ![...document.querySelectorAll(".at-label")]
          .some((l) => /^What subtype$/.test((l.textContent || "").trim())),
      wordKindBtn() || wordKindPencil() ? "still asked" : "not asked");
    check("and offers no second form, because another way of saying it is another sentence",
      ![...document.querySelectorAll("button")]
        .some((b) => /^Add another form$/.test((b.textContent || "").trim())),
      [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim())
        .filter((t) => /another form/i.test(t)).join(" | ") || "no such button");

    /* A blank named after a kind of word — "{{noun}} {{adjective}}" is all
       a teacher has to write and every noun they have made joins in — and
       the section reads it off the words like any other. */
    typeInto(ar(), "ismi {{name}} {{noun}}");
    await sleep(80);
    typeInto(en(), "My name is {{name}} {{noun}}");
    await sleep(300);
    check("a blank named after a kind of word is read off the words too",
      JSON.stringify(chips()) === JSON.stringify(["name", "noun"]),
      chips().join(", ") || "(none)");
    check("and the sentence saves, because every field leaves the same two",
      !!saveBtn() && !saveBtn().disabled && !/is missing \{\{/.test(document.body.textContent || ""),
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}`);
    /* And it is filled by the words that say they are nouns, with nothing
       written on any of them to say so — which is the whole bargain: a
       teacher writes the sentence, and the vocabulary joins in. Asked for
       again, because calling the card a sentence built the editor afresh
       and the examples fold away on every card until somebody opens them. */
    if (fold() && fold().getAttribute("aria-expanded") === "false") {
      click(fold());
      await sleep(200);
    }
    const nounLines = () => [...((blanks() || document).querySelectorAll(".at-askedline .at-askedmeans"))]
      .map((n) => (n.textContent || "").trim());
    check("and a blank named after a kind of word is filled by the words of that kind",
      nounLines().length > 0 && nounLines().every((line) => /teacher/.test(line)),
      nounLines().join(" / ") || "(none shown)");

    /* ---- which tenses a blank asks its verbs for ----

       A verb card is right to carry every tense, and the sentence is what
       says when the thing happened: "yesterday {{name}} {{verb}}" is met
       as the present, the past and the command one after another, and two
       of those say something nobody means. So the one thing in this
       subsection that is not a readout is here — under the blanks, because
       it is a fact about a blank rather than about the words behind it.

       Only where there is something to ask. {{name}} and {{noun}} above
       are filled by words with no tenses, and neither was offered a row of
       ticks; a language whose verbs take one form would be offered none
       either. */
    {
      const tenseRows = () => inHalf(HOLES, ".at-ticklist .at-tickrow");
      const tenseNames = () => tenseRows()
        .map((r) => (((r.querySelector("b") || {}).textContent) || "").trim());
      const tenseRow = (/** @type {RegExp} */ re) => /** @type {any} */ (
        tenseRows().find((r) => re.test((((r.querySelector("b") || {}).textContent) || "").trim())) || null);
      const tenseSaid = () => inHalf(HOLES, ".at-field .at-label, .at-field .at-hint")
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim()).join(" · ");

      check("a blank with no verbs behind it is asked nothing about tenses",
        !tenseRows().length, tenseNames().join(", ") || "(nothing asked)");

      typeInto(ar(), "mbaari7 {{name}} {{verb}}");
      await sleep(80);
      typeInto(en(), "yesterday {{name}} {{verb}}");
      await sleep(320);
      check("a blank that verbs fill is asked which tenses it wants them in",
        JSON.stringify(tenseNames()) === JSON.stringify(["present", "past", "command"]),
        tenseNames().join(", ") || "(nothing asked)");
      check("and says which blank it is about, and that nothing ticked is any tense",
        /verb/.test(tenseSaid()) && /Any tense/.test(tenseSaid()),
        tenseSaid() || "(nothing said)");

      /* Every form of every verb, until the teacher says otherwise — which
         is what every sentence written before this was met as. */
      if (fold() && fold().getAttribute("aria-expanded") === "false") {
        click(fold());
        await sleep(200);
      }
      const verbLines = () => [...((blanks() || document).querySelectorAll(".at-askedline .at-askedmeans"))]
        .map((n) => (n.textContent || "").trim());
      check("and until it does, the sentence is met in every one of them",
        verbLines().some((l) => /he ate/.test(l)) && verbLines().some((l) => /he eats/.test(l)),
        verbLines().join(" / ").slice(0, 160) || "(none shown)");

      click(/** @type {any} */ (tenseRow(/^past$/)).querySelector("input"));
      await sleep(320);
      check("ticking one takes the sentence down to the verbs of that tense",
        verbLines().length > 0 && verbLines().every((l) => /ate/.test(l)),
        verbLines().join(" / ").slice(0, 160) || "(none shown)");
      check("and the dictionary form goes with them, being in no tense at all",
        !verbLines().some((l) => /to eat/.test(l)),
        verbLines().join(" / ").slice(0, 160) || "(none shown)");
      /* The word in the other hole is not a verb, so nothing here touches
         it: a name is in no tense, and dropping it would answer a question
         nobody asked. */
      check("while the words in the blank beside it stand where they always did",
        verbLines().some((l) => /Raphael/.test(l)) && verbLines().some((l) => /Victor/.test(l)),
        verbLines().join(" / ").slice(0, 160) || "(none shown)");
      check("and the section says what it has been narrowed to",
        /past/.test(tenseSaid()) && !/Any tense/.test(tenseSaid()),
        tenseSaid() || "(nothing said)");

      /* And unticking the last one is how it is taken off again, which is
         why there is no third state to explain. */
      click(/** @type {any} */ (tenseRow(/^past$/)).querySelector("input"));
      await sleep(320);
      check("unticking the last one gives the sentence every tense back",
        verbLines().some((l) => /he eats/.test(l)) && /Any tense/.test(tenseSaid()),
        tenseSaid() || "(nothing said)");

      /* Left as the teacher found it, so what follows is about the same
         sentence the checks above were written against. */
      typeInto(ar(), "ismi {{name}} {{noun}}");
      await sleep(80);
      typeInto(en(), "My name is {{name}} {{noun}}");
      await sleep(320);
    }

    /* And back, because a word and a sentence are the same card written
       two ways. What was typed is still there — and, since 0.176, saying
       it is a word again is saying its blanks should not be there, which
       is refused rather than acted on: the braces are the teacher's words
       and nothing here is going to delete them for them. */

    /* ---- the section's other half: this card filling somebody else's ----

       Two jobs in one block, and until 0.159 the second appeared and
       disappeared with nothing naming it, so a teacher looking for where a
       word is offered to other cards found either an unlabelled button or
       nothing at all. They are two named subsections now, both always on
       screen, and the second is a list — of blank ids, on the screen, with
       the box that names a new one above it — because a word stands in
       more than one kind of hole as soon as somebody writes a second frame
       about it. */
    {
      const groups = () => [...((blanks() || document).querySelectorAll(".at-groupline"))]
        .map((g) => (g.textContent || "").trim());
      /* Three named parts rather than one block doing three jobs: what
         this card leaves open, the name it answers to, and the groups it
         is in. The last two are both about being borrowed, which is why
         they are neighbours under one heading rather than a field at the
         top of the screen and a list at the bottom. */
      check("the section is named parts, not one block doing several jobs",
        groups().includes("Blanks in this card") &&
          groups().includes("The card’s ID") &&
          groups().includes("The card’s group tags"),
        groups().join(" | ") || "(no headings)");
      /* And the ID is one of them rather than a field at the top of the
         screen: what it is for is filling somebody else's blank, so it is
         read beside the groups that do the same job. */
      const idHalf = () => inHalf(CARDID, ".at-hint, .at-idrow, .at-shutrow")
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim()).join(" · ");
      check("the ID is one of them, with the line saying what it is for",
        /reaching this one card from another card/.test(idHalf()) &&
          !!inHalf(CARDID, 'input[aria-label="The card\'s ID"]').length,
        idHalf() || "(nothing there)");
      /* A card with a blank of its own fills none — a sentence dropped
         into somebody else's hole is a sentence with a gap where the point
         was — so the half that offers it says why rather than offering a
         control there is no answer to. */
      const newBox = () => /** @type {any} */ (inHalf(FILLS, ".at-blanknew")[0] || null);
      check("and a card that leaves a blank is told why it fills none",
        /fills none/.test(((blanks() || {}).textContent) || "") && !newBox(),
        newBox() ? "offered anyway" : "said, and not offered");

      /* The card that fills somebody else's blank has to be a word to be
         offered the question at all: a sentence dropped into a hole is a
         sentence with a gap where the point was. */
      check("a sentence is offered no group to join, because it fills none",
        !inHalf(FILLS, ".at-ticklist .at-tickrow").length,
        `${inHalf(FILLS, ".at-ticklist .at-tickrow").length} groups offered`);

      /* And the other half comes alive on a word — which is a different
         card, not this one called something else: a sentence goes on being
         one, and since 0.187 there is nowhere to say otherwise. */
      await leaveScreen();
      await newCard();
      await pickCardKind(/^Word or phrase/);
      typeInto(fieldNamed(/^Arabic script and transliteration$/i), "rafa");
      await sleep(80);
      typeInto(fieldNamed(/^English$/), "Raphael");
      await sleep(300);

      /* The blanks it may fill, as a list on the screen. It was a menu
         that had to be opened — and a list you have to open to see is a
         list you answer without reading. */
      const fillList = () => inHalf(FILLS, ".at-ticklist .at-tickrow");
      const fillNames = () => fillList()
        .map((r) => (((r.querySelector("b") || {}).textContent) || "").trim());
      const fillRow = (/** @type {RegExp} */ re) => /** @type {any} */ (
        fillList().find((r) => re.test((((r.querySelector("b") || {}).textContent) || "").trim())) || null);
      const ticked = () => fillList()
        .filter((r) => /** @type {any} */ (r.querySelector("input")).checked)
        .map((r) => (((r.querySelector("b") || {}).textContent) || "").trim());
      check("the groups it can join are a list on the screen, not a menu to open",
        fillList().length > 0 && !inHalf(FILLS, ".at-choosebtn").length,
        fillNames().join(", ") || "(no list)");
      /* The ticked list is the tags somebody wrote. A card fills {{noun}}
         by saying it is a noun, so a tick for it would do nothing — while
         {{name}}, which this language also declares as a kind of word, is
         the oldest blank in the app and has to stay. Written, not built
         in. */
      check("and they are the group tags somebody wrote, not the kinds of card",
        fillNames().includes("name") &&
          !["word", "noun", "verb", "adjective", "pronoun", "preposition"]
            .some((kind) => fillNames().includes(kind)),
        fillNames().join(", ") || "(no list)");
      check("with what each is worth, which is whether to tick it",
        fillList().every((r) => /\d/.test(((r.querySelector("i") || {}).textContent) || "")),
        fillList().map((r) => (((r.querySelector("i") || {}).textContent) || "").trim()).join(" | "));

      /* ---- and above them, the tags the card wears anyway ----

         A card fills its kind of word and {{word}} with nothing ticked, so
         leaving those out left a teacher reading a list of the blanks
         their card fills that did not have the commonest two in it. They
         are shown since 0.189 — grouped, flat rather than ticked, because
         the answer to them is the kind of word further up the screen. */
      {
        const fixed = () => inHalf(FILLS, ".at-tagfixed");
        const fixedNames = () => fixed()
          .map((r) => (((r.querySelector("b") || {}).textContent) || "").trim());
        const runs = () => inHalf(FILLS, ".at-eyebrow")
          .map((n) => (n.textContent || "").trim());
        check("the default tags are listed too, in a run of their own",
          runs()[0] === "Default tags" && runs().includes("Your own tags"),
          runs().join(" | ") || "(no runs)");
        check("and they are the kinds of word, plus the one every word fills",
          ["noun", "verb", "adjective", "name", "word"]
            .every((n) => fixedNames().includes(n)),
          fixedNames().join(", ") || "(none listed)");
        check("each saying what it takes and how many words are behind it",
          fixed().length > 0 && fixed().every((r) =>
            /^Any /.test(((r.querySelector("i") || {}).textContent) || "")),
          fixed().map((r) => (((r.querySelector("i") || {}).textContent) || "").trim()).join(" | "));
        /* The card on screen is a word nobody has said the kind of, so
           {{word}} is marked and no kind of word is. */
        const marked = () => fixed()
          .filter((r) => !((r.className || "").includes("off")) && (r.className || "").includes("on"))
          .map((r) => (((r.querySelector("b") || {}).textContent) || "").trim());
        check("and the ones this card actually fills are marked",
          JSON.stringify(marked()) === JSON.stringify(["word"]),
          marked().join(", ") || "(none marked)");
        /* And none of them can be typed in as a group, because each is
           already a name on this list. */
        const newInput = () => /** @type {any} */ (inHalf(FILLS, ".at-blanknew input")[0] || null);
        const addBtn = () => /** @type {any} */ (inHalf(FILLS, ".at-blanknew button")[0] || null);
        typeInto(newInput(), "noun");
        await sleep(200);
        check("and a group cannot be named after one of them",
          !!addBtn() && addBtn().disabled,
          addBtn() ? (addBtn().disabled ? "refused" : "offered") : "(no button)");
        typeInto(newInput(), "");
        await sleep(150);
      }

      /* And the box that names a new one, above the list rather than at
         the bottom of a menu: naming the first blank of a kind is the one
         thing here nobody can do by choosing. */
      check("the box that names a new group is on the screen too",
        !!newBox() && !!newBox().querySelector("input"),
        newBox() ? "there" : "still behind a button");
      check("and above the list, where it is reached without scrolling past it",
        !!newBox() && !!fillList().length &&
          !!(newBox().compareDocumentPosition(fillList()[0]) & 4),
        newBox() && fillList().length ? "above" : "(nothing to compare)");

      /* What the card's own ticks say about being drilled, before and
         after it joins a group — see `guess` in the draft. */
      const ownTick = (/** @type {RegExp} */ re) => {
        const form = [...document.querySelectorAll(".at-formblock")].find((b) =>
          /^Form 1$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
        const row = form ? [...form.querySelectorAll(".at-drills .at-tickrow")]
          .find((r) => re.test(r.textContent || "")) : null;
        return row ? /** @type {any} */ (row.querySelector("input")) : null;
      };
      check("a card in no group is a question of its own, like any other",
        !!ownTick(/On its own/) && ownTick(/On its own/).checked,
        ownTick(/On its own/) ? String(ownTick(/On its own/).checked) : "(no tick)");

      /* Ticking one is what says the card fills it. */
      click(/** @type {any} */ (fillRow(/^name$/).querySelector("input")));
      await sleep(250);
      check("ticking one says this card fills it",
        JSON.stringify(ticked()) === JSON.stringify(["name"]),
        ticked().join(", ") || "(none ticked)");
      /* And joining a group is what makes a card look like a value —
         "what does Raphael mean" is not a question — so the tick under
         the form goes off with it, where the teacher can see it and say
         otherwise. It used to be a hidden third state of a card-wide
         toggle nobody was shown. */
      check("joining its first group stops it being asked on its own",
        !!ownTick(/On its own/) && !ownTick(/On its own/).checked,
        ownTick(/On its own/) ? String(ownTick(/On its own/).checked) : "(no tick)");
      check("while it goes on being lent to the sentences that borrow it",
        !!ownTick(/Inside sentence cards/) && ownTick(/Inside sentence cards/).checked,
        ownTick(/Inside sentence cards/)
          ? String(ownTick(/Inside sentence cards/).checked) : "(no tick)");

      /* And a second, which is the whole reason this is a list: the one
         word is a name and a greeting, rather than two cards carrying it
         and two schedules for the same word. */
      typeInto(newBox().querySelector("input"), "greeting");
      await sleep(120);
      click([...newBox().querySelectorAll("button")]
        .find((b) => /^Add$/.test((b.textContent || "").trim())));
      await sleep(300);
      check("a group nobody has named yet is typed in, and joins the list ticked",
        JSON.stringify(ticked().slice().sort()) === JSON.stringify(["greeting", "name"]),
        ticked().join(", ") || "(none ticked)");
      check("with every one of them named in what the card is for",
        /\bname\b/.test(((blanks() || {}).textContent) || "") &&
          /\bgreeting\b/.test(((blanks() || {}).textContent) || ""),
        ([...((blanks() || document).querySelectorAll(".at-hint"))]
          .map((h) => (h.textContent || "").replace(/\s+/g, " ").trim())
          .find((t) => /borrow/.test(t))) || "(nothing said)");

      const modal = () => /** @type {any} */ (document.querySelector(".at-modal"));
      const modalBtns = () => modal() ? [...modal().querySelectorAll("button")] : [];
      const modalBtn = (/** @type {RegExp} */ re) => /** @type {any} */ (
        modalBtns().find((b) => re.test((b.textContent || "").trim())) || null);

      /* ---- taking one off every card ----

         The other thing done to a name several cards share, beside the
         pencil and for the same reason: a group nobody wants any more is
         only visible from a card that is in it. It can mean one thing —
         taking this card out is the tick two rows to its left — so the
         question is whether to do it at all, and what it costs. */
      const bin = (/** @type {RegExp} */ re) => /** @type {any} */ (
        (fillRow(re) ? fillRow(re).parentElement : document)
          .querySelector('button[aria-label^="Take the group"]') || null);
      check("a group cards actually fill offers to come off all of them",
        !!bin(/^name$/), bin(/^name$/) ? "there" : "(no bin)");
      /* And one nothing fills does not: there is nothing to take off
         anybody, and a button that would do nothing is worse than none. */
      check("while one nobody fills yet does not, having nothing to come off",
        !bin(/^greeting$/), bin(/^greeting$/) ? "offered anyway" : "not offered");

      click(bin(/^name$/));
      await sleep(300);
      check("the bin asks before it reaches past this card",
        !!modal() && /^Take name off every card\?$/.test(
          ((modal().querySelector(".at-modaltitle") || {}).textContent || "").trim()),
        modal() ? ((modal().querySelector(".at-modaltitle") || {}).textContent || "").trim() : "(nothing asked)");
      /* Not "are you sure" — what it costs, in both directions: the cards
         that lose the tag and keep everything else, and the sentences left
         asking for a name nothing answers to. That second half is the one
         nobody would think of and the one that re-ticking cannot undo. */
      const asked = () => ((modal() || {}).textContent || "").replace(/\s+/g, " ");
      check("and says what goes with it, and what does not",
        /The tag comes off/.test(asked()) && /progress/.test(asked()),
        asked().slice(0, 160) || "(nothing said)");
      check("including the sentences that go on asking for the name",
        /goes on being asked/.test(asked()),
        asked().slice(0, 240) || "(nothing said)");

      /* Answered no, nothing has happened. */
      click(modalBtn(/^Cancel$/));
      await sleep(250);
      check("answering no leaves the group exactly as it was",
        !modal() && JSON.stringify(ticked().slice().sort()) === JSON.stringify(["greeting", "name"]),
        ticked().join(", ") || "(none ticked)");

      click(bin(/^name$/));
      await sleep(300);
      click(modalBtn(/^Take it off every card$/));
      await sleep(300);
      check("and answering yes takes it off this card with the rest",
        !modal() && JSON.stringify(ticked()) === JSON.stringify(["greeting"]),
        ticked().join(", ") || "(none ticked)");
      /* The row stays, because the list is the collection as it is stored
         and nothing is stored until the card is saved — the same way a
         rename leaves the old name on the list until then. */
      check("the row stays until the save that carries the answer out",
        fillNames().includes("name"), fillNames().join(", "));

      /* Ticked back on, so the walk below meets the card it expects: this
         card is in the group again, and the answer it carries out is the
         one being tested here rather than a card that quietly left. */
      click(/** @type {any} */ (fillRow(/^name$/).querySelector("input")));
      await sleep(250);

      /* And unticking is how one is taken off. */
      click(/** @type {any} */ (fillRow(/^name$/).querySelector("input")));
      await sleep(250);
      check("and unticking one takes it off, leaving the others",
        JSON.stringify(ticked()) === JSON.stringify(["greeting"]),
        ticked().join(", ") || "(none ticked)");
      click(/** @type {any} */ (fillRow(/^greeting$/).querySelector("input")));
      await sleep(250);
      check("down to none, which is what an ordinary card is",
        ticked().length === 0 && fillNames().includes("name"),
        ticked().join(", ") || "(none ticked)");
      check("and leaving the last group makes it a question again",
        !!ownTick(/On its own/) && ownTick(/On its own/).checked,
        ownTick(/On its own/) ? String(ownTick(/On its own/).checked) : "(no tick)");

      /* ---- renaming one ----

         A group tag is a name several cards share and the only place a
         misspelt one is visible is a card that carries it, so the pencil
         that renames it is on the row. What it asks is the one question a
         rename has: does the new name follow into every card that writes
         it, or does this card alone move? */
      click(/** @type {any} */ (fillRow(/^name$/).querySelector("input")));
      await sleep(250);
      const pencil = (/** @type {RegExp} */ re) => /** @type {any} */ (
        (fillRow(re) ? fillRow(re).parentElement : document)
          .querySelector('button[aria-label^="Rename the group"]') || null);
      click(pencil(/^name$/));
      await sleep(250);
      const renameBox = () => /** @type {any} */ (inHalf(FILLS, ".at-tagrow input.at-input")[0] || null);
      check("the pencil on a tag opens its name for editing, in place",
        !!renameBox() && renameBox().value === "name",
        renameBox() ? renameBox().value : "(no box)");
      typeInto(renameBox(), "names");
      await sleep(150);
      click([...document.querySelectorAll("button")]
        .find((b) => b.getAttribute("aria-label") === "Rename the group name"));
      await sleep(300);

      check("renaming a tag asks whether the name follows it everywhere",
        !!modal() && !!modalBtn(/^Change it everywhere$/) && !!modalBtn(/^Only here$/),
        modalBtns().map((b) => (b.textContent || "").trim()).join(" | ") || "(nothing asked)");

      /* Answered the narrow way: this card leaves the group for one of the
         new name, and every other card that carries the old one is left
         exactly as it was. */
      click(modalBtn(/^Only here$/));
      await sleep(300);
      check("and answering “only here” moves this card alone",
        JSON.stringify(ticked()) === JSON.stringify(["names"]) && fillNames().includes("name"),
        `${ticked().join(", ") || "(none ticked)"} · offered ${fillNames().join(", ")}`);
      click(/** @type {any} */ (fillRow(/^names$/).querySelector("input")));
      await sleep(250);
    }
  }

  /* ---- a verb, where the dictionary form is a cell of its own table ----

     Arabic has no infinitive: a dictionary lists the he-past, which is a
     cell of the table. So on this language the cell carries everything the
     card's own word does, and the block asking for it again was asking for
     the same word twice and then for the two to be kept in step by hand.
     The block is not shown; the cell is the card. */
  {
    /* Back to a plain word, out of the frame the walk above left behind. */
    typeInto(fieldNamed(/^Arabic script and transliteration$/i), "akal");
    await sleep(80);
    typeInto(fieldNamed(/^English$/), "to eat");
    await sleep(200);

    /* And the plainest card there is says what of it is drilled — under
       the word itself, which is what the ticks are about. 0.134 hid the
       question altogether on a card with one part, which is every
       ordinary word; 0.158 put it back as a list at the foot of the
       screen naming parts in the editor's own words; 0.179 asks it where
       the thing being drilled is. */
    {
      const formBlock = [...document.querySelectorAll(".at-formblock")].find((b) =>
        /^Form 1$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
      const parts = formBlock ? [...formBlock.querySelectorAll(".at-part")] : [];
      /* The form's own fields are the one subsection with no name across
         the top: the block above already says which form this is, and the
         others are named because they are additions to it. */
      check("a form is cut into subsections, and its own fields are the unnamed one",
        parts.length >= 1 && !parts[0].querySelector(".at-groupline"),
        parts.map((g) => ((g.querySelector(".at-groupline") || {}).textContent || "").trim() || "(unnamed)")
          .join(" | ") || "(no subsections)");
      const drills = parts.length ? parts[0].querySelector(".at-drills") : null;
      check("an ordinary word says what of it is drilled, beside the word", !!drills,
        [...document.querySelectorAll(".at-formnum, .at-groupline")]
          .map((n) => n.textContent).join(" | "));
      check("named for what it answers about, which is this form",
        !!drills && /^How this form can be practiced$/.test(
          ((drills.querySelector(".at-drillhead") || {}).textContent || "").trim()),
        drills ? ((drills.querySelector(".at-drillhead") || {}).textContent || "").trim() : "(no heading)");
      const only = drills ? [...drills.querySelectorAll(".at-tickrow")] : [];
      check("two ticks — on its own, and inside sentence cards — both on",
        only.length === 2 && /On its own/.test(only[0].textContent || "") &&
          /Inside sentence cards/.test(only[1].textContent || "") &&
          only.every((r) => /** @type {any} */ (r.querySelector("input")).checked),
        only.map((r) => (r.querySelector("b") || {}).textContent).join(" | ") || "(no lines)");
    }

    const block = (/** @type {RegExp} */ re) =>
      [...document.querySelectorAll(".at-formblock")].find((b) =>
        re.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
    /* Re-queried each time rather than held: the list re-renders between
       clicks, so a row kept in a variable is a row that is no longer on the
       screen. And it has to be opened first — see openWordKind. */
    const formsRow = (/** @type {RegExp} */ re) =>
      /** @type {any} */ ([...document.querySelectorAll(
        '[role="radiogroup"][aria-label="What subtype"] .at-tickrow')]
        .find((r) => re.test((r.textContent || "").trim())) || null);
    const kindBtn = (/** @type {RegExp} */ re) => {
      const row = formsRow(re);
      return row ? row.querySelector("input") : null;
    };
    await openWordKind();
    check("a word can be called a verb", !!kindBtn(/^Verb/),
      kindBtn(/^Verb/) ? "the list offers it" : "no such answer");
    check("and until it is, the card's own word is where it always was", !!block(/^The verb$|^Form 1$/),
      [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));

    await pickKind(/^Verb/);

    /* Answering shuts the list, and what is on screen is the answer with
       the pencil that opens it again — the state a question that has been
       answered sits in. */
    check("answering shuts the list and leaves the answer on screen",
      !formsRow(/^Verb/) && !!wordKindPencil() &&
        /^Verb/.test(wordKindSaid()),
      wordKindSaid() || "(nothing shown)");
    await openWordKind();
    check("and the pencil opens it again, on the answer",
      !!kindBtn(/^Verb/) && kindBtn(/^Verb/).checked,
      [...document.querySelectorAll('[aria-label="What subtype"] .at-tickrow input')]
        .map((/** @type {any} */ b) => b.checked).join(" "));
    click(document.querySelector(".at-screenhead h2"));
    await sleep(200);
    check("choosing it takes the block away rather than asking for the word twice",
      !block(/^The verb$/),
      [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));
    /* And the word is not left behind in a block that has just gone: it
       moves into the cell that is about to hold it, which is also the
       clearest way to be told which cell that is. */
    const cellNamed = (/** @type {string} */ label) =>
      /** @type {any} */ ([...document.querySelectorAll("input")]
        .find((i) => (i.getAttribute("aria-label") || "") === label) || null);
    const script = cellNamed("Arabic script for past · he");
    const meaning = cellNamed("English for past · he");
    check("the word moves into the dictionary form's own cell",
      !!script && script.value === "akal" && !!meaning && meaning.value === "to eat",
      script ? `script "${script.value}", English "${meaning ? meaning.value : "—"}"` : "no such cell");
    /* And the table says nothing about which cell that is. A gold "· the
       dictionary form" label made one row a different width and colour
       from the rest and asked for a piece of grammar theory to be held in
       mind while typing; where it matters, the editor says so below. */
    /* And it is named. A verb has no one word of its own — it is a table
       — so without a name a list would read "أكل · he ate", which is one
       cell of the table rather than the verb the card is about. The name
       is what a verb is listed as, so it is asked for rather than
       offered, and the English just typed into the word is what it starts
       as: nothing anybody wrote is lost by the block going away. */
    const nameBlock = cardNameField();
    check("a verb is asked what to call it", !!nameBlock,
      thisCardAsks().join(" | "));
    const nameBox = () => /** @type {any} */ (
      (cardNameField() || { querySelector: () => null }).querySelector("input"));
    check("and it starts as the meaning the word already had",
      !!nameBox() && nameBox().value === "to eat",
      nameBox() ? `"${nameBox().value}"` : "no such box");
    /* In "This card" and directly under what subtype it is: both are one
       fact about the whole card, settled once and then read, and neither
       belongs to any one of its forms. Not a framed section of its own
       standing between the card and its table. */
    const heads = [...document.querySelectorAll(".at-formnum")].map((n) => (n.textContent || "").trim());
    check("and it is asked in This card, directly under what subtype it is",
      thisCardAsks().indexOf("Name") === thisCardAsks().indexOf("What subtype") + 1 &&
        !heads.includes("What to call it"),
      `${thisCardAsks().join(" | ")} · ${heads.join(" | ")}`);
    /* And it says what it is for, and that nothing is asked about it. */
    check("and says it is a label rather than something practised",
      !!nameBlock && /listed and searched/.test(nameBlock.textContent || "") &&
        /Nobody is ever asked this/.test(nameBlock.textContent || ""),
      nameBlock ? (nameBlock.textContent || "").replace(/\s+/g, " ").slice(0, 150) : "(no field)");
    check("naming the box it would otherwise be listed under",
      !!nameBlock && /past · he/.test(nameBlock.textContent || ""),
      nameBlock ? (nameBlock.textContent || "").replace(/\s+/g, " ").slice(0, 150) : "(no field)");

    check("without the table labelling the cell it went into",
      !/the dictionary form/i.test(document.body.textContent || ""),
      /the dictionary form/i.test(document.body.textContent || "") ? "still labelled" : "the table is plain");
    check("and the card can be saved on the strength of it",
      !!saveBtn() && !saveBtn().disabled,
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}`);

    /*
     * ---- no box of the table is the card ----
     *
     * The he-past is the form a dictionary lists and it used to be the
     * card itself: the editor refused a verb until that one box and its
     * English were filled in, whatever else was written. A teacher
     * writing the present of a verb whose past they had not taught was
     * writing half a card. It is an ordinary box now.
     */
    typeInto(script, "");
    typeInto(meaning, "");
    await sleep(200);
    typeInto(cellNamed("Arabic script for present · he"), "byaakul");
    typeInto(cellNamed("English for present · he"), "he eats");
    await sleep(250);
    check("a verb with the box a dictionary lists left empty still saves",
      !!saveBtn() && !saveBtn().disabled,
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "offered"}`);
    check("and nothing on the screen asks for that box",
      !/past · he/.test(([...document.querySelectorAll(".at-formneed.unmet")]
        .map((n) => n.textContent || "").join(" ")) || ""),
      ([...document.querySelectorAll(".at-formneed.unmet")]
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())[0]) || "(nothing said)");

    /* What it is held to instead: a name, because that is what it is
       listed as and nothing else on a verb can be, and one form of the
       verb with its English, because a table with nothing in it teaches
       nothing. */
    typeInto(nameBox(), "");
    await sleep(250);
    check("a verb with no name is refused, because a name is what it is listed as",
      !!saveBtn() && saveBtn().disabled,
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "still offered"}`);
    check("and the line that says so is beside the name, not under the table",
      !!cardNameField() && /listed as its name/.test(
        (cardNameField().querySelector(".at-formneed.unmet") || {}).textContent || ""),
      ([...document.querySelectorAll(".at-formneed.unmet")]
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())[0]) || "(nothing said)");
    typeInto(nameBox(), "to eat");
    await sleep(250);

    /* And with the whole table empty, the line is about the table as a
       whole — any box of it, and the teacher chooses which. */
    typeInto(cellNamed("Arabic script for present · he"), "");
    typeInto(cellNamed("English for present · he"), "");
    await sleep(250);
    check("a verb with nothing written in its table is refused",
      !!saveBtn() && saveBtn().disabled,
      `save is ${saveBtn() && saveBtn().disabled ? "refused" : "still offered"}`);
    const unmetLines = () => [...document.querySelectorAll(".at-formneed.unmet")]
      .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim());
    check("and what it asks for is any one form, not a named box",
      unmetLines().some((t) => /at least one form of the verb/.test(t)) &&
        !unmetLines().some((t) => /past · he/.test(t)),
      unmetLines().join(" · ") || "(nothing said)");

    /* A verb is not offered a form outside its table. The offer used to be
       a quieter-worded button that revealed a block which was not there —
       it could only ever show while there was nothing to show — and then
       turned into the "Add a form" it stood in for. */
    const addForm = () => /** @type {any} */ ([...document.querySelectorAll("button")]
      .find((b) => /^Another way to say it$|^Add a form$/.test((b.textContent || "").trim())) || null);
    check("a verb is offered no form outside its table", !addForm(),
      addForm() ? `still offered: "${(addForm().textContent || "").trim()}"` : "no such button");

    /* Back to a word, and the one the block was holding is still there —
       putting the table away must not read as having thrown the card away.
       Still offered here because this card has never been saved: a stored
       verb is not asked, because the answer would drop its table. */
    await pickKind(/^Something else/);
    const back = fieldNamed(/^Arabic script and transliteration$/i);
    check("choosing an ordinary word again brings the block back with the word still in it",
      !!block(/^Form 1$|^The verb$/) && !!back && back.value === "akal",
      back ? `"${back.value}"` : "no field");
    check("and an ordinary card is still offered another form", !!addForm(),
      addForm() ? (addForm().textContent || "").trim() : "no button");

    /* A form the card already carries is shown whatever kind of card it is
       called: it is saved either way, so hiding it would read as having
       lost it. This is what the reveal got wrong — a card given a second
       form as a word, then called a verb, had that form disappear. */
    click(addForm());
    await sleep(250);
    check("a second form can be added to the word", !!block(/^Form 2$/),
      [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));
    await pickKind(/^Verb/);
    check("and calling it a verb does not hide the form it already has",
      !!block(/^Form 2$/),
      [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));

    /* The table was emptied above to see Save refuse; fill the box a
       dictionary lists again, so what follows is about a table with
       something in it and a card that saves. */
    typeInto(cellNamed("Arabic script for past · he"), "akal");
    typeInto(cellNamed("English for past · he"), "he ate");
    await sleep(200);

    /* ---- each kind of word gets the editor its grammar wants ----

       Eight answers, and until 0.140 only three of them changed anything
       on screen. What each shows now, read off the language's own
       declaration: which table, and which grammar axes. Nothing is typed
       here, so the table already filled in above is what the warning
       below still counts. */
    {
      const grammarBtn = () => /** @type {any} */ ([...document.querySelectorAll("button")]
        .find((b) => /^Grammar of /.test(b.getAttribute("aria-label") || "")) || null);
      const boxes = (/** @type {RegExp} */ re) => [...document.querySelectorAll("input")]
        .map((i) => i.getAttribute("aria-label") || "").filter((l) => re.test(l));
      const tables = () => boxes(/attached pronouns|agreement|counted|for (present|past|command) · /);
      const dimGroups = () => [...document.querySelectorAll('[role="radiogroup"]')]
        .map((g) => g.getAttribute("aria-label") || "").filter((l) => / of accepted answer| of this answer/.test(l));
      /* What the card itself is asked, which since 0.191 is a line of
         radios under the kind of word rather than an axis on every
         answer. */
      const cardAxis = () => /** @type {any} */ (
        document.querySelector('[role="radiogroup"][aria-label="Person or thing"]') || null);
      const axisPicks = () => [...(cardAxis() ? cardAxis().querySelectorAll('input[type="radio"]') : [])]
        .map((i) => i.getAttribute("aria-label") || "");
      const askAxes = async () => {
        click(grammarBtn());
        await sleep(200);
        const seen = dimGroups().map((l) => l.replace(/ of (accepted answer \d+|this answer)$/, ""));
        click(grammarBtn());
        await sleep(100);
        return seen;
      };

      await pickKind(/^Preposition/);
      check("a preposition takes the pronouns on its end, and is asked no number or gender",
        boxes(/attached pronouns · me$/).length > 0 && !grammarBtn() && !boxes(/for past · he$/).length,
        `${tables().length} table boxes · grammar ${grammarBtn() ? "asked" : "not asked"}`);

      await pickKind(/^Name/);
      check("a name has no table and is asked its number and gender — the verb beside it reads both",
        !tables().length && !!grammarBtn(), `${tables().length} table boxes · grammar ${grammarBtn() ? "asked" : "not asked"}`);
      const nameAxes = grammarBtn() ? await askAxes() : [];
      check("and not whether it is a person or a thing",
        nameAxes.includes("Number") && nameAxes.includes("Gender") && !nameAxes.includes("Person or thing"),
        nameAxes.join(" | ") || "(no axes)");
      check("which is asked of nothing that is not asked it",
        !cardAxis(), cardAxis() ? "the kind block asks it anyway" : "not asked");

      await pickKind(/^Noun/);
      const nounAxes = grammarBtn() ? await askAxes() : [];
      /* Person or thing is one fact about the card — as true of the plural
         as of the singular — so it is asked once, under the kind of word,
         and not of each accepted answer of each form. */
      check("a noun is asked whether it is a person or a thing, beside the kind of word it is",
        !!cardAxis() && !nounAxes.includes("Person or thing"),
        `${cardAxis() ? "asked once" : "not asked"} · answer axes ${nounAxes.join(" | ") || "(none)"}`);
      check("and it is one line of radios, a thing or a person, in the block that says what kind it is",
        !!cardAxis() && !!cardAxis().closest(".at-formblock") &&
          /This card/.test(((cardAxis().closest(".at-formblock").querySelector(".at-formnum")) || {}).textContent || "") &&
          ["a thing", "a person"].every((v) => axisPicks().includes(v)),
        axisPicks().join(" | ") || "(no radios)");
      check("while its number and gender stay with the answer they are about",
        nounAxes.includes("Number") && nounAxes.includes("Gender") &&
          boxes(/attached pronouns · me$/).length > 0,
        nounAxes.join(" | ") || "(no axes)");
      /* A thing until somebody says otherwise, and what they say is kept:
         it is one answer for the card, so there is nowhere else for it to
         be read back off. */
      const axisOn = () => [...(cardAxis() ? cardAxis().querySelectorAll('input[type="radio"]') : [])]
        .filter((i) => /** @type {any} */ (i).checked)
        .map((i) => i.getAttribute("aria-label") || "")
        .join("");
      check("and it starts as a thing, which is what most nouns are", axisOn() === "a thing", axisOn() || "(nothing chosen)");
      click([...(cardAxis() ? cardAxis().querySelectorAll('input[type="radio"]') : [])]
        .find((i) => i.getAttribute("aria-label") === "a person"));
      await sleep(200);
      check("saying it is a person is the card's answer and stays said", axisOn() === "a person", axisOn() || "(nothing chosen)");

      await pickKind(/^Adjective/);
      check("an adjective lays out the forms it takes beside a noun, and nothing else",
        !!boxes(/^Arabic script for feminine$/).length && !!boxes(/^Arabic script for plural$/).length &&
          !boxes(/attached pronouns|for (present|past|command) · /).length,
        tables().join(" | ") || "(no table)");
      /* Including a pair, which this app could not say until 0.207: a
         dual noun matched no column, so the adjective beside it fell back
         to the card's own word — the one wrong answer that looks right. */
      check("including the form beside a pair",
        !!boxes(/^Arabic script for dual$/).length,
        boxes(/ for (feminine|plural|dual)$/).join(" | ") || "(no table)");
      /* And each of them written the way the word itself is, in a block
         of its own rather than a grid of unlabelled boxes further down
         the page. Three cells is not a verb's twenty-four. */
      const blockNames = () => [...document.querySelectorAll(".at-formnum")]
        .map((n) => (n.textContent || "").trim());
      check("each of them in a block beside the word, in the format the word is written in",
        ["feminine", "plural", "dual"].every((c) => blockNames().includes(c)) &&
          !!boxes(/^English for feminine$/).length,
        blockNames().join(" | "));
      check("with no number or gender on the word, because the table is its number and gender",
        !grammarBtn(), grammarBtn() ? "grammar asked" : "not asked");
      /* And the ticks are about the card rather than about the block they
         used to sit at the foot of: on a card that can hold only one
         form, "this form" and "this card" are the same thing, and the
         answer belongs in a section rather than tucked under a field. */
      check("and how it is practised is a section about the card, not a footnote to a form",
        blockNames().includes("How this card can be practiced") &&
          !/How this form can be practiced/.test(document.body.textContent || ""),
        blockNames().join(" | "));
      const blocksUp = () => [...document.querySelectorAll(".at-formnum")].map((n) => (n.textContent || "").trim());
      check("and no second form offered, because a spelling is an accepted answer",
        !addForm() && blocksUp().includes("Form 1"),
        addForm() ? "a form is offered" : blocksUp().join(" | "));
      /* Nor any other way to one. Taking the Add button away and leaving
         Duplicate on the card's own word was not taking it away: the
         invitation was on every adjective in the app, under a line that
         told teachers to accept it. */
      const copyBtn = () => [...document.querySelectorAll("button")]
        .find((b) => /^Duplicate$/.test((b.textContent || "").trim()));
      check("and no other way to one either, because the table is the forms",
        !copyBtn(), copyBtn() ? "still offered" : "no such button");
      check("and the line under the word says where its forms are, rather than pointing at nothing",
        /forms it takes beside a noun are written below/.test(document.body.textContent || "") &&
          !/You can add additional forms/.test(document.body.textContent || ""),
        ((([...document.querySelectorAll(".at-formblock")]
          .find((b) => /^Form 1$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()))
          || document.body).querySelector(".at-formrole") || {}).textContent || "").trim().slice(0, 90));

      /* A number is not one of the answers any more: the faces a numeral
         takes are boxes in the language's number system, and the card
         under one is written by the app out of what the teacher typed
         there. The kind is still read — a card saved while it was offered
         goes on saying what it is — but nobody is offered it. */
      await openWordKind();
      check("a number is not a kind of word anybody is offered, because it is a system now",
        !formRows().some((r) => /^Number/.test((r.textContent || "").trim())),
        formRows().map((r) => (r.textContent || "").slice(0, 10)).join(" | ") || "(nothing offered)");

      await pickKind(/^Pronoun/);
      check("a pronoun has no table and is asked its number and gender",
        !tables().length && !!grammarBtn(), `${tables().length} table boxes`);

      await pickKind(/^Something else/);
      check("something else is the word alone: no table, no grammar",
        !tables().length && !grammarBtn(), `${tables().length} table boxes · grammar ${grammarBtn() ? "asked" : "not asked"}`);

      await pickKind(/^Verb/);
    }

    /* A card that has never been saved is not locked into being a verb, so
       it is the one place a typed table can still be dropped. It says so,
       and counts what is at stake rather than warning in the abstract. */
    await pickKind(/^Something else/);
    check("a table typed into a new card says what dropping it would cost",
      /table is put aside/.test(document.body.textContent || "") &&
        /1 box filled in/.test((document.body.textContent || "").replace(/\s+/g, " ")),
      ([...document.querySelectorAll(".at-formneed.unmet")]
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
        .find((t) => /put aside/.test(t))) || "(nothing said)");

    /* And back, which is the other half of saying it: the table is not
       thrown away until the card is saved, so answering again brings every
       box back. What kind of *card* this is cannot be answered again at
       all — it was settled before this screen opened — so the one way a
       table can be put aside is this question. */
    await pickKind(/^Verb/);
    check("and coming back brings the table with its cells still in it",
      !!cellNamed("Arabic script for past · he") &&
        cellNamed("Arabic script for past · he").value === "akal",
      cellNamed("Arabic script for past · he")
        ? `"${cellNamed("Arabic script for past · he").value}"` : "no such cell");
  }

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a word written weeks ago can still be called a verb ----
   This is what the tick had over the selector it sat under, and the reason
   the question is asked of a saved card at all: a verb is usually written
   as a plain word and given its tenses when the course reaches them. What
   a saved card is not offered is the kind it cannot become — a conversation
   has turns, and there would be nowhere to put them. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);

  const savedTile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("كتاب"));
  click(savedTile);
  await sleep(450);
  click([...document.querySelectorAll("button")].find((b) => /^Edit$/.test((b.textContent || "").trim())));
  await sleep(450);

  const saved = () => [...document.querySelectorAll(
    '[role="radiogroup"][aria-label="What subtype"] .at-tickrow')];
  /* A card written before the question existed says nothing about what
     kind of word it is and holds no table to be read as one, so it opens
     unanswered — the button, saying so, with the list behind it. */
  check("a card written weeks ago opens with the question unanswered rather than guessed at",
    !!wordKindBtn() && /Not said yet/.test(wordKindBtn().textContent || "") && !saved().length,
    wordKindBtn() ? (wordKindBtn().textContent || "").trim() : "(nothing offered)");
  await openWordKind();
  check("and is still asked what kind of word it is",
    saved().length > 2 && saved().some((r) => /^Verb/.test((r.textContent || "").trim())),
    saved().map((r) => (r.textContent || "").slice(0, 24)).join(" | ") || "(nothing offered)");
  /* The kind itself is settled: a written word does not become a
     conversation, and there would be nowhere to put the turns. */
  const kindSegs = [...document.querySelectorAll(
    '[role="group"][aria-label="The kind of card"] .at-seg')];
  check("but it is not offered the kind it can no longer become",
    !kindSegs.some((b) => /Conversation/.test(b.textContent || "")),
    kindSegs.map((b) => b.textContent).join(" | ") || "(the kind is settled, and says so)");

  await pickKind(/^Verb/);
  const cited = /** @type {any} */ ([...document.querySelectorAll("input")]
    .find((i) => (i.getAttribute("aria-label") || "") === "Arabic script for past · he") || null);
  check("calling it one moves its word into the box a dictionary lists it under",
    !!cited && cited.value === "كتاب", cited ? `"${cited.value}"` : "no such cell");
  /* And the plural it already carried is still on screen: it is saved
     either way, so hiding it would read as having lost it. */
  check("and the form it already had is still there",
    [...document.querySelectorAll(".at-formnum")].some((n) => /^Form 2$/.test((n.textContent || "").trim())),
    [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));

  /* Back to a word, which is still offered because the stored card has no
     table — only a saved verb is held to what it is. Left without saving,
     so nothing later counts a card differently. */
  /* ---- and the other table a word may lay out ----

     Arabic writes "my book" as one word, and the same endings carry a
     preposition. Those are forms of the word and things to learn, and the
     verb table has no axis for them: it says who is doing it and when,
     never who it is about. One row, the same component, and cells told
     apart from a verb's by the row they sit in. */
  await openWordKind();
  check("a word can be called a noun, which is what takes them",
    saved().some((r) => /^Noun/.test((r.textContent || "").trim())),
    saved().map((r) => (r.textContent || "").slice(0, 24)).join(" | "));
  await pickKind(/^Noun/);

  const attachedCell = (/** @type {string} */ label) =>
    /** @type {any} */ ([...document.querySelectorAll("input")]
      .find((i) => (i.getAttribute("aria-label") || "") === label) || null);
  /* A table per form, which is what these are: the singular has its
     pronouns and the plural has its own, and one table hanging off the
     card said the plural's were the singular's. This card carries a
     plural, so there are two. */
  check("which puts a table of them under the word",
    !!attachedCell("Arabic script for the word · attached pronouns · me") &&
      !!attachedCell("Arabic script for the word · attached pronouns · them"),
    [...document.querySelectorAll(".at-celllabel")].map((n) => n.textContent).join(" | ") || "(no table)");
  check("and another under the form beside it",
    !!attachedCell("Arabic script for form 2 · attached pronouns · me"),
    [...document.querySelectorAll("input")]
      .map((i) => i.getAttribute("aria-label"))
      .filter((l) => l && /attached/.test(l)).join(" | ") || "(one table only)");
  /* Which are two boxes and not one drawn twice: typing into the plural's
     leaves the word's own alone. Before every form carried its own table,
     a row and a column named one cell between them and the second form's
     wrote over the first's. */
  const typeIn = (/** @type {any} */ box, /** @type {string} */ text) => {
    const setValue = must(
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
      "the input's value descriptor"
    ).set;
    must(setValue, "the input's value setter").call(box, text);
    box.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  typeIn(attachedCell("Arabic script for form 2 · attached pronouns · me"), "كتبي");
  await sleep(120);
  check("and filling one of them does not fill the other",
    attachedCell("Arabic script for form 2 · attached pronouns · me").value === "كتبي" &&
      attachedCell("Arabic script for the word · attached pronouns · me").value === "",
    `the word's: "${attachedCell("Arabic script for the word · attached pronouns · me").value}" · ` +
      `form 2's: "${attachedCell("Arabic script for form 2 · attached pronouns · me").value}"`);
  /* And the mic beside a box opens that box's recordings. It used to be
     found by its row and column alone, which on two tables is two cells
     with one name. */
  const mic = [...document.querySelectorAll("button")]
    .find((b) => /form 2 · attached pronouns · me/.test(b.getAttribute("aria-label") || ""));
  click(mic);
  await sleep(300);
  const recTitle = [...document.querySelectorAll(".at-title, h1, h2")]
    .map((n) => (n.textContent || "").trim()).find((t) => /Recordings/.test(t)) || "";
  check("and the mic beside a box opens that box's recordings",
    /form 2/.test(recTitle), recTitle || "(no recording screen)");
  /* Its own way back, and not the editor's: the recording screen stands
     over the card, so both are on the page and the editor's is the one a
     plain search for "Back" finds first. */
  click([...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || "") === "Back to the card"));
  await sleep(250);
  /* And the verb's table is not also up: a card lays out one or the
     other, and the radio is what says which. */
  check("and not the verb's table as well",
    !attachedCell("Arabic script for past · he"),
    attachedCell("Arabic script for past · he") ? "both tables are up" : "one table at a time");
  /* The word's own block stays. A verb whose dictionary form is a cell
     replaces it; an attached pronoun is a form of the word, not a
     stand-in for it. */
  const blockOrder = () =>
    [...document.querySelectorAll(".at-formnum")].map((n) => (n.textContent || "").trim());
  check("while the word itself keeps its own block, being what these are forms of",
    blockOrder().includes("Form 1"), blockOrder().join(" | "));
  /* And a form can be added again, which 0.130 took away on the grounds
     that the plural is "a second table rather than one more form". True,
     and the conclusion should have been to give it one: adding a form now
     adds the word and the eight pronouns on the end of it. */
  const addForm = () => [...document.querySelectorAll("button")]
    .find((b) => /^Add a form$/.test((b.textContent || "").trim()));
  check("a form can be added beside them again", !!addForm(),
    addForm() ? "offered" : "no such button");
  click(addForm());
  await sleep(300);
  check("and what it adds is a word and a table of its own",
    blockOrder().includes("Form 3") &&
      !!attachedCell("Arabic script for form 3 · attached pronouns · me"),
    blockOrder().join(" | "));
  /* The forms it already carries stay: they are saved either way, and
     hiding one would read as having lost it. */
  check("while a form the card already had is still on screen",
    blockOrder().includes("Form 2"), blockOrder().join(" | "));

  const plainHere = () => {
    const row = saved().find((r) => /^Something else/.test((r.textContent || "").trim()));
    return /** @type {any} */ (row ? row.querySelector("input") : null);
  };
  click(plainHere());
  await sleep(350);
  const mainField = /** @type {any} */ ([...document.querySelectorAll(".at-formblock.main .at-field")]
    .find((f) => /^Arabic script and transliteration$/i.test(
      ((f.querySelector(".at-label") || {}).textContent || "").trim())) || null);
  const own = mainField ? mainField.querySelector("input") : null;
  check("and calling it a word again leaves the word where it was",
    !!own && own.value === "كتاب", own ? `"${own.value}"` : "no field");

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a saved verb still says what kind of word it is ----

   A verb is the one card whose table only one kind of word lays out, so
   nothing is offered: choosing a kind that lays out another table would be
   offering to throw this one away, and a list of one answer is not a
   question. The section used to go with the list, and a teacher opening a
   verb they had saved was shown no answer to "what kind of word is this"
   at all — the card's plainest fact missing from the one screen that knows
   it. It is shown and not asked now, the way the kind of card above it is
   when it is settled. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  /* The verb, which is listed under the name its teacher gave it. */
  const tile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => ((t.querySelector(".at-mininame") || {}).textContent || "").trim() === "to eat");
  click(tile);
  await sleep(450);
  click([...document.querySelectorAll("button")].find((b) => /^Edit$/.test((b.textContent || "").trim())));
  await sleep(450);

  check("a saved verb is still asked nothing about its subtype",
    !wordKindBtn() && !formRows().length,
    wordKindBtn() ? "a list is offered" : "nothing is offered");
  check("but the subtype is still on the screen, under its own heading",
    thisCardAsks().includes("What subtype"),
    thisCardAsks().join(" | ") || "(nothing asked)");
  const subtypeRow = () => {
    const block = thisCardBlock();
    const field = block && [...block.querySelectorAll(".at-field")].find(
      (f) => /^What subtype$/.test(((f.querySelector(".at-label") || {}).textContent || "").trim()));
    return /** @type {any} */ (field ? field.querySelector(".at-shutrow") : null);
  };
  check("and it says Verb",
    !!subtypeRow() && /^Verb/.test(
      ((subtypeRow().querySelector(".at-shutname") || {}).textContent || "").trim()),
    subtypeRow() ? (subtypeRow().textContent || "").replace(/\s+/g, " ").trim() : "(no row)");
  /* With a padlock where the pencil sits on a question that can still be
     answered again — the same row the kind of card wears one section up. */
  check("with a padlock rather than a pencil, and says why",
    !!subtypeRow() && !!subtypeRow().querySelector(".at-shutlock") && !wordKindPencil() &&
      /cannot be changed while the card carries its table/.test(
        (thisCardBlock().textContent || "")),
    subtypeRow() && subtypeRow().querySelector(".at-shutlock") ? "locked" : "no padlock");
  /* And the line that says what would unlock it is still at the foot of
     the block: empty the table and it is a word again. */
  check("and the block still says what a verb is and how it stops being one",
    /Empty the table and it is a word again/.test(thisCardBlock().textContent || ""),
    (thisCardBlock().textContent || "").replace(/\s+/g, " ").slice(-120));

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a saved adjective opens on the table it agrees out of ----

   The first table that is neither a verb's nor the pronouns, so the first
   time the editor has had to open a card on a table it was never told
   about by name. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  /* The word itself, not the phrase that happens to contain it. */
  const tile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => ((t.querySelector(".ar") || {}).textContent || "").trim() === "كبير");
  click(tile);
  await sleep(450);
  click([...document.querySelectorAll("button")].find((b) => /^Edit$/.test((b.textContent || "").trim())));
  await sleep(450);
  const box = (/** @type {string} */ label) =>
    /** @type {any} */ ([...document.querySelectorAll("input")]
      .find((i) => (i.getAttribute("aria-label") || "") === label) || null);
  const fem = box("Arabic script for feminine");
  check("a saved adjective opens on the forms it takes beside a noun",
    !!fem && fem.value === "كبيرة", fem ? `"${fem.value}"` : "no such box");
  check("and on no other table",
    !box("Arabic script for past · he") && !box("Arabic script for the word · attached pronouns · me"),
    "one table");
  /* Each named, because three blocks of identical fields under three
     headings are four boxes called the same thing to anybody reading the
     screen aloud — a heading is not a label. */
  check("and every box says which form it belongs to",
    !!box("Transliteration for feminine") && !!box("English for feminine") &&
      !!box("Arabic script for dual"),
    [...document.querySelectorAll("input")].map((i) => i.getAttribute("aria-label"))
      .filter((l) => l && / for /.test(l)).join(" | ") || "(nothing named)");
  /* And with the table written there are two answers about practice, not
     one: the word, and the shapes beside it. Both in the one section. */
  check("and the practice section holds an answer for the word and one for its other forms",
    /How this card can be practiced/.test(document.body.textContent || "") &&
      [...document.querySelectorAll(".at-drillhead")].length === 2,
    [...document.querySelectorAll(".at-drillhead")]
      .map((n) => (n.textContent || "").trim()).join(" | ") || "(no heads)");
  check("with the word keeping its own block, being what these are forms of",
    [...document.querySelectorAll(".at-formnum")].some((n) => (n.textContent || "").trim() === "Form 1"),
    [...document.querySelectorAll(".at-formnum")].map((n) => n.textContent).join(" | "));
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a saved word with pronouns on its end opens as what it is ----

   The editor seeded a verb's dictionary form into any card that had a cell,
   and a cell of the attached table is a cell. So a saved attached-pronoun
   card in Arabic opened on the verb table, its pronouns put aside, the radio
   hidden because the stored card is attached — and Save dropped them. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const tile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("قلم"));
  click(tile);
  await sleep(450);
  click([...document.querySelectorAll("button")].find((b) => /^Edit$/.test((b.textContent || "").trim())));
  await sleep(450);

  const box = (/** @type {string} */ label) =>
    /** @type {any} */ ([...document.querySelectorAll("input")]
      .find((i) => (i.getAttribute("aria-label") || "") === label) || null);
  const me = box("Arabic script for attached pronouns · me");
  check("a saved word with pronouns on its end opens on its pronouns",
    !!me && me.value === "قلمي", me ? `"${me.value}"` : "no such box");
  check("and not on a verb table it never had",
    !box("Arabic script for past · he"),
    box("Arabic script for past · he") ? "a past · he box is up" : "no verb table");
  check("and says which it is",
    /Attached pronouns: every form/.test(document.body.textContent || ""),
    ([...document.querySelectorAll(".at-hint, .at-help, p")]
      .map((n) => (n.textContent || "").trim()).find((t) => /^(A verb|Attached pronouns):/.test(t)) || "(nothing said)"));

  /* ---- and cannot be made into another kind of card ----

     A card is a word, a sentence or a conversation, and that is settled
     when it is made. It is what a student's whole record hangs on and what
     every other card's blanks are written against, so the block that asked
     it says what the card is instead of offering to change it. Until 0.180
     a saved word with no table could be called a sentence and back again,
     which is the one pair that looked harmless. */
  {
    const kind = [...document.querySelectorAll(".at-formblock")].find((b) =>
      /^This card$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
    check("a saved card is not offered another kind",
      !!kind && !kind.querySelector('[aria-label="The kind of card"]'),
      kind
        ? (kind.querySelector('[aria-label="The kind of card"]') ? "the track is still there" : "no track")
        : "(no such section)");
    /* Said as the answered question it is: the type, read, with a padlock
       where a question that can still be answered again wears a pencil. */
    check("and says what it is, and that it was settled when the card was made",
      !!kind && /The type of card cannot be changed/.test(kind.textContent || "") &&
        !!kind.querySelector(".at-shutlock"),
      kind ? (kind.textContent || "").replace(/\s+/g, " ").slice(0, 160) : "(no such section)");
  }

  /* ---- and what of it is drilled, subsection by subsection ----

     A card is a word and a pile of forms of it, and until 0.134 all of it
     was asked about: the only way to stop a form being drilled was to
     delete it, which took its recordings and every student's progress with
     it. Until 0.179 the answer was given in one list at the foot of the
     screen naming each part in the editor's own words — so a teacher
     looking at the pronoun table they had just filled in had to scroll
     past everything else to a line called "Its attached pronouns" and work
     out that it meant the table above. Now each subsection asks for
     itself, at its own foot: the word, and the pronouns on the end of it. */
  {
    const partsOf = () => {
      const block = [...document.querySelectorAll(".at-formblock")].find((b) =>
        /^Form 1$/.test(((b.querySelector(".at-formnum") || {}).textContent || "").trim()));
      return block ? [...block.querySelectorAll(".at-part")] : [];
    };
    const named = partsOf().map((g) =>
      ((g.querySelector(".at-groupline") || {}).textContent || "").trim());
    check("the form is cut into the word and the pronouns on its end",
      named.length === 2 && named[0] === "" && /^Its attached pronouns$/.test(named[1]),
      named.map((n) => n || "(unnamed)").join(" | ") || "(no subsections)");
    const drillsIn = () => partsOf().map((g) => g.querySelector(".at-drills"));
    check("and each of them says for itself what is drilled",
      drillsIn().length === 2 && drillsIn().every(Boolean),
      drillsIn().map((d) => !!d).join(", "));
    /* One named tick inside one subsection's ticks. */
    const tickIn = (/** @type {any} */ at, /** @type {RegExp} */ re) => {
      const row = at ? [...at.querySelectorAll(".at-tickrow")]
        .find((/** @type {any} */ r) => re.test(r.textContent || "")) : null;
      return row ? /** @type {any} */ (row.querySelector("input")) : null;
    };
    check("all of it is drilled until somebody says otherwise",
      drillsIn().every((d) => d && [...d.querySelectorAll(".at-tickrow input")]
        .every((/** @type {any} */ t) => t.checked)),
      drillsIn().map((d) => d ? [...d.querySelectorAll(".at-tickrow input")]
        .map((/** @type {any} */ t) => t.checked).join("/") : "-").join(" | "));

    /* Untick the pronouns' own "on its own": the answer is written where
       the table is, the word above it is untouched, the pronouns go on
       standing in other cards' blanks, and the table stays on the card —
       which is the whole reason this is here rather than a Delete
       button. */
    click(tickIn(drillsIn()[1], /On its own/));
    await sleep(250);
    const back = drillsIn();
    check("switching the pronouns off leaves them lent to sentence cards",
      back.length === 2 && tickIn(back[1], /On its own/) &&
        !tickIn(back[1], /On its own/).checked &&
        tickIn(back[1], /Inside sentence cards/).checked,
      back.length === 2 && back[1]
        ? [...back[1].querySelectorAll(".at-tickrow")]
            .map((/** @type {any} */ r) => `${(r.querySelector("b") || {}).textContent}=${r.querySelector("input").checked}`)
            .join(" | ")
        : "(no ticks)");
    check("and the word itself is still drilled",
      back.length === 2 && tickIn(back[0], /On its own/).checked,
      back.length === 2 ? String(!!(tickIn(back[0], /On its own/) || {}).checked) : "(no ticks)");
    /* And the table itself is untouched by the tick: the whole reason
       this is a tick rather than a Delete button is that the words, the
       recordings and every student's progress stay exactly where they
       were. What the box still holds is the evidence. */
    check("while the table stays on the card, recordings and progress and all",
      !!me && me.value === "قلمي",
      me ? `"${me.value}"` : "(no such box)");
  }

  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a prompt two forms of one card answer says which it wants ----

   A card's forms are drilled on their own, and two of them can answer the
   same question: both forms of this one mean "teacher". Asked to write it
   in the script, a learner has no way to know which was wanted, and writing
   the other is marked wrong for knowing the word.

   Driven through the teacher's own trial, because that asks one named
   exercise on one named card rather than whichever a shuffled queue
   reaches. The rule itself is checked over every combination in
   tests/cards.test.mjs; what is checked here is that the question is
   actually handed the card's other forms and what is on screen beside it. */
{
  if (document.querySelector('[data-el="leave-session"]')) {
    click(document.querySelector('[data-el="leave-session"]'));
    await sleep(150);
    click(buttonNamed(/^Leave$/));
    await sleep(300);
  }
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);

  const tile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("teacher"));
  check("the card whose two forms mean one thing is listed", !!tile,
    tile ? (tile.textContent || "").replace(/\s+/g, " ").slice(0, 40) : "no tile");
  click(tile);
  await sleep(450);

  const toScript = [...document.querySelectorAll(".at-try")]
    .find((b) => /^Try English →/.test(b.getAttribute("aria-label") || ""));
  click(toScript);
  await sleep(600);

  const said = () =>
    ((document.querySelector('[data-el="question-instruction"]') || {}).textContent || "")
      .replace(/\s+/g, " ").trim();
  const tag = () =>
    ((document.querySelector('[data-el="question-form-tag"]') || {}).textContent || "")
      .replace(/\s+/g, " ").trim();
  check("writing it from its meaning says which form it wants", !!tag(), said() || "(no question up)");
  /* The card's own form, which is the half that never got this: the tag was
     shown on sub-forms alone, so the masculine standing beside its own
     feminine was left bare. */
  check("and names it by the grammar the language declares", /m\./.test(tag()),
    tag() || "(nothing said)");

  /* Answered and continued rather than left, the way the other trial is:
     the teaching space is unmounted while a question is up, and Continue is
     what puts it back. Backing out of a trial leaves nothing behind either
     way — a teacher trying their own exercise is not learning. */
  click(buttonNamed(/^I don't know$/));
  await sleep(200);
  if (!document.querySelector('[data-el="verdict"]')) {
    click(document.querySelector('[data-el="check-button"]'));
    await sleep(250);
  }
  click(buttonNamed(/^Continue$/));
  await sleep(700);

  click(buttonNamed(/^Continue$/));
  await sleep(700);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- and two forms of one card in a grid say which each is ----

   The instruction can only speak for the word the question is *about*, and
   in a matching grid every word is asked: what a learner has to do is put
   the right English against each of five words. Two forms of one card
   standing in the same grid is the pairing they cannot reason out — كبير
   and كبيرة are both "big", however differently the two meanings are
   written — so those tiles, and only those, carry their own grammar, on
   the meanings as well as on the words.

   Driven through the teacher's trial for the reason the block above is: it
   asks one named exercise on one named card, and the adjective's feminine
   is the word in this material most like it, so it is the company the grid
   is filled with. Which tiles get a tag is checked over every combination
   in tests/cards.test.mjs; what is checked here is that the grid on screen
   carries them. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);
  /* The word itself, not the phrase that happens to contain it. */
  const tile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => ((t.querySelector(".ar") || {}).textContent || "").trim() === "كبير");
  click(tile);
  await sleep(450);

  const toGrid = [...document.querySelectorAll(".at-try")]
    .find((b) => /^Try Match the pairs$/.test(b.getAttribute("aria-label") || ""));
  check("a card with company can be tried on the matching grid", !!toGrid,
    [...document.querySelectorAll(".at-try")].map((b) => b.getAttribute("aria-label")).join(" | "));
  click(toGrid);
  await sleep(700);

  /** @param {string} sel */
  const tiles = (sel) => [...document.querySelectorAll(sel)];
  /** @param {Element} el */
  const tagOn = (el) =>
    ((el.querySelector('[data-el="match-form-tag"]') || {}).textContent || "").trim();
  /** @param {string} word */
  const wordTile = (word) =>
    tiles('[data-el="match-word"]').find(
      (el) => ((el.querySelector(".at-arabic") || {}).textContent || "").replace(/\s+/g, "") === word);
  /** @param {RegExp} re */
  const meaningTile = (re) =>
    tiles('[data-el="match-meaning"]').find((el) => re.test((el.textContent || "").trim()));

  const both = !!wordTile("كبير") && !!wordTile("كبيرة");
  check("the grid stands a card's two forms beside each other", both,
    tiles('[data-el="match-word"]').map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()).join(" · "));
  check("and each of the two says which form it is",
    both && /m\./.test(tagOn(must(wordTile("كبير"), "the masculine tile"))) &&
      /f\./.test(tagOn(must(wordTile("كبيرة"), "the feminine tile"))),
    both
      ? `كبير: "${tagOn(must(wordTile("كبير"), "the masculine tile"))}" · ` +
        `كبيرة: "${tagOn(must(wordTile("كبيرة"), "the feminine tile"))}"`
      : "the two forms were not both dealt");
  /* The half that matters most: a tag on the words alone names the form
     without saying which English belongs to it, which is the whole of what
     was being asked for. */
  check("and so does the meaning each of them belongs to",
    !!meaningTile(/^big\b/) && !!meaningTile(/^big \(f\)/) &&
      !!tagOn(must(meaningTile(/^big\b/), "the meaning tile for big")) &&
      !!tagOn(must(meaningTile(/^big \(f\)/), "the meaning tile for big (f)")),
    tiles('[data-el="match-meaning"]').map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()).join(" · "));
  /* And nobody else: a grid of five labelled words is a reading exercise
     about labels. */
  check("while a word with nothing to be confused with stays bare",
    tiles('[data-el="match-word"]').some((el) => !tagOn(el)),
    tiles('[data-el="match-word"]').map((el) => `${(el.textContent || "").replace(/\s+/g, " ").trim()}`).join(" · "));

  click(document.querySelector('[data-el="leave-session"]'));
  await sleep(500);
  click([...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Back"));
  await sleep(300);
}

/* ---- a hole in a card, filled ----
   "My name is {{name}}" is a frame, not a sentence: the question fills it
   with one of the cards that say they fill `name`, and fills every field
   with the same one — so the prompt, the marking and the answer screen are
   looking at the same person. Driven through the teacher's own trial,
   because that asks one named exercise rather than whichever one a shuffled
   queue reaches. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  const teachTabs = [...frame.querySelectorAll("button")].filter((b) => /^Cards$/.test(b.textContent || ""));
  click(teachTabs[teachTabs.length - 1]);
  await sleep(500);

  const holeTile = [...frame.querySelectorAll(".at-minicard")]
    .find((t) => (t.textContent || "").includes("My name is"));
  check("a card with a variable is listed as it was written",
    !!holeTile && holeTile.querySelectorAll(".at-slot").length > 0 &&
      !/[{}]/.test(holeTile.textContent || ""),
    holeTile ? (holeTile.textContent || "").replace(/\s+/g, " ").slice(0, 60) : "no tile");
  click(holeTile);
  await sleep(450);

  /* What a card with a variable can and cannot be asked. The listening ones
     are gone and say why: a recording says one of the names, and the next
     asking wants another. */
  const tryLabels = [...document.querySelectorAll(".at-try")].map((b) => b.getAttribute("aria-label") || "");
  check("a card whose words change cannot be asked by ear, and says so",
    tryLabels.some((l) => /^Listen/.test(l) && /words that don't change/.test(l)),
    tryLabels.filter((l) => /^Listen/.test(l)).join(" | ") || "(no listening exercises listed)");
  check("and everything that reads it is still offered",
    tryLabels.some((l) => /^Try English →/.test(l)) && tryLabels.some((l) => /^Try Arabic script → English$/.test(l)),
    tryLabels.join(" | "));

  const toScript = [...document.querySelectorAll(".at-try")]
    .find((b) => /^Try English →/.test(b.getAttribute("aria-label") || ""));
  click(toScript);
  await sleep(600);

  const asked = () =>
    ((document.querySelector('[data-el="question-prompt"]') || {}).textContent || "").replace(/\s+/g, " ").trim();
  check("the question is asked with the hole filled in",
    asked() === "My name is Raphael", asked() || "(no prompt)");
  check("and nothing of the frame is left showing",
    !/[{}]/.test(asked()), asked());

  /* The marking is looking at the same person. Typing the name that was
     shown is right; typing the other one — a real card, a real name, the
     one this question did not ask about — is not. */
  const answerBox = document.querySelector('[data-el="answer-input"]');
  const setValue = must(
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
    "the input's value descriptor",
  ).set;
  const answer = (/** @type {string} */ value) => {
    must(setValue, "the input's value setter").call(answerBox, value);
    if (answerBox) answerBox.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  answer("اسمي رافائيل");
  await sleep(60);
  click(buttonNamed(/^Check$/));
  await sleep(300);
  check("the answer is marked against the name the question showed",
    /Correct|Good job|Nicely done|Great/.test(
      (document.querySelector('[data-el="verdict"]') || {}).textContent || ""
    ),
    (document.querySelector('[data-el="verdict"]') || {}).textContent || "(no verdict)");
  click(buttonNamed(/^Continue$/));
  await sleep(700);

  /* And the other name is a card in its own right on this device, which is
     never asked as a question of its own. */
  const stored = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
  const held = (stored.items || []).find((/** @type {any} */ i) => i.id === "srv" + viktor.id);
  check("a value is held like any card, and practised like none",
    !!held && JSON.stringify(held.fills) === JSON.stringify(["name"]) && held.drill === false,
    held ? `fills=${JSON.stringify(held.fills)} drill=${held.drill}` : "not on the device");
}

/* ---- one set of controls over every card list ----
   The Cards tab and an open deck show the same material and were two
   different screens about it: the tab could be sorted and narrowed, the deck
   could do neither, and Select was an unlabelled icon up in the search row.
   Both now carry the same two rows — New card, search and the size button,
   then Select, Sort and Filter — and the same settings, so a deck opened
   while the list is narrowed opens narrowed the same way. */
{
  const frame = must(document.querySelector(".at-screen.bare"), "the teaching space's frame");
  /* The last one in the document: the learner's nav is still behind this. */
  const tabNamed = (/** @type {RegExp} */ re) =>
    [...frame.querySelectorAll("button")].filter((b) => re.test((b.textContent || "").trim())).pop();
  const rows = () => [...frame.querySelectorAll(".at-toolbar")];
  const subRow = () => frame.querySelector(".at-toolbar-sub");
  /* The label a button carries, without the count riding inside it: a
     narrowed Filter reads "Filter1" to textContent, and what is being
     checked here is the order of the three. */
  const named = (/** @type {Element | null} */ row) =>
    row
      ? [...row.querySelectorAll("button")].map((b) =>
          [...b.childNodes]
            .filter((n) => !(n.nodeType === 1 && /** @type {any} */ (n).classList.contains("at-filtercount")))
            .map((n) => n.textContent || "")
            .join("")
            .trim()
        )
      : [];
  const menuBtn = (/** @type {RegExp} */ re) =>
    /** @type {any} */ (
      [...frame.querySelectorAll(".at-menubtn")].find((b) => re.test((b.textContent || "").trim())) || {}
    );
  const tiles = () => frame.querySelectorAll(".at-cardgrid .at-minicard").length;
  /* Whatever this finds, it is a DOM node or nothing — the walk asks it for
     attributes and styles, which is what the cast is for. */
  const one = (/** @type {string} */ sel, /** @type {any} */ root) =>
    /** @type {any} */ ((root || document).querySelector(sel) || null);

  click(tabNamed(/^Cards$/));
  await sleep(500);

  check("a card list's controls are two rows, not one",
    rows().length === 2, `${rows().length} rows`);
  const top = /** @type {any} */ (rows()[0]);
  check("the first row is New card, the search box and the size button",
    !!top && /New card/.test(top.textContent || "") &&
      !!top.querySelector("input.at-search") && !!top.querySelector(".at-sizebtn"),
    top ? (top.textContent || "").replace(/\s+/g, " ").trim() + ` · ${top.querySelectorAll("input, button").length} controls` : "no row");
  const sizeName = () => {
    const btn = one(".at-sizebtn", null);
    return btn ? btn.getAttribute("aria-label") || "" : "(no size button)";
  };
  check("and the size button says which size it is at and what pressing it does",
    /^Card size: Small — press for medium$/.test(sizeName()), sizeName());
  check("the second row is Select, Sort and Filter, in that order",
    named(subRow()).join(" | ") === "Select | Sort | Filter",
    named(subRow()).join(" | ") || "(no second row)");

  /* Each menu opens onto its own panel, and only one is open: two panels at
     once is two answers to "why is this list short". */
  click(menuBtn(/^Sort/));
  await sleep(200);
  const sortLabels = () =>
    [...frame.querySelectorAll(".at-listmenu .at-filterlabel")].map((s) => (s.textContent || "").trim());
  check("Sort opens onto how to order the list, and nothing else",
    sortLabels().join(" | ") === "Sort | Order", sortLabels().join(" | ") || "(nothing open)");
  click(menuBtn(/^Filter/));
  await sleep(200);
  check("and Filter replaces it rather than standing beside it",
    frame.querySelectorAll(".at-listmenu").length === 1 &&
      sortLabels().join(" | ") === "Recordings | Forms | Decks | Blanks",
    `${frame.querySelectorAll(".at-listmenu").length} panels · ${sortLabels().join(" | ")}`);

  /* ---- and by a blank, from either side of it ----
     A blank has two sides and a teacher wants both: the sentences it is a
     hole in, and the words that go in the hole. The filter could name only
     the second — it could say which words fill {{name}} and not which cards
     ask for one — which is half an answer to "what is going on with this
     blank". */
  const all = tiles();
  check("every card is listed before either filter is used", all >= 3, `${all} tiles`);
  const sideLabel = '[role="group"][aria-label="Which side of a blank a card is on"] .at-seg';
  const sides = () => [...frame.querySelectorAll(sideLabel)]
    .map((b) => (b.textContent || "").trim());
  const blankSide = (/** @type {RegExp} */ re) =>
    [...frame.querySelectorAll(sideLabel)].find((b) => re.test((b.textContent || "").trim()));
  check("the filter asks which side of a blank a card is on",
    sides().join(" | ") === "Any card | Leaves one | Fills one | Fills none",
    sides().join(" | ") || "(no blanks filter)");

  /* The words other cards borrow. */
  click(blankSide(/^Fills one$/));
  await sleep(250);
  const values = tiles();
  check("choosing the filling side shows the values and nothing else",
    values > 0 && values < all, `${values} of ${all}`);
  /* The blanks themselves are listed, read off the cards that wrote them,
     each saying what it is worth on both sides. */
  const blankRow = () => /** @type {any} */ (
    [...frame.querySelectorAll(".at-listmenu .at-tickrow")]
      .find((r) => /^name\b/.test((((r.querySelector("b") || {}).textContent) || "").trim())) || null);
  check("and the blanks are there to pick from, named and counted from both sides",
    !!blankRow() && /left by .*card/.test(blankRow().textContent || "") &&
      /filled by .*card/.test(blankRow().textContent || ""),
    blankRow() ? (blankRow().textContent || "").replace(/\s+/g, " ").trim()
      : [...frame.querySelectorAll(".at-listmenu .at-tickrow")]
          .map((r) => (r.textContent || "").slice(0, 12)).join(" | ") || "no blanks listed");
  click(blankRow() && blankRow().querySelector("input"));
  await sleep(250);
  const filling = tiles();
  check("ticking one narrows to the cards that fill it",
    filling > 0 && filling <= values, `${filling} of ${values} values`);

  /* And the same blank from the other side: the sentences with the hole in
     them, which is the half that did not exist. The tick stays put, because
     it is the same blank being asked about either way. */
  click(blankSide(/^Leaves one$/));
  await sleep(250);
  const leaving = tiles();
  check("and the same blank the other way round shows the cards that leave it",
    leaving > 0 && leaving < all, `${leaving} of ${all}`);
  /* Never the same card: one with a hole in it fills nothing, whatever it
     says, so the two sides of a blank cannot both hold one. */
  const leftText = [...frame.querySelectorAll(".at-minicard")]
    .map((t) => (t.textContent || "").replace(/\s+/g, " ").trim());
  check("and they are the sentences, not the words — never both",
    [...frame.querySelectorAll(".at-minicard")].every((t) =>
      [...t.querySelectorAll(".at-slot")].some((n) => (n.textContent || "").trim() === "name")),
    leftText.join(" | ").slice(0, 120) || "(nothing listed)");

  /* And the other way: everything that is not a value, which is the
     material a student is actually asked about. */
  click(blankSide(/^Fills none$/));
  await sleep(250);
  check("and fills-none leaves the values out",
    tiles() === all - values, `${tiles()} ordinary, ${values} values, ${all} in all`);
  click(blankSide(/^Any card$/));
  await sleep(250);
  check("and putting it back shows every card again", tiles() === all, `${tiles()} of ${all}`);

  /* ---- the deck filter ----
     Which decks a card is in, or is not in. A mode with nothing ticked
     narrows nothing: it is the state the filter is in until the first box is
     ticked, and emptying the list in the meantime would read as a list that
     had lost its cards. */
  const deckMode = (/** @type {RegExp} */ re) =>
    [...frame.querySelectorAll('[role="group"][aria-label="In or out of the chosen decks"] .at-seg')]
      .find((b) => re.test((b.textContent || "").trim()));
  check("the filter offers in, not in, or any deck at all",
    [...frame.querySelectorAll('[role="group"][aria-label="In or out of the chosen decks"] .at-seg')]
      .map((b) => (b.textContent || "").trim()).join(" | ") === "Any deck | In these | Not in these",
    [...frame.querySelectorAll('[role="group"][aria-label="In or out of the chosen decks"] .at-seg')]
      .map((b) => (b.textContent || "").trim()).join(" | ") || "(no deck filter)");
  click(deckMode(/^Not in these$/));
  await sleep(200);
  check("picking a mode with no deck ticked leaves the list alone",
    tiles() === all, `${tiles()} of ${all} still listed`);
  const lesson1 = /** @type {any} */ (
    [...frame.querySelectorAll(".at-listmenu .at-tickrow")].find((r) => /Lesson 1/.test(r.textContent || ""))
  );
  check("and the decks are there to tick, with how many cards each holds",
    !!lesson1 && /card/.test(lesson1.textContent || ""),
    lesson1 ? (lesson1.textContent || "").replace(/\s+/g, " ").trim() : "no decks listed");
  click(lesson1 && lesson1.querySelector("input"));
  await sleep(250);
  const outside = tiles();
  check("ticking one shows the cards that are in no deck of that name",
    outside > 0 && outside < all, `${outside} of ${all}`);
  check("and the Filter button says the list is narrowed",
    /1/.test(menuBtn(/^Filter/).textContent || "") &&
      !!menuBtn(/^Filter/).classList &&
      menuBtn(/^Filter/).classList.contains("on"),
    menuBtn(/^Filter/).textContent || "(no filter button)");
  /* The other way round shows exactly the rest of them: "in" and "not in"
     are two halves of the same cut. */
  click(deckMode(/^In these$/));
  await sleep(250);
  check("the other way round shows the rest, and the two make the whole",
    tiles() === all - outside, `${tiles()} in, ${outside} out, ${all} in total`);
  /* ---- and the same controls over one deck ----
     Including the filter still in force, which is the point of one setting
     for both. */
  click(tabNamed(/^Decks$/));
  await sleep(500);
  const deckTile = [...frame.querySelectorAll(".at-deckcard, .at-minicard, .at-tile")]
    .find((t) => /Lesson 1/.test(t.textContent || ""));
  check("the teacher's decks are there to open", !!deckTile,
    [...frame.querySelectorAll(".at-deckcard, .at-minicard, .at-tile")]
      .map((t) => (t.textContent || "").slice(0, 14)).join(" | ") || "no decks");
  click(deckTile);
  await sleep(500);
  check("an open deck carries the same two rows",
    [...document.querySelectorAll(".at-toolbar")].length >= 2 &&
      named(document.querySelector(".at-toolbar-sub")).join(" | ") === "Select | Sort | Filter",
    named(document.querySelector(".at-toolbar-sub")).join(" | ") || "(no second row)");
  check("and the same filter, still in force",
    !!document.querySelector(".at-menubtn.on"),
    [...document.querySelectorAll(".at-menubtn")].map((b) => (b.textContent || "").trim()).join(" | "));

  /* Bigger cards: fewer to a row, each with its words set larger. The grid
     carries the scale, so one variable moves both. */
  const scale = () => {
    const g = one(".at-cardgrid", null);
    return g ? g.style.getPropertyValue("--tile") : "";
  };
  const sizeBtn = () => one(".at-sizebtn", null);
  check("the tiles start at the size they have always been", !scale(), scale() || "(no scale set)");
  click(sizeBtn());
  await sleep(200);
  check("pressing the size button draws them bigger", Number(scale()) > 1, scale() || "(no scale set)");
  check("and the button now offers the next size up",
    /Medium — press for large/.test(sizeName()), sizeName());
  /* Kept on the device: a teacher who wants big cards wants them on the next
     screen too, and on the next visit. */
  check("the size is remembered on the device, not in the document",
    localStorage.getItem("arabic-trainer-tile-size") === "1",
    String(localStorage.getItem("arabic-trainer-tile-size")));
  click(sizeBtn());
  await sleep(150);
  click(sizeBtn());
  await sleep(150);
  check("and it comes back round to where it started rather than running out",
    !scale() && localStorage.getItem("arabic-trainer-tile-size") === "0",
    `${scale() || "(no scale)"} · stored ${localStorage.getItem("arabic-trainer-tile-size")}`);
}

/* ---- a deck whose cards accept two spellings ----
   The bug: Start session did nothing at all. The screen rendered, the
   count of what was ready was right, and pressing the button was a no-op
   — because the press threw, and a throw inside a click handler leaves
   the page exactly as it was.

   A second accepted answer is scheduled in its own right under its own key
   ("ar2en@1"), and that key is deliberately not written to the document
   until it is answered — which is what let the change introducing it leave
   every existing document untouched. So the key exists and the state
   behind it does not, and the session builder read `.due` straight off it.

   Every walk above runs on cards that accept one spelling, which is why
   none of them saw this, and why one deployment could be dead on the one
   button that matters while another, on the same build, was fine: it is
   the material that differs, not the code.

   Mounted on its own document, at the end, so that nothing above it has to
   be re-counted to make room for a card the rest of the fixture never had. */
{
  root.unmount();
  await sleep(200);
  const before = errors.length;
  /* Two spellings for one meaning, in the convention a teacher types: the
     alternatives separated, positionally paired with their pronunciations.
     No schedule at all on either card, which is the ordinary state of a
     deck that has just arrived — and the state in which both the record
     and the key behind it are missing. */
  const twoWays = (/** @type {string} */ id, /** @type {string} */ ar, /** @type {string} */ en, /** @type {string} */ lat) =>
    ({ id, ar, en, lat, kind: "word", tags: ["Lesson 1"], created: 1, updated: Date.now() });
  localStorage.setItem("arabic-trainer:arabic-trainer-v3", JSON.stringify({
    version: 3, tombstones: {}, log: {},
    settings: { language: "ar-PS" },
    account,
    items: [
      twoWays("twoways1", "سفر / رحلة", "journey", "safar / riHla"),
      twoWays("twoways2", "بيت / دار", "house", "beit / daar"),
    ],
  }));
  const host2 = document.createElement("div");
  document.body.appendChild(host2);
  const root2 = createRoot(host2);
  root2.render(React.createElement(App));
  await sleep(1500);

  const startBtn = [...host2.querySelectorAll("button")]
    .find((b) => /^Start session$/.test((b.textContent || "").trim()));
  check("a deck of two-spelling cards offers a session to start", !!startBtn && !startBtn.disabled,
    startBtn ? "the button is there but dimmed"
      : (host2.textContent || "").slice(0, 90).replace(/\s+/g, " ") || "nothing rendered");
  click(startBtn);
  await sleep(600);
  /* The whole of the report: the button did something. */
  const asked = host2.querySelector(".at-instruction");
  check("pressing Start session on them starts a session rather than doing nothing",
    !!asked, (host2.textContent || "").slice(0, 120).replace(/\s+/g, " "));
  check("and nothing threw while the session was built",
    errors.length === before, errors.slice(before, before + 2).join(" | "));
  root2.unmount();
  await sleep(200);
}

/* ---- a deck with something actually going wrong ----
   The weak-skills session, end to end: a deck of four ordinary cards, one
   of which has been missed twice running on reading it into English and is
   fine at everything else. The button should come up live rather than
   dimmed, open a session, and that session should be about that card — not
   the three the learner has never got wrong.

   On its own document at the end, for the same reason the walk above is:
   nothing here has to be counted against a fixture the rest of the file
   shares. */
{
  const before = errors.length;
  /* The history is the record with an order to it: 1 right, 0 wrong, most
     recent last. Two zeros on the end is wrong, seen again, wrong again —
     which is what the app calls a gap rather than a slip. */
  const missedTwice = {
    phase: "review", step: 0, ease: 2.0, interval: 1, due: Date.now() - 86400000,
    reps: 4, lapses: 1, right: 2, wrong: 2, skips: 0, near: 0, hints: 0,
    hist: [1, 1, 0, 0], updated: Date.now(),
  };
  const plain = (/** @type {string} */ id, /** @type {string} */ ar, /** @type {string} */ en, /** @type {string} */ lat, /** @type {any} */ s) =>
    ({ id, ar, en, lat, kind: "word", tags: ["Lesson 1"], created: 1, updated: Date.now(), ...(s ? { s } : null) });
  localStorage.setItem("arabic-trainer:arabic-trainer-v3", JSON.stringify({
    version: 3, tombstones: {}, log: {},
    settings: { language: "ar-PS" },
    account,
    items: [
      plain("weak1", "كِتاب", "book", "kitaab", { ar2en: missedTwice }),
      plain("fine1", "قَلَم", "pen", "qalam", null),
      plain("fine2", "بَيت", "house", "beit", null),
      plain("fine3", "باب", "door", "baab", null),
    ],
  }));
  /* Mounted offline, which is the only way to hold the deck still: a
     signed-in device pulls its courses down over what was seeded, and the
     cards the rest of this file has been answering arrive carrying the
     histories those answers wrote. The count is the point of the walk, so
     the deck has to be the four cards written above and no others. */
  const online = Object.getOwnPropertyDescriptor(w.navigator, "onLine");
  Object.defineProperty(w.navigator, "onLine", { value: false, configurable: true });
  const host3 = document.createElement("div");
  document.body.appendChild(host3);
  const root3 = createRoot(host3);
  root3.render(React.createElement(App));
  await sleep(1500);

  const weakBtn = [...host3.querySelectorAll("button")]
    .find((b) => /^Weak skills$/.test((b.textContent || "").trim()));
  check("a card missed twice running lights the weak-skills button",
    !!weakBtn && weakBtn.getAttribute("aria-disabled") !== "true",
    weakBtn ? "the button is there but dimmed"
      : (host3.textContent || "").slice(0, 90).replace(/\s+/g, " ") || "nothing rendered");
  const row = weakBtn && weakBtn.closest(".at-row");
  check("and says nothing beside it, now that there is something to fix",
    !!row && !/slipping/.test((row.textContent || "").replace(/\s+/g, " ")),
    row ? (row.textContent || "").replace(/\s+/g, " ") : "no row");

  click(weakBtn);
  await sleep(600);
  const asked = host3.querySelector(".at-instruction");
  check("pressing it opens a session", !!asked,
    (host3.textContent || "").slice(0, 120).replace(/\s+/g, " "));
  /* And the session is about the word that is going wrong. The three cards
     this learner has never missed are not in it, which is the whole of
     what the button promises. */
  const prompt = host3.querySelector('[data-el="question-prompt-text"]');
  check("and it asks the card that is going wrong, not the ones that are fine",
    !!prompt && /كِتاب/.test(prompt.textContent || ""),
    prompt ? (prompt.textContent || "").trim() : (host3.textContent || "").slice(0, 120).replace(/\s+/g, " "));
  check("and nothing threw while the weak session was built",
    errors.length === before, errors.slice(before, before + 2).join(" | "));
  if (online) Object.defineProperty(w.navigator, "onLine", online);
}

/* ---- the number system's own screen ----

   Driven directly rather than through the teaching space, which this
   harness does not mount: it is a plain component over a document, which
   is most of why it is one.

   What is worth checking is the loop the screen exists for. A word typed
   into a box changes what a student would be asked, on the same line, at
   once — the preview is the composer and not a second idea of it — and a
   line that is wrong can be tapped and written out by hand. Everything
   else on that screen is a list of boxes. */
{
  const { NumberSystemEditor } = await import(path.join(out, "number-system-editor.js"));
  const { LANGUAGES } = await import(path.resolve("src/languages.ts"));
  const { emptyNumberSystem } = await import(path.resolve("src/numbers/schema.ts"));

  const host = document.createElement("div");
  document.body.appendChild(host);
  const editorRoot = createRoot(host);
  /** What the screen handed back, every time Save was pressed. */
  const saves = /** @type {{ kind: string, sys: any }[]} */ ([]);
  const system = emptyNumberSystem("n1", "lena", "ar-PS", Date.now(), 1);

  const draw = (/** @type {any} */ numbers) =>
    editorRoot.render(
      React.createElement(NumberSystemEditor, {
        lang: LANGUAGES["ar-PS"],
        numbers,
        times: null,
        onSave: (/** @type {string} */ kind, /** @type {any} */ sys) => {
          saves.push({ kind, sys });
        },
        onClose() {},
      }),
    );

  /* A screen is drawn at the app's root rather than where it was written:
     it portals out, so that it stays inside the theme and outside whatever
     layer the space that opened it sits in. So the boxes are never under
     the div this mounted into, and looking there would find an empty
     screen that is in fact drawn and working.

     Named, because this walk steps through three of them: the grid, the
     screen one number is written out on, and the one a number is tried on.
     Asking for "the screen" would find whichever was drawn first and quietly
     pass while the wrong one was up. */
  const screenNamed = (/** @type {string} */ name) =>
    document.querySelector(`.at-screen[aria-label="${name}"]`);
  const panel = () => screenNamed("Number system") || host;
  /* Whichever of them is up. The last one in the document, because a
     portal appends: earlier blocks of this walk left their own screens
     mounted, and asking for the first would find a teaching screen from
     half an hour ago and quietly agree with everything asked of it. */
  const up = () => {
    const all = [...document.querySelectorAll(".at-screen")];
    return all[all.length - 1] || host;
  };

  draw(system);
  await sleep(200);
  check("the number system's editor opens on a grid of boxes",
    panel().querySelectorAll(".at-numrow").length > 20,
    `${panel().querySelectorAll(".at-numrow").length} rows`);
  check("and says nothing can be asked yet",
    /waiting on|not yet/.test(panel().textContent || ""),
    (panel().textContent || "").slice(0, 160).replace(/\s+/g, " "));

  /* One word typed into a box, and the line for that number says it. The
     preview is the composer itself, so there is nothing here that could be
     right while what a student meets is wrong. */
  const boxNamed = (/** @type {string} */ name) =>
    [...up().querySelectorAll("input")].find((i) => i.getAttribute("aria-label") === name);
  const buttonIn = (/** @type {RegExp} */ re) =>
    [...up().querySelectorAll("button")].find((b) => re.test((b.textContent || "").trim()));
  const typeIn = (/** @type {any} */ box, /** @type {string} */ text) => {
    const setValue = must(
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value"),
      "the input's value descriptor"
    ).set;
    must(setValue, "the input's value setter").call(box, text);
    box.dispatchEvent(new w.Event("input", { bubbles: true }));
  };

  const sevenBox = boxNamed("7, counting");
  check("and every box is named by the number it is and the face of it",
    !!sevenBox,
    [...panel().querySelectorAll("input")].slice(0, 4)
      .map((i) => i.getAttribute("aria-label")).join(" | "));
  if (sevenBox) {
    typeIn(sevenBox, "sab3a");
    await sleep(200);
  }

  const rows = [...panel().querySelectorAll(".at-numsamplerow")];
  const seven = rows.find((r) => (r.querySelector(".at-numfig") || {}).textContent === "7");
  check("a word typed into a box is what the preview says for that number",
    !!seven && /sab3a/.test(seven.textContent || ""),
    seven ? (seven.textContent || "").trim() : `${rows.length} preview rows`);

  /* A number the system cannot finish yet is marked as such, greyed,
     rather than showing the half of it it managed as though that were the
     answer. Nothing else on the screen is written down twice, so a row
     that looked finished would be the screen saying this language calls
     47 "seven". */
  const partRows = [...panel().querySelectorAll(".at-numsamplerow[data-part]")];
  check("a number it cannot say in full yet says so on the line",
    partRows.length > 10 && /not yet/.test((partRows[0] || {}).textContent || ""),
    `${partRows.length} of ${rows.length} marked · ${((partRows[0] || {}).textContent || "").trim()}`);
  check("and the one it can say is not marked",
    !!seven && !seven.hasAttribute("data-part"),
    seven ? (seven.textContent || "").trim() : "(no row)");

  /* And a filled box asks how it sounds, on the same condition the Record
     button appears on: there is a word here to say. */
  const sevenLat = boxNamed("Transliteration for 7, counting");
  check("a box with a word in it asks how the word sounds",
    !!sevenLat,
    [...panel().querySelectorAll("input")].map((i) => i.getAttribute("aria-label"))
      .filter((l) => l && /Transliteration/.test(l)).slice(0, 3).join(" | ") || "(none asked)");
  check("and an empty box is not asked, because there is nothing to sound like",
    !boxNamed("Transliteration for 8, counting"));
  if (sevenLat) {
    typeIn(sevenLat, "sabʕa");
    await sleep(200);
  }

  /* A line that is wrong is tapped, and that is a screen of its own now
     rather than a block unfolding under the list. */
  click(seven);
  await sleep(250);
  check("tapping a line opens a screen for writing that number out",
    !!screenNamed("7, written out"),
    ((up().getAttribute && up().getAttribute("aria-label")) || "(no screen)"));
  check("which says what the app makes of it by itself, to be corrected against",
    /What the app says now/.test(up().textContent || "") && /sab3a/.test(up().textContent || ""),
    (up().textContent || "").slice(0, 160).replace(/\s+/g, " "));

  const outBox = boxNamed("7 in Palestinian Arabic");
  check("and a box to write what it should say", !!outBox);
  if (outBox) {
    typeIn(outBox, "sabʕa-wahde");
    await sleep(200);
  }
  check("which asks how that sounds too, once there is something to sound like",
    !!boxNamed("Transliteration for 7"));

  const keep = buttonIn(/^Keep it$/);
  check("and the footer keeps it", !!keep);
  if (keep) {
    click(keep);
    await sleep(250);
    check("which puts the grid back with it filed among the numbers you wrote out",
      !!screenNamed("Number system") && /Numbers you wrote out/.test(panel().textContent || ""),
      (panel().textContent || "").slice(0, 200).replace(/\s+/g, " "));
  }

  /* And the third screen: type a number, see it said. */
  click(buttonIn(/^Try a number$/));
  await sleep(250);
  check("there is a screen for trying a number out",
    !!screenNamed("Try a number"),
    ((up().getAttribute && up().getAttribute("aria-label")) || "(no screen)"));
  const tryBox = boxNamed("A number to try, in figures");
  check("with one box, for figures", !!tryBox);
  if (tryBox) {
    typeIn(tryBox, "7");
    await sleep(200);
    check("and what is typed comes back said in the words the teacher wrote",
      /sabʕa-wahde/.test(up().textContent || ""),
      (up().textContent || "").slice(0, 200).replace(/\s+/g, " "));
    typeIn(tryBox, "8");
    await sleep(200);
    check("a number it cannot say yet says what it is waiting for instead",
      /waiting on/.test(up().textContent || ""),
      (up().textContent || "").slice(0, 200).replace(/\s+/g, " "));
  }
  click(buttonIn(/^Back$/) || (up().querySelector && up().querySelector(".at-back")));
  await sleep(250);
  check("and coming back leaves the grid as it was",
    !!screenNamed("Number system") && panel().querySelectorAll(".at-numrow").length > 20);

  const save = buttonIn(/^Save$/);
  check("and the footer offers to save once something has changed", !!save);
  if (save) {
    click(save);
    await sleep(200);
    const saved = saves[saves.length - 1];
    check("saving hands back a number system", !!saved && saved.kind === "numbers",
      saved ? saved.kind : "nothing saved");
    check("with the word that was typed, how it sounds, and the line that was written out",
      !!saved &&
        ((saved.sys.lexemes["unit.7"] || { forms: {} }).forms.standalone === "sab3a") &&
        ((saved.sys.lexemes["unit.7"] || { lat: {} }).lat || {}).standalone === "sabʕa" &&
        (saved.sys.overrides["7"] || {}).text === "sabʕa-wahde",
      saved
        ? `${JSON.stringify(saved.sys.lexemes["unit.7"])} · ${JSON.stringify(saved.sys.overrides)}`
        : "nothing saved");
  }

  editorRoot.unmount();
  host.remove();
}

report();
console.log("\nrequests:", calls.join("\n          "));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
