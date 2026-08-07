"use client";

import { useState, useMemo } from "react";
import RaceCard from "./component/race-card";
import RaceFilter from "./component/race-filter";
import PageHeader from "@/components/page-header";
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
  }, [selectedCategory, searchQuery, races]);

  return (
    <div className="min-h-screen relative">
      {/* Hero Header */}
      <PageHeader
        title="Upcoming Races"
        subtitle="Browse and join races happening near you"
      />

      {/* Content */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-20 pb-8 sm:pb-10">
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
