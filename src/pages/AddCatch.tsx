import { useState, useEffect, type ReactNode } from "react";
import { Fish, MapPin, Target, MessageSquare, SunMedium, Images, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { normalizeVenueName } from "@/lib/freshwater-data";
import type { Database } from "@/integrations/supabase/types";
import { catchSchemaWithRefinements } from "@/schemas";
import { useRateLimit, formatResetTime } from "@/hooks/useRateLimit";
import { CatchBasicsSection } from "@/components/catch-form/CatchBasicsSection";
import { LocationSection } from "@/components/catch-form/LocationSection";
import { TacticsSection } from "@/components/catch-form/TacticsSection";
import { StorySection } from "@/components/catch-form/StorySection";
import { ConditionsSection } from "@/components/catch-form/ConditionsSection";
import { MediaSection } from "@/components/catch-form/MediaSection";
import { PrivacySection } from "@/components/catch-form/PrivacySection";
import { logger } from "@/lib/logger";
import { mapModerationError } from "@/lib/moderation-errors";
import { cn } from "@/lib/utils";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

type SessionOption = {
  id: string;
  title: string;
  venue: string | null;
  date: string | null;
};

type SectionBlockProps = {
  title: string;
  helper?: string;
  contentHelper?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  icon?: typeof Fish;
  muted?: boolean;
};

const SectionBlock = ({
  title,
  helper,
  contentHelper,
  children,
  collapsible = false,
  defaultOpen = true,
  icon: Icon,
  muted = false,
}: SectionBlockProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const label = title;

  return (
    <div
      className={cn(
        "rounded-xl p-3 sm:p-4 md:p-5 transition-shadow",
        collapsible ? "border border-dashed border-border/60 bg-muted/40" : "border border-border/60",
        muted ? "bg-muted/40" : "bg-white/80",
        "hover:shadow-sm"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start justify-between text-left",
          collapsible ? "cursor-pointer" : "cursor-default"
        )}
        onClick={() => (collapsible ? setOpen((prev) => !prev) : undefined)}
        aria-expanded={open}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          {Icon ? (
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-9 sm:w-9">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground sm:text-lg">{label}</p>
            {helper ? <p className="text-xs leading-snug text-muted-foreground sm:text-sm">{helper}</p> : null}
          </div>
        </div>
        {collapsible ? (
          <span
            className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted text-muted-foreground transition-transform"
            aria-hidden="true"
          >
            <svg
              className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </button>
      <div className={cn("mt-3 space-y-3 sm:space-y-4", collapsible ? (open ? "block" : "hidden") : "block")}>
        {contentHelper && (!collapsible || open) ? (
          <p className="text-sm text-muted-foreground">{contentHelper}</p>
        ) : null}
        <div className={collapsible ? "space-y-3 sm:space-y-4 border-l-2 border-primary/30 pl-3 sm:pl-4" : "space-y-3 sm:space-y-4"}>
          {children}
        </div>
      </div>
    </div>
  );
};

const AddCatch = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate limiting: max 10 catches per hour
  const { checkLimit, isLimited, attemptsRemaining, resetIn } = useRateLimit({
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    storageKey: 'catch-submit-limit',
    onLimitExceeded: () => {
      const resetTime = formatResetTime(resetIn);
      toast.error(`Rate limit exceeded. You can only create 10 catches per hour. Please try again in ${resetTime}.`);
    },
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [showConditions, setShowConditions] = useState(false);
  const [methodOptions, setMethodOptions] = useState<{ slug: string; label: string; group: string }[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [baitOptions, setBaitOptions] = useState<{ slug: string; label: string; category: string }[]>([]);
  const [isLoadingBaits, setIsLoadingBaits] = useState(false);
  const [waterTypeOptions, setWaterTypeOptions] = useState<{ code: string; label: string; group: string }[]>([]);
  const [isLoadingWaterTypes, setIsLoadingWaterTypes] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    species: "",
    customSpecies: "",
    weight: "",
    weightUnit: "lb_oz",
    length: "",
    lengthUnit: "cm",
    description: "",
    location: "",
    customLocationLabel: "",
    pegOrSwim: "",
    waterType: "",
    method: "",
    customMethod: "",
    baitUsed: "",
    equipmentUsed: "",
    caughtAt: new Date().toISOString().split('T')[0],
    timeOfDay: "",
    weather: "",
    airTemp: "",
    waterClarity: "",
    windDirection: "",
    tags: "",
    videoUrl: "",
    visibility: "public",
    hideExactSpot: false,
    allowRatings: true,
  });

  const [useGpsLocation, setUseGpsLocation] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState({
    title: "",
    venue: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMethods(true);

    supabase
      .from("tags")
      .select("slug,label,method_group")
      .eq("category", "method")
      .order("method_group", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          logger.error("Failed to load method tags", error);
          setMethodOptions([]);
        } else {
          setMethodOptions(
            (data ?? []).map((item) => ({
              slug: item.slug,
              label: item.label,
              group: item.method_group ?? "Other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMethods(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingBaits(true);

    supabase
      .from("baits")
      .select("slug,label,category")
      .order("category", { ascending: true })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          logger.error("Failed to load baits", error);
          setBaitOptions([]);
        } else {
          setBaitOptions(
            (data ?? []).map((item) => ({
              slug: item.slug,
              label: item.label,
              category: item.category ?? "other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingBaits(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingWaterTypes(true);

    supabase
      .from("water_types")
      .select("code,label,group_name")
      .order("group_name", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          logger.error("Failed to load water types", error);
          setWaterTypeOptions([]);
        } else {
          setWaterTypeOptions(
            (data ?? []).map((item) => ({
              code: item.code,
              label: item.label,
              group: item.group_name ?? "other",
            }))
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingWaterTypes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) {
        setSessions([]);
        return;
      }
      setIsLoadingSessions(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, venue, date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(20);

      if (error) {
        logger.error("Failed to load sessions", error, { userId: user.id });
        setSessions([]);
      } else if (data) {
        setSessions(data as SessionOption[]);
      }
      setIsLoadingSessions(false);
    };

    if (!loading) {
      void fetchSessions();
    }
  }, [loading, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (galleryFiles.length + files.length > 6) {
      toast.error("Maximum 6 gallery photos allowed");
      return;
    }

    setGalleryFiles([...galleryFiles, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles(galleryFiles.filter((_, i) => i !== index));
    setGalleryPreviews(galleryPreviews.filter((_, i) => i !== index));
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsAccuracy(position.coords.accuracy ?? null);
        setUseGpsLocation(true);
        setIsLocating(false);
        setFormData((prev) => ({
          ...prev,
          location: "",
        }));
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable it in your browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Unable to determine your location. Try again in an open area.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("We couldn't get your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limit (client-side)
    if (!checkLimit()) {
      return; // Rate limited - toast already shown by onLimitExceeded
    }

    // Validate required image file
    if (!imageFile) {
      toast.error("Please upload a photo of your catch");
      return;
    }

    if (!user) return;

    // Validate form data with Zod schema
    const validationResult = catchSchemaWithRefinements.safeParse(formData);

    if (!validationResult.success) {
      // Display validation errors
      const firstError = validationResult.error.issues[0];
      if (firstError) {
        toast.error(firstError.message);
      }
      return;
    }

    // Additional validation for conditional fields
    const speciesIsOther = formData.species === "other";
    if (speciesIsOther && !formData.customSpecies) {
      toast.error("Please describe the species when selecting Other");
      return;
    }

    const methodIsOther = formData.method === "other";
    if (methodIsOther && !formData.customMethod) {
      toast.error("Please describe the method when selecting Other");
      return;
    }

    const customLocationLabel = formData.customLocationLabel
      ? capitalizeFirstWord(formData.customLocationLabel)
      : "";
    const finalLocation =
      useGpsLocation && gpsCoordinates
        ? customLocationLabel || "Pinned location"
        : formData.location;

    if (!finalLocation) {
      toast.error("Please choose a fishery or drop a GPS pin");
      return;
    }

    const normalizedLocation = normalizeVenueName(finalLocation);

    setIsSubmitting(true);

    try {
      const selectedWaterTypeOption = formData.waterType
        ? waterTypeOptions.find((option) => option.code === formData.waterType)
        : undefined;
      const normalizedWaterType = formData.waterType ? formData.waterType : null;

      let sessionId: string | null = selectedSessionId || null;
      let createdSession: SessionOption | null = null;

      if (isCreatingSession) {
        if (!newSession.title.trim()) {
          toast.error("Session title is required");
          setIsSubmitting(false);
          return;
        }

        const sessionVenue = newSession.venue.trim()
          ? normalizeVenueName(newSession.venue)
          : normalizedLocation;

        const { data: sessionInsert, error: sessionError } = await supabase
          .from("sessions")
          .insert({
            user_id: user.id,
            title: newSession.title.trim(),
            venue: sessionVenue || null,
            date: newSession.date ? newSession.date : null,
            notes: newSession.notes.trim() || null,
          })
          .select("id, title, venue, date")
          .single();

        if (sessionError || !sessionInsert) {
          throw sessionError ?? new Error("Failed to create session");
        }

        sessionId = sessionInsert.id;
        createdSession = sessionInsert as SessionOption;
      }

      // Upload main image
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("catches")
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("catches")
        .getPublicUrl(fileName);

      // Upload gallery images
      const galleryUrls: string[] = [];
      for (const file of galleryFiles) {
        const ext = file.name.split(".").pop();
        const name = `${user.id}-${Date.now()}-${Math.random()}.${ext}`;
        const { error: galleryError } = await supabase.storage
          .from("catches")
          .upload(name, file);

        if (!galleryError) {
          const { data: { publicUrl: galleryUrl } } = supabase.storage
            .from("catches")
            .getPublicUrl(name);
          galleryUrls.push(galleryUrl);
        }
      }

      // Prepare conditions object
      const conditions: Record<string, unknown> = {};
      if (formData.weather) conditions.weather = formData.weather;
      if (formData.airTemp) conditions.airTemp = parseFloat(formData.airTemp);
      if (formData.waterClarity) conditions.waterClarity = formData.waterClarity;
      if (formData.windDirection) conditions.windDirection = formData.windDirection;

      const customFields: Record<string, string> = {};
      if (speciesIsOther && formData.customSpecies) {
        customFields.species = formData.customSpecies;
      }
      if (methodIsOther && formData.customMethod) {
        customFields.method = formData.customMethod;
      }
      if (formData.waterType) {
        const waterTypeLabel =
          selectedWaterTypeOption?.label ??
          toTitleCase(formData.waterType.replace(/[-_]/g, " "));
        if (waterTypeLabel) {
          customFields.waterType = waterTypeLabel;
        }
      }
      if (Object.keys(customFields).length > 0) {
        conditions.customFields = customFields;
      }

      if (useGpsLocation && gpsCoordinates) {
        conditions.gps = {
          lat: gpsCoordinates.lat,
          lng: gpsCoordinates.lng,
          ...(gpsAccuracy ? { accuracy: gpsAccuracy } : {}),
          ...(customLocationLabel ? { label: customLocationLabel } : {}),
        };
        conditions.locationSource = "gps";
      } else if (formData.location) {
        conditions.locationSource = "manual";
      }

      // Parse tags
      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      const conditionsPayload =
        Object.keys(conditions).length > 0
          ? (conditions as Database["public"]["Tables"]["catches"]["Insert"]["conditions"])
          : null;

      // Insert catch record
      const catchData: Database["public"]["Tables"]["catches"]["Insert"] = {
        user_id: user.id,
        image_url: publicUrl,
        title: formData.title,
        description: formData.description || null,
        location: normalizedLocation || null,
        bait_used: formData.baitUsed || null,
        equipment_used: formData.equipmentUsed || null,
        caught_at: formData.caughtAt || null,
        species: formData.species || null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        weight_unit: formData.weightUnit as Database["public"]["Enums"]["weight_unit"],
        length: formData.length ? parseFloat(formData.length) : null,
        length_unit: formData.lengthUnit as Database["public"]["Enums"]["length_unit"],
        peg_or_swim: formData.pegOrSwim || null,
        water_type: normalizedWaterType,
        method: formData.method || null,
        time_of_day: formData.timeOfDay || null,
        conditions: conditionsPayload,
        tags,
        gallery_photos: galleryUrls,
        video_url: formData.videoUrl || null,
        visibility: formData.visibility as Database["public"]["Enums"]["visibility_type"],
        hide_exact_spot: formData.hideExactSpot,
        allow_ratings: formData.allowRatings,
        session_id: sessionId,
      };

      const { error: insertError } = await supabase.from("catches").insert(catchData);

      if (insertError) throw insertError;

      if (createdSession) {
        setSessions((prev) => [createdSession!, ...prev.filter((session) => session.id !== createdSession!.id)]);
        setSelectedSessionId(createdSession.id);
        setIsCreatingSession(false);
        setNewSession({ title: "", venue: "", date: new Date().toISOString().split("T")[0], notes: "" });
      }

      toast.success("Catch added successfully!");
      navigate("/feed");
    } catch (error) {
      logger.error("Error adding catch", error, { userId: user?.id, sessionId: formData.sessionId });
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : null;
      if (message?.toLowerCase().includes("bucket")) {
        toast.error("Unable to upload images. Please create a 'catches' storage bucket in Supabase.");
      } else {
        const moderation = mapModerationError(error);
        if (moderation.type === "suspended") {
          const untilText = moderation.until ? ` until ${new Date(moderation.until).toLocaleString()}` : "";
          toast.error(`You’re currently suspended${untilText} and can’t post new catches right now.`);
        } else if (moderation.type === "banned") {
          toast.error("Your account is banned and you can’t post new catches.");
        } else {
          toast.error(message ?? "Failed to add catch. Please try again.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Log a new catch</h1>
          <p className="text-base text-gray-600">
            Capture the details that actually help you catch more next time.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Catch details</CardTitle>
            <p className="text-sm text-muted-foreground">
              The more detail you add, the better your logbook and rankings will be.
            </p>
            <p className="text-sm text-muted-foreground">Fields marked * are required.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8" data-testid="add-catch-form">
              <SectionBlock
                title="Catch basics"
                helper="Species, title, weight and length. Main photo appears in the feed and on the leaderboard."
                icon={Fish}
                muted
              >
                <CatchBasicsSection
                  imagePreview={imagePreview}
                  imageFile={imageFile}
                  onImageChange={handleImageChange}
                  formData={{
                    title: formData.title,
                    species: formData.species,
                    customSpecies: formData.customSpecies,
                    weight: formData.weight,
                    weightUnit: formData.weightUnit,
                    length: formData.length,
                    lengthUnit: formData.lengthUnit,
                  }}
                  onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
                />
              </SectionBlock>

              <SectionBlock
                title="Location & session"
                helper="Where and when you caught this fish."
                icon={MapPin}
              >
                <LocationSection
                  formData={{
                    location: formData.location,
                    customLocationLabel: formData.customLocationLabel,
                    pegOrSwim: formData.pegOrSwim,
                    caughtAt: formData.caughtAt,
                    timeOfDay: formData.timeOfDay,
                    waterType: formData.waterType,
                  }}
                  onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
                  useGpsLocation={useGpsLocation}
                  setUseGpsLocation={setUseGpsLocation}
                  gpsCoordinates={gpsCoordinates}
                  setGpsCoordinates={setGpsCoordinates}
                  gpsAccuracy={gpsAccuracy}
                  setGpsAccuracy={setGpsAccuracy}
                  isLocating={isLocating}
                  setIsLocating={setIsLocating}
                  locationError={locationError}
                  setLocationError={setLocationError}
                  onHandleUseGps={handleUseGps}
                  waterTypeOptions={waterTypeOptions}
                  isLoadingWaterTypes={isLoadingWaterTypes}
                  sessions={sessions}
                  isLoadingSessions={isLoadingSessions}
                  selectedSessionId={selectedSessionId}
                  setSelectedSessionId={setSelectedSessionId}
                  isCreatingSession={isCreatingSession}
                  setIsCreatingSession={setIsCreatingSession}
                  newSession={newSession}
                  setNewSession={setNewSession}
                />
              </SectionBlock>

              <SectionBlock
                title="Tactics & notes"
                helper="Method, bait, kit and your notes."
                icon={Target}
                muted
              >
                <TacticsSection
                  formData={{
                    baitUsed: formData.baitUsed,
                    method: formData.method,
                    customMethod: formData.customMethod,
                    equipmentUsed: formData.equipmentUsed,
                  }}
                  onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
                  baitOptions={baitOptions}
                  isLoadingBaits={isLoadingBaits}
                  methodOptions={methodOptions}
                  isLoadingMethods={isLoadingMethods}
                />

              </SectionBlock>

              <SectionBlock
                title="Your story"
                helper="Tell the story so others can learn from it."
                icon={MessageSquare}
                muted
              >
                <StorySection
                  description={formData.description}
                  onDescriptionChange={(description) => setFormData({ ...formData, description })}
                />
              </SectionBlock>

              <SectionBlock
                title="Conditions"
                helper="Optional · Weather and water details."
                contentHelper="Optional, but helps spot patterns."
                collapsible
                defaultOpen={false}
                icon={SunMedium}
              >
                <ConditionsSection
                  formData={{
                    weather: formData.weather,
                    airTemp: formData.airTemp,
                    waterClarity: formData.waterClarity,
                    windDirection: formData.windDirection,
                  }}
                  onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
                  showConditions={showConditions}
                  setShowConditions={setShowConditions}
                />
              </SectionBlock>

              <SectionBlock
                title="Media"
                helper="Optional · Extra photos or video."
                contentHelper="Optional, but extra photos or video make your catch stand out."
                collapsible
                defaultOpen={false}
                icon={Images}
              >
                <MediaSection
                  galleryFiles={galleryFiles}
                  galleryPreviews={galleryPreviews}
                  onGalleryChange={handleGalleryChange}
                  onRemoveGalleryImage={removeGalleryImage}
                  videoUrl={formData.videoUrl}
                  onVideoUrlChange={(videoUrl) => setFormData({ ...formData, videoUrl })}
                />
              </SectionBlock>

              <div className="mt-6 sm:mt-8">
                <SectionBlock
                  title="Tags & privacy"
                  helper="Control how this catch appears to others."
                  icon={Tag}
                  muted
                >
                  <PrivacySection
                    formData={{
                      tags: formData.tags,
                      visibility: formData.visibility,
                      hideExactSpot: formData.hideExactSpot,
                      allowRatings: formData.allowRatings,
                    }}
                    onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
                  />
                </SectionBlock>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  We’ll save this to your logbook and update your rankings.
                </p>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  size="lg"
                  disabled={isSubmitting || !imageFile || isLimited}
                >
                  {isSubmitting
                    ? "Publishing catch..."
                    : isLimited
                    ? `Rate limited (reset in ${formatResetTime(resetIn)})`
                    : `Log this catch${attemptsRemaining < 10 ? ` (${attemptsRemaining} remaining)` : ""}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddCatch;
