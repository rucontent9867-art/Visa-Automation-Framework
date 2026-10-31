"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Cameroon Visa Application', async ({ page, waitForCaptcha }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://cameroon-visa.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // GENERAL DETAILS
    // =====================================
    await page.locator('#name')
        .fill('testing');
    await page.locator('#email_id')
        .fill('dm443790@gmail.com');
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .click();
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('india');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .fill('9876543210');
    const arrival = (0, date_1.getArrivalDate)();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);
    await page.locator('#nationality_gen')
        .selectOption('42');
    await page.locator('#chk')
        .click();
    // =====================================
    // CAPTCHA
    // =====================================
    const captcha = await captchaPromise;
    await page.locator('#chk')
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
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#occupation_0')
        .selectOption('CHARITY-SOCIAL WORKER');
    await page.locator('#not_above_house_no_0')
        .fill('testing');
    await page.locator('#purpose_of_visit_0')
        .selectOption('Mission');
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
    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // UPLOAD FILE
    // =====================================
    const uploadFile = (0, baseTest_1.getUploadFile)();
    const uploadSections = [
        'passport_form_',
        'round_ticket_form_',
        'vaccine_certificate_form_',
        'hotel_booking_form_',
        'funds_form_',
        'business_invitation_form_'
    ];
    for (const section of uploadSections) {
        await page.locator(`[id^="${section}"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await (0, baseTest_1.expect)(page.locator(`[id^="${section}"]`))
            .toContainText('✓ Uploaded');
    }
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
    console.log(`\n================ PAYMENT PAGE URL ================\n${page.url()}\n====================================================\n`);
});
//# sourceMappingURL=cameroon-visa.spec.js.map