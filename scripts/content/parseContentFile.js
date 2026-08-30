/**
 * Parses a `content/topics/*.md` or `content/study-materials/*.md` file into
 * { meta, body }. Frontmatter is intentionally not YAML: each line is
 * `key: <JSON value>`, so every value (strings with colons/quotes, numbers,
 * booleans, arrays) round-trips through JSON.parse/JSON.stringify with no
 * ambiguity and no parser dependency — see BLOCKER 3 in
 * docs/plans/i-just-watched-a-nested-russell.md for why content/ must be
 * deterministically reproducible without adding YAML edge cases.
 */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseContentFile(raw, sourcePath) {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(`${sourcePath}: missing --- frontmatter block`);
  }
  const [, frontmatter, body] = match;
  const meta = {};
  for (const line of frontmatter.split('\n')) {
    if (!line.trim()) continue;
    const sepIndex = line.indexOf(': ');
    if (sepIndex === -1) {
      throw new Error(`${sourcePath}: malformed frontmatter line: ${JSON.stringify(line)}`);
    }
    const key = line.slice(0, sepIndex);
    const rawValue = line.slice(sepIndex + 2);
    try {
      meta[key] = JSON.parse(rawValue);
    } catch (e) {
      throw new Error(`${sourcePath}: frontmatter key "${key}" is not valid JSON: ${e.message}`);
    }
  }
  return { meta, body: body.trim() };
}

const PLACEHOLDER_BODY = 'Content for this material is being prepared. Please check back soon!';
const MIN_BODY_WORDS = 20;

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/** Throws if a parsed content file's body is missing, a known placeholder, or below MIN_BODY_WORDS. */
function assertPublishable(parsed, sourcePath) {
  if (!parsed.body) {
    throw new Error(`${sourcePath}: empty body`);
  }
  if (parsed.body === PLACEHOLDER_BODY) {
    throw new Error(`${sourcePath}: still the "being prepared" placeholder — write real content before publishing`);
  }
  if (wordCount(parsed.body) < MIN_BODY_WORDS) {
    throw new Error(`${sourcePath}: body has fewer than ${MIN_BODY_WORDS} words (${wordCount(parsed.body)}) — looks like a stub`);
  }
}

module.exports = { parseContentFile, assertPublishable, PLACEHOLDER_BODY, MIN_BODY_WORDS, wordCount };
