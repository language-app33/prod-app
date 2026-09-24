/*
 * Editing a card.
 *
 * Everything the card editor is made of, and nothing else: the editor
 * itself, the pieces it is built from — accepted answers, a form's
 * recordings, the table a verb's forms are laid out in, the deck picker,
 * the blank picker — and the small pure rules about what a card is and
 * what can be saved. It came out of spaces.tsx as one piece so that the
 * teaching space is the teaching space and the editor is the editor.
 *
 * The stored card stays one thing; this file only decides how it is edited.
 */
import React, { useState, useEffect, useId, useMemo, useRef } from "react";
import * as API from "./courses-api.ts";
import type { Card, Deck, GrammarDim, Lang, VerbSpec, VerbTense } from "./types.ts";
import { cellsIn, citationOf, citedWord, framesOf, isCell, isFrame, personsOf, rowIdsOf, slotRows, tensesOf } from "./verbs.ts";
import { leadOf, subFormsOf } from "./cards.ts";
import type { Node } from "./shared.tsx";
import {
  categoriesOf,
  categoryOf,
  answerDims,
  categoryLabel,
  cap,
  briefOf,
  cardDims,
  dimValues,
  specOf,
  tablesOf,
  findWordSlot,
  answerFields,
  guessKind,
  kindOf,
  labelFor,
  supportsContext,
  scriptVars,
} from "./languages.ts";
import { MAX_SPEAKERS, isDialog, namedPart, sideOf } from "./dialogs.ts";
import { answerRows, answersOf, packAnswers } from "./answers.ts";
import { cardRef, dropRail, fillNames, fillsOf, isLent, isSentence, MAX_FILLS, movedSlot, refClash, slotName, slotsIn, slotsOf, slotTrouble, splitSlots, withoutSlot, withSlotAt, WORD_SLOT, wordsDir } from "./variables.ts";
import { combosOf, EXAMPLES_CEILING, examplesOf, fillersFor, rowsLine, tensedBlanks } from "./card-facts.ts";
import type { Value } from "./variables.ts";
import type { Answer } from "./answers.ts";
import {
  Button,
  splitAlternatives,
  joinAlternatives,
  CheckList,
  CLIP_KINDS,
  ClipList,
  clipsOf,
  Field,
  Help,
  Icon,
  IconButton,
  iconNode,
  KeysButton,
  RadioGroup,
  Notice,
  Screen,
  Segmented,
  plural,
  useOffline,
  ConfirmModal,
  Overlay,
} from "./shared.tsx";

/* A blank form carries every grammatical value any language might use, so a
   card written in one language is not quietly stripped when opened in
   another. Which of them the editor actually shows is the language's call. */
const blankForm = () => ({ ar: "", en: "", lat: "", clips: [], slowClips: [], ...dimValues({}) });

/*
 * A name for a form, so that something can point at it.
 *
 * A form used to be known by where it sat in the list, which is a fact
 * about the list: the pronouns a form takes on its end had nothing to name
 * as their own, and a form inserted above another moved every student's
 * schedule down a place. So a form gets a name when it is made, and keeps
 * it.
 *
 * Short and made here rather than asked for: nobody sees it, and the only
 * thing it has to be is different from the names already on this card.
 * Letters and digits, which is the shape the server stores an id in.
 */
const formName = (taken: { id?: string }[]): string => {
  const used = new Set((taken || []).map((f) => String((f && f.id) || "")));
  for (let tries = 0; tries < 50; tries++) {
    const made = `f${Math.random().toString(36).slice(2, 8)}`;
    if (!used.has(made)) return made;
  }
  /* Fifty collisions in a row is not a thing that happens; a name that is
     certainly free beats a loop that could go round for ever. */
  return `f${Date.now().toString(36)}`;
};

/* A turn nobody has written yet. No grammar on it: a line of a dialog is a
   thing somebody says, and whether it is singular or plural is a question
   about a word. `uses` is per line rather than per card, because a line is
   where a word actually turns up. */
/* A turn nobody has written yet, named so that a student's progress on it
   can point at something. Named here rather than on save, because a turn
   added and then moved is the same turn. */
const blankLine = (taken: { id?: string }[] = []) => ({
  id: formName(taken),
  who: 0, ar: "", en: "", lat: "", clips: [], slowClips: [], uses: [],
});

/* One answer, or several: a field per accepted answer, a + after the last
   to add another and a − on every extra. What is stored is still one
   string with " / " between the answers, so the checker and every card
   already saved are untouched; the slash a teacher used to type by hand is
   now a button. The list is local state seeded from the stored string —
   deriving it on every render would drop an added field the moment it was
   added, because an empty answer joins to nothing. */
function Alternatives({ value, onChange, render, of = "", addLabel = "Add another accepted answer" }: {
  value?: string;
  onChange: (value: string) => void;
  /* The third argument is what to call this box out loud, where the label
     above it does not say on its own — see `of`. A caller drawing
     something that carries its own name ignores it. */
  render: (value: string, onChange: (v: string) => void, label: string | undefined) => Node;
  /**
   * Which form these belong to, where saying so is the only way to tell
   * them apart.
   *
   * A card whose forms are laid out in a table has four blocks of
   * identical fields under four headings, and a heading is not a label:
   * somebody reading the screen aloud would meet four boxes all called
   * "English" with no way to know which was the feminine's.
   */
  of?: string;
  addLabel?: string;
}) {
  const [list, setList] = useState(() => splitAlternatives(value || ""));
  /*
   * What this last handed up, so a change made anywhere else comes back
   * down.
   *
   * The rows were read off the prop once and never again, which was
   * invisible for as long as typing here was the only thing that ever
   * wrote to the field. It is not any more: a blank is put into the card's
   * three fields at once from outside, and against a list that had stopped
   * listening that wrote to the card and changed nothing on screen — then
   * the next keystroke saved the stale rows back over it.
   *
   * Compared against what went up rather than against the list itself, so
   * an empty row somebody has just added — which packs away to nothing and
   * would otherwise look like an outside change — is left where it is.
   */
  const sent = useRef(value || "");
  useEffect(() => {
    if ((value || "") === sent.current) return;
    sent.current = value || "";
    setList(splitAlternatives(value || ""));
  }, [value]);
  const commit = (next: string[]) => {
    setList(next);
    const joined = joinAlternatives(next);
    sent.current = joined;
    onChange(joined);
  };
  const named = (i: number) =>
    of ? `English${list.length > 1 ? ` of accepted answer ${i + 1}` : ""} for ${of}` : undefined;
  return (
    <div className="at-alts">
      {list.map((v, i) => (
        <div className="at-altrow" key={i}>
          <div className="at-altfield">
            {render(v, (nv) => commit(list.map((x, j) => (j === i ? nv : x))), named(i))}
          </div>
          {list.length > 1 && (
            <IconButton
              icon="remove"
              label={of ? `Remove this answer for ${of}` : "Remove this answer"}
              onClick={() => commit(list.filter((_, j) => j !== i))}
            />
          )}
          {i === list.length - 1 && (
            <IconButton
              icon="add"
              label={of ? `${addLabel} for ${of}` : addLabel}
              onClick={() => commit(list.concat([""]))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/*
 * What an answer is grammatically: one axis to a line.
 *
 * Number on one line, gender on the next, each with its values beside its
 * name and exactly one of them chosen — which is what a radio button is
 * for, and what these have been all along. They were a track of segmented
 * buttons per axis, each stacked under a label of its own, so three axes
 * came to six rows of furniture under a word of two syllables, and the
 * panel they sat in was taller than the fields it belonged to.
 *
 * Where a line is too narrow for the names — a phone, or an axis with
 * three long values — the values read as the abbreviations the pack gives
 * them instead: "sg. pl. N/A", which is what the card list has always
 * called them. Both are written into every row and the width of the panel
 * picks, so nothing is measured in JavaScript and the choice is made again
 * whenever the panel is a different width — a phone turned on its side,
 * the same card opened on a laptop.
 *
 * An axis a language does not insist on gets one more button than it has
 * values — *not set*, at the front. A radio cannot be un-clicked, and a
 * gender chosen by mistake with no way back is worse than a gender
 * nobody said.
 */
function GrammarRadios({ dims, values, onPick, of, bare }: {
  dims: GrammarDim[];
  values: Record<string, any>;
  onPick: (field: string, value: string) => void;
  /** Which answer these belong to, as a screen reader should hear it.
      Left out where they belong to the card, which has only one of each
      and needs nothing said to tell them apart. */
  of?: string;
  /** Without the axis's name in the row, for a caller whose own label has
      already asked the question. The name stays on the group, so nothing
      is lost to a screen reader. */
  bare?: boolean;
}) {
  /* What makes a row exclusive to the browser. A card shows several forms
     at once and each shows every answer it accepts, so a name built out of
     the axis alone would put every gender on the screen into one group —
     and arrowing through it would walk out of the answer being edited. */
  const id = useId();
  return (
    <div className={`at-answerdims${bare ? " bare" : ""}`}>
      {dims.map((dim) => (
        <div
          className="at-dimrow"
          role="radiogroup"
          aria-label={of ? `${dim.label} ${of}` : dim.label}
          key={dim.field}
        >
          {!bare && <span className="at-dimname">{dim.label}</span>}
          <span className="at-dimpicks">
            {(dim.required ? [] : [["", "not set", "—"] as [string, string, string]])
              .concat(dim.options.map(([v, label]) => [v, label, briefOf(dim, v)]))
              .map(([value, label, brief]) => (
                <label className="at-dimpick" key={value || "unset"}>
                  <input
                    type="radio"
                    name={`${id}-${dim.field}`}
                    checked={String(values[dim.field] || "") === value}
                    onChange={() => onPick(dim.field, value)}
                    aria-label={label}
                  />
                  {/* Said twice and heard once: the input carries the name
                      a screen reader reads, and these two are what the eye
                      gets — whichever of them the line has room for. */}
                  <span className="at-dimlong" aria-hidden="true">{label}</span>
                  <span className="at-dimbrief" aria-hidden="true">{brief}</span>
                </label>
              ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/*
 * The same list, where the language also has a transliteration — and each
 * answer's own grammar.
 *
 * An accepted answer, how it is said and what it is grammatically are one
 * row, because they are one thing. Two spellings are two words: "I'm happy"
 * said by a man and by a woman differ by a syllable and by a gender, and a
 * single "masculine" written over the pair described one of them and lied
 * about the other. Adding an answer
 * adds every cell; removing one removes them all. That is the guard against
 * the stored lists drifting out of step, and it is here because here is the
 * only place any of them is written.
 *
 * The grammar sits behind a toggle per row rather than on the face of it:
 * most cards accept one answer and want the language's default, and four
 * pickers under every row would bury the words the card is actually about.
 */
function ScriptAnswers({ lang, dims, rows, of = "", onEdit, onCommit, onRecord, ownRecorders, blanks, onRemoveBlank }: {
  lang: Lang;
  /**
   * Which form of the card these boxes belong to, where saying so is the
   * only way to tell them apart.
   *
   * A card's own word needs nothing: there is one of it, and the heading
   * above says which card. Its other forms are three blocks of identical
   * fields under three headings, and a heading is not a label — somebody
   * reading the screen aloud would meet four boxes all called the same
   * thing and no way to know which was the feminine.
   */
  of?: string;
  /* The axes this *answer* is asked about — the kind of word's own list
     and not the pack's, less whatever is true of the card rather than of
     one of its answers: a preposition has neither number nor gender, and
     person-or-thing is asked once beside the kind of word. See answerDims.
     What is stored is never narrowed by this. */
  dims: GrammarDim[];
  /**
   * The answers as they stand, held by the form above.
   *
   * Lifted out of here in 0.217, when the recording button moved up onto
   * the form's own heading: the button has to know how many answers there
   * are — with one it is the form's, with two it belongs beside the word
   * it is of — and two components cannot each keep their own count of the
   * same list without eventually disagreeing about it.
   */
  rows: Answer[];
  onEdit: (i: number, patch: Partial<Answer>) => void;
  onCommit: (next: Answer[]) => void;
  onRecord: (i: number) => void;
  /** Whether each answer carries its own recording button. False where
      there is one of them and it rides in the heading instead. */
  ownRecorders: boolean;
  /* What a sentence's fields need in order to have blanks put into them,
     and nothing on a word: only a sentence may have one. Two bars per row
     rather than one, because the script and how it is said are two fields
     that must leave the same blanks, and the whole point of the bar is
     that keeping them in step is a tap. */
  blanks?: BlankWiring;
  /** What the cross on a blank means here — see BlankText. */
  onRemoveBlank?: (name: string) => void;
}) {
  /* What a box is called: the field, which of the accepted answers it is
     where there is more than one, and which form of the card. */
  const named = (base: string, i: number) =>
    [base, rows.length > 1 ? ` of accepted answer ${i + 1}` : "", of ? ` for ${of}` : ""].join("");
  const [open, setOpen] = useState<number | null>(null);
  const commit = onCommit;
  const edit = onEdit;
  const grammarOf = (row: Answer) =>
    dims.map((d) => labelFor({ [d.field]: row[d.field] }, lang)).filter(Boolean).join(" ");
  return (
    <div className="at-alts">
      {rows.map((row, i) => (
        <div className="at-answerpair" key={i}>
          <div className="at-altfield">
            {blanks ? (
              <BlankField
                wiring={blanks}
                value={row.text}
                onChange={(v) => edit(i, { text: v })}
                label={lang.scriptLabel}
                lang={lang}
                script
              >
                {(box) => (
                  <ScriptInput
                    lang={lang}
                    value={row.text}
                    onChange={(v) => edit(i, { text: v })}
                    box={box}
                    onRemoveBlank={onRemoveBlank}
                  />
                )}
              </BlankField>
            ) : (
              <ScriptInput
                lang={lang}
                value={row.text}
                label={of ? named(lang.scriptLabel, i) : undefined}
                /* The language's own name for itself, which is the only
                   thing on this line saying which script is wanted now
                   that the heading above says "Arabic" and not "Arabic
                   script and transliteration". */
                placeholder={lang.scriptNative}
                onChange={(v) => edit(i, { text: v })}
              />
            )}
          </div>
          {/* The buttons take a column of their own so that the answer and
              its pronunciation, stacked in the column beside them, line up
              with each other rather than one running past the other. */}
          <div className="at-answeracts">
            {rows.length > 1 && (
              <IconButton
                icon="remove"
                label="Remove this answer"
                onClick={() => commit(rows.filter((_, j) => j !== i))}
              />
            )}
            {i === rows.length - 1 && (
              <IconButton
                icon="add"
                label="Add another accepted answer"
                onClick={() => commit(rows.concat([{ text: "", lat: "" }]))}
              />
            )}
          </div>
          {blanks ? (
            <div className="at-answersaid">
              <BlankField
                wiring={blanks}
                value={row.lat}
                onChange={(v) => edit(i, { lat: v })}
                label={lang.translitLabel}
                lang={lang}
              >
                {(box) => (
                  <BlankText
                    box={box}
                    className="at-input"
                    value={row.lat}
                    label={named(lang.translitLabel, i)}
                    placeholder={lang.translitLabel.toLowerCase()}
                    onChange={(v) => edit(i, { lat: v })}
                    onRemove={onRemoveBlank}
                  />
                )}
              </BlankField>
            </div>
          ) : (
            <input
              className="at-input at-answersaid"
              value={row.lat}
              aria-label={named(lang.translitLabel, i)}
              placeholder={lang.translitLabel.toLowerCase()}
              onChange={(e) => edit(i, { lat: e.target.value })}
            />
          )}
          {/* What is true of this answer rather than of the card: what
              grammar it carries, and how it sounds. Both are answers about
              one of the words above and not about the pair of them, and
              both are written small and under it for that reason.

              The recordings were a field of their own further down, level
              with the English — which said a recording was a third thing
              the card had, beside the word and its meaning. It is not: it
              is one of the accepted answers, said out loud, and a card
              that accepts two had one set of clips over the pair. */}
          <div className="at-answerabout">
            {dims.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={
                  rows.length > 1 ? `Grammar of accepted answer ${i + 1}` : "Grammar of this answer"
                }
                onClick={() => setOpen((v) => (v === i ? null : i))}
              >
                {grammarOf(row) || "Grammar"}
                <Icon name={open === i ? "chevronUp" : "chevronDown"} />
              </Button>
            )}
            {ownRecorders && (
              <Button
                variant="ghost"
                size="sm"
                icon="mic"
                iconSize={17}
                /* A shade larger than the grammar button beside it, which
                   is a word and a chevron; this is the one thing on the
                   line a teacher taps to leave the screen, and it was
                   reading as the smaller of the two. Both keep the same
                   box, because the row stretches them together. */
                className="at-answerrec"
                /* Nothing to record until there is a word to say. The same
                   rule a cell of a table follows — see CellFields. */
                disabled={!String(row.text || "").trim()}
                aria-label={soundLabel(clipsOf(row).length, named("Recordings", i))}
                onClick={() => onRecord(i)}
              >
                {soundOf(clipsOf(row).length)}
              </Button>
            )}
          </div>
          {dims.length > 0 && open === i && (
            <div className="at-answergrammar">
              <GrammarRadios
                dims={dims}
                values={row}
                of={`of accepted answer ${i + 1}`}
                onPick={(field, v) => edit(i, { [field]: v })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* What the button beside an answer reads, and what a screen reader is told
   it is. Written once because the two must agree: the count is the whole
   of what the button says, so a label saying something else would be the
   only description of a button whose text is "2 recordings". */
const soundOf = (made: number): string =>
  /* `plural` counts as well as pluralising — "1 recording", "2 recordings"
     — so the number is not written again in front of it. */
  made ? plural(made, "recording") : "Record";
const soundLabel = (made: number, of: string): string =>
  made ? `${of} — ${made} made` : `${of} — none yet`;

/* ------------------------------------------------------------------
   The field a blank stands in

   A blank is stored as `{{name}}` inside the words of a card — see
   variables.ts, which is where that string is read, moved and filled.
   That is how a card is *stored*, and until 0.179 it was also how one
   was read: the field showed the braces, and the bar under it showed
   the same blanks again as chips. Two pictures of one thing, and only
   the lower one could be acted on — the blank in the sentence was six
   characters of Latin punctuation a teacher had to drag through their
   own words, or delete a brace at a time.

   The blank is a pill in the sentence now, where it stands. Drag it to
   move it, and the cross on its end takes it off. What is left on the
   bar below is what the field cannot say: the blanks this card knows
   that this field has not got, and the button for one nobody has
   written yet.

   A box that draws pills is not an `<input>` — an input holds
   characters and nothing else — so these fields are contenteditable,
   with the app drawing what is in them. The rule that keeps that
   honest is that **nothing is repainted while anybody types**: what is
   read back off the box is compared with what was last painted into
   it, and on a keystroke they agree, so the caret is never moved out
   from under the person typing. A repaint happens only where the app
   itself changed the words.
   ------------------------------------------------------------------ */

/*
 * A width-less space, kept behind every pill.
 *
 * A box you type in cannot put the caret after something it may not edit
 * unless there is somewhere for the caret to be, and a blank put in at the
 * end of a sentence is the commonest one there is. This is that somewhere:
 * it is invisible, it is not a space, and readOut takes it back out, so
 * nothing outside this box ever sees one.
 */
const PARK = "\u200B";

/** What a box holds, with its pills read back as the braces they stand for. */
function readOut(from: HTMLElement | DocumentFragment | null): string {
  if (!from) return "";
  let out = "";
  const walk = (node: ChildNode) => {
    if (node.nodeType === 3) {
      out += String(node.nodeValue || "");
      return;
    }
    const el = node as HTMLElement;
    const slot = el.getAttribute ? el.getAttribute("data-slot") : null;
    if (slot) {
      out += `{{${slot}}}`;
      return;
    }
    /* A browser leaves a <br> in a box that has just been emptied, and a
       pasted line can arrive wrapped in anything at all. Neither is a
       thing a card's field holds: it is one line. */
    if (el.tagName === "BR") return;
    Array.from(el.childNodes).forEach(walk);
  };
  Array.from(from.childNodes).forEach(walk);
  /* A no-break space is what a browser leaves where a space was typed at
     the end of a line. Saved as one it is a character a student's answer
     would have to contain, so it never leaves this box. */
  return out.split(PARK).join("").replace(/\u00A0/g, " ");
}

/** One blank, as it stands in the sentence: its name, and its cross. */
function pillNode(name: string): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "at-blankpill";
  pill.setAttribute("data-slot", name);
  pill.setAttribute("contenteditable", "false");
  pill.setAttribute("aria-label", `The ${name} blank. Drag to move it.`);
  const word = document.createElement("span");
  word.className = "at-blankpillname";
  word.textContent = name;
  pill.appendChild(word);
  const off = document.createElement("button");
  off.type = "button";
  off.className = "at-blankpilloff";
  off.setAttribute("data-off", name);
  /* Out of the tab order on purpose: inside a box you type in, the way to
     take the thing beside the caret off is the key that has always done
     it, and onKeyDown below makes backspace mean exactly this. */
  off.setAttribute("tabindex", "-1");
  off.setAttribute("aria-label", `Take the ${name} blank out`);
  const cross = iconNode("close", 14);
  if (cross) off.appendChild(cross);
  pill.appendChild(off);
  return pill;
}

/** The box, drawn from the string it holds. */
function paint(host: HTMLElement, value: string) {
  host.textContent = "";
  splitSlots(value).forEach((run, i) => {
    if (!run.slot) {
      host.appendChild(document.createTextNode(run.text));
      return;
    }
    if (i === 0) host.appendChild(document.createTextNode(PARK));
    host.appendChild(pillNode(run.slot));
    host.appendChild(document.createTextNode(PARK));
  });
}

/*
 * Where in the string a place in the box is.
 *
 * Every edit here is worked out on the string and handed to the same
 * functions every other writer of a blank goes through — a blank is the
 * characters of `{{name}}` wherever it is drawn as a pill — so a point in
 * the box has to be able to say where it stands in those terms. Read by
 * cutting the box off there and asking what is written in the piece, which
 * is the question readOut already answers, so one place knows how a pill
 * counts.
 */
function offsetAt(host: HTMLElement, node: ChildNode | null, at: number): number {
  if (!node || !host.contains(node)) return readOut(host).length;
  const range = document.createRange();
  range.selectNodeContents(host);
  try {
    range.setEnd(node, at);
  } catch {
    return readOut(host).length;
  }
  return readOut(range.cloneContents()).length;
}

/** Where the caret stands, in the same terms. */
function caretOffset(host: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return readOut(host).length;
  const range = sel.getRangeAt(0);
  return offsetAt(host, range.startContainer as ChildNode, range.startOffset);
}

/** And back: the caret put where a place in the string says. */
function placeCaret(host: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(host);
  range.collapse(false);
  /* A box rather than a variable: it is written inside the walk, and a
     narrowing that held before the walk ran would not hold after it. */
  const found: { node: ChildNode | null; at: number } = { node: null, at: 0 };
  let at = 0;
  const walk = (parent: HTMLElement) => {
    for (const node of Array.from(parent.childNodes)) {
      if (at > offset) return;
      if (node.nodeType === 3) {
        const raw = String(node.nodeValue || "");
        /* Every place in this run that answers to the offset, the last
           winning — so the caret lands behind a parking space rather than
           in front of it, which is to say after the pill and not on it. */
        for (let i = 0; i <= raw.length; i++) {
          if (at + raw.slice(0, i).split(PARK).join("").length === offset) {
            found.node = node;
            found.at = i;
          }
        }
        at += raw.split(PARK).join("").length;
        continue;
      }
      const el = node as HTMLElement;
      const slot = el.getAttribute ? el.getAttribute("data-slot") : null;
      if (slot) {
        at += slot.length + 4;
        continue;
      }
      walk(el);
    }
  };
  walk(host);
  if (found.node) {
    range.setStart(found.node, found.at);
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * The place in the words under a point on the screen.
 *
 * Which is a question the browser answers about text it has itself laid
 * out — in any script, running either way — where the bar under the field
 * has to ask it of elements instead, having no way into an input's own
 * text. See dropRail, which is that other answer.
 *
 * Two names for the one thing and no browser has both. Neither exists in
 * the harness's DOM, where nothing is dragged, so "nowhere" is the answer
 * rather than a crash.
 */
function caretAt(x: number, y: number): Range | null {
  const doc = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: ChildNode; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  if (doc.caretPositionFromPoint) {
    const spot = doc.caretPositionFromPoint(x, y);
    if (!spot) return null;
    const range = document.createRange();
    try {
      range.setStart(spot.offsetNode, spot.offset);
    } catch {
      return null;
    }
    range.collapse(true);
    return range;
  }
  return null;
}

/** What the bar below needs of the box above it. */
interface BlankBox {
  /** Where the caret last stood, for a blank put in by a tap. */
  caret: () => number;
  focus: () => void;
}

/**
 * A card's field, with the blanks in it drawn where they stand.
 *
 * Stands where an `<input>` stood and is one everywhere it matters: the
 * same class, the same label, one line, and what it hands up is the string
 * the card is saved with.
 */
function BlankText({ value, onChange, onRemove, className = "", style, dir, lang, label, placeholder, box }: {
  value?: string;
  onChange: (value: string) => void;
  /**
   * What the cross on a pill means, where the card has a say in it.
   *
   * A blank belongs to the card rather than to one of its fields — every
   * field with words in it leaves the same blanks, which is what the save
   * has always enforced — so the cross hands the name up and the card
   * takes it out of all three. Left out, the field takes it out of
   * itself, which is all a field on its own can mean by it.
   */
  onRemove?: (name: string) => void;
  className?: string;
  style?: React.CSSProperties;
  dir?: string;
  lang?: string;
  label?: string;
  placeholder?: string;
  box?: React.MutableRefObject<BlankBox | null>;
}) {
  const mine: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  /* What was last drawn into the box, so a change from outside can be told
     from what somebody has just typed. */
  const painted = useRef<string | null>(null);
  /* Where the caret was when this box last had it. A box keeps its
     selection when it loses focus and a chip on the bar takes the focus
     away, so the bar reads this rather than the live selection. */
  const stood = useRef<number | null>(null);
  /* The blank being dragged, and the sentence as it would read if it were
     let go here — which is what is painted while the finger moves, so what
     is on the screen is what will be saved. */
  const carrying = useRef<{ name: string; x: number; y: number; moved: boolean } | null>(null);
  const preview = useRef<string | null>(null);
  const [moving, setMoving] = useState(false);
  const text = value || "";
  /* The string as the box draws it: a hole written `{{ Name }}` is one
     pill named `name`, and every offset below is counted against what is
     on the screen rather than against what was stored. */
  const shown = splitSlots(text).map((run) => (run.slot ? `{{${run.slot}}}` : run.text)).join("");

  useEffect(() => {
    const host = mine.current;
    if (!host || painted.current === text) return;
    const focused = document.activeElement === host;
    const at = focused ? caretOffset(host) : 0;
    painted.current = text;
    paint(host, text);
    if (focused) placeCaret(host, Math.min(at, shown.length));
  });

  /* The handle the bar below holds. Renewed on every render rather than
     made once, because what it answers about is the words as they stand
     now. */
  useEffect(() => {
    if (!box) return;
    box.current = {
      caret: () => {
        const host = mine.current;
        const live = host && document.activeElement === host ? caretOffset(host) : stood.current;
        return Math.max(0, Math.min(shown.length, typeof live === "number" ? live : shown.length));
      },
      focus: () => {
        if (mine.current) mine.current.focus();
      },
    };
  });

  const remember = () => {
    const host = mine.current;
    if (host && document.activeElement === host) stood.current = caretOffset(host);
  };

  const commit = (next: string) => {
    painted.current = next;
    if (next !== text) onChange(next);
  };

  /* Drawn again and handed up, for the edits the app makes itself: a blank
     moved or taken out, a paste flattened to one line. */
  const rewrite = (next: string, caret: number) => {
    const host = mine.current;
    if (host) {
      paint(host, next);
      if (document.activeElement === host) placeCaret(host, caret);
    }
    commit(next);
  };

  const takeOut = (name: string) => {
    const next = withoutSlot(shown, name);
    const host = mine.current;
    if (host) paint(host, next);
    painted.current = next;
    /* The card's answer where it has one: the same blank comes out of the
       other fields too, and this field's own new words arrive back down
       the way every other outside change does. */
    if (onRemove) onRemove(name);
    else if (next !== text) onChange(next);
  };

  const onInput = () => {
    const host = mine.current;
    if (!host) return;
    const next = readOut(host);
    const pills = host.querySelectorAll("[data-slot]").length;
    const holes = splitSlots(next).filter((run) => run.slot).length;
    /* Braces somebody typed out by hand become the blank they name — this
       screen stopped asking anybody to type them, but a teacher who knows
       them should not be made wrong — and the <br> a browser leaves in an
       emptied box goes, which is what lets the placeholder come back. */
    if (holes !== pills || (!next && host.childNodes.length > 0)) {
      const at = caretOffset(host);
      paint(host, next);
      placeCaret(host, at);
    }
    remember();
    commit(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    /* One line: a card's field is one line wherever else it is shown. */
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const host = mine.current;
    const sel = window.getSelection();
    if (!host || !sel || !sel.isCollapsed) return;
    const at = caretOffset(host);
    let pos = 0;
    for (const run of splitSlots(shown)) {
      const len = run.slot ? run.slot.length + 4 : run.text.length;
      /* Backspace with a pill in front of the caret, or delete with one
         behind it, means the blank — not the two braces nearest the
         caret, which is the only other thing it could mean and is not a
         thing anybody wants. */
      if (run.slot && at === (e.key === "Backspace" ? pos + len : pos)) {
        e.preventDefault();
        takeOut(run.slot);
        return;
      }
      pos += len;
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const host = mine.current;
    if (!host) return;
    e.preventDefault();
    const flat = String((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\s+/g, " ");
    const at = caretOffset(host);
    rewrite(shown.slice(0, at) + flat + shown.slice(at), at + flat.length);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest || e.button !== 0) return;
    /* The cross acts on the tap, like every other button; what the press
       must not do is drop the caret into the middle of a pill. */
    if (target.closest("[data-off]")) {
      e.preventDefault();
      return;
    }
    const pill = target.closest("[data-slot]") as HTMLElement | null;
    if (!pill) return;
    e.preventDefault();
    carrying.current = { name: pill.getAttribute("data-slot") || "", x: e.clientX, y: e.clientY, moved: false };
    preview.current = shown;
    setMoving(true);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const off = target.closest ? target.closest("[data-off]") : null;
    if (!off) {
      remember();
      return;
    }
    e.preventDefault();
    takeOut(off.getAttribute("data-off") || "");
  };

  /*
   * Carrying a blank along the sentence.
   *
   * The sentence is redrawn as it would read with the blank where the
   * finger is, rather than a line being shown where it would land: what it
   * will say is the thing being decided, so it says it. Nothing is handed
   * up until the finger comes off, and letting go outside the words — or
   * pressing escape — leaves the card as it was.
   *
   * Pointer events rather than the desktop's drag and drop: a teacher
   * writing cards is as likely to be holding a phone, and a thumb raises
   * no dragstart at all.
   */
  useEffect(() => {
    const host = mine.current;
    if (!moving || !host) return;
    const move = (e: PointerEvent) => {
      const carried = carrying.current;
      if (!carried) return;
      if (!carried.moved &&
          Math.abs(e.clientX - carried.x) < DRAG_SLOP &&
          Math.abs(e.clientY - carried.y) < DRAG_SLOP) return;
      carried.moved = true;
      const place = caretAt(e.clientX, e.clientY);
      if (!place || !host.contains(place.startContainer)) return;
      const at = offsetAt(host, place.startContainer as ChildNode, place.startOffset);
      const next = movedSlot(shown, carried.name, at);
      if (next !== preview.current) {
        preview.current = next;
        paint(host, next);
      }
      const pill = host.querySelector(`[data-slot="${carried.name}"]`);
      if (pill) pill.classList.add("lifting");
    };
    const end = (keep: boolean) => {
      const carried = carrying.current;
      const next = keep && carried && carried.moved ? String(preview.current || shown) : shown;
      carrying.current = null;
      preview.current = null;
      setMoving(false);
      rewrite(next, next.length);
    };
    const drop = () => end(true);
    const stop = () => end(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", key);
    };
  });

  return (
    <div
      ref={mine}
      className={`at-blanktext${className ? " " + className : ""}${moving ? " moving" : ""}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="false"
      aria-label={label}
      data-placeholder={placeholder || ""}
      spellCheck={false}
      dir={dir}
      lang={lang}
      style={style}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onKeyUp={remember}
      onBlur={remember}
      onPaste={onPaste}
      onPointerDown={onPointerDown}
      onClick={onClick}
    />
  );
}

/* Exported for the Numbers screen, which is fifty-five of these boxes in a
   grid and has exactly the same need: a field in the language's script,
   laid out by its direction, with the on-screen keys a click away. A
   second implementation of it there would be a second place for the caret
   handling and the direction rule to drift. */
export function ScriptInput({ lang, value, onChange, compact = false, label, box, onRemoveBlank, placeholder }: {
  lang: Lang;
  value?: string;
  onChange: (value: string) => void;
  /**
   * A handle on the box itself, for a caller that needs one — the blank
   * bar, which reads where the caret was when a chip was tapped. Its
   * presence is also what says this field may hold blanks: a sentence's
   * fields draw them as pills where they stand, and a verb's table and
   * the Numbers screen are grids of words that cannot have one. Handed
   * out rather than made public, so this component goes on owning the
   * keypad's focus handling and a caller cannot take it over by holding
   * the same ref.
   */
  box?: React.MutableRefObject<BlankBox | null>;
  /** What the cross on a blank means here — see BlankText. */
  onRemoveBlank?: (name: string) => void;
  /**
   * What to call this box where the label above it does not say — in a
   * table, where one heading stands over twenty-four boxes and only the row
   * and column say which is which. The two boxes beside it in a cell have
   * carried their own names since the table was written; this one had
   * none, which on the languages whose dictionary form is a cell now
   * leaves the field the whole card is identified by unnamed.
   */
  label?: string;
  /**
   * A shorter box, for where there are many of them. A verb's table is
   * twenty-four of these on one screen, and at the size a single field is
   * written at it scrolls for a thousand pixels. Only the script shrinks —
   * still the largest thing on its line, because it is the thing being
   * read — and only where a caller asks.
   */
  compact?: boolean;
  /**
   * What stands in the box while it is empty.
   *
   * Asked for rather than always the language's own name: a verb's table
   * is twenty-four of these, and the same word greyed out in every one of
   * them is noise. Where one box is the language — the card's own word —
   * it is the only thing on the line that says which script is wanted.
   */
  placeholder?: string;
}) {
  const [keys, setKeys] = useState(false);
  /* Either kind of box: an input, or the one a sentence's blanks are
     drawn in. All this holds it for is putting the focus back after an
     on-screen key, which both answer to. */
  const ref: React.MutableRefObject<HTMLElement | null> = useRef(null);
  /* The two are the same box to look at and to lay out, so what says so is
     written once and handed to whichever is drawn. */
  const look = {
    className: "at-input",
    lang: lang.id,
    placeholder: placeholder || undefined,
    /* The words decide, once there are any: the field is laid out by its
       own first strong character, so a pasted Arabic phrase reads
       right-to-left even if the deck is labelled with another language.
       Trusting the deck's direction is what put pasted words in the
       wrong order. What the browser's own `dir="auto"` would read and
       `wordsDir` does not is the blanks — their names are Latin, so a
       sentence starting with one, or a field still holding nothing else,
       came out running the wrong way. While there is nothing written
       there is nothing to go on, and the language's own direction places
       the pills and the caret. */
    dir: wordsDir(value, lang.direction),
    /* The room for the keys button is reserved by .at-inputwrap in the
       stylesheet — physical right, not logical, because the button is
       at right:8px whichever way the text runs. */
    style: {
      fontFamily: lang.fontStack,
      fontSize: compact ? 18 : 22,
      textAlign: "start" as const,
      ...scriptVars(lang),
    },
  };

  /* An on-screen key writes on the end of the field, which is where the
     caret is in the case it exists for — a box just typed into. A field
     that ends with a blank is the one place that would read wrong: the
     letter would land against the pill and fuse with it, so it is given
     the space a blank is spaced with everywhere else. */
  const append = (key: string) => {
    const had = String(value || "");
    onChange(/\}\}$/.test(had) ? `${had} ${key}` : `${had}${key}`);
    if (box && box.current) box.current.focus();
    else if (ref.current) ref.current.focus();
  };

  return (
    <>
      {/* The button belongs at the end of the line, which the deck's
          language decides — not the field's own dir, which is "auto" and
          would send the button across the field as soon as an English word
          was typed into an Arabic deck. */}
      <div className={`at-inputwrap${lang.direction === "rtl" ? " rtl" : ""}`}>
        {box ? (
          <BlankText
            {...look}
            box={box}
            label={label}
            value={value}
            onChange={onChange}
            onRemove={onRemoveBlank}
          />
        ) : (
          <input
            {...look}
            ref={(el) => {
              ref.current = el;
            }}
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <KeysButton on={keys} onClick={() => setKeys((v) => !v)} />
      </div>
      {keys && (
        <div className="at-keypad" dir={lang.direction}>
          {lang.keys.rows
            .flat()
            .concat(lang.keys.extras)
            .map((k, i) => (
              <button
                key={i}
                className="at-key"
                style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}
                onClick={() => append(k)}
              >
                {k}
              </button>
            ))}
          {lang.keys.marks.map((m, i) => (
            <button
              key={"m" + i}
              className="at-key mark"
              onClick={() => append(m)}
            >
              {"\u25CC" + m}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

async function hashOf(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read-failed"));
    r.readAsDataURL(blob);
  });
}

/* Clips are addressed by the hash of their contents, so the same
   recording published twice is stored once. */

/*
 * The recordings on one form, as the card editor shows them.
 *
 * Listening stays here, where the rest of the form is: the quickest way to
 * check that a card's audio is the right audio is to press play beside the
 * word it belongs to. Making one does not — recording and uploading are a
 * job with its own controls, its own permissions prompt and its own way of
 * going wrong, and they used to sit in the middle of a form as four
 * buttons, which is how a card editor becomes a console.
 */
function Recordings({ form, onOpen }: {
  form: { clips?: string[], slowClips?: string[] };
  onOpen: () => void;
}) {
  const made = clipsOf(form);
  return (
    <Field label="Recordings">
      {/* What the field is for, under the name of it and above the button
          that does it — rather than under the button, where it read as a
          note about what had just been pressed. The speeds are not named
          here: choosing between them is done on the screen the button
          opens, and that screen says so. */}
      {!made.length && (
        <Help>
          A recording lets this form be practiced by ear as well as by sight.
        </Help>
      )}
      <ClipList clips={made} />
      <div className="at-chips" style={{ marginTop: made.length ? 10 : 0 }}>
        <Button size="sm" onClick={onOpen} icon="mic">
          {made.length ? "Record or upload" : "Add a recording"}
        </Button>
      </div>
    </Field>
  );
}

/*
 * Making them: a screen of its own, one section per speed.
 *
 * One recorder rather than two, pointed at whichever section asked for it —
 * two would mean two live microphones the moment somebody pressed the
 * second button while the first was still running.
 *
 * Exported because the number system's editor records the same way: a
 * word is a word, and a second recorder written for a second screen would
 * be two microphones, two quota checks and two ideas of what a recording
 * is. What it is handed is a thing with `clips` on it, which a card's
 * form and a system's lexeme both are.
 */
export function RecordingScreen({ title, form, onChange, onClose }: {
  title: string;
  form: { clips?: string[], slowClips?: string[] };
  onChange: (next: { clips: string[], slowClips: string[] }) => void;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState<"clips" | "slowClips" | "">("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const rec: React.MutableRefObject<MediaRecorder | null> = useRef(null);
  const tick: React.MutableRefObject<ReturnType<typeof setInterval> | null> = useRef(null);

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
  }, []);

  const listOf = (key: "clips" | "slowClips"): string[] => form[key] || [];
  const put = (key: "clips" | "slowClips", next: string[]) =>
    onChange({
      clips: key === "clips" ? next : form.clips || [],
      slowClips: key === "slowClips" ? next : form.slowClips || [],
    });

  async function store(blob: Blob, key: "clips" | "slowClips") {
    setBusy("Saving…");
    try {
      const hash = await hashOf(blob);
      await API.putClip(hash, await blobToDataUrl(blob));
      put(key, listOf(key).concat([hash]));
    } catch (e) {
      setError(API.explain(e));
    } finally {
      setBusy("");
    }
  }

  async function begin(key: "clips" | "slowClips") {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("This browser won't let the app use the microphone");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        store(new Blob(chunks, { type: mr.mimeType || "audio/webm" }), key);
      };
      rec.current = mr;
      setElapsed(0);
      setRecording(key);
      const from = Date.now();
      tick.current = setInterval(() => setElapsed(Date.now() - from), 100);
      mr.start();
      /* A slow reading is a longer one, so the cap allows for it: the old
         fifteen seconds was set when there was one speed to record. */
      setTimeout(() => mr.state !== "inactive" && end(), 25000);
    } catch (e) {
      setError(
        String(e && (e as any).name) === "NotAllowedError"
          ? "Microphone permission was refused"
          : "Couldn't reach the microphone"
      );
    }
  }

  function end() {
    if (tick.current) clearInterval(tick.current);
    setRecording("");
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }

  return (
    <Screen title={title} onBack={onClose} rise backLabel="Back to the card">
      <Help>
        You can make one at regular speed, a slow one, or both — or neither:
        a card with no recording is still a card, it just cannot be
        practiced by ear.
      </Help>
      <Notice kind="error">{error}</Notice>

      {CLIP_KINDS.map((kind) => {
        const list = listOf(kind.key);
        const mine = recording === kind.key;
        return (
          <section className="at-panel" key={kind.key}>
            <p className="at-eyebrow">{kind.title}</p>
            <Help>{kind.what}</Help>

            {/* Numbered takes rather than named speeds: which speed these
                are is the heading directly above them. */}
            <ClipList
              clips={list.map((id, i) => ({ id, label: `Take ${i + 1}` }))}
              onChange={(next) =>
                put(kind.key, next.map((c) => (typeof c === "string" ? c : c.id)))
              }
            />

            <div className="at-chips" style={{ marginTop: list.length ? 10 : 0 }}>
              {mine ? (
                <Button variant="danger" size="sm" onClick={end} icon="pause">
                  Stop — {(elapsed / 1000).toFixed(1)}s
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => begin(kind.key)}
                  disabled={!!busy || !!recording}
                  icon="mic"
                >
                  {busy || `Record ${kind.short.toLowerCase()}`}
                </Button>
              )}
              {/* An upload beside every Record, because a teacher who has
                  the file already should never have to play it into a
                  microphone to get it onto the card. */}
              <label className="at-btn sm ghost">
                <Icon name="download" />
                Upload a file
                <input
                  type="file"
                  accept="audio/*"
                  className="at-hidden"
                  disabled={!!recording}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) store(f, kind.key);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
        );
      })}
    </Screen>
  );
}

/*
 * Which words a phrase teaches.
 *
 * Shown only on a card that is a phrase or a sentence, because a single
 * word does not contain anything. The app proposes — every word card whose
 * text it can find inside this one — and the teacher accepts. It is
 * deliberately not automatic: finding a word inside another is done by
 * peeling prefixes, and in Arabic that occasionally lands on a different
 * real word. A wrong pairing would reach a learner as a question with no
 * right answer.
 *
 * A pairing already accepted stays whichever way the matcher later votes,
 * so improving the matcher can never silently drop a teacher's decision.
 */
function WordsUsed({ lang, text, cards, selfId, chosen, onChange }: {
  lang: Lang;
  text: string;
  cards: Card[];
  selfId?: string;
  chosen: string[];
  onChange: (ids: string[]) => void;
}) {
  const kind = guessKind(text, lang);
  const suggestions = useMemo(() => {
    if (!supportsContext(lang) || kind === "word" || !text.trim()) return [];
    return (cards || [])
      .filter((c) => c.id && c.id !== selfId && leadOf(c).ar)
      .filter((c) => guessKind(leadOf(c).ar, lang) === "word")
      .filter((c) => findWordSlot(text, leadOf(c).ar, lang) >= 0)
      .slice(0, 24);
  }, [cards, lang, text, selfId, kind]);

  /* Anything ticked that the matcher no longer proposes — the phrase was
     edited, or it was ticked when the wording was different. It has to stay
     listed or there would be no way to untick it. */
  const kept = (chosen || []).filter((id) => !suggestions.some((c) => c.id === id));
  const keptCards = (cards || []).filter((c) => kept.includes(c.id));

  if (!supportsContext(lang) || kind === "word") return null;
  if (!suggestions.length && !keptCards.length) {
    return (
      <div className="at-formblock at-mt5">
        <p className="at-eyebrow">Words this teaches</p>
        <Help>
          None of your single-word cards appear in this one. Add the word on its own card and it
          will be offered here.
        </Help>
      </div>
    );
  }

  const options = suggestions.concat(keptCards).map((c) => ({
    id: String(c.id),
    title: leadOf(c).ar,
    note: leadOf(c).en || "",
  }));

  return (
    <div className="at-formblock at-mt5">
      <p className="at-eyebrow">Words this teaches</p>
      <Help>
        Tick the words this phrase is a good example of. Each one gets practiced inside this phrase
        as well as on its own — which is how a word is met in more than one place without anything
        being invented.
      </Help>
      <CheckList
        options={options}
        chosen={chosen || []}
        onToggle={(id, on) => onChange(on ? chosen.filter((x) => x !== id) : chosen.concat([id]))}
      />
    </div>
  );
}

/**
 * @param props  `scene` is which kind of card this opens as — turns instead of
 *   forms — and for a new card it is only the starting answer: the kind is
 *   a choice made here, in the one editor, rather than by having arrived
 *   through a different button. `draft` is a first line already written,
 *   for a card begun from a suggestion.
 */
/* A field of a card, in the words the editor labels it with. The script's
   name is the language's own and is a name; the other two are what they are
   called on the screen above. */
const fieldName = (field: string, lang: Lang): string =>
  field === "ar"
    ? (lang && lang.scriptLabel) || "The script"
    : field === "en"
    ? "English"
    : (lang && lang.translitLabel) || "The transliteration";

/*
 * A verb's forms, laid out the way the language lays them out.
 *
 * The table is the card's sub-forms seen through its two axes: a cell is a
 * sub-form carrying the row and column it sits in, and nothing more. So
 * this writes the same list the form blocks above write, and everything
 * downstream — the schedule, the recordings, the sync, the export — goes
 * on working without having been told what a verb is.
 *
 * Laid out down the page rather than across it. A grid of eight columns is
 * the way a grammar book prints one, and it is unusable on the phone this
 * app is mostly opened on; one line per cell, gathered under its tense,
 * says the same thing and can be typed with a thumb. The tenses are in the
 * order the language teaches them, which is the order they open in, and
 * the heading says so — a teacher filling in the past should know the
 * learner will not see it until the present is known.
 *
 * Each cell's English is typed. There was a row-level box that wrote all
 * of them from one word — "ate" giving "I ate", "she ate" — and it is gone
 * for the reason set out in verbs.ts: what it produced was wrong in the
 * present, where English inflects and the app must not know that it does.
 * Nineteen boxes is more typing than three and it is typing that produces
 * something true.
 */
/* What to call one cell out loud — "past · she". Read off the language's
   own labels, so a pack that names no persons says only its tense. */
function cellLabel(spec: VerbSpec | null, at: { row: string, col: string }) {
  const tense = tensesOf(spec).find((t) => t.id === at.row);
  const person = personsOf(spec).find((p) => p.id === at.col);
  return [tense ? tense.label : at.row, person ? person.label : ""].filter(Boolean).join(" · ");
}

/**
 * One cell written, added or dropped.
 *
 * A cell with nothing in any of its fields is not a blank the teacher is
 * coming back to — it is a form the language has not got — so it leaves
 * the list rather than being saved empty.
 *
 * In place, so a cell keeps where it sits in the list. Every keystroke
 * used to drop the cell and push it back on the end, which on a student's
 * device — where a form carrying no name of its own is known by its
 * position — handed the cells below it the schedules of their neighbours.
 * They carry names now, and the order is still worth keeping: it is what
 * carries a table written before they had one across its first save.
 *
 * Written here rather than inside the grid because the same cells are
 * also drawn as blocks, in the format the card's own word is written in —
 * two ways of showing one table, and one way of changing it.
 */
/**
 * One cell's boxes, and the one button that records it.
 *
 * The minimal way this app shows a form: the script, how it is said and
 * what it means on one line, and a microphone that lights when there is
 * something recorded. A list and an explanation under every one of a
 * verb's twenty-four cells would be the table's whole height again, so a
 * cell gets none — it says how many recordings there are and opens the
 * same screen the forms below open.
 *
 * Written once because two things show a cell: the grid a verb's table is
 * drawn as, and the short labelled list a card's other forms are drawn as
 * where there are only a few of them. Same boxes either way; what differs
 * is what stands over them.
 */
function CellFields({ lang, cell, which, saysHow, onChange, onRecord }: {
  lang: Lang;
  cell: Record<string, any> | null;
  /** What to call this one where a label has to name it out loud — for a
      screen reader, and on the recording screen's title. */
  which: string;
  /** Whether this language has a pronunciation worth writing per cell. */
  saysHow: boolean;
  onChange: (patch: Record<string, any>) => void;
  onRecord: () => void;
}) {
  const written = !!(cell && String(cell.ar || "").trim());
  const heard = cell ? clipsOf(cell).length : 0;
  return (
    <>
      <div className="at-cellfields">
        <ScriptInput
          compact
          lang={lang}
          label={`${lang.scriptLabel} for ${which}`}
          value={(cell && cell.ar) || ""}
          onChange={(v) => onChange({ ar: v })}
        />
        {saysHow && (
          <input
            className="at-input"
            aria-label={`${lang.translitLabel} for ${which}`}
            value={(cell && cell.lat) || ""}
            placeholder={lang.translitLabel.toLowerCase()}
            onChange={(e) => onChange({ lat: e.target.value })}
          />
        )}
        <input
          className="at-input"
          aria-label={`English for ${which}`}
          value={(cell && cell.en) || ""}
          placeholder="English"
          onChange={(e) => onChange({ en: e.target.value })}
        />
      </div>
      <IconButton
        icon="mic"
        label={heard ? `${plural(heard, "recording")} · ${which}` : `Record ${which}`}
        className={`at-cellmic${heard ? " on" : ""}`}
        disabled={!written}
        onClick={onRecord}
      />
    </>
  );
}

export function writeCell(
  { cells, of, mint }: {
    cells: Record<string, any>[];
    /** Whose table: "" for the card's own, a form's name for that form's. */
    of: string;
    mint: () => string;
  },
  row: string,
  col: string,
  patch: Record<string, any>,
): Record<string, any>[] {
  const ours = (c: Record<string, any>) => String(c.of || "") === of;
  const had = cells.find((c) => c.row === row && c.col === col && ours(c)) || null;
  const next = {
    ...(had || { ...blankForm(), row, col, ...(of ? { of } : null), id: mint() }),
    ...patch,
  };
  if (!["ar", "en", "lat"].some((f) => String(next[f] || "").trim())) {
    return cells.filter((c) => !(c.row === row && c.col === col && ours(c)));
  }
  return had ? cells.map((c) => (c === had ? next : c)) : cells.concat([next]);
}

function VerbTable({ lang, spec, of = "", ofLabel = "", inline = false, cells, mint, onChange, onRecord }: {
  lang: Lang;
  spec: VerbSpec;
  /* Whose table this is: "" for the card's own word, a form's name for
     that form's. A verb passes nothing — a verb's table is the card's, and
     there is one of it. A word that takes pronouns on its end has one per
     form, and two of them have a *me* apiece, so every read and every
     write below is against this one table and not against the list. */
  of?: string;
  /* What that form is called on screen — "Form 2" — for the labels a
     screen reader reads and the recording screen's title. Empty where the
     table is the only one there is. */
  ofLabel?: string;
  /* Whether it sits inside the block of the form it belongs to, rather
     than standing as a block of its own. */
  inline?: boolean;
  cells: Record<string, any>[];
  /* A name for a cell nobody has written yet, free across this whole card.
     Handed in rather than worked out here: a name has to be unlike every
     form's as well as every other cell's, and this component is shown one
     table of one form. */
  mint: () => string;
  onChange: (cells: Record<string, any>[]) => void;
  onRecord: (row: string, col: string) => void;
}) {
  const mine = (c: Record<string, any>) => String(c.of || "") === of;
  const at = (row: string, col: string) =>
    cells.find((c) => c.row === row && c.col === col && mine(c)) || null;

  const write = (row: string, col: string, patch: Record<string, any>) =>
    onChange(writeCell({ cells, of, mint }, row, col, patch));

  const persons = personsOf(spec);
  /* A language whose verbs do not vary by person has one column and no
     word for it, and a line reading "any: đã ăn" would be naming something
     the language does not distinguish. */
  const named = persons.some((p) => p.label);
  /* A box for the pronunciation only where the language asks for one to be
     written. Huế calls it a note and never drills it, so a column of them
     across a whole table would be twenty-four boxes nothing reads — the
     note belongs on the verb itself, which still has its own field below. */
  const saysHow = lang.translitDrilled !== false;

  /* One row of the table, whether it stands on its own or inside the block
     of the form it belongs to. A table hung off a form is a part of that
     form rather than a section beside it, so there it is a subsection of
     that block — the same thing the form's own fields and "Reference —
     never drilled" are in the blocks above. */
  const row = (tense: VerbTense, at_: number) => (
    <>
      {persons.map((person) => {
            const cell = at(tense.id, person.id);
            /* What to call this one when a label has to name it out loud —
               for a screen reader, and on the recording screen's title.
               Whose table it is comes first where there is more than one of
               them on screen: two forms of a word have a *me* apiece, and
               a box labelled only "me" would be two boxes with one name. */
            const which = [ofLabel, tense.label, person.label].filter(Boolean).join(" · ");
            /* Nothing marks the cell a dictionary would list this verb
               under. It used to carry a gold label reading "· the
               dictionary form", which made one row of the table a
               different width and a different colour from the rest and
               asked the teacher to hold a piece of grammar theory in mind
               while typing. The cell is a cell. Where it matters — a verb
               cannot be saved without it — the editor says so at the
               moment it matters, and not before. */
            return (
              <div className="at-cellrow" key={person.id}>
                {named && <span className="at-celllabel">{person.label}</span>}
                <CellFields
                  lang={lang}
                  cell={cell}
                  which={which}
                  saysHow={saysHow}
                  onChange={(patch) => write(tense.id, person.id, patch)}
                  onRecord={() => onRecord(tense.id, person.id)}
                />
              </div>
            );
      })}
    </>
  );

  /* Inside the block of the form it belongs to, under a name the caller
     has already written across the top of the subsection. So the row is
     named here only where there is more than one of them to tell apart —
     a single row would be the subsection's own name said twice. */
  if (inline) {
    const rows = tensesOf(spec);
    return (
      <>
        {rows.map((tense, at_) => (
          <div key={tense.id}>
            {rows.length > 1 && <p className="at-groupline">{tense.label}</p>}
            {row(tense, at_)}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {tensesOf(spec).map((tense, at_) => (
        <div className="at-formblock at-mt5" key={tense.id}>
          <div className="at-formhead">
            <span className="at-formnum">{tense.label}</span>
            {/* Which row opens when, which is only worth saying where there
                is more than one of them: "taught first" over the single row
                of an attached-pronoun table names an order it is not in.
                What that one waits on is the word itself, and the line
                under the table says so. */}
            {tensesOf(spec).length > 1 && (
              <span className="at-formrole">
                {at_ === 0
                  ? "taught first"
                  : `opens once the ${tensesOf(spec)[at_ - 1].label} is known`}
              </span>
            )}
          </div>
          {row(tense, at_)}
        </div>
      ))}
    </>
  );
}

/*
 * Which decks a card is in, as a button and a menu.
 *
 * It was the last block on the editor, a full section with a heading, a
 * paragraph and a tick per deck — so the answer to "where does this card
 * go?" was several hundred pixels below the question, and a teacher with
 * twenty decks scrolled past twenty rows to reach Variables. The decision
 * is one line long and belongs near the top, beside what kind of card this
 * is: both are facts about the card rather than about its words.
 *
 * Built the way the learning space's language switch is, for the same
 * reason it was: a button whose label is the state, opening a list of
 * ticks. What differs is where the menu hangs. The language switch is
 * pinned to the window because it lives in the chrome, which does not
 * scroll; this one is a control inside a form, so it hangs off the button
 * and travels with it.
 */
/*
 * A button that opens a list under itself, and puts it away again.
 *
 * Two controls on this screen are the same shape — which decks a card is
 * in, and which blank it fills or leaves — so the part that is fiddly is
 * written once. "Outside" is read off the click on the way down rather
 * than waited for at the window: a menu that waits can be left open behind
 * something that stopped the click travelling. Choosing inside the menu
 * keeps it open, because these are lists people work down.
 */
function usePicker() {
  const [open, setOpen] = useState(false);
  const mine: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
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
  return { open, setOpen, mine };
}

function DeckSwitch({ decks, chosen, onToggle }: {
  decks: Deck[];
  chosen: string[];
  onToggle: (id: string, wasOn: boolean) => void;
}) {
  const { open, setOpen, mine } = usePicker();

  const all = decks || [];
  const inThese = all.filter((d) => chosen.includes(d.id));

  return (
    <div className="at-chooser deckwrap" ref={mine}>
      {/* The decks this card is in, each as a thing you can see and take
          off, with the way to add another on the end of the row. It was a
          pill saying "2 decks" that had to be opened to find out which
          two — a count is a state, and the thing a teacher wants to read
          here is the names. */}
      <div className="at-deckpills">
        {inThese.map((d) => (
          <span className="at-deckpill" key={d.id}>
            <span className="nm">{d.title}</span>
            <button
              className="at-deckdrop"
              aria-label={`Take this card out of ${d.title}`}
              onClick={() => onToggle(d.id, true)}
            >
              <Icon name="close" size={16} />
            </button>
          </span>
        ))}

        {/* Dotted, because it is the outline of a pill that is not there
            yet: what it makes is what stands beside it. Its words are the
            whole invitation while the card is in nothing, and shorten to
            the bare offer once the row can speak for itself. */}
        {all.length > 0 && (
          <button
            className="at-deckadd"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="add" size={17} />
            {inThese.length ? "Another deck" : "Add this card to a deck"}
          </button>
        )}

        {!all.length && (
          <Help>You have no decks yet. Make one under Decks, then this card can go in it.</Help>
        )}
      </div>

      {open && (
        <div className="at-choosemenu">
          <p className="at-eyebrow">Your decks</p>
          <div className="at-deckpicks">
            {all.map((d) => {
              const on = chosen.includes(d.id);
              return (
                <button
                  className={`at-deckpick${on ? " on" : ""}`}
                  key={d.id}
                  aria-pressed={on}
                  onClick={() => onToggle(d.id, on)}
                >
                  <span className="at-tickbody">
                    <b>{d.title}</b>
                    <i>{plural(d.cardCount || 0, "card")}</i>
                  </span>
                  {/* What tapping it does, rather than a tick saying what
                      is already true: the row is the verb. */}
                  <span className="at-deckmark">{on ? "Added" : "Add"}</span>
                </button>
              );
            })}
          </div>
          <Help>A student sees this card only where it is in a deck their course uses.</Help>
        </div>
      )}
    </div>
  );
}

/*
 * Naming a blank, which is the one thing here nobody can do by choosing.
 *
 * The name of a blank is the one thing on this screen that has to match
 * something written on another card exactly, and it used to be a free-text
 * box on its own: typing `names` where every other card says `name` was
 * accepted, saved, and filled nothing for ever, with nothing on screen to
 * notice — the only silent failure the editor had. So every blank this
 * language already knows about is a row in a list beside this box, and
 * typing one out is what you do once, for the first of its kind.
 *
 * Both halves of the section have one, because both name blanks and
 * neither can offer a name nobody has written yet. What they do with it
 * differs and is the caller's business: one writes it into the card's
 * words, the other says the card fills it.
 *
 * Narrowed as it is typed to the shape a slot may have — see fillNames,
 * which narrows the same way on the way to disk. Doing it here is what
 * stops a teacher typing "Name Is!" and being handed "nameis" by a save
 * they have already forgotten about.
 */
function BlankNameBox({ label, placeholder, taken, onName }: {
  label: string;
  placeholder: string;
  /** Names already on this list, which are chosen rather than typed again. */
  taken: string[];
  onName: (name: string) => void;
}) {
  const [made, setMade] = useState("");
  const name = made.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  const add = () => {
    if (!name || taken.includes(name)) return;
    onName(name);
    setMade("");
  };
  return (
    <div className="at-blanknew">
      <input
        className="at-input"
        value={made}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setMade(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24))}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      <Button variant="ghost" size="sm" disabled={!name || taken.includes(name)} onClick={add}>
        Add
      </Button>
    </div>
  );
}

/* ==================================================================
   Putting a blank into a sentence
   ==================================================================

   Writing "{{name}}" meant typing it — the braces, the spelling, and the
   same name again in each of the three fields, with nothing on screen to
   say whether it matched what the other cards call it. A name half a
   letter out matched nothing for ever and looked exactly like one that
   matched. That was the last silent failure on this screen.

   So a blank is put in rather than typed, and three things do it.

   * **The bar**, under every field a sentence has: a chip per blank the
     card knows, and a button for a blank it does not. A chip that is in
     this field already is marked as such; one that is not is a tap away
     from being in it. That is the whole of "the other fields should offer
     it": a blank belongs to the card, so the moment one field has it the
     rest are one tap from agreeing, which is the rule the save has always
     enforced and never helped anybody keep.
   * **The rail**, which appears under the field while a chip is being
     dragged: the sentence cut into its words, with a target in each gap.
     Where a tap puts a blank at the caret, a drag puts it exactly where
     it goes, and moves one already there. Word-sized targets, for the
     reasons in `dropRail`.
   * **The sheet**, for a blank nobody has written yet: every name that
     means something in this language, each saying what it would take and
     how many words are behind it today, over a box for a name of one's
     own.
   ================================================================== */

/** A blank the sheet can offer, and what choosing it would mean. */
interface BlankOffer {
  name: string;
  /** What would go in the hole, in the teacher's words. */
  note: string;
  /** How many words are behind it today — nothing is a hole that starves. */
  words: number;
  kind: "any" | "category" | "group" | "card";
}

/** What a field needs in order to have blanks put into it. */
interface BlankWiring {
  /** Every blank this card knows, in the order the card writes them. */
  names: string[];
  /** Opens the sheet, which hands back a name to put where it was asked for. */
  onNew: (put: (name: string) => void) => void;
}

/*
 * A field, and the blanks under it.
 *
 * Owns the one thing the bar cannot do without and the input will not give
 * up: a handle on the box itself, for reading where the caret is when a
 * chip is tapped. A render prop rather than a wrapper that draws the input,
 * because the three fields a sentence has are three different boxes — one
 * of them in the language's own script with a keypad hanging off it — and
 * a component that drew all three would be a fourth description of them.
 */
function BlankField({ wiring, value, onChange, label, lang, script = false, children }: {
  wiring: BlankWiring;
  value: string;
  onChange: (v: string) => void;
  label: string;
  lang: Lang;
  /**
   * Whether this field is written in the taught script.
   *
   * The rail under it is the field's own words laid out again, so it is
   * laid out the way the field is or it is a picture of a different
   * sentence: the script's face and the script's direction on the field
   * that is in the script, and the page's own on the two beside it that
   * are Latin. It read every field as the script before this, so the
   * English of an Arabic card was dragged through back to front.
   */
  script?: boolean;
  children: (box: React.MutableRefObject<BlankBox | null>) => Node;
}) {
  const box: React.MutableRefObject<BlankBox | null> = useRef(null);
  return (
    <>
      {children(box)}
      <BlankBar
        wiring={wiring}
        value={value}
        onChange={onChange}
        label={label}
        lang={lang}
        script={script}
        box={box}
      />
    </>
  );
}

/* How far a finger may wander before it is a drag rather than a tap. Below
   this a press is a press: a thumb never holds perfectly still, and a chip
   that refused to be tapped because the hand moved two pixels would read
   as a chip that does not work. */
const DRAG_SLOP = 8;

function BlankBar({ wiring, value, onChange, label, lang, script = false, box }: {
  wiring: BlankWiring;
  value: string;
  onChange: (v: string) => void;
  label: string;
  lang: Lang;
  /** Whether the field above is in the taught script — see BlankField. */
  script?: boolean;
  box: React.MutableRefObject<BlankBox | null>;
}) {
  /* Which blank is being dragged, and which gap the finger is over. Null
     for both when nothing is happening, which is nearly always — the rail
     is not drawn until there is something to drop on it. */
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const from = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const here = slotsIn(value);
  const rail = useMemo(() => dropRail(value), [value]);

  /*
   * Where a tapped blank goes: where the teacher last had the caret.
   *
   * Read off the box at the moment of the tap rather than tracked as it
   * moves, because a box keeps its selection when it loses focus and the
   * tap is what takes the focus away. Where there has never been a caret
   * in it — a field nobody has touched — the end of what is written is the
   * only answer that is not a guess.
   */
  const caret = (): number => {
    const at = box.current;
    return at ? at.caret() : value.length;
  };

  /* One blank put down at one offset: moved where it is already in this
     field, put in where it is not. Both go through the same two functions
     every other writer of a blank goes through. */
  const put = (name: string, at: number) =>
    onChange(here.includes(name) ? movedSlot(value, name, at) : withSlotAt(value, name, at));

  /*
   * Which blanks the bar has a chip for: the ones this field has not got.
   *
   * It used to carry one for every blank the card knows, marked as in or
   * out — which was the right answer while the field itself showed its
   * blanks as braces, and became two pictures of one thing the moment the
   * field started drawing them where they stand. A blank that is in the
   * field is *in the field*: it says its own name, it is dragged by its
   * own pill and taken off by its own cross. What is left here is the
   * half the field cannot say — the blanks the rest of the card leaves
   * and this field does not, each a tap from agreeing.
   */
  const offered = wiring.names.filter((name) => !here.includes(name));

  const tap = (name: string) => put(name, caret());

  /* The gap the finger is over, by asking the page what is under it. The
     targets are real elements laid out by the browser, so this is the same
     answer in a script that runs the other way — see dropRail. */
  const gapAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const target = el && el.closest ? el.closest("[data-blankdrop]") : null;
    if (!target) return null;
    const said = Number(target.getAttribute("data-blankdrop"));
    return Number.isFinite(said) ? said : null;
  };

  /*
   * A press that goes somewhere is a drag; one that goes nowhere is left
   * alone for the click to handle.
   *
   * **The tap is a click and not a pointer-up**, which is the whole reason
   * these are split. A chip is a button, and a button is pressed by a
   * keyboard as well as by a thumb: Enter and the space bar raise a click
   * and no pointer event at all, so a chip that acted on pointer-up would
   * have been a control nobody could reach without a mouse. The drag is
   * the part that genuinely needs the pointer, and it is the only part
   * that reads one.
   *
   * `dropped` is what stops a drag counting twice: a pointer released over
   * the chip it started on raises a click afterwards, which would put the
   * blank back where the caret is having just moved it where it was
   * dropped.
   */
  const dropped = useRef(false);

  const startDrag = (name: string) => (e: React.PointerEvent) => {
    /* The primary button only: a right-click is not a drag, and a
       secondary touch during one is not a second drag. */
    if (e.button !== 0) return;
    from.current = { x: e.clientX, y: e.clientY, moved: false };
    setDragging(name);
    setOver(null);
    /* So the moves keep coming when the finger leaves the chip, which on
       a chip the size of a word is immediately. */
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const start = from.current;
    if (!dragging || !start) return;
    if (!start.moved &&
        Math.abs(e.clientX - start.x) < DRAG_SLOP &&
        Math.abs(e.clientY - start.y) < DRAG_SLOP) return;
    start.moved = true;
    setOver(gapAt(e.clientX, e.clientY));
  };

  const endDrag = (name: string) => (e: React.PointerEvent) => {
    const start = from.current;
    from.current = null;
    setDragging(null);
    setOver(null);
    if (!start || !start.moved) return;
    const at = gapAt(e.clientX, e.clientY);
    dropped.current = true;
    if (at !== null) put(name, at);
  };

  const stopDrag = () => {
    from.current = null;
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="at-blankbar">
      {/* The rail, only while something is being dragged. A row of targets
          under a field nobody is dragging onto is a row of buttons that
          do nothing, and this screen has had enough of those. */}
      {dragging && (
        <div
          className="at-blankrail"
          lang={script ? lang.id : undefined}
          /* The same answer the field above reached, from the same
             function, so the words on the rail stand where the words in
             the field stand — and the gap a finger is over is the gap it
             looks like it is over. */
          dir={script ? wordsDir(value, lang.direction) : undefined}
          style={script ? { fontFamily: lang.fontStack, ...scriptVars(lang) } : undefined}
        >
          {rail.points.map((at, i) => (
            <React.Fragment key={at}>
              <span
                className={`at-blankgap${over === at ? " on" : ""}`}
                data-blankdrop={at}
                aria-hidden="true"
              />
              {rail.pieces[i] && (
                <span className={`at-blankword${rail.pieces[i].slot ? " slot" : ""}`}>
                  {rail.pieces[i].slot ? rail.pieces[i].slot : rail.pieces[i].text}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="at-blankputs">
        {offered.map((name) => (
          <button
            key={name}
            type="button"
            className={`at-blankput${dragging === name ? " lifted" : ""}`}
            /* What the chip is for, said in full: a chip reading only
               "name" says nothing about what tapping it would do, and on
               a bar under a field the field it is under is the point. */
            aria-label={`Put the ${name} blank into ${label}`}
            onPointerDown={startDrag(name)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag(name)}
            onPointerCancel={stopDrag}
            onClick={() => {
              if (dropped.current) {
                dropped.current = false;
                return;
              }
              tap(name);
            }}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          className="at-blankadd"
          aria-label={`Put a blank into ${label}`}
          onClick={() => wiring.onNew((name) => put(name, caret()))}
        >
          <Icon name="add" size={16} />
          Blank
        </button>
      </div>
    </div>
  );
}

/*
 * The sheet a blank is chosen in.
 *
 * Every name that means something in this language, each saying what would
 * stand in the hole and how many words are behind it — because the one
 * thing a teacher cannot see from the name is whether the blank they are
 * about to write has anything to fill it, and a blank with nothing behind
 * it is a card that is never asked.
 *
 * The box at the top is a filter and a name at once, which is the same
 * gesture either way: you type what you are after, and either it is in the
 * list or it is not and typing it is how it comes to exist. A name nobody
 * has written is offered as what it would be — a group tag, waiting for
 * the cards that say they are in it.
 *
 * Over everything, because it is raised from inside a screen that is
 * itself raised — see Overlay.
 */
function BlankSheet({ lang, offers, onPick, onClose }: {
  lang: Lang;
  offers: BlankOffer[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const name = slotName(typed);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const shown = name ? offers.filter((o) => o.name.includes(name)) : offers;
  const exact = offers.some((o) => o.name === name);
  const KINDS: Record<BlankOffer["kind"], string> = {
    any: "Any word",
    category: "Kind of word",
    group: "Group tag",
    card: "One card",
  };
  return (
    <Overlay>
      <div className="at-modalback sheet" onClick={onClose}>
        <div
          className="at-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a blank"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="at-sheettop">
            <h3 className="at-modaltitle">Put in a blank</h3>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
          <p className="at-hint">
            A hole this sentence leaves, and the words that will stand in it.
          </p>

          <input
            className="at-input"
            value={typed}
            autoFocus
            placeholder="Find a blank, or name a new one"
            aria-label="Find a blank, or name a new one"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !name) return;
              onPick(name);
              onClose();
            }}
          />

          {/* A name nobody has written yet, offered as the thing it would
              be. Not where the list already has it: choosing it from the
              list and typing it out are the same answer, and two ways to
              give it on one screen is one too many. */}
          {name && !exact && (
            <button className="at-blankmake" onClick={() => { onPick(name); onClose(); }}>
              <b>{name}</b>
              <span>
                A new group tag. Nothing fills it until a card says it is in
                the group, which is a tick on that card.
              </span>
            </button>
          )}

          <ul className="at-blanklist">
            {shown.map((offer) => (
              <li key={offer.name}>
                <button onClick={() => { onPick(offer.name); onClose(); }}>
                  <b
                    lang={offer.kind === "card" ? lang.id : undefined}
                    dir={offer.kind === "card" ? lang.direction : undefined}
                  >
                    {offer.name}
                  </b>
                  <span className="at-sheetnote">{KINDS[offer.kind]}</span>
                  <span>{offer.note}</span>
                  <em className={offer.words ? "" : "unmet"}>
                    {offer.words
                      ? `${plural(offer.words, "word")} behind it`
                      : "nothing fills it yet"}
                  </em>
                </button>
              </li>
            ))}
          </ul>

          {!shown.length && !name && (
            <Help>
              No blank exists yet in {lang.name}. Type a name above and it
              becomes a group tag, which cards can then say they are in.
            </Help>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/*
 * What a card is, in two questions.
 *
 * The kind — a word or phrase, or a conversation — and then, for a word,
 * whether the language lays some set of its forms out in a table. Those are
 * two questions and not one, which is what 0.120 got wrong by making Verb a
 * third answer to the first: as soon as there was a second table to offer
 * there were four answers, on a track that already ran off a phone at
 * three, and "verb" and "conversation" were never alternatives in the same
 * sense anyway. A conversation is a different shape of card; a verb is a
 * word with more said about it.
 *
 * Underneath there are still no such things. A verb card is a word card
 * whose forms carry cells in the verb's rows, and a word with attached
 * pronouns is one whose forms carry cells in that table's row — which is
 * all hasCells has ever read. Both are derived here rather than stored, so
 * nothing saved knows either word.
 */
export type CardShape = "word" | "sentence" | "scene";

/**
 * Which table a word's forms are laid out in, where any are — by the name
 * the language declares it under, or "" for none.
 *
 * Not a thing a teacher chooses: it follows from what they say the word is
 * — see tableFor. A card still carries no such label; the table is read
 * off the rows its cells sit in, as it always was. A name rather than one
 * of two words, because the two words were the whole reason a third table
 * meant a third branch in fourteen places.
 */
export type CardForms = string;

/**
 * Which of the three a card is.
 *
 * A conversation by its turns, as everything else reads one. A **sentence**
 * by the teacher's own answer, kept on the card — see `isSentence`, which
 * carries the rule and the reading of a card written before there was
 * anything to keep. Anything else is a word.
 *
 * It was read off the braces until 0.176, and that is the thing this no
 * longer does. The editor asked which kind of card this was, offered three
 * answers and stored none of them, so the answer was worked out again from
 * the words every time the card was opened: a sentence typed out before
 * its first blank came back as a word, and a blank typed into a word with
 * a table under it came back as a sentence, hid the table and offered to
 * drop it. Reading a card is not the same as being told, and the kind of
 * card is something a teacher is entitled to say.
 *
 * Asked of a card that exists. A card being made has been answered before
 * this screen opened — see NewCardKind — and the answer is handed in.
 */
export const shapeOf = (card: Card | null | undefined): CardShape =>
  isDialog(card as any) ? "scene" : isSentence(card) ? "sentence" : "word";

/*
 * What a word can be, as the radio asks it.
 *
 * Straight from the language pack — see WORD_CATEGORIES in languages.ts —
 * because parts of speech are a language's answer. A pack that declares
 * none is asked nothing, and its cards go on saying what they are by what
 * they hold.
 *
 * This replaced a question about machinery. The radio used to ask which
 * *table* a word laid its forms out in — "Just this word", "A verb",
 * "Attached pronouns" — which is the app's vocabulary rather than a
 * teacher's, and left what a card *is* to be guessed from what happened to
 * be filled in. That guess is what let a saved pronoun card open as a verb
 * and lose its pronouns on the next save. A teacher says what the word is;
 * the table follows.
 */
export const categoryChoices = (
  lang: Lang | null | undefined,
): { value: string; label: string; note: string }[] =>
  categoriesOf(lang)
    /* A kind that is no longer asked about is still read — a card saved
       while it was offered goes on saying what it is — but it is not one
       of the answers. See WordCategory.retired. */
    .filter((c) => !c.retired)
    .map((c) => ({ value: c.id, label: c.label, note: c.note }));

/**
 * And which of them the radio actually offers.
 *
 * Everything the language declares, on a card whose table is still empty.
 * On a card that already has one, the kinds that lay out **that same
 * table**: the table is the content, so offering a kind that lays out
 * another is offering to throw it away — which is 0.120's rule and does
 * not move. But a noun and a preposition take the same pronouns, so
 * choosing between those two loses nothing, and it was the one answer a
 * teacher could not correct.
 *
 * That mattered because the kind of an older card is guessed rather than
 * stored (see initialCategory), and the guess is the first kind declaring
 * the table — so every preposition written before the question existed
 * opened as a noun, was saved as one, and from 0.139 began filling
 * `{{noun}}`. This is where it can be said otherwise.
 *
 * One answer is not a question: where a table has only one kind that lays
 * it out, nothing is offered and the line underneath says what the card is
 * instead.
 */
export function categoryOffers(
  lang: Lang | null | undefined,
  { worded, storedForms }: { worded: boolean; storedForms: CardForms },
): { value: string; label: string; note: string }[] {
  if (!worded) return [];
  const all = categoryChoices(lang);
  if (!storedForms) return all;
  const same = all.filter((c) => tableFor(lang, c.value) === storedForms);
  return same.length > 1 ? same : [];
}

/**
 * And which table that answer lays out, where the pack has one.
 *
 * A noun and a preposition take the pronouns on their end; a verb has its
 * persons and tenses. Everything else is the word and whatever forms the
 * teacher writes — and so is a noun in a language that attaches nothing,
 * which is what a category naming a table its pack has not got means.
 */
export const tableFor = (
  lang: Lang | null | undefined,
  category: string | null | undefined,
): CardForms => {
  const table = (categoryOf(lang, category) || { table: "" }).table || "";
  return specOf(lang, table) ? table : "";
};

/* What a table's cells wait on, where it says nothing: the word — the rule
   every one-row table has followed since there was one. The same reading
   the trainer makes. */
const waitsOnWord = (spec: VerbSpec | null | undefined): boolean =>
  !!spec && (spec.gate || "word") === "word";

/*
 * The three kinds of card, and what each of them is.
 *
 * **What kind of card this is, is settled once and never again.** Since
 * 0.187 it is settled before the editor opens at all: New card asks which
 * of the three, and what comes up is a screen for making that one — see
 * NewCardKind. From the first save it is a fact about the card, shown and
 * not offered, and it never was offered afterwards.
 *
 * A conversation was already like this — a scene with four turns on it
 * would have nowhere to put them — and a word with a table was half like
 * it, because the table is content and offering to call the card a
 * sentence was offering to throw it away. What stayed open was the pair
 * that looked harmless: a word with no table could be called a sentence
 * and back again. It is not harmless. A card is what a student's whole
 * record is attached to and what every other card's blanks are written
 * against, and the three kinds are asked, dealt and filled in three
 * different ways — so a card changing kind under them is a card whose
 * past means something it no longer is.
 *
 * Whoever wanted the other one wants a new card, which costs them the
 * typing and costs nobody a schedule.
 */
export const shapeChoices = (): { value: CardShape; label: string; note: string }[] =>
  [
    { value: "word", label: "Word or phrase", note: shapeHelp("word") },
    { value: "sentence", label: "Sentence", note: shapeHelp("sentence") },
    { value: "scene", label: "Conversation", note: shapeHelp("scene") },
  ];

/** What one of them is called, for the screen that is making one. */
export const shapeLabel = (shape: CardShape): string =>
  (shapeChoices().find((c) => c.value === shape) || { label: "card" }).label;

/* What each of the three is, in one sentence — said to somebody choosing
   between them and to somebody reading what their card already is, which
   is the same sentence and so is written once. */
export const shapeHelp = (shape: CardShape): string =>
  shape === "scene"
    ? "Turns, in order, with somebody saying each one. Every turn is practised in its own right, and the whole scene as well."
    : shape === "sentence"
      ? "A sentence with a blank in it, filled by another card — a noun, a verb, or a blank you name — and by a different one each time it is asked."
      : "One thing to learn, with its meaning. Whether it counts as a word or a phrase is read off what you write.";

/* ------------------------------------------------------------------
   What a card is, before anything is drawn

   The rules the editor stands on, as plain functions of a card or a draft:
   which forms it opens with, which table it lays out, what a save carries
   and whether there is anything to save. Kept out of the component so a
   test can ask them without a screen, and so the editors below read one
   answer rather than each working it out.
   ------------------------------------------------------------------ */

/* A form that is kept and lent but never asked on its own. Written out
   rather than left to the fallback, because with `ask` off an absent
   `lend` reads as "not lent" — see setPartFlags, which is the same rule
   said once. */
export const keptNotAsked = (f: Record<string, any>): Record<string, any> =>
  setPartFlags(f, false, partLends(f));

/* And the way back, for the one case that goes back — see `guess`. */
export const askedAgain = (f: Record<string, any>): Record<string, any> =>
  setPartFlags(f, true, partLends(f));

/*
 * A card stored as a value rather than as a question, opened as one.
 *
 * `drill: false` on the card is the card-wide way of saying "this is
 * Raphael, and *what does Raphael mean* is not a question". It used to be
 * a tick of its own in the Blanks block — one answer for the whole card,
 * in a different place from the per-form ticks and asking a question that
 * read like theirs. Since 0.179 there is one question, asked of each part
 * where that part is edited, so what the card carries is read back into
 * those ticks on the way in: nothing asked on its own, everything still
 * lent. Saving writes the card's flag back out the same way — see
 * writtenCard.
 */
const asValue = (
  card: Card | null,
  list: Record<string, any>[],
): Record<string, any>[] =>
  card && card.drill === false ? list.map(keptNotAsked) : list;

/*
 * The forms a card opens with: its own word first, then every sub-form
 * that is not a cell of a table.
 *
 * A card started from a suggestion arrives with its first line already
 * written — the word the phrases keep using — and everything else blank,
 * which is the shape of the job left to do.
 *
 * The cells of a verb's table are sub-forms too, and are edited in the
 * table rather than as blocks — so they are held apart while the editor is
 * open and put back on save. A form written before forms had names is
 * given one on the way in, so that a table can be hung off it here and
 * now. Naming it changes nothing the student has done: a renamed form is
 * matched back to its schedule by where it sits — see foldForms in
 * shared.tsx.
 */
export function initialForms(
  card: Card | null,
  draft: Record<string, any> | null,
): Record<string, any>[] {
  if (!card) return [{ ...blankForm(), ...(draft || {}) }];
  /*
   * Through leadOf, which is how every reader asks for the card's own word.
   *
   * This read it off the top of the card — `card.ar`, its recordings, its
   * grammar — which is where the word lived until 0.138 moved it into the
   * first of one list of forms. Nothing has written there since, so a card
   * saved by this build opened with an empty first block and a Save that
   * stayed grey; a card written before it and re-saved since opened with
   * the word it had *before* that save, and saving again wrote the stale
   * copy back over the real one, recordings and all. A card still stored
   * the old way reads the same either way: leadOf hands back the card
   * itself.
   */
  const word = leadOf(card) as Record<string, any>;
  const out: Record<string, any>[] = [
    {
      ar: word.ar || "",
      en: word.en || "",
      lat: word.lat || "",
      ...dimValues(word),
      /* What each accepted answer is, grammatically — kept rather than
         left to be rebuilt from the delimited strings, which carry the
         words and not the grammar. Without it the feminine of a card
         accepting two spellings came back as whatever the form's own
         values were, every time the card was opened. It is what a
         sub-form has always carried through the spread below; the strings
         still win where the two disagree, as answersOf insists. */
      ...(Array.isArray(word.answers) ? { answers: word.answers } : null),
      clips: word.clips || [],
      slowClips: word.slowClips || [],
      /* Whether the card's own word is asked about. Carried only where it
         is off, which is what the field means everywhere else too. */
      ...(word.ask === false ? { ask: false } : null),
      /*
       * And whether it is lent to sentences, which is the other half of
       * the same answer and was not carried here at all.
       *
       * A sub-form is spread whole below and so has always kept it; the
       * card's own word is copied field by field, and the field was
       * missing from the copy. What that cost is the card the split was
       * made for: a name is stored `ask: false, lend: true`, opened with
       * an absent `lend` — which beside `ask: false` reads as *not lent*
       * — and saved back unlent, so every sentence asking for {{name}}
       * quietly lost it. The reverse went the same way: a word kept out
       * of sentences on purpose was lent again by being opened. Carried
       * only where it was said, because absent is a reading and not a
       * gap — see isLent.
       */
      ...(typeof word.lend === "boolean" ? { lend: word.lend } : null),
    },
  ];
  /*
   * And the forms under it — but not a cell of a table, which is edited as
   * a table, and not the verb's own sentence, which is neither.
   *
   * A frame carries a row and no column (see isFrame): it is the sentence
   * a verb stands in its own place in, `{{name}} {{verb}} {{object}}`. It
   * is not a cell, so it used to land here among the ordinary forms — and
   * a card that is not a sentence with braces in one of its forms is
   * exactly what `strayHoles` refuses to save. So a verb card carrying one
   * could not be saved at all, whatever the teacher had come to change,
   * and the only way out the screen offered was to delete the braces,
   * which is to delete the sentence. Kept aside and put back untouched at
   * save — see `keptFrames`.
   */
  for (const s of subFormsOf(card).filter((f) => !isCell(f) && !isFrame(f))) {
    out.push({ ...blankForm(), ...s, id: String(s.id || "") || formName(out) });
  }
  return asValue(card, out);
}

/*
 * A verb's own sentences, kept exactly as they were stored.
 *
 * Nothing on this screen writes one and nothing on it edits one, so the
 * whole of what the editor owes them is not to lose them: they are lifted
 * out before the forms are drawn and put back when the card is saved.
 */
export function initialFrames(card: Card | null): Record<string, any>[] {
  return card ? framesOf(card).map((f) => ({ ...f })) : [];
}

/*
 * Which tenses each of a sentence's blanks already asks its verbs for.
 *
 * Read off the card's own word, which is where the save writes it, and
 * through the same answer the question itself reads it through — see
 * slotRows, which narrows each row to a name and reads an absent answer as
 * every tense. A card that has narrowed nothing opens with nothing, which
 * is every card written before the teacher was asked.
 */
export function initialRows(card: Card | null): Record<string, string[]> {
  const lead = card ? leadOf(card) : null;
  const out: Record<string, string[]> = {};
  for (const slot of slotsOf(lead)) {
    const rows = slotRows(lead, slot);
    if (rows.length) out[slot] = rows;
  }
  return out;
}

/*
 * The same forms, each saying what its blanks ask their verbs for.
 *
 * One answer for the card written onto every form of it, because the
 * blanks are the card's and every field that has words in it leaves the
 * same ones. Stored only where something is actually narrowed: a blank
 * admitting every tense says nothing, which is what an absent answer has
 * always meant and what keeps a card the teacher has not touched byte for
 * byte what it was.
 *
 * And only for the blanks the card still leaves, so a tense picked for a
 * blank that has since been taken out of the words goes with it rather
 * than sitting on the card answering for a hole nobody can see.
 */
export function withRows(
  forms: Record<string, any>[],
  rows: Record<string, string[]>,
  holes: string[],
): Record<string, any>[] {
  const said: Record<string, string[]> = {};
  for (const slot of holes) {
    const picked = (rows || {})[slot] || [];
    if (picked.length) said[slot] = picked;
  }
  const any = Object.keys(said).length > 0;
  return forms.map((form) => {
    const next = { ...form };
    if (any) next.tenses = said;
    else delete next.tenses;
    return next;
  });
}

/*
 * One value per card for the axes that are about the card.
 *
 * Whether a noun is a person or a thing is as true of its plural as of its
 * singular — see perCard — so the draft settles it on the way in rather
 * than leaving one answer on each form to disagree with the next. What a
 * card already says is what it settles on: the first answer that names the
 * axis, because the picker this replaces wrote onto answers, and the lead
 * form's own value otherwise, which is what an import, the server and
 * every card written before that picker existed set.
 *
 * It goes onto every form, where `valueOf` reads a word's grammar and
 * where the agreement rules therefore find it, and comes off the answers,
 * which have no business holding a fact about the whole card.
 */
export function oneValuePerCard(
  lang: Lang | null | undefined,
  forms: Record<string, any>[],
): Record<string, any>[] {
  const dims = cardDims(lang, null);
  if (!dims.length) return forms;
  const fields = answerFields();
  const lead = forms[0] || {};
  const settled: Record<string, string> = {};
  for (const dim of dims) {
    const said = answersOf(lead, fields)
      .map((a) => String(a[dim.field] || "").trim())
      .find(Boolean);
    settled[dim.field] = said || String(lead[dim.field] || "").trim();
  }
  return forms.map((form) => ({
    ...form,
    ...settled,
    ...(Array.isArray(form.answers) ? { answers: form.answers.map(withoutCardDims(dims)) } : null),
  }));
}

/** An accepted answer with the card's own axes taken off it. */
const withoutCardDims = (dims: GrammarDim[]) => (answer: Record<string, any>) => {
  const out = { ...answer };
  for (const dim of dims) delete out[dim.field];
  return out;
};

/*
 * The cells a card opens with — every sub-form that sits in a table.
 *
 * Only a card whose table cites a cell has its dictionary form seeded, and
 * only where the card already carries that table: a plain word has no
 * table, and seeding one would be answering the selector on the teacher's
 * behalf. That table and not any card with a cell — a word with pronouns
 * on its end has cells too, and seeding the dictionary form into one of
 * those opened it on the verb table with its pronouns put aside, which the
 * next save then dropped.
 */
export function initialCells(
  card: Card | null,
  lang: Lang | null | undefined,
): Record<string, any>[] {
  /*
   * Every cell gets a name on the way in, the way a plain form does.
   *
   * A cell had none. It was the one kind of form this app could not point
   * at, so on a student's device it was known by where it sat in the list
   * — and a teacher fixing a typo in one box of a verb's table handed
   * every cell below it the schedule of the cell above. 0.131 gave forms
   * names for exactly that reason and the table was left out of it.
   *
   * Naming them changes nothing a student has done: the order is kept, and
   * a form whose name is new is matched back to its schedule by where it
   * sits — see foldForms in shared.tsx, which was written for the release
   * that named the others.
   */
  const had: Record<string, any>[] = [];
  const taken = () => subFormsOf(card).concat(had as any);
  for (const s of subFormsOf(card).filter((s) => isCell(s))) {
    had.push({ ...blankForm(), ...s, id: String(s.id || "") || formName(taken()) });
  }
  const cited = Object.values(tablesOf(lang)).find(
    (spec) => citationOf(spec) && cellsIn({ subs: had }, spec).length,
  );
  /* The card's own word, through leadOf as everything else reads it. */
  return asValue(card, cited ? seedCited(had, leadOf(card), cited, taken()) : had);
}

/*
 * What a card says it is when it is opened.
 *
 * The teacher's answer where there is one — and where there is not, what
 * the card holds says it instead: a verb's table makes it a verb, and the
 * pronouns on the end of a word make it a noun, which is what the radio
 * this replaced read off the very same cells. Anything else has not been
 * said, and the teacher is asked rather than guessed at.
 *
 * Shown selected, not written: nothing is stored until the card is saved,
 * so a card written before the question existed is told what it looks like
 * and can say otherwise.
 */
export function initialCategory(
  card: Card | null,
  lang: Lang | null | undefined,
  cells: Record<string, any>[],
): string {
  const said = categoryOf(lang, card && card.category);
  if (said) return said.id;
  /* What the card holds, read the way the tables are declared: the first
     table its cells sit in names the first kind of word that lays that
     table out — a verb's rows make it a verb, and the pronouns on the end
     of a word make it a noun, because the noun is declared before the
     preposition. */
  for (const [name, spec] of Object.entries(tablesOf(lang))) {
    if (!cellsIn({ subs: cells }, spec).length) continue;
    const kind = categoriesOf(lang).find((c) => c.table === name);
    if (kind) return kind.id;
  }
  return "";
}

/*
 * What the stored card already carries, which is what the radio may no
 * longer take away.
 *
 * Asked of the saved card rather than of the editor, on purpose: a table
 * typed into a card that has never been saved is not yet anybody's work,
 * and locking a teacher into a shape because they filled one box to see
 * what it did would be the opposite of the point.
 */
export function storedFormsOf(
  card: Card | null,
  lang: Lang | null | undefined,
): CardForms {
  for (const [name, spec] of Object.entries(tablesOf(lang))) {
    if (subFormsOf(card).some((f) => rowIdsOf(spec).has(String(f.row || "")))) return name;
  }
  return "";
}

/*
 * How much of a table is being held aside — nothing, on every card that
 * has none. What the line under the radio counts: every form's table of
 * the kind not on screen, because a word with pronouns on its end carries
 * one per form, and the warning counts what saving the card the other way
 * would drop.
 */
export function asideOf(
  cells: Record<string, any>[],
  specs: (VerbSpec | null)[],
  shownSpec: VerbSpec | null,
  /* The forms the card still carries, for the cells hanging off one that
     has gone. Left out, only the other table is counted. */
  forms: Record<string, any>[] = [],
): number {
  const other = specs
    .filter((spec): spec is VerbSpec => !!spec && spec !== shownSpec)
    .reduce(
      (n, spec) =>
        n + cellsIn({ subs: cells }, spec).filter((c) => String(c.ar || "").trim()).length,
      0,
    );
  /* And the cells of the table on screen that the save drops anyway: one
     hanging off a form no longer on the card is a word with a pronoun on
     the end of nothing, and tableCellsOf leaves it out. Dropping it is
     right; dropping it without the line above saying so was the one thing
     a save took away in silence. */
  const shown = cellsIn({ subs: cells }, shownSpec).filter((c) => String(c.ar || "").trim()).length;
  const kept = tableCellsOf(cells, shownSpec, forms).filter((c) => String(c.ar || "").trim()).length;
  return other + Math.max(0, shown - kept);
}

/*
 * The cells of the table on screen, as they will be saved.
 *
 * Only the table on screen, so changing which one the card lays out puts
 * the other away rather than saving a hidden one — and a card can never be
 * saved carrying both.
 *
 * And only cells whose form is still here and still says something. A
 * form with nothing typed into it is dropped on the way out, so its
 * pronouns would otherwise be saved hanging off a name no form on the card
 * answers to: drilled, never opened, and waiting for ever on a word that
 * is not there.
 */
export function tableCellsOf(
  cells: Record<string, any>[],
  shownSpec: VerbSpec | null,
  forms: Record<string, any>[],
): Record<string, any>[] {
  if (!shownSpec) return [];
  return cellsIn({ subs: cells }, shownSpec).filter((c) => {
    const of = String(c.of || "");
    if (!of) return true;
    const owner = forms.find((f) => String(f.id || "") === of);
    return !!owner && !!(String(owner.ar || "").trim() || String(owner.en || "").trim());
  });
}

/* ---- what is drilled, and where ----

   A card is one word and a pile of forms of it: other spellings, the
   pronouns a language puts on its end, every person and tense of a verb.
   Until 0.134 all of it was drilled, and the only way to stop any of it
   being drilled was to delete it — which takes its recordings and every
   student's progress with it.

   So each of those is a thing that can be switched off and kept: written
   on the card, shown to a student who opens it, and never asked about.
   What is stored is the switched-off ones, on the forms themselves, so a
   card written before this and a form added after are both asked — see
   `ask` in types.ts.

   Two questions, since 0.179, because they were always two: whether a
   form is asked **on its own** — what does it mean, how is it written —
   and whether it is lent **inside sentence cards**, standing in the blank
   another card leaves. A name is worth the second and is no question at
   all as the first; a rare plural kept for reference is worth neither; an
   ordinary word is worth both. One tick answered both until now, so
   keeping a form without asking it also took it out of every frame. See
   `lend` in types.ts and isLent in variables.ts.

   And they are asked where the answer applies — under the fields of the
   form they are about, and under the table on the end of it — rather
   than in one list at the foot of the screen naming parts by the words
   the editor happens to call them. */

/** One part of the card: what it covers, and the two answers about it. */
export interface AskPart {
  /** What it covers, in the editor's own terms — see setAskPart. */
  id: string;
  title: string;
  note: string;
  /** Asked as a question of its own. */
  on: boolean;
  /** Lent to the cards that leave a blank of its name. */
  lends: boolean;
}

/** Whether a form of the draft is asked about. Absent means yes. */
export const partAsked = (form: { ask?: boolean } | null | undefined): boolean =>
  !!form && form.ask !== false;

/** And whether it is lent to sentence cards — see isLent, which is the
    one answer and which this only narrows to the draft's shape. */
export const partLends = (form: Record<string, any> | null | undefined): boolean =>
  !!form && isLent(form);

/*
 * The two answers written onto one form, together.
 *
 * Always together, because what `lend` means when it is absent is
 * whatever `ask` says — so writing one without the other could turn the
 * teacher's answer to the second question into its opposite. Left off
 * where the fallback already says the same thing, so an ordinary form
 * gains no field and a card that passes through this editor untouched is
 * stored exactly as it arrived.
 */
export const setPartFlags = (
  form: Record<string, any>,
  ask: boolean,
  lend: boolean,
): Record<string, any> => {
  const next = { ...form };
  if (ask) delete next.ask;
  else next.ask = false;
  if (lend === ask) delete next.lend;
  else next.lend = lend;
  return next;
};

/** A form nobody has typed anything into is not a part of anything yet. */
const hasWords = (f: { ar?: string; en?: string }): boolean =>
  !!(String(f.ar || "").trim() || String(f.en || "").trim());

/*
 * The parts of a card that can be asked about, in the order they are on
 * screen.
 *
 * One line per form, and one under it for whatever table hangs off that
 * form — which is what a card is: a word, and forms of the word, and for
 * each of them the pronouns it takes on its end. A verb is the other
 * shape: its table belongs to the card rather than to a form, so it is one
 * line at the end.
 *
 * A form's table is only offered while the form itself is. The pronouns on
 * the end of a word wait on that word being known, so a table under a form
 * nobody is asked about could never open — offering it would be offering
 * something that does nothing. Switching the form off switches its table
 * off with it, which is what that line of the section then says.
 *
 * Nothing is listed for a table nobody has written yet: an empty table is
 * not asked about either way, and a card being written from scratch would
 * otherwise open with a section about forms that do not exist.
 */
export function askParts(
  { forms, cells, spec }: {
    forms: Record<string, any>[];
    cells: Record<string, any>[];
    /** The table on screen, where there is one. */
    spec: VerbSpec | null;
  },
): AskPart[] {
  const out: AskPart[] = [];
  /* Two facts about the table say how its cells are listed: whether every
     form carries one, and whether the card's own word is one of its cells.
     A table that cites is a verb's, in every pack today, which is what the
     wording below says. */
  const perForm = !!(spec && spec.perForm);
  const cite = citationOf(spec);
  forms.forEach((f, i) => {
    out.push({
      id: `form:${i}`,
      title: i === 0 ? (cite ? "The verb" : "The main form") : `Form ${i + 1}`,
      note: String(f.ar || "").trim() || String(f.en || "").trim() || "nothing written yet",
      on: partAsked(f),
      lends: partLends(f),
    });
    /* This form's own table, where every form carries one — the pronouns
       on its end. Under the form it belongs to, at the same level as the
       table is on screen. */
    if (!perForm || !spec || !partAsked(f)) return;
    const of = i === 0 ? "" : String(f.id || "");
    const mine = cellsIn({ subs: cells }, spec, of).filter(hasWords);
    if (!mine.length) return;
    out.push({
      id: `table:${of}`,
      title: `Its ${spec.label || "table"}`,
      note: `${plural(mine.length, "form")} written`,
      on: mine.some(partAsked),
      lends: mine.some(partLends),
    });
  });
  if (spec && !perForm) {
    /* The table the card carries. Every cell but the one the card's own
       word is: that cell is the word, and it is the line above. */
    const table = cellsIn({ subs: cells }, spec).filter(
      (c) => hasWords(c) && !(cite && c.row === cite.row && c.col === cite.col),
    );
    if (table.length) {
      out.push({
        id: "table:",
        title: cite ? "The conjugated forms" : `Its ${spec.label || "table"}`,
        note: `${plural(table.length, "form")} written`,
        on: table.some(partAsked),
        lends: table.some(partLends),
      });
    }
  }
  return out;
}

/*
 * Whether a word can be saved: its script and its English, and no field
 * disagreeing about the blanks it leaves. English, not "English or a
 * transliteration": a card carrying only the script and a romanisation
 * supports one exercise type, and no student could ever practise it.
 */
export const canSaveWord = (
  main: { ar?: string; en?: string },
  trouble: unknown,
): boolean => !!(String(main.ar || "").trim() && String(main.en || "").trim() && !trouble);

/*
 * Whether a verb whose table stands in for its own word can be saved.
 *
 * **Not one particular box of it.** Until 0.200 it was the cell a
 * dictionary lists the verb under — Arabic's he-past — because that cell
 * was also the card's own word and its face in every list, so a card
 * without it had nothing to be listed as and no meaning to be asked
 * about. A teacher writing the present tense of a verb whose past they
 * have not taught was writing half a card, and the editor said so.
 *
 * What a verb is listed as is its **name** now, which is a thing about
 * the whole card and the only thing on a verb that can be one. So that is
 * what is asked for, and the box a dictionary happens to list is an
 * ordinary box of the table like the other twenty-three.
 *
 * The rest is what every card has always been held to, asked of the table
 * as a whole rather than of one cell: **one form written, with its
 * English**. A table with nothing in it teaches nothing, and a form
 * carrying only the script supports one exercise nobody could ever
 * practise — which is the reason canSaveWord gives above, unchanged.
 * Which form it is, is the teacher's business.
 */
export const canSaveVerb = (
  name: string,
  cells: { ar?: string; en?: string }[],
  trouble: unknown,
): boolean =>
  !!(
    String(name || "").trim() &&
    cells.some((c) => String(c.ar || "").trim() && String(c.en || "").trim()) &&
    !trouble
  );

/* A conversation needs a name and two turns. One line with the reply
   missing is a phrase card in the wrong editor. */
export const canSaveScene = (title: string, written: unknown[]): boolean =>
  !!title.trim() && written.length >= 2;

/* The turns that will be saved: the ones somebody has written. */
export const writtenLines = <T extends { ar?: string }>(lines: T[]): T[] =>
  lines.filter((l) => (l.ar || "").trim());

/*
 * What to call one form's table out loud, where there is more than one on
 * screen — "the word", "form 2" — and nothing where the table is the only
 * one there is.
 */
export const ownerLabel = (i: number, count: number): string =>
  count > 1 ? (i === 0 ? "the word" : `form ${i + 1}`) : "";

/* ------------------------------------------------------------------
   The draft

   Everything a teacher has typed but not yet saved, in two hooks: the word
   and its forms, and the conversation. Both are held by the editor's shell
   whichever kind of card is showing — a new card can be turned from a word
   into a conversation and back, or from a word into a verb and back, and
   what was typed the first time is still there the second. That was true
   when all of this was one component's state, and it stays true because
   the two hooks are called unconditionally, not because anything is put
   in escrow.

   The hooks own state and the rules over it; the editors below draw it.
   ------------------------------------------------------------------ */

/**
 * A blank this language knows about, and what it is worth.
 *
 * Two numbers, because they answer two different questions a teacher has
 * while choosing one: how many words fill it, and how many cards leave it.
 * `built` marks the ones nobody writes on a card — `{{word}}`, and one per
 * kind of word the language declares — which a card fills by being what it
 * already said it was rather than by being told to.
 */
export interface Blank {
  name: string;
  /** Cards that can fill it. */
  words: number;
  /** Cards that leave it — how many sentences would borrow a word put here. */
  used: number;
  /** Cards that named it in `fills`: whether anybody wrote this blank by hand. */
  wrote: number;
  built?: "any" | "category";
}

/**
 * One example of a card with a blank in it, as a student will meet it: the
 * frame with its holes filled, in each of the three fields it is written
 * in. A field the card leaves empty comes back empty.
 *
 * How many of them any screen draws at once, and the filling itself, are
 * `EXAMPLES_CEILING` and `examplesOf` in card-facts.ts: the read-out asks
 * the same question about the same card, and two answers to it would be two
 * accounts of what a teacher has written.
 */
export interface Asked {
  ar: string;
  lat: string;
  en: string;
}

/* One empty list rather than a new one per render, so a card with no
   blanks in it holds the memos below still. */
const NO_HOLES: string[] = [];
/* The same, for the filled examples while the section is folded away. */
const NO_ASKED: Asked[] = [];

/** The word, its forms, its tables and everything asked of them. */
export function useWordDraft({ card, lang, allCards, draft, shape }: {
  card: Card | null;
  lang: Lang;
  allCards: Card[];
  draft: Record<string, any> | null;
  /* Which of the three the card is being written as just now, which a
     word's rules read: a conversation leaves no blanks and has nothing to
     save as a word, and a sentence is asked no part of speech and lays out
     no table, because it is not a word. */
  shape: CardShape;
}) {
  const scene = shape === "scene";
  /* The two answers a table and a part of speech belong to. A sentence is
     neither: what fills its blanks is other cards. */
  const worded = shape === "word";
  /* The axes this language uses, straight from its declaration. Arabic gets
     number and gender; Huế gets the addressee and no gender at all. */
  const drillsTranslit = (lang || {}).translitDrilled !== false;
  const [forms, setForms] = useState(() => oneValuePerCard(lang, initialForms(card, draft)));
  /* The card's cells, whichever tables they sit in. Kept beside `forms`
     rather than inside it because the two are edited in different shapes
     — a list of blocks, and a table — and joined again at save. */
  const [cells, setCells] = useState<Record<string, any>[]>(() => initialCells(card, lang));
  /* And the verb's own sentences, which this screen neither writes nor
     edits and must not drop — see initialFrames. */
  const [keptFrames] = useState<Record<string, any>[]>(() => initialFrames(card));
  /* What the teacher says this word is — see initialCategory — and, from
     that, which table it lays its forms out in. */
  const [category, setCategory] = useState<string>(() => initialCategory(card, lang, cells));
  const table = tableFor(lang, category);
  /* Whichever table the card is showing, or none. Named once because
     everything below reads "the table on screen" rather than which one it
     is — and what it needs to know about that table it asks the table. A
     conversation and a sentence lay out nothing: they have turns and
     blanks where a word has forms. */
  const shownSpec = worded ? specOf(lang, table) : null;
  /*
   * Whether this kind of word lays something out everywhere *but here*.
   *
   * A category names a table, and a pack declares the tables it has: an
   * adjective agrees in the two Semitic languages and nothing agrees in
   * Huế, so an adjective there is the word and whatever forms a teacher
   * writes. That is right, and it was silent — the screen came out
   * identical to "Something else", which is indistinguishable from the
   * app having lost the table. Said out loud below.
   */
  const tableMissing =
    worded && !!(categoryOf(lang, category) || { table: "" }).table && !table;
  /* Whether every form carries the table, or the card does. */
  const perForm = !!(shownSpec && shownSpec.perForm);
  /* What the stored card already carries, which is what the radio may no
     longer take away — see storedFormsOf. */
  const storedForms: CardForms = storedFormsOf(card, lang);
  /* What this language lets a word be — see categoryOffers. */
  const categoryOffer = categoryOffers(lang, { worded, storedForms });
  /*
   * And what this card says it is, from the language's whole list rather
   * than from what the radio offers.
   *
   * A saved card whose table only one kind of word lays out is offered
   * nothing — one answer is not a question — and still has an answer,
   * which the screen has to be able to show. Read off the list of every
   * kind so that the two cannot come apart: the offer is about what may
   * be changed, this is about what the card is.
   */
  const categorySaid = (worded && categoryChoices(lang).find((c) => c.value === category)) || null;
  /* How much of a table is being held aside — what the line under the
     radio counts. */
  const aside = asideOf(cells, Object.values(tablesOf(lang)), shownSpec, forms);
  /* A name for a cell nobody has written yet, free of every name this card
     already uses — its forms' and its other cells'. One place, because a
     cell and a form are told apart by nothing but their names. */
  const mintCell = () => formName([...forms, ...cells]);
  /*
   * Whether the table holds the card's own word as well as its forms.
   *
   * Arabic and Hebrew have no infinitive: a dictionary lists the he-past,
   * which is a cell of this very table, and the pack says so. So on those
   * two the cell carries everything the card's own word does — the script,
   * the pronunciation, the English and the recordings — and a block asking
   * for them again was asking the teacher to type the same word twice and
   * then keep the two in step by hand. It is not shown. Huế cites the bare
   * verb, which is a word and not a cell, so there the block is the verb
   * and stays.
   *
   * What the card is saved as comes off the cell, which is what makes the
   * block safe to take away: the face in every list, the meaning, the
   * recordings. Everything that reads a card goes on reading a card.
   */
  const cite = citationOf(shownSpec);
  const citedAt = cite ? cells.find((c) => c.row === cite.row && c.col === cite.col) || null : null;
  const standsIn = !!cite;
  /* Which cell of which table has the recording screen open, by where it
     sits rather than by its place in the list: the list is rewritten
     whenever a cell is typed into, so an index would point at a different
     form by the time the screen came back.

     Whose table, as well as which box of it. Two forms of one word each
     have a *me*, so a row and a column name two cells between them and the
     mic on the second would have opened the first. */
  const [recordingCell, setRecordingCell] = useState<{ of: string, ofLabel: string, row: string, col: string } | null>(null);
  const cellHere = recordingCell
    ? cells.find(
        (c) =>
          c.row === recordingCell.row &&
          c.col === recordingCell.col &&
          String(c.of || "") === recordingCell.of,
      ) || null
    : null;
  const [note] = useState((card && card.note) || "");
  /* What to call the card in a list. Asked of the two cards whose own words
     do not name them — a verb whose word is a cell of its table, and a
     sentence, which is a frame — see the block that asks for it. */
  const [name, setName] = useState(((card && card.name) || "") as string);
  /*
   * On the way in to a table that cites a cell — a verb's — the card's own
   * word moves into the cell about to hold it, rather than being left
   * behind in a block that has just disappeared; and only into an empty
   * cell, because a card that already has a table knows better than the
   * block does. Nothing of the sort for a table that cites nothing: the
   * word stays the word, and the cells are forms of it rather than a
   * stand-in for it.
   *
   * And the word's English becomes what the card is called, where nothing
   * is called anything yet. A verb is listed as its name and has to have
   * one, and the meaning just typed into a word about to become a verb —
   * "to eat" — is that name in the overwhelming majority of cases. Never
   * over a name somebody has written, and never from a card that has said
   * nothing: what this cannot do is invent one.
   */
  const chooseCategory = (next: string) => {
    setCategory(next);
    const spec = specOf(lang, tableFor(lang, next));
    if (!citationOf(spec)) return;
    setCells((x) => seedCited(x, forms[0], spec, forms));
    setName((was) => was.trim() || String((forms[0] || {}).en || "").trim());
  };
  /* Which blanks this card fills, where it is a value rather than
     something to learn: "Raphael" fills `name`, and every phrase with a
     {{name}} in it can borrow it. A list, because a word stands in more
     than one kind of hole as soon as a teacher writes a second frame about
     it; a card written when it was one name reads as a list of one, which
     fillNames is the one answer to. */
  const [fills, setFills] = useState<string[]>(() => fillNames(card));
  /*
   * Naming a blank this card fills, and taking one off.
   *
   * By name rather than by where it sits in the list, because the screen
   * that says so is a list of every blank there is with this card's ticked
   * — an index would be an index into the wrong list. Two one-liners
   * rather than the screen reaching into the state, because the same rules
   * hold for both and holding them in one place is how they cannot be kept
   * differently by whoever draws the next control: a name appears once,
   * and no card carries more than MAX_FILLS of them, which is the cap the
   * server stores by, read from the same constant so the two cannot
   * disagree.
   */
  /*
   * What a new card looks like, until the teacher says.
   *
   * "Raphael" is written to fill *my name is {{name}}*, and *what does
   * Raphael mean* is not a question — so a card that joins a group, and
   * has never said anything else about what is drilled, looks like a
   * value: lent, and not asked on its own. Leaving that group again makes
   * it look like an ordinary word once more.
   *
   * That has been the default since values existed. What changed in 0.179
   * is where it is kept. It used to be a third state of one card-wide
   * toggle — `null`, meaning "whatever this card looks like" — which
   * nobody was ever shown; now it is written into the ticks under each
   * form, where the teacher can read it and say otherwise. So it has to
   * stop guessing the moment they do, which is what `said` is: the first
   * tick touched is the teacher answering, and the app stops answering
   * for them. On a card already saved it never guesses at all.
   */
  const [said, setSaid] = useState(false);
  const guess = (how: (f: Record<string, any>) => Record<string, any>) => {
    if (card || said) return;
    setForms((x) => x.map(how));
    setCells((x) => x.map(how));
  };
  const addFill = (name: string) => {
    if (name && !fills.includes(name) && !fills.length) guess(keptNotAsked);
    setFills((was) =>
      !name || was.includes(name) || was.length >= MAX_FILLS ? was : was.concat([name]),
    );
  };
  const dropFill = (name: string) => {
    if (fills.length === 1 && fills[0] === name) guess(askedAgain);
    setFills((was) => was.filter((had) => had !== name));
  };
  /*
   * The ID this card answers to, the box it is typed in, and whether that
   * box is shut.
   *
   * Shut is the state a saved card opens in: an ID is written once and
   * read a hundred times, and a box you can type in is a box you can type
   * in by accident. It opens on the pencil and shuts on the tick, and the
   * tick only lights on a name nobody else answers to — which is the whole
   * of what "unique" means here, said while the teacher is still looking
   * at it rather than by a refusal at save.
   */
  const savedRef = useMemo(() => cardRef(card), [card]);
  const [ref, setRef] = useState<string>(savedRef);
  const [refOpen, setRefOpen] = useState<boolean>(!savedRef);
  const refName = slotName(ref);
  /* The names nothing else may be called, which is the same list a blank
     can be written against: the kinds of word this language declares fill
     a hole of their own name with nothing ticked, so a card called `noun`
     would be one more thing answering to `{{noun}}`. */
  const kindNames = useMemo(() => categoriesOf(lang).map((c) => c.id), [lang]);
  /* What already answers to the name being typed — another card's ID, a
     group tag, or a kind of word. All of them go between braces, so a name
     is free of all of them or it is not free. */
  const refHeld = useMemo(
    () => (refName ? refClash(refName, (allCards || []) as unknown as Record<string, unknown>[], (card && card.id) || "", kindNames) : null),
    [refName, allCards, card, kindNames],
  );
  const refFree = !!refName && !refHeld;
  /* The same question asked of any name, for the other half of the
     section: a group tag renamed onto a card's ID would be two things
     answering to one `{{x}}`, which is the whole of what the ID is for
     preventing. */
  const nameHeld = (name: string) =>
    refClash(name, (allCards || []) as unknown as Record<string, unknown>[], (card && card.id) || "", kindNames);
  /*
   * A rename the teacher has said should follow the name everywhere.
   *
   * The editor cannot save anybody else's card and does not try to: it
   * carries the answer out with the card being saved, and the screen that
   * owns the collection does the walking. See writtenCard.
   */
  const [spread, setSpread] = useState<{ from: string; to: string }[]>([]);
  /*
   * One entry per name the rest of the collection still knows, whatever
   * the teacher does to it before saving.
   *
   * Renaming twice in a sitting is two answers to one question, and kept
   * as two entries they would fight: `a → b` followed by `a → c` rewrites
   * the other cards to b and then finds no a left to make c, leaving this
   * card called c and everything pointing at b. So a second rename of the
   * same name replaces the first, a rename of where one landed extends it,
   * and a name renamed back to itself is not a rename at all.
   */
  const spreadWith = (from: string, to: string) =>
    setSpread((was) => {
      const same = was.findIndex((r) => r.from === from);
      const chain = was.findIndex((r) => r.to === from);
      const next =
        same >= 0
          ? was.map((r, i) => (i === same ? { from, to } : r))
          : chain >= 0
            ? was.map((r, i) => (i === chain ? { ...r, to } : r))
            : was.concat([{ from, to }]);
      return next.filter((r) => r.from !== r.to);
    });
  /* The question itself, while it is up: what is being renamed, from what,
     to what. Null the rest of the time, which is almost always. */
  const [asking, setAsking] = useState<{ kind: "id" | "group"; from: string; to: string } | null>(null);
  /* Shutting the box on a name that differs from the saved one is a
     rename, and a rename is a question. A card being given its first ID is
     not: there is nowhere for the old name to still be written. */
  const shutRef = () => {
    if (!refFree) return;
    if (savedRef && savedRef !== refName) setAsking({ kind: "id", from: savedRef, to: refName });
    else setRefOpen(false);
  };
  const openRef = () => setRefOpen(true);
  /* And the same question for a group tag, asked from the row it is on. */
  const renameFill = (from: string, to: string) => {
    const now = slotName(to);
    if (!from || !now || now === from) return;
    setAsking({ kind: "group", from, to: now });
  };
  const swapFill = (from: string, to: string) =>
    setFills((was) => {
      const out: string[] = [];
      for (const had of was) {
        const one = had === from ? to : had;
        if (!out.includes(one)) out.push(one);
      }
      return out;
    });
  /*
   * The answer.
   *
   * *Everywhere* is the rename following the name into every card that
   * writes it or carries it; *here* leaves those cards alone, which for an
   * ID means the sentences go on asking for the old name and nothing
   * answers, and for a tag means this card leaves the group rather than
   * the group being renamed. Both are real answers, so both are offered
   * and neither is the default.
   */
  const answerAsk = (everywhere: boolean) => {
    const ask = asking;
    if (!ask) return;
    if (everywhere) spreadWith(ask.from, ask.to);
    if (ask.kind === "group") swapFill(ask.from, ask.to);
    else setRefOpen(false);
    setAsking(null);
  };
  const dropAsk = () => setAsking(null);
  /*
   * And the groups the teacher has taken off every card.
   *
   * The same journey a rename everywhere makes, and for the same reason: a
   * tag is a name several cards share, the only place a stale one is
   * visible is a card that carries it, and the editor holds one card. So
   * the answer is carried out with the card being saved and the screen
   * that owns the collection does the walking.
   *
   * There is no "only here" to ask for: taking this one card out of the
   * group is the tick on the row, two rows up from the question. So the
   * one question is whether to do it at all, and what it costs is the
   * cards that fill the group and the sentences left asking for it.
   */
  const [stripped, setStripped] = useState<string[]>([]);
  /* The group being taken off, while the question is up, with the two
     counts the answer turns on. Null the rest of the time. */
  const [dropping, setDropping] = useState<{ name: string; fills: number; leaves: number } | null>(null);
  const askStrip = (name: string, fillCount: number, leaveCount: number) =>
    setDropping({ name, fills: fillCount, leaves: leaveCount });
  const dropStrip = () => setDropping(null);
  const answerStrip = () => {
    if (!dropping) return;
    /* Where the name will have got to by the time this is carried out: the
       screen applies the renames first, so a tag renamed everywhere and
       then taken off in one sitting has to be taken off where it lands.
       The rename itself stands — it rewrote the sentences' braces too, and
       taking a group off the words says nothing about those. */
    const landed = spread.find((r) => r.from === dropping.name);
    const target = landed ? landed.to : dropping.name;
    setStripped((was) => (was.includes(target) ? was : was.concat([target])));
    dropFill(dropping.name);
    if (target !== dropping.name) dropFill(target);
    setDropping(null);
  };
  /* Which words this phrase teaches. Confirmed, never assumed: the matcher
     below proposes and the teacher decides, because peeling prefixes off an
     Arabic word occasionally lands on a different real one. */
  const [uses, setUses] = useState((card && card.uses) || []);
  /* No "which form's recordings are being made" here any more. Recordings
     belong to an accepted answer, and the rows an answer is edited in live
     inside ScriptAnswers — so the screen for them opens from there, over
     this one, the way every other Screen in the app does. The cells of a
     table still open theirs from here: a cell is one box and holds no
     list of answers. */

  /*
   * Which tenses each of this sentence's blanks wants its verbs in.
   *
   * One answer for the card, kept beside `fills` and the ID rather than
   * inside `forms`, because a blank is a fact about the sentence and every
   * form of it leaves the same ones — which is what the save has always
   * insisted on. Written onto each form at the end, where the reader that
   * fills a hole looks; see `withRows` and the note on CardForm.tenses.
   *
   * Read back off the card's own word, which is where it was written. A
   * card that has narrowed nothing carries nothing and starts empty, which
   * is every card written before this.
   */
  const [blankRows, setBlankRows] = useState<Record<string, string[]>>(() => initialRows(card));
  /* One blank's answer, replaced. An empty list is stored as no answer at
     all — see withRows — so unticking the last tense is how a teacher says
     "any tense" again, and there is no third state to explain. */
  const setBlankRow = (slot: string, rows: string[]) =>
    setBlankRows((was) => ({ ...was, [slot]: rows }));

  /*
   * The card's own word — off the cited cell where the table stands in for
   * it, and the block's own fields everywhere else.
   *
   * Derived rather than written into `forms` as the teacher types: a copy
   * kept in step by an effect is a copy that can fall out of step, and
   * everything below this line — what can be saved, which holes the card
   * leaves, what is sent — then reads one value whichever kind of card it
   * is. The clips travel with it so the card's face can still be heard.
   */
  const lead = standsIn ? citedWord(forms[0], citedAt) : forms[0];
  /* English, not "English or a transliteration": with typing the
     transliteration retired, a card carrying only the script and a
     romanisation supports one exercise type, and no student could ever
     practice it. Better to say so here than to save something inert. */
  /* A conversation needs a name and two turns. One line with the reply
     missing is a phrase card in the wrong editor. */
  /* Which variables the card names, and whether its fields agree about
     them. A frame whose English has a hole and whose script has not is a
     question that asks for a name and marks an answer that never contained
     one, so it is not a card that can be saved. */
  /*
   * Memoised for what reads it below: a fresh array every render would
   * re-fill the preview sentences on every keystroke in any field.
   *
   * On its own contents and not on the form it was read from. `main` is a
   * new object every render — a keystroke makes one, and on a card saved
   * as a cited cell it is built fresh whether anybody typed or not — so a
   * memo held against it was a memo that never hit, and the whole of the
   * preview was rebuilt on every character. Which blanks a card leaves
   * changes when somebody puts one in or takes one out, and that is what
   * this key says.
   */
  const holeNames = scene ? NO_HOLES : slotsOf(lead);
  const holeKey = holeNames.join("\u0000");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const holes = useMemo(() => holeNames, [holeKey]);
  /* The card's word as it will be saved, then whatever else it carries —
     so a hole the cited cell leaves is checked against the fields beside
     it rather than against a block nobody is filling in. Each of them
     carrying what its blanks ask their verbs for, which is one answer for
     the card and is written where the reader of a blank looks. */
  const ownForms = withRows([lead].concat(forms.slice(1)), blankRows, holes);
  /* And the card's own word as it will be saved, which is what everything
     below reads: the holes it leaves, the words behind them, the sentences
     it is met as, and what the save sends. */
  const main = ownForms[0];
  /* What the narrowing comes to as one string, for the memos below: a
     fresh map every render would re-fill the preview on every keystroke,
     and what they actually depend on is which tenses are ticked. */
  const rowsKey = holes.map((slot) => `${slot}:${(blankRows[slot] || []).join(",")}`).join("\u0000");
  /*
   * Every blank this card stands in, as it stands right now.
   *
   * Asked of fillsOf over the draft, because that is the one answer to
   * what a card fills: nothing on this screen can come to disagree with
   * what actually happens at question time, and all of it follows a group
   * being joined, an ID being typed or a kind of word being answered
   * without being told.
   */
  const ownFills = useMemo(
    () =>
      scene
        ? []
        : fillsOf(
            { fills, category, ref: refName, sentence: shape === "sentence" },
            guessKind(main.ar || main.en || main.lat, lang),
          ),
    [scene, fills, category, refName, shape, main, lang],
  );
  /*
   * And so, whether "inside sentence cards" is a question worth asking of
   * this card at all.
   *
   * A tick that does nothing is worse than no tick, and on two kinds of
   * card the answer is settled before anybody reaches it. A sentence is
   * never a filler — one dropped into somebody else's hole is a sentence
   * with a gap where the point was. And a card that stands in no hole at
   * all — one in no group, with no ID, saying it is no kind of word, and
   * whose own word is too long to be the one every frame borrows — is
   * lent nowhere whatever is ticked.
   */
  const canLend = ownFills.length > 0;
  /* The cells of the table on screen, as they will be saved — see
     tableCellsOf. */
  const tableCells = tableCellsOf(cells, shownSpec, forms);
  const trouble = scene ? null : ownForms.map((f) => slotTrouble(f)).find(Boolean) || null;

  /*
   * The blanks on a card that is not a sentence, which is a card that
   * cannot be saved.
   *
   * **Only a sentence may have a blank in it.** A word is a thing to learn
   * and a sentence is a frame to meet it in, and a blank is what makes the
   * second one a frame — so a hole in a word is one of two mistakes, and
   * the teacher is the only one who knows which. Either they meant to
   * write a sentence, and the answer is one tap on the kind above; or they
   * typed braces into a word, and the answer is to take them out.
   *
   * Until 0.176 the app answered for them, by quietly calling any card
   * with braces in it a sentence. That was wrong in both directions at
   * once: it turned a word into a sentence nobody had asked for, and on a
   * word with a table under it, it hid the table and offered to drop every
   * box in it on the next save — a verb's whole conjugation, and every
   * student's progress on it, one tap away.
   *
   * Every form the card carries and not only its own word, because a
   * second form is the same card said another way and a blank in it is the
   * same mistake. The table's cells are not looked at: a sentence a card
   * asks itself in is written on a cell, and is the one place a blank
   * belongs on a word.
   */
  const strayHoles = useMemo(() => {
    if (scene || shape === "sentence") return [];
    const out: string[] = [];
    for (const form of ownForms) {
      for (const slot of slotsOf(form)) if (!out.includes(slot)) out.push(slot);
    }
    return out;
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- ownForms is a
       fresh array every render; what it is made of is what matters. */
  }, [scene, shape, main, forms]);

  /*
   * How many cards stand in each name, counted the one way it is counted.
   *
   * Through `fillsOf`, which is the answer the question itself fills a
   * hole from: a card's group tags, its ID, the kind of word it says it
   * is, and `{{word}}` where it is one. Anything that counts a name by
   * reading only one of those is counting a half — which is what the rows
   * below did until 0.189, each keeping its own half and neither being
   * the number a teacher wanted.
   */
  const behind = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      for (const name of fillsOf(c, kindOf(c, lang))) out.set(name, (out.get(name) || 0) + 1);
    }
    return out;
  }, [allCards, lang]);

  /*
   * The names one card each answers to, which nothing else may take.
   *
   * An ID reaches one card and no other, and that is the whole of what it
   * is for — so a group tag of the same name is a second thing answering
   * to one `{{x}}`, and neither can be pointed at afterwards. The ID box
   * has refused a name a group already holds since it was written; the
   * group box refused only the groups, so the same collision was one tap
   * away on the other side of the screen.
   *
   * IDs and nothing else. A group tag may share a name with a kind of word
   * the language declares, and does: Arabic declares `name`, and
   * `{{name}}` is the oldest frame in the app.
   */
  const refsTaken = useMemo(() => {
    const out = [];
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      const own = cardRef(c);
      if (own) out.push(own);
    }
    return out;
  }, [allCards, lang]);

  /*
   * The blanks this language already knows about, and what each is worth.
   *
   * Two numbers, because they answer two different questions a teacher has
   * while choosing one: how many words fill it, which is whether a card
   * using it can be practised at all, and how many cards leave it, which
   * is whether this is the name everybody else is using or a near miss of
   * it. Read off the cards in hand rather than kept anywhere — a blank is
   * not a thing that is declared, it is a name two cards happen to agree
   * on.
   */
  const blanksAround = useMemo(() => {
    const named = new Map<string, number>();
    const used = new Map<string, number>();
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      /* Which names a card writes on itself, as against which it fills:
         `wrote` is the one fact that tells a group somebody named from a
         kind of word the language declares, and the two can be the same
         string. A sentence writes none — it is a sentence, not a word. */
      if (!isSentence(c)) {
        for (const name of fillNames(c)) named.set(name, (named.get(name) || 0) + 1);
      }
      for (const slot of slotsOf(c)) used.set(slot, (used.get(slot) || 0) + 1);
    }
    /* The blanks nobody writes on a card, so the ones a teacher cannot
       find by looking at their own: any word at all, and one per kind of
       word this language declares.

       `wrote` is the one fact that tells them apart from a blank somebody
       actually wrote, and it is kept on every row rather than only on
       these: a language may declare a kind of word whose name a teacher
       also uses as a blank by hand — Arabic declares `name`, and
       "{{name}}" is the oldest frame in the app — so "is this a kind of
       card" and "has anybody written this blank" are two questions and a
       row has to answer both. */
    const builtIn = [
      {
        name: WORD_SLOT,
        words: behind.get(WORD_SLOT) || 0,
        used: used.get(WORD_SLOT) || 0,
        wrote: named.get(WORD_SLOT) || 0,
        built: "any" as const,
      },
      ...categoriesOf(lang).map((c) => ({
        name: c.id,
        words: behind.get(c.id) || 0,
        used: used.get(c.id) || 0,
        wrote: named.get(c.id) || 0,
        built: "category" as const,
      })),
    ];
    const names = [...new Set([...named.keys(), ...used.keys()])]
      .filter((n) => !builtIn.some((b) => b.name === n))
      .sort();
    /* One row shape over both kinds, so a reader can ask any row whether
       it is built in — the list that leaves the built-in ones out reads
       that field, and a union of two shapes cannot be asked. */
    const rows: Blank[] = [
      ...builtIn,
      ...names.map((name) => ({
        name,
        words: behind.get(name) || 0,
        used: used.get(name) || 0,
        wrote: named.get(name) || 0,
      })),
    ];
    return rows;
  }, [allCards, lang, behind]);

  /*
   * The blanks this card can be offered to fill: the ones somebody wrote.
   *
   * A kind of word is not one of them. A card fills `{{noun}}` by saying
   * it is a noun and `{{word}}` by being a word — fillsOf adds both with
   * nothing ticked — so a list that offered every kind the language
   * declares made the commonest thing a teacher could do on this screen a
   * tick that did nothing, under the impression they had just taught the
   * card something.
   *
   * *Written*, not *not built in*, which is the distinction that took the
   * thinking: a language may declare a kind of word whose name a teacher
   * also uses as a blank by hand. Arabic declares `name` and "{{name}}" is
   * the oldest frame in the app, so a list that dropped every category id
   * would have dropped the one blank everybody actually uses. A blank is
   * offered when some card leaves it or some card says it fills it —
   * which is what "a blank that exists" has always meant here, a blank
   * being a name two cards happen to agree on rather than a thing
   * declared. `{{word}}` is never offered: every word fills it already.
   *
   * Plus whatever this card carries that nothing else does — a name just
   * typed, or one an older release ticked — because a list that hides what
   * the card holds is a list you cannot take it off in.
   */
  /*
   * The tags a card wears without being given them.
   *
   * A card fills `{{noun}}` by saying it is a noun and `{{word}}` by being
   * a word — fillsOf adds both with nothing ticked — so these are not
   * things to answer here. They are shown all the same, since 0.189,
   * because leaving them out left a teacher reading a list of the blanks
   * their card fills that did not have the blanks their card fills in it:
   * the commonest two, on most cards. Grouped, and flat rather than
   * ticked, because the answer is the kind of word above and there is
   * nothing on this row to press.
   */
  const defaultTags = useMemo(
    () =>
      categoriesOf(lang)
        .map((c) => ({
          name: c.id,
          what: `Any ${c.label.toLowerCase()}`,
          words: behind.get(c.id) || 0,
        }))
        .concat([{
          name: WORD_SLOT,
          what: "Any single word",
          words: behind.get(WORD_SLOT) || 0,
        }]),
    [lang, behind],
  );

  const fillsOffer = useMemo(() => {
    const written = blanksAround.filter(
      (b) => b.name !== WORD_SLOT && (b.used > 0 || b.wrote > 0),
    );
    const held = fills
      .filter((name) => !written.some((b) => b.name === name))
      .map((name) => ({ name, words: 0, used: 0, wrote: 0 }));
    return written.concat(held).sort((a, b) => a.name.localeCompare(b.name));
  }, [blanksAround, fills]);

  /*
   * Every blank the sheet can offer, and what each of them would take.
   *
   * Four kinds of name reach a card, and they are four because each
   * answers a different question a teacher has. `{{word}}` takes anything
   * they have written. A kind of word takes the nouns, or the verbs, with
   * nothing to tick. A group tag takes the cards that say they are in the
   * group. And a card's own ID takes that one card and no other. Which is
   * which matters on this list and nowhere else: the trainer fills a hole
   * from whatever says it fills it, and `fillsOf` is the one answer to
   * that — this is a way of choosing a name, not a second opinion about
   * what a name means.
   *
   * A sentence's ID is not offered. A sentence fills nothing, so a blank
   * asking for one by name would be a hole nothing could ever stand in;
   * and this card's own ID least of all, which would be a sentence inside
   * itself.
   */
  const blankOffer = useMemo(() => {
    const named = (id: string) =>
      (categoriesOf(lang).find((c) => c.id === id) || { label: id }).label;
    /* How many words are behind each name — `behind`, which counts the way
       the question will: through fillsOf, and once for the whole screen. */
    const rows: BlankOffer[] = [];
    for (const b of blanksAround) {
      const words = b.words;
      if (b.built === "any") {
        rows.push({ name: b.name, kind: "any", words, note: "Any word in the language" });
      } else if (b.built === "category") {
        rows.push({ name: b.name, kind: "category", words, note: `Any ${named(b.name).toLowerCase()}` });
      } else if (b.used > 0 || b.wrote > 0) {
        rows.push({ name: b.name, kind: "group", words, note: "The cards tagged with it" });
      }
    }
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      if (card && c.id === card.id) continue;
      if (isSentence(c)) continue;
      const own = cardRef(c);
      if (!own || rows.some((r) => r.name === own)) continue;
      const word = leadOf(c);
      rows.push({
        name: own,
        kind: "card",
        words: behind.get(own) || 1,
        note: [word.ar, word.en].filter(Boolean).join(" · ") || "This card alone",
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [blanksAround, behind, allCards, lang, card]);

  /*
   * The words each of this card's blanks can be filled with, today.
   *
   * Worked out once and read three ways — the example sentences below, the
   * blanks nothing fills yet, and the list a teacher gets by hovering a
   * blank. It was worked out twice, identically, by the first two of those,
   * which is two answers to one question waiting to disagree.
   */
  /* Against the blanks rather than against `main`, which is a new object
     on every keystroke: what comes back is a function of the names in the
     holes, the tenses they ask for and the collection, and fillersFor reads
     nothing else off the form it is handed. */
  const fillers = useMemo(() => {
    if (scene || !holes.length) return {} as Record<string, Value[]>;
    return fillersFor(main, allCards || [], lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, holes, rowsKey, allCards, lang]);

  /*
   * And which of those blanks have words with tenses behind them — the
   * ones there is anything to ask a teacher about.
   *
   * Asked of the collection rather than of the blank's name, so a teacher
   * who gathers their verbs under a tag of their own is asked too; empty in
   * a language whose verbs take one form, where the question means nothing.
   * See tensedBlanks, which is the one answer to it.
   */
  const tensed = useMemo(() => {
    if (scene || !holes.length) return new Map<string, VerbSpec>();
    return tensedBlanks(main, allCards || [], lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, holes, allCards, lang]);

  /*
   * How many sentences this card is met as: every word behind one blank,
   * every pair of words behind two, and so on — which is what `{{noun}}
   * {{adjective}}` costs a teacher who writes it, in one number, and the
   * one thing the section could never say while it printed three examples
   * and stopped. Counted rather than built, so it is there while the list
   * below it is still folded away.
   */
  const combos = useMemo(
    () => (scene ? 0 : combosOf(holes, fillers)),
    [scene, holes, fillers],
  );

  /*
   * The sentences a student will be asked, filled from the words that
   * exist today.
   *
   * This is the explanation the section used to attempt in ninety words.
   * All of them, in a subsection of their own that opens folded: three
   * examples read as "and so on" and answered nothing beyond it, and the
   * question a teacher actually has — is the right vocabulary behind this
   * blank, and does every one of these sentences say something — is asked
   * of the whole list or not at all.
   *
   * How the list is built, what shortens it and what it does with a field
   * nothing fills are all `examplesOf` in card-facts.ts, which the
   * view-only screen draws the same sentences with. Two accounts of what a
   * teacher has written is one too many.
   *
   * Built where it is read — see BlanksBlock, which knows whether the
   * section is open — and not here, where nothing knew. A frame the whole
   * collection fills is met as hundreds of sentences, each of them three
   * strings to fill and compare, and all of them were being built on
   * every keystroke in any field of the card, behind a fold that was shut.
   * The count above is what the shut section shows, and that is counted
   * rather than built.
   */

  /* Which blanks have nothing to put in them — the reason a card with a
     hole in it is never asked, named rather than left to be discovered. */
  const starved = useMemo(
    () => holes.filter((slot) => !(fillers[slot] || []).length),
    [holes, fillers],
  );
  const setForm: (i: number, next: any) => void = (i, next) => setForms((f) => f.map((x, j) => (j === i ? next : x)));

  /*
   * An axis that belongs to the card, answered for all of it at once.
   *
   * Person or thing is one fact with one answer — see perCard — so it is
   * written onto every form, which is where every reader of a word's
   * grammar looks, and taken off the answers, which are not where a fact
   * about the whole card belongs. A form added later starts from the
   * card's answer for the same reason: see blankForm's callers below.
   */
  const setCardDim = (field: string, value: string) =>
    setForms((f) =>
      f.map((form) => ({
        ...form,
        [field]: value,
        ...(Array.isArray(form.answers)
          ? { answers: form.answers.map(withoutCardDims(cardDims(lang, null))) }
          : null),
      })),
    );
  /* What the card says today, read off its own word: every form carries
     the same answer, and the lead form is the one that cannot be removed. */
  const cardGrammar = (): Record<string, string> => {
    const lead = forms[0] || {};
    const out: Record<string, string> = {};
    for (const dim of cardDims(lang, null)) out[dim.field] = String(lead[dim.field] || "");
    return out;
  };

  /*
   * Take a blank out of a form, in all three of its fields at once.
   *
   * The cross on a pill, and backspace beside one. The other half of the
   * bar under each field: putting a blank in is a tap per field because a
   * teacher may want it in a different place in each of them, and taking
   * one off is one gesture because there is no such thing as taking it off
   * *somewhere*. A form and not the card, because "every field with words
   * in it leaves the same blanks" is a rule about one form's fields —
   * slotTrouble reads a form — and a second way of saying the same word
   * may leave its blanks somewhere else.
   *
   * withoutSlot is what closes the gap it leaves, as it does for every
   * other writer of a blank.
   */
  const dropBlank = (at: number, name: string) => {
    setForms((f) =>
      f.map((form, i) =>
        i === at
          ? {
              ...form,
              ar: withoutSlot(form.ar, name),
              en: withoutSlot(form.en, name),
              lat: withoutSlot(form.lat, name),
            }
          : form,
      ),
    );
  };

  /*
   * And the ID, which a card may have and does not need.
   *
   * It is a name for reaching *this one card* from somebody else's blank —
   * `{{colour-red}}` rather than any colour — and most cards are never
   * reached that way. A card is its words; a name for pointing at it is a
   * thing a teacher wants when they are writing the sentence that points,
   * which is usually another day.
   *
   * Every new card was made to have one, which made the commonest job on
   * the screen — write a word, save it — wait on a decision about a card
   * that did not exist yet, with a Save that stayed grey and nothing
   * saying why. The one part of this that was ever load-bearing is the
   * other half: a name that is **taken** stops a save whatever the card's
   * age, because two cards answering to one `{{x}}` is the one thing an ID
   * is for preventing. That half stands.
   */
  const refOk = !refName || refFree;
  /* What the card is short of, where it is a verb the table stands in for:
     the two things such a card is held to, each said where it is asked for
     rather than both at the foot of the table. */
  const needsName = standsIn && !name.trim();
  const needsForm = standsIn && !tableCells.some(
    (c) => String(c.ar || "").trim() && String(c.en || "").trim(),
  );
  const canSave = (standsIn ? canSaveVerb(name, tableCells, trouble) : canSaveWord(main, trouble))
    && refOk && !strayHoles.length;

  /* Another form, named so that its own cells can point at it. No number
     override beyond the name: blankForm takes the language's declared
     default, so what a new form starts as is settled in one place. What
     the card has already said about itself comes with it, though — a
     plural of the word is as much a person as the word is, and a form
     starting on the default would be the card disagreeing with itself
     about something it was never asked twice. */
  const addForm = () =>
    setForms((f) => f.concat([{ ...blankForm(), ...cardGrammar(), id: formName(f) }]));
  /* A second form usually differs from the first in a field or two, so it
     starts from the one in hand rather than empty, directly beneath its
     source. A name of its own, no recordings and no table: the copy is a
     different word, so the original's audio and the pronouns on its end
     would both be wrong for it. */
  const duplicateForm = (i: number) =>
    setForms((x) =>
      x
        .slice(0, i + 1)
        .concat([{ ...x[i], id: formName(x), clips: [], slowClips: [] }])
        .concat(x.slice(i + 1)),
    );
  /* And the table it carried goes with it. A cell whose form has gone is a
     word with a pronoun on the end of nothing: it would be saved, drilled,
     and never opened, because what it waits on no longer exists. */
  const removeForm = (i: number) => {
    const gone = forms[i];
    setForms((x) => x.filter((_, j) => j !== i));
    if (gone && gone.id) setCells((x) => x.filter((c) => String(c.of || "") !== gone.id));
  };

  /* Which parts of this card can be asked about, and which are — see
     askParts. Read off the draft, so a form typed into a moment ago is
     listed and an empty table is not. */
  const parts = askParts({ forms, cells, spec: shownSpec });
  /*
   * Switching one of them off, or back on — either question, one path.
   *
   * The answer goes on the forms the part covers, because that is where
   * everything reads it. A part is the editor's word for a group of forms
   * and nothing more; storing the grouping as well would be a second
   * answer to what a card is made of, which is the thing this codebase
   * keeps having to remove.
   *
   * `which` names the question being answered; the other one is read off
   * the form as it stands, so answering one never silently changes the
   * other — which is exactly what an absent `lend` beside a switched-off
   * `ask` would do. setPartFlags is where that is settled.
   *
   * Two parts cover more than they appear to. Where a language cites a
   * cell of the table, the card's own word *is* that cell — one word in
   * two places — so both carry the answer and cannot come apart. And a
   * form's table of pronouns follows the form off: those wait on the word
   * they are on the end of being known, so under a form nobody is asked
   * about they could never open, and a tick that does nothing is worse
   * than no tick. Not back on with it, though: what is asked about is the
   * teacher's to say, and a table that switched itself on would be the app
   * answering for them.
   *
   * The cascade is the *asked* question's alone. Lending waits on
   * nothing: a form nobody is taught can still be the word a frame is
   * met with, which is what a value card is.
   */
  const setPart = (id: string, which: "ask" | "lend", on: boolean) => {
    const set = (f: Record<string, any>) =>
      which === "ask"
        ? setPartFlags(f, on, partLends(f))
        : setPartFlags(f, partAsked(f), on);
    /* Only the table on screen. The other one is being held aside whole,
       and is saved by nobody until it is the one being looked at. */
    const inShown = (c: Record<string, any>) =>
      !!shownSpec && rowIdsOf(shownSpec).has(String(c.row || ""));
    const isCited = (c: Record<string, any>) =>
      !!cite && c.row === cite.row && c.col === cite.col;
    /* A table, whichever form it hangs off — the card's own word where
       the id names none. Every cell but the one that is the card's own
       word, which is the line about the word. */
    if (id.startsWith("table:")) {
      const of = id.slice("table:".length);
      setCells((x) =>
        x.map((c) => (inShown(c) && !isCited(c) && String(c.of || "") === of ? set(c) : c)),
      );
      return;
    }
    const i = Number(id.slice("form:".length));
    const mine = i === 0 ? "" : String((forms[i] || {}).id || "");
    setForms((x) => x.map((f, j) => (j === i ? set(f) : f)));
    setCells((x) =>
      x.map((c) => {
        if (!inShown(c)) return c;
        if (i === 0 && isCited(c)) return set(c);
        /* A table whose cells wait on the word follows the word off: under
           a form nobody is asked about they could never open. */
        if (which === "ask" && !on && waitsOnWord(shownSpec) && String(c.of || "") === mine) {
          return setPartFlags(c, false, partLends(c));
        }
        return c;
      }),
    );
  };
  const setAskPart = (id: string, on: boolean) => {
    setSaid(true);
    setPart(id, "ask", on);
  };
  const setLendPart = (id: string, on: boolean) => {
    setSaid(true);
    setPart(id, "lend", on);
  };

  return {
    addForm,
    duplicateForm,
    removeForm,
    setCardDim,
    cardGrammar,
    drillsTranslit,
    forms,
    setForms,
    cells,
    setCells,
    mintCell,
    category,
    tableMissing,
    setCategory,
    table,
    shownSpec,
    perForm,
    cite,
    storedForms,
    categoryOffer,
    categorySaid,
    aside,
    chooseCategory,
    standsIn,
    needsName,
    needsForm,
    recordingCell,
    setRecordingCell,
    cellHere,
    note,
    name,
    setName,
    fills,
    setFills,
    canLend,
    addFill,
    dropFill,
    fillsOffer,
    defaultTags,
    refsTaken,
    ownFills,
    ref,
    setRef,
    refName,
    refHeld,
    refFree,
    refOpen,
    openRef,
    shutRef,
    savedRef,
    nameHeld,
    renameFill,
    asking,
    answerAsk,
    dropAsk,
    spread,
    stripped,
    dropping,
    askStrip,
    answerStrip,
    dropStrip,
    uses,
    setUses,
    main,
    holes,
    /* Whether the teacher has called this a sentence, which is the one
       answer to what may have a blank in it and what may not. The shape is
       the shell's state; every block below reads it from here so that none
       of them works it out again. */
    sentence: shape === "sentence",
    strayHoles,
    ownForms,
    tableCells,
    keptFrames,
    trouble,
    blanksAround,
    blankOffer,
    dropBlank,
    combos,
    starved,
    fillers,
    /* Which tenses each blank asks its verbs for, which blanks there is
       anything to ask about, and how one of them is answered. */
    blankRows,
    setBlankRow,
    tensed,
    canSave,
    setForm,
    parts,
    setAskPart,
    setLendPart,
  };
}

/** The conversation: who is in it, what is said, and whose part it is. */
export function useSceneDraft({ card }: { card: Card | null }) {
  /* ---- a conversation, where the card is one ----
     Two people and two empty turns to begin with: an empty scene with an
     "add a line" button is a form that has to be assembled before it can
     be filled in.

     Nobody's part to begin with, either. Naming one is a real decision — a
     scene where only one side is worth producing — and most are not that;
     asking for it before the second line is written is asking a question
     the teacher has no reason to have an answer to yet. Left open, the
     question takes the parts in turn. */
  const [speakers, setSpeakers] = useState(() =>
    card && (card.speakers || []).length ? (card.speakers || []).slice() : ["A", "B"]
  );
  const [you, setYou] = useState<number | null>(card ? namedPart(card) : null);
  const [lines, setLines] = useState(() => {
    /* Each turn named on the way in, the way a form is — and one written
       before turns had names is given one here, which changes nothing a
       student has done: an unrecognised name folds back to its position.
       See foldForms in shared.tsx. */
    const out: Record<string, any>[] = [];
    for (const l of card ? card.lines || [] : []) {
      out.push({ ...blankLine(out), ...l, id: String(l.id || "") || formName(out) });
    }
    if (out.length) return out;
    const first = blankLine();
    return [{ ...first, who: 0 }, { ...blankLine([first]), who: 1 }];
  });
  /* The scene's name and its setting are the card's own English and note:
     a conversation has no word of its own to put in either. */
  /* A scene's name and its setting are the card's own English and note: a
     conversation has no word of its own to put in either. */
  const [title, setTitle] = useState(String((card && leadOf(card).en) || ""));
  const [setting, setSetting] = useState(String((card && card.note) || ""));
  const [recordingLine, setRecordingLine] = useState<number | null>(null);
  const setLine: (i: number, next: any) => void = (i, next) => setLines((x) => x.map((l, j) => (j === i ? next : l)));
  const written = writtenLines(lines);
  /* Which side of the page a turn is written on, as the class that puts it
     there — empty for a scene of three or four, which stays a list. Asked
     of the draft rather than of the stored card, so the sides are the ones
     the teacher is looking at. */
  const turnSide = (who?: number) => {
    const side = sideOf({ lines, speakers }, who || 0);
    return side === null ? "" : ` side${side}`;
  };

  const canSave = canSaveScene(title, written);

  /* Another turn, said by whoever did not speak last — which is what a
     conversation does on its own. */
  const addLine = () =>
    setLines((x) =>
      x.concat([
        {
          ...blankLine(x),
          who: x.length && speakers.length > 1
            ? ((Number(x[x.length - 1].who) || 0) + 1) % speakers.length
            : 0,
        },
      ]),
    );
  const removeLine = (i: number) => setLines((x) => x.filter((_, j) => j !== i));

  return {
    addLine,
    removeLine,
    speakers,
    setSpeakers,
    you,
    setYou,
    lines,
    setLines,
    title,
    setTitle,
    setting,
    setSetting,
    recordingLine,
    setRecordingLine,
    setLine,
    written,
    turnSide,
    canSave,
  };
}

/* ------------------------------------------------------------------
   The blocks

   The editor's screen, cut at the rules it already had: each block is one
   of the framed sections a teacher sees, drawn from the draft and nothing
   else. The four editors below are lists of these.
   ------------------------------------------------------------------ */

/** What the hooks above hand out, which is what every block reads. */
export type WordDraft = ReturnType<typeof useWordDraft>;
export type SceneDraft = ReturnType<typeof useSceneDraft>;

/*
 * What kind of card this is — the first thing about it, and for a new one
 * the first decision — then what a word lays its forms out in, and which
 * decks it goes in. The one block every editor shares, drawn by the shell.
 */
/*
 * What kind of word this is: a list to choose from, and then the answer.
 *
 * The list is the language's own — noun, verb, adjective, name — and every
 * answer carries a line saying what it means, which is why it is a list of
 * rows rather than a track of segments. It was a column of those rows
 * standing open on the screen, which is right while the question is being
 * answered and wrong every other time: on most cards it is answered once
 * and then read, and five rows of radio buttons above the word itself is
 * five rows of a decision nobody is making, in the way of the fields they
 * came to fill in.
 *
 * So it is a drop-down. Answered, it shuts to the answer with a pencil on
 * the end — the same row the card's ID wears, because it is the same
 * state: a thing decided once, read often, and changed on purpose rather
 * than by a stray tap. Unanswered, it is the button that opens the list,
 * and says so.
 *
 * Which answers the list holds is categoryOffers, and where it holds none
 * this draws nothing: a card whose table only one kind lays out is not
 * asked a question with one answer.
 */
/* What answering it gets you, said before it is answered: the answer
   decides which fields, which forms and which table the card is laid out
   with, and none of that is guessable from the list of words. */
const SUBTYPE_LEDE = "Each subtype has specific fields, forms, structures, etc.";

function WordKind({ word }: { word: WordDraft }) {
  const { category, chooseCategory, categoryOffer, categorySaid } = word;
  const { open, setOpen, mine } = usePicker();
  const said = categoryOffer.find((c) => c.value === category) || null;
  /*
   * Where there is nothing to choose between, the answer is shown and not
   * asked.
   *
   * A saved card whose table only one kind of word lays out — a verb, in
   * every pack today — is offered no list, because offering a kind that
   * lays out another table is offering to throw the table away and a list
   * of one is not a question. This section used to disappear with the
   * list, so a teacher opening a verb they had saved was shown no answer
   * to *what kind of word is this* at all, and the card's plainest fact
   * went missing from the one screen that knows it.
   *
   * So it reads the way the kind of card above it reads when it is
   * settled: the answer, with a padlock where the pencil would be. What
   * would unlock it is emptying the table. A verb no longer spells that
   * out at the foot of the block (see storedHelp); other tables still do.
   *
   * Nothing at all only where there is nothing to say: a conversation and
   * a sentence are not kinds of word, and a card whose language declares
   * no kinds has never been asked.
   */
  if (!categoryOffer.length) {
    if (!categorySaid) return null;
    return (
      <div className="at-field at-mt3">
        <label className="at-label">What subtype</label>
        <p className="at-fieldlede">
          The subtype cannot be changed while the card carries its table.
        </p>
        <div className="at-shutrow">
          <Icon name="tune" />
          <span className="at-shutname">{categorySaid.label}</span>
          <span className="at-shutlock" aria-hidden="true">
            <Icon name="lock" />
          </span>
        </div>
      </div>
    );
  }
  /* Shut is the state an answered question sits in, and the pencil is the
     way back into it — so the list is on screen only while it is being
     read, and the answer is on screen the rest of the time. */
  if (said && !open) {
    return (
      <div className="at-field at-mt3">
        <label className="at-label">What subtype</label>
        <p className="at-fieldlede">{SUBTYPE_LEDE}</p>
        <div className="at-shutrow">
          <Icon name="tune" />
          <span className="at-shutname">{said.label}</span>
          <IconButton
            icon="edit"
            label="Change what subtype this card is"
            onClick={() => setOpen(true)}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="at-field at-mt3">
      <label className="at-label">What subtype</label>
      <p className="at-fieldlede">{SUBTYPE_LEDE}</p>
      <div className="at-chooser" ref={mine}>
        <button
          className={`at-choosebtn${said ? " on" : ""}`}
          aria-expanded={open}
          aria-label={
            said
              ? `What subtype — ${said.label}. Choose another.`
              : "What subtype. Nobody has said. Choose one."
          }
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="tune" size={16} />
          <span className="at-choosemark">{said ? said.label : "Not said yet"}</span>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
        </button>
        {open && (
          <div className="at-choosemenu">
            {/* Choosing shuts it, because choosing is the whole of what it
                was open for — and what follows from the answer is a table
                appearing further down the screen, which a menu standing
                over it would hide. */}
            <RadioGroup
              quiet
              label="What subtype"
              name="card-category"
              options={categoryOffer}
              value={category}
              onChange={(v) => {
                chooseCategory(v);
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/*
 * What is true of the word itself, under the answer that decides whether
 * it is asked at all.
 *
 * Whether a noun is a person or a thing is not a fact about one of its
 * spellings, or about its singular as against its plural: it is one fact
 * about the card, and what it decides is what agrees with it — in Arabic a
 * plural of things takes the feminine singular adjective and a plural of
 * people the plural. It was asked of every accepted answer of every form,
 * which is a card invited to disagree with itself about something it
 * cannot disagree about, and asked where nobody would look for it.
 *
 * Here, because here is where the question it follows from was answered: a
 * noun is asked, and nothing else is. Which axes those are is the
 * language's to say — see perCard — so nothing here names one.
 *
 * Silent until the kind of word is settled, where the language has kinds
 * to offer: the axes are read off that answer, so asking before it is
 * given would be asking on the strength of the whole pack's list.
 */
function WordGrammar({ lang, word }: { lang: Lang; word: WordDraft }) {
  const { category, categoryOffer, cardGrammar, setCardDim } = word;
  const dims = cardDims(lang, category);
  if (!dims.length || (categoryOffer.length && !category)) return null;
  /* Named for the kind of word it is about, because that is what decides
     which axes these are — and where there is only one of them, the field's
     own name is the question, so the axis does not say it again over a row
     of two radios. A language declaring two gets its names back. */
  const only = dims.length === 1 ? dims[0] : null;
  return (
    <Field
      label={`${categoryLabel(lang, category) || "Word"} property`}
      lede={only ? only.help : ""}
      className="at-mt3"
    >
      <GrammarRadios dims={dims} values={cardGrammar()} onPick={setCardDim} bare={!!only} />
      {only ? null : (
        <Help>
          True of the whole card, its other forms included. It is what the
          words beside it agree with.
        </Help>
      )}
    </Field>
  );
}

function KindBlock({ card, lang, scene, shape, word, naming, decks, chosen, onToggleDeck }: {
  card: Card | null;
  lang: Lang;
  scene: boolean;
  shape: CardShape;
  word: WordDraft;
  /** Whether this card is one whose own words do not name it, and which of
      the two it is — the wording is all that turns on the answer. Decided
      by the editor, which is where the kinds of card are told apart; null
      on a card named by its own word. See NameBlock. */
  naming: "verb" | "sentence" | null;
  decks: Deck[];
  chosen: string[];
  onToggleDeck: (id: string, on: boolean) => void;
}) {
  const { aside, storedForms } = word;
  return (
    <>
    {/* What kind of card this is — the first thing about it, and no
        longer a question here: it is answered before this screen opens
        and cannot be answered again. See NewCardKind, and shapeChoices
        for why it is settled once.

        What a *word* lays out is a different question and is asked
        underneath. The two were one control for a release — a verb was a
        third answer beside Word and Conversation — and it stopped working
        the moment there was a second table to offer: four answers on a
        track that already ran off a phone at three, and a list mixing "a
        different shape of card" with "a word with more said about it". */}
    <div className="at-formblock">
      <div className="at-formhead">
        <span className="at-formnum">This card</span>
      </div>

      {/* What kind of card it is, as a fact on the screen rather than as a
          line of grey beside the heading. It used to be the heading's own
          gloss, with two paragraphs under it saying it could not be
          changed; it is one answered question now, in the shape every
          answered question on this screen wears — the answer, read, with
          what would open it again on the end. What is on that end here is
          a padlock, because nothing opens it. */}
      <Field label="What type of card" lede="The type of card cannot be changed">
        <div className="at-shutrow">
          <Icon name="cards" />
          <span className="at-shutname">{shapeLabel(shape)}</span>
          <span className="at-shutlock" aria-hidden="true">
            <Icon name="lock" />
          </span>
        </div>
      </Field>

      {/* ---- and what kind of word it is ----

          Noun, verb, adjective, name — the language's own list. It is
          the one thing about a card no amount of reading the script
          will tell you, and until 0.137 it was guessed from whichever
          table happened to have something in it.

          What follows from it is the table: a verb is offered its
          persons and tenses, a noun and a preposition the pronouns
          that go on their end. Nothing is stored saying "verb" — the
          table is still read off the rows its cells sit in — so the
          answer only decides what the teacher is shown.

          Asked only of a word: a conversation has turns where a word
          has forms, and there is nothing for a table to lay out. */}
      <WordKind word={word} />
      {/* ---- and what it is called ----

          Directly under the subtype, because it is the same sort of thing:
          one fact about the whole card, settled once and then read. It
          belongs to the card rather than to any of its words — which is
          exactly why the card's own words cannot supply it — so it is asked
          here with the other facts about the card, and not in a framed
          section of its own halfway down the screen. */}
      {naming && <NameBlock word={word} of={naming} />}
      {/* And what follows from the answer that is about the word rather
          than about its forms — see WordGrammar. Under the kind because it
          is asked on the strength of it: a noun is asked whether it is a
          person or a thing and nothing else is. */}
      {shape === "word" && <WordGrammar lang={lang} word={word} />}
      {/* A table put aside is not thrown away until the card is saved, and
          saying so is the only warning there is. Outside the question
          above rather than inside it, because it is about what the card
          holds rather than about the answer: what put the table aside was
          answering that question, and what brings it back is answering it
          again. */}
      {aside > 0 && (
        <p className="at-formneed unmet">
          {word.shownSpec ? "Its other table is" : "Its table is"} put aside —{" "}
          {plural(aside, "box", "boxes")} filled in. Saving it this way drops them.
        </p>
      )}
      {/* And where it cannot be asked, because the card already has
          one: the table is the content, so offering the change would
          be offering to throw it away. */}
      {!scene && storedForms && storedHelp(specOf(lang, storedForms)) && (
        <Help className="at-mt3">{storedHelp(specOf(lang, storedForms))}</Help>
      )}

    </div>

    {/* ---- and where it goes ----

        The other fact about the card rather than about its words, and the
        one that decides whether anybody ever sees it — so it is a section
        of its own, directly under what kind of card this is. It was a
        control at the foot of that block, where it read as one more thing
        about the kind rather than as the question it is. */}
    <div className="at-formblock at-mt5">
      <div className="at-formhead">
        <span className="at-formnum">Decks</span>
        <span className="at-formrole">Manage what decks this card belongs to.</span>
      </div>
      <DeckSwitch decks={decks} chosen={chosen} onToggle={onToggleDeck} />
    </div>
    </>
  );
}

/* What a saved card's table makes it, in the words the table gives. A
   verb says nothing: the padlock on its subtype already says why it is
   settled, and the line spelling out what a verb is only got in the way. */
const storedHelp = (spec: VerbSpec | null): string => {
  if (!spec) return "";
  if ((spec.gate || "word") === "rows") return "";
  const name = spec.label ? spec.label[0].toUpperCase() + spec.label.slice(1) : "Its table";
  return spec.perForm
    ? `${name}: every form of the word carries a table of them, each one practised in its own right. Empty the tables and it is an ordinary word again.`
    : `${name}: the word, with a table of them beside it, each practised in its own right. Empty the table and it is a word again.`;
};

/*
 * What to call a card its own words do not name.
 *
 * Two cards are in that position and they got there the same way: what is
 * saved on them is not what they are about. A verb in a language with no
 * infinitive is saved as the cell a dictionary lists, and a sentence is
 * saved as a frame with a hole in it. One field, asked in both places,
 * because it is one question — what goes at the top of the tile — and a
 * teacher who has met it on a verb has met it here.
 *
 * Which of the two is asking decides only the wording: what a blank one
 * falls back to is the one thing the teacher needs told, and it is a
 * different sentence in each place. The editor says which it is; nothing
 * here reads the card to find out.
 *
 * A field rather than a section of its own. What a card is called is a fact
 * about the card, in the same class as what kind of card it is and what
 * kind of word — so it is asked where those are asked, under the answer it
 * follows from, and wears the same heading they do. A framed block with one
 * text box in it, standing between the card and its words, read as a stage
 * of the form rather than as the label it is.
 */
function NameBlock({ word, of }: { word: WordDraft; of: "verb" | "sentence" }) {
  const { shownSpec, name, setName, needsName } = word;
  const verb = of === "verb";
  /* A verb only where the table stands in for the card's own word. Where a
     language cites nothing — Huế cites the bare verb — the card has a word
     of its own and is named by it. A sentence always: every one of them is
     a frame, which is the whole of what a sentence is. */
  if (verb && (!shownSpec || !citationOf(shownSpec))) return null;
  return (
    /* ---- what to call it ----

       A verb in a language with no infinitive has no one word of its
       own: it is a table, and every box in it is a form. So a list had
       to show one of those boxes — "past · he" — and a deck of verbs
       read as a column of he-pasts, each naming one form rather than
       the verb the card is about. A sentence is listed as itself,
       braces and all: "{{name}} is heavy" names the shape of the card
       rather than what it is for, and every frame in a deck reads as
       the hole in it. Nothing is wrong with either card; neither
       simply has a name of its own to be listed under.

       **Which is why a verb is asked for one and a sentence is not.**
       A sentence that goes unnamed is listed as the sentence, which is
       its own words and says something; a verb that goes unnamed would
       be listed as whichever box somebody happened to fill in first.
       So the one that has nowhere to fall back to is the one it is
       required of — see canSaveVerb, which is where that is settled.

       Not the block 0.114 took away. That one asked for the script,
       the pronunciation, the English and the recordings a second
       time, and the two copies had to be kept in step by hand. This
       asks for one thing the card cannot supply, and nothing is
       drilled on it: it is a label, and the microcopy says so. */
    <Field
      label="Name"
      lede="How this card is listed and searched."
      className="at-mt3"
    >
      <input
        className="at-input"
        value={name}
        placeholder={verb ? "to eat" : "saying where you live"}
        onChange={(e) => setName(e.target.value)}
      />
      {/* Only while it is in the way, like every other line that unblocks
          Save on this screen: a demand standing there before anybody has
          typed reads as a telling-off for opening the screen. */}
      {needsName && (
        <p className="at-formneed unmet">
          A verb is listed as its name, so it needs one — nothing else on
          the card can stand for the whole of it.
        </p>
      )}
      {!verb && (
        <Help>
          Without one it is listed as the sentence itself, blanks and all
          — which names the shape of the card rather than what it is for.
          Nobody is ever asked this: what is practised is the sentence
          with its blanks filled in.
        </Help>
      )}
    </Field>
  );
}

/* The table a card carries — a verb's, an adjective's — and the one line
   that unblocks Save while the whole of it is empty. */
/* A cell nobody has written yet, so an unwritten shape is still something
   ScriptAnswers can open on. Shared and never changed: writing goes
   through writeCell, which mints the real one. */
const NO_CELL: Record<string, any> = {};

/*
 * The other forms a word takes, each a section of its own.
 *
 * This took four goes. They sat under a heading of their own further down
 * the page, as though they were a second subject; then they were written
 * as full blocks, which put them where they belong and made three shapes
 * of one word take three screens; then they went short, as a name and
 * three small boxes, which read as a list but said these were something
 * less than the word above them; then the word was folded into that list,
 * which cost it a second accepted answer and its recordings.
 *
 * The answer was that the boxes were too big, not that a shape of a word
 * is a lesser thing. They are a section each now, written in exactly the
 * fields the card's own word is written in — the same component, the same
 * accepted answers, the same recording per answer — and the boxes are the
 * short ones the whole editor now uses. A feminine is a form of the word
 * in every sense the app has, and it is worth the same room.
 *
 * Which shape each section is, is the language's word for it: the column
 * labels a pack declares. Nothing here is written in the editor's voice.
 *
 * The grid stays where a grid earns its keep: a verb's persons and tenses,
 * and the pronouns on the end of every form of a word. Twenty-four cells
 * are a table; three are three forms.
 */
function AgreementFields({ word, lang }: { word: WordDraft; lang: Lang }) {
  const { shownSpec, cells, setCells, mintCell, drillsTranslit } = word;
  if (!shownSpec || shownSpec.perForm) return null;
  const rows = tensesOf(shownSpec);
  const persons = personsOf(shownSpec);
  /* A table with one row says nothing by naming it — an adjective's row is
     called "agreement", which is the table and not a fact about the cell.
     Two or more and the row is half of where a cell sits, so it is said. */
  const named = rows.length > 1;
  const at = (row: string, col: string) =>
    cells.find((c) => c.row === row && c.col === col && !String(c.of || "")) || NO_CELL;

  return (
    <>
      {rows.flatMap((row) =>
        persons.map((person) => {
          const name = person.label || person.id;
          const which = named ? `${row.label} · ${name}` : name;
          return (
            <div className="at-formblock at-formtile" key={`${row.id}|${person.id}`}>
              <FormFields
                lang={lang}
                form={at(row.id, person.id)}
                /* None. What this shape is grammatically is the column it
                   is in — that is the whole of what the table says — and
                   asking a teacher to say it again under the box would be
                   the screen asking a question it already knows. */
                dims={[]}
                of={which}
                title={cap(which)}
                drillsTranslit={drillsTranslit}
                onChange={(patch) =>
                  setCells(writeCell({ cells, of: "", mint: mintCell }, row.id, person.id, patch))
                }
              />
            </div>
          );
        }),
      )}
    </>
  );
}

/*
 * How the card is practised, once rather than form by form.
 *
 * On a card that can hold only the one form, "this form" and "this card"
 * are the same thing, and the ticks were tucked at the foot of the word's
 * own fields as though they were another field of it. They are not: they
 * are the answer to a question about the whole card, and on a card whose
 * table is written there are two of them — the word, and the shapes beside
 * it — which belong beside each other rather than a screen apart.
 */
function PracticeSection({ word }: { word: WordDraft }) {
  const { parts } = word;
  if (!parts.length) return null;
  return (
    <div className="at-formblock at-mt5">
      <div className="at-formhead">
        <span className="at-formnum">How this card can be practiced</span>
      </div>
      {parts.map((part) => (
        <DrillChecks
          key={part.id}
          word={word}
          part={part}
          /* Named only where there is more than one answer to give: a card
             with a word and nothing else has one, and a heading over a
             single pair of ticks is the screen saying its own name twice. */
          label={parts.length > 1 ? part.title : ""}
        />
      ))}
    </div>
  );
}

function TableBlock({ word, lang }: { word: WordDraft; lang: Lang }) {
  const { shownSpec, parts, cells, setCells, mintCell, setRecordingCell, needsForm } = word;
  /* The table's own line of what is drilled — see askParts, which lists
     nothing for a table nobody has written yet. */
  const mine = parts.find((p) => p.id === "table:");
  if (!shownSpec || shownSpec.perForm) return null;
  return (
    <>
    {/* ---- the verb's table ----
        The question that opens this is the selector in the block above,
        where the other question about what a card is lives. Nothing
        here but the table: what a blank cell means and which rows
        open first are read off the table itself — an empty box is
        plainly an empty box, and the rows are labelled in the order
        they are taught. */}
      <>
        <VerbTable
          lang={lang}
          spec={shownSpec}
          cells={cells}
          mint={mintCell}
          onChange={setCells}
          onRecord={(row, col) => setRecordingCell({ of: "", ofLabel: "", row, col })}
        />
        {/* Only when it is in the way, and never about one box. It
            used to read "Fill in past · he, plus its English" — the
            cell a dictionary lists the verb under, demanded because
            that cell was also the card's own word. It is an ordinary
            cell now: any one of them, written with its English, is a
            verb worth saving, and which one is the teacher's
            business. A Save that stays grey with nothing saying why
            is worse than a line, so the line is here at the moment it
            is true and not before. */}
        {needsForm && (
          <p className="at-formneed unmet">
            Write at least one form of the verb, with its English. Any of
            them — the table is filled in as you teach it.
          </p>
        )}
        {/* And whether the table is drilled, under the table rather than
            in a list at the bottom of the screen. A section of its own
            because this table is the card's rather than a form's: its
            rows are the blocks above, and the answer is one answer about
            all of them. */}
        {mine && (
          <div className="at-formblock at-mt5">
            <div className="at-formhead">
              <span className="at-formnum">{mine.title}</span>
              <span className="at-formrole">{mine.note}</span>
            </div>
            <DrillChecks word={word} part={mine} label="How these forms can be practiced" />
          </div>
        )}
      </>
    </>
  );
}

/* The scene: what it is called, where it happens, who is in it, and
   whose part the student takes. */
function SceneBlock({ talk }: { talk: SceneDraft }) {
  const { canSave, title, setTitle, setting, setSetting, speakers, setSpeakers, you, setYou } = talk;
  return (
    <>
    <div className="at-formblock main">
      <div className="at-formhead">
        <span className="at-formnum">The scene</span>
        <span className="at-formrole">What it is and who is in it.</span>
      </div>
      <p className={`at-formneed${canSave ? "" : " unmet"}`}>
        A name, and two turns or more.
      </p>

      <Field label="What it is called">
        <input
          className="at-input"
          value={title}
          placeholder="At the door"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field label="Where it happens">
        <input
          className="at-input"
          value={setting}
          placeholder="Two neighbours meet in the morning"
          onChange={(e) => setSetting(e.target.value)}
        />
      </Field>

      <Field label="Who is in it">
        <div className="at-row">
          {speakers.map((name, i) => (
            <input
              key={i}
              className="at-input"
              value={name}
              placeholder={`Speaker ${i + 1}`}
              aria-label={`Speaker ${i + 1}`}
              onChange={(e) =>
                setSpeakers((x) => x.map((n, j) => (j === i ? e.target.value : n)))
              }
            />
          ))}
        </div>
        {speakers.length < MAX_SPEAKERS && (
          <Button
            variant="ghost"
            size="sm"
            className="at-mt2"
            onClick={() => setSpeakers((x) => x.concat([""]))}
            icon="add"
          >
            Add someone
          </Button>
        )}
      </Field>

      <Field label="The student plays">
        <Segmented
          label="The student plays"
          options={[
            { value: null, label: speakers.length > 2 ? "Any of them" : "Either" },
            ...speakers.map((n, i) => ({ value: i, label: n || `Speaker ${i + 1}` })),
          ]}
          value={you}
          onChange={(v) => setYou(v === null ? null : Number(v))}
        />
        <Help>
          {you === null
            ? "Whose turns the student produces when the whole scene is asked. Left open, the question takes the parts in turn — so a scene met twice has been held up from both ends. Name one where only that side is worth producing."
            : "Whose turns the student produces when the whole scene is asked. Everything else is said to them."}
        </Help>
      </Field>
    </div>
    </>
  );
}

/* Each turn sits on its speaker's side, the way the scene
    will read to a student. A column of identical blocks made
    a teacher check the "who says it" picker on every one of
    them to see the shape of what they had written; the shape
    is now the shape of the page. The blocks keep most of
    their width — a form is fields, and half a phone is not
    enough for one — so what carries the side is the indent,
    the coloured edge and the name. */

function TurnBlock({ talk, lang, allCards, selfId, index: i, line: l }: {
  talk: SceneDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
  index: number;
  line: Record<string, any>;
}) {
  const { lines, speakers, you, setLine, removeLine, setRecordingLine, turnSide } = talk;
  return (
    <>
    <div className={`at-formblock${turnSide(l.who)}`}>
      <div className="at-formhead">
        <span className="at-formnum">Line {i + 1}</span>
        <span className={`at-speaker s${(l.who || 0) % 4}`}>
          {speakers[l.who || 0] || `Speaker ${(l.who || 0) + 1}`}
        </span>
        {/* Silent where no part is named: with either side up
            for grabs, no turn is "theirs" until the question
            picks, and labelling one would be a guess. */}
        <span className="at-formrole">
          {you === null ? "" : (l.who || 0) === you ? "The student's turn." : "Said to them."}
        </span>
        <span className="at-formacts">
          {lines.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeLine(i)}
            >
              Remove
            </Button>
          )}
        </span>
      </div>

      <Field label="Who says it">
        <Segmented
          label={`Who says line ${i + 1}`}
          options={speakers.map((n, j) => ({ value: j, label: n || `Speaker ${j + 1}` }))}
          value={l.who || 0}
          onChange={(v) => setLine(i, { ...l, who: Number(v) })}
        />
      </Field>

      <Field label={lang.scriptLabel}>
        <ScriptInput lang={lang} value={l.ar} onChange={(v) => setLine(i, { ...l, ar: v })} />
      </Field>

      <Field label="English">
        <input
          className="at-input"
          value={l.en}
          aria-label={`What line ${i + 1} means`}
          onChange={(e) => setLine(i, { ...l, en: e.target.value })}
        />
      </Field>

      <Field label={lang.translitLabel}>
        <input
          className="at-input"
          value={l.lat}
          aria-label={`How line ${i + 1} sounds`}
          onChange={(e) => setLine(i, { ...l, lat: e.target.value })}
        />
      </Field>

      <div className="at-field">
        <Recordings form={l} onOpen={() => setRecordingLine(i)} />
      </div>

      {/* Which of the teacher's own words this line contains.
          Confirmed here, line by line, because a line is where
          a word actually turns up — and it is what lets a word
          be practised inside a real exchange. */}
      <WordsUsed
        lang={lang}
        text={l.ar}
        cards={allCards}
        selfId={selfId}
        chosen={l.uses || []}
        onChange={(next) => setLine(i, { ...l, uses: next })}
      />
    </div>
    </>
  );
}

/* On a verb, a form outside the table is a form nothing knows
    the person or tense of: it is never gated by its row and
    never agrees with a sentence, and a teacher who wants the
    past tense and is offered "Add a form" will use it for one.
    So a verb is not offered one — see the button below.

    Shown, though, wherever one exists. This used to be put away
    behind a reveal, which made the button a teacher pressed do
    nothing at all: it could only ever be showing while there was
    nothing to show, because a card that already had extra forms
    opened with them out. Hiding a form the card carries would
    also read as having lost it, and it is still saved.

    One form of the word: its accepted answers, its English, its recordings
    and, on the card's own word, the reference field. `title` and `role` are
    the editor's to say — "Form 2" on a word, "The verb" on a verb — and
    `children` sit after the fields, which is where a form's own pronoun
    table goes. */
/*
 * What a form is, said under its name.
 *
 * The line under a heading has room for a sentence now that it is no
 * longer squeezed in beside one, so the first form says what the ones
 * under it are for rather than leaving a teacher to find the Add button
 * and guess.
 *
 * Which means it has to know whether there *is* an Add button. A card
 * whose forms are laid out in a table has none, and the sentence written
 * for the other kind was wrong on it twice over: it pointed below at
 * nothing, and what it offered to add — a form for a different number or
 * gender — is exactly what the table under it already is. An adjective
 * read "you can add additional forms (for different numbers, gender)"
 * directly above its own feminine and plural. Such a card says `laidOut`
 * and gets the other sentence.
 */
export const formRole = (i: number): string =>
  i === 0
    ? "This is the main form of the card. You can add additional forms (for different numbers, gender, etc) below."
    : "Another form of the same card.";

/*
 * What the card's own word is called on a card whose forms are a table.
 *
 * The language's word for it — an adjective's own word is the masculine —
 * because the shapes beside it are named that way and one of the four
 * named after the screen instead was the odd one out. A table that has
 * not said keeps the app's own name rather than guessing, which is the
 * rule the dual column follows too.
 */
export const baseName = (spec: VerbSpec | null): string =>
  (spec && spec.base) || "The main form";

/*
 * One form, under its name: the language, what it means, and how it
 * sounds.
 *
 * Written once because a card has more than one kind of form and they are
 * all the same thing to write. The card's own word is one. So is each
 * shape it takes beside a noun — an adjective's feminine is a form of the
 * word in every sense that matters here, and drawing it in a smaller,
 * different set of boxes said it was something less.
 *
 * What differs between them is only where the words are read from and
 * written back to, which is the caller's business and arrives as
 * `onChange`. `children` sit at the foot, which is where a form's own
 * practice ticks go on the cards that keep them there.
 *
 * The heading is drawn here rather than by the block, and the form's
 * accepted answers are held here rather than inside ScriptAnswers, for
 * one reason: the recording button sits at the right of the heading while
 * there is a single answer to record, and beside the word it is of once
 * there are two. Whoever draws the heading has to know the count.
 */
function FormFields({ lang, form: f, dims, of = "", title, role = "", acts, drillsTranslit, blanks, onRemoveBlank, onChange, children }: {
  lang: Lang;
  form: Record<string, any>;
  /** The axes each accepted answer is asked about — see answerDims. */
  dims: GrammarDim[];
  /** Which form these boxes are, where a label has to say out loud — a
      shape of the word has three boxes with the same names as the word's
      own. Empty where there is only one form on the screen. */
  of?: string;
  /** What this form is called across the top of its block. */
  title: string;
  /** And the sentence under it, where there is anything to say. */
  role?: string;
  /** Whatever else belongs at the right of the heading — Duplicate,
      Remove. The recording button joins them there. */
  acts?: Node;
  drillsTranslit: boolean;
  blanks?: BlankWiring;
  onRemoveBlank?: (name: string) => void;
  /** What changed, to be merged into whatever holds this form. */
  onChange: (patch: Record<string, any>) => void;
  children?: Node;
}) {
  const fields = answerFields();
  const [rows, setRows] = useState(() => answerRows(f, fields));
  /* Which answer's recordings are being made, where any are. The screen is
     rendered from here rather than beside the editor's other two, because
     the rows live in this component's own state and a screen that wrote
     into the card behind them would be overwritten by the next keystroke.
     It is a Screen, so it stands over the editor wherever it is drawn. */
  const [heard, setHeard] = useState<number | null>(null);
  /* The same rule as Alternatives above, and for the same reason: these
     rows were read off the form once, and a blank written into the card
     from outside would otherwise change the card and not the screen. What
     went up is what an outside change is measured against. */
  const sent = useRef(`${f.ar || ""}\u0000${f.lat || ""}`);
  useEffect(() => {
    const now = `${f.ar || ""}\u0000${f.lat || ""}`;
    if (now === sent.current) return;
    sent.current = now;
    setRows(answerRows(f, fields));
  }, [f, fields]);
  const commit = (next: Answer[]) => {
    setRows(next);
    const packed = packAnswers(next, fields);
    sent.current = `${packed.ar}\u0000${packed.lat}`;
    onChange(packed);
  };
  const edit = (i: number, patch: Partial<Answer>) =>
    commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  /* One answer, so "record this form" and "record this answer" are the
     same thing and the button belongs with the form's own name. Two, and
     they are not: a button in the heading would be recording one of two
     words with nothing saying which, so each goes back beside the word it
     is of. The move happens at the moment a second answer appears, which
     is already the moment the block changes shape. */
  const inHead = rows.length === 1;
  const recorder = (i: number) => (
    <Button
      variant="ghost"
      size="sm"
      icon="mic"
      /* Nothing to record until there is a word to say. The same rule a
         cell of a verb's table follows — see CellFields. */
      disabled={!String(rows[i].text || "").trim()}
      aria-label={soundLabel(clipsOf(rows[i]).length, of ? `Recordings for ${of}` : "Recordings")}
      onClick={() => setHeard(i)}
    >
      {soundOf(clipsOf(rows[i]).length)}
    </Button>
  );
  return (
    <>
    {/* ---- the form, in a panel with its name across the top ----
       `evenfields` sets the three boxes of one answer to one height — see
       the stylesheet, where the reason is. Not on a sentence: its fields
       hold blanks as pills and wrap to as many lines as the sentence
       needs, and a fixed height would cut the second one off.

       The name used to stand outside the panel, at section size, with a
       rule between one form and the next. On a card with four of them
       that was four page-level headings for four boxes of two fields —
       the screen announcing each form as though it were a subject of its
       own. Inside and a size down, they are what they are: the panels are
       the forms, and the section heading above them says so once. */}
    <div className={`at-part${blanks ? "" : " evenfields"}`}>
      <div className="at-formhead">
        <span className="at-formnum">{title}</span>
        {/* Only where there is something to say. A panel whose heading is
            the language's own word for the form needs no sentence under
            it telling a teacher what they can read. */}
        {role ? <span className="at-formrole">{role}</span> : null}
        {/* Kept together so the pair stays whole and the role text beside
            them shortens instead of collapsing into a column. */}
        <span className="at-formacts">
          {acts}
          {inHead && recorder(0)}
        </span>
      </div>
      {/* An accepted answer, how it is said and how it sounds are written
          together, because one transliteration under two spellings belongs
          to one of them and lies about the other, and so does one
          recording. Where the language has no transliteration to write,
          this is the plain list it always was.

          Headed with the language and nothing else. It used to name two of
          the boxes under it — "Arabic script and transliteration" — which
          was a heading doing the work of labels and still left the box
          itself blank; the box says what it is now, in the language, and
          the heading says which language. */}
      <Field label={lang.scriptLabel}>
        <ScriptAnswers
          lang={lang}
          dims={dims}
          rows={rows}
          of={of}
          onEdit={edit}
          onCommit={commit}
          onRecord={setHeard}
          ownRecorders={!inHead}
          blanks={blanks}
          onRemoveBlank={onRemoveBlank}
        />
        {!drillsTranslit && (
          <Help>
            {lang.name} is written in the Latin alphabet, so the{" "}
            {lang.translitLabel.toLowerCase()} is never asked for — it is kept
            beside the answer it belongs to, and read.
          </Help>
        )}
      </Field>

      <Field label="English">
        <Alternatives
          value={f.en}
          of={of}
          onChange={(v) => onChange({ en: v })}
          render={(v, set, label) =>
            blanks ? (
              <BlankField wiring={blanks} value={v} onChange={set} label="English" lang={lang}>
                {(box) => (
                  <BlankText
                    box={box}
                    className="at-input"
                    label="English"
                    value={v}
                    onChange={set}
                    onRemove={onRemoveBlank}
                  />
                )}
              </BlankField>
            ) : (
              <input
                className="at-input"
                aria-label={label}
                value={v}
                onChange={(e) => set(e.target.value)}
              />
            )
          }
        />
      </Field>

      {/* No Recordings field here. It stood level with the English, which
          said a recording was a third thing the card had beside the word
          and its meaning — and gave a card with two accepted answers one
          set of clips over the pair. It is the form's, at the right of the
          form's own name; where there are two answers it is each answer's,
          beside the word it is of. */}

      {children}
    </div>
    {heard !== null && rows[heard] && (
      <RecordingScreen
        title={rows.length > 1 ? `Recordings · accepted answer ${heard + 1}` : "Recordings"}
        form={rows[heard] as { clips?: string[]; slowClips?: string[] }}
        onChange={(next) => edit(heard, next)}
        onClose={() => setHeard(null)}
      />
    )}
    </>
  );
}

/*
 * The section the card's forms live in.
 *
 * One heading over all of them, at the size the card's other sections are
 * headed. Before it there was none: each form was a section of the screen
 * in its own right, ruled off from the one above, with its name set at
 * page-heading size — which on a card with four forms was the screen
 * announcing four subjects where there is one.
 *
 * The panels are the forms now, close together with nothing between them,
 * and this says once what they all are.
 */
function FormsSection({ children }: { children?: Node }) {
  return (
    <div className="at-formblock">
      <div className="at-formhead">
        <span className="at-formnum">Forms</span>
      </div>
      {children}
    </div>
  );
}

/*
 * The one thing kept about the card's own word that is never asked.
 *
 * A Vietnamese noun's classifier: part of knowing the word, and not an
 * answer to anything — so it sits under a line saying as much rather than
 * among the fields a student will meet. Number and gender used to stand
 * here too, one set for the whole form. They belong to an answer — two
 * spellings are two words, and one of them may be the feminine — so they
 * went up beside the answer they are about, and the transliteration with
 * them.
 *
 * Written on its own because two screens show it: a form block, and the
 * one list a card whose forms are a table is written as. No pack today
 * has both a classifier and such a table, and the day one does, the field
 * should be there rather than quietly gone.
 */
function ReferenceField({ word, lang }: { word: WordDraft; lang: Lang }) {
  const { forms, setForm } = word;
  const f = forms[0];
  const lexical = lang && lang.lexical;
  if (!f || !lexical) return null;
  /* No ticks under this one: it is never drilled and never lent, and the
     name across the top is the whole of what there is to say. */
  return (
    <div className="at-part">
      <p className="at-groupline">Reference — never drilled</p>
      <Field label={lexical.label}>
        <input
          className="at-input"
          value={(f as any)[lexical.key] || ""}
          placeholder={lexical.help || ""}
          onChange={(e) => setForm(0, { ...f, [lexical.key]: e.target.value })}
        />
      </Field>
    </div>
  );
}

function FormBlock({ word, lang, index: i, form: f, title, role, of = "", canCopy = true, drills = true, blanks, children }: {
  word: WordDraft;
  lang: Lang;
  index: number;
  form: Record<string, any>;
  title: string;
  role: string;
  /** What to call this form's boxes out loud, where the screen holds
      several blocks of identical fields — see FormFields. Empty on a card
      whose word is the only form written this way. */
  of?: string;
  /**
   * Whether this form may be copied into another.
   *
   * False on a card whose forms are a table. Add-a-form was taken off
   * those cards on the grounds that the table is the forms and a second
   * spelling is an accepted answer — and Duplicate was left alone on the
   * grounds that it is "a way out for somebody who has one, rather than
   * an invitation to everybody who has not". That reasoning holds on a
   * plain card, where Duplicate is only ever met on a second form somebody
   * went and made. It does not hold here: the card's own word is a form
   * block, so the invitation was on every adjective in the app, under a
   * line telling teachers to accept it. Shutting the front door and
   * leaving the side door open is not shutting the door.
   *
   * A form such a card already carries keeps its Remove: no new way in,
   * and the way out stays.
   */
  canCopy?: boolean;
  /**
   * Whether the ticks that say how this form is practised sit at the foot
   * of its fields.
   *
   * False where the card gathers them into a section of its own — see
   * PracticeSection, which is what a card that can hold only one form
   * does with them.
   */
  drills?: boolean;
  /* Handed down only by the sentence editor: a blank belongs in a sentence
     and nowhere else, so the bar is not drawn on a word, a verb or a
     conversation. What refuses a blank on those is the save — see
     `strayHoles` — and this is the other half of the same rule, which is
     that a teacher is never offered what they will then be refused. */
  blanks?: BlankWiring;
  children?: Node;
}) {
  const { drillsTranslit, parts, setForm, duplicateForm, removeForm, dropBlank } = word;
  /* This form's own two answers — see askParts, which lists one line per
     form whether or not anything is written in it yet: the answer is
     about the form, and a card being written from scratch should be able
     to say what it is for before it says what it is. */
  const mine = parts.find((p) => p.id === `form:${i}`);
  /*
   * The cross on a blank takes it out of this form's three fields, not out
   * of the one it was tapped in.
   *
   * A blank is a fact about the sentence: "every field with words in it
   * leaves the same blanks" is what the save has always insisted on, and
   * the bar under each field is there to make agreeing a tap. A cross that
   * took a blank out of the English alone would put the card straight back
   * into the state the whole section exists to keep it out of, and leave
   * the teacher two more crosses to find.
   */
  const takeOff = (name: string) => dropBlank(i, name);
  return (
    <>
  <div className={`at-formblock at-formtile${i === 0 ? " main" : ""}`}>
    <FormFields
      lang={lang}
      form={f}
      dims={answerDims(lang, word.category)}
      of={of}
      title={title}
      role={role}
      acts={
        <>
          {/* A second form usually differs from the first in a field
              or two, so start it from the one in hand rather than
              empty. The copy lands directly beneath its source, where
              the eye already is. Recordings are not carried over: the
              copy is a different word, so the original's audio would
              be wrong for it, and a wrong recording is worse than a
              missing one. */}
          {canCopy && (
            <Button variant="ghost" size="sm" onClick={() => duplicateForm(i)}>
              Duplicate
            </Button>
          )}
          {i > 0 && (
            <Button variant="ghost" size="sm" onClick={() => removeForm(i)}>
              Remove
            </Button>
          )}
        </>
      }
      drillsTranslit={drillsTranslit}
      blanks={blanks}
      onRemoveBlank={takeOff}
      onChange={(patch) => setForm(i, { ...f, ...patch })}
    >
      {/* And whether this form is drilled, at the foot of the fields it is
          about rather than in a list at the bottom of the screen. */}
      {drills && mine && <DrillChecks word={word} part={mine} />}
    </FormFields>

    {i === 0 && <ReferenceField word={word} lang={lang} />}

    {children}
  </div>
    </>
  );
}

function PronounTable({ word, lang, index: i, form: f }: {
  word: WordDraft;
  lang: Lang;
  index: number;
  form: Record<string, any>;
}) {
  const { forms, parts, shownSpec, cells, setCells, mintCell, setRecordingCell } = word;
  if (!shownSpec || !shownSpec.perForm) return null;
  const of = i === 0 ? "" : String(f.id || "");
  /* This table's own line of what is drilled. Absent while the table is
     empty, and absent again once the form above it is switched off —
     these wait on that word being known, so there would be nothing for a
     tick to open. See askParts. */
  const mine = parts.find((p) => p.id === `table:${of}`);
  const written = cellsIn({ subs: cells }, shownSpec, of).some(
    (c) => String(c.ar || "").trim() || String(c.en || "").trim(),
  );
  /* ---- the pronouns this form takes on its end ----

      Part of the form rather than a section beside it, which is
      what it is: the singular has its pronouns and the plural
      has its own, and a single table hanging off the card said
      the plural's were the singular's. It sits under the form's own fields, which
      is the order they are learnt in — the word first, and each
      of these once the word is known.

      A subsection of that form's block since 0.179, with its name
      across the top and its own ticks at the foot: it is one of the
      things on the card that is drilled or not, and the answer belongs
      where the table is rather than in a list at the bottom of the
      screen naming it in the editor's words.

      The same component the verb's table uses, because it is
      the same thing: cells of a table over the card's own
      sub-forms. Inline, so the eye reads it as belonging to the
      block it is in. */
  return (
    <div className="at-part">
      <p className="at-groupline">Its {shownSpec.label || "table"}</p>
      <VerbTable
        inline
        lang={lang}
        spec={shownSpec}
        of={of}
        ofLabel={ownerLabel(i, forms.length)}
        cells={cells}
        mint={mintCell}
        onChange={setCells}
        onRecord={(row, col) =>
          setRecordingCell({
            of,
            ofLabel: ownerLabel(i, forms.length),
            row,
            col,
          })
        }
      />
      {/* Said once, under the first table: it is the same
          sentence about every one of them, and a copy under
          each would be the page's own advice repeating. */}
      {i === 0 && (
        <p className="at-formneed">
          Each of these is practised in its own right, once the
          form it is on the end of is known. Leave out the ones
          you do not teach.
        </p>
      )}
      {mine ? (
        <DrillChecks word={word} part={mine} label="How these forms can be practiced" />
      ) : written ? (
        /* Named rather than left as a missing tick: the reason these are
           not asked is a decision made in the block above this one, and
           it is not visible from here. */
        <p className="at-formneed">
          Not drilled while the form above is switched off — these wait on
          that word being known.
        </p>
      ) : null}
    </div>
  );
}

function AddFormButton({ word }: { word: WordDraft }) {
  const { addForm } = word;
  return (
    <>
    {/* Not on a card whose forms are laid out in a table.

        A verb's forms are the table — and where the language cites
        one of its cells, the card's own word is the table too — so
        the only thing left to add is a form outside it, which is the
        one thing a verb card should not have. This was a
        quieter-worded button rather than none, on the grounds that a
        verb may genuinely have a second spelling; but a spelling is
        an accepted answer, written beside the one it is an
        alternative to, and never a form of its own.

        A word that takes a pronoun on its end is offered one again.
        0.130 took the offer away, on the grounds that the plural
        takes the same endings and so was "not one more form but a
        second table" — which was true, and the conclusion should have
        been to give it one. Every form now carries its own table, so
        adding a form adds the whole thing: the plural, and the eight
        pronouns on the end of the plural.

        Duplicate, on a block already on screen, is left alone: it is
        a way out for somebody who has one, rather than an invitation
        to everybody who has not. And a form the card already carries
        stays on screen, because it is saved either way and hiding it
        would read as having lost it. */}
      <Button variant="ghost" size="sm"
        /* No number override beyond the name: blankForm takes the
           language's declared default, so what a new form starts as
           is settled in one place. The name is what its own cells
           will point at. */
        onClick={addForm}
        icon="add"
      >
        Add a form
      </Button>
    </>
  );
}

/*
 * What is drilled here, and where — at the foot of the subsection it is
 * about.
 *
 * This was one section at the bottom of the screen listing every part of
 * the card by the name the editor happens to give it: "The main form",
 * "Its attached pronouns". A teacher looking at the pronouns they had
 * just typed in had to scroll past everything else to a list of words
 * about them, work out which line meant the table they were looking at,
 * and scroll back. So the question is asked twice over — once beside each
 * thing it is about — and the card-wide list is gone.
 *
 * Two ticks, because there are two questions and a word may be worth
 * either without the other:
 *
 *   * **on its own** — dealt as a question, what it means, how it is
 *     written, how it sounds.
 *   * **inside sentence cards** — lent to the frames that leave a blank
 *     of its name, so *my name is ____* is met with this word in it.
 *
 * The second is only offered where the card stands in a blank at all —
 * see canLend, and a tick that does nothing is worse than no tick.
 */
function DrillChecks({ word, part, label = "How this form can be practiced" }: {
  word: WordDraft;
  part: AskPart;
  /* What the ticks are about, in the caller's words: one form under its
     own fields, and a table of them under the table. */
  label?: string;
}) {
  const { canLend, setAskPart, setLendPart } = word;
  const chosen = [part.on ? "ask" : "", canLend && part.lends ? "lend" : ""].filter(Boolean);
  return (
    <div className="at-drills">
      {label ? <span className="at-drillhead">{label}</span> : null}
      <CheckList
        options={[
          {
            id: "ask",
            title: "On its own",
            note: "Dealt as a question of its own — what it means, how it is written, how it sounds.",
          },
          ...(canLend
            ? [{
                id: "lend",
                title: "Inside sentence cards",
                note: "Lent to the cards that leave a blank this one fills, so the sentence is met with this word in it.",
              }]
            : []),
        ]}
        chosen={chosen}
        onToggle={(id, wasOn) =>
          (id === "ask" ? setAskPart : setLendPart)(part.id, !wasOn)
        }
      />
      {/* And where the ticks between them have switched this part off
          altogether, what that leaves — a state rather than an
          explanation, so it is said under the ticks that made it. */}
      {!part.on && !(canLend && part.lends) && (
        <Help>
          Kept and shown, and never asked or lent anywhere.
        </Help>
      )}
    </div>
  );
}

/*
 * The one thing the card-wide list did that no subsection can: say that
 * between them the ticks have switched the whole card off.
 *
 * Every part is drilled until somebody says otherwise, so this is silent
 * on every card anybody is writing — it is the warning at the end of a
 * road nobody takes by accident, not a section to fill in.
 */
function NothingAsked({ word }: { word: WordDraft }) {
  const { parts, canLend } = word;
  if (!parts.length) return null;
  if (parts.some((p) => p.on || (canLend && p.lends))) return null;
  return (
    <Notice kind="warn">
      Nothing on this card is drilled. It is still shown wherever the card
      is, but no session will deal it and no sentence will borrow it.
    </Notice>
  );
}

/*
 * How many fillers a hovered blank lists before it stops counting them out.
 *
 * `{{word}}` is filled by every word in the language, so the list is as
 * long as the vocabulary and a panel that printed all of it would cover
 * the card. Eight is enough to recognise what is behind the blank — that
 * these are the names, or the colours, or the wrong list entirely — and
 * the rest are counted rather than named.
 */
const FILLERS_SHOWN = 8;

/*
 * A blank the card leaves, and the words that will be put in it.
 *
 * The chip said the blank's name and stopped there, and the name is the
 * least of what a teacher wants to know about it. Whether anything fills
 * it at all is answered below, in one line, for the blanks where the
 * answer is nothing; which words those are was answerable only by leaving
 * the card and reading the list of every card in the language. The
 * sentences above show three of them standing in the frame; this shows
 * them as the words they are, on the thing already named after them.
 *
 * Hover, keyboard focus and a tap all open it, because a chip on a phone
 * has no hover and a chip reached by keyboard has no pointer. Nothing in
 * it can be chosen — it is something to read, not another control — so it
 * goes away on the way out and takes nothing with it.
 */
/*
 * A blank named in a line of prose about it.
 *
 * The editor used to print the braces — "English is missing {{name}}" —
 * which was the only way to say which blank it meant while braces were
 * what a teacher saw in the field. They are not any more: a blank is a
 * pill where it stands, so a line naming one draws it the same way, at
 * the size of the words around it.
 */
function BlankName({ name }: { name: string }) {
  return <span className="at-blankname">{name}</span>;
}

/** Several of them, in a sentence: "name and food". */
function BlankNames({ names, joiner = "and" }: { names: string[]; joiner?: string }) {
  return (
    <>
      {names.map((name, i) => (
        <React.Fragment key={name}>
          {i > 0 ? ` ${joiner} ` : ""}
          <BlankName name={name} />
        </React.Fragment>
      ))}
    </>
  );
}

function BlankChip({ slot, values, lang }: {
  slot: string;
  values: Value[];
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const shown = values.slice(0, FILLERS_SHOWN);
  const said = values.length
    ? `${plural(values.length, "word")} fill it`
    : "nothing fills it yet";
  return (
    <span
      className="at-blankwrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="at-blankchip"
        aria-expanded={open}
        /* The name alone, to a screen reader, is the chip saying nothing a
           sighted teacher is not also told by what opens under it. */
        aria-label={`${slot} · ${said}`}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {slot}
      </button>
      {open && (
        <div className="at-blankfills" role="tooltip">
          <p className="at-eyebrow">{`${slot} · ${said}`}</p>
          {shown.length > 0 && (
            <ul className="at-filllist">
              {shown.map((value, i) => (
                <li key={`${value.id || value.ar}-${i}`}>
                  <b
                    lang={lang.id}
                    dir={lang.direction}
                    style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}
                  >
                    {value.ar}
                  </b>
                  {value.lat ? <em>{value.lat}</em> : null}
                  {value.en ? <i>{value.en}</i> : null}
                </li>
              ))}
            </ul>
          )}
          {values.length > shown.length && (
            <Help>and {plural(values.length - shown.length, "word")} more.</Help>
          )}
          {!values.length && (
            <Help>
              Write a card that says it fills this blank, and it joins in
              without this card being touched.
            </Help>
          )}
        </div>
      )}
    </span>
  );
}

/*
 * The card's ID: typed once, then shut.
 *
 * Two states and one control between them. Open, it is a box with a tick
 * beside it, and the tick lights only on a name nobody else answers to —
 * so the check that matters is made while the teacher is looking at the
 * name rather than by a refusal after they have moved on. Shut, it is the
 * name with a pencil beside it, which is what a saved card opens as.
 *
 * What it says back is as short as it can be. A name that is free gets no
 * congratulation: the green rim is the whole of "yes", and the only
 * sentence here is the one for a name that is already taken, which names
 * what has it.
 */
function IdBox({ word }: { word: WordDraft }) {
  const { ref, setRef, refName, refHeld, refFree, refOpen, openRef, shutRef } = word;
  const lead = refHeld && refHeld.card ? leadOf(refHeld.card) : null;
  const who = lead ? [lead.en, lead.ar].filter(Boolean).join(" · ") : "";
  return (
    <>
      <Help>
        Optional. A name for reaching this one specific card from another
        card&rsquo;s blank.
      </Help>
      {refOpen ? (
        <>
          <div className="at-idrow">
            <input
              className={`at-input${refFree ? " ok" : refHeld ? " no" : ""}`}
              value={ref}
              aria-label="The card's ID"
              placeholder="colour-red"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setRef(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && shutRef()}
            />
            <IconButton
              icon="check"
              label="Lock this ID"
              disabled={!refFree}
              onClick={shutRef}
            />
          </div>
          {refHeld && (
            <p className="at-formneed unmet">
              {refHeld.kind === "card"
                ? `Taken — ${who || "another card"} already has this ID. Choose another.`
                : refHeld.kind === "category"
                  ? "Taken — that is a kind of word, and every word of that kind already fills it. Choose another."
                  : "Taken — a group tag already answers to this name. Choose another."}
            </p>
          )}
          {refName && refName !== ref && (
            <Help>
              Kept as <code>{refName}</code> — lower case letters, numbers, - and
              _ only.
            </Help>
          )}
        </>
      ) : (
        <div className="at-shutrow">
          <Icon name="key" />
          <span className="at-shutname at-idname">{refName}</span>
          <IconButton icon="edit" label="Edit this ID" onClick={openRef} />
        </div>
      )}
    </>
  );
}

/*
 * The groups this card is in, each with the pencil that renames it.
 *
 * A tick list with a second control on every row, which is why it is not
 * the shared CheckList: the tick and the pencil are different questions
 * about the same tag — is this card in it, and is the tag called the right
 * thing — and a row that answered the second by being tapped anywhere
 * would rename a group every time somebody meant to join one.
 *
 * Renaming opens in place, over the row: a group is a name two cards agree
 * on, and the only place a misspelt one is visible is a card that has it.
 */
function TagList({ word, rows }: {
  word: WordDraft;
  rows: { name: string; used: number; wrote: number }[];
}) {
  const {
    fills, addFill, dropFill, renameFill, nameHeld, askStrip, defaultTags, ownFills,
  } = word;
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  /* A tag may be renamed onto another tag — two groups becoming one is a
     thing a teacher may mean — but never onto a card's ID, which would
     leave two different things answering to one `{{x}}`. */
  const clash = renaming ? nameHeld(slotName(renaming.to)) : null;
  const canRename = !!renaming && !!slotName(renaming.to) &&
    slotName(renaming.to) !== renaming.from && (!clash || clash.kind === "group");
  /* The two runs, named: the tags that follow from the card, and the ones
     a teacher keeps. They are one list because they are one namespace —
     every one of them is a name a sentence writes between braces — and two
     runs because only the second is a question. */
  const fixed = (
    <>
      <p className="at-eyebrow">Default tags</p>
      {defaultTags.map((t) => {
        const on = ownFills.includes(t.name);
        return (
          <div className={`at-tagfixed${on ? " on" : ""}`} key={t.name}>
            {/* The mark keeps its room where it is not drawn, so the names
                read as a column rather than stepping in and out. */}
            <span className={`at-tagmark${on ? "" : " off"}`}>
              <Icon name="check" size={16} />
            </span>
            <span className="at-tickbody">
              <b>{t.name}</b>
              <i>
                {[
                  t.what,
                  t.words
                    ? `${plural(t.words, "word")} fill${t.words === 1 ? "s" : ""} it`
                    : "nothing fills it yet",
                ].join(" · ")}
              </i>
            </span>
          </div>
        );
      })}
      <Help>
        These follow from the card: the one that matches what kind of word
        you said it is, and <code>{`{{${WORD_SLOT}}}`}</code>, which every
        single word fills. Change them by changing the kind of word, above.
      </Help>
      <p className="at-eyebrow at-mt3">Your own tags</p>
    </>
  );
  if (!rows.length) {
    return (
      <div className="at-ticklist">
        {fixed}
        <p className="at-hint">
          No group has been named yet. Type one above — the first of its kind
          has to be named by somebody.
        </p>
      </div>
    );
  }
  return (
    <div className="at-ticklist">
      {fixed}
      {rows.map((b) => {
        const on = fills.includes(b.name);
        if (renaming && renaming.from === b.name) {
          return (
            <div className="at-tagrow" key={b.name}>
              <input
                className="at-input"
                value={renaming.to}
                aria-label={`A new name for the group ${b.name}`}
                autoFocus
                onChange={(e) => setRenaming({ from: b.name, to: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenaming(null);
                  if (e.key !== "Enter" || !canRename) return;
                  renameFill(b.name, renaming.to);
                  setRenaming(null);
                }}
              />
              <IconButton
                icon="check"
                label={`Rename the group ${b.name}`}
                disabled={!canRename}
                onClick={() => {
                  renameFill(b.name, renaming.to);
                  setRenaming(null);
                }}
              />
              <IconButton icon="close" label="Leave the name as it is" onClick={() => setRenaming(null)} />
            </div>
          );
        }
        return (
          <div className="at-tagrow" key={b.name}>
            <label className="at-tickrow">
              <input
                type="checkbox"
                checked={on}
                onChange={() => (on ? dropFill(b.name) : addFill(b.name))}
              />
              <span className="at-tickbody">
                <b>{b.name}</b>
                {/* Two facts, each of which is a reason to tick or not:
                    how many sentences would borrow this word, and whether
                    anybody else's card is already standing in that hole. */}
                <i>
                  {[
                    b.used ? `left by ${plural(b.used, "card")}` : "no card leaves it yet",
                    b.wrote ? `${plural(b.wrote, "card")} already fill it` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </i>
              </span>
            </label>
            <IconButton
              icon="edit"
              label={`Rename the group ${b.name}`}
              onClick={() => setRenaming({ from: b.name, to: b.name })}
            />
            {/* And the bin, beside the pencil, for the same reason the
                pencil is here: a group nobody wants any more is only
                visible from a card that is in it. Only where cards
                actually fill it — on a name a sentence leaves and nothing
                fills, there is nothing to take off anybody, and a button
                that would do nothing is worse than no button. Taking this
                one card out is the tick to its left, so this can mean the
                one thing. */}
            {b.wrote > 0 && (
              <IconButton
                icon="delete"
                label={`Take the group ${b.name} off every card`}
                onClick={() => askStrip(b.name, b.wrote, b.used)}
              />
            )}
          </div>
        );
      })}
      {/* Said rather than left as a tick that will not press. Two groups
          becoming one is allowed and this is the case that is not: a card
          answers to that name already. */}
      {clash && clash.kind === "card" && (
        <p className="at-formneed unmet">
          A card&rsquo;s ID is that name already, and one{" "}
          <BlankName name={slotName((renaming || { to: "" }).to)} /> cannot be
          two things.
        </p>
      )}
    </div>
  );
}

/*
 * The one question a rename has to ask.
 *
 * A name is written in two sorts of place: on this card, and in every
 * other card that asks for it. Changing it here and nowhere else is a
 * real answer — a tag renamed on one card is that card leaving the group,
 * and an ID renamed alone is a card that has been given a new name while
 * the old sentences go on asking for the old one — and so is changing it
 * everywhere. Neither is safe to assume, so neither is the default and
 * both buttons say what they will do rather than yes and no.
 */
function RenameAsk({ word }: { word: WordDraft }) {
  const { asking, answerAsk, dropAsk } = word;
  if (!asking) return null;
  const what = asking.kind === "id" ? "ID" : "group tag";
  return (
    <ConfirmModal
      danger={false}
      title={`Rename this ${what}?`}
      body={
        <>
          <p>
            <BlankName name={asking.from} /> becomes <BlankName name={asking.to} />.
          </p>
          <p>
            {asking.kind === "id"
              ? "Other cards ask for this one by its ID. Change it everywhere and those sentences follow it; change it only here and they go on asking for the old name, which nothing will answer to."
              : "A group tag is a name several cards share. Change it everywhere and every card in the group is renamed with it; change it only here and this card leaves the group for one of the new name."}
          </p>
        </>
      }
      altLabel="Only here"
      onAlt={() => answerAsk(false)}
      confirmLabel="Change it everywhere"
      onCancel={dropAsk}
      onConfirm={() => answerAsk(true)}
    />
  );
}

/*
 * And the one question taking a group off every card has to ask.
 *
 * Not "are you sure" — "here is what it costs". The two numbers on the row
 * are the two halves of that: how many cards fill the group, which is what
 * loses the tag, and how many leave a blank of the name, which is what
 * goes on asking for a word that will not come. The second is the half
 * nobody would think of, and the half that is not undone by ticking the
 * group back on to one card.
 *
 * What is *not* lost is worth as many words as what is: a tag is a name,
 * and taking it off a card takes nothing else off — not the word, not its
 * recordings, and not a day of anybody's progress on it.
 */
function StripAsk({ word }: { word: WordDraft }) {
  const { dropping, answerStrip, dropStrip } = word;
  if (!dropping) return null;
  return (
    <ConfirmModal
      danger
      title={`Take ${dropping.name} off every card?`}
      confirmLabel="Take it off every card"
      body={
        <>
          {/* Counted rather than made the subject of a sentence: "1 card
              lose the tag" is what writing it the other way round gets
              you, on the one card that is the commonest case of all. */}
          <p>
            The tag comes off <strong>{plural(dropping.fills, "card")}</strong>,
            and nothing else goes with it — the words, the recordings and
            every day of progress a student has made on them stay exactly as
            they are.
          </p>
          {dropping.leaves ? (
            <p>
              A <BlankName name={dropping.name} /> blank is left by{" "}
              {plural(dropping.leaves, "card")}, and it goes on being asked.
              With nothing filling it, there is no word to put in the hole
              until something fills it again.
            </p>
          ) : (
            <p>
              No card leaves a <BlankName name={dropping.name} /> blank, so
              the name goes with the last card that filled it.
            </p>
          )}
        </>
      }
      onCancel={dropStrip}
      onConfirm={answerStrip}
    />
  );
}

function BlanksBlock({ word, lang }: { word: WordDraft; lang: Lang }) {
  const {
    holes, starved, combos, fillers, fills, fillsOffer, addFill,
    main, trouble, category, sentence, strayHoles, tensed, blankRows, setBlankRow,
  } = word;
  /*
   * Whether the filled examples are open. Folded away to start with, and
   * on every card: the list is now as long as the vocabulary behind the
   * blanks — hundreds of sentences on a card the whole collection fills —
   * and a section that opened on it would put the rest of the card, and
   * the half that offers this word to other blanks, below the fold on a
   * screen nobody asked to scroll. The heading says how many are in there,
   * which is the thing worth knowing without opening it.
   */
  const [examplesOpen, setExamplesOpen] = useState(false);
  /*
   * And the sentences themselves, built only once somebody asks to see
   * them.
   *
   * A frame the whole collection fills is met as hundreds of sentences,
   * each of them three strings to fill; building them all is what the
   * fold exists to put off, and the list was being built on every
   * keystroke in any field of the card with the fold still shut. The
   * heading's count is `combos`, which is counted and not built, so
   * nothing above needs this.
   */
  const asked = useMemo(
    () => (examplesOpen ? examplesOf(main, holes, fillers) : NO_ASKED),
    [examplesOpen, main, holes, fillers],
  );
  /* A sentence fills nothing — see fillsOf, which is the one answer to
     that and which this only reports. So the second subsection has nothing
     to offer one, except where it already carries names, which it has to go
     on showing or they are stranded.

     Asked of the kind rather than of the braces, since 0.176: a sentence
     is a sentence before its first blank is in it, and offering to lend it
     out in that gap was offering the one thing the rule forbids. */
  const canFill = !sentence || fills.length > 0;
  /* On such a card, only what it already carries — so it can be taken off
     and nothing else can be added to a list that fills nothing. */
  const offered = sentence ? fillsOffer.filter((b) => fills.includes(b.name)) : fillsOffer;
  const full = fills.length >= MAX_FILLS;
  return (
    <>
    {/* ---- blanks ----
        A card with a gap in it — "My name is {{name}}" — and the
        cards that fill the gap. One fact about the whole card, so it
        stands on its own rather than beside a field.

        It was called Variables, which is the word the code uses, and
        it did two opposite jobs in one block under ninety words of
        explanation. They are named subsections now, and the
        explaining is done by showing the sentences a student will
        actually be asked.

        **The subsections are not the same shape, and that is the
        point.** What a card *leaves* is read off its own words — the
        braces are in the text, so the holes are a fact about the card
        and there is nothing to decide. That one is a readout: the
        holes, and what will go in each of them. What the card *is*
        once they are filled — all of it, as a student meets it, folded
        away until it is asked for — is the third, and a list to read
        down rather than a preface to the holes it was appended to.
        What a card *fills* is nowhere in its words and nothing can be
        read off: it is the teacher's answer, so that one is the list
        they answer it on.

        0.161 had both as tick lists, which made the first one a list
        of every blank in the language with two of them ticked — and a
        tick beside `{{verb}}` on a card that has no verb in it says
        the card has something to do with verbs, under a heading that
        says these are the blanks in this card. Neither was true. */}
      <div className="at-formblock at-mt5">
        <div className="at-formhead">
          <span className="at-formnum">Blanks</span>
          <span className="at-formrole">
            {!sentence && strayHoles.length
              ? "Only a sentence can have a blank."
              : sentence && holes.length
                ? `${plural(holes.length, "blank")} · ${
                    /* Every filling the card has, counted — not the examples
                       drawn, which the list below says for itself and which
                       stop at a ceiling. "Met as three sentences" was what
                       this said while three were printed, on a card met as
                       two hundred. */
                    starved.length ? "nothing fills it yet" : `met as ${plural(combos, "sentence")}`
                  }`
                : sentence
                  ? "no blank in it yet"
                  : fills.length
                    ? `this card fills ${plural(fills.length, "blank")}`
                    : "gaps in sentences, and the cards that fill them"}
          </span>
        </div>

        {/* ---- a blank on a card that is not a sentence ----

            Only a sentence may have one, and this is where a word that has
            got one says so. It is a refusal and not a warning: the save is
            off until it is answered, because the two things it could mean
            are opposite and only the teacher knows which. Both answers are
            named, in the order they are likely — a card with braces typed
            into it is usually a sentence somebody has just started
            writing.

            It replaces the old silence, which was the app answering for
            them: a word with braces in it was quietly renamed a sentence,
            and on a word with a table under it that hid the table and
            offered to drop every box in it. */}
        {!sentence && strayHoles.length > 0 && (
          <>
            <p className="at-formneed unmet">
              {`${strayHoles.map((s) => `{{${s}}}`).join(" and ")} ${
                strayHoles.length > 1 ? "are blanks" : "is a blank"
              }, and only a sentence can have one.`}
            </p>
            {/* One way out, since 0.187: what kind of card this is was
                answered before the screen opened, so there is nothing here
                to call a sentence. */}
            <Help>
              Take the braces out of its words. A word is a thing to learn;
              a sentence is the frame it is met in, and the blank is what
              makes it one — and what kind of card this is was settled
              before this screen opened. To write the sentence, start a new
              card and pick Sentence.
            </Help>
          </>
        )}

        {/* Each half of this section, and each half of each half, is a
            subsection of its own: a panel with its name ruled across the
            top, rather than a coloured line that read as a label on
            whatever happened to follow it. */}
        {sentence && (
          <div className="at-part">
        <p className="at-groupline">Blanks in this card</p>

        {sentence && holes.length > 0 && (
          <>
            {/* Named, because it is the reason the card is never
                asked and the teacher cannot see it from here. */}
            {starved.length > 0 && (
              <p className="at-formneed unmet">
                Nothing fills <BlankNames names={starved} joiner="or" /> yet, so
                this card cannot be practised. Write a card that says it fills
                it.
              </p>
            )}
            <Help>
              One card, met as a sentence for every word that fills it. A word
              added later joins in without this card being touched.
            </Help>
          </>
        )}

        {/* The holes the card has, as facts about it — each one saying,
            when it is pointed at, what will be put in it. */}
        {sentence && holes.length > 0 && (
          <div className="at-blankrow">
            {holes.map((slot) => (
              <BlankChip key={slot} slot={slot} values={fillers[slot] || []} lang={lang} />
            ))}
          </div>
        )}

        {/* ---- which tenses a blank asks its verbs for ----

            The one thing in this subsection that is not a readout, and it
            is here because it is a fact about the blank rather than about
            the words behind it: "Yesterday {{name}} {{verb}} an apple" is
            met as the present, the past and the command one after another,
            and two of those say something nobody means. The sentence is
            the only place that can say so — the verb card is right to
            carry every tense, and the frame is what fixes when it
            happened.

            Only where there is something to ask: a blank with no tensed
            word behind it, and a language whose verbs take one form, are
            offered nothing rather than an empty list of ticks. See
            tensedBlanks.

            Nothing ticked is every tense, which is what a card written
            before this says and what a frame about nothing in particular
            wants — so unticking the last one is how a teacher takes the
            narrowing off, and there is no third state to explain. */}
        {sentence && holes.map((slot) => {
          const spec = tensed.get(slot);
          if (!spec) return null;
          const picked = blankRows[slot] || [];
          const rows = tensesOf(spec);
          return (
            <Field
              key={slot}
              label={<>Tenses <BlankNames names={[slot]} /> asks its verbs for</>}
              hint={
                picked.length
                  ? `Only the ${rowsLine(lang, picked)}. Words with no tenses stand in it as they always did.`
                  : "Any tense. Tick one or more to ask this sentence in those alone."
              }
            >
              <CheckList
                options={rows.map((t) => ({ id: t.id, title: t.label || t.id }))}
                chosen={picked}
                onToggle={(id, wasOn) =>
                  setBlankRow(
                    slot,
                    wasOn ? picked.filter((r) => r !== id) : rows.map((t) => t.id).filter((r) => r === id || picked.includes(r)),
                  )
                }
              />
            </Field>
          );
        })}

        {/* Still possible on a card written before the button, or by
            typing the braces by hand, so still said — in one line. Only on
            a sentence: on a word every blank is already the wrong thing to
            have, and saying the fields disagree about them as well would be
            two complaints where there is one thing to do. */}
        {sentence && trouble && (
          <p className="at-formneed unmet">
            {trouble.missing.length ? (
              <>
                {fieldName(trouble.field, lang)} is missing{" "}
                <BlankNames names={trouble.missing} /> — every field with words
                in it leaves the same blanks.
              </>
            ) : (
              <>
                {fieldName(trouble.field, lang)} names{" "}
                <BlankNames names={trouble.extra} />, which no other field does.
              </>
            )}
          </p>
        )}

        {/* A sentence before its first blank, which is a real state and
            used to be an impossible one: a card with no braces in it read
            as a word, so this screen could not be reached from it. What it
            says is where the blanks are put in, which is beside the words
            themselves rather than here. */}
        {sentence && holes.length === 0 && (
          <Help>
            None yet. A blank is a hole this card leaves for another word to
            fill, so that one card is met as a sentence about anybody. Put one
            in with the <b>Blank</b> button under any of the card&rsquo;s
            fields, and it appears here.
          </Help>
        )}

        {sentence && holes.length > 0 && (main.clips || []).length > 0 && (
          <Help>
            Listening exercises are not offered on a card with a blank in it:
            the recording says one of the words, and the next asking wants another.
            The recording is kept, and comes back if the blank goes.
          </Help>
        )}
          </div>
        )}

        {/* ---- the card with its blanks filled ----

            Its own named subsection, because it is not a fact about the
            holes: it is the card itself, as a student will meet it, with
            every blank standing as one of the words actually behind it.
            It sat above the holes as a wordless preface to them, which is
            where the one thing on this screen worth reading down was
            hardest to recognise as a thing to read. All of them, each in
            the script, in how it is said and in what it means, and
            nothing else on the line — so the list is read as a list.

            Folded, and the heading is what opens it: all of them is as
            many sentences as there are words behind the blanks, which is
            a screenful on the smallest card that has any, and the rest of
            the section is underneath it.

            Only on a card that leaves a blank: a card with no hole in it
            is met as what it says, and a heading offering examples of it
            would be a heading over the card's own words. */}
        {sentence && holes.length > 0 && (
          <div className="at-part">
            {/* The one heading here that is a control, because it is the
                one that has something behind it: what it says while it is
                shut is how many sentences the card is met as, which is the
                answer a teacher wants oftener than the sentences
                themselves. */}
            <button
              type="button"
              className="at-groupline at-groupfold"
              aria-expanded={examplesOpen}
              onClick={() => setExamplesOpen((v) => !v)}
            >
              <span>Examples of this card with filled blanks</span>
              <span className="at-groupcount">
                {combos ? plural(combos, "example") : "none yet"}
              </span>
              <Icon name={examplesOpen ? "chevronUp" : "chevronDown"} size={16} />
            </button>
            {examplesOpen && (asked.length > 0 ? (
              <>
                <ol className="at-asked">
                  {asked.map((line, i) => (
                    <li className="at-askedline" key={i}>
                      <span className="at-askedsays">
                        {line.ar && (
                          <span
                            className="at-askedscript"
                            lang={lang.id}
                            dir={lang.direction}
                            style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}
                          >
                            {line.ar}
                          </span>
                        )}
                        {line.lat && <span className="at-askedsaid">{line.lat}</span>}
                        {line.en && <span className="at-askedmeans">{line.en}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                {/* Only where a card is met as more sentences than a screen
                    will draw — see EXAMPLES_CEILING. Said rather than left
                    to be counted, because a list that stopped without
                    saying so is a list a teacher would read as all of them. */}
                {combos > EXAMPLES_CEILING && (
                  <Help>
                    The first {plural(asked.length, "example")} of{" "}
                    {plural(combos, "example")}, which is as many as one screen
                    will draw. The rest are this card with other words in it.
                  </Help>
                )}
              </>
            ) : (
              <Help>
                None yet. A blank in this card has no word behind it, so there
                is nothing to stand in it and no filled sentence to show.
              </Help>
            ))}
          </div>
        )}

        {/* ---- the card's ID ----

            The name this one card answers to, which is the other half of
            how a blank is filled: a group is a set of words a sentence
            will take any of, and this is the one word it asks for. Here
            rather than at the top of the screen because that is what it is
            for — a teacher looking for how this card gets borrowed finds
            both answers in one section. */}
        <div className="at-part">
          <p className="at-groupline">The card&rsquo;s ID</p>
          <IdBox word={word} />
        </div>

        {/* The other job. Named and always on screen, so that a teacher
            looking for where a word is offered to other cards finds the
            question rather than the absence of it — on a card that leaves
            a blank of its own, what they find is the reason there is
            nothing to answer. */}
        <div className="at-part">
        <p className="at-groupline">The card&rsquo;s group tags</p>

        {!canFill ? (
          <Help>
            This card leaves a blank of its own, so it fills none: a sentence
            dropped into somebody else&rsquo;s hole is a sentence with a gap
            where the point was.
          </Help>
        ) : (
          <>
            {holes.length > 0 && (
              <p className="at-formneed unmet">
                This card leaves a blank of its own, so it fills none while it
                does — these names do nothing until the blank above goes.
              </p>
            )}

            <Help>
              Select which group this card should belong to so it fills cards
              that tag those groups in blank spaces
            </Help>

            {/* The box that names one, at the top and always there.
                It was the last thing in a menu that had to be opened, under
                a list — so naming the first group, which is the one thing
                on this screen nobody can do by choosing, was the hardest
                thing on it to reach. */}
            {!holes.length && !full && (
              <BlankNameBox
                label="Name a group this card joins"
                placeholder="A new group, like colours"
                /* Every name already on the list, which since 0.189
                   includes the ones that follow from the card: a group
                   called `noun` would be a second thing answering to
                   `{{noun}}`. */
                /* And every ID a card answers to, which a group of the
                   same name would be a second answer to — see refsTaken.
                   The ID box has always refused a name a group holds;
                   this is the same refusal from the other side. */
                taken={offered
                  .map((b) => b.name)
                  .concat(word.defaultTags.map((t) => t.name))
                  .concat(word.refsTaken)
                  .concat(word.refName ? [word.refName] : [])}
                onName={addFill}
              />
            )}

            {/* And every group there is, on the screen rather than behind a
                button: which groups a word is in is the question this half
                of the section exists to ask, and a list you have to open to
                see is a list you answer without reading. Each carries the
                pencil that renames it, because a tag is a name two cards
                agree on and a misspelt one is only findable from a card
                that has it. */}
            <TagList word={word} rows={offered} />

            {full && (
              <Notice kind="warn">
                That is as many groups as one card may be in. Take one off to
                join another.
              </Notice>
            )}

            {fills.length ? (
              <>
                <Help>
                  Every card with{" "}
                  {fills.map((name, i) => (
                    <React.Fragment key={name}>
                      {i > 0 ? (i === fills.length - 1 ? " or " : ", ") : ""}
                      <BlankName name={name} />
                    </React.Fragment>
                  ))}{" "}
                  in it can borrow this word.
                </Help>
                {/* Whether it is *also* a question of its own was a tick
                    here — one answer for the whole card, in a different
                    place from the ticks under each form and asking a
                    question that read like theirs. It is the first of
                    those ticks now, so what is drilled is asked once and
                    asked where the thing being drilled is. */}
                <Help>
                  Whether it is <i>also</i> asked as a question of its own is
                  under the form itself, beside the word.
                </Help>
              </>
            ) : (
              <Help>
                Leave this unless the card is a word other cards borrow — a name, a
                number, a colour.
              </Help>
            )}

            {/* Where the built-in blanks went. A card fills them by being
                what it already said it was, so there was never anything to
                tick — and a tick that does nothing is worse than no tick at
                all. Said once, on the cards it is true of. */}
            {category ? (
              <Help>
                It also fills <code>{`{{${category}}}`}</code>, because that is
                what you said this word is — and <code>{`{{${WORD_SLOT}}}`}</code>,
                which every word fills. Neither is ticked here: they follow from
                the card rather than from this list.
              </Help>
            ) : null}
          </>
        )}
        </div>
      </div>
      {/* And the two questions that are about cards this screen is not
          editing, so neither can be answered beside the row it came
          from: where a rename follows the name to, and whether a group
          comes off the collection. */}
      <RenameAsk word={word} />
      <StripAsk word={word} />
    </>
  );
}

/*
 * The recording screens, over the editor rather than instead of it:
 * closing one puts the form back exactly as it was left, scroll position
 * included. Drawn by the shell after the Screen, so they stand above it.
 */
function RecordingOverlays({ word, talk }: { word: WordDraft; talk: SceneDraft }) {
  const { recordingCell, setRecordingCell, cellHere, setCells, shownSpec } = word;
  const { lines, recordingLine, setRecordingLine, setLine } = talk;
  return (
    <>
    {/* Above the editor rather than instead of it: closing it puts the
        form back exactly as it was left, scroll position included. */}
    {recordingLine !== null && lines[recordingLine] && (
      <RecordingScreen
        title={`Recording · line ${recordingLine + 1}`}
        form={lines[recordingLine]}
        onChange={(next) => setLine(recordingLine, { ...lines[recordingLine], ...next })}
        onClose={() => setRecordingLine(null)}
      />
    )}
    {/* A form's own screen used to stand here. Recordings belong to an
        accepted answer now, and ScriptAnswers opens theirs itself — it
        owns the rows they are written into, and a screen reaching past it
        into the card would be overwritten by the next keystroke. */}
    {recordingCell && cellHere && (
      <RecordingScreen
        /* Named out of whichever table is on screen. It used to be named
           out of the verb's whatever the card was, so the recording
           screen over a pronoun table was titled with the row and column
           ids the pack happens to use rather than its words for them. */
        title={`Recordings · ${[recordingCell.ofLabel, cellLabel(shownSpec, recordingCell)]
          .filter(Boolean)
          .join(" · ")}`}
        form={cellHere}
        onChange={(next) =>
          setCells((x) =>
            x.map((c) =>
              c.row === recordingCell.row &&
              c.col === recordingCell.col &&
              String(c.of || "") === recordingCell.of
                ? { ...c, ...next }
                : c,
            ),
          )
        }
        onClose={() => setRecordingCell(null)}
      />
    )}
    </>
  );
}

/*
 * What a save carries, off the two drafts.
 *
 * The table's cells go back into the one list of forms they came out of: a
 * cell is a sub-form, and the save path has no idea there is such a thing
 * as a verb or a pronoun on the end of a word. Only the table on screen, so
 * changing which one the card lays out puts the other away rather than
 * saving a hidden one — and a card can never be saved carrying both.
 *
 * The name only where it was asked for — a verb whose own word is a cell
 * of its table, and a sentence — because every other card is named by its
 * own word, and a name left behind from a card that briefly was one of the
 * two would go on labelling it.
 */
export function writtenCard({ word, talk, shape, chosen }: {
  word: WordDraft;
  talk: SceneDraft;
  shape: CardShape;
  chosen: string[];
}) {
  const scene = shape === "scene";
  const { shownSpec, ownForms, tableCells, keptFrames = [], forms, note, standsIn, name, uses, fills, category, refName, spread, stripped } = word;
  /* And the verb's own sentences back on the end, exactly as they were
     found: this screen does not write them, so the whole of what it owes
     them is not to lose them — see initialFrames. */
  const written = (shownSpec ? ownForms.concat(tableCells as typeof forms) : ownForms)
    .concat(keptFrames as typeof forms);
  return {
    forms: written,
    note,
    /* What the teacher says it is — asked only of a word. A conversation
       has turns where a word has a part of speech, and a sentence is not a
       word at all: what fills its blanks is other cards, and a sentence
       that claimed to be a noun would be offering itself to fill one. */
    category: shape === "word" ? category : "",
    /* And whether it is a sentence, which until 0.176 was worked out from
       the braces every time the card was read rather than being the
       teacher's answer to keep. Carried as a plain yes or no, so a
       sentence with no blank in it yet is still one — which is the state
       every sentence passes through while it is being written, and the one
       the old reading could not hold. */
    sentence: shape === "sentence",
    /* And what to call it, where its own words do not: the two cards that
       are saved as something other than what they are about. */
    name: standsIn || shape === "sentence" ? name.trim() : "",
    decks: chosen,
    uses,
    fills,
    /* The ID the teacher gave it, which another card's blank may ask for
       by name. A conversation is not borrowed by anybody — its turns are
       the lesson — so it carries none. */
    ref: scene ? "" : refName,
    /* And the renames the teacher said should follow the name into every
       other card. The editor holds one card and saves one card; this is
       what it hands the screen that holds the rest. */
    spread: scene ? [] : spread,
    /* And the groups the teacher took off the collection altogether, which
       travel the same way and are applied after the renames. */
    stripped: scene ? [] : stripped,
    /*
     * And whether the card is a question at all, which is no longer a
     * question anybody is asked.
     *
     * `drill` is card-wide and reaches further than the per-form ticks
     * do: a card marked as a value stays out of the matching grids and
     * out of the wrong answers a learner is asked to tell apart, not
     * merely out of the deal. It used to be a tick of its own in the
     * Blanks block, which asked the same question as the ticks under
     * each form in different words and in another place. So it is read
     * off them: a card is a question exactly while something on it is
     * asked on its own. A card opened with it off is read back the same
     * way — see asValue.
     */
    drill: written.some(partAsked),
    scene: scene
      ? { title: talk.title.trim(), setting: talk.setting.trim(), speakers: talk.speakers, you: talk.you, lines: talk.written }
      : null,
  };
}

/* ------------------------------------------------------------------
   The four editors

   One per kind of card, and each is only a list: which blocks, in which
   order, over the draft it is handed. Nothing in here asks what kind of
   card it is looking at — the shell below decided that by choosing which
   of the four to draw — so a block is never shown or hidden by a flag
   inside another block, which is what made the one big editor hard to
   keep right.

   Switching a new card between these (word to verb and back, say)
   redraws the blocks; what was typed is in the draft and comes back, an
   open keypad or grammar panel does not. That is accepted: the old fixed
   layout kept those open across a switch only by keeping every kind's
   blocks on the same screen at once.
   ------------------------------------------------------------------ */

/** A word or phrase: its forms, then its blanks and the words it teaches. */
function WordEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      {word.tableMissing ? (
        <Help>
          In {lang.name} this kind of word lays nothing out: it is the word and whatever forms you
          write. Saying what it is still matters — it is how a sentence knows what may stand in its
          blanks.
        </Help>
      ) : null}
      <FormsSection>
        {word.forms.map((f, i) => (
          <FormBlock
            key={i}
            word={word}
            lang={lang}
            index={i}
            form={f}
            title={`Form ${i + 1}`}
            role={formRole(i)}
          />
        ))}
        <AddFormButton word={word} />
      </FormsSection>
      <NothingAsked word={word} />
      <BlanksBlock word={word} lang={lang} />
      <WordsUsed
        lang={lang}
        text={word.main.ar}
        cards={allCards}
        selfId={selfId}
        chosen={word.uses}
        onChange={word.setUses}
      />
    </>
  );
}

/*
 * A verb: its table first, then any form the card already carried outside
 * the table. Where the language cites a cell of the table as the dictionary
 * form, the card's own word is that cell and has no block of its own — and
 * what to call the card instead is asked up in "This card", with the other
 * facts about the card. No form can be added: a verb's forms are its
 * table, and a spelling is an accepted answer, not a form.
 */
function VerbEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  /* Where the table stands in for the verb's own word, that word has no
     block here — and on the usual verb, with nothing outside its table,
     that left a "Forms" heading over nothing. So the section is drawn only
     when some form is left to show in it. */
  const shown = word.forms.map((f, i) => ({ f, i })).filter(({ i }) => !(i === 0 && word.standsIn));
  return (
    <>
      <TableBlock word={word} lang={lang} />
      {shown.length > 0 && (
        <FormsSection>
          {shown.map(({ f, i }) => (
            <FormBlock
              key={i}
              word={word}
              lang={lang}
              index={i}
              form={f}
              title={i === 0 ? "The verb" : `Form ${i + 1}`}
              role={i === 0 ? "This is the verb itself." : formRole(i)}
            />
          ))}
        </FormsSection>
      )}
      <NothingAsked word={word} />
      <BlanksBlock word={word} lang={lang} />
      <WordsUsed
        lang={lang}
        text={word.main.ar}
        cards={allCards}
        selfId={selfId}
        chosen={word.uses}
        onChange={word.setUses}
      />
    </>
  );
}

/*
 * A word with a table of its forms beside it that cites nothing — an
 * adjective's feminine and plural. The verb's editor without the verb: no
 * name to list it under, and the card's own word keeps its block, because
 * the table is forms of it rather than a stand-in for it. No form can be
 * added, for the reason a verb's cannot: the table is the forms, and a
 * spelling is an accepted answer. A form the card already carries is still
 * shown rather than quietly dropped.
 */
function TableEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      {/* Four sections, one per shape of the word, and the card's own word
          is the first of them. It was "Form 1", then "The main form", and
          both were the app naming its own layout while the three boxes
          under it were named after the language — so it is named after the
          language too, out of `VerbSpec.base`.

          And no line under the heading. It said what the word was and
          where its other shapes were written; the headings below say both,
          in fewer words and in the language's own. A sentence explaining a
          screen is worth having exactly while the screen cannot say it
          itself. */}
      <FormsSection>
        <FormBlock
          word={word}
          lang={lang}
          index={0}
          form={word.forms[0] || {}}
          title={cap(baseName(word.shownSpec))}
          role=""
          /* Named out loud like the shapes below it: four panels of the
             same fields under four headings are four boxes called "Arabic"
             to anybody reading the screen aloud, and a heading is not a
             label. */
          of={baseName(word.shownSpec).toLowerCase()}
          canCopy={false}
          drills={false}
        />
        <AgreementFields word={word} lang={lang} />
        {/* A loose form from before the table: still shown, still
            removable, and still numbered, because there it really is one of
            several. It comes after the shapes so that the paradigm stays
            together. */}
        {word.forms.slice(1).map((f, j) => (
          <FormBlock
            key={j + 1}
            word={word}
            lang={lang}
            index={j + 1}
            form={f}
            title={`Form ${j + 2}`}
            role={formRole(j + 1)}
            canCopy={false}
            drills={false}
          />
        ))}
      </FormsSection>
      <PracticeSection word={word} />
      <NothingAsked word={word} />
      <BlanksBlock word={word} lang={lang} />
      <WordsUsed
        lang={lang}
        text={word.main.ar}
        cards={allCards}
        selfId={selfId}
        chosen={word.uses}
        onChange={word.setUses}
      />
    </>
  );
}

/*
 * A word with pronouns on its end: the word editor with a table of them
 * under every form. Its own editor rather than a switch inside the word's,
 * so that the shell's choice is the one place the kinds are told apart.
 */
function AttachedEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      <FormsSection>
        {word.forms.map((f, i) => (
          <FormBlock
            key={i}
            word={word}
            lang={lang}
            index={i}
            form={f}
            title={`Form ${i + 1}`}
            role={formRole(i)}
          >
            <PronounTable word={word} lang={lang} index={i} form={f} />
          </FormBlock>
        ))}
        <AddFormButton word={word} />
      </FormsSection>
      <NothingAsked word={word} />
      <BlanksBlock word={word} lang={lang} />
      <WordsUsed
        lang={lang}
        text={word.main.ar}
        cards={allCards}
        selfId={selfId}
        chosen={word.uses}
        onChange={word.setUses}
      />
    </>
  );
}

/*
 * A sentence: what it says, and the blanks other cards fill in it.
 *
 * "{{noun}} is heavy" is a sentence somebody can say about anything heavy,
 * which is what makes it worth more than one sentence learnt whole — and
 * writing one has until now meant typing the braces by hand into three
 * fields and hoping. Its own editor, so that what the card is for is what
 * is on screen: the words, then the blanks with what fills each and the
 * sentences a student will actually be asked.
 *
 * What to call it is asked up in "This card", as it is on a verb and for
 * the same reason: what is saved on the card is a frame with a hole in it,
 * so a list of sentences reads as a list of holes unless the teacher says
 * what each one is for — which is a fact about the card rather than about
 * its words.
 *
 * No part of speech and no table, because a sentence is not a word. No
 * button to add another form either — a second way of saying the same
 * sentence is a second sentence — though a card that already carries one
 * still shows it rather than having it quietly dropped.
 */
function SentenceEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  /*
   * The sheet, and where what it hands back is to go.
   *
   * One sheet for the whole card rather than one per field: it is the same
   * question wherever it is asked from, and the field that asked is
   * remembered instead — as the thing to do with the answer, so the sheet
   * itself knows nothing about fields. Held here rather than in each bar,
   * because a sheet raised from inside a field would be unmounted by the
   * very change it makes.
   */
  const [putting, setPutting] = useState<{ put: (name: string) => void } | null>(null);
  /*
   * The blanks a chip is offered for: the ones this card already writes,
   * in any of its fields, plus none.
   *
   * The card's own word and not the form in hand, so the bar under form
   * two offers what form one leaves — which is the rule the save enforces
   * ("every field with words in it leaves the same blanks") shown as the
   * one tap that keeps it.
   */
  const wiring: BlankWiring = {
    names: word.holes,
    onNew: (put) => setPutting({ put }),
  };
  return (
    <>
      {word.forms.map((f, i) => (
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={i === 0 ? "The sentence" : `Form ${i + 1}`}
          role={
            i === 0
              ? "This is the sentence, with a blank where a word goes."
              : "Another way of saying it."
          }
          blanks={wiring}
        />
      ))}
      {putting && (
        <BlankSheet
          lang={lang}
          offers={word.blankOffer}
          onPick={(name) => putting.put(name)}
          onClose={() => setPutting(null)}
        />
      )}
      <NothingAsked word={word} />
      <BlanksBlock word={word} lang={lang} />
      <WordsUsed
        lang={lang}
        text={word.main.ar}
        cards={allCards}
        selfId={selfId}
        chosen={word.uses}
        onChange={word.setUses}
      />
    </>
  );
}

/** A conversation: the scene, then its turns in order. */
function SceneEditor({ talk, lang, allCards, selfId }: {
  talk: SceneDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      <SceneBlock talk={talk} />
      {talk.lines.map((l, i) => (
        <TurnBlock
          key={i}
          talk={talk}
          lang={lang}
          allCards={allCards}
          selfId={selfId}
          index={i}
          line={l}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={talk.addLine}
        icon="add"
      >
        Add a line
      </Button>

      <Help className="at-mt3">
        No recordings needed. A scene with none is still drilled every
        way there is; where a line has one, it can be heard as well as
        read.
      </Help>
    </>
  );
}

/*
 * The card's own word, put into the cell that stands in for it.
 *
 * On a language that cites a cell the block asking for the word is not
 * shown, so the word has to be somewhere the teacher can see and edit it,
 * and the cell a dictionary would list it under is that place. Run when a
 * plain word is first called a verb, and when a card written before this
 * is opened — a table whose cited cell nobody ever filled would otherwise
 * hide the card's word behind a block that is no longer on screen.
 *
 * Never over a cell that already says something: a table the teacher has
 * filled in knows better than a word field they have not looked at in
 * weeks. Never from an empty word either, which is every new card.
 */
const seedCited = (
  cells: Record<string, any>[],
  word: Record<string, any> | null | undefined,
  spec: VerbSpec | null | undefined,
  /* The names already spoken for on this card — its forms and its other
     cells — so the cell this mints cannot answer to one of them. */
  taken: { id?: string }[] = [],
): Record<string, any>[] => {
  const to = citationOf(spec);
  if (!to || !word || !String(word.ar || "").trim()) return cells;
  if (cells.some((c) => c.row === to.row && c.col === to.col && String(c.ar || "").trim())) return cells;
  return cells
    .filter((c) => !(c.row === to.row && c.col === to.col))
    .concat([{
      ...blankForm(),
      ar: word.ar || "",
      en: word.en || "",
      lat: word.lat || "",
      clips: word.clips || [],
      slowClips: word.slowClips || [],
      row: to.row,
      col: to.col,
      /* Named like every other cell — see initialCells. */
      id: formName(cells.concat(taken as any)),
    }]);
};

/*
 * Which of the three is being made — asked before the editor opens.
 *
 * It was the first field *inside* the editor, which put a teacher in a
 * screen for making a card and then asked what sort of card it was going
 * to be. The three are not variations on one form: a conversation has
 * speakers and turns where a word has forms, a sentence has blanks and
 * fills nothing, and each is dealt and filled by a different path. So the
 * question belongs before the door, and what opens is a screen for making
 * that one — titled with it, laid out for it, and asking nothing further
 * about it.
 *
 * A screen rather than a menu because each answer needs a line saying what
 * it is, which is the same reason what kind of word it is, is a list of
 * rows; and because this is the one decision about a card that cannot be
 * taken back once it is saved (see shapeChoices), so it is worth the tap
 * it costs to read the three.
 */
export function NewCardKind({ onPick, onClose }: {
  onPick: (shape: CardShape) => void;
  onClose: () => void;
}) {
  /* Nothing is chosen to begin with. A card is one of three things and the
     app has no opinion about which; a preselected answer here would be the
     app answering the one question it cannot work out. */
  const [shape, setShape] = useState<CardShape | null>(null);
  return (
    <Screen title="New card" onBack={onClose}>
      <RadioGroup
        label="What kind of card is this?"
        name="new-card-kind"
        options={shapeChoices()}
        value={shape}
        onChange={setShape}
      />
      <Help>
        It cannot be changed afterwards: a card is what a student&rsquo;s
        record of it hangs on, and what other cards&rsquo; blanks are
        written against.
      </Help>
      <div className="at-row at-mt5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!shape} onClick={() => shape && onPick(shape)}>
          Start the card
        </Button>
      </div>
    </Screen>
  );
}

export function CardEditor({ card, lang, decks, inDecks, allCards, onSave, onDelete, onClose, busy, confirming, making = "word", draft = null }: {
  card: Card | null;
  lang: Lang;
  decks: Deck[];
  inDecks?: string[];
  allCards: Card[];
  onSave: (written: { forms: any, note: string, name: string, category: string, sentence: boolean, decks: string[], uses: string[], fills: string[], ref: string, spread: { from: string, to: string }[], stripped: string[], drill: boolean, scene: { title: string, setting: string, speakers: string[], you: number | null, lines: any[] } | null, }) => void;
  onDelete?: () => void;
  onClose: () => void;
  busy?: boolean;
  confirming?: Node;
  /**
   * Which of the three is being made, where a card is being made.
   *
   * A conversation used to have a button of its own, which made it read as
   * a separate sort of thing rather than a kind of card — and meant the
   * Cards tab, with one New button, could not make one at all. Then the
   * question was the first field inside this screen, which put a teacher
   * in a screen for making a card before asking what sort of card it was
   * going to be. It is asked before the door now: New card asks, and this
   * opens for the answer — see NewCardKind. Read only when `card` is null;
   * a card that exists says what it is itself.
   */
  making?: CardShape;
  draft?: Record<string, any> | null;
}) {
  /* And from here down there is one kind of card on this screen and it
     does not change. It is the card's own answer where there is a card,
     and the answer given before this opened where there is not. */
  const shape = card ? shapeOf(card) : making;
  const scene = shape === "scene";
  const word = useWordDraft({ card, lang, allCards, draft, shape });
  const talk = useSceneDraft({ card });
  const [chosen, setChosen] = useState(inDecks || []);
  const canSave = scene ? talk.canSave : word.canSave;
  /* Which of the six editors this card gets: a conversation, a sentence,
     or a word — plainly, or with a table, and the table says which
     editor: one every form carries, one whose rows open one at a time,
     or one the card carries beside the word. */
  const layout = scene
    ? "scene"
    : shape === "sentence"
      ? "sentence"
      : !word.shownSpec
        ? "word"
        : word.perForm
          ? "attached"
          : (word.shownSpec.gate || "word") === "rows"
            ? "verb"
            : "table";
  const selfId = (card && card.id) || "";
  /* Whether there is a connection, for the line above the first field. */
  const offline = useOffline();

  return (
    /* "over" puts this above the mode selector and the corner menu, so
       editing a card is the only thing on screen. */
    <>
      {confirming}
      <Screen
        /* One card, whichever kind it is. The editor used to be named
           after the thing it happened to be editing, which made a
           conversation read as a different sort of object rather than a
           card with turns on it. What kind it is, is said inside. */
        /* Named for what is being made, which is settled before this
           opens: a screen for writing a conversation should not be called
           "New card" and then be full of turns. */
        title={card ? "Edit card" : `New ${shapeLabel(shape).toLowerCase()}`}
        /* One sheet, ruled into sections — see .at-screen.cardform. The
           editor is the only screen laid out that way, so it is the only
           one that asks for it. */
        className="cardform"
        onBack={onClose}
        action={
          <Button variant="primary" size="sm"
            disabled={!canSave || busy}
            onClick={() => onSave(writtenCard({ word, talk, shape, chosen }))}
          >
            <Icon name="save" />
            {busy ? "Saving…" : "Save"}
          </Button>
        }
      >
          {/* Said before the typing rather than after it.
              A save that cannot be made is now kept on the device and sent
              when the connection returns — but a teacher about to write a
              card with four recordings on it should know where they stand
              first, because the recordings are the part that cannot wait:
              they are uploaded as they are made. */}
          {offline && (
            <Notice kind="warn">
              You&apos;re offline. What you write here is saved on this device and goes up when
              you&apos;re back online — but recordings can&apos;t be added until then.
            </Notice>
          )}
          <KindBlock
            card={card}
            lang={lang}
            scene={scene}
            shape={shape}
            word={word}
            /* Whether the card's own words name it, decided here with the
               rest of what tells the kinds apart: a sentence never names
               itself, and a verb does not where the table stands in for
               its word. Everything else is listed under its own word. */
            naming={
              layout === "sentence"
                ? "sentence"
                : layout === "verb" && word.standsIn
                  ? "verb"
                  : null
            }
            decks={decks || []}
            chosen={chosen}
            onToggleDeck={(id, on) =>
              setChosen((x) => (on ? x.filter((y) => y !== id) : x.concat([id])))
            }
          />

          {/* One editor, whichever kind of card this is. Told apart here
              and nowhere else: every block above draws what it is handed,
              and which blocks that is, is each editor's list. */}
          {layout === "scene" ? (
            <SceneEditor talk={talk} lang={lang} allCards={allCards} selfId={selfId} />
          ) : layout === "sentence" ? (
            <SentenceEditor word={word} lang={lang} allCards={allCards} selfId={selfId} />
          ) : layout === "verb" ? (
            <VerbEditor word={word} lang={lang} allCards={allCards} selfId={selfId} />
          ) : layout === "attached" ? (
            <AttachedEditor word={word} lang={lang} allCards={allCards} selfId={selfId} />
          ) : layout === "table" ? (
            <TableEditor word={word} lang={lang} allCards={allCards} selfId={selfId} />
          ) : (
            <WordEditor word={word} lang={lang} allCards={allCards} selfId={selfId} />
          )}

          {card && onDelete && (
            <Button variant="danger" className="at-mt5" onClick={onDelete}>
              Delete this card
            </Button>
          )}
      </Screen>
      <RecordingOverlays word={word} talk={talk} />
    </>
  );
}
