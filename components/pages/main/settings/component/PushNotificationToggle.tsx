"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/lib/push/usePushNotifications";

export default function PushNotificationToggle() {
  const { supported, permission, subscribed, loading, toggle } = usePushNotifications();

  if (!supported) return null;

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-raleway font-bold text-base text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FF5733]" />
            Push Notifications
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-merriweather-sans">
            {permission === "denied"
              ? "Notifications are blocked. Enable them in your browser settings."
              : subscribed
                ? "You will receive push notifications from Be Fit Era."
                : "Get notified about race updates, community mentions, and more."}
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={loading || permission === "denied"}
          title={subscribed ? "Disable push notifications" : "Enable push notifications"}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-raleway font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            subscribed
              ? "bg-[#FF5733] text-white hover:bg-[#e04d2d]"
              : "bg-gray-100 dark:bg-zinc-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-zinc-700"
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : subscribed ? (
            <Bell className="w-4 h-4" />
          ) : (
            <BellOff className="w-4 h-4" />
          )}
          {loading ? "..." : subscribed ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}
