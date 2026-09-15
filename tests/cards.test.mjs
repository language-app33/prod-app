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
const { cardHasAudio, cardFormCount, cardAdded, cardChanged, sortCards, filterCards, fillsInUse, CARD_SORTS,
  shapeOf, shapeChoices, formsOffered } =
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
const { leadSpeed, deckPercent, formIsAmbiguous, onePerLevel, quietUnits, easedUnits } =
  await import(path.join(out, "trainer.js"));
const { defaultTypes } = await import(path.join(here, "..", "src", "languages.ts"));

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

test("filtering by whether a card fills a variable, and which one", () => {
  /* A teacher who has written forty names wants two things of this list: the
     names, to check them, and everything that is not a name, to get their
     material back. */
  const list = [
    card({ id: "frame", ar: "ismi {{name}}", en: "My name is {{name}}" }),
    card({ id: "rafa", en: "Raphael", fills: "name", drill: false }),
    card({ id: "viktor", en: "Victor", fills: "name", drill: false }),
    card({ id: "blue", en: "blue", fills: "colour", drill: false }),
    card({ id: "house", en: "house" }),
  ];
  const ids = (/** @type {Record<string, any>} */ f) =>
    filterCards(list, f).map((/** @type {any} */ c) => c.id);

  assert.deepEqual(ids({ fillsMode: "yes" }), ["rafa", "viktor", "blue"], "every value");
  assert.deepEqual(ids({ fillsMode: "yes", fillsNames: ["name"] }), ["rafa", "viktor"]);
  assert.deepEqual(ids({ fillsMode: "yes", fillsNames: ["colour"] }), ["blue"]);
  /* Several variables read as "show me these", the way several decks do. */
  assert.deepEqual(ids({ fillsMode: "yes", fillsNames: ["name", "colour"] }), ["rafa", "viktor", "blue"]);
  /* A variable nothing fills any more — a name left ticked while the last
     card filling it was deleted — empties the list rather than ignoring the
     tick, which is the honest answer to what was asked. */
  assert.deepEqual(ids({ fillsMode: "yes", fillsNames: ["gone"] }), []);

  /* And the other way: the frame is not a value, so it stays. */
  assert.deepEqual(ids({ fillsMode: "no" }), ["frame", "house"]);
  /* The names do not narrow "no" — the list is not offered there, and a
     stale one must not quietly change what it means. */
  assert.deepEqual(ids({ fillsMode: "no", fillsNames: ["name"] }), ["frame", "house"]);
  assert.deepEqual(ids({ fillsMode: "any" }).length, list.length);
  assert.deepEqual(ids({}).length, list.length);

  /* And it narrows alongside the others rather than instead of them. */
  assert.deepEqual(
    filterCards(list, { fillsMode: "yes", forms: "one" }).map((/** @type {any} */ c) => c.id),
    ["rafa", "viktor", "blue"]
  );
});

test("the variables on offer are read off the cards that fill them", () => {
  /* The filter's list. A variable exists because some card says it fills
     one; a list kept beside them would be a second place to be wrong. */
  const list = [
    card({ id: "a", fills: "name" }),
    card({ id: "b", fills: "NAME" }),
    card({ id: "c", fills: "colour" }),
    card({ id: "d" }),
  ];
  assert.deepEqual(fillsInUse(list), [
    { name: "colour", count: 1 },
    /* Folded and counted together: {{Name}} and {{name}} are one hole. */
    { name: "name", count: 2 },
  ]);
  assert.deepEqual(fillsInUse([]), []);
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

/*
 * What kind of card the editor asks about, and what a word lays out.
 *
 * Two questions, not one. A verb was a third answer to the first for a
 * release, and it stopped working the moment there was a second table to
 * offer — so the kind is a word or a conversation, and which table a word
 * lays its forms out in is asked underneath. Neither is stored: a card has
 * a table when its forms carry cells in that table's rows, which is all
 * hasCells has ever read.
 */
test("a card is a word or a conversation, and nothing else", () => {
  assert.equal(shapeOf(false), "word");
  assert.equal(shapeOf(true), "scene");
});

test("a new card may be either, and a written one stays what it is", () => {
  const values = (/** @type {any} */ o) => shapeChoices(o).map((/** @type {any} */ c) => c.value);
  assert.deepEqual(values({ saved: false, scene: false }), ["word", "scene"]);
  /* A written word is not offered the kind it cannot become — a scene with
     four turns on it would have nowhere to put them — and a written
     conversation is offered nothing at all, so the block says what it is
     instead. */
  assert.deepEqual(values({ saved: true, scene: false }), ["word"]);
  assert.deepEqual(values({ saved: true, scene: true }), []);
});

test("and a word is offered the tables its language actually lays out", () => {
  const values = (/** @type {any} */ t) =>
    formsOffered(null, t).map((/** @type {any} */ c) => c.value);
  /* Arabic lays out both, so there are three answers: neither, and one
     each. */
  assert.deepEqual(values({ verb: true, attached: true }), ["", "verb", "attached"]);
  /* Huế lays out verbs and attaches nothing. */
  assert.deepEqual(values({ verb: true, attached: false }), ["", "verb"]);
  /* And a pack that lays out neither asks nothing: one answer is no
     question, so the radio is not drawn at all. */
  assert.deepEqual(values({ verb: false, attached: false }), []);
  /* Every answer carries a line saying what it gets you, which is why this
     is a list of rows and not a track of segments. */
  assert.ok(formsOffered(null, { verb: true, attached: true }).every((/** @type {any} */ o) => o.note));
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
  const [plural, mine, ours] = item.subs;
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
  assert.equal(item.subs[0].id, `${localIdFor("k3")}-f0`);
  /* And the new one, which cannot collide with it: a name is never a bare
     number, because of the tilde. */
  assert.equal(item.subs[1].id, `${localIdFor("k3")}-f~x7`);
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
    { id: "srvk4", ar: "a", en: "a", s: {}, source: { cardId: "k4" },
      subs: [form("srvk4-f~one", 3), form("srvk4-f~two", 9)] },
  ];
  /* The teacher inserts a form above the two that were there. */
  const fresh = [
    { id: "srvk4", ar: "a", en: "a", s: {}, source: { cardId: "k4" },
      subs: [
        { id: "srvk4-f~new", ar: "n", en: "n", s: {} },
        { id: "srvk4-f~one", ar: "a", en: "a", s: {} },
        { id: "srvk4-f~two", ar: "b", en: "b", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.deepEqual(out.subs.map((/** @type {any} */ f) => f.id),
    ["srvk4-f~new", "srvk4-f~one", "srvk4-f~two"]);
  assert.equal(out.subs[0].s.ar2en, undefined, "the new form starts fresh");
  assert.equal(out.subs[1].s.ar2en.reps, 3, "and each of the others keeps its own work");
  assert.equal(out.subs[2].s.ar2en.reps, 9);
});

test("and forms that gain names all at once keep the progress they had", () => {
  /* The release that names them renames every form on every card. A card
     whose forms have all been renamed at once is the same card in the same
     order, not two new ones — so where nothing matches by name, the places
     are taken as they stand. */
  /** @param {string} id @param {number} reps */
  const form = (id, reps) => ({ id, ar: id, en: id, s: { ar2en: { phase: "review", reps } } });
  const had = [
    { id: "srvk5", ar: "a", en: "a", s: {}, source: { cardId: "k5" },
      subs: [form("srvk5-f0", 3), form("srvk5-f1", 9)] },
  ];
  const fresh = [
    { id: "srvk5", ar: "a", en: "a", s: {}, source: { cardId: "k5" },
      subs: [
        { id: "srvk5-f~one", ar: "a", en: "a", s: {} },
        { id: "srvk5-f~two", ar: "b", en: "b", s: {} },
      ] },
  ];
  const out = foldCourses(had, fresh).items[0];
  assert.equal(out.subs[0].s.ar2en.reps, 3);
  assert.equal(out.subs[1].s.ar2en.reps, 9);
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
const settings = { language: "ar-PS", types: defaultTypes(), kinds: {}, perItem: 2 };
/** @param {string} phase @param {number} interval */
const state = (phase, interval) => ({
  phase, step: 0, ease: 2.5, interval, due: 0, reps: 3, lapses: 0,
  right: 3, wrong: 0, skips: 0, near: 0, hints: 0, hist: [], updated: 0,
});
/** Every exercise a form could be asked, at one standing. */
const allAt = (/** @type {any} */ s) =>
  Object.fromEntries(Object.keys(defaultTypes()).map((t) => [t, s]));

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
