// @ts-check
/*
 * The records the app and the server pass between them.
 *
 * Types only: this module has no runtime value and compiles to nothing.
 * It exists so that the two sides of every request describe the same
 * thing. Before it, each side knew the shape of a card only by having
 * been written next to code that made one, which is how a language pack
 * came to be sent where a language id was wanted — the app was happy to
 * send it and the server was happy to receive it.
 *
 * These describe what is actually stored, not what would be tidy. Where a
 * field is optional it is because records written by an older build do
 * not have it, and the readers all cope; saying so here is what stops a
 * reader being written that does not.
 *
 * Import them with a JSDoc @import in the file that needs them:
 *
 *   \@import { Card, Flag } from "./types.js"
 */

/**
 * A language's id — "ar-PS", "vi-Hue". The key into LANGUAGES, and what is
 * stored on a card, a course and a report.
 *
 * Not the language pack itself. The two are easy to confuse and the
 * confusion is invisible at a glance, because a pack has an `id` and reads
 * perfectly well right up until it is sent somewhere expecting the string.
 * @typedef {string} LangId
 */

/**
 * Milliseconds since the epoch, as Date.now() gives them.
 * @typedef {number} Millis
 */

/* ---- people ---- */

/**
 * An account, as everything but the server sees it. The sign-in key is
 * never part of this: only its digest is stored, on the server's own copy.
 * @typedef {object} User
 * @property {string} handle       Public, permanent, what rosters point at.
 * @property {string} displayName  Public, editable, cosmetic.
 * @property {boolean} admin
 * @property {Millis} created
 * @property {Millis} [lastSeen]    Signed in or asked who they are.
 * @property {Millis} [lastLearned] The app said a session was practiced.
 * @property {Millis} [lastTaught]  A card or deck was actually made or changed.
 */

/* ---- material ---- */

/**
 * One accepted way of saying the same thing — a plural, a second dialect
 * form. Practiced on its own, so it carries its own recordings.
 * @typedef {object} CardForm
 * @property {string} ar   The word in the language's own script.
 * @property {string} en   What it means.
 * @property {string} lat  How it is pronounced, in Latin letters.
 * @property {string[]} [clips] Recording hashes.
 */

/**
 * A card, as the server stores it.
 *
 * The grammatical axes a language declares (number, gender, addressee, a
 * classifier) are stored flat on the card under their own names, which is
 * why this is indexable: the server takes whatever grammarFields() lists
 * without knowing which language uses which.
 * @typedef {CardForm & {
 *   id: string,
 *   owner: string,
 *   lang: LangId,
 *   note?: string,
 *   subs?: CardForm[],
 *   uses?: string[],
 *   rev?: number,
 *   created?: Millis,
 *   updated?: Millis,
 *   inDecks?: string[],
 *   decks?: string[],
 * } & Record<string, unknown>} Card
 */

/**
 * Where a deck sits in a course, and since when.
 * @typedef {object} DeckLink
 * @property {string} courseId
 * @property {Millis} [addedAt]
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} owner
 * @property {string} title
 * @property {string} [description]
 * @property {LangId} lang
 * @property {number} [version]  Moves whenever the deck's cards change.
 * @property {DeckLink[]} courses
 * @property {string[]} [cardIds]
 * @property {number} [cardCount]
 * @property {Millis} [updated]
 */

/**
 * @typedef {object} Course
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {LangId} language
 * @property {string[]} teachers
 * @property {string[]} students
 * @property {string[]} decks
 * @property {string} [code]         Handed round a class.
 * @property {string} [teacherCode]  Gives authority over the material.
 * @property {Millis} [created]
 */

/* ---- reported problems ---- */

/**
 * Which of the three things a learner said was wrong.
 * @typedef {"strict" | "data" | "other"} FlagKind
 */

/**
 * What has become of a flagged card since the report was sent. Worked out
 * when the report is read, never stored.
 *
 * "here" also covers a report too old to compare — nothing is claimed
 * about a card whose revision at the time was never recorded.
 * @typedef {"here" | "edited" | "gone" | "absent"} CardState
 */

/**
 * A problem a learner reported from the answer screen.
 *
 * It carries a copy of the question rather than a pointer to it, because
 * the card can be edited or withdrawn between the report and somebody
 * reading it, and an id alone would then say nothing.
 * @typedef {object} Flag
 * @property {string} id
 * @property {FlagKind} kind
 * @property {string} note        The learner's own words. Required for "other".
 * @property {string} handle      Who sent it.
 * @property {string} handleName  Their name when they sent it.
 * @property {string} cardId      The card's id **on the server**, not the device's.
 * @property {boolean} [cardKnown] Whether the site held that card when this arrived.
 * @property {number} [cardRev]    The card's revision then, for spotting an edit since.
 * @property {string} exercise     Which exercise type was being asked.
 * @property {string | null} subId Which form of the card, if not the main one.
 * @property {LangId} language
 * @property {string} prompt       The question as it was asked.
 * @property {string} meaning
 * @property {Millis} at
 * @property {CardState} [cardState] Added when the report is read, never stored.
 */

export {};
