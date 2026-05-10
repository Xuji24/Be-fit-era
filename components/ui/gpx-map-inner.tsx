"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { parseStringPromise } from "xml2js";
import L from "leaflet";

interface GpxMapInnerProps {
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

function BoundsUpdater({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export default function GpxMapInner({ gpxUrl, rawGpx }: GpxMapInnerProps) {
  const [positions, setPositions] = useState<[number, number][]>([]);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
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

            const result = await parseStringPromise(xmlText) as GpxParsed;
            const pts: [number, number][] = [];

            // Traverse typical GPX structure (gpx -> trk -> trkseg -> trkpt)
            if (result.gpx && result.gpx.trk) {
                result.gpx.trk.forEach((trk: GpxTrack) => {
                    if (trk.trkseg) {
                        trk.trkseg.forEach((seg: GpxTrackSegment) => {
                            if (seg.trkpt) {
                                seg.trkpt.forEach((pt: GpxPoint) => {
                                    pts.push([parseFloat(pt.$.lat), parseFloat(pt.$.lon)]);
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
                             pts.push([parseFloat(pt.$.lat), parseFloat(pt.$.lon)]);
                         });
                    }
                 });
            }

            if (pts.length > 0) {
                setPositions(pts);
                setBounds(L.latLngBounds(pts));
            } else {
                setError("No valid track points found in GPX file.");
            }
        } catch (err: unknown) {
             setError("Failed to parse GPX: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    }
    loadGpx();
  }, [gpxUrl, rawGpx]);

  if (error) {
      return <div className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 h-full w-full rounded-xl text-red-500 p-4 text-sm text-center">{error}</div>;
  }

  return (
    <div className="relative w-full h-100 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50">
          <p className="text-gray-500 font-medium">Loading Route...</p>
        </div>
      )}
      <MapContainer
        center={[0, 0]}
        zoom={2}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 0 && <Polyline positions={positions} color="#E84A27" weight={5} opacity={0.8} />}
        <BoundsUpdater bounds={bounds} />
      </MapContainer>
    </div>
  );
}
