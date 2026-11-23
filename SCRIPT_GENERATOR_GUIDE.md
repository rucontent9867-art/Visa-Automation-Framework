# Playwright Test Automation - Master Script Generator & Verification Guide

This master knowledge base defines the architectural standards, code patterns, locator strategies, email standards, and direct URL verification mechanisms used by the AI Auto Script Generator.

---

## 1. Critical SDET Context: Live Forms & Limited Application Attempts

> ⚠️ **CRITICAL REALITY: FORMS ARE LIVE PRODUCTION SYSTEMS**  
> All visa application portals in this framework (`*.com/application/`, `*.info/apply/`, etc.) are live production services. Submitting invalid data, failing mid-flow, or repeatedly hitting endpoints via trial-and-error tests causes severe problems:
> - Incomplete or orphaned application records in live government/agency databases.
> - IP rate-limiting, Cloudflare blocks, and CAPTCHA difficulty escalation.
> - Unwanted processing charges or consumed one-time registration quotas.

**The Golden SDET Rule: One-Shot Flawless Execution & Minimum Database Records**  
- **Single-Application Principle**: Every generated or updated test script must create only the **minimum required applications (exactly ONE application per test flow)**.
- **Order ID Reuse**: The single Order ID generated during registration must be reused across all subsequent verification checkpoints (`preview`, `document-upload`, `payment`). Never create secondary applications or registrations within a test run.
- **Read-Only Verification Tabs**: Secondary tabs opened for `/visa-status/` and `/complete-partially/` must only query the created application and capture screenshot evidence—they must never submit blank forms or register new application drafts.
- **Zero-Pollution Synthesis**: The Script Generator synthesizes scripts statically through AST and knowledge heuristics without executing live browser runs, preventing unwanted draft applications from accumulating in production databases.

---

## 2. Capabilities Overview: What the Generator Can Handle

The generator is fully capable of synthesizing and updating **all 4 primary testing archetypes**:

| Test Archetype | Flow Architecture | Golden Reference Standard |
| :--- | :--- | :--- |
| **Archetype 1A: Upload-First Dual Page Verification** | Registration → Passport Form → **Doc Upload** → *(Checkpoint 1)* → **Submit & Preview** → *(Checkpoint 2)* → **Confirm & Submit** → **Payment Screen** → *(Checkpoint 3)* | **`azerbaijan-visa.spec.ts`** *(Egypt, Turkey, Armenia, Georgia standard)* |
| **Archetype 1B: Preview-First Multi-Section Upload** | Registration → Passport Form → **Submit & Preview** → *(Checkpoint 1)* → **Confirm & Submit** → **Multi-Section Uploads** (`passport_form_`, `photo_form_`, etc.) → **Reload/Doc Check** → *(Checkpoint 2)* → **Save & Continue** → **Payment Screen** → *(Checkpoint 3)* | **`bahrain-visa.spec.ts`** *(UK, Ivory Coast, Malawi standard)* |
| **Archetype 2: Up-to-Payment-Page Only** | Validates form fields, dynamic dates, and file uploads directly to payment screen without opening secondary verification tabs. | Navigates through Registration → Personal Details → Upload → Preview → Payment page. Asserts payment fee header and `dm443790@gmail.com` visibility, captures payment screenshot. |
| **Archetype 3: Standalone Verification / Status Resumption** | Tests existing or partially completed applications directly on status or resume pages. | Bypasses registration completely. Navigates directly to `/visa-status/` or `/complete-partially/` (or `/application-status/`) with a specified Order ID, verifies tracking info, and captures verification screenshots. |

---

## 3. Core Senior SDET Anti-Flakiness Rules

1. **Mandatory Test Email Convention**:
   - **`dm443790@gmail.com`** is the ONLY authorized email for all test forms.
   - Assert its presence on the final review/payment screen:
     ```typescript
     await expect(page.getByText('dm443790@gmail.com')).toBeVisible();
     ```

2. **Captcha Hook Pre-Navigation**:
   - Always initialize the captcha listener **before** calling `page.goto()` so background API triggers are never missed:
     ```typescript
     const captchaPromise = waitForCaptcha(page);
     await page.goto('https://portal-example.com/apply/');
     ```

3. **Dynamic Elements & Async Overlays**:
   - Prefer user-facing semantic locators: `getByRole('textbox', { name: '...' })`, `getByRole('button', { name: '...' })`.
   - Wait for loading overlays and spinners to detach before clicking action buttons:
     ```typescript
     const spinner = page.locator('.loading-overlay, .spinner, .overlay, [aria-busy="true"]');
     if (await spinner.isVisible().catch(() => false)) {
         await spinner.waitFor({ state: 'detached', timeout: 15000 });
     }
     ```

4. **Date Rollover Prevention**:
   - Use dynamic helpers from `../../utils/date`:
     - `getArrivalDate()`: 9 months in future (avoids month-end 31st/30th rollover errors).
     - `getPassportExpiryDate()`: 5 years in future.
     - `getDateOfBirth()`: 25 years in past.

5. **Direct URL Dual Page Verification**:
   - Opens `/visa-status/` and `/complete-partially/` (or `/application-status/` and `/complete-application/`) in separate tabs simultaneously using `verifyDirectUrls`.
   - Never loses page context: tabs are closed in `finally` blocks, returning focus to main application page safely.

---

## 3. Pattern 1: Complete E2E Flow with Simultaneous Dual Page Verification

*(Exact pattern used in `azerbaijan-visa.spec.ts` and `bahrain-visa.spec.ts`)*

```typescript
import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';
import path from 'path';

test('Country Visa Application with Simultaneous Verification', async ({ page, waitForCaptcha, getUploadFile }) => {

    // 1. Set up Captcha listener before navigation
    const captchaPromise = waitForCaptcha(page);

    // 2. Navigate to portal
    await page.goto('https://country-visa.example.com/apply/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network did not go idle, continuing');
    }

    // 3. General Information
    await page.getByRole('textbox', { name: 'name' }).fill('testing');
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');
    await page.getByRole('textbox', { name: 'phone' }).fill('9876543210');

    const arrival = getArrivalDate();
    await page.getByLabel('Year').selectOption(arrival.year);
    await page.getByLabel('Mon').selectOption(arrival.month);

    // 4. Solve Captcha & Register
    const captcha = await captchaPromise;
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captcha);

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // 5. Passport & Applicant Form
    await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).fill('testing');

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0').selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0').selectOption(expiry.month);
    await page.locator('#pass_no_0').fill('A12345678');

    // 6. File Upload
    const uploadFile = getUploadFile();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(uploadFile);

    // ══════════════════════════════════════════════════════════════════════════
    // VERIFICATION CHECKPOINT 1: DOCUMENT UPLOAD STAGE
    // ══════════════════════════════════════════════════════════════════════════
    let orderId = (await page.locator('#order_id_spn, #order_id, input[name="order_id"]').textContent().catch(() => ''))?.trim() || '';
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'document-upload',
        urls: [
            '/visa-status/',
            '/complete-partially/'
        ],
        waitForCaptcha
    });

    // 7. Preview Stage
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'applicant-detail');
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    orderId = (await page.locator('#order_id_spn').textContent().catch(() => ''))?.trim() || orderId;

    // ══════════════════════════════════════════════════════════════════════════
    // VERIFICATION CHECKPOINT 2: PREVIEW STAGE
    // ══════════════════════════════════════════════════════════════════════════
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'preview',
        urls: [
            '/visa-status/',
            '/complete-partially/'
        ],
        waitForCaptcha
    });

    // 8. Payment Stage
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview');
    await page.getByRole('button', { name: 'Confirm & Submit' }).click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await expect(page.getByRole('heading', { name: /Pay|Payment/i })).toBeVisible();
    await expect(page.getByText('dm443790@gmail.com')).toBeVisible();

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    // ══════════════════════════════════════════════════════════════════════════
    // VERIFICATION CHECKPOINT 3: PAYMENT STAGE
    // ══════════════════════════════════════════════════════════════════════════
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'payment',
        urls: [
            '/visa-status/',
            '/complete-partially/'
        ],
        waitForCaptcha
    });
});
```

---

## 4. Pattern 2: Flow Up-To-Payment-Page Only

For portals or scenarios where only the checkout landing page is tested without secondary tab verification:

```typescript
import { test, expect, getUploadFile, capturescreenshot } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';

test('Country Visa Application (Up to Payment Page)', async ({ page, waitForCaptcha, getUploadFile }) => {
    const captchaPromise = waitForCaptcha(page);
    await page.goto('https://country-visa.example.com/apply/');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Fill form
    await page.getByRole('textbox', { name: 'name' }).fill('testing');
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');

    const arrival = getArrivalDate();
    await page.getByLabel('Year').selectOption(arrival.year);
    await page.getByLabel('Mon').selectOption(arrival.month);

    const captcha = await captchaPromise;
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captcha);
    await page.getByRole('button', { name: 'Register' }).click();

    // Documents & Preview
    const uploadFile = getUploadFile();
    await page.locator('input[type="file"]').first().setInputFiles(uploadFile);
    await page.getByRole('button', { name: 'Submit & Preview' }).click();

    // Confirm & navigate to payment
    await page.getByRole('button', { name: 'Confirm & Submit' }).click();

    // Assert payment screen and email presence
    await expect(page.getByRole('heading', { name: /Payment|Pay Visa Processing Fee/i })).toBeVisible();
    await expect(page.getByText('dm443790@gmail.com')).toBeVisible();
    await capturescreenshot(page, 'payment-page');
});
```

---

## 5. Pattern 3: Standalone Verification-Only Test Case

For standalone testing of `/visa-status/` and `/complete-partially/`:

```typescript
import { test, expect, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';

test('Standalone Status and Resume Page Verification', async ({ page, waitForCaptcha }) => {
    const testOrderId = 'TEST-ORDER-12345';

    await verifyDirectUrls(page, {
        orderId: testOrderId,
        stageName: 'standalone-check',
        urls: [
            'https://country-visa.example.com/visa-status/',
            'https://country-visa.example.com/complete-partially/'
        ],
        waitForCaptcha
    });
});
```

---

## 6. Best Approach to Update All 57 Scripts

To update all remaining test scripts to verify both pages simultaneously as done in Azerbaijan and Bahrain:

### Approach A: One-Click Generator in Dashboard UI (Interactive & Selective)
1. Open the **Script Generator** modal in the web dashboard.
2. Select **"Update Existing Script"**.
3. Choose the target script from the dropdown (e.g. `egypt-eta.spec.ts`).
4. Click **"Synthesize & Apply Script"**.
5. The engine automatically inspects the code, inserts `verifyDirectUrls` with `/visa-status/` and `/complete-partially/` before Preview, Upload, and Payment submissions, and writes the updated spec to `tests/spec/`.

### Approach B: Automated Batch Migration Script (Fast & Safe for All Scripts)
Run the automated migration tool:
```bash
node server/scripts/batchUpdateDirectUrls.js
```
- Creates a timestamped backup of all spec files in `.backups/`.
- Scans all 57 `.spec.ts` files.
- Automatically inserts `verifyDirectUrls` imports and stage verifications.
- Produces a summary report of modified scripts.
