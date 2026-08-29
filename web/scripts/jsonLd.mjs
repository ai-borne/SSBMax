// Pure builders for the JSON-LD structured-data blocks this project emits. Split out
// (mirrors prerenderHtml.mjs's own split) so tests can assert on the exact objects without
// going through HTML string building, and so scripts/prerenderContentRoutes.mjs and
// scripts/cspHeaders.mjs can both consume the *same* serialized string -- the CSP hash must
// match the embedded script byte for byte, so there can only be one place that produces it.
// Organization/WebSite/Course/LearningResource/BreadcrumbList/FAQPage(faq.md) shipped as
// Phase 6 of docs/plans/i-just-watched-a-nested-russell.md; the ItemList outline, HowTo
// (from timeline blocks), and the Myth/Reality-pair FAQPage were added for Phase 6 of
// docs/plans/write-the-phased-plan-wobbly-pancake.md. `SITE_BASE_URL` here is also the one
// definition `seoFiles.mjs`, `prerenderHtml.mjs`, and `src/routes/contentRoutes.ts` import,
// rather than each redeclaring the literal.
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

/**
 * Every JSON-LD node for one content page, in the exact order embedded in the page.
 * Course/LearningResource and BreadcrumbList are unconditional; the ItemList outline, one
 * HowTo per timeline section, and a Myth/Reality FAQPage are appended only when the topic's
 * content actually contains that shape (D1's spirit applied to structured data: a page with
 * no timeline emits no empty HowTo).
 */
export function buildContentPageJsonLd({ topic, seo, path, siteBaseUrl = SITE_BASE_URL }) {
  const nodes = [
    buildCourseJsonLd({ topic, seo, path, siteBaseUrl }),
    buildBreadcrumbListJsonLd({ title: topic.title, path, siteBaseUrl }),
  ];

  const headedSections = collectAllSections(topic).filter((section) => section.heading);
  if (headedSections.length > 0) {
    nodes.push(buildSectionItemListJsonLd({ sections: headedSections, path, siteBaseUrl }));
  }

  for (const timeline of collectTimelines(topic)) {
    nodes.push(buildHowToJsonLd({ ...timeline, siteBaseUrl }));
  }

  const mythRealityPairs = extractMythRealityFaqPairs(topic);
  if (mythRealityPairs.length > 0) {
    nodes.push(buildFaqPageJsonLdFromPairs(mythRealityPairs, siteBaseUrl));
  }

  return nodes;
}

/**
 * FAQPage node from an arbitrary list of {question, answer} pairs -- the one builder both
 * /faq's real questions and the Myth/Reality extraction below route through, so the two
 * FAQPage sources (`content/faq.md` and `**Myth N**`/`**Reality**` comparison pairs) can
 * never diverge in shape.
 */
export function buildFaqPageJsonLdFromPairs(pairs, siteBaseUrl = SITE_BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

/**
 * FAQPage node for /faq -- one Question/Answer pair per mainEntity entry, straight from the
 * same parsed {question, answer} pairs the visible page renders, so the structured data can
 * never drift from the displayed text.
 */
export function buildFaqPageJsonLd({ faq, siteBaseUrl = SITE_BASE_URL }) {
  return buildFaqPageJsonLdFromPairs(faq.questions, siteBaseUrl);
}

/**
 * HowTo node from one section's timeline block -- `steps` is a timeline block's `steps` array
 * (content/SCHEMA.md: `{label, text}`, e.g. `{label: "9:00 AM", text: "Reporting and briefing"}`
 * or `{label: "4 Weeks Before", text: "..."}`), so each step's `label` is naturally a HowToStep
 * name and `text` its instructions -- no reshaping needed at the call site.
 */
export function buildHowToJsonLd({ name, steps, siteBaseUrl = SITE_BASE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps.map(({ label, text }) => ({
      '@type': 'HowToStep',
      name: label,
      text,
    })),
  };
}

/**
 * ItemList node enumerating a content page's `##` sections in document order -- the same
 * outline the sticky TOC (Phase 2, docs/plans/write-the-phased-plan-wobbly-pancake.md) renders,
 * so an AI engine can cite one section by URL fragment instead of only the page as a whole.
 */
export function buildSectionItemListJsonLd({ sections, path, siteBaseUrl = SITE_BASE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: sections.map((section, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: section.heading,
      url: `${siteBaseUrl}${path}#${section.slug}`,
    })),
  };
}

/**
 * Every DocumentModel section across one topic page -- its introduction plus every material's
 * body, in the order the page actually renders them. The one walk that `buildContentPageJsonLd`
 * (ItemList, HowTo, and Myth/Reality FAQPage all need the identical section list) performs once.
 */
function collectAllSections(topic) {
  const introSections = topic.introductionSections?.sections ?? [];
  const materialSections = (topic.materials ?? []).flatMap((material) => material.sections?.sections ?? []);
  return [...introSections, ...materialSections];
}

/** One {name, steps} entry per section containing a `timeline` block, for `buildHowToJsonLd`. */
function collectTimelines(topic) {
  const timelines = [];
  for (const section of collectAllSections(topic)) {
    for (const block of section.blocks) {
      if (block.type === 'timeline') {
        timelines.push({ name: section.heading ?? topic.title, steps: block.steps });
      }
    }
  }
  return timelines;
}

const MYTH_LABEL_RE = /^myth/i;
const REALITY_LABEL_RE = /^reality/i;

/**
 * {question, answer} pairs from `**Myth N**`/`**Reality**` comparison pairs across a topic's
 * sections -- the "Typed callouts ... Myth->Reality pairs become FAQPage JSON-LD" readability
 * device (docs/plans/write-the-phased-plan-wobbly-pancake.md). Only an exact Myth-then-Reality
 * adjacency counts: Wrong/Right and Problem/Solution comparison pairs are corrective advice,
 * not a question a candidate would ask, so they stay out of FAQPage.
 */
export function extractMythRealityFaqPairs(topic) {
  const pairs = [];
  for (const section of collectAllSections(topic)) {
    for (const block of section.blocks) {
      if (block.type !== 'comparison') continue;
      for (let i = 0; i < block.pairs.length - 1; i += 1) {
        const myth = block.pairs[i];
        const reality = block.pairs[i + 1];
        if (MYTH_LABEL_RE.test(myth.label) && REALITY_LABEL_RE.test(reality.label)) {
          pairs.push({ question: myth.text, answer: reality.text });
        }
      }
    }
  }
  return pairs;
}

/** Serializes a JSON-LD node exactly as embedded in HTML -- the one string both the page and its CSP hash are derived from. */
export function serializeJsonLd(node) {
  return JSON.stringify(node);
}
