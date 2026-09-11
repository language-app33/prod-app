/*
 * Ambient declarations: things that exist at run time but that no import
 * can point the checker at.
 *
 * The only TypeScript file in the project, and it holds no code — a .d.ts
 * describes, it does not compile, and nothing ships from it. There is no
 * other mechanism for either of the two facts below, both of which are
 * true of the running app and invisible to a reader of the source alone.
 */

/* Vite turns a CSS import into a side effect that injects the stylesheet.
   There is no module to find, which is exactly what the checker complains
   about, so it is told that these imports exist and carry nothing. */
declare module "*.css";

/*
 * Stamped into the bundle at build time by vite.config.js, so the corner
 * menu can say which build it is running — see scripts/version.mjs. They
 * exist in the built app and in nothing the checker can follow, which is
 * why eslint.config.js has to declare them as globals too.
 */
declare const __APP_RELEASE__: string;
declare const __APP_VERSION__: string;
declare const __BUILT_AT__: string;

interface Window {
  /*
   * The learner's app was written against the Claude artifact storage API
   * and still reads window.storage; main.jsx points that at the
   * localStorage adapter in storage.ts before the first render. See the
   * comment at the top of storage.ts for why it is shaped this way.
   */
  storage: typeof import("./storage.ts").storage;
}
