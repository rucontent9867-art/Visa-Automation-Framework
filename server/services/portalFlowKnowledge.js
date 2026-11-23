/**
 * server/services/portalFlowKnowledge.js
 *
 * Senior SDET & Developer Knowledge Base for Visa Automation Framework.
 * Captures the complete requirement flows, portal archetypes, and live-form safety rules
 * modeled directly on the battle-tested Azerbaijan and Bahrain implementations.
 *
 * Core Concept:
 * Live visa application forms cannot tolerate trial-and-error runs or flakiness,
 * because every live submission registers real application data or risks IP/rate limits.
 * This knowledge base provides 1-shot resilient requirement flows and country-specific
 * metadata for all 57 portals in the suite.
 */

const PORTAL_ARCHETYPES = {
  AZERBAIJAN: {
    id: 'archetype-azerbaijan',
    name: 'Upload-First Multi-Stage Pattern (Upload → Review → Confirmation)',
    description: 'Lead registration -> Details form -> Document upload -> [Checkpoint 1] -> Submit & Review -> [Checkpoint 2] -> Confirm & Submit -> Payment -> [Checkpoint 3] -> Payment URL',
    flowSteps: [
      'Pre-navigation Captcha hook attached before page.goto()',
      'Navigate to portal with networkidle fallback (5s timeout)',
      'General registration: Name, dm443790@gmail.com, Country combobox search & select, Phone 9876543210',
      'Dynamic arrival date via getArrivalDate() (+9 months, avoids month rollover)',
      'Nationality code selection (#nationality_gen)',
      'Captcha solve & Register click with registration screenshot',
      'Applicant & Passport details: Given Name, Surname, Passport No, Occupation, Address',
      'Dynamic passport expiry via getPassportExpiryDate() (+5 years)',
      'Single/Combined Document Upload via getUploadFile()',
      'STAGE 1 DIRECT URL VERIFICATION: Verify /visa-status/ and /complete-partially/ in separate tabs',
      'Submit & Preview click with applicant-detail screenshot',
      'Order ID extraction from #order_id_spn, #order_id, [data-order-id]',
      'STAGE 2 DIRECT URL VERIFICATION: Verify /visa-status/ and /complete-partially/ with Order ID',
      'Confirm & Submit click with preview screenshot',
      'Payment landing verification: Heading ("Pay Visa Processing Fee" or /Pay|Payment/i) + dm443790@gmail.com assertion',
      'STAGE 3 DIRECT URL VERIFICATION: Verify /visa-status/ and /complete-partially/ at Payment stage',
      'Auto-captured Payment URL logged and recorded in TestResultData'
    ],
    defaultUrls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  BAHRAIN: {
    id: 'archetype-bahrain',
    name: 'Review-First & Multi-Section Upload Pattern (Review → Multi-Upload → Confirmation)',
    description: 'Lead registration -> Details form -> Submit & Review -> [Checkpoint 1] -> Confirm & Submit -> Multi-Section Uploads -> Doc Page -> [Checkpoint 2] -> Save & Continue -> Payment -> [Checkpoint 3] -> Payment URL',
    flowSteps: [
      'Pre-navigation Captcha hook attached before page.goto()',
      'Navigate to portal with networkidle fallback (5s timeout)',
      'General registration: Name, dm443790@gmail.com, Country combobox search & select, Phone 9876543210',
      'Dynamic arrival date via getArrivalDate() (+9 months)',
      'Nationality code selection (#nationality_gen)',
      'Captcha solve & Register click with registration screenshot',
      'Applicant & Passport details: Name as per Passport, Passport No, Occupation, Employer/Designation, Address',
      'Dynamic passport expiry via getPassportExpiryDate() (+5 years)',
      'Submit & Preview click with applicant-detail screenshot',
      'STAGE 1 DIRECT URL VERIFICATION: Verify /application-status/ and /complete-application/ in separate tabs',
      'Confirm & Submit click with preview screenshot',
      'Dynamic Multi-Section Document Uploads (e.g. passport_form_, photo_form_, travel_itinerary_form_, hotel_booking_form_, funds_form_)',
      'Upload file via getUploadFile(), assert "Uploaded" or checkmark for each section',
      'Reload / Document page check with doc-page screenshot',
      'STAGE 2 DIRECT URL VERIFICATION: Verify direct URLs before leaving document upload stage',
      'Save & Continue click to proceed to payment',
      'Payment landing verification: Heading ("Pay Application Processing Fee" or "Pay Application Fee") + dm443790@gmail.com assertion',
      'STAGE 3 DIRECT URL VERIFICATION: Verify direct URLs at Payment stage',
      'Auto-captured Payment URL logged and recorded in TestResultData'
    ],
    defaultUrls: ['/application-status/', '/complete-application/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  PAYMENT_ONLY: {
    id: 'archetype-payment-only',
    name: 'Up-to-Payment Only Pattern',
    description: 'Complete registration, applicant details, and upload straight to payment screen without opening secondary tabs.',
    flowSteps: [
      'Pre-navigation Captcha hook',
      'Navigate with network idle fallback',
      'General details with dm443790@gmail.com and dynamic dates',
      'Passport & applicant details',
      'Document upload via getUploadFile()',
      'Preview & Submit',
      'Payment page verification with dm443790@gmail.com assertion',
      'Auto-captured Payment URL'
    ],
    defaultUrls: [],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Payment'
  },
  STATUS_ONLY: {
    id: 'archetype-status-only',
    name: 'Standalone Verification Pattern',
    description: 'Direct verification of /visa-status/ or /complete-partially/ with a specified Order ID.',
    flowSteps: [
      'Navigate directly to status/resume URL',
      'Enter Order ID into #order_id or input[name="order_id"]',
      'Solve Captcha if required',
      'Submit form and capture verification screenshot',
      'Assert application tracking details'
    ],
    defaultUrls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id, input[name="order_id"]',
    paymentHeading: 'Application Status'
  }
};

// Known metadata presets for top country portals extracted from tests/spec/
const PORTAL_REGISTRY = [
  {
    country: 'Azerbaijan',
    specFile: 'azerbaijan-visa.spec.ts',
    targetUrl: 'https://azerbaijan-visa.info/apply/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '61',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, input[name="order_id"]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Bahrain',
    specFile: 'bahrain-visa.spec.ts',
    targetUrl: 'https://bahrain-visas.com/application/',
    archetype: 'archetype-bahrain',
    nationalityCode: '45',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'travel_itinerary_form_', 'hotel_booking_form_', 'funds_form_'],
    urls: ['/application-status/', '/complete-application/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Cambodia',
    specFile: 'cambodia-evisa.spec.ts',
    targetUrl: 'https://cambodia-evisa.info/apply-evisa/',
    archetype: 'archetype-bahrain',
    nationalityCode: '38',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'photo_form_', 'flight_itinerary_form_', 'hotel_booking_form_'],
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Processing Fee'
  },
  {
    country: 'Burkina Faso',
    specFile: 'burkina-faso-evisa.spec.ts',
    targetUrl: 'https://burkina-faso-evisa.com/apply-now/',
    archetype: 'archetype-bahrain',
    nationalityCode: '48',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'photo_form_', 'vaccine_certificate_form_', 'flight_itinerary_form_', 'travel_itinerary_form_'],
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Benin',
    specFile: 'benin-e-visa.spec.ts',
    targetUrl: 'https://evisa.gouv.bj/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '58',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Brazil',
    specFile: 'brazil-evisa.spec.ts',
    targetUrl: 'https://brazil-evisa.com/apply/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '31',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'United Kingdom',
    specFile: 'united-kingdom-visa.spec.ts',
    targetUrl: 'https://united-kingdom-visa.com/apply-eta/',
    archetype: 'archetype-bahrain',
    nationalityCode: '29',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'photo_form_'],
    urls: ['/application-status/', '/complete-application/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Fee'
  },
  {
    country: 'Egypt',
    specFile: 'egypt-eta.spec.ts',
    targetUrl: 'https://egypt-eta.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '71',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Turkey',
    specFile: 'turkey-evisa.spec.ts',
    targetUrl: 'https://turkey-evisa.it.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '89',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Ivory Coast',
    specFile: 'ivory-coast.spec.ts',
    targetUrl: 'https://snedai-ci.org/application/',
    archetype: 'archetype-bahrain',
    nationalityCode: '52',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'hotel_booking_form_', 'flight_booking_form_'],
    urls: ['/application-status/', '/complete-application/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Armenia',
    specFile: 'visa-armenia.spec.ts',
    targetUrl: 'https://evisa.mfa.am/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '12',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Georgia',
    specFile: 'georgia-evisa.spec.ts',
    targetUrl: 'https://georgia-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '35',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Indonesia',
    specFile: 'indonesia-e-visa.spec.ts',
    targetUrl: 'https://indonesia-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '42',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Jordan',
    specFile: 'jordan-evisa.spec.ts',
    targetUrl: 'https://jordan-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '68',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Kazakhstan',
    specFile: 'kazakhstan-evisa.spec.ts',
    targetUrl: 'https://kazakhstan-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '77',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Saudi Arabia',
    specFile: 'saudi-arabia-evisa.spec.ts',
    targetUrl: 'https://saudi-arabia-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '91',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'UAE',
    specFile: 'uae-evisa.spec.ts',
    targetUrl: 'https://uae-evisa.com/application/',
    archetype: 'archetype-azerbaijan',
    nationalityCode: '99',
    uploadType: 'single',
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Visa Processing Fee'
  },
  {
    country: 'Cameroon',
    specFile: 'cameroon-visa.spec.ts',
    targetUrl: 'https://visit-cameroon.info/application/',
    archetype: 'archetype-bahrain',
    nationalityCode: '42',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'round_ticket_form_', 'vaccine_certificate_form_', 'hotel_booking_form_', 'funds_form_', 'business_invitation_form_'],
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  },
  {
    country: 'Congo',
    specFile: 'congo-evisa.spec.ts',
    targetUrl: 'https://congo-evisa.com/apply-evisa/',
    archetype: 'archetype-bahrain',
    nationalityCode: '45',
    uploadType: 'multi-section',
    uploadSections: ['passport_form_', 'photo_form_', 'visit_confirming_form_', 'passport_immigration_form_', 'passport_immigration_countersigning_form_'],
    urls: ['/visa-status/', '/complete-partially/'],
    orderIdSelector: '#order_id_spn, #order_id, [data-order-id]',
    paymentHeading: 'Pay Application Processing Fee'
  }
];

/**
 * Detect best matching archetype based on script content or target URL.
 */
function detectArchetype(targetUrl = '', existingCode = '') {
  const content = (targetUrl + ' ' + existingCode).toLowerCase();

  // If multi-section uploads or 'Save & Continue' appear after Confirm & Submit -> Bahrain pattern
  if (
    content.includes('passport_form_') ||
    content.includes('bahrain') ||
    content.includes('united-kingdom') ||
    content.includes('ivory-coast') ||
    content.includes('complete-application') ||
    (content.includes('confirm & submit') && content.includes('save & continue'))
  ) {
    return PORTAL_ARCHETYPES.BAHRAIN;
  }

  // Default to Azerbaijan archetype (Upload-first)
  return PORTAL_ARCHETYPES.AZERBAIJAN;
}

module.exports = {
  PORTAL_ARCHETYPES,
  PORTAL_REGISTRY,
  detectArchetype
};
