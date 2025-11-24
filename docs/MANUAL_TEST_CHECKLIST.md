# ReelyRated – Manual Test Checklist

This document is for **manual testing only**.

We’ll use it to:

- Walk through key user journeys by hand.
- Check that behaviour matches `ERD.md` (schema + rules).
- Log what works and what needs fixing.

No automated tooling required – just a browser, a test account (or a few), and this checklist.

---

## 1. How to Use This Checklist

### 1.1 Environment

- App running at: `http://localhost:8080` (or deployed URL).
- Supabase project: ReelyRated v3 (hosted).

### 1.2 Test accounts

Ideally have these set up:

- **User A – “Owner”**  
  A normal angler account you’ll use to create content.

- **User B – “Follower” of A**  
  Follows User A, to test followers-only visibility.

- **User C – “Stranger”**  
  Does **not** follow A, to confirm public vs follower vs private.

- **User D – “Admin”**  
  Has a row in `admin_users` so we can test admin views and moderation.

> Tip: keep a little note somewhere with emails/passwords for these 4.

### 1.3 How to record results

Create a simple sheet or Notion table with columns like:

- **ID** (e.g. `AUTH-01`)
- **Area** (Auth, Add Catch, Feed, etc.)
- **Scenario**
- **Steps**
- **Expected result**
- **Actual result**
- **Pass? (Y/N)**
- **Notes / Bugs**

You don’t need to document every click – just enough so future-you knows what you checked.

---

## 2. Auth & Profiles

### AUTH-01 – Sign up works

- **User:** new email
- **Steps:**
  1. Go to `/auth` (or entry point).
  2. Sign up with a new email + password.
  3. Confirm any email link if required.
- **Expected:**
  - No “Email address invalid” errors.
  - You see a success message (“check your email” or similar).
  - After confirmation, you can log in.

---

### AUTH-02 – Profile is created

- **User:** new account from AUTH-01
- **Steps:**
  1. Log in with your new account.
  2. Navigate to your profile page.
- **Expected:**
  - A profile row exists (username, avatar placeholder, etc.).
  - No hard errors in DevTools console.

---

### AUTH-03 – Duplicate email is blocked

- **User:** existing email from AUTH-01
- **Steps:**
  1. Try to sign up again with the same email.
- **Expected:**
  - You get a friendly error about email already in use.
  - No unhandled Supabase error in console.

---

### PROF-01 – Update profile

- **User:** A (Owner)
- **Steps:**
  1. Go to your profile/settings.
  2. Update bio, location, website.
  3. Save and refresh page.
- **Expected:**
  - Changes persist after refresh.
  - No errors when saving.

---

## 3. Add Catch

### CATCH-01 – Add a public catch

- **User:** A
- **Steps:**
  1. Log in as A.
  2. Go to “Add Catch”.
  3. Fill in:
     - Title
     - Species (e.g. Common Carp)
     - Venue / Fishery
     - Weight, units (if you want)
     - Time of day
     - Bait, method, water type
  4. Upload a valid image.
  5. Set visibility to **Public**.
  6. Submit.
- **Expected:**
  - No “null id” errors.
  - No “row-level security” errors.
  - You see a success state (toast, redirect, etc.).
  - Catch appears on your profile and in the public feed.

---

### CATCH-02 – Add a followers-only catch

- **User:** A
- **Steps:**
  1. Add a catch as above, but set visibility to **Followers**.
- **Expected:**
  - Catch is created successfully.
  - As A: you can see it on your profile.
  - As B (follower of A): you can see it in feed/profile.
  - As C (not following A): you **cannot** see it.

---

### CATCH-03 – Add a private catch

- **User:** A
- **Steps:**
  1. Add a catch with visibility **Private**.
- **Expected:**
  - As A: visible on your profile.
  - As B and C: not visible anywhere.
  - As D (Admin): still visible.

---

## 4. Feed & Visibility

### FEED-01 – Public vs follower vs private

Re-use the catches from CATCH-01/02/03.

- **User:** B (follower)
- **Steps:**
  1. Log in as B.
  2. Go to feed & A’s profile.
- **Expected:**

  - Sees A’s **Public** + **Followers** catches.
  - Does **not** see **Private** catch.

- **User:** C (stranger)
- **Steps:**
  1. Log in as C.
  2. Go to feed & A’s profile.
- **Expected:**

  - Sees only A’s **Public** catch.

- **User:** D (Admin)
- **Steps:**
  1. Log in as D.
  2. View Admin/Reports or any admin catch list.
- **Expected:**
  - Can see all three catches (public, followers, private).

---

## 5. Follows

### FOLLOW-01 – Follow / Unfollow

- **User:** B
- **Steps:**
  1. Visit A’s profile.
  2. Click **Follow**.
  3. Refresh page.
- **Expected:**

  - Button/state changes to “Following”.
  - Follower count increases appropriately.
  - A can see B in their followers list (if exposed in UI).

- **Steps:** 4. Click **Unfollow** and refresh.
- **Expected:**
  - State returns to “Follow”.
  - Follower count decreases.

---

## 6. Comments

### COMM-01 – Add comment

- **User:** B
- **Steps:**
  1. View a catch owned by A (public or follower-visible).
  2. Add a comment.
- **Expected:**
  - Comment appears immediately.
  - After refresh, comment is still there.
  - A sees the comment.

---

### COMM-02 – Reply to a comment (threading)

- **User:** B
- **Steps:**
  1. Click “Reply” on an existing comment.
  2. Post a reply.
- **Expected:**
  - Reply appears visually nested/threaded.
  - After refresh, thread structure is preserved.

---

### COMM-03 – Delete own comment

- **User:** B
- **Steps:**
  1. Delete your own comment.
- **Expected:**
  - Comment disappears (or is visually “removed”).
  - On refresh, it’s not visible (soft delete respected).

---

## 7. Reactions & Ratings

### REACT-01 – Like a catch

- **User:** B
- **Steps:**
  1. On A’s catch, click “Like” (or reaction button).
- **Expected:**
  - Reaction count increments.
  - Clicking again toggles appropriately (or remains liked, depending on UX).

---

### RATE-01 – Rate someone else’s catch

- **User:** B
- **Steps:**
  1. On A’s catch, set a rating (e.g. 8/10).
- **Expected:**
  - Rating is saved.
  - Average rating and rating count update (immediately or on refresh).
  - B can change their rating and see it update.

---

### RATE-02 – Try to rate your own catch

- **User:** A
- **Steps:**
  1. On your own catch, try to rate it.
- **Expected:**
  - Either:
    - Rating controls are disabled, or
    - You get a clear error / nothing happens.
  - No console “Unhandled error” messages.

---

## 8. Reports & Admin

### REP-01 – Report a catch

- **User:** B
- **Steps:**
  1. On A’s catch, click “Report”.
  2. Choose a reason and submit.
- **Expected:**
  - B sees a confirmation.
  - No console errors.

---

### ADMIN-01 – Admin reviews reports

- **User:** D (Admin)
- **Steps:**
  1. Go to Admin / Reports view.
- **Expected:**
  - Sees B’s report.
  - Can view the reported catch/comment.

---

### ADMIN-02 – Admin deletes a catch

- **User:** D
- **Steps:**
  1. From Admin Reports, delete A’s catch.
- **Expected:**
  - Catch disappears from:
    - Public feed
    - A’s profile (for normal users)
  - For admin:
    - Still listed in moderation history.
  - No RLS errors.

---

### ADMIN-03 – Admin warns a user

- **User:** D
- **Steps:**
  1. From Admin area, issue a warning for A (with severity + optional duration).
- **Expected:**
  - New warning row exists for A.
  - A’s warning count increments in profile.
  - A receives a notification about the warning.

---

## 9. Notifications

### NOTIF-01 – New follower notification

- **User:** A & B
- **Steps:**
  1. Log in as B and follow A.
  2. Log in as A and check notifications.
- **Expected:**
  - A has a `new_follower`-style notification.
  - Opening it marks it as read (or similar behaviour).

---

### NOTIF-02 – New comment notification

- **User:** A & B
- **Steps:**
  1. B comments on A’s catch.
  2. A opens notifications.
- **Expected:**
  - A sees a comment-related notification with a link back to the catch.

---

### NOTIF-03 – Mark read / delete

- **User:** A
- **Steps:**
  1. Mark a notification as read.
  2. Optionally delete it.
- **Expected:**
  - Read state updates (e.g. bold → normal).
  - Deleted notifications disappear and stay gone.

---

## 10. Light Rate-Limit Check (optional manual)

You can just sanity check that the app behaves nicely if you “spam” actions.

### RL-01 – Comment spam

- **User:** B
- **Steps:**
  1. Rapidly post many comments on a single catch (e.g. 25 in a row).
- **Expected:**
  - At some point you get a “slow down” / “rate limited” type message.
  - Console error message includes `RATE_LIMITED:` but nothing explodes.

Same idea can be applied for reports, follows, reactions if you can be bothered.

---

## 11. General UX / Tech Checks

For any page you test:

- Watch **DevTools console**:
  - No red errors from Supabase or React.
- Watch **Network**:
  - No repeated 4xx/5xx on core APIs.
- Check **refresh behaviour**:
  - After a hard refresh, the page still works as expected.
- Check **basic responsiveness**:
  - Shrink browser to tablet/mobile-ish size and eyeball that it doesn’t completely break.

---

## 12. After Testing

When you’ve gone through a batch:

1. **List bugs and gaps**:
   - Anything that didn’t match the “Expected” behaviour above.
2. **Categorise** (if you want):
   - Must fix before launch
   - Nice to have
   - Future phase
3. Use that list to:
   - Drive changes to migrations / RLS / RPCs.
   - Update `ERD.md` if reality has to change.
   - Decide what to work on next.
