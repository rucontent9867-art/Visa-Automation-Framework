/**
 * contactUs.ts
 *
 * Best-effort "Contact Us" form verification & submission helper.
 * Always uses `dm443790@gmail.com` as the contact email.
 *
 * Improvements over legacy implementation:
 *   - Enforces `dm443790@gmail.com` across all 60 configured portals and generic fallback.
 *   - Uses realistic valid phone (`9876543210`) & non-spam message so client-side validators pass.
 *   - Preserves `grecaptcha.execute()` + `save_detail(token)` instead of stripping `<script>` tags.
 *   - Solves post-submit invisible/v2 reCAPTCHA challenges via `solveRecaptchaChallenge(page)`.
 *   - Solves PHP image/text captchas (`#chk` via `waitForCaptchaCustom`) on portals such as India eVisa.
 *   - Scopes error inspection to the target contact form (ignoring header search / login modals).
 *   - Filters out analytics beacons (`google-analytics`, `doubleclick`, `clarity.ms`, etc.) from POST tracking.
 */

import { Page, expect, Locator, Response, Request } from '@playwright/test';
import { captureScreenshot } from './screenshot';
import { waitForPageLoad } from './pageLoad';
import { waitForCaptchaCustom } from './captcha/captchaHelper';
import { solveRecaptchaChallenge, isAudioRateLimited } from './captcha/recaptchaAudio';

export const STANDARD_CONTACT_EMAIL = 'dm443790@gmail.com';
const STANDARD_CONTACT_NAME = 'Rupesh Kumar';
const STANDARD_CONTACT_PHONE = '9876543210';
const STANDARD_CONTACT_PASSPORT = 'A1234567';
const STANDARD_CONTACT_ORDER_ID = 'TEST-12345';
const STANDARD_CONTACT_SUBJECT = 'Visa Application Status Inquiry';
const STANDARD_CONTACT_MESSAGE =
  'Hello, I would like to check the processing status of my visa application.';

interface ContactUsField {
  locator: (page: Page) => Locator;
  value: string;
  isDropdown?: boolean;
  searchValue?: string;
  optionText?: string;
  optionLocator?: (page: Page) => Locator;
  dblClick?: boolean;
  preClickLocator?: (page: Page) => Locator;
}

interface ContactUsSiteConfig {
  specKey: string;
  name: string;
  url: string;
  formSelector?: string;
  fields: ContactUsField[];
  textCaptcha?: {
    urlPatterns?: string[];
    encodedHiddenSelector?: string;
    locator: (page: Page) => Locator;
  };
  submitButton: (page: Page) => Locator;
  successMessage: (page: Page) => Locator;
  screenshotName?: string;
}

export interface ContactUsResult {
  status: 'PASS' | 'FAIL' | 'SKIPPED' | 'CAPTCHA_BLOCKED';
  screenshotPath: string | null;
  reason?: string;
}

const CONTACT_US_SITES: ContactUsSiteConfig[] = [
  {
    specKey: 'bahrain-visa',
    name: 'Bahrain ETA',
    url: 'https://bahrain-eta.it.com/contact-us/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.locator('form#contact #name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#contact #email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form#contact').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#contact #phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#contact #applicationId'), value: 'TEST-12345' },
      { locator: (p) => p.locator('form#contact #comment_act'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form#contact #contact_of'),
    successMessage: (p) => p.getByText(/Thank you!\s*We['’]ve received/i),
    screenshotName: 'contact-us-bahrain-success',
  },
  {
    specKey: 'azerbaijan-visa',
    name: 'Azerbaijan Visa',
    url: 'https://azerbaijan-visa.info/contact-us/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.locator('form#contact').getByRole('textbox', { name: 'name', exact: true }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#contact').getByRole('textbox', { name: 'email', exact: true }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#contact').getByRole('textbox', { name: 'phone', exact: true }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#contact').getByRole('textbox', { name: 'message', exact: true }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form#contact').getByRole('button', { name: 'Send', exact: true }),
    successMessage: (p) => p.getByText(/Successfully submitted!/i),
    screenshotName: 'contact-us-azerbaijan-success',
  },
  {
    specKey: 'benin-e-visa',
    name: 'Benin E-Visa',
    url: 'https://benin-e-visa.com/contact-us/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.locator('#name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('#email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByLabel('List of countries').getByText('+91'),
      },
      { locator: (p) => p.locator('#phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('#message'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/Your message has been sent\./i),
    screenshotName: 'contact-us-benin-success',
  },
  {
    specKey: 'brazil-evisa',
    name: 'Brazil E-Visa',
    url: 'https://brazil-evisa.info/contact/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/We appreciate your message\./i),
    screenshotName: 'contact-us-brazil-success',
  },
  {
    specKey: 'burkina-faso-evisa',
    name: 'Burkina Faso E-Visa',
    url: 'https://burkina-faso-evisa.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Your Name' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Your Email' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionText: 'India',
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you for reaching out\./i),
    screenshotName: 'contact-us-burkina-faso-success',
  },
  {
    specKey: 'cambodia-evisa',
    name: 'Cambodia E-Visa',
    url: 'https://cambodia-evisa.info/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByLabel('List of countries').getByText('+91'),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: /Send Message/i }),
    successMessage: (p) => p.getByText(/We['’]ve logged your inquiry/i),
    screenshotName: 'contact-us-cambodia-success',
  },
  {
    specKey: 'cameroon-visa',
    name: 'Cameroon Visa',
    url: 'https://visit-cameroon.info/contact-us/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.locator('form#contact #name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#contact #email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form#contact').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#contact #phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#contact #Passport_number'), value: STANDARD_CONTACT_PASSPORT },
      { locator: (p) => p.locator('form#contact #application_id'), value: STANDARD_CONTACT_ORDER_ID },
      { locator: (p) => p.locator('form#contact #subject'), value: STANDARD_CONTACT_SUBJECT },
      { locator: (p) => p.locator('form#contact #desc, form#contact #message'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form#contact #contact_of, form#contact button[type="submit"]').first(),
    successMessage: (p) => p.getByText(/thank you|query delivered|message.*sent|received/i).first(),
    screenshotName: 'contact-us-cameroon-success',
  },
  {
    specKey: 'congo-evisa',
    name: 'Congo E-Visa',
    url: 'https://congo-evisa.com/contact/',
    formSelector: 'form#contact',
    fields: [
      { locator: (p) => p.locator('form#contact #name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#contact #email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form#contact').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#contact #phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#contact #desc'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form#contact #contact_of'),
    successMessage: (p) => p.getByText(/Query delivered successfully/i),
    screenshotName: 'contact-us-congo-success',
  },
  {
    specKey: 'djibouti-evisa',
    name: 'Djibouti E-Visa',
    url: 'https://online.djibouti-evisa.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Your Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Your Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionText: 'India',
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you! Your message has/i),
    screenshotName: 'contact-us-djibouti-success',
  },
  {
    specKey: 'e-visa-cambodia',
    name: 'E-Visa Cambodia',
    url: 'https://e-visa-cambodia.com/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name*' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email*' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone*' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description*' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/Thank you, your message sent/i),
    screenshotName: 'contact-us-e-visa-cambodia-success',
  },
  {
    specKey: 'ecuador-evisa',
    name: 'Ecuador E-Visa',
    url: 'https://ecuador-evisa.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByLabel('List of countries').getByText('+91'),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Our team has your details/i),
    screenshotName: 'contact-us-ecuador-success',
  },
  {
    specKey: 'egypt-eta',
    name: 'Egypt ETA',
    url: 'https://egypt-eta.com/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/Thank you, your message sent/i),
    screenshotName: 'contact-us-egypt-success',
  },
  {
    specKey: 'esta-online',
    name: 'ESTA Online',
    url: 'https://esta-online.it.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL, dblClick: true },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you[—-]your message has/i),
    screenshotName: 'contact-us-esta-success',
  },
  {
    specKey: 'eta-canada',
    name: 'ETA Canada',
    url: 'https://eta-canada.info/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Full Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/Thank you! Your message has/i),
    screenshotName: 'contact-us-eta-canada-success',
  },
  {
    specKey: 'ethiopia-e-visa',
    name: 'Ethiopia E-Visa',
    url: 'https://ethiopia-e-visa.com/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit Message' }),
    successMessage: (p) => p.getByText(/We['’]ve successfully received/i),
    screenshotName: 'contact-us-ethiopia-success',
  },
  {
    specKey: 'evisa-egypt',
    name: 'E-Visa Egypt',
    url: 'https://eta-egypt.info/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Description *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Submit' }),
    successMessage: (p) => p.getByText(/We['’]ve got your message!/i),
    screenshotName: 'contact-us-evisa-egypt-success',
  },
  {
    specKey: 'evisa-gabon',
    name: 'E-Visa Gabon',
    url: 'https://evisa-gabon.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: /Send Message/i }),
    successMessage: (p) => p.getByText(/Thank you for contacting us\./i),
    screenshotName: 'contact-us-gabon-success',
  },
  {
    specKey: 'evisa-iraq',
    name: 'E-Visa Iraq',
    url: 'https://evisa-iraq.org/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Full Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email Address *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'How can we help you? *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you for contacting us\./i),
    screenshotName: 'contact-us-iraq-success',
  },
  {
    specKey: 'evisa-madagascar',
    name: 'E-Visa Madagascar',
    url: 'https://evisa-madagascar.it.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Your Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Your Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Your Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you! Your message has/i),
    screenshotName: 'contact-us-madagascar-success',
  },
  {
    specKey: 'evisa-mongolia',
    name: 'E-Visa Mongolia',
    url: 'https://evisa-mongolia.com/contact/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Name *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Email *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Phone Number *' }), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.getByRole('textbox', { name: 'Message *' }), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Send Message' }),
    successMessage: (p) => p.getByText(/Thank you! We will get back/i),
    screenshotName: 'contact-us-mongolia-success',
  },
  {
    specKey: 'evisa-myanmar',
    name: 'E-Visa Myanmar',
    url: 'https://evisa-myanmar.com/contact-us/',
    fields: [
      { locator: (p) => p.getByRole('textbox', { name: 'Enter your name: *' }), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.getByRole('textbox', { name: 'Enter your Email: *' }), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.getByRole('textbox', { name: 'Enter your phone: *' }), value: STANDARD_CONTACT_PHONE },
      {
        locator: (p) => p.getByRole('textbox', { name: 'Message: *' }),
        value: STANDARD_CONTACT_MESSAGE,
        preClickLocator: (p) => p.locator('#formCheckRe div').filter({ hasText: 'Message: *' }).nth(2),
      },
    ],
    submitButton: (p) => p.getByRole('button', { name: 'Get In touch' }),
    successMessage: (p) => p.getByText(/Your message sent/i),
    screenshotName: 'contact-us-myanmar-success',
  },
];

function buildContactFormSite(specKey: string, name: string, url: string): ContactUsSiteConfig {
  return {
    specKey,
    name,
    url,
    formSelector: 'form#contactForm',
    fields: [
      { locator: (p) => p.locator('form#contactForm #name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#contactForm #email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form#contactForm').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#contactForm #phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#contactForm #passport_number'), value: STANDARD_CONTACT_PASSPORT },
      { locator: (p) => p.locator('form#contactForm #applicationId'), value: STANDARD_CONTACT_ORDER_ID },
      { locator: (p) => p.locator('form#contactForm #subject'), value: STANDARD_CONTACT_SUBJECT },
      { locator: (p) => p.locator('form#contactForm #message'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form#contactForm #contact_of, form#contactForm button[type="submit"]').first(),
    successMessage: (p) =>
      p.getByText(/thank\s*you|we appreciate|message.{0,30}(sent|received)|query.{0,30}delivered|successfully\s*submitted/i),
    screenshotName: `contact-us-${specKey}-success`,
  };
}

function buildStandardContactSite(
  specKey: string,
  name: string,
  url: string,
  opts: {
    formSelector?: string;
    phoneSelector?: string;
    subjectSelector?: string;
    passportSelector?: string;
    orderSelector?: string;
    messageSelector?: string;
    submitSelector?: string;
  } = {}
): ContactUsSiteConfig {
  const form = opts.formSelector || 'form#contact';
  const phoneSel = opts.phoneSelector || `${form} #phone, ${form} #mobile`;
  const subjectSel = opts.subjectSelector || `${form} #subject, ${form} #enq_reason`;
  const passportSel = opts.passportSelector || `${form} #passport, ${form} #Passport, ${form} #Passport_number, ${form} #passport_number`;
  const orderSel = opts.orderSelector || `${form} #application, ${form} #ApplicationId, ${form} #application_id, ${form} #appId, ${form} #AppId, ${form} #app_id`;
  const msgSel = opts.messageSelector || `${form} #message, ${form} #desc, ${form} textarea`;
  const submitSel = opts.submitSelector || `${form} #contact_of, ${form} button[type="submit"]`;

  return {
    specKey,
    name,
    url,
    formSelector: form,
    fields: [
      { locator: (p) => p.locator(`${form} #name`), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator(`${form} #email`), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator(form).getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator(phoneSel), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator(passportSel), value: STANDARD_CONTACT_PASSPORT },
      { locator: (p) => p.locator(orderSel), value: STANDARD_CONTACT_ORDER_ID },
      { locator: (p) => p.locator(subjectSel), value: STANDARD_CONTACT_SUBJECT },
      { locator: (p) => p.locator(msgSel), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator(submitSel).first(),
    successMessage: (p) =>
      p.getByText(/thank\s*you|we appreciate|message.{0,30}(sent|received)|query.{0,30}delivered|successfully\s*submitted/i),
    screenshotName: `contact-us-${specKey}-success`,
  };
}

CONTACT_US_SITES.push(
  // ── form#contactForm family ──
  buildContactFormSite('evisa-rwanda', 'E-Visa Rwanda', 'https://evisa-rwanda.com/contact/'),
  buildContactFormSite('fiji-evisa', 'Fiji E-Visa', 'https://fiji-evisa.com/contact/'),
  buildContactFormSite('israel-evisa', 'Israel E-Visa', 'https://israel-evisa.com/contact/'),
  buildContactFormSite('ivory-coast', 'Ivory Coast E-Visa', 'https://ivory-coast-evisa.info/contact/'),
  buildContactFormSite('jordan-evisa', 'Jordan E-Visa', 'https://jordan-evisa.info/contact/'),
  buildContactFormSite('kazakhstan-evisa', 'Kazakhstan E-Visa', 'https://kazakhstan-evisa.com/contact/'),
  buildContactFormSite('malawi-evisa', 'Malawi E-Visa', 'https://malawi-evisa.com/contact/'),
  buildContactFormSite('mozambique-evisa', 'Mozambique E-Visa', 'https://mozambique-evisa.com/contact/'),
  buildContactFormSite('namibia-evisa', 'Namibia E-Visa', 'https://namibia-evisa.com/contact/'),
  buildContactFormSite('oman-evisa', 'Oman E-Visa', 'https://oman-evisa.info/contact/'),
  buildContactFormSite('seychelles-evisa', 'Seychelles E-Visa', 'https://seychelles-evisa.com/contact/'),
  buildContactFormSite('sri-lanka-evisa', 'Sri Lanka E-Visa', 'https://sri-lanka-evisa.info/contact/'),
  buildContactFormSite('taiwan-evisa', 'Taiwan E-Visa', 'https://taiwan-evisa.info/contact/'),
  buildContactFormSite('togo-evisa', 'Togo E-Visa', 'https://togo-evisa.com/contact/'),
  buildContactFormSite('uae-evisa', 'UAE E-Visa', 'https://uae-evisa.info/contact/'),
  buildContactFormSite('uganda-evisa', 'Uganda E-Visa', 'https://uganda-evisa.com/contact-us/'),
  buildContactFormSite('upload-fixing', 'ESTA Upload Fixing', 'https://esta-online.it.com/contact/'),

  // ── form#contact family ──
  buildStandardContactSite('evisa-tanzania', 'E-Visa Tanzania', 'https://evisa-tanzania.it.com/contact-us/'),
  buildStandardContactSite('georgia-evisa', 'Georgia E-Visa', 'https://georgia-evisa.info/contact-us/'),
  buildStandardContactSite('indonesia-e-visa', 'Indonesia E-Visa', 'https://indonesia-e-visa.com/contact-us/'),
  buildStandardContactSite('japan-e-visa', 'Japan E-Visa', 'https://japan-e-visa.info/contact-us/'),
  buildStandardContactSite('kenya-eta', 'Kenya ETA', 'https://kenya-eta.info/contact-us/'),
  buildStandardContactSite('kuwait-evisa', 'Kuwait E-Visa', 'https://kuwait-evisa.info/contact-us/'),
  buildStandardContactSite('lao-evisa', 'Lao E-Visa', 'https://lao-evisa.com/contact-us/'),
  buildStandardContactSite('mexico', 'Mexico E-Visa', 'https://mexico-e-visa.com/contact/'),
  buildStandardContactSite('moroccan-visa', 'Moroccan Visa', 'https://moroccan-visa.com/contact/', {
    formSelector: 'form#tab-contact',
  }),
  buildStandardContactSite('nz-eta', 'New Zealand ETA', 'https://nz-eta.info/contact-us/'),
  buildStandardContactSite('russian-e-visa', 'Russian E-Visa', 'https://russian-e-visa.com/contact-us/'),
  buildStandardContactSite('sa-evisa', 'South Africa E-Visa', 'https://sa-evisa.com/contact-us/'),
  buildStandardContactSite('saudi-arabia-evisa', 'Saudi Arabia E-Visa', 'https://saudi-arabia-eta.it.com/contact/'),
  buildStandardContactSite('thai-evisa', 'Thai E-Visa', 'https://thai-evisa.info/contact-us/'),
  buildStandardContactSite('united-kingdom-visa', 'United Kingdom Visa', 'https://united-kingdom-visa.com/contact/'),
  buildStandardContactSite('visa-armenia', 'Visa Armenia', 'https://visa-armenia.info/contact-us/'),
  buildStandardContactSite('visa-qatar', 'Visa Qatar', 'https://visa-qatar.com/contact-us/'),
  buildStandardContactSite('zambia-visa', 'Zambia Visa', 'https://zambia-visa.com/contact-us/'),
  buildStandardContactSite('zimbabwe-visa', 'Zimbabwe Visa', 'https://zimbabwe-visa.com/contact-us/'),

  // ── Custom form portals ──
  {
    specKey: 'India-evisa_it',
    name: 'India E-Visa',
    url: 'https://india-evisa.it.com/contact-us/',
    formSelector: 'form#formCheckRe',
    fields: [
      { locator: (p) => p.locator('form#formCheckRe #name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form#formCheckRe #email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form#formCheckRe').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('form#formCheckRe #phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('form#formCheckRe #passport'), value: STANDARD_CONTACT_PASSPORT },
      { locator: (p) => p.locator('form#formCheckRe #appID'), value: STANDARD_CONTACT_ORDER_ID },
      { locator: (p) => p.locator('form#formCheckRe #enq_reason'), value: STANDARD_CONTACT_SUBJECT },
      { locator: (p) => p.locator('form#formCheckRe #message'), value: STANDARD_CONTACT_MESSAGE },
    ],
    textCaptcha: {
      urlPatterns: ['get_captcha.php', 'create_captcha.php'],
      encodedHiddenSelector: '#cp_code',
      locator: (p) => p.locator('form#formCheckRe #chk'),
    },
    submitButton: (p) => p.locator('form#formCheckRe').getByRole('button', { name: /Get In touch|Submit/i }).first(),
    successMessage: (p) =>
      p.getByText(/thank\s*you|your message sent|successfully|received/i),
    screenshotName: 'contact-us-india-evisa-success',
  },
  {
    specKey: 'Kyrgyzstan-evisa',
    name: 'Kyrgyzstan E-Visa',
    url: 'https://kyrgyzstan-evisa.com/contact-us/',
    formSelector: 'form:has(#cf-name)',
    fields: [
      { locator: (p) => p.locator('#cf-name'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('#cf-email'), value: STANDARD_CONTACT_EMAIL },
      {
        locator: (p) => p.locator('form:has(#cf-name)').getByRole('combobox', { name: 'Selected country' }),
        value: '',
        isDropdown: true,
        searchValue: 'india',
        optionLocator: (p) => p.getByRole('option', { name: 'India +' }),
      },
      { locator: (p) => p.locator('#cf-phone'), value: STANDARD_CONTACT_PHONE },
      { locator: (p) => p.locator('#cf-passport'), value: STANDARD_CONTACT_PASSPORT },
      { locator: (p) => p.locator('#cf-order'), value: STANDARD_CONTACT_ORDER_ID },
      { locator: (p) => p.locator('#cf-subject'), value: STANDARD_CONTACT_SUBJECT },
      { locator: (p) => p.locator('#cf-message'), value: STANDARD_CONTACT_MESSAGE },
    ],
    submitButton: (p) => p.locator('form:has(#cf-name) button[type="submit"], form:has(#cf-name) button').filter({ hasText: /Send Message|Submit/i }).first(),
    successMessage: (p) =>
      p.getByText(/thank\s*you|message.{0,30}(sent|received)|successfully\s*submitted/i),
    screenshotName: 'contact-us-kyrgyzstan-success',
  },
  {
    specKey: 'turkey-evisa',
    name: 'Turkey E-Visa',
    url: 'https://turkey-evisa.it.com/contact-us/',
    formSelector: 'form.contact',
    fields: [
      { locator: (p) => p.locator('form.contact input[name="firstname"]'), value: STANDARD_CONTACT_NAME },
      { locator: (p) => p.locator('form.contact input[name="Email"]'), value: STANDARD_CONTACT_EMAIL },
      { locator: (p) => p.locator('form.contact input[name="ques_title"]'), value: 'Visa Application Status Inquiry and Processing Time' },
      { locator: (p) => p.locator('form.contact textarea[name="massage"]'), value: 'Hello support team, I would like to kindly inquire about the status of my visa application and the current processing time for my recent submission. Thank you very much.' },
    ],
    submitButton: (p) => p.locator('form.contact button#submit_btn').first(),
    successMessage: (p) =>
      p.getByText(/thank\s*you|your message sent|successfully|received|discussion/i).first(),
    screenshotName: 'contact-us-turkey-success',
  }
);

const IGNORED_POST_HOST_PATTERN =
  /google-analytics\.com|analytics\.google\.com|doubleclick\.net|clarity\.ms|cdn-cgi|play\.google\.com|intercom\.io|passkeys-log|google\.com\/recaptcha/i;

async function getVisibleContactFormError(page: Page, formSelector = 'form#contact'): Promise<string> {
  const scopeSelector = (await page.locator(formSelector).count().catch(() => 0)) > 0 ? formSelector : 'form';

  const visibleErrors = await page.locator(scopeSelector).evaluateAll((forms) =>
    forms.flatMap((form) =>
      Array.from(
        form.querySelectorAll(
          '[role="alert"], .error-message, .invalid-feedback, .wpcf7-response-output, [class*="-err"], [id^="error_"]'
        )
      )
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        })
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
        .filter((text): text is string => Boolean(text))
    )
  );

  if (visibleErrors.length) {
    return Array.from(new Set(visibleErrors)).slice(0, 5).join(' | ');
  }

  // Only inspect :invalid controls inside the actual contact form (excluding search bars / login modals)
  const browserValidationMessages = await page.locator(`${scopeSelector} :invalid`).evaluateAll((fields) =>
    fields
      .filter((field) => {
        const name = (field as HTMLInputElement).name || '';
        const formId = field.closest('form')?.id || '';
        return name !== 'q' && !/login/i.test(formId);
      })
      .map((field) => {
        const el = field as HTMLInputElement;
        const label = el.id || el.name || 'field';
        return el.validationMessage ? `${label}: ${el.validationMessage}` : '';
      })
      .filter(Boolean)
  );

  return Array.from(new Set(browserValidationMessages)).slice(0, 5).join(' | ');
}

async function selectCountryOption(page: Page, field: ContactUsField): Promise<void> {
  const el = field.locator(page).first();
  if (!(await el.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return;
  }
  await el.click();

  const searchBox = page.getByRole('combobox', { name: 'Search' }).first();
  if (await searchBox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await searchBox.fill(field.searchValue || 'india');
  } else {
    const fallbackSearch = page.getByPlaceholder('Search').first();
    if (await fallbackSearch.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await fallbackSearch.fill(field.searchValue || 'india');
    }
  }

  if (field.optionLocator) {
    const opt = field.optionLocator(page).first();
    if (await opt.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await opt.click();
      return;
    }
  }

  if (field.optionText) {
    const exactOpt = page.getByText(field.optionText, { exact: true }).first();
    if (await exactOpt.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await exactOpt.click();
      return;
    }
  }

  // Prioritize exact intl-tel-input India (+91) entry over fuzzy /India/i (avoids British Indian Ocean Territory)
  const itiIndia = page.locator('li.iti__country[data-country-code="in"]:visible, [data-country-code="in"]:visible').first();
  if (await itiIndia.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await itiIndia.click();
    return;
  }

  const indiaOpt = page.getByRole('option', { name: /^India\b/i }).first();
  if (await indiaOpt.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await indiaOpt.click();
    return;
  }

  const textIndia = page.locator('.iti__country-list li, .country-list li').filter({ hasText: /\+91/ }).first();
  if (await textIndia.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await textIndia.click();
  }
}

async function fillAndSubmit(page: Page, site: ContactUsSiteConfig, isGridRetry = false): Promise<ContactUsResult> {
  console.log(`[contactUs] Opening ${site.name} (${site.url}) with email ${STANDARD_CONTACT_EMAIL}${isGridRetry ? ' [visual-grid retry]' : ''}`);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const textCaptchaPromise = site.textCaptcha && !site.textCaptcha.encodedHiddenSelector
    ? waitForCaptchaCustom(
        page,
        site.textCaptcha.urlPatterns || ['get_captcha.php', 'create_captcha.php', 'simple-php-captcha.php']
      ).catch(() => null)
    : null;

  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPageLoad(page, { networkIdleTimeout: 5_000, loadTimeout: 25_000 });

  const pageTitle = await page.title().catch(() => '');
  const isCloudflareWall =
    /just a moment|attention required/i.test(pageTitle) ||
    (await page.locator('#challenge-running, #cf-challenge-running').isVisible({ timeout: 500 }).catch(() => false));
  if (isCloudflareWall) {
    const cfShot = await captureScreenshot(page, `${site.screenshotName || `contact-us-${site.specKey}`}-cloudflare`).catch(() => null);
    return {
      status: 'FAIL',
      screenshotPath: cfShot,
      reason: `Blocked by Cloudflare security challenge on ${site.url}.`,
    };
  }

  for (const field of site.fields) {
    if (field.isDropdown) {
      await selectCountryOption(page, field);
      continue;
    }

    const el = field.locator(page).first();
    if (!(await el.isVisible({ timeout: 2_500 }).catch(() => false))) {
      continue;
    }
    if (field.preClickLocator) {
      await field.preClickLocator(page).first().click().catch(() => {});
    }
    if (field.dblClick) {
      await el.dblclick();
    } else {
      await el.click();
    }
    await el.fill(field.value);
  }

  if (site.textCaptcha) {
    const captchaInput = site.textCaptcha.locator(page).first();
    if (await captchaInput.isVisible({ timeout: 2_500 }).catch(() => false)) {
      let decodedCaptcha: string | null = null;
      if (site.textCaptcha.encodedHiddenSelector) {
        const encoded = await page.locator(site.textCaptcha.encodedHiddenSelector).first().inputValue().catch(() => '');
        if (encoded) {
          try {
            let val = encoded.trim();
            for (let i = 0; i < 3; i++) {
              val = Buffer.from(val, 'base64').toString('utf8');
            }
            decodedCaptcha = val.trim() || null;
          } catch {
            decodedCaptcha = null;
          }
        }
      }
      if (!decodedCaptcha && textCaptchaPromise) {
        decodedCaptcha = await Promise.race([
          textCaptchaPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
        ]);
      }
      if (decodedCaptcha) {
        await captchaInput.fill(decodedCaptcha);
      }
    }
  }

  let successVisible = false;
  let ajaxConfirmedSuccess = false;
  let submitResponseStatus: number | null = null;
  let submitResponseOrigin = '';
  let submitResponsePath = '';
  let submitRequestFailure = '';
  const siteOrigin = new URL(site.url).origin;

  const onContactResponse = async (response: Response) => {
    const request = response.request();
    if (!['POST', 'PUT', 'PATCH'].includes(request.method())) return;
    const rawUrl = response.url();
    if (IGNORED_POST_HOST_PATTERN.test(rawUrl)) return;
    try {
      const responseUrl = new URL(rawUrl);
      submitResponseStatus = response.status();
      submitResponseOrigin = responseUrl.origin;
      submitResponsePath = responseUrl.pathname;
      if (responseUrl.origin === siteOrigin && response.status() >= 200 && response.status() < 300) {
        const text = await response.text().catch(() => '');
        if (/"status"\s*:\s*"SUCCESS"|"success"\s*:\s*true/i.test(text)) {
          ajaxConfirmedSuccess = true;
        }
      }
    } catch {
      // Ignore malformed URLs
    }
  };

  const onContactRequestFailed = (request: Request) => {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method())) return;
    const rawUrl = request.url();
    if (IGNORED_POST_HOST_PATTERN.test(rawUrl)) return;
    try {
      const requestUrl = new URL(rawUrl);
      submitRequestFailure = `${requestUrl.origin}${requestUrl.pathname}: ${request.failure()?.errorText || 'request failed'}`;
    } catch {
      // Ignore malformed URLs
    }
  };

  page.on('response', onContactResponse);
  page.on('requestfailed', onContactRequestFailed);

  let captchaBlocked = false;

  try {
    await site.submitButton(page).first().click();

    const genericSuccess = page
      .getByText(
        /thank\s*you|we appreciate your message|message.{0,30}(sent|received)|query.{0,30}delivered|submitted successfully/i
      )
      .first();

    // Wait briefly for immediate success OR an invisible reCAPTCHA challenge popup
    const immediateSuccess = await Promise.race([
      expect(site.successMessage(page).first()).toBeVisible({ timeout: 5_000 }).then(() => true).catch(() => false),
      expect(genericSuccess).toBeVisible({ timeout: 5_000 }).then(() => true).catch(() => false),
    ]);

    if (immediateSuccess) {
      successVisible = true;
    } else {
      const visibleChallenge = await page
        .locator('iframe[title*="recaptcha challenge" i]:visible')
        .isVisible({ timeout: 2_500 })
        .catch(() => false);

      if (visibleChallenge) {
        console.log(`[contactUs] ${site.name} presented reCAPTCHA challenge — invoking solver...`);
        const wasLimitedBefore = isAudioRateLimited();
        const solved = await Promise.race([
          solveRecaptchaChallenge(page, { dialogTimeout: 3_000, maxAttempts: 2 }),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15_000)),
        ]);
        if (!solved) {
          if (!wasLimitedBefore && isAudioRateLimited() && !isGridRetry) {
            console.log(`[contactUs] ${site.name}: audio challenge rate-limited; retrying once with direct visual grid solver...`);
            page.off('response', onContactResponse);
            page.off('requestfailed', onContactRequestFailed);
            return await fillAndSubmit(page, site, true);
          }
          captchaBlocked = true;
        } else {
          successVisible =
            (await expect(site.successMessage(page).first()).toBeVisible({ timeout: 6_000 }).then(() => true).catch(() => false)) ||
            (await expect(genericSuccess).toBeVisible({ timeout: 4_000 }).then(() => true).catch(() => false));
        }
      } else {
        // Give async AJAX a bit more time for DOM confirmation
        successVisible =
          (await expect(site.successMessage(page).first()).toBeVisible({ timeout: 5_000 }).then(() => true).catch(() => false)) ||
          (await expect(genericSuccess).toBeVisible({ timeout: 3_000 }).then(() => true).catch(() => false));
      }
    }
  } finally {
    page.off('response', onContactResponse);
    page.off('requestfailed', onContactRequestFailed);
  }

  const screenshotBase = site.screenshotName || `contact-us-${site.specKey}`;

  if (captchaBlocked) {
    const captchaShot = await captureScreenshot(page, `${screenshotBase}-captcha`).catch(() => null);
    return {
      status: 'CAPTCHA_BLOCKED',
      screenshotPath: captchaShot,
      reason: 'Google reCAPTCHA challenge could not be bypassed automatically.',
    };
  }

  const formError = successVisible ? '' : await getVisibleContactFormError(page, site.formSelector).catch(() => '');
  const reason = successVisible
    ? undefined
    : formError ||
      (submitRequestFailure
        ? `Contact form request failed: ${submitRequestFailure}.`
        : submitResponseStatus !== null && submitResponseStatus >= 400
          ? `Contact form request to ${submitResponseOrigin}${submitResponsePath} returned HTTP ${submitResponseStatus}.`
          : submitResponseStatus !== null
            ? `Contact form request to ${submitResponseOrigin}${submitResponsePath} returned HTTP ${submitResponseStatus}, but no success confirmation appeared.`
            : `No form POST response was observed on ${siteOrigin}, and no success confirmation appeared.`);

  const screenshotPath = await captureScreenshot(
    page,
    successVisible ? screenshotBase : `${screenshotBase}-failed`
  ).catch(() => null);

  if (successVisible) {
    console.log(`[contactUs] ${site.name} form submitted successfully (${STANDARD_CONTACT_EMAIL}).`);
    return { status: 'PASS', screenshotPath };
  }

  console.warn(`[contactUs] ${site.name} form could not be confirmed as submitted: ${reason}`);
  return { status: 'FAIL', screenshotPath, reason };
}

async function fillAndSubmitGenericContactForm(page: Page, specKey: string): Promise<ContactUsResult> {
  let baseUrl: URL;
  try {
    baseUrl = new URL(page.url());
  } catch {
    return { status: 'SKIPPED', screenshotPath: null };
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    return { status: 'SKIPPED', screenshotPath: null };
  }

  const contactLink = await page.locator('a[href]').evaluateAll((anchors) => {
    const link = anchors.find((anchor) => {
      const text = anchor.textContent || '';
      const href = anchor.getAttribute('href') || '';
      return /contact/i.test(`${text} ${href}`);
    });
    return link?.getAttribute('href') || null;
  });

  const candidateUrls = [
    contactLink ? new URL(contactLink, baseUrl).href : null,
    new URL('/contact-us/', baseUrl).href,
    new URL('/contact/', baseUrl).href,
    new URL('/contact-us', baseUrl).href,
    new URL('/contact', baseUrl).href,
  ].filter((url): url is string => Boolean(url));

  let contactPageFound = false;
  for (const url of [...new Set(candidateUrls)]) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      if (!response?.ok()) continue;
      await waitForPageLoad(page, { loadTimeout: 5_000, networkIdleTimeout: 3_000 });
      if (await page.locator('form#contact, form').count()) {
        contactPageFound = true;
        console.log(`[contactUs] Using discovered Contact Us page: ${page.url()}`);
        break;
      }
    } catch {
      // Try next route
    }
  }

  if (!contactPageFound) {
    return { status: 'FAIL', screenshotPath: null, reason: 'No Contact Us form was found on the site.' };
  }

  const scope = (await page.locator('form#contact').count()) > 0 ? 'form#contact' : 'form';
  const fillFirstVisible = async (selectors: string[], value: string): Promise<boolean> => {
    for (const selector of selectors) {
      const field = page.locator(selector).first();
      if (await field.isVisible().catch(() => false)) {
        await field.fill(value);
        return true;
      }
    }
    return false;
  };

  const hasName = await fillFirstVisible(
    [
      `${scope} input[autocomplete="name"]`,
      `${scope} input[name*="name" i]`,
      `${scope} input[id*="name" i]`,
      `${scope} input[placeholder*="name" i]`,
      `${scope} input[type="text"]`,
    ],
    STANDARD_CONTACT_NAME
  );

  const hasEmail = await fillFirstVisible(
    [
      `${scope} input[type="email"]`,
      `${scope} input[name*="email" i]`,
      `${scope} input[id*="email" i]`,
      `${scope} input[placeholder*="email" i]`,
    ],
    STANDARD_CONTACT_EMAIL
  );

  await fillFirstVisible(
    [
      `${scope} input[type="tel"]`,
      `${scope} input[name*="phone" i]`,
      `${scope} input[id*="phone" i]`,
      `${scope} input[placeholder*="phone" i]`,
    ],
    STANDARD_CONTACT_PHONE
  );

  const hasMessage = await fillFirstVisible(
    [
      `${scope} textarea[name*="message" i]`,
      `${scope} textarea[id*="message" i]`,
      `${scope} textarea[placeholder*="message" i]`,
      `${scope} textarea`,
    ],
    STANDARD_CONTACT_MESSAGE
  );

  if (!hasName || !hasEmail || !hasMessage) {
    const screenshotPath = await captureScreenshot(page, `contact-us-${specKey}-form-unrecognized`).catch(() => null);
    return {
      status: 'FAIL',
      screenshotPath,
      reason: 'The contact form name, email, or message fields were not recognized.',
    };
  }

  const submitButton = page.locator(scope).getByRole('button', { name: /submit|send/i }).first();
  const submitInput = page.locator(`${scope} input[type="submit"]`).first();

  if (await submitButton.isVisible().catch(() => false)) {
    await submitButton.click();
  } else if (await submitInput.isVisible().catch(() => false)) {
    await submitInput.click();
  } else {
    const screenshotPath = await captureScreenshot(page, `contact-us-${specKey}-submit-not-found`).catch(() => null);
    return { status: 'FAIL', screenshotPath, reason: 'No visible Submit or Send button was found.' };
  }

  const successMessage = page
    .getByText(/thank\s*you|success|message.{0,30}(sent|received)|query.{0,30}delivered/i)
    .first();

  let success = await successMessage.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!success) {
    const visibleChallenge = await page
      .locator('iframe[title*="recaptcha challenge" i]:visible')
      .isVisible({ timeout: 2_500 })
      .catch(() => false);

    if (visibleChallenge) {
      const solved = await Promise.race([
        solveRecaptchaChallenge(page, { dialogTimeout: 3_000, maxAttempts: 2 }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15_000)),
      ]);
      if (!solved) {
        const captchaShot = await captureScreenshot(page, `contact-us-${specKey}-captcha`).catch(() => null);
        return {
          status: 'CAPTCHA_BLOCKED',
          screenshotPath: captchaShot,
          reason: 'Google reCAPTCHA challenge could not be bypassed automatically.',
        };
      }
      success = await successMessage.isVisible({ timeout: 10_000 }).catch(() => false);
    }
  }

  const screenshotPath = await captureScreenshot(
    page,
    `contact-us-${specKey}${success ? '-success' : '-result'}`
  ).catch(() => null);

  const reason = success
    ? undefined
    : (await getVisibleContactFormError(page, scope).catch(() => '')) ||
      'Submit was clicked, but no success confirmation appeared within 10 seconds.';

  return { status: success ? 'PASS' : 'FAIL', screenshotPath, reason };
}

export async function submitContactUsForm(page: Page, specKey: string): Promise<ContactUsResult> {
  const normalizedKey = specKey.toLowerCase();
  const site = CONTACT_US_SITES.find((s) => s.specKey.toLowerCase() === normalizedKey);
  if (!site) {
    console.log(`[contactUs] No site-specific config for "${specKey}"; trying generic Contact Us form (${STANDARD_CONTACT_EMAIL}).`);
    try {
      return await fillAndSubmitGenericContactForm(page, specKey);
    } catch (err: any) {
      console.warn(`[contactUs] Generic submission failed for ${specKey} (ignored):`, err?.message || err);
      return {
        status: 'FAIL',
        screenshotPath: null,
        reason: err?.message || 'Generic Contact Us submission failed.',
      };
    }
  }

  try {
    return await fillAndSubmit(page, site);
  } catch (err: any) {
    console.warn(`[contactUs] ${site.name} submission failed (ignored):`, err?.message || err);
    return {
      status: 'FAIL',
      screenshotPath: null,
      reason: err?.message || 'Contact Us submission failed.',
    };
  }
}
