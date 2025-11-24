# ReelyRated Manual Test Checklist & Results

This document describes **manual tests** for the ReelyRated web app.

Purpose:

- Walk through key user journeys by hand.
- Check behaviour against `docs/ERD.md`.
- Record what works and what needs fixing.

No automated tooling is required. Tests are run in a browser using test accounts.

---

## 1. Environment & Test Accounts

### 1.1 Environment

- App URL (local): `http://localhost:8080`
- Backend: Supabase hosted project (ReelyRated v3)

### 1.2 Test Accounts

We use four test accounts:

- **User A – Owner**
  - Role: normal user who creates content (sessions, catches, etc.)
  - Email: `test4@test.com`
- **User B – Follower**
  - Role: follows User A to test follower-only visibility
  - Email: `test@test.com`
- **User C – Stranger**
  - Role: does not follow User A (used to test public vs followers vs private)
  - Email: `test3@test.com`
- **User D – Admin**
  - Role: admin user (has a row in `admin_users`)
  - Email: `test2@test.com`

Common password for all:

- Password: `Fish1234`

---

## 2. Auth & Profiles

### AUTH-01 – Sign up works

- **User:** New email (not previously registered)
- **Steps:**
  1. Go to `/auth`.
  2. Sign up with a new email and password.
  3. Confirm email (via magic link) if required.
- **Expected:**
  - No `email_address_invalid` errors.
  - Clear success message (e.g. "Check your email").
  - After confirmation, login works.
- **Actual:**
  - Sign-up flow is working as expected (based on earlier tests).
- **Status:** PASS

---

### AUTH-02 – Profile is created

- **User:** New account from AUTH-01
- **Steps:**
  1. Log in with the new account.
  2. Navigate to profile page.
- **Expected:**
  - A profile row exists (username, avatar placeholder, etc.).
  - No hard errors in DevTools console.
- **Actual:**
  - Profile is created and loads correctly (from earlier runs).
- **Status:** PASS

---

### AUTH-03 – Duplicate email is blocked

- **User:** Existing email from AUTH-01
- **Steps:**
  1. Go to `/auth`.
  2. Try to sign up using an email that is already registered.
- **Expected:**
  - Friendly error about the email already being in use.
  - No unhandled Supabase errors in console.
- **Actual:**
  - UI shows: "This email is already registered. Please sign in instead."
- **Status:** PASS

---

### PROF-01 – Update profile

- **User:** A (Owner)
- **Steps:**
  1. Go to profile/settings.
  2. Change:
     - Username (including trying a duplicate username),
     - Full name,
     - Bio,
     - Location,
     - Website,
     - Password.
  3. Save changes.
  4. Refresh the page.
- **Expected:**
  - All valid changes persist after refresh.
  - Duplicate username shows a clear error.
  - No console errors.
- **Actual:**
  - Avatar upload: error "Couldn't upload image. Try a smaller file." (likely no `avatars` bucket or policy issue).
  - Changing username to an existing username:
    - Toast: "Unable to save profile changes" (message is unclear; should mention the username is taken).
  - Change full name: success, persists on refresh.
  - Update bio: success, persists on refresh.
  - Update password: success. Old password no longer works; new one does.
- **Status:** PARTIAL PASS
  - Functional, but:
    - Avatar upload broken.
    - Username conflict error message unclear.

---

## 3. Add Catch

### CATCH-01 – Add a public catch

- **User:** A
- **Steps:**
  1. Log in as A.
  2. Go to "Add Catch".
  3. Fill in:
     - Title
     - Species (e.g. Common Carp)
     - Venue / Fishery
     - Weight + units (optional)
     - Time of day
     - Bait, method, water type
  4. Upload a valid image.
  5. Set visibility to **Public**.
  6. Submit.
- **Expected:**
  - No "null id" errors.
  - No "row-level security" errors.
  - Clear success feedback (toast/redirect).
  - Catch appears:
    - On A’s profile.
    - In public feed.
- **Actual:**
  - Catch added successfully using all form fields.
  - Catch page loads with all data.
  - Catch appears in:
    - `/leaderboard` page,
    - Home page leaderboard,
    - Main leaderboard view.
- **Status:** PASS

---

### CATCH-02 – Add a followers-only catch

- **User:** A
- **Steps:**
  1. Log in as A.
  2. Add a catch as in CATCH-01 but set visibility to **Followers**.
  3. Log in as B (who follows A) and view A’s catches/feed.
  4. Log in as C (stranger) and view A’s catches/feed.
- **Expected:**
  - Catch is created successfully.
  - As A: visible on own profile.
  - As B: visible in feed/profile.
  - As C: not visible.
- **Actual:**
  - As A:
    - Follower-only catch is visible on A’s profile.
  - As B:
    - B follows A.
    - A receives a "new follower" notification.
    - B **cannot** see follower-only catch (BUG).
  - As C:
    - C cannot see follower-only catch (correct).
  - Follower count:
    - Logged in as A: profile shows 0 followers (BUG).
    - Logged in as B viewing A: follower count shows 1 (correct from B’s POV).
- **Status:** FAIL
  - Follower-only visibility not working as intended (B should see it).
  - Follower count not consistent between views.

---

### CATCH-03 – Add a private catch

- **User:** A
- **Steps:**
  1. Add a catch with visibility **Private**.
  2. Check visibility as A, B, C, and D (Admin).
- **Expected:**
  - A: can see private catch.
  - B and C: cannot see private catch anywhere.
  - D (Admin): can still see private catch.
- **Actual:**
  - A: can see private catch.
  - B and C: do not see private catch (correct).
  - D: cannot see admin views; no admin menu at all; D only sees public catches (ADMIN BUG).
  - UX:
    - Catch cards in profile do not clearly indicate "Private".
    - Catch cards do not clearly indicate "Followers only".
    - When no main image is added, the submit button is greyed out but there is no explicit prompt to add an image.
- **Status:** PARTIAL PASS
  - Privacy visibility works for normal users.
  - Admin visibility and labelling improvements needed.

---

## 4. Feed & Visibility

### FEED-01 – Public vs follower vs private

Re-uses catches from CATCH-01/02/03.

#### FEED-01A – Follower view

- **User:** B (follower)
- **Steps:**
  1. Log in as B.
  2. Go to feed and A’s profile.
- **Expected:**
  - Sees A’s **Public** + **Followers** catches.
  - Does NOT see **Private** catch.
- **Actual:**
  - B does not see follower-only catch at all.
- **Status:** FAIL

#### FEED-01B – Stranger view

- **User:** C (stranger)
- **Steps:**
  1. Log in as C.
  2. Go to feed and A’s profile.
- **Expected:**
  - Sees only A’s **Public** catches.
- **Actual:**
  - C only sees public catches.
- **Status:** PASS

#### FEED-01C – Admin view

- **User:** D (Admin)
- **Steps:**
  1. Log in as D.
  2. Go to any Admin/Reports or admin catch list.
- **Expected:**
  - D can see all catches: public, followers-only, and private.
- **Actual:**
  - No admin menu options are available.
  - D only sees public catches; cannot see admin reports or audit logs.
- **Status:** FAIL

---

## 5. Follows

### FOLLOW-01 – Follow / Unfollow

- **User:** B
- **Steps:**
  1. Log in as B and visit A’s profile.
  2. Click **Follow**.
  3. Refresh the page.
  4. (Optional) Click **Unfollow** and refresh again.
- **Expected:**
  - After follow:
    - Button shows "Following".
    - Follower count increases.
    - A sees B as follower (if shown).
  - After unfollow:
    - Button returns to "Follow".
    - Follower count decreases.
- **Actual:**
  - B follows A:
    - Button updates correctly.
    - Follower count visible on B’s view increments.
    - A receives a notification that B followed.
  - A’s profile:
    - A does not see follower count update (shows 0).
    - No follower list for A in UI.
- **Status:** PARTIAL PASS
  - Follow action works and notifies correctly.
  - Follower counts / lists are inconsistent/missing.

---

## 6. Comments

### COMM-01 – Add comment

- **User:** B
- **Steps:**
  1. View a catch owned by A (public or follower-visible).
  2. Add a comment.
- **Expected:**
  - Comment appears immediately.
  - Comment persists after refresh.
  - A can see the comment and may get a notification.
- **Actual:**
  - B can comment on A’s catch.
  - Comment persists after refresh.
  - A receives a notification that B commented.
  - A can see the comment on the catch page.
- **Status:** PASS

---

### COMM-02 – Reply to a comment (threading)

- **User:** B
- **Steps:**
  1. Click "Reply" on an existing comment.
  2. Post a reply.
- **Expected:**
  - Replies appear as threaded/nested comments.
  - Structure persists after refresh.
- **Actual:**
  - No "Reply" option exists in the UI.
  - Only "Report" is available on comments.
- **Status:** NOT IMPLEMENTED

---

### COMM-03 – Delete own comment

- **User:** B
- **Steps:**
  1. Try to delete your own comment.
- **Expected:**
  - Comment disappears or is flagged as removed.
  - After refresh, comment is not visible.
- **Actual:**
  - No option to delete own comment is present in the UI.
- **Status:** NOT IMPLEMENTED

---

## 7. Reactions & Ratings

### REACT-01 – Like a catch

- **User:** B
- **Steps:**
  1. On A’s catch, click the "Like" / reaction button.
  2. Click again to toggle if allowed.
- **Expected:**
  - Reaction count increments when liked.
  - If toggling is supported, second click removes the like and decrements count.
  - A receives a single notification for being liked (not spammed).
- **Actual:**
  - Like behaviour:
    - B can like A’s catch.
    - Count increments correctly.
    - Button styling clearly indicates liked state (fills blue).
  - Notifications:
    - A receives a notification that B liked the catch.
    - Repeated toggling of like sends multiple notifications (spam risk).
- **Status:** PARTIAL PASS
  - Core like works.
  - Notification logic is too noisy (needs de-duplication/merge).

---

### RATE-01 – Rate someone else’s catch

- **User:** B
- **Steps:**
  1. On A’s catch, set a rating (e.g. 8/10).
- **Expected:**
  - Rating is saved.
  - Average rating and rating count update.
  - B can change rating and see updates.
- **Actual:**
  - Initial attempt:
    - B cannot rate A’s catch.
    - Toast: "Failed to add rating".
  - Later test (during report testing):
    - B successfully rated A’s catch (inconsistent behaviour).
- **Status:** FLAKY / INCONSISTENT
  - Needs investigation (RLS, RPC, or client-side error handling).

---

### RATE-02 – Try to rate your own catch

- **User:** A
- **Steps:**
  1. On A’s own catch, attempt to rate it.
- **Expected:**
  - Either:
    - Rating controls are hidden/disabled, or
    - A clear error prevents rating own catch.
  - No unhandled console errors.
- **Actual:**
  - A can rate their own catch.
  - Rating component is visible and fully functional for own content.
- **Status:** FAIL
  - Behaviour contradicts ERD intent (no self-rating).

---

## 8. Reports & Admin

### REP-01 – Report a catch

- **User:** B
- **Steps:**
  1. On A’s catch, click "Report".
  2. Select a reason and submit.
- **Expected:**
  - Clear confirmation (toast, etc.).
  - No console errors.
- **Actual:**
  - B can report A’s catch.
  - Modal opens, message is submitted.
  - Toast: "Report submitted".
  - Immediately testing comment report afterwards triggers rate limit:
    - Toast: "You're doing that too quickly. Please try again later."
- **Status:** PASS (with rate limit working)
  - Reporting works, rate limiting is active.

---

### ADMIN-01 – Admin reviews reports

- **User:** D (Admin)
- **Steps:**
  1. Log in as D.
  2. Navigate to Admin / Reports view.
- **Expected:**
  - Admin menu or route is available.
  - Reports submitted by B are visible.
  - Admin can open reported catch/comment.
- **Actual:**
  - No admin menu options are available at all.
  - D cannot see any admin screens.
- **Status:** FAIL

---

### ADMIN-02 – Admin deletes a catch

- **User:** D
- **Steps:**
  1. From Admin Reports, delete A’s catch.
- **Expected:**
  - Catch disappears from feed and A’s profile for normal users.
  - Catch remains in moderation history for admins.
  - No RLS errors.
- **Actual:**
  - Not testable (no admin UI visible; no access to reports).
- **Status:** NOT TESTABLE (blocked by ADMIN-01)

---

### ADMIN-03 – Admin warns a user

- **User:** D
- **Steps:**
  1. From Admin area, issue a warning for A (with severity + optional duration).
- **Expected:**
  - New `user_warnings` record exists for A.
  - A’s warning count increments.
  - A receives a notification describing warning.
- **Actual:**
  - Not testable (no admin UI).
- **Status:** NOT TESTABLE (blocked by ADMIN-01)

---

## 9. Notifications

### NOTIF-01 – New follower notification

- **Users:** A & B
- **Steps:**
  1. Log in as B and follow A.
  2. Log in as A and open notifications.
- **Expected:**
  - A sees a `new_follower` notification.
  - Marking as read updates state.
- **Actual:**
  - Notifications fire as expected.
  - B following A triggers a notification for A.
  - Known issue: likes can generate multiple notifications when toggled; same risk exists for follow/unfollow patterns.
- **Status:** PARTIAL PASS
  - Works, but notification deduplication needed.

---

### NOTIF-02 – New comment notification

- **Users:** A & B
- **Steps:**
  1. B comments on A’s catch.
  2. A opens notifications.
- **Expected:**
  - A sees a comment-related notification linking to catch.
- **Actual:**
  - Works as expected; A receives comment notification and can view catch.
- **Status:** PASS

---

### NOTIF-03 – Mark read / delete

- **User:** A
- **Steps:**
  1. Mark a notification as read.
  2. Optionally delete it (if supported).
- **Expected:**
  - Read state changes (e.g. bold → normal).
  - Deleted notifications disappear and stay gone.
- **Actual:**
  - Marking as read works:
    - Bold font changes to lighter font.
    - Some notifications disappear from unread list.
  - No visible option to delete notifications.
  - Unsure if delete is implemented.
- **Status:** PARTIAL PASS
  - Read behaviour OK.
  - Delete behaviour unclear / not exposed.

---

## 10. Rate Limits (Manual Sanity Check)

### RL-01 – Comment spam protection

- **User:** B
- **Steps:**
  1. Rapidly post multiple comments on a single catch (aim for ~25).
- **Expected:**
  - At some point a rate limit message appears.
  - Console errors are controlled and include a `RATE_LIMITED:` marker, not a crash.
- **Actual:**
  - After ~10 comments, a toast shows:
    - "You're doing that too quickly. Please try again later."
- **Status:** PASS (basic rate limiting working)

---

## 11. High-Level Summary (For Codex / Future Work)

- **Auth & profiles:** Generally OK. Avatar upload broken; username conflict error messaging unclear.
- **Add catch:** Public catches flow works well. Followers-only visibility is incorrect for followers. Private catches work for owner but not exposed to admin tools.
- **Visibility:** Stranger/public behaviour correct. Follower and admin visibility rules are not fully implemented in RLS/UI.
- **Follows:** Follow/unfollow works and triggers notifications; follower counts and lists are inconsistent.
- **Comments:** Basic commenting works. Threading and delete own comment are not implemented.
- **Reactions & ratings:** Likes work but spam notifications; rating is flaky and self-rating is allowed (should be blocked).
- **Reports & admin:** Reporting works and is rate-limited. Admin UI and admin visibility/moderation flows are effectively missing from the frontend for User D.
- **Notifications:** Core flows (follow, comment) work. Need deduplication and clarity around delete.
- **Rate limits:** Comment rate limiting appears to work as intended.

This document is intended as a source of truth for manual test outcomes and should be kept in sync with `docs/ERD.md` and any future automated test coverage.
