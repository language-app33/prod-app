/*
 * The session layout: how a session's cards become its questions.
 *
 * The session mix (session-mix.ts) decides which cards a sitting
 * practises. This file decides the rest of what a sitting looks like —
 * how long it is, how much of each card it asks, and the order the
 * questions come in. Building any one question (which phrase, which
 * number, which grid partners) stays with the questions themselves, in
 * the app; this is only the shape around them.
 *
 * In the owner's words:
 *
 * - **Length.** 20 questions, or 6 a minute when timed. A matching grid
 *   counts as one screen. A short session asks each card again, up to four
 *   times, with other questions in between.
 * - **Per card.** Each form asked two ways; at most two forms of a card per
 *   session; at most two lines of a conversation per session.
 * - **Per session.** At least two kinds of question.
 * - **Order.** Easiest first, with the three shares mixed within each step;
 *   never the same card twice in a row; no more than two cards of the same
 *   kind in a row (word, sentence, number), where difficulty allows; a
 *   missed question comes back later, never straight after.
 */
import type { Question } from "./types.ts";
import { inOrder } from "./scheduler.ts";

/* How long a session runs, in screens. Long enough to be worth opening,
   short enough to finish on a bus — and twenty, the owner's number, is ten
   cards at two questions each, which the mix's shares divide exactly. */
export const SESSION_SIZE = 20;

/*
 * How many ways one form is drilled in a sitting.
 *
 * Two, not three. A form is asked in its own right on every one of these,
 * so the third asking cost a whole other card its place in the session —
 * and a third angle on a word you met ninety seconds ago teaches less than
 * a first angle on a word you have not seen today.
 */
export const PER_UNIT = 2;

/*
 * How many forms of one card a session will take.
 *
 * Two. A verb lays out twenty-odd cells and a word with pronouns on it a
 * dozen, all of them forms of one word; at four a session of verbs was two
 * words and eighteen questions about them. At two, the cells still each get
 * their turn — they are scheduled in their own right and come round on
 * their own — but no single word can be half an evening.
 */
export const MAX_UNITS_PER_FAMILY = 2;

/*
 * The most times one form is asked in one session, when the session has
 * nothing else to ask. Two is the rule (PER_UNIT); four is a beginner with
 * only their first new cards to practise, asked each of them a second round
 * rather than handed a session half the length they chose.
 */
export const MAX_ASKS_PER_UNIT = 4;

/* And of a conversation, in one sitting. Deliberate rather than
   discovered: without it a six-line scene is the whole session. */
export const MAX_DIALOG_LINES = 2;

/* How many questions a timed session is given to work through: about one
   every ten seconds. */
export const TIMED_PER_MINUTE = 6;

/*
 * Where a queue reaches a session's length, which is counted in screens:
 * a grid is one screen however many words are in it, so a session of
 * twenty shows twenty on its counter.
 */
export function cutAtLength(queue: unknown[], length: number): number {
  return Math.min(queue.length, length);
}

/* Every card a question is about: its own, and in a grid every word
   standing in it too, since each of those is asked there as well. */
export function cardsIn(q: Question): string[] {
  return q.mates ? [q.id, ...q.mates.map((m) => m.id)] : [q.id];
}

/* May `b` be asked straight after `a`? Not about any card `a` was about,
   and not the same exercise. */
export function mayFollow(a: Question | null | undefined, b: Question | null | undefined): boolean {
  if (!a || !b) return true;
  if (a.type === b.type) return false;
  const was = cardsIn(a);
  return !cardsIn(b).some((id) => was.includes(id));
}

/*
 * The rules for the order of a session: no two questions running about the
 * same card, no two running of the same exercise, and — where `kindOf` is
 * given — no three running about the same kind of card.
 *
 * The whole order is planned, not dealt greedily: a greedy pass spends the
 * other cards early and leaves whatever card has the most questions piled
 * at the end, where they can only stand next to each other. So a search
 * tries the queue's own order first (easiest first, a card the learner
 * asked for ahead of all of it) and turns aside only where following it
 * would leave the rest with no way to be kept apart. `prev` is a question
 * already asked, for when only the tail of a session is being put in order.
 *
 * The kind rule gives way first: where it cannot be kept with the others,
 * the order is searched again without it. Where the material cannot keep
 * even the first two — one card and nothing else — the search gives up on
 * a budget and a greedy pass deals it, bending as little as it can, the
 * card first: a question is never dropped to keep a rule.
 */
export function varyTypes(
  list: Question[],
  prev: Question | null = null,
  kindOf?: (q: Question) => string,
): Question[] {
  const n = list.length;
  if (n < 2 && !prev) return list.slice();

  const planned = (byKind: boolean): Question[] | null => {
    /* How many of each card and each exercise are left, for the pruning: a
       kind that holds more than half of what is left, rounded up, cannot be
       kept apart — and none of it may come first after one of its own. */
    const cardLeft: Map<string, number> = new Map();
    const typeLeft: Map<string, number> = new Map();
    const bump = (m: Map<string, number>, k: string, by: number) => m.set(k, (m.get(k) || 0) + by);
    for (const q of list) {
      bump(cardLeft, q.id, 1);
      bump(typeLeft, q.type, 1);
    }
    const fits = (left: number, last: Question | null) => {
      for (const [k, c] of cardLeft) {
        if (c > Math.ceil(left / 2)) return false;
        if (last && c > Math.floor(left / 2) && cardsIn(last).includes(k)) return false;
      }
      for (const [k, c] of typeLeft) {
        if (c > Math.ceil(left / 2)) return false;
        if (last && c > Math.floor(left / 2) && last.type === k) return false;
      }
      return true;
    };
    /* A third of one kind running — the two before it, already placed. */
    const third = (q: Question) => {
      if (!byKind || !kindOf) return false;
      const k = kindOf(q);
      const tail = out.length >= 2 ? out.slice(-2) : prev ? [prev, ...out].slice(-2) : [];
      return tail.length === 2 && tail.every((x) => kindOf(x) === k);
    };

    const used = new Array(n).fill(false);
    const out: Question[] = [];
    let budget = 200 * n + 1000;
    const search = (last: Question | null): boolean => {
      if (out.length === n) return true;
      if (budget-- <= 0) return false;
      for (let i = 0; i < n; i++) {
        if (used[i] || !mayFollow(last, list[i]) || third(list[i])) continue;
        const q = list[i];
        used[i] = true;
        out.push(q);
        bump(cardLeft, q.id, -1);
        bump(typeLeft, q.type, -1);
        if (fits(n - out.length, q) && search(q)) return true;
        bump(cardLeft, q.id, 1);
        bump(typeLeft, q.type, 1);
        out.pop();
        used[i] = false;
        if (budget <= 0) return false;
      }
      return false;
    };
    return fits(n, prev) && search(prev) ? out : null;
  };
  const clean = (kindOf && planned(true)) || planned(false);
  if (clean) return clean;

  /* No clean order, or none found in time. */
  const dealt: Question[] = [];
  const rest = list.slice();
  let last = prev;
  const sameCard = (a: Question | null, b: Question) => !!a && cardsIn(b).some((id) => cardsIn(a).includes(id));
  while (rest.length) {
    let pick = rest.findIndex((e) => mayFollow(last, e));
    if (pick === -1) pick = rest.findIndex((e) => !sameCard(last, e));
    if (pick === -1) pick = rest.findIndex((e) => !last || e.type !== last.type);
    if (pick === -1) pick = 0;
    const [e] = rest.splice(pick, 1);
    dealt.push(e);
    last = e;
  }
  return dealt;
}

/*
 * A question answered wrong, put back into what is left of the session.
 *
 * It is the same question deliberately — the point of asking again is to
 * test the thing that failed, not to change the subject. And it goes to the
 * back of the queue, which gives it a gap the size of whatever is left: a
 * long session re-asks it in fifteen questions' time, a short one in three,
 * and both are a retest rather than a copy of an answer still on the
 * screen. Backed up over any neighbour about the same card, so missing a
 * card's two questions does not put its two retries side by side.
 *
 * `from` is the first question not yet answered; everything before it is
 * done and is never moved. With nothing left after it the retry is the very
 * next question, which is the one case this cannot improve on — dropping it
 * instead would end a session of one question the moment it was got wrong,
 * having taught nothing. Standing next to itself is only a fault while
 * there is something to stand between.
 */
export function requeueMissed(list: Question[], from: number, ex: Question): Question[] {
  const put = (at: number) => list.slice(0, at).concat([{ ...ex }], list.slice(at));
  /* The back of the queue, then forward off any neighbour it may not stand
     beside — about the same card, or the same exercise — on both sides.
     Never as far as `from`: the question there is the miss itself, still on
     the screen. The exercise is the rule that gives way first. */
  const clean = (at: number) => mayFollow(list[at - 1], ex) && mayFollow(ex, list[at]);
  const apart = (at: number) =>
    [list[at - 1], list[at]].every((q) => !q || !cardsIn(q).some((id) => cardsIn(ex).includes(id)));
  for (const ok of [clean, apart]) {
    for (let at = list.length; at > from; at -= 1) if (ok(at)) return put(at);
  }
  return put(list.length);
}

/** What the layout needs to know of one form's plan. */
export interface LayoutPlan {
  /** The exercises this form is asked, in the order they come. */
  types: string[];
  /** What else it has open, for a session the cards cannot fill. */
  more: string[];
  /** A number skill, never asked the same exercise twice: its number is
      drawn once, and the second asking would be the same number. */
  range: boolean;
}

/**
 * A session's questions, from its cards in the mix's order.
 *
 * Card by card until the questions reach the length — and never fewer
 * cards than the learner asked for, which the mix puts first. The cards
 * taken are then put easiest first, chance between equals, which is what
 * mixes the shares within each step. When every card it may take is taken
 * and it is still short, each form is asked more: first whatever else it
 * has open, then the same questions again, up to MAX_ASKS_PER_UNIT, a round
 * at a time so a form asked twice has the session between the two.
 *
 * The length is in screens and a grid is one screen for several
 * questions, so a session the grids left short takes more until the
 * screens reach the length or there is nothing more to add.
 *
 * `deal` turns plans into questions a round at a time; `finish` builds the
 * grids and puts the order (see varyTypes).
 */
export function fillSession<C, P extends LayoutPlan>(o: {
  cards: C[];
  budget: number;
  askedFor: number;
  plansOf: (c: C) => P[];
  rankOf: (c: C) => number;
  deal: (plans: P[]) => Question[];
  finish: (dealt: Question[]) => Question[];
  /** Ask each form more when the cards run out before the length. Off for
      a session that asks everything once and has no length to reach. */
  topUp?: boolean;
}): { taken: C[]; plans: P[]; questions: Question[] } {
  const { cards, budget, askedFor } = o;
  const planned = new Map<C, P[]>();
  const plansOf = (c: C) => {
    if (!planned.has(c)) planned.set(c, o.plansOf(c));
    return planned.get(c) as P[];
  };
  const asks = (list: P[]) => list.reduce((n, p) => n + p.types.length, 0);

  let taken = 0;
  let count = 0;
  let warmed: C[] = [];
  let plans: P[] = [];
  let dealt: Question[] = [];
  const take = () => {
    count += asks(plansOf(cards[taken]));
    taken += 1;
    warmed = inOrder(cards.slice(0, taken), o.rankOf);
    plans = warmed.flatMap(plansOf);
    dealt = o.deal(plans);
  };
  const fill = (target: number) => {
    while (taken < cards.length && (taken < Math.max(1, askedFor) || count < target)) {
      count += asks(plansOf(cards[taken]));
      taken += 1;
    }
    warmed = inOrder(cards.slice(0, taken), o.rankOf);
    plans = warmed.flatMap(plansOf);
    dealt = o.deal(plans);
    /* A question can still fall out as it is dealt — a number nobody can
       be asked yet — so a session short of its target takes the next card
       while there is one. */
    while (dealt.length < target && taken < cards.length) take();
    let grown = o.topUp !== false;
    while (dealt.length < target && grown) {
      grown = false;
      for (const p of plans) {
        if (p.types.length >= MAX_ASKS_PER_UNIT) continue;
        const next = p.more.length
          ? (p.more.shift() as string)
          : p.range
          ? null
          : p.types[p.types.length % Math.max(1, Math.min(p.types.length, PER_UNIT))] || null;
        if (!next) continue;
        p.types.push(next);
        grown = true;
      }
      dealt = o.deal(plans);
    }
  };

  let target = budget;
  fill(target);
  let questions = o.finish(dealt);
  for (let round = 0; round < 8 && questions.length < budget; round += 1) {
    const had = dealt.length;
    target = had + (budget - questions.length);
    fill(target);
    if (dealt.length === had) break;
    questions = o.finish(dealt);
  }
  return { taken: warmed, plans, questions };
}
