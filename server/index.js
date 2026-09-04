/*
 * The whole site in one process: the built app, and the two endpoints
 * behind /api.
 *
 * The endpoints were written for Netlify Functions, whose handlers take a
 * Request and return a Response. Node has both, so they run here unchanged
 * and this file only has to translate between Node's streams and them, and
 * to apply the routing and cache headers netlify.toml used to describe.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import courses from "./api/courses.js";
import sync from "./api/sync.js";
import { dataRoot } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DIST_DIR || path.join(here, "..", "dist");
const PORT = Number(process.env.PORT) || 3000;

/* The sync endpoint accepts documents up to 4MB and clips up to 1MB, and
   both arrive base64'd inside JSON. This is the point past which a body is
   refused outright, rather than buffered and then rejected. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const ROUTES = { "/api/courses": courses, "/api/sync": sync };

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/* What netlify.toml said, and for the same reasons. Vite fingerprints the
   names under /assets, so those can be kept forever; the service worker and
   the manifest must never be stale or an installed app won't see an
   update. */
function cacheFor(urlPath) {
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (urlPath === "/sw.js" || urlPath === "/manifest.webmanifest") return "no-cache";
  return "public, max-age=0, must-revalidate";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("too-large"), { tooLarge: true }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toRequest(req, body) {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url, `http://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    /* Node gives set-cookie as an array; nothing here reads it, but the
       Headers API still has to be fed one value at a time. */
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url.toString(), {
    method: req.method,
    headers,
    body: hasBody && body && body.length ? body : undefined,
  });
}

async function sendResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

const asJson = (res, body, status) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
};

async function serveStatic(res, urlPath, method) {
  /* Resolve first, then check the result is still inside dist: that catches
     traversal however it was spelled, including encoded forms. */
  const decoded = decodeURIComponent(urlPath);
  const target = path.resolve(DIST, `.${decoded}`);
  const inside = target === DIST || target.startsWith(DIST + path.sep);

  let file = null;
  if (inside) {
    const found = await stat(target).catch(() => null);
    if (found && found.isDirectory()) {
      const index = path.join(target, "index.html");
      if (await stat(index).catch(() => null)) file = index;
    } else if (found && found.isFile()) {
      file = target;
    }
  }

  /* A single page app: anything that isn't a real file is a route within
     it, and gets the shell with a 200, because the client router — not the
     server — decides whether that route exists. Requests under /api never
     reach here, so a missing endpoint can't be answered with HTML. */
  const served = file || path.join(DIST, "index.html");

  const body = await readFile(served).catch(() => null);
  if (body === null) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found. The app has not been built: run npm run build.");
    return;
  }

  res.writeHead(200, {
    "content-type": TYPES[path.extname(served)] || "application/octet-stream",
    "cache-control": cacheFor(file ? decoded : "/index.html"),
    "content-length": body.length,
  });
  res.end(method === "HEAD" ? undefined : body);
}

export function createApp() {
  return createServer(async (req, res) => {
    try {
      const urlPath = new URL(req.url, "http://localhost").pathname;
      const handler = ROUTES[urlPath];

      if (handler) {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          if (err && err.tooLarge) return asJson(res, { error: "too-large" }, 413);
          throw err;
        }
        const response = await handler(toRequest(req, body));
        return await sendResponse(res, response);
      }

      if (urlPath.startsWith("/api/")) {
        /* Better than the app shell: an endpoint that doesn't exist says so
           in the form the client can read. */
        return asJson(res, { error: "unknown-endpoint" }, 404);
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return asJson(res, { error: "method" }, 405);
      }

      return await serveStatic(res, urlPath, req.method);
    } catch (err) {
      console.error("request failed:", err);
      if (!res.headersSent) return asJson(res, { error: "server" }, 500);
      res.end();
    }
  });
}

/* Started directly rather than imported by a test. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => {
    console.log(`taleb33 listening on ${PORT}`);
    console.log(`serving ${DIST}`);
    console.log(`storing data under ${dataRoot}`);
  });
}
