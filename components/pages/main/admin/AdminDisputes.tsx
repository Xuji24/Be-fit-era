"use client";

import { useState } from "react";
import { Check, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { AdminDispute } from "@/app/actions/dispute-actions";
import { resolveDispute, rejectDispute } from "@/app/actions/dispute-actions";

interface Props {
  disputes: AdminDispute[];
}

export default function AdminDisputesPage({ disputes: initialDisputes }: Props) {
  const [disputes, setDisputes] = useState(initialDisputes);

  const handleResolve = async (id: string) => {
    const res = await resolveDispute(id);
    if (res.success) {
      toast.success("Dispute resolved, activity flag removed.");
      setDisputes((prev) => prev.filter((d) => d.id !== id));
    } else {
      toast.error(res.error || "Failed to resolve dispute");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity? This will remove the distance from the runner's registration.")) return;
    
    const res = await rejectDispute(id);
    if (res.success) {
      toast.success("Activity deleted successfully.");
      setDisputes((prev) => prev.filter((d) => d.id !== id));
    } else {
      toast.error(res.error || "Failed to delete activity");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            Activity Disputes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Review and manage flagged activities from users.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Runner</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Race</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Activity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Reason</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No active disputes found.
                  </td>
                </tr>
              ) : (
                disputes.map((dispute) => (
                  <tr key={dispute.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                      {dispute.runner_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {dispute.race_title}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {dispute.distance_km} km
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {dispute.activity_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400 max-w-xs truncate" title={dispute.flag_reason || "Flagged"}>
                      {dispute.flag_reason || "Flagged"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleResolve(dispute.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Forgive / Unflag"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReject(dispute.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Activity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
