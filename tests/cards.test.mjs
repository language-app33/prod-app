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

/* spaces.tsx is JSX and imports React, so it is bundled the way the smoke
   harness does rather than imported raw. Only the pure helpers are used.

   Built inside the project rather than in a temp directory: React is left
   external, and node resolves that from node_modules relative to the file
   doing the importing. */
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".cards-build");
await build({
  entryPoints: [path.join(here, "..", "src", "spaces.tsx")],
  outfile: path.join(out, "spaces.js"),
  bundle: true,
  format: "esm",
  external: ["react", "react-dom", "react-dom/client"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { cardHasAudio, cardFormCount, cardAdded, cardChanged, sortCards, filterCards, CARD_SORTS } =
  await import(path.join(out, "spaces.js"));

/* The two halves of card identity live in shared.tsx, so it is bundled the
   same way. They are one subject with the sorting above: what a card is
   called, on the device and on the server. */
await build({
  entryPoints: [path.join(here, "..", "src", "shared.tsx")],
  outfile: path.join(out, "shared.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { localIdFor, cardToItem, serverCardId } = await import(path.join(out, "shared.js"));

/* And which recording a question leads with, which is a plain function of a
   card's progress and belongs with the rest of them. The trainer is bundled
   the same way; nothing in it touches a browser on the way in. */
await build({
  entryPoints: [path.join(here, "..", "src", "ArabicTrainer.tsx")],
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
const { leadSpeed } = await import(path.join(out, "trainer.js"));

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

test("filtering by which decks a card is in, and which it is not", () => {
  /* The filter a teacher reaches for to find what a deck is missing, or
     what is in no deck at all and so reaches nobody. */
  const list = [
    card({ id: "lesson1", decks: ["d1"] }),
    card({ id: "both", decks: ["d1", "d2"] }),
    card({ id: "week3", decks: ["d2"] }),
    card({ id: "loose", decks: [] }),
    card({ id: "never-in-one" }),
  ];
  const ids = (/** @type {Record<string, any>} */ f) =>
    filterCards(list, f).map((/** @type {any} */ c) => c.id);

  assert.deepEqual(ids({ deckMode: "in", deckIds: ["d1"] }), ["lesson1", "both"]);
  /* Any of the chosen decks, not all of them: picking three decks reads as
     "show me these three", and "in all three at once" is a question nobody
     asks of a deck list. */
  assert.deepEqual(ids({ deckMode: "in", deckIds: ["d1", "d2"] }), ["lesson1", "both", "week3"]);
  /* And the other way round is exactly the rest of them. */
  assert.deepEqual(ids({ deckMode: "out", deckIds: ["d1"] }), ["week3", "loose", "never-in-one"]);
  assert.deepEqual(ids({ deckMode: "out", deckIds: ["d1", "d2"] }), ["loose", "never-in-one"]);
  /* A card that has never been in a deck has no list of them at all, which
     is not the same shape as an empty one and must read the same way. */
  assert.deepEqual(ids({ deckMode: "in", deckIds: ["d1", "d2", "d3"] }).includes("never-in-one"), false);

  /* A mode with nothing ticked narrows nothing: it is the state the filter
     is in until the first box is ticked, and emptying the list in the
     meantime would read as a list that had lost its cards. */
  assert.deepEqual(ids({ deckMode: "in", deckIds: [] }).length, list.length);
  assert.deepEqual(ids({ deckMode: "out", deckIds: [] }).length, list.length);
  /* As does a deck nobody is in, which is what a deck deleted while the
     filter was on leaves behind. */
  assert.deepEqual(ids({ deckMode: "in", deckIds: ["gone"] }), []);
  assert.deepEqual(ids({ deckMode: "out", deckIds: ["gone"] }).length, list.length);

  /* And it narrows alongside the others rather than instead of them. */
  const heard = [
    card({ id: "quiet", decks: ["d1"] }),
    card({ id: "loud", decks: ["d1"], clips: ["a"] }),
  ];
  assert.deepEqual(
    filterCards(heard, { deckMode: "in", deckIds: ["d1"], audio: "with" }).map((/** @type {any} */ c) => c.id),
    ["loud"]
  );
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

/*
 * Slow while a word is being learnt, the real thing once it is being
 * reviewed. The second half is the one that matters: a learner only ever
 * offered the slow recording never practices hearing the word as it is
 * actually said, which is the skill.
 */
test("which recording leads follows how far along the card is", () => {
  /** @param {string} phase @param {number} [interval] */
  const heard = (phase, interval = 0) => ({ s: { rec2en: { phase, interval, due: 0 } } });

  assert.equal(leadSpeed({ s: {} }), "slow", "a card never listened to starts slow");
  assert.equal(leadSpeed(heard("new"), "rec2en"), "slow");
  assert.equal(leadSpeed(heard("learning"), "rec2en"), "slow");
  /* The meeting after a lapse is exactly where the parts of a word help. */
  assert.equal(leadSpeed(heard("relearning"), "rec2en"), "slow");
  assert.equal(leadSpeed(heard("review", 3), "rec2en"), "regular");
  assert.equal(leadSpeed(heard("review", 40), "rec2en"), "regular");

  /* Two listening exercises, and one of them still being learnt: the
     cautious answer is the one that holds. */
  assert.equal(
    leadSpeed({ s: { rec2en: { phase: "review", interval: 40, due: 0 }, rec2ar: { phase: "learning", interval: 0, due: 0 } } }),
    "slow"
  );
  /* Progress at reading says nothing about hearing it, so a card read
     fluently and never heard still leads slow. */
  assert.equal(leadSpeed({ s: { ar2en: { phase: "review", interval: 40, due: 0 } } }), "slow");
});

test("a course card arrives saying which language it is in, on every form", () => {
  /* The device holds one pile of cards and the app has one language set, so
     without this a student in an Arabic course and a Vietnamese one had
     half their cards marked, laid out and drilled by the other language's
     rules. The card knows; the forms are what an exercise is about, so they
     have to know too. */
  const item = cardToItem(
    { id: "k1", ar: "cà phê", en: "coffee", lang: "vi-Hue", subs: [{ ar: "cà phê sữa", en: "milk coffee" }] },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.equal(item.lang, "vi-Hue");
  assert.equal(item.subs[0].lang, "vi-Hue");
});

test("a conversation reaches the learner as a scene, with its turns drillable", () => {
  /* The bridge between the two halves of the app: what a teacher writes as
     a card with lines on it has to arrive as a dialog whose every line is
     a unit of its own, or a scene is a card with an empty face and nothing
     to ask about it. */
  const item = cardToItem(
    {
      id: "k7", ar: "", en: "At the door", lang: "ar-PS",
      note: "Two neighbours meet",
      speakers: ["Layla", "Karim"],
      you: 1,
      lines: [
        { who: 0, ar: "سلام", en: "peace", uses: ["w1"], clips: ["hello"] },
        { who: 1, ar: "وسلام", en: "and peace" },
      ],
    },
    "Lesson 1", "c1", "d1", () => ({ ar2en: { phase: "new" } }),
  );

  assert.equal(item.kind, "dialog", "a card with a conversation on it is a dialog");
  assert.equal(item.en, "At the door", "the scene's name is the card's English");
  assert.deepEqual(item.speakers, ["Layla", "Karim"]);
  assert.equal(item.you, 1);
  assert.equal(item.lines.length, 2);
  /* Named from the card, so a line keeps its progress across a refresh —
     the same promise the other forms of a card get. */
  assert.equal(item.lines[0].id, `${localIdFor("k7")}-l0`);
  assert.equal(item.lines[1].who, 1);
  assert.ok(Object.keys(item.lines[0].s).length, "a line arrives with progress of its own");
  assert.equal(item.lines[0].lang, "ar-PS", "and in the language the card is in");
  /* The words a line teaches are the server's ids on one side of this and
     the device's on the other, exactly as the card's own are. */
  assert.deepEqual(item.lines[0].uses, [localIdFor("w1")]);
  assert.deepEqual(item.lines[0].recs.map((/** @type {any} */ r) => r.id), ["hello"]);
  assert.deepEqual(item.lines[1].recs, [], "a line with no recording is not a broken one");
});

test("and an ordinary card is not turned into a scene on the way", () => {
  const item = cardToItem(
    { id: "k8", ar: "كِتاب", en: "book", lang: "ar-PS" },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.equal(item.kind, "word");
  assert.equal(item.lines, undefined, "a word carries no empty conversation about with it");
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
  /* And each says its speed as a field rather than only inside its name:
     the player shows one of each and picks by this, and picking by reading
     a label back is guessing. */
  assert.deepEqual(item.recs.map((/** @type {any} */ r) => r.speed), ["regular", "slow"]);
});

test("and an item that was never a course card has only the one name", () => {
  assert.equal(serverCardId({ id: "mine-1" }), "mine-1");
  assert.equal(serverCardId(null), "");
  assert.equal(serverCardId({}), "");
  /* A source with nothing useful in it is no source at all. */
  assert.equal(serverCardId({ id: "mine-2", source: {} }), "mine-2");
});
