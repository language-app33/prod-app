/*
 * "Keeps its capital letters": which cards are asked, and the cards the
 * app ticked once, by itself, when the tick arrived.
 *
 * A word dropped into a sentence has its English cased the way English is
 * written — a capital at the start, none in the middle (see fitEnglish).
 * Some words English capitalises wherever they stand: Monday, English,
 * TV, I. Until 0.411 the app knew those from a list of words, and missed
 * every one nobody had put on it. The owner had the list taken out and a
 * tick put on the card instead: the teacher says which of their words
 * keep their capitals, in any course and any language. A ticked card's
 * English is left exactly as it was typed, and only raised where it opens
 * a sentence — so "on Monday" stays "on Monday".
 *
 * Which cards are asked, as the owner settled it: a word or phrase — the
 * only kind of card dropped into a sentence — unless it is
 *
 *   - a person or a place, which keeps its capital already, and the
 *     retired Name and Number, which nobody picks for a new card;
 *   - a verb, whose one capital is its *I*, kept by the column it is
 *     typed in rather than by a tick (see SPEAKER_COLUMNS) — and, for the
 *     same reason, the pronoun *I* the Pronouns screen writes;
 *   - a preposition or a demonstrative, which English never capitalises.
 *
 * A word of no subtype yet is asked, like a noun.
 */
import { formsOf } from "./cards.ts";
import { isDialog } from "./dialogs.ts";
import { isSentence, SPEAKER_COLUMNS } from "./variables.ts";

const NOT_ASKED = new Set(["person", "place", "name", "number", "verb", "preposition", "demonstrative"]);

/** Whether a card's subtype is one the tick is offered on, word cards aside. */
export const subtypeTakesCapitals = (category: unknown): boolean =>
  !NOT_ASKED.has(String(category || "").trim().toLowerCase());

/** Whether the card editor offers the tick on this card. */
export function takesCapitals(card: Record<string, any> | null | undefined): boolean {
  if (!card) return false;
  if (isSentence(card) || isDialog(card as any)) return false;
  return subtypeTakesCapitals(card.category);
}

/*
 * The words the old list kept a capital on — frozen here, for the one
 * pass below and nothing else. Nothing reads it to case a sentence.
 */
const ONCE_LISTED = new Set(
  (
    "i i'm i've i'll i'd " +
    "monday tuesday wednesday thursday friday saturday sunday " +
    "january february march april may june july august september october november december " +
    "english arabic hebrew vietnamese french german spanish"
  ).split(" "),
);

/*
 * The card with its tick, where the old list would have kept one of its
 * capitals — or null where there is nothing to change.
 *
 * The owner's answer for the cards written before the tick: tick them
 * once, so nothing that read "on Monday" yesterday reads "on monday"
 * today. A card is ticked where it is offered the tick, has never been
 * given an answer either way, and one of the words of its English — any
 * of its forms, and a pronoun's *I am* and *am I* — is one the list
 * named, typed with its capital. Typed small, the list would have raised
 * it; ticked, it would stay small, so the tick would change nothing and
 * the card is left for the teacher.
 *
 * Runs on the server over a teacher's cards (see liftTags in
 * server/api/courses.js), on a learner's device over the cards it holds
 * (liftItem), and in the editor; the second time, it changes nothing.
 */
export function tickCapitals<T extends Record<string, any>>(card: T | null | undefined): (T & { capitals: true }) | null {
  if (!card || typeof card.capitals === "boolean" || !takesCapitals(card)) return null;
  /* The pronoun *I* the Pronouns screen wrote keeps its capital by its
     column already — see SPEAKER_COLUMNS — and is not offered the tick. */
  if (SPEAKER_COLUMNS.has(String(card.person || ""))) return null;
  const english = [
    ...formsOf(card).map((f: any) => String((f && f.en) || "")),
    String(card.enIs || ""),
    String(card.enAsk || ""),
  ];
  const caught = english.some((line) =>
    (line.match(/[\p{L}\p{M}'’]+/gu) || []).some((word) => {
      const bare = word.toLowerCase().replace(/’/g, "'");
      return ONCE_LISTED.has(bare) && word[0] !== word[0].toLowerCase();
    }),
  );
  return caught ? { ...card, capitals: true } : null;
}
