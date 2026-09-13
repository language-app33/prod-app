/*
 * A verb's forms, as a table over the card's own sub-forms.
 *
 * A verb is not one thing to know. "To eat" in Palestinian Arabic is a
 * dozen words depending on who is eating and when; in Huế it is one word
 * with a marker in front. What a learner needs is not the dictionary form
 * but the one that fits the sentence they are about to say.
 *
 * The table is a **view over sub-forms**, not a new kind of storage. A
 * card's `subs` are already the thing this wants: alternate forms, each
 * drilled on its own, each with its own recordings and its own progress.
 * A cell is one of those with two fields saying where it sits:
 *
 *     subs: [
 *       { id, ar: "أكلت",  en: "she ate",  lat: "akalat", row: "past", col: "she" },
 *       { id, ar: "بتاكلي", en: "you (f) eat", lat: "btākli", row: "present", col: "you-f" },
 *     ]
 *
 * Everything a cell needs — scheduling, marking, sync, recordings, the
 * card list, the export — therefore already works, and none of it had to
 * learn what a verb is. What is left, and what is here, is: where the rows
 * and columns come from, what a cell's English says, which cell a subject
 * calls for, and which rows are open yet.
 *
 * Which rows and columns exist is the language's answer, never this
 * module's. Arabic declares seven persons and three tenses; Huế declares
 * one person and four; a language that declares none has no verb tables
 * and every function here comes back empty. Nothing below knows what a
 * tense is — only that a table has two axes, that the rows are in the
 * order they are taught, and that a cell is one thing to learn.
 *
 * A module of its own, importing nothing, for the reason answers.ts and
 * variables.ts are: it decides what a verb card holds, so it is somewhere
 * a test can reach and somewhere nothing can reach back into.
 */
import type { Form, VerbPerson, VerbSpec, VerbTense } from "./types.ts";

/*
 * Everything below takes `unknown` and narrows it here.
 *
 * The same questions are asked of a stored card, of one of its sub-forms,
 * of a CardForm on its way to the server, and of the half-written thing in
 * an editor — four types that agree about nothing a compiler can see. The
 * alternative is an open record, which the two of them that carry no index
 * signature would fail, or a cast at every call site, which is the same
 * unchecked read written thirty times instead of once.
 *
 * So this is the narrowing boundary, in the way readAnswer is one: reading
 * a field off a value nothing has vouched for is exactly what it is for,
 * and a value that is not what it should be reads as absent rather than
 * throwing. A card is somebody's work, and half a table read is worth more
 * to them than an exception.
 */
const str = (x: unknown): string =>
  typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim();

/** One field off something nothing has vouched for. */
const field = (form: unknown, name: string): unknown =>
  form && typeof form === "object" ? (form as Record<string, unknown>)[name] : undefined;

/** Where a sub-form sits in the table, or "" when it is not a cell. */
export const rowOf = (form: unknown): string => str(field(form, "row"));
export const colOf = (form: unknown): string => str(field(form, "col"));

/**
 * Whether a sub-form is a cell of a table at all.
 *
 * Both halves, because one without the other places nothing: a sub-form
 * carrying only a row is an ordinary alternate form that happens to have a
 * stray field, and guessing a column for it would put a word in the table
 * under a person nobody said it was.
 */
export const isCell = (form: unknown): boolean => !!rowOf(form) && !!colOf(form);

/**
 * The cells of a card, in no particular order.
 *
 * Read off `subs` rather than a list of its own, so there is one place a
 * form lives and no second copy to fall out of step. A card with no cells
 * is every card written before this existed, and comes back empty.
 */
export function cellsOf(card: unknown): Form[] {
  const subs = field(card, "subs");
  if (!Array.isArray(subs)) return [];
  return (subs as Form[]).filter((sub) => isCell(sub));
}

/** Whether the card is a verb card: it has at least one form in a table. */
export const isVerb = (card: unknown): boolean => cellsOf(card).length > 0;

/**
 * The hole a verb card leaves for itself in its own sentence.
 *
 * A verb card may carry a sentence with its own place marked and holes
 * around it — "{{name}} {{verb}} {{object}}" — and what goes in that place
 * is decided by what goes in the others: Sarah wants the *she* form,
 * Ahmad the *he* form, the children the *they* form. So it is a slot like
 * any other to everything that reads a sentence, and the one slot no card
 * fills, because the card fills it out of its own table.
 *
 * A name rather than a syntax of its own, so a teacher writing one is
 * writing the thing they already know how to write, and every reader of a
 * sentence — the editor's own check that the three fields agree about
 * their holes, most of all — goes on working without being told.
 */
export const VERB_SLOT = "verb";

/**
 * A sentence the card asks itself in, rather than one of its cells.
 *
 * A row and no column: the row says when it happened, which is the frame's
 * to fix — a sentence that opens "Yesterday" wants the past whoever is in
 * it — while the column is the subject's and is not known until the
 * sentence is filled. A cell has both; an ordinary alternate form has
 * neither.
 */
export const isFrame = (form: unknown): boolean => !!rowOf(form) && !colOf(form);

/** The sentences a card asks itself in. */
export function framesOf(card: unknown): Form[] {
  const subs = field(card, "subs");
  if (!Array.isArray(subs)) return [];
  return (subs as Form[]).filter((sub) => isFrame(sub));
}

/**
 * Which hole the verb agrees with: the first one that is not its own.
 *
 * The subject, in every sentence anybody writes — "{{name}} {{verb}}
 * {{object}}" — and taken by position rather than asked for, because a
 * teacher who has just written the sentence has already said which comes
 * first and should not have to say it twice in a menu.
 *
 * "" where the sentence has no other hole, which is a sentence whose verb
 * agrees with nothing and cannot be filled.
 */
export const subjectSlot = (slots: string[]): string =>
  (slots || []).find((slot) => slot !== VERB_SLOT) || "";

/**
 * The form in one cell, or null where the language has no such form and
 * the teacher left it blank.
 *
 * A blank is not a hole to be filled later so much as a fact about the
 * language — there is no command for "I" — and it is never asked. Where
 * two sub-forms claim the same cell, the first wins: a card can only be
 * in that state by being edited somewhere that does not know about
 * tables, and picking one beats showing both.
 */
export function cellAt(
  card: unknown,
  row: string,
  col: string,
): Form | null {
  const want = { row: str(row), col: str(col) };
  if (!want.row || !want.col) return null;
  return cellsOf(card).find((c) => rowOf(c) === want.row && colOf(c) === want.col) || null;
}

/* ---- the axes, as the language declares them ---- */

/** The rows, in the order the language teaches them. Empty where it has none. */
export const tensesOf = (spec: VerbSpec | null | undefined): VerbTense[] =>
  (spec && Array.isArray(spec.tenses) ? spec.tenses : []).filter((t) => t && str(t.id));

/** The columns. A language whose verbs do not vary by person declares one. */
export const personsOf = (spec: VerbSpec | null | undefined): VerbPerson[] =>
  (spec && Array.isArray(spec.persons) ? spec.persons : []).filter((p) => p && str(p.id));

const tenseAt = (spec: VerbSpec | null | undefined, row: string): VerbTense | null =>
  tensesOf(spec).find((t) => t.id === str(row)) || null;

const personAt = (spec: VerbSpec | null | undefined, col: string): VerbPerson | null =>
  personsOf(spec).find((p) => p.id === str(col)) || null;

/**
 * What to call one cell, in the learner's own language.
 *
 * "she" and "ate" make "she ate", which is what the learner is asked —
 * never "to eat · she · past", which names a place in a table rather than
 * a thing anybody says.
 *
 * Composed rather than stored **only as a starting point**: the editor
 * writes the result onto the cell, the cell keeps it, and a teacher who
 * needs something else types it. That matters because this cannot be
 * right everywhere on its own — English says "she eats" where it says "I
 * eat", and a rule for that would be a rule about English living in a file
 * that is supposed not to know any language. So the app proposes, the
 * teacher disposes, and what is asked is always the words on the cell.
 *
 * A person with no label of its own — the single column of a language
 * whose verbs do not vary — contributes nothing, and the row's English
 * stands alone.
 */
export function composeEnglish(
  spec: VerbSpec | null | undefined,
  row: string,
  col: string,
  rowEnglish: string,
): string {
  const said = str(rowEnglish);
  if (!said) return "";
  const person = personAt(spec, col);
  const who = person ? str(person.label) : "";
  if (!who) return said;
  /* Where a row says how to join it — a command is "you (m): eat!" rather
     than "you (m) eat!" — the language says so once, on the row. Read
     without trimming, unlike everything else here: the whole of what a
     separator says is often its spaces, and ": " trimmed to ":" is the
     punctuation without the gap it was written for. */
  const tense = tenseAt(spec, row);
  const join = tense && typeof tense.join === "string" && tense.join ? tense.join : " ";
  return `${who}${join}${said}`;
}

/* ---- agreement: which cell a subject calls for ---- */

/**
 * The column a filler's grammar calls for, or null where nothing does.
 *
 * This is what makes a verb card's own sentence agree with what fills it.
 * "{{name}} [verb] {{object}}" filled with Sarah wants the *she* form,
 * with Ahmad the *he* form, with the children the *they* form — and the
 * app works that out from the grammar already recorded on the filler's
 * answer, so a name needs nothing added to it.
 *
 * The language says which values pick which column, by writing them on
 * the column:
 *
 *     { id: "she", label: "she", picks: { number: "singular", gender: "feminine" } }
 *
 * A column with no `picks` is never chosen this way, which is the right
 * answer for "I", "you" and "we": no noun dropped into a subject is ever
 * the first or second person, and a frame that wants one says so itself.
 *
 * The most specific match wins — a column asking for number *and* gender
 * beats one asking for number alone — so a language can declare a general
 * column and a narrower one without ordering them by hand. Ties go to
 * whichever the language declared first.
 */
export function personFor(
  spec: VerbSpec | null | undefined,
  grammar: Record<string, unknown> | null | undefined,
): VerbPerson | null {
  const had = grammar || {};
  let best: VerbPerson | null = null;
  let bestAt = -1;
  for (const person of personsOf(spec)) {
    const picks = person.picks;
    if (!picks) continue;
    const keys = Object.keys(picks);
    if (!keys.length) continue;
    if (!keys.every((key) => str(had[key]) === str(picks[key]))) continue;
    if (keys.length > bestAt) {
      best = person;
      bestAt = keys.length;
    }
  }
  return best;
}

/**
 * The form a sentence should stand in its verb's place, this time round.
 *
 * The row is the frame's — a sentence that starts "Yesterday" wants the
 * past, whatever fills it — and the column is the subject's, by the rule
 * above. Null where the pair names a cell the teacher left blank, which
 * is the caller's cue not to ask this sentence of this filler at all.
 */
export function agreedCell(
  card: unknown,
  spec: VerbSpec | null | undefined,
  row: string,
  grammar: Record<string, unknown> | null | undefined,
): Form | null {
  const person = personFor(spec, grammar);
  if (!person) return null;
  return cellAt(card, row, person.id);
}

/* ---- the gate: one tense of a verb is ever new at a time ---- */

/**
 * The rows a learner has reached, in teaching order.
 *
 * The rows are not as hard as each other and should not arrive together:
 * somebody who can say what they *do* has something to hang the past on,
 * and somebody handed present, past and future in one week has three
 * tables to confuse. So a row opens only once the row above it is
 * **mastered** — every cell of it, by whatever test the caller applies,
 * which is the same bar a level already asks of the level below it.
 *
 * The first row is always open, so a verb is never stuck at the gate. A
 * row the teacher left entirely blank is passed straight through, the way
 * a level a card has no material for is: there is nothing there to master,
 * and stopping at it would close the rows below it for ever.
 *
 * A lapse needs no code here. The caller's `mastered` reads the cell's
 * state as it now is, so a row that falls back closes the rows under it by
 * the same rule that opened them.
 */
export function openRows(
  card: unknown,
  spec: VerbSpec | null | undefined,
  mastered: (cell: Form) => boolean,
): string[] {
  const open: string[] = [];
  for (const tense of tensesOf(spec)) {
    open.push(tense.id);
    const cells = cellsOf(card).filter((c) => rowOf(c) === tense.id);
    /* Nothing to master here, so the next row is not kept waiting on it. */
    if (!cells.length) continue;
    if (!cells.every((cell) => mastered(cell))) break;
  }
  return open;
}

/**
 * Whether one cell is open to be asked at all.
 *
 * The question every caller that deals a question actually has, and the
 * reason openRows above comes back as a list rather than a count: a cell
 * of a row nobody has reached is not a hard question, it is one that
 * should not be on the table yet.
 */
export function cellIsOpen(
  card: unknown,
  spec: VerbSpec | null | undefined,
  cell: unknown,
  mastered: (cell: Form) => boolean,
): boolean {
  if (!isCell(cell)) return true;
  return openRows(card, spec, mastered).includes(rowOf(cell));
}

/**
 * Every cell a card could hold, filled or not, in teaching order.
 *
 * What the teacher's grid is drawn from, and the one place the two axes
 * are crossed. Row by row, and within a row in the order the language
 * lists its persons, so `I` and `you` come before `they` wherever a
 * caller deals from this.
 */
export function tableOf(
  card: unknown,
  spec: VerbSpec | null | undefined,
): { row: string; col: string; tense: VerbTense; person: VerbPerson; form: Form | null }[] {
  const out = [];
  for (const tense of tensesOf(spec)) {
    for (const person of personsOf(spec)) {
      out.push({
        row: tense.id,
        col: person.id,
        tense,
        person,
        form: cellAt(card, tense.id, person.id),
      });
    }
  }
  return out;
}

/** How many cells the teacher has filled in, and how many they left blank. */
export function tableCount(
  card: unknown,
  spec: VerbSpec | null | undefined,
): { filled: number; blank: number } {
  const all = tableOf(card, spec);
  const filled = all.filter((c) => c.form && str(c.form.ar)).length;
  return { filled, blank: all.length - filled };
}
