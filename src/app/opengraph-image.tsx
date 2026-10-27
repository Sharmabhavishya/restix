import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview when ResTix is shared: the logo, the line, and the band of raspberry.
export const alt = "ResTix: spare ticket? sorted.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The ticket that dots the i (same shape as components/logo.tsx).
const TICKET = "M4 0H24A4 4 0 0 1 28 4V5.8A3.2 3.2 0 0 0 28 12.2V14A4 4 0 0 1 24 18H4A4 4 0 0 1 0 14V12.2A3.2 3.2 0 0 0 0 5.8V4A4 4 0 0 1 4 0Z";

export default async function OpengraphImage() {
  // A small subset of Bricolage Grotesque 800, enough for these lines.
  const display = await readFile(join(process.cwd(), "src/assets/fonts/bricolage-800-og.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f9fafb", padding: "64px 0 72px 80px", fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", alignItems: "flex-end", color: "#111827", fontSize: 64, letterSpacing: -1.3, lineHeight: 1 }}>
          <span>rest</span>
          <span style={{ display: "flex", position: "relative" }}>
            ı
            <svg width="20" height="13" viewBox="0 0 28 18" style={{ position: "absolute", top: -2, left: 1, transform: "rotate(-14deg)" }}>
              <path d={TICKET} fill="#b8336a" />
            </svg>
          </span>
          <span>x</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#111827", fontSize: 112, letterSpacing: -3, lineHeight: 0.92 }}>
          <span>spare ticket?</span>
          <span>sorted.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", flex: 1, height: 120, background: "#b8336a", borderRadius: "60px 0 0 60px", paddingLeft: 48, color: "#fdf2f7", fontSize: 34, letterSpacing: -0.5 }}>
            the ticket exchange for verified students
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bricolage", data: display, weight: 800, style: "normal" }] },
  );
}
