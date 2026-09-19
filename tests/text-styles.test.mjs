/*
 * The text styles listed in Admin → App and the stylesheet, kept in step.
 *
 * The list is worth having only while its sizes are the app's sizes. A
 * style whose rule has gone sends the reader looking for something that is
 * not there; one whose size has moved since it was written down is worse,
 * because it answers the question wrongly rather than not at all. Both
 * fail here.
 *
 * The sizes are read out of src/index.css rather than maintained twice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXT_STYLES, TYPE_SCALE } from "../src/text-styles.ts";

const raw = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
/* Comments first: one sitting above a rule is otherwise read as part of
   its selector, and every style with a note above it would go missing. */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, " ");

/* At-rule blocks go too. A narrow-screen override is a real rule, but it is
   not the one the list is about — the list says what a style is, and the
   phone it is read on is not part of that. */
/** @param {string} text */
function withoutAtRules(text) {
  let out = "";
  for (let i = 0; i < text.length; ) {
    if (text[i] !== "@") {
      out += text[i++];
      continue;
    }
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open === -1 || (semi !== -1 && semi < open)) {
      i = semi === -1 ? text.length : semi + 1;
      continue;
    }
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}" && --depth === 0) break;
    }
    i = j + 1;
  }
  return out;
}

/* selector -> every font-size declared against it, in the order written. */
const sizes = new Map();
for (const rule of withoutAtRules(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const declared = /(?:^|;)\s*font-size\s*:\s*([^;]+)/.exec(rule[2]);
  if (!declared) continue;
  for (const selector of rule[1].split(",").map((s) => s.trim().replace(/\s+/g, " "))) {
    if (!selector) continue;
    if (!sizes.has(selector)) sizes.set(selector, []);
    sizes.get(selector).push(declared[1].trim());
  }
}

const listed = TEXT_STYLES.flatMap(([, styles]) => styles);

test("every style listed is one the stylesheet sets a size on", () => {
  const gone = listed.filter((s) => !sizes.has(s.name)).map((s) => s.name);
  assert.deepEqual(
    gone,
    [],
    `the stylesheet sets no font-size on ${gone.join(", ")} — ` +
      "drop the row from TEXT_STYLES in src/text-styles.ts, or point it at the rule that replaced it",
  );
});

test("and says the size the list says it does", () => {
  for (const style of listed) {
    const declared = sizes.get(style.name) || [];
    assert.ok(
      declared.includes(style.size),
      `${style.name} is ${declared.join(" / ")} in the stylesheet and ${style.size} in the list`,
    );
  }
});

test("the named sizes are the tokens the stylesheet declares", () => {
  for (const [token, size] of TYPE_SCALE) {
    const declared = new RegExp(`${token}\\s*:\\s*([^;]+)`).exec(css);
    assert.ok(declared, `${token} is listed and the stylesheet does not declare it`);
    assert.equal(
      declared[1].trim(),
      size,
      `${token} is ${declared[1].trim()} in the stylesheet and ${size} in the list`,
    );
  }
});

test("each style is named once, and says what it is", () => {
  const names = listed.map((s) => s.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `listed more than once: ${dupes.join(", ")}`);
  for (const [group, styles] of TEXT_STYLES) {
    assert.ok(styles.length, `${group} has no styles in it`);
    for (const style of styles) {
      assert.ok(style.what.trim().length > 20, `${style.name} is described in ${style.what.length} characters`);
      assert.ok(/[.!]$/.test(style.what.trim()), `${style.name}'s description is not a sentence: ${style.what}`);
      assert.ok(style.example.trim().length, `${style.name} has no example of what it holds`);
    }
  }
});

test("a specimen carries the classes its own rule is written against", () => {
  /* The specimen is the evidence: a row whose classes do not add up to its
     selector is drawn at some other style's size and says nothing true.
     Every class in the selector has to be on the specimen or on its
     wrapper, and nothing else counts as having shown it. */
  for (const style of listed) {
    const wanted = [...style.name.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    const worn = `${style.wrap || ""} ${style.cls}`.split(/\s+/).filter(Boolean);
    const missing = wanted.filter((c) => !worn.includes(c));
    assert.deepEqual(
      missing,
      [],
      `${style.name}'s specimen is drawn without ${missing.join(", ")}, so it is not that style`,
    );
  }
});
