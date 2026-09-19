/*
 * Opening a card to look at it shows everything the card holds.
 *
 * The promise the teaching space makes about view-only mode, checked rather
 * than remembered. Every example card in card-corpus.mjs is rendered through
 * `CardReadout`, every field on it is walked through `fieldsOn`, and each
 * field's own rule says which strings a reader must be able to find. A value
 * on the card and not on the screen fails here, naming the field and the
 * card.
 *
 * It is generic on purpose: nothing below knows what a verb table or a group
 * tag is. A field added to a card next month is walked the day it is added,
 * and the only thing that has to be written by hand is its rule in
 * src/card-facts.ts — which is where its heading has to be written anyway.
 *
 * Rendered to static markup rather than into a browser: what is being asked
 * is whether the words are on the screen, and nothing here clicks anything.
 * The fold over the filled-in examples is the one thing a reader has to open,
 * so the sentences behind it are checked through `examplesOf` instead, which
 * is the function the screen draws them with.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CORPUS, DECKS, POOL } from "./card-corpus.mjs";
import { blanksOn, combosOf, examplesOf, fieldsOn, fillersFor } from "../src/card-facts.ts";
import { LANGUAGES } from "../src/languages.ts";
import { leadOf } from "../src/cards.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, ".readout-build");

/* shared.tsx is JSX and imports React, so it is bundled the way the other
   tests bundle it. React stays external, which is what lets the rendering
   below use the same copy. */
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
const { CardReadout } = await import(path.join(out, "shared.js"));

/** The card as a teacher reads it, as one run of words. */
const readOut = (/** @type {Record<string, any>} */ card) => {
  const markup = renderToStaticMarkup(
    React.createElement(CardReadout, {
      card,
      lang: LANGUAGES[card.lang],
      decks: DECKS,
      cards: POOL,
    }),
  );
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

test("every value on a card is somewhere on the screen that shows it", () => {
  for (const { what, card } of CORPUS) {
    const screen = readOut(card);
    const lang = LANGUAGES[card.lang];
    const lost = [];
    for (const field of fieldsOn(card)) {
      /* A list is walked in its own right; a field nobody has described yet
         is drawn raw, which the test below is about. */
      if (!field.rule || field.rule.container || !field.rule.shown) continue;
      const wanted = field.rule.shown(field.value, { lang, card, cards: POOL, decks: DECKS });
      for (const said of wanted) {
        if (said && !screen.includes(said)) {
          lost.push(`${field.where}.${field.key}${field.at ? ` (${field.at})` : ""} — "${said}"`);
        }
      }
    }
    assert.deepEqual(
      lost,
      [],
      `${what}: the read-out does not show ${lost.join("; ")}.\n` +
        "Either draw it in CardReadout, or say in card-facts.ts what the screen does say for it.\n" +
        `What the screen says: ${screen.slice(0, 900)}`,
    );
  }
});

test("a field nothing describes yet is shown raw rather than dropped", () => {
  /* The safety net, exercised: a card carrying something nobody has written
     a heading for still says so. This is the case that makes the promise
     hold before anybody notices, so it is worth a card of its own. */
  const first = /** @type {Record<string, any>} */ (CORPUS[0].card);
  const card = {
    ...first,
    bookmarked: "every Tuesday",
    forms: first.forms.map((/** @type {Record<string, any>} */ f, /** @type {number} */ i) =>
      i === 0 ? { ...f, mood: "imperative" } : f,
    ),
  };
  const screen = readOut(card);
  assert.ok(screen.includes("Also on this card"), "the panel for undescribed fields is missing");
  assert.ok(screen.includes("every Tuesday"), `a card's own unnamed field is not shown: ${screen.slice(-400)}`);
  assert.ok(screen.includes("imperative"), `a form's unnamed field is not shown: ${screen.slice(-400)}`);
  assert.ok(screen.includes("bookmarked") && screen.includes("mood"), "the field's own name is not said");
});

test("the words behind each blank, and the sentences the card comes out as", () => {
  const frame = CORPUS.find((row) => blanksOn(row.card).length && !row.card.lines);
  assert.ok(frame, "no example card leaves a blank");
  const screen = readOut(frame.card);
  const lead = leadOf(frame.card);
  const fillers = fillersFor(lead, POOL, LANGUAGES[frame.card.lang]);
  const holes = blanksOn(frame.card);
  for (const hole of holes) {
    assert.ok(screen.includes(hole), `the blank ${hole} is not named`);
    for (const value of (fillers[hole] || []).slice(0, 4)) {
      assert.ok(
        screen.includes(value.ar),
        `${value.ar} stands in {{${hole}}} and the read-out does not say so: ${screen.slice(0, 600)}`,
      );
    }
  }
  /* And how many sentences it is met as, which is what the fold says while
     it is still shut. */
  const combos = combosOf(holes, fillers);
  assert.ok(combos > 0, "nothing fills the frame's blanks, so the corpus has drifted");
  assert.ok(
    screen.includes(String(combos)),
    `met as ${combos} sentences and the read-out does not say so`,
  );
  /* The sentences themselves are behind the fold, drawn by the same
     function: what is checked here is that it has something to draw. */
  const asked = examplesOf(lead, holes, fillers);
  assert.ok(asked.length > 0, "the frame fills to nothing");
  assert.ok(asked.every((line) => !line.ar.includes("{{")), "a filled example still has braces in it");
});

test("a sentence's blanks are drawn as blanks, never as the braces they are stored as", () => {
  for (const { what, card } of CORPUS) {
    if (!blanksOn(card).length) continue;
    const screen = readOut(card);
    assert.ok(
      !screen.includes("{{"),
      `${what}: the read-out prints the storage — ${screen.slice(0, 400)}`,
    );
  }
});

test("a student's card says the card and not the teacher's side of it", () => {
  const card = CORPUS[0].card;
  const markup = renderToStaticMarkup(
    React.createElement(CardReadout, {
      card,
      lang: LANGUAGES[card.lang],
      decks: [],
      reader: "both",
    }),
  );
  const screen = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  /* The word itself, and what it means. */
  assert.ok(screen.includes("book"), "a student cannot read their own card");
  /* And none of what is the teacher's to get right. */
  assert.ok(!screen.includes("Where it lives"), "a student is shown which decks carry the card");
  assert.ok(!screen.includes("The card's ID"), "a student is shown what other cards call it");
  assert.ok(!screen.includes("Also on this card"), "a student is shown the raw fields of their item");
});
