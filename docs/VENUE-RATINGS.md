# Venue Ratings – Design Spec (v1)

## 1. Purpose

Give each venue a simple, trusted star rating so anglers can quickly judge:

- How good the venue is overall
- How many anglers have actually rated it
- Whether _they_ have already rated it

This should feel like “TripAdvisor-style” ratings, but focused on fishing venues and tightly integrated with our existing venue + community data.

## 2. Scope for v1

In scope (v1):

- 1–5 star **numeric rating** per venue, per user (no text review yet)
- Aggregated **average rating** and **count of ratings**
- “Your rating” control on the venue page for logged-in anglers
- Read-only rating summary on the venue hero

Out of scope (future):

- Text reviews (“Pros / Cons”, headlines, comments)
- Rating breakdown (5★ vs 4★ vs 3★ bars)
- Sub-ratings (Facilities, Value, Staff, etc.)
- Directory filters/sort by rating
- Moderation tooling for abusive reviews

## 3. Data model

We **must not** reuse the existing `ratings` table that’s used for catch ratings (`/rest/v1/ratings` calls). Venue ratings will have their own table.

### 3.1 Table: `venue_ratings`

Proposed columns:

- `id` uuid, primary key, default `gen_random_uuid()`
- `venue_id` uuid, FK → `venues.id`
- `user_id` uuid, FK → `profiles.id` (auth.uid)
- `rating` smallint (1–5 enforced by constraint)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

Constraints:

- Unique `(venue_id, user_id)` so each angler can only have one rating per venue
- Check `rating BETWEEN 1 AND 5`

RLS:

- Row visibility:
  - Public: can **select** aggregate output via RPC/view only (no direct table scan by normal users)
  - Users: can **select** their own row
- Writes:
  - Only authenticated users can insert/update/delete their own rating
  - Admins can see all ratings (for moderation/abuse tools in future)

### 3.2 Aggregation

We want a cheap way to show:

- `avg_rating` (numeric, 1-decimal)
- `rating_count` (integer)
- `user_rating` (for current user, when logged in)

Recommended approach:

- Add a small **view or RPC** to aggregate per venue:

  - `venue_rating_summary(venue_id, avg_rating, rating_count)`
  - OR extend existing `venue_stats` view with `avg_rating` and `rating_count`

- Add a simple RPC to get **current user’s rating** for a venue (or return null):

  - `get_my_venue_rating(p_venue_id uuid)`

## 4. RPCs / API

### 4.1 Upsert rating

`upsert_venue_rating(p_venue_id uuid, p_rating int)`

Behaviour:

- Uses `auth.uid()` as `user_id`
- If a row exists for `(venue_id, user_id)`, update `rating` + `updated_at`
- Else insert new row
- Validate 1–5; raise error if invalid
- Return up-to-date summary:
  - `venue_id`
  - `avg_rating`
  - `rating_count`
  - `user_rating` (for this user)

Security:

- `SECURITY DEFINER` with RLS-safe guard (= must be authenticated)
- No ability to act on behalf of other users

### 4.2 Read summaries

Two options that Codex can choose between:

1. **View-based**:

   - Extend existing `venue_stats` view to include `avg_rating` and `rating_count` via left join to `venue_ratings`.
   - `get_venues` and `get_venue_by_slug` automatically expose `avg_rating` and `rating_count`.

2. **RPC-based**:

   - Separate `get_venue_rating_summary(p_venue_id)` that returns `avg_rating` and `rating_count`.

Either way, the frontend needs:

- On **VenueDetail**:

  - `avg_rating`, `rating_count`
  - `user_rating` (via dedicated RPC)

- On **/venues** cards (Phase 2, not now):
  - `avg_rating`, `rating_count` (no `user_rating` needed there)

Codex should pick the approach that best aligns with existing `venue_stats` usage.

## 5. UX – where ratings appear

### 5.1 Venue detail hero (`/venues/:slug`)

In the hero, near the venue name/tagline:

- Show rating summary if `rating_count > 0`:

  - ⭐ **4.6** (bold)
  - `· 23 ratings` (muted)
  - Small label: `"Rated by anglers on ReelyRated"`

- If `rating_count === 0`:

  - “Not yet rated” or “No ratings yet”
  - CTA text: “Be the first to rate this venue”

### 5.2 “Your rating” control (VenueDetail)

For logged-in users:

- Control: 5 clickable stars (1–5)
- Behaviour:
  - Clicking a star calls `upsert_venue_rating`
  - On success, update:
    - `user_rating` (highlight their stars)
    - `avg_rating` and `rating_count`
  - If user had no rating before, we increment count; if they change rating, only avg changes

Anonymous users:

- Show read-only rating summary
- Replace interactive stars with a small link/CTA: “Log in to rate this venue”

Permissions:

- Venue owners/admins rate like any other user; no special override.

### 5.3 Directory cards (`/venues`) – Phase 2

Not for the first implementation, but design intent:

- Show a tiny row under the name:

  - Stars + `avg_rating` + `(rating_count)`

- Later we’ll add:
  - Sort by “Highest rated”
  - Filter “4★+ only”

## 6. Ownership vs community data

- Venue owners **cannot** change venue ratings directly.
- Ratings are purely community-driven.
- Admins may, in a future phase, hide/remove abusive ratings via separate tooling (not in v1).

## 7. Phasing

### Phase 1 (now)

- Add `venue_ratings` table with RLS.
- Add upsert RPC `upsert_venue_rating`.
- Provide a way for VenueDetail to read:
  - `avg_rating`, `rating_count` (via view or RPC)
  - `user_rating` (via RPC)
- Wire hero summary + “Your rating” stars on **VenueDetail** only.

### Phase 2 (later)

- Show rating summary on `/venues` cards.
- Add sort/filter by rating.
- Consider text reviews + rating breakdown charts.
- Add light moderation tools for venue ratings.
