import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";

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

const VenuesIndex = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      void loadVenues(offset, true);
    }
  };

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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading venues…
          </div>
        ) : venues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600 shadow-sm">
            No venues found. Try a different search.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {venues.map((venue) => {
              const chips = [
                ...(venue.best_for_tags ?? []),
                ...(venue.facilities ?? []),
              ].filter(Boolean).slice(0, 3);
              const totalLabel =
                (venue.total_catches ?? 0) > 0
                  ? `${venue.total_catches} catch${(venue.total_catches ?? 0) === 1 ? "" : "es"} logged`
                  : "No catches logged yet";
              const recentLabel =
                (venue.recent_catches_30d ?? 0) > 0
                  ? `${venue.recent_catches_30d} in the last 30 days`
                  : "Be the first to log a catch here";

              return (
                <Card
                  key={venue.id}
                  className="flex h-full flex-col border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus-within:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold text-slate-900">{venue.name}</CardTitle>
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {venue.location || "UK stillwater venue"}
                    </p>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {venue.short_tagline || "Community catches coming soon. Imported from Add Catch venue options."}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 pb-5">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{totalLabel}</span>
                      <span className="text-slate-500">{recentLabel}</span>
                    </div>
                    {chips.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {venue.price_from ? `From ${venue.price_from}` : ""}
                      </span>
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
