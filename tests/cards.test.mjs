/*
 * Ordering and narrowing a list of cards.
 *
 * Kept as plain functions of a card precisely so this can be checked
 * without a browser: the sort is where an off-by-one or a missing tie-break
 * hides, and neither shows up in a screenshot.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";

/* spaces.jsx is JSX and imports React, so it is bundled the way the smoke
   harness does rather than imported raw. Only the pure helpers are used.

   Built inside the project rather than in a temp directory: React is left
   external, and node resolves that from node_modules relative to the file
   doing the importing. */
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".cards-build");
await build({
  entryPoints: [path.join(here, "..", "src", "spaces.jsx")],
  outfile: path.join(out, "spaces.js"),
  bundle: true,
  format: "esm",
  external: ["react", "react-dom", "react-dom/client"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { cardHasAudio, cardFormCount, cardAdded, cardChanged, sortCards, filterCards, CARD_SORTS } =
  await import(path.join(out, "spaces.js"));

/* The two halves of card identity live in shared.jsx, so it is bundled the
   same way. They are one subject with the sorting above: what a card is
   called, on the device and on the server. */
await build({
  entryPoints: [path.join(here, "..", "src", "shared.jsx")],
  outfile: path.join(out, "shared.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { localIdFor, cardToItem, serverCardId } = await import(path.join(out, "shared.js"));

/** @param {Record<string, any>} [over] */
const card = (over) => ({ id: "x", ar: "", en: "", clips: [], subs: [], updated: 1000, ...over });

test("a recording on any form counts as the card having one", () => {
  /* Recordings hang off each form, not off the card, so asking only about
     the main one would call a card silent because its plural is the form
     that was recorded. */
  assert.equal(cardHasAudio(card()), false);
  assert.equal(cardHasAudio(card({ clips: ["a"] })), true);
  assert.equal(cardHasAudio(card({ subs: [{ clips: ["b"] }] })), true);
  assert.equal(cardHasAudio(card({ subs: [{ clips: [] }] })), false);
  /* And a card recorded only slowly has been recorded. It is the second
     list rather than a mark on the first, so anything that asks "is there
     audio here" has to ask about both or call such a card silent — which
     is what the audio filter and the sort would have done. */
  assert.equal(cardHasAudio(card({ slowClips: ["s"] })), true);
  assert.equal(cardHasAudio(card({ subs: [{ slowClips: ["s"] }] })), true);
});

test("the main form is a form", () => {
  assert.equal(cardFormCount(card()), 1);
  assert.equal(cardFormCount(card({ subs: [{}] })), 2);
  assert.equal(cardFormCount(card({ subs: [{}, {}] })), 3);
});

test("a card made before the date was recorded falls back rather than lying", () => {
  /* Backfilling would have written today's date over the answer. `updated`
     is exactly right for a card never edited and an upper bound otherwise,
     which is the closest true thing available. */
  assert.equal(cardAdded(card({ created: 500, updated: 900 })), 500);
  assert.equal(cardAdded(card({ updated: 900 })), 900);
  assert.equal(cardAdded(card({ created: 0, updated: 0 })), 0);
  assert.equal(cardChanged(card({ created: 500, updated: 900 })), 900);
});

test("newest first, and the other way round", () => {
  const list = [card({ id: "old", created: 1 }), card({ id: "new", created: 9 })];
  assert.deepEqual(sortCards(list, "added").map((/** @type {any} */ c) => c.id), ["new", "old"]);
  assert.deepEqual(sortCards(list, "added", false).map((/** @type {any} */ c) => c.id), ["old", "new"]);
});

test("ordering by a yes/no still has an order inside each group", () => {
  /* Without a tie-break the cards within a group keep whatever order the
     server happened to return, which looks like a bug the first time two
     saves come back the other way round. */
  const list = [
    card({ id: "silent-new", updated: 9 }),
    card({ id: "loud-old", clips: ["a"], updated: 1 }),
    card({ id: "loud-new", clips: ["a"], updated: 5 }),
  ];
  assert.deepEqual(sortCards(list, "audio").map((/** @type {any} */ c) => c.id), ["loud-new", "loud-old", "silent-new"]);
});

test("sorting never disturbs the list it was given", () => {
  /* The caller's array is React state. Sorting it where it lies would
     mutate state directly and the change would not always be seen. */
  const list = [card({ id: "a", created: 1 }), card({ id: "b", created: 2 })];
  sortCards(list, "added");
  assert.deepEqual(list.map((/** @type {any} */ c) => c.id), ["a", "b"]);
});

test("an order nobody asked for leaves the list alone", () => {
  const list = [card({ id: "a" }), card({ id: "b" })];
  assert.deepEqual(sortCards(list, "nonsense").map((/** @type {any} */ c) => c.id), ["a", "b"]);
});

test("filtering by recordings and by forms, together", () => {
  const list = [
    card({ id: "plain" }),
    card({ id: "heard", clips: ["a"] }),
    card({ id: "many", subs: [{}] }),
    card({ id: "heard-many", clips: ["a"], subs: [{}] }),
  ];
  const ids = (/** @type {Record<string, any>} */ f) =>
    filterCards(list, f).map((/** @type {any} */ c) => c.id);
  assert.deepEqual(ids({}), ["plain", "heard", "many", "heard-many"]);
  assert.deepEqual(ids({ audio: "with" }), ["heard", "heard-many"]);
  assert.deepEqual(ids({ audio: "without" }), ["plain", "many"]);
  assert.deepEqual(ids({ forms: "one" }), ["plain", "heard"]);
  assert.deepEqual(ids({ forms: "several" }), ["many", "heard-many"]);
  /* The two narrow together rather than either winning. */
  assert.deepEqual(ids({ audio: "without", forms: "several" }), ["many"]);
});

test("every order offered has a label and a way to read a card", () => {
  /* The picker is built from this table, so an entry missing either would
     render a blank button that sorts by undefined. */
  for (const [key, sort] of Object.entries(CARD_SORTS)) {
    assert.equal(typeof sort.label, "string", key);
    assert.ok(sort.label.length, key);
    assert.equal(typeof sort.of, "function", key);
  }
  assert.deepEqual(Object.keys(CARD_SORTS), ["added", "changed", "audio", "forms"]);
});

/*
 * A card has two names — the server's and the device's — and everything
 * sent back to the server has to use the first. Reporting a problem used
 * the second, which is accepted, filed, and read at the other end as a
 * report about a card the site has never held.
 */
test("a course card knows its name on the server, whatever it is called here", () => {
  const item = cardToItem(
    { id: "k9f2a1b3c4d5", ar: "كِتاب", en: "book", lang: "ar-PS", rev: 3, subs: [{ ar: "كُتُب", en: "books" }] },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.equal(item.id, localIdFor("k9f2a1b3c4d5"), "the device gives it its own id");
  assert.notEqual(item.id, "k9f2a1b3c4d5", "which is not the server's");
  assert.equal(serverCardId(item), "k9f2a1b3c4d5", "and the server's is what goes back");
});

test("a card recorded at both speeds reaches the learner as both, named", () => {
  /* The ordinary recording first and unnamed, so a listening question plays
     the real thing; the slow one after it and named, so what it is is said
     rather than left as "Voice 2". */
  const item = cardToItem(
    {
      id: "k1", ar: "كِتاب", en: "book", lang: "ar-PS",
      clips: ["fast"], slowClips: ["slow"],
      subs: [{ ar: "كُتُب", en: "books", slowClips: ["subslow"] }],
    },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.deepEqual(item.recs.map((/** @type {any} */ r) => [r.id, r.label]),
    [["fast", ""], ["slow", "Slow"]]);
  assert.deepEqual(item.subs[0].recs.map((/** @type {any} */ r) => [r.id, r.label]),
    [["subslow", "Slow"]], "a form recorded only slowly still arrives with it");
});

test("and an item that was never a course card has only the one name", () => {
  assert.equal(serverCardId({ id: "mine-1" }), "mine-1");
  assert.equal(serverCardId(null), "");
  assert.equal(serverCardId({}), "");
  /* A source with nothing useful in it is no source at all. */
  assert.equal(serverCardId({ id: "mine-2", source: {} }), "mine-2");
});
