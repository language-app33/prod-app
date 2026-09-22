// @ts-check
/*
 * What a system reads as, whatever arrives.
 *
 * The boundary is *total*: it narrows, it never throws, and it never
 * reports why. So what is tested here is not "is this rejected" but
 * "what does this become" — which is the only question a total reader
 * answers, and the one a reader that threw would let nobody ask.
 *
 * The rule underneath every case: **a system is somebody's afternoon of
 * typing.** Anything readable survives, anything unreadable becomes
 * absent, and nothing ever costs the teacher the rest of the document.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { must } from "./helpers.mjs";
import {
  LIMITS,
  clipsOfSystem,
  emptyNumberSystem,
  emptyTimeSystem,
  readLexeme,
  readNoun,
  readNumberSystem,
  readTimeSystem,
} from "../src/numbers/schema.ts";

const NOW = 1750000000000;

const good = () => ({
  id: "n1",
  owner: "lena",
  languageId: "ar-PS",
  composerVersion: 1,
  lexemes: {
    "unit.1": { slot: "unit.1", forms: { standalone: "one", f: "one-f" }, audio: { standalone: ["a1b2c3d4"] } },
    "unit.2": { slot: "unit.2", forms: { standalone: "two" } },
  },
  overrides: { 300: { text: "three-hundred" }, "3|construct.f": { text: "three-cf" } },
  nouns: [{ id: "book", sg: "book", dual: "books-2", pl: "books", gender: "m", en: "book" }],
  audioPolicy: "components",
  rev: 4,
  created: NOW,
  updated: NOW,
});

/* ---- nothing throws, ever ---- */

test("nothing thrown at the door comes back as an exception", () => {
  const nasty = [
    null, undefined, 0, 1, "", "a string", true, [], [1, 2], () => {}, NaN, Infinity,
    { }, { id: 1 }, { id: "x" }, { languageId: "ar-PS" },
    { id: "x", languageId: "ar-PS", lexemes: "not an object" },
    { id: "x", languageId: "ar-PS", lexemes: { a: null } },
    { id: "x", languageId: "ar-PS", overrides: [1, 2, 3] },
    { id: "x", languageId: "ar-PS", nouns: "nope" },
    { id: "x", languageId: "ar-PS", nouns: [null, 7, {}] },
    { id: "x", languageId: "ar-PS", minuteExprs: 5, periods: {} },
  ];
  for (const raw of nasty) {
    assert.doesNotThrow(() => readNumberSystem(raw), `numbers: ${JSON.stringify(raw)}`);
    assert.doesNotThrow(() => readTimeSystem(raw), `times: ${JSON.stringify(raw)}`);
  }
  /* A document that refers to itself does not hang the reader either. */
  const loop = /** @type {any} */ ({ id: "x", languageId: "ar-PS" });
  loop.lexemes = { self: loop };
  assert.doesNotThrow(() => readNumberSystem(loop));
});

test("only a thing that is not a system at all comes back as nothing", () => {
  assert.equal(readNumberSystem({ id: "x" }), null, "no language");
  assert.equal(readNumberSystem({ languageId: "  " }), null, "a blank language is no language");
  /* An id is the server's to give, so a system on its way to its first
     save has none and is still a system. Refusing it here would refuse
     every first save, which is the one that matters most. */
  const fresh = must(readNumberSystem({ id: "", languageId: "ar-PS" }), "fresh");
  assert.equal(fresh.id, "");
  assert.equal(must(readTimeSystem({ languageId: "ar-PS" }), "fresh time").id, "");
  /* And everything else is a system with less in it. */
  const thin = must(readNumberSystem({ id: "x", languageId: "ar-PS" }), "thin");
  assert.deepEqual(thin.lexemes, {});
  assert.deepEqual(thin.overrides, {});
  assert.deepEqual(thin.nouns, []);
  assert.equal(thin.rev, 0);
});

/* ---- what survives ---- */

test("a whole system comes through with everything a composer reads", () => {
  const got = must(readNumberSystem(good()), "system");
  assert.equal(got.id, "n1");
  assert.equal(got.owner, "lena");
  assert.equal(got.languageId, "ar-PS");
  assert.equal(got.composerVersion, 1);
  assert.equal(got.rev, 4);
  assert.equal(got.updated, NOW);
  assert.deepEqual(Object.keys(got.lexemes), ["unit.1", "unit.2"]);
  assert.equal(got.lexemes["unit.1"].forms.f, "one-f");
  assert.deepEqual(must(got.lexemes["unit.1"].audio, "audio").standalone, ["a1b2c3d4"]);
  assert.deepEqual(Object.keys(got.overrides).sort(), ["300", "3|construct.f"]);
  assert.equal(got.nouns[0].dual, "books-2");
  /* And reading it back changes nothing, which is what makes it safe to
     run on every refresh. */
  assert.deepEqual(readNumberSystem(got), got);
});

test("a field nobody declared is dropped rather than carried for ever", () => {
  const got = must(readNumberSystem({ ...good(), somethingElse: "hello", __proto__: { x: 1 } }), "sys");
  assert.equal(/** @type {any} */ (got).somethingElse, undefined);
  const lex = must(readLexeme("unit.1", { forms: { standalone: "one", nonsense: "x" } }), "lexeme");
  assert.deepEqual(Object.keys(lex.forms), ["standalone"]);
});

/* ---- what becomes absent ---- */

test("a box with nothing in it is not a box", () => {
  assert.equal(readLexeme("unit.1", { forms: {} }), null);
  assert.equal(readLexeme("unit.1", { forms: { standalone: "   " } }), null);
  assert.equal(readLexeme("unit.1", null), null);
  assert.equal(readLexeme("", { forms: { standalone: "x" } }), null);
  /* Which is how "never filled in" and "filled in and cleared" come to be
     one state — nothing anywhere reads the difference between them. */
  const got = must(readNumberSystem({ ...good(), lexemes: { "unit.9": { forms: { standalone: "" } } } }), "sys");
  assert.deepEqual(got.lexemes, {});
});

test("a value of the wrong shape becomes no value, never a wrong one", () => {
  const got = must(
    readNumberSystem({
      ...good(),
      composerVersion: "one",
      rev: null,
      created: -5,
      lexemes: { "unit.1": { forms: { standalone: 42, f: ["x"], m: "fine" } } },
      nouns: [{ id: "n", sg: "s", pl: "p", gender: "banana", en: 7 }],
    }),
    "sys",
  );
  assert.equal(got.composerVersion, 0);
  assert.equal(got.rev, 0);
  assert.equal(got.created, 0);
  assert.deepEqual(Object.keys(got.lexemes["unit.1"].forms), ["m"]);
  assert.equal(got.nouns[0].gender, "m", "an unknown gender reads as the commoner one");
  assert.equal(got.nouns[0].en, "");
});

test("a noun with nothing to count is not a noun; one with no dual still is", () => {
  assert.equal(readNoun({ id: "x", sg: "a" }), null, "no plural");
  assert.equal(readNoun({ id: "x", pl: "a" }), null, "no singular");
  assert.equal(readNoun({ sg: "a", pl: "b" }), null, "no id");
  const noDual = must(readNoun({ id: "x", sg: "a", pl: "b", gender: "f" }), "noun");
  assert.equal(noDual.dual, undefined);
  assert.equal(noDual.gender, "f");
  /* An id is a name the app writes into a card id, so it is narrowed the
     way every other such name is. */
  assert.equal(must(readNoun({ id: "a b/c!", sg: "a", pl: "b" }), "noun").id, "abc");
});

/* ---- keys the composer could never ask for ---- */

test("an override nobody could ever reach is not kept", () => {
  const got = must(
    readNumberSystem({
      ...good(),
      overrides: {
        47: { text: "fine" },
        "47|f": { text: "fine too" },
        "47|banana": { text: "no such face" },
        "-1": { text: "not a number" },
        "1.5": { text: "not whole" },
        "99999999": { text: "past the ceiling" },
        "": { text: "nothing at all" },
        "47|": { text: "half a key" },
      },
    }),
    "sys",
  );
  assert.deepEqual(Object.keys(got.overrides).sort(), ["47", "47|f"]);
});

test("a time override is a time, on the clock, in a style that exists", () => {
  const got = must(
    readTimeSystem({
      id: "t", languageId: "ar-PS",
      overrides: {
        "07:45": { text: "fine" },
        "07:45|exact": { text: "fine too" },
        "7:45": { text: "not padded" },
        "24:00": { text: "not an hour" },
        "07:60": { text: "not a minute" },
        "07:45|shouted": { text: "not a style" },
      },
    }),
    "time",
  );
  assert.deepEqual(Object.keys(got.overrides).sort(), ["07:45", "07:45|exact"]);
});

test("a minute expression lands only on a five-minute mark", () => {
  const got = must(
    readTimeSystem({
      id: "t", languageId: "ar-PS",
      minuteExprs: {
        15: { text: "quarter", refHour: "same" },
        45: { text: "quarter", refHour: "next" },
        17: { text: "seventeen past", refHour: "same" },
        30: { text: "  ", refHour: "same" },
        60: { text: "an hour", refHour: "same" },
      },
    }),
    "time",
  );
  assert.deepEqual(Object.keys(got.minuteExprs).sort(), ["15", "45"]);
  assert.equal(must(got.minuteExprs["45"], "45").refHour, "next");
  assert.equal(must(got.minuteExprs["15"], "15").refHour, "same", "an unknown reference reads as this hour");
});

test("how a word sounds comes through the door beside the word, everywhere", () => {
  /* It is what goes onto the card the word becomes, so the boundary has
     to keep it — and has to drop it where there is nothing to sound like,
     on the same rule every other field here follows. */
  const numbers = must(
    readNumberSystem({
      languageId: "ar-PS",
      lexemes: {
        "unit.1": { slot: "unit.1", forms: { standalone: "wahad" }, lat: { standalone: "waahad", nonsense: "x" } },
      },
      overrides: { 300: { text: "tultmiyye", lat: "tultmiyye" } },
    }),
    "numbers",
  );
  assert.deepEqual(must(numbers.lexemes["unit.1"].lat, "lat"), { standalone: "waahad" },
    "a face no language declares is not a face");
  assert.equal(must(numbers.overrides["300"], "300").lat, "tultmiyye");

  const times = must(
    readTimeSystem({
      id: "t", languageId: "ar-PS",
      lexemes: { "hour.word": { slot: "hour.word", forms: { standalone: "saa3a" }, lat: { standalone: "is-saa3a" } } },
      minuteExprs: { 15: { text: "quarter", refHour: "same", lat: "rub3" }, 30: { text: "half", refHour: "same" } },
      periods: [
        { slot: "morning", text: "morning", lat: "is-subuh", fromHour: 5, toHour: 11 },
        { slot: "night", text: "night", fromHour: 22, toHour: 4 },
      ],
    }),
    "time",
  );
  assert.equal(must(must(times.lexemes["hour.word"], "hour").lat, "lat").standalone, "is-saa3a");
  assert.equal(must(times.minuteExprs["15"], "15").lat, "rub3");
  assert.equal(must(times.minuteExprs["30"], "30").lat, undefined, "none written, none stored");
  assert.equal(times.periods[0].lat, "is-subuh");
  assert.equal(times.periods[1].lat, undefined);
});

test("a part of the day may run backwards, because one of them always does", () => {
  const got = must(
    readTimeSystem({
      id: "t", languageId: "ar-PS",
      periods: [
        { slot: "night", text: "night", fromHour: 22, toHour: 4 },
        { slot: "wild", text: "wild", fromHour: -9, toHour: 99 },
        { slot: "night", text: "twice", fromHour: 1, toHour: 2 },
        { text: "unnamed", fromHour: 1, toHour: 2 },
      ],
    }),
    "time",
  );
  assert.deepEqual(got.periods.map((p) => p.slot), ["night", "wild"]);
  assert.equal(got.periods[0].fromHour, 22);
  assert.equal(got.periods[0].toHour, 4, "a range over midnight is kept as one");
  assert.equal(got.periods[1].fromHour, 0, "an hour off the clock is pulled onto it");
  assert.equal(got.periods[1].toHour, 23);
});

/* ---- limits ---- */

test("a box holds a word, not a novel", () => {
  const long = "x".repeat(5000);
  const got = must(
    readNumberSystem({ ...good(), lexemes: { "unit.1": { forms: { standalone: long } } } }),
    "sys",
  );
  assert.equal(must(got.lexemes["unit.1"].forms.standalone, "word").length, LIMITS.text);
  /* And a system holds a lexicon, not a dictionary. */
  /** @type {Record<string, any>} */
  const many = {};
  for (let i = 0; i < LIMITS.slots + 50; i += 1) many[`unit.${i}`] = { forms: { standalone: "w" } };
  assert.equal(Object.keys(must(readNumberSystem({ ...good(), lexemes: many }), "sys").lexemes).length, LIMITS.slots);
});

test("a clip hash is a hash", () => {
  const got = must(
    readNumberSystem({
      ...good(),
      lexemes: {
        "unit.1": {
          forms: { standalone: "one" },
          audio: { standalone: ["deadbeef", "NOTAHASH", "", "0123456789abcdef", "zz"] },
        },
      },
    }),
    "sys",
  );
  assert.deepEqual(must(got.lexemes["unit.1"].audio, "audio").standalone, ["deadbeef", "0123456789abcdef"]);
});

/* ---- the recordings a system refers to ---- */

test("every recording a system refers to comes out of one door", () => {
  const sys = must(
    readNumberSystem({
      ...good(),
      lexemes: {
        "unit.1": { forms: { standalone: "one" }, audio: { standalone: ["aaaaaaaa"], f: ["bbbbbbbb"] } },
      },
      overrides: { 300: { text: "x", audio: ["cccccccc"] } },
      curatedAudio: { 47: ["dddddddd"], "not a key": ["eeeeeeee"] },
    }),
    "sys",
  );
  assert.deepEqual(clipsOfSystem(sys).sort(), ["aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd"]);
  const time = must(
    readTimeSystem({
      id: "t", languageId: "ar-PS",
      lexemes: { "hour.word": { forms: { standalone: "hour" }, audio: { standalone: ["11111111"] } } },
      minuteExprs: { 15: { text: "quarter", refHour: "same", audio: ["22222222"] } },
      periods: [{ slot: "am", text: "morning", fromHour: 5, toHour: 11, audio: ["33333333"] }],
    }),
    "time",
  );
  assert.deepEqual(clipsOfSystem(time).sort(), ["11111111", "22222222", "33333333"]);
  assert.deepEqual(clipsOfSystem(null), []);
});

/* ---- starting points ---- */

test("an empty system is a system, and reads back as itself", () => {
  const numbers = emptyNumberSystem("n1", "lena", "ar-PS", NOW, 1);
  assert.deepEqual(readNumberSystem(numbers), numbers);
  const times = emptyTimeSystem("t1", "lena", "ar-PS", "n1", NOW, 1);
  assert.deepEqual(readTimeSystem(times), times);
  assert.equal(times.clock, "12h");
  assert.equal(times.numberSystemId, "n1");
  /* The word for *minute* is there and empty rather than missing, so the
     composer reports a gap where it reaches for it instead of the reader
     refusing the document. */
  assert.equal(times.minuteNoun.sg, "");
  assert.equal(times.minuteNoun.id, "minute");
});
