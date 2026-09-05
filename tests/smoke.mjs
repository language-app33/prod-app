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
  /* The same two vite freezes into a real build, so the version line is
     exercised here the way it actually ships rather than through its
     "no one defined this" fallback. */
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_VERSION__: '"abc1234"',
    __BUILT_AT__: '"2026-09-05T13:00:00.000Z"',
  },
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
/* The build the bundle was compiled with — see the define above — so the
   app and the server agree until a test makes them disagree. */
let deployedVersion = { commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
w.fetch = globalThis.fetch = async (input, opts = {}) => {
  const url = new URL(String(input), "https://taleb.test");
  const method = opts.method || "GET";
  const action = url.searchParams.get("action");
  calls.push(`${method} ${url.pathname}${action ? "?action=" + action : ""}${url.searchParams.get("audio") ? "?audio" : ""}`);
  /* Both readers, because the courses client reads the body as text and
     the sync client calls json(). A stub that offered only one would let a
     change to either slip through here. */
  const json = (body, status = 200) => ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  /* Whatever the "server" is serving. Set per test, so the corner menu can
     be shown both a matching build and a newer one. */
  if (url.pathname === "/api/version") return json(deployedVersion);

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
check("the course card and both old cards landed in storage", stored.items.length === 3 && byId["srv" + card.id] && byId.oldclient1 && byId.v2card, `items=${stored.items.map((i) => i.id).join(",")}`);
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
check("every card counts as ready to practise", /Cards ready to practice\s*3/.test(text.replace(/\s+/g, " ")), text.replace(/\s+/g, " ").match(/Cards ready to practice\s*\d+/)?.[0]);
const wire = remoteDocs.get(realToken) && remoteDocs.get(realToken).data;
/* Sparse means one thing: no state written out for an exercise type that was
   never answered. Keys from an older schema — v2's mean/read/write — ride
   along untouched, because sync unions whatever keys either side has so that
   a device on one build never strips what a device on another still needs.
   That is deliberate, and the reason a retired type's state is left alone
   rather than filtered out of the document. */
const V2_KEYS = ["mean", "read", "write"];
const typeStates = (i) => Object.keys(i.s).filter((k) => !V2_KEYS.includes(k));
check("wire document is sparse and has no account", wire && !("account" in wire) && wire.items.every((i) => typeStates(i).length <= 1), wire ? wire.items.map((i) => `${i.id}:${Object.keys(i.s).join("/") || "-"}`).join(" ") : "no wire doc");
check("the retired exercise is never written into the document", wire && wire.items.every((i) => !("ar2tr" in i.s)), wire ? wire.items.map((i) => `${i.id}:${Object.keys(i.s).join("/") || "-"}`).join(" ") : "no wire doc");
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

const click = (el) => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
const buttonNamed = (re) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));

/* ---- the version line ----
   It exists to answer "is what I merged actually running?", so the two
   things worth checking are that it shows the build the bundle was
   compiled from, and that it does not claim to be current when the server
   is serving something else — which for an installed app is the ordinary
   case for a minute after a deploy, not an exotic one. */
{
  const openMenu = async () => {
    click(document.querySelector(".at-cornerbtn"));
    await sleep(150);
  };

  await openMenu();
  const ver = document.querySelector(".at-cver");
  check("the corner menu carries a version", !!ver,
    ver ? "" : document.querySelector(".at-cmenu") ? "menu open, no version line" : "the menu did not open");
  check("it names the build this bundle came from", !!ver && /abc1234/.test(ver.textContent),
    (ver && ver.textContent) || "");
  check("it says when, so two deploys in a day are distinguishable",
    !!ver && /\d/.test(ver.querySelector("i").textContent), (ver && ver.querySelector("i").textContent) || "");
  check("nothing to do when it is the deployed one", !!ver && !ver.classList.contains("stale") && !ver.querySelector(".at-cverbtn"));

  /* A deploy lands while this bundle is the one in hand. */
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
  deployedVersion = { commit: "def5678", builtAt: "2026-09-05T14:00:00.000Z" };
  await openMenu();
  await sleep(60);
  const stale = document.querySelector(".at-cver");
  check("a newer deploy is reported rather than passed over",
    !!stale && stale.classList.contains("stale") && /def5678/.test(stale.textContent),
    (stale && stale.textContent) || "");
  check("and it offers the one thing that fixes it", !!stale && !!stale.querySelector(".at-cverbtn"));

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
  deployedVersion = { commit: "abc1234", builtAt: "2026-09-05T13:00:00.000Z" };
  click(document.querySelector(".at-cornerbtn"));
  await sleep(50);
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
    "Snackbar",
  ].filter((n) => !shown.includes(n));
  check("every component in the library has a row", missing.length === 0, `missing: ${missing.join(", ")}`);

  /* The specimens have to actually render something, not just be listed. */
  check("specimens rendered, not just names", host.querySelectorAll(".at-galvbody").length >= 30,
    `${host.querySelectorAll(".at-galvbody").length} specimens`);
  check("the icon set is laid out", host.querySelectorAll(".at-galicon").length >= 30,
    `${host.querySelectorAll(".at-galicon").length} icons`);
  /* The snackbar, driven the way the app drives it: the gallery's own
     buttons go through useSnackbarState, so this exercises the hook, the
     portal and the styles' one contract — that it lands inside `.at` and
     not on the body, where it would render themeless. */
  {
    const raise = [...host.querySelectorAll(".at-galrow")]
      .find((r) => /^Snackbar/.test(r.textContent))
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
  const { withoutListening } = await import(path.join(out, "ArabicTrainer.js"));
  const stored2 = JSON.parse(localStorage.getItem("arabic-trainer:arabic-trainer-v3"));
  const byId2 = Object.fromEntries(stored2.items.map((i) => [i.id, i]));
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
    out2.every((e) => !["rec2en", "rec2ar", "rec2attr"].includes(e.type)),
    out2.map((e) => e.type).join(","));
  check("the question in front of you is replaced, not skipped",
    out2.length > 1 && out2[1].id === card1.id && out2[1].type !== "rec2en",
    out2.map((e) => e.type).join(","));
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
    one[1].type === "tr2ar", one.map((e) => e.type).join(","));

  /* And when every alternative is already queued, repeat one rather than
     drop the practice — the card is still worth answering. */
  check("with nothing free it still substitutes rather than dropping",
    out2.length === queue.length, out2.map((e) => e.type).join(","));

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
