import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embed } from "@/lib/ai/embeddings";
import { AiProviderError } from "@/lib/ai/provider";

function mockEmbedding(vector: number[]) {
  return { ok: true, status: 200, json: async () => ({ data: [{ embedding: vector }] }) };
}
function mockError(status: number, body = "error") {
  return { ok: false, status, text: async () => body, json: async () => ({}) };
}

const savedKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
  vi.restoreAllMocks();
});

describe("embed", () => {
  it("returns the embedding vector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockEmbedding([0.1, 0.2, 0.3])));
    const vector = await embed("how do I avoid overtraining?");
    expect(vector).toEqual([0.1, 0.2, 0.3]);
  });

  it("sends the key as a bearer token to the embeddings endpoint", async () => {
    const f = vi.fn().mockResolvedValue(mockEmbedding([0.1]));
    vi.stubGlobal("fetch", f);
    await embed("query");

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/embeddings");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body).model).toBe("gemini-embedding-001");
    expect(JSON.parse(init.body).dimensions).toBe(768);
  });

  it("throws when the API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
    await expect(embed("query")).rejects.toThrow("GEMINI_API_KEY is not set");
  });

  it("throws AiProviderError on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockError(500, "server error")));
    await expect(embed("query")).rejects.toThrow(AiProviderError);
  });

  it("throws on an empty vector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockEmbedding([])));
    await expect(embed("query")).rejects.toThrow("empty vector");
  });

  it("marks a rate-limit response as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockError(429)));
    try {
      await embed("query");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiProviderError);
      expect((e as AiProviderError).retryable).toBe(true);
    }
  });
});
