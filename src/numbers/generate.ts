/*
 * A system, as cards and skills on a device.
 *
 * The teacher edits one document; a learner meets a pile of ordinary
 * cards and a handful of skills. Turning the first into the second is all
 * that is here, and it is pure — a system in, items out — so the fold
 * that refreshes course material can call it and a test can call it
 * without an app around either.
 *
 * Two kinds come out:
 *
 *   * **A component card per lexeme**, per override, per minute
 *     expression and per part of the day: one word to learn, with the
 *     faces it takes as cells of a table under it, drilled and scheduled
 *     by every exercise an ordinary card gets. Locked, because the
 *     teacher's screen is where the word is written.
 *   * **A range skill per range the system can build**: numbers up to
 *     nine, telling the hour. No words on it at all — what it is asked is
 *     made up when the queue is built and thrown away with the sitting. A
 *     stretch of numbers is counted with too, once a noun card can be:
 *     *3 books* is one of its questions, not a skill of its own.
 *
 * **Every id is derived from the system and the slot**, and so is every
 * form's. That is the whole of why a teacher correcting a word does not
 * cost a learner their year on it: regenerating gives back the same ids,
 * and the fold that refreshes course cards keeps the schedules under
 * them. An id built from anything that moves — a position in a list, a
 * counter, the clock — would have quietly reset the collection on every
 * edit, which is the failure this is written to avoid rather than one it
 * happens to escape.
 */
import type { Item, Form, LangId, Millis, Parked } from "../types.ts";
import type {
  Ask,
  Composer,
  CountedNoun,
  FormKey,
  NumberSystem,
  Range,
  TimeComposer,
  TimeSystem,
  Token,
} from "./types.ts";
import { askFor, countable, rangeChecks, renderAsk, probeOf, seeded } from "./range.ts";
import { COUNTING_WAS, NUMBER_CEILING, NUMBER_RANGES, countingOf, partsNow } from "./types.ts";

/** A key may name a face with a bar in it; an id may not wear one. */
const safe = (s: string) => String(s).replace(/\|/g, "~");

export const componentId = (systemId: string, slot: string) => `sys:${systemId}:${safe(slot)}`;
export const overrideId = (systemId: string, key: string) => `sys:${systemId}:override:${safe(key)}`;
export const rangeId = (systemId: string, range: string) => `sys:${systemId}:range:${range}`;

/**
 * A teacher's numbers for one language, with their clock beside them.
 *
 * The pair travels together because a time is a number with a feminine
 * noun in front of it: rendering one without the other is not possible,
 * and a caller holding only half of it would find that out at the moment
 * a question was dealt.
 */
export interface SystemSet {
  numbers: NumberSystem;
  times?: TimeSystem | null;
}

/** Which system a generated item came out of, or "" for anything else. */
export const systemIdOf = (it: { source?: unknown } | null | undefined): string => {
  const source = it && (it as { source?: unknown }).source;
  return source && typeof source === "object" && "systemId" in source
    ? String((source as { systemId: unknown }).systemId || "")
    : "";
};

/** The set a generated item belongs to, for a caller that has to render
    one of its questions. */
export const systemFor = (
  it: { source?: unknown } | null | undefined,
  sets: SystemSet[],
): SystemSet | null => {
  const id = systemIdOf(it);
  if (!id) return null;
  return (sets || []).find((set) => set.numbers && set.numbers.id === id) || null;
};

/** Whether an item is one of these rather than a card somebody wrote. */
export const isFromSystem = (it: { id?: string } | null | undefined): boolean =>
  String((it && it.id) || "").startsWith("sys:");

export const isRangeSkill = (it: { id?: string } | null | undefined): boolean =>
  /^sys:[^:]+:range:/.test(String((it && it.id) || ""));

/** The card for one of the ten figures a language writes numbers in. */
export const numeralId = (systemId: string, digit: number) => componentId(systemId, `numeral.${digit}`);

export const isNumeralCard = (it: { id?: string } | null | undefined): boolean =>
  /^sys:[^:]+:numeral\.\d$/.test(String((it && it.id) || ""));

/** The system a range's form or a card's id belongs to, read off the id. */
export const systemOfId = (id: string): string => {
  const m = /^sys:([^:]+):/.exec(String(id || ""));
  return m ? m[1] : "";
};

/**
 * The stretch of the number line a range waits on, if it waits on one.
 *
 * Numbers are learnt bottom up: 10 to 19 is said out of the words 0 to 9
 * taught, so it is not asked until 0 to 9 is cleared, and so on up. The
 * one below is the plain number range of the same system with the highest
 * start under this one's. The clock is not a stretch of the number line
 * and waits on nothing here — see `rangeChecks` — and a stretch's own
 * counting question is not what the one above waits on (`stretchOpen`).
 *
 * Found among the items given, so a stretch the learner was never handed —
 * a deck that teaches 10 to 19 and not the numbers under it — holds
 * nothing back: waiting on a skill that will never be asked would be
 * waiting for ever.
 */
export function stretchBefore<T extends Item>(it: T, items: T[]): T | null {
  const range = it.range;
  if (!isRangeSkill(it) || !range || range.kind !== "numbers" || range.counted) return null;
  const system = systemIdOf(it);
  let below: T | null = null;
  for (const other of items) {
    const r = other.range;
    if (other === it || !isRangeSkill(other) || !r || r.kind !== "numbers" || r.counted) continue;
    if (systemIdOf(other) !== system || r.from >= range.from) continue;
    if (!below || r.from > (below.range as Range).from) below = other;
  }
  return below;
}

/**
 * The stretch a word card waits with, if it waits with one.
 *
 * The words come in bottom up as the numbers do: the word for ninety is
 * on 20 to 99's screen because 20 to 99 is the first stretch to need it,
 * and a beginner handed it on the first day — beside *a million* and
 * *two thousand* — has been handed the top of the number line before the
 * bottom. So a word waits with the stretch it belongs to (see homesOf),
 * and a number written out by hand with the stretch its number is in.
 *
 * The stretch's skill is looked up by id in what the learner holds, so a
 * word whose stretch they were never handed — *seven*, brought by a deck
 * that teaches 20 to 99 alone — waits on nothing, as that stretch would
 * not. The clock's words are another system's and wait on nothing here.
 */
export function homeStretch<T extends Item>(
  it: T,
  held: (id: string) => T | undefined,
  composer: Composer | null,
): T | null {
  if (!composer || !isFromSystem(it) || isRangeSkill(it)) return null;
  const source = it.source as { slot?: unknown } | undefined;
  const slot = String((source && source.slot) || "");
  let home = "";
  if (slot.startsWith("override:")) {
    const n = figureOf(slot.slice("override:".length));
    const range = n == null
      ? null
      : composer.ranges().find((r) => r.kind === "numbers" && !r.counted && n >= r.from && n <= r.to);
    home = range ? range.id : "";
  } else {
    home = homesOf(composer).get(slot) || "";
  }
  return home ? held(rangeId(systemIdOf(it), home)) || null : null;
}

/* ---- one card ---- */

interface Made {
  id: string;
  lang: LangId;
  systemId: string;
  slot: string;
  /** The card's own word, and the faces beside it. */
  faces: { key: FormKey; text: string; label: string; lat?: string; audio?: string[] }[];
  en: string;
  note?: string;
  /** The number in the language's own figures, where it has them. */
  numeral?: string;
  now: Millis;
}

/**
 * The number a box or a written-out number stands for, read off what it is
 * called — "3", "1,000", or an override's "300|construct.f" — and null for
 * a box that is not one number, like *hundred* or *and*.
 */
export function figureOf(label: string): number | null {
  const plain = String(label || "").split("|")[0].trim();
  return /^\d{1,3}(,\d{3})*$|^\d+$/.test(plain) ? Number(plain.replace(/,/g, "")) : null;
}

/**
 * Figures as a language writes them, from the ones English uses: a whole
 * number, or a clock's hours and minutes either side of a colon. "" where
 * the language writes them the English way, or cannot write one of them.
 * The figures themselves are the pack's — `numerals` — so nothing here
 * holds a character of any language.
 */
export function inOwnFigures(digits: string, write?: ((n: number) => string) | null): string {
  if (!write || !digits) return "";
  const parts = String(digits).split(":");
  if (!parts.every((p) => /^\d+$/.test(p))) return "";
  const written = parts.map((p) =>
    parts.length > 1
      /* A clock keeps its leading nought, which a number does not have. */
      ? [...p].map((d) => write(Number(d))).join("")
      : write(Number(p)),
  );
  return written.every(Boolean) ? written.join(":") : "";
}

/** That number in the pack's own figures, or "" where it has none. */
const numeralOf = (label: string, write?: ((n: number) => string) | null): string => {
  const n = figureOf(label);
  return write && n != null ? String(write(n) || "") : "";
};

/**
 * A card from one slot's words.
 *
 * The first face is the card's own word and the rest are cells of a table
 * under it, which is the shape a verb's persons and an adjective's
 * feminine already have — so nothing on the learner's side had to be told
 * that a number is a new kind of thing.
 */
function cardOf(made: Made): Item {
  const forms: Form[] = made.faces.map((face, i) => ({
    id: `${made.id}-f~${safe(face.key)}`,
    ar: face.text,
    en: made.en,
    /* How it sounds, where the teacher wrote it. Empty where they did
       not, which is what every card written by hand carries too — and
       what decides whether the question that asks for the script from
       its transliteration is ever put to this card. */
    lat: String(face.lat || "").trim(),
    ...(i === 0 ? null : { row: "number", col: face.key, note: face.label }),
    /* On every face, because every face is asked: the question at the top
       of the card's ladder writes the word from these figures. */
    ...(made.numeral ? { numeral: made.numeral } : null),
    ...(face.audio && face.audio.length
      ? { clips: face.audio, recs: face.audio.map((id) => ({ id, label: "", speed: "" })) }
      : null),
    s: {},
  }));
  return {
    id: made.id,
    lang: made.lang,
    kind: "word",
    /* Filed under a deck by fileIntoDecks, and under nothing else: a
       name of the system's own would be one more deck on the learner's
       side, holding every part whatever the teacher handed out. */
    tags: [],
    forms,
    ...(made.note ? { note: made.note } : null),
    ...(made.numeral ? { numeral: made.numeral } : null),
    /* Where it came from, which is what a refresh matches on and what the
       card's own screen says instead of offering an edit. */
    source: { systemId: made.systemId, slot: made.slot },
    locked: true,
    drill: true,
    created: made.now,
    updated: made.now,
  } as Item;
}

/** One of the ten figures, as a card: the figure, and the number it is. */
function numeralCard(id: string, lang: LangId, systemId: string, digit: number, figure: string, now: Millis): Item {
  return {
    id,
    lang,
    kind: "word",
    tags: [],
    forms: [
      {
        id: `${id}-f0`,
        ar: "",
        en: String(digit),
        lat: "",
        numeral: figure,
        digit: true,
        s: {},
      },
    ],
    numeral: figure,
    source: { systemId, slot: `numeral.${digit}` },
    locked: true,
    drill: true,
    created: now,
    updated: now,
  } as Item;
}

/* ---- the whole set ---- */

export interface Generated {
  items: Item[];
  /** Which ranges were offered and which were held back, for the screen
      that has to say why. */
  checks: ReturnType<typeof rangeChecks>;
}

export interface GenerateOpts {
  composer: Composer | null;
  sys: NumberSystem | null;
  timeComposer?: TimeComposer | null;
  timeSys?: TimeSystem | null;
  now: Millis;
  /** How the language writes a number in its own figures, where it does —
      the pack's `numerals`. */
  numerals?: ((n: number) => string) | null;
}

export function generate({ composer, sys, timeComposer, timeSys, now, numerals }: GenerateOpts): Generated {
  if (!composer || !sys) return { items: [], checks: [] };
  const lang = sys.languageId;
  const items: Item[] = [];

  /* One card per box the teacher filled in. A box they have not reached
     yet is not a card with nothing on it — it is simply not a card. */
  for (const spec of composer.requiredSlots()) {
    const lex = sys.lexemes[spec.slot];
    if (!lex) continue;
    const faces = spec.formKeys
      .map((key) => ({
        key,
        text: String(lex.forms[key] || "").trim(),
        label: (spec.faceLabels && spec.faceLabels[key]) || labelForFace(key),
        lat: (lex.lat || {})[key],
        audio: (lex.audio || {})[key],
      }))
      .filter((f) => f.text);
    if (!faces.length) continue;
    items.push(
      cardOf({
        id: componentId(sys.id, spec.slot),
        lang,
        systemId: sys.id,
        slot: spec.slot,
        faces,
        en: spec.label,
        note: spec.hint,
        numeral: numeralOf(spec.label, numerals),
        now,
      }),
    );
  }

  /* And one per number the teacher wrote out by hand, which is a word to
     learn exactly as much as a box is — more, usually, since a teacher
     writes one out because the app got it wrong. */
  for (const [key, over] of Object.entries(sys.overrides || {})) {
    const [digits, face] = key.split("|");
    items.push(
      cardOf({
        id: overrideId(sys.id, key),
        lang,
        systemId: sys.id,
        slot: `override:${key}`,
        faces: [
          {
            key: "standalone",
            text: over.text,
            label: "",
            lat: over.lat,
            audio: over.audio || (sys.curatedAudio || {})[key],
          },
        ],
        en: digits,
        note: face ? labelForFace(face as FormKey) : undefined,
        numeral: numeralOf(digits, numerals),
        now,
      }),
    );
  }

  if (timeComposer && timeSys) {
    for (const spec of timeComposer.requiredSlots()) {
      const lex = timeSys.lexemes[spec.slot];
      const text = String((lex && lex.forms.standalone) || "").trim();
      if (!text) continue;
      items.push(
        cardOf({
          id: componentId(timeSys.id, spec.slot),
          lang,
          systemId: timeSys.id,
          slot: spec.slot,
          faces: [
            {
              key: "standalone",
              text,
              label: "",
              lat: (lex.lat || {}).standalone,
              audio: (lex.audio || {}).standalone,
            },
          ],
          en: spec.label,
          note: spec.hint,
          now,
        }),
      );
    }
    /* A minute expression is a word to learn in its own right: *quarter
       past* is not built out of anything a learner already has. */
    for (const [mark, expr] of Object.entries(timeSys.minuteExprs || {})) {
      items.push(
        cardOf({
          id: componentId(timeSys.id, `min.${mark}`),
          lang,
          systemId: timeSys.id,
          slot: `min.${mark}`,
          faces: [{ key: "standalone", text: expr.text, label: "", lat: expr.lat, audio: expr.audio }],
          en: expr.en || `${mark} ${expr.refHour === "next" ? "to" : "past"}`,
          now,
        }),
      );
    }
    /* And a time written out by hand — noon, midnight — for the reason a
       number written out is a card: it is a thing to learn, and it was
       not one, so nothing about reading it was ever kept. */
    for (const [key, over] of Object.entries(timeSys.overrides || {})) {
      const [clock] = key.split("|");
      items.push(
        cardOf({
          id: overrideId(timeSys.id, key),
          lang,
          systemId: timeSys.id,
          slot: `override:${key}`,
          faces: [{ key: "standalone", text: over.text, label: "", lat: over.lat, audio: over.audio }],
          en: clock,
          /* A time written out by hand is met on a clock as much as a
             number is on a price, so it carries the clock in the
             language's own figures as a number card does. */
          numeral: inOwnFigures(clock, numerals),
          now,
        }),
      );
    }
    for (const period of timeSys.periods || []) {
      items.push(
        cardOf({
          id: componentId(timeSys.id, `period.${period.slot}`),
          lang,
          systemId: timeSys.id,
          slot: `period.${period.slot}`,
          faces: [{ key: "standalone", text: period.text, label: "", lat: period.lat, audio: period.audio }],
          en: period.en || period.slot,
          now,
        }),
      );
    }
  }

  /*
   * And the ten figures themselves, where the language has figures of its
   * own: a card each for nought to nine.
   *
   * Every number is written in these, so they are what reading and
   * writing forty-seven in them comes down to — and they are learnt once, as ten cards,
   * rather than again on every number. A card each rather than one skill,
   * because two figures alike are confused with each other and not with the rest,
   * and a schedule per figure is what comes back to the one that is.
   *
   * Nothing a teacher writes: the figures are the language's, so a system
   * with no boxes filled in yet still has them. They carry no word at all
   * — `digit` is what their two questions need, and no other question can
   * be asked of them.
   */
  if (numerals) {
    for (let d = 0; d <= 9; d++) {
      const figure = String(numerals(d) || "");
      if (!figure) continue;
      items.push(numeralCard(numeralId(sys.id, d), lang, sys.id, d, figure, now));
    }
  }

  /* ---- the skills ---- */

  const checks = rangeChecks(composer, sys, timeComposer, timeSys);
  /* Whether anything at all has been recorded, which is what decides
     whether a listening question can ever be offered on a range. Which
     *value* has a recording is a question for the moment one is dealt —
     see the sampler — and is not a fact about the skill. */
  const heard = items.some((it) => ((it.forms[0] || {}).recs || []).length);
  for (const check of checks) {
    if (!check.open) continue;
    items.push(rangeItem(check.range, sys, lang, now, heard, !!(check.counting && check.counting.open), !!numerals));
  }

  return { items, checks };
}

/**
 * A skill, as an item the scheduler can hold.
 *
 * One form and no words on it. `range` is what every gate reads: an
 * ordinary exercise asks a form for its word and finds nothing, and a
 * range exercise asks for this and finds it, so neither kind of question
 * can be dealt to the wrong kind of card without anybody writing a rule
 * about it.
 */
function rangeItem(
  range: Range,
  sys: NumberSystem,
  lang: LangId,
  now: Millis,
  heard: boolean,
  /* Whether its counting question can be asked: a noun card can be
     counted across the whole stretch. See RangeCheck.counting. */
  counts = false,
  /* Whether the language writes numbers in figures of its own, which is
     what the top of the skill is then asked from. */
  figures = false,
): Item {
  const id = rangeId(sys.id, range.id);
  const form: Form = {
    id: `${id}-f0`,
    ar: "",
    en: "",
    lat: "",
    /*
     * The markers the gates read, and the whole of how a range and a word
     * stay out of each other's questions.
     *
     * An ordinary exercise asks a form for its word and finds nothing
     * here; a range exercise asks for one of these and finds nothing on a
     * word. Which family it is has to be said as well as *that* it is a
     * range, because reading a number, counting a thing and telling the
     * time are three sets of questions. A stretch that can be counted
     * with carries two of them, so its counting question is one more on
     * its ladder — at the top, beside writing the number out — and goes
     * the moment the last noun card that could be counted does. Nobody
     * wrote a rule about any of this: it falls out of what each exercise
     * declares it needs.
     */
    range: true,
    ...(range.kind === "time"
      ? { rangeTime: true }
      : { rangeNumbers: true, ...(counts ? { rangeCounted: true } : null) }),
    ...(figures ? { rangeFigures: true } : null),
    ...(heard ? { recs: [{ id: "system", label: "", speed: "" }] } : null),
    s: {},
  };
  return {
    id,
    lang,
    kind: "word",
    tags: [],
    name: range.label,
    forms: [form],
    range,
    source: { systemId: sys.id, slot: `range:${range.id}` },
    locked: true,
    drill: true,
    created: now,
    updated: now,
  } as Item;
}

/** What a face is called to a learner reading a card. */
function labelForFace(key: FormKey | string): string {
  return (
    {
      standalone: "",
      m: "with a masculine word",
      f: "with a feminine word",
      "construct.m": "before a masculine noun",
      "construct.f": "before a feminine noun",
      company: "inside a bigger number",
    }[key] || ""
  );
}

/* ---- what a learner already earned on the card this replaces ---- */

/**
 * A year on the word for *forty*, handed to the card that replaces it.
 *
 * The teacher's old number cards became boxes in a system, and the cards
 * under those boxes are new cards with new ids. Nothing about them is the
 * same as far as a schedule is concerned — so without this, every learner
 * who could already read *forty* would be asked it again as though they
 * had never seen it, on the day their teacher opened a screen.
 *
 * `migratedFrom` is what makes it possible: the migration wrote down which
 * card each box was filled from, so this can find the old card in the
 * learner's own collection and move its schedule across.
 *
 * Three rules, and each is the difference between this and a mess:
 *
 *   * **Only onto a card that has no schedule.** A device that has been
 *     asking these cards for a week has the real answer; the old card's is
 *     older. This runs, in effect, once per learner per box.
 *   * **The word's own schedule only.** The faces under it are cells of a
 *     table the old model never had, so there is nothing of theirs to
 *     inherit and nothing is invented for them.
 *   * **Nothing is taken away.** The old card keeps everything it has. It
 *     is still on the device, still in its deck, and a later release is
 *     what removes it.
 */
export function handOn(fresh: Item[], held: Item[], sys: NumberSystem): Item[] {
  const from = sys.migratedFrom || {};
  if (!Object.keys(from).length) return fresh;
  const byId = new Map(held.map((i) => [i.id, i]));
  return fresh.map((item) => {
    const source = item.source;
    const slot = source && typeof source === "object" && "slot" in source
      ? String((source as { slot?: unknown }).slot || "")
      : "";
    const wasId = slot ? from[slot] : "";
    if (!wasId) return item;
    /* Already on this device: whatever it has learnt since is the answer,
       and an older schedule is not an improvement on it. */
    if (byId.has(item.id)) return item;
    const was = byId.get(wasId);
    const old = was && was.forms && was.forms[0];
    if (!old) return item;
    const states = old.s || {};
    if (!Object.keys(states).length && !old.met) return item;
    const forms = item.forms.slice();
    forms[0] = {
      ...forms[0],
      s: { ...states },
      ...(old.met ? { met: old.met } : null),
    };
    return { ...item, forms };
  });
}

/* ---- a range split in parts ---- */

/**
 * What a learner had earned on a range that has since been split, handed
 * to each of its parts.
 *
 * 0 to 10 and 11 to 99 are 0 to 9, 10 to 19 and 20 to 99 (see
 * NUMBER_RANGES, whose `was` names the old part). The parts have ids of
 * their own, so without this a learner who could read 47 would start
 * each part from nothing. Same rules as handOn: only
 * onto a part this device has never held, from the old range whether it
 * is still here or set aside in the drawer, and nothing taken away.
 */
export function handOnSplit(
  fresh: Item[],
  held: Item[],
  parked: Record<string, Parked>,
  systemId: string,
): Item[] {
  const byId = new Map(held.map((i) => [i.id, i]));
  return fresh.map((item) => {
    const range = item.range;
    const was = range ? range.was || "" : "";
    if (!was || byId.has(item.id)) return item;
    const oldId = rangeId(systemId, was);
    const old = byId.get(oldId);
    const states =
      (old && old.forms[0] && old.forms[0].s) ||
      ((parked[oldId] && parked[oldId].forms[`${oldId}-f0`]) || {}).s ||
      {};
    if (!Object.keys(states).length) return item;
    const forms = item.forms.slice();
    forms[0] = { ...forms[0], s: { ...states } };
    return { ...item, forms };
  });
}

/* ---- the counting parts, folded into the stretches ---- */

/**
 * What a learner had earned counting things, handed to the stretch whose
 * counting question it now is.
 *
 * Counting was three parts of its own and is a question each stretch asks
 * (see COUNTING_STRETCHES), so the schedule a learner built on *3 books*
 * is on a part that is no longer made. Unlike a split, the stretch it
 * goes to is usually already on the device, with a schedule of its own
 * for every other question — so this hands on only the exercises the
 * stretch has nothing on, and says so as `carried` on a stretch already
 * held: the fold keeps the learner's own schedules over anything fresh,
 * and adds these beneath them (see foldForms). A stretch the device has
 * never held takes them straight into its schedule.
 *
 * From the old part whether it is still on the device or already set
 * aside in the drawer, the best one first — see COUNTING_WAS — and
 * nothing taken away from it.
 */
export function handOnCounting(
  fresh: Item[],
  held: Item[],
  parked: Record<string, Parked>,
  systemId: string,
): Item[] {
  const byId = new Map(held.map((i) => [i.id, i]));
  const statesOf = (id: string): NonNullable<Form["s"]> => {
    const old = byId.get(id);
    return (old && old.forms[0] && old.forms[0].s) || ((parked[id] && parked[id].forms[`${id}-f0`]) || {}).s || {};
  };
  return fresh.map((item) => {
    const range = item.range;
    const from = range ? COUNTING_WAS[range.id] : null;
    if (!range || !from || !range.counts) return item;
    const had = byId.get(item.id);
    const mine = (had && had.forms[0] && had.forms[0].s) || {};
    let carried: Form["s"] | null = null;
    for (const was of from) {
      const states = statesOf(rangeId(systemId, was));
      const handed = Object.fromEntries(Object.entries(states).filter(([type]) => !(type in mine)));
      if (Object.keys(handed).length) {
        carried = handed;
        break;
      }
    }
    if (!carried) return item;
    const forms = item.forms.slice();
    forms[0] = had
      ? { ...forms[0], carried }
      : { ...forms[0], s: { ...carried, ...(forms[0].s || {}) } };
    return { ...item, forms };
  });
}

/* ---- which deck a number is in ---- */

/**
 * The askings of a range worth reading for which words it uses.
 *
 * Every one, where there are few enough to say them all — up to 999, and
 * every hour at every minute the range draws — and otherwise the probe
 * that decides whether the range is open, with a few hundred draws beside
 * it, which reach every word a thousand to a million is built of.
 */
function askingsOf(range: Range, sys: NumberSystem, composer: Composer | null): Ask[] {
  if (range.kind === "time") {
    const minutes = range.marks && range.marks.length
      ? range.marks
      : Array.from({ length: 60 }, (_, m) => m);
    const out: Ask[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (const minute of minutes) {
        out.push({ rangeId: range.id, kind: "time", value: h, minute, style: range.style || "colloquial", period: !!range.period });
      }
    }
    return out;
  }
  /* One noun of each gender, where the range counts: which words a
     counted number is said with turns on the gender alone — the noun
     itself is no card's word — so the rest would only multiply the
     askings. Which noun is asked is chosen when one is drawn; see
     askKnown. */
  const nouns = range.counted ? onePerGender(countable(range, composer, sys)).map((n) => n.id) : [undefined];
  const values = range.to - range.from <= 1000
    ? Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i)
    : probeOf(range).concat(
        Array.from({ length: 300 }, (_, i) => askFor(range, `words ${i}`, sys, composer).value),
      );
  return values.flatMap((value) =>
    nouns.map((nounId) => ({ rangeId: range.id, kind: "numbers" as const, value, ...(nounId ? { nounId } : null) })),
  );
}

/**
 * The cards a range is built out of: every word that stands in one of its
 * askings. A part put in a deck brings these with it — *forty* and
 * *seven* come with 11 to 99 — so a learner is never asked a number whose
 * words are in no deck they hold.
 *
 * `ids` is every card the system made, which is what a slot is matched
 * against: a time is said partly in the clock's own words and partly in
 * the numbers', and the slot alone does not say which.
 */
export function wordsOfRange(
  range: Range,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
): Set<string> {
  const out = new Set<string>();
  for (const { words } of askingsWithWords(range, set)) {
    for (const id of words) if (ids.has(id)) out.add(id);
  }
  return out;
}

/**
 * The cards one token of a rendering could be written on. A slot names a
 * box and not a system, and a time is said partly in the clock's words
 * and partly in the numbers', so a slot is every card it could be and the
 * caller keeps the ones it holds.
 */
export function cardsOfToken(t: Token, numbersId: string, timeId: string): string[] {
  /* A number written out, or a time: which one is a fact about the
     document, so both are named and the caller keeps the one it holds. */
  if (t.override) return [overrideId(numbersId, t.override), timeId ? overrideId(timeId, t.override) : ""].filter(Boolean);
  if (!t.slot) return [];
  return [
    componentId(numbersId, t.slot),
    timeId ? componentId(timeId, t.slot) : "",
    /* A minute expression is written `minute.15` in a rendering and made
       as `min.15` — see generate. */
    timeId && t.slot.startsWith("minute.") ? componentId(timeId, `min.${t.slot.slice(7)}`) : "",
  ].filter(Boolean);
}

/*
 * Remembered per system: which words each asking of a range stands on is
 * a fact about the teacher's document, which is a new object whenever it
 * changes. A hundred to 999 is nine hundred renderings, and a session
 * asks for them once per question dealt.
 */
const ASKINGS: WeakMap<NumberSystem, Map<string, Asking[]>> = new WeakMap();

/**
 * One asking of a range, with the cards its words are written on and the
 * words themselves as said — each with the face it wore and, in a counted
 * phrase, the noun — which is what says which *form* of each card the
 * learner reads.
 */
export interface Asking {
  ask: Ask;
  words: string[];
  tokens?: Token[];
}

/**
 * Whether the learner has a word, as one of a number's building blocks.
 *
 * Asked of a card by id and, where there is one, of the word as it was
 * said in this number — `token` — since a word is a building block in the
 * form it is shown in: the face *seven* wears inside a bigger number, the
 * plural *books* is after three. A counted noun is asked by the noun's own
 * id, which is its card's. What "has" means is the caller's: the scheduler
 * answers it, and this module knows nothing of schedules.
 */
export type Knows = (id: string, token?: Token) => boolean;

/* Every building block of one asking known: each word, in the form it was
   said, among the cards the learner holds — and the noun it counts. */
function tokensKnown(tokens: Token[], numbersId: string, timeId: string, ids: Set<string>, knows: Knows): boolean {
  return tokens.every((t) =>
    t.noun
      ? knows(t.noun, t)
      : cardsOfToken(t, numbersId, timeId).filter((id) => ids.has(id)).every((id) => knows(id, t)),
  );
}

/**
 * Every asking of a range worth reading, with the cards each one's words
 * are written on — see askingsOf for which askings, and cardsOfToken for
 * why a word can be more than one card. An asking the system cannot say
 * whole is left out: it is never dealt, so it brings no word in.
 */
export function askingsWithWords(
  range: Range,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
): Asking[] {
  const key = `${range.id}${range.counted ? "#count" : ""}|${set.timeSys ? set.timeSys.id : ""}|${set.timeSys ? set.timeSys.rev : ""}`;
  const mine = ASKINGS.get(set.sys) || new Map();
  ASKINGS.set(set.sys, mine);
  const had = mine.get(key);
  if (had) return had;
  const numbersId = set.sys.id;
  const timeId = set.timeSys ? set.timeSys.id : "";
  const out: Asking[] = [];
  for (const ask of askingsOf(range, set.sys, set.composer)) {
    const got = renderAsk(ask, set.composer, set.sys, set.timeComposer, set.timeSys);
    if (!got.text) continue;
    out.push({
      ask,
      words: [...new Set(got.tokens.flatMap((t) => cardsOfToken(t, numbersId, timeId)))],
      tokens: got.tokens,
    });
  }
  mine.set(key, out);
  return out;
}

/**
 * An asking that brings in a word the learner has not kept yet, or null
 * where there is none to bring in.
 *
 * Drawn at random, a part leaves some of its words unasked for weeks:
 * *seventy* is in one number in nine of 11 to 99 and *and* is in nearly
 * all of them. So the word comes first — one of the ones not yet learnt,
 * each as likely as the next — and then a number it stands in. That is
 * what makes every word of a part come up, rather than the ones the
 * number line happens to be thick with.
 *
 * Seeded as `askFor` is, so a missed question comes back the same while
 * the words still waiting are the same ones.
 */
export function steeredAsk(
  range: Range,
  seed: string,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  waiting: Set<string>,
  /* Only these askings — the ones whose words are recognised, see
     askKnown. Every asking of the range when left out. */
  among?: { ask: Ask; words: string[] }[],
): Ask | null {
  if (!waiting.size) return null;
  const all = among || askingsWithWords(range, set);
  const reached = new Set(all.flatMap((a) => a.words));
  const targets = [...waiting].filter((id) => reached.has(id)).sort();
  if (!targets.length) return null;
  const rnd = seeded(`${range.id} ${seed} steer`);
  const target = targets[Math.floor(rnd() * targets.length)];
  const holding = all.filter((a) => a.words.includes(target));
  return holding[Math.floor(rnd() * holding.length)].ask;
}

/**
 * The cards one asking is said with, among those `ids` holds: *forty* and
 * *seven* for 47.
 */
export function wordsOfAsk(
  ask: Ask,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
): Set<string> {
  const got = renderAsk(ask, set.composer, set.sys, set.timeComposer, set.timeSys);
  const timeId = set.timeSys ? set.timeSys.id : "";
  return new Set(got.tokens.flatMap((t) => cardsOfToken(t, set.sys.id, timeId)).filter((id) => ids.has(id)));
}

/**
 * The askings of a range a learner can be put: the ones every word of
 * which they already recognise.
 *
 * A learner who knows *forty* and *seven* knows *forty-seven*, which is
 * why numbers are built rather than memorised — and the other side of
 * that is that one who does not know *forty* yet cannot be asked it. So
 * the words come first and the combinations wait on them, number by
 * number rather than range by range: 47 can be asked the day *forty* and
 * *seven* are recognised, whether or not *ninety* has been met.
 *
 * `ids` is the cards the learner holds and `knows` whether one is
 * recognised; what that means is the scheduler's, and the caller's to
 * ask. A word not held is never waited on: nothing could recognise it.
 *
 * An asking none of whose words is held — noon written out whole by a
 * teacher, which no learner has a card for — has nothing to wait on, and
 * would otherwise open the range before a single word of it was known. It
 * comes in with the rest once one asking built of held words can, or at
 * once where the range holds none at all.
 */
export function askingsKnown(
  range: Range,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
  knows: Knows,
): Asking[] {
  const numbersId = set.sys.id;
  const timeId = set.timeSys ? set.timeSys.id : "";
  const all = askingsWithWords(range, set).map((a) => ({ ...a, words: a.words.filter((id) => ids.has(id)) }));
  /* Each word in the face it was said in. The noun a counted asking was
     read with is a stand-in for any noun of its gender, so it is left to
     the draw, which picks the noun — see anyOfKind. */
  const fit = all.filter((a) =>
    a.tokens
      ? tokensKnown(a.tokens.filter((t) => !t.noun), numbersId, timeId, ids, knows)
      : a.words.every((id) => knows(id)),
  );
  const opens = fit.some((a) => a.words.length) || !all.some((a) => a.words.length);
  return opens ? fit : [];
}

/**
 * One asking of a range, drawn from what the learner can be asked.
 *
 * Towards a word the learner has not kept yet, as steeredAsk always did,
 * but only among `known` — the askings `askingsKnown` found. Failing
 * that, the plain draw on the same seed, kept if every word in it is a
 * building block the learner has, so a learner who has them all is asked
 * from the whole of the range; and failing that, one of `known` picked on
 * the seed. A missed question still comes back as the same number, and a
 * right one still moves on.
 *
 * Null when there is nothing to ask yet — `known` empty, so the range has
 * not opened — or when a counted asking has no noun the learner has in
 * the form the number calls for.
 */
export function askKnown(
  range: Range,
  seed: string,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
  knows: Knows,
  known: Asking[],
  waiting: Set<string>,
): Ask | null {
  if (!known.length) return null;
  const fits = (ask: Ask): boolean => {
    const got = renderAsk(ask, set.composer, set.sys, set.timeComposer, set.timeSys);
    return tokensKnown(got.tokens, set.sys.id, set.timeSys ? set.timeSys.id : "", ids, knows);
  };
  const steered = steeredAsk(range, seed, set, waiting, known);
  if (steered) return anyOfKind(steered, range, seed, set, fits);
  const drawn = askFor(range, seed, set.sys, set.composer);
  if (fits(drawn)) return drawn;
  return anyOfKind(known[Math.floor(seeded(`${range.id} ${seed} known`)() * known.length)].ask, range, seed, set, fits);
}

/** The first noun of each gender, in the order given. */
const onePerGender = (nouns: CountedNoun[]): CountedNoun[] =>
  nouns.filter((n, i) => nouns.findIndex((m) => m.gender === n.gender) === i);

/*
 * An asking found among the stand-ins askingsOf counts with, given any
 * noun the range can count of the same gender — the same words, so the
 * same question as far as the number goes, and drawn on the seed so a
 * missed one comes back unchanged.
 *
 * Only a noun that `fits`: the noun is a building block too, in the form
 * the number puts it in — *books* after three — so the draw takes the
 * nouns of that gender the learner has, in turn from the seed's, and is
 * null where there is none. An asking with no noun is checked whole.
 */
function anyOfKind(
  ask: Ask,
  range: Range,
  seed: string,
  set: { composer: Composer | null; sys: NumberSystem },
  fits: (ask: Ask) => boolean = () => true,
): Ask | null {
  if (!range.counted || !ask.nounId) return fits(ask) ? ask : null;
  const nouns = countable(range, set.composer, set.sys);
  const was = nouns.find((n) => n.id === ask.nounId);
  const alike = was ? nouns.filter((n) => n.gender === was.gender) : [];
  if (!alike.length) return fits(ask) ? ask : null;
  const from = Math.floor(seeded(`${range.id} ${seed} noun`)() * alike.length);
  for (let i = 0; i < alike.length; i++) {
    const tried = { ...ask, nounId: alike[(from + i) % alike.length].id };
    if (fits(tried)) return tried;
  }
  return null;
}

/** A deck as far as filing numbers goes: its name, and the parts it holds. */
export interface DeckParts {
  title: string;
  parts: string[];
}

/**
 * A system's cards, filed under the decks that hold them — and the ones in
 * no deck left out.
 *
 * A teacher puts a *part* in a deck — 0 to 10, telling the hour — and a
 * deck reaches a learner's device as a tag on its cards, so that is what
 * this writes: the part's skill gets the deck's name, and so does every
 * word it is built of. A card in no deck is held back, not sent with a
 * tag of nobody's: numbers used to reach every learner whatever their
 * decks held, and now arrive the way every other card does. What a
 * learner had earned on one held back is set aside by the fold, as for
 * any card that leaves the material, and is waiting when it comes back.
 *
 * `decks` are the decks this learner holds in the system's language.
 */
export function fileIntoDecks(
  items: Item[],
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  decks: DeckParts[],
): Item[] {
  const holding = decks
    .filter((d) => d.parts && d.parts.length)
    .map((d) => ({ ...d, parts: partsNow(d.parts) }));
  if (!holding.length) return [];
  const ids = new Set(items.map((it) => it.id));
  const tags = new Map<string, Set<string>>();
  const file = (id: string, title: string) => {
    if (!tags.has(id)) tags.set(id, new Set());
    (tags.get(id) as Set<string>).add(title);
  };
  const words = new Map<string, Set<string>>();
  for (const it of items) {
    const range = it.range;
    if (!range) continue;
    for (const deck of holding) {
      if (!deck.parts.includes(range.id)) continue;
      file(it.id, deck.title);
      if (!words.has(range.id)) words.set(range.id, wordsOfRange(range, set, ids));
      for (const id of words.get(range.id) as Set<string>) file(id, deck.title);
    }
  }
  /* The ten figures go wherever any part of the system does: every number
     and every clock is written in them. */
  const titles = new Set([...tags.values()].flatMap((t) => [...t]));
  for (const it of items) {
    if (!isNumeralCard(it)) continue;
    for (const title of titles) file(it.id, title);
  }
  return items
    .filter((it) => tags.has(it.id))
    .map((it) => ({
      ...it,
      tags: [...new Set(it.tags.concat([...(tags.get(it.id) as Set<string>)]))],
      /* And the words a part is made of, on the part itself: what the
         learner's progress on numbers is read against — a part is learnt
         only once every one of them is — and what its questions are
         steered towards. See partsOf. */
      ...(it.range && words.has(it.range.id) ? { parts: [...(words.get(it.range.id) as Set<string>)] } : null),
    }));
}

/* ---- which part a box belongs to ---- */

/*
 * Remembered per composer: what a box belongs to is a fact about how the
 * language builds its numbers, not about what any teacher has written.
 */
const HOMES: WeakMap<Composer, Map<string, string>> = new WeakMap();

/**
 * The part of the numbers each box is first needed by — one to ten under
 * 0 to 10, the tens and the joining word under 11 to 99, and so on.
 *
 * Worked out rather than declared, by building every number of each part
 * out of a stand-in system with every box filled — each with its own slot
 * name, which is not a word of anything — and reading which boxes each
 * number's tokens came from. An empty system would not do: a composer
 * stops reaching for words at the first one missing. So each language gets the
 * split its own rules make — Huế builds 11 to 99 out of the words for one
 * to ten and the forms they take in company, so its 11 to 99 has nothing
 * of its own — and a composer that changes how it builds a number moves
 * its boxes with it.
 *
 * Parts are taken in the order the composer lists them, and the counting
 * parts are left out: they count with the words the others already hold.
 * A box no part reaches is filed with the last.
 */
export function homesOf(composer: Composer): Map<string, string> {
  const had = HOMES.get(composer);
  if (had) return had;
  const homes: Map<string, string> = new Map();
  const lexemes: NumberSystem["lexemes"] = {};
  for (const spec of composer.requiredSlots()) {
    lexemes[spec.slot] = { slot: spec.slot, forms: Object.fromEntries(spec.formKeys.map((k) => [k, spec.slot])) };
  }
  const empty: NumberSystem = {
    id: "",
    owner: "",
    languageId: composer.id,
    composerVersion: composer.version,
    lexemes,
    overrides: {},
    nouns: [],
    audioPolicy: "components",
    rev: 0,
    created: 0,
    updated: 0,
  };
  const parts = composer.ranges().filter((r) => r.kind === "numbers" && !r.counted);
  for (const range of parts) {
    const values = range.to - range.from <= 1000
      ? Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i)
      : probeOf(range).concat(Array.from({ length: 300 }, (_, i) => askFor(range, `homes ${i}`, empty).value));
    for (const n of values) {
      const got = composer.render(n, empty);
      for (const w of got.warnings) if (w.slot && !homes.has(w.slot)) homes.set(w.slot, range.id);
      for (const t of got.tokens) if (t.slot && !homes.has(t.slot)) homes.set(t.slot, range.id);
    }
  }
  /* A box no number reached for in a system with every box written — the
     bare *hundred* where three hundred has a word of its own — goes
     beside the boxes of its own group, and only then to the last part. */
  const last = parts.length ? parts[parts.length - 1].id : "";
  const specs = composer.requiredSlots();
  for (const spec of specs) {
    if (homes.has(spec.slot)) continue;
    const kin = specs.find((s) => s.group === spec.group && homes.has(s.slot));
    const home = kin ? homes.get(kin.slot) : last;
    if (home) homes.set(spec.slot, home);
  }
  HOMES.set(composer, homes);
  return homes;
}

/* ---- numbers standing in sentences ---- */

/** How many fillers a part offers one blank. The whole part where it is
    this small — 0 to 10 is eleven — and an even spread where it is not. */
export const FILLERS_PER_PART = 12;

export const fillerId = (systemId: string, rangeId: string, value: number, nounId = "") =>
  `sys:${systemId}:fill:${rangeId}:${value}${nounId ? `:${safe(nounId)}` : ""}`;

/* The language's own names for a noun's three numbers, as a card stores
   them — what an adjective beside a counted phrase agrees with. */
const NUMBER_OF: Record<string, string> = { sg: "singular", dual: "dual", pl: "plural" };

/** The tag every plain part answers to, and the one every counting part
    does: `{{number}}` is any number at all, `{{count}}` any number of
    things. */
export const NUMBER_TAG = "number";
export const COUNT_TAG = "count";

/**
 * The blanks a part fills: its own tag, and the general one.
 *
 * Fixed rather than chosen, and read off the part's id, so a teacher can
 * write `{{0-9}}` or `{{number}}` into a sentence card and know what
 * stands there without setting anything up — and so the names are the same
 * for every teacher and every language. A stretch's counting view answers
 * to `count-0-9` and `count` rather than `number`: a sentence that says
 * *I have {{number}}* wants *47*, and handing it *3 books* half the time
 * would make a different sentence of it.
 */
export function partTags(range: Range): string[] {
  const tag = (id: string) => id.replace(/^numbers:/, "").replace(/\+$/, "-plus");
  if (range.counted) return [`count-${tag(range.id)}`, COUNT_TAG];
  /* And the tag of the part it was split out of, so a sentence written
     with `{{11-99}}` before the split is still filled — from 10 to 19
     and 20 to 99 together. */
  return [tag(range.id), ...(range.was ? [tag(range.was)] : []), NUMBER_TAG];
}

/**
 * The tags of the counting parts there used to be, and the numbers each
 * was filled from — so a sentence written with `{{count-3-10}}` is still
 * filled, with whichever of a stretch's counted phrases fall inside it.
 */
export const OLD_COUNT_TAGS: { tag: string; from: number; to: number }[] = [
  { tag: "count-1-2", from: 1, to: 2 },
  { tag: "count-3-10", from: 3, to: 10 },
  { tag: "count-11-20", from: 11, to: 20 },
];

/**
 * The tags of the parts there are no longer — `0-10`, `11-99` and the
 * three old counting parts. A filler still answers to them, so a sentence
 * written with one is still filled, but nobody should be offered one for
 * a new sentence beside the tags that replaced it: `0-10` next to `0-9`
 * reads as two choices where there is one.
 */
export const RETIRED_TAGS: ReadonlySet<string> = new Set([
  ...NUMBER_RANGES.flatMap((r) => (r.was ? [r.was.replace(/^numbers:/, "")] : [])),
  ...OLD_COUNT_TAGS.map((t) => t.tag),
]);

/**
 * The numbers each part puts into the sentences that ask for it, as cards
 * a blank can be filled from.
 *
 * A part answers to its tags — see partTags — and a sentence with one of
 * them in it is met with a number from that part, written out in full by
 * the composer: *I am {{0-10}}* as *I am 7*. A
 * counting part fills its blank with a number and a thing counted, both
 * agreeing — *I have {{things}}* as *I have 3 books*, with the plural, the
 * dual or the singular the number calls for — and says which of those it
 * is, so an adjective standing after it in the sentence agrees too.
 *
 * They are made to be borrowed, never to be asked: in no deck, not
 * practised on their own, and kept out of `{{word}}`. That makes them what
 * a name is to a sentence — met through the sentence, at its bottom level
 * first, and climbing with it (see valuesAt). Which numbers is the same on
 * every device for the same system and the same nouns, so the sentence a
 * teacher approves is the sentence a learner is asked.
 *
 * Only for a part that can be said whole. A part that cannot fills
 * nothing, and its sentences wait for it the way a sentence waits for a
 * name nobody has written.
 */
export function fillerCards(composer: Composer | null, sys: NumberSystem | null, now: Millis = 0): Item[] {
  if (!composer || !sys) return [];
  const out: Item[] = [];
  const checks = rangeChecks(composer, sys);
  const open = new Set(checks.filter((c) => c.open).map((c) => c.range.id));
  const counts = new Set(checks.filter((c) => c.counting && c.counting.open).map((c) => c.range.id));
  /* Each open stretch, and its counting view where a noun can be counted
     across it — see countingOf. */
  const views = composer.ranges().flatMap((range) =>
    range.kind !== "numbers" || !open.has(range.id) ? [] : counts.has(range.id) ? [range, countingOf(range)] : [range],
  );
  for (const range of views) {
    const names = partTags(range);
    const nouns = range.counted ? countable(range, composer, sys) : [];
    /* Every pairing the part could make, then an even spread of them —
       drawn once from the system and the part, so the same on every
       device. */
    const span = Math.min(range.to, NUMBER_CEILING) - range.from + 1;
    const values = span <= FILLERS_PER_PART * 4
      ? Array.from({ length: span }, (_, i) => range.from + i)
      : [...new Set(Array.from({ length: FILLERS_PER_PART * 2 }, (_, i) => askFor(range, `${sys.id} fill ${i}`, sys).value))];
    const pairs = range.counted
      ? values.flatMap((value) => nouns.map((noun) => ({ value, noun })))
      : values.map((value) => ({ value, noun: undefined as CountedNoun | undefined }));
    const picked = spread(pairs, FILLERS_PER_PART, `${sys.id} ${range.id}`);
    for (const { value, noun } of picked) {
      const said = renderAsk(
        { rangeId: range.id, kind: "numbers", value, ...(noun ? { nounId: noun.id } : null) },
        composer,
        sys,
      );
      if (!said.text) continue;
      const id = fillerId(sys.id, range.id, value, noun ? noun.id : "");
      const old = noun ? OLD_COUNT_TAGS.filter((t) => value >= t.from && value <= t.to).map((t) => t.tag) : [];
      const grammar = noun
        ? {
            number: NUMBER_OF[said.nounForm || "pl"] || "plural",
            gender: noun.gender === "f" ? "feminine" : "masculine",
            ...(noun.human ? { human: noun.human } : null),
          }
        : null;
      out.push({
        id,
        lang: sys.languageId,
        /* A phrase, so `{{word}}` — any word in the language — does not
           take it. See kindOf. */
        kind: "phrase",
        tags: [],
        fills: old.length ? [names[0], ...old, ...names.slice(1)] : names,
        forms: [{ id: `${id}-f0`, ar: said.text, en: said.en || said.digits, lat: "", ...grammar, s: {} }],
        source: { systemId: sys.id, slot: `fill:${range.id}` },
        locked: true,
        drill: false,
        created: now,
        updated: now,
      } as Item);
    }
  }
  return out;
}

/*
 * At most `count` of a list, spread over it rather than taken from the
 * front — so 11 to 99 offers numbers from all of it, and a counting part
 * offers every noun before any noun twice. The same list for the same
 * seed.
 */
function spread<T>(list: T[], count: number, seed: string): T[] {
  if (list.length <= count) return list;
  const step = list.length / count;
  const start = Math.floor(seeded(seed)() * step);
  return Array.from({ length: count }, (_, i) => list[Math.min(list.length - 1, Math.floor(start + i * step))]);
}
