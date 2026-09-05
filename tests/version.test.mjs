/*
 * The version has one job: change when a deploy changes, and be the same
 * string you can find on GitHub. These are the ways it could quietly fail
 * to do that.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { appVersion } from "../scripts/version.mjs";

test("the host's commit wins, shortened to what GitHub shows", () => {
  const v = appVersion({ RAILWAY_GIT_COMMIT_SHA: "735ade6a1b2c3d4e5f60718293a4b5c6d7e8f900" });
  assert.equal(v.commit, "735ade6");
});

test("a second name for the same thing, for a host that isn't Railway", () => {
  assert.equal(appVersion({ GIT_COMMIT_SHA: "abcdef1234567" }).commit, "abcdef1");
  /* Railway's wins when both are set: it is the one the host itself put
     there, so it describes what was actually checked out. */
  assert.equal(
    appVersion({ RAILWAY_GIT_COMMIT_SHA: "1111111aaaa", GIT_COMMIT_SHA: "2222222bbbb" }).commit,
    "1111111",
  );
});

test("an empty variable is not an answer", () => {
  /* A host that sets the name but leaves it blank would otherwise produce
     an empty version, which reads as a broken build rather than an
     unknown one. Falls through to git, which is a real checkout here. */
  const v = appVersion({ RAILWAY_GIT_COMMIT_SHA: "", GIT_COMMIT_SHA: "   " });
  assert.match(v.commit, /^[0-9a-f]{7}$/);
});

test("with nothing to go on it says so rather than inventing something", async () => {
  /* Run where there is no checkout and no variables: the commit is
     honestly unknown, and the timestamp is left to distinguish builds. */
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "taleb-nogit-"));
  const here = path.dirname(new URL(import.meta.url).pathname);
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(path.join(here, "..", "scripts", "version.mjs"))})` +
        `.then((m) => console.log(m.appVersion({}).commit))`,
    ],
    { cwd: dir, stdio: ["ignore", "pipe", "ignore"] },
  )
    .toString()
    .trim();
  assert.equal(out, "unknown");
});

test("every build is stamped, and the stamp is a real date", () => {
  const v = appVersion({}, new Date("2026-09-05T13:00:00.000Z"));
  assert.equal(v.builtAt, "2026-09-05T13:00:00.000Z");
  assert.equal(Number.isNaN(new Date(appVersion({}).builtAt).getTime()), false);
});
