/*
 * Chance that does not change its mind.
 *
 * Some of what the app offers is drawn rather than chosen — which three
 * wrong answers sit beside the right one, which order a scrambled scene
 * arrives in — and every one of those draws has to come out the same way
 * twice. React renders twice in development, a re-mount is not a new
 * question, and a list of answers that reshuffled under somebody's finger
 * is the app's fault rather than theirs.
 *
 * So the draw is made from the names of the things being drawn. The same
 * ids and the same seed give the same answer for ever; a different seed
 * gives another one. Nothing here reads a clock or a global.
 *
 * Not to be confused with the shuffling in scheduler.js, which is the
 * opposite thing on purpose: that one is real chance, thrown once, so that
 * two sessions built a minute apart are not the same session.
 */

/** @param {string} str */
export function hash(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/*
 * Sorted by what each item hashes to against the seed: the same list and
 * the same seed give the same order. Ties break on the key itself, so the
 * result never depends on how the input list happened to be ordered —
 * which is what makes it safe to hand this a list that came out of a
 * document in whatever order the document held.
 */
/**
 * @template T
 * @param {T[]} list
 * @param {string} seed
 * @param {(x: T) => string} keyOf
 * @returns {T[]}
 */
export function shuffledBy(list, seed, keyOf) {
  return list
    .map((x) => ({ x, k: keyOf(x), h: hash(`${seed} ${keyOf(x)}`) }))
    .sort((a, b) => a.h - b.h || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((e) => e.x);
}

/* How many answers a question that offers a few puts up, the right one
   included. Four is enough that guessing is worse than knowing, and few
   enough to read without scrolling on a phone. */
export const PICK_OPTIONS = 4;

/*
 * The right answer and a few wrong ones, in an order that says nothing.
 *
 * Used wherever a question offers a few answers to choose between: the
 * reply that comes next in a conversation, the word missing from a phrase.
 * Anything reading the same as the right answer is dropped before the draw
 * — being marked wrong for choosing the correct words is the one
 * unforgivable question — and the answer itself is put back in at a place
 * the seed decides, so it is not always third.
 */
/**
 * @template {{ id: string }} T
 * @param {{ answer: T, pool: T[], wanted: number, seed: string, textOf: (x: T) => string }} args
 * @returns {T[]}
 */
export function optionsFor({ answer, pool, wanted, seed, textOf }) {
  const taken = new Set([plain(textOf(answer))]);
  /** @type {T[]} */
  const others = [];
  for (const cand of pool) {
    if (!cand || cand.id === answer.id) continue;
    const text = plain(textOf(cand));
    if (!text || taken.has(text)) continue;
    taken.add(text);
    others.push(cand);
  }
  const wrong = shuffledBy(others, seed, (x) => x.id).slice(0, Math.max(0, wanted - 1));
  return shuffledBy(wrong.concat([answer]), `${seed} place`, (x) => x.id);
}

/** @param {string} s */
const plain = (s) => String(s || "").replace(/\s+/g, " ").trim();
