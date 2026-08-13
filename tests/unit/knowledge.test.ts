import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreByEmbedding, scoreByKeywords, searchKnowledge, type KnowledgeArticleRow } from "@/lib/coach/knowledge";

vi.mock("@/lib/ai/embeddings", () => ({ embed: vi.fn() }));
import { embed } from "@/lib/ai/embeddings";

const OVERTRAINING: KnowledgeArticleRow = {
  slug: "overtraining-signs",
  title: "Signs you might be overtraining",
  category: "recovery",
  content: "Watch for performance that keeps dropping despite consistent effort.",
  embedding: [1, 0, 0],
};

const HYDRATION: KnowledgeArticleRow = {
  slug: "hydration-basics",
  title: "Hydration basics for active days",
  category: "nutrition",
  content: "Even mild dehydration can make workouts feel harder than they are.",
  embedding: [0, 1, 0],
};

const ARTICLES = [OVERTRAINING, HYDRATION];

describe("scoreByEmbedding", () => {
  it("ranks the article whose vector matches the query above threshold", () => {
    const ranked = scoreByEmbedding([1, 0, 0], ARTICLES);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].slug).toBe("overtraining-signs");
    expect(ranked[0].score).toBeCloseTo(1, 5);
  });

  it("excludes articles below the similarity threshold", () => {
    const ranked = scoreByEmbedding([1, 0, 0], [HYDRATION]);
    expect(ranked).toHaveLength(0);
  });

  it("parses a stringified pgvector column", () => {
    const stringEmbedded: KnowledgeArticleRow = { ...OVERTRAINING, embedding: "[1,0,0]" };
    const ranked = scoreByEmbedding([1, 0, 0], [stringEmbedded]);
    expect(ranked).toHaveLength(1);
  });

  it("treats a null embedding as a zero match rather than throwing", () => {
    const noEmbedding: KnowledgeArticleRow = { ...OVERTRAINING, embedding: null };
    const ranked = scoreByEmbedding([1, 0, 0], [noEmbedding]);
    expect(ranked).toHaveLength(0);
  });
});

describe("scoreByKeywords", () => {
  it("matches on a shared meaningful word", () => {
    const ranked = scoreByKeywords("am I overtraining right now?", ARTICLES);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].slug).toBe("overtraining-signs");
  });

  it("returns nothing for a query with no meaningful words", () => {
    const ranked = scoreByKeywords("the a is", ARTICLES);
    expect(ranked).toHaveLength(0);
  });

  it("returns nothing when no article shares a keyword", () => {
    const ranked = scoreByKeywords("what pace should I run a marathon at", ARTICLES);
    expect(ranked).toHaveLength(0);
  });
});

function stubSupabase(rows: KnowledgeArticleRow[] | null, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data: rows, error });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select };
}

describe("searchKnowledge", () => {
  it("uses embedding similarity when embed() succeeds", async () => {
    vi.mocked(embed).mockResolvedValue([1, 0, 0]);
    const { client } = stubSupabase(ARTICLES);

    const matches = await searchKnowledge(client, "am I overtraining?");

    expect(matches).toHaveLength(1);
    expect(matches[0].slug).toBe("overtraining-signs");
  });

  it("falls back to keyword search when embed() throws", async () => {
    vi.mocked(embed).mockRejectedValue(new Error("no key"));
    const { client } = stubSupabase(ARTICLES);

    const matches = await searchKnowledge(client, "am I overtraining right now?");

    expect(matches).toHaveLength(1);
    expect(matches[0].slug).toBe("overtraining-signs");
  });

  it("returns an empty array instead of throwing when the query fails", async () => {
    vi.mocked(embed).mockResolvedValue([1, 0, 0]);
    const { client } = stubSupabase(null, { message: "connection lost" });

    const matches = await searchKnowledge(client, "anything");
    expect(matches).toEqual([]);
  });

  it("returns an empty array when nothing clears the threshold", async () => {
    vi.mocked(embed).mockRejectedValue(new Error("no key"));
    const { client } = stubSupabase(ARTICLES);

    const matches = await searchKnowledge(client, "thanks!");
    expect(matches).toEqual([]);
  });

  it("respects the limit", async () => {
    const many: KnowledgeArticleRow[] = Array.from({ length: 5 }, (_, i) => ({
      ...OVERTRAINING,
      slug: `overtraining-${i}`,
      embedding: [1, 0, 0],
    }));
    vi.mocked(embed).mockResolvedValue([1, 0, 0]);
    const { client } = stubSupabase(many);

    const matches = await searchKnowledge(client, "overtraining", 2);
    expect(matches).toHaveLength(2);
  });
});
