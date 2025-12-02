ReelyRated Frontend Map (Pages, Hooks, Components)

Quick reference for how the frontend is structured and how it talks to Supabase. Use it when working with AI tools so they have context without scanning the full repo. Lenses: consumer experience (feed/catches), profiles, venues, admin, and cross-cutting safety (privacy, blocks, deletion).

⸻

1. Overview
- Purpose: high-level map of routes, key UI states, and the RPCs/views they rely on.
- Core areas: homepage/feed/catches, profiles (public + settings), venues (public + admin), admin tools, safety/identity (privacy, blocks, deletion), and notification plumbing.

⸻

2. Pages

src/pages/Index.tsx – Homepage  
Route: /  
Purpose: Landing page with “at a glance” stats and featured content.  
Key features: hero with highlighted catch (leaderboard data), “Active anglers” count, mini leaderboard, CTAs to feed/leaderboard/auth.  
Supabase: profiles (count with head/exact), leaderboard_scores_detailed (hero + mini leaderboard).

src/pages/Profile.tsx – Public profile (container)  
Route: /profile/:idOrUsername  
Purpose: Public-facing profile; now a container composing presentational components (ProfileHero, ProfileCatchesGrid, ProfileAnglerStatsSection, ProfileFollowingStrip, ProfileDeletedStub, ProfileBlockedViewerStub, ProfileAboutStaffCard, ProfileAdminModerationTools).  
States: normal angler (stats/catches/following), private profile (follower vs non-follower gating), deleted stub, blocked-viewer stub (owner blocked viewer), admin profile (public view vs admin self: staff badge, about-staff card, no social CTAs), admin self moderation home.  
Supabase: profiles, catches, profile_follows, profile_blocks, follower counts, admin check (admin_users), block RPCs (block_profile/unblock_profile), follow RPC (follow_profile_with_rate_limit), views/RPCs used by the container to load stats/following and enforce block/priv flags.

src/pages/ProfileSettings.tsx – Account / profile settings  
Route: /settings/profile  
Purpose: Manage own profile/auth. Includes privacy toggle (profiles.is_private) and account deletion flow.  
Key features: edit username/full name/avatar/bio; update email/password via supabase.auth; privacy toggle; account deletion request calls request_account_deletion(p_reason), signs out, redirects to /account-deleted.  
Supabase: profiles select/update, supabase.auth getUser/updateUser/signOut, request_account_deletion RPC.

src/pages/AccountDeleted.tsx – Account deletion confirmation  
Route: /account-deleted  
Purpose: Confirmation page after deletion request; simple CTAs. No Supabase calls (RPC already ran).

src/pages/AddCatch.tsx – Add catch form  
Route: /add-catch  
Purpose: Log a catch (sessions, metadata, storage upload).  
Supabase: tags (methods), baits, water_types, sessions (select/insert), storage (catches bucket), catches.insert with full metadata (location/species/weights/conditions/visibility/etc.).  
Legacy route: /catch/new now redirects to /add-catch.

src/pages/Feed.tsx – Global feed  
Route: /feed  
Purpose: Recent catches list; optional “following” filter.  
Supabase: catches with profiles, ratings, catch_comments (ids), catch_reactions; filter deleted_at IS NULL; profile_follows for “following” scope; includes venue_id fields where present.

src/pages/LeaderboardPage.tsx – Top 100 leaderboard  
Route: /leaderboard  
Purpose: Full leaderboard using leaderboard_scores_detailed (already filtered for visibility/deletes).  
Supabase: leaderboard_scores_detailed (rank/species/weight/normalised fields/score/avg_rating/etc.).

src/pages/Sessions.tsx – Sessions list  
Route: /sessions  
Purpose: Manage user sessions.  
Supabase: sessions select (title/venue/date/notes/created_at, catches count) filtered by user_id.

src/pages/Insights.tsx – Angler insights  
Route: /insights  
Purpose: Personal stats/analytics.  
Supabase: catches (created_at, caught_at, weight, location, bait, method, time_of_day, conditions, session_id, species, normalised fields), sessions (title/venue/date/created_at by user).

src/pages/VenuesIndex.tsx – Venues directory  
Route: /venues  
Purpose: Venue discovery (cards aimed at conversion/bookability).  
Key features: search + pagination; cards show venue name/location/tagline (short_tagline/description fallback), ticket_type badge overlaid on the thumbnail, price_from, chips from metadata (best_for_tags, facilities), stats from venue_stats (total/recent catches) with an optional flame icon on the “Last 30 days” tile for hot venues, top_species, and thumbnails (venue photo → recent catch image fallback → placeholder). Bottom strip is price only plus “View venue” CTA. Filters/sort are client-side: ticket type (all/day ticket/syndicate/club), carp-friendly toggle (best_for contains “carp”), sort by name/most catches/most active.  
Supabase: get_venues RPC (SECURITY INVOKER; returns id, slug, name, location, short_tagline, ticket_type, price_from, best_for_tags, facilities, total_catches, recent_catches_30d, headline_pb_* fields, top_species; avg_rating/rating_count now available via venue_stats but not yet used on the cards), get_venue_photos (first image_path for thumbnail), get_venue_recent_catches (image_url fallback thumbnail).

src/pages/VenueDetail.tsx – Venue detail  
Route: /venues/:slug  
Purpose: Main venue page (hero + leaderboards + events).  
Key features: hero with name/location/tagline and CTAs (maps/website/booking/call/log catch/edit/manage); stats (total_catches, recent_catches_30d, heaviest catch) and top_species; photo gallery using venue photos with recent-catch fallback; events tabs (upcoming/past); community catches grid; mini-leaderboard from top catches; top anglers currently fetched but not rendered.  
Supabase: get_venue_by_slug (metadata + stats including avg_rating/rating_count, not yet rendered), get_venue_recent_catches (community grid), get_venue_top_catches (mini-leaderboard), get_venue_top_anglers (fetched, not shown), get_venue_upcoming_events, get_venue_past_events (events tabs), get_venue_photos (gallery). Rating RPCs upsert_venue_rating and get_my_venue_rating exist but are not yet used on the page.

src/pages/AdminVenuesList.tsx – Admin venues list  
Route: /admin/venues (admin-only)  
Purpose: Admin list/search of venues; jump to edit/public page; shows stats summary.  
Supabase: get_venues RPC (uses id, slug, name, location, short_tagline, total_catches, recent_catches_30d; avg_rating/rating_count now present but not used in the list UI); admin gating via admin_users check in UI.

src/pages/AdminVenueEdit.tsx – Admin venue edit  
Route: /admin/venues/:slug (admin-only)  
Purpose: Manage venue metadata and events.  
Key features: edit metadata (tagline, ticket_type, price_from, tags/facilities, URLs, contact, internal notes); manage events (create/update/delete, publish/unpublish) with status (draft/upcoming/past); link to public page.  
Supabase: get_venue_by_slug (returns avg_rating/rating_count but not used in the form), admin_update_venue_metadata, admin_get_venue_events, admin_create_venue_event, admin_update_venue_event, admin_delete_venue_event.

src/pages/MyVenues.tsx – Owner venue list  
Route: /my/venues  
Purpose: List of venues assigned to the current owner.  
Supabase: direct select on venue_owners with embedded venues (id, slug, name, location, short_tagline, price_from); no venue_stats/rating fields used.

src/pages/MyVenueEdit.tsx – Manage owned venue (owner-only)  
Route: /my/venues/:slug  
Purpose: Owner venue edit (metadata + events) mirroring admin experience within owner permissions.  
Supabase: get_venue_by_slug (returns avg_rating/rating_count but not used in the form), owner_update_venue_metadata, owner_get_venue_events, owner_create_venue_event, owner_update_venue_event, owner_delete_venue_event.

⸻

3. Hooks

src/hooks/useLeaderboardRealtime.ts  
Purpose: Shared leaderboard source (homepage + Top 100 + hero).  
Behaviour: queries leaderboard_scores_detailed; optional species filter; orders by score/created_at/id; subscribes to realtime changes on catches.

src/hooks/useNotifications.ts  
Purpose: Notifications list + actions.  
Behaviour: loads notifications by user_id, mark read/all, clear all, realtime subscription.

src/hooks/useCatchData.ts / src/hooks/useCatchInteractions.ts  
Purpose: Catch detail data + interactions.  
Behaviour: fetch catch with profile/session/ratings/comments/reactions; delete catch; follow/unfollow owner; reactions/ratings; trigger notifications. RLS/privacy enforced by backend views/RPCs.

⸻

4. Cross-cutting behaviours (privacy, blocks, deletion, admin identity)

- Profile privacy (profiles.is_private): enforced by RLS/views/RPCs for feed/search/venue catches; non-followers can’t see private catches; profile container handles private states; frontend should not bypass RLS.
- Blocks (profile_blocks): RPCs block_profile/unblock_profile + helper is_blocked_either_way; enforced in RLS on catches/comments and comment-creation RPC; UI shows block button/banner on Profile and blocked-viewer stub; blockers don’t see blocked users’ content (feeds/venues/comments).
- Account deletion: RPCs request_account_deletion (user), admin_delete_account (admin); profile fields is_deleted/deleted_at/locked_for_deletion; UI flow in /settings/profile and /account-deleted; deleted-profile stub for non-admins on Profile.
- Admin identity & profiles: admin_users table drives admin bypass/permissions; admin-only RPCs for venues/events/deletion; admin profile UX removes social CTAs, shows staff badge and About Staff card; admin self sees moderation tools.

⸻

5. Notification helpers / routing

src/lib/notifications-utils.ts  
Purpose: resolveNotificationPath and formatting for notifications.  
Behaviour: routes catch-related types to /catch/:id; follow-type to actor profile; admin/special types use extra_data where defined. Components: NotificationsBell, ProfileNotificationsSection, NotificationListItem leverage these paths. (No new notification types beyond current feed/profile/catch/admin-report patterns.)

⸻

6. How to use this with AI

- Reference this doc plus the specific page/component when asking for changes.  
- For anything involving privacy/blocks/deletion/venues, read section 4 first.  
- Prefer existing views/RPCs (SECURITY DEFINER/INVOKER + RLS patterns) over new raw SQL; if adding RPCs, follow existing patterns.  
- Keep hooks order intact in existing components; respect RLS-driven behaviour in UI (no client-side bypasses).
