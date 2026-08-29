import { describe, it, expect, vi, beforeEach } from "vitest";

const getCheckoutSession = vi.fn();
vi.mock("@/lib/paymongo", () => ({
  getCheckoutSession: (...args: unknown[]) => getCheckoutSession(...args),
}));

const adminFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: adminFrom })),
}));

type QueryResult = { data: unknown; error: unknown };

// A minimal fluent query-builder stand-in: every chained method returns the
// same object, and awaiting it resolves to the queued result — enough to
// cover the cron's mix of select/update/eq/neq/lt/not/or shapes without
// hand-wiring a distinct mock per call shape.
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.neq = chain;
  builder.lt = chain;
  builder.not = chain;
  builder.update = chain;
  builder.or = chain;
  builder.then = (resolve: (v: QueryResult) => void) => resolve(result);
  return builder;
}

let responseQueues: Record<string, QueryResult[]>;

// Queues one response per call to .from(table) — consumed in call order, so
// queue the initial select before any update triggered by that row.
function queueResponse(table: string, result: QueryResult) {
  responseQueues[table] = responseQueues[table] ?? [];
  responseQueues[table].push(result);
}

function makeRequest(authorized = true) {
  return new Request("http://localhost/api/cron/expire-stale-payments", {
    headers: authorized ? { authorization: "Bearer test-secret" } : {},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.CRON_SECRET = "test-secret";

  responseQueues = {};
  adminFrom.mockImplementation((table: string) => {
    const queue = responseQueues[table] ?? [];
    const result = queue.shift() ?? { data: [], error: null };
    return makeBuilder(result);
  });
});

describe("GET /api/cron/expire-stale-payments", () => {
  it("rejects requests without a valid CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest(false));

    expect(res.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("cancels a stale pending registration that never reached checkout", async () => {
    queueResponse("race_registrations", {
      data: [{ id: "reg-1", user_id: "user-1", race_id: "race-1", paymongo_session_id: null }],
      error: null,
    });
    queueResponse("race_registrations", { data: null, error: null }); // the cancel update
    queueResponse("coach_subscriptions", { data: [], error: null });

    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.raceRegistrations).toEqual({ checked: 1, selfHealed: 0, expired: 1 });
    expect(getCheckoutSession).not.toHaveBeenCalled();
  });

  it("cancels a stale registration whose PayMongo session has expired", async () => {
    queueResponse("race_registrations", {
      data: [{ id: "reg-2", user_id: "user-2", race_id: "race-2", paymongo_session_id: "cs_2" }],
      error: null,
    });
    getCheckoutSession.mockResolvedValueOnce({
      attributes: {
        status: "expired",
        payment_intent: { attributes: { status: "awaiting_payment_method" } },
      },
    });
    queueResponse("race_registrations", { data: null, error: null }); // the cancel update
    queueResponse("coach_subscriptions", { data: [], error: null });

    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.raceRegistrations).toEqual({ checked: 1, selfHealed: 0, expired: 1 });
  });

  it("self-heals a registration PayMongo confirms as paid (missed webhook)", async () => {
    queueResponse("race_registrations", {
      data: [{ id: "reg-3", user_id: "user-3", race_id: "race-3", paymongo_session_id: "cs_3" }],
      error: null,
    });
    getCheckoutSession.mockResolvedValueOnce({
      attributes: {
        status: "active",
        payment_intent: { attributes: { status: "succeeded" } },
      },
    });
    queueResponse("race_registrations", { data: [{ id: "reg-3" }], error: null }); // fulfill update
    queueResponse("coach_subscriptions", { data: [], error: null });

    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.raceRegistrations).toEqual({ checked: 1, selfHealed: 1, expired: 0 });
  });

  it("leaves a registration alone while its PayMongo session is still processing", async () => {
    queueResponse("race_registrations", {
      data: [{ id: "reg-4", user_id: "user-4", race_id: "race-4", paymongo_session_id: "cs_4" }],
      error: null,
    });
    getCheckoutSession.mockResolvedValueOnce({
      attributes: {
        status: "active",
        payment_intent: { attributes: { status: "processing" } },
      },
    });
    queueResponse("coach_subscriptions", { data: [], error: null });

    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.raceRegistrations).toEqual({ checked: 1, selfHealed: 0, expired: 0 });
  });

  it("self-heals a coach subscription PayMongo confirms as paid, without cancelling anything", async () => {
    queueResponse("race_registrations", { data: [], error: null });
    queueResponse("coach_subscriptions", {
      data: [{ user_id: "user-5", paymongo_session_id: "cs_5", status: "expired" }],
      error: null,
    });
    getCheckoutSession.mockResolvedValueOnce({
      attributes: {
        payment_intent: { attributes: { status: "succeeded" } },
        metadata: { tier: "pro" },
      },
    });
    queueResponse("coach_subscriptions", { data: [{ user_id: "user-5" }], error: null }); // fulfill update

    const { GET } = await import("@/app/api/cron/expire-stale-payments/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coachSubscriptions).toEqual({ checked: 1, selfHealed: 1, expired: 0 });
  });
});
