import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dispatch, SetStateAction } from "react";
import { Loader2 } from "lucide-react";

interface ProfileSettingsDeleteAccountCardProps {
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: Dispatch<SetStateAction<boolean>>;
  deleteReason: string;
  setDeleteReason: Dispatch<SetStateAction<string>>;
  isDeletingAccount: boolean;
  onDeleteAccount: () => void;
}

const ProfileSettingsDeleteAccountCard = ({
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  deleteReason,
  setDeleteReason,
  isDeletingAccount,
  onDeleteAccount,
}: ProfileSettingsDeleteAccountCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Delete your account</CardTitle>
        <p className="text-sm text-slate-600">
          This will log you out and begin the deletion process. Your profile will be anonymised and your catches/comments
          hidden from normal surfaces, while moderation history may be retained for safety. This can’t be undone from the UI.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
        <p className="text-sm text-slate-600 md:max-w-lg">
          You can optionally share why you&apos;re leaving before confirming. Deletion is permanent for this account.
        </p>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="h-11 min-w-[200px]">
              Request account deletion
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will log you out, anonymise your profile, and hide your catches/comments. Some data is retained for
                moderation and safety. This cannot be undone from the UI.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="deleteReason">Reason for leaving (optional)</Label>
              <Textarea
                id="deleteReason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Let us know why you’re leaving..."
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteAccount}
                disabled={isDeletingAccount}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete my account"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsDeleteAccountCard;
