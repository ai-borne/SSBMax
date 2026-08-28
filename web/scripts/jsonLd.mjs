// Phase 6 (docs/plans/i-just-watched-a-nested-russell.md): pure builders for the JSON-LD
// structured-data blocks this project emits. Split out (mirrors prerenderHtml.mjs's own
// split) so tests can assert on the exact objects without going through HTML string
// building, and so scripts/prerenderContentRoutes.mjs and scripts/cspHeaders.mjs can both
// consume the *same* serialized string -- the CSP hash must match the embedded script byte
// for byte, so there can only be one place that produces it.
export const SITE_BASE_URL = 'https://ssbmax.in';

/** Home-page Organization node -- static, identical on every build (embedded in index.html). */
export function buildOrganizationJsonLd(siteBaseUrl = SITE_BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SSBMax',
    url: siteBaseUrl,
    description: 'SSB (Services Selection Board) preparation platform for Indian Armed Forces officer selection.',
    logo: `${siteBaseUrl}/apple-touch-icon.png`,
  };
}

/** Home-page WebSite node -- static, identical on every build (embedded in index.html). */
export function buildWebSiteJsonLd(siteBaseUrl = SITE_BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SSBMax',
    url: siteBaseUrl,
  };
}

/** Home > Study > topic breadcrumb trail for one content route. */
export function buildBreadcrumbListJsonLd({ title, path, siteBaseUrl = SITE_BASE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteBaseUrl },
      { '@type': 'ListItem', position: 2, name: 'Study', item: `${siteBaseUrl}/study` },
      { '@type': 'ListItem', position: 3, name: title, item: `${siteBaseUrl}${path}` },
    ],
  };
}

/**
 * Course + LearningResource node for one content/study page. Two schema.org types on one
 * node (valid per spec via an @type array) since a study guide is genuinely both -- rather
 * than picking one and losing the other's required-field guidance.
 */
export function buildCourseJsonLd({ topic, seo, path, siteBaseUrl = SITE_BASE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': ['Course', 'LearningResource'],
    name: topic.title,
    description: seo.description,
    url: `${siteBaseUrl}${path}`,
    provider: {
      '@type': 'Organization',
      name: 'SSBMax',
      url: siteBaseUrl,
    },
    learningResourceType: 'Study Guide',
    educationalLevel: 'Professional',
    inLanguage: 'en',
  };
}

/** Every JSON-LD node for one content page, in the exact order embedded in the page. */
export function buildContentPageJsonLd({ topic, seo, path, siteBaseUrl = SITE_BASE_URL }) {
  return [
    buildCourseJsonLd({ topic, seo, path, siteBaseUrl }),
    buildBreadcrumbListJsonLd({ title: topic.title, path, siteBaseUrl }),
  ];
}

/**
 * FAQPage node for /faq (Phase 7, deferred from Phase 6) -- one Question/Answer pair per
 * mainEntity entry, straight from the same parsed {question, answer} pairs the visible page
 * renders, so the structured data can never drift from the displayed text.
 */
export function buildFaqPageJsonLd({ faq, siteBaseUrl = SITE_BASE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.questions.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

/** Serializes a JSON-LD node exactly as embedded in HTML -- the one string both the page and its CSP hash are derived from. */
export function serializeJsonLd(node) {
  return JSON.stringify(node);
}
