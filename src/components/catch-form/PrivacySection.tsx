import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

interface PrivacySectionProps {
  formData: {
    tags: string;
    visibility: string;
    hideExactSpot: boolean;
    allowRatings: boolean;
  };
  onFormDataChange: (updates: Partial<PrivacySectionProps["formData"]>) => void;
}

export const PrivacySection = ({
  formData,
  onFormDataChange,
}: PrivacySectionProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) =>
            onFormDataChange({
              tags: capitalizeFirstWord(e.target.value),
            })
          }
          placeholder="e.g., #carp, #summer, #pb"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select value={formData.visibility} onValueChange={(value) => onFormDataChange({ visibility: value })}>
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="followers">Followers Only</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="hideExactSpot">Hide exact peg/swim</Label>
          <p className="text-sm text-muted-foreground">We’ll still show the venue name.</p>
        </div>
        <Switch
          id="hideExactSpot"
          checked={formData.hideExactSpot}
          onCheckedChange={(checked) => onFormDataChange({ hideExactSpot: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="allowRatings">Allow community ratings</Label>
          <p className="text-sm text-muted-foreground">Turn this off if you don’t want ratings on this catch.</p>
        </div>
        <Switch
          id="allowRatings"
          checked={formData.allowRatings}
          onCheckedChange={(checked) => onFormDataChange({ allowRatings: checked })}
        />
      </div>
    </div>
  );
};
