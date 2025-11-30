import { Link } from "react-router-dom";

interface ProfileAdminModerationToolsProps {
  profileId: string | null;
}

const ProfileAdminModerationTools = ({ profileId }: ProfileAdminModerationToolsProps) => {
  return (
    <section className="relative -mt-8 space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md ring-1 ring-slate-100 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Moderation tools</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/reports"
          className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="text-sm font-semibold text-slate-900">Reports</span>
          <p className="text-sm text-slate-600">Review community reports and escalate actions quickly.</p>
        </Link>
        <Link
          to="/admin/audit-log"
          className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="text-sm font-semibold text-slate-900">Audit log</span>
          <p className="text-sm text-slate-600">Trace recent moderation actions and account changes.</p>
        </Link>
        {profileId ? (
          <Link
            to={`/admin/users/${profileId}/moderation`}
            className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="text-sm font-semibold text-slate-900">Profile moderation</span>
            <p className="text-sm text-slate-600">Manage reports, blocks, and safety actions for this account.</p>
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Your staff account is focused on safety and moderation. Use these tools to keep the community healthy.
      </p>
    </section>
  );
};

export default ProfileAdminModerationTools;
