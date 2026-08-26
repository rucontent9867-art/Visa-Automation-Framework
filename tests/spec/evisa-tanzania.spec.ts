import { test, expect, capturescreenshot } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate
} from '../../utils/date';

test('Tanzania Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://evisa-tanzania.it.com/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // GENERAL DETAILS
    // =====================================

    await page.locator('#name')
        .fill('testing');

    await page.locator('#email_id')
        .fill('testing@test.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .fill('9876543210');

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('45');

    await page.locator('#chk')
        .click();


    // =====================================
    // CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    await page.locator('#chk')
        .fill(captcha);


    // =====================================
    // REGISTER
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
    // PASSPORT
    // =====================================

    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');

    await page.locator('#pass_no_0')
        .fill('111');

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    await page.locator('#marital_status_0')
        .selectOption('Married');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#occupation_0')
        .selectOption('MISSIONARY');


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Next' })
        .click();

    await page.locator('#sp_name_0')
        .fill('testing');

    await page.locator('#sp_nationality_0')
        .selectOption('46');

    await page.locator('#destination_0')
        .fill('testing');

    await page.locator('#host_fullname_0')
        .fill('testing');

    await page.locator('#host_phone_0')
        .fill('9876543210');

    await page.locator('#host_email_0')
        .fill('testing@test.com');

    await page.locator('#host_address_0')
        .fill('testing');

    await page.locator('#host_relation_0')
        .fill('testing');

    await page.locator('#accomodation_address_0')
        .fill('testing');

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
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'round_ticket_form_'
    ];

    for (const section of uploadSections) {
        await page.locator(`[id^="${section}"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await expect(page.locator(`[id^="${section}"]`))
            .toContainText('✓ Uploaded');
    }


    // =====================================
    // PAYMENT
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

    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible();

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    await page.getByText('testing@test.com')
        .click();

    await expect(
        page.getByText('testing@test.com')
    ).toBeVisible();

      console.log(
        `\n================ PAYMENT PAGE URL ================\n${page.url()}\n====================================================\n`
    );
});