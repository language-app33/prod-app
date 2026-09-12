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
 * Not to be confused with the shuffling in scheduler.ts, which is the
 * opposite thing on purpose: that one is real chance, thrown once, so that
 * two sessions built a minute apart are not the same session.
 */

export function hash(str: string): number {
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
export function shuffledBy<T>(list: T[], seed: string, keyOf: (x: T) => string): T[] {
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
export function optionsFor<T extends { id: string }>({
  answer,
  pool,
  wanted,
  seed,
  textOf,
}: {
  answer: T;
  pool: T[];
  wanted: number;
  seed: string;
  textOf: (x: T) => string;
}): T[] {
  const taken = new Set([plain(textOf(answer))]);
  const others: T[] = [];
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

/* How many words a matching grid puts up, and how many spare meanings
   stand beside them.

   The spares are the whole reason the grid is honest. Five words against
   five meanings gets easier with every pair made — the last one is free and
   the one before it is a coin toss — so a grid of five really asks three
   questions and rewards doing the easy ones first. Two meanings that match
   nothing mean elimination never finishes the job. */
export const PAIR_WORDS = 5;
export const PAIR_DECOYS = 2;

/* The fewest other cards a grid can be drawn from: three to stand beside
   the one being asked, and one meaning going spare. Below that there is
   nothing to discriminate between and the question answers itself. */
export const MIN_PAIR_MATES = 4;

/*
 * A matching grid: some words, and the meanings they are to be paired with.
 *
 * The pool arrives in the order the caller thinks best — most alike first —
 * because which words stand together is the whole exercise. Six unrelated
 * words is a warm-up; six that could be mistaken for one another is a test,
 * and telling them apart is the one thing a question about a single word
 * can never ask.
 *
 * Two things are dropped before the draw, for the reason optionsFor drops
 * them: a second word reading the same as another, and a second meaning
 * reading the same as another. Either would make a pairing that is right
 * and marked wrong.
 */
export function matchSet<T extends { id: string }>({
  answer,
  pool,
  words = PAIR_WORDS,
  decoys = PAIR_DECOYS,
  seed,
  textOf,
  meaningOf,
}: {
  answer: T;
  pool: T[];
  words?: number;
  decoys?: number;
  seed: string;
  textOf: (x: T) => string;
  meaningOf: (x: T) => string;
}): { words: T[]; meanings: string[] } {
  const saidText = new Set([plain(textOf(answer))]);
  const saidMeaning = new Set([plain(meaningOf(answer)).toLowerCase()]);
  const usable: T[] = [];
  for (const cand of pool) {
    if (!cand || cand.id === answer.id) continue;
    const text = plain(textOf(cand));
    const meaning = plain(meaningOf(cand));
    if (!text || !meaning) continue;
    if (saidText.has(text) || saidMeaning.has(meaning.toLowerCase())) continue;
    saidText.add(text);
    saidMeaning.add(meaning.toLowerCase());
    usable.push(cand);
  }
  const mates = usable.slice(0, Math.max(0, words - 1));
  const spare = usable.slice(mates.length, mates.length + Math.max(0, decoys));
  return {
    words: shuffledBy(mates.concat([answer]), seed, (x) => x.id),
    /* Shuffled on their own seed, or a word and its meaning would come up
       in the same place on both sides and the grid would read itself. */
    meanings: shuffledBy(mates.concat([answer], spare), `${seed} meanings`, (x) => x.id).map(meaningOf),
  };
}

const plain = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
