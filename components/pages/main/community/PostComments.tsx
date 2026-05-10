"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Send, Loader2 } from "lucide-react";
import { getPostComments, addComment, deleteComment } from "@/app/actions/community-actions";
import type { PostComment } from "@/app/actions/community-actions";
import { toast } from "sonner";

interface PostCommentsProps {
  postId: string;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}

const PAGE_SIZE = 20;

export default function PostComments({ postId, onCommentAdded, onCommentDeleted }: PostCommentsProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async (p: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const res = await getPostComments(postId, p, PAGE_SIZE);
    if (res.success) {
      setComments((prev) => append ? [...prev, ...res.data] : res.data);
      setTotal(res.total);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [postId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchComments(1); }, [fetchComments]);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    const res = await addComment(postId, input.trim());
    setSubmitting(false);
    if (res.success) {
      setInput("");
      await fetchComments(1);
      onCommentAdded();
    } else {
      toast.error(res.error ?? "Failed to post comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    const res = await deleteComment(commentId);
    if (res.success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((t) => Math.max(t - 1, 0));
      onCommentDeleted();
    } else {
      toast.error(res.error ?? "Failed to delete comment");
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchComments(next, true);
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          title="Write a comment"
          aria-label="Write a comment"
          placeholder="Write a comment..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          maxLength={500}
          className="flex-1 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5733] font-merriweather-sans placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          title="Post comment"
          className="p-2 rounded-lg bg-[#FF5733] text-white hover:bg-[#e04d2d] transition-colors disabled:opacity-40 cursor-pointer"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
                <div className="h-3 w-full bg-gray-100 dark:bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 group">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#FF5733] to-[#FFB800] flex items-center justify-center shrink-0 overflow-hidden text-white text-xs font-bold">
                {comment.authorAvatar ? (
                  <Image src={comment.authorAvatar} alt={comment.authorName} width={28} height={28} className="w-full h-full object-cover" />
                ) : (
                  comment.authorName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 flex-1 min-w-0">
                    <p className="font-raleway font-semibold text-xs text-foreground mb-0.5">{comment.authorName}</p>
                    <p className="font-merriweather-sans text-sm text-foreground leading-relaxed wrap-break-word">{comment.content}</p>
                  </div>
                  {comment.isOwn && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      title="Delete comment"
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}

          {comments.length < total && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full text-xs text-[#FF5733] hover:underline py-1 disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? "Loading..." : `Load more (${total - comments.length} remaining)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
