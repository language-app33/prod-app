/*
 * A verb's subjunctive, practised in its own examples, and the three words
 * its English is put together from.
 *
 * English has no subjunctive, so a form like تاكل has no English of its
 * own: لازم تاكل is *she must eat*, بدي تاكل *I want her to eat*. These
 * hold the three halves of that together — the words a sentence's English
 * uses for it, the examples a verb card practises it in, and the rule that
 * such a form is asked inside those examples and nowhere else.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";

import {
  fillForm, foldReadings, personEnglish, slotTrouble, slotsOf, verbBlankOf, verbPlain, verbReading,
} from "../src/variables.ts";
import {
  MAX_EXAMPLES, SOMEONE_WISHES, exampleCells, exampleTrouble, examplesRowOf, filledExample, inExamplesRow, othersOf,
  readExample, sentenceOf, verbExamplesOf, wishOf,
} from "../src/examples.ts";
import { buildContextIndex } from "../src/context-index.ts";
import { canAsk, EXAMPLE_TYPES } from "../src/offers.ts";
import { EX, LANGUAGES, TYPES, tensedOf, verbOf } from "../src/languages.ts";
import { personsOf } from "../src/verbs.ts";

const ar = LANGUAGES["ar-PS"];
const spec = must(tensedOf(ar, "verb"), "Arabic verbs");

/* A verb with three of its subjunctive forms written, and one example. */
const subj = (/** @type {string} */ col, /** @type {string} */ word, /** @type {string} */ lat) =>
  ({ id: `eat-s-${col}`, ar: word, en: "", lat, row: "subjunctive", col });
const eat = {
  id: "eat", lang: "ar-PS", category: "verb", name: "to eat", tags: [], created: 1,
  forms: [
    { id: "eat", ar: "أكل", en: "he ate", lat: "akal" },
    { id: "eat-p-he", ar: "أكل", en: "he ate", lat: "akal", row: "past", col: "he" },
    subj("i", "آكل", "aakul"),
    subj("she", "تاكل", "taakul"),
    subj("you-m", "تاكل", "taakul"),
    subj("we", "ناكل", "naakul"),
  ],
  examples: [
    { ar: "لازم {{verb}}", lat: "laazim {{verb}}", en: "{{verb-who}} must {{verb-plain}}" },
    { ar: "بدي {{verb}}", en: "I want {{verb-to}}", wish: "i" },
  ],
};

test("the three words read a subjunctive the way English says it", () => {
  const she = { ar: "تاكل", en: "", lat: "taakul", col: "she", plain: "eat" };
  assert.equal(verbReading(she, "who"), "she");
  assert.equal(verbReading(she, "plain"), "eat");
  assert.equal(verbReading(she, "to"), "to eat", "nobody else wanting: her own wish");
  assert.equal(verbReading(she, "to", "i"), "her to eat");
  assert.equal(verbReading(she, "to", "she"), "to eat");
  /* The speaker is one person whichever column: I (m) and I (f). */
  const me = { ar: "آكل", en: "", lat: "", col: "i-f", plain: "eat" };
  assert.equal(verbReading(me, "to", "i"), "to eat");
  assert.equal(verbReading(me, "who"), "I");
  /* A value the words cannot be made for reads as its own English. */
  assert.equal(verbReading({ ar: "x", en: "Raphael", lat: "" }, "who"), "Raphael");
  assert.equal(verbPlain("to eat"), "eat");
  assert.equal(verbPlain("eat"), "eat");
  assert.equal(must(personEnglish("you-f"), "you (f)").who, "you (f)");
  assert.equal(personEnglish("me"), null, "a pronoun on the end is not a subject");
});

test("every column the Arabic verb table has can be said in English", () => {
  /* The persons are read by the app's own column ids, so a pack adding a
     column has to add it there too. */
  for (const person of personsOf(verbOf(ar))) {
    assert.ok(personEnglish(person.id), person.id);
  }
});

test("a sentence's English reads its verb blank through the three words", () => {
  const frame = { ar: "لازم {{verb}}", en: "{{verb-who}} must {{verb-plain}}", lat: "laazim {{verb}}" };
  /* One blank, not three: the words are how the English reads it. */
  assert.deepEqual(slotsOf(frame), ["verb"]);
  assert.equal(slotTrouble(frame), null, "and the three fields agree about it");
  const she = { id: "s", ar: "تاكل", en: "", lat: "taakul", col: "she", plain: "eat" };
  const filled = fillForm(frame, { verb: she });
  assert.equal(filled.ar, "لازم تاكل");
  assert.equal(filled.en, "She must eat");
  assert.equal(filled.lat, "laazim taakul");
  /* Whose wish it is, for {{verb-to}}: the sentence says. */
  const want = { ar: "بدي {{verb}}", en: "I want {{verb-to}}", lat: "", wish: { verb: "i" } };
  assert.equal(fillForm(want, { verb: she }).en, "I want her to eat");
  assert.equal(fillForm(want, { verb: { ...she, col: "i" } }).en, "I want to eat");
  /* And nothing said is the verb's own person. */
  const { wish: _w, ...unsaid } = want;
  assert.equal(fillForm(unsaid, { verb: she }).en, "I want to eat");
  /* A blank named like a reading, with no blank of that name, is a blank
     of its own. */
  assert.equal(verbBlankOf("x-to", ["y"]), "");
  assert.deepEqual(foldReadings(["x-to"]), ["x-to"]);
  assert.deepEqual(foldReadings(["verb", "verb-to", "verb-who"]), ["verb"]);
});

test("the subjunctive is the row practised in examples, and only in Arabic", () => {
  assert.equal(examplesRowOf(spec), "subjunctive");
  assert.equal(examplesRowOf(tensedOf(LANGUAGES["vi-Hue"], "verb")), "");
  assert.equal(examplesRowOf(tensedOf(LANGUAGES["he-IL"], "verb")), "");
  assert.ok(inExamplesRow(spec, subj("she", "تاكل", "")));
  assert.ok(!inExamplesRow(spec, { row: "present", col: "she" }));
});

test("an example says what is wrong with it, in the teacher's words", () => {
  assert.equal(exampleTrouble({ ar: "", en: "" }), "", "a blank example is not there");
  assert.equal(exampleTrouble(eat.examples[0]), "");
  assert.equal(exampleTrouble(eat.examples[1]), "");
  assert.match(exampleTrouble({ ar: "لازم", en: "{{verb-who}} must eat" }), /verb gap in the Arabic once/);
  assert.match(exampleTrouble({ ar: "{{verb}} {{verb}}", en: "{{verb-who}} must eat" }), /once/);
  assert.match(exampleTrouble({ ar: "لازم {{verb}}", lat: "laazim", en: "{{verb-who}} must eat" }), /transliteration/);
  assert.match(exampleTrouble({ ar: "لازم {{verb}}", en: "" }), /English/);
  /* English that comes out the same for every person teaches nothing. */
  assert.match(exampleTrouble({ ar: "لازم {{verb}}", en: "I must eat" }), /changes with the person/);
  assert.match(exampleTrouble({ ar: "لازم {{verb}}", en: "{{verb-plain}} now" }), /changes with the person/);
  assert.match(exampleTrouble({ ar: "لازم {{verb}}", en: "{{verb}} must" }), /person, verb or to \+ verb/);
  assert.match(exampleTrouble({ ar: "لازم {{name}} {{verb}}", en: "{{verb-who}} must" }), /only gap/);
});

test("a card's examples are read as written, three at most", () => {
  const many = { examples: [1, 2, 3, 4].map((n) => ({ ar: `x${n} {{verb}}`, en: "{{verb-who}} x" })) };
  assert.equal(verbExamplesOf(many).length, MAX_EXAMPLES);
  assert.deepEqual(verbExamplesOf({ examples: "nonsense" }), []);
  assert.deepEqual(verbExamplesOf({}), []);
  assert.equal(wishOf(eat.examples[0], spec), "", "nobody wants in “must”");
  assert.equal(wishOf({ ar: "بدها {{verb}}", en: "she wants {{verb-to}}" }, spec), "i", "the speaker until somebody chooses");
  assert.equal(wishOf({ ar: "بدها {{verb}}", en: "she wants {{verb-to}}", wish: "she" }, spec), "she");
});

test("each example is met once for every subjunctive form, in its own person", () => {
  const cells = exampleCells(eat, spec);
  assert.deepEqual(cells.map((c) => c.col), ["i", "you-m", "she", "we"], "in the order the table lists them");
  const at = (/** @type {string} */ col, /** @type {number} */ n) =>
    filledExample(eat, must(cells.find((c) => c.col === col), col), eat.examples[n], spec);
  assert.deepEqual(at("i", 0), { ar: "لازم آكل", en: "I must eat", lat: "laazim aakul" });
  assert.deepEqual(at("she", 0), { ar: "لازم تاكل", en: "She must eat", lat: "laazim taakul" });
  assert.equal(at("you-m", 0).en, "You (m) must eat");
  assert.equal(at("i", 1).en, "I want to eat");
  assert.equal(at("we", 1).en, "I want us to eat");
  assert.equal(at("we", 1).lat, "", "no transliteration where the example has none");
});

test("the examples are where a subjunctive form turns up, with its gap where the verb goes", () => {
  const index = buildContextIndex([eat], ar);
  const she = index.get("eat-s-she") || [];
  assert.equal(she.length, 2, "both examples");
  assert.deepEqual(
    she.map((c) => ({ id: c.id, ar: c.ar, en: c.en, slot: c.slot, span: c.span, example: c.example })),
    [
      { id: "eat~ex0", ar: "لازم تاكل", en: "She must eat", slot: 1, span: 1, example: 0 },
      { id: "eat~ex1", ar: "بدي تاكل", en: "I want her to eat", slot: 1, span: 1, example: 1 },
    ],
  );
  assert.equal(she[0].lat, "laazim taakul");
  assert.equal((index.get("eat-p-he") || []).length, 0, "the other tenses are asked as words, as before");
  /* A verb with no examples has none. */
  const { examples: _e, ...bare } = eat;
  assert.equal((buildContextIndex([bare], ar).get("eat-s-she") || []).length, 0);
});

test("a subjunctive form is asked inside its examples and nowhere else", () => {
  const index = buildContextIndex([eat], ar);
  const unit = must(eat.forms.find((f) => f.id === "eat-s-she"), "she");
  const on = { unit, scene: null, contexts: index.get(unit.id) || [], mates: 8 };
  const asked = TYPES.filter((t) => canAsk(on, t, ar));
  assert.deepEqual(asked, ["ex2en", "ctx2pick", "ctx2ar"], "meaning, then picked out, then written");
  assert.ok(asked.every((t) => EXAMPLE_TYPES.includes(t)));
  /* Its levels climb as every other form's do: 1, 2, 4. */
  assert.deepEqual(asked.map((t) => EX[t].level), [1, 2, 4]);
  /* Even with an English of its own left over from before, it is not
     asked as a word. */
  const old = { ...unit, en: "(that) she eat" };
  assert.ok(!canAsk({ ...on, unit: old }, "ar2en", ar));
  assert.ok(!canAsk({ ...on, unit: old }, "en2ar", ar));
  /* With no examples, there is nothing to ask it at all. */
  assert.deepEqual(TYPES.filter((t) => canAsk({ ...on, contexts: [] }, t, ar)), []);
  /* And the example question is asked of nothing else: a word in a phrase
     somebody wrote is asked about the word. */
  const word = { id: "w", ar: "كتاب", en: "book", lat: "", recs: [] };
  const phrase = [{ id: "p", ar: "هاد كتاب", en: "this is a book", recs: [], slot: 1, span: 1 }];
  assert.ok(!canAsk({ unit: word, scene: null, contexts: phrase, mates: 8 }, "ex2en", ar));
  assert.ok(canAsk({ unit: word, scene: null, contexts: phrase, mates: 8 }, "ctx2ar", ar));
});

/* ---- written as a sentence ----

   A teacher writes an example as they would say it, for one person, and
   the app reads the gap and the three words out of it. What it reads is
   stored the way an example always was, so everything that asks one is
   unchanged; these hold the reading to the cases the owner was shown. */

const forms = exampleCells({
  forms: [
    {},
    subj("i", "آكل", "aakul"),
    subj("you-m", "تاكل", "taakul"),
    subj("you-f", "تاكلي", "taakli"),
    subj("she", "تاكل", "taakul"),
    subj("we", "ناكل", "naakul"),
  ],
}, spec);
const read = (/** @type {string} */ arText, /** @type {string} */ en, lat = "") =>
  readExample({ ar: arText, lat, en }, forms, "to eat", spec);
const kept = (/** @type {ReturnType<typeof read>} */ r) => must(r.ok, r.trouble || "not read");

test("a sentence said for one person is read as the example it is", () => {
  assert.deepEqual(kept(read("لازم تاكلي", "you must eat", "laazim taakli")), {
    ar: "لازم {{verb}}", lat: "laazim {{verb}}", en: "{{verb-who}} must {{verb-plain}}", as: "you-f",
  });
  /* Somebody else's wish: whoever says it wants, and the rest are told. */
  assert.deepEqual(kept(read("بدي تاكل", "I want her to eat")),
    { ar: "بدي {{verb}}", en: "I want {{verb-to}}", wish: "i", as: "she" });
  assert.deepEqual(kept(read("بدها آكل", "She wants me to eat")),
    { ar: "بدها {{verb}}", en: "She wants {{verb-to}}", wish: "she", as: "i" });
  /* Their own: the one who wants is the one who eats, and بدها stays. */
  assert.deepEqual(kept(read("بدي آكل", "I want to eat")),
    { ar: "بدي {{verb}}", en: "I want {{verb-to}}", wish: "i", as: "i" });
  assert.equal(kept(read("بدك تاكل؟", "Do you want to eat?")).as, "you-m", "“you” settles تاكل");
  assert.equal(kept(read("بدها تاكل", "Layla wants to eat")).as, "she", "a name is somebody else");
  /* Somebody nobody in the table is: every person is told. */
  assert.equal(kept(read("إمي بدها آكل", "Mum wants me to eat")).wish, SOMEONE_WISHES);
  assert.deepEqual(kept(read("ممكن آكل؟", "Can I eat?")),
    { ar: "ممكن {{verb}}؟", en: "Can {{verb-who}} {{verb-plain}}?", as: "i" });
  /* Harakat and a different hamza are the same form. */
  assert.equal(kept(read("لازم تَاكُلي", "you (f) must eat")).as, "you-f");
  /* What it reads is an example as one has always been. */
  for (const r of [read("لازم تاكلي", "you must eat", "laazim taakli"), read("بدي تاكل", "I want her to eat")]) {
    assert.equal(exampleTrouble(kept(r)), "");
  }
});

test("a sentence the app cannot read says what it is missing, in the teacher's words", () => {
  assert.equal(read("", "").trouble, "", "a blank example is not there");
  assert.match(read("", "she must eat").trouble, /in Arabic/);
  assert.match(readExample({ ar: "لازم تاكل", en: "she must eat" }, [], "to eat", spec).trouble, /forms above first/);
  /* بتاكل is the present: nothing glued on is peeled off. */
  assert.match(read("لازم بتاكل", "she must eat").trouble, /one of the forms above/);
  assert.match(read("تاكل ولا ناكل", "she eats").trouble, /once/);
  assert.match(read("لازم تاكل", "").trouble, /means in English/);
  assert.equal(read("لازم تاكل", "I must eat").trouble, "The English says “I”, but تاكل is “you (m)” or “she”.");
  assert.match(read("بدي آكل", "I want her to eat").trouble, /says “her”, but آكل is “I”/);
  assert.match(read("لازم تاكل", "Must eat").trouble, /Say who/);
  assert.equal(read("لازم تاكل", "she must leave").trouble, "Write the verb in the English as “eat” or “to eat”.");
  assert.match(read("لازم تاكل", "she must eat", "laazim takul").trouble, /transliteration as it is above: taakul/);
  assert.match(readExample({ ar: "لازم تاكل", en: "she must eat" }, forms, "", spec).trouble, /name/);
});

test("an example reads back as it was written, and for the others as they will be asked", () => {
  const mine = kept(read("بدي تاكل", "I want her to eat"));
  assert.deepEqual(sentenceOf(mine, forms, "to eat", spec), { ar: "بدي تاكل", en: "I want her to eat", lat: "" });
  /* Two others, never the one it was written for nor its twin by letters. */
  assert.deepEqual(othersOf(mine, forms, "to eat", spec).map((o) => `${o.ar} — ${o.en}`),
    ["بدي آكل — I want to eat", "بدي تاكلي — I want you (f) to eat"]);
  /* And read again, it is the same example: editing one changes nothing
     it was not asked to. */
  for (const r of [read("لازم تاكلي", "you must eat", "laazim taakli"), read("بدها آكل", "She wants me to eat"),
    read("إمي بدها آكل", "Mum wants me to eat"), read("بدي آكل", "I want to eat")]) {
    const once = kept(r);
    assert.deepEqual(kept(readExample(sentenceOf(once, forms, "to eat", spec), forms, "to eat", spec)), once);
  }
  /* One from before it was kept who it was for reads in the first person
     written, and one with no form to put in it keeps its gap as "…". */
  assert.equal(sentenceOf(eat.examples[0], forms, "to eat", spec).en, "I must eat");
  assert.deepEqual(sentenceOf(eat.examples[0], [], "to eat", spec), { ar: "لازم …", lat: "laazim …", en: "… must …" });
  assert.equal(verbExamplesOf({ examples: [{ ...mine }] })[0].as, "she", "and who it was for is kept on the card");
});
