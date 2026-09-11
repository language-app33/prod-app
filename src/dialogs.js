/** @import { Form, Item } from "./types.js" */
/*
 * Dialogs: a card that holds a conversation.
 *
 * A word card teaches a word. A phrase card gives that word somewhere it
 * turned up. A dialog gives it someone to say it to and something that
 * comes back — the part of a language no flashcard has ever held.
 *
 * A dialog is one card. It carries its speakers, its lines in order, and
 * which speaker the learner plays; each line carries the same three fields
 * every form of a card carries — the script, the meaning, the second
 * writing — plus its own progress, so a line is drilled in its own right
 * exactly as a plural is.
 *
 *     {
 *       kind: "dialog",
 *       en: "At the door",            the scene, in the learner's language
 *       note: "Two neighbours meet",  the setting, if it needs one
 *       speakers: ["Layla", "Karim"],
 *       you: 1,                       the part the learner takes
 *       lines: [{ id, who: 0, ar, lat, en, recs, uses, s }, ...],
 *     }
 *
 * Nothing here needs a recording. A scene with no sound in it is the
 * ordinary case, not a broken one: every exercise below is asked with
 * words on a screen, and a recording — where a teacher happens to have one
 * — is a second route to a question that already exists, which is how the
 * app already treats hearing a word against reading it.
 *
 * This is a plain module for the same reason scheduler.js is: `node --test`
 * cannot import a .jsx file, so anything that decides what a learner is
 * asked belongs somewhere a test can reach. Nothing here reads the DOM,
 * React state, or any module-level mutable, and nothing picks at random:
 * which three replies are offered and which order the lines arrive in are
 * both worked out from the ids, so a re-render is the same question.
 */

export const DIALOG_KIND = "dialog";

/* Two people, unless a scene says otherwise. Named A and B rather than
   left unnamed: a line belongs to somebody, and "A" is a worse name than
   "Layla" but a better one than nothing. */
export const DEFAULT_SPEAKERS = ["A", "B"];

/* More than four people in a short scene stops being a conversation and
   starts being a play, and every one of them costs a column in the
   editor. */
export const MAX_SPEAKERS = 4;

/* What a scene needs before each exercise is worth asking. Ordering three
   lines is a puzzle; ordering two is a coin toss, and picking a reply
   with only one other line to offer is the same. */
export const MIN_ORDER_LINES = 3;
export const MIN_PICK_LINES = 3;

/* How many replies "Pick the reply" puts up, the right one included. */
export const PICK_OPTIONS = 4;

/* The learner's ordering, and their turns, both travel as one string —
   the answer box holds a string, and every other exercise's answer is one
   too. These are the separators, kept here so the reader and the writer
   cannot disagree about them. */
export const ORDER_SEP = "|";
/* A newline, because a turn is typed into a single-line box and a person
   therefore cannot put one inside an answer. A space could not say that:
   half the answers in this app have a space in them. */
export const PART_SEP = "\n";

/* Everything here takes a plain record rather than an Item: the same
   questions are asked of a stored card, of one of its lines, and of the
   half-written draft in the editor, and only the first of those is an
   Item. What each one reads is named in the comment above it. */
/** @param {Record<string, any> | null | undefined} it */
export const isDialog = (it) =>
  !!it && /** @type {any} */ (it).kind === DIALOG_KIND && linesOf(it).length > 0;

/** @param {Record<string, any> | null | undefined} it @returns {any[]} */
export const linesOf = (it) => (it && /** @type {any} */ (it).lines) || [];

/** @param {Record<string, any> | null | undefined} it @returns {string[]} */
export function speakersOf(it) {
  const named = (it && /** @type {any} */ (it).speakers) || [];
  const out = named.map((/** @type {unknown} */ n) => String(n || "").trim()).filter(Boolean);
  return out.length ? out.slice(0, MAX_SPEAKERS) : DEFAULT_SPEAKERS.slice();
}

/* Who said it. A line whose speaker has been deleted since falls back to
   the first, which is wrong in a way that is visible rather than a crash
   in a way that is not. */
/**
 * @param {Record<string, any> | null | undefined} it
 * @param {number} who
 */
export function speakerName(it, who) {
  const names = speakersOf(it);
  return names[who] || names[0];
}

/*
 * The part the learner takes.
 *
 * The second speaker by default, because a scene is written the way it is
 * met: somebody says something and you answer. A card may name another,
 * and one that names a speaker who no longer exists gets the last one
 * rather than a blank part.
 */
/** @param {Record<string, any> | null | undefined} it */
export function youOf(it) {
  const names = speakersOf(it);
  const said = Number((it && /** @type {any} */ (it).you) ?? 1);
  if (!Number.isFinite(said)) return Math.min(1, names.length - 1);
  return Math.max(0, Math.min(names.length - 1, Math.round(said)));
}

/** @param {Record<string, any> | null | undefined} it */
export const yourLines = (it) => linesOf(it).filter((l) => (l.who || 0) === youOf(it));

/* Where a line stands in its scene, and which scene that is. Built from
   the whole card list rather than kept on the line, so a line never holds
   a pointer back to its own card that an edit could leave stale. */
/**
 * @param {Item[]} items
 * @returns {Map<string, { card: Item, at: number }>}
 */
export function buildDialogIndex(items) {
  /** @type {Map<string, { card: Item, at: number }>} */
  const index = new Map();
  for (const card of items || []) {
    if (!isDialog(card)) continue;
    linesOf(card).forEach((line, at) => {
      if (line && line.id) index.set(line.id, { card, at });
    });
  }
  return index;
}

/* The lines a learner has already heard when this one is asked. The
   question is "what do you say now", so what came before is the question
   and what comes after would be the answer to a different one. */
/**
 * @param {Record<string, any> | null | undefined} card
 * @param {number} at
 */
export const sceneBefore = (card, at) => linesOf(card).slice(0, Math.max(0, at));

/* The line just before this one: the thing actually being answered. */
/**
 * @param {Record<string, any> | null | undefined} card
 * @param {number} at
 */
export const cueFor = (card, at) => (at > 0 ? linesOf(card)[at - 1] : null);

/*
 * Every line of every dialog, in the shape a phrase card has.
 *
 * A dialog line and a teacher's phrase are the same thing to the rest of
 * the app: a run of words that contains a word being learnt, with a note
 * of which words those are. Handing them over in one shape is what lets a
 * scene stand in for a phrase in the gap-fill without the gap-fill
 * knowing what a dialog is.
 */
/** @param {Item[]} items */
export function dialogPhrases(items) {
  const out = [];
  for (const card of items || []) {
    if (!isDialog(card)) continue;
    for (const line of linesOf(card)) {
      if (!line.ar || !(line.uses || []).length) continue;
      out.push({
        id: line.id,
        ar: line.ar,
        en: line.en,
        recs: line.recs || [],
        uses: line.uses || [],
        lang: line.lang || card.lang,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------
   Deciding without rolling a die

   Which replies are offered, and which order a scrambled scene arrives
   in, are worked out from the ids involved. A re-render is then the same
   question — React renders twice in development and a shuffled list that
   reshuffled under the learner's finger would be the app's fault.
   ------------------------------------------------------------------ */

/** @param {string} str */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Sorted by what each item hashes to against the seed: the same list and
   the same seed give the same order, and a different seed gives another
   one. Ties break on the key itself, so the result never depends on how
   the input list happened to be ordered. */
/**
 * @template T
 * @param {T[]} list
 * @param {string} seed
 * @param {(x: T) => string} keyOf
 * @returns {T[]}
 */
export function shuffledBy(list, seed, keyOf) {
  return list
    .map((x) => ({ x, k: keyOf(x), h: hash(`${seed} ${keyOf(x)}`) }))
    .sort((a, b) => a.h - b.h || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((e) => e.x);
}

/*
 * The replies on offer.
 *
 * The right one, and three others a learner could believe: lines from
 * this scene first, because a wrong answer that was said two turns ago is
 * a real mistake to make, then lines from other scenes to fill up. A
 * reply that reads the same as the right one is dropped — being marked
 * wrong for choosing the correct words is the one unforgivable question.
 */
/**
 * @param {{ card: Record<string, any>, at: number, pool?: any[], wanted?: number }} args
 * @returns {any[]}
 */
export function replyOptions({ card, at, pool = [], wanted = PICK_OPTIONS }) {
  const lines = linesOf(card);
  const answer = lines[at];
  if (!answer) return [];
  const taken = new Set([norm(answer.ar)]);
  /** @type {any[]} */
  const others = [];
  for (const cand of lines.concat(pool)) {
    if (!cand || cand.id === answer.id || !cand.ar) continue;
    const key = norm(cand.ar);
    if (taken.has(key)) continue;
    taken.add(key);
    others.push(cand);
  }
  const seed = `${card.id} ${answer.id}`;
  const wrong = shuffledBy(others, seed, (l) => l.id).slice(0, Math.max(0, wanted - 1));
  return shuffledBy(wrong.concat([answer]), `${seed} place`, (l) => l.id);
}

/** @param {string} s */
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

/* The scene, out of order. Held to a shuffle that is actually one: a
   scrambled list that comes back in the order it went in is not a
   puzzle, so the seed is walked until something moves. */
/** @param {Record<string, any> | null | undefined} card */
export function scrambledLines(card) {
  const lines = linesOf(card);
  if (lines.length < 2) return lines.slice();
  for (let n = 0; n < 8; n++) {
    const out = shuffledBy(lines, `${card && card.id} scramble${n}`, (l) => l.id);
    if (out.some((l, i) => l.id !== lines[i].id)) return out;
  }
  return lines.slice().reverse();
}

/** @param {any[]} lines */
export const orderOf = (lines) => lines.map((l) => l.id).join(ORDER_SEP);

/* Right when the ids come back in the order the scene was written in. */
/**
 * @param {string} typed
 * @param {Record<string, any> | null | undefined} card
 */
export const orderIsRight = (typed, card) =>
  !!typed && typed === orderOf(linesOf(card));

/*
 * Playing a part: every turn the learner's speaker takes, in one go.
 *
 * The turns travel as one string because that is what the answer box
 * holds, and they are marked together because holding up your end of a
 * conversation is one thing rather than four. Missing one is missing it.
 */
/** @param {string[]} answers */
export const partOf = (answers) => answers.join(PART_SEP);

/** @param {string} typed */
export const partAnswers = (typed) => String(typed || "").split(PART_SEP);

/*
 * Whether a scene supports an exercise at all.
 *
 * Read as a list rather than a set of ifs because availableTypes asks it
 * once per type per card, and because what each exercise needs is worth
 * being able to read in one place.
 */
/**
 * @param {string} need
 * @param {{ card: Item, at: number } | null} scene
 * @param {Record<string, any>} unit
 */
export function dialogNeedMet(need, scene, unit) {
  if (need === "dialog") return isDialog(unit);
  if (need === "line") return !!scene;
  /* Something has to have been said before there is a reply to make. */
  if (need === "reply") return !!scene && scene.at > 0;
  if (need === "choices") return !!scene && linesOf(scene.card).length >= MIN_PICK_LINES;
  if (need === "order") return linesOf(unit).length >= MIN_ORDER_LINES;
  /* A part to play, and somebody to play it against. */
  if (need === "part") return yourLines(unit).length > 0 && linesOf(unit).length >= 2;
  return false;
}

export const DIALOG_NEEDS = ["dialog", "line", "reply", "choices", "order", "part"];

/*
 * What a unit is, as far as the exercise table is concerned.
 *
 * Three answers: a dialog card, a line inside one, or an ordinary word or
 * form. Exercises declare which of the three they are for, so a word
 * exercise can never be asked of a scene and a scene exercise can never
 * be asked of a word.
 */
/**
 * @param {Record<string, any> | null | undefined} unit
 * @param {{ card: Item, at: number } | null} [scene]
 */
export function roleOf(unit, scene = null) {
  if (isDialog(unit)) return "card";
  if (scene) return "line";
  return "word";
}
