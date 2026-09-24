/*
 * A language's pronouns, written once.
 *
 * In a language whose verbs change with who does them, a pronoun is not
 * one more word: it is what picks the verb's column. أنا is *I*, and a
 * sentence "{{pronoun}} {{verb}} عربي" filled with it wants بحكي and not
 * بيحكي. Nothing about a pronoun's number or gender can say which column
 * it is — "I" and "he" are both singular — so it has to be told, and the
 * set is fixed: it is the columns the verb table already has.
 *
 * So there is one screen per language, a row per column, the way numbers
 * are written: the teacher types each pronoun, how it is said, what it
 * means, and records it. Each row becomes an ordinary card of the Pronoun
 * kind carrying `person` — the column it is — which is what lets it be
 * practised like any other card, go in a deck, be recorded, sync and be
 * backed up with nothing new underneath, while a sentence's verb takes
 * its column by name (see personFor in verbs.ts).
 *
 * A row left empty makes no card. A row cleared that had one leaves the
 * card alone: taking a card away is the card list's job, where what else
 * it is in can be seen.
 */
import { useMemo, useState } from "react";
import type { Card, Lang } from "./types.ts";
import { verbOf } from "./languages.ts";
import { personsOf, picksOf } from "./verbs.ts";
import { formsOf } from "./cards.ts";
import { Button, Field, Help, Notice, Screen, plural } from "./shared.tsx";
import { RecordingScreen, ScriptInput } from "./card-editor.tsx";
import * as API from "./courses-api.ts";

/** What one row holds while it is being written. */
type Row = { ar: string; lat: string; en: string; clips: string[]; slowClips: string[] };

const EMPTY: Row = { ar: "", lat: "", en: "", clips: [], slowClips: [] };

/* The row as the card on file has it, or empty. */
const rowOf = (card: Card | undefined): Row => {
  if (!card) return { ...EMPTY };
  const lead = (formsOf(card)[0] || {}) as Record<string, any>;
  return {
    ar: String(lead.ar || ""),
    lat: String(lead.lat || ""),
    en: String(lead.en || ""),
    clips: Array.isArray(lead.clips) ? lead.clips : [],
    slowClips: Array.isArray(lead.slowClips) ? lead.slowClips : [],
  };
};

const same = (a: Row, b: Row) =>
  a.ar === b.ar && a.lat === b.lat && a.en === b.en &&
  a.clips.join() === b.clips.join() && a.slowClips.join() === b.slowClips.join();

/** The pronoun card for one column of this language, where there is one. */
export const pronounCardFor = (cards: Card[], langId: string, person: string): Card | undefined =>
  cards.find((c) => c && c.lang === langId && c.person === person);

/**
 * Whether a language has pronouns to write: a verb table whose columns are
 * people. A language whose verbs do not change with the person — Huế —
 * declares one column, and there is nothing for a pronoun to pick.
 */
export const hasPronouns = (lang: Lang | null | undefined): boolean =>
  personsOf(verbOf(lang)).length > 1;

export function PronounsEditor({ lang, cards, busy, onSave, onClose }: {
  lang: Lang;
  /** The teacher's cards, which is where the pronouns already written are. */
  cards: Card[];
  busy?: boolean;
  /** Save one card; resolves when the server has it (or it is kept for later). */
  onSave: (card: Partial<Card>, decks: string[]) => Promise<unknown>;
  onClose: () => void;
}) {
  const persons = useMemo(() => personsOf(verbOf(lang)), [lang]);
  const held = useMemo(
    () => Object.fromEntries(persons.map((p) => [p.id, pronounCardFor(cards, lang.id, p.id)])),
    [persons, cards, lang.id],
  );
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(persons.map((p) => [p.id, rowOf(held[p.id])])),
  );
  const [recording, setRecording] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] || EMPTY), ...patch } }));
  /* What would be saved: rows with a word in them that differ from their card. */
  const changed = persons.filter((p) => {
    const row = rows[p.id] || EMPTY;
    return row.ar.trim() && !same(row, rowOf(held[p.id]));
  });

  async function save() {
    setSaving(true);
    setError("");
    try {
      for (const p of changed) {
        const row = rows[p.id];
        const card = held[p.id];
        /* The column's own grammar where it has one — "he" is singular and
           masculine — so the pronoun agrees like any word where a sentence
           asks it to. "I" has none, and needs none: the column is named. */
        const picks = picksOf(p).length === 1 ? picksOf(p)[0] : {};
        await onSave(
          {
            ...(card || {}),
            id: card ? card.id : "",
            lang: lang.id,
            category: "pronoun",
            person: p.id,
            forms: [{
              ...((card && formsOf(card)[0]) || {}),
              ar: row.ar.trim(),
              lat: row.lat.trim(),
              en: row.en.trim() || p.label,
              clips: row.clips,
              slowClips: row.slowClips,
              ...picks,
            }],
          } as Partial<Card>,
          card && Array.isArray((card as any).decks) ? (card as any).decks : [],
        );
      }
    } catch (e) {
      setError(API.explain(e));
    } finally {
      setSaving(false);
    }
  }

  if (recording) {
    const p = persons.find((x) => x.id === recording);
    const row = rows[recording] || EMPTY;
    return (
      <RecordingScreen
        title={`Recordings · ${p ? p.label : ""}`}
        form={row}
        onChange={(next) => set(recording, next)}
        onClose={() => setRecording(null)}
      />
    );
  }

  return (
    <Screen
      title={`Pronouns · ${lang.name}`}
      onBack={onClose}
      className="cardform"
      footer={
        <Button variant="primary" wide disabled={!changed.length || saving || busy} onClick={save}>
          {saving ? "Saving…" : changed.length ? `Save ${plural(changed.length, "pronoun")}` : "Nothing to save"}
        </Button>
      }
    >
      <Help>
        The words for I, you, he and the rest, written once for {lang.name}. Each becomes a card
        that can be practised and put in decks, and a sentence with a {"{{pronoun}}"} blank puts
        its verb in the form that goes with the pronoun it is filled with.
      </Help>
      <Notice kind="error">{error}</Notice>
      <div className="at-formblock at-pronouns">
        {persons.map((p) => {
          const row = rows[p.id] || EMPTY;
          const takes = row.clips.length + row.slowClips.length;
          return (
            <div className="at-part" key={p.id} data-person={p.id}>
              <p className="at-groupline">{p.label}</p>
              <Field label={lang.scriptLabel}>
                <ScriptInput
                  lang={lang}
                  value={row.ar}
                  label={`${lang.scriptLabel} for ${p.label}`}
                  onChange={(v) => set(p.id, { ar: v })}
                />
              </Field>
              {lang.translitLabel ? (
                <Field label={lang.translitLabel}>
                  <input
                    className="at-input"
                    value={row.lat}
                    aria-label={`${lang.translitLabel} for ${p.label}`}
                    onChange={(e) => set(p.id, { lat: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label="English">
                <input
                  className="at-input"
                  value={row.en}
                  placeholder={p.label}
                  aria-label={`English for ${p.label}`}
                  onChange={(e) => set(p.id, { en: e.target.value })}
                />
              </Field>
              <div className="at-chips">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="mic"
                  disabled={!row.ar.trim()}
                  aria-label={`Recordings for ${p.label}`}
                  onClick={() => setRecording(p.id)}
                >
                  {takes ? plural(takes, "recording") : "Record"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
