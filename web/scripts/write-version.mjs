// Emits dist/version.json so a deployed build can identify itself.
//
// Production staleness was previously undetectable: ssbmax.in served a build from
// a branch main had long overtaken, and the only way to notice was to fetch the JS
// bundle and grep it for `data-testid` markers that had moved between components.
// That is not a check anyone runs. This makes the deployed commit a one-line HTTP
// GET, which .github/workflows/deploy-drift.yml consumes.
//
// Commit resolution order matters: Cloudflare Pages builds the site itself, so
// CF_PAGES_COMMIT_SHA is authoritative in the environment that actually produces
// production. GITHUB_SHA covers a CI build; the git call covers a local one.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

function resolveCommit() {
  const fromEnv = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // A tarball build with no git and no CI env. Report it rather than inventing a
    // value -- a wrong commit is worse than an admitted unknown.
    return 'unknown';
  }
}

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const payload = {
  commit: resolveCommit(),
  branch: process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || null,
  builtAt: new Date().toISOString()
};

writeFileSync(join(dist, 'version.json'), JSON.stringify(payload, null, 2) + '\n');
console.log('wrote dist/version.json:', JSON.stringify(payload));
