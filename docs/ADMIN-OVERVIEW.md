# Admin Area Overview

This document describes how the admin area currently works: entry points, pages, data flow, and known gaps. It’s meant as a reference when making changes or adding new features.

---

## 1. Admin Entry Points

### 1.1 When does the UI show admin?

- **Admin detection:**  
  `isAdminUser(user.id)` (from `src/lib/admin.ts`) checks the `admin_users` table and caches the result.
- **Guard hook:**  
  `useAdminAuth` uses `isAdminUser` and:
  - Allows admins through.
  - Redirects/blocks non-admins.
  - Is used on all `/admin/*` routes.

### 1.2 How do admins get into the tools?

- **Navbar / Mobile menu**

  - Shows links to:
    - `/admin/reports` → **AdminReports**
    - `/admin/audit-log` → **AdminAuditLog**
  - Only visible when `isAdminUser` is true.

- **Notifications**

  - Admin-only notification types:
    - `admin_report`
    - `admin_warning`
    - `admin_moderation`
  - Rendered in `NotificationListItem`.
  - Main click uses `resolveNotificationPath` to go to the relevant catch/comment/profile or, for moderation-related user notifications, to the profile notifications view (`#notifications`) so the account status card is visible.
  - Admins see an extra “View moderation” link that goes to `/admin/users/:userId/moderation`.

- **Profile page**

  - On `Profile.tsx`, admins see a “Moderation” button.
  - This links to `/admin/users/:userId/moderation`.

- **Direct URLs** (all guarded by `useAdminAuth`)
  - `/admin/reports` → reports dashboard
  - `/admin/audit-log` → moderation log viewer
  - `/admin/users/:userId/moderation` → per-user moderation overview

---

## 2. Admin Pages

### 2.1 Admin Reports (`/admin/reports`)

**Component:** `src/pages/AdminReports.tsx`

**Purpose:**  
Primary **triage hub** for user reports.

**Data:**

- From `reports` table:
  - `id`, `target_type`, `target_id`
  - `reason`, `status`, `created_at`
  - Reporter info via `profiles` join
- Realtime subscription on `reports`.

**Filters & controls:**

- Filter by **type**: `all | catch | comment | profile`.
- Filter by **status**: `all | open | resolved | dismissed`.
- Sort by **newest/oldest**.
- Pagination via range (page size = 20).
- Optional user filter pill: shows `Reports about @username` when known, otherwise a neutral “Reports about this user” (never shows raw UUID).

**UI behaviour:**

- List of report “cards”.
- Clicking a card opens a **moderation drawer** with:
  - Target context (catch/comment/profile)
  - User moderation status snapshot (status, warnings)
  - Prior warnings for that user
  - Moderation history snippet
- From the drawer, admins can:
  - **Warn user** → calls `admin_warn_user`.
  - **Delete/restore catch** → `admin_delete_catch` / `admin_restore_catch`.
  - **Delete/restore comment** → `admin_delete_comment` / `admin_restore_comment`.
  - **Update report status**: open/resolved/dismissed.
  - **View target** (navigate to catch/comment/profile).
  - **View moderation history** → `/admin/users/:userId/moderation`.

---

### 2.2 Admin Audit Log (`/admin/audit-log`)

**Component:** `src/pages/AdminAuditLog.tsx`

**Purpose:**  
Read-only **moderation log** viewer.

**Data:**

- From `moderation_log`:
  - `action`, `user_id`, `catch_id`, `comment_id`
  - `target_type` / `target_id`
  - `metadata`, `created_at`
  - Admin info via join (`admin` / `admin_id`)

**Filters & controls:**

- **Date range presets:** 24h / 7 days (default) / 30 days / All.
- **Action filter:** by `action` (warn_user, delete_comment, etc.).
  - Includes clear_moderation (“Restrictions lifted”) and other logged actions.
- **Search:** free text over admin, reason, target.
- **Sort:** newest/oldest.
- **Pagination:** page size ~100.
- **CSV export:** exports the currently filtered + ranged data set.

**UI behaviour:**

- Table with rows:
  - Timestamp
  - Action badge
  - Target (user/catch/comment + id)
  - Reason (truncated with tooltip)
  - Admin (linked to admin’s moderation page if id exists)
- “Moderation” button on user-related rows:
  - Goes to `/admin/users/:userId/moderation`.

---

### 2.3 Admin User Moderation (`/admin/users/:userId/moderation`)

**Component:** `src/pages/AdminUserModeration.tsx`

**Purpose:**  
**Per-user source of truth** for moderation state.

**Data:**

- From `profiles`:
  - `username`, `avatar`, `warn_count`
  - `moderation_status` (`active | warned | suspended | banned`)
  - `suspension_until`
- From `user_warnings`:
  - `reason`, `severity`, `duration_hours`
  - `created_at`, `issued_by` (admin id/username)
- From `moderation_log`:
  - Entries where:
    - `user_id = :userId` **or**
    - `target_type = 'user'` and `target_id = :userId`
  - Includes admin details and, for user targets, a `target_profile` join.

**UI layout:**

- **Header & summary card:**

  - “Admin · Moderation for @username”
  - Badge showing current `moderation_status`:
    - Active
    - Warned
    - Suspended until …
    - Banned
  - Warnings count (`warn_count`, often shown like `X/3`).
  - Links:
    - View profile → `/profile/:username`.
    - View reports about this user → `/admin/reports` (likely with some filter or state applied).

- **Warnings table:**

  - Issued (relative time)
  - Severity (Warning / Temporary suspension / etc.)
  - Reason (truncated with tooltip)
  - Duration (hours or `—`)
  - Admin (link to `/admin/users/:adminId/moderation` when id present)

- **Moderation history table:**
  - Timestamp
  - Action badge (`warn_user`, `delete_comment`, `restore_catch`, etc.)
  - Target (user/catch/comment with id and username where possible)
  - Reason (truncated with tooltip)
  - Admin (link as above)

**Navigation/Back behaviour:**

- If reached from:
  - **Reports drawer** → Back returns to `/admin/reports`.
  - **Audit Log** → Back returns to `/admin/audit-log`.
  - **Profile** → Back returns to that profile.
  - **Else** → fallback to profile or feed.

---

## 3. Backend Wiring (Simplified)

### 3.1 Reports

- RPC: `create_report_with_rate_limit` (non-admin, rate-limited).
- Inserts into `reports` table.
- Frontend helper `notifyAdmins` calls `create_notification` for type `admin_report` to each admin.

### 3.2 Warnings & moderation actions

- RPC: `admin_warn_user`:

  - Admin-only.
  - Inserts into `user_warnings`.
  - Updates `profiles.warn_count`, `moderation_status`, `suspension_until`.
  - Inserts `moderation_log` entry.
- Sends `admin_warning` notification to the user.
  - Notification extra_data includes severity, reason, duration, suspension_until, new_status for friendly rendering.

- RPCs: `admin_delete_catch`, `admin_delete_comment`, `admin_restore_catch`, `admin_restore_comment`:
  - Admin-only.
  - Soft-delete/restore content.
  - Insert `moderation_log` entries.
  - Send `admin_moderation` notifications to owners.
  - `admin_clear_moderation_status` logs `clear_moderation` and sends an `admin_moderation` notification with “restrictions lifted” copy.

### 3.3 Notifications

- Types used in admin flows:
  - `admin_report`
  - `admin_warning`
  - `admin_moderation`
- Creation: via `create_notification` (SECURITY DEFINER).
  - `admin_report` is allowed for non-admin callers only when the target recipient is an admin.
  - Other admin types remain admin-only.
- Frontend routing:
  - `resolveNotificationPath` handles “where to navigate on click”.
  - Admins get additional “View moderation” entry points to `/admin/users/:userId/moderation`.

---

## 4. Known Gaps / Future Work

- **Enforcement** of `moderation_status` and `suspension_until` is not yet implemented:
  - Users marked suspended/banned can still post comments/catches. **(Outdated: enforcement now applied via `assert_moderation_allowed` on comments and a catch insert trigger.)**
- **Scaling concerns:**
  - Warnings and history are capped at 20 newest rows (no pagination yet); long histories may need better paging/filters in later phases.
  - Reports and audit logs can grow large; current pagination is basic but works.
- **Consistency:**
  - The same moderation info appears in multiple places (Reports drawer, Moderation page, Audit Log).
  - We should treat **Admin User Moderation** as the canonical per-user view and keep others as “summaries”.

This document should be kept in sync whenever we change admin flows, routes, or moderation behaviour.

<!-- Aligned with current implementation as of this update. -->
- **Limits:** Warnings and moderation history are capped at the 20 newest rows; a hint appears when the cap is reached.
