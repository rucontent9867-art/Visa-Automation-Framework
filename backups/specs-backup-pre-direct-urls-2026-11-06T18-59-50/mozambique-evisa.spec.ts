import { test, expect, capturescreenshot } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDateOfBirth,
    getPassportExpiryDate,
} from '../../utils/date';

test('Mozambique Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://mozambique-evisa.com/apply-now/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'name' }).fill('Abhijeet');
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' }).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('india');
    await page.getByRole('option', { name: 'India +' }).click();

    await page.getByRole('textbox', { name: 'phone' }).fill('78945 61239');


    // =====================================
    // 4. DATES
    // =====================================

    const arrival = getArrivalDate();
    await page.getByLabel('Year').selectOption(arrival.year);
    await page.getByLabel('Mon').selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true }).selectOption(arrival.day);

    await page.locator('#nationality_gen').selectOption('42');


    // =====================================
    // 5. CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.getByRole('textbox', { name: 'Captcha' }).fill(captcha);


    // =====================================
    // 6. REGISTER
    // =====================================

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

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
    }).fill('Abhijeet');

    await page.getByRole('textbox', { name: 'Surname as per Passport' }).fill('na');
    await page.locator('#pass_no_0').fill('111');

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0').selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0').selectOption(passExp.month);

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0').selectOption(dob.year);
    await page.locator('#mon_dob_0').selectOption(dob.month);

    await page.locator('#not_above_house_no_0').fill('na');
    await page.locator('#accommodation_state_0').fill('na');
    await page.locator('#accomodation_zip_code_0').fill('na');
    await page.locator('#accomodation_address_0').fill('na');
    await page.locator('#accommodation_city_0').fill('na');
    await page.locator('#flight_no_0').fill('na');
    await page.locator('#occupation_0').selectOption('JOURNALIST');
    await page.locator('#purpose_of_visit_0').selectOption('Holiday or Vacation');


    // =====================================
    // 8. SUBMIT & PREVIEW
    // =====================================

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'applicant-detail');
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview');
    await page.getByRole('button', { name: 'Confirm & Submit' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 9. UPLOAD FILES
    // =====================================

    await expect(page.locator('[id^="passport_form_"]')).toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'funds_form_',
        'hotel_booking_form_',
        'round_ticket_form_',
    ];

    for (const section of uploadSections) {
        await page.locator(`[id^="${section}"] input[type="file"]`).setInputFiles(uploadFile);
        
        // Scoping the expectation strictly inside the specific form container prevents false positives
        await expect(page.locator(`[id^="${section}"]`).getByText('✓ Uploaded', { exact: true }))
            .toBeVisible({ timeout: 30000 });
    }


    // =====================================
    // 10. SAVE & CONTINUE
    // =====================================

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 11. PAYMENT
    // =====================================

    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});