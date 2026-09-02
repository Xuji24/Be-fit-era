"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import {
  decodeRoute,
  routeToSvgPath,
  type StravaActivity,
} from "@/lib/strava-share";

interface StravaSuggestionStripProps {
  /** Called when a run is picked; receives the activity to build a card from. */
  onSelect: (activity: StravaActivity) => void;
  /** Id of the activity currently being turned into a card. */
  pendingId: number | null;
  disabled?: boolean;
}

/**
 * Horizontal strip of the user's recent Strava activities.
 *
 * Thumbnails are plain SVG paths derived from the encoded polyline, so the strip
 * renders immediately — the map-backed card is only built once a run is tapped.
 * Activities without a route (treadmill runs) are filtered out.
 */
export default function StravaSuggestionStrip({
  onSelect,
  pendingId,
  disabled = false,
}: StravaSuggestionStripProps) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/strava/activities");
        if (!res.ok) return; // Not connected, or Strava is unavailable.
        const data = await res.json();
        if (cancelled) return;
        const withRoutes = (data.activities ?? []).filter(
          (a: StravaActivity) => a.polyline,
        );
        setActivities(withRoutes.slice(0, 8));
      } catch {
        // Suggestions are optional — stay silent and show nothing.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing at all when there's nothing to suggest.
  if (loading || activities.length === 0) return null;

  return (
    <div className="mt-4">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5 font-raleway uppercase tracking-wide">
        <Activity className="w-3.5 h-3.5" />
        Share a recent run
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {activities.map((activity) => {
          const path = routeToSvgPath(decodeRoute(activity.polyline!));
          const isPending = pendingId === activity.id;

          return (
            <button
              key={activity.id}
              type="button"
              disabled={disabled || pendingId !== null}
              onClick={() => onSelect(activity)}
              title={`${activity.name} — ${activity.distance}km`}
              className="relative shrink-0 w-24 rounded-lg border border-gray-200 dark:border-zinc-700 p-1.5 hover:border-[var(--brand)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <svg viewBox="0 0 100 100" className="w-full h-14" aria-hidden="true">
                <path
                  d={path}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-[11px] font-semibold text-foreground truncate">
                {activity.distance}km
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {activity.averagePace}
              </div>

              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 dark:bg-zinc-900/70">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-hover)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
