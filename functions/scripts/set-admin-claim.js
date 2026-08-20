// One-off script: grants (or revokes) the `admin: true` custom claim that
// `getSubscriptionSupportSnapshot` (Phase 9, Payment Ecosystem Hardening plan) checks server-side
// via `context.auth.token.admin`. Mirrors `set-feature-flags.js`'s plain-Node/ADC convention --
// no new runtime dependency, not run as part of any deploy.
//
// Usage:
//   node scripts/set-admin-claim.js --email=someone@example.com          # grant
//   node scripts/set-admin-claim.js --email=someone@example.com --revoke # revoke
//
// A signed-in user must sign out/in (or force-refresh their ID token) before the new claim takes
// effect -- custom claims are baked into the ID token at mint time, not read live per request.
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ssbmax-49e68' });

function parseArgs(argv) {
  const args = { revoke: false };
  for (const arg of argv) {
    if (arg === '--revoke') {
      args.revoke = true;
    } else if (arg.startsWith('--email=')) {
      args.email = arg.slice('--email='.length);
    }
  }
  return args;
}

async function main() {
  const { email, revoke } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.error('Usage: node scripts/set-admin-claim.js --email=<address> [--revoke]');
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  const existingClaims = user.customClaims || {};
  const nextClaims = { ...existingClaims, admin: !revoke };

  await admin.auth().setCustomUserClaims(user.uid, nextClaims);
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin claim for ${email} (uid=${user.uid})`);
  process.exit(0);
}

main().catch((error) => {
  console.error('ERR', error.message);
  process.exit(1);
});
