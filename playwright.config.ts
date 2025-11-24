import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

// Load environment variables for E2E tests
dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
});
