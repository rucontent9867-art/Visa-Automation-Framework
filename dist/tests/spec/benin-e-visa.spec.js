"use strict";
/**
 * Benin Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const path_1 = __importDefault(require("path"));
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Benin Visa Application', async ({ page, waitForCaptcha }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://benin-e-visa.com/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // GENERAL DETAILS
    // =====================================
    await page.getByRole('textbox', { name: 'name' })
        .fill('testing');
    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'phone' })
        .fill('9876543210');
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);
    await page.locator('#nationality_gen')
        .selectOption('41');
    // =====================================
    // CAPTCHA
    // =====================================
    const captcha = await captchaPromise;
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captcha);
    // =====================================
    // REGISTER
    // =====================================
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
    // =====================================
    // PASSPORT
    // =====================================
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');
    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#occupation_0')
        .selectOption('JOURNALIST');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#appli_country_0')
        .selectOption('44');
    await page.locator('#depart_country_0')
        .selectOption('45');
    await page.locator('#purpose_of_visit_0')
        .selectOption('SUMMER CAMP');
    await page.locator('#return_ticket_0')
        .fill('testing');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#maintenance_means_0')
        .fill('testing');
    await page.locator('#destination_0')
        .fill('testing');
    // =====================================
    // UPLOAD FILE
    // =====================================
    const uploadFile = (0, baseTest_1.getUploadFile)();
    const fileName = path_1.default.basename(uploadFile);
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFile);
    }
    else {
        await page.getByRole('button', { name: 'Choose File' })
            .setInputFiles(uploadFile);
    }
    await (0, baseTest_1.expect)(fileInput.first()).toHaveValue(new RegExp(fileName.replace('.', '\\.')));
    // =====================================
    // PREVIEW
    // =====================================
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
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'preview');
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // PAYMENT
    // =====================================
    await (0, baseTest_1.expect)(page.getByRole('heading', {
        name: 'Pay Application Processing Fee'
    })).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    console.log(`\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`);
});
//# sourceMappingURL=benin-e-visa.spec.js.map