"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
  isOwn: boolean;
}

import type { PostCategory } from "@/lib/community-types";

// ─── Fetch Posts (paginated) ────────────────────────────────
export async function getCommunityPosts(page = 1, limit = 10, search?: string, category?: PostCategory) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id ?? null;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("community_posts")
    .select("id, user_id, content, image_url, image_urls, likes_count, comments_count, category, created_at, updated_at, profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (category) query = query.eq("category", category);
  if (search?.trim()) query = query.ilike("content", `%${search.trim()}%`);

  const { data: posts, error } = await query;

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
    imageUrls: (p.image_urls as string[]) ?? [],
    likesCount: p.likes_count,
    commentsCount: (p.comments_count as number) ?? 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    authorName: (p.profiles as { full_name?: string })?.full_name ?? "Anonymous",
    authorAvatar: (p.profiles as { avatar_url?: string })?.avatar_url ?? null,
    category: (p.category as PostCategory) ?? "general",
    isOwn: p.user_id === currentUserId,
    isLiked: likedPostIds.has(p.id),
  }));

  return { success: true, data: enriched };
}

// ─── Create Post ────────────────────────────────────────────
export async function createPost(content: string, imageUrl?: string, imageUrls?: string[], category?: PostCategory): Promise<ActionResult> {
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
    image_urls: imageUrls ?? [],
    category: category ?? "general",
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

// ─── Fetch Comments (paginated) ────────────────────────────
export async function getPostComments(postId: string, page = 1, limit = 20) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id ?? null;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: comments, error, count } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at, updated_at, profiles(full_name, avatar_url)", { count: "exact" })
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) return { success: false, error: error.message, data: [], total: 0 };

  const enriched: PostComment[] = (comments ?? []).map((c) => ({
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    content: c.content,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    authorName: (c.profiles as { full_name?: string })?.full_name ?? "Anonymous",
    authorAvatar: (c.profiles as { avatar_url?: string })?.avatar_url ?? null,
    isOwn: c.user_id === currentUserId,
  }));

  return { success: true, data: enriched, total: count ?? 0 };
}

// ─── Add Comment ────────────────────────────────────────────
export async function addComment(postId: string, content: string): Promise<ActionResult> {
  if (!content.trim() || content.length > 500) {
    return { success: false, error: "Comment must be 1–500 characters." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    user_id: authData.user.id,
    content: content.trim(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Delete Comment ─────────────────────────────────────────
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", authData.user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
