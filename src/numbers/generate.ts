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
import type { Item, Form, LangId, Millis, Parked } from "../types.ts";
import type {
  Ask,
  Composer,
  FormKey,
  NumberSystem,
  Range,
  TimeComposer,
  TimeSystem,
} from "./types.ts";
import { askFor, rangeChecks, renderAsk, probeOf, seeded } from "./range.ts";
import { SPLIT_FROM } from "./types.ts";

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

/* ---- a range split in parts ---- */

/**
 * What a learner had earned on a range that has since been split, handed
 * to each of its parts.
 *
 * Counting things was one range and is three (see COUNTING_RANGES). The
 * parts have ids of their own, so without this a learner who could count
 * books would start each part from nothing. Same rules as handOn: only
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
    const was = range ? SPLIT_FROM[range.id] : "";
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

/* ---- which deck a number is in ---- */

/**
 * The askings of a range worth reading for which words it uses.
 *
 * Every one, where there are few enough to say them all — up to 999, and
 * every hour at every minute the range draws — and otherwise the probe
 * that decides whether the range is open, with a few hundred draws beside
 * it, which reach every word a thousand to a million is built of.
 */
function askingsOf(range: Range, sys: NumberSystem): Ask[] {
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
  const nouns = range.counted ? (sys.nouns || []).map((n) => n.id) : [undefined];
  const values = range.to - range.from <= 1000
    ? Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i)
    : probeOf(range).concat(
        Array.from({ length: 300 }, (_, i) => askFor(range, `words ${i}`, sys).value),
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
  for (const ask of askingsOf(range, set.sys)) for (const id of wordsOfAsk(ask, set, ids)) out.add(id);
  return out;
}

/**
 * The cards one asking is said with: *forty* and *seven* for 47.
 *
 * What a range brings into a deck is the union of these over its probe —
 * see wordsOfRange — and what a learner has to recognise before 47 may be
 * put to them is this set for 47 alone. One walk for both, so a word that
 * is filed with a range is the word the range then waits on.
 */
export function wordsOfAsk(
  ask: Ask,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
): Set<string> {
  return readAsk(ask, set, ids).words;
}

/* The cards an asking is said with, and whether any of it is built from
   the boxes at all rather than written out whole. */
function readAsk(
  ask: Ask,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
): { words: Set<string>; built: boolean } {
  const out = new Set<string>();
  const numbersId = set.sys.id;
  const timeId = set.timeSys ? set.timeSys.id : "";
  const got = renderAsk(ask, set.composer, set.sys, set.timeComposer, set.timeSys);
  for (const t of got.tokens) {
    const candidates = t.override
      ? [overrideId(numbersId, t.override)]
      : t.slot
      ? [
          componentId(numbersId, t.slot),
          timeId ? componentId(timeId, t.slot) : "",
          /* A minute expression is written `minute.15` in a rendering and
             made as `min.15` — see generate. */
          timeId && t.slot.startsWith("minute.") ? componentId(timeId, `min.${t.slot.slice(7)}`) : "",
        ]
      : [];
    for (const id of candidates) if (id && ids.has(id)) out.add(id);
  }
  return { words: out, built: got.tokens.some((t) => !!t.slot) };
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
 * `knows` says whether a card is recognised; what that means is the
 * scheduler's, and the caller's to ask. Read over the same askings
 * wordsOfRange files a range's words from, so a range nothing of which
 * can be asked yet is one this comes back empty for.
 */
export function askingsKnown(
  range: Range,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
  knows: (id: string) => boolean,
): Ask[] {
  const fit = askingsOf(range, set.sys)
    .map((ask) => ({ ask, ...readAsk(ask, set, ids) }))
    .filter((r) => [...r.words].every(knows));
  /* An asking written out whole — noon as a teacher wrote it for the
     clock, which no learner has a card for — is built of no words, so
     has nothing to wait on, and would otherwise open the range before a
     single word of it was known. It comes in with the rest, once one
     asking built of words can. */
  return fit.some((r) => r.built) ? fit.map((r) => r.ask) : [];
}

/**
 * One asking of a range, drawn from what the learner can be asked.
 *
 * The plain draw first — `askFor` on the same seed — and kept if every
 * word in it is recognised, so a learner who knows them all is asked
 * exactly what they would have been, from the whole of the range. Only
 * when it is not does the draw fall back to `known`, the askings
 * `askingsKnown` found, picked on the same seed: a missed question still
 * comes back as the same number, and a right one still moves on.
 *
 * Null when there is nothing to ask yet — `known` empty, so the range has
 * not opened.
 */
export function askKnown(
  range: Range,
  seed: string,
  set: { composer: Composer | null; sys: NumberSystem; timeComposer?: TimeComposer | null; timeSys?: TimeSystem | null },
  ids: Set<string>,
  knows: (id: string) => boolean,
  known: Ask[],
): Ask | null {
  if (!known.length) return null;
  const drawn = askFor(range, seed, set.sys);
  if ([...wordsOfAsk(drawn, set, ids)].every(knows)) return drawn;
  return known[Math.floor(seeded(`${range.id} ${seed} known`)() * known.length)];
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
  const holding = decks.filter((d) => d.parts && d.parts.length);
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
  return items
    .filter((it) => tags.has(it.id))
    .map((it) => ({ ...it, tags: [...new Set(it.tags.concat([...(tags.get(it.id) as Set<string>)]))] }));
}
