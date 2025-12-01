# Comments + Mentions – Current State (Phase 1)

## Goals

- Clean, Facebook-style comment threads on catch detail pages.
- Soft-delete, admin view, OP/Admin badges.
- Per-comment notifications (new_comment, mention, etc.).
- Deep-link to specific comments from notifications.

## Data model (backend)

- `catch_comments`:
  - `id`, `catch_id`, `user_id`, `body`, `parent_comment_id`, `deleted_at`, timestamps.
- `catch_comments_with_admin` (view):
  - `catch_comments.*` + `is_admin_author` via LEFT JOIN to `admin_users`.
- `catch_mention_candidates` (view, 2041_mention_candidates_per_catch.sql):

  - For each `catch_id`: owner + commenters, with `username`, `avatar_path`, `avatar_url`, `last_interacted_at`.

- `notification_type` enum:

  - `admin_moderation`, `admin_report`, `admin_warning`, `mention`, `comment_reply`, `new_comment`, `new_follower`, `new_rating`, `new_reaction`.

- `create_comment_with_rate_limit` (public):
  - Validates visibility and parent.
  - Admin bypass for rate limits; non-admins logged in `rate_limits`.
  - Inserts into `catch_comments`.
  - Sends `new_comment` to catch owner (non-blocking).
  - Parses `@username` mentions and sends `mention` notifications to eligible users (non-blocking).

## Frontend

- `src/hooks/useCatchComments.ts`:

  - Fetches from `catch_comments_with_admin`.
  - Builds threaded tree (roots new→old, replies old→new).
  - Supports optimistic add/delete and background refetch.
  - Returns `mentionCandidates` from `catch_mention_candidates`.

- `src/components/CatchComments.tsx`:

  - Renders:
    - Comments card with count.
    - Root threads + replies block.
    - “View more replies” per root.
    - “Load more comments” for top-level.
    - OP/Admin badges.
    - Reply context (“Replying to @user” + optional snippet).
    - Comment and reply composers + inline error states.
    - Report button with acknowledgement.
  - Handles:
    - Deep-link via `commentId` query param (expands pagination, scrolls, highlights).
    - Soft-delete tombstones for normal users; full body for admins.

- Notifications:
  - `NotificationListItem`:
    - `mention` → text “@actor mentioned you in a comment” and deep-link to `/catch/:catchId?commentId=:commentId`.

## Open TODOs (Phase 2)

- Implement @mention autocomplete in top-level comment box using `mentionCandidates` (then expand to replies).
- Add keyboard navigation for the suggestion list.
- (Future) Expand mention candidate pool beyond owner + commenters (e.g. followers).
