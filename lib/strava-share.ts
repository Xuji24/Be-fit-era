import polyline from "@mapbox/polyline";

/** A Strava activity as returned by /api/strava/activities. */
export interface StravaActivity {
  id: number;
  name: string;
  type: "run" | "walk" | "cycle";
  stravaType: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  startDate: string;
  averagePace: string;
  elevationGain: number;
  calories: number | null;
  imported: boolean;
  polyline: string | null;
  stravaUrl: string;
}

/**
 * Decode a Strava `summary_polyline` into MapLibre's [lng, lat] ordering.
 * `polyline.decode` yields [lat, lng], so the pairs are flipped here.
 */
export function decodeRoute(encoded: string): [number, number][] {
  try {
    return polyline.decode(encoded).map(([lat, lng]) => [lng, lat]);
  } catch {
    return [];
  }
}

/**
 * Build an SVG path for the route, normalized to fit a `size`×`size` viewBox.
 *
 * This is the cheap preview used in the suggestion strip — no map, no tiles, no
 * WebGL — so the strip paints immediately. The full card is only generated when
 * the user actually taps a run.
 */
export function routeToSvgPath(
  coordinates: [number, number][],
  size = 100,
  padding = 8,
): string {
  if (coordinates.length < 2) return "";

  let [minLng, minLat] = coordinates[0];
  let [maxLng, maxLat] = coordinates[0];
  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const spanLng = maxLng - minLng || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  // Uniform scale keeps the route's real shape instead of stretching it.
  const inner = size - padding * 2;
  const scale = Math.min(inner / spanLng, inner / spanLat);

  // Center whatever the scale leaves over.
  const offsetX = (size - spanLng * scale) / 2;
  const offsetY = (size - spanLat * scale) / 2;

  return coordinates
    .map(([lng, lat], i) => {
      const x = (lng - minLng) * scale + offsetX;
      // SVG y grows downward; latitude grows upward.
      const y = size - ((lat - minLat) * scale + offsetY);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Format seconds as "1h 05m" or "42m 30s". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Default caption for a suggested activity post. */
export function buildCaption(activity: StravaActivity): string {
  const verb =
    activity.type === "cycle" ? "Rode" : activity.type === "walk" ? "Walked" : "Ran";
  return `${verb} ${activity.distance}km at ${activity.averagePace} — ${activity.name}`;
}
