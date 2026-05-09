"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Activity as ActivityIcon, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { toast } from "sonner";
import { getRecentActivitiesForRace, flagActivity } from "@/app/actions/main-actions";

interface Props {
  raceDbId: string;
}

interface ActivityEntry {
  id: string;
  runner_name: string;
  avatar?: string | null;
  created_at: string;
  activity_type: string;
  distance_km: number;
  source?: string | null;
}

export default function RaceRecentActivities({ raceDbId }: Props) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      const res = await getRecentActivitiesForRace(raceDbId);
      if (res.success && res.data) {
        setActivities(res.data as ActivityEntry[]);
      }
      setLoading(false);
    }
    load();
  }, [raceDbId]);

  const handleReport = async () => {
    if (!selectedActivity || !flagReason.trim()) return;
    
    setSubmitting(true);
    const res = await flagActivity(selectedActivity, flagReason);
    setSubmitting(false);

    if (res.success) {
      toast.success("Activity reported. Thank you for keeping the community fair.");
      setSelectedActivity(null);
      setFlagReason("");
    } else {
      toast.error(res.error || "Failed to report activity");
    }
  };

  if (loading) return <div className="text-center py-6 text-gray-500 dark:text-gray-400">Loading activities...</div>;

  if (activities.length === 0) return (
    <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
      <ActivityIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activities for this race yet.</p>
    </div>
  );

  return (
    <div className="space-y-4 shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-6">
      <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
        <ActivityIcon className="w-5 h-5 text-sera-orange" />
        Live Feed
      </h3>
      
      <div className="space-y-4 max-h-125 overflow-y-auto pr-2 custom-scrollbar">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 items-start p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors border border-gray-50 dark:border-zinc-800/50">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 flex items-center justify-center overflow-hidden shrink-0">
              {activity.avatar ? (
                <img src={activity.avatar} alt={activity.runner_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 dark:text-gray-300 font-bold">{activity.runner_name.charAt(0)}</span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {activity.runner_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedActivity(activity.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 group"
                  title="Report suspicious activity"
                >
                  <AlertCircle className="w-3 h-3 group-hover:fill-red-500/20" />
                  <span>Report</span>
                </button>
              </div>
              
              <div className="mt-2 bg-gray-50 dark:bg-zinc-800/80 p-3 rounded-lg flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold capitalize text-sera-orange">
                    {activity.activity_type}
                  </p>
                  <p className="text-2xl font-bold font-mono tracking-tight dark:text-white">
                    {activity.distance_km} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">km</span>
                  </p>
                </div>
                {activity.source === 'strava' && (
                  <div className="text-xs font-semibold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                    STRAVA
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold dark:text-white">Report Suspicious Activity</h4>
              <button title="Close" onClick={() => setSelectedActivity(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              If this run seems mathematically impossible or looks fabricated, let us know. Our admins will review this entry.
            </p>
            <textarea
              placeholder="E.g. Pace is faster than a motorcycle..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sera-orange mb-4 min-h-25"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedActivity(null)}>Cancel</Button>
              <Button disabled={submitting || !flagReason.trim()} onClick={handleReport} className="bg-red-600 hover:bg-red-700 text-white">
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
