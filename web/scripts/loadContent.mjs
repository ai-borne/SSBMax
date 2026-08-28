// Reads ../content/{topics,study-materials}/*.md (git-authored content — see
// BLOCKER 3, docs/plans/i-just-watched-a-nested-russell.md) at build time.
// Frontmatter format matches scripts/content/parseContentFile.js: each line
// is `key: <JSON value>`, deliberately not YAML — no parser dependency, no
// ambiguity for titles/tags containing colons or quotes.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// Resolved from cwd, not import.meta.url: Vitest transforms this module
// through a non-file:// URL, so an import.meta.url-based path breaks under
// `npm test` even though it works under plain `node`. Both entry points
// (`npm run content:validate` and `npm test`) run with cwd = web/.
const CONTENT_ROOT = join(process.cwd(), '..', 'content');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
export const PLACEHOLDER_BODY = 'Content for this material is being prepared. Please check back soon!';
export const MIN_BODY_WORDS = 20;

export function parseContentFile(raw, sourcePath) {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) throw new Error(`${sourcePath}: missing --- frontmatter block`);
  const [, frontmatter, body] = match;
  const meta = {};
  for (const line of frontmatter.split('\n')) {
    if (!line.trim()) continue;
    const sepIndex = line.indexOf(': ');
    if (sepIndex === -1) throw new Error(`${sourcePath}: malformed frontmatter line: ${JSON.stringify(line)}`);
    meta[line.slice(0, sepIndex)] = JSON.parse(line.slice(sepIndex + 2));
  }
  return { meta, body: body.trim() };
}

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/** Throws if body is missing, the known placeholder, or under MIN_BODY_WORDS. */
export function assertPublishable(body, sourcePath) {
  if (!body) throw new Error(`${sourcePath}: empty body`);
  if (body === PLACEHOLDER_BODY) throw new Error(`${sourcePath}: still the "being prepared" placeholder`);
  if (wordCount(body) < MIN_BODY_WORDS) throw new Error(`${sourcePath}: body has fewer than ${MIN_BODY_WORDS} words`);
}

function loadDir(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const sourcePath = join(dir, f);
      const { meta, body } = parseContentFile(readFileSync(sourcePath, 'utf8'), sourcePath);
      return { id: basename(f, '.md'), sourcePath, meta, body };
    });
}

/** All topic intro docs (content/topics/*.md). Does not validate — callers decide strict vs. lenient. */
export function loadTopics() {
  return loadDir(join(CONTENT_ROOT, 'topics'));
}

/** All study-material docs (content/study-materials/*.md). Does not validate — callers decide strict vs. lenient. */
export function loadStudyMaterials() {
  return loadDir(join(CONTENT_ROOT, 'study-materials'));
}

const FAQ_QUESTION_RE = /^##\s+(.+)$/;

/**
 * Splits the FAQ body into {question, answer} pairs on "## " headings (Phase 7). Kept out
 * of content/topics or content/study-materials deliberately -- FAQ is a web-only public
 * page, not a per-TestType topic, so it must not enter scripts/content/publishContent.js's
 * topic_content/study_materials sync (that would put a non-TestType "FAQ" doc in front of
 * KMP's ContentFeatureFlags dispatch for no reason).
 */
export function parseFaqQuestions(body, sourcePath) {
  const lines = body.split('\n');
  const questions = [];
  let current = null;
  for (const line of lines) {
    const match = FAQ_QUESTION_RE.exec(line);
    if (match) {
      current = { question: match[1].trim(), answer: '' };
      questions.push(current);
    } else if (current) {
      current.answer += (current.answer ? '\n' : '') + line;
    }
  }
  for (const q of questions) {
    q.answer = q.answer.trim();
  }
  if (questions.length === 0) {
    throw new Error(`${sourcePath}: no "## Question" headings found in FAQ body`);
  }
  const empty = questions.find((q) => !q.answer);
  if (empty) {
    throw new Error(`${sourcePath}: FAQ question "${empty.question}" has no answer`);
  }
  return questions;
}

/** content/faq.md -- a single, top-level file (not a directory of docs like topics/study-materials). */
export function loadFaq() {
  const sourcePath = join(CONTENT_ROOT, 'faq.md');
  const { meta, body } = parseContentFile(readFileSync(sourcePath, 'utf8'), sourcePath);
  const questions = parseFaqQuestions(body, sourcePath);
  return { sourcePath, meta, body, questions };
}
