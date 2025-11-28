# Phase X – Admin & Moderation Completion Checklist

Purpose: this checklist defines what must be true before we consider the **admin + moderation phase** complete and ready for launch.

---

## 1. Moderation enforcement (backend behaviour)

  - [ ] `assert_moderation_allowed` is called for **all** comment creation paths
    - [ ] `create_comment_with_rate_limit` is the only way comments are created and it calls `assert_moderation_allowed` (admin bypass)
- [ ] `assert_moderation_allowed` is applied to **catch creation**
  - [ ] BEFORE INSERT trigger on `catches` calls `assert_moderation_allowed`
- [ ] Behaviour by status:
  - [ ] `active` / `normal` / `null` → comments & catches allowed
  - [ ] `warned` → comments & catches allowed (no blocking, just visible in admin UI)
  - [ ] `suspended` (future `suspension_until`) → comments & catches blocked
  - [ ] `suspended` (past `suspension_until`) → behaviour same as `active`
  - [ ] `banned` → comments & catches blocked
  - [ ] Admin users bypass moderation enforcement, regardless of status
- [ ] When blocked, backend raises **stable, known error patterns** that our frontend can map consistently (suspended vs banned)

---

## 2. Frontend behaviour – enforcement & error messages

- [ ] Comment creation (CatchComments):
  - [ ] Suspended user sees a clear toast:  
         “You’re currently suspended until \<date/time\> and can’t post comments right now.”
  - [ ] Banned user sees a clear toast:  
         “Your account is banned and you can’t post comments.”
  - [ ] No raw Postgres / Supabase error text is shown to the user
- [ ] Catch creation (AddCatch):
  - [ ] Suspended user sees a clear toast:  
         “You’re currently suspended until \<date/time\> and can’t post new catches right now.”
  - [ ] Banned user sees a clear toast:  
         “Your account is banned and you can’t post new catches.”
  - [ ] No raw Postgres / Supabase error text is shown to the user
- [ ] If both moderation & rate-limit conditions could apply, **moderation** messaging wins (no confusing double messages)

---

## 3. Admin User Moderation page

- [ ] Summary card:
  - [ ] Shows avatar, username (or sensible fallback), and user id
  - [ ] Status badge shows one of: **Active / Warned / Suspended until … / Banned**
  - [ ] Warnings count matches `warn_count` / actual warnings
  - [ ] Links work:
    - [ ] “View profile” → `/profile/:username-or-id`
    - [ ] “View reports about this user” → `/admin/reports` with user filter applied
- [ ] Moderation actions:
  - [ ] **Warn user**:
    - [ ] Requires a reason; creates `user_warnings` entry
    - [ ] Shows up in Warnings table & Moderation history
    - [ ] Status/warning count updated correctly
  - [ ] **Temporary suspension**:
    - [ ] Requires reason + duration (hours)
    - [ ] Sets `moderation_status = 'suspended'` and `suspension_until` in the future
    - [ ] User is blocked from comments & catches (verified as that user)
  - [ ] **Ban user**:
    - [ ] Requires reason
    - [ ] Sets `moderation_status = 'banned'` and clears `suspension_until`
    - [ ] User is blocked from comments & catches
  - [ ] **Lift restrictions**:
    - [ ] Requires reason
    - [ ] Sets `moderation_status = 'active'`, clears `suspension_until`
    - [ ] Creates a `clear_moderation` log entry
    - [ ] User can post again
- [ ] Warnings table:
  - [ ] Newest first, shows severity (nicely formatted), reason, duration, admin
  - [ ] Truncated reasons show full text on hover (tooltip)
  - [ ] Admin names link to admin’s moderation page when admin id exists
- [ ] Moderation history table:
  - [ ] Newest first
  - [ ] Shows action badge, target label (user/catch/comment) with ids, reason, admin
  - [ ] Handles missing admin/targets with safe fallbacks
- [ ] Large history/warnings:
  - [ ] Results are capped at the 20 newest warnings and 20 newest moderation actions, with a hint shown when the cap is reached

---

## 4. Admin Reports & Audit Log

### Reports (/admin/reports)

- [ ] Filters:
  - [ ] Type filter: **All / Catch / Comment / Profile** works
  - [ ] Status filter: **All / Open / Resolved / Dismissed**, default = Open
  - [ ] Sort: **Newest / Oldest** works correctly
- [ ] User filter:
  - [ ] AdminUserModeration “View reports about this user” sets a user filter
  - [ ] Filter pill shows: `Reports about @username` (never shows raw UUID; uses a neutral “this user” label until username is known)
  - [ ] Empty state with user filter reads:  
         `No reports about @username match these filters.`
  - [ ] “Clear” on the pill removes the user filter but preserves other filters where possible
  - [ ] Any transient UUID flicker is minimal; final pill shows username when available
- [ ] Pagination:
  - [ ] Page size = 20; Previous/Next work as expected
  - [ ] No duplicates or gaps when paging
- [ ] Report drawer:
  - [ ] “Moderation actions” opens with:
    - Target user context (if any)
    - Prior warnings
    - Moderation status
  - [ ] Actions (warn, delete/restore content, status updates) work and update UI

### Audit Log (/admin/audit-log)

- [ ] Date range presets: **24h / 7d (default) / 30d / All** work
- [ ] Action filter and search work and interact correctly with date range
- [ ] Pagination at 100 rows per page; Previous/Next work
- [ ] CSV export respects current filters/date range
- [ ] “Moderation” button on user rows routes to the correct user moderation page
- [ ] Empty states are clear and friendly

---

## 5. Notifications & user-facing account status

- [ ] `admin_warning` notifications:
  - [ ] Friendly copy: no raw enum values like `temporary_suspension` / `permanent_ban`
  - [ ] Extra data (severity, reason, duration, suspension_until, new_status) is used to render clear text
  - [ ] Click behaviour is defined and intentional (routes to profile notifications with account status card)
- [ ] `admin_moderation` notifications:
  - [ ] Used for “restrictions lifted” and other admin actions
  - [ ] Friendly, reassuring copy (no raw enums)
  - [ ] Click behaviour is clear (routes to profile notifications with account status card)
- [ ] Account status card (notifications page):
  - [ ] Appears when user is **Warned / Suspended / Banned** (and for warned users even if moderation_status is otherwise active)
  - [ ] Shows:
    - [ ] Current status (friendly labels)
    - [ ] Warnings count
    - [ ] Suspension until (if suspended)
  - [ ] Disappears when status returns to Active or shows a minimal “All good” message

---

## 6. Access control & security

- [ ] Non-admin users:
  - [ ] Cannot access `/admin/reports`, `/admin/audit-log`, `/admin/users/:id/moderation` (gated by `useAdminAuth`)
  - [ ] Do not see admin nav links or moderation buttons in UI
  - [ ] Cannot call `admin_*` RPCs (verified by trying and seeing expected errors)
- [ ] Admin users:
  - [ ] Can access all admin routes without errors
  - [ ] Admin-only features (warnings, suspensions, bans, report actions) all function end-to-end
- [ ] Notification creation:
  - [ ] `create_notification` rules still allow `admin_report` to admins from non-admins
  - [ ] Other admin notification types cannot be spoofed by non-admins

---

## 7. Documentation & final QA

- [ ] `docs/ADMIN-OVERVIEW.md` describes how the admin area is wired (routes, data flows, RPCs) and current caps/notification routing
- [ ] `docs/Moderation-Enforcement-Tests.md` has been run end-to-end and updated with any findings
- [ ] `docs/Moderation-Notifications-Tests.md` has been run end-to-end and updated with any findings
- [ ] (Optional) A short “Admin Quick Start” / “How to handle a report” doc exists:
  - [ ] How to triage a report from `/admin/reports`
  - [ ] How to warn/suspend/ban a user from the moderation page
  - [ ] How to lift restrictions and confirm everything is back to normal
- [ ] Docs kept in sync with current implementation as of this update

---

### Phase X Sign-off

- [ ] All boxes above are checked or explicitly deferred to a later phase (and noted).
- [ ] A final manual smoke test has been performed as:
  - [ ] Admin user (end-to-end moderation workflows)
  - [ ] Normal user (warnings/suspensions/bans experience)

Once everything here is ticked, the **admin + moderation phase** is considered complete and ready for pre-launch polishing only.

<!-- Aligned with current implementation as of this update. -->
