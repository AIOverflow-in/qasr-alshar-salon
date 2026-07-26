"use client";

/** Last-resort boundary for errors thrown in the root layout itself (must render its own
 *  <html>/<body>, and can't rely on globals.css). Inline styles keep it self-contained. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#fbf8f1", color: "#211c14", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#7c715a", marginTop: ".5rem" }}>Please try again in a moment.</p>
          <button
            onClick={reset}
            style={{ marginTop: "1.25rem", padding: ".65rem 1.4rem", borderRadius: 999, border: 0, background: "#8a6a1e", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
