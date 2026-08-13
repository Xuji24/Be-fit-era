/**
 * Text embeddings for coach knowledge-base retrieval (lib/coach/knowledge.ts).
 *
 * Deliberately a single provider, not a fallback chain like lib/ai/provider.ts's
 * chat models: Gemini's gemini-embedding-001 is the only embedding model this
 * app has a free-tier key for. When it's unavailable, callers fall back to a
 * zero-dependency lexical search instead of a second embedding vendor — see
 * lib/coach/knowledge.ts for why.
 *
 * gemini-embedding-001 defaults to 3072 dimensions — `dimensions: 768` below
 * requests Matryoshka-truncated output to match coach_knowledge_articles'
 * `vector(768)` column. (text-embedding-004, which natively returns 768,
 * has been retired on this API key — ListModels no longer offers it.)
 */

import { AiProviderError } from "./provider";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Embeds a single string. Throws AiProviderError on any failure (missing key,
 * network error, timeout, malformed response) — this function does not
 * silently degrade; the caller (lib/coach/knowledge.ts) decides what to do
 * when embedding isn't available.
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiProviderError("GEMINI_API_KEY is not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSIONS }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      throw new AiProviderError(`embeddings returned ${res.status}: ${body.slice(0, 300)}`, res.status, retryable);
    }

    const data = await res.json();
    const vector = data?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new AiProviderError("embeddings returned an empty vector", undefined, true);
    }
    return vector as number[];
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiProviderError(`embeddings timed out after ${REQUEST_TIMEOUT_MS}ms`, undefined, true);
    }
    throw new AiProviderError(`embeddings request failed: ${e instanceof Error ? e.message : "unknown"}`, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}
