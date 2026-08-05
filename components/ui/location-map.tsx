"use client";

import { Map, MapMarker, MarkerContent, MarkerPopup } from "@/components/ui/map";
import { MapPin } from "lucide-react";

interface LocationMapProps {
  lat: number;
  lng: number;
  label?: string;
  /**
   * Coordinates came from geocoding the location text rather than an organizer
   * pin. Renders a soft radius instead of a precise pin, so runners don't read
   * a city-centre estimate as the start line.
   */
  approximate?: boolean;
}

/** Read-only map showing the race location. */
export default function LocationMap({
  lat,
  lng,
  label,
  approximate = false,
}: LocationMapProps) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
      <Map center={[lng, lat]} zoom={approximate ? 12 : 14}>
        <MapMarker longitude={lng} latitude={lat}>
          <MarkerContent>
            {approximate ? (
              <span className="block size-16 rounded-full bg-[#FF5733]/20 ring-2 ring-[#FF5733]/50" />
            ) : (
              <MapPin
                size={32}
                className="text-[#FF5733] fill-[#FF5733]/25 drop-shadow-sm"
              />
            )}
          </MarkerContent>
          {label && (
            <MarkerPopup>
              {approximate ? `${label} (approximate area)` : label}
            </MarkerPopup>
          )}
        </MapMarker>
      </Map>
    </div>
  );
}
