"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Activity, Award, Users, Bot } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/race", label: "Race", icon: Trophy, exact: false },
  { href: "/activities", label: "Activities", icon: Activity, exact: false },
  { href: "/coach", label: "Coach", icon: Bot, exact: false },
  { href: "/leaderboard", label: "Ranks", icon: Award, exact: false },
  { href: "/community", label: "Community", icon: Users, exact: false },
] as const;

// The coach chat is a viewport-locked layout (h-screen/100dvh math with its
// own fixed input bar) — a persistent bottom bar there would eat into space
// it's already accounted for exactly, so this pattern sits out of /coach.
function isCoachRoute(pathname: string) {
  return pathname === "/coach" || pathname.startsWith("/coach/");
}

export function MobileBottomNav() {
  const pathname = usePathname();
  if (isCoachRoute(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around bg-background/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 transition-colors ${
              isActive
                ? "text-[var(--brand-hover)]"
                : "text-foreground/50 hover:text-foreground/80"
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="font-raleway text-[10px] font-semibold truncate max-w-full px-0.5">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// Keeps page content (and the real footer) from being permanently hidden
// behind the fixed bar above — same route exemption as the nav itself.
export function MobileBottomNavSpacer() {
  const pathname = usePathname();
  if (isCoachRoute(pathname)) return null;
  return <div className="h-16 lg:hidden" aria-hidden="true" />;
}
