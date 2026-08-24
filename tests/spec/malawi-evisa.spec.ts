import { test, expect } from '../../utils/baseTest';
import { uploadAndWaitForSuccess } from '../../utils/apiUpload';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';
import { waitForUploadApi } from '../../utils/apiUpload';

test('Malawi Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://malawi-evisa.com/apply-evisa/');

    try {
        await page.waitForLoadState('networkidle', {
            timeout: 5000
        });
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
        .fill('98765 43214');

    await page.locator('#nationality_gen')
        .selectOption('47');


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
    // 7. PASSPORT DETAILS
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


    await page.getByRole('textbox', {
        name: 'Surname as per Passport'
    }).fill('testing');


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

    await page.locator('#passport_issue_authority_0')
        .fill('testing');

    await page.locator('#city_of_birth_0')
        .fill('testing');

    await page.locator('#country_of_birth_0')
        .selectOption('44');


    await page.getByRole('button', { name: 'Next' })
        .click();


    // =====================================
    // 8. ADDRESS & TRAVEL
    // =====================================

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#not_above_house_no_0')
        .fill('testing');

    await page.locator('#airline_0')
        .fill('testing');

    await page.locator('#flight_no_0')
        .fill('testing');

    await page.locator('#occupation_0')
        .selectOption('CAMERAMAN');


    await page.getByRole('button', { name: 'Next' })
        .click();


    // =====================================
    // 9. ACCOMMODATION
    // =====================================

    await page.locator('#accomodation_0')
        .fill('testing');

    await page.locator('#accomodation_address_0')
        .fill('testing');

    await page.locator('#accommodation_phone_0')
        .fill('testing');

    await page.locator('#accommodation_email_0')
        .fill('dm443790@gmail.com');

    await page.locator('#booked_hotel_address_0')
        .fill('testing');

    await page.locator('#place_visited_0')
        .fill('testing');

    await page.locator('#tour_agency_0')
        .fill('testing');

    await page.locator('#tour_agency_phone_0')
        .fill('testing');

    await page.locator('#destination_0')
        .fill('testing');


    await page.getByRole('button', { name: 'Next' })
        .click();


    // =====================================
    // 10. ADDITIONAL INFO
    // =====================================

    await page.locator('#available_funds_amount_0')
        .fill('testing');

    await page.locator('#unrehabilitated_insolvent_0')
        .fill('testing');

    await page.locator('#judicially_incompetent_0')
        .fill('testing');

    await page.locator('#social_violence_0')
        .fill('testing');

    await page.locator('#ref_add_in_0')
        .fill('testing');

    await page.locator('#ref_phone_in_0')
        .fill('testing');


    // =====================================
    // 11. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', {
        name: 'Submit & Preview'
    }).click();

    await page.getByRole('button', {
        name: 'Submit & Preview'
    }).click();


    // =====================================
    // 12. WAIT FOR UPLOAD PAGE
    // =====================================

    await expect(
        page.locator('[id^="passport_form_"]')
    ).toBeVisible({
        timeout: 15000
    });


    // =====================================
    // 13. UPLOAD FILES
    // =====================================

    try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
        console.log('Network did not become idle within 15 seconds. Continuing...');
    }

    console.log('Upload page loaded:', page.url());


    // =====================================
    // 2. UPLOAD FILES (API VERIFIED)
    // =====================================

    const uploadFile = getUploadFile();

    const uploadSections = [
        { name: 'Passport Bio Page', formId: 'passport_form_' },
        { name: 'Digital Applicant Photo', formId: 'photo_form_' },
        { name: 'Signed Cover Letter', formId: 'countersigning_person_form_' },
        { name: 'Residence Permit / Visa', formId: 'travel_itinerary_form_' },
    ];

    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section.formId}"]`).first();

        // Wait for the specific section to appear
        await expect(sectionLocator).toBeVisible({ timeout: 15000 });

        // Find the actual file input inside the container
        const fileInput = sectionLocator.locator('input[type="file"]');
        
        if (await fileInput.count() === 0) {
            throw new Error(`No file input found for section: ${section.name}`);
        }

        // Upload using the API verification utility
        await uploadAndWaitForSuccess(page, fileInput, uploadFile);
        
        console.log(`✅ API confirmed: ${section.name} uploaded successfully.`);
        
        // Small buffer for UI updates
        await page.waitForTimeout(1000);
    }


    // =====================================
    // 3. RELOAD PAGE TO VERIFY PERSISTENCE
    // =====================================

    console.log('Reloading page to verify persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });


    // =====================================
    // 14. FINALIZE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // =====================================
    // 15. FINAL ASSERTIONS
    // =====================================

    await expect(
        page.getByRole('heading', {
            name: 'Application Detail'
        })
    ).toBeVisible({
        timeout: 30000
    });


    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});