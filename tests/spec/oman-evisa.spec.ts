import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';
import { waitForUploadApi } from '../../utils/apiUpload';

test('Oman Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://oman-evisa.info/apply-evisa/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (e) {
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
        .fill('india');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'phone' })
        .fill('98765 43214');

    await page.locator('#nationality_gen')
        .selectOption('73');


    // =====================================
    // 4. DATES
    // =====================================

    const departure = getDepartureDate();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);
    await page.locator('#day_departure')
        .selectOption(departure.day);

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);


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
    }).fill('testing');

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    const passIssue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);

    try {
        await page.locator('#day_pass_issue_0')
            .selectOption(passIssue.day);
    } catch (e) {
        console.log('No day dropdown for passport issue');
    }

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    await page.locator('#pass_no_0')
        .fill('111');
    await page.locator('#passport_issue_place_0')
        .fill('testing');
    await page.locator('#city_of_birth_0')
        .fill('testing');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#mother_name_0')
        .fill('testing');


    // =====================================
    // 8. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();


    // =====================================
    // 9. UPLOAD FILES (API VERIFICATION)
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 20000 });

    const uploadFile = getUploadFile();

    const uploadSections = [
        { name: 'Passport Bio Page', formId: 'passport_form_' },
        { name: 'Applicant Digital Photo', formId: 'photo_form_' },
    ];

    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section.formId}"]`);

        // STEP A: Start listening BEFORE triggering file input
        const uploadApiPromise = waitForUploadApi(page, ['upload_temp']);

        // STEP B: Select file silently
        await sectionLocator.locator('input[type="file"]').setInputFiles(uploadFile);

        // STEP C: Await confirmation
        await uploadApiPromise;
        console.log(`[VERIFIED] ${section.name} uploaded successfully.`);

        // STEP D: Buffer for client-side DOM processing
        await page.waitForTimeout(1000);
    }


    // =====================================
    // 10. SAVE & CONTINUE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // =====================================
    // 11. FINAL ASSERTIONS
    // =====================================

    await expect(
        page.getByRole('heading', { name: 'Application Detail' })
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