"use strict";
/**
 * United Kingdom Visa Application - E2E Test
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
(0, baseTest_1.test)('United Kingdom Visa Application', async ({ page, waitForCaptcha }) => {
    // ── Captcha listener before nav ──
    const captchaPromise = waitForCaptcha(page);
    // ── Open application page directly ──
    await page.goto('https://united-kingdom-visa.com/apply-eta/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // ── General details ──
    await page.getByRole('textbox', { name: 'name' })
        .fill('testing');
    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .locator('div')
        .nth(1)
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('india');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'phone' })
        .fill('98765 43214');
    await page.locator('#nationality_gen')
        .selectOption('29');
    // ── Date fields (Using exact date methods) ──
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);
    // ── Fill captcha ──
    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);
    // ── Register ──
    await page.getByRole('button', { name: 'Register' })
        .click();
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();
    // ── Applicant details ──
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');
    // Date of Birth (Auto-calculated: 25 years old)
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);
    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');
    await page.locator('#pass_no_0')
        .fill('testing');
    await page.locator('#not_above_house_no_0')
        .fill('testing');
    // await page.locator('#occup_terr_purpose_0')
    //     .fill('testing');
    // Passport Expiry Date (Auto-calculated: 5 years ahead)
    const passExp = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    // ── Submit & Preview ──
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    // ── Confirm & Submit ──
    await page.getByRole('button', { name: 'Confirm & Submit' })
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
        // UK site specifically shows the uploaded filename with a checkmark
        await (0, baseTest_1.expect)(sectionLocator)
            .toContainText('✓ 10kb.jpg', { timeout: 15000 });
        console.log(`Uploaded: ${section.replace(/_/g, ' ')}`);
    }
    // ── Save & Continue ──
    await page.getByRole('button', { name: 'Save & Continue' })
        .click();
    // ── Final assertions ──
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Pay Application Fee' })).toBeVisible({ timeout: 30000 });
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    // ── Payment URL auto-captured by baseTest afterEach ──
    console.log(`\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`);
});
//# sourceMappingURL=united-kingdom-visa.spec.js.map