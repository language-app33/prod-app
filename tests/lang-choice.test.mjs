/*
 * Which languages are in play — see src/lang-choice.ts.
 *
 * The switch above Learning and the one above Teaching read the same two
 * rules: what is stored is cleaned up before anything reads it, and a
 * teacher is offered every language their courses, decks and cards are in.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { inPlayWith, langsOffAmong, teachingChoices } from "../src/lang-choice.ts";

const known = { "ar-PS": { name: "Palestinian Arabic" }, "vi-Hue": { name: "Huế Vietnamese" } };

test("a language switched off and since gone is dropped", () => {
  assert.deepEqual(langsOffAmong(["vi-Hue", "he-IL"], [{ id: "ar-PS" }, { id: "vi-Hue" }]), ["vi-Hue"]);
});

test("every language switched off reads as none of them", () => {
  assert.deepEqual(langsOffAmong(["ar-PS", "vi-Hue"], [{ id: "ar-PS" }, { id: "vi-Hue" }]), []);
});

test("nothing stored, or something that is not a list, is nothing off", () => {
  assert.deepEqual(langsOffAmong(undefined, [{ id: "ar-PS" }]), []);
  assert.deepEqual(langsOffAmong("vi-Hue", [{ id: "ar-PS" }, { id: "vi-Hue" }]), []);
});

test("a teacher is offered the languages of their courses, decks and cards, with the cards counted", () => {
  const got = teachingChoices(["ar-PS"], ["ar-PS"], ["ar-PS", "ar-PS", "vi-Hue"], known);
  assert.deepEqual(got, [
    { id: "ar-PS", name: "Palestinian Arabic", ready: 0, total: 2 },
    { id: "vi-Hue", name: "Huế Vietnamese", ready: 0, total: 1 },
  ]);
});

test("a course's language is offered before it has a card", () => {
  const got = teachingChoices(["ar-PS", "vi-Hue"], [], ["ar-PS"], known);
  assert.deepEqual(got.map((c) => [c.id, c.total]), [["ar-PS", 1], ["vi-Hue", 0]]);
});

test("a language this build has no pack for, or none at all, is not offered", () => {
  const got = teachingChoices(["xx-YY", undefined], [undefined], ["ar-PS", undefined], known);
  assert.deepEqual(got.map((c) => c.id), ["ar-PS"]);
});

test("a thing that cannot say its language stays in play", () => {
  assert.equal(inPlayWith(["vi-Hue"], "vi-Hue"), false);
  assert.equal(inPlayWith(["vi-Hue"], "ar-PS"), true);
  assert.equal(inPlayWith(["vi-Hue"], undefined), true);
});
