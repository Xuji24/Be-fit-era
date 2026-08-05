"use client";

import { useState, useTransition, useRef } from "react";
import { X, Loader2, Trophy, Upload, Trash2, Shirt, Medal, Award, Route } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateRace } from "@/app/actions/organizer-actions";
import type { OrganizerRace } from "../OrganizerDashboard";
import CustomSelect from "@/components/ui/custom-select";
import LocationField from "@/components/ui/location-field";
import Image from "next/image";

interface Props {
  open: boolean;
  onClose: () => void;
  raceToEdit: OrganizerRace;
  onUpdated: (race: OrganizerRace) => void;
}

const CATEGORIES = ["5K", "10K", "Half Marathon", "Marathon", "Ultra"] as const;

type ExtendedRace = OrganizerRace & {
  description?: string;
  registrationDeadline?: string;
  eventTime?: string;
  registrationFee?: number;
  cutoffTimeMinutes?: number;
  kitPickupInfo?: string;
  inclusions?: string[];
  gpxUrl?: string;
};

function coordsOf(race?: ExtendedRace) {
  return typeof race?.latitude === "number" &&
    typeof race?.longitude === "number"
    ? { lat: race.latitude, lng: race.longitude }
    : null;
}

export default function EditRaceModal({
  open,
  onClose,
  raceToEdit,
  onUpdated,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const extendedRace = raceToEdit as ExtendedRace;

  const [title, setTitle] = useState(extendedRace?.title || "");
  const [category, setCategory] = useState<string>(
    extendedRace?.category || "5K",
  );
  const [targetDistance, setTargetDistance] = useState(
    extendedRace?.targetDistance?.toString() || "",
  );
  const [eventDate, setEventDate] = useState(extendedRace?.eventDate || "");

  const [location, setLocation] = useState(extendedRace?.location || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    coordsOf(extendedRace),
  );
  const [description, setDescription] = useState(
    extendedRace?.description || "",
  );
  const [maxParticipants, setMaxParticipants] = useState(
    extendedRace?.maxParticipants?.toString() || "",
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    extendedRace?.registrationDeadline || "",
  );
  const [eventTime, setEventTime] = useState(extendedRace?.eventTime || "");
  const [registrationFee, setRegistrationFee] = useState(
    extendedRace?.registrationFee !== undefined
      ? extendedRace.registrationFee.toString()
      : "",
  );
  const [cutoffHours, setCutoffHours] = useState(
    extendedRace?.cutoffTimeMinutes !== undefined
      ? Math.floor(extendedRace.cutoffTimeMinutes / 60).toString()
      : "",
  );
  const [cutoffMinutes, setCutoffMinutes] = useState(
    extendedRace?.cutoffTimeMinutes !== undefined
      ? (extendedRace.cutoffTimeMinutes % 60).toString()
      : "0",
  );
  const [kitPickupInfo, setKitPickupInfo] = useState(
    extendedRace?.kitPickupInfo || "",
  );
  const [inclusions, setInclusions] = useState<string[]>(
    extendedRace?.inclusions ?? [],
  );

  // GPX upload state
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [existingGpxUrl, setExistingGpxUrl] = useState<string | null>(extendedRace?.gpxUrl ?? null);
  const gpxRef = useRef<HTMLInputElement | null>(null);

  // Design upload states
  type DesignKey = "tshirt" | "medal" | "certificate";
  const [designFiles, setDesignFiles] = useState<
    Record<DesignKey, File | null>
  >({
    tshirt: null,
    medal: null,
    certificate: null,
  });
  const [designPreviews, setDesignPreviews] = useState<
    Record<DesignKey, string | null>
  >({
    tshirt: extendedRace?.tshirtDesignUrl ?? null,
    medal: extendedRace?.medalDesignUrl ?? null,
    certificate: extendedRace?.certificateDesignUrl ?? null,
  });
  const designRefs = useRef<Record<DesignKey, HTMLInputElement | null>>({
    tshirt: null,
    medal: null,
    certificate: null,
  });

  const [prevRaceId, setPrevRaceId] = useState(extendedRace?.id);

  if (extendedRace?.id !== prevRaceId) {
    setPrevRaceId(extendedRace?.id);
    setTitle(extendedRace?.title || "");
    setCategory(extendedRace?.category || "5K");
    setTargetDistance(extendedRace?.targetDistance?.toString() || "");
    setEventDate(extendedRace?.eventDate || "");
    setLocation(extendedRace?.location || "");
    setCoords(coordsOf(extendedRace));
    setDescription(extendedRace?.description || "");
    setMaxParticipants(extendedRace?.maxParticipants?.toString() || "");
    setRegistrationDeadline(extendedRace?.registrationDeadline || "");
    setEventTime(extendedRace?.eventTime || "");
    setRegistrationFee(
      extendedRace?.registrationFee !== undefined
        ? extendedRace.registrationFee.toString()
        : "",
    );
    setCutoffHours(
      extendedRace?.cutoffTimeMinutes !== undefined
        ? Math.floor(extendedRace.cutoffTimeMinutes / 60).toString()
        : "",
    );
    setCutoffMinutes(
      extendedRace?.cutoffTimeMinutes !== undefined
        ? (extendedRace.cutoffTimeMinutes % 60).toString()
        : "0",
    );
    setKitPickupInfo(extendedRace?.kitPickupInfo || "");
    setInclusions(extendedRace?.inclusions ?? []);
    setDesignPreviews({
      tshirt: extendedRace?.tshirtDesignUrl ?? null,
      medal: extendedRace?.medalDesignUrl ?? null,
      certificate: extendedRace?.certificateDesignUrl ?? null,
    });
    setDesignFiles({ tshirt: null, medal: null, certificate: null });
    setGpxFile(null);
    setExistingGpxUrl(extendedRace?.gpxUrl ?? null);
    if (gpxRef.current) gpxRef.current.value = "";
  }

  const DESIGN_CONFIGS = [
    { key: "tshirt" as DesignKey, label: "T-Shirt Design", icon: Shirt },
    { key: "medal" as DesignKey, label: "Medal Design", icon: Medal },
    { key: "certificate" as DesignKey, label: "Certificate", icon: Award },
  ];

  const handleDesignSelect = (key: DesignKey, file: File | null) => {
    if (!file) return;
    const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PNG, JPEG, WebP, or SVG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB.");
      return;
    }
    setDesignFiles((prev) => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = (e) => {
      setDesignPreviews((prev) => ({
        ...prev,
        [key]: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDesignRemove = (key: DesignKey) => {
    setDesignFiles((prev) => ({ ...prev, [key]: null }));
    setDesignPreviews((prev) => ({ ...prev, [key]: null }));
    if (designRefs.current[key]) designRefs.current[key]!.value = "";
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Please enter a race title.");
      return;
    }
    if (!targetDistance || Number(targetDistance) <= 0) {
      toast.error("Please enter a valid target distance.");
      return;
    }
    if (!eventDate) {
      toast.error("Please select an event date.");
      return;
    }

    startTransition(async () => {
      // Upload design files if any
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in.");
        return;
      }

      let tshirtDesignUrl: string | undefined =
        raceToEdit.tshirtDesignUrl ?? undefined;
      let medalDesignUrl: string | undefined =
        raceToEdit.medalDesignUrl ?? undefined;
      let certificateDesignUrl: string | undefined =
        raceToEdit.certificateDesignUrl ?? undefined;

      const raceId = raceToEdit.id;

      const uploadMap: {
        key: DesignKey;
        storagePath: string;
        setter: (url: string) => void;
        existingUrl: string | null;
      }[] = [
        {
          key: "tshirt",
          storagePath: "tshirt",
          setter: (url) => {
            tshirtDesignUrl = url;
          },
          existingUrl: raceToEdit.tshirtDesignUrl,
        },
        {
          key: "medal",
          storagePath: "medal",
          setter: (url) => {
            medalDesignUrl = url;
          },
          existingUrl: raceToEdit.medalDesignUrl,
        },
        {
          key: "certificate",
          storagePath: "certificate",
          setter: (url) => {
            certificateDesignUrl = url;
          },
          existingUrl: raceToEdit.certificateDesignUrl,
        },
      ];

      for (const { key, storagePath, setter, existingUrl } of uploadMap) {
        const file = designFiles[key];

        // Handle removal case
        if (designPreviews[key] === null && existingUrl) {
          setter("");
        }

        if (file) {
          const ext = file.name.split(".").pop() ?? "png";
          const filePath = `${user.id}/${raceId}/${storagePath}_${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("race-designs")
            .upload(filePath, file, { upsert: true });

          if (uploadError) {
            toast.error(
              `Failed to upload ${DESIGN_CONFIGS.find((d) => d.key === key)?.label}. Please try again.`,
            );
            return;
          }

          const { data: urlData } = supabase.storage
            .from("race-designs")
            .getPublicUrl(filePath);
          setter(urlData.publicUrl);
        }
      }

      let gpxUrl: string | undefined = existingGpxUrl ?? undefined;
      if (gpxFile) {
        const filePath = `${user.id}/${raceId}/route_${Date.now()}.gpx`;
        const { error: gpxError } = await supabase.storage
          .from("race-gpx")
          .upload(filePath, gpxFile, { upsert: true });
        if (gpxError) {
          toast.error("Failed to upload GPX file. Please try again.");
          return;
        }
        const { data: gpxUrlData } = supabase.storage.from("race-gpx").getPublicUrl(filePath);
        gpxUrl = gpxUrlData.publicUrl;
      } else if (existingGpxUrl === null) {
        gpxUrl = undefined;
      }

      const payload: Parameters<typeof updateRace>[0] = {
        raceId,

        title: title.trim(),
        category,
        targetDistance: Number(targetDistance),
        eventDate,
        eventTime: eventTime || undefined,
        location: location.trim() || undefined,
        latitude: coords ? coords.lat : null,
        longitude: coords ? coords.lng : null,
        description: description.trim() || undefined,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        registrationDeadline: registrationDeadline || undefined,
        registrationFee:
          registrationFee !== "" ? Number(registrationFee) : undefined,
        cutoffTimeMinutes:
          cutoffHours !== ""
            ? Number(cutoffHours) * 60 + Number(cutoffMinutes)
            : undefined,
        kitPickupInfo: kitPickupInfo.trim() || undefined,
        inclusions: inclusions.length > 0 ? inclusions : undefined,
        gpxUrl,
      };

      if (tshirtDesignUrl !== undefined)
        payload.tshirtDesignUrl =
          tshirtDesignUrl === "" ? undefined : tshirtDesignUrl;
      if (medalDesignUrl !== undefined)
        payload.medalDesignUrl =
          medalDesignUrl === "" ? undefined : medalDesignUrl;
      if (certificateDesignUrl !== undefined)
        payload.certificateDesignUrl =
          certificateDesignUrl === "" ? undefined : certificateDesignUrl;

      const result = await updateRace(payload);

      if (!result.success) {
        toast.error(result.error ?? "Failed to update race. Please try again.");
        return;
      }

      toast.success("Race updated successfully!");
      const updatedRace: OrganizerRace = {
        ...raceToEdit,
        title: title.trim(),
        category,
        targetDistance: Number(targetDistance),
        eventDate,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        tshirtDesignUrl:
          payload.tshirtDesignUrl !== undefined
            ? payload.tshirtDesignUrl
            : raceToEdit.tshirtDesignUrl,
        medalDesignUrl:
          payload.medalDesignUrl !== undefined
            ? payload.medalDesignUrl
            : raceToEdit.medalDesignUrl,
        certificateDesignUrl:
          payload.certificateDesignUrl !== undefined
            ? payload.certificateDesignUrl
            : raceToEdit.certificateDesignUrl,
      };

      onUpdated(updatedRace);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-black/5 dark:border-white/5 sticky top-0 bg-white dark:bg-[#1C1C1E] z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#FF5733]" />
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white font-raleway">
                Edit Race
              </h2>
            </div>
            <button
              title="Close"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#1A1A1A]/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
              Race Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manila Sunrise Marathon 2026"
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
            />
          </div>

          {/* Category + Distance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Category *
              </label>
              <CustomSelect
                value={category}
                onChange={(val) => setCategory(val)}
                options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Distance (km) *
              </label>
              <input
                type="number"
                value={targetDistance}
                onChange={(e) => setTargetDistance(e.target.value)}
                placeholder="42.195"
                min="0.1"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
          </div>

          {/* Event Date + Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Event Date *
              </label>
              <input
                type="date"
                aria-label="Event Date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Registration Deadline
              </label>
              <input
                type="date"
                aria-label="Registration Deadline"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
          </div>

          {/* Location */}
          <LocationField
            location={location}
            onLocationChange={setLocation}
            coords={coords}
            onCoordsChange={setCoords}
          />

          {/* Max Participants */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
              Max Participants
            </label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="500"
              min="1"
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your race..."
              rows={3}
              maxLength={2000}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans resize-none"
            />
          </div>

          {/* Gun Start Time + Registration Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Gun Start Time
              </label>
              <input
                type="time"
                aria-label="Gun Start Time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
                Registration Fee (₱)
              </label>
              <input
                type="number"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="0 = FREE"
                min="0"
                step="50"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
          </div>

          {/* Cutoff Time */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
              Cutoff Time (optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={cutoffHours}
                onChange={(e) => setCutoffHours(e.target.value)}
                placeholder="Hours (e.g. 6)"
                min="0"
                max="24"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
              <input
                type="number"
                value={cutoffMinutes}
                onChange={(e) => setCutoffMinutes(e.target.value)}
                placeholder="Minutes (e.g. 30)"
                min="0"
                max="59"
                className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
              />
            </div>
          </div>

          {/* Kit Pickup Info */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-1.5 uppercase tracking-wider font-merriweather-sans">
              Kit Pickup Info (optional)
            </label>
            <input
              type="text"
              value={kitPickupInfo}
              onChange={(e) => setKitPickupInfo(e.target.value)}
              placeholder="e.g. June 19–20 at Rizal Park Entrance, 8AM–5PM"
              maxLength={300}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
            />
          </div>

          {/* Inclusions */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 mb-2 uppercase tracking-wider font-merriweather-sans">
              What&apos;s Included (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {["Medal", "T-Shirt", "E-Certificate", "Timing Chip", "Race Bib", "Loot Bag", "Post-Race Meal"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setInclusions((prev) =>
                      prev.includes(item)
                        ? prev.filter((i) => i !== item)
                        : [...prev, item]
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-merriweather-sans font-semibold border transition-all cursor-pointer ${
                    inclusions.includes(item)
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-[#F5F5F0] dark:bg-[#2A2A2E] text-[#1A1A1A]/60 dark:text-white/40 border-transparent hover:border-emerald-300"
                  }`}
                >
                  {inclusions.includes(item) ? "✓ " : ""}{item}
                </button>
              ))}
            </div>
          </div>

          {/* GPX Route (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 uppercase tracking-wider font-merriweather-sans flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" />
                GPX Route File
              </label>
              <span className="text-[10px] text-[#1A1A1A]/30 dark:text-white/20 font-merriweather-sans">Optional</span>
            </div>
            {gpxFile || existingGpxUrl ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-merriweather-sans text-emerald-600 dark:text-emerald-400 truncate">
                  {gpxFile ? gpxFile.name : "Route attached"}
                </span>
                <button
                  type="button"
                  onClick={() => { setGpxFile(null); setExistingGpxUrl(null); if (gpxRef.current) gpxRef.current.value = ""; }}
                  className="ml-3 text-[#1A1A1A]/40 dark:text-white/30 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => gpxRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 hover:border-[#FF5733]/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#1A1A1A]/20 dark:text-white/15" />
                <span className="text-xs text-[#1A1A1A]/30 dark:text-white/20 font-merriweather-sans">Upload .gpx file</span>
              </button>
            )}
            <input
              ref={gpxRef}
              type="file"
              aria-label="Upload GPX route file"
              accept=".gpx"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > 10 * 1024 * 1024) {
                  toast.error("GPX file must be under 10MB.");
                  return;
                }
                setGpxFile(file);
              }}
              className="hidden"
            />
          </div>

          {/* Design Uploads (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/40 uppercase tracking-wider font-merriweather-sans">
                Race Designs
              </span>
              <span className="text-[10px] text-[#1A1A1A]/30 dark:text-white/20 font-merriweather-sans">
                Optional — you can update these
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {DESIGN_CONFIGS.map(({ key, label, icon: Icon }) => (
                <div key={key}>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-[#1A1A1A]/50 dark:text-white/30 mb-1.5 font-merriweather-sans">
                    <Icon className="w-3 h-3" />
                    {label}
                  </label>
                  {designPreviews[key] ? (
                    <div className="relative group rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                      <div className="relative w-full h-20 bg-[#F5F5F0] dark:bg-[#2A2A2E]">
                        <Image
                          src={designPreviews[key]!}
                          alt={label}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <button
                        type="button"
                        title={`Remove ${label} design`}
                        onClick={() => handleDesignRemove(key)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => designRefs.current[key]?.click()}
                      className="w-full h-20 rounded-lg border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 hover:border-[#FF5733]/30 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#1A1A1A]/20 dark:text-white/15" />
                      <span className="text-[9px] text-[#1A1A1A]/30 dark:text-white/20 font-merriweather-sans">
                        Upload
                      </span>
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      designRefs.current[key] = el;
                    }}
                    type="file"
                    aria-label={`Upload ${label} design`}
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                    onChange={(e) =>
                      handleDesignSelect(key, e.target.files?.[0] ?? null)
                    }
                    className="hidden"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] disabled:opacity-50 text-white text-sm font-semibold font-raleway transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4" />
                Update Race
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
