"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import type { TierDefinition } from "@/lib/coach/tiers";

interface PricingCardProps {
  tier: TierDefinition;
  /** The tier the user is on — drives the "Current plan" state. */
  currentTier: string;
  /**
   * True when the user has never started a trial, which makes the free card
   * an actionable "Start free trial" instead of an inert "Included".
   */
  canStartTrial?: boolean;
  /** Visually lifted card. Reserved for the middle (recommended) tier. */
  featured?: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: (tier: string) => void;
}

export default function PricingCard({
  tier,
  currentTier,
  canStartTrial = false,
  featured = false,
  pending,
  disabled,
  onSelect,
}: PricingCardProps) {
  const isFree = tier.pricePhp === 0;
  // The free card is only "current" once the trial has actually been started.
  // Otherwise it is the call to action, not a status label.
  const isCurrent = tier.id === currentTier && !(isFree && canStartTrial);
  const isActionable = !isCurrent && (!isFree || canStartTrial);

  return (
    <div
      className={`relative bg-white dark:bg-[#1C1C1E] rounded-2xl border shadow-sm p-6 flex flex-col ${
        featured
          ? "border-[#FF5733] shadow-md md:-translate-y-2"
          : "border-black/5 dark:border-white/5"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FF5733] text-white text-[11px] font-semibold font-raleway whitespace-nowrap">
          Most popular
        </span>
      )}

      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold text-[#1A1A1A] dark:text-white font-raleway">{tier.name}</h3>
        <div className="flex items-baseline justify-center gap-1 h-10">
          <span className="text-3xl font-bold text-[#1A1A1A] dark:text-white font-raleway">
            {isFree ? "Free" : `₱${tier.pricePhp}`}
          </span>
          {!isFree && (
            <span className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">/mo</span>
          )}
        </div>
        {/* Fixed height keeps the feature lists aligned across cards whether a
            tagline wraps to one line or two. */}
        <p className="text-xs text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans min-h-8">{tier.tagline}</p>
      </div>

      <ul className="mt-6 space-y-2.5 flex-1">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-[#FF5733] shrink-0 mt-0.5" />
            <span className="text-sm text-[#1A1A1A]/80 dark:text-white/80 font-merriweather-sans">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier.id)}
        disabled={!isActionable || disabled}
        // Non-featured buttons invert in dark mode (white surface, dark label)
        // rather than using a translucent white fill, which reads as disabled
        // against the dark card.
        className={`mt-6 w-full px-6 py-3 rounded-xl text-sm font-semibold font-raleway transition-colors inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
          featured
            ? "bg-[#FF5733] hover:bg-[#E84E2E] text-white"
            : "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-[#1A1A1A]"
        }`}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isCurrent
          ? "Current plan"
          : isFree
            ? canStartTrial
              ? pending
                ? "Starting…"
                : "Start free trial"
              : "Trial used"
            : pending
              ? "Starting checkout…"
              : `Get ${tier.name}`}
      </button>

      {tier.planModel && (
        <p className="mt-3 text-[11px] text-center text-[#1A1A1A]/45 dark:text-white/45 font-merriweather-sans inline-flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-[#FF5733]" />
          Premium model for plan generation
        </p>
      )}
    </div>
  );
}
