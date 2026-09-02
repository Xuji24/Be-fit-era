"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface WizardShellProps {
  stepIndex: number;
  stepCount: number;
  title: string;
  hint?: string;
  /** Blocks Next while the current step is incomplete. */
  canAdvance: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
  children: React.ReactNode;
}

/** Chrome for one question in the onboarding flow: progress, body, nav. */
export default function WizardShell({
  stepIndex,
  stepCount,
  title,
  hint,
  canAdvance,
  isLast,
  isSubmitting,
  onBack,
  onNext,
  children,
}: WizardShellProps) {
  const progress = ((stepIndex + 1) / stepCount) * 100;

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="h-1 bg-[var(--surface-muted)] dark:bg-[#2A2A2E]">
        <div
          className="h-full bg-[var(--brand)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-label={`Step ${stepIndex + 1} of ${stepCount}`}
        />
      </div>

      <div className="p-6 sm:p-8 space-y-5">
        <div>
          <p className="text-xs font-semibold text-[var(--brand-hover)] uppercase tracking-wider font-raleway">
            Step {stepIndex + 1} of {stepCount}
          </p>
          <h2 className="mt-1 text-lg font-bold text-foreground font-raleway">{title}</h2>
          {hint && (
            <p className="mt-1 text-sm text-foreground/50 font-merriweather-sans">{hint}</p>
          )}
        </div>

        <div className="space-y-5">{children}</div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIndex === 0 || isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm font-semibold text-foreground font-raleway disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance || isSubmitting}
            className="flex-1 px-6 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--brand-ink)] text-sm font-semibold font-raleway transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLast ? (
              "Build my plan"
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
