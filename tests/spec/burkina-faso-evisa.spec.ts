import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate
} from '../../utils/date';


test('Burkina Faso Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://burkina-faso-evisa.com/apply-now/');
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
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'phone' })
        .fill('9876543210');

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
        .selectOption('48');


    // =====================================
    // CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    await page.getByRole('textbox', { name: 'Captcha' })
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

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    const issue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(issue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(issue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(issue.day);

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('MEDIA');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#postal_code_0')
        .fill('testing');

    await page.locator('#airline_0')
        .selectOption('Car');

    await page.locator('#place_visited_0')
        .selectOption('Gaoua');

    await page.locator('#emergency_givenname_0')
        .fill('testing');

    await page.locator('#emergency_phone_0')
        .fill('9876543210');

    await page.locator('#ref_name_in_0')
        .fill('testing');

    await page.locator('#ref_phone_in_0')
        .fill('9876543210');


    // =====================================
    // PREVIEW
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

    // =========================================================================
    // DIRECT URL VERIFICATION: PREVIEW STAGE
    // Verify application status & partial resume on Preview screen
    // =========================================================================
    let orderId = (await page.locator('#order_id_spn, #order_id, [data-order-id]').textContent().catch(() => ''))?.trim() || '';
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'preview',
        urls: ["/visa-status/","/complete-partially/"],
        waitForCaptcha,
        networkIdleTimeoutMs: 5000,
    });
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport_form_',
        'photo_form_',
        'vaccine_certificate_form_',
        'flight_itinerary_form_',
        'travel_itinerary_form_'
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

    // =========================================================================
    // DIRECT URL VERIFICATION: DOCUMENT UPLOAD STAGE
    // Verify application status & partial resume on Document Upload screen
    // =========================================================================
    orderId = (await page.locator('#order_id_spn, #order_id, [data-order-id]').textContent().catch(() => ''))?.trim() || orderId;
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'document-upload',
        urls: ["/visa-status/","/complete-partially/"],
        waitForCaptcha,
        networkIdleTimeoutMs: 5000,
    });
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

    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 3: PAYMENT / DETAIL STAGE
    // Verify /visa-status/ and /complete-partially/ in separate tabs before checkout
    // =========================================================================
    orderId = (await page.locator('#order_id_spn, #order_id, [data-order-id]').textContent().catch(() => ''))?.trim() || orderId;
    await verifyDirectUrls(page, {
        orderId,
        stageName: 'payment',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha,
        networkIdleTimeoutMs: 5000,
    });

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

});

// =====================================
// SECTION: Contact Us
// =====================================
test.describe('Burkina Faso Evisa contact form', () => {
    test.describe.configure({ retries: 0 });

    test('sends one inquiry and displays confirmation', async ({ page }) => {
        const { submitContactUsForm } = await import('../../utils/contactUs');
        const result = await submitContactUsForm(page, 'burkina-faso-evisa');
        expect(result.status, result.reason || 'Burkina Faso Evisa Contact Us submission failed').toBe('PASS');
    });
});
