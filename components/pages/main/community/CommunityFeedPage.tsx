"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, RefreshCw, Users, Search, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { getCommunityPosts } from "@/app/actions/community-actions";
import { POST_CATEGORIES } from "@/lib/community-types";
import type { PostCategory } from "@/lib/community-types";
import PostCard, { type CommunityPost } from "./PostCard";
import CreatePostModal from "./CreatePostModal";

const ALL_CATEGORIES: { value: PostCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...POST_CATEGORIES,
];

export default function CommunityFeedPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<PostCategory | "all">("all");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPosts = useCallback(async (pageNum: number, append = false, q?: string, cat?: PostCategory | "all") => {
    if (append) setLoadingMore(true); else setLoading(true);

    const categoryArg = cat === "all" ? undefined : cat;
    const res = await getCommunityPosts(pageNum, 10, q, categoryArg);

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

  // Initial load
  useEffect(() => {
    fetchPosts(1, false, search, activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPosts]);

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setPage(1);
      fetchPosts(1, false, val, activeCategory);
    }, 350);
  };

  const handleCategoryChange = (cat: PostCategory | "all") => {
    setActiveCategory(cat);
    setPage(1);
    fetchPosts(1, false, search, cat);
  };

  const handleRefresh = () => {
    setPage(1);
    fetchPosts(1, false, search, activeCategory);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, true, search, activeCategory);
  };

  return (
    <div className="min-h-screen relative">
      {/* Hero Section */}
      <section className="relative bg-[#1A1A1A] dark:bg-[#0D0D0D] pt-28 pb-14 md:pt-32 md:pb-16">
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
        <div className="flex items-center justify-between mb-5">
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

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            title="Search posts"
            aria-label="Search posts"
            placeholder="Search posts..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF5733] font-merriweather-sans"
          />
          {search && (
            <button
              title="Clear search"
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer border font-raleway ${
                activeCategory === cat.value
                  ? "bg-[#FF5733] text-white border-[#FF5733]"
                  : "bg-white dark:bg-zinc-900 text-muted-foreground border-gray-200 dark:border-zinc-700 hover:border-[#FF5733] hover:text-[#FF5733]"
              }`}
            >
              {cat.label}
            </button>
          ))}
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
            <h3 className="font-raleway font-bold text-lg text-foreground mb-1">
              {search || activeCategory !== "all" ? "No matching posts" : "No posts yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || activeCategory !== "all"
                ? "Try a different search or category."
                : "Be the first to share something with the community!"}
            </p>
            {!search && activeCategory === "all" && (
              <Button onClick={() => setShowCreate(true)} className="bg-[#FF5733] hover:bg-[#e04d2d] text-white">
                <Plus className="w-4 h-4 mr-1.5" /> Create First Post
              </Button>
            )}
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
