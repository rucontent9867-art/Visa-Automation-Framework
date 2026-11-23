/**
 * scriptGeneratorService.js
 *
 * AI-Powered Playwright Script Generator & Locator Self-Healing Engine.
 * - Uses real AI (Google Gemini / OpenAI-compatible endpoints) with no offline mock fallback.
 * - Automatically loads recent Playwright failure logs & DOM error-context.md snapshots when healing scripts.
 * - Validates generated scripts with structural checks + TypeScript compiler (`tsc --noEmit`).
 * - Supports optional bounded live Playwright verification & locator healing (max 2 live attempts).
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const aiProviderService = require('./aiProviderService');
const store = require('./sessionStore');
const { PORTAL_ARCHETYPES, PORTAL_REGISTRY } = require('./portalFlowKnowledge');

const execFileAsync = promisify(execFile);
const SPECS_DIR = path.join(process.cwd(), 'tests', 'spec');
const TEST_RESULTS_DIR = path.join(process.cwd(), 'test-results');

// In-memory active job state
let activeJob = {
  id: null,
  status: 'idle', // 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
  mode: 'create', // 'create' | 'update'
  providerId: null,
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

function getGuide(fileName = 'SCRIPT_GENERATOR_GUIDE.md') {
  try {
    const safeName = path.basename(fileName);
    const targetPath = path.join(process.cwd(), safeName);
    if (fs.existsSync(targetPath)) {
      return fs.readFileSync(targetPath, 'utf8');
    }
  } catch (err) {
    console.error('[ScriptGenerator] Error reading guide:', err.message);
  }
  return '# Script Generator Guide\nStandard Playwright automated script guidelines.';
}

function updateGuide(content, fileName = 'SCRIPT_GENERATOR_GUIDE.md') {
  const safeName = path.basename(fileName);
  const targetPath = path.join(process.cwd(), safeName);
  fs.writeFileSync(targetPath, content, 'utf8');
  return { success: true, message: `${safeName} updated successfully.` };
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

  const validationErr = aiProviderService.validateGeneratedScript(code);
  if (validationErr) {
    throw new Error(validationErr);
  }

  if (!fs.existsSync(SPECS_DIR)) {
    fs.mkdirSync(SPECS_DIR, { recursive: true });
  }
  const targetPath = path.join(SPECS_DIR, fileName);
  fs.writeFileSync(targetPath, code, 'utf8');
  return { success: true, fileName, path: targetPath };
}

function getPortalKnowledge() {
  return {
    archetypes: PORTAL_ARCHETYPES,
    registry: PORTAL_REGISTRY
  };
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
 * Collect the most recent Playwright failure log and DOM snapshot (error-context.md)
 * for a given spec so AI can heal broken locators accurately.
 */
function findRecentFailureContext(scriptName) {
  const cleanName = path.basename(scriptName);
  const slug = cleanName.replace(/\.spec\.(ts|js)$/, '');
  const parts = [];

  // 1. Check latest failed execution in sessionStore
  try {
    const allExecs = Object.values(store.executionsById || {});
    const matchingFails = allExecs
      .filter(e => e && e.testScript === cleanName && e.status === 'FAIL' && e.error)
      .sort((a, b) => new Date(b.endTime || b.startTime || 0) - new Date(a.endTime || a.startTime || 0));

    if (matchingFails.length > 0) {
      parts.push(`Latest Run Error:\n${String(matchingFails[0].error).slice(0, 2000)}`);
    }
  } catch {}

  // 2. Check Playwright error-context.md on disk
  try {
    if (fs.existsSync(TEST_RESULTS_DIR)) {
      const dirs = fs.readdirSync(TEST_RESULTS_DIR)
        .filter(d => d.toLowerCase().startsWith(slug.toLowerCase()));
      for (const dir of dirs) {
        const ctxPath = path.join(TEST_RESULTS_DIR, dir, 'error-context.md');
        if (fs.existsSync(ctxPath)) {
          const content = fs.readFileSync(ctxPath, 'utf8');
          parts.push(`Playwright DOM Error Context (${dir}/error-context.md):\n${content.slice(0, 4500)}`);
          break;
        }
      }
    }
  } catch {}

  return parts.join('\n\n---\n\n');
}

/**
 * Verify TypeScript compilation across the project (`npx tsc --noEmit`).
 */
async function verifyWithTypeScript() {
  try {
    await execFileAsync('npx', ['tsc', '--noEmit'], {
      cwd: process.cwd(),
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    return { ok: true };
  } catch (err) {
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').trim();
    return { ok: false, error: output.slice(0, 2000) };
  }
}

/**
 * Run a single Playwright test execution for live verification (0 retries).
 */
async function runSinglePlaywrightCheck(fileName) {
  const relSpec = path.join('tests', 'spec', fileName);
  try {
    const { stdout, stderr } = await execFileAsync(
      'npx',
      ['playwright', 'test', relSpec, '--project=Desktop-Chromium', '--retries=0', '--reporter=line'],
      {
        cwd: process.cwd(),
        timeout: 150000,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    return { ok: true, output: (stdout || '') + '\n' + (stderr || '') };
  } catch (err) {
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').trim();
    return { ok: false, error: output.slice(0, 3000) };
  }
}

/**
 * Execute AI script generation, TypeScript verification, and optional bounded Playwright verification & healing.
 */
async function runGenerationPipeline(jobId) {
  try {
    if (activeJob.id !== jobId || activeJob.status === 'stopped') return;

    addLog(`🚀 Starting AI script synthesis for: ${activeJob.scriptName}`, 'info');
    const testTitle = activeJob.scriptName
      .replace(/\.spec\.(ts|js)$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase()) + ' Application';

    let existingContent = '';
    let failureContext = '';
    if (activeJob.mode === 'update') {
      addLog(`Loading existing spec: ${activeJob.scriptName}...`, 'info');
      existingContent = loadSpecContent(activeJob.scriptName);
      failureContext = findRecentFailureContext(activeJob.scriptName);
      if (failureContext) {
        addLog(`🩹 Found recent Playwright failure / DOM snapshot for ${activeJob.scriptName}; sending to AI for locator healing.`, 'info');
      }
    }

    let generatedScript = await aiProviderService.generateScript({
      providerId: activeJob.providerId,
      testTitle,
      targetUrl: activeJob.targetUrl,
      scenario: activeJob.scenario,
      existingCode: existingContent,
      failureContext,
      mode: activeJob.mode,
      options: activeJob.options,
      onLog: (msg, lvl) => addLog(msg, lvl)
    });

    if (activeJob.status === 'stopped') return;

    // Backup previous content in memory in case tsc check fails permanently
    const targetPath = path.join(SPECS_DIR, path.basename(activeJob.scriptName));
    const previousDiskContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;

    let saveRes = saveScript(activeJob.scriptName, generatedScript);

    // Run TypeScript compiler verification (with 1 AI heal retry if TS errors occur)
    addLog(`🔍 Running TypeScript compiler check (tsc --noEmit)...`, 'info');
    let tscCheck = await verifyWithTypeScript();
    if (!tscCheck.ok) {
      addLog(`⚠️ TypeScript check detected errors. Asking AI to heal type/syntax issues...`, 'warning');
      try {
        generatedScript = await aiProviderService.generateScript({
          providerId: activeJob.providerId,
          testTitle,
          targetUrl: activeJob.targetUrl,
          scenario: activeJob.scenario,
          existingCode: generatedScript,
          failureContext: `TypeScript compiler errors:\n${tscCheck.error}`,
          mode: 'update',
          options: activeJob.options,
          onLog: (msg, lvl) => addLog(msg, lvl)
        });
        saveRes = saveScript(activeJob.scriptName, generatedScript);
        tscCheck = await verifyWithTypeScript();
      } catch (healErr) {
        if (previousDiskContent !== null) {
          fs.writeFileSync(targetPath, previousDiskContent, 'utf8');
        }
        throw healErr;
      }

      if (!tscCheck.ok) {
        if (previousDiskContent !== null) {
          fs.writeFileSync(targetPath, previousDiskContent, 'utf8');
        }
        throw new Error(`TypeScript compilation failed after AI heal: ${tscCheck.error}`);
      }
    }
    addLog(`✅ TypeScript check passed.`, 'success');

    // Optional bounded Playwright live verification & AI locator self-healing (max 2 live runs)
    if (activeJob.options?.verifyWithPlaywright) {
      const maxLiveAttempts = 2;
      for (let liveAttempt = 1; liveAttempt <= maxLiveAttempts; liveAttempt++) {
        if (activeJob.status === 'stopped') return;
        addLog(`🧪 Live Playwright Verification Run ${liveAttempt}/${maxLiveAttempts}: ${saveRes.fileName}...`, 'info');
        const pwResult = await runSinglePlaywrightCheck(saveRes.fileName);

        if (pwResult.ok) {
          addLog(`✅ Live Playwright verification PASSED on attempt ${liveAttempt}/${maxLiveAttempts}!`, 'success');
          break;
        }

        addLog(`⚠️ Playwright verification failed on attempt ${liveAttempt}/${maxLiveAttempts}.`, 'warning');

        if (liveAttempt < maxLiveAttempts) {
          addLog(`🩹 Capturing failure trace & DOM snapshot for AI locator self-healing...`, 'info');
          const latestCtx = findRecentFailureContext(saveRes.fileName);
          const combinedFailure = `${pwResult.error}\n\n${latestCtx}`.trim();

          generatedScript = await aiProviderService.generateScript({
            providerId: activeJob.providerId,
            testTitle,
            targetUrl: activeJob.targetUrl,
            scenario: activeJob.scenario,
            existingCode: generatedScript,
            failureContext: combinedFailure,
            mode: 'update',
            options: activeJob.options,
            onLog: (msg, lvl) => addLog(msg, lvl)
          });

          saveRes = saveScript(activeJob.scriptName, generatedScript);
        } else {
          throw new Error(`Playwright verification still failing after ${maxLiveAttempts} attempts:\n${pwResult.error.slice(0, 800)}`);
        }
      }
    }

    activeJob.generatedCode = generatedScript;
    activeJob.status = 'completed';
    activeJob.endTime = new Date().toLocaleTimeString();

    addLog(`✅ Script verified & saved to tests/spec/${saveRes.fileName}`, 'success');
    broadcastEvent('completed', { fileName: saveRes.fileName, code: generatedScript });

  } catch (err) {
    activeJob.status = 'failed';
    activeJob.error = err.message;
    activeJob.endTime = new Date().toLocaleTimeString();
    addLog(`❌ Generator error: ${err.message}`, 'error');
    broadcastEvent('failed', { error: err.message });
  }
}

async function startJob({ mode = 'create', scriptName, targetUrl, scenario = '', options = {}, providerId, wait = false }) {
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
    providerId: providerId || null,
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

  addLog(`Initiating AI ${mode === 'update' ? 'Fix / Heal & Update' : 'Script Generation'}...`, 'info');
  broadcastEvent('started', { id: jobId, scriptName: finalScriptName, targetUrl: finalUrl });

  const pipelinePromise = runGenerationPipeline(jobId);

  if (wait) {
    await pipelinePromise;
    return {
      success: activeJob.status === 'completed',
      jobId,
      status: activeJob.status,
      error: activeJob.error,
      scriptName: activeJob.scriptName,
      logs: activeJob.logs
    };
  }

  return { success: true, jobId, status: 'running', message: 'AI generation started.' };
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
  getPortalKnowledge,
  findRecentFailureContext,
  sseClients
};
