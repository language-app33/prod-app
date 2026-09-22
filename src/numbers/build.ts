/*
 * What a rendering is built up in.
 *
 * Plumbing, not language: looking a word up in a system, remembering what
 * was used so a right answer can credit it, and collecting the gaps. The
 * rules about where a word goes and which face it wears are each
 * language's own and are in its own file.
 *
 * Worth being clear about what this is *not*, because the line moves
 * later: it is not the shared half of two composers. Dual, polarity,
 * construct state and chunking are language rules written twice on
 * purpose and pulled together only once two languages have both shipped
 * against a table of their own — see the plan. This is the bookkeeping
 * underneath all of them, and it was one class copied three times before
 * it was one class.
 */
import type { FormKey, Lexeme, NumberSystem, SlotSpec, TimeSystem, Token, Warning } from "./types.ts";

export type Fallbacks = Record<FormKey, FormKey[]>;

const textOf = (lex: Lexeme | undefined, key: FormKey): string =>
  String((lex && lex.forms && lex.forms[key]) || "").trim();

/**
 * Pieces and tokens are kept apart because they are different questions:
 * the pieces are what is said, and the tokens are what is credited.
 */
export class Build {
  sys: NumberSystem | TimeSystem;
  tokens: Token[] = [];
  warnings: Warning[] = [];
  private specs: Map<string, SlotSpec>;
  private fallback: Fallbacks;
  private seen = new Set<string>();

  constructor(sys: NumberSystem | TimeSystem, specs: SlotSpec[], fallback: Fallbacks) {
    this.sys = sys;
    this.specs = new Map(specs.map((s) => [s.slot, s]));
    this.fallback = fallback;
  }

  /** Said once however many times it happens: a teacher wants the box,
      not a tally of how often the number reached for it. */
  warn(w: Warning) {
    const key = `${w.code}:${w.slot || ""}:${w.formKey || ""}:${w.detail || ""}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(w);
  }

  /** The word for one slot in one face, or an empty string and a warning. */
  word(slot: string, want: FormKey): string {
    const spec = this.specs.get(slot);
    const lex = this.sys.lexemes ? this.sys.lexemes[slot] : undefined;
    /* A face the slot does not offer is not a gap — it is a question this
       slot has no answer to, and the counting form is the answer. */
    const asked: FormKey = spec && spec.formKeys.includes(want) ? want : "standalone";
    for (const key of this.fallback[asked] || [asked]) {
      const text = textOf(lex, key);
      if (!text) continue;
      if (key !== asked) this.warn({ code: "missing-form", slot, formKey: asked });
      this.tokens.push({ text, slot, formKey: key });
      return text;
    }
    this.warn({ code: "missing-slot", slot, formKey: asked });
    return "";
  }

  /** Whether a slot has anything in it at all, without crediting it. */
  has(slot: string): boolean {
    const lex = this.sys.lexemes ? this.sys.lexemes[slot] : undefined;
    return !!lex && Object.values(lex.forms || {}).some((t) => String(t || "").trim());
  }

  /** A number the teacher wrote out by hand, in this face if they gave one. */
  override(n: number, key: FormKey): string {
    const table = this.sys.overrides || {};
    for (const k of key === "standalone" ? [String(n)] : [`${n}|${key}`, String(n)]) {
      const text = String((table[k] && table[k].text) || "").trim();
      if (text) {
        this.tokens.push({ text, override: k });
        return text;
      }
    }
    return "";
  }

  /** The connector, recorded once however often it is used. */
  connector(slot = "connector"): string {
    const lex = this.sys.lexemes ? this.sys.lexemes[slot] : undefined;
    const conn = textOf(lex, "standalone");
    if (!conn) {
      this.warn({ code: "missing-slot", slot, formKey: "standalone" });
      return "";
    }
    if (!this.tokens.some((t) => t.slot === slot)) {
      this.tokens.push({ text: conn, slot, formKey: "standalone" });
    }
    return conn;
  }
}
