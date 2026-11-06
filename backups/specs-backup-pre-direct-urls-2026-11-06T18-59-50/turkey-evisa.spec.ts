/**
 * Turkey Visa Application - E2E Test
 *
 * Refactored to use shared baseTest, captcha helper, and exact date methods.
 * Starts directly from the application page URL.
 * Restricted to Chrome and Firefox only (Safari is not supported).
 */

import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate,
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Turkey Visa Application', async ({ page, browserName, waitForCaptcha }) => {

    // ── Restrict browsers ──

    if (browserName === 'webkit') {
        throw new Error('Safari (WebKit) is not supported for this test');
    }

    if (browserName !== 'chromium' && browserName !== 'firefox') {
        test.skip(true, `Skipping unsupported browser: ${browserName}`);
    }


    // ── Captcha listener before nav ──

    const captchaPromise = waitForCaptcha(page);


    // ── Open application page directly ──

    await page.goto('https://turkey-evisa.it.com/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // ── General details ──

    await page.getByRole('textbox', { name: 'Name' })
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
        .fill('78945 61239');

    await page.getByLabel('Nationality *')
        .selectOption('89');


    // ── Date fields (Using exact date methods) ──

    const arrival = getArrivalDate();
    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);
    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);
    await page.getByLabel('Date of Arrival in Turkey *')
        .selectOption(arrival.day);


    // ── Fill captcha ──

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);

    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captchaText);


    // ── Register ──

    await page.getByRole('button', { name: 'Register' })
        .click();

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

    // Passport Issue Date (Auto-calculated: 6 months ago)
    const passIssue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(passIssue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(passIssue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(passIssue.day);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    // Date of Birth (Auto-calculated: 25 years old)
    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);
    await page.locator('#day_dob_0')
        .selectOption(dob.day);

    await page.locator('#pass_no_0')
        .fill('testing');
    await page.locator('#city_of_birth_0')
        .fill('testing');
    await page.locator('#father_name_0')
        .fill('testing');
    await page.locator('#mother_name_0')
        .fill('testing');

    await page.locator('#type_of_support_doc_0')
        .selectOption('Visa');

    await page.locator('#support_doc_country_0')
        .selectOption('145');

    await page.getByRole('checkbox', { name: 'Unlimited' })
        .check();

    // Date picker UI interaction for support doc issue date
    await page.locator('#sup_issue_date_0')
        .click();
    await page.getByRole('link', { name: '10' })
        .click();

    await page.locator('#support_doc_no_0')
        .fill('testing');


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


    // ── Upload Support Document ──

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFilePath);
    } else {
        await page.getByRole('button', { name: 'Choose File' })
            .setInputFiles(uploadFilePath);
    }


    // ── Submit & Preview ──

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // ── Confirm & Submit ──

    await page.getByRole('button', { name: 'Confirm & Submit' })
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