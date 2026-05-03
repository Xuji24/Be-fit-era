"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import LeaderboardTable from "./leaderboard-table";
import { getLeaderboardPage } from "@/app/actions/main-actions";
import type { LeaderboardEntry } from "@/utils/types/leaderboard-types";
import { Loader2 } from "lucide-react";

interface Props {
  initialTopThree: LeaderboardEntry[];
  initialRemaining: LeaderboardEntry[];
  totalCount: number;
  pageSize: number;
}

export default function LeaderboardTableWrapper({
  initialTopThree,
  initialRemaining,
  totalCount,
  pageSize,
}: Props) {
  const [topThree] = useState(initialTopThree);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadedCount = topThree.length + remaining.length;
  const hasMore = loadedCount < totalCount;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const nextPage = page + 1;
    const result = await getLeaderboardPage(nextPage, pageSize);
    if (result.data.length > 0) {
      // Skip entries already in topThree (ranks 1-3)
      const newEntries = result.data.filter((e) => e.rank > 3);
      setRemaining((prev) => [...prev, ...newEntries]);
      setPage(nextPage);
    }
    setLoading(false);
  }, [loading, hasMore, page, pageSize]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <LeaderboardTable topThree={topThree} remaining={remaining} />

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading more runners...
            </div>
          )}
        </div>
      )}

      {!hasMore && loadedCount > 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Showing all {loadedCount} runners
        </p>
      )}
    </>
  );
}
