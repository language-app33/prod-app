import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";
import {
  arSkeleton,
  checkAr,
  checkHe,
  scaleOf,
  leadingOf,
  scriptVars,
  checkViet,
  heRootKey,
  heTokenIsWord,
  inScript,
  checkEn,
  dimValues,
  grammarFields,
  labelFor,
  formLabel,
  normDimValue,
  arRootKey,
  arTokenIsWord,
  contextCoverage,
  EASY_TYPES,
  findWordSlot,
  GRAMMAR,
  guessKind,
  kindOf,
  LANGUAGES,
  tablesOf,
  specOf,
  verbOf,
  attachedOf,
  dimsOf,
  dimsFor,
  agreementOf,
  blankAdmits,
  lendsForm,
  tensedOf,
  categoriesOf,
  supportsContext,
  TYPES,
  EX,
  isListening,
} from "../src/languages.ts";
import { fillsOf } from "../src/variables.ts";

test("Arabic: bare letters accepted, wrong harakat rejected, missing harakat depends on setting", () => {
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "either" }).ok, true);
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "required" }).reason, "missing");
  assert.equal(checkAr("كُتَاب", "كِتَاب", { tashkeel: "either" }).reason, "harakat");
});

test("a mark you type has to be right; a mark you leave off is forgiven", () => {
  /* Reported by a learner: all or nothing punished knowing more. Typing no
     harakat at all was accepted and typing one of them correctly was
     refused, so every step towards the full spelling made the answer worse
     until the last one. Leaving a mark off is not typing a wrong one. */
  const word = "طَبْعاً";
  const either = { tashkeel: "either" };
  assert.equal(checkAr("طبعا", word, either).ok, true, "none of them, as before");
  assert.equal(checkAr("طبعاً", word, either).ok, true, "one of them, and right");
  assert.equal(checkAr("طَبعاً", word, either).ok, true, "two of them, and right");
  assert.equal(checkAr(word, word, either).reason, "exact", "all of them");
  /* Marked the way a word typed bare is, because that is what it is:
     fewer marks than the word carries, and none of them wrong. */
  assert.equal(checkAr("طبعاً", word, either).reason, "bare");

  /* And the rule it must not swallow: a mark that is actually wrong. */
  assert.equal(checkAr("طُبْعاً", word, either).reason, "harakat", "a damma for a fatha");
  assert.equal(checkAr("كُتَاب", "كِتَاب", either).reason, "harakat");
  /* Nor the letters underneath, which are judged first and on their own. */
  assert.equal(checkAr("طبعان", word, either).ok, false);

  /* `required` is the mode that asks for the whole vocalisation, and part
     of it is still short of the whole. */
  assert.equal(checkAr("طبعاً", word, { tashkeel: "required" }).ok, false);

  /* Hebrew reads the same rule out of the same function, because it is one
     rule about marked scripts and not two. */
  assert.equal(checkHe("סֵפר", "סֵפֶר", { niqqud: "either" }).ok, true, "one point, and right");
  assert.equal(checkHe("סָפֶר", "סֵפֶר", { niqqud: "either" }).reason, "harakat", "a wrong point");
  assert.equal(checkHe("סֵפר", "סֵפֶר", { niqqud: "required" }).ok, false);
});

test("Arabic: where the words are split is convention, not spelling", () => {
  /* الحمد لله is written joined at least as often as it is written apart,
     and the joined form was one character short of the stored one — inside
     the near-miss band, so "Very close" and marked wrong over a space. */
  assert.equal(checkAr("الحمدلله", "الحمدُ لله", { tashkeel: "either" }).ok, true);
  /* Exactly what the spaced answer gets, rather than a tier of its own. */
  assert.equal(
    checkAr("الحمدلله", "الحمدُ لله", { tashkeel: "either" }).reason,
    checkAr("الحمد لله", "الحمدُ لله", { tashkeel: "either" }).reason,
  );
  /* And the same at the tier above: harakat right, space missing, is not a
     mistake in the vowelling. */
  assert.equal(checkAr("الحمدُلله", "الحمدُ لله", { tashkeel: "either" }).reason, "exact");
  /* The other way round too — stored joined, typed apart. */
  assert.equal(checkAr("عبد الله", "عبدالله", { tashkeel: "either" }).ok, true);

  /* What the space is forgiven for, and what it is not. A wrong vowel is
     still wrong with the space gone, and letters that are not the word's
     are not rescued by closing a gap. */
  assert.equal(checkAr("الحمدَلله", "الحمدُ لله", { tashkeel: "either" }).reason, "harakat");
  assert.equal(checkAr("الحمد", "الحمدُ لله", { tashkeel: "either" }).ok, false);
  assert.equal(checkAr("   ", "الحمدُ لله", { tashkeel: "either" }).reason, "wrong");
  /* A near miss is now measured on the letters alone, so the gaps neither
     mask a slip nor count as one. */
  assert.equal(checkAr("كتب", "كتاب", { tashkeel: "either" }).reason, "near");
});

test("Vietnamese keeps its spaces, where they carry the meaning", () => {
  /* Every syllable is its own word, so running them together is not a
     matter of convention the way it is in Arabic. */
  assert.equal(checkViet("cảmơn", "cảm ơn", { tones: "either" }).ok, false);
});

test("Hebrew: bare letters accepted, wrong niqqud rejected, missing niqqud depends on setting", () => {
  assert.equal(checkHe("ספר", "סֵפֶר", { niqqud: "either" }).ok, true);
  assert.equal(checkHe("ספר", "סֵפֶר", { niqqud: "required" }).reason, "missing");
  assert.equal(checkHe("סָפֶר", "סֵפֶר", { niqqud: "either" }).reason, "harakat");
  /* The same points in a different order are the same spelling: a dagesh
     typed before or after its vowel. */
  assert.equal(checkHe("בַּיִת", "בַּיִת".normalize("NFD"), { niqqud: "either" }).ok, true);
});

test("Hebrew: a final letter typed in its ordinary shape is a leniency, not a rule", () => {
  assert.equal(checkHe("שלומ", "שלום", { foldFinals: true }).ok, true);
  assert.equal(checkHe("שלומ", "שלום", { foldFinals: false }).reason, "near");
  /* And the other way round, for a card stored without its final. */
  assert.equal(checkHe("שלום", "שלומ", { foldFinals: true }).ok, true);
});

test("Vietnamese: tone marks behave like harakat; đ is its own letter", () => {
  assert.equal(checkViet("ma", "má", { tones: "either" }).ok, true);
  assert.equal(checkViet("ma", "má", { tones: "required" }).reason, "missing");
  assert.equal(checkViet("mà", "má", { tones: "either" }).reason, "harakat");
  assert.equal(checkViet("di", "đi", { tones: "either" }).ok, false);
});

test("English: leading articles and alternatives are forgiven", () => {
  assert.equal(checkEn("the book", "book").ok, true);
  assert.equal(checkEn("desk", "office / desk").ok, true);
  assert.equal(checkEn("bok", "book").reason, "near");
});

test("dimValues carries every declared field, including a Vietnamese classifier", () => {
  const out = dimValues({ number: "plural", classifier: " con " });
  assert.equal(out.number, "plural");
  assert.equal(out.classifier, "con");
  for (const f of grammarFields()) assert.ok(f in out, `missing ${f}`);
});

/* --- number, and its "not applicable" --- */

test("a new form's number is the one the language declares, not the first option listed", () => {
  /* The order of options is what a stored value is matched against, so the
     default has to be stated rather than inferred from position. */
  assert.equal(GRAMMAR.number.options[0][0], "singular");
  assert.equal(GRAMMAR.number.default, "na");
  assert.equal(dimValues({}).number, "na");
});

test("a number already stored keeps its meaning", () => {
  /* The point of not reordering the options: an existing card must not be
     retranslated by the arrival of a new one — which the dual is. */
  assert.equal(dimValues({ number: "singular" }).number, "singular");
  assert.equal(dimValues({ number: "plural" }).number, "plural");
  assert.equal(dimValues({ number: "na" }).number, "na");
});

test("a pair is a number a language may count", () => {
  /* Arabic and Hebrew both do, and the app could not say it: a noun's
     dual had nowhere to live, which is why a counting question draws its
     nouns from a list written by hand rather than off the cards. */
  assert.deepEqual(GRAMMAR.number.options.map(([v]) => v), ["singular", "plural", "dual", "na"]);
  assert.equal(dimValues({ number: "dual" }).number, "dual");
  assert.equal(normDimValue(GRAMMAR.number, "dual"), "dual");
  assert.equal(normDimValue(GRAMMAR.number, "du"), "dual");
  /* And it is offered only where somebody counts in pairs: Huế declares
     no axes at all, so nobody there is asked a question about a dual. */
  assert.deepEqual(LANGUAGES["vi-Hue"].grammar, []);
  const ar = LANGUAGES["ar-PS"];
  assert.equal(labelFor({ number: "dual", gender: "" }, ar), "du.");
  assert.equal(labelFor({ number: "dual", gender: "feminine" }, ar), "du. f.");
});

test("an imported \"n/a\" lands on N/A", () => {
  assert.equal(normDimValue(GRAMMAR.number, "n/a"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "N/A"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "na"), "na");
  /* And the ones that were there before still win their own prefixes,
     which is the whole of what inserting an option had to not break. */
  assert.equal(normDimValue(GRAMMAR.number, "pl"), "plural");
  assert.equal(normDimValue(GRAMMAR.number, "sing"), "singular");
  assert.equal(normDimValue(GRAMMAR.number, "s"), "singular");
  assert.equal(normDimValue(GRAMMAR.number, "p"), "plural");
});

test("a form whose number doesn't apply carries no number label", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.equal(labelFor({ number: "na", gender: "" }, ar), "");
  assert.equal(labelFor({ number: "na", gender: "feminine" }, ar), "f.");
  assert.equal(labelFor({ number: "plural", gender: "feminine" }, ar), "pl. f.");
});

/* --- the retired exercise --- */

test("typing the transliteration is not offered", () => {
  assert.equal(TYPES.includes("ar2tr"), false);
  /* Reading one still is: it is the prompt there, not the answer. */
  assert.equal(TYPES.includes("tr2ar"), true);
  assert.equal(TYPES.every((t) => EX[t].answerField !== "lat"), true);
});

test("the retired definition stays, so a stored reference still resolves", () => {
  /* exOf returns null for an unknown key and its callers dereference it, so
     deleting the entry would turn old data into a crash. */
  assert.ok(EX.ar2tr);
  assert.equal(EX.ar2tr.retired, true);
});

test("the two that offer four whole cards ask opposite ways round", () => {
  /* One gives the word and offers meanings; the other gives the meaning
     and offers words. Both are answered by tapping, both need other cards
     to draw the wrong answers from, and neither is production — which is
     what puts them on the first two levels. */
  assert.equal(EX.ar2pick.promptField, "ar");
  assert.equal(EX.ar2pick.answerField, "en");
  assert.equal(EX.ar2pick.picks, "meaning");
  assert.equal(EX.en2pick.promptField, "en");
  assert.equal(EX.en2pick.answerField, "ar");
  assert.equal(EX.en2pick.picks, "word");
  for (const t of ["ar2pick", "en2pick"]) {
    assert.equal(EX[t].answerMode, "choice", t);
    assert.equal(EX[t].gentle, true, t);
    assert.ok(EX[t].needs.includes("mates"), `${t} needs other cards to stand beside`);
    assert.ok(!EX[t].retired, t);
    assert.ok(TYPES.includes(t), `${t} is on offer`);
  }
  /* Recognising what a word means comes before recognising the word. */
  assert.ok(EX.ar2pick.level < EX.en2pick.level);
});

test("every exercise that stands a card beside other cards asks for company", () => {
  /* The grid and the two pickers put whole cards up together, and a card
     whose words change cannot be one of them — offers.ts reads that off
     this need rather than naming the three. */
  assert.deepEqual(TYPES.filter((t) => EX[t].needs.includes("mates")).sort(),
    ["ar2pick", "en2pick", "img2pick", "match"]);
});

/* --- listening exercises --- */

test("the listening exercises are exactly the ones prompted by audio", () => {
  const byPrompt = TYPES.filter((t) => EX[t].promptField === "audio");
  const byHelper = TYPES.filter(isListening);
  assert.deepEqual(byHelper, byPrompt);
  /* Named so that adding another needs no second edit — but the ones that
     exist today should be exactly these. rec2ctx joined them by declaring
     an audio prompt and nothing else: the quiet window, the substitution
     and the "can't listen right now" button all picked it up unprompted,
     which is what deriving this from the prompt rather than a flag buys. */
  assert.deepEqual(byHelper, [
    "rec2en", "rec2img", "rec2ar", "rec2attr", "rec2ctx",
    /* And the two that play a number or a time. They were picked up by
       the quiet window and the "can't listen right now" button without
       being told, which is what deriving this from the prompt buys. */
    "rec2fig", "rec2dial",
  ]);
});

test("reading and writing exercises are not listening ones", () => {
  for (const t of ["ar2en", "tr2ar", "en2ar"]) {
    assert.equal(isListening(t), false, t);
  }
});

test("a type that does not exist is not a listening exercise", () => {
  /* Called with whatever a stored session holds, which may name a type that
     has since been retired. */
  assert.equal(isListening("nonsense"), false);
  assert.equal(isListening(undefined), false);
});

test("every listening exercise offers no hint", () => {
  /* Why the button has a free slot to sit in: the hint control never renders
     on these. If that ever changes, the two would collide. */
  for (const t of TYPES.filter(isListening)) {
    assert.equal(EX[t].hintField, undefined, t);
  }
});

/* --- what kind of thing a card is ---

   A card that is a phrase is a context for the words inside it, so this is
   the first thing that has to be right before any of that can be built. It
   also decides what practice can be filtered to and how the script is set. */

test("a word, a phrase and a sentence are told apart", () => {
  assert.equal(guessKind("باب"), "word");
  assert.equal(guessKind("بيت كبير"), "phrase");
  assert.equal(guessKind("سكّر الباب لو سمحت"), "sentence");
});

test("punctuation makes a sentence however short", () => {
  /* Both alphabets' full stops and question marks, since a card may be
     written in either. */
  assert.equal(guessKind("Hello there."), "sentence");
  assert.equal(guessKind("وين رايح؟"), "sentence");
  assert.equal(guessKind("Hello there"), "phrase");
});

test("nothing is not a sentence", () => {
  /* An empty or blank field must not become a sentence by accident: it
     would be filtered out of practice under a setting nobody chose. */
  assert.equal(guessKind(""), "word");
  assert.equal(guessKind("   "), "word");
  assert.equal(guessKind(undefined), "word");
  assert.equal(guessKind(null), "word");
});

test("surrounding space does not change the answer", () => {
  /* The rule this replaced looked for a trailing space, so the same text
     was a phrase or a sentence depending on how it had been pasted. */
  assert.equal(guessKind("one two three four"), guessKind("  one two three four  "));
  assert.equal(guessKind("بيت كبير"), guessKind(" بيت كبير "));
});

test("a language may answer for itself, and the app never decides", () => {
  /* The point of this living in the language layer: a script written
     without spaces between words needs a different rule entirely, and gets
     one without the app knowing. */
  const noSpaces = { guessKind: () => "sentence" };
  assert.equal(guessKind("باب", noSpaces), "sentence");
  /* And a pack that says nothing gets the default. */
  assert.equal(guessKind("باب", {}), "word");
});

test("neither language pack overrides it today", () => {
  /* If one starts to, the tests above stop covering what ships. */
  for (const id of Object.keys(LANGUAGES)) {
    assert.equal(LANGUAGES[id].guessKind, undefined, id);
  }
});

test("a card that says what kind of word it is, is a word in any language", () => {
  /*
   * The guess counts spaces, and Vietnamese writes one word as its
   * syllables with spaces between them: *cảm ơn* is a single word and
   * came back a phrase. Every such card fell out of `{{word}}` — the
   * blank that means "any word in the language" — which quietly excluded
   * roughly every Vietnamese word longer than a syllable, with nothing on
   * the screen to say so.
   *
   * The teacher answers what kind of word each card is anyway, and that
   * answer is a fact rather than a guess, so it is read first.
   */
  const vi = LANGUAGES["vi-HUE"];
  const card = (/** @type {string} */ ar, /** @type {Record<string, any>} */ over = {}) =>
    ({ id: "x", lang: "vi-HUE", forms: [{ id: "x", ar, en: "thanks", lat: "" }], ...over });
  assert.equal(kindOf(card("cảm ơn", { category: "noun" }), vi), "word");
  assert.equal(kindOf(card("chó", { category: "noun" }), vi), "word");
  /* And the same in Arabic, where a compound the teacher called a noun is
     a word however many spaces are in it. */
  assert.equal(kindOf(card("رئيس الوزراء", { category: "noun" }), LANGUAGES["ar-PS"]), "word");

  /* A card nobody has answered for is still guessed at, exactly as before. */
  assert.equal(kindOf(card("cảm ơn"), vi), "phrase");
  assert.equal(kindOf(card("chó"), vi), "word");

  /* And the answer beats the kind cached on a card when it was typed,
     which is only this same guess written down. */
  assert.equal(kindOf(card("cảm ơn", { category: "noun", kind: "phrase" }), vi), "word");
});

test("and so it is offered to fill the blank that means any word", () => {
  /* Which is the whole point of the rule above: fillsOf is handed the
     kind, and a card that reads as a word answers to `{{word}}`. */
  const vi = LANGUAGES["vi-HUE"];
  const thanks = { id: "x", lang: "vi-HUE", category: "noun", forms: [{ id: "x", ar: "cảm ơn", en: "thanks", lat: "" }] };
  assert.deepEqual(fillsOf(thanks, kindOf(thanks, vi)).sort(), ["noun", "word"]);
});

/* --- finding a word inside a phrase ---

   The point of all of it: a phrase the teacher recorded is a context for
   the words inside it, and no content has to be invented to get one. */

const AR = LANGUAGES["ar-PS"];

test("the article and the little prefixes do not hide a word", () => {
  assert.equal(arTokenIsWord("كتاب", "كتاب"), true);
  assert.equal(arTokenIsWord("الكتاب", "كتاب"), true);
  assert.equal(arTokenIsWord("وبالكتاب", "كتاب"), true);
  assert.equal(arTokenIsWord("للكتاب", "كتاب"), true);
});

test("harakat do not hide it either", () => {
  /* A teacher may vocalise one card and not the other; the match has to
     survive that, the same way the answer checker does. */
  assert.equal(arTokenIsWord("الكِتَاب", "كتاب"), true);
  assert.equal(arTokenIsWord("كتاب", "كِتَاب"), true);
});

test("a different word is not a match", () => {
  assert.equal(arTokenIsWord("مكتبة", "كتاب"), false);
  assert.equal(arTokenIsWord("بيت", "كتاب"), false);
});

test("a broken plural is a known miss, and stays one", () => {
  /* أبواب is باب reshaped, not باب with something added, so peeling
     prefixes can never find it. Written down so the limit is a decision
     rather than a surprise — the root grouping is what covers this. */
  assert.equal(arTokenIsWord("أبواب", "باب"), false);
});

test("peeling stops before it eats the word", () => {
  /* بيت is three letters; peeling ب off it leaves يت, which is not a word
     and must not be offered as one. */
  assert.equal(arTokenIsWord("بيت", "يت"), false);
});

test("the slot is the token's position, so the right word can be blanked", () => {
  assert.equal(findWordSlot("الكتاب كبير", "كتاب", AR), 0);
  assert.equal(findWordSlot("بدي كتاب جديد", "كتاب", AR), 1);
  assert.equal(findWordSlot("الكتاب كبير", "بيت", AR), -1);
});

test("a language that does not declare context gets none of this", () => {
  /* The expected case for most languages, and it must be a quiet no rather
     than a crash or a wrong guess made by the app. */
  const bare = { id: "xx" };
  assert.equal(supportsContext(bare), false);
  assert.equal(findWordSlot("الكتاب كبير", "كتاب", bare), -1);
  assert.deepEqual(contextCoverage([{ id: "1", ar: "كتاب" }], bare).supported, false);
});

test("Vietnamese matches whole words and keeps the tone", () => {
  const VI = LANGUAGES["vi-Hue"];
  assert.equal(findWordSlot("má tôi", "má", VI), 0);
  /* ma and má are two words; treating them as one would repeat the mistake
     the answer checker exists to avoid. */
  assert.equal(findWordSlot("ma tôi", "má", VI), -1);
});

test("coverage counts the words that have a context, and every context each has", () => {
  const cards = [
    { id: "1", ar: "كتاب", en: "book" },
    { id: "2", ar: "بيت", en: "house" },
    { id: "3", ar: "شمس", en: "sun" },
    { id: "4", ar: "الكتاب كبير", en: "the book is big" },
    { id: "5", ar: "بدي كتاب جديد", en: "I want a new book" },
    { id: "6", ar: "البيت بعيد", en: "the house is far" },
  ];
  const r = contextCoverage(cards, AR);
  assert.equal(r.counts.word, 3);
  assert.equal(r.counts.phrase, 3);
  assert.equal(r.covered, 2, "book and house have contexts; sun has none");
  assert.equal(r.links, 3);
  /* Most contexts first, because that is the order worth reading. */
  assert.equal(r.words[0].ar, "كتاب");
  assert.equal(r.words[0].contexts.length, 2);
  assert.equal((r.words.at(-1) || { contexts: [] }).contexts.length, 0);
});

test("a conversation counts as the card it is and matches as the turns it holds", () => {
  /* A scene has no text of its own, so reading `ar` off the card found an
     empty string and every conversation in a deck counted for nothing
     here — while the session builder was already drilling those words
     inside those turns. */
  const cards = [
    { id: "1", ar: "كتاب", en: "book" },
    { id: "2", ar: "شمس", en: "sun" },
    {
      id: "d1", ar: "", en: "At the shop",
      speakers: ["Layla", "Karim"],
      lines: [
        { who: 0, ar: "الكتاب كبير", en: "the book is big" },
        { who: 1, ar: "بدي كتاب جديد", en: "I want a new book" },
      ],
    },
  ];
  const r = contextCoverage(cards, AR);
  assert.equal(r.counts.word, 2, "a scene is not a word");
  assert.equal(r.counts.phrase, 0, "nor three phrases the teacher never wrote");
  assert.equal(r.counts.dialog, 1, "it is one conversation");
  assert.equal(r.covered, 1, "the book turns up in it; the sun does not");
  assert.equal(r.links, 2, "in both turns, which are two places to meet it");
  assert.equal(r.words[0].contexts.length, 2);
});

test("a collection with no phrases at all reports honestly", () => {
  /* The answer this is built to give when it is the true one. */
  const r = contextCoverage([{ id: "1", ar: "كتاب" }, { id: "2", ar: "بيت" }], AR);
  assert.equal(r.covered, 0);
  assert.equal(r.links, 0);
  assert.equal(r.counts.phrase, 0);
});

/* --- the two context exercises ---

   Both are ordinary entries in the table; what is worth asserting is the
   things the rest of the app derives from them without being told. */

test("filling a gap is not a listening exercise; hearing one is", () => {
  assert.equal(EX.ctx2ar.promptField, "context");
  assert.equal(EX.rec2ctx.promptField, "audio");
});

test("both ask for the script, so they are checked like any other answer", () => {
  /* answerMode is what routes an answer to the language's own checker. A
     new mode would have fallen through to the English one silently. */
  assert.equal(EX.ctx2ar.answerMode, "ar");
  assert.equal(EX.rec2ctx.answerMode, "ar");
  assert.equal(EX.ctx2ar.answerField, "ar");
  assert.equal(EX.rec2ctx.answerField, "ar");
});

test("each says what a card must have before it can be asked", () => {
  /* Neither of these is a field on a card: they are questions about the
     phrases that show a word in use, which availableTypes answers from the
     index rather than from the card. */
  assert.ok(EX.ctx2ar.needs.includes("contexts"));
  assert.ok(EX.rec2ctx.needs.includes("contextAudio"));
});

test("neither joins the gentle types, and the hint is a nudge not the answer", () => {
  /* "Get started" is recognition only; picking a word out of running speech
     is the opposite of that. */
  assert.equal(EASY_TYPES.includes("ctx2ar"), false);
  assert.equal(EASY_TYPES.includes("rec2ctx"), false);
  /* The gap is cued by the word's own meaning, shown always — so the hint
     is how it sounds, the same nudge en2ar gets. Revealing the meaning here
     would have been revealing the cue that is already on screen. */
  assert.equal(EX.ctx2ar.hintField, "lat");
  assert.equal(EX.rec2ctx.hintField, undefined, "a listening exercise offers no hint");
});

/* --- the words a word belongs with --- */

test("the gentle types are read off the definitions, not kept beside them", () => {
  /* The app held a second list, and a new type had to be remembered twice
     or "Get started" quietly never offered it. Reading a line of a
     conversation through is recognition too, and belongs with the others:
     a beginner meeting a scene should be asked whether they can follow it
     before being asked to say any of it. Choosing a word out of a phrase is
     the same argument again: the gap-fill used to start at the hard half,
     so a learner's first meeting with a word in context was also their
     first chance to get it wrong.

     The gentle set is the first two levels of the ladder exactly:
     recognising what a word means, then which word it is. Every one of
     them puts the answer on the screen — nothing here is written out. */
  assert.deepEqual(EASY_TYPES, [
    "ar2pick", "ar2en", "rec2en", "rec2img", "match", "en2pick", "img2pick", "ctx2pick", "dlgwhole",
    /* Reading a number or a time and saying what it is, and picking one
       out of four, are recognition in exactly the sense the six above
       are: the answer is on the screen and nothing is written out. */
    "num2fig", "fig2pick", "rec2fig", "time2fig", "time2dial",
  ]);
  for (const t of EASY_TYPES) assert.equal(EX[t].gentle, true, t);
  for (const t of TYPES.filter((x) => !EASY_TYPES.includes(x))) {
    assert.notEqual(EX[t].gentle, true, t);
  }
});

test("every pack resolves a usable type scale", () => {
  /* font-size sets the em box, not the height of a letter, and scripts
     fill that box by different amounts — so the sizes in the stylesheet,
     tuned by eye against Arabic, come out oversized for a Latin script.
     Each pack says how much to multiply by. Both numbers have to be
     positive and finite wherever they are read, because they end up
     inside a calc() and a bad one would silently drop the declaration. */
  for (const [id, lang] of Object.entries(LANGUAGES)) {
    /** @type {[string, number][]} */
    const sizes = [["scale", scaleOf(lang)], ["leading", leadingOf(lang)]];
    for (const [what, n] of sizes) {
      assert.equal(typeof n, "number", `${id} ${what}`);
      assert.ok(Number.isFinite(n) && n > 0, `${id} ${what} is ${n}`);
    }
  }
  /* Arabic is the baseline the sizes were tuned against, so it multiplies
     by nothing: the change that introduced this must not have moved a
     single Arabic pixel. */
  assert.equal(scaleOf(LANGUAGES["ar-PS"]), 1);
  assert.equal(leadingOf(LANGUAGES["ar-PS"]), 1);
  assert.ok(scaleOf(LANGUAGES["vi-Hue"]) < 1, "Latin script should ask for less than Arabic");
});

test("a pack that says nothing about size renders at full size", () => {
  /* The case every future pack starts in — Hebrew is in it today — so it
     has to be the safe one rather than a crash or a zero. */
  assert.equal(scaleOf({}), 1);
  assert.equal(leadingOf({}), 1);
  assert.deepEqual(scriptVars({}), { "--sscale": "1", "--sleading": "1", "--lscale": "0.78" });
  /* And a value that could not work in a calc() falls back rather than
     poisoning every rule that reads it. */
  for (const bad of [0, -1, NaN, Infinity, "big", null]) {
    assert.equal(scaleOf({ scale: bad }), 1, String(bad));
    assert.equal(leadingOf({ leading: bad }), 1, String(bad));
  }
});

test("the properties are strings, which is what a style object needs", () => {
  /* React appends no unit to a custom property, so a number would work —
     but the values are read straight into calc() and a string keeps that
     explicit rather than dependent on that behaviour. */
  const v = scriptVars(LANGUAGES["vi-Hue"]);
  assert.deepEqual(v, { "--sscale": "0.78", "--sleading": "0.85", "--lscale": "0.78" });
});

test("the Latin beside the script is the same size whatever is being taught", () => {
  /* A meaning and a romanisation are Latin in every course, so the factor
     that sizes them cannot be the pack's. It is one number for all three,
     and for Vietnamese it is the pack's own — which is the point: there
     the word and its meaning come out at one size again. */
  const ls = Object.keys(LANGUAGES).map((id) => scriptVars(LANGUAGES[id])["--lscale"]);
  assert.equal(new Set(ls).size, 1, `Latin was sized differently per course: ${ls.join(", ")}`);
  assert.equal(scriptVars({})["--lscale"], ls[0], "a pack that says nothing still sizes Latin");
  assert.equal(scriptVars(LANGUAGES["vi-Hue"])["--sscale"], ls[0],
    "Vietnamese is Latin, so its own factor and Latin's have to agree");
});

test("every language that groups words says what the grouping is called", () => {
  /* The app renders this sentence and must never compose one: a family
     sharing a root and a set of words told apart only by tone are not the
     same observation, and no single sentence is true of both. */
  for (const [id, lang] of Object.entries(LANGUAGES)) {
    const group = (lang.derived || []).find((d) => d.groups);
    if (!group) continue;
    assert.equal(typeof group.heading, "string", `${id} groups words without a heading`);
    assert.ok((group.heading || "").length > 0, id);
  }
});

test("Arabic groups by root and needs no quizzable property to do it", () => {
  /* The change this rests on. Arabic declares a grouping and nothing to
     quiz, and the old code demanded both — so the root families it had
     already computed were thrown away on every answer. */
  const ar = LANGUAGES["ar-PS"];
  const group = must(ar.derived.find((d) => d.groups), "Arabic's grouping");
  assert.equal(group.id, "root");
  assert.equal(ar.derived.some((d) => d.quizzable), false);
  assert.match(group.heading || "", /root/i);
});

test("the root key gathers a family and nothing else", () => {
  /* The pattern system: three consonants poured into different shapes. */
  const family = ["كتاب", "كاتب", "مكتب", "مكتبة", "كتب"].map(arRootKey);
  assert.equal(new Set(family).size, 1, `should share one key, got ${family.join(" ")}`);
  assert.notEqual(arRootKey("شمس"), family[0]);
  /* A prefix that is part of the word rather than attached to it. */
  assert.equal(arRootKey("مدرسة"), arRootKey("درس"));
});

test("Hebrew groups by root the way Arabic does", () => {
  const he = LANGUAGES["he-IL"];
  const group = must(he.derived.find((d) => d.groups), "Hebrew's grouping");
  assert.equal(group.id, "root");
  assert.equal(group.compute, heRootKey);
  assert.match(group.heading || "", /root/i);
  assert.equal(he.derived.some((d) => d.quizzable), false);
});

test("the Hebrew root key gathers a family across its spellings and shapes", () => {
  /* Full spelling, the noun prefix, a feminine ending, a plural — one root. */
  const family = ["כתב", "כותב", "מכתב", "כתיבה", "מכתבים"].map(heRootKey);
  assert.equal(new Set(family).size, 1, `should share one key, got ${family.join(" ")}`);
  assert.notEqual(heRootKey("שמש"), family[0]);
  assert.equal(heRootKey("מלכה"), heRootKey("מלך"));
  assert.equal(heRootKey("ספרים"), heRootKey("ספר"));
  /* Only מ is peeled off the front. Half the roots start with a letter that
     is also a preposition or the article, and taking ש off שמירה would file
     guarding under the wrong family. */
  assert.equal(heRootKey("שמירה"), "שמר");
  /* And not a root letter that happens to be מ: מלך is a king, not לך. */
  assert.equal(heRootKey("מלך").length, 3);
});

test("a Hebrew key too short to mean anything is no key", () => {
  assert.equal(heRootKey("אב"), "");
  assert.equal(heRootKey(""), "");
});

test("Hebrew finds a word inside a phrase through its attached particles", () => {
  assert.equal(heTokenIsWord("והספר", "ספר"), true);
  assert.equal(heTokenIsWord("בבית", "בית"), true);
  assert.equal(heTokenIsWord("ספר", "שמש"), false);
  assert.equal(heTokenIsWord("סֵפֶר", "ספר"), true);
});

test("a language says which script it is written in, and a Latin-script one says nothing", () => {
  assert.equal(inScript("ספר", LANGUAGES["he-IL"]), true);
  assert.equal(inScript("book", LANGUAGES["he-IL"]), false);
  assert.equal(inScript("كتاب", LANGUAGES["ar-PS"]), true);
  assert.equal(inScript("book", LANGUAGES["ar-PS"]), false);
  /* Vietnamese cannot be told apart from English by character range, so it
     declares no script and the importer falls back to column order. */
  assert.equal(inScript("sách", LANGUAGES["vi-Hue"]), false);
});

test("a key too short to mean anything is no key", () => {
  /* Two consonants would gather words with nothing to do with each other,
     so a hollow root simply has no family. Fewer families, never wrong
     ones. */
  assert.equal(arRootKey("مال"), "");
  assert.equal(arRootKey("بيت"), "");
  assert.equal(arRootKey(""), "");
});

test("a word spelt in presentation forms is the word, not a stranger", () => {
  /* Unicode carries each joined shape of an Arabic letter as a character
     of its own, and some keyboards and most clipboards hand those over.
     They rendered identically and compared as different in every letter —
     a flat "wrong", where a single hamza is a near miss. The learner saw
     their own correct word marked as if it were another word entirely. */
  const check = LANGUAGES["ar-PS"].check;
  const forms = "ﻋﻨﺪﻱ ﺳﻮﺍﻝ"; // ﻋﻨﺪﻱ ﺳﻮﺍﻝ as presentation forms, not letters
  assert.equal(check(forms, "عندي سؤال", { ignoreHamza: true }).ok, true, "lenient: only the hamza differs, and it is forgiven");
  assert.equal(check(forms, "عندي سؤال", { ignoreHamza: false }).reason, "near", "strict: one letter off, and said so");
  assert.equal(check("ﻻ", "لا", {}).ok, true, "and the lam-alef ligature is its two letters");
});

test("what arSkeleton did, and why it could never have grouped anything", () => {
  /* It stripped harakat and folded hamza and stopped there, so every word
     kept its own spelling as its key. Kept because similarity still reads
     it; it is no longer what gathers a family. */
  assert.notEqual(arSkeleton("كتاب"), arSkeleton("كاتب"));
  assert.equal(must(LANGUAGES["ar-PS"].derived.find((d) => d.groups), "Arabic's grouping").compute, arRootKey);
});

test("a hint that gives the answer away is declared as one, and nothing else is", () => {
  /* The two questions that ask for the word in the script and offer its
     transliteration: read the nudge and all that is left is to spell out
     what it says, which is the question one level down. Marked so the
     trainer can keep it shut and mark an answer written under it as the
     near miss it is. */
  assert.deepEqual(TYPES.filter((t) => EX[t].hintTells), ["en2ar", "img2ar", "ctx2ar"]);
  for (const t of TYPES) {
    const spec = EX[t];
    if (!spec.hintTells) continue;
    assert.ok(spec.hintField, `${t}: a hint that tells has to be a hint in the first place`);
    assert.equal(spec.level, 4, `${t}: it is the writing that a transliteration undoes`);
  }
  /* And the other way round, which is the one that matters: a new exercise
     that types the script and offers the transliteration beside it has the
     same hole in it, and saying so here is cheaper than finding out from a
     learner's schedule. */
  for (const t of TYPES) {
    const spec = EX[t];
    const tells = spec.hintField === "lat" && spec.answerField === "ar" && spec.answerMode === "ar";
    if (tells) assert.ok(spec.hintTells, `${t}: its hint is the word it asks for — say so with hintTells`);
  }
});

/* ------------------------------------------------------------------
   The tables a language declares, by name

   Two of them used to be named fields on the pack, and a third table would
   have been a third field, a third accessor and a third branch wherever the
   two were told apart. A pack declares what it has under a name, and each
   table says what its cells wait on and whether every form carries one.
   ------------------------------------------------------------------ */

test("every table a pack declares has rows and columns, and every row name is the pack's alone", () => {
  for (const lang of Object.values(LANGUAGES)) {
    const tables = tablesOf(lang);
    const rows = new Set();
    for (const [name, spec] of Object.entries(tables)) {
      assert.ok(spec.tenses.length > 0 && spec.persons.length > 0, `${lang.id} ${name} has an empty axis`);
      /* The invariant everything stands on: a cell says which table it is
         in by the row it sits in, so no two tables may share a row name. */
      for (const t of spec.tenses) {
        assert.equal(rows.has(t.id), false, `${lang.id}: row "${t.id}" is in two tables`);
        rows.add(t.id);
      }
    }
  }
});

test("the verb and the pronouns are still found by name, and the rest by the registry", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.equal(verbOf(ar), specOf(ar, "verb"));
  assert.equal(attachedOf(ar), specOf(ar, "attached"));
  assert.ok(specOf(ar, "agreement"), "Arabic adjectives agree");
  /* And the faces a numeral takes, which every pack with a composer lays
     out under the same name. The `counted` table it had instead — one cell
     for the form beside a feminine noun — went with the cards it was for:
     the faces are boxes in the number system now, and there are five of
     them rather than one. */
  assert.equal(specOf(ar, "counted"), null);
  assert.ok(specOf(ar, "number"), "and the faces a numeral takes");
  assert.equal(specOf(ar, "no-such-table"), null);
  assert.equal(specOf(null, "verb"), null);
  const vi = LANGUAGES["vi-Hue"];
  assert.deepEqual(Object.keys(tablesOf(vi)), ["verb", "number"]);
  assert.equal(specOf(vi, "agreement"), null);
  assert.deepEqual(must(specOf(vi, "number"), "Huế number").persons.map((p) => p.id),
    ["company"]);
  /* Hebrew agrees in number and gender at once, so its plural is two cells. */
  assert.deepEqual(must(specOf(LANGUAGES["he-IL"], "agreement"), "Hebrew agreement").persons.map((p) => p.id),
    ["feminine", "masc-plural", "fem-plural"]);
});

test("a table says what its cells wait on, and whose it is", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.equal(must(verbOf(ar), "verb").gate, "rows", "one tense of a verb is ever new at a time");
  assert.equal(must(attachedOf(ar), "attached").gate, "word", "the pronouns wait on the word");
  assert.equal(must(attachedOf(ar), "attached").perForm, true, "and every form carries its own");
  assert.equal(must(specOf(ar, "agreement"), "agreement").gate, "word");
  assert.equal(!!must(specOf(ar, "agreement"), "agreement").perForm, false, "an adjective's forms are the card's");
  /* What it is called to a teacher, where the rows do not say. */
  assert.ok(must(specOf(ar, "agreement"), "agreement").label);
  assert.ok(must(specOf(ar, "number"), "number").label);
});

test("what a kind of word lays out, and what it is asked about, is the category's answer", () => {
  const ar = LANGUAGES["ar-PS"];
  const cat = (/** @type {string} */ id) => must(categoriesOf(ar).find((c) => c.id === id), id);
  assert.equal(cat("adjective").table, "agreement");
  /* A number lays out nothing and is offered to nobody: its faces are
     boxes in the language's number system now. The kind is still declared
     so that a card saved while it was offered goes on saying what it is. */
  assert.equal(cat("number").table, undefined);
  assert.equal(cat("number").retired, true);
  assert.equal(cat("noun").table, "attached");
  assert.equal(cat("verb").table, "verb");
  assert.equal(cat("pronoun").table, undefined);
  /* The axes each is asked about, within the pack's own. */
  const fields = (/** @type {string} */ id) => dimsFor(ar, id).map((d) => d.field);
  assert.deepEqual(fields("noun"), ["number", "gender", "human"]);
  assert.deepEqual(fields("name"), ["number", "gender"], "a name keeps its number: the verb beside it reads it");
  assert.deepEqual(fields("pronoun"), ["number", "gender"]);
  assert.deepEqual(fields("preposition"), []);
  assert.deepEqual(fields("verb"), []);
  assert.deepEqual(fields("adjective"), [], "its number and gender are its table");
  /* A kind nobody has said, or a pack that says nothing, is asked everything the pack has. */
  assert.deepEqual(fields(""), dimsOf(ar).map((d) => d.field));
  assert.deepEqual(fields("particle"), dimsOf(ar).map((d) => d.field));
  /* Hebrew has no person-or-thing rule, so the shared list's "human" is
     not asked there — the category's list is within the pack's. */
  assert.deepEqual(dimsFor(LANGUAGES["he-IL"], "noun").map((d) => d.field), ["number", "gender"]);
  assert.deepEqual(dimsFor(LANGUAGES["vi-Hue"], "adjective"), []);
  /* Huế names the same table the other two do and declares none of it, so
     an adjective there is the word and whatever forms a teacher writes.
     That is right and it used to be silent — the screen came out
     identical to "Something else" — so the editor says so now, on exactly
     this condition: a kind that names a table its language has not got. */
  const vi = LANGUAGES["vi-Hue"];
  const named = (/** @type {any} */ l, /** @type {string} */ id) =>
    (must(categoriesOf(l).find((c) => c.id === id), id).table) || "";
  assert.equal(named(vi, "adjective"), "agreement", "the kind names a table");
  assert.equal(specOf(vi, "agreement"), null, "and this language lays none of it out");
  assert.ok(specOf(LANGUAGES["ar-PS"], named(ar, "adjective")), "where it does, it does");
  assert.deepEqual(dimsFor(null, "noun"), []);
});

test("which kinds of word agree out of a table, and which do not", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.ok(agreementOf(ar, "adjective"), "an adjective agrees");
  /* A number did, out of a table with one cell in it. It agrees in five
     faces now, out of the number system, which is not a card's table. */
  assert.equal(agreementOf(ar, "number"), null);
  /* The pronouns on the end of a word pick nothing, and a verb's three
     rows need a sentence to say which. */
  assert.equal(agreementOf(ar, "noun"), null);
  assert.equal(agreementOf(ar, "verb"), null);
  assert.equal(agreementOf(ar, "name"), null);
  assert.equal(agreementOf(ar, ""), null);
  assert.equal(agreementOf(LANGUAGES["vi-Hue"], "adjective"), null, "nothing agrees in Huế");
});

test("and which kinds of word a sentence can ask for a tense of", () => {
  const ar = LANGUAGES["ar-PS"];
  /* The other end of the same question: one row is a word that never has
     to choose, and several rows is a word that is a different word
     depending on when it happened. */
  assert.ok(tensedOf(ar, "verb"), "a verb has three rows");
  assert.equal(tensedOf(ar, "adjective"), null, "an agreement table has one");
  assert.equal(tensedOf(ar, "noun"), null, "and so does a table of pronouns");
  assert.equal(tensedOf(ar, "name"), null, "and a name lays nothing out at all");
  assert.equal(tensedOf(ar, ""), null);
  assert.ok(tensedOf(LANGUAGES["vi-Hue"], "verb"), "Huế marks four, in one column");
});

test("a narrowed blank takes the verbs of those tenses and everything else as before", () => {
  const ar = LANGUAGES["ar-PS"];
  const past = blankAdmits(ar, () => ["past"]);
  const verb = { category: "verb" };
  assert.equal(past(verb, { ar: "أكل", row: "past", col: "he" }, "verb"), true);
  assert.equal(past(verb, { ar: "بياكل", row: "present", col: "he" }, "verb"), false);
  assert.equal(past(verb, { ar: "أكل" }, "verb"), false, "the dictionary form is in no row");
  /* A word of a kind with no tenses stands in the hole whatever is
     ticked: a name is not in the present or the past. */
  assert.equal(past({ category: "name" }, { ar: "رافائيل" }, "verb"), true);
  /* And a blank nobody has narrowed is filled the way it always was. */
  const open = blankAdmits(ar, () => []);
  assert.equal(open(verb, { ar: "بياكل", row: "present", col: "he" }, "verb"), true);
  /* Each blank on its own: what is asked is the slot's own answer. */
  const perSlot = blankAdmits(ar, (slot) => (slot === "verb" ? ["past"] : []));
  assert.equal(perSlot(verb, { ar: "بياكل", row: "present", col: "he" }, "verb2"), true);
  assert.equal(perSlot(verb, { ar: "بياكل", row: "present", col: "he" }, "verb"), false);
});

test("whether a noun is a person or a thing is never printed on a tag", () => {
  const ar = LANGUAGES["ar-PS"];
  assert.equal(labelFor({ number: "plural", gender: "masculine", human: "person" }, ar), "pl. m.");
  assert.equal(labelFor({ number: "singular", gender: "feminine", human: "thing" }, ar), "sg. f.");
  /* And a new form starts as a thing, which is what most nouns are. */
  assert.equal(dimValues({}).human, "thing");
});

test("an adjective's shapes say which they are: gender, plural and dual", () => {
  /* Reported by a learner: since an adjective's feminine, plural and dual
     became its table, an exercise asking for one of them said only "big",
     which is what the masculine answers. The cells carry no number or
     gender of their own — where they sit is which they are. */
  const ar = LANGUAGES["ar-PS"];
  const cell = (/** @type {string} */ col) => ({ id: `big-${col}`, ar: "", en: "big", lat: "", row: "agreement", col });
  assert.equal(labelFor(cell("feminine"), ar), "feminine");
  assert.equal(labelFor(cell("plural"), ar), "plural");
  assert.equal(labelFor(cell("dual"), ar), "dual");
  const he = LANGUAGES["he-IL"];
  assert.equal(labelFor(cell("masc-plural"), he), "masculine plural");
  assert.equal(labelFor(cell("fem-plural"), he), "feminine plural");
  /* The word itself is the masculine, which only the card can say. */
  const big = { id: "big", ar: "كبير", en: "big", lat: "", category: "adjective", subs: [cell("feminine"), cell("plural")] };
  assert.equal(formLabel(big, big, ar), "masculine");
  assert.equal(formLabel(cell("feminine"), big, ar), "feminine");
  assert.equal(formLabel(big, { id: "big", ar: "كبير", en: "big", subs: [] }, ar), "", "no table, nothing to tell it from");
  /* A verb's cells and the pronouns on a word say which they are in their
     English, and stay untagged as they always were. */
  assert.equal(labelFor({ id: "v", ar: "أكلت", en: "she ate", row: "past", col: "she" }, ar), "");
  assert.equal(labelFor({ id: "p", ar: "كتابي", en: "my book", row: "attached", col: "me" }, ar), "");
  /* And a form that carries its own grammar is named by it, as before. */
  assert.equal(labelFor({ number: "plural", gender: "feminine" }, ar), "pl. f.");
  /* Huế has no such table and nothing to say. */
  assert.equal(labelFor(cell("feminine"), LANGUAGES["vi-Hue"]), "");
});

test("an agreeing card lends its own word only, and every other card lends every form", () => {
  const ar = LANGUAGES["ar-PS"];
  const lendsBig = lendsForm(ar, { category: "adjective" });
  assert.equal(lendsBig({ ar: "كبير" }), true, "the word");
  assert.equal(lendsBig({ ar: "كبيرة", row: "agreement", col: "feminine" }), false, "not a form the sentence picks");
  assert.equal(lendsBig({ ar: "كبيرين", row: "" }), true, "a plain extra form still lends");
  const lendsBook = lendsForm(ar, { category: "noun" });
  assert.equal(lendsBook({ ar: "كتابي", row: "attached", col: "me" }), true, "the pronouns pick nothing, so they lend");
  assert.equal(lendsForm(ar, { category: "" })({ row: "agreement" }), true, "a card that says nothing lends everything");
  assert.equal(lendsForm(LANGUAGES["vi-Hue"], { category: "adjective" })({ row: "agreement" }), true, "nothing agrees in Huế");
  assert.equal(lendsForm(null, { category: "adjective" })({}), true);
});
