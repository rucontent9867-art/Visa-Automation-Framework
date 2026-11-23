/**
 * sectionDetector.js
 *
 * Auto-detects sections for every test() block across Playwright spec files.
 * Identifies sections by:
 *   1. Explicit comment / annotation (e.g. `// SECTION: Contact Us`, `// @section: Status Check`)
 *   2. Tag in test title or options (e.g. `@contact-us`, `@payment`, `@status`, `@section(FAQ)`)
 *   3. Enclosing describe block (e.g. `test.describe('Contact Us', ...)`)
 *   4. Title structure (e.g. `[Contact Us] Fill form`, `Azerbaijan Visa - Contact Us`, `Contact Us: Submit`)
 *   5. Section keywords in title or block code
 *   6. Dynamic fallback for future custom sections added by users.
 */

const fs = require('fs');
const path = require('path');

// Canonical section metadata & recognition patterns
const CANONICAL_PATTERNS = [
  {
    id: 'contact-us',
    name: 'Contact Us',
    regex: /\b(contact\s*us|contact|enquiry|inquiry|support|get\s*in\s*touch|customer\s*care)\b/i,
  },
  {
    id: 'status-check',
    name: 'Status Check',
    regex: /\b(status\s*check|check\s*status|track\s*application|tracking|visa\s*status|order\s*status)\b/i,
  },
  {
    id: 'payment',
    name: 'Payment',
    regex: /\b(payment|pay\s*fee|visa\s*fee|checkout|invoice|payment\s*gateway)\b/i,
  },
  {
    id: 'eligibility',
    name: 'Eligibility Check',
    regex: /\b(eligibility|requirements|who\s*can\s*apply|eligible)\b/i,
  },
  {
    id: 'faq',
    name: 'FAQ & Help',
    regex: /\b(faq|frequently\s*asked|questions|help\s*center)\b/i,
  },
  {
    id: 'feedback',
    name: 'Feedback',
    regex: /\b(feedback|review|rating|testimonials?)\b/i,
  },
  {
    id: 'application-flow',
    name: 'Application Flow',
    regex: /\b(application|apply|submission|form|e-?form|registration|signup|onboarding|general\s*details|document\s*upload|upload\s*documents?|attachments?)\b/i,
  },
];

/**
 * Converts a raw slug or string to clean Title Case section name
 */
function toSectionTitle(raw) {
  if (!raw) return 'Application Flow';
  const cleaned = raw.replace(/[\[\]@:_-]/g, ' ').trim().replace(/\s+/g, ' ');
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalizes section name against canonical list or generates clean title
 */
function normalizeSectionName(detected) {
  if (!detected) return 'Application Flow';
  const trimmed = detected.trim();
  for (const canon of CANONICAL_PATTERNS) {
    if (canon.regex.test(trimmed)) {
      return canon.name;
    }
  }
  return toSectionTitle(trimmed);
}

/**
 * Generates URL/slug-safe section ID
 */
function getSectionId(sectionName) {
  for (const canon of CANONICAL_PATTERNS) {
    if (canon.name.toLowerCase() === sectionName.toLowerCase() || canon.regex.test(sectionName)) {
      return canon.id;
    }
  }
  return sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'general';
}

/**
 * Extract sections from a single test() definition and its context
 *
 * @param {string} title Test title
 * @param {string} precedingCode Preceding lines/comments
 * @param {string} blockCode Code inside test body
 * @param {string} describeContext Enclosing test.describe title if any
 * @returns {string} Detected section name
 */
function detectTestSection(title, precedingCode = '', blockCode = '', describeContext = '') {
  // 1. Explicit comment annotation right before or inside: // @section: Contact Us or // SECTION: Contact Us
  const combinedComments = (precedingCode + '\n' + (blockCode.substring(0, 300)));
  const explicitCommentMatch = combinedComments.match(/(?:\/\/|\/\*)\s*@?section:\s*([^\r\n*\/]+)/i);
  if (explicitCommentMatch) {
    return normalizeSectionName(explicitCommentMatch[1]);
  }

  // 1b. Heading comment style: // === CONTACT US === or // CONTACT US
  const bannerCommentMatch = combinedComments.match(/(?:\/\/)\s*={3,}\s*([a-zA-Z\s]{3,30}?)\s*={3,}/i);
  if (bannerCommentMatch) {
    const candidate = bannerCommentMatch[1].trim();
    if (!/set\s*up|navigate|general|passport|upload|preview|payment\s*url/i.test(candidate)) {
      return normalizeSectionName(candidate);
    }
  }

  // 2. Explicit tag syntax in title: @section(Contact Us) or @section:contact-us
  const explicitTagMatch = title.match(/@section\(([^)]+)\)|@section:([a-zA-Z0-9_-]+)/i);
  if (explicitTagMatch) {
    return normalizeSectionName(explicitTagMatch[1] || explicitTagMatch[2]);
  }

  // 3. Generic Playwright tag in title: e.g. @contact-us, @payment, @status, @faq
  const tagMatches = title.match(/@([a-zA-Z0-9_-]+)/g);
  if (tagMatches) {
    for (const tag of tagMatches) {
      const cleanTag = tag.replace(/^@/, '');
      for (const canon of CANONICAL_PATTERNS) {
        if (canon.regex.test(cleanTag.replace(/[-_]/g, ' '))) {
          return canon.name;
        }
      }
    }
  }

  // 4. Bracketed prefix in title: [Contact Us] or [Status Check]
  const bracketMatch = title.match(/^\[(.*?)\]|\((.*?)\)$/);
  if (bracketMatch) {
    const candidate = bracketMatch[1] || bracketMatch[2];
    if (candidate && candidate.length > 2) {
      return normalizeSectionName(candidate);
    }
  }

  // 5. Enclosing test.describe() block context
  if (describeContext && describeContext.trim()) {
    for (const canon of CANONICAL_PATTERNS) {
      if (canon.regex.test(describeContext)) {
        return canon.name;
      }
    }
    // Custom describe name if not just country name
    if (!/visa|e-?visa|eta|online/i.test(describeContext) || /contact|status|faq/i.test(describeContext)) {
      return normalizeSectionName(describeContext);
    }
  }

  // 6. Title delimiter patterns: "Azerbaijan Visa - Contact Us" or "Contact Us: Submit Enquiry"
  const delimiterParts = title.split(/\s*-\s*|\s*:\s*/);
  if (delimiterParts.length > 1) {
    // Check last segment first (most common: "Country - Section")
    const lastPart = delimiterParts[delimiterParts.length - 1].trim();
    for (const canon of CANONICAL_PATTERNS) {
      if (canon.regex.test(lastPart)) {
        return canon.name;
      }
    }
    // Check first segment ("Section: Test")
    const firstPart = delimiterParts[0].trim();
    for (const canon of CANONICAL_PATTERNS) {
      if (canon.regex.test(firstPart)) {
        return canon.name;
      }
    }
  }

  // 7. General title pattern check
  for (const canon of CANONICAL_PATTERNS) {
    // Check if title specifically targets non-default canonicals
    if (canon.id !== 'application-flow' && canon.regex.test(title)) {
      return canon.name;
    }
  }

  // 8. Code body heuristics (e.g. page.goto to contact-us, status, etc.)
  if (blockCode) {
    const urlMatch = blockCode.match(/page\.goto\s*\(\s*['"`]([^'"`]+)['"`]/i);
    if (urlMatch) {
      const url = urlMatch[1].toLowerCase();
      if (url.includes('contact')) return 'Contact Us';
      if (url.includes('status') || url.includes('track')) return 'Status Check';
      if (url.includes('faq') || url.includes('help')) return 'FAQ & Help';
    }
  }

  // Default fallback for application test specs
  return 'Application Flow';
}

/**
 * Parses all test() blocks from a spec file content
 *
 * @param {string} content Full spec file text
 * @returns {Array<{ title: string, section: string, sectionId: string, line: number, tags: string[] }>}
 */
function parseSpecContent(content) {
  const lines = content.split('\n');
  const results = [];

  // Track describe block stack
  let currentDescribe = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect test.describe
    const descMatch = line.match(/test\.describe\s*(?:\.\w+)?\s*\(\s*(['"`])(.*?)\1/);
    if (descMatch) {
      currentDescribe = descMatch[2];
    }

    // Detect test( or test.only( or test.skip(
    const testMatch = line.match(/(?:^|\s)test(?:\.(?:only|skip))?\s*\(\s*(['"`])(.*?)\1/);
    if (testMatch) {
      const title = testMatch[2];
      const lineNum = i + 1;

      // Extract preceding 10 lines for comments
      const startPre = Math.max(0, i - 10);
      const precedingCode = lines.slice(startPre, i).join('\n');

      // Extract subsequent 30 lines for block body heuristics
      const endPost = Math.min(lines.length, i + 35);
      const blockCode = lines.slice(i, endPost).join('\n');

      // Extract tags
      const tags = (title.match(/@([a-zA-Z0-9_-]+)/g) || []).map((t) => t.toLowerCase());

      const section = detectTestSection(title, precedingCode, blockCode, currentDescribe);
      const sectionId = getSectionId(section);

      results.push({
        title,
        section,
        sectionId,
        line: lineNum,
        tags,
      });
    }
  }

  return results;
}

/**
 * Scans a single spec file from disk
 *
 * @param {string} specFileName e.g. "azerbaijan-visa.spec.ts"
 * @returns {Array<{ title: string, section: string, sectionId: string, line: number, tags: string[] }>}
 */
function getTestsForSpec(specFileName) {
  try {
    const testDirRel = process.env.TEST_DIR || './tests/spec';
    const filePath = path.resolve(process.cwd(), testDirRel, specFileName);
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf8');
    return parseSpecContent(content);
  } catch (err) {
    console.error(`[sectionDetector] Failed to parse spec file ${specFileName}:`, err.message);
    return [];
  }
}

/**
 * Scans all spec files in the configured test directory and compiles
 * an aggregated catalog of detected sections, counts, and per-spec mappings.
 */
function scanAllSections() {
  const testDirRel = process.env.TEST_DIR || './tests/spec';
  const testsDir = path.resolve(process.cwd(), testDirRel);

  if (!fs.existsSync(testsDir)) {
    return {
      sections: [],
      specMap: {},
      totalTests: 0,
      totalSpecs: 0,
    };
  }

  const files = fs.readdirSync(testsDir)
    .filter((f) => f.endsWith('.spec.ts') || f.endsWith('.spec.js'));

  const sectionCounts = new Map(); // sectionName -> { count: number, specs: Set<string> }
  const specMap = {};
  let totalTests = 0;

  for (const file of files) {
    const tests = getTestsForSpec(file);
    specMap[file] = tests;
    totalTests += tests.length;

    for (const t of tests) {
      if (!sectionCounts.has(t.section)) {
        sectionCounts.set(t.section, {
          id: t.sectionId,
          name: t.section,
          count: 0,
          specs: new Set(),
        });
      }
      const item = sectionCounts.get(t.section);
      item.count++;
      item.specs.add(file);
    }
  }

  // Convert to sorted array (Application Flow first, then by count)
  const sections = Array.from(sectionCounts.values()).map((s) => ({
    id: s.id,
    name: s.name,
    count: s.count,
    specCount: s.specs.size,
    specs: Array.from(s.specs),
  })).sort((a, b) => {
    if (a.name === 'Application Flow') return -1;
    if (b.name === 'Application Flow') return 1;
    return b.count - a.count;
  });

  return {
    sections,
    specMap,
    totalTests,
    totalSpecs: files.length,
  };
}

/**
 * Given a spec file and a list of disabled sections,
 * returns all test titles in that spec file that belong to the disabled sections.
 *
 * @param {string} specFileName
 * @param {string[]|string} disabledSections
 * @returns {string[]} Test titles that should be skipped
 */
function getDisabledTestTitles(specFileName, disabledSections) {
  if (!disabledSections) return [];
  const list = Array.isArray(disabledSections)
    ? disabledSections
    : disabledSections.split(/[|,]/).map((s) => s.trim()).filter(Boolean);

  if (list.length === 0) return [];

  const lowerList = list.map((s) => s.toLowerCase());
  const tests = getTestsForSpec(specFileName);

  return tests
    .filter((t) => lowerList.includes(t.section.toLowerCase()) || lowerList.includes(t.sectionId.toLowerCase()))
    .map((t) => t.title);
}

/**
 * Builds Playwright grepInvert pattern (or array) to skip disabled sections for a spec
 *
 * @param {string} specFileName
 * @param {string[]|string} disabledSections
 * @returns {string[]|null} Array of exact test title regex strings or null if none
 */
function getGrepInvertPatterns(specFileName, disabledSections) {
  const titlesToSkip = getDisabledTestTitles(specFileName, disabledSections);
  if (titlesToSkip.length === 0) return null;

  return titlesToSkip.map((title) => {
    return title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
}

module.exports = {
  detectTestSection,
  parseSpecContent,
  getTestsForSpec,
  scanAllSections,
  getDisabledTestTitles,
  getGrepInvertPatterns,
  normalizeSectionName,
  getSectionId,
};
