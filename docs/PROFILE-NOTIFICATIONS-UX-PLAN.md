# Profile & Notifications UX Plan (Presentation-Only)

**Scope:**  
Refine the **Profile** page and **notifications/account status** experience so it feels like a polished personal dashboard, **without changing any Supabase logic, RPCs, or routing behaviour**. All changes must be presentational only (layout, styling, and small copy tweaks).

---

## 1. Guardrails

- ✅ **Do NOT change:**
  - Supabase queries, RPC calls, or database schema.
  - Routing destinations (e.g. where buttons/notifications navigate).
  - Core behaviours such as follow/unfollow, moderation enforcement, or notification fetching.
- ✅ **Allowed:**
  - Tweaks to React/TSX structure for layout (wrapping in new layout components, reordering sections visually).
  - Tailwind/CSS class changes, including new utility classes or small component-level styles.
  - Small copy edits to labels, headings, descriptions, and helper text.
  - New _presentational_ subcomponents (e.g. `ProfileSectionCard`, `NotificationRow`) as long as they use existing props/data.

---

## 2. Current Structure (High-Level)

- Page: `Profile` (e.g. `src/pages/Profile.tsx`).

  - Dark hero header: avatar, username, intro, buttons (Add catch, Status, View my stats, Account settings, View community feed). Admins also see “View moderation”.
  - Angler stats cards: total catches, average rating, heaviest catch, top species.
  - **Own profile only:**
    - Account status + warnings info.
    - Notifications list.
  - “Anglers you follow” section.
  - “Your catches” grid.

- Notifications & status:
  - Components: `ProfileNotificationsSection`, `NotificationListItem`, and supporting hooks/utilities.
  - Uses existing notification types (`admin_warning`, `admin_moderation`, `new_comment`, `new_rating`, etc.).
  - Account status uses `moderation_status`, `warn_count`, `suspension_until` from `profiles`.

This plan sits on top of that behaviour and adjusts _only how it looks and reads_.

---

## 3. Goals

1. Make the profile feel like a **personal dashboard** (“My account”) rather than just a list of cards.
2. Align styling with the updated **Home** and **Add Catch** pages (soft cards, gradients, clear CTAs).
3. Improve the **Account status + Notifications** area so moderation and activity are easy to understand at a glance.
4. Keep the experience **mobile-friendly and tap-friendly**.

---

## 4. Hero / Header Strip

### 4.1 Presentation updates

- [ ] Keep the dark gradient hero, but adjust content layout and copy:
  - [ ] Make **“Add catch”** the primary CTA (ocean gradient style, consistent with Home/Feed).
  - [ ] Keep **“View my stats”** and **“Account settings”** as secondary buttons.
  - [ ] Keep **“View community feed”** as a tertiary/ghost button.
- [ ] Rename the button currently labelled **“Status”** to **“Edit profile”** (or similar), keeping its existing behaviour (bio edit or profile settings) unchanged.
- [ ] Add small inline badges under the username (when data available):
  - [ ] `@username` (always).
  - [ ] `Joined {year}` (if derivable from existing profile data; otherwise omit).
  - [ ] A **status pill** derived from existing moderation fields:
    - Active → neutral/light pill.
    - Warned → amber pill.
    - Suspended (with `suspension_until`) → orange pill (“Suspended until {date}”).
    - Banned → red pill (“Banned”).
- [ ] Bio handling:
  - [ ] If no bio, show a short muted placeholder:  
         _“No intro yet. Tell others where you fish and what you target.”_
  - [ ] If bio exists:
    - [ ] Maintain current content, but style with:
      - Slightly smaller font on mobile.
      - Optional max-height + gradient fade with **Show more / Show less** client-side toggle for long bios.

### 4.2 Constraints

- No changes to profile-fetching logic or edit behaviour.
- Status pill must use existing `moderation_status` and `suspension_until` (no new fields or RPC calls).

---

## 5. Middle Dashboard Band (Stats, Account Status, Notifications)

### 5.1 Angler stats row

- [ ] Keep existing statistics and calculation logic intact.
- [ ] Restyle the four stat cards to match the modern “card” language:
  - Soft background, border, and shadow (similar to Add Catch sections).
  - Larger numeric value, slightly smaller label.
  - Icons (if any) should be subtle and aligned with the existing icon set.

### 5.2 Account status card (own profile only)

- [ ] Ensure this appears only when:
  - `moderation_status` is non-active _or_
  - `warn_count > 0`.
- [ ] In the card, show:
  - [ ] A header: **“Account status”**.
  - [ ] A prominent status label (“Active”, “Warned”, “Suspended until …”, “Banned”).
  - [ ] A pill: **“Warnings: X/3”** using existing `warn_count`.
  - [ ] Short description text aligned with current moderation rules:
    - Active + 0 warnings: message may be omitted along with the card.
    - Warned: guidance like “You can keep posting, but please follow community guidelines.”
    - Suspended/Banned: clear statement that posting is restricted, using existing copy patterns.
- [ ] Align the visual style with the Add Catch “status” panels (soft card, subtle emphasis).

> **Note:** Only change copy and layout; do not change how moderation status is computed or updated.

### 5.3 Notifications card (own profile only)

- On **desktop (md+)**:
  - [ ] Place **Account status** and **Notifications** side-by-side in a two-column layout.
- On **mobile**:
  - [ ] Stack **Account status** above **Notifications**.

**Within the Notifications card:**

- [ ] Header row:
  - [ ] Title: **“Notifications”**.
  - [ ] Optional small pill: `Unread: N` (using existing unread logic; or infer from `is_read` if already available).
  - [ ] Place `Refresh`, `Mark all read`, and `Clear all` as small text buttons aligned to the right, not as heavy primary buttons.
- [ ] Notification list styling:
  - [ ] Each notification row uses:
    - [ ] A type-specific icon (re-use existing ones where possible):
      - Star for ratings.
      - Message bubble for comments/replies.
      - User-plus for new followers.
      - Bell or shield for admin/moderation.
    - [ ] A short title (existing mapped title text).
    - [ ] One-line body snippet (existing body, trimmed as needed).
    - [ ] A muted timestamp like “2h ago”, “Yesterday”, aligned to the right.
  - [ ] Make the **entire row clickable** to use the existing navigation behaviour (keep any dedicated “View” button but visually de-emphasise it).
  - [ ] Use a subtle background highlight for unread rows.
- Optional (if easy with existing data):
  - [ ] Group notifications by “Today”, “Yesterday”, “Earlier this week” headings—purely presentational.

---

## 6. “Anglers you follow” Section

### 6.1 When user follows others

- [ ] Present followed anglers as a **row of compact avatar chips or mini-cards**:
  - Avatar + username, optional small stat (e.g. total catches).
- [ ] On mobile:
  - [ ] Allow horizontal scrolling for this row (e.g. `overflow-x-auto`, `snap-x`) to avoid tall stacked layouts.

### 6.2 When user follows no one

- [ ] Simplify the empty state:
  - One short line: “You’re not following anyone yet.”
  - One helper line: “Browse the feed and follow anglers to see their PBs here.”
  - A single “Go to feed” button.
- [ ] Make the card visually lighter (shorter height) so it doesn’t dominate the page.

### 6.3 Constraints

- Follow/unfollow mechanics and queries must not change.
- No new backend calls; only reusing the existing `following` data.

---

## 7. “Your catches” Section

- [ ] Add a header row above the grid:
  - [ ] Left: **“Your catches”**.
  - [ ] Right: secondary button **“Log a catch”** linking to the existing Add Catch route.
- [ ] If the user has **no catches**:
  - [ ] Show an empty state styled similarly to the Feed page’s empty community state (icon + short text + CTA to “Log a catch”).
- [ ] If the user has catches:
  - [ ] Keep using the existing catch-card grid component.
  - [ ] Adjust top margin/padding so it visually aligns with Feed’s grid spacing.

No changes to how catches are fetched or filtered.

---

## 8. Notification Rendering Details

In `NotificationListItem` and related components:

- [ ] Ensure moderation-related notifications (warnings, suspensions, bans, lifted restrictions) continue to:
  - Use friendly, non-technical copy (no raw enum names).
  - Link to `profile#notifications` or the appropriate catch/comment as already defined by `resolveNotificationPath`.
- [ ] Check that any copy tweaks remain consistent with the moderation enforcement and admin docs.
- [ ] Keep all routing logic intact – do not change where a click navigates, only **how** the row looks.

---

## 9. Mobile Behaviour & QA Checklist

After implementation, manually verify:

- [ ] Hero section:
  - Buttons wrap cleanly on iPhone-sized viewports.
  - Primary CTA (“Add catch”) remains prominent and accessible.
- [ ] Stats / status / notifications:
  - Stats row wraps or stacks without overlapping.
  - Account status and notifications stack vertically on small screens.
  - Notification rows are clearly tappable and not cramped.
- [ ] “Anglers you follow”:
  - Horizontal scroll works and doesn’t overflow awkwardly.
- [ ] “Your catches”:
  - Grid behaves similar to Feed on small screens.
- [ ] No scroll-jumps or layout glitches introduced on profile/notifications routes.

---

## 10. Out of Scope (for this phase)

- ❌ Changing or adding any RPCs or Supabase functions.
- ❌ Modifying moderation logic or enforcement rules.
- ❌ Implementing new notification types or back-end filtering.
- ❌ Building new pages (e.g., a separate “Account dashboard” route).
- ❌ Any SEO/meta changes.

This document is a **presentation-only UX plan**; implementation must respect the existing application behaviour and backend contracts.
