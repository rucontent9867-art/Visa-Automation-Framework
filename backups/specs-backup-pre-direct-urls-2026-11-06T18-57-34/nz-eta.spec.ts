import { test, expect, capturescreenshot } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('New Zealand eTA Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://nz-eta.info/registration/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.locator('#name')
        .fill('Abhi');

    await page.locator('#email_id')
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' }).locator('div').nth(1).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('ind');
    await page.getByRole('option', { name: 'India +' }).click();
    // await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' }).click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' }).fill('98765 43214');


    // =====================================
    // 4. DATES
    // =====================================

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);

    const departure = getDepartureDate();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);
    await page.locator('#day_departure')
        .selectOption(departure.day);

    await page.locator('#nationality_gen')
        .selectOption('45');


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

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' })
        .click();
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
    }).fill('Abhi');

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#passport_issue_country_0')
        .selectOption('44');

    const passIssue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(passIssue.day);

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    await page.locator('#city_of_birth_0')
        .fill('na');
    await page.locator('#citizenship_id_0')
        .fill('na');


    // =====================================
    // 8. SUBMIT & NAVIGATE TO UPLOAD
    // =====================================

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'applicant-detail');
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }
    await page.getByRole('button', { name: 'Submit & Preview' })
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
    await expect(page.locator('[id^="passport_form_"]').getByText('✓ Uploaded'))
        .toBeVisible({ timeout: 30000 });

    // Upload Photo
    await page.locator('[id^="photo_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="photo_form_"]').getByText('✓ Uploaded'))
        .toBeVisible({ timeout: 30000 });


    // =====================================
    // 10. SAVE & CONTINUE
    // =====================================

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 11. PAYMENT
    // =====================================

    await expect(
        page.getByRole('heading', { name: 'Pay Visa Processing Fee' })
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