/*
 * Work that could not be sent yet.
 *
 * The app tells a learner that anything they do while disconnected is kept
 * and sent when a connection returns. That was true of what they learn —
 * the document, its schedules, its settings — and false of everything
 * else. A problem reported about a card was tried once and dropped on the
 * floor; a card a teacher had just written was lost with the connection
 * that failed to carry it.
 *
 * This is the small durable queue that makes the promise true, and it is
 * deliberately one queue rather than two: a second copy of "keep it, try
 * again later" is a second set of bugs about when to stop trying.
 *
 * What it is not: a general replay of everything the app does. Only work
 * that never reached the server goes in here. A request the server
 * answered — even to refuse — has been decided, and asking again would
 * either change nothing or do it twice. `drainOutbox` is handed that
 * judgement by its caller rather than making it, because only the caller
 * knows what its own errors mean.
 *
 * The core is pure so it can be tested without a browser; the three
 * functions at the foot are the only ones that touch storage.
 */

export interface Pending {
  /** This device's own name for the item, never sent anywhere. */
  id: string;
  /** What kind of work it is, so one drain does not send another's. */
  kind: string;
  /** When it was first kept, for ageing it out. */
  at: number;
  /** Whatever the sender needs, as it will be sent. */
  body: unknown;
}

/*
 * How much is kept, and for how long.
 *
 * A cap because storage is small and shared with the document itself, and
 * an age because something that has not gone up in a fortnight is not
 * going to: the account was closed, the card was deleted, the deploy moved
 * on. Both are per kind, so a teacher's unsent cards cannot be pushed out
 * by a run of reported problems.
 */
export const OUTBOX_CAP = 50;
export const OUTBOX_DAYS = 14;

/** Everything waiting of one kind, oldest first, which is the order to send. */
export function pendingOf(list: Pending[], kind: string): Pending[] {
  return (list || []).filter((p) => p && p.kind === kind).sort((a, b) => a.at - b.at);
}

/*
 * Add one, and hold the cap.
 *
 * The oldest of that kind goes when the cap is reached, not the newest:
 * what someone just wrote is the thing they still remember writing, and
 * dropping it is the loss they would notice.
 */
export function withKept(
  list: Pending[],
  kind: string,
  body: unknown,
  at: number,
  id: string,
): Pending[] {
  const mine = pendingOf(list, kind).concat([{ id, kind, at, body }]);
  const over = Math.max(0, mine.length - OUTBOX_CAP);
  const kept = new Set(mine.slice(over).map((p) => p.id));
  return (list || []).filter((p) => p.kind !== kind || kept.has(p.id)).concat(
    kept.has(id) ? [{ id, kind, at, body }] : [],
  );
}

export function without(list: Pending[], id: string): Pending[] {
  return (list || []).filter((p) => p.id !== id);
}

/** Drop anything too old to be worth sending. */
export function fresh(list: Pending[], now: number, days: number = OUTBOX_DAYS): Pending[] {
  const cutoff = now - days * 86400000;
  return (list || []).filter((p) => (p.at || 0) >= cutoff);
}

/*
 * What the sender made of one item.
 *
 * "sent" is done with. "keep" is the connection, so the drain stops there
 * and everything behind it waits its turn — sending the rest would be the
 * same failure repeated. "drop" is the server having decided: the card no
 * longer exists, the account is gone, the report was malformed. Asking
 * again would only be told the same thing.
 */
export type Verdict = "sent" | "keep" | "drop";

/* ---------------- storage ---------------- */

const OUTBOX_KEY = "arabic-trainer:outbox";

/*
 * Read through `globalThis` rather than as a bare name so that a test can
 * put a stub there, and so a runtime without storage at all — a private
 * window with it switched off — answers "nothing waiting" instead of
 * throwing on the way past.
 */
function store(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s || null;
  } catch (e) {
    return null;
  }
}

export function loadOutbox(): Pending[] {
  try {
    const raw = store()?.getItem(OUTBOX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.id && p.kind) : [];
  } catch (e) {
    return [];
  }
}

export function saveOutbox(list: Pending[]): void {
  try {
    store()?.setItem(OUTBOX_KEY, JSON.stringify(list || []));
  } catch (e) {
    /* Storage full or blocked. The work is still in memory for this
       session, and the caller has already been told its save failed. */
  }
}

/** Keep one piece of work, and say what it was filed as. */
export function keep(kind: string, body: unknown, at: number = Date.now()): Pending {
  const id = `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  saveOutbox(withKept(fresh(loadOutbox(), at), kind, body, at, id));
  return { id, kind, at, body };
}

export function drop(id: string): void {
  saveOutbox(without(loadOutbox(), id));
}

/** How much of one kind is waiting, for anything that wants to say so. */
export function waiting(kind: string): number {
  return pendingOf(loadOutbox(), kind).length;
}

/**
 * Send what is waiting, oldest first, and keep the store level with what
 * went. One at a time on purpose: these are rare, and a queue that has
 * been waiting for a connection should test it with one request rather
 * than fifty.
 */
export async function drainOutbox(
  kind: string,
  send: (body: unknown) => Promise<Verdict>,
): Promise<{ sent: number; left: number }> {
  let sent = 0;
  for (const item of pendingOf(fresh(loadOutbox(), Date.now()), kind)) {
    let verdict: Verdict;
    try {
      verdict = await send(item.body);
    } catch (e) {
      /* A sender that threw rather than answering is the connection as far
         as this is concerned: stop, and try the lot again next time. */
      break;
    }
    if (verdict === "keep") break;
    drop(item.id);
    if (verdict === "sent") sent += 1;
  }
  return { sent, left: waiting(kind) };
}
