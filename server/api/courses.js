/** @import { Card, Course, Deck, User } from "../../src/types.ts" */
/**
 * The document store, as store.js hands it over. Named rather than repeated
 * at every helper below.
 * @typedef {ReturnType<typeof getStore>} Store
 */
import { getStore } from "../store.js";
import { createHash, randomBytes } from "node:crypto";
/* The one list of grammatical fields a card may carry, shared with the app so
   that adding an axis to a language does not silently drop it here. */
import { answerFields, grammarFields } from "../../src/languages.ts";
import { answersOf } from "../../src/answers.ts";
import { cardRef, fillNames, fillsOf, isSentence, MAX_FILLS, slotName, slotsOf } from "../../src/variables.ts";
import { isDialog } from "../../src/dialogs.ts";
import { formsOf } from "../../src/cards.ts";
/* And which tenses a sentence's blanks ask their verbs for, read the one
   way the app reads it. */
import { slotRows } from "../../src/verbs.ts";
import { holedParts, isSentenceKey, reviewOf } from "../../src/review.ts";
/* A number system and a time system are read at this boundary the way an
   answer is: hand-written, total, and silent about why. See
   src/numbers/schema.ts, and DECISIONS.md on why not a schema library. */
import { clipsOfSystem, emptyNumberSystem, readNumberSystem, readTimeSystem } from "../../src/numbers/schema.ts";
import { composerFor } from "../../src/numbers/index.ts";
import { migrateCards } from "../../src/numbers/migrate.ts";
import { liftSubtypeTagsIn } from "../../src/subtype-tags.ts";

/*
 * Courses, decks and the people who use them.
 *
 * Identity:
 *   handle       sara-4f2a   public, permanent, what rosters point at
 *   displayName  Sara        public, editable, cosmetic
 *   sign-in key  five words  secret, and the only credential there is
 *
 * The key signs you in on any device and is what your devices share. Only
 * its digest is stored, so it can't be read back — but an admin can issue
 * a replacement against a handle, which is the whole reason identity is
 * kept here rather than derived on the device.
 *
 * Roles are not properties of a person. Admin is a flag; teaching and
 * studying are memberships of a course. The same person can teach one
 * course and study another.
 */

const STORE = "arabic-courses";
const MAX_CLIP_BYTES = 1024 * 1024;
/* An image, as the data URL the editor sends. The editor shrinks a photo
   to a long side of 1024 pixels before it leaves the device, which puts an
   ordinary one at a few hundred kilobytes; this leaves room for a detailed
   one and refuses a camera original sent whole. */
const MAX_IMAGE_BYTES = 1536 * 1024;
/* The only kinds of picture kept: what every browser draws. Checked on the
   data URL's own header, so an image key cannot be used to park anything
   else on the server. */
const IMAGE_DATA = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const WORDS = [
  "amber", "cedar", "harbour", "lantern", "meadow", "quartz", "raven", "saffron",
  "thistle", "velvet", "willow", "cobalt", "ember", "fjord", "gable", "indigo",
  "juniper", "kestrel", "larch", "mistral", "nimbus", "opal", "pewter", "rowan",
  "sorrel", "tamarind", "umber", "verbena", "yarrow", "zephyr",
];

/** @type {(s: unknown) => string} */
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");

/* Errors that mean the data directory is missing, read-only or full,
   rather than anything about the request: on a host where the volume was
   never mounted, this is what every call fails with. */
const STORAGE_ERRORS = new Set(["EACCES", "EROFS", "ENOSPC", "ENOTDIR", "EPERM", "EDQUOT"]);

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/* Five words. Roughly 24 bits per word from a 30-word list is thin, so the
   words carry a numeric tail as well. */
function makeKey() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

function makeCode() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  return `${pick()}-${pick()}-${randomBytes(2).toString("hex")}`;
}

/* A handle is chosen once from the display name and never changes, because
   rosters and memberships point at it. */
/**
 * @param {string} displayName
 * @param {string[]} taken
 */
function makeHandle(displayName, taken) {
  const base =
    String(displayName || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "user";
  for (let i = 0; i < 40; i++) {
    const handle = `${base}-${randomBytes(2).toString("hex")}`;
    if (!taken.includes(handle)) return handle;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

/*
 * The fields a card carried before 0.138, cleared when one is saved.
 *
 * A card was its own first form: the word, its recordings and its grammar
 * sat on the card, and its other forms in `subs` beside it. One `forms`
 * list replaced both, and a save that spread the stored record under the
 * new fields left the old ones standing — so every card written before
 * that release kept a second, stale copy of its word for ever, sent it to
 * every reader, and offered any of them the wrong half to read.
 *
 * Written out rather than derived, because the list is closed and short:
 * these are the fields that stopped belonging to a card, and a field that
 * stops belonging to one in future belongs here beside them. Every one of
 * them now lives on a form — see the `forms` whitelist in save-card.
 */
/*
 * Every recording a card refers to.
 *
 * Its forms' and its conversation's alike. A line of a scene is drilled in
 * its own right and carries recordings of its own — the whitelist stores
 * them — and the two places that had to know what a card's recordings are
 * walked the forms alone: a backup of a course with a conversation in it
 * came out without a word of the conversation audible, and clearing a card
 * left its lines' recordings on the disk with nothing pointing at them.
 * One answer, read by both.
 */
/** @param {Record<string, any>} card */
const clipsOfCard = (card) => [
  ...formsOf(card).flatMap((/** @type {Record<string, any>} */ f) => [
    ...(f.clips || []),
    ...(f.slowClips || []),
    /* And whatever its accepted answers hold. A recording belongs to the
       answer it is of, and the form's two lists are written from those —
       so in an ordinary card these add nothing. They are read anyway,
       because "what is this card still pointing at" is the question that
       decides whether a blob is deleted, and answering it off a derived
       field means a card written by anything but this app's own packer
       loses its audio. */
    ...(Array.isArray(f.answers) ? f.answers : []).flatMap(
      (/** @type {Record<string, any>} */ a) => [...(a.clips || []), ...(a.slowClips || [])],
    ),
  ]),
  ...(((card && card.lines) || [])).flatMap((/** @type {Record<string, any>} */ ln) => [
    ...(ln.clips || []),
    ...(ln.slowClips || []),
  ]),
];

/*
 * The recordings named on one form, narrowed to names a recording can have.
 *
 * A clip is stored under the hash of its own bytes and is fetched by that
 * hash — sixty-four hex characters, which `put-clip` and `get-clip` both
 * insist on. What was kept on a card was whatever arrived: any type, any
 * length, twelve per form across sixty-five forms. Nothing could ever be
 * fetched by one of those names, so keeping them bought nothing and cost a
 * card a client could make arbitrarily large, which every student then
 * downloads.
 *
 * Dropped rather than refused, like every other narrowing here: a card
 * with an unfetchable name on it is saved without it, and the answer says
 * what was trimmed.
 */
/** @param {unknown} list */
const clipList = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((/** @type {unknown} */ h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h))
    .slice(0, 12);

/* The images on one form, narrowed the way its recordings are — names an
   image can have, and a handful of them: a picture is there to say what
   the word means, and four is already a gallery. */
const MAX_IMAGES = 4;
/** @param {unknown} list */
const imageList = (list) => [
  ...new Set(
    (Array.isArray(list) ? list : [])
      .filter((/** @type {unknown} */ h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h)),
  ),
].slice(0, MAX_IMAGES);

/** Every image a card points at — what backup, restore and clearing read. */
/** @param {Record<string, any>} card */
const imagesOfCard = (card) =>
  formsOf(card).flatMap((/** @type {Record<string, any>} */ f) => (Array.isArray(f.images) ? f.images : []));

const RETIRED_CARD_FIELDS = Object.fromEntries(
  [
    "ar", "en", "lat", "clips", "slowClips", "answers", "subs", "ask", "lend",
    "row", "col", "of",
    /* Whatever grammatical values the languages declare, which were the
       card's when the card was a form. */
    ...grammarFields(),
  ].map((field) => [field, undefined]),
);

/* Left to infer rather than declared as a record of string-makers: the
   keys here are fixed and known, and saying otherwise made `K.course`
   something that might not exist. */
const K = {
  /** @param {string} h */
  user: (h) => `user:${h}`,
  /** @param {string} h */
  ownCards: (h) => `owncards:${h}`,
  /** @param {string} hash */
  keyOf: (hash) => `key:${hash}`,
  /** @param {string} id */
  course: (id) => `course:${id}`,
  /** @param {string} id */
  deck: (id) => `deck:${id}`,
  /** @param {string} id */
  cards: (id) => `cards:${id}`,          // legacy: cards stored per deck
  /** @param {string} id */
  card: (id) => `card:${id}`,
  /** @param {string} owner */
  myCards: (owner) => `mycards:${owner}`,
  /**
   * How many times this person's values have changed — the cards that fill
   * a variable. They belong to no deck, so nothing else moves when one is
   * written, and a student's device compares deck versions to decide
   * whether to fetch. Without this a name added today would reach nobody
   * until something unrelated changed.
   * @param {string} owner
   */
  fillsRev: (owner) => `fillsrev:${owner}`,
  /**
   * Whether this person's cards have had their subtype-named custom tags
   * folded into their subtype — see liftTags. A stamp, like `seeded` on a
   * person's systems, because the pass reads their whole collection and
   * every student's poll would otherwise ask it again.
   * @param {string} owner
   */
  tagLift: (owner) => `taglift:${owner}`,
  /** @param {string} c */
  code: (c) => `code:${String(c).toLowerCase()}`,
  /**
   * A teacher's numbers, and their clock.
   *
   * One of each per teacher per language, because the words a language
   * builds its numbers out of are a fact about the language and not about
   * one deck — the same reason the Numbers screen stopped living on a
   * deck in 0.153. They belong to no deck at all, like the cards that
   * fill a blank, which is why their revisions have to be folded into the
   * material version by hand: nothing else moves when one is written.
   * @param {string} id
   */
  numSys: (id) => `numsys:${id}`,
  /** @param {string} id */
  timeSys: (id) => `timesys:${id}`,
  /**
   * The version of a number or time system its teacher last signed off,
   * kept whole: what students are sent while later edits wait. Absent on a
   * system nobody has edited since sign-off existed, which is sent as it
   * stands. See sign-system.
   * @param {string} id
   */
  sysSigned: (id) => `syssigned:${id}`,
  /**
   * Which system is which, for one teacher: kind, then language, then id.
   * A map rather than a list because every lookup here is by the pair.
   * @param {string} owner
   */
  mySystems: (owner) => `mysystems:${owner}`,
  /** @param {string} h */
  clip: (h) => `clip:${h}`,
  /** @param {string} h */
  image: (h) => `image:${h}`,
  /** @param {string} id */
  flag: (id) => `flag:${id}`,
  /** @param {string} what */
  index: (what) => `index:${what}`,
};

/*
 * Reported problems.
 *
 * A learner who hits a bad question says so from the answer screen, and
 * the report has to reach somebody who can change the card — which the
 * learner's own document never does, since the server cannot read it. So a
 * flag is its own small record here: what was wrong, on which question, by
 * whom, and when.
 *
 * The kinds are the three the app offers, listed here as well because a
 * kind the app never sends is a kind nothing can read, and an open field
 * would fill the admin screen with whatever anyone posted.
 */
const FLAG_KINDS = ["strict", "data", "other"];
const FLAG_NOTE_MAX = 500;

/*
 * How the flagged question had gone for the learner who flagged it.
 *
 * Listed here for the same reason the kinds are: this is read on an admin
 * screen and copied into an export, and a word the app never sends is a
 * word nothing at the other end can act on. Anything else is stored as
 * empty, which reads as "not recorded" — which is also what every report
 * sent before this existed says.
 */
const FLAG_VERDICTS = ["right", "near", "wrong", "shown", "skipped", "unanswered"];

/* Enough to keep every flag a real site accumulates between one look and
   the next, and a ceiling so a stuck client cannot fill the disk. The
   oldest go first, which is also the order they stop being worth reading
   in. */
const MAX_FLAGS = 500;

/* The most fingerprints a card keeps on either list. Past the most any
   frame may be approved at, with room for the ones it has stopped making;
   see review-card. */
const MAX_REVIEWED = 3000;

/*
 * The card a report is about, named the way this server names cards.
 *
 * Course material reaches a device as an item whose id is the card's id
 * with "srv" in front of it, and for one release the app reported that id
 * rather than the card's own. Every report made in that window points at a
 * card that cannot be found — which read on screen as "the learner's own
 * card", about material the learner did not make and cannot change.
 *
 * Taken off here as well as fixed in the app, because the reports already
 * stored are the ones worth reading. Safe to strip unconditionally: a card
 * id made here is "k" and twelve hex digits, so none of them begins with
 * these three letters.
 */
/** @type {(id: unknown) => string} */
const cardIdOf = (id) => String(id || "").replace(/^srv/, "");

/* Strong reads come from the origin, eventual ones from the edge. Anything
   that reads in order to write back must be strong, and so must anything a
   teacher looks at straight after saving. A student's view of course
   material can be a minute behind without anyone noticing, so those paths
   pass EVENTUAL. */
const EVENTUAL = { consistency: "eventual" };

/**
 * Whatever was stored under the key, or null. `any` on purpose: every key
 * holds a different record and each caller below knows which — a union of
 * all of them would be one type nobody could read.
 * @param {Store} store
 * @param {string} key
 * @param {{ consistency?: string }} [opts]
 * @returns {Promise<any>}
 */
async function readJson(store, key, opts = {}) {
  /*
   * A read that failed is not a record that is absent, and this used to
   * answer both with null.
   *
   * Every list on this endpoint filters out the nulls and answers `ok`, so
   * one unreadable course, deck or card came back as a complete answer
   * with that record missing — and on the student's device a course card
   * missing from the answer is a card the teacher withdrew: deleted, and
   * marked deleted so the next sync removes it from their other devices
   * too. A disk hiccup was enough to destroy a learner's progress on a
   * whole deck, everywhere, with nothing reported.
   *
   * So only a record that genuinely is not there reads as null. Anything
   * else throws, and the handler's own catch turns it into a 500 the
   * client already knows how to treat as "try again" rather than as
   * "gone".
   */
  const raw = await store.get(key, { type: "text", consistency: opts.consistency || "strong" });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw Object.assign(new Error(`unreadable record: ${key}`), { unreadable: true });
  }
}
/** @type {(store: Store, key: string, value: unknown) => Promise<any>} */
const writeJson = (store, key, value) => store.set(key, JSON.stringify(value));

/*
 * A record read, changed, and written back — without another request's
 * change going missing in between.
 *
 * Every list on this endpoint was read, changed in memory and written
 * whole: which cards a deck holds, which cards a teacher owns. Two saves
 * in flight at once — two tabs, two co-teachers, a queued draft draining
 * while somebody is typing — both read the list as it was and the second
 * wrote its copy over the first, so a card was silently dropped from a
 * deck, or from the owner's own list, where nothing afterwards would look
 * for it. The lock inside the store serialises the write and not the read
 * before it, so it cannot see this.
 *
 * So the write says which version it is replacing and is refused if that
 * is no longer the one on disk, and a refusal reads again and redoes the
 * change against what is there now. The change has to be a function of the
 * record for that to be safe, which is what this asks for.
 *
 * `change` returning null means there is nothing to write, and the record
 * is left exactly as it stands.
 */
/**
 * @template T
 * @param {Store} store
 * @param {string} key
 * @param {(current: T | null) => T | null} change
 * @returns {Promise<T | null>}
 */
async function updateJson(store, key, change) {
  /* Enough goes at it to outlast any contention a teaching site sees, and
     few enough that a genuinely stuck key reports rather than spins. */
  for (let i = 0; i < 8; i++) {
    const held = await store.getWithMetadata(key);
    /* Through the same parse every other read goes through, so a record
       that cannot be read throws here too rather than being quietly
       replaced with whatever this call was about to write. */
    let current = null;
    if (held && held.data) {
      try {
        current = JSON.parse(held.data);
      } catch (e) {
        throw Object.assign(new Error(`unreadable record: ${key}`), { unreadable: true });
      }
    }
    const next = change(current);
    if (next === null) return current;
    const done = await store.set(key, JSON.stringify(next), held ? { onlyIfMatch: held.etag } : { onlyIfNew: true });
    if (done && done.modified) return next;
  }
  throw new Error(`could not update ${key}`);
}

/*
 * The four records, each read by name.
 *
 * readJson returns `any`, because every key holds something different and
 * one union of all of them would be unreadable. These say which is which at
 * the point it is read, which is the only place the answer is known — and
 * they read better than the raw call besides.
 */
/** @type {(store: Store, id: string) => Promise<Course | null>} */
const readCourse = (store, id) => readJson(store, K.course(id));
/** @type {(store: Store, id: string) => Promise<Deck | null>} */
const readDeck = (store, id) => readJson(store, K.deck(id));
/** @type {(store: Store, id: string) => Promise<Card | null>} */
const readCard = (store, id) => readJson(store, K.card(id));
/** @type {(store: Store, h: string) => Promise<(User & { keyHash?: string }) | null>} */
const readUser = (store, h) => readJson(store, K.user(h));

/**
 * The ids under an index. Always a list: a missing index reads as empty
 * rather than as null every caller has to think about.
 * @param {Store} store
 * @param {string} what
 * @returns {Promise<string[]>}
 */
async function readIndex(store, what) {
  return (await readJson(store, K.index(what))) || [];
}

/**
 * @param {Store} store
 * @param {string} what
 * @param {string} id
 */
async function indexAdd(store, what, id) {
  const list = await readIndex(store, what);
  if (!list.includes(id)) await writeJson(store, K.index(what), list.concat([id]));
}

/**
 * @param {Request} req
 * @param {Store} store
 * @returns {Promise<(User & { keyHash?: string }) | null>}
 */
async function currentUser(req, store) {
  const key = req.headers.get("x-key") || "";
  if (!key) return null;
  const handle = await readJson(store, K.keyOf(sha(key)));
  if (!handle) return null;
  return readUser(store, handle);
}

/*
 * When somebody last did a thing.
 *
 * Three moments are kept on the account, and only the moment: lastSeen when
 * the app signs in or checks who they are, lastLearned when the app says a
 * session has been practiced, and lastTaught when a card or a deck is
 * actually made or changed. It is what an administrator needs to tell a
 * quiet course from an empty one, and it is as little as will answer that —
 * no counts, no history, and nothing about what was practiced, which lives
 * in a document on the person's own device that this server cannot read.
 */
/** @type {(store: Store, user: User, field: string) => Promise<any>} */
const touch = (store, user, field) =>
  writeJson(store, K.user(user.handle), { ...user, [field]: Date.now() });

/** @type {(course: Course | null, h: string) => boolean} */
const isTeacher = (course, h) => !!course && (course.teachers || []).includes(h);
/** @type {(course: Course | null, h: string) => boolean} */
const isStudent = (course, h) => !!course && (course.students || []).includes(h);
/** @type {(course: Course | null, h: string) => boolean} */
const inCourse = (course, h) => isTeacher(course, h) || isStudent(course, h);

/*
 * Removing a person: their decks go, their cards go, and they come out of
 * every course. Nothing of theirs is left pointing at nothing.
 */
/* Blob reads are network calls, so reading a list one record at a time turns
   a screen into a waterfall of round trips. Reads are safe to run together;
   writes are not, because course and deck records are read-modify-write, so
   the destructive loops below stay deliberately sequential. */
/* Who may change a deck.
 *
 * Its owner, an administrator, or any teacher of a course the deck is in.
 * A course is shared work: a teacher brought in to help cannot be expected
 * to ask the original author before fixing a card. Merely studying a course
 * grants nothing. */
/**
 * @param {Store} store
 * @param {Deck | null} deck
 * @param {string} handle
 * @param {boolean} isAdmin
 */
async function canEditDeck(store, deck, handle, isAdmin) {
  if (!deck) return false;
  if (isAdmin || deck.owner === handle) return true;
  for (const link of deck.courses || []) {
    const course = await readCourse(store, link.courseId);
    if (course && isTeacher(course, handle)) return true;
  }
  return false;
}

/**
 * @param {Store} store
 * @param {string[]} keys
 * @param {{ consistency?: string }} [opts]
 * @returns {Promise<any[]>}
 */
async function readManyJson(store, keys, opts) {
  return Promise.all(keys.map((k) => readJson(store, k, opts)));
}

/* A fingerprint of what a student would receive, cheap enough to compute
   from courses and decks alone. Deck versions move whenever a deck's cards
   change (membership or content), so the cards need not be read to know
   whether anything did. */
/**
 * @param {Course[]} courses
 * @param {Deck[]} decks
 */
/**
 * @param {any[]} courses
 * @param {any[]} decks
 * @param {[string, number][]} fills  Each teacher's value revision — see K.fillsRev.
 * @param {[string, number][]} systems  Each number or time system's revision — see K.numSys.
 */
function materialVersion(courses, decks, fills = [], systems = []) {
  const summary = {
    courses: courses.map((c) => [c.id, c.title, c.language || "", (c.decks || []).length]),
    decks: decks.map((d) => [d.id, d.version || 1, d.title, (d.cardIds || []).length]),
    /* The values a teacher has written are material too, and the only
       material that moves without a deck moving: a card that fills a
       variable is in no deck. Sorted, so two reads of the same site agree
       whatever order the teachers came back in. */
    fills: [...fills].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    /* And the systems, for exactly the reason the line above exists: a
       number system is in no deck, so a teacher correcting a word in one
       moves nothing else a device compares against. Left out of here it
       would reach nobody until something unrelated changed. */
    systems: [...systems].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
  return sha(JSON.stringify(summary)).slice(0, 24);
}

/**
 * Every key one person's systems live under.
 *
 * Read off their own index rather than guessed at, and written out here
 * once because three places delete a person's work — leaving an account,
 * an administrator removing one, and clearing the site — and a system
 * left behind by one of them is a lexicon nobody can reach and nothing
 * will ever tidy.
 * @param {Store} store
 * @param {string} handle
 */
async function systemKeysOf(store, handle) {
  const held = (await readJson(store, K.mySystems(handle)).catch(() => null)) || {};
  const numbers = held.numbers && typeof held.numbers === "object" ? held.numbers : {};
  const times = held.times && typeof held.times === "object" ? held.times : {};
  return [
    ...Object.values(numbers).map((id) => K.numSys(String(id))),
    ...Object.values(times).map((id) => K.timeSys(String(id))),
  ];
}

/**
 * @param {Store} store
 * @param {string} handle
 */
async function wipeAccount(store, handle) {
  const user = await readUser(store, handle);
  if (!user) return false;

  const deckIds = await readIndex(store, "decks");
  const keptDecks = [];
  for (const id of deckIds) {
    const d = await readDeck(store, id);
    if (!d) continue;
    if (d.owner !== handle) {
      keptDecks.push(id);
      continue;
    }
    for (const link of d.courses || []) {
      const c = await readCourse(store, link.courseId);
      if (!c) continue;
      c.decks = c.decks.filter((x) => x !== id);
      await writeJson(store, K.course(c.id), c);
    }
    await store.delete(K.deck(id)).catch(() => {});
  }
  await writeJson(store, K.index("decks"), keptDecks);

  for (const id of (await readJson(store, K.ownCards(handle))) || []) {
    await store.delete(K.card(id)).catch(() => {});
  }
  await store.delete(K.ownCards(handle)).catch(() => {});

  for (const key of await systemKeysOf(store, handle)) await store.delete(key).catch(() => {});
  await store.delete(K.mySystems(handle)).catch(() => {});
  await store.delete(K.tagLift(handle)).catch(() => {});

  for (const id of await readIndex(store, "courses")) {
    const c = await readCourse(store, id);
    if (!c) continue;
    if (c.teachers.includes(handle) || c.students.includes(handle)) {
      c.teachers = c.teachers.filter((x) => x !== handle);
      c.students = c.students.filter((x) => x !== handle);
      await writeJson(store, K.course(c.id), c);
    }
  }

  if (user.keyHash) await store.delete(K.keyOf(user.keyHash)).catch(() => {});
  await store.delete(K.user(handle)).catch(() => {});
  const users = await readIndex(store, "users");
  await writeJson(store, K.index("users"), users.filter((x) => x !== handle));
  return true;
}

/** @param {Request} req */
export default async (req) => {
  /* Everything, the setup included, runs inside the try. getStore throws
     outright on a site with no Blobs configuration, and a throw out here
     is not an answer at all: the platform replies 500 with a body that
     isn't JSON, so the app can only report that it couldn't read the
     answer. Inside, the same failure arrives as an error it can name. */
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const store = getStore(STORE);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    /* ================= accounts ================= */

    if (action === "signup") {
      const displayName = String(body.displayName || "").trim().slice(0, 40);
      if (!displayName) return json({ error: "name-required" }, 400);

      /* With SIGNUP_CODE set in the site's environment, an account can only
         be made by someone who was given the code. Without it, anyone who
         finds the address can fill the people list. The app asks for the
         code only after being told it is needed, so a site without one never
         shows the field. */
      const needed = String(process.env.SIGNUP_CODE || "").trim();
      if (needed && String(body.signupCode || "").trim() !== needed) {
        return json({ error: "signup-code-required" }, 403);
      }

      const handles = await readIndex(store, "users");
      const handle = makeHandle(displayName, handles);
      const key = makeKey();
      const user = {
        handle,
        displayName,
        admin: false,
        created: Date.now(),
        lastSeen: Date.now(),
      };
      await writeJson(store, K.user(handle), { ...user, keyHash: sha(key) });
      await writeJson(store, K.keyOf(sha(key)), handle);
      await indexAdd(store, "users", handle);
      // The key is shown once and cannot be read back from the digest.
      return json({ ok: true, user, key });
    }

    if (action === "signin" || action === "whoami") {
      const me = await currentUser(req, store);
      if (!me) return json({ error: "bad-key" }, 401);
      await touch(store, me, "lastSeen");
      const { keyHash, ...safe } = me;
      return json({ ok: true, user: safe });
    }

    const me = await currentUser(req, store);
    if (!me) return json({ error: "bad-key" }, 401);
    const mine = me.handle;
    const iAmAdmin = !!me.admin;

    /* Stamped where a teaching action has gone through, never where one was
       merely attempted: a save refused as not-yours is not work done. Which
       is why this is called at each one's success rather than once up here
       off a list of action names — the list would be right about what was
       asked for and wrong about what happened. Every action that writes a
       card or a deck ends with it. */
    const taught = () => touch(store, me, "lastTaught");

    /* The app's word that a session was practiced. Learning happens on the
       device and syncs as an opaque document, so this is the only way the
       server can know it happened at all. Sent at most once every few
       minutes, so it is one small write however long the session runs. */
    if (action === "practiced") {
      await touch(store, me, "lastLearned");
      return json({ ok: true });
    }

    /* Closing your own account: everything the server holds about you,
       including the decks you made. Cards on the device are the person's
       own business and stay there until they clear them. The same walk an
       administrator removing somebody does, which is why it is one
       function rather than two that drifted. */
    if (action === "delete-account") {
      await wipeAccount(store, mine);
      return json({ ok: true });
    }

    if (action === "rename") {
      const displayName = String(body.displayName || "").trim().slice(0, 40);
      if (!displayName) return json({ error: "name-required" }, 400);
      await writeJson(store, K.user(mine), { ...me, displayName });
      return json({ ok: true, displayName });
    }

    /*
     * "Something about this question is wrong."
     *
     * Anyone signed in may send one: the people who meet a bad card are
     * the students, and a student who has to find a teacher to tell is a
     * student who does not tell. The reporter's name is copied in beside
     * their handle, so the report still says who sent it after the account
     * is gone.
     */
    if (action === "report-flag") {
      const kind = String(body.kind || "");
      if (!FLAG_KINDS.includes(kind)) return json({ error: "bad-flag" }, 400);
      const note = String(body.note || "").trim().slice(0, FLAG_NOTE_MAX);
      /* "Something else" is the option that says nothing by itself. Sent
         empty it is a report nobody can act on, so it is refused here as
         well as disabled in the app. */
      if (kind === "other" && !note) return json({ error: "note-required" }, 400);

      /* The card as it stood when the flag was sent, so that reading the
         report later can say whether it has moved since. Its revision, not
         a copy: what an administrator needs to know is "is this still the
         card they were looking at", and one number answers that.

         `cardKnown` is whether the site held the card at all when the
         report arrived. A card already gone by then and one deleted since
         are both missing when the report is read, and only one of them is
         news to whoever is reading it. */
      const cardId = cardIdOf(String(body.cardId || "").slice(0, 64));
      const flagged = cardId ? await readCard(store, cardId) : null;

      const flag = {
        id: randomBytes(8).toString("hex"),
        kind,
        note,
        handle: mine,
        handleName: me.displayName || mine,
        cardId,
        cardKnown: !!flagged,
        cardRev: flagged ? flagged.rev || 1 : 0,
        exercise: String(body.exercise || "").slice(0, 40),
        subId: body.subId ? String(body.subId).slice(0, 64) : null,
        language: String(body.language || "").slice(0, 20),
        prompt: String(body.prompt || "").slice(0, 200),
        meaning: String(body.meaning || "").slice(0, 200),
        /* Where the card reached the learner from, so a bad batch can be
           found by the deck rather than one report at a time. Empty on a
           card the learner made, and on every report sent by a build older
           than this. */
        courseId: String(body.courseId || "").slice(0, 64),
        deckId: String(body.deckId || "").slice(0, 64),
        /* What they put and what the app made of it. "It marked me wrong"
           cannot be acted on without the answer it marked; with it, most
           reports name their own bug.

           The verdict is checked against the list rather than stored as
           sent: an unknown word here would reach the export as a word
           nothing can read, exactly as an open `kind` would. */
        answer: String(body.answer || "").slice(0, 200),
        verdict: FLAG_VERDICTS.includes(String(body.verdict)) ? String(body.verdict) : "",
        release: String(body.release || "").slice(0, 40),
        /* Which filled sentence it was, where the card is a frame — the
           fingerprint its review is kept in, so a teacher reading this can
           strike that one sentence and nothing else. See review.ts. */
        ...(isSentenceKey(body.sentence) ? { sentence: body.sentence } : {}),
        at: Date.now(),
      };
      await writeJson(store, K.flag(flag.id), flag);

      /* Newest last, the way every other index here grows. Trimmed on the
         way in rather than on the way out, so the list an administrator
         reads is never one the server would have refused to keep. */
      const ids = (await readIndex(store, "flags")).concat([flag.id]);
      const dropped = ids.slice(0, Math.max(0, ids.length - MAX_FLAGS));
      for (const id of dropped) await store.delete(K.flag(id)).catch(() => {});
      await writeJson(store, K.index("flags"), ids.slice(dropped.length));
      return json({ ok: true, id: flag.id });
    }

    /* One-time promotion, so the first admin can exist at all. */
    if (action === "claim-admin") {
      if (!process.env.ADMIN_KEY || String(body.adminKey || "") !== process.env.ADMIN_KEY) {
        return json({ error: "not-allowed" }, 401);
      }
      await writeJson(store, K.user(mine), { ...me, admin: true });
      return json({ ok: true });
    }

    /* ================= decks ================= */

    if (action === "create-deck") {
      const title = String(body.title || "").trim().slice(0, 60);
      if (!title) return json({ error: "title-required" }, 400);
      const id = `d${randomBytes(6).toString("hex")}`;
      const deck = {
        id,
        owner: mine,
        title,
        description: String(body.description || "").slice(0, 300),
        lang: String(body.lang || "").slice(0, 20),
        version: 1,
        courses: [],
        cardIds: [],
        updated: Date.now(),
      };
      await writeJson(store, K.deck(id), deck);
      await indexAdd(store, "decks", id);
      await taught();
      return json({ ok: true, deck });
    }

    /* ---- cards, owned by whoever made them ---- */

    /* ================= cards =================

       A card belongs to whoever made it, not to a deck. Decks hold ids,
       so one card can sit in several without being copied — which is
       what makes a library rather than a pile of duplicates. */

    /** @param {string} id */
    async function loadCard(id) {
      return readCard(store, id);
    }

    /* Which decks hold a card. Kept on the card itself (inDecks) so that
       saving or deleting one card touches only the decks it is actually in,
       instead of reading every deck on the site. Cards saved before the
       index existed are found the slow way once, and gain it on their next
       save. */
    /**
     * @param {Card} card
     * @returns {Promise<string[]>}
     */
    async function decksHolding(card) {
      if (Array.isArray(card.inDecks)) return card.inDecks;
      const deckIds = await readIndex(store, "decks");
      const rows = await readManyJson(store, deckIds.map((id) => K.deck(id)));
      return rows.filter((d) => d && (d.cardIds || []).includes(card.id)).map((d) => d.id);
    }

    /* Take a card out of the decks that hold it. One read-modify-write per
       deck, grouped so deleting twenty cards from one deck is one write. */
    /** @param {Map<string, Set<string>>} removals deckId -> the cards to take out */
    async function pullFromDecks(removals) {
      for (const [did, cardIds] of removals) {
        /* Against whatever the deck holds at the moment of writing, so a
           card added to it while this was running is not carried off by a
           deletion that never knew about it — see updateJson. */
        await updateJson(store, K.deck(did), (d) => {
          if (!d) return null;
          const next = (d.cardIds || []).filter((/** @type {string} */ x) => !cardIds.has(x));
          if (next.length === (d.cardIds || []).length) return null;
          return {
            ...d,
            cardIds: next,
            cardCount: next.length,
            version: (d.version || 1) + 1,
            updated: Date.now(),
          };
        });
      }
    }

    /*
     * Say that this person's values have changed.
     *
     * A card that fills a variable belongs to no deck — that is the point
     * of it: it is borrowed by whichever phrase has a hole of that name —
     * so writing one moves nothing a student's device compares against.
     * This is what moves, and my-material folds it into the version it
     * hands out.
     * @param {string} owner
     */
    async function bumpFills(/** @type {string} */ owner) {
      if (!owner) return;
      const at = (await readJson(store, K.fillsRev(owner))) || {};
      await writeJson(store, K.fillsRev(owner), {
        rev: (Number(at.rev) || 0) + 1,
        updated: Date.now(),
      });
    }

    /**
     * Which systems one person has, by kind and language.
     *
     * A tiny index beside the systems themselves, because every question
     * anybody asks is "the numbers of this language, by this teacher" and
     * answering it by reading every system on the site would be reading
     * the whole shelf to find one book.
     * @param {string} owner
     */
    async function systemIndex(owner) {
      const held = (await readJson(store, K.mySystems(owner))) || {};
      return {
        numbers: (held.numbers && typeof held.numbers === "object") ? held.numbers : {},
        times: (held.times && typeof held.times === "object") ? held.times : {},
        /* Whether the old number cards have already been read. A stamp
           rather than a thing to work out, because every student's device
           asks this question on every poll and the honest answer costs a
           read of the teacher's whole collection. */
        seeded: !!held.seeded,
      };
    }

    /**
     * @param {string} owner
     * @param {string[]} langs
     */
    async function systemsOf(owner, langs) {
      const index = await systemIndex(owner);
      /** @type {string[]} */
      const keys = [];
      for (const lang of langs) {
        if (index.numbers[lang]) keys.push(K.numSys(index.numbers[lang]));
        if (index.times[lang]) keys.push(K.timeSys(index.times[lang]));
      }
      if (!keys.length) return [];
      const rows = await readManyJson(store, keys, EVENTUAL);
      return rows.filter(Boolean);
    }

    /**
     * Build a system out of somebody's old number cards, once per language.
     * @param {string} owner
     */
    async function seedSystems(owner) {
      if (!owner) return;
      /* Once per person, ever. It used to run only where a teacher opened
         the screen, and then a class whose teacher never did would keep a
         shelf of number cards and no system to build a range out of. It
         runs from the students' own poll as well now, so the stamp is
         what keeps that poll from reading a whole collection every time. */
      if ((await systemIndex(owner)).seeded) return;
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(owner))) || [];
      await updateJson(store, K.mySystems(owner), (current) => {
        const held = current && typeof current === "object" ? current : {};
        return held.seeded ? null : { ...held, seeded: true };
      });
      if (!ids.length) return;
      const rows = (await readManyJson(store, ids.map((id) => K.card(id)))).filter(Boolean);
      /** @type {Map<string, any[]>} */
      const byLang = new Map();
      for (const card of rows) {
        /* A part was a card with a value on it, and nothing else ever
           carried one — see the old numbers module. */
        if (typeof card.value !== "number" || !card.lang) continue;
        const held = byLang.get(card.lang);
        if (held) held.push(card);
        else byLang.set(card.lang, [card]);
      }
      if (!byLang.size) return;

      const index = await systemIndex(owner);
      for (const [lang, cards] of byLang) {
        if (index.numbers[lang]) continue;
        const composer = composerFor(lang);
        if (!composer) continue;
        const id = `n${randomBytes(6).toString("hex")}`;
        const now = Date.now();
        const built = migrateCards(
          cards.sort((a, b) => (a.created || 0) - (b.created || 0)),
          composer,
          emptyNumberSystem(id, owner, lang, now, composer.version),
        );
        if (!built.filled && !built.written) continue;
        await writeJson(store, K.numSys(id), { ...built.system, rev: 1, updated: now });
        await updateJson(store, K.mySystems(owner), (current) => {
          const held = current && typeof current === "object" ? current : {};
          const slot = { ...(held.numbers && typeof held.numbers === "object" ? held.numbers : {}) };
          if (slot[lang]) return null;
          slot[lang] = id;
          return { ...held, numbers: slot };
        });
        /* And the cards it was built from are marked as having been read.
           They are not deleted: a card carries recordings and somebody's
           progress, and clearing a box was never a way of asking for
           either to be thrown away. A later release takes them. */
        for (const cardId of built.fromCards) {
          await updateJson(store, K.card(cardId), (card) =>
            card && !card.derived ? { ...card, derived: true } : null,
          );
        }
      }
    }

    /**
     * Fold a person's subtype-named custom tags into the subtype, once.
     *
     * A lift in the mould of seedSystems: stamped per person, run from the
     * teacher's own screen and from their students' polls, and it deletes
     * nothing but the tag. What the rule is — which card takes which
     * subtype — is liftSubtypeTags's, shared with the device. Every card it
     * changes moves the decks it is in and the owner's fills revision, so
     * a student's device fetches the corrected cards rather than keeping
     * the ones it had.
     * @param {string} owner
     */
    async function liftTags(owner) {
      if (!owner) return;
      const done = await readJson(store, K.tagLift(owner));
      if (done && done.v >= 1) return;
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(owner))) || [];
      /** @type {Set<string>} */
      const decks = new Set();
      let moved = false;
      for (const id of ids) {
        let changed = null;
        await updateJson(store, K.card(id), (card) => {
          changed = card ? liftSubtypeTagsIn(card, card.lang) : null;
          return changed;
        });
        if (!changed) continue;
        moved = true;
        for (const did of /** @type {any} */ (changed).inDecks || []) decks.add(String(did));
      }
      for (const did of decks) {
        await updateJson(store, K.deck(did), (deck) =>
          deck ? { ...deck, version: (deck.version || 1) + 1, updated: Date.now() } : null,
        );
      }
      if (moved) await bumpFills(owner);
      /* Stamped after rather than before, so a pass cut short runs again.
         Two polls racing through it both find the same cards and write
         the same answer: the lift changes nothing the second time. */
      await writeJson(store, K.tagLift(owner), { v: 1, at: Date.now() });
    }

    /* Delete cards the person may delete. Returns what happened to each id,
       so a batch can report partial success rather than stopping at the
       first card that isn't theirs. */
    /** @param {string[]} ids */
    async function deleteCards(ids) {
      /** @type {{ deleted: string[], refused: string[], missing: string[] }} */
      const result = { deleted: [], refused: [], missing: [] };
      /** @type {Map<string, Set<string>>} */
      const removals = new Map();
      /** @type {Map<string, string[]>} owner -> ids, for their mycards lists */
      const owned = new Map();
      /** @type {Set<string>} whose values changed, if any of these was one */
      const filledOwners = new Set();
      for (const id of ids) {
        const card = await loadCard(id);
        if (!card) {
          result.missing.push(id);
          continue;
        }
        if (card.owner !== mine && !iAmAdmin) {
          result.refused.push(id);
          continue;
        }
        for (const did of await decksHolding(card)) {
          let goneFrom = removals.get(did);
          if (!goneFrom) removals.set(did, (goneFrom = new Set()));
          goneFrom.add(id);
        }
        /* A card from before owners were recorded has no per-owner list to
           prune, so there is nothing to remember it under. */
        if (card.owner) {
          let theirs = owned.get(card.owner);
          if (!theirs) owned.set(card.owner, (theirs = []));
          theirs.push(id);
        }
        /* A value that has gone has to reach the devices holding it, and
           nothing else about it moves — see bumpFills. Through fillsOf, so
           a card that filled a blank by the kind of word it is counts as
           one of them, the same way the bundling counts it. */
        if (fillsOf(card).length) filledOwners.add(card.owner || "");
        result.deleted.push(id);
      }
      await pullFromDecks(removals);
      for (const id of result.deleted) await store.delete(K.card(id)).catch(() => {});
      for (const [owner, gone] of owned) {
        /* Likewise: a card written while this delete was running stays
           written, rather than being dropped from the list nothing else
           would find it by. */
        await updateJson(store, K.myCards(owner), (list) =>
          (list || []).filter((/** @type {string} */ x) => !gone.includes(x)));
      }
      for (const owner of filledOwners) await bumpFills(owner);
      return result;
    }

    /**
     * @param {Deck} deck
     * @returns {Promise<string[]>}
     */
    async function deckCardIds(deck) {
      /* Decks made before the library existed kept their cards inline.
         Move them across the first time they are read. */
      if (Array.isArray(deck.cardIds) && deck.cardIds.length) return deck.cardIds;
      const legacy = (await readJson(store, K.cards(deck.id))) || [];
      if (!legacy.length) return [];
      /** @type {string[]} */
      const ids = [];
      for (const c of legacy) {
        const id = `k${randomBytes(6).toString("hex")}`;
        await writeJson(store, K.card(id), {
          ...c,
          id,
          owner: deck.owner,
          lang: deck.lang || "",
          rev: 1,
          inDecks: [deck.id],
        });
        ids.push(id);
      }
      /* Added to the owner's list as it stands rather than to the copy
         this read before making the cards, which is a stretch of time long
         enough for a save of their own to land in between. */
      await updateJson(store, K.myCards(deck.owner), (list) => (list || []).concat(ids));
      await updateJson(store, K.deck(deck.id), (fresh) => ({
        ...(fresh || deck),
        cardIds: ids,
        cardCount: ids.length,
      }));
      await store.delete(K.cards(deck.id)).catch(() => {});
      return ids;
    }

    if (action === "my-cards") {
      await liftTags(mine);
      /** @type {string[]} */
      const ids = (await readJson(store, K.myCards(mine))) || [];
      const deckIds = await readIndex(store, "decks");
      const courseIds = await readIndex(store, "courses");
      const [cardRows, deckRows, courseRows] = await Promise.all([
        readManyJson(store, ids.map((id) => K.card(id))),
        readManyJson(store, deckIds.map((id) => K.deck(id))),
        readManyJson(store, courseIds.map((id) => K.course(id))),
      ]);

      /* The decks I may work on: mine, plus every deck in a course I teach.
         The cards in them are mine to see and correct too — a co-teacher who
         can open the deck but not its cards can't do the job. */
      const teaching = new Set(
        courseRows.filter((c) => c && isTeacher(c, mine)).flatMap((c) => c.decks || [])
      );
      const editable = deckRows.filter((d) => d && (d.owner === mine || teaching.has(d.id)));

      /** @type {Record<string, string[]>} */
      const holding = {};
      for (const d of editable) {
        for (const cid of d.cardIds || []) (holding[cid] = holding[cid] || []).push(d.id);
      }

      /* Cards I own, plus any card sitting in a deck I look after. */
      const extraIds = Object.keys(holding).filter((id) => !ids.includes(id));
      const extra = await readManyJson(store, extraIds.map((id) => K.card(id)));
      /* A co-teacher's card whose owner's pass has not run yet is shown as
         it will be once it has, so the editor never offers the tag it is
         about to lose. Saving it stores it that way. */
      const cards = cardRows.concat(extra).filter(Boolean)
        .map((c) => liftSubtypeTagsIn(c, c.lang) || c);
      return json({ ok: true, cards: cards.map((c) => ({ ...c, decks: holding[c.id] || [] })) });
    }

    if (action === "save-card") {
      const card = body.card || {};
      const id = String(card.id || "").replace(/[^A-Za-z0-9_-]/g, "");
      /* Which blanks this card says it fills, through the one answer to
         that — see fillNames, which narrows each name to the shape a slot
         can have, lowers it, and caps how many one card may carry. */
      const filling = fillNames(card);
      /* And the ID the teacher gave it, which is the other name a blank
         can ask for — one card rather than a group of them. Read through
         the same answer the app reads it through, so what the editor
         checked for uniqueness and what is stored here are the same
         string. */
      const answersTo = cardRef(card);
      /* Whether anything on this card leaves a hole. Asked of the forms
         because that is where a card's words live, and asked at all
         because a card with a hole in it is a sentence — see `sentence`
         below, which is the one place this is used. */
      /** @param {Record<string, any>} c */
      function holed(c) {
        return formsOf(c).some((/** @type {any} */ f) => slotsOf(f).length > 0);
      }
      const fields = {
        /* What to call the card in a list, where its own words do not name
           it — a verb saved as the form a dictionary lists. Stored as given
           and capped like every other line of text here: the server does
           not know one language from another, and a name is the teacher's
           words rather than anything it can check. */
        name: String(card.name || "").slice(0, 120),
        /* What the teacher says the word is — a noun, a verb, a name.
           Narrowed to the shape an id can take, like every other id on
           this document: which categories exist is the language pack's
           business, and the server does not know one language from
           another. Stored as "" where nobody has said, which is what
           every card written before the question existed carries. */
        category: idish(card.category),
        /* Which column of the verb table a pronoun is — see the Pronouns
           screen. An id like the category, and absent rather than empty
           on every other card; undefined rather than left out, because
           this object is spread over the card as it stood. */
        person: idish(card.person) || undefined,
        /* No `value` here, and none taken from a save.
           It was what made a card one of the parts a number was built out
           of, and there are no parts any more: a language's numbers are
           one document now, and the cards under it are written by the app
           out of that. So a value that arrives is dropped, like any other
           field nobody writes. A value already *stored* is kept — it comes
           through the spread of the card as it stood — because it is the
           one record of which box an old card fills and it is what the
           lift reads. Stripping it on the next save would be pulling the
           mapping out from under the migration. Kept the way a retired
           grammar axis is kept, and read in `seedSystems`. */
        note: String(card.note || "").slice(0, 500),
        lang: String(card.lang || "").slice(0, 12),
        /* Which blanks this card fills, where it is a value rather than
           something to learn. A list since a word may stand in more than
           one kind of hole; a card written when it was one name arrives as
           a string and is stored as the list of one it always meant.
           Absent where it fills none rather than stored empty, which is
           what `fills` has always been on an ordinary card and what every
           reader of it still tests for — and undefined rather than left
           out, because this object is spread over the card as it stood and
           a missing key would keep whatever it used to fill. JSON drops
           the undefined on the way to disk. */
        fills: filling.length ? filling : undefined,
        /* The ID the teacher gave this card, so another card's blank can
           ask for this one by name. Absent where it has none — a card
           written before the ID was asked for — rather than stored empty,
           and undefined rather than left out, because this object is
           spread over the card as it stood and a missing key would keep
           whatever it used to answer to. JSON drops the undefined on the
           way to disk. */
        ref: answersTo || undefined,
        /* Whether this card is a sentence — a frame other cards are
           dropped into — which is the teacher's answer rather than
           something read off the braces. Stored as a boolean either way
           rather than only when true, for the reason `drill` is: a card
           turned from a sentence back into a word must come back as a
           word, and an absent field would leave every reader falling back
           to the old reading of its braces for ever. A card written before
           this carries nothing and is read that old way, which is exactly
           what it meant — see isSentence, which is the reading this goes
           through rather than a fourth copy of it.

           Saying nothing is not the same as saying no. Reading an absent
           answer as `false` pinned every card an older build sent — and a
           build from before 0.176 says nothing about this by definition —
           so a sentence saved from a stale tab, or pasted in, came back a
           word with its own braces in it: lent into other cards' holes,
           drawn as a word, and refused by the editor on every later save
           until somebody deleted the braces.

           And a card with a hole in it is a sentence whoever says
           otherwise. That is the invariant the rest of this rests on —
           only a sentence may have a blank — and it is worth more than any
           one client's answer, so it is settled by reading rather than by
           refusing: an old client goes on saving its cards, and what it
           saves is true. A conversation is left alone, being neither. */
        sentence: !isDialog(card) && (isSentence(card) || holed(card)),
        /* Whether it is practised in its own right. Stored as a boolean
           either way rather than only when false: a card that has been
           turned off and on again must come back as on, and an absent field
           would leave the client reading the last value it synced. */
        drill: card.drill !== false,
        /*
         * The card's own word first, then every other form of it.
         *
         * One list, and one description of what a form may carry — which
         * is the whole of what the shape bought. The card's word used to be
         * written out here as fields of the card and its other forms again
         * inside `subs`, so a field that belonged to a form was described
         * twice and the two drifted: a sub-form had no id for three
         * releases, and a form switched off needed its own separate answer
         * for the card's word.
         *
         * The cap is a guard against a runaway client rather than a limit
         * anybody should meet: eight persons across three tenses is
         * twenty-four boxes before a teacher has added a plural.
         */
        forms: formsOf(card)
          .slice(0, 65)
          .map((/** @type {Record<string, any>} */ f) => ({
            /* What this form is called, for as long as anything points at
               it — a cell of the table it carries, and a student's
               schedule for it. Stored where the client sends one and
               absent where it does not, so a card saved by an older build
               is unchanged by passing through here. Narrowed to the shape
               an id can take, like every other id on this document. */
            ...(idish(f.id) ? { id: idish(f.id) } : {}),
            ar: String(f.ar || "").slice(0, 400),
            en: String(f.en || "").slice(0, 400),
            lat: String(f.lat || "").slice(0, 400),
            /* Whatever grammatical values the form carries. The server does
               not know which language uses which; it stores what it is
               given, so a card is never stripped by passing through here. */
            ...Object.fromEntries(
              grammarFields().map((g) => [g, String(f[g] || "").slice(0, 40)])
            ),
            /* Which tenses this form's blanks ask their verbs for, where
               it is a sentence that has narrowed one. A map from the
               blank's name to the rows it admits — the names narrowed the
               way every name that goes between braces is, and the rows to
               the shape an id can take, because which rows a language has
               is the language's business and the server does not know one
               language from another. Absent where nothing is narrowed,
               which is every card written before the teacher was asked
               and every frame that wants any tense. */
            ...slotTenses(f),
            /* Where this form sits in the card's verb table, when it is a
               cell of one. Stored as given, like the grammar values above
               and for the same reason: which rows and columns a language
               has is the language's business, and the server does not
               know one language from another. Narrowed to the shape an
               id can take so what comes back is what a pack can name. */
            ...cellAt(f),
            /* Whether this form is asked about. Stored only where it is
               off, because the whole list is rewritten on every save —
               there is no older value here to be left standing, and a
               card saved by a build that knows nothing of this passes
               through unchanged. */
            ...(f.ask === false ? { ask: false } : {}),
            /* And whether it may be lent to a card with a blank in it,
               which is the other half of the same question and since
               0.179 a separate answer — see `lend` in src/types.ts.
               Stored only where the client has an answer to store: absent
               means whatever `ask` says, which is what every card written
               before this meant. */
            ...(typeof f.lend === "boolean" ? { lend: f.lend } : {}),
            answers: storedAnswers(f),
            clips: clipList(f.clips),
            slowClips: clipList(f.slowClips),
            /* The pictures on this form — see imageList. Absent rather than
               empty on a form with none, which is every form written before
               a card could carry one. */
            ...(imageList(f.images).length ? { images: imageList(f.images) } : {}),
          })),
        /* Which word cards this one teaches by containing them. A phrase
           the teacher recorded is a context for the words inside it, and
           this is the teacher's confirmation of which those are — never the
           app's guess, which is only ever a suggestion in the editor.

           Ids, cleaned the same way a card id is: they are written straight
           into a document and read back as identity. */
        uses: Array.isArray(card.uses)
          ? [...new Set(card.uses.map((/** @type {unknown} */ x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "")))]
              .filter(Boolean)
              .slice(0, 24)
          : [],
        /* A conversation, where the card is one: who is in it, which part
           the learner takes, and the turns in order. A line is a form with
           a speaker on it, so it is stored the way a form is — and, like a
           form, it may name the word cards it contains.

           Capped at a dozen turns and four speakers for the same reason
           everything above is capped: this is written into a document that
           is handed to every student in the course. A card with no lines
           stores none, so an ordinary word is unchanged by passing
           through here. */
        speakers: Array.isArray(card.speakers)
          ? card.speakers.slice(0, 4).map((/** @type {unknown} */ n) => String(n || "").slice(0, 40))
          : [],
        /* Which part the learner takes, or null where the teacher left it
           open — most conversations are worth holding up from either end,
           and the question picks a side when the card names none. Stored
           as null rather than 0 because 0 is a real answer: "the one who
           speaks first", which is the opposite of no answer at all. */
        you:
          card.you === null || card.you === undefined || card.you === ""
            ? null
            : Math.max(0, Math.min(3, Math.round(Number(card.you) || 0))),
        lines: Array.isArray(card.lines)
          ? card.lines.slice(0, 12).map((/** @type {Record<string, any>} */ ln) => ({
              /* What this turn is called, for as long as anything points
                 at it. A turn is drilled in its own right, with its own
                 recordings and its own progress, and it was the one kind
                 of form in the app with nothing to name it — so on a
                 student's device it was known by its position, and a
                 teacher removing a turn from the middle of a scene handed
                 every turn below it the progress of the one above. Forms
                 were named for that reason in 0.131 and table cells in
                 0.145; this is the third and last of them. */
              ...(idish(ln.id) ? { id: idish(ln.id) } : {}),
              who: Math.max(0, Math.min(3, Math.round(Number(ln.who) || 0))),
              ar: String(ln.ar || "").slice(0, 400),
              en: String(ln.en || "").slice(0, 400),
              lat: String(ln.lat || "").slice(0, 400),
              clips: clipList(ln.clips),
              slowClips: clipList(ln.slowClips),
              uses: Array.isArray(ln.uses)
                ? [...new Set(ln.uses.map((/** @type {unknown} */ x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "")))]
                    .filter(Boolean)
                    .slice(0, 24)
                : [],
            }))
          : [],
      };

      /*
       * What the whitelist above cut, in the teacher's own terms.
       *
       * Every cap here is a guard against a runaway client rather than a
       * limit anybody should meet, and each of them did its work in
       * silence: a teacher who wrote a thirteenth turn, or a fifth
       * speaker, got "Saved" and a card with twelve turns in it. Nothing
       * on any screen said which, and the only way to find out was to
       * notice what was gone.
       *
       * Counted by comparing what arrived against what is being stored,
       * rather than by repeating the numbers: the caps live once, in the
       * whitelist, and a cap added there is reported by this without
       * being told about. Named things rather than a count, because "one
       * of your recordings" and "one of your turns" are not the same
       * news.
       */
      const trimmedOf = () => {
        /** @type {string[]} */
        const cut = [];
        /** @param {number} had @param {number} kept @param {string} one @param {string} many */
        const note = (had, kept, one, many) => {
          if (had > kept) cut.push(`${had - kept} ${had - kept === 1 ? one : many}`);
        };
        const sentForms = formsOf(card);
        note(sentForms.length, fields.forms.length, "form", "forms");
        note(
          Array.isArray(card.lines) ? card.lines.length : 0,
          fields.lines.length,
          "turn",
          "turns",
        );
        note(
          Array.isArray(card.speakers) ? card.speakers.length : 0,
          fields.speakers.length,
          "speaker",
          "speakers",
        );
        /* Recordings, over the forms that were kept: the ones on a form
           that went are already counted by the line above it. */
        /** @param {Record<string, any>[]} list */
        const clipsIn = (list) =>
          list.reduce(
            (n, f) =>
              n +
              (Array.isArray(f.clips) ? f.clips.length : 0) +
              (Array.isArray(f.slowClips) ? f.slowClips.length : 0),
            0,
          );
        note(
          clipsIn(sentForms.slice(0, fields.forms.length)),
          clipsIn(fields.forms),
          "recording",
          "recordings",
        );
        /** @param {Record<string, any>[]} list */
        const imagesIn = (list) =>
          list.reduce((n, f) => n + (Array.isArray(f.images) ? f.images.length : 0), 0);
        note(
          imagesIn(sentForms.slice(0, fields.forms.length)),
          imagesIn(fields.forms),
          "image",
          "images",
        );
        /* And a word cut off at the end of a field, which is the one that
           does not read as a count. */
        const longest = (/** @type {Record<string, any>[]} */ list) =>
          list.reduce(
            (n, f) => Math.max(n, ...["ar", "en", "lat"].map((k) => String(f[k] || "").length)),
            0,
          );
        if (longest(sentForms) > longest(fields.forms)) cut.push("the end of a long field");
        return cut;
      };
      const trimmed = trimmedOf();

      /* What each accepted answer is, one entry per answer.
         Read through answersOf rather than trusted as sent, so a client
         that omits it — an older build, or a card pasted in — still stores
         the answers its delimited fields describe, and one that sends
         something odd stores what the language will actually accept. The
         `ar` and `lat` strings stay beside it: they are what the wire and
         every export have always carried, and what a client on the old
         build still reads. */
      /** @param {Record<string, any>} form */
      function storedAnswers(form) {
        return answersOf(form, answerFields())
          .slice(0, 12)
          /* An answer's recordings go through the same sieve a form's do:
             a name a clip cannot have is a name nothing can fetch, and
             twelve is the cap either way. Dropped rather than refused,
             like every other narrowing here — and a list left empty is
             left out, because an answer nobody recorded should store
             nothing rather than two empty arrays that ride along through
             every save from here on. */
          .map(({ at: _at, clips, slowClips, ...answer }) => {
            const made = clipList(clips);
            const slow = clipList(slowClips);
            return {
              ...answer,
              ...(made.length ? { clips: made } : {}),
              ...(slow.length ? { slowClips: slow } : {}),
            };
          });
      }

      /* Where a sub-form sits in its card's verb table, when it sits in one.
         Both halves or neither: one without the other places nothing, and a
         form carrying half a position would read as a cell of a row with no
         column. Which rows and columns exist is the language's business, so
         nothing is checked against a list here — only that what comes back
         is the shape a pack can name, which is the shape of an id.

         Spread into the sub-form, so a form that is not a cell gains no
         fields at all rather than two empty ones. */
      /** @param {Record<string, any>} form */
      function cellAt(form) {
        const row = idish(form.row);
        const col = idish(form.col);
        /* And whose table it is a cell of: a form's name, or nothing at all
           for the card's own word. A word's plural takes the same pronouns
           on its end and has a table of its own, so a cell that did not say
           which form it belonged to would be two cells in one place. */
        const of = idish(form.of);
        return row && col ? { row, col, ...(of ? { of } : {}) } : {};
      }

      /* And which tenses a sentence's blanks ask their verbs for, when it
         has narrowed any. Read through the same answer the app reads it
         through — see slotRows in src/verbs.ts, which narrows each row and
         reads an empty list as every tense — so a blank stored here and a
         blank filled on a device cannot come to disagree. The names are
         narrowed like every other name that goes between braces, and the
         whole thing is capped for the reason everything else here is: this
         is written into a document handed to every student in the course.

         Spread into the form, so a form that has narrowed nothing gains no
         field at all rather than an empty map. */
      /** @param {Record<string, any>} form */
      function slotTenses(form) {
        /** @type {Record<string, string[]>} */
        const out = {};
        const said = form && typeof form.tenses === "object" ? form.tenses : null;
        for (const name of Object.keys(said || {}).slice(0, MAX_FILLS)) {
          const slot = slotName(name);
          if (!slot) continue;
          /* Through slotRows, which is what the app reads the list with,
             and then each row narrowed to the shape a pack can name — the
             way a cell's row is above, and for the same reason. Filed
             under the narrowed name on the way in, because that is the
             name the braces in the card's own words are matched on. */
          const one = { tenses: { [slot]: said[name] } };
          const rows = [...new Set(slotRows(one, slot).map(idish))].filter(Boolean).slice(0, 24);
          if (rows.length) out[slot] = rows;
        }
        return Object.keys(out).length ? { tenses: out } : {};
      }

      /*
       * Which of the three kinds of card this one is — taken from the card
       * as it is stored, never from the request.
       *
       * A card is a word, a sentence or a conversation, and that is
       * settled when it is made and never again: it is what a student's
       * whole record hangs on, what every other card's blanks are written
       * against, and the three are asked, dealt and filled in three
       * different ways. The editor asks the question once, while the card
       * is being written and nothing can be lost by any answer — see
       * shapeChoices — and this is the same rule where it cannot be worked
       * around: by a build that has not caught up, by a card pasted in, or
       * by a save queued on a device before the rule existed.
       *
       * Kept rather than refused, because a refusal would lock an older
       * client out of cards it can otherwise edit perfectly well — and
       * because the failure this replaces was silent in the other
       * direction: a client that said nothing about `sentence` turned
       * every sentence it saved into a word.
       *
       * Read through isDialog and isSentence, which are the app's own two
       * answers, so this and the editor cannot come to disagree. Writing
       * the answer out also pins the kind of a card written before there
       * was anything to pin: until then a sentence was recognised by the
       * braces in its words, and taking the braces out made it a word.
       */
      /** @param {Record<string, any>} was @param {Record<string, any>} sent */
      function keptKind(was, sent) {
        if (isDialog(was)) {
          /* Its turns are the lesson, so they are the teacher's to edit —
             but never to empty, which is the one edit that would stop it
             being a conversation. */
          return { sentence: false, lines: sent.lines.length ? sent.lines : was.lines };
        }
        return { sentence: isSentence(was), speakers: [], you: null, lines: [] };
      }

      /* The shape an id can take, which is all the server checks of one:
         which rows, columns and forms a card names is the client's
         business, and this only makes sure what comes back is nameable. */
      /** @param {unknown} x */
      function idish(x) {
        return String(x || "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "")
          .slice(0, 24);
      }

      let saved;
      /** @type {string[]} */
      let current = [];
      /* Whether this card was a value before this save, so that turning one
         back into an ordinary card reaches the devices holding it too. */
      let wasFilling = false;
      /** @type {Card | null} */
      let existing = null;
      if (id) {
        existing = await loadCard(id);
        if (!existing) return json({ error: "no-card" }, 404);
        wasFilling = fillsOf(existing).length > 0;
        current = await decksHolding(existing);
        if (existing.owner !== mine && !me.admin) {
          /* A card in a deck I teach is mine to correct — a deck it is
             actually in, not one the request happens to name. */
          let allowed = false;
          for (const did of current) {
            const d = await readDeck(store, did);
            if (await canEditDeck(store, d, mine, me.admin)) {
              allowed = true;
              break;
            }
          }
          if (!allowed) return json({ error: "not-yours" }, 403);
        }
      }

      /*
       * An ID is the one name that reaches one card, so no two cards may
       * answer to it.
       *
       * The editor refuses a taken name while the teacher is still looking
       * at it, which is where it belongs and where it says something
       * useful. This is the same refusal for the saves that never went
       * through that screen — a stale tab, a queued draft from before the
       * rule, a script — because two cards answering to one `{{x}}` is
       * precisely what an ID exists to prevent, and neither of them can be
       * pointed at afterwards.
       *
       * Only when the name is new or has changed, so an ordinary save
       * costs nothing: an ID is typed once and read a hundred times, and
       * this is the once. A collision already on disk is left alone and
       * read exactly as it always was — this refuses the making of one,
       * not the having of one.
       */
      if (answersTo && answersTo !== cardRef(existing || {})) {
        const owner = (existing && existing.owner) || mine;
        const ids = (await readJson(store, K.myCards(owner))) || [];
        const rows = await readManyJson(store, ids.map((/** @type {string} */ x) => K.card(x)), EVENTUAL);
        const clash = rows.find((/** @type {any} */ c) => c && c.id !== id && cardRef(c) === answersTo);
        if (clash) return json({ error: "ref-taken", ref: answersTo }, 409);
      }

      if (existing) {
        /* created is whatever it already was. A card saved before this
           field existed has none, and must not acquire today's date by
           being edited — the reader falls back to `updated`, which for a
           card never edited is exactly when it was made and for one that
           has been is at least an upper bound. */
        /* And the shape a card was stored in before 0.138 goes, rather
           than being left underneath the new one. The word used to live on
           the card with its other forms in `subs` beside it; `fields`
           writes one `forms` list and said nothing about the old fields,
           so spreading `existing` first kept a stale copy of the word, its
           recordings and its answers on every card ever written — for
           ever, on the wire as well as on disk. Two shapes for one card is
           what 0.138 set out to remove, and a reader that picks the wrong
           half is not a hypothetical: the card editor read the word off
           the card until this release. JSON drops an undefined. */
        saved = {
          ...existing,
          ...RETIRED_CARD_FIELDS,
          ...fields,
          ...keptKind(existing, fields),
          rev: (existing.rev || 1) + 1,
          updated: Date.now(),
        };
      } else {
        const newId = `k${randomBytes(6).toString("hex")}`;
        const now = Date.now();
        saved = { id: newId, owner: mine, ...fields, rev: 1, created: now, updated: now };
        /* Added to whatever the list holds when the write lands. Read and
           written whole, two cards made at once cost one of them its place
           in it — and a card missing from here is a card that is on disk
           and in nobody's collection. */
        await updateJson(store, K.myCards(mine), (list) => (list || []).concat([newId]));
      }

      /* Which decks it belongs to travels with the card. Older clients sent
         this as deckIds, so both names are honoured rather than silently
         leaving the card in no deck at all. */
      const wantedDecks = Array.isArray(body.decks)
        ? body.decks
        : Array.isArray(body.deckIds)
        ? body.deckIds
        : null;

      /* Only the decks that gain or lose the card are read and written. A
         deck that keeps it is still bumped when the card's content changed,
         so the version a student's device compares against moves too. */
      const wanted = wantedDecks ? new Set(wantedDecks) : new Set(current);
      const touched = new Set([...current, ...wanted]);
      const final = [];
      const deckRecords = [];
      for (const did of touched) {
        const d = await readDeck(store, did);
        if (!d) continue;
        const has = current.includes(did);
        const want = wanted.has(did);
        if (want !== has && !(await canEditDeck(store, d, mine, me.admin))) {
          /* Not this person's deck to change: leave it as it was. */
          if (has) final.push(did);
          continue;
        }
        const ids = await deckCardIds(d);
        const next = want
          ? ids.includes(saved.id)
            ? ids
            : ids.concat([saved.id])
          : ids.filter((x) => x !== saved.id);
        if (want) final.push(did);
        const changedMembership = next.length !== ids.length;
        if (!changedMembership && !id) continue;
        /*
         * This one card in or out of whatever the deck holds when the
         * write lands, rather than a whole list worked out beforehand.
         *
         * Two teachers filing cards into one deck at the same moment each
         * read its membership, each added their own card to the copy they
         * held, and the second wrote over the first: a card saved, stored,
         * and in no deck. The card being saved is the only one this
         * request has anything to say about, so it is the only one the
         * write changes.
         */
        const record = await updateJson(store, K.deck(did), (fresh) => {
          const base = fresh || d;
          const held = Array.isArray(base.cardIds) && base.cardIds.length ? base.cardIds : ids;
          const now = want
            ? held.includes(saved.id) ? held : held.concat([saved.id])
            : held.filter((/** @type {string} */ x) => x !== saved.id);
          return {
            ...base,
            cardIds: now,
            cardCount: now.length,
            version: (base.version || 1) + 1,
            updated: Date.now(),
          };
        });
        if (record) deckRecords.push(record);
      }
      /*
       * A sentence nobody has read is not shown.
       *
       * A card that makes sentences — a frame with blanks, a verb's own
       * sentence, a conversation with a blank in a turn — starts with an
       * empty review when it is made, and a card from before review existed
       * gets one the first time the words it is filled into change: the
       * sentences it makes then are new sentences, and wait for a teacher
       * exactly as a new card's do. See review.ts.
       *
       * Only ever started here, never cleared or filled: what a teacher
       * approved is theirs to change, through review-card. Approval is kept
       * as fingerprints of the words shown, so an edit needs nothing done
       * to a review that exists — the changed sentences are simply not on
       * it. A card that makes no sentences is left without one.
       */
      if (!reviewOf(saved) && holedParts(saved).length) {
        const framed = (/** @type {any} */ c) =>
          JSON.stringify(holedParts(c).map((f) => [f.ar, f.lat, f.en, f.tenses || null, f.row || ""]));
        if (!existing || framed(existing) !== framed(saved)) {
          saved.review = { ok: [], no: [], at: Date.now(), by: mine };
        }
      }
      saved.inDecks = final;
      await writeJson(store, K.card(saved.id), saved);
      /* Through the same answer the bundling uses, so a card that fills a
         blank only by the kind of word it is moves the revision too. */
      if (fillsOf(saved).length || wasFilling) await bumpFills(saved.owner || "");
      await taught();
      /* `trimmed` only where something was — an ordinary save says nothing,
         and the client has nothing to report. */
      return json({
        ok: true,
        card: { ...saved, decks: final },
        decks: deckRecords,
        ...(trimmed.length ? { trimmed } : {}),
      });
    }

    /*
     * Whether this person may change a card: its owner, an administrator,
     * or a teacher of a course one of its decks is in. The same rule a
     * save is held to, for the actions that change a card without saving
     * its words.
     */
    /** @param {Card} card */
    async function mayEditCard(card) {
      if (!card) return false;
      if (card.owner === mine || iAmAdmin) return true;
      for (const did of await decksHolding(card)) {
        if (await canEditDeck(store, await readDeck(store, did), mine, iAmAdmin)) return true;
      }
      return false;
    }

    /*
     * A teacher's say on the sentences a card makes.
     *
     * `ok` are fingerprints approved, `no` are fingerprints struck, and
     * `clear` are ones to forget either way — see review.ts. Merged into
     * what the card already carries rather than replacing it, so two
     * teachers working through one card at once each keep what they did,
     * and a report struck from the reports list does not undo a review
     * somebody else has open.
     *
     * A card's words are not touched and its revision does not move — a
     * review is not an edit, and a report filed against the card still
     * reads as being about the card as it stands. The decks holding it do
     * move, because that is what tells a student's device to fetch.
     */
    if (action === "review-card") {
      const id = String(body.cardId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const card = id ? await loadCard(id) : null;
      if (!card) return json({ error: "no-card" }, 404);
      if (!(await mayEditCard(card))) return json({ error: "not-yours" }, 403);
      /** @param {unknown} list */
      const keysIn = (list) => (Array.isArray(list) ? list : []).filter(isSentenceKey).slice(0, MAX_REVIEWED);
      const ok = keysIn(body.ok);
      const no = keysIn(body.no);
      const clear = keysIn(body.clear);
      const next = await updateJson(store, K.card(id), (/** @type {any} */ c) => {
        if (!c) return null;
        const was = reviewOf(c) || {};
        const okSet = new Set(Array.isArray(was.ok) ? was.ok : []);
        const noSet = new Set(Array.isArray(was.no) ? was.no : []);
        for (const k of clear) {
          okSet.delete(k);
          noSet.delete(k);
        }
        for (const k of ok) {
          noSet.delete(k);
          okSet.delete(k);
          okSet.add(k);
        }
        for (const k of no) {
          okSet.delete(k);
          noSet.delete(k);
          noSet.add(k);
        }
        /* Newest kept where a list outgrows the cap: fingerprints of
           sentences a frame no longer makes are what falls off first, and
           losing one of those costs nothing. */
        return {
          ...c,
          review: {
            ok: [...okSet].slice(-MAX_REVIEWED),
            no: [...noSet].slice(-MAX_REVIEWED),
            at: Date.now(),
            by: mine,
          },
        };
      });
      const holding = await decksHolding(next || card);
      for (const did of holding) {
        await updateJson(store, K.deck(did), (/** @type {any} */ d) =>
          d ? { ...d, version: (d.version || 1) + 1, updated: Date.now() } : null,
        );
      }
      await taught();
      return json({ ok: true, card: { ...(next || card), decks: holding } });
    }

    /*
     * The reports learners have sent about cards this person can change.
     *
     * Reports went to the administrator alone, who can read them and can
     * change nothing about a course they do not teach. The teacher who can
     * fix the card is who should hear, so every report about a card this
     * person may edit is theirs to read too — with the card, so the screen
     * can open its review without a second request, and with what has
     * become of it since, the way the administrator's list says.
     */
    if (action === "my-reports") {
      const flagIds = await readIndex(store, "flags");
      const rows = (await readManyJson(store, flagIds.map((x) => K.flag(x)))).filter(Boolean);
      /** @type {Map<string, any>} */
      const cardsById = new Map();
      /** @type {Map<string, boolean>} */
      const allowed = new Map();
      const out = [];
      for (const f of rows) {
        const cid = cardIdOf(f.cardId);
        if (!cid) continue;
        if (!cardsById.has(cid)) cardsById.set(cid, await loadCard(cid));
        const card = cardsById.get(cid);
        if (!allowed.has(cid)) {
          let may = card ? await mayEditCard(card) : false;
          if (!may && !card && f.deckId) {
            may = await canEditDeck(store, await readDeck(store, String(f.deckId)), mine, me.admin);
          }
          allowed.set(cid, may);
        }
        if (!allowed.get(cid)) continue;
        const cardState = !card ? "gone" : (card.rev || 1) > (f.cardRev || 0) && f.cardRev ? "edited" : "here";
        out.push({ ...f, cardId: cid, cardState });
      }
      const cards = [...cardsById.entries()]
        .filter(([cid, c]) => c && allowed.get(cid))
        .map(([, c]) => c);
      return json({ ok: true, flags: out.reverse(), cards });
    }

    /* A report read and dealt with, by a teacher who may change its card.
       The administrator's own list loses it too: there is one report, and
       it has been answered. */
    if (action === "dismiss-reports") {
      const wanted = new Set((Array.isArray(body.flagIds) ? body.flagIds : []).map(String).slice(0, 100));
      if (!wanted.size) return json({ ok: true, deleted: 0 });
      const ids = await readIndex(store, "flags");
      /** @type {string[]} */
      const gone = [];
      for (const fid of ids) {
        if (!wanted.has(fid)) continue;
        const f = await readJson(store, K.flag(fid));
        if (!f) continue;
        const card = await loadCard(cardIdOf(f.cardId));
        const may = card
          ? await mayEditCard(card)
          : !!f.deckId && (await canEditDeck(store, await readDeck(store, String(f.deckId)), mine, me.admin));
        if (!may) continue;
        await store.delete(K.flag(fid)).catch(() => {});
        gone.push(fid);
      }
      if (gone.length) {
        await updateJson(store, K.index("flags"), (/** @type {any} */ list) =>
          (list || []).filter((/** @type {string} */ x) => !gone.includes(x)),
        );
      }
      return json({ ok: true, deleted: gone.length });
    }

    if (action === "delete-cards") {
      const ids = (Array.isArray(body.cardIds) ? body.cardIds : [])
        .map((/** @type {unknown} */ x) => String(x || ""))
        .filter(Boolean)
        .slice(0, 100);
      if (!ids.length) return json({ error: "no-card" }, 400);
      const result = await deleteCards(ids);
      if (result.deleted.length) await taught();
      return json({ ok: true, ...result });
    }

    if (action === "delete-card") {
      const id = String(body.cardId || "");
      const result = await deleteCards([id]);
      if (result.missing.length) return json({ error: "no-card" }, 404);
      if (result.refused.length) return json({ error: "not-yours" }, 403);
      await taught();
      return json({ ok: true });
    }

    if (action === "my-decks") {
      const ids = await readIndex(store, "decks");
      const rows = (await readManyJson(store, ids.map((id) => K.deck(id)))).filter(Boolean);

      /* Mine, plus every deck in a course I teach — those are mine to work on
         too, and hiding them meant a co-teacher could not find the material
         they had been brought in to look after. */
      const courseIds = await readIndex(store, "courses");
      const courses = (await readManyJson(store, courseIds.map((id) => K.course(id)))).filter(
        (c) => c && isTeacher(c, mine)
      );
      const teaching = new Set(courses.flatMap((c) => c.decks || []));

      const decks = rows
        .filter((d) => d.owner === mine || teaching.has(d.id))
        .map((d) => ({ ...d, cardCount: (d.cardIds || []).length, mine: d.owner === mine }));
      return json({ ok: true, decks });
    }

    if (action === "rename-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, me.admin)))
        return json({ error: "not-yours" }, 403);
      const title = String(body.title || "").trim().slice(0, 60);
      if (!title) return json({ error: "title-required" }, 400);
      await writeJson(store, K.deck(deck.id), { ...deck, title, updated: Date.now() });
      await taught();
      return json({ ok: true, title });
    }

    /* The deck goes; the cards it held stay in the library. */
    if (action === "delete-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      if (!deck) return json({ error: "no-deck" }, 404);
      if (!(await canEditDeck(store, deck, mine, me.admin)))
        return json({ error: "not-yours" }, 403);

      for (const link of deck.courses || []) {
        const c = await readCourse(store, link.courseId);
        if (c) {
          c.decks = c.decks.filter((x) => x !== deck.id);
          await writeJson(store, K.course(link.courseId), c);
        }
      }
      await store.delete(K.deck(deck.id)).catch(() => {});
      await store.delete(K.cards(deck.id)).catch(() => {});
      const ids = await readIndex(store, "decks");
      await writeJson(store, K.index("decks"), ids.filter((x) => x !== deck.id));
      await taught();
      return json({ ok: true });
    }

    /* Adding a deck to a course, and taking it away again. */
    if (action === "attach-deck" || action === "detach-deck") {
      const deck = await readDeck(store, String(body.deckId || ""));
      const course = await readCourse(store, String(body.courseId || ""));
      if (!deck || !course) return json({ error: "not-found" }, 404);
      if (!(await canEditDeck(store, deck, mine, me.admin)))
        return json({ error: "not-yours" }, 403);
      if (!isTeacher(course, mine) && !me.admin) return json({ error: "not-teaching" }, 403);

      if (action === "attach-deck") {
        if (!deck.courses.some((c) => c.courseId === course.id)) {
          deck.courses.push({ courseId: course.id, addedAt: Date.now() });
        }
        if (!course.decks.includes(deck.id)) course.decks.push(deck.id);
      } else {
        deck.courses = deck.courses.filter((c) => c.courseId !== course.id);
        course.decks = course.decks.filter((d) => d !== deck.id);
      }
      await writeJson(store, K.deck(deck.id), deck);
      await writeJson(store, K.course(course.id), course);
      await taught();
      return json({ ok: true, deck, course });
    }

    /* ================= courses ================= */

    if (action === "create-course") {
      if (!me.admin) return json({ error: "admin-only" }, 403);
      const title = String(body.title || "").trim().slice(0, 80);
      if (!title) return json({ error: "title-required" }, 400);
      const id = `c${randomBytes(6).toString("hex")}`;
      /* Two codes, because the two invitations are different acts. The
         student code is handed round a class; the teacher code gives
         someone authority over the material and should travel privately. */
      const code = makeCode();
      const teacherCode = makeCode();
      const course = {
        id,
        title,
        description: String(body.description || "").slice(0, 400),
        /* The language the course teaches. Everything downstream leans on
           this: which script its decks and cards are written in, which
           keyboard the editor offers, how answers are marked. Dropping it
           here made every card default to the first language on the list. */
        language: String(body.language || "").slice(0, 20),
        teachers: [],
        students: [],
        decks: [],
        code,
        teacherCode,
        created: Date.now(),
      };
      await writeJson(store, K.course(id), course);
      await writeJson(store, K.code(code), id);
      await writeJson(store, K.code(teacherCode), id);
      await indexAdd(store, "courses", id);
      return json({ ok: true, course });
    }

    /* Teaching a course and studying it are separate memberships, and someone
       may hold both — a teacher who also wants the cards in their own practice
       has to be enrolled as a student to get them. Assigning one no longer
       removes the other. */
    if (action === "assign-teacher" || action === "assign-student" || action === "remove-member") {
      if (!me.admin) return json({ error: "admin-only" }, 403);
      const course = await readCourse(store, String(body.courseId || ""));
      const handle = String(body.handle || "");
      const target = await readUser(store, handle);
      if (!course || !target) return json({ error: "not-found" }, 404);

      if (action === "assign-teacher") {
        if (!course.teachers.includes(handle)) course.teachers.push(handle);
      } else if (action === "assign-student") {
        if (!course.students.includes(handle)) course.students.push(handle);
      } else {
        const only = body.role;
        if (only === "teacher") course.teachers = course.teachers.filter((h) => h !== handle);
        else if (only === "student") course.students = course.students.filter((h) => h !== handle);
        else {
          course.teachers = course.teachers.filter((h) => h !== handle);
          course.students = course.students.filter((h) => h !== handle);
        }
      }
      await writeJson(store, K.course(course.id), course);
      return json({ ok: true, course });
    }

    if (action === "join-course") {
      const given = String(body.code || "").trim();
      const id = await readJson(store, K.code(given));
      if (!id) return json({ error: "bad-code" }, 404);
      const course = await readCourse(store, id);
      if (!course) return json({ error: "not-found" }, 404);

      /* Which code was used decides what they become. A code that no longer
         matches the course it points at has been replaced. */
      const asTeacher = !!course.teacherCode && given === course.teacherCode;
      const asStudent = given === course.code;
      if (!asTeacher && !asStudent) return json({ error: "bad-code" }, 404);

      let changed = false;
      if (asTeacher) {
        if (!course.teachers.includes(mine)) {
          course.teachers.push(mine);
          changed = true;
        }
      } else if (!course.students.includes(mine)) {
        /* Studying is its own membership. A teacher may hold it too — that is
           how they get the course's cards into their own practice. */
        course.students.push(mine);
        changed = true;
      }
      if (changed) await writeJson(store, K.course(course.id), course);

      const { code, teacherCode, ...safe } = course;
      return json({ ok: true, course: safe, role: asTeacher ? "teacher" : "student" });
    }

    if (action === "my-courses") {
      const ids = await readIndex(store, "courses");
      const out = (await readManyJson(store, ids.map((id) => K.course(id))))
        .filter((c) => c && inCourse(c, mine))
        .map((c) => {
          const teaching = isTeacher(c, mine);
          const studying = isStudent(c, mine);
          const role = teaching ? "teacher" : "student";
          // Only a teacher hands out invitations, so only a teacher sees them.
          return {
            ...c,
            role,
            teaching,
            studying,
            code: role === "teacher" ? c.code : undefined,
            teacherCode: role === "teacher" ? c.teacherCode : undefined,
          };
        });
      return json({ ok: true, courses: out });
    }

    /* Everything a student holds, in one answer: the courses they study,
       those courses' decks, and the cards in them. The app used to fetch
       this as one request per course and then one per deck, every
       forty-five seconds. Now it sends the version it last saw, and if
       nothing has moved the answer is a few bytes.

       Reads here are eventual: a student can see a teacher's change a
       minute late without noticing, and the version converges with it. */
    /* ================= number and time systems =================

       A teacher's numbers are one document per language, and their clock
       is another. Whole-document last-write-wins, which is decided rather
       than inherited: a lexicon is one thing a person edits in one
       sitting, and merging two of them field by field would produce a
       lexicon neither teacher wrote. What that costs is said out loud —
       two teachers saving across each other lose the earlier save whole —
       and it is paid rather than hidden: a save that would go backwards
       is refused and the current document is handed back, so the editor
       can say what happened instead of silently winning. */

    if (action === "my-systems") {
      /*
       * A teacher who already filled in the old Numbers screen finds
       * their words here rather than an empty grid.
       *
       * A lift on read, in the mould every other migration in this app
       * is: it runs the first time the screen is opened, it builds a
       * system where there is none and never touches one that exists,
       * and it deletes nothing — the cards stay where they are, in their
       * decks, with their recordings and every student's progress on
       * them. Which card each box came from is written down, so a device
       * can hand a learner's year on *forty* to the card that replaces
       * it instead of starting them again.
       */
      await seedSystems(mine);
      const index = await systemIndex(mine);
      const keys = [
        ...Object.values(index.numbers).map((id) => K.numSys(String(id))),
        ...Object.values(index.times).map((id) => K.timeSys(String(id))),
      ];
      const rows = keys.length ? (await readManyJson(store, keys)).filter(Boolean) : [];
      /* And which version of each is signed off: a revision, null where
         nothing is yet, and absent where the system has not been edited
         since sign-off existed and is sent as it stands. */
      const signs = await readManyJson(store, rows.map((r) => K.sysSigned(String(r.id))));
      /** @type {Record<string, number | null>} */
      const signed = {};
      rows.forEach((r, i) => {
        if (signs[i]) signed[r.id] = signs[i].rev === null ? null : Number(signs[i].rev);
      });
      return json({ ok: true, systems: rows, signed });
    }

    if (action === "save-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const read = kind === "times" ? readTimeSystem : readNumberSystem;
      /* Narrowed before anything is decided about it, so what is compared,
         stored and handed back is one shape and not three. */
      const wanted = read(body.system);
      if (!wanted) return json({ error: "not-a-system" }, 400);
      if (!wanted.languageId) return json({ error: "no-language" }, 400);

      const keyOf = kind === "times" ? K.timeSys : K.numSys;
      const index = await systemIndex(mine);
      const known = kind === "times" ? index.times : index.numbers;
      let id = String(known[wanted.languageId] || "");
      const existing = id ? await readJson(store, keyOf(id)) : null;

      /*
       * The refusal, and what it is keyed on.
       *
       * A save carries the revision it was *loaded from*, and is refused
       * if the site has moved past it — the same compare-and-set
       * `updateJson` does with an ETag, and for the same reason. **Not a
       * timestamp**: the stamp on a save is the editing device's clock,
       * and a device an hour slow would have every save after its first
       * refused for ever with nothing on the screen to explain it. A
       * revision is a number both sides have actually seen.
       *
       * Refusing rather than merging is the decision, and the cost is
       * real: two teachers editing one lexicon across a sync means the
       * later save is not made. It is answered with the document that is
       * there, so the editor can say so — which is the whole difference
       * between a cost and a mystery. The outbox treats an answered
       * request as decided, and it is: asking again would only ask again.
       */
      const held = Number((existing && existing.rev) || 0);
      if (existing && held > Number(wanted.rev || 0)) {
        return json({ error: "stale-system", system: existing }, 409);
      }

      if (!id) {
        id = `${kind === "times" ? "t" : "n"}${randomBytes(6).toString("hex")}`;
        await updateJson(store, K.mySystems(mine), (current) => {
          const now = current && typeof current === "object" ? current : {};
          const slot = { ...(now[kind] && typeof now[kind] === "object" ? now[kind] : {}) };
          slot[wanted.languageId] = id;
          return { ...now, [kind]: slot };
        });
      }

      const saved = {
        ...wanted,
        id,
        owner: mine,
        rev: held + 1,
        created: Number(existing && existing.created) || Date.now(),
        updated: Date.now(),
      };
      /*
       * A system's first save since sign-off existed starts its sign-off.
       *
       * What students had until now is what they keep: the version before
       * this edit is recorded as signed, so nobody loses a number they were
       * practising, and this edit waits for the teacher to check the sample
       * and sign it off. A system made from nothing has nothing signed, and
       * reaches students at its first sign-off.
       */
      if (!(await readJson(store, K.sysSigned(id)))) {
        await writeJson(store, K.sysSigned(id), existing
          ? { rev: Number(existing.rev) || 0, at: Date.now(), by: mine, system: existing }
          : { rev: null, at: Date.now(), by: mine, system: null });
      }
      await writeJson(store, keyOf(id), saved);
      return json({ ok: true, system: saved, signed: (await readJson(store, K.sysSigned(id))).rev });
    }

    /*
     * A teacher's sign-off on the version of a system they have checked.
     *
     * A language's numbers can run to millions, so nobody reads them all:
     * the numbers screen shows one of every shape a language can get
     * wrong, and signing off says the teacher has read those. The version
     * signed is kept whole and is what students are sent until the next
     * sign-off. Refused unless it is the version on disk, so what is
     * signed is what the teacher was looking at.
     */
    if (action === "sign-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const languageId = String(body.languageId || "");
      const index = await systemIndex(mine);
      const id = String((kind === "times" ? index.times : index.numbers)[languageId] || "");
      if (!id) return json({ error: "no-system" }, 404);
      const current = await readJson(store, (kind === "times" ? K.timeSys : K.numSys)(id));
      if (!current) return json({ error: "no-system" }, 404);
      if (Number(current.rev) !== Number(body.rev)) return json({ error: "stale-system", system: current }, 409);
      await writeJson(store, K.sysSigned(id), { rev: Number(current.rev), at: Date.now(), by: mine, system: current });
      await taught();
      return json({ ok: true, id, signed: Number(current.rev) });
    }

    if (action === "delete-system") {
      const kind = body.kind === "times" ? "times" : "numbers";
      const languageId = String(body.languageId || "");
      if (!languageId) return json({ error: "no-language" }, 400);
      const index = await systemIndex(mine);
      const held = kind === "times" ? index.times : index.numbers;
      const id = String(held[languageId] || "");
      if (!id) return json({ error: "no-system" }, 404);
      await store.delete((kind === "times" ? K.timeSys : K.numSys)(id)).catch(() => {});
      await store.delete(K.sysSigned(id)).catch(() => {});
      await updateJson(store, K.mySystems(mine), (current) => {
        const now = current && typeof current === "object" ? current : {};
        const slot = { ...(now[kind] && typeof now[kind] === "object" ? now[kind] : {}) };
        delete slot[languageId];
        return { ...now, [kind]: slot };
      });
      return json({ ok: true, deleted: id });
    }

    if (action === "my-material") {
      const known = String(url.searchParams.get("version") || "");
      /** @type {string[]} */
      const courseIds = (await readJson(store, K.index("courses"), EVENTUAL)) || [];
      const allCourses = (
        await readManyJson(store, courseIds.map((id) => K.course(id)), EVENTUAL)
      ).filter(Boolean);
      const courseRows = allCourses.filter((c) => isStudent(c, mine));
      /* Whether the Teaching space exists for this person is answered here
         too, so the app needn't ask a second time on every launch. */
      const teaches = allCourses.some((c) => isTeacher(c, mine));

      /* A deck in two of the person's courses is still one deck; listing
         it twice gave the app two cards with one id. First course wins. */
      const deckToCourse = new Map();
      for (const c of courseRows) for (const did of c.decks || []) {
        if (!deckToCourse.has(did)) deckToCourse.set(did, c);
      }
      const deckIds = [...deckToCourse.keys()];
      const deckRows = (await readManyJson(store, deckIds.map((id) => K.deck(id)), EVENTUAL)).filter(
        Boolean
      );

      /* Whose values can reach this person: whoever owns a deck they hold,
         and whoever teaches a course they are in — the same two lists the
         bundling below reads from, so what is sent and what the version
         covers cannot come apart. Their revisions go into the version
         because a value belongs to no deck, and nothing else about it would
         move when one is written. */
      const teacherHandles = [
        ...new Set(
          deckRows
            .map((/** @type {any} */ d) => d.owner)
            .concat(courseRows.flatMap((/** @type {any} */ c) => c.teachers || []))
            .filter(Boolean)
        ),
      ];
      const fillsRevs = await readManyJson(
        store,
        teacherHandles.map((h) => K.fillsRev(h)),
        EVENTUAL
      );
      /** @type {[string, number][]} */
      const fillsAt = teacherHandles.map((h, i) => [h, (fillsRevs[i] && fillsRevs[i].rev) || 0]);

      /*
       * And their numbers, in the languages this person is actually
       * learning.
       *
       * The languages come off the decks and the courses rather than off
       * the teacher, so a teacher who also teaches Hebrew somewhere else
       * does not post a Hebrew lexicon to a student of Arabic. Sent whole
       * and regenerated into cards on the device; each system's revision
       * goes into the version for the same reason a value's does.
       */
      const langs = [
        ...new Set(
          deckRows
            .map((/** @type {any} */ d) => d.lang)
            .concat(courseRows.map((/** @type {any} */ c) => c.language))
            .filter(Boolean)
        ),
      ];
      /* And a teacher who never opened the screen still has their words
         read across, because a student's own poll does it. Once per
         teacher, ever — see seedSystems, which stamps itself. */
      await Promise.all(teacherHandles.map((h) => seedSystems(h)));
      /* And their tags, before the cards below are read, so what is sent is
         already tidied. The version was taken a step earlier; where this
         moved anything it moves again, and the device fetches once more. */
      await Promise.all(teacherHandles.map((h) => liftTags(h)));
      const current = (
        await Promise.all(teacherHandles.map((h) => systemsOf(h, langs)))
      ).flat();
      /* Each as its teacher last signed it off — see sign-system. The one
         on disk where it has not been edited since sign-off existed, and
         none at all where nothing has been signed yet. */
      const signs = await readManyJson(
        store,
        current.map((/** @type {any} */ sys) => K.sysSigned(String(sys.id))),
        EVENTUAL,
      );
      const systems = current
        .map((/** @type {any} */ sys, /** @type {number} */ i) => {
          const sign = signs[i];
          if (!sign) return sys;
          if (Number(sign.rev) === Number(sys.rev)) return sys;
          return sign.system || null;
        })
        .filter(Boolean);
      /** @type {[string, number][]} */
      const systemsAt = systems.map((/** @type {any} */ sys) => [sys.id, Number(sys.rev) || 0]);
      const version = materialVersion(courseRows, deckRows, fillsAt, systemsAt);
      const courses = courseRows.map((c) => ({
        ...c,
        code: undefined,
        teacherCode: undefined,
        role: "student",
        teaching: isTeacher(c, mine),
        studying: true,
      }));
      if (known && known === version) return json({ ok: true, unchanged: true, version, teaches });

      const ownerHandles = [...new Set(deckRows.map((d) => d.owner))];
      const owners = await readManyJson(store, ownerHandles.map((h) => K.user(h)), EVENTUAL);
      /** @type {Record<string, string>} */
      const nameOf = {};
      ownerHandles.forEach((h, i) => (nameOf[h] = owners[i] ? owners[i].displayName : h));

      const decks = [];
      for (const d of deckRows) {
        const course = deckToCourse.get(d.id);
        const link = (d.courses || []).find((/** @type {{ courseId: string }} */ c) => c.courseId === course.id);
        const cardIds = await deckCardIds(d);
        decks.push({
          ...d,
          cardIds,
          cardCount: cardIds.length,
          ownerName: nameOf[d.owner],
          addedAt: link ? link.addedAt : null,
          courseId: course.id,
          courseTitle: course.title,
          courseLanguage: course.language || "",
        });
      }
      decks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      const allCardIds = [...new Set(decks.flatMap((d) => d.cardIds))];
      const cardRows = await readManyJson(store, allCardIds.map((id) => K.card(id)), EVENTUAL);
      const cardById = new Map();
      allCardIds.forEach((id, i) => cardRows[i] && cardById.set(id, cardRows[i]));
      /*
       * The values a deck's phrases need, sent with it.
       *
       * A card that fills a variable is in no deck: it is borrowed by
       * whichever phrase has a hole of its name, and asking a teacher to
       * file "Raphael" under Lesson 3 to make "My name is {{name}}" work
       * would be filing it where nobody would look for it. So the server
       * works out which variables a deck actually asks for and sends the
       * cards that answer them.
       *
       * From the teachers of the course the deck is in, in the deck's own
       * language: those are the people whose material reaches this student
       * at all, and a Vietnamese name in an Arabic frame is not a variation
       * on the sentence but a different sentence.
       *
       * Nothing is read here for a site that uses no variables — the first
       * line is a scan of cards already in hand.
       */
      /*
       * Each teacher's library, read once for the whole answer.
       *
       * It was read once per deck: ten decks in a course meant ten reads
       * of every card its teachers have ever written, and every one of
       * them parsed again — for one student, on every refresh that found
       * anything changed. What a card answers to is worked out on the way
       * past for the same reason, since that too was redone per deck.
       */
      /** @type {Map<string, { card: any, fills: string[] }[]>} */
      const libraries = new Map();
      /** @param {string} owner */
      async function libraryOf(owner) {
        const held = libraries.get(owner);
        if (held) return held;
        /** @type {string[]} */
        const ids = (await readJson(store, K.myCards(owner), EVENTUAL)) || [];
        const rows = await readManyJson(store, ids.map((id) => K.card(id)), EVENTUAL);
        const out = rows.filter(Boolean).map((/** @type {any} */ c) => ({ card: c, fills: fillsOf(c) }));
        libraries.set(owner, out);
        return out;
      }

      const bundled = [];
      for (const d of decks) {
        const own = d.cardIds.map((/** @type {string} */ id) => cardById.get(id)).filter(Boolean);
        const wanted = new Set(
          own.flatMap((/** @type {any} */ c) =>
            formsOf(c).flatMap((/** @type {any} */ f) => slotsOf(f))
          )
        );
        if (!wanted.size) {
          bundled.push({ deckId: d.id, cards: own });
          continue;
        }
        const course = deckToCourse.get(d.id);
        const from = [...new Set([d.owner, ...((course && course.teachers) || [])])].filter(Boolean);
        const held = new Set(own.map((/** @type {any} */ c) => c.id));
        const values = [];
        for (const owner of from) {
          for (const { card: c, fills } of await libraryOf(owner)) {
            /*
             * What a card answers to, through the one answer to that —
             * which is its group tags, the ID the teacher gave it, and the
             * kind of word it said it was.
             *
             * It used to be the tags alone, so two of the four ways a
             * blank is filled never reached a student: `{{colour-red}}`
             * and `{{noun}}` found nothing on the device, and the sentence
             * that asked for one was quietly never dealt — while the
             * teacher's own Examples list, which reads the whole library,
             * showed it working. The same call now answers on both sides.
             *
             * `{{word}}` is deliberately not among them: it is answered by
             * any word at all, so matching it here would send a student
             * every word their teachers have ever written. It is filled on
             * the device instead, out of the decks the student holds,
             * which is what it has always been filled from — see fillsOf,
             * which adds that name only for a caller that asks for it.
             */
            if (!fills.some((name) => wanted.has(name))) continue;
            if (d.lang && c.lang && c.lang !== d.lang) continue;
            if (held.has(c.id)) continue;
            held.add(c.id);
            values.push(c);
          }
        }
        bundled.push({ deckId: d.id, cards: own.concat(values) });
      }

      return json({ ok: true, version, teaches, courses, decks, cards: bundled, systems });
    }

    /* Everything in a course is visible to everyone in it. */
    if (action === "course-decks") {
      const course = await readCourse(store, url.searchParams.get("course") || "");
      if (!course) return json({ error: "not-found" }, 404);
      if (!inCourse(course, mine) && !me.admin) return json({ error: "not-in-course" }, 403);

      const rows = (await readManyJson(store, course.decks.map((id) => K.deck(id)))).filter(
        Boolean
      );
      const ownerHandles = [...new Set(rows.map((d) => d.owner))];
      const owners = await readManyJson(store, ownerHandles.map((h) => K.user(h)));
      /** @type {Record<string, string>} */
      const nameOf = {};
      ownerHandles.forEach((h, i) => (nameOf[h] = owners[i] ? owners[i].displayName : h));
      const decks = rows.map((d) => {
        const link = d.courses.find((/** @type {{ courseId: string }} */ c) => c.courseId === course.id);
        return {
          ...d,
          ownerName: nameOf[d.owner],
          addedAt: link ? link.addedAt : null,
          cardCount: (d.cardIds || []).length,
        };
      });
      decks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      return json({ ok: true, course: { ...course, code: undefined }, decks });
    }

    if (action === "deck-cards") {
      const deck = await readDeck(store, url.searchParams.get("deck") || "");
      if (!deck) return json({ error: "not-found" }, 404);

      let allowed = deck.owner === mine || me.admin;
      if (!allowed) {
        for (const link of deck.courses) {
          const c = await readCourse(store, link.courseId);
          if (inCourse(c, mine)) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed) return json({ error: "no-access" }, 403);

      const cards = (
        await readManyJson(store, (deck.cardIds || []).map((id) => K.card(id)))
      ).filter(Boolean);
      return json({ ok: true, version: deck.version, cards });
    }

    /* ================= clips ================= */

    if (action === "put-clip") {
      const hash = String(body.hash || "");
      const data = String(body.data || "");
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      if (!data || data.length > MAX_CLIP_BYTES) return json({ error: "bad-clip" }, 400);
      const existing = await store.get(K.clip(hash), { type: "text" });
      if (existing) return json({ ok: true, deduplicated: true });
      await store.set(K.clip(hash), data);
      return json({ ok: true, deduplicated: false });
    }

    if (action === "clip") {
      const hash = url.searchParams.get("hash") || "";
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      // Clips never change once written, so the edge copy is always right.
      const data = await store.get(K.clip(hash), { type: "text", consistency: "eventual" });
      if (!data) return json({ error: "not-found" }, 404);
      return json({ ok: true, hash, data });
    }

    /* ================= images =================
       A card's pictures, stored the way its recordings are: under the hash
       of their own bytes, as the data URL the editor sent, fetched by that
       hash and never changed once written. */

    if (action === "put-image") {
      const hash = String(body.hash || "");
      const data = String(body.data || "");
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      if (!data || data.length > MAX_IMAGE_BYTES || !IMAGE_DATA.test(data)) {
        return json({ error: "bad-image" }, 400);
      }
      const existing = await store.get(K.image(hash), { type: "text" });
      if (existing) return json({ ok: true, deduplicated: true });
      await store.set(K.image(hash), data);
      return json({ ok: true, deduplicated: false });
    }

    if (action === "image") {
      const hash = url.searchParams.get("hash") || "";
      if (!/^[a-f0-9]{64}$/.test(hash)) return json({ error: "bad-hash" }, 400);
      const data = await store.get(K.image(hash), { type: "text", consistency: "eventual" });
      if (!data) return json({ error: "not-found" }, 404);
      return json({ ok: true, hash, data });
    }

    /* ================= admin ================= */

    if (action.startsWith("admin-")) {
      if (!me.admin) return json({ error: "admin-only" }, 403);

      if (action === "admin-overview") {
        const userIds = await readIndex(store, "users");
        const courseIds = await readIndex(store, "courses");
        const deckIds = await readIndex(store, "decks");
        const flagIds = await readIndex(store, "flags");

        const [courseRows, userRows, deckRows, flagRows] = await Promise.all([
          readManyJson(store, courseIds.map((id) => K.course(id))),
          readManyJson(store, userIds.map((h) => K.user(h))),
          readManyJson(store, deckIds.map((id) => K.deck(id))),
          readManyJson(store, flagIds.map((id) => K.flag(id))),
        ]);
        const courses = courseRows.filter(Boolean);
        const users = [];
        for (const u of userRows) {
          if (!u) continue;
          const h = u.handle;
          const { keyHash, ...safe } = u;
          users.push({
            ...safe,
            /* Title and language together: a course name on its own doesn't
               say what is being taught, and that is the thing that goes wrong
               quietly. */
            teaching: courses
              .filter((c) => isTeacher(c, h))
              .map((c) => ({ title: c.title, language: c.language || "" })),
            studying: courses
              .filter((c) => isStudent(c, h))
              .map((c) => ({ title: c.title, language: c.language || "" })),
          });
        }
        /** @type {Record<string, string>} */
      const nameOf = {};
        for (const u of userRows) if (u) nameOf[u.handle] = u.displayName;
        const decks = deckRows.filter(Boolean).map((d) => ({
          ...d,
          cardCount: (d.cardIds || []).length,
          ownerName: nameOf[d.owner] || d.owner,
          courseTitles: d.courses
            .map((/** @type {{ courseId: string }} */ l) => (courses.find((c) => c.id === l.courseId) || {}).title)
            .filter(Boolean),
        }));
        /*
         * What became of each flagged card, which decides what the report
         * is still worth: one edited since is probably already fixed, one
         * deleted since cannot be opened at all, and one the site did not
         * hold even when the report arrived is nobody here's to change.
         * Saying so on the report is the difference between a list to work
         * through and a list to guess at.
         *
         * Read once per card rather than once per flag: several reports
         * about one bad card is the normal case, and it is the whole reason
         * they are worth reading together.
         */
        const flaggedIds = [
          ...new Set(flagRows.filter(Boolean).map((f) => cardIdOf(f.cardId)).filter(Boolean)),
        ];
        const flaggedCards = await readManyJson(store, flaggedIds.map((id) => K.card(id)), EVENTUAL);
        const revOf = new Map();
        flaggedIds.forEach((id, i) => revOf.set(id, flaggedCards[i] ? flaggedCards[i].rev || 1 : null));

        /* Newest first: a flags list is read from the top, and what came in
           since the last look is the part worth reading. The reporter's
           current name wins over the one copied in when it was sent, so a
           person who has since been renamed is not two people here. */
        const flags = flagRows
          .filter(Boolean)
          .map((f) => {
            const cardId = cardIdOf(f.cardId);
            /* Where the card stands now, and where it stood when the report
               was sent. The second is missing from a report made before it
               was recorded, and worthless on one that recorded "no such
               card" and whose card the prefix above has since found — in
               both cases the number to compare against does not exist, and
               inventing one would mark every card past its first save as
               edited. Whether it is still there is the half that always
               answers, and it is the half that decides what can be
               opened. */
            const rev = cardId ? revOf.get(cardId) : null;
            const wasAt = f.cardKnown === false ? undefined : f.cardRev;
            let cardState;
            if (rev === null || rev === undefined) {
              /* Not there now. Was it there when this was sent? */
              cardState = f.cardKnown === false || !cardId ? "absent" : "gone";
            } else if (wasAt === undefined) {
              cardState = "here";
            } else {
              cardState = rev === wasAt ? "here" : "edited";
            }
            return {
              ...f,
              cardId,
              handleName: nameOf[f.handle] || f.handleName || f.handle,
              cardState,
            };
          })
          .sort((a, b) => (b.at || 0) - (a.at || 0));
        return json({ ok: true, users, courses, decks, flags });
      }

      /* A lost key: the handle survives, so memberships and progress do too. */
      /* Making someone's account for them.
     
         The same as signing up, except the administrator does it and keeps
         the key to hand over. This is the only way to get a teacher onto
         the site without asking them to install the app first and read
         their handle back — which is the wrong way round when the person
         inviting them already knows who they are.
     
         The key is returned once and cannot be read back afterwards; if it
         is lost, issue a new one. */
      /* ================= backup =================

         Reading everything in one request would work in testing and fail the
         first time a course has real recordings in it: a function may only
         return about 6MB and may only run for a few seconds, and clips are
         base64 audio. So a backup is a manifest — which says exactly what
         exists and how it is divided — followed by chunks the browser fetches
         and reassembles into one file.

         The manifest is also what makes a backup checkable: every chunk
         carries a digest, so a file can be verified long after it was made,
         without a restore and without trusting that the download finished. */

      if (action === "admin-backup-manifest") {
        const handles = await readIndex(store, "users");
        const courseIds = await readIndex(store, "courses");
        const deckIds = await readIndex(store, "decks");
        /* Reports were the one thing on the site a backup did not hold, so
           a restore quietly threw away every problem anybody had reported
           and not yet fixed. They are small and they are somebody's words
           about a card that is in the file beside them. */
        const flagIds = await readIndex(store, "flags");

        /* Card ids come from each owner's list rather than a global index,
           which is where they actually live. */
        const cardLists = await readManyJson(store, handles.map((h) => K.myCards(h)));
        const cardIds = [...new Set(cardLists.flatMap((l) => l || []))];

        /* Clip hashes are only discoverable from the cards that use them, so
           the cards have to be read to know what a complete backup contains.
           Only the hashes are kept here; the bytes travel in their own
           chunks. */
        const cards = await readManyJson(store, cardIds.map((id) => K.card(id)));

        /* A teacher's numbers and their clock, which belong to no deck and
           are therefore reachable from nothing above. Their recordings are
           in the same position as a card's — only the thing that refers to
           them says they exist — so the systems have to be read here for
           the backup to be complete. */
        const systemKeyLists = await Promise.all(handles.map((h) => systemKeysOf(store, h)));
        const systemKeys = systemKeyLists.flat();
        const systems = systemKeys.length ? await readManyJson(store, systemKeys) : [];
        const clipHashes = [
          ...new Set(
            cards
              .filter(Boolean)
              .flatMap(clipsOfCard)
              .concat(systems.filter(Boolean).flatMap(clipsOfSystem))
          ),
        ];
        /* And the pictures, reachable the same way: only from the cards. */
        const imageHashes = [...new Set(cards.filter(Boolean).flatMap(imagesOfCard))];

        /* Key hashes, so that restoring a backup leaves everyone's existing
           sign-in key working. The keys themselves are not stored anywhere
           and cannot be part of a backup. */
        const users = await readManyJson(store, handles.map((h) => K.user(h)));
        const keyHashes = users.filter(Boolean).map((u) => u.keyHash).filter(Boolean);

        /* Records are small and clips are not, so they are batched
           differently. These sizes keep a chunk well under the response
           limit even for long cards or a minute of audio. */
        /** @type {{ id: string, kind: string, keys: string[] }[]} */
        const chunks = [];
        /** @type {(kind: string, keys: string[], size: number) => void} */
        const batch = (kind, keys, size) => {
          for (let i = 0; i < keys.length; i += size) {
            chunks.push({ id: `${kind}-${chunks.length}`, kind, keys: keys.slice(i, i + size) });
          }
        };
        batch("user", handles.map(K.user), 40);
        batch("keymap", keyHashes.map(K.keyOf), 60);
        batch("course", courseIds.map(K.course), 40);
        batch("deck", deckIds.map(K.deck), 40);
        batch("owncards", handles.map(K.myCards), 60);
        batch("card", cardIds.map(K.card), 25);
        batch("system", systemKeys, 10);
        batch("mysystems", handles.map(K.mySystems), 60);
        batch("flag", flagIds.map(K.flag), 60);
        batch("clip", clipHashes.map(K.clip), 3);
        batch("image", imageHashes.map(K.image), 2);

        return json({
          ok: true,
          manifest: {
            version: 1,
            takenAt: Date.now(),
            counts: {
              users: handles.length,
              courses: courseIds.length,
              decks: deckIds.length,
              cards: cardIds.length,
              systems: systemKeys.length,
              flags: flagIds.length,
              clips: clipHashes.length,
              images: imageHashes.length,
              keys: keyHashes.length,
            },
            indexes: { users: handles, courses: courseIds, decks: deckIds, flags: flagIds },
            chunks: chunks.map((c) => ({ id: c.id, kind: c.kind, keys: c.keys.length })),
            /* Repeated so a chunk can be fetched without the client having to
               reconstruct which keys were in it. */
            plan: chunks,
          },
        });
      }

      if (action === "admin-backup-chunk") {
        const keys = Array.isArray(body.keys) ? body.keys.slice(0, 200) : [];
        if (!keys.length) return json({ error: "no-keys" }, 400);
        /* Clips are stored as plain text, not JSON. Parsing them as JSON
           silently dropped every recording from every backup. */
        const values = await Promise.all(
          keys.map((/** @type {string} */ k) =>
            k.startsWith("clip:") || k.startsWith("image:")
              ? store.get(k, { type: "text" }).catch(() => null)
              : readJson(store, k)
          )
        );
        /** @type {Record<string, any>} */
        const records = {};
        keys.forEach((/** @type {string} */ k, /** @type {number} */ i) => {
          if (values[i] !== null && values[i] !== undefined) records[k] = values[i];
        });
        /* A digest of what this chunk actually contains, so a finished file
           can be checked against its own manifest later. */
        const digest = sha(JSON.stringify(records));
        return json({ ok: true, records, digest, found: Object.keys(records).length });
      }

      /* Putting a backup back. Records are written as they were; anything on
         the site that the file does not mention is left alone, so restoring
         is additive and can be repeated. The app sends the file in the same
         chunks it was taken in, and the three indexes last. */
      if (action === "admin-restore-chunk") {
        const records =
          body.records && typeof body.records === "object" && !Array.isArray(body.records)
            ? body.records
            : {};
        const keys = Object.keys(records).slice(0, 200);
        if (!keys.length) return json({ error: "no-keys" }, 400);
        /* A prefix missing from here is not an error anybody sees: the
           record is skipped, `written` quietly under-reports, and the
           restore says it worked. So a new kind of record is added to
           this line in the same release that starts writing one. */
        const allowed =
          /^(user|key|course|deck|owncards|mycards|card|numsys|timesys|mysystems|flag|clip|image|code|index):/;
        let written = 0;
        for (const k of keys) {
          if (!allowed.test(k) || k.length > 200) continue;
          let v = records[k];
          /* An index is the union of what the file says and what is here,
             so restoring an old backup cannot hide accounts, courses or
             decks made since it was taken. */
          if (k.startsWith("index:") && Array.isArray(v)) {
            const have = (await readJson(store, k)) || [];
            v = [...new Set(have.concat(v))];
          }
          const payload = k.startsWith("clip:") || k.startsWith("image:") ? String(v || "") : JSON.stringify(v);
          if (!payload || payload.length > 4 * 1024 * 1024) continue;
          await store.set(k, payload);
          written += 1;
        }
        return json({ ok: true, written });
      }

      /* ================= clearing =================

         The other end of a restore, and the only endpoint on the site that
         removes things wholesale. Two locks, because being signed in as an
         administrator is a thing a borrowed phone is: the account has to be
         an administrator, and the request has to carry the deploy's own
         admin key — the same secret that makes someone an administrator in
         the first place, which lives in the environment and not on the
         site.

         The acting administrator's own account is kept even when people are
         being cleared. Deleting it mid-request would leave the site with no
         way in but a fresh signup, and the whole point of asking for the
         key is that the person holding it meant this. One account is easy
         to remove afterwards from People; a site nobody can sign in to is
         not easy to do anything with. */
      if (action === "admin-clear") {
        if (!me.admin) return json({ error: "admin-only" }, 403);
        if (!process.env.ADMIN_KEY || String(body.adminKey || "") !== process.env.ADMIN_KEY) {
          return json({ error: "bad-key" }, 403);
        }
        const want = new Set(
          (Array.isArray(body.parts) ? body.parts : []).map((/** @type {unknown} */ p) => String(p))
        );
        if (!want.size) return json({ error: "nothing-chosen" }, 400);

        const handles = await readIndex(store, "users");
        const courseIds = await readIndex(store, "courses");
        const deckIds = await readIndex(store, "decks");
        const cardLists = await readManyJson(store, handles.map((h) => K.myCards(h)));
        const cardIds = [...new Set(cardLists.flatMap((l) => l || []))];

        /** @type {Record<string, number>} */
        const removed = { users: 0, courses: 0, decks: 0, cards: 0, systems: 0, flags: 0, clips: 0 };

        /* Read before anything is deleted, for the same reason the cards
           are: a system's recordings are only reachable through it. */
        const systemKeyLists = await Promise.all(handles.map((h) => systemKeysOf(store, h)));
        const systemKeys = systemKeyLists.flat();

        /* Reports go on their own say-so rather than with the cards they
           are about: a report outlives its card by design — that is why it
           carries a copy of the question — and clearing the cards to start
           a site again should not silently take the list of what was wrong
           with the last one. */
        if (want.has("flags")) {
          for (const id of await readIndex(store, "flags")) {
            await store.delete(K.flag(id));
            removed.flags += 1;
          }
          await writeJson(store, K.index("flags"), []);
        }

        /* A recording is only reachable through the cards that use it, so
           they are read before anything is deleted — clearing cards first
           would strand every clip on the site with nothing left pointing
           at it. */
        if (want.has("clips")) {
          const cards = await readManyJson(store, cardIds.map((id) => K.card(id)));
          const systems = systemKeys.length ? await readManyJson(store, systemKeys) : [];
          const hashes = [
            ...new Set(
              cards
                .filter(Boolean)
                .flatMap(clipsOfCard)
                .concat(systems.filter(Boolean).flatMap(clipsOfSystem))
            ),
          ];
          for (const h of hashes) {
            await store.delete(K.clip(h));
            removed.clips += 1;
          }
          /* The pictures go with the recordings: both are a card's media,
             reachable only from the cards, and cleared before them. */
          for (const h of [...new Set(cards.filter(Boolean).flatMap(imagesOfCard))]) {
            await store.delete(K.image(h));
          }
        }

        if (want.has("cards")) {
          for (const id of cardIds) {
            await store.delete(K.card(id));
            removed.cards += 1;
          }
          /* The lists that say who owns what are part of the cards, not of
             the people: without them a card is unreachable anyway. */
          for (const h of handles) await store.delete(K.myCards(h));
        }

        /* The numbers a teacher wrote go with the cards, because that is
           what they are: the material, minus the decks it is filed in. */
        if (want.has("cards")) {
          for (const key of systemKeys) {
            await store.delete(key).catch(() => {});
            removed.systems += 1;
          }
          for (const h of handles) await store.delete(K.mySystems(h)).catch(() => {});
          /* And the stamp saying their tags were tidied, so cards written
             after a clear are looked at again. */
          for (const h of handles) await store.delete(K.tagLift(h)).catch(() => {});
        }

        if (want.has("decks")) {
          for (const id of deckIds) {
            await store.delete(K.deck(id));
            removed.decks += 1;
          }
          await writeJson(store, K.index("decks"), []);
        }

        if (want.has("courses")) {
          const courses = await readManyJson(store, courseIds.map((id) => K.course(id)));
          /* The join codes with them: a code is a key of its own pointing at
             a course, and one left behind would point at nothing. */
          for (const c of courses) {
            if (!c) continue;
            if (c.code) await store.delete(K.code(c.code));
            if (c.teacherCode) await store.delete(K.code(c.teacherCode));
          }
          for (const id of courseIds) {
            await store.delete(K.course(id));
            removed.courses += 1;
          }
          await writeJson(store, K.index("courses"), []);
        }

        if (want.has("people")) {
          const users = await readManyJson(store, handles.map((h) => K.user(h)));
          for (const u of users) {
            if (!u || u.handle === mine) continue;
            if (u.keyHash) await store.delete(K.keyOf(u.keyHash));
            await store.delete(K.user(u.handle));
            await store.delete(K.myCards(u.handle));
            removed.users += 1;
          }
          await writeJson(store, K.index("users"), handles.includes(mine) ? [mine] : []);
        }

        return json({ ok: true, removed, kept: want.has("people") ? mine : "" });
      }

      if (action === "admin-create-user") {
        const displayName = String(body.displayName || "").trim().slice(0, 40);
        if (!displayName) return json({ error: "name-required" }, 400);

        const handles = await readIndex(store, "users");
        const handle = makeHandle(displayName, handles);
        const key = makeKey();
        const user = {
          handle,
          displayName,
          admin: false,
          created: Date.now(),
          /* Never seen: they haven't signed in yet. The people list uses
             this to show who still hasn't picked up their key. */
          lastSeen: 0,
          createdBy: mine,
        };
        await writeJson(store, K.user(handle), { ...user, keyHash: sha(key) });
        await writeJson(store, K.keyOf(sha(key)), handle);
        await indexAdd(store, "users", handle);

        /* Putting them straight into a course, so inviting a teacher is one
           action rather than three.

           Both roles at once, because someone teaching a course usually wants
           its cards in their own practice too — which needs a student
           enrolment, and used to mean creating them, then going back to add
           the second role by hand. `role` is still read so a tab left open
           across a deploy adds the role it meant rather than the default. */
        const courseId = String(body.courseId || "");
        if (courseId) {
          const course = await readCourse(store, courseId);
          if (course) {
            const asked = Array.isArray(body.roles)
              ? body.roles
              : [body.role === "student" ? "student" : "teacher"];
            for (const role of asked) {
              const as = role === "student" ? "students" : "teachers";
              if (!course[as].includes(handle)) course[as].push(handle);
            }
            await writeJson(store, K.course(courseId), course);
          }
        }
        return json({ ok: true, user, key });
      }

      if (action === "admin-reissue-key") {
        const handle = String(body.handle || "");
        const target = await readUser(store, handle);
        if (!target) return json({ error: "no-user" }, 404);
        const key = makeKey();
        if (target.keyHash) await store.delete(K.keyOf(target.keyHash)).catch(() => {});
        await writeJson(store, K.user(handle), { ...target, keyHash: sha(key) });
        await writeJson(store, K.keyOf(sha(key)), handle);
        return json({ ok: true, handle, key });
      }

      /* Removing a person: the same walk as closing your own account, so
         an administrator cannot leave a different set of leftovers behind
         than the person themselves would. Your own account goes through
         the door marked with your name, which is the one that needs no
         administrator. */
      if (action === "admin-delete-user") {
        const handle = String(body.handle || "");
        if (handle === mine) return json({ error: "use-delete-account" }, 400);
        const gone = await wipeAccount(store, handle);
        if (!gone) return json({ error: "no-user" }, 404);
        return json({ ok: true });
      }

      /* Removing a course: the roster goes and the decks are released back
         to the teachers who made them. Cards belong to their owners, so
         nothing anybody wrote is destroyed here. */
      if (action === "admin-delete-course") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);

        for (const deckId of course.decks || []) {
          const d = await readDeck(store, deckId);
          if (!d) continue;
          await writeJson(store, K.deck(deckId), {
            ...d,
            courses: (d.courses || []).filter((l) => l.courseId !== course.id),
          });
        }
        if (course.code) await store.delete(K.code(course.code)).catch(() => {});
        await store.delete(K.course(course.id)).catch(() => {});
        const ids = await readIndex(store, "courses");
        await writeJson(store, K.index("courses"), ids.filter((x) => x !== course.id));
        return json({ ok: true });
      }

      /* Courses created before the language was stored have none, and a
         course with no language sends its decks and cards to the wrong
         script. This is how one gets corrected. */
      /* The title is a label and nothing hangs off it: the id is what decks,
         memberships and join codes are keyed by, so this changes what people
         see and nothing else. Same 80 characters create-course allows, or a
         course could be created with a name it could not be renamed to. */
      if (action === "admin-rename-course") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        const title = String(body.title || "").trim().slice(0, 80);
        if (!title) return json({ error: "title-required" }, 400);
        await writeJson(store, K.course(course.id), { ...course, title, updated: Date.now() });
        return json({ ok: true, title });
      }

      if (action === "admin-course-language") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        /* Trimmed, as the title beside it is. A language id is looked up
           in the packs by exact match, so a course set to "  " is a course
           whose material goes to no script at all — and `language-required`
           says plainly that a blank is not an answer, which whitespace is. */
        const language = String(body.language || "").trim().slice(0, 20);
        if (!language) return json({ error: "language-required" }, 400);
        await writeJson(store, K.course(course.id), {
          ...course,
          language,
          updated: Date.now(),
        });
        return json({ ok: true, language });
      }

      /* Replacing one of a course's two codes. The other is untouched, so
         retiring a leaked teacher code doesn't turn away a whole class.
         This is also how a course made before there were two codes gets
         its teacher code. */
      if (action === "admin-new-code") {
        const course = await readCourse(store, String(body.courseId || ""));
        if (!course) return json({ error: "not-found" }, 404);
        const which = body.which === "teacher" ? "teacherCode" : "code";
        const code = makeCode();
        if (course[which]) await store.delete(K.code(course[which])).catch(() => {});
        await writeJson(store, K.code(code), course.id);
        await writeJson(store, K.course(course.id), { ...course, [which]: code });
        return json({ ok: true, code, which });
      }

      /* One card, by id, whoever owns it and whichever deck it is in.
         Admin lists decks rather than cards, so until now there was no way
         to look at a card from here — and a report about a card you cannot
         open is a report you have to go hunting for. */
      if (action === "admin-card") {
        const card = await readCard(store, cardIdOf(url.searchParams.get("card")));
        if (!card) return json({ error: "no-card" }, 404);
        /* Named `decks` because that is what CardReadout reads it as. */
        return json({ ok: true, card: { ...card, decks: await decksHolding(card) } });
      }

      /* Dealt with, or not worth keeping. There is no state on a flag
         beyond existing, because a half-read list of "resolved" markers is
         a second thing to keep tidy and the first one is the card. */
      if (action === "admin-delete-flags") {
        const wanted = new Set((Array.isArray(body.flagIds) ? body.flagIds : []).map(String));
        if (!wanted.size) return json({ ok: true, deleted: 0 });
        const ids = await readIndex(store, "flags");
        for (const id of ids) if (wanted.has(id)) await store.delete(K.flag(id)).catch(() => {});
        await writeJson(store, K.index("flags"), ids.filter((id) => !wanted.has(id)));
        return json({ ok: true, deleted: ids.filter((id) => wanted.has(id)).length });
      }
    }

    return json({ error: "unknown-action" }, 400);
  } catch (err) {
    const e = /** @type {NodeJS.ErrnoException | null} */ (err);
    const detail = String((e && e.message) || err);
    /* Storage that can't be written to is worth telling apart from any
       other failure: nothing about the request was wrong, and the thing to
       look at is the volume rather than the code. */
    if (e && e.code && STORAGE_ERRORS.has(e.code)) {
      return json({ error: "storage-unconfigured", detail }, 500);
    }
    return json({ error: "server", detail }, 500);
  }
};
