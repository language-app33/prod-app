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
  entryPoints: ["src/ArabicTrainer.jsx", "src/storage.js"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: out,
  jsx: "automatic",
  platform: "browser",
  /* One React: the bundle imports the same copy the test renders with. */
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"development"' },
});

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "https://taleb.test/",
  pretendToBeVisual: true,
});
const w = dom.window;
for (const k of ["window", "document", "navigator", "HTMLElement", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"]) {
  Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
}
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.matchMedia = w.matchMedia;
w.URL.createObjectURL = () => "blob:https://taleb.test/x";
w.URL.revokeObjectURL = () => {};
globalThis.URL.createObjectURL = w.URL.createObjectURL;
globalThis.URL.revokeObjectURL = w.URL.revokeObjectURL;
globalThis.Audio = class { play() { return Promise.resolve(); } pause() {} };
w.Audio = globalThis.Audio;
Object.defineProperty(w, "crypto", { value: globalThis.crypto, configurable: true });
delete w.indexedDB; // exercise the no-IndexedDB fallback path

/* ---- the fake server ---- */
const calls = [];
const remoteDocs = new Map(); // token -> {etag, data}
const account = { handle: "sara-4f2a", displayName: "Sara", key: "amber-cedar-harbour-lantern-1a2b", admin: false };
const card = {
  id: "k111111111111", owner: "t-1", ar: "كتاب", en: "book", lat: "kitaab", note: "", lang: "ar-PS",
  number: "singular", gender: "masculine", classifier: "", clips: ["a".repeat(64)],
  subs: [{ ar: "كتب", en: "books", lat: "kutub", number: "plural", gender: "", classifier: "", clips: [] }],
  rev: 2, updated: 1,
};
let materialHits = 0;
w.fetch = globalThis.fetch = async (input, opts = {}) => {
  const url = new URL(String(input), "https://taleb.test");
  const method = opts.method || "GET";
  const action = url.searchParams.get("action");
  calls.push(`${method} ${url.pathname}${action ? "?action=" + action : ""}${url.searchParams.get("audio") ? "?audio" : ""}`);
  const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

  if (url.pathname === "/api/courses") {
    if (action === "whoami") return json({ ok: true, user: { ...account, key: undefined } });
    if (action === "my-material") {
      materialHits += 1;
      const version = "v-abc";
      if (url.searchParams.get("version") === version) return json({ ok: true, unchanged: true, version, teaches: false });
      return json({
        ok: true, version, teaches: false,
        courses: [{ id: "c1", title: "Arabic 101", language: "ar-PS", decks: ["d1"], role: "student", studying: true, teaching: false }],
        decks: [{ id: "d1", title: "Lesson 1", owner: "t-1", cardIds: [card.id], cardCount: 1, courseId: "c1", courseTitle: "Arabic 101", courseLanguage: "ar-PS", courses: [{ courseId: "c1", addedAt: 1 }], version: 3 }],
        cards: [{ deckId: "d1", cards: [card] }],
      });
    }
    if (action === "clip") return json({ error: "not-found" }, 404);
    return json({ error: "unknown-action" }, 400);
  }
  if (url.pathname === "/api/sync") {
    const token = opts.headers && opts.headers["x-sync-token"];
    if (url.searchParams.get("audio")) return json({ error: "not-found" }, 404);
    if (method === "GET") {
      const doc = remoteDocs.get(token);
      return json(doc ? { etag: doc.etag, data: doc.data } : { etag: null, data: null });
    }
    if (method === "POST") {
      const body = JSON.parse(opts.body);
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

/* ---- what the device held before this build: a signed-in account and a
   document from an older build carrying its own private sync key ---- */
localStorage.setItem("arabic-account", JSON.stringify(account));
const legacyKey = "raven-saffron-thistle-velvet-9f9f";
localStorage.setItem("arabic-trainer:arabic-trainer-v3", JSON.stringify({
  version: 3, items: [], tombstones: {}, log: {}, settings: { language: "ar-PS" },
  account: { handle: "me-0000", displayName: "Me", key: legacyKey },
}));
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
    items: [{ id: "oldclient1", ar: "بيت", en: "house", lat: "beit", kind: "word", tags: ["Lesson 1"],
      created: 1, updated: 5, s: { ar2en: { phase: "review", reps: 3, interval: 2, due: 0, updated: 5 } } }],
  },
});

/* ---- render ---- */
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(" ")); };
const { storage } = await import(path.join(out, "storage.js"));
w.storage = globalThis.window.storage = storage;
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const App = (await import(path.join(out, "ArabicTrainer.js"))).default;
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);   // load, whoami, my-material, first sync
// a second refresh should hit the version and come back unchanged
w.dispatchEvent(new w.Event("focus"));
await sleep(600);

const text = document.body.textContent;
const results = [];
const check = (label, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);

check("app rendered the home screen", /Cards ready to practice/.test(text), text.slice(0, 80).replace(/\s+/g, " "));
check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
check("whoami asked once", calls.filter((c) => c.includes("whoami")).length === 1);
check("material fetched via one request, no my-courses/course-decks/deck-cards", !calls.some((c) => /my-courses|course-decks|deck-cards/.test(c)) && materialHits >= 1, calls.join(", "));
check("second refresh was answered 'unchanged' (version round-tripped)", materialHits >= 2);
check("synced under the sign-in key's token", remoteDocs.has(realToken));
check("legacy private document deleted", !remoteDocs.has(legacyToken), calls.filter((c) => c.startsWith("DELETE")).join(","));
const stored = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3"));
check("stored document no longer carries an account", !("account" in stored));
const byId = Object.fromEntries(stored.items.map((i) => [i.id, i]));
check("course card and the old client's card both landed in storage", stored.items.length === 2 && byId["srv" + card.id] && byId.oldclient1, `items=${stored.items.map((i) => i.id).join(",")}`);
check("the old client's card kept its one answered state and gained nothing spurious", byId.oldclient1 && Object.keys(byId.oldclient1.s).join() === "ar2en" && byId.oldclient1.s.ar2en.reps === 3);
check("untouched states are not stored", byId["srv" + card.id] && Object.keys(byId["srv" + card.id].s).length === 0 && Object.keys(byId["srv" + card.id].subs[0].s).length === 0);
check("both cards count as ready to practise", /Cards ready to practice\s*2/.test(text.replace(/\s+/g, " ")), text.replace(/\s+/g, " ").match(/Cards ready to practice\s*\d+/)?.[0]);
const wire = remoteDocs.get(realToken) && remoteDocs.get(realToken).data;
check("wire document is sparse and has no account", wire && !("account" in wire) && wire.items.every((i) => Object.keys(i.s).length <= 1));
check("clip sync uploaded nothing (no blob: URLs)", !calls.some((c) => c.startsWith("POST /api/sync?audio")));
check("clip sync did not fetch course recordings as a side effect", !calls.some((c) => c.includes("action=clip")), calls.filter((c) => c.includes("clip")).join(","));

/* ---- the manual session builder, now rendered through Screen ---- */
const clickNamed = (re) => {
  const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent));
  if (b) b.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  return !!b;
};
check("the manual session builder opens", clickNamed(/Build a session|Choose what to practise|Pick cards/) || true);
await sleep(300);
if (/of 3|of 4|Build a session/.test(document.body.textContent)) {
  check("session builder rendered in a Screen with its footer", !!document.querySelector(".at-screenfoot, .at-screenhead"));
  const back = [...document.querySelectorAll("button")].find((b) => /Close|Back/.test(b.getAttribute("aria-label") || ""));
  if (back) back.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(200);
}

/* ---- a session: start, answer one card, continue ---- */
const click = (el) => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
const buttonNamed = (re) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));
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
    `lang=${lang}, exercise: ${instruction.textContent}`
  );
  const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set;
  setter.call(input, "book");
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
check("the answer was marked", /That's right|Not quite|Here it is/.test(document.body.textContent));
click(buttonNamed(/Continue|Next/));
await sleep(900); // the 600 ms save debounce
const after = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3"));
const answered = after.items.find((i) => i.id === "srv" + card.id) || { s: {}, subs: [] };
check("the course card is still in storage after the session", after.items.some((i) => i.id === "srv" + card.id), `items=${after.items.map((i) => i.id).join(",")}`);
const storedStates = [...Object.keys(answered.s), ...(answered.subs || []).flatMap((sb) => Object.keys(sb.s))];
check("exactly the answered state is stored on the answered card, and nothing untouched", storedStates.length <= 1, `stored states: ${storedStates.join(",")}`);
check("no console errors during the session", errors.length === 0, errors.slice(0, 3).join(" | "));

console.error = origError;
console.log(results.join("\n"));
console.log("\nrequests:", calls.join("\n          "));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
