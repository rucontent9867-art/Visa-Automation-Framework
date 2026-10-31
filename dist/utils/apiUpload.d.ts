import type { Page, Locator, Response } from '@playwright/test';
/**
 * Waits for the upload API response matching specified action names (e.g., 'upload_temp', 'get_form_document').
 * Resilient against multipart/form-data streams and standard URL-encoded payloads.
 */
export declare function waitForUploadApi(page: Page, acts?: string[], timeout?: number): Promise<Response | null>;
/**
 * All-in-one helper that registers the API listener BEFORE setting the file,
 * preventing race conditions.
 */
export declare function uploadAndWaitForSuccess(page: Page, fileInput: Locator, filePath: string, timeoutMs?: number): Promise<void>;
/**
 * Inspects upload sections in the DOM to verify container presence and file inputs.
 */
export declare function inspectAllUploadSections(page: Page, sectionPrefixes?: string[]): Promise<Record<string, {
    exists: boolean;
    visible: boolean;
    inputCount: number;
}>>;
//# sourceMappingURL=apiUpload.d.ts.map