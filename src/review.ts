/*
 * A teacher's say-so on the sentences a frame makes.
 *
 * A sentence card is a frame with holes in it, and the app fills the holes
 * from the rest of the collection each time the card is asked. That is how
 * one card becomes a hundred sentences — and it is also how a sentence
 * nobody has read reaches a student: every rule the app fills by (the kind
 * of word that fits, the form that agrees, the cell of a verb's table) is
 * right in general, and a language is full of the cases where it is not.
 * "I drank a {{noun}}" filled with *a bread* is grammatical, correctly
 * agreed, and something nobody says.
 *
 * So a teacher reads what a frame makes before a student meets it. This
 * module is the part of that which is a fact about text and nothing else:
 *
 *   * **what a filled sentence is called** — `sentenceKey`, a fingerprint
 *     of exactly the words a student would see. Approval is kept as a list
 *     of these, which is what makes it hold up under editing without any
 *     bookkeeping: change the frame, or a word that fills it, and the
 *     sentences it makes are different words with different fingerprints,
 *     so they are new and wait for the teacher. What was approved stays
 *     approved exactly as long as it is what the student is shown. And a
 *     sentence nobody has fingerprinted — made from a word the teacher's
 *     screen did not know about — is simply not on the list, so the gate
 *     fails shut.
 *
 *   * **which sentences a frame makes today** — `sentencesOf`, walking the
 *     same combinations the practice screen walks, *including* the step
 *     that swaps an adjective for the form that agrees with its noun and
 *     fills a verb's own place from its table. The teacher's older preview
 *     stopped short of that step, so it showed the masculine where a
 *     student saw the feminine; a review of that list would have been a
 *     review of sentences nobody is asked.
 *
 *   * **where a card stands** — `reviewState`: nothing to review, live from
 *     before this existed, or reviewed with so many still waiting.
 *
 * What is stored is `review` on the card: `ok`, the fingerprints approved,
 * and `no`, the ones struck. A card without it was written before review
 * existed and is asked as it always was; a card with it is asked only in
 * the sentences on `ok`. See DECISIONS.md, "A sentence is shown once a
 * teacher has read it".
 */
import type { Form, Lang } from "./types.ts";
import { formsOf } from "./cards.ts";
import { linesOf } from "./dialogs.ts";
import { agreementOf, blankAdmits, grammarFields, kindOf, lendsForm, verbOf } from "./languages.ts";
import { isAsked } from "./scheduler.ts";
import type { Value } from "./variables.ts";
import { fillForm, fillsOf, lentBy, refOf, slotsOf, valuesForTurn } from "./variables.ts";
import { agreedCell, agreedValue, agreeWith, ownSlot, rowOf, slotRows, subjectSlot } from "./verbs.ts";

type Held = Record<string, any>;

/** What a card carries once a teacher has reviewed it. */
export interface Review {
  /** Fingerprints of the filled sentences a teacher approved. */
  ok?: string[];
  /** And of the ones a teacher struck, which are never shown. */
  no?: string[];
  /** When it was last changed, and by whom. The server writes both. */
  at?: number;
  by?: string;
}

/**
 * The most sentences one frame may have and still be approved.
 *
 * Approval means *I read these*. Past a few hundred nobody reads them —
 * they read the first screenful and approve the rest on trust, which is
 * the exact failure this exists to stop. So above this the review screen
 * offers no approval at all, and asks for the blank to be narrowed until
 * the list is short enough to read.
 */
export const REVIEW_CEILING = 300;

/**
 * How many combinations a list is worked out to before it is given up on
 * as too many to count exactly.
 *
 * Combinations and sentences are not the same number — a combination whose
 * agreeing form is blank makes no sentence, and two cards carrying one
 * word make the same one — so the honest count is got by walking. Walking
 * is cheap up to a few thousand and pointless past the ceiling, so a frame
 * with more combinations than this is simply "over".
 */
export const SCAN_LIMIT = 2000;

/* Two 32-bit FNV-1a passes with different offsets, read as sixteen hex
   characters. Not a secret — a fingerprint two devices must agree on, fast
   enough to take a few thousand times in a render, and short enough that
   a card with three hundred approved sentences carries a few kilobytes. */
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * What one filled sentence is called: the three fields a student can see,
 * trimmed, fingerprinted.
 *
 * All three, because all three are shown — the script, the pronunciation
 * underneath it and the meaning — and a sentence whose Arabic is right and
 * whose English says something else is not one a teacher approved.
 */
export function sentenceKey(filled: { ar?: unknown; lat?: unknown; en?: unknown } | null | undefined): string {
  const f = filled || {};
  const text = [f.ar, f.lat, f.en].map((x) => String(x == null ? "" : x).trim()).join("\u0001");
  return fnv(text, 0x811c9dc5) + fnv(text, 0x3b9aca07);
}

/** The shape a fingerprint has, for anything that reads one off the wire. */
export const isSentenceKey = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{16}$/.test(x);

/** What a card says about its review, or null where it was never reviewed. */
export function reviewOf(card: Held | null | undefined): Review | null {
  const said = card ? card.review : null;
  return said && typeof said === "object" && !Array.isArray(said) ? (said as Review) : null;
}

/**
 * Whether a sentence may be shown: on the approved list, and not struck.
 *
 * Struck wins, so a report acted on is acted on even where an older
 * approval of the same words is still on the list.
 */
export function passes(review: Review | null | undefined, key: string): boolean {
  if (!review) return true;
  const ok = Array.isArray(review.ok) ? review.ok : [];
  const no = Array.isArray(review.no) ? review.no : [];
  return ok.includes(key) && !no.includes(key);
}

/**
 * The parts of a card that are filled before they are asked: the forms
 * with a hole in them that are asked at all, and a conversation's turns
 * with a hole in them.
 *
 * A form switched off is never dealt, so there is nothing of it to review.
 */
export function holedParts(card: Held | null | undefined): Held[] {
  const out: Held[] = [];
  for (const form of formsOf(card) as Held[]) {
    if (slotsOf(form).length && isAsked(form as Form)) out.push(form);
  }
  for (const line of linesOf(card as Held) as Held[]) if (slotsOf(line).length) out.push(line);
  return out;
}

/** Whether a card makes any sentence a teacher has to read. */
export const needsReview = (card: Held | null | undefined): boolean => holedParts(card).length > 0;

/* ------------------------------------------------------------------
   Filling one combination, exactly as the practice screen does
   ------------------------------------------------------------------ */

type Owner = { card: Held; form: Held };

/**
 * The values a sentence was filled with, with each agreeing card's own
 * word swapped for the form that agrees with the slot beside it.
 *
 * An adjective lends its own word into a hole — see lendsForm — and this
 * is where the sentence goes back to its card for the feminine beside a
 * feminine noun: the slot it agrees with is the first other one the
 * teacher wrote, its grammar picks a column, and the cell in that column
 * is what is shown. Null where the column picks a cell the teacher left
 * blank: nothing to ask and nothing to invent.
 *
 * Here rather than in the trainer since review existed, because the
 * teacher's list has to take this step too or it lists sentences nobody
 * is asked. The trainer re-exports it.
 */
export function agreeTook(
  took: Record<string, Value>,
  slots: string[],
  ownerOf: (value: Value) => Owner | null,
  langFor: (card: Held) => Lang | null | undefined,
): Record<string, Value> | null {
  const out = { ...took };
  for (const slot of slots) {
    const value = took[slot];
    const owner = value ? ownerOf(value) : null;
    if (!owner) continue;
    const spec = agreementOf(langFor(owner.card), owner.card.category);
    if (!spec) continue;
    const partner = took[agreeWith(slots, slot)] || null;
    const agreed = agreedValue(owner.card, spec, value, partner);
    if (!agreed) return null;
    out[slot] = agreed;
  }
  return out;
}

/**
 * The form of a verb a card's own sentence stands in its own place, for
 * whatever filled the subject. Null where the teacher left that cell
 * blank, or where nothing in the subject says which column to take.
 */
export function ownVerb(
  part: Held,
  card: Held,
  lang: Lang | null | undefined,
  took: Record<string, Value>,
): Value | null {
  const subject = subjectSlot(slotsOf(part));
  const filler = subject ? took[subject] : null;
  const cell = agreedCell(card, verbOf(lang), rowOf(part), filler ? filler.grammar : null);
  if (!cell || !cell.ar) return null;
  return { id: cell.id, ar: cell.ar, en: cell.en, lat: cell.lat };
}

/**
 * One combination, finished: agreement applied and a verb's own place
 * filled. Null where there is no sentence to be had from it.
 */
export function finishTook(
  part: Held,
  card: Held | null,
  turned: Record<string, Value>,
  drawn: string[],
  ownerOf: (value: Value) => Owner | null,
  langFor: (card: Held) => Lang | null | undefined,
): Record<string, Value> | null {
  const took = agreeTook(turned, drawn, ownerOf, langFor);
  if (!took) return null;
  const own = ownSlot(part);
  if (own && card && slotsOf(part).includes(own)) {
    const verb = ownVerb(part, card, langFor(card), took);
    if (!verb) return null;
    took[own] = verb;
  }
  return took;
}

/**
 * What can fill each of one part's holes, from the teacher's collection,
 * built the way a student's device builds it: oldest card first, every
 * form a card lends, carrying its grammar so the agreement step has
 * something to read, and only the forms a narrowed blank admits.
 *
 * And the owner of every form of every card that fills anything — the
 * agreement step goes back to the card for a cell nothing lent.
 */
export function reviewPool(
  part: Held,
  pool: Held[],
  lang: Lang | null | undefined,
): { values: Record<string, Value[]>; owner: Map<string, Owner> } {
  const own = ownSlot(part);
  const drawn = slotsOf(part).filter((slot) => slot !== own);
  const values: Record<string, Value[]> = {};
  for (const slot of drawn) values[slot] = [];
  const owner: Map<string, Owner> = new Map();
  const admits = blankAdmits(lang, (slot) => slotRows(part, slot));
  const langId = lang ? lang.id : "";
  const byAge = [...(pool || [])].sort(
    (a, b) => (a.created || 0) - (b.created || 0) || String(a.id).localeCompare(String(b.id)),
  );
  const fields = grammarFields();
  for (const card of byAge) {
    if (!card) continue;
    if (langId && card.lang && card.lang !== langId) continue;
    const slots = fillsOf(card, kindOf(card, lang));
    if (!slots.length) continue;
    for (const { form, value } of lentBy(card, fields, lendsForm(lang, card))) {
      const ref = refOf(value);
      if (ref) owner.set(ref, { card, form });
      for (const slot of slots) {
        if (!values[slot]) continue;
        if (!admits(card, form, slot)) continue;
        values[slot].push(value);
      }
    }
    for (const form of formsOf(card) as Held[]) {
      const ref = String((form.id && form.id !== card.id ? form.id : card.id) || "");
      if (ref && !owner.has(ref)) owner.set(ref, { card, form });
    }
  }
  return { values, owner };
}

/** One sentence a frame makes, as a student would see it. */
export interface Sentence {
  key: string;
  ar: string;
  lat: string;
  en: string;
  /** Which card stood in each hole, and the word it stood there as. */
  took: Record<string, { card: string; word: string }>;
}

/** Every sentence one part of a card makes today, or as many as are worth
    walking. */
export interface PartSentences {
  /** The part's id — a form's or a turn's. */
  id: string;
  /** How many combinations there are, before any are thrown out. */
  combos: number;
  /** Whether there were too many to walk; `list` is then a first page. */
  cut: boolean;
  list: Sentence[];
}

/**
 * The sentences one part of a card makes, walked in the order the
 * practice screen walks them and kept once each.
 *
 * `card` is the card the part belongs to, wanted for a verb's own place.
 */
export function sentencesOf(
  card: Held,
  part: Held,
  pool: Held[],
  lang: Lang | null | undefined,
  limit = SCAN_LIMIT,
): PartSentences {
  const own = ownSlot(part);
  const drawn = slotsOf(part).filter((slot) => slot !== own);
  const { values, owner } = reviewPool(part, pool, lang);
  const combos = drawn.length ? drawn.reduce((n, slot) => n * (values[slot] || []).length, 1) : 0;
  const walk = Math.min(combos, limit);
  const list: Sentence[] = [];
  const had = new Set<string>();
  const ownerOf = (v: Value) => owner.get(refOf(v)) || null;
  const langFor = () => lang;
  for (let turn = 0; turn < walk; turn++) {
    const turned = valuesForTurn(drawn, values, turn);
    if (!turned) break;
    const took = finishTook(part, card, turned, drawn, ownerOf, langFor);
    if (!took) continue;
    const filled = fillForm(part, took) as Held;
    const key = sentenceKey(filled);
    if (had.has(key)) continue;
    had.add(key);
    const who: Record<string, { card: string; word: string }> = {};
    for (const slot of drawn) {
      const lent = turned[slot];
      const from = lent ? ownerOf(lent) : null;
      who[slot] = { card: String((from && from.card.id) || ""), word: took[slot] ? took[slot].ar : "" };
    }
    list.push({
      key,
      ar: String(filled.ar || "").trim(),
      lat: String(filled.lat || "").trim(),
      en: String(filled.en || "").trim(),
      took: who,
    });
  }
  return { id: String(part.id || card.id || ""), combos, cut: combos > limit, list };
}

/** Every part of a card, listed. */
export const cardSentences = (
  card: Held,
  pool: Held[],
  lang: Lang | null | undefined,
  limit = SCAN_LIMIT,
): PartSentences[] => holedParts(card).map((part) => sentencesOf(card, part, pool, lang, limit));

/**
 * Where one card stands.
 *
 *   * `none` — nothing on it is filled, so nothing to read.
 *   * `legacy` — written before review existed and never reviewed since:
 *     asked exactly as it always was, and on the teacher's list of things
 *     to go back to.
 *   * `gated` — reviewed, or made since review existed: asked only in the
 *     sentences approved. `waiting` is how many it makes today that the
 *     teacher has neither approved nor struck.
 *
 * `over` is a card whose frame makes more sentences than anyone can read,
 * which cannot be approved until a blank is narrowed.
 */
export interface ReviewState {
  kind: "none" | "legacy" | "gated";
  sentences: number;
  approved: number;
  struck: number;
  waiting: number;
  over: boolean;
}

const NONE: ReviewState = { kind: "none", sentences: 0, approved: 0, struck: 0, waiting: 0, over: false };

/** The same reading, from lists already worked out. */
export function stateFrom(card: Held, parts: PartSentences[]): ReviewState {
  if (!parts.length) return NONE;
  const review = reviewOf(card);
  const ok = new Set(review && Array.isArray(review.ok) ? review.ok : []);
  const no = new Set(review && Array.isArray(review.no) ? review.no : []);
  let sentences = 0;
  let approved = 0;
  let struck = 0;
  let over = false;
  for (const part of parts) {
    if (part.cut) over = true;
    sentences += part.list.length;
    for (const s of part.list) {
      if (no.has(s.key)) struck++;
      else if (ok.has(s.key)) approved++;
    }
  }
  if (sentences > REVIEW_CEILING) over = true;
  const waiting = sentences - approved - struck;
  return { kind: review ? "gated" : "legacy", sentences, approved, struck, waiting, over };
}

export function reviewState(card: Held, pool: Held[], lang: Lang | null | undefined): ReviewState {
  if (!needsReview(card)) return NONE;
  return stateFrom(card, cardSentences(card, pool, lang));
}

/** Whether a card is on the teacher's list of things to read. */
export const toReview = (state: ReviewState | null | undefined): boolean =>
  !!state && (state.kind === "legacy" || (state.kind === "gated" && state.waiting > 0));

/** Where every card of a collection stands, by id — see reviewState. The
    collection is its own pool, which is what the teacher's screens hold. */
export function reviewStates(
  cards: Held[],
  langFor: (card: Held) => Lang | null | undefined,
): Map<string, ReviewState> {
  const out: Map<string, ReviewState> = new Map();
  for (const card of cards || []) {
    if (!card || !needsReview(card)) continue;
    out.set(String(card.id), reviewState(card, cards, langFor(card)));
  }
  return out;
}

/**
 * A blank narrowed to the words a teacher picked: the frame with the
 * blank renamed to a group of the teacher's own, and each picked card
 * carrying that group — the two edits "narrow this blank" is made of,
 * done in one go so the teacher is not sent off to tag twenty cards by
 * hand.
 *
 * Every place the frame writes the blank is renamed, on every form and
 * turn, and the tenses a narrowed verb blank asks for move with it. A
 * picked card already carrying the group is left alone, and one already
 * carrying as many groups as a card may is left alone too rather than
 * losing one it had. Comes back as the cards that changed, frame first.
 */
export function narrowed(
  frame: Held,
  slot: string,
  group: string,
  picked: Held[],
  maxFills = 12,
): { frame: Held; fillers: Held[] } | null {
  const from = String(slot || "").toLowerCase();
  const to = String(group || "").toLowerCase();
  if (!frame || !from || !to || from === to) return null;
  const pattern = new RegExp(`\\{\\{\\s*${from.replace(/[-]/g, "\\-")}\\s*\\}\\}`, "gi");
  const rename = (part: Held): Held => {
    const out: Held = { ...part };
    for (const field of ["ar", "en", "lat"]) {
      if (typeof part[field] === "string") out[field] = part[field].replace(pattern, `{{${to}}}`);
    }
    if (part.tenses && typeof part.tenses === "object" && part.tenses[from]) {
      const tenses: Record<string, unknown> = { ...part.tenses };
      tenses[to] = tenses[from];
      delete tenses[from];
      out.tenses = tenses;
    }
    return out;
  };
  const next: Held = { ...frame, forms: formsOf(frame).map((f) => rename(f as Held)) };
  if (Array.isArray(frame.lines)) next.lines = frame.lines.map((l: Held) => rename(l));
  const fillers: Held[] = [];
  for (const card of picked || []) {
    const said = Array.isArray(card.fills) ? card.fills.slice() : card.fills ? [card.fills] : [];
    const names = said.map((x: unknown) => String(x).toLowerCase());
    if (names.includes(to) || names.length >= maxFills) continue;
    fillers.push({ ...card, fills: [...said, to] });
  }
  return { frame: next, fillers };
}
