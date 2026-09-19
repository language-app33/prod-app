/*
 * What a card holds, written down once.
 *
 * A card can be opened two ways in the teaching space: to change it, or to
 * look at it. The second is meant to be the first with the typing taken
 * away — and it was not, for years, because it was a second hand-written
 * description of a card. Every feature since had to be added to it again by
 * somebody remembering to, and remembering is not a mechanism: it works
 * until the day it does not, with no sign either way. A teacher could not
 * see, by looking at a card, what kind of word it was, what its ID was,
 * which blanks it left, which forms were asked about, or which cell of a
 * verb's table any of its forms was.
 *
 * So the rule, stated once here and enforced by the tests named below:
 *
 *   **The saved card is the contract between the two screens.**
 *
 * Everything the editor can do ends as a card being saved — that is what
 * the editor is. A read-out that says everything a saved card can hold
 * therefore cannot fall behind it, whatever is added later, because a
 * feature that stores nothing has changed nothing to show.
 *
 * Which turns a promise about discipline into a question about data. This
 * file is the answer to it, in three parts:
 *
 * - `CARD_FACTS` describes every field a card and its forms can carry: what
 *   a reader sees it called, who it is worth showing to, and what the
 *   screen says for a given value.
 * - `NOT_SHOWN` names the fields that are not information for a reader —
 *   ids the app mints, timestamps, a learner's own progress — each with a
 *   line saying why. It is the only way for something to be invisible, and
 *   putting a field in it is a decision somebody makes on purpose.
 * - `unnamedOn` is everything else: whatever is on a card that neither list
 *   accounts for. `CardReadout` draws those at the foot of the card under
 *   their own internal names, which is deliberately plain — it is the
 *   visible sign of a field nobody has described yet, and in the meantime
 *   the teacher can still see it. The default is *shown, badly* rather than
 *   silence, which is what makes the promise hold before anybody notices.
 *
 * `tests/card-facts.test.mjs` fails when a field the editor writes, or the
 * card record documents, is in neither list or on no example card;
 * `tests/card-readout.test.mjs` renders the read-out over every example
 * card and fails when a value on the card is not on the screen. The two
 * together fail in the right order: *no example carries this*, then *the
 * screen does not show this*.
 *
 * Plain data and pure functions in a plain module — the family cards.ts,
 * variables.ts and verbs.ts are in — so the tests can read it without the
 * app around it, and so nothing in it can reach back into a screen.
 */

import type { Form, GrammarDim, Lang, VerbSpec } from "./types.ts";
import { answersOf, splitAlternatives } from "./answers.ts";
import { answerFields, blankAdmits, categoryLabel, GRAMMAR, kindOf, lendsForm, tablesOf, tensedOf } from "./languages.ts";
import { formsOf, leadOf } from "./cards.ts";
import { linesOf, namedPart, speakerName } from "./dialogs.ts";
import { isAsked } from "./scheduler.ts";
import type { Value } from "./variables.ts";
import { cardRef, fillNames, fillsOf, fillText, isLent, slotsOf, splitSlots, valuesFor, valuesForTurn } from "./variables.ts";
import { citationOf, colOf, isCell, ownerOf, personsOf, rowIdsOf, rowOf, slotRows, tensesOf } from "./verbs.ts";

/* A card, a form of one, a turn of one, or a half-written draft — open for
   the reason the other pure modules are: the same questions are asked of a
   stored card, of an item on a device and of a draft in an editor, and the
   three agree about nothing a compiler can see. */
export type Held = Record<string, any>;

/** Where a field lives. A card's own, one of its forms', one of its turns',
    or one of an accepted answer's. */
export type Where = "card" | "form" | "line" | "answer";

/**
 * Who a fact is worth showing.
 *
 * `teacher` is the material's owner: which decks carry the card, what it is
 * called between braces, which forms are lent to sentences. `both` is
 * everything that is about the word itself, which is what a student is
 * looking at when they open a card between sessions. Nothing is a
 * student's alone — there is no fact about a card its teacher may not see.
 */
export type Reader = "teacher" | "both";

export interface FactCtx {
  lang: Lang;
  /** The card the field was read off, for a fact that needs the rest of it. */
  card: Held;
  /** The teacher's other cards, where the reader has them: what a blank is
      worth is a fact about the collection rather than about this card. */
  cards?: Held[];
  /** Only a deck's id and title are read, to name where the card lives. */
  decks?: { id: string; title?: string }[];
}

export interface FieldRule {
  /** The stored key, exactly as a card carries it. */
  key: string;
  on: Where;
  /** What a reader sees it called. Empty where the value is its own label. */
  label: string;
  /** One sentence on what it is, for whoever reads this list. */
  what: string;
  reader: Reader;
  /** Set where the value is a list of things walked in their own right. */
  container?: boolean;
  /**
   * The strings a reader can find on the screen for this value.
   *
   * What the parity test looks for, and the one place "how does this field
   * read" is written down. An empty list is a real answer for a value that
   * says nothing — a card that is not a sentence, a form nobody has
   * switched off — and never a way out of describing one that does.
   */
  shown?: (value: unknown, ctx: FactCtx) => string[];
}

const str = (x: unknown): string => (x == null ? "" : String(x).trim());

/** A value shown as itself: the ordinary case, and the default. */
const asIs = (value: unknown): string[] => (str(value) ? [str(value)] : []);

/**
 * What a field that may have a blank in it reads as: its own words, and each
 * blank as its name.
 *
 * No screen shows the braces — a card listed anywhere draws its blanks the
 * same way, through `splitSlots` — so a rule that asked for the stored string
 * would be asking for the one thing this app never prints.
 */
const asWritten = (value: unknown): string[] =>
  splitSlots(str(value))
    .flatMap((run) => (run.slot ? [run.slot] : [run.text.trim()]))
    .filter(Boolean);

/** The same, for the two fields that hold every accepted answer at once,
    slash-separated: each spelling is drawn on its own line. */
const asAnswers = (value: unknown): string[] =>
  splitAlternatives(str(value)).filter(Boolean).flatMap(asWritten);

/* ------------------------------------------------------------------
   The words a read-out says for the answers a card gives

   Kept here rather than in the screen so that the screen and the test
   cannot disagree about them: the test looks for exactly these strings.
   ------------------------------------------------------------------ */

export const ASKED = "Asked on its own";
export const NOT_ASKED = "Not asked on its own";
export const LENT = "Lent to sentences";
export const NOT_LENT = "Not lent to sentences";
export const IN_NO_DECK = "In no deck";
export const A_SENTENCE = "A sentence — other cards fill its blanks";
export const NOT_DRILLED = "Not on its own — it fills other cards";
/* The words the read-out has always used for a scene whose part nobody
   has chosen. Here so the screen and the test read the same string. */
export const NO_PART = "Not set";

/* --- the two speeds a word is recorded at -------------------------
 *
 * A word said at the speed it is really said, and the same word said
 * slowly enough to hear its parts, are two different recordings doing two
 * different jobs — and a teacher may make either, both, or neither.
 *
 * They are two fields on the form rather than one list with a mark on each
 * entry: which speed a recording is at is the only thing that distinguishes
 * them, and a mark is a thing that can be lost in a merge, a backup or an
 * older client. Two lists cannot lose it.
 *
 * Here rather than in the teaching space because both ends need it: the
 * teacher records against these, and the learner's card shows what it got
 * under the same names.
 */
export const CLIP_KINDS: { key: "clips" | "slowClips"; title: string; short: string; what: string }[] = [
  {
    key: "clips",
    title: "Regular speed",
    short: "Regular",
    what: "The word as it is really said. This is what a listening exercise plays.",
  },
  {
    key: "slowClips",
    title: "Slow",
    short: "Slow",
    what: "The same word said slowly, so a learner can hear each sound in it.",
  },
];

/** What the play button beside one recording is labelled — the speed it was
    said at, numbered only where there is more than one of that speed. The
    same answer `clipsOf` gives, which is what draws them. */
export const clipLabel = (key: "clips" | "slowClips", count: number): string => {
  const kind = CLIP_KINDS.find((k) => k.key === key);
  const short = (kind && kind.short) || key;
  return count > 1 ? `${short} 1` : short;
};

/**
 * What a form's two ticks read as: one clause each, in the editor's order.
 *
 * Always both, on every form, because "asked" and "not asked" are equally
 * worth knowing and a line that appeared only on the unusual answer would
 * leave a reader guessing which case silence was. The two answers
 * themselves are read through `isAsked` in the scheduler and `isLent` in
 * variables.ts, which are what every other reader goes through: a
 * read-out that decided for itself what an absent tick meant would be a
 * screen that disagrees with the deal.
 */
export const askLine = (form: Held | null | undefined): string =>
  `${isAsked(form as Form) ? ASKED : NOT_ASKED} · ${isLent(form) ? LENT : NOT_LENT}`;

/* ------------------------------------------------------------------
   The tables a card lays its forms out in
   ------------------------------------------------------------------ */

/** Which of the language's tables a cell sits in, read off its row — the
    same way the editor decides which table a stored card carries. */
export function specForCell(lang: Lang | null | undefined, cell: Held): VerbSpec | null {
  for (const spec of Object.values(tablesOf(lang))) {
    if (rowIdsOf(spec).has(rowOf(cell))) return spec;
  }
  return null;
}

/** What one row is called, in the language's own word for it — "past" —
    found by the row itself, because a row id names no other table. */
export function rowLabel(lang: Lang | null | undefined, row: string): string {
  const spec = specForCell(lang, { row });
  const tense = tensesOf(spec).find((t) => t.id === str(row));
  return tense ? tense.label : str(row);
}

/**
 * A handful of rows as one line — "past and present".
 *
 * What a sentence has narrowed a blank to, said the way a teacher would
 * say it rather than as a list of ids. Empty for no rows at all, which is
 * a blank that admits every tense and has nothing to say about it.
 */
export function rowsLine(lang: Lang | null | undefined, rows: string[]): string {
  const said = (rows || []).map((row) => rowLabel(lang, row)).filter(Boolean);
  if (said.length < 2) return said[0] || "";
  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

/** What to call one cell out loud — "past · she" — in the language's own
    labels, which is what the editor's own table calls it. */
export function cellTitle(spec: VerbSpec | null, cell: Held): string {
  const tense = tensesOf(spec).find((t) => t.id === rowOf(cell));
  const person = personsOf(spec).find((p) => p.id === colOf(cell));
  return [tense ? tense.label : rowOf(cell), person ? person.label : colOf(cell)]
    .filter(Boolean)
    .join(" · ");
}

/** What a table is called to a reader. A verb's declares no name — it is
    known by its rows — so it is named for what it holds, in the words the
    editor's own list of parts uses. */
export const tableTitle = (spec: VerbSpec | null): string =>
  (spec && spec.label) || (citationOf(spec) ? "The conjugated forms" : "Its forms");

export interface TableGroup {
  spec: VerbSpec;
  /** The form whose table it is: the card's own word carries "". */
  of: string;
  /** What that form is, for a heading that has to name it. */
  owner: Held | null;
  /** Its cells, in the order the language lays the table out. */
  cells: Held[];
}

/**
 * Every table on a card, with its cells in the language's own order.
 *
 * A card's forms are one list and a cell is one of them — that is what
 * verbs.ts settled and what every reader downstream relies on — so this
 * does not take the cells out of the card. It says which table each sits
 * in, whose it is, and where in it, so a screen can draw them grouped
 * under the row they are on instead of as an unnumbered run of "other
 * forms", which is what the read-out did until this.
 */
export function tablesOn(card: Held | null | undefined, lang: Lang | null | undefined): TableGroup[] {
  const forms = formsOf(card);
  const out: TableGroup[] = [];
  for (const form of forms) {
    if (!isCell(form)) continue;
    const spec = specForCell(lang, form);
    if (!spec) continue;
    const of = ownerOf(form);
    let group = out.find((g) => g.spec === spec && g.of === of);
    if (!group) {
      group = {
        spec,
        of,
        owner: of ? forms.find((f) => str(f.id) === of) || null : forms[0] || null,
        cells: [],
      };
      out.push(group);
    }
    group.cells.push(form);
  }
  /* In the order the language declares, so a teacher reading the past
     before the present is reading their own pack's mistake and not ours. */
  for (const group of out) {
    const rows = tensesOf(group.spec).map((t) => t.id);
    const cols = personsOf(group.spec).map((p) => p.id);
    const place = (cell: Held) => {
      const r = rows.indexOf(rowOf(cell));
      const c = cols.indexOf(colOf(cell));
      return (r < 0 ? rows.length : r) * (cols.length + 1) + (c < 0 ? cols.length : c);
    };
    group.cells.sort((a, b) => place(a) - place(b));
  }
  return out;
}

/** The cells of a card, which a screen drawing its tables has already
    covered and should not list a second time as loose forms. */
export const isTableCell = (form: Held, lang: Lang | null | undefined): boolean =>
  isCell(form) && !!specForCell(lang, form);

/* ------------------------------------------------------------------
   The blanks a card leaves and the names it answers to
   ------------------------------------------------------------------ */

/** The blanks a card leaves, over all of its forms and turns: what
    `{{name}}` in any of its fields asks for. */
export function blanksOn(card: Held | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (formsOf(card) as Held[]).concat(linesOf(card) as Held[])) {
    for (const slot of slotsOf(part)) if (!out.includes(slot)) out.push(slot);
  }
  return out;
}

/**
 * The words behind each of a form's blanks, today.
 *
 * One door, because three screens ask it: the editor, so a teacher can see
 * whether the right vocabulary is behind a blank; the read-out, for the
 * same question asked of a card nobody is editing; and the trainer's own
 * index of what a frame can be filled with. It was written out at each of
 * them, identically, which is three answers to one question waiting to
 * disagree — and the one thing that must not differ is *this* count,
 * because it is the number the question itself will find.
 */
export function fillersFor(
  form: Held | null | undefined,
  pool: Held[],
  lang: Lang | null | undefined,
): Record<string, Value[]> {
  return valuesFor(
    form,
    pool || [],
    (lang && lang.id) || undefined,
    (c) => kindOf(c, lang),
    (c, f) => lendsForm(lang, c)(f),
    /* And the tenses this frame asks its verbs in, where it has narrowed a
       blank to some — see slotRows, which answers "every one of them" for
       every blank nobody has narrowed. */
    blankAdmits(lang, (slot) => slotRows(form, slot)),
  );
}

/**
 * Which of a form's blanks have words with tenses behind them, and which
 * table those words take their rows from.
 *
 * The question the editor has to answer before it can offer a teacher
 * anything to tick: *is there a verb in this hole*. Asked of the words
 * actually behind the blank rather than of its name, because a teacher who
 * gathers their verbs under a group tag of their own has a hole full of
 * verbs and a name that says nothing about it — and because a blank named
 * after the part of speech is filled by verbs only where the pack declares
 * that part of speech in the first place.
 *
 * Empty in a language whose verbs take one form, which is the whole of
 * what "for languages that have different forms for different tenses"
 * comes to in code: see tensedOf, which is the one answer to it.
 */
export function tensedBlanks(
  form: Held | null | undefined,
  pool: Held[],
  lang: Lang | null | undefined,
): Map<string, VerbSpec> {
  const out = new Map<string, VerbSpec>();
  const holes = slotsOf(form);
  if (!holes.length) return out;
  for (const card of pool || []) {
    if (lang && card.lang && card.lang !== lang.id) continue;
    const spec = tensedOf(lang, str(card.category));
    if (!spec) continue;
    const names = fillsOf(card, kindOf(card, lang));
    for (const slot of holes) if (!out.has(slot) && names.includes(slot)) out.set(slot, spec);
    if (out.size === holes.length) break;
  }
  return out;
}

/**
 * The same, for every blank anywhere on the card.
 *
 * A word or a sentence leaves its holes in its own words, so its lead form
 * is the whole answer; a conversation leaves them in its turns, and asking
 * the lead form — the scene's name — would come back with nothing behind
 * any of them. Merged rather than asked per part by the caller, because
 * "what fills this card's blanks" is one question.
 */
export function fillersOn(
  card: Held | null | undefined,
  pool: Held[],
  lang: Lang | null | undefined,
): Record<string, Value[]> {
  const out: Record<string, Value[]> = {};
  for (const part of (formsOf(card) as Held[]).concat(linesOf(card) as Held[])) {
    if (!slotsOf(part).length) continue;
    for (const [slot, values] of Object.entries(fillersFor(part, pool, lang))) {
      if (!out[slot]) out[slot] = values;
    }
  }
  return out;
}

/**
 * How many sentences a card is met as: every word behind one blank, every
 * pair behind two, and so on.
 *
 * Counted rather than built, so a screen can say it while the list itself
 * is still folded away — and so that a frame the whole collection fills is
 * a number rather than a hung phone.
 */
export const combosOf = (holes: string[], fillers: Record<string, Value[]>): number =>
  holes.length ? holes.reduce((n, slot) => n * ((fillers[slot] || []).length), 1) : 0;

/**
 * The most filled examples of a card any screen will draw at once.
 *
 * Not a taste about how many are worth reading — every filling a card has
 * is worth listing, which is the point — but the one number that keeps a
 * frame from taking the screen down with it. `{{name}} {{verb}}
 * {{object}}` over a collection of any size is tens of thousands of
 * sentences. A thousand is past every real card, and where one goes past
 * it the screen says so and says how many there are.
 */
export const EXAMPLES_CEILING = 1000;

/**
 * The sentences a student will actually be asked, filled from the words
 * that exist today.
 *
 * All three fields, because a teacher writing an Arabic frame is owed the
 * Arabic sentence. A field whose filler has nothing to put in it keeps the
 * braces standing, exactly as the question would. Distinct, because two
 * cards carrying one word would otherwise print the same sentence twice
 * and read as a bug; `valuesForTurn` counts through the combinations in
 * order, so walking the turns is every filling exactly once.
 */
export function examplesOf(
  form: Held | null | undefined,
  holes: string[],
  fillers: Record<string, Value[]>,
  ceiling = EXAMPLES_CEILING,
): { ar: string; lat: string; en: string }[] {
  if (!holes.length) return [];
  const out: { ar: string; lat: string; en: string }[] = [];
  /* Kept as keys rather than compared against what is already out: a
     thousand examples asking "have I printed this one" a thousand times is
     a million string comparisons, on every keystroke in the field above. */
  const had = new Set<string>();
  const turns = Math.min(combosOf(holes, fillers), ceiling);
  for (let turn = 0; turn < turns; turn++) {
    const took = valuesForTurn(holes, fillers, turn);
    if (!took) break;
    const line = {
      ar: fillText(str(form && form.ar), took, "ar").trim(),
      lat: fillText(str(form && form.lat), took, "lat").trim(),
      en: fillText(str(form && form.en), took, "en").trim(),
    };
    if (!line.ar && !line.lat && !line.en) continue;
    const key = JSON.stringify([line.ar, line.lat, line.en]);
    if (had.has(key)) continue;
    had.add(key);
    out.push(line);
  }
  return out;
}

/**
 * Every grammar axis the app knows, whether or not a pack still declares
 * one.
 *
 * Read off GRAMMAR rather than off the language, on purpose. A retired axis
 * keeps its value in storage — see `register` — and a screen that listed
 * only what the pack asks about today would be a screen that hides what
 * the card says. What a card holds is what a read-out says.
 */
export const grammarDims = (): GrammarDim[] => Object.values(GRAMMAR);

/** What one stored value of an axis reads as, spelled out in full: a
    read-out has the room, and "sg. m." is a tile's shorthand. */
export const dimText = (dim: GrammarDim, value: unknown): string => {
  const said = str(value);
  if (!said) return "";
  const opt = dim.options.find(([v]) => v === said);
  return opt ? opt[1] : said;
};

/** The axes a form actually says something about, in GRAMMAR's order. */
export const dimsSaid = (form: Held | null | undefined): GrammarDim[] =>
  grammarDims().filter((dim) => !!str(form && form[dim.field]));

/** The keys a language pack adds beside the axes — Vietnamese's lexical
    field. One list, because both are grammar written flat on a form. */
export const lexicalKeys = (): string[] => {
  const dims = grammarDims().map((d) => d.field);
  return answerFields()
    .map((f) => f.field)
    .filter((f) => !dims.includes(f));
};

/** What a lexical key is called, in the pack that declares it. */
export const lexicalLabel = (lang: Lang | null | undefined, key: string): string =>
  lang && lang.lexical && lang.lexical.key === key ? lang.lexical.label : key;

/* ------------------------------------------------------------------
   The list itself
   ------------------------------------------------------------------ */

const deckTitles = (value: unknown, ctx: FactCtx): string[] => {
  const ids = Array.isArray(value) ? value : [];
  const titles = ids
    .map((id) => (ctx.decks || []).find((d) => d.id === str(id)))
    .map((d) => str(d && d.title))
    .filter(Boolean);
  return titles.length ? titles : ids.length ? [] : [IN_NO_DECK];
};

/**
 * The words on the cards a phrase says it teaches.
 *
 * Ids are not information — nobody can read one — so what a reader is owed
 * is the words. Without the pool to look them up in there is nothing
 * truthful to print but how many there are, which is what the student's
 * screen gets: the ids on their own would be a row of hashes.
 */
const usedWords = (value: unknown, ctx: FactCtx): string[] => {
  const ids = (Array.isArray(value) ? value : []).map(str).filter(Boolean);
  if (!ids.length) return [];
  if (!ctx.cards) return [`${ids.length}`];
  const words = ids
    .map((id) => (ctx.cards || []).find((c) => str(c.id) === id))
    .map((c) => (c ? str(leadOf(c).ar) || str(leadOf(c).en) : ""))
    .filter(Boolean);
  /* A card that has gone since it was ticked is named by nothing, and the
     count is then all there is to say. */
  return words.length ? words : [`${ids.length}`];
};

/**
 * Every field a card, a form, a turn or an accepted answer can carry, with
 * what a reader sees it called and what the screen says for it.
 *
 * Order is the order a read-out puts them in as far as it can be — the
 * card, its words, its sound, what is asked of it, what it is called, where
 * it lives — which is the order the editor asks for them in.
 */
export const CARD_FACTS: FieldRule[] = [
  /* ---- the card ---- */
  {
    key: "forms",
    on: "card",
    label: "",
    what: "The card's own word first, then every other form of it — a plural, a feminine, one cell of a table.",
    reader: "both",
    container: true,
  },
  {
    key: "subs",
    on: "card",
    label: "",
    what: "Where a card written before 0.138 keeps the forms after its own word. Read as one list with the card's word in front, and shown exactly as one.",
    reader: "both",
    container: true,
  },
  {
    key: "lines",
    on: "card",
    label: "",
    what: "The turns of a conversation, in order. Each is drilled in its own right, as a form is.",
    reader: "both",
    container: true,
  },
  {
    key: "category",
    on: "card",
    label: "What subtype",
    what: "What the teacher says the word is — a noun, a verb, a name. It decides which table the card is offered and which blanks it fills without anybody ticking one.",
    reader: "both",
    shown: (value, ctx) => {
      const said = str(value);
      if (!said) return [];
      return [categoryLabel(ctx.lang, said) || said];
    },
  },
  {
    key: "sentence",
    on: "card",
    label: "",
    what: "Whether the card is a frame with holes in it rather than a word. The teacher's answer, given before the editor opens and kept.",
    reader: "both",
    shown: (value) => (value ? [A_SENTENCE] : []),
  },
  {
    key: "value",
    on: "card",
    label: "Worth",
    what: "What number this card is worth, where it is one of the parts numbers are built out of. The only thing that makes a part findable.",
    reader: "both",
    shown: (value) => (value == null || value === "" ? [] : [String(value)]),
  },
  {
    key: "name",
    on: "card",
    label: "Listed as",
    what: "What to call the card where its own words do not name it: a verb saved as the form a dictionary lists, a sentence saved as a frame.",
    reader: "both",
    shown: asWritten,
  },
  {
    key: "note",
    on: "card",
    label: "Note",
    what: "The teacher's own note on the card. The one thing on a teacher's screen written for the student to read.",
    reader: "both",
    shown: asIs,
  },
  {
    key: "ref",
    on: "card",
    label: "The card's ID",
    what: "The name the teacher gave this card, so another card's sentence can borrow this word by name rather than any word of a kind.",
    reader: "teacher",
    shown: (value) => {
      const own = cardRef({ ref: value });
      return own ? [own] : [];
    },
  },
  {
    key: "fills",
    on: "card",
    label: "Group tags",
    what: "The blanks this card says it fills, which is nowhere in its words: the teacher's answer to what kind of hole this word stands in.",
    reader: "teacher",
    shown: (value) => fillNames({ fills: value }),
  },
  {
    key: "uses",
    on: "card",
    label: "Words this teaches",
    what: "The word cards a phrase is a good example of. Each is practised inside this phrase as well as on its own.",
    reader: "both",
    shown: usedWords,
  },
  {
    key: "drill",
    on: "card",
    label: "Practised",
    what: "Whether the card is a question at all. A value — a name — is there to fill somebody else's hole, and asking what it means is not a question.",
    reader: "both",
    shown: (value) => (value === false ? [NOT_DRILLED] : []),
  },
  {
    key: "decks",
    on: "card",
    label: "Decks",
    what: "Which decks carry the card. A card is seen through its decks, and one in no deck reaches nobody — which is the teacher's problem to fix and so their line to read.",
    reader: "teacher",
    shown: deckTitles,
  },
  {
    key: "lang",
    on: "card",
    label: "Language",
    what: "Which language the card is in.",
    reader: "teacher",
    shown: (value, ctx) => [str(ctx.lang && ctx.lang.name) || str(value)],
  },
  {
    key: "speakers",
    on: "card",
    label: "Who is in it",
    what: "The people in a conversation, in the order their columns are drawn.",
    reader: "both",
    shown: (value) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []),
  },
  {
    key: "you",
    on: "card",
    label: "The student's part",
    what: "Which speaker the student plays: their turns are the ones they produce when the whole scene is asked. Unset means the question takes the parts in turn.",
    reader: "both",
    shown: (value, ctx) => {
      const who = namedPart({ ...ctx.card, you: value });
      return [who === null ? NO_PART : speakerName(ctx.card, who)];
    },
  },

  /* ---- a form of the card, and a turn of a conversation ---- */
  {
    key: "ar",
    on: "form",
    label: "",
    what: "The word in the language's own script — the answer, and what a blank in it asks for.",
    reader: "both",
    /* Every accepted spelling, because that is what the field holds: two
       of them are stored slash-separated and drawn one per line, each with
       its own pronunciation and its own grammar beside it. */
    shown: asAnswers,
  },
  {
    key: "en",
    on: "form",
    label: "",
    what: "What it means — the English a student is asked for and marked against.",
    reader: "both",
    shown: asWritten,
  },
  {
    key: "lat",
    on: "form",
    label: "",
    what: "How it is pronounced, in Latin letters — one per accepted spelling.",
    reader: "both",
    shown: asAnswers,
  },
  {
    key: "answers",
    on: "form",
    label: "",
    what: "The accepted answers, each with the transliteration and the grammar that belong to it rather than to the form as a whole.",
    reader: "both",
    container: true,
  },
  {
    key: "note",
    on: "form",
    label: "Note",
    what: "A note on this one form, where a card written elsewhere carries one.",
    reader: "both",
    shown: asIs,
  },
  {
    key: "clips",
    on: "form",
    label: "Recordings",
    what: "How it sounds, said at ordinary speed. A card with a recording can be practised by ear.",
    reader: "both",
    /* A hash is not information — nobody can read one — so what a reader is
       owed is that the recording is there and at which speed, which is what
       the label beside its play button says. */
    shown: (value) => (Array.isArray(value) && value.length ? [clipLabel("clips", value.length)] : []),
  },
  {
    key: "slowClips",
    on: "form",
    label: "Recordings",
    what: "The same, said slowly. Kept apart from the others because which one a learner is hearing is the whole point of having both.",
    reader: "both",
    shown: (value) => (Array.isArray(value) && value.length ? [clipLabel("slowClips", value.length)] : []),
  },
  {
    key: "ask",
    on: "form",
    label: "",
    what: "Whether this form is dealt as a question. A table written out for a student to read is kept without being asked about.",
    reader: "teacher",
    shown: (value) => [value === false ? NOT_ASKED : ASKED],
  },
  {
    key: "lend",
    on: "form",
    label: "",
    what: "Whether this form may stand in another card's blank. The other half of the same question, and a separate answer since 0.179.",
    reader: "teacher",
    shown: (value) => [value === false ? NOT_LENT : LENT],
  },
  {
    key: "row",
    on: "form",
    label: "",
    what: "Which row of its table this form sits in — which tense. Drawn under that row's heading rather than said as a field.",
    reader: "both",
    shown: (value, ctx) => [rowLabel(ctx.lang, str(value))],
  },
  {
    key: "tenses",
    on: "form",
    label: "Tenses its blanks ask for",
    what: "Which tenses a sentence wants the verbs in one of its blanks to stand in. A blank that says nothing is met in every tense, which is what a frame about nothing in particular wants.",
    reader: "both",
    shown: (value, ctx) => {
      const said = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const out: string[] = [];
      for (const slot of Object.keys(said)) {
        const line = rowsLine(ctx.lang, slotRows({ tenses: said }, slot));
        if (line) out.push(`${slot} · ${line}`);
      }
      return out;
    },
  },
  {
    key: "col",
    on: "form",
    label: "",
    what: "And which column — which person. The two together name the cell.",
    reader: "both",
    shown: (value, ctx) => {
      for (const spec of Object.values(tablesOf(ctx.lang))) {
        const person = personsOf(spec).find((p) => p.id === str(value));
        if (person) return [person.label];
      }
      return [str(value)];
    },
  },
  {
    key: "of",
    on: "form",
    label: "",
    what: "Whose table this cell sits in: the form it is a form of. The table is drawn inside that form's own block, which is what says it.",
    reader: "both",
    shown: (value, ctx) => {
      const owner = formsOf(ctx.card).find((f) => str(f.id) === str(value));
      const word = owner ? str(owner.ar) || str(owner.en) : "";
      return word ? [word] : [];
    },
  },
  {
    key: "who",
    on: "line",
    label: "",
    what: "Whose turn it is. Stored as a place in the list of speakers and read out as their name.",
    reader: "both",
    shown: (value, ctx) => [speakerName(ctx.card, Number(value) || 0)],
  },
  {
    key: "uses",
    on: "line",
    label: "Words this turn teaches",
    what: "The word cards this one turn is a good example of, ticked the way a phrase's are.",
    reader: "both",
    shown: usedWords,
  },

  /* ---- one accepted answer ---- */
  {
    key: "text",
    on: "answer",
    label: "",
    what: "One accepted spelling of the word, as the card stores it.",
    reader: "both",
    shown: asWritten,
  },
  {
    key: "lat",
    on: "answer",
    label: "",
    what: "How that one accepted spelling is pronounced.",
    reader: "both",
    shown: asWritten,
  },
];

/**
 * The grammar axes, as rules over whichever fields GRAMMAR declares.
 *
 * Written as a family rather than by name because which axes exist is the
 * grammar table's answer: a pack that adds one gets a read-out row without
 * an edit here, which is the whole point of this file. Every one of them is
 * on a form and on an accepted answer, because two spellings may be a
 * masculine and a feminine.
 */
const grammarRules = (): FieldRule[] => {
  const out: FieldRule[] = [];
  for (const dim of grammarDims()) {
    for (const on of ["form", "answer"] as Where[]) {
      out.push({
        key: dim.field,
        on,
        label: dim.label,
        what: `What the language declares about the word on this axis. Recorded on the card, never asked in an exercise.${
          dim.retired ? " The axis is retired; a card that carries a value keeps it, and so is shown it." : ""
        }`,
        reader: "both",
        shown: (value) => {
          const said = dimText(dim, value);
          return said ? [said] : [];
        },
      });
    }
  }
  for (const key of lexicalKeys()) {
    for (const on of ["form", "answer"] as Where[]) {
      out.push({
        key,
        on,
        label: "",
        what: "What the pack that declares this axis calls it — Vietnamese's own lexical field. Recorded and never asked.",
        reader: "both",
        shown: asIs,
      });
    }
  }
  return out;
};

/** Every rule: the ones written out above, and the grammar family. */
export const factRules = (): FieldRule[] => CARD_FACTS.concat(grammarRules());

/**
 * The rule for one field, or null where nothing describes it.
 *
 * A turn of a conversation falls back to a form's rules, because that is
 * what a turn is: `Line` in types.ts is a form with a speaker on it, and its
 * words, its recordings and its two ticks are a form's. Only what a turn has
 * *instead* — who said it — is written out for it.
 */
export const ruleFor = (on: Where, key: string): FieldRule | null => {
  const rules = factRules();
  const own = rules.find((r) => r.on === on && r.key === key);
  if (own) return own;
  return (on === "line" && rules.find((r) => r.on === "form" && r.key === key)) || null;
};

/**
 * The fields that are not information for a reader, each with why.
 *
 * The only way for something on a card to be invisible. Keyed `where.key`,
 * and adding one is a decision somebody makes on purpose: everything not
 * in here and not described above is shown raw at the foot of the card.
 */
export const NOT_SHOWN: [string, string][] = [
  ["card.id", "The id the app mints. Nobody types it and nobody can act on it."],
  ["card.owner", "Which account the card belongs to, which is the account looking at it."],
  ["card.rev", "Which revision of the card this is. A fact about syncing, not about the word."],
  ["card.created", "When the card was made. Shown beside it in the card list, where a date belongs."],
  ["card.updated", "And when it was last saved — the same."],
  ["card.inDecks", "Which decks the server says carry it, which is what `decks` says in words."],
  ["card.kind", "What sort of card it is, from before that was read off the card's own turns and its own words. The shape of this screen is the answer now."],
  ["card.spread", "A rename the teacher said should follow the name into every other card. It travels beside the card being saved and is not part of it."],
  ["card.stripped", "The same for a group taken off the whole collection."],
  ["card.source", "Which deck of which course a student's copy came from. The card they are holding is the card."],
  ["card.locked", "Whether the teacher's wording is the student's to change, which every course card's is not."],
  ["card.tags", "The learner's own tags on their copy, which they gave it and can see where they gave it."],
  ["card.flags", "Problems reported about the card. They have a screen of their own in Teaching."],
  ["card.priority", "The learner's mark asking for the card, which has its own block on their card screen."],
  ["card.priorityAt", "When they made or cleared that mark, which is there so two devices can agree about it."],
  ["card.reset", "When the card's progress was last set aside. A fact about a schedule."],
  ["card.used", "Which numbers this part has already been asked in. Thrown away with the sitting."],
  ["card.s", "The learner's progress, exercise by exercise. The ladder on their card screen is what says it."],
  ["card.met", "Which of a frame's fillings the learner has met. The same."],
  ["card.recs", "Recordings as a device holds them, which the read-out is handed as `clips`."],
  ["form.id", "The name the editor mints for a form so a schedule can point at it. Stored and never shown — see CardForm."],
  ["form.s", "That form's progress, which belongs to the learner's ladder."],
  ["form.met", "And which fillings of it they have met."],
  ["form.recs", "Its recordings as a device holds them — see card.recs."],
  ["form.lang", "Which language the form is in, which is the card's answer and is given once."],
  ["line.id", "The name a turn is known by, minted like a form's."],
  ["line.s", "A turn's progress. The learner's."],
  ["line.met", "And its record of what it has been met with."],
  ["line.recs", "Its recordings as a device holds them."],
  ["answer.at", "Where the answer sits in its form's list. Carried out of a read rather than stored — see PlacedAnswer."],
];

const notShown = (): Map<string, string> => new Map(NOT_SHOWN);

/**
 * Every field the card in front of us actually carries, with what
 * describes it.
 *
 * One walk, two readers: the screen asks it for the fields nothing
 * describes yet, and `tests/card-readout.test.mjs` asks it for everything
 * the screen has to say. Two walkers would be two accounts of what a card
 * is made of, which is the very thing this file exists to stop.
 *
 * Empty values are left out. A field set to nothing is not information
 * being withheld, and `dimValues` writes every axis onto every form whether
 * or not the teacher answered it.
 *
 * Accepted answers are walked as a read narrows them rather than as stored:
 * `readAnswer` drops anything the language does not declare, so a raw
 * oddity in there never reaches a screen and demanding that one be shown
 * would be demanding a screen say something the app has thrown away.
 */
export function fieldsOn(card: Held | null | undefined): FieldOn[] {
  const skip = notShown();
  const out: FieldOn[] = [];
  /*
   * `wheres` is a list rather than one place because of the shape a card was
   * stored in before 0.138: there the card *is* its own first form, so one
   * object holds a card's fields and a form's at once and either list may be
   * the one that describes a key. Walked once and looked up in both, rather
   * than twice and half-answered in each.
   */
  const look = (wheres: Where[], held: Held, at: string) => {
    for (const [key, value] of Object.entries(held || {})) {
      if (value === "" || value === null || value === undefined) continue;
      if (Array.isArray(value) && !value.length) continue;
      out.push({
        where: wheres[0],
        key,
        value,
        at,
        rule: wheres.map((w) => ruleFor(w, key)).find(Boolean) || null,
        why: wheres.map((w) => skip.get(`${w}.${key}`)).find(Boolean) || "",
      });
    }
  };
  const named = (i: number) => (i === 0 ? "the card's own word" : `form ${i + 1}`);
  const forms = formsOf(card) as Held[];
  /* The card, together with its own word where the two are one object. */
  const lead = forms[0] === card ? (["card", "form"] as Where[]) : (["card"] as Where[]);
  look(lead, card || {}, "");
  forms.forEach((form, i) => {
    if (!(i === 0 && lead.length > 1)) look(["form"], form, named(i));
    for (const answer of answersOf(form, answerFields())) {
      look(["answer"], answer as Held, named(i));
    }
  });
  linesOf(card).forEach((line, i) => {
    look(["line"], line as Held, `turn ${i + 1}`);
    for (const answer of answersOf(line as Held, answerFields())) {
      look(["answer"], answer as Held, `turn ${i + 1}`);
    }
  });
  return out;
}

export interface FieldOn {
  where: Where;
  key: string;
  value: unknown;
  /** Which form or turn it was read off, for a heading that has to say. */
  at: string;
  /** What describes it, or null where nothing does yet. */
  rule: FieldRule | null;
  /** Why it is not shown at all, where that was decided — see NOT_SHOWN. */
  why: string;
}

/**
 * Whatever is on a card that neither list accounts for.
 *
 * The safety net, and the reason this holds without anybody being vigilant:
 * a field added to a card tomorrow is on the screen tomorrow, under its own
 * internal name and with its value as it is stored, until somebody gives it
 * a heading above. Plain on purpose — it reads as a thing nobody has got
 * round to, which is what it is.
 */
export const unnamedOn = (card: Held | null | undefined): FieldOn[] =>
  fieldsOn(card).filter((f) => !f.rule && !f.why);
