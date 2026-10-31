"use strict";
/**
 * devices.ts
 *
 * Device configurations for Desktop, Android, and iPhone.
 * Used by configGenerator.js to create Playwright projects.
 * Also used by baseTest.ts for result metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROWSER_LIST = exports.BROWSERS = exports.DEVICE_LIST = exports.DEVICES = void 0;
exports.DEVICES = {
    'Desktop': {
        name: 'Desktop',
        type: 'Desktop',
        viewport: { width: 1920, height: 1080 },
    },
    'Android': {
        name: 'Android',
        type: 'Mobile',
        playwrightDevice: 'Pixel 5',
    },
    'iOS': {
        name: 'iOS',
        type: 'Mobile',
        playwrightDevice: 'iPhone 14',
    },
};
exports.DEVICE_LIST = Object.keys(exports.DEVICES);
exports.BROWSERS = {
    'Chromium': {
        name: 'Chromium',
        playwrightBrowser: 'chromium',
    },
    'Firefox': {
        name: 'Firefox',
        playwrightBrowser: 'firefox',
    },
    'WebKit': {
        name: 'WebKit',
        playwrightBrowser: 'webkit',
    },
};
exports.BROWSER_LIST = Object.keys(exports.BROWSERS);
//# sourceMappingURL=devices.js.map