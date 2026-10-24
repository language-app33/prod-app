/*
 * A teacher's import: a file of cards and decks read against what the
 * teacher already has, before anything is written.
 *
 * The file is the backup's own format — what Export makes, and what the
 * administrator's Back up makes, of which only the cards, decks, recordings
 * and pictures are read. The owner's rules (DECISIONS.md, "A teacher's
 * import"):
 *
 *   * **The same card** is one whose id the teacher already has: exported
 *     from here and still here, however it has been edited since. Skipped
 *     unless the teacher ticks it, and then the file's version replaces it.
 *   * **The same word** is a different card with the same word in the same
 *     language — the word read the way the deck score reads it for "no word
 *     on two cards". Skipped unless ticked, and then imported as a card of
 *     its own, because one word can be two meanings.
 *   * Everything else is **new**, and imported.
 *   * **A deck** the teacher already has — the same id, or else the same
 *     name in the same language — is added to, and nothing in it is taken
 *     out. Any other deck is made, in no course.
 *   * Whatever is imported becomes the importing teacher's own.
 *
 * Pure: it reads a file and two lists and says what would happen. Writing
 * it is the screen's, through the same calls the card editor makes.
 */

import type { Card, Deck } from "./types.ts";
import { leadOf, wordOf } from "./cards.ts";

export type ImportFile = {
  cards: Card[];
  decks: Deck[];
  /** Recordings and pictures, by the hash they are stored under. */
  clips: Record<string, string>;
  images: Record<string, string>;
};

/** Reads a file into what an import uses, or says why it cannot. */
export function readImportFile(parsed: any): ImportFile | string {
  if (!parsed || typeof parsed !== "object" || parsed.format !== "language-app-backup") {
    return "That file isn't an export or a backup from this app.";
  }
  const records = parsed.records && typeof parsed.records === "object" ? parsed.records : {};
  const file: ImportFile = { cards: [], decks: [], clips: {}, images: {} };
  for (const [key, value] of Object.entries<any>(records)) {
    if (!value) continue;
    if (key.startsWith("card:") && typeof value === "object") file.cards.push(value);
    else if (key.startsWith("deck:") && typeof value === "object") file.decks.push(value);
    else if (key.startsWith("clip:") && typeof value === "string") file.clips[key.slice(5)] = value;
    else if (key.startsWith("image:") && typeof value === "string") file.images[key.slice(6)] = value;
  }
  if (!file.cards.length && !file.decks.length) return "There are no cards or decks in that file.";
  return file;
}

/**
 * The word a card is known by, for telling whether two cards are the same
 * word: its language and its word, or for a conversation or a text, which
 * has no word, its name.
 */
export function wordKey(card: Card): string {
  const w = wordOf(card);
  const said = String(w.ar || "").trim();
  if (said) return `${card.lang}|${said}`;
  const named = String(card.name || leadOf(card).en || "").trim().toLowerCase();
  return named ? `${card.lang}|en:${named}` : "";
}

export type CardMatch = {
  card: Card;
  kind: "new" | "same" | "sameWord";
  /** The card the teacher already has: the same one, or one with its word. */
  existing?: Card;
  /** The file's decks this card is in, by their id in the file. */
  inDecks: string[];
};

export type DeckMatch = { deck: Deck; existing?: Deck };

export function matchImport(file: ImportFile, have: Card[], haveDecks: Deck[]) {
  const byId = new Map(have.map((c) => [c.id, c]));
  const byWord = new Map<string, Card>();
  for (const c of have) {
    const k = wordKey(c);
    if (k && !byWord.has(k)) byWord.set(k, c);
  }
  const titled = (d: Deck) => `${d.lang}|${String(d.title || "").trim().toLowerCase()}`;
  const decks: DeckMatch[] = file.decks.map((deck) => ({
    deck,
    existing:
      haveDecks.find((d) => d.id === deck.id) ||
      haveDecks.find((d) => titled(d) === titled(deck)),
  }));
  const cards: CardMatch[] = file.cards.map((card) => {
    const inDecks = file.decks.filter((d) => (d.cardIds || []).includes(card.id)).map((d) => d.id);
    const same = byId.get(card.id);
    if (same) return { card, kind: "same", existing: same, inDecks };
    const k = wordKey(card);
    const twin = k ? byWord.get(k) : undefined;
    if (twin) return { card, kind: "sameWord", existing: twin, inDecks };
    return { card, kind: "new", inDecks };
  });
  return { cards, decks };
}

/**
 * The status every imported card is saved with: Ready for review, the
 * owner's rule, so nothing a file brings in reaches students before a
 * teacher has looked at it. A new card is made Ready for review; a card
 * replaced keeps what students have, if it is published, and the import
 * becomes its changes, Ready for review — see "A card's status" in
 * server/api/courses.js.
 */
export const IMPORTED_STATUS = "review";

/** What is ticked to start with: the new cards, and nothing the teacher has. */
export const tickedAtFirst = (m: CardMatch) => m.kind === "new";

/* A card as the save takes it: its words, without what the server keeps
   for itself. The id is the one to save over, or "" for a new card. */
const SERVER_FIELDS = ["owner", "rev", "created", "updated", "inDecks", "decks"];
export function toSave(card: Card, id: string): Partial<Card> {
  const out: any = { ...card, id, status: IMPORTED_STATUS };
  for (const k of SERVER_FIELDS) delete out[k];
  return out;
}

/**
 * The card with every mention of another card's id moved to where that
 * card now is: a phrase's links to its words, a conversation's lines, the
 * card a split came from. Ids are long and random, so a string equal to one
 * is that card and nothing else.
 */
export function remapIds<T>(value: T, moved: Map<string, string>): T {
  if (typeof value === "string") return (moved.get(value) ?? value) as any;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, moved)) as any;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapIds(v, moved)])) as any;
  }
  return value;
}

/** Whether anything on a card names one of these ids. */
export function mentions(value: unknown, ids: Set<string>): boolean {
  if (typeof value === "string") return ids.has(value);
  if (Array.isArray(value)) return value.some((v) => mentions(v, ids));
  if (value && typeof value === "object") return Object.values(value).some((v) => mentions(v, ids));
  return false;
}

/** The recordings and pictures the file holds for these cards. */
export function mediaOf(cards: Card[], file: ImportFile) {
  const clips = new Set<string>();
  const images = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (file.clips[v] !== undefined) clips.add(v);
      if (file.images[v] !== undefined) images.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  cards.forEach(walk);
  return { clips: [...clips], images: [...images] };
}
