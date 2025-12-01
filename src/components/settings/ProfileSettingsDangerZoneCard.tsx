import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface ProfileSettingsDangerZoneCardProps {
  onSignOut: () => void;
}

const ProfileSettingsDangerZoneCard = ({ onSignOut }: ProfileSettingsDangerZoneCardProps) => {
  return (
    <Card className="rounded-xl border border-red-200 bg-red-50/70 shadow-none">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-base font-semibold text-red-600">Danger zone</CardTitle>
        <p className="text-sm text-red-600/80">Sign out safely to secure your account.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
        <p className="text-sm text-red-600/80 md:max-w-md">Leaving the session? Sign out to keep your catches and messages secure.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="destructive" className="h-11 min-w-[140px]" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsDangerZoneCard;
