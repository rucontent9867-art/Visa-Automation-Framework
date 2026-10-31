"use strict";
/**
 * Georgia Visa Application - E2E Test
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
(0, baseTest_1.test)('Georgia Visa Application', async ({ page, waitForCaptcha }) => {
    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);
    // ── Open application page directly ──
    await page.goto('https://georgia-evisa.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // ── General details ──
    await page.getByRole('textbox', { name: 'name' })
        .fill('Abhijeet');
    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'phone' })
        .fill('78945 61239');
    // ── Date fields (Using exact date methods) ──
    const arrival = (0, date_1.getArrivalDate)();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);
    const departure = (0, date_1.getDepartureDate)();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);
    await page.locator('#day_departure')
        .selectOption(departure.day);
    // ── State ──
    await page.getByLabel('State')
        .selectOption('153');
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
    await page.locator('#visa_type_0').selectOption({ label: 'Tourist eVisa - 120 days, Multiple entry' });
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();
    // Select Student eVisa - 180 days, Multiple entry
    // ── Passport details ──
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('Abhi');
    // Date of Birth (Auto-calculated: 25 years old)
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);
    // Passport Issue Date (Auto-calculated: 6 months ago)
    const passIssue = (0, date_1.getPassportIssueDate)();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(passIssue.day);
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
    const passportDropdown = page.locator('#passport_type_0');
    // Wait for the element to appear in DOM
    await page.waitForSelector('#passport_type_0', { state: 'attached' });
    // Check visibility before selecting
    if (await passportDropdown.isVisible()) {
        await passportDropdown.selectOption({ label: 'Ordinary Passport' });
        console.log('Passport type selected successfully.');
    }
    else {
        console.log('Passport dropdown not visible — skipping selection.');
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
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    // ── Wait for dynamic upload page to load ──
    await (0, baseTest_1.expect)(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });
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
    // ── Upload files with validation ──
    const uploadSections = [
        'passport_form_',
        'photo_form_'
    ];
    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section}"]`);
        await sectionLocator
            .locator('input[type="file"]')
            .setInputFiles(uploadFilePath);
        await (0, baseTest_1.expect)(sectionLocator)
            .toContainText('✓ Uploaded', { timeout: 15000 });
        console.log(`Uploaded: ${section.replace(/_/g, ' ')}`);
    }
    // ── Save & Continue ──
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' })
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
//# sourceMappingURL=georgia-evisa.spec.js.map