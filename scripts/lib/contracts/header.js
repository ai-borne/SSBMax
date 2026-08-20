'use strict';

const GENERATED_AT_COMMAND = 'node scripts/generate-contracts.js';

const ALL_SOURCE_FILES = ['firestore-paths.yaml', 'enums.yaml', 'subscription.yaml', 'pricing.yaml', 'test-config.yaml', 'events.yaml', 'routes.yaml', 'tokens.yaml'];

function header(commentStyle, sourceFiles) {
  const lines = [
    'DO NOT EDIT. Generated file — hand edits will be overwritten and are',
    'caught by `npm run contracts:check` in CI / pre-commit.',
    '',
    `Source: ${sourceFiles.join(', ')} (contracts/README.md documents the SSOT policy)`,
    `Regenerate: ${GENERATED_AT_COMMAND}`,
    '',
    'SRP justification for exceeding the project 300-LOC limit: this file has',
    'exactly one responsibility — mirror its YAML contract sources 1:1 into',
    'this target language. Splitting it would break that 1:1 mapping. See',
    'contracts/README.md "Generated-file LOC exemption".',
  ];
  if (commentStyle === 'kt' || commentStyle === 'ts' || commentStyle === 'cjs' || commentStyle === 'css') {
    return `/**\n${lines.map((l) => ` * ${l}`.replace(/\s+$/, '')).join('\n')}\n */\n`;
  }
  throw new Error(`unknown comment style ${commentStyle}`);
}

module.exports = { header, GENERATED_AT_COMMAND, ALL_SOURCE_FILES };
