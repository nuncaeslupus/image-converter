import { useEffect, useRef, useState } from "preact/hooks";
import { bakeTransform, type EditTransform } from "./imageEdit";

/**
 * Bakes the non-destructive Edit `transform` into `image`, producing a fresh
 * upright bitmap for the tracer (Trace preview + Export full-res). Re-bakes
 * whenever `image` or `transform` changes and closes the previous result, so a
 * rotation is always applied once from the source (never cumulative) and the
 * baked bitmap never leaks. Returns `null` until the first bake resolves, or
 * when there is no source image.
 *
 * See docs/superpowers/specs/2026-07-19-nondestructive-edit-design.md.
 */
export function useBakedImage(
  image: ImageBitmap | null,
  transform: EditTransform,
  crispRotation = false,
): ImageBitmap | null {
  const [baked, setBaked] = useState<ImageBitmap | null>(null);
  const bakedRef = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    bakedRef.current = baked;
  }, [baked]);

  useEffect(() => {
    if (!image) {
      setBaked((prev) => {
        prev?.close();
        return null;
      });
      return;
    }
    let cancelled = false;
    bakeTransform(image, transform, crispRotation)
      .then((result) => {
        // Superseded (image/transform changed) or unmounted before we resolved:
        // the effect cleanup set `cancelled`, so drop this result.
        if (cancelled) {
          result.close();
          return;
        }
        // Publish, closing whatever it replaces.
        setBaked((prev) => {
          if (prev && prev !== result) prev.close();
          return result;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBaked((prev) => {
            prev?.close();
            return null;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [image, transform, crispRotation]);

  // Close the last baked bitmap on unmount (the in-flight one, if any, is
  // released by its own `cancelled` guard above).
  useEffect(
    () => () => {
      bakedRef.current?.close();
    },
    [],
  );

  return baked;
}
