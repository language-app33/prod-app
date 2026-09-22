// @ts-check
/*
 * A system, as cards and skills.
 *
 * The claim this file exists for is one sentence: **a teacher correcting a
 * word does not cost a learner their year on it.** That works because
 * every id is derived from the system and the slot, so regenerating gives
 * back the same ids and the fold that refreshes course cards keeps the
 * schedules under them. An id built from anything that moves — a position
 * in a list, a counter, the clock — would have reset the collection on
 * every edit, and nothing would have failed.
 *
 * So most of what is below is the same generation run twice and compared.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { must } from "./helpers.mjs";
import { arComposer } from "../src/numbers/ar-PS.ts";
import { arTimeComposer } from "../src/numbers/ar-PS.time.ts";
import { componentId, generate, handOn, isFromSystem, isRangeSkill, rangeId } from "../src/numbers/generate.ts";
import { formsOf, leadOf, subFormsOf } from "../src/cards.ts";

const load = (/** @type {string} */ name) =>
  JSON.parse(readFileSync(new URL(`./golden/${name}`, import.meta.url), "utf8"));
/** @type {any} */
const SYS = load("ar-PS.numbers.json").system;
/** @type {any} */
const TIME = load("ar-PS.times.json").system;
const NOW = 1750000000000;

const made = (/** @type {Record<string, any>} */ over = {}) =>
  generate({
    composer: arComposer,
    sys: SYS,
    timeComposer: arTimeComposer,
    timeSys: TIME,
    tag: "Numbers",
    now: NOW,
    ...over,
  });

/** @param {any[]} items @param {string} id */
const byId = (items, id) => must(items.find((i) => i.id === id), id);

/* ---- what comes out ---- */

test("a system becomes a card per word and a skill per range", () => {
  const { items } = made();
  const cards = items.filter((i) => !isRangeSkill(i));
  const skills = items.filter(isRangeSkill);

  /* One per box the teacher filled, one per number they wrote out, one
     per minute expression, one per part of the day, and the clock's own
     three words. Counted off the system rather than written down, so the
     day somebody adds a slot this says the new number rather than
     failing for a reason nobody would read past. */
  const filled = arComposer.requiredSlots().filter((s) => SYS.lexemes[s.slot]).length;
  const clockWords = arTimeComposer.requiredSlots().filter((s) => TIME.lexemes[s.slot]).length;
  assert.equal(
    cards.length,
    filled + Object.keys(SYS.overrides).length + clockWords +
      Object.keys(TIME.minuteExprs).length + TIME.periods.length,
    "a card per word the teacher wrote",
  );
  assert.ok(cards.length > 50, `only ${cards.length} cards — the system under this test is too thin`);
  assert.deepEqual(
    skills.map((s) => must(s.range, "range").id),
    [
      "numbers:0-10", "numbers:11-99", "numbers:100-999", "numbers:1000+", "numbers:agreement",
      "time:hours", "time:quarters-halves", "time:fives", "time:exact-minutes", "time:periods",
    ],
  );
  for (const it of items) {
    assert.ok(isFromSystem(it), `${it.id} does not say where it came from`);
    assert.equal(it.locked, true, `${it.id} should not be the learner's to edit`);
    assert.equal(it.lang, "ar-PS");
    assert.deepEqual(it.tags, ["Numbers"]);
  }
});

test("a box a teacher has not reached is not a card with nothing on it", () => {
  const thin = { ...SYS, lexemes: { "unit.1": SYS.lexemes["unit.1"] }, overrides: {} };
  const { items } = made({ sys: thin, timeSys: null, timeComposer: null });
  assert.deepEqual(
    items.filter((i) => !isRangeSkill(i)).map((i) => i.id),
    [componentId(thin.id, "unit.1")],
  );
});

test("the faces of a word are cells of a table under it, as a verb's are", () => {
  const card = byId(made().items, componentId(SYS.id, "unit.1"));
  assert.equal(leadOf(card).ar, SYS.lexemes["unit.1"].forms.standalone, "the card's own word is the counting one");
  const cells = subFormsOf(card);
  assert.deepEqual(cells.map((c) => c.col), ["m", "f"]);
  for (const cell of cells) {
    assert.equal(cell.row, "number", "a cell says which table it is in");
    assert.ok(cell.note, "and what it is for");
  }
  /* The English is the digits, which is what makes reading one and
     writing one the ordinary meaning-and-script exercises rather than two
     new ones. */
  for (const form of formsOf(card)) assert.equal(form.en, "1");
});

test("a word with one face has one form and no table under it", () => {
  const card = byId(made().items, componentId(SYS.id, "ten.20"));
  assert.equal(formsOf(card).length, 1);
  assert.deepEqual(subFormsOf(card), []);
});

test("a recording rides on the face it was made for", () => {
  const withAudio = {
    ...SYS,
    lexemes: {
      ...SYS.lexemes,
      "unit.1": { ...SYS.lexemes["unit.1"], audio: { standalone: ["aaaaaaaa"], f: ["bbbbbbbb"] } },
    },
  };
  const card = byId(made({ sys: withAudio }).items, componentId(SYS.id, "unit.1"));
  assert.deepEqual(leadOf(card).clips, ["aaaaaaaa"]);
  assert.deepEqual((leadOf(card).recs || []).map((/** @type {any} */ r) => r.id), ["aaaaaaaa"]);
  const feminine = must(subFormsOf(card).find((f) => f.col === "f"), "f");
  assert.deepEqual(feminine.clips, ["bbbbbbbb"]);
});

test("a number written out by hand is a card like any other", () => {
  const { items } = made();
  const card = items.find((i) => i.id.includes(":override:300"));
  assert.ok(card, "the hundreds a teacher wrote out are words to learn");
  assert.equal(leadOf(must(card, "card")).ar, "تلتمية");
  assert.equal(leadOf(must(card, "card")).en, "300");
});

test("the clock's own words, its expressions and its parts of the day are cards too", () => {
  const { items } = made();
  assert.ok(items.some((i) => i.id === componentId(TIME.id, "hour.word")));
  assert.ok(items.some((i) => i.id === componentId(TIME.id, "min.15")));
  assert.ok(items.some((i) => i.id === componentId(TIME.id, "period.morning")));
  const quarter = byId(items, componentId(TIME.id, "min.15"));
  assert.equal(leadOf(quarter).en, "quarter past", "the teacher's own English, where they gave one");
  const fifty = byId(items, componentId(TIME.id, "min.50"));
  assert.equal(leadOf(fifty).en, "ten to", "and one that says which way it counts");
});

/* ---- the skills ---- */

test("a skill holds a schedule and no words at all", () => {
  const skill = byId(made().items, rangeId(SYS.id, "numbers:0-10"));
  assert.equal(formsOf(skill).length, 1);
  const form = leadOf(skill);
  assert.equal(form.ar, "");
  assert.equal(form.en, "");
  assert.equal(form.range, true, "the marker every gate reads");
  assert.deepEqual(form.s, {});
  assert.equal(skill.name, "Numbers 0 to 10", "and it is listed by what it is");
});

test("a skill is offered a listening question only where something has been recorded", () => {
  assert.equal(leadOf(byId(made().items, rangeId(SYS.id, "numbers:0-10"))).recs, undefined);
  const withAudio = {
    ...SYS,
    lexemes: { ...SYS.lexemes, "unit.1": { ...SYS.lexemes["unit.1"], audio: { standalone: ["aaaaaaaa"] } } },
  };
  const skill = byId(made({ sys: withAudio }).items, rangeId(SYS.id, "numbers:0-10"));
  assert.equal((leadOf(skill).recs || []).length, 1);
});

test("a range that cannot be asked is not a skill on anybody's device", () => {
  const holed = { ...SYS, lexemes: { ...SYS.lexemes } };
  delete holed.lexemes["ten.70"];
  const { items, checks } = made({ sys: holed, timeSys: null, timeComposer: null });
  assert.deepEqual(
    items.filter(isRangeSkill).map((i) => must(i.range, "range").id),
    ["numbers:0-10", "numbers:agreement"],
  );
  /* And the check says why, for the screen that has to tell the teacher. */
  const shut = must(checks.find((c) => c.range.id === "numbers:11-99"), "11-99");
  assert.equal(shut.open, false);
  assert.ok(shut.warnings.length);
});

/* ---- the claim this file exists for ---- */

test("generating twice gives the same ids, down to the forms", () => {
  const a = made();
  const b = made({ now: NOW + 86400000 });
  assert.deepEqual(a.items.map((i) => i.id), b.items.map((i) => i.id));
  for (let i = 0; i < a.items.length; i += 1) {
    assert.deepEqual(
      formsOf(a.items[i]).map((f) => f.id),
      formsOf(b.items[i]).map((f) => f.id),
      a.items[i].id,
    );
  }
});

test("correcting a word keeps every id, which is what keeps the progress", () => {
  const before = made();
  const corrected = {
    ...SYS,
    lexemes: {
      ...SYS.lexemes,
      "unit.1": { slot: "unit.1", forms: { standalone: "different", m: "different", f: "also different" } },
    },
  };
  const after = made({ sys: corrected });
  assert.deepEqual(before.items.map((i) => i.id), after.items.map((i) => i.id));
  const card = byId(after.items, componentId(SYS.id, "unit.1"));
  assert.equal(leadOf(card).ar, "different", "the word did change");
  assert.deepEqual(
    formsOf(card).map((f) => f.id),
    formsOf(byId(before.items, componentId(SYS.id, "unit.1"))).map((f) => f.id),
    "and nothing under it moved",
  );
});

test("an id carries no character that means something else somewhere", () => {
  /* An override may be written for one face of a number, and that key
     wears a bar. An id that wore one would be a card whose name has a
     separator in it, which is a bug waiting for the first reader that
     splits on it. */
  const withFace = { ...SYS, overrides: { ...SYS.overrides, "3|construct.f": { text: "x" } } };
  for (const it of made({ sys: withFace }).items) {
    assert.equal(it.id.includes("|"), false, it.id);
    for (const form of formsOf(it)) assert.equal(form.id.includes("|"), false, form.id);
  }
});

test("nothing comes out of a system that is not there", () => {
  assert.deepEqual(made({ sys: null }).items, []);
  assert.deepEqual(made({ composer: null }).items, []);
});

test("a card from a system says where it came from, by name", () => {
  const card = byId(made().items, componentId(SYS.id, "unit.7"));
  assert.deepEqual(card.source, { systemId: SYS.id, slot: "unit.7" });
  /* Which is a different shape from a card out of a deck, and told apart
     by name rather than by which fields happen to be filled in. */
  assert.equal("cardId" in must(card.source, "source"), false);
});

/* ---- and what a learner had already earned ---- */

/* A schedule on the card the teacher wrote before any of this existed. */
const learnt = { phase: "review", reps: 9, ease: 2.5, due: NOW, updated: NOW, right: 7, wrong: 1 };

/** The old number card, as a learner's device holds one. */
const oldCard = (/** @type {string} */ id, /** @type {any} */ over = {}) => ({
  id, lang: "ar-PS", kind: "word", tags: [], created: 1, updated: 1,
  forms: [{ id: `${id}-f0`, ar: "arba3iin", en: "40", lat: "", s: { ar2en: learnt }, ...over }],
});

test("a learner's year on the card a box was filled from goes to the card that replaces it", () => {
  const sys = { ...SYS, migratedFrom: { "ten.40": "k40", "unit.7": "k7" } };
  const fresh = generate({ composer: arComposer, sys, timeComposer: null, timeSys: null, tag: "Numbers", now: NOW });
  const held = [oldCard("k40")];
  const handed = handOn(fresh.items, held, sys);

  const card = byId(handed, componentId(sys.id, "ten.40"));
  assert.deepEqual(must(leadOf(card).s, "states").ar2en, learnt, "the schedule came across");
  /* The faces under it are cells of a table the old model never had, so
     there is nothing of theirs to inherit and nothing is invented. */
  for (const face of subFormsOf(card)) assert.deepEqual(face.s, {});
  /* And a box whose card this learner does not hold is simply a new card. */
  assert.deepEqual(leadOf(byId(handed, componentId(sys.id, "unit.7"))).s, {});
  /* Nothing was taken off the old card: it is still on the device, in its
     deck, with everything on it. A later release is what removes it. */
  assert.deepEqual(held[0].forms[0].s, { ar2en: learnt });
});

test("and a card the device already holds keeps its own schedule, not an older one", () => {
  /* Whatever this device has learnt since is the answer. Handing the old
     card's schedule to a card already being asked would undo a week. */
  const sys = { ...SYS, migratedFrom: { "ten.40": "k40" } };
  const fresh = generate({ composer: arComposer, sys, timeComposer: null, timeSys: null, tag: "Numbers", now: NOW });
  const id = componentId(sys.id, "ten.40");
  const held = [
    oldCard("k40"),
    { id, lang: "ar-PS", kind: "word", tags: [], created: 1, updated: 1,
      forms: [{ id: `${id}-f0`, ar: "x", en: "", lat: "", s: {} }] },
  ];
  assert.deepEqual(leadOf(byId(handOn(fresh.items, held, sys), id)).s, {});
});

test("a system that was never migrated hands nothing on, and neither does an empty card", () => {
  const fresh = generate({ composer: arComposer, sys: SYS, timeComposer: null, timeSys: null, tag: "Numbers", now: NOW });
  assert.equal(handOn(fresh.items, [oldCard("k40")], SYS), fresh.items, "no map, nothing to do");
  /* A card that was written and never answered has nothing to hand on, so
     the new card is left as the new card it is rather than being given an
     empty schedule and a fold to go with it. */
  const sys = { ...SYS, migratedFrom: { "ten.40": "k40" } };
  const blank = { ...oldCard("k40"), forms: [{ id: "k40-f0", ar: "arba3iin", en: "40", lat: "", s: {} }] };
  const card = byId(handOn(fresh.items, [blank], sys), componentId(sys.id, "ten.40"));
  assert.deepEqual(leadOf(card).s, {});
});
