"use client";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Logo from "@/components/logo";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import ProfileDropdown from "@/components/profile-dropdown";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("runner");
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Condenses to a glass surface once there's page content to distinguish
    // it from — flat and blend-in at the very top, where it's the first
    // thing on the page anyway.
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadRole(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      setUserRole(data?.role ?? "runner");
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) await loadRole(user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        loadRole(nextUser.id);
      } else {
        setUserRole("runner");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const closeMobileMenu = () => setIsOpen(false);

  return (
    <nav
      className={`w-full sticky top-0 z-50 px-4 sm:px-6 lg:p-8 py-3 sm:py-4 flex items-center justify-between lg:justify-start gap-4 lg:gap-10 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "bg-background/75 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-background border-b border-transparent"
      }`}
    >
      <div className="w-40 sm:w-24 lg:w-52 lg:ml-10 shrink-0 absolute left-4 lg:left-0">
        <Logo />
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex items-center space-x-6 lg:space-x-10 flex-1 justify-end">
        <Link
          href="/"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Home
        </Link>
        <Link
          href="/race"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Race
        </Link>
        <Link
          href="/activities"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Activities
        </Link>
        <Link
          href="/leaderboard"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Leaderboard
        </Link>
        <Link
          href="/community"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Community
        </Link>
        {user && (
          <Link
            href="/coach"
            className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
          >
            AI Coach
          </Link>
        )}
        <Link
          href="/contact"
          className="font-raleway font-bold text-sm lg:text-base text-foreground hover:text-[#FF5733] transition-colors"
        >
          Contact
        </Link>

        {/* Organizer link — only for organizer/admin */}
        {(userRole === "organizer" || userRole === "admin") && (
          <Link
            href="/organizer"
            className="font-raleway font-bold text-sm lg:text-base text-[#FFB800] hover:text-[#FF5733] transition-colors"
          >
            Organizer
          </Link>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Desktop Auth — Profile Dropdown or Sign In */}
        <div className="hidden lg:block shrink-0">
          {loading ? (
            <div className="w-20 h-10 rounded-full bg-[#F5F5F0] dark:bg-[#2A2A2E] animate-pulse" />
          ) : user ? (
            <ProfileDropdown user={user} />
          ) : (
            <Link
              href="/login"
              className="font-raleway font-bold text-sm sm:text-base bg-[#FF5733] text-white hover:bg-[#E84E2E] transition-colors px-6 sm:px-8 py-2 sm:py-3 rounded-full cursor-pointer"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden text-foreground hover:text-[#FF5733] transition-colors ml-auto"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu Dropdown. max-h + scroll because on a viewport-locked
          page (the coach chat) the document can't scroll, so a dropdown taller
          than the remaining viewport would have unreachable links. */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 max-h-[calc(100dvh-100%)] overflow-y-auto overscroll-contain custom-scrollbar bg-[#1A1A1A]/85 dark:bg-[#0D0D0D]/85 backdrop-blur-xl lg:hidden flex flex-col px-4 py-4 space-y-3 border-t border-[#FF5733]/20 shadow-2xl z-50">
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Home
          </Link>
          <Link
            href="/race"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Race
          </Link>
          <Link
            href="/activities"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Activities
          </Link>
          <Link
            href="/leaderboard"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Leaderboard
          </Link>
          <Link
            href="/community"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Community
          </Link>
          {user && (
            <Link
              href="/coach"
              onClick={closeMobileMenu}
              className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
            >
              AI Coach
            </Link>
          )}
          <Link
            href="/contact"
            onClick={closeMobileMenu}
            className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
          >
            Contact
          </Link>
          {/* Organizer link — only for organizer/admin */}
          {(userRole === "organizer" || userRole === "admin") && (
            <Link
              href="/organizer"
              onClick={closeMobileMenu}
              className="font-raleway font-bold text-sm text-[#FFB800] hover:text-[#FF5733] transition-colors py-2"
            >
              Organizer
            </Link>
          )}
          <div className="flex items-center gap-3 py-2">
            <ThemeToggle />
            <span className="font-raleway font-bold text-sm text-white">
              Theme
            </span>
          </div>
          {user ? (
            <>
              <div className="border-t border-[#FF5733]/20 pt-3 mt-1">
                <div className="flex items-center gap-3 py-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-[#FF5733] flex items-center justify-center text-white text-sm font-bold font-raleway">
                    {(
                      user.user_metadata?.full_name ||
                      user.user_metadata?.name ||
                      user.email?.split("@")[0] ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-raleway font-semibold text-sm text-white truncate">
                      {user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        user.email?.split("@")[0]}
                    </p>
                    <p className="font-merriweather-sans text-[11px] text-white/40 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={closeMobileMenu}
                  className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2 block"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={closeMobileMenu}
                  className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2 block"
                >
                  Settings
                </Link>
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setIsOpen(false);
                    window.location.href = "/login";
                  }}
                  className="font-raleway font-bold text-sm text-red-400 hover:text-red-300 transition-colors py-2 block w-full text-left cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              onClick={closeMobileMenu}
              className="font-raleway font-bold text-sm text-white hover:text-[#FF5733] transition-colors py-2"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
