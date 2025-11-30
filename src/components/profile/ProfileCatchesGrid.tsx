import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fish, Lock, MapPin } from "lucide-react";

interface CatchVenue {
  id: string;
  slug: string;
  name: string;
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
  venues?: CatchVenue | null;
}

interface ProfileCatchesGridProps {
  isOwnProfile: boolean;
  username: string;
  catches: Catch[];
  isPrivateAndBlocked: boolean;
  onLogCatch: () => void;
  onViewFeed: () => void;
  onOpenCatch: (id: string) => void;
  formatWeight: (weight: number | null, unit: string | null) => string;
  formatSpecies: (species: string | null) => string;
}

const ProfileCatchesGrid = ({
  isOwnProfile,
  username,
  catches,
  isPrivateAndBlocked,
  onLogCatch,
  onViewFeed,
  onOpenCatch,
  formatWeight,
  formatSpecies,
}: ProfileCatchesGridProps) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{isOwnProfile ? "Your catches" : `${username}'s catches`}</h2>
          <span className="text-sm text-slate-500">{catches.length} logged</span>
        </div>
        {isOwnProfile ? (
          <Button variant="outline" className="h-10 rounded-full px-4 text-sm" onClick={onLogCatch}>
            Log a catch
          </Button>
        ) : null}
      </div>
      {isPrivateAndBlocked ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">This account is private</h3>
            <p className="text-sm text-slate-500">Only followers can see this angler&apos;s catches and detailed stats.</p>
          </div>
        </div>
      ) : catches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <Fish className="h-10 w-10 text-slate-400" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">You haven’t logged any catches yet.</h3>
            <p className="text-sm text-slate-500">Log your first catch to start building your angler profile and rankings.</p>
          </div>
          {isOwnProfile ? (
            <Button variant="outline" className="h-10 rounded-full px-5 text-sm font-semibold" onClick={onLogCatch}>
              Log a catch
            </Button>
          ) : (
            <Button variant="outline" className="h-10 rounded-full px-5 text-sm font-semibold" onClick={onViewFeed}>
              View community feed
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catches.map((catchItem) => (
            <Card
              key={catchItem.id}
              className="overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              onClick={() => onOpenCatch(catchItem.id)}
            >
              <CardContent className="p-0">
                <img src={catchItem.image_url} alt={catchItem.title} className="h-48 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <p className="truncate text-sm font-semibold text-slate-900">{catchItem.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {catchItem.species ? formatSpecies(catchItem.species) : "Species unknown"}
                  </p>
                  {catchItem.venues ? (
                    <Link
                      to={`/venues/${catchItem.venues.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{catchItem.venues.name}</span>
                    </Link>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(catchItem.created_at).toLocaleDateString("en-GB")}</span>
                    <span>{formatWeight(catchItem.weight, catchItem.weight_unit)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProfileCatchesGrid;
