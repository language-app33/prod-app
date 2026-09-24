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
import { useEffect, useMemo, useState } from "react";
import type { Lang } from "./types.ts";
import type {
  CountedNoun,
  FormKey,
  MinuteExpr,
  NumberSystem,
  Period,
  SlotSpec,
  TimeSystem,
  TimeStyle,
} from "./numbers/types.ts";
import { MINUTE_MARKS } from "./numbers/types.ts";
import { composerFor, timeComposerFor } from "./numbers/index.ts";
import { blocking, rangeChecks, seeded } from "./numbers/range.ts";
import { Button, Help, Meta, Notice, Screen, Section, Segmented, plural } from "./shared.tsx";
import { RecordingScreen, ScriptInput } from "./card-editor.tsx";

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

/* ---- signing a version off ---- */

/**
 * Where a system stands with its students, and the button that moves it.
 *
 * A language's numbers run to the millions and nobody can read them all,
 * so what a teacher signs off is the sample on this screen — one of every
 * shape the language can get wrong — and *Try a number* for anything else.
 * Students are sent the version last signed off; an edit waits for the
 * next sign-off rather than reaching them unread.
 */
function SignOff({
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
  if (said === system.rev) {
    return (
      <Notice kind="ok">
        {`Signed off. Students get these ${what} as they are saved now.`}
      </Notice>
    );
  }
  const note =
    said === undefined
      ? `Students get these ${what} as saved. Check the list below and sign off. After that, changes reach students only when you sign off again.`
      : said === null
        ? `Students don't get these ${what} yet. Check the list below, then sign off.`
        : `You've changed these ${what} since you last signed off. Students still get the signed-off version until you sign off again.`;
  return (
    <div className="at-reviewbanner">
      <span>{unsaved ? `${note} Save your changes first.` : note}</span>
      <Button size="sm" variant="primary" disabled={unsaved || busy} onClick={() => onSignOff(kind, system)}>
        Sign off
      </Button>
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
}

export function NumberSystemEditor({ lang, numbers, times, onSave, onClose, busy, signed, onSignOff }: EditorProps) {
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
      const said = composer.render(h, draft, { gender: "f" });
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
        draft={draft}
        render={(n, ctx) => composer.render(n, draft, ctx)}
        onWrite={(key) => {
          setTrying(false);
          setWriting(key);
        }}
        onClose={() => setTrying(false)}
      />
    );
  }

  return (
    <Screen
      title="Number system"
      onBack={onClose}
      footer={
        <Button variant="primary" wide disabled={!dirty || busy} onClick={save}>
          {dirty ? "Save" : "Nothing to save"}
        </Button>
      }
    >
      <Segmented
        label="What to write"
        options={[
          { value: "numbers" as const, label: "Numbers" },
          { value: "times" as const, label: "Time" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <SignOff
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
          setDraft={setDraft}
          slots={composer.requiredSlots()}
          render={(n, ctx) => composer.render(n, draft, ctx)}
          checks={rangeChecks(composer, draft)}
          onRecord={(slot, key) => setRecording({ slot, key })}
          onWrite={setWriting}
          onTry={() => setTrying(true)}
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

function NumbersTab({ lang, draft, setDraft, slots, render, checks, onRecord, onWrite, onTry }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  slots: SlotSpec[];
  render: (n: number, ctx?: { noun?: CountedNoun; gender?: "m" | "f" }) => { text: string; warnings: { code: string; slot?: string }[] };
  checks: ReturnType<typeof rangeChecks>;
  onRecord: (slot: string, key: FormKey) => void;
  /** Write this number out by hand, on a screen of its own. */
  onWrite: (key: string) => void;
  onTry: () => void;
}) {
  const [extra, setExtra] = useState<number[]>([]);

  const groups: { id: string; slots: SlotSpec[] }[] = [];
  for (const slot of slots) {
    const at = groups.find((g) => g.id === slot.group);
    if (at) at.slots.push(slot);
    else groups.push({ id: slot.group, slots: [slot] });
  }

  const shown = useMemo(() => SAMPLE.concat(extra), [extra]);

  return (
    <>
      <Help>
        Write the words {lang.name} builds its numbers out of and the app makes the rest. With
        one to ten it can ask anything up to ten; add the tens and it can ask anything up to
        ninety-nine. <b>Nothing here has to be finished</b> — whatever is written works, and the
        list below says what the rest is waiting for.
      </Help>

      <Section title="What can be asked" className="at-mt5">
        <div className="at-bandlist">
          {checks.map((check) => (
            <div className="at-bandrow" key={check.range.id} data-open={check.open ? "" : undefined}>
              <span className="at-bandname">{check.range.label}</span>
              <Meta>{check.open ? "ready" : waitingOn(check.warnings)}</Meta>
            </div>
          ))}
        </div>
      </Section>

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
        <div className="at-numsample">
          {shown.map((value, i) => {
            const said = render(value);
            const key = String(value);
            /* A number the system cannot finish yet still shows what it
               got, because that is what tells a teacher which box to go
               and fill — but it is marked, and quietly greyed. Half of
               forty-seven is the word for seven, and a row that showed it
               like any other would be the screen saying this language
               calls 47 "seven". */
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
        {/* Under the list rather than beside its title: the header takes
            one small control, and this is the more useful of the two —
            the list answers "is this right" for thirty numbers somebody
            else chose, and this answers it for the one you are actually
            wondering about. */}
        <div className="at-row">
          <Button onClick={onTry}>Try a number</Button>
        </div>
      </Section>

      {Object.keys(draft.overrides).length ? (
        <Section
          title="Numbers you wrote out"
          lede="Tap one to change what it says, or to put it back the way the app builds it."
          className="at-mt5"
        >
          <div className="at-numsample">
            {Object.entries(draft.overrides).map(([key, over]) => (
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

      {groups.map((group) => (
        <Section key={group.id} title={group.id} className="at-mt5">
          <div className="at-numgrid">
            {group.slots.map((slot) => (
              <div className="at-numrow" key={slot.slot}>
                <div className="at-numlabel">
                  <span className="at-numfig">{slot.label}</span>
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
        </Section>
      ))}

      <NounsSection lang={lang} draft={draft} setDraft={setDraft} render={render} />
    </>
  );
}

/**
 * The things a counting question counts.
 *
 * Written here rather than read off the teacher's noun cards, and that is
 * a shortcut with a reason: no card in this app carries a dual, because
 * the grammar axis it declares is singular, plural or neither. Reading
 * real cards waits on that axis gaining one, which is append-only work
 * and on the backlog; a handful of nouns written where the numbers are
 * keeps the counting question honest in the meantime.
 */
function NounsSection({ lang, draft, setDraft, render }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  render: (n: number, ctx?: { noun?: CountedNoun }) => { text: string };
}) {
  const set = (i: number, patch: Partial<CountedNoun>) =>
    setDraft((d) => ({
      ...d,
      nouns: d.nouns.map((n, at) => (at === i ? { ...n, ...patch } : n)),
    }));

  return (
    <Section
      title="Things to count"
      lede="Three or four everyday words is plenty. They are what the counting questions ask about."
      action={
        <Button
          size="sm"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              nouns: d.nouns.concat([
                { id: `noun${d.nouns.length + 1}`, sg: "", pl: "", gender: "m", en: "" },
              ]),
            }))
          }
        >
          Add one
        </Button>
      }
      className="at-mt5"
    >
      {!draft.nouns.length ? (
        <Help>
          Nothing to count yet, so the counting questions are not asked. One noun is enough to
          start them.
        </Help>
      ) : null}
      {draft.nouns.map((noun, i) => (
        <div className="at-numrow" key={noun.id}>
          <div className="at-numlabel">
            <input
              className="at-input"
              value={noun.en}
              placeholder="book"
              aria-label="What it is in English"
              onChange={(e) => set(i, { en: e.target.value })}
            />
            <Meta>{render(3, { noun }).text || "—"}</Meta>
          </div>
          <div className="at-numboxes">
            {(["sg", "dual", "pl"] as const).map((form) => (
              <div className="at-numcell" key={form}>
                <Meta>{form === "sg" ? "one" : form === "dual" ? "two (where there is a dual)" : "several"}</Meta>
                <ScriptInput
                  lang={lang}
                  value={noun[form] || ""}
                  label={`${noun.en || noun.id}, ${form}`}
                  compact
                  onChange={(v) => set(i, { [form]: v })}
                />
              </div>
            ))}
            <Segmented
              label="Gender"
              options={[
                { value: "m" as const, label: "masculine" },
                { value: "f" as const, label: "feminine" },
              ]}
              value={noun.gender}
              onChange={(g) => set(i, { gender: g })}
            />
            <Button
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, nouns: d.nouns.filter((_, at) => at !== i) }))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </Section>
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
function TryItScreen({ lang, draft, render, onWrite, onClose }: {
  lang: Lang;
  draft: NumberSystem;
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
    <Screen title="Try a number" onBack={onClose}>
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
                This one is not finished: {waitingOn(said ? said.warnings : [])}. A student is not
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
                {draft.nouns.map((noun) =>
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
export function waitingOn(warnings: { code: string; slot?: string; detail?: string }[]): string {
  const stops = blocking(warnings as never);
  if (!stops.length) return "not yet";
  const first = stops[0];
  if (first.code === "missing-noun-form" && first.detail === "no nouns to count") {
    return "waiting on something to count";
  }
  const name = first.slot || first.detail || "a word";
  return stops.length > 1 ? `waiting on ${name} and ${plural(stops.length - 1, "more word")}` : `waiting on ${name}`;
}
