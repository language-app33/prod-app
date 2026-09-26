// @ts-check
/*
 * The cast of a scene — see src/cast.ts.
 *
 * What has to hold:
 *
 *   * a blank plays the member named after it unless the scene says
 *     otherwise, so two lines writing `{{name}}` are one person;
 *   * a second member of the same kind is somebody else, and never draws
 *     the same word;
 *   * a member draws a card, and each line takes the form of it that its
 *     own blank admits;
 *   * every filled line passes the review that line answers to.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";
import {
  castFill,
  castOf,
  castReport,
  cleanRoles,
  filledScene,
  memberLabel,
  memberName,
  newMember,
  recast,
  roleIn,
} from "../src/cast.ts";
import { reviewPool, sentenceKey } from "../src/review.ts";
import { LANGUAGES } from "../src/languages.ts";

const ar = LANGUAGES["ar-PS"];

const person = (/** @type {string} */ id, /** @type {string} */ word, /** @type {string} */ en, created = 1) => ({
  id, lang: "ar-PS", fills: ["person"], drill: false, created,
  forms: [{ id, ar: word, en, lat: en }],
});
const place = (/** @type {string} */ id, /** @type {string} */ word, /** @type {string} */ en, created = 1) => ({
  id, lang: "ar-PS", fills: ["place"], drill: false, created,
  forms: [{ id, ar: word, en, lat: en }],
});
const people = [person("sami", "سامي", "Sami", 1), person("rami", "رامي", "Rami", 2), person("hadi", "هادي", "Hadi", 3)];
const places = [place("quds", "القدس", "Jerusalem", 4), place("yafa", "يافا", "Jaffa", 5)];
const pool = [...people, ...places];

/** The cast machinery wired to the teacher's pool, as the editor wires it. */
function wiring(/** @type {Record<string, any>} */ card, gate = /** @type {any} */ (null)) {
  /** @type {Map<string, any>} */
  const owners = new Map();
  return {
    card,
    poolOf: (/** @type {any} */ line) => {
      const { values, owner } = reviewPool(line, pool, ar);
      for (const [k, v] of owner) owners.set(k, v);
      return values;
    },
    ownerOf: (/** @type {any} */ v) => owners.get(String(v.id || v.ar)) || null,
    langFor: () => ar,
    gateOf: gate,
  };
}

const line = (/** @type {string} */ id, /** @type {string} */ text, /** @type {string} */ en, roles = /** @type {any} */ (undefined)) => ({
  id, ar: text, en, lat: "", ...(roles ? { roles } : {}),
});

test("a blank plays the member named after it; a line can cast it as somebody else", () => {
  const l = line("a", "{{person}} في {{place}}", "{{person}} in {{place}}");
  assert.equal(roleIn(l, "person"), "person");
  const moved = recast(l, "person", "person~2");
  assert.equal(roleIn(moved, "person"), "person~2");
  assert.deepEqual(cleanRoles(moved), { person: "person~2" });
  assert.equal(recast(moved, "person", "person").roles, undefined, "cast back as itself carries nothing");
  assert.equal(memberName("Person~2"), "person~2");
  assert.equal(memberName("person~1"), "person", "the first of a name is the name");
  assert.equal(memberName("~2"), "", "nothing a blank could be named is nothing");
  assert.equal(memberName("person~x"), "person", "a number that is not one reads as the first");
  assert.deepEqual(cleanRoles({ ar: "بلا فراغ", roles: { person: "person~2" } }), undefined,
    "a role for a blank the line has not got is not kept");
});

test("the cast is every member in the order the scene meets them", () => {
  const scene = {
    lines: [
      line("a", "{{person}} ساكن في {{place}}", "{{person}} lives in {{place}}"),
      line("b", "{{person}} بزور {{person}}", "{{person}} visits {{person}}"),
      line("c", "أهلا", "hello"),
    ],
  };
  const withSecond = { lines: [scene.lines[0], recast(scene.lines[1], "person", "person~2"), scene.lines[2]] };
  assert.deepEqual(castOf(scene).map((m) => m.member), ["person", "place"]);
  assert.deepEqual(castOf(withSecond).map((m) => [m.member, m.parts.map((p) => p.line)]), [
    ["person", [0]],
    ["place", [0]],
    ["person~2", [1]],
  ]);
  assert.equal(newMember(withSecond, "person"), "person~3");
  assert.equal(newMember(scene, "place"), "place~2");
  assert.equal(memberLabel("person", ["person", "person~2"]), "person 1");
  assert.equal(memberLabel("place", ["person", "place"]), "place");
});

test("one member is one word in every line it is in", () => {
  const scene = {
    lines: [
      line("a", "{{person}} ساكن في {{place}}", "{{person}} lives in {{place}}"),
      line("b", "{{person}} بحب {{place}}", "{{person}} loves {{place}}"),
    ],
  };
  for (let turn = 0; turn < 6; turn++) {
    const took = must(castFill({ ...wiring(scene), turn }), `turn ${turn}`);
    assert.equal(took.a.person.id, took.b.person.id, `the same person on turn ${turn}`);
    assert.equal(took.a.place.id, took.b.place.id, `the same place on turn ${turn}`);
  }
  const first = must(castFill(wiring(scene)), "the first turn");
  const shown = /** @type {any} */ (filledScene(scene, first));
  assert.equal(shown.lines[0].ar, "سامي ساكن في القدس");
  assert.equal(shown.lines[1].en, "Sami loves Jerusalem");
  assert.equal(shown.lines[1].reviewKey, sentenceKey(shown.lines[1]), "each line carries its fingerprint");
});

test("two members of one kind are two people, and never the same one", () => {
  const scene = {
    lines: [
      line("a", "{{person}} ساكن هون", "{{person}} lives here"),
      line("b", "{{person}} بزور {{person}}", "{{person}} visits {{person}}", { person: "person~2" }),
    ],
  };
  /* Line b's one blank is cast as the second person; to say "visits the
     first" it would need a blank of its own, which is the point. */
  for (let turn = 0; turn < 9; turn++) {
    const took = must(castFill({ ...wiring(scene), turn }), `turn ${turn}`);
    assert.notEqual(took.a.person.id, took.b.person.id, `two people on turn ${turn}`);
  }
  /* With one person to go round, there is no scene. */
  const lonely = {
    card: scene,
    poolOf: (/** @type {any} */ l) => ({ person: [{ id: "sami", ar: "سامي", en: "Sami", lat: "" }] , ...(l ? {} : {}) }),
    ownerOf: () => null,
    langFor: () => ar,
  };
  assert.equal(castFill(lonely), null);
  const report = castReport(lonely);
  assert.deepEqual(report.short, ["person"], "and the editor is told there are not enough");
  assert.deepEqual(report.members.map((m) => [m.label, m.words]), [["person 1", 1], ["person 2", 1]]);
});

test("a member draws a card, and each blank takes the form of it that blank admits", () => {
  const house = {
    id: "house", lang: "ar-PS", category: "noun", created: 1,
    forms: [
      { id: "house", ar: "بيت", en: "house", lat: "beet", number: "singular", gender: "masculine" },
      { id: "house-my", ar: "بيتي", en: "my house", lat: "beeti", row: "attached", col: "1s" },
    ],
  };
  const owners = new Map([
    ["house", { card: house, form: house.forms[0] }],
    ["house-my", { card: house, form: house.forms[1] }],
  ]);
  const bare = { id: "house", ar: "بيت", en: "house", lat: "beet" };
  const mine = { id: "house-my", ar: "بيتي", en: "my house", lat: "beeti" };
  const scene = {
    lines: [line("a", "هاد {{noun}}", "this is the {{noun}}"), line("b", "بحب {{noun}}", "I love {{noun}}")],
  };
  const took = must(castFill({
    card: scene,
    /* The first line's blank takes the word, the second's the form with a
       pronoun on the end — two narrowings of one blank name. */
    poolOf: (/** @type {any} */ l) => ({ noun: l.id === "a" ? [bare] : [mine] }),
    ownerOf: (/** @type {any} */ v) => owners.get(v.id) || null,
    langFor: () => ar,
  }), "the scene");
  assert.equal(took.a.noun.ar, "بيت");
  assert.equal(took.b.noun.ar, "بيتي", "the same card, in the form the second line asks for");
});

test("a member only draws a word every blank it plays can take", () => {
  const scene = {
    lines: [line("a", "{{person}} هون", "{{person}} is here"), line("b", "مرحبا {{person}}", "hi {{person}}")],
  };
  const report = castReport({
    card: scene,
    poolOf: (/** @type {any} */ l) => ({
      person: l.id === "a"
        ? [{ id: "sami", ar: "سامي", en: "Sami", lat: "" }, { id: "rami", ar: "رامي", en: "Rami", lat: "" }]
        : [{ id: "rami", ar: "رامي", en: "Rami", lat: "" }],
    }),
    ownerOf: () => null,
  });
  assert.deepEqual(report.members.map((m) => m.words), [1], "only Rami can stand in both");
});

test("every line is filled only with a sentence its review approves", () => {
  const scene = {
    lines: [
      line("a", "{{person}} هون", "{{person}} is here"),
      line("b", "مرحبا {{person}}", "hi {{person}}"),
    ],
  };
  const rami = sentenceKey({ ar: "مرحبا رامي", lat: "", en: "hi Rami" });
  /* Line b's review approves Rami only; line a's approves everything. */
  const gate = (/** @type {any} */ l) => (l.id === "b" ? { ok: [rami] } : null);
  const took = must(castFill({ ...wiring(scene, gate), turn: 0 }), "the scene");
  assert.equal(took.a.person.ar, "رامي", "walked on to the casting line b allows");
  assert.equal(took.b.person.ar, "رامي");
  assert.equal(castFill({ ...wiring(scene, () => ({ ok: [] })) }), null, "and none at all where nothing is approved");
});

test("a scene with no blanks has nothing to fill, which is not nothing possible", () => {
  assert.deepEqual(castFill(wiring({ lines: [line("a", "أهلا", "hello")] })), {});
});
