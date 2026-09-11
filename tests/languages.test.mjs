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
  normDimValue,
  arRootKey,
  arTokenIsWord,
  contextCoverage,
  EASY_TYPES,
  findWordSlot,
  GRAMMAR,
  guessKind,
  LANGUAGES,
  supportsContext,
  TYPES,
  EX,
  isListening,
} from "../src/languages.js";

test("Arabic: bare letters accepted, wrong harakat rejected, missing harakat depends on setting", () => {
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "either" }).ok, true);
  assert.equal(checkAr("كتاب", "كِتَاب", { tashkeel: "required" }).reason, "missing");
  assert.equal(checkAr("كُتَاب", "كِتَاب", { tashkeel: "either" }).reason, "harakat");
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
     retranslated by the arrival of a new one. */
  assert.equal(dimValues({ number: "singular" }).number, "singular");
  assert.equal(dimValues({ number: "plural" }).number, "plural");
});

test("an imported \"n/a\" lands on N/A", () => {
  assert.equal(normDimValue(GRAMMAR.number, "n/a"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "N/A"), "na");
  assert.equal(normDimValue(GRAMMAR.number, "na"), "na");
  /* And the two that were there before still win their own prefixes. */
  assert.equal(normDimValue(GRAMMAR.number, "pl"), "plural");
  assert.equal(normDimValue(GRAMMAR.number, "sing"), "singular");
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
  assert.deepEqual(byHelper, ["rec2en", "rec2ar", "rec2ctx", "rec2attr"]);
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
     conversation through is recognition too, and belongs with the other
     two: a beginner meeting a scene should be asked whether they can
     follow it before being asked to say any of it. Choosing a word out of a phrase is the same
     argument again: the gap-fill used to start at the hard half, so a
     learner's first meeting with a word in context was also their first
     chance to get it wrong. */
  assert.deepEqual(EASY_TYPES, ["ar2en", "rec2en", "ctx2pick", "dlgwhole"]);
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

test("what arSkeleton did, and why it could never have grouped anything", () => {
  /* It stripped harakat and folded hamza and stopped there, so every word
     kept its own spelling as its key. Kept because similarity still reads
     it; it is no longer what gathers a family. */
  assert.notEqual(arSkeleton("كتاب"), arSkeleton("كاتب"));
  assert.equal(must(LANGUAGES["ar-PS"].derived.find((d) => d.groups), "Arabic's grouping").compute, arRootKey);
});
