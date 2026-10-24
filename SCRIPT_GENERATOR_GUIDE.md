# Playwright Test Automation - Master Script Generator Guide

This master knowledge base defines the exact architectural conventions, utility methods, locator strategies, email standards, and checkpoint-based recovery mechanisms used by the AI Auto Script Generator.

---

## 1. Layman's Explanation: How It Handles Complex Scenarios

### 🔹 Dynamic Elements (AJAX, Changing IDs, Delayed DOMs)
Web forms frequently load elements asynchronously or generate random IDs (e.g., `id="passport_form_94827"`). 
- **The Solution**: The generator uses **semantic user-facing locators** (`getByRole`, `getByLabel`, `getByPlaceholder`) and **prefix-based attribute locators** (`locator('[id^="passport_form_"]')`).
- **Explicit Waits**: Instead of fixed sleeps, steps wait for the element's actual visibility: `await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).waitFor({ state: 'visible', timeout: 15000 });`.

### 🔹 Popups, Modals & Native Dialogs
- **HTML Modals & Cookie Overlays**: Handled by conditional dismissal before interacting:
  ```typescript
  const modalClose = page.locator('#modal-close, button:has-text("Accept"), button:has-text("Close")');
  if (await modalClose.isVisible({ timeout: 2000 }).catch(() => false)) await modalClose.click();
  ```
- **Browser Dialogs (Alert, Confirm)**: Auto-accepted using event listeners:
  ```typescript
  page.on('dialog', async dialog => await dialog.accept());
  ```

### 🔹 Iframes (Embedded Forms & Payment Gateways)
- Uses Playwright's `frameLocator` to target elements nested inside iframes without losing page context:
  ```typescript
  const paymentFrame = page.frameLocator('iframe#payment-iframe');
  await paymentFrame.getByRole('textbox', { name: 'Card Number' }).fill('4242424242424242');
  ```

### 🔹 Smart Date & Time Filling
Multi-step government portals reject invalid dates, past arrival dates, or expired passports.
- Built-in helpers in `utils/date.ts` dynamically calculate valid dates:
  - `getArrivalDate()`: Generates an arrival date exactly **9 months in the future** (avoids month-end rollover bugs).
  - `getPassportExpiryDate()`: Generates a passport expiry date **5 years in the future**.
  - `getFutureDate(months)`: Allows customizable future windows.

---

## 2. Core Mandatory Standards

1. **Mandatory Email Address**:
   - **`dm443790@gmail.com`** is the ONLY authorized email to be used for all test email fields.
   - Never use placeholder emails (`test@test.com`, `user@example.com`).

2. **Stateful Checkpointing (No-Restart Rule)**:
   - When generating or healing multi-page test scripts, tests are split into discrete **Page Stages** / Checkpoints.
   - If an error occurs on Page 3, the engine **must NOT restart from Page 1**.
   - The browser remains alive on Page 3, re-inspects the live DOM elements, heals the broken selector or interaction on that page, verifies it, and continues forward.
   - All passed and healed checkpoints are then synthesized into a single cohesive end-to-end `.spec.ts` test script.

---

## 3. Standard Imports & Shared Utilities

Every test script in `tests/spec/` must import fixtures from `utils/`:

```typescript
import { test, expect, getUploadFile, capturescreenshot } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate, getFutureDate } from '../../utils/date';
import { uploadAndWaitForSuccess } from '../../utils/apiUpload';
import path from 'path';
```

---

## 4. Battle-Tested Portal Interaction Patterns

### A. Navigation & Captcha Synchronization
Captchas are solved in the background while general details are filled:

```typescript
test('Country Visa Application', async ({ page, waitForCaptcha }) => {
    // 1. Attach Captcha listener before navigation triggers the background request
    const captchaPromise = waitForCaptcha(page);

    // 2. Navigate to portal
    await page.goto('https://portal-example.com/apply/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    // 3. Fill General Details while Captcha resolves
    await page.getByRole('textbox', { name: 'name' }).fill('testing');
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');

    // 4. Fill Captcha when ready
    const captcha = await captchaPromise;
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captcha);
});
```

### B. Searchable Country Comboboxes
Custom searchable dropdowns require clicking the container, typing in the search box, and clicking the matched item:

```typescript
await page.getByRole('combobox', { name: 'Selected country' }).locator('div').nth(1).click();
await page.getByRole('combobox', { name: 'Search' }).fill('ind');
await page.getByRole('option', { name: 'India +' }).click();
```

### C. Dynamic Date Selectors
```typescript
const arrival = getArrivalDate();
await page.getByLabel('Year').selectOption(arrival.year);
await page.getByLabel('Mon').selectOption(arrival.month);
await page.getByLabel('Day', { exact: true }).selectOption(arrival.day);

const expiry = getPassportExpiryDate();
await page.locator('#yr_pass_exp_0').selectOption(expiry.year);
await page.locator('#mon_pass_exp_0').selectOption(expiry.month);
```

### D. File Uploads (Passports & Photos)
Uses the `getUploadFile` fixture with `uploadAndWaitForSuccess` helper:

```typescript
const uploadFile = getUploadFile();
const fileInput = page.locator('input[type="file"]').first();

if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(uploadFile);
} else {
    await page.getByRole('button', { name: 'Choose File' }).setInputFiles(uploadFile);
}

// Or using resilient upload API listener
await uploadAndWaitForSuccess(page, fileInput, uploadFile);
```

### E. Step Screenshots & Payment Verification
```typescript
await page.waitForTimeout(1000);
await capturescreenshot(page, 'applicant-detail');

await page.getByRole('button', { name: 'Confirm & Submit' }).click();
await page.waitForURL('**/payment**', { timeout: 15000 }).catch(() => {});

// Verify applicant email is displayed on final review/payment screen
await expect(page.getByText('dm443790@gmail.com')).toBeVisible();
await capturescreenshot(page, 'payment-page');
```

### F. Direct URL Verification Pattern (/visa-status/ & /complete-partially/)

At each key stage (1. Preview page, 2. Document upload page, 3. Payment page), copy the Order ID into a variable. **Before clicking any Submit, Continue, or Save and Continue button**, open both status/resume URLs in separate tabs:
- `${baseUrl}/visa-status/`
- `${baseUrl}/complete-partially/`

```typescript
/**
 * Direct URL Verification Helper
 * Opens /visa-status/ and /complete-partially/ in separate tabs, fills Order ID,
 * completes Captcha if required, waits with 5s networkidle fallback, and captures screenshots.
 */
async function verifyDirectUrls(
    page: Page,
    orderId: string,
    stageName: 'preview' | 'document-upload' | 'payment',
    waitForCaptcha?: (p: Page) => Promise<string>
) {
    const origin = new URL(page.url()).origin;
    const targets = [
        { slug: 'visa-status', url: `${origin}/visa-status/` },
        { slug: 'complete-partially', url: `${origin}/complete-partially/` }
    ];

    for (const target of targets) {
        const verifyTab = await page.context().newPage();
        try {
            const tabCaptchaPromise = waitForCaptcha ? waitForCaptcha(verifyTab) : null;
            await verifyTab.goto(target.url);
            try {
                await verifyTab.waitForLoadState('networkidle', { timeout: 5000 });
            } catch {
                console.log(`[DirectURL] Network not idle on ${target.slug}, continuing`);
            }

            // Fill Order ID
            const orderInput = verifyTab.locator('#order_id, input[name="order_id"], input[placeholder*="Order"]');
            if (await orderInput.isVisible({ timeout: 4000 }).catch(() => false)) {
                await orderInput.fill(orderId);
            }

            // Handle Captcha if present
            if (tabCaptchaPromise) {
                const captchaCode = await tabCaptchaPromise.catch(() => '');
                const captchaInput = verifyTab.locator('input[name="captcha"], #captcha, input[placeholder*="Captcha"]');
                if (captchaCode && await captchaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await captchaInput.fill(captchaCode);
                }
            }

            // Submit check/resume form
            const submitBtn = verifyTab.locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Search"), input[type="submit"]');
            if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await submitBtn.click();
                try {
                    await verifyTab.waitForLoadState('networkidle', { timeout: 5000 });
                } catch {}
            }

            // Capture screenshot with stage & slug name
            await verifyTab.waitForTimeout(1000);
            await capturescreenshot(verifyTab, `${stageName}-${target.slug}`);

        } finally {
            // Close tab and return focus to main application page
            await verifyTab.close();
        }
    }
}
```

---

## 5. Universal Prompt for the Generator UI

Copy and paste this prompt into the **Test Scenario Details & Form Instructions** field in the Generator popup for any application:

```text
Follow SCRIPT_GENERATOR_GUIDE.md standards:
1. Set up Captcha listener with `const captchaPromise = waitForCaptcha(page);` before navigation.
2. Navigate to portal URL and wait for networkidle with fallback catch.
3. For all email fields, strictly use "dm443790@gmail.com". Use phone "9876543210".
4. For Country/Nationality, select India using searchable combobox or select option.
5. For arrival date, use `getArrivalDate()` ({ day, month, year }). For passport expiry, use `getPassportExpiryDate()`.
6. Attach passport document using `getUploadFile()` and `uploadAndWaitForSuccess`.
7. Direct URL Verification: At Preview, Document Upload, and Payment stages, extract the Order ID, open `${origin}/visa-status/` and `${origin}/complete-partially/` in separate tabs before submitting, complete forms, capture stage screenshots, close the tabs, and proceed.
8. Page Checkpoints: If an element fails on Page 2 or Page 3, DO NOT restart from Page 1. Inspect the live DOM on that page, heal the selector, and continue forward.
9. Capture screenshots at each major step with `capturescreenshot(page, '<step-name>')` and verify final review/payment screen displays dm443790@gmail.com.
```

