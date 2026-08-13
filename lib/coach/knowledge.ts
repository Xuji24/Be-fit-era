/**
 * Retrieval for the coach chat's knowledge base (coach_knowledge_articles).
 *
 * Two scoring paths, both pure functions over an already-fetched article
 * list so they're testable without a Supabase client or network call:
 *  - scoreByEmbedding: cosine similarity against a precomputed query vector.
 *  - scoreByKeywords: keyword-overlap fallback, used when embeddings are
 *    unavailable (no GEMINI_API_KEY, network error, timeout). This keeps
 *    retrieval working even if the embedding provider is down — see
 *    lib/ai/embeddings.ts for why there's no second embedding vendor.
 *
 * The corpus is ~20 rows, so fetching everything and scoring in-process is
 * simpler than a database-side ANN index at this scale (see the knowledge
 * base migration's comment).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "@/lib/ai/embeddings";

export interface KnowledgeArticleRow {
  slug: string;
  title: string;
  category: string;
  content: string;
  embedding: string | number[] | null;
}

export interface ScoredArticle {
  slug: string;
  title: string;
  category: string;
  content: string;
  score: number;
}

export interface KnowledgeMatch {
  slug: string;
  title: string;
  category: string;
  content: string;
}

// Cosine similarity on 768-dim text-embedding-004 vectors for genuinely
// on-topic queries in this corpus tends to land well above this; short or
// tangential chat turns ("thanks!", "ok") land well below it.
const EMBEDDING_SCORE_THRESHOLD = 0.72;
// Keyword overlap is coarser (integer counts, not a normalized similarity) —
// require at least one shared meaningful word.
const KEYWORD_SCORE_THRESHOLD = 1;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "if", "in", "is", "it",
  "its", "me", "my", "of", "on", "or", "should", "so", "that", "the", "this",
  "to", "was", "what", "when", "why", "will", "with", "would", "you", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Postgres/PostgREST can return a vector column as a JSON array or a "[..]" string. */
function parseEmbedding(raw: string | number[] | null): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Pure: ranks articles by cosine similarity to a precomputed query vector. */
export function scoreByEmbedding(queryVector: number[], articles: KnowledgeArticleRow[]): ScoredArticle[] {
  return articles
    .map((a) => {
      const vector = parseEmbedding(a.embedding);
      const score = vector ? cosineSimilarity(queryVector, vector) : 0;
      return { slug: a.slug, title: a.title, category: a.category, content: a.content, score };
    })
    .filter((a) => a.score >= EMBEDDING_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

/** Pure: ranks articles by shared meaningful-word count with the query. */
export function scoreByKeywords(query: string, articles: KnowledgeArticleRow[]): ScoredArticle[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  return articles
    .map((a) => {
      const articleTokens = new Set(tokenize(`${a.title} ${a.content}`));
      let overlap = 0;
      for (const token of queryTokens) {
        if (articleTokens.has(token)) overlap += 1;
      }
      return { slug: a.slug, title: a.title, category: a.category, content: a.content, score: overlap };
    })
    .filter((a) => a.score >= KEYWORD_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

/**
 * Fetches the knowledge base and returns the top matches for a chat message.
 * Tries embedding similarity first; falls back to keyword search on any
 * embedding failure so a chat reply is never blocked by a knowledge-lookup
 * problem. Returns an empty array (not a throw) on total failure — callers
 * should treat this as "no relevant reference material found", not an error.
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  query: string,
  limit = 3
): Promise<KnowledgeMatch[]> {
  try {
    const { data: articles, error } = await supabase
      .from("coach_knowledge_articles")
      .select("slug, title, category, content, embedding");
    if (error || !articles || articles.length === 0) return [];

    let ranked: ScoredArticle[];
    try {
      const queryVector = await embed(query);
      ranked = scoreByEmbedding(queryVector, articles as KnowledgeArticleRow[]);
    } catch {
      ranked = scoreByKeywords(query, articles as KnowledgeArticleRow[]);
    }

    return ranked.slice(0, limit).map(({ slug, title, category, content }) => ({ slug, title, category, content }));
  } catch {
    return [];
  }
}
