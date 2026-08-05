/**
 * Server-side address lookup via OpenStreetMap's Nominatim.
 *
 * Used both by /api/geocode (organizer autocomplete) and by race pages, which
 * fall back to geocoding the free-text location when an organizer never pinned
 * the race on the map.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.befitra.app";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  /** Nominatim feature class, e.g. "place", "boundary", "natural". */
  category?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
}

// Water and terrain features are poor race locations — "Subic Bay" matches the
// bay itself, which centres the pin offshore. Prefer populated places instead.
const GEOGRAPHIC_FEATURE_CLASSES = new Set(["natural", "waterway", "water"]);

export async function geocodeAddress(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q,
    format: "json",
    limit: String(limit),
    addressdetails: "0",
  }).toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": `Fitra Race Locator (${siteUrl})` },
    // Cache for a day — race locations rarely move, and Nominatim asks callers
    // to avoid repeat lookups for the same string.
    next: { revalidate: 86400 },
  });

  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);

  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    category: r.class,
  }));
}

/**
 * Best-effort single-coordinate lookup. Returns null instead of throwing.
 *
 * Skips water/terrain matches when a populated place is also available, so a
 * race in "Subic Bay" pins the town rather than the middle of the bay.
 */
export async function geocodeOne(
  query: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  if (!query) return null;
  try {
    const results = await geocodeAddress(query, 5);
    if (results.length === 0) return null;

    const best =
      results.find(
        (r) => !r.category || !GEOGRAPHIC_FEATURE_CLASSES.has(r.category),
      ) ?? results[0];

    return { lat: best.lat, lng: best.lng };
  } catch {
    return null;
  }
}
