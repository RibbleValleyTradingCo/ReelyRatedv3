import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ProfileSettingsPrivacyCardProps {
  isPrivate: boolean;
  isUpdatingPrivacy: boolean;
  onTogglePrivacy: (nextValue: boolean) => void;
}

const ProfileSettingsPrivacyCard = ({
  isPrivate,
  isUpdatingPrivacy,
  onTogglePrivacy,
}: ProfileSettingsPrivacyCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Profile privacy</CardTitle>
        <p className="text-sm text-slate-600">
          Only people who follow you can see your catches. Your profile may still appear in search and leaderboards.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
        <p className="text-sm text-slate-600 md:max-w-lg">
          Toggle privacy to control who can view your catches and detailed stats.
        </p>
        <div className="flex items-center gap-3">
          <Label htmlFor="privateAccount" className="text-sm font-medium text-slate-800">
            Private account
          </Label>
          <Switch
            id="privateAccount"
            checked={isPrivate}
            onCheckedChange={(checked) => {
              if (!isUpdatingPrivacy) {
                onTogglePrivacy(checked);
              }
            }}
            disabled={isUpdatingPrivacy}
          />
          {isUpdatingPrivacy ? (
            <span className="text-xs text-slate-500">Saving…</span>
          ) : (
            <span className="text-xs text-slate-500">{isPrivate ? "Enabled" : "Disabled"}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPrivacyCard;
