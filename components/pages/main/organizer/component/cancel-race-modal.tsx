"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cancelRace } from "@/app/actions/main-actions";

interface Props {
  raceId: string;
  raceTitle: string;
  onClose: () => void;
  onCancelled: () => void;
}

export default function CancelRaceModal({
  raceId,
  raceTitle,
  onClose,
  onCancelled,
}: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    if (reason.trim().length < 10) {
      setError("Please provide a reason (at least 10 characters).");
      return;
    }

    setLoading(true);
    setError("");
    const result = await cancelRace(raceId, reason.trim());
    setLoading(false);

    if (result.success) {
      onCancelled();
    } else {
      setError(result.error ?? "Failed to cancel race.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="font-raleway font-bold text-lg text-foreground">
              Cancel Race
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4">
            <p className="text-sm text-red-800 dark:text-red-300">
              You are about to cancel{" "}
              <span className="font-bold">&quot;{raceTitle}&quot;</span>. This
              will also cancel all active registrations. This action cannot be
              undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Cancellation Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this race is being cancelled..."
              className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-20 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-zinc-700">
          <Button
            onClick={onClose}
            variant="outline"
            className="cursor-pointer"
          >
            Keep Race
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            {loading ? "Cancelling..." : "Cancel Race"}
          </Button>
        </div>
      </div>
    </div>
  );
}
