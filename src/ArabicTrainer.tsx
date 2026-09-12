import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  Course, Deck, Doc, ExerciseState, FlagKind, Form, Item,
  Lang, LangId, Millis, Question, SavedSession, Settings, User,
} from "./types.ts";
import type { Node } from "./shared.tsx";
import {
  Button,
  CardReadout,
  CardTile,
  ClipList,
  ConfirmModal,
  Empty,
  Field as FormField,
  FLAG_KINDS,
  FLAG_NOTE_MAX,
  Help,
  Icon,
  IconButton,
  ItemList,
  KeysButton,
  Lede,
  Notice,
  LanguageRadio,
  Screen,
  Section,
  Segmented,
  serverCardId,
  SnackbarProvider,
  Stat,
  StickyFoot,
  Tabs,
  plural,
  pullCourses,
  shortDate,
  pullAdmin,
  pullTeaching,
  useLiveRefresh,
  useScrollTop,
  useSlowWait,
  useSnackbar,
  useSnackbarState,
} from "./shared.tsx";

/* The onboarding, teaching, admin and course screens are their own chunk,
   fetched on the first tap that opens one of them. A student drilling cards
   never parses a line of the admin console. */
/* After a deploy, an app that has been open for a while still holds the
   old bundle, whose chunk names the new service worker has already thrown
   away. The first tap on a lazy screen then fails to load, and without this
   the screen went blank. One reload picks up the new build; the flag stops
   a genuinely broken deploy from reloading for ever. */
const RELOADED_FLAG = "at-chunk-reloaded";

function recoverChunk(err: unknown) {
  let already = false;
  try {
    already = sessionStorage.getItem(RELOADED_FLAG) === "1";
    if (!already) sessionStorage.setItem(RELOADED_FLAG, "1");
  } catch (e) {
    /* storage blocked: reload once anyway is still the better bet */
  }
  if (!already) {
    window.location.reload();
    // The page is going away, so this promise is never settled.
    return new Promise<never>(() => {});
  }
  throw err;
}

/* The name is checked against what spaces.tsx actually exports: a lazy
   import spells its component as a string, so a typo is a blank screen at
   the moment someone opens the space, and nothing before. */
type SpacesModule = typeof import("./spaces.tsx");
/* Only the exports that are components. The module also exports plain
   functions and tables, and naming one of those here would typecheck and
   render nothing. */
type SpaceName = {
  [K in keyof SpacesModule]: SpacesModule[K] extends React.ComponentType<any> ? K : never;
}[keyof SpacesModule];

const fromSpaces = (name: SpaceName): React.ComponentType<any> =>
  React.lazy(() =>
    import("./spaces.tsx")
      .then((m) => {
        try {
          sessionStorage.removeItem(RELOADED_FLAG);
        } catch (e) {
          /* fine */
        }
        return { default: m[name] };
      })
      .catch(recoverChunk)
  );
const Onboarding = fromSpaces("Onboarding");
const AdminSpace = fromSpaces("AdminSpace");
const ClaimAdmin = fromSpaces("ClaimAdmin");
const TeachSpace = fromSpaces("TeachSpace");
const StudentCourses = fromSpaces("StudentCourses");

/* What shows while the chunk is in flight — which, once it is cached, is
   long enough to paint and not long enough to read. Held back until the
   wait is a real one, so an ordinary trip into a space is silent rather
   than a word that appears and goes. */
function ChunkFallback() {
  const slow = useSlowWait(true);
  return slow ? <Help>Loading…</Help> : null;
}
import * as API from "./courses-api.ts";
import {
  DEFAULT_LANGUAGE,
  EX,
  LANGUAGES,
  TYPES,
  activeLang,
  checkAnswer,
  answerFields,
  derivedValue,
  dimValues,
  dimsOf,
  contextTokens,
  EASY_TYPES,
  exOf,
  findWordSpan,
  guessKind,
  inScript,
  isListening,
  groupAttrOf,
  labelFor,
  langOf,
  quizAttrOf,
  scriptVars,
  setActiveLang,
  verdictText,
  verdictWord,
  GRAMMAR,
  defaultTypes,
  defaultLanguageOptions,
  grammarFields,
  normDimValue,
} from "./languages.ts";
import {
  MIN,
  LEARNING_CAP,
  MATURE_DAYS,
  YOUNG_CAP,
  difficulty,
  familyMaturity as familyMaturityOf,
  formatGap,
  freshState,
  freshStates,
  itemDifficulty as itemDifficultyOf,
  maturity,
  openTypes as openTypesOf,
  phaseCounts,
  reschedule,
  roomForNew,
  stateReady,
  unitsOf,
  dayKey,
  dueRank,
  inOrder,
  shuffled,
} from "./scheduler.ts";
import { PAIR_WORDS, PICK_OPTIONS, matchGroups, matchSet, optionsFor } from "./chance.ts";
import { buildContextIndex } from "./context-index.ts";
import { canAsk } from "./offers.ts";
import {
  DEFAULT_SPEAKERS,
  DIALOG_KIND,
  MAX_SPEAKERS,
  ORDER_SEP,
  SELF_ALL,
  SELF_SOME,
  buildDialogIndex,
  isDialog,
  isTwoSided,
  linesOf,
  namedPart,
  replyOptions,
  sceneBefore,
  scrambledLines,
  sideOf,
  speakerName,
  speakersOf,
} from "./dialogs.ts";
import {
  answerForTurn,
  answerGiven,
  answersOf,
  meaningForTurn,
  packAnswers,
  withAnswer as oneAnswer,
} from "./answers.ts";
import { fillForm, hasSlots, slotsOf, valueOf, valuesForTurn } from "./variables.ts";
import type { Value } from "./variables.ts";

/*
 * The two that need to know which exercise types a form supports. That
 * answer depends on the language pack and on the index of phrases showing
 * a word in use, neither of which belongs in the scheduler — so it is
 * handed in here, at the one place that has both.
 */
/* Judged on the rungs a form has reached, not on everything it could one
   day be asked: a card whose reading is mature and whose writing has not
   opened yet is young, not new. The progress screen and the room-for-new
   sums both read this, so they agree about how full a learner's hands are. */
const familyMaturity: (it: Item) => string = (it) =>
  familyMaturityOf(it, (u) => openTypesOf(availableTypes(u), (t) => statesOf(u)[t]));
const itemDifficulty: (it: Item) => string = (it) => itemDifficultyOf(it, (u) => availableTypes(u));

import { applyUpdate, holdUpdates } from "./updates.ts";
import {
  syncClips,
  loadSyncConfig,
  saveSyncConfig,
  tokenFor,
  syncOnce,
  forgetRemote,
  compactItem,
  mergeData,
} from "./sync.ts";

/* ==================================================================
   Arabic trainer

   Vocabulary used throughout:
     item          a word, expression or sentence to be learnt
     item data     its three fields: Arabic script, English, transliteration
     exercise      one instance of practicing something
     exercise type one of the four kinds of exercise below
     session       a short sequence of exercises done in one sitting

   Session rules, enforced by buildSession():
     1. A session always contains more than one exercise type.
     2. Every item in a session is practiced in at least two exercise
        types, three where the item data allows it.
     3. Items that resemble each other are preferred within a session.

   Every exercise shows one item's own data, verbatim. Nothing is
   recombined across items.
   ================================================================== */

const KEY = "arabic-trainer-v3";
/* ------------------------------------------------------------------
   Exercise types
   Ordered easiest to hardest: recognition, then decoding, then
   production from sound, then production from meaning.
   ------------------------------------------------------------------ */


/* Recording limits. Opus at 24kbps mono is roughly 3KB a second, so a
   two-second clip lands near 6KB — small enough to sync freely. */
const MAX_RECORD_MS = 15000;
const MAX_CLIP_BYTES = 400000;
const AUDIO_BITRATE = 24000;


/* Nobody, for the account screen when nobody is signed in. It renders
   either way, and this is what it renders as. */
const EMPTY_ACCOUNT: User & { key: string } = { handle: "", displayName: "", admin: false, created: 0, key: "" };

const EMPTY: Doc = {
  version: 3,
  items: [],
  tombstones: {},
  settingsUpdated: 0,
  log: {},
  settings: {
    sessionSize: 18,
    perItem: 3,
    newPerSession: 3,
    /* Written out of the exercise table and the language packs, so a new
       exercise type or a new language's leniency setting cannot arrive
       without a default and silently behave as "off". */
    types: defaultTypes(),
    kinds: { word: true, phrase: true, sentence: true, dialog: true },
    cohesion: "balanced", // off | balanced | strong
    ...defaultLanguageOptions(),
    showHint: false,
    keyboard: "auto",
    warmup: true,
    theme: "auto",
    sounds: "loud",
    language: DEFAULT_LANGUAGE,
  },
};

const now = () => Date.now();






const MATURITY_LABEL: Record<string, string> = { new: "New", learning: "Learning", young: "Young", mature: "Mature" };
const MATURITY_COLOR: Record<string, string> = {
  new: "var(--raised)",
  learning: "var(--rose)",
  young: "var(--brass)",
  mature: "var(--jade)",
};

/* ------------------------------------------------------------------
   Automatic difficulty
   ------------------------------------------------------------------ */

const HARD_BACKLOG_LIMIT = 10;
const DIFF_RANK: Record<string, number> = { easy: 0, steady: 1, unrated: 2, hard: 3 };




/* ------------------------------------------------------------------
   Items
   ------------------------------------------------------------------ */

function cleanTags(input: unknown) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t).trim().replace(/\s+/g, " ");
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}



/* A sub-item is a form of its parent — a plural, a feminine — carrying the
   same three fields and its own progress, but no decks of its own. */
function makeSub(src: Record<string, any> = {}) {
  const { ar = "", lat = "", en = "", note = "", recs = [] } = src;
  return {
    id: `s${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    ar: ar.trim(),
    lat: lat.trim(),
    en: en.trim(),
    ...dimValues(src),
    note: note.trim(),
    /* The language it is written in, kept on the form itself — see
       settingsFor. A card made here is in whatever the app is set to. */
    lang: activeLang().id,
    recs: recs || [],
    created: now(),
    updated: now(),
    s: freshStates(),
  };
}

/* A line of a dialog. A form in every respect that matters — three
   fields, its own recordings, its own progress — plus who says it and
   which word cards it uses. */
function makeLine(src: Record<string, any> = {}) {
  const { ar = "", lat = "", en = "", who = 0, uses = [], recs = [] } = src;
  return {
    id: src.id || `l${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    who: Math.max(0, Math.min(MAX_SPEAKERS - 1, Number(who) || 0)),
    ar: ar.trim(),
    lat: lat.trim(),
    en: en.trim(),
    uses: (uses || []).filter(Boolean),
    lang: src.lang || activeLang().id,
    recs: recs || [],
    created: src.created || now(),
    updated: now(),
    s: src.s || freshStates(),
  };
}

function makeItem(src: Record<string, any> = {}) {
  const {
    ar = "",
    lat = "",
    en = "",
    kind = "",
    note = "",
    tags = [],
    subs = [],
    recs = [],
    lines = [],
  } = src;
  const text = ar || en || lat;
  const s = freshStates();
  const scene = (lines || []).filter((l: any) => l && (l.ar || l.en || l.lat));
  return {
    id: `${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    ar: ar.trim(),
    lat: lat.trim(),
    en: en.trim(),
    /* A card with a conversation on it is a dialog whatever else was
       said: the kind follows the content rather than a picker somebody
       has to remember to set. */
    kind: scene.length ? DIALOG_KIND : kind || guessKind(text, activeLang()),
    ...(scene.length
      ? {
          lines: scene.map((l: any) => (l.id && l.s ? l : makeLine(l))),
          speakers: speakersOf(src),
          /* What the card says, including saying nothing: a scene that
             names no part must not acquire one by being copied. */
          you: namedPart(src),
        }
      : null),
    lang: activeLang().id,
    note: note.trim(),
    tags: cleanTags(tags),
    locked: false,
    flags: [],
    recs: recs || [],
    ...dimValues(src),
    subs: (subs || []).map((x: Record<string, any>) => (x.id ? x : makeSub(x))),
    created: now(),
    updated: now(),
    s,
  };
}


/* ------------------------------------------------------------------
   One app, more than one language

   Somebody in two courses has both piles of cards in one app, and the app
   has one language set — so everything read from the settings was right for
   half their cards and wrong for the other half: which exercises a card
   supports, how an answer is marked, which way its script runs.

   The card knows better than the settings do, and says so: every form
   carries the language it is written in. These two turn that into the
   answer every reader already asks for — the settings, read in the language
   this particular card is in. Everything downstream keeps taking settings,
   which is why this is two small functions rather than a new argument on
   forty.
   ------------------------------------------------------------------ */
const langIdOf = (unit: Form | null | undefined, settings: Settings): LangId =>
  ((unit && unit.lang) || settings.language || DEFAULT_LANGUAGE);

function settingsFor(settings: Settings, unit: Form | null | undefined): Settings {
  const id = langIdOf(unit, settings);
  /* The same object when the card is in the app's own language, which is
     the ordinary case: a new object on every call would defeat every memo
     that takes settings. */
  if (id === settings.language || !LANGUAGES[id]) return settings;
  return { ...settings, language: id };
}

function drillableUnits(item: Item, settings: Settings) {
  return unitsOf(item).filter(({ unit }) => enabledTypes(unit, settings).length >= 2);
}

/* Totals for the list indicators: how many forms, how many clips. */
function familyCounts(it: Item) {
  const units = unitsOf(it);
  let clips = 0;
  for (const { unit } of units) clips += (unit.recs || []).length;
  return { forms: units.length, subs: units.length - 1, clips };
}


/* Someone who can't play sound where they are says so once, and listening
   exercises stop being asked for until this passes. Module-level for the same
   reason as the sound flag and the active language: the helpers below are
   plain functions called from anywhere, not hooks. It is set during render
   from the state that owns it. */
let listenOffUntil = 0;
function setListenOffUntil(until: number) {
  listenOffUntil = until || 0;
}

/* ------------------------------------------------------------------
   Where a word turns up

   A phrase the teacher recorded that contains a word they also teach is a
   context for that word. The pairing is stored on the phrase, as the
   teacher confirmed it; this turns that round into what the exercises
   need — for a given form, the phrases that show it in use.

   Held at module level, in step with the items, for the same reason the
   active language is: availableTypes and the builders are pure functions of
   a card and cannot be handed a map without threading one through every
   caller. Derived, never stored, so it cannot fall out of step with the
   cards it came from.
   ------------------------------------------------------------------ */

let CONTEXT_INDEX = new Map();

function setContextIndex(map: Map<string, any[]>) {
  CONTEXT_INDEX = map || new Map();
}

/* ------------------------------------------------------------------
   What fills a variable

   A phrase may leave a hole in itself — "My name is {{name}}" — and any
   card saying it fills `name` can stand in it. This is that list, by
   language and by variable, held at module level and rebuilt with the
   cards for the reason the index above is: availableTypes is a pure
   function of a unit and cannot be handed a map.

   By language as well as by name, because a Vietnamese name in an Arabic
   frame is not a variation on the sentence, it is a different sentence.
   ------------------------------------------------------------------ */

let VALUE_INDEX: Map<string, Value[]> = new Map();

function setValueIndex(map: Map<string, Value[]>) {
  VALUE_INDEX = map || new Map();
}

const valueKey = (langId: LangId, slot: string) => `${langId} ${slot}`;

/* What each of a unit's variables can be filled with. Empty for the
   ordinary card, which has no holes in it and never looks. */
function fillsFor(unit: Form, langId?: LangId): Record<string, Value[]> {
  const slots = slotsOf(unit);
  if (!slots.length) return {};
  const id = langId || (unit && unit.lang) || activeLang().id;
  const out: Record<string, Value[]> = {};
  for (const slot of slots) out[slot] = VALUE_INDEX.get(valueKey(id, slot)) || [];
  return out;
}

/* ------------------------------------------------------------------
   Which scene a line belongs to

   The same arrangement, for dialogs: a line carries no pointer back to
   its own card, so this is where "which conversation is this, and how far
   into it" is answered. Held at module level and rebuilt with the cards
   for the same reason the one above is — availableTypes is a pure
   function of a unit, and a dialog line is a unit.
   ------------------------------------------------------------------ */

let DIALOG_INDEX: Map<string, { card: Item, at: number }> = new Map();

function setDialogIndex(map: Map<string, { card: Item, at: number }>) {
  DIALOG_INDEX = map || new Map();
}

/* The scene a line stands in, or null for anything that is not a line. */
function sceneOf(unitId: string): { card: Item, at: number } | null {
  return DIALOG_INDEX.get(unitId) || null;
}

/* ------------------------------------------------------------------
   How much company a word has

   The matching grid is the one exercise whose availability is not a fact
   about the card. A word with a meaning can always be read and always be
   written; whether it can be *told apart from anything* depends on what
   else is in the deck. Counted per language, and held here for the reason
   the two indexes above are: availableTypes is a pure function of a unit,
   and cannot be handed the rest of the cards as well.
   ------------------------------------------------------------------ */

let MATE_COUNTS: Map<LangId, number> = new Map();

function setMateCounts(map: Map<LangId, number>) {
  MATE_COUNTS = map || new Map();
}

/* Everything else in this language that could stand beside it. Its own
   card is in the count, so one is taken off. */
function matesFor(unit: Form, settings?: Settings): number {
  const id = (unit && unit.lang) || (settings && settings.language) || activeLang().id;
  return Math.max(0, (MATE_COUNTS.get(id) || 0) - 1);
}

/* Cards that can be a tile in a grid: a word with a meaning, in one
   language. A conversation is not one of them — a scene has no single
   wording to put on a tile. */
function countMates(items: Item[], settings: Settings): Map<LangId, number> {
  const counts: Map<LangId, number> = new Map();
  for (const card of items) {
    if (isDialog(card)) continue;
    const id = langIdOf(card, settings);
    for (const { unit } of unitsOf(card)) {
      /* A card with a variable in it is not one of them: a grid pairs
         words, and only the card being asked is filled in — a frame
         standing in the company would show the hole it left. Nor is a
         value: "Raphael" is in the deck to fill somebody else's sentence,
         and pairing it with its own meaning is the question its card was
         marked as not being. */
      if (card.drill === false) continue;
      if (unit.ar && unit.en && !hasSlots(unit)) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/*
 * The words a wrong answer could be drawn from.
 *
 * The learner's own words in the language being asked, which is what makes
 * a wrong answer worth offering: a word they have never met is not a
 * distractor, it is a word they can rule out by not recognising it. Forms
 * come too — a plural beside its singular is exactly the choice worth
 * making — and the word being asked for is left out, since the drawing
 * puts it back itself.
 */
function wordPool(items: Item[], settings: Settings, langId: LangId, answer: Form) {
  const out = [];
  for (const card of items) {
    if (isDialog(card) || langIdOf(card, settings) !== langId) continue;
    /* Not a frame, and not a value. Filling is done for the card being
       asked, so a card with a hole in it standing among the choices — or in
       a matching grid — would be offered with its {{name}} showing; and a
       card the teacher marked as not practised on its own has no business
       being one of the words a learner is asked to tell apart. */
    if (hasSlots(card) || card.drill === false) continue;
    for (const { unit } of unitsOf(card)) {
      if (unit.ar && unit.id !== answer.id) out.push(unit);
    }
  }
  return out;
}

/* Every line of every dialog, for the exercise that offers three wrong
   replies beside the right one. Kept to the language being asked: a
   Vietnamese line among three Arabic ones is not a distractor, it is a
   giveaway. */
function replyPool(items: Item[], settings: Settings, langId: LangId) {
  const out = [];
  for (const card of items) {
    if (!isDialog(card) || langIdOf(card, settings) !== langId) continue;
    for (const line of linesOf(card)) if (line.ar) out.push(line);
  }
  return out;
}

/* The phrases that show this form in use. Keyed by unit id, so a plural
   held as a form of its card gets its own contexts rather than its
   parent's. */
function contextsFor(unitId: string): any[] {
  return CONTEXT_INDEX.get(unitId) || [];
}

/*
 * Which phrase to show this time.
 *
 * Rotated rather than picked at random, and keyed on how many times the
 * form has been answered, so a word that has three contexts meets all three
 * before it meets any of them twice. Random choice would leave one context
 * unseen for a surprisingly long time.
 */
function pickContext(unit: Form, type: string) {
  const list = contextsFor(unit.id).filter((c) =>
    EX[type] && EX[type].needs.includes("contextAudio") ? (c.recs || []).length > 0 : true
  );
  if (!list.length) return null;
  const seen = (unit.s && unit.s[type] && unit.s[type].reps) || 0;
  return list[seen % list.length];
}

/* Which part a learner plays was only ever read by playing a part, which
   is retired — so a scene that names no part now names nothing that any
   question asks about. The picker in the editor and the line on the card
   still say which part is the student's; nothing yet acts on it. */

/*
 * The card with its variables filled in.
 *
 * First of the three castings, because the other two read the words it
 * writes: narrowing to one accepted answer and to one meaning both work on
 * a sentence that already says Raphael rather than {{name}}.
 *
 * One value per variable, in every field at once — the prompt, the marking
 * and the answer screen are looking at the same person — and rotated by how
 * often this exercise has been asked of this form, like everything else
 * that varies between askings. Nothing is drawn: a card with three names is
 * met as all three before it is met as any of them twice, and a re-render
 * cannot swap the name under somebody halfway through typing.
 *
 * Comes back untouched where a variable has nothing to fill it. That is not
 * a question — canAsk refuses it, so it should never reach here — and
 * leaving {{name}} standing is a visible bug rather than a silent gap.
 */
function castFill(resolved: { unit: Form, parent: Item, isSub: boolean } | null, type: string) {
  if (!resolved) return resolved;
  const slots = slotsOf(resolved.unit);
  if (!slots.length) return resolved;
  const seen = (resolved.unit.s && resolved.unit.s[type] && resolved.unit.s[type].reps) || 0;
  const took = valuesForTurn(slots, fillsFor(resolved.unit), seen);
  if (!took) return resolved;
  const unit = (fillForm(resolved.unit, took) as any);
  return {
    ...resolved,
    unit,
    parent: resolved.parent === resolved.unit ? unit : resolved.parent,
  };
}

/*
 * Which accepted answer a pronunciation question is about.
 *
 * A card may accept two spellings, and each has its own transliteration.
 * Asking "how is this pronounced" of both spellings at once has no answer;
 * asking for one of them by its pronunciation and accepting the other
 * marks the wrong thing right. So these two questions are asked about one
 * answer, and the card is narrowed to it — the prompt, the marking and the
 * answer screen then read one form and cannot disagree about which word is
 * on the table.
 *
 * Rotated by how often this exercise has been asked of this unit, like the
 * phrase a word is shown in and the part a scene is played from: a card
 * with two spellings is drilled on both, one at a time, and the question
 * on screen does not change under a re-render.
 *
 * Only these two narrow the answer. Asked what a card means, or to write it
 * from its meaning, every accepted answer is still accepted — the answer
 * there is the word, not one spelling of it. What the question shows can
 * still be narrowed, which is castMeaning below.
 */
function castAnswer(resolved: { unit: Form, parent: Item, isSub: boolean } | null, type: string) {
  if (!resolved) return resolved;
  const spec = EX[type];
  if (!spec || !spec.needs.includes("lat")) return resolved;
  const seen = (resolved.unit.s && resolved.unit.s[type] && resolved.unit.s[type].reps) || 0;
  const answer = answerForTurn(resolved.unit, seen);
  if (!answer) return resolved;
  const unit = (oneAnswer(resolved.unit, answer) as any);
  return {
    ...resolved,
    unit,
    parent: resolved.parent === resolved.unit ? unit : resolved.parent,
  };
}

/*
 * And which meaning a question made of the meaning asks about.
 *
 * A card may mean more than one thing — "office / desk" — and asked what it
 * means, both are right. The other way round they are not two answers but
 * two questions, and showing both asks neither: the learner reads one
 * English phrase with a slash in the middle of it, and a card that means
 * two things says more about the word than the question set out to give
 * away.
 *
 * So the card is narrowed here too, and the same way — one meaning, rotated
 * by how often this exercise has been asked of this unit, so a card that
 * means two things is asked from both, one at a time. What is accepted does
 * not move: the answer is still the word, and every spelling of it still
 * counts.
 */
function castMeaning(resolved: { unit: Form, parent: Item, isSub: boolean } | null, type: string) {
  if (!resolved) return resolved;
  const spec = EX[type];
  if (!spec || spec.promptField !== "en") return resolved;
  const seen = (resolved.unit.s && resolved.unit.s[type] && resolved.unit.s[type].reps) || 0;
  const one = meaningForTurn(resolved.unit, seen);
  /* Nothing to narrow: one meaning, or none written at all — in which case
     this exercise was never offered, and the card is left exactly as it is
     rather than having its one empty field rewritten. */
  if (!one || one === String(resolved.unit.en || "").trim()) return resolved;
  const unit = ({ ...resolved.unit, en: one } as any);
  return {
    ...resolved,
    unit,
    parent: resolved.parent === resolved.unit ? unit : resolved.parent,
  };
}

/* The phrase with the target word taken out, as the question shows it. */
function blankedPhrase(context: any, lang: Lang, blank: string = "____") {
  const tokens = contextTokens(context.ar, lang);
  const span = Math.max(1, context.span || 1);
  if (context.slot < 0 || context.slot >= tokens.length) return context.ar;
  return tokens
    .map((t, i) => (i === context.slot ? blank : i > context.slot && i < context.slot + span ? null : t))
    .filter((t) => t !== null)
    .join(" ");
}

/* Whether a type may be asked at this moment. Only the clock makes this
   false, so it is deliberately not part of what a card "supports". */
function typeAllowedNow(type: string) {
  return !(listenOffUntil > Date.now() && isListening(type));
}

/* How long "can't listen right now" lasts. Long enough to cover the walk, the
   queue or the meeting that prompted it; short enough that forgetting about
   it costs one session rather than a week of never hearing the language. */
const LISTEN_OFF_MS = 15 * 60 * 1000;

/*
 * Telling the server that learning is happening.
 *
 * Practice is entirely local — the questions, the grading and the schedule
 * all live on the device — so without this the only thing an administrator
 * can see is whether somebody signed in, which a person who opens the app
 * and does nothing also does. One ping per graded answer would say the same
 * thing a hundred times a session, so the first answer sends one and the
 * next quarter of an hour sends none: the server keeps only the moment, and
 * a moment fifteen minutes stale answers every question anyone asks of it.
 *
 * Fire and forget. It is a courtesy to the teacher, not part of practising,
 * so a failure must never reach the session — offline, it simply tries again
 * at the next answer.
 */
const LEARNED_PING_MS = 15 * 60 * 1000;
/* A ping that didn't arrive buys a minute rather than the full quarter of
   an hour: practising on a train should end up recorded, without every
   answer between tunnels making its own failed request. */
const LEARNED_RETRY_MS = 60 * 1000;
let learnedQuietUntil = 0;
function reportLearning(account: User | null) {
  if (!account || now() < learnedQuietUntil) return;
  learnedQuietUntil = now() + LEARNED_PING_MS;
  API.practiced().catch(() => {
    learnedQuietUntil = Math.min(learnedQuietUntil, now() + LEARNED_RETRY_MS);
  });
}

/*
 * Take the listening exercises out of what is left of a queue.
 *
 * Only the tail is rewritten — everything before `from` has been answered and
 * is left exactly as it was. That is what keeps the cursor honest: filtering
 * the whole array would slide later entries down underneath a stationary
 * index, and the learner would silently skip questions they had never seen.
 *
 * A listening exercise becomes another way of asking about the same card,
 * preferring one that is not already queued for it. A card that has nothing
 * else to offer — a recording and a spelling, no English — drops out of the
 * rest of the session; there is genuinely nothing to ask.
 */
export function withoutListening(exercises: Question[], from: number, items: Item[], settings: Settings): Question[] {
  const keyOf = (ex: Question) => `${ex.id} ${ex.subId || ""}`;
  const used: Map<string, Set<string>> = new Map();
  const note = (ex: Question, type: string) => {
    const k = keyOf(ex);
    let seen = used.get(k);
    if (!seen) used.set(k, (seen = new Set()));
    seen.add(type);
  };
  /* Everything already planned counts, answered or not: a substitute should
     be a different question, not the one queued two turns later. */
  for (const ex of exercises) if (!isListening(ex.type)) note(ex, ex.type);

  const tail: Question[] = [];
  for (const ex of exercises.slice(from)) {
    if (!isListening(ex.type)) {
      tail.push(ex);
      continue;
    }
    const resolved = resolveUnit(items, ex);
    if (!resolved) continue;
    /* Filtered here rather than trusting the clock, so this answers the same
       way whenever it is called — including from a test. */
    /* From the rungs the form has reached, and never the grid: a grid is
       dealt when the session is built, and one conjured here would be a
       word alone with nothing to be told apart from. */
    const options = openTypes(resolved.unit, settings).filter((t) => !isListening(t) && t !== "match");
    if (!options.length) continue;
    const seen = used.get(keyOf(ex)) || new Set();
    const pick = options.find((t) => !seen.has(t)) || options[0];
    note(ex, pick);
    /* The phrase named on the old question is not necessarily right for the
       new one — a spoken context may have no written place to stand, and a
       question that needs no context must not carry one. Decided fresh. */
    const ctx = EX[pick].needs.includes("contexts") ? pickContext(resolved.unit, pick) : null;
    const { ctx: _dropped, ...rest } = ex;
    tail.push({ ...rest, type: pick, ...(ctx ? { ctx: ctx.id } : null) });
  }
  return exercises.slice(0, from).concat(tail);
}

/* Which exercise types this card's data can support.

   Note this is not filtered by the quiet window: it answers what the card
   holds, and the preview rows, the weak-card count and unitFullyLearnt all
   ask it that. Silencing here would make a card look broken, or call it
   fully learnt while a third of its exercises were merely paused. */
function availableTypes(it: Form, lang: Lang = activeLang(), scene = sceneOf(it.id)): string[] {
  /* What its variables can be filled with, if it has any: a hole with
     nothing to put in it is not a question, and a card whose words change
     cannot be the one on a recording. Both are answered inside canAsk. */
  /* One question, asked in one place: which exercises this unit can be
     asked. The teaching space asks the same one of the same cards — to
     say what a card could be drilled as before anybody presses anything —
     and two answers to it would be two apps disagreeing about what a card
     supports. */
  const values = fillsFor(it, lang.id);
  return TYPES.filter((t) =>
    canAsk(
      { unit: it, scene, contexts: contextsFor(it.id), values, mates: matesFor(it) },
      t,
      lang
    )
  );
}

function enabledTypes(it: Form, settings: Settings): string[] {
  /* The language comes from the settings in hand, not from the module-level
     pointer — that is only set during render, and this runs from anywhere.
     Read in the card's own language, so a Vietnamese card is not asked
     whether it supports the exercises Arabic declares. */
  return availableTypes(it, langOf(settingsFor(settings, it))).filter(
    (t) => settings.types[t] && typeAllowedNow(t)
  );
}

/* And of those, the ones on a rung the form has reached — see the ladder
   in the scheduler. This is what a session asks from; enabledTypes is what
   a card supports, which is the question the card list and the counts of
   what is drillable ask. A rung that has not opened is still the card's
   to reach, not a hole in it. */
function openTypes(it: Form, settings: Settings): string[] {
  /* The rungs are read over everything the card supports and the learner
     has switched on, and only then is the quiet window applied: a
     listening exercise silenced for a quarter of an hour is still a rung
     to be climbed, not a gap that lets the one above it open early. */
  const supported = availableTypes(it, langOf(settingsFor(settings, it))).filter((t) => settings.types[t]);
  return openTypesOf(supported, (t) => statesOf(it)[t]).filter((t) => typeAllowedNow(t));
}

/* Rule 2: a unit needs at least two exercise types to appear at all, and a
   family is drillable when its main form qualifies. */
/* A card that has never been answered carries no schedule at all, so every
   reader of one wants the empty record rather than a crash. Said once here
   because the alternative is the same guard at three dozen call sites, and
   the sites that forgot it were only ever found by someone hitting them. */
const statesOf = (unit: Form): Record<string, ExerciseState> => unit.s || {};

function isDrillable(it: Item, settings: Settings) {
  /* A card the teacher says is not practised on its own. A value — the
     "Raphael" that fills {{name}} in somebody else's sentence — is there to
     be borrowed, and "what does Raphael mean" is not a question. Absent
     means yes, which is what every card written before this meant. */
  if (it.drill === false) return false;
  if (!settings.kinds[it.kind || ""]) return false;
  /* A scene qualifies through its lines rather than through itself. The
     card carries the two whole-scene exercises and a short dialog carries
     only one of them, so asking the card alone would throw away a
     conversation whose every line is ready to be asked. */
  if (isDialog(it)) return drillableUnits(it, settings).length > 0;
  return enabledTypes(it, settings).length >= 2;
}

/* One shuffle in the app, and it lives in the scheduler with the rest of
   what decides an order — see "Random among equals" there. */
const shuffle: <T>(arr: T[]) => T[] = (arr) => shuffled(arr);

/* ------------------------------------------------------------------
   Similarity — rule 3
   ------------------------------------------------------------------ */

/*
 * How alike two words look, in the language's own terms: shared consonants
 * in Arabic, the same spelling under different marks in Vietnamese.
 *
 * Read twice — by the session builder, which uses it to bring related cards
 * into one sitting, and by the matching grid, which uses it to choose words
 * worth confusing. Two copies of it would be two apps disagreeing about
 * what "alike" means.
 */
function wordLikeness(a: string, b: string, lang: Lang): number {
  const key = lang.similarityKey || ((x: string) => String(x || ""));
  const ka = key(a);
  const kb = key(b);
  if (ka.length < 2 || kb.length < 2) return 0;
  if (lang.similarityMode === "chars") {
    /* Arabic: shared consonants in any order suggest a shared root. */
    const setB = new Set(kb);
    const overlap = [...new Set(ka)].filter((ch) => setB.has(ch)).length;
    if (overlap >= 3) return 4;
    return overlap === 2 ? 1.5 : 0;
  }
  /* Everyone else: the same word under different marks — a minimal pair. */
  return ka === kb ? 4 : 0;
}

function similarity(a: Item, b: Item) {
  let score = 0;

  /*
   * One card teaching a word the other contains is the strongest kinship
   * two cards in this app can have — stronger than sharing a deck, and
   * stronger than sharing three consonants, both of which are guesses at
   * the relation this one states outright. A teacher ticked it.
   *
   * It is what brings a word and its phrase into the same session, so that
   * meeting the word alone and meeting it in use happen in one sitting
   * rather than in two unrelated ones. Which comes first is settled
   * elsewhere: the context exercises sit below the plain ones in the
   * table, so a unit is asked the word before it is asked the phrase.
   */
  if ((a.uses || []).includes(b.id) || (b.uses || []).includes(a.id)) score += 8;

  const tagsA = new Set(a.tags || []);
  const sharedTags = (b.tags || []).filter((t) => tagsA.has(t)).length;
  score += sharedTags * 3;

  score += wordLikeness(a.ar, b.ar, activeLang());

  if (a.kind === b.kind) score += 0.5;
  // Added in the same sitting — usually the same lesson.
  if (Math.abs((a.created || 0) - (b.created || 0)) < 10 * MIN) score += 1.5;

  return score;
}

const COHESION_POOL: Record<string, number> = { off: 1, balanced: 3, strong: 6 };

/* ------------------------------------------------------------------
   Session building
   ------------------------------------------------------------------ */


const MAX_UNITS_PER_FAMILY = 4;

/* And of a conversation, in one sitting. Deliberate rather than
   discovered: without it a six-line scene is the whole session, and the
   first thing anyone would have written is a scene with six lines. */
const MAX_DIALOG_LINES = 2;



const MODES = {
  regular: {
    label: "Regular",
    blurb: "A balanced mix, the way a normal review works — a few exercise types per card.",
  },
  ultimate: {
    label: "Ultimate",
    blurb: "Every chosen item in every chosen exercise type, repeating anything you miss until you have it right.",
  },
  started: {
    label: "Get started",
    blurb: "Recognition only — reading the script and hearing it, never producing it. The gentle way in.",
  },
  mistakes: {
    label: "Fix mistakes",
    blurb: "Only the cards you've slipped on in the last couple of attempts.",
  },
};

/* Did this form go wrong in either of its last two outings? */
function hasRecentMistake(unit: Form) {
  const states = statesOf(unit);
  let sawHistory = false;
  for (const t of availableTypes(unit)) {
    const h = states[t].hist || [];
    if (h.length) {
      sawHistory = true;
      if (h.slice(-2).some((x) => !x)) return true;
    }
  }
  // Nothing recorded yet — fall back to whether it has ever gone wrong.
  if (!sawHistory) {
    return availableTypes(unit).some((t) => (states[t].wrong || 0) > 0 || (states[t].lapses || 0) > 0);
  }
  return false;
}

/*
 * Keep consecutive questions from sharing an exercise type where the
 * material allows it. A greedy pass: take the next exercise whose type
 * differs from the one before, preferring a different item too.
 */
function varyTypes(list: Question[]): Question[] {
  const out: Question[] = [];
  const rest = list.slice();
  let prevType: string | null = null;
  let prevId: string | null = null;
  while (rest.length) {
    let pick = rest.findIndex((e) => e.type !== prevType && (e.id !== prevId || rest.length === 1));
    if (pick === -1) pick = rest.findIndex((e) => e.type !== prevType);
    if (pick === -1) pick = 0;
    const [e] = rest.splice(pick, 1);
    out.push(e);
    prevType = e.type;
    prevId = e.id;
  }
  return out;
}

/*
 * `reason` names why a session came back empty, so the button that asked
 * for it can say something rather than appear broken. `items` and `units`
 * are the sizes of what was built, and are there only when there is one.
 */
interface Session {
  exercises: Question[];
  reason: string | null;
  items?: number;
  units?: number;
}

function buildSession({
  items,
  settings,
  inDeck,
  practice,
  includeAll,
  budget: budgetIn,
}: {
  items: Item[];
  settings: Settings;
  inDeck: (it: Item) => boolean;
  practice?: boolean;
  includeAll?: boolean;
  budget?: number;
}): Session {
  const pool = items.filter((it) => inDeck(it) && isDrillable(it, settings));
  if (!pool.length) return { exercises: [], reason: "none-drillable" };

  const perUnit = Math.max(2, settings.perItem);
  const budget = Math.max(4, budgetIn || settings.sessionSize);

  /* --- candidate families --- */
  let candidates = pool.map((it) => {
    const units = drillableUnits(it, settings);
    /* Over the open rungs only. A rung not yet reached is all fresh
       states, and a fresh state is ready by definition — counted, it would
       have every card in the deck due at once. */
    const dues: number[] = [];
    for (const { unit } of units) {
      for (const t of openTypes(unit, settings)) dues.push(statesOf(unit)[t].due || 0);
    }
    const ready = units.some(({ unit }) =>
      openTypes(unit, settings).some((t) => stateReady(statesOf(unit)[t]))
    );
    const isNew = units.every(({ unit }) =>
      openTypes(unit, settings).every((t) => statesOf(unit)[t].phase === "new")
    );
    return { it, units, soonest: dues.length ? Math.min(...dues) : 0, ready, isNew };
  });

  /* Ordered before anything is filtered, because the filter below keeps
     the first few new cards and "the first few" is decided here. Anything
     already due ranks together and is shuffled, so which new cards a
     session opens with, and which of the overdue ones it reaches, differ
     from one sitting to the next. */
  candidates = inOrder(candidates, (c) => dueRank(c.soonest));

  // A hand-picked session takes everything chosen, due or not.
  if (!practice && !includeAll) {
    candidates = candidates.filter((c) => c.ready);
    if (settings.warmup) {
      const backlog = pool.filter((it) =>
        drillableUnits(it, settings).some(({ unit }) =>
          enabledTypes(unit, settings).some(
            (t) =>
              difficulty(statesOf(unit)[t]) === "hard" &&
              maturity(statesOf(unit)[t]) !== "mature"
          )
        )
      ).length;
      if (backlog >= HARD_BACKLOG_LIMIT) candidates = candidates.filter((c) => !c.isNew);
    }
    /* How full the learner's hands are, counted over everything they hold
       in this language and not only the deck in front of them: the deck is
       what they chose to look at, the load is what they carry. */
    const inHand = phaseCounts(
      items.filter((it) => isDrillable(it, settings)),
      (u) => openTypes(u, settings)
    );
    const room = roomForNew(inHand, settings.newPerSession);
    let newSeen = 0;
    candidates = candidates.filter((c) => {
      if (!c.isNew) return true;
      newSeen += 1;
      return newSeen <= room;
    });
  }

  if (!candidates.length) return { exercises: [], reason: "nothing-due" };

  /* --- rule 3: reach further down the due list for related items --- */
  const avgUnits =
    candidates.reduce((n, c) => n + Math.min(c.units.length, MAX_UNITS_PER_FAMILY), 0) /
    candidates.length;
  const wanted = Math.max(1, Math.round(budget / (perUnit * Math.max(1, avgUnits))));
  const reach = COHESION_POOL[settings.cohesion] || 1;
  const shortlist = candidates.slice(0, Math.min(candidates.length, Math.max(wanted, wanted * reach)));

  const first = shortlist.shift();
  const chosen = first ? [first] : [];
  while (chosen.length < wanted && shortlist.length) {
    let bestIdx = 0;
    if (settings.cohesion !== "off") {
      let best = -Infinity;
      shortlist.forEach((cand, i) => {
        const sim = Math.max(...chosen.map((c) => similarity(c.it, cand.it)));
        const score = sim - i * 0.15;
        if (score > best) {
          best = score;
          bestIdx = i;
        }
      });
    }
    const next = shortlist.splice(bestIdx, 1)[0];
    if (!next) break;
    chosen.push(next);
  }

  /* Easiest first, and cards of the same difficulty in no particular
     order — which is most of them, since a card nobody has been wrong
     about yet is unrated. */
  const warmed = settings.warmup
    ? inOrder(chosen, (c) => DIFF_RANK[itemDifficulty(c.it)])
    : shuffle(chosen);

  /* --- rules 2 and 6: every unit gets several exercise types, and a
         family's sub-items come along in the same session --- */
  const plans = [];
  for (const c of warmed) {
    // Parent first, then whichever sub-items are most overdue.
    const parent = c.units.filter((u) => !u.isSub);
    const subs = inOrder(
      c.units.filter((u) => u.isSub),
      (u) =>
        dueRank(Math.min(...openTypes(u.unit, settings).map((t) => statesOf(u.unit)[t].due || 0)))
    );
    /* A scene offers a line or two and not all of itself. Six lines would
       otherwise take a session over between them, and a conversation met
       two lines at a time across three evenings is learnt better than one
       swallowed whole in one. The whole-scene exercises come along beside
       them, which is what the card's own unit is. */
    const take = isDialog(c.it)
      ? parent.concat(subs.slice(0, MAX_DIALOG_LINES))
      : parent.concat(subs).slice(0, MAX_UNITS_PER_FAMILY);

    for (const { unit, isSub } of take) {
      const ordered = pickableTypes(unit, settings);
      const picked = ordered.slice(0, Math.min(Math.max(2, perUnit), ordered.length));
      /* Asked in the table's own order, which runs from recognition to
         production: which exercises a unit gets is a matter of chance,
         the order they come in is not. */
      picked.sort((x, y) => TYPES.indexOf(x) - TYPES.indexOf(y));
      plans.push({ id: c.it.id, subId: isSub ? unit.id : null, unit, types: picked });
    }
  }

  /* --- interleave, so a unit recurs with a gap rather than back to back --- */
  const exercises = [];
  const depth = Math.max(...plans.map((p) => p.types.length));
  for (let round = 0; round < depth; round++) {
    for (const p of plans) {
      if (p.types[round]) {
        const type = p.types[round];
        /* Which phrase, decided when the queue is built rather than at the
           moment of asking, so the question does not change under the
           learner if the cards are refreshed mid-session. */
        const ctx = p.unit ? pickContext(p.unit, type) : null;
        exercises.push({ id: p.id, subId: p.subId, type, ...(ctx ? { ctx: ctx.id } : null) });
      }
    }
  }

  /* The grids, dealt: every word the plans mean to ask as a pair is put in
     one, and a word whose grid could not be filled is asked its next
     exercise instead. */
  const varied = varyTypes(
    withGrids(exercises, items, settings, (unit, queued) =>
      pickableTypes(unit, settings).find((t) => t !== "match" && !queued.has(t)) || null
    )
  );
  /* Rule 1, judged on the material: a session is refused for want of
     variety when the cards in it support only one exercise between them,
     not when the ladder has opened only one so far. A deck of new scenes
     is asked to read each through and nothing harder, and that is a
     session — a short one, until the reading is mastered. */
  const offered = new Set(plans.flatMap((p) => enabledTypes(p.unit, settings)));
  if (offered.size < 2) return { exercises: [], reason: "no-variety" };

  return {
    exercises: withReadThroughs(varied.slice(0, budget), items),
    reason: null,
    items: new Set(plans.map((p) => p.id)).size,
    units: plans.length,
  };
}

/*
 * The matching grids, dealt.
 *
 * A plan asks a form the grid the way it asks it anything else — one
 * question about one form — and a grid is five questions at once. So the
 * grid questions in a queue are gathered here and dealt into grids, and
 * what goes back is one question per grid, on its first word, carrying the
 * rest as `mates`: each of them is marked and scheduled in its own right
 * when the grid is checked.
 *
 * A grid is filled out from what the learner has already met — in this
 * language, with the grid open to it, most overdue first — so that filling
 * one never introduces a card the rules for what is new did not admit. A
 * word whose grid still cannot be filled is asked something else instead,
 * which `substitute` chooses from what the queue does not already ask it.
 */
function withGrids(
  list: Question[],
  items: Item[],
  settings: Settings,
  substitute: (unit: Form, queued: Set<string>) => string | null
): Question[] {
  const keyOf = (ex: Question) => `${ex.id} ${ex.subId || ""}`;
  const queued: Map<string, Set<string>> = new Map();
  for (const ex of list) {
    const k = keyOf(ex);
    if (!queued.has(k)) queued.set(k, new Set());
    (queued.get(k) as Set<string>).add(ex.type);
  }

  /* Where a form lives, for turning a grid back into questions. */
  const placeOf: Map<string, { id: string; subId: string | null }> = new Map();
  const wanting: Map<LangId, Form[]> = new Map();
  for (const ex of list) {
    if (ex.type !== "match") continue;
    const r = resolveUnit(items, ex);
    if (!r || placeOf.has(r.unit.id)) continue;
    placeOf.set(r.unit.id, { id: ex.id, subId: ex.subId || null });
    const lang = langIdOf(r.unit, settings);
    wanting.set(lang, (wanting.get(lang) || []).concat([r.unit]));
  }
  if (!wanting.size) return list;

  const leadOf: Map<string, Form[]> = new Map(); // first word -> the rest
  const dealt: Set<string> = new Set();
  const dropped: Set<string> = new Set();
  for (const [lang, asked] of wanting) {
    const spares: Form[] = [];
    for (const card of items) {
      if (!isDrillable(card, settings) || langIdOf(card, settings) !== lang) continue;
      if (isDialog(card) || hasSlots(card)) continue;
      for (const { unit, isSub } of unitsOf(card)) {
        if (!unit.ar || !unit.en || placeOf.has(unit.id)) continue;
        const st = statesOf(unit).match;
        if (!st || st.phase === "new" || !openTypes(unit, settings).includes("match")) continue;
        placeOf.set(unit.id, { id: card.id, subId: isSub ? unit.id : null });
        spares.push(unit);
      }
    }
    const lg = langOf(settingsFor(settings, asked[0]));
    const { grids, dropped: out } = matchGroups({
      wanting: asked,
      spares: inOrder(spares, (u) => dueRank(statesOf(u).match.due || 0)),
      textOf: (u) => u.ar,
      meaningOf: (u) => u.en,
      likeness: (a, b) => wordLikeness(a.ar, b.ar, lg),
    });
    for (const grid of grids) {
      leadOf.set(grid[0].id, grid.slice(1));
      for (const u of grid) dealt.add(u.id);
    }
    for (const u of out) dropped.add(u.id);
  }

  const result: Question[] = [];
  for (const ex of list) {
    if (ex.type !== "match") {
      result.push(ex);
      continue;
    }
    const r = resolveUnit(items, ex);
    if (!r) continue;
    const rest = leadOf.get(r.unit.id);
    if (rest) {
      leadOf.delete(r.unit.id); // once, whatever the queue asked twice
      result.push({ ...ex, mates: rest.map((u) => placeOf.get(u.id) as { id: string; subId: string | null }) });
      continue;
    }
    if (dealt.has(r.unit.id) || !dropped.has(r.unit.id)) continue;
    const pick = substitute(r.unit, queued.get(keyOf(ex)) || new Set());
    if (!pick) continue;
    const ctx = EX[pick].needs.includes("contexts") ? pickContext(r.unit, pick) : null;
    const { mates: _none, ...bare } = ex;
    result.push({ ...bare, type: pick, ...(ctx ? { ctx: ctx.id } : null) });
  }
  return result;
}

/*
 * A dialog never opens with a blank.
 *
 * The first question a scene asks in a session is preceded by the scene
 * itself, read through with nothing marked — but only the first time the
 * learner meets it. A read-through is not scheduled and carries no
 * progress: it is an introduction, and introducing two people who have
 * already met is how a session starts wasting somebody's evening.
 *
 * Put in after the budget has been taken, so a scene cannot lose one of
 * its questions to its own preamble.
 */
function withReadThroughs(list: any[], items: Item[]) {
  const seen = new Set();
  const out = [];
  for (const ex of list) {
    const card = items.find((i) => i.id === ex.id) || null;
    if (card && isDialog(card) && !seen.has(card.id)) {
      seen.add(card.id);
      if (sceneUnmet(card)) out.push({ id: card.id, subId: null, type: "dlgread" });
    }
    out.push(ex);
  }
  return out;
}

/* Nobody has answered anything about this scene yet — not a line, not the
   scene itself. */
function sceneUnmet(card: Item) {
  return unitsOf(card).every(({ unit }) =>
    availableTypes(unit).every((t) => (statesOf(unit)[t] || freshState()).phase === "new")
  );
}

/*
 * Which exercises a unit could be asked, best first.
 *
 * Two rankings, and chance inside each. What is due comes before what is
 * not, because a session is for what is due; and while a unit is still
 * new, recognition comes before production, because the first thing you
 * do with a word is recognise it. Everything the two agree about is
 * equal, and equal things are shuffled — so a card met twice in a week is
 * not met the same way twice.
 *
 * Without this a unit was always drilled in the first two or three types
 * of the table, and the other half of what a card supports was practised
 * only when those had been answered into the future.
 */
function pickableTypes(unit: Form, settings: Settings) {
  const types = openTypes(unit, settings);
  const fresh = types.every((t) => statesOf(unit)[t].phase === "new");
  return inOrder(types, (t) => {
    const ready = stateReady(statesOf(unit)[t]) ? 0 : 2;
    const gentle = fresh && !EX[t].gentle ? 1 : 0;
    return ready + gentle;
  });
}

/* Every exercise type this form supports is already mature. */
function unitFullyLearnt(unit: Form) {
  const types = availableTypes(unit);
  return types.length > 0 && types.every((t) => maturity(statesOf(unit)[t]) === "mature");
}

/* Exercise types follow from the mode, so there is nothing to choose. */
function typesForMode(mode: string, settings: Settings) {
  /* The second place the quiet window has to be honoured: the manual builder
     comes through here rather than through enabledTypes. Get started draws on
     two gentle types, one of which is listening, so during the window it
     builds from recognition alone — which is still the gentle end. */
  const enabled = TYPES.filter((t) => settings.types[t] && typeAllowedNow(t));
  return mode === "started" ? enabled.filter((t) => EASY_TYPES.includes(t)) : enabled;
}

/* Ultimate drills every type on every card; the rest take a sample. */
function everyTypeMode(mode: string) {
  return mode === "ultimate";
}

/*
 * A session assembled by hand. Fully learnt forms are left out — there is
 * nothing to gain from drilling them — and the caller is told which cards
 * were skipped for that reason so it can say so.
 */
function buildManualSession({ items, settings, ids, mode, count }: {
  items: Item[];
  settings: Settings;
  ids: Set<string> | string[];
  mode: string;
  count?: number;
}) {
  const chosen = new Set(ids);
  const allowed = new Set(typesForMode(mode, settings));
  /* Two types is the rule everywhere else, and it is what keeps a session
     from being one exercise repeated. Get started draws on the two gentle
     types alone, one of which needs a recording, so holding it to two would
     quietly turn the beginners' mode into one that only accepts cards with
     audio. It takes a card on one. */
  const minTypes = mode === "started" ? 1 : 2;
  if (allowed.size < minTypes) return { exercises: [], reason: "no-variety" };

  const pool = items.filter((i) => chosen.has(i.id) && settings.kinds[i.kind || ""]);
  const perUnit = Math.max(2, settings.perItem);
  const plans: Question[] = [];
  const learnt = [];
  /* What the mode allows of what the form supports, and of that, the
     rungs the form has reached: a session built by hand climbs the same
     ladder a dealt one does. A form qualifies on the first — it is the
     material that has to offer two exercises — and is asked from the
     second. */
  const supportedFor = (unit: Form) => availableTypes(unit).filter((t) => allowed.has(t));
  const usableFor = (unit: Form) => openTypesOf(supportedFor(unit), (t) => statesOf(unit)[t]);
  /* Every exercise the chosen forms support between them, for the
     variety rule below. */
  const offered: Set<string> = new Set();

  for (const it of pool) {
    let anyUsable = false;
    let anyLearnt = false;

    for (const { unit, isSub } of unitsOf(it)) {
      const supported = supportedFor(unit);
      if (supported.length < minTypes) continue;
      if (unitFullyLearnt(unit)) {
        anyLearnt = true;
        continue;
      }
      if (mode === "mistakes" && !hasRecentMistake(unit)) continue;
      const usable = usableFor(unit);
      if (!usable.length) continue;
      anyUsable = true;
      for (const t of supported) offered.add(t);

      const take = everyTypeMode(mode)
        ? usable
        : shuffle(usable).slice(0, Math.min(perUnit, usable.length));
      for (const t of take) {
        const ctx = pickContext(unit, t);
        plans.push({ id: it.id, subId: isSub ? unit.id : null, type: t, ...(ctx ? { ctx: ctx.id } : null) });
      }
    }

    if (!anyUsable && anyLearnt) learnt.push(it);
  }

  if (!plans.length) {
    return {
      exercises: [],
      reason: learnt.length ? "all-learnt" : mode === "mistakes" ? "no-mistakes" : "none-drillable",
      learnt,
    };
  }

  /* Shuffle first, so the queue doesn't track the order of your card list,
     then space the types out. Ultimate ignores the length: it runs until
     everything has gone right at least once. */
  const ordered = varyTypes(
    withGrids(shuffle(plans), items, settings, (unit, queued) =>
      shuffle(usableFor(unit)).find((t) => t !== "match" && !queued.has(t)) || null
    )
  );
  const exercises = everyTypeMode(mode) ? ordered : ordered.slice(0, Math.max(4, count || 0));

  /* The same minimum again, and the one easily missed: when every card chosen
     supports a single gentle type the whole session is that one type, so
     relaxing only the per-card check above would still refuse to build.
     Judged on what the cards support, as above: a session the ladder has
     narrowed to one exercise is still a session. */
  if (offered.size < minTypes) return { exercises: [], reason: "no-variety", learnt };

  return {
    exercises: withReadThroughs(exercises, items),
    reason: null,
    manual: true,
    mode,
    learnt,
    items: new Set(exercises.map((e) => e.id)).size,
    units: plans.length,
  };
}

/* Resolve an exercise back to the item and the specific form it drills. */
function resolveUnit(items: Item[], ex: Question | null | undefined) {
  if (!ex) return null;
  const parent = items.find((i) => i.id === ex.id);
  if (!parent) return null;
  if (!ex.subId) return { parent, unit: parent, isSub: false };
  const sb = (parent.subs || []).find((x) => x.id === ex.subId);
  if (sb) return { parent, unit: sb, isSub: true };
  /* Or a line of the conversation, which travels in the queue the same
     way a form does: the card's id and the line's. */
  const line = linesOf(parent).find((x) => x.id === ex.subId);
  return line ? { parent, unit: line, isSub: true } : null;
}

/* ------------------------------------------------------------------
   Languages

   Everything a language needs in order to be taught lives in one place:
   its script and direction, the on-screen keys it needs, how an answer is
   judged, which leniency settings make sense for it, and a plain-language
   account of its rules for the admin screens.

   Adding a language means adding an entry here. Nothing else in the app
   knows about Arabic specifically.
   ------------------------------------------------------------------ */


/* ------------------------------------------------------------------
   Grammatical dimensions

   A card may have several correct forms, varying along axes the language
   chooses. Arabic varies by number and gender; Vietnamese does not decline
   at all, but the same word is said differently depending on who is being
   addressed. Each pack names the axes it uses; the editor renders those and
   nothing else.
   ------------------------------------------------------------------ */


/* ------------------------------------------------------------------
   Derived properties

   Values read out of the card's own spelling rather than typed by hand:
   the tone of a Vietnamese word, the consonantal root of an Arabic one.
   They are computed on demand and never stored, so they cannot fall out
   of step with the text and there is nothing to migrate.

   A pack that marks one as quizzable gets the listening exercise that
   drills it, without the trainer knowing what a tone is.
   ------------------------------------------------------------------ */


/*
 * The other words this one belongs with.
 *
 * What "belongs with" means is the language's answer, not the app's: the
 * pack names one derived property as the one that groups words, and the
 * app gathers everything sharing a value for it. In Huế that is the
 * spelling without its tone, so the group is the words you might mishear
 * for this one. In Arabic it is the consonantal skeleton, so the group is
 * the family built on the same root — a different relation entirely, and
 * a more useful one, since seeing a family together is how the root system
 * stops being a rumour.
 *
 * Where the pack also names a property to be quizzed, a word sharing that
 * value too is not worth showing: it would be the same word to the ear,
 * which is the case Huế cares about. Where it names none — Arabic — every
 * other member of the family qualifies. That second clause is the whole
 * change: this returned nothing at all for Arabic before, because it asked
 * for a quizzable property that Arabic has no reason to declare.
 */
function relatedWords(items: Item[], lang: Lang, text: string) {
  const group = groupAttrOf(lang);
  const apart = quizAttrOf(lang);
  if (!group || !text) return [];
  const key = derivedValue(group, text);
  if (!key) return [];
  const mine = apart ? derivedValue(apart, text) : null;
  const out: { text: string, en: string, id: string }[] = [];
  const seen = new Set();
  for (const it of items) {
    for (const { unit } of unitsOf(it)) {
      const other = unit.ar;
      if (!other || other === text) continue;
      if (derivedValue(group, other) !== key) continue;
      if (apart && derivedValue(apart, other) === mine) continue;
      if (seen.has(other)) continue;
      seen.add(other);
      out.push({ text: other, en: unit.en || it.en || "", id: it.id });
    }
  }
  return out.slice(0, 6);
}

/* Making your own cards is switched off while courses settle: material
   comes from a teacher. Everything it needs is still here, so turning it
   back on is a one-line change.

   The screens and helpers only that feature reaches — the card editor, the
   bulk-add sheet with its CSV and Markdown parser, the recorder, the zip
   backup — are reached through OWN below. With the flag off the bundler
   sees OWN as null and leaves all of it out of the build, which was about a
   quarter of this file being parsed on every launch for nothing. */
const OWN_CARDS = false;

const OWN = OWN_CARDS
  ? { ItemSheet, BulkAddSheet, parseLines, makeZip, readZip }
  : null;

/* ------------------------------------------------------------------
   Account

   The sign-in key from the courses server is the one secret: it signs you
   in, identifies you to a course, and — hashed — names the document your
   devices share. Earlier builds generated a second, local key here for the
   sync document, which meant two devices signed into the same account
   synced to two different places and never met. Any such key still found
   in stored data is used once, to delete the document it named.
   ------------------------------------------------------------------ */

const LEGACY_SYNC_KEYS = new Set<string>();


/* ------------------------------------------------------------------
   Answer matching
   ------------------------------------------------------------------ */

/* The words this one belongs with, worth seeing at the moment of getting it
   right or wrong. Worked out once when the answer is checked and handed in,
   not recomputed from every card on every render of the answered state.

   The heading comes from the language, because the relation does: a family
   sharing a root and a set of words told apart only by tone are not the
   same observation, and no sentence the app could assemble would be true of
   both. */
/*
 * The box under an answer holding everything that is not the answer.
 *
 * Where it turned up, how it is written, how it is pronounced, how it
 * sounds, what shares its root: five things that are each conditional, so
 * on one card the box holds four and on another none at all. An empty
 * bordered box is worse than no box, hence the count — and React.Children
 * drops the false branches for us, so the members can stay written as
 * plain conditionals at the call site.
 */
/* --- the verdict ---------------------------------------------------
   One line, and the same line every time for a miss: it names what
   happened and then hands over to the answer below it, so the two read
   as one sentence. Praise rotates so a long session does not say the
   same word twenty times — in order rather than at random, because
   random repeats, and being told "Correct!" three times running is what
   it was rotating to avoid.

   Counted off the session's own tally of right answers, which does not
   change until the question is left, so the phrase holds still while you
   read it — picking one per render would reshuffle it on every keystroke
   and every state change behind it. */
export const PRAISE = ["Correct!", "Good job!", "Nicely done!", "Great!"];
export const WRONG_VERDICT = "Incorrect. The correct answer is:";
/* A grid marks itself: the meaning each wrong word wanted is shown under
   it, so the verdict says only that there were some. */
export const GRID_VERDICT = "Not all of them — the right meanings are shown.";
/* Giving up is not getting it wrong: nothing was offered to be incorrect.
   The answer is simply handed over. */
export const SKIPPED_VERDICT = "The answer is:";
export function praiseFor(n: number) {
  return PRAISE[((n % PRAISE.length) + PRAISE.length) % PRAISE.length];
}

/* --- AlsoBox --------------------------------------------------------
   What is worth knowing beyond the answer, behind one tap. It opens
   closed: the answer is what you came back for, and five blocks of
   context under it is a page to scroll past rather than a thing to
   read. Anyone who wants them is one tap away, and the tap is the
   signal that they are actually being read.

   Renders nothing — not even the invitation — when there is nothing to
   put in it, so "Learn more" is never a promise the box cannot keep. */
function AlsoBox({ children, open, onToggle }: { children?: Node; open?: boolean; onToggle?: () => void }) {
  const shown = React.Children.toArray(children).filter(Boolean);
  if (!shown.length) return null;
  return (
    <>
      <button
        type="button"
        className="at-alsomore"
        data-el="also-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        Learn more
        <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
      </button>
      {open && (
        <div className="at-alsobox" data-el="also">
          {shown}
        </div>
      )}
    </>
  );
}

function RelatedWords({ pairs, settings }: { pairs: any[]; settings: Settings }) {
  if (!pairs || !pairs.length) return null;
  const lang = langOf(settings);
  const group = groupAttrOf(lang);
  const heading = (group && group.heading) || "Related words";
  return (
    <div className="at-pairs" data-el="related-words">
      <p className="at-answerlabel" data-el="related-words-label">
        {heading}
      </p>
      {pairs.map((p) => (
        <p key={p.text} className="at-hint" data-el="related-word">
          <span className="ar" style={{ fontWeight: 600 }}>
            {p.text}
          </span>
          {p.en ? ` — ${p.en}` : ""}
        </p>
      ))}
    </div>
  );
}


/* ------------------------------------------------------------------
   Import / export
   ------------------------------------------------------------------ */

/* Open, because the loops below add a name per grammatical field and per
   language, and a column heading is whatever the file happened to say. */
const FIELD_ALIASES: Record<string, string> = {
  ar: "ar", arabic: "ar", script: "ar",
  lat: "lat", latin: "lat", tr: "lat", translit: "lat", transliteration: "lat", roman: "lat",
  en: "en", eng: "en", english: "en", meaning: "en", translation: "en",
  tag: "tags", tags: "tags",
  note: "note", notes: "note",
  num: "number", plurality: "number",
  gen: "gender",
  reg: "register", addressee: "register",
  cl: "classifier", clf: "classifier",
};
/* Every grammatical field answers to its own name, without that having to be
   written here each time one is added. */
for (const f of grammarFields()) FIELD_ALIASES[f] = f;
/* And every language answers to what it calls its own columns — "Hebrew",
   "Pronunciation note" — so a table headed in the language's own terms is
   read as a table. Only "Arabic" was written in above, by hand. */
const aliasKey: (label: unknown) => string = (label) => String(label || "").toLowerCase().replace(/[^a-z]/g, "");
for (const L of Object.values(LANGUAGES)) {
  if (L.scriptLabel) FIELD_ALIASES[aliasKey(L.scriptLabel)] = "ar";
  if (L.translitLabel) FIELD_ALIASES[aliasKey(L.translitLabel)] = "lat";
}
const FIELD_ORDER = ["en", "ar", "lat", "tags", "note"].concat(grammarFields());

/* The importer's worked example, written in whichever language is being
   learnt: a markdown table with the language's own column names and two
   rows from its pack, and the same rows as a bare placeholder. It used to
   be an Arabic table for everyone. */
function sampleTable(L: Lang) {
  const rows = L.sample || [];
  const head = ["English", L.scriptLabel, L.translitLabel, "Decks"];
  const decks = ["class 12 june", "numbers"];
  const line: (cells: string[]) => string = (cells) => `| ${cells.join(" | ")} |`;
  return [
    line(head),
    line(head.map((h) => "-".repeat(h.length))),
    ...rows.map((r, i) => line([r.en, r.ar, r.lat || "", decks[i] || ""])),
  ].join("\n");
}
function samplePlaceholder(L: Lang) {
  return (L.sample || [])
    .map((r, i) => [r.en, r.ar, r.lat, i === 0 ? "class 12 june" : ""].filter(Boolean).join(" | "))
    .join("\n");
}
const MD_SEPARATOR = /^:?-+:?$/;
const ESC = "\u0000";

function splitRow(line: string) {
  return (line.includes("\t") ? line.split("\t") : line.split("|")).map((p) => p.trim());
}

function stripMd(cell: string) {
  return cell
    .split(ESC)
    .join("|")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function mdCells(line: string) {
  return line
    .replace(/\\\|/g, ESC)
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map(stripMd);
}

function isSeparatorLine(line?: string) {
  if (!line) return false;
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const cells = mdCells(t);
  return cells.length > 0 && cells.every((c) => MD_SEPARATOR.test(c));
}

function readHeader(cells: string[]): string[] | null {
  if (cells.length < 2) return null;
  const map = cells.map((c) => FIELD_ALIASES[c.toLowerCase().replace(/[^a-z]/g, "")]);
  return map.every(Boolean) ? map : null;
}

/**
 * A row read out of a pasted table: the fields every card has, plus
 * whichever grammatical fields the language declares, which is why the
 * type is open.
 */
type ParsedRow = Record<string, any> & {
  ar: string;
  lat: string;
  en: string;
  note: string;
  tags: string[];
};
/**
/**
 * `skipped` rides on the array because the importer wants both the rows
 * and the count of lines that held nothing, and the callers all read the
 * rows first.
 */
function parseLines(text: string, knownTags: string[] = []): ParsedRow[] & { skipped?: number } {
  const out: ParsedRow[] & { skipped?: number } = [];
  const known = new Set(knownTags.map((t) => t.toLowerCase()));
  const lines = String(text).split(/\r?\n/);
  const mdMode = lines.some((l) => l.trim().startsWith("|"));
  let order: string[] | null = null;
  let skipped = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line || line.startsWith("#")) continue;

    let cells: string[];
    if (mdMode) {
      if (!line.startsWith("|")) continue;
      if (isSeparatorLine(line)) continue;
      cells = mdCells(line);
      if (isSeparatorLine(lines[li + 1])) {
        const header = readHeader(cells);
        if (header) order = header;
        continue;
      }
    } else {
      cells = splitRow(line);
    }

    if (!order && !out.length) {
      const header = readHeader(cells);
      if (header) {
        order = header;
        continue;
      }
    }

    const row: Record<string, string> = { ar: "", lat: "", en: "", tags: "", note: "" };
    for (const f of grammarFields()) row[f] = "";
    const loose: { value: string, i: number }[] = [];

    cells.forEach((cell: string, i: number) => {
      const m = cell.match(/^([A-Za-z]+)\s*[:=]\s*([\s\S]*)$/);
      const key = m && FIELD_ALIASES[m[1].toLowerCase()];
      if (key) row[key] = m[2].trim();
      else loose.push({ value: cell, i });
    });

    if (loose.length) {
      const usesGaps = loose.some((c) => !c.value);
      if (order || usesGaps) {
        for (const { value, i } of loose) {
          const key = order ? order[i] : FIELD_ORDER[i];
          if (key && !row[key] && value) row[key] = value;
        }
        if (row.ar && !inScript(row.ar)) {
          const holder = ["en", "lat"].find((k) => row[k] && inScript(row[k]));
          if (holder) {
            const tmp = row.ar;
            row.ar = row[holder];
            row[holder] = tmp;
          }
        }
      } else {
        const values = loose.map((c) => c.value);
        const arIdx = values.findIndex((v) => inScript(v));
        if (arIdx !== -1 && !row.ar) row.ar = values.splice(arIdx, 1)[0] || "";
        if (values.length > 1 && known.size && !row.tags) {
          const parts = cleanTags(values[values.length - 1]);
          if (parts.length && parts.every((t) => known.has(t.toLowerCase()))) {
            row.tags = values.pop() || "";
          }
        }
        const slots = FIELD_ORDER.filter((k) => !row[k]);
        values.forEach((v, i) => {
          if (slots[i]) row[slots[i]] = v;
        });
      }
    }

    if (!row.ar && !row.lat && !row.en) {
      skipped += 1;
      continue;
    }
    out.push({
      ar: row.ar,
      lat: row.lat,
      en: row.en,
      note: row.note,
      tags: cleanTags(row.tags),
      ...Object.fromEntries(
        Object.values(GRAMMAR).map((d) => [d.field, normDimValue(d, row[d.field])])
      ),
      ...Object.fromEntries(
        grammarFields()
          .filter((f) => !Object.values(GRAMMAR).some((d) => d.field === f))
          .map((f) => [f, row[f] || ""])
      ),
    });
  }

  out.skipped = skipped;
  return out;
}

/* ------------------------------------------------------------------
   Storage
   ------------------------------------------------------------------ */

/* v2 used three skills; two of them map onto exercise types that still exist.
   Its "read" skill meant typing the transliteration, which is retired, so that
   progress is not carried forward — there is no exercise it would belong to,
   and liftStates writes these without checking TYPES, so leaving it here would
   recreate a state for a type nothing offers. */
const V2_MAP = { mean: "ar2en", write: "en2ar" };
const OLD_INTERVALS = [0, 1, 2, 4, 9, 21];

function liftState(s: Record<string, any> | null | undefined): ExerciseState {
  if (!s) return freshState();
  if (s.phase) return { ...freshState(), ...s };
  const box = s.box || 0;
  return {
    ...freshState(),
    phase: box === 0 ? "new" : "review",
    interval: OLD_INTERVALS[Math.min(box, 5)] || 0,
    due: s.due || 0,
    right: s.right || 0,
    wrong: s.wrong || 0,
    reps: (s.right || 0) + (s.wrong || 0),
  };
}

function liftStates(old: Record<string, any> = {}): Record<string, ExerciseState> {
  const s = freshStates();
  for (const [oldKey, newKey] of Object.entries(V2_MAP)) {
    /* `newKey in s` because s starts from the types that exist: without it a
       stale mapping would write back a state for a retired type, which then
       goes to storage and out over sync. */
    if (old[oldKey] && newKey in s) s[newKey] = liftState(old[oldKey]);
  }
  for (const t of TYPES) if (old[t]) s[t] = liftState(old[t]);
  return s;
}

/*
 * Grammar, from the form down onto the answers.
 *
 * The one-time migration. Gender and number used to sit on the form, one
 * set for the whole card, which was a label that described one accepted
 * answer and lied about any other that differed — see answers.ts. Read
 * here, at the door, so a document written before the change is the new
 * shape by the time anything else sees it; a document written since passes
 * through unchanged, because reading its own answers back is what
 * answersOf already does.
 *
 * The flat values stay on the form as well. Nothing is gained by stripping
 * them — the server still sends them, an export still has a column for
 * them, and a card that lost them on this device would sync that loss to
 * one still running the old build.
 */
function liftAnswers(form: Record<string, any>): Record<string, any> {
  const fields = answerFields();
  return {
    ...dimValues(form),
    ...packAnswers(answersOf(form, fields), fields),
  };
}

function liftItem(it: Record<string, any>) {
  return {
    ...it,
    tags: Array.isArray(it.tags) ? it.tags : [],
    locked: !!it.locked,
    flags: it.flags || [],
    recs: it.recs || [],
    ...liftAnswers(it),
    subs: (it.subs || []).map((sb: Record<string, any>) => ({
      ...sb,
      ...liftAnswers(sb),
      recs: sb.recs || [],
      s: liftStates(sb.s),
    })),
    /* A dialog's lines are lifted the same way, so a scene stored before
       an exercise existed comes back carrying a state for it. Left off
       entirely where there is no conversation, rather than storing an
       empty list on every word in the app. */
    ...(it.lines
      ? {
          lines: (it.lines || []).map((ln: Record<string, any>) => ({
            ...ln,
            who: Number(ln.who) || 0,
            uses: ln.uses || [],
            recs: ln.recs || [],
            s: liftStates(ln.s),
          })),
        }
      : null),
    s: liftStates(it.s),
  };
}

function merge(parsedIn: Record<string, any> | null | undefined) {
  /* A stored or imported document never carries an account: the sync
     secret belongs to this device's sign-in, not to the data. */
  const { account: _dropped, ...parsed } = parsedIn || {};
  const incoming = parsed.settings || {};
  const settings = { ...EMPTY.settings, ...incoming };
  if (incoming.tashkeel == null && incoming.ignoreTashkeel != null) {
    settings.tashkeel = incoming.ignoreTashkeel ? "either" : "required";
  }
  delete settings.ignoreTashkeel;
  delete settings.skills;
  return {
    ...EMPTY,
    ...parsed,
    settings: {
      ...settings,
      types: { ...EMPTY.settings.types, ...(incoming.types || {}) },
      kinds: { ...EMPTY.settings.kinds, ...(incoming.kinds || {}) },
    },
    items: (parsed.items || []).map(liftItem),
    tombstones: parsed.tombstones || {},
    settingsUpdated: parsed.settingsUpdated || 0,
  };
}

async function loadData() {
  if (!window.storage) return { ...EMPTY };
  for (const key of [KEY, "arabic-trainer-v2", "arabic-trainer-v1"]) {
    try {
      const res = await window.storage.get(key);
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        /* Only this device's own stored document can name a private sync
           key worth retiring — never a file someone imported. */
        if (parsed && parsed.account && parsed.account.key) {
          LEGACY_SYNC_KEYS.add(parsed.account.key);
        }
        return merge(parsed);
      }
    } catch (e) {
      /* try the next one */
    }
  }
  return { ...EMPTY };
}

/* Stored sparse: states that have never been answered are left out and
   put back on load. See compactItem in sync.ts for why. */
async function saveData(data: Doc) {
  if (!window.storage) return false;
  try {
    const slim = { ...data, items: (data.items || []).map(compactItem) };
    return !!(await window.storage.set(KEY, JSON.stringify(slim)));
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------
   Sounds

   Synthesised on the fly with the Web Audio API rather than shipped as
   files: a few hundred bytes of code instead of a folder of samples,
   identical on every device, and nothing extra to cache offline.

   The tone is meant to be small and warm — sine and triangle waves, quick
   decay, nothing above a whisper. The two that mark an answer run to about
   400ms: long enough to register as a verdict rather than a click, and still
   over before anyone has read the feedback under it. The incidental ones —
   tick, pop, record — stay very short, because they accompany an action
   rather than judging it.
   ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;
let lastSound = 0;

/*
 * How loud, as a multiplier on every note's peak.
 *
 * The notes were written quietly — peaks around 0.05, which is polite on a
 * desk and inaudible on a bus with the phone in a pocket. Soft is what they
 * were; loud is what they are now by default. Kept as a factor rather than
 * as a second set of numbers so the notes stay one description of the
 * sound and only its level changes.
 *
 * The ceiling is clipping, and the headroom is checked rather than
 * guessed: the smoke run adds up every note each sound schedules, at loud,
 * and fails if the sum reaches full scale. That is what lets this number
 * go up without someone having to do the arithmetic by hand.
 */
export const SOUND_LEVELS = { loud: 4.4, soft: 1, off: 0 };
let soundGain = SOUND_LEVELS.loud;

/*
 * What a stored setting means. It was a boolean, so `true` has to keep
 * working — and it maps to loud rather than soft because the whole reason
 * this became a choice is that on was too quiet.
 */
export function soundLevelOf(value: unknown) {
  if (value === false || value === "off") return "off";
  if (value === "soft") return "soft";
  return "loud";
}

export function setSounds(level: string | boolean) {
  soundGain = SOUND_LEVELS[soundLevelOf(level)];
}

function ctx() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  // Browsers start it suspended until you've interacted with the page.
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

/* One note: a shaped blip with an optional pitch slide. */
/**
 * @param shape  `to` glides the pitch there across the note's length.
 */
function note(c: AudioContext, { freq, at = 0, dur = 0.12, type = "sine", peak = 0.07, to }: {
  freq: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  peak?: number;
  to?: number;
}) {
  const level = peak * (soundGain || 0);
  /* exponentialRampToValueAtTime cannot reach zero, and the ramps below
     start and end at 0.0001 — so a peak at or under that is not quiet, it
     is a ramp that goes the wrong way. Silence is handled by not playing. */
  if (level <= 0.0002) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

  // Quick in, gentle out — a click rather than a beep.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* Exported so the smoke run can add up what each one schedules and fail if
   the total would clip. There is no OfflineAudioContext outside a browser,
   so what it renders them against is a stub that records the notes. */
export const SOUNDS: Record<string, (c: AudioContext) => void> = {
  /* Four notes up a major triad with the top one held, so it arrives, goes
     somewhere and lands rather than being over before it registers. Still
     pleased rather than triumphant: it plays after every right answer and
     has to bear hearing a hundred times a day. */
  correct: (c) => {
    note(c, { freq: 660, dur: 0.13, peak: 0.075 });
    note(c, { freq: 880, at: 0.11, dur: 0.14, peak: 0.072 });
    note(c, { freq: 1100, at: 0.23, dur: 0.16, peak: 0.068 });
    note(c, { freq: 1319, at: 0.36, dur: 0.34, peak: 0.062 });
  },
  /* Three steps down, the last one held under the others. Gentle by
     design — you will hear this one a lot, and it should read as "not
     that" rather than as a buzzer — but long enough now to be a verdict
     rather than a bump. */
  wrong: (c) => {
    note(c, { freq: 320, to: 240, dur: 0.2, type: "triangle", peak: 0.066 });
    note(c, { freq: 240, to: 180, at: 0.18, dur: 0.22, type: "triangle", peak: 0.062 });
    note(c, { freq: 180, to: 140, at: 0.38, dur: 0.3, type: "triangle", peak: 0.056 });
  },
  /* The page turning. Two notes rather than one, because a single 45ms
     blip at the top of the register was inaudible over anything at all —
     but still the shortest thing here, since it accompanies a movement
     rather than judging an answer. */
  tick: (c) => {
    note(c, { freq: 740, dur: 0.07, peak: 0.05 });
    note(c, { freq: 988, at: 0.06, dur: 0.11, peak: 0.045 });
  },
  // Four notes up a major triad, for the end of a session.
  complete: (c) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      note(c, { freq: f, at: i * 0.075, dur: 0.16, peak: 0.055 })
    );
  },
  record: (c) => {
    note(c, { freq: 520, to: 780, dur: 0.1, type: "triangle", peak: 0.05 });
  },
  stop: (c) => {
    note(c, { freq: 780, to: 520, dur: 0.1, type: "triangle", peak: 0.05 });
  },
  /* A muted double thud, for anything destructive and for giving up on a
     question. One short thud was easy to miss, and "I don't know" is a
     verdict on the card like any other — it deserves to be heard. */
  warn: (c) => {
    note(c, { freq: 260, to: 190, dur: 0.16, type: "triangle", peak: 0.07 });
    note(c, { freq: 190, to: 140, at: 0.15, dur: 0.26, type: "triangle", peak: 0.062 });
  },
  // A little bubble, for undo and other small reversals.
  pop: (c) => {
    note(c, { freq: 420, to: 900, dur: 0.07, peak: 0.05 });
  },
};

function sfx(kind: string) {
  if (!soundGain || !SOUNDS[kind]) return;
  // Rate limit, so a fast run of answers doesn't turn into a chirp storm.
  const t = Date.now();
  if (t - lastSound < 70) return;
  lastSound = t;
  try {
    const c = ctx();
    if (c) SOUNDS[kind](c);
  } catch (e) {
    /* no audio available — carry on silently */
  }
}

/* ------------------------------------------------------------------
   Clip store

   Recordings live in IndexedDB rather than alongside the rest of the
   data. Two reasons: the ordinary key-value store browsers give a site is
   capped around 5MB, which a few hundred clips would exhaust, and it can
   only hold text — so audio had to be base64, costing a third again in
   size. IndexedDB holds real binary and offers orders of magnitude more
   room.

   Where IndexedDB isn't available the old path still works, so nothing
   breaks; it just keeps the old ceiling.
   ------------------------------------------------------------------ */

const DB_NAME = "arabic-trainer";
const DB_STORE = "clips";
let dbPromise: Promise<IDBDatabase | null> | null = null;

/* How long a cold open may take. Safari's first open of a database on a
   fresh profile can run past a few seconds; giving up sooner used to send
   every clip for the whole session into the small text store instead. */
const DB_OPEN_MS = 8000;

function openClipDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      let settled = false;
      const settle = (db: IDBDatabase | null) => {
        if (settled) return;
        settled = true;
        resolve(db);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => settle(req.result);
      req.onerror = () => settle(null);
      /* Some private-browsing modes hang rather than fail. A timeout answers
         this call with "not now" but is not remembered: the next call tries
         again, and an open that finishes late is simply used from then on. */
      setTimeout(() => {
        if (settled) return;
        dbPromise = null;
        req.onsuccess = () => {
          dbPromise = Promise.resolve(req.result);
        };
        settle(null);
      }, DB_OPEN_MS);
    } catch (e) {
      resolve(null);
    }
  });
  return dbPromise;
}

/*
 * Every read and write goes through here, and every one of them answers
 * rather than throwing: a browser with the database walled off (private
 * browsing, a blocked origin) has to leave the app working, not stop it.
 */
function idbRun(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<any> {
  return openClipDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(DB_STORE, mode);
          const req = fn(tx.objectStore(DB_STORE));
          if (req) {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
          } else {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(undefined);
          }
        } catch (e) {
          resolve(undefined);
        }
      })
  );
}

/* --- conversions --- */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read-failed"));
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl: unknown) {
  const [head, body] = String(dataUrl).split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "audio/webm";
  const bin = atob(body || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* --- the API the rest of the app uses --- */

async function saveClipBlob(id: string, blob: Blob) {
  const ok = await idbRun("readwrite", (st) => st.put(blob, id));
  if (ok !== undefined) return true;
  // No IndexedDB: fall back to the text store.
  try {
    return !!(await window.storage.set(AUDIO_KEY(id), await blobToBase64(blob)));
  } catch (e) {
    return false;
  }
}

/* Clips the server has already said it doesn't hold, and when it said so.
   Remembered for a few minutes rather than the whole session: a recording
   published a moment ago can take up to a minute to reach every edge. */
const MISSING_CLIPS: Map<string, Millis> = new Map();
const MISSING_FOR_MS = 5 * 60000;

function knownMissing(id: string) {
  const at = MISSING_CLIPS.get(id);
  if (at === undefined) return false;
  if (now() - at > MISSING_FOR_MS) {
    MISSING_CLIPS.delete(id);
    return false;
  }
  return true;
}

/* What this device holds, and nothing else: no network, no side effects. */
async function localClipBlob(id: string): Promise<Blob | null> {
  const found = await idbRun("readonly", (st) => st.get(id));
  if (found) return found;
  try {
    const r = await window.storage.get(AUDIO_KEY(id));
    if (r && r.value) return base64ToBlob(r.value);
  } catch (e) {
    /* not here */
  }
  return null;
}

/* Is it here? Answered from the key alone, without reading the bytes. */
async function hasClipLocal(id: string) {
  const key = await idbRun("readonly", (st) => st.getKey(id));
  if (key !== undefined && key !== null) return true;
  try {
    const r = await window.storage.get(AUDIO_KEY(id));
    return !!(r && r.value);
  } catch (e) {
    return false;
  }
}

/* The recording as a data URL, for sending to the sync store. */
async function clipDataUrl(id: string) {
  const blob = await localClipBlob(id);
  return blob ? blobToBase64(blob) : null;
}

async function clipBlob(id: string) {
  const here = await localClipBlob(id);
  if (here) return here;

  /* A recording that came with a course lives on the server under its hash,
     not in this device's store — including on the device that recorded it,
     since the teaching space uploads rather than saving locally. Fetch it
     once and keep it, so it plays offline from then on. */
  if (knownMissing(id)) return null;
  try {
    const r = await API.getClip(id);
    if (r && r.data) {
      const blob = base64ToBlob(r.data);
      if (blob) {
        try {
          await idbRun("readwrite", (st) => st.put(blob, id));
        } catch (e) {
          /* cache is a courtesy; playing matters more */
        }
        return blob;
      }
    }
    MISSING_CLIPS.set(id, now());
  } catch (e) {
    /* Being unable to reach the server is not the same as the server not
       having it. Only the second is remembered; the first is worth retrying
       when the connection comes back. */
    if (!(typeof e === "object" && e && "message" in e && e.message === "offline")) MISSING_CLIPS.set(id, now());
  }
  return null;
}

/* A playable URL. Made for one player and handed back to it; the player
   revokes it when it is done. Keeping one alive per clip for the life of
   the app kept every recording in memory once it had been touched. */
async function clipUrl(id: string) {
  const blob = await clipBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

async function dropClip(id: string) {
  await idbRun("readwrite", (st) => st.delete(id));
  try {
    await window.storage.delete(AUDIO_KEY(id));
  } catch (e) {
    /* already gone */
  }
}

async function clipStats() {
  const all = (await idbRun("readonly", (st) => st.getAll())) || [];
  let bytes = 0;
  for (const b of all) if (b && b.size) bytes += b.size;
  return { count: all.length, bytes };
}

/* Fetch whatever recordings the given ids name that aren't here yet, a few
   at a time. Used to warm a session before it starts and, from Account
   settings, to take a whole course offline. */
async function warmClips(
  ids: Iterable<string>,
  { concurrency = 3, onProgress }: {
    concurrency?: number;
    onProgress?: (done: number, fetched: number) => void;
  } = {},
) {
  const queue = [...new Set(ids)];
  let done = 0;
  let fetched = 0;
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (id === undefined) return;
      try {
        if (!(await hasClipLocal(id))) {
          if (await clipBlob(id)) fetched += 1;
        }
      } catch (e) {
        /* leave it for next time */
      }
      done += 1;
      if (onProgress) onProgress(done, fetched);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return fetched;
}

/* Still useful wherever a data URL is what's in hand. */
function saveClip(id: string, dataUrl: string) {
  return saveClipBase64(id, dataUrl);
}

async function saveClipBase64(id: string, dataUrl: string) {
  return saveClipBlob(id, base64ToBlob(dataUrl));
}

/* One-off move of anything left in the old text store. */
async function migrateClips(ids: string[]) {
  const db = await openClipDb();
  if (!db) return 0;
  let moved = 0;
  for (const id of ids) {
    const already = await idbRun("readonly", (st) => st.get(id));
    if (already) continue;
    try {
      const r = await window.storage.get(AUDIO_KEY(id));
      if (r && r.value) {
        await idbRun("readwrite", (st) => st.put(base64ToBlob(r.value), id));
        await window.storage.delete(AUDIO_KEY(id));
        moved += 1;
      }
    } catch (e) {
      /* nothing stored under that key */
    }
  }
  return moved;
}

/* ------------------------------------------------------------------
   Zip

   Written by hand rather than pulled from a library: a few dozen lines,
   no dependency, and the files go in uncompressed because audio is
   already compressed. Reading handles both uncompressed and deflated
   entries, so a zip edited elsewhere still imports.
   ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
}
function u16(n: number) {
  return [n & 255, (n >>> 8) & 255];
}

interface ZipEntry {
  name: string;
  blob: Blob;
}

async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder();
  /* Blob parts rather than plain byte arrays: they are only ever handed
     to the Blob at the end, and a view onto a shared buffer is a part but
     not a Uint8Array<ArrayBuffer>. */
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = new Uint8Array(await e.blob.arrayBuffer());
    const crc = crc32(data);

    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);

    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0),
        ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ]),
      nameBytes
    );
    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + (c as Uint8Array).length, 0);
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

async function readZip(blob: Blob): Promise<ZipEntry[]> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buf.buffer);
  const dec = new TextDecoder();

  // Find the end-of-directory record, scanning back from the tail.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not-a-zip");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));

    const lnameLen = view.getUint16(local + 26, true);
    const lextraLen = view.getUint16(local + 28, true);
    const start = local + 30 + lnameLen + lextraLen;
    let data = buf.subarray(start, start + size);

    if (method === 8) {
      // Deflated, which our own exports never are — but be forgiving.
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([data]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    out.push({ name, blob: new Blob([data]) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ------------------------------------------------------------------
   Audio

   Clips are deliberately kept OUT of the synced document. The document
   carries only metadata — id, label, duration, size — and each clip is
   stored under its own key, locally and on the server. That way a sync
   moves a few kilobytes of JSON rather than re-uploading every recording
   you have ever made.
   ------------------------------------------------------------------ */

const AUDIO_KEY = (id: string) => `audio-${id}`;

const RECORD_MIMES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of RECORD_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch (e) {
      /* older browser */
    }
  }
  return "";
}

function canRecord() {
  return !!(
    typeof MediaRecorder !== "undefined" &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}


/* Live capture. Mono, and opus where the browser offers it. */
function startRecorder(onStop: (blob: Blob) => void, onError: (err: unknown) => void) {
  const mime = pickMime();
  let stopped = false;
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: Blob[] = [];

  navigator.mediaDevices
    .getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    .then((st) => {
      if (stopped) {
        st.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = st;
      rec = new MediaRecorder(st, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: AUDIO_BITRATE,
      });
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        st.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime || "audio/webm" });
        onStop(blob);
      };
      rec.start();
    })
    .catch((err) => onError(err));

  return {
    stop() {
      stopped = true;
      if (rec && rec.state !== "inactive") rec.stop();
      else if (stream) stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/*
 * Re-encode an uploaded file to opus by playing it into a MediaRecorder.
 * It runs in real time — a five-second clip takes five seconds — so it's
 * only worth doing for files big enough to matter. Falls back to the
 * original bytes wherever the browser can't oblige.
 */
async function compressAudio(file: File) {
  const raw = await file.arrayBuffer();
  if (raw.byteLength <= 60000 || !canRecord()) return { blob: file, mime: file.type };

  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(raw.slice(0));
    if (buf.duration > MAX_RECORD_MS / 1000) {
      ctx.close();
      throw new Error("too-long");
    }

    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);

    const mime = pickMime();
    const rec = new MediaRecorder(dest.stream, {
      ...(mime ? { mimeType: mime } : {}),
      audioBitsPerSecond: AUDIO_BITRATE,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);

    const done: Promise<void> = new Promise((res) => {
      rec.onstop = () => res();
    });
    rec.start();
    src.start();
    await new Promise((r) => setTimeout(r, buf.duration * 1000 + 250));
    rec.stop();
    await done;
    ctx.close();

    const out = new Blob(chunks, { type: mime || "audio/webm" });
    return out.size && out.size < raw.byteLength
      ? { blob: out, mime: mime || "audio/webm", dur: buf.duration }
      : { blob: file, mime: file.type, dur: buf.duration };
  } catch (e) {
    return { blob: file, mime: file.type };
  }
}

function formatBytes(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function newRecId() {
  return `r${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------
   Arabic keyboard
   ------------------------------------------------------------------ */

function useFinePointer() {
  const query = "(pointer: fine)";
  const [fine, setFine] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return fine;
}

/* Detects the phone's own keyboard via the visual viewport shrinking. */
interface SoftKeyboard {
  open: boolean;
  height: number | null;
  overlap: number;
}

function useSoftKeyboard() {
  const [kb, setKb] = useState<SoftKeyboard>({ open: false, height: null, overlap: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let last: SoftKeyboard = { open: false, height: null, overlap: 0 };
    const onChange = () => {
      const open = vv.height / window.innerHeight < 0.78;
      const height = Math.round(vv.height);
      /* How much of the page the keyboard is sitting on top of. The layout
         viewport does not shrink when the keyboard opens — on iOS nothing
         about `position: fixed; bottom: 0` notices it — so this is the
         distance a bar pinned to the bottom has to be lifted to stay in
         sight. Never negative: an overscroll can report more than the
         window is tall. */
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      /* The visual viewport reports a slightly different height on nearly
         every scroll event while the keyboard is up. Re-rendering the whole
         app for each of those is wasted; only a real change gets through. */
      /* The bar is positioned from `overlap`, so a change there has to get
         through even when the height has barely moved: on iOS the visual
         viewport scrolls under the keyboard and only the offset changes. */
      if (
        open === last.open &&
        last.height !== null &&
        Math.abs(height - last.height) < 20 &&
        overlap === last.overlap
      ) {
        return;
      }
      last = { open, height, overlap };
      setKb(last);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    onChange();
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);
  return kb;
}

/*
 * Whether the on-screen keys start out showing.
 *
 * Held by whoever renders the field rather than by the keyboard itself,
 * because the control that opens it now lives inside that field — see
 * KeysButton. A keyboard that owned the state could only put its own toggle
 * below itself, which is where it used to be.
 */
function useKeysOpen(mode: string = "auto") {
  const fine = useFinePointer();
  /* A fine pointer means a mouse, and a mouse has no keyboard of the
     language being learnt anywhere near it. A phone already has one. */
  const wanted = mode === "always" ? true : mode === "never" ? false : fine;
  const [open, setOpen] = useState(wanted);
  useEffect(() => {
    setOpen(wanted);
  }, [wanted]);
  /* Tupled, so the pair destructures the way useState's does rather than
     as the union of its two halves. */
  return ([open, setOpen] as const);
}

function Keyboard({ onKey, onBack, onClear, onHide, lang }: {
  onKey: (key: string) => void;
  onBack: () => void;
  onClear: () => void;
  onHide: () => void;
  lang: Lang;
}) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  const rows = L.keys.rows;
  const extras = L.keys.extras;
  const marksList = L.keys.marks;
  const [marks, setMarks] = useState(false);

  return (
    <div className="at-kb">
      {rows.map((row, i) => (
        <div className="at-kbrow fit" key={i}>
          {row.map((ch) => (
            <button key={ch} type="button" className="at-key" onClick={() => onKey(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="at-kbrow">
        {extras.map((ch) => (
          <button key={ch} type="button" className="at-key" onClick={() => onKey(ch)}>
            {ch}
          </button>
        ))}
        <button type="button" className="at-key util" onClick={() => onKey(" ")}>
          space
        </button>
        <button type="button" className="at-key util" onClick={onBack} aria-label="Backspace">
          ⌫
        </button>
        <button type="button" className="at-key util" onClick={() => setMarks((m) => !m)}>
          {marks ? "hide" : L.keys.marksLabel}
        </button>
        <button type="button" className="at-key util" onClick={onClear}>
          clear
        </button>
        <button type="button" className="at-key util" onClick={onHide}>
          hide
        </button>
      </div>
      {marks && (
        <div className="at-kbrow fit">
          {marksList.map((m, i) => (
            <button key={i} type="button" className="at-key mark" onClick={() => onKey(m)}>
              {"\u25CC" + m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function caretInsert(ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, value: string, setValue: (next: string) => void, ch: string) {
  const el = ref.current;
  if (!el) return setValue(value + ch);
  const s = el.selectionStart == null ? value.length : el.selectionStart;
  const e = el.selectionEnd == null ? s : el.selectionEnd;
  setValue(value.slice(0, s) + ch + value.slice(e));
  requestAnimationFrame(() => {
    el.focus();
    const p = s + ch.length;
    try {
      el.setSelectionRange(p, p);
    } catch (err) {
      /* Some inputs refuse to be given a caret position, and a field that
         will not take one is not a reason to lose the character that was
         just typed. The text is already set; only the caret is at stake. */
    }
  });
}

function caretBackspace(ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, value: string, setValue: (next: string) => void) {
  const el = ref.current;
  if (!el) return setValue(value.slice(0, -1));
  const s = el.selectionStart == null ? value.length : el.selectionStart;
  const e = el.selectionEnd == null ? s : el.selectionEnd;
  if (s === e && s === 0) return;
  setValue(s === e ? value.slice(0, s - 1) + value.slice(s) : value.slice(0, s) + value.slice(e));
  requestAnimationFrame(() => {
    el.focus();
    const p = s === e ? s - 1 : s;
    try {
      el.setSelectionRange(p, p);
    } catch (err) {
      /* Some inputs refuse to be given a caret position, and a field that
         will not take one is not a reason to lose the character that was
         just typed. The text is already set; only the caret is at stake. */
    }
  });
}


/* ------------------------------------------------------------------
   Small components
   ------------------------------------------------------------------ */

/* The target language's own script, however it is written. */
function Arabic({ text, kind, lang, name }: { text?: string; kind?: string; lang?: Lang; name?: string }) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  return (
    <p
      className={`at-arabic ${kind || "word"}`}
      data-el={name}
      lang={L.id}
      dir={L.direction}
      style={{ fontFamily: L.fontStack, direction: L.direction, ...scriptVars(L) }}
    >
      {text}
    </p>
  );
}

/* One shared empty array, so a card with no recordings hands the player
   the same value every render and does not restart it. */
const NO_RECS: any[] = [];

/*
 * Which speed a question leads with.
 *
 * Slow while a card is still being learnt — a first meeting, and the meeting
 * after a lapse, are exactly where hearing the parts of a word helps — and
 * the real thing from the point it is being reviewed, because recognising
 * it at speed is the skill being trained and a learner who is only ever
 * offered the slow one never practices it.
 *
 * Read off the card's listening progress rather than the question in front
 * of you, so the answer is the same wherever the player appears on the
 * screen. A type that has never been answered is not stored at all, so an
 * empty record means new, which leads slow.
 *
 * The lead is a default and nothing more: both recordings stay on screen
 * and either can be pressed.
 */
/**
 * @param type  The exercise being asked, when it is a listening one.
 */
export function leadSpeed(unit: Form, type?: string): "regular" | "slow" {
  const states = statesOf(unit);
  const asked = type && isListening(type) ? [type] : Object.keys(states).filter(isListening);
  if (!asked.length) return "slow";
  const grown = asked.every((t) => {
    const m = states[t] ? maturity(states[t]) : "new";
    return m === "young" || m === "mature";
  });
  return grown ? "regular" : "slow";
}

function AudioPrompt({ recs, autoPlay, lead = "regular" }: {
  recs?: any[];
  autoPlay?: boolean;
  lead?: "regular" | "slow";
}) {
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState("idle");
  const audioRef: React.MutableRefObject<HTMLAudioElement | null> = useRef(null);
  const urlRef = useRef("");
  const list = recs || NO_RECS;
  /* Which recordings this is showing, as one string, so the reset below
     fires when any of them changes and not only the first. */
  const signature = list.map((r) => r.id).join("|");

  /*
   * At most one of each speed, and the ordinary one first.
   *
   * A card may hold several takes at either speed — a teacher recording
   * twice to get it right leaves both — and a question is not the place to
   * choose between them: what a learner wants here is this word, and this
   * word said slowly, not a numbered rank of the takes that exist. The rest
   * are still on the card, and the teacher's screen still lists them all.
   */
  const iReg = list.findIndex((r) => r.speed !== "slow");
  const iSlow = list.findIndex((r) => r.speed === "slow");
  const takes: { i: number, slow: boolean }[] = [];
  if (iReg >= 0) takes.push({ i: iReg, slow: false });
  if (iSlow >= 0) takes.push({ i: iSlow, slow: true });
  /* A card with nothing but slow recordings would otherwise show none. */
  if (!takes.length && list.length) takes.push({ i: 0, slow: false });
  /* The one the card's progress asks for, if the card has it: a lead that
     is not there is not a lead, and the other one is then the whole
     offering rather than a quiet second choice. */
  const leadSlow = lead === "slow" && iSlow >= 0;
  /* The one being led with goes first. The pair is built ordinary-then-slow
     because that is the order they are recorded in; what is read left to
     right is which of them this question is about. */
  if (leadSlow) takes.reverse();
  const opens = takes.length ? takes[0].i : 0;

  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
  };

  /* Stop where it is. The button has said Pause since the icons went in and
     did not: pressing it called play again, which loaded the clip afresh
     and started it over — the one thing "pause" cannot mean. */
  const pause = () => {
    if (audioRef.current) audioRef.current.pause();
    setState("idle");
  };

  const play = useCallback(
    async (i: number) => {
      const rec = list[i];
      if (!rec) return;
      setState("loading");
      const url = await clipUrl(rec.id);
      if (!url) {
        setState("missing");
        return;
      }
      if (!audioRef.current) audioRef.current = new Audio();
      const el = audioRef.current;
      releaseUrl();
      urlRef.current = url;
      el.src = url;
      el.onended = () => setState("idle");
      /* Paused by anything else — the other button taking the element, a
         headset, the phone's own controls — reads the same as pausing here.
         Only ever a step down from playing, so it cannot undo the state a
         moment before the clip starts. */
      el.onpause = () => setState((v) => (v === "playing" ? "idle" : v));
      /* A clip that cannot be decoded used to leave the button on "playing"
         for good; now it reads as missing, which is what it is. */
      el.onerror = () => setState("missing");
      try {
        await el.play();
        setState("playing");
      } catch (e) {
        // Browsers block autoplay until you've interacted with the page.
        setState("idle");
      }
    },
  /* The signature is the identity of the list, and the reason it
     exists: `list` is rebuilt on every render, so depending on it
     would rebuild the player between every keystroke. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  useEffect(() => {
    setIdx(opens);
    setState("idle");
    /* The ordinary speed is what plays by itself: the slow one is a thing
       to reach for, not the question as it is asked. */
    if (autoPlay) play(opens);
    return () => {
      if (audioRef.current) audioRef.current.pause();
      releaseUrl();
    };
  /* Same again: a new clip list with the same contents must not
     restart playback. autoPlay and play are read on purpose from the
     render that changed the signature. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!list.length) return <Notice kind="warn">No recording for this form.</Notice>;

  return (
    <div className={`at-playrow${takes.length > 1 ? " twin" : ""}`}>
      {takes.map(({ i, slow }) => {
        const mine = idx === i;
        return (
          <button
            key={list[i].id}
            className={`at-playbig${takes.length > 1 ? " twin" : ""}${
              takes.length > 1 && slow !== leadSlow ? " quiet" : ""
            }`}
            onClick={() => {
              /* Pressing the one that is playing stops it; pressing the
                 other switches to it. */
              if (mine && state === "playing") {
                pause();
                return;
              }
              setIdx(i);
              play(i);
            }}
          >
            {/* The icon is the target on a phone, so it is sized like one
                rather than like a glyph sitting in the label's line — and
                it is what tells the two apart at a glance, the label being
                the thing you read second. */}
            <span className="dot">
              <Icon
                name={mine && state === "playing" ? "pause" : slow ? "slow" : "play"}
                /* Smaller on the one taking the narrower third of the row,
                   so what it holds is in proportion to the room it has. */
                size={takes.length > 1 && slow !== leadSlow ? 26 : 36}
              />
            </span>
            {mine && state === "loading"
              ? "Loading"
              : mine && state === "missing"
              ? "Not on this device"
              : slow
              ? "Slow"
              : takes.length > 1
              ? "Regular"
              : "Play"}
          </button>
        );
      })}
    </div>
  );
}

function Field({ value, field, kind, lang, name }: {
  value?: string;
  field?: string;
  kind?: string;
  lang?: Lang;
  name?: string;
}) {
  if (!value) return null;
  if (field === "ar")
    return <Arabic text={value} kind={kind} lang={lang || activeLang()} name={name} />;
  if (field === "lat")
    return (
      <p className="at-latin" data-el={name}>
        {value}
      </p>
    );
  return (
    <p className="at-en" data-el={name}>
      {value}
    </p>
  );
}

/* ------------------------------------------------------------------
   A conversation on screen

   One component draws every dialog question, because they are all the
   same picture with one thing different: the scene so far, with the line
   being asked about either blanked out, waiting for an answer, or shown
   with the rest. Drawing them separately is how the read-through and the
   answer screen would come to disagree about what a scene looks like.
   ------------------------------------------------------------------ */

/* Which side of the page a turn belongs on, as the class that puts it
   there. Empty for a scene of three or four, which stays a list — see
   sidesOf. Written once here because every picture of a scene in this file
   needs the same answer, and two of them would be two layouts. */
const sideClass = (card: any, line: any) => {
  const side = sideOf(card, line && line.who);
  return side === null ? "" : ` side${side}`;
};

/**
 * @param props  `meanings` and `said` are the two things a line has besides its
 *   words — what it means and how it sounds. Separate, because reading a
 *   scene through takes them one at a time and on request.
 */
function Scene({ card, lines, lang, blankId = null, meanings = false, said = false, numbers }: {
  card: any;
  lines: any[];
  lang: Lang;
  blankId?: string | null;
  meanings?: boolean;
  said?: boolean;
  numbers?: Record<string, number>;
}) {
  return (
    /* Named here rather than through a prop: the reference in Admin is
       built by reading these names out of this file, and a name that
       arrives as a default argument is a name nobody can find. */
    <div className={`at-scene${isTwoSided(card) ? " sided" : ""}`} data-el="scene">
      {lines.map((line) => {
        const n = numbers && numbers[line.id];
        return (
          <div
            className={`at-sceneline${sideClass(card, line)}${line.id === blankId ? " asked" : ""}`}
            key={line.id}
            data-el="scene-line"
          >
            <span className={`at-speaker s${(line.who || 0) % 4}`} data-el="scene-speaker">
              {n ? `${n}. ` : ""}
              {speakerName(card, line.who || 0)}
            </span>
            <div className="at-scenesaid">
              {line.id === blankId ? (
                <p className="at-sceneblank" data-el="scene-turn">
                  <span className="at-blankrule" />
                </p>
              ) : (
                <Arabic text={line.ar} kind="phrase" lang={lang} name="scene-line-text" />
              )}
              {said && line.lat && (
                <p className="at-scenemeaning" data-el="scene-line-said">
                  {line.lat}
                </p>
              )}
              {meanings && line.en && (
                <p className="at-scenemeaning" data-el="scene-line-meaning">
                  {line.en}
                </p>
              )}
              {(line.recs || []).length > 0 && (
                <AudioPrompt recs={line.recs} lead={leadSpeed(line)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/*
 * Putting a scene back in order.
 *
 * Tapped rather than dragged: a drag is the one gesture a thumb on a
 * phone cannot do accurately, and it is invisible to anyone using a
 * keyboard. Each tap takes the next line, the number beside it says where
 * it went, and "Start again" is the way back — which is also every
 * correction anyone wants to make, since an ordering is wrong from the
 * first line that is out of place.
 */
function SceneOrder({ card, lang, value, onChange, disabled }: {
  card: any;
  lang: Lang;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const picked = value ? value.split(ORDER_SEP) : [];
  const scrambled = useMemo(() => scrambledLines(card), [card]);
  const place = (id: string) => picked.indexOf(id) + 1;
  return (
    <div className="at-order" data-el="answer-order">
      {scrambled.map((line) => {
        const at = place(line.id);
        return (
          /* The button keeps the whole width — the tap is the answer, so
             it stays as big as the thing being answered — and the words
             inside it take their speaker's side. Whose turn it is is half
             of what puts a scrambled scene back together, and here it is
             read at a glance rather than off a name. */
          <button
            type="button"
            key={line.id}
            className={`at-orderline${sideClass(card, line)}${at ? " on" : ""}`}
            disabled={disabled || !!at}
            aria-label={`${speakerName(card, line.who || 0)}: ${line.ar}`}
            onClick={() => onChange(picked.concat([line.id]).join(ORDER_SEP))}
          >
            <span className="at-ordernum">{at || "·"}</span>
            <span className="at-orderwords">
              <span className={`at-speaker s${(line.who || 0) % 4}`}>
                {speakerName(card, line.who || 0)}
              </span>
              <Arabic text={line.ar} kind="phrase" lang={lang} />
            </span>
          </button>
        );
      })}
      {picked.length > 0 && !disabled && (
        <Button variant="ghost" size="sm" onClick={() => onChange("")}>
          Start again
        </Button>
      )}
    </div>
  );
}

/* Playing a whole part is retired — every turn of a scene typed out at
   once was the longest answer in the app and the least forgiving, and one
   missed mark in the third line made the whole conversation wrong. The
   screen that drew it is gone with it; the spec stays in the table, as a
   retired spec does, so a stored reference still resolves to a label. */

/*
 * A few answers to choose between, one under the other rather than side by
 * side: a line of script is not a word, and four of them across a phone is
 * four columns of one letter each.
 *
 * The same control for both questions that offer a choice of words — which
 * reply comes next in a conversation, and which word is missing from a
 * phrase — because they are the same question about different material,
 * and two of these would have drifted.
 */
/*
 * The matching grid.
 *
 * Words down one side, meanings down the other, tapped together in pairs.
 * The only question in the app that puts words beside each other — every
 * other one holds up a single word — and the only one a card can be asked
 * on the day it is written, with no recording and nothing linked to it.
 *
 * Paired, then checked, rather than judged a pair at a time. Marking each
 * pair as it is made turns the grid into a game of elimination: a wrong
 * guess is worth as much as a right one because it rules a meaning out,
 * and the last word costs nothing. Everything is committed at once and
 * marked at once, the way every other answer in this app is.
 *
 * A pair shows as a number on both halves rather than a line drawn between
 * them: a line between two columns is a thing to draw, to redraw on every
 * resize, and to get wrong in a language that reads right to left.
 */
function MatchGrid({ words, meanings, lang, askedId, onChange, onPairs, checked }: {
  words: Form[];
  meanings: string[];
  lang: Lang;
  askedId: string;
  onChange: (v: string) => void;
  /** The whole pairing, once complete — every word is marked on it. */
  onPairs?: (pairs: Record<string, string>) => void;
  checked?: boolean;
}) {
  /* Which meaning is against which word. Keyed by word id, so a meaning can
     be moved and the grid never holds the same one twice. */
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);

  const takenBy = (meaning: string) =>
    words.find((w) => pairs[w.id] === meaning);
  const done = words.every((w) => pairs[w.id]);

  /* Nothing is reported until every word has a meaning: the question is the
     whole grid, and half of one is not an answer to it. What goes up is the
     meaning put against the first word, which is what the answer screen
     talks about, and the whole pairing beside it, which is what every word
     in the grid is marked on. */
  useEffect(() => {
    onChange(done ? pairs[askedId] || "" : "");
    if (onPairs) onPairs(done ? pairs : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, done, askedId]);

  const tapWord = (id: string) => {
    if (checked) return;
    if (pairs[id]) {
      setPairs((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      setHeld(id);
      return;
    }
    setHeld((h) => (h === id ? null : id));
  };

  const tapMeaning = (meaning: string) => {
    if (checked) return;
    const owner = takenBy(meaning);
    /* Tapping a meaning already spoken for frees it, which is the only way
       back from a pairing made by mistake that does not need a third
       gesture to undo. */
    if (owner) {
      setPairs((p) => {
        const next = { ...p };
        delete next[owner.id];
        return next;
      });
      return;
    }
    if (!held) return;
    setPairs((p) => ({ ...p, [held]: meaning }));
    setHeld(null);
  };

  const numberOf = (id: string) => words.filter((w) => pairs[w.id]).findIndex((w) => w.id === id) + 1;

  return (
    <div className="at-match" data-el="answer-match">
      <div className="at-matchcol">
        {words.map((w) => {
          const mine = pairs[w.id];
          const right = checked && mine === w.en;
          return (
            <button
              type="button"
              key={w.id}
              data-el="match-word"
              className={`at-matchtile${held === w.id ? " on" : ""}${mine ? " paired" : ""}${
                checked ? (right ? " right" : " wrong") : ""
              }`}
              aria-pressed={held === w.id}
              onClick={() => tapWord(w.id)}
            >
              {mine ? <span className="at-matchnum">{numberOf(w.id)}</span> : null}
              <span className="at-matchword">
                <Arabic text={w.ar} kind="word" lang={lang} />
                {/* What it should have been, under a word paired wrong: the
                    verdict below speaks of the first word only, and a grid
                    of five has four others to be told about. */}
                {checked && !right ? <span className="at-matchfix">{w.en}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="at-matchcol">
        {meanings.map((m) => {
          const owner = takenBy(m);
          const right = checked && owner && owner.en === m;
          return (
            <button
              type="button"
              key={m}
              data-el="match-meaning"
              className={`at-matchtile en${owner ? " paired" : ""}${
                checked && owner ? (right ? " right" : " wrong") : ""
              }`}
              onClick={() => tapMeaning(m)}
            >
              {owner ? <span className="at-matchnum">{numberOf(owner.id)}</span> : null}
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextChoices({ options, lang, value, onChange, disabled, kind = "phrase" }: {
  options: any[];
  lang: Lang;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  kind?: string;
}) {
  return (
    <div className="at-replies" data-el="answer-choices">
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          className={`at-reply${value === option.ar ? " on" : ""}${kind === "word" ? " word" : ""}`}
          aria-pressed={value === option.ar}
          disabled={disabled}
          onClick={() => onChange(option.ar)}
        >
          <Arabic text={option.ar} kind={kind} lang={lang} />
        </button>
      ))}
    </div>
  );
}

/*
 * Why there are no cards, in one sentence, in the one place all three
 * screens that have to say it read from.
 *
 * Being in a course with no cards is not the same as being in no course,
 * and telling someone who has already joined to join looks like a bug.
 * The Cards tab knew that; Home and Progress each wrote their own
 * sentence and both told an enrolled student to join a course, Home with
 * a button to do it with. Three screens, three sentences, one of them
 * right — which is the argument for there being one sentence.
 *
 * It does not say *why* the course is empty. Three things produce it — no
 * decks attached, decks with nothing in them, cards that have not reached
 * this device yet — and the material payload carries cards and nothing
 * else, so any reason given here would be a guess wrong two times in
 * three.
 */
export function noCardsYet(courseCount: number) {
  if (!courseCount) return "Join a course and the decks your teacher shares will appear here.";
  const them = courseCount === 1 ? "it" : "them";
  return `You're in ${plural(courseCount, "course")}, but there are no cards in ${them} yet.`;
}

/*
 * After an answer there is nothing to grade by hand: the check decides,
 * and the interval follows from that. All that's left is a quiet way to
 * say the check got it wrong, or that something about the item is off.
 */
function AfterAnswer({ ok, overridden, onOverride, onFlag, flagged, onContinue }: {
  ok?: boolean;
  overridden?: boolean;
  onOverride: () => void;
  onFlag: (kind: FlagKind, note?: string) => void;
  flagged?: boolean;
  onContinue: () => void;
}) {
  const [open, setOpen] = useState(false);
  /* Which of the three is being reported, and the words for the one that
     asks for them. Picking no longer sends: the two buttons that act on
     this are on screen from the moment the menu opens, so what a press on
     an option does is choose, and Send is what sends. */
  const [picked, setPicked] = useState<FlagKind | null>(null);
  const [note, setNote] = useState("");

  function close() {
    setOpen(false);
    setPicked(null);
    setNote("");
  }

  const chosen = FLAG_KINDS.find((k) => k.key === picked);
  /* "Something else" covers whatever the other two don't, so on its own it
     says nothing an administrator could act on: it needs the words. */
  const ready = !!chosen && (!chosen.asks || !!note.trim());

  function send() {
    if (!chosen || !ready) return;
    if (chosen.fixes && !ok && !overridden) onOverride();
    onFlag(chosen.key, chosen.asks ? note.trim() : "");
    close();
  }

  return (
    <div className="at-after">
      {/* The way on sits where the way on always sits: the same bar pinned
          to the foot of the screen that carried the hint, the nudge and
          the check a moment ago. Reading an answer scrolls, and a Continue
          in the flow lands wherever the answer happens to end — sometimes
          off the bottom of a long one.

          Flagging sits with it, one step above the bar: it used to trail
          below the answer, so on anything long you had to scroll to reach
          the one button that says "this question is wrong" — which is the
          moment you least want to go looking. Above the bar rather than
          in it, because it is not the way on. */}
      <StickyFoot
        above={
          <div className="at-flagwrap">
            <button
              className={`at-flagbtn${flagged ? " on" : ""}`}
              data-el="flag-button"
              aria-expanded={open}
              onClick={() => (open ? close() : setOpen(true))}
            >
              <Icon name="flag" size={16} />
              {flagged ? "Flagged" : "Flag a problem"}
            </button>

            {/* Everything at once: what this is, the three things it can
                be, the box for the third, and the way out and the way to
                send. It covers the foot rather than floating above it —
                nothing is behind it to press by accident, and the heading
                says what the button it is standing on top of said. */}
            {open && (
              <div className="at-flagmenu" data-el="flag-menu">
                <p className="at-flagmenu-label" data-el="flag-menu-label">
                  Flag a problem
                </p>
                {/* Why it is worth the half minute. Reporting a bad question
                    is a favour done for the next person to meet it, and
                    nothing on the screen said so. */}
                <p className="at-flagmenu-lede" data-el="flag-menu-lede">
                  Any issue or feedback you report helps us improve the app.
                </p>
                {FLAG_KINDS.map((k) => (
                  <React.Fragment key={k.key}>
                    <button
                      className={`at-flagopt${k.asks ? " asks" : ""}${picked === k.key ? " on" : ""}`}
                      aria-pressed={picked === k.key}
                      onClick={() => setPicked(k.key)}
                    >
                      <span className="at-flagopt-title">{k.title}</span>
                      <span className="at-flagopt-what">{k.what}</span>
                      {/* Said only where it is true: on a right answer, or
                          one already overturned, there is nothing to count. */}
                      {k.fixes && !ok && !overridden && (
                        <span className="at-flagopt-does">Counts it correct</span>
                      )}
                    </button>
                    {/* Not a box under the option but the rest of it: joined
                        to the card above with no seam, and lit with it when
                        it is the one chosen. Typing in it is a way of
                        picking that option, because that is plainly what it
                        means. */}
                    {k.asks && (
                      <div className="at-flagnote" data-el="flag-note">
                        <textarea
                          id="flag-note-input"
                          data-el="flag-note-input"
                          className="at-input at-flagtext"
                          rows={2}
                          maxLength={FLAG_NOTE_MAX}
                          placeholder="The recording plays the wrong word…"
                          value={note}
                          onFocus={() => setPicked(k.key)}
                          onChange={(e) => {
                            setNote(e.target.value);
                            setPicked(k.key);
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
                <div className="at-row at-flagnoterow">
                  <Button size="sm" onClick={close}>
                    Back
                  </Button>
                  <Button size="sm" variant="primary" disabled={!ready} onClick={send}>
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
      >
        <Button variant="primary" data-el="continue-button" onClick={onContinue}>
          Continue
        </Button>
      </StickyFoot>
    </div>
  );
}


/* ==================================================================
   Main
   ================================================================== */

/* Whether this person teaches anything, kept across launches so the space
   selector is right the moment the app opens rather than a request later. */
const TEACHES_KEY = "arabic-trainer-teaches";
function loadTeaches() {
  try {
    return localStorage.getItem(TEACHES_KEY) === "1";
  } catch (e) {
    return false;
  }
}
function saveTeaches(yes: boolean) {
  try {
    localStorage.setItem(TEACHES_KEY, yes ? "1" : "0");
  } catch (e) {
    /* private browsing; the next launch just asks again */
  }
}

/* When listening exercises stop being asked for, as a timestamp.

   Kept on the device rather than in the synced settings, for two reasons. It
   describes where someone is, not how they learn, so silencing a phone on a
   bus should not silence the tablet at home. And settings sync whole and
   last-writer-wins: a write here would stamp settingsUpdated and hand this
   device's theme, keyboard and exercise choices to every other one. */
const LISTEN_OFF_KEY = "arabic-trainer-listen-off";
function loadListenOff() {
  try {
    return Number(localStorage.getItem(LISTEN_OFF_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}
function saveListenOff(until: Millis) {
  try {
    localStorage.setItem(LISTEN_OFF_KEY, String(until || 0));
  } catch (e) {
    /* private browsing; it lasts as long as the app is open */
  }
}

export default function ArabicTrainer() {
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [tab, setTab] = useState("home");

  /* The deck filter. Nothing sets it any more — the control that used
     to toggle it was removed, and this was left reading as though it
     still worked — so it is always empty and every read below takes
     the unfiltered path. */
  const [deck] = useState<any[]>([]);
  const [session, setSession] = useState<any | null>(null); // { exercises, practice, items }
  /* A newly deployed build takes the page over by itself — see updates.ts.
     Mid-question is the one moment where that would land on top of
     something, so a session in flight holds it until the session ends or
     the app is put away. */
  useEffect(() => {
    holdUpdates(!!session);
    return () => holdUpdates(false);
  }, [session]);
  /* Null until the person has set up or signed in; the app shows the
     welcome screens until then. */
  const [account, setAccount] = useState(() => API.loadAccount());

  /*
   * Who the account is, rather than which object holds it. A re-render can
   * hand back a fresh object for the same person, and every hook below
   * wants to re-run when the person changes and not when the reference
   * does. Named here so the dependency arrays carry something a reader —
   * and the linter — can check, instead of an expression repeated at six
   * call sites.
   */
  const accountKey = account && account.key;
  const accountHandle = account && account.handle;
  /* Like the handle: a value rather than the object, so a re-fetch that
     changes nothing about the person does not rebuild everything that
     depends on it. */
  const accountAdmin = !!(account && account.admin);
  /* A teacher opens into teaching; everyone else into learning. */
  const [space, setSpace] = useState(() => (loadTeaches() ? "teach" : "learn"));
  const [screen, setScreen] = useState<string | null>(null); // null | "account" | "prefs"
  /* Remembered, because it decides whether the Teaching option exists at all.
     Deriving it only from a fresh network call meant a slow or failed request
     took the space selector away, with no way back but signing out. */
  const [teaches, setTeaches] = useState(() => loadTeaches());
  /* The learner's tabs scroll the page itself rather than a panel of their
     own, so this is the one that has to be put back. Space and tab
     together: moving from Teaching to Learning is arriving somewhere too.
     Not keyed on `screen` — a screen covers the page and closing one
     should give it back as it was left. */
  useScrollTop(`${space}:${tab}`);
  /* Read from the device rather than started at zero, so closing the app on
     the bus and opening it again does not start playing audio. */
  const [listenOff, setListenOff] = useState(() => loadListenOff());
  /* Pushed into the module flag here and not further down beside setSounds:
     the memos that decide what is drillable run below this line and go
     through enabledTypes, so the flag has to be true before they do. */
  setListenOffUntil(listenOff);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  /* An empty list means two different things until the first pull comes
     back: "not in any course" and "not asked yet". They look the same and
     read very differently to someone who has joined one. */
  const [coursesKnown, setCoursesKnown] = useState(false);
  /* A deck the person asked to practice from the Courses tab, handed to the
     cards tab once it is on screen. */
  const [deckWanted, setDeckWanted] = useState<string | null>(null);
  const [courseDecks, setCourseDecks] = useState<Deck[]>([]);
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState("");

  /* Teaching is a role on a course, so it has to be asked about — and the
     material request answers it, so it is no longer asked twice. */
  const [building, setBuilding] = useState(false);
  const [showingSaved, setShowingSaved] = useState(false);
  /* Which language the session on screen is drawn from: a language id, ""
     for all of them at once, or null for never asked — which is what keeps
     the picker from opening with an answer already marked. It stays on the
     last answer so "Keep going" means more of the same. */
  const [sessionLang, setSessionLang] = useState<LangId | "" | null>(null);
  /* And whether the question is being put. */
  const [picking, setPicking] = useState(false);
  /* The version of course material this device last received. Per device
     and per launch, so the first check after opening is always a full one. */
  const materialVersion = useRef("");
  const refreshing = useRef(false);

  /* Confirm who we are on each start, so a reissued key is noticed and a
     new role shows up without anyone signing in again. */
  useEffect(() => {
    if (!account) return;
    API.setKey(account.key);
    API.whoAmI(account.key)
      .then((r) => {
        const merged = { ...r.user, key: account.key };
        API.saveAccount(merged);
        setAccount(merged);
      })
      .catch(() => {
        /* offline, or the key was replaced — keep working locally */
      });
  /* The key, not the account object: a re-render hands back a new
     object for the same person, and re-checking who they are on
     every render would put the app in a request loop. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);
  /* No value, only a setter: the interval below calls it twice a second
     purely to re-render, so the time left on a timed session counts
     down. Nothing reads the number itself. */
  const [, setNow_] = useState(0);
  const [qi, setQi] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState<any | null>(null);
  const [pairs, setPairs] = useState<any[]>([]); // minimal pairs for the answered card
  /* The grid as it was paired: each word's id against the meaning put to
     it. Every word in a grid is marked on this, not only the first. */
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [flaggedNow, setFlaggedNow] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  /* What the reader has asked to see of a scene they are reading through.
     Two, because they are two different admissions — needing to hear it
     and needing to be told what it means — and a reader often wants one
     without the other. Cleared with everything else between questions. */
  const [showSaid, setShowSaid] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  /* Closed for every new question. Opening it for one card is not a
     standing request to see it for the next twenty. */
  const [alsoOpen, setAlsoOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tally, setTally] = useState({ ok: 0, no: 0 });

  const timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  const inputRef: React.MutableRefObject<HTMLInputElement | null> = useRef(null);
  const undoTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  const [lastDeleted, setLastDeleted] = useState<Item[] | null>(null);
  /* Every short-lived message the app says, here and in the teaching and
     admin screens below, which reach it through SnackbarProvider. */
  const snack = useSnackbarState();
  const kb = useSoftKeyboard();

  /* ---- sync ---- */
  const [syncCfg, setSyncCfg] = useState(() => ({ token: "", lastSync: 0 }));
  const [syncState, setSyncState] = useState("idle"); // idle|syncing|ok|error|off
  /* True only while a deliberate Sync now is fetching the spaces. The
     background check every forty-five seconds sets nothing here, so the dot
     stays still for it. */
  const [spacesBusy, setSpacesBusy] = useState(false);
  /* Recorded but not shown anywhere yet: the corner dot reports that a
     sync failed, and this holds why. A hole rather than a name, so it
     is clear the value is unread on purpose. */
  const [, setSyncError] = useState("");
  const syncTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  const syncing = useRef(false);
  const fromSync = useRef(false);
  /* The document as the writers see it. Every change goes through commit()
     so the ref is current the moment it is made, not at the next render:
     two async writers finishing in the same tick — the launch sync and the
     first course refresh, say — used to each build on the state before the
     other's change and the second silently undid the first. */
  const dataRef = useRef(data);
  const commit = useCallback((next: Doc) => {
    dataRef.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    setSyncCfg(loadSyncConfig());
  }, []);

  const runSync = useCallback(
    /* Defaulted rather than required: most callers have no token in hand
       and want whatever this device is already signed in with. */
    async (token: string = "") => {
      const key = token || loadSyncConfig().token;
      if (!key || syncing.current) return;
      syncing.current = true;
      setSyncState("syncing");
      setSyncError("");
      try {
        const { merged, changed } = await syncOnce(dataRef.current, key);
        if (changed) {
          /* Two things before the merged copy is adopted.

             Anything that happened here while the round trip was in flight
             — an answer given, a card flagged — is folded back in, because
             the merge was made from a snapshot taken before it. Merging is
             idempotent, so this is the same operation once more, against
             what is current; it goes up on the next sync.

             And it is lifted, the same as a document read from disk. What
             comes back may have been written by an older build — a card
             without a state for an exercise type that did not exist yet —
             and taking it as-is put an incomplete card into memory that
             crashed the next render. */
          const adopted = merge(mergeData(dataRef.current, merged));
          fromSync.current = true;
          commit(adopted);
          await saveData(adopted);
        }

        // Clips travel separately, one key each, only when missing.
        const prevCfg = loadSyncConfig();
        let uploaded = prevCfg.uploaded || [];
        try {
          /* Existence is a key lookup and the upload is a data URL: neither
             touches the network nor makes an object URL. The old version did
             both, which fetched every course recording on the first sync and
             sent "blob:" strings to the server as recordings. */
          const res = await syncClips(key, merged, {
            hasLocal: hasClipLocal,
            readLocal: clipDataUrl,
            /* The result is dropped on purpose: a clip that will not save
               locally is a slower next launch, not a failed sync. */
            writeLocal: async (id: string, url: string) => {
              await saveClip(id, url);
            },
            uploaded,
          });
          uploaded = res.uploaded;
          if (res.pulled) flash(`${plural(res.pulled, "recording")} downloaded`);
        } catch (e) {
          /* the document is synced; clips can catch up next time */
        }

        const cfg = { ...prevCfg, token: key, lastSync: now(), uploaded };
        saveSyncConfig(cfg);
        setSyncCfg(cfg);
        setSyncState("ok");

        /* Everything this device holds has now gone up under the shared
           token, so a document left behind by an older build's private key
           carries nothing that isn't here. Remove it rather than leave a
           copy of someone's cards on the server for ever. */
        for (const legacy of [...LEGACY_SYNC_KEYS]) {
          LEGACY_SYNC_KEYS.delete(legacy);
          tokenFor(legacy)
            .then((old) => (old !== key ? forgetRemote(old) : null))
            .catch(() => {});
        }
      } catch (err) {
        const msg = String(
    (err && typeof err === "object" && "message" in err && err.message) || err
  );
        setSyncError(
          msg === "bad-passphrase"
            ? "Passphrase rejected"
            : navigator.onLine === false
            ? "Offline — will retry"
            : "Sync failed"
        );
        setSyncState("error");
      } finally {
        syncing.current = false;
      }
    },
  /* Deliberately none. This reads and writes through refs so that a
     sync started at any moment works on the document as it is then,
     not as it was when the callback was made. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* The sign-in key is the only secret, so devices find each other without
     anything being set up: every device signed in as this person derives
     the same token and shares one document. */
  useEffect(() => {
    if (!ready || !account || !account.key) {
      if (ready && !account) {
        saveSyncConfig({ ...loadSyncConfig(), token: "" });
        setSyncCfg((c) => ({ ...c, token: "" }));
      }
      return;
    }
    let alive = true;
    tokenFor(account.key).then((token) => {
      if (!alive) return;
      saveSyncConfig({ ...loadSyncConfig(), token });
      setSyncCfg((c) => ({ ...c, token }));
      runSync(token);
    });
    return () => {
      alive = false;
    };
  /* As above. The account object changes identity far more often
     than the person behind it does. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountKey, runSync]);

  // After anything changes — which covers the end of a session.
  useEffect(() => {
    if (!ready || !syncCfg.token) return;
    if (fromSync.current) {
      fromSync.current = false;
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => runSync(), 4000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [data, ready, syncCfg.token, runSync]);

  // Heartbeat for the countdown on a timed session.
  useEffect(() => {
    if (!session || !session.endsAt) return;
    const id = setInterval(() => setNow_(Date.now()), 500);
    return () => clearInterval(id);
  /* When the session ends, not which object holds it: the ticking
     clock below replaces the session object every half second. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session && session.endsAt]);

  // Retry when the connection comes back.
  useEffect(() => {
    const onOnline = () => {
      if (loadSyncConfig().token) runSync();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSync]);

  useEffect(() => {
    let alive = true;
    loadData().then((d) => {
      if (alive) {
        commit(d);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  /* Once, on mount. commit is read through a ref precisely so this
     does not have to re-run when the document changes. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Match the page background and native controls to the chosen theme.
  useEffect(() => {
    const t = data.settings.theme || "auto";
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme =
      t === "auto" ? "light dark" : t;
  }, [data.settings.theme]);

  /* Anything recorded before clips moved to IndexedDB gets moved across. */
  useEffect(() => {
    if (!ready) return;
    const ids = [];
    for (const it of data.items) {
      for (const { unit } of unitsOf(it)) for (const r of unit.recs || []) ids.push(r.id);
    }
    if (ids.length) migrateClips(ids);
  /* Once the app is ready, and only then. Depending on the cards
     would walk every recording again on every edit, to migrate
     clips that were already migrated. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* Takes the next document, or a function of the current one. The
     function form is for anything that can run while a sync or a course
     refresh is in flight — grading, flagging — so it builds on what is
     current rather than on the render it was created in. */
  const persist = useCallback(
    (nextOrFn: Doc | ((cur: Doc) => Doc | null)) => {
      const next = typeof nextOrFn === "function" ? nextOrFn(dataRef.current) : nextOrFn;
      if (!next || next === dataRef.current) return;
      commit(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaveFailed(!(await saveData(next)));
      }, 600);
    },
    [commit]
  );

  /*
   * Cards borrowed for a trial run, which are not this device's.
   *
   * A teacher trying an exercise out is asking a question about their own
   * material, which lives on the server and has nothing to do with what
   * this device is learning. It is held here for as long as the trial
   * lasts and never reaches the document — but everything that answers
   * "what can be asked of this" reads it, because a question about a word
   * has to be able to find the phrases that word turns up in.
   */
  const [preview, setPreview] = useState<Item[]>([]);
  /* And where to put the teacher back down afterwards: the card they
     pressed the button on, and the screen they were looking at it from. */
  const [trialBack, setTrialBack] = useState<any>(null);
  const items = data.items;
  /* What the question machinery reads: the device's cards, plus anything
     borrowed. Everything else in the app reads `items`, because nothing
     else should see a card that is not really here. */
  const asking = useMemo(
    () => (preview.length ? items.concat(preview) : items),
    [items, preview]
  );
  const settings = data.settings;
  /* The on-screen keys, opened from the button inside the answer field.
     Below `settings`, which it reads, and above every early return, which
     is where a hook has to be. */
  const [keysOpen, setKeysOpen] = useKeysOpen(settings.keyboard);
  // Keep the module-level pointer in step, for the pure helpers that have no
  // settings to hand. Derived from state, so it cannot drift.
  setActiveLang(settings.language || DEFAULT_LANGUAGE);

  /* And the same for where each word turns up. Rebuilt only when the cards
     change: it walks every phrase against every word it claims to teach,
     which is not work to repeat on a keystroke. */
  const contextIndex = useMemo(
    /* A language at a time, then merged: finding one word inside another is
       a language's own rule — Arabic peels prefixes — and running one
       language's rule over another's cards would pair words that have
       nothing to do with each other. Nothing collides in the merge: the
       keys are form ids, and a form is in one language. */
    () => {
      const byLang: Map<LangId, Item[]> = new Map();
      for (const it of asking) {
        const id = langIdOf(it, settings);
        byLang.set(id, (byLang.get(id) || []).concat([it]));
      }
      const merged: Map<string, any[]> = new Map();
      for (const [id, list] of byLang) {
        for (const [unitId, found] of buildContextIndex(list, LANGUAGES[id] || langOf(settings))) {
          merged.set(unitId, found);
        }
      }
      return merged;
    },
  /* Only the language, not the whole settings object: this walks
     every phrase against every word it claims to teach, which is not
     work to repeat because a checkbox moved. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [asking, settings.language]
  );
  setContextIndex(contextIndex);

  /* And which scene each line of a conversation stands in. The same
     arrangement and for the same reason: a pure function that is handed a
     unit has no way to be handed a map as well. */
  const dialogIndex = useMemo(() => buildDialogIndex(asking), [asking]);
  setDialogIndex(dialogIndex);

  /* And what can fill each variable, by language. Ordered by when the cards
     were made rather than by where they happen to sit in the document: the
     rotation walks this list, and a list that reordered itself on a sync
     would hand somebody a different name for the same count. */
  const valueIndex = useMemo(() => {
    const map: Map<string, Value[]> = new Map();
    const fillers = asking
      .filter((it) => it.fills)
      .sort((a, b) => (a.created || 0) - (b.created || 0) || a.id.localeCompare(b.id));
    for (const it of fillers) {
      const slot = String(it.fills || "").toLowerCase();
      const value = valueOf(it);
      if (!value.ar) continue;
      const key = valueKey(langIdOf(it, settings), slot);
      map.set(key, (map.get(key) || []).concat([value]));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking, settings.language]);
  setValueIndex(valueIndex);

  /* And how many words each language has to pair against. */
  const mateCounts = useMemo(() => countMates(asking, settings), [asking, settings]);
  setMateCounts(mateCounts);

  /* Every recording the cards refer to, for taking a course offline. */
  const allClipIds = useMemo(() => {
    const ids = [];
    for (const it of items) {
      for (const { unit } of unitsOf(it)) for (const r of unit.recs || []) ids.push(r.id);
    }
    return ids;
  }, [items]);

  const allTags = useMemo(() => {
  const counts: Record<string, number> = {};
    for (const it of items) for (const t of it.tags || []) counts[t] = (counts[t] || 0) + 1;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [items]);

  const inDeck = useCallback(
    (it: Item) => deck.length === 0 || (it.tags || []).some((t) => deck.includes(t)),
    [deck]
  );

  const drillable = useMemo(
    () => items.filter((it) => inDeck(it) && isDrillable(it, settings)),
    [items, settings, inDeck]
  );

  const countReady: (pool: Item[]) => number = useCallback(
    (pool) =>
      pool.filter((it) =>
        drillableUnits(it, settings).some(({ unit }) =>
          enabledTypes(unit, settings).some((t) => stateReady(statesOf(unit)[t]))
        )
      ).length,
    [settings]
  );

  const readyCount = useMemo(() => countReady(drillable), [drillable, countReady]);

  /*
   * The languages this person actually has cards in, with how much of each
   * is ready. More than one and a session has to say which it is, because
   * an app set to one language and a session drawn from both is what used
   * to happen: Vietnamese cards marked by Arabic's rules, laid out
   * right-to-left, and offered exercises Vietnamese does not have.
   *
   * Read off the cards rather than off the courses: a card kept after a
   * course ended is still a card in that language.
   */
  const langChoices = useMemo(() => {
    const byLang: Map<LangId, Item[]> = new Map();
    for (const it of drillable) {
      const id = langIdOf(it, settings);
      byLang.set(id, (byLang.get(id) || []).concat([it]));
    }
    return [...byLang.entries()]
      .map(([id, list]) => ({
        id,
        name: (LANGUAGES[id] || {}).name || id,
        ready: countReady(list),
        total: list.length,
      }))
      /* The app's own language leads; the rest by how much is waiting. */
      .sort((a, b) =>
        a.id === settings.language ? -1 : b.id === settings.language ? 1 : b.ready - a.ready
      );
  }, [drillable, settings, countReady]);

  /* ---------------- session ---------------- */

  /*
   * One exercise, on one card, run for a teacher who wants to see it.
   *
   * The card comes from the teaching space, where cards are the teacher's
   * own material rather than anything this device is learning — so it
   * arrives already turned into the shape a question is asked of, along
   * with whatever other cards the question needs to make sense of it (the
   * phrases a word turns up in, most of all). Those are held apart from
   * the document: nothing here is stored, synced, or counted, and closing
   * the trial forgets them.
   *
   * `trial` is what the rest of the screen reads to know that: no
   * progress is written when it is answered, and leaving asks nothing,
   * because there is nothing to lose.
   */
  function tryExercise({ items: material, exercise, back }: {
    items: Item[];
    exercise: Question;
    back?: any;
  }) {
    setPreview(material || []);
    /* Where the teacher was standing when they pressed it. The teaching
       space is unmounted while the question is up — it is a different
       screen, not a layer over this one — so getting back to the card
       means telling the space, on its way back in, which card it was. */
    setTrialBack(back || null);
    const built = { exercises: [exercise], reason: null, manual: true, trial: true, items: 1, units: 1 };
    warmSession(built);
    setSession({ ...built, practice: true, startedAt: now(), endsAt: 0 });
    setQi(0);
    setTally({ ok: 0, no: 0 });
    resetExercise();
    /* Out of the teaching space and onto the screen questions are asked
       on, which is the only one there is. Where it came from is
       remembered, so closing the trial goes back rather than dropping a
       teacher into somebody else's app. */
    setSpace("learn");
    setTab("home");
  }

  /* Done with the trial: forget the borrowed material and go back to the
     card it was asked about. Not merely to the teaching space — a teacher
     pressing "Try it" is in the middle of reading one card, and being
     returned to a list of courses is being made to find their place
     again. `trialBack` is what says where that was. */
  function endTrial() {
    setSession(null);
    setPreview([]);
    setSpace("teach");
  }

  /*
   * The sessions kept from the Build screen.
   *
   * Narrowed on the way out of storage rather than trusted: this rides in
   * settings, which is an open bag that an older build, a hand-edited
   * import or a half-finished write can all put something else in — and a
   * list screen that throws is a learner with no way back to their own
   * material.
   */
  const savedSessions: SavedSession[] = useMemo(() => {
    const raw = settings.savedSessions;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && typeof x.id === "string" && Array.isArray(x.ids) && typeof x.mode === "string")
      .map((x) => ({
        id: x.id,
        name: String(x.name || "Saved session"),
        ids: x.ids.filter((i: unknown) => typeof i === "string"),
        mode: x.mode,
        count: Number(x.count) || 0,
        minutes: Number(x.minutes) || 0,
        created: Number(x.created) || 0,
      }));
  }, [settings.savedSessions]);

  function keepSession(session: Omit<SavedSession, "id" | "created">) {
    const kept: SavedSession = {
      ...session,
      id: `v${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      created: now(),
    };
    setSetting("savedSessions", savedSessions.concat([kept]));
    flash(`Saved — it is under Saved sessions`);
  }

  function dropSession(id: string) {
    setSetting("savedSessions", savedSessions.filter((x) => x.id !== id));
  }

  /* A session assembled by hand on the Build screen. */
  function beginManual({ ids, mode, count, minutes }: {
    ids: Set<string> | string[];
    mode: string;
    count?: number;
    minutes?: number;
  }) {
    const built = buildManualSession({ items, settings, ids, mode, count });
    setBuilding(false);
    if (!built.exercises.length) {
      flash(
        built.reason === "no-mistakes"
          ? "Nothing to fix — none of those have gone wrong recently"
          : built.reason === "no-variety"
          ? "That needs at least two exercise types"
          : "Those cards don't have enough to practice yet"
      );
      return;
    }
    warmSession(built);
    setSession({
      ...built,
      practice: false,
      startedAt: now(),
      endsAt: minutes ? now() + minutes * 60000 : 0,
    });
    setQi(0);
    setTally({ ok: 0, no: 0 });
    resetExercise();
    setTab("home"); // a session started from anywhere is run on the home screen
  }

  /* Bring down whatever the courses hold and fold it into the cards. */
  const refreshCourses = useCallback(
    /* Three answers, not two: silent, speak only if something moved, or
       speak either way. */
    async (announce: boolean | "changes") => {
      if (!account) return;
      /* A focus and a visibility change arrive together when a tab comes
         back; one refresh at a time is enough. */
      if (refreshing.current) return;
      refreshing.current = true;
      setCourseBusy(true);
      try {
        const r = await pullCourses(dataRef.current.items, freshStates, materialVersion.current);
        setTeaches(r.teaches);
        saveTeaches(r.teaches);
        materialVersion.current = r.version || "";
        if (r.unchanged) {
          setCourseError("");
          if (announce === true) flash("Nothing new");
          return;
        }
        setMyCourses(r.courses);
        setCourseDecks(r.decks);
        /* Folded against the cards as they are now, not as they were when
           the request went out: an answer given while the material was
           being fetched used to be lost to the copy that came back. */
        Object.assign(r, r.fold(dataRef.current.items));

        /* The trainer teaches one language at a time. If every course a person
           is in teaches the same one, that is the language their cards are in,
           and leaving the app on its default meant a Vietnamese course was
           shown in Arabic script, typed on an Arabic keyboard and marked by
           the Arabic rules — which looks exactly like the course not working. */
    const courseLangs: string[] = [];
        for (const c of r.courses) {
          if (c.language && LANGUAGES[c.language] && !courseLangs.includes(c.language)) {
            courseLangs.push(c.language);
          }
        }
        /* Adopted, not imposed: a language the person picked themselves in
           Preferences stays picked. Without this the app switched back on
           every refresh, forty-five seconds after any change. */
        const chosen = !!dataRef.current.settings.languageChosen;
        if (
          courseLangs.length === 1 &&
          !chosen &&
          courseLangs[0] !== dataRef.current.settings.language
        ) {
          const withLang = {
            ...dataRef.current,
            settings: { ...dataRef.current.settings, language: courseLangs[0] },
            settingsUpdated: now(),
          };
          commit(withLang);
          await saveData(withLang);
          flash(`Now set up for ${LANGUAGES[courseLangs[0]].name}`);
        }
        if (r.added || r.gone) {
          /* A withdrawn card is a deletion, and deletions have to be recorded
             or the next sync restores them from the shared copy. */
          const tombstones = { ...(dataRef.current.tombstones || {}) };
          for (const id of r.goneIds || []) tombstones[id] = now();
          /* And anything that has come back — a course rejoined, a deck put
             back — is no longer deleted, so its headstone goes. */
          for (const it of r.items) if (it.source) delete tombstones[it.id];
          const next = { ...dataRef.current, items: r.items, tombstones };
          commit(next);
          await saveData(next);
        }
        setCourseError("");
        /* "always" is the Refresh button on the courses screen, which should
           say something even when nothing moved. "changes" is Sync now, which
           reports its own result and should only speak up if the courses
           actually differ. */
        const changed = r.added || r.gone;
        if (announce === true || (announce === "changes" && changed)) {
          flash(
            r.added
              ? `${plural(r.added, "card")} from your courses` +
                  (r.gone ? ` · ${r.gone} withdrawn` : "")
              : r.gone
              ? `${plural(r.gone, "card")} withdrawn`
              : "Nothing new"
          );
        }
      } catch (e) {
        setCourseError(API.explain(e));
      } finally {
        refreshing.current = false;
        setCourseBusy(false);
        /* Whether it answered or failed, we are no longer waiting to find
           out — and an empty-handed student is only told to join a course
           once we know they are not already in one. */
        setCoursesKnown(true);
      }
    },
  /* The handle, not the account object. commit and flash are stable
     across renders — one writes through a ref, the other forwards to
     a memoised snackbar — so naming them would only churn this. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountHandle]
  );

  useEffect(() => {
    if (ready && account) refreshCourses(false);
  /* The handle, not the account object, for the same reason. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountHandle, refreshCourses]);

  /* Sync now should mean everything this person has, not just this device's
     own cards. The courses are the other half of what a student holds, and a
     course that has been withdrawn is exactly what someone pressing it wants
     to find out — and for a teacher or an administrator, so are the decks
     somebody else changed and the people who have signed in since.

     Every space they belong to, not only the one on screen: the others have
     no component to ask while they are closed, which is why the fetching for
     them lives in shared.jsx rather than inside the spaces. Whatever comes
     back is left where a space picks it up, so the one being looked at
     updates in place and the rest are already current on arrival.

     Nothing here narrates itself. The dot in the corner is the report — it
     stays lit until all of this is done, and turns to trouble if any part of
     it failed. */
  const syncEverything = useCallback(async () => {
    setSpacesBusy(true);
    try {
      /* Only whether each one settled matters here, not what it returned. */
      const jobs: Promise<unknown>[] = [runSync()];
      if (account) jobs.push(refreshCourses("changes"));
      if (account && (teaches || account.admin))
        jobs.push(
          pullTeaching(account.handle).then((r) => {
            if (r.failed) throw r.failed;
          })
        );
      if (account && account.admin) jobs.push(pullAdmin(account.handle));
      const done = await Promise.allSettled(jobs);
      /* Said after everything has settled, so it cannot be overwritten by
         the half of the sync that went fine. */
      if (done.some((r) => r.status === "rejected")) setSyncState("error");
    } finally {
      setSpacesBusy(false);
    }
  /* The handle, not the account object, for the same reason. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSync, refreshCourses, accountHandle, teaches, accountAdmin]);

  /* A course can be deleted, or its decks changed, by a teacher on another
     device. Without this the home screen keeps showing a course that is gone
     until the app is reloaded. */
  const recheckCourses = useCallback(() => {
    if (ready && account) refreshCourses(false);
  /* The handle, not the account object, for the same reason. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountHandle, refreshCourses]);
  useLiveRefresh(recheckCourses);

  /* Fetch, in the background, the recordings a session is about to play.
     Done here on purpose rather than as a side effect of sync, so the first
     sync on a new device no longer downloads every recording in every
     course before it does anything else. */
  function warmSession(built: { exercises?: Question[] }) {
    const ids = [];
    for (const ex of built.exercises || []) {
      const r = resolveUnit(items, ex);
      if (r && r.unit) for (const rec of r.unit.recs || []) ids.push(rec.id);
    }
    if (ids.length) warmClips(ids).catch(() => {});
  }

  /**
   * @param langId  One language, or "" for all of them
   *   together. Kept for the next session started from here — "Keep going"
   *   means more of what you were just doing.
   */
  function begin(practice?: boolean, langId: LangId | "" | null = sessionLang) {
    setSessionLang(langId || "");
    const pool = langId ? items.filter((it) => langIdOf(it, settings) === langId) : items;
    const built = buildSession({ items: pool, settings, inDeck, practice });
    if (!built.exercises.length) {
      /* This used to return in silence, which reads as a broken button. It
         mattered little when the only way to get here was a card list that
         was plainly too thin; with listening switched off it is reachable
         with a deck full of cards, and the reason has to be said. */
      flash(
        listenOff > Date.now()
          ? "Nothing to practice without sound just now"
          : "Nothing ready to practice yet"
      );
      return;
    }
    warmSession(built);
    setSession({ ...built, practice });
    setQi(0);
    setTally({ ok: 0, no: 0 });
    resetExercise();
  }

  /* Send every card back to the beginning: the cards, forms, decks and
     recordings stay, only what the app has learnt about you goes. */
  function resetScheduling() {
    const cleared: Item[] = items.map((it) => ({
      ...it,
      s: freshStates(),
      subs: (it.subs || []).map((sb) => ({ ...sb, s: freshStates() })),
      updated: now(),
    }));
    persist({ ...data, items: cleared, log: {} });
    setSession(null);
    flash("Scheduling reset — nothing is due until you practice it");
  }

  function resetExercise() {
    setTyped("");
    setChecked(null);
    setPairs([]);
    setMatched({});
    setSkipped(false);
    setOverridden(false);
    setFlaggedNow(false);
    setAlsoOpen(false);
    setShowSaid(false);
    setShowMeaning(false);
    setHintOpen(settings.showHint);
  }

  const exercise = session && qi < session.exercises.length ? session.exercises[qi] : null;
  /* The card, narrowed to the question being asked of it: its variables
     filled in, one accepted answer where the question is about how a word
     sounds, one meaning where the meaning is the question. All three before
     anything reads it, so the prompt, the marking and the answer screen
     cannot disagree — and filling first, because the other two narrow the
     words it writes. */
  const resolved = exercise
    ? castMeaning(
        castAnswer(castFill(resolveUnit(asking, exercise), exercise.type), exercise.type),
        exercise.type
      )
    : null;
  const item = resolved ? resolved.unit : null; // the form being drilled
  const parentItem = resolved ? resolved.parent : null;
  const isSub = !!(resolved && resolved.isSub);
  /*
   * The language of the question on screen, which is the card's rather than
   * the app's. In a session drawn from one language they are the same
   * thing; in a mixed one an Arabic question can be followed by a
   * Vietnamese one, and each has to be laid out, typed and marked in its
   * own — everything below reads this rather than the settings.
   *
   * The module-level pointer follows it too, for the pure helpers that are
   * called with nothing to look it up from. Set unconditionally: with no
   * question up this is the app's own language, which is what it was.
   */
  const qSettings = settingsFor(settings, item || parentItem);
  const qLang = langOf(qSettings);
  setActiveLang(qLang.id);
  const spec = exercise ? exOf(exercise.type, qLang) : null;
  /* The phrase this question shows the word in, if it is that sort of
     question. Chosen when the queue was built and named on the exercise, so
     it stays put; looked up again here because only the id travels. */
  const wantsContext = !!(spec && (spec.promptField === "context" || spec.needs.includes("contextAudio")));
  const context =
    wantsContext && exercise && exercise.ctx && item
      ? contextsFor(item.id).find((c) => c.id === exercise.ctx) || null
      : null;
  /*
   * Somewhere this word turned up, for the answer screen — whatever the
   * question was.
   *
   * A phrase a teacher wrote is the most useful thing the app holds about
   * a word, and it used to be shown only on the two questions built out of
   * it: answer the word on its own and you never saw it, even with one on
   * file. Every link a teacher makes now pays out on every question about
   * that word.
   *
   * Rotated the way the gap-fill rotates, so a word with three phrases
   * shows each of them in turn rather than the first one for ever, and
   * skipped where the question already has one on the screen.
   */
  const alsoContext = useMemo(() => {
    if (!item || context) return null;
    const list = contextsFor(item.id);
    if (!list.length) return null;
    const seen = Object.values(statesOf(item)).reduce((n, st) => n + ((st && st.reps) || 0), 0);
    return list[seen % list.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, context, checked]);
  const practice = !!(session && session.practice);

  /* ---- the conversation, when the question is one ----
     Three facts the screen asks for over and over: which scene this is,
     where in it the question stands, and what a learner may see of it
     before answering. A card-level exercise — reading it through, putting
     it in order, playing a part — has no line of its own, which is what
     `at` being null means. */
  const dialog = isDialog(parentItem) ? parentItem : null;
  const scene = dialog && item ? sceneOf(item.id) : null;
  const at = scene ? scene.at : null;
  /* Everything said before this line: the question, in a dialog. What
     comes after would be the answer to a different one. */
  const soFar = dialog && at !== null ? sceneBefore(dialog, at).concat([linesOf(dialog)[at]]) : [];
  /* Whether the whole scene is on screen. True of the two that are about
     the conversation rather than about a turn in it: meeting it, and
     reading it through for yourself. */
  const whole = !!dialog && !!spec && (!!spec.intro || spec.answerMode === "self");
  /*
   * The few answers on offer, for whichever question offers a few.
   *
   * Worked out from the ids rather than drawn, so they do not reshuffle
   * under a finger between renders. A reply comes from the scene and the
   * scenes around it; a missing word comes from the learner's other words
   * in the same language — a wrong answer has to be a word they could
   * believe, which means one they have actually met.
   */
  /*
   * The words a matching grid puts up, and the meanings beside them.
   *
   * Which words stand together was decided when the session was dealt —
   * see withGrids — and travels on the question as its mates; every one of
   * them is asked. What is drawn here is the spare meanings, from the
   * learner's other words in this language, the most like the grid's own
   * first, and the order the two columns stand in. Re-drawn as the card
   * comes round again — the seed carries how many times it has been asked
   * — so the columns are not in the same order twice.
   *
   * A mate that has since been withdrawn is simply not up: the grid is
   * whatever of it is still here.
   */
  const grid = useMemo(() => {
    if (!item || !spec || !exercise || spec.picks !== "pair") return { words: [], meanings: [] };
    const answers: Form[] = [item];
    for (const mate of exercise.mates || []) {
      const r = resolveUnit(asking, { ...mate, type: exercise.type });
      if (r && r.unit.ar && r.unit.en) answers.push(r.unit);
    }
    const pool = wordPool(asking, settings, qLang.id, item).filter((u) => u.ar && u.en);
    const reps = (statesOf(item)[exercise.type] || {}).reps || 0;
    const likeness = (u: Form) => Math.max(...answers.map((a) => wordLikeness(a.ar, u.ar, qLang)));
    const ranked = [...pool].sort((x, y) => likeness(y) - likeness(x));
    /* A question dealt no mates — a teacher trying the exercise on one
       card — is given its company from the pool, the most alike first, so
       the grid they see is the grid a learner gets. Nothing is marked on a
       trial, so nothing is marked on them. */
    if (!exercise.mates) {
      for (const u of ranked) {
        if (answers.length >= PAIR_WORDS) break;
        if (!answers.some((a) => a.id === u.id)) answers.push(u);
      }
    }
    return matchSet({
      answers,
      pool: ranked,
      seed: `${item.id} ${reps}`,
      textOf: (u) => u.ar,
      meaningOf: (u) => u.en,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, exercise && exercise.type, exercise && exercise.mates, asking, qLang.id]);

  const choices = useMemo(() => {
    if (!spec || !spec.picks) return [];
    if (spec.picks === "reply") {
      return dialog && at !== null
        ? replyOptions({ card: dialog, at, pool: replyPool(asking, settings, qLang.id) })
        : [];
    }
    if (!item) return [];
    return optionsFor({
      answer: item,
      pool: wordPool(asking, settings, qLang.id, item),
      wanted: PICK_OPTIONS,
      seed: `${item.id} ${(exercise && exercise.ctx) || ""}`,
      textOf: (w) => w.ar,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog && dialog.id, at, item && item.id, exercise && exercise.type, exercise && exercise.ctx, asking.length]);

  /*
   * Which of the accepted answers the learner wrote.
   *
   * A card may accept a masculine and a feminine, or a singular and a
   * plural, and the two are different words with different grammar. The
   * answer screen has something worth saying about the one they chose —
   * that it was the feminine — and it can only say it of the answer that
   * matched. Found through the language's own checker, so "matched" means
   * here what it means everywhere else: bare letters count, a near miss
   * does not.
   *
   * Only where they typed it. A question answered by tapping one of a few
   * is already looking at the answer it offered, and a question the
   * learner gave up on has no answer of theirs to describe.
   */
  const gaveAnswer = useMemo(() => {
    if (!item || !checked || !spec || skipped) return null;
    if (spec.answerField !== "ar") return null;
    return answerGiven(typed, item, (given, want) => qLang.check(given, want, qSettings).ok, answerFields());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, checked, typed, skipped, spec && spec.answerField]);
  /* And what that answer is, grammatically, in this language's words. Empty
     where the language declares no grammar, or the answer carries none. */
  const gaveLabel = gaveAnswer ? labelFor(gaveAnswer, qLang) : "";

  /* What the answer screen has to say, once there is one.
     `answerRepeated` is whether the right answer is shown under the
     verdict: it is not, when the answer was right and typed in full —
     it is already in the box above, and repeating it says nothing.
     Nothing else stands in for it, so in that one case the praise is the
     whole of what the screen came back with, and it is sized as the thing
     being read rather than as the line introducing the answer below. */
  const answerRight = !!checked && (checked.ok || overridden);
  /* Playing a part is the exception: the scene is already on the screen
     with every turn marked where it stands, so repeating it underneath
     would be the same conversation twice. */
  const answerRepeated =
    !!checked &&
    (!answerRight || checked.reason === "bare") &&
    !(spec && spec.answerMode === "part") &&
    /* Nor under a grid: every word paired wrong shows its meaning where
       it stands, and the first word's alone would say less. */
    !(spec && spec.picks === "pair");
  const verdictAlone = answerRight && !answerRepeated;

  useEffect(() => {
    if (exercise && inputRef.current && !checked) inputRef.current.focus();
  /* The question number alone. Naming `checked` would drag focus
     back into the box the moment an answer was marked, and `exercise`
     changes with it. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi]);

  /* Each word of the grid against what was put to it. The grid's own
     verdict is the whole of it: right when every pair is. */
  const gridMarks = () =>
    grid.words.map((w) => ({ unit: w, right: (matched[w.id] || "") === String(w.en || "") }));

  function submit() {
    if (!item || checked) return;
    const result =
      spec && spec.picks === "pair"
        ? gridMarks().every((m) => m.right)
          ? { ok: true, reason: "exact" }
          : { ok: false, reason: "wrong" }
        : checkAnswer(typed, item, exercise.type, qSettings);
    sfx(result.ok ? "correct" : "wrong");
    setPairs(relatedWords(asking, qLang, item.ar));
    setChecked(result);
    // Drop the phone keyboard so the answer and grades are visible.
    if (inputRef.current) inputRef.current.blur();
  }

  /* "Can't listen right now": stop asking for recordings, here and in
     anything built for the next quarter of an hour. */
  function goQuiet() {
    const until = now() + LISTEN_OFF_MS;
    /* The module flag first, because withoutListening and every builder read
       it rather than the state; then the state, so the screen re-renders;
       then the device, so a reload does not undo it. */
    setListenOffUntil(until);
    setListenOff(until);
    saveListenOff(until);

    const next = session ? withoutListening(session.exercises, qi, items, settings) : [];
    if (next.length <= qi) {
      /* Every card left needs sound. Ending here is honest — running the
         queue out would show "Session complete" over a session that was
         cut short. */
      setSession(null);
      sfx("warn");
      flash("Nothing left in this session that works without sound");
      return;
    }
    setSession((s: Session | null) => (s ? { ...s, exercises: next } : s));
    /* The question at this index is a different one now, so nothing typed
       against the old one should survive. */
    resetExercise();
    sfx("tick");
    /* The button says what it stops, not how long for, and the window
       outlives this session — so say it here rather than leaving someone to
       wonder whether it stuck. */
    flash(
      `No listening exercises for ${Math.round(LISTEN_OFF_MS / 60000)} minutes`,
      "good"
    );
  }

  /* Past a question that was never marked. A read-through is the only one:
     it has nothing to grade, nothing to record and no schedule of its own,
     so it does not go anywhere near applyGrade — it is the scene, met. */
  function metScene() {
    sfx("tick");
    setQi((i) => i + 1);
    resetExercise();
  }

  function giveUp() {
    sfx("warn");
    setPairs(relatedWords(asking, qLang, item ? item.ar : ""));
    setSkipped(true);
    setChecked({ ok: false, reason: "skipped" });
    if (inputRef.current) inputRef.current.blur();
  }

  /*
   * Record a problem against the item, so it can be found and fixed later.
   *
   * Twice over, because the two copies answer different questions. The one
   * on the card is the learner's own mark on their own document — it is
   * what makes a flagged card findable on this device, and it stands
   * whether or not there is a server to reach. The one sent to the server
   * is the report: it lands in Admin → Flags, where somebody who can
   * actually change the card will see it, and it carries enough of the
   * question with it to be read months later, after the card has been
   * edited or withdrawn.
   *
   * The send is not waited on. A flag is worth making and not worth
   * stopping a session over, so the menu closes either way and the pill
   * says which of the two happened.
   */
  function flagCurrent(kind: FlagKind, note?: string) {
    if (!parentItem || !exercise) return;
    const said = String(note || "").slice(0, FLAG_NOTE_MAX);
    setFlaggedNow(true);
    sfx("tick");
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice() };
      const idx = next.items.findIndex((i) => i.id === parentItem.id);
      if (idx < 0) return cur;
      const it = { ...next.items[idx] };
      it.flags = (it.flags || [])
        .filter((f) => !(f.kind === kind && f.ex === exercise.type && f.subId === (exercise.subId || null)))
        .concat([{ kind, ex: exercise.type, subId: exercise.subId || null, note: said, at: now() }]);
      it.updated = now();
      next.items[idx] = it;
      return next;
    });

    if (!account) {
      flash("Noted on this device. Sign in to report it.", "warn");
      return;
    }
    API.reportFlag({
      kind,
      note: said,
      /* The card's id on the server, which is not the item's id here:
         course material arrives as items named srv<cardId>, and a report
         naming the local one points at nothing an administrator can open. */
      cardId: serverCardId(parentItem),
      exercise: exercise.type,
      subId: exercise.subId || null,
      /* The id, not the pack: what is stored has to survive being read by
         a build whose pack for it has moved on. */
      language: qLang.id,
      /* A copy of the question, not a pointer to it: the card can be
         edited or withdrawn between the flag and somebody reading it, and
         a report that says only "card k3f2" is then unreadable. */
      prompt: parentItem.ar || "",
      meaning: parentItem.en || "",
    })
      .then(() => flash("Thank you for the feedback 🫶", "good"))
      .catch(() => flash("Noted on this device. We couldn't reach the server.", "warn"));
  }

  function applyGrade() {
    if (!item || !parentItem || !exercise) return;
    /*
     * A trial run leaves nothing behind.
     *
     * A teacher trying an exercise out to see what it looks like is not
     * learning anything, and the card is not theirs to have progress on —
     * it is their own teaching material, borrowed for one question. So
     * nothing is scheduled, nothing is counted, nothing is told to the
     * server, and a miss is not re-asked: the question was the point, and
     * it has been seen.
     *
     * And seeing it is the end of it: Continue goes back to the card,
     * rather than to a screen congratulating a teacher on having looked
     * at their own material. There is no score to show and nothing left
     * to do, so the screen that said so was one tap between the answer
     * and the card it was about.
     */
    if (session && session.trial) {
      endTrial();
      sfx("complete");
      return;
    }
    /* Before the grading, not after: a question answered is learning done,
       whether it was right or wrong. */
    reportLearning(account);
    // Nothing to grade by hand: the check decides, and a shown answer counts
    // as a miss. "Too strict" is the one way to overturn it.
    const correct = overridden || (checked && checked.ok && !skipped);
    /* A near miss — right letters, wrong tone; right word, marks missing;
       one letter out — is not the same as drawing a blank, and the schedule
       should not treat it as one. "hard" keeps the card in review with a
       gentle penalty instead of halving its interval and sending it back to
       relearning. It is still re-asked before the session ends. */
    const near =
      !correct &&
      !skipped &&
      checked &&
      ["near", "harakat", "missing"].includes(checked.reason);
    const rating = correct ? "good" : near ? "hard" : "again";
    /*
     * What is marked, and how. One question marks one form — except the
     * grid, where every word up is a question of its own and is marked on
     * the pair put to it, whatever the rest of the grid did.
     *
     * A word dealt in to fill a grid out may not have been due. A success
     * on it counts — it is a right answer — but does not move its schedule,
     * the way practice does not; a miss is a miss wherever it happens. The
     * first word is marked as any question is.
     */
    const marks: {
      id: string;
      subId: string | null;
      rating: string;
      correct: boolean;
      advance: boolean;
    }[] = [];
    if (spec && spec.picks === "pair") {
      const placeOf = (w: Form) => {
        if (w.id === item.id) return { id: parentItem.id, subId: exercise.subId || null };
        for (const mate of exercise.mates || []) {
          const r = resolveUnit(asking, { ...mate, type: exercise.type });
          if (r && r.unit.id === w.id) return mate;
        }
        return null;
      };
      for (const m of gridMarks()) {
        const place = placeOf(m.unit);
        if (!place) continue;
        const lead = m.unit.id === item.id;
        marks.push({
          ...place,
          rating: m.right ? "good" : "again",
          correct: m.right,
          advance: !practice && (lead || stateReady(statesOf(m.unit)[exercise.type])),
        });
      }
    } else {
      marks.push({ id: parentItem.id, subId: exercise.subId || null, rating, correct: !!correct, advance: !practice });
    }
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice(), log: { ...cur.log } };
      let any = false;
      for (const mark of marks) {
        const idx = next.items.findIndex((i) => i.id === mark.id);
        if (idx < 0) continue; // withdrawn while it was on screen
        const it = { ...next.items[idx] };
        const target = mark.subId
          ? (it.subs || []).find((x) => x.id === mark.subId) ||
            linesOf(it).find((x) => x.id === mark.subId)
          : it;
        if (!target) continue;

        const before = statesOf(target)[exercise.type] || freshState();
        let s;
        if (mark.advance || mark.rating !== "good") {
          s = reschedule(before, mark.rating);
        } else {
          // Practice never advances the schedule on a success.
          s = { ...before };
          s.right += 1;
          s.reps += 1;
        }
        if (skipped) s.skips = (s.skips || 0) + 1;
        if (checked && !checked.ok && checked.reason === "near") s.near = (s.near || 0) + 1;
        if (checked && !checked.ok && (checked.reason === "harakat" || checked.reason === "missing")) {
          s.near = (s.near || 0) + 1;
        }
        s.hist = (s.hist || []).concat([mark.correct ? 1 : 0]).slice(-6);
        s.updated = now();

        if (mark.subId && (it.subs || []).some((x) => x.id === mark.subId)) {
          it.subs = (it.subs || []).map((x) =>
            x.id === mark.subId ? { ...x, s: { ...x.s, [exercise.type]: s }, updated: now() } : x
          );
        } else if (mark.subId) {
          it.lines = linesOf(it).map((x) =>
            x.id === mark.subId ? { ...x, s: { ...x.s, [exercise.type]: s }, updated: now() } : x
          );
        } else {
          it.s = { ...it.s, [exercise.type]: s };
        }
        it.updated = now();
        next.items[idx] = it;
        any = true;
      }
      if (!any) return cur;

      /* One question answered, however many words it marked. */
      next.log[dayKey()] = (next.log[dayKey()] || 0) + 1;
      return next;
    });

    setTally((t) => ({
      ok: t.ok + (correct ? 1 : 0),
      no: t.no + (correct ? 0 : 1),
    }));

    if (!correct) {
      setSession((s2: any) => ({ ...s2, exercises: s2.exercises.concat([{ ...exercise }]) }));
    }
    setQi((i) => i + 1);
    resetExercise();
    // The last card of a session earns a different feel from the rest.
    if (session && qi + 1 >= session.exercises.length) sfx("complete");
    else sfx("tick");
  }

  /* ---------------- items ---------------- */

  function addItems(list: any[]) {
    const fresh = list.filter((p) => p.ar || p.lat || p.en).map(makeItem);
    if (!fresh.length) return 0;
    persist({ ...data, items: items.concat(fresh) });
    return fresh.length;
  }

  /* Editing keeps every existing progress record. Sub-items are matched by
     id where they already exist, so correcting a plural's spelling doesn't
     reset what you've learnt about it. */
  function updateItem(id: string, patch: Record<string, any>) {
    const target = items.find((i) => i.id === id);
    if (target && target.locked && !("locked" in patch)) {
      flash("That card is locked — unlock it first");
      return;
    }
    persist({
      ...data,
      items: items.map((i) => {
        if (i.id !== id) return i;
        const next: Item = { ...i, updated: now() };
        for (const [k, v] of Object.entries(patch)) {
          if (k === "subs" || k === "s") continue;
          if (k === "tags") next.tags = cleanTags(v);
          else next[k] = typeof v === "string" ? v.trim() : v;
        }
        if (patch.subs) {
          const old = new Map((i.subs || []).map((x) => [x.id, x]));
          next.subs = patch.subs.map((draft: Record<string, any>) => {
            const prev = draft.id && old.get(draft.id);
            return prev
              ? {
                  ...prev,
                  ar: (draft.ar || "").trim(),
                  en: (draft.en || "").trim(),
                  lat: (draft.lat || "").trim(),
                  /* Every grammatical and lexical value the languages
                     declare — not a fixed pair of Arabic ones, which
                     silently dropped a Vietnamese form's classifier. */
                  ...dimValues(draft),
                  note: (draft.note || "").trim(),
                  recs: draft.recs || [],
                  s: prev.s,
                  updated: now(),
                }
              : makeSub(draft);
          });
        }
        return next;
      }),
    });
  }

  /* Set the same field on many items — used by the bulk bar. */
  function bulkEdit(ids: string[], patch: Record<string, any>) {
    updateMany(unlockedOf(ids), (i) => ({ ...i, ...patch }));
  }

  /* Locked items are left alone by anything that changes them. */
  function unlockedOf(ids: string[]) {
    const set = new Set(ids);
    const targets = items.filter((i) => set.has(i.id));
    const locked = targets.filter((i) => i.locked).length;
    if (locked) flash(`${plural(locked, "locked card")} left unchanged`);
    return targets.filter((i) => !i.locked).map((i) => i.id);
  }

  function tagMany(ids: string[], tag: string) {
    const clean = cleanTags(tag)[0];
    if (!clean) return;
    updateMany(unlockedOf(ids), (i) =>
      (i.tags || []).includes(clean) ? i : { ...i, tags: (i.tags || []).concat([clean]) }
    );
  }

  function setLockedMany(ids: string[], locked: boolean) {
    sfx("tick");
    updateMany(ids, (i) => ({ ...i, locked }));
    flash(`${plural(ids.length, "item")} ${locked ? "locked" : "unlocked"}`);
  }

  function removeItems(ids: string[]) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    const targets = items.filter((i) => set.has(i.id));
    const blocked = targets.filter((i) => i.locked).length;
    const gone = targets.filter((i) => !i.locked);
    if (blocked) {
      flash(
        gone.length
          ? `${plural(blocked, "locked card")} kept`
          : `Locked — unlock ${blocked === 1 ? "it" : "them"} first`
      );
    }
    if (!gone.length) return;
    // Tombstones, so the deletion reaches other devices instead of the
    // items simply reappearing on the next sync.
    const goneIds = new Set(gone.map((i) => i.id));
    const tombstones = { ...(data.tombstones || {}) };
    for (const it of gone) tombstones[it.id] = now();
    persist({ ...data, items: items.filter((i) => !goneIds.has(i.id)), tombstones });
    sfx("warn");
    setLastDeleted(gone);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastDeleted(null), 15000);
  }

  /* A short message for things quietly refused, so a locked card doesn't
     just silently fail to delete — and for the ones that worked, so a save
     is not answered with silence. The two are told apart by kind. */
  function flash(msg: string, kind?: string) {
    snack.show(msg, kind);
  }

  function undoDelete() {
    if (!lastDeleted || !lastDeleted.length) return;
    // A later `updated` than the tombstone, so the restore also wins on
    // any device that already received the deletion.
    const restored = lastDeleted.map((it) => ({ ...it, updated: now() }));
    const tombstones = { ...(data.tombstones || {}) };
    for (const it of restored) delete tombstones[it.id];
    persist({ ...data, items: items.concat(restored), tombstones });
    sfx("pop");
    setLastDeleted(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  /* Apply the same change to many items at once. */
  function updateMany(ids: string[], fn: (it: Item) => Item) {
    const set = new Set(ids);
    persist({
      ...data,
      items: items.map((i) => (set.has(i.id) ? { ...fn(i), updated: now() } : i)),
    });
  }

  const setSetting: (k: string, v: any) => void = (k, v) =>
    persist({
      ...data,
      settings: {
        ...settings,
        [k]: v,
        // A language set by hand is a choice; the courses stop overriding it.
        ...(k === "language" ? { languageChosen: true } : null),
      },
      settingsUpdated: now(),
    });

  const toggleIn: (group: string, k: string) => void = (group, k) =>
    persist({
      ...data,
      settings: { ...settings, [group]: { ...settings[group], [k]: !settings[group][k] } },
      settingsUpdated: now(),
    });

  /* Everything, in one file: the cards as JSON plus each recording as a
     real audio file. Streams into a zip rather than building one huge
     string, and the clips stay playable outside the app. */
  async function exportEverything() {
    if (!OWN) return;
    flash("Gathering recordings…");
    const entries = [
      {
        name: "cards.json",
        blob: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      },
    ];
    let missing = 0;
    for (const it of items) {
      for (const { unit } of unitsOf(it)) {
        for (const rec of unit.recs || []) {
          const blob = await clipBlob(rec.id);
          if (!blob) {
            missing += 1;
            continue;
          }
          const ext = (rec.mime || "").includes("mp4")
            ? "m4a"
            : (rec.mime || "").includes("ogg")
            ? "ogg"
            : (rec.mime || "").includes("wav")
            ? "wav"
            : "webm";
          entries.push({ name: `audio/${rec.id}.${ext}`, blob });
        }
      }
    }
    try {
      const zip = await OWN.makeZip(entries);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arabic-${dayKey()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      flash(
        `Exported ${entries.length - 1} recording${entries.length === 2 ? "" : "s"}` +
          (missing ? ` · ${missing} not on this device` : "")
      );
    } catch (e) {
      flash("Couldn't build the backup");
    }
  }

  /* A file is folded in the way another device's copy is: card by card,
     newer edit wins, deletions honoured. It used to replace the whole
     document — settings, history and the sync secret included — so an old
     backup wiped everything added since, and someone else's backup signed
     you into their sync. */
  function absorb(parsed: any) {
    return merge(mergeData(dataRef.current, merge(parsed)));
  }

  function confirmImport(parsed: any) {
    const n = (parsed.items || []).length;
    return window.confirm(
      `Merge ${plural(n, "card")} from this file into your collection? ` +
        "Cards you already have keep whichever version was edited last."
    );
  }

  async function importZip(file: File) {
    if (!OWN) return;
    flash("Reading the backup…");
    try {
      const files = await OWN.readZip(file);
      const doc = files.find((f) => f.name === "cards.json");
      if (!doc) {
        flash("No cards.json in that zip");
        return;
      }
      let clips = 0;
      for (const f of files) {
        const m = /^audio\/([^.]+)\./.exec(f.name);
        if (!m) continue;
        if (await saveClipBlob(m[1], f.blob)) clips += 1;
      }
      const parsed = JSON.parse(await doc.blob.text());
      if (!Array.isArray(parsed.items)) {
        flash("That backup looks damaged");
        return;
      }
      if (!confirmImport(parsed)) return;
      persist(absorb(parsed));
      flash(`Merged ${parsed.items.length} cards and ${clips} recordings`);
    } catch (e) {
      flash("Couldn't read that backup");
    }
  }

  function importFile(file: File) {
    if (!OWN) return;
    if (/\.zip$/i.test(file.name)) return importZip(file);
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || "");
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.items)) {
          if (confirmImport(parsed)) persist(absorb(parsed));
          return;
        }
      } catch (e) {
        /* not JSON */
      }
      addItems(OWN.parseLines(text, allTags));
    };
    r.readAsText(file);
  }


  /* ---------------- render ---------------- */

  /* Seconds remaining on a timed session, or null when it's counted.
     This has to sit above the early return below: a hook that only runs on
     some renders is React error #310. */
  const timeLeft =
    session && session.endsAt ? Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)) : null;

  useEffect(() => {
    if (session && session.endsAt && timeLeft === 0 && exercise) {
      setQi(session.exercises.length); // out of time — jump to the summary
    }
  }, [timeLeft, session, exercise]);

  if (ready && !account) {
    return (
      <div className={`at ${settings.theme || "auto"}`}>
        <React.Suspense fallback={<ChunkFallback />}>
          <Onboarding onDone={(a: any) => setAccount(a)} />
        </React.Suspense>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="at">
        <div className="at-wrap">

          <p className="at-eyebrow">Loading your items…</p>
        </div>
      </div>
    );
  }

  const theme = settings.theme || "auto";
  setSounds(settings.sounds);
  const inExercise = !!(session && exercise);
  const kbOpen = kb.open && inExercise;
  const undrillable = items.filter((it) => !isDrillable(it, settings)).length;
  /* Whether the quiet window is open, for the one message whose explanation
     changes while it is: a card can fall below the two-type minimum because
     its listening exercises are paused, and saying it is missing fields would
     send someone looking for a fault that isn't there. */
  const listenQuiet = listenOff > Date.now();

  return (
    <div
      className={`at ${theme}${inExercise ? " in-exercise" : ""}${kbOpen ? " kb-open" : ""}`}
      /* Every rule that lays out the language being learnt reads these two.
         Nothing set them, so the fallbacks applied and Vietnamese was laid
         out right-to-left, like Arabic. */
      /* Cast because these are custom properties: React's style type
         knows the CSS properties by name and nothing that starts --. */
      style={({
        "--sdir": qLang.direction || "ltr",
        "--sfont": qLang.fontStack,
        /* And how large that script wants to be against the sizes in the
           stylesheet, which were tuned against Arabic. */
        ...scriptVars(qLang),
        /* What the answer bar is lifted by. Set here rather than on the bar
           so the page can reserve the same room underneath its content. */
        "--kb-overlap": `${kb.overlap || 0}px`,
        ...(kbOpen && kb.height ? { minHeight: kb.height } : null),
      } as React.CSSProperties)}
    >
      {/* Everything below here can say something without being handed a
          callback to say it with — the teaching and admin screens above all,
          which had no way to confirm a save. */}
      <SnackbarProvider show={snack.show}>
      <div className="at-wrap">
          {/* The same tab strip the teaching and admin spaces use, rather than
              a floating bar of its own. */}
          {!inExercise && space === "learn" && (
            <Tabs
              tabs={[
                ["home", "Home", "school"],
                ["progress", "Progress", "verify"],
                ["items", "Cards", "cards"],
                ["courses", "Courses", "folder"],
              ]}
              value={tab}
              label="Part of the app"
              onChange={(k) => {
                setTab(k);
                if (k !== "home") setSession(null);
              }}
            />
          )}

        {/* ============ STUDY ============ */}
        {tab === "home" && (
          <>
            {items.length === 0 && (
              /* The same component the Progress and Cards tabs use for the
                 same situation. It was a hand-rolled block here, which is
                 how it came to say something different from both. */
              <Empty
                title="Nothing to practice yet"
                /* The invitation is for someone who has nowhere to get
                   cards from, and only once we know that. An enrolled
                   student is waiting on their teacher, not on a code, and
                   a button telling them otherwise is the whole reason this
                   read wrong. Courses is a tap away either way — the tab
                   strip above does not go anywhere. */
                action={
                  coursesKnown && myCourses.length === 0 ? (
                    <Button variant="primary" onClick={() => setTab("courses")} icon="school">
                      Join a course
                    </Button>
                  ) : null
                }
              >
                {noCardsYet(myCourses.length)}
              </Empty>
            )}

            {items.length > 0 && !session && (
              <>
                <div className="at-card">
                  <p className="at-eyebrow">
Cards ready to practice
                  </p>
                  <Stat value={readyCount} big />
                  <Help>
                    Each item gets {Math.max(2, settings.perItem)} different exercises where its
                    data allows, spread across the session.
                  </Help>

                  <div className="at-row">
                    {/* One language and the button starts a session, as it
                        always did. Two and it asks first: which pile this
                        is, or both at once. */}
                    <Button variant="primary"
                      onClick={() => (langChoices.length > 1 ? setPicking(true) : begin(false, ""))}
                      disabled={!readyCount}
                    >
                      Start session
                    </Button>
                  </div>
                  <div className="at-row at-mt3">
                    <Button variant="ghost"
                      onClick={() => setBuilding(true)}
                      disabled={!drillable.length}
                    >
                      Build a session
                    </Button>

                  </div>
                  {/* Only once there is one to open. A button that leads to
                      an empty screen is a promise the app has not kept, and
                      the way to find this is to save one, which the Build
                      screen offers where the session is finished. */}
                  {savedSessions.length > 0 && (
                    <div className="at-row at-mt3">
                      <Button variant="ghost" onClick={() => setShowingSaved(true)}>
                        Saved sessions
                      </Button>
                    </div>
                  )}

                  {!readyCount && drillable.length > 0 && (
                    <Help>{nextDueLine(drillable, settings)}</Help>
                  )}
                  {!drillable.length && items.length > 0 && (
                    <Notice kind="warn">
                      No card here has two usable exercise types. A card needs the{" "}
                      {langOf(settings).scriptLabel} and at least one more field
                      before it can be practiced.
                    </Notice>
                  )}
                  {undrillable > 0 && drillable.length > 0 && (
                    <Help>
                      {listenQuiet ? (
                        <>
                          {plural(undrillable, "item")} sitting out while listening is
                          off — see Items for anything missing a field.
                        </>
                      ) : (
                        <>
                          {plural(undrillable, "item")} sitting out — see Items for
                          which fields are missing.
                        </>
                      )}
                    </Help>
                  )}
                </div>
              </>
            )}

            {session && session.learnt && session.learnt.length > 0 && qi === 0 && (
              <Help className="at-learntnote">
                Already learnt, so not in this session:{" "}
                {session.learnt.map((x: Item) => x.en || x.ar || x.lat).join(", ")}
              </Help>
            )}

            {session && exercise && item && spec && (
              <>
                <div className="at-headline">
                  <button
                    className="at-exit"
                    aria-label="Leave session"
                    data-el="leave-session"
                    /* A trial has nothing to lose, so it does not ask.
                       The question was the whole of it, and a teacher who
                       has seen it is done. */
                    onClick={() => (session.trial ? endTrial() : setLeaving(true))}
                  >
                    <Icon name="close" />
                  </button>
                  {/* A trial is one question. "1 / 1" and a bar that can
                      only be empty or full are answering how far through
                      you are, which is a question nobody asked of a
                      single question — so the trial gets the way out and
                      nothing else. */}
                  {!session.trial && (
                    <>
                      <span className="at-count" data-el="session-count">
                        {timeLeft !== null
                          ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
                          : `${qi + 1} / ${session.exercises.length}`}
                      </span>
                      <div className="at-progress" data-el="session-progress">
                        <i
                          style={{
                            width: `${
                              session.endsAt && session.startedAt
                                ? Math.min(
                                    100,
                                    ((now() - session.startedAt) /
                                      (session.endsAt - session.startedAt)) *
                                      100
                                  )
                                : (qi / session.exercises.length) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Once the answer is up, the question and the box you typed
                    into step back so the answer holds the eye. */}
                {/* Every piece of this carries a data-el name. They are not
                    styling hooks and nothing reads them at runtime — they
                    exist so a change can be asked for by name ("make
                    question-prompt bigger") rather than by description, and
                    so a test can notice when one goes missing. Names
                    describe the role, not the wording, so rewriting a
                    sentence leaves its name alone.

                    Three names to a block, and only the first is always
                    there:

                      <name>        the block: what moves, and what
                                    spacing belongs on
                      <name>-label  the small line above it, where there
                                    is one
                      <name>-text   the words inside, where they are words

                    A block holding something other than words names it for
                    what it is instead — answer-box holds answer-input or
                    answer-choices, never an answer-box-text. The block is
                    named even where it holds one thing today, because what
                    it holds is exactly what varies: question-prompt is a
                    word, a blanked phrase or an audio player depending on
                    the exercise, and sizing that on the words would miss
                    two of the three. */}
                <div className="at-exercise" data-el="card">
                  <p className="at-instruction" data-el="question-instruction">
                    {spec.instruction}
                    {isSub && (
                      <span className="at-formtag" data-el="question-form-tag">
                        {" "}
                        · {labelFor(item)}
                      </span>
                    )}
                  </p>
                  <div className="at-ask" data-el="question-prompt">
                    {spec.promptField === "pairs" ? null : spec.promptField === "scene" ? (
                      /* The conversation is the question. How much of it is
                         shown is the difference between them: everything up
                         to your turn when you are choosing one, all of it
                         when you are meeting the scene or reading it
                         through. Putting one in order shows nothing here:
                         the scene is the thing being answered, and it is
                         down in the box with the answering in it. */
                      spec.answerMode === "order" ? null : (
                        <>
                          <Scene
                            card={dialog}
                            lang={qLang}
                            lines={whole ? linesOf(dialog) : soFar}
                            blankId={spec.answerMode === "choice" ? linesOf(dialog)[at || 0].id : null}
                            /* A read-through has the meanings beside the
                               words; reading one through for yourself has
                               whichever of them you asked for. Everywhere
                               else one of them is the answer. */
                            meanings={!!spec.intro || (whole && showMeaning)}
                            said={whole && showSaid}
                          />
                          {/* Taken when they are needed rather than given.
                              The script alone is the exercise; each of
                              these is the reader deciding they have got as
                              far as they can without it, which is a thing
                              worth doing rather than a failure. */}
                          {whole && !spec.intro && (
                            <div className="at-row at-reveals">
                              <Button
                                size="sm"
                                data-el="reveal-said"
                                onClick={() => setShowSaid((v) => !v)}
                              >
                                {showSaid ? "Hide" : "Show"} the {qLang.translitLabel.toLowerCase()}
                              </Button>
                              <Button
                                size="sm"
                                data-el="reveal-meaning"
                                onClick={() => setShowMeaning((v) => !v)}
                              >
                                {showMeaning ? "Hide" : "Show"} the meaning
                              </Button>
                            </div>
                          )}
                        </>
                      )
                    ) : spec.promptField === "audio" ? (
                      /* A context question plays the whole phrase, not the
                         word: hearing it in running speech is the exercise.
                         Everything else plays the card's own recording. */
                      <AudioPrompt
                        recs={context ? context.recs : item.recs}
                        autoPlay
                        lead={leadSpeed(item, exercise.type)}
                      />
                    ) : spec.promptField === "context" ? (
                      <Field
                        /* The phrase can go between building the queue and
                           reaching this question — the teacher unticks it,
                           or the deck is withdrawn. Asking for the word on
                           its own is a lesser question, not a broken one. */
                        value={context ? blankedPhrase(context, qLang) : item.en}
                        field={context ? "ar" : "en"}
                        kind="phrase"
                        name="question-prompt-text"
                      />
                    ) : (
                      <Field
                        value={item[spec.promptField]}
                        field={spec.promptField}
                        kind={item.kind}
                        name="question-prompt-text"
                      />
                    )}
                    {/* Which word is wanted. Always the word's own meaning,
                        never the phrase's: "close the door please" with a
                        gap in it has three defensible answers, and marking
                        two of them wrong would be the app's fault rather
                        than the learner's. What the phrase means is shown
                        once the answer is in. */}
                    {context && (
                      <p className="at-ctxmeaning" data-el="question-context-meaning">
                        {item.en}
                      </p>
                    )}
                  </div>

                  {hintOpen && item[spec.hintField] && (
                    <div className="at-hintvalue" data-el="hint-value">
                      <Field
                        value={item[spec.hintField]}
                        field={spec.hintField}
                        kind={item.kind}
                        name="hint-value-text"
                      />
                    </div>
                  )}

                  {/* Two className attributes stood here and React kept the
                      second, so the at-mt4 gap was silently dropped and the
                      answer box sat hard against the hint button above it. */}
                  <div className="at-answerbox at-mt4" data-el="answer-box">
                    {spec.answerMode === "read" ? null : spec.answerMode === "order" ? (
                      <SceneOrder
                        card={dialog}
                        lang={qLang}
                        value={typed}
                        disabled={!!checked}
                        onChange={setTyped}
                      />
                    ) : spec.answerMode === "self" ? (
                      /* Nobody else was in the room while they read it, so
                         the only honest marking is theirs. Two answers,
                         both of them true things a person might say. */
                      <div className="at-selfmark" data-el="answer-self">
                        {[SELF_ALL, SELF_SOME].map((answer) => (
                          <Button
                            key={answer}
                            variant={typed === answer ? "primary" : undefined}
                            disabled={!!checked}
                            onClick={() => setTyped(answer)}
                          >
                            {answer === SELF_ALL ? "Yes, all of it" : "Not all of it"}
                          </Button>
                        ))}
                      </div>
                    ) : spec.picks === "pair" ? (
                      <>
                        <MatchGrid
                          key={`${(item && item.id) || ""}-${qi}`}
                          words={grid.words}
                          meanings={grid.meanings}
                          lang={qLang}
                          askedId={(item && item.id) || ""}
                          checked={!!checked}
                          onChange={setTyped}
                          onPairs={setMatched}
                        />
                        {/* A grid half done is not an answer, and a Check
                            that sits dead without saying why is the button
                            people tap twice and then give up on. */}
                        {!checked && !typed && <Help>Pair them all, then check.</Help>}
                      </>
                    ) : spec.picks ? (
                      <TextChoices
                        options={choices}
                        kind={spec.picks === "word" ? "word" : "phrase"}
                        lang={qLang}
                        value={typed}
                        disabled={!!checked}
                        onChange={setTyped}
                      />
                    ) : spec.answerMode === "choice" ? (
                      <Segmented
                        size={null}
                        label="Your answer"
                        data-el="answer-choices"
                        disabled={!!checked}
                        options={((quizAttrOf(qLang) || {}).classes || []).map((c) => ({
                          value: c.id,
                          label: c.label,
                        }))}
                        value={typed}
                        onChange={setTyped}
                      />
                    ) : (
                      /* The wrapper is what reserves the corner for the keys
                         button, so it stays for the whole of an answer in
                         the script — including after checking, when the
                         button is gone. Dropping it there would slide the
                         answer sideways at the moment of the verdict. */
                      <div
                        className={
                          spec.answerMode === "ar"
                            ? `at-inputwrap${qLang.direction === "rtl" ? " rtl" : ""}`
                            : undefined
                        }
                      >
                        <input
                          ref={inputRef}
                          /* "ar" here means the language's own script, so the
                             input is declared as that language — not as Arabic,
                             which sent Vietnamese answers through an Arabic
                             spellchecker and read them out as Arabic. */
                          lang={spec.answerMode === "ar" ? qLang.id : undefined}
                          dir={spec.answerMode === "ar" ? qLang.direction : undefined}
                          className={`at-input${spec.answerMode === "ar" ? " ar" : ""}${
                            checked ? (checked.ok ? " ok" : " no") : ""
                          }`}
                          data-el="answer-input"
                          value={typed}
                          readOnly={!!checked}
                          placeholder={spec.placeholder}
                          onChange={(e) => setTyped(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !checked && typed.trim()) submit();
                          }}
                        />
                        {!checked && spec.answerMode === "ar" && (
                          /* Keeps the caret where it was: tapping the button
                             would otherwise blur the field first, and the
                             keys would insert at the end. */
                          <span onMouseDown={(e) => e.preventDefault()}>
                            <KeysButton on={keysOpen} onClick={() => setKeysOpen((v) => !v)} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!checked && spec.answerMode === "ar" && keysOpen && (
                    <Keyboard
                      lang={qLang}
                      onKey={(ch) => caretInsert(inputRef, typed, setTyped, ch)}
                      onBack={() => caretBackspace(inputRef, typed, setTyped)}
                      onClear={() => setTyped("")}
                      onHide={() => setKeysOpen(false)}
                    />
                  )}

                  {checked ? (
                    <>
                      <p
                        className={`at-shout ${verdictAlone ? "alone " : ""}${
                          checked.ok || overridden ? "ok" : skipped ? "skip" : "no"
                        }`}
                        data-el="verdict"
                      >
                        {checked.ok || overridden
                          ? praiseFor(tally.ok)
                          : skipped
                          ? SKIPPED_VERDICT
                          : spec.picks === "pair"
                          ? GRID_VERDICT
                          : WRONG_VERDICT}
                      </p>
                      {!skipped && !checked.ok && checked.reason !== "wrong" && (
                        <Help data-el="verdict-reason">{verdictText(checked, qLang)}</Help>
                      )}
                      {/* A right answer is already on screen in the box above,
                          so repeating it says nothing. It is shown when the
                          person got it wrong or asked to see it — and when
                          they were right but typed the word bare, where the
                          box above holds their own unmarked spelling and the
                          nudge under it would otherwise point at nothing. */}
                      {answerRepeated && (
                        <div className="at-answermain" data-el="answer-value">
                          {spec.answerMode === "order" ? (
                            /* The conversation as it was written, numbered,
                               because "wrong order" is only useful next to
                               the right one. */
                            <Scene
                              card={dialog}
                              lang={qLang}
                              lines={linesOf(dialog)}
                              numbers={Object.fromEntries(
                                linesOf(dialog).map((l, i) => [l.id, i + 1])
                              )}
                              meanings
                            />
                          ) : (
                            <Field
                              value={item[spec.answerField]}
                              field={spec.answerField}
                              kind={item.kind}
                              name="answer-value-text"
                            />
                          )}
                        </div>
                      )}
                      {/* Which of the accepted answers they wrote, where the
                          card accepts more than one and they differ in
                          something the language names. A card taking both
                          the masculine and the feminine used to answer
                          "correct" and leave which one they had written
                          unsaid — and before this the card could not have
                          told them, because the grammar was one label over
                          the pair. */}
                      {gaveLabel && (
                        <Help data-el="answer-grammar">
                          {`You wrote the ${gaveLabel} one.`}
                        </Help>
                      )}
                      {/* Directly under the marked spelling it is talking
                          about. It sat below the Learn more box, which put
                          the box between the nudge and the thing to look
                          at. */}
                      {checked.reason === "bare" && (
                        <Help data-el="bare-note">{verdictWord(qLang, "bare")}</Help>
                      )}

                      {/* Everything after the answer is a second thing worth
                          noticing, so each says what it is, they are set
                          smaller, and they are kept together in one box
                          rather than trailing down the page. */}
                      <AlsoBox open={alsoOpen} onToggle={() => setAlsoOpen((v) => !v)}>
                        {/* What the phrase it appeared in means. Held back
                            until now: before the answer it would have given
                            the game away, and after it is the reason the
                            question was worth asking. */}
                        {(context || alsoContext) && (
                          <div className="at-answeralso" data-el="also-context">
                            <p className="at-alsolabel" data-el="also-context-label">
                              Where it turned up
                            </p>
                            <Field
                              value={(context || alsoContext).ar}
                              field="ar"
                              kind="phrase"
                              name="also-context-text"
                            />
                            <p className="at-ctxmeaning" data-el="also-context-meaning">
                              {(context || alsoContext).en}
                            </p>
                          </div>
                        )}
                        {spec.promptField === "audio" && spec.answerField !== "ar" && item.ar && (
                          <div className="at-answeralso" data-el="also-script">
                            <p className="at-alsolabel" data-el="also-script-label">
                              This is how it's written
                            </p>
                            <Field value={item.ar} field="ar" kind={item.kind} name="also-script-text" />
                          </div>
                        )}
                        {item[spec.hintField] && (
                          <div className="at-answeralso" data-el="also-hint">
                            <p className="at-alsolabel" data-el="also-hint-label">
                              {spec.hintField === "lat"
                                ? "This is how it's pronounced"
                                : spec.hintField === "ar"
                                ? "This is how it's written"
                                : "This is what it means"}
                            </p>
                            <Field
                              value={item[spec.hintField]}
                              field={spec.hintField}
                              kind={item.kind}
                              name="also-hint-text"
                            />
                          </div>
                        )}
                        {/* Was below the notes, which put it three blocks
                            away from its own siblings. It belongs with
                            them. */}
                        {spec.promptField !== "audio" && (item.recs || []).length > 0 && (
                          <div className="at-answeralso" data-el="also-audio">
                            <p className="at-alsolabel" data-el="also-audio-label">
                              This is how it sounds
                            </p>
                            <AudioPrompt recs={item.recs} lead={leadSpeed(item)} />
                          </div>
                        )}
                        {/* Asked here rather than inside RelatedWords: an
                            element that renders null is still an element,
                            and the box counts what it was given. */}
                        {pairs && pairs.length > 0 && (
                          <RelatedWords pairs={pairs} settings={qSettings} />
                        )}
                      </AlsoBox>
                      {item.note && (
                        <p className="at-note" data-el="card-note">
                          {item.note}
                        </p>
                      )}
                      <AfterAnswer
                        ok={checked.ok}
                        overridden={overridden}
                        flagged={flaggedNow}
                        onOverride={() => setOverridden(true)}
                        onFlag={flagCurrent}
                        onContinue={applyGrade}
                      />
                    </>
                  ) : (
                    <>
                      <StickyFoot
                        className="quiet"
                        /* The way out of a question you cannot hear sits
                           where the way to report a bad one sits on the
                           next screen: plain text, one step above the bar.
                           It used to be a bordered button in the middle of
                           the page, which read as a fourth thing to do
                           with the question rather than a way past it. */
                        above={
                          isListening(exercise.type) && !checked ? (
                            <button
                              type="button"
                              className="at-quietbtn"
                              data-el="quiet-button"
                              onClick={goQuiet}
                            >
                              <Icon name="soundOff" size={16} />
                              Can't listen right now
                            </button>
                          ) : null
                        }
                      >
                        {/* The nudge sits with the other two ways out of a
                            question rather than floating above the answer
                            box, and carries only its icon: the label said
                            which field it reveals, which the revealed field
                            says for itself a moment later. The name is
                            still there for anyone using a screen reader. */}
                        {item[spec.hintField] && (
                          /* Stays after revealing, so the nudge can be put
                             away again — reading the answer with the hint
                             still on the screen is not the same test. */
                          <IconButton
                            icon="help"
                            /* Ghost, like the "I don't know" beside it: the
                               two are the same kind of thing — a way of not
                               answering yet — and a filled button next to a
                               ghost one read as the louder of the pair. */
                            ghost
                            label={hintOpen ? spec.hintHideLabel : spec.hintLabel}
                            className={`at-hintbtn${hintOpen ? " on" : ""}`}
                            data-el="hint-button"
                            aria-pressed={hintOpen}
                            onClick={() => setHintOpen((v) => !v)}
                          />
                        )}
                        {!spec.intro && (
                          <Button variant="ghost" data-el="dont-know-button" onClick={giveUp}>
                            I don't know
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          data-el="check-button"
                          disabled={!spec.intro && !typed.trim()}
                          onClick={spec.intro ? metScene : submit}
                        >
                          {spec.intro ? "I've read it" : "Check"}
                        </Button>
                      </StickyFoot>
                    </>
                  )}
                </div>


              </>
            )}

            {/* A trial never reaches here: answering its one question
                puts the teacher back on the card it was about, which is
                where they were going anyway. There is no score to show
                them and no schedule to report on, so the screen that used
                to say as much was a tap between the answer and the card. */}
            {session && !exercise && (
              <div className="at-card">
                <p className="at-eyebrow">{practice ? "Practice done" : "Session complete"}</p>
                <Stat value={`${tally.ok} / ${tally.ok + tally.no}`} big />
                <Help>
                  {practice
                    ? "Your schedule is untouched, apart from anything marked Again."
                    : tally.no === 0
                    ? "Clean run. Every gap just got longer."
                    : `${tally.no} lapsed and will come back shortly.`}
                </Help>
                <div className="at-row">
                  <Button variant="ghost" onClick={() => setSession(null)}>
                    Done
                  </Button>
                  {readyCount > 0 && !session.manual && (
                    <Button variant="primary" onClick={() => begin(false)}>
                      Keep going
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ============ ITEMS ============ */}
        {tab === "items" && (
          <ItemsTab
            items={items}
            allTags={allTags}
            data={data}
            settings={settings}
            courseDecks={courseDecks}
            myCourses={myCourses}
            deckWanted={deckWanted}
            onDeckWantedUsed={() => setDeckWanted(null)}
            onExportAll={exportEverything}
            onAdd={addItems}
            onUpdate={updateItem}
            onRemove={(id) => removeItems([id])}
            onRemoveMany={removeItems}
            onBulkEdit={bulkEdit}
            onSetLocked={setLockedMany}
            onTagMany={tagMany}
            onImport={importFile}
          />
        )}

        {/* ============ PROGRESS ============ */}
        {tab === "progress" && (
          <ProgressTab
            data={data}
            items={items}
            myCourses={myCourses}
            settings={settings}
            onPractice={(ids, mode) =>
              beginManual({ ids, mode, count: settings.sessionSize })
            }
          />
        )}

        {/* ============ SETTINGS ============ */}

        {building && (
          <ManualSessionSheet
            items={items}
            allTags={allTags}
            settings={settings}
            onStart={beginManual}
            onSave={keepSession}
            onClose={() => setBuilding(false)}
          />
        )}

        {showingSaved && (
          <SavedSessionsSheet
            sessions={savedSessions}
            items={items}
            onStart={(s) => {
              setShowingSaved(false);
              beginManual({ ids: s.ids, mode: s.mode, count: s.count, minutes: s.minutes });
            }}
            onDelete={dropSession}
            onClose={() => setShowingSaved(false)}
          />
        )}

        {picking && (
          <SessionLanguages
            choices={langChoices}
            ready={readyCount}
            chosen={sessionLang}
            onPick={(id) => {
              setPicking(false);
              begin(false, id);
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {tab === "courses" && (
          <React.Suspense fallback={<ChunkFallback />}>
          <StudentCourses
            courses={myCourses}
            decks={courseDecks}
            languages={LANGUAGES}
            busy={courseBusy}
            error={courseError}
            onJoin={async (code: string) => {
              await API.joinCourse(code);
              await refreshCourses(true);
            }}
            onRefresh={() => refreshCourses(true)}
            onPractise={(deckTitle: string) => {
              /* The cards tab owns its own filter, so ask for it by name and
                 let that tab apply it when it mounts. */
              setDeckWanted(deckTitle);
              setTab("items");
              flash(`${deckTitle} — showing just this deck`);
            }}
          />
          </React.Suspense>
        )}

        {space === "teach" && account && (
          <React.Suspense fallback={<ChunkFallback />}>
            <TeachSpace
              account={account}
              languages={LANGUAGES}
              settings={settings}
              onTry={tryExercise}
              /* Read once, as this mounts. Cleared on the way out so that
                 opening Teaching again tomorrow is opening Teaching, not
                 reopening whatever was last tried. */
              resume={trialBack}
              onClose={() => {
                setTrialBack(null);
                setSpace("learn");
              }}
            />
          </React.Suspense>
        )}

        {space === "admin" && account && account.admin && (
          <React.Suspense fallback={<ChunkFallback />}>
            <AdminSpace
              account={account}
              languages={LANGUAGES}
              onClose={() => setSpace("learn")}
            />
          </React.Suspense>
        )}

        {leaving && (
          <ConfirmModal
            title="Leave this session?"
            confirmLabel="Leave"
            danger={false}
            body={<p>Answers so far are already saved.</p>}
            onCancel={() => setLeaving(false)}
            onConfirm={() => {
              setLeaving(false);
              setSession(null);
            }}
          />
        )}

        {screen && (
          <SettingsScreen
            kind={screen}
            onClose={() => setScreen(null)}
            settings={settings}
            setSetting={setSetting}
            toggleIn={toggleIn}
            onReset={resetScheduling}
            allClipIds={allClipIds}
            /* Signed out, the account screen is still reachable and still
               has to render. What it shows is nobody, not a half-account. */
            account={account || EMPTY_ACCOUNT}
            isAdmin={!!(account && account.admin)}
            onOpenAdmin={() => {
              setScreen(null);
              setSpace("admin");
            }}
            onCloseAccount={() => {
              setAccount(null);
              setSpace("learn");
              setScreen(null);
            }}
            onLogOut={() => {
              API.clearAccount();
              setAccount(null);
              setSpace("learn");
              setScreen(null);
              setTab("home");
              setMyCourses([]);
              setCourseDecks([]);
              setTeaches(false);
              saveTeaches(false);
            }}
            onBecameAdmin={() =>
              account &&
              API.whoAmI(account.key).then((r) => {
                const merged = { ...r.user, key: account.key };
                API.saveAccount(merged);
                setAccount(merged);
                flash("You are now the administrator");
              })
            }
            onRename={(name: string) => {
              if (!account) return;
              API.rename(name).catch(() => {});
              const merged = { ...account, displayName: name };
              API.saveAccount(merged);
              setAccount(merged);
            }}
          />
        )}

        {saveFailed && <p className="at-toast">Couldn't save — your last answer may not stick</p>}
      </div>

      {lastDeleted && lastDeleted.length > 0 && (
        <div className="at-undo">
          <span className="what">
            {lastDeleted.length === 1
              ? `Deleted “${lastDeleted[0].en || lastDeleted[0].ar || lastDeleted[0].lat}”`
              : `Deleted ${lastDeleted.length} items`}
          </span>
          <Button size="sm" onClick={undoDelete}>
            Undo
          </Button>
        </div>
      )}


      {/* The three things that float above the app. They appear and vanish
          together, so they are decided in one place rather than three. */}
      {!inExercise && (
        <>
          <div className="at-brand">Taleb33</div>
          <SpaceSwitch
            space={space}
            spaces={["learn"]
              .concat(teaches || (account && account.admin) ? ["teach"] : [])
              .concat(account && account.admin ? ["admin"] : [])}
            /* Choosing a space is arriving at it, not resuming it: the
               card a trial was asked about is reopened on the way back
               from that one question and nowhere else. */
            onSpace={(to: string) => {
              setTrialBack(null);
              setSpace(to);
            }}
          />
          <CornerMenu
            account={account}
            /* The dot stands for the whole action, so it stays lit until
               every part of it is done — this device's cards, the courses,
               and the spaces this person belongs to. */
            syncState={
              spacesBusy || (syncState === "idle" && courseBusy) ? "syncing" : syncState
            }
            onSyncNow={syncEverything}
            theme={settings.theme || "auto"}
            onTheme={(v) => setSetting("theme", v)}
            onAccount={() => setScreen("account")}
            onGuide={() => setScreen("guide")}
            onPrefs={() => setScreen("prefs")}
          />
        </>
      )}

      {snack.node}
      </SnackbarProvider>
    </div>
  );
}

/* --- CardScreen ---------------------------------------------------
   One card, opened. The learner gets here by tapping a tile — in the
   Cards tab, or in Progress — and a card has to be described the same
   way whichever tile was tapped, so there is one of these rather than
   one per tab. The card is looked up again by id, so a screen left open
   shows what was last synced rather than the copy its tile was drawn
   from. */
function CardScreen({ card, items, onBack, action }: {
  card: Item;
  items: Item[];
  onBack: () => void;
  action?: Node;
}) {
  const live = items.find((i) => i.id === card.id) || card;
  return (
    <Screen title={live.en || live.ar} onBack={onBack} action={action}>
      <CardReadout
        card={{
          ...live,
          clips: (live.recs || []).map((r) => r.id),
          /* A line's recordings, named the way the readout names them.
             The learner's copy of a card keeps recordings under `recs`
             and the teacher's under `clips`; this is the one place the
             two shapes meet. */
          lines: linesOf(live).map((l) => ({
            ...l,
            clips: (l.recs || []).map((r: { id: string }) => r.id),
          })),
        }}
        lang={activeLang()}
        /* Which decks a card arrived in is a teacher's question about their
           own material. The student is looking at the card itself, so the
           readout stops at the card and there are no decks to name. */
        decks={[]}
        whereItLives={false}
      />

    </Screen>
  );
}

/* ==================================================================
   Items tab
   ================================================================== */


function ItemsTab({
  items,
  allTags,
  data,
  settings,
  courseDecks,
  myCourses = [],
  deckWanted,
  onDeckWantedUsed,
  onExportAll,
  onAdd,
  onUpdate,
  onRemove,
  onRemoveMany,
  onBulkEdit,
  onSetLocked,
  onTagMany,
  onImport,
}: {
  items: Item[];
  allTags: string[];
  data: any;
  settings: Settings;
  courseDecks?: Deck[];
  myCourses?: Course[];
  deckWanted?: string | null;
  onDeckWantedUsed: () => void;
  onExportAll: () => void;
  onAdd: (items: any[]) => void;
  onUpdate: (id: string, patch: any) => void;
  onRemove: (id: string) => void;
  onRemoveMany: (ids: string[]) => void;
  onBulkEdit: (ids: string[], patch: any) => void;
  onSetLocked: (ids: string[], locked: boolean) => void;
  onTagMany: (ids: string[], tag: string) => void;
  onImport: (file: any) => void;
}) {
  const [sheet, setSheet] = useState<any | null>(null); // null | "single" | "bulk" | {edit:item}
  const [q, setQ] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);

  /* Someone tapped "practice" on a deck elsewhere; show just that deck. */
  useEffect(() => {
    if (!deckWanted) return;
    setFilterTags([deckWanted]);
    setQ("");
    if (onDeckWantedUsed) onDeckWantedUsed();
  }, [deckWanted, onDeckWantedUsed]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<any | null>(null);

  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 6000);
    return () => clearTimeout(t);
  }, [confirmId]);

  /* Escape and the body-scroll lock belong to Screen, which every sheet
     here now goes through. Doing it again from the tab meant two owners for
     one lock and two handlers for one key. */

  /* Tag filtering happens before the list sees the cards; the list does the
     text search itself. */
  const byTag = useMemo(
    () =>
      items
        .filter((i) => (filterTags.length ? i.tags.some((t) => filterTags.includes(t)) : true))
        .slice()
        .sort((a, b) => b.created - a.created),
    [items, filterTags]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((i) => (filterTags.length ? i.tags.some((t) => filterTags.includes(t)) : true))
      .filter((i) =>
        s
          ? i.ar.includes(q.trim()) ||
            i.lat.toLowerCase().includes(s) ||
            i.en.toLowerCase().includes(s) ||
            i.tags.some((t) => t.toLowerCase().includes(s)) ||
            (i.subs || []).some(
              (x) => x.ar.includes(q.trim()) || x.en.toLowerCase().includes(s)
            )
          : true
      )
      .slice()
      .sort((a, b) => b.created - a.created);
  }, [items, q, filterTags]);

  /* Course cards are not a student's to change, so a selection offers
     nothing destructive. With OWN_CARDS off there is nothing at all, and the
     list hides the whole selection mode by itself. */
  const bulkActions = useMemo(
    () =>
      OWN
        ? [
            { label: "Lock", onClick: (ids: string[]) => onSetLocked(ids, true) },
            { label: "Unlock", onClick: (ids: string[]) => onSetLocked(ids, false) },
            { label: "Add a tag", onClick: (ids: string[]) => setBulk({ kind: "tag", ids, tag: "" }) },
            { label: "Delete", danger: true, onClick: (ids: string[]) => setBulk({ kind: "delete", ids }) },
          ]
        : [],
    [onSetLocked]
  );

  /* Both used to be a browser prompt and a browser confirm — the only two
     places in the app that left it to the browser to ask. */
  const [bulk, setBulk] = useState<any | null>(null);

  return (
    <>
      <Help className="at-mb3">
        Cards come from the courses you're in. Your teacher looks after them.
      </Help>

      {items.length === 0 ? (
        <Empty title="Nothing here yet">{noCardsYet(myCourses.length)}</Empty>
      ) : (
        <>
          <ItemList
            noun="card"
            items={byTag}
            itemKey={(it) => it.id}
            size="small"
            busy={false}
            onNew={OWN ? () => setSheet("single") : undefined}
            filters={
              OWN ? (
                <div className="at-row at-mt2">
                  <Button variant="ghost" size="sm" onClick={() => setSheet("dialog")} icon="add">
                    Add a conversation
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSheet("bulk")}
          icon="add"
        >
          Add several at once
        </Button>
                  <Button variant="ghost" size="sm" onClick={onExportAll} icon="download">Export everything</Button>
                </div>
              ) : null
            }
            empty="No cards match."
            match={(it, needle) =>
              it.ar.includes(needle) ||
              it.lat.toLowerCase().includes(needle) ||
              it.en.toLowerCase().includes(needle) ||
              it.tags.some((t) => t.toLowerCase().includes(needle)) ||
              (it.subs || []).some(
                (x) => x.ar.includes(needle) || x.en.toLowerCase().includes(needle)
              )
            }
            count={
              filtered.length === items.length
                ? `${plural(items.length, "card")}`
                : `${filtered.length} of ${items.length}`
            }
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={bulkActions}
            /* The library's tile, not a copy of it. This screen had its own
               hand-written version, which is how the student's card and the
               teacher's came to show different things. Tap to see the whole
               card; there is nothing to edit here. */
            renderItem={(it) => (
              <CardTile
                card={it}
                lang={activeLang()}
                meta={
                  isDialog(it)
                    ? `${plural(linesOf(it).length, "line")} · ${shortDate(it.created)}`
                    : shortDate(it.created)
                }
                onClick={() => setSheet({ view: it })}
              />
            )}
          />

          {/* Exporting lives in the admin space now: a student's cards belong
              to their courses, not to them, so there is nothing here that is
              theirs to take away. */}
        </>
      )}

      {OWN && (sheet === "single" || sheet === "dialog") && (
        <OWN.ItemSheet
          mode="add"
          scene={sheet === "dialog"}
          items={items}
          allTags={allTags}
          settings={settings}
          onSave={(drafts) => onAdd(drafts)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet.view && (
        <CardScreen
          card={sheet.view}
          items={items}
          onBack={() => setSheet(null)}
          action={
            OWN && !sheet.view.locked ? (
              <Button size="sm"
                onClick={() => setSheet({ edit: items.find((i) => i.id === sheet.view.id) || sheet.view })}
              >
                Edit
              </Button>
            ) : null
          }
        />
      )}
      {OWN && sheet && sheet.edit && (
        <OWN.ItemSheet
          mode="edit"
          initial={sheet.edit}
          scene={isDialog(sheet.edit)}
          items={items}
          allTags={allTags}
          settings={settings}
          onSave={(drafts) => onUpdate(sheet.edit.id, drafts[0])}
          onClose={() => setSheet(null)}
        />
      )}
      {bulk && bulk.kind === "delete" && (
        <ConfirmModal
          title={`Delete ${plural(bulk.ids.length, "card")}?`}
          confirmLabel="Delete them"
          body={<p>Locked cards are kept. This can't be undone.</p>}
          onCancel={() => setBulk(null)}
          onConfirm={() => {
            onRemoveMany(bulk.ids);
            setBulk(null);
          }}
        />
      )}

      {bulk && bulk.kind === "tag" && (
        <Screen title={`Tag ${plural(bulk.ids.length, "card")}`} onBack={() => setBulk(null)}>
          <FormField label="Tag to add" hint="Cards can carry several tags.">
            <input
              className="at-input"
              value={bulk.tag}
              autoFocus
              onChange={(e) => setBulk({ ...bulk, tag: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && bulk.tag.trim()) {
                  onTagMany(bulk.ids, bulk.tag.trim());
                  setBulk(null);
                }
              }}
            />
          </FormField>
          <div className="at-row">
            <Button
              variant="primary"
              disabled={!bulk.tag.trim()}
              onClick={() => {
                onTagMany(bulk.ids, bulk.tag.trim());
                setBulk(null);
              }}
            >
              Add the tag
            </Button>
          </div>
        </Screen>
      )}

      {OWN && sheet === "bulk" && (
        <OWN.BulkAddSheet
          allTags={allTags}
          onAdd={onAdd}
          onImport={onImport}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------
   Bulk action bar
   ------------------------------------------------------------------ */


/* ------------------------------------------------------------------
   Full-screen: add or edit one item, with its other forms
   ------------------------------------------------------------------ */

/* Label, RTL input, and an on-screen keyboard that only appears while the
   field is focused — otherwise it dominates every form it sits in.
   preventDefault on mousedown keeps focus when a key is tapped. */
function ArabicField({ label, hint, value, onChange, mode, placeholder, inputRef, lang }: {
  label?: Node;
  hint?: Node;
  value: string;
  onChange: (value: string) => void;
  mode?: string;
  placeholder?: string;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  lang?: Lang;
}) {
  /* The field already reads the active language for the input's own script
     and direction. The keyboard needs a pack too, and two of the three call
     sites pass none — which used to hand `undefined` to a component that
     reads its rows off it, the moment someone opened the keys. */
  const L = lang || activeLang();
  const own: React.MutableRefObject<any | null> = useRef(null);
  const ref = inputRef || own;
  const [focused, setFocused] = useState(false);
  const [keysOpen, setKeysOpen] = useKeysOpen(mode);

  return (
    <div className="at-field">
      {label && <label className="at-label">{label}</label>}
      <div className={`at-inputwrap${activeLang().direction === "rtl" ? " rtl" : ""}`}>
        <input
          ref={ref}
          lang={activeLang().id}
          dir={activeLang().direction}
          className="at-input ar"
          value={value}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span onMouseDown={(e) => e.preventDefault()}>
          <KeysButton on={keysOpen} onClick={() => setKeysOpen((v) => !v)} />
        </span>
      </div>
      {focused && keysOpen && (
        <div onMouseDown={(e) => e.preventDefault()}>
          <Keyboard
            onKey={(ch) => caretInsert(ref, value, onChange, ch)}
            onBack={() => caretBackspace(ref, value, onChange)}
            onClear={() => onChange("")}
            onHide={() => setKeysOpen(false)}
            lang={L}
          />
        </div>
      )}
      {hint && !focused && <Help>{hint}</Help>}
    </div>
  );
}

/* ------------------------------------------------------------------
   Recordings editor — one per unit, several clips each
   ------------------------------------------------------------------ */

function ClipPlayer({ rec, onPlay }: { rec: any; onPlay: (rec: any) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="at-clipplay"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onPlay(rec);
        setBusy(false);
      }}
      title="Play"
    >
      <Icon name="play" />
    </button>
  );
}

function RecordingsField({ recs, onChange, label = "Recordings" }: {
  recs?: any[];
  onChange: (recs: any[]) => void;
  label?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const handle: React.MutableRefObject<ReturnType<typeof startRecorder> | null> = useRef(null);
  const started = useRef(0);
  const tick: React.MutableRefObject<ReturnType<typeof setInterval> | null> = useRef(null);
  const audioRef: React.MutableRefObject<HTMLAudioElement | null> = useRef(null);

  useEffect(() => () => {
    if (handle.current) handle.current.stop();
  }, []);

  const urlRef = useRef("");
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function play(rec: { id: string }) {
    const url = await clipUrl(rec.id);
    if (!url) {
      setError("That clip isn't on this device yet");
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    audioRef.current.src = url;
    try {
      await audioRef.current.play();
    } catch (e) {
      setError("Couldn't play that clip");
    }
  }

  function begin() {
    setError("");
    if (!canRecord()) {
      setError("This browser won't let the app use the microphone");
      return;
    }
    started.current = now();
    setElapsed(0);
    setRecording(true);
    sfx("record");
    tick.current = setInterval(() => setElapsed(now() - started.current), 200);

    handle.current = startRecorder(
      async (blob) => {
        if (tick.current) clearInterval(tick.current);
        setRecording(false);
        const dur = (now() - started.current) / 1000;
        if (blob.size > MAX_CLIP_BYTES) {
          setError(`That clip is ${formatBytes(blob.size)} — too big to sync. Keep it shorter.`);
          return;
        }
        const id = newRecId();
        if (!(await saveClipBlob(id, blob))) {
          setError("Couldn't save that clip");
          return;
        }
        onChange(
          (recs || []).concat([
            { id, label: "", mime: blob.type, size: blob.size, dur: Math.round(dur * 10) / 10, added: now() },
          ])
        );
      },
      (err) => {
        if (tick.current) clearInterval(tick.current);
        setRecording(false);
        setError(
          (err instanceof Error ? err.name : "") === "NotAllowedError"
            ? "Microphone permission was refused"
            : "Couldn't reach the microphone"
        );
      }
    );

    // Hard stop, so a forgotten recording can't run away.
    setTimeout(() => {
      if (handle.current) handle.current.stop();
    }, MAX_RECORD_MS);
  }

  function end() {
    sfx("stop");
    if (handle.current) handle.current.stop();
  }

  async function upload(file: File) {
    setError("");
    setWorking("Compressing…");
    try {
      const { blob, mime, dur } = await compressAudio(file);
      if (blob.size > MAX_CLIP_BYTES) {
        setError(
          `Still ${formatBytes(blob.size)} after compressing — too big to sync. Try a shorter clip.`
        );
        return;
      }
      const id = newRecId();
      if (!(await saveClipBlob(id, blob))) {
        setError("Couldn't save that clip");
        return;
      }
      onChange(
        (recs || []).concat([
          {
            id,
            label: file.name.replace(/\.[^.]+$/, "").slice(0, 24),
            mime: mime || blob.type,
            size: blob.size,
            dur: dur ? Math.round(dur * 10) / 10 : 0,
            added: now(),
          },
        ])
      );
    } catch (e) {
      setError("Couldn't read that file");
    } finally {
      setWorking("");
    }
  }

  const list = recs || [];

  return (
    <FormField label={<>{label} <span className="at-optional">— optional, several allowed</span></>}>

      {list.length > 0 && (
        <div className="at-cliplist">
          {list.map((rec, i) => (
            <div className="at-clip" key={rec.id}>
              <ClipPlayer rec={rec} onPlay={play} />
              <input
                className="at-clipname"
                value={rec.label}
                placeholder={`Voice ${i + 1}`}
                onChange={(e) => {
                  const next = list.slice();
                  next[i] = { ...rec, label: e.target.value.slice(0, 24) };
                  onChange(next);
                }}
              />
              <span className="at-clipmeta">
                {rec.dur ? `${rec.dur}s` : ""} {formatBytes(rec.size)}
              </span>
              <button
                className="at-x"
                aria-label="Delete recording"
                onClick={() => {
                  dropClip(rec.id);
                  onChange(list.filter((x) => x.id !== rec.id));
                }}
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="at-chips" style={{ marginTop: list.length ? 10 : 0 }}>
        {recording ? (
          <Button variant="danger" size="sm" onClick={end} icon="pause">Stop — {(elapsed / 1000).toFixed(1)}s</Button>
        ) : (
          <Button size="sm" onClick={begin} disabled={!!working} icon="mic">Record</Button>
        )}
        <label className="at-btn sm ghost">
          {working || "Upload a file"}
          <input
            type="file"
            accept="audio/*"
            className="at-hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <Notice kind="error">{error}</Notice>
      {!error && list.length === 0 && (
        <Help>
          A recording unlocks two more exercises for this form — hearing it and writing the
          English, or hearing it and writing the script. Several voices are better than one.
        </Help>
      )}
    </FormField>
  );
}

/* An empty form, with whatever values the languages declare, from the one
   place that knows them. */
const BLANK_SUB = { ar: "", lat: "", en: "", ...dimValues({}), note: "", recs: [] };
/* A turn nobody has written yet. No grammar on it: a line of a dialog is
   a thing somebody says, and whether it is singular or plural is a
   question about a word. */
const BLANK_LINE = { ar: "", lat: "", en: "", who: 0, uses: [], recs: [] };

/**
 * @param props  `scene` writes a conversation rather than a word; `items` is what
 *   the learner already has, for finding which of their words a line uses.
 */
function ItemSheet({ mode, initial, allTags, settings, onSave, onClose, scene = false, items = [] }: {
  mode?: string;
  initial?: any;
  allTags: string[];
  settings: Settings;
  onSave: (item: any) => void;
  onClose: () => void;
  scene?: boolean;
  items?: Item[];
}) {
  const lang = langOf(settings);
  /* Held once: only some languages declare a lexical axis, and reading it
     off the pack at each use makes every one of them a separate question
     about whether this language has one. */
  const lexical = lang.lexical;
  /* Open, because the grammatical fields dimValues() spreads in differ per
     language and the tags are one editable string here, not a list. */
  const blank = (): Record<string, any> => ({
    ar: "",
    lat: "",
    en: "",
    recs: [],
    ...dimValues({}),
    kind: "",
    note: "",
    tags: "",
    subs: [],
    /* A conversation starts as two people and two empty turns: an empty
       scene with an "add a line" button is a form that has to be
       assembled before it can be filled in. */
    ...(scene
      ? {
          speakers: DEFAULT_SPEAKERS.slice(),
          /* Nobody's part, until somebody says so. */
          you: null,
          lines: [{ ...BLANK_LINE, who: 0 }, { ...BLANK_LINE, who: 1 }],
        }
      : null),
  });

  const [draft, setDraft] = useState(() =>
    initial
      ? {
          ar: initial.ar,
          lat: initial.lat,
          en: initial.en,
          recs: initial.recs || [],
          ...dimValues(initial),
          kind: initial.kind || "",
          note: initial.note || "",
          tags: (initial.tags || []).join(", "),
          subs: (initial.subs || []).map((x: Record<string, any>) => ({ ...x })),
          ...(scene
            ? {
                speakers: speakersOf(initial),
                you: namedPart(initial),
                lines: linesOf(initial).map((x: Record<string, any>) => ({ ...x })),
              }
            : null),
        }
      : blank()
  );
  const [step, setStep] = useState("form");
  // In add mode you can stack up several items and check them together.
  const [queue, setQueue] = useState<any[]>([]);
  // When set, the form is editing that queued item rather than adding a new one.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const arRef: React.MutableRefObject<HTMLInputElement | null> = useRef(null);

  const set = (k: string, v: any) =>
    setDraft((d) => ({ ...d, [k]: v }));
  /* A conversation needs two turns before it is one. One line with a
     reply missing is a phrase card that has been put in the wrong
     editor. */
  const written = scene ? (draft.lines || []).filter((l: any) => l.ar.trim()) : [];
  const canSave = scene ? written.length >= 2 : [draft.ar, draft.lat, draft.en].some((v) => v.trim());

  /* The words this learner already has, for the links below. Dialogs are
     left out: a scene is not a word that turns up inside another one. */
  const wordCards = useMemo(
    () => items.filter((i: Item) => !isDialog(i) && i.ar),
    [items]
  );
  /*
   * Which of those words a line uses, found rather than ticked.
   *
   * The app already knows how to find a word inside a run of words — it is
   * what puts a phrase behind the gap-fill — so asking somebody writing a
   * scene to also tick off its vocabulary would be asking them to do by
   * hand what the matcher does better. What it finds is shown under the
   * conversation, so it can be seen to be right.
   */
  const usesIn = (text: string) =>
    wordCards.filter((w: Item) => !!findWordSpan(text, w.ar, lang));

  const linked = (lines: any[]) =>
    lines
      .filter((l) => l.ar.trim())
      .map((l) => ({ ...l, uses: usesIn(l.ar).map((w) => w.id) }));

  const previewItem = useMemo(
    () => makeItem(scene ? { ...draft, lines: linked(draft.lines || []) } : draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, wordCards]
  );
  const previewUnits = unitsOf(previewItem);
  /* What the whole card will be drilled as: the scene's own exercises and
     every line's, gathered, because a dialog's exercises are spread across
     its units rather than sitting on the card. */
  const previewTypes = useMemo(() => {
    if (!scene) return availableTypes(previewItem);
    const found = new Set(availableTypes(previewItem, lang, null));
    linesOf(previewItem).forEach((ln, at) => {
      for (const t of availableTypes(ln, lang, { card: previewItem, at })) found.add(t);
    });
    return TYPES.filter((t) => found.has(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewItem]);
  // What review will show: everything queued, plus whatever is in the form.
  const pending = useMemo(
    () => (canSave ? queue.concat([draft]) : queue).map((d) => makeItem(d)),
    [queue, draft, canSave]
  );

  function setSub(i: number, k: string, v: any) {
    setDraft((d) => {
      const subs = d.subs.slice();
      subs[i] = { ...subs[i], [k]: v };
      return { ...d, subs };
    });
  }

  /* The same, for a turn in a conversation. */
  function setLine(i: number, k: string, v: any) {
    setDraft((d) => {
      const lines = (d.lines || []).slice();
      lines[i] = { ...lines[i], [k]: v };
      return { ...d, lines };
    });
  }

  const tidy = (d: Record<string, any>) => ({
    ...d,
    subs: (d.subs || []).filter((x: Record<string, any>) => x.ar || x.en || x.lat),
    /* Blank turns are dropped and the words each line uses are worked out
       here, on the way to being stored, so a scene edited a week later
       picks up whatever vocabulary has been added since. */
    ...(scene ? { lines: linked(d.lines || []) } : null),
  });

  /* Stack the current form and start a fresh one, keeping the filing
     details that usually carry across a batch. */
  function queueCurrent() {
    if (!canSave) return;
    setQueue((q) => q.concat([tidy(draft)]));
    setDraft((d) => ({ ...blank(), tags: d.tags, kind: d.kind }));
    requestAnimationFrame(() => arRef.current && arRef.current.focus());
  }

  function toReview() {
    if (editingIndex !== null) {
      if (canSave) {
        const updated = tidy(draft);
        setQueue((q) => q.map((x, i) => (i === editingIndex ? updated : x)));
      }
      setEditingIndex(null);
      setDraft(blank());
    } else if (canSave) {
      setQueue((q) => q.concat([tidy(draft)]));
      setDraft((d) => ({ ...blank(), tags: d.tags, kind: d.kind }));
    }
    setStep("review");
  }

  /* Open one of the queued items back up in the form. */
  function editQueued(i: number) {
    setDraft(queue[i]);
    setEditingIndex(i);
    setStep("form");
    requestAnimationFrame(() => arRef.current && arRef.current.focus());
  }

  function cancelQueuedEdit() {
    setEditingIndex(null);
    setDraft(blank());
    setStep("review");
  }

  function backToForm() {
    setStep("form");
    requestAnimationFrame(() => arRef.current && arRef.current.focus());
  }

  function saveAll() {
    const list = mode === "edit" ? [tidy(draft)] : queue;
    if (!list.length) return;
    onSave(list);
    onClose();
  }

  return (
    <Screen
      title={step === "review"
            ? mode === "edit"
              ? "Check your changes"
              : `Check ${plural(queue.length, "item")}`
            : mode === "edit"
            ? "Edit card"
            : editingIndex !== null
            ? `Editing item ${editingIndex + 1}`
            : queue.length
            ? `Add another (${queue.length} ready)`
            : "Add a card"}
      onBack={() => (step === "review" ? setStep("form") : onClose())}
      action={
        mode === "add" && queue.length > 0 && (
                  <span className="at-sheetnote">{queue.length} ready</span>
                )
      }
      footer={
        <>
              {step === "form" ? (
                <>
                  <Button variant="ghost"
                    onClick={editingIndex !== null ? cancelQueuedEdit : onClose}
                  >
                    {editingIndex !== null ? "Cancel edit" : "Cancel"}
                  </Button>
                  {mode === "add" && editingIndex === null && (
                    <Button variant="ghost" disabled={!canSave} onClick={queueCurrent}>
                      Add another
                    </Button>
                  )}
                  <Button variant="primary"
                    disabled={mode === "edit" ? !canSave : !canSave && !queue.length}
                    onClick={mode === "edit" ? () => setStep("review") : toReview}
                  >
                    {mode === "edit"
                      ? "Review"
                      : editingIndex !== null
                      ? "Save changes"
                      : `Review ${canSave ? queue.length + 1 : queue.length}`}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={backToForm}>
                    {mode === "edit" ? "Back to edit" : "Add more"}
                  </Button>
                  <Button variant="primary" onClick={saveAll}>
                    {mode === "edit"
                      ? "Save changes"
                      : `Save ${plural(pending.length, "card")}`}
                  </Button>
                </>
              )}
        </>
      }
    >
      {step === "form" ? (
        <>
          {scene && (
            <>
              {/* ---- 1. the scene ---- */}
              <div className="at-group">
                <div className="at-grouphead">
                  <span>The scene</span>
                  <span className="req">Two lines or more</span>
                </div>

                <FormField label="What it is called">
                  <input
                    className="at-input"
                    value={draft.en}
                    placeholder="At the door"
                    onChange={(e) => set("en", e.target.value)}
                  />
                </FormField>

                <FormField label={<>Where it happens <span className="at-optional">optional</span></>}>
                  <input
                    className="at-input"
                    value={draft.note}
                    placeholder="Two neighbours meet in the morning"
                    onChange={(e) => set("note", e.target.value)}
                  />
                </FormField>

                <div className="at-field">
                  <label className="at-label">Who is in it</label>
                  <div className="at-inline">
                    {(draft.speakers || []).map((name: string, i: number) => (
                      <input
                        key={i}
                        className="at-input"
                        value={name}
                        placeholder={`Speaker ${i + 1}`}
                        aria-label={`Speaker ${i + 1}`}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            speakers: (d.speakers || []).map((s: string, j: number) =>
                              j === i ? e.target.value : s
                            ),
                          }))
                        }
                      />
                    ))}
                  </div>
                  {(draft.speakers || []).length < MAX_SPEAKERS && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="at-mt2"
                      onClick={() =>
                        setDraft((d) => ({ ...d, speakers: (d.speakers || []).concat([""]) }))
                      }
                    >
                      Add someone
                    </Button>
                  )}
                </div>

                <FormField label="You play">
                  <Segmented
                    label="You play"
                    options={[
                      {
                        value: (null as number | null),
                        label: (draft.speakers || []).length > 2 ? "Any of them" : "Either",
                      },
                      ...(draft.speakers || []).map((n: string, i: number) => ({
                        value: (i as number | null),
                        label: n || `Speaker ${i + 1}`,
                      })),
                    ]}
                    value={draft.you}
                    onChange={(v: number | null) => set("you", v)}
                  />
                  <Help>
                    Whose turns are yours to produce when the whole scene is
                    asked. Left open, the question takes the parts in turn, so
                    a scene met twice has been held up from both ends.
                  </Help>
                </FormField>
              </div>

              {/* ---- 2. the conversation ---- */}
              <div className="at-group">
                <div className="at-grouphead">
                  <span>The conversation</span>
                  <span className="opt">{plural((draft.lines || []).length, "line")}</span>
                </div>

                {(draft.lines || []).map((ln: Record<string, any>, i: number) => (
                  <div className="at-subedit" key={i}>
                    <div className="at-subedithead">
                      <Segmented
                        label={`Who says line ${i + 1}`}
                        options={(draft.speakers || []).map((n: string, j: number) => ({
                          value: j,
                          label: n || `Speaker ${j + 1}`,
                        }))}
                        value={ln.who || 0}
                        onChange={(v: number) => setLine(i, "who", v)}
                      />
                      {(draft.lines || []).length > 2 && (
                        <button
                          className="at-x"
                          aria-label={`Remove line ${i + 1}`}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              lines: (d.lines || []).filter(
                                (_: unknown, j: number) => j !== i
                              ),
                            }))
                          }
                        >
                          <Icon name="close" />
                        </button>
                      )}
                    </div>

                    <ArabicField
                      value={ln.ar}
                      onChange={(v: string) => setLine(i, "ar", v)}
                      mode={settings.keyboard}
                      inputRef={i === 0 ? arRef : undefined}
                      placeholder={lang.scriptLabel}
                    />

                    <div className="at-inline">
                      <div className="at-field">
                        <input
                          className="at-input"
                          value={ln.en}
                          placeholder="What it means"
                          aria-label={`What line ${i + 1} means`}
                          onChange={(e) => setLine(i, "en", e.target.value)}
                        />
                      </div>
                      <div className="at-field">
                        <input
                          className="at-input"
                          value={ln.lat}
                          placeholder="How it sounds"
                          aria-label={`How line ${i + 1} sounds`}
                          onChange={(e) => setLine(i, "lat", e.target.value)}
                        />
                      </div>
                    </div>

                    <RecordingsField
                      recs={ln.recs}
                      onChange={(v: any) => setLine(i, "recs", v)}
                      label="Recording for this line"
                    />

                    {ln.ar.trim() && (
                      <div className="at-uses">
                        {usesIn(ln.ar).length ? (
                          <>
                            <span className="at-useslabel">Uses</span>
                            {usesIn(ln.ar).map((w: Item) => (
                              <span className="at-tag" key={w.id}>
                                {w.ar}
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="at-useslabel">
                            None of your words yet — it will still be drilled as a line.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  style={{ margin: "10px 0 8px" }}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      lines: (d.lines || []).concat([
                        /* Whoever did not speak last, which is what a
                           conversation does on its own. */
                        {
                          ...BLANK_LINE,
                          who:
                            (d.lines || []).length && (d.speakers || []).length > 1
                              ? (Number((d.lines || []).at(-1)?.who || 0) + 1) % (d.speakers || []).length
                              : 0,
                        },
                      ]),
                    }))
                  }
                >
                  Add a line
                </Button>

                <div className={`at-status${previewTypes.length ? "" : " warn"}`}>
                  {!canSave
                    ? "Two lines with something in them, and it can be practised"
                    : `Will be drilled as ${previewTypes
                        .map((t) => exOf(t, lang).short)
                        .join(", ")}`}
                </div>
                <Help>
                  No recordings needed. A scene with none is drilled every way
                  above; where a line has one, it can be heard as well as read.
                </Help>
              </div>
            </>
          )}

          {/* ---- 1. the word itself ---- */}
          {!scene && (
          <div className="at-group">
            <div className="at-grouphead">
              <span>The word</span>
              <span className="req">Script + one other</span>
            </div>

            <ArabicField
              label={langOf(settings).scriptLabel}
              value={draft.ar}
              onChange={(v) => set("ar", v)}
              mode={settings.keyboard}
              inputRef={arRef}
            />

            <div className="at-inline">
              <FormField label="English">
                <input
                  className="at-input"
                  value={draft.en}
                  placeholder="book"
                  onChange={(e) => set("en", e.target.value)}
                />
              </FormField>
              <FormField label="Transliteration">
                <input
                  className="at-input"
                  value={draft.lat}
                  placeholder="kitāb"
                  onChange={(e) => set("lat", e.target.value)}
                />
              </FormField>
            </div>

            <Help>
              Slash-separated alternatives all count — <em>book / notebook</em>.
            </Help>

            <RecordingsField
              recs={draft.recs}
              onChange={(v) => set("recs", v)}
            />

            <div className={`at-status${previewTypes.length >= 2 ? "" : " warn"}`}>
              {!canSave
                ? "Fill the script and one other field"
                : previewTypes.length >= 2
                ? `Will be drilled as ${previewTypes.map((t) => exOf(t, langOf(settings)).short).join(", ")}`
                : "Not enough to practice yet — needs script plus English or transliteration"}
            </div>
          </div>
          )}

          {/* ---- 2. grammar ---- */}
          {!scene && (dimsOf(lang).length > 0 || lang.lexical) && (
            <div className="at-group">
              <div className="at-grouphead">
                <span>Grammar</span>
              </div>
              {dimsOf(lang).map((dim) => (
                <div className="at-field" key={dim.field}>
                  <label className="at-label">
                    {dim.label}{" "}
                    {dim.required ? (
                      <span className="req">required</span>
                    ) : (
                      <span className="at-optional">optional</span>
                    )}
                  </label>
                  <Segmented
                    label={dim.label}
                    options={dim.options.map(([value, label]) => ({ value, label }))}
                    value={draft[dim.field]}
                    onChange={(v) =>
                      set(dim.field, !dim.required && draft[dim.field] === v ? "" : v)
                    }
                  />
                </div>
              ))}
              {lexical && (
                <FormField label={<>{lexical.label} <span className="at-optional">optional</span></>}>
                  <input
                    className="at-input"
                    value={draft[lexical.key] || ""}
                    placeholder={lexical.help || ""}
                    onChange={(e) => set(lexical.key, e.target.value)}
                  />
                </FormField>
              )}
            </div>
          )}

          {/* ---- 3. other forms ---- */}
          {!scene && (
          <div className="at-group">
            <div className="at-grouphead">
              <span>Other forms</span>
              <span className="opt">
                {draft.subs.length
                  ? `${draft.subs.length} added`
                  : "optional"}
              </span>
            </div>

            {draft.subs.length === 0 ? (
              <div className="at-emptyforms">
                <Help>
                  A plural, a feminine — any form worth learning in its own right. Each keeps
                  its own progress, and this card won't count as learnt until they all are.
                </Help>
                <Button size="sm"
                  className="at-mt3"
                  onClick={() =>
                    setDraft((d) => ({ ...d, subs: d.subs.concat([{ ...BLANK_SUB }]) }))
                  }
                >
                  Add a form
                </Button>
              </div>
            ) : (
              <>
                {draft.subs.map((sb: Record<string, any>, i: number) => (
                  <div className="at-subedit" key={i}>
                    <div className="at-subedithead">
                      <span className="at-formtag">{labelFor(sb) || "form"}</span>
                      <button
                        className="at-x"
                        aria-label="Remove form"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            subs: d.subs.filter((_: unknown, j: number) => j !== i),
                          }))
                        }
                      >
                        <Icon name="close" />
                      </button>
                    </div>

                    <ArabicField
                      value={sb.ar}
                      onChange={(v) => setSub(i, "ar", v)}
                      mode={settings.keyboard}
                      placeholder="الشكل"
                    />

                    <div className="at-inline">
                      <div className="at-field">
                        <input
                          className="at-input"
                          value={sb.en}
                          placeholder="English"
                          onChange={(e) => setSub(i, "en", e.target.value)}
                        />
                      </div>
                      <div className="at-field">
                        <input
                          className="at-input"
                          value={sb.lat}
                          placeholder="Transliteration"
                          onChange={(e) => setSub(i, "lat", e.target.value)}
                        />
                      </div>
                    </div>

                    <RecordingsField
                      recs={sb.recs}
                      onChange={(v) => setSub(i, "recs", v)}
                      label="Recordings for this form"
                    />

                    {dimsOf(lang).map((dim) => (
                      <FormField label={dim.label} key={dim.field}>
                        <Segmented
                          label={dim.label}
                          options={dim.options.map(([value, label]) => ({ value, label }))}
                          value={sb[dim.field]}
                          onChange={(v) =>
                            setSub(i, dim.field, !dim.required && sb[dim.field] === v ? "" : v)
                          }
                        />
                      </FormField>
                    ))}
                  </div>
                ))}
                <Button variant="ghost" size="sm"
                  style={{ margin: "10px 0 8px" }}
                  onClick={() =>
                    setDraft((d) => ({ ...d, subs: d.subs.concat([{ ...BLANK_SUB }]) }))
                  }
                >
                  Add another form
                </Button>
              </>
            )}
          </div>
          )}

          {/* ---- 4. filing ---- */}
          <div className="at-group">
            <div className="at-grouphead">
              <span>Filing</span>
              <span className="opt">optional</span>
            </div>

            <FormField label="Decks">
              <input
                className="at-input"
                value={draft.tags}
                placeholder="class 12 june, numbers"
                onChange={(e) => set("tags", e.target.value)}
              />
              {allTags.length > 0 && (
                <div className="at-tags at-mt2">
                  {allTags.slice(0, 10).map((t) => (
                    <span
                      key={t}
                      className={`at-tag pick${cleanTags(draft.tags).includes(t) ? " on" : ""}`}
                      onClick={() =>
                        set(
                          "tags",
                          cleanTags(draft.tags).includes(t)
                            ? cleanTags(draft.tags).filter((x) => x !== t).join(", ")
                            : (draft.tags ? draft.tags + ", " : "") + t
                        )
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </FormField>

            {/* A scene has a length of its own and it is not one of these
                three. The note above holds its setting, so the one below
                would be a second note about the same thing. */}
            {!scene && (
              <>
            <div className="at-inline">
              <FormField label="Length">
                <Segmented
                  label="Kind"
                  options={["", "word", "phrase", "sentence"].map((k) => ({
                    value: k,
                    label: k || "auto",
                  }))}
                  value={draft.kind}
                  onChange={(v) => set("kind", v)}
                />
              </FormField>
            </div>

            <FormField label="Note">
              <input
                className="at-input"
                value={draft.note}
                placeholder="root, irregular plural, where you heard it"
                onChange={(e) => set("note", e.target.value)}
              />
            </FormField>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {mode === "edit" ? (
            <ReviewItem item={previewItem} units={previewUnits} total={1} index={0} />
          ) : (
            <>
              <Help>
                {pending.length === 1
                  ? "This is exactly what will be stored."
                  : `All ${pending.length} items as they will be stored. Remove any that look wrong, or go back and add more.`}
              </Help>
              {pending.map((it, i) => (
                <ReviewItem
                  key={i}
                  item={it}
                  units={unitsOf(it)}
                  index={i}
                  total={pending.length}
                  onEdit={i < queue.length ? () => editQueued(i) : undefined}
                  onRemove={
                    pending.length > 1
                      ? () => setQueue((q) => q.filter((_, j) => j !== i))
                      : undefined
                  }
                />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Which language this session is

   Only ever asked of somebody studying more than one, and asked at the
   moment it matters — on the way into a session, rather than as a setting
   somewhere that has to be remembered and put back afterwards.

   Each row starts the session on the tap, because a picker where every
   choice needs confirming is two taps for a question with one answer. All
   languages together is a row like the others rather than a switch beside
   them: it is another way to practice, not a modifier on the choice above.
   ------------------------------------------------------------------ */
function SessionLanguages({ choices, ready, chosen, onPick, onClose }: {
  choices: { id: LangId, name: string, ready: number, total: number }[];
  ready: number;
  chosen: LangId | "" | null;
  onPick: (id: LangId | "") => void;
  onClose: () => void;
}) {
  const waiting = (n: number) => (n ? `${plural(n, "card")} ready` : "nothing ready just now");
  return (
    <Screen title="Which language?" onBack={onClose} rise backLabel="Not now">
      <Help>
        You're studying more than one. Pick the one to practice, or take them
        all in one session.
      </Help>
      <div className="at-cklist">
        {choices.map((c) => (
          <button
            key={c.id}
            className={`at-ck${chosen === c.id ? " on" : ""}`}
            disabled={!c.ready}
            onClick={() => onPick(c.id)}
          >
            <span className="at-cktext">
              <b>{c.name}</b>
              <i>{waiting(c.ready)}</i>
            </span>
          </button>
        ))}
        <button
          className={`at-ck${chosen === "" ? " on" : ""}`}
          disabled={!ready}
          onClick={() => onPick("")}
        >
          <span className="at-cktext">
            <b>All languages</b>
            <i>{waiting(ready)}, mixed together</i>
          </span>
        </button>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Full-screen: build a session by hand
   ------------------------------------------------------------------ */

const COUNT_CHOICES = [10, 20, 30, 50];
const TIME_CHOICES = [2, 3, 5, 10];

/* ------------------------------------------------------------------
   Full-screen: the sessions somebody kept

   A saved session is a description, not a snapshot — which cards, which
   mode, how long — so what it opens is built from the cards as they are
   now. That is what makes "Thursday's verbs" worth keeping: the same
   ground, practised again, with everything edited since included.
   ------------------------------------------------------------------ */

function SavedSessionsSheet({ sessions, items, onStart, onDelete, onClose }: {
  sessions: SavedSession[];
  items: Item[];
  onStart: (session: SavedSession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const here = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  /* Newest first: the one somebody just made is the one they are looking
     for. */
  const list = [...sessions].sort((a, b) => (b.created || 0) - (a.created || 0));

  return (
    <Screen title="Saved sessions" onBack={onClose}>
      {!list.length && (
        <Empty title="Nothing saved yet">
          Build a session, and the last step offers to keep it.
        </Empty>
      )}

      <div className="at-list">
        {list.map((s) => {
          /* How much of it is still here. A card withdrawn since is simply
             gone from the session, and saying so before it is started is
             the difference between a short session and a broken one. */
          const alive = s.ids.filter((id) => here.has(id)).length;
          const mode = (MODES as Record<string, { label: string } | undefined>)[s.mode];
          const length = s.minutes
            ? `${s.minutes} min`
            : s.count && s.count < 999
            ? `${s.count} questions`
            : "everything";
          return (
            <div className="at-item at-sessionrow" key={s.id}>
              <div className="grow">
                <div className="en">{s.name}</div>
                <div className="lat">
                  {[mode ? mode.label : s.mode, length,
                    alive === s.ids.length
                      ? plural(alive, "card")
                      : `${alive} of ${s.ids.length} cards still here`,
                  ].join(" · ")}
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!alive}
                onClick={() => onStart(s)}
              >
                Start
              </Button>
              <IconButton
                icon="delete"
                label={`Forget ${s.name}`}
                danger
                onClick={() => onDelete(s.id)}
              />
            </div>
          );
        })}
      </div>

      {list.some((s) => s.ids.some((id) => !here.has(id))) && (
        <Help className="at-mt3">
          A session keeps the cards it was built from by name, so one you
          have since deleted is no longer in it.
        </Help>
      )}
    </Screen>
  );
}

function ManualSessionSheet({ items, allTags, settings, onStart, onSave, onClose }: {
  items: Item[];
  allTags: string[];
  settings: Settings;
  onStart: (plan: any) => void;
  onSave: (session: { name: string; ids: string[]; mode: string; count: number; minutes: number }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  /* No mode until one is chosen. A pre-selected card looks like an answer
     already given, so the first screen gets read as "confirm this" rather
     than "pick one" — and Ultimate, which is the longest session on offer,
     is the last one to hand somebody by default. */
  const [mode, setMode] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [openTag, setOpenTag] = useState<string | null>(null);
  /* "" until one of the two is chosen — the same reason the mode starts
     unset. It used to open on 20 questions already lit, which is a length
     nobody asked for sitting where the answer goes. */
  const [limitKind, setLimitKind] = useState(""); // "" | count | time
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(5);
  /* What it would be called, and what was last kept under that name. Held
     as the description rather than as a flag, so changing the length or
     the cards after saving offers the button again — what is on screen is
     no longer what was kept. */
  const [name, setName] = useState("");
  const [savedSpec, setSavedSpec] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const eligible = useMemo(
    () => items.filter((i) => availableTypes(i).length >= 2 || (i.subs || []).length),
    [items]
  );

  /* Tags first: picking one selects everything under it. */
  const tagGroups = useMemo(() => {
    const m = new Map();
    for (const it of eligible) for (const t of it.tags) {
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(it);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [eligible]);

  const searched = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return eligible.filter(
      (i) =>
        i.ar.includes(q.trim()) ||
        i.en.toLowerCase().includes(n) ||
        i.lat.toLowerCase().includes(n)
    );
  }, [eligible, q]);

  const toggleOne = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const tagState = (group: Item[]) => {
    const on = group.filter((i) => picked.has(i.id)).length;
    return on === 0 ? "none" : on === group.length ? "all" : "some";
  };

  const toggleTag = (group: Item[]) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const all = group.every((i) => next.has(i.id));
      group.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });

  /* Ultimate is the one mode with no length to choose — it asks everything
     about everything — but the last step is still there for it, because
     keeping the session is offered from the same place. Three steps
     whatever the mode also means the count stops changing under somebody
     halfway through it. */
  const needsLength = mode !== "ultimate";
  const steps = ["Mode", "Cards", "Finish"];
  const last = step === steps.length - 1;

  const typeCount = typesForMode(mode, settings).length;
  /* Matches the minimum buildManualSession uses, or Start would be offered
     for a session that then refuses to build — and refused for one that
     would have been fine. */
  const needTypes = mode === "started" ? 1 : 2;
  const problem =
    !mode
      ? "Choose a mode"
      : picked.size === 0
      ? "Choose at least one card"
      : typeCount < needTypes
      ? mode === "started"
        ? "Get started needs one of the gentle exercise types switched on"
        : "At least two exercise types must be switched on in Settings"
      : needsLength && !limitKind
      ? "Choose a length"
      : "";

  /* What is missing to leave *this* step, which is not the same as what is
     missing to start: being told to pick cards while still choosing a mode
     answers a question that has not been asked yet. The button says it
     rather than sitting dead — a disabled control with no reason given is
     the one people tap twice and then give up on. */
  const stepProblem =
    step === 0 && !mode
      ? "Choose a mode"
      : step === 1 && picked.size === 0
      ? "Choose at least one card"
      : "";

  /*
   * A reason short enough to be a label, or nothing.
   *
   * Saying why a button is disabled on the button itself is the right
   * shape for "Choose a mode" and the wrong one for "At least two exercise
   * types must be switched on in Settings" — that is a sentence, and a
   * sentence on a button either wraps or shrinks to something nobody can
   * read. The long ones are shown above the footer instead, where there is
   * room for them, and the button keeps its verb.
   */
  const LABEL_LIMIT = 26;
  const onButton = (reason: string) =>
    reason && reason.length <= LABEL_LIMIT ? reason : "";
  const spelledOut = [stepProblem, last ? problem : ""].find(
    (r) => r && r.length > LABEL_LIMIT
  );

  /* Named after what it is, so a list of them reads without opening any:
     the mode is the shape of the session and the count is its size. */
  const suggestion = mode
    ? `${(MODES as Record<string, { label: string }>)[mode].label} · ${plural(picked.size, "card")}`
    : "";
  const spec = JSON.stringify({
    name: name.trim() || suggestion,
    ids: [...picked].sort(),
    mode,
    limitKind,
    count,
    minutes,
  });
  const saved = !!savedSpec && savedSpec === spec;

  function start() {
    onStart({
      ids: [...picked],
      mode,
      count: limitKind === "count" ? count : 999,
      minutes: limitKind === "time" && needsLength ? minutes : 0,
    });
  }

  return (
    <Screen
      title={steps[step]}
      onBack={() => (step === 0 ? onClose() : setStep(step - 1))}
      action={
        <span className="at-sheetnote">
                  {step + 1} of {steps.length}
                </span>
      }
      footer={
        <>
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {!last ? (
                <Button variant="primary"
                  disabled={!!stepProblem}
                  onClick={() => setStep(step + 1)}
                >
                  {onButton(stepProblem) || "Next"}
                </Button>
              ) : (
                <Button variant="primary" disabled={!!problem} onClick={start}>
                  {onButton(problem) || "Start"}
                </Button>
              )}
        </>
      }
    >
      {spelledOut && <Notice kind="warn">{spelledOut}</Notice>}

      {step === 0 && (
        <div className="at-modelist">
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              className={`at-modecard${mode === key ? " on" : ""}`}
              onClick={() => setMode(key)}
            >
              <b>{m.label}</b>
              <span>{m.blurb}</span>
            </button>
          ))}
          <Help>
            Exercise types are set by the mode. Cards you've already fully learnt are left out
            of every session.
          </Help>
        </div>
      )}

      {step === 1 && (
        <>
          <Help>
            Pick whole tags, or search for individual cards below.
          </Help>

          <div className="at-taglist">
            {tagGroups.map(([name, group]) => {
              const st = tagState(group);
              return (
                <div className={`at-tagpick${st !== "none" ? " on" : ""}`} key={name}>
                  <div className="at-tagpickrow">
                    <button className="at-tagpickmain" onClick={() => toggleTag(group)}>
                      <span className={`at-box ${st}`}>
                        {st === "all" ? "✓" : st === "some" ? "–" : ""}
                      </span>
                      <span className="nm">{name}</span>
                      <span className="ct">
                        {group.filter((i: Item) => picked.has(i.id)).length}/{group.length}
                      </span>
                    </button>
                    <button
                      className="at-tagpickmore"
                      onClick={() => setOpenTag(openTag === name ? null : name)}
                      aria-label="Choose individually"
                    >
                      {openTag === name ? "▾" : "▸"}
                    </button>
                  </div>
                  {openTag === name && (
                    <div className="at-tagpickcards">
                      {group.map((it: Item) => (
                        <button
                          key={it.id}
                          className={`at-minicard${picked.has(it.id) ? " on" : ""}`}
                          onClick={() => toggleOne(it.id)}
                        >
                          {it.ar && (
                            <span className="ar" lang={activeLang().id} dir={activeLang().direction}>
                              {it.ar}
                            </span>
                          )}
                          <span className="en">{it.en}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className={`at-tagpick${eligible.every((i) => picked.has(i.id)) ? " on" : ""}`}>
              <div className="at-tagpickrow">
              <button
                className="at-tagpickmain"
                onClick={() =>
                  setPicked((prev) =>
                    eligible.every((i) => prev.has(i.id))
                      ? new Set()
                      : new Set(eligible.map((i) => i.id))
                  )
                }
              >
                <span className={`at-box ${eligible.every((i) => picked.has(i.id)) ? "all" : picked.size ? "some" : "none"}`}>
                  {eligible.every((i) => picked.has(i.id)) ? "✓" : picked.size ? "–" : ""}
                </span>
                <span className="nm">Everything</span>
                <span className="ct">
                  {picked.size}/{eligible.length}
                </span>
              </button>
              </div>
            </div>
          </div>

          <FormField label="Or find one card" className="at-mt5">
            <input
              className="at-input"
              placeholder="Search"
              value={q}
              dir="auto"
              onChange={(e) => setQ(e.target.value)}
            />
          </FormField>
          {q.trim() && (
            <div className="at-tagpickcards at-mt1">
              {searched.map((it) => (
                <button
                  key={it.id}
                  className={`at-minicard${picked.has(it.id) ? " on" : ""}`}
                  onClick={() => toggleOne(it.id)}
                >
                  {it.ar && (
                    <span className="ar" lang={activeLang().id} dir={activeLang().direction}>
                      {it.ar}
                    </span>
                  )}
                  <span className="en">{it.en}</span>
                </button>
              ))}
              {!searched.length && <Help>Nothing matches that.</Help>}
            </div>
          )}
        </>
      )}

      {step === 2 && needsLength && (
        <>
          <div className="at-lengthgroup">
            <p className="at-label">Number of questions</p>
            <Segmented
              size={null}
              label="How many exercises"
              options={COUNT_CHOICES.map((n) => ({ value: n, label: String(n) }))}
              value={limitKind === "count" ? count : null}
              onChange={(n) => {
                setLimitKind("count");
                setCount(n);
              }}
            />
          </div>

          <div className="at-lengthor">or</div>

          <div className="at-lengthgroup">
            <p className="at-label">Time</p>
            <Segmented
              size={null}
              label="How long"
              options={TIME_CHOICES.map((n) => ({ value: n, label: `${n} min` }))}
              value={limitKind === "time" ? minutes : null}
              onChange={(n) => {
                setLimitKind("time");
                setMinutes(n);
              }}
            />
          </div>

          <Help>
            {limitKind === "count"
              ? `The session ends after ${count} questions.`
              : limitKind === "time"
              ? `A countdown replaces the question count, and the session ends after ${minutes} minutes.`
              : "One or the other: a number of questions, or a stretch of time."}
          </Help>
        </>
      )}

      {/*
        * Keeping it, which is the other half of what this step is for.
        *
        * Building one of these is several minutes of picking, and until now
        * all of it was spent again the next morning. What is kept is the
        * description — the cards, the mode, the length — so a card edited
        * since is practised as it now reads.
        *
        * An extra rather than the way on: Start is still the button, and a
        * session nobody saves behaves exactly as it did.
        */}
      {step === 2 && (
        <div className="at-formblock at-mt5">
          <FormField
            label="Keep this session"
            hint="It will be under Saved sessions, beside Build a session."
          >
            <input
              className="at-input"
              placeholder={suggestion}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <div className="at-row at-mt3">
            <Button
              variant="ghost"
              icon={saved ? "check" : "save"}
              disabled={!!problem || saved}
              onClick={() => {
                onSave({
                  name: name.trim() || suggestion,
                  ids: [...picked] as string[],
                  mode,
                  count: limitKind === "count" ? count : 999,
                  minutes: limitKind === "time" && needsLength ? minutes : 0,
                });
                setSavedSpec(spec);
              }}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
          {/* Which is not the same as having started it: somebody who saves
              and then leaves has kept the session and practised nothing. */}
          {saved && <Help>Kept. Start it now, or find it later under Saved sessions.</Help>}
        </div>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Full-screen: view an item without risking a change to it
   ------------------------------------------------------------------ */



/* A read-only rendering of what is about to be saved. */
function ReviewItem({ item, units, index, total, onRemove, onEdit }: {
  item: Item;
  units: { unit: Form, isSub: boolean }[];
  index: number;
  total: number;
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const counts = familyCounts(item);
  return (
    <div className="at-reviewgroup">
      {(total > 1 || onEdit) && (
        <div className="at-reviewbar">
          <span className="at-eyebrow">
            {total > 1 ? `Item ${index + 1} of ${total}` : "This card"}
          </span>
          <span className="at-reviewacts">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                Remove
              </Button>
            )}
          </span>
        </div>
      )}

      {units.map(({ unit, isSub }, i) => {
        const types = availableTypes(unit);
        return (
          <div className="at-reviewcard" key={i}>
            <div className="at-reviewhead">
              <span className="at-formtag">{labelFor(unit)}</span>
              <span className="at-eyebrow">
                {isSub ? "Other form" : "Main entry"}
              </span>
            </div>

            {unit.ar ? (
              /* A plain paragraph, not a Stat. Stat wraps its value in
                 .at-statvalue, which sets the UI serif and its own size at
                 the same specificity as .at-arabic.word and later in the
                 file — so the preview of the word came out in the interface
                 face at stat size instead of the script's own. */
              <p
                className="at-arabic word"
                lang={activeLang().id}
                dir={activeLang().direction}
              >
                {unit.ar}
              </p>
            ) : (
              <Notice kind="warn">
                {`No ${activeLang().scriptLabel} — this form can't be practiced.`}
              </Notice>
            )}
            {unit.en && <p className="at-en" style={{ fontSize: 20 }}>{unit.en}</p>}
            {unit.lat && <p className="at-latin" style={{ fontSize: 17 }}>{unit.lat}</p>}
            {unit.note && <p className="at-note">{unit.note}</p>}

            <ClipList
                    clips={(unit.recs || []).map((r: any, i: number) => ({
                      id: r.id,
                      label: r.label || `Voice ${i + 1}`,
                    }))}
                    load={clipUrl}
                  />

            <Help>
              {types.length >= 2 ? (
                <>Exercises: {types.map((t) => exOf(t, activeLang()).label).join(" · ")}</>
              ) : (
                <span className="at-warn">
                  Fewer than two exercise types — add the {activeLang().scriptLabel} plus English
                  {activeLang().translitDrilled !== false
                    ? ` or a ${activeLang().translitLabel.toLowerCase()}`
                    : ""}
                  .
                </span>
              )}
            </Help>
          </div>
        );
      })}

      <div className="at-reviewcard">
        <div className="at-reviewhead">
          <span className="at-eyebrow">
            Filed as
          </span>
        </div>
        <div className="at-flags" style={{ justifyContent: "center", marginTop: 0 }}>
          <span className="at-flag">{item.kind}</span>
          {counts.subs > 0 && <span className="at-flag forms">⌥ {counts.forms} forms</span>}
          {counts.clips > 0 && <span className="at-flag audio">♪ {counts.clips}</span>}
        </div>
        {item.tags.length ? (
          <div className="at-tags" style={{ justifyContent: "center", marginTop: 10 }}>
            {item.tags.map((t) => (
              <span className="at-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        ) : (
          <Help className="at-mt2">Not in any deck</Help>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Full-screen: add many, with a review step
   ------------------------------------------------------------------ */

function BulkAddSheet({ allTags, onAdd, onImport, onClose }: {
  allTags: string[];
  onAdd: (items: any[]) => void;
  onImport: (file: File) => void;
  onClose: () => void;
}) {
  const [bulk, setBulk] = useState("");
  const [step, setStep] = useState("paste");
  const parsed = useMemo(() => parseLines(bulk, allTags), [bulk, allTags]);
  const prepared = useMemo(() => parsed.map((p) => makeItem(p)), [parsed]);
  const weak = prepared.filter((p) => availableTypes(p).length < 2).length;

  return (
    <Screen
      title={step === "review" ? `Check ${plural(parsed.length, "card")}` : "Add in bulk"}
      onBack={() => (step === "review" ? setStep("paste") : onClose())}
      action={
        step === "paste" && (
                  <label className="at-btn sm ghost" style={{ flex: "none" }}>
                    Open a file
                    <input
                      type="file"
                      accept=".zip,.json,.md,.csv,.txt"
                      className="at-hidden"
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];
                        if (f) {
                          onImport(f);
                          onClose();
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )
      }
      footer={
        <>
              {step === "paste" ? (
                <>
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary"
                    disabled={!parsed.length}
                    onClick={() => setStep("review")}
                  >
                    Review {parsed.length || ""}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setStep("paste")}>
                    Back to edit
                  </Button>
                  <Button variant="primary"
                    onClick={() => {
                      onAdd(parsed);
                      onClose();
                    }}
                  >
                    Add {plural(parsed.length, "card")}
                  </Button>
                </>
              )}
        </>
      }
    >
      {step === "paste" ? (
        <>
          <div className="at-syntax">
            <p className="at-eyebrow" style={{ margin: "0 0 8px" }}>
              Syntax
            </p>
            <p>
              <strong>A markdown table works as-is.</strong> Paste it below, or open an{" "}
              <code>.md</code> file. Columns in this order:
            </p>
            <pre dir="auto">{sampleTable(activeLang())}</pre>
            <p>Headings and prose around the table are ignored.</p>
            <p>
              Add <code>Number</code> and <code>Gender</code> columns if you want them — or
              label cells <code>num:</code> and <code>gen:</code>. Anything without a number is
              filed as singular, and you can change it in bulk afterwards.
            </p>
            <p>Without a table, one card per line, cells split by <code>|</code> or a tab:</p>
            {/* The one place the script's name is lowered on purpose: these
                are cells to copy, sitting beside "english" and "decks",
                and a capital here would read as part of what to type. */}
            <pre>
              english | {activeLang().scriptLabel.toLowerCase()} |{" "}
              {activeLang().translitLabel.toLowerCase()} | decks | note
            </pre>
            <p>
              Trailing fields can be left off. Use <code>||</code> only to skip a field in the{" "}
              <em>middle</em> of a line. Lines starting with <code>#</code> are ignored.
            </p>
          </div>

          <textarea
            className="at-input"
            value={bulk}
            dir="auto"
            style={{ minHeight: 220 }}
            placeholder={samplePlaceholder(activeLang())}
            onChange={(e) => setBulk(e.target.value)}
          />
          {bulk.trim() && (
            <Help>
              {plural(parsed.length, "card")} read
              {parsed.skipped ? `, ${parsed.skipped} line(s) skipped` : ""}.
            </Help>
          )}
        </>
      ) : (
        <>
          <Help>
            Every row as it will be stored. {!!parsed.skipped && `${parsed.skipped} line(s) couldn't be read and were dropped. `}
            {weak > 0 && (
              <span className="at-warn">
                {plural(weak, "item")} lack two exercise types and won't be
                practiced until filled in.
              </span>
            )}
          </Help>
          <div className="at-preview">
            <div className="at-previewhead">
              <span>English</span>
              <span>{activeLang().scriptLabel}</span>
              <span>Translit.</span>
              <span>Decks</span>
            </div>
            {prepared.map((p, i) => (
              <div
                className={`at-previewrow${availableTypes(p).length < 2 ? " weak" : ""}`}
                key={i}
              >
                <span className="cell en">{p.en || "—"}</span>
                <span className="cell ar" lang={activeLang().id} dir={activeLang().direction}>
                  {p.ar || "—"}
                </span>
                <span className="cell lat">{p.lat || "—"}</span>
                <span className="cell tag">{p.tags.join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

/* ==================================================================
   Progress tab
   ================================================================== */

/* How far along a whole family is: the mean across every form and every
   exercise type it supports. 1 means every one of them is mature. */
function itemProgress(it: Item) {
  const vals: number[] = [];
  for (const { unit } of unitsOf(it)) {
    for (const t of availableTypes(unit)) {
      const st = statesOf(unit)[t];
      if (st.phase === "new") vals.push(0);
      else if (st.phase === "review") vals.push(Math.min(1, (st.interval || 0) / MATURE_DAYS));
      else vals.push(0.15);
    }
  }
  if (!vals.length) return null; // nothing drillable yet
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* A tile here shows how far along a card is, which is exactly the moment
   you want to look at the card itself — so it opens, like every other
   small card in the app. A real button rather than a div with a click on
   it: it has nothing interactive inside it, so it can be the one thing
   you press, and reach with a keyboard. */
function ItemProgressCard({ item, progress, onOpen }: { item: Item; progress?: any; onOpen?: () => void }) {
  const p = progress === undefined ? itemProgress(item) : progress;
  const done = p !== null && p >= 1;
  const pctLabel = p === null ? "—" : `${Math.round(p * 100)}%`;

  return (
    <button
      type="button"
      className={`at-pcard${done ? " done" : ""}${p === null ? " idle" : ""}`}
      onClick={onOpen}
    >
      <div className="at-pcardtop">
        {item.ar && (
          <span className="ar" lang={activeLang().id} dir={activeLang().direction}>
            {item.ar}
          </span>
        )}
        {item.en && <span className="en">{item.en}</span>}
      </div>
      <div className="at-pbar">
        <i style={{ width: `${p === null ? 0 : Math.max(3, p * 100)}%` }} />
      </div>
      <div className="at-pcardfoot">
        <span>{p === null ? "Can't practice yet" : done ? "Learnt" : pctLabel}</span>
        {(item.subs || []).length > 0 && <span>⌥ {(item.subs || []).length + 1}</span>}
      </div>
    </button>
  );
}

/* Progress per card is worked out once per change of the cards, in the tab,
   and handed down — not once per section and again per tile on every
   render. */
const TagSection = React.memo(
  function TagSection({
    name,
    items: group,
    open,
    onToggle,
    onPractice,
    progressOf,
    onOpen,
  }: {
    name: string;
    items: Item[];
    open: boolean;
    onToggle: () => void;
    onPractice: (ids: string[], mode: string) => void;
    progressOf: Map<string, number | null>;
    onOpen: (it: Item) => void;
  }) {
    const [arming, setArming] = useState(false);
    const scored = group
      .map((it) => progressOf.get(it.id))
      .filter((x): x is number => x != null);
    const mean = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
    const done = scored.filter((x) => x >= 1).length;

    return (
      <div className="at-tagsec">
        <div className="at-tagsecbar">
          <span className="nm">{name}</span>
          <button
            className={`at-btn sm${arming ? " primary" : " ghost"}`}
            onClick={() => setArming((v) => !v)}
          >
            <Icon name={arming ? "close" : "cards"} size={16} />
            {arming ? "Cancel" : "Practice"}
          </button>
          <span className="ct">
            {done}/{group.length} learnt
          </span>
          <button
            className="at-icon at-chev"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Hide ${name}` : `Show ${name}`}
            title={open ? "Hide cards" : "Show cards"}
          >
            <Icon name={open ? "chevronUp" : "chevronDown"} size={18} />
          </button>
        </div>

        {arming && (
          <div className="at-modepick">
            <p className="at-miniq">
              How should these {plural(group.length, "card")} be practiced?
            </p>
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                className="at-modepickopt"
                onClick={() => {
                  setArming(false);
                  onPractice(group.map((i) => i.id), key);
                }}
              >
                <b>{m.label}</b>
                <span>{m.blurb}</span>
              </button>
            ))}
          </div>
        )}
        <div className="at-pbar lg">
          <i
            className={done === group.length && group.length ? "full" : ""}
            style={{ width: `${Math.max(2, mean * 100)}%` }}
          />
        </div>
        {open && (
          <div className="at-pgrid">
            {group.map((it) => (
              <ItemProgressCard
                item={it}
                key={it.id}
                progress={progressOf.get(it.id)}
                onOpen={() => onOpen(it)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

function ProgressTab({ data, items, myCourses = [], settings, onPractice }: {
  data: any;
  items: Item[];
  myCourses?: Course[];
  settings: Settings;
  onPractice: (ids: string[], mode: string) => void;
}) {
  // Collapsed by default: the point of this screen is the overview.
  const [open, setOpen] = useState(() => new Set());
  const [viewing, setViewing] = useState<any | null>(null);

  const progressOf = useMemo(() => {
    const m: Map<string, number | null> = new Map();
    for (const it of items) m.set(it.id, itemProgress(it));
    return m;
  }, [items]);

  const buckets = ["new", "learning", "young", "mature"];
  const totals: Record<string, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const it of items) totals[familyMaturity(it)] += 1;

  /* A card shows up under each of its decks, and once under "Not in a deck" if
     it has none. */
  const groups = useMemo(() => {
    const byTag = new Map();
    const untagged = [];
    for (const it of items) {
      if (!it.tags.length) {
        untagged.push(it);
        continue;
      }
      for (const t of it.tags) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(it);
      }
    }
    const out = [...byTag.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([name, group]) => ({ name, group }));
    if (untagged.length) out.push({ name: "Not in a deck", group: untagged });
    return out;
  }, [items]);

  const toggle = (name: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <>
      <Help>
        How well you know each deck. Open one to see its cards.
      </Help>

      <div className="at-stats tight">
        <div className="at-stat">
          <b>{items.length}</b>
          <span>Cards</span>
        </div>
        {buckets.map((b) => (
          <div className="at-stat" key={b}>
            <b style={{ color: b === "new" ? "var(--text)" : MATURITY_COLOR[b] }}>{totals[b]}</b>
            <span>{MATURITY_LABEL[b]}</span>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty title="Nothing to show yet">{noCardsYet(myCourses.length)}</Empty>
      ) : (
        groups.map(({ name, group }) => (
          <TagSection
            key={name}
            name={name}
            items={group}
            open={open.has(name)}
            onToggle={() => toggle(name)}
            onPractice={onPractice}
            progressOf={progressOf}
            onOpen={setViewing}
          />
        ))
      )}

      {viewing && (
        <CardScreen card={viewing} items={items} onBack={() => setViewing(null)} />
      )}
    </>
  );
}

/* ==================================================================
   Sync panel
   ================================================================== */

const GUIDE = [
  {
    title: "Cards",
    body: [
      "A card is one thing to learn — a word, a phrase, an expression, a sentence. It carries the thing itself in the language you are learning, its meaning in English, and optionally a second writing (such as a transliteration) and one or more recordings.",
      "A card can hold several forms of the same thing — a plural, a feminine, a variant said to an elder — and each form is practiced on its own.",
    ],
  },
  {
    title: "What gets asked",
    body: [
      "What is on a card decides what can be asked of it. Script and meaning give you two directions; a recording lets it be practiced by ear; a second writing, where the language uses one, adds more.",
      "Some languages have properties that can be heard but not seen written — a tone, for instance. Where a language declares one, there is an exercise for it.",
      "A card can also hold a whole conversation. You meet it by reading it through, then a line at a time: what a line means, which reply comes next, and writing your own turn. Later the scene itself — putting its lines back in order, and holding up your whole end of it. None of that needs a recording; where a line has one, you can hear it as well as read it.",
    ],
  },
  {
    title: "How the app decides what to show you",
    body: [
      "Every card is scheduled separately. Get it right and it comes back later; get it wrong and it comes back sooner. Nothing is ever finished — a card you know well simply waits longer between appearances.",
      "A session mixes cards that are due with a few that are not, and spreads the ways each is asked so you do not see the same card twice in a row.",
    ],
  },
  {
    title: "Decks and courses",
    body: [
      "A deck is a set of cards. A course is a set of decks with people in it. Teachers make decks and put them in courses; students join a course and receive its decks.",
      "Course cards are studied but not edited — they belong to the course. If a deck is withdrawn from a course, its cards leave your device at the next check.",
    ],
  },
  {
    title: "Your progress",
    body: [
      "Your progress lives on your device and, if you sign in, syncs between your devices. It is yours: a teacher sees the material, not your answers.",
      "The app works fully offline. Anything you do while disconnected is kept and sent when a connection returns.",
    ],
  },
];

function Guide() {
  const [open, setOpen] = useState(0);
  return (
    <>
      <Help className="at-mb4">
        The ideas the app is built on. Short on purpose.
      </Help>
      {GUIDE.map((g, i) => (
        <div className={`at-guide${open === i ? " on" : ""}`} key={g.title}>
          <button className="at-guidehead" onClick={() => setOpen(open === i ? -1 : i)}>
            <b>{g.title}</b>
            <span className="at-chevron">{open === i ? "–" : "+"}</span>
          </button>
          {open === i && (
            <div className="at-guidebody">
              {g.body.map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------
   Account

   One secret does everything: it signs you in, keeps your devices
   together, and identifies you to any course you join. It is never shown
   to anyone else — the handle does the public work.
   ------------------------------------------------------------------ */

/*
 * The sign-in key is on the account this device holds, not on a `User`:
 * a User is what everyone else sees, and the key is the one part of it
 * that never leaves the device that signed in.
 */
function AccountPanel({ me, onRename }: { me: User & { key: string }; onRename: (name: string) => void }) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(me.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      /* clipboard blocked — the field is selectable instead */
    }
  }

  return (
    <Section title="Your account">

      <FormField label="Display name">
        <input
          className="at-input"
          defaultValue={me.displayName}
          onBlur={(e) => e.target.value.trim() && onRename(e.target.value.trim())}
        />
        <Help>
          What teachers and classmates see. Change it whenever you like.
        </Help>
      </FormField>

      <FormField label="Handle">
        <p className="at-handle">{me.handle}</p>
        <Help>
          Fixed for good, because course rosters point at it. Safe to share — it identifies you
          without letting anyone in.
        </Help>
      </FormField>

      <FormField label="Sign-in key">
        {showKey ? (
          <>
            {/* A real field, so a password manager recognises it and offers to
                save it. Read-only: this is where the key is revealed, not
                where it is changed. */}
            <input
              className="at-input at-keyfield"
              type="text"
              readOnly
              name="password"
              autoComplete="current-password"
              aria-label="Your sign-in key"
              value={me.key}
              onFocus={(e) => e.target.select()}
            />
            <div className="at-row at-mt3">
              <Button variant="ghost" size="sm" onClick={() => setShowKey(false)}>
                Hide
              </Button>
              <Button variant="ghost" size="sm" onClick={copyKey}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowKey(true)}>
            Show my key
          </Button>
        )}
        <Help>
          Five words that sign you in on any device and keep them together.{" "}
          <em>Never share it</em> — anyone who has it is you. If you lose it, your administrator
          can issue a new one; you keep your handle, your courses and everything you have learnt.
        </Help>
      </FormField>
    </Section>
  );
}

/* ==================================================================
   Settings tab
   ================================================================== */

/* Closing an account is irreversible, so it asks for the handle rather
   than a yes/no anyone taps through. */
function CloseAccount({ handle, onClosed }: { handle: string; onClosed: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open)
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Close my account
      </Button>
    );

  return (
    <>
      <Help>
        Type <strong>{handle}</strong> to confirm.
      </Help>
      <input
        className="at-input"
        value={typed}
        autoFocus
        placeholder={handle}
        onChange={(e) => {
          setTyped(e.target.value);
          setError("");
        }}
      />
      <Notice kind="error">{error}</Notice>
      <div className="at-row at-mt3">
        <Button variant="ghost" size="sm"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
        >
          Cancel
        </Button>
        <Button variant="danger" size="sm"
          disabled={typed.trim() !== handle || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await API.deleteAccount();
              API.clearAccount();
              onClosed();
            } catch (e) {
              setError(API.explain(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "Closing…" : "Close it"}
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------
   The corner menu

   Account and preferences are true wherever you are, so they live in the
   corner rather than inside any one screen. This is the only route to
   either, which is why it has to be part of the app and not the shell
   around it.
   ------------------------------------------------------------------ */

const initialsOf = (name?: string | null) =>
  String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

const SPACE_LABEL: Record<string, string> = { learn: "Learning", teach: "Teaching", admin: "Admin" };
const SPACE_ICON: Record<string, string> = { learn: "cards", teach: "school", admin: "tune" };

/* Which part of the app you are in, sitting beside the account menu.
   Someone who only studies has one space, so there is nothing to choose and
   the control does not appear at all. */
/* Which part of the app you are in, sat beside the account menu.
   A row rather than a dropdown: there are at most three, and moving this out
   of the menu was about reaching them in one tap. Shown only to people with
   somewhere to go — a student who only studies sees nothing. */
function SpaceSwitch({ space, spaces, onSpace }: {
  space: string;
  spaces: string[];
  onSpace: (space: string) => void;
}) {
  if (!spaces || spaces.length < 2) return null;
  return (
    <div className="at-spaces" role="tablist" aria-label="Part of the app">
      {spaces.map((sp) => (
        <button
          key={sp}
          role="tab"
          aria-selected={space === sp}
          aria-label={SPACE_LABEL[sp]}
          title={SPACE_LABEL[sp]}
          className={`at-spacebtn${space === sp ? " on" : ""}`}
          onClick={() => onSpace(sp)}
        >
          <Icon name={SPACE_ICON[sp]} size={18} />
        </button>
      ))}
    </div>
  );
}

/*
 * Which version this is, and whether it is the one on the server.
 *
 * Two facts, because they answer two questions. The release — 0.1, 0.2,
 * 0.3 — is the headline, because "which version am I on?" wants a number
 * that counts, not a hash. The commit sits under it, because "is what I
 * merged actually running?" can only be answered by the thing that changes
 * on every deploy.
 *
 * Both are frozen in at build time (see vite.config.js), so they describe
 * the running bundle — not what the server is serving. For an installed app
 * those come apart: the service worker holds a precached copy and keeps
 * serving it until it has fetched the new one, so a deploy can land
 * perfectly and this line still read the old build for a while.
 *
 * Which is exactly the thing that would make a version line misleading, so
 * the line asks the server as well. "Up to date" then means the deploy
 * landed *and* you are looking at it, and anything else says so plainly
 * rather than leaving a good deploy looking like a failed one.
 */
const APP_RELEASE = typeof __APP_RELEASE__ === "string" && __APP_RELEASE__ ? __APP_RELEASE__ : "dev";
const APP_COMMIT = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const APP_BUILT_AT = typeof __BUILT_AT__ === "string" ? __BUILT_AT__ : "";

/* Short and local: enough to tell two deploys on the same day apart. */
function buildStamp(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AppVersion() {
  /* null while asking, then the server's answer, or false if it could not
     be reached — which is not an error worth showing: offline is a normal
     state for this app, and it says nothing about the deploy. */
  const [deployed, setDeployed] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  /* The reload waits for the new worker to take over, which takes a
     moment — so the button says it is working rather than looking like
     the press did nothing. Never turned off: the page is on its way. */
  const [reloading, setReloading] = useState(false);
  const alive = useRef(true);
  const snack = useSnackbar();

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  /* The one question this component asks, so the menu opening and the
     button pressing ask it the same way.

     `deployed` is not cleared first: blanking an answer we already have in
     order to ask the same question again would flicker the line for no
     reason. `announce` is off for the check that happens when the menu
     opens — nobody asked for that one, and a snackbar for it would fire
     every time the menu is touched. */
  const check = useCallback(
    (announce = false) => {
      setBusy(true);
      return fetch("/api/version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (!alive.current) return;
          const found = v && v.commit ? v : false;
          setDeployed(found);
          setBusy(false);
          /* A newer build says so itself — the line turns and offers
             Reload, which is louder and more useful than a pill. The other
             two outcomes change nothing on screen, so without a word the
             button reads as dead. */
          if (!announce) return;
          if (!found) snack("Couldn't reach the server");
          else if (found.commit === APP_COMMIT) snack("You're on the latest version");
        })
        .catch(() => {
          if (!alive.current) return;
          setDeployed(false);
          setBusy(false);
          if (announce) snack("Couldn't reach the server");
        });
    },
    [snack],
  );

  useEffect(() => {
    check();
  }, [check]);

  /* The commit, not the release: two builds of 0.3 are still two builds,
     and only the hash tells them apart. */
  const stale = deployed && deployed.commit !== APP_COMMIT;

  /* Reload onto the build that is actually deployed. The waiting for the
     new worker to take over is in updates.ts, with the rest of it: what
     this button does by hand is what the app now does by itself, and the
     two had drifted into two versions of the same dance. */
  function reload() {
    setReloading(true);
    return applyUpdate();
  }

  return (
    <div className={`at-cver${stale ? " stale" : ""}`}>
      <span className="at-cvertext">
        <b>Version {APP_RELEASE}</b>
        <i>{[APP_COMMIT, buildStamp(APP_BUILT_AT)].filter(Boolean).join(" · ")}</i>
        {/* Its own line rather than a tail on the one above: appended, it
            was the half that got cut off, which is the half worth
            reading. */}
        {stale && (
          <i className="at-cvernew">
            {deployed.release ? `${deployed.release} (${deployed.commit})` : deployed.commit} is
            deployed
          </i>
        )}
      </span>
      {/* One button, never two. Check is what you press when there is
          nothing to do; Reload is what you press when there is. A row
          carrying both would make you pick between them, and the pick is
          never yours to make. */}
      {stale ? (
        <button className="at-cverbtn" onClick={reload} disabled={reloading}>
          {reloading ? "Reloading…" : "Reload"}
        </button>
      ) : (
        <button className="at-cverbtn" onClick={() => check(true)} disabled={busy}>
          {busy ? "Checking…" : "Check"}
        </button>
      )}
    </div>
  );
}

function CornerMenu({ account, syncState, onSyncNow, theme, onTheme, onAccount, onPrefs, onGuide }: {
  account: User | null;
  syncState?: string;
  onSyncNow: () => void;
  theme?: string;
  onTheme: (theme: string) => void;
  onAccount: () => void;
  onPrefs: () => void;
  onGuide: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="at-corner" onClick={(e) => e.stopPropagation()}>
      <button
        className="at-cornerbtn"
        onClick={() => setOpen((v) => !v)}
        aria-label="You and your settings"
      >
        {initialsOf(account && account.displayName)}
        <span className={`at-cdot ${syncState}`} />
      </button>

      {open && (
        <div className="at-cmenu">
          <div className="at-cwho">
            <span className="at-cavatar">{initialsOf(account && account.displayName)}</span>
            <span className="at-cwhotext">
              <b>{(account && account.displayName) || "You"}</b>
              <i>{(account && account.handle) || ""}</i>
            </span>
          </div>

          {/* The row states where sync has got to; the button is the only
              thing that starts one. It used to be the whole row, so
              reading the state meant risking the action. */}
          <div className="at-cline as-field">
            <span className="at-cico">
              <span className={`at-cdot ${syncState}`} />
            </span>
            <span className="at-clinetext">
              {syncState === "syncing"
                ? "Syncing now"
                : syncState === "error"
                ? "Offline — will retry"
                : "Up to date"}
            </span>
            <button className="at-cact" onClick={onSyncNow}>
              Sync now
            </button>
          </div>

          {/* Choosing between three looks, not doing a thing: the options
              sit side by side and the current one is lit, rather than one
              button cycling through them and leaving you to tap twice to
              go back one. */}
          <div className="at-cline as-field">
            <span className="at-cico">
              <Icon name="theme" size={18} />
            </span>
            <span className="at-clinetext">Appearance</span>
          </div>
          <div className="at-cseg">
            <Segmented
              label="Appearance"
              /* The menu gives it a fixed width to fill; compact would sit
                 short of the rows above and below it. */
              size={null}
              options={[
                { value: "auto", label: "Device" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme || "auto"}
              onChange={onTheme}
            />
          </div>

          <div className="at-crule" />

          <button
            className="at-cline"
            onClick={() => {
              setOpen(false);
              onAccount();
            }}
          >
            <span className="at-cico">
              <Icon name="person" size={18} />
            </span>
            <span className="at-clinetext">Account settings</span>
          </button>
          <button
            className="at-cline"
            onClick={() => {
              setOpen(false);
              onPrefs();
            }}
          >
            <span className="at-cico">
              <Icon name="tune" size={18} />
            </span>
            <span className="at-clinetext">App preferences</span>
          </button>
          <button
            className="at-cline"
            onClick={() => {
              setOpen(false);
              onGuide();
            }}
          >
            <span className="at-cico">
              <Icon name="help" size={18} />
            </span>
            <span className="at-clinetext">How it works</span>
          </button>

          <div className="at-crule" />
          <AppVersion />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Settings, as two screens rather than a tab

   Everything is either about you — your name, your key, your devices,
   your data — or about how the app behaves. Two places to look, both
   reached from the menu in the corner.
   ------------------------------------------------------------------ */

/*
 * A router, not a screen of its own: which of the three it shows is the
 * caller's `kind`. The rest of the props are the two screens' own, which
 * is why they are asked for together — there is one caller and it passes
 * both sets.
 */
function SettingsScreen({ kind, onClose, ...rest }: {
  kind?: string;
  onClose: () => void;
} & React.ComponentProps<typeof AccountSettings> & React.ComponentProps<typeof AppPreferences>) {
  const title =
    kind === "account" ? "Account settings" : kind === "guide" ? "How it works" : "App preferences";
  return (
    <Screen title={title} onBack={onClose}>
      {kind === "account" ? (
        <AccountSettings {...rest} />
      ) : kind === "guide" ? (
        <Guide />
      ) : (
        <AppPreferences {...rest} />
      )}
    </Screen>
  );
}

function AccountSettings({
  account,
  onRename,
  onReset,
  isAdmin,
  onOpenAdmin,
  onBecameAdmin,
  onCloseAccount,
  onLogOut,
  allClipIds = [],
}: {
  account: User & { key: string };
  onRename: (name: string) => void;
  onReset?: () => void;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onBecameAdmin?: () => void;
  onCloseAccount: () => void;
  onLogOut: () => void;
  allClipIds?: string[];
}) {
  /* The storage figures moved here with the section that shows them. */
  const [stats, setStats] = useState<any | null>(null);
  const [warming, setWarming] = useState<any | null>(null); // { done, total, fetched }

  async function downloadAll() {
    const total = new Set(allClipIds).size;
    setWarming({ done: 0, total, fetched: 0 });
    const fetched = await warmClips(allClipIds, {
      onProgress: (done, got) => setWarming({ done, total, fetched: got }),
    });
    setWarming({ done: total, total, fetched, finished: true });
    const [st, db] = await Promise.all([clipStats(), openClipDb()]);
    setStats({ ...st, idb: !!db });
  }
  /* Shut by default: everything inside it is irreversible, so it shouldn't
     be sitting open where a thumb can reach it. */
  const [dangerOpen, setDangerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([clipStats(), openClipDb()]).then(([st, db]) => {
      if (alive) setStats({ ...st, idb: !!db });
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <AccountPanel me={account} onRename={onRename} />

      <Section title="Storage">
        <Lede>
          {stats
            ? `${plural(stats.count, "recording")}, ${formatBytes(stats.bytes)}${
                stats.idb ? "" : " — stored in the small text store, so keep an eye on the size"
              }`
            : "Counting recordings…"}
        </Lede>
        {allClipIds.length > 0 && (
          <div className="at-row at-mt2">
            <Button variant="ghost" size="sm"
              disabled={!!warming && !warming.finished}
              onClick={downloadAll} icon="download">{warming && !warming.finished
                ? `Downloading ${warming.done} of ${warming.total}…`
                : "Download all recordings for offline"}</Button>
          </div>
        )}
        {warming && warming.finished && (
          <Help>
            {warming.fetched
              ? `${plural(warming.fetched, "recording")} downloaded.`
              : "Everything was already on this device."}
          </Help>
        )}
      </Section>

      {/* Signing out is ordinary housekeeping, not a danger: it leaves
          everything on the server exactly as it is. */}
      <Section title="Sign out">
        <Lede>
          Leaves this device signed out. Nothing on the server changes, and your key brings it all
          back — so only do this if you have the key written down somewhere.
        </Lede>
        <Button className="at-mt3" onClick={() => setLoggingOut(true)}>
          Log out
        </Button>
      </Section>

      {loggingOut && (
        <ConfirmModal
          title="Log out of this device?"
          danger={false}
          confirmLabel="Log out"
          body={
            <p>
              You'll need your sign-in key to get back in, and nobody can recover it for you except
              your administrator. Your account, courses and progress stay exactly as they are.
            </p>
          }
          onCancel={() => setLoggingOut(false)}
          onConfirm={() => {
            setLoggingOut(false);
            onLogOut();
          }}
        />
      )}

      <div className={`at-sub at-danger${dangerOpen ? " open" : ""}`}>
        <button
          className="at-dangertoggle"
          onClick={() => setDangerOpen((v) => !v)}
          aria-expanded={dangerOpen}
        >
          <span className="at-eyebrow">
            Danger zone
          </span>
          <span className="at-chevron">{dangerOpen ? "⌄" : "›"}</span>
        </button>

        {dangerOpen && (
          <div className="at-mt4">
            {/* Running the site sits here because everything it leads to is
                irreversible once you're through the door. */}
            <FormField label="Running this site">
              {isAdmin ? (
                <>
                  <Help className="at-mb3">
                    You create courses, decide who teaches them, and can delete either. Nothing
                    done in there can be taken back.
                  </Help>
                  <Button size="sm" onClick={onOpenAdmin}>
                    Open administration
                  </Button>
                </>
              ) : (
                <>
                  <Help className="at-mb3">
                    Only needed by whoever runs this site. An administrator key turns this account
                    into the one that manages everyone else's.
                  </Help>
                  <React.Suspense fallback={<ChunkFallback />}>
                    <ClaimAdmin onDone={onBecameAdmin} />
                  </React.Suspense>
                </>
              )}
            </FormField>

            <FormField label={<>Send every card back to the start, as though never practiced</>}>
              <Help className="at-mb3">
                Your cards, forms, decks and recordings all stay. What goes is everything the app
                has worked out about how well you know them — intervals, ease, difficulty and
                history. Nothing will be due until you practice it again.
              </Help>
              <Button variant="danger" size="sm" onClick={() => setResetting(true)}>
                Reset scheduling
              </Button>
            </FormField>

            {resetting && (
              <ConfirmModal
                title="Reset scheduling on every card?"
                confirmLabel="Reset scheduling"
                confirmWord="reset"
                body={
                  <p>
                    Every card goes back to the beginning. The cards themselves are kept; what you
                    lose is the record of how well you know them, which can't be rebuilt except by
                    practicing again.
                  </p>
                }
                onCancel={() => setResetting(false)}
                onConfirm={() => {
                  setResetting(false);
                  if (onReset) onReset();
                }}
              />
            )}

            <FormField label="Close this account">
              <Help className="at-mb3">
                Removes your account from the server: your handle, your courses, and any decks you
                made for them. Cards on this device stay until you clear them. There is no undoing
                it and no way to get the handle back.
              </Help>
              <CloseAccount onClosed={onCloseAccount} handle={account.handle} />
            </FormField>
          </div>
        )}
      </div>
    </>
  );
}

function AppPreferences({ settings, setSetting, toggleIn }: {
  settings: Settings;
  setSetting: (key: string, value: any) => void;
  toggleIn: (key: string, value: any) => void;
}) {
  const [advanced, setAdvanced] = useState(false);

  return (
    <>
      <Section title="Language">
        {/* The one screen where a learner would look for this. It could only
            be set by a course before, so someone studying two languages had
            no way to choose which the app was in. */}
        <LanguageRadio
          languages={LANGUAGES}
          value={settings.language || DEFAULT_LANGUAGE}
          onChange={(id) => setSetting("language", id)}
          label="Learning"
        />
      </Section>

      <Section title="Appearance">
        <FormField label="Theme">
          <Segmented
            options={[{ value: "auto", label: "Follow device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
            value={(settings.theme || "auto")}
            onChange={(v) => setSetting("theme", v)}
          />
        </FormField>
        <FormField label="On-screen keys">
          <Segmented
            options={[{ value: "auto", label: "When needed" }, { value: "always", label: "Always" }, { value: "never", label: "Never" }]}
            value={(settings.keyboard || "auto")}
            onChange={(v) => setSetting("keyboard", v)}
          />
          <Help>
            Keys for the language you're learning, when your device hasn't got them.
          </Help>
        </FormField>
      </Section>

      <Section title="Feedback">
        <FormField label="Sounds">
          <div className="at-row">
            <Segmented
              label="Sounds"
              options={[
                { value: "loud", label: "Loud" },
                { value: "soft", label: "Soft" },
                { value: "off", label: "Off" },
              ]}
              /* Read through the same reader the player uses, so a setting
                 stored as a boolean shows as the level it will actually
                 play at rather than as nothing selected. */
              value={soundLevelOf(settings.sounds)}
              onChange={(v) => setSetting("sounds", v)}
            />
            <Button
              variant="ghost"
              icon="play"
              /* Off has nothing to demonstrate, and a button that played
                 anyway would be arguing with the setting next to it. */
              disabled={soundLevelOf(settings.sounds) === "off"}
              onClick={() => {
                /* The two you will actually hear, in the order you would
                   hear them — the old pairing ended on the session-complete
                   fanfare, which is not what this setting is about. */
                sfx("correct");
                setTimeout(() => sfx("wrong"), 700);
              }}
            >
              Test
            </Button>
          </div>
          <Help>
            The short sounds after an answer. Loud carries on a bus; soft is
            for a quiet room.
          </Help>
        </FormField>
      </Section>

      <Section title="Hints">
        <FormField label="A hint shows the pronunciation or the meaning before you answer">
          <Segmented
            label="Hints"
            options={[
              { value: false, label: "Off" },
              { value: true, label: "On" },
            ]}
            value={!!settings.showHint}
            onChange={(v) => setSetting("showHint", v)}
          />
        </FormField>
      </Section>

      <div className="at-sub at-advanced">
        <button
          className="at-disclosure"
          aria-expanded={advanced}
          onClick={() => setAdvanced((v) => !v)}
        >
          <span className="at-eyebrow">
            Advanced
          </span>
          <span className="at-chevron">{advanced ? "▾" : "▸"}</span>
        </button>
        {!advanced && (
          <Help className="at-mt2">
            How sessions are built and how your answers are marked. The defaults are sensible —
            open this only if you want to change them.
          </Help>
        )}

        {advanced && (
          <>
            <div className="at-advgroup">
              <p className="at-eyebrow">Sessions</p>
        <FormField label={<>Exercises per form — {Math.max(2, settings.perItem)}</>}>
          <input
            type="range"
            min="2"
            max="4"
            style={{ width: "100%" }}
            value={Math.max(2, settings.perItem)}
            onChange={(e) => setSetting("perItem", Number(e.target.value))}
          />
          <Help>
            How many different ways each form is drilled within one session, where its data
            allows. They're spread out rather than run back to back.
          </Help>
        </FormField>

<FormField label="Exercise types in play">
          <div className="at-segmented" role="group" aria-label="Exercise types in play">
            {TYPES.filter((t) => !EX[t].quizAttr || quizAttrOf(langOf(settings))).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={settings.types[t] ? "primary" : "default"}
                aria-pressed={!!settings.types[t]}
                onClick={() => toggleIn("types", t)}
                title={exOf(t, langOf(settings)).label}
              >
                {exOf(t, langOf(settings)).short}
              </Button>
            ))}
          </div>
          <Help>
            {TYPES.filter((t) => settings.types[t]).length < 2 ? (
              <span className="at-warn">
                At least two types must be on — a session is never a single type.
              </span>
            ) : (
              <>
                A→E is recognition, T→A production from sound, E→A production from meaning, and
                the L→ types drill the same things by ear. A card climbs them: it is read on its
                own first, joins a matching grid once it is through the learning steps, and the
                harder types open only once everything below them is mastered — four days of
                interval, in review. Turning types off can drop items below the two-type minimum.
              </>
            )}
          </Help>
</FormField>

<FormField label="Exercises per session — {settings.sessionSize}">
          <input
            type="range"
            min="6"
            max="60"
            style={{ width: "100%" }}
            value={settings.sessionSize}
            onChange={(e) => setSetting("sessionSize", Number(e.target.value))}
          />
</FormField>

<FormField label="New cards per session — {settings.newPerSession}">
          <input
            type="range"
            min="0"
            max="15"
            style={{ width: "100%" }}
            value={settings.newPerSession}
            onChange={(e) => setSetting("newPerSession", Number(e.target.value))}
          />
          <Help>
            And only while there is room: new cards wait when {LEARNING_CAP} are already being
            learnt, or {YOUNG_CAP} are young and still coming back for review.
          </Help>
</FormField>

<FormField label="Group similar cards">
          <Segmented
            label="Group similar cards"
            options={[
              { value: "off", label: "Off" },
              { value: "balanced", label: "Balanced" },
              { value: "strong", label: "Strong" },
            ]}
            value={settings.cohesion}
            onChange={(v) => setSetting("cohesion", v)}
          />
          <Help>
            Similarity means shared tags, a shared consonant skeleton (usually a shared root), or
            having been added in the same sitting. Stronger grouping reaches further down the due
            list to find related items, so it trades a little scheduling precision for a more
            coherent session.
          </Help>
</FormField>

<FormField label="Order within a session">
          <Segmented
            options={[{ value: true, label: "Ease me in" }, { value: false, label: "Mixed" }]}
            value={!!settings.warmup}
            onChange={(v) => setSetting("warmup", v)}
          />
          <Help>
            Easier items first, hard ones last, and new cards paused when {HARD_BACKLOG_LIMIT} or
            more are still fighting you.
          </Help>
</FormField>
            </div>

            <div className="at-advgroup">
              <p className="at-eyebrow">Marking</p>
              {/* Whatever leniencies the language you are learning declares,
                  in its own words. This block used to be Arabic's two
                  settings written out by hand and shown to everyone: a
                  Vietnamese learner was asked about harakat, and the
                  Vietnamese pack's own tone setting had no control at all
                  and sat at its default. The pack is asked instead, so a
                  new language needs nothing here. */}
              {(langOf(settings).options || []).map((opt) => (
                <FormField key={opt.key} label={opt.label}>
                  <Segmented
                    label={opt.label}
                    options={
                      opt.toggle
                        ? [{ value: false, label: "Exact" }, { value: true, label: "Lenient" }]
                        : (opt.choices || []).map(([value, label]) => ({ value, label }))
                    }
                    value={opt.toggle ? !!settings[opt.key] : settings[opt.key]}
                    onChange={(v) => setSetting(opt.key, v)}
                  />
                  {opt.help ? <Help>{opt.help}</Help> : null}
                </FormField>
              ))}
              {langOf(settings).translitDrilled !== false && (
                <Help>
                  {langOf(settings).translitLabel} is always marked leniently: macrons, ʿayn marks
                  and apostrophes are ignored.
                </Help>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function nextDueLine(pool: Item[], settings: Settings) {
  const future: Millis[] = [];
  for (const it of pool) {
    for (const { unit } of drillableUnits(it, settings)) {
      for (const t of enabledTypes(unit, settings)) {
        const d = statesOf(unit)[t].due || 0;
        if (d > now()) future.push(d);
      }
    }
  }
  if (!future.length) return "Nothing scheduled.";
  return `Next exercise in ${formatGap(Math.min(...future) - now())}.`;
}

