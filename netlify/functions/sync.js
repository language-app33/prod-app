import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

/*
 * Sync endpoint.
 *
 * There are no accounts. The passphrase is the whole credential: the
 * client sends its SHA-256, and the storage key is a further hash of
 * that. Two devices using the same passphrase share a document; nobody
 * without it can guess the key.
 *
 * The client does the merging. This endpoint only reads and writes,
 * using the ETag to refuse a write built on a stale read.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const STORE = "arabic-trainer";

function keyFor(token) {
  return createHash("sha256").update(`arabic-trainer:${token}`).digest("hex");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req) => {
  const token = req.headers.get("x-sync-token") || "";
  // The client always sends a 64-char hex digest. Anything else is noise.
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "bad-token" }, 401);

  const store = getStore(STORE);

  /* Clips live under their own keys so a document sync doesn't have to
     carry them. ?audio=<id> addresses one clip. */
  const url = new URL(req.url);
  const audioId = url.searchParams.get("audio");
  if (audioId && !/^[A-Za-z0-9_-]{1,64}$/.test(audioId)) {
    return json({ error: "bad-id" }, 400);
  }
  const key = audioId ? keyFor(`${token}:audio:${audioId}`) : keyFor(token);

  try {
    if (req.method === "GET" && audioId) {
      const clip = await store.get(key, { type: "text", consistency: "strong" });
      if (clip == null) return json({ error: "not-found" }, 404);
      return json({ id: audioId, data: clip });
    }

    if (req.method === "POST" && audioId) {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "bad-json" }, 400);
      }
      const clip = String(body && body.data ? body.data : "");
      if (!clip) return json({ error: "no-data" }, 400);
      if (clip.length > MAX_BYTES) return json({ error: "too-large" }, 413);
      // Clips never change once written, so this is a plain put.
      await store.set(key, clip);
      return json({ ok: true, id: audioId });
    }

    if (req.method === "DELETE" && audioId) {
      await store.delete(key);
      return json({ ok: true });
    }

    if (req.method === "GET") {
      const res = await store.getWithMetadata(key, { type: "text", consistency: "strong" });
      if (!res || res.data == null) return json({ etag: null, data: null });
      let data = null;
      try {
        data = JSON.parse(res.data);
      } catch (e) {
        return json({ etag: null, data: null });
      }
      return json({ etag: res.etag || null, data });
    }

    if (req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "bad-json" }, 400);
      }
      if (!body || typeof body.data !== "object" || body.data === null) {
        return json({ error: "no-data" }, 400);
      }

      const payload = JSON.stringify(body.data);
      if (payload.length > MAX_BYTES) return json({ error: "too-large" }, 413);

      /* Refuse the write if the document moved since the client read it.

         No fallback to a plain write: the only thing a failed conditional
         write can be here is a transient error, and retrying it without the
         condition would be exactly the stale overwrite the ETag exists to
         prevent. The client treats a 5xx as "try again next time". */
      const opts = body.etag ? { onlyIfMatch: body.etag } : { onlyIfNew: true };
      const result = await store.set(key, payload, opts);
      if (result && result.modified === false) return json({ error: "conflict" }, 409);

      // set() reports the new ETag itself; no second round trip needed.
      return json({ ok: true, etag: (result && result.etag) || null });
    }

    if (req.method === "DELETE") {
      await store.delete(key);
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: "server", detail: String(err && err.message) }, 500);
  }

  return json({ error: "method" }, 405);
};
