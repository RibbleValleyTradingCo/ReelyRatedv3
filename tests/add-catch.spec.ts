import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachErrorTracking } from './helpers/errorTracking';
import { saveArtifacts } from './helpers/artifacts';
import { loginViaUi } from './helpers/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Add catch flow', () => {
  test('user can add a catch via the form', async ({ page }) => {
    const { consoleErrors, failedRequests } = attachErrorTracking(page);

    await loginViaUi(page, 'standard');

    await page.goto('/add-catch');
    await expect(page.getByTestId('add-catch-form')).toBeVisible();

    const imagePath = path.join(__dirname, 'fixtures', 'catch.png');
    await page.getByLabel(/main photo/i).setInputFiles(imagePath);

    await page.getByLabel(/^Title/i).fill('E2E Test Catch');

    await page.getByTestId('species-combobox').click();
    await page.getByRole('option', { name: 'Common Carp' }).click();

    await page.getByTestId('fishery-combobox').click();
    await page.getByRole('option', { name: 'Farlows Lake, Buckinghamshire' }).click();

    await page.getByRole('button', { name: /publish catch/i }).click();

    await page.waitForURL(/\/feed/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByTestId('feed-root')).toBeVisible();
    const newCatchCard = page.getByTestId('catch-card').filter({ hasText: 'E2E Test Catch' });
    await expect(newCatchCard.first()).toBeVisible();

    await saveArtifacts(page, 'add-catch', consoleErrors, failedRequests);

    if (consoleErrors.length || failedRequests.length) {
      const details = [
        ...consoleErrors.map((entry) => `console error: ${entry}`),
        ...failedRequests.map((entry) => `request failed: ${entry}`),
      ].join('\n');
      throw new Error(
        `Detected ${consoleErrors.length} console error(s) and ${failedRequests.length} failed request(s).\n${details}`
      );
    }

    // TODO: Add UI cleanup to delete the created catch once a stable path exists.
  });
});
