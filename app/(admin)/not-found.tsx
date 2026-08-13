import Link from "next/link";

// Same reasoning as app/(main)/not-found.tsx: (admin)/layout.tsx already
// renders <html>/<body>, so a mistyped /admin/* URL must not fall back to
// the root not-found.tsx (which renders its own) or React ends up with two
// nested html/body trees.
export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <span className="text-[100px] font-raleway font-bold leading-none text-[#FF5733]/10 select-none">
          404
        </span>
        <h1 className="font-raleway font-bold text-2xl text-[#1A1A1A] dark:text-white mb-3 -mt-6">
          Page not found
        </h1>
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/40 mb-8">
          This admin page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] text-white text-sm font-semibold font-raleway transition-colors"
        >
          Back to Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
