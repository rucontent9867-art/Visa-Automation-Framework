/**
 * Benin Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 * Standardized with 3-stage dual URL verification (Preview -> Document Upload -> Payment).
 */

import { test, expect, getUploadFile, capturescreenshot, verifyDirectUrls } from '../../utils/baseTest';
import path from 'path';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';

test('Benin Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://benin-e-visa.com/application/');
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
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('41');


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

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('JOURNALIST');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#appli_country_0')
        .selectOption('44');
    await page.locator('#depart_country_0')
        .selectOption('45');
    await page.locator('#purpose_of_visit_0')
        .selectOption('SUMMER CAMP');

    await page.locator('#return_ticket_0')
        .fill('testing');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#maintenance_means_0')
        .fill('testing');
    await page.locator('#destination_0')
        .fill('testing');


    // =====================================
    // PREVIEW STAGE & CHECKPOINT
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
    // DIRECT URL VERIFICATION - STAGE 1: PREVIEW STAGE
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'preview',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });


    // =====================================
    // UPLOAD FILE & CHECKPOINT
    // =====================================

    const uploadFile = getUploadFile();
    const fileName = path.basename(uploadFile);

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFile);
    } else {
        await page.getByRole('button', { name: 'Choose File' })
            .setInputFiles(uploadFile);
    }

    await expect(fileInput.first()).toHaveValue(new RegExp(fileName.replace('.', '\\.')));

    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 2: DOCUMENT UPLOAD STAGE
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'document-upload',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });


    // =====================================
    // PAYMENT STAGE & CHECKPOINT
    // =====================================

    await expect(
        page.getByRole('heading', {
            name: 'Pay Application Processing Fee'
        })
    ).toBeVisible({ timeout: 30000 });

    // =========================================================================
    // DIRECT URL VERIFICATION - STAGE 3: PAYMENT STAGE
    // =========================================================================
    await verifyDirectUrls(page, {
        stageName: 'payment',
        orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
        urls: ['/visa-status/', '/complete-partially/'],
        waitForCaptcha: true,
        networkIdleTimeoutMs: 5000,
    });

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