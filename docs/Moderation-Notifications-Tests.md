## Moderation & Notification UX – Manual Test Checklist

1) Warning
- As admin, open `/admin/users/:userId/moderation` and issue “Warn user” with a reason.
- As that user, check notifications: title “You’ve received a warning from the moderators” and body shows the reason (no raw enum labels).
- Click notification → lands on profile notifications (`#notifications`) showing “Account status” with Status = Warned and updated warning count; posting is still allowed.

2) Temporary suspension
- As admin, issue a temporary suspension with a duration.
- As that user, notification reads “Your account is temporarily suspended” and body includes “can’t post until {date/time}” plus reason.
- Attempt to post comment/catch → blocked with existing friendly toast.
- Profile notifications page status card shows “Suspended until …”.

3) Permanent ban
- As admin, issue a permanent ban.
- As that user, notification reads “Your account has been banned” and body explains posting is disabled, with reason.
- Profile notifications page status card shows “Banned”; posting is blocked as before.

4) Lift restrictions
- As admin, use “Lift restrictions”.
- User receives “Your account restrictions have been lifted” with the reason.
- Profile notifications page status card returns to Active (or Warned if warn_count > 0); posting works again.

5) Regression / admin flows
- AdminReports, AdminAuditLog, and AdminUserModeration still behave the same (actions work, navigation/back intact).
- Non-admin users cannot access any `/admin/*` routes.
- Other notification types (new_comment, mention, comment_reply, admin_report, admin_moderation for content actions) still render as before.
- Aligned with current notification rendering (friendly copy, routing to profile notifications with account status card), as of this update.

<!-- Aligned with current implementation as of this update. -->
