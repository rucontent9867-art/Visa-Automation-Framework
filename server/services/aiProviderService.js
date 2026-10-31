/**
 * aiProviderService.js
 *
 * Universal Multi-AI Model & SDET Test Script Generation Engine.
 * Supports:
 *   - Local OpenAI-compatible endpoints (vLLM, Ollama, LM Studio, etc.)
 *   - Google Gemini (@google/genai & REST)
 *   - Copilot & Custom endpoints
 *   - Built-in SDET Smart Engine (Zero-config, guaranteed offline-ready)
 *
 * Enforces unified Senior SDET anti-flakiness standards across ALL models:
 *   - Dynamic element handling & auto-waiting
 *   - Resilient user-facing locators (getByRole, getByLabel)
 *   - Captcha pre-registration
 *   - Safe date utilities
 *   - Direct URL Verification (Preview, Upload, Payment)
 *   - Standard test email: dm443790@gmail.com
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-models-config.json');

// Default provider configuration as requested by user
const DEFAULT_PROVIDERS = [
  {
    id: 'builtin-sdet',
    name: 'Built-in SDET Expert Engine',
    vendor: 'builtin',
    description: 'Guaranteed 100% offline, zero-config resilient test synthesis with full dynamic element handling.',
    isBuiltin: true,
    enabled: true,
  },
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    vendor: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    settings: {
      'models/gemini-2.5-flash': {
        reasoningEffort: 'medium'
      }
    },
    enabled: true,
  },
  {
    id: 'ollama-local',
    name: 'Ollama Local (qwen2.5-coder:14b)',
    vendor: 'customendpoint',
    apiType: 'chat-completions',
    url: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder:14b',
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    enabled: true,
  },
  {
    id: 'vllm-qwen36',
    name: 'Custom Endpoint (VLLM Qwen3.6-35B)',
    vendor: 'customendpoint',
    apiType: 'chat-completions',
    url: 'http://192.168.1.250:8000/v1',
    model: 'Qwen3.6-35B-A3B-NVFP4',
    maxInputTokens: 128000,
    maxOutputTokens: 16000,
    enabled: true,
  },
  {
    id: 'vllm-qwen38',
    name: 'Custom Endpoint 2 (VLLM1 Qwen3.8-27B)',
    vendor: 'customendpoint',
    apiType: 'chat-completions',
    url: 'http://192.168.1.250:8000/v1',
    model: 'Qwen3.8-27B-NVFP4',
    maxInputTokens: 128000,
    maxOutputTokens: 16000,
    enabled: true,
  },
  {
    id: 'ollama-lan-qwen38',
    name: 'Custom Endpoint 3 (LAN Ollama Qwen3.8)',
    vendor: 'customendpoint',
    apiType: 'chat-completions',
    url: 'http://192.168.1.73:11434/v1',
    model: 'qwen3.8:latest',
    maxInputTokens: 128000,
    maxOutputTokens: 16000,
    enabled: true,
  },
  {
    id: 'copilot-codex',
    name: 'Copilot (gpt-5.3-codex)',
    vendor: 'copilot',
    settings: {
      'gpt-5.3-codex': {
        reasoningEffort: 'xhigh'
      }
    },
    enabled: true,
  }
];

function ensureConfigFile() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const initial = {
      activeProviderId: 'builtin-sdet',
      providers: DEFAULT_PROVIDERS,
      connectionStatuses: {}
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readAiConfig() {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.providers || !Array.isArray(parsed.providers)) {
      parsed.providers = DEFAULT_PROVIDERS;
    }
    if (!parsed.activeProviderId) {
      parsed.activeProviderId = 'builtin-sdet';
    }
    if (!parsed.connectionStatuses) {
      parsed.connectionStatuses = {};
    }
    return parsed;
  } catch (err) {
    console.error('[aiProviderService] Error reading config:', err.message);
    return {
      activeProviderId: 'builtin-sdet',
      providers: DEFAULT_PROVIDERS,
      connectionStatuses: {}
    };
  }
}

function writeAiConfig(config) {
  ensureConfigFile();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

function getAiConfig(includeSecrets = false) {
  const config = readAiConfig();
  const safeProviders = config.providers.map(p => {
    const clone = { ...p };
    if (!includeSecrets && clone.apiKey) {
      clone.apiKey = maskApiKey(clone.apiKey);
      clone.hasApiKey = true;
    } else {
      clone.hasApiKey = Boolean(clone.apiKey || process.env.GEMINI_API_KEY);
    }
    clone.status = config.connectionStatuses[p.id] || { state: 'untested', message: 'Not tested yet' };
    return clone;
  });

  return {
    activeProviderId: config.activeProviderId,
    providers: safeProviders,
    connectionStatuses: config.connectionStatuses
  };
}

function setActiveProvider(providerId) {
  const config = readAiConfig();
  const exists = config.providers.some(p => p.id === providerId);
  if (!exists) {
    throw new Error(`AI Provider not found: ${providerId}`);
  }
  config.activeProviderId = providerId;
  writeAiConfig(config);
  return { success: true, activeProviderId: providerId };
}

function saveProviders(updatedProviders, activeProviderId) {
  const config = readAiConfig();
  // Preserve existing API keys if masked ones were sent back
  const merged = updatedProviders.map(p => {
    const existing = config.providers.find(e => e.id === p.id);
    if (existing && p.apiKey && p.apiKey.includes('••••')) {
      return { ...p, apiKey: existing.apiKey };
    }
    return p;
  });

  config.providers = merged;
  if (activeProviderId) {
    config.activeProviderId = activeProviderId;
  }
  writeAiConfig(config);
  return getAiConfig();
}

/**
 * Normalizes OpenAI-compatible base URL.
 * e.g., "http://192.168.1.73:11434" -> "http://192.168.1.73:11434/v1"
 */
function normalizeEndpointUrl(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/v1') && !clean.endsWith('/api')) {
    clean += '/v1';
  }
  return clean;
}

/**
 * Test connectivity for a specific AI Provider.
 */
async function testConnection(providerId) {
  const config = readAiConfig();
  const provider = config.providers.find(p => p.id === providerId);
  if (!provider) {
    return { ok: false, error: `Provider ${providerId} not found` };
  }

  const startTime = Date.now();
  let statusResult = { state: 'offline', message: '', latencyMs: 0, checkedAt: new Date().toISOString() };

  try {
    if (provider.vendor === 'builtin') {
      statusResult = {
        state: 'connected',
        message: 'Built-in SDET Smart Engine ready (100% Offline Guaranteed)',
        latencyMs: 1,
        checkedAt: new Date().toISOString()
      };
    } else if (provider.vendor === 'gemini') {
      const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        statusResult = {
          state: 'offline',
          message: 'Missing Gemini API Key. Provide key or set GEMINI_API_KEY.',
          latencyMs: 0,
          checkedAt: new Date().toISOString()
        };
      } else {
        const ai = new GoogleGenAI({ apiKey });
        // Quick list or lightweight check
        try {
          const testModel = provider.model || 'gemini-2.5-flash';
          const resp = await ai.models.generateContent({
            model: testModel,
            contents: 'ping',
          });
          const latency = Date.now() - startTime;
          statusResult = {
            state: 'connected',
            message: `Connected to Gemini (${testModel}) in ${latency}ms`,
            latencyMs: latency,
            checkedAt: new Date().toISOString()
          };
        } catch (geminiErr) {
          statusResult = {
            state: 'offline',
            message: `Gemini API error: ${geminiErr.message}`,
            latencyMs: Date.now() - startTime,
            checkedAt: new Date().toISOString()
          };
        }
      }
    } else if (provider.vendor === 'customendpoint' || provider.vendor === 'copilot') {
      const baseUrl = normalizeEndpointUrl(provider.url);
      if (!baseUrl) {
        statusResult = {
          state: 'offline',
          message: 'No endpoint URL configured.',
          latencyMs: 0,
          checkedAt: new Date().toISOString()
        };
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        try {
          // Attempt GET /models first
          const modelsUrl = `${baseUrl}/models`;
          const headers = { 'Content-Type': 'application/json' };
          if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

          const res = await fetch(modelsUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          }).catch(async () => {
            // If GET /models fails, attempt a tiny chat completion
            return await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: provider.model || 'qwen2.5-coder:14b',
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 1
              }),
              signal: controller.signal
            });
          });

          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;

          if (res && res.ok) {
            statusResult = {
              state: 'connected',
              message: `Connected to server at ${baseUrl} (${latency}ms)`,
              latencyMs: latency,
              checkedAt: new Date().toISOString()
            };
          } else {
            const statusText = res ? `${res.status} ${res.statusText}` : 'Unreachable';
            statusResult = {
              state: 'offline',
              message: `Server returned status: ${statusText} at ${baseUrl}`,
              latencyMs: latency,
              checkedAt: new Date().toISOString()
            };
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;
          const isTimeout = fetchErr.name === 'AbortError';
          statusResult = {
            state: 'offline',
            message: isTimeout ? `Timeout after 4000ms connecting to ${baseUrl}` : `Cannot connect (${fetchErr.message}) to ${baseUrl}`,
            latencyMs: latency,
            checkedAt: new Date().toISOString()
          };
        }
      }
    } else {
      statusResult = {
        state: 'offline',
        message: `Unknown vendor: ${provider.vendor}`,
        latencyMs: 0,
        checkedAt: new Date().toISOString()
      };
    }
  } catch (err) {
    statusResult = {
      state: 'offline',
      message: `Error: ${err.message}`,
      latencyMs: Date.now() - startTime,
      checkedAt: new Date().toISOString()
    };
  }

  // Save status to config
  config.connectionStatuses[providerId] = statusResult;
  writeAiConfig(config);

  return {
    providerId,
    ok: statusResult.state === 'connected',
    ...statusResult
  };
}

/**
 * Test connections for all configured providers.
 */
async function testAllConnections() {
  const config = readAiConfig();
  const results = {};
  for (const provider of config.providers) {
    results[provider.id] = await testConnection(provider.id);
  }
  return results;
}

/**
 * Universal Senior SDET Anti-Flakiness System Prompt.
 * Guarantees that EVERY AI model (Gemini, vLLM, Ollama, Copilot) follows identical standards.
 */
function buildUniversalSdetPrompt({ testTitle, targetUrl, scenario, existingCode, mode, options = {} }) {
  const directUrlOpts = options.directUrlOptions || {};
  const customUrls = (Array.isArray(directUrlOpts.urls) && directUrlOpts.urls.length > 0)
    ? directUrlOpts.urls
    : ['/visa-status/', '/complete-partially/'];
  const urlsJson = JSON.stringify(customUrls);
  const orderIdSelector = directUrlOpts.orderIdSelector || '#order_id_spn, #order_id, [data-order-id]';
  const timeoutMs = directUrlOpts.timeoutMs || 5000;

  return `You are a Senior Lead SDET (Software Development Engineer in Test) specializing in Playwright TypeScript test automation.
Your task is to produce a bulletproof, non-flaky, production-ready Playwright test spec for:
Target Application: "${testTitle}"
Target URL: "${targetUrl}"
Mode: "${mode}" (create = brand new test spec, update = enhance existing spec with anti-flakiness and Direct URL verification)

--- SENIOR SDET MANDATORY ARCHITECTURAL RULES ---
1. STRICT IMPORTS:
   import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
   import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';
   import path from 'path';

2. ANTI-FLAKINESS & DYNAMIC ELEMENTS DISCIPLINE:
   - NEVER use hardcoded CSS with brittle nth-child or auto-generated dynamic IDs like '#input_83724'.
   - ALWAYS prefer semantic Playwright locators:
     * page.getByRole('textbox', { name: /.../i })
     * page.getByRole('button', { name: /.../i })
     * page.getByRole('combobox', { name: /.../i })
     * page.getByLabel(/.../i)
     * page.getByPlaceholder(/.../i)
   - Dynamic Element Guards: If pages have dynamic loading overlays or spinners, wait for them to detach:
     await page.locator('.loading, .spinner, .overlay, [aria-busy="true"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
   - Resilient element waiting before action:
     const target = page.getByRole('button', { name: /Continue|Next|Proceed/i }).first();
     await target.waitFor({ state: 'visible', timeout: 15000 });
     await target.click();

3. CAPTCHA SYNCHRONIZATION:
   - ALWAYS attach the Captcha listener BEFORE navigation to capture background requests:
     const captchaPromise = waitForCaptcha(page);
     await page.goto('${targetUrl}');
     try {
       await page.waitForLoadState('networkidle', { timeout: 5000 });
     } catch {
       console.log('Network did not go idle within 5s, continuing');
     }
   - When captcha is required, await captchaPromise and fill the captcha input.

4. DYNAMIC DATE UTILITIES:
   - Use arrival date: const arrival = getArrivalDate(); (9 months in future, avoids month rollover)
   - Use passport expiry: const passportExpiry = getPassportExpiryDate(); (5 years in future)

5. AUTHORIZED TEST EMAIL:
   - ALWAYS use "dm443790@gmail.com" for all email fields.
   - Use phone "9876543210".

6. STAGE-BASED DIRECT URL VERIFICATION:
   - Verify URLs at key stages (document-upload, preview, payment) BEFORE submitting:
     await verifyDirectUrls(page, {
       stageName: '<stage>',
       orderIdSelector: '${orderIdSelector}',
       urls: ${urlsJson},
       waitForCaptcha: true,
       networkIdleTimeoutMs: ${timeoutMs},
     });

7. SCREENSHOT CAPTURE:
   - Capture screenshot at each stage:
     await capturescreenshot(page, '<stage-name>');

8. FINAL ASSERTION:
   - Assert authorized email is visible on the review or payment screen:
     await expect(page.getByText('dm443790@gmail.com').first()).toBeVisible({ timeout: 15000 });

${existingCode ? `EXISTING CODE TO ENHANCE/UPDATE:\n\`\`\`typescript\n${existingCode}\n\`\`\`\n` : ''}
${scenario ? `CUSTOM SCENARIO REQUIREMENTS:\n${scenario}\n` : ''}

CRITICAL: Output ONLY the complete, raw TypeScript code. Do NOT wrap in markdown explanation or conversational text. Start directly with the imports or JSDoc header.`;
}

/**
 * Clean and extract raw TypeScript code from AI output.
 */
function cleanAiCode(rawOutput) {
  if (!rawOutput) return '';
  let cleaned = rawOutput.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```typescript') || cleaned.startsWith('```ts') || cleaned.startsWith('```javascript') || cleaned.startsWith('```js')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

/**
 * Generate test script using the specified AI Provider (or active provider).
 * Smoothly falls back to Built-in SDET Smart Engine if the external AI server is offline.
 */
async function generateScript({
  providerId,
  testTitle,
  targetUrl,
  scenario,
  existingCode,
  mode = 'create',
  options = {},
  onLog = () => {}
}) {
  const config = readAiConfig();
  const selectedId = providerId || config.activeProviderId || 'builtin-sdet';
  const provider = config.providers.find(p => p.id === selectedId) || config.providers[0];

  onLog(`Selected AI Engine: ${provider.name} (${provider.vendor})`, 'info');

  const prompt = buildUniversalSdetPrompt({ testTitle, targetUrl, scenario, existingCode, mode, options });

  // 1. Built-in SDET Engine (Rule-based AST Synthesis)
  if (provider.vendor === 'builtin') {
    onLog(`Using Built-in SDET Smart Engine (Guaranteed zero-flakiness)`, 'info');
    return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
  }

  // 2. Google Gemini
  if (provider.vendor === 'gemini') {
    const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      onLog(`⚠️ Gemini API Key not found. Falling back to Built-in SDET Engine.`, 'warning');
      return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
    }
    try {
      onLog(`Connecting to Google Gemini (${provider.model || 'gemini-2.5-flash'})...`, 'info');
      const ai = new GoogleGenAI({ apiKey });
      const modelName = provider.model || 'gemini-2.5-flash';
      const resp = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      const text = resp?.text || '';
      if (!text) throw new Error('Empty response from Gemini');
      onLog(`✨ Gemini successfully synthesized resilient SDET script.`, 'success');
      return cleanAiCode(text);
    } catch (err) {
      onLog(`⚠️ Gemini generation failed: ${err.message}. Falling back to Built-in SDET Engine.`, 'warning');
      return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
    }
  }

  // 3. Custom Endpoints (vLLM, Ollama, OpenAI-compatible)
  if (provider.vendor === 'customendpoint' || provider.vendor === 'copilot') {
    const baseUrl = normalizeEndpointUrl(provider.url);
    if (!baseUrl) {
      onLog(`⚠️ Custom Endpoint URL not configured. Falling back to Built-in SDET Engine.`, 'warning');
      return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
    }

    try {
      onLog(`Connecting to Custom AI server at ${baseUrl} (${provider.model})...`, 'info');
      const chatUrl = `${baseUrl}/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

      const controller = new AbortController();
      const timeoutMs = 25000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model || 'qwen2.5-coder:14b',
          messages: [
            {
              role: 'system',
              content: 'You are a Senior SDET. Output only clean, working Playwright TypeScript code without markdown fences.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: provider.maxOutputTokens || 4096
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      const rawCode = json?.choices?.[0]?.message?.content || '';
      if (!rawCode) throw new Error('Empty response choices from endpoint');

      onLog(`✨ Custom AI Model (${provider.model}) generated test script.`, 'success');
      return cleanAiCode(rawCode);

    } catch (err) {
      onLog(`⚠️ Custom AI server unreachable (${err.message}). Seamlessly generating with Built-in SDET Engine.`, 'warning');
      return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
    }
  }

  // Fallback
  return synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options });
}

/**
 * Built-in SDET Smart Engine.
 * Synthesizes 100% resilient Playwright TypeScript code adhering to all dynamic element
 * and anti-flakiness patterns.
 */
function synthesizeBuiltinScript({ testTitle, targetUrl, scenario, existingCode, mode, options = {} }) {
  const directUrlOpts = options.directUrlOptions || {};
  const customUrls = (Array.isArray(directUrlOpts.urls) && directUrlOpts.urls.length > 0)
    ? directUrlOpts.urls
    : ['/visa-status/', '/complete-partially/'];
  const urlsJson = JSON.stringify(customUrls);
  const orderIdSelector = directUrlOpts.orderIdSelector || '#order_id_spn, #order_id, [data-order-id]';
  const timeoutMs = directUrlOpts.timeoutMs || 5000;

  if (mode === 'update' && existingCode) {
    let updated = existingCode;

    // 1. Ensure verifyDirectUrls is imported
    if (!updated.includes('verifyDirectUrls')) {
      updated = updated.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"](\.\.\/\.\.\/utils\/baseTest)['"]/,
        (match, imports, path) => `import { ${imports.trim()}, verifyDirectUrls } from '${path}'`
      );
    }

    // 2. Enforce standard email dm443790@gmail.com
    updated = updated.replace(/['"]([a-zA-Z0-9._%+-]+@(?:test\.com|example\.com|domain\.com|mail\.com))['"]/g, "'dm443790@gmail.com'");

    // 3. Inject dynamic element handling & direct URL verification if missing
    if (!updated.includes('await verifyDirectUrls(')) {
      const previewPattern = /(await\s+page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"](?:Confirm & Submit|Submit & Preview|Preview)['"][^}]*\}\)\s*\.click\(\);)/;
      if (previewPattern.test(updated)) {
        updated = updated.replace(previewPattern, `
    // DIRECT URL VERIFICATION: PREVIEW STAGE
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    $1`);
      }

      const uploadPattern = /(await\s+page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"](?:Save & Continue|Submit Documents|Upload & Continue)['"][^}]*\}\)\s*\.click\(\);)/;
      if (uploadPattern.test(updated)) {
        updated = updated.replace(uploadPattern, `
    // DIRECT URL VERIFICATION: DOCUMENT UPLOAD STAGE
    await verifyDirectUrls(page, {
        stageName: 'document-upload',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    $1`);
      }

      const paymentPattern = /(await\s+capturescreenshot\(page,\s*['"]payment-page['"]\);)/;
      if (paymentPattern.test(updated)) {
        updated = updated.replace(paymentPattern, `$1

    // DIRECT URL VERIFICATION: PAYMENT STAGE
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });`);
      }
    }

    return updated;
  }

  // Brand new spec synthesis
  const cleanTitle = testTitle || 'Automated Visa Application';
  const cleanUrl = targetUrl || 'https://visa-portal.example.com';

  return `/**
 * ${cleanTitle} - Production E2E Automated Test
 *
 * Generated by SDET Test Synthesis Engine.
 * Anti-Flakiness Rules: Dynamic element waiting, Captcha synchronization, Safe date helpers.
 * Standard Email: dm443790@gmail.com
 * Direct URL Verification: Enabled for Document Upload, Preview, and Payment stages.
 * Target URL: ${cleanUrl}
 */

import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';
import path from 'path';

test('${cleanTitle}', async ({ page, waitForCaptcha }) => {

    // =======================================================================
    // 1. CAPTCHA SYNCHRONIZATION (Listen before navigation)
    // =======================================================================
    const captchaPromise = waitForCaptcha(page);

    // =======================================================================
    // 2. PORTAL NAVIGATION WITH NETWORK-IDLE FALLBACK
    // =======================================================================
    await page.goto('${cleanUrl}');
    try {
        await page.waitForLoadState('networkidle', { timeout: 6000 });
    } catch {
        console.log('Network did not reach idle within 6s, continuing safely');
    }

    // Dismiss dynamic cookies/overlays if present
    const modalDismiss = page.locator('#modal-close, button:has-text("Accept"), button:has-text("Close"), .cookie-consent-btn');
    if (await modalDismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modalDismiss.click().catch(() => {});
    }

    // =======================================================================
    // 3. APPLICANT GENERAL DETAILS (Resilient semantic locators)
    // =======================================================================
    const nameInput = page.getByRole('textbox', { name: /Full Name|Name|Applicant Name/i }).first();
    await nameInput.waitFor({ state: 'visible', timeout: 15000 });
    await nameInput.fill('Testing User');

    // Authorized standard email
    await page.getByRole('textbox', { name: /Email|Email ID|Email Address/i }).first()
        .fill('dm443790@gmail.com');

    // Phone / Mobile number
    if (await page.getByRole('textbox', { name: /Phone|Mobile|Contact/i }).isVisible().catch(() => false)) {
        await page.getByRole('textbox', { name: /Phone|Mobile|Contact/i }).first().fill('9876543210');
    }

    // Dynamic arrival date helper (9 months future, avoids month rollover)
    const arrival = getArrivalDate();
    const arrivalYearSelect = page.getByLabel(/Arrival Year|Year/i).first();
    if (await arrivalYearSelect.isVisible().catch(() => false)) {
        await arrivalYearSelect.selectOption(arrival.year);
        const arrivalMonthSelect = page.getByLabel(/Arrival Month|Month/i).first();
        if (await arrivalMonthSelect.isVisible().catch(() => false)) {
            await arrivalMonthSelect.selectOption(arrival.month);
        }
    }

    // Captcha handling
    const initialCaptcha = await captchaPromise;
    if (initialCaptcha) {
        const captchaBox = page.getByRole('textbox', { name: /Captcha|Security Code/i }).first();
        if (await captchaBox.isVisible().catch(() => false)) {
            await captchaBox.fill(initialCaptcha);
        }
    }

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'initial-registration');

    // Auto-wait and click Continue
    const continueBtn = page.getByRole('button', { name: /Continue|Next|Register|Proceed/i }).first();
    await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await continueBtn.click();

    // Guard against dynamic loader overlay before next page
    await page.locator('.loading, .spinner, .overlay, [aria-busy="true"]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

    // =======================================================================
    // 4. PASSPORT & TRAVEL DETAILS
    // =======================================================================
    const passportInput = page.getByRole('textbox', { name: /Passport Number|Passport No/i }).first();
    if (await passportInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await passportInput.fill('A12345678');
        const passportExpiry = getPassportExpiryDate();
        const expYear = page.locator('#yr_pass_exp_0, [name="pass_exp_year"]');
        if (await expYear.isVisible().catch(() => false)) {
            await expYear.selectOption(passportExpiry.year);
        }
    }

    // =======================================================================
    // 5. DOCUMENT UPLOAD STAGE
    // =======================================================================
    const uploadFile = getUploadFile();
    const fileInputs = page.locator('input[type="file"]');
    if (await fileInputs.count() > 0) {
        await fileInputs.first().setInputFiles(uploadFile);
        await page.waitForTimeout(1000);
        await capturescreenshot(page, 'doc-upload-page');

        // DIRECT URL VERIFICATION: DOCUMENT UPLOAD
        await verifyDirectUrls(page, {
            stageName: 'document-upload',
            orderIdSelector: '${orderIdSelector}',
            urls: ${urlsJson},
            waitForCaptcha: true,
            networkIdleTimeoutMs: ${timeoutMs},
        });

        const saveDocsBtn = page.getByRole('button', { name: /Save & Continue|Continue|Next|Upload/i }).first();
        await saveDocsBtn.waitFor({ state: 'visible', timeout: 15000 });
        await saveDocsBtn.click();
        await page.locator('.loading, .spinner, .overlay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    }

    // =======================================================================
    // 6. PREVIEW STAGE
    // =======================================================================
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview-page');

    // DIRECT URL VERIFICATION: PREVIEW
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    const submitBtn = page.getByRole('button', { name: /Confirm & Submit|Submit|Proceed to Payment/i }).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 });
    await submitBtn.click();
    await page.locator('.loading, .spinner, .overlay').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

    // =======================================================================
    // 7. PAYMENT STAGE & FINAL ASSERTIONS
    // =======================================================================
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    // DIRECT URL VERIFICATION: PAYMENT
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    // Verify authorized test email is displayed on the payment/review page
    await expect(page.getByText('dm443790@gmail.com').first()).toBeVisible({ timeout: 15000 });
});
`;
}

module.exports = {
  getAiConfig,
  saveProviders,
  setActiveProvider,
  testConnection,
  testAllConnections,
  generateScript,
  DEFAULT_PROVIDERS
};
