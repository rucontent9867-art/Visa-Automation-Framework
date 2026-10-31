"use strict";
/**
 * Jordan Visa Application - E2E Test
 *
 * Uses:
 * - shared baseTest
 * - shared captcha helper
 * - shared date utilities
 * - API-based upload confirmation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const baseTest_1 = require("../../utils/baseTest");
const date_1 = require("../../utils/date");
const apiUpload_1 = require("../../utils/apiUpload");
(0, baseTest_1.test)('Jordan Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {
    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================
    const captchaPromise = waitForCaptcha(page);
    // =====================================
    // 2. OPEN APPLICATION
    // =====================================
    await page.goto('https://jordan-evisa.info/apply/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    catch {
        console.log('Network never went idle, continuing anyway');
    }
    try {
        await page.waitForLoadState('networkidle', {
            timeout: 5000
        });
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
        .fill('97864 53129');
    // =====================================
    // 4. ARRIVAL DATE
    // =====================================
    const arrival = (0, date_1.getArrivalDate)();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);
    // =====================================
    // 5. DEPARTURE DATE
    // =====================================
    const departure = (0, date_1.getDepartureDate)();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);
    await page.locator('#day_departure')
        .selectOption(departure.day);
    // =====================================
    // 6. NATIONALITY
    // =====================================
    await page.locator('#nationality_gen')
        .selectOption('50');
    // =====================================
    // 7. CAPTCHA
    // =====================================
    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);
    // =====================================
    // 8. REGISTER
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
    // 9. APPLICANT DETAILS
    // =====================================
    await (0, baseTest_1.expect)(page.locator('#visa_type_0 option:checked')).toHaveText('Transit eVisa - 72 hours, Single entry');
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');
    // Date of Birth
    const dob = (0, date_1.getDateOfBirth)();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);
    // Surname
    await page.getByRole('textbox', {
        name: 'Surname as per Passport'
    }).fill('testing');
    // Passport number
    await page.locator('#pass_no_0')
        .fill('testing');
    // Passport expiry
    const passExp = (0, date_1.getPassportExpiryDate)();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);
    // Passport issue
    const passIssue = (0, date_1.getPassportIssueDate)();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(passIssue.day);
    // =====================================
    // 10. SUBMIT & PREVIEW
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
    // Sometimes the button clicks twice or changes state
    try {
        await page.getByRole('button', {
            name: 'Submit & Preview'
        }).click();
    }
    catch {
        console.log('Second Submit & Preview skipped or already handled');
    }
    await page.reload();
    try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
    }
    catch {
        console.log('Network idle timeout, continuing...');
    }
    // =====================================
    // 11. WAIT FOR UPLOAD PAGE
    // =====================================
    // Wait for the container to appear
    await (0, baseTest_1.expect)(page.locator('[id^="passport_form_"]')).toBeVisible({
        timeout: 15000
    });
    // =====================================
    // 12. UPLOAD FILE WITH API CONFIRMATION
    // =====================================
    const uploadFile = getUploadFile();
    // Find the passport form container dynamically
    const passportFormContainer = page.locator('[id^="passport_form_"]');
    console.log('Uploading Passport Document...');
    // 1. Find the actual file input element inside the container.
    const fileInput = passportFormContainer.locator('input[type="file"]');
    // Wait for the file input to exist in the DOM
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    if (await fileInput.count() === 0) {
        throw new Error("File input not found in passport form");
    }
    // 2. Start listening for the API response BEFORE triggering the upload
    const uploadApiPromise = (0, apiUpload_1.waitForUploadApi)(page, ['upload_temp', 'upload_final'], 20000 // 20s timeout for the API response
    );
    // 3. Set the file directly on the input element.
    await fileInput.setInputFiles(uploadFile);
    // 4. Wait for API confirmation
    try {
        await uploadApiPromise;
        console.log('✅ API confirmed: Passport upload successful.');
    }
    catch (error) {
        console.error('❌ API upload verification failed:', error);
        throw new Error('Passport upload API verification failed');
    }
    // 5. Verify the UI update (Document has been uploaded!)
    await (0, baseTest_1.expect)(page.getByText('Document has been uploaded!')).toBeVisible({
        timeout: 15000
    });
    console.log('✅ Passport uploaded successfully');
    await page.reload();
    try {
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        }
        catch {
            console.log('Network never went idle, continuing anyway');
        }
    }
    catch {
        console.log('Network idle timeout after reload, continuing...');
    }
    // =====================================
    // 13. SAVE & CONTINUE
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
    // 14. FINAL ASSERTIONS
    // =====================================
    await (0, baseTest_1.expect)(page.getByRole('heading', {
        name: 'Application Detail'
    })).toBeVisible({
        timeout: 30000
    });
    await page.waitForTimeout(1000);
    await (0, baseTest_1.capturescreenshot)(page, 'payment-page');
    await (0, baseTest_1.expect)(page.getByText('dm443790@gmail.com')).toBeVisible();
    // =====================================
    // 15. PAYMENT URL
    // =====================================
    console.log(`\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`);
});
//# sourceMappingURL=jordan-evisa.spec.js.map