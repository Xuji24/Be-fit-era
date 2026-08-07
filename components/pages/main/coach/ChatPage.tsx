"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getChatHistory, type ChatMessageRow } from "@/app/actions/coach-chat-actions";
import { getCoachAccess, type CoachAccess } from "@/app/actions/coach-actions";
import { startFreeTrial } from "@/app/actions/coach-subscription-actions";
import ChatMessageBubble from "./component/chat-message";
import CoachHero from "./component/coach-hero";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [outOfChat, setOutOfChat] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [tier, setTier] = useState<string>("free");
  const [access, setAccess] = useState<CoachAccess | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      let access = await getCoachAccess();
      if (!access.hasProfile) {
        router.push("/coach/onboarding");
        return;
      }

      // Onboarded but no trial row yet — start it instead of dead-ending on
      // the pricing page. See CoachDashboardPage for the same recovery.
      if (access.deniedReason === "not_started") {
        const started = await startFreeTrial();
        if (!started.success) {
          router.replace("/coach/subscribe");
          return;
        }
        access = await getCoachAccess();
      }

      // No subscription and no trial left — the chat isn't theirs to use.
      // The subscribe page explains why; no toast (see CoachDashboardPage).
      if (!access.hasAccess) {
        router.replace("/coach/subscribe");
        return;
      }

      setOutOfChat(access.outOfChat);
      setRemaining(access.chatQuota.remaining);
      setTier(access.tier);
      setAccess(access);

      const history = await getChatHistory();
      setMessages(history.filter((m): m is ChatMessageRow & { role: "user" | "assistant" } => m.role !== "system"));
      setLoading(false);
    }
    load();
  }, [router]);

  // Keep focus in the composer after a send so a fast typist can keep
  // messaging without re-clicking the input. No auto-scroll here on purpose:
  // the composer is pinned to the bottom of the viewport, so a new message
  // appears right above it already in view — forcing a page scroll on every
  // send was the bug (scrollIntoView drags ancestor scroll containers, not
  // just the message list, which is what made Enter feel like it yanked the
  // whole page down).
  useEffect(() => {
    if (!isSending) inputRef.current?.focus();
  }, [isSending]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || outOfChat) return;

    const optimisticId = `pending-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text }]);
    setInput("");
    setIsSending(true);

    startTransition(async () => {
      try {
        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();

        if (!res.ok) {
          // 402 = allowance spent. Lock the composer so the next attempt is
          // stopped here rather than making another round trip.
          if (res.status === 402 || data.quotaExhausted) {
            setOutOfChat(true);
            setRemaining(0);
          }
          toast.error(data.error ?? "Something went wrong.");
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          return;
        }

        setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: "assistant", content: data.reply }]);
        setRemaining((prev) => {
          if (prev === null) return prev;
          const next = Math.max(0, prev - 1);
          if (next === 0) setOutOfChat(true);
          return next;
        });
      } catch {
        toast.error("Failed to send message.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setIsSending(false);
      }
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      <CoachHero icon={MessageCircle} title="Ask Your Coach" />

      <div className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 max-w-2xl w-full flex flex-col">
          {/* Messages flow with the page — no inner scrollbox, no floating card. */}
          <div className="space-y-3 py-2">
            {messages.length === 0 && (
              <p className="text-sm text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans text-center py-8">
                Ask about your plan, food, or workouts.
              </p>
            )}
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-[#F5F5F0] dark:bg-[#2A2A2E] px-3.5 py-2 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A1A1A]/40 dark:text-white/40" />
                </div>
              </div>
            )}
          </div>

          {/* Sticky composer: stays reachable at the bottom of the viewport
              without needing its own scroll container. */}
          <div className="sticky bottom-0 mt-4 bg-[#FAFAF8] dark:bg-[#121212] pt-3 pb-1">
            {outOfChat ? (
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 text-center space-y-3">
                <p className="text-sm text-[#1A1A1A]/70 dark:text-white/70 font-merriweather-sans">
                  {tier === "free"
                    ? "You've used all your free coach messages. Your plan, tracker, and progress still work."
                    : "You've used all your coach messages for today. They reset tomorrow."}
                </p>
                <Link
                  href="/coach/subscribe"
                  className="inline-flex px-6 py-2.5 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] text-white text-sm font-semibold font-raleway transition-colors"
                >
                  {tier === "free" ? "Subscribe to continue" : "Upgrade for more"}
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-3 flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    remaining !== null && remaining <= 5
                      ? `${remaining} message${remaining === 1 ? "" : "s"} left…`
                      : "Ask a question…"
                  }
                  maxLength={1000}
                  disabled={isSending || isPending}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSending || isPending || !input.trim()}
                  className="shrink-0 w-10 h-10 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] disabled:opacity-50 text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          {access && (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">
                Your coach status
              </h2>
              <div className="flex items-center justify-between text-sm font-merriweather-sans">
                <span className="text-[#1A1A1A]/50 dark:text-white/50">Plan</span>
                <span className="text-[#1A1A1A] dark:text-white font-semibold capitalize">
                  {access.tier === "free" ? "Free trial" : access.tier}
                </span>
              </div>
              {access.status === "trialing" && access.trialDaysLeft !== null && (
                <div className="flex items-center justify-between text-sm font-merriweather-sans">
                  <span className="text-[#1A1A1A]/50 dark:text-white/50">Trial ends</span>
                  <span className="text-[#1A1A1A] dark:text-white font-semibold">
                    {access.trialDaysLeft === 0 ? "Today" : `${access.trialDaysLeft}d left`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-merriweather-sans">
                <span className="text-[#1A1A1A]/50 dark:text-white/50">Messages left</span>
                <span className="text-[#1A1A1A] dark:text-white font-semibold">
                  {access.chatQuota.remaining} / {access.chatQuota.limit}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-merriweather-sans">
                <span className="text-[#1A1A1A]/50 dark:text-white/50">Plans left</span>
                <span className="text-[#1A1A1A] dark:text-white font-semibold">
                  {access.planQuota.remaining} / {access.planQuota.limit}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-5 space-y-2">
            <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway mb-1">
              Quick links
            </h2>
            <Link
              href="/coach/planner"
              className="block text-sm text-[#1A1A1A]/70 dark:text-white/70 hover:text-[#FF5733] font-merriweather-sans transition-colors"
            >
              View your plan
            </Link>
            <Link
              href="/coach/tracker"
              className="block text-sm text-[#1A1A1A]/70 dark:text-white/70 hover:text-[#FF5733] font-merriweather-sans transition-colors"
            >
              Log today&apos;s food
            </Link>
            <Link
              href="/coach/progress"
              className="block text-sm text-[#1A1A1A]/70 dark:text-white/70 hover:text-[#FF5733] font-merriweather-sans transition-colors"
            >
              Check your progress
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
