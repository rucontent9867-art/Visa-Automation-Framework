"use strict";
/**
 * Azerbaijan Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
const path_1 = __importDefault(require("path"));
(0, baseTest_1.test)('Azerbaijan Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE (triggers captcha API call)
    // =====================================
    await page.goto('https://azerbaijan-visa.info/apply/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // GENERAL DETAILS
    // (Fill while captcha loads in background)
    // =====================================
    await page.getByRole('textbox', { name: 'name' })
        .fill('testing');
    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .locator('div')
        .nth(1)
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
    await page.locator('#nationality_gen')
        .selectOption('61');
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
    // Wait for passport form
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
    await page.getByRole('textbox', {
        name: 'Surname as per Passport'
    }).fill('testing');
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#travel_document_0')
        .selectOption('Diplomatic passport');
    await page.locator('#occupation_0')
        .selectOption('MILITARY');
    await page.locator('#not_above_house_no_0')
        .fill('testing');
    // =====================================
    // UPLOAD FILE
    // =====================================
    const uploadFile = getUploadFile();
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFile);
    }
    else {
        await page.getByRole('button', {
            name: 'Choose File'
        }).setInputFiles(uploadFile);
    }
    // Wait for upload success
    const fileName = path_1.default.basename(uploadFile);
    await (0, baseTest_1.expect)(fileInput.first()).toHaveValue(new RegExp(fileName.replace('.', '\\.')));
    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 1: DOCUMENT UPLOAD
    // Verify /visa-status/ and /complete-partially/ in separate tabs before submit
    // =========================================================================
    let orderId = (await page.locator('#order_id_spn, #order_id, input[name="order_id"]').textContent().catch(() => ''))?.trim() || '';
    await (0, baseTest_1.verifyDirectUrls)(page, {
        orderId,
        stageName: 'document-upload',
        urls: [
            'https://azerbaijan-visa.info/visa-status/',
            'https://azerbaijan-visa.info/complete-partially/'
        ],
        waitForCaptcha
    });
    // =====================================
    // PREVIEW
    // =====================================
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'applicant-detail');
    await page.getByRole('button', {
        name: 'Submit & Preview'
    }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    await (0, baseTest_1.expect)(page.locator('#order_id_spn')).toBeVisible();
    // Copy extracted Order ID from Preview page
    orderId = (await page.locator('#order_id_spn').textContent().catch(() => ''))?.trim() || orderId;
    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 2: PREVIEW PAGE
    // Verify /visa-status/ and /complete-partially/ in separate tabs before submit
    // =========================================================================
    await (0, baseTest_1.verifyDirectUrls)(page, {
        orderId,
        stageName: 'preview',
        urls: [
            'https://azerbaijan-visa.info/visa-status/',
            'https://azerbaijan-visa.info/complete-partially/'
        ],
        waitForCaptcha
    });
    // =====================================
    // PAYMENT
    // =====================================
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'preview');
    await page.getByRole('button', {
        name: 'Confirm & Submit'
    }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    await (0, baseTest_1.expect)(page.getByRole('heading', {
        name: 'Pay Visa Processing Fee'
    })).toBeVisible();
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    await (0, baseTest_1.expect)(page.getByRole('heading', {
        name: 'Application Detail'
    })).toBeVisible();
    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 3: PAYMENT PAGE
    // Verify /visa-status/ and /complete-partially/ in separate tabs at payment stage
    // =========================================================================
    await (0, baseTest_1.verifyDirectUrls)(page, {
        orderId,
        stageName: 'payment',
        urls: [
            'https://azerbaijan-visa.info/visa-status/',
            'https://azerbaijan-visa.info/complete-partially/'
        ],
        waitForCaptcha
    });
    // =====================================
    // PAYMENT URL IS AUTO-CAPTURED
    // by baseTest.ts afterEach hook
    // (page.url() at this point = payment URL)
    // =====================================
    console.log(`\n================ PAYMENT PAGE URL ================\n${page.url()}\n====================================================\n`);
});
//# sourceMappingURL=azerbaijan-visa.spec.js.map