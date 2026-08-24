import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('Thailand Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://thai-evisa.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'name' })
        .fill('Abhijeet');

    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'phone' })
        .fill('78945 62139');


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
        .selectOption('59');


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

    await page.locator('#pass_no_0')
        .fill('111');

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);

    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    const passIssue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(passIssue.day);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('na');
    await page.locator('#occupation_0')
        .selectOption('LAWYER');
    await page.locator('#not_above_house_no_0')
        .fill('na');
    await page.locator('#employer_name_0')
        .fill('nan');
    await page.locator('#annual_income_0')
        .fill('na');
    await page.locator('#emp_designation_0')
        .fill('na');


    // =====================================
    // 8. TRAVEL DETAILS
    // =====================================

    await page.getByRole('button', { name: 'Next' })
        .click();

    await page.locator('#appli_country_0')
        .selectOption('56');
    await page.locator('#airline_0')
        .fill('na');
    await page.locator('#flight_no_0')
        .fill('na');
    await page.locator('#obtaining_visa_place_0')
        .selectOption('France- Paris');
    await page.locator('#accommodation_email_0')
        .fill('na');


    // =====================================
    // 9. ACCOMMODATION
    // =====================================

    await page.getByRole('button', { name: 'Next' })
        .click();

    await page.locator('#accomodation_address_0')
        .fill('na');
    await page.locator('#accomodation_zip_code_0')
        .fill('na');
    await page.locator('#accommodation_phone_0')
        .fill('na');


    // =====================================
    // 10. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // =====================================
    // 11. NAVIGATE TO UPLOAD
    // =====================================

    //await page.goto('https://thai-evisa.info/document-upload/VEgwODQ0Mzk1TUJZ/');


    // =====================================
    // 12. UPLOAD FILES
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport',
        'photo',
        'travel_itinerary',
        'hotel_booking',
        'funds',
        'tin_certificate',
        'visit_confirming'
    ];

    for (const section of uploadSections) {
        await page.locator(`[id^="${section}_form_"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await expect(page.locator(`[id^="${section}_result_"]`).getByText('Document has been uploaded!'))
            .toBeVisible({ timeout: 30000 });
    }

    await page.reload();
    // =====================================
    // 13. SAVE & CONTINUE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // =====================================
    // 14. PAYMENT
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