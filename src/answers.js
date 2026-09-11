/** @import { Form } from "./types.js" */
/*
 * An accepted answer, and everything true about that answer.
 *
 * A card may accept more than one: كتاب or سفر, "office" or "desk". Each is
 * its own word — said its own way, and carrying its own grammar.
 *
 *     answers: [
 *       { text: "مَبْسوط",  lat: "mabsuut",  gender: "masculine", number: "singular" },
 *       { text: "مَبْسوطة", lat: "mabsuuta", gender: "feminine",  number: "singular" },
 *     ]
 *
 * Gender and number used to sit on the form, one set for the whole card.
 * That was wrong wherever the card accepted two answers that differ in
 * exactly those things — "I'm happy" said by a man and by a woman is one
 * thing to know with two right answers, and a single "masculine" over the
 * pair was a label that described one of them and lied about the other.
 * A learner who typed the feminine was told they had written a masculine
 * word. Whatever a language declares — number and gender in Arabic and
 * Hebrew, a classifier in Vietnamese — now belongs to the answer it is
 * about, and a form has no grammar of its own to disagree with.
 *
 * Omitted fields fall back to the form's, which is what makes the change
 * invisible to every card written so far: one answer, one set of values,
 * read from wherever they happen to be stored.
 *
 * `text` and `lat` were two delimited strings read together by position —
 * "كتاب / سفر" against "kitaab / safar" — and still are on the way to the
 * server and in an export, because that is the shape the wire and the
 * spreadsheet know. Here they are one list of objects, which is the only
 * shape in which "this answer is feminine" can be said at all.
 *
 * A plain module for the reason scheduler.js is one: it decides what is
 * accepted, and `node --test` cannot import a .jsx file.
 */

/*
 * Which fields an answer may carry, and what each will accept, is the
 * language table's business rather than this module's — so it is passed
 * in, as answerFields() builds it: [{ field, allowed }]. It travels as an
 * argument rather than being imported because languages.js reads this file
 * to mark an answer, and two modules reaching for each other is a cycle
 * that resolves to undefined at the wrong moment.
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
 * What a stored answer is allowed to be.
 *
 * The narrowing every answer passes through on its way in from storage, the
 * server or a paste. It is deliberately total rather than throwing: a
 * document is somebody's cards, and half a card read is worth more to them
 * than an exception — an unknown grammar value becomes no value, a field
 * that should be a string and is not becomes "", and anything with no text
 * left is not an answer and is dropped by the caller.
 *
 * Hand-written rather than a schema library: it is twenty lines, it runs on
 * every card of every document this app opens, and the app carries two
 * runtime dependencies. What a library would buy here is a nicer error for
 * a case where there is deliberately no error.
 */
/**
 * @param {any} raw
 * @param {{ field: string, allowed: string[] }[]} fields  See answerFields().
 * @returns {{ text: string, lat: string } & Record<string, string>}
 */
export function readAnswer(raw, fields = []) {
  const said = raw && typeof raw === "object" ? raw : {};
  /** @type {any} */
  const out = { text: str(said.text), lat: str(said.lat) };
  for (const { field, allowed } of fields) {
    const value = str(said[field]);
    if (!value) continue;
    /* Only what the language declares, and only a value it offers. A
       field nobody asked for is not carried forward — it would ride along
       through every save from here on, and the one thing a stored shape
       must not do is accumulate — and a value nobody offers is dropped
       rather than kept as a grammar nothing can read. An answer with no
       gender is the ordinary case, so dropping is a real answer, not a
       hole. */
    if (!allowed.length || allowed.includes(value)) out[field] = value;
  }
  return out;
}

/** @param {any} x */
const str = (x) => (typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim());

/*
 * A form's answers, whichever way they are stored.
 *
 * Three shapes reach this. A card saved since the change has `answers`. A
 * card saved before it — every card on every device today — has the two
 * delimited strings and one set of grammar values flat on the form. A card
 * from the server has both, because that is what is sent. All three read
 * the same here, which is what makes the migration something a document
 * can do at its own pace rather than all at once.
 *
 * An answer with no text is not an answer — a row somebody started and
 * left — so it is dropped, and whatever was sitting beside it goes too.
 */
/**
 * @param {Record<string, any> | null | undefined} form
 * @param {{ field: string, allowed: string[] }[]} [fields]
 * @returns {({ text: string, lat: string, at: number } & Record<string, any>)[]}
 */
export function answersOf(form, fields = []) {
  const held = form && /** @type {any} */ (form).answers;
  if (Array.isArray(held)) {
    const rich = held.map((raw, at) => ({ ...readAnswer(raw, fields), at })).filter((a) => a.text);
    if (form && agrees(rich, form)) return rich;
  }
  return legacyAnswers(form, fields);
}

/*
 * Whether the array still describes the strings beside it.
 *
 * `ar` and `lat` are written from the array by packAnswers and are the shape
 * the server, an export and every card list read — so they are kept, and
 * that means two places hold the words. Which one wins has to be said once,
 * out loud, or it is decided by whichever reader got there first.
 *
 * The strings win. They are what the rest of the app edits — a CSV import
 * writes them, a card arrives from the server carrying them — and an array
 * that no longer matches is a stale cache of a card that has moved on,
 * carrying grammar for answers that may not be there any more. Falling back
 * loses the per-answer grammar for that one edit, which is the smaller
 * wrong: the alternative is a card whose text says one thing and whose
 * grammar describes another.
 */
/**
 * @param {{ text: string, lat: string }[]} rich
 * @param {Record<string, any>} form
 */
function agrees(rich, form) {
  const text = splitAlternatives(form.ar).filter(Boolean);
  if (rich.length !== text.length) return false;
  if (rich.some((a, i) => a.text !== text[i])) return false;
  /* The transliterations too, where the form carries any: a form whose
     `lat` was cleared has had its pronunciations cleared, whatever the
     array still remembers. */
  const said = splitAlternatives(form.lat);
  return rich.every((a, i) => a.lat === (said[i] || ""));
}

/*
 * The old shape, read as the new one.
 *
 * Two delimited strings paired by position, and the form's own grammar
 * values on every answer — which is exactly what they meant when there was
 * only one set of them. A card with one answer comes through unchanged in
 * every particular, which is the whole test of a migration.
 */
/**
 * @param {Record<string, any> | null | undefined} form
 * @param {{ field: string, allowed: string[] }[]} [fields]
 */
export function legacyAnswers(form, fields = []) {
  const script = splitAlternatives(form && form.ar);
  const said = splitAlternatives(form && form.lat);
  const { text: _text, lat: _lat, ...shared } = readAnswer(form, fields);
  return script
    .map((text, at) => ({ ...shared, text, lat: said[at] || "", at }))
    .filter((a) => a.text);
}

/* Kept under its old name for the one thing that still speaks in pairs: the
   answer's script, which the rest of the app calls `ar`. */
/** @param {{ text: string }} answer */
export const textOf = (answer) => (answer && answer.text) || "";

/* The answers that can carry a question about pronunciation: both halves
   written. A card with two spellings and one transliteration has one. */
/**
 * @param {Record<string, any> | null | undefined} form
 * @param {{ field: string, allowed: string[] }[]} [fields]
 */
export const saidAnswers = (form, fields = []) => answersOf(form, fields).filter((a) => a.lat);

/*
 * One accepted answer, as a form.
 *
 * Handed to the question in place of the whole card, so the prompt, the
 * marking and the answer screen are all looking at the same one — none of
 * them has to be told which, and none of them can disagree. Everything
 * else about the form travels with it: it is the same card, narrowed to
 * the answer being asked about, grammar included. Which is what puts the
 * right "· f." beside a question that asked for the feminine.
 */
/**
 * @template {Record<string, any>} T
 * @param {T} form
 * @param {(Record<string, any> & { text?: string, lat?: string }) | null | undefined} answer
 * @returns {T}
 */
export function withAnswer(form, answer) {
  if (!answer) return form;
  const { text, lat, at: _at, ...rest } = answer;
  return { ...form, ...rest, ar: text || "", lat: lat || "", answers: [answer] };
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
 * @param {{ field: string, allowed: string[] }[]} [fields]
 */
export function answerForTurn(form, turn = 0, fields = []) {
  const said = saidAnswers(form, fields);
  if (!said.length) return null;
  const at = Math.abs(Math.round(Number(turn) || 0)) % said.length;
  return said[at];
}

/*
 * Which answer the learner actually gave.
 *
 * The answer screen has something to say about the one they wrote — that it
 * was the feminine, that it was the plural — and it can only say it of the
 * answer that matched. Compared through the language's own checker, because
 * "right" here means what it means everywhere else: bare letters count, and
 * a near miss is not a match.
 */
/**
 * @param {string} typed
 * @param {Record<string, any> | null | undefined} form
 * @param {(given: string, expected: string) => boolean} matches
 * @param {{ field: string, allowed: string[] }[]} [fields]
 */
export function answerGiven(typed, form, matches, fields = []) {
  if (!String(typed || "").trim()) return null;
  return answersOf(form, fields).find((a) => matches(typed, a.text)) || null;
}

/*
 * Answers back into what a card stores.
 *
 * The editor's way out, and the storage boundary's. Rows with no text are
 * dropped whole. The two delimited strings come back alongside the array
 * because the server, an export and every card list still read them — they
 * are derived here, at the one place answers are written, so they cannot
 * drift from what they are derived from.
 */
/**
 * @param {Record<string, any>[]} rows
 * @param {{ field: string, allowed: string[] }[]} [fields]
 * @returns {{ ar: string, lat: string, answers: Record<string, any>[] }}
 */
export function packAnswers(rows, fields = []) {
  const kept = (rows || [])
    .map((row) => readAnswer(row, fields))
    .filter((a) => a.text);
  return {
    ar: joinAlternatives(kept.map((a) => a.text)),
    lat: joinAlternatives(kept.map((a) => a.lat)),
    answers: kept,
  };
}

/*
 * The rows an editor shows for a form: never none, so there is always
 * somewhere to type. A blank card opens on one empty row rather than on a
 * button that makes one.
 */
/**
 * @param {Record<string, any> | null | undefined} form
 * @param {{ field: string, allowed: string[] }[]} [fields]
 * @returns {Record<string, any>[]}
 */
export function answerRows(form, fields = []) {
  const rows = answersOf(form, fields).map(({ at: _at, ...rest }) => rest);
  return rows.length ? rows : [{ text: "", lat: "" }];
}
