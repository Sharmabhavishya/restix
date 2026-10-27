"use client";

// Last-resort boundary when the root layout itself fails. It must render its own document.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f9fafb", color: "#111827", margin: 0 }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px" }}>
          <h1 style={{ fontSize: 36, lineHeight: 1.1, margin: 0 }}>ResTix is having a moment</h1>
          <p style={{ fontSize: 17, color: "#5f6672", lineHeight: 1.6 }}>
            Something failed before the page could load. Please try again in a minute.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, height: 44, padding: "0 20px", borderRadius: 6, border: 0, background: "#1d1f20", color: "#fff", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
