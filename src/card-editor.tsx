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
import React, { useState, useEffect, useMemo, useRef } from "react";
import * as API from "./courses-api.ts";
import type { Card, Deck, GrammarDim, Lang, VerbSpec, VerbTense } from "./types.ts";
import { cellsIn, citationOf, citedWord, isCell, personsOf, rowIdsOf, tensesOf } from "./verbs.ts";
import { leadOf, subFormsOf } from "./cards.ts";
import type { Node } from "./shared.tsx";
import {
  categoriesOf,
  categoryOf,
  categoryLabel,
  dimsFor,
  lendsForm,
  dimValues,
  specOf,
  tablesOf,
  findWordSlot,
  answerFields,
  guessKind,
  kindLabel,
  kindOf,
  labelFor,
  supportsContext,
  scriptVars,
} from "./languages.ts";
import { MAX_SPEAKERS, isDialog, namedPart, sideOf } from "./dialogs.ts";
import { answerRows, packAnswers } from "./answers.ts";
import { cardRef, dropRail, fillNames, fillsOf, fillText, isSentence, MAX_FILLS, movedSlot, refClash, slotName, slotsIn, slotsOf, slotTrouble, valuesFor, valuesForTurn, withSlotAt, WORD_SLOT } from "./variables.ts";
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
function Alternatives({ value, onChange, render, addLabel = "Add another accepted answer" }: {
  value?: string;
  onChange: (value: string) => void;
  render: (value: string, onChange: (v: string) => void) => Node;
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
  return (
    <div className="at-alts">
      {list.map((v, i) => (
        <div className="at-altrow" key={i}>
          <div className="at-altfield">
            {render(v, (nv) => commit(list.map((x, j) => (j === i ? nv : x))))}
          </div>
          {list.length > 1 && (
            <IconButton icon="remove" label="Remove this answer" onClick={() => commit(list.filter((_, j) => j !== i))} />
          )}
          {i === list.length - 1 && (
            <IconButton icon="add" label={addLabel} onClick={() => commit(list.concat([""]))} />
          )}
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
function ScriptAnswers({ lang, dims, form, onChange, blanks }: {
  lang: Lang;
  /* The axes this word is asked about — the kind of word's own list, not
     the pack's: a preposition has neither number nor gender, and a form
     that shows the controls anyway is a form asking a question nobody can
     answer. See dimsFor. What is stored is never narrowed by this. */
  dims: GrammarDim[];
  form: Record<string, any>;
  onChange: (next: { ar: string; lat: string; answers: Record<string, any>[] }) => void;
  /* What a sentence's fields need in order to have blanks put into them,
     and nothing on a word: only a sentence may have one. Two bars per row
     rather than one, because the script and how it is said are two fields
     that must leave the same blanks, and the whole point of the bar is
     that keeping them in step is a tap. */
  blanks?: BlankWiring;
}) {
  const fields = answerFields();
  const [rows, setRows] = useState(() => answerRows(form, fields));
  const [open, setOpen] = useState<number | null>(null);
  /* The same rule as Alternatives above, and for the same reason: these
     rows were read off the form once, and a blank written into the card
     from outside would otherwise change the card and not the screen. What
     went up is what an outside change is measured against. */
  const sent = useRef(`${form.ar || ""}\u0000${form.lat || ""}`);
  useEffect(() => {
    const now = `${form.ar || ""}\u0000${form.lat || ""}`;
    if (now === sent.current) return;
    sent.current = now;
    setRows(answerRows(form, fields));
  }, [form, fields]);
  const commit = (next: Answer[]) => {
    setRows(next);
    const packed = packAnswers(next, fields);
    sent.current = `${packed.ar}\u0000${packed.lat}`;
    onChange(packed);
  };
  const edit = (i: number, patch: Partial<Answer>) => commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
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
              >
                {(box) => (
                  <ScriptInput
                    lang={lang}
                    value={row.text}
                    onChange={(v) => edit(i, { text: v })}
                    inputRef={box}
                  />
                )}
              </BlankField>
            ) : (
              <ScriptInput lang={lang} value={row.text} onChange={(v) => edit(i, { text: v })} />
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
                  <input
                    ref={box}
                    className="at-input"
                    value={row.lat}
                    aria-label={
                      rows.length > 1
                        ? `${lang.translitLabel} of accepted answer ${i + 1}`
                        : lang.translitLabel
                    }
                    placeholder={lang.translitLabel.toLowerCase()}
                    onChange={(e) => edit(i, { lat: e.target.value })}
                  />
                )}
              </BlankField>
            </div>
          ) : (
            <input
              className="at-input at-answersaid"
              value={row.lat}
              aria-label={
                rows.length > 1
                  ? `${lang.translitLabel} of accepted answer ${i + 1}`
                  : lang.translitLabel
              }
              placeholder={lang.translitLabel.toLowerCase()}
              onChange={(e) => edit(i, { lat: e.target.value })}
            />
          )}
          {dims.length > 0 && (
            <div className="at-answergrammar">
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
              {open === i && (
                <div className="at-answerdims">
                  {dims.map((dim) => (
                    <Field label={dim.label} key={dim.field}>
                      <Segmented
                        label={`${dim.label} of accepted answer ${i + 1}`}
                        options={dim.options.map(([value, label]) => ({ value, label }))}
                        value={String(row[dim.field] || "")}
                        onChange={(v) => edit(i, { [dim.field]: v })}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* Exported for the Numbers screen, which is fifty-five of these boxes in a
   grid and has exactly the same need: a field in the language's script,
   laid out by its direction, with the on-screen keys a click away. A
   second implementation of it there would be a second place for the caret
   handling and the direction rule to drift. */
export function ScriptInput({ lang, value, onChange, compact = false, label, inputRef }: {
  lang: Lang;
  value?: string;
  onChange: (value: string) => void;
  /**
   * A handle on the box itself, for a caller that needs one — the blank
   * bar, which reads where the caret was when a chip was tapped. Handed
   * out rather than made public, so this component goes on owning the
   * keypad's focus handling and a caller cannot take it over by holding
   * the same ref.
   */
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  /**
   * What to call this box where the label above it does not say — in a
   * table, where one heading stands over twenty-one boxes and only the row
   * and column say which is which. The two boxes beside it in a cell have
   * carried their own names since the table was written; this one had
   * none, which on the languages whose dictionary form is a cell now
   * leaves the field the whole card is identified by unnamed.
   */
  label?: string;
  /**
   * A shorter box, for where there are many of them. A verb's table is
   * twenty-one of these on one screen, and at the size a single field is
   * written at it scrolls for a thousand pixels. Only the script shrinks —
   * still the largest thing on its line, because it is the thing being
   * read — and only where a caller asks.
   */
  compact?: boolean;
}) {
  const [keys, setKeys] = useState(false);
  const ref: React.MutableRefObject<HTMLInputElement | null> = useRef(null);

  return (
    <>
      {/* The button belongs at the end of the line, which the deck's
          language decides — not the field's own dir, which is "auto" and
          would send the button across the field as soon as an English word
          was typed into an Arabic deck. */}
      <div className={`at-inputwrap${lang.direction === "rtl" ? " rtl" : ""}`}>
        <input
          ref={(el) => {
            ref.current = el;
            if (inputRef) inputRef.current = el;
          }}
          className="at-input"
          lang={lang.id}
          aria-label={label}
          /* The text decides, once there is any: dir="auto" lays the field out
             by its own first strong character, so a pasted Arabic phrase reads
             right-to-left even if the deck is labelled with another language.
             Trusting the deck's direction is what put pasted words in the
             wrong order. While the field is empty there is nothing to go on,
             so the language's own direction places the caret. */
          dir={value ? "auto" : lang.direction}
          /* The room for the keys button is reserved by .at-inputwrap in the
             stylesheet — physical right, not logical, because the button is
             at right:8px whichever way the text runs. */
          style={{
            fontFamily: lang.fontStack,
            fontSize: compact ? 18 : 22,
            textAlign: "start",
            ...scriptVars(lang),
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
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
                onClick={() => {
                  onChange(value + k);
                  if (ref.current) ref.current.focus();
                }}
              >
                {k}
              </button>
            ))}
          {lang.keys.marks.map((m, i) => (
            <button
              key={"m" + i}
              className="at-key mark"
              onClick={() => {
                onChange(value + m);
                if (ref.current) ref.current.focus();
              }}
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
      <ClipList clips={made} />
      <div className="at-chips" style={{ marginTop: made.length ? 10 : 0 }}>
        <Button size="sm" onClick={onOpen} icon="mic">
          {made.length ? "Record or upload" : "Add a recording"}
        </Button>
      </div>
      {!made.length && (
        <Help>
          A recording lets this form be practiced by ear as well as by sight.
          You can make one at regular speed, a slow one, or both.
        </Help>
      )}
    </Field>
  );
}

/*
 * Making them: a screen of its own, one section per speed.
 *
 * One recorder rather than two, pointed at whichever section asked for it —
 * two would mean two live microphones the moment somebody pressed the
 * second button while the first was still running.
 */
function RecordingScreen({ title, form, onChange, onClose }: {
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
        Record either, both or neither. A card with no recording is still a
        card — it just cannot be practiced by ear.
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
 * Laid out down the page rather than across it. A grid of seven columns is
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
 * Seventeen boxes is more typing than three and it is typing that produces
 * something true.
 */
/* What to call one cell out loud — "past · she". Read off the language's
   own labels, so a pack that names no persons says only its tense. */
function cellLabel(spec: VerbSpec | null, at: { row: string, col: string }) {
  const tense = tensesOf(spec).find((t) => t.id === at.row);
  const person = personsOf(spec).find((p) => p.id === at.col);
  return [tense ? tense.label : at.row, person ? person.label : ""].filter(Boolean).join(" · ");
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

  /* One cell written, added or dropped. A cell with nothing in any of its
     fields is not a blank the teacher is coming back to — it is a form the
     language has not got — so it leaves the list rather than being saved
     empty. */
  const write = (row: string, col: string, patch: Record<string, any>) => {
    const had = at(row, col);
    const next = {
      ...(had || { ...blankForm(), row, col, ...(of ? { of } : null), id: mint() }),
      ...patch,
    };
    const keep = ["ar", "en", "lat"].some((f) => String(next[f] || "").trim());
    if (!keep) {
      onChange(cells.filter((c) => !(c.row === row && c.col === col && mine(c))));
      return;
    }
    /*
     * In place, so a cell keeps where it sits in the list.
     *
     * Every keystroke used to drop the cell and push it back on the end,
     * which on a student's device — where a form carrying no name of its
     * own is known by its position — handed the cells below it the
     * schedules of their neighbours. They carry names now, and the order
     * is still worth keeping: it is what carries a table written before
     * they had one across its first save.
     */
    onChange(had ? cells.map((c) => (c === had ? next : c)) : cells.concat([next]));
  };

  const persons = personsOf(spec);
  /* A language whose verbs do not vary by person has one column and no
     word for it, and a line reading "any: đã ăn" would be naming something
     the language does not distinguish. */
  const named = persons.some((p) => p.label);
  /* A box for the pronunciation only where the language asks for one to be
     written. Huế calls it a note and never drills it, so a column of them
     across a whole table would be twenty-one boxes nothing reads — the
     note belongs on the verb itself, which still has its own field below. */
  const saysHow = lang.translitDrilled !== false;

  /* One row of the table, whether it stands on its own or inside the block
     of the form it belongs to. A table hung off a form is a part of that
     form rather than a section beside it, so there it is a group of fields
     under a line of its own — the same thing "Drilled in exercises" and
     "Reference — not drilled" are in the blocks above. */
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
            const written = !!(cell && String(cell.ar || "").trim());
            const heard = cell ? clipsOf(cell).length : 0;
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
                <div className="at-cellfields">
                  <ScriptInput
                    compact
                    lang={lang}
                    label={`${lang.scriptLabel} for ${which}`}
                    value={(cell && cell.ar) || ""}
                    onChange={(v) => write(tense.id, person.id, { ar: v })}
                  />
                  {saysHow && (
                    <input
                      className="at-input"
                      aria-label={`${lang.translitLabel} for ${which}`}
                      value={(cell && cell.lat) || ""}
                      placeholder={lang.translitLabel.toLowerCase()}
                      onChange={(e) => write(tense.id, person.id, { lat: e.target.value })}
                    />
                  )}
                  <input
                    className="at-input"
                    aria-label={`English for ${which}`}
                    value={(cell && cell.en) || ""}
                    placeholder="English"
                    onChange={(e) => write(tense.id, person.id, { en: e.target.value })}
                  />
                </div>
                {/* One button rather than the Recordings block the forms
                    below get: a list and an explanation under every one of
                    twenty-one cells would be the table's whole height
                    again. It says how many there are, and opens the same
                    screen. Off until there is a word to say — a recording
                    of an empty cell is a recording of nothing. */}
                <IconButton
                  icon="mic"
                  label={
                    heard
                      ? `${heard} ${plural(heard, "recording")} · ${which}`
                      : `Record ${which}`
                  }
                  className={`at-cellmic${heard ? " on" : ""}`}
                  disabled={!written}
                  onClick={() => onRecord(tense.id, person.id)}
                />
              </div>
            );
      })}
    </>
  );

  if (inline) {
    return (
      <>
        {tensesOf(spec).map((tense, at_) => (
          <div key={tense.id}>
            <p className="at-groupline">{tense.label}</p>
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
  /* The state in the room a button has: the deck itself when there is one,
     how many when there are several, and the plain fact when there are
     none — which is a card no student will ever see, and worth reading as
     a state rather than as an empty space. */
  const said = !all.length
    ? "No decks yet"
    : !inThese.length
      ? "In no deck"
      : inThese.length === 1
        ? inThese[0].title
        : `${inThese.length} decks`;

  return (
    <div className="at-chooser" ref={mine}>
      <button
        className={`at-choosebtn${inThese.length ? " on" : ""}`}
        aria-expanded={open}
        aria-label={`Decks — ${said.toLowerCase()}. Choose which.`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="folder" size={16} />
        <span className="at-choosemark">{said}</span>
      </button>

      {open && (
        <div className="at-choosemenu">
          <p className="at-eyebrow">Decks</p>
          <CheckList
            options={all.map((d) => ({
              id: d.id,
              title: d.title,
              note: plural(d.cardCount || 0, "card"),
            }))}
            chosen={chosen}
            onToggle={onToggle}
            empty="You have no decks yet. Make one under Decks, then this card can go in it."
          />
          {all.length > 0 && (
            <Help>A student sees this card only where it is in a deck their course uses.</Help>
          )}
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
function BlankField({ wiring, value, onChange, label, lang, children }: {
  wiring: BlankWiring;
  value: string;
  onChange: (v: string) => void;
  label: string;
  lang: Lang;
  children: (ref: React.MutableRefObject<HTMLInputElement | null>) => Node;
}) {
  const box: React.MutableRefObject<HTMLInputElement | null> = useRef(null);
  return (
    <>
      {children(box)}
      <BlankBar
        wiring={wiring}
        value={value}
        onChange={onChange}
        label={label}
        lang={lang}
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

function BlankBar({ wiring, value, onChange, label, lang, box }: {
  wiring: BlankWiring;
  value: string;
  onChange: (v: string) => void;
  label: string;
  lang: Lang;
  box: React.MutableRefObject<HTMLInputElement | null>;
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
    if (!at) return value.length;
    const put = at.selectionStart;
    return typeof put === "number" ? put : value.length;
  };

  /* One blank put down at one offset: moved where it is already in this
     field, put in where it is not. Both go through the same two functions
     every other writer of a blank goes through. */
  const put = (name: string, at: number) =>
    onChange(here.includes(name) ? movedSlot(value, name, at) : withSlotAt(value, name, at));

  /* A blank already in this field, tapped: shown rather than moved. The
     teacher asked where it is, and the answer is to put the caret round it
     — moving it is what the drag is for, and a tap that moved it would
     move it somewhere nobody pointed at. */
  const show = (name: string) => {
    const at = box.current;
    const span = rail.points;
    if (!at || !span.length) return;
    const found = value.toLowerCase().indexOf(`{{${name}}}`);
    if (found < 0) return;
    at.focus();
    at.setSelectionRange(found, found + name.length + 4);
  };

  const tap = (name: string) => (here.includes(name) ? show(name) : put(name, caret()));

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
          lang={lang.id}
          dir={lang.direction}
          style={{ fontFamily: lang.fontStack, ...scriptVars(lang) }}
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

      <div className="at-blankpills">
        {wiring.names.map((name) => (
          <button
            key={name}
            type="button"
            className={`at-blankpill${here.includes(name) ? " in" : ""}${dragging === name ? " lifted" : ""}`}
            /* What the chip is for, said in full: on a bar under a field
               the difference between a blank that is in it and one that is
               not is the whole of the control, and a chip reading only
               "name" says neither. */
            aria-label={
              here.includes(name)
                ? `{{${name}}} is in ${label}. Tap to find it, drag to move it.`
                : `Put {{${name}}} into ${label}`
            }
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
              <b>{`{{${name}}}`}</b>
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
                    {`{{${offer.name}}}`}
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
 * Which of the three a card opens as.
 *
 * A conversation by its turns, as everything else reads one. A **sentence**
 * by the teacher's own answer, kept on the card — see `isSentence`, which
 * carries the rule and the reading of a card written before there was
 * anything to keep.
 *
 * It was read off the braces until 0.176, and that is the thing this no
 * longer does. The editor asked which kind of card this was, offered three
 * answers and stored none of them, so the answer was worked out again from
 * the words every time the card was opened: a sentence typed out before
 * its first blank came back as a word, and a blank typed into a word with
 * a table under it came back as a sentence, hid the table and offered to
 * drop it. Reading a card is not the same as being told, and the kind of
 * card is something a teacher is entitled to say.
 */
export const shapeOf = (card: Card | null | undefined, scene: boolean): CardShape =>
  scene ? "scene" : isSentence(card) ? "sentence" : "word";

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
  categoriesOf(lang).map((c) => ({ value: c.id, label: c.label, note: c.note }));

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
 * Which answers are still open, which is a different question on a card
 * that exists.
 *
 * A written card does not change into a conversation and a conversation
 * does not stop being one — a scene with four turns on it would have
 * nowhere to put them. A word whose table has anything in it does not stop
 * having one either, and for the same reason: the table is the content, so
 * offering the change would be offering to throw it away, which until 0.120
 * it quietly did.
 *
 * What stays open is the direction that loses nothing — a saved word with
 * an empty table can still be given one, and a verb is usually written as a
 * plain word and given its tenses weeks later.
 */
export const shapeChoices = (
  { saved, shape, table }: { saved: boolean; shape: CardShape; table: CardForms },
): { value: CardShape; label: string }[] => {
  const word = { value: "word" as const, label: "Word" };
  const line = { value: "sentence" as const, label: "Sentence" };
  const talk = { value: "scene" as const, label: "Conversation" };
  if (!saved) return [word, line, talk];
  if (shape === "scene") return [];
  /* A table is content, so a card that has one is not offered the shape
     that has nowhere to keep it — the same rule that stops a verb being
     turned back into a plain word. A word and a sentence are otherwise the
     same card written two ways, so that pair stays open in both
     directions: writing a blank into a word is how most sentences start. */
  return table ? [word] : [word, line];
};

/* ------------------------------------------------------------------
   What a card is, before anything is drawn

   The rules the editor stands on, as plain functions of a card or a draft:
   which forms it opens with, which table it lays out, what a save carries
   and whether there is anything to save. Kept out of the component so a
   test can ask them without a screen, and so the editors below read one
   answer rather than each working it out.
   ------------------------------------------------------------------ */

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
    },
  ];
  for (const s of subFormsOf(card).filter((f) => !isCell(f))) {
    out.push({ ...blankForm(), ...s, id: String(s.id || "") || formName(out) });
  }
  return out;
}

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
  return cited ? seedCited(had, leadOf(card), cited, taken()) : had;
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

/* ---- what is asked about ----

   A card is one word and a pile of forms of it: other spellings, the
   pronouns a language puts on its end, every person and tense of a verb.
   Until now all of it was drilled, and the only way to stop any of it
   being drilled was to delete it — which takes its recordings and every
   student's progress with it.

   So each of those is a thing that can be switched off and kept: written
   on the card, shown to a student who opens it, and never asked about.
   What is stored is the switched-off ones, on the forms themselves, so a
   card written before this and a form added after are both asked — see
   `ask` in types.ts. */

/** One line of the section: a part of the card, and whether it is asked. */
export interface AskPart {
  /** What it covers, in the editor's own terms — see setAskPart. */
  id: string;
  title: string;
  note: string;
  on: boolean;
}

/** Whether a form of the draft is asked about. Absent means yes. */
export const partAsked = (form: { ask?: boolean } | null | undefined): boolean =>
  !!form && form.ask !== false;

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

/*
 * How many filled examples of a card with blanks the editor prints.
 *
 * Five rather than three: three is enough to read as "and so on", and the
 * examples are now a subsection of their own rather than a preface to the
 * holes, so what they are for is being read down — how much the card
 * actually varies, and whether the words standing in it are the ones the
 * teacher meant. Five is that, and still short enough to take in at once.
 */
const EXAMPLES_SHOWN = 5;

/**
 * One example of a card with a blank in it, as a student will meet it: the
 * frame with its holes filled, in each of the three fields it is written
 * in. A field the card leaves empty comes back empty.
 */
export interface Asked {
  ar: string;
  lat: string;
  en: string;
}

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
  const [forms, setForms] = useState(() => initialForms(card, draft));
  /* The card's cells, whichever tables they sit in. Kept beside `forms`
     rather than inside it because the two are edited in different shapes
     — a list of blocks, and a table — and joined again at save. */
  const [cells, setCells] = useState<Record<string, any>[]>(() => initialCells(card, lang));
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
  /* Whether every form carries the table, or the card does. */
  const perForm = !!(shownSpec && shownSpec.perForm);
  /* What the stored card already carries, which is what the radio may no
     longer take away — see storedFormsOf. */
  const storedForms: CardForms = storedFormsOf(card, lang);
  /* What this language lets a word be — see categoryOffers. */
  const categoryOffer = categoryOffers(lang, { worded, storedForms });
  /* How much of a table is being held aside — what the line under the
     radio counts. */
  const aside = asideOf(cells, Object.values(tablesOf(lang)), shownSpec, forms);
  /* A name for a cell nobody has written yet, free of every name this card
     already uses — its forms' and its other cells'. One place, because a
     cell and a form are told apart by nothing but their names. */
  const mintCell = () => formName([...forms, ...cells]);
  /*
   * On the way in to a table that cites a cell — a verb's — the card's own
   * word moves into the cell about to hold it, rather than being left
   * behind in a block that has just disappeared; and only into an empty
   * cell, because a card that already has a table knows better than the
   * block does. Nothing of the sort for a table that cites nothing: the
   * word stays the word, and the cells are forms of it rather than a
   * stand-in for it.
   */
  const chooseCategory = (next: string) => {
    setCategory(next);
    const spec = specOf(lang, tableFor(lang, next));
    if (citationOf(spec)) setCells((x) => seedCited(x, forms[0], spec, forms));
  };
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
  const addFill = (name: string) =>
    setFills((was) =>
      !name || was.includes(name) || was.length >= MAX_FILLS ? was : was.concat([name]),
    );
  const dropFill = (name: string) => setFills((was) => was.filter((had) => had !== name));
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
  /* What already answers to the name being typed — another card's ID, or a
     group tag. Both go between braces, so a name is free of both or it is
     not free. */
  const refHeld = useMemo(
    () => (refName ? refClash(refName, (allCards || []) as unknown as Record<string, unknown>[], (card && card.id) || "") : null),
    [refName, allCards, card],
  );
  const refFree = !!refName && !refHeld;
  /* The same question asked of any name, for the other half of the
     section: a group tag renamed onto a card's ID would be two things
     answering to one `{{x}}`, which is the whole of what the ID is for
     preventing. */
  const nameHeld = (name: string) =>
    refClash(name, (allCards || []) as unknown as Record<string, unknown>[], (card && card.id) || "");
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
   * Whether it is practised in its own right — and null where nobody has
   * said, which is every new card.
   *
   * Unsaid is not the same as no: it means "whatever this card looks like",
   * and a card that fills a variable looks like a value, which is not a
   * question. Derived rather than flipped by a side effect when the field
   * is typed into, so what the toggle shows is always what will be saved
   * and nothing changes under the teacher's hand.
   */
  const [drillChoice, setDrillChoice] = useState<boolean | null>(
    card ? card.drill !== false : null
  );
  const drill = drillChoice === null ? !fills.length : drillChoice;
  /* Which words this phrase teaches. Confirmed, never assumed: the matcher
     below proposes and the teacher decides, because peeling prefixes off an
     Arabic word occasionally lands on a different real one. */
  const [uses, setUses] = useState((card && card.uses) || []);
  /* Which form's recordings are being made, or null. The screen for them
     opens over this one and hands its results straight back into the form,
     so nothing about a card is saved any earlier than it was. */
  const [recording, setRecording] = useState<number | null>(null);

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
  const main = standsIn ? citedWord(forms[0], citedAt) : forms[0];
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
  /* Memoised for what reads it below: a fresh array every render would
     re-fill the preview sentences on every keystroke in any field. */
  const holes = useMemo(() => (scene ? [] : slotsOf(main)), [scene, main]);
  /* The card's word as it will be saved, then whatever else it carries —
     so a hole the cited cell leaves is checked against the fields beside
     it rather than against a block nobody is filling in. */
  const ownForms = [main].concat(forms.slice(1));
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
    const words = new Map<string, number>();
    const used = new Map<string, number>();
    const said = new Map<string, number>();
    let anyWord = 0;
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      /* What a card fills — see fillsOf, which is the one answer and which
         this has to agree with. A sentence fills nothing at all, whether or
         not it has got its blanks yet: it is a sentence, not a word. Every
         name it gives, because a card may now say it fills several and each
         of them is a blank with one more word behind it. */
      const named = fillNames(c);
      if (!isSentence(c)) {
        for (const name of named) words.set(name, (words.get(name) || 0) + 1);
        if (!named.length && kindOf(c, lang) === "word") anyWord++;
        const category = String(c.category || "").toLowerCase();
        if (category) said.set(category, (said.get(category) || 0) + 1);
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
        words: anyWord,
        used: used.get(WORD_SLOT) || 0,
        wrote: words.get(WORD_SLOT) || 0,
        built: "any" as const,
      },
      ...categoriesOf(lang).map((c) => ({
        name: c.id,
        words: said.get(c.id) || 0,
        used: used.get(c.id) || 0,
        wrote: words.get(c.id) || 0,
        built: "category" as const,
      })),
    ];
    const names = [...new Set([...words.keys(), ...used.keys()])]
      .filter((n) => !builtIn.some((b) => b.name === n))
      .sort();
    /* One row shape over both kinds, so a reader can ask any row whether
       it is built in — the list that leaves the built-in ones out reads
       that field, and a union of two shapes cannot be asked. */
    const rows: Blank[] = [
      ...builtIn,
      ...names.map((name) => ({
        name,
        words: words.get(name) || 0,
        used: used.get(name) || 0,
        wrote: words.get(name) || 0,
      })),
    ];
    return rows;
  }, [allCards, lang]);

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
    /*
     * How many words are behind each name, counted the way the question
     * will count them: through `fillsOf`, which is the one answer to what
     * a card fills and which the trainer fills a hole from.
     *
     * Not off the rows above, which keep the two halves of a name apart —
     * how many cards *say* they are a noun, and how many *tag* themselves
     * with the word. A name can be both: Arabic declares `name` as a kind
     * of word and `{{name}}` is the oldest frame in the app, filled by the
     * names a teacher has tagged. Counting one half and calling it the
     * total told a teacher that the blank they were about to write had
     * nothing behind it while two cards stood ready to fill it.
     */
    const behind = new Map<string, number>();
    for (const c of allCards || []) {
      if (lang && c.lang && c.lang !== lang.id) continue;
      for (const name of fillsOf(c, kindOf(c, lang))) {
        behind.set(name, (behind.get(name) || 0) + 1);
      }
    }
    const rows: BlankOffer[] = [];
    for (const b of blanksAround) {
      const words = behind.get(b.name) || 0;
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
  }, [blanksAround, allCards, lang, card]);

  /*
   * The words each of this card's blanks can be filled with, today.
   *
   * Worked out once and read three ways — the example sentences below, the
   * blanks nothing fills yet, and the list a teacher gets by hovering a
   * blank. It was worked out twice, identically, by the first two of those,
   * which is two answers to one question waiting to disagree.
   */
  const fillers = useMemo(() => {
    if (scene || !holes.length) return {} as Record<string, Value[]>;
    return valuesFor(main, allCards || [], lang && lang.id, (c) => kindOf(c, lang), (c, f) => lendsForm(lang, c)(f));
  }, [scene, holes, main, allCards, lang]);

  /*
   * The sentences a student will be asked, filled from the words that
   * exist today.
   *
   * This is the explanation the section used to attempt in ninety words.
   * Five of them, in a subsection of their own: three read as "and so on",
   * and a teacher reading down a list of five sees the variety behind the
   * blanks — that these are the names, or that two of the three words
   * behind it are the same word twice. Distinct, because a blank with one
   * word in it would otherwise print the same sentence five times and look
   * broken. Empty where nothing fills a blank yet, which is its own answer.
   *
   * All three fields, because a teacher writing an Arabic frame is owed
   * the Arabic sentence: the preview showed the English alone, which is
   * the one line of the question the learner is never asked to produce.
   * A field the card does not use — a card with no transliteration — comes
   * back empty and is not drawn; a field whose filler has nothing to put
   * in it keeps the braces standing, exactly as the question would, which
   * is the teacher's answer about the card they have written.
   *
   * The turns are walked well past the five wanted: `valuesForTurn` counts
   * through the combinations, so a card whose blanks repeat a sentence —
   * two holes filled from one word each — spends turns without adding a
   * line, and stopping at five turns would show two examples where five
   * exist.
   */
  const asked = useMemo(() => {
    if (scene || !holes.length) return [];
    const out: Asked[] = [];
    for (let turn = 0; turn < 40 && out.length < EXAMPLES_SHOWN; turn++) {
      const took = valuesForTurn(holes, fillers, turn);
      if (!took) break;
      const line = {
        ar: fillText(main.ar, took, "ar").trim(),
        lat: fillText(main.lat, took, "lat").trim(),
        en: fillText(main.en, took, "en").trim(),
      };
      if (!line.ar && !line.lat && !line.en) continue;
      if (out.some((had) => had.ar === line.ar && had.lat === line.lat && had.en === line.en)) continue;
      out.push(line);
    }
    return out;
  }, [scene, holes, main, fillers]);

  /* Which blanks have nothing to put in them — the reason a card with a
     hole in it is never asked, named rather than left to be discovered. */
  const starved = useMemo(
    () => holes.filter((slot) => !(fillers[slot] || []).length),
    [holes, fillers],
  );
  const setForm: (i: number, next: any) => void = (i, next) => setForms((f) => f.map((x, j) => (j === i ? next : x)));

  /*
   * And the ID, which a card cannot be saved without.
   *
   * Asked of a new card, because that is the moment the teacher is naming
   * the thing and the moment nothing else points at it yet. An older card
   * carries none until somebody opens it and gives it one, so editing a
   * recording on a card written last year is not a demand to name it —
   * but a name that is *taken* stops a save whatever the card's age,
   * because two cards answering to one name is the one thing the ID is
   * for preventing.
   */
  const refOk = (!refName || refFree) && (!!card || scene || refFree);
  const canSave = canSaveWord(main, trouble) && refOk && !strayHoles.length;

  /* Another form, named so that its own cells can point at it. No number
     override beyond the name: blankForm takes the language's declared
     default, so what a new form starts as is settled in one place. */
  const addForm = () => setForms((f) => f.concat([{ ...blankForm(), id: formName(f) }]));
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
   * Switching one of them off, or back on.
   *
   * The answer goes on the forms the part covers, because that is where
   * everything reads it. A part is the editor's word for a group of forms
   * and nothing more; storing the grouping as well would be a second
   * answer to what a card is made of, which is the thing this codebase
   * keeps having to remove.
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
   */
  const setAskPart = (id: string, on: boolean) => {
    const set = (f: Record<string, any>) => {
      const next = { ...f };
      if (on) delete next.ask;
      else next.ask = false;
      return next;
    };
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
        if (!on && waitsOnWord(shownSpec) && String(c.of || "") === mine) return set(c);
        return c;
      }),
    );
  };

  return {
    addForm,
    duplicateForm,
    removeForm,
    drillsTranslit,
    forms,
    setForms,
    cells,
    setCells,
    mintCell,
    category,
    setCategory,
    table,
    shownSpec,
    perForm,
    cite,
    storedForms,
    categoryOffer,
    aside,
    chooseCategory,
    standsIn,
    recordingCell,
    setRecordingCell,
    cellHere,
    note,
    name,
    setName,
    fills,
    setFills,
    addFill,
    dropFill,
    fillsOffer,
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
    setDrillChoice,
    drill,
    uses,
    setUses,
    recording,
    setRecording,
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
    trouble,
    blanksAround,
    blankOffer,
    asked,
    starved,
    fillers,
    canSave,
    setForm,
    parts,
    setAskPart,
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
function KindBlock({ card, lang, scene, shape, choices, onShape, word, decks, chosen, onToggleDeck }: {
  card: Card | null;
  lang: Lang;
  scene: boolean;
  shape: CardShape;
  choices: { value: CardShape; label: string }[];
  onShape: (next: CardShape) => void;
  word: WordDraft;
  decks: Deck[];
  chosen: string[];
  onToggleDeck: (id: string, on: boolean) => void;
}) {
  const { category, chooseCategory, categoryOffer, aside, storedForms } = word;
  return (
    <>
    {/* What kind of card this is — the first thing about it, and for
        a new one the first decision. Word, phrase and sentence are
        not offered because they are not chosen: the language reads
        them off the text. Whether somebody answers it is the one
        thing no amount of reading the script will tell you.

        Two questions, not one. A verb was a third answer here for a
        release, and it stopped working the moment there was a second
        table to offer: four answers on a track that already ran off a
        phone at three, and a list mixing "a different shape of card"
        with "a word with more said about it". What a word lays out is
        asked underneath, where the answers are alternatives to each
        other. */}
    <div className="at-formblock">
      <div className="at-formhead">
        <span className="at-formnum">The kind of card</span>
        {card && (
          <span className="at-formrole">
            {/* What the card is, said in the line beside the heading. A
                sentence says so itself rather than falling through to
                what its words look like: `kindOf` reads the text, and a
                frame of three words reads as a phrase — which is a
                sentence card labelled "Phrase" directly under the answer
                calling it a sentence. */}
            {shape === "sentence"
              ? "Sentence"
              : categoryLabel(lang, category) || kindLabel(kindOf(card, lang))}
          </span>
        )}
      </div>
      {choices.length > 1 ? (
        <>
          {/* Full-width, for the reason the language picker above is:
              the compact variant sizes every option to the longest
              label and never wraps. */}
          <Segmented
            size={null}
            label="The kind of card"
            options={choices}
            value={shape}
            onChange={onShape}
          />
          <Help>
            {shape === "scene"
              ? "Turns, in order, with somebody saying each one. Every turn is practised in its own right, and the whole scene as well."
              : shape === "sentence"
                ? "A sentence with a blank in it, filled by another card — a noun, a verb, or a blank you name — and by a different one each time it is asked."
                : "One thing to learn, with its meaning. Whether it counts as a word or a phrase is read off what you write."}
          </Help>
        </>
      ) : (
        <Help>
          {isDialog(card)
            ? "A conversation: turns, in order, each practised in its own right."
            : "Read off what the card says. A card with a table does not change kind once it is written."}
        </Help>
      )}

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

          A radio rather than segments, because each answer needs a
          line saying what it means, which is what a row of ticks is
          for and what a track of segments cannot hold.

          Asked only of a word: a conversation has turns where a word
          has forms, and there is nothing for a table to lay out. */}
      {categoryOffer.length > 0 && (
        <div className="at-mt3">
          <RadioGroup
            label="What kind of word"
            name="card-category"
            options={categoryOffer}
            value={category}
            onChange={chooseCategory}
          />
        </div>
      )}
      {/* A table put aside is not thrown away until the card is saved, and
          saying so is the only warning there is. Outside the radio above,
          because calling the card a sentence puts a table aside as surely
          as calling it something else does — and a sentence is asked no
          radio, so a warning that lived inside one would have been the
          silent half of the same drop. */}
      {aside > 0 && (
        <p className="at-formneed unmet">
          {word.shownSpec ? "Its other table is" : "Its table is"} put aside —{" "}
          {plural(aside, "box", "boxes")} filled in. Saving it this way drops them.
        </p>
      )}
      {/* And where it cannot be asked, because the card already has
          one: the table is the content, so offering the change would
          be offering to throw it away. */}
      {!scene && storedForms && (
        <Help className="at-mt3">{storedHelp(specOf(lang, storedForms))}</Help>
      )}

      {/* And where it goes, which is the other fact about the card
          rather than about its words — and the one that decides
          whether anybody ever sees it. */}
      <div className="at-mt3">
        <DeckSwitch decks={decks} chosen={chosen} onToggle={onToggleDeck} />
      </div>
    </div>
    </>
  );
}

/* What a saved card's table makes it, in the words the table gives. */
const storedHelp = (spec: VerbSpec | null): string => {
  if (!spec) return "";
  if ((spec.gate || "word") === "rows") {
    return "A verb: its forms are its table, each practised in its own right. Empty the table and it is a word again.";
  }
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
 */
function NameBlock({ word, of }: { word: WordDraft; of: "verb" | "sentence" }) {
  const { shownSpec, name, setName } = word;
  const verb = of === "verb";
  /* A verb only where the table stands in for the card's own word. Where a
     language cites nothing — Huế cites the bare verb — the card has a word
     of its own and is named by it. A sentence always: every one of them is
     a frame, which is the whole of what a sentence is. */
  if (verb && (!shownSpec || !citationOf(shownSpec))) return null;
  return (
    <>
    {/* ---- what to call it ----

        A verb in a language with no infinitive is saved as the form a
        dictionary lists — Arabic's he-past — so a list read as "he
        ate", which names one cell of the table rather than the verb
        the card is about. A sentence is listed as itself, braces and
        all: "{{name}} is heavy" names the shape of the card rather
        than what it is for, and every frame in a deck reads as the
        hole in it. Nothing is wrong with either card; neither simply
        has a name of its own to be listed under.

        Not the block 0.114 took away. That one asked for the script,
        the pronunciation, the English and the recordings a second
        time, and the two copies had to be kept in step by hand. This
        asks for one thing the card cannot supply, and nothing is
        drilled on it: it is a label, and the microcopy says so. */}
      <div className="at-formblock at-mt5">
        <div className="at-formhead">
          <span className="at-formnum">What to call it</span>
          <span className="at-formrole">how it is listed</span>
        </div>
        <Field label="Name">
          <input
            className="at-input"
            value={name}
            placeholder={verb ? "to eat" : "saying where you live"}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Help>
          {verb ? (
            <>
              How this card is listed and searched. Without one it is
              listed as {citedLabel(shownSpec)} — the box a dictionary lists
              the verb under — which names that form rather than the verb.
              Nobody is ever asked this: the table is what is practised.
            </>
          ) : (
            <>
              How this card is listed and searched. Without one it is listed
              as the sentence itself, blanks and all — which names the shape
              of the card rather than what it is for. Nobody is ever asked
              this: what is practised is the sentence with its blanks filled
              in.
            </>
          )}
        </Help>
      </div>
    </>
  );
}

/* The table a card carries — a verb's, an adjective's — and the one line
   that unblocks Save when a cited cell is empty. */
function TableBlock({ word, lang }: { word: WordDraft; lang: Lang }) {
  const { shownSpec, cells, setCells, mintCell, setRecordingCell, standsIn, canSave } = word;
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
        {/* Only when it is in the way. A line explaining which box a
            dictionary lists the verb under, standing there whether or
            not anything was wrong with the card, was a paragraph of
            theory between the teacher and the table. A Save that
            stays grey with nothing saying why is worse, so what is
            left is the one sentence that unblocks it, at the moment
            it is true and not before. */}
        {standsIn && !canSave && (
          <p className="at-formneed unmet">
            Fill in {citedLabel(shownSpec)}, plus its English.
          </p>
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
        <span className="at-formrole">what it is and who is in it</span>
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
          {you === null ? "" : (l.who || 0) === you ? "the student's turn" : "said to them"}
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
function FormBlock({ word, lang, index: i, form: f, title, role, blanks, children }: {
  word: WordDraft;
  lang: Lang;
  index: number;
  form: Record<string, any>;
  title: string;
  role: string;
  /* Handed down only by the sentence editor: a blank belongs in a sentence
     and nowhere else, so the bar is not drawn on a word, a verb or a
     conversation. What refuses a blank on those is the save — see
     `strayHoles` — and this is the other half of the same rule, which is
     that a teacher is never offered what they will then be refused. */
  blanks?: BlankWiring;
  children?: Node;
}) {
  const { canSave, drillsTranslit, setForm, duplicateForm, removeForm, setRecording } = word;
  return (
    <>
  <div className={`at-formblock${i === 0 ? " main" : ""}`}>
    <div className="at-formhead">
      <span className="at-formnum">{title}</span>
      <span className="at-formrole">{role}</span>
      {/* Kept together so the pair stays whole and the role text
          beside them shortens instead of collapsing into a column. */}
      <span className="at-formacts">
        {/* A second form usually differs from the first in a field
            or two, so start it from the one in hand rather than
            empty. The copy lands directly beneath its source, where
            the eye already is. Recordings are not carried over: the
            copy is a different word, so the original's audio would
            be wrong for it, and a wrong recording is worse than a
            missing one. */}
        <Button variant="ghost" size="sm" onClick={() => duplicateForm(i)}>
          Duplicate
        </Button>
        {i > 0 && (
          <Button variant="ghost" size="sm" onClick={() => removeForm(i)}>
            Remove
          </Button>
        )}
      </span>
    </div>

    <p className="at-groupline">Drilled in exercises</p>

    {/* What this form needs, next to the fields it's about. */}
    {i === 0 && (
      <p className={`at-formneed${canSave ? "" : " unmet"}`}>
        {lang.scriptLabel} plus English.
      </p>
    )}

    {/* An accepted answer and how it is said are written together,
        because one transliteration under two spellings belongs to
        one of them and lies about the other. Where the language
        has no transliteration to write, this is the plain list it
        always was. */}
    <Field label={`${lang.scriptLabel} and ${lang.translitLabel.toLowerCase()}`}>
      <ScriptAnswers
        lang={lang}
        dims={dimsFor(lang, word.category)}
        form={f}
        onChange={(next) => setForm(i, { ...f, ...next })}
        blanks={blanks}
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
        onChange={(v) => setForm(i, { ...f, en: v })}
        render={(v, set) =>
          blanks ? (
            <BlankField wiring={blanks} value={v} onChange={set} label="English" lang={lang}>
              {(box) => (
                <input
                  ref={box}
                  className="at-input"
                  value={v}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </BlankField>
          ) : (
            <input className="at-input" value={v} onChange={(e) => set(e.target.value)} />
          )
        }
      />
    </Field>

    <div className="at-field">
      <Recordings form={f} onOpen={() => setRecording(i)} />
    </div>

    {/* Number and gender used to stand down here, one set for
        the whole form. They belong to an answer — two spellings
        are two words, and one of them may be the feminine — so
        they are written beside the answer they are about, up
        with it. The transliteration went the same way.

        What is left is what is genuinely about the form rather
        than about one of its answers. */}
    {i === 0 && lang && lang.lexical && (
      <>
        <p className="at-groupline">Reference — not drilled</p>
        <Field label={lang.lexical.label}>
          <input
            className="at-input"
            value={(f as any)[lang.lexical.key] || ""}
            placeholder={lang.lexical.help || ""}
            onChange={(e) => setForm(i, { ...f, [lang.lexical ? lang.lexical.key : ""]: e.target.value })}
          />
        </Field>
      </>
    )}

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
  const { forms, shownSpec, cells, setCells, mintCell, setRecordingCell } = word;
  if (!shownSpec || !shownSpec.perForm) return null;
  return (
    <>
  {/* ---- the pronouns this form takes on its end ----

      Part of the form rather than a section beside it, which is
      what it is: the singular has its pronouns and the plural
      has its own, and a single table hanging off the card said
      the plural's were the singular's. It sits under the form's own fields, which
      is the order they are learnt in — the word first, and each
      of these once the word is known.

      The same component the verb's table uses, because it is
      the same thing: cells of a table over the card's own
      sub-forms. Inline, so the eye reads it as belonging to the
      block it is in. */}
    <>
      <VerbTable
        inline
        lang={lang}
        spec={shownSpec}
        of={i === 0 ? "" : String(f.id || "")}
        ofLabel={ownerLabel(i, forms.length)}
        cells={cells}
        mint={mintCell}
        onChange={setCells}
        onRecord={(row, col) =>
          setRecordingCell({
            of: i === 0 ? "" : String(f.id || ""),
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
    </>
    </>
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
 * What on this card is asked about, and what is only written down.
 *
 * One tick per part of the card — see askParts for what the parts are.
 * Everything is ticked until somebody says otherwise, which is what a card
 * has always been; the section is a way of keeping a form without being
 * asked it, not a new thing to fill in.
 *
 * Shown on every card, including the plain word with one form and nothing
 * else — where it is one line saying that the word is asked about, which
 * is a true thing to say and the only place anybody would look to change
 * it. 0.134 hid it there, on the grounds that a single tick can only turn
 * the whole card off and the Blanks block asks that already. It does not:
 * that tick is only drawn on a card that *fills* a blank, so on an
 * ordinary word there was no such question anywhere, and the section
 * appeared on none of the cards somebody opening the editor would first
 * look at.
 */
function AskBlock({ word }: { word: WordDraft }) {
  const { parts, setAskPart } = word;
  if (!parts.length) return null;
  const on = parts.filter((p) => p.on);
  return (
    <div className="at-formblock at-mt5">
      <div className="at-formhead">
        <span className="at-formnum">What is drilled</span>
        <span className="at-formrole">
          {on.length === parts.length
            ? "all of it"
            : `${on.length} of ${parts.length}`}
        </span>
      </div>
      <CheckList
        options={parts.map((p) => ({ id: p.id, title: p.title, note: p.note }))}
        chosen={on.map((p) => p.id)}
        onToggle={(id, wasOn) => setAskPart(id, !wasOn)}
      />
      {on.length ? (
        /* The sentence the whole section exists for. Deleting a form was the
           only way to stop it being asked, and deleting it took its
           recordings and every student's progress on it too. */
        <Help>
          Anything switched off stays on the card and is still shown — its
          recordings, and whatever progress a student has already made on
          it, are kept. It is simply never asked about.
        </Help>
      ) : (
        <Notice kind="warn">
          Nothing on this card would be asked about. It is still shown
          wherever the card is, but no session will ever deal it.
        </Notice>
      )}
    </div>
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
          <p className="at-eyebrow">{`{{${slot}}} · ${said}`}</p>
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
        This ID will be used to use this card to fill a blank in another card.
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
        <div className="at-idrow shut">
          <Icon name="key" />
          <span className="at-idname">{refName}</span>
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
  const { fills, addFill, dropFill, renameFill, nameHeld } = word;
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  /* A tag may be renamed onto another tag — two groups becoming one is a
     thing a teacher may mean — but never onto a card's ID, which would
     leave two different things answering to one `{{x}}`. */
  const clash = renaming ? nameHeld(slotName(renaming.to)) : null;
  const canRename = !!renaming && !!slotName(renaming.to) &&
    slotName(renaming.to) !== renaming.from && (!clash || clash.kind === "group");
  if (!rows.length) {
    return (
      <p className="at-hint">
        No group has been named yet. Type one above — the first of its kind has
        to be named by somebody.
      </p>
    );
  }
  return (
    <div className="at-ticklist">
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
          </div>
        );
      })}
      {/* Said rather than left as a tick that will not press. Two groups
          becoming one is allowed and this is the case that is not: a card
          answers to that name already. */}
      {clash && clash.kind === "card" && (
        <p className="at-formneed unmet">
          A card&rsquo;s ID is that name already, and one <code>{`{{${slotName((renaming || { to: "" }).to)}}}`}</code> cannot
          be two things.
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
            <code>{`{{${asking.from}}}`}</code> becomes{" "}
            <code>{`{{${asking.to}}}`}</code>.
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

function BlanksBlock({ word, lang }: { word: WordDraft; lang: Lang }) {
  const {
    holes, starved, asked, fillers, fills, fillsOffer, addFill,
    main, trouble, drill, setDrillChoice, category, sentence, strayHoles,
  } = word;
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
        once they are filled — five of it, as a student meets it — is
        the third, and a list to read down rather than a preface to the
        holes it was appended to. What a card *fills* is nowhere in its
        words and nothing can be read off: it is the teacher's answer,
        so that one is the list they answer it on.

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
              ? "only a sentence can have a blank"
              : sentence && holes.length
                ? `${plural(holes.length, "blank")} · ${
                    starved.length ? "nothing fills it yet" : `met as ${plural(asked.length, "sentence")}`
                  }`
                : sentence
                  ? "no blank in it yet"
                  : fills.length
                    ? `this card fills ${plural(fills.length, "blank")}`
                    : "a gap this card leaves for another word"}
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
            <Help>
              Call this card a sentence at the top of the screen, or take the
              braces out of its words. A word is a thing to learn; a sentence
              is the frame it is met in, and the blank is what makes it one.
            </Help>
          </>
        )}

        {sentence && <p className="at-groupline">Blanks in this card</p>}

        {sentence && holes.length > 0 && (
          <>
            {/* Named, because it is the reason the card is never
                asked and the teacher cannot see it from here. */}
            {starved.length > 0 && (
              <p className="at-formneed unmet">
                Nothing fills{" "}
                {starved.map((s) => `{{${s}}}`).join(" or ")} yet, so this card
                cannot be practised. Write a card that says it fills it.
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

        {/* Still possible on a card written before the button, or by
            typing the braces by hand, so still said — in one line. Only on
            a sentence: on a word every blank is already the wrong thing to
            have, and saying the fields disagree about them as well would be
            two complaints where there is one thing to do. */}
        {sentence && trouble && (
          <p className="at-formneed unmet">
            {trouble.missing.length
              ? `${fieldName(trouble.field, lang)} is missing ${trouble.missing
                  .map((v) => `{{${v}}}`)
                  .join(" and ")} — every field with words in it leaves the same blanks.`
              : `${fieldName(trouble.field, lang)} names ${trouble.extra
                  .map((v) => `{{${v}}}`)
                  .join(" and ")}, which no other field does.`}
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

        {/* ---- the card with its blanks filled ----

            Its own named subsection, because it is not a fact about the
            holes: it is the card itself, as a student will meet it, with
            every blank standing as one of the words actually behind it.
            It sat above the holes as a wordless preface to them, which is
            where the one thing on this screen worth reading down was
            hardest to recognise as a thing to read. Five of them, each in
            the script, in how it is said and in what it means, and
            nothing else on the line — so the list is read as a list.

            Only on a card that leaves a blank: a card with no hole in it
            is met as what it says, and a heading offering examples of it
            would be a heading over the card's own words. */}
        {sentence && holes.length > 0 && (
          <>
            <p className="at-groupline">Examples of this card with filled blanks</p>
            {asked.length > 0 ? (
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
            ) : (
              <Help>
                None yet. A blank in this card has no word behind it, so there
                is nothing to stand in it and no filled sentence to show.
              </Help>
            )}
          </>
        )}

        {/* ---- the card's ID ----

            The name this one card answers to, which is the other half of
            how a blank is filled: a group is a set of words a sentence
            will take any of, and this is the one word it asks for. Here
            rather than at the top of the screen because that is what it is
            for — a teacher looking for how this card gets borrowed finds
            both answers in one section. */}
        <p className="at-groupline">The card&rsquo;s ID</p>
        <IdBox word={word} />

        {/* The other job. Named and always on screen, so that a teacher
            looking for where a word is offered to other cards finds the
            question rather than the absence of it — on a card that leaves
            a blank of its own, what they find is the reason there is
            nothing to answer. */}
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
                taken={offered.map((b) => b.name)}
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
                      <code>{`{{${name}}}`}</code>
                    </React.Fragment>
                  ))}{" "}
                  in it can borrow this word.
                </Help>
                <label className="at-tickrow">
                  <input
                    type="checkbox"
                    checked={drill}
                    onChange={() => setDrillChoice(!drill)}
                  />
                  <span className="at-tickbody">
                    <b>Also ask this card on its own</b>
                    <i>
                      {drill
                        ? "Asked as a question of its own, like every other card."
                        : "Only ever used to fill a blank in another card."}
                    </i>
                  </span>
                </label>
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
      {/* And the question a rename asks, over the whole app: it is about
          cards this screen is not editing, so it cannot be answered
          beside the row it came from. */}
      <RenameAsk word={word} />
    </>
  );
}

/*
 * The recording screens, over the editor rather than instead of it:
 * closing one puts the form back exactly as it was left, scroll position
 * included. Drawn by the shell after the Screen, so they stand above it.
 */
function RecordingOverlays({ word, talk }: { word: WordDraft; talk: SceneDraft }) {
  const { forms, recording, setRecording, setForm, recordingCell, setRecordingCell, cellHere, setCells, shownSpec } = word;
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
    {recording !== null && forms[recording] && (
      <RecordingScreen
        title={forms.length > 1 ? `Recordings · form ${recording + 1}` : "Recordings"}
        form={forms[recording]}
        onChange={(next) => setForm(recording, { ...forms[recording], ...next })}
        onClose={() => setRecording(null)}
      />
    )}
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
  const { shownSpec, ownForms, tableCells, forms, note, standsIn, name, uses, fills, drill, category, refName, spread } = word;
  return {
    forms: shownSpec ? ownForms.concat(tableCells as typeof forms) : ownForms,
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
    drill,
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
      {word.forms.map((f, i) => (
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={`Form ${i + 1}`}
          role={i === 0 ? "the main form" : "another form of the same card"}
        />
      ))}
      <AddFormButton word={word} />
      <AskBlock word={word} />
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
 * A verb: what to call it and its table first, then any form the card
 * already carried outside the table. Where the language cites a cell of
 * the table as the dictionary form, the card's own word is that cell and
 * has no block of its own. No form can be added: a verb's forms are its
 * table, and a spelling is an accepted answer, not a form.
 */
function VerbEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      {word.standsIn && <NameBlock word={word} of="verb" />}
      <TableBlock word={word} lang={lang} />
      {word.forms.map((f, i) => (
        i === 0 && word.standsIn ? null :
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={i === 0 ? "The verb" : `Form ${i + 1}`}
          role={i === 0 ? "the verb itself" : "another form of the same card"}
        />
      ))}
      <AskBlock word={word} />
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
 * adjective's feminine and plural, a number's feminine. The verb's editor
 * without the verb: no name to list it under, and the card's own word
 * keeps its block, because the table is forms of it rather than a stand-in
 * for it. No form can be added, for the reason a verb's cannot: the table
 * is the forms, and a spelling is an accepted answer. A form the card
 * already carries is still shown rather than quietly dropped.
 */
function TableEditor({ word, lang, allCards, selfId }: {
  word: WordDraft;
  lang: Lang;
  allCards: Card[];
  selfId: string;
}) {
  return (
    <>
      {word.forms.map((f, i) => (
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={`Form ${i + 1}`}
          role={i === 0 ? "the main form" : "another form of the same card"}
        />
      ))}
      <TableBlock word={word} lang={lang} />
      <AskBlock word={word} />
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
      {word.forms.map((f, i) => (
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={`Form ${i + 1}`}
          role={i === 0 ? "the main form" : "another form of the same card"}
        >
          <PronounTable word={word} lang={lang} index={i} form={f} />
        </FormBlock>
      ))}
      <AddFormButton word={word} />
      <AskBlock word={word} />
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
 * What to call it comes first, as it does on a verb and for the same
 * reason: what is saved on the card is a frame with a hole in it, so a
 * list of sentences reads as a list of holes unless the teacher says what
 * each one is for.
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
      <NameBlock word={word} of="sentence" />
      {word.forms.map((f, i) => (
        <FormBlock
          key={i}
          word={word}
          lang={lang}
          index={i}
          form={f}
          title={i === 0 ? "The sentence" : `Form ${i + 1}`}
          role={i === 0 ? "the sentence, with a blank where a word goes" : "another way of saying it"}
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
      <AskBlock word={word} />
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

/* What to call the cell a dictionary lists the verb under, in the pack's
   own words for its rows and columns — "past · he". A pack whose columns
   are unlabelled leaves the row standing on its own, for the same reason
   the table does not print "any" over a language with one person. */
const citedLabel = (spec: VerbSpec | null | undefined): string => {
  const cite = citationOf(spec);
  if (!cite) return "";
  const tense = tensesOf(spec).find((t) => t.id === cite.row);
  const person = personsOf(spec).find((p) => p.id === cite.col);
  return [tense && tense.label, person && person.label].filter(Boolean).join(" · ");
};

export function CardEditor({ card, lang, decks, inDecks, allCards, onSave, onDelete, onClose, busy, confirming, scene: opensAsScene = false, draft = null }: {
  card: Card | null;
  lang: Lang;
  decks: Deck[];
  inDecks?: string[];
  allCards: Card[];
  onSave: (written: { forms: any, note: string, name: string, category: string, sentence: boolean, decks: string[], uses: string[], fills: string[], ref: string, spread: { from: string, to: string }[], drill: boolean, scene: { title: string, setting: string, speakers: string[], you: number | null, lines: any[] } | null, }) => void;
  onDelete?: () => void;
  onClose: () => void;
  busy?: boolean;
  confirming?: Node;
  scene?: boolean;
  draft?: Record<string, any> | null;
}) {
  /*
   * A conversation is a kind of card, not a separate thing to make.
   *
   * It used to have a button of its own, which meant a teacher chose
   * between "a card" and "a conversation" before reaching the editor — and
   * the Cards tab, having only the one button, could not make one at all.
   * The choice is here now, among the fields, which is where every other
   * decision about a card is made. An existing card's kind is shown and not
   * offered: a word does not become a conversation by being edited, and a
   * scene with four turns on it would have nowhere to put them.
   */
  const [shape, setShape] = useState<CardShape>(() => shapeOf(card, opensAsScene));
  const scene = shape === "scene";
  const word = useWordDraft({ card, lang, allCards, draft, shape });
  const talk = useSceneDraft({ card });
  const choices = shapeChoices({ saved: !!card, shape, table: word.storedForms });
  /*
   * Choosing a kind, and choosing what a word lays out, are two questions
   * and each sets its own flag — so the two can never say a card is a
   * conversation with a table, which they could, and a scene saved that way
   * carried cells nothing would ever show again.
   *
   * A part of speech belongs to a word. A conversation and a sentence are
   * neither, so the answer is put down on the way out of "word" rather
   * than carried along to be saved on a card it does not describe.
   */
  const chooseShape = (next: CardShape) => {
    setShape(next);
    if (next !== "word") word.setCategory("");
  };
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
        title={card ? "Edit card" : "New card"}
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
            choices={choices}
            onShape={chooseShape}
            word={word}
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
