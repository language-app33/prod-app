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

/* ---- exercises and grammar ---- */

/**
 * One exercise type: what it shows, what it asks for, and what a card must
 * carry for it to be askable at all. The registry everything derives from —
 * which states a card keeps, what a session may pick, what the settings
 * list — so retiring a type is one edit.
 * @typedef {object} ExerciseSpec
 * @property {string} instruction
 * @property {string} label        May contain {Script}/{translit} placeholders.
 * @property {string} short
 * @property {string[]} needs      Fields a card must have for this to be asked.
 * @property {string} question
 * @property {string} placeholder
 * @property {string} promptField  "audio" marks the listening exercises.
 * @property {string} answerField
 * @property {string} answerMode
 * @property {string} [hintField]
 * @property {string} [hintLabel]
 * @property {string} [hintHideLabel]
 * @property {boolean} [gentle]    Recognition rather than production.
 * @property {boolean} [retired]   Still defined so stored states can be read.
 * @property {boolean} [quizAttr]  Asks a derived property rather than the word.
 */

/**
 * A grammatical axis a word varies along — number, gender, addressee.
 * @typedef {object} GrammarDim
 * @property {string} label
 * @property {string} field
 * @property {boolean} required
 * @property {[string, string][]} options  [stored value, what to show].
 * @property {string} [default]  What a new or unreadable value becomes.
 * @property {boolean} [retired]
 */

/* ---- a language ----

   The pack in LANGUAGES: everything language-specific in one object, which
   is what lets the rest of the app know nothing about any particular
   language. Optional means genuinely absent from at least one pack today,
   not merely forgettable — Hebrew declares no scale, Vietnamese no script
   regex, and only Vietnamese has a lexical axis. Writing that down is what
   stops a reader assuming all three are always there. */

/**
 * One row of the importer's worked example, in this language.
 * @typedef {object} LangSample
 * @property {string} ar
 * @property {string} en
 * @property {string} lat
 */

/**
 * Something computed from a word rather than stored on it — a root, a
 * spelling with the tone taken off. `compute` returns the key that gathers
 * words together.
 * @typedef {object} Derived
 * @property {string} id
 * @property {string} label
 * @property {(word: string) => string} compute
 * @property {boolean} groups     Whether it gathers words in the Progress tab.
 * @property {boolean} quizzable  Whether it can be asked as an exercise.
 * @property {string} [heading]   What to call the words it gathers, in this language's terms.
 * @property {string} [short]
 * @property {{ id: string, label: string, merges: string[] }[]} [classes] The classes it is graded in, which may be fewer than the language writes.
 */

/**
 * A leniency the teacher can set on a course.
 * @typedef {object} LangOption
 * @property {string} key
 * @property {string} label
 * @property {string} help
 * @property {[string, string][]} [choices] Absent on a plain on/off.
 * @property {boolean} [toggle]
 */

/**
 * What each shade of not-quite-right is called. The tiers are the same in
 * every language; only the words for them differ.
 * @typedef {object} Verdicts
 * @property {string} partial
 * @property {string} missing
 * @property {string} near
 * @property {string} bare
 */

/**
 * A language pack. Everything language-specific lives here, so that
 * divergent copies of a grader or an editor cannot exist.
 * @typedef {object} Lang
 * @property {LangId} id
 * @property {string} name
 * @property {string} nativeName
 * @property {string} direction    "rtl" or "ltr".
 * @property {string} scriptLabel
 * @property {string} scriptShort
 * @property {RegExp} [script]     How to recognise the script. Latin-written languages have none.
 * @property {number} [scale]      Type scale against Arabic, which is 1 by definition.
 * @property {number} [leading]
 * @property {LangSample[]} sample
 * @property {string} translitLabel
 * @property {string[]} grammar    Which axes of GRAMMAR this language uses.
 * @property {Verdicts} verdicts
 * @property {Derived[]} derived
 * @property {(word: string) => string} similarityKey
 * @property {string} similarityMode
 * @property {{ matches: (token: string, word: string) => boolean, tokens?: (text: string) => string[] }} context A pack may split a phrase its own way; none does yet, and contextTokens() reads it.
 * @property {boolean} translitDrilled
 * @property {string} formsLabel
 * @property {string} fontStack
 * @property {{ rows: string[][], extras: string[], marks: string[], marksLabel: string }} keys
 * @property {(given: string, expected: string, settings?: any) => any} check
 * @property {LangOption[]} options
 * @property {string[]} rules
 * @property {{ key: string, label: string, help: string }} [lexical] Only where the language has one.
 * @property {(text: string) => string} [guessKind] A pack's own rule for word/phrase/sentence. None has one yet; guessKind() reads it.
 */

/**
 * The learner's settings, as the document stores them.
 *
 * Deliberately open: most keys are the leniency options a language pack
 * declares, so which ones exist depends on the language and cannot be
 * listed here. `language` is the one every reader relies on, and the one
 * worth naming.
 * @typedef {{ language?: LangId } & Record<string, any>} Settings
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
