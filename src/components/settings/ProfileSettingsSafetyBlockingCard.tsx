import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { resolveAvatarUrl } from "@/lib/storage";

interface BlockedProfileEntry {
  blocked_id: string;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_path: string | null;
    avatar_url: string | null;
    bio: string | null;
    is_deleted: boolean | null;
  } | null;
}

interface ProfileSettingsSafetyBlockingCardProps {
  blockedProfiles: BlockedProfileEntry[];
  blockedLoading: boolean;
  blockedError: string | null;
  onUnblock: (blockedId: string, username?: string | null) => void;
}

const ProfileSettingsSafetyBlockingCard = ({
  blockedProfiles,
  blockedLoading,
  blockedError,
  onUnblock,
}: ProfileSettingsSafetyBlockingCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Safety &amp; blocking</CardTitle>
        <p className="text-sm text-slate-600">See and manage anglers you&apos;ve blocked.</p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 md:px-8 md:pb-8">
        {blockedLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading blocked anglers…
          </div>
        ) : blockedError ? (
          <p className="text-sm text-red-600">{blockedError}</p>
        ) : blockedProfiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            You haven&apos;t blocked any anglers yet. If someone&apos;s behaviour isn&apos;t for you, you can block them from their profile.
          </div>
        ) : (
          <div className="space-y-3">
            {blockedProfiles.map((row) => {
              const blockedProfile = row.profiles;
              const isDeleted = blockedProfile?.is_deleted ?? false;
              const username = blockedProfile?.username ?? "";
              const displayName = isDeleted ? "Deleted angler" : blockedProfile?.full_name || username || "Unknown angler";
              const secondaryLine = isDeleted ? "Account deleted" : username ? `@${username}` : "No username";
              const bio = isDeleted ? "This angler deleted their account." : blockedProfile?.bio?.trim() || "No bio yet.";
              const avatarUrl = isDeleted
                ? undefined
                : resolveAvatarUrl({
                    path: blockedProfile?.avatar_path,
                    legacyUrl: blockedProfile?.avatar_url,
                  });
              return (
                <div
                  key={row.blocked_id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatarUrl ?? undefined} />
                      <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-900">{displayName}</div>
                      <div className="text-xs text-slate-500">{secondaryLine}</div>
                      <p className="text-xs text-slate-600 line-clamp-2">{bio}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="h-9" onClick={() => onUnblock(row.blocked_id, username)}>
                    Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export type { BlockedProfileEntry };
export default ProfileSettingsSafetyBlockingCard;
