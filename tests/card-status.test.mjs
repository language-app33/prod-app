/*
 * A card's status, and its two versions — see "A card's status" in
 * server/api/courses.js.
 *
 * Draft, Ready for review and Published, and only a published card reaches
 * a student. Changing a published card from the card screen goes into its
 * unpublished changes, which students do not get until they are published;
 * a card's decks, ID and tags are one answer for both versions and apply
 * at once. Two saves to the same part of a card are not asked about: the
 * later one wins.
 *
 * Over the wire, against a server of its own, the way server.test.mjs is.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { must } from "./helpers.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "taleb-status-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "test-admin-key";
const { createApp } = await import("../server/index.js");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const at = server.address();
if (!at || typeof at === "string") throw new Error("expected a port");
const origin = `http://127.0.0.1:${at.port}`;

after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/**
 * @param {string} action
 * @param {{ key?: string, body?: unknown, query?: string }} [opts]
 */
async function api(action, { key, body, query = "" } = {}) {
  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  if (key) headers["x-key"] = key;
  const res = await fetch(`${origin}/api/courses?action=${action}${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }
  return { status: res.status, json, text };
}

/** @param {string} ar @param {string} en */
const word = (ar, en) => ({ id: "", lang: "ar-PS", forms: [{ ar, en, lat: "" }] });

/**
 * A teacher with a deck in a course, and a student in the course.
 * @param {string} name
 */
async function classroom(name) {
  const teacher = await api("signup", { body: { displayName: name } });
  const key = teacher.json.key;
  /* Courses are an administrator's to make. */
  await api("claim-admin", { key, body: { adminKey: "test-admin-key" } });
  const deck = await api("create-deck", { key, body: { title: "Lesson", lang: "ar-PS" } });
  const deckId = deck.json.deck.id;
  const course = await api("create-course", { key, body: { title: "Class", language: "ar-PS" } });
  await api("attach-deck", { key, body: { deckId, courseId: course.json.course.id } });
  const student = await api("signup", { body: { displayName: `${name}'s student` } });
  await api("assign-student", { key, body: { courseId: course.json.course.id, handle: student.json.user.handle } });
  return { key, deckId, courseId: course.json.course.id, studentKey: student.json.key };
}

/** What a student's device is sent, as one list of cards. */
/** @param {string} studentKey */
async function material(studentKey) {
  const got = await api("my-material", { key: studentKey });
  assert.equal(got.status, 200, got.text);
  return {
    version: got.json.version,
    cards: (got.json.cards || []).flatMap((/** @type {any} */ d) => d.cards),
  };
}

/** The card as the teacher's screens have it. */
/** @param {string} key @param {string} id */
async function teacherCard(key, id) {
  const got = await api("my-cards", { key });
  return must(got.json.cards.find((/** @type {any} */ c) => c.id === id), "the card in the teacher's list");
}

test("a card made as a draft reaches no student until it is published", async () => {
  const { key, deckId, studentKey } = await classroom("Huda");
  const made = await api("save-card", { key, body: { card: word("بيت", "house"), decks: [deckId], status: "draft" } });
  assert.equal(made.status, 200, made.text);
  assert.equal(made.json.card.status, "draft");
  const id = made.json.card.id;

  const before = await material(studentKey);
  assert.ok(!before.cards.some((/** @type {any} */ c) => c.id === id), "a draft is the teacher's");

  const review = await api("card-status", { key, body: { cardId: id, to: "review" } });
  assert.equal(review.json.card.status, "review");
  assert.ok(!(await material(studentKey)).cards.some((/** @type {any} */ c) => c.id === id),
    "and so is a card ready for review");

  const published = await api("card-status", { key, body: { cardId: id, to: "published" } });
  assert.equal(published.status, 200, published.text);
  assert.equal(published.json.card.status, "published");
  const after = await material(studentKey);
  assert.notEqual(after.version, before.version, "publishing is news to the student's device");
  const handed = must(after.cards.find((/** @type {any} */ c) => c.id === id), "the published card");
  assert.equal(handed.status, undefined, "published is what a card with no status is");
});

test("a card made without saying so is published, as every card always was", async () => {
  const { key, deckId, studentKey } = await classroom("Rami");
  const made = await api("save-card", { key, body: { card: word("قلم", "pen"), decks: [deckId] } });
  assert.equal(made.json.card.status, "published");
  assert.ok((await material(studentKey)).cards.some((/** @type {any} */ c) => c.id === made.json.card.id));
});

test("changes to a published card wait for publishing, and students keep the card they have", async () => {
  const { key, deckId, studentKey } = await classroom("Lina");
  const made = await api("save-card", { key, body: { card: word("باب", "door"), decks: [deckId] } });
  const card = made.json.card;
  const first = await material(studentKey);

  const changed = await api("save-card", {
    key,
    body: {
      card: { ...card, forms: [{ ...card.forms[0], en: "a door" }] },
      decks: [deckId],
      into: "changes",
      touched: ["forms"],
    },
  });
  assert.equal(changed.status, 200, changed.text);
  assert.equal(changed.json.card.forms[0].en, "a door", "the teacher sees what they wrote");
  assert.equal(changed.json.card.status, "published");
  assert.equal(changed.json.card.changes, "draft", "and that it is waiting");

  const still = await material(studentKey);
  assert.equal(still.version, first.version, "nothing a student has moved");
  const handed = must(still.cards.find((/** @type {any} */ c) => c.id === card.id), "the student's card");
  assert.equal(handed.forms[0].en, "door");
  assert.equal(handed.pending, undefined, "and the changes are not sent");

  const listed = await teacherCard(key, card.id);
  assert.equal(listed.forms[0].en, "a door");
  assert.equal(listed.changes, "draft");

  const ready = await api("card-status", { key, body: { cardId: card.id, to: "review" } });
  assert.equal(ready.json.card.status, "published", "the card stays published");
  assert.equal(ready.json.card.changes, "review", "its changes are ready for review");

  const out = await api("card-status", { key, body: { cardId: card.id, to: "published" } });
  assert.equal(out.json.card.changes, undefined, "nothing is waiting once they are out");
  const later = await material(studentKey);
  assert.notEqual(later.version, first.version);
  assert.equal(must(later.cards.find((/** @type {any} */ c) => c.id === card.id), "the card").forms[0].en, "a door");
});

test("changes can be thrown away, and a card that comes back to what students have has none", async () => {
  const { key, deckId } = await classroom("Omar");
  const card = (await api("save-card", { key, body: { card: word("شمس", "sun"), decks: [deckId] } })).json.card;
  const changed = (await api("save-card", {
    key,
    body: { card: { ...card, note: "bright" }, decks: [deckId], into: "changes", touched: ["note"] },
  })).json.card;
  assert.equal(changed.changes, "draft");
  const discarded = await api("card-status", { key, body: { cardId: card.id, to: "discard" } });
  assert.equal(discarded.json.card.note, "");
  assert.equal(discarded.json.card.changes, undefined);

  /* Written and then put back by hand: nothing is waiting. */
  const again = (await api("save-card", {
    key,
    body: { card: { ...card, note: "bright" }, decks: [deckId], into: "changes", touched: ["note"] },
  })).json.card;
  const back = await api("save-card", {
    key,
    body: { card: { ...again, note: "" }, decks: [deckId], into: "changes", touched: ["note"] },
  });
  assert.equal(back.json.card.changes, undefined, "changes that come to nothing are no changes");

  const refused = await api("card-status", { key, body: { cardId: card.id, to: "review" } });
  assert.equal(refused.status, 400, "a published card with nothing waiting has no changes to mark");
});

test("the header applies at once, whatever is waiting", async () => {
  const { key, deckId, studentKey } = await classroom("Dina");
  const card = (await api("save-card", { key, body: { card: word("قطة", "cat"), decks: [deckId] } })).json.card;
  const first = await material(studentKey);
  const tagged = await api("save-card", {
    key,
    body: { card: { ...card, fills: ["animal"], ref: "cat" }, decks: [deckId], into: "changes", touched: ["fills", "ref"]},
  });
  assert.equal(tagged.status, 200, tagged.text);
  assert.equal(tagged.json.card.changes, undefined, "a tag is not a change to publish");
  const later = await material(studentKey);
  assert.notEqual(later.version, first.version, "students' devices hear about it");
  const handed = must(later.cards.find((/** @type {any} */ c) => c.id === card.id), "the card");
  assert.deepEqual(handed.fills, ["animal"]);
  assert.equal(handed.ref, "cat");

  /* A deck left out of what a save touched is left alone. */
  const kept = await api("save-card", {
    key,
    body: { card: { ...tagged.json.card, note: "meows" }, decks: [], into: "changes", touched: ["note"] },
  });
  assert.deepEqual(kept.json.card.decks, [deckId], "a save naming its fields does not take the card out of its decks");
});

test("the card screen sends the whole card: its words wait, its ID and tags apply at once", async () => {
  const { key, deckId, studentKey } = await classroom("Sami");
  const card = (await api("save-card", { key, body: { card: word("ماء", "water"), decks: [deckId] } })).json.card;
  const first = await material(studentKey);
  const saved = await api("save-card", {
    key,
    body: {
      card: { ...card, forms: [{ ...card.forms[0], en: "the water" }], fills: ["drink"], ref: "water" },
      decks: [deckId],
      into: "changes",
    },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.json.card.forms[0].en, "the water", "the teacher sees what they wrote");
  assert.equal(saved.json.card.changes, "draft", "and that it is waiting");
  const later = await material(studentKey);
  assert.notEqual(later.version, first.version, "the tag and the ID reach students' devices");
  const handed = must(later.cards.find((/** @type {any} */ c) => c.id === card.id), "the card");
  assert.equal(handed.forms[0].en, "water", "the words wait");
  assert.deepEqual(handed.fills, ["drink"]);
  assert.equal(handed.ref, "water");
});

test("two saves to one part of a card: the later one wins, without asking", async () => {
  const { key, deckId } = await classroom("Hadi");
  const card = (await api("save-card", { key, body: { card: word("نار", "fire"), decks: [deckId], status: "draft" } })).json.card;
  const one = await api("save-card", {
    key,
    body: { card: { ...card, note: "hot" }, decks: [deckId], into: "changes" },
  });
  assert.equal(one.status, 200, one.text);
  const two = await api("save-card", {
    key,
    body: { card: { ...card, note: "warm" }, decks: [deckId], into: "changes" },
  });
  assert.equal(two.status, 200, two.text);
  assert.equal(two.json.card.note, "warm");
});

test("a save from another screen writes what students have, and the changes keep it", async () => {
  const { key, deckId, studentKey } = await classroom("Maha");
  const card = (await api("save-card", { key, body: { card: word("ولد", "boy"), decks: [deckId] } })).json.card;
  const changed = (await api("save-card", {
    key,
    body: { card: { ...card, forms: [{ ...card.forms[0], en: "a boy" }] }, decks: [deckId], into: "changes", touched: ["forms"]},
  })).json.card;

  /* The Pronouns screen, say: a field of its own, straight to students. */
  const direct = await api("save-card", {
    key,
    body: { card: { ...changed, clue: "young" }, decks: [deckId], touched: ["clue"]},
  });
  assert.equal(direct.status, 200, direct.text);
  const handed = must((await material(studentKey)).cards.find((/** @type {any} */ c) => c.id === card.id), "the card");
  assert.equal(handed.clue, "young", "students have it");
  assert.equal(handed.forms[0].en, "boy", "and not the changes");
  assert.equal(direct.json.card.clue, "young", "the changes have it too");
  assert.equal(direct.json.card.forms[0].en, "a boy");

  await api("card-status", { key, body: { cardId: card.id, to: "published" } });
  const later = must((await material(studentKey)).cards.find((/** @type {any} */ c) => c.id === card.id), "the card");
  assert.equal(later.clue, "young", "publishing the changes does not undo it");
  assert.equal(later.forms[0].en, "a boy");
});

test("a rename reaches both versions of a card that uses the name", async () => {
  const { key, deckId, studentKey } = await classroom("Yara");
  const sentence = (await api("save-card", {
    key,
    body: { card: { ...word("{{pet}} نايم", "{{pet}} is asleep"), sentence: true }, decks: [deckId] },
  })).json.card;
  const changed = (await api("save-card", {
    key,
    body: {
      card: { ...sentence, note: "a quiet one" },
      decks: [deckId], into: "changes", touched: ["note"],
    },
  })).json.card;
  assert.equal(changed.changes, "draft");

  const walked = await api("save-card", {
    key,
    body: { card: { id: sentence.id }, decks: [], walk: { renames: [{ from: "pet", to: "animal" }] } },
  });
  assert.equal(walked.status, 200, walked.text);
  assert.equal(walked.json.card.forms[0].en, "{{animal}} is asleep", "the changes are renamed");
  assert.equal(walked.json.card.note, "a quiet one", "and keep what was waiting");
  assert.deepEqual(walked.json.card.decks, [deckId], "and its decks");
  const handed = must((await material(studentKey)).cards.find((/** @type {any} */ c) => c.id === sentence.id), "the sentence");
  assert.equal(handed.forms[0].en, "{{animal}} is asleep", "and so is what students have");
  assert.equal(handed.note, "", "without the changes");
});

test("unpublishing takes a card from students and keeps the teacher's work as a draft", async () => {
  const { key, deckId, studentKey } = await classroom("Nasser");
  const card = (await api("save-card", { key, body: { card: word("كلب", "dog"), decks: [deckId] } })).json.card;
  await api("save-card", {
    key,
    body: { card: { ...card, note: "barks" }, decks: [deckId], into: "changes", touched: ["note"] },
  });
  const first = await material(studentKey);
  assert.ok(first.cards.some((/** @type {any} */ c) => c.id === card.id));

  const off = await api("card-status", { key, body: { cardId: card.id, to: "unpublish" } });
  assert.equal(off.status, 200, off.text);
  assert.equal(off.json.card.status, "draft");
  assert.equal(off.json.card.note, "barks", "the changes are what the draft is");
  assert.equal(off.json.card.changes, undefined);

  const later = await material(studentKey);
  assert.notEqual(later.version, first.version);
  assert.ok(!later.cards.some((/** @type {any} */ c) => c.id === card.id), "gone from the student");

  /* A draft card saved from the card screen is written as itself. */
  const edited = await api("save-card", {
    key,
    body: { card: { ...off.json.card, note: "barks loudly" }, decks: [deckId], into: "changes", touched: ["note"] },
  });
  assert.equal(edited.json.card.note, "barks loudly");
  assert.equal(edited.json.card.changes, undefined, "a draft has no second version");
});

test("a draft fills no student's blank", async () => {
  const { key, deckId, studentKey } = await classroom("Rana");
  await api("save-card", {
    key,
    body: { card: { ...word("{{fruit}} طيب", "{{fruit}} is tasty"), sentence: true }, decks: [deckId] },
  });
  const apple = (await api("save-card", {
    key,
    body: { card: { ...word("تفاحة", "apple"), fills: ["fruit"] }, decks: [], status: "draft" },
  })).json.card;
  const pear = (await api("save-card", {
    key,
    body: { card: { ...word("إجاصة", "pear"), fills: ["fruit"] }, decks: [] },
  })).json.card;
  const sent = (await material(studentKey)).cards;
  assert.ok(sent.some((/** @type {any} */ c) => c.id === pear.id), "a published value goes with the sentence");
  assert.ok(!sent.some((/** @type {any} */ c) => c.id === apple.id), "a draft does not");
});

test("an import is Ready for review: a new card is, and a published card's changes are", async () => {
  const { key, deckId, studentKey } = await classroom("Nour");
  const made = await api("save-card", { key, body: { card: word("بيت", "house"), decks: [deckId], status: "review" } });
  assert.equal(made.json.card.status, "review");
  assert.ok(!(await material(studentKey)).cards.some((/** @type {any} */ c) => c.id === made.json.card.id),
    "no student has it");

  const card = (await api("save-card", { key, body: { card: word("كتاب", "book"), decks: [deckId] } })).json.card;
  const replaced = await api("save-card", {
    key,
    body: { card: { ...card, forms: [{ ...card.forms[0], en: "a book" }] }, decks: [deckId], status: "review" },
  });
  assert.equal(replaced.json.card.status, "published", "the card stays published");
  assert.equal(replaced.json.card.changes, "review", "and the import waits as its changes");
  const handed = must((await material(studentKey)).cards.find((/** @type {any} */ c) => c.id === card.id), "the card");
  assert.equal(handed.forms[0].en, "book");
});
