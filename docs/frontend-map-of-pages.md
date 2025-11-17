ReelyRated Frontend Map (Pages, Hooks, Components)

This document is a quick reference for how the frontend is structured and how it talks to Supabase.
Use it when working with AI tools (Codex / ChatGPT / Claude) so they have context without needing the full repo.

⸻

1. Pages

src/pages/Index.tsx – Homepage

Route: /
Purpose: Landing page, “at a glance” stats and featured content.

Key features:
• Hero card with a highlighted catch (uses leaderboard data).
• “Active anglers” count:
• Counts rows in public.profiles.
• Must work for both anon and authenticated roles.
• Mini leaderboard:
• Top N entries from leaderboard_scores_detailed view.
• Shows species, weight, angler, etc.
• CTA buttons:
• Links to feed, leaderboard, sign-in/up, etc.

Supabase usage (high level):
• profiles (count only, via SELECT with { count: "exact", head: true }).
• leaderboard_scores_detailed for the hero + mini leaderboard.

⸻

src/pages/Profile.tsx – Public Profile

Route: /profile/:idOrUsername
Purpose: Public-facing profile page for an angler.

Key features:
• Displays username, avatar, bio.
• Follow / unfollow button.
• Follower and following counts.
• Grid/list of recent catches by this user (with rating summaries).
• Links through to catch detail pages.

Supabase usage:
• profiles
• select("id, username, avatar_path, avatar_url, bio") by id or username.
• catches
• select("id, title, image_url, weight, weight_unit, species, created_at, ratings (rating)") filtered by user_id.
• profile_follows
• Count followers.
• List followed profiles (join back to profiles).
• Insert/delete for follow/unfollow.

⸻

src/pages/ProfileSettings.tsx – Account / Profile Settings

Route: /settings/profile
Purpose: Manage own profile + auth details.

Key features:
• Edit username, full name, avatar, bio.
• Update email/password (through Supabase Auth).
• Sign out.

Supabase usage:
• profiles
• select("username, full_name, avatar_path, avatar_url, bio") for current user.
• update({ username, full_name, avatar_path, bio, updated_at }) by id = user.id.
• supabase.auth
• getUser, updateUser({ email }), signInWithPassword, signOut.

⸻

src/pages/AddCatch.tsx – Add Catch Form

Route: /catch/new
Purpose: Main form for logging a catch.

Key features:
• Choose or create a session (with date/venue).
• Upload images to storage (catches bucket).
• Select bait, method, water type from lookup tables.
• Set metadata: title, species, weight/length, conditions, time of day, visibility, etc.
• Submit to public.catches.

Supabase usage:
• Lookups:
• tags – category = 'method' (methods).
• baits.
• water_types.
• Sessions:
• sessions.select("id, title, venue, date").eq("user_id", user.id).
• Optional sessions.insert(...) for quick session creation.
• Storage:
• supabase.storage.from("catches").upload(...).
• Catches:
• catches.insert({...}) with fields including:
• Basic: user_id, image_url, title, description, location.
• Normalised: location_label, species_slug, custom_species, water_type_code, method_tag.
• Numbers: weight, weight_unit, length, length_unit.
• Other: peg_or_swim, caught_at, time_of_day, conditions (JSONB), tags[], gallery_photos[], video_url, visibility, hide_exact_spot, allow_ratings, session_id.

⸻

src/pages/Feed.tsx – Global Feed

Route: /feed
Purpose: Scrollable list of catches across the community.

Key features:
• Lists recent catches ordered by created_at.
• Shows owner info, basic stats, reactions and comment count.
• Can filter/scope by “following” using profile_follows.

Supabase usage:
• catches
• select("\*, profiles:user_id (...), ratings (rating), comments:catch_comments (id), reactions:catch_reactions (user_id)")
• Filter: deleted_at IS NULL.
• profile_follows
• Get list of following_id to build “following” filter.

⸻

src/pages/LeaderboardPage.tsx – Top 100 Leaderboard

Route: /leaderboard
Purpose: Full leaderboard view (Top 100).

Key features:
• Uses leaderboard_scores_detailed view.
• Shows rank, angler, species, weight, location, method, rating stats.
• Species/location/method columns use the view’s normalised fallback columns:
• Species: species_slug → species → “Unknown”.
• Location: location_label.
• Method: method_tag → method → “—”.

Supabase usage:
• leaderboard_scores_detailed
• View already filters visibility = 'public' and deleted_at IS NULL.
• Exposes:
• id, user_id, owner_username, title
• species_slug, species, weight, weight_unit
• length, length_unit
• total_score, avg_rating, rating_count
• created_at
• location_label, location
• method_tag, method
• water_type_code
• description, gallery_photos, tags, video_url, conditions, caught_at.

⸻

src/pages/Sessions.tsx – Sessions List

Route: /sessions
Purpose: Manage sessions (trips) and see basic stats per session.

Key features:
• List of user’s sessions.
• Shows date, venue, note, and catch count per session.
• Links to session-based filtered views (where used).

Supabase usage:
• sessions
• select("id, title, venue, date, notes, created_at, catches:catches_session_id_fkey(count)")
• Filtered by user_id = current user.

⸻

src/pages/Insights.tsx – Angler Insights / Analytics

Route: /insights
Purpose: User’s personal stats dashboard.

Key features:
• Catches over time (per month / period).
• Breakdown by venue, species, bait/method, time of day.
• Uses raw and normalised fields from catches and sessions.

Supabase usage:
• catches
• select("id, created_at, caught_at, weight, weight_unit, location, bait_used, method, time_of_day, conditions, session_id, species")
• Derives additional insights client-side; uses location_label, method_tag etc. when present.
• sessions
• select("id, title, venue, date, created_at").eq("user_id", user.id).

⸻

2. Hooks

src/hooks/useLeaderboardRealtime.ts

Purpose: Shared data source for leaderboard UI (homepage + Top 100 + hero).

Behaviour:
• Queries leaderboard_scores_detailed with:
• Full column list: IDs, names, species, raw/normalised fields, scoring fields.
• Orders by total_score DESC, then created_at, then id.
• Optional .eq("species_slug", selectedSpecies) filter.
• Normalises numeric fields (total_score, avg_rating, rating_count, weight, length).
• Subscribes to realtime changes on public.catches and refetches on insert/update/delete.

⸻

src/hooks/useNotifications.ts

Purpose: Central hook for notifications UI and state.

Behaviour:
• Loads notifications:
• notifications.select("\*").eq("user_id", userId).order("created_at", desc).
• Exposes:
• markNotificationAsRead
• markAllNotificationsAsRead
• clearAllNotifications
• Subscribes to realtime changes on notifications filtered by user_id.
• Uses RPC create_notification indirectly via helper functions (see below).

⸻

src/hooks/useCatchData.ts and src/hooks/useCatchInteractions.ts

Purpose: Catch detail page data and interactions.

Data (useCatchData):
• catches with:
• select("\*, profiles:user_id (...), session:session_id (id, title, venue_name_manual, date)") by id.
• ratings, catch_reactions, profile_follows, catch_comments (with nested profile).

Interactions (useCatchInteractions):
• Delete catch (owner).
• Follow/unfollow owner.
• Add/remove reaction.
• Add rating.
• Trigger notifications via RPC.

⸻

3. Components

src/components/Leaderboard.tsx

Purpose: Homepage mini leaderboard component.
• Renders a subset of LeaderboardEntry from useLeaderboardRealtime.
• Displays rank, species, weight, angler, etc.
• Uses helper functions like formatSpeciesLabel.

⸻

src/components/HeroLeaderboardSpotlight.tsx

Purpose: Hero spotlight catch on the homepage.
• Uses useLeaderboardRealtime (or a similar fetch) to pick a top entry.
• Shows big image, species pill, angler username, stats.
• Species badge uses the normalised species field:
• species_slug (with a formatter) and/or fallback to raw species.

⸻

Notifications components
• src/components/NotificationsBell.tsx
• Shows unread count in the header.
• Opens dropdown with notifications list.
• Uses useNotifications + resolveNotificationPath for navigation.
• src/components/ProfileNotificationsSection.tsx
• Displays notifications on the profile page (or user dashboard-like area).
• Also uses useNotifications.
• src/components/notifications/NotificationListItem.tsx
• Renders a single notification row.
• Uses resolveNotificationPath to decide where the “View” action navigates:
• Catch detail for catch-related notifications.
• Actor profile for follow-type notifications.
• Other types (e.g. admin_report) as defined in utils.

⸻

4. Notification Helpers / Routing

src/lib/notifications-utils.ts

Purpose: Routing + formatting for notifications.

Key behaviours:
• resolveNotificationPath(notification):
• If notification.catch_id is present and type is one of:
• new_comment, mention, new_reaction, new_rating
• → return /catch/<catch_id>.
• For new_follower (and similar profile-only types):
• Fallback to actor profile path: /profile/<actor_username or id>.
• admin_report / other special cases:
• Can use extra_data (e.g. report_id) for future admin routing.

⸻

5. How to Use This With AI

When asking an AI model to work on ReelyRated frontend:
• Mention the relevant file(s) from this doc.
• If you paste code, include just those files or sections, not the entire repo.
• Cross-check any schema changes or queries against:
• ERD.md
• supabase/migrations/\*.sql
• src/integrations/supabase/types.ts
