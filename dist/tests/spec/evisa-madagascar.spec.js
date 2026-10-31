"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Madagascar Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://evisa-madagascar.it.com/apply-evisa/');
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
    await page.getByLabel('Nationality *')
        .selectOption('41');
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);
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
    await page.locator('#pass_no_0')
        .fill('111');
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');
    await page.locator('#port_of_arrival_0')
        .selectOption('457');
    // =====================================
    // UPLOAD FILE
    // =====================================
    const uploadFile = getUploadFile();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.first().setInputFiles(uploadFile);
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
    // PAYMENT
    // =====================================
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Pay Application Processing Fee' })).toBeVisible();
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
});
//# sourceMappingURL=evisa-madagascar.spec.js.map