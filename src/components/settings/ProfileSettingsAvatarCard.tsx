import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProfileAvatarSection from "@/components/settings/ProfileAvatarSection";

interface ProfileSettingsAvatarCardProps {
  userId: string;
  username: string;
  avatarPath: string | null;
  legacyAvatarUrl: string | null;
  onAvatarChange: (path: string | null) => void;
}

const ProfileSettingsAvatarCard = ({
  userId,
  username,
  avatarPath,
  legacyAvatarUrl,
  onAvatarChange,
}: ProfileSettingsAvatarCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Avatar</CardTitle>
        <p className="text-sm text-slate-600">Upload a photo so other anglers can recognise you.</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 md:px-8 md:pb-8">
        <ProfileAvatarSection
          userId={userId}
          username={username}
          avatarPath={avatarPath}
          legacyAvatarUrl={legacyAvatarUrl}
          onAvatarChange={onAvatarChange}
        />
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsAvatarCard;
