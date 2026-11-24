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
import { solveRecaptchaAudio, RecaptchaAudioOptions } from './captcha/recaptchaAudio';
import { waitForPageLoad, WaitForPageLoadOptions } from './pageLoad';
import { submitContactUsForm } from './contactUs';
import { captureScreenshot, getCapturedScreenshots, clearCapturedScreenshots } from './screenshot';
import {
  setupUrlTracker,
  trackUrl,
  recordCustomUrl,
  getTrackedUrls,
  getCapturedUrls,
  clearTrackedUrls,
  TrackedUrlRecord,
} from './urlTracker';
import {
  verifyDirectUrls,
  extractOrderId,
  DirectUrlVerificationOptions,
  DirectUrlVerificationResult,
} from './directUrlVerifier';
import path from 'path';
import fs from 'fs';

export {
  captureScreenshot,
  captureScreenshot as capturescreenshot,
  verifyDirectUrls,
  extractOrderId,
  trackUrl,
  recordCustomUrl,
  getTrackedUrls,
  getCapturedUrls,
  clearTrackedUrls,
  setupUrlTracker,
};
export type { TrackedUrlRecord, DirectUrlVerificationOptions, DirectUrlVerificationResult };

// ─── Result data structure ───

export interface TestResultData {
  testScript: string;
  testName: string;
  device: string;
  deviceType: string;
  browser: string;
  viewport: string;
  status: 'PASS' | 'FAIL' | 'RETRY_PASS' | 'SKIPPED';
  retries: number;
  duration: number;
  paymentUrl: string;
  capturedUrls: string[];
  urlHistory: TrackedUrlRecord[];
  screenshotPath: string;
  contactUsEnabled: boolean;
  contactUsStatus: string;
  contactUsScreenshot: string;
  contactUsReason: string;
  visaStatusUrl: string;
  visaStatusScreenshot: string;
  completePartiallyUrl: string;
  completePartiallyScreenshot: string;
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
  /** Solves Google reCAPTCHA v2 challenges (audio via Gemini, with visual grid fallback) */
  solveRecaptchaAudio: (options?: RecaptchaAudioOptions) => Promise<boolean>;
  /** Wait until the page is fully loaded (non-throwing) */
  waitForPageLoad: (options?: WaitForPageLoadOptions) => Promise<void>;
  getUploadFile: typeof getUploadFile;
  /** Utility method to track / label URL changes explicitly in spec */
  trackUrl: (customLabel?: string) => Promise<string>;
  /** Utility to record an arbitrary custom URL */
  recordUrl: (url: string, customLabel?: string) => void;
  /** Utility to get full URL change history for this test */
  getTrackedUrls: () => TrackedUrlRecord[];
};

// ─── Extend test ───

export const test = base.extend<MyFixtures>({
  page: async ({ page }, use) => {
    // Automatically setup URL tracker to capture all navigations & redirects
    setupUrlTracker(page);

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
  solveRecaptchaAudio: async ({ page }, use) => {
    await use((options?: RecaptchaAudioOptions) => solveRecaptchaAudio(page, options));
  },
  waitForPageLoad: async ({ page }, use) => {
    await use((options?: WaitForPageLoadOptions) => waitForPageLoad(page, options));
  },
  getUploadFile: async ({}, use) => {
    await use(getUploadFile);
  },
  trackUrl: async ({ page }, use) => {
    await use((customLabel?: string) => trackUrl(page, customLabel));
  },
  recordUrl: async ({ page }, use) => {
    await use((url: string, customLabel?: string) => recordCustomUrl(page, url, customLabel));
  },
  getTrackedUrls: async ({ page }, use) => {
    await use(() => getTrackedUrls(page));
  },
});

// Re-export expect for convenience
export { expect };

// ─── BeforeEach: Auto-skip test blocks belonging to disabled sections ───
test.beforeEach(async ({}, testInfo: TestInfo) => {
  const disabledSectionsEnv = process.env.DISABLED_SECTIONS;
  if (!disabledSectionsEnv) return;

  const disabledList = disabledSectionsEnv
    .split('|||')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (disabledList.length === 0) return;

  const title = (testInfo.title || '').toLowerCase();
  for (const disabled of disabledList) {
    if (disabled && title.includes(disabled)) {
      test.skip(true, `Test block skipped because section "${disabled}" is disabled`);
      return;
    }
  }
});

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
  if (testInfo.status === 'skipped') {
    status = 'SKIPPED';
  } else if (isPassed && isRetried) {
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

  // ─── Track and Collect all URLs encountered during test execution ───
  const trackedUrlRecords: TrackedUrlRecord[] = [...getTrackedUrls(page)];
  let latestPageUrl = 'N/A';
  try {
    if (page && !page.isClosed()) {
      const cur = page.url();
      if (cur && !cur.startsWith('about:') && !cur.startsWith('chrome-error:')) {
        latestPageUrl = cur;
        const lastRec = trackedUrlRecords[trackedUrlRecords.length - 1];
        if (!lastRec || lastRec.url !== cur) {
          trackedUrlRecords.push({
            url: cur,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            label: isPassed ? 'Final / Payment Page' : 'Page URL at finish',
          });
        }
      }
    }
  } catch {}

  const capturedUrls: string[] = [];
  const seenUrls = new Set<string>();
  for (const rec of trackedUrlRecords) {
    if (rec.url && !seenUrls.has(rec.url)) {
      seenUrls.add(rec.url);
      capturedUrls.push(rec.url);
    }
  }
  if (latestPageUrl !== 'N/A' && !seenUrls.has(latestPageUrl)) {
    capturedUrls.push(latestPageUrl);
  }

  // Primary URL (backward compatible with paymentUrl)
  let paymentUrl = 'N/A';
  if (latestPageUrl !== 'N/A') {
    paymentUrl = latestPageUrl;
  } else if (capturedUrls.length > 0) {
    paymentUrl = capturedUrls[capturedUrls.length - 1];
  }

  let capturedUrlScreenshot: string | null = null;
  let failureScreenshotPath: string | null = null;

  const sessionTimestamp = process.env.SESSION_TIMESTAMP || getFallbackTimestamp();
  const testKey = scriptName.replace(/\.(spec|test)\.(ts|js)$/, '');

  if (isPassed) {
    try {
      if (page && !page.isClosed()) {
        paymentUrl = page.url();

        // Automatically capture screenshot of the page whose URL was captured
        try {
          const sanitizedTestName = testName.toLowerCase().replace(/[^a-z0-9\-_.]/g, '-');
          const cleanName = `${testKey}-${sanitizedTestName}-${device}-${browser}-captured-url.png`
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
  } else {
    // ─── GUARANTEED FAILURE SCREENSHOT CAPTURE (Locator errors, timeouts, network, assertions, etc.) ───
    try {
      const sanitizedTestName = testName.toLowerCase().replace(/[^a-z0-9\-_.]/g, '-');
      const cleanFailureName = `${testKey}-${sanitizedTestName}-${device}-${browser}-failed.png`
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]/g, '-');

      const relativeDir = path.join('screenshots', sessionTimestamp, testKey);
      const fullDir = path.join(process.cwd(), relativeDir);
      fs.mkdirSync(fullDir, { recursive: true });

      const fullPath = path.join(fullDir, cleanFailureName);
      const relativePath = `/screenshots/${sessionTimestamp}/${testKey}/${cleanFailureName}`.replace(/\\/g, '/');

      const reportsDir = path.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, testKey);
      fs.mkdirSync(reportsDir, { recursive: true });
      const reportsFullPath = path.join(reportsDir, cleanFailureName);

      let saved = false;

      // 1. If page is open, capture full screen immediately (with fallback if fullPage times out)
      if (page && !page.isClosed()) {
        try {
          await page.screenshot({
            path: fullPath,
            fullPage: true,
            timeout: 5000,
          });
          saved = fs.existsSync(fullPath);
        } catch (fullPageErr: any) {
          try {
            await page.screenshot({
              path: fullPath,
              fullPage: false,
              timeout: 3000,
            });
            saved = fs.existsSync(fullPath);
          } catch (pageErr: any) {
            console.warn(`[baseTest] Direct failure screenshot attempt error for ${scriptName}:`, pageErr?.message || pageErr);
          }
        }
      }

      // 2. Check Playwright's native attachment (from screenshot: 'only-on-failure')
      if (!saved && testInfo.attachments && testInfo.attachments.length > 0) {
        const screenshotAtt = testInfo.attachments.find(
          (att) =>
            (att.name === 'screenshot' || att.contentType?.startsWith('image/')) &&
            att.path &&
            fs.existsSync(att.path)
        );
        if (screenshotAtt?.path) {
          try {
            fs.copyFileSync(screenshotAtt.path, fullPath);
            saved = true;
          } catch (_) {}
        }
      }

      if (saved && fs.existsSync(fullPath)) {
        try {
          fs.copyFileSync(fullPath, reportsFullPath);
        } catch (_) {}
        failureScreenshotPath = relativePath;
      }
    } catch (failErr: any) {
      console.warn(`[baseTest] Failed to capture failure screenshot for ${scriptName}:`, failErr?.message || failErr);
    }
  }

  // Evaluate captured screenshots
  let finalScreenshotPath = 'N/A';
  const isScreenshotEnabled = process.env.ENABLE_SCREENSHOT_CAPTURE === 'true';

  if (failureScreenshotPath) {
    finalScreenshotPath = failureScreenshotPath;
  } else if (capturedUrlScreenshot) {
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

  // Read optional post-payment URLs/screenshots set by specs & reset for next test in worker
  const visaStatusUrl = process.env.VISA_STATUS_PAGE_URL || 'N/A';
  const visaStatusScreenshot = process.env.VISA_STATUS_SCREENSHOT || 'N/A';
  const completePartiallyUrl = process.env.COMPLETE_PARTIALLY_URL || 'N/A';
  const completePartiallyScreenshot = process.env.COMPLETE_PARTIALLY_SCREENSHOT || 'N/A';
  if (process.env.PAYMENT_PAGE_URL) paymentUrl = process.env.PAYMENT_PAGE_URL;
  delete process.env.PAYMENT_PAGE_URL;
  delete process.env.VISA_STATUS_PAGE_URL;
  delete process.env.VISA_STATUS_SCREENSHOT;
  delete process.env.COMPLETE_PARTIALLY_URL;
  delete process.env.COMPLETE_PARTIALLY_SCREENSHOT;

  // Optional Contact Us verification when enabled from dashboard (runs independently of visa pass/fail,
  // skipping only if the test itself was skipped or is already a dedicated Contact Us test block)
  const contactUsEnabled = process.env.CONTACT_US_ENABLED === 'true';
  let contactUsStatus = 'SKIPPED';
  let contactUsScreenshot = 'N/A';
  let contactUsReason = '';

  const isInlineContactBlock =
    /contact\s*(us|form)/i.test(testName) ||
    /contact\s*(us|form)/i.test(testInfo.titlePath.join(' '));

  if (isInlineContactBlock) {
    contactUsStatus = (status === 'PASS' || status === 'RETRY_PASS') ? 'PASS' : (status === 'SKIPPED' ? 'SKIPPED' : 'FAIL');
    contactUsScreenshot = finalScreenshotPath;
    contactUsReason = isPassed ? '' : errorMessage;
  } else if (contactUsEnabled && testInfo.status !== 'skipped') {
    test.setTimeout(Math.max(testInfo.timeout, testInfo.duration) + 60_000);
    try {
      if (page && !page.isClosed()) {
        const cuRes = await submitContactUsForm(page, testKey);
        contactUsStatus = cuRes.status || 'SKIPPED';
        if (cuRes.screenshotPath) {
          contactUsScreenshot = cuRes.screenshotPath.startsWith('/') ? cuRes.screenshotPath : '/' + cuRes.screenshotPath;
        }
        contactUsReason = cuRes.reason || '';
      } else {
        contactUsStatus = 'FAIL';
        contactUsReason = 'The Playwright page was closed before Contact Us verification could run.';
      }
    } catch (cuErr: any) {
      contactUsStatus = 'FAIL';
      contactUsReason = cuErr?.message || 'Contact Us check failed.';
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
    capturedUrls: capturedUrls,
    urlHistory: trackedUrlRecords,
    screenshotPath: finalScreenshotPath,
    contactUsEnabled,
    contactUsStatus,
    contactUsScreenshot,
    contactUsReason,
    visaStatusUrl,
    visaStatusScreenshot,
    completePartiallyUrl,
    completePartiallyScreenshot,
    error: errorMessage,
    failedStep: failedStep,
    startTime: startTime,
    endTime: endTime,
  };

  // Write result JSON to .temp-results/
  // Filename is deterministic — same test+device+browser accumulates or overwrites on retry
  const resultDir = path.join(process.cwd(), '.temp-results');
  fs.mkdirSync(resultDir, { recursive: true });

  const resultFileName = `${testKey}__${device}__${browser}.json`;
  const resultFilePath = path.join(resultDir, resultFileName);

  let existingBlocks: any[] = [];
  let existingResult: any = null;

  if (fs.existsSync(resultFilePath)) {
    try {
      existingResult = JSON.parse(fs.readFileSync(resultFilePath, 'utf8'));
      if (existingResult && Array.isArray(existingResult.testBlocks)) {
        existingBlocks = existingResult.testBlocks;
      } else if (existingResult && existingResult.testName) {
        existingBlocks = [{
          title: existingResult.testName,
          status: existingResult.status,
          duration: existingResult.duration,
          error: existingResult.error,
          failedStep: existingResult.failedStep,
          screenshotPath: existingResult.screenshotPath,
        }];
      }
    } catch (_) {}
  }

  // Current test block item
  const currentBlock = {
    title: testName,
    status: status,
    duration: parseFloat(durationSec),
    error: errorMessage,
    failedStep: failedStep,
    screenshotPath: finalScreenshotPath,
  };

  // Upsert current test block
  const existingIdx = existingBlocks.findIndex((b: any) => b.title === testName);
  if (existingIdx >= 0) {
    existingBlocks[existingIdx] = currentBlock;
  } else {
    existingBlocks.push(currentBlock);
  }

  // Calculate composite status:
  // If ANY test block failed -> overall status is FAIL
  // If all are PASS or RETRY_PASS -> PASS
  // If all are SKIPPED -> SKIPPED
  const hasFail = existingBlocks.some((b: any) => b.status === 'FAIL');
  const hasRetryPass = existingBlocks.some((b: any) => b.status === 'RETRY_PASS');
  const allSkipped = existingBlocks.every((b: any) => b.status === 'SKIPPED');
  const anyPass = existingBlocks.some((b: any) => b.status === 'PASS' || b.status === 'RETRY_PASS');

  let compositeStatus: TestResultData['status'] = 'PASS';
  if (hasFail) {
    compositeStatus = 'FAIL';
  } else if (hasRetryPass) {
    compositeStatus = 'RETRY_PASS';
  } else if (allSkipped) {
    compositeStatus = 'SKIPPED';
  } else if (anyPass) {
    compositeStatus = 'PASS';
  }

  // Composite error: if tests failed, specify which test failed
  let compositeError = errorMessage;
  if (hasFail) {
    const failedBlocks = existingBlocks.filter((b: any) => b.status === 'FAIL');
    compositeError = failedBlocks
      .map((b: any) => `[${b.title}] ${b.error || 'Failed'}`)
      .join('\n\n');
  }

  // Total duration
  const totalDuration = existingBlocks.reduce((acc: number, b: any) => acc + (b.duration || 0), 0);

  // Merge captured URLs
  let allCapturedUrls = capturedUrls;
  if (existingResult && Array.isArray(existingResult.capturedUrls)) {
    allCapturedUrls = Array.from(new Set([...existingResult.capturedUrls, ...capturedUrls]));
  }

  // Merge full URL history across all test blocks in this spec
  let allUrlHistory: TrackedUrlRecord[] = trackedUrlRecords;
  if (existingResult && Array.isArray(existingResult.urlHistory)) {
    const seenHist = new Set<string>();
    allUrlHistory = [];
    for (const h of [...existingResult.urlHistory, ...trackedUrlRecords]) {
      const key = `${h.url}_${h.label}`;
      if (!seenHist.has(key)) {
        seenHist.add(key);
        allUrlHistory.push(h);
      }
    }
  }

  // Screenshot: prioritize failure screenshot if any test block failed
  let compositeScreenshot = finalScreenshotPath;
  const failedWithScreenshot = existingBlocks.find((b: any) => b.status === 'FAIL' && b.screenshotPath && b.screenshotPath !== 'N/A');
  if (failedWithScreenshot) {
    compositeScreenshot = failedWithScreenshot.screenshotPath;
  } else if (existingResult && existingResult.screenshotPath && existingResult.screenshotPath !== 'N/A' && compositeScreenshot === 'N/A') {
    compositeScreenshot = existingResult.screenshotPath;
  }

  const finalContactUsEnabled = contactUsEnabled || Boolean(existingResult?.contactUsEnabled);
  let finalContactUsStatus = contactUsStatus;
  let finalContactUsScreenshot = contactUsScreenshot;
  let finalContactUsReason = contactUsReason;
  if (finalContactUsStatus === 'SKIPPED' && existingResult?.contactUsStatus && existingResult.contactUsStatus !== 'SKIPPED') {
    finalContactUsStatus = existingResult.contactUsStatus;
    finalContactUsScreenshot = existingResult.contactUsScreenshot || 'N/A';
    finalContactUsReason = existingResult.contactUsReason || '';
  }

  const finalResult: TestResultData & { testBlocks: any[]; passCount: number; failCount: number; skipCount: number } = {
    ...result,
    status: compositeStatus,
    duration: parseFloat(totalDuration.toFixed(1)),
    error: compositeError,
    screenshotPath: compositeScreenshot,
    contactUsEnabled: finalContactUsEnabled,
    contactUsStatus: finalContactUsStatus,
    contactUsScreenshot: finalContactUsScreenshot,
    contactUsReason: finalContactUsReason,
    capturedUrls: allCapturedUrls,
    urlHistory: allUrlHistory,
    testBlocks: existingBlocks,
    passCount: existingBlocks.filter((b: any) => b.status === 'PASS' || b.status === 'RETRY_PASS').length,
    failCount: existingBlocks.filter((b: any) => b.status === 'FAIL').length,
    skipCount: existingBlocks.filter((b: any) => b.status === 'SKIPPED').length,
  };

  try {
    fs.writeFileSync(resultFilePath, JSON.stringify(finalResult, null, 2), 'utf8');
  } catch (writeError) {
    console.error(`[baseTest] Failed to write result JSON for ${testKey}:`, writeError);
  }
});