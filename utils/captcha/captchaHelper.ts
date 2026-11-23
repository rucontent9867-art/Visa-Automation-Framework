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
    'simple-php-captcha.php',
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

async function waitForCaptchaResponse(
  page: Page,
  matches: (response: Response) => boolean,
  timeout: number,
  defaultField: string,
  iterations: number
): Promise<string> {
  const parsedResponses = new Map<Response, Record<string, unknown>>();
  let lastInvalidResponse = '';

  let response: Response;
  try {
    response = await page.waitForResponse(async (candidate) => {
      if (!matches(candidate)) return false;

      const contentType = candidate.headers()['content-type'] || 'unknown content type';
      try {
        const body = await candidate.text();
        if (!body.trim()) {
          lastInvalidResponse = `${candidate.url()} returned an empty ${contentType} response`;
          return false;
        }

        const parsed: unknown = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          lastInvalidResponse = `${candidate.url()} returned ${contentType}, not a JSON object`;
          return false;
        }

        const data = parsed as Record<string, unknown>;
        const field = getResponseField(candidate, defaultField);
        if (typeof data[field] !== 'string' || !data[field]) {
          lastInvalidResponse = `${candidate.url()} had no CAPTCHA field "${field}" (${contentType})`;
          return false;
        }

        parsedResponses.set(candidate, data);
        return true;
      } catch {
        lastInvalidResponse = `${candidate.url()} returned a non-JSON CAPTCHA response (${contentType})`;
        return false;
      }
    }, { timeout });
  } catch (error) {
    if (lastInvalidResponse) {
      throw new Error(`No valid JSON CAPTCHA response received within ${timeout}ms. Last response: ${lastInvalidResponse}.`);
    }
    throw error;
  }

  const data = parsedResponses.get(response);
  if (!data) {
    throw new Error(`CAPTCHA response from ${response.url()} could not be decoded as JSON.`);
  }

  return extractCaptchaText(
    data,
    getResponseField(response, defaultField),
    iterations
  );
}

/**
 * Wait for captcha API response
 */
export function waitForCaptcha(
  page: Page,
  siteKey?: string
): Promise<string> {
  const config = getConfig(siteKey);

  return waitForCaptchaResponse(
    page,
    response =>
      config.urlPatterns.some(pattern =>
        response.url().includes(pattern)
      ) &&
      response.status() === config.expectedStatus,
    config.timeout,
    config.responseField,
    config.decodeIterations
  );
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

  return waitForCaptchaResponse(
    page,
    response =>
      patterns.some(pattern =>
        response.url().includes(pattern)
      ) &&
      response.status() === 200,
    30000,
    field,
    iterations
  );
}