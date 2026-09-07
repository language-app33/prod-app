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
  /* A picker in a row is its own control with its own options inside it.
     Sizing those from the row's share would hand a three-way picker the
     type of a full-width button — which is what a descendant selector
     here would do. */
  assert.equal(css.includes(".at-row .at-btn {"), false, "the selector must be a child combinator");
  assert.ok(css.includes(".at-row > .at-btn {"));
});

test("a picker is one control rather than a row of buttons", () => {
  /* Three separate pills read as three things you could do. One track
     holding three options reads as three states of one thing, which is
     what it is — and it is what tells you they are alternatives. */
  const track = rule(".at-segmented");
  assert.match(track, /background:/, "the track has no ground of its own");
  assert.match(track, /border:/, "the track has no edge");
  /* Inside the track, not floating beside it: a hairline gap, not the
     button gutter the three pills used to sit in. */
  assert.match(track, /gap:\s*3px/);
  assert.match(rule(".at-seg"), /background:\s*var\(--raised\)/, "the options have no ground");
  assert.match(rule(".at-seg.on"), /background:\s*var\(--jade\)/, "the chosen option is not lit");
  /* Flat, not glowing: a translucent green edge around a solid green
     block reads as a shadow around it rather than as an edge. */
  assert.match(rule(".at-seg.on"), /border-color:\s*transparent/);
  assert.doesNotMatch(track, /box-shadow/);
  assert.doesNotMatch(rule(".at-seg"), /box-shadow/);
  /* Labels stay whole: the type steps down with the track, and what still
     will not fit takes the next line rather than being clipped. */
  assert.match(rule(".at-seg"), /font-size:\s*clamp\(/);
  assert.match(rule(".at-seg"), /min-width:\s*min-content/);
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
  /* Both sides of a question have a bar now — three buttons before the
     answer, Continue after it — so the room is reserved either way, and
     still only where a bar exists. */
  assert.ok(css.includes(".at.in-exercise:has(.at-answerbar)"));
  assert.ok(css.includes(".at.kb-open.in-exercise:has(.at-answerbar)"),
    "the keyboard rule needs the same guard, and wins on specificity");
});

test("a row that cannot fit wraps rather than spilling off the screen", () => {
  /* Two rules together. min-content, so a nowrap label is never squashed
     below its own width — squashed, it does not get smaller, it overflows
     the row, which is what three buttons in the backup section did. And
     wrap, so what will not fit drops to a second line whole. */
  const row = rule(".at-row");
  assert.match(row, /flex-wrap:\s*wrap/, "the row cannot wrap");
  assert.match(rule(".at-row > *"), /min-width:\s*min-content/, "a label can still be squashed");
  /* Basis zero, so buttons that do fit come out matching rather than each
     as wide as its own label. */
  assert.match(rule(".at-row > *"), /flex:\s*1 1 0/);
  /* The footer of a screen is the same kind of row and gets the same. */
  assert.match(rule(".at-screenfoot"), /flex-wrap:\s*wrap/);
  assert.match(rule(".at-screenfoot > *"), /min-width:\s*min-content/);
});

test("the one row that must not wrap, does not", () => {
  /* The answer bar is fixed to the foot of the screen with a measured
     amount of page reserved under it, so a second line would sit over the
     answer. It shrinks its type instead, and has been checked to fit at
     320px. */
  assert.match(rule(".at-answerbar.at-row"), /flex-wrap:\s*nowrap/);
  assert.match(rule(".at-answerbar.at-row > *"), /min-width:\s*0/);
});

test("a picker comes in two widths and they mean different things", () => {
  /* Compact takes the width its labels need, with every option as wide as
     the longest — which is equal grid columns at max-content, and has no
     flex equivalent. Full width shares whatever the track is given. */
  const compact = rule(".at-segmented.sm");
  assert.match(compact, /display:\s*grid/);
  assert.match(compact, /grid-auto-columns:\s*1fr/, "the options are not all one width");
  assert.match(compact, /width:\s*max-content/, "compact does not shrink to its content");
  /* And no container query on that one: a container cannot be sized by
     what is inside it, which is what shrinking to fit is. So its type is
     fixed rather than stepped down. */
  assert.match(compact, /container-type:\s*normal/);
  assert.match(rule(".at-segmented.sm .at-seg"), /font-size:\s*13px/);
  assert.match(rule(".at-segmented"), /width:\s*100%/, "full width is not full width");
});

test("the bar's gap is the one the step-down formula divides by", () => {
  /* The type is sized from what is left of the row after the gaps. A bar
     that tightened its gap without the formula knowing would size its
     buttons for a width they no longer have — too small, invisibly. */
  const row = rule(".at-row");
  assert.match(row, /gap:\s*var\(--gap\)/, "the row's gap is not a variable");
  assert.match(row, /--share:.*var\(--gap\)/, "--share still assumes a fixed gap");
  assert.match(rule(".at-answerbar.at-row"), /--gap:/, "the bar does not set its own gap");
});

test("nothing on the answer screen moves", () => {
  /* The question and the answer box used to shrink and fade over 240ms.
     Deleted, and easy to bring back by accident: the classes are still on
     the elements, so a transition added to either would animate again with
     no code change to notice. */
  assert.doesNotMatch(rule(".at-ask"), /transition/);
  assert.doesNotMatch(rule(".at-answerbox"), /transition/);
  for (const gone of [".at-ask.done", ".at-answerbox.done", ".at-asked .at-instruction"]) {
    assert.equal(css.includes(gone + " {"), false, `${gone} is back`);
  }
});

test("what is not the answer is in a box", () => {
  /* An inset container, not a bare run of blocks: without a border and a
     background it is a group only in the markup. */
  const body = rule(".at-alsobox");
  assert.ok(body, "the box has no rule at all");
  assert.match(body, /border:/, "the box has no edge");
  assert.match(body, /background:/, "the box has no ground");
  /* The dividers are the box's, so the related words — which are not an
     .at-answeralso — are separated like everything beside them, and the
     first member does not draw a rule against the box's own edge. */
  assert.match(rule(".at-alsobox > * + *"), /border-top:/);
  assert.match(rule(".at-alsobox > *"), /border-top:\s*0/);
});

test("a question is no longer drawn as a card", () => {
  /* .at-card still exists — the session summary and other screens use it —
     but the exercise does not, and must not pick up a border or a shadow by
     being given the class back. */
  const body = rule(".at-exercise");
  assert.ok(body, "the exercise block has no rule");
  assert.doesNotMatch(body, /border:|box-shadow:|background:/);
});

test("the question is asked at one size, whatever the exercise", () => {
  /* Every field that can fill the prompt — the script, the romanisation,
     the meaning — sized from one variable rather than from its own
     styling. Miss one and that exercise alone shows a different question
     size, which is exactly the bug this replaced: the same card asked at
     44px, 25px and 19px depending on the type. */
  const prompt = rule(
    ".at .at-exercise .at-ask > .at-arabic,\n.at .at-exercise .at-ask > .at-en,\n.at .at-exercise .at-ask > .at-latin"
  );
  assert.ok(prompt, "the prompt has no rule of its own");
  assert.match(prompt, /font-size:\s*var\(--ask\)/, "the prompt is not sized from one variable");
  /* The gap below the instruction is half the leading plus the block's own
     margin. Both have to be fixed, or one size still lands at two
     distances. */
  assert.match(prompt, /line-height:\s*[\d.]+\s*;/, "the prompt has no line-height of its own");
  assert.match(prompt, /margin:\s*0/, "the prompt keeps a margin that varies by field");

  /* And the size is a property of the room, not of the exercise: a
     narrower screen and the phone keyboard may change it, nothing else. */
  const asks = [...css.matchAll(/--ask:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(asks.length >= 1, "--ask is never set");
  assert.ok(asks.every((v) => /^\d+px$/.test(v)), `--ask is not a plain size: ${asks.join(", ")}`);
});

test("a listening question starts where a written one does", () => {
  /* The play button has no leading above it, so left alone it sits higher
     than a word does under the same instruction. It is pushed down by the
     half-leading the text gets. */
  assert.match(rule(".at .at-exercise .at-ask .at-playbig"), /margin-top:\s*calc\(var\(--ask\)/);
});
