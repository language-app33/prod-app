/*
 * The reference in Admin → App and the screens it describes, kept in step.
 *
 * The list exists so a change can be asked for by name. A name that no
 * longer exists sends the reader looking for something that is not there;
 * an element added to a screen and never written down is invisible to
 * anyone reading the list rather than the source. Both are failures of the
 * same promise, so both fail here.
 *
 * The names are read out of ArabicTrainer.jsx rather than maintained
 * twice: data-el on an element, and the `name` prop on a Field, which is
 * where the -text names come from.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCREEN_ELEMENTS } from "../src/screen-elements.ts";

const source = readFileSync(new URL("../src/ArabicTrainer.jsx", import.meta.url), "utf8");

const inCode = new Set([
  ...[...source.matchAll(/data-el="([a-z-]+)"/g)].map((m) => m[1]),
  ...[...source.matchAll(/\bname="([a-z-]+-text)"/g)].map((m) => m[1]),
]);

const listed = SCREEN_ELEMENTS.flatMap(([, rows]) => rows.map(([name]) => name));

test("every element the practice screens carry is in the reference", () => {
  const missing = [...inCode].filter((n) => !listed.includes(n)).sort();
  assert.deepEqual(
    missing,
    [],
    `the screens carry ${missing.join(", ")} and the reference does not mention them — ` +
      `add a row to SCREEN_ELEMENTS in gallery.tsx`,
  );
});

test("and the reference names nothing the screens have dropped", () => {
  const stale = listed.filter((n) => !inCode.has(n)).sort();
  assert.deepEqual(stale, [], `the reference still lists ${stale.join(", ")}`);
});

test("each row says what its element is, and each name is listed once", () => {
  const dupes = listed.filter((n, i) => listed.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `listed more than once: ${dupes.join(", ")}`);
  for (const [screen, rows] of SCREEN_ELEMENTS) {
    assert.ok(rows.length, `${screen} has no elements`);
    for (const [name, what] of rows) {
      assert.equal(typeof what, "string", name);
      assert.ok(what.trim().length > 20, `${name} is described in ${what.length} characters`);
      assert.ok(/[.!]$/.test(what.trim()), `${name}'s description is not a sentence: ${what}`);
    }
  }
});
