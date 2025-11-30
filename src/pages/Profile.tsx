import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Star, Trophy, Fish, BarChart3, Loader2, AlertTriangle } from "lucide-react";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { createNotification } from "@/lib/notifications";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";
import { isUuid } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";
import { ProfileNotificationsSection } from "@/components/ProfileNotificationsSection";
import ProfileNotFound from "@/components/ProfileNotFound";
import { isAdminUser } from "@/lib/admin";
import { toast } from "sonner";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileAdminModerationTools from "@/components/profile/ProfileAdminModerationTools";
import ProfileAboutStaffCard from "@/components/profile/ProfileAboutStaffCard";
import ProfileAnglerStatsSection from "@/components/profile/ProfileAnglerStatsSection";
import ProfileFollowingStrip from "@/components/profile/ProfileFollowingStrip";
import ProfileCatchesGrid from "@/components/profile/ProfileCatchesGrid";
import ProfileDeletedStub from "@/components/profile/ProfileDeletedStub";
import ProfileBlockedViewerStub from "@/components/profile/ProfileBlockedViewerStub";

interface Profile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  is_deleted?: boolean;
}

interface Catch {
  id: string;
  user_id?: string;
  location?: string | null;
  hide_exact_spot?: boolean | null;
  visibility?: string | null;
  title: string;
  image_url: string;
  ratings: { rating: number }[];
  weight: number | null;
  weight_unit: string | null;
  species: string | null;
  created_at: string;
  venues?: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

interface FollowingProfile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const PROFILE_STATUS_PLACEHOLDER = "No intro yet. Tell others where you fish and what you target.";

const formatWeight = (weight: number | null, unit: string | null) => {
  if (weight === null || weight === undefined) return "-";
  return `${weight}${unit === "kg" ? "kg" : "lb"}`;
};

const formatSpecies = (species: string | null) => {
  if (!species) return "-";
  return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
};

const buildProfileStatCards = (stats: {
  total: number;
  avgRating: string;
  heaviestCatch: Catch | null;
  topSpecies: { species: string; count: number } | null;
}) => [
  {
    label: "Total catches",
    value: stats.total ?? 0,
    hint: stats.total > 0 ? null : "Log your first catch",
    icon: <Fish className="h-5 w-5" />,
  },
  {
    label: "Average rating",
    value: stats.avgRating !== "-" ? stats.avgRating : "–",
    hint:
      stats.avgRating !== "-"
        ? null
        : "Ratings will appear once others review your catches.",
    icon: <Star className="h-5 w-5" />,
  },
  {
    label: "Heaviest catch",
    value: stats.heaviestCatch
      ? formatWeight(stats.heaviestCatch.weight, stats.heaviestCatch.weight_unit)
      : "–",
    hint: stats.heaviestCatch ? null : "Add weights to your catches to track PBs.",
    icon: <Trophy className="h-5 w-5" />,
  },
  {
    label: "Top species",
    value: stats.topSpecies
      ? `${formatSpecies(stats.topSpecies.species)} (${stats.topSpecies.count})`
      : "–",
    hint: stats.topSpecies ? null : "No catches yet — species will appear here.",
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

const Profile = () => {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catches, setCatches] = useState<Catch[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingProfiles, setFollowingProfiles] = useState<FollowingProfile[]>([]);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [isAdminProfileOwner, setIsAdminProfileOwner] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isViewerBlockedByProfileOwner, setIsViewerBlockedByProfileOwner] = useState(false);
  const [blockStatusLoading, setBlockStatusLoading] = useState(true);

  const profileId = profile?.id ?? null;
  const isOwnProfile = user?.id === profileId;
  const isDeleted = !!profile?.is_deleted;

  const profileAvatarUrl = useMemo(
    () => resolveAvatarUrl({ path: profile?.avatar_path, legacyUrl: profile?.avatar_url }),
    [profile?.avatar_path, profile?.avatar_url]
  );

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      if (!user) {
        setIsAdminViewer(false);
        return;
      }
      const result = await isAdminUser(user.id);
      if (active) {
        setIsAdminViewer(result);
      }
    };
    void checkAdmin();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const checkProfileAdmin = async () => {
      if (!profileId) {
        setIsAdminProfileOwner(false);
        return;
      }
      const result = await isAdminUser(profileId);
      if (active) {
        setIsAdminProfileOwner(result);
      }
    };
    void checkProfileAdmin();
    return () => {
      active = false;
    };
  }, [profileId]);

  useEffect(() => {
    const checkBlockStatus = async () => {
      setBlockStatusLoading(true);
      if (!user || !profileId) {
        setIsBlockedByMe(false);
        setIsViewerBlockedByProfileOwner(false);
        setBlockStatusLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profile_blocks")
        .select("blocker_id, blocked_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", profileId)
        .maybeSingle();
      setIsBlockedByMe(!error && !!data);

      const { data: blockedViewerRow, error: blockedViewerError } = await supabase
        .from("profile_blocks")
        .select("blocker_id, blocked_id")
        .eq("blocker_id", profileId)
        .eq("blocked_id", user.id)
        .maybeSingle();
      setIsViewerBlockedByProfileOwner(!blockedViewerError && !!blockedViewerRow);
      setBlockStatusLoading(false);
    };
    void checkBlockStatus();
  }, [profileId, user]);

  const fetchProfile = useCallback(async () => {
    if (!slug) {
      setIsLoading(false);
      setIsNotFound(true);
      setProfile(null);
      setCatches([]);
      setFollowersCount(0);
      setFollowingProfiles([]);
      return;
    }
    setIsLoading(true);
    const slugIsUuid = isUuid(slug);
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_path, avatar_url, bio, is_private, is_deleted")
      .limit(1);

    query = slugIsUuid ? query.eq("id", slug) : query.eq("username", slug);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      setIsLoading(false);
      setIsNotFound(true);
      setProfile(null);
      setCatches([]);
      setFollowersCount(0);
      setFollowingProfiles([]);
      return;
    }

    const profileRow = data as Profile;
    setIsNotFound(false);
    setProfile(profileRow);
    setEditedBio(profileRow.bio || "");
    setIsLoading(false);

    if ((slugIsUuid || profileRow.username !== slug) && profileRow.username) {
      navigate(`/profile/${profileRow.username}`, { replace: true });
    }
  }, [navigate, slug]);

  const fetchUserCatches = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from("catches")
      .select(
        "id, user_id, location, hide_exact_spot, visibility, title, image_url, weight, weight_unit, species, created_at, ratings (rating), venues:venue_id (id, slug, name)"
      )
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCatches(data);
    }
  }, [profileId]);

  const fetchFollowerCount = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase.rpc("get_follower_count", {
      p_profile_id: profileId,
    });

    if (error) {
      console.error("Failed to load follower count", error);
      return;
    }

    setFollowersCount(data ?? 0);
  }, [profileId]);

  const fetchFollowingProfiles = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from("profile_follows")
      .select(
        `
          followed_profile:profiles!profile_follows_following_id_fkey (
            id,
            username,
            avatar_path,
            avatar_url,
            bio
          )
        `
      )
      .eq("follower_id", profileId);

    if (!error && data) {
      const parsed = (data as { followed_profile: FollowingProfile | null }[])
        .map((row) => row.followed_profile)
        .filter((profileRow): profileRow is FollowingProfile => !!profileRow);
      setFollowingProfiles(parsed);
    }
  }, [profileId]);

  const fetchFollowStatus = useCallback(async () => {
    if (!profileId || !user || user.id === profileId) return;
    const { data, error } = await supabase
      .from("profile_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profileId)
      .maybeSingle();

    if (!error) {
      setIsFollowing(!!data);
    }
  }, [profileId, user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profileId) return;
    void fetchUserCatches();
    void fetchFollowerCount();
    void fetchFollowingProfiles();
  }, [profileId, fetchFollowerCount, fetchFollowingProfiles, fetchUserCatches]);

  useEffect(() => {
    if (!profileId || !user || user.id === profileId) {
      setIsFollowing(false);
      return;
    }
    void fetchFollowStatus();
  }, [profileId, user, fetchFollowStatus]);

  const handleToggleFollow = async () => {
    if (!user || !profileId) {
      toast.error("Sign in to follow anglers");
      navigate("/auth");
      return;
    }
    if (user.id === profileId) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);

      if (error) {
        toast.error("Failed to unfollow");
      } else {
        setIsFollowing(false);
        await fetchFollowerCount();
      }
    } else {
      const { error } = await supabase.rpc("follow_profile_with_rate_limit", {
        p_following_id: profileId,
      });

      if (error) {
        if (isRateLimitError(error)) {
          toast.error(getRateLimitMessage(error));
        } else {
          toast.error("Failed to follow");
        }
      } else {
        setIsFollowing(true);
        await fetchFollowerCount();
        void createNotification({
          userId: profileId,
          actorId: user.id,
          type: "new_follower",
          payload: {
            message: `${user.user_metadata?.username ?? user.email ?? "Someone"} started following you.`,
          },
        });
      }
    }

    setFollowLoading(false);
  };

  const handleUpdateBio = async () => {
    if (!user || !isOwnProfile) return;

    const { error } = await supabase
      .from("profiles")
      .update({ bio: editedBio })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update bio");
    } else {
      toast.success("Bio updated!");
      setIsEditing(false);
      fetchProfile();
    }
  };

  const overallStats = useMemo(() => {
    const total = catches.length;
    const allRatings = catches.flatMap((catchItem) => catchItem.ratings.map((r) => r.rating));
    const avgRating =
      allRatings.length > 0
        ? (allRatings.reduce((acc, rating) => acc + rating, 0) / allRatings.length).toFixed(1)
        : "-";

    const heaviestCatch = catches
      .filter((catchItem) => catchItem.weight !== null)
      .reduce<Catch | null>((prev, curr) => {
        if (!prev) return curr;
        if (!prev.weight) return curr;
        if (!curr.weight) return prev;
        return curr.weight > prev.weight ? curr : prev;
      }, null);

    const speciesCount = new Map<string, number>();
    catches.forEach((catchItem) => {
      if (catchItem.species) {
        speciesCount.set(catchItem.species, (speciesCount.get(catchItem.species) ?? 0) + 1);
      }
    });
    const topSpeciesEntry = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1])[0];

    const latestCatch = catches[0] ?? null;

    return {
      total,
      avgRating,
      heaviestCatch,
      topSpecies: topSpeciesEntry ? { species: topSpeciesEntry[0], count: topSpeciesEntry[1] } : null,
      latestCatch,
      followingCount: followingProfiles.length,
    };
  }, [catches, followingProfiles]);

  const statsCards = useMemo(
    () =>
      buildProfileStatCards({
        total: overallStats.total,
        avgRating: overallStats.avgRating,
        heaviestCatch: overallStats.heaviestCatch,
        topSpecies: overallStats.topSpecies,
      }),
    [overallStats]
  );

  if (isNotFound) {
    return <ProfileNotFound />;
  }

  if (isDeleted && !isAdminViewer && !isLoading) {
    return <ProfileDeletedStub isOwnProfile={!!isOwnProfile} />;
  }

  const profileBio =
    profile?.bio && profile.bio.trim().length > 0
      ? profile.bio
      : PROFILE_STATUS_PLACEHOLDER;

  const staffBioFallback =
    "This is an official ReelyRated staff account. It’s used for moderation, safety, and product updates.";
  const totalFollowers = followersCount ?? 0;
  const statusPill = {
    label: "Active",
    className: "border-emerald-300/60 bg-emerald-500/10 text-emerald-50",
  };
  const canViewPrivateContent = !profile?.is_private || isOwnProfile || isAdminViewer || isFollowing;
  const isDeletedBanner = isDeleted && isAdminViewer;
  const isPrivateAndBlocked = profile?.is_private && !canViewPrivateContent;
  const shouldShowBlockedViewerStub = isViewerBlockedByProfileOwner && !isAdminViewer;
  const isAdminProfile = isAdminProfileOwner;
  const isAdminSelf = isAdminProfile && isOwnProfile;
  const isAdminPublicView = isAdminProfile && !isOwnProfile;
  const isUsingStaffBioFallback = isAdminProfile && (!profile?.bio || profile.bio.trim().length === 0);
  const displayBio = isUsingStaffBioFallback ? staffBioFallback : profileBio;
  const heroBackgroundClasses = isAdminProfile
    ? "relative overflow-hidden rounded-3xl border border-indigo-200/40 bg-slate-950 text-white shadow-xl"
    : "relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white shadow-xl";

  if (!isLoading && !blockStatusLoading && shouldShowBlockedViewerStub) {
    return <ProfileBlockedViewerStub />;
  }

  if (isLoading || blockStatusLoading || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading profile…
        </div>
      </div>
    );
  }

  const handleBlock = async () => {
    if (!profileId || !user) return;
    try {
      setBlockLoading(true);
      const { error } = await supabase.rpc("block_profile", {
        p_blocked_id: profileId,
        p_reason: null,
      });
      if (error) {
        console.error("Failed to block user", error);
        toast.error("We couldn’t block this user. Please try again.");
        return;
      }
      toast.success("User blocked. You won’t see their catches or comments.");
      setIsBlockedByMe(true);
    } catch (err) {
      console.error("Error blocking user", err);
      toast.error("Something went wrong blocking this user.");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!profileId || !user) return;
    try {
      setBlockLoading(true);
      const { error } = await supabase.rpc("unblock_profile", {
        p_blocked_id: profileId,
      });
      if (error) {
        console.error("Failed to unblock user", error);
        toast.error("We couldn’t unblock this user. Please try again.");
        return;
      }
      toast.success("User unblocked. Their content will reappear based on privacy settings.");
      setIsBlockedByMe(false);
    } catch (err) {
      console.error("Error unblocking user", err);
      toast.error("Something went wrong unblocking this user.");
    } finally {
      setBlockLoading(false);
    }
  };

  const showStatusPill = !isAdminProfile;
  const heroStatTiles = isAdminProfile
    ? []
    : [
        {
          label: "Total catches",
          value: catches.length,
          hint: catches.length === 0 ? "Log your first catch to start your profile." : null,
        },
        {
          label: "Followers",
          value: totalFollowers,
          hint: totalFollowers === 0 ? "Followers will appear once anglers subscribe to you." : null,
        },
        {
          label: "Avg rating",
          value: overallStats.avgRating !== "-" ? overallStats.avgRating : "–",
          hint: overallStats.avgRating === "-" ? "Ratings will appear after reviews." : null,
        },
      ];
  const handleNavigateToAddCatch = () => navigate("/add-catch");
  const handleNavigateToFeed = () => navigate("/feed");
  const handleNavigateToInsights = () => navigate("/insights");
  const handleNavigateToSettings = () => navigate("/settings/profile");
  const handleNavigateToReports = () => navigate("/admin/reports");
  const handleNavigateToAuditLog = () => navigate("/admin/audit-log");
  const handleNavigateToModeration = () => {
    if (profileId) {
      navigate(`/admin/users/${profileId}/moderation`);
    }
  };
  const handleOpenCatch = (catchId: string) => navigate(`/catch/${catchId}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {isDeletedBanner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
              This account has been deleted. You&apos;re viewing historical data as an admin.
            </div>
          ) : null}
          {isBlockedByMe && !isDeleted && !isAdminProfileOwner && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>You have blocked this angler. Unblock to see their catches again.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800"
                onClick={handleUnblock}
                disabled={blockLoading}
              >
                {blockLoading ? "Working…" : "Unblock"}
              </Button>
            </div>
          )}
          <ProfileHero
            profile={profile}
            profileAvatarUrl={profileAvatarUrl}
            displayBio={displayBio}
            bio={profile.bio}
            bioExpanded={bioExpanded}
            onToggleBioExpanded={() => setBioExpanded((prev) => !prev)}
            isEditing={isEditing}
            editedBio={editedBio}
            onChangeEditedBio={setEditedBio}
            onSaveBio={handleUpdateBio}
            onCancelEditBio={() => setIsEditing(false)}
            isOwnProfile={isOwnProfile}
            isAdminProfile={isAdminProfile}
            isAdminSelf={isAdminSelf}
            isAdminPublicView={isAdminPublicView}
            isAdminViewer={isAdminViewer}
            isUsingStaffBioFallback={isUsingStaffBioFallback}
            showStatusPill={showStatusPill}
            statusPill={statusPill}
            heroBackgroundClasses={heroBackgroundClasses}
            heroStatTiles={heroStatTiles}
            onAddCatch={handleNavigateToAddCatch}
            onEditProfile={() => setIsEditing(true)}
            onViewStats={handleNavigateToInsights}
            onOpenSettings={handleNavigateToSettings}
            onViewFeed={handleNavigateToFeed}
            onModeration={profileId ? handleNavigateToModeration : undefined}
            onReports={handleNavigateToReports}
            onAuditLog={handleNavigateToAuditLog}
            onToggleFollow={handleToggleFollow}
            onBlockToggle={isBlockedByMe ? handleUnblock : handleBlock}
            isFollowing={isFollowing}
            followLoading={followLoading}
            isBlockedByMe={isBlockedByMe}
            blockLoading={blockLoading}
          />

          {isAdminPublicView && (
            <p className="text-xs text-slate-600">
              Official ReelyRated staff account. Use report options on catches or comments to flag issues; support links live in Settings.
            </p>
          )}

          {isAdminSelf ? (
            <ProfileAdminModerationTools profileId={profileId} />
          ) : !isAdminProfile ? (
            <ProfileAnglerStatsSection statsCards={statsCards} />
          ) : (
            <ProfileAboutStaffCard onViewFeed={handleNavigateToFeed} />
          )}

          {isOwnProfile && !isAdminProfile && (
            <div className="space-y-4">
              <ProfileNotificationsSection userId={profileId} />
            </div>
          )}

          {!isAdminProfile && !isAdminSelf ? (
            <ProfileFollowingStrip
              isOwnProfile={isOwnProfile}
              username={profile.username}
              followingProfiles={followingProfiles}
              onNavigateToFeed={handleNavigateToFeed}
            />
          ) : null}

          {!isAdminProfile && !isAdminSelf ? (
            <ProfileCatchesGrid
              isOwnProfile={isOwnProfile}
              username={profile.username}
              catches={catches}
              isPrivateAndBlocked={isPrivateAndBlocked}
              onLogCatch={handleNavigateToAddCatch}
              onViewFeed={handleNavigateToFeed}
              onOpenCatch={handleOpenCatch}
              formatWeight={formatWeight}
              formatSpecies={formatSpecies}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Profile;
