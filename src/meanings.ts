/*
 * One card per meaning, and the cards that share a side.
 *
 * A card is one meaning: a word or phrase in the language being learnt,
 * paired with what it means in the language the learner learns from. Two
 * cards can share either side of that pair —
 *
 *   the word      صَبِر = cactus, صَبِر = patience
 *   the meaning   صح = right, يمين = right
 *
 * — and then a question that shows the shared side has two right answers.
 * The card being asked is one of them; the other card is a *sibling*. This
 * module finds them, and says what the question should put under its
 * prompt so the learner knows which one is wanted.
 *
 * **Worked out, never stored.** Nothing on a card says which others it is
 * linked to. Whether two cards collide is a fact about what is written on
 * them, and on the meaning side it is a fact about the language the
 * learner reads the meanings in: *right* collides for an English speaker
 * (صح, يمين) and would not for a French one (juste, droite). A link saved
 * on the card would be wrong for one of them, and would go stale the
 * moment either card was edited. So the cards in play are read afresh.
 *
 * **Only the cards the learner has.** A learner studying the deck with
 * cactus in it and not the one with patience meets صَبِر as *cactus*, with
 * nothing under it: a sibling they have never been taught is not a reason
 * to say anything. The caller decides what "in play" is by what it hands
 * to siblingIndexOf.
 *
 * Pure, like scheduler.ts: what a question shows has to be testable
 * without the app around it.
 */

import type { Form, Item } from "./types.ts";
import { splitAlternatives } from "./answers.ts";
import { normEn, stripInvisible } from "./languages.ts";
import { isAsked, unitsOf } from "./scheduler.ts";
import { slotsOf } from "./variables.ts";

/* Which side of a card a question shows: the word (written, transliterated
   or heard) or what it means. */
export type Side = "word" | "meaning";

/* A form of another card, and the card it belongs to. */
export interface Sibling {
  card: Item;
  unit: Form;
}

export interface SiblingIndex {
  word: Map<string, Sibling[]>;
  meaning: Map<string, Sibling[]>;
}

export const EMPTY_SIBLINGS: SiblingIndex = { word: new Map(), meaning: new Map() };

/*
 * The side a prompt shows, or null where it shows neither on its own.
 *
 * The word in the script, its transliteration and its recording all show
 * the word; the meaning shows the meaning. A picture, a phrase with a gap
 * and a scene each carry their own context, which already says which
 * meaning is wanted, so nothing is added to them.
 */
export function sideOf(promptField: string | null | undefined): Side | null {
  if (promptField === "ar" || promptField === "lat" || promptField === "audio") return "word";
  if (promptField === "en") return "meaning";
  return null;
}

/*
 * What a word reads as, for telling whether two cards show the same one.
 *
 * As it is drawn: case, spacing, invisible marks and the punctuation a
 * teacher may or may not end a word with do not make two words different
 * on screen, and are dropped. Vowel marks and tones are kept, because they
 * do: صَبْر and صَبِر can be told apart by anybody reading them, and so can
 * *ma* and *má*.
 */
export function wordKey(text: string | null | undefined): string {
  return stripInvisible(String(text || ""))
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* And a meaning, the way an answer typed against it is compared: without
   capitals, punctuation, or a leading *the* or *to*. */
export const meaningKey = (text: string | null | undefined): string => normEn(String(text || ""));

/* Each accepted spelling, and each accepted meaning, as keys. A card
   accepting كتاب / سفر shows either of them, so either can collide. */
const wordKeysOf = (unit: Form): string[] =>
  splitAlternatives(unit.ar).map(wordKey).filter(Boolean);
const meaningKeysOf = (unit: Form): string[] =>
  splitAlternatives(unit.en).map(meaningKey).filter(Boolean);

/*
 * Whether a form can be the other half of a collision at all.
 *
 * Asked about, and on a card that is practised in its own right: a value
 * that only ever fills somebody else's blank, or a form the teacher
 * switched off, is never a question and never an answer. Not a form with
 * a hole in it, whose words change with what fills it, and not a turn of
 * a conversation, which is asked inside its scene.
 */
function inPlay(card: Item, unit: Form): boolean {
  if (card.drill === false || !isAsked(unit)) return false;
  if (slotsOf(unit).length) return false;
  if ((card as Item & { lines?: unknown[] }).lines && (card as Item & { lines?: unknown[] }).lines!.length) return false;
  return true;
}

/*
 * Every word and every meaning in play, and which forms carry each.
 *
 * Keyed by language as well, so an Arabic card and a Hebrew card that
 * both mean *right* are not siblings: nobody is asked one in the other's
 * language. `langOf` says what language a card is in, for the cards that
 * do not say so themselves.
 */
export function siblingIndexOf(items: Item[], langOf: (card: Item) => string): SiblingIndex {
  const word: Map<string, Sibling[]> = new Map();
  const meaning: Map<string, Sibling[]> = new Map();
  const add = (map: Map<string, Sibling[]>, key: string, entry: Sibling) => {
    const list = map.get(key);
    if (!list) map.set(key, [entry]);
    else if (!list.some((e) => e.unit === entry.unit)) list.push(entry);
  };
  for (const card of items || []) {
    if (!card) continue;
    const lang = langOf(card) || "";
    for (const { unit } of unitsOf(card)) {
      if (!unit || !inPlay(card, unit)) continue;
      for (const k of wordKeysOf(unit)) add(word, `${lang}\u0000${k}`, { card, unit });
      for (const k of meaningKeysOf(unit)) add(meaning, `${lang}\u0000${k}`, { card, unit });
    }
  }
  return { word, meaning };
}

/*
 * The forms of *other* cards that show what this one shows, on this side.
 *
 * Another form of the same card is not a sibling: the masculine and the
 * feminine of one word share its meaning by design, and the question
 * already has its own way of saying which form it wants (see formTagsAt
 * in the app). One entry per card, its first colliding form, so a copied
 * card with a plural is still one sibling rather than two.
 */
export function siblingsOf(
  index: SiblingIndex,
  card: Item | null | undefined,
  unit: Form | null | undefined,
  side: Side | null,
  lang: string,
): Sibling[] {
  if (!card || !unit || !side) return [];
  const map = side === "word" ? index.word : index.meaning;
  const keys = side === "word" ? wordKeysOf(unit) : meaningKeysOf(unit);
  const out: Sibling[] = [];
  const seen = new Set<string>([card.id]);
  for (const k of keys) {
    for (const s of map.get(`${lang}\u0000${k}`) || []) {
      if (seen.has(s.card.id)) continue;
      seen.add(s.card.id);
      out.push(s);
    }
  }
  return out;
}

/*
 * The first thing a form answers in a field: its first meaning, or its
 * first spelling. What a question names a sibling by.
 */
export function firstIn(unit: Form | null | undefined, field: string): string {
  return splitAlternatives(String((unit && (unit as Record<string, unknown>)[field]) || "")).filter(Boolean)[0] || "";
}

/*
 * Whether a sibling would be answered the same way as the card asked.
 *
 * صَبِر = cactus asked for its transliteration has the same answer as
 * صَبِر = patience: both are *sabir*, so there is nothing to choose
 * between and nothing to say. Only a sibling whose answer differs makes
 * the question unclear.
 */
export function answersAlike(a: Form, b: Form, answerField: string): boolean {
  if (answerField === "en") {
    const mine = meaningKeysOf(a);
    return meaningKeysOf(b).some((k) => mine.includes(k));
  }
  if (answerField === "ar") {
    const mine = wordKeysOf(a);
    return wordKeysOf(b).some((k) => mine.includes(k));
  }
  const raw = (u: Form) => wordKey(String((u as Record<string, unknown>)[answerField] || ""));
  return !!raw(a) && raw(a) === raw(b);
}

/*
 * What goes under the prompt, where a sibling makes it unclear.
 *
 * The teacher's clue where they wrote one — *the plant* — and otherwise
 * the other cards' answers, ruled out: "not patience", "not صح or يمين".
 * Empty where nothing needs saying.
 */
export function clueFor(card: Item | null | undefined, siblings: Sibling[], answerField: string): string {
  if (!siblings.length) return "";
  const written = String((card && card.clue) || "").trim();
  if (written) return written;
  const others = siblings.map((s) => firstIn(s.unit, answerField)).filter(Boolean);
  const unique = others.filter((x, i) => others.indexOf(x) === i);
  return unique.length ? `not ${unique.join(" or ")}` : "";
}

/*
 * Whether this form should leave the questions that are only about the
 * word to another card.
 *
 * Reading صَبِر aloud, writing it from its transliteration, writing it
 * down from a recording: none of those is about what it means, so a
 * learner with both صَبِر cards would practise the same thing twice on
 * two schedules. The card made first keeps them; a later card with the
 * same word drops them. Ties go to the id, so the answer never depends on
 * the order the cards happen to be stored in.
 */
export function leavesWordToSibling(index: SiblingIndex, card: Item, unit: Form, lang: string): boolean {
  const mine = [Number(card.created) || 0, String(card.id)] as const;
  const earlier = (other: Item) => {
    const theirs = [Number(other.created) || 0, String(other.id)] as const;
    return theirs[0] < mine[0] || (theirs[0] === mine[0] && theirs[1] < mine[1]);
  };
  return siblingsOf(index, card, unit, "word", lang).some((s) => earlier(s.card));
}

/* The exercises that are only about the word: shown or heard in the
   language being learnt, and answered in it too. */
export function onlyAboutWord(spec: { promptField?: string; answerField?: string } | null | undefined): boolean {
  if (!spec) return false;
  return ["ar", "lat"].includes(spec.answerField || "") && ["ar", "lat", "audio", "pairs"].includes(spec.promptField || "");
}

/*
 * What the learner is told when they gave the other card's answer.
 *
 * Not a mistake — they know the word, just not the meaning this card is
 * about — so the question is asked again and nothing is marked.
 */
export function siblingAnswerNote(side: Side, given: Sibling, answerField: string): string {
  const said = firstIn(given.unit, answerField);
  if (side === "word") return `Yes, it also means “${said}”. Now the other meaning.`;
  return `Yes, ${said} means that too. Now the other one.`;
}
