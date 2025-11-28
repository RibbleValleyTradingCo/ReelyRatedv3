Admin Audit Log – Manual Test Checklist

Purpose: Verify that /admin/audit-log behaves as designed across filters, pagination, CSV export, navigation, and access control.

Assumptions:
• You have an admin account (e.g. fishministrator) and at least one normal user.
• There is some existing moderation activity (warnings, suspensions, bans, content deletes/restores) so the audit log has data.
• Admin-only access is enforced via useAdminAuth and admin\_\* RPCs.

⸻

0. Setup
   • Confirm you can log in as:
   • An admin user (e.g. fishministrator)
   • A normal user (e.g. test2, test3, etc.)
   • As admin, generate a few recent moderation actions if needed:
   • Issue a warning to a test user.
   • Apply a temporary suspension to a test user.
   • Apply a ban to a test user.
   • Delete and restore a catch or comment via the Reports drawer.

These will give you rows to look for in the audit log.

⸻

1. Basic access and layout

As admin: 1. Visit /admin/audit-log.

Expect:
• Page loads without error.
• You see:
• Admin header / navbar.
• Filters section: date range presets, action filter, search.
• A table of log entries with columns like Timestamp / Action / Target / Reason / Admin.
• Pagination controls (Previous / Next) and a summary showing how many rows are visible.

As non-admin:
• Attempt to visit /admin/audit-log directly in the URL bar.
• Expect to be redirected / blocked (per useAdminAuth behaviour) and not see log data.

⸻

2. Date range presets

As admin, on /admin/audit-log:

For each preset:
• Select Last 24 hours.
• Table updates.
• Rows are only from the last 24h (roughly).
• If you have no recent actions, you may see an empty state.
• Select Last 7 days (default).
• Table updates.
• Rows cover roughly the last week.
• Select Last 30 days.
• Table updates.
• Rows cover roughly the last month (if data exists).
• Select All time.
• Table updates.
• Older rows appear if present.

General expectations:
• Changing date range resets to page 1.
• Summary text (e.g. row counts) reflects the new range.
• No obvious 500/400 errors in the console/network tab.

⸻

3. Action filter

Still as admin on /admin/audit-log:
• Find the Action filter (dropdown with values like Warned User, Deleted Catch, Restored Catch, Deleted Comment, Restored Comment, Restrictions lifted, etc.)

For at least two actions you know exist: 1. Choose warn_user (or the human-readable label for warnings).
Expect:
• Only rows where the action is a warning are shown.
• Timestamps and reasons match your issued warnings.
• Pagination (if needed) still works under this filter. 2. Choose clear_moderation.
Expect:
• Only “lift restrictions” actions show.
• Metadata / reason matches what you entered in the admin UI. 3. Return the action filter to All.
Expect:
• All actions (within the current date range) are visible again.

Interaction expectations:
• Action filter combines with the date range (not overrides it).
• Changing action filter resets to page 1.

⸻

4. Search behaviour

On /admin/audit-log, with a date range that definitely includes data (e.g. 30 days or All):

Try searching by:
• Username or partial username of a user you’ve moderated.
• A unique word from a reason (e.g. “spamming”, “Naughty step”, etc.).
• An admin username (e.g. test4).

Expect:
• Table updates to show only rows matching the search term.
• Search combines with the current date range and action filter.
• Clearing the search (empty input) restores the unfiltered result for the current date/action selection.
• Changing search resets to page 1.

⸻

5. Pagination

With filters that produce more than 100 rows (for large test datasets), or at least enough to demonstrate paging:
• Confirm page size = 100 (or whatever the code is set to) by:
• Counting rows on the first page (roughly, doesn’t need to be exact).
• Noting that when there are more rows than the page size, the Next button is enabled.
• Click Next:
• Table updates to the next batch of rows.
• No obvious duplicates from page 1 at the top of page 2.
• The summary makes sense (e.g. “Showing 101–200 of …” or similar, depending on implementation).
• Click Previous:
• You return to the previous set of rows.
• No gaps (e.g. missing rows) between pages.
• When you reach the last page:
• Next is disabled or does nothing.
• No more new rows appear beyond the end.

⸻

6. CSV export

On /admin/audit-log with some filters applied (e.g. action = warn_user, date range = 7 days):
• Click the Export CSV button.

Expect:
• A CSV is downloaded (or opened) without error.
• CSV rows reflect the current filters:
• Date range.
• Action filter.
• Search query, if active.
• The CSV includes:
• Timestamp.
• Action.
• Target information (user/catch/comment).
• Reason / metadata.
• Admin identifier (username/id).

(Optional sanity check: switch to a different filter combo and export again; rows should differ accordingly.)

⸻

7. Navigation to User Moderation

From /admin/audit-log as admin:
• Locate a row that clearly involves a specific user (e.g. warn_user for @test).

For at least one such row: 1. Click the Moderation button / link in that row.
Expect:
• You are routed to /admin/users/:userId/moderation for the correct user.
• The moderation page loads correctly (summary card, warnings, history).
• The browser Back button returns you to /admin/audit-log in the same filtered state (where possible). 2. If the row has View target (for catch/comment):
• Click it and ensure it routes to the catch or comment view correctly.
• Use navigation to return to the audit log if needed.

⸻

8. Empty states

Test scenarios where the log is empty under current filters:
• Use a date range like Last 24 hours when no actions have occurred in that time.
• Apply an action filter for an action type you know has no rows (if such a type exists in your data).
• Use a deliberately nonsense search term (e.g. thisstringshouldmatchnothing).

Expect:
• Instead of a broken table, you see a friendly empty state message like:
• “No audit log entries match these filters.”
• Filters remain visible and usable so you can recover by changing them.

⸻

9. Security & access control

As a normal user:
• Confirm:
• /admin/audit-log cannot be accessed (redirected/blocked).
• No link anywhere in the UI points to /admin/audit-log.
• No audit log data is visible on any non-admin page.

(Optional, via Supabase SQL editor or API):
• Attempt to call the underlying moderation_log query as a non-admin:
• Expect RLS / permission error or empty result, as designed.

As an admin:
• All of the above tests can be performed without hitting permission errors (apart from expected CSV issues if your browser blocks downloads).

⸻

10. Final smoke test

Run through this short scenario end-to-end: 1. As admin:
• Issue a warning to a test user.
• Apply a temporary suspension.
• Lift restrictions.
• Ban the user.
• Lift restrictions again. 2. On /admin/audit-log with a date range covering those actions:
• Use search to locate actions for that user.
• Confirm you see the full sequence:
• warn_user (warning)
• warn_user (temporary suspension)
• clear_moderation (lift)
• warn_user (ban)
• clear_moderation (lift)
• Filters, pagination, CSV export, and navigation behave correctly while this data is visible.

When all the relevant boxes are checked, the Audit Log portion of Phase X can be considered verified.
