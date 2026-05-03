"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { getCommunityPosts } from "@/app/actions/community-actions";
import PostCard, { type CommunityPost } from "./PostCard";
import CreatePostModal from "./CreatePostModal";

export default function CommunityFeedPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPosts = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);

    const res = await getCommunityPosts(pageNum, 10);

    if (res.success && res.data) {
      const typed = res.data as CommunityPost[];
      if (append) {
        setPosts((prev) => [...prev, ...typed]);
      } else {
        setPosts(typed);
      }
      setHasMore(typed.length === 10);
    }

    if (append) setLoadingMore(false); else setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  const handleRefresh = () => {
    setPage(1);
    fetchPosts(1);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      {/* Hero Section */}
      <section className="relative bg-[#1A1A1A] dark:bg-[#0D0D0D] pt-28 pb-14 md:pt-32 md:pb-16">
        {/* Radial glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100 bg-[#FF5733]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-raleway text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            Share Your <span className="text-[#FF5733]">Journey</span>
          </h1>
          <p className="font-merriweather-sans text-white/50 text-sm md:text-base max-w-lg">
            Celebrate milestones, share race stories, and connect with fellow runners in the Fitra community.
          </p>
        </div>
      </section>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 py-10 pb-16">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#FF5733] hover:bg-[#e04d2d] text-white shadow-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" /> New Post
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-5 animate-pulse border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
                    <div className="h-2 w-16 bg-gray-200 dark:bg-zinc-700 rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-raleway font-bold text-lg text-foreground mb-1">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Be the first to share something with the community!</p>
            <Button onClick={() => setShowCreate(true)} className="bg-[#FF5733] hover:bg-[#e04d2d] text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Create First Post
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onPostUpdated={handleRefresh} />
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onPostCreated={handleRefresh}
      />
    </div>
  );
}
