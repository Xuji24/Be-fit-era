import { describe, it, expect } from "vitest";
import {
  TIERS,
  TIER_ORDER,
  PAID_TIERS,
  isPaidTier,
  tierOf,
  limitFor,
  periodFor,
  periodKey,
  type CoachTier,
} from "@/lib/coach/tiers";

describe("tier definitions", () => {
  it("defines every tier in TIER_ORDER", () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id]).toBeDefined();
      expect(TIERS[id].id).toBe(id);
    }
  });

  it("gives every tier a complete set of limits", () => {
    for (const id of TIER_ORDER) {
      const { limits } = TIERS[id];
      expect(limits.plans).toBeGreaterThan(0);
      expect(limits.chat).toBeGreaterThan(0);
      expect(limits.planPeriod).toBeTruthy();
      expect(limits.chatPeriod).toBeTruthy();
    }
  });

  it("prices tiers in ascending order", () => {
    const prices = TIER_ORDER.map((id) => TIERS[id].pricePhp);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(TIERS.free.pricePhp).toBe(0);
  });

  it("gives each paid tier at least as much as the one below it", () => {
    expect(TIERS.starter.limits.plans).toBeGreaterThan(TIERS.free.limits.plans);
    expect(TIERS.pro.limits.plans).toBeGreaterThan(TIERS.starter.limits.plans);
    expect(TIERS.pro.limits.chat).toBeGreaterThan(TIERS.starter.limits.chat);
  });

  it("upgrades the plan model on pro only", () => {
    expect(TIERS.free.planModel).toBeNull();
    expect(TIERS.starter.planModel).toBeNull();
    expect(TIERS.pro.planModel).toBeTruthy();
  });

  it("only offers the free tier a one-time trial allowance", () => {
    expect(TIERS.free.limits.planPeriod).toBe("trial");
    expect(TIERS.free.limits.chatPeriod).toBe("trial");
    for (const id of PAID_TIERS) {
      expect(TIERS[id as CoachTier].limits.planPeriod).not.toBe("trial");
      expect(TIERS[id as CoachTier].limits.chatPeriod).not.toBe("trial");
    }
  });
});

describe("isPaidTier", () => {
  it("accepts starter and pro only", () => {
    expect(isPaidTier("starter")).toBe(true);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    // Guards checkout against a tampered tier id.
    expect(isPaidTier("enterprise")).toBe(false);
    expect(isPaidTier("")).toBe(false);
  });
});

describe("tierOf", () => {
  it("resolves known tiers", () => {
    expect(tierOf("pro").id).toBe("pro");
  });

  it("falls back to free rather than throwing on unknown input", () => {
    expect(tierOf(null).id).toBe("free");
    expect(tierOf(undefined).id).toBe("free");
    expect(tierOf("nonsense").id).toBe("free");
  });
});

describe("limitFor / periodFor", () => {
  it("meters plans and chat separately", () => {
    expect(limitFor("pro", "plan")).toBe(TIERS.pro.limits.plans);
    expect(limitFor("pro", "chat")).toBe(TIERS.pro.limits.chat);
    expect(limitFor("pro", "plan")).not.toBe(limitFor("pro", "chat"));
  });

  it("reports the period each quota resets on", () => {
    expect(periodFor("starter", "plan")).toBe("month");
    expect(periodFor("starter", "chat")).toBe("day");
    expect(periodFor("free", "plan")).toBe("trial");
  });
});

describe("periodKey", () => {
  const t = new Date("2026-08-06T14:30:00Z");

  it("gives the trial one lifetime bucket", () => {
    expect(periodKey("trial", t)).toBe("trial");
    expect(periodKey("trial", new Date("2027-01-01T00:00:00Z"))).toBe("trial");
  });

  it("buckets monthly quotas by year-month", () => {
    expect(periodKey("month", t)).toBe("2026-08");
  });

  it("buckets daily quotas by date", () => {
    expect(periodKey("day", t)).toBe("2026-08-06");
  });

  it("rolls the daily bucket at UTC midnight", () => {
    expect(periodKey("day", new Date("2026-08-06T23:59:59Z"))).toBe("2026-08-06");
    expect(periodKey("day", new Date("2026-08-07T00:00:00Z"))).toBe("2026-08-07");
  });

  it("rolls the monthly bucket at the turn of the month", () => {
    expect(periodKey("month", new Date("2026-08-31T23:59:59Z"))).toBe("2026-08");
    expect(periodKey("month", new Date("2026-09-01T00:00:00Z"))).toBe("2026-09");
  });

  it("zero-pads single-digit months and days", () => {
    expect(periodKey("day", new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
    expect(periodKey("month", new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
  });
});
