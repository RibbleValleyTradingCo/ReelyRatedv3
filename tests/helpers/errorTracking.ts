import type { Page } from '@playwright/test';

export const attachErrorTracking = (page: Page) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const reason = failure?.errorText ?? 'unknown error';
    if (reason === 'net::ERR_ABORTED') {
      return;
    }
    failedRequests.push(`${request.method()} ${request.url()} - ${reason}`);
  });

  return { consoleErrors, failedRequests };
};
