import { describe, it, expect } from "vitest";
import { subscribeSubtitle, quotaBannerText, trialCountdown } from "@/lib/coach/access-copy";

const base = { deniedReason: null, tier: "free", outOfPlans: false, outOfChat: false } as const;

// The regression this whole module exists for: "your trial has ended" was
// being shown to users whose trial had NOT ended.
describe("never claims the trial ended when it hasn't", () => {
  it("does not tell a brand-new user their trial is over", () => {
    const copy = subscribeSubtitle({ ...base, deniedReason: "not_started" });
    expect(copy).not.toMatch(/over|ended|expired/i);
    expect(copy).toMatch(/start/i);
  });

  it("does not tell a mid-trial user who spent their chat quota that the trial ended", () => {
    const copy = quotaBannerText({ ...base, outOfChat: true });
    expect(copy).not.toMatch(/over|ended|expired|trial has/i);
    // It should point at what still works.
    expect(copy).toMatch(/plan generations/i);
  });

  it("does not tell a mid-trial user who spent their plan quota that the trial ended", () => {
    const copy = quotaBannerText({ ...base, outOfPlans: true });
    expect(copy).not.toMatch(/over|ended|expired/i);
    expect(copy).toMatch(/coach messages/i);
  });

  it("only says the trial is over when it actually expired", () => {
    expect(subscribeSubtitle({ ...base, deniedReason: "trial_expired" })).toMatch(/14-day free trial is over/i);
  });
});

describe("subscribeSubtitle", () => {
  it("distinguishes a cancelled subscription from an expired trial", () => {
    const cancelled = subscribeSubtitle({ ...base, tier: "starter", deniedReason: "cancelled" });
    expect(cancelled).toMatch(/cancelled/i);
    expect(cancelled).not.toMatch(/trial/i);
  });

  it("names which allowance ran out", () => {
    expect(subscribeSubtitle({ ...base, outOfPlans: true })).toMatch(/plan generations/i);
    expect(subscribeSubtitle({ ...base, outOfChat: true })).toMatch(/coach messages/i);
  });

  it("does not call a paying user's allowance 'free'", () => {
    const copy = subscribeSubtitle({ ...base, tier: "starter", outOfChat: true });
    expect(copy).not.toMatch(/free/i);
    expect(copy).toMatch(/coach messages/i);
  });

  it("covers both allowances at once", () => {
    expect(subscribeSubtitle({ ...base, outOfPlans: true, outOfChat: true })).toMatch(/free allowance/i);
  });

  it("offers an upgrade, not a warning, to a user with quota left", () => {
    expect(subscribeSubtitle(base)).toMatch(/upgrade any time/i);
  });

  it("prioritises the denial reason over quota state", () => {
    // An expired trial that also has spent quota is still an expired trial.
    const copy = subscribeSubtitle({ ...base, deniedReason: "trial_expired", outOfPlans: true, outOfChat: true });
    expect(copy).toMatch(/trial is over/i);
  });
});

describe("quotaBannerText", () => {
  it("tells paid users to upgrade rather than subscribe", () => {
    const copy = quotaBannerText({ ...base, tier: "starter", outOfChat: true });
    expect(copy).toMatch(/upgrade/i);
    expect(copy).not.toMatch(/subscribe/i);
  });

  it("asks a fully-drained free user to subscribe", () => {
    const copy = quotaBannerText({ ...base, outOfPlans: true, outOfChat: true });
    expect(copy).toMatch(/subscribe to keep going/i);
  });

  it("does not claim a never-started user used anything up", () => {
    // EMPTY_QUOTA reports exhausted for these users; the banner must not
    // translate that into "you've used all your...".
    const copy = quotaBannerText({ ...base, deniedReason: "not_started", outOfPlans: true, outOfChat: true });
    expect(copy).not.toMatch(/used all/i);
    expect(copy).toMatch(/start your free trial/i);
  });

  it("states what was used up", () => {
    expect(quotaBannerText({ ...base, outOfPlans: true, outOfChat: true })).toMatch(
      /used all your plan generations and coach messages/i
    );
  });
});

describe("trialCountdown", () => {
  it("counts down whole days", () => {
    expect(trialCountdown("trialing", 14)).toBe("14 days left");
    expect(trialCountdown("trialing", 2)).toBe("2 days left");
  });

  it("uses the singular on the final full day", () => {
    expect(trialCountdown("trialing", 1)).toBe("1 day left");
  });

  it("says 'last day' rather than '0 days left'", () => {
    expect(trialCountdown("trialing", 0)).toBe("last day");
  });

  it("returns null for users who aren't on a running trial", () => {
    expect(trialCountdown("active", null)).toBeNull();
    expect(trialCountdown("expired", null)).toBeNull();
    expect(trialCountdown("trialing", null)).toBeNull();
  });
});
