/** @import { Form } from "./types.js" */
/*
 * What a field accepts, and which transliteration goes with which answer.
 *
 * A card may accept more than one answer: كتاب or سفر, "office" or "desk".
 * They are stored as one string with " / " between them — the convention
 * every card already uses and the one the checker splits on — and edited as
 * one row per answer.
 *
 * The transliteration is stored the same way, and the two lists are read
 * together: the first transliteration belongs to the first answer, the
 * second to the second. Nothing else would do. A card accepting كتاب and
 * سفر is a card with two pronunciations, and a single "kitaab" hanging off
 * the pair is either wrong about one of them or an invitation to mark the
 * wrong thing right — ask "write safar in Arabic", accept كتاب, and the
 * question taught nothing.
 *
 *     ar:  "كتاب / سفر"
 *     lat: "kitaab / safar"
 *
 * Position is the whole of the link, which is what keeps this simple: no
 * new field, no migration, and a card with one answer and one
 * transliteration — every card written so far — already reads correctly.
 * What position costs is that the two lists must not drift, so the pairing
 * is made here, once, and the editor writes them back through `packAnswers`
 * rather than by hand.
 *
 * A plain module for the reason scheduler.js is one: it decides what is
 * accepted, and `node --test` cannot import a .jsx file.
 */

/* Split on / or ; because both were accepted when the convention was typed
   by hand; joined with / only. */
export const ALT_SEP = " / ";
const ALT_SPLIT = /[/;]/;

/*
 * The answers a field holds, in order, blanks and all.
 *
 * Blanks are kept because position is the link: a form whose second answer
 * has no transliteration yet stores " / safar" for the first one's sake,
 * and dropping the hole would hand "safar" to the wrong word.
 */
/** @param {string | null | undefined} value @returns {string[]} */
export function splitAlternatives(value) {
  return String(value || "").split(ALT_SPLIT).map((x) => x.trim());
}

/* Back to one string. Trailing blanks go — they are rows nobody filled in —
   and any blank before a filled one stays, because it is holding a place. */
/** @param {(string | null | undefined)[]} list @returns {string} */
export function joinAlternatives(list) {
  const out = (list || []).map((x) => String(x || "").trim());
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join(ALT_SEP);
}

/*
 * The accepted answers of a form, each with its own transliteration.
 *
 * An answer with no script is not an answer — a row somebody started and
 * left — so it is dropped, and with it whatever transliteration was sitting
 * beside it. Every screen that shows or marks a specific answer reads this
 * rather than splitting the two fields for itself, because two splitters
 * are two chances to pair them differently.
 */
/**
 * @param {Record<string, any> | null | undefined} form
 * @returns {{ ar: string, lat: string, at: number }[]}
 */
export function answersOf(form) {
  const script = splitAlternatives(form && form.ar);
  const said = splitAlternatives(form && form.lat);
  return script
    .map((ar, at) => ({ ar, lat: said[at] || "", at }))
    .filter((a) => a.ar);
}

/* The pairs that can carry a question about pronunciation: both halves
   written. A card with two spellings and one transliteration has one. */
/** @param {Record<string, any> | null | undefined} form */
export const saidAnswers = (form) => answersOf(form).filter((a) => a.lat);

/*
 * One accepted answer, as a form.
 *
 * Handed to the question in place of the whole card, so the prompt, the
 * marking and the answer screen are all looking at the same one — none of
 * them has to be told which, and none of them can disagree. Everything
 * else about the form travels with it: it is the same card, narrowed to
 * the answer being asked about.
 */
/**
 * @template {Record<string, any>} T
 * @param {T} form
 * @param {{ ar: string, lat: string } | null | undefined} answer
 * @returns {T}
 */
export function withAnswer(form, answer) {
  if (!answer) return form;
  return { ...form, ar: answer.ar, lat: answer.lat };
}

/*
 * Which answer a question about pronunciation is about, this time round.
 *
 * Rotated by how often the exercise has been asked of this form — the same
 * rule as the phrase a word is shown in and the part a scene is played
 * from — so a card with two spellings is drilled on both, one at a time,
 * and the question on screen does not change under a re-render. Nothing is
 * drawn at random: `turn` is a count, so the same count is the same
 * question.
 *
 * Nothing comes back when no answer has a transliteration: there is no
 * such question to ask, and the exercise is not offered (see unmetNeeds).
 */
/**
 * @param {Record<string, any> | null | undefined} form
 * @param {number} [turn]
 * @returns {{ ar: string, lat: string, at: number } | null}
 */
export function answerForTurn(form, turn = 0) {
  const said = saidAnswers(form);
  if (!said.length) return null;
  const at = Math.abs(Math.round(Number(turn) || 0)) % said.length;
  return said[at];
}

/*
 * Pairs back into the two strings a card stores.
 *
 * The editor's way out. Rows with no script are dropped whole, so the two
 * strings that come back are the same length and in step — which is the one
 * thing that can go wrong with pairing by position, prevented at the only
 * place either string is written.
 */
/**
 * @param {{ ar?: string, lat?: string }[]} pairs
 * @returns {{ ar: string, lat: string }}
 */
export function packAnswers(pairs) {
  const kept = (pairs || []).filter((p) => String((p && p.ar) || "").trim());
  return {
    ar: joinAlternatives(kept.map((p) => p.ar)),
    lat: joinAlternatives(kept.map((p) => p.lat)),
  };
}

/*
 * The rows an editor shows for a form: never none, so there is always
 * somewhere to type. A blank card opens on one empty row rather than on a
 * button that makes one.
 */
/** @param {Record<string, any> | null | undefined} form */
export function answerRows(form) {
  const script = splitAlternatives(form && form.ar);
  const said = splitAlternatives(form && form.lat);
  const rows = script.map((ar, at) => ({ ar, lat: said[at] || "" }));
  return rows.length ? rows : [{ ar: "", lat: "" }];
}
