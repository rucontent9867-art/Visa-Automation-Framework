/**
 * Russia eVisa Application - E2E Test
 *
 * Refactored to use shared baseTest, captcha helper, and exact date methods.
 * Starts directly from the application page URL.
 */

import { test, expect, capturescreenshot } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDateOfBirth,
    getPassportExpiryDate,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Russia eVisa Application', async ({ page, waitForCaptcha }) => {

    // ── Captcha listener before nav ──

    const captchaPromise = waitForCaptcha(page);


    // ── Open application page directly ──

    await page.goto('https://russian-e-visa.com/russia-e-visa-application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // ── General details ──

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

    await page.getByRole('textbox', { name: 'Contact/WhatsApp Number*' })
        .fill('78945 61239');

    await page.locator('#nationality_gen')
        .selectOption('93');


    // ── Date fields (Using exact date methods) ──

    const arrival = getArrivalDate();
    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);
    await page.getByLabel('Arrival Day')
        .selectOption(arrival.day);


    // ── Fill captcha ──

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);

    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);


    // ── Register ──

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


    // ── Applicant details ──

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .fill('testing');

    // Passport Expiry Date (Auto-calculated: 5 years ahead)
    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    // Date of Birth (Auto-calculated: 25 years old)
    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    await page.locator('#pass_no_0')
        .fill('testing');
    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#occupation_0')
        .selectOption('LAWYER');

    await page.getByRole('textbox', { name: 'Please be brief. (Max 200' })
        .fill('testing');


    // ── Parent Details ──

    await page.locator('#father_name_0')
        .fill('testing');
    
    // Using fill for the calendar input directly (avoids flaky UI link clicks)
    await page.locator('#father_dob_0')
        .fill('01-01-1970');
        
    await page.locator('#father_birth_place_0')
        .fill('testing');

    await page.locator('#mother_name_0')
        .fill('testing');
    
    await page.locator('#mother_dob_0')
        .fill('01-01-1970');
        
    await page.locator('#mother_birth_place_0')
        .fill('testing');


    // ── Accommodation & Host Details ──

    await page.locator('#accomodation_0')
        .fill('testing');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#host_address_0')
        .fill('testing');
    await page.locator('#host_phone_0')
        .fill('testing');
    await page.locator('#accommodation_phone_0')
        .fill('testing');
    await page.locator('#host_fullname_0')
        .fill('testing');


    // ── Additional Info (Clickable container) ──

    await page.locator('div')
        .filter({ hasText: /^Source of funds for your visit to the Russian Federation \* Edit$/ })
        .locator('div')
        .first()
        .click();
        
    await page.locator('#expense_covered_0')
        .fill('testing');
        
    await page.locator('#visit_past_3year_0')
        .fill('testing');


    // ── Submit & Preview ──

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


    // ── Wait for dynamic upload page to load ──

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });


    // ── Resolve upload file path ──

    const uploadCandidates = [
        path.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
        path.resolve(process.cwd(), 'debug-chromium-desktop.png'),
        path.resolve(process.cwd(), 'tests', 'assets', '10kb.jpg'),
    ];

    const uploadFilePath = uploadCandidates.find(
        candidate => fs.existsSync(candidate)
    );

    if (!uploadFilePath) {
        throw new Error(
            `No upload file found. Checked: ${uploadCandidates.join(', ')}`
        );
    }


    // ── Upload files with validation ──

    const uploadSections = [
        'passport_form_',
        'photo_form_'
    ];

    for (const section of uploadSections) {
        const sectionLocator = page.locator(`[id^="${section}"]`);

        await sectionLocator
            .locator('input[type="file"]')
            .setInputFiles(uploadFilePath);

        await expect(sectionLocator)
            .toContainText('✓ Uploaded', { timeout: 15000 });

        console.log(`Uploaded: ${section.replace(/_/g, ' ')}`);
    }


    // ── Save & Continue ──

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'doc-page');
    await page.getByRole('button', { name: 'Save & Continue' })
        .click();
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // ── Final assertions ──

    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(1000);
    await capturescreenshot(page, 'payment-page');

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();


    // ── Payment URL auto-captured by baseTest afterEach ──

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});