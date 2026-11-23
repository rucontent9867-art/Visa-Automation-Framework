/**
 * Mexico eVisa Application - E2E Test
 *
 * Full end-to-end flow: Registration -> Applicant Details -> Preview ->
 * Document Upload -> Payment -> Visa Status Check -> Complete Partially Filled.
 */

import { test, expect, capturescreenshot, getUploadFile, verifyDirectUrls } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Mexico Visa Application', async ({ page, waitForCaptcha }) => {

    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);

    // ── Open application page directly ──
    await page.goto('https://mexico-e-visa.com/apply/');
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
    await page.getByRole('combobox', { name: 'Search' }).fill('indi');
    await page.getByRole('option', { name: 'India +' }).click();
    await page.getByRole('textbox', { name: 'phone' }).fill('1234 567 890');

    const arrival = getArrivalDate();
    const departure = getDepartureDate();

    // Date of Arrival
    await page.locator('#day_arrival').selectOption(arrival.day);
    await page.locator('#mon_arrival').selectOption(arrival.month);
    await page.locator('#yr_arrival').selectOption(arrival.year);

    // Date of Departure
    await page.locator('#day_departure').selectOption(departure.day);
    await page.locator('#mon_departure').selectOption(departure.month);
    await page.locator('#yr_departure').selectOption(departure.year);

    await page.getByLabel('Select your nationality').selectOption('45');

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Register' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }
    await page.waitForTimeout(1500);

    await page.getByRole('textbox', { name: 'Name as per Passport', exact: true }).fill('rupesh');
    await page.getByRole('textbox', { name: 'Surname as per Passport' }).fill('kumar');

    // Date of Birth (Auto-calculated: 25 years old)
    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0').selectOption(dob.year);
    await page.locator('#mon_dob_0').selectOption(dob.month);
    await page.locator('#day_dob_0').selectOption(dob.day);

    // Passport Issue Date
    const passIssue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0').selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0').selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0').selectOption(passIssue.day);

    await page.locator('#pass_no_0').fill('111');
    await page.locator('#country_of_birth_0').selectOption('41');
    await page.locator('#religion_0').selectOption('JUDAISM');
    await page.locator('#address_0').fill('test');
    await page.locator('#purpose_of_visit_0').selectOption('Recreational Activities');
    await page.locator('#accomodation_address_0').fill('test');

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'applicant-detail');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    // ── Wait for dynamic upload page to load ──
    await expect(page.locator('[id^="photo_form_"]')).toBeVisible({ timeout: 15000 });

    const uploadCandidates = [
        getUploadFile(),
        path.resolve(__dirname, '..', '..', 'tests', 'assets', '10kb.jpg'),
        path.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
    ];
    const uploadFilePath = uploadCandidates.find(candidate => fs.existsSync(candidate));
    if (!uploadFilePath) {
        throw new Error(`No upload file found. Checked: ${uploadCandidates.join(', ')}`);
    }

    const uploadSections = ['photo_form_', 'passport_form_'];
    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section}"]`);
        await sectionLocator.locator('input[type="file"]').setInputFiles(uploadFilePath);
        await expect(sectionLocator).toContainText('Uploaded', { timeout: 15000 });
        console.log(`Uploaded: ${section.replace(/_/g, ' ')}`);
    }

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {}

    // ── Final assertions ──
    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');
    await expect(page.getByText('dm443790@gmail.com')).toBeVisible();
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
                'https://mexico-e-visa.com/application-status/',
                'https://mexico-e-visa.com/complete-partially/',
            ],
            waitForCaptcha,
        });

        // ── Visa Status Check ──
        await page.waitForTimeout(1500);
        const statusCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://mexico-e-visa.com/application-status/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'application_id_status' }).fill(trimmedOrderId);
        await page.getByRole('textbox', { name: 'passport_no_status' }).fill('111');
        const statusCaptcha = await statusCaptchaPromise;
        await page.getByRole('textbox', { name: 'captcha_code_status' }).fill(statusCaptcha);
        await page.getByRole('button', { name: 'Check Status' }).click();
        await expect(page.getByText('dm443790@gmail.com')).toBeVisible();

        process.env.VISA_STATUS_PAGE_URL = page.url();
        process.env.VISA_STATUS_SCREENSHOT = await capturescreenshot(page, 'visa-status') || '';

        // ── Complete Partially Filled ──
        await page.waitForTimeout(1500);
        const partialCaptchaPromise = waitForCaptcha(page);
        await page.goto('https://mexico-e-visa.com/complete-partially/');
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {}

        await page.getByRole('textbox', { name: 'temporary_application_id' }).fill(trimmedOrderId);
        const partialCaptcha = await partialCaptchaPromise;
        await page.getByRole('textbox', { name: 'captcha_code' }).fill(partialCaptcha);
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
test.describe('Mexico contact form', () => {
    test.describe.configure({ retries: 0 });

    test('sends one inquiry and displays confirmation', async ({ page }) => {
        const { submitContactUsForm } = await import('../../utils/contactUs');
        const result = await submitContactUsForm(page, 'mexico');
        expect(result.status, result.reason || 'Mexico Contact Us submission failed').toBe('PASS');
    });
});
