"use client";

import { useEffect } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import {
  Map,
  MapMarker,
  MapControls,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { MapPin } from "lucide-react";

interface LocationPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}

// Manila — a sensible default view before the organizer drops a pin.
const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995];

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const handler = (e: MapMouseEvent) => onChange(e.lngLat.lat, e.lngLat.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, isLoaded, onChange]);

  return null;
}

// The map only takes `center` on init, so recenter when an address suggestion
// sets coordinates on an already-mounted map.
function Recenter({ lat, lng }: { lat?: number; lng?: number }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || lat === undefined || lng === undefined) return;
    map.easeTo({ center: [lng, lat], zoom: 15 });
  }, [map, isLoaded, lat, lng]);

  return null;
}

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: LocationPickerProps) {
  const hasPin = lat !== undefined && lng !== undefined;

  return (
    <div className="h-56 w-full overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
      <Map
        center={hasPin ? [lng, lat] : DEFAULT_CENTER}
        zoom={hasPin ? 15 : 11}
      >
        <MapControls position="top-right" />
        <ClickHandler onChange={onChange} />
        <Recenter lat={lat} lng={lng} />
        {hasPin && (
          <MapMarker longitude={lng} latitude={lat}>
            <MarkerContent>
              <MapPin
                size={30}
                className="text-[#FF5733] fill-[#FF5733]/25 drop-shadow-sm"
              />
            </MarkerContent>
          </MapMarker>
        )}
      </Map>
    </div>
  );
}
