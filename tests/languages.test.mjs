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
  answerLabel,
  askLabel,
  lentLabel,
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
  BARE_ROW,
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
  assert.equal(checkEn("bok", "book").reason, "typo");
  assert.equal(checkEn("bok", "book").ok, true);
});

test("English: one letter out is a slip and right; further out, or a short word, is not", () => {
  assert.deepEqual(checkEn("Tiref", "Tired"), { ok: true, reason: "typo" });
  assert.deepEqual(checkEn("tird", "tired"), { ok: true, reason: "typo" });
  assert.deepEqual(checkEn("dsk", "office / desk"), { ok: true, reason: "typo" });
  /* A swap is two changes, and a short word is one letter from another. */
  assert.equal(checkEn("tried", "tired").ok, false);
  assert.equal(checkEn("cut", "cat").ok, false);
  assert.equal(checkEn("cut", "cat").reason, "near");
  /* Two letters out of a long word is still only near. */
  assert.deepEqual(checkEn("understnad", "understand"), { ok: false, reason: "near" });
});

test("English: an s on the end is grammar, not a typo", () => {
  /* Reported by a learner: "Photo" for صُوَر, the plural, was marked right
     as one letter out. And "live" for "she lives" was too. */
  assert.deepEqual(checkEn("Photo", "Pictures / Photos / Images"), { ok: false, reason: "ending" });
  assert.deepEqual(checkEn("photos", "Picture / Photo / Image"), { ok: false, reason: "ending" });
  assert.deepEqual(checkEn("live", "lives"), { ok: false, reason: "ending" });
  assert.deepEqual(checkEn("she live", "she lives"), { ok: false, reason: "ending" });
  assert.deepEqual(checkEn("boxes", "box"), { ok: false, reason: "ending" });
  assert.deepEqual(checkEn("city", "cities"), { ok: false, reason: "ending" });
  /* The right ending is still right, and a doubled s dropped is still a slip. */
  assert.deepEqual(checkEn("Photos", "Pictures / Photos / Images"), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("glas", "glass"), { ok: true, reason: "typo" });
  /* Any other one-letter slip is still forgiven. */
  assert.deepEqual(checkEn("Phots", "Pictures / Photos / Images"), { ok: true, reason: "typo" });
});

test("Punctuation is never what an answer is marked on, curly or straight", () => {
  /* Phones type curly quotes and apostrophes on their own. */
  assert.deepEqual(checkEn("I don’t know", "I don't know"), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("it’s", "it's"), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("“yes”", "yes"), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("Hello how are you", "Hello, how are you?"), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("well — then", "well, then"), { ok: true, reason: "exact" });
  assert.equal(checkAr("“مرحبا”", "مرحبا", {}).ok, true);
  assert.equal(checkAr("مرحبا كيفك", "مرحبا، كيفك؟", {}).ok, true);
  assert.equal(checkHe("„שלום“", "שלום", {}).ok, true);
  assert.equal(checkViet("xin chào — bạn", "xin chào, bạn!", { tones: "either" }).ok, true);
  assert.equal(checkViet("“xin chào”", "xin chào", { tones: "either" }).ok, true);
});

test("English: a comma inside a meaning is part of it, not a break between meanings", () => {
  /* Reported by a learner, three times: the whole sentence was marked
     wrong, with or without its comma, and half of it was marked right. */
  const m = "He's cold, he wants a jacket / He's cold, he needs a jacket / He is cold, he wants a jacket / He is cold, he needs a jacket";
  assert.deepEqual(checkEn("He is cold, he wants a jacket ", m), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("He is cold he wants a jacket ", m), { ok: true, reason: "exact" });
  assert.deepEqual(checkEn("He's cold, he needs a jacket", m), { ok: true, reason: "exact" });
  assert.equal(checkEn("He is cold", m).ok, false);
  assert.equal(checkEn("he needs a jacket", m).ok, false);
  /* The other person is still the other person. */
  assert.equal(checkEn("She is cold, she wants a jacket", m).ok, false);
});

test("English: a different word in one place is wrong, not a near miss", () => {
  /* Reported by a learner, twice: "their" for "your" was marked as the
     right word, not quite spelt. */
  assert.deepEqual(checkEn("Their name is Zatar", "Your name is Zaʿtar"), { ok: false, reason: "wrong" });
  assert.deepEqual(checkEn("They name is Shams ", "Your name is Shams"), { ok: false, reason: "wrong" });
  assert.deepEqual(checkEn("he is tired", "it is tired"), { ok: false, reason: "wrong" });
  /* A misspelt word in a sentence is still near, and one letter still right. */
  assert.deepEqual(checkEn("your nmae is shams", "Your name is Shams"), { ok: false, reason: "near" });
  assert.deepEqual(checkEn("Your name is Zatar", "Your name is Zaʿtar"), { ok: true, reason: "typo" });
  assert.deepEqual(checkEn("I am tried", "I am tired"), { ok: false, reason: "near" });
});

test("a word lent to a sentence is named only where its English is shared", () => {
  const ar = LANGUAGES["ar-PS"];
  /* The card behind "{{whose-name}} is {{person}}": three forms reading
     "Your name" and one reading "My name". */
  const card = { id: "n", ar: "اسمي", en: "My name", number: "singular", gender: "masculine",
    subs: [
      { id: "n2", ar: "اسمك", en: "Your name", number: "singular", gender: "masculine" },
      { id: "n3", ar: "اسمك", en: "Your name", number: "singular", gender: "feminine" },
      { id: "n4", ar: "اسمكم", en: "Your name", number: "plural", gender: "masculine" },
    ] };
  assert.equal(lentLabel(card.subs[2], card, ar), "plural");
  assert.equal(lentLabel(card.subs[1], card, ar), "feminine");
  assert.equal(lentLabel(card.subs[0], card, ar), "masculine singular");
  /* Its English is its own: nothing to say. */
  assert.equal(lentLabel(card, card, ar), "");
  /* Alike in English and in everything the teacher wrote: nothing either. */
  const bare = { id: "b", ar: "اسمك", en: "Your name", subs: [{ id: "b2", ar: "اسمكم", en: "Your name" }] };
  assert.equal(lentLabel(bare.subs[0], bare, ar), "");
  /* A verb's cells say who, as askLabel does. */
  const cell = (/** @type {string} */ col, /** @type {string} */ word) =>
    ({ id: `u-${col}`, ar: word, en: "You understand", lat: "", row: "present", col });
  const verb = { id: "u", ar: "", en: "", category: "verb", subs: [cell("you-m", "بتِفهَم"), cell("you-f", "بتِفهَمي")] };
  assert.equal(lentLabel(verb.subs[1], verb, ar), "you (feminine)");
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
  assert.deepEqual(GRAMMAR.number.options.map(([v]) => v), ["singular", "dual", "plural", "na"]);
  assert.equal(dimValues({ number: "dual" }).number, "dual");
  assert.equal(normDimValue(GRAMMAR.number, "dual"), "dual");
  assert.equal(normDimValue(GRAMMAR.number, "du"), "dual");
  /* Moved ahead of the plural in 0.400; what a stored or typed value
     means does not depend on where it sits. */
  for (const [given, means] of [["pl", "plural"], ["p", "plural"], ["pl.", "plural"], ["plurals", "plural"], ["d", "dual"], ["s", "singular"], ["sg", "singular"]]) {
    assert.equal(normDimValue(GRAMMAR.number, given), means, given);
  }
  /* And it is offered only where somebody counts in pairs: Huế declares
     no number at all, so nobody there is asked a question about a dual. */
  assert.ok(!LANGUAGES["vi-Hue"].grammar.includes("number"));
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
    ["ar2pick", "en2pick", "img2pick", "match", "recmatch"]);
});

/* --- listening exercises --- */

test("the listening exercises are exactly the ones prompted by audio, or made of it", () => {
  /* The grid of recordings plays nothing above it — each tile is a sound —
     and is no more answerable in silence than a question that does. */
  const byPrompt = TYPES.filter((t) => EX[t].promptField === "audio" || EX[t].tiles === "audio");
  const byHelper = TYPES.filter(isListening);
  assert.deepEqual(byHelper, byPrompt);
  /* Named so that adding another needs no second edit — but the ones that
     exist today should be exactly these. rec2ctx joined them by declaring
     an audio prompt and nothing else: the quiet window, the substitution
     and the "can't listen right now" button all picked it up unprompted,
     which is what deriving this from the prompt rather than a flag buys. */
  assert.deepEqual(byHelper, [
    "rec2en", "rec2img", "recmatch", "recfig", "recown", "rec2ar", "rec2attr", "rec2ctx",
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
  assert.deepEqual(fillsOf(thanks, kindOf(thanks, vi)).sort(), ["is-noun", "noun", "noun-is", "word"]);
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
    "ar2pick", "ar2en", "rec2en", "rec2img", "match", "recmatch", "recfig", "recown", "en2pick", "img2pick", "ctx2pick", "dlgwhole",
    /* Reading a number or a time and saying what it is, and picking one
       out of four, are recognition in exactly the sense the six above
       are: the answer is on the screen and nothing is written out. */
    "num2fig", "fig2pick", "rec2fig", "time2fig", "time2dial",
    /* And reading one of the ten figures a language writes them in. */
    "dig2fig",
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

test("ة and ه are two letters, whichever is written for the other", () => {
  /* Reported from 0.290: عندة for عندُه was marked right, because the fold
     that forgave ه for ة rode on the hamza leniency and worked both ways.
     Neither way is forgiven now; each is one letter off, a near miss. */
  const check = LANGUAGES["ar-PS"].check;
  const lenient = LANGUAGES["ar-PS"].marking;
  assert.equal(check("عندة", "عندُه", lenient).ok, false, "ة for ه is not right");
  assert.equal(check("عندة", "عندُه", lenient).reason, "near", "it is a misspelling of the word");
  assert.equal(check("شوبانه", "شَوْبانة", lenient).ok, false, "ه for ة is not right either");
  assert.equal(check("شوبانه", "شَوْبانة", lenient).reason, "near");
  assert.equal(check("شوبانة", "شَوْبانة", lenient).ok, true, "the word as spelt still is");
  assert.equal(check("اكل", "أكل", lenient).ok, true, "and the hamza leniency is untouched");
  assert.equal(arRootKey("مدرسة"), arRootKey("درس"), "a family is still gathered across ة");
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
  assert.deepEqual(TYPES.filter((t) => EX[t].hintTells), ["en2ar", "own2ar", "img2ar", "ctx2ar"]);
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
  /* Hebrew has no person-or-thing rule for agreement, but it is asked
     there too since 0.320: it is what gives a person or an animal a
     masculine and a feminine side. Still within the pack's list. */
  assert.deepEqual(dimsFor(LANGUAGES["he-IL"], "noun").map((d) => d.field), ["number", "gender", "human"]);
  assert.deepEqual(dimsFor(LANGUAGES["he-IL"], "person").map((d) => d.field), ["number", "gender"]);
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

test("a demonstrative agrees the way an adjective does, and is a subtype of its own", () => {
  const ar = LANGUAGES["ar-PS"];
  const cat = must(categoriesOf(ar).find((c) => c.id === "demonstrative"), "demonstrative");
  assert.equal(cat.table, "agreement", "the same forms an adjective lays out");
  assert.ok(!cat.retired, "offered to a teacher");
  assert.deepEqual(dimsFor(ar, "demonstrative"), [], "its number and gender are its table");
  assert.equal(agreementOf(ar, "demonstrative"), agreementOf(ar, "adjective"));
  assert.ok(agreementOf(LANGUAGES["he-IL"], "demonstrative"), "Hebrew's זה and זאת agree too");
  assert.equal(agreementOf(LANGUAGES["vi-Hue"], "demonstrative"), null, "nothing agrees in Huế");
  /* Its forms wait for the sentence to pick one, like an adjective's,
     unless the blank was linked to nothing — see blankAdmits. */
  const admits = blankAdmits(ar, () => [], () => true);
  assert.equal(admits({ category: "demonstrative" }, { row: "agreement" }, "this"), false);
  assert.equal(admits({ category: "demonstrative" }, {}, "this"), true);
  const alone = blankAdmits(ar, () => [], () => false, () => true);
  assert.equal(alone({ category: "demonstrative" }, { row: "agreement" }, "this"), true);
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

test("a noun blank can ask for the word itself, or only its forms with a pronoun on the end", () => {
  const ar = LANGUAGES["ar-PS"];
  const noun = { category: "noun" };
  const day = { ar: "يوم", en: "day" };
  const days = { ar: "أيام", en: "days", id: "pl" };
  const yourDay = { ar: "يومك", en: "your day", row: "attached", col: "you-m" };
  const yourDays = { ar: "أيامك", en: "your days", row: "attached", col: "you-m", of: "pl" };
  const bare = blankAdmits(ar, () => [BARE_ROW]);
  assert.equal(bare(noun, day, "noun"), true, "the word itself");
  assert.equal(bare(noun, days, "noun"), true, "and its other forms, such as the plural");
  assert.equal(bare(noun, yourDay, "noun"), false, "but no form with a pronoun on the end");
  const ends = blankAdmits(ar, () => ["attached"]);
  assert.equal(ends(noun, yourDay, "noun"), true);
  assert.equal(ends(noun, yourDays, "noun"), true, "the plural's endings as well as the word's");
  assert.equal(ends(noun, day, "noun"), false);
  assert.equal(ends({ category: "name" }, { ar: "رافائيل" }, "noun"), false, "a word with no endings has none to offer");
  /* And a blank that has not said takes both, which is every sentence
     written before the question was asked. */
  const open = blankAdmits(ar, () => []);
  assert.equal(open(noun, day, "noun"), true);
  assert.equal(open(noun, yourDay, "noun"), true);
  /* Beside a tense on the same blank, a verb is narrowed by the tense
     alone when the words are asked for bare. */
  const pastBare = blankAdmits(ar, () => [BARE_ROW, "past"]);
  const verb = { category: "verb" };
  assert.equal(pastBare(verb, { ar: "أكل", row: "past", col: "he" }, "word"), true);
  assert.equal(pastBare(verb, { ar: "بياكل", row: "present", col: "he" }, "word"), false);
  assert.equal(pastBare(noun, day, "word"), true);
  assert.equal(pastBare(noun, yourDay, "word"), false);
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

test("an agreeing card stands in a blank as its own word, unless the blank is linked to nothing", () => {
  const ar = LANGUAGES["ar-PS"];
  const lendsBig = lendsForm(ar, { category: "adjective" });
  assert.equal(lendsBig({ ar: "كبيرة", row: "agreement", col: "feminine" }), true, "every card lends its whole table");
  const big = { category: "adjective", forms: [
    { id: "big", ar: "كبير" },
    { id: "big-m", ar: "كبير", row: "agreement", col: "masculine" },
    { id: "big-f", ar: "كبيرة", row: "agreement", col: "feminine" },
  ] };
  const [own, m, f] = big.forms;
  const usual = blankAdmits(ar, () => []);
  assert.equal(usual(big, own, "adjective"), true, "the word");
  assert.equal(usual(big, f, "adjective"), false, "not a form the sentence picks");
  assert.equal(usual(big, { ar: "كبيرين", row: "" }, "adjective"), true, "a plain extra form still lends");
  const alone = blankAdmits(ar, () => [], () => false, () => true);
  assert.deepEqual([own, m, f].map((x) => alone(big, x, "adjective")), [false, true, true], "every form, the masculine once");
  const lendsBook = lendsForm(ar, { category: "noun" });
  assert.equal(lendsBook({ ar: "كتابي", row: "attached", col: "me" }), true, "the pronouns pick nothing, so they lend");
  assert.equal(lendsForm(ar, { category: "" })({ row: "agreement" }), true, "a card that says nothing lends everything");
  assert.equal(lendsForm(LANGUAGES["vi-Hue"], { category: "adjective" })({ row: "agreement" }), true, "nothing agrees in Huế");
  assert.equal(lendsForm(null, { category: "adjective" })({}), true);
});

test("Pronoun is retired where verbs change with the person, and offered where they do not", () => {
  const pronounIn = (/** @type {string} */ id) =>
    (/** @type {any} */ (LANGUAGES)[id].categories || []).find((/** @type {any} */ c) => c.id === "pronoun");
  assert.equal(!!(pronounIn("ar-PS") || {}).retired, true, "Arabic writes them on the Pronouns screen");
  assert.equal(!!(pronounIn("he-IL") || {}).retired, true, "and so does Hebrew");
  assert.equal(!!(pronounIn("vi-Hue") || {}).retired, false, "Huế's verbs have no columns to pick");
});

test("a blank that agrees with another takes a verb once per tense, and everything else as before", () => {
  const ar = LANGUAGES["ar-PS"];
  const verb = {
    category: "verb",
    forms: [
      { id: "eat", ar: "أكل", en: "to eat" },
      { id: "p-i", ar: "باكل", row: "present", col: "i" },
      { id: "p-she", ar: "بتاكل", row: "present", col: "she" },
      { id: "past-he", ar: "أكل", row: "past", col: "he" },
      { id: "past-she", ar: "أكلت", row: "past", col: "she" },
    ],
  };
  const beside = blankAdmits(ar, () => [], () => true);
  assert.equal(beside(verb, verb.forms[1], "verb"), true, "the cell that leads the present");
  assert.equal(beside(verb, verb.forms[2], "verb"), false, "and not the rest of the row: the sentence picks the person");
  assert.equal(beside(verb, verb.forms[3], "verb"), true, "each row leads with its own");
  assert.equal(beside(verb, verb.forms[4], "verb"), false);
  /* The dictionary form is Arabic's he-past, which the past row already
     lends: beside a pronoun it stands aside for that cell. Where the cited
     cell is blank there is nothing standing in for it, and it is left
     alone as every form in no row is. */
  assert.equal(beside(verb, verb.forms[0], "verb"), false, "the cited word stands aside for its cell");
  const uncited = { ...verb, forms: verb.forms.filter((f) => f.id !== "past-he") };
  assert.equal(beside(uncited, uncited.forms[0], "verb"), true);
  assert.equal(beside(verb, { id: "alt", ar: "أكل", en: "eat" }, "verb"), true, "another form in no row is untouched");
  assert.equal(beside({ category: "name" }, { ar: "رافائيل" }, "verb"), true, "a word with no tenses is untouched");
  /* Narrowed to a tense as well: the past's lead and nothing else. */
  const pastBeside = blankAdmits(ar, () => ["past"], () => true);
  assert.equal(pastBeside(verb, verb.forms[3], "verb"), true);
  assert.equal(pastBeside(verb, verb.forms[4], "verb"), false);
  assert.equal(pastBeside(verb, verb.forms[1], "verb"), false);
  /* A blank with nothing to agree with takes every cell in turn, which is
     every sentence written before this and every "{{verb}}!" since. */
  const alone = blankAdmits(ar, () => []);
  assert.equal(alone(verb, verb.forms[2], "verb"), true);
  const alonePerSlot = blankAdmits(ar, () => [], (slot) => slot === "verb");
  assert.equal(alonePerSlot(verb, verb.forms[2], "verb"), false);
  assert.equal(alonePerSlot(verb, verb.forms[2], "verb2"), true, "each blank's own answer");
  /* A lead kept out of sentences hands the row to the next cell lent. */
  const kept = { ...verb, forms: verb.forms.map((f) => (f.id === "p-i" ? { ...f, lend: false } : f)) };
  assert.equal(beside(kept, kept.forms[1], "verb"), false);
  assert.equal(beside(kept, kept.forms[2], "verb"), true);
});

test("a verb's cells that read alike in English say who, and when, in whole words", () => {
  /* Reported by a learner: "You understand" on both the masculine and the
     feminine, and a question asking for the feminine said nothing else. */
  const ar = LANGUAGES["ar-PS"];
  const cell = (/** @type {string} */ row, /** @type {string} */ col, /** @type {string} */ word, en = "You understand") =>
    ({ id: `u-${row}-${col}`, ar: word, en, lat: "", row, col });
  const card = { id: "u", ar: "", en: "", name: "to understand", category: "verb",
    subs: [cell("present", "you-m", "بتِفهَم"), cell("present", "you-f", "بتِفهَمي"),
      cell("present", "he", "بيِفهَم", "He understands")] };
  assert.equal(askLabel(card.subs[1], card, ar), "you (feminine)");
  assert.equal(askLabel(card.subs[0], card, ar), "you (masculine)");
  /* A cell whose English is its own still names nothing. */
  assert.equal(askLabel(card.subs[2], card, ar), "");
  const said = { ...card, subs: [cell("present", "you-m", "بتِفهَم", "you (m) understand"),
    cell("present", "you-f", "بتِفهَمي", "you (f) understand")] };
  assert.equal(askLabel(said.subs[1], said, ar), "");
  /* Two tenses reading alike name the tense; both differing names both. */
  const tensed = { ...card, subs: [cell("present", "he", "بيِفهَم", "He understood"), cell("past", "he", "فِهِم", "He understood"),
    cell("past", "she", "فِهْمَت", "He understood")] };
  assert.equal(askLabel(tensed.subs[0], tensed, ar), "present");
  assert.equal(askLabel(tensed.subs[1], tensed, ar), "past · he");
});

test("an exercise names grammar one way on every kind of card", () => {
  const ar = LANGUAGES["ar-PS"];
  const he = LANGUAGES["he-IL"];
  /* A noun with its plural: whole words, and only what tells them apart. */
  const teacher = { id: "t", ar: "معلم", en: "teacher", number: "singular", gender: "masculine",
    subs: [{ id: "t2", ar: "معلمين", en: "teachers", number: "plural", gender: "masculine" },
      { id: "t3", ar: "معلمة", en: "teacher", number: "singular", gender: "feminine" }] };
  assert.equal(askLabel(teacher.subs[0], teacher, ar), "plural");
  assert.equal(askLabel(teacher.subs[1], teacher, ar), "feminine");
  assert.equal(askLabel(teacher, teacher, ar), "masculine singular");
  /* Gender before number, where it takes both to tell it apart. */
  const both = { ...teacher, subs: teacher.subs.concat([{ id: "t4", ar: "معلمات", en: "teachers", number: "plural", gender: "feminine" }]) };
  assert.equal(askLabel(both.subs[2], both, ar), "feminine plural");
  /* And one alone where one is enough. */
  const pair = { ...teacher, subs: [{ id: "t4", ar: "معلمات", en: "teachers", number: "plural", gender: "feminine" }] };
  assert.equal(askLabel(pair.subs[0], pair, ar), "feminine");
  /* A lone noun says nothing, and a person-or-thing never shows. */
  const book = { id: "b", ar: "كتاب", en: "book", number: "singular", gender: "masculine", human: "thing", subs: [] };
  assert.equal(askLabel(book, book, ar), "");
  /* An adjective's shapes, in the column's words as before. */
  const shape = (/** @type {string} */ col) => ({ id: `big-${col}`, ar: "", en: "big", lat: "", row: "agreement", col });
  const big = { id: "big", ar: "كبير", en: "big", lat: "", category: "adjective", subs: [shape("feminine"), shape("plural")] };
  assert.equal(askLabel(shape("feminine"), big, ar), "feminine");
  assert.equal(askLabel(big, big, ar), "masculine");
  assert.equal(askLabel(shape("masc-plural"), big, he), "masculine plural");
  /* Huế declares no grammar, and says nothing. */
  const vi = LANGUAGES["vi-Hue"];
  assert.equal(askLabel({ id: "c", ar: "chó", en: "dog" }, { id: "c", ar: "chó", en: "dog", subs: [] }, vi), "");
});

test("the answer a learner wrote is named in whole words, against the others it could have been", () => {
  const ar = LANGUAGES["ar-PS"];
  const happy = { id: "h", en: "happy", answers: [
    { text: "مبسوط", lat: "mabsuut", gender: "masculine", number: "singular" },
    { text: "مبسوطة", lat: "mabsuuta", gender: "feminine", number: "singular" },
  ], ar: "مبسوط / مبسوطة", lat: "mabsuut / mabsuuta" };
  assert.equal(answerLabel(happy.answers[1], happy, ar), "feminine");
  assert.equal(answerLabel(happy.answers[0], happy, ar), "masculine");
  /* One answer: nothing it could be told from. */
  assert.equal(answerLabel({ text: "كتاب", gender: "masculine" }, { id: "b", ar: "كتاب", en: "book" }, ar), "");
});

test("each pack offers only the grammar its language has", () => {
  /* Arabic and Hebrew have two genders, and a teacher writing either was
     offered a third — "neutral" — because the choices were the app's and
     not the language's. They are the pack's now. */
  const values = (/** @type {string} */ id, /** @type {string} */ axis) =>
    must(dimsOf(LANGUAGES[id]).find((d) => d.field === axis), `${id} ${axis}`).options.map(([v]) => v);
  for (const id of ["ar-PS", "he-IL"]) {
    assert.deepEqual(values(id, "gender"), ["masculine", "feminine"], id);
  }
  /* Arabic has a plural a few nouns take only after three to ten — days,
     months — and Hebrew has none. */
  assert.deepEqual(values("ar-PS", "number"), ["singular", "dual", "plural", "counted", "na"]);
  assert.deepEqual(values("he-IL", "number"), ["singular", "dual", "plural", "na"]);
  /* It is a noun's, and offered on nothing else that is asked its number. */
  const offered = (/** @type {string} */ kind) =>
    must(dimsFor(LANGUAGES["ar-PS"], kind).find((d) => d.field === "number"), kind).options.map(([v]) => v);
  assert.ok(offered("noun").includes("counted"));
  for (const kind of ["pronoun", "person", "place", "name"]) {
    assert.deepEqual(offered(kind), ["singular", "dual", "plural", "na"], kind);
  }
  /* Not "pl. 3–10": beside "pl." that reads as the plural for three to
     ten, and "pl." as the one above ten, which is the singular. */
  assert.equal(labelFor({ number: "counted", gender: "masculine" }, LANGUAGES["ar-PS"]), "special pl. m.");
  /* And what is stored is never narrowed: a value outside the pack's list
     is still kept, and a tag still reads it. */
  assert.equal(dimValues({ gender: "neutral" }).gender, "neutral");
  assert.equal(labelFor({ gender: "neutral" }, LANGUAGES["ar-PS"]), "n.");
  /* One list of abbreviations, the axis's own: a number that does not
     apply names nothing on a tag. */
  assert.equal(labelFor({ number: "na", gender: "feminine" }, LANGUAGES["ar-PS"]), "f.");
  assert.equal(labelFor({ number: "plural", gender: "masculine" }, LANGUAGES["he-IL"]), "pl. m.");
});

test("Huế names who a form is said to, on phrases and never on a noun", () => {
  /* A greeting with a form for someone younger, a peer and an elder was
     three unlabelled forms, and a learner asked for one was not told
     which. The axis is Huế's, in its own address terms. */
  const vi = LANGUAGES["vi-Hue"];
  const said = must(dimsOf(vi).find((d) => d.field === "register"), "the addressee axis");
  assert.deepEqual(said.options.map(([, label]) => label),
    ["to someone younger (em)", "to a peer (anh / chị)", "to an elder (bác)"]);
  /* Asked of a phrase, which names no kind of word; never of a noun —
     chó is chó whoever is listening — nor of any other kind of word. */
  assert.deepEqual(dimsFor(vi, null).map((d) => d.field), ["register"]);
  for (const kind of ["noun", "verb", "adjective", "other"]) assert.deepEqual(dimsFor(vi, kind), [], kind);
  /* And a question names the one it wants, in those words. */
  const card = { id: "hi", ar: "", en: "", forms: [
    { id: "hi-em", ar: "chào em", en: "hello", lat: "", register: "em" },
    { id: "hi-peer", ar: "chào anh", en: "hello", lat: "", register: "peer" },
    { id: "hi-elder", ar: "chào bác", en: "hello", lat: "", register: "elder" },
  ] };
  assert.equal(askLabel(card.forms[2], card, vi), "to an elder (bác)");
  assert.equal(askLabel(card.forms[0], card, vi), "to someone younger (em)");
});

test("a person noted for gender and number is spelt out in full", () => {
  /* Hebrew's plural persons carry both — "you (f pl)" — and an exercise
     names them in words, as it does every other person. */
  const he = LANGUAGES["he-IL"];
  const cell = (/** @type {string} */ col, /** @type {string} */ word) =>
    ({ id: `e-${col}`, ar: word, en: "You eat", lat: "", row: "present", col });
  const card = { id: "e", ar: "", en: "", name: "to eat", category: "verb",
    subs: [cell("you-pl", "אוכלים"), cell("you-pl-f", "אוכלות")] };
  assert.equal(askLabel(card.subs[1], card, he), "you (feminine plural)");
  assert.equal(askLabel(card.subs[0], card, he), "you (masculine plural)");
  /* And an English answer is right without the note, or with it. */
  assert.ok(checkEn("you eat", "you (f pl) eat").ok);
  assert.ok(checkEn("you (f pl) eat", "you eat").ok);
});
