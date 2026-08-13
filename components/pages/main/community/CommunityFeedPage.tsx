"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, RefreshCw, Users, Search, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { getCommunityPosts } from "@/app/actions/community-actions";
import { POST_CATEGORIES } from "@/lib/community-types";
import type { PostCategory } from "@/lib/community-types";
import PageHeader from "@/components/page-header";
import PostCard, { type CommunityPost } from "./PostCard";
import CreatePostModal from "./CreatePostModal";

const ALL_CATEGORIES: { value: PostCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...POST_CATEGORIES,
];

const PAGE_SIZE = 10;
const RESTORE_KEY = "community-feed-state";
/** Only restore a cached feed if it's fresh — otherwise the user sees a stale timeline. */
const RESTORE_TTL_MS = 5 * 60 * 1000;

interface RestoredState {
  posts: CommunityPost[];
  page: number;
  hasMore: boolean;
  search: string;
  activeCategory: PostCategory | "all";
  scrollY: number;
  savedAt: number;
}

function readRestoredState(): RestoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestoredState;
    if (Date.now() - parsed.savedAt > RESTORE_TTL_MS) {
      sessionStorage.removeItem(RESTORE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function CommunityFeedPage() {
  // Read once during initial render so we never flash an empty feed before restoring.
  const restored = useRef<RestoredState | null>(readRestoredState()).current;

  const [posts, setPosts] = useState<CommunityPost[]>(restored?.posts ?? []);
  const [loading, setLoading] = useState(!restored);
  const [page, setPage] = useState(restored?.page ?? 1);
  const [hasMore, setHasMore] = useState(restored?.hasMore ?? true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [search, setSearch] = useState(restored?.search ?? "");
  const [activeCategory, setActiveCategory] = useState<PostCategory | "all">(
    restored?.activeCategory ?? "all",
  );
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Observer state must be read inside the IntersectionObserver callback, which closes
  // over the values from the render that created it. Refs give it the current values.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);
  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  const searchRef = useRef(search);
  const categoryRef = useRef(activeCategory);
  const postsRef = useRef(posts);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { categoryRef.current = activeCategory; }, [activeCategory]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  const fetchPosts = useCallback(async (pageNum: number, append = false, q?: string, cat?: PostCategory | "all") => {
    if (append) setLoadingMore(true); else setLoading(true);
    inFlightRef.current = true;

    const categoryArg = cat === "all" ? undefined : cat;
    const res = await getCommunityPosts(pageNum, PAGE_SIZE, q, categoryArg);

    if (res.success && res.data) {
      const typed = res.data as CommunityPost[];
      if (append) {
        // Guard against duplicates: a post created or deleted mid-scroll shifts the
        // offset window, so the same row can arrive in two consecutive pages.
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...typed.filter((p) => !seen.has(p.id))];
        });
      } else {
        setPosts(typed);
      }
      setHasMore(typed.length === PAGE_SIZE);
    } else {
      // Stop the observer from retrying a failing request forever.
      setHasMore(false);
    }

    inFlightRef.current = false;
    if (append) setLoadingMore(false); else setLoading(false);
  }, []);

  // Initial load — skipped when we restored a cached feed.
  useEffect(() => {
    if (restored) return;
    fetchPosts(1, false, search, activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPosts]);

  // Restore scroll position after the cached posts have painted.
  useEffect(() => {
    if (!restored) return;
    const id = requestAnimationFrame(() => window.scrollTo(0, restored.scrollY));
    return () => cancelAnimationFrame(id);
  }, [restored]);

  // Persist feed + scroll offset so returning from a post/profile keeps your place.
  useEffect(() => {
    const save = () => {
      if (postsRef.current.length === 0) return;
      try {
        sessionStorage.setItem(RESTORE_KEY, JSON.stringify({
          posts: postsRef.current,
          page: pageRef.current,
          hasMore: hasMoreRef.current,
          search: searchRef.current,
          activeCategory: categoryRef.current,
          scrollY: window.scrollY,
          savedAt: Date.now(),
        } satisfies RestoredState));
      } catch {
        // Quota exceeded on a long feed — losing restore is better than crashing.
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);

  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasMoreRef.current) return;
    const next = pageRef.current + 1;
    setPage(next);
    fetchPosts(next, true, searchRef.current, categoryRef.current);
  }, [fetchPosts]);

  // Infinite scroll: prefetch before the sentinel is actually on screen so the
  // next batch is already in flight by the time the user reaches the bottom.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, loading, hasMore, posts.length]);

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

  // ─── Surgical updates: never refetch the whole feed for a single post ───
  const handlePostCreated = useCallback((post: CommunityPost) => {
    // Only surface it immediately if it belongs in the current view.
    const matchesCategory = categoryRef.current === "all" || categoryRef.current === post.category;
    const matchesSearch =
      !searchRef.current.trim() ||
      post.content.toLowerCase().includes(searchRef.current.trim().toLowerCase());

    if (matchesCategory && matchesSearch) {
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePostEdited = useCallback((id: string, content: string, updatedAt: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, content, updatedAt } : p)));
  }, []);

  const handlePostDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <div className="min-h-screen relative">
      <PageHeader
        title="Share Your Journey"
        subtitle="Celebrate milestones, share race stories, and connect with fellow runners in the Fitra community."
        maxWidthClassName="max-w-2xl"
      />

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
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
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full skeleton-shimmer" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 rounded skeleton-shimmer" />
                    <div className="h-2 w-16 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="h-3 w-full rounded skeleton-shimmer mb-2" />
                <div className="h-3 w-3/4 rounded skeleton-shimmer" />
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
              <PostCard
                key={post.id}
                post={post}
                onPostEdited={handlePostEdited}
                onPostDeleted={handlePostDeleted}
              />
            ))}

            {/* Skeletons while the next batch streams in, so the feed visibly grows */}
            {loadingMore && (
              <div className="space-y-4" aria-hidden="true">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full skeleton-shimmer" />
                      <div className="space-y-2 flex-1">
                        <div className="h-3 w-24 rounded skeleton-shimmer" />
                        <div className="h-2 w-16 rounded skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="h-3 w-full rounded skeleton-shimmer mb-2" />
                    <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            )}

            {/* Sentinel — triggers the next page before it scrolls into view */}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

            {/* Fallback for no-IntersectionObserver / keyboard users; also keeps
                the feed navigable if an auto-load request fails. */}
            {hasMore && !loadingMore && (
              <div className="text-center pt-2">
                <Button variant="outline" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}

            {!hasMore && (
              <p className="text-center text-sm text-muted-foreground py-6 font-merriweather-sans">
                You&rsquo;re all caught up.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}
