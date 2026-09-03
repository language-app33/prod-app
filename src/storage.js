/*
 * Storage adapter.
 *
 * The app component was written against the Claude artifact storage API
 * (window.storage). This provides the same shape on top of localStorage,
 * so the component itself needs no changes and stays easy to keep in sync
 * with the original.
 *
 * Everything lives on this device, in this browser. Nothing is sent anywhere.
 */

const PREFIX = "arabic-trainer:";

export const storage = {
  async get(key) {
    const value = localStorage.getItem(PREFIX + key);
    // The artifact API throws for a missing key rather than returning null,
    // and the component relies on that to detect a first run.
    if (value === null) throw new Error(`No value for ${key}`);
    return { key, value, shared: false };
  },

  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: false };
    } catch (err) {
      // Quota exceeded, or storage blocked in private browsing.
      console.error("Save failed:", err);
      return null;
    }
  },

  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared: false };
  },

  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
    }
    return { keys, prefix, shared: false };
  },
};

/* Ask the browser not to evict this data under storage pressure.
   Firefox and Chrome honour it; Safari currently ignores it. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch (err) {
    /* not supported */
  }
  return false;
}
