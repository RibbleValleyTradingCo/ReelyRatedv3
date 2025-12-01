Admin User Moderation – Test Plan

1. Scope

This test plan covers the Admin User Moderation experience:
• Page: /admin/users/:userId/moderation (AdminUserModeration.tsx)
• Entry points:
• From Admin Reports drawer
• From Admin Audit Log rows
• From Profile page admin button
• Direct URL navigation as an admin

Goals:
• Verify that the page correctly surfaces a user’s moderation status, warnings history, and moderation actions.
• Ensure admin-only access and safe navigation.
• Confirm that links between admin pages are intuitive and reliable.
• Harden the UI against empty states, error states, and large data sets.

⸻

2. Pre-requisites / Test Data

You’ll need:
• At least one admin account (in admin_users).
• Several normal users, e.g.:
• test2 – has warnings and moderation actions.
• test3 – no warnings, no moderation actions.
• fishministrator – admin user (for testing links to admin moderation pages).

Create some data (via existing flows):
• Issue at least 2 warnings to test2 (different reasons, severities/durations).
• Perform several moderation actions on test2 (e.g. warn, resolve reports, delete/restore a comment or catch).
• Ensure user_warnings and moderation_log have entries for test2.
• Keep at least one user (test3) clean (no warnings/actions).

⸻

3. Access Control & Routing

3.1 Admin vs non-admin access

As admin: 1. Log in as admin. 2. Navigate directly to /admin/users/<test2-id>/moderation. 3. Confirm:
• Page loads.
• Navbar shows admin links.
• No redirect away.

As non-admin: 1. Log in as a normal user. 2. Navigate directly to /admin/users/<some-id>/moderation. 3. Confirm:
• You are blocked/redirected (behaviour as defined by useAdminAuth).
• You do not see the moderation UI.

⸻

4. Page Header & Summary Card

4.1 Header text and layout

As admin, on /admin/users/<test2-id>/moderation:
• Confirm header shows:
• Small “Admin” label.
• Title: Moderation for @username (or userId when username missing).
• Subheading: “Read-only overview of this user’s warnings and moderation history.”
• Confirm Back and Refresh buttons appear on the right.

4.2 Back behaviour (from different sources) 1. From Admin Reports:
• Go to /admin/reports.
• Open a report with target user test2.
• Click “View moderation history”.
• On moderation page, click Back.
• Confirm: returns to /admin/reports. 2. From Admin Audit Log:
• Go to /admin/audit-log.
• Find a row involving test2 with a “Moderation” button.
• Click “Moderation”.
• On moderation page, click Back.
• Confirm: returns to /admin/audit-log. 3. From Profile:
• Go to /profile/test2 as admin.
• Click the “Moderation” button in the profile header.
• On moderation page, click Back.
• Confirm: returns to the user profile. 4. Direct navigation:
• Manually open /admin/users/<test2-id>/moderation (no state).
• Click Back.
• Confirm: falls back to /profile/<username> or /feed if no username.

4.3 Summary card details

On /admin/users/<test2-id>/moderation:
• Avatar:
• Correct avatar (or fallback initial) shown.
• Identity:
• Shows username and (userId) beside it.
• Status badge:
• Badge text matches moderation_status:
• active → “Active”, neutral styling.
• warned → “Warned”, amber styling.
• suspended with suspension_until → “Suspended until …”, amber styling.
• banned → “Banned”, destructive styling.
• Warning count:
• Shows Warnings: X/3 in summary card.
• Links:
• “View profile” links to the correct profile.
• “View reports about this user” navigates to /admin/reports with the user filter applied (if implemented).

Repeat for a user with no warnings/actions (test3):
• Status badge should show “Active”.
• Warnings count 0/3.

⸻

5. “Current Status” Card

5.1 Data correctness

For a user with warnings and status changes (test2):
• Fields:
• User: shows username or id.
• Moderation status: matches backend (active|warned|suspended|banned).
• Warnings: matches warn_count.
• Suspension until: shows date/time when suspended; “—” when not suspended.

Change test2’s status via admin flows (warn, suspend, ban) and reload:
• Confirm card updates accordingly after Refresh.

5.2 Empty / error states
• Temporarily break the profile query (or test with a non-existent user id) and confirm:
• “User not found.” message appears.
• Toasts show “Unable to load user moderation status” as appropriate.

⸻

6. Warnings Table

6.1 User with warnings

For test2 (with at least 2 warnings):
• Confirm the Warnings card shows:
• A table with columns: Issued, Severity, Reason, Duration, Admin.
• Sorted newest first (most recent at top).

Check each column:
• Issued:
• Shows relative time (e.g. “5 minutes ago”).
• Severity:
• Capitalized text from severity (e.g. “warning”, “temporary suspension” → “Warning”, “Temporary suspension” after formatting).
• Reason:
• Long reasons are truncated with an ellipsis.
• Hovering the text shows the full reason via tooltip (title attribute).
• Duration:
• Shows “—” when duration_hours is null.
• Shows Xh when provided.
• Admin:
• When admin.id exists:
• Display is a link with admin.username or id.
• Clicking navigates to /admin/users/<admin-id>/moderation.
• When missing:
• Falls back to admin.username, admin.id, or “Unknown”.

6.2 User with no warnings

For test3:
• Confirm warnings section shows: “No warnings issued yet.”

⸻

7. Moderation History Table

7.1 User with history

For test2:
• Confirm Moderation history table shows:
• Columns: Timestamp, Action, Target, Reason, Admin.
• Sorted newest first.

Check each column:
• Timestamp:
• Relative time (e.g. “2 hours ago”).
• Action:
• Appears as a pill/badge with the exact action string from moderation_log.action.
• Target:
• For target_type = 'user': label like @<target_id or username> plus the raw id beneath in a small mono font.
• For catch: label “Catch” + id.
• For comment: label “Comment” + id.
• For unknown: label “Unknown”.
• Reason:
• Uses mapped reason from metadata.
• Long reasons truncated with tooltip showing full text.
• Admin:
• When admin.id exists:
• Link to /admin/users/<admin-id>/moderation.
• Otherwise: fallback to username/id/“Unknown”.

7.2 User with no history

For test3:
• Confirm history section shows: “No moderation actions recorded yet.”

⸻

8. Integration With Other Admin Pages

8.1 From Admin Reports 1. Go to /admin/reports. 2. Open a report where the target user is test2. 3. Confirm the drawer shows a “View moderation history” button. 4. Click it:
• Lands on /admin/users/<test2-id>/moderation.
• Header shows Moderation for @test2.
• Back returns to Reports.

8.2 From Admin Audit Log 1. Go to /admin/audit-log. 2. Filter/search to find entries involving test2. 3. Confirm:
• “Moderation” button is visible for user-related rows. 4. Click “Moderation”:
• Lands on /admin/users/<test2-id>/moderation.
• Back returns to Audit Log.

⸻

9. Loading & Refresh Behaviour

9.1 Loading state
• On slow connection (or via throttling dev tools):
• Open moderation page.
• Confirm:
• Global spinner appears while admin status is loading.
• Within the cards, “Loading…” appears while profile/warnings/logs load.

9.2 Refresh button
• Click Refresh in the header:
• Confirm:
• Page reloads data (profile, warnings, log).
• No duplicate toasts or unexpected navigation.

⸻

10. Error Handling

Manually simulate or force backend errors (e.g. temporarily tweak RLS or table name locally, or rely on debug mode):
• Profile query failure:
• Toast: “Unable to load user moderation status”.
• Current status card shows appropriate error/empty.
• Warnings query failure:
• Toast: “Unable to load warnings”.
• Warnings section shows fallback (likely empty table / empty message).
• Log query failure:
• Toast: “Unable to load moderation history”.
• History section shows fallback.

Ensure page remains usable (no hard crashes) even when some queries fail.

⸻

11. Security / Privacy Sanity
    • Confirm non-admins:
    • Do not see:
    • Admin nav links.
    • “Moderation” buttons on Profile, Reports, Audit Log, Notifications.
    • Cannot access /admin/users/:id/moderation directly.
    • Confirm admin-only data:
    • Warnings and moderation history are only surfaced on this admin page (and related admin pages), never leaked into normal user UI.

⸻

12. Optional: Ideas for Automated Tests (Future)

If you want to add Jest/React Testing Library coverage later:
• Snapshot test for:
• User with warnings and history.
• User with no warnings/history.
• Unit test helpers:
• truncate(value, max) – ensures truncation and ellipsis logic.
• formatRelative – sanity check with a known timestamp.
• Integration test for:
• Clicking admin link in warnings/history rows calls navigate with /admin/users/:id/moderation.
• Back button chooses correct destination when location.state.from is reports vs audit-log vs undefined.
