/*
 * The stacking order, read off the stylesheet.
 *
 * jsdom does no layout and no painting, so the app can render perfectly in a
 * test while a panel covers half the controls in a real browser. That is
 * exactly what happened: a space frame is a screen, and the corner menu and
 * space selector sat below it, so opening Teaching or Admin painted them out
 * of sight — no way back but a reload — while the wordmark, which sat a
 * layer higher, stayed put and made it look like a rendering bug.
 *
 * These read the final z-index of each selector the way the cascade does,
 * and check the relationships that have to hold.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, ""); // comments can hold anything

/* The tokens the layers are named by. */
const tokens = {};
for (const [, name, value] of css.matchAll(/--(z-[a-z]+)\s*:\s*([^;]+);/g)) {
  tokens[`--${name}`] = Number(String(value).trim());
}

/*
 * Effective z-index per selector. Every rule here is a single class or a
 * two-class selector, and the two never compete for the same element, so
 * "the last declaration wins" is the whole cascade for this file.
 */
const layer = {};
for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const found = /(?:^|;)\s*z-index\s*:\s*([^;]+)/.exec(body);
  if (!found) continue;
  const raw = found[1].trim();
  const value = raw.startsWith("var(")
    ? tokens[raw.slice(4, raw.indexOf(")")).trim()]
    : Number(raw);
  if (!Number.isFinite(value)) continue;
  for (const sel of selectors.split(",").map((x) => x.trim())) layer[sel] = value;
}

const CHROME = [".at-brand", ".at-corner", ".at-mode", ".at-spaces"];

test("every layer token resolves to a number", () => {
  for (const [name, value] of Object.entries(tokens)) {
    assert.ok(Number.isFinite(value), `${name} is not a number`);
  }
  assert.ok(Object.keys(tokens).length >= 4, "expected a set of layer tokens");
});

test("each piece of chrome has a layer at all", () => {
  for (const sel of CHROME) {
    assert.ok(sel in layer, `${sel} sets no z-index, so its layer is an accident`);
  }
});

test("the chrome sits above a screen — a space frame must not cover it", () => {
  const screen = layer[".at-screen"];
  assert.ok(Number.isFinite(screen), ".at-screen sets no z-index");
  for (const sel of CHROME) {
    assert.ok(
      layer[sel] > screen,
      `${sel} is ${layer[sel]}, at or below .at-screen at ${screen}: opening a space would paint over it`,
    );
  }
});

test("the chrome is one layer, not four", () => {
  const values = CHROME.map((sel) => layer[sel]);
  assert.equal(
    new Set(values).size,
    1,
    `the chrome is split across ${new Set(values).size} layers: ${CHROME.map((s, i) => `${s}=${values[i]}`).join(", ")}`,
  );
});

test("a screen opened on top still covers the chrome", () => {
  assert.ok(
    layer[".at-screen.over"] > layer[".at-corner"],
    "an over-screen must be above the chrome, not under it",
  );
});

test("dialogs sit above every screen", () => {
  assert.ok(layer[".at-modalback"] > layer[".at-screen.over"]);
  assert.ok(layer[".at-modalback"] > layer[".at-screen"]);
});
