import React from "react";
import { Input } from "@/components/ui/input";
import { FeedSelect } from "@/components/feed/FeedSelect";
import { UK_FRESHWATER_SPECIES } from "@/lib/freshwater-data";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

interface FeedFiltersProps {
  feedScope: "all" | "following";
  onFeedScopeChange: (scope: "all" | "following") => void;
  speciesFilter: string;
  onSpeciesFilterChange: (filter: string) => void;
  customSpeciesFilter: string;
  onCustomSpeciesFilterChange: (filter: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  userDisabled: boolean;
}

export const FeedFilters = ({
  feedScope,
  onFeedScopeChange,
  speciesFilter,
  onSpeciesFilterChange,
  customSpeciesFilter,
  onCustomSpeciesFilterChange,
  sortBy,
  onSortByChange,
  userDisabled,
}: FeedFiltersProps) => {
  const typeOptions = [
    { value: "all", label: "All catches" },
    { value: "following", label: "People you follow" },
  ];

  const speciesOptions = [
    { value: "all", label: "All species" },
    ...UK_FRESHWATER_SPECIES.map((species) => ({ value: species.value, label: species.label })),
    { value: "other", label: "Other" },
  ];

  const sortOptions = [
    { value: "newest", label: "Newest first" },
    { value: "highest_rated", label: "Highest rated" },
    { value: "heaviest", label: "Heaviest" },
  ];

  return (
    <div
      className="mt-4 md:mt-6 mb-6 md:mb-8 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 sm:px-6 sm:py-4"
      style={{ scrollMarginTop: "var(--nav-height)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <FeedSelect
          label="Type"
          value={feedScope}
          options={typeOptions}
          onChange={onFeedScopeChange}
        />

        <div className="flex w-full flex-col gap-1 sm:flex-1">
          <FeedSelect
            label="Species"
            value={speciesFilter}
            options={speciesOptions}
            onChange={onSpeciesFilterChange}
          />
          {speciesFilter === "other" && (
            <Input
              className="mt-2 w-full rounded-xl border border-border/60 bg-background"
              placeholder="Describe species"
              aria-label="Custom species filter"
              value={customSpeciesFilter}
              onChange={(e) => onCustomSpeciesFilterChange(capitalizeFirstWord(e.target.value))}
            />
          )}
        </div>

        <FeedSelect
          label="Sort"
          value={sortBy}
          options={sortOptions}
          onChange={onSortByChange}
        />
      </div>
    </div>
  );
};
