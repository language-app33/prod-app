/*
 * Talking to the courses endpoint.
 *
 * Everything needs the sign-in key, so it is held here rather than passed
 * around. Each call returns the parsed body; anything that isn't a 2xx
 * throws with the server's own error string, which the screens turn into
 * something a person can read.
 */
import type { Card, Flag, LangId, User } from "./types.ts";

const ENDPOINT = "/api/courses";
const KEY_STORE = "arabic-account";

let currentKey = "";

/** @param key  Null when there is no account: `|| ""` takes it. */
export function setKey(key?: string | null) {
  currentKey = key || "";
}

/* The account lives beside the trainer's own data rather than inside it,
   so signing in on a new device doesn't have to wait for a sync. */
export function loadAccount(): (User & { key: string }) | null {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveAccount(account: (User & { key: string }) | null) {
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
 */
async function call(
  action: string,
  { body, params, key }: { body?: unknown; params?: Record<string, string>; key?: string } = {},
): Promise<any> {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = { "content-type": "application/json" };
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
export const signUp = (displayName: string, signupCode?: string) =>
  call("signup", { body: { displayName, signupCode: signupCode || "" }, key: "" });
export const whoAmI = (key: string) => call("whoami", { key });
export const rename = (displayName: string) => call("rename", { body: { displayName } });
/* "Some learning just happened." The server keeps the moment and nothing
   else — what was practiced and how it went are in the device's own
   document, which never passes through here. */
export const practiced = () => call("practiced", { body: {} });
export const claimAdmin = (adminKey: string) => call("claim-admin", { body: { adminKey } });

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
 */
export type FlagReport = Pick<Flag, "kind" | "note" | "cardId" | "exercise" | "subId" | "prompt" | "meaning"> & {
  language: LangId;
};

export const reportFlag = (flag: FlagReport): Promise<{ ok: true; id: string }> =>
  call("report-flag", { body: flag });

/* ---- courses ---- */
export const myCourses = () => call("my-courses");
export const createCourse = (title: string, language: LangId, description?: string) =>
  call("create-course", { body: { title, language, description } });
export const assignStudent = (courseId: string, handle: string) =>
  call("assign-student", { body: { courseId, handle } });
export const assignTeacher = (courseId: string, handle: string) =>
  call("assign-teacher", { body: { courseId, handle } });
export const removeMember = (courseId: string, handle: string, role: "teacher" | "student") =>
  call("remove-member", { body: { courseId, handle, role } });
export const joinCourse = (code: string) => call("join-course", { body: { code } });
export const courseDecks = (courseId: string) => call("course-decks", { params: { course: courseId } });
/* Everything a student holds in one request. Pass the version from the last
   answer and the server replies { unchanged: true } when nothing moved. */
export const myMaterial = (version?: string) =>
  call("my-material", { params: version ? { version } : {} });

/* ---- decks and cards ---- */
export const myDecks = () => call("my-decks");
export const createDeck = (title: string, description: string, lang: LangId) =>
  call("create-deck", { body: { title, description, lang } });
export const renameDeck = (deckId: string, title: string) => call("rename-deck", { body: { deckId, title } });
export const deleteDeck = (deckId: string) => call("delete-deck", { body: { deckId } });
export const myCards = () => call("my-cards");
/* The server calls this field "decks"; sending anything else means the
   card saves but never lands in a deck. */
export const saveCard = (card: Partial<Card>, decks: string[]) => call("save-card", { body: { card, decks } });
export const deleteCard = (cardId: string) => call("delete-card", { body: { cardId } });
export const deleteCards = (cardIds: string[]) => call("delete-cards", { body: { cardIds } });
export const deckCards = (deckId: string) => call("deck-cards", { params: { deck: deckId } });
export const attachDeck = (deckId: string, courseId: string) =>
  call("attach-deck", { body: { deckId, courseId } });
export const detachDeck = (deckId: string, courseId: string) =>
  call("detach-deck", { body: { deckId, courseId } });

/* ---- clips ---- */
export const putClip = (hash: string, data: string) => call("put-clip", { body: { hash, data } });
export const getClip = (hash: string): Promise<{ ok: true; hash: string; data: string }> =>
  call("clip", { params: { hash } });

export const deleteAccount = () => call("delete-account", { body: {} });

/* ---- admin ---- */
export const adminOverview = () => call("admin-overview");
export const backupManifest = () => call("admin-backup-manifest");
export const backupChunk = (keys: string[]) => call("admin-backup-chunk", { body: { keys } });
export const restoreChunk = (records: Record<string, unknown>) => call("admin-restore-chunk", { body: { records } });

/* Clearing what a backup would have held. Carries the deploy's admin key as
   well as the signed-in administrator: this is the one call that removes
   things wholesale, and being signed in as an administrator is a thing a
   borrowed phone is. */
export const clearData = (adminKey: string, parts: string[]) => call("admin-clear", { body: { adminKey, parts } });

/* `roles` is a list because someone can teach a course and study it, and
   asking for both when the person is made saves going back to add the
   second by hand. */
export const createUser = (displayName: string, courseId: string, roles: ("teacher" | "student")[]): Promise<any> =>
  call("admin-create-user", { body: { displayName, courseId, roles } });
export const reissueKey = (handle: string) => call("admin-reissue-key", { body: { handle } });
export const deleteUser = (handle: string) => call("admin-delete-user", { body: { handle } });
export const newCourseCode = (courseId: string, which: "teacher" | "student") =>
  call("admin-new-code", { body: { courseId, which } });
export const deleteCourse = (courseId: string) => call("admin-delete-course", { body: { courseId } });
export const renameCourse = (courseId: string, title: string) =>
  call("admin-rename-course", { body: { courseId, title } });
export const setCourseLanguage = (courseId: string, language: LangId) =>
  call("admin-course-language", { body: { courseId, language } });
/* Flags are read with the rest of the overview; this is the only thing done
   to them. Dealt with means dealt with — there is nothing to keep. */
export const deleteFlags = (flagIds: string[]): Promise<{ ok: true; deleted: number }> =>
  call("admin-delete-flags", { body: { flagIds } });
/* One card, fetched when a report about it is opened. Admin lists decks
   rather than cards, so it holds none of them until one is asked for. */
export const adminCard = (cardId: string): Promise<{ ok: true; card: Card }> =>
  call("admin-card", { params: { card: cardId } });

/* Turn a server error into something worth reading. */
export function explain(err: unknown): string {
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
