"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Mail, Save, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import PageHeader from "@/components/page-header";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // Fetch profile from profiles table
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .single();

      const fullName =
        profileData?.full_name || user.user_metadata?.full_name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      setProfile({
        firstName,
        lastName,
        email: user.email || "",
        username: profileData?.username || "",
      });

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleSave = () => {
    if (!user) return;

    startTransition(async () => {
      const supabase = createClient();
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          username: profile.username || null,
        })
        .eq("id", user.id);

      if (profileError) {
        toast.error("Failed to update profile. Please try again.");
        return;
      }

      await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      toast.success("Profile updated successfully.");
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-hover)]" />
      </div>
    );
  }

  const initial = (profile.firstName || profile.email || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <div>
      <div className="min-h-screen relative">
        {/* Hero Header */}
        <PageHeader
          icon={UserCircle}
          title="Profile"
          subtitle="Manage your personal information"
          maxWidthClassName="max-w-2xl"
        />

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">
          {/* Profile Card */}
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
            {/* Avatar Header */}
            <div className="bg-linear-to-r from-[var(--brand)] to-[var(--brand-soft)] p-6 sm:p-8 flex items-center gap-4">
              <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/30 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-[var(--brand-ink)] text-2xl sm:text-3xl font-bold font-raleway">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-raleway font-bold text-lg sm:text-xl text-[var(--brand-ink)] truncate">
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : "Set your name"}
                </h2>
                <p className="font-merriweather-sans text-sm text-[var(--brand-ink)]/70 truncate">
                  {profile.email}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-8 space-y-5">
              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                  <input
                    type="text"
                    aria-label="First Name"
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile({ ...profile, firstName: e.target.value })
                    }
                    placeholder="Enter your first name"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                  <input
                    type="text"
                    aria-label="Last Name"
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile({ ...profile, lastName: e.target.value })
                    }
                    placeholder="Enter your last name"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
                  />
                </div>
              </div>

              {/* Email — read-only */}
              <div>
                <label className="block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                  <input
                    type="email"
                    aria-label="Email"
                    title="Email address"
                    placeholder="your@email.com"
                    value={profile.email}
                    readOnly
                    disabled
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--surface-muted)]/60 dark:bg-[#2A2A2E]/60 text-sm text-foreground/50 border-0 outline-none cursor-not-allowed font-merriweather-sans"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-foreground/30 uppercase tracking-wider font-merriweather-sans">
                    Read only
                  </span>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                  Username
                </label>
                <input
                  type="text"
                  aria-label="Username"
                  value={profile.username}
                  onChange={(e) =>
                    setProfile({ ...profile, username: e.target.value })
                  }
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isPending}
                className="w-full py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-[var(--brand-ink)] text-sm font-semibold font-raleway transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
