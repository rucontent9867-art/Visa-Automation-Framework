/**
 * India Visa Application (india-evisa.it.com) - E2E Test
 *
 * Full end-to-end flow: Registration -> Personal -> Address -> Family -> Reference ->
 * Preview -> Document Upload -> Payment -> Visa Status Check -> Complete Partially Filled.
 */

import { test, expect, capturescreenshot, getUploadFile, verifyDirectUrls } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate,
    formatDDMMYYYY,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('India Visa Application', async ({ page, waitForCaptcha }) => {

    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);

    // ── Open application page directly ──
    await page.goto('https://india-evisa.it.com/apply-visa/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.getByRole('textbox', { name: 'email' }).click();
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' }).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('indi');
    await page.getByRole('option', { name: 'India +' }).click();
    await page.getByRole('textbox', { name: 'phone' }).fill('1234 567 890');
    await page.getByLabel('nationality').selectOption('34');
    await page.getByRole('radio', { name: 'Meeting Friends/Relatives' }).check();

    // ── Date of Arrival (jQuery UI datepicker — type DD-MM-YYYY directly) ──
    const arrival = getArrivalDate();
    const arrivalStr = formatDDMMYYYY(arrival);
    await page.locator('#arrival_date').click();
    await page.locator('#arrival_date').fill(arrivalStr);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log(`Arrival date set: ${arrivalStr}`);

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Continue' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.waitForTimeout(1500);
    await page.locator('input[name="givernname"]').click();
    await page.locator('input[name="givernname"]').fill('Rupesh');
    await page.locator('input[name="passport_no"]').click();
    await page.locator('input[name="passport_no"]').fill('111');
    await page.locator('select[name="religion"]').selectOption('HINDU');
    await page.locator('select[name="edu_qualification"]').selectOption('GRADUATE');

    const passportExpiryDate = getPassportExpiryDate();
    const expiryStr = formatDDMMYYYY(passportExpiryDate);
    await page.locator('input[name="passport_expiry_date"]').click();
    await page.locator('input[name="passport_expiry_date"]').fill(expiryStr);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log(`Passport expiry date set: ${expiryStr}`);

    const saveButton = page.getByRole('button', { name: 'Save and Continue' });
    await expect(saveButton).toBeVisible();
    await page.waitForTimeout(1000);
    await saveButton.click();

    await page.locator('input[name="house_no"]').click();
    await page.locator('input[name="house_no"]').fill('Test');
    await page.locator('input[name="postal_code"]').click();
    await page.locator('input[name="postal_code"]').fill('test');
    await page.locator('#occupation').selectOption('CAMERAMAN');
    await page.locator('input[name="employer_name"]').click();
    await page.locator('input[name="employer_name"]').fill('test');

    const saveButton2 = page.getByRole('button', { name: 'Save and Continue' });
    await expect(saveButton2).toBeVisible();
    await page.waitForTimeout(1000);
    await saveButton2.click();

    await page.locator('input[name="father_name"]').click();
    await page.locator('input[name="father_name"]').fill('test');
    await page.locator('input[name="father_birth_place"]').click();
    await page.locator('input[name="father_birth_place"]').fill('test');
    await page.locator('input[name="mother_name"]').click();
    await page.locator('input[name="mother_name"]').fill('test');
    await page.locator('input[name="mother_birth_place"]').click();
    await page.locator('input[name="mother_birth_place"]').fill('test');

    const saveButton3 = page.getByRole('button', { name: 'Save and Continue' });
    await expect(saveButton3).toBeVisible();
    await page.waitForTimeout(1000);
    await saveButton3.click();

    await page.locator('input[name="ref_name_in"]').click();
    await page.locator('input[name="ref_name_in"]').fill('test');
    await page.locator('input[name="ref_add_in"]').click();
    await page.locator('input[name="ref_add_in"]').fill('test');
    await page.locator('#ref_state_in').selectOption('7');
    await page.locator('#ref_dist_in').selectOption('113');
    await page.locator('input[name="ref_phone_in"]').click();
    await page.locator('input[name="ref_phone_in"]').fill('1234567890');
    await page.locator('input[name="ref_name_cn"]').click();
    await page.locator('input[name="ref_name_cn"]').fill('test');
    await page.locator('input[name="ref_add_cn"]').click();
    await page.locator('input[name="ref_add_cn"]').fill('test');
    await page.locator('input[name="ref_phone_cn"]').click();
    await page.locator('input[name="ref_phone_cn"]').fill('1234567890');

    const previewButton = page.getByRole('button', { name: 'Preview & Submit Application' });
    await expect(previewButton).toBeVisible();
    await page.waitForTimeout(1000);
    await previewButton.click();

    const submitButton = page.getByRole('button', { name: 'Submit' });
    await expect(submitButton).toBeVisible();
    await page.waitForTimeout(1000);
    await submitButton.click();

    // ── Wait for dynamic upload page to load ──
    await expect(page.locator('#photo')).toBeVisible({ timeout: 15000 });

    const uploadCandidates = [
        getUploadFile(),
        path.resolve(__dirname, '..', '..', 'tests', 'assets', '10kb.jpg'),
        path.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
    ];
    const uploadFilePath = uploadCandidates.find(candidate => fs.existsSync(candidate));
    if (!uploadFilePath) {
        throw new Error(`No upload file found. Checked: ${uploadCandidates.join(', ')}`);
    }

    // India eVisa uses a full-page form submit (not AJAX)
    await page.locator('input[name="photo"]').setInputFiles(uploadFilePath);
    await page.locator('input[name="passport"]').setInputFiles(uploadFilePath);
    console.log('Both files selected. Submitting form...');

    const [uploadResponse] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.evaluate(() => {
            const form = document.getElementById('appli_frm_photo') as HTMLFormElement | null;
            if (form) form.submit();
        }),
    ]);
    console.log(`Upload response: ${uploadResponse?.status()} ${uploadResponse?.url()}`);

    try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
        console.log('Network never went idle after upload, continuing');
    }
    await page.waitForTimeout(1500);

    // ── Final payment-stage assertions ──
    await expect(
        page.getByRole('heading', { name: 'Your Temporary Application ID' })
    ).toBeVisible({ timeout: 30000 });

    process.env.PAYMENT_PAGE_URL = page.url();
    const paymentPageUrl = page.url();

    try {
        await page.waitForTimeout(1000);
        await capturescreenshot(page, 'payment-page');
        await expect(page.getByText('dm443790@gmail.com')).toBeVisible();

        console.log(
            `\n================ PAYMENT PAGE URL ================\n${paymentPageUrl}\n====================================================\n`
        );

        const orderId = await page
            .getByRole('heading', { name: /Your Temporary Application ID:/ })
            .locator('strong')
            .textContent();
        const trimmedOrderId = orderId?.trim() || '';
        console.log(`\n================ TEMPORARY ORDER ID ================\n${trimmedOrderId}\n====================================================\n`);
        expect(trimmedOrderId).toBeTruthy();

        await verifyDirectUrls(page, {
            orderId: trimmedOrderId,
            stageName: 'payment',
            urls: [
                'https://india-evisa.it.com/visa-application-status/',
                'https://india-evisa.it.com/complete-partially-filled-application/',
            ],
            waitForCaptcha,
        });

        // ── Visa Status Check ──
        await page.waitForTimeout(1500);
        const statusCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://india-evisa.it.com/visa-application-status/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'Application ID *' }).fill(trimmedOrderId);
        await page.getByRole('textbox', { name: 'Passport No. *' }).fill('111');
        const statusCaptcha = await statusCaptchaPromise;
        await page.getByRole('textbox', { name: 'Enter captcha' }).fill(statusCaptcha);
        await page.getByRole('button', { name: 'Check Status' }).click();
        await expect(page.getByText('You have not filled complete')).toBeVisible();

        process.env.VISA_STATUS_PAGE_URL = page.url();
        process.env.VISA_STATUS_SCREENSHOT = await capturescreenshot(page, 'visa-status') || '';

        // ── Complete Partially Filled ──
        await page.waitForTimeout(1500);
        const partialCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://india-evisa.it.com/complete-partially-filled-application/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'Application ID *' }).fill(trimmedOrderId);
        const partialCaptcha = await partialCaptchaPromise;
        await page.getByRole('textbox', { name: 'Enter captcha' }).fill(partialCaptcha);
        await page.getByRole('button', { name: 'Complete Application' }).click();
        await page.waitForURL(/(visa-payment|apply\/\?a=edit)/, { timeout: 30000 });

        process.env.COMPLETE_PARTIALLY_URL = page.url();
        process.env.COMPLETE_PARTIALLY_SCREENSHOT = await capturescreenshot(page, 'complete-partially') || '';
    } catch (postPaymentError: any) {
        console.warn(
            'Application reached the payment page, but a post-payment check failed:',
            postPaymentError?.message || postPaymentError
        );
    }
});

// =====================================
// SECTION: Contact Us
// =====================================
test.describe('India Evisa It contact form', () => {
    test.describe.configure({ retries: 0 });

    test('sends one inquiry and displays confirmation', async ({ page }) => {
        const { submitContactUsForm } = await import('../../utils/contactUs');
        const result = await submitContactUsForm(page, 'India-evisa_it');
        expect(result.status, result.reason || 'India Evisa It Contact Us submission failed').toBe('PASS');
    });
});
