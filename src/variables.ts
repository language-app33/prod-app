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

/* A form, a card, or the half-written thing in an editor — anything with
   those three fields to read. Open for the same reason answers.ts is. */
export type WithSlots = Record<string, unknown>;

/** One card standing in for a slot: its words, in the three fields. */
export interface Value {
  id?: string;
  ar: string;
  en: string;
  lat: string;
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

/** Every variable a form names, across the fields it is written in. */
export function slotsOf(form: WithSlots | null | undefined): string[] {
  const out: string[] = [];
  for (const field of FILLED_FIELDS) {
    for (const name of slotsIn(text(form, field))) if (!out.includes(name)) out.push(name);
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
): Record<string, Value[]> {
  const wanted = slotsOf(form);
  const out: Record<string, Value[]> = {};
  for (const slot of wanted) out[slot] = [];
  if (!wanted.length) return out;
  for (const card of pool || []) {
    const fills = String((card && card.fills) || "").toLowerCase();
    if (!fills || !out[fills]) continue;
    if (lang && card.lang && card.lang !== lang) continue;
    const value = valueOf(card);
    if (value.ar) out[fills].push(value);
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
export function valueOf(card: WithSlots | null | undefined): Value {
  const first = (field: string) => (splitAlternatives(text(card, field))[0] || "").trim();
  return {
    id: String((card && card.id) || ""),
    ar: first("ar"),
    en: first("en"),
    lat: first("lat"),
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
 * Nothing is drawn. `turn` is a count — how often this exercise has been
 * asked of this form — so the same count is the same sentence.
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
