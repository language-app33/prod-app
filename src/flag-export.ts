/*
 * Reported problems, written out as text somebody can paste somewhere.
 *
 * The admin screen shows a flag as a tile: the kind of problem, a line of
 * what the learner said, and what became of the card. That is the right
 * shape for deciding which report to act on and the wrong shape entirely
 * for acting on it — you then have to open the card, remember the
 * question, and hold the two beside each other while working out what is
 * actually wrong.
 *
 * So this: one block per report, with everything about it in one place —
 * what was asked, what the learner put, what the app made of that, where
 * the card came from, and the card as it now stands. It is meant to be
 * copied out of the app whole and handed to somebody (or something) that
 * can read it and say what the bug is.
 *
 * Plain text on purpose. It is read by a person as often as it is pasted,
 * and a report that only a parser can read is a report nobody checks. The
 * labels are fixed and the order never changes, which is what makes it
 * skimmable down the left-hand side.
 *
 * No React, no DOM, no clock and no locale: every impure thing is passed
 * in. That is what lets the whole format be checked by a test rather than
 * by copying something out of the app and reading it.
 */

import type { Card, CardForm, CardState, Flag, Millis } from "./types.ts";
import { formsOf } from "./cards.ts";
import { cardRef, fillNames } from "./variables.ts";

/*
 * The names this module cannot work out for itself.
 *
 * What an exercise is called is written per language pack; what a course
 * or deck is called is on a record the export does not carry; and how a
 * date reads belongs to the reader's own device. Each one is a function
 * rather than a table so the caller can answer from whatever it has, and
 * answering "" is always allowed — the line is then left out rather than
 * printed with a hole in it.
 */
export interface FlagNames {
  /** What a report of this kind is called. */
  kind: (kind: string) => string;
  /** What the exercise is called, in the language it was asked in. */
  exercise: (language: string, type: string) => string;
  course: (id: string) => string;
  deck: (id: string) => string;
  when: (at: Millis) => string;
}

/**
 * The cards the reports are about, as they stand now, by card id.
 *
 * Three different answers, and they are not the same thing:
 *   a card      it is still there, and here it is
 *   null        it was asked for and the site does not have it
 *   missing     it was not asked for, so nothing is claimed about it
 */
export type FlagCards = Record<string, Card | null | undefined>;

export interface FlagExportOptions {
  names: FlagNames;
  cards?: FlagCards;
  /** When the export was taken. */
  at: Millis;
  /** Which build took it — the admin's, not the reporter's. */
  release?: string;
}

/*
 * The standing instruction at the head of every export.
 *
 * Kept here, as its own thing, because it is the one part of the format
 * that is addressed to the reader rather than describing the reports — and
 * because the wording is the whole of it. Short on purpose: an instruction
 * that runs to a paragraph is an instruction that gets skimmed.
 */
const BRIEF = [
  "CLAUDE — READ THIS FIRST. Do not start fixing anything.",
  "Read all the reports, then reply with a short list of the changes you would",
  "make: one plain line each, no file names, no code, no jargon. Say which",
  "reports you think are not worth acting on, and why, in the same plain terms.",
  "Wait for me to say go before you change a single thing.",
];

/* Wide enough for the longest label below, so every value starts in the
   same column and the block reads as a table without being one. */
const LABEL = 13;

/** One `Label:   value` line, or nothing at all where there is no value. */
function row(label: string, value: unknown): string[] {
  const said = String(value == null ? "" : value).trim();
  if (!said) return [];
  /* A value with newlines in it — somebody's paragraph — is indented under
     its label rather than breaking the column. */
  const [first, ...rest] = said.split("\n");
  return [
    `${(label + ":").padEnd(LABEL)}${first}`,
    ...rest.map((l) => `${" ".repeat(LABEL)}${l.trim()}`),
  ];
}

/*
 * What the app made of the answer, in words rather than in the app's own
 * vocabulary.
 *
 * "shown" and "skipped" are the two that matter most and read least: a
 * card flagged after its answer was given away is usually a card nobody
 * could have guessed, and that is a different bug from a wrong one.
 */
const MARKED: Record<string, string> = {
  right: "right",
  near: "nearly right — the right word, not quite spelt",
  wrong: "wrong",
  shown: "wrong — they had asked to be shown the answer",
  skipped: "skipped",
  unanswered: "not answered — they flagged the question itself",
};

/* What has become of the card since, said only where it is news. A card
   exactly as it was needs no line, and one is not claimed for a report too
   old to compare. */
const SINCE: Record<CardState, string> = {
  here: "",
  edited: "edited since this was reported, so it may already be fixed",
  gone: "deleted since this was reported",
  absent: "the site did not hold this card even when the report was sent",
};

/** `word — meaning — pronunciation`, with the empty parts left out. */
const formLine = (f: CardForm) =>
  [f.ar, f.en, f.lat].map((s) => String(s || "").trim()).filter(Boolean).join(" — ");

/** Whether a form has anything recorded, at either speed. */
const hasAudio = (f: CardForm) =>
  ((f.clips && f.clips.length) || 0) + ((f.slowClips && f.slowClips.length) || 0) > 0;

/*
 * The card itself, indented under the report it belongs to.
 *
 * Every form, not just the one that was asked: a report about the plural
 * is unreadable without the singular beside it, and which form was being
 * asked is on the report already. Recordings are named but not carried —
 * whether a form has audio is most of what an audio report is about, and
 * the audio itself is not something to paste anywhere.
 */
function cardBlock(card: Card, when: FlagNames["when"]): string[] {
  const out: string[] = [];
  /*
   * Through formsOf, never off `card.forms`.
   *
   * A card's word used to be stored as fields of the card itself with its
   * alternates in `subs`, and cards written that way and not re-saved
   * since are still in the store exactly as they were — the server hands
   * back what it holds. Reading `forms` directly found nothing on every
   * one of them, so the most useful part of the export came out as a
   * revision number and a blank, which is worse than saying nothing.
   *
   * formsOf is what every other reader in the app uses and it lifts the
   * old shape where it meets it. This had no symptom in a test, because a
   * card saved through the server is normalised on the way in and comes
   * back new-shaped.
   */
  formsOf(card).forEach((f, i) => {
    const said = formLine(f);
    if (!said) return;
    const marks = [
      hasAudio(f) ? "has a recording" : "",
      /* Absent means yes, which is what every form written before it could
         be turned off meant. A form nobody is ever asked about cannot be
         the one a report is about, and saying so is the quickest way to
         rule it out. */
      f.ask === false ? "never asked" : "",
      f.row && f.col ? `table cell ${f.row}/${f.col}` : "",
    ].filter(Boolean);
    out.push(
      `  ${(i === 0 ? "word" : `form ${i + 1}`).padEnd(10)}${said}${marks.length ? `  [${marks.join(", ")}]` : ""}`
    );
  });
  /* A conversation card teaches its lines rather than a word, so a readout
     without them is a readout of nothing. */
  const lines = Array.isArray(card.lines) ? card.lines : [];
  lines.forEach((l, i) => {
    const said = formLine(l);
    if (said) out.push(`  ${`line ${i + 1}`.padEnd(10)}${said}`);
  });
  const facts: [string, unknown][] = [
    ["category", card.category],
    ["called", card.name],
    ["worth", card.value],
    /* The name this one card answers to, and the groups it is one of —
       the two ways a blank reaches it, so a report about a card that
       turned up in the wrong sentence says both. */
    ["id", cardRef(card) ? `{{${cardRef(card)}}}` : ""],
    ["fills", fillNames(card).map((name) => `{{${name}}}`).join(" ")],
    ["note", card.note],
    ["drilled", card.drill === false ? "no — this card is a value, not a question" : ""],
    [
      "revision",
      card.rev ? `${card.rev}${card.updated ? `, last saved ${when(card.updated)}` : ""}` : "",
    ],
  ];
  for (const [label, value] of facts) {
    const said = String(value == null ? "" : value).trim();
    if (said) out.push(`  ${label.padEnd(10)}${said.split("\n").join(" ")}`);
  }
  return out;
}

/** One report, with the card it is about under it. */
function block(flag: Flag, n: number, of: number, opts: FlagExportOptions): string[] {
  const { names, cards = {} } = opts;
  const out: string[] = [`── report ${n} of ${of} ${"─".repeat(Math.max(0, 40 - String(n).length))}`];

  const exercise = names.exercise(flag.language, flag.exercise);
  const courseName = flag.courseId ? names.course(flag.courseId) : "";
  const deckName = flag.deckId ? names.deck(flag.deckId) : "";
  const since = SINCE[flag.cardState || "here"] || "";

  out.push(
    ...row("Problem", names.kind(flag.kind)),
    ...row("Their words", flag.note),
    ...row("Reporter", `${flag.handleName || flag.handle}${flag.handle ? ` (${flag.handle})` : ""}`),
    ...row("Sent", `${names.when(flag.at)}${flag.release ? `, on app ${flag.release}` : ""}`),
    /* The exercise's own name, with the bare type after it: the name is
       what a person reads and the type is what a grep finds. */
    ...row(
      "Question",
      [exercise, flag.exercise && exercise !== flag.exercise ? `(${flag.exercise})` : ""]
        .filter(Boolean)
        .join(" ")
    ),
    ...row("Form", flag.subId),
    ...row("Language", flag.language),
    ...row("Asked", flag.prompt),
    ...row("Meaning", flag.meaning),
    /* Quoted, because the whole value of keeping it is the trailing space
       or the missing letter, and unquoted those are invisible. */
    ...row("They put", flag.answer ? `"${flag.answer}"` : ""),
    ...row("Marked", MARKED[flag.verdict || ""] || ""),
    ...row("Course", courseName ? `${courseName} (${flag.courseId})` : flag.courseId),
    ...row("Deck", deckName ? `${deckName} (${flag.deckId})` : flag.deckId),
    ...row("Card", `${flag.cardId || "none"}${since ? ` — ${since}` : ""}`)
  );

  /* Nothing is said about a card that was never looked up: an export that
     silently reported "not on the site" for a card it had not asked about
     would be worse than one that says nothing. */
  if (Object.prototype.hasOwnProperty.call(cards, flag.cardId)) {
    const card = cards[flag.cardId];
    out.push("");
    if (card) {
      out.push("The card as it stands now:", ...cardBlock(card, names.when));
    } else {
      out.push("The card is not on the site any more — the question above is all there is of it.");
    }
  }
  return out;
}

/**
 * Every report given, as one block of text.
 *
 * In the order they are handed over, which on the admin screen is newest
 * first — the order they are read in, and so the order they should be
 * worked through in.
 */
export function flagsToText(flags: Flag[], opts: FlagExportOptions): string {
  const list = flags || [];
  const { names } = opts;
  const head = [
    `Problems reported by learners — ${list.length} ${list.length === 1 ? "report" : "reports"}, newest first.`,
    `Exported ${names.when(opts.at)}${opts.release ? ` from app ${opts.release}` : ""}.`,
    /*
     * What to do with this, said first and said to the reader.
     *
     * An export pasted into an assistant is read as a job to start, and
     * what comes back is a pile of edits nobody asked for. What is wanted
     * first is a short list of what would change, in words, to be agreed
     * or thrown out before any of it is built — so it goes at the very
     * top, ahead of the reports it is about, where an instruction is read
     * before the thing it governs rather than after.
     */
    "",
    ...BRIEF,
    "",
    "Each block below is one report sent from the answer screen, followed by",
    "the card it is about as that card stands now. A card may have been edited",
    "or deleted since the report was sent; where it has, the report says so.",
  ];

  /* Reports made before the app recorded what the learner put carry less,
     and saying which is better than leaving somebody to wonder why one
     report has half the lines of the next. */
  const thin = list.filter((f) => !f.verdict).length;
  if (thin && list.length) {
    const whichOnes =
      thin === list.length
        ? list.length === 1
          ? "This was sent"
          : "These were all sent"
        : `${thin} of these ${thin === 1 ? "was" : "were"} sent`;
    head.push(
      "",
      `${whichOnes} by an older version of the app, which did not record`,
      "what the learner answered or which deck the card came from. Those lines are",
      "missing rather than empty."
    );
  }
  if (!list.length) return [head.join("\n"), "Nothing has been reported."].join("\n\n") + "\n";

  /* The head is one paragraph and each report is another: the blank line
     between blocks is what makes a long export skimmable, and the head's
     own lines are not blocks. */
  const body = list.map((f, i) => block(f, i + 1, list.length, opts).join("\n"));
  return [head.join("\n"), ...body].join("\n\n") + "\n";
}
