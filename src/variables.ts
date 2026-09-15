/*
 * A slot in a card, and the cards that fill it.
 *
 * A phrase is worth more when the learner cannot answer it by shape. "My
 * name is Raphael" learnt as one lump is a sentence somebody can say once;
 * the same frame met as Raphael, then Victor, then Sarah is a sentence they
 * can say about anyone, which is the thing actually being taught. So a card
 * may leave a hole in itself:
 *
 *     ar:  اسمي {{name}}
 *     en:  My name is {{name}}
 *     lat: ismi {{name}}
 *
 * and a separate card — Raphael, in all three of those fields — says it
 * fills `name`. The question fills the hole before anybody reads the card,
 * and fills it with a different value next time round.
 *
 * Three rules hold the idea together, and each of them is a function here
 * rather than a habit:
 *
 *   * the same slots in every field that has text. A frame whose English
 *     has a hole and whose script has not is a question that asks for a
 *     name and marks an answer that never contained one.
 *   * one value per slot per question, in every field at once. The prompt,
 *     the marking and the answer screen have to be looking at the same
 *     Raphael.
 *   * rotated, not drawn. `turn` is a count of how often the exercise has
 *     been asked, so the same count is the same question — a re-render
 *     cannot swap the name under somebody mid-answer, and a card with three
 *     names is met as all three before it is met as any of them twice.
 *
 * A module of its own, with one import, for the reason scheduler.ts and
 * answers.ts are: it decides what a card says, so it is somewhere a test
 * can reach and somewhere nothing can reach back into.
 */
import { splitAlternatives } from "./answers.ts";
import { leadOf } from "./cards.ts";

/*
 * What a slot looks like: {{name}}, and nothing cleverer.
 *
 * Letters, digits, dash and underscore, folded to lower case so {{Name}}
 * and {{name}} are the same hole — a teacher typing the second one on a
 * phone keyboard that capitalises the first letter of a line should not get
 * a silently different variable. Spaces inside the braces are allowed and
 * trimmed, because they will happen.
 *
 * Deliberately not a general template language. There are no filters, no
 * defaults, no nesting: everything beyond a name is a thing to learn before
 * a card can be written, and the point of the feature is a teacher writing
 * one in ten seconds.
 */
const SLOT = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

/** The fields a slot may stand in. The three a form is written in. */
export const FILLED_FIELDS = ["ar", "en", "lat"];

/**
 * The one slot nobody has to say they fill.
 *
 * Every other variable is a name a teacher invents and then writes on the
 * cards that stand in it: `name` on Raphael, on Victor, on Sarah. That is
 * right for a hole with a particular sort of thing in it, and wrong for
 * the commonest frame of all — "I like ____", "where is the ____" — where
 * what goes in the hole is simply a word the learner knows. Naming every
 * word in the deck one at a time to say so is filing, not teaching.
 *
 * So `{{word}}` is filled by any word card in the same language, with
 * nothing written on it. A teacher writes one frame and it is met with the
 * whole vocabulary, and every word added afterwards joins in without the
 * frame being touched.
 *
 * Reserved, therefore: a card saying it fills `word` adds nothing, and a
 * teacher wanting a narrower hole picks another name.
 */
export const WORD_SLOT = "word";

/**
 * Which slots a card can stand in: the one it names, and the built-in.
 *
 * The kind is passed in rather than worked out here, for the reason
 * answers.ts is handed the fields it may narrow against: what counts as a
 * word is the language's business — a script written without spaces
 * between words does not divide them the way Arabic does — and this module
 * knows no language. A caller with no opinion passes nothing and gets the
 * named slot alone, which is what every card did before this existed.
 *
 * A frame is not a filler, whatever kind it reads as. A card with a hole
 * in it dropped into somebody else's hole is a sentence with a gap where
 * the point was, and if the frame is the one being filled it is a sentence
 * inside itself.
 */
export function fillsOf(card: WithSlots | null | undefined, kind = ""): string[] {
  const named = String((card && card.fills) || "").toLowerCase();
  const out = named ? [named] : [];
  if (kind === WORD_SLOT && !hasSlots(card) && !out.includes(WORD_SLOT)) out.push(WORD_SLOT);
  return out;
}

/* A form, a card, or the half-written thing in an editor — anything with
   those three fields to read. Open for the same reason answers.ts is. */
export type WithSlots = Record<string, unknown>;

/** One card standing in for a slot: its words, in the three fields. */
export interface Value {
  id?: string;
  ar: string;
  en: string;
  lat: string;
  /**
   * What the language declares about it — its number, its gender. Carried
   * because a verb standing in the same sentence has to agree with it:
   * "Sarah ___ an apple" wants the feminine singular of the verb, and the
   * only thing that knows Sarah is one is Sarah's own card.
   *
   * Nested rather than spread flat beside the words, so a grammar field
   * can never be mistaken for one of the three fields a hole is filled
   * from. Empty for a value whose card declares nothing, which is most.
   */
  grammar?: Record<string, string>;
}

const text = (form: WithSlots | null | undefined, field: string): string => {
  const v = form ? form[field] : "";
  return typeof v === "string" ? v : v == null ? "" : String(v);
};

/** The variables named in one string, in the order they are written, once
    each — "{{name}} and {{name}}" is one hole filled twice, not two. */
export function slotsIn(value: string | null | undefined): string[] {
  const out: string[] = [];
  for (const m of String(value || "").matchAll(SLOT)) {
    const name = m[1].toLowerCase();
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/*
 * One string, cut into what is written and what is a hole.
 *
 * Everywhere a card is *asked*, the holes are filled before anyone sees
 * them. Everywhere a card is *listed*, they are not: a tile shows the
 * frame as the teacher wrote it, braces and all, because that is what the
 * card is. The braces then have to be drawn, and a screen that draws them
 * has to be able to tell them from the words around them — which is a
 * question about pieces of the string, not about the string.
 *
 * So the cutting is here, with the pattern it depends on, and what to do
 * with each piece is the screen's business. Runs come back in order and
 * joining their text gives the original back, empty pieces and all
 * dropped; `slot` is the variable's name, lower-cased as everywhere else,
 * and absent on the plain runs.
 */
export function splitSlots(value: string | null | undefined): { text: string; slot?: string }[] {
  const whole = String(value || "");
  const out: { text: string; slot?: string }[] = [];
  let at = 0;
  for (const m of whole.matchAll(SLOT)) {
    const start = m.index || 0;
    if (start > at) out.push({ text: whole.slice(at, start) });
    out.push({ text: m[0], slot: m[1].toLowerCase() });
    at = start + m[0].length;
  }
  if (at < whole.length) out.push({ text: whole.slice(at) });
  return out;
}

/**
 * Every variable a form names, across the fields it is written in.
 *
 * Asked of a whole card as well as of a form — "has this card a hole in
 * it" is what keeps a frame out of a matching grid and out of the words
 * offered as wrong answers — so it reads the card's own word, which since
 * 0.138 is the first of its forms rather than the card itself. A plain
 * form is its own lead, so both kinds of caller read the same.
 */
export function slotsOf(form: WithSlots | null | undefined): string[] {
  const word = leadOf(form) as WithSlots;
  const out: string[] = [];
  for (const field of FILLED_FIELDS) {
    for (const name of slotsIn(text(word, field))) if (!out.includes(name)) out.push(name);
  }
  return out;
}

export const hasSlots = (form: WithSlots | null | undefined): boolean => slotsOf(form).length > 0;

/*
 * Whether the fields agree about their holes.
 *
 * Checked when a card is saved rather than when it is asked, because the
 * moment to hear about it is while the person who can fix it is looking at
 * it. A field with nothing in it is not disagreeing — a card with no
 * transliteration is an ordinary card, not a broken one.
 *
 * Comes back as the field that disagrees and what it is missing, or null
 * when they are in step, so the caller can say it in its own words.
 */
export function slotTrouble(
  form: WithSlots | null | undefined,
): { field: string; missing: string[]; extra: string[] } | null {
  const all = slotsOf(form);
  if (!all.length) return null;
  for (const field of FILLED_FIELDS) {
    const written = text(form, field).trim();
    if (!written) continue;
    const here = slotsIn(written);
    const missing = all.filter((s) => !here.includes(s));
    const extra = here.filter((s) => !all.includes(s));
    if (missing.length || extra.length) return { field, missing, extra };
  }
  return null;
}

/*
 * The cards that can fill each of a form's slots.
 *
 * Kept to one language: a Vietnamese name in an Arabic frame is not a
 * variation on the sentence, it is a different sentence. The caller hands
 * in the cards it holds — the learner's own material, or the teacher's —
 * because who is asking decides where they come from, and this module has
 * no business knowing about either.
 *
 * A value with nothing in its script is not a value: it would fill the hole
 * with nothing and leave a sentence with a gap where the point was.
 */
export function valuesFor(
  form: WithSlots | null | undefined,
  pool: WithSlots[],
  lang?: string,
  /** What kind of card this is — see fillsOf. Without it, only named slots. */
  kindOf?: (card: WithSlots) => string,
): Record<string, Value[]> {
  const wanted = slotsOf(form);
  const out: Record<string, Value[]> = {};
  for (const slot of wanted) out[slot] = [];
  if (!wanted.length) return out;
  for (const card of pool || []) {
    if (lang && card.lang && card.lang !== lang) continue;
    const slots = fillsOf(card, kindOf ? kindOf(card) : "");
    if (!slots.length) continue;
    const value = valueOf(card);
    if (!value.ar) continue;
    /* A card may stand in more than one hole now: the one it names, and
       the built-in that every word fills. */
    for (const slot of slots) if (out[slot]) out[slot].push(value);
  }
  return out;
}

/*
 * One card, as the words it lends.
 *
 * The first accepted answer rather than the field as written: a value card
 * may accept two spellings, and "كتاب / سفر" dropped whole into a sentence
 * is not a sentence. The first is the one the teacher wrote first.
 */
export function valueOf(card: WithSlots | null | undefined, fields: string[] = []): Value {
  /* The words come off the card's own word, which since 0.138 is the first
     of its forms rather than the card itself. A plain form handed in here
     — a line of a dialog, a unit the scheduler is holding — is its own
     lead, so both kinds of caller read the same. The id stays the card's:
     what a hole is filled with is *this card*, and the ladder a value is
     gated on is looked up by it. */
  const word = leadOf(card) as WithSlots;
  const first = (field: string) => (splitAlternatives(text(word, field))[0] || "").trim();
  /* Which fields hold a grammatical value is the language table's answer
     and not this module's, so the names are passed in, exactly as
     answers.ts is handed the fields it may narrow against. Read off the
     card rather than off its first answer: a value card is one word with
     one set of values, and the flat fields are what every writer of one —
     the editor, an import, the server — actually sets. */
  const grammar: Record<string, string> = {};
  for (const field of fields) {
    const value = text(word, field).trim();
    if (value) grammar[field] = value;
  }
  return {
    id: String((card && card.id) || ""),
    ar: first("ar"),
    en: first("en"),
    lat: first("lat"),
    ...(Object.keys(grammar).length ? { grammar } : {}),
  };
}

/*
 * Which value each slot takes, this time round.
 *
 * An odometer rather than one index shared by every slot: with two slots of
 * three values each, sharing an index would only ever show three of the
 * nine sentences the card can make. The first slot turns every time, the
 * second every time the first comes round, and every combination is reached
 * before any is repeated.
 *
 * Nothing is drawn. `turn` is a count the caller keeps — how often this
 * exercise has been answered right, in the app — so the same count is the
 * same sentence, and a sentence that was missed is the one asked again.
 *
 * Null when any slot has nothing to fill it: a sentence with a hole in it
 * is not a question, and unmetNeeds keeps it from being asked at all.
 */
export function valuesForTurn(
  slots: string[],
  have: Record<string, Value[]>,
  turn = 0,
): Record<string, Value> | null {
  const at = Math.abs(Math.round(Number(turn) || 0));
  const out: Record<string, Value> = {};
  let rolled = at;
  for (const slot of slots) {
    const list = (have && have[slot]) || [];
    if (!list.length) return null;
    out[slot] = list[rolled % list.length];
    rolled = Math.floor(rolled / list.length);
  }
  return out;
}

/*
 * Which values a learner is far enough along to meet in a hole.
 *
 * A hole was filled from every card that could fill it, in the order they
 * were written, whatever the learner had met. So "I like {{word}}" walked
 * the whole vocabulary — including the nine words in ten that have not been
 * dealt yet, because new cards arrive ten at a time — and *English → script*
 * on it asked somebody to write a sentence containing a word they had never
 * seen. There is no answer to that question. It is not a hard question, it
 * is an unanswerable one, and the card it was really about was the frame.
 *
 * So a value has to be as far along as the question is asking. The two
 * kinds of value answer that differently, because only one of them has a
 * ladder of its own:
 *
 *   * **A value that is drilled** — an ordinary word, which is what fills
 *     `{{word}}` — is read through `reach`: how far up its own ladder it
 *     has climbed. To stand in a question that asks the word to be written
 *     from its meaning, it must be a word the learner can write from its
 *     meaning. That is the same sentence twice, which is the point.
 *
 *   * **A value that is not drilled** — Raphael, which is in the deck to be
 *     borrowed and is never dealt on its own — has no ladder and never
 *     will. The frame is the only place it is ever met, so what is read
 *     instead is the frame's own record of having met it: a value may stand
 *     one level above the highest it has already been seen at, and no
 *     higher. It enters on the bottom level, where nothing is below it to
 *     have been seen at, and climbs with the card that teaches it.
 *
 * `reach` comes back null for the second kind, which is how they are told
 * apart — the caller knows what is drilled and this module knows what the
 * rule is.
 */
export function valuesAt(
  list: Value[],
  slot: string,
  level: number,
  reach: (value: Value) => number | null,
  met?: Record<string, number> | null,
): Value[] {
  return (list || []).filter((value) => {
    const climbed = reach(value);
    if (climbed === null || climbed === undefined) return metAt(met, slot, value) >= level - 1;
    return climbed >= level;
  });
}

/*
 * Where a frame records having met one of its values.
 *
 * By the value's id, falling back to its script for a value carrying none —
 * the words are what the learner saw, and a value with no id is one nothing
 * else can point at either. Slot-first so the same card standing in two
 * different holes of one sentence is two records, which it is: meeting
 * Raphael as the speaker is not meeting him as the person spoken to.
 */
export const metKeyOf = (slot: string, ref: string): string => `${slot}:${ref || ""}`;

/* A value as the thing that points at it — its id, or its script where it
   carries none. The same string fillForm writes into `filled`, which is
   what lets a question be recorded from what it was asked with rather than
   by working the values out a second time. */
export const refOf = (value: Value): string => (value && (value.id || value.ar)) || "";

export const metKey = (slot: string, value: Value): string => metKeyOf(slot, refOf(value));

/** The highest level this frame has been asked at with a value. */
export const metAt = (
  met: Record<string, number> | null | undefined,
  slot: string,
  value: Value,
): number => Math.max(0, Math.round(Number((met || {})[metKey(slot, value)]) || 0));

/*
 * The record, with one asking written into it.
 *
 * A high-water mark, never a log: the only question asked of it is "how far
 * has this value been seen", so a level below one already recorded changes
 * nothing. That is also what makes it safe on two devices — max is the same
 * answer whichever order the two arrive in, which is the one thing sync
 * asks of anything it merges.
 *
 * Comes back **null** where nothing moved, which is the answer on every
 * card that leaves no hole — the overwhelming majority. Null rather than
 * the record it was given, because a form with no record has none to give
 * back, and returning a fresh empty object for it had every card in the
 * document start carrying an empty one the first time it was answered.
 */
export function noteMet(
  met: Record<string, number> | null | undefined,
  filled: Record<string, string> | null | undefined,
  level: number,
  keep: (ref: string) => boolean = () => true,
): Record<string, number> | null {
  const had = met || {};
  const at = Math.max(0, Math.round(Number(level) || 0));
  let out: Record<string, number> | null = null;
  for (const [slot, ref] of Object.entries(filled || {})) {
    if (!ref || !keep(ref)) continue;
    const key = metKeyOf(slot, ref);
    if ((Number(had[key]) || 0) >= at) continue;
    if (!out) out = { ...had };
    out[key] = at;
  }
  return out;
}

/* Two records of the same thing, from two devices. Max per key, for the
   reason noteMet is a high-water mark: it is the same answer whichever
   order they arrive in, and running it twice changes nothing. */
export function mergeMet(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...(a || {}) };
  for (const [key, level] of Object.entries(b || {})) {
    const n = Math.max(0, Math.round(Number(level) || 0));
    if (n > (out[key] || 0)) out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

/* One string, with its holes filled. A slot nobody offered a value for is
   left standing rather than blanked: the caller is meant to have checked,
   and a visible {{name}} is a bug report where a silent gap is a mystery. */
export function fillText(
  value: string | null | undefined,
  values: Record<string, Value>,
  field = "ar",
): string {
  return String(value || "").replace(SLOT, (whole, name) => {
    const took = values && values[String(name).toLowerCase()];
    if (!took) return whole;
    const word = (took as unknown as Record<string, string>)[field];
    return word === undefined || word === "" ? whole : word;
  });
}

/*
 * The form, as the question asks it.
 *
 * Every field filled from the same values, which is the whole point: the
 * prompt says Raphael, the answer expects Raphael, and the screen after it
 * says Raphael. `filled` rides along so a caller can tell a question that
 * was filled from one that never had a hole — the editor's preview reads
 * it, and so does anything that must not offer to record this.
 */
export function fillForm<T extends WithSlots>(form: T, values: Record<string, Value> | null): T {
  if (!values) return form;
  const out: Record<string, unknown> = { ...form };
  for (const field of FILLED_FIELDS) {
    const written = text(form, field);
    if (written) out[field] = fillText(written, values, field);
  }
  /* The answers array is written from `ar` and would otherwise still hold
     the frame — see answersOf, which prefers it where the two agree. Filled
     the same way, from the same values, so they cannot disagree. */
  if (Array.isArray(form.answers)) {
    out.answers = (form.answers as Record<string, unknown>[]).map((a) => ({
      ...a,
      text: fillText(typeof a.text === "string" ? a.text : "", values, "ar"),
      lat: fillText(typeof a.lat === "string" ? a.lat : "", values, "lat"),
    }));
  }
  out.filled = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.id || v.ar]));
  return out as T;
}
