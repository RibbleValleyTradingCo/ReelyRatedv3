import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser, useAuthLoading } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { canViewCatch } from "@/lib/visibility";
import { useSearchParams } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { FeedFilters } from "@/components/feed/FeedFilters";
import { CatchCard } from "@/components/feed/CatchCard";
import { logger } from "@/lib/logger";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

type CustomFields = {
  species?: string;
  method?: string;
};

type CatchConditions = {
  customFields?: CustomFields;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  };
  [key: string]: unknown;
} | null;

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface Catch {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  created_at: string;
  visibility: string | null;
  hide_exact_spot: boolean | null;
  session_id: string | null;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  ratings: { rating: number }[];
  comments: { id: string }[];
  reactions: { user_id: string }[] | null;
  conditions: CatchConditions;
}

const Feed = () => {
  const { user } = useAuthUser();
  const { loading } = useAuthLoading();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catches, setCatches] = useState<Catch[]>([]);
  const [filteredCatches, setFilteredCatches] = useState<Catch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [customSpeciesFilter, setCustomSpeciesFilter] = useState("");
  const [feedScope, setFeedScope] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const sessionFilter = searchParams.get("session");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadCatches = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("catches")
        .select(`
          *,
          profiles:user_id (username, avatar_path, avatar_url),
          ratings (rating),
          comments:catch_comments (id),
          reactions:catch_reactions (user_id)
        `)
        .is("deleted_at", null)
        .is("comments.deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load catches");
        logger.error("Failed to load catches", error, { userId: user?.id });
        setCatches([]);
      } else {
        setCatches((data as Catch[]) || []);
      }
      setIsLoading(false);
    };

    void loadCatches();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      setFeedScope("all");
      return;
    }

    const loadFollowing = async () => {
      const { data, error} = await supabase
        .from("profile_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (error) {
        logger.error("Failed to load followed anglers", error, { userId: user.id });
        setFollowingIds([]);
        return;
      }

      setFollowingIds((data ?? []).map((row) => row.following_id));
    };

    void loadFollowing();
  }, [user]);

  const calculateAverageRating = (ratings: { rating: number }[]) => {
    if (ratings.length === 0) return "0";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const filterAndSortCatches = useCallback(() => {
    let filtered = [...catches];

    filtered = filtered.filter((catchItem) =>
      canViewCatch(catchItem.visibility as VisibilityType | null, catchItem.user_id, user?.id, followingIds)
    );

    if (sessionFilter) {
      filtered = filtered.filter((catchItem) => catchItem.session_id === sessionFilter);
    }

    if (feedScope === "following") {
      if (followingIds.length === 0) {
        filtered = [];
      } else {
        filtered = filtered.filter((catchItem) => followingIds.includes(catchItem.user_id));
      }
    }

    if (speciesFilter !== "all") {
      filtered = filtered.filter((catchItem) => {
        if (speciesFilter === "other") {
          if (catchItem.species !== "other") {
            return false;
          }
          if (!customSpeciesFilter) {
            return true;
          }
          const customValue = (catchItem.conditions?.customFields?.species ?? "").toLowerCase();
          return customValue.startsWith(customSpeciesFilter.toLowerCase());
        }
        return catchItem.species === speciesFilter;
      });
    }

    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "highest_rated") {
      filtered.sort((a, b) => {
        const avgA = calculateAverageRating(a.ratings);
        const avgB = calculateAverageRating(b.ratings);
        return parseFloat(avgB) - parseFloat(avgA);
      });
    } else if (sortBy === "heaviest") {
      filtered.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }

    setFilteredCatches(filtered);
  }, [catches, feedScope, followingIds, speciesFilter, customSpeciesFilter, sortBy, user?.id, sessionFilter]);

  useEffect(() => {
    filterAndSortCatches();
  }, [filterAndSortCatches]);

  useEffect(() => {
    if (speciesFilter !== "other" && customSpeciesFilter) {
      setCustomSpeciesFilter("");
    }
  }, [speciesFilter, customSpeciesFilter]);

  if (loading || isLoading) {
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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Community Catches</h1>

        <FeedFilters
          feedScope={feedScope}
          onFeedScopeChange={setFeedScope}
          speciesFilter={speciesFilter}
          onSpeciesFilterChange={setSpeciesFilter}
          customSpeciesFilter={customSpeciesFilter}
          onCustomSpeciesFilterChange={setCustomSpeciesFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          userDisabled={!user}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatches.map((catchItem) => (
            <CatchCard key={catchItem.id} catchItem={catchItem} userId={user?.id} />
          ))}
        </div>

        {filteredCatches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {catches.length === 0
                ? "No catches yet. Be the first to share!"
                : sessionFilter
                  ? "No catches logged for this session yet."
                  : feedScope === "following"
                    ? "No catches from anglers you follow yet. Explore the full feed or follow more people."
                    : "No catches match your filters"}
            </p>
            <Button variant="ocean" onClick={() => navigate("/add-catch")}>
              Log Your First Catch
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
