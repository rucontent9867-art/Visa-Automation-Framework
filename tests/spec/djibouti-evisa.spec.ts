import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('Djibouti Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://online.djibouti-evisa.com/apply-evisa/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.locator('#name')
        .fill('Abhijeet');

    await page.locator('#email_id')
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Contact/WhatsApp Number' })
        .fill('98765 43214');


    // =====================================
    // 4. DATES
    // =====================================

    const arrival = getArrivalDate();
    await page.getByLabel('Arrival year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival month')
        .selectOption(arrival.month);
    await page.getByLabel('Arrival day')
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('42');


    // =====================================
    // 5. CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.getByRole('textbox', { name: 'Captcha' })
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

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('na');

    await page.locator('#pass_no_0')
        .fill('111');

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    await page.locator('#occupation_0')
        .selectOption('LAWYER');
    await page.locator('#not_above_house_no_0')
        .fill('na');
    await page.locator('#not_above_city_0')
        .fill('na');
    await page.locator('#accomodation_address_0')
        .fill('na');


    // =====================================
    // 8. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();


    // =====================================
    // 9. UPLOAD FILES
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    // Upload Passport
    await page.locator('[id^="passport_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="passport_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Photo (Note: Uses #Layer_1 instead of #XMLID_86_ path based on your snippet)
    await page.locator('[id^="photo_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="photo_delete_"] #Layer_1'))
        .toBeVisible({ timeout: 30000 });

    // Upload Travel Itinerary
    await page.locator('[id^="travel_itinerary_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="travel_itinerary_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Hotel Booking
    await page.locator('[id^="hotel_booking_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="hotel_booking_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });


    // =====================================
    // 10. SAVE & CONTINUE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // =====================================
    // 11. PAYMENT
    // =====================================

    await expect(
        page.getByRole('heading', { name: 'Pay Your Application Fee' })
    ).toBeVisible({ timeout: 30000 });

    await expect(
        page.getByRole('heading', { name: 'Application Detail' })
    ).toBeVisible();

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});