'use strict';

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./yaml');

const ROOT = path.resolve(__dirname, '../../..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const GENERATED_DIR = path.join(ROOT, 'generated');

const MIRROR_TARGETS = {
  'SsbContracts.kt': path.join(ROOT, 'shared/src/commonMain/kotlin/com/ssbmax/shared/contracts/SsbContracts.kt'),
  'contracts.ts': path.join(ROOT, 'web/src/generated/contracts.ts'),
  'contracts.cjs': path.join(ROOT, 'functions/src/generated/contracts.cjs'),
};

function loadContract(filename) {
  const p = path.join(CONTRACTS_DIR, filename);
  const text = fs.readFileSync(p, 'utf8');
  const data = parseYaml(text, filename);
  if (!data.schemaVersion) {
    throw new Error(`${filename}: missing required 'schemaVersion' field`);
  }
  return data;
}

// Bundled as a plain object so the emitters are pure functions of their
// input — this is what lets tests feed them a small fixture bundle instead
// of the real contracts/*.yaml (golden-file test).
function loadAllContracts() {
  return {
    firestorePaths: loadContract('firestore-paths.yaml'),
    enums: loadContract('enums.yaml'),
    subscription: loadContract('subscription.yaml'),
    testConfig: loadContract('test-config.yaml'),
    events: loadContract('events.yaml'),
    routes: loadContract('routes.yaml'),
  };
}

module.exports = { ROOT, CONTRACTS_DIR, GENERATED_DIR, MIRROR_TARGETS, loadContract, loadAllContracts };
