/*
 * The elements of a question and an answer.
 *
 * Every named piece of the two practice screens, with what it is and what
 * it looks like filled in. It exists so a change can be asked for by name
 * — "make question-prompt-text bigger" — instead of by description, which
 * is how "the big word at the top" came to mean three different things in
 * three different rounds.
 *
 * The names are the data-el attributes the screens actually carry, and
 * tests/screen-elements.test.mjs fails if this list and the screens
 * disagree in either direction: a name here that no longer exists, or an
 * element added to a screen and never written down.
 *
 * Plain data in a plain module, so the test can read it without a build
 * step and the gallery can render it.
 */

export const BOTH = "On both screens";
export const QUESTION = "The question screen";
export const ANSWER = "The answer screen";
export const END = "The screen at the end";

/* [name, what it is, an example of what it holds] */
export const SCREEN_ELEMENTS: [string, [string, string, string][]][] = [
  [BOTH, [
    ["card", "The whole exercise block — everything between the progress bar and the buttons at the foot.", ""],
    ["leave-session", "The ✕ at the top left, which offers to end the session.", ""],
    ["session-count", "How far through you are, or the clock in a timed session.", "3 / 20 · 4:35"],
    ["session-progress", "The bar beside it, which fills as the session goes on.", ""],
  ]],
  [QUESTION, [
    ["question-instruction", "The line telling you what to do. The same shape in every exercise.", "Write in English"],
    ["question-form-tag", "Which form is being asked, when the card has more than one.", "· plural"],
    ["question-prompt", "The block being asked about. A word, a phrase with a gap in it, a play button, or a conversation, depending on the exercise.", ""],
    ["question-prompt-text", "The words inside it, when it is words. One size in every exercise.", "كِتاب"],
    ["scene", "The conversation, on a dialog question: as much of it as the question shows.", ""],
    ["scene-line", "One turn in it — who spoke, and what they said.", ""],
    ["scene-speaker", "Whose turn it is. One colour per speaker, for the whole scene.", "Layla"],
    ["scene-line-text", "The line itself, in the language being taught.", "السَّلامُ عَلَيْكُم"],
    ["scene-line-said", "How that line sounds. Only where the reader asked to see it.", "as-salaamu 3alaykum"],
    ["scene-line-meaning", "What that line means. On the read-through and the answer, and wherever the reader asked to see it — never while a line is being asked.", "Peace be upon you"],
    ["scene-turn", "The gap where your turn goes, on the question that asks for it.", ""],
    ["answer-order", "The scrambled lines, on the question that asks for the scene in order. Tap them into place.", ""],
    ["reveal-said", "On reading a scene through: the button that shows how the lines sound, and puts them away again.", "Show the transliteration"],
    ["reveal-meaning", "The same, for what the lines mean.", "Show the meaning"],
    ["answer-match", "The matching grid: the words on one side, the meanings on the other.", ""],
    ["match-word", "One word in it, waiting to be paired.", "كِتاب"],
    ["match-meaning", "One meaning in it. Two of them match no word at all.", "book"],
    ["match-form-tag", "On a tile, which form of its card it is. Only where two forms of one card are in the grid, and on both the word and the meaning.", "pl."],
    ["answer-self", "The two answers to \"could you follow all of it\". Nobody else was in the room, so the reader marks it.", ""],
    ["question-context-meaning", "On a gap-fill, which word is wanted — the word's own meaning, never the phrase's.", "book"],
    ["hint-button", "The question-mark button in the bar at the foot. Reveals the nudge, and puts it away again.", "Show meaning"],
    ["hint-value", "The nudge, once revealed.", ""],
    ["hint-value-text", "The nudge itself — whichever field the exercise reveals.", "kitaab"],
    ["quiet-button", "The way past a question you cannot hear. Only on listening questions.", "Can't listen right now"],
    ["answer-box", "The block you answer in. One height whichever language you are typing.", ""],
    ["answer-input", "The field inside it, declared as the language being typed.", ""],
    ["answer-choices", "The picker that replaces it when the answer is one of a few.", ""],
    ["dont-know-button", "Gives up on the question and shows the answer.", "I don't know"],
    ["check-button", "Marks what you typed.", "Check"],
  ]],
  [ANSWER, [
    ["verdict", "What happened. Rotating praise when right; one fixed line when not. Larger when the praise is all the screen has to show.", "Nicely done! · Incorrect. The correct answer is: · The answer is:"],
    ["verdict-reason", "Why it was marked that way, when there is something worth saying.", "Right letters, wrong harakat"],
    ["verdict-hinted", "Says so when a right answer was written with the nudge up, on the questions whose nudge is the answer said another way.", "Right — but the transliteration was on screen, so this one counts as a near miss and comes round again."],
    ["answer-value", "The right answer. Shown only when you got it wrong or asked to see it.", ""],
    ["answer-value-text", "The right answer itself, in whichever language was asked for.", "كِتاب"],
    ["also-toggle", "The invitation to open everything else worth knowing.", "Learn more ⌄"],
    ["also", "The box it opens: whichever of the five blocks below the card has.", ""],
    ["also-context", "Where the word turned up, with its label and the phrase.", ""],
    ["also-context-label", "The small line naming that block.", "Where it turned up"],
    ["also-context-text", "The phrase the word appeared in, as the teacher recorded it.", "الكتاب كبير"],
    ["also-context-meaning", "What the phrase means.", "the book is big"],
    ["also-script", "How it is written, when the question was heard rather than read.", ""],
    ["also-script-label", "The small line naming that block.", "This is how it's written"],
    ["also-script-text", "The word written out, for a question that was only heard.", "كِتاب"],
    ["also-hint", "The field the question never showed — the hint's, where the exercise offers one, and otherwise whichever of the three the prompt and the answer did not use.", ""],
    ["also-hint-label", "Its label, which names the field.", "This is how it's pronounced"],
    ["also-hint-text", "The field itself — the meaning, or how it is pronounced.", "kitaab"],
    ["also-audio", "How it sounds, with a play button.", ""],
    ["also-audio-label", "The small line naming that block.", "This is how it sounds"],
    ["related-words", "Words related to this one — sharing a root, or told apart only by tone.", ""],
    ["related-words-label", "What the language calls that relation.", "Built on the same root"],
    ["related-word", "One of those words, with what it means.", "كُتُب — books"],
    ["answer-grammar", "Which of the accepted answers they wrote, where the card takes more than one and they differ in something the language names.", "You wrote the feminine one."],
    ["bare-note", "A nudge when a right answer was typed without its marks.", "The harakat are above — worth a look."],
    ["card-note", "The teacher's own note on the card, if there is one.", ""],
    ["flag-button", "Opens the list of what can be wrong with the question, and closes it again.", "⚑ Flag a problem"],
    ["flag-menu", "The screen it opens, titled Flag a problem: one card per kind of problem, each with a line saying when to pick it, the box for saying more, and Send at the foot.", ""],
    ["flag-menu-lede", "The line at the top of that screen, saying why reporting one is worth the half minute.", "Any issue or feedback you report helps us improve the app."],
    ["flag-note", "Tell us what happened — under the four options, for whichever is picked.", ""],
    ["flag-note-need", "Beside that heading: Optional, or Required when Something else is picked.", "Optional"],
    ["flag-note-input", "The box you type it into. Something else is not sent until there is something in it.", ""],
    ["continue-button", "The way on, in the bar at the foot.", "Continue"],
  ]],
  [END, [
    ["what-moved", "The cards this sitting moved up a level, cleared, or learnt — left out altogether when none did.", "airport — learnt · key — up to writing it from a cue"],
  ]],
];

/* The naming scheme, stated once where the names are listed. */
export const NAMING = [
  ["<name>", "the block — what moves, and what spacing belongs on"],
  ["<name>-label", "the small line above it, where there is one"],
  ["<name>-text", "the words inside, where they are words"],
];

