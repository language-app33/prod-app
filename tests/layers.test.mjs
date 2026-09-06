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

/* --- buttons in a row never wrap ---

   A wrapped label makes a row of buttons different heights and reads as
   something gone wrong, so a tight row steps down in type and padding
   together instead. Whether it actually fits is a question only a browser
   can answer, and it is measured there at five widths; what can be held
   here is that the rules which make it possible are still present. Deleting
   any of them would put the wrapping back with nothing to notice. */

/*
 * Everything the stylesheet declares for exactly this selector.
 *
 * Two traps, both of which produced a passing test that meant nothing.
 * ".at-answerbar.at-row {" contains ".at-row {", so a loose search reads a
 * different rule's body — hence the leading newline. And a selector may
 * carry several rules, so taking the first would miss a declaration made
 * further down; they are all joined instead.
 */
const rule = (selector) => {
  const parts = [];
  const needle = "\n" + selector + " {";
  let at = css.indexOf(needle);
  while (at >= 0) {
    parts.push(css.slice(at, css.indexOf("}", at)));
    at = css.indexOf(needle, at + 1);
  }
  return parts.join("\n");
};

for (const row of [".at-row > .at-btn", ".at-screenfoot > .at-btn"]) {
  test(`${row} refuses to break a label`, () => {
    const body = rule(row);
    assert.ok(body, `${row} has no rule at all`);
    assert.match(body, /white-space:\s*nowrap/, `${row} may wrap`);
    /* Nowrap on its own turns a wrap into an overflow, which is worse. The
       type has to give way instead. */
    assert.match(body, /font-size:\s*clamp\(/, `${row} does not shrink to fit`);
    assert.match(body, /--share/, `${row} does not size from the room it has`);
  });
}

test("a row knows how many buttons are sharing it", () => {
  /* --share divides the row between its children, so the count has to be
     right or three buttons would be sized as though they were two. */
  for (const container of [".at-row", ".at-screenfoot"]) {
    for (const n of [2, 3]) {
      assert.ok(
        css.includes(`${container}:has(> :nth-child(${n}))`),
        `${container} does not count ${n} buttons`,
      );
    }
    assert.match(rule(container), /container-type:\s*inline-size/, container);
  }
});

test("the rule reaches a row's own buttons and not a picker inside one", () => {
  /* A Segmented in a row renders .at-btn children of its own. Sizing those
     from the row's share would hand a three-way picker the type of a
     full-width button. */
  assert.equal(css.includes(".at-row .at-btn {"), false, "the selector must be a child combinator");
  assert.ok(css.includes(".at-row > .at-btn {"));
});

/* --- the answer bar --- */

test("the answer bar is pinned to the window, not to whatever scrolls", () => {
  /* Sticky is relative to a scrolling ancestor; this has to hold against
     the window whatever the page is doing. */
  const body = rule(".at-answerbar.at-row");
  assert.match(body, /position:\s*fixed/);
  assert.match(body, /bottom:\s*calc\(var\(--kb-overlap/,
    "the bar must lift by however much the keyboard is covering");
});

test("the page reserves room for the bar, and only while there is one", () => {
  /* Once an answer is in, the three buttons are replaced by Continue in the
     ordinary flow — reserving their height then leaves a screenful of
     nothing under it. */
  assert.ok(css.includes(".at.in-exercise:has(.at-answerbar)"));
  assert.ok(css.includes(".at.kb-open.in-exercise:has(.at-answerbar)"),
    "the keyboard rule needs the same guard, and wins on specificity");
});

test("a question is no longer drawn as a card", () => {
  /* .at-card still exists — the session summary and other screens use it —
     but the exercise does not, and must not pick up a border or a shadow by
     being given the class back. */
  const body = rule(".at-exercise");
  assert.ok(body, "the exercise block has no rule");
  assert.doesNotMatch(body, /border:|box-shadow:|background:/);
});
