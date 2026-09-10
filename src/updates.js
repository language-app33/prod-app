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
 * One reload at the moment the handover happens ends the whole class of it:
 * refresh once and the page puts itself onto the new build, and an app left
 * open does it by itself the next time it is not being used.
 *
 * No part of this is the version line in the menu. That answers a different
 * question — "is what I merged actually running?" — by asking the server,
 * and it is right to keep asking even when nothing here has fired.
 */

/* A reload is cheap: everything a learner has done is written to the device
   as it happens. The one thing it would interrupt is a question they are
   part way through answering, so a session in flight holds it back. */
let held = false;
/* A worker took over while it was being held back. */
let waiting = false;

/* Only ever once in a stretch. A worker that kept changing — two tabs
   racing, a deploy loop — would otherwise be a page that kept reloading,
   and a reload loop is the one failure that cannot be got out of from
   inside the app. */
const GAP_MS = 10000;
const STAMP = "arabic-trainer:updated-at";

/** @param {string} key */
function stampOf(key) {
  try {
    return Number(sessionStorage.getItem(key) || 0);
  } catch (e) {
    return 0;
  }
}

/** @param {string} key */
function setStamp(key) {
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* A private window with storage switched off. The guard is a courtesy,
       not a correctness property: without it the reload still happens. */
  }
}

/* Go, unless we have just been. */
function reloadOnce() {
  if (Date.now() - stampOf(STAMP) < GAP_MS) return;
  setStamp(STAMP);
  window.location.reload();
}

/*
 * Whether a reload would land on top of something.
 *
 * Called by the trainer when a session starts and ends. A page nobody is
 * looking at is never in the way, whatever it says.
 */
/** @param {boolean} on */
export function holdUpdates(on) {
  held = !!on;
  if (!held && waiting) {
    waiting = false;
    reloadOnce();
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
 * Watch for the handover, and take it.
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

  sw.addEventListener("controllerchange", () => {
    if (!wasControlled) return;
    /* Held only while it would interrupt something. The moment that
       passes — the session ends, or the app is put away — it goes. */
    if (held && !document.hidden) {
      waiting = true;
      return;
    }
    reloadOnce();
  });

  /* A page put away with an update waiting takes it there and then, so
     coming back to the app is coming back to the new build. And a page
     picked up again asks whether anything has been deployed since, which
     is the moment a learner is most likely to have missed a day. */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (waiting) {
        waiting = false;
        reloadOnce();
      }
      return;
    }
    checkForUpdate();
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
