# Profile Settings Refactor Plan

Blueprint for modularising `src/pages/ProfileSettings.tsx` without changing behaviour.

## 1. Goals
- Reduce complexity in `ProfileSettings.tsx` (too many concerns in one file).
- Make settings easier to evolve (privacy/safety additions) with lower regression risk.
- Keep all existing behaviour intact in Phase 1 (pure refactor).
- Avoid duplicating Supabase/auth logic across multiple files; keep logic in the container.

## 2. Current state (snapshot)
`ProfileSettings.tsx` currently owns:
- Auth gating + redirect to `/auth` when unauthenticated.
- `useForm` instances:
  - Profile (username, full name, bio).
  - Password change.
  - Email change.
- Supabase calls:
  - Load profile + auth email.
  - Update profile row.
  - Update password.
  - Update email.
  - Data export (`request_account_export`).
  - Account deletion (`request_account_deletion`).
  - Profile privacy (`is_private`).
  - Load blocked profiles (`profile_blocks` join).
  - Unblock (`unblock_profile`).
  - Sign-out via `useAuth()`.
- UI sections/cards:
  - Avatar card.
  - Account card (username/full name/bio/email display).
  - Change email card.
  - Security/password card.
  - Data export card.
  - Account deletion card/dialog.
  - Profile privacy card.
  - Safety & blocking card (blocked anglers list).
  - Danger zone (sign out).

## 3. Target architecture
- Keep `src/pages/ProfileSettings.tsx` as the container:
  - Owns `useAuth`, `useNavigate`.
  - Owns all `useForm` instances + validation schemas.
  - Owns all Supabase RPC/call logic.
  - Owns cross-section state (e.g. `isPrivate`, `blockedProfiles`, `initialEmail`).
  - Owns toast calls.
  - Passes data/handlers to children as props.
- Add `src/components/settings/` with section components (presentational only):
  - `ProfileSettingsAvatarCard.tsx`
  - `ProfileSettingsAccountCard.tsx`
  - `ProfileSettingsEmailChangeCard.tsx`
  - `ProfileSettingsPasswordCard.tsx`
  - `ProfileSettingsDataExportCard.tsx`
  - `ProfileSettingsDeleteAccountCard.tsx`
  - `ProfileSettingsPrivacyCard.tsx`
  - `ProfileSettingsSafetyBlockingCard.tsx`
  - `ProfileSettingsDangerZoneCard.tsx`
- These components:
  - Do **not** call Supabase directly.
  - Receive props (e.g. forms, handlers, loading flags, lists).
  - Keep markup/wording/styling; logic stays in the container.

## 4. Phase 1 – Extraction refactor (no UX changes)
- Extract cards one by one into `src/components/settings/…` while:
  - Keeping hook order in `ProfileSettings.tsx` unchanged.
  - Keeping Supabase calls/side effects in the container.
  - Passing existing handlers/state as props.
  - Keeping markup/wording/styling as-is.
- Recommended extraction order:
  1) Avatar card
  2) Account card (username/full name/bio)
  3) Change email card
  4) Security/password card
  5) Data export card
  6) Delete account section (incl. `AlertDialog`)
  7) Privacy card
  8) Safety & blocking card
  9) Danger zone card
- Phase 1 constraints:
  - Route stays `/settings/profile`; no new routes.
  - No behavioural changes expected.
  - Acceptance: visual/behavioural parity with current page.

## 5. Phase 2 – Optional in-page mini menu (future)
- Add a small settings nav at top (anchors/scroll to sections):
  - Profile, Security, Data & privacy, Safety & blocking, Danger zone.
- No new routes; behaviour stays the same (discoverability only).
- Mobile: simple stacked pills or horizontal scroller.

## 6. Non-goals
- No changes to RLS, Supabase functions, or database schema.
- No changes to RPC names or auth flows.
- No copy/toast/error-message changes (beyond structural moves).
- No multi-route split (e.g. `/settings/security`) in this phase.

## 7. Risks and mitigations
- Risk: Accidental behaviour changes during refactor.  
  Mitigation: Extract one section at a time; keep all logic in container; run manual regression tests.
- Risk: Props explosion to children.  
  Mitigation: Pass grouped props where sensible (e.g. `profileForm`, `passwordForm`, handlers), but keep behaviour explicit.

## 8. Manual QA checklist
- Profile basics: update username/full name/bio; refresh; changes persist.
- Email change: submit different email; see success toast; receive email (if configured).
- Password change: invalid current password errors; valid change succeeds; can sign in with new password.
- Data export: download triggers; file structure unchanged.
- Account deletion: dialog opens; deletion request works; redirect to `/account-deleted`.
- Privacy toggle: switch works; catches visibility behaves as before (spot check from another account).
- Safety & blocking: blocked list loads; unblock works; list refreshes.
- Danger zone: sign-out works and redirects to `/auth`.
