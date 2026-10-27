import { ImageResponse } from "next/og";

// The link preview when ResTix is shared: the wristband, enormous, and the line.
export const alt = "ResTix: spare wristband? sorted.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f9fafb", padding: "72px 0 72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#111827", fontSize: 40, fontWeight: 700 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 56, height: 40, background: "#b8336a", borderRadius: 8 }} />
            <div style={{ width: 22, height: 40, background: "#6b1d3e", borderRadius: "0 20px 20px 0" }} />
          </div>
          ResTix
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
