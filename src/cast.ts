/*
 * The cast of a scene: who is who, across every line of it.
 *
 * A scene's lines may have blanks in them, and a line picked from a
 * sentence card brings that sentence's blanks along. Filled one line at a
 * time, "{{name}} lives in {{place}}" and "{{name}} likes it there" were
 * two different people in two different towns — every line its own draw,
 * so a conversation could greet Layla and answer Karim in the next breath.
 *
 * So a scene fills its blanks once, for the whole scene, through a cast.
 * Every blank of every line **plays a member of the cast**, and each member
 * draws one word, which every blank playing it is filled with. The name of
 * the blank is not what decides it: blank names belong to the sentence
 * cards, which are written to be reused, and a sentence saying "{{person}}
 * visits {{person}}" cannot know which character of this story each one
 * is. The scene decides, in `roles` on the line — a map from the blank's
 * name to the member it plays.
 *
 * **What a blank plays by default is the member named after it.** The
 * first `{{name}}` in a scene makes a member called `name`, and every later
 * `{{name}}` plays that member too, which is what most scenes want and so
 * costs nothing to say. A second character of the same kind is a member of
 * its own — `name~2` — and a blank is cast to it by writing that in its
 * line's `roles`. `~` because it can never be part of a blank's name, so a
 * member made this way cannot collide with a blank somebody wrote.
 *
 * **A member draws a card, and each line takes the form of it that its own
 * blank asks for.** One sentence may want *the house* and the next *my
 * house*; a verb may stand in the past in one line and in the present in
 * another. So what is shared is the card, and each line picks the form of
 * it that its own blank admits — the rule a single sentence already fills
 * by, applied across sentences. Which means a member can only draw a card
 * with a form every blank it plays will take.
 *
 * **Two members never draw the same card.** Two characters are two people.
 *
 * **Every line is still a sentence its teacher approved.** A member draws
 * from what the blank would have drawn from on its own, never wider, and
 * each filled line is checked against the review that line answers to —
 * its sentence card's, where it was picked, or the scene's own. So what a
 * student reads is sentences a teacher has already read, put together.
 *
 * A plain module for the reason review.ts is: the teacher's screens and the
 * student's device must fill a scene the same way, and nothing here knows
 * which of them is asking. They hand in the pools, the owners and the
 * review each line answers to; this decides.
 */
import type { Lang } from "./types.ts";
import { linesOf } from "./dialogs.ts";
import type { Review } from "./review.ts";
import { SCAN_LIMIT, finishTook, passes, sentenceKey } from "./review.ts";
import type { Value } from "./variables.ts";
import { fillForm, refOf, slotName, slotsOf } from "./variables.ts";

type Held = Record<string, any>;
type Owner = { card: Held; form: Held };

/** What separates a member's number from the blank it was first named for. */
export const MEMBER_SEP = "~";

/** The most members one scene may have — a guard, not a limit anybody meets. */
export const MAX_MEMBERS = 24;

/* The shape a member's name may take: a blank's name, or one with a
   number on the end. Anything else reads as the blank's own member. */
export function memberName(raw: unknown): string {
  const [base, n] = String(raw || "").toLowerCase().split(MEMBER_SEP);
  const name = slotName(base);
  if (!name) return "";
  const num = Math.round(Number(n));
  return n !== undefined && Number.isFinite(num) && num > 1 && num < 100 ? `${name}${MEMBER_SEP}${num}` : name;
}

/** The blank a member was first named for. */
export const memberBase = (member: string): string => String(member || "").split(MEMBER_SEP)[0];

/** Which of the members of that name it is: 1 for the first. */
export const memberNumber = (member: string): number => {
  const n = Number(String(member || "").split(MEMBER_SEP)[1]);
  return Number.isFinite(n) && n > 1 ? n : 1;
};

/** Which member a blank of a line plays. */
export function roleIn(line: Held | null | undefined, slot: string): string {
  const said = line && line.roles && typeof line.roles === "object" ? line.roles[slot] : "";
  return memberName(said) || slot;
}

/** A line with one blank cast. Casting a blank as its own member takes the
    entry off, so a line cast the default way carries nothing. */
export function recast<T extends Held>(line: T, slot: string, member: string): T {
  const roles: Record<string, string> = { ...((line && line.roles) || {}) };
  const name = memberName(member);
  if (!name || name === slot) delete roles[slot];
  else roles[slot] = name;
  const out: Held = { ...line };
  if (Object.keys(roles).length) out.roles = roles;
  else delete out.roles;
  return out as T;
}

/**
 * The roles a line carries, as a server or an editor should keep them:
 * only for blanks the line actually has, only where they are not the
 * default, and nothing at all where every blank plays itself.
 */
export function cleanRoles(line: Held | null | undefined): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  const holes = slotsOf(line || {});
  for (const slot of holes) {
    const member = roleIn(line, slot);
    if (member !== slot) out[slot] = member;
  }
  return Object.keys(out).length ? out : undefined;
}

/** One blank of one line: where a member is played. */
export interface Part {
  /** The line's place in the scene. */
  line: number;
  slot: string;
}

/** A member of the cast, and every blank that plays it, in the order the
    scene meets them. */
export interface Member {
  member: string;
  parts: Part[];
}

/** The cast, in the order the scene first meets each member. */
export function castOf(card: Held | null | undefined): Member[] {
  const out: Member[] = [];
  const at = new Map<string, Member>();
  linesOf(card).forEach((line, i) => {
    for (const slot of slotsOf(line)) {
      const member = roleIn(line, slot);
      let m = at.get(member);
      if (!m) {
        if (out.length >= MAX_MEMBERS) continue;
        m = { member, parts: [] };
        at.set(member, m);
        out.push(m);
      }
      m.parts.push({ line: i, slot });
    }
  });
  return out;
}

/** Whether a scene has anything to cast. */
export const hasCast = (card: Held | null | undefined): boolean => linesOf(card).some((l) => slotsOf(l).length > 0);

/**
 * A new member of the same kind as this blank: the blank's name with the
 * lowest number no member of the scene has yet.
 */
export function newMember(card: Held | null | undefined, slot: string): string {
  const taken = new Set(castOf(card).map((m) => m.member));
  for (let n = 2; n < 100; n++) {
    const name = `${slot}${MEMBER_SEP}${n}`;
    if (!taken.has(name)) return name;
  }
  return slot;
}

/**
 * What to call a member where a teacher reads it: the blank it was named
 * for, numbered only where the scene has more than one of that name.
 */
export function memberLabel(member: string, all: string[] = []): string {
  const base = memberBase(member);
  const same = all.filter((m) => memberBase(m) === base);
  return same.length > 1 || memberNumber(member) > 1 ? `${base} ${memberNumber(member)}` : base;
}

/* ------------------------------------------------------------------
   Who can play whom
   ------------------------------------------------------------------ */

/** One card a member could draw, with the forms of it each blank would take. */
export interface Candidate {
  /** The card, by its id — or the word itself, for a value that has none. */
  key: string;
  /** For each part of the member, the forms of this card that blank admits. */
  forms: Value[][];
}

export interface CastInput {
  card: Held;
  /** What each blank of a line could be filled with, on its own. */
  poolOf: (line: Held) => Record<string, Value[]>;
  /** Which card, and which form of it, a value came from. */
  ownerOf: (value: Value) => Owner | null;
  langFor: (card: Held) => Lang | null | undefined;
  /** The review a line answers to, or null where it is asked as it always was. */
  gateOf?: (line: Held) => Review | null | undefined;
  /** How many times the question has come round: the same count is the
      same scene. */
  turn?: number;
  limit?: number;
}

const keyOf = (value: Value, ownerOf: (v: Value) => Owner | null): string => {
  const owner = ownerOf(value);
  return String((owner && owner.card && owner.card.id) || refOf(value));
};

/**
 * The cards each member could draw: those with a form every blank it plays
 * admits, in the order the first of those blanks lists them.
 */
export function candidatesOf(input: Pick<CastInput, "card" | "poolOf" | "ownerOf">): Map<string, Candidate[]> {
  const { card, poolOf, ownerOf } = input;
  const lines = linesOf(card);
  const pools = new Map<number, Record<string, Value[]>>();
  const poolAt = (i: number) => {
    if (!pools.has(i)) pools.set(i, poolOf(lines[i]) || {});
    return pools.get(i) as Record<string, Value[]>;
  };
  const out = new Map<string, Candidate[]>();
  for (const { member, parts } of castOf(card)) {
    /* For each part, the forms of each card that blank admits. */
    const byPart = parts.map((p) => {
      const m = new Map<string, Value[]>();
      for (const v of poolAt(p.line)[p.slot] || []) {
        const key = keyOf(v, ownerOf);
        if (!key) continue;
        const had = m.get(key);
        if (had) had.push(v);
        else m.set(key, [v]);
      }
      return m;
    });
    const first = byPart[0] || new Map<string, Value[]>();
    const list: Candidate[] = [];
    for (const key of first.keys()) {
      if (!byPart.every((m) => m.has(key))) continue;
      list.push({ key, forms: byPart.map((m) => m.get(key) as Value[]) });
    }
    out.set(member, list);
  }
  return out;
}

/**
 * The words, blank by blank, that every line of a scene is filled with this
 * time round — keyed by the line's id — or null where there is no scene to
 * be had: a member with nothing to draw, a combination whose agreement
 * finds an empty cell, or none that every line's review allows.
 *
 * An odometer over the members, as a single sentence has one over its
 * blanks, so every casting is reached before any repeats; walked forward
 * from the turn to the first that makes a scene. Which form of a drawn card
 * a blank takes, where it admits several, turns with the question.
 *
 * An empty map for a scene with no blanks at all, which is nothing to fill
 * rather than nothing possible.
 */
export function castFill(input: CastInput): Record<string, Record<string, Value>> | null {
  const { card, ownerOf, langFor, gateOf } = input;
  const lines = linesOf(card);
  const cast = castOf(card);
  if (!cast.length) return {};
  const cands = candidatesOf(input);
  const lists = cast.map((m) => cands.get(m.member) || []);
  if (lists.some((l) => !l.length)) return null;
  const turn = Math.abs(Math.round(Number(input.turn) || 0));
  const combos = lists.reduce((n, l) => Math.min(n * l.length, Number.MAX_SAFE_INTEGER), 1);
  const walk = Math.min(combos, input.limit || SCAN_LIMIT);
  const holed = lines.map((l, i) => ({ line: l, i })).filter(({ line }) => slotsOf(line).length > 0);
  for (let step = 0; step < walk; step++) {
    let rolled = turn + step;
    const chosen = lists.map((list) => {
      const pick = list[rolled % list.length];
      rolled = Math.floor(rolled / list.length);
      return pick;
    });
    /* Two members are two people. */
    if (new Set(chosen.map((c) => c.key)).size !== chosen.length) continue;
    const turned = new Map<number, Record<string, Value>>();
    cast.forEach((m, k) => {
      m.parts.forEach((p, j) => {
        const forms = chosen[k].forms[j];
        const value = forms[turn % forms.length];
        const at = turned.get(p.line) || {};
        at[p.slot] = value;
        turned.set(p.line, at);
      });
    });
    const out: Record<string, Record<string, Value>> = {};
    let ok = true;
    for (const { line, i } of holed) {
      const drawn = slotsOf(line);
      const took = finishTook(line, null, turned.get(i) || {}, drawn, ownerOf, langFor);
      if (!took) {
        ok = false;
        break;
      }
      const gate = gateOf ? gateOf(line) : null;
      if (gate && !passes(gate, sentenceKey(fillForm(line, took)))) {
        ok = false;
        break;
      }
      out[String(line.id || i)] = took;
    }
    if (ok) return out;
  }
  return null;
}

/**
 * The scene with its lines filled from a casting — each line as the
 * student reads it, carrying `filled` and its fingerprint the way a filled
 * sentence does, so a report on it names the sentence.
 */
export function filledScene<T extends Held>(card: T, took: Record<string, Record<string, Value>>): T {
  const lines = linesOf(card);
  if (!lines.length) return card;
  return {
    ...card,
    lines: lines.map((line, i) => {
      const values = took[String(line.id || i)];
      if (!values) return line;
      const filled = fillForm(line as Held, values);
      return { ...filled, reviewKey: sentenceKey(filled) };
    }),
  };
}

/* ------------------------------------------------------------------
   What a teacher is told
   ------------------------------------------------------------------ */

/** One member as the editor reads it out. */
export interface MemberReport {
  member: string;
  label: string;
  parts: Part[];
  /** How many cards it could draw. */
  words: number;
}

/**
 * The cast, with how many words each member could draw — and, for every
 * name the scene has more than one member of, whether there are enough
 * different words behind them for each to have their own.
 */
export function castReport(input: Pick<CastInput, "card" | "poolOf" | "ownerOf">): {
  members: MemberReport[];
  short: string[];
} {
  const cast = castOf(input.card);
  const cands = candidatesOf(input);
  const all = cast.map((m) => m.member);
  const members = cast.map((m) => ({
    member: m.member,
    label: memberLabel(m.member, all),
    parts: m.parts,
    words: (cands.get(m.member) || []).length,
  }));
  const short: string[] = [];
  const bases = [...new Set(all.map(memberBase))];
  for (const base of bases) {
    const same = cast.filter((m) => memberBase(m.member) === base);
    if (same.length < 2) continue;
    const union = new Set(same.flatMap((m) => (cands.get(m.member) || []).map((c) => c.key)));
    if (union.size < same.length) short.push(base);
  }
  return { members, short };
}
