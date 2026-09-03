/*
 * Talking to the courses endpoint.
 *
 * Everything needs the sign-in key, so it is held here rather than passed
 * around. Each call returns the parsed body; anything that isn't a 2xx
 * throws with the server's own error string, which the screens turn into
 * something a person can read.
 */

const ENDPOINT = "/api/courses";
const KEY_STORE = "arabic-account";

let currentKey = "";

export function setKey(key) {
  currentKey = key || "";
}

/* The account lives beside the trainer's own data rather than inside it,
   so signing in on a new device doesn't have to wait for a sync. */
export function loadAccount() {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

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

async function call(action, { body, params, key } = {}) {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

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

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("bad-response");
  }
  if (!res.ok) throw new Error(data.error || `http-${res.status}`);
  return data;
}

/* ---- accounts ---- */
export const signUp = (displayName, signupCode) =>
  call("signup", { body: { displayName, signupCode: signupCode || "" }, key: "" });
export const whoAmI = (key) => call("whoami", { key });
export const rename = (displayName) => call("rename", { body: { displayName } });
export const claimAdmin = (adminKey) => call("claim-admin", { body: { adminKey } });

/* ---- courses ---- */
export const myCourses = () => call("my-courses");
export const createCourse = (title, language, description) =>
  call("create-course", { body: { title, language, description } });
export const assignStudent = (courseId, handle) =>
  call("assign-student", { body: { courseId, handle } });
export const assignTeacher = (courseId, handle) =>
  call("assign-teacher", { body: { courseId, handle } });
export const removeMember = (courseId, handle, role) =>
  call("remove-member", { body: { courseId, handle, role } });
export const joinCourse = (code) => call("join-course", { body: { code } });
export const courseDecks = (courseId) => call("course-decks", { params: { course: courseId } });
/* Everything a student holds in one request. Pass the version from the last
   answer and the server replies { unchanged: true } when nothing moved. */
export const myMaterial = (version) =>
  call("my-material", { params: version ? { version } : {} });

/* ---- decks and cards ---- */
export const myDecks = () => call("my-decks");
export const createDeck = (title, description, lang) =>
  call("create-deck", { body: { title, description, lang } });
export const renameDeck = (deckId, title) => call("rename-deck", { body: { deckId, title } });
export const deleteDeck = (deckId) => call("delete-deck", { body: { deckId } });
export const myCards = () => call("my-cards");
/* The server calls this field "decks"; sending anything else means the
   card saves but never lands in a deck. */
export const saveCard = (card, decks) => call("save-card", { body: { card, decks } });
export const deleteCard = (cardId) => call("delete-card", { body: { cardId } });
export const deleteCards = (cardIds) => call("delete-cards", { body: { cardIds } });
export const deckCards = (deckId) => call("deck-cards", { params: { deck: deckId } });
export const attachDeck = (deckId, courseId) =>
  call("attach-deck", { body: { deckId, courseId } });
export const detachDeck = (deckId, courseId) =>
  call("detach-deck", { body: { deckId, courseId } });

/* ---- clips ---- */
export const putClip = (hash, data) => call("put-clip", { body: { hash, data } });
export const getClip = (hash) => call("clip", { params: { hash } });

export const deleteAccount = () => call("delete-account", { body: {} });

/* ---- admin ---- */
export const adminOverview = () => call("admin-overview");
export const backupManifest = () => call("admin-backup-manifest");
export const backupChunk = (keys) => call("admin-backup-chunk", { body: { keys } });
export const restoreChunk = (records) => call("admin-restore-chunk", { body: { records } });

export const createUser = (displayName, courseId, role) =>
  call("admin-create-user", { body: { displayName, courseId, role } });
export const reissueKey = (handle) => call("admin-reissue-key", { body: { handle } });
export const deleteUser = (handle) => call("admin-delete-user", { body: { handle } });
export const newCourseCode = (courseId, which) =>
  call("admin-new-code", { body: { courseId, which } });
export const deleteCourse = (courseId) => call("admin-delete-course", { body: { courseId } });
export const setCourseLanguage = (courseId, language) =>
  call("admin-course-language", { body: { courseId, language } });

/* Turn a server error into something worth reading. */
export function explain(err) {
  const m = String((err && err.message) || err);
  if (m === "unknown-action")
    return (
      "This part of the app is newer than the server. Upload the latest " +
      "netlify/functions/courses.js and let the site rebuild."
    );

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
      "name-required": "A name is needed.",
      "title-required": "A title is needed.",
      "too-large": "That is too big to store.",
      "not-in-course": "You aren't in that course.",
      "no-access": "You don't have access to that.",
      "not-yourself": "Use the danger zone in Account settings to close your own account.",
      "use-delete-account": "Delete your own account from Account settings instead.",
      "not-found": "That no longer exists.",
      "signup-code-required": "This site needs an invitation code to make an account.",
    }[m] || `Something went wrong (${m}). Try again in a moment.`
  );
}
