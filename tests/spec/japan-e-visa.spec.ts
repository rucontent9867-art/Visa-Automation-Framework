import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';

test('Japan Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://japan-e-visa.info/registration/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Name *' })
        .fill('Abhijeet');

    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');

    // =====================================
    // COUNTRY CODE & PHONE
    // =====================================

    await page.getByRole('combobox', { name: 'Selected country' }).locator('div').nth(1).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('IND');
    await page.getByRole('option', { name: 'India +' }).click();
    await page.getByRole('textbox', { name: 'Phone *' }).click();

    await page.getByRole('textbox', { name: 'Phone *' }).fill('9876543210');



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
        
    try {
        await page.locator('#day_departure')
            .selectOption(departure.day);
    } catch {
        console.log('No day dropdown for departure, skipping');
    }

    await page.getByLabel('Nationality *')
        .selectOption('56');


    // =====================================
    // 5. CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.getByRole('textbox', { name: 'Please enter text from Image*' })
        .fill(captcha);


    // =====================================
    // 6. REGISTER
    // =====================================

    await page.getByRole('button', { name: 'Register' })
        .click();

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .waitFor();


        // =====================================
    // 7. PERSONAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .fill('nnnna');

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('na');

    await page.locator('#yr_dob_0').selectOption('2009');
    await page.locator('#mon_dob_0').selectOption('10');
    await page.locator('#day_dob_0').selectOption('15');

    await page.locator('#yr_pass_issue_0').selectOption('2008');
    await page.locator('#mon_pass_issue_0').selectOption('11');
    await page.locator('#day_pass_issue_0').selectOption('17');

    await page.locator('#yr_pass_exp_0').selectOption('2043');
    await page.locator('#mon_pass_exp_0').selectOption('10');
    await page.locator('#day_pass_exp_0').selectOption('18');

    await page.locator('#pass_no_0').fill('111');
    await page.locator('#previous_givenname_0').fill('na');
    await page.locator('#previous_surname_0').fill('na');
    await page.locator('#city_of_birth_0').fill('na');

    await page.locator('#acquire_nationality_0').selectOption('28');

    await page.locator('#passport_issue_authority_0').fill('na');
    await page.locator('#passport_issue_place_0').fill('na');

    await page.getByRole('button', { name: 'Next' }).click();


    // =====================================
    // 8. TRAVEL DETAILS
    // =====================================

    await page.locator('#occupation_0').selectOption('MEDIA');
    await page.locator('#employer_name_0').fill('na');
    await page.locator('#emp_address_0').fill('na');
    await page.locator('#address_0').fill('na');
    await page.locator('#emp_phone_0').fill('na');
    await page.locator('#address_stay_year_0').selectOption('Taiwan');
    await page.locator('#flight_no_0').fill('na');

    await page.getByRole('button', { name: 'Next' }).click();


    // =====================================
    // 9. STAY DETAILS
    // =====================================

    await page.locator('#accomodation_0').fill('na');
    await page.locator('#destination_0').fill('na');
    await page.locator('#accomodation_address_0').fill('na');
    await page.locator('#accommodation_phone_0').fill('na');

    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    
    // =====================================
    // 10. UPLOAD FILES
    // =====================================

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'flight_itinerary_form_',
        'travel_itinerary_form_',
        'funds_form_',
        'hotel_booking_form_',
        'driving_license_form_',
        'note_verbale_form_',
        'tin_certificate_form_'
    ];

    for (const section of uploadSections) {
        const container = page.locator(`[id^="${section}"]`);
        
        if (!(await container.isVisible())) {
            console.log(`Skipping ${section}: Not visible`);
            continue;
        }

        // Directly target hidden input to prevent OS folder popup
        await container.locator('input[type="file"]')
            .setInputFiles(uploadFile);
            
        await expect(container.getByText('✓ Uploaded'))
            .toBeVisible({ timeout: 15000 });
            
        console.log(`✓ Uploaded: ${section}`);
    }


    // =====================================
    // 11. FINALIZE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();

    await expect(
        page.getByRole('heading', { name: 'Pay Visa Processing Fee' })
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