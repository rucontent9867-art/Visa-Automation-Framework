"use strict";
/**
 * captchaHelper.ts
 *
 * High-level helper that combines response waiting + decoding.
 * Thread-safe for parallel execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCaptcha = waitForCaptcha;
exports.waitForCaptchaCustom = waitForCaptchaCustom;
const captchaDecoder_1 = require("./captchaDecoder");
const DEFAULT_CAPTCHA_CONFIG = {
    /** Supported captcha endpoints */
    urlPatterns: [
        'create_captcha.php',
        'get_captcha.php',
    ],
    /** Expected HTTP status */
    expectedStatus: 200,
    /** Default response field */
    responseField: 'd',
    /** Base64 decode iterations */
    decodeIterations: 3,
    /** Wait timeout */
    timeout: 60000,
};
const SITE_OVERRIDES = {};
/**
 * Endpoint → JSON field mapping
 */
const RESPONSE_FIELD_MAP = {
    'create_captcha.php': 'd',
    'get_captcha.php': 'c',
};
function getConfig(siteKey) {
    const overrides = siteKey ? SITE_OVERRIDES[siteKey] || {} : {};
    return {
        ...DEFAULT_CAPTCHA_CONFIG,
        ...overrides,
    };
}
function getResponseField(response, defaultField) {
    for (const endpoint of Object.keys(RESPONSE_FIELD_MAP)) {
        if (response.url().includes(endpoint)) {
            return RESPONSE_FIELD_MAP[endpoint];
        }
    }
    return defaultField;
}
/**
 * Wait for captcha API response
 */
function waitForCaptcha(page, siteKey) {
    const config = getConfig(siteKey);
    const responsePromise = page.waitForResponse(response => config.urlPatterns.some(pattern => response.url().includes(pattern)) &&
        response.status() === config.expectedStatus, {
        timeout: config.timeout,
    });
    return responsePromise.then(async (response) => {
        const data = await response.json();
        const field = getResponseField(response, config.responseField);
        return (0, captchaDecoder_1.extractCaptchaText)(data, field, config.decodeIterations);
    });
}
/**
 * Custom captcha listener
 */
function waitForCaptchaCustom(page, urlPatterns, field = 'd', iterations = 3) {
    const patterns = Array.isArray(urlPatterns)
        ? urlPatterns
        : [urlPatterns];
    const responsePromise = page.waitForResponse(response => patterns.some(pattern => response.url().includes(pattern)) &&
        response.status() === 200, {
        timeout: 30000,
    });
    return responsePromise.then(async (response) => {
        const data = await response.json();
        const actualField = getResponseField(response, field);
        return (0, captchaDecoder_1.extractCaptchaText)(data, actualField, iterations);
    });
}
//# sourceMappingURL=captchaHelper.js.map