import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MapPin } from "lucide-react";
import { CatchCard } from "@/components/feed/CatchCard";

type Venue = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type CatchRow = {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  visibility: string | null;
  hide_exact_spot: boolean | null;
  conditions: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  ratings: { rating: number }[];
  comments: { id: string }[];
  reactions: { user_id: string }[] | null;
};

const normalizeCatchRow = (row: CatchRow): CatchRow => ({
  ...row,
  profiles: row.profiles ?? { username: "Unknown", avatar_path: null, avatar_url: null },
  ratings: (row.ratings as any) ?? [],
  comments: (row.comments as any) ?? [],
  reactions: (row.reactions as any) ?? [],
});

const VenueDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [topCatches, setTopCatches] = useState<CatchRow[]>([]);
  const [recentCatches, setRecentCatches] = useState<CatchRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [recentOffset, setRecentOffset] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(true);

  useEffect(() => {
    const loadVenue = async () => {
      if (!slug) return;
      setVenueLoading(true);
      const { data, error } = await supabase.rpc("get_venue_by_slug", { p_slug: slug });
      if (error) {
        console.error("Failed to load venue", error);
        setVenue(null);
      } else {
        const row = (data as Venue[] | null)?.[0] ?? null;
        setVenue(row);
      }
      setVenueLoading(false);
    };
    void loadVenue();
  }, [slug]);

  const loadTopCatches = async (venueId: string) => {
    setTopLoading(true);
    const { data, error } = await supabase.rpc("get_venue_top_catches", { p_venue_id: venueId, p_limit: 6 });
    if (error) {
      console.error("Failed to load top catches", error);
      setTopCatches([]);
    } else {
      setTopCatches(((data as CatchRow[]) ?? []).map(normalizeCatchRow));
    }
    setTopLoading(false);
  };

  const loadRecentCatches = async (venueId: string, nextOffset = 0, append = false) => {
    setRecentLoading(true);
    const limit = 12;
    const { data, error } = await supabase.rpc("get_venue_recent_catches", {
      p_venue_id: venueId,
      p_limit: limit,
      p_offset: nextOffset,
    });
    if (error) {
      console.error("Failed to load recent catches", error);
      if (!append) setRecentCatches([]);
      setRecentHasMore(false);
    } else {
      const fetched = ((data as CatchRow[]) ?? []).map(normalizeCatchRow);
      setRecentCatches(append ? [...recentCatches, ...fetched] : fetched);
      setRecentHasMore(fetched.length === limit);
      setRecentOffset(nextOffset + fetched.length);
    }
    setRecentLoading(false);
  };

  useEffect(() => {
    if (venue?.id) {
      void loadTopCatches(venue.id);
      void loadRecentCatches(venue.id, 0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.id]);

  const renderCatchesGrid = (items: CatchRow[]) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No catches to show here yet.
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((catchItem) => (
          <CatchCard key={catchItem.id} catchItem={catchItem} userId={undefined} />
        ))}
      </div>
    );
  };

  if (venueLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="section-container flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading venue…
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="section-container py-12">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Venue not found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">This venue doesn&apos;t exist or isn&apos;t published.</p>
              <Button asChild variant="outline">
                <Link to="/venues">Back to venues</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container py-8 md:py-12 space-y-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Venue</p>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">{venue.name}</h1>
              {venue.location ? (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {venue.location}
                </p>
              ) : null}
              {venue.description ? (
                <p className="text-sm text-slate-600 max-w-3xl">{venue.description}</p>
              ) : (
                <p className="text-sm text-slate-500">No description provided for this venue yet.</p>
              )}
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/venues">Back to venues</Link>
            </Button>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Top catches</h2>
              <p className="text-sm text-slate-600">Heaviest catches logged at this venue.</p>
            </div>
          </div>
          {topLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading top catches…
            </div>
          ) : topCatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              No catches have been logged at this venue yet. Be the first to log one!
            </div>
          ) : (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="grid gap-px overflow-hidden rounded-xl bg-slate-100 text-sm text-slate-700">
                  {topCatches.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 bg-white px-4 py-3 sm:grid-cols-[60px,1fr,auto] sm:px-6"
                    >
                      <div className="flex items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        #{index + 1}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={
                                item.profiles?.avatar_path
                                  ? undefined
                                  : item.profiles?.avatar_url ?? undefined
                              }
                            />
                            <AvatarFallback>{item.profiles?.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <Link
                              to={`/profile/${item.profiles?.username ?? item.user_id}`}
                              className="text-sm font-semibold text-slate-900 hover:text-primary"
                            >
                              {item.profiles?.username ?? "Unknown angler"}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {item.species ? item.species.replace(/_/g, " ") : "Species unknown"} •{" "}
                              {item.weight ? `${item.weight}${item.weight_unit === "kg" ? "kg" : "lb"}` : "Weight n/a"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 sm:text-sm">
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          <Button asChild size="sm" className="h-9 rounded-full px-4">
                            <Link to={`/catch/${item.id}`}>View catch</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Recent catches</h2>
              <p className="text-sm text-slate-600">Latest logs from this venue.</p>
            </div>
          </div>
          {renderCatchesGrid(recentCatches)}
          {recentHasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => venue && void loadRecentCatches(venue.id, recentOffset, true)}
                disabled={recentLoading}
                className="h-11 rounded-full px-6"
              >
                {recentLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default VenueDetail;
