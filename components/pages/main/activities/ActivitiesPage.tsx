"use client";

import { useState } from "react";
import PageHeader from "@/components/page-header";
import ActivityStats from "./component/activity-stats";
import WeeklySummary from "./component/weekly-summary";
import MyActiveRaces from "./component/my-active-races";
import LogActivityPanel from "./component/log-activity-panel";
import ActivityLog from "./component/activity-log";
import RaceProgressOverview from "./component/race-progress-overview";
import CompletedRaces from "./component/completed-races";
import type {
  JoinedRace,
  ActivityEntry,
  CompletedRace,
  WeeklyStat,
} from "@/data/activities-data";

interface QuickStats {
  totalLogged: number;
  activeCount: number;
  completedCount: number;
  streak: number;
}

interface ActivitiesPageProps {
  joinedRaces: JoinedRace[];
  activityLog: ActivityEntry[];
  completedRaces: CompletedRace[];
  weeklyData: WeeklyStat[];
  quickStats: QuickStats;
}

const ActivitiesPage = ({
  joinedRaces,
  activityLog,
  completedRaces,
  weeklyData,
  quickStats,
}: ActivitiesPageProps) => {
  const [logOpen, setLogOpen] = useState(false);
  const [selectedRaceId, setSelectedRaceId] = useState<string | undefined>();

  const inProgressRaces = joinedRaces.filter((r) => r.status === "in-progress");

  const handleLogDistance = (raceId: string) => {
    setSelectedRaceId(raceId);
    setLogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Activity Dashboard"
        subtitle="Track your workouts, log distances to your virtual races, and watch your progress grow."
        actions={
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground font-raleway">
                {quickStats.totalLogged}
              </p>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mt-1">
                km logged
              </p>
            </div>
            <div className="w-px bg-black/10 dark:bg-white/10" />
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground font-raleway">
                {quickStats.activeCount}
              </p>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mt-1">
                active races
              </p>
            </div>
            <div className="w-px bg-black/10 dark:bg-white/10" />
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-[var(--brand-hover)] font-raleway">
                {quickStats.streak}
              </p>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mt-1">
                day streak
              </p>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14 space-y-8">
        {/* Quick Stats: plain top strip */}
        <ActivityStats stats={quickStats} />

        {/* 2:1 dashboard split, matching ProgressPage/TrackerPage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column: active content */}
          <div className="lg:col-span-2 space-y-8">
            <WeeklySummary data={weeklyData} />
            <RaceProgressOverview
              joinedRaces={joinedRaces}
              weeklyData={weeklyData}
            />
            <ActivityLog entries={activityLog} />
          </div>

          {/* Secondary column: the one history list */}
          <div className="lg:col-span-1">
            <MyActiveRaces
              races={joinedRaces}
              onLogDistance={handleLogDistance}
            />
          </div>
        </div>

        {/* Completed Races */}
        <CompletedRaces races={completedRaces} />
      </section>

      {/* Log Activity Modal */}
      <LogActivityPanel
        open={logOpen}
        preselectedRaceId={selectedRaceId}
        inProgressRaces={inProgressRaces}
        onClose={() => {
          setLogOpen(false);
          setSelectedRaceId(undefined);
        }}
      />
    </div>
  );
};

export default ActivitiesPage;
