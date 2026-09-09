// @ts-check
/*
 * The small things every test file wanted, in one place.
 *
 * Not named *.test.mjs on purpose: `npm test` runs tests/*.test.mjs, so a
 * file of helpers here is imported and never run as a suite of its own.
 */

/**
 * The one that has to be there.
 *
 * A `find` or a query that misses is a broken test, and without this the
 * miss surfaces two lines later as "cannot read properties of undefined",
 * which names neither what was looked for nor where. It also tells the
 * checker that everything after it is the thing, not perhaps-nothing —
 * which is what stops an assertion quietly comparing undefined against
 * undefined and passing.
 *
 * Throws rather than asserting, so the harnesses that are not node:test
 * files can use it too.
 *
 * @template T
 * @param {T | null | undefined} value
 * @param {string} what
 * @returns {T}
 */
export function must(value, what) {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}
