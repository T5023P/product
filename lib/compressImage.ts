// Client-side image resize/compress helper.
//
// Behavior (see `.kiro/specs/catalog-bug-fixes/design.md`):
// - Non-image files are returned unchanged.
// - Inputs whose long edge is <= 1600px AND whose size is <= 500_000 bytes
//   pass through unchanged (preservation: Section 3.5 of bugfix.md).
// - Otherwise the image is decoded, scaled so the long edge equals 1600px,
//   drawn onto an off-screen canvas, and re-encoded at quality 0.82 as
//   image/webp when supported, falling back to image/jpeg.
//
// The helper is SSR-safe: it short-circuits when `window` is undefined.

const MAX_LONG_EDGE = 1600;
const PASS_THROUGH_BYTES = 500_000;
const ENCODE_QUALITY = 0.82;

let cachedWebpSupport: boolean | null = null;

function supportsWebp(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (cachedWebpSupport !== null) {
    return cachedWebpSupport;
  }
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    cachedWebpSupport = probe
      .toDataURL("image/webp")
      .startsWith("data:image/webp");
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  cleanup: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      cleanup: () => {
        if (typeof (bitmap as ImageBitmap).close === "function") {
          (bitmap as ImageBitmap).close();
        }
      },
    };
  }

  if (typeof URL === "undefined" || typeof Image === "undefined") {
    throw new Error("compressImage: no image decoder available");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("compressImage: failed to decode image"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function compressImage(file: File): Promise<Blob> {
  // Non-image inputs flow through untouched.
  if (!file.type || !file.type.startsWith("image/")) {
    return file;
  }

  // SSR guard. The admin form only calls us in the browser, but be safe.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const decoded = await decodeImage(file);
  const { width, height, source, cleanup } = decoded;

  try {
    const longEdge = Math.max(width, height);

    // Already-small inputs pass through unchanged.
    if (longEdge <= MAX_LONG_EDGE && file.size <= PASS_THROUGH_BYTES) {
      return file;
    }

    const scale = MAX_LONG_EDGE / longEdge;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("compressImage: 2D context unavailable");
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const mimeType = supportsWebp() ? "image/webp" : "image/jpeg";

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("compressImage: canvas.toBlob returned null"));
          }
        },
        mimeType,
        ENCODE_QUALITY
      );
    });

    return blob;
  } finally {
    cleanup();
  }
}
