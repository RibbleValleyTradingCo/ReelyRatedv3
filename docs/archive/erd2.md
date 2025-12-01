# ReelyRated ERD v3 (consolidated)

This document consolidates the original ERD (intent) with the current implemented state. ERD.md remains the long-form source of truth; this file combines it with the incremental updates captured in erdv2.md.

---

## Core entities and behaviour (from ERD.md)
- **profiles:** user identities with avatar fields; used across catches, comments, notifications, follows.
- **admin_users / is_admin:** marks admins; used in RLS/overrides and badges.
- **sessions:** trips; used by Add Catch flows.
- **catches:** main content; visibility (`public`/`followers`/`private`), soft delete via `deleted_at`.
- **profile_follows:** follow graph; used for follower visibility and counts.
- **catch_comments:** threaded comments via `parent_comment_id`; soft delete via `deleted_at`.
- **catch_reactions:** likes; deduped notifications.
- **ratings:** 1–10 scale; self-rating blocked; allow_ratings respected.
- **notifications:** table with enum `notification_type`; used for comment/like/follow/rating/admin flows.
- **reports / user_warnings / moderation_log:** moderation structures.
- **rate_limits:** per-action logging and enforcement via helpers/RPCs.
- **leaderboard_scores_detailed:** view for leaderboard/homepage hero.
- **Other lookups:** venues, species, baits, tags, water_types, user_insights_view (future/Phase 3+ in UI).

---

## Notifications (current)
- **Types in use:** `new_comment`, `mention`, `new_reaction`, `new_rating`, `new_follower`, plus admin types (`admin_report`, `admin_warning`, `admin_moderation`).
- **Dedupe:** Only `new_reaction` and `new_follower` dedupe via `uq_notifications_like_follow_once`. `new_comment` and `mention` are one-row-per-event.
- **Routing:** Comment-related types deep-link to `/catch/:catchId?commentId=:commentId` when a comment_id is present; otherwise to `/catch/:catchId`. Follow-type falls back to actor profile; admin types route per notifications-utils.
- **Creation:** In `create_comment_with_rate_limit` (non-blocking):
  - `new_comment` to catch owner (skip self, skip deleted catches).
  - `mention` to mentioned users (see Mentions section).
- **Non-blocking:** Notification failures never abort comment insert.

---

## Comments (current)
- **Threading:** `parent_comment_id` supports threaded replies; UI renders two-level layout. Soft delete via `deleted_at`; admins can view deleted content.
- **Admin badge:** View `catch_comments_with_admin` exposes `is_admin_author` via `public.is_admin(user_id)`; badges are author-based and visible to all.
- **Rate limits:** Non-admins limited (20/hour) via `check_rate_limit` + `rate_limits` logging; admins bypass both.
- **Visibility:** RLS enforces catch visibility (public/followers/private) and owner/admin access.
- **Notifications:** Owner gets `new_comment` per comment (skip self).

---

## Mentions (current)
- **Parsing:** Regex `@([A-Za-z0-9_.]+)` on trimmed body in `create_comment_with_rate_limit`.
- **Resolution:** Case-insensitive match to `profiles.username`; distinct usernames per comment.
- **Skips:** Self and catch owner (owner already notified via `new_comment`).
- **Visibility gates:**  
  - Public: allow all mentioned users.  
  - Followers: allow owner, admins, or followers of catch owner.  
  - Private: allow owner or admins only.  
- **Notifications:** `mention` type with `catch_id`, `comment_id`, `mentioned_username` in `extra_data`; non-blocking.
- **Autocomplete data:** View `catch_mention_candidates` (owner + commenters per catch with `last_interacted_at`), used by the comments hook; UI autocomplete WIP.

---

## Admin visibility & badges
- **Source:** `admin_users` + `public.is_admin`.
- **Exposure:** Admin author flag computed in views; badges shown to all viewers based on `is_admin_author`, not viewer role.
- **Policies:** SELECT on `admin_users` allows resolving admin flags; write access remains restricted.

---

## Rate limits
- **Comments:** 20/hour for non-admins; admins bypass; logging to `rate_limits`.
- **Reports:** Client-side limit (5/hour) + RPC enforcement (per prior migrations).

---

## Mention candidates view
- **View:** `catch_mention_candidates`
  - Includes catch owner and all distinct commenters per catch.
  - Columns: `catch_id, user_id, username, avatar_path, avatar_url, last_interacted_at` (max of catch created_at or latest comment by that user).
  - Inherits existing RLS on catches/catch_comments; does not broaden access.

---

## Status of other entities vs. ERD
- **Implemented:** profiles, profile_follows, catches, catch_reactions, ratings, leaderboard_scores_detailed; visibility/follower fixes applied.
- **Partial:** reports, user_warnings, moderation_log (tables/RPCs exist; full admin UI/workflows pending).
- **Minimal/Pending (Phase 3+):** venues, species, baits, tags, water_types, user_insights_view (schemas likely present; UI/flows minimal).

---

## References
- Original spec: ERD.md (authoritative design intent).
- Incremental updates: erdv2.md (now folded into this doc).
- Frontend map: docs/frontend-map-of-pages.md (routing/components overview). 
