"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupUrlTracker = setupUrlTracker;
exports.trackUrl = trackUrl;
exports.recordCustomUrl = recordCustomUrl;
exports.getTrackedUrls = getTrackedUrls;
exports.getCapturedUrls = getCapturedUrls;
exports.clearTrackedUrls = clearTrackedUrls;
// Symbol / property key used to store per-page URL tracking state safely
const URL_TRACKER_KEY = Symbol('__url_tracker_records__');
const URL_LISTENER_KEY = Symbol('__url_tracker_attached__');
/**
 * Format timestamp in local readable format (YYYY-MM-DD HH:mm:ss)
 */
function getFormattedTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
/**
 * Normalizes URL string to prevent trailing-slash or fragment duplicates if desired
 */
function normalizeUrl(rawUrl) {
    if (!rawUrl)
        return '';
    try {
        const parsed = new URL(rawUrl);
        // Ignore about:blank or chrome-error
        if (parsed.protocol === 'about:' || parsed.protocol === 'chrome-error:') {
            return '';
        }
        return parsed.href;
    }
    catch {
        return rawUrl.trim();
    }
}
/**
 * Initialize URL tracker on a Page instance.
 * Automatically hooks up to 'framenavigated' on the main frame.
 * Idempotent: Can be called multiple times safely.
 */
function setupUrlTracker(page) {
    if (!page)
        return [];
    const pageAny = page;
    if (!pageAny[URL_TRACKER_KEY]) {
        pageAny[URL_TRACKER_KEY] = [];
    }
    const records = pageAny[URL_TRACKER_KEY];
    // Attach navigation listener if not already attached
    if (!pageAny[URL_LISTENER_KEY]) {
        pageAny[URL_LISTENER_KEY] = true;
        // Listen to all main-frame navigations (page.goto, form submits, 301/302 redirects, pushState)
        if (typeof page.on === 'function') {
            page.on('framenavigated', (frame) => {
                try {
                    if (typeof page.mainFrame === 'function' && frame === page.mainFrame()) {
                        const rawUrl = typeof frame.url === 'function' ? frame.url() : '';
                        const cleanUrl = normalizeUrl(rawUrl);
                        if (!cleanUrl)
                            return;
                        const lastRecord = records[records.length - 1];
                        if (!lastRecord || lastRecord.url !== cleanUrl) {
                            const stepNum = records.length + 1;
                            const label = stepNum === 1 ? 'Initial Navigation' : `Redirect / Step ${stepNum}`;
                            records.push({
                                url: cleanUrl,
                                timestamp: getFormattedTimestamp(),
                                label: label,
                            });
                        }
                    }
                }
                catch (err) {
                    // Safe guard against closed frame/page
                }
            });
        }
        // Check if page already has an active URL at setup time
        try {
            if (typeof page.isClosed === 'function' && !page.isClosed() && typeof page.url === 'function') {
                const cur = normalizeUrl(page.url());
                if (cur && records.length === 0) {
                    records.push({
                        url: cur,
                        timestamp: getFormattedTimestamp(),
                        label: 'Initial Navigation',
                    });
                }
            }
        }
        catch { }
    }
    return records;
}
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
async function trackUrl(page, customLabel) {
    if (!page || page.isClosed())
        return '';
    const records = setupUrlTracker(page);
    let currentUrl = '';
    try {
        currentUrl = normalizeUrl(page.url());
    }
    catch {
        return '';
    }
    if (!currentUrl)
        return '';
    let pageTitle = '';
    try {
        pageTitle = await page.title();
    }
    catch { }
    const lastRecord = records[records.length - 1];
    const stepNum = records.length + 1;
    const label = customLabel || (stepNum === 1 ? 'Initial Navigation' : `Step ${stepNum}`);
    // If last record matches current URL, update label if custom label provided
    if (lastRecord && lastRecord.url === currentUrl) {
        if (customLabel) {
            lastRecord.label = customLabel;
        }
        if (pageTitle && !lastRecord.title) {
            lastRecord.title = pageTitle;
        }
    }
    else {
        records.push({
            url: currentUrl,
            timestamp: getFormattedTimestamp(),
            label: label,
            title: pageTitle || undefined,
        });
    }
    return currentUrl;
}
/**
 * Record an arbitrary custom URL (e.g., extracted from payment webhook, SMS, email, or iframe).
 */
function recordCustomUrl(page, customUrl, label) {
    if (!page || !customUrl)
        return;
    const cleanUrl = normalizeUrl(customUrl);
    if (!cleanUrl)
        return;
    const records = setupUrlTracker(page);
    const stepNum = records.length + 1;
    records.push({
        url: cleanUrl,
        timestamp: getFormattedTimestamp(),
        label: label || `Custom URL ${stepNum}`,
    });
}
/**
 * Get the full history of tracked URL records for this page.
 */
function getTrackedUrls(page) {
    if (!page)
        return [];
    const pageAny = page;
    return pageAny[URL_TRACKER_KEY] || [];
}
/**
 * Get ordered array of unique URL strings captured during the test.
 */
function getCapturedUrls(page) {
    const records = getTrackedUrls(page);
    const seen = new Set();
    const urls = [];
    for (const r of records) {
        if (r.url && !seen.has(r.url)) {
            seen.add(r.url);
            urls.push(r.url);
        }
    }
    return urls;
}
/**
 * Clear tracked URLs for the page
 */
function clearTrackedUrls(page) {
    if (!page)
        return;
    const pageAny = page;
    pageAny[URL_TRACKER_KEY] = [];
}
//# sourceMappingURL=urlTracker.js.map