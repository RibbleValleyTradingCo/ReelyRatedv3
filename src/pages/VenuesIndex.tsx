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
  description: string | null;
  created_at: string;
  updated_at: string;
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Venues</p>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Browse venues</h1>
            <p className="text-sm text-slate-600">
              Discover fisheries and see what the community is catching there.
            </p>
          </div>
          <div className="w-full max-w-md">
            <Input
              placeholder="Search venues by name or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Card key={venue.id} className="flex h-full flex-col border border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-900">{venue.name}</CardTitle>
                  {venue.location ? (
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      {venue.location}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 pb-5">
                  {venue.description ? (
                    <p className="text-sm text-slate-600 line-clamp-3">{venue.description}</p>
                  ) : (
                    <p className="text-sm text-slate-500">No description provided.</p>
                  )}
                  <div className="mt-auto">
                    <Button asChild className="w-full">
                      <Link to={`/venues/${venue.slug}`}>View venue</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {venues.length > 0 && hasMore ? (
          <div className="mt-10 flex justify-center">
            <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
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
