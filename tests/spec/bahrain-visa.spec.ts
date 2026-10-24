/**
 * Bahrain Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */

import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';

test('Bahrain Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://bahrain-visas.com/application/');
    try {
  await page.waitForLoadState('networkidle', { timeout: 5000 });
} catch {
  console.log('Network never went idle, continuing anyway');
}


    // =====================================
    // GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Name *' })
        .fill('testing');

    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();

    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');

    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('9876543210');

    const arrival = getArrivalDate();

    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);

    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);

    await page.locator('#nationality_gen')
        .selectOption('45');


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

    const expiry = getPassportExpiryDate();

    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);

    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('MILITARY');

    await page.locator('#emp_designation_0')
        .fill('testing');

    await page.locator('#emp_address_0')
        .fill('testing');


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

    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'preview');

    // =======================================================================
    // DIRECT URL VERIFICATION: PREVIEW STAGE
    // Verify application status & partial resume before final submission
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        relativeUrls: ['/application-status/', '/complete-application/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });

    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

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
        { idPrefix: 'passport_form_',          label: 'Passport document' },
        { idPrefix: 'travel_itinerary_form_',  label: 'Travel itinerary' },
        { idPrefix: 'hotel_booking_form_',     label: 'Hotel booking' },
        { idPrefix: 'funds_form_',             label: 'Proof of funds' },
    ];

    for (const section of uploadSections) {

        const sectionLocator = page.locator(
            `[id^="${section.idPrefix}"]`
        );

        await sectionLocator
            .locator('input[type="file"]')
            .setInputFiles(uploadFile);

        await expect(sectionLocator).toContainText(/Uploaded/i, { timeout: 30000 });

        console.log(`${section.label} uploaded`);
    }


    // =====================================
    // PAYMENT
    // =====================================

    await page.reload();

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'doc-page');

    // =======================================================================
    // DIRECT URL VERIFICATION: DOCUMENT UPLOAD STAGE
    // Verify direct URLs open Document Upload stage before proceeding
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'document-upload',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        relativeUrls: ['/application-status/', '/complete-application/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

        try {
  await page.waitForLoadState('networkidle', { timeout: 5000 });
} catch {
  console.log('Network never went idle, continuing anyway');
}

    await expect(
        page.getByRole('heading', {
            name: 'Pay Application Processing Fee'
        })
    ).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    // =======================================================================
    // DIRECT URL VERIFICATION: PAYMENT STAGE
    // Verify direct URLs open Payment stage before checkout
    // =======================================================================
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        relativeUrls: ['/application-status/', '/complete-application/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
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