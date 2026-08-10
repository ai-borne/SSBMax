'use strict';

const { GENERATED_AT_COMMAND } = require('./header');

// Flat list of every Firestore path a client or function reads/writes, for
// the firestore.rules linter.
function emitRulesPaths(data) {
  const { firestorePaths } = data;
  const paths = [];
  for (const c of firestorePaths.collections) paths.push(c.path);
  for (const tc of firestorePaths.testContent) {
    paths.push(tc.batchesPath);
    if (tc.metaConfigPath) paths.push(tc.metaConfigPath);
  }
  const unique = Array.from(new Set(paths)).sort();
  return JSON.stringify(
    {
      schemaVersion: firestorePaths.schemaVersion,
      generatedBy: GENERATED_AT_COMMAND,
      paths: unique,
    },
    null,
    2,
  ) + '\n';
}

module.exports = { emitRulesPaths };
