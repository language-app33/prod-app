/*
 * Staying on the build that is actually deployed.
 *
 * The service worker this app ships calls skipWaiting and clientsClaim, so
 * a newly deployed one takes charge of the page the moment it has
 * installed. What nothing did was tell the page. The tab you were looking
 * at went on running the build it loaded with, while the files for the
 * *next* load came from the new worker — so:
 *
 *   refresh once   the browser fetches the new worker during the
 *                  navigation, installs it and hands it the page. What you
 *                  are shown is still the old build, because it was served
 *                  before any of that happened.
 *   refresh again  now the new worker answers, and you see the new build.
 *
 * That is the two refreshes, and they happened on every deploy. Pressing
 * Reload before the handover had finished put you back at the start of it,
 * which is the third press.
 *
 * One reload at the moment the handover happens ends the whole class of it —
 * but only where it can cost nothing. A page nobody has touched yet (the
 * refresh above, a fresh launch) takes it by itself. A page somebody has
 * typed or tapped on is told instead, and offers Reload: a reload there
 * could throw away what is on screen and not yet saved.
 *
 * No part of this is the version line in the menu. That answers a different
 * question — "is what I merged actually running?" — by asking the server,
 * and it is right to keep asking even when nothing here has fired.
 */

/*
 * What has to happen first, whenever a reload does happen.
 *
 * Everything a learner does is written to the device, but the write is
 * debounced, so a reload landing in the six hundred milliseconds after an
 * answer would take the answer with it. The trainer registers its flush
 * here and applyUpdate calls it before going. Synchronous on purpose: the
 * storage write underneath is, and a promise awaited across
 * `location.reload()` is a promise nobody is left to keep.
 */
const beforeReloads: Set<() => void> = new Set();

/**
 * Something to do before any reload this module brings on.
 *
 * Returns the way to take it back off again, so a component that
 * registers on mount can drop it on unmount.
 */
export function beforeReload(fn: () => void): () => void {
  beforeReloads.add(fn);
  return () => {
    beforeReloads.delete(fn);
  };
}

function runBeforeReloads() {
  for (const fn of beforeReloads) {
    try {
      fn();
    } catch (e) {
      /* A reload somebody asked for has to happen; one registered hook
         throwing is not a reason to strand the page on an old build. */
    }
  }
}

/*
 * Whether a newer build has taken charge of this page.
 *
 * The page used to reload itself the moment that happened (or, during a
 * session, the moment the session ended or the app was put away). That
 * threw away whatever was on screen and not yet saved — a card half
 * written in the editor, a form part filled — and nothing a flush can do
 * saves a text box that has not been submitted. Only the person knows
 * whether now is a good moment, so the page says an update is ready and
 * waits for Reload to be pressed.
 */
let ready = false;

/* Whether anybody has done anything on this page yet. Until they have,
   there is nothing on it a reload could lose. */
let touched = false;

/* Only ever once in a stretch. A worker that kept changing — two tabs
   racing, a deploy loop — would otherwise be a page that kept reloading,
   and a reload loop is the one failure that cannot be got out of from
   inside the app. */
const GAP_MS = 10000;
const STAMP = "arabic-trainer:updated-at";

function stampOf(key: string) {
  try {
    return Number(sessionStorage.getItem(key) || 0);
  } catch (e) {
    return 0;
  }
}

function setStamp(key: string) {
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* A private window with storage switched off. The guard is a courtesy,
       not a correctness property. */
  }
}
const readyListeners: Set<(ready: boolean) => void> = new Set();

export function updateReady() {
  return ready;
}

/** Hear when an update becomes ready. Returns the way to stop hearing. */
export function onUpdateReady(fn: (ready: boolean) => void): () => void {
  readyListeners.add(fn);
  return () => {
    readyListeners.delete(fn);
  };
}

function markReady() {
  if (ready) return;
  ready = true;
  for (const fn of readyListeners) {
    try {
      fn(true);
    } catch (e) {
      /* One listener failing does not stop the others hearing. */
    }
  }
}

/* The worker in charge of this page, if there is one to ask. */
function workers() {
  return typeof navigator !== "undefined" && navigator.serviceWorker
    ? navigator.serviceWorker
    : null;
}

/* Ask whether a new one has been deployed. Quiet about the answer: what
   happens next is the browser's business, and the page hears about it
   through controllerchange like any other handover. */
export async function checkForUpdate() {
  const sw = workers();
  if (!sw) return;
  try {
    const reg = await sw.getRegistration();
    if (reg) await reg.update();
  } catch (e) {
    /* Offline, or the deploy is not reachable. Nothing to say: this runs on
       every launch and every return to the app. */
  }
}

/*
 * Watch for the handover, and take it — by itself only where that costs
 * nothing, otherwise when Reload is pressed.
 *
 * Registered once, at startup, before anything renders — the handover can
 * happen at any moment, including during the first paint.
 */
export function watchForUpdates() {
  const sw = workers();
  if (!sw) return;

  /* Read now, not in the handler: by the time a worker has taken over,
     "was anything controlling this page before?" cannot be asked any more.
     A page that had none is a first install rather than an update, and
     reloading for it would be a reload for nothing. */
  const wasControlled = !!sw.controller;

  /* Capturing, so nothing on the page can stop it hearing. */
  const touch = () => {
    touched = true;
  };
  for (const type of ["pointerdown", "keydown", "input"]) {
    window.addEventListener(type, touch, { capture: true, passive: true });
  }

  sw.addEventListener("controllerchange", () => {
    if (!wasControlled) return;
    /* Untouched, a reload loses nothing and saves the second refresh.
       Touched, it is said rather than done: see `ready` above. */
    if (!touched && Date.now() - stampOf(STAMP) >= GAP_MS) {
      setStamp(STAMP);
      runBeforeReloads();
      window.location.reload();
      return;
    }
    markReady();
  });

  /* A page picked up again asks whether anything has been deployed since,
     which is the moment a learner is most likely to have missed a day. */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });

  /* And on launch, rather than waiting for the browser's own check on the
     next navigation — which is the check that used to cost a refresh. */
  checkForUpdate();
}

/*
 * Apply an update now, because somebody pressed Reload.
 *
 * The hard part is not the reload, it is that a reload is answered by
 * whichever worker is in charge at that moment. Reloading straight away
 * reloads while the old one still is, so the old files come back and the
 * button looks broken.
 *
 * So: ask for the update, and let the handover be what triggers the
 * reload — the same handover watchForUpdates is listening for. The timeout
 * is for the cases where there is nothing to hand over: already up to date,
 * no worker at all, or a deploy that cannot be reached. Reloading then is
 * still the right answer, and it is what the button promises.
 */
export function applyUpdate() {
  return new Promise((resolve) => {
    const sw = workers();
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      /* Straight past the guard: this one was asked for. */
      setStamp(STAMP);
      runBeforeReloads();
      window.location.reload();
      resolve(undefined);
    };
    const giveUp = setTimeout(go, 5000);

    if (!sw) return go();
    sw.addEventListener("controllerchange", go, { once: true });

    sw.getRegistration()
      .then(async (reg) => {
        if (!reg) return go();
        await reg.update();
        const fresh = reg.installing || reg.waiting;
        /* Nothing new to wait for: either the worker had already updated in
           the background — in which case this page is simply behind it —
           or there is nothing deployed to update to. */
        if (!fresh) return go();
        /* Belt and braces for a worker built without skipWaiting, which
           would otherwise sit in waiting until every tab is closed. */
        const nudge = () => reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" });
        nudge();
        fresh.addEventListener("statechange", () => {
          nudge();
          if (fresh.state === "activated") go();
        });
      })
      .catch(go)
      .finally(() => {
        if (done) clearTimeout(giveUp);
      });
  });
}
