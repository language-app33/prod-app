/*
 * How the deploy starts the server, and how it stops.
 *
 * The stopping is the part that went wrong for months without anyone
 * noticing: the builder starts a Node app with `npm run start` unless it is
 * told otherwise, which puts npm and a shell between the host and the
 * server. A deploy then sends SIGTERM to npm, npm dies of it and exits 143,
 * and two things follow — the server never hears the signal, so its careful
 * shutdown never runs and requests in flight are cut off, and every
 * routine deploy is reported as a crash.
 *
 * Neither half is visible in a build log, in a test of the server's own
 * handlers, or anywhere else this suite was looking. So both are checked
 * here, against the command the deploy actually runs, read from the file
 * the deploy actually reads.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");

/* One line out of the file, by hand. Node has no TOML parser and this needs
   one key: a dependency for that would be a dependency to keep. */
function startCommand() {
  const toml = readFileSync(path.join(root, "railway.toml"), "utf8");
  const found = /^\s*startCommand\s*=\s*"([^"]+)"/m.exec(toml);
  return found ? found[1] : "";
}

test("the deploy starts the server itself, with nothing in between", () => {
  const cmd = startCommand();
  assert.ok(cmd, "railway.toml names no start command, so the builder picks one");
  /* The whole point: a package manager in the middle swallows the signal
     and turns every stop into a crash. */
  assert.doesNotMatch(cmd, /^(npm|npx|yarn|pnpm|bun)\b/, `the deploy runs "${cmd}" through a package manager`);
  assert.match(cmd, /^node .*server\/index\.js$/, `expected node to be started directly, got "${cmd}"`);
});

test("and the process it starts stops cleanly when a deploy asks it to", async () => {
  const [cmd, ...args] = startCommand().split(/\s+/);
  const dir = await mkdtemp(path.join(tmpdir(), "taleb-deploy-"));
  /* Spawned without a shell, which is the shape that matters: the signal
     has to reach the thing that was started. */
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, PORT: "0", DATA_DIR: dir, ADMIN_KEY: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let said = "";
  child.stdout.on("data", (d) => (said += String(d)));
  child.stderr.on("data", (d) => (said += String(d)));

  const ended = new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  /* Up and listening before it is asked to stop, or the test would be
     measuring a process that had not started yet. */
  await new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => reject(new Error(`never started: ${said}`)), 10000);
    const look = setInterval(() => {
      if (/listening on/.test(said)) {
        clearInterval(look);
        clearTimeout(giveUp);
        resolve(undefined);
      }
    }, 50);
  });

  child.kill("SIGTERM");
  /* A stop that never happens must fail rather than hang. It is the shape
     the broken arrangement actually took: signalling npm left the server
     orphaned and running, holding this open for ever. */
  const gaveUp = Symbol("gave up");
  const timer = new Promise((resolve) => setTimeout(() => resolve(gaveUp), 8000));
  const stopped = await Promise.race([ended, timer]);
  if (stopped === gaveUp) {
    child.kill("SIGKILL");
    await rm(dir, { recursive: true, force: true });
    assert.fail(`it did not stop when asked. Output: ${said}`);
  }
  const { code, signal } = /** @type {{ code: number | null, signal: string | null }} */ (stopped);

  assert.equal(signal, null, "it was killed rather than allowed to stop");
  assert.equal(code, 0, `a deploy's stop must not read as a crash — exited ${code}. Output: ${said}`);
  assert.match(said, /SIGTERM/, "the signal never reached the server");
  await rm(dir, { recursive: true, force: true });
});
