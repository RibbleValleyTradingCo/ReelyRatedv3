# Venue Pages – v2 Design Spec

_Last updated: 2025-12-01. Source of truth for /venues and /venues/:slug. Backend migrations up to 2078 are applied (venue photos, metadata, stats)._

## A. Venue Directory (`/venues`)

### 1. Goals

- Help anglers quickly discover venues that fit their style, budget, and location.
- Surface community activity (catches, ratings) to highlight “alive” venues.
- Keep cards predictable: title, location, thumbnail, quick stats, and a clear CTA.

### 2. Search & Filters (v1 scope)

- **Search bar:** free-text over venue name, town, county (postcode if stored).
- **Filters (first iteration):**
  - Location: county/region.
  - Ticket type: `day_ticket`, `club`, `syndicate` (current build: client-side dropdown).
  - Water type: `stillwater`, `reservoir`, `river`, `canal` (future).
  - Species (limited): Carp, Pike, Perch, Barbel, Catfish (future).
  - Facilities: Toilets, Café, Tackle shop, Night fishing (future).
- **Sort options:**
  - Name A–Z (current default, client-side).
  - Most catches logged (client-side on total_catches).
  - Most active recently (client-side on recent_catches_30d).
  - Highest rated (future once venue ratings exist on cards).

### 3. Venue Cards

- **Layout & content:**
  - Title: `name`.
  - Subtitle: location (e.g. “Kent, UK” or “Town – County”).
  - Thumbnail (4:3, object-cover):
    - Prefer venue hero photo (`get_venue_photos`).
    - Fallback: most recent catch image (`get_venue_recent_catches`).
    - Otherwise: neutral placeholder.
    - Ticket type badge (e.g. “Day ticket”) overlaid top-left.
  - **Headline stats (read-only, community-derived):**
    - Total catches logged (`total_catches`).
    - “Last 30 days” (`recent_catches_30d`) with a small flame icon when recent activity crosses simple thresholds (“hot venue”).
    - Heaviest catch: weight + species (top-catches RPC).
    - Average rating + count: future venue_ratings (currently only on venue detail, not on cards).
  - **Tags:**
    - Species tags (up to 2–3).
    - Venue type: Day ticket / Syndicate / Club, etc.
    - 1–2 key facilities: Toilets, Tackle shop, etc.
  - **Price snippet:** `price_from` as “From £X / day”.
  - **Actions:**
    - Primary: “View venue”.
    - Phase 2+: optional “Save / ♥” (favourites).

### 4. Data Sources

- **Admin/owner-entered (Edit/Manage venue):**
- `name`, `location`, `short_tagline`, and (future) an optional dedicated hero/cover image field. For now, the UI should use `venue_photos` plus featured catch images as the primary visuals.
  - `ticket_type`, `price_from`.
  - `facilities[]`, `best_for_tags[]` (if used on cards).
  - Website/booking/contact (for future card snippets).
- **Community-derived:**
  - `total_catches`, `recent_catches_30d` (venue_stats).
  - Heaviest catch: top-catches RPC.
  - Last catch date: recent-catches RPC.
  - Venue rating avg + count (future `venue_ratings`).

### 5. Out of Scope (v1)

- Map view with pins.
- Trending / “hot this week” strips.
- Distance-based sort (“Closest to me”).
- Ratings on directory cards (ratings currently shown only on venue detail; directory ratings/filtering remain future).

---

## B. Venue Detail Page (`/venues/:slug`)

### 1. Page Goals

- Act as a mini-site: understand the fishing experience, plan a trip, see live community activity.
- Separate **owner/admin content** (managed via Edit/Manage) from **community signals** (catches, ratings).
- Encourage engagement (view catches/profiles), trust (clear info), and conversion (book/visit/log a catch).

### 2. Hero Area

- **Left column:**
  - Breadcrumb: `Venues / {name}`.
  - Title: `name`.
  - Location pill: `location`.
  - Short tagline: `short_tagline` (fallback: trimmed description).
  - Ratings: micro summary line in the hero stats area (e.g. `4.7 ⭐ (23)` when present, otherwise “No ratings yet”). “Your rating” control available for logged-in users.
  - **Headline stats row (compact 3 items):** total catches, catches in last 30 days, heaviest catch (weight + species).
  - CTAs: View on maps, Visit website, Call venue, Book now, Log a catch (if logged-in), Edit/Manage (admin/owner).
- **Right column (primary visual):**
- Prefer a venue hero photo from `venue_photos` (and in future a dedicated hero/cover image field), falling back to a featured catch image.
  - Fallback: featured catch card (heaviest or editor-picked).
  - Fixed aspect ratio, responsive; stacks below on mobile.
- **Do NOT show:** most active angler, ticket pill, raw catch stat line in the hero.
- **Data sources:** admin/owner fields (short_tagline, website_url, booking_url, contact_phone, optional hero image) + community stats (venue_stats, top catch).

### 3. About Section

- Heading: “About {Venue name}”.
- Body: freeform description (admin/owner field); fallback to tagline.
- Optional basic info (future fields): address/town/postcode, water type, opening times.
- Editable only via Edit/Manage venue.

### 4. “Plan your visit” Section

- **Subsections:**
  - **Tickets & pricing (admin/owner):**
    - Ticket types (Day ticket, 24hr, Season, Membership).
    - Price snippet (`price_from`, normalised with `getDisplayPriceFrom`).
    - “Pre-book only” vs “Walk-on” (future boolean/enum).
  - **Booking & contact:**
    - Phone, email (future), website_url, booking_url, social links (FB/IG future).
  - **Key rules (future):**
    - Night fishing allowed, max rods, 1–2 key bans (short list/booleans).
  - **Facilities & access:**
    - `facilities[]`, `best_for_tags[]`, deduped.
- **Visibility:** render if any of the above exists; show subtle admin/owner hints when empty.
- **Fields needing future migrations:** email, social links, rules booleans, water type, opening times.

### 5. Photos & Media

- **Venue gallery (admin/owner-managed):**
  - Data: `venue_photos` (table from 2078).
  - Desktop: grid with consistent aspect ratios; mobile: horizontal scroll.
  - Lightbox on click (or open in new tab as first step).
  - “View all photos” link can reuse lightbox/modal (no new route required yet).
- **Community photos:** simple strip from recent catch images at this venue.
- **Public page is read-only:** uploads/reordering happen in Edit/Manage venue.
- **Empty state:** “No photos yet. Owners can upload photos from the Manage venue page.” (shown subtly to admins/owners).

### 6. Community Catches Feed

- Full-width section using CatchCard (same as main feed).
- Data: `get_venue_recent_catches` with pagination.
- Layout: 1 column mobile, multi-column desktop; “Load more” + “View all catches from this venue” (feed with venue filter).
- CTA for logged-in users: “Log a catch at this venue.”
- Purely community-derived; no admin editing here.

### 7. Leaderboard & Records

- Mini-leaderboard matching homepage styling.
- Data: `get_venue_top_catches` (client-side species filter).
- Show top 3 (after filter): rank badge, weight + species, angler avatar/username, date, “View catch”.
- Species filter: “All species” + unique species in top catches.
- Future: per-species records can build on this.

### 8. Events & Announcements (conditional)

- Data: `get_venue_upcoming_events`, `get_venue_past_events`.
- Render only if at least one event exists (upcoming or past).
- Tabs: Upcoming / Past; cards with title, type badge, date/time, description, ticket info, booking/website CTA.

### 9. Venue Ratings & Reviews (Phase 2 plan)

- **Backend (future):** `venue_ratings` table (avg + count; per-user rating 1–5 + optional text).
- **UI (future-ready):**
  - Summary: average stars + count near the hero/stats area.
  - “Your rating” control for logged-in users (stars + optional short text).
  - Simple review list: rating, text, avatar, username, date.
- Call out as Phase 2 so we don’t over-scope current implementation.

### 10. Owner / Admin-only Notes

- Owners/Admins control:
  - Description / “Visiting Us” copy.
  - Tickets & pricing.
  - Rules/policies (future).
  - Facilities & access.
  - Hero/gallery photos.
  - Contact & social links.
- Public page:
  - Show Edit/Manage buttons in hero.
  - Subtle hints when data is missing (visible only if `isOwner || isAdmin`), e.g. “Add ticket info from Manage venue”.
  - No inline editing or uploads.

### 11. Future Enhancements (out of scope for v2)

- Q&A / discussion thread.
- Owner quick widgets on the venue page.
- Weather & water conditions.
- Nearby venue recommendations.
- Deeper analytics (graphs for baits/species/seasonal trends).
- Map view for /venues and distance-based sorting.
- Save/Favourite venues.

### 12. Cross-page interactions

These flows are already implemented and should be preserved when iterating on the venue experience:

- **From venue → add catch**

  - The “Log a catch at this venue” CTA in the hero links to `/add-catch?venue={slug}`.
  - The Add Catch page reads the `venue` query param, resolves the slug to a `venue_id`, and pre-fills the venue selector / session venue. Anglers can still change the venue manually before submitting.

- **From venue → feed**
  - The “View all catches from this venue” CTA in the Community Catches section links to `/feed?venue={slug}`.
  - The feed page reads the `venue` query param, filters catches by `venue_id`, and shows a banner like “Catches from {Venue name} – You’re viewing catches logged at this venue.” with a “Clear filter” button that removes the venue filter and returns to the global feed.

---

## C. How to use this spec

- Codex should read this file before planning or implementing `/venues` or `/venues/:slug`.
- Align UI with:
  - Section order and content per section.
  - Field ownership (admin/owner vs community).
  - Visibility rules (when to hide/show sections).
- Reuse existing components and RPCs:
  - CatchCard, leaderboard styles, buttons, chips, avatars.
- RPCs: `get_venues`, `get_venue_by_slug`, top catches/anglers, recent catches, events, photos (with stats coming from the `venue_stats` view).
- Keep editing in admin/owner flows; public page is read-only with hints only.
- If implementation needs to diverge, update this spec first or mark it as a future phase (v3) rather than silently changing behaviour.

### Implementation status (as of 2025-12-01)

- **Implemented in v2:**

  - Hero layout with breadcrumb, name, location, tagline, CTAs, and featured image card.
  - Ratings surfaced on venue detail hero as a micro summary (avg + count) with “Your rating” control backed by venue_ratings/venue_stats.
  - About section using owner/admin-managed description/tagline.
  - “Plan your visit” / socials & contact block with ticket type, price snippet, website/booking buttons, phone, and facilities/best-for chips.
  - Venue gallery backed by `venue_photos` with catch-photo fallback (public page is read-only).
  - Community Catches feed using `CatchCard`, with “View all catches from this venue” linking to `/feed?venue={slug}` and a venue-aware feed banner.
  - “Log a catch at this venue” CTA linking to `/add-catch?venue={slug}` with venue prefill in the Add Catch flow.
  - Mini-leaderboard for top catches (top 3 after species filter) styled to match the homepage leaderboard.
  - Events section using upcoming/past RPCs, shown only when events exist.

- **Planned / not yet implemented:**
  - Venue ratings & reviews (`venue_ratings` table, rating summary, “Your rating” UI, review list, breakdown).
  - Ratings on venue cards in the directory and related sort/filter options.
  - Rich basic info on the venue page: address/town/postcode, water type, opening times.
  - Rules & key policies block (night fishing, max rods, key bans, walk-on vs pre-book).
  - Q&A / discussion per venue (questions, answers, upvotes, pinned info).
  - Owner/admin quick panel on the venue page (catches this week, latest review, pending questions).
  - Advanced directory filters and sorts (ratings-based, distance-based, “Trending” strips, map view).
  - Save/favourite venues and richer social gestures on venue cards.
