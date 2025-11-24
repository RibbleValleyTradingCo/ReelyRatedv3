import { expect, test } from '@playwright/test';
import { attachErrorTracking } from './helpers/errorTracking';
import { saveArtifacts } from './helpers/artifacts';

test.describe('Site smoke test', () => {
  test('loads homepage without console or network errors', async ({ page }) => {
    const { consoleErrors, failedRequests } = attachErrorTracking(page);

    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    await saveArtifacts(page, 'homepage', consoleErrors, failedRequests);

    if (consoleErrors.length || failedRequests.length) {
      const details = [
        ...consoleErrors.map((entry) => `console error: ${entry}`),
        ...failedRequests.map((entry) => `request failed: ${entry}`),
      ].join('\n');
      throw new Error(
        `Detected ${consoleErrors.length} console error(s) and ${failedRequests.length} failed request(s).\n${details}`
      );
    }
  });
});
