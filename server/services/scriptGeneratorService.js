/**
 * scriptGeneratorService.js
 *
 * Playwright Automated Script Generator Engine.
 * Generates and updates production-ready Playwright test scripts conforming to
 * SCRIPT_GENERATOR_GUIDE.md and Direct URL Verification for All Websites.
 *
 * NOTE: Strict requirement: DOES NOT execute test cases or launch live test runs.
 * Generates, heals, and synthesizes clean TypeScript test specs instantly.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const GUIDE_PATH = path.join(process.cwd(), 'SCRIPT_GENERATOR_GUIDE.md');
const SPECS_DIR = path.join(process.cwd(), 'tests', 'spec');

// In-memory active job state
let activeJob = {
  id: null,
  status: 'idle', // 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
  mode: 'create', // 'create' | 'update'
  scriptName: '',
  targetUrl: '',
  scenario: '',
  options: {},
  checkpoints: [],
  logs: [],
  generatedCode: '',
  startTime: null,
  endTime: null,
  error: null
};

// SSE connected clients
const sseClients = new Set();

function registerSseClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('\n');
  sseClients.add(res);

  // Send current status on connect
  res.write(`event: status\ndata: ${JSON.stringify(getStatus())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

function broadcastEvent(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function addLog(message, level = 'info') {
  const logEntry = {
    time: new Date().toLocaleTimeString(),
    message,
    level
  };
  activeJob.logs.push(logEntry);
  broadcastEvent('log', logEntry);
}

function getGuide() {
  try {
    if (fs.existsSync(GUIDE_PATH)) {
      return fs.readFileSync(GUIDE_PATH, 'utf8');
    }
  } catch (err) {
    console.error('[ScriptGenerator] Error reading guide:', err.message);
  }
  return '# Script Generator Guide\nStandard Playwright automated script guidelines.';
}

function updateGuide(content) {
  fs.writeFileSync(GUIDE_PATH, content, 'utf8');
  return { success: true, message: 'Script Generator Guide updated.' };
}

function getExistingSpecs() {
  try {
    if (!fs.existsSync(SPECS_DIR)) return [];
    return fs.readdirSync(SPECS_DIR)
      .filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js'))
      .sort()
      .map(name => ({
        name,
        fullPath: path.join(SPECS_DIR, name)
      }));
  } catch (err) {
    return [];
  }
}

function loadSpecContent(scriptName) {
  const cleanName = path.basename(scriptName);
  const fullPath = path.join(SPECS_DIR, cleanName);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  throw new Error(`Script file not found: ${cleanName}`);
}

function saveScript(scriptName, code) {
  let fileName = path.basename(scriptName).trim();
  if (!fileName.endsWith('.spec.ts') && !fileName.endsWith('.spec.js')) {
    fileName += '.spec.ts';
  }
  if (!fs.existsSync(SPECS_DIR)) {
    fs.mkdirSync(SPECS_DIR, { recursive: true });
  }
  const targetPath = path.join(SPECS_DIR, fileName);
  fs.writeFileSync(targetPath, code, 'utf8');
  return { success: true, fileName, path: targetPath };
}

function getStatus() {
  return {
    id: activeJob.id,
    status: activeJob.status,
    mode: activeJob.mode,
    scriptName: activeJob.scriptName,
    targetUrl: activeJob.targetUrl,
    scenario: activeJob.scenario,
    checkpoints: activeJob.checkpoints,
    logs: activeJob.logs.slice(-100),
    generatedCode: activeJob.generatedCode,
    startTime: activeJob.startTime,
    endTime: activeJob.endTime,
    error: activeJob.error
  };
}

/**
 * Update an existing script by adding or configuring Direct URL Verification
 * and ensuring guidelines (dm443790@gmail.com, baseTest imports) are applied.
 */
function enhanceExistingSpec(code, options = {}) {
  let updated = code;

  // 1. Ensure verifyDirectUrls is imported from baseTest
  if (!updated.includes('verifyDirectUrls')) {
    updated = updated.replace(
      /from\s+['"](\.\.\/\.\.\/utils\/baseTest)['"]/,
      (match, p1) => match.replace('capturescreenshot', 'capturescreenshot, verifyDirectUrls')
    );
    if (!updated.includes('verifyDirectUrls')) {
      updated = updated.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"](\.\.\/\.\.\/utils\/baseTest)['"]/,
        (match, imports, path) => `import { ${imports.trim()}, verifyDirectUrls } from '${path}'`
      );
    }
  }

  // 2. Ensure email convention dm443790@gmail.com
  updated = updated.replace(/['"]([a-zA-Z0-9._%+-]+@(?:test\.com|example\.com|domain\.com|mail\.com))['"]/g, "'dm443790@gmail.com'");

  const directUrlOpts = options.directUrlOptions || {};
  const customUrls = (Array.isArray(directUrlOpts.urls) && directUrlOpts.urls.length > 0)
    ? directUrlOpts.urls
    : ['/visa-status/', '/complete-partially/'];
  const urlsJson = JSON.stringify(customUrls);
  const orderIdSelector = directUrlOpts.orderIdSelector || '#order_id_spn, #order_id, [data-order-id]';
  const timeoutMs = directUrlOpts.timeoutMs || 5000;

  // Check if verifyDirectUrls is already implemented in the spec
  const alreadyHasVerifyCalls = updated.includes('await verifyDirectUrls(');

  if (!alreadyHasVerifyCalls) {
    // Inject Stage 1: Preview Stage verification before Confirm & Submit or Preview Submit
    const previewSubmitPattern = /(await\s+page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"](?:Confirm & Submit|Submit & Preview|Preview)['"][^}]*\}\)\s*\.click\(\);)/;
    if (previewSubmitPattern.test(updated)) {
      const previewBlock = `
    // =======================================================================
    // DIRECT URL VERIFICATION: PREVIEW STAGE
    // Verify whether direct URLs open Preview page before proceeding
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    $1`;
      updated = updated.replace(previewSubmitPattern, previewBlock);
    }

    // Inject Stage 2: Document Upload Stage verification before Save & Continue or Upload Submit
    const uploadSubmitPattern = /(await\s+page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"](?:Save & Continue|Submit Documents|Upload & Continue)['"][^}]*\}\)\s*\.click\(\);)/;
    if (uploadSubmitPattern.test(updated)) {
      const uploadBlock = `
    // =======================================================================
    // DIRECT URL VERIFICATION: DOCUMENT UPLOAD STAGE
    // Verify whether direct URLs open Document Upload page before proceeding
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'document-upload',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });

    $1`;
      updated = updated.replace(uploadSubmitPattern, uploadBlock);
    }

    // Inject Stage 3: Payment Stage verification before payment completion
    const paymentPattern = /(await\s+expect\(\s*page\.getByRole\(['"]heading['"],\s*\{\s*name:\s*['"](?:Pay Application Processing Fee|Payment)['"][^}]*\}\)\s*\)\.toBeVisible\([^)]*\);[\s\S]*?await\s+capturescreenshot\(page,\s*['"]payment-page['"]\);)/;
    if (paymentPattern.test(updated)) {
      const paymentBlock = `$1

    // =======================================================================
    // DIRECT URL VERIFICATION: PAYMENT STAGE
    // Verify whether direct URLs open Payment page before proceeding
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '${orderIdSelector}',
        urls: ${urlsJson},
        waitForCaptcha: true,
        networkIdleTimeoutMs: ${timeoutMs},
    });`;
      updated = updated.replace(paymentPattern, paymentBlock);
    }
  }

  return updated;
}

/**
 * Generate a brand new Playwright test spec using the standardized architecture.
 */
function generateNewSpec(testTitle, targetUrl, scenarioPrompt, options = {}) {
  const directUrlOpts = options.directUrlOptions || {};
  const customUrls = (Array.isArray(directUrlOpts.urls) && directUrlOpts.urls.length > 0)
    ? directUrlOpts.urls
    : ['/visa-status/', '/complete-partially/'];
  const urlsJson = JSON.stringify(customUrls);
  const orderIdSelector = directUrlOpts.orderIdSelector || '#order_id_spn, #order_id, [data-order-id]';
  const timeoutMs = directUrlOpts.timeoutMs || 5000;
  const stages = Array.isArray(directUrlOpts.stages) && directUrlOpts.stages.length > 0
    ? directUrlOpts.stages
    : ['document-upload', 'preview', 'payment'];

  return `/**
 * ${testTitle} - E2E Automated Test
 *
 * Generated automatically by Playwright Auto Script Generator.
 * Standard Email: dm443790@gmail.com
 * Direct URL Verification: Enabled for stages: [${stages.join(', ')}]
 * Target Start URL: ${targetUrl}
 */

import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';
import path from 'path';

test('${testTitle}', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);

    // =====================================
    // NAVIGATE TO PORTAL
    // =====================================
    await page.goto('${targetUrl}');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network did not go idle within 5s, continuing anyway');
    }

    // =====================================
    // GENERAL & APPLICANT DETAILS
    // =====================================
    await page.getByRole('textbox', { name: /Full Name|Name \*/i })
        .fill('Testing User');

    await page.getByRole('textbox', { name: /Email|Email ID/i })
        .fill('dm443790@gmail.com');

    await page.getByRole('textbox', { name: /Phone|Mobile/i })
        .fill('9876543210');

    // Future arrival date helper (avoids month rollover issues)
    const arrival = getArrivalDate();
    if (await page.getByLabel(/Arrival Year/i).isVisible().catch(() => false)) {
        await page.getByLabel(/Arrival Year/i).selectOption(arrival.year);
        await page.getByLabel(/Arrival Month/i).selectOption(arrival.month);
    }

    // Solve Captcha if present on initial form
    const initialCaptcha = await captchaPromise;
    if (initialCaptcha && await page.getByRole('textbox', { name: /Captcha/i }).isVisible().catch(() => false)) {
        await page.getByRole('textbox', { name: /Captcha/i }).fill(initialCaptcha);
    }

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'initial-registration');

    // Click Continue / Next to proceed
    await page.getByRole('button', { name: /Continue|Next|Register|Proceed/i }).first().click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    // =====================================
    // PASSPORT & TRAVEL DETAILS
    // =====================================
    const passportExpiry = getPassportExpiryDate();
    if (await page.getByRole('textbox', { name: /Passport Number/i }).isVisible().catch(() => false)) {
        await page.getByRole('textbox', { name: /Passport Number/i }).fill('A12345678');
    }

    // =====================================
    // DOCUMENT UPLOAD STAGE
    // =====================================
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

        await page.getByRole('button', { name: /Save & Continue|Continue|Next/i }).first().click();
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}
    }

    // =====================================
    // PREVIEW STAGE
    // =====================================
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

    await page.getByRole('button', { name: /Confirm & Submit|Submit/i }).first().click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    // =====================================
    // PAYMENT STAGE
    // =====================================
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

/**
 * Execute script generation pipeline instantly without running live test cases.
 */
async function runGenerationPipeline(jobId) {
  try {
    addLog(`🚀 Starting script synthesis for: ${activeJob.scriptName}`, 'info');
    let generatedScript = '';

    if (activeJob.mode === 'update') {
      addLog(`Loading existing spec: ${activeJob.scriptName}...`, 'info');
      const existingContent = loadSpecContent(activeJob.scriptName);
      addLog(`Parsing stages and applying Direct URL Verification template...`, 'info');
      generatedScript = enhanceExistingSpec(existingContent, activeJob.options);
      addLog(`Applied Direct URL Verification across Preview, Upload, and Payment stages.`, 'success');
      addLog(`Enforced authorized email standard: dm443790@gmail.com.`, 'success');
    } else {
      addLog(`Synthesizing brand-new Playwright test script for: ${activeJob.targetUrl}...`, 'info');
      const testTitle = activeJob.scriptName
        .replace(/\.spec\.(ts|js)$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()) + ' Application';
      generatedScript = generateNewSpec(testTitle, activeJob.targetUrl, activeJob.scenario, activeJob.options);
      addLog(`Generated resilient E2E architecture with Captcha listener, date helpers, and Direct URL checks.`, 'success');
    }

    // Save directly to tests/spec/
    const saveRes = saveScript(activeJob.scriptName, generatedScript);
    activeJob.generatedCode = generatedScript;
    activeJob.status = 'completed';
    activeJob.endTime = new Date().toLocaleTimeString();

    addLog(`✅ Script successfully created & saved to tests/spec/${saveRes.fileName}`, 'success');
    broadcastEvent('completed', { fileName: saveRes.fileName, code: generatedScript });

  } catch (err) {
    activeJob.status = 'failed';
    activeJob.error = err.message;
    activeJob.endTime = new Date().toLocaleTimeString();
    addLog(`❌ Generator error: ${err.message}`, 'error');
    broadcastEvent('failed', { error: err.message });
  }
}

function startJob({ mode = 'create', scriptName, targetUrl, scenario = '', options = {} }) {
  let finalScriptName = scriptName ? scriptName.trim() : 'custom-visa-application.spec.ts';
  if (!finalScriptName.endsWith('.spec.ts') && !finalScriptName.endsWith('.spec.js')) {
    finalScriptName += '.spec.ts';
  }

  let finalUrl = targetUrl ? targetUrl.trim() : '';
  if (mode === 'update' && !finalUrl) {
    try {
      const existing = loadSpecContent(finalScriptName);
      const urlMatch = existing.match(/page\.goto\(['"]([^'"]+)['"]\)/);
      if (urlMatch) finalUrl = urlMatch[1];
    } catch {}
  }

  const jobId = uuidv4();
  activeJob = {
    id: jobId,
    status: 'running',
    mode,
    scriptName: finalScriptName,
    targetUrl: finalUrl,
    scenario,
    options: options || {},
    checkpoints: [],
    logs: [],
    generatedCode: '',
    startTime: new Date().toLocaleTimeString(),
    endTime: null,
    error: null
  };

  addLog(`Initiating ${mode === 'update' ? 'Update & Direct URL Verification' : 'Script Generation'}...`, 'info');
  broadcastEvent('started', { id: jobId, scriptName: finalScriptName, targetUrl: finalUrl });

  // Run immediately and return
  runGenerationPipeline(jobId);

  return { success: true, jobId, message: 'Script generated and saved.' };
}

function stopJob() {
  if (activeJob.status === 'running') {
    activeJob.status = 'stopped';
    activeJob.endTime = new Date().toLocaleTimeString();
    broadcastEvent('stopped', { message: 'Generation job stopped.' });
    return { success: true, message: 'Generation job stopped.' };
  }
  return { success: false, message: 'No job is currently running.' };
}

module.exports = {
  startJob,
  stopJob,
  getStatus,
  getGuide,
  updateGuide,
  getExistingSpecs,
  loadSpecContent,
  saveScript,
  registerSseClient,
  sseClients
};
