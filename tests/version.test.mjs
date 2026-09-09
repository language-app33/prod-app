// @ts-check
/*
 * The version has two jobs: name the release a person is on, and name the
 * build so it can be matched against GitHub. These are the ways either one
 * could quietly fail.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appVersion, formatRelease } from "../scripts/version.mjs";

const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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

test("a release is two digits, and the third is never shown", () => {
  assert.equal(formatRelease("0.1.0"), "0.1");
  assert.equal(formatRelease("0.2.0"), "0.2");
  /* npm wants three parts; the scheme has two. A patch number that crept
     in must not reach the corner menu. */
  assert.equal(formatRelease("0.4.2"), "0.4");
});

test("the second digit counts rather than divides", () => {
  /* 0.10 comes after 0.9, and must not be read — or printed — as 0.1. */
  assert.equal(formatRelease("0.10.0"), "0.10");
  assert.equal(formatRelease("1.0.0"), "1.0");
});

test("nothing usable is blank, not a guess", () => {
  for (const bad of ["", "   ", "banana", "v0.1", null, undefined, "1"]) {
    assert.equal(formatRelease(bad), "", `expected no release from ${JSON.stringify(bad)}`);
  }
});

test("the release comes from package.json, which is the only place it lives", () => {
  assert.equal(appVersion({}, new Date(), "0.7.0").release, "0.7");
  /* No argument: the real file, so a bump that broke the field fails here
     rather than shipping a blank version line. */
  assert.match(appVersion({}).release, /^\d+\.\d+$/);
  assert.equal(appVersion({}).release, formatRelease(PKG.version));
});

test("package.json keeps to the scheme", () => {
  /* Guards the numbering itself: two digits that count, a reserved 1.0,
     and the trailing zero npm insists on. */
  assert.match(PKG.version, /^0\.\d+\.0$/);
});
