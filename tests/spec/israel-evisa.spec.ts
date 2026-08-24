import { test, expect } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate,
    getDateOfBirth,
    getPassportIssueDate
} from '../../utils/date';
import fs from 'fs';
import path from 'path';

test('Israel Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // 1. CAPTCHA LISTENER
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // 2. NAVIGATION
    // =====================================

    await page.goto('https://israel-evisa.com/apply-now/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // 3. GENERAL DETAILS
    // =====================================

    // Name
    await page.getByRole('textbox', { name: 'name' }).fill('Abhijeet');

    // Email
    await page.getByRole('textbox', { name: 'email' }).fill('dm443790@gmail.com');

    // Country
    await page.getByRole('combobox', { name: 'Selected country' }).click();
    await page.getByRole('combobox', { name: 'Search' }).fill('ind');
    await page.getByRole('option', { name: 'India +' }).click();

    // Phone
    await page.getByRole('textbox', { name: 'phone' }).fill('9876543214');

    // Nationality
    // Note: Using 79 as per original sample, but you may need to adjust if it changes
    await page.locator('#nationality_gen').selectOption('79');


    // =====================================
    // 4. DATES (Dynamic Calculation)
    // =====================================

    // Arrival Date
    const arrival = getArrivalDate();
    // Israel eVisa typically uses labels or specific IDs. 
    // Adjust IDs if the actual page structure differs from the sample.
    // Common patterns: #yr_arrival, #mon_arrival, #day_arrival OR getByLabel
    try {
        await page.locator('#yr_arrival').selectOption(arrival.year);
        await page.locator('#mon_arrival').selectOption(arrival.month);
        await page.locator('#day_arrival').selectOption(arrival.day);
    } catch {
        // Fallback to getByLabel if IDs are not present
        await page.getByLabel('Year').selectOption(arrival.year);
        await page.getByLabel('Month').selectOption(arrival.month);
        await page.getByLabel('Day', { exact: true }).selectOption(arrival.day);
    }


    // =====================================
    // 5. CAPTCHA
    // =====================================

    const captchaText = await captchaPromise;
    console.log('Decoded CAPTCHA:', captchaText);

    await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);


    // =====================================
    // 6. REGISTER & PASSPORT DETAILS
    // =====================================

    await page.getByRole('button', { name: 'Register' }).click();

    // Wait for the passport form to load
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();

    // Applicant Name
    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('Abhi');

    // Passport Number
    await page.locator('#pass_no_0').fill('111');

    // Passport Expiry (Dynamic: 5 years from now)
    const passExp = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0').selectOption(passExp.year);
    await page.locator('#mon_pass_exp_0').selectOption(passExp.month);
    await page.locator('#day_pass_exp_0').selectOption(passExp.day);

    // Surname
    await page.getByRole('textbox', { name: 'Surname as per Passport' }).fill('na');

    // Address
    await page.locator('#address_0').fill('na');

    // Father Name
    await page.locator('#father_name_0').fill('na');

    // Mother Name
    await page.locator('#mother_name_0').fill('na');


    // =====================================
    // 7. SUBMIT & PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' }).click();
    await page.getByRole('button', { name: 'Confirm & Submit' }).click();

    // =====================================
    // 8. UPLOAD SECTION
    // =====================================

    // Wait for upload page to load
    await expect(page.locator('[id^="passport_form_"]')).toBeVisible({ timeout: 15000 });

    // Resolve upload file path dynamically
    const uploadCandidates = [
        path.resolve(__dirname, '..', '..', 'debug-chromium-desktop.png'),
        path.resolve(process.cwd(), 'debug-chromium-desktop.png'),
        path.resolve(process.cwd(), 'tests', 'assets', '10kb.jpg'),
        path.resolve(process.cwd(), 'assets', '10kb.jpg'),
    ];

    const uploadFilePath = uploadCandidates.find(
        candidate => fs.existsSync(candidate)
    );

    if (!uploadFilePath) {
        throw new Error(
            `No upload file found. Checked: ${uploadCandidates.join(', ')}. Please ensure a test image exists.`
        );
    }

    console.log(`Using upload file: ${uploadFilePath}`);

    // Identify upload sections dynamically or statically based on the site structure
    // Israel visa might have different section IDs than Indonesia.
    // We will look for inputs with type="file" inside the page body or common containers.
    
    const uploadSectionLocators = page.locator('input[type="file"]');
    
    if (await uploadSectionLocators.count() === 0) {
        throw new Error("No file upload inputs found on the page.");
    }

    // Upload the first available file input (or loop if there are multiple specific ones)
    // For Israel visa, usually there's a Passport upload section.
    // If the site has multiple specific sections (e.g., Passport Photo, Passport Page), 
    // you may need to target them specifically. Here we target the first one found.
    
    await uploadSectionLocators.first().setInputFiles(uploadFilePath);
    
    // Wait for confirmation message
    await expect(page.getByText('Document has been uploaded!')).toBeVisible({ timeout: 15000 });


    // =====================================
    // 9. FINALIZE
    // =====================================

    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }

    await page.getByRole('button', { name: 'Save & Continue' }).click();

    // Final Assertions
    await expect(
        page.getByRole('heading', { name: 'Application Detail' })
    ).toBeVisible({ timeout: 30000 });

    await expect(
        page.getByText('dm443790@gmail.com')
    ).toBeVisible();

    console.log(
        `\n================ PAYMENT/CONFIRM PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});