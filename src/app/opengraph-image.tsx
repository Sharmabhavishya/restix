import { ImageResponse } from "next/og";

// The link preview when ResTix is shared: the ticket mark, the line, and the band.
export const alt = "ResTix: spare wristband? sorted.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f9fafb", padding: "72px 0 72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#111827", fontSize: 40, fontWeight: 700 }}>
          {/* The mark: a ticket stub with a smile and a sparkle (same paths as components/logo.tsx). */}
          <svg width="72" height="72" viewBox="0 0 32 32">
            <g transform="rotate(-10 16 16)">
              <path d="M5 7H27A3 3 0 0 1 30 10V13A3 3 0 0 0 30 19V22A3 3 0 0 1 27 25H5A3 3 0 0 1 2 22V19A3 3 0 0 0 2 13V10A3 3 0 0 1 5 7Z" fill="#b8336a" />
              <path d="M21 9.5V22.5" stroke="#fdf2f7" strokeWidth="1.6" strokeDasharray="1.6 1.9" strokeLinecap="round" />
              <path d="M8.2 18.6c1.8 1.9 5 1.9 6.8 0" stroke="#fdf2f7" strokeWidth="1.7" fill="none" strokeLinecap="round" />
              <circle cx="9.6" cy="13.6" r="1.2" fill="#fdf2f7" />
              <circle cx="13.6" cy="13.6" r="1.2" fill="#fdf2f7" />
            </g>
            <path d="M26.5 0.8L27.7 4.1L31 5.3L27.7 6.5L26.5 9.8L25.3 6.5L22 5.3L25.3 4.1Z" fill="#ffd84d" stroke="#2e2300" strokeWidth="0.9" strokeLinejoin="round" />
          </svg>
          restix
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#111827", fontSize: 96, fontWeight: 800, letterSpacing: -4, lineHeight: 0.95 }}>
          <span>spare wristband?</span>
          <span>sorted.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", flex: 1, height: 120, background: "#b8336a", borderRadius: "60px 0 0 60px", paddingLeft: 48, color: "#fdf2f7", fontSize: 30 }}>
            the campus ticket exchange for verified students
          </div>
        </div>
      </div>
    ),
    size,
  );
}
