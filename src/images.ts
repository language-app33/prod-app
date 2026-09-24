/*
 * A picture as a card keeps it.
 *
 * Shrunk before it leaves the device: a phone's photo is several megabytes
 * and four thousand pixels across, which every student would then download
 * to see a thumbnail of a cup. A long side of 1024 pixels is sharp on any
 * screen this app is read on, and a JPEG of that is a few hundred
 * kilobytes — well under what the server takes (see MAX_IMAGE_BYTES in
 * server/api/courses.js).
 *
 * Its own module so that a browser test can run it: drawing needs a real
 * canvas, which the smoke walk's jsdom has not got.
 */

/** How many pictures one form may carry — the server keeps the same cap. */
export const MAX_IMAGES = 4;
export const IMAGE_SIDE = 1024;

/* A picture as the server will keep it: at most IMAGE_SIDE on its long
   side, as a JPEG on white — transparency has nothing to show through to
   in a JPEG, and white is what the card behind it is in the light theme. */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error("bad-image"));
      el.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("bad-image");
    const scale = Math.min(1, IMAGE_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("bad-image");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("bad-image"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

