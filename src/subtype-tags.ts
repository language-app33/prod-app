/*
 * A custom tag that is also a subtype, folded into the subtype.
 *
 * A card fills `{{noun}}` by being a noun and `{{word}}` by being a word —
 * fillsOf adds both from the card itself. So a custom tag called `noun`
 * was a second way of saying the same thing, and the editor showed it
 * twice: once under Default tags and again under Custom tags, where it
 * could be unticked while the default one went on filling the blank.
 * They got there honestly — a tag named `name` before the language
 * declared Name as a kind of word — and this is what tidies them away.
 *
 * The rule, as the owner settled it:
 *
 *   - a card with no subtype takes the one its tag names, and the tag goes;
 *   - a card already of that subtype just loses the tag;
 *   - a card of a *different* subtype keeps its subtype, and the tag goes —
 *     so it stops filling that blank. The subtype is what the card is; a
 *     tag contradicting it is the one to lose.
 *
 * `{{word}}` is the same case: it is filled by being a single word, and a
 * custom tag of that name is taken off without setting anything.
 *
 * A sentence fills nothing and is left alone, as is a card whose language
 * is not known here. Returns the card as it should be stored, or null
 * where there is nothing to change — so a caller can write only what
 * moved, and running it twice changes nothing the second time.
 *
 * Written once, here, because it runs in three places: on the server over
 * a teacher's cards (see liftTags in server/api/courses.js), on a
 * learner's device over the cards it holds (liftItem), and in the tests.
 */
import { categoriesOf, LANGUAGES } from "./languages.ts";
import { fillNames, isSentence, WORD_SLOT } from "./variables.ts";
import type { Lang } from "./types.ts";

/** A card as the lift leaves it: it always says its subtype, even "". */
export type Lifted<T> = T & { category: string; fills?: string[] };

export function liftSubtypeTags<T extends Record<string, any>>(
  card: T | null | undefined,
  lang: Lang | null | undefined,
): Lifted<T> | null {
  if (!card || !lang || isSentence(card)) return null;
  const kinds = categoriesOf(lang).map((c) => String(c.id).toLowerCase());
  const fills = fillNames(card);
  const clash = fills.filter((n) => n === WORD_SLOT || kinds.includes(n));
  if (!clash.length) return null;
  const rest = fills.filter((n) => !clash.includes(n));
  const said = String(card.category || "");
  /* The first of them in the order the language asks its kinds, where
     there is more than one and nothing has been said: the same order the
     subtype question offers them in. */
  const category = said || kinds.find((k) => clash.includes(k)) || "";
  return {
    ...card,
    /* Absent rather than empty, which is what `fills` has always been on
       a card that fills nothing — see save-card on the server. */
    fills: rest.length ? rest : undefined,
    category,
  };
}

/** The same, for a card that carries only its language's id. */
export const liftSubtypeTagsIn = <T extends Record<string, any>>(
  card: T | null | undefined,
  langId: string | null | undefined,
): Lifted<T> | null => liftSubtypeTags(card, (LANGUAGES as Record<string, Lang>)[String(langId || "")] || null);
