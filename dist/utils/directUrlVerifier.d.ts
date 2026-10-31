/**
 * utils/directUrlVerifier.ts
 *
 * Universal Direct URL Verification Engine for Playwright Test Framework.
 *
 * Standard Workflow:
 *   1. Extracts or receives the Order ID from the current application stage.
 *   2. Before clicking any Submit, Continue, Save and Continue, or related button:
 *      Opens status and resume URLs (e.g. /visa-status/ and /complete-partially/)
 *      in separate browser tabs.
 *   3. Enters Order ID, resolves Captcha if required, waits for network loading
 *      using the framework's networkidle mechanism with 5s timeout fallback.
 *   4. Captures screenshot of each resulting page with naming: `${stageName}-${target.slug}`.
 *   5. Closes all newly opened tabs and returns execution safely to the original tab.
 *
 * Applicable across all visa portals (Azerbaijan, Bahrain, Egypt, Turkey, etc.).
 */
import { Page } from '@playwright/test';
export interface DirectUrlTarget {
    slug: string;
    url: string;
}
export interface DirectUrlVerificationOptions {
    /**
     * Order ID copied from the current page. If omitted, automatic DOM extraction is attempted.
     */
    orderId?: string;
    /**
     * Optional custom selector to locate the Order ID on the main application page.
     */
    orderIdSelector?: string;
    /**
     * Current application stage (e.g. 'preview', 'document-upload', 'payment').
     */
    stageName: 'preview' | 'document-upload' | 'payment' | string;
    /**
     * Target verification URLs or slugs. If strings are passed, relative paths (e.g. '/visa-status/')
     * will be automatically resolved against the main page origin.
     * Default: ['/visa-status/', '/complete-partially/']
     */
    urls?: Array<string | DirectUrlTarget>;
    /**
     * Alias for urls parameter.
     */
    relativeUrls?: Array<string | DirectUrlTarget>;
    /**
     * Captcha handler fixture or boolean flag if the status page employs bot protection.
     */
    waitForCaptcha?: boolean | ((page: Page) => Promise<string>);
    /**
     * Network idle timeout fallback in milliseconds (default: 5000ms).
     */
    networkIdleTimeoutMs?: number;
    /**
     * Custom selectors for input fields and action buttons on the verification page.
     */
    customSelectors?: {
        orderInput?: string;
        captchaInput?: string;
        submitBtn?: string;
    };
}
export interface DirectUrlVerificationResult {
    stage: string;
    orderId: string;
    results: Array<{
        slug: string;
        url: string;
        success: boolean;
        screenshot: string | null;
        error?: string;
    }>;
}
/**
 * Smart DOM extractor for Order ID across various portal structures.
 */
export declare function extractOrderId(page: Page, customSelector?: string): Promise<string>;
/**
 * Universal Direct URL Verification Runner.
 * Executes the stage checks in dedicated tabs and captures verification screenshots.
 */
export declare function verifyDirectUrls(page: Page, options: DirectUrlVerificationOptions): Promise<DirectUrlVerificationResult>;
//# sourceMappingURL=directUrlVerifier.d.ts.map