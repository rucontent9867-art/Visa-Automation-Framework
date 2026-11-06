import { test, expect, capturescreenshot } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('South Africa Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://sa-evisa.com/registration/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Name' })
        .fill('testing');

    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('india');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('98765 43214');


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
    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);
    await page.getByLabel('Date of Arrival *')
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('123');


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

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'registration-page');
    await page.getByRole('button', { name: 'Register' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .waitFor();


    // =====================================
    // 7. APPLICANT DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .fill('testing');

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

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

    await page.locator('#pass_no_0')
        .fill('testing');
    await page.locator('#edu_qualification_0')
        .selectOption('GRADUATE');
    await page.locator('#appli_country_0')
        .selectOption('46');
    await page.locator('#occupation_0')
        .selectOption('NAVY');
    await page.locator('#address_0')
        .fill('testing');

    await page.getByRole('button', { name: 'Next' })
        .click();


    // =====================================
    // 8. EMPLOYMENT & FAMILY
    // =====================================

    await page.locator('#employer_name_0')
        .fill('testing');
    await page.locator('#emp_address_0')
        .fill('testing');
    await page.locator('#emp_phone_0')
        .fill('testing');
    await page.locator('#emp_joining_date_0')
        .fill('01-01-2020');
    await page.locator('#reason_for_travel_0')
        .fill('testing');
    await page.locator('#depart_place_for_visit_0')
        .fill('testing');
    await page.locator('#port_of_arrival_0')
        .selectOption('249');

    await page.locator('#father_birth_country_0')
        .selectOption('28');
    await page.locator('#father_nationality_0')
        .selectOption('44');
    await page.locator('#father_name_0')
        .fill('testing');
    await page.locator('#father_prev_nationality_0')
        .selectOption('44');

    await page.locator('#mother_name_0')
        .fill('testing');
    await page.locator('#mother_birth_country_0')
        .selectOption('28');
    await page.locator('#mother_nationality_0')
        .selectOption('28');
    await page.locator('#mother_prev_nationality_0')
        .selectOption('44');

    await page.getByRole('button', { name: 'Next' })
        .click();


    // =====================================
    // 9. REFERENCES & FUNDS
    // =====================================

    await page.locator('#ref_name_cn_0')
        .fill('testing');
    await page.locator('#your_contry_phone_0')
        .fill('testing');
    await page.locator('#your_contry_address_0')
        .fill('testing');
    await page.locator('#ref_name_in_0')
        .fill('testing');
    await page.locator('#ref_phone_in_0')
        .fill('testing');
    await page.locator('#ref_add_in_0')
        .fill('testing');
    await page.locator('#available_funds_amount_0')
        .fill('testing');


    // =====================================
    // 10. SUBMIT & PREVIEW
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
    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview');
    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 11. UPLOAD FILES & CONFIRM
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    // Upload Passport
    await page.locator('[id^="passport_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="passport_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Flight Itinerary
    await page.locator('[id^="flight_itinerary_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="flight_itinerary_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Visit Confirming
    await page.locator('[id^="visit_confirming_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="visit_confirming_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Funds
    await page.locator('[id^="funds_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="funds_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Upload Vaccine Certificate
    await page.locator('[id^="vaccine_certificate_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.locator('[id^="vaccine_certificate_delete_"] #XMLID_86_ path'))
        .toBeVisible({ timeout: 30000 });

    // Reload and verify uploaded documents persist
    await page.reload();
    await expect(page.locator('div').filter({ hasText: /^Passport Bio Page Scan$/ })).toBeVisible();
    await expect(page.locator('div').filter({ hasText: /^Flight Itinerary Or Booking$/ })).toBeVisible();
    await expect(page.getByText('Purpose and Duration of Visit').nth(1)).toBeVisible();
    await expect(page.locator('div').filter({ hasText: /^3 Months Certified Bank Statement$/ })).toBeVisible();
    await expect(page.locator('div').filter({ hasText: /^Yellow Fever Vaccination Certificate$/ })).toBeVisible();


    // =====================================
    // 12. SAVE & CONTINUE
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
    // 13. PAYMENT
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