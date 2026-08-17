import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';

export type SubmissionAnalysisStatus = 'PENDING_ANALYSIS' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export interface SubmissionStatusResult {
  status: SubmissionAnalysisStatus;
}

/**
 * Read-only Firestore access to `submissions/{id}` and its result-collection siblings
 * (`psych_results`/`ppdt_results`/`gto_results`/`interview_responses`) -- writes go
 * through `SubmissionService`'s Cloud Function callables instead, per web/CLAUDE.md's
 * "reads via repositories, writes via Cloud Functions" split.
 *
 * `getSubmissionStatus` checks both status shapes the `evaluate*` Cloud Functions
 * actually use: nested `data.analysisStatus` (PPDT/TAT/WAT/SRT/SD, `core.js`'s
 * standard envelope) and a top-level `status` field (GTO's documented quirk --
 * `gtoEvaluate.js`'s class doc). Fails closed to `null` on any read error, so callers
 * (result-screen polling, Phase 11d) treat it the same as "not found yet" rather than
 * crashing.
 */
export class SubmissionRepository {
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatusResult | null> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.SUBMISSIONS, submissionId));
      if (!snap.exists()) return null;
      const data = snap.data();
      const status: SubmissionAnalysisStatus | undefined = data.data?.analysisStatus ?? data.status;
      return status ? { status } : null;
    } catch (error) {
      console.warn(`Failed to fetch submission status for ${submissionId}`, error);
      return null;
    }
  }

  /**
   * Reads a `submissions/{id}` doc's own nested `data` envelope directly, for test types whose
   * result lives on the submission doc itself rather than a separate result collection -- OIR is
   * the one type today (`functions/src/submissions.js::createOIRSubmission` embeds `testResult`
   * at submit time, since OIR's score is known synchronously; there's no `PENDING_ANALYSIS` ->
   * `COMPLETED` transition to poll for, unlike `getResult`'s AI-graded siblings).
   */
  async getSubmissionData<T>(submissionId: string): Promise<T | null> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.SUBMISSIONS, submissionId));
      return snap.exists() ? (snap.data().data as T) : null;
    } catch (error) {
      console.warn(`Failed to fetch submission data for ${submissionId}`, error);
      return null;
    }
  }

  /** Generic result-collection reader -- pass a `FirestorePaths.*_RESULTS` constant + doc id. */
  async getResult<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const snap = await getDoc(doc(db, collectionName, id));
      return snap.exists() ? (snap.data() as T) : null;
    } catch (error) {
      console.warn(`Failed to fetch result ${collectionName}/${id}`, error);
      return null;
    }
  }

  /**
   * Latest result for one user + result `testType` within a result collection
   * (Phase 11e, Web SSB Test Flow Parity plan -- OLQ dashboard aggregation). Result
   * collections store every test type mixed together (e.g. `psych_results` holds
   * TAT/WAT/SRT/SD), each doc carrying its own `userId`/`testType`/`analyzedAt`
   * (written by `core.js::runEvaluation` and its bespoke-wrapper equivalents), so this
   * filters on both and takes the most recent. Fails closed to `null`, same as every
   * other read here -- a missing/erroring type is treated as "not yet attempted", not
   * a fatal dashboard error.
   */
  async getLatestResultByType<T>(collectionName: string, userId: string, testType: string): Promise<T | null> {
    try {
      const q = query(
        collection(db, collectionName),
        where('userId', '==', userId),
        where('testType', '==', testType),
        orderBy('analyzedAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      return snap.empty ? null : (snap.docs[0].data() as T);
    } catch (error) {
      console.warn(`Failed to fetch latest ${testType} result from ${collectionName}/${userId}`, error);
      return null;
    }
  }
}
