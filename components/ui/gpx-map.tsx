"use client";

import { useEffect, useState } from "react";
import { parseStringPromise } from "xml2js";
import { Map, MapControls, MapRoute, useMap } from "@/components/ui/map";

interface GpxMapProps {
  gpxUrl?: string; // URL to the .gpx file
  rawGpx?: string; // Raw XML string (if loaded from DB/local)
}

interface GpxPoint {
  $: { lat: string; lon: string };
}
interface GpxTrackSegment {
  trkpt?: GpxPoint[];
}
interface GpxTrack {
  trkseg?: GpxTrackSegment[];
}
interface GpxRoute {
  rtept?: GpxPoint[];
}
interface GpxParsed {
  gpx?: {
    trk?: GpxTrack[];
    rte?: GpxRoute[];
  };
}

/** Pans/zooms the map to fit the whole route once it's parsed. */
function FitRoute({ coordinates }: { coordinates: [number, number][] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || coordinates.length === 0) return;

    let [minLng, minLat] = coordinates[0];
    let [maxLng, maxLat] = coordinates[0];
    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 50, duration: 0 },
    );
  }, [map, isLoaded, coordinates]);

  return null;
}

export default function GpxMap({ gpxUrl, rawGpx }: GpxMapProps) {
  // MapLibre uses [lng, lat] ordering.
  const [positions, setPositions] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGpx() {
      if (!gpxUrl && !rawGpx) return;

      try {
        setLoading(true);
        let xmlText = rawGpx;

        if (gpxUrl) {
          const res = await fetch(gpxUrl);
          xmlText = await res.text();
        }

        if (!xmlText) throw new Error("No GPX data available");

        const result = (await parseStringPromise(xmlText)) as GpxParsed;
        const pts: [number, number][] = [];

        // Traverse typical GPX structure (gpx -> trk -> trkseg -> trkpt)
        if (result.gpx && result.gpx.trk) {
          result.gpx.trk.forEach((trk: GpxTrack) => {
            if (trk.trkseg) {
              trk.trkseg.forEach((seg: GpxTrackSegment) => {
                if (seg.trkpt) {
                  seg.trkpt.forEach((pt: GpxPoint) => {
                    pts.push([parseFloat(pt.$.lon), parseFloat(pt.$.lat)]);
                  });
                }
              });
            }
          });
        } else if (result.gpx && result.gpx.rte) {
          // Or route format
          result.gpx.rte.forEach((rte: GpxRoute) => {
            if (rte.rtept) {
              rte.rtept.forEach((pt: GpxPoint) => {
                pts.push([parseFloat(pt.$.lon), parseFloat(pt.$.lat)]);
              });
            }
          });
        }

        if (pts.length > 0) {
          setPositions(pts);
        } else {
          setError("No valid track points found in GPX file.");
        }
      } catch (err: unknown) {
        setError(
          "Failed to parse GPX: " +
            (err instanceof Error ? err.message : String(err)),
        );
      } finally {
        setLoading(false);
      }
    }
    loadGpx();
  }, [gpxUrl, rawGpx]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 h-100 w-full rounded-xl text-red-500 p-4 text-sm text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-100 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50">
          <p className="text-gray-500 font-medium">Loading Route...</p>
        </div>
      )}
      <Map center={[0, 0]} zoom={2}>
        <MapControls position="top-right" />
        {positions.length > 1 && (
          <MapRoute coordinates={positions} color="#E84A27" width={5} opacity={0.8} />
        )}
        <FitRoute coordinates={positions} />
      </Map>
    </div>
  );
}
