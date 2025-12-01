import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { CatchCard } from "@/components/feed/CatchCard";
import { isAdminUser } from "@/lib/admin";
import { useAuth } from "@/components/AuthProvider";

type Venue = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  short_tagline: string | null;
  ticket_type: string | null;
  price_from: string | null;
  best_for_tags: string[] | null;
  facilities: string[] | null;
  website_url: string | null;
  booking_url: string | null;
  contact_phone: string | null;
  notes_for_rr_team: string | null;
  total_catches: number | null;
  recent_catches_30d: number | null;
  headline_pb_weight: number | null;
  headline_pb_unit: string | null;
  headline_pb_species: string | null;
  top_species: string[] | null;
};

type CatchRow = {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string | null;
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
  venues?: {
    id?: string;
    slug: string;
    name: string;
  } | null;
};

type VenueEvent = {
  id: string;
  venue_id: string;
  title: string;
  event_type: string | null;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  ticket_info: string | null;
  website_url: string | null;
  booking_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

const normalizeCatchRow = (row: CatchRow): CatchRow => ({
  ...row,
  profiles: row.profiles ?? { username: "Unknown", avatar_path: null, avatar_url: null },
  ratings: (row.ratings as any) ?? [],
  comments: (row.comments as any) ?? [],
  reactions: (row.reactions as any) ?? [],
  venues: row.venues ?? null,
});

type TopAngler = {
  user_id: string;
  username: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  catch_count: number;
  best_weight: number | null;
  best_weight_unit: string | null;
  last_catch_at: string | null;
};

const VenueDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [topCatches, setTopCatches] = useState<CatchRow[]>([]);
  const [recentCatches, setRecentCatches] = useState<CatchRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [recentOffset, setRecentOffset] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(true);
  const [topAnglers, setTopAnglers] = useState<TopAngler[]>([]);
  const [topAnglersLoading, setTopAnglersLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<VenueEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pastEvents, setPastEvents] = useState<VenueEvent[]>([]);
  const [pastEventsLoading, setPastEventsLoading] = useState(false);
  const [pastOffset, setPastOffset] = useState(0);
  const [pastHasMore, setPastHasMore] = useState(true);
  const [eventsTab, setEventsTab] = useState<"upcoming" | "past">("upcoming");

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

  const loadTopAnglers = async (venueId: string) => {
    setTopAnglersLoading(true);
    const { data, error } = await supabase.rpc("get_venue_top_anglers", {
      p_venue_id: venueId,
      p_limit: 12,
    });
    if (error) {
      console.error("Failed to load top anglers", error);
      setTopAnglers([]);
    } else {
      setTopAnglers((data as TopAngler[]) ?? []);
    }
    setTopAnglersLoading(false);
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

  const loadUpcomingEvents = async (venueId: string) => {
    setEventsLoading(true);
    const { data, error } = await supabase.rpc("get_venue_upcoming_events", {
      p_venue_id: venueId,
    });
    if (error) {
      console.error("Failed to load events", error);
      setUpcomingEvents([]);
    } else {
      setUpcomingEvents((data as VenueEvent[]) ?? []);
    }
    setEventsLoading(false);
  };

  const loadPastEvents = async (venueId: string, nextOffset = 0, append = false) => {
    setPastEventsLoading(true);
    const limit = 10;
    const { data, error } = await supabase.rpc("get_venue_past_events", {
      p_venue_id: venueId,
      p_limit: limit,
      p_offset: nextOffset,
    });
    if (error) {
      console.error("Failed to load past events", error);
      if (!append) setPastEvents([]);
      setPastHasMore(false);
    } else {
      const fetched = (data as VenueEvent[]) ?? [];
      setPastEvents(append ? [...pastEvents, ...fetched] : fetched);
      setPastHasMore(fetched.length === limit);
      setPastOffset(nextOffset + fetched.length);
    }
    setPastEventsLoading(false);
  };

  useEffect(() => {
    if (venue?.id) {
      void loadTopCatches(venue.id);
      void loadTopAnglers(venue.id);
      void loadRecentCatches(venue.id, 0, false);
      void loadUpcomingEvents(venue.id);
      void loadPastEvents(venue.id, 0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.id]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const adminStatus = await isAdminUser(user.id);
      setIsAdmin(adminStatus);
    };
    void checkAdmin();
  }, [user]);

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

  const formatEventDate = (startsAt: string, endsAt: string | null) => {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const startDate = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const endTime = end ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
    return endTime ? `${startDate} · ${startTime}–${endTime}` : `${startDate} · ${startTime}`;
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}`;
  const totalCatches = venue.total_catches ?? 0;
  const recentWindow = venue.recent_catches_30d ?? 0;
  const catchCountLabel =
    totalCatches > 0 ? `${totalCatches} catch${totalCatches === 1 ? "" : "es"} logged here` : "No catches logged here yet";
  const recentCountLabel = recentWindow > 0 ? `${recentWindow} in the last 30 days` : "";
  const topSpeciesLine =
    venue.top_species && venue.top_species.length > 0
      ? `Top species here: ${venue.top_species.slice(0, 3).join(", ")}`
      : "";
  const bestCatch = topCatches[0];
  const topAngler = topAnglers[0];
  const bestCatchLabel = bestCatch
    ? `${bestCatch.weight ? `${bestCatch.weight}${bestCatch.weight_unit === "kg" ? "kg" : "lb"}` : "—"} ${bestCatch.species ? bestCatch.species.replace(/_/g, " ") : ""}`.trim()
    : "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container space-y-7 pb-12 pt-8 md:pt-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="flex flex-col gap-5 p-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-8 md:p-7">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                <Link to="/venues" className="hover:underline">
                  Venues
                </Link>{" "}
                / <span className="text-sky-300">{venue.name}</span>
              </p>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">Venue</p>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">{venue.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                {venue.location ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                    <MapPin className="h-4 w-4 text-slate-200" />
                    <span>{venue.location}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                  {catchCountLabel}
                </span>
                {recentCountLabel ? (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                    {recentCountLabel}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="max-w-3xl text-sm text-slate-100/80">
                  {venue.short_tagline ||
                    venue.description ||
                    "Details autogenerated from our venue list. Community catches coming soon."}
                </p>
                {topSpeciesLine ? <p className="text-xs text-slate-200/80">{topSpeciesLine}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border border-white/60 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Link to="/venues">Back to venues</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15"
                >
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                    View on maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {isAdmin ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15"
                  >
                    <Link to={`/admin/venues/${venue.slug}`}>Edit venue</Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4">
              {venue.price_from || (venue.best_for_tags && venue.best_for_tags.length > 0) ? (
                <div className="space-y-2">
                  {venue.price_from ? (
                    <p className="text-sm font-semibold text-white">From {venue.price_from}</p>
                  ) : null}
                  {venue.best_for_tags && venue.best_for_tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {venue.best_for_tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Best logged catch</p>
                <p className="text-lg font-semibold text-white">{bestCatchLabel || "—"}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Most active angler</p>
                {topAngler ? (
                  <Link
                    to={`/profile/${topAngler.username ?? topAngler.user_id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 transition hover:border-white/30 hover:bg-white/15"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={
                          topAngler.avatar_path
                            ? undefined
                            : topAngler.avatar_url ?? undefined
                        }
                      />
                      <AvatarFallback>{(topAngler.username ?? "A")[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-semibold text-white">
                      {topAngler.username ?? "Unknown angler"}
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-slate-200/80">Most active angler: —</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {((venue.facilities && venue.facilities.length > 0) ||
          venue.website_url ||
          venue.booking_url ||
          venue.contact_phone) && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Venue info</p>
              <h2 className="text-xl font-semibold text-slate-900">Plan your visit</h2>
              <p className="text-sm text-slate-600">Quick details to help you decide.</p>
            </div>
            {venue.facilities && venue.facilities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {venue.facilities.slice(0, 8).map((facility) => (
                  <span
                    key={facility}
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {facility}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              {venue.website_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  asChild
                >
                  <a href={venue.website_url} target="_blank" rel="noreferrer">
                    Visit website
                  </a>
                </Button>
              ) : null}
              {venue.booking_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  asChild
                >
                  <a href={venue.booking_url} target="_blank" rel="noreferrer">
                    Book tickets
                  </a>
                </Button>
              ) : null}
              {venue.contact_phone ? (
                <span className="text-sm font-semibold text-slate-700">Call: {venue.contact_phone}</span>
              ) : null}
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Venue updates</p>
            <h2 className="text-xl font-semibold text-slate-900">Events & announcements</h2>
            <p className="text-sm text-slate-600">Matches, open days, and announcements from this venue.</p>
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-semibold text-slate-700">
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${eventsTab === "upcoming" ? "bg-white shadow-sm" : ""}`}
              onClick={() => setEventsTab("upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${eventsTab === "past" ? "bg-white shadow-sm" : ""}`}
              onClick={() => setEventsTab("past")}
            >
              Past
            </button>
          </div>

          {eventsTab === "upcoming" ? (
            eventsLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading events…
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-600">
                No upcoming events — check back soon.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Card key={event.id} className="border border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {formatEventDate(event.starts_at, event.ends_at)}
                          </p>
                        </div>
                        {event.event_type ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                            {event.event_type}
                          </span>
                        ) : null}
                      </div>
                      {event.description ? (
                        <p className="text-sm text-slate-600 line-clamp-3">{event.description}</p>
                      ) : null}
                      {event.ticket_info ? (
                        <p className="text-xs font-semibold text-slate-700">Tickets: {event.ticket_info}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        {event.booking_url ? (
                          <Button asChild size="sm" variant="outline" className="rounded-full">
                            <a href={event.booking_url} target="_blank" rel="noreferrer">
                              Book now
                            </a>
                          </Button>
                        ) : event.website_url ? (
                          <Button asChild size="sm" variant="outline" className="rounded-full">
                            <a href={event.website_url} target="_blank" rel="noreferrer">
                              More details
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : pastEventsLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading past events…
            </div>
          ) : pastEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-600">
              No past events yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pastEvents.map((event) => (
                <Card key={event.id} className="border border-slate-200 bg-white shadow-sm">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {formatEventDate(event.starts_at, event.ends_at)}
                        </p>
                      </div>
                      {event.event_type ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {event.event_type}
                        </span>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="text-sm text-slate-500 line-clamp-3">{event.description}</p>
                    ) : null}
                    {event.ticket_info ? (
                      <p className="text-xs font-semibold text-slate-600">Tickets: {event.ticket_info}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      {event.booking_url ? (
                        <Button asChild size="sm" variant="outline" className="rounded-full">
                          <a href={event.booking_url} target="_blank" rel="noreferrer">
                            Book now
                          </a>
                        </Button>
                      ) : event.website_url ? (
                        <Button asChild size="sm" variant="outline" className="rounded-full">
                          <a href={event.website_url} target="_blank" rel="noreferrer">
                            More details
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pastHasMore ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-4"
                    disabled={pastEventsLoading}
                    onClick={() => venue && void loadPastEvents(venue.id, pastOffset, true)}
                  >
                    {pastEventsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      "Load more past events"
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Leaderboards</p>
            <h2 className="text-xl font-semibold text-slate-900">Top anglers at this venue</h2>
            <p className="text-sm text-slate-600">
              {topAnglers.length === 1 ? "Most active angler at this venue." : "Based on catches logged on ReelyRated."}
            </p>
          </div>
          {topAnglersLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading top anglers…
            </div>
          ) : topAnglers.length === 0 ? (
            <p className="text-sm text-slate-600">No catches logged at this venue yet.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {topAnglers.map((angler, idx) => (
                <Link
                  key={angler.user_id}
                  to={`/profile/${angler.username ?? angler.user_id}`}
                  className={`flex min-w-[240px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:min-w-0 snap-start ${idx === 0 ? "bg-primary/5 border-primary/50" : ""}`}
                >
                  <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold ${idx === 0 ? "text-primary" : "text-slate-600"}`}>
                    #{idx + 1}
                  </span>
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    <AvatarImage
                      src={
                        angler.avatar_path
                          ? undefined
                          : angler.avatar_url ?? undefined
                      }
                    />
                    <AvatarFallback>{(angler.username ?? "A")[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 items-center justify-between gap-3 overflow-hidden">
                    <div className="space-y-1 overflow-hidden">
                      <div className="truncate text-sm font-semibold text-slate-900">{angler.username ?? "Unknown angler"}</div>
                      <div className="text-xs text-slate-600">
                        {angler.catch_count} catch{angler.catch_count === 1 ? "" : "es"} logged
                      </div>
                      {angler.best_weight ? (
                        <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          PB {angler.best_weight}
                          {angler.best_weight_unit === "kg" ? "kg" : "lb"}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[11px] font-semibold text-primary">View profile</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Leaderboards</p>
            <h2 className="text-xl font-semibold text-slate-900">Top catches</h2>
            <p className="text-sm text-slate-600">Heaviest catches logged at this venue.</p>
          </div>
          {topLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading top catches…
            </div>
          ) : topCatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              No catches logged at this venue yet. Be the first to add one.
            </div>
          ) : (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="grid gap-px overflow-hidden rounded-xl bg-slate-100 text-sm text-slate-700">
                  {topCatches.map((item, index) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[auto,1fr] items-start gap-4 bg-white px-4 py-4 sm:grid-cols-[120px,1fr,auto] sm:px-6 ${index === 0 ? "border-l-4 border-primary/40 bg-primary/5" : ""} hover:bg-slate-50`}
                    >
                      <div className="flex flex-col items-start gap-2 sm:items-start">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">#{index + 1}</span>
                        <div className="flex flex-col gap-1 text-xs text-slate-700">
                          <span className="text-sm font-bold text-slate-900">
                            {item.weight ? `${item.weight}${item.weight_unit === "kg" ? "kg" : "lb"}` : "Weight n/a"}
                          </span>
                          <span className="line-clamp-1 text-slate-500">
                            {item.species ? item.species.replace(/_/g, " ") : "Species unknown"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 border-l border-slate-100 pl-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pl-4">
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
                              className="line-clamp-1 text-sm font-semibold text-slate-900 hover:text-primary"
                            >
                              {item.profiles?.username ?? "Unknown angler"}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {item.species ? item.species.replace(/_/g, " ") : "Species unknown"} •{" "}
                              {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center sm:justify-end">
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

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
              <h2 className="text-lg font-semibold text-slate-900">Recent catches</h2>
              <p className="text-sm text-slate-600">Latest logs from this venue.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-9 rounded-full px-4 text-sm text-primary">
              View all catches from this venue
            </Button>
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
