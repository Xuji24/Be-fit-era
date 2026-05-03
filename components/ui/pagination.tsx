"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Base path for navigation (e.g., "/admin/users"). Defaults to current path. */
  basePath?: string;
}

export default function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    const path = basePath ?? window.location.pathname;
    router.push(`${path}?${params.toString()}`);
  };

  // Build visible page numbers (max 5 around current)
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg text-sm disabled:opacity-30 hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2E] transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => goToPage(1)}
            className="w-8 h-8 rounded-lg text-sm hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2E] transition-colors"
          >
            1
          </button>
          {start > 2 && <span className="px-1 text-muted text-xs">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goToPage(p)}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
            p === currentPage
              ? "bg-[#FF5733] text-white"
              : "hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2E]"
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-muted text-xs">…</span>}
          <button
            onClick={() => goToPage(totalPages)}
            className="w-8 h-8 rounded-lg text-sm hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2E] transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg text-sm disabled:opacity-30 hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2E] transition-colors"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
