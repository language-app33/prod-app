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
 *   * **A range skill per range the system can build**: counting to ten,
 *     counting things, telling the hour. No words on it at all — what it
 *     is asked is made up when the queue is built and thrown away with the
 *     sitting.
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
import type { Item, Form, LangId, Millis } from "../types.ts";
import type {
  Composer,
  FormKey,
  NumberSystem,
  Range,
  TimeComposer,
  TimeSystem,
} from "./types.ts";
import { rangeChecks } from "./range.ts";

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
  tag: string;
  now: Millis;
}

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
    ...(face.audio && face.audio.length
      ? { clips: face.audio, recs: face.audio.map((id) => ({ id, label: "", speed: "" })) }
      : null),
    s: {},
  }));
  return {
    id: made.id,
    lang: made.lang,
    kind: "word",
    tags: [made.tag],
    forms,
    ...(made.note ? { note: made.note } : null),
    /* Where it came from, which is what a refresh matches on and what the
       card's own screen says instead of offering an edit. */
    source: { systemId: made.systemId, slot: made.slot },
    locked: true,
    drill: true,
    created: made.now,
    updated: made.now,
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
  /** What the cards are filed under in a learner's list. */
  tag: string;
  now: Millis;
}

export function generate({ composer, sys, timeComposer, timeSys, tag, now }: GenerateOpts): Generated {
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
        label: labelForFace(key),
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
        tag,
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
        tag,
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
          tag,
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
          tag,
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
          tag,
          now,
        }),
      );
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
    items.push(rangeItem(check.range, sys, lang, tag, now, heard));
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
  tag: string,
  now: Millis,
  heard: boolean,
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
     * time are three sets of questions and a skill is only ever one of
     * them. Nobody wrote a rule about any of this: it falls out of what
     * each exercise declares it needs.
     */
    range: true,
    ...(range.kind === "time"
      ? { rangeTime: true }
      : range.counted
      ? { rangeCounted: true }
      : { rangeNumbers: true }),
    ...(heard ? { recs: [{ id: "system", label: "", speed: "" }] } : null),
    s: {},
  };
  return {
    id,
    lang,
    kind: "word",
    tags: [tag],
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
