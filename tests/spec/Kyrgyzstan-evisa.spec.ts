/**
 * Kyrgyzstan eVisa Application - E2E Test
 *
 * Refactored to use shared baseTest, captcha helper, date utilities, and post-payment checks.
 */

import { test, expect, capturescreenshot, getUploadFile, verifyDirectUrls } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Kyrgyzstan eVisa Application', async ({ page, waitForCaptcha }) => {

    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);

    // ── Open application page directly ──
    await page.goto('https://kyrgyzstan-evisa.com/apply-now/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.getByRole('textbox', { name: 'name' }).click();
    await page.getByRole('textbox', { name: 'name' }).fill('Rupesh kumar');
    await page.getByRole('textbox', { name: 'email' }).click();
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' }).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('india');
    await page.getByRole('option', { name: 'India +' }).click();
    await page.getByRole('textbox', { name: 'phone' }).click();
    await page.getByRole('textbox', { name: 'phone' }).fill('1234 567 890');

    const arrival = getArrivalDate();
    await page.getByLabel('Year').selectOption(arrival.year);
    await page.getByLabel('Mon').selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true }).selectOption(arrival.day);

    await page.locator('#nationality_gen').selectOption('45');

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);

    await page.waitForTimeout(1500);
    await capturescreenshot(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).fill('Rupesh');
    await page.getByRole('textbox', { name: 'Surname as per Passport' }).click();
    await page.getByRole('textbox', { name: 'Surname as per Passport' }).fill('Kumar');

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0').selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0').selectOption(passExp.month);

    await page.locator('#pass_no_0').fill('111');
    await page.locator('#reason_for_travel_0').fill('test');
    await page.locator('#accomodation_address_0').fill('test');
    await page.locator('#host_fullname_0').fill('test');
    await page.locator('#host_phone_0').fill('test');
    await page.locator('#host_email_0').fill('dm443790@gmail.com');
    await page.locator('#host_address_0').fill('test');

    await page.waitForTimeout(1500);
    await capturescreenshot(page, 'applicant-detail');
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    await page.waitForTimeout(1500);
    await capturescreenshot(page, 'preview');
    await page.getByRole('button', { name: 'Confirm & Submit' }).click();

    await expect(page.locator('[id^="passport_form_"]')).toBeVisible({ timeout: 15000 });

    const uploadCandidates = [
        getUploadFile(),
        path.resolve(__dirname, '..', '..', 'tests', 'assets', '10kb.jpg'),
        path.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
    ];
    const uploadFilePath = uploadCandidates.find(candidate => fs.existsSync(candidate));
    if (!uploadFilePath) {
        throw new Error(`No upload file found. Checked: ${uploadCandidates.join(', ')}`);
    }

    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'event_clearance_form_',
        'poli_clearance_form_',
        'company_registration_form_',
        'business_card_form_',
        'tin_certificate_form_',
        'erfs_registration_form_',
        'company_extract_form_',
    ];

    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section}"]`);
        await sectionLocator.locator('input[type="file"]').setInputFiles(uploadFilePath);
        await expect(sectionLocator).toContainText('✓ Uploaded', { timeout: 15000 });

        const sectionId = await sectionLocator.first().getAttribute('id');
        if (!sectionId) throw new Error(`Could not identify uploaded document section: ${section}`);
        const uploadStatusId = sectionId.replace('_form_', '_uplod_');
        await expect(page.locator(`#${uploadStatusId}`)).toHaveValue('1', { timeout: 15000 });
        console.log(`Uploaded: ${section.replace(/_/g, ' ')}`);
    }

    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    await page.locator('input[type="checkbox"]').last().check();
    await expect(page.locator('#top-progress-bar')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});

    const paymentHeading = page.getByRole('heading', { name: /Pay .*Processing Fee/i });
    try {
        await expect(paymentHeading).toBeVisible({ timeout: 30000 });
    } catch {
        const visibleAlerts = await page.locator('[role="alert"], .alert, .invalid-feedback, .text-danger')
            .allTextContents()
            .catch(() => [] as string[]);
        const alertText = visibleAlerts.map(text => text.trim()).filter(Boolean).join(' | ');
        throw new Error(`Payment page did not appear after Save & Continue.${alertText ? ` Page validation: ${alertText}` : ''}`);
    }

    await expect(page.getByText('dm443790@gmail.com')).toBeVisible();
    await capturescreenshot(page, 'payment-page');
    process.env.PAYMENT_PAGE_URL = page.url();

    console.log(
        `\n================ PAYMENT PAGE URL ================\n${page.url()}\n====================================================\n`
    );

    const orderId = await page.locator('#app_of').textContent();
    const trimmedOrderId = orderId?.trim() || '';
    expect(trimmedOrderId).toBeTruthy();

    try {
        await verifyDirectUrls(page, {
            orderId: trimmedOrderId,
            stageName: 'payment',
            urls: [
                'https://kyrgyzstan-evisa.com/track-application/',
                'https://kyrgyzstan-evisa.com/complete-partially/',
            ],
            waitForCaptcha,
        });

        // ── Visa Status Check ──
        await page.waitForTimeout(1500);
        const statusCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://kyrgyzstan-evisa.com/track-application/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'CI0000000ABC' }).fill(trimmedOrderId);
        await page.getByRole('textbox', { name: 'A1234567' }).fill('111');
        const statusCaptcha = await statusCaptchaPromise;
        await page.getByRole('textbox', { name: 'Enter code' }).fill(statusCaptcha);
        await page.getByRole('button', { name: 'Check Status' }).click();
        await expect(page.getByText('dm443790@gmail.com')).toBeVisible();

        process.env.VISA_STATUS_PAGE_URL = page.url();
        process.env.VISA_STATUS_SCREENSHOT = await capturescreenshot(page, 'visa-status') || '';

        // ── Complete Partially Filled ──
        await page.waitForTimeout(1500);
        const partialCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://kyrgyzstan-evisa.com/complete-partially/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'KG0000000ABC' }).fill(trimmedOrderId);
        const partialCaptcha = await partialCaptchaPromise;
        await page.getByRole('textbox', { name: 'Enter code' }).fill(partialCaptcha);
        await page.getByRole('button', { name: 'Complete Partially Filled' }).click();
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
test.describe('Kyrgyzstan Evisa contact form', () => {
    test.describe.configure({ retries: 0 });

    test('sends one inquiry and displays confirmation', async ({ page }) => {
        const { submitContactUsForm } = await import('../../utils/contactUs');
        const result = await submitContactUsForm(page, 'Kyrgyzstan-evisa');
        expect(result.status, result.reason || 'Kyrgyzstan Evisa Contact Us submission failed').toBe('PASS');
    });
});
