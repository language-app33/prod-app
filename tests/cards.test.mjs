/*
 * Ordering and narrowing a list of cards.
 *
 * Kept as plain functions of a card precisely so this can be checked
 * without a browser: the sort is where an off-by-one or a missing tie-break
 * hides, and neither shows up in a screenshot.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { formsOf, subFormsOf } from "../src/cards.ts";
import { must } from "./helpers.mjs";
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
const { cardHasAudio, cardFormCount, cardAdded, cardChanged, sortCards, filterCards, blanksInUse, CARD_SORTS } =
  await import(path.join(out, "spaces.js"));

/* The editor's own rules live in card-editor.tsx now, bundled the same way:
   what a card opens as, which table it lays out, what a save carries. */
await build({
  entryPoints: [path.join(here, "..", "src", "card-editor.tsx")],
  outfile: path.join(out, "card-editor.js"),
  bundle: true,
  format: "esm",
  external: ["react", "react-dom", "react-dom/client"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { shapeOf, shapeChoices, categoryChoices, categoryOffers, tableFor,
  initialForms, initialCells, initialCategory, storedFormsOf, asideOf, tableCellsOf,
  canSaveWord, canSaveScene, writtenCard, writtenLines, ownerLabel, askParts, partAsked } =
  await import(path.join(out, "card-editor.js"));

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
const { localIdFor, cardToItem, serverCardId, foldCourses } = await import(path.join(out, "shared.js"));

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
const { leadSpeed, deckPercent, levelPercent, formIsAmbiguous, kinTags, onePerLevel, quietUnits, easedUnits,
  drillableUnits, askedUnits, agreeTook, laddered, liftStates, merge,
  setValueIndex, valueKey, setMateCounts } =
  await import(path.join(out, "trainer.js"));
const { TYPES, LANGUAGES, verbOf, attachedOf, specOf } = await import(path.join(here, "..", "src", "languages.ts"));

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

test("filtering by which side of a blank a card is on, and which blank", () => {
  /* A teacher who has written forty names wants three things of this list:
     the names, to check them; the sentences the names go into; and
     everything that is neither, to get their material back. */
  const list = [
    card({ id: "frame", ar: "ismi {{name}}", en: "My name is {{name}}" }),
    card({ id: "colours", ar: "{{colour}} kbiir", en: "a big {{colour}}" }),
    card({ id: "rafa", en: "Raphael", fills: "name", drill: false }),
    card({ id: "viktor", en: "Victor", fills: "name", drill: false }),
    card({ id: "blue", en: "blue", fills: "colour", drill: false }),
    card({ id: "house", en: "house" }),
  ];
  const ids = (/** @type {Record<string, any>} */ f) =>
    filterCards(list, f).map((/** @type {any} */ c) => c.id);

  /* The words other cards borrow. */
  assert.deepEqual(ids({ blankMode: "fills" }), ["rafa", "viktor", "blue"], "every value");
  assert.deepEqual(ids({ blankMode: "fills", blankNames: ["name"] }), ["rafa", "viktor"]);
  assert.deepEqual(ids({ blankMode: "fills", blankNames: ["colour"] }), ["blue"]);
  /* Several blanks read as "show me these", the way several decks do. */
  assert.deepEqual(ids({ blankMode: "fills", blankNames: ["name", "colour"] }),
    ["rafa", "viktor", "blue"]);
  /* A blank nothing fills any more — a name left ticked while the last card
     filling it was deleted — empties the list rather than ignoring the tick,
     which is the honest answer to what was asked. */
  assert.deepEqual(ids({ blankMode: "fills", blankNames: ["gone"] }), []);

  /* And the other side of the same blank: the sentences it is a hole in.
     This is the half that did not exist — the list could say which words
     fill {{name}} and not which cards ask for one. */
  assert.deepEqual(ids({ blankMode: "leaves" }), ["frame", "colours"]);
  assert.deepEqual(ids({ blankMode: "leaves", blankNames: ["name"] }), ["frame"]);
  assert.deepEqual(ids({ blankMode: "leaves", blankNames: ["colour"] }), ["colours"]);
  assert.deepEqual(ids({ blankMode: "leaves", blankNames: ["name", "colour"] }),
    ["frame", "colours"]);
  assert.deepEqual(ids({ blankMode: "leaves", blankNames: ["gone"] }), []);

  /* The two sides are never the same card: a card with a hole in it fills
     nothing, whatever it says — see fillsOf. */
  assert.deepEqual(
    ids({ blankMode: "leaves" }).filter((/** @type {string} */ id) =>
      ids({ blankMode: "fills" }).includes(id)),
    []
  );

  /* And what is left when the values are put aside. The frame stays: it is
     not a value, it is a card with a hole in it. */
  assert.deepEqual(ids({ blankMode: "none" }), ["frame", "colours", "house"]);
  /* The names do not narrow "none" — the list is not offered there, and a
     stale one must not quietly change what it means. */
  assert.deepEqual(ids({ blankMode: "none", blankNames: ["name"] }),
    ["frame", "colours", "house"]);
  assert.deepEqual(ids({ blankMode: "any" }).length, list.length);
  assert.deepEqual(ids({}).length, list.length);

  /* And it narrows alongside the others rather than instead of them. */
  assert.deepEqual(
    filterCards(list, { blankMode: "fills", forms: "one" }).map((/** @type {any} */ c) => c.id),
    ["rafa", "viktor", "blue"]
  );
});

test("the blanks on offer are read off the cards that wrote them", () => {
  /* The filter's list, and both sides of it. A blank exists because some
     card leaves one or says it fills one; a list kept beside them would be
     a second place to be wrong. */
  const list = [
    card({ id: "frame", ar: "ismi {{name}}", en: "My name is {{name}}" }),
    card({ id: "a", fills: "name" }),
    card({ id: "b", fills: "NAME" }),
    card({ id: "c", fills: "colour" }),
    card({ id: "d" }),
  ];
  assert.deepEqual(blanksInUse(list), [
    /* Words and no sentence: vocabulary nobody has written a use for. */
    { name: "colour", leaves: 0, fills: 1 },
    /* Folded and counted together: {{Name}} and {{name}} are one hole. */
    { name: "name", leaves: 1, fills: 2 },
  ]);
  /* And a blank with sentences and nothing to put in them, which is the
     card that cannot be practised — visible here before it is discovered. */
  assert.deepEqual(
    blanksInUse([card({ id: "starved", ar: "{{fruit}}", en: "{{fruit}}" })]),
    [{ name: "fruit", leaves: 1, fills: 0 }]
  );
  assert.deepEqual(blanksInUse([]), []);
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
  assert.equal(item.forms[0].lang, "vi-Hue", "its own word");
  assert.equal(item.forms[1].lang, "vi-Hue", "and every other form of it");
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
  assert.equal(item.forms[0].en, "At the door", "the scene's name is the card's English");
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

test("what the teacher does not ask about reaches the student that way too", () => {
  /* Everything that reads a table reads the fields carried here, and this
     is one more of them: a card whose pronouns are written out for reading
     rather than for drilling would otherwise arrive with all eight of them
     being asked. */
  const item = cardToItem(
    {
      id: "k9", ar: "كِتاب", en: "book", lang: "ar-PS", ask: false,
      subs: [
        { ar: "كتابي", en: "my book", row: "attached", col: "me", ask: false },
        { ar: "كُتُب", en: "books" },
      ],
    },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.equal(item.forms[0].ask, false, "the card's own word");
  assert.equal(item.forms[1].ask, false, "and the cell");
  assert.equal("ask" in item.forms[2], false, "while an ordinary form gains nothing");

  /* And a card nobody has said anything about arrives asked, which is
     every card written before this. */
  const plain = cardToItem(
    { id: "k10", ar: "شمس", en: "sun", lang: "ar-PS", subs: [{ ar: "شموس", en: "suns" }] },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  assert.equal("ask" in plain.forms[0], false);
  assert.equal("ask" in plain.forms[1], false);
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
  assert.deepEqual(item.forms[0].recs.map((/** @type {any} */ r) => [r.id, r.label]),
    [["fast", ""], ["slow", "Slow"]]);
  assert.deepEqual(item.forms[1].recs.map((/** @type {any} */ r) => [r.id, r.label]),
    [["subslow", "Slow"]], "a form recorded only slowly still arrives with it");
  /* And each says its speed as a field rather than only inside its name:
     the player shows one of each and picks by this, and picking by reading
     a label back is guessing. */
  assert.deepEqual(item.forms[0].recs.map((/** @type {any} */ r) => r.speed), ["regular", "slow"]);
});

test("and an item that was never a course card has only the one name", () => {
  assert.equal(serverCardId({ id: "mine-1" }), "mine-1");
  assert.equal(serverCardId(null), "");
  assert.equal(serverCardId({}), "");
  /* A source with nothing useful in it is no source at all. */
  assert.equal(serverCardId({ id: "mine-2", source: {} }), "mine-2");
});

/*
 * What kind of card the editor asks about, and what a word lays out.
 *
 * Two questions, not one. A verb was a third answer to the first for a
 * release, and it stopped working the moment there was a second table to
 * offer — so the kind is a word, a sentence or a conversation, and which
 * table a *word* lays its forms out in is asked underneath. Neither is
 * stored: a card has a table when its forms carry cells in that table's
 * rows, and it is a sentence when its own word has a blank in it.
 */
test("a card is a word, a sentence or a conversation, and says which by what it holds", () => {
  assert.equal(shapeOf(null, false), "word");
  assert.equal(shapeOf(null, true), "scene");
  const worded = (/** @type {any} */ ar) => ({ id: "c", forms: [{ id: "c", ar, en: "x", lat: "" }] });
  assert.equal(shapeOf(worded("كتاب"), false), "word");
  /* The braces are in the text, so there is nothing to guess at: a card
     with a blank in it is a sentence whichever editor wrote it. */
  assert.equal(shapeOf(worded("{{noun}} كبير"), false), "sentence");
  /* And turns win over blanks, because a conversation is a different
     shape of card rather than a longer one. */
  assert.equal(shapeOf(worded("{{noun}}"), true), "scene");
});

test("a new card may be any of the three, and a written one stays what it can", () => {
  const values = (/** @type {any} */ o) => shapeChoices(o).map((/** @type {any} */ c) => c.value);
  assert.deepEqual(values({ saved: false, shape: "word", table: "" }),
    ["word", "sentence", "scene"]);
  /* A written conversation is offered nothing at all, so the block says
     what it is instead: a scene with four turns on it would have nowhere
     to put them. */
  assert.deepEqual(values({ saved: true, shape: "scene", table: "" }), []);
  /* A word and a sentence are the same card written two ways, so that
     pair stays open both ways — writing a blank into a word is how most
     sentences start. */
  assert.deepEqual(values({ saved: true, shape: "word", table: "" }), ["word", "sentence"]);
  assert.deepEqual(values({ saved: true, shape: "sentence", table: "" }), ["word", "sentence"]);
  /* Except where the card has a table, which is content: saving it as a
     sentence would drop it. */
  assert.deepEqual(values({ saved: true, shape: "word", table: "verb" }), ["word"]);
  assert.deepEqual(values({ saved: true, shape: "word", table: "attached" }), ["word"]);
});

test("and a word is asked what kind of word it is, in the language's own list", () => {
  const ids = (/** @type {any} */ lang) =>
    categoryChoices(lang).map((/** @type {any} */ c) => c.value);
  assert.ok(ids(LANGUAGES["ar-PS"]).includes("noun"));
  assert.ok(ids(LANGUAGES["ar-PS"]).includes("verb"));
  /* A pack that declares none is asked nothing, and its cards go on
     saying what they are by what they hold. */
  assert.deepEqual(ids(null), []);
  /* Every answer carries a line saying what it means, which is why this
     is a list of rows and not a track of segments. */
  assert.ok(categoryChoices(LANGUAGES["ar-PS"]).every((/** @type {any} */ o) => o.note));
});

test("what a word is decides which table it is offered", () => {
  const ar = LANGUAGES["ar-PS"];
  const viet = LANGUAGES["vi-Hue"];
  /* A verb has its persons and tenses; a noun and a preposition take the
     pronouns on their end. */
  assert.equal(tableFor(ar, "verb"), "verb");
  assert.equal(tableFor(ar, "noun"), "attached");
  assert.equal(tableFor(ar, "preposition"), "attached");
  /* An adjective its feminine and plural; a number its feminine. */
  assert.equal(tableFor(ar, "adjective"), "agreement");
  assert.equal(tableFor(ar, "number"), "counted");
  /* And everything else is the word and whatever forms the teacher
     writes — including a word nobody has said anything about. */
  assert.equal(tableFor(ar, "name"), "");
  assert.equal(tableFor(ar, "pronoun"), "");
  assert.equal(tableFor(ar, ""), "");
  assert.equal(tableFor(ar, "nonsense"), "");
  /* Huế attaches nothing and nothing agrees, so a noun and an adjective
     there have no table — which is what a category naming a table its
     pack has not got means. Its verbs still have theirs. */
  assert.equal(tableFor(viet, "noun"), "");
  assert.equal(tableFor(viet, "adjective"), "");
  assert.equal(tableFor(viet, "verb"), "verb");
});

/*
 * How far a deck has got.
 *
 * It was the cards with nothing left to open over all of them, so a deck
 * whose every card was three levels up and being asked to be written read
 * as nought per cent — and stayed there for weeks while the work went on.
 * A card now contributes its own share of itself: the levels it has
 * finished over the levels it has material for.
 *
 * Checked here rather than in the smoke harness because the seeded deck
 * has no card stopped partway, which is the only case where the old
 * measure and this one differ at all.
 */
test("a deck counts the levels its cards have finished, not only its finished cards", () => {
  /* Four cards, none of them finished, each halfway up its own ladder.
     The old measure called this nought. */
  assert.equal(deckPercent({ n: 4, learnt: 0, got: 2 }), 50);
  /* And one card of four finished, the rest untouched, is the number the
     old measure gave — the two agree wherever nothing is partway. */
  assert.equal(deckPercent({ n: 4, learnt: 1, got: 1 }), 25);
  /* A deck nobody has started is still nought. */
  assert.equal(deckPercent({ n: 9, learnt: 0, got: 0 }), 0);
});

test("and is held at 99 until the last card is in", () => {
  /* The rule the figure has always had: 199 of 200 is not a finished deck,
     and a tile reading 100% over a card still to learn is the one number
     here nobody would trust again. Read off the finished count rather than
     the sum, so a rounding cannot reach the hundred early. */
  assert.equal(deckPercent({ n: 200, learnt: 199, got: 199.6 }), 99);
  assert.equal(deckPercent({ n: 4, learnt: 3, got: 3.999 }), 99);
  /* And only every card finishing gets there. */
  assert.equal(deckPercent({ n: 4, learnt: 4, got: 4 }), 100);
  /* Rounded down the rest of the way: two thirds is 66, never 67. */
  assert.equal(deckPercent({ n: 3, learnt: 0, got: 2 }), 66);
  /* An empty deck is nought rather than a division by nothing. */
  assert.equal(deckPercent({ n: 0, learnt: 0, got: 0 }), 0);
});

/*
 * And how far one card has got on the level it is on, which is what the
 * bar on each tile under a level tile draws.
 *
 * The two numbers are the standing's own — what has to hold for the next
 * level to open, and how much of it does — so the only thing to check here
 * is that the proportion cannot say a thing the counts do not: a hundred
 * per cent means the level is done and nothing short of it does.
 */
test("a card's bar on a level is how much of what that level needs is behind it", () => {
  assert.equal(levelPercent({ done: 3, of: 8 }), 37);
  assert.equal(levelPercent({ done: 0, of: 4 }), 0);
  /* Full exactly when the level is done, which is `done === of` — the same
     test the scheduler opens the level above on. */
  assert.equal(levelPercent({ done: 8, of: 8 }), 100);
  /* And never a moment before it: rounded down, so the last exercise of a
     long level cannot be rounded away. */
  assert.equal(levelPercent({ done: 199, of: 200 }), 99);
  /* A card with nothing to practise has no bar to fill rather than a
     division by nothing. */
  assert.equal(levelPercent(null), 0);
  assert.equal(levelPercent({ done: 0, of: 0 }), 0);
});

/*
 * When the prompt has to say which form of a card it wants.
 *
 * A card's forms are drilled on their own and two of them can answer the
 * same question: مدرس and مدرسة are both "teacher". Asked to write
 * "teacher" in the script, a learner has no way to know which was wanted,
 * and writing the other is marked wrong for knowing the word.
 */
const form = (/** @type {any} */ o) => ({ ar: "", en: "", lat: "", ...o });

test("a prompt two forms of one card answer has to say which", () => {
  const masc = form({ id: "t", ar: "مدرس", en: "teacher", gender: "masculine" });
  const fem = form({ id: "t-f0", ar: "مدرسة", en: "teacher", gender: "feminine" });
  /* Writing it from its meaning: the prompt is "teacher", and so is the
     other form's. Nothing is on screen to compare — the learner finds out
     by being marked wrong. */
  assert.equal(
    formIsAmbiguous({ unit: masc, kin: [fem], shown: [], promptField: "en" }),
    true
  );
  /* And the other way round, which is the half that never got the tag: it
     was shown on sub-forms alone, so the card's own form — as easily
     confused with its feminine — was left bare. */
  assert.equal(
    formIsAmbiguous({ unit: fem, kin: [masc], shown: [], promptField: "en" }),
    true
  );
  /* Read the other way, the script tells them apart, so it does not. */
  assert.equal(
    formIsAmbiguous({ unit: masc, kin: [fem], shown: [], promptField: "ar" }),
    false
  );
});

test("and so does one with another form of the same card among the tiles", () => {
  const one = form({ id: "b", ar: "كتاب", en: "book", number: "singular" });
  const many = form({ id: "b-f0", ar: "كتب", en: "books", number: "plural" });
  const other = form({ id: "x", ar: "باب", en: "door" });
  /* Their meanings differ, so the prompt settles it on paper — but the
     pair standing side by side is what invites the mistake, and the tag is
     what turns "which of these?" into a question with one answer. */
  assert.equal(
    formIsAmbiguous({ unit: one, kin: [many], shown: [other, many], promptField: "en" }),
    true
  );
  /* Somebody else's word beside it is just a wrong answer. */
  assert.equal(
    formIsAmbiguous({ unit: one, kin: [many], shown: [other], promptField: "en" }),
    false
  );
});

test("and nothing is said where the question already settles it", () => {
  const one = form({ id: "b", ar: "كتاب", en: "book" });
  const many = form({ id: "b-f0", ar: "كتب", en: "books" });
  /* A card with no other form can never be ambiguous about which is meant. */
  assert.equal(formIsAmbiguous({ unit: one, kin: [], shown: [many], promptField: "en" }), false);
  /* A recording is of one form and a scene is its own question, so neither
     can collide this way. */
  assert.equal(
    formIsAmbiguous({ unit: one, kin: [{ ...many, en: "book" }], shown: [], promptField: "audio" }),
    false
  );
  /* An empty prompt field is not a collision with another empty one: a
     form with no transliteration is not the same as its sibling's. */
  assert.equal(
    formIsAmbiguous({ unit: one, kin: [many], shown: [], promptField: "lat" }),
    false
  );
  /* A stray space or a capital is not a difference a learner could answer
     by, so it is not one here either. */
  assert.equal(
    formIsAmbiguous({
      unit: form({ id: "a", en: "Teacher " }),
      kin: [form({ id: "a-f0", en: "teacher" })],
      shown: [],
      promptField: "en",
    }),
    true
  );
  /* And nothing at all on nothing, which is a question still being cast. */
  assert.equal(formIsAmbiguous({ unit: null, kin: [many], shown: [], promptField: "en" }), false);
});

/*
 * And which tiles of a matching grid say what form they are.
 *
 * The instruction says which form is being asked; in a grid every word is
 * asked, and the work is deciding which English goes with which word. Two
 * forms of one card in the same grid is the pairing nobody can reason out
 * — the two mean the same thing however differently the meanings are
 * written — so those tiles, and only those, carry their own grammar.
 */
/** @type {Record<string, string>} */
const owner = { a: "card", "a-f0": "card", z: "other", "z-f0": "other" };
const tagsFor = (/** @type {any[]} */ units) =>
  kinTags({
    units,
    cardOf: (/** @type {any} */ u) => owner[u.id] || "",
    labelOf: (/** @type {any} */ u) => u.tag || "",
  });

test("two forms of one card in a grid each say which they are", () => {
  const masc = form({ id: "a", ar: "مبسوط", en: "happy", tag: "sg. m." });
  const fem = form({ id: "a-f0", ar: "مبسوطة", en: "glad", tag: "sg. f." });
  const other = form({ id: "z", ar: "باب", en: "door", tag: "sg. m." });
  /* Both of them, and nobody else: a grid of five labelled words is a
     reading exercise about labels. */
  assert.deepEqual(tagsFor([masc, fem, other]), { a: "sg. m.", "a-f0": "sg. f." });
});

test("a form counted once however many tiles it is on", () => {
  /* A word and its own meaning are two tiles and one form. Handed in
     twice, it must not read as a card with two forms up. */
  const one = form({ id: "a", ar: "باب", en: "door", tag: "sg. m." });
  assert.deepEqual(tagsFor([one, one]), {});
});

test("and nothing is said where saying it would not help", () => {
  const one = form({ id: "a", ar: "كتاب", en: "book", tag: "sg. m." });
  const two = form({ id: "a-f0", ar: "كتب", en: "books", tag: "sg. m." });
  /* Tags that read alike tell nothing apart. */
  assert.deepEqual(tagsFor([one, two]), {});
  /* Nor does a language that declares no grammar — Huế has none, and a
     tile with an empty tag on it would be a mark with nothing to say. */
  assert.deepEqual(tagsFor([{ ...one, tag: "" }, { ...two, tag: "" }]), {});
  /* One of the pair named and the other not is worth saying: "book · pl."
     beside a bare "book" is still two tiles told apart. */
  assert.deepEqual(tagsFor([{ ...one, tag: "" }, { ...two, tag: "pl." }]), { "a-f0": "pl." });
  /* A form standing on its own is ambiguous with nobody. */
  assert.deepEqual(tagsFor([one, form({ id: "z", ar: "باب", en: "door", tag: "sg. f." })]), {});
});

test("forms of two different cards are two crowds, not one", () => {
  const a1 = form({ id: "a", tag: "sg. m." });
  const a2 = form({ id: "a-f0", tag: "pl." });
  const z1 = form({ id: "z", tag: "sg. f." });
  assert.deepEqual(tagsFor([a1, z1]), {}, "one form apiece says nothing");
  assert.deepEqual(tagsFor([a1, a2, z1]), { a: "sg. m.", "a-f0": "pl." });
});

test("and a form whose card nobody can name stands on its own", () => {
  /* Otherwise every form the lookup missed would join one crowd of
     strangers and get tagged for the company it never kept. */
  const x = form({ id: "x", tag: "sg. m." });
  const y = form({ id: "y", tag: "pl." });
  assert.deepEqual(tagsFor([x, y]), {});
  /* Nothing at all on nothing, which is a grid still being dealt. */
  assert.deepEqual(tagsFor([null, undefined, form({ id: "", tag: "pl." })]), {});
});

/*
 * A table, on its way to the learner.
 *
 * Where a cell sits did not come across at all until 0.131 — the teacher's
 * card carried a row and a column and the item built from it carried
 * neither — so a verb's table reached a student as a heap of alternate
 * forms: no row opened before another, the word a dictionary lists was
 * drilled twice over, and no sentence ever agreed with what filled it.
 * Everything that reads a table reads these three fields, so everything
 * that reads a table read nothing.
 */
test("a cell arrives knowing where it sits and whose table it is in", () => {
  const item = cardToItem(
    {
      id: "k2", ar: "كِتاب", en: "book", lang: "ar-PS",
      subs: [
        { id: "pl", ar: "كُتُب", en: "books" },
        { row: "attached", col: "me", ar: "كتابي", en: "my book" },
        { of: "pl", row: "attached", col: "me", ar: "كتبي", en: "my books" },
      ],
    },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  const [, plural, mine, ours] = item.forms;
  assert.equal(plural.row, undefined, "a form that is not a cell gains no coordinates");
  assert.equal(mine.row, "attached");
  assert.equal(mine.col, "me");
  assert.equal(mine.of, undefined, "a cell of the card's own table names no owner");
  /* And the plural's cell points at the plural — by the name this device
     gave it, not by the teacher's, so a cell points at the form beside it
     rather than at a name from another machine. */
  assert.equal(ours.of, plural.id);
  assert.equal(plural.id, `${localIdFor("k2")}-f~pl`);
});

test("a form is named after itself where it has a name, and after its place where it has not", () => {
  const item = cardToItem(
    { id: "k3", ar: "a", en: "a", lang: "ar-PS", subs: [{ ar: "b", en: "b" }, { id: "x7", ar: "c", en: "c" }] },
    "Lesson 1", "c1", "d1", () => ({}),
  );
  /* The old shape, for every form written before forms had names. */
  assert.equal(item.forms[1].id, `${localIdFor("k3")}-f0`);
  /* And the new one, which cannot collide with it: a name is never a bare
     number, because of the tilde. */
  assert.equal(item.forms[2].id, `${localIdFor("k3")}-f~x7`);
});

/*
 * Which of the teacher's forms a student's progress belongs to.
 *
 * It was the form's place in the list, and a place is not an identity: a
 * teacher who inserted a form above another handed the second's schedule
 * to the first, silently, on every device holding the card.
 */
test("a form's progress follows the form, not its place in the list", () => {
  /** @param {string} id @param {number} reps */
  const form = (id, reps) => ({ id, ar: id, en: id, s: { ar2en: { phase: "review", reps } } });
  const had = [
    { id: "srvk4", source: { cardId: "k4" },
      forms: [form("srvk4", 1), form("srvk4-f~one", 3), form("srvk4-f~two", 9)] },
  ];
  /* The teacher inserts a form above the two that were there. */
  const fresh = [
    { id: "srvk4", source: { cardId: "k4" },
      forms: [
        { id: "srvk4", ar: "a", en: "a", s: {} },
        { id: "srvk4-f~new", ar: "n", en: "n", s: {} },
        { id: "srvk4-f~one", ar: "a", en: "a", s: {} },
        { id: "srvk4-f~two", ar: "b", en: "b", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.deepEqual(out.forms.map((/** @type {any} */ f) => f.id),
    ["srvk4", "srvk4-f~new", "srvk4-f~one", "srvk4-f~two"]);
  assert.equal(out.forms[0].s.ar2en.reps, 1, "the card's own word keeps its work");
  assert.equal(out.forms[1].s.ar2en, undefined, "the new form starts fresh");
  assert.equal(out.forms[2].s.ar2en.reps, 3, "and each of the others keeps its own");
  assert.equal(out.forms[3].s.ar2en.reps, 9);
});

test("a card the learner asked for stays asked for when the teacher edits it", () => {
  /* The mark is the learner's and the card is the teacher's, and a refresh
     takes the teacher's card whole — so without being told, the
     forty-five-second poll would quietly clear every card anybody had
     marked. The schedule was already carried over; this rides beside it. */
  const had = [
    { id: "srvk6", source: { cardId: "k6" }, priority: true,
      forms: [{ id: "srvk6", ar: "a", en: "a", s: { ar2en: { phase: "review", reps: 4 } } }] },
    { id: "srvk7", source: { cardId: "k7" },
      forms: [{ id: "srvk7", ar: "b", en: "b", s: {} }] },
  ];
  /* The teacher has corrected the wording of both. */
  const fresh = [
    { id: "srvk6", source: { cardId: "k6" },
      forms: [{ id: "srvk6", ar: "a!", en: "a!", s: {} }] },
    { id: "srvk7", source: { cardId: "k7" },
      forms: [{ id: "srvk7", ar: "b!", en: "b!", s: {} }] },
  ];
  const out = foldCourses(had, fresh).items;
  assert.equal(out[0].priority, true, "the mark survives the teacher's edit");
  assert.equal(out[0].forms[0].ar, "a!", "and the teacher's wording still wins");
  assert.equal(out[0].forms[0].s.ar2en.reps, 4, "beside the progress, as before");
  assert.equal(out[1].priority, undefined, "a card nobody marked gains nothing");
});

test("a card the learner asked for comes home asked for", () => {
  /*
   * A course card can go missing for reasons that are nobody's decision —
   * a deck detached and reattached, a student briefly off a course, one
   * record the server could not read — which is what the drawer is for.
   * The schedules went into it and the mark did not, so a learner whose
   * deck came back found the cards they had asked for quietly no longer in
   * their sessions, with nothing anywhere to say why.
   */
  const had = [
    { id: "srvk20", source: { cardId: "k20" }, priority: true, priorityAt: 500,
      forms: [{ id: "srvk20", ar: "a", en: "a", s: { ar2en: { phase: "review", reps: 4, updated: 1 } } }] },
  ];
  const away = foldCourses(had, []);
  assert.equal(away.items.length, 0, "the card went away with the material");
  const back = foldCourses(away.items, [
    { id: "srvk20", source: { cardId: "k20" }, forms: [{ id: "srvk20", ar: "a", en: "a", s: {} }] },
  ], away.parked);
  const out = back.items[0];
  assert.equal(out.priority, true, "the mark came home with the card");
  assert.equal(out.priorityAt, 500, "and so did the time it was set");
  assert.equal(out.forms[0].s.ar2en.reps, 4, "beside the progress, as before");
});

test("and a card marked the day it arrived is not set aside empty-handed", () => {
  /* The drawer used to keep only cards with a schedule in them, and a card
     marked before it was ever answered has none — which is exactly the card
     a learner would notice going missing. */
  const had = [
    { id: "srvk21", source: { cardId: "k21" }, priority: true, priorityAt: 500,
      forms: [{ id: "srvk21", ar: "a", en: "a", s: {} }] },
  ];
  const away = foldCourses(had, []);
  const back = foldCourses(away.items, [
    { id: "srvk21", source: { cardId: "k21" }, forms: [{ id: "srvk21", ar: "a", en: "a", s: {} }] },
  ], away.parked);
  assert.equal(back.items[0].priority, true, "the mark was thrown out with the card");
});

test("a mark the learner cleared stays cleared through a refresh", () => {
  /*
   * "No longer wanted, as of then" is an answer, and it only beats an older
   * yes on another device while it carries its time — which is why the card
   * stores `false` rather than dropping the field. The fold carried a yes
   * and nothing else, so clearing a mark and waiting forty-five seconds
   * left a card that said nothing at all: the next sync handed back the
   * other device's yes, and the card the learner had just let go of was
   * back at the front of every session.
   */
  const had = [
    { id: "srvk22", source: { cardId: "k22" }, priority: false, priorityAt: 900,
      forms: [{ id: "srvk22", ar: "a", en: "a", s: {} }] },
  ];
  const fresh = [{ id: "srvk22", source: { cardId: "k22" }, forms: [{ id: "srvk22", ar: "a", en: "a", s: {} }] }];
  const out = foldCourses(had, fresh).items[0];
  assert.equal(out.priority, false, "the card still says the learner let it go");
  assert.equal(out.priorityAt, 900, "and when they did, which is what makes it stick");
});

/*
 * And the two things the fold used to leave behind.
 *
 * A refresh takes the teacher's card whole, so anything of the learner's
 * that is not carried across by name is wiped — and the refresh runs
 * every forty-five seconds. The schedules of a card's forms were carried;
 * the turns of a conversation, and a frame's record of which words it has
 * been filled with, were not.
 */
test("a conversation's turns keep their progress when the teacher edits the scene", () => {
  /* Every line is drilled in its own right, with its own recordings and
     its own schedule — so taking the lines from the teacher's copy sent
     every one of them back to never-answered on the next poll. */
  const had = [
    { id: "srvk9", source: { cardId: "k9" },
      forms: [{ id: "srvk9", ar: "t", en: "t", s: {} }],
      lines: [
        { id: "srvk9-l0", ar: "مرحبا", en: "hello", s: { dlgpick: { phase: "review", reps: 5 } } },
        { id: "srvk9-l1", ar: "أهلا", en: "hi", s: { dlgpick: { phase: "review", reps: 2 } } },
      ] },
  ];
  /* The teacher fixes a typo in the second turn. */
  const fresh = [
    { id: "srvk9", source: { cardId: "k9" },
      forms: [{ id: "srvk9", ar: "t", en: "t", s: {} }],
      lines: [
        { id: "srvk9-l0", ar: "مرحبا", en: "hello", s: {} },
        { id: "srvk9-l1", ar: "أهلاً", en: "hi there", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.equal(out.lines[0].s.dlgpick.reps, 5, "the first turn keeps its work");
  assert.equal(out.lines[1].s.dlgpick.reps, 2, "and so does the one that was edited");
  assert.equal(out.lines[1].en, "hi there", "while the teacher's wording still wins");
});

test("a frame keeps its record of the words it has been filled with", () => {
  /* `met` is how far a hole has been filled with each value, and it is the
     only thing gating a value that has no ladder of its own. Dropped, every
     name the frame had taught read as unmet again. */
  const had = [
    { id: "srvka", source: { cardId: "ka" },
      forms: [{ id: "srvka", ar: "اسمي {{name}}", en: "my name is {{name}}",
        s: { ar2en: { phase: "review", reps: 3 } }, met: { "name:raphael": 3, "name:sarah": 1 } }] },
  ];
  const fresh = [
    { id: "srvka", source: { cardId: "ka" },
      forms: [{ id: "srvka", ar: "اسمي {{name}}", en: "my name is {{name}}", s: {} }] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.deepEqual(out.forms[0].met, { "name:raphael": 3, "name:sarah": 1 });
  /* A high-water mark, so the further of the two wins and it does not
     matter which side is asked — the same rule sync merges it by. */
  const bothWays = foldCourses(
    had,
    [{ id: "srvka", source: { cardId: "ka" },
      forms: [{ id: "srvka", ar: "x", en: "x", s: {}, met: { "name:raphael": 1, "name:leila": 2 } }] }],
  ).items[0];
  assert.deepEqual(bothWays.forms[0].met,
    { "name:raphael": 3, "name:sarah": 1, "name:leila": 2 });
  /* And a card that never had one does not start carrying an empty one. */
  const plain = foldCourses(
    [{ id: "srvkb", source: { cardId: "kb" }, forms: [{ id: "srvkb", ar: "a", en: "a", s: {} }] }],
    [{ id: "srvkb", source: { cardId: "kb" }, forms: [{ id: "srvkb", ar: "a", en: "a", s: {} }] }],
  ).items[0];
  assert.equal(plain.forms[0].met, undefined);
});

/*
 * A card that goes away, and the work that was on it.
 *
 * A course card the device no longer sees is dropped and tombstoned, and
 * everything the learner had earned on it went with it — on every device
 * they own, because the tombstone syncs. But a card can go missing for
 * reasons that are nobody's decision: a deck detached and reattached, a
 * student briefly off a course, one record the server could not read. So
 * the work is set aside instead, and put back if the card returns.
 */
test("a withdrawn card's work is set aside, and comes back with the card", () => {
  const had = [
    { id: "srvkc", source: { cardId: "kc" },
      forms: [
        { id: "srvkc", ar: "a", en: "a", s: { ar2en: { phase: "review", reps: 7 } },
          met: { "name:sarah": 2 } },
        { id: "srvkc-f~one", ar: "b", en: "b", s: { en2ar: { phase: "review", reps: 3 } } },
      ],
      lines: [{ id: "srvkc-l0", ar: "c", en: "c", s: { dlgpick: { phase: "review", reps: 5 } } }] },
  ];
  /* The refresh brings back nothing: the course no longer lists the card. */
  const withdrawn = foldCourses(had, []);
  assert.deepEqual(withdrawn.goneIds, ["srvkc"], "the card is named as gone, so it can be tombstoned");
  assert.deepEqual(withdrawn.items, [], "and it is not kept on the device");
  const saved = withdrawn.parked["srvkc"];
  assert.ok(saved, "but its work is in the drawer");
  assert.equal(saved.forms["srvkc"].s.ar2en.reps, 7);
  assert.deepEqual(saved.forms["srvkc"].met, { "name:sarah": 2 });
  assert.equal(saved.forms["srvkc-f~one"].s.en2ar.reps, 3, "every form of it, by name");
  assert.equal(saved.lines["srvkc-l0"].s.dlgpick.reps, 5, "and every turn of it");

  /* The deck is reattached. The teacher's copy has never carried any of
     this, so the card arrives never-answered — and leaves with its work. */
  const back = foldCourses([], [
    { id: "srvkc", source: { cardId: "kc" },
      forms: [
        { id: "srvkc", ar: "a", en: "a", s: {} },
        { id: "srvkc-f~one", ar: "b", en: "b", s: {} },
      ],
      lines: [{ id: "srvkc-l0", ar: "c", en: "c", s: {} }] },
  ], withdrawn.parked);
  const home = back.items[0];
  assert.equal(home.forms[0].s.ar2en.reps, 7, "the card's own word has its schedule again");
  assert.deepEqual(home.forms[0].met, { "name:sarah": 2 });
  assert.equal(home.forms[1].s.en2ar.reps, 3);
  assert.equal(home.lines[0].s.dlgpick.reps, 5);
  assert.equal(back.parked["srvkc"], undefined, "and the drawer is emptied of it");
});

test("a card that never had any work leaves nothing in the drawer", () => {
  /* Otherwise every withdrawn card in a course nobody has started would
     sit in the drawer for a fortnight, in every document that syncs. */
  const had = [
    { id: "srvkd", source: { cardId: "kd" }, forms: [{ id: "srvkd", ar: "a", en: "a", s: {} }] },
  ];
  assert.deepEqual(foldCourses(had, []).parked, {});
});

test("a turn taken out of a scene does not cost the others their progress", () => {
  /* The teacher deletes the middle turn of three. Matching by name means
     the two that remain keep their own work rather than sliding up a
     place and taking each other's. */
  const had = [
    { id: "srvke", source: { cardId: "ke" },
      forms: [{ id: "srvke", ar: "t", en: "t", s: {} }],
      lines: [
        { id: "srvke-l0", ar: "one", en: "one", s: { dlgpick: { phase: "review", reps: 1 } } },
        { id: "srvke-l1", ar: "two", en: "two", s: { dlgpick: { phase: "review", reps: 2 } } },
        { id: "srvke-l2", ar: "three", en: "three", s: { dlgpick: { phase: "review", reps: 3 } } },
      ] },
  ];
  const fresh = [
    { id: "srvke", source: { cardId: "ke" },
      forms: [{ id: "srvke", ar: "t", en: "t", s: {} }],
      lines: [
        { id: "srvke-l0", ar: "one", en: "one", s: {} },
        { id: "srvke-l2", ar: "three", en: "three", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.deepEqual(out.lines.map((/** @type {any} */ l) => l.id), ["srvke-l0", "srvke-l2"]);
  assert.equal(out.lines[0].s.dlgpick.reps, 1, "the first turn keeps its own");
  assert.equal(out.lines[1].s.dlgpick.reps, 3, "and the last keeps its own, not the deleted one's");
});

test("a card marked on this device only is not invented on one that has it too", () => {
  /* The other way round: the teacher's copy never carries the mark, so a
     card the learner has not marked must not come back marked. */
  const had = [{ id: "srvk8", source: { cardId: "k8" }, forms: [{ id: "srvk8", ar: "c", en: "c", s: {} }] }];
  const fresh = [{ id: "srvk8", source: { cardId: "k8" }, priority: true, forms: [{ id: "srvk8", ar: "c", en: "c", s: {} }] }];
  const out = foldCourses(had, fresh).items[0];
  assert.equal(out.priority, true, "what the incoming card says still stands where it says something");
});

test("and forms that gain names all at once keep the progress they had", () => {
  /* The release that names them renames every form on every card. A card
     whose forms have all been renamed at once is the same card in the same
     order, not two new ones — so where nothing matches by name, the places
     are taken as they stand. */
  /** @param {string} id @param {number} reps */
  const form = (id, reps) => ({ id, ar: id, en: id, s: { ar2en: { phase: "review", reps } } });
  const had = [
    { id: "srvk5", source: { cardId: "k5" },
      forms: [form("srvk5", 1), form("srvk5-f0", 3), form("srvk5-f1", 9)] },
  ];
  const fresh = [
    { id: "srvk5", source: { cardId: "k5" },
      forms: [
        { id: "srvk5", ar: "a", en: "a", s: {} },
        { id: "srvk5-f~one", ar: "a", en: "a", s: {} },
        { id: "srvk5-f~two", ar: "b", en: "b", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.equal(out.forms[1].s.ar2en.reps, 3);
  assert.equal(out.forms[2].s.ar2en.reps, 9);
});

/*
 * The narrower ladder a known word's pronouns climb.
 *
 * Eight cells per form, each differing from the word by an ending learnt
 * once: asking every exercise of all of them is asking a fortnight's worth
 * of questions about something already known. So the cells of a form whose
 * word is written from its meaning are asked one exercise a level — the
 * same four rungs, one question each.
 */
test("a known word's cells are asked one exercise a level", () => {
  /* Read off the level each key stands on, in the order they are handed
     in — which is TYPES order, so which one survives is the same today as
     tomorrow. */
  assert.deepEqual(
    onePerLevel(["ar2pick", "ar2en", "rec2en", "en2pick", "ar2tr", "rec2ar", "en2ar", "ctx2ar"]),
    ["ar2pick", "en2pick", "ar2tr", "en2ar"],
  );
  /* A card accepting two spellings is asked for one of them rather than
     both, which is the same redundancy one axis over. */
  assert.deepEqual(onePerLevel(["ar2en", "ar2en@1"]), ["ar2en"]);
  /* A level the form has nothing on is not invented, and nothing at all
     comes back as nothing. */
  assert.deepEqual(onePerLevel(["ar2en", "en2ar"]), ["ar2en", "en2ar"]);
  assert.deepEqual(onePerLevel([]), []);
});

/*
 * A table waits on the word it is a table of.
 *
 * "my book" is a form of "book": meeting the two together is meeting a
 * word you have not learnt in a shape you cannot read, so a form's
 * pronouns are held until that form has been read a few times. Held per
 * form, which is the whole of what 0.131 changed — one gate on the card
 * opened the plural's eight the moment the singular was recognised.
 */
const settings = { language: "ar-PS", kinds: {} };
/** @param {string} phase @param {number} interval */
const state = (phase, interval) => ({
  phase, step: 0, ease: 2.5, interval, due: 0, reps: 3, lapses: 0,
  right: 3, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0,
});
/** Every exercise a form could be asked, at one standing. */
const allAt = (/** @type {any} */ s) =>
  Object.fromEntries(TYPES.map((/** @type {string} */ t) => [t, s]));

/** @param {Record<string, any>} over @returns {any} */
const bookCard = (over) => ({
  id: "book", ar: "كِتاب", en: "book", lat: "kitaab", lang: "ar-PS", kind: "word",
  s: {}, ...over,
  subs: [
    { id: "pl", ar: "كُتُب", en: "books", lat: "kutub", lang: "ar-PS", s: {} },
    { id: "s-me", ar: "كتابي", en: "my book", lat: "kitaabi", lang: "ar-PS",
      row: "attached", col: "me", s: {} },
    { id: "p-me", of: "pl", ar: "كتبي", en: "my books", lat: "kutubi", lang: "ar-PS",
      row: "attached", col: "me", s: {} },
    ...(over.subs || []),
  ].map((f) => ({ ...f, ...((over.states || {})[f.id] ? { s: over.states[f.id] } : null) })),
});

test("a form's pronouns wait on that form, not on the card's own word", () => {
  /* Nobody has answered anything: both tables are shut. */
  const cold = quietUnits([bookCard({})], settings);
  assert.ok(cold.has("s-me") && cold.has("p-me"), "both wait while nothing has been read");

  /* The card's own word is read and its pronouns open — and the plural's
     do not, the plural itself being untouched. */
  const warm = quietUnits(
    [bookCard({ s: allAt(state("review", 1)) })],
    settings,
  );
  assert.equal(warm.has("s-me"), false, "the word's own pronouns open with the word");
  assert.equal(warm.has("p-me"), true, "and the plural's are still waiting on the plural");

  /* And they open when the plural itself is read. */
  const both = quietUnits(
    [bookCard({ s: allAt(state("review", 1)), states: { pl: allAt(state("review", 1)) } })],
    settings,
  );
  assert.equal(both.has("p-me"), false);
});

/*
 * And once the word is written from its meaning, its pronouns are asked
 * one exercise a level rather than all of them: eight cells that differ by
 * an ending learnt once is a fortnight of questions about something
 * already known.
 */
test("a known word's cells are eased, and only those", () => {
  const learning = easedUnits([bookCard({ s: allAt(state("review", 1)) })], settings);
  assert.equal(learning.size, 0, "a word merely being reviewed eases nothing");

  const known = easedUnits([bookCard({ s: allAt(state("review", 40)) })], settings);
  assert.ok(known.has("s-me"), "the word's own cells are eased once it is mastered");
  assert.equal(known.has("p-me"), false, "the plural's are not, the plural not being there yet");
  assert.equal(known.has("pl"), false, "and a form that is not a cell is never eased");
});

/*
 * Which rule a table's cells wait by is the table's own answer, read off
 * the table rather than off which accessor it came from. An adjective's
 * feminine and plural wait on the word the way the pronouns do — without
 * anything in the trainer having been told there is such a table.
 */
/** @param {Record<string, any>} over @returns {any} */
const bigCard = (over) => ({
  id: "big", ar: "كبير", en: "big", lat: "kbiir", lang: "ar-PS", kind: "word",
  category: "adjective", s: {}, ...over,
  subs: [
    { id: "big-f", ar: "كبيرة", en: "big (f)", lat: "kbiire", lang: "ar-PS",
      row: "agreement", col: "feminine", s: {} },
    { id: "big-pl", ar: "كبار", en: "big (pl)", lat: "kbaar", lang: "ar-PS",
      row: "agreement", col: "plural", s: {} },
  ],
});

test("an adjective's forms wait on the word, and ease once it is known", () => {
  const cold = quietUnits([bigCard({})], settings);
  assert.ok(cold.has("big-f") && cold.has("big-pl"), "both wait while the word is unread");
  const warm = quietUnits([bigCard({ s: allAt(state("review", 1)) })], settings);
  assert.equal(warm.has("big-f"), false, "and open with it");
  assert.equal(warm.has("big-pl"), false);
  const known = easedUnits([bigCard({ s: allAt(state("review", 40)) })], settings);
  assert.ok(known.has("big-f") && known.has("big-pl"), "eased once the word is mastered");
});

test("a card carrying two tables is gated on both", () => {
  /* The verb rule used to end the card early. Read as a loop over tables,
     a card whose forms carried a verb's rows *and* a pronoun's row would
     have its second table never gated at all. */
  const card = bookCard({
    subs: [
      { id: "v-past", ar: "x", en: "y", lat: "", lang: "ar-PS", row: "present", col: "he", s: {} },
      { id: "v-cmd", ar: "x", en: "y", lat: "", lang: "ar-PS", row: "command", col: "he", s: {} },
    ],
  });
  const quiet = quietUnits([card], settings);
  assert.ok(quiet.has("s-me"), "the pronouns wait on the unread word");
  assert.ok(quiet.has("v-cmd"), "and the command waits on the present");
  assert.equal(quiet.has("v-past"), false, "while the first row is open");
});

/*
 * A sentence puts the agreeing form beside its noun.
 *
 * The values a sentence was filled with, after the draw: an adjective's
 * own word is swapped for the form that agrees with the slot beside it,
 * read back through the card it came from.
 */
test("an adjective drawn into a sentence is swapped for the form that agrees with the noun beside it", () => {
  const ar = LANGUAGES["ar-PS"];
  const big = /** @type {any} */ ({
    id: "big", lang: "ar-PS", category: "adjective",
    forms: [
      { id: "big", ar: "كبير", en: "big", lat: "" },
      { id: "big-f", ar: "كبيرة", en: "big", lat: "", row: "agreement", col: "feminine" },
    ],
  });
  const owners = /** @type {Record<string, any>} */ ({ big: { card: big, form: big.forms[0] } });
  const ownerOf = (/** @type {any} */ v) => owners[v.id] || null;
  const noun = (/** @type {Record<string, string>} */ grammar) =>
    ({ id: "n", ar: "x", en: "y", lat: "", grammar });
  const word = { id: "big", ar: "كبير", en: "big", lat: "" };

  const she = agreeTook({ noun: noun({ number: "singular", gender: "feminine", human: "thing" }), adjective: word },
    ["noun", "adjective"], ownerOf, () => ar);
  assert.equal(must(she, "filled").adjective.ar, "كبيرة");
  assert.equal(must(she, "filled").noun.ar, "x", "the noun is left as it was drawn");

  const he = agreeTook({ noun: noun({ number: "singular", gender: "masculine", human: "thing" }), adjective: word },
    ["noun", "adjective"], ownerOf, () => ar);
  assert.equal(must(he, "filled").adjective.ar, "كبير", "and the word itself where nothing picks");

  /* A value nothing owns, or a card whose forms do not agree, is left alone. */
  const loose = agreeTook({ noun: noun({ gender: "feminine" }), adjective: word }, ["noun", "adjective"], () => null, () => ar);
  assert.equal(must(loose, "filled").adjective.ar, "كبير");

  /* A column that picks a cell the teacher left blank: nothing to ask. */
  const half = /** @type {any} */ ({ ...big, forms: [big.forms[0], { ...big.forms[1], ar: "" }] });
  const blank = agreeTook({ noun: noun({ number: "singular", gender: "feminine" }), adjective: word },
    ["noun", "adjective"], () => ({ card: half, form: half.forms[0] }), () => ar);
  assert.equal(blank, null);
});

/*
 * What a card opens as in the editor, and what a save carries — the rules
 * the four editors stand on, asked without a screen.
 */
const arLang = LANGUAGES["ar-PS"];
const arVerb = verbOf(arLang);
const arAttached = attachedOf(arLang);
const arAgreement = must(specOf(arLang, "agreement"), "Arabic agreement");
/** @param {string} row @param {string} col @param {Record<string, any>} [over] */
const cellOf = (row, col, over = {}) => ({ ar: "x", en: "y", lat: "", clips: [], row, col, ...over });

test("a card opens with its own word first, then its forms, each with a name", () => {
  const fresh = initialForms(null, { ar: "كتاب", en: "book" });
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].ar, "كتاب", "a suggestion arrives with its word written");
  assert.equal(fresh[0].id, undefined, "the card's own word is not a named form");

  const saved = initialForms(
    /** @type {any} */ ({ id: "k", ar: "كتاب", en: "book", lat: "kitaab", subs: [
      { ar: "كتب", en: "books" },
      { id: "fkeep", ar: "كتيب", en: "booklet" },
      cellOf("attached", "me"),
    ] }),
    null,
  );
  assert.deepEqual(saved.map((/** @type {any} */ f) => f.ar), ["كتاب", "كتب", "كتيب"], "cells are held apart");
  assert.match(saved[1].id, /^f[a-z0-9]+$/, "a form written before forms had names is given one");
  assert.equal(saved[2].id, "fkeep", "and one that has a name keeps it");
});

test("only a verb has its dictionary form seeded", () => {
  /* A word with pronouns on its end has cells, and is not a verb. Seeding
     it opened the card on the verb table and dropped the pronouns on save. */
  const pen = /** @type {any} */ ({ id: "p", ar: "قلم", en: "pen", subs: [cellOf("attached", "me", { ar: "قلمي" })] });
  const cells = initialCells(pen, arLang);
  assert.deepEqual(cells.map((/** @type {any} */ c) => [c.row, c.col]), [["attached", "me"]]);
  assert.equal(initialCategory(pen, LANGUAGES["ar-PS"], cells), "noun");

  /* A verb whose cited cell nobody filled gets its word put there. */
  const eat = /** @type {any} */ ({ id: "e", ar: "أكل", en: "to eat", subs: [cellOf("present", "he", { ar: "بياكل" })] });
  const seeded = initialCells(eat, arLang);
  assert.ok(seeded.some((/** @type {any} */ c) => c.row === "past" && c.col === "he" && c.ar === "أكل"));
  assert.equal(initialCategory(eat, LANGUAGES["ar-PS"], seeded), "verb");

  /* And a plain word has no table at all. */
  assert.deepEqual(initialCells(/** @type {any} */ ({ id: "w", ar: "شمس", en: "sun", subs: [] }), arLang), []);
  assert.equal(initialCategory(/** @type {any} */ ({ id: "w" }), LANGUAGES["ar-PS"], []), "");

  /* An adjective's table cites nothing, so nothing is seeded — and a card
     carrying one opens as an adjective, read the way the tables are
     declared. */
  const big = /** @type {any} */ ({ id: "b", ar: "كبير", en: "big", subs: [cellOf("agreement", "feminine", { ar: "كبيرة" })] });
  const bigCells = initialCells(big, arLang);
  assert.deepEqual(bigCells.map((/** @type {any} */ c) => [c.row, c.col]), [["agreement", "feminine"]]);
  assert.equal(initialCategory(big, arLang, bigCells), "adjective");
  assert.equal(initialCategory(big, arLang, [cellOf("counted", "feminine")]), "number");
});

/*
 * What a card says it is when it is opened: the teacher's answer where
 * there is one, and what the card holds where there is not.
 */
test("a card opens as what the teacher said, or as what it looks like", () => {
  const ar = LANGUAGES["ar-PS"];
  const said = /** @type {any} */ ({ id: "a", category: "adjective" });
  assert.equal(initialCategory(said, ar, []), "adjective", "the teacher's answer wins");
  /* Even against the table: a card is what it says it is, and the cells
     are only read where nobody has said. */
  const both = /** @type {any} */ ({ id: "b", category: "preposition" });
  assert.equal(initialCategory(both, ar, [cellOf("attached", "me")]), "preposition");
  /* A category this pack does not declare is no answer at all — the card
     falls back to what it holds. */
  const odd = /** @type {any} */ ({ id: "c", category: "particle" });
  assert.equal(initialCategory(odd, ar, [cellOf("past", "he")]), "verb");
  assert.equal(initialCategory(odd, ar, []), "");
  /* And a language that declares no categories asks nothing, so nothing
     is ever said. */
  assert.equal(initialCategory(said, null, []), "");
});

test("a saved card is told what it lays out, and a new one is asked", () => {
  assert.equal(storedFormsOf(null, arLang), "");
  assert.equal(storedFormsOf(/** @type {any} */ ({ subs: [cellOf("past", "he")] }), arLang), "verb");
  assert.equal(storedFormsOf(/** @type {any} */ ({ subs: [cellOf("attached", "me")] }), arLang), "attached");
  assert.equal(storedFormsOf(/** @type {any} */ ({ subs: [cellOf("agreement", "plural")] }), arLang), "agreement");
  assert.equal(storedFormsOf(/** @type {any} */ ({ subs: [{ ar: "a", en: "b" }] }), arLang), "");
  /* And a table this language does not lay out is no table here. */
  assert.equal(storedFormsOf(/** @type {any} */ ({ subs: [cellOf("agreement", "plural")] }), LANGUAGES["vi-Hue"]), "");
});

test("the table put aside is counted, filled boxes only, and never the one on screen", () => {
  const cells = [cellOf("past", "he", { ar: "أكل" }), cellOf("past", "she", { ar: "" }), cellOf("attached", "me", { ar: "كتابي" })];
  assert.equal(asideOf(cells, [arVerb, arAttached], arVerb), 1, "the pronoun is what showing the verb puts aside");
  assert.equal(asideOf(cells, [arVerb, arAttached], arAttached), 1, "the filled verb cell, not the empty one");
  assert.equal(asideOf(cells, [arVerb, arAttached], null), 2, "with neither on screen, both are aside");
  assert.equal(asideOf([], [arVerb, arAttached], null), 0);
});

test("a save carries the table on screen, minus cells whose form is gone or blank", () => {
  const forms = [{ ar: "كتاب", en: "book" }, { id: "pl", ar: "كتب", en: "books" }, { id: "empty", ar: "", en: "" }];
  const cells = [
    cellOf("attached", "me", { ar: "كتابي" }),
    cellOf("attached", "me", { ar: "كتبي", of: "pl" }),
    cellOf("attached", "me", { ar: "?", of: "empty" }),
    cellOf("attached", "me", { ar: "?", of: "gone" }),
    cellOf("past", "he", { ar: "أكل" }),
  ];
  assert.deepEqual(tableCellsOf(cells, arAttached, forms).map((/** @type {any} */ c) => c.ar), ["كتابي", "كتبي"]);
  assert.deepEqual(tableCellsOf(cells, arVerb, forms).map((/** @type {any} */ c) => c.ar), ["أكل"]);
  assert.deepEqual(tableCellsOf(cells, null, forms), [], "no table on screen, nothing carried");
});

test("what can be saved: a word needs its script and its English, a scene a name and two turns", () => {
  assert.equal(canSaveWord({ ar: "كتاب", en: "book" }, null), true);
  assert.equal(canSaveWord({ ar: "كتاب", en: "  " }, null), false);
  assert.equal(canSaveWord({ ar: "", en: "book" }, null), false);
  assert.equal(canSaveWord({ ar: "كتاب", en: "book" }, { field: "en", missing: ["name"] }), false, "a field disagreeing about a blank");
  assert.equal(canSaveScene("At the door", [{}, {}]), true);
  assert.equal(canSaveScene("  ", [{}, {}]), false);
  assert.equal(canSaveScene("At the door", [{}]), false);
  assert.deepEqual(writtenLines([{ ar: "سلام" }, { ar: " " }, { ar: "" }]).map((/** @type {any} */ l) => l.ar), ["سلام"]);
});

/*
 * What is asked about, and what is only written down.
 *
 * A form kept on the card without being drilled is the thing that had no
 * way of being said: the only way to stop a form being asked was to delete
 * it, which took its recordings and every student's progress with it.
 */
test("every form is asked about until somebody says otherwise", () => {
  assert.equal(partAsked({ ar: "كتاب" }), true, "absent means asked");
  assert.equal(partAsked({ ar: "كتاب", ask: true }), true);
  assert.equal(partAsked({ ar: "كتاب", ask: false }), false);
  assert.equal(partAsked(null), false, "nothing is not a form");
});

test("a plain word has nothing to choose between, and a word with a table does", () => {
  const forms = [{ ar: "كتاب", en: "book" }];
  /* One part is no question: the section is not drawn, and the tick that
     would turn the only form off is the one the Blanks block already has. */
  assert.deepEqual(askParts({ forms, cells: [], spec: null }).map((/** @type {any} */ p) => p.id), ["form:0"]);

  /* The word, and the pronouns on the end of the word. */
  const cells = [cellOf("attached", "me", { ar: "كتابي" }), cellOf("attached", "you", { ar: "كتابك" })];
  const parts = askParts({ forms, cells, spec: arAttached });
  assert.deepEqual(parts.map((/** @type {any} */ p) => p.id), ["form:0", "table:"]);
  assert.deepEqual(parts.map((/** @type {any} */ p) => p.on), [true, true], "everything is asked until it is not");
  assert.match(parts[1].note, /2 forms/, "and it says how many there are");
});

test("each form's own table is listed under it, and an empty one is not listed at all", () => {
  const forms = [{ ar: "كتاب", en: "book" }, { id: "pl", ar: "كتب", en: "books" }];
  const cells = [
    cellOf("attached", "me", { ar: "كتابي" }),
    cellOf("attached", "me", { ar: "كتبي", of: "pl" }),
  ];
  assert.deepEqual(
    askParts({ forms, cells, spec: arAttached }).map((/** @type {any} */ p) => p.id),
    ["form:0", "table:", "form:1", "table:pl"],
  );
  /* A table nobody has written is not a thing to be asked either way, so a
     card being written from scratch opens with no section about it. */
  assert.deepEqual(
    askParts({ forms, cells: [], spec: arAttached }).map((/** @type {any} */ p) => p.id),
    ["form:0", "form:1"],
  );
});

test("a table the card carries is one line, named after the table", () => {
  /* An adjective's feminine and plural: the card's, not each form's, so
     one part beside the word rather than one under every form. */
  const forms = [{ ar: "كبير", en: "big" }, { id: "x", ar: "كبيرين", en: "big (dual)" }];
  const cells = [cellOf("agreement", "feminine", { ar: "كبيرة" }), cellOf("agreement", "plural", { ar: "كبار" })];
  const parts = askParts({ forms, cells, spec: arAgreement });
  assert.deepEqual(parts.map((/** @type {any} */ p) => p.id), ["form:0", "form:1", "table:"]);
  assert.equal(parts[0].title, "The main form", "nothing stands in for the word");
  assert.match(parts[2].title, /feminine and plural/, "and the part is called what the table is");
  assert.match(parts[2].note, /2 forms/);
});

test("a card reopens saying what of it is drilled", () => {
  /* The round trip the section stands on: what the teacher switched off
     comes back switched off, rather than every save quietly turning the
     whole card back on. */
  const saved = /** @type {any} */ ({
    id: "k", ar: "كِتاب", en: "book", ask: false,
    subs: [
      { id: "pl", ar: "كُتُب", en: "books" },
      cellOf("attached", "me", { ar: "كتابي", ask: false }),
    ],
  });
  const forms = initialForms(saved, null);
  const cells = initialCells(saved, arLang);
  assert.equal(partAsked(forms[0]), false, "the card's own word");
  assert.equal(partAsked(forms[1]), true, "and a form nobody said anything about");
  assert.equal(partAsked(cells[0]), false, "and the cell");
});

test("a form switched off takes its own table off the list with it", () => {
  /* The pronouns on the end of a word wait on that word being known, so
     under a form nobody is asked about they could never open. Offering the
     tick would be offering something that does nothing. */
  const forms = [{ ar: "كتاب", en: "book", ask: false }];
  const cells = [cellOf("attached", "me", { ar: "كتابي", ask: false })];
  const parts = askParts({ forms, cells, spec: arAttached });
  assert.deepEqual(parts.map((/** @type {any} */ p) => p.id), ["form:0"]);
  assert.equal(parts[0].on, false);
});

test("a verb is its word and its conjugations, and the cited cell is the word", () => {
  /* Arabic cites the he-past, so that cell *is* the card's own word and is
     the line about the word — not one of the twenty others. */
  const forms = [{ ar: "أكل", en: "to eat" }];
  const cells = [cellOf("past", "he", { ar: "أكل" }), cellOf("present", "he", { ar: "بياكل" })];
  const parts = askParts({ forms, cells, spec: arVerb });
  assert.deepEqual(parts.map((/** @type {any} */ p) => p.id), ["form:0", "table:"]);
  assert.equal(parts[0].title, "The verb");
  assert.match(parts[1].note, /1 form/, "the cited cell is the word, not a conjugation");

  /* With nothing but the cited cell written there is no table to ask about. */
  assert.deepEqual(
    askParts({ forms, cells: [cellOf("past", "he", { ar: "أكل" })], spec: arVerb }).map((/** @type {any} */ p) => p.id),
    ["form:0"],
  );
});

test("a form switched off is dealt nothing, and the rest of the card still is", () => {
  /* The whole point, asked of what a session would actually deal. */
  const whole = drillableUnits(bookCard({ s: allAt(state("review", 1)) }), settings);
  assert.ok(whole.some((/** @type {any} */ u) => u.unit.id === "s-me"), "the word's pronouns are dealt");
  assert.ok(whole.some((/** @type {any} */ u) => u.unit.id === "book"), "and the word itself");

  const off = drillableUnits(
    bookCard({ s: allAt(state("review", 1)), states: {}, ask: false }),
    settings,
  );
  assert.equal(off.some((/** @type {any} */ u) => u.unit.id === "book"), false, "the word is not");
  assert.ok(off.some((/** @type {any} */ u) => u.unit.id === "s-me"), "its forms still are");

  /* And a cell switched off, which is what a table kept for reading is
     made of. */
  const table = drillableUnits(
    {
      ...bookCard({ s: allAt(state("review", 1)) }),
      subs: bookCard({}).subs.map((/** @type {any} */ f) =>
        f.row === "attached" ? { ...f, ask: false } : f),
    },
    settings,
  );
  assert.equal(table.some((/** @type {any} */ u) => u.unit.id === "s-me"), false);
  assert.ok(table.some((/** @type {any} */ u) => u.unit.id === "book"), "the word is asked as ever");
});

test("a form's table is named only where there is more than one on screen", () => {
  assert.equal(ownerLabel(0, 1), "");
  assert.equal(ownerLabel(0, 2), "the word");
  assert.equal(ownerLabel(1, 2), "form 2");
  assert.equal(ownerLabel(2, 3), "form 3");
});

/*
 * What a card's forms are, asked in one place.
 *
 * A card is its own word plus the alternates it carries, and until this
 * module the join between the two was written out by hand wherever
 * anybody wanted the list — which is how three readers ended up meaning
 * the same thing in three shapes. These pin what the one door answers.
 */
test("a card's forms are its own word first, then the rest", () => {
  const card = { id: "k", ar: "كتاب", en: "book", subs: [{ id: "a" }, { id: "b" }] };
  assert.deepEqual(formsOf(card).map((f) => f.id), ["k", "a", "b"]);
  assert.deepEqual(subFormsOf(card).map((f) => f.id), ["a", "b"]);
  /* The lead is the card itself, not a copy of its words: a reader walking
     forms holds the same object the caller passed, so the card's own
     recordings and schedule are the lead form's. */
  assert.equal(formsOf(card)[0], card);
});

test("a card with no alternates is one form, and nothing at all is none", () => {
  const alone = { id: "k", ar: "شمس", en: "sun" };
  assert.deepEqual(formsOf(alone).map((f) => f.id), ["k"]);
  assert.deepEqual(subFormsOf(alone), []);
  /* A card withdrawn while somebody was looking at it, and the junk a
     half-written draft or an older document can hold: an empty list
     rather than a crash, which is what every reader wants of it. */
  assert.deepEqual(formsOf(null), []);
  assert.deepEqual(formsOf(undefined), []);
  assert.deepEqual(subFormsOf(null), []);
  assert.deepEqual(formsOf({ id: "k", subs: "not a list" }).map((f) => f.id), ["k"]);
  assert.deepEqual(subFormsOf({ id: "k", subs: 7 }), []);
});

/* ------------------------------------------------------------------
   A card, all the way round and back

   The audit that prompted these found five things lost between one end of
   a card's journey and the other, and every one of them was green: the
   fixtures were all written in the shape a card was stored in before
   0.138, and every reader of a card reads that shape as the new one
   without complaint. So the readers agreed with the fixtures and disagreed
   with the disk.

   These go the other way. They start from a card in the shape the server
   actually stores — one `forms` list, nothing on the card itself — and
   follow it to the student's device, back through the fold a refresh makes,
   into the editor and out of it again.
   ------------------------------------------------------------------ */

/** A card in the shape save-card stores one: one list, the word first. */
const storedCard = (/** @type {Record<string, any>} */ over = {}) => ({
  id: "k1",
  owner: "teacher",
  lang: "ar-PS",
  category: "noun",
  name: "",
  fills: "",
  drill: true,
  note: "about the book",
  forms: [
    { id: "k1", ar: "كِتاب", en: "book", lat: "kitaab", gender: "masculine", number: "singular",
      clips: ["c1"], slowClips: ["c2"], answers: [{ text: "كِتاب", lat: "kitaab", gender: "masculine" }] },
    { id: "fpl", ar: "كُتُب", en: "books", lat: "kutub", gender: "masculine", number: "plural", clips: [] },
    { id: "fme", ar: "كتابي", en: "my book", lat: "kitaabi", row: "attached", col: "me", clips: [] },
  ],
  ...over,
});

test("a card stored as one list of forms opens in the editor as itself", () => {
  /*
   * The word lived on the card until 0.138 and has lived in the first of
   * its forms since. The editor went on reading the card, so a card saved
   * by this build opened with an empty first block — Save grey, and a
   * teacher who retyped the word saved it with no recordings, no grammar
   * and its "kept, not asked" switched back on.
   */
  const forms = initialForms(/** @type {any} */ (storedCard({ forms: [
    { id: "k1", ar: "كِتاب", en: "book", lat: "kitaab", gender: "masculine", clips: ["c1"], ask: false },
    { id: "fpl", ar: "كُتُب", en: "books", lat: "kutub" },
  ] })), null);
  assert.equal(forms[0].ar, "كِتاب", "the card's own word is there");
  assert.equal(forms[0].en, "book");
  assert.equal(forms[0].lat, "kitaab");
  assert.equal(forms[0].gender, "masculine", "with whatever the language declares about it");
  assert.deepEqual(forms[0].clips, ["c1"], "and its recordings");
  assert.equal(forms[0].ask, false, "and whether it is asked about at all");
  assert.equal(forms[1].ar, "كُتُب", "the forms under it as before");

  /* And a card still stored the old way reads exactly the same, which is
     what makes this safe to change: leadOf hands back the card itself. */
  const old = initialForms(
    /** @type {any} */ ({ id: "k", ar: "كِتاب", en: "book", lat: "kitaab", clips: ["c1"], ask: false, subs: [] }),
    null,
  );
  assert.equal(old[0].ar, "كِتاب");
  assert.deepEqual(old[0].clips, ["c1"]);
  assert.equal(old[0].ask, false);
});

test("what each accepted answer is grammatically survives being opened", () => {
  /* Two spellings of one thing may differ in exactly the grammar a card
     records — مبسوط from a man, مبسوطة from a woman — and the strings
     carry the words but not that. Rebuilt from the strings alone, the
     feminine came back as whatever the form's own values said, on every
     open and every save. */
  const forms = initialForms(/** @type {any} */ ({
    id: "k", lang: "ar-PS", forms: [{
      id: "k", ar: "مبسوط / مبسوطة", en: "happy", lat: "mabsuuT / mabsuuTa",
      answers: [
        { text: "مبسوط", lat: "mabsuuT", gender: "masculine" },
        { text: "مبسوطة", lat: "mabsuuTa", gender: "feminine" },
      ],
    }],
  }), null);
  assert.equal(forms[0].answers.length, 2);
  assert.deepEqual(forms[0].answers.map((/** @type {any} */ a) => a.gender),
    ["masculine", "feminine"]);
});

test("every cell of a table is given a name, and keeps the one it has", () => {
  /*
   * A cell was the one kind of form with nothing to point at, so on a
   * student's device it was known by where it sat — and a teacher fixing a
   * typo in one box handed its neighbours each other's schedules. 0.131
   * named the forms for that reason and left the table out.
   */
  const cells = initialCells(/** @type {any} */ ({ id: "v", lang: "ar-PS", forms: [
    { id: "v", ar: "أكل", en: "to eat", lat: "akal" },
    cellOf("past", "he", { ar: "أكل", id: "fkept" }),
    cellOf("past", "she", { ar: "أكلت" }),
    cellOf("present", "he", { ar: "بياكل" }),
  ] }), arLang);
  assert.equal(cells.length, 3);
  assert.equal(cells[0].id, "fkept", "a cell that has a name keeps it");
  for (const c of cells) assert.match(String(c.id), /^f[a-z0-9]+$/, `${c.row}·${c.col} is named`);
  assert.equal(new Set(cells.map((/** @type {any} */ c) => c.id)).size, 3, "and no two share one");
  /* In the order they were stored, which is what carries a table written
     before they had names across its first save: the fold matches an
     unrecognised name by position. */
  assert.deepEqual(cells.map((/** @type {any} */ c) => `${c.row}·${c.col}`),
    ["past·he", "past·she", "present·he"]);
});

test("a card goes to a device, comes back through a refresh, and is saved unchanged", () => {
  /*
   * The whole journey, which is the test the audit asked for: five of the
   * things it found were lost somewhere along it and every fixture in this
   * file was written in the shape that hid them.
   */
  const card = storedCard();
  /* To the student's device. */
  const item = cardToItem(/** @type {any} */ (card), "Lesson 1", "c1", "d1", () => ({}));
  assert.equal(formsOf(item).length, 3, "every form arrives");
  assert.deepEqual(formsOf(item).map((/** @type {any} */ f) => f.ar), ["كِتاب", "كُتُب", "كتابي"]);
  assert.equal(formsOf(item)[2].row, "attached", "a cell arrives as a cell");
  assert.equal(formsOf(item)[2].col, "me");

  /* The learner does some work on the plural and on the pronoun. */
  const worked = {
    ...item,
    forms: formsOf(item).map((/** @type {any} */ f, i) =>
      i === 0 ? f : { ...f, s: { ar2en: { phase: "review", reps: i * 2, updated: 1 } } }),
  };
  /* The teacher saves the card again — any save, for any reason — and the
     refresh folds the new copy in. */
  const again = cardToItem(/** @type {any} */ (card), "Lesson 1", "c1", "d1", () => ({}));
  const folded = foldCourses([worked], [again]).items[0];
  assert.equal(folded.forms[1].s.ar2en.reps, 2, "the plural keeps its work");
  assert.equal(folded.forms[2].s.ar2en.reps, 4, "and so does the cell");

  /* And back into the teacher's editor, out of it, and up. */
  const forms = initialForms(/** @type {any} */ (card), null);
  const cells = initialCells(/** @type {any} */ (card), arLang);
  const written = writtenCard({
    word: {
      shownSpec: specOf(arLang, "attached"),
      ownForms: forms,
      tableCells: cells,
      forms,
      note: card.note,
      standsIn: false,
      name: "",
      uses: [],
      fills: "",
      drill: true,
      category: "noun",
    },
    talk: {},
    shape: "word",
    chosen: ["d1"],
  });
  assert.deepEqual(written.forms.map((/** @type {any} */ f) => f.ar), ["كِتاب", "كُتُب", "كتابي"],
    "every form comes back out, the word first");
  assert.deepEqual(written.forms[0].clips, ["c1"], "with the word's recordings still on it");
  assert.equal(written.forms[0].gender, "masculine");
  assert.equal(written.forms[2].row, "attached", "and the cell still placed");
  assert.equal(written.category, "noun");
  assert.equal(written.note, "about the book");
});

test("a sentence keeps what the teacher calls it, and a word is named by its own words", () => {
  /*
   * A sentence is saved as a frame with a hole in it, so a list of them
   * reads as a list of holes: "{{name}} is heavy" names the shape of the
   * card rather than what it is for. What to call it is asked of a
   * sentence for the reason it is asked of a verb — what is on the card is
   * not what the card is about — and the save has to carry it, which is
   * the half a screen cannot show.
   *
   * And only where it is asked. Every other card is named by its own word,
   * so a name typed while the card briefly was a sentence does not follow
   * it out.
   */
  const draft = {
    shownSpec: null,
    ownForms: [{ ar: "ismi {{name}}", en: "My name is {{name}}", lat: "" }],
    tableCells: [],
    forms: [],
    note: "",
    standsIn: false,
    name: "  introducing yourself  ",
    uses: [],
    fills: "",
    drill: true,
    category: "",
    refName: "",
    spread: [],
  };
  const asSentence = writtenCard({ word: draft, talk: {}, shape: "sentence", chosen: [] });
  assert.equal(asSentence.name, "introducing yourself",
    "a sentence carries what it is called, trimmed");
  assert.equal(asSentence.sentence, true, "and is still saved as a sentence");
  const asWord = writtenCard({ word: draft, talk: {}, shape: "word", chosen: [] });
  assert.equal(asWord.name, "", "and a word is named by its own words");
});

/* ---- what a document keeps on its way in ---- */

test("a card's second accepted spelling keeps its schedule across a load", () => {
  /*
   * Each spelling of a card that accepts two is scheduled in its own
   * right, under a key that names which — "ar2en" for the first and
   * "ar2en@1" for the second. This walked the bare type names alone, so
   * the second one's schedule was dropped on every load, after every sync
   * and on every import: answered in the evening and gone by the morning.
   */
  const stored = {
    ar2en: { phase: "review", interval: 3, reps: 4, right: 4 },
    "ar2en@1": { phase: "review", interval: 2, reps: 2, right: 2 },
  };
  const lifted = liftStates(stored);
  assert.equal(lifted["ar2en"].reps, 4);
  assert.ok(lifted["ar2en@1"], "the second spelling's schedule is still there");
  assert.equal(lifted["ar2en@1"].reps, 2);
  assert.equal(lifted["ar2en@1"].interval, 2);
  /* A key naming an exercise that no longer exists goes the way a retired
     type's own state goes, and one nobody has answered is not invented:
     an absent key is what let this be turned on without touching a
     document. */
  assert.equal(liftStates({ "gone2en@1": { phase: "review" } })["gone2en@1"], undefined);
  assert.equal(liftStates({})["ar2en@1"], undefined);
});

test("a setting the app no longer offers is dropped rather than obeyed", () => {
  /* Which kinds of card are practised at all outlived the screen that set
     it: no writer anywhere, a default of every kind, and on a device that
     had switched conversations off long ago it went on hiding every scene
     in every session and every count. */
  const doc = merge({
    version: 3,
    items: [],
    settings: { language: "ar-PS", kinds: { word: true, phrase: true, sentence: true, dialog: false },
      sessionSize: 40, theme: "dark" },
  });
  assert.equal(doc.settings.kinds, undefined, "the kinds are gone");
  assert.equal(doc.settings.sessionSize, undefined, "as the session size already was");
  assert.equal(doc.settings.theme, "dark", "and what is genuinely the learner's stays");
});

test("a document written the old way comes through as one list of forms", () => {
  const doc = merge({
    version: 3,
    items: [{ id: "k", tags: [], created: 1, ar: "كِتاب", en: "book", lat: "kitaab",
      s: { ar2en: { phase: "review", reps: 2 } },
      subs: [{ id: "pl", ar: "كُتُب", en: "books", lat: "kutub", s: {} }] }],
    settings: { language: "ar-PS" },
  });
  const it = doc.items[0];
  assert.deepEqual(formsOf(it).map((/** @type {any} */ f) => f.ar), ["كِتاب", "كُتُب"]);
  assert.equal(must(formsOf(it)[0].s, "the word's states").ar2en.reps, 2,
    "the word's own progress moves with it");
  assert.equal(it.ar, undefined, "and the old shape is not left underneath");
  assert.equal(it.subs, undefined);
});

/* ---- the ladder a form climbs is the card's, not the question's ---- */

test("a frame's ladder is read off the card as written, not as filled in", () => {
  /*
   * A card with a blank in it cannot be told apart from other words — the
   * distractors would be stable and its own words would not — so the
   * picking exercises are not on its ladder at all. Fill the blank in and
   * the copy looks like an ordinary phrase and claims every exercise.
   *
   * Which is why "this was too easy" has to read the stored form: it read
   * the question instead, and the question is filled in by the time
   * anybody sees it. On a frame that meant writing a review state for an
   * exercise the card can never be dealt, and calling the next level the
   * one after that — so the level the learner was actually on stayed shut.
   */
  const settings = { language: "ar-PS" };
  /* A word to put in the hole, or the frame is not a question at all —
     which is its own rule, and not the one under test here. And a deck
     with other words in it, or nothing can be told apart from anything
     and the exercises this is about are off the table for both copies. */
  setValueIndex(new Map([[valueKey("ar-PS", "name"),
    [{ id: "rafa", ar: "رافائيل", en: "Raphael", lat: "Raphael" }]]]));
  setMateCounts(new Map([["ar-PS", 12]]));
  const frame = { id: "f", lang: "ar-PS", ar: "اسمي {{name}}", en: "my name is {{name}}", lat: "ismi {{name}}", s: {} };
  const filled = { ...frame, ar: "اسمي رافائيل", en: "my name is Raphael", lat: "ismi Raphael" };
  const asWritten = laddered(/** @type {any} */ (frame), settings);
  const asAsked = laddered(/** @type {any} */ (filled), settings);
  assert.ok(asWritten.includes("ar2en"), "a frame can still be read");
  assert.ok(!asWritten.includes("ar2pick"), "but never told apart from other words");
  assert.ok(!asWritten.includes("match"));
  assert.ok(asAsked.includes("ar2pick"), "while the filled-in copy claims it");
  assert.ok(asAsked.length > asWritten.length, "which is the whole of the difference");
  /* And with nothing to fill it, a frame is asked nothing — the rule the
     line above steps around, asserted rather than assumed. */
  setValueIndex(new Map());
  assert.deepEqual(laddered(/** @type {any} */ (frame), settings), []);
  setMateCounts(new Map());
});

/* ---- the gates every reader of a card's forms shares ---- */

test("a form nobody is asked about is not offered to any session", () => {
  /* Two gates, one list. A session built by hand walked the forms itself
     and applied neither, so a table the teacher keeps for a student to
     read was drilled there and a verb's later tenses were dealt before its
     present was known. */
  const settings = { language: "ar-PS" };
  const card = {
    id: "c", lang: "ar-PS", kind: "word",
    forms: [
      { id: "c", ar: "كِتاب", en: "book", lat: "kitaab", s: {} },
      { id: "quiet", ar: "كُتُب", en: "books", lat: "kutub", ask: false, s: {} },
    ],
  };
  const asked = askedUnits(/** @type {any} */ (card)).map((/** @type {any} */ u) => u.unit.id);
  assert.deepEqual(asked, ["c"], "the form switched off is not one of them");
  /* And what a dealt session looks at is that, narrowed to the forms with
     two exercises between them — so the two answers cannot drift. */
  const drilled = drillableUnits(/** @type {any} */ (card), settings).map((/** @type {any} */ u) => u.unit.id);
  assert.deepEqual(drilled, ["c"]);
});

/* ---- what the editor offers on a card that already has a table ---- */

test("a card with a table can still be told which kind of word it is", () => {
  /*
   * The radio was withheld whenever a card carried a table, because
   * changing the kind changes the table and the table is the content. True
   * of a verb and an adjective; not true of a noun and a preposition,
   * which take the same pronouns — and the kind of an older card is
   * guessed, first-declared-wins, so every preposition written before the
   * question existed opened as a noun and was saved as one.
   */
  const withTable = categoryOffers(arLang, { worded: true, storedForms: "attached" })
    .map((/** @type {any} */ c) => c.value);
  assert.deepEqual(withTable, ["noun", "preposition"], "the two that lay out the same table");
  /* A verb's table is only laid out by a verb, so there is no question to
     ask and the line underneath says what the card is instead. */
  assert.deepEqual(categoryOffers(arLang, { worded: true, storedForms: "verb" }), []);
  assert.deepEqual(categoryOffers(arLang, { worded: true, storedForms: "agreement" }), []);
  /* A card whose table is still empty is asked everything, as before. */
  assert.equal(categoryOffers(arLang, { worded: true, storedForms: "" }).length,
    categoryChoices(arLang).length);
  /* And a conversation or a sentence is asked nothing. */
  assert.deepEqual(categoryOffers(arLang, { worded: false, storedForms: "" }), []);
});

test("a cell left pointing at nothing is counted in what a save drops", () => {
  /* A cell hanging off a form that is no longer on the card is a word with
     a pronoun on the end of nothing, and the save leaves it out — rightly.
     It was the one thing dropped without the line above the table saying
     so. */
  const spec = specOf(arLang, "attached");
  const forms = [{ id: "c", ar: "كِتاب", en: "book" }];
  const cells = [
    cellOf("attached", "me", { ar: "كتابي" }),
    cellOf("attached", "me", { ar: "كتبي", of: "gone" }),
  ];
  assert.equal(tableCellsOf(cells, spec, forms).length, 1, "only the one whose form is here is saved");
  assert.equal(asideOf(cells, [spec], spec, forms), 1, "and the other is counted as dropped");
  /* Nothing dropped, nothing counted, which is every ordinary card. */
  assert.equal(asideOf([cells[0]], [spec], spec, forms), 0);
});

/*
 * And that the door stays the only one.
 *
 * The point of the accessor is that the day a card is stored as one list
 * of forms rather than a word plus a `subs` array, one file changes. A
 * reader that reaches into `subs` itself would go on compiling and
 * silently find nothing, so the rule is checked here rather than
 * remembered.
 *
 * What may still name it: the door itself, an assignment (writing the
 * field is not reading the list, and the stored shape is still `subs`
 * until it changes), and the handful of objects that are not cards — the
 * trainer's own draft while a card is being written, the patch it hands
 * back, and the counts on a tile.
 */
test("nothing but the door reads a card's forms out of subs", () => {
  /** @type {[string, (f: string) => boolean][]} */
  const roots = [
    ["src", (/** @type {string} */ f) => /\.tsx?$/.test(f) && f !== "cards.ts"],
    ["server/api", (/** @type {string} */ f) => f.endsWith(".js")],
  ];
  /* A receiver that is not a card. Named rather than counted, so adding
     one is a decision somebody writes down. */
  const notCards = ["patch", "d", "draft", "counts"];
  /* `something.subs`, where something is a name — so `...subs` and a bare
     `subs:` key are not it — and not `something.subs = …`, which writes. */
  const reads = /(?<![.\w])([A-Za-z_$][\w$]*)\.subs\b(?!\s*=[^=])/g;
  /** @type {string[]} */
  const found = [];
  for (const [dir, keep] of roots) {
    for (const file of readdirSync(new URL(`../${dir}`, import.meta.url)).filter(keep)) {
      const source = readFileSync(new URL(`../${dir}/${file}`, import.meta.url), "utf8");
      for (const [, who] of source.matchAll(reads)) {
        if (!notCards.includes(who)) found.push(`${dir}/${file}: ${who}.subs`);
      }
    }
  }
  assert.deepEqual(found, [], `these read a card's forms directly — ask formsOf or subFormsOf instead:\n${found.join("\n")}`);
});
