/*
 * A card's forms.
 *
 * A card is one word together with the alternates it carries — a plural, a
 * feminine, a cell of a verb's table, a pronoun on the end of one — and
 * every one of those is a thing to learn in its own right: its own
 * wording, its own recordings, its own place on the ladder. So what a card
 * *is*, to nearly everything that reads one, is a list of forms, and the
 * card's own word is the first of them.
 *
 * That is not how it is stored. The first form is the card itself and the
 * rest live in `subs`, which is two shapes for one kind of thing — and the
 * join between them was written out by hand wherever anybody wanted the
 * list. Forty copies of one idea is forty places to change when it
 * changes, and forty chances for one of them to be subtly different from
 * the rest. They already were: `clipHashes` said `[card, ...subs]`,
 * `unitsOf` pushed the card and then looped, the editor filtered `subs`,
 * and the search boxes asked the card and its subs in two different
 * shapes. All of them mean *the forms of this card*.
 *
 * So: one door. Everything that walks a card's forms comes through here,
 * and the day the stored shape becomes what the readers already believe —
 * one list, the lead form first — this is the file that changes.
 *
 * **A conversation's turns are not forms.** They are drilled like forms
 * and the scheduler walks them beside forms, but a turn belongs to a scene
 * rather than being another way of saying the word, and only `linesOf` in
 * dialogs.ts hands them out. Nothing here returns one.
 *
 * A module of its own, importing nothing, for the reason verbs.ts and
 * variables.ts are: it says what a card is made of, so it is somewhere a
 * test can reach and somewhere nothing can reach back into.
 */
import type { Form } from "./types.ts";

/*
 * Everything below takes `unknown` and narrows it here, as verbs.ts does
 * and for the same reason: the same question is asked of a stored card, of
 * an item on a device, of a draft in an editor and of a card on its way to
 * the server — four types that agree about nothing a compiler can see. A
 * value that is not what it should be reads as having no forms rather than
 * throwing, because a card is somebody's work and half of it read is worth
 * more to them than an exception.
 */
const subsOf = (card: unknown): Form[] => {
  const subs =
    card && typeof card === "object" ? (card as Record<string, unknown>).subs : undefined;
  return Array.isArray(subs) ? (subs as Form[]) : [];
};

/**
 * Every form of a card, the card's own word first.
 *
 * The lead is the card itself: it carries the wording, the recordings and
 * the schedule a form carries, plus the facts that belong to the card as a
 * whole — which decks it is in, where it came from — and a reader walking
 * forms simply does not ask about those. Nothing at all comes back for
 * nothing at all, so a card withdrawn while somebody was looking at it is
 * an empty list rather than a crash.
 */
export function formsOf(card: unknown): Form[] {
  if (!card || typeof card !== "object") return [];
  return [card as Form, ...subsOf(card)];
}

/**
 * The forms after the lead — the alternates a card carries.
 *
 * The question the editor asks (these get a block each, the card's own
 * word has the one above), and the one the save path and the merge ask
 * (these travel as `subs`). Where a caller means *all* of them, it wants
 * formsOf.
 */
export const subFormsOf = (card: unknown): Form[] => subsOf(card);
