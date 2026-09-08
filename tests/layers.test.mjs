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

test("the foot is pinned to the window, not to whatever scrolls", () => {
  /* Sticky is relative to a scrolling ancestor; this has to hold against
     the window whatever the page is doing. The foot is what is pinned —
     the bar is a row inside it, with the quiet line or the flag above. */
  const body = rule(".at-foot");
  assert.match(body, /position:\s*fixed/);
  assert.match(body, /bottom:\s*calc\(var\(--kb-overlap/,
    "the foot must lift by however much the keyboard is covering");
  /* And the bar must not pin itself as well, or the two would stack on
     top of each other instead of one above the other. */
  assert.doesNotMatch(rule(".at-answerbar.at-row"), /position:\s*fixed/,
    "the bar pins itself, so nothing can sit above it");
});

test("what sits above the bar is stacked, not offset by a guessed height", () => {
  /* The bar is 8px of padding plus whatever a button is today, and that
     changes with the type scale and again with the keyboard up. Anything
     that writes that number into an offset is one button-size edit from a
     gap or an overlap, so the two are children of one column instead. */
  const extra = rule(".at-footextra");
  assert.ok(extra, "there is no rule for what sits above the bar");
  assert.doesNotMatch(extra, /position:\s*(fixed|absolute)/,
    "the line above the bar positions itself rather than being stacked");
  assert.doesNotMatch(extra, /bottom:/, "the line above the bar offsets itself off the bar");
});

test("the quiet way out is text, like the flag beside it", () => {
  /* Both are ways past a question rather than things to do with it, so
     neither takes an outline or a fill. One rule covers both, which is
     how they stay the same as each other. */
  const body = rule(".at-flagbtn, .at-quietbtn");
  assert.ok(body, "the two are no longer set together");
  assert.match(body, /background:\s*none/);
  assert.match(body, /border:\s*0/);
  assert.equal(css.includes("\n.at-quietbtn {"), false,
    "the quiet button has picked up a rule of its own again");
});

test("the flag menu opens upward once the flag is at the foot", () => {
  /* Below it is the bar and then the edge of the screen. */
  const body = rule(".at-footextra .at-flagmenu");
  assert.match(body, /bottom:\s*100%/, "the menu would open off the bottom of the screen");
});

test("the verdict is one size, and a large one", () => {
  /* It is the same sentence every time, so it lands in the same place at
     the same weight whatever the exercise put on the screen. Sized from
     one variable, and nothing about the exercise may touch it — only the
     phone keyboard, which is not the exercise. */
  /* Capped by --verdict, and sized from the screen below that so the
     longest verdict — 496px wide at 28px — stays on one line on a 288px
     column. nowrap is what turns that from a hope into a guarantee. */
  assert.match(rule(".at-shout"), /font-size:\s*min\(var\(--verdict\),\s*calc\(/,
    "the verdict is not capped by --verdict and fitted to the screen");
  assert.match(rule(".at-shout"), /white-space:\s*nowrap/, "the verdict may still wrap");
  const sizes = [...css.matchAll(/--verdict:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length >= 1, "--verdict is never set");
  assert.ok(sizes.every((n) => n >= 20), `--verdict is ${sizes.join(", ")}px, which is not large`);
  /* The declarations, with whatever selector each sits on. Anything but
     the base and the keyboard means the size has started varying again. */
  const owners = [...css.matchAll(/([^\n{}]+)\{[^{}]*--verdict:/g)].map((m) => m[1].trim());
  assert.deepEqual(owners, [".at", ".at.kb-open"],
    `--verdict is set by ${owners.join(", ")}`);
});

test("every rule that sets the script's size multiplies by the script's scale", () => {
  /* font-size sets the em box, not the height of a letter. The sizes here
     were tuned by eye against Arabic, and every script rule is shared
     across languages, so a Latin script inherited sizes meant for a script
     that fills less of its box. Each pack now says what to multiply by,
     and a rule that sets a raw number puts one language back to guessing.

     Only rules that render the taught script: the English gloss beside a
     script word, and the word-labelled keys, are interface text. */
  const SCRIPT = /(\.at-arabic|\.at-input\.ar|\.at-key(?![.\w-])|\.at-(readvalue|minicard|item|pcardtop|previewrow) \.ar|\.at-ctx(word|bare) b)/;
  const raw = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!SCRIPT.test(selectors)) continue;
    for (const [, prop, value] of body.matchAll(/(font-size|line-height)\s*:\s*([^;]+)/g)) {
      const v = value.trim();
      if (v === "normal" || v.includes("var(--sscale") || v.includes("var(--sleading") || v.includes("var(--ask")) continue;
      if (v.includes("var(--lscale")) continue;   /* Latin beside the script, scaled as Latin */
      /* The keyboard's fitted rows size from the width of the row, not
         from a length, so the scale has nothing to multiply. */
      if (v.includes("var(--kw")) continue;
      raw.push(`${selectors.trim().split("\n")[0]} { ${prop}: ${v} }`);
    }
  }
  assert.deepEqual(raw, [], `unscaled script sizes:\n  ${raw.join("\n  ")}`);
});

test("no rule falls back to one particular language", () => {
  /*
   * font-family: var(--sfont, var(--ar)) and direction: var(--sdir, rtl)
   * meant a script rule the learner's language never reached still
   * rendered — in Arabic. Correct-looking for a third of the languages
   * and silently wrong for the rest, and invisible for as long as Arabic
   * was the only one there was.
   *
   * The defaults live on .at now and are the interface face, left to
   * right: a language that fails to arrive looks like a bug rather than
   * looking like Arabic. So a fallback on either variable is the defect
   * coming back, wherever it is written.
   */
  const fellBack = [...css.matchAll(/var\(\s*--(sfont|sdir)\s*,/g)].map((m) => `--${m[1]}`);
  assert.deepEqual(fellBack, [], `a script variable fell back to a language: ${fellBack.join(", ")}`);

  const sfont = /--sfont\s*:\s*([^;]+);/.exec(css);
  const sdir = /--sdir\s*:\s*([^;]+);/.exec(css);
  assert.ok(sfont, "--sfont needs a neutral default, or every rule naming it is voided");
  assert.ok(sdir, "--sdir needs a neutral default, or every rule naming it is voided");
  assert.equal(sdir[1].trim(), "ltr", "the no-language direction has to be the document's, not Arabic's");

  /*
   * And no stylesheet rule may name a script's typeface at all. Those
   * belong to the pack. The one exception is the wordmark: مُفْرَدات is
   * the product's own name and stays Arabic in a Hebrew course, so it
   * carries its own stack and must never be reachable from a script rule.
   */
  const SCRIPT_FACES =
    /Naskh|Amiri|Scheherazade|Traditional Arabic|Geeza|Al Bayan|Arabic Typesetting|Be Vietnam|Frank Ruehl|David CLM|Arial Hebrew|Noto (Sans|Serif) Hebrew/;
  const strays = [];
  for (const [, prop, value] of css.matchAll(/(--[a-z-]+|font-family)\s*:\s*([^;}]+)/g)) {
    if (SCRIPT_FACES.test(value) && prop !== "--wordmark") strays.push(`${prop}: ${value.trim()}`);
  }
  assert.deepEqual(strays, [], `a typeface for one script, in the stylesheet:\n  ${strays.join("\n  ")}`);

  assert.equal(
    (css.match(/var\(--wordmark\)/g) || []).length,
    1,
    "only the wordmark itself may read --wordmark",
  );
});

test("a script rule aligns to where the language begins, not to a side", () => {
  /* text-align: right is only correct while the script is Arabic's or
     Hebrew's. start and end are the same edges named by the direction the
     pack sets, so they follow the language instead of outliving it. */
  const SCRIPT = /(\.at-arabic|\.at-input\.ar|\.at-key(?![.\w-])|\.at-(readvalue|minicard|item|pcardtop|previewrow) \.ar|\.at-ctx(word|bare) b)/;
  const sided = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!SCRIPT.test(selectors)) continue;
    for (const [, value] of body.matchAll(/text-align\s*:\s*([^;]+)/g)) {
      if (/^(left|right)$/.test(value.trim())) sided.push(`${selectors.trim().split("\n")[0]} { text-align: ${value.trim()} }`);
    }
  }
  assert.deepEqual(sided, [], `a script rule picked a side:\n  ${sided.join("\n  ")}`);
});

test("the box you answer in is one height whatever you are typing", () => {
  /* English was 55px tall and the script 102px, so the screen jumped
     between exercises. One height set outright: a single-line field
     centres its text, so the padding is what goes, not the type size. */
  const box = rule(".at-answerbox .at-input");
  assert.ok(box, "the answer box has no height of its own");
  assert.match(box, /height:\s*\d+px/, "the answer box is not given one height");
  assert.match(box, /box-sizing:\s*border-box/, "the height would not include the border");
  assert.match(rule(".at.kb-open .at-answerbox .at-input"), /height:\s*\d+px/,
    "with the keyboard up the answer box has no height of its own");
});

test("every token the stylesheet uses is a token the stylesheet defines", () => {
  /* --ink was named in fifteen rules and defined in none. A colour that
     does not exist is not an error anywhere: the declaration is quietly
     dropped, a border vanishes, a heading inherits whatever is around it,
     and the selected tab went without its outline through several rounds
     of being asked for one — and --accent, which colours the select button
     and picked tiles, was missing the same way. So: every bare var(--x)
     has to have a --x: somewhere. Reported as a list, so the next one is a
     name and not a hunt. */
  /* A reference with a fallback — var(--sfont, var(--ar)) — is the author
     saying the token may be absent: those three are set from JavaScript at
     runtime. Only a bare var(--x) has to be backed by a --x: here. */
  const used = new Set([...css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)].map((m) => m[1]));
  const defined = new Set([...css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !defined.has(t)).sort();
  assert.deepEqual(missing, [], `used but never defined: ${missing.join(", ")}`);
});

test("the selected tab has a stroke, in a colour that exists in both themes", () => {
  /* The outline is what says which tab is current; a shade of fill alone
     does not. It is its own token — a dark grey in both themes — rather
     than the page's ink, which is near-white in the dark theme and would
     read as a highlight rather than an outline. */
  const on = rule(".at-tab2.on");
  assert.match(on, /border-color:\s*var\(--tab-stroke\)/, "the selected tab does not stroke with --tab-stroke");
  const definitions = [...css.matchAll(/--tab-stroke\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(definitions.length >= 2, `--tab-stroke is defined ${definitions.length} time(s); it needs the dark and the light theme`);
  assert.ok(definitions.every((v) => /^#[0-9a-fA-F]{6}$/.test(v)), `--tab-stroke should be a plain colour: ${definitions.join(", ")}`);
  /* And the base tab still draws a border, or the colour has nothing to colour. */
  assert.match(rule(".at-tab2"), /border:\s*2px solid/, "the tab has no border for the stroke to take");
});

test("what is not the answer opens on a tap, not by default", () => {
  /* The answer is what you came back for; five blocks of context under it
     is a page to scroll past. The invitation is small and centred, and
     carries the chevron that says which way the box will go. */
  const more = rule(".at-alsomore");
  assert.ok(more, "there is no rule for the invitation");
  assert.match(more, /background:\s*none/);
  assert.match(more, /border:\s*0/);
});

test("the foot is not cut in two by a rule between its parts", () => {
  /* The bar drew a hairline under the line above it, which read as a
     header for the buttons rather than a thing beside them. The foot has
     one edge, at the top. */
  assert.match(rule(".at-footextra + .at-answerbar.at-row"), /border-top:\s*0/,
    "the bar still draws a line under the text above it");
  /* And the text is centred between the drawn edge and the buttons: the
     button brings 6px of its own on each side, and the top loses one to
     the hairline, so 3px over 4px is what comes out even. */
  assert.match(rule(".at-footextra"), /padding:\s*3px 10px 4px\s*;/,
    "the line above the bar is not centred between the edge and the buttons");
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
  assert.match(
    rule(".at .at-exercise .at-ask > .at-arabic"),
    /font-size:\s*var\(--ask\)/,
    "the script in the prompt is not sized from the one variable",
  );
  assert.match(
    rule(".at .at-exercise .at-ask > .at-en,\n.at .at-exercise .at-ask > .at-latin"),
    /font-size:\s*var\(--askl\)/,
    "the meaning and the romanisation are not sized from the one variable",
  );
  /* The gap below the instruction is half the leading plus the block's own
     margin. Both have to be fixed, or one size still lands at two
     distances. */
  assert.match(
    prompt,
    /line-height:\s*calc\([\d.]+ \* var\(--sleading, 1\)\)/,
    "the prompt has no line-height of its own, scaled by the script's leading",
  );
  assert.match(prompt, /margin:\s*0/, "the prompt keeps a margin that varies by field");

  /* And the size is a property of the room and of the script, not of the
     exercise: a narrower screen, the phone keyboard, and the language's own
     type scale may change it, nothing else. The scale is inside --ask
     rather than on the three rules that read it, because the slot holds
     the script, the meaning or the romanisation and all three have to stay
     one size as each other. */
  const bases = [...css.matchAll(/--askbase:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(bases.length >= 1, "--askbase is never set");
  assert.ok(
    bases.every((v) => /^\d+px$/.test(v)),
    `--askbase carries something other than a plain size: ${bases.join(", ")}`,
  );
  /* One base, taken twice. Keeping the factors off the base is what stops
     them compounding: in a Vietnamese course the script's factor and
     Latin's are the same number, and a prompt that took both would come
     out at 0.61 of the size it asked for. */
  const asks = [...css.matchAll(/--ask:\s*([^;]+);/g)].map((m) => m[1].trim());
  const askls = [...css.matchAll(/--askl:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(asks, ["calc(var(--askbase) * var(--sscale, 1))"]);
  assert.deepEqual(askls, ["calc(var(--askbase) * var(--lscale, 1))"]);
});

test("Latin in an exercise is sized as Latin, not as the script", () => {
  /* The meaning and the romanisation are Latin whatever is being taught,
     and every size in the stylesheet was tuned against Arabic. Left raw
     they read louder than the word being learnt. A rule here that forgets
     the factor puts one field back to shouting. */
  const LATIN = /\.at-(en|latin)(?![\w-])/;
  const raw = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!LATIN.test(selectors)) continue;
    for (const [, value] of body.matchAll(/font-size\s*:\s*([^;]+)/g)) {
      const v = value.trim();
      if (v.includes("var(--lscale") || v.includes("var(--askl")) continue;
      raw.push(`${selectors.trim().split("\n")[0]} { font-size: ${v} }`);
    }
  }
  assert.deepEqual(raw, [], `Latin sized as though it were the script:\n  ${raw.join("\n  ")}`);
});

test("a listening question starts where a written one does", () => {
  /* The play button has no leading above it, so left alone it sits higher
     than a word does under the same instruction. It is pushed down by the
     half-leading the text gets. */
  assert.match(rule(".at .at-exercise .at-ask .at-playbig"), /margin-top:\s*calc\(var\(--ask\)/);
});
