import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { racesData } from "@/data/races-data";
import RaceDetailPage from "@/components/pages/main/race/RaceDetailPage";
import { checkRaceRegistration } from "@/app/actions/main-actions";
import { createClient } from "@/lib/supabase/server";

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

  const { registered } = await checkRaceRegistration(race.dbId);

  // Check if the current user is the organizer of this race or an admin
  let isOrganizer = false;
  if (user) {
    const [{ data: dbRace }, { data: profile }] = await Promise.all([
      supabase
        .from("races")
        .select("organizer")
        .eq("id", race.dbId)
        .single(),
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
    ]);
    isOrganizer =
      dbRace?.organizer === user.id || profile?.role === "admin";
  }

  return (
    <RaceDetailPage
      race={race}
      initialRegistered={registered}
      isLoggedIn={!!user}
      isOrganizer={isOrganizer}
    />
  );
}
