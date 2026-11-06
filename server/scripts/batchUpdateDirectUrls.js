/**
 * server/scripts/batchUpdateDirectUrls.js
 *
 * Automated batch migration script to update all test scripts in tests/spec/
 * with simultaneous dual-page Direct URL Verification (/visa-status/ and /complete-partially/),
 * matching the Azerbaijan and Bahrain standard pattern.
 *
 * Features:
 *   - Creates a full timestamped backup in backups/ before touching any file.
 *   - Idempotent: Skips scripts that already implement verifyDirectUrls.
 *   - Injects baseTest verifyDirectUrls import.
 *   - Inserts stage checkpoints at Document Upload, Preview, and Payment stages.
 *   - Ensures dm443790@gmail.com email standard.
 */

const fs = require('fs');
const path = require('path');

const SPECS_DIR = path.join(process.cwd(), 'tests', 'spec');
const BACKUPS_DIR = path.join(process.cwd(), 'backups');

function createBackup(files) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupFolder = path.join(BACKUPS_DIR, `specs-backup-pre-direct-urls-${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  for (const file of files) {
    const src = path.join(SPECS_DIR, file);
    const dest = path.join(backupFolder, file);
    fs.copyFileSync(src, dest);
  }
  return backupFolder;
}

function updateSpecCode(code, filename) {
  let updated = code;

  // 1. Ensure verifyDirectUrls is imported from baseTest
  if (!updated.includes('verifyDirectUrls')) {
    if (updated.includes("from '../../utils/baseTest'") || updated.includes('from "../../utils/baseTest"')) {
      updated = updated.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"](\.\.\/\.\.\/utils\/baseTest)['"]/,
        (match, imports, pathStr) => {
          const trimmed = imports.trim();
          if (trimmed.includes('verifyDirectUrls')) return match;
          return `import { ${trimmed}, verifyDirectUrls } from '${pathStr}'`;
        }
      );
    }
  }

  // 2. Normalize test email to dm443790@gmail.com
  updated = updated.replace(/['"]([a-zA-Z0-9._%+-]+@(?:test\.com|example\.com|domain\.com|mail\.com))['"]/g, "'dm443790@gmail.com'");

  // 3. Skip if already has verifyDirectUrls calls
  if (updated.includes('await verifyDirectUrls(')) {
    return { modified: false, reason: 'Already contains verifyDirectUrls', code: updated };
  }

  let modifiedCount = 0;

  // 4. Inject Document Upload Stage Checkpoint
  const fileInputRegex = /(await\s+(?:expect\(\s*(?:fileInput\.first\(\)|sectionLocator)[\s\S]*?\)\.toHaveValue\([^)]+\);|uploadAndWaitForSuccess\([^)]+\);|(?:fileInput|page\.locator\(['"]input\[type=["']file["']\]['"]\))\.first\(\)\.setInputFiles\([^)]+\);))/;
  if (fileInputRegex.test(updated) && !updated.includes("stageName: 'document-upload'")) {
    const uploadCheckBlock = `$1

    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 1: DOCUMENT UPLOAD
    // Verify /visa-status/ and /complete-partially/ in separate tabs before submit
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'document-upload',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });
`;
    updated = updated.replace(fileInputRegex, uploadCheckBlock);
    modifiedCount++;
  }

  // 5. Inject Preview / Save & Continue Stage Checkpoint
  const previewRegex = /((\s*)await\s+page\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"](?:Submit & Preview|Preview|Save and Continue|Save & Continue)['"][^}]*\}\)\.click\(\);)/;
  if (previewRegex.test(updated) && !updated.includes("stageName: 'preview'")) {
    const previewCheckBlock = `
    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 2: PREVIEW / RESUME STAGE
    // Verify /visa-status/ and /complete-partially/ in separate tabs before submit
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });
$1`;
    updated = updated.replace(previewRegex, previewCheckBlock);
    modifiedCount++;
  }

  // 6. Inject Payment Stage Checkpoint
  const paymentRegex = /(await\s+expect\(\s*page\.getByRole\(['"]heading['"],\s*\{\s*name:\s*['"](?:Pay Visa Processing Fee|Pay Application Processing Fee|Payment|Pay Fee|Application Detail)['"][^}]*\}\)\s*\)\.toBeVisible\([^)]*\);)/;
  if (paymentRegex.test(updated) && !updated.includes("stageName: 'payment'")) {
    const paymentCheckBlock = `$1

    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 3: PAYMENT / DETAIL STAGE
    // Verify /visa-status/ and /complete-partially/ in separate tabs before checkout
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });`;
    updated = updated.replace(paymentRegex, paymentCheckBlock);
    modifiedCount++;
  }

  // Fallback injection if specific step regex didn't match: Inject before payment page screenshot or at end of test
  if (modifiedCount === 0) {
    const genericPaymentPattern = /(await\s+capturescreenshot\(\s*page\s*,\s*['"]payment-page['"]\s*\);)/;
    if (genericPaymentPattern.test(updated)) {
      const genericBlock = `$1

    // =========================================================================
    // DIRECT URL VERIFICATION - PAYMENT STAGE
    // Verify /visa-status/ and /complete-partially/ simultaneously
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });`;
      updated = updated.replace(genericPaymentPattern, genericBlock);
      modifiedCount++;
    }
  }

  return {
    modified: modifiedCount > 0,
    checkpointsAdded: modifiedCount,
    code: updated
  };
}

function runBatchMigration(dryRun = false) {
  if (!fs.existsSync(SPECS_DIR)) {
    console.error(`Specs directory not found at ${SPECS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.spec.ts'));
  console.log(`\n================ BATCH DIRECT URL MIGRATION ================`);
  console.log(`Found ${files.length} test spec files in ${SPECS_DIR}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Simulated)' : 'APPLY (Writing changes)'}\n`);

  let backupDir = null;
  if (!dryRun) {
    backupDir = createBackup(files);
    console.log(`Safety backup created at: ${backupDir}\n`);
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const filePath = path.join(SPECS_DIR, file);
    const originalCode = fs.readFileSync(filePath, 'utf8');

    const result = updateSpecCode(originalCode, file);

    if (result.modified) {
      if (!dryRun) {
        fs.writeFileSync(filePath, result.code, 'utf8');
      }
      console.log(`✓ [UPDATED] ${file} (+${result.checkpointsAdded} checkpoints)`);
      updatedCount++;
    } else {
      console.log(`- [SKIPPED] ${file} (${result.reason || 'No insertion points found'})`);
      skippedCount++;
    }
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Total specs:     ${files.length}`);
  console.log(`Updated specs:   ${updatedCount}`);
  console.log(`Skipped / Ready: ${skippedCount}`);
  if (backupDir) {
    console.log(`Backup saved to: ${backupDir}`);
  }
  console.log(`==========================================\n`);
}

// Execute batch migration
const isDryRun = process.argv.includes('--dry-run');
runBatchMigration(isDryRun);
