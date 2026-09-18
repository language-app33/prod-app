/*
 * The generated list of call sites, checked against the source.
 *
 * A list of where things are used is worth having only while it is true, so
 * this re-runs the scan and fails if src/component-uses.js has fallen behind
 * — the same failure you would get from forgetting to run npm run components
 * after moving a component.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { scan, render, libraryComponents } = await import("../scripts/component-uses.mjs");
const { COMPONENT_USES } = await import("../src/component-uses.js");

const committed = readFileSync(new URL("../src/component-uses.js", import.meta.url), "utf8");

test("the committed list matches what the source says", () => {
  assert.equal(
    render(scan()),
    committed,
    "src/component-uses.js is stale — run: npm run components",
  );
});

test("every component the library exports has an entry", () => {
  const missing = libraryComponents().filter((name) => !(name in COMPONENT_USES));
  assert.deepEqual(missing, [], `no usage entry for: ${missing.join(", ")}`);
});

test("call sites carry a file, a line and the component they sit inside", () => {
  for (const [name, uses] of Object.entries(COMPONENT_USES)) {
    for (const use of uses) {
      /* Either extension: these three files are being converted from
          .jsx to .tsx one at a time. */
      assert.match(use.file, /\.[jt]sx$/, `${name}: odd file ${use.file}`);
      assert.ok(Number.isInteger(use.line) && use.line > 0, `${name}: odd line ${use.line}`);
      assert.ok(use.where && use.where.length, `${name}: no enclosing name`);
    }
  }
});

test("a component is never recorded as using itself", () => {
  for (const [name, uses] of Object.entries(COMPONENT_USES)) {
    const self = uses.filter((u) => /^shared\.[jt]sx$/.test(u.file) && u.where === name);
    assert.deepEqual(self, [], `${name} is listed as using itself`);
  }
});

test("the alias the trainer imports Field under is recorded", () => {
  /* The one rename in the app, and the reason a plain search for "<Field"
     in the trainer finds nothing. */
  const aliased = COMPONENT_USES.Field.filter((u) => u.as === "FormField");
  assert.ok(aliased.length > 0, "Field's FormField uses in the trainer were not found");
  assert.ok(aliased.every((u) => /^ArabicTrainer\.[jt]sx$/.test(u.file)));
});

test("the well-used components are found in numbers, not in ones", () => {
  /* A scan that quietly stops matching would still produce a valid file, so
     the busiest components are worth a floor. */
  assert.ok(COMPONENT_USES.Button.length > 50, `Button: ${COMPONENT_USES.Button.length}`);
  assert.ok(COMPONENT_USES.Help.length > 50, `Help: ${COMPONENT_USES.Help.length}`);
  assert.ok(COMPONENT_USES.Screen.length > 10, `Screen: ${COMPONENT_USES.Screen.length}`);
});

test("Tile and TileNote are told apart", () => {
  /* "<Tile" must not match "<TileNote", or the two counts merge. */
  assert.ok(COMPONENT_USES.Tile.length > 0);
  assert.ok(COMPONENT_USES.TileNote.length > 0);
  const overlap = COMPONENT_USES.Tile.filter((t) =>
    COMPONENT_USES.TileNote.some((n) => n.file === t.file && n.line === t.line),
  );
  /* One line may legitimately hold both, so this only checks they are not
     simply the same list. */
  assert.notEqual(overlap.length, COMPONENT_USES.Tile.length);
});

/*
 * Every icon a screen asks for is an icon that exists.
 *
 * `Icon` renders nothing for a name it does not know — which is the right
 * thing for it to do, and means a typo is invisible rather than loud: the
 * Numbers button shipped as an empty square because it asked for an icon
 * the set had never had. Nothing else would have caught it; the button was
 * in the DOM, had its label, and worked.
 */
test("every icon name used in the app is one the set has", () => {
  const files = ["ArabicTrainer.tsx", "spaces.tsx", "shared.tsx", "card-editor.tsx", "gallery.tsx"];
  const set = new Set(
    [...readFileSync(new URL("../src/shared.tsx", import.meta.url), "utf8")
      .split("export function Icon")[0]
      .matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]),
  );
  assert.ok(set.size > 20, `only found ${set.size} icons — the scan is wrong, not the source`);
  /** @type {string[]} */
  const unknown = [];
  for (const file of files) {
    const src = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    /* `icon="x"` on a button, `<Icon name="x" />` directly, and the one
       place an icon is built as a DOM node rather than rendered — the
       cross on a blank, inside a field the app draws by hand. Literals
       only: a name built at runtime is not something a file can check. */
    for (const m of src.matchAll(/(?:\bicon|<Icon\s+name)=["']([a-zA-Z][a-zA-Z0-9]*)["']|iconNode\(["']([a-zA-Z][a-zA-Z0-9]*)["']/g)) {
      const name = m[1] || m[2];
      if (!set.has(name)) unknown.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(unknown, [], `icons that render as nothing: ${unknown.join(", ")}`);
});
