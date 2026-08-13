// Backfills embeddings for coach_knowledge_articles rows where embedding IS NULL.
// Idempotent — safe to re-run after adding new articles later.
//
// Usage: npm run seed:coach-knowledge
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
// (loaded from .env.local via `node --env-file`, see package.json).

import { createClient } from "@supabase/supabase-js";

// gemini-embedding-001 defaults to 3072 dims — dimensions:768 truncates to
// match coach_knowledge_articles.embedding vector(768). text-embedding-004
// (native 768-dim) has been retired on this API key.
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function embed(text, apiKey) {
  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSIONS }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`embeddings returned ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("embeddings returned an empty vector");
  }
  return vector;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = requireEnv("GEMINI_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rows, error } = await supabase
    .from("coach_knowledge_articles")
    .select("id, slug, title, content")
    .is("embedding", null);

  if (error) {
    console.error("Failed to fetch articles:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("No articles need embedding — all rows already have one.");
    return;
  }

  console.log(`Embedding ${rows.length} article(s)...`);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const vector = await embed(`${row.title}\n\n${row.content}`, geminiKey);
      const { error: updateError } = await supabase
        .from("coach_knowledge_articles")
        .update({ embedding: vector })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      succeeded += 1;
      console.log(`  ok: ${row.slug}`);
    } catch (e) {
      failed += 1;
      console.error(`  FAILED: ${row.slug} — ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  console.log(`Done. ${succeeded} embedded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
