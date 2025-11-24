import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Upload, ChevronsUpDown } from "lucide-react";
import { UK_FRESHWATER_SPECIES } from "@/lib/freshwater-data";

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

interface CatchBasicsSectionProps {
  imagePreview: string;
  imageFile: File | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formData: {
    title: string;
    species: string;
    customSpecies: string;
    weight: string;
    weightUnit: string;
    length: string;
    lengthUnit: string;
  };
  onFormDataChange: (updates: Partial<CatchBasicsSectionProps["formData"]>) => void;
}

export const CatchBasicsSection = ({
  imagePreview,
  imageFile,
  onImageChange,
  formData,
  onFormDataChange,
}: CatchBasicsSectionProps) => {
  const speciesLabelId = React.useId();
  const speciesTriggerId = React.useId();
  const [speciesPopoverOpen, setSpeciesPopoverOpen] = React.useState(false);
  const [speciesSearch, setSpeciesSearch] = React.useState("");

  const trimmedSpeciesSearch = speciesSearch.trim();
  const hasExactSpeciesMatch =
    trimmedSpeciesSearch.length > 0 &&
    UK_FRESHWATER_SPECIES.some(
      (species) => species.label.toLowerCase() === trimmedSpeciesSearch.toLowerCase(),
    );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Catch Basics</h3>

      <div className="space-y-2">
        <Label htmlFor="image">Main Photo *</Label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded" />
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Upload your catch photo</p>
            </div>
          )}
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="mt-4"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            onFormDataChange({
              title: capitalizeFirstWord(e.target.value),
            })
          }
          placeholder="e.g., Beautiful 20lb Mirror Carp"
        />
      </div>

      <div className="space-y-2">
        <Label id={speciesLabelId} htmlFor="species">Species *</Label>
        <Popover
          open={speciesPopoverOpen}
          onOpenChange={(isOpen) => {
            setSpeciesPopoverOpen(isOpen);
            if (!isOpen) {
              setSpeciesSearch("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={speciesPopoverOpen}
              className="w-full justify-between"
              id={speciesTriggerId}
              aria-labelledby={`${speciesLabelId} ${speciesTriggerId}`}
              data-testid="species-combobox"
            >
              {(() => {
                const selectedSpecies = UK_FRESHWATER_SPECIES.find((item) => item.value === formData.species);
                if (selectedSpecies) return selectedSpecies.label;
                if (formData.customSpecies) return formData.customSpecies;
                return "Select species";
              })()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput
                placeholder="Search species…"
                value={speciesSearch}
                onValueChange={setSpeciesSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {trimmedSpeciesSearch
                    ? `No species found for "${trimmedSpeciesSearch}"`
                    : "Start typing to search species"}
                </CommandEmpty>
                <CommandGroup>
                  {trimmedSpeciesSearch && !hasExactSpeciesMatch && (
                    <CommandItem
                      value={`custom-${trimmedSpeciesSearch.toLowerCase()}`}
                      onSelect={() => {
                        const customValue = toTitleCase(trimmedSpeciesSearch);
                        onFormDataChange({
                          species: "other",
                          customSpecies: customValue,
                        });
                        setSpeciesSearch("");
                        setSpeciesPopoverOpen(false);
                      }}
                    >
                      Use "{toTitleCase(trimmedSpeciesSearch)}"
                    </CommandItem>
                  )}
                  {(formData.species || formData.customSpecies) && (
                    <CommandItem
                      value="clear-selection"
                      onSelect={() => {
                        onFormDataChange({
                          species: "",
                          customSpecies: "",
                        });
                        setSpeciesSearch("");
                        setSpeciesPopoverOpen(false);
                      }}
                    >
                      Clear selection
                    </CommandItem>
                  )}
                  {UK_FRESHWATER_SPECIES.filter((species) => species.value !== "other").map((species) => (
                    <CommandItem
                      key={species.value}
                      value={species.label.toLowerCase()}
                      onSelect={() => {
                        onFormDataChange({
                          species: species.value,
                          customSpecies: "",
                        });
                        setSpeciesSearch("");
                        setSpeciesPopoverOpen(false);
                      }}
                    >
                      {species.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            type="number"
            step="0.01"
            value={formData.weight}
            onChange={(e) => onFormDataChange({ weight: e.target.value })}
            placeholder="e.g., 20.5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightUnit">Unit</Label>
          <Select value={formData.weightUnit} onValueChange={(value) => onFormDataChange({ weightUnit: value })}>
            <SelectTrigger id="weightUnit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lb_oz">lb/oz</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="length">Length (optional)</Label>
          <Input
            id="length"
            type="number"
            step="0.1"
            value={formData.length}
            onChange={(e) => onFormDataChange({ length: e.target.value })}
            placeholder="e.g., 65"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lengthUnit">Unit</Label>
          <Select value={formData.lengthUnit} onValueChange={(value) => onFormDataChange({ lengthUnit: value })}>
            <SelectTrigger id="lengthUnit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cm">cm</SelectItem>
              <SelectItem value="in">in</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
