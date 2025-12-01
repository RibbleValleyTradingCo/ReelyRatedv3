# Venue Page Design v2 (`/venues/:slug`)

Last updated: 2025-12-01  
Status: In progress, codex-aligned

## 1. Purpose

This document defines the **v2 “mini-site” design** for a venue detail page:

- Make each venue feel like a **public profile / mini website**.
- Reuse our existing **home/leaderboard visual language** so the app feels cohesive.
- Support **venue owners/admins** as content managers, while keeping the public page clean & visitor-focused.
- Provide a stable reference for **Codex** when planning frontend/backend work related to venues.

---

## 2. High-level goals

- Feeling: **“TripAdvisor / Facebook meets fishing app”**.
- Page is optimised for:
  - **Visitors/anglers** deciding whether to fish there.
  - **Community**: seeing real catches and activity.
  - **Venue owners**: showcasing their venue via metadata + photos (managed via Edit/Manage pages).

**Important:**  
All _editing_ (text, metadata, photos) happens in admin/owner pages (`/admin/venues/:slug`, `/my/venues/:slug`).  
`/venues/:slug` is primarily **read-only** with subtle admin/owner hints.

---

## 3. Section order (top-level layout)

On `/venues/:slug`, sections should appear in this order:

1. **Hero banner**
2. **Stats row** (recent catches)
3. **About + Photo gallery** (one combined section)
4. **Plan your visit + Facilities** (trip-planning block)
5. **Events & announcements** (conditional)
6. **Community catches** (full-width feed-style)
7. **Leaderboard: Top catches** (top 3 + species filter)

Everything sits inside our standard `section-container` with consistent vertical spacing and the same max-width as the homepage content.

---

## 4. Hero banner

### Content

Hero shows:

- Breadcrumb: `Venues / {venue.name}`.
- Venue name.
- Location pill:
  - `venue.location` with MapPin icon.
- Short description / tagline:
  - `venue.short_tagline` or first 1–2 sentences of `venue.description`.
- CTAs:
  - **Visit website** → `venue.website_url` (if present).
  - **View on maps** → external maps URL built from name/location.
  - **Back to venues** → `/venues`.
  - **Edit venue** / **Manage venue**:
    - Shown only to admins/owners (reusing existing logic).
- Contact:
  - Phone: `venue.contact_phone` (if present).
  - (Email can be added in a future schema update.)

### Layout – Desktop

- Two-column hero card:

  - **Left column (content)**:

    - Breadcrumb (small, subtle, uppercase).
    - Name (large, bold).
    - Location pill under name.
    - Tagline under location.
    - Row of CTAs (Visit website, View on maps, Back to venues, Edit/Manage).
    - Contact row under CTAs.

  - **Right column (image)**:
    - Main venue image (primary photo from `venue_photos`, or fallback catch image).
    - Image inside a card that **slightly overlaps** the right/bottom edge of the hero background.
    - Rounded corners, border, soft shadow.
    - Small “View all photos” label/badge on the image.

- Background:
  - Dark gradient (similar to current hero) with simplified colours.
  - Use the same typography and spacing scales as the homepage hero.

### Layout – Mobile

- Stack vertically:
  - Hero text (breadcrumb, name, location, tagline, CTAs, contact).
  - Main image card as its own **full-width row** under the text.
- Remove fancy overlap on mobile; use a simple full-width card instead.

**Hero must NOT show:**

- Hero-level PB stats.
- “Most active angler” content.
- Ticket-type pill.
- Raw catch stat line (“X catches logged / Y in last 30 days”).

---

## 5. Stats row (recent catch stats)

Under the hero, show a **3-card stats row** based on venue stats:

- **Card 1 – Catches logged**

  - Value: `venue.total_catches`.
  - Label: “Catches logged at this venue”.

- **Card 2 – Last 30 days**

  - Value: `venue.recent_catches_30d`.
  - Label: “In the last 30 days”.

- **Card 3 – Top species**
  - Value: `venue.top_species[0]` (if present).
  - Label: “Top species here”.

Style:

- Each stat is a **small card**, not a pill:
  - White background, border, subtle shadow.
  - Small uppercase label + big value + optional microcopy.
- Always reuse the **leaderboard card visual language** from the homepage.

Empty states:

- If total_catches is 0:
  - Show “0 catches logged” and “Be the first to log a catch here”.
- If recent_catches_30d is 0:
  - Show “0 in the last 30 days” and “Quiet recently”.

---

## 6. About + Photo gallery (linked section)

This is a single section: **left “About”, right “See the venue”.**

### Left: About the venue

- Label: “About”.
- Title: “About the venue”.
- Body:
  - Primary: `venue.description`.
  - Fallback: tagline text if description is missing.
- Simple text card; no stats or chips here.

### Right: See the venue (photo gallery)

- Label: “See the venue”.
- Content:

  - Use images from `venue_photos` (see backend design below).
  - Desktop:
    - 1 large feature image (`aspect 4:3`) at the top.
    - 2–3 thumbnails below it.
  - Mobile:
    - Horizontal scroll of image tiles.

- Clicking an image:
  - Should open an existing lightbox / full-size viewing pattern (or open in new tab as a first step).

**Empty state:**

- If no venue photos and no catch fallback photos:
  - Show message:  
    “No photos yet. Venue owners can upload photos from the Manage venue page.”
- No upload controls on this public page.

---

## 7. Plan your visit + Facilities (trip-planning block)

This is a **single “Plan your visit” section** that combines ticket/booking information with facilities.

### Tickets & booking

Use:

- `venue.ticket_type` (e.g. Day ticket / Syndicate / Club water).
- `venue.price_from` (normalised with `getDisplayPriceFrom` helper to avoid “From From …”).
- `venue.website_url`
- `venue.booking_url`
- `venue.contact_phone` (and email later).

Display:

- Label: “Tickets & booking”.
- Title: “Plan your visit”.
- Text lines (show only if values exist):
  - `Ticket type: {ticket_type}`
  - `{displayPriceFrom}` (e.g. “From £10 / day”).
  - `Call: {contact_phone}`.
- Buttons (right-aligned or stacked on mobile):
  - “Book now” (if `booking_url`).
  - “Visit website” (if `website_url`).

### Facilities & best for

Based on:

- `venue.best_for_tags` (text[]).
- `venue.facilities` (text[]).

Rules:

- Deduplicate facilities that appear in best_for_tags.
- Only render this block if **either** list is non-empty.

Display:

- Subtitle: “On-site & style”.
- Chip rows:
  - “Best for” row.
  - “Facilities” row.
- Chips must use the same style as tags/filters across the app (CatchCard tags, feed filters).

Visibility:

- Show the whole **Plan your visit** section if at least one of:
  - ticket_type, price_from, website_url, booking_url, contact_phone, best_for_tags, facilities.

---

## 8. Events & announcements (conditional)

- Use existing RPCs:
  - `get_venue_upcoming_events`
  - `get_venue_past_events`

Visibility:

- Show this section **only if** at least one event exists:
  - `upcomingEvents.length > 0` OR `pastEvents.length > 0`.

Layout:

- Label: “Events & announcements”.
- Title: “Updates from this venue”.
- Tabs: “Upcoming” / “Past”.
- Cards:
  - Title, event_type badge, dates, description, ticket info, booking/website buttons.

No behavioural changes required, just ensure:

- Section is hidden entirely when both lists are empty.

---

## 9. Community catches (full-width, feed-style)

This section uses the **same CatchCard design + layout as the main feed**.

### Content

- Fetch from:
  - Existing `get_venue_recent_catches` RPC.
- Always render the section, but adapt content based on data.

### Layout

- Label: “Community catches”.
- Title: “What anglers are logging here”.
- Optional right-aligned link:

  - “View all catches from this venue” → venue-filtered feed (when available).

- Body:
  - Full-width grid of CatchCards:
    - `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.
  - “Load more” button centered beneath grid.

### Empty state

- If `venue.total_catches <= 0`:
  - Replace grid with a single card:
    - “No catches have been logged at this venue yet.”
    - If user is authenticated: “Log a catch at this venue” button (link to Add Catch with venue pre-selected, if supported).

---

## 10. Leaderboard (top 3 + species filter)

A compact leaderboard, visually matching the **homepage leaderboard**.

### Data

- Use existing `get_venue_top_catches` (already available).
- Client-side species filter (v1) using species field from the returned catches.

### Layout

- Label: “Leaderboard”.
- Title: “Biggest catches at this venue”.
- Right-aligned species filter control:
  - Dropdown or pill-based segmented control.
  - Options: “All species” + list derived from `top_species` or unique species in `topCatches`.
- List:
  - Take top catches, then filter client-side, then slice to **top 3**.
  - Each row styled like home leaderboard:
    - Rank badge (#1/#2/#3).
    - Angler avatar + username.
    - Weight + unit.
    - Species.
    - “View catch” button on the right.

Empty state:

- If there are no top catches, hide this section or show a subtle “No standout catches yet.”

---

## 11. Venue photos backend design (for reference)

Implemented in `supabase/migrations/2078_venue_photos_and_rpcs.sql`:

- Table: `venue_photos`
  - id, venue_id, image_path, caption, created_at, created_by.
- RLS:
  - Public can `select` photos for published venues.
  - `insert` and `delete` allowed only for admins/venue owners (via `is_venue_admin_or_owner`).
- RPCs:
  - `owner_add_venue_photo(p_venue_id, p_image_path, p_caption?)`:
    - Admin/owner adds a new photo.
  - `owner_delete_venue_photo(p_id)`:
    - Admin/owner deletes a photo.
  - `get_venue_photos(p_venue_id, p_limit, p_offset)`:
    - Public read, ordered by newest first.

On `/venues/:slug`:

- We **only read** via `get_venue_photos`.
- Upload/delete happens in Edit/Manage pages, not here.

---

## 12. Admin/Owner UX on the public venue page

On `/venues/:slug`:

- Show **Edit venue** / **Manage venue** button in the hero for admins/owners.
- For admins/owners, show **subtle hints** (no forms) in sections when data is missing:
  - About: “Add a description in the Edit venue page to help anglers understand this venue.”
  - Photos: “Upload photos from the Manage venue page to showcase this venue.”
  - Plan your visit: “Add rates and contact details in Manage venue to help anglers plan their trip.”

No inline file inputs, textareas, or other write UI on this public page.

---

## 13. How Codex should use this doc

When planning or implementing changes for `/venues` and `/venues/:slug`, **Codex should**:

1. **Read this file** (and `docs/VENUE-PAGES-DESIGN.md` if needed) before writing a plan.
2. Align any new UI work with:
   - Section order.
   - Content per section.
   - Behaviour/visibility rules.
3. Reuse:
   - Existing CatchCard/leaderboard components/styles where possible.
   - Existing RPCs (venue stats, top catches/anglers, recent catches, venue photos).
4. Keep **editing functionality** in admin/owner pages, not on the public `/venues/:slug` page.

If a proposed change conflicts with this doc, Codex should **call it out explicitly** and suggest either:

- Updating this design spec first, or
- Adding a new phase/variant (e.g. v3) rather than silently diverging.
