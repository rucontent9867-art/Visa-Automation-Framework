/**
 * Saudi Arabia Visa Application - E2E Test
 *
 * Refactored to use shared baseTest, captcha helper, and exact date methods.
 * Starts directly from the application page URL.
 */

import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDateOfBirth,
    getPassportExpiryDate,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Saudi Arabia Visa Application', async ({ page, waitForCaptcha }) => {

    // ── Captcha listener before nav ──

    const captchaPromise = waitForCaptcha(page);


    // ── Open application page directly ──

    await page.goto('https://saudi-arabia-evisa.org/registration/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // ── General details ──

    await page.getByRole('textbox', { name: 'Name *' })
        .fill('Abhijeet');

    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .locator('div')
        .nth(1)
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('98765 43214');


    // ── Date fields (Using exact date methods) ──

    const arrival = getArrivalDate();
    await page.getByLabel('Arrival year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival month')
        .selectOption(arrival.month);
    await page.getByLabel('Date of Arrival *')
        .selectOption(arrival.day);


    // ── Nationality ──

    await page.locator('#nationality_gen')
        .selectOption('83');


    // ── Fill captcha ──

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);

    await page.getByRole('textbox', { name: 'Captcha text*' })
        .fill(captchaText);


    // ── Register ──

    await page.getByRole('button', { name: 'Register' })
        .click();

    await page.getByRole('textbox', {
        name: 'Given/First Name as per'
    }).waitFor();


    // ── Passport details ──

    await page.getByRole('textbox', { name: 'Given/First Name as per' })
        .fill('Abhi');

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('na');

    // Date of Birth (Auto-calculated: 25 years old)
    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    // Passport Expiry Date (Auto-calculated: 5 years ahead)
    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(passExp.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(passExp.day);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('MISSIONARY');

    await page.locator('#marital_status_0')
        .selectOption('Married');

    await page.locator('#address_0')
        .fill('na');

    await page.locator('#purpose_of_visit_0')
        .selectOption('Family & Relative');

    await page.locator('#accomodation_address_0')
        .fill('na');


    // ── Submit & Preview ──

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // ── Confirm & Submit ──

    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();


    // ── Wait for dynamic upload page to load ──

    await expect(page.locator('[id^="photo_form_"]'))
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
        'photo_form_',
        'passport_form_'
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

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();


    // ── Final assertions ──

    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible({ timeout: 30000 });

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