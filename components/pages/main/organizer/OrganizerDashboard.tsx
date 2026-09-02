"use client";

import { useState } from "react";
import {
  Plus,
  Trophy,
  Users,
  Calendar,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Shirt,
  Medal,
  Award,
  Ban,
} from "lucide-react";
import PageHeader from "@/components/page-header";
import CreateRaceModal from "./component/create-race-modal";
import EditRaceDesignsModal from "./component/edit-race-designs-modal";
import EditRaceModal from "./component/edit-race-modal";
import CancelRaceModal from "./component/cancel-race-modal";

export interface OrganizerRace {
  id: string;
  title: string;
  category: string;
  targetDistance: number;
  eventDate: string | null;
  imageUrl: string | null;
  registrationOpen: boolean;
  maxParticipants: number | null;
  registrationCount: number;
  tshirtDesignUrl: string | null;
  medalDesignUrl: string | null;
  certificateDesignUrl: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  races: OrganizerRace[];
}

export default function OrganizerDashboard({ races: initialRaces }: Props) {
  const [races, setRaces] = useState(initialRaces);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<OrganizerRace | null>(null);
  const [editingRaceDetail, setEditingRaceDetail] =
    useState<OrganizerRace | null>(null);
  const [cancellingRace, setCancellingRace] = useState<OrganizerRace | null>(
    null,
  );

  const totalRegistrations = races.reduce(
    (sum, r) => sum + r.registrationCount,
    0,
  );

  const handleRaceCreated = (newRace: OrganizerRace) => {
    setRaces((prev) => [newRace, ...prev]);
    setCreateOpen(false);
  };

  const handleDesignsUpdated = (
    raceId: string,
    updates: {
      tshirtDesignUrl?: string | null;
      medalDesignUrl?: string | null;
      certificateDesignUrl?: string | null;
    },
  ) => {
    setRaces((prev) =>
      prev.map((r) => (r.id === raceId ? { ...r, ...updates } : r)),
    );
    setEditingRace(null);
  };

  return (
    <div className="min-h-screen relative">
      <PageHeader
        title="Race Management"
        subtitle="Create and manage your virtual races. Track registrations and monitor your events."
        actions={
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground font-raleway">
                {races.length}
              </p>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mt-1">
                Races
              </p>
            </div>
            <div className="w-px bg-black/10 dark:bg-white/10" />
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-amber-500 font-raleway">
                {totalRegistrations}
              </p>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mt-1">
                Registrations
              </p>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold text-foreground font-raleway">
            Your Races
          </h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Race
          </button>
        </div>

        {/* Race Cards */}
        {races.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 p-12 text-center">
            <Trophy className="w-10 h-10 text-amber-500/40 mx-auto mb-4" />
            <h3 className="font-raleway font-bold text-base text-foreground mb-2">
              No Races Yet
            </h3>
            <p className="text-sm text-foreground/50 font-merriweather-sans mb-6 max-w-sm mx-auto">
              Create your first virtual race and start accepting registrations
              from runners.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Your First Race
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {races.map((race) => (
              <div
                key={race.id}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden hover:border-amber-500/20 transition-all"
              >
                {/* Image placeholder */}
                <div className="h-32 bg-linear-to-br from-[var(--brand)]/20 to-amber-500/20 dark:from-[var(--brand)]/10 dark:to-amber-500/10 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-[var(--brand-hover)]/40" />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-raleway font-bold text-sm text-foreground truncate">
                        {race.title}
                      </h3>
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand-hover)]">
                        {race.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {race.registrationOpen ? (
                        <ToggleRight className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-foreground/30" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-foreground/60">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{race.targetDistance} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {race.eventDate
                          ? new Date(race.eventDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "Date TBD"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {race.registrationCount}
                        {race.maxParticipants
                          ? ` / ${race.maxParticipants}`
                          : ""}{" "}
                        registered
                      </span>
                    </div>
                  </div>

                  {/* Design status indicators */}
                  <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shirt
                          className={`w-3.5 h-3.5 ${race.tshirtDesignUrl ? "text-emerald-500" : "text-foreground/20"}`}
                        />
                        <Medal
                          className={`w-3.5 h-3.5 ${race.medalDesignUrl ? "text-emerald-500" : "text-foreground/20"}`}
                        />
                        <Award
                          className={`w-3.5 h-3.5 ${race.certificateDesignUrl ? "text-emerald-500" : "text-foreground/20"}`}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditingRaceDetail(race)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => setEditingRace(race)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-hover)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Designs
                        </button>
                        <button
                          onClick={() => setCancellingRace(race)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Race Modal */}
      <CreateRaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleRaceCreated}
      />

      {/* Edit Race Designs Modal */}
      {editingRace && (
        <EditRaceDesignsModal
          race={editingRace}
          onClose={() => setEditingRace(null)}
          onUpdated={handleDesignsUpdated}
        />
      )}

      {/* Edit Race Details Modal */}
      {editingRaceDetail && (
        <EditRaceModal
          open={!!editingRaceDetail}
          onClose={() => setEditingRaceDetail(null)}
          raceToEdit={editingRaceDetail!}
          onUpdated={(updatedRace) => {
            setRaces((prev) =>
              prev.map((r) =>
                r.id === updatedRace.id ? { ...r, ...updatedRace } : r,
              ),
            );
            setEditingRaceDetail(null);
          }}
        />
      )}

      {/* Cancel Race Modal */}
      {cancellingRace && (
        <CancelRaceModal
          raceId={cancellingRace.id}
          raceTitle={cancellingRace.title}
          onClose={() => setCancellingRace(null)}
          onCancelled={() => {
            setRaces((prev) => prev.filter((r) => r.id !== cancellingRace.id));
            setCancellingRace(null);
          }}
        />
      )}
    </div>
  );
}
