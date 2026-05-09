"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, Trash2, Pencil, MoreHorizontal, X, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { toggleLike, deletePost, updatePost } from "@/app/actions/community-actions";
import { POST_CATEGORIES } from "@/lib/community-types";
import type { PostCategory } from "@/lib/community-types";
import { toast } from "sonner";
import PostComments from "./PostComments";
import ImageGallery from "./ImageGallery";

export interface CommunityPost {
  id: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  imageUrls: string[];
  likesCount: number;
  commentsCount: number;
  category: PostCategory;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
  isOwn: boolean;
  isLiked: boolean;
}

interface PostCardProps {
  post: CommunityPost;
  onPostUpdated: () => void;
}

export default function PostCard({ post, onPostUpdated }: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    // Optimistic update
    setLiked((prev) => !prev);
    setLikesCount((prev) => (liked ? prev - 1 : prev + 1));

    const res = await toggleLike(post.id);
    if (!res.success) {
      // Revert
      setLiked((prev) => !prev);
      setLikesCount((prev) => (liked ? prev + 1 : prev - 1));
      toast.error(res.error || "Failed to toggle like");
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    const res = await deletePost(post.id);
    setBusy(false);
    if (res.success) {
      toast.success("Post deleted");
      onPostUpdated();
    } else {
      toast.error(res.error || "Failed to delete");
    }
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setBusy(true);
    const res = await updatePost(post.id, editContent);
    setBusy(false);
    if (res.success) {
      toast.success("Post updated");
      setEditing(false);
      onPostUpdated();
    } else {
      toast.error(res.error || "Failed to update");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#FF5733] to-[#FFB800] flex items-center justify-center shrink-0 overflow-hidden">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-sm">{post.authorName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-raleway font-semibold text-sm text-foreground">{post.authorName}</p>
              {post.category && post.category !== "general" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF5733]/10 text-[#FF5733] font-raleway uppercase tracking-wide">
                  {POST_CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              {post.updatedAt !== post.createdAt && " (edited)"}
            </p>
          </div>
        </div>

        {post.isOwn && (
          <div className="relative">
            <Button variant="ghost" size="icon-xs" onClick={() => setShowMenu(!showMenu)}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-20 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-30">
                <button
                  onClick={() => { setEditing(true); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="mb-3">
          <textarea
            title="Edit post"
            aria-label="Edit post content"
            placeholder="Edit your post..."
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5733] min-h-20 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditContent(post.content); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" disabled={busy || !editContent.trim()} onClick={handleSaveEdit} className="bg-[#FF5733] hover:bg-[#e04d2d] text-white">
              <Check className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="font-merriweather-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-3">
          {post.content}
        </p>
      )}

      {/* Image Gallery */}
      {post.imageUrls && post.imageUrls.length > 0 ? (
        <div className="mb-3">
          <ImageGallery images={post.imageUrls} />
        </div>
      ) : post.imageUrl ? (
        <div className="mb-3 rounded-lg overflow-hidden">
          <img src={post.imageUrl} alt="Post image" className="w-full max-h-100 object-cover" />
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-red-500" : ""}`} />
          <span className="font-medium">{likesCount}</span>
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#FF5733] transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="font-medium">{commentsCount}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <PostComments
          postId={post.id}
          onCommentAdded={() => setCommentsCount((c) => c + 1)}
          onCommentDeleted={() => setCommentsCount((c) => Math.max(c - 1, 0))}
        />
      )}
    </div>
  );
}
