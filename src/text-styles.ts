/*
 * The text styles the app is written in.
 *
 * Every size a person actually reads, named by the class that sets it and
 * listed with the size the stylesheet gives it. It exists for the same
 * reason the elements list does: so a change can be asked for by name —
 * "at-hint is too small" — rather than by describing which grey paragraph
 * is meant.
 *
 * `size` is the font-size exactly as `src/index.css` writes it, and
 * `tests/text-styles.test.mjs` reads the stylesheet and fails if the two
 * have come apart in either direction: a style listed here that the
 * stylesheet no longer sets, or one whose size has moved since it was
 * written down. What the gallery shows beside it is the size the browser
 * actually resolved, measured off the specimen — so a token, a calc and a
 * script's own scale all come out as the number of pixels on the glass.
 *
 * Plain data in a plain module, so the test can read it without a build
 * step and the gallery can render it.
 */

/* The named sizes, as the tokens at the top of the stylesheet declare
   them. Much of the app writes its size out in pixels instead; these are
   the ones that have a name to ask for. */
export const TYPE_SCALE: [string, string][] = [
  ["--fs-xs", "11px"],
  ["--fs-sm", "13px"],
  ["--fs-md", "15px"],
  ["--fs-lg", "19px"],
  ["--fs-xl", "24px"],
  ["--fs-stat", "36px"],
];

export interface TextStyle {
  /** The selector, exactly as the stylesheet writes it. */
  name: string;
  /** Its font-size, exactly as the stylesheet writes it. */
  size: string;
  /** What it is and where it turns up. */
  what: string;
  /** Something it might actually hold. */
  example: string;
  /** The classes the specimen itself carries. */
  cls: string;
  /** Classes on a wrapper, where the rule is written as a descendant. */
  wrap?: string;
  /** The element to draw the specimen as. A paragraph unless it says. */
  tag?: "p" | "span" | "div" | "h2" | "b";
  /** Set where the style is laid out with the taught language's own
      face, direction and scale, as the practice screens lay it out. */
  script?: boolean;
}

export const TEXT_STYLES: [string, TextStyle[]][] = [
  ["Headings and labels", [
    {
      name: ".at-screenhead h2",
      size: "19px",
      what: "The title of a screen, in the bar across its top.",
      example: "Edit card",
      cls: "",
      wrap: "at-screenhead",
      tag: "h2",
    },
    {
      name: ".at-modaltitle",
      size: "19px",
      what: "The question a confirm modal asks, above whatever it is about to do.",
      example: "Delete Beginner Arabic?",
      cls: "at-modaltitle",
    },
    {
      name: ".at-eyebrow",
      size: "13px",
      what: "The small capitals naming a section. A Section's title is one, and so is every heading on this tab.",
      example: "Danger zone",
      cls: "at-eyebrow",
    },
    {
      name: ".at-label",
      size: "12px",
      what: "The label over a field, one step quieter than an eyebrow.",
      example: "Title",
      cls: "at-label",
    },
    {
      name: ".at-section .at-sectioncount",
      size: "var(--fs-xs)",
      what: "How many things are in a section, beside its title.",
      example: "12 cards",
      cls: "at-sectioncount",
      wrap: "at-section",
      tag: "span",
    },
    {
      name: ".at-answerlabel",
      size: "13px",
      what: "The line naming what is under it on an answer — the right answer itself.",
      example: "The answer is",
      cls: "at-answerlabel",
    },
    {
      name: ".at-alsolabel",
      size: "11px",
      what: "The same, one size down, over each block inside Learn more.",
      example: "This is how it's pronounced",
      cls: "at-alsolabel",
    },
  ]],

  ["Body text", [
    {
      name: ".at-lede",
      size: "var(--fs-md)",
      what: "The paragraph under a title, setting up what the screen is for. Lede.",
      example: "Learn a language a card at a time.",
      cls: "at-lede",
    },
    {
      name: ".at-hint",
      size: "14px",
      what: "Helper text under a control, and the workhorse of the app — more words are set in this than in anything else.",
      example: "Students join with a code, and the material appears on their devices.",
      cls: "at-hint",
    },
    {
      name: ".at-note",
      size: "14px",
      what: "The teacher's own note on a card, shown under an answer.",
      example: "Said only to someone you know well.",
      cls: "at-note",
    },
    {
      name: ".at-notice",
      size: "var(--fs-sm)",
      what: "Every failure, warning, confirmation and working line. Notice.",
      example: "That code doesn't match any course.",
      cls: "at-notice",
    },
    {
      name: ".at-modalbody",
      size: "14.5px",
      what: "What a confirm modal says about the thing it is about to do.",
      example: "The course, its join codes and its roster go. There is no undoing it.",
      cls: "at-modalbody",
    },
    {
      name: ".at-meta",
      size: "var(--fs-xs)",
      what: "Small print beside content rather than under a control. Meta.",
      example: "Added 3 March",
      cls: "at-meta",
      tag: "span",
    },
  ]],

  ["Numbers and small print", [
    {
      name: ".at-stat2 .at-statvalue",
      size: "var(--fs-stat)",
      what: "The one big number a Stat is for. The only place the app sets the serif face.",
      example: "148",
      cls: "at-statvalue",
      wrap: "at-stat2",
    },
    {
      name: ".at-stat2.big .at-statvalue",
      size: "40px",
      what: "The same number where a screen has room for it to be the headline.",
      example: "148",
      cls: "at-statvalue",
      wrap: "at-stat2 big",
    },
    {
      name: ".at-stat2 .at-statlabel",
      size: "var(--fs-xs)",
      what: "What that number counts, under it.",
      example: "Cards",
      cls: "at-statlabel",
      wrap: "at-stat2",
    },
    {
      name: ".at-status",
      size: "10px",
      what: "Whether a card is saved, saving or unsaved, in the editor.",
      example: "Saved",
      cls: "at-status",
      tag: "span",
    },
    {
      name: ".at-toast",
      size: "10px",
      what: "The line under a control saying why what you just asked for did not happen.",
      example: "That file isn't readable as JSON.",
      cls: "at-toast",
    },
    {
      name: ".at-handle",
      size: "14px",
      what: "A person's handle, set in the one true monospace so two similar ones can be told apart.",
      example: "layla-h",
      cls: "at-handle",
      tag: "span",
    },
    {
      name: ".at-clipmeta",
      size: "9px",
      what: "How long a recording is, beside its play button. The smallest type in the app.",
      example: "0:04",
      cls: "at-clipmeta",
      tag: "span",
    },
  ]],

  ["Controls", [
    {
      name: ".at-btn",
      size: "16px",
      what: "Every button. Uppercase, so its words are read as a thing to press rather than as a sentence.",
      example: "Start session",
      cls: "at-btn",
      tag: "span",
    },
    {
      name: ".at-btn.sm",
      size: "13px",
      what: "The small one, for a button inside a row of content rather than under it.",
      example: "Edit",
      cls: "at-btn sm",
      tag: "span",
    },
    {
      name: ".at-input",
      size: "18px",
      what: "Anything typed into the app in the interface's own language — a title, a handle, a meaning.",
      example: "Beginner Arabic",
      cls: "at-input",
      tag: "div",
    },
    {
      name: ".at-tab2",
      size: "13px",
      what: "One tab in the strip at the top of a space.",
      example: "Courses",
      cls: "at-tab2",
      tag: "span",
    },
    {
      name: ".at-tag",
      size: "13px",
      what: "A tag on a card, and the chips a filter is picked from.",
      example: "Lesson 1",
      cls: "at-tag",
      tag: "span",
    },
    {
      name: ".at-flag",
      size: "10px",
      what: "The small pill on a card saying something about it — that it has audio, that it is locked, that it has more forms.",
      example: "audio",
      cls: "at-flag",
      tag: "span",
    },
  ]],

  ["A question and an answer", [
    {
      name: ".at-count",
      size: "13px",
      what: "How far through the session you are, over the bar at the top.",
      example: "3 / 20",
      cls: "at-count",
      tag: "span",
    },
    {
      name: ".at-instruction",
      size: "19px",
      what: "The line telling you what to do. The same shape in every exercise.",
      example: "Write in English",
      cls: "at-instruction",
    },
    {
      name: ".at-arabic.word",
      size: "calc(54px * var(--sscale, 1))",
      what: "One word of the language being taught, asked on its own. The largest type in the app, and the size every other script size is tuned against.",
      example: "كِتَاب",
      cls: "at-arabic word",
      script: true,
    },
    {
      name: ".at-arabic.phrase",
      size: "calc(40px * var(--sscale, 1))",
      what: "A few words of it — a phrase, or a gap-fill.",
      example: "الكِتَاب كَبِير",
      cls: "at-arabic phrase",
      script: true,
    },
    {
      name: ".at-arabic.sentence",
      size: "calc(30px * var(--sscale, 1))",
      what: "A whole sentence of it, which has to fit a phone's width before it has to be large.",
      example: "اسْمِي لَيْلَى وَأَنَا مِن فِلَسْطِين",
      cls: "at-arabic sentence",
      script: true,
    },
    {
      name: ".at-en",
      size: "calc(25px * var(--lscale, 1))",
      what: "What it means, where the meaning is what is being asked about.",
      example: "book",
      cls: "at-en",
      script: true,
    },
    {
      name: ".at-latin",
      size: "calc(19px * var(--lscale, 1))",
      what: "How it is said, written in the roman alphabet.",
      example: "kitaab",
      cls: "at-latin",
      script: true,
    },
    {
      name: ".at-shout",
      size: "min(var(--verdict), calc((100vw - 36px) / 18))",
      what: "The verdict on an answer. Sized off the width of the screen so the longest one stays on a single line, and capped at the size named here.",
      example: "Incorrect. The correct answer is:",
      cls: "at-shout",
      script: true,
    },
    {
      name: ".at-shout.alone",
      size: "min(var(--verdict-alone), calc((100vw - 36px) / 7))",
      what: "The same line where the praise is the whole of what came back — nothing is shown under it, so it is sized as the thing being read.",
      example: "Nicely done!",
      cls: "at-shout alone",
      script: true,
    },
    {
      name: ".at-answermain .at-arabic",
      size: "calc(40px * var(--sscale, 1))",
      what: "The right answer, under the verdict. Smaller than the question it answers: it is being read, not being asked.",
      example: "كِتَاب",
      cls: "at-arabic",
      wrap: "at-answermain",
      script: true,
    },
    {
      name: ".at-answermain .at-en",
      size: "calc(26px * var(--lscale, 1))",
      what: "The right answer where the answer wanted was its meaning.",
      example: "book",
      cls: "at-en",
      wrap: "at-answermain",
      script: true,
    },
    {
      name: ".at-answermain .at-latin",
      size: "calc(24px * var(--lscale, 1))",
      what: "The right answer where the answer wanted was how it is said.",
      example: "kitaab",
      cls: "at-latin",
      wrap: "at-answermain",
      script: true,
    },
    {
      name: ".at-answeralso .at-arabic",
      size: "calc(26px * var(--sscale, 1))",
      what: "The script inside Learn more, which is a thing to notice rather than the answer.",
      example: "كِتَاب",
      cls: "at-arabic",
      wrap: "at-answeralso",
      script: true,
    },
    {
      name: ".at-answeralso .at-en",
      size: "calc(16px * var(--lscale, 1))",
      what: "A meaning in there — what a phrase the word turned up in says.",
      example: "the book is big",
      cls: "at-en",
      wrap: "at-answeralso",
      script: true,
    },
    {
      name: ".at-answeralso .at-latin",
      size: "calc(15px * var(--lscale, 1))",
      what: "And how a phrase in there reads out, which is the smallest the romanisation gets.",
      example: "al-kitaab kabiir",
      cls: "at-latin",
      wrap: "at-answeralso",
      script: true,
    },
  ]],

  ["Cards and lists", [
    {
      name: ".at-readword",
      size: "34px",
      what: "A card's own word, at the top of its screen under Cards.",
      example: "كِتَاب",
      cls: "at-readword",
      script: true,
    },
    {
      name: ".at-readmeaning",
      size: "19px",
      what: "What that word means, under it.",
      example: "book",
      cls: "at-readmeaning",
    },
    {
      name: ".at-readlat",
      size: "14px",
      what: "And how that word is said, under the meaning.",
      example: "kitaab",
      cls: "at-readlat",
    },
    {
      name: ".at-mininame",
      size: "calc(15px * var(--tile, 1))",
      what: "The name on a card tile in the list. Scaled with the tile, which the reader sizes.",
      example: "to eat",
      cls: "at-mininame",
      tag: "span",
    },
    {
      name: ".at-minicard .ar",
      size: "calc(18px * var(--sscale, 1) * var(--tile, 1))",
      what: "The word itself on that tile, in the script.",
      example: "كِتَاب",
      cls: "ar",
      wrap: "at-minicard",
      script: true,
    },
    {
      name: ".at-minicard .en",
      size: "calc(12px * var(--tile, 1))",
      what: "And what the word on that tile means, under the script.",
      example: "book",
      cls: "en",
      wrap: "at-minicard",
    },
    {
      name: ".at-decktitle",
      size: "17px",
      what: "A deck's name in the teacher's list.",
      example: "Lesson 1 — greetings",
      cls: "at-decktitle",
    },
    {
      name: ".at-deckmeta",
      size: "12px",
      what: "What is in it, under the name.",
      example: "18 cards · 4 with audio",
      cls: "at-deckmeta",
    },
    {
      name: ".at-personname",
      size: "14px",
      what: "Somebody's name in the roster of a course, beside their handle.",
      example: "Layla Haddad",
      cls: "at-personname",
      tag: "span",
    },
  ]],
];
