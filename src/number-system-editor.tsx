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
import { useMemo, useState } from "react";
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
 * Every shape a language can get wrong, and no more than fits on a screen:
 * the ones that inflect, the ones that fuse, the ones with a nothing in
 * the middle of them, and one of each scale. A spread of pretty numbers
 * would say the system works and prove very little.
 */
const SAMPLE = [
  1, 2, 3, 7, 10, 11, 12, 19, 20, 21, 25, 47, 99, 100, 101, 110, 200, 300, 525, 999,
  1000, 1001, 2000, 3000, 11000, 45000, 100000, 1000000, 2000000, 1525,
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
}

export function NumberSystemEditor({ lang, numbers, times, onSave, onClose, busy }: EditorProps) {
  const composer = composerFor(lang.id);
  const timeComposer = timeComposerFor(lang.id);
  const [tab, setTab] = useState<"numbers" | "times">("numbers");
  const [draft, setDraft] = useState<NumberSystem>(numbers);
  const [clock, setClock] = useState<TimeSystem | null>(times);
  /* Which box is being recorded into, as the slot and the face. One
     recorder, pointed wherever it was asked for — two would be two live
     microphones the moment somebody pressed the second button. */
  const [recording, setRecording] = useState<{ slot: string; key: FormKey; time?: boolean } | null>(null);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(numbers) ||
    JSON.stringify(clock) !== JSON.stringify(times);

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

      {tab === "numbers" ? (
        <NumbersTab
          lang={lang}
          draft={draft}
          setDraft={setDraft}
          slots={composer.requiredSlots()}
          render={(n, ctx) => composer.render(n, draft, ctx)}
          checks={rangeChecks(composer, draft)}
          onRecord={(slot, key) => setRecording({ slot, key })}
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

function NumbersTab({ lang, draft, setDraft, slots, render, checks, onRecord }: {
  lang: Lang;
  draft: NumberSystem;
  setDraft: (f: (d: NumberSystem) => NumberSystem) => void;
  slots: SlotSpec[];
  render: (n: number, ctx?: { noun?: CountedNoun; gender?: "m" | "f" }) => { text: string; warnings: { code: string; slot?: string }[] };
  checks: ReturnType<typeof rangeChecks>;
  onRecord: (slot: string, key: FormKey) => void;
}) {
  const [extra, setExtra] = useState<number[]>([]);
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);

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
            return (
              <button
                className="at-numsamplerow at-tappable"
                key={`${value}-${i}`}
                onClick={() => setEditing({ key, text: said.text })}
              >
                <span className="at-numfig">{value.toLocaleString("en")}</span>
                <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                  {said.text || "—"}
                </span>
                {draft.overrides[key] ? <Meta>yours</Meta> : null}
              </button>
            );
          })}
        </div>
      </Section>

      {editing ? (
        <Section title={`${Number(editing.key).toLocaleString("en")}, written out`} className="at-mt5">
          <Help>
            Whatever is written here is what a student is asked, for this number and wherever it
            turns up inside a bigger one. Clear it and the app goes back to building it.
          </Help>
          <ScriptInput
            lang={lang}
            value={editing.text}
            label={`${editing.key} in ${lang.name}`}
            compact
            onChange={(v) => setEditing((e) => (e ? { ...e, text: v } : e))}
          />
          <div className="at-row at-mt5">
            <Button
              variant="primary"
              onClick={() => {
                setDraft((d) => withOverride(d, editing.key, editing.text));
                setEditing(null);
              }}
            >
              Keep it
            </Button>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Section>
      ) : null}

      {Object.keys(draft.overrides).length ? (
        <Section title="Numbers you wrote out" className="at-mt5">
          <div className="at-numsample">
            {Object.entries(draft.overrides).map(([key, over]) => (
              <div className="at-numsamplerow" key={key}>
                <span className="at-numfig">{key}</span>
                <span className="at-numsaid" lang={lang.id} dir={lang.direction}>
                  {over.text}
                </span>
                <Button size="sm" onClick={() => setDraft((d) => withOverride(d, key, ""))}>
                  Remove
                </Button>
              </div>
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
                        <Button size="sm" onClick={() => onRecord(slot.slot, key)}>
                          {((draft.lexemes[slot.slot].audio || {})[key] || []).length
                            ? "Recording ✓"
                            : "Record"}
                        </Button>
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
                  <Button size="sm" onClick={() => onRecord(slot.slot)}>
                    {(((clock.lexemes[slot.slot] || {}).audio || {}).standalone || []).length
                      ? "Recording ✓"
                      : "Record"}
                  </Button>
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
        lede="What is said at each mark, and whether it counts from this hour or the next one."
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
                  <Segmented
                    label="Counts from"
                    options={[
                      { value: "same" as const, label: "this hour" },
                      { value: "next" as const, label: "the next hour" },
                    ]}
                    value={(expr && expr.refHour) || "same"}
                    onChange={(v) => setExpr(mark, { refHour: v })}
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

export function withOverride(sys: NumberSystem, key: string, text: string): NumberSystem {
  const overrides = { ...sys.overrides };
  if (String(text || "").trim()) overrides[key] = { ...(overrides[key] || {}), text: text.trim() };
  else delete overrides[key];
  return { ...sys, overrides, updated: Date.now() };
}

export function withTimeWord(sys: TimeSystem, slot: string, text: string): TimeSystem {
  const was = sys.lexemes[slot] || { slot, forms: {} };
  const lexemes = { ...sys.lexemes };
  if (String(text || "").trim()) lexemes[slot] = { ...was, slot, forms: { ...was.forms, standalone: text } };
  else delete lexemes[slot];
  return { ...sys, lexemes, updated: Date.now() };
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
