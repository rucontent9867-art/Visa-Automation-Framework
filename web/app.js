/**
 * app.js
 *
 * Frontend script for the Visa Test Automation Dashboard.
 * Includes unified button state management, accessibility feedback, and async task tracking.
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const testList = document.getElementById('testList');
  const testCount = document.getElementById('testCount');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const testSearch = document.getElementById('testSearch');

  const runSelectedBtn = document.getElementById('runSelectedBtn');
  const runAllBtn = document.getElementById('runAllBtn');
  const rerunFailedBtn = document.getElementById('rerunFailedBtn');
  const actionFailedCount = document.getElementById('actionFailedCount');
  const selectFailedBtn = document.getElementById('selectFailedBtn');
  const selectFailedCount = document.getElementById('selectFailedCount');

  const summaryTests = document.getElementById('summaryTests');
  const summaryBrowsers = document.getElementById('summaryBrowsers');
  const summaryDevices = document.getElementById('summaryDevices');
  const summaryEquation = document.getElementById('summaryEquation');

  const progressPanel = document.getElementById('progressPanel');
  const sessionHeader = document.getElementById('sessionHeader');
  const passCount = document.getElementById('passCount');
  const failCount = document.getElementById('failCount');
  const pendingCount = document.getElementById('pendingCount');
  const completedCount = document.getElementById('completedCount');
  const totalCombinationsCount = document.getElementById('totalCombinationsCount');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultsList = document.getElementById('resultsList');
  const stopExecutionBtn = document.getElementById('stopExecutionBtn');
  const rerunFailedSessionBtn = document.getElementById('rerunFailedSessionBtn');
  const sessionFailedCount = document.getElementById('sessionFailedCount');

  const reportPanel = document.getElementById('reportPanel');
  const openHtmlReportBtn = document.getElementById('openHtmlReportBtn');
  const openExcelReportBtn = document.getElementById('openExcelReportBtn');
  const viewBackupsBtn = document.getElementById('viewBackupsBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');

  // Reset Confirmation & Backup Modal elements
  const resetConfirmModal = document.getElementById('resetConfirmModal');
  const closeResetModalBtn = document.getElementById('closeResetModalBtn');
  const cancelResetModalBtn = document.getElementById('cancelResetModalBtn');
  const confirmResetModalBtn = document.getElementById('confirmResetModalBtn');
  const confirmResetBtnIcon = document.getElementById('confirmResetBtnIcon');
  const confirmResetBtnText = document.getElementById('confirmResetBtnText');
  const backupBeforeClearCheckbox = document.getElementById('backupBeforeClearCheckbox');
  const backupOptionsWrap = document.getElementById('backupOptionsWrap');
  const backupFolderNameInput = document.getElementById('backupFolderNameInput');
  const affectedActionLabel = document.getElementById('affectedActionLabel');

  // Backups List Modal elements
  const backupsListModal = document.getElementById('backupsListModal');
  const closeBackupsModalBtn = document.getElementById('closeBackupsModalBtn');
  const closeBackupsModalFooterBtn = document.getElementById('closeBackupsModalFooterBtn');
  const refreshBackupsBtn = document.getElementById('refreshBackupsBtn');
  const backupsListContainer = document.getElementById('backupsListContainer');
  const toastContainer = document.getElementById('toastContainer');

  // Statistics UI Elements
  const statTotal = document.getElementById('statTotal');
  const statSelected = document.getElementById('statSelected');
  const statFiltered = document.getElementById('statFiltered');
  const statFilteredPill = document.getElementById('statFilteredPill');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  // Settings UI Elements
  const settingExcludeStopped = document.getElementById('settingExcludeStopped');
  const settingHideIncomplete = document.getElementById('settingHideIncomplete');
  const settingEnableScreenshot = document.getElementById('settingEnableScreenshot');

  // State
  let allTests = [];
  let selectedTests = new Set();
  let currentSearchTerm = '';
  let currentSessionId = null;
  let currentSessionOptions = null;
  let sseSource = null;

  // Active operation state flags
  let isRunActive = false;
  let isStartingRun = false;
  let isStoppingRun = false;
  let isResettingData = false;

  const executionMap = new Map();

  function getFailedExecutions() {
    if (executionMap.size > 0) {
      return Array.from(executionMap.values()).filter((e) => e.status === 'FAIL');
    }
    return [];
  }

  // ── Centralized Button State Management ──
  function updateButtonStates() {
    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const filteredTests = getFilteredTests();
    const selectedCount = selectedTests.size;
    const totalCount = allTests.length;
    const hasConfig = browsers.length > 0 && devices.length > 0;

    const failedExecs = getFailedExecutions();
    const failedCountNum = failedExecs.length;
    const failedTestFiles = Array.from(new Set(failedExecs.map((e) => e.testScript)));

    // 1. Run Selected Button
    if (runSelectedBtn) {
      if (isStartingRun) {
        runSelectedBtn.disabled = true;
        runSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
      } else {
        runSelectedBtn.innerHTML = '<i class="fas fa-play"></i> Run Selected';
        runSelectedBtn.disabled = isRunActive || selectedCount === 0 || !hasConfig;
      }
    }

    // 2. Run All Button
    if (runAllBtn) {
      if (isStartingRun) {
        runAllBtn.disabled = true;
        runAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
      } else {
        runAllBtn.innerHTML = '<i class="fas fa-forward"></i> Run All';
        runAllBtn.disabled = isRunActive || totalCount === 0 || !hasConfig;
      }
    }

    // 3. Rerun Failed Button (Action Bar)
    if (rerunFailedBtn) {
      if (actionFailedCount) actionFailedCount.textContent = failedCountNum.toString();
      if (isStartingRun) {
        rerunFailedBtn.disabled = true;
        rerunFailedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rerunning...';
      } else {
        rerunFailedBtn.innerHTML = `<i class="fas fa-rotate-right"></i> Rerun Failed (<span id="actionFailedCount">${failedCountNum}</span>)`;
        rerunFailedBtn.disabled = isRunActive || failedCountNum === 0;
      }
    }

    // 4. Rerun Failed Button (Session Header)
    if (rerunFailedSessionBtn) {
      if (sessionFailedCount) sessionFailedCount.textContent = failedCountNum.toString();
      if (failedCountNum > 0 && !isRunActive) {
        rerunFailedSessionBtn.style.display = 'inline-flex';
        rerunFailedSessionBtn.disabled = isStartingRun;
        if (isStartingRun) {
          rerunFailedSessionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rerunning...';
        } else {
          rerunFailedSessionBtn.innerHTML = `<i class="fas fa-rotate-right"></i> Rerun Failed (<span id="sessionFailedCount">${failedCountNum}</span>)`;
        }
      } else {
        rerunFailedSessionBtn.style.display = 'none';
      }
    }

    // 5. Select Failed Button (Test Toolbar)
    if (selectFailedBtn) {
      if (selectFailedCount) selectFailedCount.textContent = failedTestFiles.length.toString();
      if (failedTestFiles.length > 0 && !isRunActive) {
        selectFailedBtn.style.display = 'inline-flex';
        selectFailedBtn.disabled = isStartingRun;
      } else {
        selectFailedBtn.style.display = 'none';
      }
    }

    // 6. Selection Toolbar Buttons
    if (selectAllBtn) {
      selectAllBtn.disabled = isRunActive || isStartingRun || filteredTests.length === 0;
    }
    if (deselectAllBtn) {
      deselectAllBtn.disabled = isRunActive || isStartingRun || selectedCount === 0;
    }

    // 7. Stop Execution Button
    if (stopExecutionBtn) {
      if (isStoppingRun) {
        stopExecutionBtn.disabled = true;
        stopExecutionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
      } else if (isRunActive) {
        stopExecutionBtn.disabled = false;
        stopExecutionBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Execution';
      } else {
        stopExecutionBtn.disabled = true;
        stopExecutionBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Execution';
      }
    }

    // 8. Reset / Clear Reports Button
    if (resetDataBtn) {
      if (isResettingData) {
        resetDataBtn.disabled = true;
        resetDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
      } else {
        resetDataBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Reports / Reset Test Data';
        resetDataBtn.disabled = isRunActive || isStartingRun;
      }
    }
  }

  // ── Helpers ──
  function formatTestTitle(filename) {
    let name = filename.replace(/\.(spec|test)\.(ts|js)$/i, '');
    name = name.replace(/[-_]/g, ' ');
    return name.split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
      .join(' ');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlightText(text, keyword) {
    const escaped = escapeHtml(text);
    if (!keyword || !keyword.trim()) return escaped;

    const searchTerm = keyword.trim();
    const escapedKeyword = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  // ── Fetch tests from API ──
  async function loadTests() {
    try {
      const res = await fetch('/api/tests');
      const data = await res.json();
      allTests = data.tests || [];
      renderTestGrid();
      updateSummary();
    } catch (err) {
      console.error('Failed to load tests:', err);
      if (testList) {
        testList.innerHTML = `<div class="error-state"><p>Error loading tests: ${err.message}</p></div>`;
      }
    } finally {
      updateButtonStates();
    }
  }

  function getFilteredTests() {
    if (!currentSearchTerm.trim()) return allTests;
    const term = currentSearchTerm.toLowerCase().trim();
    return allTests.filter(test => {
      const title = formatTestTitle(test).toLowerCase();
      const filename = test.toLowerCase();
      return title.includes(term) || filename.includes(term);
    });
  }

  function renderTestGrid() {
    if (!testList) return;

    const filteredTests = getFilteredTests();

    // Update statistics
    if (statTotal) statTotal.textContent = allTests.length.toString();
    if (statSelected) statSelected.textContent = selectedTests.size.toString();

    if (currentSearchTerm.trim()) {
      if (statFiltered) statFiltered.textContent = filteredTests.length.toString();
      if (statFilteredPill) statFilteredPill.classList.remove('hidden');
      if (clearSearchBtn) clearSearchBtn.classList.remove('hidden');
    } else {
      if (statFilteredPill) statFilteredPill.classList.add('hidden');
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
    }

    if (allTests.length === 0) {
      testList.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No spec files found in configured test directory</p></div>';
      updateButtonStates();
      return;
    }

    if (filteredTests.length === 0) {
      testList.innerHTML = `
        <div class="no-results-state">
          <div class="no-results-icon"><i class="fas fa-search-minus"></i></div>
          <h4>No tests found</h4>
          <p>No matching test scripts found for "<strong>${escapeHtml(currentSearchTerm)}</strong>".</p>
          <button class="btn btn-sm btn-secondary" id="resetSearchBtn"><i class="fas fa-undo"></i> Clear Filter</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetSearchBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (testSearch) testSearch.value = '';
          currentSearchTerm = '';
          renderTestGrid();
        });
      }
      updateButtonStates();
      return;
    }

    testList.innerHTML = filteredTests.map(test => {
      const isSelected = selectedTests.has(test);
      const titleFormatted = formatTestTitle(test);
      const titleHighlighted = highlightText(titleFormatted, currentSearchTerm);
      const filenameHighlighted = highlightText(test, currentSearchTerm);

      return `
        <div class="test-card ${isSelected ? 'selected' : ''}" 
             data-file="${escapeHtml(test)}" 
             role="checkbox" 
             aria-checked="${isSelected}" 
             tabindex="0"
             title="${escapeHtml(titleFormatted)} (${escapeHtml(test)})">
          <div class="test-card-checkbox">
            <i class="fas ${isSelected ? 'fa-check' : ''}"></i>
          </div>
          <div class="test-card-content">
            <div class="test-card-title">${titleHighlighted}</div>
            <div class="test-card-filename"><i class="far fa-file-code"></i> ${filenameHighlighted}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click & keyboard listeners to test cards
    testList.querySelectorAll('.test-card').forEach(card => {
      const testFile = card.getAttribute('data-file');

      const toggleCard = () => {
        if (selectedTests.has(testFile)) {
          selectedTests.delete(testFile);
        } else {
          selectedTests.add(testFile);
        }
        renderTestGrid();
        updateSummary();
      };

      card.addEventListener('click', toggleCard);

      card.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleCard();
        }
      });
    });

    updateButtonStates();
  }

  // ── Search filter listener ──
  if (testSearch) {
    testSearch.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      renderTestGrid();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (testSearch) testSearch.value = '';
      currentSearchTerm = '';
      renderTestGrid();
    });
  }

  // ── Selection Buttons ──
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      if (isRunActive || isStartingRun) return;
      const visibleTests = getFilteredTests();
      visibleTests.forEach(t => selectedTests.add(t));
      renderTestGrid();
      updateSummary();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      if (isRunActive || isStartingRun) return;
      selectedTests.clear();
      renderTestGrid();
      updateSummary();
    });
  }

  // Listen to configuration checkboxes
  document.querySelectorAll('.browser-checkbox, .device-checkbox').forEach(cb => {
    cb.addEventListener('change', updateSummary);
  });

  function getSelectedBrowsers() {
    return Array.from(document.querySelectorAll('.browser-checkbox:checked')).map(cb => cb.value);
  }

  function getSelectedDevices() {
    return Array.from(document.querySelectorAll('.device-checkbox:checked')).map(cb => cb.value);
  }

  function updateSummary() {
    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const testCountNum = selectedTests.size;

    if (summaryTests) summaryTests.textContent = `${testCountNum} Test${testCountNum === 1 ? '' : 's'}`;
    if (summaryBrowsers) summaryBrowsers.textContent = `${browsers.length} (${browsers.join(', ') || 'None'})`;
    if (summaryDevices) summaryDevices.textContent = `${devices.length} (${devices.join(', ') || 'None'})`;

    const totalExecs = testCountNum * browsers.length * devices.length;
    if (summaryEquation) {
      summaryEquation.textContent = `${testCountNum} Tests × ${browsers.length} Engine${browsers.length === 1 ? '' : 's'} × ${devices.length} Platform${devices.length === 1 ? '' : 's'} = ${totalExecs} Executions`;
    }

    updateButtonStates();
  }

  // ── Helper to read current Timeout Settings ──
  function getTimeoutSettings() {
    // 1. Test Timeout
    const testPreset = document.getElementById('testTimeoutPreset')?.value;
    let testTimeout = 60000;
    if (testPreset === 'custom') {
      const customSec = parseFloat(document.getElementById('testTimeoutCustom')?.value || '60');
      testTimeout = Math.max(5000, isNaN(customSec) ? 60000 : Math.round(customSec * 1000));
    } else if (testPreset) {
      testTimeout = parseInt(testPreset, 10) || 60000;
    }

    // 2. Action Timeout
    const actionPreset = document.getElementById('actionTimeoutPreset')?.value;
    let actionTimeout = 15000;
    if (actionPreset === 'custom') {
      const customSec = parseFloat(document.getElementById('actionTimeoutCustom')?.value || '15');
      actionTimeout = Math.max(1000, isNaN(customSec) ? 15000 : Math.round(customSec * 1000));
    } else if (actionPreset) {
      actionTimeout = parseInt(actionPreset, 10) || 15000;
    }

    // 3. Navigation Timeout
    const navPreset = document.getElementById('navigationTimeoutPreset')?.value;
    let navigationTimeout = 30000;
    if (navPreset === 'custom') {
      const customSec = parseFloat(document.getElementById('navigationTimeoutCustom')?.value || '30');
      navigationTimeout = Math.max(1000, isNaN(customSec) ? 30000 : Math.round(customSec * 1000));
    } else if (navPreset) {
      navigationTimeout = parseInt(navPreset, 10) || 30000;
    }

    // 4. Assertion Timeout
    const assertPreset = document.getElementById('assertionTimeoutPreset')?.value;
    let assertionTimeout = 15000;
    if (assertPreset === 'custom') {
      const customSec = parseFloat(document.getElementById('assertionTimeoutCustom')?.value || '15');
      assertionTimeout = Math.max(500, isNaN(customSec) ? 15000 : Math.round(customSec * 1000));
    } else if (assertPreset) {
      assertionTimeout = parseInt(assertPreset, 10) || 15000;
    }

    return {
      testTimeout,
      actionTimeout,
      navigationTimeout,
      assertionTimeout,
    };
  }

  function setupTimeoutControls() {
    const configs = [
      {
        selectId: 'testTimeoutPreset',
        wrapId: 'testTimeoutCustomWrap',
        inputId: 'testTimeoutCustom',
        badgeId: 'testTimeoutBadge',
        formatBadge: (val, isCustom) => {
          if (isCustom) return `${val}s (Custom)`;
          const ms = parseInt(val, 10);
          const min = Math.round(ms / 60000);
          return min >= 1 && ms % 60000 === 0 ? `${min} min` : `${Math.round(ms / 1000)}s`;
        }
      },
      {
        selectId: 'actionTimeoutPreset',
        wrapId: 'actionTimeoutCustomWrap',
        inputId: 'actionTimeoutCustom',
        badgeId: 'actionTimeoutBadge',
        formatBadge: (val, isCustom) => {
          if (isCustom) return `${val}s (Custom)`;
          return `${Math.round(parseInt(val, 10) / 1000)}s`;
        }
      },
      {
        selectId: 'navigationTimeoutPreset',
        wrapId: 'navigationTimeoutCustomWrap',
        inputId: 'navigationTimeoutCustom',
        badgeId: 'navigationTimeoutBadge',
        formatBadge: (val, isCustom) => {
          if (isCustom) return `${val}s (Custom)`;
          return `${Math.round(parseInt(val, 10) / 1000)}s`;
        }
      },
      {
        selectId: 'assertionTimeoutPreset',
        wrapId: 'assertionTimeoutCustomWrap',
        inputId: 'assertionTimeoutCustom',
        badgeId: 'assertionTimeoutBadge',
        formatBadge: (val, isCustom) => {
          if (isCustom) return `${val}s (Custom)`;
          return `${Math.round(parseInt(val, 10) / 1000)}s`;
        }
      },
    ];

    configs.forEach(cfg => {
      const select = document.getElementById(cfg.selectId);
      const wrap = document.getElementById(cfg.wrapId);
      const input = document.getElementById(cfg.inputId);
      const badge = document.getElementById(cfg.badgeId);
      if (!select || !wrap || !input || !badge) return;

      const updateState = () => {
        if (select.value === 'custom') {
          wrap.classList.remove('hidden');
          const val = input.value || '0';
          badge.textContent = cfg.formatBadge(val, true);
        } else {
          wrap.classList.add('hidden');
          badge.textContent = cfg.formatBadge(select.value, false);
        }
      };

      select.addEventListener('change', () => {
        updateState();
        if (select.value === 'custom') {
          input.focus();
          input.select();
        }
      });

      input.addEventListener('input', () => {
        if (select.value === 'custom') {
          badge.textContent = cfg.formatBadge(input.value || '0', true);
        }
      });

      updateState();
    });
  }

  // ── Start Execution ──
  async function startRun(testFiles) {
    if (isRunActive || isStartingRun || !testFiles || testFiles.length === 0) return;

    isStartingRun = true;
    updateButtonStates();

    const browsers = getSelectedBrowsers();
    const devices = getSelectedDevices();
    const retries = parseInt(document.getElementById('retryCount')?.value || '2', 10);
    const rawBatchSize = parseInt(document.getElementById('batchSize')?.value || '5', 10);
    const batchSize = isNaN(rawBatchSize) ? 5 : Math.min(10, Math.max(1, rawBatchSize));
    const headless = document.getElementById('headlessMode')?.checked ?? true;
    const timeouts = getTimeoutSettings();

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testFiles, browsers, devices, retries, headless, batchSize, timeouts }),
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to start run: ' + (data.error || 'Unknown error'));
        isStartingRun = false;
        updateButtonStates();
        return;
      }

      currentSessionId = data.sessionId;
      currentSessionOptions = {
        headless,
        batchSize,
        retries,
        timeouts,
      };
      isRunActive = true;
      showProgressPanel(data.sessionId, data.runNumber, data.totalExecutions, batchSize);
      connectSse(data.sessionId);
    } catch (err) {
      console.error('Error starting run:', err);
      alert('Network error starting run: ' + err.message);
    } finally {
      isStartingRun = false;
      updateButtonStates();
    }
  }

  if (runSelectedBtn) {
    runSelectedBtn.addEventListener('click', () => {
      startRun(Array.from(selectedTests));
    });
  }

  if (runAllBtn) {
    runAllBtn.addEventListener('click', () => {
      startRun(allTests);
    });
  }

  // ── Helper to read current UI Settings ──
  function getCurrentUiSettings() {
    const rawBatchSize = parseInt(document.getElementById('batchSize')?.value || '5', 10);
    const batchSize = isNaN(rawBatchSize) ? 5 : Math.min(10, Math.max(1, rawBatchSize));
    const retries = parseInt(document.getElementById('retryCount')?.value || '2', 10);
    const headless = document.getElementById('headlessMode')?.checked ?? true;
    const timeouts = getTimeoutSettings();
    return {
      headless: !!headless,
      batchSize: isNaN(batchSize) ? 5 : batchSize,
      retries: isNaN(retries) ? 2 : retries,
      timeouts,
    };
  }

  // ── Rerun Failed Confirmation Modal Elements ──
  const rerunSettingsModal = document.getElementById('rerunSettingsModal');
  const closeRerunModalBtn = document.getElementById('closeRerunModalBtn');
  const cancelRerunModalBtn = document.getElementById('cancelRerunModalBtn');
  const useOriginalSettingsBtn = document.getElementById('useOriginalSettingsBtn');
  const useCurrentSettingsBtn = document.getElementById('useCurrentSettingsBtn');
  const rerunModalFailCount = document.getElementById('rerunModalFailCount');

  const origValHeadless = document.getElementById('origValHeadless');
  const origValBatch = document.getElementById('origValBatch');
  const origValRetries = document.getElementById('origValRetries');

  const updatedValHeadless = document.getElementById('updatedValHeadless');
  const updatedValBatch = document.getElementById('updatedValBatch');
  const updatedValRetries = document.getElementById('updatedValRetries');

  let pendingRerunData = null;

  function openRerunSettingsModal(origSettings, currentSettings, failedExecs) {
    if (!rerunSettingsModal) return;
    pendingRerunData = { origSettings, currentSettings, failedExecs };

    if (rerunModalFailCount) {
      const count = failedExecs.length;
      rerunModalFailCount.textContent = `${count} failed test combination${count === 1 ? '' : 's'}`;
    }

    // Populate original settings values
    if (origValHeadless) {
      origValHeadless.innerHTML = origSettings.headless
        ? '<i class="fas fa-check-circle" style="color: #16a34a;"></i> Enabled (Headless)'
        : '<i class="fas fa-desktop" style="color: #2563eb;"></i> Disabled (Headed)';
    }
    if (origValBatch) {
      origValBatch.innerHTML = `<strong>${origSettings.batchSize}</strong> Worker${origSettings.batchSize === 1 ? '' : 's'}`;
    }
    if (origValRetries) {
      origValRetries.innerHTML = `<strong>${origSettings.retries}</strong> Retr${origSettings.retries === 1 ? 'y' : 'ies'}`;
    }

    // Populate current/updated settings values with visual diff indicators
    if (updatedValHeadless) {
      const isChanged = currentSettings.headless !== origSettings.headless;
      updatedValHeadless.innerHTML = (currentSettings.headless
        ? '<i class="fas fa-check-circle" style="color: #16a34a;"></i> Enabled (Headless)'
        : '<i class="fas fa-desktop" style="color: #2563eb;"></i> Disabled (Headed)') +
        (isChanged ? ' <span class="rerun-diff-pill pill-modified">Changed</span>' : '');
    }
    if (updatedValBatch) {
      const isChanged = currentSettings.batchSize !== origSettings.batchSize;
      updatedValBatch.innerHTML = `<strong>${currentSettings.batchSize}</strong> Worker${currentSettings.batchSize === 1 ? '' : 's'}` +
        (isChanged ? ' <span class="rerun-diff-pill pill-modified">Changed</span>' : '');
    }
    if (updatedValRetries) {
      const isChanged = currentSettings.retries !== origSettings.retries;
      updatedValRetries.innerHTML = `<strong>${currentSettings.retries}</strong> Retr${currentSettings.retries === 1 ? 'y' : 'ies'}` +
        (isChanged ? ' <span class="rerun-diff-pill pill-modified">Changed</span>' : '');
    }

    rerunSettingsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeRerunSettingsModal() {
    if (!rerunSettingsModal) return;
    rerunSettingsModal.classList.add('hidden');
    document.body.style.overflow = '';
    pendingRerunData = null;
  }

  if (closeRerunModalBtn) {
    closeRerunModalBtn.addEventListener('click', closeRerunSettingsModal);
  }
  if (cancelRerunModalBtn) {
    cancelRerunModalBtn.addEventListener('click', closeRerunSettingsModal);
  }
  if (rerunSettingsModal) {
    rerunSettingsModal.addEventListener('click', (e) => {
      if (e.target === rerunSettingsModal) closeRerunSettingsModal();
    });
  }

  if (useOriginalSettingsBtn) {
    useOriginalSettingsBtn.addEventListener('click', async () => {
      if (!pendingRerunData) return;
      const { origSettings, failedExecs } = pendingRerunData;
      closeRerunSettingsModal();
      await executeRerunFailed(origSettings, failedExecs);
    });
  }

  if (useCurrentSettingsBtn) {
    useCurrentSettingsBtn.addEventListener('click', async () => {
      if (!pendingRerunData) return;
      const { currentSettings, failedExecs } = pendingRerunData;
      closeRerunSettingsModal();
      await executeRerunFailed(currentSettings, failedExecs);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rerunSettingsModal && !rerunSettingsModal.classList.contains('hidden')) {
      closeRerunSettingsModal();
    }
  });

  // ── Dispatch execution for failed tests ──
  async function executeRerunFailed(chosenSettings, failedExecs) {
    if (isRunActive || isStartingRun || !failedExecs || failedExecs.length === 0) return;

    isStartingRun = true;
    updateButtonStates();

    const targets = failedExecs.map((e) => ({
      testScript: e.testScript,
      browser: e.browser,
      device: e.device,
    }));

    try {
      const res = await fetch('/api/run-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          retries: chosenSettings.retries,
          headless: chosenSettings.headless,
          batchSize: chosenSettings.batchSize,
          timeouts: chosenSettings.timeouts || getTimeoutSettings(),
          targets,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to rerun failed tests: ' + (data.error || 'Unknown error'));
        isStartingRun = false;
        updateButtonStates();
        return;
      }

      currentSessionId = data.sessionId;
      currentSessionOptions = {
        headless: chosenSettings.headless,
        batchSize: chosenSettings.batchSize,
        retries: chosenSettings.retries,
        timeouts: chosenSettings.timeouts || getTimeoutSettings(),
      };
      isRunActive = true;
      showProgressPanel(data.sessionId, data.runNumber, data.totalExecutions, chosenSettings.batchSize);
      connectSse(data.sessionId);
    } catch (err) {
      console.error('Error rerunning failed tests:', err);
      alert('Network error rerunning failed tests: ' + err.message);
    } finally {
      isStartingRun = false;
      updateButtonStates();
    }
  }

  // ── Rerun Failed Tests Trigger ──
  async function startRerunFailed() {
    if (isRunActive || isStartingRun) return;
    const failedExecs = getFailedExecutions();
    if (failedExecs.length === 0) {
      alert('No failed test cases found to rerun.');
      return;
    }

    const currentSettings = getCurrentUiSettings();

    // Determine original settings for current session
    let origSettings = currentSessionOptions;
    if (!origSettings) {
      if (currentSessionId) {
        try {
          const res = await fetch(`/api/sessions/${currentSessionId}`);
          const data = await res.json();
          if (data && data.session && data.session.options) {
            origSettings = {
              headless: data.session.options.headless !== undefined ? !!data.session.options.headless : true,
              batchSize: data.session.options.batchSize ? parseInt(data.session.options.batchSize, 10) : 5,
              retries: data.session.options.retries !== undefined ? parseInt(data.session.options.retries, 10) : 2,
            };
            currentSessionOptions = origSettings;
          }
        } catch (e) {
          console.warn('Could not fetch original session options:', e);
        }
      }
    }

    if (!origSettings) {
      origSettings = { ...currentSettings };
    }

    // Check if any setting changed between original run and live UI
    const hasChanges = (
      currentSettings.headless !== origSettings.headless ||
      currentSettings.batchSize !== origSettings.batchSize ||
      currentSettings.retries !== origSettings.retries
    );

    if (hasChanges) {
      // Show responsive comparison popup
      openRerunSettingsModal(origSettings, currentSettings, failedExecs);
    } else {
      // Run immediately with current settings (no popup required)
      await executeRerunFailed(currentSettings, failedExecs);
    }
  }

  if (rerunFailedBtn) {
    rerunFailedBtn.addEventListener('click', startRerunFailed);
  }

  if (rerunFailedSessionBtn) {
    rerunFailedSessionBtn.addEventListener('click', startRerunFailed);
  }

  if (selectFailedBtn) {
    selectFailedBtn.addEventListener('click', () => {
      const failedExecs = getFailedExecutions();
      const failedTestFiles = Array.from(new Set(failedExecs.map((e) => e.testScript)));
      if (failedTestFiles.length > 0) {
        selectedTests = new Set(failedTestFiles);
        renderTestList();
        updateSummary();
        updateButtonStates();
      }
    });
  }

  window.retrySingleExec = async function(execId) {
    if (isRunActive || isStartingRun) return;
    const btn = document.getElementById(`retry-btn-${execId}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rerunning...';
    }

    isStartingRun = true;
    updateButtonStates();

    try {
      const res = await fetch(`/api/executions/${execId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert('Failed to retry test: ' + (data.error || 'Unknown error'));
        isStartingRun = false;
        updateButtonStates();
        return;
      }

      currentSessionId = data.sessionId;
      isRunActive = true;
      showProgressPanel(data.sessionId, data.runNumber, data.totalExecutions, 1);
      connectSse(data.sessionId);
    } catch (err) {
      console.error('Error retrying execution:', err);
      alert('Network error retrying execution: ' + err.message);
    } finally {
      isStartingRun = false;
      updateButtonStates();
    }
  };

  if (stopExecutionBtn) {
    stopExecutionBtn.addEventListener('click', async () => {
      if (!currentSessionId || !isRunActive || isStoppingRun) return;
      isStoppingRun = true;
      updateButtonStates();
      try {
        await fetch(`/api/sessions/${currentSessionId}/stop`, { method: 'POST' });
      } catch (err) {
        console.error('Error stopping session:', err);
      } finally {
        isStoppingRun = false;
        updateButtonStates();
      }
    });
  }

  function showProgressPanel(sessionId, runNumber, totalExecs, batchSize = 5) {
    if (progressPanel) progressPanel.style.display = 'block';
    if (sessionHeader) sessionHeader.textContent = `Execution Session #${runNumber}`;
    const sessionSubtext = document.getElementById('sessionSubtext');
    if (sessionSubtext) {
      sessionSubtext.textContent = `Target: ${totalExecs} Executions | Batch Size: ${batchSize} Simultaneous`;
    }
    if (totalCombinationsCount) totalCombinationsCount.textContent = totalExecs.toString();
    if (resultsList) resultsList.innerHTML = '';
    updateProgressUI(0, 0, totalExecs, 0, totalExecs);
  }

  function updateProgressUI(passed, failed, pending, completed, total) {
    if (passCount) passCount.textContent = passed.toString();
    if (failCount) failCount.textContent = failed.toString();
    if (pendingCount) pendingCount.textContent = pending.toString();
    if (completedCount) completedCount.textContent = completed.toString();

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `${pct}%`;
  }

  // ── SSE Connection ──
  function connectSse(sessionId) {
    if (sseSource) sseSource.close();

    sseSource = new EventSource(`/api/sessions/${sessionId}/events`);

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSseEvent(data);
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    sseSource.onerror = (err) => {
      console.warn('SSE connection error:', err);
    };
  }

  function handleSseEvent(data) {
    if (data.type === 'snapshot') {
      renderExecutions(data.executions);
    } else if (data.type === 'executionUpdate') {
      upsertExecutionItem(data.execution);
    } else if (data.type === 'sessionDone') {
      if (sseSource) sseSource.close();
      isRunActive = false;
      updateButtonStates();
      checkReportAvailable();
    }
  }

  function renderExecutions(executions) {
    executionMap.clear();
    if (resultsList) resultsList.innerHTML = '';
    let passed = 0, failed = 0, pending = 0, completed = 0;
    let hasActive = false;

    for (const exec of executions) {
      executionMap.set(exec.id, exec);
      if (exec.status === 'PASS' || exec.status === 'RETRY_PASS') passed++;
      else if (exec.status === 'FAIL') failed++;
      else if (exec.status === 'PENDING') pending++;

      if (['RUNNING', 'PENDING'].includes(exec.status)) {
        hasActive = true;
      }

      if (['PASS', 'FAIL', 'CANCELLED', 'STOPPED', 'RETRY_PASS'].includes(exec.status)) {
        completed++;
      }

      appendOrUpdateExecRow(exec);
    }

    isRunActive = hasActive;
    updateButtonStates();
    updateProgressUI(passed, failed, pending, completed, executions.length);
  }

  function upsertExecutionItem(exec) {
    executionMap.set(exec.id, exec);
    appendOrUpdateExecRow(exec);

    let passed = 0, failed = 0, pending = 0, completed = 0;
    let hasActive = false;

    for (const e of executionMap.values()) {
      if (e.status === 'PASS' || e.status === 'RETRY_PASS') passed++;
      else if (e.status === 'FAIL') failed++;
      else if (e.status === 'PENDING') pending++;

      if (['RUNNING', 'PENDING'].includes(e.status)) {
        hasActive = true;
      }

      if (['PASS', 'FAIL', 'CANCELLED', 'STOPPED', 'RETRY_PASS'].includes(e.status)) {
        completed++;
      }
    }

    isRunActive = hasActive;
    updateButtonStates();
    updateProgressUI(passed, failed, pending, completed, executionMap.size);
  }

  function getStatusBadgeHtml(status) {
    switch (status) {
      case 'PASS':
        return `<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> PASS</span>`;
      case 'RETRY_PASS':
        return `<span class="status-badge status-PASS"><i class="fas fa-check-circle"></i> RETRY PASS</span>`;
      case 'FAIL':
        return `<span class="status-badge status-FAIL"><i class="fas fa-times-circle"></i> FAIL</span>`;
      case 'RUNNING':
        return `<span class="status-badge status-RUNNING"><i class="fas fa-spinner fa-spin"></i> RUNNING</span>`;
      case 'PENDING':
        return `<span class="status-badge status-PENDING"><i class="fas fa-clock"></i> PENDING</span>`;
      case 'CANCELLED':
        return `<span class="status-badge status-CANCELLED"><i class="fas fa-ban"></i> CANCELLED</span>`;
      case 'STOPPED':
        return `<span class="status-badge status-STOPPED"><i class="fas fa-stop-circle"></i> STOPPED</span>`;
      default:
        return `<span class="status-badge status-PENDING">${escapeHtml(status || 'UNKNOWN')}</span>`;
    }
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

  // ─── Modal Management ───
  const errorModal = document.getElementById('errorModal');
  const errorModalTitle = document.getElementById('errorModalTitle');
  const errorModalMeta = document.getElementById('errorModalMeta');
  const errorModalTrace = document.getElementById('errorModalTrace');
  const errorModalCloseBtn = document.getElementById('errorModalCloseBtn');
  const errorModalOkBtn = document.getElementById('errorModalOkBtn');
  const errorModalCopyBtn = document.getElementById('errorModalCopyBtn');

  const executionErrorStore = new Map();

  window.openErrorModal = function(execId) {
    const errorData = executionErrorStore.get(execId);
    if (!errorData || !errorModal) return;

    if (errorModalMeta) {
      errorModalMeta.innerHTML = `
        <strong>${escapeHtml(errorData.title)}</strong> &bull; 
        <span>${escapeHtml(errorData.device)} / ${escapeHtml(errorData.browser)}</span>
      `;
    }
    if (errorModalTrace) {
      errorModalTrace.textContent = errorData.error;
    }

    errorModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function closeErrorModal() {
    if (!errorModal) return;
    errorModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (errorModalCloseBtn) errorModalCloseBtn.addEventListener('click', closeErrorModal);
  if (errorModalOkBtn) errorModalOkBtn.addEventListener('click', closeErrorModal);

  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) closeErrorModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (errorModal && !errorModal.classList.contains('hidden')) {
        closeErrorModal();
      }
      if (urlsModal && !urlsModal.classList.contains('hidden')) {
        closeUrlsModal();
      }
      if (resetConfirmModal && !resetConfirmModal.classList.contains('hidden') && !isResettingData) {
        closeResetModal();
      }
      if (backupsListModal && !backupsListModal.classList.contains('hidden')) {
        closeBackupsModal();
      }
    }
  });

  if (errorModalCopyBtn) {
    errorModalCopyBtn.addEventListener('click', () => {
      if (errorModalTrace && errorModalTrace.textContent) {
        errorModalCopyBtn.disabled = true;
        navigator.clipboard.writeText(errorModalTrace.textContent).then(() => {
          const origText = errorModalCopyBtn.innerHTML;
          errorModalCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => {
            errorModalCopyBtn.innerHTML = origText;
            errorModalCopyBtn.disabled = false;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy error:', err);
          errorModalCopyBtn.disabled = false;
        });
      }
    });
  }

  // ─── Captured URLs Modal Management ───
  const urlsModal = document.getElementById('urlsModal');
  const urlsModalMeta = document.getElementById('urlsModalMeta');
  const urlsModalCount = document.getElementById('urlsModalCount');
  const urlsModalList = document.getElementById('urlsModalList');
  const urlsModalCloseBtn = document.getElementById('urlsModalCloseBtn');
  const urlsModalOkBtn = document.getElementById('urlsModalOkBtn');
  const urlsModalCopyAllBtn = document.getElementById('urlsModalCopyAllBtn');

  const executionUrlsStore = new Map();

  window.openUrlsModal = function(execId) {
    const urlData = executionUrlsStore.get(execId);
    if (!urlData || !urlsModal) return;

    if (urlsModalCount) urlsModalCount.textContent = urlData.urls.length;
    if (urlsModalMeta) {
      urlsModalMeta.innerHTML = `
        <strong>${escapeHtml(urlData.title)}</strong> &bull; 
        <span>${escapeHtml(urlData.device)} / ${escapeHtml(urlData.browser)}</span>
      `;
    }

    if (urlsModalList) {
      let itemsHtml = '';
      const history = (urlData.history && urlData.history.length > 0)
        ? urlData.history
        : urlData.urls.map((u, i) => ({ url: u, timestamp: '', label: `Step ${i + 1}` }));

      history.forEach((h, index) => {
        const stepNum = index + 1;
        const label = h.label || `Step ${stepNum}`;
        const timeStr = h.timestamp ? `<span class="url-history-time"><i class="fas fa-clock"></i> ${escapeHtml(h.timestamp)}</span>` : '';
        const titleStr = h.title ? `<div style="font-size: 11.5px; color: var(--text-secondary);"><i class="fas fa-heading"></i> ${escapeHtml(h.title)}</div>` : '';

        itemsHtml += `
          <div class="url-history-item">
            <div class="url-history-header">
              <div class="url-history-label"><span class="url-step-badge">#${stepNum}</span> ${escapeHtml(label)}</div>
              ${timeStr}
            </div>
            ${titleStr}
            <div class="url-history-box">${escapeHtml(h.url)}</div>
            <div class="url-history-actions">
              <button type="button" class="btn-table btn-table-icon" onclick="copySingleUrl('${escapeHtml(h.url)}', this)" title="Copy URL">
                <i class="fas fa-copy"></i> Copy
              </button>
              <a href="${escapeHtml(h.url)}" target="_blank" class="btn-table btn-table-url">
                <i class="fas fa-external-link-alt"></i> Open URL
              </a>
            </div>
          </div>
        `;
      });
      urlsModalList.innerHTML = itemsHtml;
    }

    urlsModal.setAttribute('data-active-exec', execId);
    urlsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function closeUrlsModal() {
    if (!urlsModal) return;
    urlsModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  window.copySingleUrl = function(urlText, btn) {
    if (!urlText) return;
    navigator.clipboard.writeText(urlText).then(() => {
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check" style="color: #10b981;"></i> Copied';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
      }
    });
  };

  if (urlsModalCloseBtn) urlsModalCloseBtn.addEventListener('click', closeUrlsModal);
  if (urlsModalOkBtn) urlsModalOkBtn.addEventListener('click', closeUrlsModal);
  if (urlsModal) {
    urlsModal.addEventListener('click', (e) => {
      if (e.target === urlsModal) closeUrlsModal();
    });
  }
  if (urlsModalCopyAllBtn) {
    urlsModalCopyAllBtn.addEventListener('click', () => {
      const activeExecId = urlsModal.getAttribute('data-active-exec');
      const data = executionUrlsStore.get(activeExecId);
      if (data && data.urls && data.urls.length > 0) {
        navigator.clipboard.writeText(data.urls.join('\n')).then(() => {
          showToast(`Copied ${data.urls.length} URLs to clipboard`, 'success');
        });
      }
    });
  }

  function appendOrUpdateExecRow(exec) {
    if (!resultsList) return;
    const formattedTitle = formatTestTitle(exec.testScript);
    let row = document.getElementById(`exec-row-${exec.id}`);
    if (!row) {
      row = document.createElement('tr');
      row.id = `exec-row-${exec.id}`;
      row.className = 'exec-tr-row';
      resultsList.appendChild(row);
    }

    let actionBtnHtml = '<span class="empty-cell">—</span>';
    if (exec.status === 'PENDING') {
      actionBtnHtml = `<button id="cancel-btn-${exec.id}" class="btn-table btn-table-cancel" onclick="cancelExec('${exec.id}')"><i class="fas fa-ban"></i> Cancel</button>`;
    } else if (exec.status === 'FAIL') {
      actionBtnHtml = `<button id="retry-btn-${exec.id}" class="btn-table btn-table-retry" onclick="retrySingleExec('${exec.id}')" title="Rerun this failed test case" ${isRunActive ? 'disabled' : ''}><i class="fas fa-rotate-right"></i> Rerun</button>`;
    }

    const attempts = exec.retries != null ? (exec.retries + 1) : 1;
    const attemptBadge = `<span class="exec-attempts">Attempt #${attempts}</span>`;

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
      executionUrlsStore.set(exec.id, {
        title: formattedTitle || exec.testScript,
        device: exec.device,
        browser: exec.browser,
        urls: capturedList,
        history: Array.isArray(exec.urlHistory) ? exec.urlHistory : []
      });
    }

    let payUrlHtml = '<span class="empty-cell">—</span>';
    if (capturedList.length === 1) {
      const singleUrl = capturedList[0];
      payUrlHtml = `
        <div class="url-cell-wrapper">
          <a href="${escapeHtml(singleUrl)}" target="_blank" class="btn-table btn-table-url" title="${escapeHtml(singleUrl)}">
            <i class="fas fa-external-link-alt"></i> Open URL
          </a>
          <button type="button" class="btn-table-icon" onclick="copySingleUrl('${escapeHtml(singleUrl)}', this)" title="Copy URL">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      `;
    } else if (capturedList.length > 1) {
      const latestUrl = capturedList[capturedList.length - 1];
      payUrlHtml = `
        <div class="url-cell-wrapper">
          <button type="button" class="btn-table btn-table-url-multiple" onclick="openUrlsModal('${exec.id}')" title="View all ${capturedList.length} captured URLs">
            <i class="fas fa-layer-group"></i> ${capturedList.length} URLs
          </button>
          <a href="${escapeHtml(latestUrl)}" target="_blank" class="btn-table btn-table-url-latest" title="Open latest: ${escapeHtml(latestUrl)}">
            <i class="fas fa-external-link-alt"></i> Latest
          </a>
        </div>
      `;
    }

    const screenshotHtml = (exec.screenshotPath && exec.screenshotPath !== 'N/A')
      ? `<a href="${escapeHtml(exec.screenshotPath)}" target="_blank" class="btn-table btn-table-screenshot"><i class="fas fa-image"></i> View Screenshot</a>`
      : '<span class="empty-cell">—</span>';

    const statusBadge = getStatusBadgeHtml(exec.status);
    const durationText = exec.duration != null ? `${exec.duration}s` : '—';

    let errorHtml = '<span class="empty-cell">—</span>';
    if (exec.error && exec.error.trim()) {
      executionErrorStore.set(exec.id, {
        title: formattedTitle || exec.testScript,
        device: exec.device,
        browser: exec.browser,
        error: exec.error
      });

      const shortErr = exec.error.length > 35 ? exec.error.substring(0, 35) + '…' : exec.error;
      errorHtml = `
        <div class="error-cell-wrapper">
          <span class="error-preview" title="${escapeHtml(exec.error)}">${escapeHtml(shortErr)}</span>
          <button type="button" class="btn-table btn-table-details" onclick="openErrorModal('${exec.id}')">
            <i class="fas fa-external-link-alt"></i> View Details
          </button>
        </div>
      `;
    }

    row.innerHTML = `
      <td>
        <div class="test-script-cell">
          <strong class="test-title">${escapeHtml(formattedTitle)}</strong>
          <span class="test-file">${escapeHtml(exec.testScript)}</span>
        </div>
      </td>
      <td>
        <div class="env-cell">
          <span class="platform-chip"><i class="${exec.device === 'Android' ? 'fab' : exec.device === 'iOS' ? 'fab' : 'fas'} ${getDeviceIcon(exec.device)}"></i> ${escapeHtml(exec.device)}</span>
          <span class="engine-chip"><i class="fab ${getBrowserIcon(exec.browser)}"></i> ${escapeHtml(exec.browser)}</span>
        </div>
      </td>
      <td>${statusBadge}</td>
      <td>${attemptBadge}</td>
      <td>${payUrlHtml}</td>
      <td>${screenshotHtml}</td>
      <td><span class="duration-badge">${escapeHtml(durationText)}</span></td>
      <td>${errorHtml}</td>
      <td>${actionBtnHtml}</td>
    `;
  }

  window.cancelExec = async function(execId) {
    const btn = document.getElementById(`cancel-btn-${execId}`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
    }
    try {
      await fetch(`/api/executions/${execId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Error cancelling execution:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-ban"></i> Cancel';
      }
    }
  };

  async function loadLatestSession() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const sessions = data.sessions || [];
      if (sessions.length === 0) {
        isRunActive = false;
        updateButtonStates();
        return;
      }

      const latest = sessions[sessions.length - 1];
      if (!latest || !latest.executions) {
        isRunActive = false;
        updateButtonStates();
        return;
      }

      currentSessionId = latest.id;
      currentSessionOptions = latest.options ? {
        headless: latest.options.headless !== undefined ? !!latest.options.headless : true,
        batchSize: latest.options.batchSize ? parseInt(latest.options.batchSize, 10) : 5,
        retries: latest.options.retries !== undefined ? parseInt(latest.options.retries, 10) : 2,
      } : null;
      showProgressPanel(
        latest.id,
        latest.runNumber,
        latest.executions.length,
        latest.options?.batchSize || 5
      );
      renderExecutions(latest.executions);

      if (latest.status === 'RUNNING' || latest.status === 'PENDING') {
        connectSse(latest.id);
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
      isRunActive = false;
      updateButtonStates();
    }
  }

  async function checkReportAvailable() {
    try {
      const res = await fetch('/api/report');
      const data = await res.json();
      if (reportPanel) {
        reportPanel.style.display = 'block';
      }
      const iframe = document.getElementById('reportFrame');
      if (iframe && data.path) {
        iframe.src = data.path + '?t=' + Date.now();
      }

      // Check session history to properly manage action button states
      try {
        const sessRes = await fetch('/api/sessions');
        const sessData = await sessRes.json();
        const hasData = Array.isArray(sessData.sessions) && sessData.sessions.length > 0;
        if (openHtmlReportBtn) openHtmlReportBtn.disabled = !hasData;
        if (openFolderBtn) openFolderBtn.disabled = !hasData;
        if (openExcelReportBtn) openExcelReportBtn.disabled = !hasData;
        if (resetDataBtn) resetDataBtn.disabled = !hasData || isRunActive || isStartingRun || isResettingData;
      } catch (e) {
        if (openHtmlReportBtn) openHtmlReportBtn.disabled = !data.exists;
        if (openFolderBtn) openFolderBtn.disabled = !data.exists;
      }
    } catch (err) {
      console.error('Error checking report:', err);
    }
  }

  if (openHtmlReportBtn) {
    openHtmlReportBtn.addEventListener('click', () => {
      window.open('/reports/execution-report.html', '_blank');
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', () => {
      window.open('/reports/execution-report.html', '_blank');
    });
  }

  // ── Toast Notifications ──
  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function getDefaultBackupName() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `backup-${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  }

  // ── Reset & Backup Modal Management ──
  function openResetModal() {
    if (isRunActive || isResettingData) return;
    if (backupBeforeClearCheckbox) {
      backupBeforeClearCheckbox.checked = true;
    }
    if (backupOptionsWrap) {
      backupOptionsWrap.style.display = 'flex';
    }
    if (backupFolderNameInput) {
      backupFolderNameInput.value = getDefaultBackupName();
    }
    if (affectedActionLabel) {
      affectedActionLabel.textContent = 'backed up & deleted';
    }
    if (confirmResetBtnText) {
      confirmResetBtnText.textContent = 'Create Backup & Clear Everything';
    }
    if (confirmResetBtnIcon) {
      confirmResetBtnIcon.className = 'fas fa-shield-alt';
    }
    if (confirmResetModalBtn) {
      confirmResetModalBtn.disabled = false;
      confirmResetModalBtn.innerHTML = '<i class="fas fa-shield-alt" id="confirmResetBtnIcon"></i> <span id="confirmResetBtnText">Create Backup & Clear Everything</span>';
    }
    if (resetConfirmModal) {
      resetConfirmModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeResetModal() {
    if (resetConfirmModal) {
      resetConfirmModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  if (backupBeforeClearCheckbox) {
    backupBeforeClearCheckbox.addEventListener('change', () => {
      const willBackup = backupBeforeClearCheckbox.checked;
      if (backupOptionsWrap) {
        backupOptionsWrap.style.display = willBackup ? 'flex' : 'none';
      }
      if (affectedActionLabel) {
        affectedActionLabel.textContent = willBackup ? 'backed up & deleted' : 'permanently deleted (no backup)';
      }
      const btnSpan = document.getElementById('confirmResetBtnText');
      const btnIcon = document.getElementById('confirmResetBtnIcon');
      if (btnSpan) {
        btnSpan.textContent = willBackup ? 'Create Backup & Clear Everything' : 'Clear Everything Without Backup';
      }
      if (btnIcon) {
        btnIcon.className = willBackup ? 'fas fa-shield-alt' : 'fas fa-trash-alt';
      }
    });
  }

  if (closeResetModalBtn) closeResetModalBtn.addEventListener('click', closeResetModal);
  if (cancelResetModalBtn) cancelResetModalBtn.addEventListener('click', closeResetModal);
  if (resetConfirmModal) {
    resetConfirmModal.addEventListener('click', (e) => {
      if (e.target === resetConfirmModal && !isResettingData) closeResetModal();
    });
  }

  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (isRunActive || isResettingData) return;
      openResetModal();
    });
  }

  if (confirmResetModalBtn) {
    confirmResetModalBtn.addEventListener('click', async () => {
      if (isRunActive || isResettingData) return;
      isResettingData = true;
      confirmResetModalBtn.disabled = true;
      if (cancelResetModalBtn) cancelResetModalBtn.disabled = true;
      if (closeResetModalBtn) closeResetModalBtn.disabled = true;

      const shouldBackup = backupBeforeClearCheckbox ? backupBeforeClearCheckbox.checked : true;
      const backupName = backupFolderNameInput ? backupFolderNameInput.value.trim() : '';

      confirmResetModalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (shouldBackup ? 'Backing up & clearing...' : 'Clearing data...');
      updateButtonStates();

      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup: shouldBackup, backupName })
        });
        const data = await res.json();

        if (data.success) {
          closeResetModal();
          executionMap.clear();
          executionErrorStore.clear();
          if (progressPanel) progressPanel.style.display = 'none';
          if (resultsList) resultsList.innerHTML = '';
          currentSessionId = null;
          isRunActive = false;
          updateButtonStates();
          checkReportAvailable();

          if (data.backupCreated && data.backup) {
            showToast(`Cleared successfully! Backup saved to ${data.backup.folderName} (${data.backup.screenshotsCount} screenshots, Excel & HTML reports)`, 'success');
          } else {
            showToast('All reports, Excel files, execution history, and screenshots have been cleared.', 'info');
          }
        } else {
          showToast('Failed to clear data: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        console.error('Error during reset/backup:', err);
        showToast('Error resetting data: ' + err.message, 'error');
      } finally {
        isResettingData = false;
        confirmResetModalBtn.disabled = false;
        if (cancelResetModalBtn) cancelResetModalBtn.disabled = false;
        if (closeResetModalBtn) closeResetModalBtn.disabled = false;
        updateButtonStates();
      }
    });
  }

  // ── Open Excel Report Handler ──
  if (openExcelReportBtn) {
    openExcelReportBtn.addEventListener('click', async () => {
      try {
        openExcelReportBtn.disabled = true;
        const origHtml = openExcelReportBtn.innerHTML;
        openExcelReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Excel...';
        const res = await fetch('/api/report/excel');
        const data = await res.json();
        if (data.success && data.path) {
          window.open(data.path + '?t=' + Date.now(), '_blank');
        } else {
          showToast('Excel report generated: /reports/test-reports.xlsx', 'info');
        }
      } catch (err) {
        showToast('Error generating Excel report: ' + err.message, 'error');
      } finally {
        openExcelReportBtn.disabled = false;
        openExcelReportBtn.innerHTML = '<i class="fas fa-file-excel" style="color: #107c41;"></i> Open Excel Report (.xlsx)';
      }
    });
  }

  // ── Backups List Modal Management ──
  async function loadBackupsList() {
    if (!backupsListContainer) return;
    backupsListContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 8px;">Loading backups...</p></div>';

    try {
      const res = await fetch('/api/backups');
      const data = await res.json();
      const backups = data.backups || [];

      if (backups.length === 0) {
        backupsListContainer.innerHTML = `
          <div style="text-align: center; padding: 36px 16px; background: var(--bg-tertiary); border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted);">
            <i class="fas fa-box-open fa-2x" style="margin-bottom: 8px; opacity: 0.5;"></i>
            <p style="margin: 0; font-size: 13.5px; font-weight: 600;">No Backups Found</p>
            <p style="margin: 4px 0 0 0; font-size: 12px;">When you click "Clear Reports / Reset Test Data", you can choose to create a full backup archive.</p>
          </div>
        `;
        return;
      }

      backupsListContainer.innerHTML = backups.map(b => {
        const dateFormatted = b.createdAt ? new Date(b.createdAt).toLocaleString() : b.folderName;
        const screenshots = b.screenshotsCount || 0;
        const size = b.totalSizeFormatted || 'N/A';
        const sessions = b.sessionsCount != null ? b.sessionsCount : '—';
        const execs = b.executionsCount != null ? b.executionsCount : '—';

        return `
          <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-archive" style="color: var(--accent);"></i>
                <strong style="font-family: monospace; font-size: 13px; color: var(--text-primary);">${escapeHtml(b.folderName)}</strong>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);">
                Created: ${escapeHtml(dateFormatted)} &bull; ${size} &bull; ${sessions} sessions (${execs} runs) &bull; ${screenshots} screenshots
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="/${escapeHtml(b.relativePath)}/reports/execution-report.html" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none;">
                <i class="fas fa-external-link-alt"></i> View Report
              </a>
              <a href="/${escapeHtml(b.relativePath)}/README.txt" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none;" title="View backup manifest">
                <i class="fas fa-file-lines"></i> Manifest
              </a>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load backups:', err);
      backupsListContainer.innerHTML = `<div style="color: var(--danger); padding: 16px; font-size: 13px;">Error loading backups: ${escapeHtml(err.message)}</div>`;
    }
  }

  function openBackupsModal() {
    if (!backupsListModal) return;
    backupsListModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    loadBackupsList();
  }

  function closeBackupsModal() {
    if (!backupsListModal) return;
    backupsListModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (viewBackupsBtn) viewBackupsBtn.addEventListener('click', openBackupsModal);
  if (closeBackupsModalBtn) closeBackupsModalBtn.addEventListener('click', closeBackupsModal);
  if (closeBackupsModalFooterBtn) closeBackupsModalFooterBtn.addEventListener('click', closeBackupsModal);
  if (refreshBackupsBtn) refreshBackupsBtn.addEventListener('click', loadBackupsList);
  if (backupsListModal) {
    backupsListModal.addEventListener('click', (e) => {
      if (e.target === backupsListModal) closeBackupsModal();
    });
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        if (settingExcludeStopped) settingExcludeStopped.checked = !!data.settings.excludeStoppedSessions;
        if (settingHideIncomplete) settingHideIncomplete.checked = !!data.settings.hideIncompleteTests;
        if (settingEnableScreenshot) settingEnableScreenshot.checked = !!data.settings.enableScreenshotCapture;
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function updateSettings() {
    try {
      const scrollPos = window.scrollY;
      const payload = {
        excludeStoppedSessions: settingExcludeStopped ? settingExcludeStopped.checked : false,
        hideIncompleteTests: settingHideIncomplete ? settingHideIncomplete.checked : false,
        enableScreenshotCapture: settingEnableScreenshot ? settingEnableScreenshot.checked : false,
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const iframe = document.getElementById('reportFrame');
        if (iframe) {
          iframe.src = '/reports/execution-report.html?t=' + Date.now();
        }
        window.scrollTo({ top: scrollPos, behavior: 'instant' });
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  }

  if (settingExcludeStopped) {
    settingExcludeStopped.addEventListener('change', updateSettings);
  }
  if (settingHideIncomplete) {
    settingHideIncomplete.addEventListener('change', updateSettings);
  }
  if (settingEnableScreenshot) {
    settingEnableScreenshot.addEventListener('change', updateSettings);
  }

  // ── Help Guide Modal ──
  const helpGuideBtn = document.getElementById('helpGuideBtn');
  const helpGuideModal = document.getElementById('helpGuideModal');
  const helpGuideModalCloseBtn = document.getElementById('helpGuideModalCloseBtn');
  const helpGuideOkBtn = document.getElementById('helpGuideOkBtn');

  function openHelpGuideModal() {
    if (helpGuideModal) helpGuideModal.classList.remove('hidden');
  }

  function closeHelpGuideModal() {
    if (helpGuideModal) helpGuideModal.classList.add('hidden');
  }

  if (helpGuideBtn) {
    helpGuideBtn.addEventListener('click', openHelpGuideModal);
  }
  if (helpGuideModalCloseBtn) {
    helpGuideModalCloseBtn.addEventListener('click', closeHelpGuideModal);
  }
  if (helpGuideOkBtn) {
    helpGuideOkBtn.addEventListener('click', closeHelpGuideModal);
  }

  if (helpGuideModal) {
    helpGuideModal.addEventListener('click', (e) => {
      if (e.target === helpGuideModal) closeHelpGuideModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpGuideModal && !helpGuideModal.classList.contains('hidden')) {
      closeHelpGuideModal();
    }
  });

  // Initial load
  loadSettings();
  loadTests();
  loadLatestSession();
  checkReportAvailable();
  checkSystemStatus(true);
  updateButtonStates();

  // ── System Memory & Device Specs Status Check ──
  const memoryGuardBadge = document.getElementById('memoryGuardBadge');
  const memoryGuardHint = document.getElementById('memoryGuardHint');
  const batchSizeInput = document.getElementById('batchSize');
  let userHasManuallyChangedBatch = false;

  async function checkSystemStatus(isInitial = false) {
    try {
      const rawVal = batchSizeInput ? parseInt(batchSizeInput.value, 10) : 5;
      const requested = isNaN(rawVal) || rawVal < 1 ? 5 : rawVal;
      const res = await fetch(`/api/system-status?batch=${requested}`);
      if (!res.ok) return;
      const data = await res.json();

      // Auto-adjust default batch concurrency if on initial load and user hasn't typed a custom value
      if (isInitial && batchSizeInput && !userHasManuallyChangedBatch && data.recommendedBatch) {
        if (parseInt(batchSizeInput.value, 10) !== data.recommendedBatch) {
          batchSizeInput.value = data.recommendedBatch;
        }
      }

      const totalGB = data.totalMemMB ? (data.totalMemMB / 1024).toFixed(1) : '4.0';

      if (memoryGuardBadge) {
        if (data.isThrottled) {
          memoryGuardBadge.textContent = `Throttled: Max ${data.effectiveConcurrency} Safe (${data.freeMemMB}MB Free)`;
          memoryGuardBadge.style.backgroundColor = '#f59e0b';
          memoryGuardBadge.style.color = '#ffffff';
        } else {
          memoryGuardBadge.textContent = `Auto-Detected: ${data.recommendedBatch} Safe (${data.cpuCores || 2} vCPU, ${totalGB}GB RAM)`;
          memoryGuardBadge.style.backgroundColor = '';
          memoryGuardBadge.style.color = '';
        }
      }

      if (memoryGuardHint) {
        if (data.isThrottled) {
          memoryGuardHint.textContent = `RAM Safety Guard active: Requested ${data.requestedBatch}, auto-throttling to max ${data.effectiveConcurrency} worker(s) to prevent system freeze.`;
        } else {
          memoryGuardHint.textContent = `Auto-calculated ${data.recommendedBatch} parallel workers for your hardware (${data.cpuCores || 2} vCPUs, ${totalGB}GB RAM, ${data.freeMemMB}MB free).`;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch system status:', err);
    }
  }

  if (batchSizeInput) {
    batchSizeInput.addEventListener('input', () => {
      userHasManuallyChangedBatch = true;
      checkSystemStatus(false);
    });
  }

  // ── Lightweight System Health & Connection Status Indicator ──
  const serverStatusBadge = document.getElementById('serverStatus');
  const serverStatusText = document.getElementById('serverStatusText');
  const healthStatusModal = document.getElementById('healthStatusModal');
  const closeHealthModalBtn = document.getElementById('closeHealthModalBtn');
  const closeHealthModalFooterBtn = document.getElementById('closeHealthModalFooterBtn');
  const recheckHealthBtn = document.getElementById('recheckHealthBtn');
  const recheckIcon = document.getElementById('recheckIcon');
  const healthBannerDot = document.getElementById('healthBannerDot');
  const healthBannerText = document.getElementById('healthBannerText');
  const healthCheckList = document.getElementById('healthCheckList');
  const healthGuidanceBox = document.getElementById('healthGuidanceBox');
  const healthGuidanceText = document.getElementById('healthGuidanceText');

  async function runLightweightHealthCheck() {
    if (recheckIcon) recheckIcon.classList.add('fa-spin');

    try {
      const res = await fetch('/api/health-check');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderHealthStatus(data);
    } catch (err) {
      console.warn('Health check failed:', err);
      renderHealthStatus({
        apiReachable: false,
        playwrightAvailable: false,
        chromiumInstalled: false,
        firefoxInstalled: false,
        webkitInstalled: false,
        totalMemMB: 0,
        freeMemMB: 0,
        cpuCores: 0,
        isLowMemory: false,
        specCount: 0,
        error: err.message,
      });
    } finally {
      if (recheckIcon) recheckIcon.classList.remove('fa-spin');
    }
  }

  function renderHealthStatus(data) {
    // Determine overall state: 'ready' | 'warning' | 'error' | 'disconnected'
    let state = 'ready';
    let overallText = 'System Ready — All mandatory checks passed';
    let badgeText = 'System Ready';

    if (!data.apiReachable) {
      state = 'disconnected';
      overallText = 'Disconnected — Backend Server Unreachable';
      badgeText = 'Disconnected';
    } else if (!data.playwrightAvailable || (!data.chromiumInstalled && !data.firefoxInstalled && !data.webkitInstalled)) {
      state = 'error';
      overallText = 'Critical Error — System cannot execute test suite';
      badgeText = 'Critical Error';
    } else if (!data.chromiumInstalled || !data.firefoxInstalled || !data.webkitInstalled || data.isLowMemory) {
      state = 'warning';
      overallText = 'Action Needed — System functional with warnings';
      badgeText = 'Action Needed';
    }

    // 0. Update App Title Heading if provided by server
    if (data.appTitle) {
      const appHeading = document.getElementById('appTitleHeading');
      if (appHeading) appHeading.textContent = data.appTitle;
      document.title = `${data.appTitle} Dashboard`;
    }

    // 1. Update Header Badge
    if (serverStatusBadge) {
      serverStatusBadge.className = `status-badge clickable-status-badge status-${state}`;
    }
    if (serverStatusText) {
      serverStatusText.textContent = badgeText;
    }

    // 2. Update Modal Banner
    if (healthBannerDot) {
      healthBannerDot.className = `health-banner-dot status-${state}`;
    }
    if (healthBannerText) {
      healthBannerText.textContent = overallText;
    }

    // 3. Render Checklist Grid
    if (healthCheckList) {
      const items = [
        {
          title: 'Backend API',
          subtitle: data.apiReachable ? 'Express server active on port 3000' : 'Server endpoint unreachable',
          status: data.apiReachable ? 'ready' : 'disconnected',
          badge: data.apiReachable ? 'Connected' : 'Offline',
          icon: 'fa-server'
        },
        {
          title: 'SSE Stream Connection',
          subtitle: 'Real-time execution updates channel',
          status: 'ready',
          badge: 'Active',
          icon: 'fa-network-wired'
        },
        {
          title: 'Playwright Framework',
          subtitle: data.playwrightAvailable ? 'Core @playwright/test library loaded' : 'Package @playwright/test missing',
          status: data.playwrightAvailable ? 'ready' : 'error',
          badge: data.playwrightAvailable ? 'Available' : 'Missing',
          icon: 'fa-vial'
        },
        {
          title: 'Chromium Engine',
          subtitle: data.chromiumInstalled ? 'Chromium browser binary ready' : 'Chromium binary not downloaded',
          status: data.chromiumInstalled ? 'ready' : 'warning',
          badge: data.chromiumInstalled ? 'Installed' : 'Missing',
          icon: 'fa-chrome'
        },
        {
          title: 'Firefox Engine',
          subtitle: data.firefoxInstalled ? 'Firefox browser binary ready' : 'Firefox binary not downloaded',
          status: data.firefoxInstalled ? 'ready' : 'warning',
          badge: data.firefoxInstalled ? 'Installed' : 'Missing',
          icon: 'fa-firefox-browser'
        },
        {
          title: 'WebKit Engine',
          subtitle: data.webkitInstalled ? 'WebKit Safari engine ready' : 'WebKit binary not downloaded',
          status: data.webkitInstalled ? 'ready' : 'warning',
          badge: data.webkitInstalled ? 'Installed' : 'Missing',
          icon: 'fa-safari'
        },
        {
          title: 'System Memory & CPU',
          subtitle: `${data.freeMemMB}MB free / ${data.totalMemMB}MB total (${data.cpuCores} vCPUs)`,
          status: data.isLowMemory ? 'warning' : 'ready',
          badge: data.isLowMemory ? 'Low RAM' : 'Adequate',
          icon: 'fa-microchip'
        }
      ];

      healthCheckList.innerHTML = items.map(item => {
        let iconHtml = '';
        let badgeClass = '';
        if (item.status === 'ready') {
          iconHtml = '<i class="fas fa-check-circle text-success health-card-icon" style="color: #16a34a;"></i>';
          badgeClass = 'badge-ready';
        } else if (item.status === 'warning') {
          iconHtml = '<i class="fas fa-exclamation-triangle text-warning health-card-icon" style="color: #d97706;"></i>';
          badgeClass = 'badge-warning';
        } else if (item.status === 'error') {
          iconHtml = '<i class="fas fa-times-circle text-danger health-card-icon" style="color: #dc2626;"></i>';
          badgeClass = 'badge-error';
        } else {
          iconHtml = '<i class="fas fa-minus-circle text-muted health-card-icon" style="color: #94a3b8;"></i>';
          badgeClass = 'badge-muted';
        }

        return `
          <div class="health-card">
            <div class="health-card-left">
              ${iconHtml}
              <div class="health-card-info">
                <span class="health-card-title">${escapeHtml(item.title)}</span>
                <span class="health-card-subtitle">${escapeHtml(item.subtitle)}</span>
              </div>
            </div>
            <span class="health-card-badge ${badgeClass}">${escapeHtml(item.badge)}</span>
          </div>
        `;
      }).join('');
    }

    // 4. Render Action Guidance Box if any issues exist
    const tips = [];
    if (!data.apiReachable) {
      tips.push('Ensure the Express backend server is running on port 3000.');
    }
    if (!data.playwrightAvailable) {
      tips.push('Run <code>npm install</code> in terminal to install @playwright/test.');
    }

    const missingBrowsers = [];
    if (!data.chromiumInstalled) missingBrowsers.push('chromium');
    if (!data.firefoxInstalled) missingBrowsers.push('firefox');
    if (!data.webkitInstalled) missingBrowsers.push('webkit');

    if (missingBrowsers.length > 0) {
      tips.push(`To run tests on all engines, install missing browsers: <code>npx playwright install ${missingBrowsers.join(' ')}</code>`);
    }

    if (data.isLowMemory) {
      tips.push(`Free RAM is low (${data.freeMemMB}MB). Lower the Batch Concurrency setting to avoid memory throttling.`);
    }

    if (healthGuidanceBox && healthGuidanceText) {
      if (tips.length > 0) {
        healthGuidanceText.innerHTML = tips.map(t => `<p>&bull; ${t}</p>`).join('');
        healthGuidanceBox.classList.remove('hidden');
      } else {
        healthGuidanceBox.classList.add('hidden');
      }
    }
  }

  // Modal Open / Close Handlers
  function openHealthModal() {
    if (healthStatusModal) healthStatusModal.classList.remove('hidden');
  }

  function closeHealthModal() {
    if (healthStatusModal) healthStatusModal.classList.add('hidden');
  }

  if (serverStatusBadge) {
    serverStatusBadge.addEventListener('click', openHealthModal);
  }
  if (closeHealthModalBtn) {
    closeHealthModalBtn.addEventListener('click', closeHealthModal);
  }
  if (closeHealthModalFooterBtn) {
    closeHealthModalFooterBtn.addEventListener('click', closeHealthModal);
  }
  if (recheckHealthBtn) {
    recheckHealthBtn.addEventListener('click', runLightweightHealthCheck);
  }

  if (healthStatusModal) {
    healthStatusModal.addEventListener('click', (e) => {
      if (e.target === healthStatusModal) closeHealthModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && healthStatusModal && !healthStatusModal.classList.contains('hidden')) {
      closeHealthModal();
    }
  });

  // Run health check and setup controls ONCE on initial dashboard load
  setupTimeoutControls();
  runLightweightHealthCheck();

  // ─── DYNAMIC GLOBAL FLOATING TOOLTIP SYSTEM ───
  // Creates a single portal element directly on <body> to bypass all card/grid overflow and stacking contexts.
  let globalTooltipEl = document.getElementById('global-floating-tooltip');
  if (!globalTooltipEl) {
    globalTooltipEl = document.createElement('div');
    globalTooltipEl.id = 'global-floating-tooltip';
    globalTooltipEl.className = 'global-floating-tooltip';
    globalTooltipEl.innerHTML = `
      <div id="globalTooltipContent"></div>
      <div class="tooltip-arrow" id="globalTooltipArrow"></div>
    `;
    document.body.appendChild(globalTooltipEl);
  }

  let activeTooltipContainer = null;

  function positionFloatingTooltip(container) {
    if (!globalTooltipEl || !container) return;
    const sourcePopup = container.querySelector('.tooltip-popup');
    if (!sourcePopup) return;

    const contentEl = document.getElementById('globalTooltipContent');
    const arrowEl = document.getElementById('globalTooltipArrow');
    if (!contentEl || !arrowEl) return;

    // Populate content
    contentEl.innerHTML = sourcePopup.innerHTML;

    // Check special width mode (e.g. screenshot guide)
    if (sourcePopup.classList.contains('screenshot-tooltip')) {
      globalTooltipEl.classList.add('screenshot-tooltip-mode');
    } else {
      globalTooltipEl.classList.remove('screenshot-tooltip-mode');
    }

    // Get trigger target icon bounds
    const triggerIcon = container.querySelector('.tooltip-icon') || container;
    const rect = triggerIcon.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;

    // Make visible temporarily offscreen to measure real rendered dimensions
    globalTooltipEl.style.left = '-9999px';
    globalTooltipEl.style.top = '-9999px';
    globalTooltipEl.classList.add('visible');

    const tooltipWidth = globalTooltipEl.offsetWidth;
    const tooltipHeight = globalTooltipEl.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const gap = 8; // Margin between icon and tooltip
    const screenMargin = 12; // Minimum gap from viewport edges

    // 1. VERTICAL POSITIONING (TOP vs BOTTOM)
    // Default to TOP position
    let placement = 'top';
    let top = rect.top - tooltipHeight - gap;

    // Check if placing above would bleed past top edge of screen
    if (top < screenMargin) {
      // Flip to place below icon
      placement = 'bottom';
      top = rect.bottom + gap;

      // If placing below also bleeds past bottom of screen, clamp top
      if (top + tooltipHeight > viewportHeight - screenMargin) {
        top = viewportHeight - tooltipHeight - screenMargin;
      }
    }

    // Double check top clamping if screen height is very small
    if (top < screenMargin) {
      top = screenMargin;
    }

    // 2. HORIZONTAL POSITIONING (CENTERED over icon, clamped inside screen margins)
    let left = triggerCenterX - tooltipWidth / 2;

    if (left < screenMargin) {
      left = screenMargin;
    } else if (left + tooltipWidth > viewportWidth - screenMargin) {
      left = viewportWidth - tooltipWidth - screenMargin;
    }

    // 3. ARROW POSITIONING (Points directly to icon center)
    let arrowX = triggerCenterX - left;
    // Clamp arrow position inside rounded box bounds (14px from left/right edges)
    arrowX = Math.max(14, Math.min(arrowX, tooltipWidth - 14));

    // Apply computed fixed positions
    globalTooltipEl.style.left = `${Math.round(left)}px`;
    globalTooltipEl.style.top = `${Math.round(top)}px`;

    globalTooltipEl.classList.remove('placement-top', 'placement-bottom');
    globalTooltipEl.classList.add(`placement-${placement}`);

    arrowEl.style.left = `${Math.round(arrowX - 6)}px`;
  }

  function hideFloatingTooltip() {
    if (!globalTooltipEl) return;
    globalTooltipEl.classList.remove('visible');
    activeTooltipContainer = null;
  }

  // Delegated Event Listeners for Tooltips
  document.addEventListener('mouseover', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container) {
      activeTooltipContainer = container;
      positionFloatingTooltip(container);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container && activeTooltipContainer === container) {
      hideFloatingTooltip();
    }
  });

  document.addEventListener('focusin', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container) {
      activeTooltipContainer = container;
      positionFloatingTooltip(container);
    }
  });

  document.addEventListener('focusout', (e) => {
    const container = e.target.closest('.info-tooltip-container');
    if (container && activeTooltipContainer === container) {
      hideFloatingTooltip();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeTooltipContainer) {
      positionFloatingTooltip(activeTooltipContainer);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeTooltipContainer) {
      positionFloatingTooltip(activeTooltipContainer);
    }
  }, { passive: true });
});
