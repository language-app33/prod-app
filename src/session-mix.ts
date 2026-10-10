/*
 * The session mix: which cards a session practises.
 *
 * One rule for every session, wherever it is started. This file decides
 * *which* cards go into a sitting and in what priority; how many questions
 * each card is then asked, and in what order, is the layout's business
 * (session-layout.ts). A different learning mode would be another file
 * shaped like this one.
 *
 * In the owner's words, the whole of it:
 *
 * - **The pool** is the cards a session may draw from: all the learner's
 *   cards for a regular session, the prep's decks for a prep, the cards
 *   picked for a custom session, narrowed by its mode.
 * - **Three shares.** 40% cards in learning, 30% Cleared cards due for
 *   review, 30% Learnt cards due for review.
 * - **Empty places** go, in this order, to overdue Cleared cards, overdue
 *   Learnt cards, cards in learning, then cards not yet due.
 * - **Cards practised in the last three hours are left out**, unless a
 *   review on them was already overdue. They come last, so that a pool with
 *   nothing else in it still gives a session rather than an empty screen.
 * - **New cards** come in only to fill a gap in the learning share: never
 *   more than 20 cards in learning, and none while overdue reviews add up
 *   to more than three days' practice ("catching up first").
 * - **A card the learner asks for by name** always gets in, on top of the
 *   shares.
 * - **A digit card** comes in with its word and shares its place.
 *
 * The numbers were measured with a learner who forgets, in the pace
 * simulation (tests/pace.test.mjs), before they were chosen: at 40/30/30 a
 * typical learner meets as many cards as before and a struggling one keeps
 * about a third more. See DECISIONS.md, "The session mix".
 *
 * Nothing here reads the clock, the cards' schedules or the app: the caller
 * says where each card stands, and this decides. That is what lets the
 * simulation run the very rule the app runs.
 */

/** Where a card stands, as the learner is shown it. */
export type Standing = "new" | "learning" | "cleared" | "learnt";

/** One card of the pool, as the mix needs to know it. */
export interface MixCard<T> {
  card: T;
  id: string;
  standing: Standing;
  /** The soonest any question on it falls due; nought for one never asked. */
  due: number;
  /** When any question on it was last answered; nought for never. */
  lastSeen: number;
  /** Something on it was already due when it was last answered, and still
      is: backlog, which is never left out for being recent. */
  overdue: boolean;
  /** The learner asked for this card by name. */
  askedFor: boolean;
  /** For a digit card: the cards of the words it comes in with. It takes no
      place of its own while it is new. */
  ridesWith?: string[];
}

export const SHARES = { learning: 0.4, cleared: 0.3, learnt: 0.3 } as const;

/** The most cards that may be in learning in a pool at once. */
export const MAX_IN_LEARNING = 20;

/** How long a card practised is left out of the next sessions. */
export const RECENT_GAP = 3 * 60 * 60 * 1000;

/** How many days' practice of overdue reviews pauses new cards. */
export const BEHIND_DAYS = 3;

export interface MixOptions {
  /** How many cards the session has places for. */
  places: number;
  /** The moment the session is built. */
  at: number;
  /** How many cards a typical day of this learner's practice reaches. Never
      read as less than one session's worth. */
  dayCards: number;
}

export interface Mix<T> {
  /** Every card worth dealing, best first: asked-for cards, then the
      shares, then whatever is left to top a short session up with. */
  cards: MixCard<T>[];
  /** How many of the places the shares filled. */
  placed: number;
  /** How many new cards came in. */
  newcomers: number;
  /** Overdue reviews are past what new cards wait for. */
  behind: boolean;
}

const isReview = (c: MixCard<unknown>) => c.standing === "cleared" || c.standing === "learnt";

/** Due now, and so waiting rather than ahead of itself. */
export const dueAt = (c: { due: number }, at: number): boolean => c.due > 0 && c.due <= at;

/** Practised in the last three hours, with nothing on it overdue. */
export const isRecent = (c: { lastSeen: number; overdue: boolean }, at: number): boolean =>
  !!c.lastSeen && at - c.lastSeen < RECENT_GAP && !c.overdue;

/** Not yet met, and not a digit card waiting on its word. */
const isNewcomer = (c: MixCard<unknown>) => c.standing === "new" && !(c.ridesWith && c.ridesWith.length);

/** How many cards a pool holds in learning. */
export function inLearningOf(pool: MixCard<unknown>[]): number {
  return pool.filter((c) => c.standing === "learning" && !(c.ridesWith && c.ridesWith.length)).length;
}

/** Whether overdue reviews have reached the point that pauses new cards. */
export function isBehind(pool: MixCard<unknown>[], o: Pick<MixOptions, "at" | "dayCards" | "places">): boolean {
  const day = Math.max(o.places, o.dayCards || 0);
  return pool.filter((c) => isReview(c) && dueAt(c, o.at)).length > BEHIND_DAYS * day;
}

/** How many new cards the pool has room for today, shares aside. */
export function roomForNew(pool: MixCard<unknown>[], o: Pick<MixOptions, "at" | "dayCards" | "places">): number {
  if (isBehind(pool, o)) return 0;
  return Math.max(0, MAX_IN_LEARNING - inLearningOf(pool));
}

type Group = "learning" | "cleared" | "learnt";
const GROUPS: Group[] = ["learning", "cleared", "learnt"];

/*
 * Where a share's empty place goes: overdue Cleared, overdue Learnt, then
 * cards in learning — new cards included, since that is the one way they
 * come in. Cards not yet due come after all three.
 */
const SPARE: Group[] = ["cleared", "learnt", "learning"];

/**
 * The cards of a session, best first.
 *
 * `pool` is every card the session may draw from, in the order chance put
 * them — new cards in particular are taken in that order.
 */
export function mixSession<T>(pool: MixCard<T>[], o: MixOptions): Mix<T> {
  const { at } = o;
  const places = Math.max(1, Math.round(o.places));
  const behind = isBehind(pool, { ...o, places });
  let room = behind ? 0 : Math.max(0, MAX_IN_LEARNING - inLearningOf(pool));

  const asked = pool.filter((c) => c.askedFor);
  const open = pool.filter((c) => !c.askedFor);
  const ready = open.filter((c) => !isRecent(c, at));
  const byDue = (a: MixCard<T>, b: MixCard<T>) => a.due - b.due;

  /* Cards in learning: the ones waiting first, then the ones seen longest
     ago — so a session reaches round them rather than for the same few. */
  const queues: Record<Group, MixCard<T>[]> = {
    learning: ready
      .filter((c) => c.standing === "learning")
      .sort((a, b) => Number(dueAt(b, at)) - Number(dueAt(a, at)) || a.lastSeen - b.lastSeen),
    cleared: ready.filter((c) => c.standing === "cleared" && dueAt(c, at)).sort(byDue),
    learnt: ready.filter((c) => c.standing === "learnt" && dueAt(c, at)).sort(byDue),
  };
  const fresh = ready.filter(isNewcomer);
  let newcomers = 0;

  const takeFrom = (g: Group): MixCard<T> | null => {
    const q = queues[g];
    if (q.length) return q.shift() as MixCard<T>;
    /* A gap in the learning share is where new cards come in. */
    if (g === "learning" && room > 0 && fresh.length) {
      room -= 1;
      newcomers += 1;
      return fresh.shift() as MixCard<T>;
    }
    return null;
  };

  /* The shares, interleaved: each place goes to whichever group is furthest
     behind its share so far, so a session the layout cuts short of its
     places still holds the mix. */
  const chosen: MixCard<T>[] = [];
  const taken: Record<Group, number> = { learning: 0, cleared: 0, learnt: 0 };
  for (let k = 0; k < places; k += 1) {
    const owed = [...GROUPS].sort(
      (a, b) => SHARES[b] * (k + 1) - taken[b] - (SHARES[a] * (k + 1) - taken[a]),
    );
    const want = owed[0];
    let card = takeFrom(want);
    if (!card) for (const g of SPARE) if (g !== want && (card = takeFrom(g))) break;
    if (!card) break;
    taken[want] += 1;
    chosen.push(card);
  }
  const placed = chosen.length;

  /* Then cards not yet due, nearest first, if the shares left places
     empty; and behind everything else, enough to top a short session up:
     what is left of the groups, and the cards practised in the last three
     hours. No new card comes in this way. */
  const ahead = ready.filter((c) => isReview(c) && !dueAt(c, at)).sort(byDue);
  const recent = open
    .filter((c) => isRecent(c, at) && c.standing !== "new")
    .sort((a, b) => Number(dueAt(b, at)) - Number(dueAt(a, at)) || byDue(a, b) || a.lastSeen - b.lastSeen);
  const rest = [...queues.cleared, ...queues.learnt, ...queues.learning, ...ahead, ...recent];

  /* A digit card comes in with its word and shares its place: right after
     the word where the word is new and comes in now, and at the front with
     what was asked for where the word is already met — it is the word's
     place that let it in, and it takes none of the shares'. */
  const riders = open.filter((c) => c.standing === "new" && c.ridesWith && c.ridesWith.length);
  const metWords = new Set(pool.filter((c) => c.standing !== "new").map((c) => c.id));
  const withRiders = (list: MixCard<T>[]) =>
    list.flatMap((c) => [c, ...riders.filter((r) => (r.ridesWith as string[]).includes(c.id))]);
  const ridingMet = riders.filter((r) => (r.ridesWith as string[]).some((w) => metWords.has(w)));

  const order = [...asked, ...ridingMet, ...withRiders(chosen), ...withRiders(rest)];
  const seen = new Set<string>();
  const cards = order.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  return { cards, placed, newcomers, behind };
}
