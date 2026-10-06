import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  Course, DayMoves, Deck, Doc, ExerciseState, FlagKind, FlagVerdict, Form, Item,
  Lang, LangId, Millis, Question, SavedSession, Settings, User,
 VerbSpec, } from "./types.ts";
import type { Node } from "./shared.tsx";
import { say } from "./wording.ts";
import {
  APP_COMMIT,
  APP_RELEASE,
  APP_BUILD,
  Button,
  CardReadout,
  CardTile,
  DeckSwitch,
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
  fromDeck,
  serverCardId,
  SnackbarProvider,
  Stat,
  StickyFoot,
  Tabs,
  plural,
  pairSystems,
  pullCourses,
  shortDate,
  pullAdmin,
  pullTeaching,
  useInstallOffer,
  useLiveRefresh,
  useOffline,
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
  answersInFigures,
  instructionFor,
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
  kindOf,
  isListening,
  isGrid,
  groupAttrOf,
  answerLabel,
  askLabel,
  lentLabel,
  labelFor,
  langOf,
  quizAttrOf,
  scriptVars,
  setActiveLang,
  verdictText,
  verdictWord,
  GRAMMAR,
  defaultMarking,
  grammarFields,
  normDimValue,
  showsOneAnswer,
  keysFor,
  answerOf,
  levelOf,
  typeOf,
  tablesOf,
  verbOf,
  blankAdmits,
  lendsForm,
  lendsInto,
  NUMBER_EQUIVALENT,
  NUMBER_FALLBACK,
  normEn,
} from "./languages.ts";
import {
  agreedCell,
  cellsIn,
  hasCells,
  ownSlot,
  linkedToNothing,
  partnerOf,
  slotLinks,
  citedCell,
  isCitation,
  openRows,
  ownerOf,
  rowOf,
  slotRows,
  subjectSlot,
} from "./verbs.ts";
import { formsOf, leadOf, subFormsOf, withLead } from "./cards.ts";
import { langsOffAmong } from "./lang-choice.ts";
import type { LangChoice } from "./lang-choice.ts";
/* A language's numbers and its clock, reached the way everything else
   language-shaped is: through a registry keyed by language, never by
   naming one. See src/numbers/. */
import { composerFor, timeComposerFor } from "./numbers/index.ts";
import type { Ask, Token } from "./numbers/types.ts";
import { countingOf } from "./numbers/types.ts";
import {
  confusableTimes,
  confusablesOf,
  recordedWhole,
  renderAsk,
  seeded,
} from "./numbers/range.ts";
import type { Asking, SystemSet } from "./numbers/generate.ts";
import { askingsKnown, askKnown, cardsOfToken, fillerCards, homeStretch, isFromSystem, inOwnFigures, isNumeralCard, isRangeSkill, numeralId, stretchBefore, systemFor, systemIdOf, systemOfId } from "./numbers/generate.ts";
import { nounsByLanguage, setsGiven } from "./numbers/nouns.ts";
import { ClockDial, ClockFace } from "./clock.tsx";
import {
  cleared,
  formatGap,
  movedTo,
  recentDays,
  freshState,
  hasLevelAbove,
  learnt,
  liftLevel,
  topLevelOf,
  PASSES_TO_LEARN,
  freshStates,
  isAsked,
  itemDifficulty as itemDifficultyOf,
  justPractised,
  maturity,
  missedTwice,
  openTypes as openTypesOf,
  passesMade,
  reachedLevel,
  solid,
  FRONT_DOOR_CAP,
  roomForNew,
  inHandCap,
  frontDoorCap,
  byVariety,
  typicalDay,
  restingNow,
  throughDoor,
  familyMaturity,
  standing,
  standings as standingsOf,
  stateReady,
  turnOf,
  unitsOf,
  dayKey,
  dueRank,
  inOrder,
  shuffled,
} from "./scheduler.ts";
import type { Move, Standing } from "./scheduler.ts";
import { PAIR_WORDS, PICK_OPTIONS, matchGroups, matchSet, optionsFor } from "./chance.ts";
import { buildContextIndex } from "./context-index.ts";
import { canAsk } from "./offers.ts";
import { isOffline } from "./net.ts";
import { drainOutbox, keep as keepPending, waiting as waitingToSend } from "./outbox.ts";
import {
  DEFAULT_SPEAKERS,
  DIALOG_KIND,
  MAX_SPEAKERS,
  ORDER_SEP,
  SELF_ALL,
  SELF_SOME,
  WHOLE_SCENE,
  buildDialogIndex,
  isDialog,
  isText,
  isTwoSided,
  linesOf,
  namedPart,
  pickedFrom,
  proseOf,
  replyOptions,
  sceneBefore,
  scrambledLines,
  sideOf,
  speakerName,
  speakersOf,
} from "./dialogs.ts";
import {
  answerAt,
  answerForTurn,
  answerGiven,
  answersOf,
  firstOfEach,
  meaningForTurn,
  packAnswers,
  withAnswer as oneAnswer,
} from "./answers.ts";
import { fillForm, fillsOf, hasSlots, lentBy, refOf, slotsOf, valuesAt, valuesForTurn, valuesOf } from "./variables.ts";
import type { Value } from "./variables.ts";
import { agreeTook, finishTook, leadsOf, lineGate, passes, reviewOf, sentenceKey, SCAN_LIMIT } from "./review.ts";
import { castFill as castScene, filledScene, hasCast } from "./cast.ts";
import type { Review } from "./review.ts";
import { liftSubtypeTagsIn } from "./subtype-tags.ts";
import { spellRuns, typoed } from "./spelling.ts";
import type { Run } from "./spelling.ts";

/*
 * The two that need to know which exercise types a form supports. That
 * answer depends on the language pack and on the index of phrases showing
 * a word in use, neither of which belongs in the scheduler — so it is
 * handed in here, at the one place that has both.
 */
const itemDifficulty = (it: Item, settings: Settings): string =>
  itemDifficultyOf(it, (u) => supportedTypes(u, settings));

/* Where a card stands on the ladder, over the same keys the ladder itself
   climbs — see `laddered`. Everything that puts progress on a screen reads
   this, so what a learner is told and what the scheduler does are the one
   answer said twice rather than two answers that can drift. */
/*
 * A number part is learnt only once the words it is made of are known.
 *
 * Its own ladder says the learner is getting numbers right, which a run of
 * easy ones can say about 11 to 99 while *ninety* has never been cleared.
 * So where the collection is to hand, a part whose top is done but whose
 * words are not cleared is held at Cleared, with how many words it is
 * waiting on. A caller that cannot see the collection — one card's own
 * line — reads the part on its own ladder, which is all it ever did.
 *
 * Cleared and not learnt, since 0.368. Learnt asked every one of a part's
 * words and its ten figures — twenty cards for 0 to 9 — to have made their
 * passes at the same moment, and a slip on any one of them took it back,
 * so a learner drilling 0 to 9 every day was held at Cleared for weeks
 * with the count going up as often as down. Each word keeps its own way
 * to learnt, and shows it; the part asks that they are known.
 *
 * `keys` is laddered everywhere but towardsLearnt, which reads a number
 * still waiting on its stretch as it will stand once the stretch opens.
 */
export const cardStandings = (
  it: Item,
  settings: Settings,
  among?: Item[],
  keys: (unit: Form, settings: Settings) => string[] = laddered,
): Standing[] => {
  const rows = standingsOf(it, (u) => keys(u, settings));
  if (!among || !rows.length) return rows;
  const words = it.parts ? partsOf(it, among, settings, keys).filter((p) => p.known === false).length : 0;
  const figures = numeralsOf(it, among, settings, keys).filter((p) => p.known === false).length;
  const held = words + figures;
  if (!held) return rows;
  const top = rows[rows.length - 1];
  return rows.slice(0, -1).concat([{
    ...top,
    status: top.status === "done" ? "cleared" : top.status,
    held,
    ...(figures ? { heldFigures: figures } : null),
  }]);
};

/**
 * How far one card is towards learnt, as every percentage counts it: where
 * it stands, and its share — the levels it has finished over the levels it
 * has material for. Null for a card that can never be asked anything,
 * which no practice would bring closer and so is no part of the sum.
 *
 * A number waiting for its stretch is not one of those. Its words wait
 * with their stretch and a stretch waits on the one below — see
 * quietUnits — so until then it has nothing to ask and stands on no level.
 * The percentages used to leave it out for that, and a deck of every
 * number read 90% to a learner who knew the words for 0 to 9, then fell to
 * 50% once 0 to 9 was learnt and 10 to 19 opened: progress drawn going
 * backwards because it had been made. It is in the deck and not yet
 * learnt, so it counts — read as it will be asked once its stretch opens:
 * fresh, or with whatever it had earned before a slip below shut it again.
 *
 * The home screen's ring, a saved session's tile, the prep's and the
 * Progress tab's decks all read this, so none of them can count a waiting
 * number differently from the others.
 */
export function towardsLearnt(it: Item, settings: Settings, among: Item[]): { at: Standing; share: number; reach: number } | null {
  let rows = cardStandings(it, settings, among);
  if (!rows.length) rows = cardStandings(it, settings, among, ladderedOnceOpen);
  const at = standing(rows);
  if (!at) return null;
  return {
    at,
    share: rows.filter((r) => r.status === "done").length / rows.length,
    /* The same, with a cleared top row counted in: how far towards cleared. */
    reach: rows.filter((r) => r.status === "done" || r.status === "cleared").length / rows.length,
  };
}

/**
 * The ten figures a range is written in, as the learner stands on each —
 * in the shape partsOf gives a word, and read the same way.
 *
 * Only for a range of a language with figures of its own, which is what
 * `rangeFigures` on its form says. A number is learnt only once it can be
 * read and written in those figures, and every number is written in
 * these ten, so a range is held at Cleared until they are learnt too —
 * the way it is held for a word it is built from.
 */
export function numeralsOf(
  it: Item,
  among: Item[],
  settings: Settings,
  keys: (unit: Form, settings: Settings) => string[] = laddered,
): PartWord[] {
  if (!isRangeSkill(it) || !(it.forms[0] && it.forms[0].rangeFigures)) return [];
  return numeralCardsOf(systemIdOf(it), among).map((card) => {
    const at = standing(standingsOf(card, (u) => keys(u, settings)));
    return {
      card,
      at,
      validated: at ? at.status === "done" : null,
      known: knownCard(card, settings, keys),
      met: unitsOf(card).some(({ unit }) => keys(unit, settings).some((k) => stateOf(unit, k).phase !== "new")),
    };
  });
}

/* One word or figure a number part is built from, as the learner stands on
   it — see partsOf. */
type PartWord = { card: Item; at: Standing | null; validated: boolean | null; known: boolean | null; met: boolean };

/* Whether a card is cleared on every form it can be asked — the bar a
   number part holds its words to. Null where nothing on it can be asked,
   which holds nothing back. */
function knownCard(card: Item, settings: Settings, keys: (unit: Form, settings: Settings) => string[]): boolean | null {
  const forms = unitsOf(card)
    .map(({ unit }) => ({ unit, ladder: keys(unit, settings) }))
    .filter((f) => f.ladder.length);
  if (!forms.length) return null;
  return forms.every(({ unit, ladder }) => cleared(ladder, (k) => stateOf(unit, k)));
}

/* The ten figure cards of one system the learner holds, ٠ to ٩. */
export function numeralCardsOf(system: string, among: Item[]): Item[] {
  const byId = byIdOf(among);
  const out: Item[] = [];
  for (let d = 0; d <= 9; d++) {
    const card = byId.get(numeralId(system, d));
    if (card) out.push(card);
  }
  return out;
}

/* Every card in a collection by id, once per collection: a part asks after
   thirty words, and a screen asks after every part. */
const BY_ID: WeakMap<Item[], Map<string, Item>> = new WeakMap();
function byIdOf(items: Item[]): Map<string, Item> {
  const had = BY_ID.get(items);
  if (had) return had;
  const made = new Map(items.map((it) => [it.id, it]));
  BY_ID.set(items, made);
  return made;
}

/**
 * The words a number part is made of, as the learner stands on each.
 *
 * `validated` is the app's own standard for a card — learnt, its ladder
 * cleared and its passes made — and null for a word that cannot be asked
 * at all, which nothing could ever validate and so holds nothing back. A
 * word in no card this learner holds is left out for the same reason.
 * `known` is the lower bar of cleared, which is what holds the part back
 * (see cardStandings); `validated` is what the words are counted by and
 * what a part's questions are steered towards.
 * `met` is whether any question on it has been answered, which is what
 * tells a word under way from one not started.
 *
 * `keys` as in cardStandings: a part read through the quiet gate reads its
 * words through it too, or a waiting part would count words that had
 * slipped out of reach as holding nothing back.
 */
export function partsOf(
  it: Item,
  among: Item[],
  settings: Settings,
  keys: (unit: Form, settings: Settings) => string[] = laddered,
): PartWord[] {
  const byId = byIdOf(among);
  const out: PartWord[] = [];
  for (const id of it.parts || []) {
    const card = byId.get(id);
    if (!card) continue;
    const rows = standingsOf(card, (u) => keys(u, settings));
    const at = standing(rows);
    out.push({
      card,
      at,
      validated: at ? at.status === "done" : null,
      known: knownCard(card, settings, keys),
      met: unitsOf(card).some(({ unit }) =>
        keys(unit, settings).some((k) => stateOf(unit, k).phase !== "new"),
      ),
    });
  }
  return out;
}

/* ------------------------------------------------------------------
   What one answer moved

   The ladder takes days to climb and four more to keep, so a screen that
   only says where cards stand says the same thing for days at a time —
   and a learner who has just worked hard is told nothing happened. What
   they did is true and sayable; these two are what make it sayable.

   Both are here rather than in the scheduler because they need to know
   what a card is asked, which is a matter of the learner's settings.
   `movedTo` — the judgement itself, read off the one standing every
   screen reads — is the scheduler's.
   ------------------------------------------------------------------ */

/**
 * Which of the cards this answer marked have moved, and how.
 *
 * Compared card by card across the one write that changed them, because
 * afterwards there is nothing left to compare: a card's standing says
 * where it is and never that it got there tonight.
 *
 * Only the cards actually named by the marks are walked. One answer can
 * mark several — a grid marks five, a sentence credits every word that
 * stood in it — and every one of those is a card that may have moved; the
 * rest of the collection cannot have.
 */
export function movesAmong(
  before: Item[],
  after: Item[],
  marks: { id: string }[],
  settings: Settings,
): { id: string; move: Move }[] {
  const out: { id: string; move: Move }[] = [];
  const was = new Map(before.map((it) => [it.id, it]));
  const now = new Map(after.map((it) => [it.id, it]));
  for (const id of new Set(marks.map((m) => m.id))) {
    const had = was.get(id);
    const has = now.get(id);
    if (!had || !has) continue;
    const move = movedTo(
      standing(cardStandings(had, settings, before)),
      standing(cardStandings(has, settings, after)),
    );
    if (move) out.push({ id, move });
  }
  return out;
}

/**
 * The news so far, with this answer's added.
 *
 * One entry per card, keeping the largest thing that has happened to it:
 * a card that rises a rung early in a sitting and clears before the end
 * is one piece of news rather than two, and the one worth telling is the
 * later one. Order is kept, so what moved first is still listed first.
 */
const MOVE_RANK: Record<string, number> = { up: 1, cleared: 2, learnt: 3 };

export function mergeMoves(
  had: { id: string; move: Move }[],
  fresh: { id: string; move: Move }[],
): { id: string; move: Move }[] {
  const out = had.slice();
  for (const one of fresh) {
    const at = out.findIndex((x) => x.id === one.id);
    if (at < 0) out.push(one);
    else if (MOVE_RANK[one.move] > MOVE_RANK[out[at].move]) out[at] = { ...out[at], move: one.move };
  }
  return out;
}

/* Marking an answer: what it counts as, and what that writes onto the card
   it was about. A module of its own so the one path that moves a learner's
   progress can be asked what it does without a browser — see grade.ts. */
import { fillerMarks, gradeInto, verdictOf } from "./grade.ts";
import type { Filler, Mark } from "./grade.ts";

import { applyUpdate, beforeReload, holdUpdates } from "./updates.ts";
import {
  syncClips,
  clipIdsIn,
  loadSyncConfig,
  saveSyncConfig,
  tokenFor,
  syncOnce,
  docSize,
  drainRemote,
  compactItem,
  mergeData,
  syncAfterChange,
  SESSION_END_SYNC_MS,
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
     2. Every form in a session is practiced in two exercise types where
        the data allows it.
     3. Cards are taken in the order they fell due, and no one card takes
        more than two of its forms into a session.

   Every exercise shows one item's own data, verbatim. Nothing is
   recombined across items.
   ================================================================== */

const KEY = "arabic-trainer-v3";

/* What a reported problem is filed under while it waits for a connection.
   See outbox.ts: one queue, and the kind is how two sorts of waiting work
   are kept out of each other's way. */
const FLAG_OUTBOX = "flag";
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
  /* The work of course cards no longer in the material — see `parked` in
     types.ts. Empty on a device that has never lost one. */
  parked: {},
  settingsUpdated: 0,
  log: {},
  settings: {
    /*
     * The languages switched *off*, rather than the ones switched on.
     *
     * Which way round matters. Somebody learning two languages who joins a
     * course in a third should see it, and a list of what is on would have
     * left the new one out of it — switched off by a setting written before
     * it existed, with nothing on the screen to say so. Empty is every
     * language, which is what a new device starts at and what this can
     * always be put back to.
     */
    langsOff: [],
    /* How strictly typing is marked. Each language's own answer, and no
       longer anybody else's: it used to be a row of Exact/Lenient controls
       under Advanced, which asked a learner to rule on harakat before they
       could read one. The packs still declare it — see `marking` in
       languages.ts — because what counts as a near miss is a fact about
       the language. */
    ...defaultMarking(),
    keyboard: "auto",
    theme: "auto",
    sounds: "loud",
    language: DEFAULT_LANGUAGE,
  },
};

const now = () => Date.now();






/* ------------------------------------------------------------------
   The ladder, in the words a learner is shown

   One vocabulary for the whole app: a card is on a level, and it is either
   not started there, learning it, done with it, or paused because a slip
   further down has shut it. The four levels are the exercise table's own —
   see `level` on each definition in languages.ts — and these are their
   names, said once here rather than in each screen that shows one.
   ------------------------------------------------------------------ */

const LEVEL_NAME: Record<number, string> = {
  1: "What it means",
  2: "Which word it is",
  3: "Write it from a cue",
  4: "Write it from its meaning",
};

/*
 * The same four, written to be read inside a sentence.
 *
 * The names above are headings, and two of them are questions while two
 * are instructions — which is right over a tile and falls apart the
 * moment one is put in a line of prose. "airport — up to which word it
 * is" was what the screen at the end of a session actually said, having
 * borrowed the heading and hoped.
 *
 * So the same four levels said as things a card can be up to, which is
 * what a sentence about a card moving needs. Level one is here for
 * completeness and is never reached *up to* — it is where a card starts.
 */
const LEVEL_REACHED: Record<number, string> = {
  1: "what it means",
  2: "telling it apart from other words",
  3: "writing it from a cue",
  4: "writing it from its meaning",
};

/*
 * The tiles at the top of Progress, in the order a card climbs them.
 *
 * Named rather than numbered. "Level 3" says where a card sits and
 * nothing about what it is being asked to do, and six of those in a row
 * are a bar chart with no labels — so each tile says what its level
 * actually asks, in the same words the card's own screen uses, and wears
 * the number underneath where it is still worth knowing.
 *
 * The icons are read off the exercises: a question mark for what a word
 * means, a magnifier for picking it out of a few, a copy for writing what
 * is already in front of you, a pen for writing it with nothing to copy.
 * Learnt is the one that has to carry across a screen, so it gets the
 * badge, the larger glyph and a tile of its own colour — it is what the
 * rest of them are climbing towards.
 *
 * **Cleared has a tile of its own**, between the top level and Learnt.
 * Without one, a card worked all the way up tonight sat under "write it
 * from its meaning" beside cards that had only just reached that rung,
 * and the number that moved on the evening somebody did the work was
 * indistinguishable from the number that did not. It is the one milestone
 * effort buys on the day it is spent, and it was invisible. A tick rather
 * than the badge, and brass rather than jade: the work is done and the app
 * is still checking.
 */
const LADDER_TILES: { key: string; label: string; icon: string }[] = [
  { key: "all", label: "All cards", icon: "cards" },
  { key: "l1", label: LEVEL_NAME[1], icon: "help" },
  { key: "l2", label: LEVEL_NAME[2], icon: "search" },
  { key: "l3", label: LEVEL_NAME[3], icon: "copy" },
  { key: "l4", label: LEVEL_NAME[4], icon: "edit" },
  { key: "cleared", label: "Cleared", icon: "check" },
  { key: "done", label: "Learnt", icon: "verify" },
];

const STATUS_LABEL: Record<string, string> = {
  none: "Not started",
  learning: "Learning",
  cleared: "Cleared",
  done: "Done",
  paused: "Paused",
};

/* A level further up is a warmer colour, and a card with everything done
   is the one that stands out. Paused borrows the colour of a miss, because
   that is what it is: something slipped. */
const LEVEL_COLOR: Record<number, string> = {
  1: "var(--text)",
  2: "var(--rose)",
  3: "var(--brass)",
  4: "var(--jade)",
};

/* The same five rungs as a band, on the home screen: the four levels, then
   the cards with nothing above them left to open.

   The ladder's own colours, with one change at the bottom. A tile on the
   Progress screen writes its count in the level's colour and the bottom
   level's is the ink the rest of the app is written in, which is right for
   a numeral and wrong for a bar: a learner whose cards are all on the first
   level would be shown one solid bar in the brightest colour on the screen,
   which reads as finished rather than as not started. In a band the bottom
   rung is the quiet one. */
const CLIMB_COLOR: string[] = [
  "var(--muted)",
  LEVEL_COLOR[2],
  LEVEL_COLOR[3],
  LEVEL_COLOR[4],
  "var(--jade)",
];

const STATUS_COLOR: Record<string, string> = {
  none: "var(--muted)",
  learning: "var(--brass)",
  /* Cleared wears the brass the app uses for work under way rather than
     the jade it uses for finished. It is the last rung reached and not
     the badge, and painting it jade would tell a learner they were done
     with a card the app is still checking. */
  cleared: "var(--brass)",
  done: "var(--jade)",
  paused: "var(--rose)",
};

/*
 * The runs a level's cards are shown in, when one of the tiles at the top
 * of Progress is opened.
 *
 * Every card under a level tile is on that level, so what tells them apart
 * is how they are going there. Paused leads: it is the one that means
 * something went wrong, it is usually the shortest run, and a list is
 * paged — put it last and a learner with a hundred cards waiting on a
 * level would never reach the two that had slipped.
 *
 * "Done" is not among them. A card whose level is done has moved up and is
 * under the next tile along; the ones with nothing left to open are under
 * "Learnt", where they are all in the same state and the list is drawn
 * without headings.
 */
/* "Cleared" is not among them either, and for the same reason as "Done":
   a card at the top of its ladder is under its own tile, not inside a
   level's list. */
const STATUS_RUNS = [
  { key: "paused", label: STATUS_LABEL.paused },
  { key: "learning", label: STATUS_LABEL.learning },
  { key: "none", label: STATUS_LABEL.none },
];

/* What a card's tile and its readout say, from the one standing.

   "Learnt" names the whole card rather than a level: the ladder up and
   the passes made, which is the only sense in which this app finishes a
   card. "Cleared" is the state in between, and it is worth a sentence
   rather than a word — a learner who has just worked a card all the way
   up and is told it is not learnt deserves to know what is left, and the
   answer is two returns and nothing they can do tonight. */
function standingLabel(at: Standing | null): string {
  if (!at) return "Can't practice yet";
  if (at.status === "done") return "Learnt";
  /* A number part whose own reviews are made and whose words are not: the
     reviews line would say "0 reviews to go" over a part that is not
     learnt, so it says what it is waiting on instead. */
  if (at.status === "cleared" && at.held && at.passes >= PASSES_TO_LEARN) {
    return `Cleared · ${heldWhat(at)} to learn`;
  }
  if (at.status === "cleared") {
    return `Cleared · ${PASSES_TO_LEARN - at.passes} ${
      PASSES_TO_LEARN - at.passes === 1 ? "review" : "reviews"
    } to go`;
  }
  return `Level ${at.level} · ${STATUS_LABEL[at.status] || at.status}`;
}

/* The same thing said shorter, for the small print on a tile in a grid.
   The line it sits on is one line and does not wrap — it holds a date in
   every other list — and "Level 2 · Not started" came out as "Level 2 ·
   Not…", which is a worse answer than the level on its own. */
function standingShort(at: Standing | null): string {
  if (!at) return "Can't practice yet";
  if (at.status === "done") return "Learnt";
  if (at.status === "cleared") return "Cleared";
  return `Level ${at.level}`;
}

/* ------------------------------------------------------------------
   Automatic difficulty
   ------------------------------------------------------------------ */

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
  const id = `${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    /* The card's own word first, then whatever other forms it was given —
       one list, and the word answers to the card's own id. */
    forms: [
      {
        id,
        ar: ar.trim(),
        lat: lat.trim(),
        en: en.trim(),
        lang: activeLang().id,
        recs: recs || [],
        ...dimValues(src),
        created: now(),
        updated: now(),
        s,
      },
      ...(subs || []).map((x: Record<string, any>) => (x.id ? x : makeSub(x))),
    ],
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
    created: now(),
    updated: now(),
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
/* Which of a card's fields belong to a form rather than to the card: the
   three words, its recordings, and whatever grammar the languages declare.
   Asked where a patch from the editor is taken apart. */
const FORM_FIELDS = new Set(["ar", "lat", "en", "recs", ...Object.keys(dimValues({}))]);

/* A card or one of its forms — both carry the language, and both are
   asked. */
type Spoken = { lang?: LangId } | null | undefined;

const langIdOf = (unit: Spoken, settings: Settings): LangId =>
  ((unit && unit.lang) || settings.language || DEFAULT_LANGUAGE);

function settingsFor(settings: Settings, unit: Spoken): Settings {
  const id = langIdOf(unit, settings);
  /* The same object when the card is in the app's own language, which is
     the ordinary case: a new object on every call would defeat every memo
     that takes settings. */
  if (id === settings.language || !LANGUAGES[id]) return settings;
  return { ...settings, language: id };
}

/*
 * The forms of a card that have anything to ask at all.
 *
 * Two gates, and every reader of a card's forms wants both: a cell of a row
 * nobody has reached yet — see quietUnits — and a form the teacher keeps on
 * the card without asking about it — see isAsked. A unit with nothing to
 * ask is left out here rather than further down, where it would take one of
 * the places a family gets in a session and fill it with no question — so a
 * verb whose word is cited by one of its own cells would be dealt one cell
 * instead of two.
 *
 * Its own function because a session built by hand wants the gates without
 * the minimum below: the gentle mode takes a card that supports a single
 * exercise, so it walked every form of the card directly instead and
 * applied neither gate — a table the teacher had switched off was asked
 * there, and a verb's later tenses were dealt before its present was known.
 */
export function askedUnits(item: Item) {
  return unitsOf(item).filter(({ unit }) => !isQuiet(unit) && isAsked(unit));
}

/* And of those, the ones a dealt session looks at: a form needs two
   exercises to be worth one of the places a family gets.

   Exported for the tests, which ask it what a card would actually be dealt
   — the one question a screenshot cannot answer. */
export function drillableUnits(item: Item, settings: Settings) {
  return askedUnits(item).filter(({ unit }) => enabledTypes(unit, settings).length >= 2);
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
  forgetTypes();
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

/*
 * What each form can be asked, kept for as long as the answer holds.
 *
 * Every index below it is something `availableTypes` reads, and that
 * answer is asked of one form half a dozen times over in a single deal —
 * so it is worth keeping, and it is only safe to keep while none of them
 * has moved. Held against the form object itself, which a card edited or
 * answered replaces, so a stale entry cannot outlive the form it is about
 * even between the clearings.
 */
let TYPE_CACHE: WeakMap<Form, { lang: LangId; types: string[] }> = new WeakMap();
/* And each scene's casting, filled whole — see sceneFill. Forgotten with the
   types, because it reads the same indexes they do. */
let SCENE_FILLS: WeakMap<Item, Map<string, Record<string, Record<string, Value>> | null>> = new WeakMap();

/*
 * And which of a blank's words each sentence admits — see askedIn — kept
 * for as long as the indexes it reads hold, and thrown away with them.
 *
 * Asked once per question type, per count the home screen keeps, per
 * sentence, after every answer; and since 0.262 the answer walks every word
 * that could fill the blank, so it is worth working out once. Kept against
 * the sentence's form and the list it was filtered from, and against the
 * language a card with none of its own is read in — the same reason
 * TYPE_CACHE keeps one: the question on screen moves that language in the
 * middle of a render, without any of the setters below being called.
 */
let ASKED_IN: WeakMap<Form, Map<string, { list: Value[]; lang: LangId; out: Value[] }>> = new WeakMap();

/* Thrown away whole rather than picked over: the setters below run
   together, in a handful of lines, and what each of them changes reaches
   most of the answers in here. */
function forgetTypes() {
  TYPE_CACHE = new WeakMap();
  SCENE_FILLS = new WeakMap();
  ASKED_IN = new WeakMap();
}

/* Exported, with the key it is filed under, so a test can say "these words
   exist in this learner's deck" — the one fact a frame's whole behaviour
   turns on and nothing outside a render could otherwise state. The app
   fills it during render, from the cards in hand. */
export function setValueIndex(map: Map<string, Value[]>) {
  VALUE_INDEX = map || new Map();
  forgetTypes();
}

export const valueKey = (langId: LangId, slot: string) => `${langId}\u0000${slot}`;

/*
 * And whether the learner has cleared each of them.
 *
 * True or false is whether a value has been up every level of its own
 * ladder; null is a value that has no ladder — one the teacher marked as
 * not practised on its own, which is never dealt and so can never clear
 * anything. Which of the two it is decides how a hole is gated; the rule
 * itself is valuesAt, in variables.ts, and this is only where the answer
 * is looked up.
 *
 * Beside the index rather than inside the Value, because a Value is the
 * words a card lends and travels into the question itself — how far the
 * learner has got with it is a fact about them, not about the sentence.
 */
let VALUE_REACH: Map<string, boolean | null> = new Map();

/*
 * And the same answer for every other form of a card that fills anything,
 * which is what a sentence puts up where it goes back to the card for the
 * form that agrees — the feminine of an adjective, the person of a verb.
 * A building block is cleared in the form that is shown, so that form is
 * asked too. Kept apart from VALUE_REACH because that map also says which
 * values a frame keeps a record of having met, and a cell nothing lends
 * is not one of those.
 */
let FORM_CLEARED: Map<string, boolean | null> = new Map();

function setValueReach(map: Map<string, boolean | null>, forms?: Map<string, boolean | null>) {
  VALUE_REACH = map || new Map();
  FORM_CLEARED = forms || new Map();
  /* A scene's casting reads what each word has climbed. */
  SCENE_FILLS = new WeakMap();
}

/*
 * Which of the forms and turns on this device a teacher has reviewed, and
 * what they approved: every unit of a card that carries a review, by the
 * unit's id, with the card beside it for a verb's own place. A unit that
 * is not here is asked as it always was — a card written before review
 * existed, or a learner's own. See fillFor.
 */
let REVIEW_GATE: Map<string, { review: Review; card: Item }> = new Map();
export function setReviewGate(map: Map<string, { review: Review; card: Item }>) {
  /* Set on every render with the same memoised map; only a new one changes
     what a form can be asked. */
  if (map && map === REVIEW_GATE) return;
  REVIEW_GATE = map || new Map();
  forgetTypes();
}
export function reviewGateOf(items: Item[]): Map<string, { review: Review; card: Item }> {
  const out: Map<string, { review: Review; card: Item }> = new Map();
  for (const it of items || []) {
    const review = reviewOf(it);
    if (!review) continue;
    for (const form of formsOf(it)) if (form.id) out.set(form.id, { review, card: it });
    /* A turn picked from a sentence card answers to that sentence's review,
       which it carries — see lineGate — not to the scene's. */
    for (const line of linesOf(it)) if (line.id && !pickedFrom(line)) out.set(line.id, { review, card: it });
  }
  for (const it of items || []) {
    for (const line of linesOf(it)) {
      const own = pickedFrom(line) ? reviewOf(line) : null;
      if (line.id && own) out.set(line.id, { review: own, card: it });
    }
  }
  return out;
}

/* Which card, and which form of it, a lent word came from — so a sentence
   can go back to the card for the form that agrees with what stands
   beside it. Filled in the same walk as VALUE_REACH, keyed the same way. */
let VALUE_OWNER: Map<string, { card: Item; form: Form }> = new Map();
function setValueOwner(map: Map<string, { card: Item; form: Form }>) {
  VALUE_OWNER = map || new Map();
  SCENE_FILLS = new WeakMap();
  /* Which words a blank admits is read off the cards they came from. */
  ASKED_IN = new WeakMap();
}

/* Whether a value is cleared, for valuesAt. A value nothing knows about
   reads as not cleared: the whole point of the gate is that a word the
   learner has not got is not one to put in front of somebody. */
const clearedOfValue = (value: Value): boolean | null => {
  const ref = refOf(value);
  return VALUE_REACH.has(ref) ? (VALUE_REACH.get(ref) as boolean | null) : false;
};

/*
 * Whether a word may stand where a sentence put it, in the form it was
 * put there in.
 *
 * The pool already holds only cleared values, but an agreeing card lends
 * its own word and the sentence then puts up another form of it — كبيرة
 * beside a feminine noun where كبير was lent. That form is a building
 * block in its own right, with a ladder of its own, and it is the one the
 * learner reads or writes. A form with no ladder — a card or a form not
 * practised on its own — is introduced by the sentence, as a name is.
 */
const standsAsShown = (value: Value): boolean => {
  const ref = refOf(value);
  if (VALUE_REACH.has(ref)) return VALUE_REACH.get(ref) !== false;
  return FORM_CLEARED.has(ref) ? FORM_CLEARED.get(ref) !== false : true;
};

/* Whether a frame has to keep a record of having met a value — only the
   ones with no ladder of their own to read instead. Everything else is
   gated on its own progress and needs nothing written down. */
const needsMetRecord = (ref: string): boolean => VALUE_REACH.get(ref) === null;

/**
 * The words that stood in this question's blanks, as marks can be made on
 * them.
 *
 * Read off what the question was actually filled with — fillForm records
 * that on the form it casts — rather than worked out a second time, which
 * would draw the values again against a count this very answer is about to
 * move. Each is looked up in the owner index, which knows every form of
 * every card that fills anything, so the cell an adjective agreed into is
 * found as readily as the word a noun lent.
 *
 * The verb's own place is left out. A verb card's sentence fills that from
 * its own table rather than from the deck, so the word standing there is
 * the card's own content and its ladder is the table's gate to open — not
 * something the sentence above it has earned.
 */
export function fillersIn(unit: Form, key: string, settings: Settings): Filler[] {
  const filled = (unit as Record<string, any>).filled as Record<string, string> | undefined;
  if (!filled) return [];
  const own = ownSlot(unit);
  const out: Filler[] = [];
  for (const [slot, ref] of Object.entries(filled)) {
    if (!ref || (own && slot === own)) continue;
    const found = VALUE_OWNER.get(ref);
    if (!found) continue;
    const { card, form } = found;
    /*
     * A card the teacher says is not practised on its own is left to the
     * record the frame already keeps.
     *
     * "Raphael" is in the deck to fill somebody else's sentence, and "what
     * does Raphael mean" is not a question — so it is never dealt, has no
     * ladder, and a schedule written on it would be one nothing ever
     * reads. How far such a value has been met is `met` on the frame, which
     * is exactly the case that field exists for. The two kinds of value
     * answer differently and this is the seam between them.
     */
    if (card.drill === false) continue;
    out.push({
      id: card.id,
      subId: form.id === card.id ? null : form.id,
      /* Only an exercise the word itself climbs: a sentence may be asked
         something its fillers are not. */
      asked: laddered(form, settings).includes(key),
      /* Under way and due, rather than merely open. In memory every type
         carries a state, so "has one" says nothing — what matters is
         whether the word has ever been asked this on its own, which is
         what a phase past `new` means. A sentence keeps a review up to
         date and does not open a rung. */
      ready: (() => {
        const s = statesOf(form)[key];
        return !!s && s.phase !== "new" && stateReady(s);
      })(),
    });
  }
  return out;
}

/**
 * What the words standing in this question's blanks are, where their
 * English does not say — "Your name: plural" in "Your name is Shams".
 *
 * Read off what the question was filled with, as fillersIn is, and named
 * by lentLabel: only a word sharing its English with another form of its
 * own card is tagged, since only then could the sentence be read two ways.
 * One line per blank that needs one, in the order the blanks were filled;
 * nothing, which is almost always, where none does.
 */
export function lentTags(unit: Form | null | undefined, lang: Lang): string[] {
  const filled = unit ? ((unit as Record<string, any>).filled as Record<string, string> | undefined) : undefined;
  if (!filled) return [];
  /* What a value said it was when it was put in — an adjective in
     `{{adjective-is}}` is one of its own forms, chosen by person, and only
     the value knows which. The card would name its own word instead. */
  const told = ((unit as Record<string, any>).tags || {}) as Record<string, string>;
  const out: string[] = [];
  for (const [slot, ref] of Object.entries(filled)) {
    const found = ref ? VALUE_OWNER.get(ref) : null;
    if (!found) continue;
    const label = told[slot] || lentLabel(found.form, found.card, LANGUAGES[String(found.card.lang || "")] || lang);
    if (!label) continue;
    const en = String(found.form.en || "").split("/")[0].trim();
    const line = say("blankForm", { word: en, form: label });
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

/*
 * What each of a unit's variables can be filled with. Empty for the
 * ordinary card, which has no holes in it and never looks.
 *
 * Everything the slot could take, whatever the learner has met: this is the
 * card-level fact — has this hole got anything at all to put in it — that
 * unmetNeeds reports and availableTypes reads. What a *question* may use is
 * fillsAt below, which is narrower and depends on the level being asked.
 *
 * The two are kept apart deliberately. Which exercises a card supports must
 * not depend on how far the learner has got with somebody else's card, or
 * the ladder would be reading itself: openTypes is built on availableTypes,
 * so a pool that shrank as levels opened would change what the levels were.
 */
function fillsFor(unit: Form, langId?: LangId): Record<string, Value[]> {
  const slots = slotsOf(unit);
  if (!slots.length) return {};
  const id = langId || (unit && unit.lang) || activeLang().id;
  const out: Record<string, Value[]> = {};
  for (const slot of slots) out[slot] = askedIn(unit, slot, VALUE_INDEX.get(valueKey(id, slot)) || []);
  return out;
}

/*
 * And of those, the ones this frame wants — once it has said which tenses
 * its verbs should stand in.
 *
 * The index is built once for the whole collection and keyed by the blank's
 * name, because what fills `{{verb}}` is the same list whoever asks. Which
 * of that list *this sentence* wants is a fact about the sentence — "Yesterday
 * {{name}} {{verb}}" wants the past and nothing else — so it is asked here,
 * where the frame is in hand, rather than in the index.
 *
 * Off the form each value came from, which is what VALUE_OWNER is for: a
 * value carries the words a card lends and not where in a table they sit.
 * A value whose owner has gone — a card withdrawn while a session held it —
 * is kept rather than dropped, on the same principle as everything else
 * that reads a card: half of it is worth more than none.
 */
function askedIn(unit: Form, slot: string, list: Value[]): Value[] {
  const rows = slotRows(unit, slot);
  /* And whether the blank agrees with another — a verb beside a subject
     stands in it once per tense, since the subject picks the person. */
  const agrees = !!partnerOf(unit, slotsOf(unit), slot);
  /* And whether it was linked to nothing, which has a word whose forms
     agree stand in it as every form in turn. Never a shortcut past the
     filter, since such a word lends its whole table and only a blank
     linked to nothing takes all of it — see blankAdmits. */
  const alone = linkedToNothing(unit, slot);
  /* Worked out once while the indexes hold — see ASKED_IN. */
  const fallback = activeLang().id;
  let mine = ASKED_IN.get(unit);
  const held = mine && mine.get(slot);
  if (held && held.list === list && held.lang === fallback) return held.out;
  const admits = (lang: Lang) => blankAdmits(lang, () => rows, () => agrees, () => alone);
  const out = list.filter((value) => {
    const owner = VALUE_OWNER.get(refOf(value));
    if (!owner) return true;
    const lang = LANGUAGES[String(owner.card.lang || "")] || activeLang();
    return admits(lang)(owner.card, owner.form, slot);
  });
  if (!mine) {
    mine = new Map();
    ASKED_IN.set(unit, mine);
  }
  mine.set(slot, { list, lang: fallback, out });
  return out;
}

/*
 * And of those, the ones this question may actually be filled with.
 *
 * A hole is filled from what the learner is at least as far along with as
 * the question is asking — see valuesAt, which is where the rule and the
 * reason for it live. Read at the level of the key being asked, so one
 * frame draws on more of its values the further up its own ladder it goes:
 * at the bottom it may take a word merely met, and at the top only one the
 * learner can already write from its meaning.
 */
function fillsAt(unit: Form, key: string, langId?: LangId): Record<string, Value[]> {
  const level = levelOf(key);
  const out: Record<string, Value[]> = {};
  for (const [slot, list] of Object.entries(fillsFor(unit, langId))) {
    out[slot] = valuesAt(list, slot, level, clearedOfValue, unit && unit.met);
  }
  return out;
}

/*
 * Whether this question's holes can be filled at all.
 *
 * A frame whose every value is still ahead of the learner is not a question
 * yet: there is nothing to put in it that they could read or write, and
 * asking it anyway is what put a word nobody had met inside a sentence
 * somebody was told to write. So the key is withheld, and comes back by
 * itself the moment one of its values catches up.
 *
 * The verb's own place is not asked about. A verb card fills that out of
 * its own table rather than from the cards, and quietUnits already decides
 * whether the table has anything to say yet.
 */
function fillableAt(unit: Form, key: string, settings: Settings): boolean {
  /* Any question about a scene with blanks in it — a turn, or the whole
     thing — is a question about the scene filled whole, so it is askable
     exactly when a casting of the whole scene can be made. */
  const placed = sceneOf(unit.id);
  if (placed && hasCast(placed.card)) return !!sceneFill(placed.card, false);
  const own = ownSlot(unit);
  const slots = slotsOf(unit).filter((slot) => slot !== own);
  if (!slots.length) return true;
  const pools = fillsAt(unit, key, langOf(settingsFor(settings, unit)).id);
  if (!slots.every((slot) => (pools[slot] || []).length > 0)) return false;
  /*
   * And that the words this turn picks actually make a sentence.
   *
   * A pool with something in it is not the same as a question that can be
   * drawn: an adjective agreeing with a feminine noun wants its feminine,
   * and a teacher who left that box empty leaves this turn with nothing to
   * put in the hole. Counting the pools alone called that fillable, so the
   * frame was dealt and then drawn with its braces showing, marked against
   * them, and — because the turn only moves on a right answer — asked
   * again every session for ever.
   *
   * So the deal asks the same walk the screen asks, on the same turn, and
   * a combination that cannot be made is simply not offered. It is one
   * turn's answer rather than the card's: the next turn round reaches for
   * different words, and this comes back the moment one of them agrees.
   *
   * Without the card, which is what the verb's own place would need and
   * which this is not handed. That place is not filled from the cards and
   * is gated by its table — see the note above — so it is left out of this
   * walk exactly as it is left out of the count above.
   */
  return !!fillFor(unit, key, null);
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
  forgetTypes();
}

/* The scene a line stands in, or null for anything that is not a line. */
function sceneOf(unitId: string): { card: Item, at: number } | null {
  return DIALOG_INDEX.get(unitId) || null;
}

/* ------------------------------------------------------------------
   The units a verb card asks nothing of

   Two reasons a form carries no questions of its own, and one set, because
   every reader has the same question: is there anything to ask here?

   A cell of a row nobody has reached. The rows are not as hard as each
   other — somebody who can say what they *do* has something to hang the
   past on, and somebody handed present, past and command in one week has
   three tables to confuse — so a row opens only once the row above it is
   cleared, which is the bar a level asks of the level below it applied
   down the other axis.

   And the card's own word, where the language cites a cell that is the
   same word. Arabic has no infinitive: a dictionary lists the he-past, so
   a card reading *to eat* and the cell under he · past hold one word
   between them, and drilling both is drilling it twice. The word stays on
   the card, as its face and its dictionary meaning; the cell is what is
   practised, and is met the day the card is.

   Held at module level for the reason the three indexes above are: a form
   is asked about one at a time, and it carries no pointer back to the card
   whose other cells decide whether it has anything to say.
   ------------------------------------------------------------------ */

let QUIET_UNITS: Set<string> = new Set();

function setQuietUnits(quiet: Set<string>) {
  QUIET_UNITS = quiet || new Set();
}

/* Whether this unit is one of them. False for every form on every card
   written before verbs had tables, which is nearly all of them. */
const isQuiet = (unit: Form): boolean => !!unit && QUIET_UNITS.has(unit.id);

/* ------------------------------------------------------------------
   The ten figures, known

   Writing ٤٧ — from 47, or from the number in words — is asked only once
   the learner has cleared the ten figures it is written in: see
   `afterNumerals` on the exercise. Until then those questions are not on
   a range's ladder at all, so nothing waits on them; once the ten are
   cleared they join it, on the third rung.

   Per number system, read off the ten cards that system brought, and
   afresh with every change, as every gate here is: a figure slipping off
   cleared takes the questions away again until it is back. A system whose
   figures the learner holds none of has nothing to wait on.

   Held at module level for the reason the counts below are: what a range
   can be asked depends on other cards, and availableTypes is handed one
   form. Setting it throws away what forms can be asked, so it is set
   before the walks that read that.
   ------------------------------------------------------------------ */

let NUMERALS_KNOWN: Map<string, boolean> = new Map();

export function setNumeralsKnown(map: Map<string, boolean>) {
  NUMERALS_KNOWN = map || new Map();
  forgetTypes();
}

/* Whether the figures of the system this form belongs to are cleared. */
const numeralsKnownFor = (unit: Form): boolean => NUMERALS_KNOWN.get(systemOfId(unit && unit.id)) !== false;

/**
 * Which systems' ten figures the learner has cleared — up every level of
 * each card's own ladder. A figure they were never handed is not waited
 * on, and neither is one that cannot be asked anything.
 */
export function numeralsKnownOf(items: Item[], settings: Settings): Map<string, boolean> {
  const out: Map<string, boolean> = new Map();
  for (const card of items) {
    if (!isNumeralCard(card) || !isDrillable(card, settings)) continue;
    const unit = leadOf(card);
    if (!isAsked(unit)) continue;
    const types = availableTypes(unit, langOf(settingsFor(settings, card)));
    if (!types.length) continue;
    const system = systemIdOf(card);
    const ok = cleared(types, (t) => statesOf(unit)[t]);
    out.set(system, (out.get(system) ?? true) && ok);
  }
  return out;
}

/* ------------------------------------------------------------------
   The cells a known word is not asked every way about

   A word with pronouns on its end carries eight of them per form, and each
   one differs from the word by an ending the learner is learning once. Ask
   every exercise of all eight and a card whose word is long since learnt
   spends a fortnight being asked, three ways a level, for what it already
   knows.

   So once the word a table hangs off has climbed the whole ladder — it is
   being written from its meaning alone, with nothing on the screen to go
   on — its cells climb a narrower one: **the same four rungs, one exercise
   each**, rather than the two or three a level that a card with a
   recording supports. Nothing about the ladder changes, and nothing is
   skipped; the cell is asked once at each rung instead of two or three
   times.

   Applied in `laddered`, which is the one list every reader downstream
   goes through — what a session deals, where the progress screen says the
   card stands, when it counts as learnt. Narrow it there and the three
   cannot disagree about what is left to do.
   ------------------------------------------------------------------ */

let EASED_UNITS: Set<string> = new Set();

function setEasedUnits(eased: Set<string>) {
  EASED_UNITS = eased || new Set();
}

const isEased = (unit: Form): boolean => !!unit && EASED_UNITS.has(unit.id);

/**
 * One exercise per level, in the order they were handed in.
 *
 * Which one is the first the form supports at that level, which is TYPES
 * order — static, and read off material that does not change under the
 * learner, so the same cell is asked the same way today as tomorrow.
 *
 * Takes keys or types alike: a level is read off either the same way, and
 * a card accepting two spellings is asked for one of them rather than both
 * — which is the same redundancy, one axis over.
 */
export const onePerLevel = (keys: string[]): string[] => {
  const seen: Set<number> = new Set();
  return (keys || []).filter((k) => {
    const level = levelOf(k);
    if (seen.has(level)) return false;
    seen.add(level);
    return true;
  });
};

/* And that rule applied to whatever a caller was about to read off a unit:
   the narrowed list for a cell whose word is known, and the list itself for
   everything else, which is nearly every form in the app. */
const easedTo = (unit: Form, keys: string[]): string[] =>
  isEased(unit) ? onePerLevel(keys) : keys;

/*
 * Which cells those are, across every card in hand.
 *
 * A cell is eased when the form its table hangs off has been *learnt* —
 * up its whole ladder and kept there, both passes made. Read off that form
 * rather than off the cell, which is the same arrangement the gate above
 * makes and for the same reason: the cell is what is being decided about,
 * so asking it would be asking the answer to write itself.
 *
 * Learnt and not merely climbed, because what this thins out is the
 * questioning of eight endings on a word the learner already has, and
 * "already has" is what learnt means. It used to read the top of the
 * ladder being open, which was the same thing while the ladder itself
 * waited four days on everything under the writing; now that the ladder
 * can be climbed in an evening it is not, and easing on the climb would
 * quietly stop asking about a word met that morning.
 *
 * Read afresh every time, so a lapse on the word puts its cells back on the
 * full ladder — the ladder's own habit, and nothing is lost by it: the keys
 * that were not being asked keep whatever they had.
 */
export function easedUnits(items: Item[], settings: Settings): Set<string> {
  const out: Set<string> = new Set();
  for (const card of items) {
    const lang = langOf(settingsFor(settings, card));
    /* Every table whose cells wait on the word — read off the table, so an
       adjective's feminine eases the way the pronouns do without this
       being told there is such a table. */
    for (const spec of Object.values(tablesOf(lang))) {
      if (!waitsOnWord(spec) || !hasCells(card, spec)) continue;
      for (const { unit } of unitsOf(card)) {
        const of = unit.id === card.id ? "" : unit.id;
        const mine = cellsIn(card, spec, of);
        if (!mine.length) continue;
        const supported = availableTypes(unit, lang);
        if (!learnt(supported, (t) => statesOf(unit)[t])) continue;
        for (const cell of mine) out.add(cell.id);
      }
    }
  }
  return out;
}

/*
 * Whether a stretch of the number line is open: every stretch under it is
 * through — its own questions cleared, or every word it is built from
 * cleared, whichever comes first.
 *
 * The own questions were the only way through until 0.368, and a stretch
 * is asked about one question in thirty of a numbers session, because it
 * shares the session with every word it is built from; so the stretch
 * above could stay shut for days after every one of those words was known,
 * and shut again whenever the ten figures added two questions to the
 * stretch below, or a slip on one of them made it miss twice. The words
 * alone were tried and measured, and were slower for somebody whose
 * stretch had cleared first: its questions ask only numbers whose words
 * are cleared, so it can clear before the last spelling of the last word
 * has. Either one lets the stretch above through — the same shape as the
 * front door's `throughDoor` — so nobody waits longer than they did.
 *
 * Read through availableTypes and not laddered, because laddered reads the
 * quiet set this is in the middle of working out. A word with nothing to
 * ask, or one the learner does not hold, holds nothing back. A stretch that
 * does not know its words — one filed before parts were written down —
 * has its own questions alone. Those are its numbers: counting a thing
 * never holds anything back. See countingOf.
 */
function stretchOpen(card: Item, items: Item[], lang: Lang): boolean {
  const below = stretchBefore(card, items);
  if (!below) return true;
  return (stretchCleared(below, lang) || wordsCleared(below, items, lang)) && stretchOpen(below, items, lang);
}

function stretchCleared(stretch: Item, lang: Lang): boolean {
  const unit = stretch.forms[0];
  if (!unit) return false;
  const plain = availableTypes(unit, lang).filter((t) => !((specOf(t) && specOf(t).needs) || []).includes("rangeCounted"));
  return cleared(plain, (t) => statesOf(unit)[t]);
}

function wordsCleared(stretch: Item, items: Item[], lang: Lang): boolean {
  if (!stretch.parts || !stretch.parts.length) return false;
  const byId = byIdOf(items);
  return stretch.parts.every((id) => {
    const card = byId.get(id);
    if (!card || card.drill === false) return true;
    return unitsOf(card).every(({ unit }) => {
      if (!isAsked(unit)) return true;
      const types = availableTypes(unit, lang);
      return !types.length || cleared(types, (t) => statesOf(unit)[t]);
    });
  });
}

/* What a table's cells wait on, where it says nothing: the word, which is
   the rule every one-row table has followed since there was one. */
const waitsOnWord = (spec: VerbSpec): boolean => (spec.gate || "word") === "word";

/*
 * Working them out, across every card in hand.
 *
 * A row counts as done when every cell in it is cleared at everything it
 * is asked — read off the same open types the rest of the app uses, so a
 * cell the learner has switched every exercise off for cannot hold the
 * rows below it shut for ever.
 */
export function quietUnits(items: Item[], settings: Settings): Set<string> {
  const out: Set<string> = new Set();
  const byId = byIdOf(items);
  /* Whether each stretch is open, worked out once however many of its
     words ask. */
  const opened: Map<string, boolean> = new Map();
  const isOpen = (stretch: Item, lang: Lang) => {
    if (!opened.has(stretch.id)) opened.set(stretch.id, stretchOpen(stretch, items, lang));
    return opened.get(stretch.id) as boolean;
  };
  for (const card of items) {
    const lang = langOf(settingsFor(settings, card));
    /*
     * A number's word waits with its stretch — see homeStretch. The word
     * for ninety is not met before 20 to 99 opens, nor *a million* on the
     * first day. Quiet rather than missing, as the stretch is, so it keeps
     * whatever the learner had on it and opens with the stretch.
     */
    const home = homeStretch(card, (id) => byId.get(id), composerFor(card.lang));
    if (home && !isOpen(home, lang)) {
      for (const { unit } of unitsOf(card)) out.add(unit.id);
      continue;
    }
    /*
     * A stretch of the number line that waits on the one below it.
     *
     * 10 to 19 is said out of the words 0 to 9 teaches, so it is not
     * asked until 0 to 9 is cleared — the ladder's own word, read off the
     * same keys. Quiet rather than missing, so it keeps its place in the
     * collection and opens the moment the stretch below clears; and read
     * afresh, so a stretch that slips back off cleared shuts the one above
     * until it is recovered, the way a missed level shuts the levels over
     * it. And all the way down: a learner who cleared 10 to 19 before this
     * rule existed, and not 0 to 9, waits on 0 to 9 for 20 to 99 too.
     */
    if (stretchBefore(card, items)) {
      if (!stretchOpen(card, items, lang)) for (const { unit } of unitsOf(card)) out.add(unit.id);
      continue;
    }
    /* Every table the language declares, each gated by the rule it names
       for itself. Two rules, and which applies used to be decided by which
       accessor a table came from; a third table would have been a third
       branch. */
    for (const spec of Object.values(tablesOf(lang))) {
      if (!hasCells(card, spec)) continue;
      if (waitsOnWord(spec)) {
        /*
         * Cells that wait on the word they are forms of — a word's
         * attached pronouns, an adjective's feminine and plural.
         *
         * "my book" is a form of "book", and meeting the two together is
         * meeting a word you have not learnt in a shape you cannot read.
         * So the row is shut until that word has climbed past level one —
         * the same "recognised before it is produced" the ladder makes,
         * turned sideways, and the same test openTypes makes when it
         * opens level two.
         *
         * Per form where the table is: every form of a word carries its
         * own pronouns, so the plural's wait on the plural and the
         * singular's on the singular. A single gate on the card held the
         * plural's eight open the moment the singular was read. A table
         * the card carries has its cells on the card's own word, which
         * the same loop reaches first.
         *
         * Read off the form rather than off its cells: the cells are what
         * is waiting, and asking them would be asking the gate to open
         * itself. Through availableTypes rather than laddered, for the
         * same reason the row gate below is: laddered asks this very set,
         * and a gate that reads the answer it is in the middle of writing
         * reads whatever the last render left behind.
         */
        for (const { unit } of unitsOf(card)) {
          /* The card's own word owns the table its cells leave unnamed. */
          const of = unit.id === card.id ? "" : unit.id;
          const mine = cellsIn(card, spec, of);
          if (!mine.length) continue;
          const supported = availableTypes(unit, lang);
          const known = reachedLevel(supported, (t) => statesOf(unit)[t], 2);
          if (!known) for (const cell of mine) out.add(cell.id);
        }
        /* And a cell hanging off a form the card no longer carries, which
           is a word with a pronoun on the end of nothing. The editor drops
           these as it saves; one that reaches a device anyway is never
           asked, and the loop above has already passed it over. */
        for (const cell of cellsIn(card, spec)) {
          const of = ownerOf(cell);
          if (of && !subFormsOf(card).some((f) => f.id === of)) out.add(cell.id);
        }
        continue;
      }
      /* Rows that open one at a time: a verb's tenses. */
      quietRows(card, spec, lang, out);
    }
  }
  return out;
}

/*
 * One tense of a verb is ever new at a time.
 *
 * A row counts as done when every cell in it is cleared at everything it
 * is asked — read off the same open types the rest of the app uses, so a
 * cell the learner has switched every exercise off for cannot hold the
 * rows below it shut for ever.
 */
function quietRows(card: Item, spec: VerbSpec, lang: Lang, out: Set<string>) {
  {
    const open = openRows(card, spec, (cell) => {
      /* The ladder as it stands for this cell alone, and deliberately not
         through openTypes: that one asks this very gate, and a gate that
         asks itself would read a cell closed by the row above as having
         nothing left to master — which would open every row at once. The
         quiet window is left out for the same reason it is applied after
         the ladder there: a listening exercise silenced for a quarter of
         an hour is still something to master, not a gap to slip through. */
      const supported = availableTypes(cell, lang);
      const climbing = openTypesOf(supported, (t) => statesOf(cell)[t]);
      /* Nothing to ask, so nothing to wait for: a cell the material cannot
         put a question to must not hold the rows below it shut for ever. */
      if (!climbing.length) return true;
      /* Cleared, since 0.368: every question it can be asked right twice
         running. It was mastered — every one held at a four-day gap — which
         no amount of practice could bring forward, so a verb practised
         every day opened its past tense a week or more after its present
         was known. Cleared is what opens the next thing everywhere else. */
      return cleared(supported, (t) => statesOf(cell)[t]);
    });
    for (const cell of cellsIn(card, spec)) {
      /* The cited cell is the word on the front of the card and is met the
         day the card is, whichever row it happens to sit in. */
      if (isCitation(spec, cell)) continue;
      if (!open.includes(rowOf(cell))) out.add(cell.id);
    }
    /* And the card's own word, where a filled cell says the same word. An
       unfilled one leaves the word as all there is of the verb, so it goes
       on being practised as itself. */
    if (citedCell(card, spec)) out.add(card.id);
  }
}

/* ------------------------------------------------------------------
   Filling the indexes

   Every one of the maps above is a fact about the *rest* of the deck that a
   pure function of one form cannot be handed: where each word turns up,
   what fills each blank and how far the learner has got with it, which
   scene a line belongs to, how much company a word has, which cells are
   behind a gate.

   The render works each of them out and installs it, one memo at a time,
   each with its own dependencies — the context index is expensive and must
   not be rebuilt because a checkbox moved. What the memos held was the
   *working out*, written inline; it is named here instead, so that the
   session builder can be handed a list of cards by something that is not a
   render. That was the whole of why dealing a session could not be tested:
   not the builder, which is a plain function, but the half-dozen maps it
   reads and only a render knew how to fill.
   ------------------------------------------------------------------ */

/**
 * Where each word turns up, across every card in hand.
 *
 * A language at a time, then merged: finding one word inside another is a
 * language's own rule — Arabic peels prefixes — and running one language's
 * rule over another's cards would pair words that have nothing to do with
 * each other. Nothing collides in the merge: the keys are form ids, and a
 * form is in one language.
 */
export function contextIndexOf(items: Item[], settings: Settings): Map<string, any[]> {
  const byLang: Map<LangId, Item[]> = new Map();
  for (const it of items) {
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
}

/**
 * What can fill each variable, by language.
 *
 * Ordered by when the cards were made rather than by where they happen to
 * sit in the document: the rotation walks this list, and a list that
 * reordered itself on a sync would hand somebody a different name for the
 * same count.
 *
 * Every card, not only the ones naming a slot: `{{word}}` is filled by any
 * word in the language with nothing written on it to say so, so what a
 * card fills has to be asked of the card rather than read off a field.
 * And only the forms it lends — an adjective lends its own word, and the
 * sentence picks the form that agrees. See lendsForm.
 */
export function valueIndexOf(items: Item[], settings: Settings): Map<string, Value[]> {
  const map: Map<string, Value[]> = new Map();
  const byAge = [...items].sort(
    (a, b) => (a.created || 0) - (b.created || 0) || a.id.localeCompare(b.id),
  );
  for (const it of byAge) {
    const langId = langIdOf(it, settings);
    const slots = fillsOf(it, kindOf(it, LANGUAGES[langId] || langOf(settings)));
    if (!slots.length) continue;
    const lends = lendsForm(LANGUAGES[langId] || langOf(settings), it);
    const into = lendsInto(LANGUAGES[langId] || langOf(settings));
    for (const value of valuesOf(it, grammarFields(), lends)) {
      for (const slot of slots) {
        const key = valueKey(langId, slot);
        map.set(key, (map.get(key) || []).concat(into(it, value, slot)));
      }
    }
  }
  return map;
}

/**
 * And whether the learner has cleared each of them, with the form each
 * was lent by.
 *
 * Only the cards that fill something, so this is a walk over the values
 * rather than over the deck. A value that is drilled on its own carries
 * whether it is cleared — up every level of its own ladder, by the same
 * test the progress screen makes — and a value that is not carries null,
 * because it is never dealt and has no ladder to read. What each of those
 * means for a hole is valuesAt's business, not this one's.
 *
 * Read off the form itself, which is the word a hole borrows: a plural the
 * learner has cleared stands in a sentence whatever the singular beside it
 * has done. A form lent and not asked on its own, on a card that is
 * otherwise practised — a plural kept for sentences — has no ladder either,
 * and is read as a name is. It used to read as never met, and so never
 * stood anywhere.
 */
export function valueReachOf(
  items: Item[],
  settings: Settings,
): {
  map: Map<string, boolean | null>;
  forms: Map<string, boolean | null>;
  owner: Map<string, { card: Item; form: Form }>;
} {
  const map: Map<string, boolean | null> = new Map();
  const forms: Map<string, boolean | null> = new Map();
  const owner: Map<string, { card: Item; form: Form }> = new Map();
  const clearedOf = (form: Form, drilled: boolean): boolean | null => {
    if (!drilled || !isAsked(form)) return null;
    return cleared(laddered(form, settings), (key: string) => statesOf(form)[key]);
  };
  for (const it of items) {
    const langId = langIdOf(it, settings);
    const lang = LANGUAGES[langId] || langOf(settings);
    if (!fillsOf(it, kindOf(it, lang)).length) continue;
    const drilled = isDrillable(it, settings);
    for (const { form, value } of lentBy(it, [], lendsForm(lang, it))) {
      const ref = refOf(value);
      if (!ref) continue;
      owner.set(ref, { card: it, form: form as Form });
      map.set(ref, clearedOf(form as Form, drilled));
    }
    /*
     * And every other form of the card, for the owner index alone.
     *
     * What a sentence records having been filled with is the form that was
     * actually put on the screen, and that is not always one the card
     * *lends*: an adjective lends its own word and the sentence goes back
     * to the table for the form that agrees, so the word that stood in the
     * blank is a cell nothing lent. Answering such a sentence is answering
     * about that cell, so it has to be findable — see fillersIn.
     *
     * And whether it is cleared, since it is the form the learner reads —
     * see standsAsShown. The reach map is left to the lent values: which
     * values a hole may take is read off the pool, and which of them a
     * frame records having met is read off the same map.
     */
    for (const form of formsOf(it)) {
      const ref = form.id === it.id ? it.id : form.id;
      if (!ref) continue;
      if (!forms.has(ref)) forms.set(ref, clearedOf(form, drilled));
      if (owner.has(ref)) continue;
      owner.set(ref, { card: it, form });
    }
  }
  return { map, forms, owner };
}

/**
 * All of them at once, from a list of cards.
 *
 * What a render does across seven memos, in one call and in the order they
 * depend on each other: the gates read the ladder, and the ladder reads
 * how much company a word has. The app does not use this — it needs the
 * separate dependencies, so that typing in a box does not rebuild the
 * index that walks every phrase against every word — and a test does,
 * because a session cannot be dealt from a deck nobody has indexed.
 *
 * Which makes it a seam rather than a shortcut, and the reason it is worth
 * having is that the alternative was leaving the whole session layer
 * untestable: `buildSession` is a plain function of its arguments and
 * always was, and this is the rest of what it reads.
 */
export function installIndexes(items: Item[], settings: Settings, systems: SystemSet[] = []): void {
  setActiveLang(settings.language || DEFAULT_LANGUAGE);
  setContextIndex(contextIndexOf(items, settings));
  setDialogIndex(buildDialogIndex(items));
  /* And the numbers the parts lend to sentences, as the app adds them. */
  const lent = items.concat(systems.flatMap((set) => fillerCards(composerFor(set.numbers.languageId), set.numbers)));
  setValueIndex(valueIndexOf(lent, settings));
  setReviewGate(reviewGateOf(items));
  setNumeralsKnown(numeralsKnownOf(items, settings));
  /*
   * The counts before the three walks that read them, and not after.
   *
   * Each of these setters throws away what a form can be asked, because
   * each of them changes it — so one that lands in the middle of the
   * walks below undoes the work they have just done, and the three of
   * them read the same ladder for the same forms three times over. They
   * do not depend on each other, so the order is free, and putting the
   * last of the setters first means the answers are worked out once.
   */
  setMateCounts(countMates(items, settings));
  setPicturedCounts(countPictured(items, settings));
  setHeardCounts(countHeard(items, settings));
  const reach = valueReachOf(lent, settings);
  setValueReach(reach.map, reach.forms);
  setValueOwner(reach.owner);
  setQuietUnits(quietUnits(items, settings));
  setEasedUnits(easedUnits(items, settings));
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

/* Exported for the reason setValueIndex is: how many other words a deck
   holds is a fact about the deck, and whether a word can be told apart
   from anything depends on it. A test that wants the pick exercises on the
   table has to be able to say the deck is not empty. */
export function setMateCounts(map: Map<LangId, number>) {
  MATE_COUNTS = map || new Map();
  forgetTypes();
}

/* Everything else in this language that could stand beside it. Its own
   card is in the count, so one is taken off. */
function matesFor(unit: Form, settings?: Settings): number {
  const id = (unit && unit.lang) || (settings && settings.language) || activeLang().id;
  return Math.max(0, (MATE_COUNTS.get(id) || 0) - 1);
}

/* The same count for pictures: how many words in each language carry one.
   What "Listen → picture" draws its three wrong pictures from, and so
   what decides whether it can be asked at all. */
let PICTURED_COUNTS: Map<LangId, number> = new Map();

export function setPicturedCounts(map: Map<LangId, number>) {
  PICTURED_COUNTS = map || new Map();
  forgetTypes();
}

/* Everything else in this language with a picture — its own taken off
   where it has one, which it has if it is being asked about. */
function picturedFor(unit: Form, settings?: Settings): number {
  const id = (unit && unit.lang) || (settings && settings.language) || activeLang().id;
  const own = unit && Array.isArray(unit.images) && unit.images.length ? 1 : 0;
  return Math.max(0, (PICTURED_COUNTS.get(id) || 0) - own);
}

/* Words with a picture: the tiles "Listen → picture" can put beside the
   right one. The same cards countMates counts, narrowed to those with a
   picture on the form. */
function countPictured(items: Item[], settings: Settings): Map<LangId, number> {
  const counts: Map<LangId, number> = new Map();
  for (const card of items) {
    if (isDialog(card) || card.drill === false) continue;
    const id = langIdOf(card, settings);
    for (const { unit } of unitsOf(card)) {
      if (unit.ar && !hasSlots(unit) && Array.isArray(unit.images) && unit.images.length) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }
  return counts;
}

/* And for recordings: how many words in each language could stand in the
   grid of recordings, each tile being a play button. */
let HEARD_COUNTS: Map<LangId, number> = new Map();

export function setHeardCounts(map: Map<LangId, number>) {
  HEARD_COUNTS = map || new Map();
  forgetTypes();
}

function heardFor(unit: Form, settings?: Settings): number {
  const id = (unit && unit.lang) || (settings && settings.language) || activeLang().id;
  const own = unit && (unit.recs || []).length ? 1 : 0;
  return Math.max(0, (HEARD_COUNTS.get(id) || 0) - own);
}

function countHeard(items: Item[], settings: Settings): Map<LangId, number> {
  const counts: Map<LangId, number> = new Map();
  for (const card of items) {
    if (isDialog(card) || card.drill === false) continue;
    const id = langIdOf(card, settings);
    for (const { unit } of unitsOf(card)) {
      if (unit.ar && !hasSlots(unit) && (unit.recs || []).length) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }
  return counts;
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

/* What a question may draw its company from — the wrong answers, the
   other tiles. Everything the learner holds, unless the session is
   numbers alone: then the other number words, so a number is told apart
   from numbers. See `within` on the question. Exported for the tests. */
export function companyOf(items: Item[], exercise: Question | null | undefined): Item[] {
  return exercise && exercise.within === "numbers" ? items.filter((it) => isFromSystem(it)) : items;
}

/* Every line of every dialog, for the exercise that offers three wrong
   replies beside the right one. Kept to the language being asked: a
   Vietnamese line among three Arabic ones is not a distractor, it is a
   giveaway. */
function replyPool(items: Item[], settings: Settings, langId: LangId) {
  const out = [];
  for (const card of items) {
    if (!isDialog(card) || langIdOf(card, settings) !== langId) continue;
    /* Not a line with a blank in it: another scene's turn is offered as
       it would read, and an unfilled one would put braces among the
       replies. Nor a line of a text, which nobody said to anybody. */
    if (isText(card)) continue;
    for (const line of linesOf(card)) if (line.ar && !slotsOf(line).length) out.push(line);
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
 * form has been answered *right* — see turnOf — so a word that has three
 * contexts meets all three before it meets any of them twice, and a phrase
 * that was missed is the one asked again rather than a new one. Random
 * choice would leave one context unseen for a surprisingly long time.
 */
function pickContext(unit: Form, type: string) {
  const list = contextsFor(unit.id).filter((c) =>
    specOf(type) && specOf(type).needs.includes("contextAudio") ? (c.recs || []).length > 0 : true
  );
  if (!list.length) return null;
  const seen = turnOf(unit.s && unit.s[type]);
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
 * often this exercise has been answered right, like everything else that
 * varies between askings: see turnOf, which is where the reason lives.
 * Nothing is drawn: a card with three names is met as all three before it
 * is met as any of them twice, the name stays put until the sentence it is
 * in has been got right, and a re-render cannot swap it under somebody
 * halfway through typing.
 *
 * Comes back untouched where a variable has nothing to fill it. That is not
 * a question — canAsk refuses it, so it should never reach here — and
 * leaving {{name}} standing is a visible bug rather than a silent gap.
 */
/* The agreement step lives in review.ts now, because the teacher's review
   list has to take it too — a list that stopped short of it listed the
   masculine where a student was shown the feminine. Re-exported so what
   reads it from here still can. */
export { agreeTook };

/*
 * The words that stand in this question's holes, this time round — or
 * nothing, where there is no set of them that makes a sentence.
 *
 * One walk, asked by both the people who need it: the deal, to decide
 * whether this is a question at all (fillableAt), and the screen, to draw
 * it (castFill). They used to be two — a count of the pools on one side
 * and a fill on the other — and the difference between them was a question
 * that passed the count, failed the fill, and was drawn with its own
 * braces showing.
 *
 * `card` is the card the form belongs to, and is wanted for one thing: the
 * verb's own place in its own sentence, which is filled from the card's
 * table rather than from the pool. A caller that has not got it passes
 * null and that place is left alone, which is what the gate on the table
 * already decides.
 */
function fillFor(
  unit: Form,
  type: string,
  card: Item | null,
  /*
   * A teacher trying one of their own exercises out, which is not somebody
   * learning: the card is their material rather than anything this device
   * has progress on, so there is no "how far along are they" to read and
   * every value stands. Gating it would show a teacher {{name}} and call it
   * a preview of the question.
   */
  preview = false,
): Record<string, Value> | null {
  const slots = slotsOf(unit);
  const seen = turnOf(unit.s && unit.s[type]);
  /* The verb's own place is not filled from the cards: it is filled from
     the card's own table, by whatever fills the subject. So it is left out
     of the draw and put back below. Only on the card's own sentence — see
     ownSlot — because the same name on a sentence card is an ordinary
     blank, filled by the verbs like any other. */
  const own = ownSlot(unit);
  const drawn = slots.filter((slot) => slot !== own);
  const pool = preview ? fillsFor(unit) : fillsAt(unit, type);
  /*
   * A card a teacher has reviewed is asked only in the sentences they
   * approved — see review.ts. The turn is where the walk starts rather
   * than the one combination it lands on: the next approved sentence from
   * here, so the same count is still the same question and a frame whose
   * next few combinations are waiting for the teacher is asked in the one
   * after them instead of not at all. None approved at this level is no
   * question, and it comes back the moment the teacher approves one.
   *
   * A teacher trying their own card out is shown it whatever its review,
   * which is what trying it out is for.
   */
  const gate = preview ? null : REVIEW_GATE.get(unit.id) || null;
  if (gate) return gatedFill(unit, gate, drawn, pool, seen);
  /*
   * Forward from the turn to the first combination that makes a sentence
   * the learner can be put — the same walk a reviewed card takes.
   *
   * A combination can fail after the pool has passed it: an agreeing word
   * whose cell for this partner is blank, or one whose cell is a form the
   * learner has not cleared yet (see standsAsShown). Waiting on it held
   * the whole frame, since the turn moves only on a right answer and a
   * frame that cannot be asked is never answered. So the walk moves on,
   * and the same count still lands on the same sentence.
   */
  const combos = drawn.reduce((n, slot) => n * (pool[slot] || []).length, 1);
  const walk = drawn.length ? Math.min(combos, SCAN_LIMIT) : 1;
  for (let i = 0; i < walk; i++) {
    const turned = valuesForTurn(drawn, pool, seen + i);
    if (!turned) return null;
    const took = tookFor(unit, card, turned, slots, drawn, own);
    if (!took) continue;
    if (preview || drawn.every((slot) => standsAsShown(took[slot]))) return took;
  }
  return null;
}

/* One combination of values, agreed — the form that agrees with the blank
   beside it put in place of the word an agreeing card lent — and the
   verb's own place filled from its table. Null where any of it has
   nothing to put there: a cell the teacher left blank is no question. */
function tookFor(
  unit: Form,
  card: Item | null,
  turned: Record<string, Value>,
  slots: string[],
  drawn: string[],
  own: string | null,
): Record<string, Value> | null {
  const took = agreeTook(
    turned,
    drawn,
    (v) => VALUE_OWNER.get(refOf(v)) || null,
    (c) => LANGUAGES[String(c.lang || "")] || activeLang(),
    slotLinks(unit),
  );
  if (!took) return null;
  if (card && own && slots.length !== drawn.length) {
    const agreed = verbValue({ unit, parent: card }, took, leadsOf(
      turned,
      slots,
      (v) => VALUE_OWNER.get(refOf(v)) || null,
      (c) => LANGUAGES[String(c.lang || "")] || activeLang(),
    ));
    /* No cell for what filled the subject — a sentence wanting the plural
       of a verb whose plural the teacher left blank. The same answer for
       the same reason. */
    if (!agreed) return null;
    took[own] = agreed;
  }
  return took;
}

/* The walk a reviewed card is filled by: forward from the turn, over at
   most every combination once, to the first sentence on the approved list.
   Filled whole — the verb's own place included, off the card the gate
   carries — because what is approved is the sentence as it is shown. */
function gatedFill(
  unit: Form,
  gate: { review: Review; card: Item },
  drawn: string[],
  pool: Record<string, Value[]>,
  seen: number,
): Record<string, Value> | null {
  const combos = drawn.length ? drawn.reduce((n, slot) => n * (pool[slot] || []).length, 1) : 0;
  const walk = Math.min(combos, SCAN_LIMIT);
  const ownerOf = (v: Value) => VALUE_OWNER.get(refOf(v)) || null;
  const langFor = (c: Record<string, any>) => LANGUAGES[String(c.lang || "")] || activeLang();
  for (let i = 0; i < walk; i++) {
    const turned = valuesForTurn(drawn, pool, seen + i);
    if (!turned) return null;
    const took = finishTook(unit, gate.card, turned, drawn, ownerOf, langFor);
    if (!took) continue;
    /* And every word in the form it is shown in cleared — see fillFor. */
    if (!drawn.every((slot) => standsAsShown(took[slot]))) continue;
    if (passes(gate.review, sentenceKey(fillForm(unit, took, false)))) return took;
  }
  return null;
}

/**
 * One question's form with its blanks filled, as the screen would draw it.
 *
 * Exported for the reason setValueIndex is: what a sentence is filled
 * with — and whether a teacher's review lets it be filled at all — is the
 * whole of what the review gate does, and nothing outside a render could
 * otherwise ask it. Indexes first; see installIndexes.
 */
export function castQuestion(items: Item[], ex: Question, preview = false): Form | null {
  const cast = castFill(resolveUnit(items, ex), ex.type, preview);
  return cast ? cast.unit : null;
}

/* ------------------------------------------------------------------
   A scene, filled whole

   A scene's blanks are filled once for the whole scene, through its cast —
   see cast.ts — so the person in the first line is the person in the last.
   Every question about the scene is asked of the same filling: the
   read-through, the turn to reply to, the lines to put back in order.

   Which filling is the scene's own count of having been read through, not
   the count of whichever question is up: a session that introduces a scene
   and then asks for a reply in it must not introduce Sami and answer Rami.
   It moves on when the learner has read it through again.

   Filled at the bottom level whatever is being asked, which matters only
   to the words with no ladder of their own — names, introduced by the
   scene itself and read off its record of having met them. Every other
   word is a building block and stands only once it is cleared, as in a
   sentence. Holding a choice question on the third level to names already
   met there left them out of every turn for ever.
   ------------------------------------------------------------------ */

const SCENE_KEY = "dlgwhole";

function sceneFill(scene: Item, preview: boolean): Record<string, Record<string, Value>> | null {
  const turn = turnOf((leadOf(scene).s || {})[SCENE_KEY]);
  const memo = `${preview ? "p" : "a"}${turn}`;
  const held = SCENE_FILLS.get(scene);
  if (held && held.has(memo)) return held.get(memo) as Record<string, Record<string, Value>> | null;
  const took = castScene({
    card: scene,
    poolOf: (line) => (preview ? fillsFor(line as Form) : fillsAt(line as Form, SCENE_KEY)),
    ownerOf: (v) => VALUE_OWNER.get(refOf(v)) || null,
    langFor: (c) => LANGUAGES[String(c.lang || "")] || activeLang(),
    /* A teacher trying their own scene out sees it whatever its review,
       as they do a sentence. */
    gateOf: preview ? undefined : (line) => lineGate(scene, line),
    /* And every word in the form a line puts it in cleared, as in a
       sentence — see standsAsShown. */
    shown: preview ? undefined : standsAsShown,
    turn,
  });
  const map = held || new Map();
  map.set(memo, took);
  if (!held) SCENE_FILLS.set(scene, map);
  return took;
}

function castFill(
  resolved: { unit: Form, parent: Item, isSub: boolean } | null,
  type: string,
  preview = false,
) {
  if (!resolved) return resolved;
  if (isDialog(resolved.parent) && hasCast(resolved.parent)) {
    const took = sceneFill(resolved.parent, preview);
    /* Nothing that makes a scene: left as it stands, as a sentence is, and
       not dealt — see fillableAt. */
    if (!took) return resolved;
    const parent = filledScene(resolved.parent, took);
    const unit = resolved.isSub
      ? (linesOf(parent).find((l) => l.id === resolved.unit.id) as Form | undefined) || resolved.unit
      : resolved.unit;
    return { ...resolved, unit, parent };
  }
  if (!slotsOf(resolved.unit).length) return resolved;
  const took = fillFor(resolved.unit, type, resolved.parent, preview);
  /*
   * Nothing that could go in the holes. The deal does not offer such a
   * question and the queue drops one that has become so — see fillableAt
   * and requeueUnaskable — so what is left here is the sliver between an
   * answer and the next draw. Left exactly as it stands rather than half
   * filled, and gone by the time anybody could read it.
   */
  if (!took) return resolved;
  const filled = fillForm(resolved.unit, took) as any;
  /* The sentence's fingerprint, as it was filled and before anything
     narrows it to one answer — what a report about it names, so the
     teacher can strike this sentence and no other. See review.ts. Taken
     from the words as written, before a capital is fitted to them. */
  const unit = { ...filled, reviewKey: sentenceKey(fillForm(resolved.unit, took, false)) };
  return {
    ...resolved,
    unit,
    parent: resolved.isSub ? resolved.parent : withLead(resolved.parent, unit),
  };
}

/** Figures as a language writes them — see inOwnFigures. */
export const ownFigures = (lang: Lang | undefined, digits: string): string =>
  inOwnFigures(digits, lang && lang.numerals);

/**
 * A skill, cast as the question it was dealt.
 *
 * A range carries no words: it is a schedule and a marker. What it is
 * *about* was drawn when the queue was built and rides on the question,
 * so this is where the words are finally said — the script, the figures,
 * and the two hands of a clock where one is being read.
 *
 * Nothing here reaches the disk. The cast form is for showing, as every
 * cast form is: the schedule that is written afterwards belongs to the
 * skill, and the cards the words came from are credited through their own
 * tokens. See DECISIONS.md — "a cast form is for showing, never for
 * deciding".
 */
function castRange(
  resolved: { unit: Form; parent: Item; isSub: boolean } | null,
  ex: Question | null | undefined,
  sets: SystemSet[],
) {
  if (!resolved || !ex || !ex.ask || !resolved.parent.range) return resolved;
  const set = systemFor(resolved.parent, sets);
  if (!set) return resolved;
  const said = renderAsk(
    ex.ask,
    composerFor(set.numbers.languageId),
    set.numbers,
    timeComposerFor(set.numbers.languageId),
    set.times,
  );
  if (!said.text) return resolved;
  const figures = ownFigures(LANGUAGES[set.numbers.languageId], said.digits);
  const unit: Form = {
    ...resolved.unit,
    ar: said.text,
    en: said.digits,
    /* And the same in the language's own figures, where it has them — ٤٧,
       ٠٧:١٥ — which the top of the skill is asked from. */
    ...(figures ? { numeral: figures } : null),
    /* What it means in words, where a counted phrase has anything to say
       beyond the figures. */
    ...(said.en && said.en !== said.digits ? { gloss: said.en } : null),
    /* The two hands, for the question that draws a face and the one that
       is answered by setting one. */
    ...(typeof said.hour === "number"
      ? { hour: said.hour, minute: said.minute || 0 }
      : null),
    /* The recordings, in order: at most two, the hour and the minutes.
       Nothing inside a number is ever stitched. */
    ...(said.clips && said.clips.length ? { recSeq: said.clips } : null),
    /* A number's own recording, where it was recorded whole — and none
       where it was not. The skill carries a marker saying only that
       *something* in the system was recorded, which is what lets a
       listening question be dealt; left on the form, it was a player on
       the answer screen with nothing behind it. */
    recs: (said.recs || []).map((id) => ({ id, label: "", speed: "" })),
    /* How it sounds, for the answer screen — only there when every word
       in it has a transliteration. */
    lat: said.lat || "",
    /* Which words stood in it, so a right answer credits the cards they
       are written on — the same crediting a sentence does for the words
       that filled its blanks. */
    tokens: said.tokens,
  };
  return { ...resolved, unit, parent: withLead(resolved.parent, unit) };
}

/*
 * The form of the verb this sentence wants, this time round.
 *
 * The row is the sentence's — one that opens "Yesterday" wants the past
 * whoever is in it — and the column is the subject's, worked out from the
 * grammar already recorded on whatever filled the first hole. Sarah is
 * singular and feminine, so the verb is the *she* cell; the children are
 * plural, so it is *they*. Nothing has to be added to Sarah for this: her
 * card already says what she is, because every card does.
 *
 * Null where the pair names a cell the teacher left blank, or where the
 * subject's card declares nothing for the language to read.
 */
function verbValue(
  resolved: { unit: Form, parent: Item },
  took: Record<string, Value>,
  /* The blanks a subject can be, less any an agreeing word filled — see
     leadsOf in review.ts. */
  leads: string[],
): Value | null {
  const card = resolved.parent;
  /* The card's own language, the way every module-level reader here takes
     it: the pointer set during render is not to be relied on from a
     function that runs from anywhere. */
  const spec = verbOf(LANGUAGES[String((card && card.lang) || "")] || activeLang());
  const subject = subjectSlot(leads) || subjectSlot(slotsOf(resolved.unit));
  const filler = subject ? took[subject] : null;
  const cell = agreedCell(card, spec, rowOf(resolved.unit), filler ? filler.grammar : null);
  if (!cell || !cell.ar) return null;
  return { id: cell.id, ar: cell.ar, en: cell.en, lat: cell.lat };
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
 * Every other question narrows too, and for a plainer reason: a card
 * accepting two spellings put up whole reads as one long word with a slash
 * through it, and gives away that it has two answers to a learner who was
 * asked about neither. Whatever the question shows — the word above it,
 * the four words to choose between, the tiles of a grid — shows one.
 *
 * The exception is the question that asks for the word to be *typed* in
 * the script. There the whole point of a second accepted answer is that it
 * is accepted, so the card keeps all of them: narrowing what is shown must
 * never narrow what is right. Pronunciation is the one case that types the
 * script and narrows anyway, which is the paragraph above — it is asked
 * about one spelling by name.
 */
function castAnswer(resolved: { unit: Form, parent: Item, isSub: boolean } | null, type: string) {
  if (!resolved) return resolved;
  const spec = specOf(type);
  if (!spec) return resolved;
  /* Which way this question goes is written down once, in the language
     table, so it can be read and checked against every exercise at once
     rather than inferred from here. */
  if (!showsOneAnswer(type)) return resolved;
  const bySound = spec.needs.includes("lat");
  const seen = turnOf(resolved.unit.s && resolved.unit.s[type]);
  /* Which answer this question is about is the key's to say, not the
     count's: a card accepting two words carries a schedule for each, and
     the one being asked is named in the key that was dealt. Only where
     there is no such key — a question about a pronunciation, which picks
     among the answers that have one — does the count still decide. */
  const answer = bySound
    ? answerForTurn(resolved.unit, seen)
    : answerAt(resolved.unit, answerOf(type), answerFields());
  if (!answer) return resolved;
  const unit = (oneAnswer(resolved.unit, answer) as any);
  return {
    ...resolved,
    unit,
    parent: resolved.isSub ? resolved.parent : withLead(resolved.parent, unit),
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
  const spec = specOf(type);
  /* Where the meaning is the question, and where it is the answer: a card
     that means two things puts one of them up, so the tile the learner
     taps is the string this is marked against. Without it a card reading
     "book, volume" would have that whole string as its one right tile. */
  /* And wherever else a meaning is put on the screen. A grid is the one
     that was missed: it shows a column of meanings beside a column of
     words, and a card meaning two things had both of them on its tile —
     the longest tile in the grid, and the answer given away by its
     length. */
  if (!spec) return resolved;
  if (spec.promptField !== "en" && spec.picks !== "meaning" && spec.picks !== "pair") {
    return resolved;
  }
  const seen = turnOf(resolved.unit.s && resolved.unit.s[type]);
  const one = meaningForTurn(resolved.unit, seen);
  /* Nothing to narrow: one meaning, or none written at all — in which case
     this exercise was never offered, and the card is left exactly as it is
     rather than having its one empty field rewritten. */
  if (!one || one === String(resolved.unit.en || "").trim()) return resolved;
  const unit = ({ ...resolved.unit, en: one } as any);
  return {
    ...resolved,
    unit,
    parent: resolved.isSub ? resolved.parent : withLead(resolved.parent, unit),
  };
}

/*
 * The same narrowing, for a word the question did not resolve.
 *
 * The castings above narrow the unit being asked. A matching grid puts
 * four more words beside it, and a choice puts three, and those are
 * fetched straight out of the learner's cards — so they arrive as written,
 * two spellings and two meanings and all. One long tile among four short
 * ones is the answer given away by its shape, whichever column it is in.
 *
 * Each on its own count, so a word shown in two grids running is not shown
 * the same spelling both times, and the same word narrows the same way
 * wherever it turns up in one asking. The count is of right answers, as
 * everywhere else that rotates — see turnOf.
 */
function oneOf(unit: Form, type: string): Form {
  const seen = turnOf(unit.s && unit.s[type]);
  const answer = answerAt(unit, seen, answerFields());
  const meaning = meaningForTurn(unit, seen);
  const out = answer ? (oneAnswer(unit, answer) as Form) : unit;
  return meaning && meaning !== String(out.en || "").trim() ? { ...out, en: meaning } : out;
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

/*
 * Whether a type may be asked at this moment, of this form.
 *
 * Nothing here is about what a card *supports* — that is a fact about the
 * card and does not change with the hour or the connection. These are the
 * two things that can make a supported exercise unaskable right now, and
 * both of them pass.
 *
 * The clock: someone who cannot play sound where they are has said so, and
 * listening exercises stop being asked until it runs out.
 *
 * And the connection. A recording that is not on this device is fetched
 * when it is needed, which works until there is nothing to fetch it from —
 * and then the question was still dealt, put a silent player on the screen
 * and told the learner the clip "isn't on this device yet", leaving them to
 * skip a question they were never able to answer. Offline, a form whose
 * recordings are all elsewhere is treated exactly as one whose listening
 * exercises are paused: not asked, not counted as missing, and back the
 * moment there is a connection or the recordings have been downloaded.
 */
function typeAllowedNow(type: string, unit?: Form) {
  /* A question that shows a picture has to be able to show it, which
     offline means the picture is on this device — the same rule the
     recordings follow below, for the same reason. */
  if (isPictured(type) && !canSeeHere(unit)) return false;
  if (!isListening(type)) return true;
  if (listenOffUntil > Date.now()) return false;
  return canHearHere(unit);
}

/* Whether an exercise shows one of the card's pictures — as its prompt, or
   as the answer among four. */
function isPictured(type: string) {
  const spec = specOf(type);
  return !!spec && spec.needs.includes("images");
}

/*
 * Which pictures are on this device, and whether anybody has looked. The
 * same shape as audibleClips below: null until the first look, and before
 * that every picture is assumed reachable.
 */
let visibleImages: Set<string> | null = null;
export function setVisibleImages(ids: Set<string> | null) {
  visibleImages = ids;
}

/** Whether this form's picture can be shown without a connection. */
function canSeeHere(unit?: Form) {
  if (!offlineNow || !visibleImages || !unit) return true;
  const images = Array.isArray(unit.images) ? unit.images : [];
  if (!images.length) return true;
  return images.some((h) => visibleImages !== null && visibleImages.has(h));
}

/*
 * Whether there is a connection, for the helpers below.
 *
 * Read from a flag set during render rather than asked of the browser on
 * the spot, for the same two reasons the clock above is: these are plain
 * functions rather than hooks, and a test has to be able to say what the
 * answer is. Exported with the recordings for that second reason — what a
 * session may ask is the one thing here no screenshot could show.
 */
let offlineNow = false;
export function setOfflineNow(off: boolean) {
  offlineNow = !!off;
}

/*
 * Which recordings are on this device, and whether anybody has looked.
 *
 * Module-level for the same reason as the clock above: the helpers that
 * read it are plain functions called from anywhere rather than hooks. Null
 * means the question has not been asked yet, which is not the same as
 * "none" — before the first look everything is assumed reachable, because
 * the alternative is silencing a card that is in fact ready.
 */
let audibleClips: Set<string> | null = null;
export function setAudibleClips(ids: Set<string> | null) {
  audibleClips = ids;
}

/** Whether this form has a recording that can be played without a connection. */
function canHearHere(unit?: Form) {
  /* Online, anything the server holds is a fetch away, and a form with no
     recordings at all is not this rule's business — nothing offers it a
     listening exercise in the first place. */
  if (!offlineNow || !audibleClips || !unit) return true;
  const recs = unit.recs || [];
  if (!recs.length) return true;
  return recs.some((r) => audibleClips !== null && audibleClips.has(r.id));
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
 * Take out of what is left of a queue anything that can no longer be asked.
 *
 * Only the tail is rewritten — everything before `from` has been answered and
 * is left exactly as it was. That is what keeps the cursor honest: filtering
 * the whole array would slide later entries down underneath a stationary
 * index, and the learner would silently skip questions they had never seen.
 *
 * A question that can no longer be asked becomes another way of asking about
 * the same card, preferring one that is not already queued for it. A card
 * that has nothing else to offer — a recording and a spelling, no English —
 * drops out of the rest of the session; there is genuinely nothing to ask.
 *
 * "Can no longer be asked" is `openTypes` and not a rule of its own, which is
 * what lets one walk serve every reason a question can go away while a
 * session is running. It was written for one of them — somebody saying they
 * cannot listen just now — and the others were left unhandled: a connection
 * dropping mid-session left the queue full of recordings that were never
 * downloaded, and the learner met a silent player on a question they could
 * only skip. Asking the same door every builder asks means a reason handled
 * anywhere is handled here.
 */
export function requeueUnaskable(exercises: Question[], from: number, items: Item[], settings: Settings): Question[] {
  const keyOf = (ex: Question) => `${ex.id}\u0000${ex.subId || ""}`;
  const used: Map<string, Set<string>> = new Map();
  const note = (ex: Question, type: string) => {
    const k = keyOf(ex);
    let seen = used.get(k);
    if (!seen) used.set(k, (seen = new Set()));
    seen.add(type);
  };
  /* Everything already planned counts, answered or not: a substitute should
     be a different question, not the one queued two turns later. */
  for (const ex of exercises) note(ex, ex.type);

  const tail: Question[] = [];
  let swapped = false;
  for (const ex of exercises.slice(from)) {
    const resolved = resolveUnit(items, ex);
    /* A card that has gone from under the queue — withdrawn mid-session —
       takes its questions with it. */
    if (!resolved) continue;
    /* Asked of the gate rather than of the clock or the connection, so this
       answers the same way whenever it is called — including from a test.

       Through askableTypes and not openTypes, which is the same door the
       deal uses: a sentence whose last filler lapsed between two questions
       is as unaskable as a recording that never downloaded, and reading
       the ladder alone left it in the queue to be drawn with its holes
       empty. */
    const open = askableTypes(resolved.unit, settings);
    /* Still askable: left exactly as it is, cursor and all. */
    if (open.includes(ex.type)) {
      tail.push(ex);
      continue;
    }
    /* From the levels the form has reached, and never the grid: a grid is
       dealt when the session is built, and one conjured here would be a
       word alone with nothing to be told apart from. Nor another listening
       exercise: sound is much the commonest reason a question is withdrawn
       mid-session, and swapping one for another of the same kind would be a
       substitute that is about to go the same way. */
    /* And nothing standing the word in a sentence from another deck, in a
       session kept to the numbers. */
    const options = open.filter(
      (t) => !isListening(t) && !isGrid(t) && !(ex.within === "numbers" && borrowsPhrase(t))
    );
    if (!options.length) continue;
    const seen = used.get(keyOf(ex)) || new Set();
    const pick = options.find((t) => !seen.has(t)) || options[0];
    note(ex, pick);
    /* The phrase named on the old question is not necessarily right for the
       new one — a spoken context may have no written place to stand, and a
       question that needs no context must not carry one. Decided fresh. */
    const ctx = specOf(pick).needs.includes("contexts") ? pickContext(resolved.unit, pick) : null;
    const { ctx: _dropped, ...rest } = ex;
    tail.push({ ...rest, type: pick, ...(ctx ? { ctx: ctx.id } : null) });
    swapped = true;
  }
  /* A swap can stand a question beside one of its own exercise, or a card
     that went take away what stood between two about another — so what is
     left is put back in order against the last question asked. Only when
     something changed: the common case leaves the queue exactly as it was. */
  const changed = swapped || tail.length !== exercises.length - from;
  if (!changed) return exercises.slice(0, from).concat(tail);
  /* The question on screen stays where it is if it survived untouched. */
  const keep = tail[0] === exercises[from] ? 1 : 0;
  const settled = exercises.slice(0, from).concat(tail.slice(0, keep));
  return settled.concat(varyTypes(tail.slice(keep), settled[settled.length - 1] || null));
}

/* Which exercise types this card's data can support.

   Note this is not filtered by the quiet window: it answers what the card
   holds, and the preview rows, the weak-card count and unitFullyLearnt all
   ask it that. Silencing here would make a card look broken, or call it
   fully learnt while a third of its exercises were merely paused. */
function availableTypes(
  it: Form,
  lang: Lang = activeLang(),
  /*
   * Which scene this unit stands in. Left undefined by nearly every
   * caller, which means "the one it is actually in" — and is the case the
   * cache below answers. A caller that names a scene of its own is asking
   * a hypothetical and is worked out afresh.
   */
  scene: { card: Item, at: number } | null | undefined = undefined,
): string[] {
  const own = scene === undefined;
  const at = own ? sceneOf(it.id) : scene;
  /*
   * Asked over and over of the same form, so the answer is kept.
   *
   * Building a session asks this through six different doors for every
   * form of every card — what the card supports, what it has reached,
   * what may be dealt, whether it is urgent, how the hand counts — and
   * each of them walks fifteen exercise types asking whether this one can
   * be put to somebody. The answer was the same fifteen times.
   *
   * Held against the form itself, so a card edited or answered arrives as
   * a new object with nothing remembered about it, and thrown away whole
   * whenever anything it reads changes — see forgetTypes, which every one
   * of those setters calls.
   */
  const held = own ? TYPE_CACHE.get(it) : null;
  if (held && held.lang === lang.id) return held.types;
  /* What its variables can be filled with, if it has any: a hole with
     nothing to put in it is not a question, and a card whose words change
     cannot be the one on a recording. Both are answered inside canAsk. */
  /* One question, asked in one place: which exercises this unit can be
     asked. The teaching space asks the same one of the same cards — to
     say what a card could be drilled as before anybody presses anything —
     and two answers to it would be two apps disagreeing about what a card
     supports. */
  const values = fillsFor(it, lang.id);
  const types = TYPES.filter((t) =>
    canAsk(
      { unit: it, scene: at, contexts: contextsFor(it.id), values, mates: matesFor(it), pictured: picturedFor(it), heard: heardFor(it) },
      t,
      lang
    ) && (!EX[t].afterNumerals || numeralsKnownFor(it))
  );
  if (own) TYPE_CACHE.set(it, { lang: lang.id, types });
  return types;
}

/*
 * Which exercises a form supports, read in the language the form is
 * written in.
 *
 * The language comes from the settings in hand, not from the module-level
 * pointer — that is only set during render, and these run from anywhere.
 * `availableTypes` defaults to whatever the app happens to be set to,
 * which for somebody studying two languages is right about half the time:
 * a Vietnamese card was asked whether it supports the exercises Arabic
 * declares. Six callers read it that way; they read this instead, and the
 * default is left for the one caller that genuinely has no card in hand.
 */
const supportedTypes = (it: Form, settings: Settings): string[] =>
  availableTypes(it, langOf(settingsFor(settings, it)));

/* Exported for the tests, which ask it the question the offline gate
   above turns on: which exercises this form can actually be asked, here,
   now, with the recordings this device happens to hold. */
export function enabledTypes(it: Form, settings: Settings): string[] {
  /* The form goes through as well as the type: whether a listening
     exercise can be asked depends on whose recording it would play. */
  return supportedTypes(it, settings).filter((t) => typeAllowedNow(t, it));
}

/* The exercise a schedule key is about. Keys carry which accepted answer
   they belong to, and nothing that reads a spec cares which. */
const specOf = (key: string) => EX[typeOf(key)];

/* And of those, the ones on a level the form has reached — see the ladder
   in the scheduler. This is what a session asks from; enabledTypes is what
   a card supports, which is the question the card list and the counts of
   what is drillable ask. A level that has not opened is still the card's
   to reach, not a hole in it.

   Keys rather than types, so a card accepting two words is dealt both and
   counted as having both still to learn. The ladder itself is unchanged:
   it reads a level off a key the same way it read one off a type. */
/*
 * Every schedule key this form climbs the ladder with.
 *
 * What the card can be asked and the learner has switched on, before the
 * ladder decides which of it is open. Both openTypes below and the
 * standing a screen shows are read off this one list, so the levels a
 * learner is told about are the levels the session is dealt from.
 *
 * A cell of a verb's table whose row has not opened is asked nothing at
 * all. Said here rather than in the scheduler because it is the same kind
 * of answer the ladder gives, and because everything that matters reads it
 * through here: what a session may deal, what counts towards how mature a
 * card is, and therefore how much room there is for anything new. A row
 * still to come is the card's to reach, not a hole in it.
 */
/* Exported for the tests, which ask it the one thing a screenshot cannot
   show: which keys a form actually climbs with — and, in particular, that
   the answer is about the card as it is written rather than about the copy
   a question was filled in from. */
export function laddered(it: Form, settings: Settings): string[] {
  if (isQuiet(it)) return [];
  return ladderedOnceOpen(it, settings);
}

/*
 * The same, through the quiet gate: what a form will climb with once the
 * row or the stretch it waits on opens.
 *
 * For the percentages alone — see towardsLearnt — which count a number
 * waiting on its stretch as a card not yet learnt rather than as no card
 * at all. Everything that deals a question or says where a card stands
 * reads laddered, and a quiet form is still nothing to any of them.
 */
function ladderedOnceOpen(it: Form, settings: Settings): string[] {
  /* And nothing at all for a form the teacher keeps without asking about
     it. Said here, where the quiet ones are said, so that a form left on a
     card for a student to read is absent from every count the same way a
     row nobody has reached is: no question dealt, no level outstanding,
     and the schedule it already had still sitting there for the day it is
     switched back on. */
  if (!isAsked(it)) return [];
  /* And a rung's worth rather than all of it, for a pronoun on the end of a
     word the learner can already write — see easedUnits. Said here because
     this is the list everything downstream reads, so what is dealt, what
     the progress screen shows and when the cell is done all narrow
     together. */
  return easedTo(
    it,
    availableTypes(it, langOf(settingsFor(settings, it))).flatMap((t) => keysFor(it, t)),
  );
}

/*
 * And of those, the ones that can actually be put to somebody right now.
 *
 * The ladder says which levels a form has reached; this takes away the ones
 * whose holes there is nothing to fill with yet — see fillableAt. An
 * ordinary card leaves no hole and keeps all of them, which is nearly every
 * card.
 *
 * Kept apart from openTypes rather than folded into it, because the two
 * answer different questions and the difference matters to everything that
 * counts. A level withheld for want of a value is not a level the card has
 * failed to reach: it is the card's, and it is waiting on the learner's
 * vocabulary rather than on this card's own progress. So the ladder, the
 * standing a screen shows and how mature a card counts as all go on reading
 * openTypes, and only what a session may *deal* reads this.
 */
function askableTypes(unit: Form, settings: Settings): string[] {
  return openTypes(unit, settings).filter((t) => fillableAt(unit, t, settings));
}

/*
 * The levels a form has actually reached, before the quiet window.
 *
 * The levels are read over everything the card supports and the learner has
 * switched on, and only then is the quiet window applied: a listening
 * exercise silenced for a quarter of an hour is still a level to be
 * climbed, not a gap that lets the one above it open early.
 *
 * Which leaves two questions rather than one, and anything *counting* how
 * far along a card is wants this one. The room kept for new cards was
 * counted through the window, so a card being learnt on nothing but a
 * listening exercise read as further along for fifteen minutes and the
 * cap let a little more in — the comment beside it said it counted the way
 * the progress screen counts, and the screen reads the list before the
 * window.
 */
function reachedTypes(it: Form, settings: Settings): string[] {
  return openTypesOf(laddered(it, settings), (k) => statesOf(it)[k]);
}

/* And of those, the ones that may be put to somebody this minute.

   The form goes through with the key, not just the key: whether a
   listening exercise can be asked depends on whose recording it would
   play, and this is the door every dealt question passes through. Gating
   only `enabledTypes` — which decides whether a card counts as drillable
   at all — left the card in the session and the silent question in it. */
function openTypes(it: Form, settings: Settings): string[] {
  return reachedTypes(it, settings).filter((k) => typeAllowedNow(k, it));
}

/*
 * The two numbers that decide whether a new word may be met.
 *
 * Counted over everything the learner holds in this language rather than
 * the deck in front of them: the deck is what they chose to look at, the
 * load is what they carry.
 *
 * The front door is words met and not yet recognised or cleared. A word never
 * touched is *not* in it — it is waiting outside, which is the whole point
 * — so a course of three hundred strangers does not fill the pool and
 * block itself.
 *
 * Exported for the pace simulation, which reports what a course costs a
 * learner in days and is the only honest way to choose the two caps.
 */
export function handCounts(items: Item[], settings: Settings, numbers?: KnownNumbers) {
  let front = 0;
  let inHand = 0;
  for (const it of items) {
    if (!isDrillable(it, settings)) continue;
    const stage = familyMaturity(it, (u: Form) => reachedTypes(u, settings));
    /* Never met: outside both pools. */
    if (stage === "new") continue;
    /* Met, and waiting for its building blocks — a sentence whose words the
       learner has not cleared yet, which can be asked nothing until they
       are. It holds no place: the places are how those words come in. */
    if (waitsOnBlocks(it, settings)) continue;
    /* And a number part waiting on its words the same way — see
       knownNumbers — where the caller can say. */
    if (numbers && isRangeSkill(it) && !numbers.ready(it)) continue;
    if (stage !== "mature") inHand += 1;
    /* Over the whole ladder, not the levels reached: cleared is read up
       all of it, which is what the learner is shown. */
    const through = drillableUnits(it, settings).every(({ unit }) =>
      throughDoor(laddered(unit, settings), (t: string) => stateOf(unit, t))
    );
    if (!through) front += 1;
  }
  return { front, inHand };
}

/*
 * Whether a card is waiting on its building blocks and nothing else: it
 * leaves blanks, it has levels open, and not one of them can be filled
 * with words the learner has cleared. Only a card with blanks is asked,
 * since every other card has nothing it could be waiting on.
 */
function waitsOnBlocks(it: Item, settings: Settings): boolean {
  const units = drillableUnits(it, settings);
  if (!units.some(({ unit }) => slotsOf(unit).length > 0)) return false;
  return units.every(({ unit }) => {
    const open = openTypes(unit, settings);
    return open.length > 0 && !open.some((t) => fillableAt(unit, t, settings));
  });
}

/* Rule 2: a unit needs at least two exercise types to appear at all, and a
   family is drillable when its main form qualifies. */
/* A card that has never been answered carries no schedule at all, so every
   reader of one wants the empty record rather than a crash. Said once here
   because the alternative is the same guard at three dozen call sites, and
   the sites that forgot it were only ever found by someone hitting them. */
const statesOf = (unit: Form): Record<string, ExerciseState> => unit.s || {};

/*
 * One schedule off a form, by key, for the readers that walk keys.
 *
 * The record above guards the card that carries no schedule at all. This
 * guards the other hole in the same wall: a card whose schedule is there
 * but has nothing under this key. A key is per accepted answer — "ar2en"
 * for the first, "ar2en@1" for the second — and the second answer's key is
 * deliberately never written until it is answered, which is what let the
 * change that introduced it leave every existing document untouched. So a
 * card that accepts two words has keys with no state behind them from the
 * moment it arrives, and `statesOf(unit)[key]` is undefined for them.
 *
 * Everything that reads a key through the ladder already treats that as
 * "never asked" — openTypes hands the lookup in and takes undefined for an
 * answer, familyMaturity reads it as new, and marking an answer starts
 * from freshState(). The session builder read `.due` and `.phase` straight
 * off it instead, and threw on the first card with a second spelling: the
 * screen rendered, the count was right, and Start session did nothing at
 * all, because the throw was inside the click. Read every key through
 * here and there is one answer to what an unanswered key holds.
 */
const stateOf = (unit: Form, key: string): ExerciseState => statesOf(unit)[key] || freshState();

function isDrillable(it: Item, settings: Settings) {
  /* A card the teacher says is not practised on its own. A value — the
     "Raphael" that fills {{name}} in somebody else's sentence — is there to
     be borrowed, and "what does Raphael mean" is not a question. Absent
     means yes, which is what every card written before this meant. */
  if (it.drill === false) return false;
  /*
   * There used to be a second test here: whether words, phrases, sentences
   * and conversations were each switched on, read off `settings.kinds`.
   *
   * Nothing has set it for releases. No screen offers it, the clear-out
   * that retired the Advanced panel did not name it, and its default is
   * every kind — so it did nothing at all on almost every device, and on
   * one that had switched conversations off years ago it went on hiding
   * every scene in every session and every count, with nothing anywhere
   * to say so. That is the hidden setting 0.143 set out to make
   * impossible. It is retired with the rest of them, in
   * RETIRED_SETTINGS.
   *
   * It also read as *off* for a card whose kind is not one of the four —
   * `kinds[""]` is undefined — so a card that arrived without one could
   * never be practised.
   */
  /* A scene qualifies through its lines rather than through itself. The
     card carries the two whole-scene exercises and a short dialog carries
     only one of them, so asking the card alone would throw away a
     conversation whose every line is ready to be asked. */
  /* A card whose own word the teacher keeps without asking about it
     qualifies the same way a scene does — through what is left. A verb
     whose dictionary form is the question and whose table is there to be
     read is the ordinary case of this; so is the other way round. Asking
     the card alone would hide every one of them from the list of what can
     be practised while its forms were being practised.

     And a card whose own word has nothing to ask at all, which since
     0.200 is a verb on a language that cites a cell and whose teacher has
     not written that one: the card's word is read off that cell, so it is
     empty, and the verb is in its table. Nothing is loosened by this —
     a word supporting one exercise is still not a card, which is what the
     line below says — only a card supporting none through its own word is
     asked what its forms can do before it is turned away. */
  const lead = leadOf(it);
  if (isDialog(it) || !isAsked(lead) || !enabledTypes(lead, settings).length) {
    return drillableUnits(it, settings).length > 0;
  }
  return enabledTypes(lead, settings).length >= 2;
}

/*
 * A card the learner has asked for.
 *
 * Marking one high priority in the card list is the one way a learner
 * overrides the schedule, and this is the whole of what it means: the card
 * counts as waiting however far off its next review is, so it is in the
 * count on the home screen and in the session that follows. It comes first
 * there too, which is decided where the session is built.
 *
 * "Where there is a question to put" is the part that cannot be left out.
 * A card asks nothing until it has the material for two exercises, and a
 * frame with no word to fill its hole asks nothing today; a card admitted
 * without that would take a place in the session, deal nothing, and be
 * counted as ready on a screen that then offered a session without it.
 * Asked once, so the count and the builder cannot come to disagree.
 */
export function isUrgent(it: Item, settings: Settings): boolean {
  if (!it.priority) return false;
  return drillableUnits(it, settings).some(
    ({ unit }) => askableTypes(unit, settings).length > 0
  );
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
 * Read by the matching grid, which uses it to choose words worth confusing.
 * The session builder used to read it too, to gather related cards into one
 * sitting; it no longer does — see SESSION_SIZE below for why.
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

/* ------------------------------------------------------------------
   Session building

   The shape of a session is fixed, and this is where it is fixed.

   It used to be six sliders under an Advanced disclosure — how long a
   session runs, how many ways each form is drilled, how many new cards it
   may open, whether related cards are gathered together, which order they
   come in, which exercise types are in play at all. Every one of them was
   a question nobody learning a language should be asked, and the honest
   part of the label was the sentence under the disclosure: "the defaults
   are sensible." If they are, they are the app; if they are not, the fix
   belongs here rather than in a slider.

   The numbers are not the old defaults verbatim. Two of them were the
   reason the same words kept coming round: three exercises per form meant
   an eighteen-question session was six cards, and gathering similar cards
   meant those six were as alike as the list allowed. Two each and no
   gathering makes it nine cards, met once apiece in two ways.
   ------------------------------------------------------------------ */

/* How long a session runs. Long enough to be worth opening, short enough
   to finish on a bus. */
const SESSION_SIZE = 18;

/*
 * How many ways one form is drilled in a sitting.
 *
 * Two, not three. A form is asked in its own right on every one of these,
 * so the third asking cost a whole other card its place in the session —
 * and a third angle on a word you met ninety seconds ago teaches less than
 * a first angle on a word you have not seen today.
 */
const PER_UNIT = 2;

/*
 * How many words may be in hand for somebody whose typical day answers
 * `perDay` questions.
 *
 * A form is asked PER_UNIT ways a sitting, so a day of `perDay` questions
 * reaches about `perDay / PER_UNIT` words, and the pool is sized to that:
 * each word a day's practice holds is met about once, rather than the same
 * sixty two or three times over. Nobody is given less than the fixed
 * sixty — see `inHandCap`. Exported for the pace simulation.
 */
export function inHandFor(perDay?: number): number {
  return inHandCap(((perDay || 0) / PER_UNIT) * KEEN_POOL);
}

/*
 * Two words in hand for every word a day reaches, not one.
 *
 * One was the first answer, and it was enough while a new word took six
 * days to clear. Once the words still climbing come first for a keen
 * learner (see KEEN_DAY) they clear in about a day, and the pool, not the
 * front door, became what stopped new words: about 130 met in two months
 * at fifteen sittings a day. At two it is about 255, and nearly all of them
 * learnt. It changes nothing below sixty — which is where anybody doing
 * fewer than about three sittings a day already sits — so only the keen
 * are affected.
 */
const KEEN_POOL = 2;

/*
 * How many strangers this learner may hold at once — the front door, sized
 * to how much they practise.
 *
 * A typical day reaches `perDay / PER_UNIT` words, and the door holds one
 * for every DOOR_OUTINGS of them: ten for anybody doing up to about five
 * sittings a day, as it always was, rising to twenty at about ten. See
 * FRONT_DOOR_MAX. Exported for the pace simulation.
 */
export function frontDoorFor(perDay?: number): number {
  return frontDoorCap((perDay || 0) / PER_UNIT);
}

/*
 * What kind of card this is, for mixing the new cards a learner is given.
 *
 * Words by what the teacher says they are — a noun, a verb, a name — so a
 * door's worth of strangers is not all one part of speech; then phrases,
 * sentences, conversations and texts, each a kind of its own; and a number
 * skill, which is none of those. See byVariety.
 */
export function varietyOf(it: Item, settings: Settings): string {
  if (isRangeSkill(it)) return "skill";
  if (isDialog(it)) return isText(it) ? "text" : "conversation";
  const kind = kindOf(it, LANGUAGES[langIdOf(it, settings)] || langOf(settings));
  return kind === "word" && it.category ? `word:${it.category}` : kind;
}

/*
 * More than two full sittings' worth of questions on a typical day: the
 * learner who comes back later the same day, so a review passed over now
 * is still reached before it goes stale. It decides one thing — whether
 * the words still climbing jump the queue. See buildSession.
 */
const KEEN_DAY = 2 * SESSION_SIZE;

/*
 * How many forms of one card a session will take.
 *
 * Two, and it is the other half of the repetition fix. A verb lays out
 * twenty-odd cells and a word with pronouns on it a dozen, all of them
 * forms of one word; the budget is divided by how many forms a card brings,
 * so at four a session of verbs was two words and eighteen questions about
 * them. At two, the cells still each get their turn — they are scheduled in
 * their own right and come round on their own — but no single word can be
 * half an evening.
 */
const MAX_UNITS_PER_FAMILY = 2;

/*
 * The most times one form is asked in one session, when the session has
 * nothing else to ask — see buildSession. Two is the rule (PER_UNIT); four
 * is a beginner with only their ten new words to practise, asked each of
 * them a second round rather than handed a session half the length they
 * chose.
 */
const MAX_ASKS_PER_UNIT = 4;

/*
 * Where a queue reaches a session's length, which is counted in screens:
 * a grid is one screen however many words are in it, so a session of
 * twenty shows twenty on its counter. The owner's choice over counting the
 * words in a grid, which made a session of twenty read "1 / 16".
 */
function cutAtLength(queue: unknown[], length: number): number {
  return Math.min(queue.length, length);
}

/* And of a conversation, in one sitting. Deliberate rather than
   discovered: without it a six-line scene is the whole session, and the
   first thing anyone would have written is a scene with six lines. */
const MAX_DIALOG_LINES = 2;

/*
 * A question answered wrong, put back into what is left of the session.
 *
 * It is the same question deliberately — the point of asking again is to
 * test the thing that failed, not to change the subject. And it goes to the
 * back of the queue, which gives it a gap the size of whatever is left: a
 * long session re-asks it in fifteen questions' time, a short one in three,
 * and both are a retest rather than a copy of an answer still on the
 * screen.
 *
 * What was wrong was that it went there *blind*. The queue is spaced out
 * when it is built — no two questions running about the same card, see
 * varyTypes — and everything added afterwards skipped that pass, so missing
 * a card's two questions put its two retries back to back at the end. So
 * the same rule is applied here: back up over any neighbour about the same
 * card, and stop short of it.
 *
 * `from` is the first question not yet answered; everything before it is
 * done and is never moved. With nothing left after it the retry is the very
 * next question, which is the one case this cannot improve on — dropping it
 * instead would end a session of one question the moment it was got wrong,
 * having taught nothing, and would break the promise Ultimate makes in as
 * many words. Standing next to itself is only a fault while there is
 * something to stand between.
 */
export function requeueMissed(list: Question[], from: number, ex: Question): Question[] {
  const put = (at: number) => list.slice(0, at).concat([{ ...ex }], list.slice(at));
  /* The back of the queue, then forward off any neighbour it may not stand
     beside — about the same card, or the same exercise — on both sides,
     because stopping in front of one is as bad as stopping behind it. Never
     as far as `from`: the question there is the miss itself, still on the
     screen. The exercise is the rule that gives way first, as it does when
     the queue is built. */
  const clean = (at: number) => mayFollow(list[at - 1], ex) && mayFollow(ex, list[at]);
  const apart = (at: number) =>
    [list[at - 1], list[at]].every((q) => !q || !cardsIn(q).some((id) => cardsIn(ex).includes(id)));
  for (const ok of [clean, apart]) {
    for (let at = list.length; at > from; at -= 1) if (ok(at)) return put(at);
  }
  /* Nowhere clean — what is left is the card's own questions, or there is
     nothing left at all. The end, which is where it used to go. */
  return put(list.length);
}

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
  unseen: {
    label: "Not seen lately",
    blurb: "Cards you haven't practised in the last few days, new ones included — anything still climbing the levels.",
  },
};

/*
 * How long since a form was last answered before Not seen lately offers
 * it: three days. Long enough that yesterday's words are not in it, short
 * enough that a word from last week is.
 */
const UNSEEN_DAYS = 3;

/*
 * Is this form one Not seen lately should ask about? Not answered on any
 * of its exercises in the last UNSEEN_DAYS — a form never answered at all
 * is the plainest case — and not yet cleared, which takes learnt with it:
 * the mode is for moving words up the levels, and a cleared word has no
 * level left to climb, only reviews that have to come round on their own.
 */
function notSeenLately(unit: Form, settings: Settings) {
  const st = (t: string) => stateOf(unit, t);
  if (cleared(laddered(unit, settings), st)) return false;
  const last = Math.max(0, ...Object.values(statesOf(unit)).map((x) => (x && x.updated) || 0));
  return now() - last >= UNSEEN_DAYS * 86400000;
}

/*
 * How many questions a timed session is given to work through: about one
 * every ten seconds. Only Regular reads it, because it is the one mode
 * whose cards are chosen to fit a length — the rest take everything picked
 * and let the clock end it.
 */
const TIMED_PER_MINUTE = 6;

/* Did this form go wrong in either of its last two outings? Read in the
   card's own language, and through stateOf, which answers for a key that
   has never been written. */
function hasRecentMistake(unit: Form, settings: Settings) {
  const types = supportedTypes(unit, settings);
  let sawHistory = false;
  for (const t of types) {
    const h = stateOf(unit, t).hist || [];
    if (h.length) {
      sawHistory = true;
      if (h.slice(-2).some((x) => !x)) return true;
    }
  }
  // Nothing recorded yet — fall back to whether it has ever gone wrong.
  if (!sawHistory) {
    return types.some((t) => (stateOf(unit, t).wrong || 0) > 0 || (stateOf(unit, t).lapses || 0) > 0);
  }
  return false;
}

/* Every card a question is about: its own, and in a grid every word
   standing in it too, since each of those is asked there as well. */
function cardsIn(q: Question): string[] {
  return q.mates ? [q.id, ...q.mates.map((m) => m.id)] : [q.id];
}

/* May `b` be asked straight after `a`? Not about any card `a` was about,
   and not the same exercise. */
export function mayFollow(a: Question | null | undefined, b: Question | null | undefined): boolean {
  if (!a || !b) return true;
  if (a.type === b.type) return false;
  const was = cardsIn(a);
  return !cardsIn(b).some((id) => was.includes(id));
}

/*
 * Two rules for the order of a session: no two questions running about the
 * same card, and no two running of the same exercise.
 *
 * It used to be a greedy pass — take the first question that differs from
 * the one before — and that is exactly what broke the first rule. A greedy
 * pass spends the other cards early and leaves whatever card has the most
 * questions (a verb bringing two of its forms, say) piled at the end, where
 * they can only stand next to each other: in a simulation of ordinary
 * sessions about four in ten ended with one card twice running when an
 * order without it existed. So the whole order is planned instead: a search
 * that tries the queue's own order first (easiest first, a card the learner
 * asked for ahead of all of it) and turns aside only where following it
 * would leave the rest with no way to be kept apart. `prev` is a question
 * already asked, for when only the tail of a session is being put in order.
 *
 * Where the material cannot keep both rules — one card and nothing else, a
 * weak-skills session all of one exercise — the search gives up on a
 * budget and the old greedy pass deals it, bending as little as it can,
 * the card first: a question is never dropped to keep a rule.
 */
export function varyTypes(list: Question[], prev: Question | null = null): Question[] {
  const n = list.length;
  if (n < 2 && !prev) return list.slice();

  /* How many of each card and each exercise are left, for the pruning: a
     kind that holds more than half of what is left, rounded up, cannot be
     kept apart — and none of it may come first after one of its own. */
  const cardLeft: Map<string, number> = new Map();
  const typeLeft: Map<string, number> = new Map();
  const bump = (m: Map<string, number>, k: string, by: number) => m.set(k, (m.get(k) || 0) + by);
  for (const q of list) {
    bump(cardLeft, q.id, 1);
    bump(typeLeft, q.type, 1);
  }
  const fits = (left: number, last: Question | null) => {
    for (const [k, c] of cardLeft) {
      if (c > Math.ceil(left / 2)) return false;
      if (last && c > Math.floor(left / 2) && cardsIn(last).includes(k)) return false;
    }
    for (const [k, c] of typeLeft) {
      if (c > Math.ceil(left / 2)) return false;
      if (last && c > Math.floor(left / 2) && last.type === k) return false;
    }
    return true;
  };

  const used = new Array(n).fill(false);
  const out: Question[] = [];
  let budget = 200 * n + 1000;
  const search = (last: Question | null): boolean => {
    if (out.length === n) return true;
    if (budget-- <= 0) return false;
    for (let i = 0; i < n; i++) {
      if (used[i] || !mayFollow(last, list[i])) continue;
      const q = list[i];
      used[i] = true;
      out.push(q);
      bump(cardLeft, q.id, -1);
      bump(typeLeft, q.type, -1);
      if (fits(n - out.length, q) && search(q)) return true;
      bump(cardLeft, q.id, 1);
      bump(typeLeft, q.type, 1);
      out.pop();
      used[i] = false;
      if (budget <= 0) return false;
    }
    return false;
  };
  if (fits(n, prev) && search(prev)) return out;

  /* No clean order, or none found in time. */
  const dealt: Question[] = [];
  const rest = list.slice();
  let last = prev;
  const sameCard = (a: Question | null, b: Question) => !!a && cardsIn(b).some((id) => cardsIn(a).includes(id));
  while (rest.length) {
    let pick = rest.findIndex((e) => mayFollow(last, e));
    if (pick === -1) pick = rest.findIndex((e) => !sameCard(last, e));
    if (pick === -1) pick = rest.findIndex((e) => !last || e.type !== last.type);
    if (pick === -1) pick = 0;
    const [e] = rest.splice(pick, 1);
    dealt.push(e);
    last = e;
  }
  return dealt;
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
  /* How many of the cards in it were actually waiting. The rest are ahead
     of themselves, which is welcome and worth saying out loud: the screen
     at the end reports which kind of session this was, so a learner
     practising for the sake of it is never left thinking they have made
     more headway through their schedule than they have. */
  due?: number;
}

/*
 * Which numbers a learner can be asked: the ones whose words they have.
 *
 * Each word of a number is a building block — a card used inside another
 * card — and a building block stands in a number only once the learner has
 * cleared it: been up every level of it, the writing included. In the form
 * it is said in, since that is what the learner reads: the face *seven*
 * wears inside a bigger number, the plural *books* takes after three. It
 * used to be enough to recognise the word — its meaning right twice
 * running — which put 47 to somebody who could not yet write *forty*, and
 * made the number the place *forty* was learnt rather than a use of it.
 *
 * A word that cannot be climbed does not hold anything back: one the
 * teacher marked as not practised on its own, one with nothing to ask, or
 * one this learner does not hold at all. Waiting on a card that can never
 * be cleared would shut the range for good. A face still behind its
 * table's gate is not one of those: it opens once the word itself is under
 * way, and is waited for.
 */
interface KnownNumbers {
  /** Whether anything of this range can be asked yet. */
  ready: (item: Item) => boolean;
  /** One asking of it on this seed, steered towards `waiting`, or null —
      counting a noun where `counting`, see countingOf. */
  draw: (item: Item, seed: string, waiting: Set<string>, counting?: boolean, heard?: boolean) => Ask | null;
}

/* The askings each range can put, kept against the system they were read
   from — a teacher's edit arrives as a new system and starts afresh — and
   against the clock and which forms the learner held and had cleared when
   they were read. Reading them walks every asking of every range, which is
   tens of milliseconds; what is cleared changes a few times a day. */
const KNOWN_ASKINGS: WeakMap<object, Map<string, Asking[]>> = new WeakMap();

/* The form of a card a word of a number was said in — the face it wore,
   or for a counted noun the form whose words it was — falling back to the
   card's own word. The same reading tokenCards makes for the credit. */
function formOfToken(card: Item, t: Token): Form {
  if (t.noun) return formsOf(card).find((f) => String(f.ar || "").trim() === t.text.trim()) || leadOf(card);
  const face = t.formKey ? formsOf(card).find((f) => f.id === `${card.id}-f~${t.formKey}`) : null;
  return face || leadOf(card);
}

function knownNumbers(items: Item[], settings: Settings, sets: SystemSet[]): KnownNumbers {
  const byId = byIdOf(items);
  const ids = new Set(items.filter((it) => isFromSystem(it) && !isRangeSkill(it)).map((it) => it.id));
  const done = new Map<string, boolean>();
  const formDone = (card: Item, form: Form): boolean => {
    const at = `${card.id}\u0000${form.id}`;
    const held = done.get(at);
    if (held !== undefined) return held;
    let ok: boolean;
    if (!isAsked(form)) ok = true;
    else {
      const keys = laddered(form, settings);
      ok = keys.length ? cleared(keys, (t) => statesOf(form)[t]) : !isQuiet(form);
    }
    done.set(at, ok);
    return ok;
  };
  const knows = (id: string, token?: Token): boolean => {
    const card = byId.get(id);
    if (!card || !isDrillable(card, settings)) return true;
    return formDone(card, token ? formOfToken(card, token) : leadOf(card));
  };
  /* What the learner holds and which of it they know, as one string. Both
     halves, since a word not held counts as known and one held does not
     until it is. */
  let knowing: string | null = null;
  const knowingNow = () =>
    (knowing ??= [...ids]
      .sort()
      .map((id) => {
        const card = byId.get(id) as Item;
        if (!isDrillable(card, settings)) return id;
        return formsOf(card).map((f) => (formDone(card, f) ? `${f.id}+` : f.id)).join(",");
      })
      .join(" "));
  const setOf = (item: Item) => {
    const set = systemFor(item, sets);
    if (!set) return null;
    return {
      composer: composerFor(set.numbers.languageId),
      sys: set.numbers,
      timeComposer: timeComposerFor(set.numbers.languageId),
      timeSys: set.times,
    };
  };
  /* A stretch's counting question asks from the same stretch with a noun
     beside each number — its own askings, kept under a key of their own. */
  const rangeOf = (item: Item, counting: boolean) =>
    item.range && counting ? countingOf(item.range) : item.range;
  const knownOf = (item: Item, counting = false) => {
    const set = setOf(item);
    const range = rangeOf(item, counting);
    if (!set || !range) return [];
    let bySystem = KNOWN_ASKINGS.get(set.sys);
    if (!bySystem) KNOWN_ASKINGS.set(set.sys, (bySystem = new Map()));
    const clock = set.timeSys ? `${set.timeSys.id}@${set.timeSys.rev}` : "";
    const id = `${item.id}${counting ? "#count" : ""}`;
    const key = `${id}\u0000${clock}\u0000${knowingNow()}`;
    const held = bySystem.get(key);
    if (held) return held;
    const list = askingsKnown(range, set, ids, knows);
    /* Only the latest per range is worth keeping. */
    for (const k of bySystem.keys()) if (k.startsWith(`${id}\u0000`)) bySystem.delete(k);
    bySystem.set(key, list);
    return list;
  };
  return {
    ready: (item) => knownOf(item).length > 0,
    draw: (item, seed, waiting, counting = false, heard = false) => {
      const set = setOf(item);
      const range = rangeOf(item, counting);
      if (!set || !range) return null;
      const known = knownOf(item, counting);
      /* For a question that is listened to, the numbers recorded whole
         among those the learner can be asked, where there are any. */
      const recorded = heard ? known.filter((a) => recordedWhole(a.ask, set.composer, set.sys)) : [];
      if (recorded.length) return recorded[Math.floor(seeded(`${range.id} ${seed} heard`)() * recorded.length)].ask;
      return askKnown(range, seed, set, ids, knows, known, waiting);
    },
  };
}

/* An exercise that stands the word in a phrase from somewhere else — fill
   the gap, choose the missing word, the phrase heard. A session of numbers
   alone leaves these out: the phrase is a sentence from another deck. */
const borrowsPhrase = (t: string) => {
  const needs = (specOf(t) && specOf(t).needs) || [];
  return needs.includes("contexts") || needs.includes("contextAudio");
};

/*
 * A session of numbers and nothing else keeps to them: a deck of number
 * parts, or one put together from number words. Every card in it from a
 * number system, and then no question stands a word in a phrase — neither
 * an exercise that needs one nor the phrase any other is shown in, which
 * would be a sentence from another deck — and each carries `within`, so
 * its wrong answers and the company in its grid are other number words.
 * buildSession makes the same moves in line as it deals.
 */
function keptToNumbers(plans: Question[]): Question[] {
  if (!plans.length || !plans.every((q) => isFromSystem(q))) return plans;
  return plans
    .filter((q) => !borrowsPhrase(q.type))
    .map(({ ctx: _phrase, ...q }) => ({ ...q, within: "numbers" as const }));
}

/* The cards a session's grids may be filled from: number words alone in a
   session kept to the numbers. */
const gridCompany = (plans: Question[], items: Item[]): Item[] =>
  plans.some((q) => q.within === "numbers") ? items.filter((it) => isFromSystem(it)) : items;

/**
 * The number or the time one asking of a range is about, drawn.
 *
 * Empty for everything that is not a range, which is nearly every
 * question — so the caller spreads the answer and says nothing about
 * skills at all.
 *
 * The seed is the skill, the exercise and the count of right answers so
 * far, which is the same odometer a sentence's fillers turn on: a missed
 * question comes back as *the same* number, a right one moves on, and a
 * re-render cannot swap the question under somebody halfway through
 * answering it.
 */
function drawRange(
  item: Item | undefined,
  unit: Form,
  type: string,
  sets: SystemSet[],
  items: Item[],
  settings: Settings,
  /* What the learner can be asked — see knownNumbers. Made once by a
     caller drawing many, since it reads every word they hold. */
  numbers: KnownNumbers = knownNumbers(items, settings, sets),
): { ask?: Ask; options?: string[] } {
  const range = item && item.range;
  if (!range) return {};
  const set = systemFor(item, sets);
  if (!set) return {};
  const composer = composerFor(set.numbers.languageId);
  const times = timeComposerFor(set.numbers.languageId);
  if (!composer) return {};

  const turn = turnOf(statesOf(unit)[type]);
  /* Only a number whose words are recognised — see knownNumbers — and
     among those, towards a word of the part the learner has not kept yet,
     while there is one (see steeredAsk), and anywhere once every word is
     learnt. Nothing, for a range none of whose numbers can be said in
     words the learner knows: the caller leaves the question out. */
  const waiting = new Set(
    partsOf(item, items, settings)
      .filter((p) => p.validated === false)
      .map((p) => p.card.id),
  );
  /* The counting question counts a noun, from the same stretch — see
     countingOf; every other question on it asks the bare number. */
  const counting = ((specOf(type) && specOf(type).needs) || []).includes("rangeCounted");
  /* A listening question asks a number somebody recorded, where the
     learner can be asked one: a number nobody recorded is nothing to
     listen to. */
  const ask = numbers.draw(item, `${item.id} ${type} ${turn}`, waiting, counting, isListening(type));
  if (!ask) return {};

  if (EX[type] && EX[type].picks !== "word") return { ask };
  /*
   * The wrong answers, said. Numbers worth confusing with the right one —
   * seventy-four beside forty-seven, four hundred and seventy beside it
   * too — and only the ones the composer can actually say. Drawing from
   * the learner's vocabulary instead would put a book and a house beside
   * a number and make the question a reading test.
   */
  const right = renderAsk(ask, composer, set.numbers, times, set.times);
  const options: string[] = [];
  const near =
    ask.kind === "time"
      ? confusableTimes(ask.value, ask.minute || 0, range.marks || []).map(
          (t): Ask => ({ ...ask, value: t.h, minute: t.m }),
        )
      : confusablesOf(ask.value).map((v): Ask => ({ ...ask, value: v }));
  for (const other of near) {
    if (options.length >= PICK_OPTIONS - 1) break;
    const said = renderAsk(other, composer, set.numbers, times, set.times);
    if (!said.text || said.text === right.text || options.includes(said.text)) continue;
    options.push(said.text);
  }
  /* A question that could not find three is asked another way rather than
     with two options — the same fallback the grid makes. */
  return options.length >= PICK_OPTIONS - 1 ? { ask, options } : { ask };
}

/**
 * The same drawing, over a queue somebody else built.
 *
 * buildSession draws as it deals; the session built by hand and the
 * weak-skills sitting plan their questions their own way and come through
 * here afterwards, so a range they ask is never put on screen with nothing
 * to read. One that cannot be drawn — no composer for its language — is
 * left out rather than asked bare.
 */
function drawRanges(exercises: Question[], items: Item[], sets: SystemSet[], settings: Settings): Question[] {
  const numbers = knownNumbers(items, settings, sets);
  const out: Question[] = [];
  for (const ex of exercises) {
    const item = byIdOf(items).get(ex.id);
    if (!item || !item.range || ex.ask) {
      out.push(ex);
      continue;
    }
    const drawn = drawRange(item, item.forms[0], ex.type, sets, items, settings, numbers);
    if (drawn.ask) out.push({ ...ex, ...drawn });
  }
  return out;
}

export function buildSession({
  items,
  settings,
  inDeck,
  practice,
  includeAll,
  budget: budgetIn,
  perDay,
  systems,
  newWithin,
}: {
  items: Item[];
  settings: Settings;
  inDeck: (it: Item) => boolean;
  practice?: boolean;
  includeAll?: boolean;
  budget?: number;
  /**
   * Count the new words already in hand among the chosen cards only.
   *
   * The limit on new words is the learner's, across everything they hold,
   * and on the home screen it should be: it is what keeps new words from
   * piling up. A practice somebody builds on particular decks is them
   * asking for those decks, and a deck nobody has started then came up
   * empty because of words in some other deck — "nothing new to bring in"
   * over a deck that is all new. So there the limit is read over the
   * chosen cards: the deck's own new words still come in a few at a time.
   */
  newWithin?: boolean;
  /**
   * Questions this learner answers on a typical day — `typicalDay` over
   * the activity log. It sizes how many words may be in hand at once (see
   * `inHandFor`); left out, it is the fixed sixty that suits somebody who
   * sits down once a day.
   */
  perDay?: number;
  /**
   * The teachers' number systems, for the skills among the cards.
   *
   * A range holds a schedule and no words, so the number it is asked
   * about has to be drawn and said here — and a caller with no systems
   * to draw from simply deals no ranges rather than dealing a question
   * with nothing in it.
   */
  systems?: SystemSet[];
}): Session {
  const sets = systems || [];
  const numbers = knownNumbers(items, settings, sets);
  const pool = items
    .filter((it) => inDeck(it) && isDrillable(it, settings))
    /* A skill whose system this device no longer holds — a course left,
       a teacher's language dropped — is a schedule with nothing behind
       it. Left in the collection, so the work comes back if the material
       does, and simply not dealt. And one none of whose numbers can be
       asked yet, because the words they are built of are not recognised:
       the words are in the deck beside it and come first. */
    .filter((it) => !isRangeSkill(it) || (systemFor(it, sets) && numbers.ready(it)));
  if (!pool.length) return { exercises: [], reason: "none-drillable" };

  /* Numbers and nothing else — see keptToNumbers. */
  const onlyNumbers = pool.every((it) => isFromSystem(it));

  const budget = Math.max(4, budgetIn || SESSION_SIZE);

  /* --- candidate families --- */
  let candidates = pool.map((it) => {
    const units = drillableUnits(it, settings);
    /* Over the open levels only. A level not yet reached is all fresh
       states, and a fresh state is ready by definition — counted, it would
       have every card in the deck due at once. */
    const dues: number[] = [];
    /* And when any of it was last answered, which decides nothing until
       the learner has run out of cards that are actually due — see
       justPractised. */
    let lastSeen = 0;
    for (const { unit } of units) {
      for (const t of askableTypes(unit, settings)) {
        const st = stateOf(unit, t);
        dues.push(st.due || 0);
        lastSeen = Math.max(lastSeen, st.updated || 0);
      }
    }
    /* Askable rather than merely open, so a frame with nothing to fill it
       yet is not counted as waiting: it would be picked, admitted against
       the room for new cards, and then deal no question at all — a new
       card's place spent on a card that cannot be asked. */
    /* The learner asked for this one, so it goes to the front whatever its
       schedule says — see isUrgent. */
    const urgent = isUrgent(it, settings);
    /* Whether the card was *due* used to be worked out here and used to
       cut the list. Nothing asks it any more: being due decides where a
       card sits in the order, which `soonest` above already carries, and
       no longer decides whether it may be practised at all. What is
       genuinely waiting is still counted, for the number on the home
       screen — see countReady, which is a question about the learner's
       day rather than about this session. */
    const isNew = units.every(({ unit }) =>
      askableTypes(unit, settings).every((t) => stateOf(unit, t).phase === "new")
    );
    const soonest = dues.length ? Math.min(...dues) : 0;
    /* Waiting only because it was asked a moment ago — see restingNow. A
       card the learner asked for never rests. */
    const resting = !urgent && restingNow(lastSeen, dues);
    /* Met and still climbing: one of the words in the front door, which
       holds its place there until it is cleared — see KEEN_DAY. */
    const climbing =
      !isNew &&
      units.some(({ unit }) => !throughDoor(laddered(unit, settings), (t: string) => stateOf(unit, t)));
    return { it, units, soonest, isNew, urgent, lastSeen, resting, climbing };
  })
    /* And a card with nothing it can be asked yet is not a candidate at
       all: a word waiting with a stretch that has not opened (see
       homeStretch), or one whose every form is resting. It has no units,
       so it read as new — every() over nothing — and took a place in the
       room for new cards that it could never use. A beginner's numbers
       session was two or four questions, the rest of its places spent on
       the words for ninety and a million. */
    .filter((c) => c.units.length > 0);

  /* Ordered before anything is filtered, because the filter below keeps
     the first few new cards and "the first few" is decided here. Anything
     already due ranks together and is shuffled, so which new cards a
     session opens with, and which of the overdue ones it reaches, differ
     from one sitting to the next — and a card the learner asked for ranks
     above all of it. */
  candidates = inOrder(candidates, (c) => (c.urgent ? -1 : dueRank(c.soonest)));

  /*
   * And among what is *not* due, a card just practised gives way to one
   * that was not.
   *
   * Only among what is not due, which is the whole of the care needed
   * here: everything genuinely waiting still comes first, in the order
   * above, and a card the learner asked for still outranks all of it. What
   * this decides is the order a session reaches past the due line in, and
   * that order used to be "nearest to due" and nothing else — so the
   * second sitting of an afternoon reached for the same cards as the
   * first, and the thirtieth for the same cards as the twenty-ninth. A
   * learner practising all day was handed nine words and never the rest of
   * what they were learning.
   *
   * Written as a partition rather than another rank because the order
   * inside each half is one already settled above, and shuffling it again
   * would throw away the nearest-first reach that a practice session is
   * for.
   */
  /*
   * And a card asked in the last half hour rests, behind all of it.
   *
   * The rule above never reached the cards being learnt, because they are
   * nearly always waiting: a retest a minute or ten after the last answer,
   * or a level that opened with every question on it due at once. So
   * those went first in every sitting, and a learner who came back three
   * times in an hour was dealt the same words three times. A resting card
   * is still dealt — last, and in the order it had — and backlog never
   * rests: a question that was due before the card was last touched keeps
   * the card in the first group. See restingNow.
   */
  const unrested = candidates.filter((c) => !c.resting);
  const waitingNow = (c: { urgent: boolean; soonest: number }) =>
    c.urgent || dueRank(c.soonest) === 0;
  const ahead = unrested.filter((c) => !waitingNow(c));
  /*
   * And for somebody who practises a lot, the words still climbing come
   * first among what is waiting.
   *
   * Everything waiting ranks together and is shuffled, which for a keen
   * learner meant the ten words in the front door drew lots for a session's
   * nine places with twenty-odd reviews. A new word was dealt in about a
   * third of their sittings, took about six days to clear, and held its
   * place in the front door all that time, so nothing new came in behind
   * it. First in line, it is asked in nearly every sitting and clears in
   * about a day.
   *
   * Only past `KEEN_DAY`, because for somebody who sits down once a day the
   * reviews passed over are not reached later that day: in the pace
   * simulation their words learnt in two months fell from about a dozen to
   * none. Below the line the order is exactly what it was. A card the
   * learner asked for still comes ahead of all of it.
   */
  const keen = (perDay || 0) > KEEN_DAY;
  const first = (c: { urgent: boolean; climbing: boolean }) => c.urgent || (keen && c.climbing);
  candidates = unrested
    .filter((c) => waitingNow(c) && first(c))
    .concat(
      unrested.filter((c) => waitingNow(c) && !first(c)),
      ahead.filter((c) => !justPractised(c.lastSeen)),
      ahead.filter((c) => justPractised(c.lastSeen)),
      candidates.filter((c) => c.resting)
    );

  /*
   * Being due decides the order, not whether you may practise at all.
   *
   * It used to be both, and the second job was the one that hurt. A
   * learner partway through a course met the app's own pacing as silence:
   * ten cards learnt in four minutes, then seven minutes with nothing on
   * offer while they came back round, four times over, and then a wall
   * for the rest of the day. Somebody up to date got the same silence for
   * a different reason. And nothing on the screen could explain either,
   * because "nothing is due" is not a sentence a person accepts from an
   * app they opened on purpose.
   *
   * Practising early is cheap. An empty screen is not: it costs the
   * learner who was willing, which is the only kind there is. So the list
   * is no longer cut at the due line — it is simply *sorted* by it, which
   * it already was a few lines above, and a session takes the front of it
   * whether that is forty overdue cards or the nearest thing to due.
   *
   * What makes this safe rather than merely generous is in the scheduler:
   * a gap grows from the time actually waited, so a card answered minutes
   * after its last review is counted, welcomed and left exactly where it
   * was. Twenty answers in an evening cannot push anything out of reach.
   *
   * The limits on *new* cards are a different rule with a different
   * reason, and they still apply on every path below. More practice means
   * more of what the learner already holds, never more than they can take
   * on at once.
   */
  // A hand-picked session takes everything chosen, and sets its own limits.
  if (!practice && !includeAll) {
    /*
     * Room for what is new — the only thing that rations it.
     *
     * Three rules used to sit here and none of them knew about the others:
     * three a session, nothing while ten cards were mid-learning, nothing
     * at all while forty were still settling, and a scan of every exercise
     * on every card to stop new ones arriving while a pile was going
     * badly. Between them they made the real rate about one new word every
     * four days, measured — and the first of them meant ten short sittings
     * in an evening were thirty new words where one long sitting was
     * three, for the same work.
     *
     * One rule now: a word is earned by learning one. The struggling case
     * the backlog scan existed for falls out of it, because a learner who
     * keeps forgetting has words that never reach a four-day gap — those
     * words hold their place and nothing new arrives, which is the same
     * protection without a rule of its own to keep in step.
     */
    const room = roomForNew(
      handCounts(newWithin ? items.filter(inDeck) : items, settings, numbers),
      inHandFor(perDay),
      frontDoorFor(perDay),
    );
    /* Which ones, mixed by kind against what is already in the front door
       — see byVariety. Picked in the order they will be reached, so a
       session with room for only some of them still takes a mix. */
    const admitted = byVariety(
      candidates.filter((c) => c.isNew && !c.urgent),
      room,
      candidates.filter((c) => c.climbing),
      (c) => varietyOf(c.it, settings)
    );
    candidates = candidates.filter(
      /* Except one the learner asked for by name. Both rules above are the
         app protecting somebody from more new words than they can hold,
         and neither is worth telling a learner who has just pointed at a
         card that they cannot have it. It is one card, chosen on purpose,
         and the way to stop it is the way it started. */
      (c) => !c.isNew || c.urgent
    );
    /*
     * And a place admitted is a place kept.
     *
     * Everything already due ranks together, so the new cards the rule
     * above just let in were left to take their chance in the shuffle
     * with every card waiting for review — and the shortlist below is
     * only as long as the session has room for, so on any day with a
     * queue behind it they fell off the end. Three new cards a session
     * then meant three on the days nothing else was waiting, which is not
     * what it says.
     *
     * They go to the front instead, behind the cards the learner asked
     * for, which are the only thing that outranks them. The order they are
     * asked in is still the warm-up's: this decides only that they are in
     * the session at all.
     */
    candidates = candidates
      .filter((c) => c.urgent)
      .concat(
        admitted,
        candidates.filter((c) => !c.urgent && !c.isNew)
      );
  }

  if (!candidates.length) return { exercises: [], reason: "nothing-due" };

  /*
   * Which cards, and how many: as many as it takes to fill the session.
   *
   * Taken straight off the front of the due list — the most overdue first,
   * and chance between everything the due list calls equal — one card at a
   * time until the questions they bring reach the budget. A card brings as
   * many forms as it lays out, capped, and each form is asked PER_UNIT ways
   * where it has that many open.
   *
   * This used to work out a number of cards up front, from the budget and
   * the average card, and take that many. A card with fewer questions open
   * than the average — a word on its first level, a skill with one
   * exercise climbed — left the session short, two or three questions in
   * every twenty, and nothing went back for more. Counting what each card
   * actually brings is the same order and the same cards, until the
   * session is full.
   *
   * It used to reach three to six times further down that list and then
   * pick, out of the reach, whatever was most like the cards already
   * chosen. A session of near-identical words is a session that feels like
   * one word, and the card the reach passed over was one actually due.
   */
  const askedFor = candidates.filter((c) => c.urgent).length;

  /* --- rules 2 and 6: every unit gets several exercise types, and a
         family's sub-items come along in the same session --- */
  type Plan = { id: string; subId: string | null; unit: Form; types: string[]; more: string[]; range: boolean };
  const planOf = (c: (typeof candidates)[number]): Plan[] => {
    // Parent first, then whichever sub-items are most overdue.
    const parent = c.units.filter((u) => !u.isSub);
    const subs = inOrder(
      c.units.filter((u) => u.isSub),
      (u) =>
        dueRank(Math.min(...openTypes(u.unit, settings).map((t) => stateOf(u.unit, t).due || 0)))
    );
    /* A scene offers a line or two and not all of itself. Six lines would
       otherwise take a session over between them, and a conversation met
       two lines at a time across three evenings is learnt better than one
       swallowed whole in one. The whole-scene exercises come along beside
       them, which is what the card's own unit is. */
    const take = isDialog(c.it)
      ? parent.concat(subs.slice(0, MAX_DIALOG_LINES))
      : parent.concat(subs).slice(0, MAX_UNITS_PER_FAMILY);
    return take.map(({ unit, isSub }) => {
      const ordered = pickableTypes(unit, settings).filter((t) => !onlyNumbers || !borrowsPhrase(t));
      const picked = ordered.slice(0, Math.min(PER_UNIT, ordered.length));
      /* Asked in the table's own order, which runs from recognition to
         production: which exercises a unit gets is a matter of chance,
         the order they come in is not. */
      picked.sort((x, y) => TYPES.indexOf(typeOf(x)) - TYPES.indexOf(typeOf(y)));
      return {
        id: c.it.id, subId: isSub ? unit.id : null, unit, types: picked,
        /* What else is open, for a session the cards in it cannot fill —
           see the filling below. */
        more: ordered.filter((t) => !picked.includes(t)),
        range: !!c.it.range,
      };
    });
  };
  const planned = new Map<string, Plan[]>();
  const plansOfCard = (c: (typeof candidates)[number]) => {
    if (!planned.has(c.it.id)) planned.set(c.it.id, planOf(c));
    return planned.get(c.it.id) as Plan[];
  };
  const asks = (list: Plan[]) => list.reduce((n, p) => n + p.types.length, 0);

  /* --- interleave, so a unit recurs with a gap rather than back to back --- */
  const deal = (plans: Plan[]) => {
    const out = [];
    const depth = Math.max(0, ...plans.map((p) => p.types.length));
    for (let round = 0; round < depth; round++) {
      for (const p of plans) {
        if (p.types[round]) {
          const type = p.types[round];
          /* Which phrase, decided when the queue is built rather than at the
             moment of asking, so the question does not change under the
             learner if the cards are refreshed mid-session. */
          const ctx = p.unit && !onlyNumbers ? pickContext(p.unit, type) : null;
          /* And which number or time, for the same reason and by the same
             rule: drawn once, here, from a seed that moves on a right
             answer so a missed question comes back unchanged. */
          const item = byIdOf(items).get(p.id);
          const drawn = drawRange(item, p.unit, type, sets, items, settings, numbers);
          /* A range none of whose numbers its words can say yet. The pool
             has already left those out; this is a seed that found none. */
          if (item && item.range && !drawn.ask) continue;
          out.push({
            id: p.id,
            subId: p.subId,
            type,
            ...(ctx ? { ctx: ctx.id } : null),
            ...drawn,
            ...(onlyNumbers ? { within: "numbers" as const } : null),
          });
        }
      }
    }
    return out;
  };

  /* Card by card until the questions reach the target — and never fewer
     cards than the learner asked for. The cards they marked already rank
     ahead of everything else, so taking at least as many as there are of
     them is the whole of it: the session grows to hold what was asked for
     rather than turning the rest away. */
  let taken = 0;
  let count = 0;
  /* Easiest first, and cards of the same difficulty in no particular
     order — which is most of them, since a card nobody has been wrong
     about yet is unrated. A card the learner asked for opens the session
     ahead of all of it: they went and marked it, and a warm-up that buried
     it behind eight other words would be the app quietly declining. */
  const ordered = (n: number) =>
    inOrder(candidates.slice(0, n), (c) => (c.urgent ? -1 : DIFF_RANK[itemDifficulty(c.it, settings)]));
  let warmed = ordered(0);
  let plans: Plan[] = [];
  let exercises: ReturnType<typeof deal> = [];
  /* Filled to `target` questions, carrying on from wherever the last call
     left off, so a session found short after its grids are dealt can be
     filled further without being started again. */
  const fill = (target: number) => {
    while (taken < candidates.length && (taken < Math.max(1, askedFor) || count < target)) {
      count += asks(plansOfCard(candidates[taken]));
      taken += 1;
    }
    warmed = ordered(taken);
    plans = warmed.flatMap(plansOfCard);
    exercises = deal(plans);
    /* A question can still fall out as it is dealt — a number nobody can
       be asked yet — so a session short of its target takes the next card
       while there is one. */
    while (exercises.length < target && taken < candidates.length) {
      count += asks(plansOfCard(candidates[taken]));
      taken += 1;
      warmed = ordered(taken);
      plans = warmed.flatMap(plansOfCard);
      exercises = deal(plans);
    }
    /*
     * And when every card it may take is taken and it is still short — a
     * beginner, whose new words come ten at a time — each word is asked
     * more: first whatever else it has open, then the same questions
     * again, up to MAX_ASKS_PER_UNIT, a round at a time so a word asked
     * twice has the session between the two. Two right answers running is
     * what opens a word's next level, so the second asking is not idle. A
     * skill is never asked the same exercise twice: its number is drawn
     * once, and the second asking would be the same number.
     */
    let grown = true;
    while (exercises.length < target && grown) {
      grown = false;
      for (const p of plans) {
        if (p.types.length >= MAX_ASKS_PER_UNIT) continue;
        const next = p.more.length
          ? (p.more.shift() as string)
          : p.range
          ? null
          : p.types[p.types.length % Math.max(1, Math.min(p.types.length, PER_UNIT))] || null;
        if (!next) continue;
        p.types.push(next);
        grown = true;
      }
      exercises = deal(plans);
    }
  };

  /* The grids, dealt: every word the plans mean to ask as a pair is put in
     one, and a word whose grid could not be filled is asked its next
     exercise instead. */
  const gridded = () =>
    varyTypes(
      withGrids(exercises, gridCompany(exercises, items), settings, (unit, queued) =>
        pickableTypes(unit, settings).find(
          (t) => !isGrid(t) && !queued.has(t) && (!onlyNumbers || !borrowsPhrase(t))
        ) || null
      )
    );
  /*
   * The length is in screens: a session of twenty is twenty things on
   * screen, the way its counter reads, and a grid is one of them however
   * many words are in it. A grid takes several questions into one screen,
   * so a session filled to its length in questions comes out short in
   * screens; it is filled further by what the grids took, until the
   * screens reach the length or there is nothing more to add.
   */
  let target = budget;
  fill(target);
  let varied = gridded();
  for (let round = 0; round < 8 && varied.length < budget; round += 1) {
    const had = exercises.length;
    target = had + (budget - varied.length);
    fill(target);
    if (exercises.length === had) break;
    varied = gridded();
  }
  /* Rule 1, judged on the material: a session is refused for want of
     variety when the cards in it support only one exercise between them,
     not when the ladder has opened only one so far. A deck of new scenes
     is asked to read each through and nothing harder, and that is a
     session — a short one, until the reading is mastered. */
  const offered = new Set(plans.flatMap((p) => enabledTypes(p.unit, settings)));
  if (offered.size < 2) return { exercises: [], reason: "no-variety" };

  /* Counted over the cards the session actually took, not over the whole
     collection: this is a fact about the session on screen. A card the
     learner asked for counts as waiting, because they said so. */
  const dealt = new Set(plans.map((p) => p.id));
  const due = [...dealt].filter((id) => {
    const it = pool.find((x) => x.id === id);
    if (!it) return false;
    if (isUrgent(it, settings)) return true;
    return drillableUnits(it, settings).some(({ unit }) =>
      askableTypes(unit, settings).some((t) => stateReady(stateOf(unit, t)))
    );
  }).length;

  /*
   * Where the session ends.
   *
   * The budget, ordinarily — and far enough to reach the last card the
   * learner asked for, where that is further. The second half of the same
   * fault as the count above: admitting a marked card and then cutting the
   * queue before its first question is the same as never admitting it, and
   * it is what a learner who marks more cards than a session holds would
   * have seen. Questions are dealt a round at a time, so every card is
   * asked once before any card is asked twice and the reach is a handful
   * of questions rather than a session of a different size.
   */
  let cut = cutAtLength(varied, budget);
  const askedIds = new Set(warmed.filter((c) => c.urgent).map((c) => c.it.id));
  for (const id of askedIds) {
    const at = varied.findIndex((e) => e.id === id);
    if (at >= 0) cut = Math.max(cut, at + 1);
  }

  return {
    exercises: withReadThroughs(varied.slice(0, cut), items, settings),
    reason: null,
    items: dealt.size,
    units: plans.length,
    due,
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
  /* Each kind of grid is dealt on its own — a word asked in the grid of
     meanings and the grid of recordings in one session stands in one of
     each — so what was wanted, dealt and dropped is kept per kind. */
  const gridKey = (type: string, id: string) => `${type} ${id}`;
  const wanting: Map<string, Map<LangId, Form[]>> = new Map();
  for (const ex of list) {
    if (!isGrid(ex.type)) continue;
    const r = resolveUnit(items, ex);
    if (!r) continue;
    const byLang = wanting.get(ex.type) || new Map<LangId, Form[]>();
    wanting.set(ex.type, byLang);
    const lang = langIdOf(r.unit, settings);
    const already = byLang.get(lang) || [];
    if (already.some((u) => u.id === r.unit.id)) continue;
    placeOf.set(r.unit.id, { id: ex.id, subId: ex.subId || null });
    byLang.set(lang, already.concat([r.unit]));
  }
  if (!wanting.size) return list;

  const leadOf: Map<string, Form[]> = new Map(); // type + first word -> the rest
  const dealt: Set<string> = new Set();
  const dropped: Set<string> = new Set();
  for (const [type, byLang] of wanting) {
    const heard = specOf(type).tiles === "audio";
    for (const [lang, asked] of byLang) {
      const mine = new Set(asked.map((u) => u.id));
      const spares: Form[] = [];
      for (const card of items) {
        if (!isDrillable(card, settings) || langIdOf(card, settings) !== lang) continue;
        if (isDialog(card) || hasSlots(card)) continue;
        for (const { unit, isSub } of unitsOf(card)) {
          if (!unit.ar || (!heard && !unit.en) || mine.has(unit.id)) continue;
          /* A word on the left of the grid of recordings is a play button,
             so a spare standing there has to be one that can be heard. */
          if (heard && (!(unit.recs || []).length || !typeAllowedNow(type, unit))) continue;
          const st = statesOf(unit)[type];
          if (!st || st.phase === "new" || !openTypes(unit, settings).includes(type)) continue;
          if (!placeOf.has(unit.id)) placeOf.set(unit.id, { id: card.id, subId: isSub ? unit.id : null });
          spares.push(unit);
        }
      }
      const lg = langOf(settingsFor(settings, asked[0]));
      const { grids, dropped: out } = matchGroups({
        wanting: asked,
        spares: inOrder(spares, (u) => dueRank(statesOf(u)[type].due || 0)),
        textOf: (u) => u.ar,
        /* What the other column shows: the meaning, or in the grid of
           recordings the word itself. */
        meaningOf: (u) => (heard ? u.ar : u.en),
        likeness: (a, b) => wordLikeness(a.ar, b.ar, lg),
        familyOf: (u) => placeOf.get(u.id)?.id || u.id,
      });
      for (const grid of grids) {
        leadOf.set(gridKey(type, grid[0].id), grid.slice(1));
        for (const u of grid) dealt.add(gridKey(type, u.id));
      }
      for (const u of out) dropped.add(gridKey(type, u.id));
    }
  }

  const result: Question[] = [];
  for (const ex of list) {
    if (!isGrid(ex.type)) {
      result.push(ex);
      continue;
    }
    const r = resolveUnit(items, ex);
    if (!r) continue;
    const key = gridKey(ex.type, r.unit.id);
    const rest = leadOf.get(key);
    if (rest) {
      leadOf.delete(key); // once, whatever the queue asked twice
      result.push({ ...ex, mates: rest.map((u) => placeOf.get(u.id) as { id: string; subId: string | null }) });
      continue;
    }
    if (dealt.has(key) || !dropped.has(key)) continue;
    const pick = substitute(r.unit, queued.get(keyOf(ex)) || new Set());
    if (!pick) continue;
    const ctx = specOf(pick).needs.includes("contexts") ? pickContext(r.unit, pick) : null;
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
function withReadThroughs(list: any[], items: Item[], settings: Settings) {
  const seen = new Set();
  const out = [];
  for (const ex of list) {
    const card = items.find((i) => i.id === ex.id) || null;
    if (card && isDialog(card) && !seen.has(card.id)) {
      seen.add(card.id);
      if (sceneUnmet(card, settings)) out.push({ id: card.id, subId: null, type: "dlgread" });
    }
    out.push(ex);
  }
  return out;
}

/* Nobody has answered anything about this scene yet — not a line, not the
   scene itself. */
function sceneUnmet(card: Item, settings: Settings) {
  return unitsOf(card).every(({ unit }) =>
    supportedTypes(unit, settings).every((t) => stateOf(unit, t).phase === "new")
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
 *
 * And one thing ahead of both, for a card that has climbed its ladder and
 * is making its passes: its top question first. A session hands a unit two
 * of its questions, so a card with eight of them due has a one-in-four
 * chance of being asked the one its passes are counted on — and a learner
 * who sits down once a day would wait days for it to come up, which is
 * the badge arriving by luck rather than by what they know. It is only an
 * ordering, and only among what is due: nothing is suppressed, the other
 * questions are still due and come up in the sittings after this one, and
 * the same number of questions gets asked either way.
 */
function pickableTypes(unit: Form, settings: Settings) {
  const types = askableTypes(unit, settings);
  const fresh = types.every((t) => stateOf(unit, t).phase === "new");
  const ladder = laddered(unit, settings);
  const passing = cleared(ladder, (t) => stateOf(unit, t));
  const top = topLevelOf(ladder);
  return inOrder(types, (t) => {
    const ready = stateReady(stateOf(unit, t)) ? 0 : 2;
    const gentle = fresh && !specOf(t).gentle ? 1 : 0;
    const waiting = passing && ready === 0 && levelOf(t) === top ? -1 : 0;
    return ready + gentle + waiting;
  });
}

/* Every exercise type this form supports is already mature — and for a
   cell that is asked one exercise a level, every one of those: a form is
   finished when nothing it is being asked is left, not when exercises
   nobody is putting to it are still new. */
function unitFullyLearnt(unit: Form, settings: Settings) {
  const types = easedTo(unit, supportedTypes(unit, settings));
  return types.length > 0 && types.every((t) => maturity(stateOf(unit, t)) === "mature");
}

/* Exercise types follow from the mode, so there is nothing to choose. */
function typesForMode(mode: string) {
  /* The second place the quiet window has to be honoured: the manual builder
     comes through here rather than through enabledTypes. Get started draws on
     two gentle types, one of which is listening, so during the window it
     builds from recognition alone — which is still the gentle end. */
  /* No form in hand here, so only the clock can rule a type out — which is
     right: this is choosing what a drill is *about*, and the cards it will
     be about are chosen afterwards. */
  const enabled = TYPES.filter((t) => typeAllowedNow(t));
  return mode === "started" ? enabled.filter((t) => EASY_TYPES.includes(typeOf(t))) : enabled;
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
export function buildManualSession({ items, settings, ids, mode, count, minutes, perDay, systems }: {
  items: Item[];
  settings: Settings;
  ids: Set<string> | string[];
  mode: string;
  count?: number;
  minutes?: number;
  /** As buildSession takes them — Regular is dealt by it. */
  perDay?: number;
  systems?: SystemSet[];
}) {
  const chosen = new Set(ids);
  /*
   * Regular is the everyday session over the cards picked: the same
   * dealing the home screen and a prep do, narrowed to these cards the way
   * a prep narrows it to its decks. What is due first, the words still
   * climbing ahead of the rest, and new words let in only as fast as the
   * learner clears them. It used to take every card picked, shuffled, with
   * none of that — so the same decks gave a far wider and far less useful
   * spread here than on the home screen. The other modes are for
   * deliberately stepping outside the schedule, and keep their own rules.
   */
  if (mode === "regular") {
    const budget = count && count < 999 ? count : minutes ? minutes * TIMED_PER_MINUTE : SESSION_SIZE;
    const built = buildSession({
      items, settings, inDeck: (it) => chosen.has(it.id), budget, perDay, systems, newWithin: true,
    });
    return { ...built, manual: true, mode, learnt: [] as Item[] };
  }
  const allowed = new Set(typesForMode(mode));
  /* Two types is the rule everywhere else, and it is what keeps a session
     from being one exercise repeated. Get started draws on the two gentle
     types alone, one of which needs a recording, so holding it to two would
     quietly turn the beginners' mode into one that only accepts cards with
     audio. It takes a card on one. */
  const minTypes = mode === "started" ? 1 : 2;
  if (allowed.size < minTypes) return { exercises: [], reason: "no-variety" };

  /* A value is not one of them, however it was chosen. "Raphael" is in the
     deck to fill somebody else's sentence, and "what does Raphael mean" is
     not a question — which a dealt session has always honoured, through
     isDrillable, and this one never did: picking the deck a frame lives in
     drilled its names as cards in their own right. */
  const sets = systems || [];
  const pool = items.filter(
    (i) => chosen.has(i.id) && i.drill !== false && (!isRangeSkill(i) || systemFor(i, sets)),
  );
  const plans: Question[] = [];
  const learnt = [];
  /* What the mode allows of what the form supports, and of that, the
     levels the form has reached: a session built by hand climbs the same
     ladder a dealt one does. A form qualifies on the first — it is the
     material that has to offer two exercises — and is asked from the
     second. Read in the card's own language, like every other reader. */
  /* `allowed` is the mode's own list and knows nothing of whose card this
     is, so the per-form gate is applied here: a session built by hand must
     no more ask for a recording this device does not hold than a dealt one
     does. */
  const supportedFor = (unit: Form) =>
    easedTo(
      unit,
      supportedTypes(unit, settings).filter((t) => allowed.has(t) && typeAllowedNow(t, unit)),
    );
  const usableFor = (unit: Form) =>
    openTypesOf(
      supportedFor(unit).flatMap((t) => keysFor(unit, t)),
      (k) => statesOf(unit)[k],
    )
      /* And, as a dealt session does, only the ones whose holes can be
         filled with something the learner has met — see fillableAt. A
         frame is chosen by hand the same way it is dealt. */
      .filter((k) => fillableAt(unit, k, settings));
  /* Every exercise the chosen forms support between them, for the
     variety rule below. */
  const offered: Set<string> = new Set();
  /* What each form was asked and what else it has open, for a session the
     forms cannot fill at PER_UNIT apiece — see the filling below. */
  const asked: { id: string; subId: string | null; unit: Form; taken: string[]; more: string[]; skill: boolean }[] = [];

  for (const it of pool) {
    let anyUsable = false;
    let anyLearnt = false;

    /* The same gates a dealt session applies — a form the teacher keeps
       without asking about, a cell of a row nobody has reached — and not
       the two-exercise minimum, which this mode sets for itself below. */
    for (const { unit, isSub } of askedUnits(it)) {
      const supported = supportedFor(unit);
      if (supported.length < minTypes) continue;
      if (unitFullyLearnt(unit, settings)) {
        anyLearnt = true;
        continue;
      }
      if (mode === "mistakes" && !hasRecentMistake(unit, settings)) continue;
      if (mode === "unseen" && !notSeenLately(unit, settings)) continue;
      const usable = usableFor(unit);
      if (!usable.length) continue;
      anyUsable = true;
      for (const t of supported) offered.add(t);

      const take = everyTypeMode(mode)
        ? usable
        : shuffle(usable).slice(0, Math.min(PER_UNIT, usable.length));
      for (const t of take) {
        const ctx = pickContext(unit, t);
        plans.push({ id: it.id, subId: isSub ? unit.id : null, type: t, ...(ctx ? { ctx: ctx.id } : null) });
      }
      asked.push({
        id: it.id, subId: isSub ? unit.id : null, unit, taken: take.slice(),
        more: usable.filter((t) => !take.includes(t)), skill: isRangeSkill(it),
      });
    }

    if (!anyUsable && anyLearnt) learnt.push(it);
  }

  if (!plans.length) {
    return {
      exercises: [],
      reason: learnt.length
        ? "all-learnt"
        : mode === "mistakes"
        ? "no-mistakes"
        : mode === "unseen"
        ? "no-unseen"
        : "none-drillable",
      learnt,
    };
  }

  /*
   * A session with a length that the forms chosen cannot fill at PER_UNIT
   * apiece: each is asked more — first whatever else it has open, then the
   * same again — a round at a time, up to MAX_ASKS_PER_UNIT. The same rule
   * a dealt session follows (see buildSession), so twenty questions on
   * five words is twenty questions, not ten. Added after the rest and
   * shuffled among themselves, so a word's second asking comes in the
   * later part of the session rather than beside its first. A skill is
   * never asked the same exercise twice.
   */
  const length = count && count < 999 && !everyTypeMode(mode) ? count : 0;
  const extra: Question[] = [];
  /* Asked more, until the questions reach `target`, carrying on from where
     the last call left off. */
  const growTo = (target: number) => {
    let grown = true;
    while (plans.length + extra.length < target && grown) {
      grown = false;
      for (const a of asked) {
        if (a.taken.length >= MAX_ASKS_PER_UNIT || plans.length + extra.length >= target) continue;
        const t = a.more.length
          ? (a.more.shift() as string)
          : a.skill
          ? null
          : a.taken[a.taken.length % Math.min(a.taken.length, PER_UNIT)];
        if (!t) continue;
        a.taken.push(t);
        const ctx = pickContext(a.unit, t);
        extra.push({ id: a.id, subId: a.subId, type: t, ...(ctx ? { ctx: ctx.id } : null) });
        grown = true;
      }
    }
  };
  if (length) growTo(length);

  /* Shuffle first, so the queue doesn't track the order of your card list,
     then space the types out. Ultimate ignores the length: it runs until
     everything has gone right at least once. The extra askings go after
     the rest, shuffled among themselves. */
  const keptFirst = keptToNumbers(plans);
  const numbersOnly = keptFirst !== plans;
  const queue = () => {
    const keptMore = numbersOnly ? keptToNumbers(extra) : extra;
    const kept = keptFirst.concat(keptMore);
    return varyTypes(
      drawRanges(
        withGrids(shuffle(keptFirst).concat(shuffle(keptMore)), gridCompany(kept, items), settings, (unit, queued) =>
          shuffle(usableFor(unit)).find(
            (t) => !isGrid(t) && !queued.has(t) && !(numbersOnly && borrowsPhrase(t))
          ) || null
        ),
        items,
        sets,
        settings,
      )
    );
  };
  let ordered = queue();
  /* The length is in screens, and a grid is one screen for several
     questions — see cutAtLength — so what the grids took is asked again
     until the screens reach the length or nothing more can be added. */
  for (let round = 0; length && round < 8 && ordered.length < length; round += 1) {
    const had = extra.length;
    growTo(plans.length + extra.length + (length - ordered.length));
    if (extra.length === had) break;
    ordered = queue();
  }
  const exercises = everyTypeMode(mode) ? ordered : ordered.slice(0, cutAtLength(ordered, Math.max(4, count || 0)));

  /* The same minimum again, and the one easily missed: when every card chosen
     supports a single gentle type the whole session is that one type, so
     relaxing only the per-card check above would still refuse to build.
     Judged on what the cards support, as above: a session the ladder has
     narrowed to one exercise is still a session. */
  if (offered.size < minTypes) return { exercises: [], reason: "no-variety", learnt };

  return {
    exercises: withReadThroughs(exercises, items, settings),
    reason: null,
    manual: true,
    mode,
    learnt,
    items: new Set(exercises.map((e) => e.id)).size,
    units: plans.length + extra.length,
  };
}

/* ------------------------------------------------------------------
   The weak-skills session

   Everything going wrong, and nothing else.

   The app already knows what a learner keeps missing — it is what shuts
   the levels above a question and what the Progress screen calls *paused*
   — and until now the only way to practise it was to remember which cards
   they were, tick them by hand on the Build screen and choose Fix
   mistakes. A learner who could do that did not need the feature.

   Two things make this its own builder rather than a preset of the one
   built by hand:

   **It asks the questions that went wrong**, not a sample of the card's
   exercises. Progress is kept per exercise, not per card — knowing a word
   when you read it and knowing it when you hear it are separate — so a
   card that keeps failing *written from its meaning* is drilled on that,
   and not on the reading it has always got right. That is what makes the
   button say skills rather than cards.

   **It is ordered by how badly it is going.** Wrong twice running leads,
   because that is the app's own definition of a gap rather than a slip —
   see `missedTwice`, which is what shuts a level — and a single recent
   miss follows it.

   What it deliberately does not do is refuse for want of variety, which
   every other session does. A session of one exercise repeated is a poor
   way to meet new material and exactly the right way to fix the one thing
   you keep getting wrong.
   ------------------------------------------------------------------ */

/**
 * How badly one exercise is going.
 *
 * 2 — wrong twice running, with nothing right in between. The gap.
 * 1 — wrong once in the last two outings. The slip.
 * 0 — nothing to fix here.
 *
 * `hist` is the last six outings, 1 right and 0 wrong, and it is the only
 * record with an order to it. A card from before it existed carries an
 * empty one and reads as 0 rather than as never having been right, which
 * is the same guard `missedTwice` and `hasRecentMistake` both make.
 */
export function weakness(s: ExerciseState | null | undefined): number {
  if (!s) return 0;
  if (missedTwice(s)) return 2;
  return (s.hist || []).slice(-2).some((x) => !x) ? 1 : 0;
}

/*
 * The words a matching grid puts up, and the meanings beside them — see
 * the grid in the question screen, which is where this is read, and the
 * deck forecast, which marks the same words the screen would.
 */
export function gridFor(item: Form, exercise: Question, asking: Item[], settings: Settings, qLang: Lang) {
  /* The grid of recordings: a play button for each word, and the words
     themselves down the other side where the meanings would be. Its
     spare tiles are words, so they need no recording; every word asked
     does. */
  const heard = specOf(exercise.type)?.tiles === "audio";
  const other = (u: Form) => String((heard ? u.ar : u.en) || "");
  const fits = (u: Form) => !!u.ar && !!other(u);
  /* Two units a learner would read as one tile: the same word, or the
     same meaning, after both have been narrowed to the one the question
     shows. matchSet is the gate that refuses them; this is the same
     question asked while the company is being chosen, so a trial does
     not spend its four places filling up with them. */
  const sameTile = (a: Form, b: Form) =>
    String(a.ar || "").trim() === String(b.ar || "").trim() ||
    other(a).trim().toLowerCase() === other(b).trim().toLowerCase();
  const ownerOf = new Map<string, string>();
  for (const card of asking) {
    for (const { unit } of unitsOf(card)) ownerOf.set(unit.id, card.id);
  }
  const familyOf = (u: Form) => ownerOf.get(u.id) || u.id;
  const answers: Form[] = [item];
  for (const mate of exercise.mates || []) {
    const r = resolveUnit(asking, { ...mate, type: exercise.type });
    /* Narrowed here rather than at the tile, because the grid is marked
       against the word's own `en` — a tile showing one meaning and a
       mark expecting two would call every right answer wrong. */
    if (r && fits(r.unit)) answers.push(oneOf(r.unit, exercise.type));
  }
  const pool = wordPool(companyOf(asking, exercise), settings, qLang.id, item)
    .filter(fits)
    .map((u) => oneOf(u, exercise.type));
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
      if (answers.some((a) => a.id === u.id)) continue;
      /* A word standing on the left of the grid of recordings is played,
         so it has to have something to play. */
      if (heard && !(u.recs || []).length) continue;
      /* And nothing that reads the same as what is already there. Two
         tiles a learner cannot tell apart make the pairing a guess —
         matchSet refuses them below, and a trial that handed it four
         collisions would be a grid of one word and a lot of spares. */
      if (answers.some((a) => sameTile(a, u) || familyOf(a) === familyOf(u))) continue;
      answers.push(u);
    }
  }
  return matchSet({
    answers,
    pool: ranked,
    seed: `${item.id} ${reps}`,
    textOf: (u) => u.ar,
    meaningOf: other,
    familyOf,
  });
}

/**
 * What one answer marks.
 *
 * Read by the question screen when an answer is given, and by the deck
 * forecast for every answer it plays forward — one function, so what an
 * answer counts for is decided in one place and a forecast never marks
 * less, or more, than a real answer would.
 *
 * `grid` is each word a matching grid put up and whether its pair was
 * right, or null for any other question; `item` is the question as it was
 * shown, blanks filled — see `resolveQuestion`.
 */
export function marksForAnswer({
  exercise,
  item,
  parentItem,
  asking,
  settings,
  systems,
  correct,
  rating,
  practice,
  grid,
}: {
  exercise: Question;
  item: Form;
  parentItem: Item;
  asking: Item[];
  settings: Settings;
  systems: SystemSet[];
  correct: boolean;
  rating: string;
  practice: boolean;
  grid: { unit: Form; right: boolean }[] | null;
}): Mark[] {
  /*
   * One question marks one form — except the grid, where every word up
   * is a question of its own and is marked on the pair put to it,
   * whatever the rest of the grid did.
   *
   * A word dealt in to fill a grid out may not have been due. A success
   * on it counts — it is a right answer — but does not move its
   * schedule, the way practice does not; a miss is a miss wherever it
   * happens. The first word is marked as any question is.
   */
  const marks: Mark[] = [];
  if (grid) {
    const placeOf = (w: Form) => {
      if (w.id === item.id) return { id: parentItem.id, subId: exercise.subId || null };
      for (const mate of exercise.mates || []) {
        const r = resolveUnit(asking, { ...mate, type: exercise.type });
        if (r && r.unit.id === w.id) return mate;
      }
      return null;
    };
    for (const m of grid) {
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
    marks.push({
      id: parentItem.id,
      subId: exercise.subId || null,
      rating,
      correct: !!correct,
      advance: !practice,
      /* What this question was filled with, where it had blanks — carried
         on the mark, because the words it borrowed are marked too and
         none of them was filled with anything. */
      filled: (item as Record<string, any>).filled as Record<string, string> | undefined,
    });
    /*
     * And the words that stood in those blanks.
     *
     * A sentence is a card made of blanks and the vocabulary fills them,
     * so answering one is answering about the words in it: writing *the
     * book is big* in the script is writing each of those two words in
     * the script. Only the sentence used to be marked, so a learner
     * could write a noun correctly a dozen times inside sentences and
     * the app went on believing they had never produced it. The rule — a
     * right answer only, the schedule moving only where that word's own
     * was due, and only exercises the word itself climbs — is
     * fillerMarks.
     */
    marks.push(...fillerMarks(fillersIn(item, exercise.type, settings), { correct: !!correct }, practice));
  }
  /*
   * A range is marked on itself *and* on the words that stood in it.
   *
   * The answer says two things, so both are filed. It says the learner
   * is getting better at counting to a hundred, which is the skill's own
   * key; and it says they read the word for forty and knew what it
   * meant, which is the ordinary key each component card climbs. The
   * second goes through `under`, because no card climbs a ladder called
   * "num2fig" and writing one would be a schedule nothing ever reads.
   */
  if (item.tokens) {
    const set = systemFor(parentItem, systems);
    const equivalent = NUMBER_EQUIVALENT[exercise.type] || exercise.type;
    /* Per word, because a word with no figures of its own — *hundred*,
       *and* — does not climb the key a number is asked from in figures. */
    const underOf: Map<string, string> = new Map();
    const fillers = tokenCards(
      (item.tokens as Token[]) || [],
      set ? set.numbers.id : "",
      set && set.times ? set.times.id : "",
      asking,
    ).map(({ card, form }) => {
      const keys = laddered(form, settings);
      const fallback = NUMBER_FALLBACK[equivalent];
      const under = !keys.includes(equivalent) && fallback && keys.includes(fallback) ? fallback : equivalent;
      const subId = form.id === leadOf(card).id ? null : form.id;
      underOf.set(`${card.id} ${subId || ""}`, under);
      return {
        id: card.id,
        subId,
        asked: keys.includes(under),
        ready: (() => {
          const st = statesOf(form)[under];
          return !!st && st.phase !== "new" && stateReady(st);
        })(),
      };
    });
    marks.push(
      ...fillerMarks(fillers, { correct: !!correct }, practice).map((mark) => ({
        ...mark,
        under: underOf.get(`${mark.id} ${mark.subId || ""}`) || equivalent,
      })),
    );
  }
  return marks;
}

/**
 * The cards, and the form on each, that the words of a rendered number
 * or time were written on.
 *
 * Three things a slot alone did not say. A time is said partly in the
 * clock's words, which are the time system's cards and not the numbers'
 * — looked up under the numbers alone, *quarter past* and *in the
 * evening* were never credited however often they were read. A numeral
 * wears a face — *wahde* with a feminine word, the one word before a
 * noun — and the face is a form of its own with its own schedule, so the
 * face that was said is the one credited. And a counted noun is the
 * teacher's own noun card, credited on the form the number called for:
 * *three books* is the plural read.
 */
export function tokenCards(
  tokens: Token[],
  numbersId: string,
  timeId: string,
  asking: Item[],
): { card: Item; form: Form }[] {
  const out: { card: Item; form: Form }[] = [];
  for (const t of tokens) {
    if (t.noun) {
      const card = asking.find((i) => i.id === t.noun);
      if (!card) continue;
      const form = formsOf(card).find((f) => String(f.ar || "").trim() === t.text.trim()) || leadOf(card);
      out.push({ card, form });
      continue;
    }
    for (const id of cardsOfToken(t, numbersId, timeId)) {
      const card = asking.find((i) => i.id === id);
      if (!card) continue;
      const face = t.formKey ? formsOf(card).find((f) => f.id === `${card.id}-f~${t.formKey}`) : null;
      out.push({ card, form: face || leadOf(card) });
    }
  }
  return out;
}

/**
 * The card, narrowed to the question being asked of it: its variables
 * filled in, one accepted answer where the question is about how a word
 * sounds, one meaning where the meaning is the question, a range drawn.
 * Read by the question screen and by the deck forecast, which marks the
 * question as the screen would have shown it.
 */
export function resolveQuestion(asking: Item[], exercise: Question, trial: boolean, systems: SystemSet[]) {
  return castRange(
    castMeaning(castAnswer(castFill(resolveUnit(asking, exercise), exercise.type, trial), exercise.type), exercise.type),
    exercise,
    systems,
  );
}

/**
 * How an answer to this question is graded, beyond what it marks — shared
 * by the question screen and the deck forecast, as `marksForAnswer` is.
 */
export function gradingFor(exercise: Question, settings: Settings) {
  return {
    type: exercise.type,
    level: levelOf(exercise.type),
    keepMet: needsMetRecord,
    /* The ladder each marked form climbs, so a right answer given to a
       cleared card's top question, when that question came round of its
       own accord, counts towards the two passes that make it learnt. Per
       form and not per card, because one answer marks several: a word
       standing in somebody else's sentence is credited on its own ladder. */
    keysOf: (unit: Form) => laddered(unit, settings),
  };
}

/* ------------------------------------------------------------------
   How soon some cards could be learnt

   Simple arithmetic over where the cards stand, not a simulation. It was a
   simulation until 0.287 — the app's own session builder and marking
   played forward sitting by sitting — and that took the better part of a
   minute on a phone to say one sentence. The owner chose an answer that is
   instant and approximate over one that is exact and slow, and chose to
   keep it in step with the rules by hand.

   **So when the learning rules change, look here.** Three things below are
   the rules restated: what a card still needs (`workloadOf`), the calendar
   floor on learning a card (`LEARN_DAYS`), and how much of a session moves
   cards forward (`PROGRESS_SHARE`). A change to the ladder, to how a pass is
   made, to the ten-word front door or to what a session deals can make any
   of them wrong, and nothing will fail to say so.
   ------------------------------------------------------------------ */

/*
 * The fewest days a card not yet learnt can take to be learnt, however
 * much it is practised: a word can be climbed in one evening, but its two
 * passes are reviews that only count on the day they come round, a day
 * and then a few days apart. Four is what the pace simulation measured for
 * the fastest words before it was retired.
 */
export const LEARN_DAYS = 4;

/*
 * The fewest days the words a sentence is built from take to be cleared,
 * where they are not yet: a sentence can be asked nothing until they are
 * (see valuesAt), so its own four days start after them. The pace
 * simulation measured a word clearing in about a day and a half at fifteen
 * sittings a day, which is as fast as anybody goes; rounded up.
 */
export const CLEAR_DAYS = 2;

/*
 * How much of a session moves the chosen cards forward. The rest is
 * questions asked ahead of time, retests and reviews of what is already
 * known. About half, from the pace simulation's measurements before it was
 * retired; it turns questions needed into sessions needed.
 */
export const PROGRESS_SHARE = 0.5;

/* How far ahead an answer is worth giving before it says "more than two years". */
export const FORECAST_MAX_DAYS = 730;

/** Midnight at the start of the day a moment falls on. */
function dayOf(t: Millis): Millis {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export interface Workload {
  /** Cards that can be asked about and are not yet learnt — or cleared,
      where that is the target. */
  left: number;
  /** Right answers still needed to take all of them to learnt. */
  questions: number;
  /** The sessions that takes, at PROGRESS_SHARE of a session each. */
  sessions: number;
  /** The fewest days it can take, however much is practised. */
  earliestDays: number;
}

/**
 * What some cards still need, counted off where they stand.
 *
 * Per question on a card's ladder: nothing if it is right twice running
 * already, one more right answer if its last answer was right, two if not —
 * two in a row being what opens the level above. Then the passes still to
 * make on the top of the ladder, one question each. A card nothing can be
 * asked about, or already learnt, needs nothing.
 *
 * The fewest days: every card not yet learnt takes LEARN_DAYS, except a
 * cleared one, which waits only for its passes — the next when its review
 * comes round, and a couple of days for each after. And cards never met
 * come in at most FRONT_DOOR_CAP at a time, each group about a day behind
 * the last. Ten even for a keen learner, whose door is wider (see
 * frontDoorFor): a wider door clears each word more slowly, and measured,
 * a hundred cards were all met at about the same day either way.
 *
 * With Cleared as the target (a prep can aim there — see PrepTarget), a
 * cleared card needs nothing, the passes are left out of the questions, and
 * the fewest days are CLEAR_DAYS where they were LEARN_DAYS: the passes are
 * what make learning a card take days rather than an evening.
 */
export function workloadOf(cards: Item[], settings: Settings, at: Millis = now(), target: PrepTarget = "learnt"): Workload {
  const toClear = target === "cleared";
  let left = 0;
  let questions = 0;
  let unseen = 0;
  let floor = 0;
  for (const it of cards) {
    /* A number waiting on its stretch is asked nothing yet, but it is in
       the deck and has all of its ladder ahead of it: counted as it will
       stand once the stretch opens, as towardsLearnt counts it. */
    const now_ = standing(cardStandings(it, settings, cards));
    const ladder = now_ ? laddered : ladderedOnceOpen;
    const where = now_ || standing(cardStandings(it, settings, cards, ladderedOnceOpen));
    if (!where || reached(where, target)) continue;
    left += 1;
    let fresh = true;
    let passesLeft = 0;
    for (const { unit } of unitsOf(it)) {
      const keys = ladder(unit, settings);
      if (!keys.length) continue;
      for (const k of keys) {
        const st = stateOf(unit, k);
        if (st.phase !== "new") fresh = false;
        if (solid(st)) continue;
        const hist = st.hist || [];
        questions += hist.length && hist[hist.length - 1] ? 1 : 2;
      }
      if (toClear) continue;
      const top = topLevelOf(keys);
      const owed = Math.max(0, PASSES_TO_LEARN - passesMade(keys, (k) => stateOf(unit, k)));
      questions += owed * keys.filter((k) => levelOf(k) === top).length;
      passesLeft = Math.max(passesLeft, owed);
    }
    if (fresh) unseen += 1;
    /* Waiting on the stretch below it, a number starts its climb only once
       that is cleared — the same wait as a sentence's words. */
    const behind = !now_ || blocksAhead(it, settings);
    if (toClear) {
      floor = Math.max(floor, behind ? 2 * CLEAR_DAYS : CLEAR_DAYS);
    } else if (where.status === "cleared" && passesLeft > 0) {
      const next = nextPassAt(it, settings);
      const wait = next > at ? Math.ceil((dayOf(next) - dayOf(at)) / 86400000) : 0;
      floor = Math.max(floor, wait + (passesLeft - 1) * 2);
    } else if (behind) {
      floor = Math.max(floor, CLEAR_DAYS + LEARN_DAYS);
    } else {
      floor = Math.max(floor, LEARN_DAYS);
    }
  }
  if (unseen) floor = Math.max(floor, Math.ceil(unseen / FRONT_DOOR_CAP) - 1 + (toClear ? CLEAR_DAYS : LEARN_DAYS));
  return {
    left,
    questions,
    sessions: questions / (SESSION_SIZE * PROGRESS_SHARE),
    earliestDays: left ? floor : 0,
  };
}

/* A card with blanks that cannot be asked anything yet, because the words
   that would fill them are not cleared — its building blocks are still
   ahead of it. */
function blocksAhead(it: Item, settings: Settings): boolean {
  const units = drillableUnits(it, settings);
  return (
    units.some(({ unit }) => slotsOf(unit).length > 0) &&
    units.every(({ unit }) => askableTypes(unit, settings).length === 0)
  );
}

/** Days from `at` to the start of the day `days` days on. */
export function dayAfter(days: number, at: Millis = now()): Millis {
  const d = new Date(dayOf(at));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/**
 * When some cards would be learnt at a pace of `sessionsPerDay`: the work
 * spread over the days, and never sooner than the fewest days it can take.
 * Null where that is past FORECAST_MAX_DAYS, or there is no pace at all.
 */
export function learntAtPace(w: Workload, sessionsPerDay: number, at: Millis = now()): Millis | null {
  if (!w.left) return at;
  if (!(sessionsPerDay > 0)) return null;
  const days = Math.max(w.earliestDays, Math.ceil(w.sessions / sessionsPerDay));
  return days > FORECAST_MAX_DAYS ? null : dayAfter(days, at);
}

/** The soonest the cards could be learnt, and the practice a day that takes. */
export function earliestOf(w: Workload, at: Millis = now()): { at: Millis; rate: number } {
  if (!w.left) return { at, rate: 0 };
  return { at: dayAfter(w.earliestDays, at), rate: w.sessions / Math.max(1, w.earliestDays) };
}

export type ReadyAnswer =
  | { kind: "already" }
  | { kind: "rate"; rate: number }
  | { kind: "late"; earliest: Millis | null };

/**
 * What being ready by `by` takes: the sessions a day that spread the work
 * over the days left, or — if there are fewer days left than the cards can
 * take — the soonest they could be learnt instead.
 */
export function readyFor(w: Workload, by: Millis, at: Millis = now()): ReadyAnswer {
  if (!w.left) return { kind: "already" };
  const days = Math.round((dayOf(by) - dayOf(at)) / 86400000);
  if (days < w.earliestDays || days <= 0) return { kind: "late", earliest: earliestOf(w, at).at };
  return { kind: "rate", rate: w.sessions / days };
}

/**
 * Has this card anything going wrong on it right now?
 *
 * The home screen counts with this and the builder below picks with the
 * same test, one key at a time, so the number beside the button and the
 * session it opens cannot come to disagree.
 *
 * Read over what may actually be *asked* — the levels the card has
 * reached, the recordings this device holds, the blanks there is something
 * to fill — because an exercise the app is not putting to anybody is not
 * work waiting to be done. A question on a level that a slip further down
 * has shut is the ordinary case: it is not asked until the level under it
 * is recovered, which is the very thing this session is for.
 */
export function isWeak(it: Item, settings: Settings): boolean {
  if (!isDrillable(it, settings)) return false;
  return drillableUnits(it, settings).some(({ unit }) =>
    askableTypes(unit, settings).some((t) => weakness(stateOf(unit, t)) > 0)
  );
}

export function buildWeakSession({ items, settings, inDeck, budget: budgetIn, systems }: {
  items: Item[];
  settings: Settings;
  inDeck: (it: Item) => boolean;
  budget?: number;
  /** As buildSession takes them: a range is asked about a number drawn here. */
  systems?: SystemSet[];
}) {
  const sets = systems || [];
  const pool = items.filter(
    (it) => inDeck(it) && isDrillable(it, settings) && (!isRangeSkill(it) || systemFor(it, sets)),
  );
  if (!pool.length) return { exercises: [], reason: "none-drillable" };

  const budget = Math.max(4, budgetIn || SESSION_SIZE);

  /* One entry per form with something going wrong on it, carrying the
     failing exercises worst first. */
  const failing: {
    id: string;
    subId: string | null;
    unit: Form;
    keys: string[];
    worst: number;
  }[] = [];
  for (const it of pool) {
    const here = [];
    for (const { unit, isSub } of drillableUnits(it, settings)) {
      const weak = askableTypes(unit, settings).filter((t) => weakness(stateOf(unit, t)) > 0);
      if (!weak.length) continue;
      here.push({
        id: it.id,
        subId: isSub ? unit.id : null,
        unit,
        keys: inOrder(weak, (t) => -weakness(stateOf(unit, t))),
        worst: Math.max(...weak.map((t) => weakness(stateOf(unit, t)))),
      });
    }
    /* The same cap a dealt session puts on how much of one card a sitting
       may be about: a verb lays out twenty cells and a scene six lines,
       and a session spent entirely on one word is the complaint the cap
       exists for. The worst-going forms are the ones it keeps. */
    const cap = isDialog(it) ? MAX_DIALOG_LINES : MAX_UNITS_PER_FAMILY;
    for (const u of inOrder(here, (u) => -u.worst).slice(0, cap)) failing.push(u);
  }
  if (!failing.length) return { exercises: [], reason: "nothing-weak" };

  /* Worst first, chance between the ones that are going equally badly. */
  const order = inOrder(failing, (u) => -u.worst);

  /* Dealt a round at a time, so every form with something wrong on it is
     asked once before any of them is asked twice. A learner with one card
     failing in four ways gets all four; a learner with twenty cards
     failing gets one question each and the worst of them first. */
  const plans: Question[] = [];
  const depth = Math.max(...order.map((u) => u.keys.length));
  /* And past the last failing question, round again — up to
     MAX_ASKS_PER_UNIT a form — while the session is short of its length:
     the same thing a dealt session does with a beginner's ten words. A
     skill is not asked the same exercise twice, since its number is drawn
     once and the second asking would be the same number. */
  const isSkill = new Set(pool.filter((it) => isRangeSkill(it)).map((it) => it.id));
  const rounds = Math.max(depth, MAX_ASKS_PER_UNIT);
  let round = 0;
  /* Round by round until the questions reach `target`, carrying on from
     the last round dealt. */
  const dealTo = (target: number) => {
    for (; round < rounds && plans.length < target; round++) {
      for (const u of order) {
        const type = round < u.keys.length ? u.keys[round] : isSkill.has(u.id) ? undefined : u.keys[round % u.keys.length];
        if (!type) continue;
        const ctx = pickContext(u.unit, type);
        plans.push({ id: u.id, subId: u.subId, type, ...(ctx ? { ctx: ctx.id } : null) });
      }
    }
  };
  dealTo(budget);

  /* The grids, dealt, and the same card kept from being asked twice
     running — both exactly as a dealt session does them. */
  const queue = () => {
    const kept = keptToNumbers(plans);
    return varyTypes(
      drawRanges(
        withGrids(kept, gridCompany(kept, items), settings, (unit, queued) =>
          pickableTypes(unit, settings).find(
            (t) => !isGrid(t) && !queued.has(t) && !(kept !== plans && borrowsPhrase(t))
          ) || null
        ),
        items,
        sets,
        settings,
      )
    );
  };
  let varied = queue();
  /* The length is in screens, and a grid is one screen for several
     questions — see cutAtLength — so a session the grids left short goes
     round again while there is a round left. */
  while (varied.length < budget && round < rounds) {
    dealTo(plans.length + (budget - varied.length));
    varied = queue();
  }
  const exercises = withReadThroughs(varied.slice(0, cutAtLength(varied, budget)), items, settings);
  const dealt = new Set(exercises.map((e) => e.id));

  /* How many of them were actually waiting, for the line at the end. A
     missed question comes back within the hour, so most of these are due
     — but a word missed twice a fortnight ago and not seen since is not,
     and the summary says so rather than claiming a schedule moved. */
  const due = [...dealt].filter((id) => {
    const it = pool.find((x) => x.id === id);
    if (!it) return false;
    return drillableUnits(it, settings).some(({ unit }) =>
      askableTypes(unit, settings).some((t) => stateReady(stateOf(unit, t)))
    );
  }).length;

  return {
    exercises,
    reason: null,
    /* Not a dealt session: the screen at the end reads this to know that
       "Keep going" would be a change of subject rather than more of the
       same. */
    manual: true,
    mode: "weak",
    items: dealt.size,
    units: failing.length,
    due,
  };
}

/* Resolve an exercise back to the item and the specific form it drills. */
function resolveUnit(items: Item[], ex: Question | null | undefined) {
  if (!ex) return null;
  const parent = items.find((i) => i.id === ex.id);
  if (!parent) return null;
  if (!ex.subId) return { parent, unit: leadOf(parent), isSub: false };
  const sb = subFormsOf(parent).find((x) => x.id === ex.subId);
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
      out.push({ text: other, en: unit.en || leadOf(it).en || "", id: it.id });
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
/* And the grid of recordings, where what is shown under a sound is the
   word it was. */
export const HEARD_GRID_VERDICT = "Not all of them — the right words are shown.";
/* Giving up is not getting it wrong: nothing was offered to be incorrect.
   The answer is simply handed over. */
export const SKIPPED_VERDICT = "The answer is:";
export function praiseFor(n: number) {
  return PRAISE[((n % PRAISE.length) + PRAISE.length) % PRAISE.length];
}

/* --- AlsoBox --------------------------------------------------------
   What is worth knowing beyond the answer, under a "Learn more" heading.
   It is shown open, with nothing to fold it away: the blocks are there to
   be read, and a tap to reach them was a tap most answers never got.

   Renders nothing — not even the heading — when there is nothing to put
   in it, so "Learn more" is never a promise the box cannot keep.

   The short blocks share a row two at a time — how it is pronounced beside
   how it sounds — so the box is half as tall and Continue half as far
   down. Only the phrase it turned up in keeps the width to itself; the
   related words are a short block like the rest. The pronunciation and
   the recording are always the pair, when both are there; the others pair
   up in order, and one left over takes half a row like everything else,
   so no short block is ever drawn wider than its neighbours. */
const ALSO_PAIR = ["also-hint", "also-audio"];
function alsoName(el: any): string {
  return el.type === RelatedWords ? "related-words" : el.props["data-el"] || "";
}
function AlsoBox({ children }: { children?: Node }) {
  const shown = React.Children.toArray(children).filter(Boolean) as any[];
  if (!shown.length) return null;
  const row = (cells: any[]) => (
    <div className="at-alsorow" data-el="also-row" key={`row-${cells[0].key}`}>
      {cells}
    </div>
  );
  const rows: any[] = shown.filter((el) => alsoName(el) === "also-context");
  const short = shown.filter((el) => alsoName(el) !== "also-context");
  const pair = short.filter((el) => ALSO_PAIR.includes(alsoName(el)));
  const rest = pair.length === 2 ? short.filter((el) => !pair.includes(el)) : short;
  if (pair.length === 2) rows.push(row(pair));
  for (let i = 0; i < rest.length; i += 2) rows.push(row(rest.slice(i, i + 2)));
  return (
    <>
      <p className="at-alsomore" data-el="also-heading">
        Learn more
      </p>
      <div className="at-alsobox" data-el="also">
        {rows}
      </div>
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
      <p className="at-alsolabel" data-el="related-words-label">
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
  /* And to what it called them before 0.213, when the column was named
     after the script rather than the language — a file exported then is
     still a file somebody has. */
  if (L.scriptLabel) FIELD_ALIASES[aliasKey(`${L.scriptLabel} script`)] = "ar";
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

/* Exported for the tests. Everything a document carries comes through here
   on its way in, so what it drops is dropped on every load, after every
   sync and on every import — which is exactly the sort of thing worth
   asserting rather than hoping about. */
export function liftStates(old: Record<string, any> = {}): Record<string, ExerciseState> {
  const s = freshStates();
  for (const [oldKey, newKey] of Object.entries(V2_MAP)) {
    /* `newKey in s` because s starts from the types that exist: without it a
       stale mapping would write back a state for a retired type, which then
       goes to storage and out over sync. */
    if (old[oldKey] && newKey in s) s[newKey] = liftState(old[oldKey]);
  }
  for (const t of TYPES) if (old[t]) s[t] = liftState(old[t]);
  /*
   * And the keys that name which accepted answer they are about.
   *
   * A card accepting two spellings is scheduled once per spelling on every
   * question that shows one — "ar2en" for the first and "ar2en@1" for the
   * second — and the loop above walks the bare type names alone, because
   * that is all there was when it was written. So the second spelling's
   * schedule was dropped here, on every load, after every sync and on
   * every import: answered in the evening, gone by the morning, with the
   * card reading as never asked.
   *
   * Only the ones already written, and only for an exercise that still
   * exists. A key that has never been answered is deliberately absent —
   * which is what let this be turned on without touching any document —
   * so there is nothing to make up, and a key naming a retired exercise
   * goes the way a retired type's own state does.
   */
  for (const [key, st] of Object.entries(old)) {
    if (key in s || !st) continue;
    if (!TYPES.includes(typeOf(key))) continue;
    s[key] = liftState(st);
  }
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

/*
 * Which of an old card's fields belonged to the card rather than to its
 * own word.
 *
 * Until 0.138 a card *was* its first form, with the others in `subs`
 * beside it — so a stored card holds the word's fields and the card's
 * mixed together, and lifting it means telling them apart. Named from the
 * card's side because that list is the short one and the closed one: a
 * form may carry whatever a language declares, and every one of those
 * belongs to the word.
 */
const CARD_ONLY = new Set([
  "kind", "tags", "locked", "flags", "source", "fills", "ref", "name", "category",
  "drill", "uses", "note", "lines", "speakers", "you", "subs", "forms", "sceneKind",
]);

/* One of a stored card's forms, with nothing of the card left on it. */
const formPart = (f: Record<string, any>): Record<string, any> =>
  Object.fromEntries(Object.entries(f).filter(([k]) => !CARD_ONLY.has(k)));

function liftItem(stored: Record<string, any>, settings: Record<string, any> = {}) {
  /* A custom tag that is also a subtype, folded into the subtype — see
     subtype-tags.ts. In the card's own language, or the one this device
     is learning where an older card never said. */
  const it = liftSubtypeTagsIn(stored, stored.lang || settings.language || DEFAULT_LANGUAGE) || stored;
  return {
    ...it,
    tags: Array.isArray(it.tags) ? it.tags : [],
    locked: !!it.locked,
    flags: it.flags || [],
    /*
     * One list of forms, whichever shape the document was written in.
     *
     * formsOf reads a card stored the old way — the word on the card, the
     * rest in `subs` — as the list it always meant, and the fields that
     * belonged to the card are left where they are rather than copied onto
     * its first form.
     */
    forms: formsOf(it).map((f: Record<string, any>) => ({
      ...formPart(f),
      ...liftAnswers(f),
      recs: f.recs || [],
      s: liftStates(f.s),
    })),
    /* And the old shape goes, so nothing is stored twice and no reader can
       pick the stale half. */
    ar: undefined,
    en: undefined,
    lat: undefined,
    clips: undefined,
    slowClips: undefined,
    answers: undefined,
    met: undefined,
    ask: undefined,
    recs: undefined,
    subs: undefined,
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
    s: undefined,
  };
}

/*
 * Settings that no longer exist, dropped off anything loaded or imported.
 *
 * Every one of these was a control on how practice works — how long a
 * session runs, how many ways a form is drilled, which exercises are in
 * play, whether a hint opens by itself, how strictly typing is marked. They
 * are decisions the app makes now, so a value stored by a device that still
 * had the sliders must not quietly keep overriding them: a learner who once
 * set harakat to "must be typed" would otherwise carry that for ever with
 * nothing on any screen to say so, which is worse than either answer.
 *
 * The marking keys are asked of the language packs rather than listed, so a
 * pack that declares another one needs nothing here. `ignoreTashkeel` and
 * `skills` are older still, and were already being dropped.
 */
const RETIRED_SETTINGS = new Set([
  "sessionSize",
  "perItem",
  "newPerSession",
  "types",
  "cohesion",
  "warmup",
  "showHint",
  "ignoreTashkeel",
  "skills",
  /* Which kinds of card are practised at all — words, phrases, sentences,
     conversations. It outlived the screen that set it and went on hiding
     every card of a kind switched off long ago, which is the one thing
     this list exists to prevent. See isDrillable. */
  "kinds",
  /* How far the old numbers practice had ramped. It was where a sitting of
     made-up numbers started, and there is no such sitting any more: a
     range is a skill with a schedule of its own, and where a learner is up
     to is that schedule rather than a number in a preferences bag. */
  "numbersReach",
  ...Object.keys(defaultMarking()),
]);

/* Exported for the tests, which read a whole stored document through it —
   the one place a card written by any older build becomes the shape the
   rest of the app believes in. */
export function merge(parsedIn: Record<string, any> | null | undefined) {
  /* A stored or imported document never carries an account: the sync
     secret belongs to this device's sign-in, not to the data. */
  const { account: _dropped, ...parsed } = parsedIn || {};
  const incoming = parsed.settings || {};
  const settings = { ...EMPTY.settings };
  for (const [k, v] of Object.entries(incoming)) {
    if (!RETIRED_SETTINGS.has(k)) settings[k] = v;
  }
  return {
    ...EMPTY,
    ...parsed,
    settings,
    items: (parsed.items || []).map((it: Record<string, any>) => liftItem(it, settings)),
    tombstones: parsed.tombstones || {},
    parked: parsed.parked || {},
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

/*
 * How long the sound engine stays up after the last sound.
 *
 * A running context keeps the phone's audio hardware switched on, with a
 * thread rendering silence into it, for as long as the page is open — and
 * nothing ever stopped this one, so the first tick of the evening kept it
 * running until the app was closed. Ten seconds stays up through a run of
 * quick answers, which would otherwise wake it for every one, and lets it
 * rest while somebody reads, thinks or leaves the app open on the home
 * screen. Waking it is ctx()'s resume. The notes are timed against the
 * context's own clock, which stands still while it rests, so the first
 * one after a rest starts the moment it is awake and is never cut short.
 */
export const SOUND_REST_MS = 10000;
let restTimer: ReturnType<typeof setTimeout> | null = null;

function restLater(c: AudioContext) {
  if (restTimer) clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    restTimer = null;
    if (c.state === "running") c.suspend().catch(() => {});
  }, SOUND_REST_MS);
}

/* Exported so the smoke run can play one against a stand-in engine and
   watch it rest. */
export function sfx(kind: string) {
  if (!soundGain || !SOUNDS[kind]) return;
  // Rate limit, so a fast run of answers doesn't turn into a chirp storm.
  const t = Date.now();
  if (t - lastSound < 70) return;
  lastSound = t;
  try {
    const c = ctx();
    if (c) {
      SOUNDS[kind](c);
      restLater(c);
    }
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
/* A card's pictures, beside its recordings in the same database but in a
   store of their own: what "the recordings on this device" counts and
   downloads is recordings, and a picture among them would be counted as
   one. Version 2 of the database is the version that has it. */
const IMAGE_STORE = "images";
const DB_VERSION = 2;
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
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      let settled = false;
      const settle = (db: IDBDatabase | null) => {
        if (settled) return;
        settled = true;
        resolve(db);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
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
function idbRun(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void,
  storeName: string = DB_STORE,
): Promise<any> {
  return openClipDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(storeName, mode);
          const req = fn(tx.objectStore(storeName));
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

/*
 * Every recording on this device, in one question.
 *
 * Asked rather than worked out card by card: what a session may ask turns
 * on it while the app is offline, so it has to be cheap enough to ask
 * again whenever the answer could have moved — at launch, when the
 * connection goes, and after anything has been downloaded. One key listing
 * does the whole store; the text store behind it is listed too, because a
 * browser without IndexedDB keeps its recordings there and a learner on
 * one is exactly who should not be asked a question they cannot hear.
 */
async function localClipIds(): Promise<Set<string>> {
  const ids: Set<string> = new Set();
  const keys = (await idbRun("readonly", (st) => st.getAllKeys())) || [];
  for (const k of keys) if (typeof k === "string") ids.add(k);
  try {
    const listed = await window.storage.list("audio-");
    for (const k of (listed && listed.keys) || []) ids.add(String(k).slice("audio-".length));
  } catch (e) {
    /* No text store, or nothing in it. */
  }
  return ids;
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

/* ---- pictures ----

   A card's pictures, kept on this device the way its recordings are: in
   IndexedDB by hash, fetched from the server the first time and read from
   here after that, so a picture seen once can be shown offline. No text-
   store fallback, unlike recordings — a picture is several times the size
   of a recording and would fill it — so a browser without IndexedDB
   fetches each one while it is online, and offline the exercises that
   need one are not dealt (see canSeeHere). A fetch this session made is
   remembered in memory either way, so one question does not ask twice. */

const IMAGES_HELD: Map<string, Promise<Blob | null>> = new Map();

async function localImageIds(): Promise<Set<string>> {
  const ids: Set<string> = new Set();
  const keys = (await idbRun("readonly", (st) => st.getAllKeys(), IMAGE_STORE)) || [];
  for (const k of keys) if (typeof k === "string") ids.add(k);
  return ids;
}

function imageBlob(hash: string): Promise<Blob | null> {
  const held = IMAGES_HELD.get(hash);
  if (held) return held;
  const got = (async () => {
    const here = await idbRun("readonly", (st) => st.get(hash), IMAGE_STORE);
    if (here) return here as Blob;
    try {
      const r = await API.getImage(hash);
      if (r && r.data) {
        const blob = base64ToBlob(r.data);
        await idbRun("readwrite", (st) => st.put(blob, hash), IMAGE_STORE);
        return blob;
      }
    } catch (e) {
      /* Not reachable now; the next question asks again. */
    }
    return null;
  })();
  /* A miss is not remembered, so a picture that could not be fetched
     offline is fetched once the connection is back. */
  got.then((b) => { if (!b) IMAGES_HELD.delete(hash); });
  IMAGES_HELD.set(hash, got);
  return got;
}

/* Fetch whatever pictures are not here yet, a few at a time — before a
   session starts, so its picture questions do not wait on the network. */
async function warmImages(hashes: Iterable<string>, concurrency = 3) {
  const queue = [...new Set(hashes)];
  const worker = async () => {
    for (;;) {
      const h = queue.shift();
      if (h === undefined) return;
      await imageBlob(h).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
}

/* One of a card's pictures, drawn once it is here. Its object URL is made
   for this picture and let go of when it leaves the screen. The alt text
   is deliberately not the word: it is what is being asked. */
function CardPicture({ hash, className = "", alt = "A picture of what is being asked about" }: {
  hash: string;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState("");
  const [lost, setLost] = useState(false);
  useEffect(() => {
    let live = true;
    let made = "";
    setUrl("");
    setLost(false);
    imageBlob(hash).then((b) => {
      if (!live) return;
      if (!b) { setLost(true); return; }
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [hash]);
  if (lost) return <span className={`at-picture lost ${className}`}>The picture isn&rsquo;t on this device yet.</span>;
  if (!url) return <span className={`at-picture ${className}`} aria-busy="true" />;
  return <img className={`at-picture ${className}`} src={url} alt={alt} />;
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

/*
 * The ten figures a language writes numbers in, as keys: ٠ to ٩.
 *
 * Up whenever an answer is to be written in them, without being asked
 * for. A laptop keyboard has no ٤ on it and a phone's number pad has only
 * 4, so for most learners these keys are the only way to write the answer
 * at all — which is not a thing to hide behind a button.
 *
 * Laid out as a phone's keypad, three by four: a row of ten across the
 * screen made every key a sliver. The bottom row is clear, a figure,
 * backspace — and for a clock, colon, a figure, backspace, with clear on a
 * row of its own beneath.
 *
 * Which figure sits on which of the ten keys is shuffled for each
 * question. In counting order the pad answered for the learner: the
 * fourth key was ٤ whether or not they knew ٤, and the question became
 * where to tap rather than which figure to pick. The shape stays the
 * same; only the figures move, and they stay put while the question is up.
 */
/* The figures a language writes numbers in, by name and with three of
   them: "Eastern Arabic numerals (١٢٣)". */
const ownNamed = (lang: Lang): string => {
  const name = lang.numeralsLabel || "its own numerals";
  return lang.numerals ? `${name} (${lang.numerals(123)})` : name;
};

function NumeralPad({ lang, clock, deal, onKey, onBack, onClear }: {
  lang: Lang;
  clock: boolean;
  /* The question the pad is up for; a new one deals the figures again. */
  deal: number;
  onKey: (key: string) => void;
  onBack: () => void;
  onClear: () => void;
}) {
  const write = lang.numerals;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const order = useMemo(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), [deal]);
  if (!write) return null;
  const figure = (d: number) => {
    const ch = String(write(d) || "");
    return (
      <button key={d} type="button" className="at-key" lang={lang.id} onClick={() => onKey(ch)}>
        {ch}
      </button>
    );
  };
  const back = (
    <button key="back" type="button" className="at-key util" onClick={onBack} aria-label="Backspace">
      ⌫
    </button>
  );
  const clear = (
    <button key="clear" type="button" className={`at-key util${clock ? " wide" : ""}`} onClick={onClear}>
      clear
    </button>
  );
  return (
    <div className="at-kb at-numpad" data-el="numeral-pad" dir="ltr">
      {order.slice(0, 9).map(figure)}
      {clock ? (
        <button key="colon" type="button" className="at-key" onClick={() => onKey(":")} aria-label="Colon">
          :
        </button>
      ) : (
        clear
      )}
      {figure(order[9])}
      {back}
      {clock && clear}
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

/*
 * A spelling with the mistakes marked on it.
 *
 * The same paragraph Arabic draws, cut into the stretches spellRuns came
 * back with — so the word keeps its typeface, its size and its direction,
 * and what changes is only that some of its letters are pointed at. Drawn
 * as <mark>, which is what marking a run of text for attention is, so the
 * highlight reaches a screen reader as well as an eye.
 *
 * `className` rather than `kind`: this stands in for two different things
 * on the answer screen — the box the learner typed into, and the answer
 * printed underneath — and each keeps the look of what it replaces.
 */
function Spelt({ runs, lang, name, className }: {
  runs: Run[];
  lang?: Lang;
  name?: string;
  className: string;
}) {
  const L = lang || LANGUAGES[DEFAULT_LANGUAGE];
  return (
    <p
      className={className}
      data-el={name}
      lang={L.id}
      dir={L.direction}
      style={{ fontFamily: L.fontStack, direction: L.direction, ...scriptVars(L) }}
    >
      {runs.map((run, i) =>
        run.wrong ? (
          <mark className="at-spellwrong" key={i}>
            {run.text}
          </mark>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
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

/**
 * What a question plays, and what it plays afterwards.
 *
 * A card's own recordings, for nearly everything. A time is the one
 * exception: it is said as its hour and then its minutes, so the first
 * group is what the button starts and the rest follow it.
 */
function audibleOf(unit: Form): any[] {
  const seq = (unit as Record<string, any>).recSeq as string[][] | undefined;
  if (!seq || !seq.length) return unit.recs || NO_RECS;
  const first = (seq[0] || [])[0];
  return first ? [{ id: first, label: "", speed: "" }] : NO_RECS;
}

function chainOf(unit: Form): string[] {
  const seq = (unit as Record<string, any>).recSeq as string[][] | undefined;
  if (!seq || seq.length < 2) return [];
  return seq.slice(1).map((group) => (group || [])[0]).filter(Boolean);
}

function AudioPrompt({ recs, autoPlay, lead = "regular", after }: {
  recs?: any[];
  autoPlay?: boolean;
  lead?: "regular" | "slow";
  /**
   * Recordings to play straight after the one that was started.
   *
   * The one place two clips are ever joined: a time may be its hour and
   * its minutes said one after the other, because a teacher records the
   * words and not the nine hundred times a clock can show. Played in
   * order rather than stitched — the join is where a dialect lives, and a
   * stitched clip teaches the wrong sound.
   */
  after?: string[];
}) {
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState("idle");
  const audioRef: React.MutableRefObject<HTMLAudioElement | null> = useRef(null);
  const urlRef = useRef("");
  /* Whether a clip is finishing so the next can start. Held apart from
     the state because the browser reports the gap between two clips as a
     pause, and a pause between them is not the player stopping. */
  const chaining = useRef(false);
  const list = recs || NO_RECS;
  /* Which recordings this is showing, as one string, so the reset below
     fires when any of them changes and not only the first. */
  const signature = list.map((r) => r.id).concat(after || []).join("|");

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
      /* One clip, or a clip and then the rest of them. */
      const queue = (after || []).slice();
      el.onended = async () => {
        const next = queue.shift();
        if (!next) {
          chaining.current = false;
          setState("idle");
          return;
        }
        chaining.current = true;
        const nextUrl = await clipUrl(next);
        if (!nextUrl) {
          chaining.current = false;
          setState("idle");
          return;
        }
        releaseUrl();
        urlRef.current = nextUrl;
        el.src = nextUrl;
        try {
          await el.play();
        } catch (e) {
          chaining.current = false;
          setState("idle");
        }
      };
      /* Paused by anything else — the other button taking the element, a
         headset, the phone's own controls — reads the same as pausing here.
         Only ever a step down from playing, so it cannot undo the state a
         moment before the clip starts. */
      el.onpause = () => {
        if (chaining.current) return;
        setState((v) => (v === "playing" ? "idle" : v));
      };
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
  /* A number in the language's own figures, which read left to right
     whatever the script around them does. */
  if (field === "numeral")
    return (
      <p className="at-en" dir="ltr" data-el={name}>
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
  /*
   * A text reads as prose: one paragraph of its sentences, in order, with
   * nobody's name over any of them — and the pronunciation and the meaning,
   * where they are asked for, as a paragraph each underneath, so the whole
   * of each can be read the way the whole of the text is. A line's
   * recording, where there is one, is its own button under all three.
   */
  if (isText(card)) {
    const join = (field: "ar" | "lat" | "en") => proseOf(lines, field);
    const heard = lines.filter((l) => (l.recs || []).length > 0);
    return (
      <div className="at-scene prose" data-el="scene">
        <Arabic text={join("ar")} kind="phrase" lang={lang} name="scene-text" />
        {said && join("lat") && (
          <p className="at-scenemeaning" data-el="scene-text-said">
            {join("lat")}
          </p>
        )}
        {meanings && join("en") && (
          <p className="at-scenemeaning" data-el="scene-text-meaning">
            {join("en")}
          </p>
        )}
        {heard.length > 0 && (
          <div className="at-row" data-el="scene-text-recordings">
            {heard.map((l) => (
              <AudioPrompt key={l.id} recs={l.recs} lead={leadSpeed(l)} />
            ))}
          </div>
        )}
      </div>
    );
  }
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
function MatchGrid({
  words,
  meanings,
  wordTags = [],
  meaningTags = [],
  lang,
  askedId,
  onChange,
  onPairs,
  checked,
  field = "en",
  heard = false,
}: {
  words: Form[];
  meanings: string[];
  /**
   * What a tile says it is — "f.", "pl." — where anything. One per tile, in
   * the order of the column it belongs to, and empty on nearly all of them:
   * only two forms of one card in the same grid are told apart this way.
   * See kinTags.
   */
  wordTags?: string[];
  meaningTags?: string[];
  lang: Lang;
  askedId: string;
  onChange: (v: string) => void;
  /** The whole pairing, once complete — every word is marked on it. */
  onPairs?: (pairs: Record<string, string>) => void;
  checked?: boolean;
  /**
   * What the right-hand column is, and so what a word is paired against:
   * its meaning, or — in the grid of recordings — the word in the script.
   */
  field?: "en" | "ar";
  /**
   * Whether the words are heard rather than read: a play button on each
   * tile where the word would be. The tile is otherwise the same tile,
   * tapped the same way — so tapping it plays it **and** does what a tap
   * on a word does, freeing a pairing included. That was the owner's call:
   * one card that behaves like every other card, over a second target on
   * it that would play without touching the pairing.
   */
  heard?: boolean;
}) {
  /*
   * Which meaning is against which word. Keyed by word id, so a meaning can
   * be moved and the grid never holds the same one twice — and holding the
   * meaning by **where it is** rather than by what it says, which is the
   * whole of a bug learners reported four times in one evening.
   *
   * Two tiles reading alike are refused before the grid is built, so this
   * should never arise; it did, because the guard read the cards as the
   * teacher wrote them and the tiles show them narrowed. Held by text, two
   * such tiles were one tile: pairing a word with either lit up both,
   * tapping the second freed the first instead of taking it, and the grid
   * could not be finished at all. Both learners pressed "I don't know".
   *
   * So the grid is now proof against it rather than merely spared it. A
   * place is a place whatever is written on it, and two guards against one
   * bad question is the right number when the cost of the second is a
   * number instead of a string.
   */
  const [pairs, setPairs] = useState<Record<string, number>>({});
  /*
   * Which tile is picked up and waiting for its other half — a side and a
   * place on it, never merely a word.
   *
   * A pair is started from either column. A learner reading down the
   * meanings and spotting the one they know should be able to tap it and
   * then its word; making them cross to the other side first is a rule
   * about the grid's insides rather than about the language, and nothing on
   * the screen ever said it was there. Which column a pair was begun from
   * makes no difference to what it is or how it is marked.
   */
  type Held = { col: "word"; id: string } | { col: "meaning"; at: number };
  const [held, setHeld] = useState<Held | null>(null);
  const heldWord = held && held.col === "word" ? held.id : null;
  const heldMeaning = held && held.col === "meaning" ? held.at : null;

  /* `undefined` and not falsiness: the first tile is number 0, and a grid
     whose first meaning counted as "unpaired" would never finish. */
  const pairedAt = (id: string) => (pairs[id] === undefined ? null : pairs[id]);
  const takenBy = (at: number) => words.find((w) => pairs[w.id] === at);
  const done = words.every((w) => pairedAt(w.id) !== null);
  const meaningFor = (id: string) => {
    const at = pairedAt(id);
    return at === null ? "" : String(meanings[at] || "");
  };

  /* Nothing is reported until every word has a meaning: the question is the
     whole grid, and half of one is not an answer to it. What goes up is the
     meaning put against the first word, which is what the answer screen
     talks about, and the whole pairing beside it, which is what every word
     in the grid is marked on. */
  useEffect(() => {
    /* What goes out is the meaning itself, not where it sat: the answer
       screen and the marking talk about words and meanings, and neither
       has any business knowing the order the tiles came up in. */
    onChange(done ? meaningFor(askedId) : "");
    if (onPairs) {
      onPairs(
        done
          ? Object.fromEntries(words.map((w) => [w.id, meaningFor(w.id)]))
          : {},
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, done, askedId]);

  /* The two taps are one gesture written twice, once for each column: a
     tile already paired is freed and left held, a tile tapped while the
     other column holds one completes the pair, and anything else is picked
     up — or put down again, where it was already held. */
  const tapWord = (id: string) => {
    if (checked) return;
    if (pairedAt(id) !== null) {
      setPairs((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      setHeld({ col: "word", id });
      return;
    }
    if (heldMeaning !== null) {
      const at = heldMeaning;
      setPairs((p) => ({ ...p, [id]: at }));
      setHeld(null);
      return;
    }
    setHeld((h) => (h && h.col === "word" && h.id === id ? null : { col: "word", id }));
  };

  const tapMeaning = (at: number) => {
    if (checked) return;
    const owner = takenBy(at);
    /* Tapping a meaning already spoken for frees it, which is the only way
       back from a pairing made by mistake that does not need a third
       gesture to undo — and leaves it held, as freeing a word does, so the
       meaning can be given to another word with the next tap. */
    if (owner) {
      setPairs((p) => {
        const next = { ...p };
        delete next[owner.id];
        return next;
      });
      setHeld({ col: "meaning", at });
      return;
    }
    if (heldWord !== null) {
      const id = heldWord;
      setPairs((p) => ({ ...p, [id]: at }));
      setHeld(null);
      return;
    }
    setHeld((h) => (h && h.col === "meaning" && h.at === at ? null : { col: "meaning", at }));
  };

  const numberOf = (id: string) =>
    words.filter((w) => pairedAt(w.id) !== null).findIndex((w) => w.id === id) + 1;

  /* One player for the whole grid, so a second tile tapped stops the
     first rather than talking over it. Which tile it is playing is what
     turns that tile's button to Pause. */
  const [sounding, setSounding] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const clip = useRef("");
  /* A fresh element per clip, the old one silenced and cut loose first:
     reusing one, the pause of the clip being stopped arrived after the
     next clip's handlers were on it, and turned the new tile's button
     back to Play while it played. */
  const hush = () => {
    const el = player.current;
    if (el) {
      el.onended = el.onpause = el.onerror = null;
      el.pause();
    }
    player.current = null;
    if (clip.current) URL.revokeObjectURL(clip.current);
    clip.current = "";
  };
  useEffect(() => hush, []);
  const sound = async (w: Form) => {
    const recs = w.recs || [];
    /* The ordinary take: a grid is the word at speed, among others. */
    const rec = recs.find((r) => r.speed !== "slow") || recs[0];
    hush();
    setSounding(null);
    if (!rec) return;
    const el = new Audio();
    player.current = el;
    setSounding(w.id);
    const url = await clipUrl(rec.id);
    /* Another tile tapped while this one was loading has the player now. */
    if (player.current !== el) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    if (!url) {
      setSounding((v) => (v === w.id ? null : v));
      return;
    }
    clip.current = url;
    el.src = url;
    el.onended = () => setSounding((v) => (v === w.id ? null : v));
    el.onpause = () => setSounding((v) => (v === w.id ? null : v));
    el.onerror = () => setSounding((v) => (v === w.id ? null : v));
    try {
      await el.play();
    } catch (e) {
      setSounding((v) => (v === w.id ? null : v));
    }
  };
  /* Checked, a sound tile still plays: it is how the words are gone over
     once the grid is marked. */
  const tapTile = (w: Form) => {
    if (heard) sound(w);
    tapWord(w.id);
  };
  /* What the tile should have been paired with, under one paired wrong. */
  const wantedOf = (w: Form) => String((field === "ar" ? w.ar : w.en) || "");

  return (
    <div className="at-match" data-el="answer-match">
      <div className="at-matchcol">
        {words.map((w, i) => {
          const mine = meaningFor(w.id);
          const right = checked && !!mine && mine === wantedOf(w);
          return (
            <button
              type="button"
              key={w.id}
              data-el="match-word"
              className={`at-matchtile${heldWord === w.id ? " on" : ""}${mine ? " paired" : ""}${
                checked ? (right ? " right" : " wrong") : ""
              }`}
              aria-pressed={heldWord === w.id}
              aria-label={heard ? `Recording ${i + 1}${mine ? `, pair ${numberOf(w.id)}` : ""}` : undefined}
              onClick={() => tapTile(w)}
            >
              {/* Always there, empty until paired: a number arriving in
                  space nobody kept for it pushed the word along. */}
              {mine ? (
                <span className="at-matchnum">{numberOf(w.id)}</span>
              ) : (
                <span className="at-matchnum empty" aria-hidden="true" />
              )}
              <span className="at-matchword">
                {heard ? (
                  /* Drawn as the play button drawn wherever a recording
                     is, but not a button of its own: the whole tile is the
                     button, and one inside another is not allowed. */
                  <span className="at-clipplay at-matchplay" data-el="match-sound" aria-hidden="true">
                    <Icon name={sounding === w.id ? "pause" : "play"} />
                  </span>
                ) : (
                  <Arabic text={w.ar} kind="word" lang={lang} />
                )}
                {/* Which form of its card this is, where another form of
                    the same card is in the grid and nothing else would say
                    which meaning belongs to which. */}
                {wordTags[i] ? (
                  <span className="at-matchtag" data-el="match-form-tag">{wordTags[i]}</span>
                ) : null}
                {/* What it should have been, under a word paired wrong: the
                    verdict below speaks of the first word only, and a grid
                    of five has four others to be told about. */}
                {checked && !right ? (
                  field === "ar" ? (
                    <span className="at-matchfix ar">
                      <Arabic text={w.ar} kind="word" lang={lang} />
                    </span>
                  ) : (
                    <span className="at-matchfix">{w.en}</span>
                  )
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="at-matchcol">
        {meanings.map((m, at) => {
          const owner = takenBy(at);
          const right = checked && owner && wantedOf(owner) === m;
          return (
            <button
              type="button"
              /* By where it is, not by what it says: two tiles reading
                 alike are two tiles, and keying them on their text made
                 React treat them as one. */
              key={at}
              data-el="match-meaning"
              /* Held looks the same on both sides, because it is the same
                 thing: a tile waiting for its other half. */
              className={`at-matchtile${field === "ar" ? "" : " en"}${heldMeaning === at ? " on" : ""}${
                owner ? " paired" : ""
              }${checked && owner ? (right ? " right" : " wrong") : ""}`}
              aria-pressed={heldMeaning === at}
              onClick={() => tapMeaning(at)}
            >
              {owner ? (
                <span className="at-matchnum">{numberOf(owner.id)}</span>
              ) : (
                <span className="at-matchnum empty" aria-hidden="true" />
              )}
              {/* The meaning, and — only where two forms of one card are up
                  — which of them it belongs to. Said on this side as well
                  as on the words, because it is the meanings a learner
                  cannot tell apart: the tag on the word alone would name
                  the form without saying which English is its. */}
              {field === "ar" ? (
                /* The words in the script, as the word grid shows them on
                   its left. */
                <span className="at-matchword">
                  <Arabic text={m} kind="word" lang={lang} />
                  {meaningTags[at] ? (
                    <span className="at-matchtag" data-el="match-form-tag">{meaningTags[at]}</span>
                  ) : null}
                </span>
              ) : meaningTags[at] ? (
                <span className="at-matchword">
                  <span>{m}</span>
                  <span className="at-matchtag" data-el="match-form-tag">{meaningTags[at]}</span>
                </span>
              ) : (
                m
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param field  Which side of the card the tiles are: the script, or the
 *   meaning. A question that gives the meaning and asks for the word puts
 *   the script up; the one that gives the word and asks what it means puts
 *   the meanings up, in the interface font — an English tile set in the
 *   script's size and direction is a sentence pretending to be a word.
 */
function TextChoices({ options, lang, value, onChange, disabled, kind = "phrase", field = "ar" }: {
  options: any[];
  lang: Lang;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  kind?: string;
  field?: string;
}) {
  const textOf = (option: any) => String((option && option[field]) || "");
  return (
    <div className="at-replies" data-el="answer-choices">
      {options.map((option) => {
        const text = textOf(option);
        return (
          <button
            type="button"
            key={option.id}
            className={`at-reply${value === text ? " on" : ""}${kind === "word" ? " word" : ""}${
              field === "en" ? " en" : ""
            }`}
            aria-pressed={value === text}
            disabled={disabled}
            onClick={() => onChange(text)}
          >
            {field === "en" ? text : <Arabic text={text} kind={kind} lang={lang} />}
          </button>
        );
      })}
    </div>
  );
}

/*
 * Four pictures, one of them the answer — "Listen → picture". Each tile is
 * a button holding a card's first picture, and what it answers with is
 * that picture's hash, which is what checkAnswer looks for on the card.
 * Named by position for a screen reader, since naming them by what they
 * show would be reading the answer out.
 */
function PictureChoices({ options, value, onChange, disabled }: {
  options: any[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="at-picchoices" data-el="answer-choices">
      {options.map((option, i) => {
        const hash = String((option && Array.isArray(option.images) && option.images[0]) || "");
        return (
          <button
            type="button"
            key={option.id}
            className={`at-picchoice${value === hash ? " on" : ""}`}
            aria-pressed={value === hash}
            aria-label={`Picture ${i + 1}`}
            disabled={disabled}
            onClick={() => onChange(hash)}
          >
            <CardPicture hash={hash} alt="" />
          </button>
        );
      })}
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
  /* Which of the four is being reported, and what the learner said about
     it. Picking does not send: Send does. */
  const [picked, setPicked] = useState<FlagKind | null>(null);
  const [note, setNote] = useState("");

  function close() {
    setOpen(false);
    setPicked(null);
    setNote("");
  }

  const chosen = FLAG_KINDS.find((k) => k.key === picked);
  /* The words are welcome on every option and owed on one: "Something
     else" covers whatever the other three don't, so on its own it says
     nothing anybody could act on. */
  const needsNote = !!chosen && !!chosen.asks;
  const ready = !!chosen && (!needsNote || !!note.trim());

  function send() {
    if (!chosen || !ready) return;
    if (chosen.fixes && !ok && !overridden) onOverride();
    onFlag(chosen.key, note.trim());
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
          </div>
        }
      >
        <Button variant="primary" data-el="continue-button" onClick={onContinue}>
          Continue
        </Button>
      </StickyFoot>

      {/* A screen of its own rather than a panel over the foot. The panel
          had four cards, a box and two buttons to fit into whatever the
          keyboard left of a phone, and scrolled inside itself to do it;
          a screen has the whole window, the way out where every other
          screen keeps it, and Send at its foot. */}
      {open && (
        <Screen
          title="Flag a problem"
          onBack={close}
          rise
          backLabel="Back to the question"
          footer={
            <Button variant="primary" disabled={!ready} onClick={send}>
              Send
            </Button>
          }
        >
          <div className="at-flagmenu" data-el="flag-menu">
            {/* Why it is worth the half minute. Reporting a bad question
                is a favour done for the next person to meet it, and
                nothing on the screen said so. */}
            <p className="at-flagmenu-lede" data-el="flag-menu-lede">
              Any issue or feedback you report helps us improve the app.
            </p>
            <div className="at-flagopts">
              {FLAG_KINDS.map((k) => (
                <button
                  key={k.key}
                  className={`at-flagopt${picked === k.key ? " on" : ""}`}
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
              ))}
            </div>
            {/* One box for all four, under them: whichever is picked, there
                may be more to say, and a box that belonged to one option
                said there was only room for words on that one. It asks
                for them outright only where they are owed. */}
            <div className="at-flagnote" data-el="flag-note">
              <label className="at-flagnote-label" htmlFor="flag-note-input">
                Tell us what happened
                <span className="at-flagnote-need" data-el="flag-note-need">
                  {needsNote ? "Required" : "Optional"}
                </span>
              </label>
              <textarea
                id="flag-note-input"
                data-el="flag-note-input"
                className="at-input at-flagtext"
                rows={4}
                maxLength={FLAG_NOTE_MAX}
                placeholder="The recording plays the wrong word…"
                value={note}
                aria-required={needsNote}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </Screen>
      )}
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

/*
 * The courses and decks a student holds, kept on the device.
 *
 * Their *cards* were always kept — those are folded into the document —
 * but everything framing them was held in memory alone and went with every
 * launch. So opening the app without a connection put an error where the
 * course list should be, took away the deck tiles a learner practises
 * from, and told an enrolled student with nothing due yet to go and join a
 * course.
 *
 * The version is kept with them, which is the other half of the saving:
 * the server answers "nothing has changed" to a check that says which
 * version it already has, and without one every launch pulled every deck
 * and every card in full.
 */
const MATERIAL_KEY = "arabic-trainer:material";

interface HeldMaterial {
  courses: Course[];
  decks: Deck[];
  /*
   * The teachers' numbers, kept with the courses and for the same reason.
   *
   * The *cards* a system becomes are in the document and survive a launch
   * anyway; the system itself is what a skill's question is drawn from,
   * and a device that had to ask the server for it would open with every
   * range unaskable until the first refresh came back. Which is offline,
   * every time, for as long as the connection is out.
   */
  systems: unknown[];
  version: string;
  at: Millis;
}

function loadMaterial(handle?: string | null): HeldMaterial | null {
  if (!handle) return null;
  try {
    const raw = localStorage.getItem(MATERIAL_KEY);
    const held = raw ? JSON.parse(raw) : null;
    /* Whose it is matters: signing in as somebody else must not show them
       the last person's courses. */
    if (!held || held.handle !== handle) return null;
    return {
      courses: Array.isArray(held.courses) ? held.courses : [],
      decks: Array.isArray(held.decks) ? held.decks : [],
      systems: Array.isArray(held.systems) ? held.systems : [],
      version: String(held.version || ""),
      at: Number(held.at) || 0,
    };
  } catch (e) {
    return null;
  }
}

function saveMaterial(
  handle: string,
  held: { courses: Course[]; decks: Deck[]; systems: unknown[]; version: string },
) {
  try {
    localStorage.setItem(
      MATERIAL_KEY,
      JSON.stringify({ handle, ...held, at: Date.now() }),
    );
  } catch (e) {
    /* Private browsing, or no room. The app behaves as it did before this
       existed: it asks the server on every launch. */
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

/*
 * The countdown and the bar on a timed session.
 *
 * A component of its own so that the clock is all that redraws as it runs.
 * It used to tick in the trainer itself, twice a second, which rebuilt the
 * whole session screen — the question, the answer box, the keys — to move
 * one number, and went on doing it while paused. Now it wakes once a
 * second, just after the number changes, and not at all while paused.
 * When the time is up is the trainer's business; this only shows it.
 */
function SessionClock({ startedAt, endsAt, pausedAt }: {
  startedAt: Millis;
  endsAt: Millis;
  pausedAt: Millis;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (pausedAt) return undefined;
    let id: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      const left = endsAt - Date.now();
      if (left <= 0) return;
      /* To just past the next whole second, which is when the number
         changes. An interval drifts a little each time and showed the
         previous second for most of the next. */
      id = setTimeout(() => {
        tick((n) => n + 1);
        wake();
      }, (left % 1000) + 20);
    };
    wake();
    return () => clearTimeout(id);
  }, [endsAt, pausedAt]);
  const clock = pausedAt || Date.now();
  const left = Math.max(0, Math.ceil((endsAt - clock) / 1000));
  const span = endsAt - startedAt;
  const done = span > 0 ? Math.min(100, ((clock - startedAt) / span) * 100) : 100;
  return (
    <>
      <span className="at-count" data-el="session-count">
        {`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
      </span>
      <div className="at-progress" data-el="session-progress">
        <i style={{ width: `${done}%` }} />
      </div>
    </>
  );
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
  /* Whether there is a connection, as a piece of state so that everything
     showing it re-renders when it changes. */
  const offline = useOffline();
  /* How many reported problems are waiting for one, so the corner menu can
     say so rather than leaving someone to wonder whether it went. */
  const [toSend, setToSend] = useState(0);
  /* Whether to offer installing the app, which on iOS is what keeps its
     data from being cleared after a week away. */
  const install = useInstallOffer();
  /* And which recordings are here, for the same reason and pushed into the
     same kind of module flag: offline, it decides whether a listening
     exercise can be asked at all. Null until the first look. */
  const [audible, setAudible] = useState<Set<string> | null>(null);
  setAudibleClips(audible);
  /* And which pictures are here, for the picture exercises — the same
     question, asked at the same moments. */
  const [visible, setVisible] = useState<Set<string> | null>(null);
  setVisibleImages(visible);
  /* Pushed into its own flag beside the recordings, and for the same
     reason: the memos below run through enabledTypes, which has to know
     both before they do. */
  setOfflineNow(offline);
  /*
   * Ask the device again what it holds.
   *
   * Declared up here beside the state rather than with the effect that
   * first calls it, because the sync below reaches for it too — every
   * recording it downloads is one more question that can be asked without
   * a connection.
   */
  const refreshAudible = useCallback(() => {
    localClipIds()
      .then((ids) => setAudible(ids))
      .catch(() => {
        /* Leave the last answer standing; a failed listing is not evidence
           that the recordings have gone. */
      });
    /* The pictures too: whatever brought recordings down may have brought
       pictures with it, and the question is the same one. */
    localImageIds()
      .then((ids) => setVisible(ids))
      .catch(() => {});
  }, []);
  /* What this device was last told about the courses, read once at the
     first render. It is what the three pieces of state below open with, so
     a launch with no connection shows the courses rather than an error. */
  const heldMaterial = useRef(loadMaterial(account && account.handle)).current;
  const [myCourses, setMyCourses] = useState<Course[]>(
    heldMaterial ? heldMaterial.courses : [],
  );
  /* An empty list means two different things until the first pull comes
     back: "not in any course" and "not asked yet". They look the same and
     read very differently to someone who has joined one.

     A device that has been told before knows the answer without asking,
     which is the whole point of keeping it; and a check that *fails* no
     longer counts as having been told, which it used to. */
  const [coursesKnown, setCoursesKnown] = useState(!!heldMaterial);
  /* A deck the person asked to practice from the Courses tab, handed to the
     cards tab once it is on screen. */
  const [deckWanted, setDeckWanted] = useState<string | null>(null);
  /* The teachers' numbers, read back through the same narrowing the wire
     goes through — what was kept is a copy of what arrived, and an older
     build's copy is not this build's shape. */
  const [heldSystems, setSystems] = useState<SystemSet[]>(() =>
    pairSystems(heldMaterial ? heldMaterial.systems : []),
  );
  const [courseDecks, setCourseDecks] = useState<Deck[]>(
    heldMaterial ? heldMaterial.decks : [],
  );
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState("");

  /* Teaching is a role on a course, so it has to be asked about — and the
     material request answers it, so it is no longer asked twice. */
  const [building, setBuilding] = useState(false);
  const [showingSaved, setShowingSaved] = useState(false);
  const [editingSaved, setEditingSaved] = useState<SavedSession | null>(null);
  /* Which language the session on screen is drawn from: a language id, ""
     for all of them at once, or null for never asked — which is what keeps
     the picker from opening with an answer already marked. It stays on the
     last answer so "Keep going" means more of the same. */
  /* And whether the question is being put. */
  /*
   * The version of course material this device last received.
   *
   * It used to be per launch, so the first check after opening was always
   * a full one: every deck and every card the student holds, in the
   * largest request the app makes, to be told in almost every case that
   * none of it had moved. It is kept with the courses now and handed to
   * that first check, which the server answers with "unchanged" and a few
   * bytes.
   *
   * Only where the cards it describes are actually here, though. The
   * version is a claim about the document, and a document that has been
   * replaced — an import, a reset, a device wiped and signed back in —
   * makes a liar of it, leaving a student whose course cards never arrive.
   * So the seeding waits for the document to load and asks it, in the
   * effect below.
   */
  const materialVersion = useRef("");
  /* So the seeding happens once, however often the launch effect runs. */
  const materialSeeded = useRef(false);
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
  /* No value, only a setter: the timer below calls it once, when a timed
     session's time is up, purely to re-render so the render sees that it
     is. Nothing reads the number itself. */
  const [, setNow_] = useState(0);
  const [qi, setQi] = useState(0);
  /* Each question starts at the top. A long one — a scene, a word with its
     relatives laid out under the answer — is read scrolled down, and the
     next question used to arrive at that same depth, its prompt somewhere
     above the fold. Keyed on the question's place only while a session is
     running, so nothing outside one moves. */
  useScrollTop(session ? `q:${qi}` : null);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState<any | null>(null);
  const [pairs, setPairs] = useState<any[]>([]); // minimal pairs for the answered card
  /* The grid as it was paired: each word's id against the meaning put to
     it. Every word in a grid is marked on this, not only the first. */
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState(false);
  const [overridden, setOverridden] = useState(false);
  /*
   * The benefit of the doubt, once per question.
   *
   * An answer one letter out of a word long enough for that to be a slip
   * is not marked at all: the question stays on the screen and is asked
   * again, and this is what stops it being asked a third time. See
   * `submit` for the rule and for why the letter is not pointed at while
   * the second try is still to come.
   *
   * Once per question and not once per session, because it is a statement
   * about *this* answer to *this* question. Cleared with everything else
   * the question carries, in resetExercise.
   */
  const [retried, setRetried] = useState(false);
  const [flaggedNow, setFlaggedNow] = useState(false);
  /* The question the learner said was too easy, whose form has already
     been moved up its ladder — so the grading on Continue leaves that
     form's schedule alone rather than rewarding or lapsing an answer the
     learner has overruled. The question itself rather than a yes: a
     session left without pressing Continue would otherwise carry a yes
     into the next one and skip its first answer. */
  const [easedFor, setEasedFor] = useState<object | null>(null);
  /*
   * The hint, and whether it was leant on.
   *
   * Three states rather than two: null is "the learner has not said", and
   * the setting decides — but only once the exercise is known, because a
   * hint that is the answer said another way is never opened by itself.
   * Writing the setting in here when the question was set up could not
   * make that distinction: resetExercise runs alongside the move to the
   * next question and does not know what that question will be.
   */
  const [hintOpen, setHintOpen] = useState<boolean | null>(null);
  /* And whether it was ever on the screen for this question, which
     pressing the button says either way: opening puts it up, closing means
     it was up. Kept apart from hintOpen so that taking a look and then
     putting it away is still taking a look. */
  const [hintUsed, setHintUsed] = useState(false);
  /* And whether it was up at the moment the answer went in, which is the
     only moment that bears on the mark. */
  const [hintAtAnswer, setHintAtAnswer] = useState(false);
  /* What the reader has asked to see of a scene they are reading through.
     Two, because they are two different admissions — needing to hear it
     and needing to be told what it means — and a reader often wants one
     without the other. Cleared with everything else between questions. */
  const [showSaid, setShowSaid] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  /* Closed for every new question. Opening it for one card is not a
     standing request to see it for the next twenty. */
  const [leaving, setLeaving] = useState(false);
  const [tally, setTally] = useState({ ok: 0, no: 0 });
  /*
   * What this sitting moved, for the screen at the end of it.
   *
   * The cards that went up a rung, cleared, or were learnt while the
   * session was running — collected as they happen, because a card's
   * standing afterwards says where it is and not that it arrived there
   * tonight. Cleared with the tally, on every way of starting a session.
   *
   * One entry per card, keeping the largest thing that happened to it: a
   * card that rises a level early on and clears before the end is one
   * piece of news, not two.
   */
  const [moved, setMoved] = useState<{ id: string; move: Move }[]>([]);

  const timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  /* How many changes are in memory and not yet on the disk. Zero means the
     two agree — read by the flush on the way out. What the server is owed
     is a different question, kept by `owed` below. */
  const unsaved = useRef(0);
  /* A failed write, backing off. The delay doubles to half a minute and
     the warning stays up until something lands. */
  const retryAt: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  const retryFor = useRef(500);
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
  /* Why the last sync failed, in words. It used to be recorded and read by
     nobody: the dot in the corner went red and the line beside it said
     "Offline — will retry" whatever had actually happened, including the
     two failures that never clear by themselves. */
  const [syncError, setSyncError] = useState("");
  /* The round trip waiting to go, if one is. Emptied when it fires, so
     "is one waiting?" can be asked of it. */
  const syncTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> = useRef(null);
  const syncing = useRef(false);
  const fromSync = useRef(false);
  /*
   * Whether anything has changed here since the last round trip set out.
   *
   * Cleared as one leaves, because it sends the document as it stands at
   * that moment, and set again by any change after it — including one made
   * while it is in flight, which is then owed a trip of its own. A trip
   * that fails sets it back: nothing went up. It used to be read off
   * `unsaved`, which counts what is not on the disk yet and drops to nought
   * when the disk write lands, so a change made during a trip was often
   * written down, counted as sent, and left for the next answer.
   */
  const owed = useRef(false);
  /*
   * Whether a question is being put. The sync's cadence turns on it — see
   * syncAfterChange in sync.ts — and a session that stops putting them,
   * whichever way it stops, sends what it did.
   */
  const answering = !!session && qi < session.exercises.length;
  const answeringRef = useRef(answering);
  answeringRef.current = answering;
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

  /* So that a sync can ask for another one when something was written
     while it was in flight, without naming itself as its own dependency. */
  const runSyncRef = useRef<(token?: string) => void>(() => {});
  /* Arm the round trip for what is owed. `keep` leaves one already
     waiting where it is, which is what lets a session's answers ride along
     on the next sync rather than each pushing it back. A trip with nothing
     owed by the time it fires stays home. */
  const armSync = useCallback((wait: number, keep: boolean) => {
    if (syncTimer.current) {
      if (keep) return;
      clearTimeout(syncTimer.current);
    }
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      if (owed.current) runSyncRef.current();
    }, wait);
  }, []);
  const runSync = useCallback(
    /* Defaulted rather than required: most callers have no token in hand
       and want whatever this device is already signed in with. */
    async (token: string = "") => {
      const key = token || loadSyncConfig().token;
      if (!key || syncing.current) return;
      /*
       * Offline, the round trip can only fail, and failing at it says
       * nothing the connection has not already said. What is on this
       * device is safe where it is; the `online` listener below runs this
       * the moment there is somewhere to send it.
       */
      if (isOffline()) {
        setSyncState("off");
        return;
      }
      syncing.current = true;
      setSyncState("syncing");
      setSyncError("");
      /* Everything up to here goes in this trip, which reads the document
         as it stands now. Anything written while it is in flight sets this
         again, and is owed a trip of its own — see the end. */
      owed.current = false;
      let sent = false;
      try {
        const { merged, changed, lost } = await syncOnce(dataRef.current, key);
        sent = true;
        if (lost) {
          /* The shared copy could not be read and this sync has replaced
             it. What is on this device is safe; anything another device
             had put up and this one never pulled went with it, and that is
             worth saying rather than passing off as an ordinary sync. */
          flash(
            lost === "recovered"
              ? "The shared copy was damaged — an earlier one was used. Sync your other devices."
              : "The shared copy could not be read and has been replaced from this device. Sync your other devices.",
            "warn",
          );
        }
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
          /* Through the one writer, which cancels the debounced save still
             pending. That save was built from the document before this
             merge, and letting it fire afterwards wrote the older copy
             back over the adopted one — memory and the server were right
             and the disk was behind until the next change. */
          await writeNow();
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
          /*
           * Pruned to what the document still refers to.
           *
           * This ledger exists so a clip already sent is not offered again,
           * and it only ever grew: one id per recording ever uploaded from
           * this device, kept for good in the same small store the whole
           * document lives in. A recording that no card mentions any more
           * will never be offered again whatever this says, so holding its
           * id is paying rent on a fact nobody will ask for.
           */
          const mentioned = new Set(clipIdsIn(merged));
          uploaded = res.uploaded.filter((id) => mentioned.has(id));
          if (res.pulled) {
            flash(`${plural(res.pulled, "recording")} downloaded`);
            /* Something new can be heard now, which offline decides what a
               session may ask. */
            refreshAudible();
          }
        } catch (e) {
          /* the document is synced; clips can catch up next time */
        }

        const cfg = { ...prevCfg, token: key, lastSync: now(), uploaded };
        saveSyncConfig(cfg);
        setSyncCfg(cfg);
        setSyncState("ok");

        /* And how close the document is to the size the server refuses.
           Past that, sync stops for good and everything after it stays on
           one device — so the first a learner hears of it should not be
           the day they lose a phone. Said once per sync, and only when it
           is actually tight. */
        const size = docSize(dataRef.current);
        if (size.tight || size.localTight) {
          /*
           * Two ceilings, and the nearer one is the one worth naming. The
           * device's own store is the smaller and the quieter: past it the
           * saving fails rather than the sending, on a screen that goes on
           * showing every answer as though it had been kept.
           */
          const share = Math.max(
            size.bytes / size.limit,
            size.units / size.localLimit,
          );
          flash(
            `Your cards are ${Math.round(share * 100)}% of the size this device can hold. ` +
              "Remove some recordings before it stops.",
            "warn",
          );
        }

        /* Everything this device holds has now gone up under the shared
           token, so a document left behind by an older build's private key
           carries nothing that isn't here. Remove it rather than leave a
           copy of someone's cards on the server for ever. */
        for (const legacy of [...LEGACY_SYNC_KEYS]) {
          LEGACY_SYNC_KEYS.delete(legacy);
          tokenFor(legacy)
            .then(async (old) => {
              if (old === key) return;
              /* Read before it goes. It used to be deleted outright, on
                 the assumption it held nothing this device lacked — which
                 is true of this device's own old key and false if another
                 device synced under the same passphrase and this one
                 never pulled it. */
              const taken = await drainRemote(old, dataRef.current);
              if (taken === dataRef.current) return;
              const adopted = merge(taken);
              fromSync.current = true;
              commit(adopted);
              await writeNow();
            })
            .catch(() => {});
        }
      } catch (err) {
        const msg = String(
    (err && typeof err === "object" && "message" in err && err.message) || err
  );
        /* Named where the app knows what happened, because two of these
           never clear by themselves and a learner needs to be told rather
           than left syncing into a wall. */
        const said =
          msg === "bad-passphrase"
            ? "Passphrase rejected"
            : msg === "too-large"
            ? "Your cards are too big to sync. Remove some recordings or cards."
            : msg === "would-empty"
            ? "Sync refused: this device had nothing to send. Your cards on the server are untouched."
            : isOffline()
            ? "Offline — your work is saved on this device"
            : "Sync failed";
        setSyncError(said);
        if (msg === "too-large" || msg === "would-empty") flash(said, "warn");
        setSyncState("error");
        /* Nothing went up, so everything this trip carried is still owed. */
        if (!sent) owed.current = true;
      } finally {
        syncing.current = false;
        /* Written to while this was in flight, so it is owed a trip of its
           own, on the terms any change gets: soon outside a session, with
           the session's next one inside it. Not after a failure, which
           would only be asked again into the same wall — what failed goes
           with the next change, the end of the session, the app being put
           away or the connection coming back. */
        if (sent && owed.current) {
          const { wait, keep } = syncAfterChange(answeringRef.current);
          armSync(wait, keep);
        }
      }
    },
  /* Deliberately none. This reads and writes through refs so that a
     sync started at any moment works on the document as it is then,
     not as it was when the callback was made. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  runSyncRef.current = runSync;

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

  /* After anything changes: soon, or with the session's next trip while
     questions are being answered. See syncAfterChange in sync.ts. */
  useEffect(() => {
    if (!ready || !syncCfg.token) return;
    if (fromSync.current) {
      fromSync.current = false;
      return;
    }
    owed.current = true;
    const { wait, keep } = syncAfterChange(answeringRef.current);
    armSync(wait, keep);
  }, [data, ready, syncCfg.token, armSync]);

  /* And when a session stops asking — finished, out of time or left —
     what it did goes up now rather than with its next few-minutely trip:
     the end of a session is when another device is most likely to be
     picked up. */
  useEffect(() => {
    if (!answering && owed.current) armSync(SESSION_END_SYNC_MS, false);
  }, [answering, armSync]);

  /*
   * And when the app is put away. A phone in a pocket, a tab switched
   * away from: the other moment a learner might reach for another device,
   * and on iOS often the last moment this page runs at all — a timer set
   * for a few minutes from now may never fire. Nothing is lost if this
   * trip is cut short, because everything is on this device already; it
   * goes with the next launch instead.
   */
  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== "hidden" || !owed.current) return;
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      runSyncRef.current();
    };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, []);

  /* A trip still waiting when the app goes is not this app's to make. */
  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    [],
  );

  /* A timed session's time running out: one wake-up at that moment, which
     the out-of-time check in the render then reads. Set again whenever the
     end moves, which carrying on after a pause does, and not at all while
     paused. The countdown on screen is SessionClock's. */
  useEffect(() => {
    if (!session || !session.endsAt || session.pausedAt) return undefined;
    const id = setTimeout(() => setNow_(Date.now()), Math.max(0, session.endsAt - Date.now()) + 50);
    return () => clearTimeout(id);
  /* When the session ends and whether it is paused, not which object
     holds them: a session is replaced whenever its queue is re-dealt. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session && session.endsAt, session && session.pausedAt]);

  /*
   * Send what has been waiting for a connection.
   *
   * Reported problems only. Everything a learner *learns* travels in the
   * document and is sent by the sync below; this is for the one thing they
   * can do that is a message to somebody else, which had no way of
   * reaching them from a train.
   *
   * A report the server refuses is dropped rather than tried for ever: the
   * card it was about has gone, or the account has, and asking again would
   * be told the same thing. Only a request that could not be made at all
   * keeps its place in the queue.
   */
  const sendWaiting = useCallback(async () => {
    if (!account || isOffline()) return;
    API.setKey(account.key);
    const { sent, left } = await drainOutbox(FLAG_OUTBOX, async (body) => {
      try {
        await API.reportFlag(body as API.FlagReport);
        return "sent";
      } catch (e) {
        return String((e && (e as Error).message) || e) === "offline" ? "keep" : "drop";
      }
    });
    setToSend(left);
    if (sent) flash(`${plural(sent, "report")} sent. Thank you 🫶`, "good");
  /* The key, not the account object, as everywhere else here. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);

  /* What is waiting, as the app opens — before any connection has been
     tried, so the corner menu is right from the first paint. */
  useEffect(() => {
    setToSend(waitingToSend(FLAG_OUTBOX));
  }, []);

  // Retry when the connection comes back.
  useEffect(() => {
    const onOnline = () => {
      if (loadSyncConfig().token) runSync();
      void sendWaiting();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSync, sendWaiting]);

  /* And on launch, for a report kept during a session that ended before
     the connection came back. */
  useEffect(() => {
    if (ready && account) void sendWaiting();
  /* The handle, not the account object, for the same reason. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountHandle, sendWaiting]);

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

  /*
   * Which recordings are on this device.
   *
   * Asked at launch and again whenever the connection comes or goes, which
   * are the two moments the answer changes what a session may ask: offline
   * it decides whether a listening exercise is dealt at all. Everything
   * that downloads a recording calls `refreshAudible` itself, so a course
   * taken offline is audible without waiting for anything.
   */
  useEffect(() => {
    if (!ready) return;
    refreshAudible();
  }, [ready, offline, refreshAudible]);

  /*
   * Write what is in memory, now, and keep trying until it lands.
   *
   * The debounce above exists so that a run of changes writes once, and it
   * was the only path to the disk — so an answer given inside those six
   * hundred milliseconds was never written at all if the tab closed, the
   * app was put away, or a deploy reloaded the page. `flushSave` below is
   * what closes that window; this is the write both paths share.
   *
   * And a failed write is retried. It used to be reported once, by a
   * message that said the last answer might not stick, and then dropped:
   * with storage full or blocked every later answer failed the same way in
   * silence while the screen went on showing them, and a reload lost the
   * lot. Backing off rather than hammering, because the usual cause —
   * quota, private browsing — does not clear in a hurry, and the warning
   * stays up while it is unwritten.
   */
  const writeNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const at = unsaved.current;
    const ok = await saveData(dataRef.current);
    setSaveFailed(!ok);
    if (ok) {
      /* Only if nothing was written while this was in flight; otherwise
         the newer change is still owed a write. */
      if (unsaved.current === at) unsaved.current = 0;
      if (retryAt.current) {
        clearTimeout(retryAt.current);
        retryAt.current = null;
      }
      return true;
    }
    if (!retryAt.current) {
      retryFor.current = Math.min(Math.max(retryFor.current * 2, 1000), 30000);
      retryAt.current = setTimeout(() => {
        retryAt.current = null;
        void writeNow();
      }, retryFor.current);
    }
    return false;
  }, []);

  /* Takes the next document, or a function of the current one. The
     function form is for anything that can run while a sync or a course
     refresh is in flight — grading, flagging — so it builds on what is
     current rather than on the render it was created in. */
  const persist = useCallback(
    (nextOrFn: Doc | ((cur: Doc) => Doc | null)) => {
      const next = typeof nextOrFn === "function" ? nextOrFn(dataRef.current) : nextOrFn;
      if (!next || next === dataRef.current) return;
      commit(next);
      /* Something is now in memory that is not on the disk. Read by the
         flush below. */
      unsaved.current += 1;
      /* And not on the server either. The effect that arms the sync says so
         too, but it skips a render that also carries a sync's own result,
         and an answer given just as a round trip came back would have
         ridden into that render unmarked. */
      owed.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void writeNow();
      }, 600);
    },
    [commit, writeNow]
  );

  /*
   * Write on the way out.
   *
   * `pagehide` is the one event that fires for every way a page goes away
   * — closed, navigated, swiped out of a phone's app switcher, discarded
   * by the system — and `visibilitychange` catches the app being put in
   * the background without being unloaded, which on iOS is where a page
   * usually dies. Both are registered, and both are cheap when nothing is
   * owed.
   *
   * Storage is synchronous underneath, so a write started here completes
   * even as the page is being torn down; there is nothing to await and
   * nothing that can be awaited at that point.
   */
  useEffect(() => {
    const flush = () => {
      if (unsaved.current) void writeNow();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    /* And before any reload the app brings on itself, which is a service
       worker taking over with a new build — that used to happen inside the
       debounce and take the last answer with it. */
    const release = beforeReload(flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      release();
    };
  }, [writeNow]);

  /*
   * What another tab of this app has written.
   *
   * Every tab holds the whole document and writes the whole document, so
   * two of them open was last-save-wins: answer in one, answer in the
   * other, and whichever saved second had never seen the first's answer
   * and wrote over it. A learner with no account lost it outright.
   *
   * The storage event fires only in the *other* tabs, which is exactly the
   * signal needed: whatever arrives is merged in the same way a sync
   * merges — per form, per exercise, by when each was answered — and the
   * result is written back, so both tabs converge on the union rather than
   * racing. Merging is idempotent, so doing this on every write from
   * across the way costs nothing but the merge.
   */
  useEffect(() => {
    if (!ready) return undefined;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.endsWith(KEY) || !e.newValue) return;
      let theirs = null;
      try {
        theirs = JSON.parse(e.newValue);
      } catch (err) {
        return;
      }
      if (!theirs || !Array.isArray(theirs.items)) return;
      const merged = merge(mergeData(dataRef.current, theirs));
      /* Only where it actually adds something, so two tabs do not write
         each other awake for ever. */
      if (JSON.stringify(merged) === JSON.stringify(dataRef.current)) return;
      fromSync.current = true;
      commit(merged);
      void writeNow();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ready, commit, writeNow]);

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
  /* Questions answered on a typical recent day, which sizes how many words
     may be in hand — see inHandFor. Read off the log every answer already
     writes, so it follows the learner without anything new to store. */
  const perDay = useMemo(() => typicalDay(data.log), [data.log]);
  /* The same, over the prep's decks alone — the pace the prep tile holds
     against its goal. See prepLog. */
  const prepPerDay = useMemo(() => typicalDay(data.prepLog || {}), [data.prepLog]);
  /* What the question machinery reads: the device's cards, plus anything
     borrowed. Everything else in the app reads `items`, because nothing
     else should see a card that is not really here. */
  const asking = useMemo(
    () => (preview.length ? items.concat(preview) : items),
    [items, preview]
  );
  /*
   * The teachers' numbers with the things they count: the noun cards the
   * learner's courses hold — see nouns.ts. Held as a string first, so the
   * systems only change when a noun does and not on every answer, which
   * would rebuild every question built on them.
   */
  const countedKey = useMemo(
    () => JSON.stringify(nounsByLanguage(heldSystems, items.filter((it) => !!fromDeck(it)) as unknown as Record<string, unknown>[])),
    [heldSystems, items],
  );
  const systems = useMemo(() => setsGiven(heldSystems, JSON.parse(countedKey)), [heldSystems, countedKey]);
  /* And the numbers each part puts into the sentences that ask for it,
     which are borrowed by a sentence and never asked — see fillerCards.
     Only the value index reads them. */
  const numberFillers = useMemo(
    () => systems.flatMap((set) => fillerCards(composerFor(set.numbers.languageId), set.numbers)),
    [systems],
  );
  const valueCards = useMemo(
    () => (numberFillers.length ? asking.concat(numberFillers) : asking),
    [asking, numberFillers],
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
    () => contextIndexOf(asking, settings),
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
  const valueIndex = useMemo(
    () => valueIndexOf(valueCards, settings),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [valueCards, settings.language],
  );
  setValueIndex(valueIndex);

  /* And which sentences a teacher has approved, on the cards they have
     reviewed. Rebuilt with the cards, which is when a review can change. */
  const reviewGate = useMemo(() => reviewGateOf(asking), [asking]);
  setReviewGate(reviewGate);

  /* And whether the ten figures each number system writes in are cleared,
     which is what decides whether a range is asked to write in them. */
  const numeralsKnown = useMemo(() => numeralsKnownOf(asking, settings), [asking, settings]);
  setNumeralsKnown(numeralsKnown);

  /* And how many words each language has to pair against.

     Before the three walks below rather than in among them: each of these
     setters throws away what a form can be asked, and one landing in the
     middle of the walks makes them read the same ladder over again. They
     do not depend on each other — see installIndexes, which is the same
     order for the same reason. */
  const mateCounts = useMemo(() => countMates(asking, settings), [asking, settings]);
  setMateCounts(mateCounts);
  const picturedCounts = useMemo(() => countPictured(asking, settings), [asking, settings]);
  setPicturedCounts(picturedCounts);
  const heardCounts = useMemo(() => countHeard(asking, settings), [asking, settings]);
  setHeardCounts(heardCounts);

  /*
   * And whether the learner has cleared each of them.
   *
   * Only the cards that fill something, so this is a walk over the values
   * rather than over the deck. A value that is drilled on its own carries
   * whether it is cleared, and a value that is not carries null, because
   * it is never dealt and has no ladder to read. What each of those means
   * for a hole is valuesAt's business, not this one's.
   */
  const valueReach = useMemo(() => valueReachOf(valueCards, settings), [valueCards, settings]);
  setValueReach(valueReach.map, valueReach.forms);
  setValueOwner(valueReach.owner);

  /* And which cells of a verb's table are still behind their row's gate.
     Last of the four, and deliberately after the mate counts: working a
     row out reads the ladder for every cell in it, and the ladder reads
     what a cell can be asked, which is the question the count above
     answers. */
  const quiet = useMemo(() => quietUnits(asking, settings), [asking, settings]);
  setQuietUnits(quiet);
  /* And which of them are asked one exercise a level rather than all of
     them, because the word they are a form of is already written from its
     meaning. Beside the gate above and worked out the same way. */
  const eased = useMemo(() => easedUnits(asking, settings), [asking, settings]);
  setEasedUnits(eased);

  /* Every recording the cards refer to, for taking a course offline. */
  const allClipIds = useMemo(() => {
    const ids = [];
    for (const it of items) {
      for (const { unit } of unitsOf(it)) for (const r of unit.recs || []) ids.push(r.id);
    }
    return ids;
  }, [items]);

  /* How many of them are not here. Read on the home screen while offline,
     and in Account settings beside the button that fetches them. */
  const missingClips = useMemo(
    () => (audible ? [...new Set(allClipIds)].filter((id) => !audible.has(id)).length : 0),
    [allClipIds, audible],
  );

  const allTags = useMemo(() => {
  const counts: Record<string, number> = {};
    for (const it of items) for (const t of it.tags || []) counts[t] = (counts[t] || 0) + 1;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  }, [items]);

  const inDeck = useCallback(
    (it: Item) => deck.length === 0 || (it.tags || []).some((t) => deck.includes(t)),
    [deck]
  );

  /* Everything this device could practise, before the language switch has
     had its say. What the switch itself is built from: the list of
     languages to choose between has to be the whole of them, or switching
     one off would take it out of the list that switched it off. */
  const drillableAll = useMemo(
    () => items.filter((it) => inDeck(it) && isDrillable(it, settings)),
    [items, settings, inDeck]
  );

  /*
   * How much is actually waiting — the number under "Cards ready to
   * practice", and a promise about the session the button beneath it
   * builds.
   *
   * Over the levels a card has reached, not everything it could one day be
   * asked: a level it has not climbed to is not work waiting to be done,
   * and counting it promised a session that would not include the card.
   *
   * And a card never seen is only waiting if the app would actually deal
   * it. Every untouched card counts as ready to the scheduler — correctly,
   * since nothing is known about it — so a course of sixty new cards
   * reported sixty waiting while the rule on new cards would admit three.
   * At the point where that rule admits none at all, the screen said
   * "20 cards ready to practice" over a button that answered "nothing
   * ready to practice yet", and the line written to explain the wait could
   * never appear because the count it was gated on was never zero.
   */
  const countReady: (pool: Item[]) => number = useCallback(
    (all) => {
      /* Not a range waiting on its words: a session would not deal it, so
         it is not ready — see knownNumbers. */
      const numbers = knownNumbers(items, settings, systems);
      const pool = all.filter((it) => !isRangeSkill(it) || numbers.ready(it));
      const waiting = (it: Item, includeNew: boolean) =>
        /* A card the learner asked for is waiting by their say-so — see
           isUrgent. */
        isUrgent(it, settings) ||
        drillableUnits(it, settings).some(({ unit }) =>
          openTypes(unit, settings).some((t) => {
            const st = stateOf(unit, t);
            return includeNew ? stateReady(st) : st.phase !== "new" && stateReady(st);
          })
        );
      /* Everything genuinely due, which is the honest half of the number. */
      const met = pool.filter((it) => waiting(it, false)).length;
      /* Plus as many never-seen cards as the app would let in today, read
         over everything this learner holds rather than the deck in front
         of them — the same reckoning buildSession does, so the two cannot
         come to disagree. */
      const fresh = pool.filter((it) => !waiting(it, false) && waiting(it, true)).length;
      return met + Math.min(fresh, roomForNew(handCounts(items, settings, numbers), inHandFor(perDay), frontDoorFor(perDay)));
    },
    [settings, items, perDay, systems]
  );

  /*
   * The languages this person actually has cards in, with how much of each
   * is ready — which is what the switch at the top of the screen offers,
   * and why it only appears for somebody learning more than one.
   *
   * Read off the cards rather than off the courses: a card kept after a
   * course ended is still a card in that language.
   */
  const langChoices = useMemo(() => {
    const byLang: Map<LangId, Item[]> = new Map();
    for (const it of drillableAll) {
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
  }, [drillableAll, settings, countReady]);

  /* Which languages are switched off, as the rest of the app should read
     it rather than as it happens to be stored — see langsOffAmong. */
  const langsOff: LangId[] = useMemo(
    () => langsOffAmong(settings.langsOff, langChoices),
    [settings.langsOff, langChoices]
  );

  /*
   * The same switch over the teaching space, which reports the languages
   * it holds while it is open — its courses, decks and cards are its own
   * to fetch, and nothing out here has them. Stored apart from Learning's:
   * narrowing what you teach is not narrowing what you learn.
   */
  const [teachChoices, setTeachChoices] = useState<LangChoice[]>([]);
  /* Only a change the switch would show is a change: the space reports
     afresh on every refresh, and the same languages and counts again
     should not re-render the whole app behind it. */
  const reportTeachChoices = useCallback(
    (next: LangChoice[]) =>
      setTeachChoices((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next)),
    []
  );
  const teachLangsOff: LangId[] = useMemo(
    () => langsOffAmong(settings.teachLangsOff, teachChoices),
    [settings.teachLangsOff, teachChoices]
  );

  /* And the cards that leaves. Everything a learner is shown reads this
     rather than the whole document: the card list, progress, what is ready
     to practise, and what a session is dealt from. */
  const inPlay = useCallback(
    (it: Item) => !langsOff.includes(langIdOf(it, settings)),
    [langsOff, settings]
  );
  const shown = useMemo(
    () => (langsOff.length ? items.filter(inPlay) : items),
    [items, langsOff, inPlay]
  );
  const drillable = useMemo(
    () => (langsOff.length ? drillableAll.filter(inPlay) : drillableAll),
    [drillableAll, langsOff, inPlay]
  );

  /* How much is waiting, in the languages that are switched on: the number
     on the home screen, and what decides whether there is a session to
     start at all. */
  const readyCount = useMemo(() => countReady(drillable), [drillable, countReady]);
  /* The prep the home screen offers a session for: one still to come, with
     cards in it not yet learnt. Past its day, or finished, it is Progress's
     to report and the learner's to clear. */
  const homePrep = useMemo(() => {
    const p = prepOf(settings);
    return p && prepStatus(p, shown, settings) === "active" ? p : null;
  }, [settings, shown]);

  /* And how much is going wrong, which is what the Weak skills button is
     offered on. The same test the session itself picks with — see isWeak —
     so a number here is a session that builds. */
  const weakCount = useMemo(
    () => drillable.filter((it) => isWeak(it, settings)).length,
    [drillable, settings]
  );

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
    setMoved([]);
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

  /* Kept under the same id and date, so it stays where it was in the list
     and a tile on the home screen is the same tile with new contents. */
  function changeSession(id: string, changed: Omit<SavedSession, "id" | "created">) {
    setSetting("savedSessions", savedSessions.map((x) => (x.id === id ? { ...x, ...changed } : x)));
    flash(`Saved changes to ${changed.name}`);
  }

  function startSaved(s: SavedSession) {
    beginManual({ ids: s.ids, mode: s.mode, count: s.count, minutes: s.minutes });
  }

  /* A session assembled by hand on the Build screen. */
  function beginManual({ ids, mode, count, minutes }: {
    ids: Set<string> | string[];
    mode: string;
    count?: number;
    minutes?: number;
  }) {
    /* Regular is dealt as the home screen deals, so it reads the cards the
       home screen does: the language switch has its say over which words
       count as in hand, exactly as it does for a prep. */
    const built = buildManualSession({
      items: mode === "regular" ? shown : items, settings, ids, mode, count, minutes, perDay, systems,
    });
    setBuilding(false);
    if (!built.exercises.length) {
      flash(
        built.reason === "no-mistakes"
          ? "Nothing to fix — none of those have gone wrong recently"
          : built.reason === "no-unseen"
          ? "You've practised all of those in the last few days, or they're already cleared"
          : built.reason === "nothing-due"
          ? "Nothing new to bring in yet — what you're learning comes back shortly"
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
    setMoved([]);
    resetExercise();
    setTab("home"); // a session started from anywhere is run on the home screen
  }

  /* Bring down whatever the courses hold and fold it into the cards. */
  const refreshCourses = useCallback(
    /* Three answers, not two: silent, speak only if something moved, or
       speak either way. */
    async (announce: boolean | "changes") => {
      if (!account) return true;
      /* A focus and a visibility change arrive together when a tab comes
         back; one refresh at a time is enough. */
      if (refreshing.current) return true;
      /* Nothing to ask and nothing to be learnt from asking. What this
         device was last told is already on screen. */
      if (isOffline()) return false;
      refreshing.current = true;
      setCourseBusy(true);
      /* Whether this actually got an answer, which two callers read: the
         background poll, to know whether to back off, and the line below
         that decides whether an empty course list means anything. */
      let answered = false;
      try {
        const r = await pullCourses(
          dataRef.current.items,
          freshStates,
          materialVersion.current,
          dataRef.current.parked || {},
        );
        setTeaches(r.teaches);
        saveTeaches(r.teaches);
        materialVersion.current = r.version || "";
        answered = true;
        if (r.unchanged) {
          setCourseError("");
          if (announce === true) flash("Nothing new");
          return;
        }
        setMyCourses(r.courses);
        setCourseDecks(r.decks);
        setSystems(r.systems);
        /* Kept, so the next launch opens with them rather than with an
           error — and so the check after that can be the cheap one. */
        saveMaterial(account.handle, {
          courses: r.courses,
          decks: r.decks,
          systems: r.systems.flatMap((set) => [set.numbers, ...(set.times ? [set.times] : [])]),
          version: r.version || "",
        });
        /* Folded against the cards as they are now, not as they were when
           the request went out: an answer given while the material was
           being fetched used to be lost to the copy that came back. */
        Object.assign(r, r.fold(dataRef.current.items, dataRef.current.parked || {}));

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
          /* The withdrawn cards' work goes in the drawer rather than out
             with the cards — see foldCourses and `parked` in types.ts. */
          const next = { ...dataRef.current, items: r.items, tombstones, parked: r.parked };
          commit(next);
          await writeNow();
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
        /*
         * An empty-handed student is told to join a course only once we
         * know they are not already in one — and a check that failed does
         * not know that. It used to set this either way, so a student
         * whose material could not be fetched was invited to join a course
         * they were already enrolled on.
         */
        if (answered) setCoursesKnown(true);
      }
      return answered;
    },
  /* The handle, not the account object. commit and flash are stable
     across renders — one writes through a ref, the other forwards to
     a memoised snackbar — so naming them would only churn this. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountHandle]
  );

  useEffect(() => {
    if (!ready || !account) return;
    /*
     * Tell the first check what this device already has, but only if the
     * cards that version describes are actually in the document. A stored
     * version against a document that no longer holds the course cards
     * would have the server answer "nothing has changed" to a device with
     * nothing — a student whose material never arrives, silently.
     */
    if (!materialSeeded.current) {
      materialSeeded.current = true;
      const has = (dataRef.current.items || []).some((it) => it.source);
      if (heldMaterial && has) materialVersion.current = heldMaterial.version;
    }
    refreshCourses(false);
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
    const pictures: string[] = [];
    let choosesPictures = false;
    for (const ex of built.exercises || []) {
      const r = resolveUnit(items, ex);
      if (r && r.unit) for (const rec of r.unit.recs || []) ids.push(rec.id);
      /* And every word standing beside it in a grid of recordings, each of
         which is played from its own tile. */
      if (specOf(ex.type) && specOf(ex.type).tiles === "audio") {
        for (const mate of ex.mates || []) {
          const m = resolveUnit(items, { ...mate, type: ex.type });
          if (m && m.unit) for (const rec of m.unit.recs || []) ids.push(rec.id);
        }
      }
      if (r && r.unit && Array.isArray(r.unit.images)) pictures.push(...r.unit.images.slice(0, 1));
      if (specOf(ex.type) && specOf(ex.type).picks === "image") choosesPictures = true;
    }
    if (ids.length) warmClips(ids).catch(() => {});
    /* The pictures the session shows, and — where it asks a learner to
       choose between pictures — the ones it may put beside them, which are
       any of their other cards' first pictures. Then the listing is asked
       again, so what is now here counts offline. */
    if (choosesPictures) {
      for (const it of items) {
        for (const { unit } of unitsOf(it)) {
          if (Array.isArray(unit.images) && unit.images.length) pictures.push(unit.images[0]);
        }
      }
    }
    if (pictures.length) warmImages(pictures.slice(0, 60)).then(refreshAudible).catch(() => {});
  }

  /*
   * A session, out of whatever the language switch has left in play.
   *
   * It used to ask. A learner with two languages pressing Start got a
   * screen in the way — this one, both, or not now — every single time,
   * and the answer held for that session only. The switch at the top of
   * the screen is the same question asked once and kept, and it answers it
   * for the card list and progress too, so there is nothing left for a
   * session to decide.
   */
  /*
   * A sitting of nothing but what is going wrong — see buildWeakSession.
   *
   * Out of the same cards a dealt session comes from, so the language
   * switch and the chosen deck have had their say here too: what is weak
   * in a language you have switched off is not what you came to fix.
   */
  function beginWeak() {
    const built = buildWeakSession({ items: shown, settings, inDeck, systems });
    if (!built.exercises.length) {
      flash(
        built.reason === "nothing-weak"
          ? "Nothing is going wrong just now — this fills up when something slips"
          : "No card here has enough on it to be practised yet"
      );
      return;
    }
    warmSession(built);
    setSession({ ...built, practice: false, startedAt: now(), endsAt: 0 });
    setQi(0);
    setTally({ ok: 0, no: 0 });
    setMoved([]);
    resetExercise();
    setTab("home");
  }

  function begin(practice?: boolean, only?: (it: Item) => boolean) {
    /* `only` narrows the session to some cards — a prep's decks — in place
       of the deck chosen on the home screen. */
    const built = buildSession({ items: shown, settings, inDeck: only || inDeck, practice, perDay, systems });
    if (!built.exercises.length) {
      /* This used to return in silence, which reads as a broken button. It
         mattered little when the only way to get here was a card list that
         was plainly too thin; with listening switched off it is reachable
         with a deck full of cards, and the reason has to be said. */
      /*
       * Why there is no session, which is now a much rarer thing to have
       * to say — being due no longer keeps anyone out, so reaching here
       * means the cards themselves cannot carry one.
       *
       * The old wording, "nothing ready to practice yet", was the app's
       * answer to every one of these and was usually untrue: it was said
       * most often to somebody holding a course of cards that were merely
       * not due, and it was said over a screen reporting how many were
       * ready. What is left is genuinely about the material.
       */
      flash(
        listenOff > Date.now()
          ? "Nothing to practice without sound just now"
          : built.reason === "no-variety"
          ? "These cards need two kinds of exercise between them"
          : built.reason === "none-drillable"
          ? "No card here has enough on it to be practised yet"
          : "Nothing new to bring in yet — what you're learning comes back shortly"
      );
      return;
    }
    warmSession(built);
    setSession({ ...built, practice });
    setQi(0);
    setTally({ ok: 0, no: 0 });
    setMoved([]);
    resetExercise();
  }

  /*
   * Send every card back to the beginning: the cards, forms, decks and
   * recordings stay, only what the app has learnt about you goes.
   *
   * Which it did not do. It wrote fresh states onto the card and onto a
   * `subs` list beside it, and a card has kept neither since 0.138 — its
   * progress lives on its forms. So the button flashed, the next load
   * stripped the two fields it had written, and every card came back
   * exactly as due as it was. Every form, and every turn of a
   * conversation, which carries its own progress the same way.
   *
   * What a frame has been shown goes too: which of its blanks has been
   * filled with which word is something the app learnt about this learner,
   * and a card sent back to the beginning that still remembers meeting
   * Raphael is not at the beginning. What the learner has *asked* for — a
   * card marked high priority — is theirs and stays.
   */
  function resetScheduling() {
    const wiped = <T extends Form>(f: T): T => {
      const { met: _forgotten, ...rest } = f;
      return { ...rest, s: freshStates() } as T;
    };
    const at = now();
    const cleared: Item[] = items.map((it) => ({
      ...it,
      forms: formsOf(it).map(wiped),
      ...(it.lines ? { lines: linesOf(it).map(wiped) } : null),
      /* When it was reset, which is what makes it stick. A blank schedule
         is indistinguishable from one that was never written, so it is
         left off the wire — and the merge used to hand back whatever the
         other side still held, seconds after the message said the reset
         had worked. See `reset` in types.ts. */
      reset: at,
      updated: at,
    }));
    persist({ ...data, items: cleared, log: {}, prepLog: {} });
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
    setRetried(false);
    setFlaggedNow(false);
    setEasedFor(null);
    setShowSaid(false);
    setShowMeaning(false);
    setHintOpen(null);
    setHintUsed(false);
    setHintAtAnswer(false);
  }

  const exercise = session && qi < session.exercises.length ? session.exercises[qi] : null;
  /* The card, narrowed to the question being asked of it: its variables
     filled in, one accepted answer where the question is about how a word
     sounds, one meaning where the meaning is the question. All three before
     anything reads it, so the prompt, the marking and the answer screen
     cannot disagree — and filling first, because the other two narrow the
     words it writes. */
  /*
   * Worked out once per question rather than once per render.
   *
   * Filling a sentence walks the pool behind each of its holes and narrows
   * every value to what the learner has reached; narrowing the answer and
   * the meaning walk the card again. None of it is a function of what
   * somebody is typing, and all of it was being redone on every keystroke
   * in the answer box — on a phone, with a frame to draw afterwards.
   *
   * What it is a function of is the question and the cards, both of which
   * are here: a card edited, a value that has caught up or lapsed, and an
   * answer given all arrive as a new `asking`.
   */
  const trial = !!(session && session.trial);
  const resolved = useMemo(
    () => (exercise ? resolveQuestion(asking, exercise, trial, systems) : null),
    [asking, exercise, trial, systems]
  );
  const item = resolved ? resolved.unit : null; // the form being drilled
  const parentItem = resolved ? resolved.parent : null;
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

  /*
   * Whether the pronunciation or the meaning is beside the question.
   *
   * Closed until it is asked for, always. There was a setting that opened
   * it on every question by itself, and it was a way to learn less without
   * being told: on the two questions where the nudge is the answer by
   * another route — English → {script} with the transliteration up is
   * {translit} → {script}, which is the level below — a learner with it on
   * graduated the top of the ladder having never once written the word
   * from its meaning alone. Asking for it is one press, and asking is what
   * makes it a nudge rather than the answer.
   */
  const hintAt = spec && spec.hintField && item ? String(item[spec.hintField] || "") : "";
  const hintShown = !!hintAt && !!hintOpen;
  /* On the screen now, or on it at some point. */
  const hintTaken = hintShown || hintUsed;
  /* Whether the answer as marked stands as a right one, before the hint is
     taken into account. */
  const answerStands = !!(overridden || (checked && checked.ok && !skipped));
  /* And the case that costs an answer its good mark: right, but written
     off a hint that spelt it out. Read off what was on the screen when the
     answer went in, not what is on it now — the nudge can still be opened
     afterwards to look at the pronunciation, and looking at it once the
     question is answered is not leaning on it. */
  const toldAnswer = !!(spec && spec.hintTells && hintAtAnswer && answerStands);
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
  const at = scene && scene.at !== WHOLE_SCENE ? scene.at : null;
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
    if (!item || !spec || !exercise || spec.picks !== "pair") {
      return { words: [] as Form[], meanings: [] as string[], said: [] as Form[] };
    }
    return gridFor(item, exercise, asking, settings, qLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, exercise && exercise.type, exercise && exercise.mates, asking, qLang.id]);

  /*
   * What each tile of the grid says about itself, beside its word.
   *
   * Nothing, nearly always — see kinTags, which is where the rule is. The
   * one case it speaks in is two forms of the same card standing in the
   * one grid, which a learner cannot pair by reading alone — and since
   * 0.256 the grid is never dealt that way (see matchGroups), so this is
   * kept only as the backstop for a grid that somehow is.
   *
   * Which card a form came from is not on the form: a grid's words are
   * drawn from the whole of what this learner has, and arrive narrowed to
   * one spelling and one meaning. So the cards are asked, once, and the
   * answer is a tag per tile in the order the two columns stand in.
   */
  const gridTags = useMemo(() => {
    const said = grid.said || [];
    if (!grid.words.length) return { words: [] as string[], meanings: [] as string[] };
    const ownerOf = new Map<string, Item>();
    for (const card of asking) {
      for (const { unit } of unitsOf(card)) ownerOf.set(unit.id, card);
    }
    const tags = kinTags({
      units: (grid.words as Record<string, any>[]).concat(said),
      cardOf: (u) => (ownerOf.get(u.id) || { id: "" }).id,
      labelOf: (u) => askLabel(u, ownerOf.get(u.id), qLang),
    });
    return {
      words: grid.words.map((w) => tags[w.id] || ""),
      meanings: said.map((u) => tags[u.id] || ""),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, asking, qLang.id]);

  /*
   * Where the hands are while a time is being set.
   *
   * Read out of the typed answer rather than held beside it, so there is
   * one answer and not two that can disagree — the same reason the grid
   * writes its pairs into `typed`. Nothing set yet opens at noon, which
   * is the one position on a dial that is not an answer to anything.
   */
  const dialAt = useMemo(() => {
    const m = String(typed || "").match(/^(\d{1,2}):(\d{1,2})$/);
    return m
      ? { hour: Math.min(23, Number(m[1])), minute: Math.min(59, Number(m[2])) }
      : { hour: 12, minute: 0 };
  }, [typed]);
  /* What the minutes may land on: whatever the question is asked in, so a
     five-minute question cannot be answered seven minutes past. A thumb is
     not a precise instrument and a question that asks for precision it
     cannot give is a question about the screen. */
  const dialMarks = (parentItem && parentItem.range && parentItem.range.marks) || undefined;
  const dialClock = ((systemFor(parentItem, systems) || {}).times || { clock: "12h" }).clock;

  /* The card's other forms that this question cannot tell from the one it
     asks — see twinsOf. Right answers too, and so never offered as wrong
     ones. Not on a card with blanks: its forms are filled one way for the
     question and would be compared unfilled. */
  const twins = useMemo(() => {
    if (!item || !parentItem || !spec || hasSlots(parentItem)) return [] as Form[];
    return twinsOf({
      unit: item,
      kin: unitsOf(parentItem).map((u) => u.unit),
      promptField: spec.promptField || "",
      told: !!askLabel(item, parentItem, qLang),
    }) as Form[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, parentItem, spec, qLang.id]);

  const choices = useMemo(() => {
    if (!spec || !spec.picks) return [];
    if (spec.picks === "reply") {
      return dialog && at !== null
        ? replyOptions({ card: dialog, at, pool: replyPool(asking, settings, qLang.id) })
        : [];
    }
    if (!item) return [];
    /*
     * A range brings its own wrong answers, already said.
     *
     * They were chosen when the question was built, because which numbers
     * are worth confusing is arithmetic and which of them can be said is
     * the composer's business. Drawing from the learner's vocabulary
     * instead would put a book and a house beside a number and make the
     * question a reading test.
     */
    if (exercise && exercise.options && exercise.options.length) {
      return optionsFor({
        answer: item,
        pool: exercise.options.map((text: string) => ({ id: `opt:${text}`, ar: text, en: "", lat: "" })),
        wanted: PICK_OPTIONS,
        seed: `${item.id} ${exercise.type}`,
        textOf: (w) => w.ar,
      });
    }
    /* Pictures: the learner's other words that have one, a tile each
       showing its first picture. Two cards with the same picture are one
       tile, which is what `textOf` reading the hash does. Offline, only
       the pictures on this device — see canSeeHere. */
    if (spec.picks === "image") {
      const reps = (statesOf(item)[(exercise && exercise.type) || ""] || {}).reps || 0;
      return optionsFor({
        answer: item,
        pool: wordPool(companyOf(asking, exercise), settings, qLang.id, item).filter(
          (u) => Array.isArray(u.images) && u.images.length && canSeeHere(u),
        ),
        wanted: PICK_OPTIONS,
        seed: `${item.id} picture ${reps}`,
        textOf: (w) => (Array.isArray(w.images) && w.images[0]) || "",
      });
    }
    /* The meanings of the learner's other words, one meaning apiece: a
       card that means two things offers the first of them, so no tile is
       two answers with a comma between. The card being asked is narrowed
       the same way, upstream in castMeaning. */
    if (spec.picks === "meaning") {
      const reps = (statesOf(item)[(exercise && exercise.type) || ""] || {}).reps || 0;
      return optionsFor({
        answer: item,
        pool: wordPool(companyOf(asking, exercise), settings, qLang.id, item)
          .filter((u) => u.en && !twins.some((t) => t.id === u.id))
          .map((u) => oneOf(u, exercise ? exercise.type : "")),
        wanted: PICK_OPTIONS,
        seed: `${item.id} meaning ${reps}`,
        textOf: (w) => w.en,
      });
    }
    return optionsFor({
      answer: item,
      /* One spelling a tile, like the answer's own: a card accepting two
         would otherwise put both on one tile, and the long one among three
         short ones is the answer given away by its shape. */
      pool: wordPool(companyOf(asking, exercise), settings, qLang.id, item)
        .filter((u) => !twins.some((t) => t.id === u.id))
        .map((u) => oneOf(u, exercise ? exercise.type : "")),
      wanted: PICK_OPTIONS,
      /* A question with no phrase behind it — "which of these means this"
         — has the number of askings for a seed instead, so the three wrong
         answers are not the same three for ever. */
      seed: `${item.id} ${(exercise && exercise.ctx) || ""}${
        exercise && !exercise.ctx ? (statesOf(item)[exercise.type] || {}).reps || 0 : ""
      }`,
      textOf: (w) => w.ar,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog && dialog.id, at, item && item.id, exercise && exercise.type, exercise && exercise.ctx, asking.length]);

  /*
   * Whether the prompt has to say which form it wants.
   *
   * The card's other forms, and what else is on screen beside this one —
   * the tiles where the question offers any, and the grid's words where it
   * is a grid. Both are already worked out above; this only asks whether
   * one of them is kin.
   */
  /*
   * Which field the answer screen has left to show.
   *
   * An exercise that offers a hint during the question shows that field
   * afterwards, which is what it always did. One that offers none used to
   * show nothing — so "Choose the meaning" and "Choose the word", which put
   * up two of a card's three fields between the question and the answer,
   * ended with no Learn more at all. The third field is the one thing
   * nobody had said, and it is what is shown now.
   *
   * The script is not among them: it has a block of its own below, which
   * knows when the question was heard rather than read.
   */
  const alsoField = useMemo(() => {
    if (!spec || !item) return "";
    if (spec.hintField) return spec.hintField;
    return (
      ["lat", "en"].find(
        (f) => f !== spec.promptField && f !== spec.answerField && item[f],
      ) || ""
    );
  }, [spec, item]);

  /* What the words in this sentence's blanks are, where their English
     leaves it open — see lentTags. Said under the prompt and again beside
     the answer, which is where a learner reported looking for it. */
  const lentLines = useMemo(
    () => (item && spec && spec.promptField !== "pairs" && spec.promptField !== "scene" ? lentTags(item, qLang) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, spec, qLang.id],
  );

  const tellForm = useMemo(() => {
    if (!item || !parentItem || !spec) return false;
    const kin = unitsOf(parentItem)
      .map((u) => u.unit)
      .filter((u) => u && u.id !== item.id);
    return formIsAmbiguous({
      unit: item,
      kin,
      shown: (choices as Record<string, any>[]).concat(grid.words || []),
      promptField: spec.promptField || "",
      answerField: spec.answerField || "",
    });
  }, [item, parentItem, spec, choices, grid]);

  /* Where the form is named — under the prompt, beside the answer — and
     what it is called. See formTagsAt. */
  const formLabelText = item && parentItem ? askLabel(item, parentItem, qLang) : "";
  const tagsAt = formTagsAt({
    label: formLabelText,
    ambiguous: tellForm,
    kin: parentItem ? unitsOf(parentItem).length - 1 : 0,
    lent: lentLines.length > 0,
    promptField: (spec && spec.promptField) || "",
  });

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
    /* Nor in the grid of recordings, whose answer is a tile tapped, not a
       word written. */
    if (spec.answerField !== "ar" || spec.picks === "pair") return null;
    return answerGiven(typed, item, (given, want) => qLang.check(given, want, qSettings).ok, answerFields());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, checked, typed, skipped, spec && spec.answerField]);
  /* And what that answer is, grammatically, in this language's words. Empty
     where the language declares no grammar, or the answer carries none. */
  const gaveLabel = gaveAnswer ? answerLabel(gaveAnswer, item, qLang) : "";

  /*
   * Where the spelling went wrong, where it did.
   *
   * "Not quite", and the word underneath — that was the whole of what a
   * misspelt answer came back with, and on a script a learner is still
   * learning to read, finding the one letter that differs is most of the
   * work and the part they are least able to do. One letter is wrong;
   * saying which is the difference between a correction and a verdict.
   *
   * Only where the answer was typed in the script, because that is where
   * spelling is the thing being asked: a meaning typed in English is
   * marked on an edit distance that forgives far more than a letter, and a
   * question answered by tapping one of four has no spelling in it.
   *
   * Null where there is nothing to point at, which is three cases and each
   * of them matters. A right answer, obviously. An answer marked down for
   * its harakat or its tones — right letters, and the verdict already has
   * a sentence for it, so highlighting a letter would contradict the line
   * beside it. And a miss so wide that the two words share nothing, where
   * every letter would come back marked and the marking would be saying
   * only what "wrong" already said.
   */
  const spelling = useMemo(() => {
    if (!item || !checked || !spec || skipped || overridden) return null;
    if (checked.ok || spec.answerMode !== "ar" || spec.answerField !== "ar") return null;
    const fold = qLang.letter;
    if (!fold) return null;
    /* Every spelling the card accepts, because on this one question the
       card keeps all of them — see castAnswer. The closest is the one the
       learner was reaching for, and the one spellRuns marks against. */
    const accepted = answersOf(item, answerFields())
      .map((a) => a.text)
      .filter(Boolean);
    const marked = spellRuns(typed, accepted, (ch) => fold(ch, qSettings));
    if (!marked.wrong) return null;
    return { ...marked, one: accepted.length === 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item && item.id, checked, typed, skipped, overridden, spec && spec.answerMode]);

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
    (!answerRight || checked.reason === "bare" || checked.reason === "typo") &&
    !(spec && spec.answerMode === "part") &&
    /* Nor under a grid: every word paired wrong shows its meaning where
       it stands, and the first word's alone would say less. */
    !(spec && spec.picks === "pair");
  /* A right answer written off the hint has a line under it saying so, so
     the praise is not the whole of what came back. */
  const verdictAlone = answerRight && !answerRepeated && !toldAnswer;
  /* Typed in figures and nothing else, on the phone's number pad. Its box
     is drawn for a few digits rather than a sentence. */
  const figures = !!exercise && answersInFigures(item, exercise.type);
  /* Written in the language's own figures — ٤٧ — on the keys under the
     box. See NumeralPad. */
  const ownFigures = !!spec && spec.answerMode === "own";
  const ownPrompt = "Use the keys below";

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
    grid.words.map((w) => ({
      unit: w,
      right: (matched[w.id] || "") === String((spec && spec.answerField === "ar" ? w.ar : w.en) || ""),
    }));

  /*
   * Whether this answer is a slip of the finger rather than a miss.
   *
   * One letter out of a word of at least four — see `typoed` in
   * spelling.ts, which owns the rule and counts letters the way the
   * language does. Only where the answer was typed in the script, which is
   * the same door the letter-by-letter marking comes through: a meaning
   * typed in English is already marked on a distance that forgives more
   * than a letter, and there is no spelling in tapping one of four.
   *
   * Not where the answer was put on the screen, or the question skipped.
   * A learner who has been shown the word and copied it one letter wrong
   * has not made a typo; they have failed to copy, and a second go at a
   * word that is still in front of them proves nothing.
   */
  const typoNow = (result: { ok?: boolean }) => {
    if (result.ok || retried || skipped || toldAnswer) return false;
    if (!spec || spec.answerMode !== "ar" || spec.answerField !== "ar") return false;
    const fold = qLang.letter;
    if (!fold) return false;
    const accepted = [item, ...twins]
      .flatMap((u) => answersOf(u, answerFields()))
      .map((a) => a.text)
      .filter(Boolean);
    return typoed(typed, accepted, (ch) => fold(ch, qSettings));
  };

  function submit() {
    if (!item || checked) return;
    let result =
      spec && spec.picks === "pair"
        ? gridMarks().every((m) => m.right)
          ? { ok: true, reason: "exact" }
          : { ok: false, reason: "wrong" }
        : checkAnswer(typed, item, exercise.type, qSettings);
    /* Another form the question could not tell from this one, written
       instead: right, because nothing on the screen said which. */
    if (!result.ok && !(spec && spec.picks === "pair")) {
      for (const twin of twins) {
        const also = checkAnswer(typed, twin, exercise.type, qSettings);
        if (also.ok) {
          result = also;
          break;
        }
      }
    }
    /*
     * One letter out: the question is asked again and nothing is marked.
     *
     * The answer is not filed, the schedule does not move, and — where the
     * card is making its passes — the count of them is not put back to
     * nought, which is the whole reason this exists. Four days of a
     * learner's progress should not turn on a mistyped letter.
     *
     * **And the letter is not pointed at.** The marking that lines the two
     * spellings up is the best thing this app does for somebody learning a
     * script, and showing it here would turn the second try into copying
     * out a correction. So the second try gets a word and no more; if it
     * is wrong too, the full marking is there under it, as it always was.
     */
    if (typoNow(result)) {
      setRetried(true);
      setTyped("");
      sfx("wrong");
      flash("Almost — one letter out. Try it again.");
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    /* The right number, in the figures English uses, where the question
       asked for the language's own: asked again, once, saying which — the
       question is about the figures, and 47 for ٤٧ is a learner who has
       not seen what it wants rather than one who could not write it. */
    if (!result.ok && (result as { western?: boolean }).western && !retried && !skipped && !toldAnswer) {
      setRetried(true);
      setTyped("");
      sfx("wrong");
      flash(`Right number — now write it in ${ownNamed(qLang)}.`);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    sfx(result.ok ? "correct" : "wrong");
    setPairs(relatedWords(asking, qLang, item.ar));
    /* Pinned before the verdict, so what the mark reads is what was on the
       screen while the answer was being written. */
    setHintAtAnswer(hintTaken);
    setChecked(result);
    // Drop the phone keyboard so the answer and grades are visible.
    if (inputRef.current) inputRef.current.blur();
  }

  /*
   * A session that is already running, re-checked when the answer to "can
   * this be asked?" changes underneath it.
   *
   * Two moments, and both are about sound. The connection going away, which
   * withdraws every recording that was never downloaded; and the listing of
   * what *is* on the device landing, which is the same fact arriving a
   * moment late. A queue built while online and carried into a tunnel used
   * to keep its listening questions, so the learner met a silent player and
   * a note saying the recording was not here — on a question they could
   * only skip. That is the failure the gate was written to stop, stopped at
   * one door and not the other.
   *
   * Only ever narrowing. Coming back online does not put questions back:
   * they are gone from this sitting and the next session deals them
   * normally, because adding questions into a queue somebody is halfway
   * through is a worse surprise than the one being fixed.
   */
  useEffect(() => {
    if (!session || !session.exercises) return;
    const next = requeueUnaskable(session.exercises, qi, items, settings);
    /* Nothing went: the common case, and it must not churn the session
       object or the question on screen. */
    if (next.length === session.exercises.length) return;
    if (next.length <= qi) {
      /* Everything left needed something this device cannot do. Ending here
         is honest, the way the quiet button ends it. */
      setSession(null);
      sfx("warn");
      flash("Nothing left in this session that works offline");
      return;
    }
    setSession((s: Session | null) => (s ? { ...s, exercises: next } : s));
    /* The question at this index may be a different one now. */
    resetExercise();
  /* The two facts that change the answer, and nothing else: re-running this
     on every answer would re-plan the session under the learner. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, audible, visible]);

  /* "Can't listen right now": stop asking for recordings, here and in
     anything built for the next quarter of an hour. */
  function goQuiet() {
    const until = now() + LISTEN_OFF_MS;
    /* The module flag first, because requeueUnaskable and every builder read
       it rather than the state; then the state, so the screen re-renders;
       then the device, so a reload does not undo it. */
    setListenOffUntil(until);
    setListenOff(until);
    saveListenOff(until);

    const next = session ? requeueUnaskable(session.exercises, qi, items, settings) : [];
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
    setHintAtAnswer(hintTaken);
    setSkipped(true);
    setChecked({ ok: false, reason: "skipped" });
    if (inputRef.current) inputRef.current.blur();
  }

  /*
   * How the flagged question had actually gone, in one word.
   *
   * Told apart rather than rolled into right-or-wrong, because the
   * difference is the report: a card flagged after being marked *right* is
   * a card that accepts something it should not, and one flagged after the
   * answer was shown is usually a card whose answer is unguessable. Both
   * read as "wrong" if only the grader's boolean is kept.
   *
   * "unanswered" is the flag menu opened on the question rather than on
   * the verdict, which is the ordinary way to report an unanswerable one.
   */
  function flagVerdict(): FlagVerdict {
    if (!checked) return "unanswered";
    if (skipped) return "skipped";
    if (toldAnswer) return "shown";
    const { correct, near } = verdictOf({ checked, toldAnswer, overridden, skipped, hintAtAnswer });
    return correct ? "right" : near ? "near" : "wrong";
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
    /* "This was too easy" is not a report: it is the learner's own
       shortcut up the ladder, done here and now on the form that was
       asked, and on its own it is sent to nobody. */
    if ((FLAG_KINDS.find((k) => k.key === kind) || {}).lifts) {
      liftCurrent();
      /* Unless they said something about it: words typed are words meant
         for somebody, so those go as a report like any other. */
      if (!said.trim()) return;
    }
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice() };
      const idx = next.items.findIndex((i) => i.id === parentItem.id);
      if (idx < 0) return cur;
      const it = { ...next.items[idx] };
      it.flags = (it.flags || [])
        .filter((f) => !(f.kind === kind && f.ex === exercise.type && f.subId === (exercise.subId || null)))
        .concat([
          { kind, ex: typeOf(exercise.type), subId: exercise.subId || null, note: said, at: now() },
        ]);
      it.updated = now();
      next.items[idx] = it;
      return next;
    });

    if (!account) {
      flash("Noted on this device. Sign in to report it.", "warn");
      return;
    }
    /*
     * The report itself, which is the same object whether it goes now or
     * later: it carries a copy of the question rather than a pointer to
     * the card, so it still says something after a fortnight in a queue —
     * which is the property that makes it safe to keep at all.
     */
    const report: API.FlagReport = {
      kind,
      note: said,
      /* The card's id on the server, which is not the item's id here:
         course material arrives as items named srv<cardId>, and a report
         naming the local one points at nothing an administrator can open. */
      cardId: serverCardId(parentItem),
      /* The exercise, not which of the card's accepted answers it was
         about: a teacher reading the report opens the card, and the
         schedule key would name a thing only this device tracks. */
      exercise: typeOf(exercise.type),
      subId: exercise.subId || null,
      /* The id, not the pack: what is stored has to survive being read by
         a build whose pack for it has moved on. */
      language: qLang.id,
      /* A copy of the question, not a pointer to it: the card can be
         edited or withdrawn between the flag and somebody reading it, and
         a report that says only "card k3f2" is then unreadable. */
      prompt: leadOf(parentItem).ar || "",
      meaning: leadOf(parentItem).en || "",
      /* Where the card reached this device from. A bad card is usually one
         of a bad batch, and the deck is what somebody goes and looks at.
         Absent on a card the learner made, which came through neither. */
      courseId: (fromDeck(parentItem) || { courseId: "" }).courseId || "",
      deckId: (fromDeck(parentItem) || { deckId: "" }).deckId || "",
      /* What they put, and what the app made of it — the half of "it
         marked me wrong" that the learner cannot be expected to type out
         and that usually names the bug on its own.

         Character for character, untrimmed: a trailing space or a stray
         mark is exactly the sort of thing that makes a right answer come
         back wrong, and it is the one thing a learner writing the report
         out by hand would never think to mention. Trimming here would
         throw away the answer this field exists to give. */
      answer: String(typed || "").slice(0, 200),
      verdict: flagVerdict(),
      /* Which build, so a report can be matched against what was running.
         The release alone is two or three deploys. */
      release: APP_BUILD,
      /* Which filled sentence this was, where the card is a frame — so the
         teacher reading the report can strike exactly this one. */
      ...(item && (item as any).reviewKey ? { sentence: String((item as any).reviewKey) } : null),
    };

    /*
     * Offline, it waits rather than being dropped.
     *
     * It used to be sent once, and a failure was answered with "Noted on
     * this device" — which was true only in the sense that the note was
     * written onto the card for the learner's own eyes. Nothing ever sent
     * it, so a problem reported on a train was a problem nobody heard
     * about, while the guide promised that anything done offline is sent
     * when a connection returns.
     */
    if (isOffline()) {
      keepPending(FLAG_OUTBOX, report);
      setToSend(waitingToSend(FLAG_OUTBOX));
      flash("Saved — it will be sent when you're back online", "good");
      return;
    }
    API.reportFlag(report)
      .then(() => flash("Thank you for the feedback 🫶", "good"))
      .catch((e) => {
        /* A refusal is the server having decided, and asking again would
           be told the same thing; anything else never arrived, so it
           waits. `offline` is what the client calls a request that could
           not be made at all. */
        if (String((e && (e as Error).message) || e) !== "offline") {
          flash("Noted on this device. We couldn't reach the server.", "warn");
          return;
        }
        keepPending(FLAG_OUTBOX, report);
        setToSend(waitingToSend(FLAG_OUTBOX));
        flash("Saved — it will be sent when you're back online", "good");
      });
  }

  /*
   * Move the form that was asked up one level of its ladder.
   *
   * Every exercise on the level it stands on — and any below that the next
   * level asks more of — is counted as learnt, so the next level opens from
   * the next session; the next level itself is not touched. A form already
   * on the top level is counted as mastered instead. The rule is
   * liftLevel's; what this adds is which form, which keys, and the write.
   * The keys are the form's own ladder (laddered), not the ones open right
   * now: a listening exercise silenced for a quarter of an hour is still a
   * rung to be climbed, and a lift that skipped it would leave the next
   * level shut.
   *
   * On the spot rather than on Continue, because the message under the
   * button says it has happened — and the grading on Continue then skips
   * this form (see easedFor). A trial records nothing, as it records
   * nothing else.
   */
  function liftCurrent() {
    if (!item || !parentItem || !exercise) return;
    if (session && session.trial) {
      flash("A trial records nothing — the card is not yours to move.", "warn");
      return;
    }
    /*
     * The ladder off the *stored* form, not off the question.
     *
     * `item` is the question as it is being asked — one spelling of the
     * card's two, one of its meanings, its blanks filled — and the keys a
     * form climbs with are read off how many accepted answers it has. So on
     * a card that accepts two spellings the narrowed copy has one, the keys
     * came back bare, and flagging the *second* spelling's question raised
     * the first spelling's states: the message said the level had moved and
     * nothing opened. resolveUnit hands back the form as it is stored,
     * which is also the form written to below.
     */
    const stored = resolveUnit(asking, exercise);
    if (!stored) return;
    const keys = laddered(stored.unit, settings);
    const above = hasLevelAbove(keys, exercise.type);
    setEasedFor(exercise);
    persist((cur) => {
      const next = { ...cur, items: cur.items.slice() };
      const idx = next.items.findIndex((i) => i.id === parentItem.id);
      if (idx < 0) return cur;
      const it = { ...next.items[idx] };
      const subId = exercise.subId || null;
      const target = subId
        ? formsOf(it).find((x) => x.id === subId) || linesOf(it).find((x) => x.id === subId)
        : leadOf(it);
      if (!target) return cur;
      const lifted = liftLevel(keys, (k) => statesOf(target)[k], exercise.type);
      if (!Object.keys(lifted).length) return cur;
      const grown = (x: Form) => ({ ...x, s: { ...x.s, ...lifted }, updated: now() });
      if (subId && linesOf(it).some((x) => x.id === subId)) {
        it.lines = linesOf(it).map((x) => (x.id === subId ? grown(x) : x));
      } else {
        const asked = subId || leadOf(it).id;
        it.forms = formsOf(it).map((x) => (x.id === asked ? grown(x) : x));
      }
      it.updated = now();
      next.items[idx] = it;
      return next;
    });
    flash(
      above
        ? "Moved up a level. It comes back at the next one."
        : "Already at the top — counted as learnt.",
      "good",
    );
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
    /* This question, and no other: the mark names the question it was
       made on, so a session that ended on it cannot carry it into the
       next one. Put down once read. */
    const eased = easedFor === exercise;
    setEasedFor(null);
    /*
     * What the answer counts as, and what it marks.
     *
     * Both are grade.ts's to answer now. What is left here is the half
     * that is genuinely the screen's: which pieces of it were on when
     * Continue was pressed, and which words a grid put up.
     */
    const how = { checked, toldAnswer, overridden, skipped, hintAtAnswer };
    const { correct, rating } = verdictOf(how);
    const marks = marksForAnswer({
      exercise,
      item,
      parentItem,
      asking,
      settings,
      systems,
      correct: !!correct,
      rating,
      practice: !!practice,
      grid: spec && spec.picks === "pair" ? gridMarks() : null,
    });
    /* Filled in by the write below and read after it. `persist` calls its
       function there and then rather than queuing it, so by the time this
       is read it holds what this answer actually moved. */
    let moving: { id: string; move: Move }[] = [];
    const prep = prepOf(settings);
    const forPrep = !!prep && prepDeckOf(prep.decks)(parentItem);
    persist((cur) => {
      const graded = gradeInto(cur.items, marks, {
        ...gradingFor(exercise, settings),
        /* The question a lift has already moved up its ladder: answered,
           and neither rewarded nor lapsed. */
        spare: eased ? { id: parentItem.id, subId: exercise.subId || null } : null,
        how,
      });
      /* Nothing written — every card named has been withdrawn, or the one
         mark was the question the lift moved — so the document is left
         exactly as it was. */
      if (!graded) return cur;
      /*
       * And what this answer moved, worked out here because here is the
       * only place that holds the card both before and after it.
       *
       * A card's standing afterwards says where it is, never that it
       * arrived there tonight, and nothing on a card records the day it
       * moved. So the comparison has to be made at the moment, or the
       * fact is gone — which is why both the screen at the end of the
       * session and the lines on Progress are fed from this one place
       * rather than worked out twice from different evidence.
       */
      const day = dayKey();
      const stirred = movesAmong(cur.items, graded, marks, settings);
      moving = stirred;
      const kept = (cur.moves || {})[day];
      const tally = {
        up: (kept && kept.up) || 0,
        cleared: (kept && kept.cleared) || 0,
        learnt: (kept && kept.learnt) || 0,
      };
      for (const { move } of stirred) tally[move] += 1;
      return {
        ...cur,
        items: graded,
        ...tallyAnswer(cur, day, forPrep),
        ...(stirred.length ? { moves: { ...(cur.moves || {}), [day]: tally } } : null),
      };
    });
    /* Onto the session's own list, outside the write: `persist` runs its
       function there and then, so this is the same answer's news. */
    if (moving.length) setMoved((was) => mergeMoves(was, moving));
    setTally((t) => ({
      ok: t.ok + (correct ? 1 : 0),
      no: t.no + (correct ? 0 : 1),
    }));

    if (!correct) {
      setSession((s2: any) => ({
        ...s2,
        exercises: requeueMissed(s2.exercises, qi + 1, exercise),
      }));
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

  /*
   * The learner asks for a card, or stops asking.
   *
   * Its own path rather than a patch through updateItem, and the reason is
   * the lock. Cards come from courses and a course card is locked, which is
   * the app saying the wording is the teacher's — but what a learner wants
   * to practise is not the wording, and a lock that refused this would be
   * refusing them the one card they came to the list for. So it is written
   * straight, on any card, and nothing else about the card moves.
   */
  function setPriority(id: string, on: boolean) {
    persist({
      ...data,
      items: items.map((i) =>
        /* Stamped, and stored as `false` rather than removed when it is
           cleared: the merge takes whichever device said something about
           the mark most recently, and "no longer wanted, as of then" has
           to be able to beat an older yes. Without the stamp the mark was
           simply lost the next time the other device answered the card —
           see `priorityAt` in types.ts. */
        i.id === id ? { ...i, priority: on, priorityAt: now(), updated: now() } : i
      ),
    });
    flash(on ? "Marked — it is in your next session" : "No longer high priority");
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
        /* A patch is a card the editor has handed back, so its words belong
           to the card's own form and the rest of it to the card. Which is
           which is asked of the fields a form has — the three words, its
           recordings and whatever grammar the languages declare. */
        const lead: Record<string, any> = { ...leadOf(i), updated: now() };
        for (const [k, v] of Object.entries(patch)) {
          if (k === "subs" || k === "s" || k === "forms") continue;
          if (k === "tags") next.tags = cleanTags(v);
          else if (FORM_FIELDS.has(k)) lead[k] = typeof v === "string" ? v.trim() : v;
          else (next as Record<string, any>)[k] = typeof v === "string" ? v.trim() : v;
        }
        {
          const old = new Map(subFormsOf(i).map((x) => [x.id, x]));
          const rest = (patch.subs || subFormsOf(i)).map((draft: Record<string, any>) => {
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
          next.forms = [lead as Form, ...rest];
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

  /* The one prep, set, changed or cleared from Prep mode — see Prep. */
  const savePrep = (p: Prep | null) => {
    setSetting("prep", p);
    flash(p ? `Prepping for ${p.name}` : "Prep cleared");
  };

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

  /* The time a timed session's clock reads: now, or the moment it was
     paused. Holding it there is the whole of pausing — SessionClock reads
     the same moment, so neither the countdown nor the bar moves until play
     is pressed, and here it decides whether the time is up. */
  const clock = session && session.pausedAt ? session.pausedAt : Date.now();

  /* Seconds remaining on a timed session, or null when it's counted.
     This has to sit above the early return below: a hook that only runs on
     some renders is React error #310. */
  const timeLeft =
    session && session.endsAt ? Math.max(0, Math.ceil((session.endsAt - clock) / 1000)) : null;

  /* Pause or carry on with a timed session. Carrying on moves the start and
     the end later by however long it sat paused, so the time left is what
     it was when pause was pressed and the bar picks up where it stopped.
     Whatever is playing stops too: a pause that keeps talking is not one. */
  function togglePause() {
    if (!session || !session.endsAt) return;
    if (!session.pausedAt) document.querySelectorAll("audio").forEach((a) => a.pause());
    setSession((s: any) => {
      if (!s || !s.endsAt) return s;
      if (!s.pausedAt) return { ...s, pausedAt: now() };
      const gap = now() - s.pausedAt;
      return { ...s, startedAt: s.startedAt + gap, endsAt: s.endsAt + gap, pausedAt: 0 };
    });
  }

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

  /*
   * What the corner menu says about sync.
   *
   * One line, and it used to say one of three things — syncing, "Offline —
   * will retry", or up to date — with the middle one standing for every
   * way a sync can fail. Two of those never clear by themselves, so a
   * learner whose passphrase had been refused or whose collection had
   * outgrown the limit was told, once a minute for ever, that they were
   * offline and it would sort itself out.
   *
   * Offline comes first because it explains every other failure under it,
   * and it says where the work is rather than only what is missing: the
   * answer to "am I losing anything?" is no, and that is the question
   * behind the look at the dot.
   */
  const syncNote = offline
    ? `Offline — your work is saved on this device${
        toSend ? ` · ${plural(toSend, "report")} to send` : ""
      }`
    : syncState === "syncing" || spacesBusy || (syncState === "idle" && courseBusy)
    ? "Syncing now"
    : syncState === "error"
    ? syncError || "Sync failed"
    : "Up to date";

  return (
    <div
      className={`at ${theme}${inExercise ? " in-exercise" : ""}${kbOpen ? " kb-open" : ""}${
        inExercise && session.pausedAt ? " paused" : ""
      }`}
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
            {/* Where it is most likely to be read by the person it is for:
                above what they came here to do, once, and gone for good on
                a tap. See useInstallOffer for why installing is the one
                thing that keeps an offline app's data safe on iOS. */}
            {/* Recordings that are not here yet, said at the moment it
                starts to matter. Offline, a card whose sound was never
                downloaded sits out its listening questions — so a journey
                is quietly a quieter session, and the place to find that
                out is not halfway through it. Only while offline and only
                while there is something to fetch, so it is never a
                standing nag. */}
            {offline && missingClips > 0 && !inExercise && (
              <div className="at-mb3">
                <Notice kind="warn">
                  <span>
                    {`${plural(missingClips, "recording")} isn't on this device, so questions that
                      play ${missingClips === 1 ? "it" : "them"} are being held back. `}
                    <button className="at-linkbtn" onClick={() => setScreen("account")}>
                      Download when you&apos;re back online
                    </button>
                  </span>
                </Notice>
              </div>
            )}
            {install.show && !inExercise && (
              <div className="at-mb3">
                <Notice kind="info">
                  <span>
                    Add Taleb33 to your home screen to keep your cards safe and open it like an
                    app.{" "}
                    {install.prompt ? (
                      <button className="at-linkbtn" onClick={() => install.prompt?.prompt()}>
                        Install
                      </button>
                    ) : (
                      <i>Use your browser&apos;s Share menu, then &ldquo;Add to Home Screen&rdquo;.</i>
                    )}{" "}
                    <button className="at-linkbtn" onClick={install.dismiss}>
                      Not now
                    </button>
                  </span>
                </Notice>
              </div>
            )}
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
                {/* The count of what is waiting rides on the card as an
                    attribute rather than a line of text: nothing reads it at
                    runtime, and it is here so the walk through the app can
                    still check that the right cards are being counted after
                    the number came off the screen. */}
                {/* While there is a prep, it has the top of the screen to
                    itself: how far along its decks are, the button that
                    takes them further, and today's sessions against what
                    today needs — see PrepLine. The climb over everything is
                    left off, so the one number on the screen is the one the
                    learner set themselves. */}
                {homePrep && (
                  <div className="at-card at-preptile at-mb3">
                    <Climb items={shown.filter(prepDeckOf(homePrep.decks))} settings={settings} target={homePrep.target} />
                    <div className="at-row">
                      <Button variant="primary" onClick={() => begin(false, prepDeckOf(homePrep.decks))}>
                        Prep for {homePrep.name}
                      </Button>
                    </div>
                    <PrepLine
                      prep={homePrep}
                      collection={shown}
                      settings={settings}
                      perDay={prepPerDay}
                      today={(data.prepLog || {})[dayKey()] || 0}
                    />
                  </div>
                )}
                <div className="at-card" data-ready={readyCount}>
                  {/* How far along the learner is, above the button that
                      takes them further — unless a prep has the top tile. */}
                  {!homePrep && <Climb items={shown} settings={settings} />}

                  <div className="at-row">
                    {/* Always live while there is anything to drill. Being
                        due decides what a session leads with, not whether
                        there is one — so a learner who is up to date, or
                        partway through the app's own pacing of new cards,
                        is offered more of what they hold rather than a
                        greyed-out button and silence. */}
                    {/* One primary button on the screen: under a prep it is
                        the prep's, and this is the next thing along. */}
                    <Button variant={homePrep ? undefined : "primary"}
                      onClick={() => begin(false)}
                      disabled={!drillable.length}
                    >
                      {readyCount ? "Start session" : "Practise anyway"}
                    </Button>
                  </div>
                  {/* And the other kind of session there is a one-tap case
                      for: everything going wrong, worst first. It sits
                      directly under Start session because it is the same
                      offer narrowed — a session, dealt for you — rather
                      than something to be assembled, and because the
                      moment to reach for it is the moment you have just
                      seen the ladder say a level is paused.

                      Always shown, and dimmed when there is nothing to fix.
                      The app's habit is to leave out a button that would
                      open on an empty screen, but a learner has to be able
                      to find this one to learn what it does.

                      Dimmed, and still worth pressing: `off` rather than
                      `disabled`, so the press arrives and is answered with
                      the reason. That line used to sit beside the button on
                      every single day, saying what is slipping and how
                      much — a standing caption for a question nobody had
                      asked yet. It is said now on the one occasion it is an
                      answer, which is the moment somebody presses the
                      button and nothing happens. */}
                  <div className="at-row at-mt3">
                    <Button variant="ghost"
                      off={!weakCount}
                      onClick={() =>
                        weakCount
                          ? beginWeak()
                          : flash("There is no weak skill to fix right now")
                      }
                    >
                      Weak skills
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
                    <>
                      <div className="at-row at-mt3">
                        <Button variant="ghost" onClick={() => setShowingSaved(true)}>
                          Saved sessions
                        </Button>
                      </div>
                      <SavedTiles
                        sessions={savedSessions}
                        items={items}
                        settings={settings}
                        onStart={startSaved}
                      />
                    </>
                  )}

                  {!readyCount && drillable.length > 0 && (
                    <Help>
                      {`Nothing is due. ${nextDueLine(drillable, settings)} Practising now is
                        welcome and won't move your schedule much.`}
                    </Help>
                  )}
                  {!drillable.length && items.length > 0 && (
                    <Notice kind="warn">
                      No card here has two usable exercise types. A card needs the{" "}
                      {langOf(settings).scriptLabel} and at least one more field
                      before it can be practiced.
                    </Notice>
                  )}
                </div>
              </>
            )}

            {session && session.learnt && session.learnt.length > 0 && qi === 0 && (
              <Help className="at-learntnote">
                Already learnt, so not in this session:{" "}
                {session.learnt.map((x: Item) => leadOf(x).en || leadOf(x).ar || leadOf(x).lat).join(", ")}
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
                      {timeLeft !== null ? (
                        <SessionClock
                          startedAt={session.startedAt}
                          endsAt={session.endsAt}
                          pausedAt={session.pausedAt || 0}
                        />
                      ) : (
                        <>
                          <span className="at-count" data-el="session-count">
                            {`${qi + 1} / ${session.exercises.length}`}
                          </span>
                          <div className="at-progress" data-el="session-progress">
                            <i style={{ width: `${(qi / session.exercises.length) * 100}%` }} />
                          </div>
                        </>
                      )}
                      {/* Only a clock can be paused: a counted session
                          already waits for as long as you take. */}
                      {timeLeft !== null && (
                        <button
                          type="button"
                          className="at-pause"
                          aria-label={session.pausedAt ? "Carry on" : "Pause"}
                          aria-pressed={!!session.pausedAt}
                          data-el="session-pause"
                          onClick={togglePause}
                        >
                          <Icon name={session.pausedAt ? "play" : "pause"} size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* While paused the question is hidden rather than taken
                    away, so what was typed is still there to carry on
                    from, and nobody gets free thinking time on it. */}
                {session.pausedAt ? (
                  <div className="at-pausednote" data-el="session-paused">
                    <p className="at-eyebrow">Paused</p>
                    <Button variant="primary" icon="play" onClick={togglePause}>
                      Carry on
                    </Button>
                  </div>
                ) : null}

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
                <div className="at-exercise" data-el="card" data-card={parentItem ? parentItem.id : undefined}>
                  <p className="at-instruction" data-el="question-instruction">
                    {/* A text is read, not listened in on: its two
                        questions say so in their own words. */}
                    {dialog && isText(dialog) && spec.promptField === "scene"
                      ? spec.intro
                        ? "Read the text"
                        : "Read the whole text"
                      : instructionFor(spec, item)}
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
                    ) : spec.promptField === "clock" ? (
                      /* The one question about a clock no word can ask.
                         Drawn rather than written out, and said in words
                         beside it for anybody not looking at the picture —
                         a screen reader handed a dial to interpret is a
                         screen reader asked to do the exercise. */
                      <ClockFace
                        hour={Number(item.hour) || 0}
                        minute={Number(item.minute) || 0}
                        fine={(Number(item.minute) || 0) % 5 !== 0}
                        label={`${Number(item.hour) || 0}:${String(Number(item.minute) || 0).padStart(2, "0")}`}
                      />
                    ) : spec.promptField === "image" ? (
                      /* One of the card's pictures, in place of the English:
                         what the word means, shown. The first one — a card
                         with several is a teacher's choice of which to lead
                         with, and it is the one the tiles use too. */
                      <CardPicture
                        hash={(Array.isArray(item.images) && item.images[0]) || ""}
                        className="prompt"
                      />
                    ) : spec.promptField === "audio" ? (
                      /* A context question plays the whole phrase, not the
                         word: hearing it in running speech is the exercise.
                         Everything else plays the card's own recording.

                         A time plays two: the hour and the minutes, one
                         after the other. It is the only place two
                         recordings are ever joined, and they are played in
                         order rather than stitched — the joins are where a
                         dialect lives. */
                      <AudioPrompt
                        recs={context ? context.recs : audibleOf(item)}
                        after={context ? [] : chainOf(item)}
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
                        /* A number met in the figures English uses is met
                           in the language's own beside them, so ٤٧ is
                           known by the time the top of the ladder asks
                           from it alone. Not where those are the answer:
                           47 alone, asked to be written as ٤٧. */
                        value={
                          spec.promptField === "en" && item.numeral && item.en && spec.answerField !== "numeral"
                            ? `${item.numeral} · ${item.en}`
                            : item[spec.promptField]
                        }
                        field={spec.promptField}
                        kind={item.kind}
                        name="question-prompt-text"
                      />
                    )}
                    {/* Which form of the card is being asked, only where
                        the prompt does not already settle it — see
                        formTagsAt. Anywhere else it is said beside the
                        answer instead.

                        Under the word it is about, not after the
                        instruction: "feminine" is a fact about *big*, and a
                        learner reported looking for it there.

                        And nothing at all where the language declares no
                        grammar to say it with: Huế has none. */}
                    {tagsAt.question && (
                      <p className="at-asktag" data-el="question-form-tag">
                        {formLabelText}
                      </p>
                    )}
                    {/* And what the words in a sentence's blanks are,
                        where English says "your" for three Arabic words —
                        see lentTags. Without it a question asking for the
                        Arabic of "Your name is Shams" could not say which
                        of them it wanted. Not under the Arabic itself,
                        where it is the English answer. */}
                    {tagsAt.lentQuestion && (
                      <p className="at-asktag" data-el="question-fill-tag">
                        {lentLines.join(" · ")}
                      </p>
                    )}
                    {/* What the phrase means, where the phrase is on the
                        screen with its gap: the learner works out which
                        word is missing from the sentence around it. It was
                        the missing word's own meaning, which is the one
                        thing the card's own questions already ask — a
                        learner reported it made the exercise pointless.
                        The Arabic around the gap is what settles which word
                        it is, so a phrase meaning "close the door please"
                        does not leave three answers open.

                        Heard rather than read, the phrase has no gap to
                        point at, so there it is still the word's meaning
                        that says which word to write. And a phrase written
                        without its English falls back to the word's. */}
                    {context && (
                      <p className="at-ctxmeaning" data-el="question-context-meaning">
                        {(spec.promptField === "context" && context.en) || item.en}
                      </p>
                    )}
                  </div>

                  {hintShown && item[spec.hintField] && (
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
                    {spec.answerMode === "read" ? null : spec.answerMode === "dial" ? (
                      /* The hands, dragged. What a learner does with a
                         clock is set it, so this is the answer in the form
                         the skill is actually used in — and it is a pair
                         of sliders as well, because a dial is what a
                         keyboard and a screen reader cannot use. */
                      <ClockDial
                        hour={dialAt.hour}
                        minute={dialAt.minute}
                        marks={dialMarks}
                        clock={dialClock}
                        disabled={!!checked}
                        onChange={(h, m) =>
                          setTyped(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
                        }
                      />
                    ) : spec.answerMode === "order" ? (
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
                          wordTags={gridTags.words}
                          meaningTags={gridTags.meanings}
                          lang={qLang}
                          askedId={(item && item.id) || ""}
                          checked={!!checked}
                          onChange={setTyped}
                          onPairs={setMatched}
                          field={spec.answerField === "ar" ? "ar" : "en"}
                          heard={spec.tiles === "audio"}
                        />
                        {/* A grid half done is not an answer, and a Check
                            that sits dead without saying why is the button
                            people tap twice and then give up on. */}
                        {!checked && !typed && <Help>Pair them all, then check.</Help>}
                      </>
                    ) : spec.picks === "image" ? (
                      <PictureChoices
                        options={choices}
                        value={typed}
                        disabled={!!checked}
                        onChange={setTyped}
                      />
                    ) : spec.picks ? (
                      <TextChoices
                        options={choices}
                        kind={spec.picks === "word" ? "word" : "phrase"}
                        field={spec.picks === "meaning" ? "en" : "ar"}
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
                            : figures || ownFigures
                              ? "at-figwrap"
                              : undefined
                        }
                      >
                        {spelling ? (
                          /* In the box's place rather than under it: the
                             answer they wrote is already the thing on the
                             screen, and a second copy of it with the marks
                             on would be the same word twice with only one
                             of them worth reading. The box is read-only by
                             now, so nothing is taken away. */
                          <Spelt
                            runs={spelling.yours}
                            lang={qLang}
                            name="answer-spelt"
                            className="at-input ar no at-spelt"
                          />
                        ) : (
                        <input
                          ref={inputRef}
                          /* "ar" here means the language's own script, so the
                             input is declared as that language — not as Arabic,
                             which sent Vietnamese answers through an Arabic
                             spellchecker and read them out as Arabic. */
                          lang={spec.answerMode === "ar" || ownFigures ? qLang.id : undefined}
                          dir={spec.answerMode === "ar" ? qLang.direction : ownFigures ? "ltr" : undefined}
                          className={`at-input${spec.answerMode === "ar" ? " ar" : ""}${
                            figures || ownFigures ? " fig" : ""
                          }${ownFigures ? " own" : ""}${checked ? (checked.ok ? " ok" : " no") : ""}`}
                          data-el="answer-input"
                          /* A number in figures and nothing else: a phone's
                             number pad, not its letters. Not a time — the
                             pad has no colon. A number written out in the
                             language's script is an "ar" answer, not one of
                             these, and keeps its letters and on-screen keys. */
                          /* And in the language's own figures, the keys
                             under the box are the keyboard: a phone's own
                             would only offer 4 for ٤, so it stays down.
                             Asking for no keyboard is not enough — some
                             phone browsers raise one anyway when the box
                             takes focus — so the box is read-only to the
                             phone and the pad writes into it. A computer's
                             own keys can still write the figures, below. */
                          inputMode={figures ? "numeric" : ownFigures ? "none" : undefined}
                          autoComplete={figures || ownFigures ? "off" : undefined}
                          value={typed}
                          readOnly={!!checked || ownFigures}
                          placeholder={figures ? "Type the number" : ownFigures ? ownPrompt : spec.placeholder}
                          onChange={(e) => setTyped(e.target.value)}
                          /* Only the Check button checks. Enter — and a
                             phone keyboard's Go, which is the same key —
                             used to, and a learner reaching for a letter
                             on the keyboard's bottom row sent a half-typed
                             answer to be marked. The key now does nothing,
                             and says so: "done" rather than "go". */
                          enterKeyHint="done"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                            /* The read-only box takes nothing typed, so a
                               keyboard that does have ٤ on it — or a colon,
                               or backspace — goes through the pad's own
                               hands. Only the language's figures: 4 is
                               not ٤, and accepting it would answer the
                               question for them. */
                            if (!ownFigures || checked || e.ctrlKey || e.metaKey || e.altKey) return;
                            const own = Array.from({ length: 10 }, (_, d) => String(qLang.numerals?.(d) || ""));
                            if (own.includes(e.key) || e.key === ":") {
                              e.preventDefault();
                              caretInsert(inputRef, typed, setTyped, e.key);
                            } else if (e.key === "Backspace") {
                              e.preventDefault();
                              caretBackspace(inputRef, typed, setTyped);
                            }
                          }}
                        />
                        )}
                        {figures && !checked && !typed && (
                          /* The number box's prompt, drawn over it rather
                             than as its placeholder. The field keeps the
                             digits' large type while empty, so the caret
                             waiting in it is the height of what will be
                             typed; a placeholder that small inside type
                             that large sits on its baseline, low in the
                             box. The placeholder is still there, unseen,
                             for whatever reads the field aloud. */
                          <span className="at-figprompt" aria-hidden="true">
                            Type the number
                          </span>
                        )}
                        {ownFigures && !checked && !typed && (
                          <span className="at-figprompt own" aria-hidden="true">
                            {ownPrompt}
                          </span>
                        )}
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

                  {!checked && ownFigures && (
                    <NumeralPad
                      lang={qLang}
                      clock={String(item[spec.answerField] || "").includes(":")}
                      deal={qi}
                      onKey={(ch) => caretInsert(inputRef, typed, setTyped, ch)}
                      onBack={() => caretBackspace(inputRef, typed, setTyped)}
                      onClear={() => setTyped("")}
                    />
                  )}
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
                          ? spec.tiles === "audio"
                            ? HEARD_GRID_VERDICT
                            : GRID_VERDICT
                          : WRONG_VERDICT}
                      </p>
                      {!skipped && !checked.ok && checked.reason !== "wrong" && (
                        <Help data-el="verdict-reason">{verdictText(checked, qLang)}</Help>
                      )}
                      {/* Right, and the spelling it should have had is
                          underneath: one letter out of the English is a
                          slip, not a miss — see checkEn. */}
                      {checked.ok && checked.reason === "typo" && (
                        <Help data-el="verdict-typo">One letter out — counted as right. It is spelt:</Help>
                      )}
                      {/* Said rather than done quietly: the answer was
                          right and the spelling is theirs, but the word
                          was on the screen in another alphabet while they
                          wrote it, so it is marked the way a near miss is
                          and comes round again. A learner who is told that
                          can close the nudge next time. */}
                      {toldAnswer && (
                        <Help data-el="verdict-hinted">
                          Right — but the {String(qLang.translitLabel || "hint").toLowerCase()} was on
                          screen, so this one counts as a near miss and comes round again.
                        </Help>
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
                          ) : spelling && spelling.one ? (
                            /* The answer with the letters they did not
                               write marked — which is the only mark there
                               is when a letter was left out rather than
                               written wrong, and so the half that a word
                               typed one letter short depends on entirely.

                               Only where the card accepts one spelling.
                               Where it accepts several the point of the
                               line is that any of them is right, and
                               pointing at the letters of one would be
                               quietly withdrawing the others. */
                            <Spelt
                              runs={spelling.theirs}
                              lang={qLang}
                              name="answer-value-text"
                              className={`at-arabic ${item.kind || "word"}`}
                            />
                          ) : spec.answerField === "images" ? (
                            /* The picture that was wanted, which is the
                               answer to a question asked in pictures. */
                            <CardPicture
                              hash={(Array.isArray(item.images) && item.images[0]) || ""}
                              className="answer"
                              alt="The right picture"
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
                      {/* What the words in the sentence's blanks were, where
                          their English leaves it open: "Your name: plural".
                          A learner answered *their* twice and reported that
                          the answer never said who was being spoken to —
                          see lentTags. Shown whatever the verdict, since a
                          right answer in English was no less ambiguous. */}
                      {/* Which form of the card it was, on every question
                          about a card with more than one: "feminine",
                          "you · plural". The prompt says so only where it
                          has to; this is where a learner looks for it —
                          see formTagsAt. */}
                      {tagsAt.answer && (
                        <p className="at-asktag" data-el="answer-form-tag">
                          {formLabelText}
                        </p>
                      )}
                      {tagsAt.lentAnswer && (
                        <p className="at-asktag" data-el="answer-fill-tag">
                          {lentLines.join(" · ")}
                        </p>
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
                          {say("wroteForm", { form: gaveLabel })}
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
                      {/* Not under a grid. Everything in the box is about
                          one card, and a grid is five: it spoke of the
                          first word alone, without saying which. The
                          owner's call was to leave it out rather than
                          make it five times as long. */}
                      {spec.picks !== "pair" && (
                      <AlsoBox>
                        {/* The phrase it appeared in, whole, and what it
                            means. A gap question showed that meaning with
                            the gap; every other question held it back
                            until now, where it would have given the game
                            away before. */}
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
                              How it's written
                            </p>
                            <Field value={item.ar} field="ar" kind={item.kind} name="also-script-text" />
                          </div>
                        )}
                        {/* A number, in the figures the language writes
                            it in: 47 is ٤٧ on a price tag. Not where the
                            question already showed them — asked from
                            them, or beside the figures English uses. */}
                        {item.numeral &&
                          spec.promptField !== "numeral" &&
                          spec.promptField !== "en" &&
                          spec.answerField !== "numeral" && (
                          <div className="at-answeralso" data-el="also-figures">
                            <p className="at-alsolabel" data-el="also-figures-label">
                              In {qLang.numeralsLabel || `${qLang.scriptLabel} figures`}
                            </p>
                            <Field value={item.numeral} field="numeral" name="also-figures-text" />
                          </div>
                        )}
                        {/* The field the question never showed.
                            
                            It was whatever the exercise offers as a hint
                            *during* the question, which is a different
                            thing and left the ones that offer none with
                            nothing to learn more about: "Choose the
                            meaning" put up the word and its meaning, and
                            then had no box at all — though how it is
                            pronounced was exactly the thing nobody had
                            said. Where an exercise names a hint that is
                            still what is shown; where it names none, the
                            field neither the prompt nor the answer used
                            is the one worth having. */}
                        {alsoField && item[alsoField] && (
                          <div className="at-answeralso" data-el="also-hint">
                            <p className="at-alsolabel" data-el="also-hint-label">
                              {alsoField === "lat"
                                ? "How it's pronounced"
                                : alsoField === "ar"
                                ? "How it's written"
                                : "This is what it means"}
                            </p>
                            <Field
                              value={item[alsoField]}
                              field={alsoField}
                              kind={item.kind}
                              name="also-hint-text"
                            />
                          </div>
                        )}
                        {/* Was below the notes, which put it three blocks
                            away from its own siblings. It belongs with
                            them. A time is its hour and its minutes, one
                            after the other — see audibleOf. */}
                        {spec.promptField !== "audio" && audibleOf(item).length > 0 && (
                          <div className="at-answeralso" data-el="also-audio">
                            <p className="at-alsolabel" data-el="also-audio-label">
                              How it sounds
                            </p>
                            <AudioPrompt recs={audibleOf(item)} after={chainOf(item)} lead={leadSpeed(item)} />
                          </div>
                        )}
                        {/* Asked here rather than inside RelatedWords: an
                            element that renders null is still an element,
                            and the box counts what it was given. */}
                        {pairs && pairs.length > 0 && (
                          <RelatedWords pairs={pairs} settings={qSettings} />
                        )}
                      </AlsoBox>
                      )}
                      {/* The teacher's note, for the same reason: under a
                          grid it was the first word's, unnamed. */}
                      {item.note && spec.picks !== "pair" && (
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
                            label={hintShown ? spec.hintHideLabel : spec.hintLabel}
                            className={`at-hintbtn${hintShown ? " on" : ""}`}
                            data-el="hint-button"
                            aria-pressed={hintShown}
                            /* Either way round, the hint has been on the
                               screen: opening puts it there, closing means
                               it was there. */
                            onClick={() => {
                              setHintUsed(true);
                              setHintOpen(!hintShown);
                            }}
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
                    : /*
                       * Which kind of session this was.
                       *
                       * A session may now be dealt from cards that were not
                       * yet due, so "every gap just got longer" is not true
                       * of all of them — a card answered soon after the
                       * last time barely moves, by design. Saying so is
                       * what keeps the offer honest: practising ahead is
                       * welcome, and it is not the same as getting through
                       * your schedule.
                       */
                    session.due === 0
                    ? "None of these were due, so your schedule has barely moved. The practice still counts."
                    : session.items && session.due && session.due < session.items
                    ? `${session.items - session.due} of these weren't due yet and have barely moved.`
                    : tally.no === 0
                    ? "Clean run. Every gap just got longer."
                    : `${tally.no} lapsed and will come back shortly.`}
                </Help>
                <WhatMoved moved={moved} items={items} settings={settings} />
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
            items={shown}
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
            onPriority={setPriority}
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
            items={shown}
            myCourses={myCourses}
            settings={settings}
            moves={data.moves}
            perDay={perDay}
            prep={prepOf(settings)}
            onPrep={savePrep}
          />
        )}

        {/* ============ SETTINGS ============ */}

        {building && (
          <ManualSessionSheet
            items={shown}
            allTags={allTags}
            settings={settings}
            onStart={beginManual}
            onSave={keepSession}
            onClose={() => setBuilding(false)}
          />
        )}

        {showingSaved && !editingSaved && (
          <SavedSessionsSheet
            sessions={savedSessions}
            items={items}
            onStart={(s) => {
              setShowingSaved(false);
              startSaved(s);
            }}
            onEdit={setEditingSaved}
            onDelete={dropSession}
            onClose={() => setShowingSaved(false)}
          />
        )}

        {/* The Build screen again, opened on what was kept. Saving goes
            back to the list, which is where it was opened from. */}
        {editingSaved && (
          <ManualSessionSheet
            items={shown}
            allTags={allTags}
            settings={settings}
            editing={editingSaved}
            onStart={beginManual}
            onSave={(changed) => {
              changeSession(editingSaved.id, changed);
              setEditingSaved(null);
            }}
            onClose={() => setEditingSaved(null)}
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
              langsOff={teachLangsOff}
              onLangChoices={reportTeachChoices}
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
            onReset={resetScheduling}
            allClipIds={allClipIds}
            onDevice={audible}
            onDownloaded={refreshAudible}
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

        {saveFailed && (
          /* Kept up while anything is owed to the disk, and retried behind
             it — this used to be said once and then dropped, so with
             storage full every later answer was lost in silence while the
             screen went on showing it. The advice is the one thing that
             actually saves the work: get it off the device. */
          <p className="at-toast">
            Couldn't save to this device —{" "}
            {account
              ? "still trying. Your answers are going to the server as you give them."
              : "still trying. Sign in so your answers are kept somewhere other than this device."}
          </p>
        )}
      </div>

      {lastDeleted && lastDeleted.length > 0 && (
        <div className="at-undo">
          <span className="what">
            {lastDeleted.length === 1
              ? `Deleted “${leadOf(lastDeleted[0]).en || leadOf(lastDeleted[0]).ar || leadOf(lastDeleted[0]).lat}”`
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
          {/* The switch and the space tabs share a bar, so they sit beside
              each other however many of either there are — the tabs are
              not there at all for somebody who only learns, and the switch
              is not there for somebody learning one language. */}
          <div className="at-chromebar">
            {space === "learn" && (
              <LanguageSwitch
                choices={langChoices}
                off={langsOff}
                onChange={(next) => setSetting("langsOff", next)}
                note="What you switch off here is out of the whole of Learning — your cards, your progress and anything you practise — until you switch it back on."
              />
            )}
            {space === "teach" && (
              <LanguageSwitch
                choices={teachChoices}
                off={teachLangsOff}
                onChange={(next) => setSetting("teachLangsOff", next)}
                note="What you switch off here is out of Teaching — your courses, decks and cards in it — until you switch it back on. Your students see everything as before."
              />
            )}
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
          </div>
          <CornerMenu
            account={account}
            /* The dot stands for the whole action, so it stays lit until
               every part of it is done — this device's cards, the courses,
               and the spaces this person belongs to. */
            syncState={
              offline
                ? "off"
                : spacesBusy || (syncState === "idle" && courseBusy)
                ? "syncing"
                : syncState
            }
            /* Why, in words, rather than the one sentence that used to
               stand for every way this can go wrong. */
            syncNote={syncNote}
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

/*
 * How far along the learner is, at the top of the home screen.
 *
 * The screen used to open on a count of what was due. That answers "what is
 * there to do right now" and says nothing at all about the climb: somebody
 * in their first week and somebody three months in were both told twelve,
 * and the one thing a learner wants to see when the app opens — that this is
 * going somewhere — was a tab away.
 *
 * Drawn rather than said, because it is a feeling as much as a number. The
 * ring is the percentage the Progress tab puts on a deck, taken over
 * everything in play instead of one deck; it shares deckPercent with that
 * screen, so the two cannot come to disagree, and it is short of a hundred
 * until every card really is learnt. The band under it is the ladder itself:
 * every card filed under the level it is on, in the colours Progress gives
 * those levels, so a collection freshly joined is one flat colour and a
 * collection nearly finished is mostly jade. The line between them says the
 * same thing in words, which is what a screen reader gets and what the eye
 * can check the drawing against.
 *
 * Nothing here is pressable. It is the answer to a question, not the start
 * of a job, and the whole point of the card it sits on is the button
 * underneath.
 */
/*
 * How much of some cards is learnt: the ring's numbers, for any set of them.
 *
 * `cards` are the ones being measured and `all` the collection they sit in,
 * which a card's standing needs to read what it waits on. The home screen's
 * ring passes the same list twice; a saved session's tile passes its own
 * cards, so the two percentages are worked out the one way.
 *
 * Exported for the tests, which hold a deck of numbers to it.
 */
export function climbOf(cards: Item[], settings: Settings, all: Item[], target: PrepTarget = "learnt") {
  /* The four levels, then the cards with nothing above them left to open
     — the same five buckets the tiles in Progress count. */
  const spread = [0, 0, 0, 0, 0];
  let n = 0;
  let learnt = 0;
  let got = 0;
  for (const it of cards) {
    /* A card that can never be asked is not progress to be short of, and
       a number waiting on its stretch is a card not learnt yet — both as
       towardsLearnt has it, which the Progress tab's decks read too. A
       waiting number is not started, so it is drawn on the bottom level
       with the other cards nobody has begun. */
    const toward = towardsLearnt(it, settings, all);
    if (!toward) continue;
    n++;
    /* Aiming at Cleared, the top row counts once it is cleared: the passes
       are the part of the climb a prep for Cleared leaves out. */
    got += target === "cleared" && toward.at.status === "cleared" ? toward.reach : toward.share;
    if (reached(toward.at, target)) {
      learnt++;
      spread[4]++;
    } else spread[toward.at.level - 1]++;
  }
  return { n, learnt, pct: deckPercent({ n, learnt, got }), spread };
}

function Climb({ items, settings, target = "learnt" }: { items: Item[]; settings: Settings; target?: PrepTarget }) {
  const climb = useMemo(() => climbOf(items, settings, items, target), [items, settings, target]);

  /* Nothing practisable, nothing to draw. The card below still offers what
     it can, and the reason there is nothing is the Cards tab's to give. */
  if (!climb.n) return null;
  const { n, learnt, pct, spread } = climb;
  /* The ring is a dash drawn along a circle: as much of the way round as
     the number, and left off for the rest. */
  const ROUND = 2 * Math.PI * 32;
  return (
    <div className="at-climb">
      <div className="at-climbring">
        <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false">
          <circle className="track" cx="36" cy="36" r="32" />
          {/* Nothing drawn at nothing: a round-ended stroke of no length is
              a dot at twelve o'clock, which is a mark on a ring that is
              meant to be empty. */}
          {pct > 0 && (
            <circle
              className="fill"
              cx="36"
              cy="36"
              r="32"
              strokeDasharray={`${(ROUND * pct) / 100} ${ROUND}`}
              /* From the top, rather than from three o'clock. */
              transform="rotate(-90 36 36)"
            />
          )}
        </svg>
        {/* The number inside the ring is the ring, so it is drawing too:
            the line beside it is what gets said. */}
        <b aria-hidden="true">
          {pct}
          <i>%</i>
        </b>
      </div>
      <div className="at-climbside">
        <p className="at-climbsay">
          {learnt} of {plural(n, "card")} {target === "cleared" ? "cleared" : "learnt"}
        </p>
        <span className="at-climbband" aria-hidden="true">
          {spread.map((count, i) =>
            count ? (
              <i
                key={i}
                style={{ width: `${(count / n) * 100}%`, background: CLIMB_COLOR[i] }}
              />
            ) : null
          )}
        </span>
      </div>
    </div>
  );
}

/*
 * The sessions somebody kept, as tiles under the button that lists them.
 *
 * A tile and not a row: these sit on the home screen's own card, between
 * buttons, and a full-width row each would push Start session's neighbours
 * off the screen after three or four of them. Small enough to sit two or
 * three abreast, which is a glance at all of them.
 *
 * Each carries how much of its own cards is learnt, worked out the way the
 * ring above it is, so "Thursday's verbs · 40%" and the ring cannot be
 * counting different things. Pressing one starts it, which is what Start
 * does on the list; changing or forgetting one is the list's to do.
 */
function SavedTiles({ sessions, items, settings, onStart }: {
  sessions: SavedSession[];
  items: Item[];
  settings: Settings;
  onStart: (session: SavedSession) => void;
}) {
  const tiles = useMemo(() => {
    const byId = new Map(items.map((it) => [it.id, it]));
    /* Newest first, as the list has them. */
    return [...sessions]
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((s) => {
        const cards = s.ids.map((id) => byId.get(id)).filter((it): it is Item => !!it);
        return { s, alive: cards.length, pct: climbOf(cards, settings, items).pct };
      });
  }, [sessions, items, settings]);

  if (!tiles.length) return null;
  return (
    <div className="at-savedtiles">
      {tiles.map(({ s, alive, pct }) => (
        <button
          key={s.id}
          className="at-savedtile"
          disabled={!alive}
          aria-label={`Start ${s.name}, ${pct}% learnt`}
          onClick={() => onStart(s)}
        >
          <span className="nm">{s.name}</span>
          <span className="pc" aria-hidden="true">
            {pct}
            <i>%</i>
          </span>
          <span className="bar" aria-hidden="true">
            {pct > 0 && <i style={{ width: `${pct}%` }} />}
          </span>
        </button>
      ))}
    </div>
  );
}

/*
 * What this sitting moved, under the score.
 *
 * The one screen a learner sees without going to look for it, arriving
 * at the moment they have just done the work — which is why it, rather
 * than the Progress tab, is where the news belongs.
 *
 * **Each line says what they can now do, not a level number.** The levels
 * already have names, and "you can now write it from a cue" is a better
 * sentence than "level 3" for somebody who has just earned it. Learnt and
 * cleared say themselves.
 *
 * **Nothing at all when nothing moved**, which for an established learner
 * is most sittings. A heading with nothing under it would land as a
 * reminder that nothing happened, and the line above this already says
 * the true thing — the gaps grew, and that is progress the ladder does
 * not show.
 *
 * **And nothing about going backwards.** A card missed twice running
 * loses the levels above it, and that is on the card's own screen, said
 * as *paused*, where somebody looking for the reason will find it. Here
 * it would be an evening's work answered with a loss.
 */
const MOVE_ORDER: Move[] = ["learnt", "cleared", "up"];
const MOVES_SHOWN = 4;

function WhatMoved({
  moved,
  items,
  settings,
}: {
  moved: { id: string; move: Move }[];
  items: Item[];
  settings: Settings;
}) {
  const lines = useMemo(() => {
    const byId = new Map(items.map((it) => [it.id, it]));
    /* Biggest news first, and the order they moved in within each kind. */
    const sorted = MOVE_ORDER.flatMap((kind) => moved.filter((m) => m.move === kind));
    return sorted
      .map(({ id, move }) => {
        const card = byId.get(id);
        if (!card) return null;
        const name = leadOf(card).en || leadOf(card).ar || "";
        if (!name) return null;
        if (move === "learnt") return { id, name, said: "learnt" };
        if (move === "cleared") return { id, name, said: "cleared" };
        /* Where it got to, in the words the rest of the app uses for it —
           and said as something a card is *up to* rather than as
           something the learner can now do. Reaching a level means the
           app has started asking it, not that it has been answered, and
           "you can now write it from its meaning" would be telling
           somebody they had done the very thing they are about to be
           asked. A card with no standing has nothing to report and is
           dropped rather than given a number. */
        const at = standing(cardStandings(card, settings, items));
        const level = at && LEVEL_REACHED[at.level];
        return level ? { id, name, said: `up to ${level}` } : null;
      })
      .filter(Boolean) as { id: string; name: string; said: string }[];
  }, [moved, items, settings]);

  if (!lines.length) return null;
  const shown = lines.slice(0, MOVES_SHOWN);
  const rest = lines.length - shown.length;
  return (
    <div className="at-moved" data-el="what-moved">
      <p className="at-eyebrow">What moved</p>
      <ul>
        {shown.map(({ id, name, said }) => (
          <li key={id}>
            <b>{name}</b> — {said}
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="at-movedrest">and {plural(rest, "more card")} moved up</p>}
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
/*
 * The ladder, for one card.
 *
 * The one screen that answers "why am I not being asked to write this
 * yet?" — which the app had never answered anywhere, so a learner whose
 * writing had quietly closed after a slip had nothing to read at all.
 *
 * A level the card has no material for is not a row: a scene has nothing
 * on the second or the fourth, and a word with no recording and no phrase
 * may have nothing on the third. The ladder passes those straight through,
 * so listing them would be listing work that does not exist.
 */
function CardLadder({ card, items, settings }: { card: Item; items?: Item[]; settings: Settings }) {
  const levels = cardStandings(card, settings, items);
  const at = standing(levels);
  if (!levels.length || !at) return null;
  return (
    <Section title="Progress" lede={standingLabel(at)}>
      <div className="at-ladder">
        {levels.map((row) => (
          <div className={`at-ladderrow${row.level === at.level ? " on" : ""}`} key={row.level}>
            <span className="num" style={{ color: LEVEL_COLOR[row.level] }}>
              {row.level}
            </span>
            <span className="nm">{LEVEL_NAME[row.level] || `Level ${row.level}`}</span>
            <span className="st" style={{ color: STATUS_COLOR[row.status] }}>
              {STATUS_LABEL[row.status] || row.status}
            </span>
            {/* The count only where it means something: on the level being
                worked on, where it says how much of what has to hold for
                the next one to open does. */}
            <span className="ct">
              {row.level === at.level && row.status !== "done" ? `${row.done} of ${row.of}` : ""}
            </span>
          </div>
        ))}
      </div>
      <Help>
        {at.status === "paused"
          ? "Missing the same question twice running closes the levels above it. Nothing is lost — this opens again as soon as the level under it is back."
          : at.status === "done"
          ? "Every level is done. The card still comes back, just further and further apart."
          : "A level opens once everything under it is through the learning steps and back in review. The last one waits longer: everything under it has to hold for four days."}
      </Help>
    </Section>
  );
}

function CardScreen({ card, items, settings, onPriority, onBack, action }: {
  card: Item;
  items: Item[];
  settings: Settings;
  onPriority?: (id: string, on: boolean) => void;
  onBack: () => void;
  action?: Node;
}) {
  const live = items.find((i) => i.id === card.id) || card;
  return (
    <Screen title={leadOf(live).en || leadOf(live).ar} onBack={onBack} action={action}>
      <CardReadout
        card={{
          ...live,
          clips: (leadOf(live).recs || []).map((r: { id: string }) => r.id),
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
        /* And the card as the person learning it reads it: its words, its
           sound and what it means, without the teacher's side of it — which
           decks carry it, what other cards call it, which of its forms are
           lent out. See Reader in card-facts.ts. */
        reader="both"
      />

      <CardLadder card={live} items={items} settings={settings} />

      {onPriority && (
        <div className="at-card at-mt4">
          <p className="at-eyebrow">High priority</p>
          <Help>
            For a word you want to get on with. Marked, it joins your very next
            session whatever its schedule says, and opens it — and it stays in
            every session until you take the mark off. Nothing else about it
            changes: what you have learnt, and when it would have come round
            anyway, are both still there underneath.
          </Help>
          <div className="at-row at-mt3">
            <Button
              variant={live.priority ? "primary" : "default"}
              aria-pressed={!!live.priority}
              icon="star"
              onClick={() => onPriority(live.id, !live.priority)}
            >
              {live.priority ? "High priority — tap to clear" : "Mark as high priority"}
            </Button>
          </div>
        </div>
      )}
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
  onPriority,
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
  onPriority: (id: string, on: boolean) => void;
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
          ? leadOf(i).ar.includes(q.trim()) ||
            leadOf(i).lat.toLowerCase().includes(s) ||
            leadOf(i).en.toLowerCase().includes(s) ||
            i.tags.some((t) => t.toLowerCase().includes(s)) ||
            subFormsOf(i).some(
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
              leadOf(it).ar.includes(needle) ||
              leadOf(it).lat.toLowerCase().includes(needle) ||
              leadOf(it).en.toLowerCase().includes(needle) ||
              it.tags.some((t) => t.toLowerCase().includes(needle)) ||
              subFormsOf(it).some(
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
                /* The mark is on the tile, not only inside the card: a list
                   of forty with no sign of which four you asked for is a
                   list you have to open forty times to find out. */
                meta={
                  <>
                    {it.priority ? (
                      <span className="at-minipri">
                        <Icon name="star" size={12} /> High priority
                      </span>
                    ) : null}
                    {isDialog(it)
                      ? `${plural(linesOf(it).length, "line")} · ${shortDate(it.created)}`
                      : shortDate(it.created)}
                  </>
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
          settings={settings}
          onPriority={onPriority}
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
          subs: subFormsOf(initial).map((x: Record<string, any>) => ({ ...x })),
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
    () => items.filter((i: Item) => !isDialog(i) && leadOf(i).ar),
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
    wordCards.filter((w: Item) => !!findWordSpan(text, leadOf(w).ar, lang));

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
    if (!scene) return availableTypes(leadOf(previewItem));
    const found = new Set(availableTypes(leadOf(previewItem), lang, null));
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
                                {leadOf(w).ar}
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
                      placeholder={langOf(settings).scriptNative}
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
/* ------------------------------------------------------------------
   Full-screen: build a session by hand
   ------------------------------------------------------------------ */

const COUNT_CHOICES = [10, 20, 30, 50];
const TIME_CHOICES = [2, 5, 10, 15, 30];

/* ------------------------------------------------------------------
   Full-screen: the sessions somebody kept

   A saved session is a description, not a snapshot — which cards, which
   mode, how long — so what it opens is built from the cards as they are
   now. That is what makes "Thursday's verbs" worth keeping: the same
   ground, practised again, with everything edited since included.
   ------------------------------------------------------------------ */

function SavedSessionsSheet({ sessions, items, onStart, onEdit, onDelete, onClose }: {
  sessions: SavedSession[];
  items: Item[];
  onStart: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
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
                icon="edit"
                label={`Edit ${s.name}`}
                onClick={() => onEdit(s)}
              />
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

/*
 * `editing` opens it on a session already kept, to change it rather than
 * start one: every step is filled in with what was kept, and the last one
 * saves over it instead of starting. The answers being there already is the
 * one case where a lit choice is not a guess on the learner's behalf.
 */
function ManualSessionSheet({ items, allTags, settings, editing, onStart, onSave, onClose }: {
  items: Item[];
  allTags: string[];
  settings: Settings;
  editing?: SavedSession;
  onStart: (plan: any) => void;
  onSave: (session: { name: string; ids: string[]; mode: string; count: number; minutes: number }) => void;
  onClose: () => void;
}) {
  const eligible = useMemo(
    () => items.filter((i) => availableTypes(leadOf(i)).length >= 2 || subFormsOf(i).length),
    [items]
  );

  const [step, setStep] = useState(0);
  /* No mode until one is chosen. A pre-selected card looks like an answer
     already given, so the first screen gets read as "confirm this" rather
     than "pick one" — and Ultimate, which is the longest session on offer,
     is the last one to hand somebody by default. */
  const [mode, setMode] = useState(editing ? editing.mode : "");
  const [picked, setPicked] = useState(() => {
    if (!editing) return new Set();
    const here = new Set(eligible.map((i) => i.id));
    return new Set(editing.ids.filter((id) => here.has(id)));
  });
  /* The kept cards this screen cannot show — another language's, under the
     switch, or one that has gone — carried through a save untouched, so
     changing the length of a session does not quietly take cards out of it. */
  const [elsewhere] = useState(() => {
    if (!editing) return [] as string[];
    const here = new Set(eligible.map((i) => i.id));
    return editing.ids.filter((id) => !here.has(id));
  });
  const [openTag, setOpenTag] = useState<string | null>(null);
  /* "" until one of the two is chosen — the same reason the mode starts
     unset. It used to open on 20 questions already lit, which is a length
     nobody asked for sitting where the answer goes. */
  const [limitKind, setLimitKind] = useState( // "" | count | time
    !editing ? "" : editing.minutes ? "time" : editing.count && editing.count < 999 ? "count" : ""
  );
  const [count, setCount] = useState(editing && editing.count && editing.count < 999 ? editing.count : 20);
  const [minutes, setMinutes] = useState(editing && editing.minutes ? editing.minutes : 5);
  /* What it would be called, and what was last kept under that name. Held
     as the description rather than as a flag, so changing the length or
     the cards after saving offers the button again — what is on screen is
     no longer what was kept. */
  const [name, setName] = useState(editing ? editing.name : "");
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
        leadOf(i).ar.includes(q.trim()) ||
        leadOf(i).en.toLowerCase().includes(n) ||
        leadOf(i).lat.toLowerCase().includes(n)
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

  const typeCount = typesForMode(mode).length;
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

  function keep() {
    onSave({
      name: name.trim() || (editing && editing.name) || suggestion,
      ids: [...picked, ...elsewhere] as string[],
      mode,
      count: limitKind === "count" ? count : 999,
      minutes: limitKind === "time" && needsLength ? minutes : 0,
    });
  }

  return (
    <Screen
      title={editing ? `Edit · ${steps[step]}` : steps[step]}
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
                <Button variant="primary" disabled={!!problem} onClick={editing ? keep : start}>
                  {onButton(problem) || (editing ? "Save changes" : "Start")}
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
                          {firstOfEach(leadOf(it)).ar && (
                            <span className="ar" lang={activeLang().id} dir={activeLang().direction}>
                              {firstOfEach(leadOf(it)).ar}
                            </span>
                          )}
                          <span className="en">{firstOfEach(leadOf(it)).en}</span>
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
                  {firstOfEach(leadOf(it)).ar && (
                    <span className="ar" lang={activeLang().id} dir={activeLang().direction}>
                      {firstOfEach(leadOf(it)).ar}
                    </span>
                  )}
                  <span className="en">{firstOfEach(leadOf(it)).en}</span>
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
            <p className="at-label">Minutes</p>
            <Segmented
              size={null}
              label="How many minutes"
              options={TIME_CHOICES.map((n) => ({ value: n, label: String(n) }))}
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
      {/* Editing, the name is all there is to this: the footer saves. */}
      {step === 2 && editing && (
        <div className="at-formblock at-mt5">
          <FormField label="Name">
            <input
              className="at-input"
              placeholder={editing.name || suggestion}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </div>
      )}

      {step === 2 && !editing && (
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
                keep();
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
  const weak = prepared.filter((p) => availableTypes(leadOf(p)).length < 2).length;

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
                className={`at-previewrow${availableTypes(leadOf(p)).length < 2 ? " weak" : ""}`}
                key={i}
              >
                <span className="cell en">{leadOf(p).en || "—"}</span>
                <span className="cell ar" lang={activeLang().id} dir={activeLang().direction}>
                  {leadOf(p).ar || "—"}
                </span>
                <span className="cell lat">{leadOf(p).lat || "—"}</span>
                <span className="cell tag">{p.tags.join(", ") || "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

/**
 * Whether the prompt has to say which form of the card it wants.
 *
 * A card's forms are drilled on their own, and two of them can answer the
 * same question. A masculine teacher and a feminine one are both
 * *teacher*: asked to write it in the script, a learner has no way to know
 * which was wanted, and writing the other one is marked wrong for knowing
 * the word. The same thing happens among tiles — the two standing side by
 * side with one meaning between them, and nothing saying which.
 *
 * So the instruction carries the form's own grammar — "· f", "· pl" — in
 * the two cases where the question does not already settle it:
 *
 *   * **another form of the same card is on screen**, as a tile or in the
 *     grid, and the prompt does not show the word itself. Even where their
 *     meanings differ the pair invites the mistake, and the tag is what
 *     turns "which of these?" into a question with one answer. Under a
 *     word in the script it would only name what is already shown.
 *   * **another form answers the same prompt**, which is the typed case and
 *     the worse one: nothing is on screen to compare, and the learner finds
 *     out only by being marked wrong.
 *
 * Neither is about being a sub-form. A card's *main* form is as easily
 * confused with its feminine as the other way round, and the tag was shown
 * on sub-forms alone — so the half of the pair that needed it most was the
 * half that never got it.
 *
 * Only the fields a prompt is read from. A recording is of one form and a
 * scene is its own question, so neither can collide this way.
 */
const PROMPT_FIELDS = ["ar", "en", "lat"];

/* The prompts that show the form itself, so that which form is asked is
   already on the screen — see formTagsAt. */
const PROMPT_SHOWS_FORM = ["ar", "lat", "audio"];

export function formIsAmbiguous({ unit, kin, shown, promptField, answerField }: {
  unit: Record<string, any> | null | undefined;
  /** The card's other forms. */
  kin: Record<string, any>[];
  /** What else is on screen as an answer — the tiles, or the grid's words. */
  shown: Record<string, any>[];
  promptField: string;
  /** The field the answer is written in. Optional: without it, any two
      forms reading alike in the prompt are taken to want different
      answers. */
  answerField?: string;
}): boolean {
  if (!unit || !kin.length) return false;
  /* A prompt showing the word itself — in the script, its transliteration,
     or heard — already says which form it is, kin among the tiles or not;
     naming the form there names the answer. Only two forms reading the
     same in that field leave it open. See formTagsAt. */
  const ids = new Set((shown || []).map((s) => s && s.id).filter(Boolean));
  if (!PROMPT_SHOWS_FORM.includes(promptField) && kin.some((k) => k && ids.has(k.id))) return true;
  if (!PROMPT_FIELDS.includes(promptField)) return false;
  /* Two forms reading alike in the prompt *and* in the answer leave
     nothing to choose between: either answer is the answer. "bafham" filed
     once for "I" and once for "I (f)", both "I understand", put "I" over
     the question and so gave half the English away for nothing — a
     learner reported exactly that. */
  const sameAnswer = (k: Record<string, any>) =>
    !!answerField && PROMPT_FIELDS.includes(answerField) && readAlike(unit, k, answerField);
  return kin.some((k) => readAlike(unit, k, promptField) && !sameAnswer(k));
}

/**
 * Whether two forms read the same in the field a prompt is read from.
 *
 * Compared as the learner reads it rather than as it is stored: a
 * difference of case or a stray space is not a difference they could
 * answer by. And in English, by meaning rather than by the whole line: a
 * masculine written "I am hot / I feel hot" beside a feminine
 * written "I am hot" are both *I am hot*, and asked that, a learner has no
 * way to know which was wanted. Exact lines let that pass with no tag, and
 * a learner reported it — the second report of a missing tag. The
 * meanings are split as lentLabel splits them, on a slash or a semicolon;
 * not on a comma, which sits inside a phrase as often as between two.
 */
function readAlike(
  a: Record<string, any> | null | undefined,
  b: Record<string, any> | null | undefined,
  field: string,
): boolean {
  const raw = (x: Record<string, any> | null | undefined) => String((x && x[field]) || "");
  if (field !== "en") {
    const said = (x: Record<string, any> | null | undefined) => raw(x).trim().toLowerCase();
    return !!said(a) && said(a) === said(b);
  }
  const meanings = (x: Record<string, any> | null | undefined) =>
    raw(x).split(/[/;]/).map(normEn).filter(Boolean);
  const mine = meanings(a);
  return meanings(b).some((m) => mine.includes(m));
}

/**
 * Where a question says which form it is about: under the prompt, beside
 * the answer, or both.
 *
 * The rule is the one formIsAmbiguous states, and it is the only reason a
 * prompt names a form. A sub-form used to be named under the prompt
 * whatever else was up, because "the plural of" seemed worth knowing on its
 * own — and on a question that shows the word, that is the answer half
 * given away. A learner shown *3indak*, in the script or in letters, with
 * "you · masculine" under it was told what the word already said,
 * and reported it twice: the grammar belongs in the answer, where it is
 * something learnt rather than something handed over.
 *
 * So the prompt names the form only where the learner could not otherwise
 * know which is wanted — writing "You have" in the script, where three
 * cells read the same in English. The answer names it on every question
 * about a card with more than one form, whatever the verdict, because
 * that is where a learner reported looking for it.
 *
 * A sentence's blanks follow the same line. "Your name: plural" under
 * "Your name is Shams" is what makes the English answerable in the
 * script; under the same sentence in Arabic it is the English answer
 * itself, which a learner reported as exactly that. A prompt in the script, its transliteration
 * or a recording already shows which word was dropped in, so there it is
 * said beside the answer alone.
 *
 * Nothing on a grid or a scene, where every word is asked and a tag on one
 * would say which English is its — see kinTags.
 */
export function formTagsAt({ label, ambiguous, kin, lent, promptField }: {
  /** What the form is called, from askLabel. Empty where nothing tells it apart. */
  label: string;
  /** Whether the prompt leaves which form open — formIsAmbiguous. */
  ambiguous: boolean;
  /** How many other forms the card has. */
  kin: number;
  /** Whether the sentence has blanks worth naming — lentTags. */
  lent: boolean;
  promptField: string;
}): { question: boolean; answer: boolean; lentQuestion: boolean; lentAnswer: boolean } {
  const none = promptField === "pairs" || promptField === "scene";
  return {
    question: !none && !!label && ambiguous,
    answer: !none && !!label && kin > 0,
    lentQuestion: !none && lent && !PROMPT_SHOWS_FORM.includes(promptField),
    lentAnswer: !none && lent,
  };
}

/**
 * The other forms of a card that answer this question just as well.
 *
 * A phrase card whose second form is its feminine — the two both "Not
 * good" — has nothing to say which of the two it wants: the
 * grammar tag comes from the language's tables and from the grammar written
 * on an answer, and a phrase has neither. Asked "Not good" in the script, a
 * learner writing the masculine was marked wrong for knowing it, and said
 * so three times in one morning.
 *
 * So where the question cannot say which form it means, the forms it
 * cannot tell apart all count: those reading the same in the field the
 * prompt is read from. Where it can say — `told`, a tag is on the screen —
 * the form named is the only right answer, which is what the tag is for.
 * The two a pick question offers are kept apart the same way: a twin is
 * never one of the wrong answers beside the right one.
 */
export function twinsOf({ unit, kin, promptField, told }: {
  unit: Record<string, any> | null | undefined;
  /** The card's other forms. */
  kin: Record<string, any>[];
  promptField: string;
  /** Whether the question names the form it wants. */
  told: boolean;
}): Record<string, any>[] {
  if (!unit || told || !PROMPT_FIELDS.includes(promptField)) return [];
  return kin.filter((k) => k && k.id !== unit.id && readAlike(unit, k, promptField));
}

/**
 * Which tiles of a grid have to say what form they are.
 *
 * The instruction above says which form is being *asked*, and in a grid
 * that is not enough: every word in a grid is asked, and what a learner
 * has to do is decide which English goes with which word. Two forms of one
 * card standing in the same grid is the one pairing they cannot reason
 * out — a masculine teacher and a feminine one are both *teacher*, and
 * even where the two meanings are written differently they are the same
 * thing said twice. The pairing is then a coin toss, and half of it is
 * marked wrong for knowing the word.
 *
 * So where one card has more than one form up, each of those forms carries
 * its own grammar — "feminine", "plural" — and **both columns carry it**: a tag on
 * the words alone leaves the meanings exactly as unanswerable as they
 * were. Every other tile stays bare, because a grid of five labelled words
 * is a reading exercise about labels.
 *
 * Nothing is said where saying it would not help. Forms whose tags read
 * alike are not told apart by them; a language that declares no grammar —
 * Huế — has nothing to say at all; and a form standing on its own is not
 * ambiguous with anybody.
 *
 * A backstop now rather than the rule. Tagging only those tiles told a
 * learner which two went together, and a learner reported that too, so
 * matchGroups and matchSet keep a card's forms apart and this speaks only
 * if a grid reaches the screen with two of them in it anyway.
 *
 * Keyed by form id, so the caller looks a tile up by which form is on it
 * rather than by what it reads.
 */
export function kinTags({ units, cardOf, labelOf }: {
  /** Every form on the grid: its words, and the forms its meanings are of. */
  units: (Record<string, any> | null | undefined)[];
  /** Which card a form belongs to. Empty where it is not known. */
  cardOf: (unit: Record<string, any>) => string;
  /** What the form is, in the language's own terms — see askLabel. */
  labelOf: (unit: Record<string, any>) => string;
}): Record<string, string> {
  /* A word and its own meaning are one form on two tiles, so the forms are
     taken once each before anything is counted. */
  const seen = new Map<string, Record<string, any>>();
  for (const unit of units || []) {
    if (unit && unit.id && !seen.has(unit.id)) seen.set(unit.id, unit);
  }
  const byCard = new Map<string, Record<string, any>[]>();
  for (const [id, unit] of seen) {
    /* A form whose card nobody could name stands on its own rather than
       joining a crowd of others in the same condition. */
    const card = cardOf(unit) || `#${id}`;
    byCard.set(card, (byCard.get(card) || []).concat([unit]));
  }
  const tags: Record<string, string> = {};
  for (const kin of byCard.values()) {
    if (kin.length < 2) continue;
    const labels = kin.map((unit) => String(labelOf(unit) || "").trim());
    if (new Set(labels).size < 2) continue;
    kin.forEach((unit, i) => {
      if (labels[i]) tags[unit.id] = labels[i];
    });
  }
  return tags;
}

/* ==================================================================
   Progress tab
   ================================================================== */

/**
 * How far a deck has got, as a percentage.
 *
 * `got` is the sum of its cards' own shares — the levels each has finished
 * over the levels each has material for — and `learnt` is how many have
 * finished all of theirs.
 *
 * It used to be `learnt / n` alone, so a deck whose every card was three
 * levels up and being asked to be written read as nought per cent and
 * stayed there for weeks while the work went on. That is the one number on
 * the screen somebody watches to see themselves moving, and it was the one
 * that moved last.
 *
 * Every card counts the same, whatever its levels: a card with material on
 * two of them contributes a whole card's worth of itself, not half of one,
 * because a deck of thirty cards is thirty things to learn however much
 * each happens to carry.
 *
 * Rounded down, and held at 99 until every card is in — 199 of 200 is not a
 * finished deck, and a tile reading 100% over a card still to learn is the
 * one number here nobody would trust again. Which is why the hundred is
 * read off `learnt` rather than off the sum: a rounding that reached it
 * early would be exactly that tile.
 */
export function deckPercent({ n, learnt, got }: { n: number; learnt: number; got: number }): number {
  if (!n) return 0;
  if (learnt >= n) return 100;
  return Math.max(0, Math.min(99, Math.floor((got / n) * 100)));
}

/**
 * How far a card has got on the level it is on, as a percentage.
 *
 * A standing already carries the two numbers — how many of the exercises
 * that have to hold for the next level to open are there yet, and how many
 * there are — and a card's own screen says them as "3 of 8". This is the
 * same fact as a proportion, for the tiles under a level, where a bar
 * across a list of cards is read at a glance and a pair of counts is not.
 *
 * It counts this level *and everything under it*, because that is what the
 * scheduler's gate asks: writing a word wants four days from reading it
 * too, not only from the level below. So a card that has just arrived on a
 * level starts partway along rather than at nought, and the bar reaches a
 * hundred at exactly the moment the level opens the next one — the screen
 * and the scheduler cannot come to disagree about when a level is done,
 * which is the whole reason the counts are kept that way.
 *
 * Rounded down, so a level still short of its last exercise can never read
 * as a finished one.
 */
export function levelPercent(at: { done: number; of: number } | null | undefined): number {
  if (!at || !at.of) return 0;
  return Math.max(0, Math.min(100, Math.floor((at.done / at.of) * 100)));
}

/**
 * When a card next comes round, as a moment.
 *
 * For the two tiles at the top of the ladder, where a bar says nothing.
 * Every card under Cleared has finished every level it has material for
 * and every card under Learnt has done that and been kept, so the
 * proportion the level tiles draw is full on all of them — a column of
 * hundreds telling a learner apart from nothing. What is actually
 * different between two cards sitting there is when each one is next
 * asked, and that was on the card's own screen and nowhere in the list.
 *
 * Read over the keys the card *climbs* with rather than over everything a
 * session might deal, so this and the standing beside it are the one
 * answer said twice — see `laddered`, and the note on `cardStandings`.
 *
 * **The soonest of any of them**, which is when the learner next sees the
 * card. That is the reading under Learnt, where there is nothing left to
 * count towards and the only question is when the card is next asked.
 * Under Cleared it is `nextPassAt` instead: those cards are waiting on
 * one review in particular, and the line there names it — "Second review
 * in 4d" — so the date beside it has to be that review's, not a lower
 * level's question that happens to come round on Tuesday.
 *
 * Nought where nothing is scheduled, which a card at the top of the
 * ladder should never be — it is the reading for a card whose schedule
 * has been cleared out from under it, and the caller says so rather than
 * doing arithmetic on a missing date.
 */
export function nextReviewAt(it: Item, settings: Settings): Millis {
  let soonest = 0;
  for (const { unit } of unitsOf(it)) {
    for (const key of laddered(unit, settings)) {
      const due = stateOf(unit, key).due || 0;
      if (!due) continue;
      if (!soonest || due < soonest) soonest = due;
    }
  }
  return soonest;
}

/**
 * And the same moment as the one line of small print a tile carries.
 *
 * A gap rather than a date: "Next review in 3d" is the sentence a learner
 * reads off this screen, and "14 October" makes them count. `formatGap`
 * picks the unit, so a card coming back this evening says hours and one
 * coming back next month says months.
 *
 * **Already due says so instead.** A card at the top of the ladder can
 * perfectly well be sitting there waiting to be answered, and running it
 * through the gap would have read "Next review in now".
 */
export function reviewLine(due: Millis, at: Millis = now()): string {
  if (!due) return "No review scheduled";
  if (due <= at) return "Review due now";
  return `Next review in ${formatGap(due - at)}`;
}

/**
 * When a cleared card's next *counting* review comes round, as a moment.
 *
 * A pass is made on the top of each form's own ladder, answered right when
 * it came round — see `passesMade` and `markedState`. So the review a
 * cleared card is waiting on is one of those top-level questions, and not
 * whichever of its keys is soonest: a reading question falling due on
 * Tuesday moves the card no nearer to Learnt, and a line saying "First
 * review in 1d" over it would be pointing at the wrong question.
 *
 * **Only the questions still at the card's own count.** The card has made
 * as many passes as its weakest form, the way `standings` reads it, so a
 * top-level question already a pass ahead is not the one holding the card
 * back — its next review would be its own second, not the card's first,
 * and the ordinal the line puts beside this date would be wrong about it.
 * Of those still at the count, the soonest.
 *
 * Nought where none of them has a date, as `nextReviewAt`.
 */
export function nextPassAt(it: Item, settings: Settings): Millis {
  const forms = unitsOf(it)
    .map(({ unit }) => ({ unit, keys: laddered(unit, settings) }))
    .filter(({ keys }) => keys.length);
  if (!forms.length) return 0;
  const made = Math.min(
    ...forms.map(({ unit, keys }) => passesMade(keys, (k) => stateOf(unit, k))),
  );
  let soonest = 0;
  for (const { unit, keys } of forms) {
    const top = topLevelOf(keys);
    for (const key of keys) {
      if (levelOf(key) !== top) continue;
      const s = stateOf(unit, key);
      if (((s && s.passes) || 0) > made) continue;
      const due = (s && s.due) || 0;
      if (!due) continue;
      if (!soonest || due < soonest) soonest = due;
    }
  }
  return soonest;
}

/* The small print on a number part held at Cleared by its words, once its
   own reviews are made — there is no review left for passLine to name. */
function heldLine(at: Standing | null): string {
  if (!at || !at.held || at.passes < PASSES_TO_LEARN) return "";
  return `Waiting on ${heldWhat(at)}`;
}

/* What a held part is waiting on, by kind: its words, and the figures it
   is written in. */
function heldWhat(at: Standing): string {
  const figures = at.heldFigures || 0;
  const words = (at.held || 0) - figures;
  return [words ? plural(words, "word") : "", figures ? plural(figures, "numeral") : ""]
    .filter(Boolean)
    .join(" and ");
}

/* Which review of the ones that make a card learnt, as a word. There are
   two today; the rest are here so that raising PASSES_TO_LEARN changes a
   number and not a sentence. */
const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth"];

/**
 * The small print on a card under Cleared.
 *
 * Says which of the reviews still to make is the next one — the passes
 * made plus one — and when: "First review in 3d", "Second review due now".
 * The count is what tells two cleared cards apart as much as the date is,
 * and the line at the top of the screen says how many there are in all.
 */
export function passLine(due: Millis, passes: number, at: Millis = now()): string {
  if (!due) return "No review scheduled";
  const said = ORDINALS[passes] ? `${ORDINALS[passes]} review` : `Review ${passes + 1}`;
  if (due <= at) return `${said} due now`;
  return `${said} in ${formatGap(due - at)}`;
}

/*
 * How far along a card is: which level it is on and how it is going there.
 *
 * This used to be a fraction — the mean over every exercise of its interval
 * against three weeks — drawn as a bar under each card and averaged again
 * for each deck. It was a number nobody could act on: a card the app had
 * two levels up and was asking to be written read as a third learnt,
 * because eight of its eleven exercises had only just opened, and it moved
 * when nothing the learner had done changed. The level is the thing they
 * are climbing, so it is the thing shown, and the bars have gone with the
 * deck sections that carried them.
 */
/*
 * What today and this week came to, above the ladder.
 *
 * The tiles below say where the collection stands, which is a stock-take:
 * it says nearly the same thing on the day somebody works hard as on the
 * day they do nothing, because a card takes days to clear and four more
 * to be learnt. These two lines say what *changed*, which is the question
 * a learner is actually asking when they open this tab after a session.
 *
 * Read off the record the grading keeps — see `moves` on the document —
 * because nothing on a card remembers the day it moved. Everything else
 * in this app can be worked out again from the cards; this cannot, which
 * is why it is the one thing here that is written down rather than
 * derived.
 *
 * **A line with nothing to say is not shown**, and nor is the block when
 * neither has anything. A row of noughts on a quiet day is a reminder
 * that nothing happened, which is the opposite of what this is for.
 *
 * A week is the last seven days including today, so "this week" always
 * contains "today" and the two can never disagree about a card.
 */
const WEEK = 7;

export function sumMoves(moves: Record<string, DayMoves> | undefined, days: string[]): DayMoves {
  const out = { up: 0, cleared: 0, learnt: 0 };
  for (const day of days) {
    const one = (moves || {})[day];
    if (!one) continue;
    out.up += one.up || 0;
    out.cleared += one.cleared || 0;
    out.learnt += one.learnt || 0;
  }
  return out;
}

/* The three counts as one sentence, leaving out whichever are nought:
   "9 moved up, 4 cleared, 2 learnt", and "2 learnt" on its own where
   that is the whole of it. Empty where nothing moved, which is what tells
   the line not to appear. */
export function saidMoves(at: DayMoves): string {
  const parts: string[] = [];
  if (at.up) parts.push(`${plural(at.up, "card")} moved up`);
  if (at.cleared) parts.push(`${at.cleared} cleared`);
  if (at.learnt) parts.push(`${at.learnt} learnt`);
  return parts.join(", ");
}

function Lately({ moves }: { moves?: Record<string, DayMoves> }) {
  const said = useMemo(() => {
    const days = recentDays(WEEK);
    const today = saidMoves(sumMoves(moves, days.slice(0, 1)));
    const week = saidMoves(sumMoves(moves, days));
    /* The week is left out when it says exactly what today says, which is
       every first day and every week whose work all happened this
       evening. Two identical sentences under two different headings read
       as a fault in the app rather than as a fact about the week. */
    return { today, week: week === today ? "" : week };
  }, [moves]);
  if (!said.today && !said.week) return null;
  return (
    <div className="at-lately">
      {said.today && (
        <p>
          <b>Today</b> — {said.today}
        </p>
      )}
      {said.week && (
        <p>
          <b>This week</b> — {said.week}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Prep mode

   A learner preparing for something on a date — the start of a class, an
   exam — names it, sets the date, picks the decks that have to be ready by
   then and how far: cleared, or learnt. The home screen then offers a session drawn from those
   decks alone, which is the fastest way to finish them, and says how many
   days are left and whether their pace gets them there. The one prep is
   kept in the settings, so it follows the learner to their other devices
   the way the rest of their settings do, and it is theirs to edit or clear.

   Being ready means every card in the chosen decks at the target before
   the day itself starts: on the morning of an exam is too late to be
   learning.
   ------------------------------------------------------------------ */

export interface Prep {
  /** What it is for, in the learner's own words — "Start of class". */
  name: string;
  /** The day of it, as a date input writes one: YYYY-MM-DD. */
  date: string;
  /** The decks to have learnt, or cleared, by then. */
  decks: string[];
  /** How far those decks have to be by then. */
  target: PrepTarget;
}

/**
 * How far a prep's decks have to get: every card learnt — cleared and its
 * two passes made, days apart — or only cleared, which is up the whole
 * ladder and can be done in days rather than the better part of a week.
 * Learnt for a prep saved before there was a choice, since that is what it
 * was aiming at.
 */
export type PrepTarget = "cleared" | "learnt";

/** Whether a card standing here has got as far as the target. */
function reached(at: Standing, target: PrepTarget): boolean {
  return at.status === "done" || (target === "cleared" && at.status === "cleared");
}

/** The prep in the settings, if there is a whole one. */
export function prepOf(settings: Settings | null | undefined): Prep | null {
  const p = settings && (settings as Record<string, any>).prep;
  if (!p || typeof p !== "object") return null;
  const name = String(p.name || "").trim();
  const date = String(p.date || "");
  const decks = Array.isArray(p.decks) ? p.decks.map((d: unknown) => String(d)).filter(Boolean) : [];
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !decks.length) return null;
  return { name, date, decks, target: p.target === "cleared" ? "cleared" : "learnt" };
}

/** The first moment of the prep's day: the deadline for being ready. */
export function prepStart(date: string): Millis {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Whether a card is in any of the prep's decks. */
export const prepDeckOf = (decks: string[]) => (it: Item) => (it.tags || []).some((t) => decks.includes(t));

/**
 * The day's counts with one more question answered: always the log, which
 * counts all practice, and the prep's own count where the card asked is in
 * the prep's decks — whatever kind of session asked it. One question
 * however many words it marked. See prepLog.
 */
export function tallyAnswer(
  doc: { log: Record<string, any>; prepLog?: Record<string, number> },
  day: string,
  forPrep: boolean,
): { log: Record<string, any>; prepLog?: Record<string, number> } {
  const log = { ...doc.log, [day]: (doc.log[day] || 0) + 1 };
  if (!forPrep) return { log };
  const prepLog = doc.prepLog || {};
  return { log, prepLog: { ...prepLog, [day]: (prepLog[day] || 0) + 1 } };
}

/** Whole days from today to the prep's day: 1 is tomorrow. */
export function prepDaysLeft(date: string, at: Millis = now()): number {
  return Math.round((prepStart(date) - dayOf(at)) / 86400000);
}

/**
 * Where a prep stands: still to come, its day come, every card in it
 * learnt (or cleared) already, or nothing in its decks to learn in this
 * language.
 */
export function prepStatus(
  prep: Prep,
  items: Item[],
  settings: Settings,
  at: Millis = now(),
): "active" | "past" | "done" | "empty" {
  if (at >= prepStart(prep.date)) return "past";
  const cards = items.filter(prepDeckOf(prep.decks)).filter((it) => standing(cardStandings(it, settings, items)));
  if (!cards.length) return "empty";
  return workloadOf(cards, settings, at, prep.target).left ? "active" : "done";
}

/** What a prep's forecast says, in a sentence. */
export function readyWords(answer: ReadyAnswer, date: string, perDay: number, target: PrepTarget = "learnt"): string {
  const day = new Date(prepStart(date)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (answer.kind === "already") return `Every card in these decks is already ${target === "cleared" ? "cleared" : "learnt"}.`;
  if (answer.kind === "late") {
    return answer.earliest === null
      ? `You can't be ready before ${day}: however much you practise, it would take more than two years.`
      : `You can't be fully ready before ${day}. However much you practise, the earliest is ${forecastWords(answer.earliest)}.`;
  }
  const needed = leastWords(answer.rate);
  const now_ = perDay > 0 ? ` You're doing ${paceWords(perDay)} at the moment.` : "";
  return `${needed} will get you ready before ${day}.${now_}`;
}

function PrepScreen({
  prep,
  decks,
  collection,
  settings,
  perDay,
  onSave,
  onBack,
}: {
  prep: Prep | null;
  decks: { name: string; n: number; learnt: number }[];
  collection: Item[];
  settings: Settings;
  perDay: number;
  onSave: (prep: Prep | null) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(prep ? prep.name : "");
  const [date, setDate] = useState(prep ? prep.date : "");
  const [chosen, setChosen] = useState<string[]>(prep ? prep.decks.filter((d) => decks.some((x) => x.name === d)) : []);
  const [target, setTarget] = useState<PrepTarget>(prep ? prep.target : "learnt");
  const tomorrow = dayKey(now() + 86400000);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= tomorrow;
  const ready = name.trim() !== "" && dateOk && chosen.length > 0;
  /* How much practice the choice takes, counted as it is made — see workloadOf. */
  const answer = useMemo(
    () =>
      dateOk && chosen.length
        ? readyFor(workloadOf(collection.filter(prepDeckOf(chosen)), settings, now(), target), prepStart(date))
        : null,
    [dateOk, chosen, date, collection, settings, target],
  );
  return (
    <Screen
      title="Prep mode"
      onBack={onBack}
      /* Save at the foot of the screen, as every other form keeps it, and
         the way to delete the prep at the other end of the same bar —
         an icon, so it is there without competing with Save. */
      footer={
        <>
          {prep && (
            <IconButton icon="delete" label="Delete this prep" danger onClick={() => onSave(null)} />
          )}
          <Button
            variant="primary"
            disabled={!ready}
            onClick={() => ready && onSave({ name: name.trim(), date, decks: chosen, target })}
          >
            {prep ? "Save changes" : "Start prepping"}
          </Button>
        </>
      }
    >
      <Lede>
        Preparing for something on a set date? Pick the decks you need ready by then. The home screen will offer
        sessions drawn only from those decks, and tell you whether you're on track.
      </Lede>
      <FormField label="What are you preparing for?" htmlFor="at-prep-name">
        <input
          id="at-prep-name"
          className="at-input"
          type="text"
          value={name}
          placeholder="Start of class"
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField
        label="When is it?"
        htmlFor="at-prep-date"
        hint={date && !dateOk ? "Pick a day from tomorrow on." : "You'll need to be ready before this day starts."}
      >
        <input
          id="at-prep-date"
          className="at-input"
          type="date"
          value={date}
          min={tomorrow}
          onChange={(e) => setDate(e.target.value)}
        />
      </FormField>
      {/* The decks as a card's editor puts a card in them: pills, and a
          sheet to add more from. */}
      <FormField label="Decks to target">
        <DeckSwitch
          decks={decks.map((d) => ({ id: d.name, title: d.name, cardCount: d.n }))}
          chosen={chosen}
          onToggle={(id, wasOn) => setChosen((c) => (wasOn ? c.filter((x) => x !== id) : c.concat([id])))}
          words={{
            first: "Choose decks",
            drop: (title) => `Stop targeting ${title}`,
            lede: "Choose the decks to have ready by then.",
            note: "",
            none: "No decks to prepare yet.",
          }}
        />
      </FormField>
      <FormField
        label="Target level"
        hint={
          target === "cleared"
            ? "Every card answered right all the way up its levels. Quicker to reach."
            : "Every card cleared, then remembered on two reviews a few days apart."
        }
      >
        <Segmented
          label="Target level"
          options={[{ value: "cleared", label: "Cleared" }, { value: "learnt", label: "Learnt" }]}
          value={target}
          onChange={(v) => setTarget(v as PrepTarget)}
        />
      </FormField>
      {answer && (
        <div className="at-forecast at-prepready" aria-live="polite">
          <p>
            <span className="at-forecastpace">{readyWords(answer, date, perDay, target)}</span>
          </p>
          <p className="at-forecastnote">An estimate, assuming you get every answer right, so allow a little more.</p>
        </div>
      )}
    </Screen>
  );
}

/*
 * What sits under the home screen's prep button: today and the days left,
 * side by side, rather than two sentences one under the other.
 *
 * Each panel is a label and a number. Today's sessions is the sessions
 * done over the day's goal, with a row of dots, one per session, filling as
 * they are done — a goal you can see the end of. The days left carries a
 * coloured word under it where there is one to say: jade when the
 * learner's pace gets them there, rose when no amount of practice makes the
 * day. Where it takes more practice there is no word, and the line under
 * both says how much. What the more is, or when the earliest day is,
 * goes on one short line under both. See prepGlance for the words.
 */
function PrepLine({
  prep,
  collection,
  settings,
  perDay,
  today,
}: {
  prep: Prep;
  collection: Item[];
  settings: Settings;
  perDay: number;
  today: number;
}) {
  const left = prepDaysLeft(prep.date);
  const answer = useMemo(
    () => readyFor(workloadOf(collection.filter(prepDeckOf(prep.decks)), settings, now(), prep.target), prepStart(prep.date)),
    [collection, settings, prep],
  );
  const g = prepGlance(left, answer, perDay, today, prep.target);
  /* Dots while they can be counted at a glance; past that, the number. */
  const dots = g.goal !== null && g.goal <= PREP_DOTS ? g.goal : 0;
  return (
    <>
      <div className="at-prepglance">
        <div className="at-prepstat at-preptoday">
          <span className="at-preplabel">Today&apos;s sessions</span>
          <b className="at-prepnum">
            {g.goal === null ? g.done : <>{g.done}<small>/{g.goal}</small></>}
          </b>
          {dots > 0 && (
            <span className="at-preppips" aria-hidden="true">
              {Array.from({ length: dots }, (_, i) => <i key={i} className={i < g.done ? "on" : ""} />)}
            </span>
          )}
        </div>
        <div className="at-prepstat at-prepline">
          <span className="at-preplabel">{g.days === 1 ? "Day left" : "Days left"}</span>
          <b className="at-prepnum">{g.days}</b>
          {g.status && <span className={`at-preppill ${g.tone}`}>{g.status}</span>}
        </div>
      </div>
      {g.detail && <Help className="at-prepdetail">{g.detail}</Help>}
    </>
  );
}

/* How many of today's sessions are drawn as dots before it is a number. */
const PREP_DOTS = 8;

/**
 * Today's sessions for the prep, and the sessions today that keep it on
 * track. Sessions are questions over SESSION_SIZE, as the pace is — today's
 * questions on the prep's own cards (`prepLog`), in any kind of session,
 * because the goal is counted off those cards and nothing else.
 *
 * The rate readyFor gives shrinks as today's work is done, so read live it
 * would move the goal as the learner walks towards it. Today's goal puts
 * today's sessions back first — what the rate was this morning, near enough
 * — and is rounded up to whole sessions. Null where there is no rate to keep
 * to: too late for one, or nothing left to learn.
 */
export function prepToday(left: number, answer: ReadyAnswer, questionsToday: number): { done: number; goal: number | null } {
  const sessions = questionsToday / SESSION_SIZE;
  const done = Math.floor(sessions + 1e-9);
  if (answer.kind !== "rate" || left <= 0) return { done, goal: null };
  return { done, goal: Math.max(1, Math.ceil(answer.rate + sessions / left - 1e-9)) };
}

/**
 * The pieces of the home screen's prep tile, in words: today's sessions
 * against what today needs, the days left, and whether the learner's own
 * pace gets them there — said as on track when it does, as the sessions a
 * day it takes when it does not, and as the earliest they could be ready
 * when no amount of practice makes the day.
 */
export function prepGlance(
  left: number,
  answer: ReadyAnswer,
  perDay: number,
  questionsToday: number,
  target: PrepTarget = "learnt",
): {
  done: number;
  goal: number | null;
  days: number;
  tone: "good" | "push" | "late";
  /** The coloured word under the days left, or empty. */
  status: string;
  /** The one line under both, or empty. */
  detail: string;
} {
  const { done, goal } = prepToday(left, answer, questionsToday);
  const base = { done, goal, days: Math.max(0, left) };
  const toClear = target === "cleared";
  if (answer.kind === "already") return { ...base, tone: "good", status: toClear ? "All cleared" : "All learnt", detail: "" };
  if (answer.kind === "late") {
    const all = toClear ? "Too soon to clear it all" : "Too soon to learn it all";
    return {
      ...base,
      tone: "late",
      status: "Too soon",
      detail: answer.earliest === null
        ? `${all} — it would take more than two years`
        : `${all} — the earliest you could be ready is ${forecastWords(answer.earliest)}`,
    };
  }
  /* This morning's rate, which today's goal is also made from — see
     prepToday. The live rate falls as today's sessions are done, so read
     beside the goal it said "about 13 a day" under "13/14": two numbers
     for one question. One figure for the day, and it moves overnight. */
  const morning = answer.rate + (left > 0 ? questionsToday / SESSION_SIZE / left : 0);
  if (perDay > 0 && perDay / SESSION_SIZE >= morning) {
    return { ...base, tone: "good", status: "On track", detail: "" };
  }
  const needed = leastWords(morning);
  return {
    ...base,
    /* No word under the days left: "Needs more" said less than the line
       under both, which says how much more. */
    tone: "push",
    status: "",
    /* What it takes, and not the learner's own pace beside it. */
    detail: `${needed} will get you ready`,
  };
}

/* ------------------------------------------------------------------
   One deck, on a screen of its own

   Opened from a deck's tile under Progress: how far the deck has got, two
   dates for when it could all be learnt, and every card in it by where it
   stands. The dates are simple arithmetic over where its cards stand — see
   workloadOf, and the note over it about keeping it in step with the rules.
   ------------------------------------------------------------------ */

/* The runs a deck's cards are listed in, least advanced first. */
const DECK_RUNS = [
  { key: "new", label: "Not started" },
  { key: "l1", label: LEVEL_NAME[1] },
  { key: "l2", label: LEVEL_NAME[2] },
  { key: "l3", label: LEVEL_NAME[3] },
  { key: "l4", label: LEVEL_NAME[4] },
  { key: "cleared", label: "Cleared" },
  { key: "done", label: "Learnt" },
  /* A number whose stretch has not opened: nothing to ask it yet, so last,
     after everything there is something to do about. */
  { key: "waiting", label: "Opens later" },
];

/** Which of DECK_RUNS a card goes under. */
function deckRunOf(at: Standing | null | undefined): string {
  if (!at) return "new";
  if (at.status === "done") return "done";
  if (at.status === "cleared") return "cleared";
  if (at.level === 1 && at.status === "none") return "new";
  return `l${at.level}`;
}

/*
 * A typical day's practice, said as sittings a day.
 *
 * The activity log counts questions, so this is questions over the length
 * of a session — "about 12 sessions a day". Always per day, as the owner
 * asked, and to one decimal under one a day ("about 0.4 sessions a day")
 * rather than rounded to a whole session nobody did.
 */
export function paceWords(perDay: number): string {
  const sessions = perDay / SESSION_SIZE;
  if (sessions >= 0.95) return `about ${plural(Math.max(1, Math.round(sessions)), "session")} a day`;
  return `about ${Math.max(0.1, Math.round(sessions * 10) / 10)} sessions a day`;
}

/*
 * The least practice that reaches the earliest date, said as sittings a
 * day. Rounded up, never down: the pace named has to get there.
 */
export function leastWords(rate: number): string {
  if (rate >= 2) return `About ${plural(Math.ceil(rate - 1e-9), "session")} a day`;
  const tenths = Math.max(0.1, Math.ceil(rate * 10 - 1e-9) / 10);
  return `About ${tenths === 1 ? "1 session" : `${tenths} sessions`} a day`;
}

/** When a forecast lands, as a date and how far off it is. */
export function forecastWords(at: Millis | null, from: Millis = now()): string {
  if (at === null) return "more than two years away";
  const day = (t: Millis) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(at) - day(from)) / 86400000);
  const date = new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const off = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `${date} (${off})`;
}

function DeckScreen({
  name,
  cards,
  progressOf,
  towardOf,
  settings,
  perDay,
  onBack,
  onCard,
}: {
  name: string;
  cards: Item[];
  progressOf: Map<string, Standing | null>;
  /** How far each card is towards learnt — see towardsLearnt. */
  towardOf: Map<string, { at: Standing; share: number } | null>;
  settings: Settings;
  perDay: number;
  onBack: () => void;
  onCard: (it: Item) => void;
}) {
  /* Every card of the deck that can be asked, now or once what it waits on
     opens: a number whose stretch is still ahead is in the deck and not
     yet learnt, and the deck's tile on Progress counts it, so this screen
     lists it too. It used to list only the cards on a level, so a deck of
     numbers opened on the handful being worked on and none of the rest. */
  const shown = cards.filter((it) => towardOf.get(it.id));
  const learnt = shown.filter((it) => towardOf.get(it.id)?.at.status === "done").length;
  const pct = deckPercent({
    n: shown.length,
    learnt,
    got: shown.reduce((sum, it) => sum + (towardOf.get(it.id)?.share || 0), 0),
  });
  const allDone = shown.length > 0 && learnt === shown.length;
  /* What is left and how soon it could be done — see workloadOf. */
  const work = useMemo(() => workloadOf(cards, settings), [cards, settings]);
  const pace = learntAtPace(work, perDay / SESSION_SIZE);
  const floor = earliestOf(work);
  const when = (t: Millis | null) => `learnt by ${forecastWords(t)}`;
  return (
    <Screen title={name} onBack={onBack}>
      <div className="at-deckhead">
        <p className="at-deckstatnote">
          {learnt} of {plural(shown.length, "card")} fully learnt
        </p>
        <span className="at-deckbar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      {allDone ? (
        <Lede>Every card in this deck is learnt.</Lede>
      ) : (
        <div className="at-forecast" aria-live="polite">
          <p>
            <b>At your pace</b>
            {perDay > 0 ? (
              <>
                <span className="at-forecastpace">{paceWords(perDay)}, your average over the past week</span>
                <span className="at-forecastdate">{when(pace)}</span>
              </>
            ) : (
              <span className="at-forecastpace">
                You haven't practised in the past week, so there is no pace to go on yet.
              </span>
            )}
          </p>
          <p>
            <b>Earliest possible</b>
            <span className="at-forecastpace">{leastWords(floor.rate)} would get it</span>
            <span className="at-forecastdate">{when(floor.at)}</span>
            <span className="at-forecastpace">Practising more than that won't bring it sooner.</span>
          </p>
          <p className="at-forecastnote">
            Both are estimates, assuming you practise only this deck and get every answer right, so the real date
            will be a little later.
          </p>
        </div>
      )}
      <ItemList
        noun="card"
        items={shown}
        itemKey={(it: Item) => it.id}
        size="small"
        empty="No cards match."
        groups={DECK_RUNS}
        groupOf={(it: Item) => (progressOf.get(it.id) ? deckRunOf(progressOf.get(it.id)) : "waiting")}
        match={(it: Item, needle: string) =>
          (leadOf(it).ar || "").includes(needle) ||
          (leadOf(it).lat || "").toLowerCase().includes(needle) ||
          (leadOf(it).en || "").toLowerCase().includes(needle)
        }
        renderItem={(it: Item) => (
          <CardTile
            card={it}
            lang={langOf(settingsFor(settings, it))}
            meta={progressOf.get(it.id) ? standingShort(progressOf.get(it.id) || null) : "Opens later"}
            className="whole"
            onClick={() => onCard(it)}
          />
        )}
      />
    </Screen>
  );
}

function ProgressTab({
  items,
  myCourses = [],
  settings,
  moves,
  perDay = 0,
  prep = null,
  onPrep,
}: {
  items: Item[];
  myCourses?: Course[];
  settings: Settings;
  /** What the ladder did each day — see `moves` on the document. */
  moves?: Record<string, DayMoves>;
  /** Questions answered on a typical recent day — see `typicalDay`. */
  perDay?: number;
  /** The learner's prep, if they have one — see Prep. */
  prep?: Prep | null;
  /** Sets, changes or clears it. */
  onPrep?: (prep: Prep | null) => void;
}) {
  const [viewing, setViewing] = useState<any | null>(null);
  /* Whether Prep mode is open. */
  const [prepOpen, setPrepOpen] = useState(false);
  /* The deck open on its own screen, or none. */
  const [deckOpen, setDeckOpen] = useState<string>("");

  /*
   * Where each card stands, and how far up it has got.
   *
   * Two answers off one walk. The first is the level to put on a card, and
   * the second is how much of the card is behind it — the levels it has
   * finished over the levels it has material for, which is a number between
   * nothing and all of it rather than a yes or a no.
   *
   * Together rather than in two memos, for the reason the buckets below are
   * worked out with their counts: both read the same list of standings, and
   * building it twice is a walk of every card for nothing.
   */
  const progress = useMemo(() => {
    const at: Map<string, Standing | null> = new Map();
    /* How far each card is towards learnt, which is what a deck's
       percentage adds up — see towardsLearnt. */
    const toward: Map<string, { at: Standing; share: number } | null> = new Map();
    /* And, for the cards at the top of the ladder, when each next comes
       round. Only for those two: it is another walk of the card's keys,
       the tiles below it show a bar instead, and a card still climbing is
       asked about tonight or tomorrow anyway. A learnt card is next seen
       at the soonest of its questions — see `nextReviewAt`; a cleared one
       is waiting on the review that counts towards learnt — see
       `nextPassAt` — and its line names that review. */
    const next: Map<string, Millis> = new Map();
    for (const it of items) {
      const rows = cardStandings(it, settings, items);
      const one = standing(rows);
      at.set(it.id, one);
      /* A level a card has no material for is not a level it is short of —
         openTypes passes those straight through, and standings leaves them
         out — so the denominator is the levels it actually has. The rows
         just read are towardsLearnt's own first reading, so a card on a
         level is not walked twice; one on no level is asked whether it is
         a number waiting on its stretch, which still counts. */
      toward.set(
        it.id,
        one ? { at: one, share: rows.filter((r) => r.status === "done").length / rows.length } : towardsLearnt(it, settings, items),
      );
      if (one && one.status === "cleared") next.set(it.id, nextPassAt(it, settings));
      else if (one && one.status === "done") next.set(it.id, nextReviewAt(it, settings));
    }
    return { at, toward, next };
  }, [items, settings]);
  const progressOf = progress.at;

  /* One tile per level, and one for the cards with nothing above them left
     to open. A card counts under the level it is on — see `standing` — so
     the tiles are a picture of where the deck actually is, rather than of
     how long its intervals happen to be. The tiles themselves, with what
     each is called and drawn as, are LADDER_TILES. */
  /* The cards behind each number, worked out once with the numbers
     themselves: a tile opens to show them, and counting them twice — once
     to say four hundred and once to list them — is a walk of every card
     for nothing. */
  const byBucket = useMemo(() => {
    const out: Record<string, Item[]> = { all: items, l1: [], l2: [], l3: [], l4: [], cleared: [], done: [] };
    for (const it of items) {
      const at = progressOf.get(it.id);
      /* A card with nothing it can be asked yet — no meaning, or every
         exercise switched off — belongs to no level and is left out of
         all five, the way it always was left out of the four before. */
      if (!at) continue;
      /* Cleared and learnt are both the top of the ladder, and both come
         out of the level they stand on: a card at the top is under its own
         tile rather than under "write it from its meaning", which is the
         whole reason the tile exists. */
      const bucket =
        at.status === "done" ? "done" : at.status === "cleared" ? "cleared" : `l${at.level}`;
      (out[bucket] || []).push(it);
    }
    return out;
  }, [items, progressOf]);
  /* Which tile is open, or none. One at a time: they are six views of the
     same cards, and two open at once is a screen you have to scroll past
     rather than read. */
  const [showing, setShowing] = useState<string>("");
  /* Whether what is open is one of the four levels, rather than every card
     at once or the ones with nothing left to open. Two things below turn on
     it: the cards are told apart by how they are going, and each says how
     far it has got on that level. Neither means anything under the other
     two tiles — "Cards" is spread over every level, so one card's 40% and
     another's would be forty per cent of different climbs, and under
     "Learnt" every bar would be full. */
  const onLevel = /^l\d$/.test(showing);
  /* And whether it is one of the two at the top, where the climb is over
     and what is left is time: every bar there would be full, so each card
     says when it is next asked instead. */
  const onTop = showing === "cleared" || showing === "done";

  /*
   * How far each deck is from being learnt outright.
   *
   * A deck is a tag on a card, which is how a deck reaches this side of
   * the app — so the decks being studied are simply the ones the cards in
   * view belong to, and the language switch has already had its say by the
   * time they get here. A card in two decks counts in both, which is the
   * only honest answer to "how far along is this deck".
   *
   * Learnt, rather than any of the four levels, because that is the one
   * that means finished: nothing left to open.
   *
   * Every card of the deck that can be asked counts, numbers still waiting
   * on their stretch among them — see towardsLearnt, which the home
   * screen's ring and a saved session's tile read too. The level tiles
   * above count only the cards on a level, so a deck of numbers can hold
   * more cards here than those tiles show.
   */
  const deckRows = useMemo(() => {
    const held: Map<string, { n: number; learnt: number; got: number }> = new Map();
    for (const it of items) {
      const toward = progress.toward.get(it.id);
      /* A card that can never be asked is not progress to be short of. */
      if (!toward) continue;
      for (const deck of it.tags || []) {
        const row = held.get(deck) || { n: 0, learnt: 0, got: 0 };
        row.n++;
        row.got += toward.share;
        if (toward.at.status === "done") row.learnt++;
        held.set(deck, row);
      }
    }
    return [...held.entries()]
      .map(([name, { n, learnt, got }]) => ({
        name,
        n,
        learnt,
        pct: deckPercent({ n, learnt, got }),
      }))
      .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  }, [items, progress]);

  /* Where the prep stands, for the line beside the button. */
  const prepNow = prep ? prepStatus(prep, items, settings) : null;
  return (
    <>
      <Lately moves={moves} />
      {/* Prep mode: getting a set of decks ready by a date, under a heading
          of its own like the other parts of the screen. The button starts
          one, or opens the one there is; the line beside it says what is
          being prepped for. */}
      <Section head title="Prep mode" lede="Get some decks ready by a set date, like an exam or the start of a class.">
        <div className="at-prepbar">
          <Button variant="ghost" onClick={() => setPrepOpen(true)} aria-haspopup="dialog">
            {prep ? "Edit prep mode" : "Start prep mode"}
          </Button>
          {prep && (
            <Help className="at-prepnote">
              {prepNow === "past"
                ? `${prep.name} has come — edit the prep or delete it.`
                : prepNow === "done"
                ? `Ready for ${prep.name}: every card is ${prep.target === "cleared" ? "cleared" : "learnt"}.`
                : `Prepping for ${prep.name} · ${
                    prepDaysLeft(prep.date) === 1 ? "1 day left" : `${prepDaysLeft(prep.date)} days left`
                  }`}
            </Help>
          )}
        </div>
      </Section>
      <Section
        head
        title="The ladder"
        lede="Where your cards are on the learning ladder. A card moves up a level once you have answered everything below it right twice running — and counts as learnt once it has come back twice since and you were right."
      >

      {/* A number you want to see the cards behind is a number worth
          pressing. Buttons rather than divs with a click on them: there is
          nothing interactive inside a tile, so it can be the one thing you
          press and the one thing a keyboard reaches.

          Six of these used to share one row, which on a phone is three
          columns of eight-point capitals — a row of numbers with their
          captions too small to read, on the screen whose whole job is
          saying where you are. They are the size of something worth
          looking at now, and each says what its level actually asks rather
          than what number it happens to be. */}
      <div className="at-rungs">
        {LADDER_TILES.map(({ key, label, icon }) => {
          const count = byBucket[key].length;
          const tone =
            key === "all"
              ? "var(--text)"
              : key === "done"
              ? "var(--jade)"
              : key === "cleared"
              ? STATUS_COLOR.cleared
              : LEVEL_COLOR[Number(key.slice(1))];
          return (
            <button
              type="button"
              className={`at-rung${key === "done" ? " learnt" : ""}`}
              key={key}
              /* A screen, not a section opening underneath: the list of
                 cards is the thing you came for, and it is worth the whole
                 window rather than a strip under a grid you then have to
                 scroll back up past. */
              aria-haspopup="dialog"
              aria-label={`${count} ${label} — see them`}
              disabled={!count}
              onClick={() => setShowing(key)}
            >
              <span className="at-rungicon" style={{ color: tone }}>
                <Icon name={icon} size={key === "done" ? 20 : 18} />
              </span>
              <b style={{ color: tone }}>{count}</b>
              <span className="at-rungname">{label}</span>
              {/^l\d$/.test(key) && <span className="at-rungstep">Level {key.slice(1)}</span>}
            </button>
          );
        })}
      </div>

      {/* The cards behind the tile that was pressed, on a screen of their
          own.

          They used to open as a strip underneath the grid, which put a
          list of any length between the tiles and everything below them:
          reading it meant scrolling past the tiles, and getting back meant
          scrolling up to find the one that was open and pressing it again.
          A list of cards is what you came for, so it gets the window — and
          leaving it is Back, which is the same way out as every other
          screen in the app. */}
      {showing && byBucket[showing].length > 0 && (
        <Screen
          title={LADDER_TILES.find((t) => t.key === showing)?.label || "Cards"}
          onBack={() => setShowing("")}
        >
        {/* What is left for a cleared card, said once for all of them. Each
            card below says which of these reviews it is waiting on, and
            "Second review in 4d" only means something to somebody who
            knows how many there are. */}
        {showing === "cleared" && (
          <Lede>
            It takes {plural(PASSES_TO_LEARN, "review")} to move a card from Cleared to Learnt.
          </Lede>
        )}
        <ItemList
          noun="card"
          items={byBucket[showing]}
          itemKey={(it: Item) => it.id}
          size="small"
          empty="No cards match."
          /* Under a level, the cards are told apart by how they are going
             on it — see STATUS_RUNS. Under "Cards" they are spread over
             every level and there is nothing one run would mean, and
             under "Learnt" they are all in the one state, which the list
             notices for itself and draws without headings. */
          groups={onLevel ? STATUS_RUNS : undefined}
          groupOf={(it: Item) => {
            const at = progressOf.get(it.id);
            return at ? at.status : "none";
          }}
          match={(it: Item, needle: string) =>
            (leadOf(it).ar || "").includes(needle) ||
            (leadOf(it).lat || "").toLowerCase().includes(needle) ||
            (leadOf(it).en || "").toLowerCase().includes(needle)
          }
          renderItem={(it: Item) => (
            <CardTile
              card={it}
              lang={langOf(settingsFor(settings, it))}
              /* Which level it is on, but only under "Cards". That is the
                 one tile whose list is every card at once, so it is the
                 one where a card's level is not already the answer to
                 which tile you pressed — and under a level the headings
                 say how it is going there as well. */
              /* And under Cleared or Learnt, when the card is next asked.
                 Those two are where a card waits on time rather than on
                 the learner, so the one thing that tells two of them
                 apart is which comes back first — "Cleared" on every
                 tile and "Learnt" on every tile said nothing at all. */
              meta={
                showing === "all"
                  ? standingShort(progressOf.get(it.id) || null)
                  : showing === "cleared"
                  ? heldLine(progressOf.get(it.id) || null) ||
                    passLine(progress.next.get(it.id) || 0, progressOf.get(it.id)?.passes || 0)
                  : onTop
                  ? reviewLine(progress.next.get(it.id) || 0)
                  : undefined
              }
              /* And under a level, how far the card has got on it. The
                 headings say which of three states it is in, which is the
                 difference between started and not; this says how much of
                 the level is behind it, which is the difference between a
                 card that is nearly through and one that has just begun —
                 and those look identical under "Learning" without it. */
              bar={onLevel ? { pct: levelPercent(progressOf.get(it.id)) } : undefined}
              /* Everything on the tile, said in full. Elsewhere a tile is
                 something to scan past and is clipped to keep it short;
                 here the small print is the answer to the question the
                 tile was pressed to ask — "Second review in 3d" cut to
                 "Second revi…" answers nothing. The grid still makes the
                 tiles in a row the same height, so the row grows to its
                 tallest and the rest stay lined up. */
              className="whole"
              onClick={() => setViewing(it)}
            />
          )}
        />
        </Screen>
      )}
      </Section>

      {/* ---- the decks, as how far each one is from finished ----

          The ladder above says where the cards are; this says where the
          decks are, which is the question somebody working through a
          course actually has. A percentage rather than a count because a
          deck of thirty and a deck of three hundred are not comparable by
          how many are left, and a bar beside it because a number alone is
          read and a bar is seen. */}
      {deckRows.length > 0 && (
        <Section head title="Decks" lede="How you're doing on each deck you're studying.">
          <div className="at-deckprog">
            {deckRows.map((d) => (
              /* A button: the whole tile opens the deck's own screen. */
              <button
                type="button"
                className={`at-deckstat${d.pct === 100 ? " done" : ""}`}
                key={d.name}
                aria-haspopup="dialog"
                onClick={() => setDeckOpen(d.name)}
              >
                <span className="at-deckstatname">{d.name}</span>
                <b>
                  {d.pct}
                  <i>%</i>
                </b>
                {/* The bar is the number again, so it is told to a screen
                    reader once: the row says it in words, the bar is
                    drawing. */}
                <span className="at-deckbar" aria-hidden="true">
                  <span style={{ width: `${d.pct}%` }} />
                </span>
                {/* And the finished cards, which is a different fact from
                    the figure above it and worth both: one says how far the
                    deck has got, the other how much of it is behind you for
                    good. "Fully" because they were the same number until
                    the figure learnt to count the levels in between. */}
                <span className="at-deckstatnote">
                  {d.learnt} of {plural(d.n, "card")} fully learnt
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {items.length === 0 && (
        <Empty title="Nothing to show yet">{noCardsYet(myCourses.length)}</Empty>
      )}

      {prepOpen && (
        <PrepScreen
          prep={prep}
          decks={deckRows}
          collection={items}
          settings={settings}
          perDay={perDay}
          onSave={(p) => {
            if (onPrep) onPrep(p);
            setPrepOpen(false);
          }}
          onBack={() => setPrepOpen(false)}
        />
      )}

      {deckOpen && (
        <DeckScreen
          name={deckOpen}
          cards={items.filter((it) => (it.tags || []).includes(deckOpen))}
          progressOf={progressOf}
          towardOf={progress.toward}
          settings={settings}
          perDay={perDay}
          onBack={() => setDeckOpen("")}
          onCard={(it) => setViewing(it)}
        />
      )}

      {viewing && (
        <CardScreen
          card={viewing}
          items={items}
          settings={settings}
          onBack={() => setViewing(null)}
        />
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
      "A card with a picture can be practiced from the picture too: hearing the word and choosing its picture, choosing the word a picture shows, and writing it from the picture alone.",
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
      /* This used to promise that *anything* done offline is sent later,
         which was true of what you learn and of nothing else. It is worth
         saying plainly which is which, because the difference is what
         somebody would plan a journey around. */
      "Practising works with no connection at all: your answers, your schedule and anything you report about a card are kept on the device and go up when you are back online.",
      "What does need a connection: setting up, joining a course, new material from your teacher, and recordings you haven't played yet. Account settings can download a whole course's recordings before you travel.",
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
/* The two letters a language is known by, off the front of its id, which
   is where its ISO code is: ar-PS is AR, vi-Hue is VI. Enough to say which
   one is on when only one is, in the room a button has. */
const langTag = (id: LangId) => String(id || "").split("-")[0].toUpperCase();

/*
 * Which of the languages you are learning are in play.
 *
 * Only for somebody learning more than one — one language needs no switch,
 * and an app that showed one anyway would be asking a question with a
 * single answer. What it decides holds everywhere in the learning space:
 * the cards you can list, what Progress counts, what is ready, and what a
 * session is dealt from.
 *
 * The button is an icon and a mark, because it lives in the chrome beside
 * the space switcher where there is room for nothing else — and the mark
 * is the whole of the state rather than a decoration: which one, when it
 * is one; how many, when it is some; that there is nothing to say, when it
 * is all of them. The rest is in the label a screen reader and a tooltip
 * both get.
 *
 * You cannot switch the last one off. An app with no languages in it is a
 * blank screen with no way of telling why, and the row says so rather than
 * just refusing.
 */
function LanguageSwitch({ choices, off, onChange, note }: {
  choices: LangChoice[];
  off: LangId[];
  onChange: (off: LangId[]) => void;
  /* What switching one off does, in the space it is switched in. */
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const mine: React.MutableRefObject<HTMLDivElement | null> = useRef(null);

  /*
   * Anywhere outside puts it away, and "outside" is asked of the click
   * rather than of who saw it.
   *
   * On the way down rather than on the way up, and reading the target
   * rather than relying on the event reaching the window at all: the
   * corner menu beside this one stops clicks inside itself from
   * travelling, so a menu that waited for one to arrive stayed open behind
   * it and the two sat over each other in the corner. Ticking a language
   * keeps this open, which is what the check on `mine` is for — you are
   * usually ticking more than one.
   */
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const at = e.target;
      if (mine.current && at instanceof Node && mine.current.contains(at)) return;
      setOpen(false);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [open]);

  /* After the hooks, which have to run on every render. */
  if (!choices || choices.length < 2) return null;

  const on = choices.filter((c) => !off.includes(c.id));
  const all = on.length === choices.length;
  const only = on.length === 1;
  const mark = all ? "All" : only ? langTag(on[0].id) : String(on.length);
  const said = all
    ? `all ${choices.length}`
    : only
    ? `${on[0].name} only`
    : `${on.length} of ${choices.length}`;

  const toggle = (id: LangId) => {
    const isOff = off.includes(id);
    if (!isOff && only) return; // the last one on stays on
    onChange(isOff ? off.filter((x) => x !== id) : off.concat([id]));
  };

  return (
    <div className="at-langsw" ref={mine}>
      <button
        className={`at-langbtn${all ? "" : " on"}`}
        aria-expanded={open}
        aria-label={`Languages — ${said}. Choose which.`}
        title={`Languages — ${said}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="language" size={18} />
        <span className="at-langmark">{mark}</span>
      </button>

      {open && (
        <div className="at-langmenu">
          <p className="at-eyebrow">Languages</p>
          <div className="at-cklist">
            {choices.map((c) => {
              const chosen = !off.includes(c.id);
              const stuck = chosen && only;
              return (
                <button
                  key={c.id}
                  className={`at-ck${chosen ? " on" : ""}`}
                  role="checkbox"
                  aria-checked={chosen}
                  /* Not disabled: a button that cannot be pressed says
                     nothing about why. It is pressable, it holds, and the
                     line under it says so. */
                  onClick={() => toggle(c.id)}
                >
                  <span className="at-ckbox">{chosen ? "✓" : ""}</span>
                  <span className="at-cktext">
                    <b>{c.name}</b>
                    <i>
                      {stuck
                        ? "the only one on"
                        : `${plural(c.total, "card")}${c.ready ? `, ${c.ready} ready` : ""}`}
                    </i>
                  </span>
                </button>
              );
            })}
          </div>
          <Help>{note}</Help>
        </div>
      )}
    </div>
  );
}

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
/* The release and the commit are shared.tsx's now: Admin writes the same
   pair into every report it copies out, and two definitions of "which
   build is this" is one too many. */
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

function CornerMenu({ account, syncState, syncNote, onSyncNow, theme, onTheme, onAccount, onPrefs, onGuide }: {
  account: User | null;
  syncState?: string;
  /** What to say about it. Worked out by the app, which is the only thing
      that knows whether this was the connection or the passphrase. */
  syncNote?: string;
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
            <span className="at-clinetext">{syncNote || "Up to date"}</span>
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
  onDevice = null,
  onDownloaded,
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
  /** Which recordings are here, so the screen can say how many are not.
      Null before anybody has looked. */
  onDevice?: Set<string> | null;
  /** Something was downloaded, so what a session may ask has changed. */
  onDownloaded?: () => void;
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
    /* More can be heard now, which decides what an offline session may
       ask. Said here rather than left to the next launch, because the
       whole point of this button is being about to go offline. */
    if (onDownloaded) onDownloaded();
  }

  /*
   * How many of this learner's recordings are not on the device.
   *
   * Worth saying out loud on this screen: offline, a card whose recording
   * is elsewhere is not asked its listening exercises, and somebody about
   * to get on a train would rather know that now than find a quieter
   * session waiting for them.
   */
  const missing = onDevice
    ? [...new Set(allClipIds)].filter((id) => !onDevice.has(id)).length
    : 0;
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
        {missing > 0 && (
          <Help>
            {`${plural(missing, "recording")} not on this device yet. Until they are, questions that
              play them are only asked when you're online.`}
          </Help>
        )}
        {allClipIds.length > 0 && (
          <div className="at-row at-mt2">
            <Button variant="ghost" size="sm"
              disabled={!!warming && !warming.finished}
              onClick={downloadAll} icon="download">{warming && !warming.finished
                ? `Downloading ${warming.done} of ${warming.total}…`
                : missing > 0
                ? `Download ${missing} for offline`
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

/*
 * The whole of what a learner can set: which language, how it looks, and
 * how loud it is.
 *
 * There was an Advanced disclosure under this holding six controls over how
 * a session is built and a row of marking leniencies, behind a sentence
 * that said the defaults were sensible. If that sentence was true the
 * controls were clutter, and if it was false the defaults were the thing to
 * fix — so the defaults were fixed and the controls went. What they used to
 * decide is now decided beside the session builder, which is the only place
 * that ever read them.
 */
function AppPreferences({ settings, setSetting }: {
  settings: Settings;
  setSetting: (key: string, value: any) => void;
}) {
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

    </>
  );
}

function nextDueLine(pool: Item[], settings: Settings) {
  const future: Millis[] = [];
  for (const it of pool) {
    for (const { unit } of drillableUnits(it, settings)) {
      for (const t of enabledTypes(unit, settings)) {
        const d = stateOf(unit, t).due || 0;
        if (d > now()) future.push(d);
      }
    }
  }
  if (!future.length) return "Nothing scheduled.";
  return `Next exercise in ${formatGap(Math.min(...future) - now())}.`;
}

