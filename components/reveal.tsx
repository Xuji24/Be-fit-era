"use client";

import { useReveal } from "@/lib/hooks/use-reveal";

/**
 * Fades + rises a section into place as it enters the viewport, using the
 * `.reveal` utility in globals.css. Wraps server-rendered children fine —
 * this only needs a DOM node to observe, not to own what's inside it.
 */
export default function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={visible ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
