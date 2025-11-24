import { expect, type Page } from '@playwright/test';
import { testUsers } from '../fixtures/data';

export const loginViaUi = async (page: Page, userType: 'standard' | 'admin' = 'standard') => {
  const creds = testUsers[userType];
  if (!creds?.email || !creds?.password) {
    throw new Error(`Missing credentials for ${userType} user. Check TEST_USER_EMAIL/PASSWORD or TEST_ADMIN_EMAIL/PASSWORD.`);
  }

  await page.goto('/auth');
  await page.getByRole('tab', { name: /sign in/i }).click();
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 });

  await page.goto('/feed');
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page.locator('body')).toBeVisible();
};

export const logoutViaUi = async (page: Page) => {
  await page.goto('/settings/profile');
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL(/\/auth/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.locator('#signin-email')).toBeVisible();
};
