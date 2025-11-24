# Playwright Setup

Playwright is used here for a fast smoke check of the running app, catching console errors, failed network calls, and saving artifacts that can be reviewed (or fed to an AI) after each run.

## How to run
- Terminal 1: `npm run dev -- --port 8080`
- Terminal 2: `npm run test:e2e`

## Test credentials
- E2E tests expect env-based credentials. Copy `.env.test.example` to `.env.test` and fill with real seeded Supabase accounts:
  - `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (standard user)
  - `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` (admin user, if needed)
- `playwright.config.ts` loads `.env.test` automatically via `dotenv`.
- Running examples:
  - Terminal 1: `npm run dev -- --port 8080`
  - Terminal 2: `npm run test:e2e` (or `npx playwright test tests/add-catch.spec.ts`)

## What the smoke test does
- Opens the homepage at `http://localhost:8080/`
- Fails if any console errors or failed network requests occur
- Verifies the page renders (`body` visible) before collecting artifacts

## Artifacts produced
- `artifacts/homepage.png` (full-page screenshot)
- `artifacts/homepage.html` (page HTML)
- `artifacts/homepage-report.json` (URL, console errors, failed requests, timestamp)

Note: The HTML and JSON artifacts can be pasted into an LLM to review the page for issues.
