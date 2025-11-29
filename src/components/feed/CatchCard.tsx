import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MessageCircle, Fish, Heart, MapPin } from "lucide-react";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { shouldShowExactLocation } from "@/lib/visibility";
import { resolveAvatarUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
  location: string | null;
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
  venues?: {
    slug: string;
    name: string;
  } | null;
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

  const ratingsCount = catchItem.ratings.length;
  const commentsCount = catchItem.comments.length;
  const reactionsCount = catchItem.reactions?.length ?? 0;

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
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
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fish className="w-5 h-5" />
                <span className="font-semibold text-base md:text-lg drop-shadow">{formatSpecies(catchItem)}</span>
              </div>
              <span className="font-bold text-xl md:text-2xl drop-shadow">
                {formatWeight(catchItem.weight, catchItem.weight_unit)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 p-4">
        <h3 className="text-lg font-semibold text-gray-900 md:text-xl" data-testid="catch-title">
          {catchItem.title}
        </h3>
        <div className="flex items-center gap-2 w-full">
          <Avatar className="w-9 h-9">
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
          <span className="text-sm font-medium text-slate-700">
            {catchItem.profiles?.username ?? "Unknown angler"}
          </span>
        </div>
        {catchItem.venues ? (
          <Link
            to={`/venues/${catchItem.venues.slug}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary"
          >
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="truncate">{catchItem.venues.name}</span>
          </Link>
        ) : catchItem.location ? (
          <p className="text-sm text-slate-500 truncate w-full">
            {shouldShowExactLocation(catchItem.hide_exact_spot, catchItem.user_id, userId)
              ? catchItem.location
              : "Undisclosed venue"}
          </p>
        ) : null}
        <div className="flex items-center gap-5 w-full pt-1">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400/90" />
            <span className="text-sm font-semibold text-slate-900">
              {calculateAverageRating(catchItem.ratings)}
            </span>
            <span className="text-xs text-slate-500">
              ({ratingsCount})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className={cn("w-4 h-4", commentsCount === 0 ? "text-slate-300" : "text-slate-500")} />
            <span className={cn("text-sm", commentsCount === 0 ? "text-slate-400" : "text-slate-600")}>
              {commentsCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart
              className={cn(
                "w-4 h-4",
                reactionsCount === 0 ? "text-slate-300" : "text-primary"
              )}
              fill={reactionsCount > 0 ? "currentColor" : "none"}
            />
            <span className={cn("text-sm", reactionsCount === 0 ? "text-slate-400" : "text-slate-600")}>
              {reactionsCount}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
});

CatchCard.displayName = "CatchCard";
