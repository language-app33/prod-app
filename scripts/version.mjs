/*
 * Which build is this?
 *
 * The question the version line in the corner menu has to answer is "is what
 * I merged actually running?", so a number kept by hand in package.json is
 * no use: it would say 1.0.0 on either side of a deploy. The commit is the
 * thing that changes with every merge and is the thing you can compare
 * against what you see on GitHub.
 *
 * Three places to look for it, in order of how much they can be trusted:
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

export function appVersion(env = process.env, now = new Date()) {
  const commit = short(env.RAILWAY_GIT_COMMIT_SHA) || short(env.GIT_COMMIT_SHA) || fromGit();
  return {
    commit: commit || "unknown",
    builtAt: now.toISOString(),
  };
}
