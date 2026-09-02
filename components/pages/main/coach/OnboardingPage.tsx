"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Dumbbell, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { calculateBmi, bmiCategory } from "@/lib/coach/nutrition";
import { saveIntake } from "@/app/actions/coach-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CoachHero from "./component/coach-hero";
import WizardShell from "./component/wizard-shell";
import OptionCards from "./component/option-cards";
import BodyShapeSelector, { type BodyShape } from "./component/body-shape-selector";

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", hint: "New to training, or returning after a long break" },
  { value: "intermediate", label: "Intermediate", hint: "Training consistently for 6+ months" },
  { value: "advanced", label: "Advanced", hint: "Years of consistent, structured training" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", hint: "Little to no exercise" },
  { value: "light", label: "Light", hint: "Exercise 1-3 days a week" },
  { value: "moderate", label: "Moderate", hint: "Exercise 3-5 days a week" },
  { value: "active", label: "Active", hint: "Exercise 6-7 days a week" },
  { value: "very_active", label: "Very active", hint: "Hard daily training" },
];

const GOAL_OPTIONS = [
  { value: "lose_fat", label: "Lose fat" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "maintain", label: "Maintain" },
  { value: "endurance", label: "Improve endurance" },
];

const SETTING_OPTIONS = [
  { value: "home", label: "At home", hint: "Living room, bedroom, or garage" },
  { value: "gym", label: "At a gym", hint: "Full machines and free weights" },
  { value: "outdoors", label: "Outdoors", hint: "Parks, trails, open spaces" },
  { value: "mixed", label: "A mix", hint: "Varies day to day" },
];

const EQUIPMENT_OPTIONS = [
  { value: "bodyweight", label: "Bodyweight only" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "resistance_bands", label: "Resistance bands" },
  { value: "pull_up_bar", label: "Pull-up bar" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "full_gym", label: "Full gym access" },
];

const BUDGET_OPTIONS = [
  { value: "low", label: "Low", hint: "Cheap staples — rice, eggs, local vegetables" },
  { value: "medium", label: "Medium", hint: "Moderate variety, some lean cuts and dairy" },
  { value: "high", label: "High", hint: "Wide variety, premium proteins" },
];

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n),
  label: `${n} day${n === 1 ? "" : "s"}`,
}));

const SESSION_OPTIONS = [
  { value: "20", label: "20 min", hint: "Short and focused" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min", hint: "Long sessions" },
];

const MAX_LIMITATIONS_CHARS = 500;

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans";

const labelClass =
  "block text-xs font-semibold text-foreground/60 mb-1.5 font-merriweather-sans";

export default function OnboardingPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [backHref, setBackHref] = useState("/");
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  const [sex, setSex] = useState("male");
  const [birthDate, setBirthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bodyShape, setBodyShape] = useState<BodyShape | null>(null);
  const [targetBodyShape, setTargetBodyShape] = useState<BodyShape | null>(null);
  const [goal, setGoal] = useState("lose_fat");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [workoutSetting, setWorkoutSetting] = useState("home");
  const [equipmentAccess, setEquipmentAccess] = useState<string[]>(["bodyweight"]);
  const [trainingDays, setTrainingDays] = useState("3");
  const [sessionMinutes, setSessionMinutes] = useState("45");
  const [budgetTier, setBudgetTier] = useState("medium");
  const [dailyBudgetPhp, setDailyBudgetPhp] = useState("");
  const [limitations, setLimitations] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // A user redoing onboarding has somewhere to go back to; a first-timer doesn't.
      const { data: profile } = await supabase.from("coach_profiles").select("id").eq("user_id", user.id).maybeSingle();
      setBackHref(profile ? "/coach" : "/");
      setCheckingAuth(false);
    }
    checkAuth();
  }, [router]);

  const height = parseFloat(heightCm);
  const weight = parseFloat(weightKg);
  const hasValidBmiInputs = height >= 100 && height <= 250 && weight >= 30 && weight <= 300;
  const bmi = hasValidBmiInputs ? calculateBmi(height, weight) : null;
  const category = bmi !== null ? bmiCategory(bmi) : null;

  function toggleEquipment(value: string) {
    setEquipmentAccess((prev) => {
      // "Bodyweight only" and real equipment are mutually exclusive claims —
      // picking one clears the other so the AI gets a coherent constraint.
      if (value === "bodyweight") return ["bodyweight"];
      const withoutBodyweight = prev.filter((v) => v !== "bodyweight");
      return withoutBodyweight.includes(value)
        ? withoutBodyweight.filter((v) => v !== value)
        : [...withoutBodyweight, value];
    });
  }

  const steps = [
    {
      title: "Let's start with the basics",
      hint: "This sets the baseline for your calorie and macro targets.",
      valid: Boolean(birthDate) && (sex === "male" || sex === "female"),
      body: (
        <>
          <div>
            <label className={labelClass}>Sex</label>
            <OptionCards options={SEX_OPTIONS} value={sex} onChange={setSex} columns={2} legend="Sex" />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Birth date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="birthDate"
                  variant="outline"
                  className={cn(
                    inputClass,
                    "flex items-center justify-between font-normal font-merriweather-sans hover:bg-[var(--surface-muted)] dark:hover:bg-[#2A2A2E]",
                    !birthDate && "text-foreground/30"
                  )}
                >
                  {birthDate ? format(new Date(birthDate + "T00:00:00"), "MMMM d, yyyy") : "Select your birth date"}
                  <CalendarIcon className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={birthDate ? new Date(birthDate + "T00:00:00") : undefined}
                  onSelect={(date) => setBirthDate(date ? format(date, "yyyy-MM-dd") : "")}
                  captionLayout="dropdown"
                  startMonth={new Date(1940, 0)}
                  endMonth={new Date()}
                  disabled={{ after: new Date() }}
                  defaultMonth={birthDate ? new Date(birthDate + "T00:00:00") : new Date(2000, 0)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      ),
    },
    {
      title: "Your height and weight",
      hint: "We use these to calculate your BMI and daily energy needs.",
      valid: hasValidBmiInputs,
      body: (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="heightCm" className={labelClass}>
                Height (cm)
              </label>
              <input
                id="heightCm"
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="175"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="weightKg" className={labelClass}>
                Weight (kg)
              </label>
              <input
                id="weightKg"
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="70"
                className={inputClass}
              />
            </div>
          </div>

          {bmi !== null && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--brand)]/8 border border-[var(--brand)]/20">
              <span className="text-sm text-foreground/70 font-merriweather-sans">Your BMI</span>
              <span className="text-sm font-semibold text-[var(--brand-hover)] font-raleway capitalize">
                {bmi} · {category}
              </span>
            </div>
          )}
        </>
      ),
    },
    {
      title: "Which build looks most like you now?",
      hint: "A rough self-assessment. It helps your coach frame the plan — it isn't a measurement.",
      valid: bodyShape !== null,
      body: (
        <BodyShapeSelector
          value={bodyShape}
          onChange={setBodyShape}
          sex={sex as "male" | "female"}
          legend="Current build"
        />
      ),
    },
    {
      title: "What are you working toward?",
      hint: "Pick the build you want and the goal that matches it.",
      valid: targetBodyShape !== null,
      body: (
        <>
          <BodyShapeSelector
            value={targetBodyShape}
            onChange={setTargetBodyShape}
            sex={sex as "male" | "female"}
            legend="Target build"
          />
          <div>
            <label className={labelClass}>Primary goal</label>
            <OptionCards options={GOAL_OPTIONS} value={goal} onChange={setGoal} columns={2} legend="Primary goal" />
          </div>
          <div>
            <label htmlFor="targetWeight" className={labelClass}>
              Target weight (kg) — optional
            </label>
            <input
              id="targetWeight"
              type="number"
              inputMode="decimal"
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(e.target.value)}
              placeholder="65"
              className={inputClass}
            />
          </div>
        </>
      ),
    },
    {
      title: "How much training have you done?",
      hint: "This sets the starting difficulty so your plan isn't too easy or too punishing.",
      valid: true,
      body: (
        <>
          <div>
            <label className={labelClass}>Experience</label>
            <OptionCards
              options={EXPERIENCE_OPTIONS}
              value={experienceLevel}
              onChange={setExperienceLevel}
              legend="Experience level"
            />
          </div>
          <div>
            <label className={labelClass}>Current activity level</label>
            <OptionCards
              options={ACTIVITY_OPTIONS}
              value={activityLevel}
              onChange={setActivityLevel}
              legend="Activity level"
            />
          </div>
        </>
      ),
    },
    {
      title: "Where will you train?",
      hint: "Your coach will only prescribe exercises your setup can actually support.",
      valid: equipmentAccess.length > 0,
      body: (
        <>
          <div>
            <label className={labelClass}>Setting</label>
            <OptionCards
              options={SETTING_OPTIONS}
              value={workoutSetting}
              onChange={setWorkoutSetting}
              columns={2}
              legend="Workout setting"
            />
          </div>
          <div>
            <label className={labelClass}>Equipment available</label>
            <OptionCards
              options={EQUIPMENT_OPTIONS}
              value={equipmentAccess}
              onChange={toggleEquipment}
              multi
              columns={2}
              legend="Equipment available"
            />
          </div>
        </>
      ),
    },
    {
      title: "How much time can you commit?",
      hint: "Be realistic — a plan you can keep beats a plan you abandon.",
      valid: true,
      body: (
        <>
          <div>
            <label className={labelClass}>Training days per week</label>
            <OptionCards
              options={DAYS_OPTIONS}
              value={trainingDays}
              onChange={setTrainingDays}
              columns={2}
              legend="Training days per week"
            />
          </div>
          <div>
            <label className={labelClass}>Time per session</label>
            <OptionCards
              options={SESSION_OPTIONS}
              value={sessionMinutes}
              onChange={setSessionMinutes}
              columns={2}
              legend="Session length"
            />
          </div>
        </>
      ),
    },
    {
      title: "Food budget and anything we should avoid",
      hint: "Your meal plan is built to this budget. Tell us about injuries so your coach works around them.",
      valid: true,
      body: (
        <>
          <div>
            <label className={labelClass}>Meal budget</label>
            <OptionCards options={BUDGET_OPTIONS} value={budgetTier} onChange={setBudgetTier} legend="Meal budget" />
          </div>
          <div>
            <label htmlFor="dailyBudget" className={labelClass}>
              Daily food budget (₱) — optional
            </label>
            <input
              id="dailyBudget"
              type="number"
              inputMode="decimal"
              value={dailyBudgetPhp}
              onChange={(e) => setDailyBudgetPhp(e.target.value)}
              placeholder="300"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="limitations" className={labelClass}>
              Injuries or limitations — optional
            </label>
            <textarea
              id="limitations"
              value={limitations}
              onChange={(e) => setLimitations(e.target.value.slice(0, MAX_LIMITATIONS_CHARS))}
              placeholder="e.g. bad left knee, avoid overhead pressing"
              rows={3}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-xs text-foreground/40 font-merriweather-sans">
              {limitations.length}/{MAX_LIMITATIONS_CHARS}
            </p>
          </div>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function handleNext() {
    if (!current.valid) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    handleSubmit();
  }

  function handleSubmit() {
    // Server-side validation is the real gate; this catches the case where a
    // user edited an earlier step's value into an invalid state.
    if (!hasValidBmiInputs) {
      toast.error("Enter a valid height (100-250cm) and weight (30-300kg).");
      setStep(1);
      return;
    }
    if (!birthDate) {
      toast.error("Please enter your birth date.");
      setStep(0);
      return;
    }

    startTransition(async () => {
      const result = await saveIntake({
        heightCm: height,
        weightKg: weight,
        birthDate,
        sex: sex as "male" | "female",
        activityLevel: activityLevel as "sedentary" | "light" | "moderate" | "active" | "very_active",
        goal: goal as "lose_fat" | "build_muscle" | "maintain" | "endurance",
        targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : undefined,
        dietaryRestrictions: [],
        equipmentAccess,
        budgetTier: budgetTier as "low" | "medium" | "high",
        dailyBudgetPhp: dailyBudgetPhp ? parseFloat(dailyBudgetPhp) : undefined,
        bodyShape: bodyShape ?? undefined,
        targetBodyShape: targetBodyShape ?? undefined,
        workoutSetting: workoutSetting as "home" | "gym" | "outdoors" | "mixed",
        trainingDaysPerWeek: parseInt(trainingDays, 10),
        sessionMinutes: parseInt(sessionMinutes, 10),
        experienceLevel: experienceLevel as "beginner" | "intermediate" | "advanced",
        limitations: limitations.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }

      toast.success("Profile saved! Your 14-day trial has started.");
      router.push("/coach");
    });
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-hover)]" />
      </div>
    );
  }

  const summaryRows: { label: string; value: string }[] = [];
  if (birthDate) summaryRows.push({ label: "Sex", value: sex === "male" ? "Male" : "Female" });
  if (bmi !== null) summaryRows.push({ label: "BMI", value: `${bmi} · ${category}` });
  if (bodyShape) summaryRows.push({ label: "Current build", value: bodyShape });
  if (targetBodyShape) summaryRows.push({ label: "Target build", value: targetBodyShape });
  if (step >= 3) summaryRows.push({ label: "Goal", value: GOAL_OPTIONS.find((g) => g.value === goal)?.label ?? goal });
  if (step >= 4) {
    summaryRows.push({
      label: "Experience",
      value: EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label ?? experienceLevel,
    });
  }
  if (step >= 5) {
    summaryRows.push({
      label: "Trains at",
      value: SETTING_OPTIONS.find((o) => o.value === workoutSetting)?.label ?? workoutSetting,
    });
  }
  if (step >= 6) summaryRows.push({ label: "Frequency", value: `${trainingDays}x/week, ${sessionMinutes} min` });
  if (step >= 7) {
    summaryRows.push({
      label: "Budget",
      value: BUDGET_OPTIONS.find((o) => o.value === budgetTier)?.label ?? budgetTier,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <CoachHero icon={Dumbbell} title="Build your plan" backHref={backHref} maxWidthClassName="max-w-5xl" />

      <div className="max-w-5xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 max-w-2xl w-full">
          <WizardShell
            stepIndex={step}
            stepCount={steps.length}
            title={current.title}
            hint={current.hint}
            canAdvance={current.valid}
            isLast={isLast}
            isSubmitting={isPending}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            onNext={handleNext}
          >
            {current.body}
          </WizardShell>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-5 lg:sticky lg:top-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground font-raleway">
              Building your profile
            </h2>
            {summaryRows.length === 0 ? (
              <p className="text-sm text-foreground/40 font-merriweather-sans">
                Your answers will show up here as you go.
              </p>
            ) : (
              <dl className="space-y-2">
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-sm font-merriweather-sans">
                    <dt className="text-foreground/50">{row.label}</dt>
                    <dd className="text-foreground font-semibold capitalize text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="text-xs text-foreground/40 font-merriweather-sans pt-2 border-t border-black/5 dark:border-white/5">
              Your coach uses all of this to build a plan that fits your equipment, schedule, and budget.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
