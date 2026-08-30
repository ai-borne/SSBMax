/**
 * Only GD/GPE/Lecturette have a matching `evaluateGTO` prompt path today
 * (`GTO_SUBTYPE_CONFIG` in `functions/src/evaluation/gtoEvaluate.js`) -- PGT/HGT/GOR/CT/IO
 * submissions are still created (capture-UI groundwork) but never trigger evaluation, since
 * calling `evaluateGTO` on one would fail with `invalid-argument`.
 *
 * Single shared copy: `GTOResponseForm.tsx` (online submit) and `offlineSubmissionSync.ts`
 * (offline resync) must agree on which GTO subtypes are evaluable, so this lives in one place
 * both import instead of two copies that could silently drift.
 */
export const EVALUABLE_GTO_TYPES = new Set(['GTO_GD', 'GTO_GPE', 'GTO_LECTURETTE']);
