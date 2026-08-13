"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  calculateTargets,
  type ActivityLevel,
  type Goal,
  type Sex,
} from "@/lib/coach/nutrition";
import { generatePlan as generatePlanFromAi, type ChatMessage } from "@/lib/ai/provider";
import { allExerciseNames } from "@/lib/ai/plan-schema";
import { findEquipmentViolations, describeViolationsForRetry } from "@/lib/coach/equipment-guardrail";
import { ANIMATION_VOCABULARY_SIZE, describeAnimationVocabularyForPrompt } from "@/lib/coach/exercise-animations";
import { tierOf, type CoachTier } from "@/lib/coach/tiers";
import {
  applyPrescriptions,
  exercisesPerSession,
  parseExperienceLevel,
  parseGoal,
} from "@/lib/coach/prescription";
import { consumeQuota, peekQuota, refundQuota, exhaustedMessage, type QuotaState } from "@/lib/coach/quota";

export type ActionResult = {
  success: boolean;
  error?: string;
};

const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const GOALS: Goal[] = ["lose_fat", "build_muscle", "maintain", "endurance"];
const BUDGET_TIERS = ["low", "medium", "high"] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

const BODY_SHAPES = ["slim", "average", "athletic", "heavier"] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

const WORKOUT_SETTINGS = ["home", "gym", "outdoors", "mixed"] as const;
export type WorkoutSetting = (typeof WORKOUT_SETTINGS)[number];

const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const MAX_LIMITATIONS_CHARS = 500;

export interface IntakeInput {
  heightCm: number;
  weightKg: number;
  birthDate: string;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg?: number;
  dietaryRestrictions: string[];
  equipmentAccess: string[];
  budgetTier: BudgetTier;
  dailyBudgetPhp?: number;
  bodyShape?: BodyShape;
  targetBodyShape?: BodyShape;
  workoutSetting: WorkoutSetting;
  trainingDaysPerWeek: number;
  sessionMinutes: number;
  experienceLevel: ExperienceLevel;
  limitations?: string;
}

function validateIntake(input: IntakeInput): string | null {
  if (!(input.heightCm >= 100 && input.heightCm <= 250)) return "Height must be between 100 and 250 cm.";
  if (!(input.weightKg >= 30 && input.weightKg <= 300)) return "Weight must be between 30 and 300 kg.";
  if (!input.birthDate || Number.isNaN(new Date(input.birthDate).getTime())) return "A valid birth date is required.";
  if (input.sex !== "male" && input.sex !== "female") return "Sex must be male or female.";
  if (!ACTIVITY_LEVELS.includes(input.activityLevel)) return "Invalid activity level.";
  if (!GOALS.includes(input.goal)) return "Invalid goal.";
  if (input.targetWeightKg !== undefined && !(input.targetWeightKg >= 30 && input.targetWeightKg <= 300)) {
    return "Target weight must be between 30 and 300 kg.";
  }
  if (!BUDGET_TIERS.includes(input.budgetTier)) return "Invalid budget tier.";
  if (input.dailyBudgetPhp !== undefined && !(input.dailyBudgetPhp > 0)) {
    return "Daily budget must be greater than 0.";
  }
  if (input.bodyShape !== undefined && !BODY_SHAPES.includes(input.bodyShape)) return "Invalid body shape.";
  if (input.targetBodyShape !== undefined && !BODY_SHAPES.includes(input.targetBodyShape)) {
    return "Invalid target body shape.";
  }
  if (!WORKOUT_SETTINGS.includes(input.workoutSetting)) return "Invalid workout setting.";
  if (!EXPERIENCE_LEVELS.includes(input.experienceLevel)) return "Invalid experience level.";
  if (!Number.isInteger(input.trainingDaysPerWeek) || input.trainingDaysPerWeek < 1 || input.trainingDaysPerWeek > 7) {
    return "Training days must be between 1 and 7.";
  }
  if (!Number.isInteger(input.sessionMinutes) || input.sessionMinutes < 10 || input.sessionMinutes > 180) {
    return "Session length must be between 10 and 180 minutes.";
  }
  if (input.limitations !== undefined && input.limitations.length > MAX_LIMITATIONS_CHARS) {
    return `Injuries and limitations must be under ${MAX_LIMITATIONS_CHARS} characters.`;
  }
  return null;
}

/**
 * Saves the intake profile (the BMI-calculator + goal step) and computes
 * nutrition targets server-side. Upserts, since a user may redo onboarding
 * after their stats change.
 */
export async function saveIntake(input: IntakeInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const validationError = validateIntake(input);
  if (validationError) return { success: false, error: validationError };

  const targets = calculateTargets({
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    birthDate: input.birthDate,
    sex: input.sex,
    activityLevel: input.activityLevel,
    goal: input.goal,
  });

  const { error } = await supabase.from("coach_profiles").upsert(
    {
      user_id: user.id,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      birth_date: input.birthDate,
      sex: input.sex,
      activity_level: input.activityLevel,
      goal: input.goal,
      target_weight_kg: input.targetWeightKg ?? null,
      dietary_restrictions: input.dietaryRestrictions,
      equipment_access: input.equipmentAccess,
      budget_tier: input.budgetTier,
      daily_budget_php: input.dailyBudgetPhp ?? null,
      body_shape: input.bodyShape ?? null,
      target_body_shape: input.targetBodyShape ?? null,
      workout_setting: input.workoutSetting,
      training_days_per_week: input.trainingDaysPerWeek,
      session_minutes: input.sessionMinutes,
      experience_level: input.experienceLevel,
      limitations: input.limitations?.trim() || null,
      tdee_kcal: targets.tdee,
      daily_kcal_target: targets.dailyKcal,
      protein_g_target: targets.proteinG,
      carbs_g_target: targets.carbsG,
      fat_g_target: targets.fatG,
    },
    { onConflict: "user_id" }
  );

  if (error) return { success: false, error: "Failed to save your profile. Please try again." };

  // First-time intake also starts the 14-day trial, if one doesn't exist yet.
  const { data: existingSub } = await supabase
    .from("coach_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingSub) {
    const { error: subError } = await supabase.from("coach_subscriptions").insert({ user_id: user.id });
    if (subError) return { success: false, error: "Profile saved, but failed to start your trial. Please contact support." };
  }

  revalidatePath("/coach");
  return { success: true };
}

export interface CoachAccess {
  hasProfile: boolean;
  hasAccess: boolean;
  status: "trialing" | "active" | "expired" | "cancelled" | "none";
  trialEndsAt: string | null;
  tier: CoachTier;
  /** Remaining allowance, for display. Enforcement happens at consume time. */
  planQuota: QuotaState;
  chatQuota: QuotaState;
  /** True when the tier's allowance is spent — free users must subscribe. */
  outOfPlans: boolean;
  outOfChat: boolean;
  /**
   * Why access was denied, so callers stop inferring "expired" from a bare
   * hasAccess: false. "none" (never started a trial) is NOT the same as
   * "expired" — telling a brand-new user their trial ended is the bug this
   * field exists to prevent.
   */
  deniedReason: "trial_expired" | "cancelled" | "not_started" | null;
  /** Whole days left in the trial, floored at 0. null once off the free tier. */
  trialDaysLeft: number | null;
}

const EMPTY_QUOTA: QuotaState = { used: 0, limit: 0, remaining: 0, exhausted: true };

/**
 * The single source of truth for trial/subscription gating. Every coach
 * server action must call this and refuse to act if hasAccess is false —
 * a client-side check alone is not a gate.
 */
export async function getCoachAccess(): Promise<CoachAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      hasProfile: false,
      hasAccess: false,
      status: "none",
      trialEndsAt: null,
      tier: "free",
      planQuota: EMPTY_QUOTA,
      chatQuota: EMPTY_QUOTA,
      outOfPlans: true,
      outOfChat: true,
      deniedReason: "not_started",
      trialDaysLeft: null,
    };
  }

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("coach_profiles").select("id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("coach_subscriptions")
      .select("status, trial_ends_at, tier")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // No subscription row means the trial was never started (the user hasn't
  // finished onboarding yet). That is emphatically NOT an expired trial —
  // saying so to a brand-new user is wrong and reads as a dead end.
  if (!sub) {
    return {
      hasProfile: !!profile,
      hasAccess: false,
      status: "none",
      trialEndsAt: null,
      tier: "free",
      planQuota: EMPTY_QUOTA,
      chatQuota: EMPTY_QUOTA,
      outOfPlans: true,
      outOfChat: true,
      deniedReason: "not_started",
      trialDaysLeft: null,
    };
  }

  const trialExpired = sub.status === "trialing" && new Date(sub.trial_ends_at) < new Date();
  const status = trialExpired ? "expired" : (sub.status as CoachAccess["status"]);
  const tier = tierOf(sub.tier).id;

  const [planQuota, chatQuota] = await Promise.all([
    peekQuota(supabase, user.id, tier, "plan"),
    peekQuota(supabase, user.id, tier, "chat"),
  ]);

  const hasAccess = status === "trialing" || status === "active";

  const msLeft = new Date(sub.trial_ends_at).getTime() - Date.now();
  const trialDaysLeft =
    tier === "free" && status === "trialing" ? Math.max(0, Math.ceil(msLeft / 86_400_000)) : null;

  // Losing access and running out of quota are different things. hasAccess
  // covers only time/status, so the UI can distinguish "your 14 days are up"
  // from "you've used your 20 messages" — a free user who spends their quota
  // on day 2 still has an active trial and should not be told it ended.
  return {
    hasProfile: !!profile,
    hasAccess,
    status,
    trialEndsAt: sub.trial_ends_at,
    tier,
    planQuota,
    chatQuota,
    outOfPlans: planQuota.exhausted,
    outOfChat: chatQuota.exhausted,
    deniedReason: hasAccess ? null : status === "cancelled" ? "cancelled" : "trial_expired",
    trialDaysLeft,
  };
}

/**
 * Generates and persists a new active plan from the user's saved intake.
 * Archives whichever plan is currently active first, so historical logs
 * (which reference plan_item_id, not plan_id) are never disturbed —
 * see coach_food_logs' denormalized macros in the schema.
 */
export async function generatePlanForUser(): Promise<ActionResult & { planId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const access = await getCoachAccess();
  if (!access.hasProfile) return { success: false, error: "Complete onboarding before generating a plan." };
  if (!access.hasAccess) {
    return {
      success: false,
      error:
        access.deniedReason === "cancelled"
          ? "Your subscription was cancelled. Resubscribe to continue."
          : "Your 14-day free trial is over. Subscribe to continue.",
    };
  }

  // Claim the quota BEFORE the provider call. A generation that isn't paid
  // for by an allowance must never reach the model.
  const tierDef = tierOf(access.tier);
  const { granted } = await consumeQuota(supabase, tierDef.id, "plan");
  if (!granted) return { success: false, error: exhaustedMessage(tierDef.id, "plan") };

  const { data: profile, error: profileError } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile) {
    await refundQuota(supabase, user.id, tierDef.id, "plan");
    return { success: false, error: "Could not load your profile." };
  }

  const equipmentList = profile.equipment_access?.length ? profile.equipment_access.join(", ") : "bodyweight only";
  const budgetTier = profile.budget_tier ?? "medium";
  const budgetLine = profile.daily_budget_php
    ? `The user's daily food budget is roughly ₱${profile.daily_budget_php} — treat this as a firm ceiling, not just a preference.`
    : `The user has not given an exact amount, so use "${budgetTier}" budget as your guide.`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are an AI fitness and nutrition coach. Generate a structured weekly plan as a single JSON object with this exact shape:
{
  "summary": string,
  "weeks": number,
  "items": [
    { "itemType":"meal", "dayIndex":0-6, "slot":"breakfast"|"lunch"|"dinner"|"snack", "title":string, "kcal":number, "proteinG":number, "carbsG":number, "fatG":number, "details":{"ingredients":[{"name":string,"grams":number}]} },
    { "itemType":"workout", "dayIndex":0-6, "slot":"am"|"pm", "title":string, "details":{"exercises":[{"name":string,"mode":"reps"|"time","warmup":boolean}]} }
  ],
  "healthTips": [string]
}
Cover all 7 days (dayIndex 0-6). Each day needs breakfast, lunch, and dinner, and each meal's macros must sum close to the daily targets given.

Training frequency: schedule workouts on exactly the number of training days the user gives you — the remaining days are rest days with meals but no workout. Since you no longer set sets or reps, fit the session length by adjusting how MANY exercises a session contains — the user message tells you the target count. Every exercise in a session must be a DIFFERENT movement from this vocabulary — never list the same exercise twice in one session's "exercises" array, even under a slightly different name (e.g. "Squat" and "Bodyweight squat" count as the same exercise). The target count already accounts for the vocabulary size, so you should never need to repeat one to reach it; if you truly run out of distinct movements that fit the day's focus, use fewer exercises rather than repeat.

Equipment constraint: every exercise you list must be doable with ONLY the equipment the user has available and in their stated training setting — do not suggest machines, weights, or accessories they don't have. Each vocabulary entry below notes what it needs beyond bodyweight, if anything. Start each workout with 2-3 warm-up movements (marked "warmup": true in their exercise entry) appropriate to that day's main exercises before the working sets.

This coach is scoped to running-support conditioning, not general gym training — Fitra is a running platform, and every workout you build should read as "what keeps a runner training injury-free and strong," not a generic push/pull/legs split. Draw your exercises from this vocabulary (use these names or close variants so they render correctly in the app): ${describeAnimationVocabularyForPrompt()}. Order each session as: 1-2 warm-up movements (high knees or bodyweight squats work well), then the strength/stability work for that day (squat, lunge, step-up, single-leg RDL cover quad/hamstring/glute strength; calf raise covers calf/Achilles; glute bridge, lateral band walk, and kettlebell swing cover hip stability, posterior-chain power, and injury prevention). Do not invent exercises outside this vocabulary or reach for upper-body/gym-machine movements (bench press, shoulder press, rows, pull-ups) — they are out of scope for this coach.

Exercise prescription: do NOT specify sets, reps, rest, or duration — the app assigns those deterministically from the user's experience level and goal, and anything you write for them is discarded. Your job is choosing the right exercises from the vocabulary above and ordering them sensibly. Every exercise needs a "mode": use "time" for anything measured by how long it is held or performed, and "reps" for anything counted in repetitions — for this vocabulary specifically, only high knees is "time" (it's paced like running in place); everything else, including lateral band walks (counted in steps), is "reps".

Experience constraint: match exercise complexity and selection to the user's stated experience level. Beginners get simple, low-skill movements. Training volume is set by the app — do not adjust it yourself.

Limitations: if the user reports an injury or limitation, do not prescribe any movement that loads it. Work around it and say so in the summary.

Budget constraint: every meal's ingredients must fit a "${budgetTier}" cost tier. Low = cheap staples (rice, eggs, chicken thigh, local vegetables, canned fish). Medium = moderate variety (lean cuts, some fruit, dairy). High = broader variety including premium proteins and imported items is fine. ${budgetLine}

healthTips: 3-5 short, practical lifestyle pointers relevant to this user's goal — sleep, hydration, recovery, adherence habits. General wellness guidance only. Do NOT give medical advice, diagnose, or reference medication. If the user's limitations sound like they need professional care, one tip may suggest seeing a qualified professional.

Reply with ONLY the JSON object — no prose, no markdown fences.`,
    },
    {
      role: "user",
      content: `Sex: ${profile.sex}. Height: ${profile.height_cm}cm. Weight: ${profile.weight_kg}kg. Activity level: ${profile.activity_level}. Goal: ${profile.goal}.${
        profile.body_shape ? ` Self-described current build: ${profile.body_shape}.` : ""
      }${
        profile.target_body_shape ? ` Build they want: ${profile.target_body_shape}.` : ""
      } Experience level: ${profile.experience_level ?? "beginner"}. Trains ${profile.training_days_per_week ?? 3} day(s) per week, about ${profile.session_minutes ?? 45} minutes per session, setting: ${profile.workout_setting ?? "home"}. Include about ${Math.min(exercisesPerSession(profile.session_minutes ?? 45), ANIMATION_VOCABULARY_SIZE)} exercises per session, including 2-3 warm-ups.${
        profile.limitations ? ` Injuries or limitations to work around: ${profile.limitations}.` : ""
      }${
        profile.dietary_restrictions?.length ? ` Dietary restrictions: ${profile.dietary_restrictions.join(", ")}.` : ""
      } Available equipment: ${equipmentList}. Budget tier: ${budgetTier}.${
        profile.daily_budget_php ? ` Daily food budget: ₱${profile.daily_budget_php}.` : ""
      } Daily targets: ${profile.daily_kcal_target} kcal, ${profile.protein_g_target}g protein, ${profile.carbs_g_target}g carbs, ${profile.fat_g_target}g fat. ${
        tierDef.planWeeks > 1
          ? `Build me a ${tierDef.planWeeks}-week periodized plan — set "weeks" to ${tierDef.planWeeks} and progress the training load across the weeks.`
          : "Build my week 1 plan."
      }`,
    },
  ];

  const equipmentAccess: string[] = profile.equipment_access ?? [];

  let generated;
  try {
    // Pro routes plan generation to the frontier model; other tiers pass null
    // and get the configured default.
    generated = await generatePlanFromAi(messages, { model: tierDef.planModel });

    // The system prompt already tells the model to stick to the user's
    // equipment, and that works most of the time — but it's steering, not
    // enforcement. Scan the actual output before it ever reaches the DB, and
    // give the model exactly one chance to fix it with the specific offenders
    // named, same as the provider's own JSON-schema retry.
    let violations = findEquipmentViolations(allExerciseNames(generated.plan), equipmentAccess);
    if (violations.length > 0) {
      generated = await generatePlanFromAi(
        [...messages, { role: "user", content: describeViolationsForRetry(violations, equipmentAccess) }],
        { model: tierDef.planModel }
      );
      violations = findEquipmentViolations(allExerciseNames(generated.plan), equipmentAccess);
      if (violations.length > 0) {
        await refundQuota(supabase, user.id, tierDef.id, "plan");
        return {
          success: false,
          error: "The AI coach couldn't build a plan matching your equipment. Please try generating again.",
        };
      }
    }
  } catch {
    // The user never got a plan, so give the allowance back.
    await refundQuota(supabase, user.id, tierDef.id, "plan");
    return { success: false, error: "The AI coach is unavailable right now. Please try again shortly." };
  }

  // Volume is assigned here, not by the model — same profile, same numbers,
  // every time. Runs AFTER the equipment guardrail (whose corrective retry can
  // replace the whole plan, which would otherwise discard this work) and
  // BEFORE persistence, since details goes straight through to JSONB below.
  const plan = applyPrescriptions(generated.plan, {
    experienceLevel: parseExperienceLevel(profile.experience_level),
    goal: parseGoal(profile.goal),
  });

  const { data: currentActive } = await supabase
    .from("coach_plans")
    .select("id, version")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (currentActive) {
    const { error: archiveError } = await supabase
      .from("coach_plans")
      .update({ status: "archived" })
      .eq("id", currentActive.id);
    if (archiveError) return { success: false, error: "Failed to archive your previous plan." };
  }

  const nextVersion = (currentActive?.version ?? 0) + 1;
  const { data: newPlan, error: planError } = await supabase
    .from("coach_plans")
    .insert({
      user_id: user.id,
      version: nextVersion,
      starts_on: new Date().toISOString().slice(0, 10),
      weeks: plan.weeks,
      summary: plan.summary,
      health_tips: plan.healthTips ?? [],
      generated_by: generated.generatedBy,
    })
    .select("id")
    .single();

  if (planError || !newPlan) return { success: false, error: "Failed to save the generated plan." };

  const rows = plan.items.map((item) =>
    item.itemType === "meal"
      ? {
          plan_id: newPlan.id,
          day_index: item.dayIndex,
          item_type: "meal",
          slot: item.slot,
          title: item.title,
          details: item.details,
          kcal: item.kcal,
          protein_g: item.proteinG,
          carbs_g: item.carbsG,
          fat_g: item.fatG,
        }
      : {
          plan_id: newPlan.id,
          day_index: item.dayIndex,
          item_type: "workout",
          slot: item.slot,
          title: item.title,
          details: item.details,
        }
  );

  const { error: itemsError } = await supabase.from("coach_plan_items").insert(rows);
  if (itemsError) {
    // Roll back the orphaned plan header rather than leave an empty active plan behind.
    await supabase.from("coach_plans").delete().eq("id", newPlan.id);
    return { success: false, error: "Failed to save the plan's workouts and meals." };
  }

  revalidatePath("/coach");
  revalidatePath("/coach/planner");
  return { success: true, planId: newPlan.id };
}

export interface PlanItemRow {
  id: string;
  dayIndex: number;
  itemType: "meal" | "workout";
  slot: string;
  title: string;
  details: Record<string, unknown>;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface ActivePlan {
  id: string;
  weeks: number;
  startsOn: string;
  summary: string | null;
  healthTips: string[];
  items: PlanItemRow[];
  /** Plan-item IDs the user has already marked complete. */
  completedItemIds: string[];
}

/** Fetches the user's active plan and its items, shaped for the planner grid. */
export async function getActivePlan(): Promise<ActivePlan | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase
    .from("coach_plans")
    .select("id, weeks, starts_on, summary, health_tips")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) return null;

  const { data: items } = await supabase
    .from("coach_plan_items")
    .select("id, day_index, item_type, slot, title, details, kcal, protein_g, carbs_g, fat_g")
    .eq("plan_id", plan.id)
    .order("day_index")
    .order("slot");

  // Which of this plan's workouts are already logged, so the planner can render
  // them as done without a second round trip per card.
  const { data: completed } = await supabase
    .from("coach_workout_logs")
    .select("plan_item_id")
    .eq("user_id", user.id)
    .not("plan_item_id", "is", null);

  return {
    id: plan.id,
    weeks: plan.weeks,
    startsOn: plan.starts_on,
    summary: plan.summary,
    healthTips: plan.health_tips ?? [],
    completedItemIds: (completed ?? []).map((c) => c.plan_item_id as string),
    items: (items ?? []).map((i) => ({
      id: i.id,
      dayIndex: i.day_index,
      itemType: i.item_type,
      slot: i.slot,
      title: i.title,
      details: i.details,
      kcal: i.kcal,
      proteinG: i.protein_g,
      carbsG: i.carbs_g,
      fatG: i.fat_g,
    })),
  };
}

export interface FoodLogRow {
  id: string;
  slot: string;
  source: "plan" | "manual";
  planItemId: string | null;
  foodName: string;
  grams: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Fetches everything logged for one day, oldest first. */
export async function getDailyLogs(date: string): Promise<FoodLogRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("coach_food_logs")
    .select("id, slot, source, plan_item_id, food_name, grams, kcal, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .eq("logged_on", date)
    .order("created_at");

  return (data ?? []).map((l) => ({
    id: l.id,
    slot: l.slot,
    source: l.source,
    planItemId: l.plan_item_id,
    foodName: l.food_name,
    grams: l.grams,
    kcal: l.kcal,
    proteinG: l.protein_g,
    carbsG: l.carbs_g,
    fatG: l.fat_g,
  }));
}

/**
 * Logs a planned meal as eaten. Macros are copied from the plan item now,
 * not joined later — see coach_food_logs' table comment for why. The DB's
 * partial unique index on plan_item_id is the real duplicate guard; this
 * just turns that constraint violation into a clean message instead of a
 * raw Postgres error reaching the UI.
 */
export async function logPlannedMeal(planItemId: string, date: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { data: item, error: itemError } = await supabase
    .from("coach_plan_items")
    .select("slot, title, kcal, protein_g, carbs_g, fat_g, item_type")
    .eq("id", planItemId)
    .single();
  if (itemError || !item) return { success: false, error: "That meal could not be found." };
  if (item.item_type !== "meal") return { success: false, error: "Only meals can be logged." };

  const { error } = await supabase.from("coach_food_logs").insert({
    user_id: user.id,
    logged_on: date,
    slot: item.slot,
    source: "plan",
    plan_item_id: planItemId,
    food_name: item.title,
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
  });

  if (error) {
    if (error.code === "23505") return { success: false, error: "You already logged this meal today." };
    return { success: false, error: "Failed to log this meal." };
  }

  revalidatePath("/coach/tracker");
  return { success: true };
}

export interface ManualFoodInput {
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  foodName: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Logs off-plan food the user entered by hand — grams and macros as typed. */
export async function logManualFood(input: ManualFoodInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  if (!input.foodName.trim()) return { success: false, error: "Enter a food name." };
  if (!(input.grams > 0)) return { success: false, error: "Grams must be greater than 0." };
  if (input.kcal < 0) return { success: false, error: "Calories can't be negative." };

  const { error } = await supabase.from("coach_food_logs").insert({
    user_id: user.id,
    logged_on: input.date,
    slot: input.slot,
    source: "manual",
    food_name: input.foodName.trim(),
    grams: input.grams,
    kcal: Math.round(input.kcal),
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
  });

  if (error) return { success: false, error: "Failed to log this food." };

  revalidatePath("/coach/tracker");
  return { success: true };
}

/** Removes a single log entry — undoing a mislog, planned or manual. */
export async function deleteFoodLog(logId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase.from("coach_food_logs").delete().eq("id", logId).eq("user_id", user.id);
  if (error) return { success: false, error: "Failed to remove this entry." };

  revalidatePath("/coach/tracker");
  return { success: true };
}
