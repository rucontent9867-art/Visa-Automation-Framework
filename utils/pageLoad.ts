/**
 * pageLoad.ts
 *
 * Reliable "wait until the page is fully loaded" helper.
 * Provides a single, robust wait that:
 *   1. Waits for the `load` event (DOM + resources finished loading).
 *   2. Attempts `networkidle` with a bounded timeout (non-fatal on timeout).
 *   3. Ensures <body> is visible as a final fallback.
 */

import { Page } from '@playwright/test';

export interface WaitForPageLoadOptions {
  networkIdleTimeout?: number;
  loadTimeout?: number;
  verbose?: boolean;
}

export async function waitForPageLoad(
  page: Page,
  options: WaitForPageLoadOptions = {}
): Promise<void> {
  const {
    networkIdleTimeout = 5_000,
    loadTimeout = 30_000,
    verbose = false,
  } = options;

  try {
    await page.waitForLoadState('load', { timeout: loadTimeout });
  } catch (err) {
    if (verbose) {
      console.warn(
        '[waitForPageLoad] `load` event timed out, continuing:',
        err instanceof Error ? err.message : err
      );
    }
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout });
  } catch (err) {
    if (verbose) {
      console.warn(
        '[waitForPageLoad] `networkidle` not reached within',
        networkIdleTimeout,
        'ms, continuing:',
        err instanceof Error ? err.message : err
      );
    }
  }

  try {
    await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    // Non-fatal fallback
  }
}
