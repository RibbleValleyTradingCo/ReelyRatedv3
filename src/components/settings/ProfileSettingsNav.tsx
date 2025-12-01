import { Button } from "@/components/ui/button";

type SectionId = "profile" | "security" | "data-privacy" | "safety-blocking" | "danger-zone";

interface NavSection {
  id: SectionId;
  label: string;
  active: boolean;
}

interface ProfileSettingsNavProps {
  sections: NavSection[];
  onSelect: (id: SectionId) => void;
}

const ProfileSettingsNav = ({ sections, onSelect }: ProfileSettingsNavProps) => {
  return (
    <nav className="w-full">
      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:justify-center">
        {sections.map((section) => (
          <Button
            key={section.id}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSelect(section.id)}
            className={`rounded-full border px-4 py-2 text-sm shadow-none transition ${
              section.active
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-900"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {section.label}
          </Button>
        ))}
      </div>
    </nav>
  );
};

export type { SectionId, NavSection };
export default ProfileSettingsNav;
