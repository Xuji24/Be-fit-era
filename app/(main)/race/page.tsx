import { createClient } from "@/lib/supabase/server";
import RacePage from "@/components/pages/main/race/RacePage";
import { racesData } from "@/data/races-data";
import type { RaceEvent } from "@/utils/types/race-types";

export default async function Race() {
  const supabase = await createClient();

  // Fetch races from DB, ordered by event_date ascending (upcoming first)
  const { data: dbRaces } = await supabase
    .from("races")
    .select(
      "id, title, organizer, description, full_description, category, target_distance_km, event_date, event_time, location, image_url, organizer_logo_url, max_participants, registration_open, registration_deadline, tshirt_design_url, medal_design_url, certificate_design_url",
    )
    .neq("status", "cancelled")
    .order("event_date", { ascending: true })
    .limit(50);

  // Get registration counts for the returned races
  const raceIds = (dbRaces ?? []).map((r) => r.id);
  let regCounts: Record<string, number> = {};

  if (raceIds.length > 0) {
    const { data: regs } = await supabase
      .from("race_registrations")
      .select("race_id")
      .in("race_id", raceIds);

    if (regs) {
      regCounts = regs.reduce<Record<string, number>>((acc, r) => {
        acc[r.race_id] = (acc[r.race_id] || 0) + 1;
        return acc;
      }, {});
    }
  }

  // Transform DB rows into RaceEvent[] compatible shape
  let races: RaceEvent[] = [];

  if (dbRaces && dbRaces.length > 0) {
    races = dbRaces.map((r, idx) => ({
      id: String(idx + 1),
      dbId: r.id,
      title: r.title,
      organizer: r.organizer ?? "Unknown",
      date: r.event_date
        ? new Date(r.event_date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "TBD",
      time: r.event_time
        ? new Date(`1970-01-01T${r.event_time}`).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "TBD",
      location: r.location ?? "TBD",
      category: r.category as RaceEvent["category"],
      description: r.description ?? "",
      fullDescription: r.full_description ?? r.description ?? "",
      image: r.image_url || "/Running.jpg",
      organizerLogo: r.organizer_logo_url || "/fitra-logo.png",
      participants: regCounts[r.id] ?? 0,
      maxParticipants: r.max_participants ?? 0,
      registrationOpen: r.registration_open ?? false,
      registrationDeadline: r.registration_deadline
        ? new Date(r.registration_deadline).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "TBD",
      rewards: {
        medal: {
          name: "Finisher's Medal",
          description: "Official finisher's medal for completing the race.",
        },
        eCertificate: {
          title: "Official Finisher's E-Certificate",
          description:
            "Digital certificate with your name and official race results.",
        },
      },
    }));
  }

  // Fallback to static data if no DB races
  if (races.length === 0) {
    races = racesData;
  }

  return <RacePage races={races} />;
}
