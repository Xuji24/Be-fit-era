"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type LegalDocumentSlug = "privacy-policy" | "terms-of-service";

export interface LegalDocumentSection {
  id: string;
  anchor: string;
  title: string;
  content: string;
  position: number;
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  title: string;
  intro: string;
  effectiveDate: string;
  updatedAt: string;
  sections: LegalDocumentSection[];
}

type ActionResult = {
  success: boolean;
  error?: string;
};

/** Verify the current user has admin role. Returns the client + user id or throws. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return { supabase, userId: user.id };
}

/** Public read: powers the live /privacy-policy and /terms-of-service pages. */
export async function getLegalDocument(
  slug: LegalDocumentSlug,
): Promise<LegalDocument | null> {
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("legal_documents")
    .select("id, slug, title, intro, effective_date, updated_at")
    .eq("slug", slug)
    .single();

  if (error || !doc) return null;

  const { data: sections } = await supabase
    .from("legal_document_sections")
    .select("id, anchor, title, content, position")
    .eq("document_id", doc.id)
    .order("position", { ascending: true });

  return {
    slug: doc.slug,
    title: doc.title,
    intro: doc.intro,
    effectiveDate: doc.effective_date,
    updatedAt: doc.updated_at,
    sections: sections ?? [],
  };
}

/** Admin read — same shape as the public read, gated so it can also surface drafts later if needed. */
export async function getAdminLegalDocument(
  slug: LegalDocumentSlug,
): Promise<LegalDocument | null> {
  await requireAdmin();
  return getLegalDocument(slug);
}

export async function updateLegalDocument(
  slug: LegalDocumentSlug,
  input: {
    title: string;
    intro: string;
    effectiveDate: string;
    sections: { anchor: string; title: string; content: string }[];
  },
): Promise<ActionResult> {
  const { supabase, userId } = await requireAdmin();

  if (!input.title.trim()) return { success: false, error: "Title is required." };
  if (!input.effectiveDate) return { success: false, error: "Effective date is required." };
  if (input.sections.length === 0) {
    return { success: false, error: "At least one section is required." };
  }

  const seenAnchors = new Set<string>();
  for (const section of input.sections) {
    if (!section.anchor.trim() || !section.title.trim()) {
      return { success: false, error: "Every section needs a title and an anchor." };
    }
    if (seenAnchors.has(section.anchor)) {
      return { success: false, error: `Duplicate section anchor: "${section.anchor}".` };
    }
    seenAnchors.add(section.anchor);
  }

  const { data: doc, error: docError } = await supabase
    .from("legal_documents")
    .update({
      title: input.title.trim(),
      intro: input.intro,
      effective_date: input.effectiveDate,
      updated_by: userId,
    })
    .eq("slug", slug)
    .select("id")
    .single();

  if (docError || !doc) return { success: false, error: "Failed to update document." };

  // Replace sections wholesale — simplest correct approach for a small,
  // admin-only, low-frequency edit (a handful of sections per document).
  const { error: deleteError } = await supabase
    .from("legal_document_sections")
    .delete()
    .eq("document_id", doc.id);

  if (deleteError) return { success: false, error: "Failed to update sections." };

  const { error: insertError } = await supabase.from("legal_document_sections").insert(
    input.sections.map((section, index) => ({
      document_id: doc.id,
      anchor: section.anchor.trim(),
      title: section.title.trim(),
      content: section.content,
      position: index + 1,
    })),
  );

  if (insertError) return { success: false, error: "Failed to save sections." };

  revalidatePath(slug === "privacy-policy" ? "/privacy-policy" : "/terms-of-service");

  return { success: true };
}
