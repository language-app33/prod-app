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
} from "./numbers/types.ts";
import { MINUTE_MARKS } from "./numbers/types.ts";
import { composerFor, timeComposerFor } from "./numbers/index.ts";
import { blocking, probeOf, rangeChecks, seeded } from "./numbers/range.ts";
import type { RangeCheck } from "./numbers/range.ts";
import { figureOf, homesOf, partTags } from "./numbers/generate.ts";
import { readNouns, withNouns } from "./numbers/nouns.ts";
import type { ReadNoun } from "./numbers/nouns.ts";
import { Button, Help, Meta, Notice, Screen, Section, Segmented, Tile, plural } from "./shared.tsx";
import { DeckSwitch, RecordingScreen, ScriptInput } from "./card-editor.tsx";

/** A box's number in the language's own figures, under the one it is
    called by — "" where the pack has none or the box is not one number. */
function numeralFor(lang: Lang, label: string): string {
  const n = figureOf(label);
  return lang.numerals && n != null ? lang.numerals(n) : "";
}

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

/* ---- publishing a version ---- */

/**
 * Where a system stands with its students, and the button that moves it.
 *
 * A language's numbers run to the millions and nobody can read them all,
 * so what a teacher publishes is what they have checked on this screen —
 * the sample, and *Check a number* for anything else. Students are sent
 * the version last published; a save is the teacher's own working copy and
 * waits for the next Publish rather than reaching them unread.
 *
 * It was called signing off, which said what the teacher was doing and not
 * what it did, beside a Save button that sounded like the thing that
 * reached students. So it is one button, Publish, and a line under it only
 * when there is something the students do not have yet — which is the one
 * thing worth knowing about it at a glance.
 */
function PublishBar({
  kind,
  system,
  signed,
  unsaved,
  busy,
  onSignOff,
}: {
  kind: "numbers" | "times";
  system: NumberSystem | TimeSystem | null;
  signed?: Record<string, number | null>;
  unsaved: boolean;
  busy?: boolean;
  onSignOff?: (kind: "numbers" | "times", system: NumberSystem | TimeSystem) => void;
}) {
  if (!system || !system.id || !onSignOff) return null;
  const what = kind === "times" ? "times" : "numbers";
  const said = signed && Object.prototype.hasOwnProperty.call(signed, system.id) ? signed[system.id] : undefined;
  const published = said === system.rev;
  /* Absent is a system nobody has edited since publishing existed, which
     students get as it is saved — there is nothing waiting, and nothing
     to say until it is edited. */
  const line = unsaved
    ? "Unpublished changes: save them, then publish."
    : said === null
      ? `Not published yet: students don't get these ${what}.`
      : said !== undefined && !published
        ? "Unpublished changes: students still get the version you last published."
        : "";
  return (
    <div className="at-publish">
      <Button
        size="sm"
        variant="primary"
        disabled={published || unsaved || busy}
        onClick={() => onSignOff(kind, system)}
      >
        {published ? "Published" : "Publish"}
      </Button>
      {line ? <p className="at-publishnote">{line}</p> : null}
    </div>
  );
}

/* ---- the screen ---- */

export interface EditorProps {
  lang: Lang;
  numbers: NumberSystem;
  times: TimeSystem | null;
  onSave: (kind: "numbers" | "times", system: NumberSystem | TimeSystem) => void;
  onClose: () => void;
  busy?: boolean;
  /** What the server holds, for saying whether there is anything to save. */
  savedRev?: number;
  /**
   * Which version of each system its teacher signed off, by id: a
   * revision, null where nothing is signed yet, and absent where the
   * system has not been edited since sign-off existed.
   */
  signed?: Record<string, number | null>;
  /** Sign off the version the server holds. */
  onSignOff?: (kind: "numbers" | "times", system: NumberSystem | TimeSystem) => void;
  /** The teacher's cards: the noun cards are what counting counts. */
  cards?: Record<string, unknown>[];
  /** The decks in this language, for which hold each part. */
  decks?: PartDeck[];
  /** Put a part in a deck or take it out — saved at once, as a deck's own
      screen saves it. */
  onDeckPart?: (deckId: string, rangeId: string, on: boolean) => void;
}

export function NumberSystemEditor({
  lang, numbers, times, onSave, onClose, busy, signed, onSignOff, cards = [], decks = [], onDeckPart,
}: EditorProps) {
  const composer = composerFor(lang.id);
  const timeComposer = timeComposerFor(lang.id);
  const [tab, setTab] = useState<"numbers" | "times">("numbers");
  const [draft, setDraft] = useState<NumberSystem>(numbers);
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

  /* Which part each box belongs to, and what each box is called. */
  const homes = useMemo(() => (composer ? homesOf(composer) : new Map<string, string>()), [composer]);
  const slotSpecs = useMemo(() => (composer ? composer.requiredSlots() : []), [composer]);
  const labels = useMemo(() => new Map(slotSpecs.map((s) => [s.slot, s.label])), [slotSpecs]);
  const checks = useMemo(() => (composer ? rangeChecks(composer, counted) : []), [composer, counted]);

  /* Compared by content rather than by how the keys happen to be ordered:
     what the server hands back is read into a fresh object, whose keys
     need not come in the order the one being edited has them. */
  const dirty = stable(draft) !== stable(numbers) || stable(clock) !== stable(times);

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

  const save = () => {
    if (tab === "times" && clock) onSave("times", clock);
    else onSave("numbers", draft);
  };

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
        render={(n, sys) => composer.render(n, sys)}
        onKeep={(text, lat) => {
          setDraft((d) => withOverride(d, writing, text, lat));
          setWriting(null);
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

  const footer = (
    <Button variant="primary" wide disabled={!dirty || busy} onClick={save}>
      {dirty ? "Save" : "Nothing to save"}
    </Button>
  );

  const open = part ? checks.find((c) => c.range.id === part) || null : null;
  if (open) {
    return (
      <PartScreen
        lang={lang}
        draft={draft}
        setDraft={setDraft}
        check={open}
        checks={checks}
        homes={homes}
        labels={labels}
        slots={slotSpecs}
        render={(n, ctx) => composer.render(n, counted, ctx)}
        nouns={nounCards}
        decks={decks}
        footer={footer}
        onRecord={(slot, key) => setRecording({ slot, key })}
        onWrite={setWriting}
        onOpen={setPart}
        onDeckPart={onDeckPart}
        onClose={() => setPart(null)}
      />
    );
  }

  return (
    <Screen title="Number system" onBack={onClose} footer={footer}>
      <Segmented
        label="What to write"
        options={[
          { value: "numbers" as const, label: "Numbers" },
          { value: "times" as const, label: "Time" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <PublishBar
        kind={tab}
        system={tab === "times" ? times : numbers}
        signed={signed}
        unsaved={dirty}
        busy={busy}
        onSignOff={onSignOff}
      />

      {tab === "numbers" ? (
        <NumbersTab
          lang={lang}
          draft={draft}
          checks={checks}
          homes={homes}
          labels={labels}
          render={(n) => composer.render(n, counted)}
          onOpen={setPart}
          onWrite={setWriting}
          onCheck={() => setTrying(true)}
        />
      ) : (
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
      )}
    </Screen>
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
 * box for seven is on 0 to 10's screen, not this one. A counting part is
 * waiting on a noun rather than a word, and says which face no noun has
 * yet.
 */
export function partStatus(
  check: RangeCheck,
  checks: RangeCheck[],
  homes: Map<string, string>,
  labels: Map<string, string>,
): string {
  if (check.open) return "ready";
  const stops = blocking(check.warnings as never) as { code: string; slot?: string; detail?: string }[];
  if (check.range.counted) {
    if (stops.some((w) => w.detail === "no nouns to count")) return "waiting on a noun to count";
    const faces = [...new Set(
      stops.filter((w) => w.code === "missing-noun-form").map((w) => String(w.detail || "").split(".").pop() || ""),
    )]
      .map((f) => ({ sg: "singular", dual: "pair form", pl: "plural" } as Record<string, string>)[f])
      .filter(Boolean);
    /* A number word missing is said the way any part says it, below. */
    if (faces.length && !stops.some((w) => w.slot)) return `waiting on a noun with its ${faces.join(" and ")}`;
  }
  const partLabel = (id: string) => {
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
  const before = checks.find((c) => !c.range.counted && !c.open && c.range.kind === "numbers" && c !== check);
  return before ? `waiting on ${before.range.label}` : waitingOn(check.warnings);
}

function NumbersTab({ lang, draft, checks, homes, labels, render, onOpen, onWrite, onCheck }: {
  lang: Lang;
  draft: NumberSystem;
  checks: RangeCheck[];
  homes: Map<string, string>;
  labels: Map<string, string>;
  render: (n: number) => { text: string; warnings: { code: string; slot?: string }[] };
  /** Open one part's own screen. */
  onOpen: (rangeId: string) => void;
  /** Write this number out by hand, on a screen of its own. */
  onWrite: (key: string) => void;
  onCheck: () => void;
}) {
  const [extra, setExtra] = useState<number[]>([]);
  const shown = useMemo(() => SAMPLE.concat(extra), [extra]);
  const parts = checks.filter((c) => c.range.kind === "numbers");

  return (
    <>
      <Help>
        Write the words {lang.name} builds its numbers out of and the app makes the rest. Each part
        below opens on its own words: with one to ten written the app can ask anything up to ten,
        and with the tens anything up to ninety-nine. <b>Nothing here has to be finished</b> —
        whatever is written works, and each part says what it is still waiting for.
      </Help>

      <Section title="Parts" className="at-mt5">
        <div className="at-numparts">
          {parts.map((check) => (
            <Tile
              key={check.range.id}
              title={check.range.label}
              meta={
                <span className="at-numstate" data-open={check.open ? "" : undefined}>
                  {partStatus(check, checks, homes, labels)}
                </span>
              }
              onOpen={() => onOpen(check.range.id)}
            />
          ))}
        </div>
      </Section>

      {/* Above the list rather than under it: the list answers "is this
          right" for thirty numbers somebody else chose, and this answers
          it for the one the teacher is actually wondering about. */}
      <div className="at-row at-mt5">
        <Button onClick={onCheck}>Check a number</Button>
      </div>

      <Section
        title="What a student will be asked"
        lede="Tap any line to write it out yourself, where the app has it wrong."
        action={
          <Button
            size="sm"
            onClick={() => setExtra((e) => e.concat([Math.floor(seeded(`more ${e.length}`)() * 9999999)]))}
          >
            Another
          </Button>
        }
        className="at-mt5"
      >
        <SampleRows lang={lang} draft={draft} values={shown} render={render} onWrite={onWrite} />
      </Section>
    </>
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
 * first to need, what it says with them, the numbers written out by hand
 * inside it, the decks that hold it and the blanks it fills.
 *
 * The words used to be one long grid of every box the language has, under
 * a list of what could be asked; the list said *11 to 99 is waiting on
 * forty* and the box for forty was somewhere below the fold. Here the
 * part is the way in, and the boxes it is waiting on are the ones on its
 * screen — or, where they belong to an earlier part, that part is named
 * and one tap away.
 */
function PartScreen({
  lang, draft, setDraft, check, checks, homes, labels, slots, render, nouns, decks, footer,
  onRecord, onWrite, onOpen, onDeckPart, onClose,
}: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  check: RangeCheck;
  checks: RangeCheck[];
  homes: Map<string, string>;
  labels: Map<string, string>;
  slots: SlotSpec[];
  render: (n: number, ctx?: { noun?: CountedNoun }) => { text: string; warnings: { code: string; slot?: string; detail?: string }[] };
  /** The teacher's noun cards in this language, read for counting. */
  nouns: ReadNoun[];
  decks: PartDeck[];
  footer: React.ReactNode;
  onRecord: (slot: string, key: FormKey) => void;
  onWrite: (key: string) => void;
  onOpen: (rangeId: string) => void;
  onDeckPart?: (deckId: string, rangeId: string, on: boolean) => void;
  onClose: () => void;
}) {
  const range = check.range;
  const own = slots.filter((s) => homes.get(s.slot) === range.id);
  const status = partStatus(check, checks, homes, labels);
  /* The earlier part this one is waiting on, where it is one, so the way
     to it is a button rather than a hunt. */
  const waitingFor = (() => {
    if (check.open) return null;
    const stops = blocking(check.warnings as never) as { slot?: string }[];
    for (const w of stops) {
      const home = w.slot ? homes.get(w.slot) : "";
      if (home && home !== range.id) return checks.find((c) => c.range.id === home) || null;
    }
    return null;
  })();
  /* Built from the parts before it alone — Huế's 11 to 99. */
  const before = checks.filter((c) => c.range.kind === "numbers" && !c.range.counted);
  const earlier = before.slice(0, Math.max(0, before.findIndex((c) => c.range.id === range.id)));

  const written = range.counted
    ? []
    : Object.entries(draft.overrides).filter(([key]) => {
        const n = digitsOf(key);
        return Number.isFinite(n) && n >= range.from && n <= range.to;
      });

  /* Where it stands, and the way to the earlier part it is waiting on —
     at the head of the part's own words, which is what it is about. */
  const standing = (
    <>
      <p className="at-numstate" data-open={check.open ? "" : undefined}>
        {check.open ? "Ready: a student can be asked anything in this part." : `Not asked yet — ${status}.`}
      </p>
      {waitingFor ? (
        <div className="at-row at-mt3">
          <Button size="sm" onClick={() => onOpen(waitingFor.range.id)}>
            {`Open ${waitingFor.range.label}`}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <Screen title={range.label} onBack={onClose} footer={footer} className="cardform">
      {/* First, as a card's editor puts them near the top: where this part
          goes decides whether anybody is ever asked it. */}
      <PartDecks range={range} decks={decks} onDeckPart={onDeckPart} />

      {range.counted ? (
        <CountedSection lang={lang} range={range} nouns={nouns} render={render} standing={standing} />
      ) : (
        <PartBlock title="Words" role="The words this part is the first to need. Parts after it build on them.">
          {standing}
          <div className="at-mt5">
            {own.length ? (
              <WordGrid lang={lang} draft={draft} setDraft={setDraft} slots={own} onRecord={onRecord} />
            ) : (
              <Help>
                Nothing new to write here: {range.label.toLowerCase()} is built out of the words in{" "}
                {earlier.length ? earlier.map((c) => c.range.label.toLowerCase()).join(" and ") : "the other parts"},
                including the forms they take inside a bigger number.
              </Help>
            )}
          </div>
        </PartBlock>
      )}

      {range.counted ? null : (
        <PartBlock
          title="What a student will be asked"
          role="Tap any line to write it out yourself, where the app has it wrong."
        >
          <SampleRows lang={lang} draft={draft} values={probeOf(range)} render={render} onWrite={onWrite} />
        </PartBlock>
      )}

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

      <PartTags range={range} open={check.open} />
    </Screen>
  );
}

/**
 * The boxes for some slots: a word per face, and once there is one, how it
 * sounds and a recording of it.
 */
function WordGrid({ lang, draft, setDraft, slots, onRecord }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  slots: SlotSpec[];
  onRecord: (slot: string, key: FormKey) => void;
}) {
  return (
    <div className="at-numgrid">
      {slots.map((slot) => (
        <div className="at-numrow" key={slot.slot}>
          <div className="at-numlabel">
            <span className="at-numfig">{slot.label}</span>
            {numeralFor(lang, slot.label) ? (
              <Meta>
                <span lang={lang.id} dir={lang.direction}>
                  {numeralFor(lang, slot.label)}
                </span>
              </Meta>
            ) : null}
            {slot.hint ? <Meta>{slot.hint}</Meta> : null}
          </div>
          <div className="at-numboxes">
            {slot.formKeys.map((key) => (
              <div className="at-numcell" key={key}>
                {slot.formKeys.length > 1 ? <Meta>{FACE_LABEL[key] || key}</Meta> : null}
                <ScriptInput
                  lang={lang}
                  value={(draft.lexemes[slot.slot] || { forms: {} }).forms[key] || ""}
                  label={`${slot.label}, ${FACE_LABEL[key] || key}`}
                  compact
                  onChange={(v) => setDraft((d) => withWord(d, slot.slot, key, v))}
                />
                {(draft.lexemes[slot.slot] || { forms: {} }).forms[key] ? (
                  <>
                    <LatInput
                      lang={lang}
                      value={(draft.lexemes[slot.slot].lat || {})[key] || ""}
                      of={`${slot.label}, ${FACE_LABEL[key] || key}`}
                      onChange={(v) => setDraft((d) => withLat(d, slot.slot, key, v))}
                    />
                    <Button size="sm" onClick={() => onRecord(slot.slot, key)}>
                      {((draft.lexemes[slot.slot].audio || {})[key] || []).length
                        ? "Recording ✓"
                        : "Record"}
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
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
 * The things a counting part counts: the teacher's noun cards.
 *
 * There used to be a list of nouns written on this screen, because no
 * card could say a word was a pair; a card can, so the list went and the
 * cards are read instead — see nouns.ts. What is left here is the answer
 * to the one question a teacher has about it: which of my nouns will be
 * counted, and what is the rest missing.
 */
function CountedSection({ lang, range, nouns, render, standing }: {
  lang: Lang;
  range: Range;
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
    for (const n of probe) {
      for (const w of blocking(render(n, { noun }).warnings as never) as { code: string; detail?: string }[]) {
        const face = String(w.detail || "").split(".").pop() || "";
        if (w.code === "missing-noun-form") gaps.add(GAP_LABEL[face] || face);
        else gaps.add("a number word");
      }
    }
    return { read, ok: !gaps.size, gaps: [...gaps], said: render(shownAt, { noun }).text };
  });
  const counted = rows.filter((r) => r.ok);
  const short = rows.filter((r) => !r.ok);
  /* Whether this language counts two with a noun's pair form, which is
     what the line below has to ask for: a gap a noun can have here. */
  const pairs = rows.some((r) => r.gaps.includes(GAP_LABEL.dual)) || rows.some((r) => !!(r.read.noun && r.read.noun.dual));
  return (
    <PartBlock
      title="Things counted"
      role={`Counting uses your noun cards: any noun card in ${lang.name} with its singular, its plural${pairs ? ", its pair form" : ""} and its gender written. Write or finish one on the Cards tab and it is counted here — nothing to copy across.`}
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
        chosen={decks.filter((d) => (d.parts || []).includes(range.id)).map((d) => d.id)}
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
 * that `{{0-10}}` or `{{number}}` is a blank that will hold a number, and
 * this is where they would look for what a part can be borrowed as.
 */
function PartTags({ range, open }: { range: Range; open: boolean }) {
  const [own, general] = partTags(range);
  const what = (name: string) =>
    name === general
      ? range.counted
        ? "Any number of things, from any counting part"
        : "Any number, from any part"
      : range.counted
        ? `A number and a thing counted, from ${range.label.toLowerCase()}`
        : `A number from ${range.label.toLowerCase()}`;
  return (
    <PartBlock title="Filling blanks" role="How this part can be used to fill blanks in sentence cards">
      <div className="at-part">
        <p className="at-groupline">The part&rsquo;s tags</p>
        <Help>
          Wherever a sentence card has a blank for one of these tags, this part fills it with one of
          its numbers, written out{range.counted ? ", and a noun in the form the number calls for" : ""}.
        </Help>
        <div className="at-ticklist at-cardtags">
          <p className="at-eyebrow">Default tags</p>
          <Help>These follow from the part, and are the same in every language.</Help>
          <div className="at-tagchips">
            {[own, general].map((name) => (
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
        Nobody has written down how {lang.name} tells the time yet. The numbers above still work.
      </Notice>
    );
  }
  if (!hourReady) {
    return (
      <Notice kind="warn">
        <b>The clock waits on the numbers.</b> The word for <i>hour</i> is feminine, so one
        o&apos;clock and two o&apos;clock are said with the numerals that go with a feminine
        word. Fill those in on the Numbers tab — the boxes marked <i>with a feminine word</i> —
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
function WrittenOutScreen({ lang, draft, forKey, render, onKeep, onClose }: {
  lang: Lang;
  draft: NumberSystem;
  forKey: string;
  render: (n: number, sys: NumberSystem) => { text: string };
  onKeep: (text: string, lat: string) => void;
  onClose: () => void;
}) {
  const had = draft.overrides[forKey];
  const [text, setText] = useState(had ? had.text : "");
  const [lat, setLat] = useState((had && had.lat) || "");
  const value = digitsOf(forKey);
  const face = String(forKey).split("|")[1] || "";
  /* The app's own answer, with the correction taken out of the way. */
  const built = Number.isFinite(value) ? render(value, withOverride(draft, forKey, "")).text : "";
  const changed = text.trim() !== (had ? had.text : "") || lat.trim() !== ((had && had.lat) || "");

  return (
    <Screen
      title={`${Number.isFinite(value) ? value.toLocaleString("en") : forKey}, written out`}
      onBack={onClose}
      footer={
        <Button
          variant="primary"
          wide
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
        {face ? ` This is the form used ${FACE_LABEL[face] || face}.` : ""}
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
