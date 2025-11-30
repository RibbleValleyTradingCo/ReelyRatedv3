import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileHeroProps {
  profile: {
    id: string;
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
  profileAvatarUrl: string | null;
  displayBio: string;
  bio: string | null;
  bioExpanded: boolean;
  onToggleBioExpanded: () => void;
  isEditing: boolean;
  editedBio: string;
  onChangeEditedBio: (value: string) => void;
  onSaveBio: () => void;
  onCancelEditBio: () => void;
  isOwnProfile: boolean;
  isAdminProfile: boolean;
  isAdminSelf: boolean;
  isAdminPublicView: boolean;
  isAdminViewer: boolean;
  isUsingStaffBioFallback: boolean;
  showStatusPill: boolean;
  statusPill: { label: string; className: string };
  heroBackgroundClasses: string;
  heroStatTiles: { label: string; value: string | number; hint?: string | null }[];
  onAddCatch: () => void;
  onEditProfile: () => void;
  onViewStats: () => void;
  onOpenSettings: () => void;
  onViewFeed: () => void;
  onModeration?: () => void;
  onReports?: () => void;
  onAuditLog?: () => void;
  onToggleFollow?: () => void;
  onBlockToggle?: () => void;
  isFollowing?: boolean;
  followLoading?: boolean;
  isBlockedByMe?: boolean;
  blockLoading?: boolean;
}

const ProfileHero = ({
  profile,
  profileAvatarUrl,
  displayBio,
  bio,
  bioExpanded,
  onToggleBioExpanded,
  isEditing,
  editedBio,
  onChangeEditedBio,
  onSaveBio,
  onCancelEditBio,
  isOwnProfile,
  isAdminProfile,
  isAdminSelf,
  isAdminPublicView,
  isAdminViewer,
  isUsingStaffBioFallback,
  showStatusPill,
  statusPill,
  heroBackgroundClasses,
  heroStatTiles,
  onAddCatch,
  onEditProfile,
  onViewStats,
  onOpenSettings,
  onViewFeed,
  onModeration,
  onReports,
  onAuditLog,
  onToggleFollow,
  onBlockToggle,
  isFollowing,
  followLoading,
  isBlockedByMe,
  blockLoading,
}: ProfileHeroProps) => {
  return (
    <section aria-label="Angler profile overview" className={heroBackgroundClasses}>
      <div
        className={cn(
          "absolute -top-24 right-10 h-56 w-56 rounded-full blur-3xl",
          isAdminProfile ? "bg-indigo-500/25" : "bg-sky-500/30"
        )}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full blur-3xl",
          isAdminProfile ? "bg-indigo-600/20" : "bg-sky-600/20"
        )}
      />
      <div
        className={cn(
          "absolute inset-0",
          isAdminProfile
            ? "bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2)_0%,_rgba(15,23,42,0.94)_50%,_rgba(8,12,20,0.98)_100%)]"
            : "bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.2)_0%,_rgba(15,23,42,0.94)_50%,_rgba(8,12,20,0.98)_100%)]"
        )}
      />
      <div className="relative z-10 grid gap-8 px-5 py-8 sm:px-7 sm:py-10 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            {!isAdminProfile && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100/90 shadow-sm">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {isOwnProfile ? "My account" : "Angler spotlight"}
              </span>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Avatar className="h-20 w-20 shrink-0 ring-2 ring-white/30 ring-offset-4 ring-offset-slate-900 shadow-2xl sm:h-24 sm:w-24">
                <AvatarImage src={profileAvatarUrl ?? ""} />
                <AvatarFallback className="text-2xl">{profile.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl sm:leading-snug">{profile.username}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 font-medium text-white/90">
                    @{profile.username}
                  </span>
                  {isAdminProfile && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/40 bg-indigo-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-50">
                      ReelyRated staff
                    </span>
                  )}
                  {showStatusPill ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm",
                        statusPill.className
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {statusPill.label}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {isEditing && isOwnProfile ? (
            <div className="w-full max-w-2xl space-y-3 rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <Textarea
                value={editedBio}
                onChange={(e) => onChangeEditedBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="bg-white text-slate-900"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  onClick={onSaveBio}
                  className="h-9 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-sky-500 hover:to-cyan-300"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full border-white/40 bg-white/10 px-4 text-white hover:bg-white/15"
                  onClick={onCancelEditBio}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl space-y-2">
              {displayBio ? (
                <p className={cn("text-sm leading-relaxed text-white/80", bioExpanded ? "" : "line-clamp-3 sm:line-clamp-4")}>
                  {displayBio}
                </p>
              ) : null}
              {bio && bio.length > 180 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-white/90 underline underline-offset-2"
                  onClick={onToggleBioExpanded}
                >
                  {bioExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
              {isAdminProfile && !isUsingStaffBioFallback && (
                <p className="text-xs text-white/75">
                  This is a ReelyRated staff account used for moderation and safety. Admin profiles don&apos;t usually share personal catches.
                </p>
              )}
            </div>
          )}

          <div className="flex w-full flex-wrap items-center gap-3 md:max-w-3xl">
            {isAdminSelf ? (
              <>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={onOpenSettings}
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Account settings
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={onViewFeed}
                >
                  View community feed
                </Button>
                {onModeration ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={onModeration}
                  >
                    User moderation
                  </Button>
                ) : null}
                {onReports ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={onReports}
                  >
                    Reports
                  </Button>
                ) : null}
                {onAuditLog ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={onAuditLog}
                  >
                    Audit log
                  </Button>
                ) : null}
              </>
            ) : isOwnProfile ? (
              <>
                {!isAdminProfile && (
                  <>
                    <Button
                      className="h-10 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-sky-500 hover:to-cyan-300"
                      onClick={onAddCatch}
                    >
                      Add catch
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                      onClick={onEditProfile}
                    >
                      Edit profile
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                      onClick={onViewStats}
                    >
                      View my stats
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={onOpenSettings}
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Account settings
                  </span>
                </Button>
                {isAdminProfile ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={onViewFeed}
                  >
                    View community feed
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {!isAdminProfile && (
                  <>
                    {!isBlockedByMe && (
                      <Button
                        className="h-10 rounded-full border border-white/25 bg-white/90 px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white"
                        onClick={onToggleFollow}
                        disabled={followLoading}
                      >
                        {followLoading ? "Updating…" : isFollowing ? "Following" : "Follow angler"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 rounded-full border-white/40 bg-white/10 px-4 font-semibold text-white hover:bg-white/20"
                      onClick={onBlockToggle}
                      disabled={blockLoading}
                      title={isBlockedByMe ? undefined : "Block this user"}
                    >
                      {blockLoading ? "Working…" : isBlockedByMe ? "Unblock" : "Block user"}
                    </Button>
                  </>
                )}
                {isAdminProfile ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/20 bg-white/0 px-5 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={onViewFeed}
                  >
                    Back to feed
                  </Button>
                ) : null}
              </>
            )}
            {!isAdminProfile && !isAdminSelf ? (
              <Button
                variant="outline"
                className="h-10 rounded-full border-white/20 bg-white/0 px-5 text-sm font-semibold text-white hover:bg-white/10"
                onClick={onViewFeed}
              >
                View community feed
              </Button>
            ) : null}
            {isAdminViewer && !isAdminSelf && onModeration ? (
              <Button
                variant="outline"
                className="h-10 rounded-full border-white/30 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                onClick={onModeration}
              >
                Moderation
              </Button>
            ) : null}
          </div>
        </div>

        {!isAdminProfile && heroStatTiles.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            {heroStatTiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-white/15 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/30 backdrop-blur"
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">{tile.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{tile.value}</p>
                {tile.hint ? <p className="text-xs text-white/65">{tile.hint}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ProfileHero;
