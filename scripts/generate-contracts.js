#!/usr/bin/env node
'use strict';

/**
 * SSBMax contracts generator (Phase 1, docs/plans/CrossPlatform_SSOT).
 *
 * Reads contracts/*.yaml and emits four generated, committed artifacts:
 *   generated/SsbContracts.kt   (mirrored into shared/)
 *   generated/contracts.ts      (mirrored into web/src/generated/)
 *   generated/contracts.cjs     (mirrored into functions/src/generated/)
 *   generated/rules-paths.json  (firestore.rules path linter input)
 *
 * This file is the CLI entry point + write/diff orchestration only. The YAML
 * parser, contract loader, and per-language emitters live under
 * scripts/lib/contracts/ (kept out of this file to respect the project's
 * 300-LOC-per-file limit — see root CLAUDE.md Quality Limits).
 *
 * Usage:
 *   node scripts/generate-contracts.js          # write generated/ + mirrors
 *   node scripts/generate-contracts.js --check   # dry-run, diff against committed output, exit 1 on drift
 */

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./lib/contracts/yaml');
const { ROOT, CONTRACTS_DIR, GENERATED_DIR, MIRROR_TARGETS, loadContract, loadAllContracts } = require('./lib/contracts/load');
const { GENERATED_AT_COMMAND } = require('./lib/contracts/header');
const { emitKotlin } = require('./lib/contracts/emit-kotlin');
const { emitTypeScript } = require('./lib/contracts/emit-typescript');
const { emitCjs } = require('./lib/contracts/emit-cjs');
const { emitRulesPaths } = require('./lib/contracts/emit-rules-paths');
const { emitCss } = require('./lib/contracts/emit-css');

function generateAll(data) {
  const bundle = data || loadAllContracts();
  return {
    'SsbContracts.kt': emitKotlin(bundle),
    'contracts.ts': emitTypeScript(bundle),
    'contracts.cjs': emitCjs(bundle),
    'rules-paths.json': emitRulesPaths(bundle),
    'tokens.css': emitCss(bundle),
  };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const files = generateAll();

  if (!checkOnly) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  let drift = false;
  for (const [filename, content] of Object.entries(files)) {
    const generatedPath = path.join(GENERATED_DIR, filename);
    const existing = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : null;
    if (existing !== content) {
      drift = true;
      if (checkOnly) {
        console.error(`[contracts:check] DRIFT: ${path.relative(ROOT, generatedPath)} is stale — run '${GENERATED_AT_COMMAND}'`);
      } else {
        fs.writeFileSync(generatedPath, content, 'utf8');
        console.log(`[generate-contracts] wrote ${path.relative(ROOT, generatedPath)}`);
      }
    }

    const mirrorPath = MIRROR_TARGETS[filename];
    if (mirrorPath) {
      const mirrorExisting = fs.existsSync(mirrorPath) ? fs.readFileSync(mirrorPath, 'utf8') : null;
      if (mirrorExisting !== content) {
        drift = true;
        if (checkOnly) {
          console.error(`[contracts:check] DRIFT: ${path.relative(ROOT, mirrorPath)} is stale — run '${GENERATED_AT_COMMAND}'`);
        } else {
          fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
          fs.writeFileSync(mirrorPath, content, 'utf8');
          console.log(`[generate-contracts] wrote ${path.relative(ROOT, mirrorPath)}`);
        }
      }
    }
  }

  if (checkOnly && drift) {
    process.exit(1);
  }
  if (!checkOnly) {
    console.log(drift ? '[generate-contracts] done.' : '[generate-contracts] already up to date.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseYaml,
  loadContract,
  loadAllContracts,
  generateAll,
  emitKotlin,
  emitTypeScript,
  emitCjs,
  emitRulesPaths,
  emitCss,
  CONTRACTS_DIR,
  GENERATED_DIR,
  MIRROR_TARGETS,
};
