## Moderation Enforcement – Manual Test Matrix

### Preconditions
- Admin account available.
- Test accounts with `moderation_status` set to: `active`, `warned`, `suspended` (future `suspension_until`), `suspended` (past `suspension_until`), `banned`.
- Ensure comments and catches can be created normally for active users.

### Comment Creation
1) **Active user:** Can post a top-level comment and a reply; notifications/threads behave as today.
2) **Warned user:** Can post comments normally.
3) **Suspended (future suspension_until):** Attempt to post → blocked; toast: “You’re currently suspended until <date/time> and can’t post comments right now.”
4) **Suspended (past suspension_until):** Treated as active; comments succeed.
5) **Banned user:** Attempt to post → blocked; toast: “Your account is banned and you can’t post comments.”
6) **Admin (any status):** Always allowed to post; no moderation toasts.
7) **Regression:** Rate limit errors still fire for non-admins; visibility checks unchanged; mentions/comment_reply/new_comment notifications still work.

### Catch Creation
1) **Active user:** Can create a catch successfully.
2) **Warned user:** Can create a catch successfully.
3) **Suspended (future suspension_until):** Attempt to create → blocked; toast: “You’re currently suspended until <date/time> and can’t post new catches right now.”
4) **Suspended (past suspension_until):** Treated as active; catch creation succeeds.
5) **Banned user:** Attempt to create → blocked; toast: “Your account is banned and you can’t post new catches.”
6) **Admin (any status):** Always allowed to create catches.
7) **Regression:** Existing validations (images/bucket, form validation) and navigation after submission unchanged.

### General
- Verify friendly toasts are shown instead of raw backend errors for moderation blocks.
- Ensure moderation enforcement does not affect sign-in or read-only access.
- Aligned with current implementation (comment + catch creation via assert_moderation_allowed), as of this update.
