# Password Reset – Test Plan (Out-of-session)

This doc covers the two-step password reset flow (request link → set new password) and its interaction with the existing in-session password change in Profile Settings.

## Happy path
- Request reset link with a valid email from **Auth → Forgot password**.
- Email is received with reset link.
- Clicking the link opens `/auth?reset_password=1` with a valid Supabase session.
- New password + confirm match, submit → `supabase.auth.updateUser` succeeds.
- User is signed in and can access the app; sign-in with the new password works.

## Error paths
- Unknown email: submitting still shows the generic “Check your inbox…” success message; no info leak.
- Mismatched new/confirm password: inline/toast error; submit blocked until they match.
- Expired/invalid link (no session): `/auth?reset_password=1` shows the “link expired or invalid” message and offers a CTA back to sign-in; no crash.

## Regression checks
- In-session password change in **Settings → Profile → Security** still works (current password required; success toast; sign-in works with new password).
- Other auth flows (sign-in, sign-up, Google OAuth) are unaffected.

## Layout checks
- Mobile vs desktop: forgot-password and reset forms render correctly, buttons are tappable, and back-to-sign-in CTA is visible.

