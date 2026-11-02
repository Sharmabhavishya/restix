import { ImageResponse } from "next/og";

const TICKET = "M4 0H24A4 4 0 0 1 28 4V5.8A3.2 3.2 0 0 0 28 12.2V14A4 4 0 0 1 24 18H4A4 4 0 0 1 0 14V12.2A3.2 3.2 0 0 0 0 5.8V4A4 4 0 0 1 4 0Z";

/** The home-screen icon: the logo's ticket in white on raspberry, padded so round masks don't clip it. */
export function pwaIcon(px: number) {
  const w = Math.round(px * 0.56);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#b8336a" }}>
        <svg width={w} height={Math.round((w * 18) / 28)} viewBox="0 0 28 18" style={{ transform: "rotate(-14deg)" }}>
          <path d={TICKET} fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
