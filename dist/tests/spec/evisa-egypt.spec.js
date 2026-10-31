"use strict";
/**
 * Egypt Visa Application - E2E Test
 *
 * Refactored to use shared baseTest, captcha helper, and exact date methods.
 * Starts directly from the application page URL.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
(0, baseTest_1.test)('Egypt Visa Application', async ({ page, waitForCaptcha }) => {
    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);
    // ── Open application page directly ──
    await page.goto('https://evisa-egypt.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // ── General details ──
    await page.getByRole('textbox', { name: 'Name *' })
        .fill('Abhijeet');
    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('78945 63214');
    await page.getByLabel('Nationality')
        .selectOption('62');
    // ── Date fields (Using exact date methods) ──
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);
    await page.getByLabel('Arrival Day')
        .selectOption(arrival.day);
    // ── Fill captcha ──
    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);
    // ── Register ──
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();
    // ── Passport details ──
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('Abhi');
    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('kumar');
    // Passport Expiry Date (Auto-calculated: 5 years ahead)
    const passExp = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#occupation_0')
        .selectOption('MISSIONARY');
    // ── Resolve upload file path ──
    const uploadCandidates = [
        path_1.default.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
        path_1.default.resolve(process.cwd(), 'debug-chromium-desktop.png'),
        path_1.default.resolve(process.cwd(), 'tests', 'assets', '10kb.jpg'),
    ];
    const uploadFilePath = uploadCandidates.find(candidate => fs_1.default.existsSync(candidate));
    if (!uploadFilePath) {
        throw new Error(`No upload file found. Checked: ${uploadCandidates.join(', ')}`);
    }
    // ── Upload file ──
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFilePath);
    }
    else {
        await page.getByRole('button', { name: 'Choose File' })
            .setInputFiles(uploadFilePath);
    }
    // ── Submit & Preview ──
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'applicant-detail');
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // ── Confirm & Submit ──
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'preview');
    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // ── Final assertions ──
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Pay Application Processing Fee' })).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    // ── Payment URL auto-captured by baseTest afterEach ──
    console.log(`\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`);
});
//# sourceMappingURL=evisa-egypt.spec.js.map