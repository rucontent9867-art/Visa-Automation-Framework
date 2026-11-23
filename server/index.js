/**
 * server/index.js
 *
 * Express server entry point.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Ensure Playwright browser cache location is resolved
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  if (fs.existsSync('/ms-playwright')) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
  } else {
    const localBrowsersPath = path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
    if (fs.existsSync(localBrowsersPath)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
    }
  }
}

// Auto-heal Playwright browser revision links in container environments
(function ensurePlaywrightBrowserLinks() {
  const msPlaywright = '/ms-playwright';
  if (!fs.existsSync(msPlaywright)) return;
  try {
    const entries = fs.readdirSync(msPlaywright);
    const headlessSource = entries.find(e => e.startsWith('chromium_headless_shell-') && !fs.lstatSync(path.join(msPlaywright, e)).isSymbolicLink());
    const chromiumSource = entries.find(e => e.startsWith('chromium-') && !fs.lstatSync(path.join(msPlaywright, e)).isSymbolicLink());

    // Read expected revision from browsers.json if available
    const expectedRevisions = new Set(['1254', '1247', '1234']);
    try {
      const browsersJsonPath = path.join(process.cwd(), 'node_modules', 'playwright-core', 'browsers.json');
      if (fs.existsSync(browsersJsonPath)) {
        const bData = JSON.parse(fs.readFileSync(browsersJsonPath, 'utf8'));
        if (Array.isArray(bData.browsers)) {
          bData.browsers.forEach(b => {
            if (b.revision) expectedRevisions.add(String(b.revision));
          });
        }
      }
    } catch (_) {}

    if (headlessSource) {
      const srcPath = path.join(msPlaywright, headlessSource);
      for (const rev of expectedRevisions) {
        const target = path.join(msPlaywright, `chromium_headless_shell-${rev}`);
        if (!fs.existsSync(target)) {
          try { fs.symlinkSync(srcPath, target, 'dir'); } catch (_) {}
        }
      }
    }

    if (chromiumSource || headlessSource) {
      const srcChromium = chromiumSource ? path.join(msPlaywright, chromiumSource) : path.join(msPlaywright, headlessSource);
      for (const rev of expectedRevisions) {
        const target = path.join(msPlaywright, `chromium-${rev}`);
        if (!fs.existsSync(target)) {
          try { fs.symlinkSync(srcChromium, target, 'dir'); } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error('[server] Note on Playwright browser links:', err.message);
  }
})();

const apiRoutes = require('./routes/api');
const { updateReportDisk } = require('./services/htmlReportGenerator');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Serve web frontend static files
app.use(express.static(path.join(process.cwd(), 'web')));

// Serve generated reports, screenshots, and backups
app.use('/reports', express.static(path.join(process.cwd(), 'reports')));
app.use('/screenshots', express.static(path.join(process.cwd(), 'screenshots')));
app.use('/backups', express.static(path.join(process.cwd(), 'backups')));

// API routes
app.use('/api', apiRoutes);

// Fallback to web/index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/reports') || req.path.startsWith('/screenshots') || req.path.startsWith('/backups')) {
    return next();
  }
  res.sendFile(path.join(process.cwd(), 'web', 'index.html'));
});

// Re-sync HTML report file on boot from existing store data
try {
  updateReportDisk({ immediate: true });
} catch (err) {
  console.error('[server] Initial report sync failed:', err.message);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Express server running on port ${PORT}`);
});
