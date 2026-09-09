/*
 * Talking to the courses endpoint.
 *
 * Everything needs the sign-in key, so it is held here rather than passed
 * around. Each call returns the parsed body; anything that isn't a 2xx
 * throws with the server's own error string, which the screens turn into
 * something a person can read.
 */
// @ts-check
/** @import { Card, Flag, LangId, User } from "./types.js" */

const ENDPOINT = "/api/courses";
const KEY_STORE = "arabic-account";

let currentKey = "";

/** @param {string | null} [key] Null when there is no account: `|| ""` takes it. */
export function setKey(key) {
  currentKey = key || "";
}

/* The account lives beside the trainer's own data rather than inside it,
   so signing in on a new device doesn't have to wait for a sync. */
/** @returns {(User & { key: string }) | null} */
export function loadAccount() {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** @param {(User & { key: string }) | null} account */
export function saveAccount(account) {
  try {
    localStorage.setItem(KEY_STORE, JSON.stringify(account));
  } catch (e) {
    /* private browsing — the account lasts for the session only */
  }
  setKey(account && account.key);
}

export function clearAccount() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch (e) {
    /* nothing stored */
  }
  setKey("");
}

/* A request that never answers is worse than one that fails: the screen sits
   on "Working…" with its buttons greyed out until the app is reloaded. Give
   every call a deadline and treat passing it the same as being offline. */
const CALL_TIMEOUT_MS = 20000;

/**
 * One request to the endpoint.
 *
 * `key` overrides the held sign-in key — passing "" makes the call
 * deliberately anonymous, which signing up needs and nothing else does.
 *
 * The answer is `any` on purpose. Every action returns a different shape
 * and the wrappers below say which; describing them all here would be one
 * union nobody could read, and each caller already knows what it asked
 * for.
 * @param {string} action
 * @param {{ body?: unknown, params?: Record<string, string>, key?: string }} [opts]
 * @returns {Promise<any>}
 */
async function call(action, { body, params, key } = {}) {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  const use = key !== undefined ? key : currentKey;
  if (use) headers["x-key"] = use;

  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), CALL_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal,
    });
  } catch (e) {
    throw new Error("offline");
  } finally {
    clearTimeout(deadline);
  }

  /* Read the body as text and parse it here rather than calling res.json()
     directly. A failure that never reached the function — a missing
     redirect serving index.html, a platform error page — has a body that
     isn't JSON, and res.json() throwing on it would lose the status code
     along with every clue about what actually happened. */
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = null;
  }
  if (data === null || typeof data !== "object") {
    throw new Error(res.ok ? "bad-response" : `http-${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `http-${res.status}`);
  return data;
}

/* ---- accounts ---- */
/** @type {(displayName: string, signupCode?: string) => Promise<any>} */
export const signUp = (displayName, signupCode) =>
  call("signup", { body: { displayName, signupCode: signupCode || "" }, key: "" });
/** @type {(key: string) => Promise<any>} */
export const whoAmI = (key) => call("whoami", { key });
/** @type {(displayName: string) => Promise<any>} */
export const rename = (displayName) => call("rename", { body: { displayName } });
/* "Some learning just happened." The server keeps the moment and nothing
   else — what was practiced and how it went are in the device's own
   document, which never passes through here. */
export const practiced = () => call("practiced", { body: {} });
/** @type {(adminKey: string) => Promise<any>} */
export const claimAdmin = (adminKey) => call("claim-admin", { body: { adminKey } });

/* ---- flags ----
   "Something about this question is wrong." Sent by whoever hit it, read in
   Admin → Flags by whoever can fix it. The report carries a copy of the
   question rather than a pointer to the card, so it still says something
   after the card has been edited or withdrawn. */
/**
 * `language` is the id — "ar-PS" — and not the language pack that has one.
 * Passing the pack is the mistake this signature exists to refuse: it read
 * perfectly well at the call site, was accepted here, and arrived at the
 * server as "[object Object]".
 * @param {Pick<Flag, "kind" | "note" | "cardId" | "exercise" | "subId" | "prompt" | "meaning">
 *   & { language: LangId }} flag
 * @returns {Promise<{ ok: true, id: string }>}
 */
export const reportFlag = (flag) => call("report-flag", { body: flag });

/* ---- courses ---- */
export const myCourses = () => call("my-courses");
/** @type {(title: string, language: LangId, description?: string) => Promise<any>} */
export const createCourse = (title, language, description) =>
  call("create-course", { body: { title, language, description } });
/** @type {(courseId: string, handle: string) => Promise<any>} */
export const assignStudent = (courseId, handle) =>
  call("assign-student", { body: { courseId, handle } });
/** @type {(courseId: string, handle: string) => Promise<any>} */
export const assignTeacher = (courseId, handle) =>
  call("assign-teacher", { body: { courseId, handle } });
/** @type {(courseId: string, handle: string, role: "teacher" | "student") => Promise<any>} */
export const removeMember = (courseId, handle, role) =>
  call("remove-member", { body: { courseId, handle, role } });
/** @type {(code: string) => Promise<any>} */
export const joinCourse = (code) => call("join-course", { body: { code } });
/** @type {(courseId: string) => Promise<any>} */
export const courseDecks = (courseId) => call("course-decks", { params: { course: courseId } });
/* Everything a student holds in one request. Pass the version from the last
   answer and the server replies { unchanged: true } when nothing moved. */
/** @type {(version?: string) => Promise<any>} */
export const myMaterial = (version) =>
  call("my-material", { params: version ? { version } : {} });

/* ---- decks and cards ---- */
export const myDecks = () => call("my-decks");
/** @type {(title: string, description: string, lang: LangId) => Promise<any>} */
export const createDeck = (title, description, lang) =>
  call("create-deck", { body: { title, description, lang } });
/** @type {(deckId: string, title: string) => Promise<any>} */
export const renameDeck = (deckId, title) => call("rename-deck", { body: { deckId, title } });
/** @type {(deckId: string) => Promise<any>} */
export const deleteDeck = (deckId) => call("delete-deck", { body: { deckId } });
export const myCards = () => call("my-cards");
/* The server calls this field "decks"; sending anything else means the
   card saves but never lands in a deck. */
/** @type {(card: Partial<Card>, decks: string[]) => Promise<any>} */
export const saveCard = (card, decks) => call("save-card", { body: { card, decks } });
/** @type {(cardId: string) => Promise<any>} */
export const deleteCard = (cardId) => call("delete-card", { body: { cardId } });
/** @type {(cardIds: string[]) => Promise<any>} */
export const deleteCards = (cardIds) => call("delete-cards", { body: { cardIds } });
/** @type {(deckId: string) => Promise<any>} */
export const deckCards = (deckId) => call("deck-cards", { params: { deck: deckId } });
/** @type {(deckId: string, courseId: string) => Promise<any>} */
export const attachDeck = (deckId, courseId) =>
  call("attach-deck", { body: { deckId, courseId } });
/** @type {(deckId: string, courseId: string) => Promise<any>} */
export const detachDeck = (deckId, courseId) =>
  call("detach-deck", { body: { deckId, courseId } });

/* ---- clips ---- */
/** @type {(hash: string, data: string) => Promise<any>} */
export const putClip = (hash, data) => call("put-clip", { body: { hash, data } });
/** @type {(hash: string) => Promise<{ ok: true, hash: string, data: string }>} */
export const getClip = (hash) => call("clip", { params: { hash } });

export const deleteAccount = () => call("delete-account", { body: {} });

/* ---- admin ---- */
export const adminOverview = () => call("admin-overview");
export const backupManifest = () => call("admin-backup-manifest");
/** @type {(keys: string[]) => Promise<any>} */
export const backupChunk = (keys) => call("admin-backup-chunk", { body: { keys } });
/** @type {(records: unknown[]) => Promise<any>} */
export const restoreChunk = (records) => call("admin-restore-chunk", { body: { records } });

/* `roles` is a list because someone can teach a course and study it, and
   asking for both when the person is made saves going back to add the
   second by hand. */
/** @type {(displayName: string, courseId: string, roles: ("teacher" | "student")[]) => Promise<any>} */
export const createUser = (displayName, courseId, roles) =>
  call("admin-create-user", { body: { displayName, courseId, roles } });
/** @type {(handle: string) => Promise<any>} */
export const reissueKey = (handle) => call("admin-reissue-key", { body: { handle } });
/** @type {(handle: string) => Promise<any>} */
export const deleteUser = (handle) => call("admin-delete-user", { body: { handle } });
/** @type {(courseId: string, which: "teacher" | "student") => Promise<any>} */
export const newCourseCode = (courseId, which) =>
  call("admin-new-code", { body: { courseId, which } });
/** @type {(courseId: string) => Promise<any>} */
export const deleteCourse = (courseId) => call("admin-delete-course", { body: { courseId } });
/** @type {(courseId: string, title: string) => Promise<any>} */
export const renameCourse = (courseId, title) =>
  call("admin-rename-course", { body: { courseId, title } });
/** @type {(courseId: string, language: LangId) => Promise<any>} */
export const setCourseLanguage = (courseId, language) =>
  call("admin-course-language", { body: { courseId, language } });
/* Flags are read with the rest of the overview; this is the only thing done
   to them. Dealt with means dealt with — there is nothing to keep. */
/** @type {(flagIds: string[]) => Promise<{ ok: true, deleted: number }>} */
export const deleteFlags = (flagIds) => call("admin-delete-flags", { body: { flagIds } });
/* One card, fetched when a report about it is opened. Admin lists decks
   rather than cards, so it holds none of them until one is asked for. */
/** @type {(cardId: string) => Promise<{ ok: true, card: Card }>} */
export const adminCard = (cardId) => call("admin-card", { params: { card: cardId } });

/* Turn a server error into something worth reading. */
/**
 * @param {unknown} err
 * @returns {string}
 */
export function explain(err) {
  /* An Error's message, or whatever was thrown. The narrowing is what the
     old `err && err.message` meant: anything without a message stringifies
     as itself. */
  const m = String(
    (err && typeof err === "object" && "message" in err && err.message) || err
  );
  if (m === "unknown-action")
    return (
      "This part of the app is newer than the server. Deploy the current " +
      "server/api/courses.js and restart it."
    );

  /* An answer that wasn't the function's own. The status is the only clue
     the app has, and each of these points at a different thing to check,
     so they are worth spelling out rather than showing a bare number. */
  if (m.startsWith("http-")) {
    const status = m.slice("http-".length);
    if (status === "404")
      return (
        "The server has no /api/courses endpoint. Either it isn't running " +
        "the app's own server, or something else is answering for it."
      );
    if (status === "502" || status === "503" || status === "504")
      return "The server didn't answer. Give it a moment and try again.";
    return `The server answered ${status}. Check the site's function log.`;
  }

  return (
    {
      offline: "Can't reach the server. Your own cards still work.",
      "bad-key": "That sign-in key isn't recognised.",
      "bad-code": "No course has that code.",
      "admin-only": "Only the administrator can do that.",
      "not-allowed": "That administrator key isn't right.",
      "not-yours": "That deck belongs to another teacher.",
      "not-teaching": "You aren't teaching that course.",
      "no-deck": "That deck no longer exists.",
      "no-user": "No account with that handle.",
      "no-card": "That card no longer exists.",
      "bad-flag": "That isn't a kind of problem this app reports.",
      "note-required": "Say what went wrong and it can be looked into.",
      "name-required": "A name is needed.",
      "title-required": "A title is needed.",
      "too-large": "That is too big to store.",
      "not-in-course": "You aren't in that course.",
      "no-access": "You don't have access to that.",
      "not-yourself": "Use the danger zone in Account settings to close your own account.",
      "use-delete-account": "Delete your own account from Account settings instead.",
      "not-found": "That no longer exists.",
      "signup-code-required": "This site needs an invitation code to make an account.",
      "storage-unconfigured":
        "The server can't reach its storage. Check that DATA_DIR points at " +
        "a writable directory.",
      server: "The server hit an error. Check the site's function log.",
      "bad-response": "The server's answer wasn't in a form this app understands.",
    }[m] || `Something went wrong (${m}). Try again in a moment.`
  );
}
