/*
 * Whether there is a connection, as the app should read it.
 *
 * The app is offline-first, so being offline is an ordinary state and not
 * an error — but nothing said which one the app was in. Every failure
 * looked the same: the dot in the corner turned red, and the line beside
 * it said "Offline — will retry" whether the network was gone, the
 * passphrase was refused, or the document was too big to send. Meanwhile
 * the polls went on firing into the void every forty-five seconds.
 *
 * So the state is held here, in one place, for the two kinds of reader it
 * has: a plain function for the module-level helpers that decide what a
 * session may ask, and a subscription for the components that show it.
 *
 * `navigator.onLine` is the browser's own answer and it is famously
 * generous — a laptop on a wifi network with no route to the internet
 * reads as online. That is why it is only ever used to say *offline* with
 * confidence, never to promise that a request will succeed. False here
 * means "do not bother"; true means "worth trying", which is the most any
 * caller needs.
 */

/** True only when the browser is sure there is no connection. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

type Listener = (offline: boolean) => void;

/*
 * Told once, here, rather than by every component adding its own pair of
 * listeners. The set is module-level because the events are: there is one
 * connection and one browser saying so.
 */
const listeners: Set<Listener> = new Set();
let wired = false;

function announce() {
  const off = isOffline();
  for (const fn of [...listeners]) {
    try {
      fn(off);
    } catch (e) {
      /* One subscriber throwing must not stop the rest hearing about it. */
    }
  }
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", announce);
  window.addEventListener("offline", announce);
}

/**
 * Hear about the connection coming and going.
 *
 * @returns the way to stop hearing about it, so a component that
 *          subscribes on mount can drop it on unmount.
 */
export function watchNet(fn: Listener): () => void {
  wire();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
