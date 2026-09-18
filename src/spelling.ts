/*
 * Where a spelling went wrong.
 *
 * "Not quite" and the right answer underneath is a true thing to say and a
 * poor thing to learn from: a learner who writes *recieve* for *receive*
 * is told the word is wrong and left to find the letter themselves — and
 * on a script they are still learning to read, that is most of the work
 * and the part they are least able to do. One letter is wrong. Saying
 * which one is the whole difference between a correction and a verdict.
 *
 * So: the two words lined up against each other, letter by letter, and
 * what came back is runs of text — the ones that match and the ones that
 * do not — for the answer they wrote and for the one they were after. The
 * screen paints them; this decides where the marks go.
 *
 * **What counts as a letter is the language's answer and not this
 * module's.** A caller hands in `letter`, which folds one character the
 * way that language's marking folds it: the same fold the check itself
 * uses to decide whether two spellings are the same word. Two characters
 * are the same letter when they fold the same, and a character that folds
 * to nothing — a harakat, a tone mark, a space, a comma — is not a letter
 * to get wrong and is carried along with the letter it sits on. That is
 * what keeps the marks from contradicting the verdict: a word marked
 * right for its letters and wrong for its marks has no letter highlighted
 * here, and the verdict line that already says so is left to say it.
 *
 * A module of its own, with no imports, for the reason variables.ts and
 * grade.ts are: it decides what a learner is shown about their own
 * mistake, so it is somewhere a test can reach and somewhere nothing can
 * reach back into.
 */

/**
 * A stretch of one of the two answers, and whether it is a mistake.
 *
 * On what the learner wrote, `wrong` means a letter that is not in the
 * answer — one they put where it does not belong, or one too many. On the
 * answer itself it means a letter they did not write. The two are the same
 * fact told from the two sides, which is why they come back together.
 */
export interface Run {
  text: string;
  wrong?: boolean;
}

/** The two answers, marked — and whether there is anything marked at all. */
export interface Spelling {
  /** What the learner wrote, with the letters that do not belong marked. */
  yours: Run[];
  /** The answer, with the letters they did not write marked. */
  theirs: Run[];
  /** Whether either side has a mark on it. */
  wrong: boolean;
}

/** One character, folded as the language's marking folds it. */
export type Letter = (ch: string) => string;

/**
 * The letters of a string, each with where it came from.
 *
 * By the original character rather than by the folded one: what is drawn
 * is what the learner typed, so a character is the atom however many the
 * language folds it into or out of. A character that folds to nothing is
 * not a letter and is left out of the lining-up altogether.
 */
function lettersOf(s: string, letter: Letter): { keys: string[]; at: number[] } {
  const keys: string[] = [];
  const at: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const folded = letter(s[i]);
    if (!folded) continue;
    keys.push(folded);
    at.push(i);
  }
  return { keys, at };
}

/*
 * Which letters of each side do not answer to one on the other.
 *
 * The ordinary edit distance, kept as a table so the path can be walked
 * back out of it: the distance alone says a word is one letter out, and
 * what is wanted here is *which* letter. Words are words, so the table is
 * small enough that nothing cleverer earns its keep.
 *
 * The walk prefers the diagonal, which is what makes *recieve* read as two
 * letters written the wrong way round rather than as two missing and two
 * too many — the same number of edits, and the first is what happened.
 */
function misses(a: string[], b: string[]): { aBad: boolean[]; bBad: boolean[] } {
  const n = a.length;
  const m = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= n; i++) {
    d[i] = new Array(m + 1).fill(0);
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  const aBad = new Array(n).fill(false);
  const bBad = new Array(m).fill(false);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      /* The same letter in both, or one written in place of another. */
      if (a[i - 1] !== b[j - 1]) {
        aBad[i - 1] = true;
        bBad[j - 1] = true;
      }
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      /* A letter they wrote that the answer has not got. */
      aBad[i - 1] = true;
      i -= 1;
    } else {
      /* A letter of the answer they did not write. */
      bBad[j - 1] = true;
      j -= 1;
    }
  }
  return { aBad, bBad };
}

/*
 * One side, as the stretches a screen can paint.
 *
 * Walked over the original string and not over the letters, because every
 * character has to come back out — a word drawn without its harakat, or
 * without the space in the middle of it, is not the word the learner
 * wrote. A character that is not a letter takes the mark of the letter it
 * follows, which is what puts a fatha on the wrong letter inside the same
 * highlight rather than in a gap of its own; a space takes no mark,
 * because the run either side of it is a different word.
 */
function runsOf(s: string, at: number[], bad: boolean[]): Run[] {
  const mark = new Map<number, boolean>();
  at.forEach((where, k) => mark.set(where, !!bad[k]));
  const out: Run[] = [];
  let last = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let wrong: boolean;
    if (mark.has(i)) {
      wrong = !!mark.get(i);
      last = wrong;
    } else if (/\s/.test(ch)) {
      wrong = false;
      last = false;
    } else {
      wrong = last;
    }
    const tail = out[out.length - 1];
    if (tail && !!tail.wrong === wrong) tail.text += ch;
    else out.push(wrong ? { text: ch, wrong: true } : { text: ch });
  }
  return out;
}

/** Nothing to line up: one side, whole, and no marks on it. */
const plain = (given: string, expected: string): Spelling => ({
  yours: given ? [{ text: given }] : [],
  theirs: expected ? [{ text: expected }] : [],
  wrong: false,
});

/**
 * What the learner wrote and what they were after, lined up letter by
 * letter.
 *
 * `expected` may be several accepted spellings, in which case the one they
 * came closest to is the one marked against: a card taking two words for
 * *book* should answer "you were reaching for this one, and here is the
 * letter", not hold up whichever spelling the teacher happened to type
 * first. Fewest mistakes wins, and the first of the accepted spellings
 * settles a tie, because it is the one the teacher put first.
 *
 * Comes back with nothing marked where there is nothing to say, which is
 * four cases and each of them matters:
 *
 *   * an empty answer, and a language that declares no fold;
 *   * two spellings that differ in nothing this language counts as a
 *     letter — a right answer marked down for its harakat or its tones,
 *     where the verdict already has a sentence and a highlighted letter
 *     would contradict it;
 *   * and a miss so wide that not one letter of what they wrote belongs
 *     in the answer. That is a word they did not know rather than a word
 *     they misspelt, and painting all of it says nothing "wrong" has not
 *     said already.
 */
export function spellRuns(
  given: string,
  expected: string | string[],
  letter?: Letter | null,
): Spelling {
  const wrote = String(given == null ? "" : given);
  const forms = (Array.isArray(expected) ? expected : [expected])
    .map((f) => String(f == null ? "" : f))
    .filter((f) => f.trim());
  const answer = forms[0] || "";
  if (!letter || !wrote.trim() || !forms.length) return plain(wrote, answer);

  const mine = lettersOf(wrote, letter);
  let best: Spelling | null = null;
  let fewest = Infinity;
  for (const form of forms) {
    const want = lettersOf(form, letter);
    const { aBad, bBad } = misses(mine.keys, want.keys);
    const count =
      aBad.filter(Boolean).length + bBad.filter(Boolean).length;
    if (count >= fewest) continue;
    fewest = count;
    /* Every letter they wrote wrong is not a misspelling to point at —
       see above. Measured on their own side alone, so a word one letter
       short still carries its mark on the answer, which is the only mark
       that case has. */
    const allWrong = mine.keys.length > 0 && aBad.every(Boolean);
    best = {
      yours: runsOf(wrote, mine.at, aBad),
      theirs: runsOf(form, want.at, bBad),
      wrong: count > 0 && !allWrong,
    };
    if (!count) break;
  }
  return best || plain(wrote, answer);
}
