"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

export const PLACEHOLDER_IMAGE = "/images/cbmtvwhitelogo.png";

function isRenderableSrc(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  // Local asset under /public.
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type SafeImageProps = Omit<ImageProps, "src"> & {
  /** Editor-supplied and therefore untrusted: may be null, empty, or junk. */
  src: string | null | undefined;
  fallbackSrc?: string;
};

/**
 * next/image for URLs an editor supplied, which can point at ANY host.
 *
 * Two failure modes this exists to absorb:
 *   1. A missing/!http src. `src || PLACEHOLDER` only catches falsy values, not
 *      a malformed one.
 *   2. A hostname absent from next.config.ts `remotePatterns`. In development
 *      next/image THROWS during render for those, which takes down the entire
 *      surrounding page rather than just the one image. `unoptimized` skips
 *      that host check (see generateImgAttrs in next/dist/shared/lib/
 *      get-img-props.js, which returns the raw src before ever calling the
 *      loader that throws).
 *
 * Local assets and our configured S3 image directory use optimisation.
 * Arbitrary editor-supplied hosts opt out so they remain renderable.
 */
export function SafeImage({
  src,
  fallbackSrc = PLACEHOLDER_IMAGE,
  alt,
  unoptimized,
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const resolved = !failed && isRenderableSrc(src) ? src : fallbackSrc;
  const isLocal = resolved.startsWith("/");
  const remote = isLocal ? null : new URL(resolved);
  const isConfiguredImage = remote?.protocol === "https:" &&
    remote.hostname === process.env.NEXT_PUBLIC_S3_IMAGE_HOST &&
    remote.pathname.startsWith("/cbm-images/");

  return (
    <Image
      {...rest}
      alt={alt}
      src={resolved}
      unoptimized={Boolean(unoptimized) || (!isLocal && !isConfiguredImage)}
      onError={() => setFailed(true)}
    />
  );
}
