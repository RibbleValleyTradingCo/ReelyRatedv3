import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { UK_FISHERIES, normalizeVenueName } from "@/lib/freshwater-data";

const CREATE_SESSION_OPTION = "__create_session";
const NO_SESSION_OPTION = "__no_session";

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

const formatGroupLabel = (value: string | null | undefined) => {
  if (!value) return "Other";
  return toTitleCase(value.replace(/[-_]/g, " "));
};

type SessionOption = {
  id: string;
  title: string;
  venue: string | null;
  date: string | null;
};

interface LocationSectionProps {
  formData: {
    location: string;
    customLocationLabel: string;
    pegOrSwim: string;
    caughtAt: string;
    timeOfDay: string;
    waterType: string;
  };
  onFormDataChange: (updates: Partial<LocationSectionProps["formData"]>) => void;
  useGpsLocation: boolean;
  setUseGpsLocation: (use: boolean) => void;
  gpsCoordinates: { lat: number; lng: number } | null;
  setGpsCoordinates: (coords: { lat: number; lng: number } | null) => void;
  gpsAccuracy: number | null;
  setGpsAccuracy: (accuracy: number | null) => void;
  isLocating: boolean;
  setIsLocating: (loading: boolean) => void;
  locationError: string | null;
  setLocationError: (error: string | null) => void;
  onHandleUseGps: () => void;
  waterTypeOptions: { code: string; label: string; group: string }[];
  isLoadingWaterTypes: boolean;
  sessions: SessionOption[];
  isLoadingSessions: boolean;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  isCreatingSession: boolean;
  setIsCreatingSession: (creating: boolean) => void;
  newSession: {
    title: string;
    venue: string;
    date: string;
    notes: string;
  };
  setNewSession: (session: LocationSectionProps["newSession"]) => void;
}

export const LocationSection = ({
  formData,
  onFormDataChange,
  useGpsLocation,
  setUseGpsLocation,
  gpsCoordinates,
  setGpsCoordinates,
  gpsAccuracy,
  setGpsAccuracy,
  isLocating,
  locationError,
  setLocationError,
  onHandleUseGps,
  waterTypeOptions,
  isLoadingWaterTypes,
  sessions,
  isLoadingSessions,
  selectedSessionId,
  setSelectedSessionId,
  isCreatingSession,
  setIsCreatingSession,
  newSession,
  setNewSession,
}: LocationSectionProps) => {
  const fisheryLabelId = React.useId();
  const fisheryTriggerId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [waterTypePopoverOpen, setWaterTypePopoverOpen] = React.useState(false);
  const [waterTypeSearch, setWaterTypeSearch] = React.useState("");

  const trimmedWaterTypeSearch = waterTypeSearch.trim().toLowerCase();
  const filteredWaterTypes = waterTypeOptions.filter((option) => {
    if (!trimmedWaterTypeSearch) return true;
    return (
      option.label.toLowerCase().includes(trimmedWaterTypeSearch) ||
      option.code.toLowerCase().includes(trimmedWaterTypeSearch)
    );
  });

  const waterTypesByGroup = filteredWaterTypes.reduce<Record<string, { code: string; label: string }[]>>(
    (acc, option) => {
      const key = formatGroupLabel(option.group);
      if (!acc[key]) acc[key] = [];
      acc[key].push({ code: option.code, label: option.label });
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Location & Session</h3>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label id={fisheryLabelId} htmlFor="location">Fishery / Venue *</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={useGpsLocation}
                type="button"
                id={fisheryTriggerId}
                aria-labelledby={`${fisheryLabelId} ${fisheryTriggerId}`}
                data-testid="fishery-combobox"
              >
                {formData.location || "Select fishery..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search UK fisheries..." />
                <CommandList>
                  <CommandEmpty>No fishery found.</CommandEmpty>
                  <CommandGroup>
                    {UK_FISHERIES.map((fishery) => (
                      <CommandItem
                        key={fishery}
                        value={fishery}
                        onSelect={(currentValue) => {
                          const normalized = normalizeVenueName(currentValue);
                          onFormDataChange({
                            location: normalized === formData.location ? "" : normalized,
                            customLocationLabel: "",
                          });
                          setUseGpsLocation(false);
                          setGpsCoordinates(null);
                          setGpsAccuracy(null);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.location === normalizeVenueName(fishery) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {fishery}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={useGpsLocation ? "ocean" : "outline"}
            disabled={isLocating && !useGpsLocation}
            onClick={() => {
              if (useGpsLocation) {
                setUseGpsLocation(false);
                setGpsCoordinates(null);
                setGpsAccuracy(null);
                onFormDataChange({
                  customLocationLabel: "",
                });
                setLocationError(null);
                return;
              }
              onHandleUseGps();
            }}
          >
            {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
            {useGpsLocation ? "Clear GPS Pin" : "Use Current GPS"}
          </Button>
          {!useGpsLocation && (
            <span className="text-xs text-muted-foreground">
              Prefer to pick from the list? No problem—GPS is optional.
            </span>
          )}
        </div>

        {locationError && <p className="text-sm text-destructive">{locationError}</p>}

        {gpsCoordinates && (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border">
              <iframe
                title="Pinned fishing location"
                src={`https://www.google.com/maps?q=${gpsCoordinates.lat},${gpsCoordinates.lng}&z=15&output=embed`}
                width="100%"
                height="250"
                loading="lazy"
                allowFullScreen
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dropped pin at {gpsCoordinates.lat.toFixed(5)}, {gpsCoordinates.lng.toFixed(5)}
              {gpsAccuracy ? ` (±${Math.round(gpsAccuracy)}m)` : ""}
            </p>
            <div className="space-y-1">
              <Label htmlFor="customLocationLabel" className="text-xs text-muted-foreground">
                Optional label for this spot
              </Label>
              <Input
                id="customLocationLabel"
                value={formData.customLocationLabel}
                onChange={(e) =>
                  onFormDataChange({
                    customLocationLabel: capitalizeFirstWord(e.target.value),
                  })
                }
                placeholder="e.g., Upper lake margins"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pegOrSwim">Peg / Swim (optional)</Label>
        <Input
          id="pegOrSwim"
          value={formData.pegOrSwim}
          onChange={(e) =>
            onFormDataChange({
              pegOrSwim: capitalizeFirstWord(e.target.value),
            })
          }
          placeholder="e.g., Peg 14"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="caughtAt">Date Caught</Label>
          <Input
            id="caughtAt"
            type="date"
            value={formData.caughtAt}
            onChange={(e) => onFormDataChange({ caughtAt: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeOfDay">Time of Day</Label>
          <Select value={formData.timeOfDay} onValueChange={(value) => onFormDataChange({ timeOfDay: value })}>
            <SelectTrigger id="timeOfDay">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waterType">Water Type</Label>
        <Popover
          open={waterTypePopoverOpen}
          onOpenChange={(isOpen) => {
            setWaterTypePopoverOpen(isOpen);
            if (!isOpen) {
              setWaterTypeSearch("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={waterTypePopoverOpen}
              className="w-full justify-between"
            >
              {(() => {
                if (isLoadingWaterTypes) return "Loading water types…";
                if (formData.waterType) {
                  const selected = waterTypeOptions.find((option) => option.code === formData.waterType);
                  if (selected) return selected.label;
                  return toTitleCase(formData.waterType.replace(/[-_]/g, " "));
                }
                return "Select water type";
              })()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput
                placeholder="Search water types…"
                value={waterTypeSearch}
                onValueChange={setWaterTypeSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoadingWaterTypes
                    ? "Loading water types…"
                    : trimmedWaterTypeSearch
                      ? `No water types found for "${waterTypeSearch}"`
                      : "Start typing to search water types"}
                </CommandEmpty>
                {formData.waterType ? (
                  <CommandGroup heading="Quick actions">
                    <CommandItem
                      value="clear-water-type"
                      onSelect={() => {
                        onFormDataChange({
                          waterType: "",
                        });
                        setWaterTypeSearch("");
                        setWaterTypePopoverOpen(false);
                      }}
                    >
                      Clear selection
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {Object.entries(waterTypesByGroup).map(([groupLabel, items]) => (
                  <CommandGroup key={groupLabel} heading={groupLabel}>
                    {items.map((option) => (
                      <CommandItem
                        key={option.code}
                        value={option.code}
                        onSelect={() => {
                          onFormDataChange({
                            waterType: option.code,
                          });
                          setWaterTypeSearch("");
                          setWaterTypePopoverOpen(false);
                        }}
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session">Fishing Session</Label>
        <Select
          value={isCreatingSession ? CREATE_SESSION_OPTION : (selectedSessionId || NO_SESSION_OPTION)}
          onValueChange={(value) => {
            if (value === CREATE_SESSION_OPTION) {
              setIsCreatingSession(true);
              setSelectedSessionId("");
            } else if (value === NO_SESSION_OPTION) {
              setSelectedSessionId("");
              setIsCreatingSession(false);
            } else {
              setSelectedSessionId(value);
              setIsCreatingSession(false);
            }
          }}
        >
          <SelectTrigger id="session">
            <SelectValue placeholder={isLoadingSessions ? "Loading sessions…" : "Select session"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SESSION_OPTION}>No session</SelectItem>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {session.title}
                {session.date ? ` • ${new Date(session.date).toLocaleDateString("en-GB")}` : ""}
              </SelectItem>
            ))}
            <SelectItem value={CREATE_SESSION_OPTION}>Create new session</SelectItem>
          </SelectContent>
        </Select>
        {selectedSessionId && !isCreatingSession && (
          <p className="text-xs text-muted-foreground">
            Selected session will group this catch with your other logs from that outing.
          </p>
        )}
        {isCreatingSession && (
          <div className="space-y-3 rounded-md border border-dashed border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Create a new session</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                type="button"
                onClick={() => {
                  setIsCreatingSession(false);
                  setNewSession({ title: "", venue: "", date: new Date().toISOString().split("T")[0], notes: "" });
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-title">Session title *</Label>
              <Input
                id="session-title"
                value={newSession.title}
                onChange={(event) => setNewSession({ ...newSession, title: event.target.value })}
                placeholder="Dawn patrol at Willow Lake"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="session-venue">Venue</Label>
                <Input
                  id="session-venue"
                  value={newSession.venue}
                  onChange={(event) => setNewSession({ ...newSession, venue: event.target.value })}
                  placeholder="Willow Lake"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-date">Date</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={newSession.date}
                  onChange={(event) => setNewSession({ ...newSession, date: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-notes">Notes</Label>
              <Textarea
                id="session-notes"
                value={newSession.notes}
                onChange={(event) => setNewSession({ ...newSession, notes: event.target.value })}
                placeholder="Conditions, tactics, who you fished with…"
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
