import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Image as ImageIcon, Search } from "lucide-react";
import { getPublicAssetUrl } from "@/lib/storage";
import { FeedSelect } from "@/components/feed/FeedSelect";

type Venue = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
  short_tagline: string | null;
  ticket_type: string | null;
  price_from: string | null;
  best_for_tags: string[] | null;
  facilities: string[] | null;
  total_catches: number | null;
  recent_catches_30d: number | null;
};

type VenueThumbnail = { url: string; alt: string } | null;

const VenueThumbnail = ({ venue, thumbnail }: { venue: Venue; thumbnail?: VenueThumbnail }) => {
  return (
    <div className="relative w-full overflow-hidden rounded-b-none bg-gradient-to-br from-slate-100 to-slate-200 aspect-[4/3]">
      {thumbnail?.url ? (
        <>
          <img
            src={thumbnail.url}
            alt={thumbnail.alt}
            className="h-full w-full object-cover transition duration-500"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-slate-200/70" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm backdrop-blur">
            <ImageIcon className="h-4 w-4" />
            <span>Venue photo coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
};

const VenuesIndex = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>("all");
  const [carpOnly, setCarpOnly] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<"name" | "most_catches" | "most_active">("name");
  // Thumbnail lookup keyed by venue.id; null marks "no image found" to avoid refetching.
  const [thumbnails, setThumbnails] = useState<Record<string, VenueThumbnail>>({});
  const requestedThumbnails = useRef<Set<string>>(new Set());

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const loadVenues = async (nextOffset = 0, append = false) => {
    const limit = 20;
    if (nextOffset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const { data, error } = await supabase.rpc("get_venues", {
      p_search: debouncedQuery.length > 0 ? debouncedQuery : null,
      p_limit: limit,
      p_offset: nextOffset,
    });

    if (error) {
      console.error("Failed to load venues", error);
      setVenues(append ? venues : []);
      setHasMore(false);
    } else {
      const fetched = (data as Venue[]) ?? [];
      setVenues(append ? [...venues, ...fetched] : fetched);
      setHasMore(fetched.length === limit);
      setOffset(nextOffset + fetched.length);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQuery) {
          next.set("q", debouncedQuery);
        } else {
          next.delete("q");
        }
        return next;
      });
      void loadVenues(0, false);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    let isCancelled = false;

    const fetchThumbnailForVenue = async (venue: Venue) => {
      if (thumbnails[venue.id] !== undefined || requestedThumbnails.current.has(venue.id)) return;

      requestedThumbnails.current.add(venue.id);

      let found: VenueThumbnail | undefined = undefined;

      const { data: photoData, error: photoError } = await supabase.rpc("get_venue_photos", {
        p_venue_id: venue.id,
        p_limit: 1,
        p_offset: 0,
      });

      if (!photoError) {
        const firstPhoto = (photoData as { image_path?: string | null }[] | null)?.[0];
        const photoUrl = getPublicAssetUrl(firstPhoto?.image_path);
        if (photoUrl) {
          found = { url: photoUrl, alt: `${venue.name} venue` };
        }
      }

      if (!found) {
        const { data: catchData, error: catchError } = await supabase.rpc("get_venue_recent_catches", {
          p_venue_id: venue.id,
          p_limit: 1,
          p_offset: 0,
        });
        if (!catchError) {
          const firstCatch = Array.isArray(catchData)
            ? (catchData as { image_url?: string | null; title?: string | null }[])[0]
            : null;
          const rawCatchImage = firstCatch?.image_url?.trim() || null;
          let catchUrl: string | null = null;
          if (rawCatchImage) {
            if (rawCatchImage.startsWith("http://") || rawCatchImage.startsWith("https://")) {
              catchUrl = rawCatchImage;
            } else {
              catchUrl = getPublicAssetUrl(rawCatchImage) ?? null;
            }
          }
          if (catchUrl) {
            const alt = firstCatch?.title ? `${firstCatch.title} at ${venue.name}` : `Catch at ${venue.name}`;
            found = { url: catchUrl, alt };
          }
        }
      }

      const finalThumbnail: VenueThumbnail = found ?? null;

      if (isCancelled) return;
      // TODO: This is N+1 RPCs; acceptable for now. Consider batching or enriching get_venues for thumbnails later.
      setThumbnails((prev) => (prev[venue.id] !== undefined ? prev : { ...prev, [venue.id]: finalThumbnail }));
    };

    venues.forEach((venue) => {
      void fetchThumbnailForVenue(venue);
    });

    return () => {
      isCancelled = true;
    };
  }, [venues]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      void loadVenues(offset, true);
    }
  };

  const getDisplayPriceFrom = (raw?: string | null) => {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.toLowerCase().startsWith("from ")) return trimmed;
    return `From ${trimmed}`;
  };

  const matchesTicketType = (venue: Venue) => {
    if (ticketTypeFilter === "all") return true;
    const ticket = venue.ticket_type?.toLowerCase() ?? "";
    if (!ticket) return false;
    if (ticketTypeFilter === "day_ticket") return ticket.includes("day");
    if (ticketTypeFilter === "syndicate") return ticket.includes("syndicate");
    if (ticketTypeFilter === "club") return ticket.includes("club");
    return true;
  };

  const filteredAndSortedVenues = useMemo(() => {
    const filtered = venues.filter((venue) => {
      const passesTicket = matchesTicketType(venue);
      const passesCarp =
        !carpOnly ||
        (venue.best_for_tags ?? []).some((tag) => tag?.toLowerCase().includes("carp"));
      return passesTicket && passesCarp;
    });

    const toNumber = (value: number | null | undefined) => value ?? 0;
    const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

    if (sortOption === "most_catches") {
      return [...filtered].sort((a, b) => {
        const diff = toNumber(b.total_catches) - toNumber(a.total_catches);
        return diff !== 0 ? diff : byName(a, b);
      });
    }
    if (sortOption === "most_active") {
      return [...filtered].sort((a, b) => {
        const diff = toNumber(b.recent_catches_30d) - toNumber(a.recent_catches_30d);
        return diff !== 0 ? diff : byName(a, b);
      });
    }
    return [...filtered].sort(byName);
  }, [carpOnly, sortOption, ticketTypeFilter, venues]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Venues</p>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">Browse venues</h1>
            <p className="text-sm text-slate-600">
              Discover fisheries and see what the community is catching there.
            </p>
          </div>
          <div className="w-full max-w-md">
            <Input
              placeholder="Search venues by name or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="mt-4 md:mt-6 mb-6 md:mb-8 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <FeedSelect
              label="Ticket type"
              value={ticketTypeFilter}
              options={[
                { value: "all", label: "All ticket types" },
                { value: "day_ticket", label: "Day ticket" },
                { value: "syndicate", label: "Syndicate" },
                { value: "club", label: "Club" },
              ]}
              onChange={setTicketTypeFilter}
            />
            <div className="flex flex-col gap-1 sm:w-auto">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Focus</span>
              <Button
                type="button"
                variant={carpOnly ? "default" : "outline"}
                size="sm"
                className={`justify-start rounded-xl border border-border/60 px-3 py-3 text-sm font-medium ${
                  carpOnly ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-background text-foreground"
                }`}
                onClick={() => setCarpOnly((prev) => !prev)}
              >
                Carp-friendly only
              </Button>
            </div>
            <FeedSelect
              label="Sort"
              value={sortOption}
              options={[
                { value: "name", label: "Sort: A–Z (name)" },
                { value: "most_catches", label: "Sort: Most catches" },
                { value: "most_active", label: "Sort: Most active (last 30 days)" },
              ]}
              onChange={(value) => setSortOption(value as typeof sortOption)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading venues…
          </div>
        ) : venues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-8 text-center text-slate-600 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No venues match your search</h3>
            <p className="mt-2 text-sm text-slate-600">Try a different name, location, or clear your search.</p>
          </div>
        ) : filteredAndSortedVenues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-8 text-center text-slate-600 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No venues match these filters</h3>
            <p className="mt-2 text-sm text-slate-600">Adjust your filters or clear them to see more venues.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {filteredAndSortedVenues.map((venue) => {
              const bestForChips = (venue.best_for_tags ?? [])
                .filter(Boolean)
                .map((t) => t.trim())
                .filter((t) => t.length > 0);
              const facilityChips = (venue.facilities ?? [])
                .filter(Boolean)
                .map((t) => t.trim())
                .filter((t) => t.length > 0);
              const seen = new Set<string>();
              const dedupe = (values: string[]) =>
                values.filter((val) => {
                  const lower = val.toLowerCase();
                  if (seen.has(lower)) return false;
                  seen.add(lower);
                  return true;
                });
              const uniqueBestFor = dedupe(bestForChips);
              const uniqueFacilities = dedupe(facilityChips);
              const chipDisplay = [...uniqueBestFor.slice(0, 3), ...uniqueFacilities].slice(0, 4);
              const total = venue.total_catches ?? 0;
              const recent = venue.recent_catches_30d ?? 0;
              const totalLabel = total > 0 ? `${total} catch${total === 1 ? "" : "es"} logged` : "Undiscovered – no catches logged yet";
              let recentLabel = "";
              if (total === 0) {
                recentLabel = "Be the first to log a catch here";
              } else if (recent > 0) {
                recentLabel = `${recent} in the last 30 days`;
              } else {
                recentLabel = "Quiet recently";
              }
              const ticketType = venue.ticket_type?.trim();
              const priceFrom = getDisplayPriceFrom(venue.price_from);
              const location = venue.location?.trim() || "UK stillwater venue";
              const tagline =
                venue.short_tagline?.trim() ||
                "Community catches coming soon. Imported from Add Catch venue options.";
              const thumbnail = thumbnails[venue.id];

              return (
                <Card
                  key={venue.id}
                  className="flex h-full flex-col overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:-translate-y-px hover:shadow-sm focus-within:shadow-md"
                >
                  <VenueThumbnail venue={venue} thumbnail={thumbnail} />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold text-slate-900">{venue.name}</CardTitle>
                        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {location}
                        </p>
                      </div>
                      {ticketType ? (
                        <span className="rounded-md border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-800">
                          {ticketType}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{tagline}</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 pb-5">
                    <div className="grid gap-1.5 text-xs text-slate-600">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Catches logged</p>
                          <p className="text-sm font-bold text-slate-900">{total}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last 30 days</p>
                          <p className="text-sm font-bold text-slate-900">{recent}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{totalLabel}</span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1">{recentLabel}</span>
                        {/* TODO Phase 2: rating, heaviest catch, last catch age */}
                      </div>
                    </div>
                    {chipDisplay.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {chipDisplay.map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3">
                      {priceFrom ? (
                        <span className="flex items-baseline gap-1 text-xs text-slate-600">
                          {!priceFrom.toLowerCase().startsWith("from") ? (
                            <span className="font-semibold text-slate-500">From</span>
                          ) : null}
                          <span className="text-sm font-semibold text-slate-900">
                            {priceFrom.replace(/^from\s*/i, "").trim() || priceFrom}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pricing to be confirmed</span>
                      )}
                      <Button asChild className="w-full rounded-full">
                        <Link to={`/venues/${venue.slug}`}>View venue</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {venues.length > 0 && hasMore ? (
          <div className="mt-12 flex justify-center">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="h-11 rounded-full px-6"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Load more venues"
              )}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default VenuesIndex;
