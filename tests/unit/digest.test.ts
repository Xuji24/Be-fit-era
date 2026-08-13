import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeWeekSummary, formatDigestMessage, isoWeekKey } from "@/lib/coach/digest";

/** Minimal chain stub: .from(table).select(cols).eq(col,val).gte(col,val).lte(col,val) -> Promise. */
function stubClient(foodRows: { logged_on: string; kcal: number; protein_g: number }[], workoutCount: number): SupabaseClient {
  const from = (table: string) => ({
    select: () => ({
      eq: () => ({
        gte: () => ({
          lte: () =>
            Promise.resolve({
              data: table === "coach_food_logs" ? foodRows : Array.from({ length: workoutCount }, () => ({})),
              error: null,
            }),
        }),
      }),
    }),
  });
  return { from } as unknown as SupabaseClient;
}

const WEEK_START = new Date("2026-08-03T00:00:00Z");

describe("computeWeekSummary", () => {
  it("aggregates days logged, workouts, and daily averages", async () => {
    const client = stubClient(
      [
        { logged_on: "2026-08-03", kcal: 1800, protein_g: 120 },
        { logged_on: "2026-08-03", kcal: 200, protein_g: 10 }, // same day, second entry
        { logged_on: "2026-08-04", kcal: 2000, protein_g: 130 },
      ],
      3
    );

    const summary = await computeWeekSummary(client, "user-1", WEEK_START);

    expect(summary.daysLogged).toBe(2);
    expect(summary.workoutsCompleted).toBe(3);
    // total kcal 4000 / 2 days logged = 2000
    expect(summary.avgKcal).toBe(2000);
    expect(summary.avgProteinG).toBe(130);
  });

  it("returns zeroed averages when nothing was logged", async () => {
    const client = stubClient([], 0);
    const summary = await computeWeekSummary(client, "user-1", WEEK_START);

    expect(summary.daysLogged).toBe(0);
    expect(summary.avgKcal).toBe(0);
    expect(summary.avgProteinG).toBe(0);
  });
});

describe("formatDigestMessage", () => {
  it("summarizes a week with activity", () => {
    const { title, body } = formatDigestMessage({ daysLogged: 5, workoutsCompleted: 3, avgKcal: 1900, avgProteinG: 120 });
    expect(title).toBe("Your week in review");
    expect(body).toContain("5/7 days");
    expect(body).toContain("3 workouts");
    expect(body).toContain("1900 kcal");
    expect(body).toContain("120g protein");
  });

  it("uses singular wording for one day and one workout", () => {
    const { body } = formatDigestMessage({ daysLogged: 1, workoutsCompleted: 1, avgKcal: 1900, avgProteinG: 120 });
    expect(body).toContain("1/7 day");
    expect(body).toContain("1 workout");
    expect(body).not.toContain("1 days");
    expect(body).not.toContain("1 workouts");
  });

  it("gives a distinct message for a fully quiet week", () => {
    const { body } = formatDigestMessage({ daysLogged: 0, workoutsCompleted: 0, avgKcal: 0, avgProteinG: 0 });
    expect(body).toContain("No logs this week");
  });
});

describe("isoWeekKey", () => {
  it("formats as YYYY-Www", () => {
    expect(isoWeekKey(new Date("2026-08-08T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("gives the same key for every day within one ISO week", () => {
    const monday = isoWeekKey(new Date("2026-08-03T00:00:00Z"));
    const sunday = isoWeekKey(new Date("2026-08-09T23:00:00Z"));
    expect(monday).toBe(sunday);
  });

  it("gives a different key across a week boundary", () => {
    const thisWeek = isoWeekKey(new Date("2026-08-09T23:00:00Z")); // Sunday
    const nextWeek = isoWeekKey(new Date("2026-08-10T01:00:00Z")); // Monday
    expect(thisWeek).not.toBe(nextWeek);
  });
});
