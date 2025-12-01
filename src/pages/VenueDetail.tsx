import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

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
        console.log("Loaded venue detail", row);
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

  const refreshPhotos = async (venueId: string) => {
    setPhotosLoading(true);
    const { data, error } = await supabase.rpc("get_venue_photos", { p_venue_id: venueId, p_limit: 20, p_offset: 0 });
    if (error) {
      console.error("Failed to load venue photos", error);
      setPhotos([]);
    } else {
      setPhotos((data as VenuePhoto[]) ?? []);
    }
    setPhotosLoading(false);
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !venue?.id || (!isOwner && !isAdmin)) return;
    setPhotoUploading(true);
    const extension = photoFile.name.split(".").pop() || "jpg";
    const objectPath = `${venue.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("venue-photos")
      .upload(objectPath, photoFile, { cacheControl: "3600", upsert: false, contentType: photoFile.type });
    if (uploadError) {
      console.error("Failed to upload venue photo", uploadError);
      toast.error("Couldn't upload photo. Please try again.");
      setPhotoUploading(false);
      return;
    }
    const storagePath = `venue-photos/${objectPath}`;
    const { error } = await supabase.rpc("owner_add_venue_photo", {
      p_venue_id: venue.id,
      p_image_path: storagePath,
      p_caption: photoCaption || null,
    });
    if (error) {
      console.error("Failed to save venue photo record", error);
      toast.error("Couldn't save photo. Please try again.");
    } else {
      await refreshPhotos(venue.id);
      setPhotoFile(null);
      setPhotoCaption("");
      toast.success("Photo added");
    }
    setPhotoUploading(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!photoId || (!isOwner && !isAdmin)) return;
    const confirmed = window.confirm("Remove this photo?");
    if (!confirmed) return;
    const { error } = await supabase.rpc("owner_delete_venue_photo", { p_id: photoId });
    if (error) {
      console.error("Failed to delete venue photo", error);
      toast.error("Couldn't delete photo.");
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    toast.success("Photo removed");
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
  const statsPills: string[] = [];
  if (totalCatches > 0) {
    statsPills.push(
      `${totalCatches} catch${totalCatches === 1 ? "" : "es"} logged${recentWindow > 0 ? ` · ${recentWindow} in last 30 days` : ""}`
    );
  } else if (recentWindow > 0) {
    statsPills.push(`${recentWindow} in last 30 days`);
  }
  if (venue.top_species && venue.top_species.length > 0) {
    statsPills.push(`Most common species: ${venue.top_species[0]}`);
  }
  const fallbackCatchPhotos = recentCatches.filter((c) => c.image_url).slice(0, 4);

  const formatEventDate = (startsAt: string, endsAt: string | null) => {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const startDate = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const endTime = end ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
    return endTime ? `${startDate} · ${startTime}–${endTime}` : `${startDate} · ${startTime}`;
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}`;
  const heroTagline =
    venue.short_tagline ||
    (venue.description ? `${venue.description.split(". ").slice(0, 2).join(". ")}${venue.description.includes(".") ? "." : ""}` : "") ||
    "Details autogenerated from our venue list. Community catches coming soon.";
  const bestCatch = topCatches[0];
  const topAngler = topAnglers[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <main className="section-container space-y-5 pb-12 pt-8 md:pt-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="flex flex-col gap-5 p-6 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-8 md:p-7">
            <div className="space-y-3">
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
              <div className="space-y-2">
                <p className="max-w-3xl text-sm text-slate-100/80">{heroTagline}</p>
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
              </div>
            </div>
          </div>
        </div>

        {statsPills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {statsPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {pill}
              </span>
            ))}
          </div>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Photos</p>
              <h2 className="text-xl font-semibold text-slate-900">See the venue</h2>
            </div>
            {(isOwner || isAdmin) && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                <Input
                  placeholder="Caption (optional)"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button size="sm" onClick={() => void handleUploadPhoto()} disabled={photoUploading || !photoFile}>
                  {photoUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    "Add photo"
                  )}
                </Button>
              </div>
            )}
          </div>
          {photosLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading photos…
            </div>
          ) : photos.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible md:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => {
                const url = getPublicAssetUrl(photo.image_path);
                return (
                  <div
                    key={photo.id}
                    className="relative min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:shadow-md"
                  >
                    {url ? (
                      <img src={url} alt={photo.caption ?? "Venue photo"} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-slate-500">No image</div>
                    )}
                    {photo.caption ? (
                      <div className="px-3 py-2 text-xs text-slate-700">{photo.caption}</div>
                    ) : null}
                    {(isOwner || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => void handleDeletePhoto(photo.id)}
                        className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-white"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : fallbackCatchPhotos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">No venue photos yet — showing recent catch photos.</p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {fallbackCatchPhotos.map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                    <img src={c.image_url} alt={c.title} className="h-36 w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              No photos yet. Venue owners can upload photos from the Manage venue page.
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          {(venue.description || heroTagline) && (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">About</p>
                <h2 className="text-xl font-semibold text-slate-900">About the venue</h2>
              </div>
              {venue.description ? (
                <p className="text-sm text-slate-700 max-w-3xl">{venue.description}</p>
              ) : heroTagline ? (
                <p className="text-sm text-slate-700 max-w-3xl">{heroTagline}</p>
              ) : (
                <p className="text-sm text-slate-600">Details coming soon.</p>
              )}
            </section>
          )}

          {hasTicketsContent ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tickets &amp; booking</p>
                <h2 className="text-xl font-semibold text-slate-900">Plan your visit</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-1">
                <div className="space-y-2 text-sm text-slate-700">
                  {ticketType ? <p className="font-semibold">Ticket type: {ticketType}</p> : null}
                  {displayPriceFrom ? <p className="font-semibold">{displayPriceFrom}</p> : null}
                  {contactPhone ? <p className="font-semibold">Call: {contactPhone}</p> : null}
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
                        Book now
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <div />
          )}
        </div>

        {hasFacilities || hasBestFor ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Facilities &amp; best for</p>
              <h2 className="text-xl font-semibold text-slate-900">On-site &amp; style</h2>
            </div>
            <div className="space-y-3">
              {hasBestFor ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best for</p>
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
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facilities</p>
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
            </div>
          </section>
        ) : null}

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
                    <Link to="/catch/new">Log a catch at this venue</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-3">
                {recentCatches.length > 0 ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent catches</p>
                      <h3 className="text-lg font-semibold text-slate-900">Latest from the community</h3>
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
                  </>
                ) : null}
              </div>
              <div className="space-y-4">
                {topCatches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top catches</p>
                      <h3 className="text-lg font-semibold text-slate-900">Heaviest catches logged here</h3>
                    </div>
                    {topLoading ? (
                      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Loading top catches…
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
                  </div>
                ) : null}

                {topAnglers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top anglers</p>
                      <h3 className="text-lg font-semibold text-slate-900">Most active anglers at this venue</h3>
                    </div>
                    {topAnglersLoading ? (
                      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading top anglers…
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory sm:grid sm:grid-cols-1 sm:gap-3">
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
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default VenueDetail;
