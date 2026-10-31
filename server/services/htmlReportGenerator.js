/**
 * htmlReportGenerator.js
 *
 * Single source of truth for generating reports/execution-report.html.
 *
 * Reads store.getAllData() -> writes reports/execution-report.html asynchronously.
 * Fully server-side rendered HTML for instant loading and zero client-side hydration dependency.
 */

const fs = require('fs');
const path = require('path');
const store = require('./sessionStore');

const REPORT_PATH = path.join(process.cwd(), 'reports', 'execution-report.html');

let reportTimer = null;
let isWritingReport = false;

function writeReportHtmlNowSync() {
  if (reportTimer) {
    clearTimeout(reportTimer);
    reportTimer = null;
  }
  try {
    const data = store.getAllData();
    const html = generateReportHtml(data);
    const dir = path.dirname(REPORT_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REPORT_PATH, html, 'utf8');
  } catch (err) {
    console.error('[htmlReportGenerator] Sync report write error:', err.message);
  }
  return REPORT_PATH;
}

async function writeReportHtmlNow() {
  if (reportTimer) {
    clearTimeout(reportTimer);
    reportTimer = null;
  }
  if (isWritingReport) return REPORT_PATH;
  isWritingReport = true;

  try {
    const data = store.getAllData();
    const html = generateReportHtml(data);
    const dir = path.dirname(REPORT_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(REPORT_PATH, html, 'utf8');
  } catch (err) {
    console.error('[htmlReportGenerator] Async report write error:', err.message);
  } finally {
    isWritingReport = false;
  }
  return REPORT_PATH;
}

function updateReportDisk(options = {}) {
  const immediate = typeof options === 'boolean' ? options : !!options.immediate;
  if (immediate) {
    return writeReportHtmlNowSync();
  }

  if (!reportTimer) {
    reportTimer = setTimeout(() => {
      writeReportHtmlNow();
    }, 5000);
  }
  return REPORT_PATH;
}

function scheduleReportDiskUpdate(delayMs = 5000) {
  if (!reportTimer) {
    reportTimer = setTimeout(() => {
      writeReportHtmlNow();
    }, delayMs);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTestTitle(filename) {
  if (!filename) return '';
  let name = filename.replace(/\.(spec|test)\.(ts|js)$/i, '');
  name = name.replace(/[-_]/g, ' ');
  return name.split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ');
}

function formatDateKey(d) {
  if (!d) return 'Unknown Date';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Unknown Date';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function formatDateLabel(dateKey) {
  if (!dateKey) return 'Unknown';
  if (dateKey === 'ALL') return 'All Dates';
  const now = new Date();
  const todayKey = formatDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const parts = String(dateKey).split('-');
  if (parts.length === 3) {
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(dt.getTime())) {
      const monthStr = dt.toLocaleString('en-US', { month: 'short' });
      const dayNum = dt.getDate();
      const yearNum = dt.getFullYear();

      if (dateKey === todayKey) return 'Today (' + monthStr + ' ' + dayNum + ')';
      if (dateKey === yesterdayKey) return 'Yesterday (' + monthStr + ' ' + dayNum + ')';
      return monthStr + ' ' + dayNum + ', ' + yearNum;
    }
  }
  return dateKey;
}

function getDeviceIcon(device) {
  if (/android/i.test(device)) return 'fa-android';
  if (/ios/i.test(device)) return 'fa-apple';
  return 'fa-desktop';
}

function getBrowserIcon(browser) {
  if (/firefox/i.test(browser)) return 'fa-firefox-browser';
  if (/webkit|safari/i.test(browser)) return 'fa-safari';
  return 'fa-chrome';
}

function getStatusBadgeHtml(status) {
  switch (status) {
    case 'PASS':
      return '<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> PASS</span>';
    case 'RETRY_PASS':
      return '<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> RETRY PASS</span>';
    case 'FAIL':
      return '<span class="status-badge status-FAIL"><i class="fas fa-times-circle"></i> FAIL</span>';
    case 'RUNNING':
      return '<span class="status-badge status-RUNNING"><i class="fas fa-spinner fa-spin"></i> RUNNING</span>';
    case 'PENDING':
      return '<span class="status-badge status-PENDING"><i class="fas fa-clock"></i> PENDING</span>';
    case 'CANCELLED':
      return '<span class="status-badge status-CANCELLED"><i class="fas fa-ban"></i> CANCELLED</span>';
    case 'STOPPED':
      return '<span class="status-badge status-STOPPED"><i class="fas fa-stop-circle"></i> STOPPED</span>';
    default:
      return '<span class="status-badge status-PENDING">' + escapeHtml(status || 'UNKNOWN') + '</span>';
  }
}

function generateReportHtml(data) {
  const jsonStr = JSON.stringify(data).replace(/</g, '\\u003c');

  let rawSessions = (data && data.sessions) ? data.sessions : [];
  let executionsById = (data && data.executionsById) ? data.executionsById : {};
  let settings = (data && data.settings) ? data.settings : { excludeStoppedSessions: false, hideIncompleteTests: false };

  // Filter sessions if excludeStoppedSessions setting is enabled
  let sessions = rawSessions.filter(s => {
    if (!s) return false;
    if (settings.excludeStoppedSessions && (s.status === 'STOPPED' || s.status === 'CANCELLED')) {
      return false;
    }
    return true;
  });

  let contentHtml = '';
  const errorStoreObj = {};
  const urlsStoreObj = {};

  if (sessions.length === 0) {
    contentHtml = '<div style="text-align: center; padding: 48px 24px; color: var(--text-secondary); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); max-width: 640px; margin: 30px auto; box-shadow: var(--shadow);">' +
      '<div style="width: 56px; height: 56px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px;">' +
        '<i class="fas fa-file-alt"></i>' +
      '</div>' +
      '<h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">No Execution Reports Available</h3>' +
      '<p style="font-size: 13.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">' +
        'No test execution history found. Select test scripts on the main dashboard and click <strong>Run Selected</strong> or <strong>Run All</strong> to execute automated test suites and generate reports.' +
      '</p>' +
      '<div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 20px; font-size: 12px; font-weight: 600; color: var(--text-muted);">' +
        '<i class="fas fa-info-circle" style="color: var(--accent);"></i> Reports update automatically after every execution run' +
      '</div>' +
    '</div>';
  } else {
    // Build date map from real sessions
    const dateMap = new Map();
    for (const s of sessions) {
      const k = formatDateKey(s.createdAt);
      if (!dateMap.has(k)) dateMap.set(k, []);
      dateMap.get(k).push(s);
    }

    // Get sorted date keys (descending)
    const sortedDateKeys = Array.from(dateMap.keys()).sort().reverse();
    const latestDateKey = sortedDateKeys[0] || '';

    // Build Tabs UI with Date Search Picker
    let tabsHtml = '<div class="date-tabs-wrapper">' +
      '<div class="date-tabs-header-label"><i class="far fa-calendar-alt"></i> Date Reports</div>' +
      '<div class="date-search-box">' +
        '<label for="reportDatePicker"><i class="fas fa-search"></i> Search:</label>' +
        '<input type="date" id="reportDatePicker" class="date-picker-input" title="Select a date to search reports" />' +
        '<button type="button" id="clearDateBtn" class="clear-date-btn" title="Clear search"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="date-tabs-divider"></div>' +
      '<button type="button" class="tab-scroll-btn" id="tabScrollLeft" title="Scroll Left"><i class="fas fa-chevron-left"></i></button>' +
      '<div class="date-tabs-container" id="dateTabsContainer">';

    for (const dateKey of sortedDateKeys) {
      const isActive = dateKey === latestDateKey ? ' active' : '';
      tabsHtml += '<button type="button" class="date-tab' + isActive + '" data-date-key="' + dateKey + '">' +
        '<i class="far fa-calendar-check"></i> ' + formatDateLabel(dateKey) +
      '</button>';
    }

    tabsHtml += '</div>' +
      '<button type="button" class="tab-scroll-btn" id="tabScrollRight" title="Scroll Right"><i class="fas fa-chevron-right"></i></button>' +
    '</div>';

    // Build Session Cards Container
    let cardsHtml = '<div id="sessionCardsContainer">';
    const sortedSessions = [...sessions].reverse();

    for (const session of sortedSessions) {
      const sessionDateKey = formatDateKey(session.createdAt);
      const execIds = session.executionIds || [];
      let execs = execIds.map(id => executionsById[id]).filter(Boolean);

      if (settings.hideIncompleteTests) {
        execs = execs.filter(exec => exec && (exec.status === 'PASS' || exec.status === 'FAIL' || exec.status === 'RETRY_PASS'));
      }

      cardsHtml += '<div class="session-card" data-session-date="' + sessionDateKey + '">' +
        '<div class="session-header">' +
          '<div class="session-title"><i class="fas fa-layer-group" style="color: var(--accent);"></i> Execution Session #' + session.runNumber + '</div>' +
          '<div class="session-meta">' +
            '<span><i class="far fa-clock"></i> Date & Time: ' + new Date(session.createdAt).toLocaleString() + '</span>' +
            '<span><i class="fas fa-tasks"></i> Total Executions: ' + execs.length + '</span>' +
            '<span>Status: ' + getStatusBadgeHtml(session.status) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="table-responsive-wrapper">' +
          '<table class="run-details-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Test Script</th>' +
                '<th>Environment</th>' +
                '<th>Status</th>' +
                '<th>Attempts</th>' +
                '<th>Captured URL(s)</th>' +
                '<th>Screenshot</th>' +
                '<th>Duration</th>' +
                '<th>Error Details</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>';

      if (execs.length === 0) {
        cardsHtml += '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 13px;"><i class="fas fa-filter"></i> No completed (PASS/FAIL) test executions in this session.</td></tr>';
      } else {
        for (const exec of execs) {
          const formattedTitle = formatTestTitle(exec.testScript);
          // Extract all captured URLs (supports array or legacy paymentUrl)
          const capturedList = [];
          if (Array.isArray(exec.capturedUrls) && exec.capturedUrls.length > 0) {
            for (const u of exec.capturedUrls) {
              const uStr = typeof u === 'string' ? u : (u && u.url);
              if (uStr && uStr !== 'N/A' && !capturedList.includes(uStr)) {
                capturedList.push(uStr);
              }
            }
          }
          if (capturedList.length === 0 && exec.paymentUrl && exec.paymentUrl !== 'N/A') {
            capturedList.push(exec.paymentUrl);
          }

          if (capturedList.length > 0) {
            urlsStoreObj[exec.id] = {
              title: formattedTitle || exec.testScript,
              device: exec.device,
              browser: exec.browser,
              urls: capturedList,
              history: Array.isArray(exec.urlHistory) ? exec.urlHistory : []
            };
          }

          let payUrl = '<span class="empty-cell">—</span>';
          if (capturedList.length === 1) {
            const singleUrl = capturedList[0];
            payUrl = '<div class="url-cell-wrapper">' +
              '<a href="' + escapeHtml(singleUrl) + '" target="_blank" class="btn-table btn-table-url" title="' + escapeHtml(singleUrl) + '"><i class="fas fa-external-link-alt"></i> Open URL</a>' +
              '<button type="button" class="btn-table-icon" onclick="copySingleUrl(\'' + escapeHtml(singleUrl) + '\', this)" title="Copy URL"><i class="fas fa-copy"></i></button>' +
            '</div>';
          } else if (capturedList.length > 1) {
            const latestUrl = capturedList[capturedList.length - 1];
            payUrl = '<div class="url-cell-wrapper">' +
              '<button type="button" class="btn-table btn-table-url-multiple" onclick="openUrlsModal(\'' + exec.id + '\')" title="View all ' + capturedList.length + ' captured URLs"><i class="fas fa-layer-group"></i> ' + capturedList.length + ' URLs</button>' +
              '<a href="' + escapeHtml(latestUrl) + '" target="_blank" class="btn-table btn-table-url-latest" title="Open latest: ' + escapeHtml(latestUrl) + '"><i class="fas fa-external-link-alt"></i> Latest</a>' +
            '</div>';
          }

          const screenshot = (exec.screenshotPath && exec.screenshotPath !== 'N/A')
            ? '<a href="' + escapeHtml(exec.screenshotPath) + '" target="_blank" class="btn-table btn-table-screenshot"><i class="fas fa-image"></i> View Screenshot</a>'
            : '<span class="empty-cell">—</span>';

          const attempts = exec.retries != null ? (exec.retries + 1) : 1;
          const attemptBadge = '<span class="exec-attempts">Attempt #' + attempts + '</span>';
          const durationText = exec.duration != null ? exec.duration + 's' : '—';

          let errorHtml = '<span class="empty-cell">—</span>';
          if (exec.error && exec.error.trim()) {
            errorStoreObj[exec.id] = {
              title: formattedTitle || exec.testScript,
              device: exec.device,
              browser: exec.browser,
              error: exec.error
            };

            const shortErr = exec.error.length > 35 ? exec.error.substring(0, 35) + '…' : exec.error;
            errorHtml = '<div class="error-cell-wrapper">' +
              '<span class="error-preview" title="' + escapeHtml(exec.error) + '">' + escapeHtml(shortErr) + '</span>' +
              '<button type="button" class="btn-table btn-table-details" onclick="openErrorModal(\'' + exec.id + '\')"><i class="fas fa-external-link-alt"></i> View Details</button>' +
            '</div>';
          }

          cardsHtml += '<tr>' +
            '<td><div class="test-script-cell"><strong class="test-title">' + escapeHtml(formattedTitle) + '</strong><span class="test-file">' + escapeHtml(exec.testScript) + '</span></div></td>' +
            '<td><div class="env-cell">' +
              '<span class="platform-chip"><i class="' + (exec.device === 'Android' ? 'fab' : exec.device === 'iOS' ? 'fab' : 'fas') + ' ' + getDeviceIcon(exec.device) + '"></i> ' + escapeHtml(exec.device) + '</span>' +
              '<span class="engine-chip"><i class="fab ' + getBrowserIcon(exec.browser) + '"></i> ' + escapeHtml(exec.browser) + '</span>' +
            '</div></td>' +
            '<td>' + getStatusBadgeHtml(exec.status) + '</td>' +
            '<td>' + attemptBadge + '</td>' +
            '<td>' + payUrl + '</td>' +
            '<td>' + screenshot + '</td>' +
            '<td><span class="duration-badge">' + escapeHtml(durationText) + '</span></td>' +
            '<td>' + errorHtml + '</td>' +
          '</tr>';
        }
      }

      cardsHtml += '</tbody></table></div></div>';
    }
    cardsHtml += '</div>';

    contentHtml = tabsHtml + cardsHtml;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playwright Automation Test Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --border: #e2e8f0;
      --border-light: #cbd5e1;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --accent: #2563eb;
      --accent-light: #eff6ff;
      --accent-border: #bfdbfe;
      --danger: #dc2626;
      --radius: 12px;
      --radius-sm: 8px;
      --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
      --shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg-primary); margin: 0; padding: 24px; color: var(--text-primary); line-height: 1.5; -webkit-font-smoothing: antialiased; }
    .container { max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .page-header h1 { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
    .page-header h1 i { color: var(--accent); }
    
    .date-tabs-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 16px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      margin-bottom: 20px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(8px);
      flex-wrap: nowrap;
      width: 100%;
      box-sizing: border-box;
    }
    .date-tabs-header-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 10px;
      border-right: 1px solid var(--border);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .date-search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .date-search-box:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      background: var(--bg-primary);
    }
    .date-search-box label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .date-picker-input {
      background: transparent;
      border: none;
      outline: none;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      font-family: inherit;
      cursor: pointer;
    }
    .clear-date-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      transition: all 0.15s ease;
    }
    .clear-date-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .date-tabs-divider {
      width: 1px;
      height: 24px;
      background: var(--border);
      margin: 0 2px;
      flex-shrink: 0;
    }
    .tab-scroll-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.2s ease;
      font-size: 11px;
    }
    .tab-scroll-btn:hover {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }
    .date-tabs-container {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      scroll-behavior: smooth;
      padding: 2px 0;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      flex: 1 1 0%;
      min-width: 0;
    }
    .date-tabs-container::-webkit-scrollbar,
    .date-tabs-wrapper::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .date-tab {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .date-tab:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-light);
    }
    .date-tab.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    }

    #sessionCardsContainer { display: flex; flex-direction: column; gap: 24px; }
    .session-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; transition: all 0.2s ease; }
    .session-header { padding: 16px 20px; background: var(--bg-tertiary); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .session-title { font-size: 15px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .session-meta { display: flex; align-items: center; gap: 16px; font-size: 12px; color: var(--text-secondary); flex-wrap: wrap; }
    .session-meta span { display: inline-flex; align-items: center; gap: 5px; }

    .table-responsive-wrapper { width: 100%; overflow-x: auto; }
    .run-details-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .run-details-table th { background: #f8fafc; color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding: 12px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    .run-details-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; }
    .run-details-table tbody tr:last-child td { border-bottom: none; }
    .run-details-table tbody tr:hover { background: #f8fafc; }

    .test-script-cell { display: flex; flex-direction: column; gap: 3px; max-width: 260px; }
    .test-title { font-weight: 600; color: var(--text-primary); font-size: 13.5px; }
    .test-file { font-size: 11.5px; color: var(--text-muted); font-family: monospace; }
    .env-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .platform-chip, .engine-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); white-space: nowrap; }
    .exec-attempts { font-size: 11px; font-weight: 600; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); white-space: nowrap; }
    .duration-badge { font-size: 12px; font-weight: 600; color: var(--text-secondary); font-family: monospace; white-space: nowrap; }
    .empty-cell { color: var(--text-muted); font-style: italic; font-size: 12px; }

    .btn-table { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 11.5px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; white-space: nowrap; }
    .btn-table-url { background: #eff6ff; color: var(--accent); border-color: #bfdbfe; }
    .btn-table-url:hover { background: var(--accent); color: white; border-color: var(--accent); }
    .btn-table-screenshot { background: #fdf4ff; color: #c084fc; border-color: #f3e8ff; }
    .btn-table-screenshot:hover { background: #c084fc; color: white; border-color: #c084fc; }
    .btn-table-details { background: #fef2f2; color: var(--danger); border-color: #fecaca; }
    .btn-table-details:hover { background: var(--danger); color: white; border-color: var(--danger); }
    .btn-table-url-multiple { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
    .btn-table-url-multiple:hover { background: #16a34a; color: white; border-color: #16a34a; }
    .btn-table-url-latest { background: #dcfce7; color: #15803d; border-color: #bbf7d0; padding: 6px 10px; }
    .btn-table-url-latest:hover { background: #15803d; color: white; border-color: #15803d; }
    .btn-table-icon { background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); padding: 4px 7px; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
    .btn-table-icon:hover { color: var(--accent); border-color: var(--accent); background: var(--bg-secondary); }
    .url-cell-wrapper { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    
    .url-history-item { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.15s ease; }
    .url-history-item:hover { border-color: var(--accent); }
    .url-history-header { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .url-history-label { display: flex; align-items: center; gap: 6px; color: var(--accent); }
    .url-step-badge { background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; }
    .url-history-time { font-size: 11px; color: var(--text-muted); font-weight: normal; }
    .url-history-box { background: #0f172a; color: #38bdf8; padding: 8px 12px; border-radius: 4px; font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; word-break: break-all; border: 1px solid #1e293b; user-select: all; }
    .url-history-actions { display: flex; gap: 8px; justify-content: flex-end; }
    
    .error-cell-wrapper { display: flex; flex-direction: column; gap: 6px; max-width: 220px; }
    .error-preview { font-size: 12px; color: var(--danger); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Fira Code', 'Cascadia Code', monospace; }
    
    /* Modal Styles */
    .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-backdrop.hidden { display: none !important; }
    .modal-container { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); width: 100%; max-width: 720px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--bg-tertiary); }
    .modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
    .modal-close-btn { background: transparent; border: none; font-size: 24px; line-height: 1; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .modal-close-btn:hover { background: rgba(0,0,0,0.06); color: var(--text-primary); }
    .modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .error-meta { font-size: 13px; color: var(--text-secondary); padding: 8px 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border); }
    .error-trace-container { width: 100%; background: #1e293b; border-radius: var(--radius-sm); border: 1px solid #334155; padding: 14px; max-height: 420px; overflow-y: auto; }
    .error-stack-trace { margin: 0; font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 12.5px; line-height: 1.6; color: #f87171; white-space: pre-wrap; word-break: break-word; }
    .modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--bg-tertiary); }
    
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; border: 1px solid transparent; white-space: nowrap; }
    .status-badge.status-PASS { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
    .status-badge.status-FAIL { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
    .status-badge.status-RUNNING { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
    .status-badge.status-PENDING { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
    .status-badge.status-CANCELLED, .status-badge.status-STOPPED { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1><i class="fas fa-vial"></i> Test Automation Report</h1>
    </div>
    <div id="app">${contentHtml}</div>
  </div>

  <!-- Error Details Modal -->
  <div class="modal-backdrop hidden" id="errorModal" role="dialog" aria-modal="true">
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Test Execution Error Details</h3>
        <button type="button" class="modal-close-btn" id="errorModalCloseBtn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="error-meta" id="errorModalMeta"></div>
        <div class="error-trace-container">
          <pre class="error-stack-trace" id="errorModalTrace"></pre>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-table btn-table-details" id="errorModalCopyBtn"><i class="fas fa-copy"></i> Copy Trace</button>
        <button type="button" class="btn-table btn-table-cancel" id="errorModalOkBtn">Close</button>
      </div>
    </div>
  </div>

  <!-- Captured URLs Modal -->
  <div class="modal-backdrop hidden" id="urlsModal" role="dialog" aria-modal="true">
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-link" style="color: var(--accent);"></i> Captured URLs History (<span id="urlsModalCount">0</span>)</h3>
        <button type="button" class="modal-close-btn" id="urlsModalCloseBtn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="error-meta" id="urlsModalMeta"></div>
        <div id="urlsModalList" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;">
          <!-- Dynamically populated -->
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-table btn-table-details" id="urlsModalCopyAllBtn"><i class="fas fa-copy"></i> Copy All URLs</button>
        <button type="button" class="btn-table btn-table-cancel" id="urlsModalOkBtn">Close</button>
      </div>
    </div>
  </div>

  <script id="__REPORT_DATA__" type="application/json">
    ${jsonStr}
  </script>

  <script>
    const executionErrorStore = new Map(${JSON.stringify(Object.entries(errorStoreObj))});
    const executionUrlsStore = new Map(${JSON.stringify(Object.entries(urlsStoreObj))});

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function openErrorModal(execId) {
      const errorData = executionErrorStore.get(execId);
      const errorModal = document.getElementById('errorModal');
      if (!errorData || !errorModal) return;

      const errorModalMeta = document.getElementById('errorModalMeta');
      const errorModalTrace = document.getElementById('errorModalTrace');

      if (errorModalMeta) {
        errorModalMeta.innerHTML = '<strong>' + escapeHtml(errorData.title) + '</strong> &bull; ' +
          '<span>' + escapeHtml(errorData.device) + ' / ' + escapeHtml(errorData.browser) + '</span>';
      }
      if (errorModalTrace) {
        errorModalTrace.textContent = errorData.error;
      }

      errorModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeErrorModal() {
      const errorModal = document.getElementById('errorModal');
      if (!errorModal) return;
      errorModal.classList.add('hidden');
      document.body.style.overflow = '';
    }

    function openUrlsModal(execId) {
      const urlData = executionUrlsStore.get(execId);
      const urlsModal = document.getElementById('urlsModal');
      if (!urlData || !urlsModal) return;

      const metaEl = document.getElementById('urlsModalMeta');
      const countEl = document.getElementById('urlsModalCount');
      const listEl = document.getElementById('urlsModalList');

      if (countEl) countEl.textContent = urlData.urls.length;
      if (metaEl) {
        metaEl.innerHTML = '<strong>' + escapeHtml(urlData.title) + '</strong> &bull; ' +
          '<span>' + escapeHtml(urlData.device) + ' / ' + escapeHtml(urlData.browser) + '</span>';
      }

      if (listEl) {
        let itemsHtml = '';
        const history = (urlData.history && urlData.history.length > 0)
          ? urlData.history
          : urlData.urls.map(function(u, i) { return { url: u, timestamp: '', label: 'Step ' + (i + 1) }; });

        history.forEach(function(h, index) {
          const stepNum = index + 1;
          const label = h.label || ('Step ' + stepNum);
          const timeStr = h.timestamp ? '<span class="url-history-time"><i class="fas fa-clock"></i> ' + escapeHtml(h.timestamp) + '</span>' : '';
          const titleStr = h.title ? '<div style="font-size: 11.5px; color: var(--text-secondary);"><i class="fas fa-heading"></i> ' + escapeHtml(h.title) + '</div>' : '';

          itemsHtml += '<div class="url-history-item">' +
            '<div class="url-history-header">' +
              '<div class="url-history-label"><span class="url-step-badge">#' + stepNum + '</span> ' + escapeHtml(label) + '</div>' +
              timeStr +
            '</div>' +
            titleStr +
            '<div class="url-history-box">' + escapeHtml(h.url) + '</div>' +
            '<div class="url-history-actions">' +
              '<button type="button" class="btn-table btn-table-icon" onclick="copySingleUrl(\'' + escapeHtml(h.url) + '\', this)" title="Copy URL"><i class="fas fa-copy"></i> Copy</button>' +
              '<a href="' + escapeHtml(h.url) + '" target="_blank" class="btn-table btn-table-url"><i class="fas fa-external-link-alt"></i> Open URL</a>' +
            '</div>' +
          '</div>';
        });
        listEl.innerHTML = itemsHtml;
      }

      urlsModal.setAttribute('data-active-exec', execId);
      urlsModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeUrlsModal() {
      const urlsModal = document.getElementById('urlsModal');
      if (!urlsModal) return;
      urlsModal.classList.add('hidden');
      document.body.style.overflow = '';
    }

    window.copySingleUrl = function(urlText, btn) {
      if (!urlText) return;
      navigator.clipboard.writeText(urlText).then(function() {
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-check" style="color: #10b981;"></i> Copied';
          setTimeout(function() { btn.innerHTML = orig; }, 1800);
        }
      });
    };

    document.addEventListener('DOMContentLoaded', function() {
      const closeBtn = document.getElementById('errorModalCloseBtn');
      const okBtn = document.getElementById('errorModalOkBtn');
      const copyBtn = document.getElementById('errorModalCopyBtn');
      const modal = document.getElementById('errorModal');

      if (closeBtn) closeBtn.addEventListener('click', closeErrorModal);
      if (okBtn) okBtn.addEventListener('click', closeErrorModal);
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) closeErrorModal();
        });
      }

      const urlsCloseBtn = document.getElementById('urlsModalCloseBtn');
      const urlsOkBtn = document.getElementById('urlsModalOkBtn');
      const urlsCopyAllBtn = document.getElementById('urlsModalCopyAllBtn');
      const urlsModal = document.getElementById('urlsModal');

      if (urlsCloseBtn) urlsCloseBtn.addEventListener('click', closeUrlsModal);
      if (urlsOkBtn) urlsOkBtn.addEventListener('click', closeUrlsModal);
      if (urlsModal) {
        urlsModal.addEventListener('click', function(e) {
          if (e.target === urlsModal) closeUrlsModal();
        });
      }

      if (urlsCopyAllBtn) {
        urlsCopyAllBtn.addEventListener('click', function() {
          const activeExecId = urlsModal.getAttribute('data-active-exec');
          const data = executionUrlsStore.get(activeExecId);
          if (data && data.urls && data.urls.length > 0) {
            navigator.clipboard.writeText(data.urls.join('\\n')).then(function() {
              const orig = urlsCopyAllBtn.innerHTML;
              urlsCopyAllBtn.innerHTML = '<i class="fas fa-check"></i> Copied All (' + data.urls.length + ')';
              setTimeout(function() { urlsCopyAllBtn.innerHTML = orig; }, 2000);
            });
          }
        });
      }

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeErrorModal();
          closeUrlsModal();
        }
      });

      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          const trace = document.getElementById('errorModalTrace');
          if (trace && trace.textContent) {
            navigator.clipboard.writeText(trace.textContent).then(function() {
              const orig = copyBtn.innerHTML;
              copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
              setTimeout(function() { copyBtn.innerHTML = orig; }, 2000);
            });
          }
        });
      }

      // Attach Tab Switching, Date Picker, and Scroll Listeners
      const tabBtns = document.querySelectorAll('.date-tab');
      const sessionCards = document.querySelectorAll('.session-card');
      const scrollContainer = document.getElementById('dateTabsContainer');
      const btnLeft = document.getElementById('tabScrollLeft');
      const btnRight = document.getElementById('tabScrollRight');
      const datePicker = document.getElementById('reportDatePicker');
      const clearDateBtn = document.getElementById('clearDateBtn');

      function filterByDateKey(selectedDateKey, autoScrollTab) {
        tabBtns.forEach(b => {
          if (b.getAttribute('data-date-key') === selectedDateKey) {
            b.classList.add('active');
            if (autoScrollTab) {
              b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          } else {
            b.classList.remove('active');
          }
        });

        sessionCards.forEach(card => {
          const cardDate = card.getAttribute('data-session-date');
          if (!selectedDateKey || cardDate === selectedDateKey) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      }

      const latestDateKey = tabBtns.length > 0 ? tabBtns[0].getAttribute('data-date-key') : '';
      if (latestDateKey) {
        filterByDateKey(latestDateKey, false);
      }

      tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const selectedDateKey = this.getAttribute('data-date-key');
          if (datePicker) {
            datePicker.value = selectedDateKey;
            if (clearDateBtn) clearDateBtn.style.display = 'inline-flex';
          }
          filterByDateKey(selectedDateKey, true);
        });
      });

      if (datePicker) {
        datePicker.addEventListener('change', function() {
          const selectedVal = this.value;
          if (selectedVal) {
            if (clearDateBtn) clearDateBtn.style.display = 'inline-flex';
            filterByDateKey(selectedVal, true);
          } else {
            if (clearDateBtn) clearDateBtn.style.display = 'none';
            filterByDateKey(latestDateKey, true);
          }
        });
      }

      if (clearDateBtn) {
        clearDateBtn.addEventListener('click', function() {
          if (datePicker) datePicker.value = '';
          clearDateBtn.style.display = 'none';
          filterByDateKey(latestDateKey, true);
        });
      }

      function updateScrollButtonsVisibility() {
        if (!scrollContainer) return;
        const hasOverflow = scrollContainer.scrollWidth > scrollContainer.clientWidth + 2;
        if (btnLeft) btnLeft.style.display = hasOverflow ? 'flex' : 'none';
        if (btnRight) btnRight.style.display = hasOverflow ? 'flex' : 'none';
      }

      updateScrollButtonsVisibility();
      window.addEventListener('resize', updateScrollButtonsVisibility);

      if (btnLeft && scrollContainer) {
        btnLeft.addEventListener('click', function() {
          scrollContainer.scrollBy({ left: -220, behavior: 'smooth' });
        });
      }
      if (btnRight && scrollContainer) {
        btnRight.addEventListener('click', function() {
          scrollContainer.scrollBy({ left: 220, behavior: 'smooth' });
        });
      }
    });
  </script>
</body>
</html>`;
}

module.exports = {
  updateReportDisk,
  scheduleReportDiskUpdate,
  generateReportHtml,
  REPORT_PATH,
};
