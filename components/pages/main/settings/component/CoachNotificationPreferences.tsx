"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/app/actions/coach-notification-actions";

const ROWS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    description: "A Monday summary of the week's logging and workouts.",
  },
  {
    key: "streakNudge",
    label: "Streak nudges",
    description: "A nudge after a few quiet days, so your plan doesn't go stale.",
  },
  {
    key: "emailEnabled",
    label: "Email channel",
    description: "Send the above by email too, not just push.",
  },
];

export default function CoachNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
  }, []);

  async function handleToggle(key: keyof NotificationPreferences) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingKey(key);

    const result = await updateNotificationPreferences(next);
    setSavingKey(null);
    if (!result.success) {
      setPrefs(prefs);
      toast.error(result.error ?? "Failed to save your preference.");
    }
  }

  if (!prefs) return null;

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="font-raleway font-bold text-base text-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[var(--brand-hover)]" />
        Coach notifications
      </h3>
      <p className="text-sm text-muted-foreground mt-1 font-merriweather-sans">
        Proactive check-ins from your AI coach, on top of your push notification setting above.
      </p>

      <div className="mt-4 space-y-3">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground font-raleway">{row.label}</p>
              <p className="text-xs text-muted-foreground font-merriweather-sans">{row.description}</p>
            </div>
            <button
              onClick={() => handleToggle(row.key)}
              disabled={savingKey === row.key}
              role="switch"
              aria-checked={prefs[row.key]}
              aria-label={row.label}
              className={`relative w-11 h-6 rounded-full shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                prefs[row.key] ? "bg-(--brand)" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  prefs[row.key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
