import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Button,
  CardReadout,
  CardTile,
  CheckList,
  ClipList,
  ConfirmModal,
  Empty,
  Field as FormField,
  Help,
  Icon,
  IconButton,
  ItemList,
  Lede,
  Notice,
  PlayButton,
  LanguageRadio,
  Screen,
  Section,
  Segmented,
  SnackbarProvider,
  Stat,
  Tabs,
  languageName,
  plural,
  pullCourses,
  useClipPlayer,
  useLiveRefresh,
  useSnackbarState,
} from "./shared.jsx";

/* The onboarding, teaching, admin and course screens are their own chunk,
   fetched on the first tap that opens one of them. A student drilling cards
   never parses a line of the admin console. */
/* After a deploy, an app that has been open for a while still holds the
   old bundle, whose chunk names the new service worker has already thrown
   away. The first tap on a lazy screen then fails to load, and without this
   the screen went blank. One reload picks up the new build; the flag stops
   a genuinely broken deploy from reloading for ever. */
const RELOADED_FLAG = "at-chunk-reloaded";

function recoverChunk(err) {
  let already = false;
  try {
    already = sessionStorage.getItem(RELOADED_FLAG) === "1";
    if (!already) sessionStorage.setItem(RELOADED_FLAG, "1");
  } catch (e) {
    /* storage blocked: reload once anyway is still the better bet */
  }
  if (!already) {
    window.location.reload();
    return new Promise(() => {}); // the page is going away
  }
  throw err;
}

const fromSpaces = (name) =>
  React.lazy(() =>
    import("./spaces.jsx")
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

/* What shows for the moment the chunk is in flight. */
function ChunkFallback() {
  return <Help>Loading…</Help>;
}
import * as API from "./courses-api.js";
import {
  DEFAULT_LANGUAGE,
  EX,
  LANGUAGES,
  TYPES,
  activeLang,
  checkAnswer,
  derivedValue,
  dimValues,
  dimsOf,
  exOf,
  isListening,
  groupAttrOf,
  labelFor,
  langOf,
  normAr,
  quizAttrOf,
  setActiveLang,
  tight,
  verdictText,
  verdictWord,
  GRAMMAR,
  defaultTypes,
  defaultLanguageOptions,
  grammarFields,
  normDimValue,
} from "./languages.js";

import {
  syncClips,
  loadSyncConfig,
  saveSyncConfig,
  tokenFor,
  syncOnce,
  forgetRemote,
  compactItem,
  mergeData,
} from "./sync.js";

/* ==================================================================
   Arabic trainer

   Vocabulary used throughout:
     item          a word, expression or sentence to be learnt
     item data     its three fields: Arabic script, English, transliteration
     exercise      one instance of practising something
     exercise type one of the four kinds of exercise below
     session       a short sequence of exercises done in one sitting

   Session rules, enforced by buildSession():
     1. A session always contains more than one exercise type.
     2. Every item in a session is practised in at least two exercise
        types, three where the item data allows it.
     3. Items that resemble each other are preferred within a session.

   Every exercise shows one item's own data, verbatim. Nothing is
   recombined across items.
   ================================================================== */

const KEY = "arabic-trainer-v3";
const DAY = 86400000;
const MIN = 60000;

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


/* ---- scheduler ---- */
const LEARN_STEPS = [1, 10];
const RELEARN_STEP = 10;
const GRADUATE_DAYS = 1;
const EASY_DAYS = 4;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MAX_DAYS = 365;
const MATURE_DAYS = 21;

const EMPTY = {
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
    kinds: { word: true, phrase: true, sentence: true },
    cohesion: "balanced", // off | balanced | strong
    ...defaultLanguageOptions(),
    showHint: false,
    keyboard: "auto",
    warmup: true,
    theme: "auto",
    sounds: true,
    language: DEFAULT_LANGUAGE,
  },
};

const now = () => Date.now();
const dayKey = (t = now()) => new Date(t).toISOString().slice(0, 10);
const inDays = (n) => now() + n * DAY;
const clampEase = (e) => Math.max(MIN_EASE, Math.min(MAX_EASE, e));
const fuzz = () => 0.95 + Math.random() * 0.1;

const freshState = () => ({
  phase: "new",
  step: 0,
  ease: 2.5,
  interval: 0,
  due: 0,
  reps: 0,
  lapses: 0,
  right: 0,
  wrong: 0,
  skips: 0,
  near: 0,
  hist: [],
  updated: 0,
});

/* ------------------------------------------------------------------
   Spaced repetition (SM-2)
   ------------------------------------------------------------------ */

function reschedule(prev, rating) {
  const s = { ...prev };
  s.reps += 1;
  /* "hard" is a near miss, not a success: it is scheduled gently but it is
     still counted as wrong, so the numbers on the progress screen are true. */
  if (rating === "again" || rating === "hard") s.wrong += 1;
  else s.right += 1;

  if (s.phase === "new" || s.phase === "learning") {
    if (rating === "again") {
      s.phase = "learning";
      s.step = 0;
      s.due = now() + LEARN_STEPS[0] * MIN;
    } else if (rating === "easy") {
      s.phase = "review";
      s.step = 0;
      s.interval = EASY_DAYS;
      s.due = inDays(EASY_DAYS);
    } else if (rating === "hard") {
      s.phase = "learning";
      s.due = now() + LEARN_STEPS[Math.min(s.step, LEARN_STEPS.length - 1)] * MIN;
    } else {
      const next = s.step + 1;
      if (next >= LEARN_STEPS.length) {
        s.phase = "review";
        s.step = 0;
        s.interval = GRADUATE_DAYS;
        s.due = inDays(GRADUATE_DAYS);
      } else {
        s.phase = "learning";
        s.step = next;
        s.due = now() + LEARN_STEPS[next] * MIN;
      }
    }
    return s;
  }

  if (s.phase === "relearning") {
    if (rating === "again") {
      s.due = now() + RELEARN_STEP * MIN;
    } else {
      s.phase = "review";
      s.interval = Math.max(1, s.interval);
      s.due = inDays(s.interval);
    }
    return s;
  }

  if (rating === "again") {
    s.lapses += 1;
    s.ease = clampEase(s.ease - 0.2);
    s.interval = Math.max(1, Math.round(s.interval * 0.5));
    s.phase = "relearning";
    s.due = now() + RELEARN_STEP * MIN;
    return s;
  }

  let mult;
  if (rating === "hard") {
    s.ease = clampEase(s.ease - 0.15);
    mult = 1.2;
  } else if (rating === "easy") {
    s.ease = clampEase(s.ease + 0.15);
    mult = s.ease * 1.3;
  } else {
    mult = s.ease;
  }
  const base = Math.max(1, s.interval || 1);
  s.interval = Math.min(MAX_DAYS, Math.max(1, Math.round(base * mult * fuzz())));
  s.due = inDays(s.interval);
  return s;
}


function formatGap(ms) {
  if (ms <= 0) return "now";
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 31) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

function maturity(s) {
  if (s.phase === "new") return "new";
  if (s.phase === "learning" || s.phase === "relearning") return "learning";
  return s.interval >= MATURE_DAYS ? "mature" : "young";
}

const MATURITY_LABEL = { new: "New", learning: "Learning", young: "Young", mature: "Mature" };
const MATURITY_COLOR = {
  new: "var(--raised)",
  learning: "var(--rose)",
  young: "var(--brass)",
  mature: "var(--jade)",
};

/* ------------------------------------------------------------------
   Automatic difficulty
   ------------------------------------------------------------------ */

const HARD_BACKLOG_LIMIT = 10;
const DIFF_RANK = { easy: 0, steady: 1, unrated: 2, hard: 3 };

function difficultyScore(s) {
  const attempts = (s.right || 0) + (s.wrong || 0);
  if (!attempts) return 0;
  const raw =
    ((s.wrong || 0) / attempts) * 40 +
    Math.min(s.lapses || 0, 5) * 6 +
    Math.min(s.skips || 0, 5) * 8 +
    (2.5 - (s.ease || 2.5)) * 20 -
    Math.min(s.near || 0, 5) * 3;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function difficulty(s) {
  if ((s.right || 0) + (s.wrong || 0) < 2) return "unrated";
  const score = difficultyScore(s);
  if (score < 22) return "easy";
  if (score < 50) return "steady";
  return "hard";
}

/* Rule 7: a family counts as learnt only when every one of its forms is.
   Both of these take the weakest link across the item and its sub-items. */
function itemDifficulty(it) {
  const rated = [];
  for (const { unit } of unitsOf(it)) {
    for (const t of availableTypes(unit)) {
      const d = difficulty(unit.s[t]);
      if (d !== "unrated") rated.push(d);
    }
  }
  if (!rated.length) return "unrated";
  if (rated.includes("hard")) return "hard";
  if (rated.includes("steady")) return "steady";
  return "easy";
}

const MATURITY_ORDER = ["new", "learning", "young", "mature"];

function familyMaturity(it) {
  let worst = null;
  for (const { unit } of unitsOf(it)) {
    for (const t of availableTypes(unit)) {
      const m = maturity(unit.s[t]);
      if (worst === null || MATURITY_ORDER.indexOf(m) < MATURITY_ORDER.indexOf(worst)) worst = m;
    }
  }
  return worst || "new";
}


/* ------------------------------------------------------------------
   Items
   ------------------------------------------------------------------ */

function cleanTags(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const out = [];
  for (const t of raw) {
    const tag = String(t).trim().replace(/\s+/g, " ");
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}


function freshStates() {
  const s = {};
  for (const t of TYPES) s[t] = freshState();
  return s;
}

/* A sub-item is a form of its parent — a plural, a feminine — carrying the
   same three fields and its own progress, but no decks of its own. */
function makeSub(src = {}) {
  const { ar = "", lat = "", en = "", note = "", recs = [] } = src;
  return {
    id: `s${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    ar: ar.trim(),
    lat: lat.trim(),
    en: en.trim(),
    ...dimValues(src),
    note: note.trim(),
    recs: recs || [],
    created: now(),
    updated: now(),
    s: freshStates(),
  };
}

function makeItem(src = {}) {
  const {
    ar = "",
    lat = "",
    en = "",
    kind = "",
    note = "",
    tags = [],
    subs = [],
    recs = [],
  } = src;
  const text = ar || en || lat;
  const guess = /[.!?،؟]|\s\S+\s\S+\s/.test(text)
    ? "sentence"
    : /\s/.test(text.trim())
    ? "phrase"
    : "word";
  const s = freshStates();
  return {
    id: `${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    ar: ar.trim(),
    lat: lat.trim(),
    en: en.trim(),
    kind: kind || guess,
    note: note.trim(),
    tags: cleanTags(tags),
    locked: false,
    flags: [],
    recs: recs || [],
    ...dimValues(src),
    subs: (subs || []).map((x) => (x.id ? x : makeSub(x))),
    created: now(),
    updated: now(),
    s,
  };
}

/* Everything schedulable in a family: the item itself plus its sub-items. */
function unitsOf(item) {
  return [{ unit: item, isSub: false }].concat(
    (item.subs || []).map((sb) => ({ unit: sb, isSub: true }))
  );
}

function drillableUnits(item, settings) {
  return unitsOf(item).filter(({ unit }) => enabledTypes(unit, settings).length >= 2);
}

/* Totals for the list indicators: how many forms, how many clips. */
function familyCounts(it) {
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
function setListenOffUntil(until) {
  listenOffUntil = until || 0;
}

/* Whether a type may be asked at this moment. Only the clock makes this
   false, so it is deliberately not part of what a card "supports". */
function typeAllowedNow(type) {
  return !(listenOffUntil > Date.now() && isListening(type));
}

/* How long "can't listen right now" lasts. Long enough to cover the walk, the
   queue or the meeting that prompted it; short enough that forgetting about
   it costs one session rather than a week of never hearing the language. */
const LISTEN_OFF_MS = 15 * 60 * 1000;

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
export function withoutListening(exercises, from, items, settings) {
  const keyOf = (ex) => `${ex.id} ${ex.subId || ""}`;
  const used = new Map();
  const note = (ex, type) => {
    const k = keyOf(ex);
    if (!used.has(k)) used.set(k, new Set());
    used.get(k).add(type);
  };
  /* Everything already planned counts, answered or not: a substitute should
     be a different question, not the one queued two turns later. */
  for (const ex of exercises) if (!isListening(ex.type)) note(ex, ex.type);

  const tail = [];
  for (const ex of exercises.slice(from)) {
    if (!isListening(ex.type)) {
      tail.push(ex);
      continue;
    }
    const resolved = resolveUnit(items, ex);
    /* Filtered here rather than trusting the clock, so this answers the same
       way whenever it is called — including from a test. */
    const options = (resolved ? enabledTypes(resolved.unit, settings) : []).filter(
      (t) => !isListening(t)
    );
    if (!options.length) continue;
    const seen = used.get(keyOf(ex)) || new Set();
    const pick = options.find((t) => !seen.has(t)) || options[0];
    note(ex, pick);
    tail.push({ ...ex, type: pick });
  }
  return exercises.slice(0, from).concat(tail);
}

/* Which exercise types this card's data can support.

   Note this is not filtered by the quiet window: it answers what the card
   holds, and the preview rows, the weak-card count and unitFullyLearnt all
   ask it that. Silencing here would make a card look broken, or call it
   fully learnt while a third of its exercises were merely paused. */
function availableTypes(it, lang = activeLang()) {
  const attr = quizAttrOf(lang);
  const drillsTranslit = lang.translitDrilled !== false;
  return TYPES.filter((t) => {
    const spec = EX[t];
    // Only offered where the language has named something to listen for, and
    // where this card's spelling actually yields it.
    if (spec.quizAttr && !(attr && derivedValue(attr, it.ar))) return false;
    // And not where going to and from the second writing would mean asking
    // for the word that is already on screen.
    if (!drillsTranslit && spec.needs.includes("lat")) return false;
    return spec.needs.every((f) => (f === "recs" ? (it.recs || []).length > 0 : it[f]));
  });
}

function enabledTypes(it, settings) {
  /* The language comes from the settings in hand, not from the module-level
     pointer — that is only set during render, and this runs from anywhere. */
  return availableTypes(it, langOf(settings)).filter(
    (t) => settings.types[t] && typeAllowedNow(t)
  );
}

/* Rule 2: a unit needs at least two exercise types to appear at all, and a
   family is drillable when its main form qualifies. */
function isDrillable(it, settings) {
  return settings.kinds[it.kind] && enabledTypes(it, settings).length >= 2;
}

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------------------------
   Similarity — rule 3
   ------------------------------------------------------------------ */

function similarity(a, b) {
  let score = 0;

  const tagsA = new Set(a.tags);
  const sharedTags = b.tags.filter((t) => tagsA.has(t)).length;
  score += sharedTags * 3;

  /* What counts as "alike" is the language's business: shared consonants in
     Arabic, the same spelling under different tones in Vietnamese. */
  const lang = activeLang();
  const key = lang.similarityKey || ((x) => String(x || ""));
  const ka = key(a.ar);
  const kb = key(b.ar);
  if (ka.length >= 2 && kb.length >= 2) {
    if (lang.similarityMode === "chars") {
      /* Arabic: shared consonants in any order suggest a shared root. */
      const setB = new Set(kb);
      const overlap = [...new Set(ka)].filter((ch) => setB.has(ch)).length;
      if (overlap >= 3) score += 4;
      else if (overlap === 2) score += 1.5;
    } else if (ka === kb) {
      /* Everyone else: the same word under different marks — a minimal pair. */
      score += 4;
    }
  }

  if (a.kind === b.kind) score += 0.5;
  // Added in the same sitting — usually the same lesson.
  if (Math.abs(a.created - b.created) < 10 * MIN) score += 1.5;

  return score;
}

const COHESION_POOL = { off: 1, balanced: 3, strong: 6 };

/* ------------------------------------------------------------------
   Session building
   ------------------------------------------------------------------ */

/* A state that isn't there is one that has never been answered, which is
   ready by definition. In memory every state should exist; this is the
   guard for the render that happens before a lift catches up. */
function stateReady(s) {
  return !s || s.phase === "new" || (s.due || 0) <= now();
}

const MAX_UNITS_PER_FAMILY = 4;

/* Recognition: the gentler half of the exercise set. Reading the script and
   hearing it, never producing either. Decoding used to be here too, as
   script → transliteration; that is retired, which is why a card supporting
   only one of these still belongs in the mode — see buildManualSession. */
const EASY_TYPES = ["ar2en", "rec2en"];

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
function hasRecentMistake(unit) {
  let sawHistory = false;
  for (const t of availableTypes(unit)) {
    const h = unit.s[t].hist || [];
    if (h.length) {
      sawHistory = true;
      if (h.slice(-2).some((x) => !x)) return true;
    }
  }
  // Nothing recorded yet — fall back to whether it has ever gone wrong.
  if (!sawHistory) {
    return availableTypes(unit).some((t) => (unit.s[t].wrong || 0) > 0 || (unit.s[t].lapses || 0) > 0);
  }
  return false;
}

/*
 * Keep consecutive questions from sharing an exercise type where the
 * material allows it. A greedy pass: take the next exercise whose type
 * differs from the one before, preferring a different item too.
 */
function varyTypes(list) {
  const out = [];
  const rest = list.slice();
  let prevType = null;
  let prevId = null;
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

function buildSession({ items, settings, inDeck, practice, includeAll, budget: budgetIn }) {
  const pool = items.filter((it) => inDeck(it) && isDrillable(it, settings));
  if (!pool.length) return { exercises: [], reason: "none-drillable" };

  const perUnit = Math.max(2, settings.perItem);
  const budget = Math.max(4, budgetIn || settings.sessionSize);

  /* --- candidate families --- */
  let candidates = pool.map((it) => {
    const units = drillableUnits(it, settings);
    const dues = [];
    for (const { unit } of units) {
      for (const t of enabledTypes(unit, settings)) dues.push(unit.s[t].due || 0);
    }
    const ready = units.some(({ unit }) =>
      enabledTypes(unit, settings).some((t) => stateReady(unit.s[t]))
    );
    const isNew = units.every(({ unit }) =>
      enabledTypes(unit, settings).every((t) => unit.s[t].phase === "new")
    );
    return { it, units, soonest: dues.length ? Math.min(...dues) : 0, ready, isNew };
  });

  // A hand-picked session takes everything chosen, due or not.
  if (!practice && !includeAll) {
    candidates = candidates.filter((c) => c.ready);
    if (settings.warmup) {
      const backlog = pool.filter((it) =>
        drillableUnits(it, settings).some(({ unit }) =>
          enabledTypes(unit, settings).some(
            (t) => difficulty(unit.s[t]) === "hard" && maturity(unit.s[t]) !== "mature"
          )
        )
      ).length;
      if (backlog >= HARD_BACKLOG_LIMIT) candidates = candidates.filter((c) => !c.isNew);
    }
    let newSeen = 0;
    candidates = candidates.filter((c) => {
      if (!c.isNew) return true;
      newSeen += 1;
      return newSeen <= settings.newPerSession;
    });
  }

  if (!candidates.length) return { exercises: [], reason: "nothing-due" };

  candidates.sort((a, b) => a.soonest - b.soonest);

  /* --- rule 3: reach further down the due list for related items --- */
  const avgUnits =
    candidates.reduce((n, c) => n + Math.min(c.units.length, MAX_UNITS_PER_FAMILY), 0) /
    candidates.length;
  const wanted = Math.max(1, Math.round(budget / (perUnit * Math.max(1, avgUnits))));
  const reach = COHESION_POOL[settings.cohesion] || 1;
  const shortlist = candidates.slice(0, Math.min(candidates.length, Math.max(wanted, wanted * reach)));

  const chosen = [shortlist.shift()];
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
    chosen.push(shortlist.splice(bestIdx, 1)[0]);
  }

  if (settings.warmup) {
    chosen.sort((a, b) => DIFF_RANK[itemDifficulty(a.it)] - DIFF_RANK[itemDifficulty(b.it)]);
  }

  /* --- rules 2 and 6: every unit gets several exercise types, and a
         family's sub-items come along in the same session --- */
  const plans = [];
  for (const c of chosen) {
    // Parent first, then whichever sub-items are most overdue.
    const parent = c.units.filter((u) => !u.isSub);
    const subs = c.units
      .filter((u) => u.isSub)
      .sort((a, b) => {
        const da = Math.min(...enabledTypes(a.unit, settings).map((t) => a.unit.s[t].due || 0));
        const db = Math.min(...enabledTypes(b.unit, settings).map((t) => b.unit.s[t].due || 0));
        return da - db;
      });
    const take = parent.concat(subs).slice(0, MAX_UNITS_PER_FAMILY);

    for (const { unit, isSub } of take) {
      const types = enabledTypes(unit, settings);
      const ordered = TYPES.filter((t) => types.includes(t));
      const readyFirst = ordered
        .filter((t) => stateReady(unit.s[t]))
        .concat(ordered.filter((t) => !stateReady(unit.s[t])));
      const picked = readyFirst.slice(0, Math.min(Math.max(2, perUnit), ordered.length));
      picked.sort((x, y) => TYPES.indexOf(x) - TYPES.indexOf(y));
      plans.push({ id: c.it.id, subId: isSub ? unit.id : null, types: picked });
    }
  }

  /* --- interleave, so a unit recurs with a gap rather than back to back --- */
  const exercises = [];
  const depth = Math.max(...plans.map((p) => p.types.length));
  for (let round = 0; round < depth; round++) {
    for (const p of plans) {
      if (p.types[round]) exercises.push({ id: p.id, subId: p.subId, type: p.types[round] });
    }
  }

  const varied = varyTypes(exercises);
  const distinct = new Set(varied.map((e) => e.type));
  if (distinct.size < 2) return { exercises: [], reason: "no-variety" };

  return {
    exercises: varied.slice(0, budget),
    reason: null,
    items: new Set(plans.map((p) => p.id)).size,
    units: plans.length,
  };
}

/* Every exercise type this form supports is already mature. */
function unitFullyLearnt(unit) {
  const types = availableTypes(unit);
  return types.length > 0 && types.every((t) => maturity(unit.s[t]) === "mature");
}

/* Exercise types follow from the mode, so there is nothing to choose. */
function typesForMode(mode, settings) {
  /* The second place the quiet window has to be honoured: the manual builder
     comes through here rather than through enabledTypes. Get started draws on
     two gentle types, one of which is listening, so during the window it
     builds from recognition alone — which is still the gentle end. */
  const enabled = TYPES.filter((t) => settings.types[t] && typeAllowedNow(t));
  return mode === "started" ? enabled.filter((t) => EASY_TYPES.includes(t)) : enabled;
}

/* Ultimate drills every type on every card; the rest take a sample. */
function everyTypeMode(mode) {
  return mode === "ultimate";
}

/*
 * A session assembled by hand. Fully learnt forms are left out — there is
 * nothing to gain from drilling them — and the caller is told which cards
 * were skipped for that reason so it can say so.
 */
function buildManualSession({ items, settings, ids, mode, count }) {
  const chosen = new Set(ids);
  const allowed = new Set(typesForMode(mode, settings));
  /* Two types is the rule everywhere else, and it is what keeps a session
     from being one exercise repeated. Get started draws on the two gentle
     types alone, one of which needs a recording, so holding it to two would
     quietly turn the beginners' mode into one that only accepts cards with
     audio. It takes a card on one. */
  const minTypes = mode === "started" ? 1 : 2;
  if (allowed.size < minTypes) return { exercises: [], reason: "no-variety" };

  const pool = items.filter((i) => chosen.has(i.id) && settings.kinds[i.kind]);
  const perUnit = Math.max(2, settings.perItem);
  const plans = [];
  const learnt = [];

  for (const it of pool) {
    let anyUsable = false;
    let anyLearnt = false;

    for (const { unit, isSub } of unitsOf(it)) {
      const usable = availableTypes(unit).filter((t) => allowed.has(t));
      if (usable.length < minTypes) continue;
      if (unitFullyLearnt(unit)) {
        anyLearnt = true;
        continue;
      }
      if (mode === "mistakes" && !hasRecentMistake(unit)) continue;
      anyUsable = true;

      const take = everyTypeMode(mode)
        ? usable
        : shuffle(usable).slice(0, Math.min(perUnit, usable.length));
      for (const t of take) plans.push({ id: it.id, subId: isSub ? unit.id : null, type: t });
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
  const ordered = varyTypes(shuffle(plans));
  const exercises = everyTypeMode(mode) ? ordered : ordered.slice(0, Math.max(4, count));

  /* The same minimum again, and the one easily missed: when every card chosen
     supports a single gentle type the whole session is that one type, so
     relaxing only the per-card check above would still refuse to build. */
  if (new Set(exercises.map((e) => e.type)).size < minTypes)
    return { exercises: [], reason: "no-variety", learnt };

  return {
    exercises,
    reason: null,
    manual: true,
    mode,
    learnt,
    items: new Set(exercises.map((e) => e.id)).size,
    units: plans.length,
  };
}

/* Resolve an exercise back to the item and the specific form it drills. */
function resolveUnit(items, ex) {
  if (!ex) return null;
  const parent = items.find((i) => i.id === ex.id);
  if (!parent) return null;
  if (!ex.subId) return { parent, unit: parent, isSub: false };
  const sb = (parent.subs || []).find((x) => x.id === ex.subId);
  return sb ? { parent, unit: sb, isSub: true } : null;
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


/* Cards whose spelling matches but whose tone does not. */
function minimalPairs(items, lang, text) {
  const attr = groupAttrOf(lang);
  const tone = quizAttrOf(lang);
  if (!attr || !tone || !text) return [];
  const key = derivedValue(attr, text);
  if (!key) return [];
  const mine = derivedValue(tone, text);
  const out = [];
  const seen = new Set();
  for (const it of items) {
    for (const { unit } of unitsOf(it)) {
      const other = unit.ar;
      if (!other || other === text) continue;
      if (derivedValue(attr, other) !== key) continue;
      if (derivedValue(tone, other) === mine) continue;
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

const LEGACY_SYNC_KEYS = new Set();


/* ------------------------------------------------------------------
   Answer matching
   ------------------------------------------------------------------ */

/* Words spelt the same but toned differently. These are the pairs a learner
   confuses, and they are worth seeing at the moment of getting one wrong. */
/* The pairs are worked out once, when the answer is checked, and handed in
   — not recomputed from every card on every render of the answered state. */
function MinimalPairs({ pairs, settings }) {
  if (!pairs || !pairs.length) return null;
  const lang = langOf(settings);
  const attr = quizAttrOf(lang);
  return (
    <div className="at-pairs">
      <p className="at-answerlabel">
        Also spelt this way, with a different {attr ? attr.label : "sound"}
      </p>
      {pairs.map((p) => (
        <p key={p.text} className="at-hint">
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

const FIELD_ALIASES = {
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
const ARABIC_RE = /[\u0600-\u06FF]/;
const FIELD_ORDER = ["en", "ar", "lat", "tags", "note"].concat(grammarFields());
const MD_SEPARATOR = /^:?-+:?$/;
const ESC = "\u0000";

function splitRow(line) {
  return (line.includes("\t") ? line.split("\t") : line.split("|")).map((p) => p.trim());
}

function stripMd(cell) {
  return cell
    .split(ESC)
    .join("|")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function mdCells(line) {
  return line
    .replace(/\\\|/g, ESC)
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map(stripMd);
}

function isSeparatorLine(line) {
  if (!line) return false;
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const cells = mdCells(t);
  return cells.length > 0 && cells.every((c) => MD_SEPARATOR.test(c));
}

function readHeader(cells) {
  if (cells.length < 2) return null;
  const map = cells.map((c) => FIELD_ALIASES[c.toLowerCase().replace(/[^a-z]/g, "")]);
  return map.every(Boolean) ? map : null;
}

function parseLines(text, knownTags = []) {
  const out = [];
  const known = new Set(knownTags.map((t) => t.toLowerCase()));
  const lines = String(text).split(/\r?\n/);
  const mdMode = lines.some((l) => l.trim().startsWith("|"));
  let order = null;
  let skipped = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line || line.startsWith("#")) continue;

    let cells;
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

    const row = { ar: "", lat: "", en: "", tags: "", note: "" };
    for (const f of grammarFields()) row[f] = "";
    const loose = [];

    cells.forEach((cell, i) => {
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
        if (row.ar && !ARABIC_RE.test(row.ar)) {
          const holder = ["en", "lat"].find((k) => row[k] && ARABIC_RE.test(row[k]));
          if (holder) {
            const tmp = row.ar;
            row.ar = row[holder];
            row[holder] = tmp;
          }
        }
      } else {
        const values = loose.map((c) => c.value);
        const arIdx = values.findIndex((v) => ARABIC_RE.test(v));
        if (arIdx !== -1 && !row.ar) row.ar = values.splice(arIdx, 1)[0];
        if (values.length > 1 && known.size && !row.tags) {
          const parts = cleanTags(values[values.length - 1]);
          if (parts.length && parts.every((t) => known.has(t.toLowerCase()))) {
            row.tags = values.pop();
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

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(items) {
  const head = ["english", "script", "transliteration"]
    .concat(grammarFields())
    .concat(["form_of", "kind", "tags", "note"]);
  for (const t of TYPES) head.push(`${t}_phase`, `${t}_days`, `${t}_due`);
  const rows = [];
  for (const i of items) {
    for (const { unit, isSub } of unitsOf(i)) {
      const cells = [
        unit.en,
        unit.ar,
        unit.lat,
        ...grammarFields().map((f) => unit[f] || i[f] || ""),
        isSub ? i.en || i.ar || i.lat : "",
        i.kind,
        i.tags.join(", "),
        unit.note || "",
      ];
      for (const t of TYPES) {
        const st = unit.s[t];
        cells.push(st.phase, st.interval, st.due ? new Date(st.due).toISOString() : "");
      }
      rows.push(cells.map(csvCell).join(","));
    }
  }
  return [head.join(","), ...rows].join("\n");
}

function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

function liftState(s) {
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

function liftStates(old = {}) {
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

function liftItem(it) {
  return {
    ...it,
    tags: Array.isArray(it.tags) ? it.tags : [],
    locked: !!it.locked,
    flags: it.flags || [],
    recs: it.recs || [],
    ...dimValues(it),
    subs: (it.subs || []).map((sb) => ({
      ...sb,
      ...dimValues(sb),
      recs: sb.recs || [],
      s: liftStates(sb.s),
    })),
    s: liftStates(it.s),
  };
}

function merge(parsedIn) {
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
   put back on load. See compactItem in sync.js for why. */
async function saveData(data) {
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

let audioCtx = null;
let soundsOn = true;
let lastSound = 0;

function setSounds(on) {
  soundsOn = !!on;
}

function ctx() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  // Browsers start it suspended until you've interacted with the page.
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

/* One note: a shaped blip with an optional pitch slide. */
function note(c, { freq, at = 0, dur = 0.12, type = "sine", peak = 0.07, to }) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

  // Quick in, gentle out — a click rather than a beep.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  /* Three notes up a major triad, the last one held. Still small and pleased
     rather than triumphant — the extra note is there so the verdict lands,
     not to celebrate. */
  correct: (c) => {
    note(c, { freq: 660, dur: 0.1, peak: 0.06 });
    note(c, { freq: 880, at: 0.09, dur: 0.12, peak: 0.058 });
    note(c, { freq: 1319, at: 0.2, dur: 0.22, peak: 0.05 });
  },
  /* A slump, then a lower one settling under it. Deliberately gentle and
     quieter than correct: you'll hear this one a lot, and it should read as
     "not that" rather than as a buzzer. */
  wrong: (c) => {
    note(c, { freq: 300, to: 220, dur: 0.18, type: "triangle", peak: 0.05 });
    note(c, { freq: 220, to: 165, at: 0.16, dur: 0.22, type: "triangle", peak: 0.045 });
  },
  // Barely there — the sound of a card turning over.
  tick: (c) => {
    note(c, { freq: 880, dur: 0.045, peak: 0.028 });
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
  // A muted thud for anything destructive.
  warn: (c) => {
    note(c, { freq: 240, to: 170, dur: 0.14, type: "triangle", peak: 0.055 });
  },
  // A little bubble, for undo and other small reversals.
  pop: (c) => {
    note(c, { freq: 420, to: 900, dur: 0.07, peak: 0.05 });
  },
};

function sfx(kind) {
  if (!soundsOn || !SOUNDS[kind]) return;
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
let dbPromise = null;

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
      const settle = (db) => {
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

function idbRun(mode, fn) {
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

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read-failed"));
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "audio/webm";
  const bin = atob(body || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* --- the API the rest of the app uses --- */

async function saveClipBlob(id, blob) {
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
const MISSING_CLIPS = new Map();
const MISSING_FOR_MS = 5 * 60000;

function knownMissing(id) {
  const at = MISSING_CLIPS.get(id);
  if (at === undefined) return false;
  if (now() - at > MISSING_FOR_MS) {
    MISSING_CLIPS.delete(id);
    return false;
  }
  return true;
}

/* What this device holds, and nothing else: no network, no side effects. */
async function localClipBlob(id) {
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
async function hasClipLocal(id) {
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
async function clipDataUrl(id) {
  const blob = await localClipBlob(id);
  return blob ? blobToBase64(blob) : null;
}

async function clipBlob(id) {
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
    if (e && e.message !== "offline") MISSING_CLIPS.set(id, now());
  }
  return null;
}

/* A playable URL. Made for one player and handed back to it; the player
   revokes it when it is done. Keeping one alive per clip for the life of
   the app kept every recording in memory once it had been touched. */
async function clipUrl(id) {
  const blob = await clipBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

async function dropClip(id) {
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
async function warmClips(ids, { concurrency = 3, onProgress } = {}) {
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
function saveClip(id, dataUrl) {
  return saveClipBase64(id, dataUrl);
}

async function saveClipBase64(id, dataUrl) {
  return saveClipBlob(id, base64ToBlob(dataUrl));
}

/* One-off move of anything left in the old text store. */
async function migrateClips(ids) {
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

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
}
function u16(n) {
  return [n & 255, (n >>> 8) & 255];
}

async function makeZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
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

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

async function readZip(blob) {
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
  const out = [];

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

const AUDIO_KEY = (id) => `audio-${id}`;

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
function startRecorder(onStop, onError) {
  const mime = pickMime();
  let stopped = false;
  let rec = null;
  let stream = null;
  const chunks = [];

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
async function compressAudio(file) {
  const raw = await file.arrayBuffer();
  if (raw.byteLength <= 60000 || !canRecord()) return { blob: file, mime: file.type };

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
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
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);

    const done = new Promise((res) => {
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

function formatBytes(n) {
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
    const onChange = (e) => setFine(e.matches);
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
function useSoftKeyboard() {
  const [kb, setKb] = useState({ open: false, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let last = { open: false, height: null };
    const onChange = () => {
      const open = vv.height / window.innerHeight < 0.78;
      const height = Math.round(vv.height);
      /* The visual viewport reports a slightly different height on nearly
         every scroll event while the keyboard is up. Re-rendering the whole
         app for each of those is wasted; only a real change gets through. */
      if (open === last.open && last.height !== null && Math.abs(height - last.height) < 20) {
        return;
      }
      last = { open, height };
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

function Keyboard({ onKey, onBack, onClear, mode = "auto", lang }) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  const rows = L.keys.rows;
  const extras = L.keys.extras;
  const marksList = L.keys.marks;
  const fine = useFinePointer();
  const wanted = mode === "always" ? true : mode === "never" ? false : fine;
  const [open, setOpen] = useState(wanted);
  const [marks, setMarks] = useState(false);

  useEffect(() => {
    setOpen(wanted);
  }, [wanted]);

  if (!open) {
    return (
      <div className="at-kbtoggle">
        <button type="button" className="at-btn ghost sm" onClick={() => setOpen(true)}>
          Show on-screen keys
        </button>
      </div>
    );
  }

  return (
    <div className="at-kb">
      {rows.map((row, i) => (
        <div className="at-kbrow" key={i}>
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
        <button type="button" className="at-key util" onClick={() => setOpen(false)}>
          hide
        </button>
      </div>
      {marks && (
        <div className="at-kbrow">
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

function caretInsert(ref, value, setValue, ch) {
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
    } catch (err) {}
  });
}

function caretBackspace(ref, value, setValue) {
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
    } catch (err) {}
  });
}


/* ------------------------------------------------------------------
   Small components
   ------------------------------------------------------------------ */

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};





/* The target language's own script, however it is written. */
function Arabic({ text, kind, lang }) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  return (
    <p
      className={`at-arabic ${kind || "word"}`}
      lang={L.id}
      dir={L.direction}
      style={{ fontFamily: L.fontStack, direction: L.direction }}
    >
      {text}
    </p>
  );
}

const NO_RECS = [];

function AudioPrompt({ recs, autoPlay }) {
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState("idle");
  const audioRef = useRef(null);
  const urlRef = useRef("");
  const list = recs || NO_RECS;
  /* Which recordings this is showing, as one string, so the reset below
     fires when any of them changes and not only the first. */
  const signature = list.map((r) => r.id).join("|");

  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
  };

  const play = useCallback(
    async (i) => {
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
    [signature]
  );

  useEffect(() => {
    setIdx(0);
    setState("idle");
    if (autoPlay) play(0);
    return () => {
      if (audioRef.current) audioRef.current.pause();
      releaseUrl();
    };
  }, [signature]);

  if (!list.length) return <Notice kind="warn">No recording for this form.</Notice>;

  return (
    <div>
      <button className="at-playbig" onClick={() => play(idx)}>
        <span className="dot"><Icon name={state === "playing" ? "pause" : "play"} /></span>
        {state === "loading" ? "Loading" : state === "missing" ? "Not on this device" : "Play"}
      </button>
      {list.length > 1 && (
        <div className="at-voices">
          {list.map((r, i) => (
            <button
              key={r.id}
              className={`at-voice${i === idx ? " on" : ""}`}
              onClick={() => {
                setIdx(i);
                play(i);
              }}
              aria-label={`Recording ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ value, field, kind, lang }) {
  if (!value) return null;
  if (field === "ar") return <Arabic text={value} kind={kind} lang={lang || activeLang()} />;
  if (field === "lat") return <p className="at-latin">{value}</p>;
  return <p className="at-en">{value}</p>;
}

const FLAG_LABEL = {
  strict: "Check too strict",
  data: "Data looks wrong",
  audio: "Recording problem",
  other: "Flagged",
};

/*
 * After an answer there is nothing to grade by hand: the check decides,
 * and the interval follows from that. All that's left is a quiet way to
 * say the check got it wrong, or that something about the item is off.
 */
const FLAG_KINDS = [
  { key: "strict", label: "The check was too strict", fixes: true },
  { key: "data", label: "This card's data is wrong" },
  { key: "audio", label: "The recording is unclear or missing", audioOnly: true },
  { key: "other", label: "Something else" },
];

function AfterAnswer({ ok, overridden, hasAudio, onOverride, onFlag, flagged, onContinue }) {
  const [open, setOpen] = useState(false);

  const kinds = FLAG_KINDS.filter((k) => !k.audioOnly || hasAudio);

  return (
    <div className="at-after">
      <Button variant="primary" wide className="at-continue" onClick={onContinue}>
        Continue
      </Button>

      <div className="at-flagwrap">
        <button
          className={`at-flagbtn${flagged ? " on" : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          ⚑ {flagged ? "Flagged" : "Flag a problem"}
        </button>

        {open && (
          <div className="at-flagmenu">
            {kinds.map((k) => (
              <button
                key={k.key}
                className="at-flagopt"
                onClick={() => {
                  if (k.fixes && !ok && !overridden) onOverride();
                  onFlag(k.key);
                  setOpen(false);
                }}
              >
                {k.label}
                {k.fixes && !ok && !overridden && <span>counts it correct</span>}
              </button>
            ))}
          </div>
        )}
      </div>
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
function saveTeaches(yes) {
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
function saveListenOff(until) {
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

  const [deck, setDeck] = useState([]);
  const [session, setSession] = useState(null); // { exercises, practice, items }
  /* Null until the person has set up or signed in; the app shows the
     welcome screens until then. */
  const [account, setAccount] = useState(() => API.loadAccount());
  /* A teacher opens into teaching; everyone else into learning. */
  const [space, setSpace] = useState(() => (loadTeaches() ? "teach" : "learn"));
  const [screen, setScreen] = useState(null); // null | "account" | "prefs"
  /* Remembered, because it decides whether the Teaching option exists at all.
     Deriving it only from a fresh network call meant a slow or failed request
     took the space selector away, with no way back but signing out. */
  const [teaches, setTeaches] = useState(() => loadTeaches());
  /* Read from the device rather than started at zero, so closing the app on
     the bus and opening it again does not start playing audio. */
  const [listenOff, setListenOff] = useState(() => loadListenOff());
  /* Pushed into the module flag here and not further down beside setSounds:
     the memos that decide what is drillable run below this line and go
     through enabledTypes, so the flag has to be true before they do. */
  setListenOffUntil(listenOff);
  const [myCourses, setMyCourses] = useState([]);
  /* A deck the person asked to practise from the Courses tab, handed to the
     cards tab once it is on screen. */
  const [deckWanted, setDeckWanted] = useState(null);
  const [courseDecks, setCourseDecks] = useState([]);
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState("");

  /* Teaching is a role on a course, so it has to be asked about — and the
     material request answers it, so it is no longer asked twice. */
  const [building, setBuilding] = useState(false);
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
  }, [account && account.key]);
  const [now_, setNow_] = useState(0); // ticks only while a timed session runs
  const [qi, setQi] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(null);
  const [pairs, setPairs] = useState([]); // minimal pairs for the answered card
  const [skipped, setSkipped] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [flaggedNow, setFlaggedNow] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tally, setTally] = useState({ ok: 0, no: 0 });

  const timer = useRef(null);
  const inputRef = useRef(null);
  const undoTimer = useRef(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  /* Every short-lived message the app says, here and in the teaching and
     admin screens below, which reach it through SnackbarProvider. */
  const snack = useSnackbarState();
  const kb = useSoftKeyboard();

  /* ---- sync ---- */
  const [syncCfg, setSyncCfg] = useState(() => ({ token: "", lastSync: 0 }));
  const [syncState, setSyncState] = useState("idle"); // idle|syncing|ok|error|off
  const [syncError, setSyncError] = useState("");
  const syncTimer = useRef(null);
  const syncing = useRef(false);
  const fromSync = useRef(false);
  /* The document as the writers see it. Every change goes through commit()
     so the ref is current the moment it is made, not at the next render:
     two async writers finishing in the same tick — the launch sync and the
     first course refresh, say — used to each build on the state before the
     other's change and the second silently undid the first. */
  const dataRef = useRef(data);
  const commit = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    setSyncCfg(loadSyncConfig());
  }, []);

  const runSync = useCallback(
    async (token) => {
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
            writeLocal: (id, url) => saveClip(id, url),
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
        const msg = String((err && err.message) || err);
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
  }, [ready, account && account.key, runSync]);

  // After anything changes — which covers the end of a session.
  useEffect(() => {
    if (!ready || !syncCfg.token) return;
    if (fromSync.current) {
      fromSync.current = false;
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => runSync(), 4000);
    return () => syncTimer.current && clearTimeout(syncTimer.current);
  }, [data, ready, syncCfg.token, runSync]);

  // Heartbeat for the countdown on a timed session.
  useEffect(() => {
    if (!session || !session.endsAt) return;
    const id = setInterval(() => setNow_(Date.now()), 500);
    return () => clearInterval(id);
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
  }, [ready]);

  /* Takes the next document, or a function of the current one. The
     function form is for anything that can run while a sync or a course
     refresh is in flight — grading, flagging — so it builds on what is
     current rather than on the render it was created in. */
  const persist = useCallback(
    (nextOrFn) => {
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

  const items = data.items;
  const settings = data.settings;
  // Keep the module-level pointer in step, for the pure helpers that have no
  // settings to hand. Derived from state, so it cannot drift.
  setActiveLang(settings.language);

  /* Every recording the cards refer to, for taking a course offline. */
  const allClipIds = useMemo(() => {
    const ids = [];
    for (const it of items) {
      for (const { unit } of unitsOf(it)) for (const r of unit.recs || []) ids.push(r.id);
    }
    return ids;
  }, [items]);

  const allTags = useMemo(() => {
    const counts = {};
    for (const it of items) for (const t of it.tags) counts[t] = (counts[t] || 0) + 1;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [items]);

  const inDeck = useCallback(
    (it) => deck.length === 0 || it.tags.some((t) => deck.includes(t)),
    [deck]
  );

  const drillable = useMemo(
    () => items.filter((it) => inDeck(it) && isDrillable(it, settings)),
    [items, settings, inDeck]
  );

  const readyCount = useMemo(
    () =>
      drillable.filter((it) =>
        drillableUnits(it, settings).some(({ unit }) =>
          enabledTypes(unit, settings).some((t) => stateReady(unit.s[t]))
        )
      ).length,
    [drillable, settings]
  );

  const dueByTag = useMemo(() => {
    const out = {};
    for (const it of items) {
      if (!isDrillable(it, settings)) continue;
      if (
        !drillableUnits(it, settings).some(({ unit }) =>
          enabledTypes(unit, settings).some((t) => stateReady(unit.s[t]))
        )
      )
        continue;
      for (const t of it.tags) out[t] = (out[t] || 0) + 1;
    }
    return out;
  }, [items, settings]);

  /* ---------------- session ---------------- */

  /* A session assembled by hand on the Build screen. */
  function beginManual({ ids, mode, count, minutes }) {
    const built = buildManualSession({ items, settings, ids, mode, count });
    setBuilding(false);
    if (!built.exercises.length) {
      flash(
        built.reason === "no-mistakes"
          ? "Nothing to fix — none of those have gone wrong recently"
          : built.reason === "no-variety"
          ? "That needs at least two exercise types"
          : "Those cards don't have enough to practise yet"
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
    async (announce) => {
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
        const courseLangs = [];
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
      }
    },
    [account && account.handle]
  );

  useEffect(() => {
    if (ready && account) refreshCourses(false);
  }, [ready, account && account.handle, refreshCourses]);

  /* Sync now should mean everything, not just this device's own cards: the
     courses are the other half of what a student holds, and a course that has
     been withdrawn is exactly what someone pressing it wants to find out. */
  const syncEverything = useCallback(async () => {
    await Promise.allSettled([runSync(), account ? refreshCourses("changes") : null]);
  }, [runSync, refreshCourses, account && account.handle]);

  /* A course can be deleted, or its decks changed, by a teacher on another
     device. Without this the home screen keeps showing a course that is gone
     until the app is reloaded. */
  const recheckCourses = useCallback(() => {
    if (ready && account) refreshCourses(false);
  }, [ready, account && account.handle, refreshCourses]);
  useLiveRefresh(recheckCourses);

  /* Fetch, in the background, the recordings a session is about to play.
     Done here on purpose rather than as a side effect of sync, so the first
     sync on a new device no longer downloads every recording in every
     course before it does anything else. */
  function warmSession(built) {
    const ids = [];
    for (const ex of built.exercises || []) {
      const r = resolveUnit(items, ex);
      if (r && r.unit) for (const rec of r.unit.recs || []) ids.push(rec.id);
    }
    if (ids.length) warmClips(ids).catch(() => {});
  }

  function begin(practice) {
    const built = buildSession({ items, settings, inDeck, practice });
    if (!built.exercises.length) {
      /* This used to return in silence, which reads as a broken button. It
         mattered little when the only way to get here was a card list that
         was plainly too thin; with listening switched off it is reachable
         with a deck full of cards, and the reason has to be said. */
      flash(
        listenOff > Date.now()
          ? "Nothing to practise without sound just now"
          : "Nothing ready to practise yet"
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
    const cleared = items.map((it) => ({
      ...it,
      s: freshStates(),
      subs: (it.subs || []).map((sb) => ({ ...sb, s: freshStates() })),
      updated: now(),
    }));
    persist({ ...data, items: cleared, log: {} });
    setSession(null);
    flash("Scheduling reset — nothing is due until you practise it");
  }

  function resetExercise() {
    setTyped("");
    setChecked(null);
    setPairs([]);
    setSkipped(false);
    setOverridden(false);
    setFlaggedNow(false);
    setHintOpen(settings.showHint);
  }

  const exercise = session && qi < session.exercises.length ? session.exercises[qi] : null;
  const resolved = exercise ? resolveUnit(items, exercise) : null;
  const item = resolved ? resolved.unit : null; // the form being drilled
  const parentItem = resolved ? resolved.parent : null;
  const isSub = !!(resolved && resolved.isSub);
  const state = item && exercise ? item.s[exercise.type] : null;
  const spec = exercise ? exOf(exercise.type, langOf(settings)) : null;
  const practice = !!(session && session.practice);

  useEffect(() => {
    if (exercise && inputRef.current && !checked) inputRef.current.focus();
  }, [qi]);

  function submit() {
    if (!item || checked) return;
    const result = checkAnswer(typed, item, exercise.type, settings);
    sfx(result.ok ? "correct" : "wrong");
    setPairs(minimalPairs(items, langOf(settings), item.ar));
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
    setSession((s) => (s ? { ...s, exercises: next } : s));
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

  function giveUp() {
    sfx("warn");
    setPairs(minimalPairs(items, langOf(settings), item ? item.ar : ""));
    setSkipped(true);
    setChecked({ ok: false, reason: "skipped" });
    if (inputRef.current) inputRef.current.blur();
  }

  /* Record a problem against the item, so it can be found and fixed later. */
  function flagCurrent(kind) {
    if (!parentItem || !exercise) return;
    setFlaggedNow(true);
    sfx("tick");
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice() };
      const idx = next.items.findIndex((i) => i.id === parentItem.id);
      if (idx < 0) return cur;
      const it = { ...next.items[idx] };
      it.flags = (it.flags || [])
        .filter((f) => !(f.kind === kind && f.ex === exercise.type && f.subId === (exercise.subId || null)))
        .concat([{ kind, ex: exercise.type, subId: exercise.subId || null, at: now() }]);
      it.updated = now();
      next.items[idx] = it;
      return next;
    });
  }

  function applyGrade() {
    if (!item || !exercise) return;
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
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice(), log: { ...cur.log } };
      const idx = next.items.findIndex((i) => i.id === parentItem.id);
      if (idx < 0) return cur; // withdrawn while it was on screen
      const it = { ...next.items[idx] };
      const target = exercise.subId
        ? (it.subs || []).find((x) => x.id === exercise.subId)
        : it;
      if (!target) return cur;

      const before = target.s[exercise.type] || freshState();
      let s;
      if (!practice || rating !== "good") {
        s = reschedule(before, rating);
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
      s.hist = (s.hist || []).concat([correct ? 1 : 0]).slice(-6);
      s.updated = now();

      if (exercise.subId) {
        it.subs = (it.subs || []).map((x) =>
          x.id === exercise.subId ? { ...x, s: { ...x.s, [exercise.type]: s }, updated: now() } : x
        );
      } else {
        it.s = { ...it.s, [exercise.type]: s };
      }
      it.updated = now();
      next.items[idx] = it;

      next.log[dayKey()] = (next.log[dayKey()] || 0) + 1;
      return next;
    });

    setTally((t) => ({
      ok: t.ok + (correct ? 1 : 0),
      no: t.no + (correct ? 0 : 1),
    }));

    if (!correct) {
      setSession((s2) => ({ ...s2, exercises: s2.exercises.concat([{ ...exercise }]) }));
    }
    setQi((i) => i + 1);
    resetExercise();
    // The last card of a session earns a different feel from the rest.
    if (session && qi + 1 >= session.exercises.length) sfx("complete");
    else sfx("tick");
  }

  /* ---------------- items ---------------- */

  function addItems(list) {
    const fresh = list.filter((p) => p.ar || p.lat || p.en).map(makeItem);
    if (!fresh.length) return 0;
    persist({ ...data, items: items.concat(fresh) });
    return fresh.length;
  }

  /* Editing keeps every existing progress record. Sub-items are matched by
     id where they already exist, so correcting a plural's spelling doesn't
     reset what you've learnt about it. */
  function updateItem(id, patch) {
    const target = items.find((i) => i.id === id);
    if (target && target.locked && !("locked" in patch)) {
      flash("That card is locked — unlock it first");
      return;
    }
    persist({
      ...data,
      items: items.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, updated: now() };
        for (const [k, v] of Object.entries(patch)) {
          if (k === "subs" || k === "s") continue;
          if (k === "tags") next.tags = cleanTags(v);
          else next[k] = typeof v === "string" ? v.trim() : v;
        }
        if (patch.subs) {
          const old = new Map((i.subs || []).map((x) => [x.id, x]));
          next.subs = patch.subs.map((draft) => {
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
  function bulkEdit(ids, patch) {
    updateMany(unlockedOf(ids), (i) => ({ ...i, ...patch }));
  }

  /* Locked items are left alone by anything that changes them. */
  function unlockedOf(ids) {
    const set = new Set(ids);
    const targets = items.filter((i) => set.has(i.id));
    const locked = targets.filter((i) => i.locked).length;
    if (locked) flash(`${plural(locked, "locked card")} left unchanged`);
    return targets.filter((i) => !i.locked).map((i) => i.id);
  }

  function tagMany(ids, tag) {
    const clean = cleanTags(tag)[0];
    if (!clean) return;
    updateMany(unlockedOf(ids), (i) =>
      i.tags.includes(clean) ? i : { ...i, tags: i.tags.concat([clean]) }
    );
  }

  function setLockedMany(ids, locked) {
    sfx("tick");
    updateMany(ids, (i) => ({ ...i, locked }));
    flash(`${plural(ids.length, "item")} ${locked ? "locked" : "unlocked"}`);
  }

  function untagMany(ids, tag) {
    updateMany(ids, (i) => ({ ...i, tags: i.tags.filter((t) => t !== tag) }));
  }

  function setKindMany(ids, kind) {
    updateMany(ids, (i) => ({ ...i, kind }));
  }

  function removeItems(ids) {
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
  function flash(msg, kind) {
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
  function updateMany(ids, fn) {
    const set = new Set(ids);
    persist({
      ...data,
      items: items.map((i) => (set.has(i.id) ? { ...fn(i), updated: now() } : i)),
    });
  }

  const setSetting = (k, v) =>
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

  const toggleIn = (group, k) =>
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
  function absorb(parsed) {
    return merge(mergeData(dataRef.current, merge(parsed)));
  }

  function confirmImport(parsed) {
    const n = (parsed.items || []).length;
    return window.confirm(
      `Merge ${plural(n, "card")} from this file into your collection? ` +
        "Cards you already have keep whichever version was edited last."
    );
  }

  async function importZip(file) {
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

  function importFile(file) {
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

  const toggleDeck = (tag) =>
    tag === null
      ? setDeck([])
      : setDeck((d) => (d.includes(tag) ? d.filter((t) => t !== tag) : d.concat([tag])));

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
          <Onboarding onDone={(a) => setAccount(a)} />
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
  setSounds(settings.sounds !== false);
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
      style={{
        "--sdir": langOf(settings).direction || "ltr",
        "--sfont": langOf(settings).fontStack,
        ...(kbOpen && kb.height ? { minHeight: kb.height } : null),
      }}
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
              <div className="at-empty">
                <Help>
                  Your cards come from the courses you're in. Enter the code your teacher gave
                  you and their decks appear here, ready to practise.
                </Help>
                <div className="at-mt5">
                  <Button variant="primary" onClick={() => setTab("courses")}
          icon="school"
        >
          Join a course
        </Button>
                </div>
              </div>
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
                    <Button variant="primary"
                      onClick={() => begin(false)}
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

                  {!readyCount && drillable.length > 0 && (
                    <Help>{nextDueLine(drillable, settings)}</Help>
                  )}
                  {!drillable.length && items.length > 0 && (
                    <Notice kind="warn">
                      No card here has two usable exercise types. A card needs the{" "}
                      {langOf(settings).scriptLabel.toLowerCase()} and at least one more field
                      before it can be practised.
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
                {session.learnt.map((x) => x.en || x.ar || x.lat).join(", ")}
              </Help>
            )}

            {session && exercise && item && spec && (
              <>
                <div className="at-headline">
                  <button
                    className="at-exit"
                    aria-label="Leave session"
                    onClick={() => setLeaving(true)}
                  >
                    <Icon name="close" />
                  </button>
                  <span className="at-count">
                    {timeLeft !== null
                      ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
                      : `${qi + 1} / ${session.exercises.length}`}
                  </span>
                  <div className="at-progress">
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
                </div>

                {/* Once the answer is up, the question and the box you typed
                    into step back so the answer holds the eye. */}
                <div className={`at-card${checked ? " at-asked" : ""}`}>
                  <p className="at-instruction">
                    {spec.instruction}
                    {isSub && <span className="at-formtag"> · {labelFor(item)}</span>}
                  </p>
                  <div className={`at-ask${checked ? " done" : ""}`}>
                    {spec.promptField === "audio" ? (
                      <AudioPrompt recs={item.recs} autoPlay />
                    ) : (
                      <Field
                        value={item[spec.promptField]}
                        field={spec.promptField}
                        kind={item.kind}
                      />
                    )}
                  </div>

                  {hintOpen && item[spec.hintField] && (
                    <Field value={item[spec.hintField]} field={spec.hintField} kind={item.kind} />
                  )}
                  {!hintOpen && item[spec.hintField] && !checked && (
                    <Button variant="ghost" size="sm" className="at-hintbtn" onClick={() => setHintOpen(true)}>
                      {spec.hintLabel}
                    </Button>
                  )}

                  {/* A listening exercise carries no hint, so this slot is
                      free exactly when this button is wanted. Somewhere with
                      no sound, the alternative to it is failing every
                      recording in turn or abandoning the session. */}
                  {isListening(exercise.type) && !checked && (
                    <Button variant="ghost" size="sm" className="at-quietbtn" onClick={goQuiet}>
                      Can't listen right now
                    </Button>
                  )}

                  <div className="at-mt4" className={`at-answerbox${checked ? " done" : ""}`}>
                    {spec.answerMode === "choice" ? (
                      <Segmented
                        size={null}
                        label="Your answer"
                        disabled={!!checked}
                        options={((quizAttrOf(langOf(settings)) || {}).classes || []).map((c) => ({
                          value: c.id,
                          label: c.label,
                        }))}
                        value={typed}
                        onChange={setTyped}
                      />
                    ) : (
                      <input
                        ref={inputRef}
                        /* "ar" here means the language's own script, so the
                           input is declared as that language — not as Arabic,
                           which sent Vietnamese answers through an Arabic
                           spellchecker and read them out as Arabic. */
                        lang={spec.answerMode === "ar" ? langOf(settings).id : undefined}
                        dir={spec.answerMode === "ar" ? langOf(settings).direction : undefined}
                        className={`at-input${spec.answerMode === "ar" ? " ar" : ""}${
                          checked ? (checked.ok ? " ok" : " no") : ""
                        }`}
                        value={typed}
                        readOnly={!!checked}
                        placeholder={spec.placeholder}
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !checked && typed.trim()) submit();
                        }}
                      />
                    )}
                  </div>

                  {!checked && spec.answerMode === "ar" && (
                    <Keyboard
                      lang={langOf(settings)}
                      onKey={(ch) => caretInsert(inputRef, typed, setTyped, ch)}
                      onBack={() => caretBackspace(inputRef, typed, setTyped)}
                      onClear={() => setTyped("")}
                      mode={settings.keyboard}
                    />
                  )}

                  {checked ? (
                    <>
                      <p className={`at-shout ${checked.ok || overridden ? "ok" : "no"}`}>
                        {skipped
                          ? "Here it is"
                          : checked.ok || overridden
                          ? "That's right"
                          : "Not quite — here it is"}
                      </p>
                      {!skipped && !checked.ok && checked.reason !== "wrong" && (
                        <Help>{verdictText(checked, langOf(settings))}</Help>
                      )}
                      {/* A right answer is already on screen in the box above,
                          so repeating it says nothing. It is shown only when
                          the person got it wrong or asked to see it. */}
                      {!(checked.ok || overridden) && (
                        <div className="at-answermain">
                          <Field
                            value={item[spec.answerField]}
                            field={spec.answerField}
                            kind={item.kind}
                          />
                        </div>
                      )}

                      {/* Everything after it is a second thing worth noticing,
                          so each says what it is and is set smaller. */}
                      {spec.promptField === "audio" && spec.answerField !== "ar" && item.ar && (
                        <div className="at-answeralso">
                          <p className="at-alsolabel">This is how it's written</p>
                          <Field value={item.ar} field="ar" kind={item.kind} />
                        </div>
                      )}
                      {item[spec.hintField] && (
                        <div className="at-answeralso">
                          <p className="at-alsolabel">
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
                          />
                        </div>
                      )}
                      {checked.reason === "bare" && (
                        <Help>{verdictWord(langOf(settings), "bare")}</Help>
                      )}
                      <MinimalPairs pairs={pairs} settings={settings} />
                      {item.note && <p className="at-note">{item.note}</p>}
                      {spec.promptField !== "audio" && (item.recs || []).length > 0 && (
                        <div className="at-answeralso">
                          <p className="at-alsolabel">This is how it sounds</p>
                          <AudioPrompt recs={item.recs} />
                        </div>
                      )}
                      <AfterAnswer
                        ok={checked.ok}
                        overridden={overridden}
                        flagged={flaggedNow}
                        hasAudio={spec.promptField === "audio" || (item.recs || []).length > 0}
                        onOverride={() => setOverridden(true)}
                        onFlag={flagCurrent}
                        onContinue={applyGrade}
                      />
                    </>
                  ) : (
                    <>
                      <div className="at-row">
                        <Button variant="ghost" onClick={giveUp}>
                          I don't know
                        </Button>
                        <Button variant="primary" disabled={!typed.trim()} onClick={submit}>
                          Check
                        </Button>
                      </div>
                    </>
                  )}
                </div>


              </>
            )}

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
            settings={settings}
            onPractice={(ids, mode) =>
              beginManual({
                ids,
                types: TYPES.filter((t) => settings.types[t]),
                mode,
                count: settings.sessionSize,
              })
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
            onClose={() => setBuilding(false)}
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
            onJoin={async (code) => {
              await API.joinCourse(code);
              await refreshCourses(true);
            }}
            onRefresh={() => refreshCourses(true)}
            onPractise={(deckTitle) => {
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
              onClose={() => setSpace("learn")}
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
            account={account || { handle: "", displayName: "", key: "" }}
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
              API.whoAmI(account.key).then((r) => {
                const merged = { ...r.user, key: account.key };
                API.saveAccount(merged);
                setAccount(merged);
                flash("You are now the administrator");
              })
            }
            onRename={(name) => {
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
            onSpace={setSpace}
          />
          <CornerMenu
            account={account}
            /* The dot stands for the whole action now, so it should stay lit
               while either half is still going. */
            syncState={syncState === "idle" && courseBusy ? "syncing" : syncState}
            onSyncNow={syncEverything}
            theme={settings.theme || "auto"}
            onTheme={() =>
              setSetting(
                "theme",
                { auto: "light", light: "dark", dark: "auto" }[settings.theme || "auto"]
              )
            }
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
}) {
  const [sheet, setSheet] = useState(null); // null | "single" | "bulk" | {edit:item}
  const [q, setQ] = useState("");
  const [filterTags, setFilterTags] = useState([]);

  /* Someone tapped "practise" on a deck elsewhere; show just that deck. */
  useEffect(() => {
    if (!deckWanted) return;
    setFilterTags([deckWanted]);
    setQ("");
    if (onDeckWantedUsed) onDeckWantedUsed();
  }, [deckWanted, onDeckWantedUsed]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmId, setConfirmId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

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

  const allShownSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  function toggleSel(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Course cards are not a student's to change, so a selection offers
     nothing destructive. With OWN_CARDS off there is nothing at all, and the
     list hides the whole selection mode by itself. */
  const bulkActions = useMemo(
    () =>
      OWN
        ? [
            { label: "Lock", onClick: (ids) => onSetLocked(ids, true) },
            { label: "Unlock", onClick: (ids) => onSetLocked(ids, false) },
            { label: "Add a tag", onClick: (ids) => setBulk({ kind: "tag", ids, tag: "" }) },
            { label: "Delete", danger: true, onClick: (ids) => setBulk({ kind: "delete", ids }) },
          ]
        : [],
    [onSetLocked]
  );

  /* Both used to be a browser prompt and a browser confirm — the only two
     places in the app that left it to the browser to ask. */
  const [bulk, setBulk] = useState(null);

  function leaveSelect() {
    setSelecting(false);
    setSelected(new Set());
  }

  return (
    <>
      <Help className="at-mb3">
        Cards come from the courses you're in. Your teacher looks after them.
      </Help>

      {items.length === 0 ? (
        <Empty title="Nothing here yet">
          <>
            {/* The Courses tab and this screen must agree. Being in a course
                with no decks is not the same as being in no course, and saying
                "join a course" to someone who already has looks like a bug. */}
            {myCourses.length
              ? `You're in ${plural(myCourses.length, "course")}, but ${myCourses.length === 1 ? "it has" : "none of them has"} any decks yet. Cards appear here once your teacher adds a deck.`
              : "Join a course and the decks your teacher shares will appear here."}
          </>
        </Empty>
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
            renderItem={(it) => {
              const c = familyCounts(it);
              return (
                /* A square tile, like the teaching space's cards. Tap to see
                   the whole card; there is nothing to edit here. */
                <div
                  className="at-minicard"
                  onClick={() => setSheet({ view: it })}
                >
                  <div className="ar" lang={activeLang().id} dir={activeLang().direction}>
                    {it.ar}
                  </div>
                  <div className="at-minien">{it.en}</div>
                  {it.lat ? <div className="at-minilat">{it.lat}</div> : null}
                  <div className="at-minidecks">
                    {it.tags.length ? (
                      it.tags.map((t) => (
                        <span className="at-flag audio" key={t}>
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="at-flag">In no deck</span>
                    )}
                  </div>
                  <div className="at-minimeta">
                    {c.forms > 1 ? `${c.forms} forms` : "1 form"}
                    {c.clips ? ` · ♪${c.clips}` : ""}
                  </div>
                </div>
              );
            }}
          />

          {/* Exporting lives in the admin space now: a student's cards belong
              to their courses, not to them, so there is nothing here that is
              theirs to take away. */}
        </>
      )}

      {OWN && sheet === "single" && (
        <OWN.ItemSheet
          mode="add"
          allTags={allTags}
          settings={settings}
          onSave={(drafts) => onAdd(drafts)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet.view && (
        /* The same read-only card the teaching space shows, so a card is
           described identically wherever it is opened. */
        <Screen
          title={sheet.view.en || sheet.view.ar}
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
        >
          <CardReadout
            card={{
              ...(items.find((i) => i.id === sheet.view.id) || sheet.view),
              clips: (sheet.view.recs || []).map((r) => r.id),
              decks: sheet.view.tags || [],
            }}
            lang={activeLang()}
            decks={(sheet.view.tags || []).map((t) => ({ id: t, title: t }))}
          />
        </Screen>
      )}
      {OWN && sheet && sheet.edit && (
        <OWN.ItemSheet
          mode="edit"
          initial={sheet.edit}
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
function ArabicField({ label, hint, value, onChange, mode, placeholder, inputRef, lang }) {
  const own = useRef(null);
  const ref = inputRef || own;
  const [focused, setFocused] = useState(false);

  return (
    <div className="at-field">
      {label && <label className="at-label">{label}</label>}
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
      {focused && (
        <div onMouseDown={(e) => e.preventDefault()}>
          <Keyboard
            onKey={(ch) => caretInsert(ref, value, onChange, ch)}
            onBack={() => caretBackspace(ref, value, onChange)}
            onClear={() => onChange("")}
            mode={mode}
            lang={lang}
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

function ClipPlayer({ rec, onPlay }) {
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

function RecordingsField({ recs, onChange, label = "Recordings" }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const handle = useRef(null);
  const started = useRef(0);
  const tick = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => () => handle.current && handle.current.stop(), []);

  const urlRef = useRef("");
  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  async function play(rec) {
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
        clearInterval(tick.current);
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
        clearInterval(tick.current);
        setRecording(false);
        setError(
          String(err && err.name) === "NotAllowedError"
            ? "Microphone permission was refused"
            : "Couldn't reach the microphone"
        );
      }
    );

    // Hard stop, so a forgotten recording can't run away.
    setTimeout(() => handle.current && handle.current.stop(), MAX_RECORD_MS);
  }

  function end() {
    sfx("stop");
    if (handle.current) handle.current.stop();
  }

  async function upload(file) {
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

function ItemSheet({ mode, initial, allTags, settings, onSave, onClose }) {
  const lang = langOf(settings);
  const blank = () => ({
    ar: "",
    lat: "",
    en: "",
    recs: [],
    ...dimValues({}),
    kind: "",
    note: "",
    tags: "",
    subs: [],
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
          subs: (initial.subs || []).map((x) => ({ ...x })),
        }
      : blank()
  );
  const [step, setStep] = useState("form");
  // In add mode you can stack up several items and check them together.
  const [queue, setQueue] = useState([]);
  // When set, the form is editing that queued item rather than adding a new one.
  const [editingIndex, setEditingIndex] = useState(null);
  const arRef = useRef(null);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const canSave = [draft.ar, draft.lat, draft.en].some((v) => v.trim());

  const previewItem = useMemo(() => makeItem(draft), [draft]);
  const previewUnits = unitsOf(previewItem);
  const previewTypes = availableTypes(previewItem);
  // What review will show: everything queued, plus whatever is in the form.
  const pending = useMemo(
    () => (canSave ? queue.concat([draft]) : queue).map((d) => makeItem(d)),
    [queue, draft, canSave]
  );

  function setSub(i, k, v) {
    setDraft((d) => {
      const subs = d.subs.slice();
      subs[i] = { ...subs[i], [k]: v };
      return { ...d, subs };
    });
  }

  const tidy = (d) => ({ ...d, subs: (d.subs || []).filter((x) => x.ar || x.en || x.lat) });

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
  function editQueued(i) {
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
          {/* ---- 1. the word itself ---- */}
          <div className="at-group">
            <div className="at-grouphead">
              <span>The word</span>
              <span className="req">Script + one other</span>
            </div>

            <ArabicField
              label="Arabic script"
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
                : "Not enough to practise yet — needs script plus English or transliteration"}
            </div>
          </div>

          {/* ---- 2. grammar ---- */}
          {(dimsOf(lang).length > 0 || lang.lexical) && (
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
              {lang.lexical && (
                <FormField label={<>{lang.lexical.label} <span className="at-optional">optional</span></>}>
                  <input
                    className="at-input"
                    value={draft[lang.lexical.key] || ""}
                    placeholder={lang.lexical.help || ""}
                    onChange={(e) => set(lang.lexical.key, e.target.value)}
                  />
                </FormField>
              )}
            </div>
          )}

          {/* ---- 3. other forms ---- */}
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
                {draft.subs.map((sb, i) => (
                  <div className="at-subedit" key={i}>
                    <div className="at-subedithead">
                      <span className="at-formtag">{labelFor(sb) || "form"}</span>
                      <button
                        className="at-x"
                        aria-label="Remove form"
                        onClick={() =>
                          setDraft((d) => ({ ...d, subs: d.subs.filter((_, j) => j !== i) }))
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
   Full-screen: build a session by hand
   ------------------------------------------------------------------ */

const COUNT_CHOICES = [10, 20, 30, 50];
const TIME_CHOICES = [2, 3, 5, 10];

function ManualSessionSheet({ items, allTags, settings, onStart, onClose }) {
  const [step, setStep] = useState(0);
  /* No mode until one is chosen. A pre-selected card looks like an answer
     already given, so the first screen gets read as "confirm this" rather
     than "pick one" — and Ultimate, which is the longest session on offer,
     is the last one to hand somebody by default. */
  const [mode, setMode] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [openTag, setOpenTag] = useState(null);
  /* "" until one of the two is chosen — the same reason the mode starts
     unset. It used to open on 20 questions already lit, which is a length
     nobody asked for sitting where the answer goes. */
  const [limitKind, setLimitKind] = useState(""); // "" | count | time
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(5);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
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

  const toggleOne = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const tagState = (group) => {
    const on = group.filter((i) => picked.has(i.id)).length;
    return on === 0 ? "none" : on === group.length ? "all" : "some";
  };

  const toggleTag = (group) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const all = group.every((i) => next.has(i.id));
      group.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });

  /* Unknown until a mode is picked, and three steps is the safer guess:
     showing two and then growing a step reads as the app changing its mind
     about what it asked for. */
  const needsLength = mode !== "ultimate";
  const steps = needsLength ? ["Mode", "Cards", "Length"] : ["Mode", "Cards"];
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
                  {stepProblem || "Next"}
                </Button>
              ) : (
                <Button variant="primary" disabled={!!problem} onClick={start}>
                  {problem || "Start"}
                </Button>
              )}
        </>
      }
    >
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
                        {group.filter((i) => picked.has(i.id)).length}/{group.length}
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
                      {group.map((it) => (
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
    </Screen>
  );
}

/* ------------------------------------------------------------------
   Full-screen: view an item without risking a change to it
   ------------------------------------------------------------------ */



/* A read-only rendering of what is about to be saved. */
function ReviewItem({ item, units, index, total, onRemove, onEdit }) {
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
              <Stat
                value={unit.ar}
                lang={activeLang().id}
                dir={activeLang().direction}
                className="at-arabic word"
              />
            ) : (
              <Notice kind="warn">
                {`No ${activeLang().scriptLabel.toLowerCase()} — this form can't be practised.`}
              </Notice>
            )}
            {unit.en && <p className="at-en" style={{ fontSize: 20 }}>{unit.en}</p>}
            {unit.lat && <p className="at-latin" style={{ fontSize: 17 }}>{unit.lat}</p>}
            {unit.note && <p className="at-note">{unit.note}</p>}

            <ClipList
                    clips={(unit.recs || []).map((r, i) => ({ id: r.id, label: r.label || `Voice ${i + 1}` }))}
                    load={clipUrl}
                  />

            <Help>
              {types.length >= 2 ? (
                <>Exercises: {types.map((t) => exOf(t, activeLang()).label).join(" · ")}</>
              ) : (
                <span className="at-warn">
                  Fewer than two exercise types — add the Arabic script plus English or a
                  transliteration.
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

function BulkAddSheet({ allTags, onAdd, onImport, onClose }) {
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
            <pre dir="auto">
              | English | Arabic | Transliteration | Decks |{"\n"}
              |---------|--------|-----------------|------|{"\n"}
              | book | كِتاب | kitāb | class 12 june |{"\n"}
              | one | واحِد | | numbers |
            </pre>
            <p>Headings and prose around the table are ignored.</p>
            <p>
              Add <code>Number</code> and <code>Gender</code> columns if you want them — or
              label cells <code>num:</code> and <code>gen:</code>. Anything without a number is
              filed as singular, and you can change it in bulk afterwards.
            </p>
            <p>Without a table, one card per line, cells split by <code>|</code> or a tab:</p>
            <pre>english | arabic | transliteration | decks | note</pre>
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
            placeholder={"book | كِتاب | kitāb | class 12 june\nwater | ماء | māʾ"}
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
            Every row as it will be stored. {parsed.skipped > 0 && `${parsed.skipped} line(s) couldn't be read and were dropped. `}
            {weak > 0 && (
              <span className="at-warn">
                {plural(weak, "item")} lack two exercise types and won't be
                practised until filled in.
              </span>
            )}
          </Help>
          <div className="at-preview">
            <div className="at-previewhead">
              <span>English</span>
              <span>Arabic</span>
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
function itemProgress(it) {
  const vals = [];
  for (const { unit } of unitsOf(it)) {
    for (const t of availableTypes(unit)) {
      const st = unit.s[t];
      if (st.phase === "new") vals.push(0);
      else if (st.phase === "review") vals.push(Math.min(1, (st.interval || 0) / MATURE_DAYS));
      else vals.push(0.15);
    }
  }
  if (!vals.length) return null; // nothing drillable yet
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function ItemProgressCard({ item, progress }) {
  const p = progress === undefined ? itemProgress(item) : progress;
  const done = p !== null && p >= 1;
  const pctLabel = p === null ? "—" : `${Math.round(p * 100)}%`;

  return (
    <div className={`at-pcard${done ? " done" : ""}${p === null ? " idle" : ""}`}>
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
        <span>{p === null ? "Not practisable" : done ? "Learnt" : pctLabel}</span>
        {(item.subs || []).length > 0 && <span>⌥ {(item.subs || []).length + 1}</span>}
      </div>
    </div>
  );
}

/* Progress per card is worked out once per change of the cards, in the tab,
   and handed down — not once per section and again per tile on every
   render. */
const TagSection = React.memo(function TagSection({
  name,
  items: group,
  open,
  onToggle,
  onPractice,
  progressOf,
}) {
  const [arming, setArming] = useState(false);
  const scored = group.map((it) => progressOf.get(it.id)).filter((x) => x != null);
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
            <ItemProgressCard item={it} key={it.id} progress={progressOf.get(it.id)} />
          ))}
        </div>
      )}
    </div>
  );
});

function ProgressTab({ data, items, settings, onPractice }) {
  // Collapsed by default: the point of this screen is the overview.
  const [open, setOpen] = useState(() => new Set());

  const progressOf = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, itemProgress(it));
    return m;
  }, [items]);

  const buckets = ["new", "learning", "young", "mature"];
  const totals = { new: 0, learning: 0, young: 0, mature: 0 };
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

  const toggle = (name) =>
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
        <Empty title="Nothing to show yet">
          Join a course and your progress with its decks will appear here.
        </Empty>
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
          />
        ))
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
      "A card can hold several forms of the same thing — a plural, a feminine, a variant said to an elder — and each form is practised on its own.",
    ],
  },
  {
    title: "What gets asked",
    body: [
      "What is on a card decides what can be asked of it. Script and meaning give you two directions; a recording lets it be practised by ear; a second writing, where the language uses one, adds more.",
      "Some languages have properties that can be heard but not seen written — a tone, for instance. Where a language declares one, there is an exercise for it.",
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

function AccountPanel({ me, onRename }) {
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
function CloseAccount({ handle, onClosed }) {
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

const initialsOf = (name) =>
  String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

const SPACE_LABEL = { learn: "Learning", teach: "Teaching", admin: "Admin" };
const SPACE_ICON = { learn: "cards", teach: "school", admin: "tune" };

/* Which part of the app you are in, sitting beside the account menu.
   Someone who only studies has one space, so there is nothing to choose and
   the control does not appear at all. */
/* Which part of the app you are in, sat beside the account menu.
   A row rather than a dropdown: there are at most three, and moving this out
   of the menu was about reaching them in one tap. Shown only to people with
   somewhere to go — a student who only studies sees nothing. */
function SpaceSwitch({ space, spaces, onSpace }) {
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
 * Which build this is, and whether it is the one on the server.
 *
 * Frozen in at build time (see vite.config.js), so this is the commit the
 * running bundle came from — not the commit the server is serving. For an
 * installed app those come apart: the service worker holds a precached copy
 * and keeps serving it until it has fetched the new one, so a deploy can
 * land perfectly and this line still read the old commit for a while.
 *
 * Which is exactly the thing that would make a version line misleading, so
 * the line asks the server as well. "Up to date" then means the deploy
 * landed *and* you are looking at it, and anything else says so plainly
 * rather than leaving a good deploy looking like a failed one.
 */
const APP_COMMIT = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const APP_BUILT_AT = typeof __BUILT_AT__ === "string" ? __BUILT_AT__ : "";

/* Short and local: enough to tell two deploys on the same day apart. */
function buildStamp(iso) {
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
  const [deployed, setDeployed] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => alive && setDeployed(v && v.commit ? v : false))
      .catch(() => alive && setDeployed(false));
    return () => {
      alive = false;
    };
  }, []);

  const stale = deployed && deployed.commit !== APP_COMMIT;

  async function reload() {
    /* Ask the service worker to look again first: a plain reload can be
       answered out of its cache, which is the state we are trying to
       leave. */
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) await reg.update();
    } catch (e) {
      /* No worker, or it refused. Reloading is still worth a try. */
    }
    window.location.reload();
  }

  return (
    <div className={`at-cver${stale ? " stale" : ""}`}>
      <span className="at-cvertext">
        <b>Version {APP_COMMIT}</b>
        <i>
          {buildStamp(APP_BUILT_AT)}
          {stale ? ` — ${deployed.commit} is deployed` : ""}
        </i>
      </span>
      {stale && (
        <button className="at-cverbtn" onClick={reload}>
          Reload
        </button>
      )}
    </div>
  );
}

function CornerMenu({ account, syncState, onSyncNow, theme, onTheme, onAccount, onPrefs, onGuide }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const themeName = { auto: "Follow device", light: "Light", dark: "Dark" }[theme || "auto"];

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

          <button className="at-cline" onClick={onSyncNow}>
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
            <span className="at-cact">Sync now</span>
          </button>

          <button className="at-cline" onClick={onTheme}>
            <span className="at-cico">
              <Icon name="theme" size={18} />
            </span>
            <span className="at-clinetext">Appearance</span>
            <span className="at-cact">{themeName}</span>
          </button>

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

function SettingsScreen({ kind, onClose, ...rest }) {
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
}) {
  /* The storage figures moved here with the section that shows them. */
  const [stats, setStats] = useState(null);
  const [warming, setWarming] = useState(null); // { done, total, fetched }

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

            <FormField label={<>Send every card back to the start, as though never practised</>}>
              <Help className="at-mb3">
                Your cards, forms, decks and recordings all stay. What goes is everything the app
                has worked out about how well you know them — intervals, ease, difficulty and
                history. Nothing will be due until you practise it again.
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
                    practising again.
                  </p>
                }
                onCancel={() => setResetting(false)}
                onConfirm={() => {
                  setResetting(false);
                  onReset();
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

function AppPreferences({ settings, setSetting, toggleIn }) {
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
                { value: true, label: "On" },
                { value: false, label: "Off" },
              ]}
              value={settings.sounds !== false}
              onChange={(v) => setSetting("sounds", v)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSounds(true);
                sfx("correct");
                setTimeout(() => sfx("complete"), 400);
                setTimeout(() => setSounds(settings.sounds !== false), 900);
              }}
            >
              Test
            </Button>
          </div>
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
                the L→ types drill the same things by ear. Turning types off can drop items below
                the two-type minimum.
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
<FormField label="Harakat when you type Arabic">
          <Segmented
            label="Harakat when you type"
            options={[
              { value: "either", label: "Either form" },
              { value: "required", label: "Must be typed" },
              { value: "ignore", label: "Never checked" },
            ]}
            value={settings.tashkeel}
            onChange={(v) => setSetting("tashkeel", v)}
          />
          <Help>
            <em>Either form</em> takes the bare letters or the fully vocalised spelling — but typed
            harakat have to be the right ones. Transliteration is always marked leniently: macrons,
            ʿayn marks and apostrophes are ignored.
          </Help>
</FormField>

<FormField label="Hamza and final letters">
          <Segmented
            label="Hamza and final letters"
            options={[
              { value: false, label: "Exact" },
              { value: true, label: "Lenient" },
            ]}
            value={!!settings.ignoreHamza}
            onChange={(v) => setSetting("ignoreHamza", v)}
          />
</FormField>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function pct(n, total) {
  return `${total ? (n / total) * 100 : 0}%`;
}

function nextDueLine(pool, settings) {
  const future = [];
  for (const it of pool) {
    for (const { unit } of drillableUnits(it, settings)) {
      for (const t of enabledTypes(unit, settings)) {
        const d = unit.s[t].due || 0;
        if (d > now()) future.push(d);
      }
    }
  }
  if (!future.length) return "Nothing scheduled.";
  return `Next exercise in ${formatGap(Math.min(...future) - now())}.`;
}

