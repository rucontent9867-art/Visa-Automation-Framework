/**
 * aiProviderService.js
 *
 * Universal Multi-AI Model & SDET Test Script Generation Engine.
 * Supports:
 *   - Google Gemini (@google/genai)
 *   - OpenAI-compatible endpoints (vLLM, Ollama, LM Studio, Copilot, etc.)
 *
 * Enforces unified Senior SDET anti-flakiness standards across ALL models:
 *   - Dynamic element handling & auto-waiting
 *   - Resilient user-facing locators (getByRole with exact/first where needed, getByLabel)
 *   - Captcha pre-registration
 *   - Safe date utilities
 *   - Direct URL Verification (Preview, Document Upload, Payment)
 *   - Standard test email: dm443790@gmail.com
 *   - Self-healing retry loop (limited attempts) with TypeScript syntax validation
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { PORTAL_ARCHETYPES, detectArchetype } = require('./portalFlowKnowledge');

const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-models-config.json');

const DEFAULT_PROVIDERS = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    vendor: 'gemini',
    model: 'gemini-4-hydrogen',
    settings: {
      'models/gemini-4-hydrogen': {
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
  }
];

function createGeminiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function ensureConfigFile() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const initial = {
      activeProviderId: 'google-gemini',
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
    let providers = Array.isArray(parsed.providers) ? parsed.providers : DEFAULT_PROVIDERS;
    // Strip any legacy offline builtin provider and upgrade retired Gemini models
    providers = providers
      .filter(p => p && p.vendor !== 'builtin' && p.id !== 'builtin-sdet')
      .map(p => {
        if (p.vendor === 'gemini' && (!p.model || /^(gemini-1\.|gemini-2\.)/i.test(p.model))) {
          return { ...p, model: 'gemini-4-hydrogen' };
        }
        return p;
      });
    if (providers.length === 0) {
      providers = DEFAULT_PROVIDERS;
    }

    let activeProviderId = parsed.activeProviderId;
    if (!activeProviderId || activeProviderId === 'builtin-sdet' || !providers.some(p => p.id === activeProviderId)) {
      activeProviderId = providers[0].id;
    }

    const connectionStatuses = parsed.connectionStatuses || {};
    delete connectionStatuses['builtin-sdet'];

    return {
      activeProviderId,
      providers,
      connectionStatuses
    };
  } catch (err) {
    console.error('[aiProviderService] Error reading config:', err.message);
    return {
      activeProviderId: 'google-gemini',
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
      clone.hasApiKey = Boolean(clone.apiKey || (clone.vendor === 'gemini' && process.env.GEMINI_API_KEY));
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
  const merged = updatedProviders
    .filter(p => p && p.vendor !== 'builtin' && p.id !== 'builtin-sdet')
    .map(p => {
      const existing = config.providers.find(e => e.id === p.id);
      if (existing && p.apiKey && p.apiKey.includes('••••')) {
        return { ...p, apiKey: existing.apiKey };
      }
      return p;
    });

  config.providers = merged.length > 0 ? merged : DEFAULT_PROVIDERS;
  if (activeProviderId && activeProviderId !== 'builtin-sdet') {
    config.activeProviderId = activeProviderId;
  } else if (!config.providers.some(p => p.id === config.activeProviderId)) {
    config.activeProviderId = config.providers[0].id;
  }
  writeAiConfig(config);
  return getAiConfig();
}

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
    if (provider.vendor === 'gemini') {
      const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        statusResult = {
          state: 'offline',
          message: 'Missing GEMINI_API_KEY in server environment.',
          latencyMs: 0,
          checkedAt: new Date().toISOString()
        };
      } else {
        const ai = createGeminiClient(apiKey);
        try {
          const testModel = provider.model || 'gemini-4-hydrogen';
          await ai.models.generateContent({
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
          const modelsUrl = `${baseUrl}/models`;
          const headers = { 'Content-Type': 'application/json' };
          if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

          const res = await fetch(modelsUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          }).catch(async () => {
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
 * Universal Senior SDET Anti-Flakiness & Locator-Healing System Prompt.
 */
function buildUniversalSdetPrompt({ testTitle, targetUrl, scenario, existingCode, failureContext, mode, options = {} }) {
  const directUrlOpts = options.directUrlOptions || {};
  const chosenArchetype = (options.archetype && options.archetype !== 'auto')
    ? options.archetype
    : detectArchetype(targetUrl, existingCode).id;
  const isBahrainArchetype = chosenArchetype === 'archetype-bahrain';
  const defaultUrls = isBahrainArchetype ? ['/application-status/', '/complete-application/'] : ['/visa-status/', '/complete-partially/'];
  const customUrls = (Array.isArray(directUrlOpts.urls) && directUrlOpts.urls.length > 0)
    ? directUrlOpts.urls
    : defaultUrls;
  const urlsJson = JSON.stringify(customUrls);
  const orderIdSelector = directUrlOpts.orderIdSelector || '#order_id_spn, #order_id, [data-order-id]';
  const timeoutMs = directUrlOpts.timeoutMs || 5000;

  return `You are a Principal SDET (Software Development Engineer in Test) and Lead Automation Architect specializing in Playwright TypeScript.
Your task is to produce a bulletproof, non-flaky, 100% production-ready Playwright test spec for:
Target Portal: "${testTitle}"
Target URL: "${targetUrl}"
Mode: "${mode}" (create = brand new test spec, update = fix/heal failing locators & ensure Direct URL verification)
Detected Flow Archetype: "${chosenArchetype}" (${isBahrainArchetype ? 'Preview-First & Multi-Section Upload Standard' : 'Upload-First Standard'})

══════════════════════════════════════════════════════════════════════════════
CRITICAL REQUIREMENT CONTEXT: LIVE FORMS & LIMITED ATTEMPTS
══════════════════════════════════════════════════════════════════════════════
1. The visa application portals tested by this suite are LIVE PRODUCTION SYSTEMS.
2. Every execution submits real lead/form records, so scripts MUST be deterministic, strict-mode safe, and resilient on the very first run.
3. Follow the exact requirement flow established by the golden reference implementations: "azerbaijan-visa.spec.ts" and "bahrain-visa.spec.ts".

══════════════════════════════════════════════════════════════════════════════
ARCHITECTURAL FLOW & LOCATOR HEALING STANDARDS
══════════════════════════════════════════════════════════════════════════════
1. REQUIRED IMPORTS:
   import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
   import { getArrivalDate, getDepartureDate, getDateOfBirth, getPassportIssueDate, getPassportExpiryDate } from '../../utils/date';
   (Only import the date helpers you actually use.)

2. PRE-NAVIGATION CAPTCHA SYNCHRONIZATION:
   Always initialize the Captcha promise BEFORE calling page.goto() so background network triggers are never missed:
   const captchaPromise = waitForCaptcha(page);
   await page.goto('${targetUrl}');
   try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}

3. DETERMINISTIC TEST DATA:
   - Email: ALWAYS use 'dm443790@gmail.com'. Assert its visibility on review/payment screen.
   - Phone: '9876543210'.
   - Dates: ALWAYS use getArrivalDate(), getPassportExpiryDate(), getDateOfBirth() from '../../utils/date'.

4. STRICT-MODE SAFE LOCATORS & OPTIONAL FIELD PROTECTION:
   - Avoid ambiguous substring locators that cause Playwright strict mode violations (e.g. use getByRole('link', { name: '4', exact: true }) instead of { name: '4' } so '4' never collides with '14').
   - Use .first() on generic matches or scope locators to their container (e.g. page.locator('[id^="passport_result_"]').getByText(...)).
   - Optional upload sections (e.g. flight itinerary, hotel booking) MUST be guarded with: if (await loc.count() > 0) { ... }
   - Checkboxes on document upload pages MUST be checked conditionally if present before clicking Save & Continue.
   - Wait for loading overlays/spinners to detach if needed.

5. DIRECT URL DUAL-PAGE VERIFICATION (3 CHECKPOINTS):
   At Preview, Document Upload, and Payment stages, extract Order ID and verify ${urlsJson}:
   await verifyDirectUrls(page, {
       orderId,
       stageName: '<preview|document-upload|payment>',
       urls: ${urlsJson},
       waitForCaptcha,
       networkIdleTimeoutMs: ${timeoutMs},
   });

6. FINAL PAYMENT VERIFICATION:
   - Assert Payment Heading: getByRole('heading', { name: /Pay Application Processing Fee|Pay Visa Processing Fee|Pay Application Fee|Payment/i })
   - Assert 'dm443790@gmail.com' is visible.
   - Screenshot 'payment-page' and log page.url().

${existingCode ? `EXISTING CODE TO FIX / ENHANCE:\n\`\`\`typescript\n${existingCode}\n\`\`\`\n` : ''}
${failureContext ? `RECENT PLAYWRIGHT FAILURE & DOM SNAPSHOT TO HEAL (FIX THE ROOT CAUSE LOCATORS/STEPS):\n${failureContext}\n` : ''}
${scenario ? `CUSTOM SCENARIO / FIX INSTRUCTIONS:\n${scenario}\n` : ''}

CRITICAL: Output ONLY the complete, raw, valid TypeScript test file. Do NOT include any markdown explanations or prose outside the code.`;
}

function cleanAiCode(rawOutput) {
  if (!rawOutput) return '';
  let cleaned = rawOutput.trim();
  const fenceMatch = cleaned.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
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
 * Validate generated TypeScript Playwright spec structure and syntax.
 */
function validateGeneratedScript(code) {
  if (!code || typeof code !== 'string') return 'Generated code is empty.';
  if (!code.includes('baseTest') && !code.includes('@playwright/test')) return 'Missing Playwright test or baseTest import.';
  if (!code.includes('test(')) return 'Missing test(...) block declaration.';
  if (!code.includes('verifyDirectUrls')) return 'Missing verifyDirectUrls multi-stage checkpoint calls.';
  if (!code.includes('dm443790@gmail.com')) return 'Missing required test email dm443790@gmail.com.';

  // Check TypeScript syntax with esbuild (instant, zero-side-effect)
  try {
    const esbuild = require('esbuild');
    esbuild.transformSync(code, { loader: 'ts' });
  } catch (syntaxErr) {
    return `TypeScript syntax error: ${syntaxErr.message}`;
  }

  return null;
}

/**
 * Invoke a single AI generation call against the selected provider (Gemini or Custom OpenAI-compatible).
 */
async function invokeAiProvider(provider, promptContent) {
  if (provider.vendor === 'gemini') {
    const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY in server environment. Configure GEMINI_API_KEY or select a configured online AI endpoint.');
    }
    const modelName = provider.model || 'gemini-4-hydrogen';
    const ai = createGeminiClient(apiKey);
    const resp = await ai.models.generateContent({
      model: modelName,
      contents: promptContent,
    });
    const text = resp?.text || '';
    if (!text) throw new Error('Empty response from Google Gemini');
    return text;
  }

  if (provider.vendor === 'customendpoint' || provider.vendor === 'copilot') {
    const baseUrl = normalizeEndpointUrl(provider.url);
    if (!baseUrl) {
      throw new Error(`Endpoint URL not configured for ${provider.name}.`);
    }

    const chatUrl = `${baseUrl}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    const controller = new AbortController();
    const timeoutMs = 45000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model || 'qwen2.5-coder:14b',
          messages: [
            {
              role: 'system',
              content: 'You are a Principal SDET. Output only valid, complete Playwright TypeScript code without prose or markdown wrappers.'
            },
            {
              role: 'user',
              content: promptContent
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
      return rawCode;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  throw new Error(`Unsupported AI provider vendor: ${provider.vendor}`);
}

/**
 * Generate or heal a Playwright test script strictly using AI with limited self-healing retries.
 */
async function generateScript({
  providerId,
  testTitle,
  targetUrl,
  scenario,
  existingCode,
  failureContext = '',
  mode = 'create',
  options = {},
  onLog = () => {}
}) {
  const config = readAiConfig();
  const selectedId = (providerId && providerId !== 'builtin-sdet') ? providerId : config.activeProviderId;
  const provider = config.providers.find(p => p.id === selectedId) || config.providers[0];

  if (!provider) {
    throw new Error('No AI provider configured.');
  }

  onLog(`Selected AI Engine: ${provider.name} (${provider.vendor})`, 'info');

  const basePrompt = buildUniversalSdetPrompt({
    testTitle,
    targetUrl,
    scenario,
    existingCode,
    failureContext,
    mode,
    options
  });

  const maxAttempts = 3;
  let currentPrompt = basePrompt;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onLog(`🤖 AI Generation Attempt ${attempt}/${maxAttempts} using ${provider.name} (${provider.model || provider.vendor})...`, 'info');
      const rawText = await invokeAiProvider(provider, currentPrompt);
      const cleanedCode = cleanAiCode(rawText);

      const preflightError = validateGeneratedScript(cleanedCode);
      if (preflightError) {
        throw new Error(`Pre-flight validation failed: ${preflightError}`);
      }

      onLog(`✨ ${provider.name} synthesized and validated script on attempt ${attempt}.`, 'success');
      return cleanedCode;
    } catch (err) {
      lastError = err;
      onLog(`⚠️ Attempt ${attempt}/${maxAttempts} failed: ${err.message}`, 'warning');

      // Do not retry missing API key errors
      if (/Missing GEMINI_API_KEY|not configured/i.test(err.message)) {
        throw err;
      }

      if (attempt < maxAttempts) {
        if (/503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|timeout|fetch failed/i.test(err.message)) {
          const delayMs = 1500 * attempt;
          onLog(`⏳ Transient AI service response; retrying in ${delayMs}ms (${attempt + 1}/${maxAttempts})...`, 'info');
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          onLog(`🔄 Triggering AI Self-Healing retry (${attempt + 1}/${maxAttempts}) with error feedback...`, 'info');
          currentPrompt = `Previous Playwright script generation failed validation with error: "${err.message}".\nFix the TypeScript code so it compiles cleanly, uses valid imports from '../../utils/baseTest' and '../../utils/date', uses 'dm443790@gmail.com', and calls verifyDirectUrls.\n\nOriginal Request:\n${basePrompt}`;
        }
      }
    }
  }

  throw new Error(`AI generation failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
}

function getGeminiApiKey() {
  const config = readAiConfig();
  const geminiProvider = config.providers.find(p => p.vendor === 'gemini');
  const apiKey = geminiProvider?.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in server environment.');
  }
  return apiKey;
}

/**
 * Transcribe short audio clips (e.g., reCAPTCHA audio challenge MP3) using Gemini.
 */
async function transcribeAudioWithGemini(audioBase64, mimeType = 'audio/mp3') {
  if (!audioBase64) {
    throw new Error('audioBase64 is required');
  }
  const apiKey = getGeminiApiKey();
  const ai = createGeminiClient(apiKey);
  const { Type } = require('@google/genai');

  const modelsToTry = ['gemini-3.5-transcribe', 'gemini-4-hydrogen'];
  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const audioPart = {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        };
        const promptText = model === 'gemini-3.5-transcribe'
          ? 'Transcribe this short spoken captcha audio exactly into plain lowercase text without punctuation.'
          : 'Listen to this short reCAPTCHA audio clip carefully and return ONLY the exact spoken words/digits as plain lowercase text with no punctuation or extra commentary.';

        const response = await ai.models.generateContent({
          model,
          contents: { parts: [audioPart, { text: promptText }] },
        });
        const text = (response.text || '').trim().replace(/^["']|["']$/g, '').replace(/[.,!?;:]+$/g, '').trim();
        if (text) {
          return { text, model };
        }
      } catch (err) {
        lastError = err;
        const msg = err?.message || String(err);
        if (/404|NOT_FOUND/i.test(msg)) break;
        if (attempt < 2 && /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/i.test(msg)) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Gemini audio transcription failed: ${lastError?.message || 'Empty transcription'}`);
}

/**
 * Solve a visual reCAPTCHA image grid screenshot using Gemini Vision + structured JSON output.
 */
async function solveImageGridCaptchaWithGemini(imageBase64, instruction = '', totalTiles = 9) {
  if (!imageBase64) {
    throw new Error('imageBase64 is required');
  }
  const apiKey = getGeminiApiKey();
  const ai = createGeminiClient(apiKey);
  const { Type } = require('@google/genai');

  const gridDim = totalTiles === 16 ? '4x4 (indices 0 to 15, row-major top-left to bottom-right)' : '3x3 (indices 0 to 8, row-major top-left to bottom-right)';
  const prompt = `Look at this reCAPTCHA image selection grid (${gridDim}).
Instruction: "${instruction || 'Select all matching squares'}"
Identify the 0-based tile indices (0 to ${totalTiles - 1}) in row-major order (top-left is 0, top-right is ${totalTiles === 16 ? 3 : 2}, bottom-right is ${totalTiles - 1}) that contain the requested object.
If none match, return an empty array.`;

  const imagePart = {
    inlineData: {
      mimeType: 'image/png',
      data: imageBase64,
    },
  };

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-4-neon'];
  let lastError = null;
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[aiProvider] solveImageGrid: requesting ${model} (attempt ${attempt}/2, ${totalTiles} tiles)...`);
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, { text: prompt }] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                indices: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                  description: `0-based tile indices from 0 to ${totalTiles - 1}`,
                },
              },
            },
          },
        });
        const rawText = (response.text || '').trim();
        console.log(`[aiProvider] solveImageGrid: ${model} raw output:`, rawText);
        let parsed = { indices: [] };
        try {
          parsed = JSON.parse(rawText || '{"indices":[]}');
        } catch {
          const match = rawText.match(/\[[\s\d,]*\]/);
          if (match) {
            parsed = { indices: JSON.parse(match[0]) };
          }
        }
        const indices = Array.isArray(parsed.indices)
          ? parsed.indices.filter(n => Number.isInteger(n) && n >= 0 && n < totalTiles)
          : [];
        return { indices, model };
      } catch (err) {
        lastError = err;
        const msg = err?.message || String(err);
        console.warn(`[aiProvider] solveImageGrid: ${model} (attempt ${attempt}) error: ${msg.slice(0, 200)}`);
        if (/404|NOT_FOUND|UNSUPPORTED/i.test(msg)) {
          // Model does not exist or does not support vision; immediately try next model
          break;
        }
        if (attempt < 2 && /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/i.test(msg)) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        // If 503/429 persists on this model, break immediately to try the next model
        break;
      }
    }
  }

  throw new Error(`Gemini visual captcha solve failed: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
  getAiConfig,
  saveProviders,
  setActiveProvider,
  testConnection,
  testAllConnections,
  generateScript,
  validateGeneratedScript,
  transcribeAudioWithGemini,
  solveImageGridCaptchaWithGemini,
  DEFAULT_PROVIDERS
};
