/**
 * server/index.js
 *
 * Express server entry point.
 */

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
    const headlessSource = entries.find(e => e.startsWith('chromium_headless_shell-') && !e.includes('1234'));
    if (headlessSource) {
      const srcPath = path.join(msPlaywright, headlessSource);
      const target1234 = path.join(msPlaywright, 'chromium_headless_shell-1234');
      if (!fs.existsSync(target1234)) {
        try { fs.symlinkSync(srcPath, target1234, 'dir'); } catch (_) {}
      }
      const chromeDir = path.join(msPlaywright, 'chromium-1234', 'chrome-linux64');
      if (!fs.existsSync(chromeDir)) {
        fs.mkdirSync(chromeDir, { recursive: true });
        const binSource = path.join(srcPath, 'chrome-headless-shell-linux64');
        if (fs.existsSync(binSource)) {
          const files = fs.readdirSync(binSource);
          for (const f of files) {
            const dest = path.join(chromeDir, f);
            if (!fs.existsSync(dest)) {
              try { fs.symlinkSync(path.join(binSource, f), dest); } catch (_) {}
            }
          }
          const chromeBin = path.join(chromeDir, 'chrome');
          if (!fs.existsSync(chromeBin)) {
            try { fs.symlinkSync(path.join(binSource, 'chrome-headless-shell'), chromeBin); } catch (_) {}
          }
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

app.use(express.json());

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
