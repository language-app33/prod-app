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

/*
 * The wrong answers worth drawing from: only those that look like the
 * right one.
 *
 * A wrong answer of another shape is not a wrong answer anybody weighs.
 * A number beside three words, or a sentence beside three single words,
 * is picked out by its shape alone, and the question asks nothing. So
 * the pool is kept to the answer's own shape — a number, a word, a
 * phrase or a sentence, whatever `shapeOf` calls them — and sentences,
 * which vary most, to the ones within half and double the answer's
 * length. Where too few sentences are that close, the nearest of the
 * rest make up the number: about the same length, as near as the cards
 * allow.
 *
 * What is left can be fewer than a question needs. Whether a question
 * is asked with that few is decided where the exercise is offered, on
 * the same shapes, and not here.
 */
export function lookAlikes<T>({
  answer,
  pool,
  shapeOf,
  sizeOf,
  wanted = PICK_OPTIONS,
}: {
  answer: T;
  pool: T[];
  shapeOf: (x: T) => string;
  sizeOf: (x: T) => number;
  wanted?: number;
}): T[] {
  const shape = shapeOf(answer);
  const same = pool.filter((x) => x && shapeOf(x) === shape);
  if (shape !== "sentence") return same;
  const size = Math.max(1, sizeOf(answer));
  const apart = (x: T) => Math.abs(Math.log(Math.max(1, sizeOf(x)) / size));
  const near = same.filter((x) => apart(x) <= Math.LN2);
  const short = Math.max(0, wanted - 1 - near.length);
  if (!short) return near;
  const rest = same.filter((x) => !near.includes(x)).sort((a, b) => apart(a) - apart(b));
  return near.concat(rest.slice(0, short));
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
 *
 * **And so does a second form of the same card**, when `familyOf` says
 * which card a form is. The masculine and the feminine of one phrase mean
 * the same thing, so side by side they were a coin toss; tagging the two
 * with their grammar settled the toss and gave the game away, since only
 * those two tiles carried a tag. A learner reported both. Kept apart, a
 * grid never holds two words that differ only in their grammar.
 *
 * **Nor two words that share any meaning**, when `meaningsOf` says every
 * meaning a word accepts. A card meaning "Happy / Content / Pleased" and a
 * card meaning "happy" read as two meanings to a guard that compares the
 * whole line, and then the first was shown as "Content", the second as
 * "happy", and a learner who paired the first with "happy" was marked
 * wrong for an answer the card itself accepts. A learner reported it.
 *
 * **And a grid is all one shape**, when `shapeOf` says what each word
 * is: numbers with numbers, words with words, phrases with phrases,
 * sentences with sentences. One sentence among four single words is
 * paired by its length by somebody who knows none of them. Words of
 * different shapes are dealt into grids of their own, each filled from
 * spares of its shape, and one that cannot be filled is asked another
 * way, as any short grid is.
 */
export function matchGroups<T extends { id: string }>(args: {
  wanting: T[];
  spares: T[];
  size?: number;
  min?: number;
  textOf: (x: T) => string;
  meaningOf: (x: T) => string;
  likeness?: (a: T, b: T) => number;
  familyOf?: (x: T) => string;
  meaningsOf?: (x: T) => string[];
  shapeOf?: (x: T) => string;
}): { grids: T[][]; dropped: T[] } {
  const {
    wanting,
    spares,
    size = PAIR_WORDS,
    min = MIN_PAIR_WORDS,
    textOf,
    meaningOf,
    likeness = () => 0,
    familyOf = (x) => x.id,
    meaningsOf = (x) => [meaningOf(x)],
    shapeOf = () => "",
  } = args;
  const asked = wanting.filter((w) => w && plain(textOf(w)) && plain(meaningOf(w)));
  const dropped: T[] = wanting.filter((w) => !asked.includes(w));
  if (!asked.length) return { grids: [], dropped };

  const shapes = Array.from(new Set(asked.map(shapeOf)));
  if (shapes.length > 1) {
    const grids: T[][] = [];
    for (const shape of shapes) {
      const one = matchGroups({
        ...args,
        wanting: asked.filter((w) => shapeOf(w) === shape),
        spares: spares.filter((w) => w && shapeOf(w) === shape),
      });
      grids.push(...one.grids);
      dropped.push(...one.dropped);
    }
    return { grids, dropped };
  }
  const shape = shapes[0];

  const count = Math.max(1, Math.ceil(asked.length / size));
  const grids: T[][] = Array.from({ length: count }, () => []);
  const texts = grids.map(() => new Set<string>());
  const meanings = grids.map(() => new Set<string>());
  const families = grids.map(() => new Set<string>());
  const used = new Set<string>();

  const fits = (g: number, w: T) =>
    grids[g].length < size &&
    !texts[g].has(plain(textOf(w))) &&
    !meaningKeys(w, meaningOf, meaningsOf).some((m) => meanings[g].has(m)) &&
    !families[g].has(familyOf(w));
  const put = (g: number, w: T) => {
    grids[g].push(w);
    texts[g].add(plain(textOf(w)));
    for (const m of meaningKeys(w, meaningOf, meaningsOf)) meanings[g].add(m);
    families[g].add(familyOf(w));
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

  const pool = spares.filter(
    (w) => w && !used.has(w.id) && plain(textOf(w)) && plain(meaningOf(w)) && shapeOf(w) === shape,
  );
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
 * **No word and no meaning stands twice, and this is the gate that
 * decides it.** matchGroups asks the same question when it chooses who
 * stands together, and it is not enough on its own: it reads a card as the
 * teacher wrote it, and what reaches a tile has been narrowed to one of
 * its accepted spellings and one of its meanings. A card meaning
 * "Everything is good / All good" and a card meaning "All good" are two
 * different cards to that guard and one tile twice to a learner. So the
 * last word on it is here, where the meanings are final.
 *
 * A grid with the same meaning in it twice is not a hard question, it is
 * an unanswerable one: two tiles that read alike cannot be told apart by
 * anybody, a right pairing is as likely to be marked wrong as right, and
 * the learner is left thinking they misread the word. Learners reported
 * exactly that, twice in four minutes, and both times gave up and pressed
 * "I don't know".
 *
 * An answer that cannot stand is left out rather than drawn, and its place
 * is taken by one more spare, so the grid is the size it was meant to be
 * and elimination is no easier. It is simply not asked this time: a
 * question nobody can answer is worth less than one that waits.
 *
 * A spare is of the same shape as the words up — see matchGroups — or
 * it is the one meaning on the board that nobody needs to read to rule
 * out.
 */
export function matchSet<T extends { id: string }>({
  answers,
  pool,
  decoys = PAIR_DECOYS,
  seed,
  textOf,
  meaningOf,
  familyOf = (x) => x.id,
  meaningsOf = (x) => [meaningOf(x)],
  shapeOf = () => "",
}: {
  answers: T[];
  pool: T[];
  decoys?: number;
  seed: string;
  textOf: (x: T) => string;
  meaningOf: (x: T) => string;
  familyOf?: (x: T) => string;
  meaningsOf?: (x: T) => string[];
  shapeOf?: (x: T) => string;
}): { words: T[]; meanings: string[]; said: T[] } {
  const saidText = new Set<string>();
  const saidMeaning = new Set<string>();
  const asked = new Set(answers.map((a) => a.id));
  /* A spare meaning from another form of a word already up is the same
     meaning in other clothes — see matchGroups — so none is drawn. */
  const kin = new Set(answers.map(familyOf));
  /* Every meaning a word on the board accepts, and not only the one its
     tile shows: "happy" beside a word shown as "Content" that also means
     happy is a right pairing marked wrong — see matchGroups. */
  const clashes = (x: T) => meaningKeys(x, meaningOf, meaningsOf).some((m) => saidMeaning.has(m));
  const take = (x: T) => {
    saidText.add(plain(textOf(x)));
    for (const m of meaningKeys(x, meaningOf, meaningsOf)) saidMeaning.add(m);
  };
  /* The first of a colliding pair stands, so the word the question is
     actually about — which the caller puts first — is never the one put
     aside for the sake of its company. And one word of a card at a time:
     two forms of it are a coin toss, whatever matchGroups dealt. */
  const words: T[] = [];
  const families = new Set<string>();
  let spilled = 0;
  for (const a of answers) {
    const text = plain(textOf(a));
    const meaning = plain(meaningOf(a)).toLowerCase();
    if (!text || !meaning || saidText.has(text) || clashes(a) || families.has(familyOf(a))) {
      spilled += 1;
      continue;
    }
    take(a);
    families.add(familyOf(a));
    words.push(a);
  }
  const want = Math.max(0, decoys) + spilled;
  const spare: T[] = [];
  for (const cand of pool) {
    if (spare.length >= want) break;
    if (!cand || asked.has(cand.id) || kin.has(familyOf(cand))) continue;
    if (words.length && shapeOf(cand) !== shapeOf(words[0])) continue;
    const text = plain(textOf(cand));
    const meaning = plain(meaningOf(cand));
    if (!text || !meaning) continue;
    if (saidText.has(text) || clashes(cand)) continue;
    take(cand);
    kin.add(familyOf(cand));
    spare.push(cand);
  }
  /* Shuffled on their own seed, or a word and its meaning would come up
     in the same place on both sides and the grid would read itself. */
  const said = shuffledBy(words.concat(spare), `${seed} meanings`, (x) => x.id);
  return {
    words: shuffledBy(words, seed, (x) => x.id),
    meanings: said.map(meaningOf),
    /* And whose meanings those are, in the same order.

       A caller with something to say about a meaning tile beyond the words
       on it — which form of which card it belongs to — cannot find that out
       from the string: two meanings can read alike, and looking a tile up by
       what it says is the exact mistake the grid was proofed against. So the
       units come back beside their meanings and a tile is found by where it
       is, here as everywhere else in this exercise. */
    said,
  };
}

const plain = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

/* A tile's meaning as shown and every meaning its word accepts, in the one
   spelling they are compared in. */
function meaningKeys<T>(x: T, meaningOf: (x: T) => string, meaningsOf: (x: T) => string[]): string[] {
  return [meaningOf(x), ...meaningsOf(x)].map((m) => plain(m).toLowerCase()).filter(Boolean);
}
