// Phase 2 (docs/plans/CrossPlatform_SSOT): every Tier-1 path in
// generated/rules-paths.json must have a matching firestore.rules block, and
// every top-level firestore.rules block must resolve to either a contract
// path or a documented, dated exception (contracts/README.md "Reserved
// firestore.rules blocks"). This is a pure static check -- no emulator
// needed -- but lives here (not scripts/test/) because firestore.rules is
// the artifact under test, matching this directory's existing convention.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

const rulesPaths = JSON.parse(readFileSync(join(ROOT, 'generated/rules-paths.json'), 'utf8')).paths;
const rulesContent = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');

// Top-level `match /X/{param} {` blocks only (exactly 4-space indent) --
// nested blocks (e.g. `match /data/{document}` under `users/{userId}`) are
// relative sub-paths, not top-level collections, and are intentionally not
// part of this check.
const TOP_LEVEL_MATCH = /^ {4}match \/(.+)\/\{[^}]*\}\s*\{/gm;
const declaredRulePaths = new Set(
  [...rulesContent.matchAll(TOP_LEVEL_MATCH)]
    .map((m) => m[1])
    .filter((p) => p.length > 0 && !p.includes('=**'))
);

// Reserved: modeled (types exist) but not wired to any repository yet, per
// contracts/README.md "Reserved firestore.rules blocks (Phase 2, not in
// this contract)". Not contract paths -- must not be silently forgotten.
const RESERVED_UNSHIPPED = new Set([
  'tests',
  'test_questions',
  'test_configs',
  'batches',
  'batchEnrollments',
  'ai_grading_results',
  // Interview content is served from the top-level interview_questions /
  // interview_sessions collections, not a test_content/interview namespace;
  // these two blocks predate that design and nothing reads them.
  'test_content/interview/meta',
  'test_content/interview/question_batches'
]);

// TEST_CONTENT itself is a namespace prefix (FirestorePaths.TEST_CONTENT =
// "test_content"), never queried as a collection on its own -- every real
// read targets one of its testContent sub-paths, each checked below.
const NAMESPACE_ONLY = new Set(['test_content']);

// USER_DATA_SUBCOLLECTION/USER_SUBSCRIPTION_SUBCOLLECTION/USER_PROFILE_DOC_ID/
// USER_SUBSCRIPTION_TIER_DOC_ID/CONTENT_VERSIONS_GLOBAL_DOC_ID are real,
// code-referenced values (SsbContracts.FirestorePaths), but they're relative
// subcollection names or fixed document ids nested under a parent match
// block (e.g. `match /users/{userId} { match /data/{document} { ... } }`),
// not top-level collections -- the 4-space top-level-match extraction above
// can't see them. Verified present as nested blocks in firestore.rules by
// manual read at the time this list was written; not re-verified here.
// 'config' is FEATURE_FLAGS_CONFIG_DOC_ID (Phase 8) -- a fixed doc id under
// the top-level `feature_flags` collection (checked separately below), not
// its own collection.
const NESTED_OR_DOC_ID_ONLY = new Set(['data', 'subscription', 'profile', 'global', 'config']);

test('every contract collection/testContent path has a matching firestore.rules block', () => {
  const missing = [];
  for (const path of rulesPaths) {
    if (NAMESPACE_ONLY.has(path) || NESTED_OR_DOC_ID_ONLY.has(path)) continue;

    // metaConfigPath entries (e.g. "test_content/oir/meta/config") name a
    // single document; the rule matches the parent collection with a
    // wildcard doc param (`test_content/oir/meta/{document}`).
    const isMetaConfigDoc = /\/meta\/config$/.test(path);
    const target = isMetaConfigDoc ? path.replace(/\/config$/, '') : path;

    if (!declaredRulePaths.has(target)) {
      missing.push(path);
    }
  }
  assert.deepEqual(missing, [], `firestore.rules has no block for: ${missing.join(', ')}`);
});

test('every firestore.rules block resolves to a contract path or a documented reserved exception', () => {
  const contractPrefixes = new Set(
    rulesPaths.map((p) => (/\/meta\/config$/.test(p) ? p.replace(/\/config$/, '') : p))
  );

  const unknown = [...declaredRulePaths].filter(
    (p) => !contractPrefixes.has(p) && !RESERVED_UNSHIPPED.has(p)
  );
  assert.deepEqual(
    unknown,
    [],
    `firestore.rules block(s) with no contract entry and no reserved-exception entry: ${unknown.join(', ')}. ` +
      'Add the path to contracts/firestore-paths.yaml if it is real, or to RESERVED_UNSHIPPED (with a reason ' +
      'in contracts/README.md) if it guards an unshipped feature.'
  );
});

test('the two dead camelCase duplicate paths removed in Phase 2 do not reappear', () => {
  assert.equal(declaredRulePaths.has('studyMaterials'), false, 'studyMaterials was a dead alias of study_materials');
  assert.equal(declaredRulePaths.has('userProgress'), false, 'userProgress was a dead alias of user_progress');
});
