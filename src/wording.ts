/*
 * Feedback lines that name a form, written as whole sentences.
 *
 * Two lines on the answer screen say something about grammar — which of a
 * card's accepted answers the learner wrote, and which form of a word
 * stands in a sentence's blank. Both used to be put together where they
 * were shown, a word at a time. Here each is one sentence with its gaps
 * marked, so the wording can be read, changed or one day translated whole:
 * a language that puts the form before the word, or needs the word inflected
 * around it, changes the sentence and not the code that fills it.
 *
 * The gaps are filled by name; nothing else is done to them. Imports
 * nothing.
 */

const SAYS = {
  /** Under a typed answer the card accepts more than one of. */
  wroteForm: "You wrote the {form} one.",
  /** Beside a sentence, for a word in one of its blanks. */
  blankForm: "{word}: {form}",
} as const;

export type Said = keyof typeof SAYS;

/** One of the lines above, its gaps filled. A gap with nothing to fill it
    is left out along with whatever joins it to the rest. */
export function say(which: Said, parts: Record<string, string>): string {
  const line = SAYS[which];
  if (which === "blankForm" && !String(parts.word || "").trim()) return String(parts.form || "");
  return line.replace(/\{(\w+)\}/g, (_, name: string) => String(parts[name] ?? ""));
}
