/*
 * The screens a teacher reads a frame's sentences on.
 *
 * Three, and each answers one question:
 *
 *   * **ReviewScreen** — what does this card make, and which of it may a
 *     student see? Every sentence the card makes today, exactly as a
 *     student is shown it, each one approved, struck or waiting. Above the
 *     most anyone can read it offers no approval at all, and narrows a
 *     blank instead.
 *   * **ReviewLine** — where does this card stand? One line on a card's
 *     own page, with the way in to the screen above.
 *   * **ReportsScreen** — what have students said is wrong? The reports on
 *     this teacher's cards, with the sentence a report is about struck in
 *     one tap.
 *
 * What a review is, and how a sentence is recognised, is review.ts; this
 * is only what the teacher is shown and what they can press.
 */
import { useMemo, useState } from "react";
import type { Card, Flag, Lang, LangId } from "./types.ts";
import { leadOf } from "./cards.ts";
import { categoriesOf, scriptVars } from "./languages.ts";
import {
  cardSentences,
  holedParts,
  narrowed,
  REVIEW_CEILING,
  reviewOf,
  reviewPool,
  stateFrom,
} from "./review.ts";
import type { PartSentences, ReviewState, Sentence } from "./review.ts";
import { fillNames, refClash, refOf, slotName, slotsOf, WORD_SLOT } from "./variables.ts";
import { ownSlot } from "./verbs.ts";
import { Button, CheckList, Field, Help, Notice, Screen, Section, Segmented, plural } from "./shared.tsx";

type Mark = "ok" | "no" | null;

/* How many sentences of a frame that is over the ceiling are drawn, so the
   teacher can see what the blank is being filled with while narrowing. */
const OVER_SHOWN = 30;

/** A card's standing, said in a line — for a card's page and a list. */
export function reviewSummary(state: ReviewState | null | undefined): string {
  if (!state || state.kind === "none") return "";
  if (state.kind === "legacy") {
    return state.over
      ? `Shown without review · makes ${plural(state.sentences, "sentence")}, too many to read`
      : `Shown without review · ${plural(state.sentences, "sentence")} to read`;
  }
  if (state.over) return `Too many sentences to review · ${state.approved} shown`;
  if (state.waiting) return `${state.waiting} waiting for review · ${state.approved} shown`;
  if (!state.sentences) return "Reviewed · makes no sentences yet";
  return `Reviewed · ${state.approved} shown${state.struck ? ` · ${state.struck} struck` : ""}`;
}

/** One line on a card's page: where it stands, and the way in. */
export function ReviewLine({ state, onOpen }: { state: ReviewState | null | undefined; onOpen: () => void }) {
  if (!state || state.kind === "none") return null;
  const waiting = state.kind === "legacy" || state.waiting > 0 || state.over;
  return (
    <div className={`at-reviewline${waiting ? " waiting" : ""}`}>
      <span className="at-reviewsays">{reviewSummary(state)}</span>
      <Button size="sm" variant={waiting ? "primary" : "default"} onClick={onOpen}>
        Review sentences
      </Button>
    </div>
  );
}

/* One sentence, drawn the way the card editor draws an example: the
   script, how it is said, what it means. */
function SentenceText({ line, lang }: { line: Sentence; lang: Lang }) {
  return (
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
  );
}

/**
 * Every sentence one card makes, to be approved or struck.
 *
 * Nothing is sent until **Save review**, so a teacher can work down a list
 * and change their mind; what is sent is only what they changed.
 */
export function ReviewScreen({
  card,
  cards,
  lang,
  busy,
  onClose,
  onReview,
  onNarrow,
}: {
  card: Card;
  cards: Card[];
  lang: Lang;
  busy?: boolean;
  onClose: () => void;
  /** Send what changed. Resolves once the server has it. */
  onReview: (change: { ok: string[]; no: string[]; clear: string[] }) => Promise<void>;
  /** Save the frame and the words a blank was narrowed to. */
  onNarrow: (changed: Card[]) => Promise<void>;
}) {
  const parts: PartSentences[] = useMemo(() => cardSentences(card, cards, lang), [card, cards, lang]);
  const state = useMemo(() => stateFrom(card, parts), [card, parts]);
  const review = reviewOf(card);
  const had = useMemo(() => {
    const out = new Map<string, Mark>();
    for (const k of (review && review.ok) || []) out.set(k, "ok");
    for (const k of (review && review.no) || []) out.set(k, "no");
    return out;
  }, [review]);
  const [marks, setMarks] = useState<Map<string, Mark>>(() => new Map(had));
  const [error, setError] = useState("");
  const markOf = (key: string): Mark => (marks.has(key) ? (marks.get(key) as Mark) : null);
  const set = (key: string, mark: Mark) =>
    setMarks((prev) => {
      const next = new Map(prev);
      if (mark) next.set(key, mark);
      else next.delete(key);
      return next;
    });
  const all = parts.flatMap((p) => p.list);
  const waiting = all.filter((s) => !markOf(s.key));
  const changed = all.filter((s) => (had.get(s.key) || null) !== markOf(s.key));

  async function save() {
    const ok: string[] = [];
    const no: string[] = [];
    const clear: string[] = [];
    for (const s of changed) {
      const m = markOf(s.key);
      if (m === "ok") ok.push(s.key);
      else if (m === "no") no.push(s.key);
      else clear.push(s.key);
    }
    try {
      setError("");
      /* A card from before review is turned on by its first save even when
         nothing was marked — reading the list and approving none of it is
         an answer too. */
      await onReview({ ok, no, clear });
    } catch (e) {
      setError(String((e && (e as Error).message) || e));
    }
  }

  const unsaved = changed.length > 0;
  const canSave = !state.over && (unsaved || state.kind === "legacy");
  return (
    <Screen
      title="Review sentences"
      onBack={onClose}
      action={
        <Button variant="primary" size="sm" disabled={!canSave || busy} onClick={save}>
          Save review
        </Button>
      }
    >
      <Help>
        Every sentence this card makes today, exactly as a student sees it. Students are shown only
        the ones you approve. A sentence you strike is never shown, and new ones wait here until you
        read them.
      </Help>
      {state.kind === "legacy" && !state.over && (
        <Notice kind="warn">
          This card was shown to students before review existed, so they still see every sentence it
          makes. Once you save a review, they see only the ones you approved.
        </Notice>
      )}
      <Notice kind="error">{error}</Notice>

      {state.over ? (
        <OverCeiling card={card} cards={cards} lang={lang} parts={parts} busy={busy} onNarrow={onNarrow} />
      ) : (
        <>
          <div className="at-reviewcounts">
            <span>{plural(all.length, "sentence")}</span>
            <span className="ok">{all.filter((s) => markOf(s.key) === "ok").length} approved</span>
            <span className="no">{all.filter((s) => markOf(s.key) === "no").length} struck</span>
            <span className="wait">{waiting.length} waiting</span>
          </div>
          {!all.length && (
            <Help>
              Nothing fills its blanks yet, so it makes no sentences. Once words fill them, the sentences
              they make appear here to review.
            </Help>
          )}
          {waiting.length > 0 && (
            <div className="at-row">
              <Button onClick={() => waiting.forEach((s) => set(s.key, "ok"))}>
                Approve the {plural(waiting.length, "waiting sentence")}
              </Button>
            </div>
          )}
          {parts.map((part, at) => (
            <Section
              key={part.id || at}
              title={parts.length > 1 ? partTitle(card, part, at) : undefined}
              count={parts.length > 1 ? part.list.length : undefined}
            >
              <ol className="at-asked at-reviewlist">
                {part.list.map((line) => {
                  const m = markOf(line.key);
                  return (
                    <li className={`at-askedline${m ? ` ${m}` : " wait"}`} key={line.key}>
                      <SentenceText line={line} lang={lang} />
                      <span className="at-reviewmarks">
                        <button
                          type="button"
                          className={`at-reviewmark ok${m === "ok" ? " on" : ""}`}
                          aria-pressed={m === "ok"}
                          onClick={() => set(line.key, m === "ok" ? null : "ok")}
                        >
                          {m === "ok" ? "Approved" : "Approve"}
                        </button>
                        <button
                          type="button"
                          className={`at-reviewmark no${m === "no" ? " on" : ""}`}
                          aria-pressed={m === "no"}
                          onClick={() => set(line.key, m === "no" ? null : "no")}
                        >
                          {m === "no" ? "Struck" : "Strike"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          ))}
        </>
      )}
    </Screen>
  );
}

/* What one part of a card is called, where the card has several: the
   first words of the frame, which is how a teacher tells them apart. */
function partTitle(card: Card, part: PartSentences, at: number): string {
  const found = holedParts(card).find((p) => String(p.id || card.id) === part.id);
  const said = found ? String(found.en || found.ar || "").trim() : "";
  return said ? (said.length > 48 ? `${said.slice(0, 47)}…` : said) : `Part ${at + 1}`;
}

/**
 * A frame that makes more sentences than anyone can read: how many, a
 * first page of them, and the way to narrow a blank until it can be read.
 */
function OverCeiling({
  card,
  cards,
  lang,
  parts,
  busy,
  onNarrow,
}: {
  card: Card;
  cards: Card[];
  lang: Lang;
  parts: PartSentences[];
  busy?: boolean;
  onNarrow: (changed: Card[]) => Promise<void>;
}) {
  const combos = parts.reduce((n, p) => n + p.combos, 0);
  const shown = parts.flatMap((p) => p.list).slice(0, OVER_SHOWN);
  return (
    <>
      <Notice kind="warn">
        This card makes {combos.toLocaleString()} sentences. Nobody can read that many, so it can't be
        approved as it is. Narrow a blank below until it makes {REVIEW_CEILING} or fewer.
      </Notice>
      <NarrowBlank card={card} cards={cards} lang={lang} busy={busy} onNarrow={onNarrow} />
      {shown.length > 0 && (
        <Section title="A few of them" lede="What the blanks are being filled with now.">
          <ol className="at-asked">
            {shown.map((line) => (
              <li className="at-askedline" key={line.key}>
                <SentenceText line={line} lang={lang} />
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

/**
 * Narrow one blank to the words that belong in it.
 *
 * The teacher ticks the words and names the group; the blank is renamed
 * to that group and each ticked word is tagged with it, in one go. It is
 * what they could do by hand — rename the blank, then open twenty cards
 * and tick the group on each — without the twenty cards.
 */
export function NarrowBlank({
  card,
  cards,
  lang,
  busy,
  onNarrow,
}: {
  card: Card;
  cards: Card[];
  lang: Lang;
  busy?: boolean;
  onNarrow: (changed: Card[]) => Promise<void>;
}) {
  const part = holedParts(card)[0] || null;
  const own = part ? ownSlot(part) : "";
  const blanks = part ? slotsOf(part).filter((s) => s !== own) : [];
  const [slot, setSlot] = useState(blanks[0] || "");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  /* The cards behind the blank, once each, in the order the practice
     screen meets them. */
  const words = useMemo(() => {
    if (!part || !slot) return [] as Card[];
    const { values, owner } = reviewPool(part, cards, lang);
    const out: Card[] = [];
    const seen = new Set<string>();
    for (const v of values[slot] || []) {
      const from = owner.get(refOf(v));
      const c = from ? (from.card as Card) : null;
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out;
  }, [part, slot, cards, lang]);

  const group = slotName(name);
  const clash = useMemo(() => {
    if (!group) return "";
    if (group === WORD_SLOT) return "Every word already fills {{word}}. Pick another name.";
    const held = refClash(group, cards as unknown as Record<string, unknown>[], "", categoriesOf(lang).map((c) => c.id));
    if (held && held.kind === "category") return `{{${group}}} is a kind of word already. Pick another name.`;
    if (held && held.kind === "card") return `A card already has the ID ${group}. Pick another name.`;
    return "";
  }, [group, cards, lang]);

  if (!part || !blanks.length) return null;
  const ready = !!group && !clash && picked.length > 0 && group !== slot;

  async function go() {
    const chosen = words.filter((w) => picked.includes(w.id));
    const done = narrowed(card, slot, group, chosen);
    if (!done) return;
    try {
      setError("");
      await onNarrow([done.frame as Card, ...(done.fillers as Card[])]);
      setPicked([]);
      setName("");
    } catch (e) {
      setError(String((e && (e as Error).message) || e));
    }
  }

  return (
    <Section
      title="Narrow a blank"
      lede="Tick the words that belong in it and give them a group name. The blank then takes only those words."
    >
      {blanks.length > 1 && (
        <Segmented
          label="Which blank"
          options={blanks.map((b) => ({ value: b, label: `{{${b}}}` }))}
          value={slot}
          onChange={(v: string) => {
            setSlot(v);
            setPicked([]);
          }}
        />
      )}
      <Help>
        {`{{${slot}}} is filled by ${plural(words.length, "word")} now. `}
        {picked.length ? `${plural(picked.length, "word")} ticked.` : "None ticked yet."}
      </Help>
      <div className="at-row">
        <Button size="sm" onClick={() => setPicked(words.map((w) => w.id))}>
          Tick all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
          Clear
        </Button>
      </div>
      <div className="at-narrowlist">
        <CheckList
          options={words.map((w) => ({
            id: w.id,
            title: leadOf(w).ar || w.name || "",
            note: [leadOf(w).en, fillNames(w).length ? `in ${fillNames(w).map((n) => `{{${n}}}`).join(", ")}` : ""]
              .filter(Boolean)
              .join(" · "),
          }))}
          chosen={picked}
          onToggle={(id: string, wasOn: boolean) =>
            setPicked((prev) => (wasOn ? prev.filter((x) => x !== id) : prev.concat([id])))
          }
        />
      </div>
      <Field label="Group name" htmlFor="at-narrow-name" className="at-mt5">
        <input
          id="at-narrow-name"
          className="at-input"
          value={name}
          placeholder="food, drinks, places…"
          onChange={(e) => setName(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      {group && !clash && (
        <Help>{`The blank becomes {{${group}}}, and the ticked words are tagged ${group}.`}</Help>
      )}
      <Notice kind="error">{clash || error}</Notice>
      <div className="at-row">
        <Button variant="primary" disabled={!ready || busy} onClick={go}>
          {picked.length ? `Narrow to ${plural(picked.length, "word")}` : "Narrow"}
        </Button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------
   Reports
   ------------------------------------------------------------------ */

const KIND_SAYS: Record<string, string> = {
  strict: "Marked a right answer wrong",
  data: "Something on the card is wrong",
  other: "Something else",
};

/**
 * What students have said is wrong, on cards this teacher can change.
 *
 * A report about a sentence a frame made carries that sentence's
 * fingerprint, so it can be struck from here without opening anything;
 * any report can open its card's review, or be dismissed once dealt with.
 */
export function ReportsScreen({
  flags,
  cards,
  languages,
  busy,
  onClose,
  onStrike,
  onReview,
  onDismiss,
}: {
  flags: Flag[];
  cards: Card[];
  languages: Record<LangId, Lang>;
  busy?: boolean;
  onClose: () => void;
  onStrike: (flag: Flag, card: Card) => void;
  onReview: (card: Card) => void;
  onDismiss: (flag: Flag) => void;
}) {
  const byId = new Map(cards.map((c) => [c.id, c] as [string, Card]));
  return (
    <Screen title="Reports from students" onBack={onClose}>
      <Help>
        What students said was wrong on your cards. A report about one sentence of a sentence card can
        strike that sentence, so no student sees it again.
      </Help>
      {!flags.length && <Help>No reports. When a student reports a question, it appears here.</Help>}
      <ul className="at-reportlist">
        {flags.map((f) => {
          const card = byId.get(f.cardId) || null;
          const lang = languages[f.language] || null;
          const review = card ? reviewOf(card) : null;
          const struck = !!(f.sentence && review && (review.no || []).includes(f.sentence));
          return (
            <li className="at-report" key={f.id}>
              <div className="at-reportkind">
                {KIND_SAYS[f.kind] || f.kind}
                {f.cardState === "edited" ? " · card edited since" : f.cardState === "gone" ? " · card deleted" : ""}
              </div>
              <div
                className="at-reportprompt"
                lang={lang ? lang.id : undefined}
                dir={lang ? lang.direction : undefined}
                style={lang ? { fontFamily: lang.fontStack, ...scriptVars(lang) } : undefined}
              >
                {f.prompt}
              </div>
              {f.meaning && <div className="at-reportmeans">{f.meaning}</div>}
              {f.note && <div className="at-reportnote">“{f.note}”</div>}
              {f.answer && <div className="at-reportnote">They answered: {f.answer}</div>}
              <div className="at-reportwho">
                {f.handleName || f.handle} · {new Date(f.at).toLocaleDateString()}
              </div>
              <div className="at-row">
                {card && f.sentence && (
                  <Button size="sm" variant="danger" disabled={busy || struck} onClick={() => onStrike(f, card)}>
                    {struck ? "Sentence struck" : "Strike this sentence"}
                  </Button>
                )}
                {card && holedParts(card).length > 0 && (
                  <Button size="sm" onClick={() => onReview(card)}>
                    Review sentences
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDismiss(f)}>
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
