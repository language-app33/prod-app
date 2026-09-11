/** @import { Item, Lang } from "./types.js" */
/*
 * Where each word turns up.
 *
 * A phrase a teacher wrote that contains a word they also teach is a
 * context for that word — somewhere it was really said. The pairing is
 * stored on the phrase, as the teacher confirmed it; this turns that round
 * into what everything else needs: for a given form, the phrases that show
 * it in use, and where inside each one it sits.
 *
 * It lived in the trainer, which meant only a learner could ask the
 * question. The teaching space needs the same answer about the same cards
 * — to say which exercises a card could be asked before anybody presses
 * anything — and two implementations of "is this word in that phrase"
 * would be two answers to it.
 *
 * Pure, and derived rather than stored: it cannot fall out of step with
 * the cards it came from, because it is rebuilt from them.
 */

import { findWordSpan, supportsContext } from "./languages.js";
import { unitsOf } from "./scheduler.js";
import { dialogPhrases } from "./dialogs.js";

/*
 * Build it from the items in hand.
 *
 * A phrase names the *card* it teaches, because that is what a teacher
 * ticks. Which form of that card actually appears is a question for the
 * matcher: a phrase may hold the plural rather than the singular the card
 * leads with, and asking for the wrong form would be a question with no
 * right answer.
 */
/**
 * @param {Item[]} items
 * @param {Lang} lang
 */
export function buildContextIndex(items, lang) {
  const index = new Map();
  if (!supportsContext(lang)) return index;
  const byId = new Map(items.map((it) => [it.id, it]));

  /* A dialog's lines stand alongside the teacher's phrases here, in the
     same shape and on the same terms: a line that names the words it uses
     is somewhere those words turned up, and the gap-fill neither knows
     nor needs to know that this one came out of a conversation. It is
     what makes a scene worth writing on the first day — every word
     already being learnt gains a real exchange to be gapped inside of,
     with nothing new marked. */
  for (const phrase of items.concat(/** @type {any} */ (dialogPhrases(items)))) {
    const uses = phrase.uses || [];
    if (!uses.length || !phrase.ar) continue;
    for (const targetId of uses) {
      const target = byId.get(targetId);
      if (!target) continue;
      for (const { unit } of unitsOf(target)) {
        if (!unit.ar) continue;
        const span = findWordSpan(phrase.ar, unit.ar, lang);
        if (!span) continue;
        const list = index.get(unit.id) || [];
        list.push({
          id: phrase.id,
          ar: phrase.ar,
          en: phrase.en,
          recs: phrase.recs || [],
          slot: span.at,
          /* How many tokens the word takes up. One in Arabic, two for a
             Vietnamese compound — and the gap has to cover all of them,
             because blanking one syllable of a two-syllable word leaves
             the answer half written on the screen. */
          span: span.len,
        });
        index.set(unit.id, list);
        /* One form per phrase: if a phrase contained both the singular and
           the plural it would be a context for each, but the first match
           is the one the teacher meant. */
        break;
      }
    }
  }
  return index;
}
