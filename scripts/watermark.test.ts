import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { stampPhoto, watermarkSvg } from "./watermark";

const dir = await mkdtemp(path.join(os.tmpdir(), "restix-wm-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("photo watermark", () => {
  it("sits in the bottom-right corner, sized to the photo", () => {
    const svg = watermarkSvg(1600, 1067);
    expect(svg).toContain('width="1600" height="1067"');
    expect(svg).toContain(">ResTix</text>");
    const [, x, y] = svg.match(/translate\((\d+) (\d+)\)/)!.map(Number);
    expect(x).toBeGreaterThan(1600 * 0.7);
    expect(y).toBeGreaterThan(1067 * 0.85);
  });

  it("stamps the corner, leaves the rest, resizes, and drops GPS and camera metadata", async () => {
    // A flat dark 2400x1600 "photo" carrying EXIF, like a phone shot.
    const input = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 20, g: 20, b: 30 } } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo", Model: "Pocket 9" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "28/1 31/1 0/1" } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = path.join(dir, "stamped.jpg");
    const r = await stampPhoto(input, out);
    expect(r.width).toBe(1600);

    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();

    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const brightness = (x0: number, y0: number, w: number, h: number) => {
      let sum = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) sum += data[(y * info.width + x) * info.channels];
      return sum / (w * h);
    };
    // Bright marks in the bottom-right; the top-left stays as dark as the original.
    expect(brightness(info.width - 300, info.height - 110, 260, 80)).toBeGreaterThan(40);
    expect(brightness(20, 20, 260, 80)).toBeLessThan(30);
  });

  it("can crop to the shape the page shows before stamping", async () => {
    const tall = await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 10, g: 60, b: 10 } } }).jpeg().toBuffer();
    const r = await stampPhoto(tall, path.join(dir, "wide.jpg"), { aspect: 16 / 9, focusY: 0.38 });
    expect(r.width).toBe(900);
    expect(r.height).toBe(506);
  });
});
