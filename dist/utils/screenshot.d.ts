/**
 * utils/screenshot.ts
 *
 * Reusable screenshot capture utility for test automation scripts.
 *
 * Usage in test scripts:
 *   await captureScreenshot(page, 'home-page');
 *   await captureScreenshot(page, 'application-form');
 *   await captureScreenshot(page, 'payment-page');
 */
import { Page } from '@playwright/test';
declare global {
    var __capturedScreenshots__: string[];
}
/**
 * Captures a named screenshot if Screenshot Capture mode is enabled in dashboard settings.
 *
 * When Screenshot Capture is OFF:
 *   - Ignores screenshot capture code immediately
 *   - Creates zero screenshot files or folders
 *   - Returns null
 *
 * When Screenshot Capture is ON:
 *   - Saves screenshot under: screenshots/<timestamp>/<spec-name>/<screenshotName>.png
 *   - Preserves screenshot name supplied by user
 *   - Does not overwrite screenshots from previous executions
 *   - Returns the relative screenshot path for reporting
 *
 * @param page Playwright Page instance
 * @param screenshotName Descriptive name supplied by user (e.g., 'home-page', 'application-form')
 * @returns Promise<string | null> Relative screenshot path or null if disabled/skipped
 */
export declare function captureScreenshot(page: Page, screenshotName: string): Promise<string | null>;
/**
 * Clears recorded captured screenshots for fresh test execution.
 */
export declare function clearCapturedScreenshots(): void;
/**
 * Returns recorded captured screenshots for current execution.
 */
export declare function getCapturedScreenshots(): string[];
export declare const capturescreenshot: typeof captureScreenshot;
//# sourceMappingURL=screenshot.d.ts.map