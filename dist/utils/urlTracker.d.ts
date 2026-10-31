/**
 * utils/urlTracker.ts
 *
 * Dedicated utility for tracking all URL changes during Playwright test runs.
 *
 * Features:
 * 1. Automatic listener: Tracks page navigations, redirects, payment gateway handoffs,
 *    and client-side pushState/replaceState URL transitions via page.on('framenavigated').
 * 2. Explicit utility method: Spec authors can manually call `trackUrl(page, 'Step Label')`
 *    or `recordUrl(page, 'https://...', 'Custom Label')` at any milestone.
 * 3. Thread/Worker isolated: Scoped to the individual Playwright Page instance so concurrent
 *    workers never collide.
 * 4. Rich metadata: Captures URL, formatted timestamp, and step labels for inclusion
 *    in HTML reports, Excel workbooks, and dashboard analytics.
 */
import { Page } from '@playwright/test';
export interface TrackedUrlRecord {
    url: string;
    timestamp: string;
    label: string;
    title?: string;
}
/**
 * Initialize URL tracker on a Page instance.
 * Automatically hooks up to 'framenavigated' on the main frame.
 * Idempotent: Can be called multiple times safely.
 */
export declare function setupUrlTracker(page: Page): TrackedUrlRecord[];
/**
 * Explicit utility method: Call this anywhere in a spec file to capture or label the current URL.
 *
 * Example in a spec:
 * ```ts
 * await trackUrl(page, 'Payment Gateway Redirect');
 * ```
 *
 * @param page Playwright Page instance
 * @param customLabel Optional label describing this step (e.g. 'Checkout Page', 'Payment Gate')
 * @returns Current page URL
 */
export declare function trackUrl(page: Page, customLabel?: string): Promise<string>;
/**
 * Record an arbitrary custom URL (e.g., extracted from payment webhook, SMS, email, or iframe).
 */
export declare function recordCustomUrl(page: Page, customUrl: string, label?: string): void;
/**
 * Get the full history of tracked URL records for this page.
 */
export declare function getTrackedUrls(page: Page): TrackedUrlRecord[];
/**
 * Get ordered array of unique URL strings captured during the test.
 */
export declare function getCapturedUrls(page: Page): string[];
/**
 * Clear tracked URLs for the page
 */
export declare function clearTrackedUrls(page: Page): void;
//# sourceMappingURL=urlTracker.d.ts.map