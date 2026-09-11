/** @import { Lang } from "./types.js" */
/*
 * What a teacher's own material already says about itself.
 *
 * A phrase card names the words it teaches, and that link is what puts a
 * word in front of a learner inside a real sentence rather than alone. The
 * link is made by hand, once, at the moment the phrase is written — so a
 * phrase written in week one knows nothing about a word added in week
 * three, and the share of a deck that can be taught in context quietly
 * falls as the deck grows.
 *
 * Nothing here writes anything. It reads a pile of cards and answers three
 * questions a teacher would otherwise have to answer by rereading their own
 * material:
 *
 *   to confirm   a phrase contains a word you teach and does not say so
 *   bare         a word you teach turns up in none of your phrases
 *   missing      a word your phrases keep using has no card at all
 *
 * All three are proposals. The matcher behind them is a good guesser and an
 * occasional liar — Arabic peels كتاب down to تاب, which is also a word —
 * so every answer here is something to offer somebody, never something to
 * act on. That is why this module has no writer in it at all.
 *
 * A plain module for the reason scheduler.js is one: it decides what a
 * teacher is shown, and `node --test` cannot import a .jsx file.
 */

import { contextTokens, findWordSpan, isFunctionWord, supportsContext } from "./languages.js";

/*
 * Where a word stops and a phrase begins, in tokens.
 *
 * One seam, read from both sides: a card of one or two tokens is
 * word-shaped — cà phê is a word and so is كتاب — and a card of three or
 * more is phrase-shaped, which makes it worth mining for the words inside
 * it. Two tokens is as likely to be a compound as a phrase, so the seam
 * sits above it: suggesting each half of a word as a card of its own is
 * the sort of suggestion that teaches a teacher to stop reading them.
 *
 * This only decides what is *offered*. Which cards can be found inside
 * which is a question of one being shorter than the other, and nothing to
 * do with this line — a three-token compound is still found inside a
 * sentence, it is simply not counted among the words a deck is measured by.
 */
export const WORD_TOKENS = 2;
export const MINE_FROM_TOKENS = WORD_TOKENS + 1;

/* How many phrases to name beside a suggestion. Enough to judge it by;
   fewer than a paragraph. */
export const EXAMPLES_SHOWN = 3;

/** @param {Record<string, any>} card */
const textOf = (card) => String((card && card.ar) || "").trim();

/**
 * @param {Record<string, any>} card
 * @param {Lang} lang
 */
const lengthOf = (card, lang) => contextTokens(textOf(card), lang).length;

/* What a card is called in a list, keeping it to the fields every shape of
   card has — the teacher's and the learner's copies differ in everything
   else. */
/** @param {Record<string, any>} card */
const named = (card) => ({ id: card.id, ar: textOf(card), en: card.en || "" });

/*
 * Every word-inside-a-card pair the material holds, whether or not anybody
 * has confirmed it.
 *
 * A pair is possible when one card is shorter than another and the language
 * finds the shorter one inside it. Shorter in tokens rather than "is a word
 * card": a card is a word because a teacher wrote it on its own, not
 * because it has no spaces in it, and deciding otherwise is what kept
 * Vietnamese — where most words are two syllables — from ever teaching a
 * word in context at all.
 */
/**
 * @param {Record<string, any>[]} cards
 * @param {Lang} lang
 */
export function pairsIn(cards, lang) {
  const usable = (cards || []).filter((c) => c && c.id && textOf(c));
  const pairs = [];
  for (const container of usable) {
    const long = lengthOf(container, lang);
    for (const word of usable) {
      if (word.id === container.id) continue;
      if (lengthOf(word, lang) >= long) continue;
      const span = findWordSpan(textOf(container), textOf(word), lang);
      if (!span) continue;
      pairs.push({
        container: named(container),
        word: named(word),
        at: span.at,
        len: span.len,
        confirmed: (container.uses || []).includes(word.id),
      });
    }
  }
  return pairs;
}

/*
 * The words a teacher's phrases keep using that no card covers.
 *
 * Read out of the phrases themselves: every token of every card long
 * enough to be one, minus the ones a card already covers, minus the
 * particles and prepositions the language names as never worth a card.
 *
 * Forms of the same word are gathered — الكتاب and كتابها are one
 * suggestion, not two — and the shortest form seen stands for the group,
 * because that is the likeliest to be the word itself rather than the word
 * with something stuck to it. Likeliest, not certain: what this produces
 * is the first line of a card somebody else finishes.
 */
/**
 * @param {Record<string, any>[]} cards
 * @param {Lang} lang
 */
export function unknownWords(cards, lang) {
  const usable = (cards || []).filter((c) => c && c.id && textOf(c));
  /** @type {{ text: string, forms: string[], count: number, examples: any[] }[]} */
  const groups = [];

  for (const card of usable) {
    const tokens = contextTokens(textOf(card), lang);
    if (tokens.length < MINE_FROM_TOKENS) continue;
    /* One card counts once towards a word, however many times it says it:
       a sentence that repeats a word is one example of it, not two. */
    const seenHere = new Set();
    for (const token of tokens) {
      if (!token || seenHere.has(token)) continue;
      seenHere.add(token);
      if (isFunctionWord(token, lang)) continue;
      /* A token any card already covers is not missing — including a card
         longer than one token, so a compound already taught is not
         suggested again syllable by syllable. */
      if (usable.some((c) => findWordSpan(token, textOf(c), lang))) continue;

      const group = groups.find((g) => g.forms.some((f) => sameWord(f, token, lang)));
      if (group) {
        group.count += 1;
        if (!group.forms.includes(token)) group.forms.push(token);
        if (token.length < group.text.length) group.text = token;
        if (group.examples.length < EXAMPLES_SHOWN) group.examples.push(named(card));
      } else {
        groups.push({ text: token, forms: [token], count: 1, examples: [named(card)] });
      }
    }
  }

  return groups.sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1));
}

/* Two written forms of one word, as far as the language is concerned.
   Asked both ways round, because peeling is not symmetrical: الكتاب peels
   to كتاب and كتاب does not peel to الكتاب. */
/**
 * @param {string} a
 * @param {string} b
 * @param {Lang} lang
 */
function sameWord(a, b, lang) {
  const matches = lang.context.matches;
  return matches(a, b) || matches(b, a);
}

/*
 * The three lists, for the screen that shows them.
 *
 * Gathered in one pass because they are one question asked three ways, and
 * because a teacher reading them is deciding one thing: where the next ten
 * minutes of writing would do the most good.
 */
/**
 * @param {Record<string, any>[]} cards
 * @param {Lang} lang
 */
export function linkReport(cards, lang) {
  if (!supportsContext(lang)) {
    return { supported: false, toConfirm: [], confirmed: [], bare: [], missing: [], coverage: null };
  }

  const pairs = pairsIn(cards, lang);
  const toConfirm = pairs.filter((p) => !p.confirmed);
  const confirmed = pairs.filter((p) => p.confirmed);

  /* A word is bare when nothing the teacher has written contains it —
     which is not the same as having no confirmed link, and the difference
     is the whole point: one of them is a tick away and the other needs a
     phrase writing. */
  const inSomething = new Set(pairs.map((p) => p.word.id));
  const usable = (cards || []).filter((c) => c && c.id && textOf(c));
  /* Word-shaped cards only. A phrase that happens to turn up inside a
     longer sentence is not a word waiting for somewhere to be used. */
  const targets = usable.filter((c) => lengthOf(c, lang) <= WORD_TOKENS);
  const bare = targets.filter((c) => !inSomething.has(c.id)).map(named);
  return {
    supported: true,
    toConfirm,
    confirmed,
    bare,
    missing: unknownWords(cards, lang),
    /* The number the report has always shown, worked out from the same
       pass: how much of what could be taught in context already is. */
    coverage: {
      words: targets.length,
      covered: new Set(confirmed.map((p) => p.word.id)).size,
      links: confirmed.length,
    },
  };
}
