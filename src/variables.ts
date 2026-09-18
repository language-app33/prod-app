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
import { formsOf, leadOf } from "./cards.ts";

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
 * Which slots a card can stand in: the one it names, the kind of word it
 * is, and the built-in.
 *
 * The kind is passed in rather than worked out here, for the reason
 * answers.ts is handed the fields it may narrow against: what counts as a
 * word is the language's business — a script written without spaces
 * between words does not divide them the way Arabic does — and this module
 * knows no language. A caller with no opinion passes nothing and gets the
 * named slot alone, which is what every card did before this existed.
 *
 * **What the card says it is fills a hole of that name.** A teacher writing
 * "{{noun}} {{adjective}}" has said everything they need to say, and every
 * noun in the language joins in without being told. That is the same
 * bargain `{{word}}` makes, narrowed: naming each filler one at a time is
 * filing rather than teaching, and the card already answered the question
 * when it said what kind of word it was.
 *
 * Which names those are is *not* known here, and deliberately: the
 * category is a string on the card, the same shape as `fills`, and which
 * strings a language declares is the language pack's business. So a hole
 * is filled by a card whose own answer matches its name, and a pack that
 * declares no categories fills none of them. A teacher whose language has
 * no `noun` may still name a blank `noun` and write the cards that fill it,
 * exactly as before.
 *
 * **A sentence is not a filler**, whatever kind it reads as and whatever it
 * says it fills. A card with a hole in it dropped into somebody else's
 * hole is a sentence with a gap where the point was, and if the frame is
 * the one being filled it is a sentence inside itself. That was the stated
 * rule from the start and the code kept an exception to it: a frame that
 * named a slot by hand went on standing in other cards' holes. The
 * exception is gone as of 0.139, which is the release that made a card of
 * blanks a thing a teacher sets out to write.
 *
 * Asked of the card and not of its braces, since 0.176: a sentence written
 * before its first blank is still a sentence, and lending it out would be
 * the one thing this rule exists to stop. See isSentence.
 */
export function fillsOf(card: WithSlots | null | undefined, kind = ""): string[] {
  if (isSentence(card)) return [];
  const out = fillNames(card);
  /* And the card's own ID, which is the one name that reaches this card
     and no other: `{{colour-red}}` is a sentence asking for that word
     rather than for any word of a kind. See cardRef — the ID is the
     teacher's, and the same shape as everything else that goes in braces,
     which is what lets it be written into one. */
  const own = cardRef(card);
  if (own && !out.includes(own)) out.push(own);
  if (kind === WORD_SLOT && !out.includes(WORD_SLOT)) out.push(WORD_SLOT);
  const said = String((card && card.category) || "").toLowerCase();
  if (said && !out.includes(said)) out.push(said);
  return out;
}

/*
 * A name that can go between braces, narrowed to what a slot may be.
 *
 * One rule, in one place: the blanks a card fills, the ID it answers to
 * and the name a teacher is typing are all the same kind of string, and
 * they are all matched against the braces in somebody else's card. Lower
 * case, letters, digits, dash and underscore, and short enough to read on
 * a phone. Written before it is stored and again on the way in, so what
 * the editor shows and what the server keeps cannot come apart.
 */
export const slotName = (raw: unknown): string =>
  String(raw == null ? "" : raw)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);

/**
 * The ID a teacher gave this card, as anything asking for it by name
 * reads it.
 *
 * A card has always had an id the app minted, which nobody types and
 * nobody sees. This is the other one: the name the teacher chooses, so
 * that a sentence can borrow *this* word rather than a word of a kind —
 * "{{colour-red}} is heavy". It is narrowed like every other name that
 * goes in braces and is empty on a card written before the ID was asked
 * for, which simply fills nothing by name.
 */
export const cardRef = (card: WithSlots | null | undefined): string =>
  slotName(card ? card.ref : "");

/*
 * Whether a name is already answered to by something else.
 *
 * Both halves of the Blanks section put a name between braces — a card's
 * ID and a group tag — so the two share one namespace and a name has to be
 * free of both. Comes back as what holds it, so the editor can say which
 * card that is rather than "taken"; null where the name is free.
 *
 * `self` is the card being edited, which is never a clash with itself.
 * `{{word}}` is spoken for by every word in the language, so nothing may
 * be called it.
 */
export function refClash(
  name: string,
  pool: WithSlots[],
  self = "",
): { kind: "card" | "group"; card?: WithSlots } | null {
  const want = slotName(name);
  if (!want) return null;
  if (want === WORD_SLOT) return { kind: "group" };
  for (const card of pool || []) {
    if (String((card && card.id) || "") === self) continue;
    if (cardRef(card) === want) return { kind: "card", card };
    if (fillNames(card).includes(want)) return { kind: "group", card };
  }
  return null;
}

/*
 * One card, with a name rewritten wherever it is written or ticked.
 *
 * What "everywhere" means when a teacher renames an ID or a group tag: the
 * sentences that ask for it by that name are asking for something that no
 * longer answers, and a tag renamed on one card is a group of one. So both
 * are rewritten by the same walk — the braces in every field of every form
 * and every turn, and the tags a card carries.
 *
 * Null where nothing moved, which is the answer for almost every card in
 * the collection: the caller saves what comes back and lets the rest
 * alone.
 */
export function renamedIn<T extends WithSlots>(card: T, from: string, to: string): T | null {
  const was = slotName(from);
  const now = slotName(to);
  if (!was || !now || was === now || !card) return null;
  let moved = false;
  const rewrite = (form: WithSlots): WithSlots => {
    let next: WithSlots | null = null;
    for (const field of FILLED_FIELDS) {
      const written = text(form, field);
      if (!written) continue;
      const after = renameSlot(written, was, now);
      if (after === written) continue;
      next = next || { ...form };
      next[field] = after;
    }
    if (next) moved = true;
    return next || form;
  };
  const out: Record<string, unknown> = { ...card };
  if (Array.isArray(card.forms)) out.forms = (card.forms as WithSlots[]).map(rewrite);
  else {
    const lead = rewrite(card as WithSlots);
    if (lead !== card) for (const field of FILLED_FIELDS) out[field] = lead[field];
  }
  if (Array.isArray(card.lines)) out.lines = (card.lines as WithSlots[]).map(rewrite);
  const tags = fillNames(card);
  if (tags.includes(was)) {
    const swapped: string[] = [];
    for (const tag of tags) {
      const one = tag === was ? now : tag;
      if (!swapped.includes(one)) swapped.push(one);
    }
    out.fills = swapped;
    moved = true;
  }
  return moved ? (out as T) : null;
}

/** One string, with one slot renamed — `{{name}}` to `{{name-is}}`. */
export function renameSlot(value: string | null | undefined, from: string, to: string): string {
  const was = slotName(from);
  const now = slotName(to);
  if (!was || !now || was === now) return String(value || "");
  return String(value || "").replace(SLOT, (whole, name) =>
    String(name).toLowerCase() === was ? `{{${now}}}` : whole,
  );
}

/* ------------------------------------------------------------------
   Putting a blank into a field, and moving it about in one

   A blank used to be typed: you wrote the braces yourself, into each of
   the three fields, and a name that did not match the one on the other
   cards matched nothing for ever. The editor puts them in now — tapped in
   at the caret, or dragged to where they belong — and these are the three
   string operations that takes. Here rather than in the editor because
   they are about a string and a name, a test can ask them without a
   screen, and the same rule then holds however the blank arrives.

   **A blank is a word, and is spaced like one.** Dropped between two
   letters it takes a space on each side; taken out, it leaves one space
   rather than two, and none at all where it was the whole field. Getting
   that wrong is not cosmetic: the script is what a student's answer is
   marked against, so a doubled space is a sentence nobody can type.
   ------------------------------------------------------------------ */

/**
 * Where each blank sits in one string, in the order they are written.
 *
 * Every occurrence, not one per name — "{{a}} and {{a}}" is two places a
 * thing can be moved from, where `slotsIn` is right to call it one hole
 * filled twice. Start and end are the braces themselves, so the text
 * between them can be cut out whole.
 */
export function slotSpans(
  value: string | null | undefined,
): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = [];
  for (const m of String(value || "").matchAll(SLOT)) {
    const start = m.index || 0;
    out.push({ name: m[1].toLowerCase(), start, end: start + m[0].length });
  }
  return out;
}

/* Two halves of a string put back together where something between them
   has gone: one space where each half offered one, and no space left
   hanging off either end. */
const rejoin = (before: string, after: string): string => {
  if (!before) return after.replace(/^\s+/, "");
  if (!after) return before.replace(/\s+$/, "");
  if (/\s$/.test(before) && /^\s/.test(after)) return before + after.replace(/^\s+/, "");
  return before + after;
};

/**
 * One string with a blank written into it, at a character offset.
 *
 * The offset is where the teacher put it — a caret, or the point a chip
 * was dropped at — so it can land anywhere, including inside the braces of
 * a blank that is already there. **A blank never lands inside another**:
 * an offset within one snaps to whichever end of it is nearer, because
 * "{{na{{me}}me}}" is not a thing anybody meant and is not a thing any
 * reader here could make sense of.
 */
export function withSlotAt(
  value: string | null | undefined,
  name: string,
  at: number,
): string {
  const slot = slotName(name);
  const whole = String(value || "");
  if (!slot) return whole;
  let cut = Math.max(0, Math.min(whole.length, Math.round(Number(at) || 0)));
  for (const span of slotSpans(whole)) {
    if (cut > span.start && cut < span.end) {
      cut = cut - span.start < span.end - cut ? span.start : span.end;
      break;
    }
  }
  const before = whole.slice(0, cut);
  const after = whole.slice(cut);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const tail = after && !/^\s/.test(after) ? " " : "";
  return `${before}${lead}{{${slot}}}${tail}${after}`;
}

/** The same string with a blank's first appearance taken out of it. */
export function withoutSlot(value: string | null | undefined, name: string): string {
  const slot = slotName(name);
  const whole = String(value || "");
  if (!slot) return whole;
  const span = slotSpans(whole).find((s) => s.name === slot);
  if (!span) return whole;
  return rejoin(whole.slice(0, span.start), whole.slice(span.end));
}

/** One field, cut into what is written in it and the places a blank may go. */
export interface DropRail {
  /** Each word, and each blank already standing, in the order written. */
  pieces: { text: string; slot?: string }[];
  /**
   * The offsets a blank may be put down at: before the first piece, after
   * each of them. One more than there are pieces, always — an empty field
   * has the one place, which is the start of it.
   */
  points: number[];
}

/**
 * The places in a field a blank can be dropped, as things on a screen.
 *
 * A blank is dragged to where it belongs, and **the unit it is dragged
 * between is a word, not a character.** Two reasons, and the second is the
 * one that settles it. A gap between words is what a teacher is aiming
 * for — nobody puts a hole in the middle of a word — so word-sized targets
 * ask for the accuracy a thumb actually has. And working out which
 * character a point on the screen is over means measuring text the browser
 * has already laid out, which for a script that runs right to left and
 * joins its letters is measuring it a second way and getting a second
 * answer. Handing the browser real elements to lay out, and asking which
 * one the finger is on, has one answer and it is the right one in every
 * script.
 *
 * A blank already in the field is one piece, not the six characters of its
 * braces: it is a thing that can be dragged, and a drop point inside
 * `{{name}}` is not a place.
 */
export function dropRail(value: string | null | undefined): DropRail {
  const whole = String(value || "");
  const pieces: { text: string; slot?: string; start: number; end: number }[] = [];
  let at = 0;
  for (const run of splitSlots(whole)) {
    if (run.slot) {
      pieces.push({ text: run.text, slot: run.slot, start: at, end: at + run.text.length });
      at += run.text.length;
      continue;
    }
    const words = /\S+/g;
    let found = words.exec(run.text);
    while (found) {
      pieces.push({ text: found[0], start: at + found.index, end: at + found.index + found[0].length });
      found = words.exec(run.text);
    }
    at += run.text.length;
  }
  return {
    pieces: pieces.map((p) => (p.slot ? { text: p.text, slot: p.slot } : { text: p.text })),
    points: pieces.length ? [pieces[0].start, ...pieces.map((p) => p.end)] : [0],
  };
}

/**
 * And the same blank picked up and put down somewhere else in the string.
 *
 * The offset is read against the string as it stands *now* — with the
 * blank still in it, which is what the teacher is looking at while they
 * drag — so a drop past where it came from is shifted by what taking it
 * out removes. Dropping it on itself leaves the string alone, which is
 * what a drag that goes nowhere should cost.
 */
export function movedSlot(
  value: string | null | undefined,
  name: string,
  at: number,
): string {
  const slot = slotName(name);
  const whole = String(value || "");
  if (!slot) return whole;
  const span = slotSpans(whole).find((s) => s.name === slot);
  if (!span) return withSlotAt(whole, slot, at);
  const cut = Math.max(0, Math.min(whole.length, Math.round(Number(at) || 0)));
  if (cut >= span.start && cut <= span.end) return whole;
  const gone = withoutSlot(whole, slot);
  const shrank = whole.length - gone.length;
  return withSlotAt(gone, slot, cut < span.start ? cut : cut - shrank);
}

/**
 * How many blanks one card may say it fills.
 *
 * A limit rather than none, because `fills` is written by a teacher and
 * stored by a server, and neither wants a card carrying a thousand names.
 * Twelve is past anything a word plausibly stands in — a name that is also
 * a greeting and a subject is three — and short enough to draw as chips on
 * a phone without the section becoming the card.
 */
export const MAX_FILLS = 12;

/**
 * The blanks a card *says* it fills, in the order the teacher named them.
 *
 * One name or several. It began as one, because one is what a value is
 * usually for: Raphael fills `name` and nothing else. But a word stands in
 * more than one kind of hole as soon as a teacher writes a second frame
 * about it — a city is a `place` and a `name-is`, a colour is a `colour`
 * and a `describes` — and the only way to say so was a second card
 * carrying the same word, which is the same word learnt twice and two
 * schedules for it.
 *
 * So `fills` is a list. A card written before this carries a single
 * string, which is that list with one name in it, and is read here without
 * anything being migrated: every card ever stored goes through this
 * function and comes back as the same shape.
 *
 * Narrowed to what a slot may be named — the braces in a card are matched
 * on exactly these characters — and lowered, so {{Name}} and {{name}} are
 * one blank rather than two that look alike. Deduplicated and capped, so
 * what the editor draws and what the server stores cannot come apart.
 * The server reads it through this too, which is what keeps that true.
 */
export function fillNames(card: WithSlots | null | undefined): string[] {
  const said = card ? card.fills : null;
  const raw: unknown[] = Array.isArray(said) ? said : [said];
  const out: string[] = [];
  for (const one of raw) {
    const name = slotName(one);
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= MAX_FILLS) break;
  }
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

/**
 * Whether this card is a sentence — a frame other cards are dropped into —
 * or a word.
 *
 * **The teacher's answer, and stored.** It used to be read off the braces
 * and nothing else, which made "is this a sentence" a fact about the text
 * rather than a decision anybody had made. The editor asked which kind of
 * card it was, offered three answers, stored none of them and worked the
 * answer out again from the words next time: a sentence written before its
 * first blank reopened as a word, and a blank typed into a word turned it
 * into a sentence whether or not that was meant. Neither is the teacher's
 * to be overruled on.
 *
 * **Absent means read it the old way**, which is the whole of the
 * migration and costs nothing: a card with a hole in it was a sentence
 * before this and is one now, and pins the answer the next time it is
 * saved. Nothing has to be rewritten, and a collection half-migrated reads
 * exactly like one that is not.
 *
 * Only `true` is ever stored. A word cannot have a blank in it — see
 * `strayHoles` in the editor, which is where a save is refused — so a card
 * carrying no holes and no answer has already said it is a word, and a
 * stored `false` would be a second way of saying the same thing.
 */
export const isSentence = (card: WithSlots | null | undefined): boolean => {
  const said = card ? card.sentence : undefined;
  return said === undefined || said === null ? hasSlots(card) : !!said;
};

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
  /** Which of a card's forms it lends — see lentBy. Without it, all of them. */
  lends?: (card: WithSlots, form: WithSlots) => boolean,
): Record<string, Value[]> {
  const wanted = slotsOf(form);
  const out: Record<string, Value[]> = {};
  for (const slot of wanted) out[slot] = [];
  if (!wanted.length) return out;
  for (const card of pool || []) {
    if (lang && card.lang && card.lang !== lang) continue;
    const slots = fillsOf(card, kindOf ? kindOf(card) : "");
    if (!slots.length) continue;
    /* Every form of it, not only its own word: a plural is a word a
       sentence can be about, and so is one cell of a verb's table. */
    for (const value of valuesOf(card, [], lends ? (f) => lends(card, f) : undefined)) {
      /* A card may stand in more than one hole now: the one it names, the
         kind of word it says it is, and the built-in that every word
         fills. */
      for (const slot of slots) if (out[slot]) out[slot].push(value);
    }
  }
  return out;
}

/*
 * Every form of a card, as the words that form lends — with the form it
 * came from, for a caller that has to ask it something else.
 *
 * A card is a word together with its other forms, and every one of them is
 * a word a sentence could be about: "{{noun}} are heavy" wants the plural,
 * and "{{verb}} it" wants one cell of the table. Until 0.139 a card lent
 * its own word and nothing else, so a sentence could never be about any of
 * them.
 *
 * Each lends under **its own name**, which is what makes the rest work: how
 * far the learner has climbed is a fact about a form, and so is a frame's
 * record of having met one. The card's own word answers to the card where
 * it carries no name of its own, because that is what it was called before
 * forms had names and what every record already written points at.
 *
 * A form the teacher keeps without asking about — see `ask` — lends
 * nothing. It has no ladder to be read, so a hole filled with it would be
 * filled with a word nobody is ever taught.
 */
export function lentBy(
  card: WithSlots | null | undefined,
  fields: string[] = [],
  /**
   * Which of a card's forms it lends, where a caller has a view. A card
   * whose forms agree with what they stand beside lends its own word only:
   * the sentence picks the agreeing form, and a form that arrived by turn
   * would stand beside the wrong noun. Which cards those are is a
   * language's answer, so it is passed in; this module knows none.
   */
  lends: (form: WithSlots) => boolean = () => true,
): { form: WithSlots; value: Value }[] {
  const own = String((card && card.id) || "");
  const out: { form: WithSlots; value: Value }[] = [];
  formsOf(card).forEach((form, at) => {
    if (form && (form as WithSlots).ask === false) return;
    if (!lends(form as WithSlots)) return;
    const value = valueOf(form as WithSlots, fields);
    if (!value.ar) return;
    /* The card's own word answers to the card where the form carries no
       name of its own. */
    const named = value.id || at > 0 ? value : { ...value, id: own };
    out.push({ form: form as WithSlots, value: named });
  });
  return out;
}

/** The same, as the values alone — which is what a pool wants. */
export const valuesOf = (
  card: WithSlots | null | undefined,
  fields: string[] = [],
  lends?: (form: WithSlots) => boolean,
): Value[] => lentBy(card, fields, lends).map((lent) => lent.value);

/*
 * One form, as the words it lends — or a whole card, as its own word does.
 *
 * The first accepted answer rather than the field as written: a value card
 * may accept two spellings, and "كتاب / سفر" dropped whole into a sentence
 * is not a sentence. The first is the one the teacher wrote first.
 *
 * Handed a card, this is its own word: what a list shows and what a
 * sentence borrowed before any other form could. Handed a form, it is that
 * form — see lentBy, which is how a card lends all of them.
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
