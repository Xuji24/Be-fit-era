"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Slide-over that holds a coach page's history. Opened by the header's history icon. */
export default function HistoryPanel({ open, onClose, title, children }: HistoryPanelProps) {
  // Escape closes, and the page behind shouldn't scroll while the panel is up.
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 w-full max-w-sm bg-[#FAFAF8] dark:bg-[#121212] shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/5">
          <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#1A1A1A]/40 dark:text-white/40 hover:text-[#FF5733] hover:bg-[#FF5733]/10 transition-colors cursor-pointer"
            aria-label="Close history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
