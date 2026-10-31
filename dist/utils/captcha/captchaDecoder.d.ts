/**
 * captchaDecoder.ts
 *
 * Pure function to decode captcha response.
 * No shared state — 100% thread-safe for parallel execution.
 *
 * Current pattern (all 70 sites):
 *   - API returns { d: "<base64_encoded_text>" }
 *   - The value is Base64 encoded 3 times
 *   - Decoding 3 times yields plain text captcha
 *
 * Future-proof: accepts configurable iterations and field name.
 */
/**
 * Decode a Base64 string N times.
 *
 * @param encoded - The Base64 encoded string
 * @param iterations - How many times to decode (default: 3)
 * @returns Decoded plain text
 */
export declare function decodeBase64NTimes(encoded: string, iterations?: number): string;
/**
 * Extract and decode captcha text from an API response JSON.
 *
 * @param responseData - The parsed JSON from the captcha API
 * @param field - The field name containing the encoded captcha (default: "d")
 * @param iterations - Number of Base64 decode iterations (default: 3)
 * @returns Decoded plain text captcha
 */
export declare function extractCaptchaText(responseData: Record<string, unknown>, field?: string, iterations?: number): string;
//# sourceMappingURL=captchaDecoder.d.ts.map