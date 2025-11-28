ReelyRated – Feature Inventory

This document captures the full set of features our fishing social web app should include over time.

It’s not a strict “must-have for launch” list – think of it as the long-term feature map. We’ll decide per-phase what to implement.

⸻

1. Accounts, Auth & Identity

Core
• Email/password sign up & login
• Password reset
• Session management (remembered sessions, refresh tokens)
• Basic security:
• Brute-force protections
• Email verification
• Account deletion & data export (eventually)

Future / optional
• Social login (Apple / Google, etc.)
• 2FA
• Device management (list + revoke sessions)

⸻

2. Profiles & Reputation

Core
• User profile page:
• Username / handle
• Display name
• Bio
• Avatar
• Profile stats:
• Number of catches
• Followers / following counts
• Roles / flags:
• Admin flag
• (Later) Verified / special roles

Fishing-specific
• Extra fields:
• Home region / waters (coarse, not spot-level)
• Preferred species
• Experience level (beginner / intermediate / advanced)
• Optional gear preferences (brands / styles)

Future
• Badges / achievements:
• Personal best (PB) badges per species
• “Top contributor” / challenge badges

⸻

3. Social Graph & Relationships

Core
• Follow / unfollow other users
• Followers / following lists
• Block / mute specific users
• Public vs private profiles (future toggle)

Future
• “Close friends” / “crew” list (for more private sharing later)

⸻

4. Catches, Posts & Media

Core
• Catch posts with:
• Title / description
• Photos (single or multiple)
• Species
• Weight and/or length
• Date/time
• Venue / water (with privacy considerations)
• Visibility per catch:
• Public
• Followers-only
• Private (only me)
• Basic media handling:
• Image upload
• Thumbnails
• Safe, locked-down storage (RLS)

Fishing-specific details (target)
• Capture:
• Water type (lake, river, canal, sea, etc.)
• Bait / rig / method
• Optional conditions (weather, time-of-day)
• “Session” / trip concept (future):
• Group multiple catches under one session

Future
• Video support
• Drafts & editing of catches

⸻

5. Feeds & Discovery

Core
• Home feed:
• Catches from people you follow
• Optionally some recommended content
• Catch detail page with:
• Comments
• Ratings / reactions
• Related catches

Fishing-specific
• Simple filters:
• Species filter in feed
• Basic region/venue filter

Future
• Explore / Discover:
• Trending catches
• Top-rated catches
• “PB of the week”
• More advanced filters:
• By water, species, weight range
• “Local waters” based on region

⸻

6. Engagement: Likes, Ratings, Comments, Mentions

Core (much of this already exists)
• Likes / reactions on catches
• Numeric ratings on catches (e.g. 1–10)
• Comment system with:
• Top-level comments
• Replies (threaded)
• Soft delete (tombstones)
• @mentions in comments:
• Autocomplete for usernames
• Mention notifications

Comment UX
• Optimistic posting
• Highlight & scroll to specific comment (commentId deep-link)
• “View more replies” / “Load more comments” for pagination
• OP and Admin badges on comments

Future
• Optional: “answer accepted” / “helpful reply” style markers
• Allow creators to lock/disable comments on a catch

⸻

7. Notifications

Core (we already have the base types)
• User-facing:
• new_comment – when someone comments on your catch
• comment_reply – when someone replies to your comment
• mention – when you’re @mentioned in a comment
• new_reaction – likes/reactions on your catch
• new_rating – ratings on your catch
• new_follower – new followers
• Admin / system:
• admin_report – admins notified of new reports
• admin_warning – user warned by admin
• admin_moderation – moderation actions on user content

Behaviour
• In-app notification bell & list
• Deep-linking:
• Comment-related → catch page with highlighted comment
• Reaction/rating → catch page
• Follow → profile
• Admin types → reports / moderation / profile

Future
• Email summaries (optional opt-in), e.g. weekly highlights
• “Your catch just became a PB” or “Your PB moved up the leaderboard”

⸻

8. Search & Browse

Core (target)
• Search users by username
• Search catches by:
• Text in title/description
• Species

Future
• Advanced search:
• Species + weight range
• Venue / water
• Time range (recent / seasonal)
• Browse by:
• Species
• Water type
• Region

⸻

9. Messaging & Sharing (Later)

Not required for early launch, but useful later
• Direct messages (1:1 or small groups)
• Share a catch with a friend (in-app or via link)
• “Invite to trip” style messages

Given moderation complexity, messaging is a later-phase feature.

⸻

10. Leaderboards, Personal Bests & Stats

Core (target)
• Personal best (PB) tracking:
• Store PB per species (weight/length)
• Show PBs on profile

Future / nice-to-have
• Leaderboards:
• By species (heaviest fish)
• Time-bounded (this year / all time)
• Filters by region / water type
• Personal stats:
• Catches per month
• Species breakdown
• Venue breakdown
• Seasonal challenges:
• Species hunts
• Venue challenges

⸻

11. Safety, Moderation & Reporting

Core (much already implemented)
• Reporting:
• Report catches
• Report comments
• Report profiles
• Admin tools:
• AdminReports dashboard (triage reports)
• AdminAuditLog (all moderation actions)
• AdminUserModeration (per-user status, warnings, history)
• Moderation actions:
• Warn user (user_warnings)
• Suspend user (moderation_status + suspension_until)
• Ban user (moderation_status = banned)
• Delete / restore catch
• Delete / restore comment
• Enforcement:
• Suspended/banned users cannot:
• Post comments
• Create new catches
• Admins always bypass enforcement
• Audit:
• moderation_log table
• All admin actions logged (warn, delete, restore, etc.)

Future
• User-facing tools:
• Block user (hide their content & interactions)
• Mute user (hide from feeds without blocking)
• Visibility tuning:
• Shadow restrictions (limit reach of problematic accounts) – future idea

⸻

12. Profile & Avatar Management

Core
• Avatar upload:
• Safe handling (supabase storage, RLS)
• Basic crop/scale (even if just via CSS)
• Profile settings:
• Update username, bio, avatar
• Change email / password
• Privacy settings (later):
• Account public vs private

Future
• Media library (“My uploads”)
• Header/banner images for profiles

⸻

13. Onboarding & Growth

Core (target)
• Basic onboarding:
• Pick username & avatar
• (Optional) select favourite species/regions
• Suggest accounts to follow (later)
• Lightweight email notifications (optional) for key events (e.g. “You were mentioned”)

Future
• Onboarding flows tuned for anglers:
• “What kind of fishing do you do?”
• “What waters do you fish most?”
• Re-engagement:
• Weekly “Your week in review”
• “New PBs / top catches from people you follow”

⸻

14. Admin Tools & Observability

Core (already in progress)
• Admin-only pages:
• /admin/reports – triage reports
• /admin/audit-log – moderation log viewer
• /admin/users/:userId/moderation – per-user moderation overview
• Admin-only nav and permissions
• Notifications for admins (admin_report, admin_warning, admin_moderation)

Future
• Global admin dashboard:
• New users per day
• Active users
• Number of catches/comments per day
• Reports per day & resolution time
• UI to manage:
• admin_users (who is an admin)
• Global config (e.g. rate limits, thresholds)

⸻

15. Monetisation (Future phases only)

Not required for early launch, but keep in mind
• Brand / tackle-shop profiles
• Sponsored catches or posts
• Premium subscription features:
• More detailed analytics
• Advanced filters/leaderboards
• Creator support / tipping (maybe)
