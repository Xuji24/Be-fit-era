import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { racesData } from "@/data/races-data";
import RaceDetailPage from "@/components/pages/main/race/RaceDetailPage";
import { checkRaceRegistration } from "@/app/actions/main-actions";
import { createClient } from "@/lib/supabase/server";
import { geocodeOne } from "@/lib/geocode";

interface Props {
  params: Promise<{ id: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.befitra.app";

export function generateStaticParams() {
  return racesData.map((race) => ({ id: race.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const race = racesData.find((r) => r.id === id);

  if (!race) {
    return { title: "Race Not Found | Fitra" };
  }

  const pageUrl = `${siteUrl}/race/${race.id}`;
  const rawImage = race.image.startsWith("http")
    ? race.image
    : `${siteUrl}${race.image}`;

  // Dynamic branded OG image (shows race photo + title + date + location + Fitra logo)
  const ogImageUrl = `${siteUrl}/api/og/race?${new URLSearchParams({
    title: race.title,
    date: race.date,
    location: race.location,
    category: race.category,
    image: rawImage,
  }).toString()}`;

  return {
    title: `${race.title} | Fitra`,
    description: race.description,
    openGraph: {
      title: race.title,
      description: `${race.description} — ${race.date} at ${race.location}`,
      url: pageUrl,
      siteName: "Fitra",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: race.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: race.title,
      description: `${race.description} — ${race.date} at ${race.location}`,
      images: [ogImageUrl],
    },
  };
}

export default async function RaceDetail({ params }: Props) {
  const { id } = await params;
  const race = racesData.find((r) => r.id === id);

  if (!race) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ registered }, { data: dbRace }, regCountResult] =
    await Promise.all([
      checkRaceRegistration(race.dbId),
      supabase
        .from("races")
        .select(
          "organizer, title, description, full_description, category, event_date, event_time, location, latitude, longitude, location_approximate, image_url, organizer_logo_url, max_participants, registration_open, registration_deadline, registration_fee, cutoff_time_minutes, kit_pickup_info, inclusions, gpx_url",
        )
        .eq("id", race.dbId)
        .single(),
      supabase
        .from("race_registrations")
        .select("*", { count: "exact", head: true })
        .eq("race_id", race.dbId),
    ]);

  let isOrganizer = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isOrganizer =
      dbRace?.organizer === user.id || profile?.role === "admin";
  }

  // Merge DB data over static fallback — DB wins when present
  const raceWithLiveData = {
    ...race,
    ...(dbRace && {
      title: dbRace.title ?? race.title,
      description: dbRace.description ?? race.description,
      fullDescription: dbRace.full_description ?? race.fullDescription,
      category: (dbRace.category as typeof race.category) ?? race.category,
      date: dbRace.event_date
        ? new Date(dbRace.event_date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : race.date,
      time: dbRace.event_time
        ? new Date(`1970-01-01T${dbRace.event_time}`).toLocaleTimeString(
            "en-US",
            { hour: "numeric", minute: "2-digit", hour12: true },
          )
        : race.time,
      location: dbRace.location ?? race.location,
      latitude: dbRace.latitude,
      longitude: dbRace.longitude,
      approximateLocation: dbRace.location_approximate ?? false,
      image: dbRace.image_url || race.image,
      organizerLogo: dbRace.organizer_logo_url || race.organizerLogo,
      maxParticipants: dbRace.max_participants ?? race.maxParticipants,
      registrationOpen: dbRace.registration_open ?? race.registrationOpen,
      registrationDeadline: dbRace.registration_deadline
        ? new Date(dbRace.registration_deadline).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : race.registrationDeadline,
      registrationFee: Number(dbRace.registration_fee ?? 0),
      cutoffTimeMinutes: dbRace.cutoff_time_minutes ?? race.cutoffTimeMinutes,
      kitPickupInfo: dbRace.kit_pickup_info ?? race.kitPickupInfo,
      inclusions: (dbRace.inclusions as string[] | null) ?? race.inclusions,
      gpxUrl: dbRace.gpx_url ?? race.gpxUrl,
    }),
    participants: regCountResult.count ?? race.participants,
  };

  // Organizers aren't required to drop a pin, so fall back to geocoding the
  // location text — every race with a location still gets a map. Geocoding
  // resolves to a town/city centre, not the start line, so flag it as
  // approximate rather than presenting it as an exact position.
  if (
    typeof raceWithLiveData.latitude !== "number" ||
    typeof raceWithLiveData.longitude !== "number"
  ) {
    const coords = await geocodeOne(raceWithLiveData.location);
    if (coords) {
      raceWithLiveData.latitude = coords.lat;
      raceWithLiveData.longitude = coords.lng;
      raceWithLiveData.approximateLocation = true;
    }
  }

  return (
    <RaceDetailPage
      race={raceWithLiveData}
      initialRegistered={registered}
      isLoggedIn={!!user}
      isOrganizer={isOrganizer}
    />
  );
}
