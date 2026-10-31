/**
 * captchaHelper.ts
 *
 * High-level helper that combines response waiting + decoding.
 * Thread-safe for parallel execution.
 */

import { Page, Response } from '@playwright/test';
import { extractCaptchaText } from './captchaDecoder';

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

type CaptchaConfig = typeof DEFAULT_CAPTCHA_CONFIG;

const SITE_OVERRIDES: Record<string, Partial<CaptchaConfig>> = {};

/**
 * Endpoint → JSON field mapping
 */
const RESPONSE_FIELD_MAP: Record<string, string> = {
  'create_captcha.php': 'd',
  'get_captcha.php': 'c',
};

function getConfig(siteKey?: string): CaptchaConfig {
  const overrides = siteKey ? SITE_OVERRIDES[siteKey] || {} : {};

  return {
    ...DEFAULT_CAPTCHA_CONFIG,
    ...overrides,
  };
}

function getResponseField(
  response: Response,
  defaultField: string
): string {

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
export function waitForCaptcha(
  page: Page,
  siteKey?: string
): Promise<string> {

  const config = getConfig(siteKey);

  const responsePromise = page.waitForResponse(
    response =>
      config.urlPatterns.some(pattern =>
        response.url().includes(pattern)
      ) &&
      response.status() === config.expectedStatus,
    {
      timeout: config.timeout,
    }
  );

  return responsePromise.then(async response => {

    const data = await response.json();

    const field = getResponseField(
      response,
      config.responseField
    );

    return extractCaptchaText(
      data,
      field,
      config.decodeIterations
    );

  });

}

/**
 * Custom captcha listener
 */
export function waitForCaptchaCustom(
  page: Page,
  urlPatterns: string | string[],
  field: string = 'd',
  iterations: number = 3
): Promise<string> {

  const patterns = Array.isArray(urlPatterns)
    ? urlPatterns
    : [urlPatterns];

  const responsePromise = page.waitForResponse(
    response =>
      patterns.some(pattern =>
        response.url().includes(pattern)
      ) &&
      response.status() === 200,
    {
      timeout: 30000,
    }
  );

  return responsePromise.then(async response => {

    const data = await response.json();

    const actualField = getResponseField(
      response,
      field
    );

    return extractCaptchaText(
      data,
      actualField,
      iterations
    );

  });

}