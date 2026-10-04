/*
 * The one screen a language's numbers and its clock are written on.
 *
 * It replaces two ways of entering the same thing. There was a grid of
 * fifty-five boxes that wrote a card each, and there was the ordinary card
 * editor with a *number* subtype on it, and the two agreed about nothing:
 * one wrote a `value` and the other did not, one knew about the feminine
 * cell and the other showed it as an unlabelled extra form, and neither
 * could say the word a numeral takes directly before a noun, because
 * nothing in the app could.
 *
 * What is here instead is the system as one document, with the two
 * questions a teacher actually has kept apart:
 *
 *   * **What are the words?** A grid generated from what the composer says
 *     it needs, so a language that asks for fourteen boxes shows fourteen.
 *     A box nobody has filled is a gap and never a blocker — the reach
 *     says what it holds back, and everything that can be built still is.
 *   * **What did it get wrong?** The preview, which is the only honest
 *     answer to that: a page of numbers said exactly as a student will
 *     meet them. Tap one and it becomes a correction. Nothing else on this
 *     screen is worth as much as that list.
 *
 * The words that join a number's pieces — the "and" in two hundred and
 * five — are on a screen of their own beside the parts. They are not a
 * number, and on the part that first needs one the box sat among the tens
 * where nobody went looking for it. A language with none has no such
 * screen.
 *
 * The Time tab is the same shape and waits on one thing: the hour is a
 * feminine noun in every language that has one, so it cannot be said until
 * the numerals that agree with a feminine word are written. The tab says
 * so rather than opening onto boxes that would render nothing.
 */
import React, { useEffect, useMemo, useState } from "react";
import type { Lang } from "./types.ts";
import type {
  CountedNoun,
  FormKey,
  MinuteExpr,
  NumberSystem,
  Period,
  Range,
  SlotSpec,
  TimeSystem,
  TimeStyle,
  TwoWords,
} from "./numbers/types.ts";
import { MINUTE_MARKS, countingOf, partsNow } from "./numbers/types.ts";
import { composerFor, timeComposerFor } from "./numbers/index.ts";
import { blocking, countable, countingWarnings, probeOf, rangeChecks, renderAsk, seeded } from "./numbers/range.ts";
import { readNumberSystem, readTimeSystem } from "./numbers/schema.ts";
import type { RangeCheck } from "./numbers/range.ts";
import { figureOf, homesOf, partTags } from "./numbers/generate.ts";
import { readNouns, withNouns } from "./numbers/nouns.ts";
import type { ReadNoun } from "./numbers/nouns.ts";
import { Button, ConfirmModal, Help, Icon, Meta, Notice, Screen, Section, Segmented, Tile, plural } from "./shared.tsx";
import { dimsFor } from "./languages.ts";
import { DeckSwitch, RecordingScreen, ScriptInput } from "./card-editor.tsx";

/** A box's number in the language's own figures, under the one it is
    called by — "" where the pack has none or the box is not one number. */
function numeralFor(lang: Lang, label: string): string {
  const n = figureOf(label);
  return lang.numerals && n != null ? lang.numerals(n) : "";
}

/** The group a composer puts its connecting words in, and the id of the
    screen they are on in place of a part's. */
const CONNECTING_GROUP = "connecting words";
const CONNECTING = "connecting";

/* ---- what a preview shows ---- */

/**
 * The numbers a teacher is shown without asking.
 *
 * Not a count and not a spread: **one number per shape a language can get
 * wrong**, and no more than fits on a screen. Four and five are missing
 * because they say nothing three and seven do not already say, and a
 * hundred rows of that would hide the dozen rows that matter. What each
 * one is here for:
 *
 *   * **0** — its own code path in every composer, said before any
 *     building starts. It has been wrong once already.
 *   * **1, 2** — the two that inflect for what they count, nearly
 *     everywhere.
 *   * **3, 7** — the run where a Semitic numeral reverses polarity and
 *     takes its bound form. One from each end of it.
 *   * **10, 11, 12, 19** — the teens, and the boundary at each end.
 *   * **20, 21, 25, 34, 47, 99** — a bare ten, and units in company: the
 *     one that changes after a single ten, the one that changes only
 *     after two, and one that changes for nothing.
 *   * **100, 101, 110, 200, 300, 525, 999** — the scales that have a word
 *     of their own, the ones that fuse, and a place with a nothing in it.
 *   * **1,000 up** — one of each scale, the same three shapes again where
 *     a count stands in front of a scale word, and 1,525 for a joining
 *     word in a long number.
 *
 * Which shapes matter is a fact about the language, so the honest version
 * of this is a list each composer declares. That is worth doing and is on
 * the backlog; until then this is one list chosen to cover all three, and
 * *Try a number* is how a teacher checks anything it misses.
 */
const SAMPLE = [
  0, 1, 2, 3, 7, 10, 11, 12, 19, 20, 21, 25, 34, 47, 99, 100, 101, 110, 200, 300,
  525, 999, 1000, 1001, 2000, 3000, 11000, 45000, 100000, 1000000, 2000000, 1525,
];

const TIME_SAMPLE: [number, number][] = [
  [1, 0], [2, 0], [7, 0], [7, 15], [7, 20], [7, 30], [7, 40], [7, 45],
  [12, 0], [12, 30], [13, 15], [19, 45], [23, 30], [0, 0],
];

const FACE_LABEL: Record<string, string> = {
  standalone: "counting",
  m: "with a masculine word",
  f: "with a feminine word",
  "construct.m": "before a masculine noun",
  "construct.f": "before a feminine noun",
  company: "inside a bigger number",
};

/* What one box is called: the language's own name for it where it has
   one — Arabic's single word before a noun — and the shared name else. */
const faceLabel = (slot: SlotSpec, key: FormKey): string =>
  (slot.faceLabels && slot.faceLabels[key]) || FACE_LABEL[key] || key;

/* A document as a string that two copies of it agree on whatever order
   their keys were written in. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(rec[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/* Which document a system is and when it was written, rather than what it
   says. The server writes all of these on every save, and a clock nobody
   has saved yet is made afresh — new stamps and all — every time the
   space draws this screen. */
const BOOKKEEPING = ["id", "owner", "rev", "created", "updated", "numberSystemId"];

/**
 * What saving a system would store, as a string to compare.
 *
 * Read through the reader the server stores every save through, because
 * that is what decides whether anything is left to save. The copy being
 * edited holds a word as it was typed — a space after it, a transliteration
 * typed and emptied — and the copy a save hands back holds the word as it
 * was stored. Compared as they were, the two never agreed after a save:
 * the screen went on calling it unsaved, asked again on the way out, and
 * the main screen said so with no Save to press.
 */
function held<T>(doc: T | null, read: (v: unknown) => T | null): string {
  const out = doc ? read(doc) : null;
  if (!out) return "null";
  const rec = { ...out } as Record<string, unknown>;
  for (const key of BOOKKEEPING) delete rec[key];
  return stable(rec);
}

/* ---- the screen ---- */

export interface EditorProps {
  lang: Lang;
  numbers: NumberSystem;
  times: TimeSystem | null;
  /** Save one system, resolving to what was saved — or to nothing when the
      save did not go through, which keeps the teacher where they are. */
  onSave: (kind: "numbers" | "times", system: NumberSystem | TimeSystem) => unknown;
  /** Why the last thing asked of the server did not happen, if it did not:
      said on the screen the teacher is on, beside its Save. */
  error?: string;
  onClose: () => void;
  busy?: boolean;
  /** What the server holds, for saying whether there is anything to save. */
  savedRev?: number;
  /** The teacher's cards: the noun cards are what counting counts. */
  cards?: Record<string, unknown>[];
  /** The decks in this language, for which hold each part. */
  decks?: PartDeck[];
  /** Put a part in a deck or take it out — saved at once, as a deck's own
      screen saves it. */
  onDeckPart?: (deckId: string, rangeId: string, on: boolean) => void;
}

export function NumberSystemEditor({
  lang, numbers, times, onSave, onClose, busy, error, cards = [], decks = [], onDeckPart,
}: EditorProps) {
  const composer = composerFor(lang.id);
  const timeComposer = timeComposerFor(lang.id);
  /* The main screen only lists; everything that is edited is edited on a
     screen of its own, which is where it is saved — see leave. These are
     the two that are not one part of the numbers. */
  const [timing, setTiming] = useState(false);
  const [fixing, setFixing] = useState(false);
  /* Where a teacher was going when they had unsaved changes: answered by
     the question below, which saves or drops them first. */
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  /* Whether the last save did not go through, which is said on the screen
     the teacher is on until a save does. */
  const [failed, setFailed] = useState(false);
  /* What was saved, with anything a composer has since folded into fewer
     boxes folded — see Composer.tidy. The screen opens on it and compares
     against it, so opening is not an unsaved change and the next save
     stores the tidy shape. */
  const base = useMemo(() => (composer && composer.tidy ? composer.tidy(numbers) : numbers), [composer, numbers]);
  const [draft, setDraft] = useState<NumberSystem>(base);
  const [clock, setClock] = useState<TimeSystem | null>(times);
  /* Which box is being recorded into, as the slot and the face. One
     recorder, pointed wherever it was asked for — two would be two live
     microphones the moment somebody pressed the second button. */
  const [recording, setRecording] = useState<{ slot: string; key: FormKey; time?: boolean } | null>(null);
  /*
   * The two things that are a screen of their own rather than a block
   * that appears halfway down this one.
   *
   * Writing a number out used to unfold in place, under the sample it was
   * tapped from, which put the box being typed into somewhere below the
   * fold on a phone and left the grid scrolling underneath it. Trying a
   * number out has the same shape and the same answer. Both are held here
   * beside the recorder because they are the same kind of thing: this
   * screen steps aside and another takes the whole of it, which is what
   * the app already does for a recording.
   */
  const [writing, setWriting] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  /* And the part of the numbers open on its own screen, by range id. */
  const [part, setPart] = useState<string | null>(null);

  /*
   * The draft with the things it counts, which are the teacher's noun
   * cards rather than anything in the draft — see nouns.ts. Everything
   * that renders reads this; everything that edits writes the draft, so
   * what is saved never carries them.
   */
  const nounCards = useMemo(() => readNouns(cards, lang.id), [cards, lang.id]);
  const nouns = useMemo(() => nounCards.flatMap((r) => (r.noun ? [r.noun] : [])), [nounCards]);
  const counted = useMemo(() => withNouns(draft, nouns), [draft, nouns]);

  /*
   * What a save hands back, taken into the copy being edited.
   *
   * The server numbers each version and refuses a save built on one it has
   * moved past. The copy here kept the number it was opened with, so the
   * second save of a sitting was refused as stale, and the screen went on
   * calling the saved system unsaved — which also kept it from being
   * signed off. Only the bookkeeping is taken; what the teacher is typing
   * is theirs.
   */
  const { id: nId, owner: nOwner, rev: nRev, created: nCreated, updated: nUpdated } = numbers;
  useEffect(() => {
    setDraft((d) => ({ ...d, id: nId, owner: nOwner, rev: nRev, created: nCreated, updated: nUpdated }));
  }, [nId, nOwner, nRev, nCreated, nUpdated]);
  const tId = times ? times.id : "";
  const tOwner = times ? times.owner : "";
  const tRev = times ? times.rev : 0;
  const tCreated = times ? times.created : 0;
  const tUpdated = times ? times.updated : 0;
  useEffect(() => {
    setClock((c) => (c && tId ? { ...c, id: tId, owner: tOwner, rev: tRev, created: tCreated, updated: tUpdated } : c));
  }, [tId, tOwner, tRev, tCreated, tUpdated]);
  /* And the numbers a clock reads its hours from, which a clock nobody has
     saved only learns once the numbers are saved for the first time. */
  const tNumbers = times ? times.numberSystemId : "";
  useEffect(() => {
    setClock((c) => (c && tNumbers && c.numberSystemId !== tNumbers ? { ...c, numberSystemId: tNumbers } : c));
  }, [tNumbers]);

  /* Which part each box belongs to, and what each box is called. The
     connecting words are on their own screen rather than the part that
     first needs them, so a part waiting on one is sent there. */
  const slotSpecs = useMemo(() => (composer ? composer.requiredSlots() : []), [composer]);
  const connecting = useMemo(() => slotSpecs.filter((s) => s.group === CONNECTING_GROUP), [slotSpecs]);
  const homes = useMemo(() => {
    const at = new Map(composer ? homesOf(composer) : []);
    for (const s of connecting) at.set(s.slot, CONNECTING);
    return at;
  }, [composer, connecting]);
  const labels = useMemo(() => new Map(slotSpecs.map((s) => [s.slot, s.label])), [slotSpecs]);
  const checks = useMemo(() => (composer ? rangeChecks(composer, counted) : []), [composer, counted]);
  /* Boxes that used to be two, where the teacher wrote a different word in
     each — see TwoWords. Asked on the part each number is in, and named on
     the front screen so nobody has to go looking. */
  const twoWords = useMemo(
    () => (composer && composer.twoWords ? composer.twoWords(draft) : []),
    [composer, draft],
  );
  const keepOne = (q: TwoWords, keep: "masculine" | "feminine") => {
    if (!composer || !composer.keepOne) return;
    const settle = composer.keepOne;
    setDraft((d) => settle(d, q, keep));
  };

  /* Compared as what a save would store — see held — and with anything a
     composer folds folded on both sides, so a save that went through
     leaves nothing behind whichever box the teacher wrote a word in. */
  const readNumbers = useMemo(
    () => (v: unknown) => {
      const read = readNumberSystem(v);
      return read && composer && composer.tidy ? readNumberSystem(composer.tidy(read)) : read;
    },
    [composer],
  );
  const numbersDirty = useMemo(
    () => held(draft, readNumbers) !== held(base, readNumbers),
    [draft, base, readNumbers],
  );
  const clockDirty = useMemo(() => held(clock, readTimeSystem) !== held(times, readTimeSystem), [clock, times]);
  const dirty = numbersDirty || clockDirty;

  if (!composer) {
    return (
      <Screen title="Number system" onBack={onClose}>
        <Notice kind="warn">
          Nobody has written down how {lang.name} builds its numbers yet, so there is nothing to
          fill in. Everything else about the language still works.
        </Notice>
      </Screen>
    );
  }

  /* The hour is a feminine noun wherever there is a word for it, so the
     clock cannot say one o'clock until the numerals that agree with a
     feminine word are written. Said as a condition rather than as an
     empty tab. */
  const hourReady = (() => {
    for (let h = 1; h <= 12; h += 1) {
      const said = composer.render(h, counted, { gender: "f" });
      if (!said.text || blocking(said.warnings).length) return false;
    }
    return true;
  })();

  /* Whatever has changed, numbers and clock alike: a change made on one
     screen and not saved there is still a change, and Save is one
     decision, not one per document. Whether all of it went through, so
     that a teacher on their way out is only taken away from the Save
     button once there is nothing left for it to do. */
  const save = async (): Promise<boolean> => {
    let ok = true;
    if (numbersDirty) ok = !!(await onSave("numbers", draft)) && ok;
    if (clockDirty && clock) ok = !!(await onSave("times", clock)) && ok;
    setFailed(!ok);
    return ok;
  };

  /*
   * Off an editing screen, with something unsaved: asked rather than
   * carried. The main screen has no Save of its own, so changes taken back
   * to it would be changes with no way to keep them, and the next Back
   * would lose them without a word.
   */
  const leave = (go: () => void) => () => {
    if (dirty) setLeaving(() => go);
    else go();
  };
  const asking = leaving ? (
    <ConfirmModal
      title="Save your changes?"
      body={<p>Students get them as soon as they are saved.</p>}
      confirmLabel="Save"
      altLabel="Don't save"
      danger={false}
      busy={busy}
      onAlt={() => {
        const go = leaving;
        setDraft(base);
        setClock(times);
        setLeaving(null);
        go();
      }}
      onCancel={() => setLeaving(null)}
      onConfirm={() => {
        const go = leaving;
        setLeaving(null);
        /* A save that did not go through stays where its Save is, with
           what went wrong said above the boxes. Leaving anyway took the
           changes to the main screen, which has no Save to keep them. */
        void save().then((ok) => {
          if (ok) go();
        });
      }}
    />
  ) : null;

  const recTarget = (() => {
    if (!recording) return null;
    if (recording.time && clock) {
      const lex = clock.lexemes[recording.slot];
      return { clips: ((lex && lex.audio) || {}).standalone || [], slowClips: [] };
    }
    const lex = draft.lexemes[recording.slot];
    return { clips: ((lex && lex.audio) || {})[recording.key] || [], slowClips: [] };
  })();

  if (recording && recTarget) {
    return (
      <RecordingScreen
        title={`Recording ${recording.slot}`}
        form={recTarget}
        onChange={(next) => {
          const clips = next.clips;
          if (recording.time && clock) {
            setClock((c) => (c ? withTimeAudio(c, recording.slot, clips) : c));
          } else {
            setDraft((d) => withAudio(d, recording.slot, recording.key, clips));
          }
        }}
        onClose={() => setRecording(null)}
      />
    );
  }

  if (writing !== null) {
    return (
      <WrittenOutScreen
        lang={lang}
        draft={draft}
        forKey={writing}
        slots={slotSpecs}
        render={(n, sys) => composer.render(n, sys)}
        onKeep={(text, lat) => {
          setDraft((d) => withOverride(d, writing, text, lat));
          setWriting(null);
          /* Written out from Check a number on the main screen, which has
             no Save: it goes back to where the numbers written out by hand
             are listed, and saved. Kept and taken back to the main screen,
             it was a change there was no way to keep. */
          if (!part && !fixing && !timing) setFixing(true);
        }}
        onClose={() => setWriting(null)}
      />
    );
  }

  if (trying) {
    return (
      <TryItScreen
        lang={lang}
        draft={counted}
        labels={labels}
        render={(n, ctx) => composer.render(n, counted, ctx)}
        onWrite={(key) => {
          setTrying(false);
          setWriting(key);
        }}
        onClose={() => setTrying(false)}
      />
    );
  }

  /* In the top bar, where the card editor keeps its own, and the same
     button on every screen that edits anything: those screens are long,
     and a save at the bottom of one was a scroll away from wherever the
     change was made. */
  const saveButton = (
    <Button variant="primary" size="sm" disabled={!dirty || busy} onClick={() => void save()}>
      <Icon name="save" />
      {busy ? "Saving…" : "Save"}
    </Button>
  );
  const note = failed && dirty ? (
    <Notice kind="error">{error || "Your changes were not saved. Press Save to try again."}</Notice>
  ) : null;

  const open = part ? checks.find((c) => c.range.id === part) || null : null;
  /*
   * A number with something counted beside it — 3, *three books* — for the
   * foot of each number's panel on a stretch that is counted with. Said
   * with the first noun card that can be counted across the stretch, so a
   * screen reads as one noun counted up; failing that, with whichever
   * card can be counted with that number at all. Nothing where none can:
   * the counting section says what is missing.
   */
  const countedAt = (range: Range) => {
    const across = countable(countingOf(range), composer, counted);
    const order = across.concat((counted.nouns || []).filter((n) => !across.includes(n)));
    return (n: number) => {
      if (n < 1) return null;
      for (const noun of order) {
        const said = renderAsk({ rangeId: range.id, kind: "numbers", value: n, nounId: noun.id }, composer, counted);
        if (said.text && !blocking(said.warnings).length) return { text: said.text, en: said.en };
      }
      return null;
    };
  };
  const view = part === CONNECTING ? (
    <ConnectingScreen
      lang={lang}
      draft={draft}
      setDraft={setDraft}
      slots={connecting}
      render={(n) => composer.render(n, counted)}
      saveButton={saveButton}
      note={note}
      onRecord={(slot, key) => setRecording({ slot, key })}
      onWrite={setWriting}
      onClose={leave(() => setPart(null))}
    />
  ) : open ? (
    <PartScreen
      lang={lang}
      draft={draft}
      setDraft={setDraft}
      check={open}
      checks={checks}
      homes={homes}
      slots={slotSpecs}
      render={(n, ctx) => composer.render(n, counted, ctx)}
      twoWords={twoWords.filter((q) => q.n >= open.range.from && q.n <= open.range.to)}
      onKeepOne={keepOne}
      nouns={nounCards}
      countedAt={open.range.counts ? countedAt(open.range) : undefined}
      countingGaps={
        open.range.counts ? (noun) => countingWarnings(countingOf(open.range), composer, counted, noun) : undefined
      }
      decks={decks}
      saveButton={saveButton}
      note={note}
      onRecord={(slot, key) => setRecording({ slot, key })}
      onWrite={setWriting}
      onDeckPart={onDeckPart}
      onClose={leave(() => setPart(null))}
    />
  ) : fixing ? (
    <FixScreen
      lang={lang}
      draft={draft}
      render={(n) => composer.render(n, counted)}
      saveButton={saveButton}
      note={note}
      onWrite={setWriting}
      onCheck={() => setTrying(true)}
      onClose={leave(() => setFixing(false))}
    />
  ) : timing ? (
    <Screen title="Telling the time" onBack={leave(() => setTiming(false))} action={saveButton}>
      {note}
      <TimesTab
        lang={lang}
        numbers={draft}
        clock={clock}
        setClock={setClock}
        hourReady={hourReady}
        slots={(timeComposer && timeComposer.requiredSlots()) || []}
        render={
          timeComposer && clock
            ? (h, m, style, period) =>
                timeComposer.renderTime(h, m, clock, draft, { style, period })
            : null
        }
        onRecord={(slot) => setRecording({ slot, key: "standalone", time: true })}
      />
    </Screen>
  ) : (
    /* Nothing on this screen is edited, so it has no Save: each part, the
       clock and the numbers written out by hand open on a screen of their
       own, and are saved there. */
    <Screen title="Number system" onBack={leave(onClose)}>
      <NumbersTab
        lang={lang}
        draft={draft}
        checks={checks}
        homes={homes}
        labels={labels}
        twoWords={twoWords}
        connecting={
          connecting.length
            ? connecting.every((s) => s.optional || written(draft, s))
              ? "ready"
              : "not written yet"
            : null
        }
        time={
          timeComposer
            ? hourReady
              ? "ready"
              : "waiting on the numbers that go with a feminine word"
            : null
        }
        onOpen={setPart}
        onTime={() => setTiming(true)}
        onFix={() => setFixing(true)}
        onCheck={() => setTrying(true)}
      />
    </Screen>
  );

  return (
    <>
      {view}
      {asking}
    </>
  );
}

/* ---- numbers ---- */

/** A deck as this screen needs it: what it is called, which parts of the
    numbers it holds, and whether its contents are locked. */
export interface PartDeck {
  id: string;
  title: string;
  parts: string[];
  locked?: boolean;
  cardCount?: number;
}

/**
 * A section of a part's screen, headed the way every section of a card's
 * editor is: its name, and under it what it is for. The same classes, on
 * a screen with the same ruling — see `.at-screen.cardform` — so the two
 * screens a teacher moves between read as one design.
 */
function PartBlock({ title, role, children }: { title: string; role?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="at-formblock">
      <div className="at-formhead">
        <span className="at-formnum">{title}</span>
        {role ? <span className="at-formrole">{role}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Where one part stands, in a few words a tile can carry.
 *
 * "ready", or what it is waiting for — and where that is a word another
 * part holds, which part: 11 to 99 cannot be said without seven, and the
 * box for seven is on 0 to 10's screen, not this one. Counting has a line
 * of its own — see countingStatus — because it never holds a part back.
 */
export function partStatus(
  check: RangeCheck,
  checks: RangeCheck[],
  homes: Map<string, string>,
  labels: Map<string, string>,
): string {
  if (check.open) return "ready";
  const stops = blocking(check.warnings as never) as { code: string; slot?: string; detail?: string }[];
  const partLabel = (id: string) => {
    if (id === CONNECTING) return "Connecting words";
    const at = checks.find((c) => c.range.id === id);
    return at ? at.range.label : id;
  };
  const missing = [...new Set(stops.map((w) => w.slot || "").filter(Boolean))];
  const borrowed = missing.filter((slot) => homes.get(slot) && homes.get(slot) !== check.range.id);
  const own = missing.filter((slot) => !borrowed.includes(slot));
  const named = (slots: string[]) =>
    slots.length > 2
      ? `${slots.slice(0, 2).map((s) => labels.get(s) || s).join(", ")} and ${slots.length - 2} more`
      : slots.map((s) => labels.get(s) || s).join(" and ");
  if (borrowed.length) {
    const first = homes.get(borrowed[0]) || "";
    const there = borrowed.filter((s) => homes.get(s) === first);
    return `waiting on ${partLabel(first)}: ${named(there)}`;
  }
  if (own.length) return `waiting on ${named(own)}`;
  /* Nothing of its own missing, and still shut: an earlier part is, and
     the parts open in order. */
  const before = checks.find((c) => !c.open && c.range.kind === "numbers" && c !== check);
  return before ? `waiting on ${before.range.label}` : waitingOn(check.warnings);
}

/**
 * Where counting stands on a part, or null on a part that is not counted
 * with — every part in a language with nothing to agree.
 *
 * Said after the part's own line, and only about counting: a part whose
 * numbers cannot all be said yet says so on its own line, and counting
 * waits on that without repeating it. Otherwise it is waiting on a noun
 * card, or on a face of one, or on a number's word before a noun.
 */
export function countingStatus(check: RangeCheck, labels: Map<string, string>): string | null {
  const counting = check.counting;
  if (!counting) return null;
  if (counting.open) return "Counting: ready";
  if (!check.open) return "Counting: once the numbers are ready";
  const stops = blocking(counting.warnings as never) as { code: string; slot?: string; detail?: string }[];
  if (stops.some((w) => w.detail === "no nouns to count")) return "Counting: waiting on a noun card";
  const faces = [...new Set(
    stops.filter((w) => w.code === "missing-noun-form").map((w) => String(w.detail || "").split(".").pop() || ""),
  )]
    .map((f) => ({ sg: "singular", dual: "pair form", pl: "plural" } as Record<string, string>)[f])
    .filter(Boolean);
  if (faces.length && !stops.some((w) => w.slot)) return `Counting: waiting on a noun card with its ${faces.join(" and ")}`;
  return `Counting: ${waitingOn(counting.warnings, labels)}`;
}

function NumbersTab({ lang, draft, checks, homes, labels, twoWords, connecting, time, onOpen, onTime, onFix, onCheck }: {
  lang: Lang;
  draft: NumberSystem;
  checks: RangeCheck[];
  homes: Map<string, string>;
  labels: Map<string, string>;
  /** Boxes that used to be two and still hold two different words. */
  twoWords: TwoWords[];
  /** Where the connecting words stand, or null where the language has none. */
  connecting: string | null;
  /** Where telling the time stands, or null where the language has no clock. */
  time: string | null;
  /** Open one part's own screen. */
  onOpen: (rangeId: string) => void;
  onTime: () => void;
  onFix: () => void;
  onCheck: () => void;
}) {
  const parts = checks.filter((c) => c.range.kind === "numbers");
  /* The parts that hold a question about two words, in their own order. */
  const asking = parts.filter((c) => twoWords.some((q) => q.n >= c.range.from && q.n <= c.range.to));
  const yours = Object.keys(draft.overrides).length;

  return (
    <>
      <Help>
        Write the words {lang.name} builds its numbers out of and the app makes the rest. Open a
        part to write its words: with zero to nine written the app can ask anything up to nine,
        and so on up. <b>Nothing here has to be finished</b> — whatever is written works, and
        each part says what it is still waiting for.
      </Help>

      {asking.length ? (
        <Notice kind="warn">
          {`For ${plural(twoWords.length, "number")} you wrote one word before a masculine noun and another before a feminine one. ${lang.name} uses the same word before both, so there is now one box. Choose the word you say in ${asking.map((c) => c.range.label.toLowerCase()).join(" and ")}. Until you do, your students are asked exactly what they were before.`}
          <div className="at-row at-mt3">
            {asking.map((c) => (
              <Button key={c.range.id} size="sm" onClick={() => onOpen(c.range.id)}>
                {`Open ${c.range.label}`}
              </Button>
            ))}
          </div>
        </Notice>
      ) : null}

      <Section title="Parts" className="at-mt5">
        <div className="at-numparts">
          {parts.map((check) => (
            <Tile
              key={check.range.id}
              title={check.range.label}
              meta={
                <span className="at-numstates">
                  <span className="at-numstate" data-open={check.open ? "" : undefined}>
                    {partStatus(check, checks, homes, labels)}
                  </span>
                  {countingStatus(check, labels) ? (
                    <span
                      className="at-numstate"
                      data-open={check.counting && check.counting.open ? "" : undefined}
                    >
                      {countingStatus(check, labels)}
                    </span>
                  ) : null}
                </span>
              }
              onOpen={() => onOpen(check.range.id)}
            />
          ))}
          {connecting !== null ? (
            <Tile
              title="Connecting words"
              meta={
                <span className="at-numstate" data-open={connecting === "ready" ? "" : undefined}>
                  {connecting}
                </span>
              }
              onOpen={() => onOpen(CONNECTING)}
            />
          ) : null}
          {time !== null ? (
            <Tile
              title="Telling the time"
              meta={
                <span className="at-numstate" data-open={time === "ready" ? "" : undefined}>
                  {time}
                </span>
              }
              onOpen={onTime}
            />
          ) : null}
        </div>
      </Section>

      <Section title="When the app gets one wrong" className="at-mt5">
        <div className="at-numparts">
          <Tile
            title="Correct how a number is said"
            meta={yours ? `${plural(yours, "number")} written out by you` : "None written out by you yet"}
            onOpen={onFix}
          />
        </div>
        <div className="at-row at-mt3">
          <Button onClick={onCheck}>Check a number</Button>
        </div>
      </Section>
    </>
  );
}

/**
 * The numbers a teacher has corrected, and a sample of the rest to find
 * the ones that need it.
 *
 * This was a list under the parts called *What a student will be asked*,
 * which said what it showed and not what it was for: every line opens a
 * box to write that number out by hand, and what is written there is
 * asked instead of what the app builds. So it is a screen of its own,
 * named for that, with the corrections already made on top.
 */
function FixScreen({ lang, draft, render, saveButton, note, onWrite, onCheck, onClose }: {
  lang: Lang;
  draft: NumberSystem;
  render: (n: number) => { text: string; warnings: { code: string; slot?: string }[] };
  saveButton: React.ReactNode;
  /** What went wrong with the last save, if it did not go through. */
  note?: React.ReactNode;
  onWrite: (key: string) => void;
  onCheck: () => void;
  onClose: () => void;
}) {
  const [extra, setExtra] = useState<number[]>([]);
  const shown = useMemo(() => SAMPLE.concat(extra), [extra]);
  const written = Object.entries(draft.overrides);
  return (
    <Screen title="Correct how a number is said" onBack={onClose} action={saveButton}>
      {note}
      <Help>
        The app builds every number out of the words in the parts. Where it gets one wrong, tap
        it and write it the way it is said: students are asked your wording for that number, and
        wherever it turns up inside a bigger one.
      </Help>

      {written.length ? (
        <Section
          title="Numbers you wrote out"
          lede="Tap one to change it, or to put it back the way the app builds it."
          className="at-mt5"
        >
          <div className="at-numsample">
            {written.map(([key, over]) => (
              <button className="at-numsamplerow at-tappable" key={key} onClick={() => onWrite(key)}>
                <span className="at-numfig">{key}</span>
                <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                  {over.text}
                </span>
                {over.lat ? <Meta>{over.lat}</Meta> : null}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="How the app says them"
        lede="A spread of numbers of every shape. Tap one that is wrong to write it out yourself."
        className="at-mt5"
      >
        <SampleRows lang={lang} draft={draft} values={shown} render={render} onWrite={onWrite} />
        <div className="at-row at-mt3">
          <Button
            size="sm"
            onClick={() => setExtra((e) => e.concat([Math.floor(seeded(`more ${e.length}`)() * 9999999)]))}
          >
            Another number
          </Button>
          <Button size="sm" onClick={onCheck}>
            Check a number
          </Button>
        </div>
      </Section>
    </Screen>
  );
}

/**
 * A list of numbers as a student will be asked them, each one a way into
 * writing it out by hand.
 *
 * A number the system cannot finish yet still shows what it got, because
 * that is what tells a teacher which box to go and fill — but it is
 * marked, and quietly greyed. Half of forty-seven is the word for seven,
 * and a row that showed it like any other would be the screen saying this
 * language calls 47 "seven".
 */
function SampleRows({ lang, draft, values, render, onWrite }: {
  lang: Lang;
  draft: NumberSystem;
  values: number[];
  render: (n: number) => { text: string; warnings: { code: string; slot?: string }[] };
  onWrite: (key: string) => void;
}) {
  return (
    <div className="at-numsample">
      {values.map((value, i) => {
        const said = render(value);
        const key = String(value);
        const part = !said.text || blocking(said.warnings as never).length > 0;
        return (
          <button
            className="at-numsamplerow at-tappable"
            key={`${value}-${i}`}
            data-part={part ? "" : undefined}
            onClick={() => onWrite(key)}
          >
            <span className="at-numfig">{value.toLocaleString("en")}</span>
            <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
              {said.text || "—"}
            </span>
            {draft.overrides[key] ? <Meta>yours</Meta> : part ? <Meta>not yet</Meta> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---- one part ---- */

/**
 * One part of the numbers, on a screen of its own: the words it is the
 * first to need, what it says with them, how it counts things, the
 * numbers written out by hand inside it, the decks that hold it and the
 * blanks it fills.
 *
 * The words used to be one long grid of every box the language has, under
 * a list of what could be asked; the list said *11 to 99 is waiting on
 * forty* and the box for forty was somewhere below the fold. Here the
 * part is the way in, and the boxes it is waiting on are the ones on its
 * screen.
 */
function PartScreen({
  lang, draft, setDraft, check, checks, homes, slots, render, twoWords, onKeepOne, nouns, countedAt, countingGaps, decks,
  saveButton, note, onRecord, onWrite, onDeckPart, onClose,
}: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  check: RangeCheck;
  checks: RangeCheck[];
  homes: Map<string, string>;
  slots: SlotSpec[];
  render: (n: number, ctx?: { noun?: CountedNoun }) => { text: string; warnings: { code: string; slot?: string; detail?: string }[] };
  /** Boxes in this part that used to be two and still hold two different
      words, and the answer to one. */
  twoWords: TwoWords[];
  onKeepOne: (q: TwoWords, keep: "masculine" | "feminine") => void;
  /** The teacher's noun cards in this language, read for counting. */
  nouns: ReadNoun[];
  /** A number with a noun counted beside it, for the foot of its panel —
      absent on a part that is not counted with. */
  countedAt?: (n: number) => { text: string; en: string } | null;
  /** What counting a noun across the part warns about. */
  countingGaps?: (noun: CountedNoun) => { code: string; slot?: string; detail?: string }[];
  decks: PartDeck[];
  /** Save, for the top bar. */
  saveButton: React.ReactNode;
  /** What went wrong with the last save, if it did not go through. */
  note?: React.ReactNode;
  onRecord: (slot: string, key: FormKey) => void;
  onWrite: (key: string) => void;
  onDeckPart?: (deckId: string, rangeId: string, on: boolean) => void;
  onClose: () => void;
}) {
  const range = check.range;
  const own = slots.filter((s) => homes.get(s.slot) === range.id);
  /* Built from the parts before it alone — Huế's 11 to 99. */
  const before = checks.filter((c) => c.range.kind === "numbers");
  const earlier = before.slice(0, Math.max(0, before.findIndex((c) => c.range.id === range.id)));

  const written = Object.entries(draft.overrides).filter(([key]) => {
    const n = digitsOf(key);
    return Number.isFinite(n) && n >= range.from && n <= range.to;
  });

  /* Said only once the part is ready. A part that was not used to say
     "Not asked yet — waiting on …", with a button to the part it named;
     it confused more than it helped, and the parts list already says
     where each one stands. */
  const standing = check.open ? (
    <p className="at-numstate" data-open="">Ready: a student can be asked anything in this part.</p>
  ) : null;
  /* And the same for counting, which joins the part's questions once a
     noun card can be counted across all of it. */
  const counting = check.counting && check.counting.open ? (
    <p className="at-numstate" data-open="">
      Ready: a student is also asked to say how many, like &ldquo;3 books&rdquo;.
    </p>
  ) : null;

  return (
    <Screen title={range.label} onBack={onClose} action={saveButton} className="cardform">
      {note}
      {/* First, as a card's editor puts them near the top: where this part
          goes decides whether anybody is ever asked it. */}
      <PartDecks range={range} decks={decks} onDeckPart={onDeckPart} />

      {twoWords.length ? <TwoWordsBlock lang={lang} questions={twoWords} onKeep={onKeepOne} /> : null}

      <PartBlock
        title="Words"
        role={`The words this part is the first to need. Parts after it build on them.${countedAt ? " Under each number is how it counts a thing — read only, made from the words above and your noun cards." : ""}`}
      >
        {standing}
        <div className="at-mt5">
          {own.length ? (
            <WordGrid
              lang={lang}
              draft={draft}
              setDraft={setDraft}
              slots={own}
              onRecord={onRecord}
              countedAt={countedAt}
            />
          ) : (
            <Help>
              Nothing new to write here: {range.label.toLowerCase()} is built out of the words in{" "}
              {earlier.length ? earlier.map((c) => c.range.label.toLowerCase()).join(" and ") : "the other parts"},
              including the forms they take inside a bigger number.
            </Help>
          )}
        </div>
      </PartBlock>

      <PartBlock
        title="How the app says them"
        role="Tap one that is wrong to write it out yourself: students are asked your wording instead."
      >
        <SampleRows lang={lang} draft={draft} values={probeOf(range)} render={render} onWrite={onWrite} />
      </PartBlock>

      {range.counts ? (
        <CountedSection
          lang={lang}
          range={countingOf(range)}
          nouns={nouns}
          render={render}
          warningsOf={countingGaps}
          standing={counting}
        />
      ) : null}

      {written.length ? (
        <PartBlock
          title="Numbers you wrote out"
          role="Tap one to change what it says, or to put it back the way the app builds it."
        >
          <div className="at-numsample">
            {written.map(([key, over]) => (
              <button className="at-numsamplerow at-tappable" key={key} onClick={() => onWrite(key)}>
                <span className="at-numfig">{key}</span>
                <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                  {over.text}
                </span>
                {over.lat ? <Meta>{over.lat}</Meta> : null}
              </button>
            ))}
          </div>
        </PartBlock>
      ) : null}

      <PartTags range={range} open={check.open} counts={!!(check.counting && check.counting.open)} />
    </Screen>
  );
}

/** Whether a box has a word in every face it asks for. */
function written(draft: NumberSystem, slot: SlotSpec): boolean {
  const lex = draft.lexemes[slot.slot];
  return !!lex && slot.formKeys.every((k) => !!(lex.forms[k] || "").trim());
}

/**
 * The words between a number's pieces, on a screen of their own.
 *
 * Laid out as a part's screen is, so the two read as one design, with the
 * numbers under the boxes that show the word at work: twenty-one, where
 * every language that has one joins a unit to a ten, a hundred and five,
 * and 1,525, which joins more than once where the language does.
 */
function ConnectingScreen({ lang, draft, setDraft, slots, render, saveButton, note, onRecord, onWrite, onClose }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  slots: SlotSpec[];
  render: (n: number) => { text: string; warnings: { code: string; slot?: string }[] };
  saveButton: React.ReactNode;
  /** What went wrong with the last save, if it did not go through. */
  note?: React.ReactNode;
  onRecord: (slot: string, key: FormKey) => void;
  onWrite: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Screen title="Connecting words" onBack={onClose} action={saveButton} className="cardform">
      {note}
      <PartBlock
        title="Words"
        role={`The small words ${lang.name} puts between the pieces of a number, like "and" in two hundred and five. They are never asked on their own; every number that needs one is built with it.`}
      >
        <WordGrid lang={lang} draft={draft} setDraft={setDraft} slots={slots} onRecord={onRecord} />
      </PartBlock>

      <PartBlock
        title="How the app says them"
        role="Some numbers that use them. Tap one that is wrong to write it out yourself."
      >
        <SampleRows lang={lang} draft={draft} values={[21, 105, 1525]} render={render} onWrite={onWrite} />
      </PartBlock>
    </Screen>
  );
}

/**
 * The words a teacher wrote for a box that used to be two, and the
 * question of which one they say.
 *
 * Arabic's three to nineteen had a box before a masculine noun and another
 * before a feminine one until 0.321. The dialect says one word before
 * both, so a teacher who wrote two different words is shown them and taps
 * theirs. Nothing is chosen for them: under the written language's rule
 * the feminine box held the dialect's word as often as the masculine one,
 * so neither is a safe guess, and until they choose, their students are
 * asked what they were asked before.
 */
function TwoWordsBlock({ lang, questions, onKeep }: {
  lang: Lang;
  questions: TwoWords[];
  onKeep: (q: TwoWords, keep: "masculine" | "feminine") => void;
}) {
  const said = (text: string) => (
    <span lang={lang.id} dir={lang.direction}>
      {text || "the app's own word"}
    </span>
  );
  return (
    <PartBlock
      title="One word before a noun"
      role={`You wrote one word before a masculine noun and another before a feminine one. ${lang.name} uses the same word before both. Tap the one you say; it is used before every noun. Until you choose, nothing changes for your students.`}
    >
      <div className="at-numgrid">
        {questions.map((q) => (
          <div className="at-numrow" key={q.key}>
            <div className="at-numlabel">
              <span className="at-numfig">{q.n}</span>
              {q.kind === "correction" ? <Meta>a number you wrote out</Meta> : null}
            </div>
            <div className="at-numboxes">
              <div className="at-numcell">
                <Meta>{FACE_LABEL["construct.m"]}</Meta>
                <Button size="sm" onClick={() => onKeep(q, "masculine")}>
                  {said(q.masculine)}
                </Button>
              </div>
              <div className="at-numcell">
                <Meta>{FACE_LABEL["construct.f"]}</Meta>
                <Button size="sm" onClick={() => onKeep(q, "feminine")}>
                  {said(q.feminine)}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PartBlock>
  );
}

/**
 * The boxes for some slots, each number a panel of its own: a word per
 * face, and once there is one, how it sounds and a recording of it.
 *
 * A panel rather than a row, the way a card's editor puts each of a card's
 * forms in a panel with its name across the top. As rows, a number with
 * three faces was a label beside a column of nine boxes and the next
 * number's label sat level with the middle of them, so which box was
 * whose was read off the spacing. Here the number heads its own boxes,
 * and what each one is for is named over it.
 *
 * Under them, on a part that is counted with, the number counting a thing
 * — read only, because it is made out of the boxes above and the noun
 * cards, and the place to change it is one of those. It is here because
 * the word before a noun is the box a teacher is least sure of, and the
 * phrase it makes is what shows whether it is right.
 */
function WordGrid({ lang, draft, setDraft, slots, onRecord, countedAt }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  slots: SlotSpec[];
  onRecord: (slot: string, key: FormKey) => void;
  /** The number counting a thing, where the part is counted with. */
  countedAt?: (n: number) => { text: string; en: string } | null;
}) {
  return (
    <div className="at-numtiles">
      {slots.map((slot) => {
        const n = figureOf(slot.label);
        const counted = countedAt && n != null ? countedAt(n) : null;
        return (
          <div className="at-part at-numtile" key={slot.slot}>
            <p className="at-groupline at-numhead">
              <span>{slot.label}</span>
              {numeralFor(lang, slot.label) ? (
                <span className="at-numheadfig" lang={lang.id} dir={lang.direction}>
                  {numeralFor(lang, slot.label)}
                </span>
              ) : null}
            </p>
            {slot.hint ? <p className="at-hint at-numhint">{slot.hint}</p> : null}
            {slot.formKeys.map((key) => (
              <div className="at-numcell" key={key}>
                {slot.formKeys.length > 1 ? <span className="at-label">{faceLabel(slot, key)}</span> : null}
                <ScriptInput
                  lang={lang}
                  value={(draft.lexemes[slot.slot] || { forms: {} }).forms[key] || ""}
                  label={`${slot.label}, ${faceLabel(slot, key)}`}
                  compact
                  onChange={(v) => setDraft((d) => withWord(d, slot.slot, key, v))}
                />
                {(draft.lexemes[slot.slot] || { forms: {} }).forms[key] ? (
                  <div className="at-numsound">
                    <LatInput
                      lang={lang}
                      value={(draft.lexemes[slot.slot].lat || {})[key] || ""}
                      of={`${slot.label}, ${faceLabel(slot, key)}`}
                      onChange={(v) => setDraft((d) => withLat(d, slot.slot, key, v))}
                    />
                    <Button size="sm" onClick={() => onRecord(slot.slot, key)}>
                      {((draft.lexemes[slot.slot].audio || {})[key] || []).length
                        ? "Recording ✓"
                        : "Record"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {counted ? (
              <div className="at-numcount">
                <span className="at-label">Counting a thing</span>
                <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                  {counted.text}
                </span>
                {counted.en ? <Meta>{counted.en}</Meta> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** What a noun card is missing, in the words the screen uses for it. */
const GAP_LABEL: Record<string, string> = {
  singular: "no singular",
  plural: "no plural",
  gender: "no gender",
  sg: "no singular",
  pl: "no plural",
  dual: "no pair form",
};

/**
 * The things a part counts: the teacher's noun cards.
 *
 * There used to be a list of nouns written on this screen, because no
 * card could say a word was a pair; a card can, so the list went and the
 * cards are read instead — see nouns.ts. What is left here is the answer
 * to the one question a teacher has about it: which of my nouns will be
 * counted, and what is the rest missing.
 */
function CountedSection({ lang, range, nouns, render, warningsOf, standing }: {
  lang: Lang;
  range: Range;
  /** What counting a noun across the part warns about, where the caller
      has it remembered — see countingWarnings. Read off `render` at
      every number of the probe otherwise. */
  warningsOf?: (noun: CountedNoun) => { code: string; slot?: string; detail?: string }[];
  /** Where the part stands, said at the head of the section. */
  standing?: React.ReactNode;
  nouns: ReadNoun[];
  render: (n: number, ctx?: { noun?: CountedNoun }) => { text: string; warnings: { code: string; slot?: string; detail?: string }[] };
}) {
  const probe = probeOf(range);
  const shownAt = probe.length ? probe[Math.min(probe.length - 1, 2)] : range.from;
  const rows = nouns.map((read) => {
    if (!read.noun) return { read, ok: false, gaps: read.missing.map((m) => GAP_LABEL[m] || m), said: "" };
    const noun = read.noun;
    const gaps = new Set<string>();
    const warnings = warningsOf ? warningsOf(noun) : probe.flatMap((n) => render(n, { noun }).warnings);
    for (const w of blocking(warnings as never) as { code: string; detail?: string }[]) {
      const face = String(w.detail || "").split(".").pop() || "";
      if (w.code === "missing-noun-form") gaps.add(GAP_LABEL[face] || face);
      else gaps.add("a number word");
    }
    return { read, ok: !gaps.size, gaps: [...gaps], said: render(shownAt, { noun }).text };
  });
  const counted = rows.filter((r) => r.ok);
  const short = rows.filter((r) => !r.ok);
  /* Whether this language counts two with a noun's pair form, which is
     what the line below has to ask for: a gap a noun can have here. */
  const pairs = rows.some((r) => r.gaps.includes(GAP_LABEL.dual)) || rows.some((r) => !!(r.read.noun && r.read.noun.dual));
  /* Where the language has a plural a few nouns take only after three to
     ten — days, months — and this part reaches those numbers, the line
     says where it is written: on the noun's own card. */
  const number = dimsFor(lang, "noun").find((d) => d.field === "number");
  const afterThree =
    range.from <= 10 && range.to >= 3 && !!number && number.options.some(([v]) => v === "counted");
  return (
    <PartBlock
      title="Counting things"
      role={`Students are also asked to say how many of something there are, like "3 books", with numbers from this part. Counting uses your noun cards: any noun card in ${lang.name} with its singular, its plural${pairs ? ", its pair form" : ""} and its gender written. Write or finish one on the Cards tab and it is counted here — nothing to copy across.${afterThree ? " A noun whose plural changes after three to ten, like days or months, has a box for that on its card, under the plural." : ""}`}
    >
      {standing}
      <div className="at-mt5" />
      {counted.length ? (
        <div className="at-numsample">
          {counted.map(({ read, said }) => (
            <div className="at-numsamplerow" key={read.id}>
              <span className="at-numfig">{read.en || read.id}</span>
              <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                {said || "—"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Notice kind="warn">No noun card can be counted here yet.</Notice>
      )}
      {short.length ? (
        <>
          <p className="at-eyebrow at-mt5">{`Not counted here · ${short.length}`}</p>
          <div className="at-bandlist">
            {short.slice(0, 40).map(({ read, gaps }) => (
              <div className="at-bandrow" key={read.id}>
                <span className="at-bandname">{read.en || read.id}</span>
                <Meta>{gaps.join(", ")}</Meta>
              </div>
            ))}
            {short.length > 40 ? <Meta>{`and ${short.length - 40} more`}</Meta> : null}
          </div>
        </>
      ) : null}
    </PartBlock>
  );
}

/**
 * The decks that hold this part.
 *
 * The same thing a deck's own *Numbers and pronouns* screen sets — which
 * parts it holds — reached from the other end, so the two are one setting
 * and not two to keep in step: ticking here is ticking there. It is saved
 * the moment it is ticked, as it is on the deck's screen, and that is why
 * it sits apart from the words above, which wait for Save.
 */
function PartDecks({ range, decks, onDeckPart }: {
  range: Range;
  decks: PartDeck[];
  onDeckPart?: (deckId: string, rangeId: string, on: boolean) => void;
}) {
  if (!onDeckPart) return null;
  return (
    <PartBlock
      title="Decks"
      role="Manage what decks this part belongs to. The same as ticking it on a deck's Numbers and pronouns screen, and saved straight away."
    >
      <DeckSwitch
        of="part"
        decks={decks}
        chosen={decks.filter((d) => partsNow(d.parts || []).includes(range.id)).map((d) => d.id)}
        onToggle={(id, wasOn) => onDeckPart(id, range.id, !wasOn)}
      />
    </PartBlock>
  );
}

/**
 * The blanks this part fills, said the way a card's editor says a card's:
 * a section called Filling blanks, and under it the tags it answers to.
 *
 * Only default tags, because a part's are not chosen — see partTags. They
 * are here to be read: a teacher writing a sentence card needs to know
 * that `{{0-9}}` or `{{number}}` is a blank that will hold a number, and
 * that `{{count-0-9}}` or `{{count}}` will hold a number of things — and
 * this is where they would look for what a part can be borrowed as.
 */
function PartTags({ range, open, counts }: { range: Range; open: boolean; counts: boolean }) {
  /* Its own tag and the general one, first and last: a part split out of
     an older one also answers to that part's tag, for the sentences
     written with it, but that is not a name to write new ones with. */
  const ends = (tags: string[]) => [tags[0], tags[tags.length - 1]];
  const [own, general] = ends(partTags(range));
  const counting = range.counts ? ends(partTags(countingOf(range))) : [];
  const what = (name: string) =>
    name === general
      ? "Any number, from any part"
      : name === counting[1]
        ? "Any number of things, from any part"
        : name === counting[0]
          ? `A number and a thing counted, from ${range.label.toLowerCase()}`
          : `A number from ${range.label.toLowerCase()}`;
  return (
    <PartBlock title="Filling blanks" role="How this part can be used to fill blanks in sentence cards">
      <div className="at-part">
        <p className="at-groupline">The part&rsquo;s tags</p>
        <Help>
          Wherever a sentence card has a blank for one of these tags, this part fills it with one of
          its numbers, written out
          {counting.length ? <>, or for the counting tags with a noun beside it in the form the number calls for</> : null}.
        </Help>
        <div className="at-ticklist at-cardtags">
          <p className="at-eyebrow">Default tags</p>
          <Help>These follow from the part, and are the same in every language.</Help>
          <div className="at-tagchips">
            {[own, general, ...counting].map((name) => (
              <span className="at-tagchip" key={name} title={what(name)}>
                {name}
              </span>
            ))}
          </div>
          {!open ? (
            <p className="at-hint">
              Nothing fills them from this part until it is ready, so a sentence asking for{" "}
              <span className="at-blankname">{own}</span> waits for it.
            </p>
          ) : counting.length && !counts ? (
            <p className="at-hint">
              Nothing fills <span className="at-blankname">{counting[0]}</span> from this part until
              a noun card can be counted with it.
            </p>
          ) : null}
        </div>
      </div>
    </PartBlock>
  );
}


/* ---- the clock ---- */

function TimesTab({ lang, numbers, clock, setClock, hourReady, slots, render, onRecord }: {
  lang: Lang;
  numbers: NumberSystem;
  clock: TimeSystem | null;
  setClock: (f: (c: TimeSystem | null) => TimeSystem | null) => void;
  hourReady: boolean;
  slots: SlotSpec[];
  render: ((h: number, m: number, style: TimeStyle, period: boolean) => { text: string }) | null;
  onRecord: (slot: string) => void;
}) {
  const [style, setStyle] = useState<TimeStyle>("colloquial");
  const [period, setPeriod] = useState(false);

  if (!slots.length) {
    return (
      <Notice kind="warn">
        Nobody has written down how {lang.name} tells the time yet. The numbers still work.
      </Notice>
    );
  }
  if (!hourReady) {
    return (
      <Notice kind="warn">
        <b>The clock waits on the numbers.</b> The word for <i>hour</i> is feminine, so one
        o&apos;clock and two o&apos;clock are said with the numerals that go with a feminine
        word. Fill those in on the number parts — the boxes marked <i>with a feminine word</i> —
        and this opens.
      </Notice>
    );
  }
  if (!clock) return <Notice kind="warn">Nothing to write yet.</Notice>;

  const setLex = (slot: string, text: string) =>
    setClock((c) => (c ? withTimeWord(c, slot, text) : c));
  const setExpr = (mark: number, patch: Partial<MinuteExpr>) =>
    setClock((c) => {
      if (!c) return c;
      const was = c.minuteExprs[String(mark)] || { text: "", refHour: "same" as const };
      const next = { ...was, ...patch };
      const exprs = { ...c.minuteExprs };
      if (!String(next.text || "").trim()) delete exprs[String(mark)];
      else exprs[String(mark)] = next;
      return { ...c, minuteExprs: exprs };
    });

  return (
    <>
      <Help>
        A time is a number with the word for <i>hour</i> in front of it, so most of this is
        already written. What is left is the handful of words a clock has that a number does
        not — <i>past</i>, <i>to</i>, <i>quarter</i>, <i>half</i> — and what each part of the
        day is called.
      </Help>

      <Section title="The words a clock needs" className="at-mt5">
        <div className="at-numgrid">
          {slots.map((slot) => (
            <div className="at-numrow" key={slot.slot}>
              <div className="at-numlabel">
                <span className="at-numfig">{slot.label}</span>
                {slot.hint ? <Meta>{slot.hint}</Meta> : null}
              </div>
              <div className="at-numboxes">
                <ScriptInput
                  lang={lang}
                  value={(clock.lexemes[slot.slot] || { forms: {} }).forms.standalone || ""}
                  label={`${slot.label} in ${lang.name}`}
                  compact
                  onChange={(v) => setLex(slot.slot, v)}
                />
                {(clock.lexemes[slot.slot] || { forms: {} }).forms.standalone ? (
                  <>
                    <LatInput
                      lang={lang}
                      value={((clock.lexemes[slot.slot] || {}).lat || {}).standalone || ""}
                      of={slot.label}
                      onChange={(v) => setClock((c) => (c ? withTimeLat(c, slot.slot, v) : c))}
                    />
                    <Button size="sm" onClick={() => onRecord(slot.slot)}>
                      {(((clock.lexemes[slot.slot] || {}).audio || {}).standalone || []).length
                        ? "Recording ✓"
                        : "Record"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="The word for a minute"
        lede="Counted like anything else, so one minute, two minutes and five minutes come out right on their own."
        className="at-mt5"
      >
        <div className="at-numrow">
          <div className="at-numboxes">
            {(["sg", "dual", "pl"] as const).map((form) => (
              <div className="at-numcell" key={form}>
                <Meta>{form === "sg" ? "one minute" : form === "dual" ? "two minutes" : "several minutes"}</Meta>
                <ScriptInput
                  lang={lang}
                  value={clock.minuteNoun[form] || ""}
                  label={`minute, ${form}`}
                  compact
                  onChange={(v) =>
                    setClock((c) => (c ? { ...c, minuteNoun: { ...c.minuteNoun, [form]: v } } : c))
                  }
                />
              </div>
            ))}
            <Segmented
              label="Gender"
              options={[
                { value: "m" as const, label: "masculine" },
                { value: "f" as const, label: "feminine" },
              ]}
              value={clock.minuteNoun.gender}
              onChange={(g) =>
                setClock((c) => (c ? { ...c, minuteNoun: { ...c.minuteNoun, gender: g } } : c))
              }
            />
          </div>
        </div>
      </Section>

      <Section
        title="Every five minutes"
        lede="What is said at each mark, which hour it counts from, and which side of the hour it goes."
        className="at-mt5"
      >
        <div className="at-numgrid">
          {MINUTE_MARKS.filter((m) => m).map((mark) => {
            const expr = clock.minuteExprs[String(mark)];
            return (
              <div className="at-numrow" key={mark}>
                <div className="at-numlabel">
                  <span className="at-numfig">:{String(mark).padStart(2, "0")}</span>
                </div>
                <div className="at-numboxes">
                  <ScriptInput
                    lang={lang}
                    value={(expr && expr.text) || ""}
                    label={`${mark} minutes past`}
                    compact
                    onChange={(v) => setExpr(mark, { text: v })}
                  />
                  <input
                    className="at-input"
                    value={(expr && expr.en) || ""}
                    placeholder="quarter past"
                    aria-label={`What :${mark} means`}
                    onChange={(e) => setExpr(mark, { en: e.target.value })}
                  />
                  {expr && expr.text ? (
                    <LatInput
                      lang={lang}
                      value={expr.lat || ""}
                      of={`:${String(mark).padStart(2, "0")}`}
                      onChange={(v) => setExpr(mark, { lat: v })}
                    />
                  ) : null}
                  <Segmented
                    label="Counts from"
                    options={[
                      { value: "same" as const, label: "this hour" },
                      { value: "next" as const, label: "the next hour" },
                    ]}
                    value={(expr && expr.refHour) || "same"}
                    onChange={(v) => setExpr(mark, { refHour: v })}
                  />
                  {/* Which side of the hour it is said on. Two languages
                      that count back from the next hour disagree about
                      this — one says *the hour eight, less a quarter* and
                      the other *a quarter to eight* — and it is a fact
                      about the words, so it is written here rather than
                      decided in code. */}
                  <Segmented
                    label="Said"
                    options={[
                      { value: "after" as const, label: "after the hour" },
                      { value: "before" as const, label: "before it" },
                    ]}
                    value={expr && expr.lead ? "before" : "after"}
                    onChange={(v) => setExpr(mark, { lead: v === "before" })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <PeriodsSection lang={lang} clock={clock} setClock={setClock} />

      <Section title="The clock a student sees" className="at-mt5">
        <Segmented
          label="Hours"
          options={[
            { value: "12h" as const, label: "1 to 12" },
            { value: "24h" as const, label: "0 to 23" },
          ]}
          value={clock.clock}
          onChange={(v) => setClock((c) => (c ? { ...c, clock: v } : c))}
        />
      </Section>

      <Section
        title="What a student will be asked"
        action={
          <Segmented
            label="Style"
            options={[
              { value: "colloquial" as const, label: "as people say it" },
              { value: "exact" as const, label: "to the minute" },
            ]}
            value={style}
            onChange={setStyle}
          />
        }
        className="at-mt5"
      >
        <label className="at-dialrow">
          <span>Part of day</span>
          <input type="checkbox" checked={period} onChange={(e) => setPeriod(e.target.checked)} />
          <b />
        </label>
        <div className="at-numsample">
          {TIME_SAMPLE.map(([h, m]) => (
            <div className="at-numsamplerow" key={`${h}:${m}`}>
              <span className="at-numfig">
                {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
              </span>
              <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                {(render && render(h, m, style, period).text) || "—"}
              </span>
            </div>
          ))}
        </div>
        {!numbers.lexemes["unit.1"] ? (
          <Help>The hours will read as gaps until the numerals are written.</Help>
        ) : null}
      </Section>
    </>
  );
}

function PeriodsSection({ lang, clock, setClock }: {
  lang: Lang;
  clock: TimeSystem;
  setClock: (f: (c: TimeSystem | null) => TimeSystem | null) => void;
}) {
  const set = (i: number, patch: Partial<Period>) =>
    setClock((c) =>
      c ? { ...c, periods: c.periods.map((p, at) => (at === i ? { ...p, ...patch } : p)) } : c,
    );
  const hour = (v: string) => Math.min(23, Math.max(0, Math.trunc(Number(v) || 0)));

  return (
    <Section
      title="Parts of the day"
      lede="Which hours each one covers, on a 0 to 23 clock. A part that runs past midnight is written the way it is said — 22 to 4."
      action={
        <Button
          size="sm"
          onClick={() =>
            setClock((c) =>
              c
                ? {
                    ...c,
                    periods: c.periods.concat([
                      { slot: `part${c.periods.length + 1}`, text: "", fromHour: 0, toHour: 0 },
                    ]),
                  }
                : c,
            )
          }
        >
          Add one
        </Button>
      }
      className="at-mt5"
    >
      {!clock.periods.length ? (
        <Help>
          None yet, so nothing says whether a time is in the morning or the evening. That
          question is not asked until there are some.
        </Help>
      ) : null}
      {clock.periods.map((period, i) => (
        <div className="at-numrow" key={period.slot}>
          <div className="at-numlabel">
            <input
              className="at-input"
              value={period.en || ""}
              placeholder="in the morning"
              aria-label="What it means"
              onChange={(e) => set(i, { en: e.target.value })}
            />
          </div>
          <div className="at-numboxes">
            <ScriptInput
              lang={lang}
              value={period.text}
              label={`${period.en || period.slot} in ${lang.name}`}
              compact
              onChange={(v) => set(i, { text: v })}
            />
            {period.text ? (
              <LatInput
                lang={lang}
                value={period.lat || ""}
                of={period.en || period.slot}
                onChange={(v) => set(i, { lat: v })}
              />
            ) : null}
            <div className="at-row">
              <label className="at-dialrow">
                <span>From</span>
                <input
                  className="at-input"
                  type="number"
                  min={0}
                  max={23}
                  value={period.fromHour}
                  onChange={(e) => set(i, { fromHour: hour(e.target.value) })}
                />
                <b />
              </label>
              <label className="at-dialrow">
                <span>To</span>
                <input
                  className="at-input"
                  type="number"
                  min={0}
                  max={23}
                  value={period.toHour}
                  onChange={(e) => set(i, { toHour: hour(e.target.value) })}
                />
                <b />
              </label>
            </div>
            <Button
              size="sm"
              onClick={() =>
                setClock((c) => (c ? { ...c, periods: c.periods.filter((_, at) => at !== i) } : c))
              }
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </Section>
  );
}

/* ---- how a word sounds ---- */

/**
 * The pronunciation beside a box, drawn on the same condition the Record
 * button is: there is a word here to say.
 *
 * It is not decoration. What is typed goes onto the card this word
 * becomes, in the field a card written by hand keeps its transliteration
 * in — so the learner meets the pronunciation under the script, and the
 * question that asks for the script from its sound opens for a word that
 * has one. A row of empty pronunciation fields under a grid nobody has
 * started would be noise, which is why it waits for the word.
 *
 * What it is called is the language's own answer: a transliteration in
 * the two written right-to-left, a pronunciation note in the one already
 * written in Latin letters.
 */
function LatInput({ lang, value, of, onChange }: {
  lang: Lang;
  value: string;
  /** What this is the pronunciation *of*, for the name a screen reader
      reads — the boxes have no visible labels of their own. */
  of: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="at-input at-numlat"
      value={value}
      placeholder={lang.translitLabel.toLowerCase()}
      aria-label={`${lang.translitLabel} for ${of}`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ---- a number written out by hand ---- */

/** The digits of an override key, which may name a face as well. */
const digitsOf = (key: string): number => Number(String(key).split("|")[0]);

/**
 * One number, written out by the teacher, on a screen of its own.
 *
 * It used to unfold in place under the list it was tapped from, which put
 * the box being typed into below the fold on a phone with the whole grid
 * scrolling behind it. A correction is a small piece of work with a
 * beginning and an end, so it gets a screen: what the app says now, what
 * you want it to say, how it sounds, and one button.
 *
 * **What the app builds by itself is shown above the box**, because the
 * question a teacher is answering is not "what is this number" — they
 * know that — but "what did the app get wrong". Rendered with the
 * override taken out, so it is the app's own attempt and not an echo of
 * the correction being written.
 */
function WrittenOutScreen({ lang, draft, forKey, slots, render, onKeep, onClose }: {
  lang: Lang;
  draft: NumberSystem;
  forKey: string;
  /** The language's boxes, for what this face is called in it. */
  slots: SlotSpec[];
  render: (n: number, sys: NumberSystem) => { text: string };
  onKeep: (text: string, lat: string) => void;
  onClose: () => void;
}) {
  const had = draft.overrides[forKey];
  const [text, setText] = useState(had ? had.text : "");
  const [lat, setLat] = useState((had && had.lat) || "");
  const value = digitsOf(forKey);
  const face = String(forKey).split("|")[1] || "";
  const box = slots.find((s) => s.label === String(value) && s.formKeys.includes(face as FormKey));
  const faceName = face ? (box ? faceLabel(box, face as FormKey) : FACE_LABEL[face] || face) : "";
  /* The app's own answer, with the correction taken out of the way. */
  const built = Number.isFinite(value) ? render(value, withOverride(draft, forKey, "")).text : "";
  const changed = text.trim() !== (had ? had.text : "") || lat.trim() !== ((had && had.lat) || "");

  return (
    <Screen
      title={`${Number.isFinite(value) ? value.toLocaleString("en") : forKey}, written out`}
      onBack={onClose}
      action={
        <Button
          variant="primary"
          size="sm"
          disabled={!changed}
          onClick={() => onKeep(text, lat)}
        >
          {text.trim() ? "Keep it" : "Put it back"}
        </Button>
      }
    >
      <Help>
        Whatever is written here is what a student is asked, for this number and wherever it
        turns up inside a bigger one. Clear the box and the app goes back to building it.
        {faceName ? ` This is the form used ${faceName}.` : ""}
      </Help>

      <Section title="What the app says now" className="at-mt5">
        <div className="at-numsample">
          <div className="at-numsamplerow">
            <span className="at-numfig">
              {Number.isFinite(value) ? value.toLocaleString("en") : forKey}
            </span>
            <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
              {built || "—"}
            </span>
          </div>
        </div>
        {!built ? (
          <Help>
            It cannot build this one at all yet, so whatever you write here is the only answer it
            has for it.
          </Help>
        ) : null}
      </Section>

      <Section title="What it should say" className="at-mt5">
        <ScriptInput
          lang={lang}
          value={text}
          label={`${forKey} in ${lang.name}`}
          onChange={setText}
        />
        {text.trim() ? (
          <LatInput lang={lang} value={lat} of={String(value)} onChange={setLat} />
        ) : null}
      </Section>

      {had ? (
        <Help>
          Emptying the box above and keeping it is how you take the correction away: this number
          goes back to being built out of the words in the grid.
        </Help>
      ) : null}
    </Screen>
  );
}

/* ---- trying the system out ---- */

/**
 * Type a number, see it said.
 *
 * The sample list answers "is this right" for thirty numbers somebody
 * else chose. This answers it for the one the teacher is actually
 * wondering about — which is how anybody checks a thing they have just
 * built, and what they were otherwise doing by adding numbers to the
 * sample until one of them was near enough.
 *
 * It says more than the one line, because the interesting faults are in
 * the extra faces rather than in counting aloud: where a number changes
 * for the gender of what stands beside it, both are shown, and every noun
 * the teacher wrote is counted with it. A number that cannot be said at
 * all says what it is waiting for and offers the one thing that always
 * works — writing it out by hand.
 */
function TryItScreen({ lang, draft, labels, render, onWrite, onClose }: {
  lang: Lang;
  draft: NumberSystem;
  labels?: Map<string, string>;
  render: (n: number, ctx?: { noun?: CountedNoun; gender?: "m" | "f" }) => {
    text: string;
    warnings: { code: string; slot?: string; detail?: string }[];
  };
  onWrite: (key: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  /* Digits only, and no more of them than the app will ever ask about —
     read off what was typed rather than refused, so a stray comma or a
     space is simply not a number and never an error message. */
  const digits = typed.replace(/[^0-9]/g, "").slice(0, 7);
  const value = digits === "" ? null : Number(digits);
  /* The number, not what was typed: an override is keyed by the number it
     corrects, so writing one out after typing 007 has to file it under 7
     or it would be a correction the composer never looks up. */
  const key = value === null ? "" : String(value);

  const said = value === null ? null : render(value);
  const masc = value === null ? null : render(value, { gender: "m" });
  const fem = value === null ? null : render(value, { gender: "f" });
  /* Only where the language actually has something to show: in most
     numbers in every language here, all three are the same word. */
  const inflects =
    !!said && !!masc && !!fem && (masc.text !== said.text || fem.text !== said.text);
  const stops = said ? blocking(said.warnings as never) : [];

  const line = (label: string, text: string) => (
    <div className="at-numsamplerow" key={label}>
      <span className="at-numfig">{label}</span>
      <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
        {text || "—"}
      </span>
    </div>
  );

  return (
    <Screen title="Check a number" onBack={onClose}>
      <Help>
        Type any number up to seven figures and see exactly what a student would be asked. It is
        the same words the app would use in a question — nothing here is a preview of something
        else.
      </Help>

      <Section title="The number" className="at-mt5">
        <input
          className="at-input at-numtry"
          value={typed}
          inputMode="numeric"
          placeholder="47"
          aria-label="A number to try, in figures"
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
        />
      </Section>

      {value === null ? (
        <Help>Nothing typed yet.</Help>
      ) : (
        <>
          <Section title="Said" className="at-mt5">
            <div className="at-numsample">
              {line(value.toLocaleString("en"), said ? said.text : "")}
              {inflects && masc && fem
                ? [
                    line(FACE_LABEL.m, masc.text),
                    line(FACE_LABEL.f, fem.text),
                  ]
                : null}
            </div>
            {stops.length ? (
              <Notice kind="warn">
                This one is not finished: {waitingOn(said ? said.warnings : [], labels)}. A student is not
                asked anything the app cannot say in full.
              </Notice>
            ) : null}
            {draft.overrides[key] ? (
              <Help>This is the wording you wrote out yourself, not one the app built.</Help>
            ) : null}
          </Section>

          {draft.nouns.length ? (
            <Section
              title="Counting things"
              lede="The same number in front of each of the words you gave it to count."
              className="at-mt5"
            >
              <div className="at-numsample">
                {draft.nouns.slice(0, 8).map((noun) =>
                  line(noun.en || noun.id, render(value, { noun }).text),
                )}
              </div>
            </Section>
          ) : null}

          <div className="at-row at-mt5">
            <Button onClick={() => onWrite(key)}>
              {draft.overrides[key] ? "Change what it says" : "Write this one out yourself"}
            </Button>
          </div>
        </>
      )}
    </Screen>
  );
}

/* ---- writing into the draft ---- */

/**
 * A word into a box.
 *
 * An emptied box takes the word away and leaves everything else — the
 * recording stays, and so does every other face of the same slot. A slot
 * with nothing left in it is not a slot, which is what the boundary
 * reader would have made of it anyway; doing it here as well means the
 * screen and the disk agree before anything is saved.
 */
export function withWord(sys: NumberSystem, slot: string, key: FormKey, text: string): NumberSystem {
  const was = sys.lexemes[slot] || { slot, forms: {} };
  const forms = { ...was.forms };
  if (String(text || "").trim()) forms[key] = text;
  else delete forms[key];
  const lexemes = { ...sys.lexemes };
  if (Object.keys(forms).length) lexemes[slot] = { ...was, slot, forms };
  else delete lexemes[slot];
  return { ...sys, lexemes, updated: Date.now() };
}

/**
 * And how that word sounds.
 *
 * Kept beside the word rather than inside it, in the shape the recordings
 * already use: one entry per face, absent where nobody wrote one. A slot
 * with no word in it has nothing to sound like, so this refuses rather
 * than creating a lexeme that is a pronunciation and no word — which
 * would read as a gap on the screen and as a word on the wire.
 */
export function withLat(sys: NumberSystem, slot: string, key: FormKey, text: string): NumberSystem {
  const was = sys.lexemes[slot];
  if (!was) return sys;
  const lat = { ...(was.lat || {}) };
  if (String(text || "").trim()) lat[key] = text;
  else delete lat[key];
  return {
    ...sys,
    lexemes: {
      ...sys.lexemes,
      [slot]: { ...was, lat: Object.keys(lat).length ? lat : undefined },
    },
    updated: Date.now(),
  };
}

export function withAudio(sys: NumberSystem, slot: string, key: FormKey, clips: string[]): NumberSystem {
  const was = sys.lexemes[slot];
  if (!was) return sys;
  const audio = { ...(was.audio || {}) };
  if (clips.length) audio[key] = clips;
  else delete audio[key];
  return {
    ...sys,
    lexemes: { ...sys.lexemes, [slot]: { ...was, audio: Object.keys(audio).length ? audio : undefined } },
    updated: Date.now(),
  };
}

/**
 * A number the teacher wrote out, with how it sounds beside it.
 *
 * Emptying the text is how a correction is taken away — the whole entry
 * goes, recording and all, because a pronunciation for a wording that is
 * no longer used is not something anybody would want kept. Emptying only
 * the pronunciation leaves the wording where it is.
 */
export function withOverride(sys: NumberSystem, key: string, text: string, lat = ""): NumberSystem {
  const overrides = { ...sys.overrides };
  const said = String(text || "").trim();
  const how = String(lat || "").trim();
  if (!said) delete overrides[key];
  else {
    const next = { ...(overrides[key] || {}), text: said };
    if (how) next.lat = how;
    else delete next.lat;
    overrides[key] = next;
  }
  return { ...sys, overrides, updated: Date.now() };
}

export function withTimeWord(sys: TimeSystem, slot: string, text: string): TimeSystem {
  const was = sys.lexemes[slot] || { slot, forms: {} };
  const lexemes = { ...sys.lexemes };
  if (String(text || "").trim()) lexemes[slot] = { ...was, slot, forms: { ...was.forms, standalone: text } };
  else delete lexemes[slot];
  return { ...sys, lexemes, updated: Date.now() };
}

/** The same, for a clock's own words, which have one face each. */
export function withTimeLat(sys: TimeSystem, slot: string, text: string): TimeSystem {
  const was = sys.lexemes[slot];
  if (!was) return sys;
  const how = String(text || "").trim();
  return {
    ...sys,
    lexemes: { ...sys.lexemes, [slot]: { ...was, lat: how ? { standalone: how } : undefined } },
    updated: Date.now(),
  };
}

export function withTimeAudio(sys: TimeSystem, slot: string, clips: string[]): TimeSystem {
  const was = sys.lexemes[slot];
  if (!was) return sys;
  return {
    ...sys,
    lexemes: {
      ...sys.lexemes,
      [slot]: { ...was, audio: clips.length ? { standalone: clips } : undefined },
    },
    updated: Date.now(),
  };
}

/* ---- what a shut range is waiting for ---- */

/**
 * The gap holding a range back, in the fewest words that name it.
 *
 * A teacher looking at a greyed-out row wants the box to go and fill in,
 * not a count of how many warnings there were. So the first blocking one
 * is named and the rest are counted — the second is usually the first
 * again, further along the number line.
 */
export function waitingOn(
  warnings: { code: string; slot?: string; detail?: string }[],
  /* What each box is called on the screen — "7", "hundred" — where the
     caller has it, rather than the name the composer files it under. */
  labels?: Map<string, string>,
): string {
  const stops = blocking(warnings as never);
  if (!stops.length) return "not yet";
  const first = stops[0];
  if (first.code === "missing-noun-form" && first.detail === "no nouns to count") {
    return "waiting on something to count";
  }
  const name = (first.slot && labels && labels.get(first.slot)) || first.slot || first.detail || "a word";
  return stops.length > 1 ? `waiting on ${name} and ${plural(stops.length - 1, "more word")}` : `waiting on ${name}`;
}
