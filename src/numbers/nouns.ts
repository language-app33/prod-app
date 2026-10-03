/*
 * The things a counting question counts, read off the teacher's own noun
 * cards.
 *
 * A system used to carry a short list of nouns of its own, written on the
 * number screen, because no card could say a word was a pair. One can
 * since 0.207 — a noun's accepted answer may be marked dual — so the list
 * went in 0.316 and this reads the cards instead. A counting question
 * then asks about words the learner is already being taught, and a noun
 * the teacher writes tomorrow joins in without anybody opening the number
 * screen.
 *
 * What makes a noun countable is the card's own answers: one marked
 * singular (or the card's own word, where nothing says otherwise), one
 * marked plural, one marked dual where the language counts in pairs, and
 * a gender. Whether the dual is needed is the composer's to say, not this
 * file's — a noun is read for everything it has, and the range that asks
 * for a face it lacks finds out by rendering it. See `countable` in
 * range.ts.
 *
 * Pure and word-free, like everything under src/numbers/: it reads which
 * answer is which and copies the words across, and holds none.
 */
import type { CountedNoun } from "./types.ts";
import { answersOf, splitAlternatives } from "../answers.ts";
import { formsOf } from "../cards.ts";

/* The three things the answers are asked, accepted as the card wrote
   them: the language narrows its values where a card is saved, and this
   only has to tell them apart. */
const FIELDS = [
  { field: "number", allowed: [] },
  { field: "gender", allowed: [] },
  { field: "human", allowed: [] },
];

type Held = Record<string, unknown>;

const str = (x: unknown): string => (x == null ? "" : String(x).trim());
const firstOf = (x: unknown): string => (splitAlternatives(str(x))[0] || "").trim();

/** Why a noun card is not counted, said the way the number screen says it. */
export type NounGap = "singular" | "plural" | "gender";

export interface ReadNoun {
  /** The card's id, which is also the noun's. */
  id: string;
  /** What the card means, for a list that has to name it. */
  en: string;
  /** The noun, where it can be counted at all. */
  noun?: CountedNoun;
  /** What it is missing, where it cannot. */
  missing: NounGap[];
}

/**
 * One card, as a noun to count — or as what it is missing.
 *
 * Null for a card that is not a noun at all. The first answer of each
 * kind wins: a card that accepts two plurals is counted with the one the
 * teacher wrote first, which is the same rule a sentence borrowing it
 * follows.
 */
export function readNounCard(card: Held | null | undefined): ReadNoun | null {
  if (!card || str(card.category).toLowerCase() !== "noun") return null;
  const id = str(card.id);
  if (!id) return null;
  let sg: { text: string; en: string; gender: string; human: string } | null = null;
  const pls: { text: string; en: string; gender: string }[] = [];
  const duals: { text: string; gender: string }[] = [];
  let gender = "";
  let human = "";
  formsOf(card).forEach((form: Held, at: number) => {
    for (const answer of answersOf(form, FIELDS)) {
      const text = str(answer.text);
      if (!text) continue;
      const number = str(answer.number || form.number).toLowerCase();
      const g = str(answer.gender || form.gender).toLowerCase();
      const h = str(answer.human || form.human).toLowerCase();
      if (g && !gender) gender = g;
      if (h && !human) human = h;
      const en = firstOf(form.en);
      if (number === "plural") {
        pls.push({ text, en, gender: g });
      } else if (number === "dual") {
        duals.push({ text, gender: g });
      } else if (!sg && (number === "singular" || at === 0)) {
        sg = { text, en, gender: g, human: h };
      }
    }
  });
  const one = sg as { text: string; en: string; gender: string; human: string } | null;
  /* The plural and the pair of the singular's own side. A person or an
     animal can carry a masculine and a feminine plural on one card, and the first
     plural written is not necessarily the masculine's, so one counted as
     "three teachers" has to be the plural of the word it counts. One that
     says no gender is anybody's. */
  const sameSide = <T extends { gender: string }>(list: T[]): T | null => {
    const side = one ? one.gender : "";
    return list.find((x) => !side || !x.gender || x.gender === side) || null;
  };
  const many = sameSide(pls);
  const pair = sameSide(duals);
  const dual = pair ? pair.text : "";
  /* The singular's own gender where it says one — a noun is the gender of
     its singular — and otherwise whatever any of its answers said. */
  const g = (one && one.gender) || gender;
  const sex = g === "masculine" ? "m" : g === "feminine" ? "f" : "";
  const missing: NounGap[] = [];
  if (!one) missing.push("singular");
  if (!many) missing.push("plural");
  if (!sex) missing.push("gender");
  const en = (one && one.en) || firstOf((formsOf(card)[0] || {}).en);
  if (missing.length || !one || !many) return { id, en, missing };
  const noun: CountedNoun = {
    id,
    sg: one.text,
    pl: many.text,
    ...(dual ? { dual } : null),
    gender: sex as "m" | "f",
    en,
    ...(many.en && many.en !== en ? { enPl: many.en } : null),
    ...((one.human || human) ? { human: one.human || human } : null),
  };
  return { id, en, noun, missing: [] };
}

/**
 * Every noun in one language among these cards, as the counting questions
 * read them — in the order of their ids, so a teacher's device and a
 * learner's draw the same noun for the same seed.
 *
 * A card in no language is taken for the one asked about, as every card
 * written before cards carried one is.
 */
export function readNouns(cards: Held[] | null | undefined, langId: string): ReadNoun[] {
  const out: ReadNoun[] = [];
  for (const card of cards || []) {
    if (card.lang && card.lang !== langId) continue;
    const read = readNounCard(card);
    if (read) out.push(read);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The countable ones alone, which is what a system is rendered with. */
export const countedNouns = (cards: Held[] | null | undefined, langId: string): CountedNoun[] =>
  readNouns(cards, langId).flatMap((r) => (r.noun ? [r.noun] : []));

/**
 * A system with its nouns put in, without disturbing one that already has
 * the same ones — so a caller memoising on the system keeps its memo.
 */
export function withNouns<T extends { nouns: CountedNoun[] }>(sys: T, nouns: CountedNoun[]): T {
  const same =
    sys.nouns.length === nouns.length &&
    sys.nouns.every((n, i) => JSON.stringify(n) === JSON.stringify(nouns[i]));
  return same ? sys : { ...sys, nouns };
}

/**
 * Each set's numbers with the nouns these cards hold in its language.
 *
 * On a learner's device the cards are the course material they hold, so
 * a counting question asks about words they are being taught. A set comes
 * back unchanged — the same object — where its nouns have not moved,
 * which keeps every memo built on it.
 */
export function setsWithNouns<S extends { numbers: { languageId: string; nouns: CountedNoun[] } }>(
  sets: S[],
  cards: Held[],
): S[] {
  return setsGiven(sets, nounsByLanguage(sets, cards));
}

/** The countable nouns among these cards, for each language the sets are
    in — a plain object, so a caller can hold it as a string and notice
    when it has really changed. */
export function nounsByLanguage(
  sets: { numbers: { languageId: string } }[],
  cards: Held[],
): Record<string, CountedNoun[]> {
  const out: Record<string, CountedNoun[]> = {};
  for (const set of sets || []) {
    const id = set.numbers.languageId;
    if (!(id in out)) out[id] = countedNouns(cards, id);
  }
  return out;
}

/** Each set with the nouns given for its language. */
export function setsGiven<S extends { numbers: { languageId: string; nouns: CountedNoun[] } }>(
  sets: S[],
  byLang: Record<string, CountedNoun[]>,
): S[] {
  return (sets || []).map((set) => {
    const numbers = withNouns(set.numbers, byLang[set.numbers.languageId] || []);
    return numbers === set.numbers ? set : { ...set, numbers };
  });
}
