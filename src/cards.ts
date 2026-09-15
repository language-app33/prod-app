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
const listOf = (card: unknown, field: string): Form[] => {
  const list =
    card && typeof card === "object" ? (card as Record<string, unknown>)[field] : undefined;
  return Array.isArray(list) ? (list as Form[]) : [];
};

/**
 * Every form of a card, the card's own word first.
 *
 * One list, and the card's own word is the first entry of it. A card
 * written before that — every card stored until 0.138 — is a word with its
 * alternates in `subs` beside it, and is read here as the list it always
 * meant: the card, then those. Nothing else in the app knows there were
 * ever two shapes.
 *
 * Nothing at all comes back for nothing at all, so a card withdrawn while
 * somebody was looking at it is an empty list rather than a crash.
 */
export function formsOf(card: unknown): Form[] {
  if (!card || typeof card !== "object") return [];
  const forms = listOf(card, "forms");
  if (forms.length) return forms;
  /* The old shape, lifted where it is met: on a stored document, on a
     card from a course, on anything a device synced from a build that
     had not caught up yet. */
  return [card as Form, ...listOf(card, "subs")];
}

/**
 * The card's own word — the first of its forms.
 *
 * What a list shows, what a search matches, what a sentence borrows, and
 * what the card is saved as. Every reader that wants *the card as a word*
 * rather than the card as a whole asks this, which is what let the answer
 * move: while a card was stored as a word with a list of alternates beside
 * it, the lead was the card itself; it is the first entry of one list now,
 * and nothing that reads it had to be told.
 *
 * A blank form for a card that has none, so a reader can take its word
 * without a guard. There is no such card in practice — a card with no
 * words is a card with nothing on it — but a half-written draft and a
 * withdrawn card both reach here.
 */
export function leadOf(card: unknown): Form {
  return formsOf(card)[0] || ({ id: "", ar: "", en: "", lat: "" } as Form);
}

/**
 * The same card, with a different word in front.
 *
 * A question is asked of a form, and the form is cast before it is shown —
 * a hole filled with a name, one meaning picked out of two, one spelling
 * narrowed to. Where the question is about the card's own word, whatever
 * reads the card afterwards has to see the word as it was asked, not as it
 * is stored. This is that card.
 *
 * The alternates come along unchanged: casting one word is not a change to
 * the others.
 */
export const withLead = <T>(card: T, lead: Form): T =>
  ({ ...(card as object), forms: [lead, ...subFormsOf(card)] }) as T;

/**
 * The forms after the lead — the alternates a card carries.
 *
 * The question the editor asks (these get a block each, the card's own
 * word has the one above) and the one the merge asks. Where a caller means
 * *all* of them, it wants formsOf.
 */
export const subFormsOf = (card: unknown): Form[] => formsOf(card).slice(1);
