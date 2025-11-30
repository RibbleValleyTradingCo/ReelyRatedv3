import { Button } from "@/components/ui/button";

interface ProfileAboutStaffCardProps {
  onViewFeed?: () => void;
}

const ProfileAboutStaffCard = ({ onViewFeed }: ProfileAboutStaffCardProps) => {
  return (
    <section className="relative -mt-8 space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md ring-1 ring-slate-100 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">About ReelyRated staff</h2>
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white/85 p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          This is an official ReelyRated staff account. It&apos;s used for moderation, safety, and product updates.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Use the report options on catches or comments to flag issues you notice.</li>
          <li>Staff may post announcements here, but catches and follower stats aren&apos;t shown.</li>
          <li>For more help, visit your Settings to find support options.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full px-4 text-sm" onClick={onViewFeed}>
            Back to feed
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community-first moderation</span>
        </div>
      </div>
    </section>
  );
};

export default ProfileAboutStaffCard;
