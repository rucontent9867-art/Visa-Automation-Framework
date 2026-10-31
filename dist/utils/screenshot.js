"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.capturescreenshot = void 0;
exports.captureScreenshot = captureScreenshot;
exports.clearCapturedScreenshots = clearCapturedScreenshots;
exports.getCapturedScreenshots = getCapturedScreenshots;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
if (!globalThis.__capturedScreenshots__) {
    globalThis.__capturedScreenshots__ = [];
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
async function captureScreenshot(page, screenshotName) {
    // Check whether Screenshot Capture is enabled in execution environment
    const isEnabled = process.env.ENABLE_SCREENSHOT_CAPTURE === 'true';
    if (!isEnabled) {
        return null;
    }
    try {
        if (!page || page.isClosed()) {
            return null;
        }
        // Get current execution session timestamp (e.g., 2026-08-09_20-15-30)
        const sessionTimestamp = process.env.SESSION_TIMESTAMP || getFallbackTimestamp();
        // Determine spec key (e.g., azerbaijan-visa)
        const specKey = process.env.CURRENT_SPEC_KEY || 'general';
        // Clean up screenshot filename
        let cleanName = screenshotName.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
        if (!cleanName.endsWith('.png')) {
            cleanName += '.png';
        }
        // Target folder structure: screenshots/<timestamp>/<spec-name>/
        const relativeDir = path_1.default.join('screenshots', sessionTimestamp, specKey);
        const fullDir = path_1.default.join(process.cwd(), relativeDir);
        fs_1.default.mkdirSync(fullDir, { recursive: true });
        const fullPath = path_1.default.join(fullDir, cleanName);
        const relativePath = path_1.default.join('screenshots', sessionTimestamp, specKey, cleanName).replace(/\\/g, '/');
        // Also mirror to reports/screenshots/ for static html report serving
        const reportsDir = path_1.default.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, specKey);
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
        const reportsFullPath = path_1.default.join(reportsDir, cleanName);
        // Capture screenshot
        await page.screenshot({
            path: fullPath,
            fullPage: true,
            timeout: 5000,
        });
        // Copy to reports directory for static report embedding
        if (fs_1.default.existsSync(fullPath)) {
            fs_1.default.copyFileSync(fullPath, reportsFullPath);
        }
        // Register captured screenshot in global list for baseTest fixture
        if (!globalThis.__capturedScreenshots__) {
            globalThis.__capturedScreenshots__ = [];
        }
        globalThis.__capturedScreenshots__.push(relativePath);
        return relativePath;
    }
    catch (err) {
        console.warn(`[captureScreenshot] Failed/skipped screenshot '${screenshotName}':`, err?.message || err);
        return null;
    }
}
/**
 * Clears recorded captured screenshots for fresh test execution.
 */
function clearCapturedScreenshots() {
    globalThis.__capturedScreenshots__ = [];
}
/**
 * Returns recorded captured screenshots for current execution.
 */
function getCapturedScreenshots() {
    return globalThis.__capturedScreenshots__ || [];
}
exports.capturescreenshot = captureScreenshot;
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
//# sourceMappingURL=screenshot.js.map