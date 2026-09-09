// @ts-check
/** @import { Card, Course, Deck, Flag, User } from "../../src/types.js" */
/**
 * The document store, as store.js hands it over. Named rather than repeated
 * at every helper below.
 * @typedef {ReturnType<typeof getStore>} Store
 */
import { getStore } from "../store.js";
import { createHash, randomBytes } from "node:crypto";
/* The one list of grammatical fields a card may carry, shared with the app so
   that adding an axis to a language does not silently drop it here. */
import { grammarFields } from "../../src/languages.js";

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

/** @type {Record<string, (x: any) => string>} */
const K = {
  user: (h) => `user:${h}`,
  ownCards: (h) => `owncards:${h}`,
  keyOf: (hash) => `key:${hash}`,
  course: (id) => `course:${id}`,
  deck: (id) => `deck:${id}`,
  cards: (id) => `cards:${id}`,          // legacy: cards stored per deck
  card: (id) => `card:${id}`,
  myCards: (owner) => `mycards:${owner}`,
  code: (c) => `code:${String(c).toLowerCase()}`,
  clip: (h) => `clip:${h}`,
  flag: (id) => `flag:${id}`,
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

/* Enough to keep every flag a real site accumulates between one look and
   the next, and a ceiling so a stuck client cannot fill the disk. The
   oldest go first, which is also the order they stop being worth reading
   in. */
const MAX_FLAGS = 500;

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
  try {
    const raw = await store.get(key, { type: "text", consistency: opts.consistency || "strong" });
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
/** @type {(store: Store, key: string, value: unknown) => Promise<any>} */
const writeJson = (store, key, value) => store.set(key, JSON.stringify(value));

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
function materialVersion(courses, decks) {
  const summary = {
    courses: courses.map((c) => [c.id, c.title, c.language || "", (c.decks || []).length]),
    decks: decks.map((d) => [d.id, d.version || 1, d.title, (d.cardIds || []).length]),
  };
  return sha(JSON.stringify(summary)).slice(0, 24);
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

    /* Closing your own account: everything the server holds about you,
       including the decks you made. Cards on the device are the person's
       own business and stay there until they clear them. */
    if (action === "delete-account") {
      const courseIds = await readIndex(store, "courses");
      for (const id of courseIds) {
        const c = await readCourse(store, id);
        if (!c || !inCourse(c, mine)) continue;
        c.teachers = c.teachers.filter((h) => h !== mine);
        c.students = c.students.filter((h) => h !== mine);
        await writeJson(store, K.course(id), c);
      }

      const deckIds = await readIndex(store, "decks");
      const keep = [];
      for (const id of deckIds) {
        const d = await readDeck(store, id);
        if (!d) continue;
        if (d.owner !== mine) {
          keep.push(id);
          continue;
        }
        for (const link of d.courses || []) {
          const c = await readCourse(store, link.courseId);
          if (c) {
            c.decks = c.decks.filter((x) => x !== id);
            await writeJson(store, K.course(link.courseId), c);
          }
        }
        await store.delete(K.deck(id)).catch(() => {});
        await store.delete(K.cards(id)).catch(() => {});
      }
      await writeJson(store, K.index("decks"), keep);

      if (me.keyHash) await store.delete(K.keyOf(me.keyHash)).catch(() => {});
      await store.delete(K.user(mine)).catch(() => {});
      const users = await readIndex(store, "users");
      await writeJson(store, K.index("users"), users.filter((h) => h !== mine));
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
        const d = await readDeck(store, did);
        if (!d) continue;
        const next = (d.cardIds || []).filter((x) => !cardIds.has(x));
        if (next.length === (d.cardIds || []).length) continue;
        await writeJson(store, K.deck(did), {
          ...d,
          cardIds: next,
          cardCount: next.length,
          version: (d.version || 1) + 1,
          updated: Date.now(),
        });
      }
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
        result.deleted.push(id);
      }
      await pullFromDecks(removals);
      for (const id of result.deleted) await store.delete(K.card(id)).catch(() => {});
      for (const [owner, gone] of owned) {
        const list = (await readJson(store, K.myCards(owner))) || [];
        await writeJson(store, K.myCards(owner), list.filter((/** @type {string} */ x) => !gone.includes(x)));
      }
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
      const ids = [];
      const mineList = (await readJson(store, K.myCards(deck.owner))) || [];
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
        mineList.push(id);
      }
      await writeJson(store, K.myCards(deck.owner), mineList);
      await writeJson(store, K.deck(deck.id), { ...deck, cardIds: ids, cardCount: ids.length });
      await store.delete(K.cards(deck.id)).catch(() => {});
      return ids;
    }

    if (action === "my-cards") {
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
      const cards = cardRows.concat(extra).filter(Boolean);
      return json({ ok: true, cards: cards.map((c) => ({ ...c, decks: holding[c.id] || [] })) });
    }

    if (action === "save-card") {
      const card = body.card || {};
      const id = String(card.id || "").replace(/[^A-Za-z0-9_-]/g, "");
      const fields = {
        ar: String(card.ar || "").slice(0, 400),
        en: String(card.en || "").slice(0, 400),
        lat: String(card.lat || "").slice(0, 400),
        /* Whatever grammatical values the card carries. The server does not
           know which language uses which; it stores what it is given, so a
           card is never stripped by passing through here. */
        ...Object.fromEntries(
          grammarFields().map((f) => [f, String(card[f] || "").slice(0, 40)])
        ),
        note: String(card.note || "").slice(0, 500),
        lang: String(card.lang || "").slice(0, 12),
        subs: Array.isArray(card.subs)
          ? card.subs.slice(0, 12).map((/** @type {Record<string, any>} */ sb) => ({
              ar: String(sb.ar || "").slice(0, 400),
              en: String(sb.en || "").slice(0, 400),
              lat: String(sb.lat || "").slice(0, 400),
              ...Object.fromEntries(
                grammarFields().map((f) => [f, String(sb[f] || "").slice(0, 40)])
              ),
              clips: Array.isArray(sb.clips) ? sb.clips.slice(0, 12) : [],
            }))
          : [],
        clips: Array.isArray(card.clips) ? card.clips.slice(0, 12) : [],
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
      };

      let saved;
      /** @type {string[]} */
      let current = [];
      if (id) {
        const existing = await loadCard(id);
        if (!existing) return json({ error: "no-card" }, 404);
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
        /* created is whatever it already was. A card saved before this
           field existed has none, and must not acquire today's date by
           being edited — the reader falls back to `updated`, which for a
           card never edited is exactly when it was made and for one that
           has been is at least an upper bound. */
        saved = { ...existing, ...fields, rev: (existing.rev || 1) + 1, updated: Date.now() };
      } else {
        const newId = `k${randomBytes(6).toString("hex")}`;
        const now = Date.now();
        saved = { id: newId, owner: mine, ...fields, rev: 1, created: now, updated: now };
        const list = (await readJson(store, K.myCards(mine))) || [];
        await writeJson(store, K.myCards(mine), list.concat([newId]));
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
        const fresh = (changedMembership ? await readDeck(store, did) : d) || d;
        const record = {
          ...fresh,
          cardIds: next,
          cardCount: next.length,
          version: (fresh.version || 1) + 1,
          updated: Date.now(),
        };
        await writeJson(store, K.deck(did), record);
        deckRecords.push(record);
      }
      saved.inDecks = final;
      await writeJson(store, K.card(saved.id), saved);
      await taught();
      return json({ ok: true, card: { ...saved, decks: final }, decks: deckRecords });
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

      const version = materialVersion(courseRows, deckRows);
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
      const cards = decks.map((d) => ({
        deckId: d.id,
        cards: d.cardIds.map((/** @type {string} */ id) => cardById.get(id)).filter(Boolean),
      }));

      return json({ ok: true, version, teaches, courses, decks, cards });
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

        /* Card ids come from each owner's list rather than a global index,
           which is where they actually live. */
        const cardLists = await readManyJson(store, handles.map((h) => K.myCards(h)));
        const cardIds = [...new Set(cardLists.flatMap((l) => l || []))];

        /* Clip hashes are only discoverable from the cards that use them, so
           the cards have to be read to know what a complete backup contains.
           Only the hashes are kept here; the bytes travel in their own
           chunks. */
        const cards = await readManyJson(store, cardIds.map((id) => K.card(id)));
        const clipHashes = [
          ...new Set(
            cards.filter(Boolean).flatMap((c) => [
              ...(c.clips || []),
              ...(c.subs || []).flatMap((/** @type {Record<string, any>} */ sb) => sb.clips || []),
            ])
          ),
        ];

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
        batch("clip", clipHashes.map(K.clip), 3);

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
              clips: clipHashes.length,
              keys: keyHashes.length,
            },
            indexes: { users: handles, courses: courseIds, decks: deckIds },
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
            k.startsWith("clip:")
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
        const allowed = /^(user|key|course|deck|owncards|mycards|card|clip|code|index):/;
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
          const payload = k.startsWith("clip:") ? String(v || "") : JSON.stringify(v);
          if (!payload || payload.length > 4 * 1024 * 1024) continue;
          await store.set(k, payload);
          written += 1;
        }
        return json({ ok: true, written });
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

      if (action === "admin-delete-user") {
        const handle = String(body.handle || "");
        if (handle === mine) return json({ error: "use-delete-account" }, 400);
        const gone = await wipeAccount(store, handle);
        if (!gone) return json({ error: "no-user" }, 404);
        return json({ ok: true });
      }

      /* Removing a person: their memberships go, their decks are left
         orphaned rather than destroyed, and their key stops working. */
      if (action === "admin-delete-user") {
        const handle = String(body.handle || "");
        if (handle === mine) return json({ error: "not-yourself" }, 400);
        const target = await readUser(store, handle);
        if (!target) return json({ error: "no-user" }, 404);

        const courseIds = await readIndex(store, "courses");
        for (const id of courseIds) {
          const c = await readCourse(store, id);
          if (!c) continue;
          if (inCourse(c, handle)) {
            c.teachers = c.teachers.filter((h) => h !== handle);
            c.students = c.students.filter((h) => h !== handle);
            await writeJson(store, K.course(id), c);
          }
        }
        if (target.keyHash) await store.delete(K.keyOf(target.keyHash)).catch(() => {});
        await store.delete(K.user(handle)).catch(() => {});
        const users = await readIndex(store, "users");
        await writeJson(store, K.index("users"), users.filter((h) => h !== handle));
        return json({ ok: true, handle });
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
        const language = String(body.language || "").slice(0, 20);
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
