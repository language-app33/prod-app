/*
 * Which release is this, and which build?
 *
 * Two different questions, so two different answers, and neither one does
 * the other's job.
 *
 *   release  what you are on, and roughly what is in it: 0.1, 0.2, 0.3.
 *            A number that counts, kept by hand in package.json and moved
 *            when something a person would notice ships.
 *   commit   which exact build. The thing that changes on every deploy and
 *            can be matched against GitHub — so it, not the release, is
 *            what tells you whether what you merged is actually running.
 *            Two builds of 0.3 are still two builds.
 *
 * Three places to look for the commit, in order of how much they can be
 * trusted:
 *
 *   RAILWAY_GIT_COMMIT_SHA  the host tells us what it checked out. Set
 *                           during a Railway build, and the only source
 *                           that is right even without a .git directory.
 *   GIT_COMMIT_SHA          the same thing under a name another host might
 *                           use, and the one to set by hand.
 *   git rev-parse           a build on someone's own machine.
 *
 * If all three fail the commit is unknown, and the timestamp carries it
 * alone — less legible, but it still changes on every deploy, which is
 * the point.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const short = (sha) => String(sha || "").trim().slice(0, 7);

function fromGit() {
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (e) {
    /* No git, or not a checkout. Not worth a warning: the timestamp still
       distinguishes one build from the next. */
    return "";
  }
}

/*
 * Two digits, always. The third one npm insists on is not part of the
 * scheme and is never shown: 0.1.0 is release 0.1, and the next release is
 * 0.2. The second digit is a counter rather than a decimal, so 0.9 is
 * followed by 0.10.
 */
export function formatRelease(version) {
  const m = /^(\d+)\.(\d+)/.exec(String(version || "").trim());
  return m ? `${m[1]}.${m[2]}` : "";
}

/* Relative to this file, not to the working directory: the build runs from
   the project root but the tests run this module from a temp directory. */
function fromPackage() {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch (e) {
    return "";
  }
}

export function appVersion(env = process.env, now = new Date(), version = fromPackage()) {
  const commit = short(env.RAILWAY_GIT_COMMIT_SHA) || short(env.GIT_COMMIT_SHA) || fromGit();
  return {
    release: formatRelease(version),
    commit: commit || "unknown",
    builtAt: now.toISOString(),
  };
}
