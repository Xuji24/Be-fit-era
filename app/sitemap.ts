import type { MetadataRoute } from "next";
import { racesData } from "@/data/races-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fitra.vercel.app";

// Race detail pages only resolve ids present in data/races-data.ts (see
// app/(main)/race/[id]/page.tsx) — this mirrors that same set rather than
// querying Supabase directly, since routes outside it 404 regardless.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/race`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/leaderboard`, changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/community`, changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const raceRoutes: MetadataRoute.Sitemap = racesData
    .filter((race) => race.registrationOpen)
    .map((race) => ({
      url: `${siteUrl}/race/${race.id}`,
      changeFrequency: "daily",
      priority: 0.8,
    }));

  return [...staticRoutes, ...raceRoutes];
}
