"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Ethiopia Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://ethiopia-e-visa.com/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // GENERAL DETAILS
    // =====================================
    await page.getByRole('textbox', { name: 'Full Name *' })
        .fill('testing');
    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('9876543210');
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Arrival year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival month')
        .selectOption(arrival.month);
    await page.getByLabel('Arrival day')
        .selectOption(arrival.day);
    await page.locator('#nationality_gen')
        .selectOption('40');
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
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#occupation_0')
        .selectOption('MEDIA');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#accommodation_phone_0')
        .fill('9876543210');
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
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    // =====================================
    // UPLOAD FILE
    // =====================================
    const uploadFile = getUploadFile();
    await page.locator('[id^="passport_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.getByText('✓ Uploaded')).toBeVisible();
    await page.locator('[id^="photo_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.locator('[id^="photo_form_"]').getByText('✓ Uploaded')).toBeVisible();
    // =====================================
    // PAYMENT
    // =====================================
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
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Pay Application Processing Fee' })).toBeVisible();
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
});
//# sourceMappingURL=ethiopia-e-visa.spec.js.map