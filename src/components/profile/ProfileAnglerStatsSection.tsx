import { ReactNode } from "react";

interface StatCard {
  label: string;
  value: string | number;
  hint?: string | null;
  icon: ReactNode;
}

interface ProfileAnglerStatsSectionProps {
  statsCards: StatCard[];
}

const statIconClasses = "flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-500";

const ProfileAnglerStatsSection = ({ statsCards }: ProfileAnglerStatsSectionProps) => {
  return (
    <section className="relative -mt-8 space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md ring-1 ring-slate-100 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Angler stats</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:shadow-md hover:bg-white"
          >
            <div className="flex items-center gap-3">
              <div className={statIconClasses}>{card.icon}</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900 leading-tight">{card.value}</p>
              </div>
            </div>
            {card.hint ? <p className="mt-3 text-xs text-slate-500">{card.hint}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProfileAnglerStatsSection;
