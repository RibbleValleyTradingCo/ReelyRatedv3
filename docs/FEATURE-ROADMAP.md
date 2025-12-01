# ReelyRated Feature Roadmap

This document outlines a proposed roadmap for shipping the remaining features identified in `docs/FEATURE-LIST.md` and Codex’s analysis. It assumes the existing stack (Supabase/Postgres + React/TypeScript) and our current patterns (RPCs, RLS, admin\_\* functions, doc-first development, and Codex-assisted implementation).

The roadmap is broken into phases. Each phase is designed to be independently shippable and to minimise risk by keeping business logic and presentation concerns separate.

---

## Phase 2 – Privacy, Safety & Account Lifecycle

Phase 2.1 (account deletion/export) can ship independently. Phase 2.2 (profile privacy) and 2.3 (block/mute) must land and be enforced before Phase 3 (search/browse) to avoid leaking private or blocked content into discovery surfaces.

### 2.1 Full Account Deletion (building on current groundwork)

**Status:** Backend + frontend implemented (schema via `2049_account_deletion_schema_prep.sql`, `request_account_deletion` RPC, Settings UI + dialog, `/account-deleted` page, JSON export). Edge cases/QA are tracked in `docs/ACCOUNT-DELETION-TESTS.md`.

**Goal:** Implement user-initiated account deletion as soft-delete + anonymisation, preserving audit and moderation history and avoiding broken foreign keys.

**Backend (Supabase / SQL)**

- Implement RPC: `request_account_deletion(p_reason text)`

  - Uses `auth.uid()`; no external `p_user_id` param.
  - Steps:
    - Validate user is authenticated.
    - Set on `profiles`:
      - `is_deleted = TRUE`
      - `deleted_at = now()`
      - `locked_for_deletion = TRUE`
      - Anonymise PII: username → `deleted-user-<shortid>`, clear bio, avatar fields, etc.
      - Optionally set `moderation_status` to a terminal state such as `'deleted'` (or similar).
    - For `catches` where `user_id = v_user_id`:
      - Set `visibility = 'private'`
      - Set `deleted_at = now()` if not already set.
    - For `catch_comments` where `user_id = v_user_id`:
      - Set `deleted_at = now()`
      - Tombstone body: `body = '[deleted]'`.
    - For `catch_reactions` and `ratings` where `user_id = v_user_id`:
      - Prefer `DELETE` these rows (reduce retained personal signal).
    - For `profile_follows`:
      - `DELETE` where `follower_id = v_user_id OR following_id = v_user_id`.
    - For `notifications`:
      - `DELETE` where `user_id = v_user_id`.
    - Do **not** delete:
      - `reports`
      - `user_warnings`
      - `moderation_log`
    - Return a simple JSON summary of what was affected (counts per table).

- Optional admin RPC: `admin_delete_account(p_target uuid, p_reason text)`

  - SECURITY DEFINER, admin-only.
  - Wraps the same logic but allows an admin to trigger deletion for another account (with extra logging).

- RLS and policy adjustments:
  - Update `profiles` policies to:
    - Exclude `is_deleted = TRUE` profiles from search/feed discovery.
  - Update `catches` and `catch_comments` policies to:
    - Exclude rows that are soft-deleted (via `deleted_at`) from public and normal user surfaces.
  - Ensure posting is blocked for deleted or `locked_for_deletion` accounts by:
    - Adding checks in relevant policies and RPCs (e.g. `create_comment_with_rate_limit`, catch insert paths).

**Frontend (React / TSX)**

- Settings – “Your data & privacy” section:

  - Add “Request account deletion” button.
    - Opens a dialog:
      - Short explanation.
      - Optional “Reason for leaving” textarea.
    - On confirm:
      - Call `supabase.rpc('request_account_deletion', { p_reason })`.
      - On success:
        - Sign out the user.
        - Redirect to a simple “Account deleted” confirmation page.

- Profile page (viewing deleted account):

  - If `is_deleted` is true for the profile:
    - Show a stub: “This account has been deleted.”
    - Hide follow buttons and CTAs (Add catch, View moderation, etc.).
    - “Angler stats” and catches sections should either:
      - Show a muted “No data – this account has been deleted.”
      - Or be hidden entirely, depending on design choice.

- Feed / catch detail / comments:
  - If catch author has `is_deleted = TRUE`:
    - Show “Deleted user” for display name and a generic avatar.
  - For tombstoned comments (`body = '[deleted]'`):
    - Render in a muted style, non-interactive, with something like “[deleted]”.

**Docs & QA**

- See `ACCOUNT-DELETION-TESTS.md` for scenarios and edge cases (kept up to date with the implementation).

---

### 2.2 Profile Privacy (Public vs Private Profiles)

**Status:** Implemented: `is_private` schema, Settings toggle, private-profile stub, and RLS enforcement for catches/comments/feed/search and venue pages. Future work: ensure all new browse/leaderboard/advanced-search endpoints reuse the same checks.

**Goal:** Allow users to mark their profile as private so only followers (and admins) can see their catches and details.

Note: Schema + settings toggle + profile stub are implemented (is_private on profiles; settings toggle; non-followers see a “private account” stub). RLS enforcement on catches/comments is now in place; feed/search reuse these rules. Future work: ensure browse/leaderboard/advanced search reuse the same checks; block/mute integration is later.

**Backend**

- Extend `profiles`:

  - Add `is_private boolean NOT NULL DEFAULT FALSE`.

- RLS / policy behaviour:
  - For `profiles`:
    - When `is_private = TRUE`, profile fields may still be visible in limited ways (e.g. search), but detailed data and catches should be restricted.
  - For `catches`:
    - When `is_private = TRUE` on the owning profile:
      - Only:
        - The owner
        - Their followers
        - Admins
      - can see those catches.
  - For any search/explore RPCs:
    - Filter out catches of private accounts for non-followers.
  - Audit existing feed/search/list RPCs and update to enforce `is_private` and follower/admin rules (not just new endpoints). Initial pass is complete for feed/search and venue-related RPCs; any new discovery endpoints must follow the same pattern.

**Frontend**

- Profile settings:

  - Add a “Private account” toggle.
  - Helper copy like “Only people who follow you can see your catches. Your profile may still appear in search.”

- Profile page (viewed by others):

  - If profile is private and viewer is not the owner or a follower:
    - Show “This account is private. Follow to see their catches.”
    - Hide catches grid and other sensitive details as needed.

- Feed & search:
  - Ensure private catches never appear for non-followers.
  - Decide how private profiles appear in search (e.g. as discoverable accounts but without catch previews).

**Docs & QA**

- New doc: `PROFILE-PRIVACY-TESTS.md`
  - Owner vs follower vs non-follower behaviour:
    - Profile page
    - Feed
    - Search
    - Catch detail
  - Admin access to private accounts.

---

### 2.3 Block / Mute Users

**Goal:** Give anglers tools to control their experience (hide content from specific users) without needing admin intervention.

Status:
- Backend block enforcement (RPCs, RLS on catches/comments, comment creation guard, blocked-viewer stub) implemented.
- Profile hero supports Block / Unblock actions and a blocked banner; follow is disabled when blocked.
- Admin profiles have dedicated UX (Admin badge, no Follow/Block CTAs).
- Next: blocked-anglers list in Settings and any comment-level mute UI.

Note: Schema groundwork (`profile_blocks` via migration 2053_profile_blocks_schema.sql) is implemented. Backend block RPCs and RLS enforcement on catches/comments are now in place.

**Backend**

- New tables:

  - `profile_blocks`:
    - `blocker_id uuid`, `blocked_id uuid`, timestamps.
  - (Optional later) `profile_mutes`:
    - Similar structure but for softer mute behaviour.

- RLS:
  - Rows only visible to `blocker_id` (and admins).
  - Enforce in queries/RPCs:
    - Feed/search/venue should exclude content authored by users the viewer has blocked (now enforced in catches RLS).
    - Comments from blocked users hidden via RLS.
    - Comment read/write paths use `is_blocked_either_way`, so blockers don’t see comments from blocked users and cannot comment on their catches (admins bypass).
    - Disallow follow relationships where a block exists in either direction (follow links cleaned on block).

**Frontend**

- Profile page:

  - Overflow menu or secondary button:
    - “Block user” / “Unblock user”.
    - Confirmation dialog explaining effects.
  - 2.3a – Profile block UI (in progress):
    - Hero-level Block/Unblock controls using existing RPCs (`block_profile`, `unblock_profile`).
    - Follow disabled while blocked; banner when blocked.
    - Comment-level mute UI is deferred to a later 2.3b.
  - 2.3b – Blocked anglers list (up next):
    - Add a subtle “Safety & blocking” section to **Settings → Profile**:
      - Shows a list of anglers the current user has blocked (via `profile_blocks`).
      - Each entry: avatar, username, short bio, Unblock button.
      - Uses existing `block_profile` / `unblock_profile` RPCs; no new backend logic.
    - Keep this list Settings-only, mirroring modern social apps.
  - 2.3c – Admin profile UX polish:
    - Admin profiles display an Admin badge and short staff explainer.
    - Follow/Block CTAs are suppressed for admin profiles.
    - Admins may be excluded from competitive leaderboards/venue top-anglers strips where appropriate.

- Comments:

  - Context menu or inline action to block an author directly from a comment (shortcut to the same block mechanism).

- Visual cues:
  - When viewing a blocked user’s profile, show “You have blocked this angler.” with an Unblock button.
  - Content from blocked users should either disappear or show a placeholder (depending on chosen UX).

**Docs & QA**

- `BLOCK-MUTE-TESTS.md`:
  - Test with two accounts (A blocking B):
    - Feed (no content from B for A).
    - Comments (B’s comments hidden/collapsed for A).
    - Follow behaviour (cannot follow if blocked).
    - Notifications (future: reduce noise from blocked users).

---

### 2.4 Password reset UX (auth completeness)

Status: Implemented (two-step reset: request link + reset form on /auth?reset_password=1; see PASSWORD-RESET-TESTS.md).

**Goal:** Complete the auth story with basic email/password reset flow.

- Backend/Frontend:
  - Add request + reset screens and hook into Supabase password reset flow.
  - Keep scope minimal (email link → reset form).

**Docs & QA**

- See `docs/PASSWORD-RESET-TESTS.md` for request/reset scenarios, invalid-link handling, and regression checks against the in-session password change.

---

## Phase 3 – Search, Browse & Discovery

Prerequisites: Phase 2.2 (profile privacy) and 2.3 (block/mute) must be in place and enforced via RLS/RPCs before any new discovery endpoints go live.

### 3.1 Advanced Search

**Goal:** Make catch search feel like a proper tool for finding patterns and reference catches.

**Backend**

- New RPC: `search_catches_advanced(...)`

  - Parameters (initial version):
    - `q` (text search)
    - `species`
    - `min_weight`, `max_weight`
    - `from_date`, `to_date`
    - `water_type` / venue filters as available in schema.
  - Must respect:
    - Visibility rules (public/followers/private), profile privacy (`is_private`), block lists (`profile_blocks`), and reuse the same ruleset as the feed (not a separate logic path).
  - Do not ship `search_catches_advanced` until Phase 2.2 and 2.3 are implemented.

- Indexes:
  - Add sensible indexes on species, weight, created_at, etc., in line with query patterns.

**Frontend**

- New or extended Search page:

  - “Basic search” (what exists now).
  - “Advanced filters” section:
    - Weight range sliders or inputs.
    - Date range picker.
    - Species select (reuse feed filters).
    - Optional water/venue filters.

- Results:
  - Reuse existing catch card layout.
  - Make sure no private/blocked content leaks.

**Docs & QA**

- `ADVANCED-SEARCH-TESTS.md`:
  - Combinations of filters.
  - Behaviour with private accounts and blocked users.
  - Performance sanity checks.

---

### 3.2 Venues & Events (implemented; see venue docs)

**Goal:** Provide venue-centric discovery with rich context, leaderboards, and events while respecting existing privacy and block rules.

**Status:** Implemented (v1) – see `docs/VENUE-PAGES-DESIGN.md` and `docs/VENUE-PAGES-ROADMAP.md` for details.

**Current scope (high level):**
- `/venues` index: list of seeded venues with metadata and derived stats (total/recent catches, PBs, top species).
- `/venues/:slug` detail page:
  - Hero with venue metadata + stats.
  - Per-venue “Top anglers” strip and “Top catches” leaderboard.
  - “Recent activity” grid of catches.
  - “Events & announcements” section (upcoming and past).
- Admin venue tools:
  - `/admin/venues` and `/admin/venues/:slug` for editing venue metadata.
  - Admin-authored events (draft/published) with CRUD via RPCs.
- All venue surfaces reuse existing RLS/privacy/block rules on catches/comments.

---

### 3.3 Browse by Species / Regions (future)

**Goal:** Give a browsing experience beyond the feed: species-centric and venue-centric browsing.

**Backend**

- Add read-only views or RPCs:
  - Example:
    - `get_top_catches_by_species(species, limit)`
    - `get_recent_catches_by_venue(venue_id, limit)`
  - All must respect:
    - Visibility
    - Privacy
    - Block/mute rules.

**Frontend**

- New “Browse” entry point:
  - Species index:
    - List of supported species with counts.
    - Clicking a species → dedicated species feed.
  - Waters/regions:
    - Build on the existing venue pages to offer region-centric browse (e.g. “Venues near you”, “Top venues in X region”) once Phase 3.2 is mature.

---

## Phase 4 – Personal Bests & Angler Stats

### 4.1 Personal Best (PB) Tracking

**Goal:** Show each angler their PB by species.

**Backend**

- New RPC: `get_personal_bests(p_user_id uuid)`
  - For each species:
    - Max weight (and/or length) for that user.
    - Associated catch id and timestamp.

**Frontend**

- Integrate into existing Insights or add a dedicated PB section:
  - Cards like:
    - “PB Carp – 24lb 6oz at [Venue] on [date].”
  - Optional: marker on catch cards when that catch is a PB.

---

### 4.2 Richer Insights

**Goal:** Turn Insights into a meaningful tool for pattern-spotting.

**Backend**

- Additional RPCs:
  - Catches per month (time series).
  - Species breakdown (count/weight share).
  - Water type breakdown.
  - (Future) Tactic/rig performance.

**Frontend**

- Visualisations:
  - Simple line/bar charts using existing charting approach.
  - Cards that summarise “Most productive months”, “Top three species”, etc.

---

## Phase 5 – Badges, Roles & Progression

### 5.1 Badges & Achievements

**Goal:** Provide light progression and recognition.

**Backend**

- New table: `user_badges`
  - `user_id`, `badge_type`, `awarded_at`, `metadata`.
- Initial badge types:

  - “First catch logged”.
  - “10 catches logged”.
  - “First PB over X lb”.
- Notification: new `badge_awarded` notification type with friendly copy and deep links to profile/badge section.
- Admin-side tools/RPCs to grant/revoke badges with audit logging (initially manual).

- Awarding strategy:
  - Start with an admin-triggered or RPC-driven batch assignment (e.g. on cron or via manual runs).
  - Move to automatic awards in a later phase (triggered from catch insert RPCs).

**Frontend**

- Profile:
  - “Badges” strip showing a handful of badges with tooltips.
- Optional:
  - Notifications for new badge: new notification type `badge_awarded`.

---

### 5.2 Verified / Special Roles (Optional)

**Backend**

- Extend `profiles`:
  - `is_verified boolean DEFAULT FALSE`.

**Frontend**

- Show a small “verified” indicator next to username in profile and key surfaces.

---

## Phase 6 – Onboarding & Growth

### 6.1 Suggested Anglers to Follow

**Goal:** Help new users find interesting anglers quickly.

**Backend**

- New RPC: `get_suggested_profiles(p_user_id uuid)`
  - Simple heuristics for v1:
    - Most active anglers (by recent catches).
    - Or “top” anglers in same region/species preferences (if available).

**Frontend**

- Use in:
  - Post-signup screen (“Get started by following a few anglers”).
  - Profile or feed empty states: “Anglers to check out”.

---

### 6.2 Email Summaries (Later)

**Goal:** Periodic “Your highlights” emails.

**Backend / infra**

- Likely implemented via:
  - Supabase Edge Functions or external job runner.
  - Digest of recent catches, PBs, and new followers.

**Frontend**

- Settings:
  - Email preferences (opt-in/out).

---

## Phase 7 – Messaging & Social (Longer-Term)

**Goal:** Rich social features once core fishing tooling is solid.

**Scope (future)**

- Direct messages (1:1).
- Group messages / trip planning.
- Sharing catches with specific anglers or crews.
- Potential integrations with trip logs/sessions.

This phase is intentionally last: it has higher complexity and safety considerations and should build on a stable privacy/moderation foundation.

---

## Phase 2.0 – Execution Plan (historical)

This was the original sequence used to ship Phase 2 (account deletion, privacy, blocks). It is kept for context; for current status and future work, see the Phase 2 subsections above and `docs/recent.md`.

1) SQL/migrations – Implement `request_account_deletion(p_reason text)` RPC with soft-delete/anonymisation per design; preserve audit tables (new migration under supabase/migrations/*).  
2) SQL/migrations – Update key RPCs (comment and catch creation, search helpers) to respect `is_deleted`, `locked_for_deletion`, and soft-deleted catches/comments.  
3) SQL/migrations – Add `is_private` to `profiles` with basic indexes and initial RLS scaffolding for privacy.  
4) Frontend TSX – Add Settings UI for “Request account deletion” + simple “Account deleted” confirmation page.  
5) SQL/migrations + RPCs – Introduce `profile_blocks` schema and helpers; plan to exclude blocked users in feed/search/comment RPCs in a later patch.

---

## Non-Goals for This Roadmap

- Direct messaging / group messaging.
- Email digests / weekly highlights.
- Catch drafts and full catch editing workflows.
- Video uploads.
- Complex recommendation engines (“you might like” style).
- Fully automated/bulk badge assignment (beyond simple/manual or cron-style jobs).
- Legal DSAR/email flows beyond the current in-app JSON export.
- Rich UI/visualisation for data exports (exports stay as raw JSON).

## Implementation Pattern with Codex

For each phase/feature:

1. **Design doc first**

   - Create `*-DESIGN.md` describing:
     - Scope & behaviour.
     - DB changes (tables, columns, indexes, RLS).
     - RPC surface.
     - UI changes.
     - Manual test checklist.

2. **Migrations only**

   - Ask Codex to read the design doc and create a single migration (no TS/React changes).

3. **RPCs / backend logic**

   - Ask Codex to add RPC functions, updating only SQL/migrations as needed.

4. **Frontend wiring**

   - Ask Codex to update React components:
     - Clearly state “presentation-only” vs “behaviour changes”.
     - Emphasise “do not change hook order, do not alter existing Supabase queries except where specified.”

5. **Manual tests**
   - Run through the test checklist in each design doc before merging.

This roadmap is intentionally modular so we can pause between phases, re-prioritise, or deepen any specific area (e.g. privacy or PBs) before moving on.
