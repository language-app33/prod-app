/*
 * The list of what a card holds, and the cards it is checked against.
 *
 * `src/card-facts.ts` is the one description of a card that the view-only
 * screen is drawn from. This is the half of its guarantee that catches a
 * field nobody has thought about yet: every key the editor's save emits, and
 * every field the card record documents, has to be described there, or named
 * as not being information for a reader, *and* be carried by one of the
 * example cards. Without the second half the render test beside this one
 * would pass by having nothing to look at.
 *
 * The keys are read out of the code rather than maintained twice — from
 * `writtenCard`, which is the only thing that turns an editor into a saved
 * card, and from the source of `src/types.ts`, the way the text-styles and
 * screen-elements references are read against the sources they describe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { CORPUS } from "./card-corpus.mjs";
import {
  CARD_FACTS,
  NOT_SHOWN,
  factRules,
  fieldsOn,
  grammarDims,
  lexicalKeys,
  ruleFor,
  unnamedOn,
} from "../src/card-facts.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".facts-build");

/* card-editor.tsx is JSX and imports React, so it is bundled the way the
   other tests bundle it rather than imported raw. Only `writtenCard` is
   used, and only for the keys it emits. */
await build({
  entryPoints: [path.join(here, "..", "src", "card-editor.tsx")],
  outfile: path.join(out, "card-editor.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  loader: { ".jsx": "jsx" },
  logLevel: "silent",
});
const { writtenCard } = await import(path.join(out, "card-editor.js"));

/*
 * What the editor writes, asked of the editor.
 *
 * A stub draft rather than a real one: what is wanted here is the shape of
 * what comes out, and a hook's worth of state would say no more about that
 * than this does. A field added to a saved card shows up in these keys
 * whether or not anybody remembered this file.
 */
const draft = {
  shownSpec: null,
  ownForms: [{ id: "f1", ar: "كِتاب", en: "book", lat: "kitaab" }],
  tableCells: [],
  forms: [{ id: "f1", ar: "كِتاب", en: "book", lat: "kitaab" }],
  note: "",
  standsIn: false,
  name: "",
  uses: [],
  fills: [],
  category: "noun",
  refName: "",
  spread: [],
  stripped: [],
};
const written = writtenCard({ word: draft, talk: {
  title: "At the door",
  setting: "",
  speakers: ["Layla", "Karim"],
  you: null,
  written: [],
}, shape: "word", chosen: ["deck-1"] });

const EDITOR_KEYS = Object.keys(written);

/* The fields the card record documents, read off its source. A field with a
   comment above it is a field somebody decided to store; one without is
   still a field, so both shapes are read. */
const types = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
const fieldsOf = (/** @type {string} */ name) => {
  const at = types.indexOf(`export type ${name} = `) >= 0
    ? types.indexOf(`export type ${name} = `)
    : types.indexOf(`export interface ${name} {`);
  assert.ok(at >= 0, `${name} is not declared in src/types.ts`);
  const open = types.indexOf("{", at);
  let depth = 0;
  let end = open;
  for (let i = open; i < types.length; i++) {
    if (types[i] === "{") depth++;
    if (types[i] === "}") depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  const body = types.slice(open + 1, end);
  /* Only the record's own fields: a nested object's are that object's. */
  return [...body.matchAll(/^ {2}([a-zA-Z_][\w]*)\??:/gm)].map((m) => m[1]);
};

const CARD_FIELDS = fieldsOf("Card");
const FORM_FIELDS = fieldsOf("CardForm");

/* Where each key may be described. A card's `note` and a form's are the
   same word in two places, so the search is by name and not by name and
   place: what matters is that something says what the field is. */
const described = (/** @type {string} */ key) =>
  factRules().some((r) => r.key === key) || NOT_SHOWN.some(([k]) => k.endsWith(`.${key}`));

const carried = (/** @type {string} */ key) =>
  CORPUS.some(({ card }) => fieldsOn(card).some((f) => f.key === key));

/*
 * The keys the editor hands out that a stored card never carries, and which
 * are therefore not the read-out's to show.
 *
 * Two kinds, both about the handover rather than the card. A rename or a
 * group-strip the teacher asked for travels *beside* the card being saved,
 * so the screen holding the rest of the collection can do the walking. And
 * a conversation arrives as one `scene`, which the save unpacks into the
 * card's own word, its note, its speakers and its turns — every one of
 * which is described and carried.
 */
const NOT_STORED = ["spread", "stripped", "scene"];

test("every key the editor's save writes is described, and carried by an example card", () => {
  const mine = EDITOR_KEYS.filter((k) => !NOT_STORED.includes(k));
  const missing = mine.filter((k) => !described(k)).sort();
  assert.deepEqual(
    missing,
    [],
    `writtenCard emits ${missing.join(", ")} and card-facts.ts says nothing about them — ` +
      "describe each in CARD_FACTS, or say why it is not information in NOT_SHOWN",
  );
  const uncarried = mine.filter((k) => !carried(k)).sort();
  assert.deepEqual(
    uncarried,
    [],
    `no example card in tests/card-corpus.mjs carries ${uncarried.join(", ")}, ` +
      "so nothing checks that the read-out shows it",
  );
});

test("and so is every field a card and its forms are documented to hold", () => {
  const undescribed = [...CARD_FIELDS, ...FORM_FIELDS].filter((k) => !described(k)).sort();
  assert.deepEqual(
    undescribed,
    [],
    `src/types.ts documents ${undescribed.join(", ")} and card-facts.ts says nothing about them`,
  );
});

test("the axes a language declares are described without being named one by one", () => {
  for (const dim of grammarDims()) {
    for (const on of /** @type {const} */ (["form", "answer"])) {
      const rule = ruleFor(on, dim.field);
      assert.ok(rule, `${dim.field} on a ${on} has no rule`);
      assert.equal(rule.label, dim.label, `${dim.field} is labelled twice, differently`);
    }
  }
  for (const key of lexicalKeys()) {
    assert.ok(ruleFor("form", key), `the lexical axis ${key} has no rule`);
  }
});

test("each rule says what its field is, and says how the screen shows it", () => {
  const seen = new Set();
  for (const rule of CARD_FACTS) {
    const at = `${rule.on}.${rule.key}`;
    assert.ok(!seen.has(at), `${at} is described more than once`);
    seen.add(at);
    assert.ok(rule.what.trim().length > 20, `${at} is described in ${rule.what.length} characters`);
    assert.ok(/[.!]$/.test(rule.what.trim()), `${at}'s description is not a sentence: ${rule.what}`);
    assert.ok(
      rule.container || typeof rule.shown === "function",
      `${at} neither says what the screen shows for it nor is a list walked in its own right`,
    );
    assert.ok(["teacher", "both"].includes(rule.reader), `${at} is shown to "${rule.reader}"`);
  }
});

test("and each field nobody is shown says why", () => {
  const seen = new Set();
  for (const [key, why] of NOT_SHOWN) {
    assert.ok(!seen.has(key), `${key} is listed twice`);
    seen.add(key);
    assert.match(key, /^(card|form|line|answer)\.[a-zA-Z]\w*$/, `${key} is not a where.key`);
    assert.ok(why.trim().length > 20, `${key} is excused in ${why.length} characters`);
    assert.ok(/[.!]$/.test(why.trim()), `${key}'s reason is not a sentence: ${why}`);
    const [where, field] = key.split(".");
    assert.ok(
      !ruleFor(/** @type {import("../src/card-facts.ts").Where} */ (where), field),
      `${key} is both described and hidden`,
    );
  }
});

test("the example cards are what they say they are, and nothing about them is a surprise", () => {
  for (const { what, card } of CORPUS) {
    const fields = fieldsOn(card);
    assert.ok(fields.length > 4, `${what} holds almost nothing`);
    /* Nothing in the corpus should be landing in the "also on this card"
       panel: a card here that carries an undescribed field means the field
       arrived and nobody named it, which is exactly the failure the panel
       exists to make visible — and is worth failing for here, where it can
       be read. */
    const unnamed = unnamedOn(card).map((f) => `${f.where}.${f.key}`);
    assert.deepEqual(
      unnamed,
      [],
      `${what} carries ${unnamed.join(", ")}, which nothing in card-facts.ts describes`,
    );
  }
});
