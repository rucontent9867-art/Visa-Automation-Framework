/**
 * Auto-generated single-execution Playwright config
 * Created: 2026-11-10T17:05:38.709Z
 * File: azerbaijan-visa.spec.ts
 * Project: Desktop-Chromium
 */

import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/ms-playwright')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
}

export default defineConfig({
  testDir: './tests/spec',
  testMatch: '**/azerbaijan-visa.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'Desktop-Chromium',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        actionTimeout: 15000,
        navigationTimeout: 30000,
        screenshot: { mode: 'only-on-failure', fullPage: true },
        launchOptions: {
        headless: true,
        args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],
      },
      },
    },
  ],
});
