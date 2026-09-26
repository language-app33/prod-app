/*
 * Which languages are in play, for somebody who has more than one.
 *
 * Both spaces carry the same switch: Learning over the cards this person
 * studies, Teaching over the courses, decks and cards they write. What is
 * stored is the languages switched *off* — see `langsOff` in the app's
 * default settings for why that way round — and each space keeps its own
 * list, because narrowing what you teach is not narrowing what you learn.
 *
 * Nothing here knows about React or a screen. The spaces work out which
 * language each of their things is in; this says what that adds up to.
 */
import type { LangId } from "./types.ts";

/** One row of the switch: a language, and how much of it there is. */
export type LangChoice = { id: LangId; name: string; ready: number; total: number };

/*
 * The languages switched off, as the rest of a space should read it rather
 * than as it happens to be stored.
 *
 * Two things are cleaned up here so that nothing downstream has to think
 * about them. A language switched off and since gone — the last card in
 * it deleted, a course left — is dropped, so it cannot come back from the
 * dead and hide a language that reuses its id. And switching off every
 * language at once is not a state the app has: it would be an empty space
 * with no clue why, so it reads as none of them switched off. The switch
 * will not let you do it either; this is the belt to that pair of braces.
 */
export function langsOffAmong(stored: unknown, choices: { id: LangId }[]): LangId[] {
  const has = new Set(choices.map((c) => c.id));
  const off = (Array.isArray(stored) ? stored : []).filter(
    (id): id is LangId => typeof id === "string" && has.has(id)
  );
  return off.length >= choices.length ? [] : off;
}

/*
 * The switch's rows for somebody teaching: every language their courses,
 * decks and cards are in, each with how many cards it holds.
 *
 * A language a course teaches is a row even before it has a card, so a
 * teacher with a new course can narrow to it and start writing. `ready`
 * is nought throughout: nothing in Teaching is due, and the switch only
 * mentions it where there is some.
 *
 * Only ids `known` holds are offered — a course naming a language this
 * build has no pack for is not something the switch can say anything
 * about — and the order is the one the teacher's courses list them in,
 * then whatever only the decks or cards brought.
 */
export function teachingChoices(
  courseLangs: (LangId | undefined)[],
  itemLangs: (LangId | undefined)[],
  cardLangs: (LangId | undefined)[],
  known: Record<LangId, { name?: string } | undefined>,
): LangChoice[] {
  const totals: Map<LangId, number> = new Map();
  const note = (id: LangId | undefined, n: number) => {
    if (!id || !known[id]) return;
    totals.set(id, (totals.get(id) || 0) + n);
  };
  for (const id of courseLangs) note(id, 0);
  for (const id of itemLangs) note(id, 0);
  for (const id of cardLangs) note(id, 1);
  return [...totals.entries()].map(([id, total]) => ({
    id,
    name: (known[id] || {}).name || id,
    ready: 0,
    total,
  }));
}

/* Whether a thing in `id` is shown with `off` switched off. A thing that
   cannot say which language it is in stays: hiding it would lose it, with
   nothing on the screen to say where it went. */
export const inPlayWith = (off: LangId[], id: LangId | undefined | null): boolean =>
  !id || !off.includes(id);
