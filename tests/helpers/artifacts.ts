import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const saveArtifacts = async (
  page: Page,
  name: string,
  consoleErrors: string[],
  failedRequests: string[],
) => {
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  await page.screenshot({
    path: path.join(artifactsDir, `${name}.png`),
    fullPage: true,
  });

  const htmlContent = await page.content();
  fs.writeFileSync(path.join(artifactsDir, `${name}.html`), htmlContent);

  const report = {
    name,
    url: page.url(),
    consoleErrors,
    failedRequests,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(artifactsDir, `${name}-report.json`),
    JSON.stringify(report, null, 2),
  );
};
