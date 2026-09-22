/*
 * What a number system or a time system reads as, whatever arrives.
 *
 * Hand-written, and the reasons are the ones DECISIONS.md gave for
 * `readAnswer` on 11 September and which have not expired: this runs on
 * every material refresh, including on a phone at the start of a session;
 * the app carries two runtime dependencies and both of them are React;
 * and what a schema library is *for* — a good error saying why something
 * was rejected — is the one thing this boundary must not do. **A system is
 * somebody's afternoon of typing, and most of it read is worth more to
 * them than a screen that will not open.**
 *
 * So the narrowing is total and deliberately unforgiving in one
 * direction only: a value that is not what it should be becomes no value,
 * a field nobody declared is dropped rather than carried forward for
 * ever, and a lexeme with nothing left in it is not a lexeme. What
 * survives is exactly what the composers can read.
 *
 * The composers are where a *gap* is reported, not here. A lexicon with
 * three boxes filled parses perfectly; it simply cannot say very much
 * yet, and the editor shows that as the warnings a preview comes back
 * with. The two questions are different and keeping them apart is what
 * lets this one be silent.
 */
import type { LangId, Millis } from "../types.ts";
import type {
  AudioPolicy,
  CountedNoun,
  FormKey,
  Lexeme,
  MinuteExpr,
  NumberSystem,
  Override,
  Period,
  TimeSystem,
} from "./types.ts";
import { FORM_KEYS, MINUTE_MARKS } from "./types.ts";

/* ---- the smallest readers ---- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A string with the ends trimmed, or "" for anything that is not one. */
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** A whole number in range, or the fallback. Dates and counters both. */
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const millis = (v: unknown): Millis => (typeof v === "number" && v > 0 ? v : 0);

/**
 * How long a field may be.
 *
 * Not a validation rule — a refusal to hold a novel in a box meant for a
 * word. The server caps what it stores and these are the same numbers,
 * said on both sides so a device and the disk agree about what a system
 * is rather than one of them silently holding more.
 */
export const LIMITS = {
  text: 120,
  slots: 400,
  overrides: 2000,
  nouns: 60,
  periods: 24,
  clips: 12,
};

const capped = (v: unknown, max = LIMITS.text): string => str(v).slice(0, max);

/** Clip hashes, which are hex and nothing else. */
const clips = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((c) => str(c))
        .filter((c) => /^[a-f0-9]{8,64}$/.test(c))
        .slice(0, LIMITS.clips)
    : [];

/* ---- lexemes ---- */

const readForms = (v: unknown): Partial<Record<FormKey, string>> => {
  const out: Partial<Record<FormKey, string>> = {};
  if (!isObj(v)) return out;
  for (const key of FORM_KEYS) {
    const text = capped(v[key]);
    if (text) out[key] = text;
  }
  return out;
};

const readAudio = (v: unknown): Partial<Record<FormKey, string[]>> | undefined => {
  if (!isObj(v)) return undefined;
  const out: Partial<Record<FormKey, string[]>> = {};
  let any = false;
  for (const key of FORM_KEYS) {
    const list = clips(v[key]);
    if (list.length) {
      out[key] = list;
      any = true;
    }
  }
  return any ? out : undefined;
};

/**
 * One slot's words.
 *
 * A lexeme with no word in any face is not a lexeme — it is an empty box,
 * which is what a system says by not having the slot at all. Keeping it
 * would mean the difference between "never filled in" and "filled in and
 * then cleared" living in the data, and nothing anywhere reads that
 * difference.
 */
export function readLexeme(slot: string, v: unknown): Lexeme | null {
  const id = capped(slot, 64);
  if (!id || !isObj(v)) return null;
  const forms = readForms(v.forms);
  if (!Object.keys(forms).length) return null;
  const lat = readForms(v.lat);
  const audio = readAudio(v.audio);
  return {
    slot: id,
    forms,
    ...(Object.keys(lat).length ? { lat } : null),
    ...(audio ? { audio } : null),
  };
}

const readLexemes = (v: unknown): Record<string, Lexeme> => {
  const out: Record<string, Lexeme> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [slot, raw] of Object.entries(v)) {
    if (n >= LIMITS.slots) break;
    const lex = readLexeme(slot, raw);
    if (!lex) continue;
    out[lex.slot] = lex;
    n += 1;
  }
  return out;
};

/* ---- overrides ---- */

/**
 * A number a teacher wrote out by hand, keyed by the number and
 * optionally by the face of it they meant.
 *
 * The key is checked rather than trusted, because it is what the composer
 * looks numbers up by: a key nobody could ever ask for is a row that
 * would sit in the system for ever doing nothing, and the teacher who
 * typed it would have no way of finding out.
 */
const OVERRIDE_KEY = new RegExp(`^\\d{1,7}(\\|(${FORM_KEYS.join("|")}))?$`);
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d(\|(colloquial|exact))?$/;

const readOverrides = (v: unknown, ok: (key: string) => boolean): Record<string, Override> => {
  const out: Record<string, Override> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [key, raw] of Object.entries(v)) {
    if (n >= LIMITS.overrides) break;
    if (!ok(key)) continue;
    const text = capped(isObj(raw) ? raw.text : raw, LIMITS.text * 2);
    if (!text) continue;
    const audio = clips(isObj(raw) ? raw.audio : null);
    const lat = capped(isObj(raw) ? raw.lat : null, LIMITS.text * 2);
    out[key] = { text, ...(lat ? { lat } : null), ...(audio.length ? { audio } : null) };
    n += 1;
  }
  return out;
};

const readCurated = (v: unknown, ok: (key: string) => boolean): Record<string, string[]> | undefined => {
  if (!isObj(v)) return undefined;
  const out: Record<string, string[]> = {};
  let any = false;
  for (const [key, raw] of Object.entries(v)) {
    if (!ok(key)) continue;
    const list = clips(raw);
    if (!list.length) continue;
    out[key] = list;
    any = true;
  }
  return any ? out : undefined;
};

/* ---- counted nouns ---- */

/**
 * A noun the agreement exercise counts.
 *
 * A noun with no singular and no plural is nothing to count, so it goes.
 * A noun with no dual stays: plenty of languages have none, and the one
 * that does reports the gap when it reaches for it rather than refusing
 * the noun at the door.
 */
export function readNoun(v: unknown): CountedNoun | null {
  if (!isObj(v)) return null;
  const id = capped(v.id, 40).replace(/[^a-zA-Z0-9_-]/g, "");
  const sg = capped(v.sg);
  const pl = capped(v.pl);
  if (!id || !sg || !pl) return null;
  const dual = capped(v.dual);
  return {
    id,
    sg,
    pl,
    ...(dual ? { dual } : null),
    gender: v.gender === "f" ? "f" : "m",
    en: capped(v.en),
  };
}

const readNouns = (v: unknown): CountedNoun[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: CountedNoun[] = [];
  for (const raw of v) {
    if (out.length >= LIMITS.nouns) break;
    const noun = readNoun(raw);
    if (!noun || seen.has(noun.id)) continue;
    seen.add(noun.id);
    out.push(noun);
  }
  return out;
};

/* ---- the two documents ---- */

const readPolicy = (v: unknown): AudioPolicy => (v === "components" ? "components" : "components");

const readMigrated = (v: unknown): Record<string, string> | undefined => {
  if (!isObj(v)) return undefined;
  const out: Record<string, string> = {};
  let any = false;
  for (const [key, raw] of Object.entries(v)) {
    const id = capped(raw, 64);
    if (!id) continue;
    out[capped(key, 64)] = id;
    any = true;
  }
  return any ? out : undefined;
};

/**
 * A number system, as it arrives — from the server, from a backup, from a
 * device on an older build, or from a teacher's editor.
 *
 * Null only for something that is not a system at all, which is one
 * thing: no language for it to be the numbers of. **An id is not
 * required**, because an id is the server's to give — a system on its way
 * to being saved for the first time has none, the same way a new card
 * has none, and refusing it here would refuse every first save.
 */
export function readNumberSystem(v: unknown): NumberSystem | null {
  if (!isObj(v)) return null;
  const id = capped(v.id, 64);
  const languageId = capped(v.languageId, 32) as LangId;
  if (!languageId) return null;
  return {
    id,
    owner: capped(v.owner, 64),
    languageId,
    composerVersion: num(v.composerVersion, 0),
    lexemes: readLexemes(v.lexemes),
    overrides: readOverrides(v.overrides, (k) => OVERRIDE_KEY.test(k)),
    nouns: readNouns(v.nouns),
    audioPolicy: readPolicy(v.audioPolicy),
    ...(readCurated(v.curatedAudio, (k) => OVERRIDE_KEY.test(k))
      ? { curatedAudio: readCurated(v.curatedAudio, (k) => OVERRIDE_KEY.test(k)) }
      : null),
    ...(readMigrated(v.migratedFrom) ? { migratedFrom: readMigrated(v.migratedFrom) } : null),
    rev: num(v.rev, 0),
    created: millis(v.created),
    updated: millis(v.updated),
  };
}

const readMinuteExpr = (v: unknown): MinuteExpr | null => {
  if (!isObj(v)) return null;
  const text = capped(v.text);
  if (!text) return null;
  const audio = clips(v.audio);
  const en = capped(v.en);
  return {
    text,
    refHour: v.refHour === "next" ? "next" : "same",
    ...(v.lead === true ? { lead: true } : null),
    ...(en ? { en } : null),
    ...(audio.length ? { audio } : null),
  };
};

const readMinuteExprs = (v: unknown): Record<string, MinuteExpr> => {
  const out: Record<string, MinuteExpr> = {};
  if (!isObj(v)) return out;
  for (const mark of MINUTE_MARKS) {
    const expr = readMinuteExpr(v[String(mark)]);
    if (expr) out[String(mark)] = expr;
  }
  return out;
};

/**
 * A part of the day, over hours of the 24-hour clock.
 *
 * The hours are clamped rather than rejected, and a range that runs
 * backwards is kept as one: a part of the day that wraps midnight is the
 * ordinary case, not a mistake to be corrected at the door.
 */
const readPeriod = (v: unknown): Period | null => {
  if (!isObj(v)) return null;
  const slot = capped(v.slot, 40).replace(/[^a-zA-Z0-9_-]/g, "");
  const text = capped(v.text);
  if (!slot || !text) return null;
  const hour = (x: unknown) => Math.min(23, Math.max(0, Math.trunc(num(x, 0))));
  const en = capped(v.en);
  const audio = clips(v.audio);
  return {
    slot,
    text,
    ...(en ? { en } : null),
    fromHour: hour(v.fromHour),
    toHour: hour(v.toHour),
    ...(audio.length ? { audio } : null),
  };
};

const readPeriods = (v: unknown): Period[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Period[] = [];
  for (const raw of v) {
    if (out.length >= LIMITS.periods) break;
    const period = readPeriod(raw);
    if (!period || seen.has(period.slot)) continue;
    seen.add(period.slot);
    out.push(period);
  }
  return out;
};

/** The word for *minute*, which a time system cannot do without and which
    is therefore given an empty shape rather than being allowed to be
    absent: an empty one warns where it is reached for. */
const EMPTY_NOUN: CountedNoun = { id: "minute", sg: "", pl: "", gender: "f", en: "minute" };

export function readTimeSystem(v: unknown): TimeSystem | null {
  if (!isObj(v)) return null;
  const id = capped(v.id, 64);
  const languageId = capped(v.languageId, 32) as LangId;
  if (!languageId) return null;
  const curated = readCurated(v.curatedAudio, (k) => TIME_KEY.test(k));
  return {
    id,
    owner: capped(v.owner, 64),
    languageId,
    numberSystemId: capped(v.numberSystemId, 64),
    composerVersion: num(v.composerVersion, 0),
    lexemes: readLexemes(v.lexemes),
    minuteNoun: readNoun(v.minuteNoun) || EMPTY_NOUN,
    minuteExprs: readMinuteExprs(v.minuteExprs),
    periods: readPeriods(v.periods),
    clock: v.clock === "24h" ? "24h" : "12h",
    overrides: readOverrides(v.overrides, (k) => TIME_KEY.test(k)),
    audioPolicy: readPolicy(v.audioPolicy),
    ...(curated ? { curatedAudio: curated } : null),
    rev: num(v.rev, 0),
    created: millis(v.created),
    updated: millis(v.updated),
  };
}

/* ---- starting points ---- */

export const emptyNumberSystem = (
  id: string,
  owner: string,
  languageId: LangId,
  now: Millis,
  composerVersion: number,
): NumberSystem => ({
  id,
  owner,
  languageId,
  composerVersion,
  lexemes: {},
  overrides: {},
  nouns: [],
  audioPolicy: "components",
  rev: 0,
  created: now,
  updated: now,
});

export const emptyTimeSystem = (
  id: string,
  owner: string,
  languageId: LangId,
  numberSystemId: string,
  now: Millis,
  composerVersion: number,
): TimeSystem => ({
  id,
  owner,
  languageId,
  numberSystemId,
  composerVersion,
  lexemes: {},
  minuteNoun: { ...EMPTY_NOUN },
  minuteExprs: {},
  periods: [],
  clock: "12h",
  overrides: {},
  audioPolicy: "components",
  rev: 0,
  created: now,
  updated: now,
});

/**
 * Every clip a system refers to.
 *
 * One door, for the same reason `clipIdsIn` and `clipsOfCard` are one
 * door each: the last time somewhere new could hold a recording and one
 * of the walkers was not told, the recordings were dropped from the
 * device they were made on. A backup, a restore and an admin's overview
 * all come through here.
 */
export function clipsOfSystem(sys: NumberSystem | TimeSystem | null | undefined): string[] {
  const out: string[] = [];
  if (!sys) return out;
  for (const lex of Object.values(sys.lexemes || {})) {
    for (const list of Object.values(lex.audio || {})) for (const id of list || []) out.push(id);
  }
  for (const over of Object.values(sys.overrides || {})) for (const id of over.audio || []) out.push(id);
  for (const list of Object.values(sys.curatedAudio || {})) for (const id of list || []) out.push(id);
  const time = sys as TimeSystem;
  for (const expr of Object.values(time.minuteExprs || {})) for (const id of expr.audio || []) out.push(id);
  for (const period of time.periods || []) for (const id of period.audio || []) out.push(id);
  return [...new Set(out)];
}
