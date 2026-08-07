import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chat, generatePlan, providerTag, AiProviderError } from "@/lib/ai/provider";

// Provider calls are plain fetch against an OpenAI-compatible endpoint, so
// stubbing fetch exercises the real request/fallback logic without network or keys.
function mockCompletion(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}
function mockError(status: number, body = "error") {
  return { ok: false, status, text: async () => body, json: async () => ({}) };
}

const VALID_PLAN = JSON.stringify({
  summary: "1-week plan",
  weeks: 1,
  items: [{ itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 }],
});

const ENV_KEYS = ["AI_PROVIDER", "AI_PROVIDER_FALLBACK", "AI_MODEL", "GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  ENV_KEYS.forEach((k) => (savedEnv[k] = process.env[k]));
  ENV_KEYS.forEach((k) => delete process.env[k]);
  process.env.GROQ_API_KEY = "test-key";
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
  vi.restoreAllMocks();
});

describe("providerTag", () => {
  it("defaults to groq with its default model", () => {
    expect(providerTag()).toBe("groq:llama-3.3-70b-versatile");
  });

  it("follows AI_PROVIDER", () => {
    process.env.AI_PROVIDER = "openai";
    expect(providerTag()).toBe("openai:gpt-4o-mini");
  });

  it("honours an AI_MODEL override", () => {
    process.env.AI_MODEL = "llama-3.1-8b-instant";
    expect(providerTag()).toBe("groq:llama-3.1-8b-instant");
  });

  it("ignores an unknown provider and falls back to groq", () => {
    process.env.AI_PROVIDER = "not-a-provider";
    expect(providerTag()).toBe("groq:llama-3.3-70b-versatile");
  });

  it("lets a per-tier model override win over AI_MODEL", () => {
    process.env.AI_MODEL = "llama-3.1-8b-instant";
    expect(providerTag("groq", "gemini-2.5-pro")).toBe("groq:gemini-2.5-pro");
  });
});

// Pro routes plan generation to a frontier model while every other tier and
// all chat traffic stays on the cheap default. Sending the wrong model is a
// direct cost error, so the routing is asserted on the wire.
describe("per-tier model routing", () => {
  function modelSentOn(call: number, fetchMock: ReturnType<typeof vi.fn>): string {
    return JSON.parse(fetchMock.mock.calls[call][1].body).model;
  }

  it("uses the provider default when no override is given", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion("hi"));
    vi.stubGlobal("fetch", f);

    await chat([{ role: "user", content: "hi" }]);

    expect(modelSentOn(0, f)).toBe("llama-3.3-70b-versatile");
  });

  it("sends the override model when one is given", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion("hi"));
    vi.stubGlobal("fetch", f);

    await chat([{ role: "user", content: "hi" }], { model: "gemini-2.5-pro" });

    expect(modelSentOn(0, f)).toBe("gemini-2.5-pro");
  });

  it("routes generatePlan through the override", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion(VALID_PLAN));
    vi.stubGlobal("fetch", f);

    const { generatedBy } = await generatePlan([{ role: "user", content: "plan" }], { model: "gemini-2.5-pro" });

    expect(modelSentOn(0, f)).toBe("gemini-2.5-pro");
    expect(generatedBy).toBe("groq:gemini-2.5-pro");
  });

  it("drops the override on fallback — the model belongs to the primary provider", async () => {
    process.env.AI_PROVIDER = "groq";
    process.env.AI_PROVIDER_FALLBACK = "openai";
    process.env.OPENAI_API_KEY = "test-key";

    const f = vi
      .fn()
      .mockResolvedValueOnce(mockError(429))
      .mockResolvedValueOnce(mockCompletion("hi"));
    vi.stubGlobal("fetch", f);

    const { provider } = await chat([{ role: "user", content: "hi" }], { model: "gemini-2.5-pro" });

    expect(provider).toBe("openai");
    // The fallback must use its OWN default, not a model it doesn't serve.
    expect(modelSentOn(1, f)).toBe("gpt-4o-mini");
  });

  it("tags a fallback-served plan with the model that actually ran", async () => {
    process.env.AI_PROVIDER = "groq";
    process.env.AI_PROVIDER_FALLBACK = "openai";
    process.env.OPENAI_API_KEY = "test-key";

    const f = vi
      .fn()
      .mockResolvedValueOnce(mockError(500))
      .mockResolvedValueOnce(mockCompletion(VALID_PLAN));
    vi.stubGlobal("fetch", f);

    const { generatedBy } = await generatePlan([{ role: "user", content: "plan" }], { model: "gemini-2.5-pro" });

    // Not "openai:gemini-2.5-pro" — generated_by must not claim a model that
    // never produced the plan.
    expect(generatedBy).toBe("openai:gpt-4o-mini");
  });
});

describe("chat", () => {
  it("returns the completion content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockCompletion("hello")));
    const res = await chat([{ role: "user", content: "hi" }]);
    expect(res.content).toBe("hello");
    expect(res.provider).toBe("groq");
  });

  it("sends the key as a bearer token to the right endpoint", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion("ok"));
    vi.stubGlobal("fetch", f);
    await chat([{ role: "user", content: "hi" }]);

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("throws when the API key is missing", async () => {
    delete process.env.GROQ_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow("GROQ_API_KEY is not set");
  });

  it("passes jsonMode through as response_format", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion("{}"));
    vi.stubGlobal("fetch", f);
    await chat([{ role: "user", content: "hi" }], { jsonMode: true });
    expect(JSON.parse(f.mock.calls[0][1].body).response_format).toEqual({ type: "json_object" });
  });

  it("rejects an empty completion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockCompletion("   ")));
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow("empty completion");
  });
});

// Free tiers rate-limit aggressively — this is the path that keeps the feature
// working when the primary provider says no.
describe("chat fallback", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "groq";
    process.env.AI_PROVIDER_FALLBACK = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
  });

  it("falls back on 429 rate limit", async () => {
    const f = vi.fn().mockResolvedValueOnce(mockError(429, "rate limited")).mockResolvedValueOnce(mockCompletion("from gemini"));
    vi.stubGlobal("fetch", f);

    const res = await chat([{ role: "user", content: "hi" }]);
    expect(res.content).toBe("from gemini");
    expect(res.provider).toBe("gemini");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("falls back on a 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockError(503)).mockResolvedValueOnce(mockCompletion("ok")));
    expect((await chat([{ role: "user", content: "hi" }])).provider).toBe("gemini");
  });

  it("does NOT fall back on a 400 — our request is wrong, retrying wastes quota", async () => {
    const f = vi.fn().mockResolvedValue(mockError(400, "bad request"));
    vi.stubGlobal("fetch", f);

    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(AiProviderError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when none is configured", async () => {
    delete process.env.AI_PROVIDER_FALLBACK;
    const f = vi.fn().mockResolvedValue(mockError(429));
    vi.stubGlobal("fetch", f);

    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("surfaces the fallback's own failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockError(429)).mockResolvedValueOnce(mockError(500)));
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow("gemini returned 500");
  });
});

describe("generatePlan", () => {
  it("returns a validated plan and its provider tag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockCompletion(VALID_PLAN)));
    const { plan, generatedBy } = await generatePlan([{ role: "user", content: "make a plan" }]);
    expect(plan.items).toHaveLength(1);
    expect(generatedBy).toBe("groq:llama-3.3-70b-versatile");
  });

  it("retries once when the first response fails validation", async () => {
    const f = vi.fn().mockResolvedValueOnce(mockCompletion("sorry, I can't")).mockResolvedValueOnce(mockCompletion(VALID_PLAN));
    vi.stubGlobal("fetch", f);

    const { plan } = await generatePlan([{ role: "user", content: "make a plan" }]);
    expect(plan.weeks).toBe(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("feeds the validation error back into the retry so the model can correct itself", async () => {
    const f = vi.fn().mockResolvedValueOnce(mockCompletion("no json here")).mockResolvedValueOnce(mockCompletion(VALID_PLAN));
    vi.stubGlobal("fetch", f);
    await generatePlan([{ role: "user", content: "make a plan" }]);

    const retryMessages = JSON.parse(f.mock.calls[1][1].body).messages;
    expect(retryMessages.at(-1).content).toContain("no JSON object found");
  });

  it("throws rather than persisting a plan that fails twice", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion("still not json"));
    vi.stubGlobal("fetch", f);

    await expect(generatePlan([{ role: "user", content: "make a plan" }])).rejects.toThrow("failed validation twice");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("never returns an unsafe plan even after a retry", async () => {
    const unsafe = JSON.stringify({
      summary: "bad", weeks: 1,
      items: [{ itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 99999, proteinG: 12, carbsG: 55, fatG: 6 }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockCompletion(unsafe)));
    await expect(generatePlan([{ role: "user", content: "plan" }])).rejects.toThrow("failed validation twice");
  });

  it("requests JSON mode at a low temperature for determinism", async () => {
    const f = vi.fn().mockResolvedValue(mockCompletion(VALID_PLAN));
    vi.stubGlobal("fetch", f);
    await generatePlan([{ role: "user", content: "plan" }]);

    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.temperature).toBe(0.4);
  });
});
