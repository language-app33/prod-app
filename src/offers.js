/** @import { ExerciseSpec, Form, Item, Lang } from "./types.js" */
/*
 * Every exercise a card could be asked, and what the ones it cannot are
 * waiting for.
 *
 * "What is on a card decides what can be asked of it" is the rule the
 * whole exercise table rests on, and until now it was a sentence in a help
 * screen. This is what lets a screen show it: the exercises a card can do,
 * the ones it cannot, and the missing field behind each of those — a
 * recording, the meaning, a phrase that uses the word. A card one field
 * short of two more exercises is worth saying so about.
 *
 * Two things are left out rather than shown as impossible, because they
 * are not about missing data:
 *
 *   - exercises for another shape of card. A word is not waiting for a
 *     conversation, and a conversation is not waiting to be asked what it
 *     means.
 *   - exercises this language never drills. Telling a Vietnamese teacher
 *     their card cannot be asked for its romanisation answers a question
 *     nobody asked.
 *
 * Pure, and told rather than asking: which phrases show a form in use is a
 * question the learner's app and the teaching space answer from different
 * places, so it is passed in. Everything else is read off the card.
 */

import { DIALOG_NEEDS, dialogNeedMet, roleOf } from "./dialogs.js";
import { saidAnswers } from "./answers.ts";
import { EX, TYPES, answerFields, derivedValue, exOf, needLabel, quizAttrOf } from "./languages.js";

/*
 * What this unit has not got, of what an exercise asks for.
 *
 * Several needs are not fields on the card: "recs" asks whether it has a
 * recording of its own, the context ones ask about the phrases that show
 * it in use, and the dialog ones ask about the shape of the scene it is or
 * sits in.
 *
 * A list rather than a yes or no, because a screen that greys a button out
 * has to say what it is waiting for — a greyed-out button with no reason
 * is a puzzle, and the answer is always something small and fixable.
 */
/**
 * @param {Form} unit
 * @param {ExerciseSpec} spec
 * @param {{ card: Item, at: number } | null} scene
 * @param {any[]} contexts  The phrases that show this unit in use.
 * @returns {string[]}
 */
export function unmetNeeds(unit, spec, scene, contexts) {
  return spec.needs.filter((/** @type {string} */ f) => {
    if (f === "recs") return !(unit.recs || []).length;
    if (f === "contexts") return !contexts.length;
    if (f === "contextAudio") return !contexts.some((c) => (c.recs || []).length > 0);
    if (DIALOG_NEEDS.includes(f)) return !dialogNeedMet(f, scene, unit);
    /* A pronunciation question is about one accepted answer, so what it
       needs is an answer that has one — not merely a transliteration
       somewhere on the card. A form accepting two spellings with a
       transliteration for only the second can still be asked, about the
       second; one with a transliteration and no spelling beside it cannot
       be asked at all. */
    if (f === "lat") return !saidAnswers(unit, answerFields()).length;
    return !(/** @type {any} */ (unit)[f]);
  });
}

/* Whether this unit can be asked this exercise at all: nothing missing,
   the right shape of card, and a language that drills it. */
/**
 * @param {{ unit: Form, scene: { card: Item, at: number } | null, contexts: any[] }} on
 * @param {string} type
 * @param {Lang} lang
 */
export function canAsk(on, type, lang) {
  const spec = EX[type];
  if (!spec || spec.retired) return false;
  if ((spec.dialog || "word") !== roleOf(on.unit, on.scene)) return false;
  if (!drilledBy(spec, lang, on.unit)) return false;
  return unmetNeeds(on.unit, spec, on.scene, on.contexts).length === 0;
}

/* The two reasons a language rather than a card refuses an exercise. */
/**
 * @param {ExerciseSpec} spec
 * @param {Lang} lang
 * @param {Form} [unit]
 */
function drilledBy(spec, lang, unit) {
  const attr = quizAttrOf(lang);
  /* Only where the language has named something to listen for — and, when
     a particular card is in hand, where its spelling actually yields it. */
  if (spec.quizAttr && !(attr && (!unit || derivedValue(attr, unit.ar)))) return false;
  /* And not where going to and from the second writing would mean asking
     for the word that is already on screen. */
  if (lang.translitDrilled === false && spec.needs.includes("lat")) return false;
  return true;
}

/**
 * @typedef {object} Offer
 * @property {string} type
 * @property {string} label      The exercise's name, in this language's words.
 * @property {Form} unit         Which form or line it would be asked of.
 * @property {string | null} subId
 * @property {boolean} ready     Whether it can be asked today.
 * @property {string[]} missing  What it is waiting for, where it cannot.
 * @property {boolean} off       Whether it is switched off in the settings.
 */

/*
 * The list, in the order the exercise table is written in — which runs
 * from recognition to production, so reading it top to bottom is reading
 * what the card can do in the order a learner would meet it.
 */
/**
 * @param {{
 *   units: { unit: Form, isSub: boolean, scene?: { card: Item, at: number } | null }[],
 *   lang: Lang,
 *   contextsFor?: (unit: Form) => any[],
 *   enabled?: (type: string) => boolean,
 * }} args
 * @returns {Offer[]}
 */
export function offersFor({ units, lang, contextsFor = () => [], enabled = () => true }) {
  const known = units.map((u) => ({
    unit: u.unit,
    isSub: u.isSub,
    scene: u.scene || null,
    contexts: contextsFor(u.unit) || [],
  }));

  /** @type {Offer[]} */
  const offers = [];
  for (const type of TYPES) {
    const spec = EX[type];
    const role = spec.dialog || "word";
    const fits = known.filter((u) => roleOf(u.unit, u.scene) === role);
    if (!fits.length) continue;
    if (!drilledBy(spec, lang)) continue;

    /* The unit that can actually be asked, where there is one — a scene
       with three lines is ready for a reply as soon as any one line is —
       and otherwise the first of them, which is what the missing fields
       are then reported against. */
    const ready = fits.find((u) => canAsk(u, type, lang));
    const on = ready || fits[0];
    offers.push({
      type,
      label: (exOf(type, lang) || { label: type }).label,
      unit: on.unit,
      subId: on.isSub ? on.unit.id : null,
      ready: !!ready,
      /* Said in the card's own language, so "the script" is the name this
         language gives its script. */
      missing: ready ? [] : unmetNeeds(on.unit, spec, on.scene, on.contexts).map((f) => needLabel(f, lang)),
      off: !enabled(type),
    });
  }
  return offers;
}
