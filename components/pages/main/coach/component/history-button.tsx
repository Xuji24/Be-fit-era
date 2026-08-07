"use client";

import { History } from "lucide-react";

interface HistoryButtonProps {
  onClick: () => void;
  label?: string;
}

/** Top-right history icon that opens a page's HistoryPanel. */
export default function HistoryButton({ onClick, label = "History" }: HistoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#1A1A1A]/40 dark:text-white/40 hover:text-[#FF5733] hover:bg-[#FF5733]/10 transition-colors cursor-pointer"
      aria-label={label}
      title={label}
    >
      <History className="w-4 h-4" />
    </button>
  );
}
