import { test } from "node:test";
import assert from "node:assert/strict";

/* The client reads window.location and localStorage at call time, so both
   have to exist before the module is imported.
 *
 * Part-implementations, cast: what is here is what the client reaches for,
 * and completing them would be standing in for a browser rather than
 * saying what this module needs from one. */
const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
anyGlobal.window = { location: { origin: "https://taleb.test" } };
anyGlobal.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const API = await import("../src/courses-api.js");

/* A stand-in for whatever answered: the body is text, as it is in a
   browser, so a non-JSON answer is reported the way a real one would be. */
/**
 * @param {number} status
 * @param {string} body
 * @param {string} [contentType]
 */
function answer(status, body, contentType = "application/json") {
  anyGlobal.fetch = async () => ({
    ok: status < 300,
    status,
    headers: { get: () => contentType },
    text: async () => body,
  });
}

test("a JSON error keeps the server's own error string", async () => {
  answer(401, JSON.stringify({ error: "bad-key" }));
  await assert.rejects(API.whoAmI("wrong"), { message: "bad-key" });
  assert.equal(API.explain(new Error("bad-key")), "That sign-in key isn't recognised.");
});

test("a platform 500 whose body isn't JSON reports the status, not bad-response", async () => {
  answer(500, "Internal Server Error", "text/plain");
  await assert.rejects(API.whoAmI("k"), { message: "http-500" });
  assert.match(API.explain(new Error("http-500")), /answered 500/);
});

test("the SPA's index.html served in place of the function names the missing endpoint", async () => {
  answer(404, "<!doctype html><html><body>app</body></html>", "text/html");
  await assert.rejects(API.whoAmI("k"), { message: "http-404" });
  assert.match(API.explain(new Error("http-404")), /no \/api\/courses endpoint/);
});

test("a server that cannot write is explained as storage, not as a bad key", async () => {
  answer(500, JSON.stringify({ error: "storage-unconfigured", detail: "..." }));
  await assert.rejects(API.whoAmI("k"), { message: "storage-unconfigured" });
  assert.match(API.explain(new Error("storage-unconfigured")), /DATA_DIR/);
});

test("only a 2xx that isn't JSON is a bad response", async () => {
  answer(200, "not json at all", "text/plain");
  await assert.rejects(API.whoAmI("k"), { message: "bad-response" });
});

test("a good answer is returned parsed", async () => {
  answer(200, JSON.stringify({ ok: true, user: { handle: "sara-4f2a" } }));
  const r = await API.whoAmI("right");
  assert.equal(r.user.handle, "sara-4f2a");
});
