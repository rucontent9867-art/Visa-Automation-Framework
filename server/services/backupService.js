/**
 * backupService.js
 *
 * Provides functionality to:
 * 1. Create a full, timestamped backup of all test execution records, reports (HTML, Excel),
 *    screenshots, and data stores before clearing.
 * 2. Completely clear/reset all stored data across:
 *    - In-memory & persistent sessionStore (data/store.json)
 *    - HTML execution report (reports/execution-report.html reset to clean state)
 *    - Excel report workbook (reports/test-reports.xlsx deleted)
 *    - All captured screenshots and failure images (screenshots/* wiped)
 *    - Any temporary analysis or execution dump files
 * 3. List existing backups with metadata and file statistics.
 */

const fs = require('fs');
const path = require('path');
const store = require('./sessionStore');

const ROOT_DIR = process.cwd();
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'screenshots');
const EXCEL_REPORT_FILE = path.join(REPORTS_DIR, 'test-reports.xlsx');
const HTML_REPORT_FILE = path.join(REPORTS_DIR, 'execution-report.html');

/**
 * Format a zero-padded timestamp string for folder names: YYYY-MM-DD_HH-mm-ss
 */
function getTimestampString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

/**
 * Recursively count files, screenshots, and total bytes in a directory.
 */
function scanDirectoryStats(dirPath) {
  let fileCount = 0;
  let screenshotCount = 0;
  let totalBytes = 0;

  if (!fs.existsSync(dirPath)) {
    return { fileCount, screenshotCount, totalBytes };
  }

  function walk(current) {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const stat = fs.statSync(full);
            totalBytes += stat.size;
          } catch (e) {}
          if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
            screenshotCount++;
          }
        }
      }
    } catch (err) {
      console.warn('[backupService] Warning walking directory:', current, err.message);
    }
  }

  walk(dirPath);
  return { fileCount, screenshotCount, totalBytes };
}

/**
 * Create a full backup of all data, reports, and screenshots.
 *
 * @param {Object} options
 * @param {string} [options.backupName] - Optional custom name for the backup folder
 * @returns {Object} Backup summary metadata
 */
function createBackup(options = {}) {
  const timestamp = getTimestampString();
  let folderName = `backup-${timestamp}`;

  if (options.backupName && typeof options.backupName === 'string') {
    const sanitized = options.backupName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (sanitized.length > 0) {
      folderName = sanitized.startsWith('backup-') ? sanitized : `backup-${sanitized}`;
    }
  }

  const targetBackupDir = path.join(BACKUPS_DIR, folderName);

  // Ensure root backups directory and target directory exist
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  if (!fs.existsSync(targetBackupDir)) {
    fs.mkdirSync(targetBackupDir, { recursive: true });
  }

  const copiedFiles = [];
  let backedUpScreenshotsCount = 0;

  // 1. Backup data directory (store.json)
  const backupDataDir = path.join(targetBackupDir, 'data');
  if (fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
    try {
      fs.cpSync(DATA_DIR, backupDataDir, { recursive: true });
      copiedFiles.push('data/store.json');
    } catch (err) {
      console.error('[backupService] Failed to copy data directory:', err.message);
    }
  }

  // 2. Backup reports directory (execution-report.html, test-reports.xlsx, etc.)
  const backupReportsDir = path.join(targetBackupDir, 'reports');
  if (fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(backupReportsDir, { recursive: true });
    try {
      const reportEntries = fs.readdirSync(REPORTS_DIR);
      for (const entry of reportEntries) {
        // Skip any nested backups directory if present
        if (entry === 'backups') continue;
        const src = path.join(REPORTS_DIR, entry);
        const dest = path.join(backupReportsDir, entry);
        fs.cpSync(src, dest, { recursive: true });
        copiedFiles.push(`reports/${entry}`);
      }
    } catch (err) {
      console.error('[backupService] Failed to copy reports directory:', err.message);
    }
  }

  // 3. Backup screenshots directory (all test execution screenshots & failure images)
  const backupScreenshotsDir = path.join(targetBackupDir, 'screenshots');
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(backupScreenshotsDir, { recursive: true });
    try {
      fs.cpSync(SCREENSHOTS_DIR, backupScreenshotsDir, { recursive: true });
      const stats = scanDirectoryStats(backupScreenshotsDir);
      backedUpScreenshotsCount = stats.screenshotCount;
      copiedFiles.push(`screenshots/ (${backedUpScreenshotsCount} images)`);
    } catch (err) {
      console.error('[backupService] Failed to copy screenshots directory:', err.message);
    }
  }

  // 4. Backup miscellaneous test dumps if present
  const optionalFiles = ['final_report.json', 'analysis_dump.json'];
  for (const optFile of optionalFiles) {
    const optPath = path.join(ROOT_DIR, optFile);
    if (fs.existsSync(optPath)) {
      try {
        fs.cpSync(optPath, path.join(targetBackupDir, optFile));
        copiedFiles.push(optFile);
      } catch (e) {}
    }
  }

  // Calculate session & execution statistics from store
  const storeData = store.getAllData();
  const sessionsCount = (storeData && storeData.sessions) ? storeData.sessions.length : 0;
  const executionsCount = (storeData && storeData.executionsById) ? Object.keys(storeData.executionsById).length : 0;

  const totalBackupStats = scanDirectoryStats(targetBackupDir);

  const backupMeta = {
    folderName,
    relativePath: `backups/${folderName}`,
    createdAt: new Date().toISOString(),
    timestamp,
    sessionsCount,
    executionsCount,
    screenshotsCount: backedUpScreenshotsCount,
    totalFilesCount: totalBackupStats.fileCount,
    totalSizeBytes: totalBackupStats.totalBytes,
    totalSizeFormatted: `${(totalBackupStats.totalBytes / (1024 * 1024)).toFixed(2)} MB`,
    filesIncluded: copiedFiles,
  };

  // Write backup summary JSON inside the backup folder
  fs.writeFileSync(
    path.join(targetBackupDir, 'backup-summary.json'),
    JSON.stringify(backupMeta, null, 2),
    'utf8'
  );

  // Write a clean human-readable README.txt inside the backup folder
  const readmeContent = [
    `========================================================================`,
    ` PLAYWRIGHT AUTOMATION BACKUP ARCHIVE: ${folderName}`,
    ` Created: ${backupMeta.createdAt}`,
    `========================================================================`,
    ``,
    `CONTENTS INCLUDED IN THIS BACKUP:`,
    `- Data Store: data/store.json (${sessionsCount} sessions, ${executionsCount} test executions)`,
    `- HTML Report: reports/execution-report.html`,
    `- Excel Report: reports/test-reports.xlsx (if generated)`,
    `- Screenshots: screenshots/ (${backedUpScreenshotsCount} full-page & step capture images)`,
    `- Files: ${totalBackupStats.fileCount} total files (${backupMeta.totalSizeFormatted})`,
    ``,
    `HOW TO VIEW OR RESTORE:`,
    `1. View HTML Report: Open "reports/execution-report.html" in any browser.`,
    `2. View Excel Report: Open "reports/test-reports.xlsx" in Microsoft Excel or Google Sheets.`,
    `3. View Screenshots: Browse the "screenshots/" directory organized by timestamp/spec.`,
    `4. Restore Data: Copy "data/store.json" into the root project "data/" directory and restart the server.`,
    `========================================================================`,
  ].join('\n');

  fs.writeFileSync(path.join(targetBackupDir, 'README.txt'), readmeContent, 'utf8');

  console.log(`[backupService] Successfully created backup archive: ${folderName} (${backupMeta.totalSizeFormatted})`);
  return backupMeta;
}

/**
 * Completely clear everything stored in the application:
 * - SessionStore memory & data/store.json
 * - HTML report (reset to blank slate)
 * - Excel report workbook (reports/test-reports.xlsx deleted)
 * - Screenshots folder (all subfolders and files deleted, leaving empty folder)
 * - Temporary analysis dumps deleted
 *
 * @returns {Object} Result summary
 */
function clearAllStoredData() {
  const result = {
    storeCleared: false,
    excelDeleted: false,
    screenshotsCleared: false,
    htmlReportReset: false,
    dumpsCleaned: false,
  };

  // 1. Clear session store in-memory and write empty state to data/store.json
  try {
    store.clear();
    result.storeCleared = true;
  } catch (err) {
    console.error('[backupService] Error clearing sessionStore:', err.message);
  }

  // 2. Delete Excel report workbook file
  try {
    if (fs.existsSync(EXCEL_REPORT_FILE)) {
      fs.unlinkSync(EXCEL_REPORT_FILE);
      result.excelDeleted = true;
      console.log('[backupService] Deleted Excel report file:', EXCEL_REPORT_FILE);
    } else {
      result.excelDeleted = true; // Was already clean
    }
  } catch (err) {
    console.error('[backupService] Error deleting Excel report file:', err.message);
  }

  // 3. Clear all screenshots in screenshots/ directory
  try {
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      const entries = fs.readdirSync(SCREENSHOTS_DIR);
      for (const entry of entries) {
        const full = path.join(SCREENSHOTS_DIR, entry);
        fs.rmSync(full, { recursive: true, force: true });
      }
    } else {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    result.screenshotsCleared = true;
    console.log('[backupService] Cleared all screenshot files and directories in screenshots/');
  } catch (err) {
    console.error('[backupService] Error clearing screenshots directory:', err.message);
  }

  // 4. Delete optional analysis/dump files if present
  try {
    const dumpFiles = ['final_report.json', 'analysis_dump.json'];
    for (const dumpFile of dumpFiles) {
      const dumpPath = path.join(ROOT_DIR, dumpFile);
      if (fs.existsSync(dumpPath)) {
        fs.unlinkSync(dumpPath);
      }
    }
    result.dumpsCleaned = true;
  } catch (err) {
    console.error('[backupService] Error cleaning dump files:', err.message);
  }

  // 5. Reset HTML report to fresh empty state
  try {
    const { updateReportDisk } = require('./htmlReportGenerator');
    updateReportDisk({ immediate: true });
    result.htmlReportReset = true;
    console.log('[backupService] Regenerated fresh empty HTML report on disk.');
  } catch (err) {
    console.error('[backupService] Error resetting HTML report:', err.message);
  }

  return {
    success: true,
    message: 'All stored test sessions, HTML reports, Excel reports, and screenshots have been completely cleared.',
    clearedDetails: result,
  };
}

/**
 * List all existing backup directories and their metadata.
 *
 * @returns {Array<Object>} List of backups sorted newest first
 */
function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });
    const backups = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const backupPath = path.join(BACKUPS_DIR, entry.name);
      const summaryFile = path.join(backupPath, 'backup-summary.json');

      if (fs.existsSync(summaryFile)) {
        try {
          const raw = fs.readFileSync(summaryFile, 'utf8');
          backups.push(JSON.parse(raw));
          continue;
        } catch (e) {}
      }

      // Fallback if summary file doesn't exist
      const stats = scanDirectoryStats(backupPath);
      backups.push({
        folderName: entry.name,
        relativePath: `backups/${entry.name}`,
        createdAt: fs.statSync(backupPath).birthtime.toISOString(),
        totalFilesCount: stats.fileCount,
        screenshotsCount: stats.screenshotCount,
        totalSizeBytes: stats.totalBytes,
        totalSizeFormatted: `${(stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`,
      });
    }

    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return backups;
  } catch (err) {
    console.error('[backupService] Error listing backups:', err.message);
    return [];
  }
}

module.exports = {
  createBackup,
  clearAllStoredData,
  listBackups,
  BACKUPS_DIR,
  getTimestampString,
};
