"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-raleway font-bold text-2xl text-foreground mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-foreground/50 mb-8">
          This admin page hit an unexpected error.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold font-raleway transition-colors"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-foreground/10 text-foreground text-sm font-semibold font-raleway transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
