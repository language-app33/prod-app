// @ts-check
/*
 * Being offline is the ordinary state, not the broken one.
 *
 * The app's whole point is that a learner can practise on a train. Most of
 * that was already true and had no test, which is how the edges came to be
 * online-only without anybody noticing: a question dealt with a recording
 * that was not on the device, a size limit measured against the wrong
 * ceiling, and a service worker one config line away from serving the
 * offline shell in place of a sync.
 *
 * These are the rules that hold the offline case up, checked where they
 * can be checked without a browser.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");
const out = path.join(here, ".offline-build");

/* Bundled the way the session and card tests do it: the trainer is JSX and
   nothing in it touches a browser on the way in. */
await build({
  entryPoints: [path.join(root, "src", "ArabicTrainer.tsx")],
  outfile: path.join(out, "trainer.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"development"',
    __APP_RELEASE__: '"0"',
    __APP_VERSION__: '"test"',
    __BUILT_AT__: '"0"',
  },
});

const {
  buildManualSession,
  buildSession,
  enabledTypes,
  installIndexes,
  requeueUnaskable,
  setAudibleClips,
  setOfflineNow,
} = await import(path.join(out, "trainer.js"));
const { docSize, MAX_LOCAL_UNITS } = await import(path.join(root, "src", "sync.ts"));
const { DEFAULT_LANGUAGE } = await import(path.join(root, "src", "languages.ts"));

const settings = { language: DEFAULT_LANGUAGE };

/** A form with a word, a meaning and one recording. */
const form = (/** @type {string} */ clipId) => ({
  id: "f1",
  ar: "كِتاب",
  en: "book",
  lat: "kitaab",
  s: {},
  recs: clipId ? [{ id: clipId }] : [],
});

/** The listening exercises among a list of types. */
const listening = (/** @type {string[]} */ types) =>
  types.filter((t) => ["rec2en", "rec2ar", "rec2ctx", "rec2attr"].includes(t.split("@")[0]));

/* Every test here sets both flags, because they are module-level and a
   test that inherited another's would be testing the wrong thing. */
/**
 * @param {{ offline?: boolean, here?: string[] | null }} what
 *   `here` is the recordings on this device: a list, or null for "nobody
 *   has looked yet", which is not the same as none.
 */
function state({ offline = false, here: held = null }) {
  setOfflineNow(offline);
  setAudibleClips(held === null ? null : new Set(held));
}

/* ------------------------------------------------------------------
   A question is never asked without the sound it needs
   ------------------------------------------------------------------ */

test("online, a card is asked its listening exercises whether or not the clip is here", () => {
  /* The recording is a fetch away, which is what the player does. */
  state({ offline: false, here: [] });
  assert.ok(
    listening(enabledTypes(form("clip-1"), settings)).length > 0,
    "a recorded card is asked about its recording",
  );
});

test("offline, a card whose recording is elsewhere is not asked to listen to it", () => {
  /* This is the fault itself: the question was dealt, put a silent player
     on screen, and told the learner the clip "isn't on this device yet" —
     leaving them to skip a question they could never have answered. */
  state({ offline: true, here: ["someone-else"] });
  assert.deepEqual(
    listening(enabledTypes(form("clip-1"), settings)),
    [],
    "nothing that plays a clip this device does not hold",
  );
});

test("offline, a card whose recording is here is asked about it as usual", () => {
  state({ offline: true, here: ["clip-1"] });
  assert.ok(
    listening(enabledTypes(form("clip-1"), settings)).length > 0,
    "a downloaded course is a course that can be practised in full",
  );
});

test("silencing the listening exercises never silences the rest of the card", () => {
  state({ offline: true, here: [] });
  const types = enabledTypes(form("clip-1"), settings);
  assert.ok(types.length > 0, "the card is still drilled");
  assert.deepEqual(listening(types), [], "just not by ear");
});

test("before anybody has looked, nothing is silenced", () => {
  /* Null is "not asked yet" and is not the same as "none here". Reading it
     as none would quietly silence a card that is in fact ready. */
  state({ offline: true, here: null });
  assert.ok(listening(enabledTypes(form("clip-1"), settings)).length > 0);
});

test("a card with no recording at all is unaffected either way", () => {
  state({ offline: true, here: [] });
  const off = enabledTypes(form(""), settings);
  state({ offline: false, here: [] });
  assert.deepEqual(off, enabledTypes(form(""), settings));
});

/* ------------------------------------------------------------------
   And the same rule where the questions are actually dealt

   The three tests above ask what a card *supports*, which is a different
   question from what a session *asks* — and the first version of this
   fix answered only the first. The card was correctly judged undrillable
   where that mattered, and the session went on putting the silent
   question anyway, because the types a question is built from come
   through another door. These ask the session itself.
   ------------------------------------------------------------------ */

/** One ordinary card with a word, a meaning and one recording. */
const card = () => ({
  id: "c1",
  updated: 1,
  tags: [],
  forms: [form("clip-1")],
});

/** The listening questions in a built session. */
const heard = (/** @type {{ exercises?: { type: string }[] }} */ session) =>
  (session.exercises || []).filter((q) =>
    ["rec2en", "rec2ar", "rec2ctx", "rec2attr"].includes(String(q.type).split("@")[0]),
  );

test("a dealt session offline asks nothing that plays a recording it hasn't got", () => {
  state({ offline: true, here: ["someone-else"] });
  installIndexes([card()], settings);
  const session = buildSession({
    items: [card()],
    settings,
    inDeck: () => true,
    practice: true,
  });
  assert.ok((session.exercises || []).length > 0, "the card is still practised");
  assert.deepEqual(heard(session), [], "just never by ear");
});

test("and a session built by hand honours it too", () => {
  /* The hand-built session reaches the same exercises by another route,
     off the mode's own list of types — which knows nothing about whose
     card it is being applied to. */
  state({ offline: true, here: ["someone-else"] });
  installIndexes([card()], settings);
  const session = buildManualSession({
    items: [card()],
    settings,
    ids: ["c1"],
    mode: "ultimate",
  });
  assert.deepEqual(heard(session), []);
});

test("with the recording here, the session asks about it as usual", () => {
  state({ offline: true, here: ["clip-1"] });
  installIndexes([card()], settings);
  const session = buildSession({
    items: [card()],
    settings,
    inDeck: () => true,
    practice: true,
  });
  assert.ok(heard(session).length > 0, "a downloaded course is practised in full");
});

test("online, a recording that is a fetch away is still asked about", () => {
  state({ offline: false, here: [] });
  installIndexes([card()], settings);
  const session = buildSession({
    items: [card()],
    settings,
    inDeck: () => true,
    practice: true,
  });
  assert.ok(heard(session).length > 0);
});

/* ------------------------------------------------------------------
   Two ceilings, not one
   ------------------------------------------------------------------ */

test("the document is measured against the device's own limit as well as the server's", () => {
  /* Past the server's limit sync stops; past the device's, *saving* stops,
     on a screen that goes on showing every answer as though it had been
     kept. Only the second was never checked. */
  const size = docSize({ items: [], settings: {}, tombstones: {}, parked: {}, log: {} });
  assert.equal(typeof size.units, "number");
  assert.equal(size.localLimit, MAX_LOCAL_UNITS);
  assert.equal(size.localTight, false, "an empty document is close to neither");
});

test("a document that is close to the device's limit says so", () => {
  const big = "ك".repeat(Math.ceil(MAX_LOCAL_UNITS * 0.8));
  const size = docSize({
    items: [{ id: "a", updated: 1, forms: [{ id: "f", ar: big, en: "x", lat: "", s: {} }] }],
    settings: {},
    tombstones: {},
    parked: {},
    log: {},
  });
  assert.ok(size.localTight, "the warning arrives before the saving stops");
});

test("the two limits are counted in their own units", () => {
  /* The server counts bytes and the store counts UTF-16 units, so the same
     Arabic document sits nearer one ceiling and further from the other.
     Measuring both with one number is how the first of these came to be
     wrong for every non-Latin script. */
  const arabic = "ك".repeat(1000);
  const size = docSize({
    items: [{ id: "a", updated: 1, forms: [{ id: "f", ar: arabic, en: "", lat: "", s: {} }] }],
    settings: {},
    tombstones: {},
    parked: {},
    log: {},
  });
  assert.ok(size.bytes > size.units, "Arabic costs more bytes than it does units");
});

/* ------------------------------------------------------------------
   The copy of the app the browser keeps
   ------------------------------------------------------------------ */

test("the offline shell never answers for the API", () => {
  /* Without the denylist, a sync made with no connection is answered with
     the app's own HTML and a 200 — which the client reads as an answer it
     cannot parse rather than as being offline. One config line, and
     nothing in the app would show it had gone. */
  const config = readFileSync(path.join(root, "vite.config.js"), "utf8");
  const found = /navigateFallbackDenylist:\s*\[([^\]]*)\]/.exec(config);
  assert.ok(found, "the service worker declares no denylist at all");
  assert.match(found[1], /\/\^\\\/api\\\//, "requests under /api must not fall back to the shell");
});

test("everything the app is made of is kept for offline, the lazy screens included", () => {
  /* The teaching and admin screens are a chunk of their own, fetched on
     first use. A glob that missed them would leave an installed app that
     opens offline and then cannot reach half of itself. */
  const config = readFileSync(path.join(root, "vite.config.js"), "utf8");
  const found = /globPatterns:\s*\[([^\]]*)\]/.exec(config);
  assert.ok(found, "nothing says what to keep");
  for (const kind of ["js", "css", "html"]) {
    assert.match(found[1], new RegExp(kind), `${kind} files are not kept for offline`);
  }
});

/* ------------------------------------------------------------------
   A session already running, when the connection goes

   The gate that holds a listening question back is asked when a session is
   *built*. A session built online and carried into a tunnel was never
   asked again, so it kept its recordings and the learner met a silent
   player on a question they could only skip — the very failure the gate
   exists to stop, stopped at one door and not the other.
   ------------------------------------------------------------------ */

/** A card that can be read as well as heard, so it has somewhere to go. */
const heardAndRead = () => ({
  id: "c1",
  updated: 1,
  tags: [],
  forms: [form("clip-1")],
});

/** And one that can only be heard. */
const heardOnly = () => ({
  id: "c2",
  updated: 1,
  tags: [],
  forms: [{ id: "f2", ar: "قَلَم", en: "", lat: "", s: {}, recs: [{ id: "clip-2" }] }],
});

const queueOf = (/** @type {{id: string, type: string}[]} */ list) =>
  list.map((q) => ({ id: q.id, subId: null, type: q.type }));

test("a queue carried offline loses the recordings it cannot play", () => {
  const items = [heardAndRead()];
  installIndexes(items, settings);
  const queue = queueOf([{ id: "c1", type: "rec2en" }, { id: "c1", type: "ar2en" }]);

  state({ offline: false, here: [] });
  assert.deepEqual(
    requeueUnaskable(queue, 0, items, settings).map((/** @type {any} */ q) => q.type),
    ["rec2en", "ar2en"],
    "online it is a fetch away, so nothing moves",
  );

  state({ offline: true, here: [] });
  const after = requeueUnaskable(queue, 0, items, settings);
  assert.ok(
    !after.some((/** @type {any} */ q) => q.type === "rec2en"),
    `the unplayable question survived: ${after.map((/** @type {any} */ q) => q.type).join(",")}`,
  );
  assert.equal(after.length, 2, "and it was replaced rather than simply dropped");
});

test("a recording that is on the device is not taken away", () => {
  /* The other half, and the one that would make this change a nuisance if
     it were wrong: somebody who downloaded their course before travelling
     must lose nothing by going offline mid-session. */
  const items = [heardAndRead()];
  installIndexes(items, settings);
  state({ offline: true, here: ["clip-1"] });
  const queue = queueOf([{ id: "c1", type: "rec2en" }, { id: "c1", type: "ar2en" }]);
  assert.deepEqual(
    requeueUnaskable(queue, 0, items, settings).map((/** @type {any} */ q) => q.type),
    ["rec2en", "ar2en"],
  );
});

test("what has already been answered is never rewritten", () => {
  /* Filtering the whole queue would slide later questions down under a
     stationary cursor, and the learner would skip questions unseen. */
  const items = [heardAndRead()];
  installIndexes(items, settings);
  state({ offline: true, here: [] });
  const queue = queueOf([{ id: "c1", type: "rec2en" }, { id: "c1", type: "ar2en" }]);
  const after = requeueUnaskable(queue, 1, items, settings);
  assert.equal(after[0], queue[0], "the answered one is the very same object");
});

test("a card with nothing else to offer drops out of the rest of the session", () => {
  const items = [heardOnly()];
  installIndexes(items, settings);
  state({ offline: true, here: [] });
  const after = requeueUnaskable(queueOf([{ id: "c2", type: "rec2en" }]), 0, items, settings);
  assert.deepEqual(after, [], "there is genuinely nothing to ask");
});

test("the listing landing late is the same fact arriving a moment later", () => {
  /* Until the device has said which recordings it holds, everything reads
     as reachable — deliberately, so a card that is ready is never silenced
     by mistake. A session built inside that window is put right when the
     answer arrives. */
  const items = [heardAndRead()];
  installIndexes(items, settings);
  const queue = queueOf([{ id: "c1", type: "rec2en" }, { id: "c1", type: "ar2en" }]);

  state({ offline: true, here: null });
  assert.equal(
    requeueUnaskable(queue, 0, items, settings).length,
    2,
    "nobody has looked yet, so nothing is withheld",
  );

  state({ offline: true, here: [] });
  assert.ok(
    !requeueUnaskable(queue, 0, items, settings).some((/** @type {any} */ q) => q.type === "rec2en"),
    "and once the device has answered, the question goes",
  );
});
