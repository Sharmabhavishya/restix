// Stamps the ResTix logo into a photo and prepares it for the web. Used by import-photos.ts.
//
// What it does to every picture:
//   * turns it upright from its EXIF orientation, then drops ALL metadata (phone photos carry GPS
//     location, device and time; none of that should ship on a public site);
//   * resizes to at most `maxWidth` wide;
//   * unless `stamp: false`, places the wordmark (white, with its raspberry ticket dot and a soft
//     dark halo so it reads on bright stage lights and dark crowds alike) in the bottom-right.
//
// The wordmark art is scripts/assets/watermark.png: the logo rendered once at 200px in Bricolage
// Grotesque 800 with a drop-shadow halo, transparent background. Re-render it if the logo changes.
import path from "node:path";
import sharp from "sharp";

const ART = path.join(import.meta.dirname, "assets", "watermark.png");

export interface StampOptions {
  maxWidth?: number;
  quality?: number;
  /** Crop to this width/height ratio first, so the page never has to crop the logo off. */
  aspect?: number;
  /** Where to centre that crop vertically, 0 (top) to 1 (bottom). */
  focusY?: number;
  /** false: clean, metadata-free copy with no logo (video posters, which the clip replaces). */
  stamp?: boolean;
}

/** Where the logo goes on a `width` x `height` image. Pure, so it's testable. */
export function watermarkPlacement(width: number, height: number) {
  // About 13% of the width, never tiny on small images or huge on panoramas.
  const w = Math.round(Math.min(Math.max(width * 0.13, 96), 240));
  const pad = Math.round(Math.max(width * 0.018, 10));
  return { width: w, left: width - w - pad, top: height - Math.round(w * 0.47) - pad };
}

/** Reads `input`, stamps it, and writes a metadata-free JPEG to `output`. Returns the final size. */
export async function stampPhoto(input: string | Buffer, output: string, opts: StampOptions = {}) {
  const maxWidth = opts.maxWidth ?? 1600;
  // rotate() with no argument applies the EXIF orientation before the metadata is dropped.
  let base = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  if (opts.aspect) {
    const { width: w0, height: h0 } = base.info;
    const h = Math.min(h0, Math.round(w0 / opts.aspect));
    const w = Math.min(w0, Math.round(h * opts.aspect));
    const top = Math.round(Math.min(Math.max((opts.focusY ?? 0.5) * h0 - h / 2, 0), h0 - h));
    const left = Math.round((w0 - w) / 2);
    base = await sharp(base.data).extract({ left, top, width: w, height: h }).toBuffer({ resolveWithObject: true });
  }
  const upright = await sharp(base.data).resize({ width: maxWidth, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  let img = sharp(upright.data);
  if (opts.stamp !== false) {
    const at = watermarkPlacement(width, height);
    const art = await sharp(ART).resize({ width: at.width }).toBuffer();
    img = img.composite([{ input: art, left: at.left, top: Math.max(0, at.top) }]);
  }
  const info = await img.jpeg({ quality: opts.quality ?? 78, mozjpeg: true }).toFile(output);
  return { width: info.width, height: info.height, bytes: info.size };
}
