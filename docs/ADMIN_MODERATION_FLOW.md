## Admin Moderation Flow

### 1. Admin RPCs

All RPCs require the caller (`auth.uid()`) to exist in `public.admin_users`. Each function is SECURITY DEFINER and enforces the admin check internally.

| RPC | Signature | Behaviour | Writes/Reads |
| --- | --- | --- | --- |
| `public.admin_delete_catch` | `(p_catch_id UUID, p_reason TEXT)` | Soft-deletes a catch (sets `deleted_at = now()`, updates `updated_at`). Logs the action in `public.moderation_log`. | Updates `public.catches`; inserts into `public.moderation_log` (`action='delete_catch'`, `user_id`, `catch_id`, metadata `{reason, source}`); downstream UIs expect `reports` status updates. |
| `public.admin_restore_catch` | `(p_catch_id UUID, p_reason TEXT)` | Restores a catch (`deleted_at = NULL`, updates `updated_at`). Logs to `moderation_log` with `action='restore_catch'`. | Updates `public.catches`; inserts into `moderation_log`. |
| `public.admin_delete_comment` | `(p_comment_id UUID, p_reason TEXT)` | Soft-deletes a comment (`deleted_at = now()`). Logs to `moderation_log` with `action='delete_comment'`, tracking the comment’s author and parent catch. | Updates `public.catch_comments`; inserts into `moderation_log`. |
| `public.admin_restore_comment` | `(p_comment_id UUID, p_reason TEXT)` | Restores a comment (`deleted_at = NULL`). Logs `action='restore_comment'`. | Updates `public.catch_comments`; inserts into `moderation_log`. |
| `public.admin_warn_user` | `(p_user_id UUID, p_reason TEXT, p_severity public.warning_severity DEFAULT 'warning', p_duration_hours INTEGER DEFAULT NULL)` | Issues a warning/suspension/permanent ban. Inserts into `public.user_warnings`, increments `profiles.warn_count`, updates `profiles.moderation_status`/`suspension_until`, and logs `action='warn_user'` with metadata (`reason`, `severity`, `duration_hours`). | Inserts rows in `user_warnings`; updates `profiles`; inserts into `moderation_log`. |

### 2. AdminReports Page Behaviour

1. Loads reports via `supabase.from('reports')`, including reporter info.
2. When selecting a report:
   - Fetches the target catch/comment/profile to determine `targetUserId`, `parentCatchId`, and `deletedAt` state.
   - Loads the target user profile (`warn_count`, `moderation_status`, `suspension_until`).
   - Fetches prior warnings from `public.user_warnings` (joined via `issued_by` → `profiles`).
   - Fetches `public.moderation_log` entries associated with the target (by `catch_id`, `comment_id`, or `user_id`). Each entry is rendered using metadata for reason/details.
3. Actions:
   - **Delete Catch/Comment**: calls the respective RPC with `{ p_*_id, p_reason }`, marks the report resolved, and reloads data.
   - **Restore Catch/Comment**: similar flow but only allowed when the item is soft-deleted.
   - **Warn User**: calls `admin_warn_user` with `{ p_user_id, p_reason, p_severity, p_duration_hours? }`. Updates the report status and refreshes details.
4. Moderation drawer shows:
   - Profile moderation status and suspension info.
   - Prior warnings (reason/severity/duration/admin derived from `user_warnings`).
   - Moderation history (derived from `moderation_log` entries).

### 3. AdminAuditLog Page Behaviour

1. Fetches up to 500 `moderation_log` rows (`id, action, user_id, catch_id, comment_id, metadata, created_at, admin`).
2. Derives display fields:
   - `target_type`: comment if `comment_id` exists, catch if `catch_id` exists, otherwise user if `user_id` exists.
   - `target_id`: whichever FK is present.
   - `reason`: from `metadata.reason` (fallback text if missing).
   - `details`: full metadata JSON.
3. Supports search, filtering, and CSV export using the derived fields.
4. Clicking a row navigates to the relevant catch/comment/user.

### 4. RLS / Grants

- `reports`: admins have SELECT/UPDATE policies (see migration 0011). Reporters can insert/select their own entries.
- `user_warnings`: admin-only ALL policy (users may see their own warnings depending on policy). Uses `issued_by` FK to `profiles`.
- `moderation_log`: admin-only SELECT/INSERT. All moderation RPCs insert rows via SECURITY DEFINER.
- `rate_limits`: used by rate-limit RPCs (not directly surfaced in the admin UI but part of Phase 3).

### 5. End-to-End Expectations

- Admin delete/restore actions should always:
  1. Validate caller is admin (inside RPC).
  2. Update the relevant `deleted_at` field only if a state change is needed (idempotent behaviour).
  3. Insert a `moderation_log` record with descriptive metadata.
  4. Trigger the AdminReports UI to refresh the report status and moderation drawer.

- Admin warnings should:
  1. Insert into `user_warnings` with reason/severity/duration and `issued_by = auth.uid()`.
  2. Update `profiles.warn_count`, `moderation_status`, `suspension_until` accordingly.
  3. Insert a `moderation_log` row for audit purposes.
  4. Cause the frontend to show updated warning counts and history.

- AdminAuditLog should always be able to load and display the latest actions without referencing non-existent columns or hitting RLS errors, thanks to the admin-only policies established in migration 0011.
