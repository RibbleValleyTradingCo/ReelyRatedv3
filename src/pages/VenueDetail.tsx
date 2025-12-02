import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, Loader2, MapPin, Sparkles, Fish, Star } from "lucide-react";
import { CatchCard } from "@/components/feed/CatchCard";
import { isAdminUser } from "@/lib/admin";
import { useAuth } from "@/components/AuthProvider";
import { getPublicAssetUrl } from "@/lib/storage";
import { toast } from "sonner";

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
  avg_rating: number | null;
  rating_count: number | null;
};

type VenuePhoto = {
  id: string;
  venue_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  created_by: string | null;
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
  const [isOwner, setIsOwner] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<VenueEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pastEvents, setPastEvents] = useState<VenueEvent[]>([]);
  const [pastEventsLoading, setPastEventsLoading] = useState(false);
  const [pastOffset, setPastOffset] = useState(0);
  const [pastHasMore, setPastHasMore] = useState(true);
  const [eventsTab, setEventsTab] = useState<"upcoming" | "past">("upcoming");
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

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
        setAvgRating(row?.avg_rating ?? null);
        setRatingCount(row?.rating_count ?? null);
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
    const loadPhotos = async () => {
      if (!venue?.id) return;
      setPhotosLoading(true);
      const { data, error } = await supabase.rpc("get_venue_photos", { p_venue_id: venue.id, p_limit: 20, p_offset: 0 });
      if (error) {
        console.error("Failed to load venue photos", error);
        setPhotos([]);
      } else {
        setPhotos((data as VenuePhoto[]) ?? []);
      }
      setPhotosLoading(false);
    };
    void loadPhotos();
  }, [venue?.id]);

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

  useEffect(() => {
    const checkOwner = async () => {
      if (!venue?.id || !user) {
        setIsOwner(false);
        return;
      }
      const { data, error } = await supabase
        .from("venue_owners")
        .select("venue_id")
        .eq("venue_id", venue.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) {
        setIsOwner(false);
        return;
      }
      setIsOwner(true);
    };
    void checkOwner();
  }, [user, venue?.id]);

  useEffect(() => {
    const loadUserRating = async () => {
      if (!venue?.id || !user) {
        setUserRating(null);
        return;
      }
      const { data, error } = await supabase.rpc("get_my_venue_rating", {
        p_venue_id: venue.id,
      });
      if (error) {
        console.error("Failed to load your venue rating", error);
        return;
      }
      const row = (data as { venue_id: string; user_rating: number }[] | null)?.[0];
      if (row?.user_rating) {
        setUserRating(row.user_rating);
      } else {
        setUserRating(null);
      }
    };
    void loadUserRating();
  }, [user, venue?.id]);

  const handleRatingSelect = async (rating: number) => {
    if (!venue?.id || !user || ratingLoading) return;
    setRatingLoading(true);
    const { data, error } = await supabase.rpc("upsert_venue_rating", {
      p_venue_id: venue.id,
      p_rating: rating,
    });
    if (error) {
      console.error("Failed to submit rating", error);
      toast.error("Could not save your rating. Please try again.");
      setRatingLoading(false);
      return;
    }
    const row = (data as { venue_id: string; avg_rating: number | null; rating_count: number | null; user_rating: number | null }[] | null)?.[0];
    setAvgRating(row?.avg_rating ?? null);
    setRatingCount(row?.rating_count ?? null);
    setUserRating(row?.user_rating ?? rating);
    toast.success("Thanks for rating this venue!");
    setRatingLoading(false);
  };

  const StarRating = ({
    value,
    onSelect,
    disabled,
  }: {
    value: number | null;
    onSelect?: (next: number) => void;
    disabled?: boolean;
  }) => {
    const current = value ?? 0;
    return (
      <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = current >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={filled}
              disabled={disabled}
              onClick={() => onSelect?.(star)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(star);
                }
              }}
              className={`rounded-full p-1 transition ${disabled ? "cursor-not-allowed opacity-60" : "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"}`}
            >
              <Star className={`h-4 w-4 ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            </button>
          );
        })}
      </div>
    );
  };

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

  const ticketType = venue.ticket_type?.trim() ?? "";
  const priceFrom = venue.price_from?.trim() ?? "";
  const websiteUrl = venue.website_url?.trim() ?? "";
  const bookingUrl = venue.booking_url?.trim() ?? "";
  const contactPhone = venue.contact_phone?.trim() ?? "";
  const totalCatches = venue.total_catches ?? 0;
  const recentWindow = venue.recent_catches_30d ?? 0;
  const facilities = (venue.facilities ?? []).filter(Boolean);
  const bestForTags = (venue.best_for_tags ?? []).filter(Boolean);
  const hasTicketsContent = !!ticketType || !!priceFrom || !!websiteUrl || !!bookingUrl || !!contactPhone;
  const hasFacilities = facilities.length > 0;
  const hasBestFor = bestForTags.length > 0;
  const normalize = (value: string) => value.trim().toLowerCase();
  const bestForSet = new Set(bestForTags.map((tag) => normalize(tag)));
  const filteredFacilities = facilities.filter((item) => !bestForSet.has(normalize(item)));
  const getDisplayPriceFrom = (raw: string | null | undefined) => {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.toLowerCase().startsWith("from ")) return trimmed;
    return `From ${trimmed}`;
  };
  const displayPriceFrom = getDisplayPriceFrom(venue.price_from);
  const hasPlanContent = hasTicketsContent || hasBestFor || hasFacilities;
  const fallbackCatchPhotos = recentCatches.filter((c) => c.image_url).slice(0, 4);
  const featuredCatch = topCatches[0];
  const humanizeSpecies = (species?: string | null) =>
    species ? species.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Species unknown";
  const topSpeciesLabel =
    venue.top_species && venue.top_species.length > 0 ? humanizeSpecies(venue.top_species[0]) : "Not enough data yet";
  const heroTagline =
    venue.short_tagline ||
    (venue.description ? `${venue.description.split(". ").slice(0, 2).join(". ")}${venue.description.includes(".") ? "." : ""}` : "") ||
    "Details autogenerated from our venue list. Community catches coming soon.";
  const aboutText =
    venue.description || heroTagline || "Details coming soon.";
  const heroImage =
    photos.length > 0
      ? getPublicAssetUrl(photos[0].image_path)
      : fallbackCatchPhotos.length > 0
      ? fallbackCatchPhotos[0].image_url
      : null;

  const formatEventDate = (startsAt: string, endsAt: string | null) => {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const startDate = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const endTime = end ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
    return endTime ? `${startDate} · ${startTime}–${endTime}` : `${startDate} · ${startTime}`;
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}`;
  const hasRatings = (ratingCount ?? 0) > 0;
  const formattedAvg = avgRating ? Number(avgRating).toFixed(1) : null;
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container space-y-5 pb-12 pt-8 md:pt-10">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] md:items-start">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-lg">
            <div className="flex flex-col gap-5 p-6 md:p-7">
              <div className="space-y-3 md:max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                  <Link to="/venues" className="hover:underline">
                    Venues
                  </Link>{" "}
                  / <span className="text-sky-300">{venue.name}</span>
                </p>
                <h1 className="text-3xl font-bold leading-tight md:text-4xl">{venue.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                  {venue.location ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <MapPin className="h-4 w-4 text-slate-200" />
                      <span>{venue.location}</span>
                    </span>
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm text-slate-100/80">{heroTagline}</p>
                <div className="space-y-2 rounded-xl bg-white/5 p-3 text-sm text-slate-100/90 ring-1 ring-white/10">
                  <div className="flex flex-col gap-1">
                    {hasRatings ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                        <span className="text-sm font-semibold text-white">{formattedAvg}</span>
                        <span className="text-xs text-slate-200/80">Rated by {ratingCount} angler{(ratingCount ?? 0) === 1 ? "" : "s"} on ReelyRated</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200/80">No ratings yet. Be the first to rate this venue.</p>
                    )}
                  </div>
                  {user ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200/90">Your rating</span>
                      <div className="flex items-center gap-2">
                        <StarRating value={userRating} onSelect={handleRatingSelect} disabled={ratingLoading} />
                        {userRating ? (
                          <span className="text-xs text-slate-200/80">You rated this {userRating} star{userRating === 1 ? "" : "s"}</span>
                        ) : (
                          <span className="text-xs text-slate-200/80">Tap a star to leave your rating</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-200/80">
                      <Link to="/auth" className="underline hover:text-white">
                        Log in
                      </Link>{" "}
                      to rate this venue.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button asChild size="sm" className="h-9 rounded-full px-4 text-xs font-semibold shadow-md">
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      View on maps
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  {websiteUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border border-white/60 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      <a href={websiteUrl} target="_blank" rel="noreferrer">
                        Visit website
                      </a>
                    </Button>
                  ) : null}
                  {bookingUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border border-white/60 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      <a href={bookingUrl} target="_blank" rel="noreferrer">
                        Book now
                      </a>
                    </Button>
                  ) : null}
                  {contactPhone ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-full border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15"
                    >
                      <a href={`tel:${contactPhone}`}>Call</a>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15"
                  >
                    <Link to="/venues">Back to venues</Link>
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
                  ) : isOwner ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-full border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15"
                    >
                      <Link to={`/my/venues/${venue.slug}`}>Manage venue</Link>
                    </Button>
                  ) : null}
                  {user ? (
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-full px-4 text-xs font-semibold"
                    >
                      <Link to={`/add-catch${venue.slug ? `?venue=${venue.slug}` : ""}`}>Log a catch here</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
            {heroImage ? (
              <img
                src={heroImage}
                alt={`${venue.name} hero`}
                className="h-48 w-full object-cover sm:h-56 md:h-64"
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 text-sm text-slate-200 sm:h-56 md:h-64">
                Venue photos coming soon
              </div>
            )}
            <div className="border-t border-white/10 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/80">
              Venue image
            </div>
          </div>
        </div>

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">About this venue</p>
          <h2 className="text-xl font-semibold text-slate-900">About {venue.name}</h2>
          <p className="max-w-4xl text-sm text-slate-800">{aboutText}</p>
          {!(venue.description || heroTagline) && (isAdmin || isOwner) ? (
            <p className="text-xs text-slate-500">Add more information about this venue from the Manage venue page.</p>
          ) : null}
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Catches logged
              </div>
              <p className="text-3xl font-bold text-slate-900">{totalCatches}</p>
              <p className="text-sm text-slate-600">{totalCatches > 0 ? "Total catches on ReelyRated" : "No catches logged yet"}</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Last 30 days
              </div>
              <p className="text-3xl font-bold text-slate-900">{recentWindow}</p>
              <p className="text-sm text-slate-600">
                {recentWindow > 0 ? "Catches in the last 30 days" : "No catches in the last 30 days"}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                <Fish className="h-3.5 w-3.5" />
                Heaviest catch here
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {featuredCatch?.weight
                  ? `${featuredCatch.weight}${featuredCatch.weight_unit === "kg" ? "kg" : "lb"} ${humanizeSpecies(featuredCatch.species)}`
                  : "Not enough data yet"}
              </p>
              <p className="text-sm text-slate-600">Based on catches logged here</p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
          <div className="bg-gradient-to-r from-primary/10 to-slate-50 px-6 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Visiting Us</p>
            <h2 className="text-lg font-semibold text-slate-900">What this place is like</h2>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
            <div className="space-y-2">
              <p className="text-sm text-slate-800">Photos curated by the venue and community.</p>
              {!(venue.description || heroTagline) && (isAdmin || isOwner) ? (
                <p className="text-xs text-slate-500">Admins/owners can add details from the Edit / Manage venue page.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {photosLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading photos…
                </div>
              ) : photos.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible md:grid-cols-2">
                  {photos.slice(0, 6).map((photo) => {
                    const url = getPublicAssetUrl(photo.image_path);
                    return (
                      <div key={photo.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                        {url ? (
                          <img src={url} alt={photo.caption ?? "Venue photo"} className="h-40 w-full object-cover" />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-sm text-slate-500">No image</div>
                        )}
                        {photo.caption ? (
                          <div className="px-3 py-2 text-xs text-slate-700">{photo.caption}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : fallbackCatchPhotos.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">No venue photos yet — showing recent catch photos.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fallbackCatchPhotos.map((c) => (
                      <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                        <img src={c.image_url} alt={c.title} className="h-36 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No photos yet. {isOwner || isAdmin ? "Owners can add venue photos from the Manage venue page." : ""}
                </div>
              )}
            </div>
          </div>
        </section>

        {(hasPlanContent || isOwner || isAdmin) && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Socials &amp; contact</p>
              <h2 className="text-xl font-semibold text-slate-900">Plan your visit</h2>
              <p className="text-sm text-slate-600">How to book, who to call, and what to expect on-site.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
              <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tickets &amp; pricing</p>
                  {ticketType || displayPriceFrom ? (
                    <p className="text-base font-semibold text-slate-900">
                      {ticketType ? `${ticketType}` : ""}
                      {ticketType && displayPriceFrom ? " • " : ""}
                      {displayPriceFrom || ""}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">Ticket details coming soon.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                  {contactPhone ? (
                    <p className="font-semibold text-slate-900">Call: {contactPhone}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Phone number not provided.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {websiteUrl ? (
                    <Button variant="outline" size="sm" className="rounded-full" asChild>
                      <a href={websiteUrl} target="_blank" rel="noreferrer">
                        Visit website
                      </a>
                    </Button>
                  ) : null}
                  {bookingUrl ? (
                    <Button variant="outline" size="sm" className="rounded-full" asChild>
                      <a href={bookingUrl} target="_blank" rel="noreferrer">
                        Book online
                      </a>
                    </Button>
                  ) : null}
                </div>
                {!(ticketType || displayPriceFrom || contactPhone || websiteUrl || bookingUrl) && (isOwner || isAdmin) ? (
                  <p className="text-xs text-slate-500">Owners can add contact and booking info from Edit / Manage venue.</p>
                ) : null}
              </div>
              <div className="space-y-4">
                {hasBestFor ? (
                  <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Best for</p>
                    <div className="flex flex-wrap gap-2">
                      {bestForTags.slice(0, 12).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {hasFacilities || filteredFacilities.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Facilities</p>
                    <div className="flex flex-wrap gap-2">
                      {(filteredFacilities.length > 0 ? filteredFacilities : facilities).slice(0, 12).map((facility) => (
                        <span
                          key={facility}
                          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {facility}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!hasBestFor && !hasFacilities && (isOwner || isAdmin) ? (
                  <p className="text-xs text-slate-500">Owners can add facilities and best-for tags from Edit / Manage venue.</p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        { (upcomingEvents.length > 0 || pastEvents.length > 0) ? (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Events &amp; announcements</p>
              <h2 className="text-xl font-semibold text-slate-900">Updates from this venue</h2>
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
        ) : null}

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Community catches</p>
            <h2 className="text-xl font-semibold text-slate-900">What anglers are logging here</h2>
          </div>

          {totalCatches <= 0 ? (
            <Card className="border border-dashed border-slate-300 bg-white shadow-sm">
              <CardContent className="space-y-2 p-5 text-sm text-slate-600">
                <p>No catches have been logged at this venue yet.</p>
                <p>Be the first to add one from your catch log.</p>
                {user ? (
                  <Button asChild className="rounded-full">
                    <Link to={`/add-catch${venue.slug ? `?venue=${venue.slug}` : ""}`}>Log a catch at this venue</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent catches</p>
                  <h3 className="text-lg font-semibold text-slate-900">Latest from the community</h3>
                </div>
                {renderCatchesGrid(recentCatches)}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="ghost" size="sm" className="rounded-full px-4 text-sm text-primary">
                    <Link to={`/feed?venue=${venue.slug}`}>View all catches from this venue</Link>
                  </Button>
                  {recentHasMore ? (
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
                  ) : null}
                </div>
              </div>

              {topCatches.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top catches</p>
                      <h3 className="text-lg font-semibold text-slate-900">Heaviest catches logged here</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Species</span>
                      <select
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        value={selectedSpecies}
                        onChange={(e) => setSelectedSpecies(e.target.value)}
                      >
                        <option value="all">All species</option>
                        {[...new Set(topCatches.map((c) => (c.species ? c.species.replace(/_/g, " ") : "")))]
                          .filter((s) => s)
                          .map((species) => (
                            <option key={species} value={species}>
                              {species}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {topLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading top catches…
                    </div>
                  ) : (
                    <Card className="border border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-0">
                        <div className="divide-y divide-slate-100 text-sm text-slate-700">
                          {topCatches
                            .filter(
                              (item) => selectedSpecies === "all" || (item.species ? item.species.replace(/_/g, " ") : "") === selectedSpecies
                            )
                            .slice(0, 3)
                            .map((item, index) => (
                              <div
                                key={item.id}
                                className={`flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                                  index === 0 ? "border-l-4 border-primary/40 bg-primary/5" : ""
                                } hover:bg-slate-50`}
                              >
                                <div className="flex items-start gap-3 sm:items-center">
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">#{index + 1}</span>
                                  <div className="space-y-1">
                                    <p className="text-base font-bold text-slate-900">
                                      {item.weight ? `${item.weight}${item.weight_unit === "kg" ? "kg" : "lb"}` : "Weight n/a"}
                                    </p>
                                    <p className="text-xs text-slate-500">{item.species ? item.species.replace(/_/g, " ") : "Species unknown"}</p>
                                    <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex flex-1 items-center justify-between gap-3 sm:justify-end">
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
                                    <Link
                                      to={`/profile/${item.profiles?.username ?? item.user_id}`}
                                      className="text-sm font-semibold text-slate-900 hover:text-primary"
                                    >
                                      {item.profiles?.username ?? "Unknown angler"}
                                    </Link>
                                  </div>
                                  <Button asChild size="sm" className="h-9 rounded-full px-4">
                                    <Link to={`/catch/${item.id}`}>View catch</Link>
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null}

            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default VenueDetail;
