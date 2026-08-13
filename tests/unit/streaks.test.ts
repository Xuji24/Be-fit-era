import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toDateKey, computeLoggingStreak, daysSinceLastLog, getEngagementDates } from "@/lib/coach/streaks";

const TODAY = new Date("2026-08-08T12:00:00Z"); // Saturday

describe("toDateKey", () => {
  it("formats a UTC calendar day", () => {
    expect(toDateKey(new Date("2026-08-08T23:59:00Z"))).toBe("2026-08-08");
  });

  it("does not roll over from a late-UTC timestamp", () => {
    expect(toDateKey(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});

describe("computeLoggingStreak", () => {
  it("counts consecutive days ending today", () => {
    const dates = ["2026-08-08", "2026-08-07", "2026-08-06"];
    expect(computeLoggingStreak(dates, TODAY)).toBe(3);
  });

  it("gives a grace day when today has no log yet but yesterday does", () => {
    const dates = ["2026-08-07", "2026-08-06"];
    expect(computeLoggingStreak(dates, TODAY)).toBe(2);
  });

  it("stops at a gap", () => {
    const dates = ["2026-08-08", "2026-08-07", "2026-08-05"]; // missing 08-06
    expect(computeLoggingStreak(dates, TODAY)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday is logged", () => {
    const dates = ["2026-08-01"];
    expect(computeLoggingStreak(dates, TODAY)).toBe(0);
  });

  it("returns 0 for an empty history", () => {
    expect(computeLoggingStreak([], TODAY)).toBe(0);
  });

  it("ignores duplicate dates", () => {
    const dates = ["2026-08-08", "2026-08-08", "2026-08-07"];
    expect(computeLoggingStreak(dates, TODAY)).toBe(2);
  });
});

describe("daysSinceLastLog", () => {
  it("returns 0 when the last log was today", () => {
    expect(daysSinceLastLog(["2026-08-08"], TODAY)).toBe(0);
  });

  it("returns the gap in whole days", () => {
    expect(daysSinceLastLog(["2026-08-05"], TODAY)).toBe(3);
  });

  it("uses the most recent date when several are given", () => {
    expect(daysSinceLastLog(["2026-08-01", "2026-08-06", "2026-08-03"], TODAY)).toBe(2);
  });

  it("returns null for an empty history", () => {
    expect(daysSinceLastLog([], TODAY)).toBeNull();
  });
});

/** Minimal chain stub: .from(table).select(cols).eq(col, val).gte(col, val) -> Promise. */
function stubEngagementClient(foodDates: string[], workoutDates: string[]): SupabaseClient {
  const from = (table: string) => ({
    select: () => ({
      eq: () => ({
        gte: () =>
          Promise.resolve({
            data:
              table === "coach_food_logs"
                ? foodDates.map((d) => ({ logged_on: d }))
                : workoutDates.map((d) => ({ completed_on: d })),
            error: null,
          }),
      }),
    }),
  });
  return { from } as unknown as SupabaseClient;
}

describe("getEngagementDates", () => {
  it("merges distinct food-log and workout-log dates", async () => {
    const client = stubEngagementClient(["2026-08-08", "2026-08-07"], ["2026-08-07", "2026-08-06"]);

    const dates = await getEngagementDates(client, "user-1");

    expect(new Set(dates)).toEqual(new Set(["2026-08-08", "2026-08-07", "2026-08-06"]));
  });
});
