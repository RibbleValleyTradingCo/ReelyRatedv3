import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Venue = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  short_tagline: string | null;
  description: string | null;
  ticket_type: string | null;
  best_for_tags: string[] | null;
  facilities: string[] | null;
  price_from: string | null;
  website_url: string | null;
  booking_url: string | null;
  contact_phone: string | null;
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
  contact_phone: string | null;
  is_published: boolean;
};

const MyVenueEdit = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [form, setForm] = useState({
    short_tagline: "",
    description: "",
    ticket_type: "",
    best_for_tags: "",
    facilities: "",
    price_from: "",
    website_url: "",
    booking_url: "",
    contact_phone: "",
  });
  const [eventForm, setEventForm] = useState({
    id: "" as string | "",
    title: "",
    event_type: "",
    starts_at: "",
    ends_at: "",
    description: "",
    ticket_info: "",
    website_url: "",
    booking_url: "",
    contact_phone: "",
    is_published: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    const loadVenue = async () => {
      if (!slug || !user) return;
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_venue_by_slug", { p_slug: slug });
      if (error) {
        console.error("Failed to load venue", error);
        toast.error("Unable to load venue");
        setVenue(null);
        setIsLoading(false);
        return;
      }
      const row = (data as Venue[] | null)?.[0] ?? null;
      setVenue(row);
      setForm({
        short_tagline: row?.short_tagline ?? "",
        description: row?.description ?? "",
        ticket_type: row?.ticket_type ?? "",
        best_for_tags: (row?.best_for_tags ?? []).join(", "),
        facilities: (row?.facilities ?? []).join(", "),
        price_from: row?.price_from ?? "",
        website_url: row?.website_url ?? "",
        booking_url: row?.booking_url ?? "",
        contact_phone: row?.contact_phone ?? "",
      });
      if (row?.id) {
        const { data: ownerRow } = await supabase
          .from("venue_owners")
          .select("venue_id")
          .eq("venue_id", row.id)
          .eq("user_id", user.id)
          .maybeSingle();
        const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
        setIsOwner(Boolean(ownerRow) || Boolean(adminRow));
      }
      setIsLoading(false);
    };
    void loadVenue();
  }, [slug, user]);

  useEffect(() => {
    const loadEvents = async () => {
      if (!venue?.id || !isOwner) return;
      setEventsLoading(true);
      const { data, error } = await supabase.rpc("owner_get_venue_events", { p_venue_id: venue.id });
      if (error) {
        console.error("Failed to load events", error);
        toast.error("Unable to load events");
        setEvents([]);
      } else {
        setEvents((data as VenueEvent[]) ?? []);
      }
      setEventsLoading(false);
    };
    void loadEvents();
  }, [isOwner, venue?.id]);

  const parseCsv = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!venue?.id) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("owner_update_venue_metadata", {
      p_venue_id: venue.id,
      p_tagline: form.short_tagline || null,
      p_description: form.description || null,
      p_ticket_type: form.ticket_type || null,
      p_best_for_tags: parseCsv(form.best_for_tags),
      p_facilities: parseCsv(form.facilities),
      p_price_from: form.price_from || null,
      p_website_url: form.website_url || null,
      p_booking_url: form.booking_url || null,
      p_contact_phone: form.contact_phone || null,
    });
    if (error) {
      console.error("Failed to update venue", error);
      toast.error("Failed to save changes");
    } else {
      toast.success("Venue updated");
      console.log("Updated venue from owner_update_venue_metadata", data);
    }
    setSaving(false);
  };

  const resetEventForm = () =>
    setEventForm({
      id: "",
      title: "",
      event_type: "",
      starts_at: "",
      ends_at: "",
      description: "",
      ticket_info: "",
      website_url: "",
      booking_url: "",
      contact_phone: "",
      is_published: false,
    });

  const handleEditEvent = (event?: VenueEvent) => {
    if (!event) {
      resetEventForm();
      return;
    }
    setEventForm({
      id: event.id,
      title: event.title ?? "",
      event_type: event.event_type ?? "",
      starts_at: event.starts_at ?? "",
      ends_at: event.ends_at ?? "",
      description: event.description ?? "",
      ticket_info: event.ticket_info ?? "",
      website_url: event.website_url ?? "",
      booking_url: event.booking_url ?? "",
      contact_phone: event.contact_phone ?? "",
      is_published: event.is_published ?? false,
    });
  };

  const handleSaveEvent = async () => {
    if (!venue?.id || !isOwner) return;
    setEventSaving(true);
    if (eventForm.id) {
      const { error } = await supabase.rpc("owner_update_venue_event", {
        p_event_id: eventForm.id,
        p_title: eventForm.title,
        p_event_type: eventForm.event_type || null,
        p_starts_at: eventForm.starts_at,
        p_ends_at: eventForm.ends_at || null,
        p_description: eventForm.description || null,
        p_ticket_info: eventForm.ticket_info || null,
        p_website_url: eventForm.website_url || null,
        p_booking_url: eventForm.booking_url || null,
        p_contact_phone: eventForm.contact_phone || null,
        p_is_published: eventForm.is_published,
      });
      if (error) {
        console.error("Failed to update event", error);
        toast.error("Failed to update event");
      } else {
        toast.success("Event updated");
      }
    } else {
      const { error } = await supabase.rpc("owner_create_venue_event", {
        p_venue_id: venue.id,
        p_title: eventForm.title,
        p_event_type: eventForm.event_type || null,
        p_starts_at: eventForm.starts_at,
        p_ends_at: eventForm.ends_at || null,
        p_description: eventForm.description || null,
        p_ticket_info: eventForm.ticket_info || null,
        p_website_url: eventForm.website_url || null,
        p_booking_url: eventForm.booking_url || null,
        p_contact_phone: eventForm.contact_phone || null,
        p_is_published: eventForm.is_published,
      });
      if (error) {
        console.error("Failed to create event", error);
        toast.error("Failed to create event");
      } else {
        toast.success("Event created");
      }
    }
    const { data: refreshed, error: refreshError } = await supabase.rpc("owner_get_venue_events", {
      p_venue_id: venue.id,
    });
    if (!refreshError) {
      setEvents((refreshed as VenueEvent[]) ?? []);
    }
    resetEventForm();
    setEventSaving(false);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!eventId || !isOwner) return;
    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) return;
    const { error } = await supabase.rpc("owner_delete_venue_event", { p_event_id: eventId });
    if (error) {
      console.error("Failed to delete event", error);
      toast.error("Failed to delete event");
      return;
    }
    toast.success("Event deleted");
    const { data: refreshed } = await supabase.rpc("owner_get_venue_events", { p_venue_id: venue.id });
    setEvents((refreshed as VenueEvent[]) ?? []);
    if (eventForm.id === eventId) {
      resetEventForm();
    }
  };

  const classifyEventStatus = (event: VenueEvent) => {
    if (!event.is_published) return "draft";
    const now = new Date();
    const starts = new Date(event.starts_at);
    return starts >= now ? "upcoming" : "past";
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto flex items-center justify-center px-4 py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading venue…
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isOwner || !venue) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage this venue.
              </p>
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
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
            <h1 className="text-3xl font-bold text-foreground">Manage venue</h1>
            <p className="text-sm text-muted-foreground">{venue.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link to={`/venues/${venue.slug}`}>View public page</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/my/venues">Back to my venues</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Venue details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Short tagline</label>
                <Input
                  value={form.short_tagline}
                  onChange={(e) => setForm((prev) => ({ ...prev, short_tagline: e.target.value }))}
                  placeholder="Big carp day-ticket venue with 3 main lakes"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-foreground">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Brief description of the venue"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Ticket type</label>
                <Input
                  value={form.ticket_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, ticket_type: e.target.value }))}
                  placeholder="Day ticket fishery, Syndicate, Club water"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Best for tags (comma separated)</label>
                <Input
                  value={form.best_for_tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, best_for_tags: e.target.value }))}
                  placeholder="Carp, Match, Families"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Facilities (comma separated)</label>
                <Input
                  value={form.facilities}
                  onChange={(e) => setForm((prev) => ({ ...prev, facilities: e.target.value }))}
                  placeholder="Toilets, Café, Tackle shop"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Price from</label>
                <Input
                  value={form.price_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_from: e.target.value }))}
                  placeholder="from £10 / day"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Website URL</label>
                <Input
                  value={form.website_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Booking URL</label>
                <Input
                  value={form.booking_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, booking_url: e.target.value }))}
                  placeholder="https://example.com/book"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Contact phone</label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+44 1234 567890"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {eventsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading events…
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded border border-border/60 bg-card/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{event.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          classifyEventStatus(event) === "draft"
                            ? "bg-amber-50 text-amber-700"
                            : classifyEventStatus(event) === "upcoming"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {classifyEventStatus(event)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {event.starts_at ? new Date(event.starts_at).toLocaleString() : "No start date"}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteEvent(event.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 rounded border border-border/60 bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {eventForm.id ? "Edit event" : "Create event"}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={eventForm.title}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Event type</label>
                  <Input
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value }))}
                    placeholder="match, open_day, announcement…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Starts at</label>
                  <Input
                    type="datetime-local"
                    value={eventForm.starts_at}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ends at</label>
                  <Input
                    type="datetime-local"
                    value={eventForm.ends_at}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, ends_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ticket info</label>
                  <Input
                    value={eventForm.ticket_info}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, ticket_info: e.target.value }))}
                    placeholder="£25, 30 pegs, payout to top 3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Website URL</label>
                  <Input
                    value={eventForm.website_url}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, website_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Booking URL</label>
                  <Input
                    value={eventForm.booking_url}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, booking_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contact phone</label>
                  <Input
                    value={eventForm.contact_phone}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="isPublished"
                    type="checkbox"
                    checked={eventForm.is_published}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, is_published: e.target.checked }))}
                  />
                  <label htmlFor="isPublished" className="text-xs text-muted-foreground">
                    Published
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void handleSaveEvent()} disabled={eventSaving}>
                  {eventSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save event"
                  )}
                </Button>
                {eventForm.id && (
                  <Button variant="outline" onClick={() => resetEventForm()}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyVenueEdit;
