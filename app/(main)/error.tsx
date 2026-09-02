"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function MainError({
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
        <h1 className="font-raleway font-bold text-2xl sm:text-3xl text-foreground mb-3">
          Something went wrong
        </h1>
        <p className="font-merriweather-sans text-sm sm:text-base text-foreground/50 mb-8 leading-relaxed">
          This page hit an unexpected error. Try again, or head back home if it keeps happening.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold font-raleway transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-foreground/10 hover:border-[var(--brand)]/30 text-foreground text-sm font-semibold font-raleway transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
