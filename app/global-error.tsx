"use client";

import { useEffect } from "react";

// Catches errors thrown above every route group's own layout/error boundary
// (e.g. a font or provider crash) — the one place in this app that legitimately
// needs its own <html>/<body>, since there's no shared root layout above it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            background: "#FFF6F0",
            color: "#1E1E1E",
          }}
        >
          <div style={{ maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "0.9rem", opacity: 0.6, marginBottom: "1.5rem" }}>
              Fitra hit an unexpected error. Please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                background: "#FFB366",
                color: "#1E1E1E",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
