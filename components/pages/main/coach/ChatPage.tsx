"use client";

import { useState, useEffect, useLayoutEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowDown, Loader2, MessageCircle, Send } from "lucide-react";
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
  sources?: { slug: string; title: string }[];
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
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * Is the user reading the latest messages, or scrolled up into history?
   * A ref, not state: it's written on every scroll frame, and re-rendering
   * the whole message list mid-drag would be visibly janky.
   */
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

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
  // messaging without re-clicking the input. preventScroll because focusing
  // an element can itself scroll an ancestor into view.
  useEffect(() => {
    if (!isSending) inputRef.current?.focus({ preventScroll: true });
  }, [isSending]);

  /**
   * Auto-scroll lives here rather than in the message list because the page
   * now has a real inner scroll container. An earlier version used
   * scrollIntoView and had to be removed: it walks the ancestor chain and
   * scrolls EVERY scrollable ancestor including the document, which is what
   * made Enter feel like it yanked the whole page. Assigning scrollTop on one
   * specific element cannot reach the document, so that failure mode is gone.
   *
   * All automatic jumps are instant. Deliberately no `scroll-behavior: smooth`
   * on the container — it would silently animate these programmatic writes
   * with no way to opt out per call, and an animation on every message is both
   * a vestibular trigger and visibly laggy when several land at once.
   */
  const PIN_THRESHOLD_PX = 64;

  function scrollToLatest() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function handleListScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom < PIN_THRESHOLD_PX;
    pinnedRef.current = pinned;
    // Only touch state when the boundary is actually crossed.
    setShowJump((prev) => (prev === !pinned ? prev : !pinned));
  }

  // History just loaded: land at the bottom before paint, so a long history
  // doesn't visibly flash past from the top.
  useLayoutEffect(() => {
    if (!loading) scrollToLatest();
  }, [loading]);

  // New content. isSending is in the deps because the typing indicator is a
  // real node that changes scrollHeight — without it the indicator renders
  // just below the fold. Never scrolls a user who has chosen to read history.
  useEffect(() => {
    if (pinnedRef.current) scrollToLatest();
  }, [messages, isSending]);

  function jumpToLatest() {
    pinnedRef.current = true;
    setShowJump(false);
    scrollToLatest();
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || outOfChat) return;

    // Sending is an unambiguous "take me to the bottom", even if they were
    // reading history. Set before the append so the effect below acts on it.
    pinnedRef.current = true;
    setShowJump(false);

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

        setMessages((prev) => [
          ...prev,
          { id: `reply-${Date.now()}`, role: "assistant", content: data.reply, sources: data.sources },
        ]);
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

  // Same locked shell as the loaded state, so there's no layout jump on load.
  if (loading) {
    return (
      <div
        data-app-shell="locked"
        className="flex-1 min-h-0 bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  return (
    /* Viewport-locked: body is a flex column (see app/globals.css) so this
       takes exactly the height left under the navbar, and the composer sits
       at the bottom of the visible area rather than wherever the message list
       happens to end. min-h-0 repeats down every wrapper to the scroll
       container — a flex item's default min-height:auto refuses to shrink
       below its content, which is what makes an inner scrollbox not scroll. */
    <div
      data-app-shell="locked"
      className="flex-1 min-h-0 flex flex-col bg-[#FAFAF8] dark:bg-[#121212]"
    >
      <CoachHero
        icon={MessageCircle}
        title="Ask Your Coach"
        maxWidthClassName="max-w-6xl"
        actions={
          access ? (
            // The sidebar carrying this number is hidden below lg, so the one
            // figure that actually gates the user surfaces here instead.
            <span className="shrink-0 text-xs font-merriweather-sans text-[#1A1A1A]/50 dark:text-white/50 lg:hidden">
              {access.chatQuota.remaining}/{access.chatQuota.limit} left
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-6 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 max-w-2xl w-full min-h-0 flex flex-col">
          <div
            ref={listRef}
            onScroll={handleListScroll}
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar space-y-3 py-2 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5733]/40 rounded-lg"
          >
            {messages.length === 0 && (
              <p className="text-sm text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans text-center py-8">
                Ask about your plan, food, or workouts.
              </p>
            )}
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} role={m.role} content={m.content} sources={m.sources} />
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-[#F5F5F0] dark:bg-[#2A2A2E] px-3.5 py-2 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A1A1A]/40 dark:text-white/40" />
                  <span className="sr-only">Coach is typing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Composer is simply the last flex child now — no sticky, and no
              background patch (that only existed to mask messages scrolling
              underneath it). */}
          <div className="shrink-0 relative mt-3">
            {showJump && (
              <button
                onClick={jumpToLatest}
                className="absolute -top-11 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#2A2A2E] border border-black/5 dark:border-white/10 shadow-sm text-xs font-semibold font-raleway text-[#1A1A1A]/70 dark:text-white/70 hover:text-[#FF5733] transition-colors cursor-pointer"
              >
                <ArrowDown className="w-3 h-3" />
                Jump to latest
              </button>
            )}
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

        {/* Hidden below lg: in a 1-column grid inside an overflow-hidden shell
            this would be clipped and unreachable. Nothing is lost — the quota
            is in the hero and the composer placeholder, and Quick links
            duplicates the navbar. */}
        <aside className="hidden lg:flex lg:col-span-1 min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain custom-scrollbar pr-1">
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
        </aside>
      </div>
    </div>
  );
}
