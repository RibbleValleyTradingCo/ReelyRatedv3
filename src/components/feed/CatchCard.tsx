import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MessageCircle, Fish, Heart } from "lucide-react";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { shouldShowExactLocation } from "@/lib/visibility";
import { resolveAvatarUrl } from "@/lib/storage";

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

interface CatchItem {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  visibility: string | null;
  hide_exact_spot: boolean | null;
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

interface CatchCardProps {
  catchItem: CatchItem;
  userId: string | undefined;
}

const formatSpecies = (catchItem: CatchItem) => {
  if (!catchItem.species) return "";
  if (catchItem.species === "other") {
    const customSpecies = catchItem.conditions?.customFields?.species;
    if (customSpecies) {
      return customSpecies;
    }
    return "Other";
  }
  return getFreshwaterSpeciesLabel(catchItem.species) || "Unknown";
};

const formatWeight = (weight: number | null, unit: string | null) => {
  if (!weight) return "";
  return `${weight}${unit === 'kg' ? 'kg' : 'lb'}`;
};

const calculateAverageRating = (ratings: { rating: number }[]) => {
  if (ratings.length === 0) return "0";
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return (sum / ratings.length).toFixed(1);
};

export const CatchCard = memo(({ catchItem, userId }: CatchCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/catch/${catchItem.id}`)}
      data-testid="catch-card"
    >
      <CardContent className="p-0 relative">
        <img
          src={catchItem.image_url}
          alt={catchItem.title}
          className="w-full h-64 object-cover rounded-t-lg"
        />
        {catchItem.species && catchItem.weight && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fish className="w-5 h-5" />
                <span className="font-bold text-lg">{formatSpecies(catchItem)}</span>
              </div>
              <span className="font-bold text-xl">{formatWeight(catchItem.weight, catchItem.weight_unit)}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 p-4">
        <h3 className="font-semibold text-lg" data-testid="catch-title">{catchItem.title}</h3>
        <div className="flex items-center gap-2 w-full">
          <Avatar className="w-8 h-8">
            <AvatarImage
              src={
                resolveAvatarUrl({
                  path: catchItem.profiles?.avatar_path ?? null,
                  legacyUrl: catchItem.profiles?.avatar_url ?? null,
                }) ?? ""
              }
            />
            <AvatarFallback>
              {catchItem.profiles?.username?.[0]?.toUpperCase() ?? "A"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {catchItem.profiles?.username ?? "Unknown angler"}
          </span>
        </div>
        {catchItem.location && (
          <p className="text-sm text-muted-foreground truncate w-full">
            {shouldShowExactLocation(catchItem.hide_exact_spot, catchItem.user_id, userId)
              ? catchItem.location
              : "Undisclosed venue"}
          </p>
        )}
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-accent fill-accent" />
            <span className="text-sm font-medium">
              {calculateAverageRating(catchItem.ratings)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({catchItem.ratings.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{catchItem.comments.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart
              className="w-4 h-4 text-primary"
              fill={(catchItem.reactions?.length ?? 0) > 0 ? "currentColor" : "none"}
            />
            <span className="text-sm">{catchItem.reactions?.length ?? 0}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
});

CatchCard.displayName = "CatchCard";
