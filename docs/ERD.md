# ReelyRated ERD

This document describes the main entities, relationships, and security rules for the ReelyRated database (Supabase + Postgres).

- **All schema and queries should stay in sync with this file.**
- If the actual database or frontend code ever disagrees with this ERD, one of them needs updating.
- When in doubt, **this ERD is the source of truth**.

---

## 0. Implementation Phases

To keep the build manageable, the schema is designed in phases.

### Phase 1 – Core (build this first)

Tables:

- `profiles`
- `admin_users`
- `sessions`
- `catches`
- `baits`
- `tags`
- `water_types`

### Phase 2 – Social / Community

Tables:

- `profile_follows`
- `catch_comments`
- `catch_reactions`
- `ratings`
- `notifications`

### Phase 3+ – Moderation / Analytics / Domain

Tables / views:

- `venues`
- `species`
- `reports`
- `user_warnings`
- `moderation_log`
- `rate_limits`
- Views:
  - `leaderboard_scores_detailed`
  - `user_insights_view`

> When generating migrations or schema, **Phase 1 tables only** should be created initially, unless explicitly stated otherwise.

---

## 1. Global Conventions

### 1.1 IDs and keys

- All main entities use `id UUID` as the **primary key**.
- Foreign keys always reference the **primary key** of the parent table.
- Foreign key column names describe the relationship, for example:
  - `user_id`, `catch_id`, `session_id`, `venue_id`, `species_id`.
- Lookup tables may use:
  - `slug` / `code` as a primary key, **or**
  - `id` (UUID) plus a unique `slug` / `code`.

### 1.2 Timestamps

- Most tables include:
  - `created_at TIMESTAMPTZ` – when the row was created (default: `now()`).
  - `updated_at TIMESTAMPTZ` – when the row was last updated.
- Some tables also use:
  - `deleted_at TIMESTAMPTZ` – soft delete timestamp:
    - `NULL` = active.
    - non-null = soft-deleted (hidden from normal user views, but retained).

### 1.3 Auth & ownership

- Supabase manages `auth.users` (do **not** modify this schema directly).
- Application-level user data lives in `public.profiles`.
- `profiles.id` is the canonical user ID for all app data and **matches** `auth.users.id` (1:1 mapping).
- Ownership is modelled with `user_id` referencing `profiles.id`.

### 1.4 Visibility

- `catches.visibility` is a text/enum field with values:
  - `public`
  - `followers`
  - `private`
- Visibility affects:
  - Feed
  - Search
  - Venue detail pages
  - Insights
- Admins can see **everything** regardless of visibility and soft deletes.

---

## 2. Core Entities (Phase 1)

### 2.1 `profiles`

**Purpose**  
Represents an angler in the app, linked 1:1 with `auth.users`.

**Key fields (intended types)**

- `id UUID PK NOT NULL` – matches `auth.users.id`.
- `username TEXT UNIQUE NOT NULL` – URL-safe handle (3–30 chars).
- `full_name TEXT` – full name used in settings and admin views.
- `bio TEXT` – profile bio.
- `avatar_path TEXT` – storage path (e.g. `avatars/<userId>/<file>`).
- `avatar_url TEXT` – public URL for avatar image.
- `location TEXT` – e.g. “Preston, UK”.
- `website TEXT` – optional URL.
- `status TEXT` – short status string, e.g. “Currently fishing at Farlows Lake”.
- `warn_count INTEGER NOT NULL DEFAULT 0` – number of warnings (for admin UI).
- `moderation_status TEXT NOT NULL DEFAULT 'normal'` – e.g. `normal`, `under_review`, `suspended`.
- `suspension_until TIMESTAMPTZ` – if non-null, user is suspended until this time.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**Relationships**

- 1 profile → many `sessions`.
- 1 profile → many `catches`.
- 1 profile → many `catch_comments`.
- 1 profile → many `catch_reactions`.
- 1 profile → many `ratings`.
- 1 profile → many `profile_follows` rows:
  - as follower (`follower_id`)
  - as following (`following_id`)
- 1 profile → many `notifications` (as recipient).
- 1 profile → many `reports` (as reporter).
- 1 profile → many `user_warnings` (as warned user).
- 1 profile → many `moderation_log` entries (as admin).
- 1 profile → many `rate_limits` entries.
- 1 profile → 0 or 1 `admin_users` row.

**RLS intent**

- Any authenticated user can **SELECT basic profile fields** (username, avatar, etc.).
- A user can **UPDATE only their own** profile row.
- Moderation fields (`warn_count`, `moderation_status`, `suspension_until`) are **visible/editable only to admins**.

---

### 2.2 `admin_users`

**Purpose**  
Defines which profiles are admins.

**Key fields**

- `user_id UUID PK NOT NULL` – FK → `profiles.id`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` – when admin status was granted.

**Relationships**

- 1 profile → 0 or 1 `admin_users` row.

**RLS intent**

- Only admins (or service-role) can `SELECT` or modify this table.
- Used to gate admin-only RPCs and admin UI.

---

### 2.3 `sessions`

**Purpose**  
Represents a single fishing trip. A session can contain multiple catches.

**Key fields**

- `id UUID PK NOT NULL`.
- `user_id UUID NOT NULL` – FK → `profiles.id`.
- `title TEXT NOT NULL` – short title, e.g. “Summer Carp Session”.
- `date DATE NOT NULL` – date of the session.
- `venue TEXT` – free-text venue label, e.g. “Linear Fisheries”.
- `venue_name_manual TEXT` – optional human-friendly venue label used by some UI components (can differ from the raw `venue` text).
- `notes TEXT` – session notes/summary.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `deleted_at TIMESTAMPTZ` – soft delete flag (nullable).

**Future fields**

- `venue_id UUID` – FK → `venues.id` (Phase 3+).

**Relationships**

- 1 profile → many `sessions`.
- 1 session → many `catches`.

**Deletion behaviour**

- Catches **optionally** belong to a session (session_id can be NULL).
- Deleting a session in the UI will **soft-delete all associated catches**:
  - `catches.deleted_at = now()`
  - The user should be clearly warned this will happen.
- Admins may still see soft-deleted sessions and catches for audit purposes.

**RLS intent**

- Only the owner (`user_id = auth.uid()`) can `INSERT`, `SELECT`, `UPDATE` or soft-delete their sessions.
- No cross-user access except via admin tooling.

---

### 2.4 `catches`

**Purpose**  
Represents a single catch (fish) logged by a user. This is the core piece of content in the app.

#### Ownership & linking

- `id UUID PK NOT NULL`.
- `user_id UUID NOT NULL` – FK → `profiles.id` (who caught it).
- `session_id UUID` – FK → `sessions.id` (nullable).
- `location TEXT` – free-text venue/fishery name used heavily in UI.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `deleted_at TIMESTAMPTZ` – soft delete flag (nullable).

#### Fish details

- `title TEXT NOT NULL` – catch title.
- `description TEXT` – story / notes.
- `species TEXT` – species label used by the current UI and search (e.g. “carp”).
- `weight NUMERIC` – optional.
- `weight_unit TEXT` – e.g. `lb_oz`, `kg`, `g` (backed by an enum in DB).
- `length NUMERIC` – optional.
- `length_unit TEXT` – e.g. `cm`, `in` (backed by an enum in DB).
- `time_of_day TEXT` – e.g. `morning`, `afternoon`, `evening`, `night` (backed by an enum in DB).
- `caught_at DATE` – optional explicit date the fish was caught; if null, UI may fall back to `created_at`.

#### Location & conditions

- `peg_or_swim TEXT` – peg number or swim name.
- `conditions JSONB` – structure including (by convention):
  - `gps.lat`
  - `gps.lng`
  - `customFields.species` (used by search and filters).
- `water_type TEXT` – text/code linked to `water_types.code`.
- `hide_exact_spot BOOLEAN NOT NULL DEFAULT false` – if true, GPS is hidden from normal users.

#### Tactics

- `bait_used TEXT` – tied to `baits.slug` in UI.
- `method TEXT` – tied to `tags.slug` in UI (where `category = 'method'`).
- `equipment_used TEXT` – free-text gear description.

#### Media

- `image_url TEXT NOT NULL` – main image URL (required).
- `gallery_photos TEXT[]` – array of extra image URLs (up to ~6).
- `video_url TEXT` – optional video URL.

#### Privacy / ratings / tags

- `visibility TEXT NOT NULL` – `public | followers | private` (backed by an enum in DB).
- `allow_ratings BOOLEAN NOT NULL DEFAULT true`.
- `tags TEXT[]` – custom tags.

#### Normalised metadata (Phase 2 / 3)

These columns support leaderboards, insights, and richer search. They are nullable; the app can fall back to the base fields when they are null.

- `location_label TEXT` – optional cleaned display label for the venue/location. If null, the app falls back to `location`.
- `species_slug TEXT` – optional canonical species identifier (planned strict FK to `species.slug`).
- `custom_species TEXT` – optional free-text override when the angler logs a species that doesn’t match the canonical list.
- `water_type_code TEXT` – optional normalised water type code (intended FK to `water_types.code`).
- `method_tag TEXT` – optional normalised method identifier (intended FK to `tags.slug` where `category = 'method'`).

**Future extended normalisation (Phase 3+)**

- `species_id UUID` – FK → `species.id` once the `species` table is in place.
- `venue_id UUID` – FK → `venues.id` once `venues` are in place.

**Relationships**

- 1 profile → many `catches`.
- 1 session → many `catches`.
- 1 venue → many `catches` (future).
- 1 species → many `catches` (future).
- 1 catch → many `catch_comments`, `catch_reactions`, `ratings`, `notifications`, `reports`.

**RLS intent**

- Owner can always see and manage their own catches (subject to soft-delete rules).
- Other authenticated users can see only catches that:
  - are not soft-deleted (`deleted_at IS NULL`), and
  - respect visibility:
    - `public` → visible to everyone.
    - `followers` → visible **only** to users who follow the owner.
    - `private` → completely hidden from other users (no feed/search/profile stats).
- Admins can see **all** catches, including private and soft-deleted.

---

## 3. Social & Community (Phase 2)

### 3.1 `profile_follows`

**Purpose**  
Tracks follow relationships between users.

**Key fields**

- `id UUID PK NOT NULL` (generated).
- `follower_id UUID NOT NULL` – FK → `profiles.id` (who follows).
- `following_id UUID NOT NULL` – FK → `profiles.id` (who is followed).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Constraints**

- Unique constraint on `(follower_id, following_id)`.
- Prevent self-follow (`CHECK (follower_id <> following_id)`).

**Relationships**

- Many-to-many between profiles.
- Used for:
  - “following” feed.
  - followers-only visibility checks.

**RLS intent**

- A user can create and delete follow relationships only where `follower_id = auth.uid()`.
- A user can `SELECT` relationships relevant to them (for feed/visibility logic).
- Admins can see all follow relationships.

---

### 3.2 `catch_comments`

**Purpose**  
Comments and threaded replies on catches.

**Key fields**

- `id UUID PK NOT NULL`.
- `catch_id UUID NOT NULL` – FK → `catches.id`.
- `user_id UUID NOT NULL` – FK → `profiles.id` (author).
- `parent_comment_id UUID` – FK → `catch_comments.id` (nullable, for replies).
  - Supports **multi-level threads** (a reply can itself have replies).
- `body TEXT NOT NULL` – comment text.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `deleted_at TIMESTAMPTZ` – soft delete flag (nullable).

**Relationships**

- 1 catch → many `catch_comments`.
- 1 profile → many `catch_comments`.
- Optional thread structure via `parent_comment_id`.

**RLS intent**

- Authenticated users can `SELECT` comments on catches they’re allowed to view.
- A user can `INSERT` comments on catches they can view.
- A user can `UPDATE` / soft-delete only their own comments.
- Admins can view and moderate all comments.

---

### 3.3 `catch_reactions`

**Purpose**  
Emoji-style reactions (likes, etc.) on catches.

**Key fields**

- `catch_id UUID NOT NULL` – FK → `catches.id`.
- `user_id UUID NOT NULL` – FK → `profiles.id`.
- `reaction reaction_type NOT NULL` – enum.
  - Initial value: `'like'` only (more can be added later without schema changes).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Constraints**

- Primary key or unique constraint on `(catch_id, user_id)` – one reaction per user per catch.

**Relationships**

- 1 catch → many `catch_reactions`.
- 1 profile → many `catch_reactions`.

**RLS intent**

- Users can create/remove reactions where `user_id = auth.uid()`.
- Users can only react to catches they’re allowed to view.
- Admins can see all reactions.

---

### 3.4 `ratings`

**Purpose**  
Numeric scores applied to catches.

**Key fields**

- `id UUID PK NOT NULL`.
- `catch_id UUID NOT NULL` – FK → `catches.id`.
- `user_id UUID NOT NULL` – FK → `profiles.id`.
- `rating NUMERIC NOT NULL` – **integer** scale `1–10` (no half steps).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Constraints**

- Unique constraint on `(catch_id, user_id)`.
- `CHECK (rating BETWEEN 1 AND 10)`.

**Behaviour**

- The app already has a **leaderboard scoring formula** (mix of rating, weight, likes, etc.).
- The database’s job is to store the **raw rating**; the formula is implemented in:
  - App code, and
  - The `leaderboard_scores_detailed` view.
- That formula can evolve without changing this table’s schema.

**RLS / behaviour intent**

- A user can create/update/delete ratings where `user_id = auth.uid()`.
- Users **cannot rate their own catches**.
  - This is enforced in the `rate_catch_with_rate_limit` RPC (and may be backed by RLS).
- Ratings are only allowed on catches the user can view.
- Admins can see all ratings.

---

### 3.5 `notifications`

**Purpose**  
In-app notifications for follows, comments, reactions, ratings, mentions, and system events.

**Key fields**

- `id UUID PK NOT NULL`.
- `user_id UUID NOT NULL` – FK → `profiles.id` (recipient).
- `actor_id UUID` – FK → `profiles.id` (who triggered it; nullable for system).
- `type notification_type NOT NULL` – e.g. `new_follower`, `new_comment`, `new_rating`, `new_reaction`, `mention`, `admin_report`, `admin_warning`, `admin_moderation`.
- `message TEXT NOT NULL` – rendered text.
- `catch_id UUID` – FK → `catches.id` (nullable).
- `comment_id UUID` – FK → `catch_comments.id` (nullable).
- `extra_data JSONB` – payload for UI.
- `is_read BOOLEAN NOT NULL DEFAULT false`.
- `read_at TIMESTAMPTZ`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `deleted_at TIMESTAMPTZ`.

**Typical `extra_data` payloads**

- `admin_warning` –  
  `{ "severity": <string>, "duration_hours": <int|null>, "warning_id": <uuid> }`
- `admin_moderation` –  
  `{ "action": <string>, "catch_id"?: <uuid>, "comment_id"?: <uuid>, "reason": <string> }`
- Other types may include contextual IDs (e.g. `catch_id` / `comment_id` for comment/reaction notifications).

**Behaviour**

- Admin warning RPCs must always create an `admin_warning` notification for the user,
  including severity and any suspension duration in `extra_data`.

**Relationships**

- 1 profile → many `notifications` (recipient).
- 1 profile → many `notifications` (actor).
- Optional links to `catches` and `catch_comments`.

**RLS intent**

- A user can `SELECT`, mark read, and delete only notifications where `user_id = auth.uid()`.
- Admins may be able to inspect for debugging.
- Realtime channels filter on `user_id`.

---

## 4. Moderation, Venues, Species, Rate Limiting (Phase 3+)

### 4.1 `venues`

**Purpose**  
Normalised fishing venues, used by sessions and catches in later phases. These are closer to **mini profiles** (photos, description, rules, etc.) than just tags.

**Key fields**

- `id UUID PK NOT NULL`.
- `slug TEXT UNIQUE NOT NULL` – URL slug.
- `name TEXT NOT NULL` – venue name.
- `location TEXT` – e.g. “Oxfordshire, UK”.
- `latitude NUMERIC` – optional.
- `longitude NUMERIC` – optional.
- `water_type_code TEXT` – FK → `water_types.code`.
- `description TEXT`.
- `image_url TEXT`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `created_by UUID` – FK → `profiles.id`.
- `is_verified BOOLEAN NOT NULL DEFAULT false`.

**Relationships**

- 1 venue → many `sessions`.
- 1 venue → many `catches`.

**RLS intent**

- Read access likely public.
- Insert/update restricted to admins or trusted users.

---

### 4.2 `species`

**Purpose**  
Normalised list of fish species.

**Key fields**

- `slug TEXT PK` – string identifier.
- `label TEXT NOT NULL` – common name, e.g. “Common Carp”.
- `scientific_name TEXT`.
- `category TEXT` – e.g. carp, pike, trout.
- `record_weight NUMERIC`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Relationships**

- 1 species → many `catches`  
  (via `catches.species_slug`, enforced as a **strict FK** to `species.slug` in Phase 3+).

**RLS intent**

- Read access likely public.
- Changes controlled by admins.

---

### 4.3 `reports`

**Purpose**  
User reports of problematic content (catches or comments).

**Key fields**

- `id UUID PK NOT NULL`.
- `reporter_id UUID NOT NULL` – FK → `profiles.id`.
- `target_type TEXT NOT NULL` – e.g. `catch`, `comment`.
- `target_id UUID NOT NULL` – target row (`catches.id` or `catch_comments.id`).
- `reason TEXT NOT NULL` – short category.
- `details TEXT`.
- `status TEXT NOT NULL` – e.g. `pending`, `reviewed`, `resolved`, `dismissed` (backed by an enum in DB).
- `reviewed_by UUID` – FK → `profiles.id` (admin).
- `reviewed_at TIMESTAMPTZ`.
- `resolution_notes TEXT`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Relationships**

- 1 profile → many `reports` as reporter.
- 1 profile (admin) → many `reports` as reviewer.

**RLS intent**

- Any authenticated user can `INSERT` reports.
- Reporters may optionally see their own reports.
- Admins can `SELECT` and update all reports.

> The frontend `ReportButton` already posts into `reports`, so this table should be implemented early when Phase 3 work begins.

---

### 4.4 `user_warnings`

**Purpose**  
Persistent record of moderation warnings given to users.

**Key fields**

- `id UUID PK NOT NULL`.
- `user_id UUID NOT NULL` – FK → `profiles.id` (warned user).
- `issued_by UUID NOT NULL` – FK → `profiles.id` (admin).
- `reason TEXT NOT NULL`.
- `details TEXT`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Relationships**

- 1 profile → many `user_warnings` as target (`user_id`).
- 1 profile → many `user_warnings` as issuer (`issued_by`).

**RLS intent**

- Only admins can `INSERT` `user_warnings`.
- Admins can `SELECT` all warnings.
- A user can `SELECT` **their own warnings** (for display in a safety tab).

---

### 4.5 `moderation_log`

**Purpose**  
Audit trail for moderation actions; feeds admin audit screens and realtime logs.

**Key fields**

- `id UUID PK NOT NULL`.
- `admin_id UUID NOT NULL` – FK → `profiles.id`.
- `action TEXT NOT NULL` – e.g. `delete_catch`, `restore_comment`, `warn_user`, etc.
- `user_id UUID` – FK → `profiles.id` (target user, nullable).
- `catch_id UUID` – FK → `catches.id` (nullable).
- `comment_id UUID` – FK → `catch_comments.id` (nullable).
- `metadata JSONB`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Relationships**

- 1 profile → many `moderation_log` entries as admin.
- Optional links to affected users/catches/comments.

**RLS intent**

- Only admins can `SELECT` from this table.
- Only admin RPCs should `INSERT`.

> Logging fields are kept intentionally simple for now: `action`, IDs, and basic metadata (e.g. `reason`, `severity`). More can be added later if needed.

---

### 4.6 `rate_limits`

**Purpose**  
Log of rate-limited actions per user and action key.

**Key fields**

- `id` – primary key (UUID or BIGSERIAL, depending on implementation choice).
- `user_id UUID NOT NULL` – FK → `profiles.id`.
- `action TEXT NOT NULL` – e.g. `comments`, `reports`, `reactions`, `ratings`, `follows`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Relationships**

- 1 profile → many `rate_limits` entries.

**Behaviour**

- RPCs such as `check_rate_limit`, `get_rate_limit_status`, `user_rate_limits`, and `cleanup_rate_limits` operate on this table.

**RLS intent**

- Typical usage is through **SECURITY DEFINER RPCs**.
- Direct access:
  - A user may see only **their own** rows.
  - Admins can see all.

**Rate limiting**

Actions and hourly limits enforced via `check_rate_limit`:

- `comments` – max **20/hour**
- `reports` – max **5/hour**
- `reactions` – max **50/hour**
- `ratings` – max **50/hour**
- `follows` – max **30/hour**

When a limit is hit, RPCs raise errors prefixed with:

> `RATE_LIMITED: <action> – max <N> per hour`

…so the frontend can display a friendly toast.

Rate-limit attempts are logged in `public.rate_limits (user_id, action, created_at)` and can be inspected via the `user_rate_limits` / `get_rate_limit_status` helpers for debugging.

---

### 4.7 Views: Leaderboards & Insights

#### `leaderboard_scores_detailed` (view)

- Aggregates catches + ratings (and profiles) into leaderboard entries.
- Sources data from:
  - `public.catches` (base catch info and visibility/soft-delete rules)
  - `public.profiles` (owner_username)
  - `public.ratings` (rating averages and counts)
- Includes only catches where:
  - `deleted_at IS NULL` **and**
  - `visibility = 'public'`.

**Exposes at least:**

- `id`, `user_id`, `owner_username`
- `title`, `species_slug`, `weight`, `weight_unit`
- `length`, `length_unit`
- `image_url`
- `total_score`, `avg_rating`, `rating_count`
- `created_at`
- `location_label` (falls back to `catches.location` when `location_label` is NULL)
- `method_tag`
- `water_type_code`
- `description`, `gallery_photos`, `tags`, `video_url`
- `conditions`, `caught_at`

**Scoring**

- `total_score` uses an **existing formula** in the app, mixing rating, weight and engagement (likes, etc.).
- The database view implements the same formula; it can be refined later without changing core relationships.

#### `user_insights_view` (view)

Per-user aggregates used on the Insights page:

- Catches over time (per month / date range).
- Breakdown by venue.
- Breakdown by species.
- Time-of-day performance.

Planned for Phase 3+; implementation details should follow the same conventions as `catches` and `sessions`.

**RLS intent**

- Read-only from the client’s perspective.
- Must respect catch visibility rules and soft deletes in the underlying queries.

---

## 5. Lookup Tables

### 5.1 `baits`

**Purpose**  
Standard list of bait options for dropdowns.

**Key fields**

- `slug TEXT PK` – or unique key.
- `label TEXT NOT NULL` – display name.
- `category TEXT NOT NULL` – e.g. `natural`, `processed`, `lures`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**RLS intent**

- Public read.
- Only admins edit.

---

### 5.2 `tags` (methods)

**Purpose**  
Standard set of methods, stored in a generic `tags` table.

**Key fields**

- `slug TEXT PK` – or unique key.
- `label TEXT NOT NULL` – display name.
- `category TEXT NOT NULL` – usually `method`.
- `method_group TEXT` – e.g. `float`, `bottom`, `lure`, `margin`, etc.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**RLS intent**

- Public read.
- Only admins edit.

---

### 5.3 `water_types`

**Purpose**  
Describes types of water bodies.

**Key fields**

- `code TEXT PK` – or unique key.
- `label TEXT NOT NULL` – display name, e.g. `Lake`, `River`.
- `group_name TEXT NOT NULL` – e.g. `stillwater`, `flowing`, `commercial`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**RLS intent**

- Public read.
- Admin-only changes.

---

## 6. Relationship Summary

High-level entity relationships:

- `auth.users` 1:1 `profiles`
- `profiles` 1:many `sessions`
- `profiles` 1:many `catches`
- `sessions` 1:many `catches`
- `profiles` many:many `profiles` via `profile_follows`
- `catches` 1:many `catch_comments`
- `catches` 1:many `catch_reactions`
- `catches` 1:many `ratings`
- `profiles` 1:many `notifications`
- `profiles` 1:many `reports` (as reporter)
- `profiles` 1:many `user_warnings` (as warned user)
- `profiles` 1:many `moderation_log` (as admin)
- `profiles` 1:many `rate_limits`
- `profiles` 0:1 `admin_users`
- `venues` 1:many `sessions`
- `venues` 1:many `catches`
- `species` 1:many `catches`

---

## 7. RLS & Auth Overview (Summary)

Short summary of intent; actual SQL policies must match this:

- **profiles**

  - Public-ish `SELECT` for basic fields.
  - Owner-only `UPDATE` for profile details.
  - Admin-only access to moderation fields.

- **sessions**

  - Owner-only CRUD.
  - No general public access.

- **catches**

  - `SELECT` obeys visibility + soft-delete rules.
  - Owner can delete/soft-delete.
  - Admins can see everything, including private and soft-deleted catches.

- **profile_follows**

  - Users manage their own follows.
  - Only relevant rows are visible to each user.

- **catch_comments, catch_reactions, ratings**

  - Users manage their own rows.
  - Only allowed on catches they can view.
  - Users can’t rate their own catches.

- **notifications**

  - Only recipient can see/modify their notifications.

- **reports**

  - Any authenticated user can create reports.
  - Admins manage status and review.

- **admin_users, user_warnings, moderation_log, rate_limits**
  - Admin-only write.
  - Admin-only read, except users can see **their own** `user_warnings`.

- **venues, species, baits, tags, water_types**
  - Public read.
  - Admin-only changes.

---

## 8. Notifications, Comments & Mentions (Current Implementation)

### 8.1 Notifications
- Types in use: `new_comment`, `mention`, `new_reaction`, `new_rating`, `new_follower`, admin types (`admin_report`, `admin_warning`, `admin_moderation`).
- Dedupe: `new_reaction` and `new_follower` dedupe via unique constraints; `new_comment` and `mention` are per-event.
- Routing: comment-related types deep-link to `/catch/:catchId?commentId=:commentId` when `comment_id` is present; otherwise `/catch/:catchId`. Follow falls back to actor profile; admin types route per notifications-utils.
- Creation: `create_comment_with_rate_limit` emits `new_comment` to catch owner (skip self/deleted catches) and `mention` to mentioned users.
- Non-blocking: notification failures must not block comment/mention insert.

### 8.2 Comments
- Threading: `parent_comment_id` supports replies; soft delete via `deleted_at`; admins can view deleted content.
- Admin badge: view `catch_comments_with_admin` exposes `is_admin_author` via `public.is_admin(user_id)`; badges are author-based and visible to all.
- Rate limits: non-admins limited (20/hour) via `check_rate_limit` + `rate_limits`; admins bypass.
- Visibility: RLS enforces catch visibility (public/followers/private) and owner/admin access; comments visible only when catch is visible to viewer.
- Notifications: owner receives `new_comment` (skip self); mentions trigger `mention`.

### 8.3 Mentions
- Parsing: regex `@([A-Za-z0-9_.]+)` on trimmed body in `create_comment_with_rate_limit`.
- Resolution: case-insensitive match to `profiles.username`; distinct usernames per comment.
- Skips: self and catch owner (owner notified via `new_comment` already).
- Visibility gates:
  - Public: allow all mentioned users.
  - Followers: allow owner, admins, or followers of catch owner.
  - Private: allow owner or admins only.
- Notifications: `mention` type with `catch_id`, `comment_id`, `mentioned_username` in `extra_data`; non-blocking.
- Mention candidates view: `catch_mention_candidates` includes catch owner + commenters with `last_interacted_at`; inherits catch/comment RLS.

---

## 9. Admin Visibility & Badges

- Source of truth: `admin_users` table and `public.is_admin()` helper.
- Exposure: views (e.g. `catch_comments_with_admin`) add `is_admin_author`; badges are based on author role, not viewer role.
- Behaviour: admins can see private/soft-deleted content where views/RPCs are designed for moderation; admin flags/badges are informational and do not bypass viewer routing on the frontend.

---

## 10. Rate Limits (Implementation Overview)

- Table: `rate_limits` (user_id, action, created_at).
- Helpers/RPCs: `check_rate_limit`, `user_rate_limits`, `get_rate_limit_status`, `cleanup_rate_limits`.
- Per-action limits (examples): comments 20/hour; reports 5/hour (client + RPC); other actions follow similar patterns.
- Error format: `RATE_LIMITED: <action> – max <N> per hour` for client messaging.

---

## 11. Implementation Status Snapshot

- Implemented: profiles, admin_users, sessions, catches, profile_follows, catch_comments, catch_reactions, ratings, notifications, rate_limits, leaderboard_scores_detailed, venues (core + stats), venue_events (schema/RPCs), block/unblock RPCs.
- Partial: reports, user_warnings, moderation_log (tables/RPCs exist; admin UI/workflows partial), user_insights_view (design/placeholder).
- Pending/future: deeper moderation UI, venue owner roles, expanded analytics, richer species/venue backfills.

---

## 12. References

- Frontend routing & page map: `docs/frontend-map-of-pages.md`
- Profile & privacy design: `docs/` (profiles, account deletion)
- Block/mute: `docs/BLOCK-MUTE-DESIGN.md`
- Venues & events: `docs/VENUE-PAGES-DESIGN.md`, `docs/VENUE-PAGES-ROADMAP.md`
- Safety & moderation: moderation-related docs/RPC specs
