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
 * Whose table this cell is in: the id of the form it is a form of, or ""
 * for the card's own word.
 *
 * A verb's table is the card's — one table per card, and the card's word is
 * the verb — so every cell of one answers "". The pronouns a word takes on
 * its end are not like that: they are a property of a *form*, because the
 * plural takes the same endings as the singular and has its own eight of
 * them. So each form carries its own table, and a cell says which form's.
 *
 * Absent means the card's own word, which is what every cell written before
 * this said, so nothing saved has to be rewritten.
 */
export const ownerOf = (form: unknown): string => str(field(form, "of"));

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

/**
 * The row ids one table declares.
 *
 * A card may carry more than one table now — a verb's persons and tenses,
 * and the pronouns a word takes on its end — and they are told apart by the
 * row a cell sits in, because the rows of one table are names no other
 * declares. So this is the whole of "which table is this cell in": every
 * function below that is about one table takes the spec and asks it.
 */
export const rowIdsOf = (spec: VerbSpec | null | undefined): Set<string> =>
  new Set(tensesOf(spec).map((t) => t.id));

/**
 * The cells of a card that belong to one table, in no particular order.
 *
 * `of` names whose table: "" for the card's own word, a form's id for that
 * form's. **Left out, every owner's cells come back** — which is what the
 * card as a whole is asked (has this card any such table, what does a save
 * carry), as against what one table holds. The two are different questions
 * and "" is a real answer to the second, so the difference cannot be
 * carried by a default.
 */
export function cellsIn(
  card: unknown,
  spec: VerbSpec | null | undefined,
  of?: string,
): Form[] {
  const rows = rowIdsOf(spec);
  const owner = of === undefined ? null : str(of);
  return cellsOf(card).filter(
    (cell) => rows.has(rowOf(cell)) && (owner === null || ownerOf(cell) === owner),
  );
}

/**
 * Whether the card carries this table at all.
 *
 * Was `isVerb`, and read "has any cell", which was the same question while
 * a verb table was the only table there was. It is not any more: a word
 * with an attached-pronoun table has cells and is not a verb, and a
 * question that could not tell the two apart gated one by the other's rows
 * and closed it for ever.
 */
export const hasCells = (
  card: unknown,
  spec: VerbSpec | null | undefined,
  of?: string,
): boolean => cellsIn(card, spec, of).length > 0;

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
 * two sub-forms claim the same cell *of the same table*, the first wins: a
 * card can only be in that state by being edited somewhere that does not
 * know about tables, and picking one beats showing both.
 *
 * Which table is the `of` — and it is asked for by position rather than
 * defaulted away, because two forms of one word have a *me* apiece and
 * looking one up by row and column alone would hand back whichever was
 * typed first. "" is the card's own word, which is what a verb always
 * passes and what every cell written before this carries.
 */
export function cellAt(
  card: unknown,
  row: string,
  col: string,
  of: string = "",
): Form | null {
  const want = { row: str(row), col: str(col), of: str(of) };
  if (!want.row || !want.col) return null;
  return (
    cellsOf(card).find(
      (c) => rowOf(c) === want.row && colOf(c) === want.col && ownerOf(c) === want.of,
    ) || null
  );
}

/* ---- the axes, as the language declares them ---- */

/** The rows, in the order the language teaches them. Empty where it has none. */
export const tensesOf = (spec: VerbSpec | null | undefined): VerbTense[] =>
  (spec && Array.isArray(spec.tenses) ? spec.tenses : []).filter((t) => t && str(t.id));

/** The columns. A language whose verbs do not vary by person declares one. */
export const personsOf = (spec: VerbSpec | null | undefined): VerbPerson[] =>
  (spec && Array.isArray(spec.persons) ? spec.persons : []).filter((p) => p && str(p.id));

/*
 * What a cell means is typed, not composed.
 *
 * There was a function here that made one from the row's English and the
 * column's label — "she" and "ate" giving "she ate" — so that a teacher
 * wrote three words instead of seventeen. It is gone, and the reason is
 * worth keeping: it could not be right, and it was wrong in the place a
 * learner would meet first.
 *
 * English inflects the present and nothing else, so "eat" composed across
 * a row gave "I eat" and "we eat" correctly and "he eat" and "she eat"
 * beside them. A command composed across every column offered "I: eat!"
 * and "he: eat!", which nobody says. The fix each time was the teacher
 * correcting the app's own output, on every regular verb they ever wrote —
 * and a rule that knew better would be a rule about English, living in a
 * file whose whole point is that it knows no language at all.
 *
 * So each cell carries the words it was given. Seventeen boxes typed is
 * more work than three, and it is work that produces something true.
 */

/* ---- the citation form ---- */

/**
 * Which cell of the table is the verb as a dictionary names it, if any.
 *
 * Arabic has no infinitive: *to eat* is listed under the he-past, which is
 * a cell of this very table. Where a language says so, the card's own word
 * and that cell are the same word, and only one of them is a thing to
 * learn. Where it says nothing — Huế cites the bare verb, which is a word
 * and not a cell — there is nothing to reconcile.
 */
export function citationOf(spec: VerbSpec | null | undefined): { row: string; col: string } | null {
  const cite = spec && spec.citation;
  const row = str(cite && cite.row);
  const col = str(cite && cite.col);
  if (!row || !col) return null;
  /* Only a cell the table actually has. A pack naming a row or a column it
     does not declare is naming nothing, and reconciling a card's word with
     a cell that cannot exist would silence the word for ever. */
  if (!tensesOf(spec).some((t) => t.id === row)) return null;
  if (!personsOf(spec).some((p) => p.id === col)) return null;
  return { row, col };
}

/** Whether this form is the cell the language cites. */
export function isCitation(spec: VerbSpec | null | undefined, cell: unknown): boolean {
  const cite = citationOf(spec);
  return !!cite && rowOf(cell) === cite.row && colOf(cell) === cite.col;
}

/**
 * The cell standing in for the card's own word, where there is one filled.
 *
 * Null where the language cites nothing, and null where it cites a cell
 * the teacher has left blank — in which case the card's word is all there
 * is of the verb, and goes on being practised as itself.
 */
export function citedCell(
  card: unknown,
  spec: VerbSpec | null | undefined,
): Form | null {
  const cite = citationOf(spec);
  if (!cite) return null;
  const cell = cellAt(card, cite.row, cite.col);
  return cell && str(cell.ar) ? cell : null;
}

/**
 * The card's own word, taken off the cell that stands in for it.
 *
 * Where a language cites a cell, that cell holds everything the card's own
 * word does — the script, the pronunciation, the English, the recordings —
 * so the editor stops asking for them a second time and reads them off the
 * table instead. The card is still saved with a word of its own: the face
 * every list shows, what a search matches, what a tile is labelled. This
 * is where that word comes from.
 *
 * Everything else about the form is kept. The word is what the cell knows;
 * whether the card is drilled, which variable it fills, what deck it is in
 * are facts about the card and are none of the cell's business.
 *
 * An empty cell gives an empty word rather than the last one typed, which
 * is what lets the editor refuse to save a verb whose dictionary form has
 * been left blank instead of quietly keeping a word nothing points at.
 */
export function citedWord<T extends Record<string, unknown>>(own: T, cell: unknown): T {
  return {
    ...own,
    ar: str(field(cell, "ar")),
    en: str(field(cell, "en")),
    lat: str(field(cell, "lat")),
    clips: field(cell, "clips") || [],
    slowClips: field(cell, "slowClips") || [],
  };
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
  of: string = "",
): string[] {
  const open: string[] = [];
  for (const tense of tensesOf(spec)) {
    open.push(tense.id);
    const cells = cellsIn(card, spec, of).filter((c) => rowOf(c) === tense.id);
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
 *
 * The cell a language cites is the exception, and has to be: it is the
 * word on the front of the card, met the day the card is. Arabic's is in
 * the past, which is the second row — so without this a learner would hold
 * a card reading *to eat* whose word they were not shown until they had
 * mastered the whole present tense. It is an ordinary cell of its row for
 * every other purpose, and the rest of that row still waits.
 */
export function cellIsOpen(
  card: unknown,
  spec: VerbSpec | null | undefined,
  cell: unknown,
  mastered: (cell: Form) => boolean,
): boolean {
  if (!isCell(cell)) return true;
  if (isCitation(spec, cell)) return true;
  /* Against its own table: a row of the plural's is held up by the plural's
     cells above it, and not by the singular's. */
  return openRows(card, spec, mastered, ownerOf(cell)).includes(rowOf(cell));
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
  of: string = "",
): { row: string; col: string; tense: VerbTense; person: VerbPerson; form: Form | null }[] {
  const out = [];
  for (const tense of tensesOf(spec)) {
    for (const person of personsOf(spec)) {
      out.push({
        row: tense.id,
        col: person.id,
        tense,
        person,
        form: cellAt(card, tense.id, person.id, of),
      });
    }
  }
  return out;
}

/** How many cells the teacher has filled in, and how many they left blank. */
export function tableCount(
  card: unknown,
  spec: VerbSpec | null | undefined,
  of: string = "",
): { filled: number; blank: number } {
  const all = tableOf(card, spec, of);
  const filled = all.filter((c) => c.form && str(c.form.ar)).length;
  return { filled, blank: all.length - filled };
}
