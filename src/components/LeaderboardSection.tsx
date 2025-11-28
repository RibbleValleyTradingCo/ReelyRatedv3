import { memo } from "react";
import { Link } from "react-router-dom";

import "./LeaderboardSection.css";

import { Leaderboard } from "@/components/Leaderboard";
import { PulsingDot } from "@/components/PulsingDot";
import { Button } from "@/components/ui/button";

interface LeaderboardSectionProps {
  limit?: number;
}

const LeaderboardSectionComponent = ({ limit = 10 }: LeaderboardSectionProps) => (
  <section className="leaderboard-section">
    <div className="leaderboard-section__container">
      <header className="leaderboard-section__header">
        <span className="leaderboard-section__badge">
          <PulsingDot className="h-2.5 w-2.5" />
          Live Rankings
        </span>
        <h2>Angler Leaderboard</h2>
        <p>
          Scores blend catch weight, community ratings, media evidence, and logbook completeness. Discover
          the most complete stories from the water.
        </p>
      </header>

      <Leaderboard limit={limit} />

      <div className="leaderboard-section__footer">
        <Button variant="ocean" size="lg" className="w-full sm:w-auto rounded-2xl px-6 py-3 font-semibold" asChild>
          <Link to="/leaderboard">View Full Leaderboard →</Link>
        </Button>
      </div>
    </div>
  </section>
);

export const LeaderboardSection = memo(LeaderboardSectionComponent);

LeaderboardSection.displayName = "LeaderboardSection";

export default LeaderboardSection;
