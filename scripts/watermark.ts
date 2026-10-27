// Stamps the ResTix mark into a photo and prepares it for the web. Used by import-photos.ts.
//
// What it does to every picture:
//   * turns it upright from its EXIF orientation, then drops ALL metadata (phone photos carry GPS
//     location, device and time; none of that should ship on a public site);
//   * resizes to at most `maxWidth` wide;
//   * draws the mark (the ticket stub) and the word "restix" in the bottom-right corner, white
//     with a soft dark halo so it reads on bright stage lights and dark crowds alike.
import sharp from "sharp";

export interface StampOptions {
  maxWidth?: number;
  quality?: number;
  /** Crop to this width/height ratio before stamping, so the page never has to crop the mark off. */
  aspect?: number;
  /** Where to centre that crop vertically, 0 (top) to 1 (bottom). */
  focusY?: number;
}

/** The watermark as SVG, sized for an image `width` x `height`. Pure, so it's testable. */
export function watermarkSvg(width: number, height: number): string {
  // About 16% of the width, never tiny on small images or huge on panoramas.
  const w = Math.round(Math.min(Math.max(width * 0.16, 110), 320));
  const h = Math.round(w * 0.26);
  const pad = Math.round(Math.max(width * 0.025, 14));
  const x = width - w - pad;
  const y = height - h - pad;
  const s = h / 32; // the mark is drawn on a 32-unit grid
  const font = Math.round(h * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="halo" x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${(h * 0.08).toFixed(1)}"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#halo)" opacity="0.9" transform="translate(${x} ${y})">
    <g transform="scale(${s.toFixed(3)})">
      <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff"/>
        <g stroke="#000" fill="none" stroke-linecap="round">
          <path d="M21 9.5V22.5" stroke-width="1.6" stroke-dasharray="1.6 1.9"/>
          <path d="M8.2 18.6c1.8 1.9 5 1.9 6.8 0" stroke-width="1.7"/>
          <circle cx="9.6" cy="13.6" r="1.2" fill="#000" stroke="none"/>
          <circle cx="13.6" cy="13.6" r="1.2" fill="#000" stroke="none"/>
        </g>
      </mask>
      <g transform="rotate(-10 16 16)">
        <path mask="url(#cut)" fill="#ffffff"
              d="M5 7H27A3 3 0 0 1 30 10V13A3 3 0 0 0 30 19V22A3 3 0 0 1 27 25H5A3 3 0 0 1 2 22V19A3 3 0 0 0 2 13V10A3 3 0 0 1 5 7Z"/>
      </g>
    </g>
    <text x="${Math.round(h * 1.12)}" y="${Math.round(h * 0.72)}" font-family="DM Sans, Segoe UI, Arial, sans-serif" font-weight="700"
          font-size="${font}" letter-spacing="-1" fill="#ffffff">restix</text>
  </g>
</svg>`;
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
  const info = await sharp(upright.data)
    .composite([{ input: Buffer.from(watermarkSvg(width, height)), top: 0, left: 0 }])
    .jpeg({ quality: opts.quality ?? 78, mozjpeg: true })
    .toFile(output);
  return { width: info.width, height: info.height, bytes: info.size };
}
