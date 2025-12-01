import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { ProfileFormData } from "@/schemas";

const PROFILE_STATUS_PLACEHOLDER = "Nothing here yet. Tell people what you fish for.";

interface ProfileSettingsAccountCardProps {
  profileForm: UseFormReturn<ProfileFormData>;
}

const ProfileSettingsAccountCard = ({ profileForm }: ProfileSettingsAccountCardProps) => {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
        <CardTitle className="text-lg">Account</CardTitle>
        <p className="text-sm text-slate-600">Keep your public profile and contact details up to date.</p>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div>
              <Label htmlFor="username">Username</Label>
              <p className="text-xs text-slate-500">Unique handle anglers will see on your posts.</p>
            </div>
            <Input
              id="username"
              {...profileForm.register("username")}
              placeholder="angling_legend"
              aria-invalid={!!profileForm.formState.errors.username}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
            />
            {profileForm.formState.errors.username && (
              <p className="text-sm text-red-600">{profileForm.formState.errors.username.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <p className="text-xs text-slate-500">Optional. Share your real name with the community.</p>
            </div>
            <Input
              id="fullName"
              {...profileForm.register("fullName")}
              placeholder="Alex Rivers"
              aria-invalid={!!profileForm.formState.errors.fullName}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
            />
            {profileForm.formState.errors.fullName && (
              <p className="text-sm text-red-600">{profileForm.formState.errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <p className="text-xs text-slate-500">We&apos;ll send a verification link if you change this.</p>
            </div>
            <Input
              id="email"
              type="email"
              {...profileForm.register("email")}
              placeholder="angler@example.com"
              aria-invalid={!!profileForm.formState.errors.email}
              readOnly
              disabled
              className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 text-slate-500"
            />
            {profileForm.formState.errors.email && (
              <p className="text-sm text-red-600">{profileForm.formState.errors.email.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <Label htmlFor="bio">Bio / status</Label>
            <p className="text-xs text-slate-500">Tell anglers what you fish for or share a quick update.</p>
          </div>
          <Textarea
            id="bio"
            {...profileForm.register("bio")}
            placeholder={PROFILE_STATUS_PLACEHOLDER}
            rows={4}
            aria-invalid={!!profileForm.formState.errors.bio}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
          />
          {profileForm.formState.errors.bio && (
            <p className="text-sm text-red-600">{profileForm.formState.errors.bio.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsAccountCard;
