# ReelyRated – DB Alignment Plan

## 1. Goals & constraints

- ERD (`ERD.md`) is the source of truth for schema, RLS, and behaviour.  
- Target: secure, efficient schema + RLS that matches the app; keep migrations clean to allow safe branching.  
- Constraints: avoid rewriting existing migrations; append new ones unless a small, surgical tweak is unavoidable.  
- Preserve working areas: core auth, basic catch creation, basic follows, basic notifications should not regress.

## 2. Phase 1 – Critical functional fixes

- Followers-only visibility enforcement (BUG-FOLLOWERS-VISIBILITY)  
  - ERD: `catches.visibility`, `profile_follows`, RLS summary.  
  - Expectation: followers can see follower-only catches; strangers cannot.  
  - Likely work: DB (RLS/policies/joins or view filters) + Frontend (feed/profile queries include follow context).

- Follower count consistency (BUG-FOLLOWER-COUNT-DESYNC)  
  - ERD: `profile_follows` unique pairs.  
  - Likely work: DB (count query/view correctness) + Frontend (display consistent count source).

- Admin detection & override visibility (BUG-ADMIN-DETECTION)  
  - ERD: `admin_users`, admin override on `catches`/`catch_comments`/reports/warnings.  
  - Likely work: DB (policies/claims for admin bypass) + Frontend (load admin flag, render admin menu/routes).

- Ratings enforcement & stability (BUG-RATING-SELF, BUG-RATING-FLAKY)  
  - ERD: `ratings` (1–10 integer, no self-rating), `rate_catch_with_rate_limit` RPC, allow_ratings flag.  
  - Likely work: DB (RPC/policies/constraints) + Frontend (hide/disable rating on own catch; robust error handling).

- Notification dedupe for likes (BUG-LIKE-NOTIF-SPAM)  
  - ERD: `notifications` schema; expectation of one notification per actor/action.  
  - Likely work: DB (upsert/unique guard) + Frontend (idempotent trigger).

- Avatar upload reliability (BUG-AVATAR-UPLOAD)  
  - ERD: `profiles.avatar_path/avatar_url`.  
  - Likely work: Storage/DB (create bucket + policy) + Frontend (surface storage errors clearly).

## 3. Phase 2 – Missing but important features

- Threaded comments (MISSING-COMMENT-THREADING)  
  - ERD: `catch_comments.parent_comment_id`.  
  - Work: DB (ensure column, policies allow replies) + Frontend (reply UI, nested rendering).

- Delete/soft-delete own comment (MISSING-COMMENT-SOFT-DELETE)  
  - ERD: `catch_comments.deleted_at`, owner-only update/delete.  
  - Work: DB (policy + soft-delete handling in queries) + Frontend (delete affordance, hide soft-deleted).

- Admin moderation flows (MISSING-ADMIN-FLOWS)  
  - ERD: `reports`, `user_warnings`, `moderation_log`, admin override on content visibility.  
  - Work: DB (policies/RPCs for review, delete/restore, warn) + Frontend (admin reports UI, warning issuance).

- Notification delete/clear (MISSING-NOTIFICATION-DELETE)  
  - ERD: `notifications.deleted_at`.  
  - Work: DB (soft delete supported in RPCs) + Frontend (delete action in inbox).

## 4. Phase 3 – UX & rate-limit polish

- Visibility badges on catch cards (UX-VISIBILITY-BADGES). Frontend only.  
- Clear image-required prompt on add catch (UX-IMAGE-REQUIRED-PROMPT). Frontend only.  
- Specific “username taken” error (UX-USERNAME-ERROR-MESSAGE). Frontend + auth error mapping.  
- Notification delete discoverability (UX-NOTIF-DELETE-DISCOVERABILITY) and general inbox clarity. Frontend + existing delete RPC.  
- Rate-limit alignment and messaging: ensure limits match ERD (comments 20/hr, reports 5/hr, reactions/ratings 50/hr, follows 30/hr) and `check_rate_limit` logging is correct. DB (RPC/logging) + Frontend (friendly toasts, no spam).

## 5. Implementation notes for future tasks

- Phase 1  
  - Migrations: Possible policy updates (`catches`, `ratings`, `notifications`, storage policies), maybe helper views for follower counts; keep schema changes additive.  
  - Frontend: Feed/profile queries with follow context; admin flag loading; hide self-rating; dedupe notification triggers; avatar upload error surfacing.  
  - Risks: Changing rating constraints/type requires care; consider dev DB reset if the stored rating scale differs from ERD.

- Phase 2  
  - Migrations: `catch_comments` reply/soft-delete policies; `notifications` delete support; RPCs for admin moderation/warnings; ensure `reports`, `user_warnings`, `moderation_log` tables exist and are policy-aligned.  
  - Frontend: Reply UI, delete comment UI, admin reports/moderation views, warning issuance flows.

- Phase 3  
  - Migrations: Minimal; mostly UI. Rate-limit logging tweaks may touch `rate_limits` RPCs.  
  - Frontend: Badges, validation messaging, notification management UX, polished toasts for rate-limit feedback.  
  - Risks: Policy changes for rate limits should avoid breaking existing successful flows; guard with integration tests where possible.
