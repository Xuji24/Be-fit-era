"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Fetch Posts (paginated) ────────────────────────────────
export async function getCommunityPosts(page = 1, limit = 10) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id ?? null;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("id, user_id, content, image_url, likes_count, created_at, updated_at, profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { success: false, error: error.message, data: [] };

  // If user is logged in, check which posts they've liked
  let likedPostIds: Set<string> = new Set();
  if (currentUserId && posts && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", currentUserId)
      .in("post_id", postIds);

    if (likes) {
      likedPostIds = new Set(likes.map((l) => l.post_id));
    }
  }

  const enriched = (posts ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    content: p.content,
    imageUrl: p.image_url,
    likesCount: p.likes_count,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    authorName: (p.profiles as { full_name?: string })?.full_name ?? "Anonymous",
    authorAvatar: (p.profiles as { avatar_url?: string })?.avatar_url ?? null,
    isOwn: p.user_id === currentUserId,
    isLiked: likedPostIds.has(p.id),
  }));

  return { success: true, data: enriched };
}

// ─── Create Post ────────────────────────────────────────────
export async function createPost(content: string, imageUrl?: string): Promise<ActionResult> {
  if (!content.trim() || content.length > 1000) {
    return { success: false, error: "Content must be 1–1000 characters." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  const { error } = await supabase.from("community_posts").insert({
    user_id: authData.user.id,
    content: content.trim(),
    image_url: imageUrl || null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/community");
  return { success: true };
}

// ─── Update Post ────────────────────────────────────────────
export async function updatePost(postId: string, content: string): Promise<ActionResult> {
  if (!content.trim() || content.length > 1000) {
    return { success: false, error: "Content must be 1–1000 characters." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("community_posts")
    .update({ content: content.trim() })
    .eq("id", postId)
    .eq("user_id", authData.user.id); // RLS + explicit ownership check

  if (error) return { success: false, error: error.message };

  revalidatePath("/community");
  return { success: true };
}

// ─── Delete Post ────────────────────────────────────────────
export async function deletePost(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", authData.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/community");
  return { success: true };
}

// ─── Toggle Like ────────────────────────────────────────────
export async function toggleLike(postId: string): Promise<ActionResult & { liked?: boolean }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  // Check if already liked
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (existing) {
    // Unlike
    const { error } = await supabase.from("post_likes").delete().eq("id", existing.id);
    if (error) return { success: false, error: error.message };
    return { success: true, liked: false };
  } else {
    // Like
    const { error } = await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: authData.user.id,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, liked: true };
  }
}
