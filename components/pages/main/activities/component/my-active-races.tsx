"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import type { JoinedRace } from "@/data/activities-data";
import { cancelRegistration } from "@/app/actions/main-actions";

const statusStyles: Record<
  JoinedRace["status"],
  { label: string; cls: string }
> = {
  "in-progress": {
    label: "In Progress",
    cls: "bg-[var(--brand)]/15 text-[var(--brand-hover)]",
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-500/10 text-emerald-500",
  },
  // Semantic status, kept off the brand palette — same reasoning as
  // lib/charts/theme.ts's CHART_STATUS.pending.
  upcoming: {
    label: "Upcoming",
    cls: "bg-amber-500/10 text-amber-500",
  },
};

interface Props {
  races: JoinedRace[];
  onLogDistance?: (raceId: string) => void;
}

const MyActiveRaces = ({ races: initialRaces, onLogDistance }: Props) => {
  const [races, setRaces] = useState(initialRaces);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  if (races.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold text-foreground font-raleway mb-5">
          My Races
        </h2>
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 p-6 text-center">
          <p className="text-sm text-foreground/50">
            You haven&apos;t joined any races yet. Head to the{" "}
            <Link href="/race" className="text-[var(--brand-hover)] hover:underline">
              Races
            </Link>{" "}
            page to register!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-foreground font-raleway">
          My Races
        </h2>
        <span className="text-xs text-foreground/40 uppercase tracking-wider">
          {races.length} joined
        </span>
      </div>

      <div className="space-y-3">
        {races.map((race) => {
          const progress = Math.min(
            (race.loggedDistance / race.targetDistance) * 100,
            100,
          );
          const style = statusStyles[race.status];

          return (
            <div
              key={race.id}
              className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 hover:border-[var(--brand)]/20 transition-all p-3"
            >
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <Image
                    src={race.image}
                    alt={race.title}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {race.title}
                    </h3>
                    <span
                      className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${style.cls}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground/40 mt-0.5">
                    {race.date}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-semibold text-[var(--brand-hover)]">
                        {race.loggedDistance} km
                      </span>
                      <span className="text-foreground/40">
                        {race.targetDistance} km
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          race.status === "completed"
                            ? "bg-emerald-500"
                            : "bg-[var(--brand)]"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Log Distance button */}
              {race.status === "in-progress" && (
                <button
                  onClick={() => onLogDistance?.(race.id)}
                  className="mt-3 w-full py-1.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  + Log Distance
                </button>
              )}
              {race.status === "upcoming" && (
                <div className="mt-3 w-full py-1.5 rounded-xl bg-amber-500/10 text-amber-500 text-xs font-semibold text-center">
                  Starts {race.date}
                </div>
              )}
              {race.status === "completed" && (
                <div className="mt-3 w-full py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-semibold text-center">
                  Race Completed!
                </div>
              )}

              {/* Cancel Registration */}
              {race.status !== "completed" && (
                <>
                  {cancellingId === race.id ? (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/30">
                      <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                        Cancel registration for this race?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setCancelLoading(true);
                            const result = await cancelRegistration(
                              race.id,
                              "Cancelled by runner",
                            );
                            setCancelLoading(false);
                            if (result.success) {
                              setRaces((prev) =>
                                prev.filter((r) => r.id !== race.id),
                              );
                            }
                            setCancellingId(null);
                          }}
                          disabled={cancelLoading}
                          className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {cancelLoading ? "..." : "Yes, Cancel"}
                        </button>
                        <button
                          onClick={() => setCancellingId(null)}
                          className="flex-1 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCancellingId(race.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-xl text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Cancel Registration
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyActiveRaces;
