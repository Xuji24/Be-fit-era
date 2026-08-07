"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Dumbbell, Sparkles, CalendarDays, ClipboardList, TrendingUp, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getCoachAccess, generatePlanForUser, getActivePlan, type CoachAccess } from "@/app/actions/coach-actions";
import { startFreeTrial } from "@/app/actions/coach-subscription-actions";
import { tierOf } from "@/lib/coach/tiers";
import { quotaBannerText, trialCountdown } from "@/lib/coach/access-copy";
import PlanSkeleton from "./component/plan-skeleton";
import CoachHero from "./component/coach-hero";

export default function CoachDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<CoachAccess | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [isPending, startTransition] = useTransition();

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

      const coachAccess = await getCoachAccess();
      if (!coachAccess.hasProfile) {
        router.push("/coach/onboarding");
        return;
      }

      // Onboarded but no subscription row — the trial was never created (or
      // predates this table). Start it here rather than bouncing the user to a
      // pricing page, which is a dead end for someone entitled to a free trial.
      if (coachAccess.deniedReason === "not_started") {
        const started = await startFreeTrial();
        if (started.success) {
          setAccess(await getCoachAccess());
          const activePlan = await getActivePlan();
          setHasActivePlan(!!activePlan);
          setLoading(false);
          return;
        }
        router.replace("/coach/subscribe");
        return;
      }

      // Trial genuinely over and nothing bought: the coach is no longer theirs
      // to use, so send them to the plans page rather than dead buttons.
      // No toast — the subscribe page states the reason in its own header, and
      // a toast here fires again on every bounce back to the dashboard.
      if (!coachAccess.hasAccess) {
        router.replace("/coach/subscribe");
        return;
      }

      const activePlan = await getActivePlan();
      setHasActivePlan(!!activePlan);
      setAccess(coachAccess);
      setLoading(false);
    }
    load();
  }, [router]);

  function handleGeneratePlan() {
    startTransition(async () => {
      const result = await generatePlanForUser();
      if (!result.success) {
        toast.error(result.error ?? "Failed to generate your plan.");
        return;
      }
      toast.success("Your plan is ready!");
      setHasActivePlan(true);
      // A generation was just spent — refresh so the remaining count is honest
      // if the user comes back to this page.
      setAccess(await getCoachAccess());
      router.push("/coach/planner");
    });
  }

  if (loading || !access) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      <CoachHero icon={Dumbbell} title="AI Coach" backHref="/" maxWidthClassName="max-w-6xl" />

      <div className="max-w-6xl mx-auto px-6 pb-16 space-y-6">
        <p className="max-w-3xl mx-auto text-sm text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans">
          {isPending ? (
            "Building your week of workouts and meals…"
          ) : (
            <>
              {access.status === "trialing" && (
                <span>
                  Free trial — {trialCountdown(access.status, access.trialDaysLeft)}
                  {" · "}
                  {access.planQuota.remaining}/{access.planQuota.limit} plans,{" "}
                  {access.chatQuota.remaining}/{access.chatQuota.limit} messages
                </span>
              )}
              {access.status === "active" && (
                <span>
                  {tierOf(access.tier).name} — {access.planQuota.remaining} plan
                  {access.planQuota.remaining === 1 ? "" : "s"} left this month
                </span>
              )}
            </>
          )}
        </p>

        {isPending ? (
          <PlanSkeleton />
        ) : (
          <>
            {(access.outOfPlans || access.outOfChat) && (
              <div className="max-w-3xl mx-auto bg-[#FF5733]/5 border border-[#FF5733]/25 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Sparkles className="w-5 h-5 text-[#FF5733] shrink-0" />
                <p className="flex-1 text-sm text-[#1A1A1A]/80 dark:text-white/80 font-merriweather-sans">
                  {quotaBannerText(access)}
                </p>
                <Link
                  href="/coach/subscribe"
                  className="px-5 py-2.5 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] text-white text-sm font-semibold font-raleway transition-colors shrink-0 text-center"
                >
                  {access.tier === "free" ? "See plans" : "Upgrade"}
                </Link>
              </div>
            )}

            <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
              {hasActivePlan && (
                <>
                  <Link
                    href="/coach/planner"
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:border-[#FF5733]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#FF5733]/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-[#FF5733]" />
                    </div>
                    <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Planner</span>
                  </Link>
                  <Link
                    href="/coach/tracker"
                    className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:border-[#FF5733]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#FF5733]/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-[#FF5733]" />
                    </div>
                    <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Tracker</span>
                  </Link>
                </>
              )}
              <Link
                href="/coach/progress"
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:border-[#FF5733]/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#FF5733]/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#FF5733]" />
                </div>
                <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Progress</span>
              </Link>
              <Link
                href="/coach/chat"
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:border-[#FF5733]/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#FF5733]/10 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-[#FF5733]" />
                </div>
                <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Ask Coach</span>
              </Link>
            </div>

            <div className="max-w-3xl mx-auto bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden p-6 sm:p-8 text-center space-y-4">
              <Sparkles className="w-8 h-8 text-[#FF5733] mx-auto" />
              <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-white font-raleway">
                {hasActivePlan ? "Regenerate your plan" : "Generate your plan"}
              </h2>
              <p className="text-sm text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans">
                {access.outOfPlans
                  ? access.tier === "free"
                    ? "You've used all your free plan generations. Subscribe to generate more."
                    : "You've used all your plan generations for this month."
                  : "Your coach will build a personalized week of workouts and meals based on your profile."}
              </p>
              <button
                onClick={handleGeneratePlan}
                disabled={!access.hasAccess || access.outOfPlans}
                className="px-8 py-3 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] disabled:opacity-50 text-white text-sm font-semibold font-raleway transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {hasActivePlan ? "Regenerate my plan" : "Generate my plan"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
