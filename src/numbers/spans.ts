/*
 * A number blank that covers more than one stretch.
 *
 * A teacher picks number blanks by ticking stretches — 0 to 9, 10 to 19,
 * 20 to 99 and so on — and a sentence that should be met with anything
 * from nought to ninety-nine is the first three ticked. That is one blank,
 * and it is written as one name: `{{0-99}}`, from the first stretch's
 * bottom to the last one's top, or `-plus` where the last is the open one
 * at the top. All of them is the general tag there always was, `{{number}}`;
 * one is that stretch's own tag, as before. Counting things is the same
 * with `count-` in front.
 *
 * Only stretches that touch. A blank is one unbroken run of the number
 * line, which is what lets its name be read as one — `0-9 and 100-999`
 * is not a name a teacher should have to parse — and the editor keeps the
 * ticks together.
 *
 * Nothing is written on the fillers for it. A filler says which stretch it
 * is from, and fillsOf adds the runs that stretch is inside — so a card
 * carries no more names than it did, and a run nobody has written costs
 * nothing.
 *
 * And each stretch comes up as often as the others: see `mixed`. A blank
 * of 0 to 99 drawn by the number would be 20 to 99 eight times in ten,
 * which is a beginner's sentence asking almost nothing a beginner knows.
 */
import { NUMBER_RANGES, stretchTag } from "./types.ts";

/** A run of stretches, by their place in NUMBER_RANGES, ends included. */
export interface Span {
  counted: boolean;
  from: number;
  to: number;
}

const LAST = NUMBER_RANGES.length - 1;

/** A stretch's own tag — the same rule partTags writes it by. */
const own = (i: number) => stretchTag(NUMBER_RANGES[i].id);

/** The name a run of stretches is written as. */
export function spanTag(span: Span): string {
  const { counted, from, to } = span;
  if (from === 0 && to === LAST) return counted ? "count" : "number";
  const bare = from === to
    ? own(from)
    : `${NUMBER_RANGES[from].from}-${to === LAST ? "plus" : NUMBER_RANGES[to].to}`;
  return counted ? `count-${bare}` : bare;
}

/* Every run there is, by name: twenty-one of each kind, so a table rather
   than a parser. */
const BY_NAME = new Map<string, Span>();
for (const counted of [false, true]) {
  for (let from = 0; from <= LAST; from++) {
    for (let to = from; to <= LAST; to++) BY_NAME.set(spanTag({ counted, from, to }), { counted, from, to });
  }
}

/*
 * And the names the stretches had before they were these, read as the
 * run that holds them — so a sentence written with one opens on the ticks
 * it stands for when the teacher taps it. 11 to 99 is the teens and the
 * tens together; the old counting parts are the stretch most of them went
 * into. See MERGED_INTO.
 */
const OLD: Record<string, Span> = {
  "0-10": { counted: false, from: 0, to: 0 },
  "11-99": { counted: false, from: 1, to: 2 },
  "count-1-2": { counted: true, from: 0, to: 0 },
  "count-3-10": { counted: true, from: 0, to: 0 },
  "count-11-20": { counted: true, from: 1, to: 1 },
};

/** The run a blank's name stands for, or null where it is not a number blank. */
export function readSpan(name: string): Span | null {
  return BY_NAME.get(name) || OLD[name] || null;
}

/**
 * The runs of more than one stretch, short of all of them, that a stretch's
 * own tag is inside — what a filler from that stretch also answers to.
 * Nothing for any other name.
 */
export function spansThrough(name: string): string[] {
  const span = BY_NAME.get(name);
  if (!span || span.from !== span.to) return [];
  const at = span.from;
  const out: string[] = [];
  for (let from = 0; from <= at; from++) {
    for (let to = at; to <= LAST; to++) {
      if (from === to || (from === 0 && to === LAST)) continue;
      out.push(spanTag({ counted: span.counted, from, to }));
    }
  }
  return out;
}

/* Which stretch a filler is from, off its id — see fillerId, which writes
   the stretch's id into it. -1 for anything else. */
const FILLER = /:fill:(numbers:[^:]+):/;
function stretchOf(value: { id?: string }): number {
  const m = FILLER.exec(String((value && value.id) || ""));
  return m ? NUMBER_RANGES.findIndex((r) => r.id === m[1]) : -1;
}

const MIXED = new WeakMap<object, Map<string, unknown[]>>();

/**
 * A blank's values with its stretches taken in turn — one from 0 to 9, one
 * from 10 to 19, one from 20 to 99, and round again — so each comes up as
 * often as the others, and early on, rather than all of the first before
 * any of the next.
 *
 * The same list back for any blank that is not a run of several, and for
 * the same list the same order every time, which is what keeps one count
 * the same sentence. Kept per list, since the walk asks it once a turn.
 */
export function mixed<T extends { id?: string }>(slot: string, list: T[]): T[] {
  const span = readSpan(slot);
  if (!span || span.from === span.to || !list || list.length < 2) return list;
  let seen = MIXED.get(list);
  if (!seen) MIXED.set(list, (seen = new Map()));
  const had = seen.get(slot);
  if (had) return had as T[];
  const piles = new Map<number, T[]>();
  for (const value of list) {
    const at = stretchOf(value);
    piles.set(at, (piles.get(at) || []).concat([value]));
  }
  const order = [...piles.keys()].sort((a, b) => a - b);
  const out: T[] = [];
  for (let i = 0; out.length < list.length; i++) {
    for (const at of order) {
      const pile = piles.get(at) || [];
      if (i < pile.length) out.push(pile[i]);
    }
  }
  seen.set(slot, out);
  return out;
}
