"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Zimbabwe Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // 2. NAVIGATION
    // =====================================
    await page.goto('https://zimbabwe-visa.com/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch (e) {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // 3. GENERAL DETAILS
    // =====================================
    await page.locator('#name')
        .fill('Abhijeet');
    await page.locator('#email_id')
        .fill('dm443790@gmail.com'); // Fixed typo from .como
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .fill('98765 43214');
    // =====================================
    // 4. DATES
    // =====================================
    const arrival = (0, date_1.getArrivalDate)();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);
    await page.locator('#nationality_gen')
        .selectOption('143');
    // =====================================
    // 5. CAPTCHA
    // =====================================
    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.locator('#chk')
        .fill(captcha);
    // =====================================
    // 6. REGISTER
    // =====================================
    await page.getByRole('button', { name: 'Register' })
        .click();
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();
    // =====================================
    // 7. APPLICANT DETAILS
    // =====================================
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('Abhi');
    await page.locator('#pass_no_0')
        .fill('111');
    const passExp = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);
    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('na');
    await page.locator('#address_0')
        .fill('na');
    await page.locator('#occupation_0')
        .selectOption('MEDIA');
    await page.locator('#marital_status_0')
        .selectOption('Married');
    await page.locator('#host_fullname_0')
        .fill('na');
    await page.locator('#host_address_0')
        .fill('na');
    await page.locator('#emergency_givenname_0')
        .fill('na');
    await page.locator('#emergency_surname_0')
        .fill('na');
    await page.locator('#emergency_phone_0')
        .fill('na');
    await page.locator('#emergency_email_0')
        .fill('na');
    // =====================================
    // 8. SUBMIT & PREVIEW
    // =====================================
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    // =====================================
    // 9. UPLOAD FILES
    // =====================================
    await (0, baseTest_1.expect)(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });
    const uploadFile = getUploadFile();
    const uploadSections = [
        'passport',
        'photo',
        'hotel_booking',
        'host_id',
        'referring_letter'
    ];
    for (const section of uploadSections) {
        await page.locator(`[id^="${section}_form_"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await (0, baseTest_1.expect)(page.locator(`[id^="${section}_delete_"] path`).nth(1))
            .toBeVisible({ timeout: 30000 });
    }
    // =====================================
    // 10. SAVE & CONTINUE
    // =====================================
    await page.getByRole('button', { name: 'Save & Continue' })
        .click();
    // =====================================
    // 11. FINAL ASSERTIONS
    // =====================================
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Application Detail' })).toBeVisible({ timeout: 30000 });
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    console.log(`\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`);
});
//# sourceMappingURL=zimbabwe-visa.spec.js.map