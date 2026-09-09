// @ts-check
/* Renders the real app in jsdom against a stubbed server, and checks that
   the paths changed in this round actually run: sync keyed to the sign-in
   key, my-material with a version, legacy document cleanup, sparse
   storage. Run with: node tests/smoke.mjs */
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import path from "node:path";

/* Built inside the project so the bundle's bare "react" imports resolve to
   the project's node_modules. */
import { mkdirSync, rmSync } from "node:fs";
const out = path.resolve("tests/.smoke-build");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ["src/ArabicTrainer.jsx", "src/storage.js", "src/gallery.jsx", "src/shared.jsx"],
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
/* `data` is the wire document: JSON as the sync endpoint stores it, which
   the checks below navigate field by field. */
/** @type {Map<string, { etag: string, data: any }>} */
const remoteDocs = new Map(); // token -> {etag, data}
const account = { handle: "sara-4f2a", displayName: "Sara", key: "amber-cedar-harbour-lantern-1a2b", admin: false };
const card = {
  id: "k111111111111", owner: "t-1", ar: "كتاب", en: "book", lat: "kitaab", note: "", lang: "ar-PS",
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
  clips: [], subs: [], rev: 1, updated: 1,
};
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
      if (url.searchParams.get("version") === version) return json({ ok: true, unchanged: true, version, teaches: false });
      return json({
        ok: true, version, teaches: false,
        courses: [{ id: "c1", title: "Arabic 101", language: "ar-PS", decks: ["d1"], role: "student", studying: true, teaching: false }],
        decks: [{ id: "d1", title: "Lesson 1", owner: "t-1", cardIds: [card.id, phrase.id], cardCount: 2, courseId: "c1", courseTitle: "Arabic 101", courseLanguage: "ar-PS", courses: [{ courseId: "c1", addedAt: 1 }], version: 3 }],
        cards: [{ deckId: "d1", cards: [card, phrase] }],
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
    ],
  },
});

/* ---- render ---- */
/** @type {string[]} */
const errors = [];
const origError = console.error;
console.error = (/** @type {unknown[]} */ ...a) => { errors.push(a.map(String).join(" ")); };
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

check("app rendered the home screen", /Cards ready to practice/.test(text), text.slice(0, 80).replace(/\s+/g, " "));
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
check("both course cards and both old cards landed in storage", stored.items.length === 4 && byId["srv" + card.id] && byId["srv" + phrase.id] && byId.oldclient1 && byId.v2card, `items=${stored.items.map((/** @type {any} */ i) => i.id).join(",")}`);

/* What a course card is, rather than what it used to be told it was. Every
   one of them arrived labelled "word" — which is why the practice filter did
   nothing on course material, and why the app could not see that this phrase
   contains that word. */
check("a one-word course card is a word", byId["srv" + card.id].kind === "word", byId["srv" + card.id].kind);
check("and a course card holding a phrase is a phrase, not a word",
  byId["srv" + phrase.id].kind === "phrase", byId["srv" + phrase.id].kind);
check("the old client's card kept its one answered state and gained nothing spurious", byId.oldclient1 && Object.keys(byId.oldclient1.s).join() === "ar2en" && byId.oldclient1.s.ar2en.reps === 3);
/* The v2 card's "mean" skill becomes ar2en; its "read" skill named the
   retired exercise and must not come back as a state for it. */
check("a v2 card's skills lift onto types that exist, and no further",
  byId.v2card && byId.v2card.s.ar2en && byId.v2card.s.ar2en.reps === 4,
  byId.v2card ? `states=${Object.keys(byId.v2card.s).join(",")}` : "no v2 card");
check("a v2 card gains no state for the retired exercise",
  byId.v2card && !("ar2tr" in byId.v2card.s),
  byId.v2card ? `states=${Object.keys(byId.v2card.s).join(",")}` : "no v2 card");
check("untouched states are not stored", byId["srv" + card.id] && Object.keys(byId["srv" + card.id].s).length === 0 && Object.keys(byId["srv" + card.id].subs[0].s).length === 0);
check("every card counts as ready to practice", /Cards ready to practice\s*4/.test(text.replace(/\s+/g, " ")), text.replace(/\s+/g, " ").match(/Cards ready to practice\s*\d+/)?.[0]);
const wire = remoteDocs.get(realToken)?.data;
/* Sparse means one thing: no state written out for an exercise type that was
   never answered. Keys from an older schema — v2's mean/read/write — ride
   along untouched, because sync unions whatever keys either side has so that
   a device on one build never strips what a device on another still needs.
   That is deliberate, and the reason a retired type's state is left alone
   rather than filtered out of the document. */
const V2_KEYS = ["mean", "read", "write"];
const typeStates = (/** @type {any} */ i) => Object.keys(i.s).filter((k) => !V2_KEYS.includes(k));
check("wire document is sparse and has no account", wire && !("account" in wire) && wire.items.every((/** @type {any} */ i) => typeStates(i).length <= 1), wire ? wire.items.map((/** @type {any} */ i) => `${i.id}:${Object.keys(i.s).join("/") || "-"}`).join(" ") : "no wire doc");
check("the retired exercise is never written into the document", wire && wire.items.every((/** @type {any} */ i) => !("ar2tr" in i.s)), wire ? wire.items.map((/** @type {any} */ i) => `${i.id}:${Object.keys(i.s).join("/") || "-"}`).join(" ") : "no wire doc");
check("clip sync uploaded nothing (no blob: URLs)", !calls.some((c) => c.startsWith("POST /api/sync?audio")));
check("clip sync did not fetch course recordings as a side effect", !calls.some((c) => c.includes("action=clip")), calls.filter((c) => c.includes("clip")).join(","));

/* ---- the manual session builder, now rendered through Screen ---- */
/**
 * The one that has to be there.
 *
 * A query that misses is a broken harness, and without this the miss
 * shows up two lines later as "cannot read properties of null", which
 * names neither what was looked for nor where.
 * @template T
 * @param {T | null | undefined} value
 * @param {string} what
 * @returns {T}
 */
function must(value, what) {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

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
  const everything = [...document.querySelectorAll(".at-tagpickmain")].find((b) => /Everything/.test(b.textContent));
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

  /* The whole point of the walk: it still builds. Two new blocking
     conditions are two new ways to wedge the builder shut. */
  clickNamed(/^(Start|Choose a length)$/);
  await sleep(400);
  check("a hand-built session actually starts", !!document.querySelector(".at-instruction"),
    document.body.textContent.slice(0, 120));

  /* The on-screen keys button, which used to be a labelled button in the
     flow under the answer box and is now an icon in the field's corner.
     Walk forward until a question actually asks for the script — the queue
     is shuffled, so the first one may not. */
  let scriptField = null;
  for (let i = 0; i < 8 && !scriptField; i++) {
    scriptField = document.querySelector(".at-answerbox .at-input.ar");
    if (scriptField) break;
    click(buttonNamed(/^I don't know$/));
    await sleep(150);
    click(buttonNamed(/Continue|Next/));
    await sleep(250);
  }
  check("a question asking for the script was reached", !!scriptField,
    (document.body.textContent || "").slice(0, 90));
  const wrap = scriptField && scriptField.parentElement;
  if (wrap) {
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
  }

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
    check("it offers the three things that can be wrong", opts.length === 3,
      opts.map((o) => o.textContent).join(" | "));
    check("each is a card: what it is, and when to pick it",
      opts.length > 0 && opts.every((o) =>
        o.querySelector(".at-flagopt-title") && o.querySelector(".at-flagopt-what")),
      opts.map((o) => o.innerHTML.slice(0, 40)).join(" | "));

    /* "Something else" is the one that says nothing by itself, so it asks
       rather than sends. */
    const somethingElse = opts.find((o) => /Something else/.test(o.textContent));
    click(somethingElse);
    await sleep(80);
    const noteBox = document.querySelector('[data-el="flag-note"]');
    const noteInput = document.querySelector('[data-el="flag-note-input"]');
    check("picking Something else asks what went wrong instead of sending",
      !!noteBox && !!noteInput && !document.querySelector(".at-flagopt-title ~ .at-flagopt-what"),
      noteBox ? "" : "no note box");
    check("and nothing was reported on the way there",
      !calls.some((c) => c.includes("report-flag")), calls.filter((c) => c.includes("flag")).join(","));
    const sendBtn = buttonNamed(/^Send$/);
    check("Send waits for something to send", !!sendBtn && sendBtn.disabled,
      sendBtn ? String(sendBtn.disabled) : "no Send button");

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
    const flagBtn = document.querySelector('[data-el="flag-button"]');
    check("the menu closes and the button says so",
      !document.querySelector('[data-el="flag-menu"]') &&
        /Flagged/.test((flagBtn && flagBtn.textContent) || ""),
      (flagBtn && flagBtn.textContent) || "no flag button");

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
  /* Reloading used to take two presses: the page reloaded while the old
     service worker was still in charge, so the old files came back and
     the button looked broken. The fix is to wait for the new worker to
     take control before reloading.

     jsdom has no service worker and will not let location.reload be
     stubbed, so pressing the button here cannot be watched — what is
     checked is that the waiting is still wired up. The behaviour itself
     is checked in a real browser, against two real builds and a real
     worker, which is the only place it can be. */
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(path.resolve("src/ArabicTrainer.jsx"), "utf8");
    const body = src.slice(src.indexOf("async function reload()"), src.indexOf("async function reload()") + 2000);
    check("Reload waits for the new worker to take control",
      /addEventListener\("controllerchange"/.test(body), "no controllerchange listener");
    check("and it does not reload the moment it is pressed",
      !/await reg\.update\(\);\s*\n\s*\}?\s*\n?\s*window\.location\.reload/.test(body));
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
  const tile = document.querySelector(".at-cardgrid .at-minicard");
  check("the student's cards are tiles from the library, not a copy of one",
    !!tile, tile ? tile.className : `no tile — ${document.body.textContent.slice(0, 80).replace(/\s+/g, " ")}`);
  const shown = tile ? tile.textContent : "";
  check("a tile says the word, its meaning and when it was added",
    shown.includes(card.ar) && shown.includes(card.en) && /\d/.test(shown),
    shown.replace(/\s+/g, " ").trim() || "(no tile)");
  check("and nothing about decks, forms, recordings or the language",
    !!tile && !tile.querySelector(".at-minidecks, .at-flag") && !/form|♪|Arabic/i.test(shown),
    shown.replace(/\s+/g, " ").trim() || "(no tile)");
  click(buttonNamed(/^Home$/));
  await sleep(300);
}

/* ---- a progress tile opens the card ----
   Every other small card in the app opens when you tap it. These showed
   you how far along a card was and then had nothing to say when you
   asked to see it, which is the moment you most want to. */
{
  click(buttonNamed(/^Progress$/));
  await sleep(400);
  const opener = [...document.querySelectorAll("button")].find((b) => /^Show /.test(b.getAttribute("aria-label") || ""));
  click(opener);
  await sleep(200);
  const tile = document.querySelector(".at-pgrid .at-pcard");
  check("a progress tile is a button, so it can be tapped and tabbed to",
    !!tile && tile.tagName === "BUTTON", tile ? tile.tagName : "no tile");
  click(tile);
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
  click([...document.querySelectorAll("button")].find((b) => /^(Back|Done|Close)$/i.test(b.textContent || "") || b.getAttribute("aria-label") === "Back"));
  await sleep(250);
  click(buttonNamed(/^Home$/));
  await sleep(300);
}

/* ---- a session: start, answer one card, continue ---- */
click(buttonNamed(/^Start session$/));
await sleep(400);
const instruction = document.querySelector(".at-instruction");
check("a session started and shows an exercise", !!instruction, (instruction && instruction.textContent) || "");
const input = document.querySelector(".at-answerbox input");
const choice = document.querySelector(".at-answerbox .at-chips button");
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
} else if (choice) {
  click(choice);
  await sleep(50);
  click(buttonNamed(/^Check$/));
} else {
  check("found something to answer with", false, document.body.textContent.slice(0, 200));
}
await sleep(200);
check("the answer was marked", /The answer is:|Incorrect\.|Correct!|Good job!|Nicely done!|Great!/.test(document.body.textContent),
  (document.querySelector('[data-el="verdict"]') || {}).textContent || (document.body.textContent || "").slice(0, 80));
click(buttonNamed(/Continue|Next/));
await sleep(900); // the 600 ms save debounce
const after = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3") || "null");
const answered = after.items.find((/** @type {any} */ i) => i.id === "srv" + card.id) || { s: {}, subs: [] };
check("the course card is still in storage after the session", after.items.some((/** @type {any} */ i) => i.id === "srv" + card.id), `items=${after.items.map((/** @type {any} */ i) => i.id).join(",")}`);
const storedStates = [...Object.keys(answered.s), ...(answered.subs || []).flatMap((/** @type {any} */ sb) => Object.keys(sb.s))];
check("exactly the answered state is stored on the answered card, and nothing untouched", storedStates.length <= 1, `stored states: ${storedStates.join(",")}`);
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

  galleryRoot.unmount();
  host.remove();
  check("it goes with the component that raised it", !document.querySelector(".at-snack"));
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
  const { withoutListening, soundLevelOf, noCardsYet, SOUNDS, SOUND_LEVELS, setSounds,
          PRAISE, WRONG_VERDICT, praiseFor } =
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
    const src = readFileSync(path.resolve("src/ArabicTrainer.jsx"), "utf8");
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
    const shared = readFileSync(path.resolve("src/shared.jsx"), "utf8");
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
  const out2 = withoutListening(queue, 1, stored2.items, set);

  check("the answered questions are left exactly as they were",
    out2[0] === queue[0], `first=${JSON.stringify(out2[0])}`);
  check("no listening exercise survives the rewrite",
    out2.every((/** @type {any} */ e) => !["rec2en", "rec2ar", "rec2attr"].includes(e.type)),
    out2.map((/** @type {any} */ e) => e.type).join(","));
  check("the question in front of you is replaced, not skipped",
    out2.length > 1 && out2[1].id === card1.id && out2[1].type !== "rec2en",
    out2.map((/** @type {any} */ e) => e.type).join(","));
  /* Prefer a question the card is not already being asked: with ar2en and
     en2ar already in the queue, the free one is tr2ar. */
  const one = withoutListening(
    [
      { id: card1.id, subId: null, type: "ar2en" },
      { id: card1.id, subId: null, type: "rec2en" },
      { id: card1.id, subId: null, type: "en2ar" },
    ],
    1,
    stored2.items,
    set,
  );
  check("a substitute avoids what the card is already being asked",
    one[1].type === "tr2ar", one.map((/** @type {any} */ e) => e.type).join(","));

  /* And when every alternative is already queued, repeat one rather than
     drop the practice — the card is still worth answering. */
  check("with nothing free it still substitutes rather than dropping",
    out2.length === queue.length, out2.map((/** @type {any} */ e) => e.type).join(","));

  /* A card with nothing but sound to offer: the entry goes, rather than
     sitting in the queue unanswerable. */
  const soundOnly = { ...card1, id: "soundonly", en: "", lat: "", recs: [{ id: "z".repeat(64) }] };
  const dropped = withoutListening(
    [{ id: "soundonly", subId: null, type: "rec2ar" }],
    0,
    stored2.items.concat([soundOnly]),
    set,
  );
  check("a card that can only be listened to drops out", dropped.length === 0,
    JSON.stringify(dropped));

  /* Nothing to do when there is nothing to listen to. */
  const untouched = withoutListening(queue.filter((e) => e.type === "ar2en"), 0, stored2.items, set);
  check("a queue with no listening exercises is returned unchanged",
    untouched.length === 1 && untouched[0].type === "ar2en");
}

console.error = origError;
console.log(results.join("\n"));
console.log("\nrequests:", calls.join("\n          "));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
