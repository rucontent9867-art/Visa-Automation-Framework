"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('Ecuador Visa Application', async ({ page, waitForCaptcha }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://ecuador-evisa.com/apply-now/');
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
    await page.locator('#nationality_gen')
        .selectOption('190');
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
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    const issue = (0, date_1.getPassportIssueDate)();
    await page.locator('#yr_pass_issue_0')
        .selectOption(issue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(issue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(issue.day);
    const expiry = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#passport_issue_place_0')
        .fill('testing');
    await page.locator('#city_of_birth_0')
        .fill('testing');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#city_0')
        .fill('testing');
    await page.locator('#state_0')
        .fill('testing');
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
    // UPLOAD FILE
    // =====================================
    const uploadFile = (0, baseTest_1.getUploadFile)();
    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'travel_itinerary_form_',
        'event_clearance_form_',
        'funds_form_',
        'company_extract_form_',
        'org_invitation_form_'
    ];
    for (const section of uploadSections) {
        await page.locator(`[id^="${section}"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await (0, baseTest_1.expect)(page.locator(`[id^="${section}"]`))
            .toContainText('Document has been uploaded!');
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
});
//# sourceMappingURL=ecuador-evisa.spec.js.map