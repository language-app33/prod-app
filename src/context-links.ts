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
 * "Phrase" throughout means anything a word can sit inside: a phrase card,
 * a sentence card, or one turn of a conversation. A scene keeps its words
 * in its lines and has no text of its own, so reading `ar` off each card
 * saw straight past every conversation a teacher had written.
 *
 * All three are proposals. The matcher behind them is a good guesser and an
 * occasional liar — Arabic peels كتاب down to تاب, which is also a word —
 * so every answer here is something to offer somebody, never something to
 * act on. That is why this module has no writer in it at all.
 *
 * A plain module for the reason scheduler.ts is one: it decides what a
 * teacher is shown, so a test has to be able to reach it without the
 * app around it.
 */

import type { Lang } from "./types.ts";
import { contextTokens, findWordSpan, isFunctionWord, supportsContext } from "./languages.ts";
import { isDialog, linesOf, speakerName } from "./dialogs.ts";

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

/* A card, as this module reads one: whatever it was handed, since the
   teacher's copy and the learner's differ in everything but these. */
type Card = Record<string, any>;

const textOf = (card: Card) => String((card && card.ar) || "").trim();

const lengthOf = (card: Card, lang: Lang) => contextTokens(textOf(card), lang).length;

/* What a card is called in a list, keeping it to the fields every shape of
   card has — the teacher's and the learner's copies differ in everything
   else. */
const named = (card: Card) => ({ id: card.id, ar: textOf(card), en: card.en || "" });

/*
 * Everywhere a word could turn up: the teacher's phrases, and the turns of
 * their conversations.
 *
 * A conversation keeps its words in its lines, and has no text of its own —
 * so a report that read `ar` off each card saw nothing at all in it. Every
 * scene a teacher wrote was invisible here: the words in it read as bare,
 * the lines using them never came up to confirm, and coverage counted a
 * deck taught entirely through conversation at nothing. Meanwhile the
 * session builder had been treating those same lines as contexts all
 * along (see context-index.ts), so the two halves of the app disagreed
 * about what the material contains.
 *
 * A container is therefore a card or one turn of one. `cardId` is what to
 * open and what to save; `line` is which turn, or null for a card that is
 * its own text. `id` is the two of them together, because a row on screen
 * is keyed by it and two turns of one scene are two rows.
 */
export interface Container {
  /** The card and the turn together, because a row on screen is keyed by
      it and two turns of one scene are two rows. */
  id: string;
  /** What to open, and what to save. */
  cardId: string;
  /** Which turn, or null for a card that is its own text. */
  line: number | null;
  ar: string;
  en: string;
  /** Who says it, where it is a turn. */
  who: string;
  uses: string[];
}

export function containersIn(cards: Card[]): Container[] {
  const out: Container[] = [];
  for (const card of cards || []) {
    if (!card || !card.id) continue;
    if (isDialog(card)) {
      linesOf(card).forEach((line, at) => {
        const text = String((line && line.ar) || "").trim();
        if (!text) return;
        out.push({
          id: `${card.id}#${at}`,
          cardId: card.id,
          line: at,
          ar: text,
          en: line.en || "",
          /* Who says it, so a turn offered for confirmation reads as a
             turn rather than as a phrase from nowhere. */
          who: speakerName(card, line.who || 0),
          uses: line.uses || [],
        });
      });
      continue;
    }
    if (!textOf(card)) continue;
    out.push({
      id: card.id,
      cardId: card.id,
      line: null,
      ar: textOf(card),
      en: card.en || "",
      who: "",
      uses: card.uses || [],
    });
  }
  return out;
}

/*
 * Every word-inside-something pair the material holds, whether or not
 * anybody has confirmed it.
 *
 * A pair is possible when a card is shorter than a container and the
 * language finds it inside. Shorter in tokens rather than "is a word
 * card": a card is a word because a teacher wrote it on its own, not
 * because it has no spaces in it, and deciding otherwise is what kept
 * Vietnamese — where most words are two syllables — from ever teaching a
 * word in context at all.
 *
 * The word side is always a card, because a word is something a teacher
 * teaches; the container side is a card or a turn of a conversation.
 */
export function pairsIn(cards: Card[], lang: Lang) {
  const usable = (cards || []).filter((c) => c && c.id && textOf(c));
  const pairs = [];
  for (const container of containersIn(cards)) {
    const long = contextTokens(container.ar, lang).length;
    for (const word of usable) {
      if (word.id === container.cardId) continue;
      if (lengthOf(word, lang) >= long) continue;
      const span = findWordSpan(container.ar, textOf(word), lang);
      if (!span) continue;
      pairs.push({
        container,
        word: named(word),
        at: span.at,
        len: span.len,
        confirmed: container.uses.includes(word.id),
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
export interface Missing {
  /** The form offered as the first line of a card: the plainest one seen. */
  text: string;
  forms: string[];
  count: number;
  examples: Container[];
}

export function unknownWords(cards: Card[], lang: Lang): Missing[] {
  const usable = (cards || []).filter((c) => c && c.id && textOf(c));
  const groups: Missing[] = [];

  /* Turns of a conversation are mined alongside phrases: a word a scene
     keeps using and nothing teaches is exactly the gap one a sentence keeps
     using is. */
  for (const container of containersIn(cards)) {
    const tokens = contextTokens(container.ar, lang);
    if (tokens.length < MINE_FROM_TOKENS) continue;
    /* One container counts once towards a word, however many times it says
       it: a sentence that repeats a word is one example of it, not two. */
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
        if (group.examples.length < EXAMPLES_SHOWN) group.examples.push(container);
      } else {
        groups.push({ text: token, forms: [token], count: 1, examples: [container] });
      }
    }
  }

  return groups.sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1));
}

/* Two written forms of one word, as far as the language is concerned.
   Asked both ways round, because peeling is not symmetrical: الكتاب peels
   to كتاب and كتاب does not peel to الكتاب. */
function sameWord(a: string, b: string, lang: Lang): boolean {
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
export function linkReport(cards: Card[], lang: Lang) {
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
