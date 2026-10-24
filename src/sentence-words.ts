/*
 * Which of a sentence's words have a card, and which have none.
 *
 * Two readers ask it about a sentence of a text. The learner's app asks
 * which cards the sentence is made of, so that a sentence waits until most
 * of them are known (see `sentenceWaits` in the trainer). The editor asks
 * which words have no card at all, so a teacher can see what students will
 * meet unlearnt before they write a text that is mostly words nobody
 * teaches.
 *
 * Every window of the sentence is tried against every form of every
 * single-word card, the way `wordsOffered` tries them for "Words this
 * teaches" and with the same matcher, so a word found here is a word the
 * editor would have offered. Every window rather than the first match,
 * because a word said twice is two words with a card, not one with a card
 * and one without.
 *
 * Pure, and handed the cards: the editor holds the teacher's collection and
 * the app the learner's, and the answer is a fact about which.
 */

import type { Form, Item, Lang } from "./types.ts";
import { contextTokens, kindOf, splitForms, supportsContext } from "./languages.ts";
import { unitsOf } from "./scheduler.ts";
import { wordOf } from "./cards.ts";
import { isDialog } from "./dialogs.ts";

/* A card longer than this is not a word anybody is going to find inside a
   sentence — the limit findWordSpan keeps, for the same reason. */
const MAX_WORD_TOKENS = 6;

/* One card found in the sentence: which, in which form, and where. */
export interface WordHit {
  card: Item;
  form: Form;
  at: number;
  len: number;
}

export interface SentenceWords {
  /** The sentence's words, as the language splits them. */
  tokens: string[];
  /** Each card found, once, at the first place it was found. */
  hits: WordHit[];
  /** The words no card was found for, in reading order. A blank still to
      be filled is not one: something will be put there. */
  bare: string[];
}

/* Punctuation either side of a word is not part of it. */
const bareWord = (token: string): string => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");

export function sentenceWords(text: string, cards: Item[], lang: Lang, selfId: string = ""): SentenceWords {
  const tokens = supportsContext(lang) ? contextTokens(String(text || ""), lang) : [];
  if (!tokens.length) return { tokens, hits: [], bare: [] };
  const covered: boolean[] = tokens.map(() => false);
  const hits: WordHit[] = [];
  for (const card of cards || []) {
    if (!card || !card.id || card.id === selfId || isDialog(card)) continue;
    /* A word is what the teacher said is one — see kindOf. Guessed from
       its spaces, every Vietnamese word of two syllables, and every word
       with two accepted answers, was a phrase and taught nothing here. */
    const lead = wordOf(card).ar;
    if (!lead || kindOf(card, lang) !== "word") continue;
    let found: WordHit | null = null;
    for (const { unit } of unitsOf(card)) {
      /* Each answer the form accepts is a word a sentence may hold. */
      for (const word of splitForms(String(unit.ar || ""))) {
        const len = Math.min(contextTokens(word, lang).length, MAX_WORD_TOKENS);
        if (!len || len > tokens.length) continue;
        for (let i = 0; i + len <= tokens.length; i++) {
          const window = len === 1 ? tokens[i] : tokens.slice(i, i + len).join(" ");
          if (!lang.context.matches(window, word)) continue;
          for (let k = i; k < i + len; k++) covered[k] = true;
          if (!found) found = { card, form: unit, at: i, len };
        }
      }
    }
    if (found) hits.push(found);
  }
  const bare = tokens
    .map((t, i) => (covered[i] || /[{}]/.test(t) ? "" : bareWord(t)))
    .filter((w) => w && /\p{L}/u.test(w));
  return { tokens, hits, bare };
}

/*
 * How many words a sentence of a text may have before the editor calls it
 * long. The language's own number where it gives one — Vietnamese writes
 * each syllable apart, so its sentences count more words for the same
 * length — and twelve otherwise.
 */
export const LONG_SENTENCE = 12;

export const longSentenceOf = (lang: Lang): number => lang.longSentence || LONG_SENTENCE;

/* How many words of the sentence count towards its length: the tokens with
   a letter in them, so a dash standing alone is not a word. */
export const wordCount = (text: string, lang: Lang): number =>
  contextTokens(String(text || ""), lang).filter((t) => /\p{L}/u.test(t) || /[{}]/.test(t)).length;
