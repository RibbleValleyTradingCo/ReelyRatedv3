# Recent Work Overview

Concise map of the latest shipped areas. Use this as a hub to jump to full specs and tests.

## Safety & Account Lifecycle
- Account deletion flow shipped (request RPC, sign-out, confirmation page) with test plan. Read: docs/ACCOUNT-DELETION-AND-EXPORT-DESIGN.md, docs/ACCOUNT-DELETION-TESTS.md.
- Block/mute system live (profile blocks, UI stubs, RLS impacts). Read: docs/BLOCK-MUTE-DESIGN.md, docs/BLOCK-MUTE-TESTS.md.

## Profiles & Admin Identity
- Profile page refactored into container + presentational components; admin/staff UX distinct from anglers. Read: docs/PROFILE-REFACTOR-PLAN.md.
- Admin identity and tools overview (reports, audit log, moderation flows). Read: docs/ADMIN-OVERVIEW.md, docs/ADMIN-UI-ROADMAP.md.

## Venues & Events
- Venue metadata/stats powering cards and hero (tagline, price_from, tags/facilities, venue_stats). Read: docs/VENUE-PAGES-DESIGN.md.
- Admin venue editing + events (metadata RPC, events CRUD, upcoming/past events on venue detail). Roadmap/design: docs/VENUE-PAGES-ROADMAP.md, docs/VENUE-PAGES-DESIGN.md.

## Where to Look Next
- Data model & RLS source of truth: docs/ERD.md.
- Frontend routes/components map: docs/frontend-map-of-pages.md.
- Upcoming/features pipeline: docs/FEATURE-ROADMAP.md.
