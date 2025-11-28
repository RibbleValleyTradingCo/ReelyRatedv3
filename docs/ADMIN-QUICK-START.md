# Admin Quick Start – Moderation & Reports

This guide explains how to use the **admin tools** in ReelyRated (aligned with current implementation):

- How to get into the admin area
- How to triage reports
- How to warn/suspend/ban a user
- How to lift restrictions and confirm things are back to normal
- What users see when you take moderation actions

---

## 1. Accessing the admin area

You must be an admin (listed in `admin_users`) to see admin tools.

As an admin you will see:

- Navbar links:
  - **Reports** → `/admin/reports`
  - **Audit Log** → `/admin/audit-log`
- On profile pages:
  - An admin-only **Moderation** button that opens  
    `/admin/users/:userId/moderation`

You can also reach moderation pages via:

- **Reports drawer** → “View moderation history”
- **Audit Log** rows → “Moderation” button
- **Admin notifications** (warnings / moderation) → “View moderation”

If you don’t see these links, you’re not logged in as an admin.

---

## 2. Handling a report from `/admin/reports`

### 2.1. Understanding the reports view

Route: `/admin/reports`

Key parts:

- **Filters card**

  - Type: `All / Catch / Comment / Profile`
  - Status: `All / Open / Resolved / Dismissed` (default: **Open**)
  - Sort: `Newest first / Oldest first`
  - Optional pill:
    - `Reports about @username` (or “Reports about this user” until username is known; never shows raw UUID)
    - Click **Clear** to remove the user filter

- **Reports list**
  - Each card shows:
    - Target type (catch/comment/profile)
    - Status badge (Open / Resolved / Dismissed)
    - When it was reported
    - Reason text
    - Reporter (username or id)
  - Actions:
    - **View target** – opens the reported catch, comment, or profile
    - **Moderation actions** – opens the moderation drawer

### 2.2. Using the moderation drawer

Click **Moderation actions** on a report.

You’ll see:

- **Target user context**
  - Username/id
  - Current moderation status (`Active / Warned / Suspended / Banned`)
  - Suspension until (if suspended)
- **Warnings overview**
  - Prior warnings and severities
- **Buttons**
  - **Delete post / comment** (for content reports)
  - **Warn user**
  - **Dismiss / Resolve / Reopen** report
  - **Restore** (if content has been deleted)

Typical flows:

#### A) Clear false-positive or low-risk report

1. Review content via **View target**.
2. In the drawer, click **Dismiss**.
3. Report will move out of “Open”; no action taken on the user.

#### B) Confirmed issue – remove content only

1. Review content via **View target**.
2. In the drawer, click **Delete post** or **Delete comment**.
   - This calls the admin delete RPC, hides content, logs it, and notifies the owner.
3. Click **Resolve** to close the report.

If you later change your mind, you can use **Restore** in the drawer.

#### C) Confirmed behaviour issue – warn/suspend/ban

1. In the drawer, click **Warn user**.
2. Fill in:
   - Reason
   - Severity:
     - **Warning** – visible in their warnings but does not block posting.
     - **Temporary suspension** – blocks comments & catches for a period.
     - **Permanent ban** – blocks comments & catches indefinitely.
3. For temporary suspension, set duration in hours.
4. Submit.
   - A user warning is created.
   - The profile’s moderation status is updated.
   - The user receives a notification.
   - A moderation log entry is created.
5. Click **Resolve** on the report when you’re done.

---

## 3. Per-user moderation view

Route: `/admin/users/:userId/moderation`

This is the **source of truth** for a user’s moderation history.

### 3.1. Summary card

Top of the page shows:

- Avatar + username (or fallback) + user id
- Status badge:
  - **Active** – no current block
  - **Warned** – warnings but posting allowed
  - **Suspended until …** – temporarily blocked
  - **Banned** – fully blocked
- Warnings: `X / 3`
- Buttons:
  - **View profile** → their public profile
  - **View reports about this user** → `/admin/reports` filtered to them

Back/Refresh buttons:

- **Back** returns to the previous page (reports, audit log, profile, etc.)
- **Refresh** refetches their status, warnings, and history

### 3.2. Moderation actions

In the summary area you’ll see **Moderation actions**:

- **Warn user**
- **Temporary suspension**
- **Ban user**
- **Lift restrictions** (when suspended or banned)

All actions require a **reason**.

#### A) Warn user

Use when you want to record a warning but not block posting.

1. Click **Warn user**.
2. Enter a clear, user-readable reason.
3. Submit.

Effects:

- New row in **Warnings**.
- New `warn_user` entry in **Moderation history**.
- `warn_count` increases.
- Status badge may show **Warned**.
- User gets a friendly “You’ve received a warning” notification (routes to profile notifications with Account status card).

#### B) Temporary suspension

Use when behaviour is serious enough to block posting for a fixed period.

1. Click **Temporary suspension**.
2. Reason: explain what happened and what needs to change.
3. Duration (hours), e.g. `24` for 1 day.
4. Submit.

Effects:

- Status becomes **Suspended until …**.
- `suspension_until` set in the future.
- New warning row with **Temporary Suspension**.
- New `warn_user` moderation log entry.
- User gets a “temporarily suspended” notification (friendly copy) that routes to profile notifications with Account status card.
- While active:
  - Commenting → blocked with a clear toast.
  - Creating catches → blocked with a clear toast.

#### C) Ban user

Use for severe or repeated abuse.

1. Click **Ban user**.
2. Enter a clear reason (this goes into logs and notifications).
3. Submit.

Effects:

- Status becomes **Banned**.
- `suspension_until` cleared.
- New warning row with **Permanent Ban**.
- New `warn_user` moderation log entry.
- User gets a “Your account has been banned” notification (friendly copy) routed to profile notifications with Account status card.
- Comments & catches are permanently blocked (admins still bypass).

#### D) Lift restrictions

Use when a suspension period has ended early or you reverse a ban.

1. Click **Lift restrictions**.
2. Reason: e.g. “Suspension period complete” or “Ban reviewed and reversed.”
3. Submit.

Effects:

- Status becomes **Active** (warnings still visible).
- `suspension_until` cleared.
- `clear_moderation` entry in **Moderation history**.
- User gets a “restrictions lifted” notification (admin_moderation) routed to profile notifications.
- User can post again.

### 3.3. Reviewing history

- **Warnings**: newest first, shows severity, reason (truncated), duration, admin; capped at the 20 most recent with a hint when the cap is reached.
- **Moderation history**: newest first, shows action, target, reason (truncated), admin; capped at the 20 most recent with a hint when the cap is reached.
- Use **Audit Log** for a full, paginated view (100 per page, date filters).

---

## 4. Audit Log – reviewing past admin actions

Route: `/admin/audit-log`

Use this to **review what admins have done** over time.

### 4.1. Filters

- Date range presets:
  - **Last 24 hours**
  - **Last 7 days** (default)
  - **Last 30 days**
  - **All time**
- Action filter: filter by `warn_user`, `clear_moderation`, `delete_catch`, etc.
- Search: matches text across actions/metadata.

### 4.2. Working with rows

Each row shows:

- Timestamp
- Action type
- Target (user/catch/comment)
- Reason (if any)
- Admin who performed the action

Actions:

- **View target** (where relevant) – opens the catch/comment/profile.
- **Moderation** – opens the user’s moderation page.

Use cases:

- Double-check how a particular user was moderated.
- Investigate who deleted a catch or issued a ban.
- Export to CSV for external review.

---

## 5. What users see

### 5.1. Warnings

Users receive a notification like:

- “You’ve received a warning from an admin”
- Reason shown in the body
- Clicking it opens their profile notifications, where an **Account status** card shows:
  - Status: **Warned**
  - Warnings count

They can still post catches and comments.

### 5.2. Temporary suspension

Users see:

- Notification: “Your account has been temporarily suspended until {date/time}.”
- Account status card:
  - Status: **Suspended until …**
  - Clear explanation they cannot post until that time
- When they try to post:
  - Clear toast:
    - “You’re currently suspended until {date/time} and can’t post comments right now.”
    - Similar message for catches.

### 5.3. Ban

Users see:

- Notification: “Your account has been banned.”
- Account status card:
  - Status: **Banned**
  - Clear explanation they can’t post.
- When they try to post:
  - Clear toast:
    - “Your account is banned and you can’t post comments.”
    - Similar message for catches.

### 5.4. Lifted restrictions

Users see:

- Notification: “Your account restrictions have been lifted.”
- Account status card:
  - Returns to **Active** (or Active + Warned context).
- Posting works again as normal.

---

## 6. Recommended moderation workflow

When something is reported or spotted:

1. **Open `/admin/reports`** and find the relevant report.
2. **Review the content** via **View target**.
3. Use the **Moderation actions** drawer to:
   - Remove content (if necessary).
   - Record a warning or suspension/ban, with a clear reason.
4. **Resolve or dismiss** the report.
5. If needed, open the **User Moderation** page to review their full history.
6. Confirm that the user’s status and posting ability match your intention:
   - Test via a separate login if necessary.
7. If you change your mind later, go to **User Moderation → Lift restrictions**.

---

## 7. Quick sanity checks before using in production

Before using these tools with real users, double-check:

- As a **normal user**:
  - You see warnings/suspensions/bans clearly.
  - You understand why you were blocked and for how long.
- As an **admin**:
  - You can move smoothly between Reports → Moderation → Audit Log.
  - Actions you take appear immediately in:
    - Warnings table
    - Moderation history
    - Audit Log
    - Notifications

If any step feels confusing, update this doc (or add a short FAQ) so future admins know exactly what to do.

---

<!-- Aligned with current implementation as of this update. -->
