# Venue Pages & Leaderboards – Design (Phase 1: Read-only)

This document outlines the design for venue pages and venue leaderboards. Phase 1 (read-only listing/detail + leaderboards) is implemented with schema, RPCs, nav, and pages. Editing venues, events, and block/mute are future work.

---

## 1. Data Model
Status: Schema groundwork implemented (venues table, catches.venue_id, indexes). No venue data backfill yet; existing catches may have `venue_id` = NULL.
Seed data: Venues seeded from Add Catch options via 2058_seed_venues_from_add_catch.sql (slugs + names). `venue_id` remains optional and not yet backfilled on existing catches.

### 1.1 venues table
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `slug text UNIQUE NOT NULL` (used for `/venues/:slug`)
- `name text NOT NULL`
- `location text` (free text; e.g., “Wyreside Lakes, Lancashire, UK”)
- `description text` (optional)
- `is_published boolean NOT NULL DEFAULT TRUE`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

### 1.2 catches → venues
- Add `venue_id uuid NULL REFERENCES public.venues (id)` to `public.catches` (nullable initially).
- Keep existing free-text location fields as fallback for legacy data.
- Indexes to plan:
  - `CREATE INDEX ON public.catches (venue_id, created_at);` (recent lists)
  - `CREATE INDEX ON public.catches (venue_id, weight);` (top catches)
- Future: crosswalk/backfill from existing `location` to structured venues (out of scope here).

---

## 2. Pages & UX

### 2.1 /venues (index)
- List venues with:
  - `name`
  - `location`
  - Optional stats (v1 optional): `total_catches_at_venue`
- Each item links to `/venues/:slug`.

### 2.2 /venues/:slug (venue detail)
- Hero: venue name, location, optional description, light metric chips (e.g., total catches, number of anglers).
- Top catches at this venue:
  - Leaderboard of best catches (by weight or existing catch score).
  - Reuse existing catch card and feed grid styling.
- Top anglers at this venue (optional/nice-to-have in v1):
  - Per-angler stats: username, best_weight at venue, total_catches_at_venue.
- Recent catches at this venue:
  - Reverse-chronological list/grid, reusing existing catch cards/grid layout.

---

## 3. API / RPC Layer (design only)

Planned RPCs/views (no SQL yet):

- `get_venues(p_search text, p_limit int, p_offset int)`
  - Returns list of venues (id, slug, name, location, optional counts).
  - Respects `is_published`.

- `get_venue_by_slug(p_slug text)`
  - Returns single venue metadata (id, slug, name, location, description, is_published).

- `get_venue_recent_catches(p_venue_id uuid, p_limit int, p_viewer_id uuid)`
  - Returns recent catches for the venue with joined profile basics.
  - Must respect: catch visibility, `profiles.is_private`, `deleted_at`, moderation/admin override.
  - Prefer SECURITY INVOKER to rely on RLS; if SECURITY DEFINER, bake in the same predicates as feed/search.

- `get_venue_top_catches(p_venue_id uuid, p_limit int, p_viewer_id uuid)`
  - Returns top catches (by weight/score) with profile basics.
  - Same privacy/moderation requirements as above.

- `get_venue_leaderboard(p_venue_id uuid, p_limit int, p_viewer_id uuid)` (optional v1)
  - Per-angler stats (username, best weight, total catches at venue).
  - Must follow the same visibility/privacy rules.

All RPCs must honor:
- Catch `visibility`
- `profiles.is_private` (owner, follower, admin rules)
- `deleted_at` soft-deletes
- Admin override / moderation status as in feed/search/comment RLS

---

## 4. Privacy, Moderation, and RLS Alignment
- Venue pages are discovery surfaces; they must not leak:
  - Catches from private profiles to non-followers.
  - Catches/comments from deleted accounts.
  - Soft-deleted or moderated content already hidden elsewhere.
- Venue RPCs must reuse/mirror the visibility rules used by feed, search, and comments:
  - Non-followers: no private-profile catches.
  - Followers: private-profile catches allowed (subject to per-catch visibility).
  - Admins: full visibility.
- Admin bypass should remain consistent with current feed/moderation behaviour.
- Future block/mute (`profile_blocks`) will need to be layered in later; not covered here.

---

## 5. Future Venue-Owner Features (later phases)
- Extended venue fields:
  - Business/contact details
  - Ticket/membership info
  - Website/social URLs
- `venue_admins` table linking `venue_id` to `user_id`
- `venue_events` table for upcoming events
- Venue editing, events, and admin tooling are **not** part of Phase 1 (read-only browse/leaderboards only).

---

## 6. Manual Test Checklist (design-level)
- Public vs private profiles at a venue:
  - Owner sees own catches.
  - Follower vs non-follower visibility matches feed/search rules.
  - Admin sees everything.
- Venue pages never show catches that feed/search would hide (privacy/moderation/soft-delete).
- Venue with no catches → clear empty state.
- Venue with only private-profile catches → non-followers see nothing; followers/admins see catches.
- Mixed public/private-profile catches → only permitted catches appear per viewer relationship.
- Phase 1 UI/RPC checks:
  - /venues lists venues; search filters by name/location.
  - /venues/:slug shows hero, top catches, and recent catches with load-more.
  - Private-profile catches do not appear for non-followers; followers/admins can see them.
  - No regressions on feed/search/profile/add-catch.
