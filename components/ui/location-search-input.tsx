"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export interface GeocodeSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: GeocodeSuggestion) => void;
}

/**
 * Address input with OpenStreetMap-backed suggestions. Picking a suggestion hands
 * the caller both the address text and its coordinates, so the map can pin itself.
 */
export default function LocationSearchInput({
  value,
  onValueChange,
  onSelect,
}: Props) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  // Set when the value change came from picking a suggestion, so we don't
  // immediately re-search for the text we just filled in.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("lookup failed");
        const data = (await res.json()) as { results: GeocodeSuggestion[] };
        setSuggestions(data.results);
        setActiveIndex(-1);
        setOpen(data.results.length > 0);
      } catch {
        // Lookup is a convenience — on failure the organizer can still pin manually.
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (s: GeocodeSuggestion) => {
    skipNextSearch.current = true;
    onValueChange(s.label);
    onSelect(s);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="e.g. Manila, Philippines"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="w-full px-4 py-3 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans"
      />
      {loading && (
        <Loader2
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#FF5733]"
        />
      )}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-1000 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-[#2A2A2E] border border-gray-200 dark:border-white/10 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(s)}
                className={`w-full text-left px-4 py-2.5 text-sm font-merriweather-sans text-[#1A1A1A] dark:text-white transition-colors ${
                  i === activeIndex
                    ? "bg-[#FF5733]/10"
                    : "hover:bg-[#FF5733]/10"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
