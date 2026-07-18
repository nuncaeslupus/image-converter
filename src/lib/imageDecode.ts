/**
 * Client-side image decode (T4 — see status/plan.md "Data flow" step 1).
 *
 * Accepts a `File`/`Blob` from the file picker or drag-and-drop zone and
 * produces an `ImageBitmap` via the browser's native `createImageBitmap()`.
 * The file is never uploaded anywhere — decoding happens entirely on the
 * main thread from local bytes, per status/specification.md's privacy goal.
 */

/** Raster formats the converter accepts, per status/specification.md Goals. */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

/**
 * Hard cap on the source file size, matching the "up to 25 MB" the upload UI
 * advertises. 25 MB of compressed image is a sane ceiling for in-browser
 * decode + trace; larger files risk OOM on the full-resolution decode before
 * the preview downscale ever runs.
 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Some platforms report BMP drag-drop with this legacy MIME type instead. */
const BMP_MIME_ALIASES = new Set(["image/x-ms-bmp", "image/x-bmp"]);

/** Magic-byte signatures used to sniff format when `file.type` is empty or unreliable. */
const MAGIC_BYTE_SNIFFERS: Array<{
  type: SupportedImageMimeType;
  test: (bytes: Uint8Array) => boolean;
}> = [
  {
    type: "image/png",
    test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/jpeg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: "image/gif",
    test: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    type: "image/bmp",
    test: (b) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d,
  },
  {
    type: "image/webp",
    test: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    // ISO-BMFF box: bytes 4-7 = "ftyp", brand at 8-11 = "avif" (still) or "avis" (sequence).
    type: "image/avif",
    test: (b) =>
      b.length >= 12 &&
      b[4] === 0x66 &&
      b[5] === 0x74 &&
      b[6] === 0x79 &&
      b[7] === 0x70 &&
      b[8] === 0x61 &&
      b[9] === 0x76 &&
      b[10] === 0x69 &&
      (b[11] === 0x66 || b[11] === 0x73),
  },
];

export type ImageDecodeErrorCode = "unsupported-format" | "decode-failed" | "file-too-large";

/**
 * Typed/structured decode error so the UI layer can distinguish "this file
 * type isn't supported" from "this looked like a supported format but the
 * browser couldn't decode it" and show an appropriate message for each.
 */
export class ImageDecodeError extends Error {
  readonly code: ImageDecodeErrorCode;

  constructor(code: ImageDecodeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ImageDecodeError";
    this.code = code;
  }
}

function normalizeMimeType(type: string): SupportedImageMimeType | null {
  const lower = type.toLowerCase();
  if ((SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(lower)) {
    return lower as SupportedImageMimeType;
  }
  if (BMP_MIME_ALIASES.has(lower)) {
    return "image/bmp";
  }
  return null;
}

function sniffMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  for (const sniffer of MAGIC_BYTE_SNIFFERS) {
    if (sniffer.test(bytes)) {
      return sniffer.type;
    }
  }
  return null;
}

/**
 * Determines whether `file` is one of the supported formats, first trusting
 * the browser-reported MIME type and falling back to a magic-byte sniff
 * (some OS/drag-drop combinations report an empty or generic `file.type`).
 */
async function resolveSupportedMimeType(file: Blob): Promise<SupportedImageMimeType | null> {
  const reportedType = "type" in file ? (file as File).type : "";
  if (reportedType) {
    const normalized = normalizeMimeType(reportedType);
    if (normalized) {
      return normalized;
    }
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffMimeType(head);
}

/**
 * Decodes a `File`/`Blob` into an `ImageBitmap` entirely client-side.
 *
 * Rejects with a typed {@link ImageDecodeError}:
 * - `"file-too-large"` — the file exceeds {@link MAX_IMAGE_BYTES} (25 MB).
 * - `"unsupported-format"` — the file isn't one of PNG/JPEG/WebP/GIF/BMP/AVIF.
 * - `"decode-failed"` — the format looked supported but the browser's
 *   decoder rejected the bytes (corrupt/truncated file).
 */
export async function decodeImage(file: File | Blob): Promise<ImageBitmap> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageDecodeError(
      "file-too-large",
      "That image is larger than 25 MB. Please choose a smaller file.",
    );
  }

  const mimeType = await resolveSupportedMimeType(file);
  if (!mimeType) {
    throw new ImageDecodeError(
      "unsupported-format",
      "Unsupported file type. Please choose a PNG, JPEG, WebP, GIF, BMP, or AVIF image.",
    );
  }

  try {
    return await createImageBitmap(file);
  } catch (cause) {
    throw new ImageDecodeError(
      "decode-failed",
      "This image could not be decoded. The file may be corrupted.",
      {
        cause,
      },
    );
  }
}
