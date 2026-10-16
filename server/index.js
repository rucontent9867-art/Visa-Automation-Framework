/**
 * server/index.js
 *
 * Express server entry point.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Ensure Playwright browser cache location is resolved
const localBrowsersPath = path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
if (fs.existsSync(localBrowsersPath)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
  try {
    const rootCacheDir = '/root/.cache';
    if (!fs.existsSync(rootCacheDir)) {
      fs.mkdirSync(rootCacheDir, { recursive: true });
    }
    const rootPlaywrightCache = '/root/.cache/ms-playwright';
    if (!fs.existsSync(rootPlaywrightCache)) {
      fs.symlinkSync(localBrowsersPath, rootPlaywrightCache, 'junction');
    }
  } catch (e) {
    // Ignore symlink errors if permissions prevent it
  }
}

const apiRoutes = require('./routes/api');
const { updateReportDisk } = require('./services/htmlReportGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

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
