/*
 * How well a deck is built to be learnt from — one number out of 100, and
 * the few changes that would raise it most.
 *
 * The owner's rules, settled in conversation before any of this was
 * written (see DECISIONS.md, "A deck's quality"):
 *
 *   * **Words met in sentences: 55 points.** Every form of a word a
 *     student is asked wants a sentence in the same deck — the word itself
 *     two, each other form one. A form short of them earns its share. A
 *     card is scored first, the word itself half of it and its other forms
 *     the other half between them, and every card counts the same, so a
 *     verb of thirty forms does not outweigh thirty words.
 *   * **Sentences that are well made: 10 points** — linked to at least one
 *     word card, and using no word that no deck of the course teaches.
 *   * **Seven smaller checks, 5 points each**: recordings, pictures,
 *     pronunciation written, sentences reviewed, no word on two cards, no
 *     overly long sentence, and a conversation or text in the deck.
 *
 * What counts as a sentence: a phrase or sentence card, or one line of a
 * conversation or text. A card is one sentence however
 * many versions and accepted answers it has, and every one of them is
 * read; a line picked from a sentence card of the deck is that sentence
 * again, and text with no letter in it is no sentence. What counts as a
 * word being in one: a link the teacher confirmed (`uses`), credited to
 * the form the sentence holds; a blank the word fills — exactly the forms
 * the blank can take, in the sentences the teacher has let through review
 * — or one of a verb's own examples. Names, and cards that only fill
 * blanks, are not asked to be in sentences; forms switched off are not
 * either. The sentence has to be in the same deck, because a deck can be
 * practised on its own and then it has only its own sentences.
 *
 * The conversation or text is always worth its 5 points (0.463, the
 * owner's rule). A check with nothing to measure — pronunciation in a
 * language written in Latin letters, review on a deck with no blanks — is
 * left out and its points shared among the other checks that apply, which
 * together are always worth 95. A deck with words and no sentences is not
 * spared that way: it cannot earn the first two parts, and says so.
 *
 * Pure and read-only, like context-links.ts: it is handed the teacher's
 * cards and decides nothing but what to tell them.
 */

import type { Lang } from "./types.ts";
import { formsOf, wordOf } from "./cards.ts";
import { answersOf } from "./answers.ts";
import { isDialog, linesOf, pickedFrom } from "./dialogs.ts";
import {
  answerFields, bestWordIn, contextTokens, findWordSpan, isFunctionWord, kindOf, splitForms, supportsContext, tensedOf,
} from "./languages.ts";
import { exampleCells, verbExamplesOf } from "./examples.ts";
import { isAsked } from "./scheduler.ts";
import { hasSlots, isSentence } from "./variables.ts";
import { ownSlot } from "./verbs.ts";
import { cardSentences, holedParts, lineGate, passes, reviewOf, stateFrom, toReview } from "./review.ts";
import type { PartSentences } from "./review.ts";
import { longSentenceOf, wordCount } from "./sentence-words.ts";

type Held = Record<string, any>;

/* ---- the weights ---- */

export const WORDS_POINTS = 55;
export const SENTENCES_POINTS = 10;
export const CHECK_POINTS = 5;
/** What a conversation or text is worth, whichever other checks apply. */
export const SCENE_POINTS = 5;
/** Sentences the word itself wants, and each of its other forms. */
export const SENTENCES_FOR_WORD = 2;
export const SENTENCES_FOR_FORM = 1;
/** Where the colour changes. */
export const GOOD_FROM = 80;
export const FAIR_FROM = 50;
/** How many of the changes that would help most are offered. */
export const FIXES_SHOWN = 3;

/* Kinds of word that name somebody or somewhere: there to fill a blank,
   not to be learnt inside one. */
const NAME_KINDS = ["person", "place", "name"];

export type CheckKey =
  | "words" | "sentences" | "recordings" | "pictures" | "pronunciation"
  | "reviewed" | "repeats" | "long" | "scene";

export interface Check {
  key: CheckKey;
  /** What it is worth on a deck where every check applies. */
  weight: number;
  /** How much of it the deck has earned, 0 to 1. */
  share: number;
  /** Whether the deck has anything for it to measure. */
  applies: boolean;
}

export interface Fix {
  key: string;
  /** What to do, in a sentence. */
  text: string;
  /** About how many points doing it would add. */
  gain: number;
}

export interface Quality {
  /** Out of 100, or null for a deck with nothing to score — empty, or
      numbers and names alone. */
  score: number | null;
  checks: Check[];
  /** Every change worth points, most points first. */
  fixes: Fix[];
  /** For the screen and the tests: each word card and how far its forms
      are met. */
  words: { id: string; share: number; forms: { ar: string; need: number; met: number }[] }[];
}

export interface QualityOptions {
  lang: Lang | null | undefined;
  /** Everything a blank can be filled from: the teacher's whole collection. */
  pool: Held[];
  /** The cards taught by the decks of the deck's courses — what a word in a
      sentence may come from. Defaults to the pool. */
  known?: Held[];
  /** The sentences a card with blanks makes, as review lists them; passed
      in where the caller has them already. */
  partsOf?: (card: Held) => PartSentences[];
  /** A sentence card a conversation's line was picked from. */
  cardById?: (id: string) => Held | undefined;
  /** Also offer the links nobody has confirmed — slower, so for one deck. */
  pending?: boolean;
}

/* ---- what is in a deck ---- */

const trim = (x: unknown) => String(x || "").trim();

/*
 * The answers a text holds, each on its own.
 *
 * A form with several accepted answers keeps them in one string with the
 * app's separator between them (see answers.ts), and read whole that is
 * one long text with a separator inside it: "كلشي تمام" and "كله تمام" a
 * sentence of four words, the last glued to a mark nobody wrote. Each
 * answer is read as the student meets it. One with no letter in it — a
 * line that is only "." — says nothing and is not read at all.
 */
export const answersIn = (text: unknown): string[] =>
  splitForms(String(text || "")).filter((t) => /\p{L}/u.test(t));

/** Whether a card is a word that wants sentences. */
export function wantsSentences(card: Held, lang: Lang | null | undefined): boolean {
  if (!card || isDialog(card) || isSentence(card)) return false;
  if (card.drill === false || card.derived) return false;
  if (NAME_KINDS.includes(trim(card.category))) return false;
  /* A card with no letter in it — "…" — is no word to put in a sentence. */
  if (!answersIn(wordOf(card).ar).length) return false;
  return kindOf(card, lang) === "word";
}

/**
 * The forms of a word a student is asked, each once: the word itself
 * first, wanting two sentences, and the rest one each. Two forms spelt
 * the same are one — a verb's own word is a cell of its table, and two
 * persons are often written alike.
 */
export function formsToMeet(card: Held): { ar: string; need: number }[] {
  const out: { ar: string; need: number }[] = [];
  for (const form of formsOf(card) as Held[]) {
    const ar = trim(form.ar);
    if (!ar || !isAsked(form as never) || hasSlots(form)) continue;
    if (out.some((f) => f.ar === ar)) continue;
    out.push({ ar, need: out.length ? SENTENCES_FOR_FORM : SENTENCES_FOR_WORD });
  }
  return out;
}

/*
 * One sentence of the deck: a phrase or sentence card, or a line.
 *
 * A card is one sentence however many ways it is written. Its versions —
 * a masculine and a feminine, the `subs` of an old card — and each
 * accepted answer of each are all read, because a student is asked every
 * one of them; but a word in two of them is in one sentence, not two.
 */
interface Said {
  key: string;
  card: Held;
  /* Every way it is written: each asked version, each answer of it. */
  texts: string[];
  uses: string[];
  /* Whether any version has blanks, which teach the words they take. */
  holed: boolean;
  /* The versions without blanks, for their recordings and pronunciation. */
  units: Held[];
}

/* Whether a conversation or text is practised. A safeguard, and nothing a
   teacher meets: the editor cannot switch a conversation off (it marks a
   card practised whenever any part of it is asked, and a conversation's
   part always is), so only a hand-made import or a card from before
   0.179 could arrive like this. If one does, it is never put in front of
   a student, so its lines are no sentences of the deck. See
   docs/AUDIT-what-teachers-can-make.md. */
const practised = (card: Held) => card.drill !== false;

function saidIn(cards: Held[], lang: Lang | null | undefined): Said[] {
  const out: Said[] = [];
  const said = (key: string, card: Held, versions: Held[], uses: string[]) => {
    const read = versions.map((v) => ({ v, texts: answersIn(v.ar) })).filter((r) => r.texts.length);
    if (!read.length) return;
    out.push({
      key, card, uses,
      texts: read.flatMap((r) => r.texts),
      holed: read.some((r) => hasSlots(r.v)),
      units: read.filter((r) => !hasSlots(r.v)).map((r) => r.v),
    });
  };
  for (const card of cards) {
    if (isDialog(card)) continue;
    if (card.drill === false || card.derived) continue;
    if (!isSentence(card) && kindOf(card, lang) === "word") continue;
    said(String(card.id), card, (formsOf(card) as Held[]).filter((f) => isAsked(f as never)), card.uses || []);
  }
  /* A line picked from a sentence card of this deck is that sentence said
     again: it is already counted, and counting it twice would let one
     sentence fill a word's two. */
  const counted = new Set(out.map((s) => s.key));
  for (const card of cards) {
    if (!isDialog(card) || !practised(card)) continue;
    linesOf(card as never).forEach((line: Held, at: number) => {
      if (!line || counted.has(pickedFrom(line as never))) return;
      said(`${card.id}#${at}`, card, [line], line.uses || []);
    });
  }
  return out;
}

/*
 * Whether a word, form or sentence has its recordings and its
 * pronunciation: every accepted answer of it, where it accepts several.
 *
 * A recording belongs to the answer it is of (see answers.ts), and a
 * question about the second answer plays the second answer's voice, so a
 * form with one of its two answers recorded is short of one. A form keeps
 * every answer's recordings together as well, and read that way it looked
 * recorded as soon as either was. A card written before answers had
 * recordings of their own shares the form's among them, and reads as it
 * always did.
 */
const heard = (unit: Held) => {
  const answers = answersOf(unit, answerFields());
  return answers.length > 1
    ? answers.every((a) => (a.clips || []).length > 0 || (a.slowClips || []).length > 0)
    : recorded(unit);
};
const spelt = (unit: Held) => {
  const answers = answersOf(unit, answerFields());
  return answers.length > 1 ? answers.every((a) => !!trim(a.lat)) : !!trim(unit.lat);
};

const recorded = (unit: Held) =>
  ["clips", "slowClips", "recs"].some((f) => Array.isArray(unit && unit[f]) && unit[f].length > 0);

/* ---- what the course teaches ---- */

/*
 * Which words of a sentence no card teaches, worked out for many sentences
 * at once. Looked up through the language's keys where it has them — see
 * `keyed` on LangContext — and asked of every word otherwise.
 */
export function unknownFinder(known: Held[], lang: Lang | null | undefined) {
  if (!supportsContext(lang)) return () => [] as string[];
  const keyed = lang.context.keyed;
  const MAX = 6;
  const byLength: Map<number, { keys: Set<string>; words: string[] }> = new Map();
  for (const card of known || []) {
    if (!card || isDialog(card) || isSentence(card) || kindOf(card, lang) !== "word") continue;
    for (const form of formsOf(card) as Held[]) {
      if (hasSlots(form)) continue;
      /* Each answer a form accepts is a word it teaches. */
      for (const ar of answersIn(form.ar)) {
        const len = contextTokens(ar, lang).length;
        if (!len || len > MAX) continue;
        const bucket = byLength.get(len) || { keys: new Set<string>(), words: [] };
        if (keyed) {
          const k = keyed.word(ar);
          if (k) bucket.keys.add(k);
        } else bucket.words.push(ar);
        byLength.set(len, bucket);
      }
    }
  }
  const lengths = [...byLength.keys()];
  const seen: Map<string, boolean> = new Map();
  const isKnown = (window: string, len: number): boolean => {
    const at = `${len}|${window}`;
    const had = seen.get(at);
    if (had !== undefined) return had;
    const bucket = byLength.get(len);
    const yes = !!bucket && (keyed
      ? keyed.token(window).some((k) => bucket.keys.has(k))
      : bucket.words.some((w) => lang.context.matches(window, w)));
    seen.set(at, yes);
    return yes;
  };
  const skipped: Map<string, boolean> = new Map();
  const isSkipped = (word: string) => {
    if (!skipped.has(word)) skipped.set(word, isFunctionWord(word, lang));
    return !!skipped.get(word);
  };
  const bare = (t: string) => t.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
  return (text: string): string[] => {
    const raw = contextTokens(text, lang);
    /* A blank is filled with something; it is not a word to know. */
    const tokens = raw.map((t) => (/[{}]/.test(t) ? "" : bare(t)));
    const covered = tokens.map((t) => !t || !/\p{L}/u.test(t));
    for (let i = 0; i < tokens.length; i++) {
      for (const len of lengths) {
        if (i + len > tokens.length) continue;
        const span = tokens.slice(i, i + len);
        if (span.some((t) => !t)) continue;
        if (isKnown(span.join(" "), len)) for (let k = i; k < i + len; k++) covered[k] = true;
      }
    }
    return tokens.filter((t, i) => !covered[i] && !isSkipped(t));
  };
}

/* ---- which form a sentence holds ---- */

/* The form of a word a text holds, where it holds one, trying each answer
   of each form — see bestWordIn, which the gap-fill asks too. */
export function formIn<T extends { ar: string }>(text: string, forms: T[], lang: Lang): T | undefined {
  const words = forms.flatMap((form) => answersIn(form.ar).map((word) => ({ item: form, word })));
  const found = bestWordIn(text, words, lang);
  return found ? found.item : undefined;
}

/* ---- the score ---- */

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function deckQuality(cards: Held[], options: QualityOptions): Quality {
  const { lang, pool } = options;
  const deck = (cards || []).filter(Boolean);
  const partsOf = options.partsOf || ((card: Held) => cardSentences(card, pool || [], lang));
  const byId = options.cardById || ((id: string) => (pool || []).find((c) => c && c.id === id));

  const words = deck.filter((c) => wantsSentences(c, lang));
  const said = saidIn(deck, lang);
  const scenes = deck.filter((c) => isDialog(c) && practised(c));

  /* Every sentence a form is met in, by card and by spelling. */
  const met: Map<string, Map<string, Set<string>>> = new Map();
  const toMeet: Map<string, { ar: string; need: number }[]> = new Map();
  for (const card of words) {
    toMeet.set(String(card.id), formsToMeet(card));
    met.set(String(card.id), new Map());
  }
  const credit = (cardId: string, word: string, key: string) => {
    const forms = toMeet.get(cardId);
    const into = met.get(cardId);
    if (!forms || !into) return;
    const w = trim(word);
    const form = forms.find((f) => f.ar === w || answersIn(f.ar).includes(w))
      || (supportsContext(lang) ? formIn(w, forms, lang) : undefined);
    if (!form) return;
    const set = into.get(form.ar) || new Set<string>();
    set.add(key);
    into.set(form.ar, set);
  };

  /* A link the teacher confirmed: the form of the word the sentence holds,
     in any of the ways it is written. */
  if (supportsContext(lang)) {
    for (const s of said) {
      for (const id of s.uses) {
        const forms = toMeet.get(String(id));
        if (!forms) continue;
        for (const text of s.texts) {
          const found = formIn(text, forms, lang);
          if (found) credit(String(id), found.ar, s.key);
        }
      }
    }
  }

  /* A blank: every form it can take, in the sentences review lets through. */
  const parts: Map<string, PartSentences[]> = new Map();
  for (const card of deck) {
    if (isDialog(card) && !practised(card)) continue;
    const holed = holedParts(card);
    if (!holed.length) continue;
    const lists = partsOf(card);
    parts.set(String(card.id), lists);
    const lines = linesOf(card as never) as Held[];
    holed.forEach((part, i) => {
      const list = lists[i];
      if (!list) return;
      const line = lines.indexOf(part);
      const gate = line >= 0
        ? lineGate(card, part, pickedFrom(part as never) ? byId(pickedFrom(part as never)) : null)
        : reviewOf(card);
      const at = (formsOf(card) as Held[]).indexOf(part);
      const key = line >= 0 ? `${card.id}#${line}` : at > 0 ? `${card.id}~${at}` : String(card.id);
      const own = ownSlot(part);
      for (const s of list.list) {
        if (!passes(gate, s.key)) continue;
        for (const took of Object.values(s.took)) credit(took.card, took.word, key);
        /* A verb's own sentence holds the verb in a place of its own. */
        if (own && toMeet.has(String(card.id)) && supportsContext(lang)) {
          for (const f of toMeet.get(String(card.id)) || []) {
            if (answersIn(f.ar).some((w) => findWordSpan(s.ar, w, lang))) credit(String(card.id), f.ar, key);
          }
        }
      }
    });
  }

  /* A verb's own examples, one sentence each for every form they show. */
  for (const card of words) {
    const examples = verbExamplesOf(card);
    if (!examples.length) continue;
    const cells = exampleCells(card, tensedOf(lang, card.category));
    examples.forEach((_, n) => {
      for (const cell of cells) credit(String(card.id), trim(cell.ar), `${card.id}@${n}`);
    });
  }

  /* ---- 1. words met in sentences ---- */
  const rowsFrom = (found: typeof met) => words.map((card) => {
    const forms = (toMeet.get(String(card.id)) || []).map((f) => ({
      ar: f.ar,
      need: f.need,
      met: ((found.get(String(card.id)) || new Map()).get(f.ar) || new Set()).size,
    }));
    const part = (f: { need: number; met: number }) => Math.min(f.met / f.need, 1);
    const [own, ...rest] = forms;
    const share = !own ? 0 : rest.length
      ? 0.5 * part(own) + 0.5 * (rest.reduce((t, f) => t + part(f), 0) / rest.length)
      : part(own);
    return { id: String(card.id), share, forms };
  });
  const mean = (rows: { share: number }[]) => (rows.length ? rows.reduce((t, w) => t + w.share, 0) / rows.length : 0);
  const wordRows = rowsFrom(met);
  const short = wordRows.filter((w) => w.share < 1);

  /* ---- 2. sentences well made ---- */
  const unknownIn = unknownFinder(options.known || pool || [], lang);
  const unknownOf = (s: Said) => [...new Set(s.texts.flatMap((t) => unknownIn(t)))];
  const unlinked = said.filter((s) => !s.uses.length && !s.holed);
  const strange = said.filter((s) => unknownOf(s).length > 0);
  const flawed = said.filter((s) => unlinked.includes(s) || strange.includes(s));
  /* A sentence earns its share only once it has neither flaw, so each fix
     is offered for the sentences it alone would mend, and those with both
     flaws are a fix of their own. */
  const both = unlinked.filter((s) => strange.includes(s));
  const onlyUnlinked = unlinked.filter((s) => !both.includes(s));
  const onlyStrange = strange.filter((s) => !both.includes(s));

  /* ---- the smaller checks ---- */
  /* A word form is a unit; so is a sentence, all of its versions together,
     which is short of something where any version is. */
  const units: Held[][] = [];
  for (const card of words) {
    for (const form of formsOf(card) as Held[]) {
      if (trim(form.ar) && isAsked(form as never) && !hasSlots(form)) units.push([form]);
    }
  }
  for (const s of said) if (s.units.length) units.push(s.units);
  const unrecorded = units.filter((u) => u.some((v) => !heard(v)));
  const unpictured = words.filter((c) =>
    !(formsOf(c) as Held[]).some((f) => Array.isArray(f.images) && f.images.length > 0));
  const writesApart = !!(lang && lang.script);
  const unspelt = units.filter((u) => u.some((v) => !spelt(v)));
  const reviewing = deck.filter((c) => parts.has(String(c.id)));
  const unreviewed = reviewing.filter((c) => toReview(stateFrom(c, parts.get(String(c.id)) || [])));
  /* A card is a repeat when an earlier one shares an answer and a meaning
     with it — any of each, where a card accepts several. */
  const seenWords: Set<string> = new Set();
  let repeats = 0;
  for (const c of words) {
    const w = wordOf(c);
    const keys = answersIn(w.ar).flatMap((a) =>
      splitForms(String(w.en || "")).map((e) => `${a}|${e.toLowerCase()}`));
    if (!keys.length) keys.push(`${trim(w.ar)}|${trim(w.en).toLowerCase()}`);
    if (keys.some((k) => seenWords.has(k))) repeats++;
    for (const k of keys) seenWords.add(k);
  }
  const longest = lang ? longSentenceOf(lang) : 12;
  const long = said.filter((s) => lang && s.texts.some((t) => wordCount(t, lang) > longest));

  const share = (bad: number, all: number) => (all ? 1 - bad / all : 0);
  const checks: Check[] = [
    { key: "words", weight: WORDS_POINTS, share: mean(wordRows), applies: words.length > 0 },
    { key: "sentences", weight: SENTENCES_POINTS, share: share(flawed.length, said.length), applies: words.length > 0 || said.length > 0 },
    { key: "recordings", weight: CHECK_POINTS, share: share(unrecorded.length, units.length), applies: units.length > 0 },
    { key: "pictures", weight: CHECK_POINTS, share: share(unpictured.length, words.length), applies: words.length > 0 },
    { key: "pronunciation", weight: CHECK_POINTS, share: share(unspelt.length, units.length), applies: writesApart && units.length > 0 },
    { key: "reviewed", weight: CHECK_POINTS, share: share(unreviewed.length, reviewing.length), applies: reviewing.length > 0 },
    { key: "repeats", weight: CHECK_POINTS, share: share(repeats, words.length), applies: words.length > 0 },
    { key: "long", weight: CHECK_POINTS, share: share(long.length, said.length), applies: said.length > 0 },
    { key: "scene", weight: SCENE_POINTS, share: scenes.length ? 1 : 0, applies: true },
  ];

  const empty = { score: null, checks, fixes: [], words: wordRows };
  if (!words.length && !said.length) return empty;

  /* The conversation is worth its 5 whatever else applies; the points of a
     check with nothing to measure go to the other checks that apply. */
  const rest = checks.filter((c) => c.applies && c.key !== "scene");
  const total = rest.reduce((t, c) => t + c.weight, 0);
  const scale = total ? (100 - SCENE_POINTS) / total : 0;
  const worth = (key: CheckKey) => {
    if (key === "scene") return SCENE_POINTS;
    const c = checks.find((x) => x.key === key);
    return c && c.applies ? c.weight * scale : 0;
  };
  const earned = checks.reduce((t, c) => t + worth(c.key) * c.share, 0);

  /* ---- what would raise it ---- */
  const fixes: Fix[] = [];
  const add = (key: string, gain: number, text: string) => {
    if (gain > 0.05) fixes.push({ key, gain, text });
  };
  if (short.length) {
    const lost = wordRows.reduce((t, w) => t + (1 - w.share), 0) / wordRows.length;
    add("words", worth("words") * lost,
      `${count(short.length, "word")} ${verb(short.length, "needs", "need")} more sentences in this deck. The word itself wants two, and each other form one.`);
  } else if (!said.length && words.length) {
    add("words", worth("words"), "Add sentences that use this deck's words.");
  }
  /* Links the app can see and nobody has confirmed: worth what confirming
     them all would add. Only where asked for — it reads every word of the
     deck against every sentence, which is for one deck's page and not for
     the list of all of them. */
  if (options.pending && supportsContext(lang) && said.length && words.length) {
    const more: typeof met = new Map([...met].map(([id, m]) => [id, new Map([...m].map(([ar, set]) => [ar, new Set(set)]))]));
    let n = 0;
    for (const s of said) {
      for (const card of words) {
        const id = String(card.id);
        if (s.uses.includes(id) || s.card.id === card.id) continue;
        const found = s.texts.map((t) => formIn(t, toMeet.get(id) || [], lang)).filter((f) => !!f);
        if (!found.length) continue;
        n++;
        const into = more.get(id) || new Map();
        for (const f of found) into.set(f.ar, (into.get(f.ar) || new Set()).add(s.key));
        more.set(id, into);
      }
    }
    if (n) {
      add("confirm", worth("words") * (mean(rowsFrom(more)) - mean(wordRows)),
        `${count(n, "link")} between a word and a sentence in this deck ${verb(n, "is", "are")} waiting for you to confirm, on the In context tab.`);
    }
  }
  if (said.length) {
    const sampleOf = (list: Said[]) => [...new Set(list.flatMap(unknownOf))].slice(0, 3).join(", ");
    if (onlyUnlinked.length) {
      const n = onlyUnlinked.length;
      add("unlinked", worth("sentences") * (n / said.length),
        `${count(n, "sentence")} ${verb(n, "isn't", "aren't")} linked to any word card. Say which words ${verb(n, "it teaches", "they teach")}.`);
    }
    if (onlyStrange.length) {
      const n = onlyStrange.length;
      add("unknown", worth("sentences") * (n / said.length),
        `${count(n, "sentence")} ${verb(n, "uses", "use")} a word no deck in the course teaches (${sampleOf(onlyStrange)}).`);
    }
    if (both.length) {
      const n = both.length;
      add("both", worth("sentences") * (n / said.length),
        `${count(n, "sentence")} ${verb(n, "needs", "need")} both a link to a word card and ${verb(n, "its", "their")} words taught (${sampleOf(both)}).`);
    }
  } else if (words.length) {
    add("sentences", worth("sentences"), "Add sentences: none of this deck's words can be practised inside one yet.");
  }
  add("recordings", worth("recordings") * (1 - share(unrecorded.length, units.length)),
    `${count(unrecorded.length, "word, form or sentence", "words, forms or sentences")} ${verb(unrecorded.length, "has", "have")} no recording.`);
  add("pictures", worth("pictures") * (1 - share(unpictured.length, words.length)),
    `${count(unpictured.length, "word")} ${verb(unpictured.length, "has", "have")} no picture.`);
  add("pronunciation", worth("pronunciation") * (1 - share(unspelt.length, units.length)),
    `${count(unspelt.length, "word, form or sentence", "words, forms or sentences")} ${verb(unspelt.length, "has", "have")} no pronunciation written.`);
  add("reviewed", worth("reviewed") * (1 - share(unreviewed.length, reviewing.length)),
    `${count(unreviewed.length, "card")} with blanks ${verb(unreviewed.length, "has", "have")} sentences waiting for your review.`);
  add("repeats", worth("repeats") * (1 - share(repeats, words.length)),
    `${count(repeats, "word is", "words are")} on more than one card.`);
  add("long", worth("long") * (1 - share(long.length, said.length)),
    `${count(long.length, "sentence")} ${verb(long.length, "is", "are")} longer than ${longest} words.`);
  add("scene", worth("scene") * (scenes.length ? 0 : 1), "Add a conversation or a text.");
  fixes.sort((a, b) => b.gain - a.gain);

  return { score: Math.round(earned), checks, fixes, words: wordRows };
}

/** Which colour a score is shown in. */
export const qualityTone = (score: number): "good" | "fair" | "poor" =>
  score >= GOOD_FROM ? "good" : score >= FAIR_FROM ? "fair" : "poor";
