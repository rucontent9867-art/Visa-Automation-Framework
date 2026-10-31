/**
 * devices.ts
 *
 * Device configurations for Desktop, Android, and iPhone.
 * Used by configGenerator.js to create Playwright projects.
 * Also used by baseTest.ts for result metadata.
 */
export interface DeviceConfig {
    name: string;
    type: 'Desktop' | 'Mobile';
    playwrightDevice?: string;
    viewport?: {
        width: number;
        height: number;
    };
    userAgent?: string;
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
}
export declare const DEVICES: Record<string, DeviceConfig>;
export declare const DEVICE_LIST: string[];
export interface BrowserConfig {
    name: string;
    playwrightBrowser: 'chromium' | 'firefox' | 'webkit';
    channel?: string;
}
export declare const BROWSERS: Record<string, BrowserConfig>;
export declare const BROWSER_LIST: string[];
//# sourceMappingURL=devices.d.ts.map