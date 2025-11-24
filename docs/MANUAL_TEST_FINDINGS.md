# ReelyRated – Manual Test Findings

## 1. Overview

Core auth and public catch flows work, but followers-only visibility, admin detection/visibility, ratings enforcement, and notification noise are broken. Moderation UI and comment threading/deletion are missing. A few UX gaps (visibility labels, image requirement, username error clarity) slow testers down.

## 2. Bugs (behaviour wrong vs ERD)

- **BUG-FOLLOWERS-VISIBILITY** (Tests: CATCH-02, FEED-01A)  
  - Symptoms: Followers cannot see follower-only catches.  
  - Likely cause: Feed/profile queries or RLS are not considering `profile_follows` when `catches.visibility = 'followers'`.  
  - Impact: Follower-only sharing is effectively broken; followers miss intended content.

- **BUG-FOLLOWER-COUNT-DESYNC** (Tests: CATCH-02, FOLLOW-01)  
  - Symptoms: Owner sees 0 followers while follower view shows the correct count.  
  - Likely cause: Counting query/view not matching `profile_follows` (owner vs viewer path divergence or cache).  
  - Impact: Social proof and follow feedback are unreliable for the owner.

- **BUG-ADMIN-DETECTION** (Tests: CATCH-03, FEED-01C, ADMIN-01)  
  - Symptoms: Admin user has no admin menu; cannot see follower/private catches; admin reports and moderation views inaccessible.  
  - Likely cause: `admin_users` lookup not wired through auth context/claims; UI never renders admin routes; RLS not granting admin override visibility.  
  - Impact: Admin moderation is impossible; admins see only public content.

- **BUG-AVATAR-UPLOAD** (Test: PROF-01)  
  - Symptoms: Avatar upload fails with “Couldn't upload image. Try a smaller file.”  
  - Likely cause: Missing/incorrect `avatars` storage bucket or storage policy; upload not writing to `profiles.avatar_path`.  
  - Impact: Users cannot set avatars, leaving profiles incomplete.

- **BUG-RATING-SELF** (Test: RATE-02)  
  - Symptoms: Users can rate their own catches.  
  - Likely cause: `rate_catch_with_rate_limit` (or equivalent) not blocking `catch.user_id = auth.uid()`; UI still renders rating control for owner.  
  - Impact: Ratings/leaderboard can be gamed; violates ERD rule that self-rating is disallowed.

- **BUG-RATING-FLAKY** (Test: RATE-01)  
  - Symptoms: Rating another user’s catch sometimes fails (“Failed to add rating”), sometimes works.  
  - Likely cause: RPC/RLS inconsistency or constraint mismatch (ERD expects integer 1–10); possible allow_ratings flag or visibility check misfiring.  
  - Impact: Ratings are unreliable; users see intermittent errors.

- **BUG-LIKE-NOTIF-SPAM** (Tests: REACT-01, NOTIF-01)  
  - Symptoms: Toggling likes sends multiple notifications to the owner.  
  - Likely cause: Notification insert lacks idempotency/upsert per `(catch_id, actor_id, type)` or dedupe guard.  
  - Impact: Notification spam; inbox noise undermines trust.

## 3. Missing features (ERD says yes, app currently no)

- **MISSING-COMMENT-THREADING** (Tests: COMM-02; ERD: `catch_comments.parent_comment_id`)  
  - No reply option or nested display; threads not implemented.

- **MISSING-COMMENT-SOFT-DELETE** (Tests: COMM-03; ERD: `catch_comments.deleted_at`, owner-only update/delete)  
  - Users cannot delete their own comments; no soft delete UI or API hook.

- **MISSING-ADMIN-FLOWS** (Tests: ADMIN-02, ADMIN-03; ERD: `reports`, `user_warnings`, `moderation_log`, admin override on `catches`/`catch_comments`)  
  - No admin UI to review reports, delete/restore catches/comments, or issue warnings.

- **MISSING-NOTIFICATION-DELETE** (Test: NOTIF-03; ERD: `notifications.deleted_at`)  
  - No way to delete/clear notifications despite schema support.

## 4. UX improvements (clarity / nice-to-have)

- **UX-VISIBILITY-BADGES** (Tests: CATCH-03, FEED-01A)  
  - Expected: Catch cards visibly labelled as Public / Followers / Private (per ERD visibility semantics).  
  - Current: No clear badge; owners/followers can’t tell why items are hidden or visible.  
  - Why confusing: Makes debugging visibility impossible and erodes trust in privacy settings.

- **UX-IMAGE-REQUIRED-PROMPT** (Test: CATCH-03)  
  - Expected: Explicit “Add a main image to submit” prompt when required.  
  - Current: Submit button is disabled/greyed with no guidance.  
  - Why confusing: Users stall without knowing the blocker.

- **UX-USERNAME-ERROR-MESSAGE** (Test: PROF-01)  
  - Expected: Clear “Username already taken” error on duplicate.  
  - Current: Generic “Unable to save profile changes” toast.  
  - Why confusing: Users don’t know which field failed, leading to retries/abandonment.

- **UX-NOTIF-DELETE-DISCOVERABILITY** (Test: NOTIF-03)  
  - Expected: Visible delete/clear control matching `notifications.deleted_at` capability.  
  - Current: No delete affordance; behaviour unclear.  
  - Why confusing: Users cannot manage inbox clutter or trust retention behaviour.
