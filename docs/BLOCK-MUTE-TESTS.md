# Block / Mute – Manual Test Checklist

## Blocking flow
- User A blocks User B via RPC/UI:
  - B’s catches disappear from A’s feed/search/venue pages (blocked via catches RLS).
  - B’s comments no longer appear for A (blocked via catch_comments RLS).
- User B still sees User A normally (block is one-way).
- User B blocks User A:
  - Both are now blocked from seeing each other’s catches/comments.
- Admin user:
  - Admin can still see all catches/comments regardless of blocks.

## Unblocking flow
- User A unblocks User B:
  - B’s content reappears per normal privacy rules.
  - Follow relationships remain removed until explicitly re-followed.

## UI + End-to-end (Profile block)
- User A blocks User B on B’s profile:
  - Confirmation dialog shows; after confirm, A sees a “You have blocked this angler” banner with Unblock.
  - Follow is hidden/disabled for A with helper text.
  - B’s catches disappear from A’s feed/venue pages/catch detail (RLS already enforces).
- User A unblocks User B:
  - Banner removed; block button returns.
  - B’s content reappears for A per existing privacy rules.
- Admin behaviour:
  - Admin can still view content even if A and B have blocked each other; block/unblock UI remains available.
- Edge cases:
  - Blocking yourself fails.
  - Blocking a user with no catches/comments is a no-op beyond UI state.

## Comments enforcement
- Block scenario:
  - A blocks B.
  - B comments on A’s catch, on their own catch, and on a third user’s catch.
  - A should not see B’s comments anywhere (catch detail, feed previews, venue pages, profile).
- Unblock scenario:
  - A unblocks B; comments reappear according to privacy rules.
- Admin scenario:
  - Admin can see comments regardless of blocks.
- Posting:
  - If a block exists either way between commenter and catch owner, commenter gets a clear error: “You cannot comment on this angler right now.”

## Blocked Anglers List – UI Tests

**Preconditions**

- Accounts: `test`, `test2`, `test6`.
- Backend block enforcement is already live:
  - `block_profile` / `unblock_profile`.
  - RLS for catches/comments with `is_blocked_either_way`.

**1. Empty state**

1. Log in as a user who hasn’t blocked anyone.
2. Go to **Settings → Profile**.
3. Find the **Safety & blocking** card.

Expected:
- The card is visible but subtle.
- The list area shows a neutral empty state like:
  - “You haven’t blocked any anglers yet. If someone’s behaviour isn’t for you, you can block them from their profile.”
- No errors in the console.

**2. List shows blocked users**

1. As `test`, visit `/profile/test6` and click **Block user**.
2. Go to **Settings → Profile → Safety & blocking**.

Expected:
- `test6` appears in the blocked list.
- Row shows avatar (or fallback), username, and a short bio snippet.
- An **Unblock** button is visible and enabled.

**3. Unblock from the list**

1. Still as `test`, click **Unblock** on `test6` in the blocked list.

Expected:
- A success toast is shown.
- `test6` disappears from the list without a full page refresh.
- After a hard refresh, `test6` is still absent.
- Visiting `/profile/test6` now shows the normal profile again (subject to privacy/is_private).

**4. Multiple blocked users**

1. As `test`, block both `test2` and `test6`.
2. Go back to Safety & blocking.

Expected:
- Both users appear in the list.
- Unblocking one removes that entry only; the other remains.
- Re-blocking them from their profiles will make them reappear in the list.

**5. Admin behaviour**

- Admin accounts see the same Safety & blocking list for themselves.
- Block/unblock works the same via the list.
- There is no view exposing “who has blocked me”; only “who I blocked”.

---

## Blocked anglers list – Settings UI (end-to-end)

This section covers the dedicated “Safety & blocking” panel in **Profile settings** and ensures it stays in sync with profile-level block behaviour and backend state.

### B1. Empty state

1. Create a fresh test user `settings_block_tester` (no blocks yet).
2. Log in as `settings_block_tester` and go to **Settings → Profile**.
3. Scroll to the **Safety & blocking** card.

**Expected:**
- Card title: “Safety & blocking”.
- Subtitle: “See and manage anglers you’ve blocked.”
- Body shows the dashed empty-state card with copy:  
  _“You haven’t blocked any anglers yet. If someone’s behaviour isn’t for you, you can block them from their profile.”_

---

### B2. List shows newly blocked user

1. From the same account (`settings_block_tester`), visit another angler profile, e.g. `/profile/test2`.
2. Use the **Block user** action on their profile.
3. Return to **Settings → Profile → Safety & blocking**.

**Expected:**
- `test2` now appears in the list:
  - Avatar (or fallback initials).
  - Display name and `@username`.
  - A short bio line (or “No bio yet.”).
  - An **Unblock** button on the right.
- No loading or error message once the panel settles.

---

### B3. Unblock flow from Settings

1. In **Safety & blocking**, click **Unblock** on `test2`.
2. Wait for the toast to appear.

**Expected:**
- Toast message:  
  - If the user has a username: _“You’ve unblocked @test2.”_  
  - Otherwise: _“User unblocked.”_
- `test2` disappears from the blocked list.
- A manual refresh of the page still shows an empty state (no stale blocked entries).

---

### B4. Deleted-account edge case

_Precondition:_ A previously blocked account has been deleted via the account deletion flow.

1. As a test account that blocked the now-deleted user, go to **Settings → Profile → Safety & blocking**.

**Expected:**
- That row renders as:
  - Display name: “Deleted angler”.
  - Secondary line: “Account deleted”.
  - Bio line: “This angler deleted their account.”
- The **Unblock** button is still available and works if clicked.
- No crashes or unexpected errors.

---

### B5. Consistency with feed/profile behaviour

1. As user A, block user B from B’s profile.
2. Confirm:
   - A cannot see B’s catches or comments anywhere (feed, venue pages, catch detail).
3. Go to **Settings → Profile → Safety & blocking** as user A.

**Expected:**
- B appears exactly once in the list.
- Unblocking B from this panel restores B’s visibility in feed/profile/venue pages, matching the main block logic tests.
- There is no separate “hidden” block state that differs between Settings and profile.
