"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getCoachAccess, type CoachAccess } from "@/app/actions/coach-actions";
import { startSubscriptionCheckout, startFreeTrial } from "@/app/actions/coach-subscription-actions";
import { TIERS, TIER_ORDER } from "@/lib/coach/tiers";
import { subscribeSubtitle } from "@/lib/coach/access-copy";
import CoachHero from "./component/coach-hero";
import PricingCard from "./component/pricing-card";

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<CoachAccess | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout canceled — you have not been charged.");
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setAccess(await getCoachAccess());
      setLoading(false);
    }
    load();
  }, [router]);

  function handleSelect(tier: string) {
    setSelecting(tier);
    startTransition(async () => {
      // The free tier isn't a purchase — it starts the trial in place and
      // drops the user straight into the coach.
      if (tier === "free") {
        const result = await startFreeTrial();
        if (!result.success) {
          toast.error(result.error ?? "Could not start your free trial.");
          setSelecting(null);
          return;
        }
        toast.success("Your 14-day free trial has started.");
        router.replace(access?.hasProfile ? "/coach" : "/coach/onboarding");
        return;
      }

      const result = await startSubscriptionCheckout(tier);
      if (!result.success || !result.checkoutUrl) {
        toast.error(result.error ?? "Could not start checkout.");
        setSelecting(null);
        return;
      }
      // Full navigation, not router.push — this leaves the app for PayMongo.
      window.location.href = result.checkoutUrl;
    });
  }

  if (loading || !access) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  const subtitle = subscribeSubtitle(access);

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      <CoachHero
        icon={Sparkles}
        title="Choose your coach"
        backHref="/coach"
        maxWidthClassName="max-w-5xl"
      />

      <div className="max-w-5xl mx-auto px-6 pb-16">
        <p className="text-sm text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans">{subtitle}</p>

        {/* items-stretch (grid default) so all three cards share a height and
            their CTAs line up, regardless of feature-list length. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 pt-4">
          {TIER_ORDER.map((id) => (
            <PricingCard
              key={id}
              tier={TIERS[id]}
              currentTier={access.tier}
              // Only a user who never started one can claim the trial.
              canStartTrial={access.deniedReason === "not_started"}
              featured={id === "starter"}
              pending={isPending && selecting === id}
              disabled={isPending}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[#1A1A1A]/45 dark:text-white/45 font-merriweather-sans">
          Payments are processed by PayMongo via GCash, Maya, or QR Ph. Each purchase covers one month of access.
        </p>
      </div>
    </div>
  );
}
