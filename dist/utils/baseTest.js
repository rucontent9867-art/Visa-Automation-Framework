"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = exports.setupUrlTracker = exports.clearTrackedUrls = exports.getCapturedUrls = exports.getTrackedUrls = exports.recordCustomUrl = exports.trackUrl = exports.extractOrderId = exports.verifyDirectUrls = exports.capturescreenshot = exports.captureScreenshot = void 0;
exports.getUploadFile = getUploadFile;
const test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
const captchaHelper_1 = require("./captcha/captchaHelper");
const screenshot_1 = require("./screenshot");
Object.defineProperty(exports, "captureScreenshot", { enumerable: true, get: function () { return screenshot_1.captureScreenshot; } });
Object.defineProperty(exports, "capturescreenshot", { enumerable: true, get: function () { return screenshot_1.captureScreenshot; } });
const urlTracker_1 = require("./urlTracker");
Object.defineProperty(exports, "setupUrlTracker", { enumerable: true, get: function () { return urlTracker_1.setupUrlTracker; } });
Object.defineProperty(exports, "trackUrl", { enumerable: true, get: function () { return urlTracker_1.trackUrl; } });
Object.defineProperty(exports, "recordCustomUrl", { enumerable: true, get: function () { return urlTracker_1.recordCustomUrl; } });
Object.defineProperty(exports, "getTrackedUrls", { enumerable: true, get: function () { return urlTracker_1.getTrackedUrls; } });
Object.defineProperty(exports, "getCapturedUrls", { enumerable: true, get: function () { return urlTracker_1.getCapturedUrls; } });
Object.defineProperty(exports, "clearTrackedUrls", { enumerable: true, get: function () { return urlTracker_1.clearTrackedUrls; } });
const directUrlVerifier_1 = require("./directUrlVerifier");
Object.defineProperty(exports, "verifyDirectUrls", { enumerable: true, get: function () { return directUrlVerifier_1.verifyDirectUrls; } });
Object.defineProperty(exports, "extractOrderId", { enumerable: true, get: function () { return directUrlVerifier_1.extractOrderId; } });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ─── Fixture types ───
function getFallbackTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}
function getUploadFile() {
    const uploadCandidates = [
        path_1.default.resolve(process.cwd(), 'tests', 'assets', '10kb.jpg'),
        path_1.default.resolve(process.cwd(), 'debug-chromium-desktop.png'),
    ];
    return uploadCandidates.find(c => fs_1.default.existsSync(c)) || uploadCandidates[0];
}
// ─── Extend test ───
exports.test = test_1.test.extend({
    page: async ({ page }, use) => {
        // Automatically setup URL tracker to capture all navigations & redirects
        (0, urlTracker_1.setupUrlTracker)(page);
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
        await use(captchaHelper_1.waitForCaptcha);
    },
    getUploadFile: async ({}, use) => {
        await use(getUploadFile);
    },
    trackUrl: async ({ page }, use) => {
        await use((customLabel) => (0, urlTracker_1.trackUrl)(page, customLabel));
    },
    recordUrl: async ({ page }, use) => {
        await use((url, customLabel) => (0, urlTracker_1.recordCustomUrl)(page, url, customLabel));
    },
    getTrackedUrls: async ({ page }, use) => {
        await use(() => (0, urlTracker_1.getTrackedUrls)(page));
    },
});
// ─── AfterEach: Capture results ───
exports.test.afterEach(async ({ page }, testInfo) => {
    // Extract device and browser from project name
    // Project name format: "Desktop-Chrome", "iPhone 14-Safari", etc.
    const projectName = testInfo.project.name || 'Unknown-Unknown';
    const lastHyphen = projectName.lastIndexOf('-');
    const device = lastHyphen > 0 ? projectName.substring(0, lastHyphen) : projectName;
    const browser = lastHyphen > 0 ? projectName.substring(lastHyphen + 1) : 'Unknown';
    const scriptName = path_1.default.basename(testInfo.file || 'unknown.spec.ts');
    const testName = testInfo.title;
    const isPassed = testInfo.status === 'passed';
    const isRetried = testInfo.retry > 0;
    // Determine final status
    let status;
    if (isPassed && isRetried) {
        status = 'RETRY_PASS';
    }
    else if (isPassed) {
        status = 'PASS';
    }
    else {
        status = 'FAIL';
    }
    // Format duration
    const durationMs = testInfo.duration;
    const durationSec = (durationMs / 1000).toFixed(1);
    // Timestamps
    const startTime = new Date(Date.now() - durationMs).toISOString().replace('T', ' ').substring(0, 19);
    const endTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    // Get viewport info
    let viewportStr = 'N/A';
    try {
        if (page && !page.isClosed()) {
            const vp = page.viewportSize();
            if (vp)
                viewportStr = `${vp.width} x ${vp.height}`;
        }
    }
    catch { }
    // ─── Track and Collect all URLs encountered during test execution ───
    const trackedUrlRecords = [...(0, urlTracker_1.getTrackedUrls)(page)];
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
    }
    catch { }
    const capturedUrls = [];
    const seenUrls = new Set();
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
    }
    else if (capturedUrls.length > 0) {
        paymentUrl = capturedUrls[capturedUrls.length - 1];
    }
    let capturedUrlScreenshot = null;
    let failureScreenshotPath = null;
    const sessionTimestamp = process.env.SESSION_TIMESTAMP || getFallbackTimestamp();
    const testKey = scriptName.replace(/\.(spec|test)\.(ts|js)$/, '');
    if (isPassed) {
        try {
            if (page && !page.isClosed()) {
                paymentUrl = page.url();
                // Automatically capture screenshot of the page whose URL was captured
                try {
                    const cleanName = `${testKey}-${device}-${browser}-captured-url.png`
                        .toLowerCase()
                        .replace(/[^a-z0-9\-_.]/g, '-');
                    const relativeDir = path_1.default.join('screenshots', sessionTimestamp, testKey);
                    const fullDir = path_1.default.join(process.cwd(), relativeDir);
                    fs_1.default.mkdirSync(fullDir, { recursive: true });
                    const fullPath = path_1.default.join(fullDir, cleanName);
                    const relativePath = `/screenshots/${sessionTimestamp}/${testKey}/${cleanName}`.replace(/\\/g, '/');
                    // Also mirror to reports/screenshots/ for standalone report viewing
                    const reportsDir = path_1.default.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, testKey);
                    fs_1.default.mkdirSync(reportsDir, { recursive: true });
                    const reportsFullPath = path_1.default.join(reportsDir, cleanName);
                    await page.screenshot({
                        path: fullPath,
                        fullPage: true,
                        timeout: 5000,
                    });
                    if (fs_1.default.existsSync(fullPath)) {
                        fs_1.default.copyFileSync(fullPath, reportsFullPath);
                    }
                    capturedUrlScreenshot = relativePath;
                }
                catch (screenshotErr) {
                    console.warn(`[baseTest] Failed to capture screenshot of URL page for ${scriptName}:`, screenshotErr?.message || screenshotErr);
                }
            }
        }
        catch { }
    }
    else {
        // ─── GUARANTEED FAILURE SCREENSHOT CAPTURE (Locator errors, timeouts, network, assertions, etc.) ───
        try {
            const cleanFailureName = `${testKey}-${device}-${browser}-failed.png`
                .toLowerCase()
                .replace(/[^a-z0-9\-_.]/g, '-');
            const relativeDir = path_1.default.join('screenshots', sessionTimestamp, testKey);
            const fullDir = path_1.default.join(process.cwd(), relativeDir);
            fs_1.default.mkdirSync(fullDir, { recursive: true });
            const fullPath = path_1.default.join(fullDir, cleanFailureName);
            const relativePath = `/screenshots/${sessionTimestamp}/${testKey}/${cleanFailureName}`.replace(/\\/g, '/');
            const reportsDir = path_1.default.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, testKey);
            fs_1.default.mkdirSync(reportsDir, { recursive: true });
            const reportsFullPath = path_1.default.join(reportsDir, cleanFailureName);
            let saved = false;
            // 1. If page is open, capture full screen immediately (with fallback if fullPage times out)
            if (page && !page.isClosed()) {
                try {
                    await page.screenshot({
                        path: fullPath,
                        fullPage: true,
                        timeout: 5000,
                    });
                    saved = fs_1.default.existsSync(fullPath);
                }
                catch (fullPageErr) {
                    try {
                        await page.screenshot({
                            path: fullPath,
                            fullPage: false,
                            timeout: 3000,
                        });
                        saved = fs_1.default.existsSync(fullPath);
                    }
                    catch (pageErr) {
                        console.warn(`[baseTest] Direct failure screenshot attempt error for ${scriptName}:`, pageErr?.message || pageErr);
                    }
                }
            }
            // 2. Check Playwright's native attachment (from screenshot: 'only-on-failure')
            if (!saved && testInfo.attachments && testInfo.attachments.length > 0) {
                const screenshotAtt = testInfo.attachments.find((att) => (att.name === 'screenshot' || att.contentType?.startsWith('image/')) &&
                    att.path &&
                    fs_1.default.existsSync(att.path));
                if (screenshotAtt?.path) {
                    try {
                        fs_1.default.copyFileSync(screenshotAtt.path, fullPath);
                        saved = true;
                    }
                    catch (_) { }
                }
            }
            if (saved && fs_1.default.existsSync(fullPath)) {
                try {
                    fs_1.default.copyFileSync(fullPath, reportsFullPath);
                }
                catch (_) { }
                failureScreenshotPath = relativePath;
            }
        }
        catch (failErr) {
            console.warn(`[baseTest] Failed to capture failure screenshot for ${scriptName}:`, failErr?.message || failErr);
        }
    }
    // Evaluate captured screenshots
    let finalScreenshotPath = 'N/A';
    const isScreenshotEnabled = process.env.ENABLE_SCREENSHOT_CAPTURE === 'true';
    if (failureScreenshotPath) {
        finalScreenshotPath = failureScreenshotPath;
    }
    else if (capturedUrlScreenshot) {
        finalScreenshotPath = capturedUrlScreenshot;
    }
    else if (isScreenshotEnabled) {
        const captured = (0, screenshot_1.getCapturedScreenshots)();
        if (captured && captured.length > 0) {
            finalScreenshotPath = captured[captured.length - 1];
            if (!finalScreenshotPath.startsWith('/')) {
                finalScreenshotPath = '/' + finalScreenshotPath;
            }
        }
    }
    (0, screenshot_1.clearCapturedScreenshots)();
    // Extract error info
    let errorMessage = '';
    let failedStep = '';
    if (!isPassed && testInfo.error) {
        errorMessage = testInfo.error.message || '';
        // Try to extract a meaningful step name from error
        const stepMatch = errorMessage.match(/waiting for.*?["'](.+?)["']/i);
        if (stepMatch) {
            failedStep = stepMatch[1];
        }
        else {
            failedStep = 'Unknown';
        }
        // Truncate very long errors
        if (errorMessage.length > 500) {
            errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
        }
    }
    // Build result object
    const result = {
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
        error: errorMessage,
        failedStep: failedStep,
        startTime: startTime,
        endTime: endTime,
    };
    // Write result JSON to .temp-results/
    // Filename is deterministic — same test+device+browser overwrites on retry
    // So only the FINAL attempt's result survives
    const resultDir = path_1.default.join(process.cwd(), '.temp-results');
    fs_1.default.mkdirSync(resultDir, { recursive: true });
    const resultFileName = `${testKey}__${device}__${browser}.json`;
    const resultFilePath = path_1.default.join(resultDir, resultFileName);
    try {
        fs_1.default.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), 'utf8');
    }
    catch (writeError) {
        console.error(`[baseTest] Failed to write result JSON for ${testKey}:`, writeError);
    }
});
//# sourceMappingURL=baseTest.js.map