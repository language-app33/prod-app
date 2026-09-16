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

const { enabledTypes, setAudibleClips, setOfflineNow } = await import(
  path.join(out, "trainer.js")
);
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
