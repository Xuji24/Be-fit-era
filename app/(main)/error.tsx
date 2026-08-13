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
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-raleway font-bold text-2xl sm:text-3xl text-[#1A1A1A] dark:text-white mb-3">
          Something went wrong
        </h1>
        <p className="font-merriweather-sans text-sm sm:text-base text-[#1A1A1A]/50 dark:text-white/40 mb-8 leading-relaxed">
          This page hit an unexpected error. Try again, or head back home if it keeps happening.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] text-white text-sm font-semibold font-raleway transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#1A1A1A]/10 dark:border-white/10 hover:border-[#FF5733]/30 dark:hover:border-[#FF5733]/30 text-[#1A1A1A] dark:text-white text-sm font-semibold font-raleway transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
