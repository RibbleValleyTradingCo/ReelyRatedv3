import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Chrome } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import { signInSchema, signUpSchema, type SignInFormData, type SignUpFormData } from "@/schemas";
import { LoadingState } from "@/components/ui/LoadingState";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading, isAuthReady, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const resetParam = searchParams.get("reset_password") === "1";
  const [authView, setAuthView] = useState<"auth" | "forgot" | "reset">(resetParam ? "reset" : "auth");

  // Sign In Form
  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Sign Up Form
  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const resetRequestForm = useForm<{ email: string }>({
    defaultValues: { email: "" },
  });

  const resetPasswordForm = useForm<{ newPassword: string; confirmPassword: string }>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!loading && user && authView !== "reset") {
      navigate("/");
    }
  }, [user, loading, navigate, authView]);

  useEffect(() => {
    if (resetParam) {
      setAuthView("reset");
    }
  }, [resetParam]);

  const handleSignIn = async (data: SignInFormData) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      signInForm.reset();
      toast.success("Welcome back!");
      navigate("/");
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    // Check if email already exists using RPC function
    const { data: emailExists, error: emailCheckError } = await supabase
      .rpc('check_email_exists', {
        email_to_check: data.email.toLowerCase()
      });

    if (emailCheckError) {
      console.error('Error checking email:', emailCheckError);
      // Continue anyway - better to allow signup than block it
    } else if (emailExists) {
      toast.error('This email is already registered. Please sign in instead.');
      return;
    }

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', data.username.toLowerCase())
      .maybeSingle();

    if (existingUsername) {
      toast.error('This username is already taken. Please choose another.');
      return;
    }

    // Proceed with signup
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${import.meta.env.VITE_APP_URL || window.location.origin}/auth`,
        data: {
          username: data.username,
        },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Check your email to verify!");
    }
  };

  const handleResetRequest = async (data: { email: string }) => {
    const email = data.email.trim();
    if (!email) {
      toast.error("Please enter an email address.");
      return;
    }
    try {
      const redirectTo = `${import.meta.env.VITE_APP_URL || window.location.origin}/auth?reset_password=1`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        throw error;
      }
      toast.success("Check your inbox for a link to reset your password.");
      resetRequestForm.reset();
      setAuthView("auth");
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Failed to send reset link", error);
      toast.success("Check your inbox for a link to reset your password."); // Generic to avoid email enumeration
    }
  };

  const handleResetPassword = async (data: { newPassword: string; confirmPassword: string }) => {
    if (!session) {
      toast.error("This link has expired or is invalid. Please request a new reset email.");
      return;
    }
    const trimmedNew = data.newPassword.trim();
    const trimmedConfirm = data.confirmPassword.trim();

    if (!trimmedNew || trimmedNew.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: trimmedNew });
      if (error) {
        throw error;
      }
      toast.success("Your password has been updated.");
      resetPasswordForm.reset();
      setAuthView("auth");
      navigate("/");
    } catch (error) {
      console.error("Failed to update password", error);
      toast.error("Unable to update your password right now.");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message ?? "Unable to sign in with Google.");
        setIsGoogleLoading(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in with Google.");
      setIsGoogleLoading(false);
    }
  };

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <LoadingState message="Loading your account…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <LogoMark className="h-16 w-16" />
          </div>
          <CardTitle className="text-3xl">ReelyRated</CardTitle>
          <CardDescription>Log your freshwater sessions and join the community</CardDescription>
        </CardHeader>
        <CardContent>
          {authView === "auth" && (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      {...signInForm.register("email")}
                      aria-invalid={!!signInForm.formState.errors.email}
                    />
                    {signInForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {signInForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      {...signInForm.register("password")}
                      aria-invalid={!!signInForm.formState.errors.password}
                    />
                    {signInForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {signInForm.formState.errors.password.message}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-xs text-sky-600 hover:underline"
                        onClick={() => setAuthView("forgot")}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={signInForm.formState.isSubmitting}>
                    {signInForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                >
                  <Chrome className="h-4 w-4" />
                  {isGoogleLoading ? "Opening Google…" : "Continue with Google"}
                </Button>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      {...signUpForm.register("username")}
                      aria-invalid={!!signUpForm.formState.errors.username}
                    />
                    {signUpForm.formState.errors.username && (
                      <p className="text-sm text-destructive">
                        {signUpForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      {...signUpForm.register("email")}
                      aria-invalid={!!signUpForm.formState.errors.email}
                    />
                    {signUpForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {signUpForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      {...signUpForm.register("password")}
                      aria-invalid={!!signUpForm.formState.errors.password}
                    />
                    {signUpForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {signUpForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                    {signUpForm.formState.isSubmitting ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleGoogleSignIn}
                >
                  <Chrome className="h-4 w-4" />
                  Continue with Google
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {authView === "forgot" && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <CardTitle className="text-2xl">Forgot password?</CardTitle>
                <CardDescription>We&apos;ll email you a link to choose a new password.</CardDescription>
              </div>
              <form onSubmit={resetRequestForm.handleSubmit(handleResetRequest)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    {...resetRequestForm.register("email")}
                    aria-invalid={!!resetRequestForm.formState.errors.email}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetRequestForm.formState.isSubmitting}>
                  {resetRequestForm.formState.isSubmitting ? "Sending link…" : "Send reset link"}
                </Button>
              </form>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setAuthView("auth")}>
                Back to sign in
              </Button>
            </div>
          )}

          {authView === "reset" && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <CardTitle className="text-2xl">Choose a new password</CardTitle>
                <CardDescription>Set a new password to secure your account.</CardDescription>
              </div>
              {!session && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This link has expired or is invalid. Please request a new password reset email.
                </div>
              )}
              <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    {...resetPasswordForm.register("newPassword")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm new password</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    {...resetPasswordForm.register("confirmPassword")}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetPasswordForm.formState.isSubmitting || !session}>
                  {resetPasswordForm.formState.isSubmitting ? "Updating…" : "Update password"}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setAuthView("auth");
                  navigate("/auth", { replace: true });
                }}
              >
                Back to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
