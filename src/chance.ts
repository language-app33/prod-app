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
   nothing to discriminate between and the question answers itself. This is
   what makes the exercise available on a card at all; how many words a
   particular grid ends up with is MIN_PAIR_WORDS. */
export const MIN_PAIR_MATES = 4;

/* The fewest words a grid is dealt with. A learner's first session has
   three new words and nothing else met, and three against five meanings is
   still a question; two is a coin toss. */
export const MIN_PAIR_WORDS = 3;

/*
 * The grids a session deals, from the words it means to ask.
 *
 * Every word in a grid is a question — paired, marked and scheduled in its
 * own right — so which words stand together is decided here, once, when the
 * session is built, and travels with it. `wanting` are the forms the
 * session already means to ask the grid of, in its order; `spares` are the
 * forms that may be dealt in beside them to fill a grid out, best first —
 * met already, so that filling a grid never introduces a card the rules
 * for what is new did not admit.
 *
 * As many grids as the wanting words need at `size` to a grid, dealt round
 * so that six words make two grids of three rather than five and one. Each
 * is then filled from the spares, taking the spare most like what is
 * already in it — telling apart things that resemble each other is the one
 * thing a question about a single word can never ask — and a grid that
 * still falls short of `min` is not dealt: its words come back as
 * `dropped`, for the caller to ask some other way.
 *
 * A second word reading the same as one already in a grid, or a second
 * meaning, goes in a different grid or none. Either would make a pairing
 * that is right and marked wrong.
 */
export function matchGroups<T extends { id: string }>({
  wanting,
  spares,
  size = PAIR_WORDS,
  min = MIN_PAIR_WORDS,
  textOf,
  meaningOf,
  likeness = () => 0,
}: {
  wanting: T[];
  spares: T[];
  size?: number;
  min?: number;
  textOf: (x: T) => string;
  meaningOf: (x: T) => string;
  likeness?: (a: T, b: T) => number;
}): { grids: T[][]; dropped: T[] } {
  const asked = wanting.filter((w) => w && plain(textOf(w)) && plain(meaningOf(w)));
  const dropped: T[] = wanting.filter((w) => !asked.includes(w));
  if (!asked.length) return { grids: [], dropped };

  const count = Math.max(1, Math.ceil(asked.length / size));
  const grids: T[][] = Array.from({ length: count }, () => []);
  const texts = grids.map(() => new Set<string>());
  const meanings = grids.map(() => new Set<string>());
  const used = new Set<string>();

  const fits = (g: number, w: T) =>
    grids[g].length < size &&
    !texts[g].has(plain(textOf(w))) &&
    !meanings[g].has(plain(meaningOf(w)).toLowerCase());
  const put = (g: number, w: T) => {
    grids[g].push(w);
    texts[g].add(plain(textOf(w)));
    meanings[g].add(plain(meaningOf(w)).toLowerCase());
    used.add(w.id);
  };

  asked.forEach((w, i) => {
    if (used.has(w.id)) return;
    for (let k = 0; k < count; k++) {
      const g = (i + k) % count;
      if (fits(g, w)) {
        put(g, w);
        return;
      }
    }
    dropped.push(w);
  });

  const pool = spares.filter((w) => w && !used.has(w.id) && plain(textOf(w)) && plain(meaningOf(w)));
  for (let g = 0; g < count; g++) {
    while (grids[g].length < size) {
      let best = -1;
      let score = -Infinity;
      pool.forEach((w, i) => {
        if (used.has(w.id) || !fits(g, w)) return;
        const like = Math.max(...grids[g].map((m) => likeness(m, w)));
        if (like > score) {
          score = like;
          best = i;
        }
      });
      if (best < 0) break;
      put(g, pool[best]);
    }
  }

  /* A grid of spares alone is nobody's question: dealt only where it holds
     at least one of the words the session meant to ask. */
  const dealt: T[][] = [];
  for (const g of grids) {
    if (g.length >= min && g.some((w) => asked.includes(w))) dealt.push(g);
    else dropped.push(...g.filter((w) => asked.includes(w)));
  }
  return { grids: dealt, dropped };
}

/*
 * A matching grid: the words, and the meanings they are to be paired with.
 *
 * The words are the ones the session dealt — see matchGroups — and every
 * one of them is asked. What is drawn here is the rest: the spare meanings
 * that keep elimination from finishing the job, taken from the pool in the
 * order the caller thinks best, and the order the two columns stand in.
 *
 * A meaning reading the same as one already up is not drawn, for the
 * reason optionsFor drops a repeated word: it would make a pairing that is
 * right and marked wrong.
 */
export function matchSet<T extends { id: string }>({
  answers,
  pool,
  decoys = PAIR_DECOYS,
  seed,
  textOf,
  meaningOf,
}: {
  answers: T[];
  pool: T[];
  decoys?: number;
  seed: string;
  textOf: (x: T) => string;
  meaningOf: (x: T) => string;
}): { words: T[]; meanings: string[] } {
  const saidText = new Set(answers.map((a) => plain(textOf(a))));
  const saidMeaning = new Set(answers.map((a) => plain(meaningOf(a)).toLowerCase()));
  const asked = new Set(answers.map((a) => a.id));
  const spare: T[] = [];
  for (const cand of pool) {
    if (spare.length >= Math.max(0, decoys)) break;
    if (!cand || asked.has(cand.id)) continue;
    const text = plain(textOf(cand));
    const meaning = plain(meaningOf(cand));
    if (!text || !meaning) continue;
    if (saidText.has(text) || saidMeaning.has(meaning.toLowerCase())) continue;
    saidText.add(text);
    saidMeaning.add(meaning.toLowerCase());
    spare.push(cand);
  }
  return {
    words: shuffledBy(answers, seed, (x) => x.id),
    /* Shuffled on their own seed, or a word and its meaning would come up
       in the same place on both sides and the grid would read itself. */
    meanings: shuffledBy(answers.concat(spare), `${seed} meanings`, (x) => x.id).map(meaningOf),
  };
}

const plain = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
