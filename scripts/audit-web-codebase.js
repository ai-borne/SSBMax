#!/usr/bin/env node

/**
 * audit-web-codebase.js
 * 
 * Phase 5 Automated Guardrail Audit Script for ssbmax-web
 * 
 * Verifies:
 * 1. Zero hardcoded secrets in web src files.
 * 2. Zero raw hex codes in JSX/TSX components (outside src/constants/colors.ts).
 * 3. SRP Component bounds (components under 250 LOC, ViewModels free of JSX/DOM).
 * 4. User-facing text references namespaced string resources (src/constants/strings.ts).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_SRC = path.resolve(__dirname, '../web/src');

let errors = [];
let warnings = [];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

if (!fs.existsSync(WEB_SRC)) {
  console.error(`❌ Web src directory not found at: ${WEB_SRC}`);
  process.exit(1);
}

const allSrcFiles = getAllFiles(WEB_SRC);

console.log(`🔍 Running ssbmax-web Codebase Audit on ${allSrcFiles.length} files...\n`);

// 1. Secret Leakage Check
const SECRET_PATTERNS = [
  /AIza[A-Za-z0-9_-]{35}/,
  /rzp_(test|live)_[A-Za-z0-9]{14}/,
  /sk-[A-Za-z0-9]{32,}/,
  /-----BEGIN PRIVATE KEY-----/
];

allSrcFiles.forEach((filePath) => {
  const relPath = path.relative(WEB_SRC, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  SECRET_PATTERNS.forEach((pattern) => {
    if (pattern.test(content)) {
      errors.push(`[SECURITY] Potential secret detected in ${relPath} matching pattern ${pattern.toString()}`);
    }
  });
});

// 2. Raw Hex Color Audit in JSX/TSX
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;

allSrcFiles.filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('constants/colors.ts')).forEach((filePath) => {
  const relPath = path.relative(WEB_SRC, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const matches = content.match(HEX_COLOR_REGEX);
  if (matches) {
    errors.push(`[DESIGN_TOKEN] Raw hex color(s) detected in ${relPath}: ${[...new Set(matches)].join(', ')}. Must use src/constants/colors.ts tokens!`);
  }
});

// 3. Single Responsibility Principle (SRP) Audit
allSrcFiles.filter(f => f.includes('/components/')).forEach((filePath) => {
  const relPath = path.relative(WEB_SRC, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  if (lines > 250) {
    warnings.push(`[SRP] Component ${relPath} has ${lines} lines of code (exceeds 250 LOC recommendation). Consider splitting into subcomponents.`);
  }
});

allSrcFiles.filter(f => f.includes('/viewmodels/')).forEach((filePath) => {
  const relPath = path.relative(WEB_SRC, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('React.') || content.includes('<div') || content.includes('import React')) {
    errors.push(`[SRP_VIOLATION] ViewModel ${relPath} contains JSX/React UI code. ViewModels must contain pure state/business logic only!`);
  }
});

// 4. Strings Resource Reference Audit in Component Files
allSrcFiles.filter(f => f.includes('/components/') && f.endsWith('.tsx')).forEach((filePath) => {
  const relPath = path.relative(WEB_SRC, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('strings.') && !content.includes('strings')) {
    warnings.push(`[RESOURCE_AUDIT] Component ${relPath} does not import or reference centralized string resources (strings.*). Verify user-facing text is centralized.`);
  }
});

// Print Results
console.log('----------------------------------------------------');
if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} Warning(s):`);
  warnings.forEach(w => console.log(`   - ${w}`));
  console.log('----------------------------------------------------');
}

if (errors.length > 0) {
  console.error(`❌ ${errors.length} Error(s) found during audit:`);
  errors.forEach(e => console.error(`   - ${e}`));
  console.log('----------------------------------------------------');
  process.exit(1);
} else {
  console.log('✅ Audit Passed! All web codebase security, SRP, and design token guardrails satisfied.\n');
  process.exit(0);
}
