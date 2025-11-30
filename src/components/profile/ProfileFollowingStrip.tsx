import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Fish } from "lucide-react";
import { getProfilePath } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";

interface FollowingProfile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface ProfileFollowingStripProps {
  isOwnProfile: boolean;
  username: string;
  followingProfiles: FollowingProfile[];
  onNavigateToFeed: () => void;
}

const ProfileFollowingStrip = ({
  isOwnProfile,
  username,
  followingProfiles,
  onNavigateToFeed,
}: ProfileFollowingStripProps) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {isOwnProfile ? "Anglers you follow" : `${username} follows`}
        </h2>
        {isOwnProfile && followingProfiles.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {followingProfiles.length} angler{followingProfiles.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm overflow-visible">
        {followingProfiles.length > 0 ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {followingProfiles.map((angler) => (
              <Link
                key={angler.id}
                to={getProfilePath({ username: angler.username, id: angler.id })}
                className="flex min-w-[180px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-shadow duration-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 snap-start"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={resolveAvatarUrl({ path: angler.avatar_path, legacyUrl: angler.avatar_url }) ?? ""} />
                  <AvatarFallback>{angler.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{angler.username}</p>
                  <p className="truncate text-xs text-slate-500">{angler.bio || "No bio yet"}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-600">
            <Fish className="h-10 w-10 text-slate-400" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">You’re not following anyone yet.</p>
              <p className="text-sm text-slate-500">Browse the feed and follow anglers to see their PBs here.</p>
            </div>
            <Button variant="outline" className="h-10 rounded-full px-5 text-sm font-semibold" onClick={onNavigateToFeed}>
              Go to feed
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileFollowingStrip;
