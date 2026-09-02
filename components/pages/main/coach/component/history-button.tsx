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
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-[var(--brand-hover)] hover:bg-[var(--brand)]/10 transition-colors cursor-pointer"
      aria-label={label}
      title={label}
    >
      <History className="w-4 h-4" />
    </button>
  );
}
