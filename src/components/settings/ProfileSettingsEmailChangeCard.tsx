import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormReturn } from "react-hook-form";

interface ProfileSettingsEmailChangeCardProps {
  initialEmail: string;
  emailForm: UseFormReturn<{ newEmail: string; confirmEmail: string }>;
  onSubmit: (values: { newEmail: string; confirmEmail: string }) => void;
}

const ProfileSettingsEmailChangeCard = ({
  initialEmail,
  emailForm,
  onSubmit,
}: ProfileSettingsEmailChangeCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Change email</CardTitle>
        <p className="text-sm text-slate-600">
          Current email: <span className="font-medium">{initialEmail || "Not set"}</span>. Updates require a
          verification link.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
        <form className="space-y-4" onSubmit={emailForm.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="newEmail">New email address</Label>
            <Input
              id="newEmail"
              type="email"
              placeholder="angler+new@example.com"
              {...emailForm.register("newEmail")}
              aria-invalid={!!emailForm.formState.errors?.newEmail}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Confirm new email</Label>
            <Input
              id="confirmEmail"
              type="email"
              placeholder="Repeat the new email"
              {...emailForm.register("confirmEmail")}
              aria-invalid={!!emailForm.formState.errors?.confirmEmail}
            />
          </div>
          <Button type="submit" disabled={emailForm.formState.isSubmitting}>
            {emailForm.formState.isSubmitting ? "Sending confirmation…" : "Send verification email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsEmailChangeCard;
