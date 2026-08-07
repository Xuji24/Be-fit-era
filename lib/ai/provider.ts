/**
 * AI provider abstraction — works with any OpenAI-compatible chat endpoint.
 * Groq:    AI_PROVIDER=groq    GROQ_API_KEY=gsk_...
 * Gemini:  AI_PROVIDER=gemini  GEMINI_API_KEY=...
 * OpenAI:  AI_PROVIDER=openai  OPENAI_API_KEY=sk-...
 *
 * Swap the env vars — no code changes required.
 *
 * ONE provider is active per request, with an optional fallback used only when
 * the primary fails. Plans and chat replies must stay consistent in tone and
 * logic across a multi-week programme, and rotating models mid-conversation
 * is what breaks that.
 */

import { parsePlan, type GeneratedPlan, type PlanParseResult } from "./plan-schema";

export type ProviderName = "groq" | "gemini" | "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
  apiKeyEnv: string;
}

// All three expose an OpenAI-compatible /chat/completions surface, so one
// request shape covers them.
const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    apiKeyEnv: "OPENAI_API_KEY",
  },
};

const REQUEST_TIMEOUT_MS = 60_000;

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

function activeProvider(): ProviderName {
  const configured = process.env.AI_PROVIDER?.toLowerCase();
  if (configured && configured in PROVIDERS) return configured as ProviderName;
  return "groq";
}

function fallbackProvider(): ProviderName | null {
  const configured = process.env.AI_PROVIDER_FALLBACK?.toLowerCase();
  if (configured && configured in PROVIDERS && configured !== activeProvider()) {
    return configured as ProviderName;
  }
  return null;
}

/** Identifier stored in coach_plans.generated_by, e.g. "groq:llama-3.3-70b-versatile". */
export function providerTag(provider: ProviderName = activeProvider(), modelOverride?: string | null): string {
  return `${provider}:${modelFor(provider, modelOverride)}`;
}

/**
 * Resolves the model for a call. An explicit `modelOverride` (used to route
 * Pro plan generation to the frontier model) wins over the global AI_MODEL
 * env var, which in turn wins over the provider default.
 */
function modelFor(provider: ProviderName, modelOverride?: string | null): string {
  return modelOverride?.trim() || process.env.AI_MODEL?.trim() || PROVIDERS[provider].defaultModel;
}

async function callProvider(
  provider: ProviderName,
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean; model?: string | null } = {}
): Promise<string> {
  const config = PROVIDERS[provider];
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new AiProviderError(`${config.apiKeyEnv} is not set`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelFor(provider, opts.model),
        messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 429 and 5xx are worth a fallback attempt; 4xx means our request is wrong.
      const retryable = res.status === 429 || res.status >= 500;
      throw new AiProviderError(
        `${provider} returned ${res.status}: ${body.slice(0, 300)}`,
        res.status,
        retryable
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AiProviderError(`${provider} returned an empty completion`, undefined, true);
    }
    return content;
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiProviderError(`${provider} timed out after ${REQUEST_TIMEOUT_MS}ms`, undefined, true);
    }
    throw new AiProviderError(`${provider} request failed: ${e instanceof Error ? e.message : "unknown"}`, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends a conversation and returns the raw reply. Falls back to the secondary
 * provider only on retryable failures (rate limit, timeout, 5xx) — free tiers
 * rate-limit aggressively, which is exactly what the fallback exists for.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean; model?: string | null } = {}
): Promise<{ content: string; provider: ProviderName }> {
  const primary = activeProvider();

  try {
    return { content: await callProvider(primary, messages, opts), provider: primary };
  } catch (e) {
    const fallback = fallbackProvider();
    const retryable = e instanceof AiProviderError && e.retryable;
    if (!fallback || !retryable) throw e;

    // A tier-specific model name (e.g. Pro's frontier model) belongs to the
    // primary provider and almost certainly doesn't exist on the fallback, so
    // the override is dropped here and the fallback's own default is used.
    // A degraded plan beats a hard failure; the caller records which model
    // actually served the request via providerTag().
    const content = await callProvider(fallback, messages, { ...opts, model: null });
    return { content, provider: fallback };
  }
}

/**
 * Requests a plan and validates it. Retries once on a validation failure,
 * feeding the error back so the model can correct itself — cheaper and more
 * reliable than surfacing a broken plan to the user.
 */
export async function generatePlan(
  messages: ChatMessage[],
  opts: { model?: string | null } = {}
): Promise<{ plan: GeneratedPlan; generatedBy: string }> {
  const attempt = async (extra: ChatMessage[] = []): Promise<{ result: PlanParseResult; provider: ProviderName }> => {
    const { content, provider } = await chat([...messages, ...extra], {
      temperature: 0.4,
      jsonMode: true,
      model: opts.model,
    });
    return { result: parsePlan(content), provider };
  };

  // If the fallback served the request, the override didn't apply — tag with
  // the override only when the primary answered, so generated_by stays honest
  // about which model actually built the plan.
  const tagFor = (provider: ProviderName) =>
    providerTag(provider, provider === activeProvider() ? opts.model : null);

  const first = await attempt();
  if (first.result.ok) {
    return { plan: first.result.plan, generatedBy: tagFor(first.provider) };
  }

  const retry = await attempt([
    {
      role: "user",
      content: `Your previous response was rejected: ${first.result.error}. Reply with corrected JSON only — no prose, no markdown fences.`,
    },
  ]);
  if (retry.result.ok) {
    return { plan: retry.result.plan, generatedBy: tagFor(retry.provider) };
  }

  throw new AiProviderError(`plan generation failed validation twice — ${retry.result.error}`);
}
