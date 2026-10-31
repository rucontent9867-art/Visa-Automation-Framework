import { test, expect } from '../../utils/baseTest';
import { uploadAndWaitForSuccess } from '../../utils/apiUpload';

test('ESTA Document Upload', async ({ page, getUploadFile }) => {

    // =====================================
    // 1. GET UPLOAD FILE (auto-creates if missing)
    // =====================================

    const uploadFilePath = getUploadFile();
    console.log(`Using file: ${uploadFilePath}`);


    // =====================================
    // 2. NAVIGATE TO UPLOAD PAGE
    // =====================================

    await page.goto('https://esta-online.it.com/document-upload/VUE0MDMyMzg0S0pL/');

    // Wait for upload sections using DYNAMIC prefix selectors
    await expect(page.locator('[id^="passport_form_"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[id^="photo_form_"]')).toBeVisible({ timeout: 20000 });


    // =====================================
    // 3. UPLOAD PASSPORT BIO PAGE
    // =====================================

    await uploadAndWaitForSuccess(
        page,
        page.locator('[id^="passport_form_"] input[type="file"]').first(),
        uploadFilePath
    );
    console.log('[VERIFIED] Passport Bio Page uploaded');

    // Verify success message
    // await expect(page.locator('[id^="passport_result_"]'))
    //     .toContainText('Document has been uploaded!', { timeout: 10000 });


    // =====================================
    // 4. UPLOAD DIGITAL APPLICANT PHOTO
    // =====================================

    await uploadAndWaitForSuccess(
        page,
        page.locator('[id^="photo_form_"] input[type="file"]').first(),
        uploadFilePath
    );
    console.log('[VERIFIED] Digital Applicant Photo uploaded');

    // Verify success message
    // await expect(page.locator('[id^="photo_result_"]'))
    //     .toContainText('Document has been uploaded!', { timeout: 10000 });


    // =====================================
    // 5. VERIFY PERSISTENCE ON RELOAD
    // =====================================

    await page.goto('https://esta-online.it.com/document-upload/VUE0MDMyMzg0S0pL/');

    await expect(
        page.locator('div').filter({ hasText: /^Passport Bio Page$/ })
    ).toBeVisible({ timeout: 20000 });

    await expect(
        page.locator('div').filter({ hasText: /^Digital Applicant Photo$/ })
    ).toBeVisible({ timeout: 20000 });

});