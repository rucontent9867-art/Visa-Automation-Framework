/**
 * recaptchaAudio.ts
 *
 * Solves Google reCAPTCHA v2 challenges (checkbox or invisible) end-to-end:
 *   1. Detects a visible reCAPTCHA challenge iframe (`iframe[title*="recaptcha challenge" i]:visible`).
 *   2. Primary path: Switches to the Audio Challenge (`#recaptcha-audio-button`),
 *      captures the audio MP3 payload, transcribes via the server-side Gemini endpoint
 *      (`/api/captcha/transcribe-audio` using `gemini-3.5-transcribe`), fills `#audio-response`,
 *      and clicks `#recaptcha-verify-button`.
 *   3. Fallback path: If Google rate-limits audio ("Try again later"), captures the
 *      `#rc-imageselect` grid screenshot + instruction and solves via `/api/captcha/solve-image-grid`
 *      (Gemini Vision), clicking matching tiles and verifying.
 */

import { Page, FrameLocator } from '@playwright/test';

const VISIBLE_CHALLENGE_IFRAME = 'iframe[title*="recaptcha challenge" i]:visible';
const AUDIO_BUTTON = '#recaptcha-audio-button';
const AUDIO_RESPONSE = '#audio-response';
const VERIFY_BUTTON = '#recaptcha-verify-button';
const DOWNLOAD_LINK = '.rc-audiochallenge-tdownload-link';

export interface RecaptchaAudioOptions {
  dialogTimeout?: number;
  maxAttempts?: number;
  serverBaseUrl?: string;
}

function getServerBaseUrl(override?: string): string {
  if (override) return override.replace(/\/+$/, '');
  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

async function isChallengeStillVisible(page: Page): Promise<boolean> {
  return (await page.locator(VISIBLE_CHALLENGE_IFRAME).count().catch(() => 0)) > 0;
}

async function transcribeAudioViaServer(audioBuffer: Buffer, serverBaseUrl: string): Promise<string> {
  const res = await fetch(`${serverBaseUrl}/api/captcha/transcribe-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/mp3',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Transcribe endpoint HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { success?: boolean; text?: string; error?: string };
  if (!data.success || !data.text) {
    throw new Error(data.error || 'Empty transcription returned');
  }
  return data.text.trim();
}

async function solveGridViaServer(
  imageBuffer: Buffer,
  instruction: string,
  totalTiles: number,
  serverBaseUrl: string
): Promise<number[]> {
  const res = await fetch(`${serverBaseUrl}/api/captcha/solve-image-grid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: imageBuffer.toString('base64'),
      instruction,
      totalTiles,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Image-grid endpoint HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { success?: boolean; indices?: number[]; error?: string };
  if (!data.success) {
    throw new Error(data.error || 'Image-grid solve failed');
  }
  return Array.isArray(data.indices) ? data.indices : [];
}

async function tryAudioSolve(
  page: Page,
  bf: FrameLocator,
  serverBaseUrl: string,
  maxAttempts: number
): Promise<{ solved: boolean; rateLimited: boolean }> {
  let latestAudioBuffer: Buffer | null = null;

  const onResponse = async (response: import('@playwright/test').Response) => {
    try {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (url.includes('recaptcha/api2/payload') && ct.includes('audio')) {
        const buf = await response.body().catch(() => null);
        if (buf && buf.length > 500) {
          latestAudioBuffer = buf;
        }
      }
    } catch {
      // Ignore transient response read failures
    }
  };

  page.on('response', onResponse);

  try {
    const audioBtn = bf.locator(AUDIO_BUTTON);
    const audioBtnVisible = await audioBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (audioBtnVisible) {
      await audioBtn.click();
      await page.waitForTimeout(2_000);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const dosVisible = await bf.locator('.rc-doscaptcha-header-text').isVisible({ timeout: 800 }).catch(() => false);
      if (dosVisible) {
        console.warn('[recaptcha] Audio challenge rate-limited ("Try again later"). Attempting reload...');
        const reloadBtn = bf.locator('#recaptcha-reload-button');
        if (await reloadBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await reloadBtn.click();
          await page.waitForTimeout(1_500);
          continue;
        }
        return { solved: false, rateLimited: true };
      }

      // If buffer wasn't captured via listener, fetch via download link
      if (!latestAudioBuffer) {
        const dlHref = await bf.locator(DOWNLOAD_LINK).getAttribute('href').catch(() => null);
        if (dlHref) {
          const resp = await page.request.get(dlHref).catch(() => null);
          if (resp && resp.ok()) {
            latestAudioBuffer = await resp.body();
          }
        }
      }

      if (!latestAudioBuffer) {
        const playBtn = bf.locator('.rc-audiochallenge-play-button button');
        if (await playBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
          await playBtn.click();
          await page.waitForTimeout(2_500);
        }
      }

      if (!latestAudioBuffer) {
        console.warn(`[recaptcha] Audio attempt ${attempt}/${maxAttempts}: no audio payload received.`);
        continue;
      }

      const audioToTranscribe = latestAudioBuffer;
      latestAudioBuffer = null;

      let transcript = '';
      try {
        transcript = await transcribeAudioViaServer(audioToTranscribe, serverBaseUrl);
        console.log(`[recaptcha] Audio attempt ${attempt}/${maxAttempts} transcribed: "${transcript}"`);
      } catch (err: any) {
        console.warn(`[recaptcha] Transcription error on attempt ${attempt}:`, err?.message || err);
        continue;
      }

      const input = bf.locator(AUDIO_RESPONSE);
      if (!(await input.isVisible({ timeout: 2_000 }).catch(() => false))) {
        break;
      }
      await input.fill(transcript);
      await bf.locator(VERIFY_BUTTON).click();

      // Poll up to 4s for challenge iframe to close instead of sleeping blindly
      for (let t = 0; t < 14; t++) {
        await page.waitForTimeout(300);
        if (!(await isChallengeStillVisible(page))) {
          console.log('[recaptcha] Audio challenge solved successfully.');
          return { solved: true, rateLimited: false };
        }
      }
    }

    return { solved: !(await isChallengeStillVisible(page)), rateLimited: false };
  } finally {
    page.off('response', onResponse);
  }
}

let audioRateLimitedUntil = 0;

export function isAudioRateLimited(): boolean {
  return Date.now() < audioRateLimitedUntil;
}

async function tryImageGridSolve(
  page: Page,
  bf: FrameLocator,
  serverBaseUrl: string,
  maxRounds = 6
): Promise<boolean> {
  // Switch back to image challenge if currently on audio or doscaptcha screen
  if (await bf.locator('.rc-doscaptcha-header-text').isVisible({ timeout: 600 }).catch(() => false)) {
    const reloadBtn = bf.locator('#recaptcha-reload-button');
    if (await reloadBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await reloadBtn.click();
      await page.waitForTimeout(1_000);
    }
  }
  const imageBtn = bf.locator('#recaptcha-image-button');
  if (await imageBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await imageBtn.click();
    await page.waitForTimeout(1_200);
  }

  for (let round = 1; round <= maxRounds; round++) {
    if (!(await isChallengeStillVisible(page))) return true;

    const target = bf.locator('#rc-imageselect-target');
    if (!(await target.isVisible({ timeout: 2_500 }).catch(() => false))) {
      return false;
    }

    const tileLocator = bf.locator('.rc-imageselect-tile');
    const totalTiles = await tileLocator.count().catch(() => 0);
    if (totalTiles !== 9 && totalTiles !== 16) {
      return false;
    }

    const instruction = (
      await bf
        .locator('.rc-imageselect-desc-no-canonical, .rc-imageselect-desc, .rc-imageselect-instructions')
        .first()
        .textContent()
        .catch(() => '')
    )?.replace(/\s+/g, ' ').trim() || '';

    const isDynamicChallenge = /once there are none left/i.test(instruction);

    const gridScreenshot = await target.screenshot({ timeout: 6_000, animations: 'disabled' }).catch(() => null);
    if (!gridScreenshot) return false;

    let indices: number[] = [];
    try {
      indices = await solveGridViaServer(gridScreenshot, instruction, totalTiles, serverBaseUrl);
      console.log(`[recaptcha] Visual grid round ${round}/${maxRounds} (${totalTiles} tiles, "${instruction}") -> indices:`, indices);
    } catch (err: any) {
      console.warn(`[recaptcha] Visual grid solve error on round ${round}:`, err?.message || err);
      return false;
    }

    for (const idx of indices) {
      if (idx >= 0 && idx < totalTiles) {
        await tileLocator.nth(idx).click().catch(() => {});
        await page.waitForTimeout(220);
      }
    }

    // For dynamic fade-in grids ("Click verify once there are none left"), wait for replacement images
    // before clicking Verify unless Gemini returned 0 more matching tiles.
    if (isDynamicChallenge && indices.length > 0 && round < maxRounds) {
      await page.waitForTimeout(2_800);
      continue;
    }

    await page.waitForTimeout(800);
    const verifyBtn = bf.locator(VERIFY_BUTTON);
    if (await verifyBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await verifyBtn.click();
      for (let t = 0; t < 14; t++) {
        await page.waitForTimeout(300);
        if (!(await isChallengeStillVisible(page))) {
          console.log('[recaptcha] Visual grid challenge solved successfully.');
          return true;
        }
      }
    }
  }

  return !(await isChallengeStillVisible(page));
}

/**
 * Attempt to solve an active Google reCAPTCHA challenge (audio first via Gemini, then visual grid fallback).
 * Automatically uses visual grid first if Google rate-limited audio on this host.
 * Returns true if no challenge is blocking or the challenge was solved; false if still blocked.
 */
export async function solveRecaptchaAudio(
  page: Page,
  options: RecaptchaAudioOptions = {}
): Promise<boolean> {
  const {
    dialogTimeout = 5_000,
    maxAttempts = 3,
    serverBaseUrl: overrideBaseUrl,
  } = options;

  const serverBaseUrl = getServerBaseUrl(overrideBaseUrl);
  const visibleFrame = page.locator(VISIBLE_CHALLENGE_IFRAME).first();

  const appeared = await visibleFrame.isVisible({ timeout: dialogTimeout }).catch(() => false);
  if (!appeared) {
    return true;
  }

  const bf = visibleFrame.contentFrame();

  // If audio is currently in rate-limit cooldown, solve the visual grid directly while it is open
  if (isAudioRateLimited()) {
    console.log('[recaptcha] Audio cooldown active — solving visual image grid directly via Gemini Vision.');
    return await tryImageGridSolve(page, bf, serverBaseUrl, 6);
  }

  // 1. Try Audio Challenge + Gemini transcription
  const audioResult = await tryAudioSolve(page, bf, serverBaseUrl, maxAttempts);
  if (audioResult.solved) return true;
  if (audioResult.rateLimited) {
    audioRateLimitedUntil = Date.now() + 10 * 60_000;
  }

  // 2. Fallback to Visual Image Grid via Gemini Vision if still visible
  if (await isChallengeStillVisible(page)) {
    const gridSolved = await tryImageGridSolve(page, bf, serverBaseUrl, 6);
    if (gridSolved) return true;
  }

  return !(await isChallengeStillVisible(page));
}

export const solveRecaptchaChallenge = solveRecaptchaAudio;
