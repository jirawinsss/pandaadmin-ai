// Auto-build on production install — fixes the most common Hostinger
// LiteSpeed Node.js failure mode where `npm install` runs but `next build`
// doesn't, so the app crashes on `app.prepare()` because .next/ is missing.
//
// Skips itself in three cases so local dev isn't slowed down:
//   1. SKIP_POSTINSTALL_BUILD=1 in env (manual override)
//   2. NODE_ENV is not 'production' AND the .next/BUILD_ID exists already
//      (i.e. a previous build is on disk — the dev probably ran build by
//      hand and is just `npm install`-ing a new package)
//   3. The `next` binary isn't on disk yet (peer-dep install ordering)
//
// The build is wrapped in try/catch so a build failure doesn't break the
// install — the operator sees a loud error but can still inspect the tree
// and run `npm run build` manually.

const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

if (process.env.SKIP_POSTINSTALL_BUILD === '1') {
  console.log('[postinstall] skipped — SKIP_POSTINSTALL_BUILD=1');
  process.exit(0);
}

const isProduction = process.env.NODE_ENV === 'production';
const hasBuild = existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));

if (!isProduction && hasBuild) {
  console.log(
    '[postinstall] skipped — local install with existing .next/ (set NODE_ENV=production to force)',
  );
  process.exit(0);
}

const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
if (!existsSync(nextBin) && !existsSync(nextBin + '.cmd')) {
  console.log('[postinstall] skipped — next binary not yet installed');
  process.exit(0);
}

console.log('[postinstall] running next build…');
try {
  execSync('next build', { stdio: 'inherit' });
  console.log('[postinstall] next build OK');
} catch (err) {
  console.error('[postinstall] next build FAILED — run it manually:');
  console.error('  npm run build');
  // Exit 0 so the install still succeeds — user can SSH in and rebuild.
  // Failing the install would block the rest of the deploy pipeline too.
  process.exit(0);
}
