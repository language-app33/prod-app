/*
 * Conversations: what a scene is, and what can be asked of it.
 *
 * The rules a dialog is drilled by live in a plain module for the same
 * reason the scheduler's do — a .jsx file cannot be imported here — so
 * this is where "which replies are offered", "how much of the scene the
 * question shows" and "what a two-line scene supports" are held to
 * something. The screens are checked in tests/smoke.mjs, which drives the
 * real app; nothing below renders anything.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DIALOG_KIND,
  MIN_ORDER_LINES,
  ORDER_SEP,
  PART_SEP,
  buildDialogIndex,
  cueFor,
  dialogNeedMet,
  dialogPhrases,
  isDialog,
  linesOf,
  namedPart,
  orderIsRight,
  orderOf,
  partAnswers,
  partOf,
  partsToPlay,
  replyOptions,
  roleOf,
  sceneBefore,
  scrambledLines,
  speakerName,
  speakersOf,
  yourLines,
  youOf,
} from "../src/dialogs.js";
import { EX, TYPES, checkAnswer } from "../src/languages.js";
import { unitsOf } from "../src/scheduler.js";

/* A scene of four turns, two people, written the way the editor writes
   one. `uses` names the word cards a line contains, as the editor works
   out for itself when the card is saved. */
/** @returns {any} */
const line = (/** @type {Record<string, any>} */ x) => ({
  id: "",
  ar: "",
  lat: "",
  en: "",
  uses: [],
  recs: [],
  s: {},
  ...x,
});

/** @returns {any} */
const scene = () => ({
  id: "d1",
  kind: DIALOG_KIND,
  ar: "",
  en: "At the door",
  lat: "",
  tags: [],
  created: 0,
  speakers: ["Layla", "Karim"],
  you: 1,
  lines: [
    line({ id: "l1", who: 0, ar: "salaam", en: "peace", uses: ["w1"] }),
    line({ id: "l2", who: 1, ar: "wa salaam", en: "and peace" }),
    line({ id: "l3", who: 0, ar: "kayfa haaluk", en: "how are you" }),
    line({ id: "l4", who: 1, ar: "bikhayr", en: "well" }),
  ],
});

/** @returns {any} */
const word = () => ({ id: "w1", ar: "salaam", en: "peace", lat: "salām", tags: [], created: 0, s: {} });

test("a card with a conversation on it is a dialog, and nothing else is", () => {
  assert.equal(isDialog(scene()), true);
  assert.equal(isDialog(word()), false);
  /* The kind on its own is not enough: a scene with no lines is a card
     somebody started and abandoned, and asking it for a reply would be
     asking for a line that does not exist. */
  assert.equal(isDialog({ kind: DIALOG_KIND, lines: [] }), false);
  assert.equal(isDialog(null), false);
});

test("and the lines are what says so, not a label beside them", () => {
  /* A stored card carries its turns and no label — the server has never
     had a field for one — so a teacher's every screen asked the label and
     got "no". Opening a conversation to edit it put the word editor up,
     with the whole scene out of reach behind it. Two places holding the
     same fact is how that happened; there is one now. */
  const { kind: _none, ...unlabelled } = scene();
  assert.equal("kind" in unlabelled, false);
  assert.equal(isDialog(unlabelled), true, "the turns are the conversation");
  /* And a label on its own still buys nothing, so an ordinary word cannot
     acquire a scene by being mislabelled. */
  assert.equal(isDialog({ ...word(), kind: DIALOG_KIND }), false);
});

test("its lines are units, so each carries its own progress", () => {
  /* This is the whole reason a line is shaped like a form: everything
     that walks the units of a card — what is due, how mature it is, how
     hard it has proved — counts a line without being told what a dialog
     is. */
  const units = unitsOf(scene());
  assert.deepEqual(units.map((u) => u.unit.id), ["d1", "l1", "l2", "l3", "l4"]);
  assert.equal(units[0].isSub, false, "the scene itself is the card's own unit");
  assert.ok(units.slice(1).every((u) => u.isSub), "every line is drilled in its own right");
});

test("who is in it, and which part is the learner's", () => {
  assert.deepEqual(speakersOf(scene()), ["Layla", "Karim"]);
  assert.equal(speakerName(scene(), 1), "Karim");
  assert.equal(youOf(scene()), 1, "the second speaker by default: you answer");
  assert.deepEqual(yourLines(scene()).map((l) => l.id), ["l2", "l4"]);

  /* A card naming nobody still has two parts, and a card naming a
     speaker who has since been deleted gets one that exists rather than
     a blank part. */
  assert.deepEqual(speakersOf({}), ["A", "B"]);
  assert.equal(youOf({ speakers: ["Solo"], you: 3 }), 0);
  assert.equal(speakerName({ speakers: ["Solo"] }, 7), "Solo");
});

test("a scene need not name a part, and one that doesn't takes them in turn", () => {
  /* Naming a part is a real decision — a scene where only one side is
     worth producing — and most are not that. Left open, the card says
     nothing and the question picks. */
  const open = { ...scene(), you: null };
  assert.equal(namedPart(open), null, "what the card says is: nothing");
  assert.equal(namedPart(scene()), 1, "and what it says, when it says something");
  assert.equal(namedPart({ ...scene(), you: 0 }), 0, "including the first speaker, which is not nothing");

  /* Asked once you are Karim, who answers; asked again you are Layla, who
     opens. Which is the whole point of leaving it open: a two-hander met
     twice has been held up from both ends. */
  assert.equal(youOf(open, 0), 1);
  assert.equal(youOf(open, 1), 0);
  assert.equal(youOf(open, 2), 1, "and round again");
  assert.deepEqual(yourLines(open, 0).map((l) => l.id), ["l2", "l4"]);
  assert.deepEqual(yourLines(open, 1).map((l) => l.id), ["l1", "l3"]);

  /* A card that names one is not rotated, however often it is asked. */
  assert.equal(youOf(scene(), 7), 1);
});

test("the parts are the people who actually say something", () => {
  const open = { ...scene(), you: null, speakers: ["Layla", "Karim", "Nobody"] };
  assert.deepEqual(partsToPlay(open), [1, 0], "the answerer first, the opener last");
  assert.equal(partsToPlay(open).includes(2), false, "a name with no line under it is not a part");
  assert.deepEqual(partsToPlay({ lines: [] }), []);

  /* Which is what the exercise table reads, so a scene naming no part is
     still offered as a part to play rather than greyed out waiting for a
     decision nobody has to make. */
  assert.equal(dialogNeedMet("part", null, open), true);
  assert.equal(dialogNeedMet("part", null, { ...scene(), you: null, lines: [] }), false);
});

test("a question shows what was said before it and no more", () => {
  const card = scene();
  assert.deepEqual(sceneBefore(card, 2).map((l) => l.id), ["l1", "l2"]);
  assert.equal(cueFor(card, 2).id, "l2", "the line actually being answered");
  /* Nothing comes before the first line, which is why it is never asked
     as a reply. */
  assert.deepEqual(sceneBefore(card, 0), []);
  assert.equal(cueFor(card, 0), null);
});

test("a line stands in for a phrase, so the gap-fill gets scenes for free", () => {
  /* The one thing that makes a scene worth writing on the first day: the
     words already being learnt gain a real exchange to be gapped inside
     of, with nothing new marked. Only lines that name the words they use
     come through — the rest are conversation, not context. */
  const phrases = dialogPhrases([scene(), word()]);
  assert.deepEqual(phrases.map((p) => p.id), ["l1"]);
  assert.deepEqual(phrases[0].uses, ["w1"]);
  assert.equal(phrases[0].ar, "salaam");
});

test("which scene a line is in, and how far into it", () => {
  const index = buildDialogIndex([scene(), word()]);
  const third = index.get("l3");
  assert.equal(third && third.at, 2);
  assert.equal(third && third.card.id, "d1");
  assert.equal(index.get("w1"), undefined, "a word is not in anybody's conversation");
});

test("a word is never asked to put itself in order, and a scene never what it means", () => {
  const card = scene();
  const index = buildDialogIndex([card]);
  assert.equal(roleOf(card, null), "card");
  assert.equal(roleOf(card.lines[1], index.get("l2") || null), "line");
  assert.equal(roleOf(word(), null), "word");

  /* Every exercise says which of the three it is for, and a word says so
     by saying nothing. */
  assert.equal(EX.dlgorder.dialog, "card");
  assert.equal(EX.dlgreply.dialog, "line");
  assert.equal(EX.ar2en.dialog, undefined);
});

test("what a scene has to be before each exercise is worth asking", () => {
  const card = scene();
  const index = buildDialogIndex([card]);
  const first = index.get("l1") || null;
  const second = index.get("l2") || null;

  assert.equal(dialogNeedMet("dialog", null, card), true);
  assert.equal(dialogNeedMet("line", second, card.lines[1]), true);
  /* Something has to have been said before there is a reply to make, so
     the opening line is never the one you are asked for. */
  assert.equal(dialogNeedMet("reply", first, card.lines[0]), false);
  assert.equal(dialogNeedMet("reply", second, card.lines[1]), true);
  assert.equal(dialogNeedMet("part", null, card), true);
  assert.equal(dialogNeedMet("order", null, card), true);

  /* Two lines is a coin toss rather than a puzzle. */
  const short = { ...card, lines: card.lines.slice(0, 2) };
  assert.equal(dialogNeedMet("order", null, short), false);
  assert.equal(
    dialogNeedMet("choices", { card: short, at: 1 }, short.lines[1]),
    false,
    `a scene needs ${MIN_ORDER_LINES} lines before a reply can be picked out of a few`,
  );
});

test("the replies offered include the right one and never a copy of it", () => {
  const card = scene();
  const other = {
    ...card,
    id: "d2",
    lines: [line({ id: "x1", who: 0, ar: "bikhayr" }), line({ id: "x2", who: 1, ar: "maʿa salaama" })],
  };
  const opts = replyOptions({ card, at: 3, pool: linesOf(other) });
  assert.equal(opts.length, 4);
  assert.equal(opts.filter((o) => o.id === "l4").length, 1, "the right reply is offered once");
  /* "bikhayr" is the right answer here and also a line of the other
     scene. Being marked wrong for choosing the correct words is the one
     unforgivable question, so the twin is dropped. */
  assert.equal(opts.filter((o) => o.ar === "bikhayr").length, 1);
});

test("and they do not reshuffle under the learner's finger", () => {
  /* React renders twice in development. Nothing here rolls a die: the
     order comes out of the ids, so the same question is the same
     question. */
  const a = replyOptions({ card: scene(), at: 3 }).map((o) => o.id);
  const b = replyOptions({ card: scene(), at: 3 }).map((o) => o.id);
  assert.deepEqual(a, b);
  const elsewhere = replyOptions({ card: scene(), at: 1 }).map((o) => o.id);
  assert.notDeepEqual(a, elsewhere, "a different question offers a different set");
});

test("a scrambled scene is actually scrambled, and the same one twice", () => {
  const first = scrambledLines(scene()).map((l) => l.id);
  assert.deepEqual(first, scrambledLines(scene()).map((l) => l.id));
  assert.notDeepEqual(first, ["l1", "l2", "l3", "l4"], "the puzzle is the order it was written in");
  assert.deepEqual([...first].sort(), ["l1", "l2", "l3", "l4"], "every line, once");
});

test("an ordering is right only in the order it was written", () => {
  const card = scene();
  assert.equal(orderIsRight(orderOf(linesOf(card)), card), true);
  assert.equal(orderIsRight(["l1", "l3", "l2", "l4"].join(ORDER_SEP), card), false);
  assert.equal(orderIsRight("", card), false, "an empty answer is not a right one");
});

test("a part is right when every turn is", () => {
  const card = scene();
  const settings = { language: "ar", strict: false, ignoreHamza: true, types: {}, kinds: {} };
  const both = partOf(["wa salaam", "bikhayr"]);
  assert.equal(checkAnswer(both, card, "dlgplay", settings).ok, true);
  /* One turn short is not most of a conversation: it is a conversation
     that did not happen. */
  assert.equal(checkAnswer(partOf(["wa salaam", "nope"]), card, "dlgplay", settings).ok, false);
  assert.equal(checkAnswer(partOf(["wa salaam"]), card, "dlgplay", settings).ok, false);
  /* The turns travel as one string and come back apart the same way. */
  assert.deepEqual(partAnswers(both), ["wa salaam", "bikhayr"]);
  assert.ok(!both.includes(PART_SEP.repeat(2)));
});

test("a chosen reply is marked as the line it is", () => {
  const card = scene();
  const settings = { language: "ar", types: {}, kinds: {} };
  assert.equal(checkAnswer("bikhayr", card.lines[3], "dlgpick", settings).ok, true);
  assert.equal(checkAnswer("wa salaam", card.lines[3], "dlgpick", settings).ok, false);
  /* Whitespace only: both sides are this card's own wording. */
  assert.equal(checkAnswer("  bikhayr  ", card.lines[3], "dlgpick", settings).ok, true);
  assert.equal(checkAnswer("", card.lines[3], "dlgpick", settings).ok, false);
});

test("an ordering and a read-through go through the same marking as everything else", () => {
  const card = scene();
  const settings = { language: "ar", types: {}, kinds: {} };
  assert.equal(checkAnswer(orderOf(linesOf(card)), card, "dlgorder", settings).ok, true);
  assert.equal(checkAnswer("l2|l1", card, "dlgorder", settings).ok, false);
  /* Nothing to mark, and it says so rather than the screen remembering
     which exercises to keep away from the marking. */
  assert.equal(checkAnswer("", card, "dlgread", settings).ok, true);
});

test("the read-through is never scheduled", () => {
  /* It is an introduction. In TYPES it would carry progress, come back on
     a schedule of its own, and appear in the exercise settings as
     something to switch off. */
  assert.equal(TYPES.includes("dlgread"), false);
  assert.equal(EX.dlgread.intro, true);
  assert.ok(TYPES.includes("dlgreply"), "the ones that are answered are scheduled");
});

test("no dialog exercise needs a recording", () => {
  /* The point of the whole design: a scene with no sound in it supports
     every exercise there is. A recording is a second route to a question
     that already exists, not a question of its own. */
  for (const t of TYPES.filter((x) => EX[x].dialog)) {
    assert.ok(!EX[t].needs.includes("recs"), `${t} asks for a recording`);
    assert.ok(!EX[t].needs.includes("contextAudio"), `${t} asks for a recording`);
    assert.notEqual(EX[t].promptField, "audio", `${t} is a listening exercise`);
  }
});
