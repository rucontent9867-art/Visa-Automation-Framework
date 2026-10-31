"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
(0, baseTest_1.test)('E-Visa Application', async ({ page, waitForCaptcha }) => {
    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // NAVIGATE
    // =====================================
    await page.goto('https://cambodia-evisa.info/apply-evisa/');
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
        .selectOption('38');
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
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#gender_0')
        .selectOption('Other');
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
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);
    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#state_0')
        .fill('testing');
    await page.locator('#occupation_0')
        .selectOption('MEDIA');
    await page.locator('#accomodation_address_0')
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
    // Passport
    const passportInput = page.locator('[id^="passport_form_"] input[type="file"]');
    await passportInput.setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.locator('[id^="passport_result_"]').getByText('Document has been uploaded!')).toBeVisible();
    // Photo
    const photoInput = page.locator('[id^="photo_form_"] input[type="file"]');
    await photoInput.setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.locator('[id^="photo_result_"]').getByText('Document has been uploaded!')).toBeVisible();
    // Flight itinerary
    const flightInput = page.locator('[id^="flight_itinerary_form_"] input[type="file"]');
    await flightInput.setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.locator('[id^="flight_itinerary_result_"]').getByText('Document has been uploaded!')).toBeVisible();
    // Hotel booking
    const hotelInput = page.locator('[id^="hotel_booking_form_"] input[type="file"]');
    await hotelInput.setInputFiles(uploadFile);
    await (0, baseTest_1.expect)(page.locator('[id^="hotel_booking_result_"]').getByText('Document has been uploaded!')).toBeVisible();
    // =====================================
    // PAYMENT
    // =====================================
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' })
        .click({
        modifiers: ['ControlOrMeta']
    });
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    await (0, baseTest_1.expect)(page.getByRole('heading', { name: 'Pay Processing Fee' })).toBeVisible();
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
});
//# sourceMappingURL=cambodia-evisa.spec.js.map