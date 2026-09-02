"use client";

import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findGlossaryEntry } from "@/lib/coach/glossary";

interface GlossaryHintProps {
  /** Glossary key, e.g. "sets". Renders nothing if the term is unknown. */
  term: string;
  className?: string;
}

/**
 * A small "?" beside a piece of jargon, opening its plain-language definition.
 *
 * Deliberately a Popover and not a Tooltip: tooltips are hover-only, so on a
 * phone — which is where most people read their plan mid-workout — they are
 * effectively unreachable. A tap-to-open popover works on every input type,
 * and a real <button> gets keyboard and screen-reader behaviour for free.
 */
export default function GlossaryHint({ term, className = "" }: GlossaryHintProps) {
  const entry = findGlossaryEntry(term);
  if (!entry) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does ${entry.label} mean?`}
          className={`inline-flex items-center justify-center shrink-0 text-foreground/30 hover:text-[var(--brand-hover)] transition-colors cursor-pointer align-middle ${className}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 bg-white dark:bg-[#1C1C1E] border-black/5 dark:border-white/10 rounded-xl p-4"
      >
        <p className="text-sm font-semibold text-foreground font-raleway mb-1">
          {entry.label}
        </p>
        <p className="text-xs leading-relaxed text-foreground/70 font-merriweather-sans">
          {entry.definition}
        </p>
      </PopoverContent>
    </Popover>
  );
}
