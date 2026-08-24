import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';
import { waitForUploadApi } from '../../utils/apiUpload';

test('ESTA Online Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://esta-online.it.com/apply-now/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // GENERAL DETAILS
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
        .fill('87945 61239');

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
        .selectOption('126');


    // =====================================
    // CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    console.log('Decoded CAPTCHA:', captcha);
    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captcha);


    // =====================================
    // REGISTER
    // =====================================

    await page.getByRole('button', { name: 'Register' })
        .click();

    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();


    // =====================================
    // APPLICANT DETAILS
    // =====================================

    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
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
    await page.locator('#city_of_birth_0')
        .fill('testing');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#city_0')
        .fill('testing');
    await page.locator('#state_0')
        .fill('testing');
    await page.locator('#occupation_0')
        .selectOption('MEDIA');

    await page.locator('#employer_name_0')
        .fill('testing');
    await page.locator('#emp_address_0')
        .fill('testing');
    await page.locator('#emp_phone_0')
        .fill('testing');
    await page.locator('#father_name_0')
        .fill('testing');
    await page.locator('#mother_name_0')
        .fill('testing');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#accommodation_city_0')
        .fill('testing');
    await page.locator('#accommodation_state_0')
        .fill('testing');
    await page.locator('#emergency_givenname_0')
        .fill('testing');
    await page.locator('#emergency_phone_0')
        .fill('testing');
    await page.locator('#emergency_email_0')
        .fill('dm443790@gmail.com');


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Next' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // =====================================
    // UPLOAD FILES (API VERIFICATION)
    // =====================================

    // Wait for document form state to attach
    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });

    const uploadFile = getUploadFile();

    // Dynamic locators match any applicant ID without hardcoding
    const passportContainer = page.locator('[id^="passport_form_"]').first();
    const photoContainer = page.locator('[id^="photo_form_"]').first();

    // Helper function to upload with API verification
    async function uploadWithApiVerification(containerLocator: any, uploadFilePath: string, apiAction: string) {
        const fileInput = containerLocator.locator('input[type="file"]');
        
        // Wait for file input to be attached
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });

        // Start listening for API response BEFORE setting file
        const apiPromise = waitForUploadApi(page, [apiAction], 15000);

        // Set the file
        await fileInput.setInputFiles(uploadFilePath);

        // Wait for API response
        await apiPromise;
        console.log(`[VERIFIED] Uploaded via API: ${apiAction}`);
    }

    // Upload Passport Bio Page
    if (await passportContainer.count() > 0) {
        await uploadWithApiVerification(passportContainer, uploadFile, 'upload_temp');
        await page.waitForTimeout(1000);
    }

    // Upload Applicant Photo
    if (await photoContainer.count() > 0) {
        await uploadWithApiVerification(photoContainer, uploadFile, 'upload_temp');
        await page.waitForTimeout(1000);
    }

    try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }
    
    // =====================================
    // SAVE & CONTINUE
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // =====================================
    // PAYMENT
    // =====================================

    await expect(
        page.getByRole('heading', { name: /Pay Application Processing/ })
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