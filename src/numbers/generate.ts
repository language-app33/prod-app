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
  faces: { key: FormKey; text: string; label: string; audio?: string[] }[];
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
    lat: "",
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
          faces: [{ key: "standalone", text, label: "", audio: (lex.audio || {}).standalone }],
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
          faces: [{ key: "standalone", text: expr.text, label: "", audio: expr.audio }],
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
          faces: [{ key: "standalone", text: period.text, label: "", audio: period.audio }],
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
    /* The marker the gates read. */
    range: true,
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
