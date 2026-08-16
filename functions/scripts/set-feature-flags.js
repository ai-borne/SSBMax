// One-off script: writes feature_flags/config in Firestore to enable the
// Phase 4-10 server-side evaluation flags for manual testing.
// Run: node scripts/set-feature-flags.js
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ssbmax-49e68' });

const doc = {
  minimumSupportedAppVersion: '1.0.0',
  flags: {
    wat_server_evaluation: true,
    srt_server_evaluation: true,
    sd_server_evaluation: true,
    interview_server_evaluation: true,
    gto_server_evaluation: true,
    ppdt_server_evaluation: true,
    tat_server_evaluation: true
  }
};

admin.firestore().doc('feature_flags/config').set(doc).then(() => {
  console.log('feature_flags/config written:', JSON.stringify(doc));
  process.exit(0);
}).catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
