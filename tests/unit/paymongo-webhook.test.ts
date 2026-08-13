import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifyWebhookSignature = vi.fn();
const getCheckoutSession = vi.fn();

vi.mock("@/lib/paymongo", () => ({
  verifyWebhookSignature: (...args: unknown[]) => verifyWebhookSignature(...args),
  getCheckoutSession: (...args: unknown[]) => getCheckoutSession(...args),
}));

// Race-registration path uses the cookie-based client; unused by the coach
// subscription tests but the module must still resolve.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const coachSubscriptionUpdate = vi.fn();
const coachSubscriptionEq = vi.fn();
const coachSubscriptionOr = vi.fn();
const coachSubscriptionSelect = vi.fn();
const adminFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: adminFrom })),
}));

function jsonRequest(body: unknown, signature = "t=1,te=sig") {
  return new NextRequest("http://localhost/api/webhook/paymongo", {
    method: "POST",
    headers: { "paymongo-signature": signature },
    body: JSON.stringify(body),
  });
}

const paidEvent = {
  data: {
    attributes: {
      type: "checkout_session.payment.paid",
      data: { id: "cs_test_123" },
    },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  coachSubscriptionSelect.mockResolvedValue({ data: [{ user_id: "user-1" }], error: null });
  coachSubscriptionOr.mockReturnValue({ select: coachSubscriptionSelect });
  coachSubscriptionEq.mockReturnValue({ or: coachSubscriptionOr });
  coachSubscriptionUpdate.mockReturnValue({ eq: coachSubscriptionEq });
  adminFrom.mockReturnValue({ update: coachSubscriptionUpdate });

  verifyWebhookSignature.mockResolvedValue(true);
});

describe("POST /api/webhook/paymongo — coach subscription", () => {
  it("activates the purchased tier via the service-role client", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { kind: "coach_subscription", user_id: "user-1", tier: "pro" },
      },
    });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(200);
    expect(adminFrom).toHaveBeenCalledWith("coach_subscriptions");
    expect(coachSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        tier: "pro",
        paymongo_session_id: "cs_test_123",
      }),
    );
    expect(coachSubscriptionEq).toHaveBeenCalledWith("user_id", "user-1");

    const [[payload]] = coachSubscriptionUpdate.mock.calls;
    expect(new Date(payload.current_period_end).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a session with an invalid tier instead of granting access", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { kind: "coach_subscription", user_id: "user-1", tier: "free" },
      },
    });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(400);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("rejects a session missing user_id instead of granting access", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { kind: "coach_subscription", tier: "starter" },
      },
    });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(400);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("does not grant access when payment has not succeeded", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "processing" } },
        metadata: { kind: "coach_subscription", user_id: "user-1", tier: "pro" },
      },
    });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(200);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("is a no-op when this session was already applied (idempotent retry)", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { kind: "coach_subscription", user_id: "user-1", tier: "pro" },
      },
    });
    // The .or() filter excludes the row when paymongo_session_id already
    // matches this session — simulated here as zero rows updated.
    coachSubscriptionSelect.mockResolvedValue({ data: [], error: null });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("returns 500 so PayMongo retries when the DB update fails", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { kind: "coach_subscription", user_id: "user-1", tier: "starter" },
      },
    });
    coachSubscriptionSelect.mockResolvedValue({ data: null, error: { message: "db down" } });

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(500);
  });

  it("rejects the whole request when the signature is invalid", async () => {
    verifyWebhookSignature.mockResolvedValue(false);

    const { POST } = await import("@/app/api/webhook/paymongo/route");
    const res = await POST(jsonRequest(paidEvent));

    expect(res.status).toBe(401);
    expect(getCheckoutSession).not.toHaveBeenCalled();
  });
});
