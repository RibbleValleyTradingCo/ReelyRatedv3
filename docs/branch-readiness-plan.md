# Branch Readiness Plan

## Current State
- `supabase/config.toml` currently points to project `rxvvtklyzisqgxzkgbvd` (not the main ref `omsvmiufwvdeslcyrmkt`). Attempting to run `supabase link --project-ref omsvmiufwvdeslcyrmkt` failed because the CLI is not logged in (`Access token not provided`).
- Local migrations directory contains sequential files `0003` through `0022`, plus a `_archive` folder with legacy SQL (e.g. `phase1_migration.sql`). There are duplicate numeric prefixes (`0012_admin_moderation_functions.sql` and `0012_phase3_moderation_tweaks.sql`).
- Supabase CLI commands that inspect remote migration history (`supabase migration list`) currently fail for the same login reason, so I could not verify remote vs local history yet.

## Risk Assessment
- Until the CLI is linked to the main project, we cannot confirm that remote history matches the local files. Branching from the dashboard would still run whatever migrations Supabase has on record, but we risk gaps if the remote DB contains changes that never landed in migrations (or vice versa).
- The presence of two `0012_*` migrations is acceptable only if both were applied consistently everywhere. Without inspecting remote history we cannot confirm this, so there is a moderate risk that a new branch could stop after the first `0012` file and miss the second.
- The `_archive/phase1_migration.sql` file is harmless (Supabase ignores `_archive`), but anyone manually copying files could accidentally re-run it; keeping it isolated is fine.

## Suggested Fixes Before Creating a New Branch
1. **Link the CLI to main**
   - Run `supabase login` with a personal access token, then `supabase link --project-ref omsvmiufwvdeslcyrmkt` so `config.toml` reflects the main project.
2. **Verify migration history**
   - After linking, run `supabase migration list` and ensure every remote entry from `0003` through `0022` exists locally. If remote history has extra migrations, capture them with `supabase db diff --linked` to generate an `0023_*.sql` migration.
3. **Handle duplicate prefixes**
   - If both `0012` files are part of remote history in the same order, leave them as-is (Supabase processes them alphabetically by filename). If the remote history shows only one of them, create a new migration that reproduces the missing changes instead of renumbering old files.
4. **Capture any remote-only changes**
   - If `supabase db diff` shows differences (tables/RPCs/policies) that exist remotely but not locally, store them in a new numbered migration so future branches are complete.

## When we create a new Supabase branch, do this:
- Use the repo’s `main` branch (or whichever Git branch contains the full migrations set) as the source of truth.
- In the Supabase Dashboard → Branches, ensure "Use Git migrations" is enabled for the project before creating the branch.
- After the branch is created, run `supabase link --project-ref <branch-ref>` (requires token) and `supabase migration list` to confirm the new branch shows the same migration history. Optionally run quick checks via the SQL editor (`select count(*) from public.catches;`) to ensure tables exist.
- Never run `supabase db reset` or other destructive commands against the main project; limit resets to temporary branches or local Docker instances.
