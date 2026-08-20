import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 2 guard test (docs/plans/CrossPlatform_SSOT): a raw Firestore
 * collection/document-path literal must never reappear in web/src outside
 * the generated contracts file. FirestorePaths (src/generated/contracts.ts)
 * is the only source of truth for a path.
 */
describe('Phase 2: no raw Firestore collection/doc path literal outside src/generated', () => {
  const srcRoot = path.resolve(__dirname, '../../../src');
  const exemptDirs = [path.resolve(srcRoot, 'generated')];

  // `collection(db, "literal", ...)` / `doc(db, "literal", ...)` -- first
  // string-literal argument to a firebase/firestore collection or doc call.
  // No `g` flag: each file gets a fresh `.test()` call, not a stateful scan.
  const rawLiteralCall = /\b(collection|doc)\(\s*[a-zA-Z_$][\w$]*\s*,\s*'[^'$]*'/;

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return exemptDirs.includes(full) ? [] : walk(full);
      if (/\.(ts|tsx)$/.test(entry.name)) return [full];
      return [];
    });
  }

  it('has zero raw literal collection()/doc() calls', () => {
    const offenders = walk(srcRoot)
      .filter((file) => rawLiteralCall.test(fs.readFileSync(file, 'utf-8')))
      .map((file) => path.relative(srcRoot, file));

    expect(offenders).toEqual([]);
  });
});
