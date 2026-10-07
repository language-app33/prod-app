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

import type { Card, Form, Item } from "./types.ts";
import { formsOf } from "./cards.ts";
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

/* ------------------------------------------------------------------
   For the teacher

   The same rule, from the other end: a teacher writes one card per
   meaning, and these are what make that cheap — a card copied for a
   second meaning, a spelling fixed on every card that shares it, a card
   holding two meanings split into two.
   ------------------------------------------------------------------ */

/*
 * What the language a learner learns from is called, where the screen has
 * to name it: "Same English". One place, so that teaching from another
 * language later is a change here rather than a hunt.
 */
export const LEARNING_LANGUAGE = "English";

/* A card that is not one of the teacher's own words: a number made out of
   the number system, which nobody writes and nobody splits. */
const madeByApp = (card: Card): boolean => String(card.id || "").startsWith("sys:") || card.derived === true;

/*
 * The teacher's other cards that show the same word, or the same meaning,
 * as the one being written — read off what is on the screen now, so the
 * line updates as they type.
 */
export function sharedWith(
  cards: Card[],
  self: { id: string; lang: string },
  lead: Form,
): { word: Card[]; meaning: Card[] } {
  const others = (cards || []).filter(
    (c) => c && String(c.id) !== self.id && !madeByApp(c) && (!c.lang || !self.lang || c.lang === self.lang),
  );
  const index = siblingIndexOf(others as unknown as Item[], () => "");
  const me = { id: self.id || "\u0000self", tags: [], forms: [lead] } as unknown as Item;
  const pick = (side: Side) => siblingsOf(index, me, lead, side, "").map((s) => s.card as unknown as Card);
  return { word: pick("word"), meaning: pick("meaning") };
}

/*
 * A new card for another meaning of the same word.
 *
 * Every form comes across — the word, its plural, its whole table — with
 * its spelling, its pronunciation and its recordings, because a word's
 * forms are usually the same whatever it means and a teacher would
 * otherwise record them twice. What it means does not: every meaning box
 * is emptied, and the pictures stay behind, since a picture shows a
 * meaning. Nothing that names the card comes either — its ID is the
 * original's, and its clue says which meaning *that* one is. A card with
 * no id, which the editor opens as a new card.
 *
 * And no decks: a meaning is placed where it belongs, on purpose, rather
 * than landing in the original's decks by default.
 */
export function anotherMeaningOf(card: Card): Card {
  const {
    id: _id, ref: _ref, clue: _clue, name: _name, review: _review, fills: _fills, uses: _uses,
    decks: _decks, inDecks: _inDecks, rev: _rev, created: _created, updated: _updated,
    splitFrom: _splitFrom, together: _together,
    ...rest
  } = card;
  return {
    ...rest,
    id: "",
    forms: formsOf(card).map((f) => {
      const { images: _images, ...form } = f as Form & { images?: string[] };
      return { ...form, en: "" };
    }),
  } as Card;
}

/* And for another word with the same meaning: the meaning, and nothing
   else, since the word and everything about it is new. */
export function anotherWordDraft(card: Card | null, lead: Form | null): Record<string, string> {
  return { en: String((lead && lead.en) || (card && formsOf(card)[0] && formsOf(card)[0].en) || "") };
}

/*
 * What changed about the word itself between the card as stored and as
 * saved: its spelling, its pronunciation, its recordings — form by form,
 * the card's own word by place and the rest by name, which is how a copy
 * made by anotherMeaningOf lines up with its original.
 */
export interface WordChange {
  at: number;
  id: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

const WORD_FIELDS = ["ar", "lat", "clips", "slowClips"];
/* Nothing, an empty list and an empty string are all "none": a card
   stored before a field existed says nothing where the editor says [],
   and that is not a change anybody made. */
const plainOf = (x: unknown): string => {
  if (x == null || x === "" || (Array.isArray(x) && !x.length)) return "";
  return typeof x === "string" ? x.trim() : JSON.stringify(x);
};
const same = (a: unknown, b: unknown) => plainOf(a) === plainOf(b);

export function wordChanges(before: Card | null, after: Form[]): WordChange[] {
  if (!before) return [];
  const was = formsOf(before);
  const out: WordChange[] = [];
  after.forEach((f, i) => {
    const old = i === 0 ? was[0] : was.find((w, j) => j > 0 && w.id && w.id === f.id);
    if (!old) return;
    const from: Record<string, unknown> = {};
    const to: Record<string, unknown> = {};
    for (const k of WORD_FIELDS) {
      const a = (old as Record<string, unknown>)[k];
      const b = (f as Record<string, unknown>)[k];
      if (!same(a, b)) {
        from[k] = a;
        to[k] = b;
      }
    }
    /* The spelling is what says which other cards are the same word, so a
       form whose spelling was empty before has nothing to match on. */
    if (Object.keys(to).length && plainOf((old as Record<string, unknown>).ar)) {
      out.push({ at: i, id: String(f.id || ""), from: { ar: (old as Record<string, unknown>).ar, ...from }, to });
    }
  });
  return out;
}

/* The form of another card that a change to this one's form is about. */
const mateIn = (other: Card, ch: WordChange): Form | null => {
  const forms = formsOf(other);
  return ch.at === 0 ? forms[0] || null : forms.find((f, j) => j > 0 && f.id && f.id === ch.id) || null;
};

/*
 * The other cards a change to the word should be offered to: those whose
 * matching form still says exactly what this one said before.
 */
export function cardsSharingChange(cards: Card[], self: { id: string; lang: string }, changes: WordChange[]): Card[] {
  if (!changes.length) return [];
  return (cards || []).filter((c) => {
    if (!c || String(c.id) === self.id || madeByApp(c)) return false;
    if (c.lang && self.lang && c.lang !== self.lang) return false;
    return changes.some((ch) => {
      const mate = mateIn(c, ch);
      if (!mate) return false;
      return Object.keys(ch.from).every((k) => same((mate as Record<string, unknown>)[k], ch.from[k]));
    });
  });
}

/* That card with the change made, wherever it still says the old thing.
   Null where nothing on it moves. */
export function carryWordChanges(other: Card, changes: WordChange[]): Card | null {
  const forms = formsOf(other).map((f) => ({ ...f }));
  let moved = false;
  for (const ch of changes) {
    const mate = mateIn({ ...other, forms } as Card, ch);
    if (!mate) continue;
    for (const k of Object.keys(ch.to)) {
      if (!same((mate as Record<string, unknown>)[k], ch.from[k])) continue;
      (mate as Record<string, unknown>)[k] = ch.to[k];
      moved = true;
    }
  }
  return moved ? ({ ...other, forms } as Card) : null;
}

/*
 * Cards written with more than one meaning on them — "cactus / patience"
 * — which the teacher may want to split into one card each.
 *
 * Only the teacher can say whether the meanings are two (cactus, patience)
 * or two ways of saying one (big, large), so this lists and never acts.
 * A card the teacher has already said to keep together is not listed
 * again, and neither is anything that is not a plain word: a sentence's
 * English, a conversation, a value.
 */
export function meaningsOnCard(card: Card): string[] {
  if (!card || madeByApp(card) || card.sentence || card.drill === false) return [];
  if (card.together) return [];
  if (Array.isArray(card.lines) && card.lines.length) return [];
  const list = splitAlternatives(formsOf(card)[0] ? formsOf(card)[0].en : "").filter(Boolean);
  return list.length > 1 ? list : [];
}

/*
 * The card narrowed to one of its meanings.
 *
 * Every form whose meanings line up with the card's own word — the same
 * number of them — takes the one in the same place; a form that says
 * something else is left as it is. Pictures stay on the first card only,
 * since nothing says which meaning they show.
 */
export function narrowedTo(card: Card, k: number): Card {
  const count = splitAlternatives(formsOf(card)[0] ? formsOf(card)[0].en : "").filter(Boolean).length;
  return {
    ...card,
    forms: formsOf(card).map((f) => {
      const list = splitAlternatives(f.en).filter(Boolean);
      const en = list.length === count ? list[k] : f.en;
      const { images, ...form } = f as Form & { images?: string[] };
      return { ...form, en, ...(k === 0 && images ? { images } : null) } as Form;
    }),
  } as Card;
}

/*
 * Split into one card per meaning: the original keeps the first, and a
 * new card is made for each of the others.
 *
 * The new cards say which card they came out of, so a learner's device
 * can start them where the original stood rather than from nothing — see
 * foldCourses — and they go in the same decks, since a learner who had the
 * card should go on having all of it.
 */
export function splitByMeaning(card: Card): { kept: Card; made: Card[] } {
  const list = meaningsOnCard(card);
  if (list.length < 2) return { kept: card, made: [] };
  const made = list.slice(1).map((_, i) => {
    const { id: _id, ref: _ref, clue: _clue, review: _review, rev: _rev, created: _created, updated: _updated, ...rest } =
      narrowedTo(card, i + 1);
    return { ...rest, id: "", splitFrom: String(card.id) } as Card;
  });
  return { kept: narrowedTo(card, 0), made };
}
