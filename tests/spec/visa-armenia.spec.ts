import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('Armenia Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://visa-armenia.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
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
        .fill('79845 63129');

    await page.locator('#nationality_gen')
        .selectOption('78');


    // =====================================
    // 4. DATES
    // =====================================

    const arrival = getArrivalDate();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);


    // =====================================
    // 5. CAPTCHA
    // =====================================

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);


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
    }).fill('testing');

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    await page.locator('#pass_no_0')
        .fill('testing');
    await page.locator('#occupation_0')
        .selectOption('ENGINEER');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#ref_add_in_0')
        .fill('testing');
    await page.locator('#ref_phone_in_0')
        .fill('testing');


    // =====================================
    // 8. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    
    try {
        await page.getByRole('button', { name: 'Submit & Preview' })
            .click();
    } catch {
        console.log('Second Submit & Preview not found or handled');
    }


    // =====================================
    // 9. UPLOAD FILES
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    // Upload Passport
    await page.locator('[id^="passport_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="passport_result_"]').getByText('Document has been uploaded!'))
        .toBeVisible({ timeout: 30000 });

    // Upload Photo
    await page.locator('[id^="photo_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="photo_result_"]').getByText('Document has been uploaded!'))
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
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible({ timeout: 30000 });

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});