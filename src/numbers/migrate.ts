/*
 * A teacher's old number cards, as a system.
 *
 * Numbers were fifty-five cards with a `value` on each. They are one
 * document now, and this is the one-way door between the two: read the
 * cards, fill in the boxes they map onto, and write everything else out
 * as a correction.
 *
 * Three things make it safe to run more than once, which it has to be
 * because it runs the first time anybody opens the screen:
 *
 *   * **It builds a system, it does not merge one.** A system that exists
 *     is never touched; the caller checks that before asking.
 *   * **Nothing is deleted.** The cards stay exactly where they are, in
 *     whatever decks they are in, with their recordings and every
 *     student's progress on them. They are marked as having been read,
 *     and a later release takes them away.
 *   * **It says where every box came from.** `migratedFrom` names the
 *     card each slot was filled from, which is what lets a device hand a
 *     learner's year on *forty* to the component card that replaces it
 *     rather than starting them again.
 *
 * What it cannot do is invent. The old model never asked for the form a
 * numeral takes directly before a noun, because nothing in the app could
 * say it — so those boxes come across empty and the editor shows them as
 * the gaps they are. A migration that guessed would be a migration nobody
 * could tell had guessed.
 */
import type { Composer, FormKey, NumberSystem, OldCard } from "./types.ts";
import { NUMBER_CEILING } from "./types.ts";

/**
 * A card as the server stores one, narrowed to what this reads.
 *
 * Open at the end, because it is handed a whole stored card and reads
 * three of its fields: stating the three and refusing the rest would be a
 * shape no caller actually has.
 */
export interface NumberCard {
  id: string;
  value?: unknown;
  forms?: { ar?: unknown; row?: unknown; col?: unknown }[];
  [more: string]: unknown;
}

/**
 * Which box a value goes in, or nothing for a value that is a correction
 * rather than a part.
 *
 * The scales are the interesting half. One and two of anything are their
 * own words in both Semitic packs — *a thousand* and *two thousand* are
 * not *one* and *two* with a word after them — so they have boxes; three
 * hundred and three thousand are built, or written out where the dialect
 * fuses them. Anything else with a value is a number the teacher wrote in
 * full, which is exactly what a correction is.
 */
export function slotForValue(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > NUMBER_CEILING) return null;
  if (value <= 10) return `unit.${value}`;
  if (value <= 19) return `teen.${value}`;
  if (value <= 99) return value % 10 === 0 ? `ten.${value}` : null;
  for (const [unit, name] of [
    [100, "hundred"],
    [1000, "thousand"],
    [1000000, "million"],
  ] as [number, string][]) {
    if (value === unit) return `${name}.1`;
    if (value === unit * 2) return `${name}.2`;
  }
  return null;
}

/** A card's own word, and the named cells beside it. */
export function oldCardOf(card: NumberCard): OldCard {
  const forms = Array.isArray(card.forms) ? card.forms : [];
  const cells: Record<string, string> = {};
  for (const form of forms.slice(1)) {
    const col = String((form && form.col) || "");
    const text = String((form && form.ar) || "").trim();
    if (col && text) cells[col] = text;
  }
  return { word: String((forms[0] && forms[0].ar) || "").trim(), cells };
}

export interface Migrated {
  system: NumberSystem;
  /** How many boxes were filled and how many numbers were written out,
      for the line that tells the teacher what happened. */
  filled: number;
  written: number;
  /** The cards this read, so the caller can mark them. */
  fromCards: string[];
}

/**
 * Build a system out of a teacher's number cards.
 *
 * The slots the composer asks for are the only ones filled: a value that
 * maps onto no box is a number the teacher wrote in full, and it becomes
 * a correction — which is the right answer for the fused hundreds in
 * Arabic, where *three hundred* is one word and always was.
 */
export function migrateCards(
  cards: NumberCard[],
  composer: Composer,
  base: NumberSystem,
): Migrated {
  const wanted = new Set(composer.requiredSlots().map((s) => s.slot));
  const lexemes = { ...base.lexemes };
  const overrides = { ...base.overrides };
  const curated: Record<string, string[]> = { ...(base.curatedAudio || {}) };
  const migratedFrom: Record<string, string> = { ...(base.migratedFrom || {}) };
  const fromCards: string[] = [];
  let filled = 0;
  let written = 0;

  /* First card claiming a value keeps it, which is the rule the old model
     read parts by: a duplicate written by accident must not silently
     change what every number in the language sounds like. */
  const seen = new Set<number>();
  for (const card of cards) {
    const value = Number(card.value);
    if (!Number.isInteger(value) || value < 0 || seen.has(value)) continue;
    seen.add(value);
    const old = oldCardOf(card);
    if (!old.word) continue;

    const slot = slotForValue(value);
    if (slot && wanted.has(slot)) {
      const forms = composer.liftCard(old) as Partial<Record<FormKey, string>>;
      if (!Object.keys(forms).length) continue;
      lexemes[slot] = { slot, forms };
      migratedFrom[slot] = card.id;
      fromCards.push(card.id);
      filled += 1;
      continue;
    }

    /* Everything else is a number somebody wrote out, which is what a
       correction is. It keeps its recording too — a teacher who recorded
       three hundred recorded the word this system will say. */
    const key = String(value);
    if (overrides[key]) continue;
    overrides[key] = { text: old.word };
    migratedFrom[`override:${key}`] = card.id;
    fromCards.push(card.id);
    written += 1;
  }

  return {
    system: {
      ...base,
      lexemes,
      overrides,
      ...(Object.keys(curated).length ? { curatedAudio: curated } : null),
      migratedFrom,
      composerVersion: composer.version,
    },
    filled,
    written,
    fromCards,
  };
}
