import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeQuota, exhaustedMessage } from "@/lib/coach/quota";
import { TIERS } from "@/lib/coach/tiers";

/** Minimal stub of the one call consumeQuota makes. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("consumeQuota", () => {
  it("grants and reports usage when the meter allows it", async () => {
    const { client } = clientReturning({ data: [{ granted: true, used: 1 }], error: null });

    const { granted, state } = await consumeQuota(client, "free", "chat");

    expect(granted).toBe(true);
    expect(state.used).toBe(1);
    expect(state.limit).toBe(TIERS.free.limits.chat);
    expect(state.remaining).toBe(TIERS.free.limits.chat - 1);
    expect(state.exhausted).toBe(false);
  });

  it("refuses when the allowance is spent", async () => {
    const limit = TIERS.free.limits.chat;
    const { client } = clientReturning({ data: [{ granted: false, used: limit }], error: null });

    const { granted, state } = await consumeQuota(client, "free", "chat");

    expect(granted).toBe(false);
    expect(state.exhausted).toBe(true);
    expect(state.remaining).toBe(0);
  });

  it("fails closed when the meter errors, so an outage cannot hand out free AI calls", async () => {
    const { client } = clientReturning({ data: null, error: { message: "connection lost" } });

    const { granted, state } = await consumeQuota(client, "pro", "plan");

    expect(granted).toBe(false);
    expect(state.exhausted).toBe(true);
    expect(state.remaining).toBe(0);
  });

  it("passes the tier's own limit and period bucket to the SQL function", async () => {
    const { client, rpc } = clientReturning({ data: [{ granted: true, used: 1 }], error: null });

    await consumeQuota(client, "starter", "plan");

    expect(rpc).toHaveBeenCalledWith("consume_coach_quota", {
      p_kind: "plan",
      // Starter plans reset monthly -> YYYY-MM bucket.
      p_period_key: expect.stringMatching(/^\d{4}-\d{2}$/),
      p_limit: TIERS.starter.limits.plans,
    });
  });

  it("uses the trial bucket for free-tier users", async () => {
    const { client, rpc } = clientReturning({ data: [{ granted: true, used: 1 }], error: null });

    await consumeQuota(client, "free", "plan");

    expect(rpc).toHaveBeenCalledWith(
      "consume_coach_quota",
      expect.objectContaining({ p_period_key: "trial", p_limit: TIERS.free.limits.plans })
    );
  });

  it("handles a non-array rpc payload", async () => {
    const { client } = clientReturning({ data: { granted: true, used: 2 }, error: null });

    const { granted, state } = await consumeQuota(client, "starter", "chat");

    expect(granted).toBe(true);
    expect(state.used).toBe(2);
  });

  it("treats a malformed payload as not granted", async () => {
    const { client } = clientReturning({ data: [], error: null });

    const { granted } = await consumeQuota(client, "pro", "chat");

    expect(granted).toBe(false);
  });
});

describe("exhaustedMessage", () => {
  it("tells free users to subscribe", () => {
    expect(exhaustedMessage("free", "chat")).toMatch(/subscribe/i);
    expect(exhaustedMessage("free", "plan")).toMatch(/subscribe/i);
  });

  it("tells starter users they can upgrade", () => {
    expect(exhaustedMessage("starter", "chat")).toMatch(/upgrade to pro/i);
  });

  it("tells pro users their allowance resets rather than offering an upsell", () => {
    const message = exhaustedMessage("pro", "chat");
    expect(message).toMatch(/resets/i);
    expect(message).not.toMatch(/upgrade/i);
  });

  it("names the window the quota resets on", () => {
    expect(exhaustedMessage("starter", "chat")).toMatch(/today/);
    expect(exhaustedMessage("starter", "plan")).toMatch(/this month/);
  });
});
