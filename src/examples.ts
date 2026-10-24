/*
 * The examples a verb's subjunctive is practised in.
 *
 * تاكل on its own means nothing a learner could be asked for: it is the
 * present without its b-, and it only ever follows another word — بدها
 * تاكل, لازم تاكل, رح تاكل. Asked as a word, it could only be glossed as
 * *(that) she eat*, which nobody says and nobody remembers. So it is not
 * asked as a word. The verb card carries up to three short examples with
 * a gap where the verb goes, and each subjunctive form is met inside them:
 *
 *     ar   لازم {{verb}}
 *     lat  laazim {{verb}}
 *     en   {{verb-who}} must {{verb-plain}}
 *
 * which is لازم آكل *I must eat*, لازم تاكلي *you (f) must eat*, and so
 * on down the table — one example written once, and every person of it
 * practised. The English is put together for each person from the words
 * in it (see verbReading in variables.ts), never typed per person, because
 * English has no subjunctive and the words it needs depend on the word in
 * front of the gap.
 *
 * Kept on the card rather than as forms of it: an example is not a thing
 * to learn, and nothing schedules it. What is scheduled is the form in
 * its gap, under the form's own id — see the context index, which is
 * where an example becomes somewhere a form turned up.
 *
 * Stored that way, but not written that way. A teacher writes one
 * ordinary sentence, said for one person — لازم تاكلي, *you must eat* —
 * and readExample finds the form in it and the person and the verb in
 * its English, and makes the gap and the three words out of them. See
 * "A subjunctive example is written as a sentence" in DECISIONS.md.
 *
 * Pure, and told the table rather than asking a language for it, like
 * verbs.ts.
 */
import type { Form, VerbExample, VerbSpec } from "./types.ts";
import { VERB_SLOT, cellsOf, colOf, personsOf, rowOf, tensesOf } from "./verbs.ts";
import type { Value } from "./variables.ts";
import { cellEnglish, fillText, personEnglish, slotsIn, speaks, verbPlain } from "./variables.ts";
import { splitAlternatives } from "./answers.ts";

/** The most examples a verb carries: two or three is what the owner asked
    for, and every one is asked of every person. */
export const MAX_EXAMPLES = 3;

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

/** The row of a table whose forms are practised in examples, or "" where
    it has none. */
export const examplesRowOf = (spec: VerbSpec | null | undefined): string =>
  (tensesOf(spec).find((t) => !!t.examples) || { id: "" }).id;

/** Whether one form is a cell of that row — a form asked only in the
    card's examples. */
export const inExamplesRow = (spec: VerbSpec | null | undefined, form: unknown): boolean => {
  const row = examplesRowOf(spec);
  return !!row && rowOf(form) === row && !!colOf(form);
};

/** Whether nothing at all has been written in an example. */
export const blankExample = (ex: Partial<VerbExample> | null | undefined): boolean =>
  !str(ex && ex.ar) && !str(ex && ex.lat) && !str(ex && ex.en);

/**
 * A card's examples as stored: trimmed, the blank ones dropped, at most
 * three. Anything that is not an example reads as none, rather than
 * throwing — a card is somebody's work.
 */
export function verbExamplesOf(card: unknown): VerbExample[] {
  const said = card && typeof card === "object" ? (card as Record<string, unknown>).examples : null;
  if (!Array.isArray(said)) return [];
  const out: VerbExample[] = [];
  for (const one of said) {
    if (!one || typeof one !== "object" || blankExample(one as VerbExample)) continue;
    const ex = one as Record<string, unknown>;
    const wish = str(ex.wish);
    const as = str(ex.as);
    out.push({
      ar: str(ex.ar),
      ...(str(ex.lat) ? { lat: str(ex.lat) } : {}),
      en: str(ex.en),
      ...(wish ? { wish } : {}),
      ...(as ? { as } : {}),
    });
    if (out.length >= MAX_EXAMPLES) break;
  }
  return out;
}

const READINGS = ["who", "plain", "to"].map((r) => `${VERB_SLOT}-${r}`);

/* How many times the verb's gap is written in some text. */
const gapsIn = (text: string): number => (String(text || "").match(/\{\{\s*verb\s*\}\}/gi) || []).length;

/**
 * What is wrong with one example, in the teacher's words, or "" where
 * nothing is. A blank example is not wrong: it is not there.
 */
export function exampleTrouble(ex: Partial<VerbExample> | null | undefined): string {
  if (!ex || blankExample(ex)) return "";
  const ar = str(ex.ar);
  const lat = str(ex.lat);
  const en = str(ex.en);
  if (!ar) return "Write the example in Arabic.";
  if (gapsIn(ar) !== 1) return "Put the verb gap in the Arabic once: tap “verb” under the box where the verb goes.";
  if (slotsIn(ar).some((s) => s !== VERB_SLOT)) return "The verb is the only gap an example can have.";
  if (lat && gapsIn(lat) !== 1) return "Put the verb gap in the transliteration once too.";
  if (lat && slotsIn(lat).some((s) => s !== VERB_SLOT)) return "The verb is the only gap an example can have.";
  if (!en) return "Write what the example means in English.";
  const words = slotsIn(en);
  if (words.some((w) => !READINGS.includes(w))) {
    return "In the English, use the chips under the box for the verb: person, verb or to + verb.";
  }
  if (!words.includes(`${VERB_SLOT}-who`) && !words.includes(`${VERB_SLOT}-to`)) {
    return "Use the “person” or “to + verb” chip in the English, so it changes with the person.";
  }
  return "";
}

/** Whether the English asks whose wish it is — see VerbExample.wish. */
export const asksWish = (ex: Partial<VerbExample> | null | undefined): boolean =>
  slotsIn(str(ex && ex.en)).includes(`${VERB_SLOT}-to`);

/**
 * Whose wish an example reads `{{verb-to}}` against: the one the teacher
 * chose, or the speaker where nobody has — بدي, the commonest. Nothing
 * where the English does not ask.
 */
export const wishOf = (ex: Partial<VerbExample> | null | undefined, spec: VerbSpec | null | undefined): string => {
  if (!asksWish(ex)) return "";
  const said = str(ex && ex.wish);
  if (said) return said;
  const first = personsOf(spec)[0];
  return first ? first.id : "";
};

/**
 * One example with one form in its gap: the words a question shows and
 * marks against. `card` is the verb, for the name its English is made
 * from; `cell` the form standing in the gap.
 */
export function filledExample(
  card: unknown,
  cell: Form,
  ex: VerbExample,
  spec: VerbSpec | null | undefined,
): { ar: string; en: string; lat: string } {
  const value: Value = {
    id: str(cell.id),
    ar: str(cell.ar),
    en: str(cell.en),
    lat: str(cell.lat),
    ...cellEnglish(card as Record<string, unknown>, cell as Record<string, unknown>),
    ...(speaks(cell as Record<string, unknown>) ? { keepsCase: true } : {}),
  };
  const values = { [VERB_SLOT]: value };
  const wish = wishOf(ex, spec);
  return {
    ar: fillText(ex.ar, values, "ar"),
    en: fillText(ex.en, values, "en", true, wish ? { [VERB_SLOT]: wish } : {}),
    lat: ex.lat && value.lat ? fillText(ex.lat, values, "lat") : "",
  };
}

/**
 * Every form of a card's examples row that is written, in the order the
 * language lists its persons — what the examples are asked of.
 */
export function exampleCells(card: unknown, spec: VerbSpec | null | undefined): Form[] {
  const row = examplesRowOf(spec);
  if (!row) return [];
  const order = personsOf(spec).map((p) => p.id);
  return cellsOf(card)
    .filter((c) => rowOf(c) === row && !str((c as Record<string, unknown>).of) && str(c.ar))
    .sort((a, b) => order.indexOf(colOf(a)) - order.indexOf(colOf(b)));
}

/** An example as a teacher writes it: one sentence, said for one person. */
export interface ExampleSentence {
  ar: string;
  lat?: string;
  en: string;
}

/** Whether nothing at all has been written in a sentence. */
export const blankSentence = blankExample as (said: Partial<ExampleSentence> | null | undefined) => boolean;

/**
 * Whose wish an example reads `{{verb-to}}` against where the one who
 * wants is nobody in the table — *Mum wants me to eat*. No column is it,
 * so every person reads as somebody else: *me to eat*, *her to eat*.
 */
export const SOMEONE_WISHES = "someone";

/* A gap or a reading still standing in a stored example, for showing one
   that no form can be put into yet. */
const ANY_SLOT = /\{\{\s*[^{}]*?\s*\}\}/g;

/*
 * Two spellings of one word, compared the way a teacher would: the marks
 * left off — harakat, hamza seats, macrons — and the case. Strict about
 * the letters, so بتاكل, the present, is not تاكل with something glued on.
 */
const keyOf = (word: string): string =>
  String(word || "").normalize("NFKD").replace(/[\p{M}\u0640\u200B-\u200F\uFEFF]/gu, "").toLowerCase();

/* What stands either side of a word without being part of it: any
   script's punctuation, named by its kind rather than listed, so the
   Arabic comma and question mark need no place here. Not the
   apostrophe, which a transliteration writes ʿayn with. */
const OPENS = /^(?:(?!['’])[\p{Ps}\p{Pi}\p{Po}])+/u;
const CLOSES = /(?:(?!['’])[\p{Pe}\p{Pf}\p{Po}])+$/u;

/* A sentence's words, each where it stands with what is around it left
   off. */
function wordsIn(text: string): { at: number; end: number; key: string }[] {
  const out: { at: number; end: number; key: string }[] = [];
  for (const m of String(text || "").matchAll(/\S+/gu)) {
    const token = m[0];
    const lead = (token.match(OPENS) || [""])[0].length;
    const core = token.slice(lead).replace(CLOSES, "");
    if (!core) continue;
    const at = (m.index || 0) + lead;
    out.push({ at, end: at + core.length, key: keyOf(core) });
  }
  return out;
}

/*
 * Where one of `spellings` is written in `text`, as a span of whole words:
 * every place, so a verb written twice can be told from a verb written
 * once.
 */
function spansOf(text: string, spellings: string[]): { at: number; end: number }[] {
  const words = wordsIn(text);
  const out: { at: number; end: number }[] = [];
  for (const spelling of spellings) {
    const want = wordsIn(spelling).map((w) => w.key);
    if (!want.length) continue;
    for (let i = 0; i + want.length <= words.length; i++) {
      if (want.every((k, j) => words[i + j].key === k)) {
        out.push({ at: words[i].at, end: words[i + want.length - 1].end });
      }
    }
  }
  return out;
}

const spellingsOf = (text: unknown): string[] => splitAlternatives(str(text)).map((s) => s.trim()).filter(Boolean);
const swap = (text: string, at: number, end: number, put: string): string => text.slice(0, at) + put + text.slice(end);

/* The pronouns English names the table's persons with, as the words
   stand: "you (f)" with its note, or "you" without. */
const PRONOUN = /(?<![\p{L}\p{N}'’])(i|you|he|she|we|they|me|him|her|us|them)(\s*\((?:m|f|pl|f pl)\))?(?![\p{L}\p{N}'’])/giu;
interface Pronoun { at: number; end: number; said: string; word: string; noted: boolean }
const pronounsIn = (en: string): Pronoun[] =>
  [...en.matchAll(PRONOUN)].map((m) => ({
    at: m.index || 0,
    end: (m.index || 0) + m[0].length,
    word: m[1].toLowerCase(),
    said: `${m[1]}${m[2] ? ` ${m[2].trim()}` : ""}`.toLowerCase().replace(/\s+/g, " "),
    noted: !!m[2],
  }));

/* A person's English with its note taken off: "you (f)" is "you". */
const bare = (said: string): string => said.replace(/\s*\(.*\)\s*$/, "").toLowerCase();

/* The columns one pronoun can name, as a subject (`who`) or after a
   verb (`whom`), in the order the table lists them. "you" is any of the
   yous; "you (f)" is the one. */
function colsOf(p: Pronoun, role: "who" | "whom", spec: VerbSpec | null | undefined): string[] {
  return personsOf(spec).map((q) => q.id).filter((col) => {
    const english = personEnglish(col);
    if (!english) return false;
    return p.noted ? english[role].toLowerCase() === p.said : bare(english[role]) === p.word;
  });
}

/* What one person is called in a line for the teacher: the subject's
   English, notes and all. */
const whoOf = (col: string): string => (personEnglish(col) || { who: col }).who;
const whoList = (cols: string[]): string => [...new Set(cols.map(whoOf))].map((w) => `“${w}”`).join(" or ");
const spelt = (words: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}'’])${words.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")}(?![\\p{L}\\p{N}'’])`, "iu");

type Read<T> = { ok: T; trouble: "" } | { ok: null; trouble: string };

/*
 * The English of a sentence, read: where it says who and where it says
 * the verb, made into the three words — or what it is missing. `forms`
 * are the columns the Arabic's form can be, and `form` how it is spelt,
 * for the lines that name it.
 *
 * Three shapes, tried in this order:
 *
 *     I want her to eat     whom + to + verb   {{verb-to}}, wished by I
 *     she wants to eat      to + verb          {{verb-to}}, her own wish
 *     she must eat          who … verb         {{verb-who}} … {{verb-plain}}
 *
 * "To + verb" first, because in *she wants to eat* the she is the one who
 * wants — بدها, which stays put — and reading it as the one who eats
 * would make *I wants to eat* of it.
 */
function readEnglish(
  en: string,
  forms: string[],
  form: string,
  plain: string,
  spec: VerbSpec | null | undefined,
): Read<{ en: string; col: string; wish: string }> {
  const fail = (trouble: string) => ({ ok: null, trouble }) as const;
  const said = pronounsIn(en);
  const mismatch = (p: Pronoun) => fail(`The English says “${en.slice(p.at, p.end)}”, but ${form} is ${whoList(forms)}.`);
  const to = en.match(spelt(`to ${plain}`));
  if (to) {
    const at = to.index || 0;
    const end = at + to[0].length;
    const before = said.filter((p) => p.end <= at);
    const last = before[before.length - 1];
    /* Somebody else's wish: *I want her to eat*. */
    if (last && !en.slice(last.end, at).trim() && colsOf(last, "whom", spec).length) {
      const col = forms.find((c) => colsOf(last, "whom", spec).includes(c));
      if (!col) return mismatch(last);
      const wanter = before.slice(0, -1).reverse().find((p) => colsOf(p, "who", spec).length);
      const wish = wanter ? colsOf(wanter, "who", spec)[0] : SOMEONE_WISHES;
      return { ok: { en: swap(en, last.at, end, `{{${VERB_SLOT}-to}}`), col, wish }, trouble: "" };
    }
    /* Their own: *she wants to eat*. Where nothing says who, the one
       whose name is not a pronoun — *Layla wants to eat* — is somebody
       else, so it is the form's third person if it has one. */
    const subject = [...before].reverse().find((p) => colsOf(p, "who", spec).length);
    let col = subject ? forms.find((c) => colsOf(subject, "who", spec).includes(c)) : undefined;
    if (subject && !col) return mismatch(subject);
    if (!col) col = forms.find((c) => !/^(i|you)\b/.test(bare(whoOf(c)))) || forms[0];
    return { ok: { en: swap(en, at, end, `{{${VERB_SLOT}-to}}`), col, wish: col }, trouble: "" };
  }
  const verb = en.match(spelt(plain));
  if (!verb) return fail(`Write the verb in the English as “${plain}” or “to ${plain}”.`);
  const at = verb.index || 0;
  const subject = said.filter((p) => p.end <= at && colsOf(p, "who", spec).length).pop();
  if (!subject) return fail(`Say who in the English, such as “${bare(whoOf(forms[0]))}”, so it can change for each person.`);
  const col = forms.find((c) => colsOf(subject, "who", spec).includes(c));
  if (!col) return mismatch(subject);
  const made = swap(swap(en, at, at + verb[0].length, `{{${VERB_SLOT}-plain}}`), subject.at, subject.end, `{{${VERB_SLOT}-who}}`);
  return { ok: { en: made, col, wish: "" }, trouble: "" };
}

/**
 * A sentence a teacher wrote, read as the example it is: the form of the
 * verb in it made the gap, the person and the verb in its English made
 * the three words, and who it was said for kept, so it reads back the
 * same. Or what is wrong with it, in the teacher's words.
 *
 * `cells` are the forms it may use — exampleCells — and `verbName` is
 * what the verb card is called, which its English is found by: *to eat*
 * is found as *eat*.
 */
export function readExample(
  said: Partial<ExampleSentence> | null | undefined,
  cells: Form[],
  verbName: string,
  spec: VerbSpec | null | undefined,
): Read<VerbExample> {
  const fail = (trouble: string) => ({ ok: null, trouble }) as const;
  if (!said || blankSentence(said)) return fail("");
  const ar = str(said.ar);
  const lat = str(said.lat);
  const en = str(said.en);
  if (!ar) return fail("Write the example in Arabic.");
  if (!cells.length) return fail("Fill in the forms above first, then write the example with one of them in it.");
  /* The form, which is the gap. */
  const found = cells.map((cell) => ({ cell, spans: spansOf(ar, spellingsOf(cell.ar)) })).filter((f) => f.spans.length);
  if (!found.length) return fail("Write the example with one of the forms above in it, spelt as it is there.");
  const places = new Set(found.flatMap((f) => f.spans.map((s) => `${s.at}:${s.end}`)));
  if (places.size > 1) return fail("Put the verb in the Arabic once.");
  const { at, end } = found[0].spans[0];
  const form = ar.slice(at, end);
  const forms = found.map((f) => colOf(f.cell));
  /* Who it is, and the verb, which are the English's three words. */
  if (!en) return fail("Write what the example means in English.");
  const plain = verbPlain(verbName);
  if (!plain) return fail("Give the verb its name first, such as “to eat”: the English is found by it.");
  const english = readEnglish(en, forms, form, plain, spec);
  if (!english.ok) return fail(english.trouble);
  const { col, wish } = english.ok;
  /* And the transliteration, where there is one: the same form, as the
     table writes it for that person. */
  let latGap = "";
  if (lat) {
    const own = found.filter((f) => colOf(f.cell) === col).concat(found);
    const spellings = own.flatMap((f) => spellingsOf(f.cell.lat));
    if (!spellings.length) return fail(`Add the transliteration of ${form} to the form above, or leave this box empty.`);
    const spans = spansOf(lat, spellings);
    if (!spans.length) return fail(`Write the verb in the transliteration as it is above: ${spellings[0]}.`);
    if (new Set(spans.map((s) => `${s.at}:${s.end}`)).size > 1) return fail("Put the verb in the transliteration once.");
    latGap = swap(lat, spans[0].at, spans[0].end, `{{${VERB_SLOT}}}`);
  }
  return {
    ok: {
      ar: swap(ar, at, end, `{{${VERB_SLOT}}}`),
      ...(latGap ? { lat: latGap } : {}),
      en: english.ok.en,
      ...(wish ? { wish } : {}),
      as: col,
    },
    trouble: "",
  };
}

/**
 * A stored example as the sentence a teacher reads and edits: with the
 * form of the person it was written for in its gap, or the first form
 * written where that one is not — an example from before it was kept, or
 * a form since emptied. Nothing to put in it leaves "…" where the verb
 * goes.
 */
export function sentenceOf(
  ex: VerbExample,
  cells: Form[],
  verbName: string,
  spec: VerbSpec | null | undefined,
): ExampleSentence {
  const cell = cells.find((c) => colOf(c) === str(ex.as)) || cells[0];
  if (!cell) {
    const gap = (text: string | undefined) => str(text).replace(ANY_SLOT, "…");
    return { ar: gap(ex.ar), lat: gap(ex.lat), en: gap(ex.en) };
  }
  return filledExample({ name: verbName }, cell, ex, spec);
}

/**
 * What an example comes out as for the persons it was not written for —
 * the first `count` of them, in the order the table lists them — for the
 * teacher to see it was read right.
 */
export function othersOf(
  ex: VerbExample,
  cells: Form[],
  verbName: string,
  spec: VerbSpec | null | undefined,
  count = 2,
): { ar: string; en: string; lat: string }[] {
  const mine = cells.find((c) => colOf(c) === str(ex.as)) || cells[0];
  return cells
    .filter((c) => c !== mine && str(c.ar) !== str(mine && mine.ar))
    .slice(0, count)
    .map((c) => filledExample({ name: verbName }, c, ex, spec));
}
