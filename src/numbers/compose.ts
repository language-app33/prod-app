/*
 * What two composers turned out to share.
 *
 * Written last on purpose. The plan for this feature said the Semitic pair
 * would be written twice and pulled together only once both had shipped
 * against a table of their own, because a shared helper invented before
 * the second language exists is a guess about that language dressed up as
 * a rule — and the guess is invisible afterwards, since the second pack
 * is written to fit the helper rather than the other way round.
 *
 * So what is here is only what both of them were already doing, character
 * for character, with the golden tables unchanged across the move:
 *
 *   * **Chunking.** Every language in the app says a number in millions,
 *     thousands and the rest. The order of those three and what joins them
 *     is each language's own and stays there.
 *   * **Which face a gender asks for**, which is a lookup and not a rule.
 *   * **The counted noun**, including what to do when the teacher has not
 *     written the face the numeral asked for.
 *   * **The whole of a clock.** This is the large one, and it is shared
 *     because a clock has almost nothing in it that is a language: the
 *     hour is the number composer asked for a feminine referent, the exact
 *     minutes are the number composer counting a noun, and what is left —
 *     rounding to a mark, which hour a mark counts from, which part of the
 *     day the clock shows — is arithmetic. A pack hands in its own number
 *     renderer and its own words, and gets its clock back.
 *
 * What is *not* here: the order of the pieces, the connector's habits,
 * polarity, the bound form, which faces a slot even offers. Those are the
 * languages, and they are in the language files where a reader looking for
 * them will be standing.
 */
import type { Build } from "./build.ts";
import type {
  CountedNoun,
  FormKey,
  MinuteExpr,
  NounForm,
  NumberSystem,
  Rendering,
  TimeCtx,
  TimeRendering,
  TimeSystem,
  Token,
  Warning,
} from "./types.ts";

/* ---- numbers ---- */

/** The three places every language in the app says a number in. */
export const chunksOf = (n: number) => ({
  millions: Math.floor(n / 1000000),
  thousands: Math.floor((n % 1000000) / 1000),
  rest: n % 1000,
});

/**
 * Which face a gender asks for — a lookup, not a rule.
 *
 * Whether a number is in construct at all, and which numbers inflect, are
 * each language's own answer and are asked before this is called.
 */
export const genderKeyOf = (g: "m" | "f" | undefined, construct: boolean): FormKey =>
  construct ? (g === "f" ? "construct.f" : "construct.m") : g === "f" ? "f" : "m";

/**
 * The noun in the face the numeral asked for.
 *
 * Which face that is depends on the language and is worked out there. What
 * is shared is the answer to a box the teacher has not filled: fall back to
 * the singular and say so, rather than leaving a hole in the middle of a
 * phrase a learner is being asked to read.
 */
export function nounTextOf(b: Build, noun: CountedNoun, form: NounForm): string {
  const want = form === "dual" ? noun.dual : form === "pl" ? noun.pl : noun.sg;
  const text = String(want || "").trim();
  if (text) {
    b.tokens.push({ text, noun: noun.id });
    return text;
  }
  b.warn({ code: "missing-noun-form", detail: `${noun.id}.${form}` });
  const fallback = String(noun.sg || "").trim();
  if (fallback) b.tokens.push({ text: fallback, noun: noun.id });
  return fallback;
}

/* ---- the clock ---- */

/** The hour as a clock with twelve numbers on it says it. */
export const hour12Of = (h: number): number => ((h + 11) % 12) + 1;

/**
 * The nearest five-minute mark, and the hour it carries into.
 *
 * Two to midnight is not five to midnight rounded down to nothing: it is
 * midnight. So the rounding may carry, and the carry has to happen before
 * anything else reads the hour — the part of the day included, since a
 * minute before one in the afternoon is in the afternoon and a minute
 * before one in the morning is not.
 */
export function roundToMark(h: number, m: number): { hour: number; mark: number } {
  const raw = Math.round(m / 5) * 5;
  return raw >= 60 ? { hour: (h + 1) % 24, mark: 0 } : { hour: h, mark: raw };
}

/**
 * Which part of the day an hour falls in.
 *
 * Ranges may wrap midnight, because one of them always does: the night is
 * the hours after ten and the hours before five, which is two stretches of
 * the clock and one part of the day.
 */
export function periodFor(time: TimeSystem, h: number) {
  for (const p of time.periods || []) {
    const from = Number(p.fromHour);
    const to = Number(p.toHour);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (from <= to ? h >= from && h <= to : h >= from || h <= to) return p;
  }
  return null;
}

export const wordOf = (time: TimeSystem, slot: string): string =>
  String(((time.lexemes || {})[slot] || { forms: {} }).forms.standalone || "").trim();

export const clipsOf = (time: TimeSystem, slot: string): string[] =>
  (((time.lexemes || {})[slot] || { forms: {} }).audio || {}).standalone || [];

const overrideOf = (time: TimeSystem, h: number, m: number, style: string) => {
  const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const table = time.overrides || {};
  for (const k of [`${key}|${style}`, key]) {
    const text = String((table[k] && table[k].text) || "").trim();
    if (text) return { text, key: k, audio: (table[k] && table[k].audio) || (time.curatedAudio || {})[k] };
  }
  return null;
};

/** How a language builds numbers, handed in so the clock never knows. */
export type RenderNumber = (
  n: number,
  sys: NumberSystem,
  ctx?: { gender?: "m" | "f"; noun?: CountedNoun },
) => Rendering;

/** The two things a clock has to be told about the language it is in. */
export interface ClockRules {
  render: RenderNumber;
  /**
   * Whether a time may be the numeral alone.
   *
   * In one language the word that opens a time is said every time and an
   * empty box is a gap that withholds the skill; in another it is
   * optional in speech, and a teacher who leaves it empty means the
   * numeral on its own. Declared by the pack, because it is a fact about
   * how people talk and not about the clock. Required where nobody says.
   */
  hourWord?: "required" | "optional";
}

/**
 * A time, out of a system and a number composer.
 *
 * **There is no agreement here.** The hour is `render` asked for a
 * feminine referent, because the word for *hour* is feminine in both
 * languages that have one; the exact minutes are `render` asked to count
 * the word for *minute*. A fault in "two minutes" is a fault in the number
 * composer and is fixed once, for books and minutes together.
 *
 * Total, like the number composers: a system with nothing in it comes back
 * as a rendering full of warnings, never as an exception.
 */
export function renderClock(
  h: number,
  m: number,
  time: TimeSystem,
  numbers: NumberSystem | null,
  ctx: TimeCtx,
  rules: ClockRules,
): TimeRendering {
  const render = rules.render;
  const warnings: Warning[] = [];
  const tokens: Token[] = [];
  const style = ctx.style === "exact" ? "exact" : "colloquial";
  const blank = (text: string): TimeRendering => ({
    text,
    tokens,
    warnings,
    hour12: hour12Of(Number(h) || 0),
  });

  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    warnings.push({ code: "out-of-range", detail: `${h}:${m}` });
    return blank("");
  }
  if (!numbers) {
    warnings.push({ code: "no-number-system" });
    return blank("");
  }

  const shown = overrideOf(time, h, m, style);

  /* Which minute mark is said, and which hour it counts from. The
     colloquial style rounds — and says so, so a teacher's preview and a
     learner's clock face never disagree about what was asked. */
  let mark: number | undefined;
  let expr: MinuteExpr | undefined;
  /* The hour the clock shows, after any carry the rounding made. Every
     reading of the hour below is of this one, except the numeral's. */
  let onClock = h;
  let said = h;
  if (style === "colloquial") {
    const rounded = roundToMark(h, m);
    onClock = rounded.hour;
    mark = rounded.mark;
    said = onClock;
    if (mark !== m) warnings.push({ code: "rounded", detail: `${m} to ${mark}` });
    expr = (time.minuteExprs || {})[String(mark)];
    if (!expr && mark !== 0) warnings.push({ code: "no-minute-expression", detail: String(mark) });
    if (expr && expr.refHour === "next") said = (onClock + 1) % 24;
  }

  const hour12 = hour12Of(said);
  /* The part of the day comes off the hour the clock shows, never off the
     hour that is said. A quarter to one in the afternoon is in the
     afternoon; reading the period after the shift would file it under the
     morning, which is right eleven times out of twelve and then
     embarrasses somebody. */
  const period = ctx.period ? periodFor(time, onClock) : null;

  if (shown) {
    tokens.push({ text: shown.text, override: shown.key });
    const withPeriod = period ? `${shown.text} ${period.text}` : shown.text;
    if (period) tokens.push({ text: period.text, slot: `period.${period.slot}` });
    return {
      text: withPeriod,
      tokens,
      warnings,
      hour12,
      minuteMark: mark,
      period: period ? period.text : undefined,
      clips: shown.audio && shown.audio.length ? [shown.audio] : undefined,
    };
  }

  const hourWord = wordOf(time, "hour.word");
  if (!hourWord) {
    /* A language whose speakers say the numeral alone has nothing missing
       here; one whose speakers always say the word has. Either way the
       time is rendered — the question is only whether a learner may be
       asked it yet. */
    if (rules.hourWord !== "optional") warnings.push({ code: "missing-slot", slot: "hour.word" });
  } else tokens.push({ text: hourWord, slot: "hour.word", formKey: "standalone" });

  /* The hour numeral: the number composer, asked for a feminine referent.
     Nothing about that rule lives here. */
  const hourNum: Rendering = render(hour12, numbers, { gender: "f" });
  warnings.push(...hourNum.warnings);
  tokens.push(...hourNum.tokens);

  const clips: string[][] = [];
  const hourClips = clipsOf(time, "hour.word");
  if (hourClips.length) clips.push(hourClips);

  /*
   * What is said besides the hour, and which side of it.
   *
   * Three shapes, and every language that tells the time in this app uses
   * one of them for each of its expressions:
   *
   *   * **Counting on, hour first.** The hour, then the joining word
   *     attached to the minutes: *three and-a-quarter*.
   *   * **Counting back, hour first.** The hour, then the joining word as
   *     a word of its own, then the minutes: *three less a quarter*.
   *   * **Counting back, minutes first.** The minutes, then the joining
   *     word attached to the hour: *a quarter to-three*. This is `lead`,
   *     and it is the expression's own answer, written beside it in the
   *     system — a fact about the words and not about the clock.
   *
   * A joining word attaches to whichever of the two it governs, which is
   * why `onHour` exists: in the third shape it is the hour it leans on,
   * and everywhere else it is the minutes.
   */
  let tail = "";
  let lead = false;
  let onHour = "";

  if (style === "exact") {
    if (m) {
      const past = wordOf(time, "connector.past");
      if (!past) warnings.push({ code: "missing-slot", slot: "connector.past" });
      else tokens.push({ text: past, slot: "connector.past", formKey: "standalone" });
      /* And the minutes, counted like anything else that gets counted. */
      const mins = render(m, numbers, { noun: time.minuteNoun });
      warnings.push(...mins.warnings);
      tokens.push(...mins.tokens);
      tail = past ? `${past}${mins.text}` : mins.text;
    }
  } else if (mark && expr) {
    const toNext = expr.refHour === "next";
    const slot = toNext ? "connector.to" : "connector.past";
    const attach = wordOf(time, slot);
    if (!attach) warnings.push({ code: "missing-slot", slot });
    else tokens.push({ text: attach, slot, formKey: "standalone" });
    tokens.push({ text: expr.text, slot: `minute.${mark}` });
    lead = !!expr.lead;
    if (lead) {
      tail = expr.text;
      onHour = attach;
    } else {
      tail = toNext
        ? [attach, expr.text].filter(Boolean).join(" ")
        : attach
        ? `${attach}${expr.text}`
        : expr.text;
    }
    if (expr.audio && expr.audio.length) clips.push(expr.audio);
  }

  const head = [hourWord, onHour ? `${onHour}${hourNum.text}` : hourNum.text]
    .filter(Boolean)
    .join(" ");
  const pieces = lead ? [tail, head] : [head, tail];
  if (period) {
    pieces.push(period.text);
    tokens.push({ text: period.text, slot: `period.${period.slot}` });
    if (period.audio && period.audio.length) clips.push(period.audio);
  }

  return {
    text: pieces.filter(Boolean).join(" "),
    tokens,
    warnings,
    hour12,
    minuteMark: mark,
    period: period ? period.text : undefined,
    /* Two recordings at most, played one after the other: the hour and the
       minutes. Nothing inside a number is ever stitched. */
    clips: clips.length ? clips : undefined,
  };
}
