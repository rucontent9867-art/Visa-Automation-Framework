/**
 * captchaHelper.ts
 *
 * High-level helper that combines response waiting + decoding.
 * Thread-safe for parallel execution.
 */
import { Page } from '@playwright/test';
/**
 * Wait for captcha API response
 */
export declare function waitForCaptcha(page: Page, siteKey?: string): Promise<string>;
/**
 * Custom captcha listener
 */
export declare function waitForCaptchaCustom(page: Page, urlPatterns: string | string[], field?: string, iterations?: number): Promise<string>;
//# sourceMappingURL=captchaHelper.d.ts.map