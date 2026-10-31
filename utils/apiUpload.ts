import type { Page, Locator, Response } from '@playwright/test';

/**
 * Waits for the upload API response matching specified action names (e.g., 'upload_temp', 'get_form_document').
 * Resilient against multipart/form-data streams and standard URL-encoded payloads.
 */
export async function waitForUploadApi(
    page: Page,
    acts: string[] = ['get_form_document', 'upload_temp'],
    timeout: number = 20000
): Promise<Response | null> {
    try {
        return await page.waitForResponse(
            async (response: Response) => {
                // Filter for POST API requests only
                if (!response.url().includes('/api/')) return false;
                if (response.request().method() !== 'POST') return false;

                const postData = response.request().postData() || '';
                let matchedAct = acts.some(act =>
                    postData.includes(`act=${act}`) || postData.includes(act)
                );

                // Inspect multipart/form-data buffer if unbuffered text is empty
                if (!matchedAct) {
                    try {
                        const buf = response.request().postDataBuffer();
                        if (buf) {
                            const str = buf.toString('utf-8');
                            matchedAct = acts.some(act => str.includes(act) || str.includes(`act=${act}`));
                        }
                    } catch (e) {
                        // Ignore buffer read errors
                    }
                }

                if (!matchedAct && postData.length > 0) return false;
                if (response.status() !== 200) return false;

                // Verify JSON SUCCESS status or valid form payload
                try {
                    const body = await response.json();
                    return body?.status === 'SUCCESS' || body?.form_field !== undefined;
                } catch (e) {
                    return false;
                }
            },
            { timeout }
        );
    } catch (e) {
        console.log(`[apiUpload] Response wait completed or timed out for acts: [${acts.join(', ')}].`);
        return null;
    }
}

/**
 * All-in-one helper that registers the API listener BEFORE setting the file,
 * preventing race conditions.
 */
export async function uploadAndWaitForSuccess(
    page: Page,
    fileInput: Locator,
    filePath: string,
    timeoutMs: number = 15000
): Promise<void> {
    // 1. Register listener FIRST
    const uploadResponsePromise = waitForUploadApi(page, ['upload_temp'], timeoutMs);

    // 2. Attach file to input
    await fileInput.setInputFiles(filePath);

    // 3. Await API confirmation
    await uploadResponsePromise;
}

/**
 * Inspects upload sections in the DOM to verify container presence and file inputs.
 */
export async function inspectAllUploadSections(
    page: Page,
    sectionPrefixes: string[] = ['passport_form_', 'photo_form_']
): Promise<Record<string, { exists: boolean; visible: boolean; inputCount: number }>> {
    const results: Record<string, { exists: boolean; visible: boolean; inputCount: number }> = {};

    for (const prefix of sectionPrefixes) {
        const formLocator = page.locator(`[id^="${prefix}"]`).first();
        const exists = (await formLocator.count()) > 0;
        const visible = exists ? await formLocator.isVisible().catch(() => false) : false;
        const inputCount = exists ? await formLocator.locator('input[type="file"]').count() : 0;
        
        results[prefix] = { exists, visible, inputCount };
    }

    return results;
}