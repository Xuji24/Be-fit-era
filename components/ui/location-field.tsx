"use client";

import LocationPicker from "@/components/ui/location-picker";
import LocationSearchInput from "@/components/ui/location-search-input";

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  location: string;
  onLocationChange: (value: string) => void;
  coords: Coords | null;
  onCoordsChange: (coords: Coords | null) => void;
}

/**
 * One combined location flow: search an address, and the map right below
 * updates and shows the pin immediately. The organizer can also click the map
 * directly to refine or place the pin themselves — search and map both write
 * to the same coordinates, so neither feels like a separate/optional step.
 */
export default function LocationField({
  location,
  onLocationChange,
  coords,
  onCoordsChange,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 uppercase tracking-wider font-merriweather-sans">
          Location
        </label>
        {coords && (
          <button
            type="button"
            onClick={() => onCoordsChange(null)}
            className="text-xs text-[#FF5733] hover:underline font-merriweather-sans"
          >
            Clear pin
          </button>
        )}
      </div>

      <LocationSearchInput
        value={location}
        onValueChange={onLocationChange}
        onSelect={(s) => onCoordsChange({ lat: s.lat, lng: s.lng })}
      />

      <div className="mt-2">
        <LocationPicker
          lat={coords?.lat}
          lng={coords?.lng}
          onChange={(lat, lng) => onCoordsChange({ lat, lng })}
        />
      </div>

      <p className="mt-1.5 text-xs text-[#1A1A1A]/40 dark:text-white/30 font-merriweather-sans">
        {coords
          ? `Pinned at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — click the map to adjust.`
          : "Search an address or click the map to pin the exact start line."}
      </p>
    </div>
  );
}
