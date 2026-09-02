import PageHeader from "@/components/page-header";
import LeaderboardPodium from "./component/leaderboard-podium";
import LeaderboardTable from "./component/leaderboard-table";
import { leaderboardData } from "@/data/leaderboard-data";
import { getLeaderboardPage } from "@/app/actions/main-actions";
import type { LeaderboardEntry } from "@/utils/types/leaderboard-types";

export default async function LeaderboardPage() {
  let entries: LeaderboardEntry[] = [];

  try {
    const result = await getLeaderboardPage(1, 10);

    if (result.data.length > 0) {
      entries = result.data;
    }
  } catch {
    // DB fetch failed — fall back to static data
  }

  if (entries.length === 0) {
    entries = leaderboardData.slice(0, 10);
  }

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3, 10);

  return (
    <div className="min-h-screen relative">
      <PageHeader
        title="Weekly Leaderboard"
        subtitle="Top runners this week — track your rank and outpace the competition."
      />

      {/* Podium — keeps a dark backdrop so the white podium text stays legible.
          Hidden entirely when there aren't enough runners to fill a podium. */}
      {topThree.length === 3 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-[#1A1A1A] dark:bg-[#0D0D0D] rounded-2xl overflow-hidden pt-8 px-4 sm:px-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-[var(--brand)]/12 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[var(--brand-soft)]/10 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <LeaderboardPodium topThree={topThree} />
            </div>
          </div>
        </section>
      )}

      {/* Rankings Table — Top 10 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-raleway font-bold text-xl sm:text-2xl text-foreground mb-6">
          Top 10 Rankings
        </h2>
        <LeaderboardTable topThree={topThree} remaining={remaining} />
      </section>
    </div>
  );
}
