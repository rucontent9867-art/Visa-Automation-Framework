"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
const apiUpload_1 = require("../../utils/apiUpload");
(0, baseTest_1.test)('Ivory Coast Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // 2. NAVIGATION
    // =====================================
    await page.goto('https://ivory-coast-evisa.info/registration/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // 3. GENERAL DETAILS
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
    await page.locator('#nationality_gen')
        .selectOption('56');
    // =====================================
    // 4. DATES
    // =====================================
    const arrival = (0, date_1.getArrivalDate)();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    try {
        await page.getByLabel('Day', { exact: true })
            .selectOption(arrival.day);
    }
    catch {
        console.log('No Day dropdown for arrival found');
    }
    // =====================================
    // 5. CAPTCHA
    // =====================================
    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captcha);
    // =====================================
    // 6. REGISTER & PASSPORT DETAILS
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
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');
    await page.locator('#pass_no_0')
        .fill('111');
    const passExp = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#occupation_0')
        .selectOption('LAWYER');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    // =====================================
    // 7. SUBMIT & PREVIEW
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
    // =====================================
    // 8. UPLOAD FILES - API VERIFICATION
    // =====================================
    await (0, baseTest_1.expect)(page.locator('[id^="passport_form_"]')).toBeVisible({ timeout: 15000 });
    const uploadFile = getUploadFile();
    const uploadSections = [
        {
            name: 'Passport',
            formId: 'passport_form_'
        },
        {
            name: 'Travel Itinerary',
            formId: 'travel_itinerary_form_'
        },
        {
            name: 'Hotel Booking',
            formId: 'hotel_booking_form_'
        }
    ];
    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section.formId}"]`).first();
        // Make sure this upload section exists
        await (0, baseTest_1.expect)(sectionLocator)
            .toBeVisible({ timeout: 15000 });
        // -------------------------------------
        // STEP 1: Start API listener FIRST
        // -------------------------------------
        const uploadApiPromise = (0, apiUpload_1.waitForUploadApi)(page, ['upload_temp'], 20000);
        // -------------------------------------
        // STEP 2: Select the file
        // -------------------------------------
        await sectionLocator
            .locator('input[type="file"]')
            .setInputFiles(uploadFile);
        // -------------------------------------
        // STEP 3: Wait for API SUCCESS
        // -------------------------------------
        await uploadApiPromise;
        // -------------------------------------
        // STEP 4: Upload confirmed
        // -------------------------------------
        console.log(`[VERIFIED] ${section.name} uploaded successfully.`);
        // Give the website UI a moment to update
        await page.waitForTimeout(1000);
    }
    // =====================================
    // 9. FINALIZE
    // =====================================
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'doc-page');
    await page.getByRole('button', {
        name: 'Save & Continue'
    }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    // =====================================
    // 10. FINAL ASSERTIONS
    // =====================================
    await (0, baseTest_1.expect)(page.getByRole('heading', {
        name: 'Application Detail'
    })).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    // =====================================
    // PAYMENT / CONFIRMATION URL
    // =====================================
    console.log(`\n================ PAYMENT/CONFIRM PAGE URL ================\n` +
        `${page.url()}\n` +
        `===========================================================\n`);
});
//# sourceMappingURL=ivory-coast.spec.js.map