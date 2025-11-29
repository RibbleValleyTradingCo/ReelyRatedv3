# Venue Pages & Venue Leaderboards – Roadmap

This document describes a phased plan for adding **venue pages** and **venue-specific leaderboards** to ReelyRated.

It is designed to fit into the current stack and patterns:

- Supabase/Postgres with migrations and SECURITY DEFINER RPCs
- RLS-driven access control (profile privacy, moderation, soft-deletes)
- React/TypeScript frontend with doc-first development
- Existing pages: Home, Feed, Add Catch, Catch Detail, Profile, Insights, Leaderboard, Admin tools

The goal is to make it easy for anglers to discover good venues and for venues to present their own information, while keeping privacy/moderation rules intact.

---

## High-level goals

1. **Venues index page** (`/venues`)

   - A discoverable entry point listing venues (e.g. Wyreside, etc.).
   - Shows venue name, location, and basic stats (e.g. total catches).

2. **Venue detail page** (`/venues/:slug`)

   - Venue hero with name, location, description.
   - **Top catches leaderboard for that venue** (e.g. best carp at Wyreside).
   - Recent catches at that venue.
   - Later: additional venue details (contact, business info, events).

3. **Navigation**

   - “Venues” link in the **main navbar**.
   - “Venues” link in the **mobile menu**.
   - The aim is to make it obvious where to browse venues and their leaderboards.

4. **Venue management (later phase)**
   - Certain user accounts (venue owners/admins) can:
     - Edit venue details (description, business info, contact).
     - Add/manage events for their venue.

All changes must respect:

- Catch visibility rules (public/followers/private).
- Profile privacy (`is_private`) and follow relationships.
- Existing moderation and soft-delete behaviour.

---

## Phase 1 – Design doc (no code changes)

**Goal:** Capture a concrete design for venue pages and leaderboards before touching schema or frontend.

Create `docs/VENUE-PAGES-DESIGN.md` covering:

- **Data model**

  - New `venues` table (first-class entity), e.g.:

    - `id uuid`
    - `slug text unique` (for `/venues/:slug`)
    - `name text`
    - `location text` (free text for now)
    - `description text`
    - `is_published boolean NOT NULL DEFAULT TRUE`
    - `created_at timestamptz`
    - `updated_at timestamptz`

  - Add `venue_id uuid` to `catches`:

    - Nullable initially (not all catches will be tagged with a venue).
    - Indexed for queries and leaderboards.

- **Venue stats & leaderboards**

  - “Top catches at this venue”:

    - Likely sorted by weight or some existing catch score.
    - Needs to respect:
      - `catches.visibility`
      - profile privacy (`profiles.is_private`)
      - moderation/soft-deletes (`deleted_at`, banned/suspended users).

  - “Top anglers at this venue”:
    - A derived leaderboard (one row per angler).
    - Fields like:
      - `user_id`, `username`
      - `best_weight` at that venue
      - `total_catches_at_venue`
    - Also respects privacy & moderation rules.

- **Pages**

  - `/venues`:

    - List venues with:
      - `name`
      - `location`
      - simple stats like `total_catches_at_venue` (optional at first).
    - Each venue links to `/venues/:slug`.

  - `/venues/:slug`:

    - **Hero section:**

      - Venue name, location, description.
      - Optional “View on map” placeholder for future work.

    - **Top catches at this venue:**

      - Reuse existing catch card component.
      - Labelled clearly, e.g. “Top catches at Wyreside”.

    - **Top anglers (optional in v1):**

      - Small leaderboard strip using the venue leaderboard data.

    - **Recent catches:**
      - A chronological list or grid (most recent first).

- **Privacy & moderation**

  - Venue views must never leak:
    - Catches from private profiles to non-followers.
    - Catches/comments from deleted or heavily moderated accounts where we already hide them.
  - Design should specify:
    - Which RPCs will enforce these rules (similar to feed/search RLS).
    - That venue RPCs reuse the same visibility logic rather than duplicating it in React.

- **Future venue owner features (for later phases)**

  - Venue business info fields:

    - `business_name`, `contact_email`, `phone_number`, `website_url`, social URLs.
    - Ticket/membership info fields.

  - Venue ownership/administration:
    - `venue_admins` table linking `venue_id` to `user_id`.
    - Admin/owner-only RPCs to update venue details.
    - Potential `venue_events` table for events with CRUD via RPCs.

- **Manual test checklist (design-level)**

  - Owner vs non-owner views (later phases).
  - Public vs private profiles when viewing venue catches.
  - Admin visibility for moderation.

No SQL or TSX changes are made in Phase 1; it is documentation only.

---

## Phase 2 – Schema & basic wiring (no UI yet)

**Goal:** Introduce venues as a first-class entity and link catches to venues, without changing visible UI.

- New migration to:

  - Create `public.venues`.
  - Add `venue_id` to `public.catches`.
  - Add basic indexes.
  - Add comments referencing `VENUE-PAGES-DESIGN.md`.

- Optionally:
  - Seed a couple of test venues (e.g. Wyreside) for dev environment only.

UI remains unchanged in this phase.

Status: Implemented via migrations 2056_venues_schema.sql (venues table, catches.venue_id + indexes) and 2058_seed_venues_from_add_catch.sql (seeded venues from Add Catch options). No backfill yet; existing catches may have venue_id = NULL.

---

## Phase 3 – Read-only venue pages + nav links

**Goal:** Let users browse venues and see venue leaderboards, but keep everything read-only and safe.

- Backend RPCs:

  - `get_venue_by_slug(p_slug text)`
  - `get_venue_top_catches(p_venue_id uuid, p_limit int)`
  - `get_venue_recent_catches(p_venue_id uuid, p_limit int)`
  - Optional: `get_venue_leaderboard(p_venue_id uuid, p_limit int)` (per-angler stats)

- Frontend:

  - `/venues` index page listing venues with name/location/stats.
  - `/venues/:slug` detail page with:
    - Hero (name/location/description).
    - Top catches section (reusing existing catch cards).
    - Optional “Top anglers at this venue” strip.
    - Recent catches section.

- Navigation:
  - Add “Venues” link to main navbar.
  - Add “Venues” link to mobile menu.

Privacy/moderation enforcement is handled by RPCs and RLS; React only renders what it is allowed to see.

Status: Phase 1 read-only venue pages implemented (RPCs, /venues, /venues/:slug, nav links). No editing/admin features yet.

---

## Phase 4 – Venue details & business info (read-only)

**Goal:** Make venue pages more informative using additional fields on `venues`, still only editable via database/admin tools.

- Schema:
  - Add business/contact fields to `venues` (business name, contact, website, ticket info, etc.).
- Frontend:
  - `/venues/:slug` displays an “About this venue” card with those fields.

Status: TODO (UI/data not implemented yet).

---

## Phase 5 – Venue owner access & editing

**Goal:** Let certain users manage venue details.

- Schema:
  - Add `venue_admins` (or `venue_owners`) table linking `venue_id` → `user_id`.
- Backend:
  - SECURITY DEFINER RPCs to:
    - Add/remove venue admins.
    - Update venue business details.
- Frontend:
  - Minimal venue management UI (e.g. `/venues/:slug/manage`) visible only to venue admins + site admins.

Status: TODO (owner schema/RPC/UI not implemented yet).

---

## Phase 6 – Venue events (optional later)

**Goal:** Venue owners can add events that appear on their venue page.

- Schema:
  - `venue_events` table.
- Backend:
  - RPCs for CRUD + read-only listing.
- Frontend:
  - “Upcoming events” card on `/venues/:slug`.
  - Event management in `/venues/:slug/manage`.

Status: TODO (events not implemented).

---

## Recommended implementation order

1. **Phase 1:** `VENUE-PAGES-DESIGN.md` (design only).
2. **Phase 2:** Schema for `venues` + `catches.venue_id`.
3. **Phase 3:** Read-only venue pages, leaderboards and nav links.
4. **Phase 4:** Business/contact details on venue pages.
5. **Phase 5:** Venue admin access and editing.
6. **Phase 6:** Venue events.

Each phase should follow the same pattern we use elsewhere:

1. Design doc
2. Migrations only
3. RPC/back-end logic
4. Frontend wiring
5. Manual tests
