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
import { expect, Page } from '@playwright/test';
import { waitForCaptcha } from './captcha/captchaHelper';
import { captureScreenshot } from './screenshot';
import { setupUrlTracker, trackUrl, recordCustomUrl, getTrackedUrls, getCapturedUrls, clearTrackedUrls, TrackedUrlRecord } from './urlTracker';
import { verifyDirectUrls, extractOrderId, DirectUrlVerificationOptions, DirectUrlVerificationResult } from './directUrlVerifier';
export { captureScreenshot, captureScreenshot as capturescreenshot, verifyDirectUrls, extractOrderId, trackUrl, recordCustomUrl, getTrackedUrls, getCapturedUrls, clearTrackedUrls, setupUrlTracker, };
export type { TrackedUrlRecord, DirectUrlVerificationOptions, DirectUrlVerificationResult };
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
    capturedUrls: string[];
    urlHistory: TrackedUrlRecord[];
    screenshotPath: string;
    error: string;
    failedStep: string;
    startTime: string;
    endTime: string;
}
export declare function getUploadFile(): string;
type MyFixtures = {
    page: Page;
    /** Re-exported captcha helper for convenient import */
    waitForCaptcha: typeof waitForCaptcha;
    getUploadFile: typeof getUploadFile;
    /** Utility method to track / label URL changes explicitly in spec */
    trackUrl: (customLabel?: string) => Promise<string>;
    /** Utility to record an arbitrary custom URL */
    recordUrl: (url: string, customLabel?: string) => void;
    /** Utility to get full URL change history for this test */
    getTrackedUrls: () => TrackedUrlRecord[];
};
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & MyFixtures, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export { expect };
//# sourceMappingURL=baseTest.d.ts.map