"use client";

import { useState, useMemo } from "react";
import RaceCard from "./component/race-card";
import RaceFilter from "./component/race-filter";
import { RaceCategory, RaceEvent } from "@/utils/types/race-types";

interface RacePageProps {
  races: RaceEvent[];
}

export default function RacePage({ races }: RacePageProps) {
  const [selectedCategory, setSelectedCategory] = useState<RaceCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRaces = useMemo(() => {
    return races.filter((race) => {
      const matchesCategory =
        selectedCategory === "All" || race.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        race.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        race.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        race.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <section className="relative bg-[#1A1A1A] dark:bg-[#0D0D0D] pt-28 pb-14 md:pt-32 md:pb-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100 bg-[#FF5733]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-raleway text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Upcoming <span className="text-[#FF5733]">Races</span>
          </h1>
          <p className="mt-3 text-white/50 text-sm md:text-base max-w-lg">
            Browse and join races happening near you
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-20 py-8 sm:py-10">
        {/* Filters & Search */}
        <RaceFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Race Cards */}
        {filteredRaces.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredRaces.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="font-raleway font-bold text-xl text-gray-400 dark:text-gray-500 mb-2">
              No races found
            </p>
            <p className="font-merriweather-sans text-sm text-gray-400 dark:text-gray-500">
              Try adjusting your filters or search query
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
