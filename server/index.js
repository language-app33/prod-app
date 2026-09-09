// @ts-check
/*
 * The whole site in one process: the built app, and the two endpoints
 * behind /api.
 *
 * The endpoints were written for Netlify Functions, whose handlers take a
 * Request and return a Response. Node has both, so they run here unchanged
 * and this file only has to translate between Node's streams and them, and
 * to apply the routing and cache headers netlify.toml used to describe.
 */

/** @import { IncomingMessage, Server, ServerResponse } from "node:http" */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import courses from "./api/courses.js";
import sync from "./api/sync.js";
import { dataRoot, dataRootFrom, dataRootDurable } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DIST_DIR || path.join(here, "..", "dist");
const PORT = Number(process.env.PORT) || 3000;

/* The sync endpoint accepts documents up to 4MB and clips up to 1MB, and
   both arrive base64'd inside JSON. This is the point past which a body is
   refused outright, rather than buffered and then rejected. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/* Open, because the path a request arrives on is a string like any
   other and the lookup below has to be able to miss. */
/** @type {Record<string, (req: Request) => Promise<Response>>} */
const ROUTES = { "/api/courses": courses, "/api/sync": sync };

/*
 * What is actually deployed.
 *
 * Read from dist rather than from the environment, so this reports the
 * build being served and not merely the commit this process was started
 * with — those come apart the moment a container serves a dist it did not
 * build. Read on every request, and not cached, because the whole value of
 * the answer is that it is current: the browser is asking it precisely
 * because the copy it holds may be stale.
 */
/** @param {ServerResponse} res */
async function serveVersion(res) {
  const text = await readFile(path.join(DIST, "version.json"), "utf8").catch(() => null);
  if (text === null) return asJson(res, { error: "unbuilt" }, 404);
  try {
    return asJson(res, JSON.parse(text), 200);
  } catch (err) {
    return asJson(res, { error: "unreadable" }, 500);
  }
}

/** @type {Record<string, string>} */
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
/** @param {string} urlPath */
function cacheFor(urlPath) {
  if (urlPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (urlPath === "/sw.js" || urlPath === "/manifest.webmanifest") return "no-cache";
  return "public, max-age=0, must-revalidate";
}

/**
 * @param {IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on("data", (/** @type {Buffer} */ chunk) => {
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

/**
 * @param {IncomingMessage} req
 * @param {Buffer} [body]
 */
function toRequest(req, body) {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url || "/", `http://${host}`);
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
    /* A Buffer is a Uint8Array and Request takes one. The DOM's BodyInit
       is written for views onto a plain ArrayBuffer, which is narrower
       than what Node hands out and than what the runtime accepts. */
    body: hasBody && body && body.length ? /** @type {BodyInit} */ (body) : undefined,
  });
}

/**
 * @param {ServerResponse} res
 * @param {Response} response
 */
async function sendResponse(res, response) {
  /** @type {Record<string, string>} */
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

/**
 * @param {ServerResponse} res
 * @param {unknown} body
 * @param {number} status
 */
const asJson = (res, body, status) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
};

/**
 * @param {ServerResponse} res
 * @param {string} urlPath
 * @param {string} [method]
 */
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
      const urlPath = new URL(req.url || "/", "http://localhost").pathname;

      if (urlPath === "/api/version") return await serveVersion(res);

      const handler = ROUTES[urlPath];

      if (handler) {
        let body;
        try {
          body = await readBody(req);
        } catch (err) {
          if (typeof err === "object" && err && "tooLarge" in err) {
            return asJson(res, { error: "too-large" }, 413);
          }
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

/*
 * Stop when asked to, rather than being killed where we stand.
 *
 * A deploy sends SIGTERM. With nothing listening for it Node dies on the
 * spot: npm reports its child as having failed on a signal — five red lines
 * that read like a crash on every routine restart — and, more to the point,
 * whatever request was in flight is severed. A card being saved, a sync being
 * written. The window is small but it is not nothing.
 *
 * Closing the server stops new connections and lets the ones in hand finish.
 * The timer is the backstop: a held-open connection must not keep the
 * container alive past the host's patience, which is short — SIGKILL follows
 * SIGTERM within seconds either way, and going out at our own hand is tidier
 * than being shot.
 *
 * (The documents themselves were never at risk. store.js writes to a
 * temporary file and renames it into place, so a process killed mid-write
 * leaves the previous version whole.)
 */
const SHUTDOWN_GRACE_MS = 5000;

/** @param {Server} server */
function closeOn(server) {
  let closing = false;
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      /* A second signal means impatience, and should be obeyed. */
      if (closing) process.exit(0);
      closing = true;
      console.log(`${signal} — finishing what's in flight, then stopping`);
      const cutoff = setTimeout(() => {
        console.log("took too long; stopping anyway");
        process.exit(0);
      }, SHUTDOWN_GRACE_MS);
      /* Do not hold the loop open for the timer's own sake. */
      if (cutoff.unref) cutoff.unref();
      server.close(() => {
        clearTimeout(cutoff);
        console.log("stopped");
        process.exit(0);
      });
      /* close() alone waits for every open socket, and a browser keeps one
         idling between requests — so without this a deploy would sit out the
         full grace period for a connection with nothing on it. Idle sockets
         go now; the ones mid-request are what close() is waiting for. */
      if (server.closeIdleConnections) server.closeIdleConnections();
    });
  }
}

/* Started directly rather than imported by a test. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createApp();
  closeOn(server);
  server.listen(PORT, () => {
    console.log(`taleb33 listening on ${PORT}`);
    console.log(`serving ${DIST}`);
    console.log(`storing data under ${dataRoot} (from ${dataRootFrom})`);
    /* The failure this guards against is silent: accounts are made, courses
       are taught, and it all disappears at the next deploy. Say so loudly
       while there is still nothing to lose. */
    if (!dataRootDurable) {
      console.warn(
        "WARNING: no volume and no DATA_DIR, so documents are being written " +
          "to this container's own disk. Everything stored — accounts, " +
          "courses, decks — is lost on the next deploy or restart. Attach a " +
          "volume, or set DATA_DIR to somewhere that persists.",
      );
    }
  });
}
