import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { PasswordChangeFormData } from "@/schemas";

interface ProfileSettingsPasswordCardProps {
  passwordForm: UseFormReturn<PasswordChangeFormData>;
  onSubmit: (values: PasswordChangeFormData) => void;
}

const ProfileSettingsPasswordCard = ({ passwordForm, onSubmit }: ProfileSettingsPasswordCardProps) => {
  return (
    <form onSubmit={passwordForm.handleSubmit(onSubmit)} className="space-y-6">
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
          <CardTitle className="text-lg">Security</CardTitle>
          <p className="text-sm text-slate-600">Update your password to keep your account secure.</p>
        </CardHeader>
        <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
            Use at least 8 characters with a mix of letters, numbers, or symbols for your new password.
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register("currentPassword")}
                placeholder="••••••••"
                aria-invalid={!!passwordForm.formState.errors.currentPassword}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register("newPassword")}
                placeholder="••••••••"
                aria-invalid={!!passwordForm.formState.errors.newPassword}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register("confirmPassword")}
                placeholder="••••••••"
                aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="h-11 w-full bg-sky-600 text-white hover:bg-sky-700 md:w-auto"
            >
              {passwordForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default ProfileSettingsPasswordCard;
