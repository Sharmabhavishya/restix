// Imports the owner's own event photos: watermarks them, strips their metadata (GPS, device,
// time) and writes web-sized copies to src/assets/photos/.
//
//   npm run photos              # everything in photos-incoming/
//   npm run photos -- a.jpg     # just these files (paths relative to photos-incoming/)
//
// Originals stay in photos-incoming/ (gitignored). Then add the new files to
// src/components/landing-photos.ts with an alt text and caption, and no `credit` (they're yours).
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { stampPhoto } from "./watermark";

const IN = path.resolve("photos-incoming");
const OUT = path.resolve("src/assets/photos");
const IMAGE = /\.(jpe?g|png|webp|tiff?|avif)$/i;

function slug(name: string) {
  return path.parse(name).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "photo";
}

async function main() {
  const picked = process.argv.slice(2);
  const files = picked.length ? picked : (await readdir(IN)).filter((f) => IMAGE.test(f));
  if (files.length === 0) {
    console.log(`No images in ${IN}. Drop JPG/PNG/WebP files there and run again.`);
    return;
  }
  await mkdir(OUT, { recursive: true });
  for (const f of files) {
    const out = path.join(OUT, `own-${slug(f)}.jpg`);
    try {
      const r = await stampPhoto(path.join(IN, f), out);
      console.log(`${f} -> ${path.relative(process.cwd(), out)}  ${r.width}x${r.height}  ${Math.round(r.bytes / 1024)} KB`);
    } catch (err) {
      console.error(`${f}: skipped (${err instanceof Error ? err.message : err})`);
    }
  }
}

main();
