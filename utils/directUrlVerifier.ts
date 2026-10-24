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
import { captureScreenshot } from './screenshot';

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
export async function extractOrderId(page: Page, customSelector?: string): Promise<string> {
  if (!page || page.isClosed()) return '';

  const candidateSelectors = [
    ...(customSelector ? [customSelector] : []),
    '#order_id_spn',
    '#order_id',
    '[data-order-id]',
    'span[id*="order"]',
    'b[id*="order"]',
    'strong[id*="order"]',
    'input[name="order_id"]',
    'input[name="orderId"]',
    '#application_id',
    '#tracking_number'
  ];

  for (const sel of candidateSelectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1200 }).catch(() => false)) {
        const text = (await loc.textContent().catch(() => '')) || (await loc.inputValue().catch(() => ''));
        const cleaned = text?.trim();
        if (cleaned && cleaned.length >= 3) {
          return cleaned;
        }
      }
    } catch {
      // Continue searching
    }
  }

  // Regex fallback over page body
  try {
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const match = pageText.match(/(?:Order\s*(?:ID|Number|No|#)|Application\s*(?:ID|No|#))\s*[:#-]?\s*([A-Za-z0-9_-]{4,32})/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Ignore regex fallback error
  }

  return '';
}

/**
 * Universal Direct URL Verification Runner.
 * Executes the stage checks in dedicated tabs and captures verification screenshots.
 */
export async function verifyDirectUrls(
  page: Page,
  options: DirectUrlVerificationOptions
): Promise<DirectUrlVerificationResult> {
  const stageName = options.stageName || 'stage';
  const timeoutMs = options.networkIdleTimeoutMs ?? 5000;

  // 1. Determine Order ID
  let orderId = options.orderId ? options.orderId.trim() : '';
  if (!orderId) {
    orderId = await extractOrderId(page, options.orderIdSelector);
  }
  if (!orderId) {
    console.warn(`[DirectURL:${stageName}] Notice: Order ID not found on page, using placeholder 'ORDER-PENDING'`);
    orderId = 'ORDER-PENDING';
  }

  // 2. Resolve Target URLs
  let origin = 'https://azerbaijan-visa.info';
  try {
    const currentUrl = page.url();
    if (currentUrl && currentUrl.startsWith('http')) {
      origin = new URL(currentUrl).origin;
    }
  } catch {
    // fallback origin
  }

  const rawTargets = (options.urls && options.urls.length > 0)
    ? options.urls
    : (options.relativeUrls && options.relativeUrls.length > 0)
    ? options.relativeUrls
    : ['/visa-status/', '/complete-partially/'];

  const normalizedTargets: DirectUrlTarget[] = rawTargets.map(item => {
    if (typeof item === 'string') {
      let fullUrl = item;
      if (item.startsWith('/')) {
        fullUrl = `${origin}${item}`;
      } else if (!item.startsWith('http')) {
        fullUrl = `${origin}/${item}`;
      }
      // Derive slug
      const urlObj = new URL(fullUrl);
      const cleanPath = urlObj.pathname.replace(/^\/+|\/+$/g, '').replace(/[\/\.]/g, '-');
      const slug = cleanPath || 'status-check';
      return { slug, url: fullUrl };
    }
    return item;
  });

  console.log(`[DirectURL:${stageName}] Initiating verification for Order ID: "${orderId}" across ${normalizedTargets.length} URLs`);

  const results: DirectUrlVerificationResult['results'] = [];

  // 3. Process each URL in a separate tab
  for (const target of normalizedTargets) {
    let tab: Page | null = null;
    let screenshotPath: string | null = null;
    let success = false;
    let errorMsg: string | undefined;

    try {
      tab = await page.context().newPage();

      // Attach captcha listener before navigation if available
      let captchaPromise: Promise<string> | null = null;
      if (typeof options.waitForCaptcha === 'function') {
        captchaPromise = options.waitForCaptcha(tab).catch(err => {
          console.log(`[DirectURL:${stageName}:${target.slug}] Captcha listener notice: ${err.message}`);
          return '';
        });
      }

      // Navigate to target URL
      console.log(`[DirectURL:${stageName}:${target.slug}] Opening tab: ${target.url}`);
      await tab.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Networkidle wait with 5-second timeout fallback
      try {
        await tab.waitForLoadState('networkidle', { timeout: timeoutMs });
      } catch {
        console.log(`[DirectURL:${stageName}:${target.slug}] Network did not go idle within ${timeoutMs}ms, continuing`);
      }

      // Enter Order ID
      const orderSelectors = options.customSelectors?.orderInput ||
        '#order_id, input[name="order_id"], input[placeholder*="Order"], input[name="orderId"], #orderNumber, input[name="ref"]';
      const orderInput = tab.locator(orderSelectors).first();
      if (await orderInput.isVisible({ timeout: 4000 }).catch(() => false)) {
        await orderInput.fill(orderId);
        console.log(`[DirectURL:${stageName}:${target.slug}] Filled Order ID "${orderId}" into ${orderSelectors}`);
      } else {
        console.log(`[DirectURL:${stageName}:${target.slug}] No Order ID input field detected on ${target.slug}`);
      }

      // Complete Captcha if present
      if (captchaPromise) {
        const captchaInputSelectors = options.customSelectors?.captchaInput ||
          'input[name="captcha"], #captcha, input[placeholder*="Captcha"], input[name="code"], #security_code';
        const captchaInput = tab.locator(captchaInputSelectors).first();
        if (await captchaInput.isVisible({ timeout: 2500 }).catch(() => false)) {
          console.log(`[DirectURL:${stageName}:${target.slug}] Waiting for Captcha resolution...`);
          const captchaCode = await Promise.race([
            captchaPromise,
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 7000))
          ]);
          if (captchaCode) {
            await captchaInput.fill(captchaCode);
            console.log(`[DirectURL:${stageName}:${target.slug}] Filled Captcha code.`);
          }
        }
      }

      // Submit form
      const submitSelectors = options.customSelectors?.submitBtn ||
        'button:has-text("Submit"), button:has-text("Check"), button:has-text("Search"), button:has-text("Status"), input[type="submit"]';
      const submitBtn = tab.locator(submitSelectors).first();
      if (await submitBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        console.log(`[DirectURL:${stageName}:${target.slug}] Submitting status/check form...`);
        await submitBtn.click();
        try {
          await tab.waitForLoadState('networkidle', { timeout: timeoutMs });
        } catch {
          // Timeout fallback
        }
      }

      // Settle and capture screenshot named: ${stageName}-${target.slug}
      await tab.waitForTimeout(1000);
      const screenshotName = `${stageName}-${target.slug}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      screenshotPath = await captureScreenshot(tab, screenshotName);
      console.log(`[DirectURL:${stageName}:${target.slug}] Screenshot saved: ${screenshotName}.png`);

      success = true;
    } catch (err: any) {
      errorMsg = err.message || String(err);
      console.warn(`[DirectURL:${stageName}:${target.slug}] Verification encountered error: ${errorMsg}`);
    } finally {
      // Safely close the tab and return focus to main page
      if (tab && !tab.isClosed()) {
        try {
          await tab.close();
          console.log(`[DirectURL:${stageName}:${target.slug}] Closed tab and returned to main application.`);
        } catch (closeErr: any) {
          console.error(`[DirectURL] Error closing tab:`, closeErr.message);
        }
      }
    }

    results.push({
      slug: target.slug,
      url: target.url,
      success,
      screenshot: screenshotPath,
      error: errorMsg
    });
  }

  return {
    stage: stageName,
    orderId,
    results
  };
}
