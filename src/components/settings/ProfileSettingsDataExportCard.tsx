import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ProfileSettingsDataExportCardProps {
  isExporting: boolean;
  onDownload: () => void;
}

const ProfileSettingsDataExportCard = ({ isExporting, onDownload }: ProfileSettingsDataExportCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Your data & privacy</CardTitle>
        <p className="text-sm text-slate-600">
          You can download a technical JSON file containing your catches, comments, ratings, follows, and other account
          data. This is mainly for your own records, or to share with support if you ever need help with your account.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Note: this export is not a pretty report — it&apos;s a developer-style JSON file.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
        <p className="text-sm text-slate-600 md:max-w-lg">Use this export for your own records. Deletion/anonymisation will be added later.</p>
        <Button
          type="button"
          className="h-11 min-w-[200px] bg-slate-900 text-white hover:bg-slate-800"
          onClick={onDownload}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing export…
            </>
          ) : (
            "Download my data (JSON)"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsDataExportCard;
