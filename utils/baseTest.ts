/**
 * baseTest.ts
 *
 * Extended Playwright test fixture.
 * Provides:
 *   - Automatic screenshot capture on test end (pass or fail)
 *   - Payment URL capture (page.url() on pass)
 *   - Result JSON written to .temp-results/ for report generation
 *   - Captcha helper re-exported for convenience
 *
 * Each Playwright worker is a separate process, so module-level
 * variables are isolated per worker — no concurrency issues.
 */

import {
  test as base,
  expect,
  Page,
  TestInfo,
} from '@playwright/test';
import { waitForCaptcha } from './captcha/captchaHelper';
import { captureScreenshot, getCapturedScreenshots, clearCapturedScreenshots } from './screenshot';
import path from 'path';
import fs from 'fs';

export { captureScreenshot };

// ─── Result data structure ───

export interface TestResultData {
  testScript: string;
  testName: string;
  device: string;
  deviceType: string;
  browser: string;
  viewport: string;
  status: 'PASS' | 'FAIL' | 'RETRY_PASS';
  retries: number;
  duration: number;
  paymentUrl: string;
  screenshotPath: string;
  error: string;
  failedStep: string;
  startTime: string;
  endTime: string;
}

// ─── Fixture types ───

function getFallbackTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

export function getUploadFile(): string {
  const uploadCandidates = [
    path.resolve(process.cwd(), 'tests', 'assets', '10kb.jpg'),
    path.resolve(process.cwd(), 'debug-chromium-desktop.png'),
  ];
  return uploadCandidates.find(c => fs.existsSync(c)) || uploadCandidates[0];
}

type MyFixtures = {
  page: Page;
  /** Re-exported captcha helper for convenient import */
  waitForCaptcha: typeof waitForCaptcha;
  getUploadFile: typeof getUploadFile;
};

// ─── Extend test ───

export const test = base.extend<MyFixtures>({
  page: async ({ page }, use) => {
    // Configurable timeouts passed from Dashboard execution session
    const envActionTimeout = process.env.PLAYWRIGHT_ACTION_TIMEOUT ? parseInt(process.env.PLAYWRIGHT_ACTION_TIMEOUT, 10) : NaN;
    const envNavTimeout = process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT ? parseInt(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT, 10) : NaN;

    const actionTimeout = (!isNaN(envActionTimeout) && envActionTimeout > 0) ? envActionTimeout : 15_000;
    const navTimeout = (!isNaN(envNavTimeout) && envNavTimeout > 0) ? envNavTimeout : 30_000;

    page.setDefaultTimeout(actionTimeout); // Configurable wait for all actions (click, fill, select, locator waits)
    page.setDefaultNavigationTimeout(navTimeout); // Configurable wait for page navigations and redirects
    await use(page);
  },
  waitForCaptcha: async ({}, use) => {
    await use(waitForCaptcha);
  },
  getUploadFile: async ({}, use) => {
    await use(getUploadFile);
  },
});

// Re-export expect for convenience
export { expect };

// ─── AfterEach: Capture results ───

test.afterEach(async ({ page }, testInfo: TestInfo) => {
  // Extract device and browser from project name
  // Project name format: "Desktop-Chrome", "iPhone 14-Safari", etc.
  const projectName = testInfo.project.name || 'Unknown-Unknown';
  const lastHyphen = projectName.lastIndexOf('-');
  const device = lastHyphen > 0 ? projectName.substring(0, lastHyphen) : projectName;
  const browser = lastHyphen > 0 ? projectName.substring(lastHyphen + 1) : 'Unknown';

  const scriptName = path.basename(testInfo.file || 'unknown.spec.ts');
  const testName = testInfo.title;
  const isPassed = testInfo.status === 'passed';
  const isRetried = testInfo.retry > 0;

  // Determine final status
  let status: TestResultData['status'];
  if (isPassed && isRetried) {
    status = 'RETRY_PASS';
  } else if (isPassed) {
    status = 'PASS';
  } else {
    status = 'FAIL';
  }

  // Format duration
  const durationMs = testInfo.duration;
  const durationSec = (durationMs / 1000).toFixed(1);

  // Timestamps
  const startTime = new Date(
    Date.now() - durationMs
  ).toISOString().replace('T', ' ').substring(0, 19);
  const endTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Get viewport info
  let viewportStr = 'N/A';
  try {
    if (page && !page.isClosed()) {
      const vp = page.viewportSize();
      if (vp) viewportStr = `${vp.width} x ${vp.height}`;
    }
  } catch {}

  // Capture payment URL (if test passed, current page URL is payment page) and capture page screenshot
  let paymentUrl = 'N/A';
  let capturedUrlScreenshot: string | null = null;

  try {
    if (page && !page.isClosed()) {
      if (isPassed) {
        paymentUrl = page.url();
      }

      // Automatically capture screenshot of the page whose URL was captured
      try {
        const sessionTimestamp = process.env.SESSION_TIMESTAMP || getFallbackTimestamp();
        const testKey = scriptName.replace(/\.(spec|test)\.(ts|js)$/, '');
        const cleanName = `${testKey}-${device}-${browser}-captured-url.png`
          .toLowerCase()
          .replace(/[^a-z0-9\-_.]/g, '-');

        const relativeDir = path.join('screenshots', sessionTimestamp, testKey);
        const fullDir = path.join(process.cwd(), relativeDir);
        fs.mkdirSync(fullDir, { recursive: true });

        const fullPath = path.join(fullDir, cleanName);
        const relativePath = `/screenshots/${sessionTimestamp}/${testKey}/${cleanName}`.replace(/\\/g, '/');

        // Also mirror to reports/screenshots/ for standalone report viewing
        const reportsDir = path.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, testKey);
        fs.mkdirSync(reportsDir, { recursive: true });
        const reportsFullPath = path.join(reportsDir, cleanName);

        await page.screenshot({
          path: fullPath,
          fullPage: true,
          timeout: 5000,
        });

        if (fs.existsSync(fullPath)) {
          fs.copyFileSync(fullPath, reportsFullPath);
        }

        capturedUrlScreenshot = relativePath;
      } catch (screenshotErr: any) {
        console.warn(
          `[baseTest] Failed to capture screenshot of URL page for ${scriptName}:`,
          screenshotErr?.message || screenshotErr
        );
      }
    }
  } catch {}

  // Evaluate captured screenshots
  let finalScreenshotPath = 'N/A';
  const isScreenshotEnabled = process.env.ENABLE_SCREENSHOT_CAPTURE === 'true';

  if (capturedUrlScreenshot) {
    finalScreenshotPath = capturedUrlScreenshot;
  } else if (isScreenshotEnabled) {
    const captured = getCapturedScreenshots();
    if (captured && captured.length > 0) {
      finalScreenshotPath = captured[captured.length - 1];
      if (!finalScreenshotPath.startsWith('/')) {
        finalScreenshotPath = '/' + finalScreenshotPath;
      }
    }
  }
  clearCapturedScreenshots();

  // Extract error info
  let errorMessage = '';
  let failedStep = '';
  if (!isPassed && testInfo.error) {
    errorMessage = testInfo.error.message || '';
    // Try to extract a meaningful step name from error
    const stepMatch = errorMessage.match(/waiting for.*?["'](.+?)["']/i);
    if (stepMatch) {
      failedStep = stepMatch[1];
    } else {
      failedStep = 'Unknown';
    }
    // Truncate very long errors
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
  }

  // Build result object
  const result: TestResultData = {
    testScript: scriptName,
    testName: testName,
    device: device,
    deviceType: (device === 'Desktop') ? 'Desktop' : 'Mobile',
    browser: browser,
    viewport: viewportStr,
    status: status,
    retries: testInfo.retry,
    duration: parseFloat(durationSec),
    paymentUrl: paymentUrl,
    screenshotPath: finalScreenshotPath,
    error: errorMessage,
    failedStep: failedStep,
    startTime: startTime,
    endTime: endTime,
  };

  // Write result JSON to .temp-results/
  // Filename is deterministic — same test+device+browser overwrites on retry
  // So only the FINAL attempt's result survives
  const resultDir = path.join(process.cwd(), '.temp-results');
  fs.mkdirSync(resultDir, { recursive: true });

  const testKey = scriptName.replace(/\.(spec|test)\.(ts|js)$/, '');
  const resultFileName = `${testKey}__${device}__${browser}.json`;
  const resultFilePath = path.join(resultDir, resultFileName);

  try {
    fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), 'utf8');
  } catch (writeError) {
    console.error(
      `[baseTest] Failed to write result JSON for ${testKey}:`,
      writeError
    );
  }
});