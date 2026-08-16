import { useEffect, useState } from 'react';
import { SubmissionRepository } from '../repositories/SubmissionRepository';
import { OLQResultData } from './useSubmissionResultViewModel';
import { OLQScoreItem } from '../components/evaluation/OLQScoreCard';
import { PsychologistDossierData } from '../components/evaluation/PsychologistDossier';
import { FirestorePaths } from '../generated/contracts';

/**
 * Every OLQ-scored result source this dashboard aggregates -- TS port of the source
 * list `GetOLQDashboardUseCase.kt` fetches in parallel. GTO is scoped to GD/GPE/
 * Lecturette (`resultTestType` values `gtoEvaluate.js::GTO_SUBTYPE_CONFIG` writes),
 * matching the same PGT/HGT/GOR/CT/IO evaluation gap noted throughout Phase 11 --
 * those sub-types have no `gto_results` docs to aggregate yet. Interview (per-response,
 * no `overallScore`) and OIR (not OLQ-scored) are intentionally excluded, same as the
 * KMP source's handling of non-comparable shapes.
 */
const OLQ_RESULT_SOURCES: { testType: string; resultCollection: string }[] = [
  { testType: 'PPDT', resultCollection: FirestorePaths.PPDT_RESULTS },
  { testType: 'TAT', resultCollection: FirestorePaths.PSYCH_RESULTS },
  { testType: 'WAT', resultCollection: FirestorePaths.PSYCH_RESULTS },
  { testType: 'SRT', resultCollection: FirestorePaths.PSYCH_RESULTS },
  { testType: 'SD', resultCollection: FirestorePaths.PSYCH_RESULTS },
  { testType: 'GROUP_DISCUSSION', resultCollection: FirestorePaths.GTO_RESULTS },
  { testType: 'GROUP_PLANNING_EXERCISE', resultCollection: FirestorePaths.GTO_RESULTS },
  { testType: 'LECTURETTE', resultCollection: FirestorePaths.GTO_RESULTS }
];

/** Averages every OLQ id present across the fetched results -- TS port of `computeAverageOLQScores`. */
export function aggregateOLQScores(results: OLQResultData[]): OLQScoreItem[] {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const result of results) {
    for (const [olq, score] of Object.entries(result.olqScores || {})) {
      const entry = sums[olq] || { total: 0, count: 0 };
      entry.total += score.score;
      entry.count += 1;
      sums[olq] = entry;
    }
  }
  return Object.entries(sums).map(([olq, { total, count }]) => ({ olq, score: total / count }));
}

/** TS port of `computeOverallAverage` -- flat average of each source's own `overallScore`. */
export function computeOverallAverage(results: OLQResultData[]): number | null {
  const scores = results.map((r) => r.overallScore).filter((s): s is number => typeof s === 'number');
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Deterministic dossier built from real, already-Gemini-generated `strengths`/
 * `weaknesses`/`recommendations` text stored on each result doc -- never fabricates
 * new AI content. KMP's `GetOLQDashboardUseCase`/`OLQDashboard` has no dossier concept
 * at all (`PsychologistDossierData` belongs to a separate, not-yet-built feature) --
 * this is a pragmatic web-only synthesis so the already-built `AIReportsPage` can
 * render real data instead of only the sample dossier.
 */
function buildDossier(userId: string, results: OLQResultData[], overallAverage: number | null): PsychologistDossierData {
  const recommendationStatus: PsychologistDossierData['recommendationStatus'] =
    overallAverage === null ? 'BORDERLINE' : overallAverage <= 6 ? 'RECOMMENDED' : overallAverage <= 7.5 ? 'BORDERLINE' : 'NOT_RECOMMENDED';

  return {
    candidateId: userId,
    assessedDate: new Date().toISOString().slice(0, 10),
    recommendationStatus,
    executiveSummary: `Based on ${results.length} completed assessment${results.length === 1 ? '' : 's'}, this dossier aggregates real OLQ scores from your submitted tests.`,
    keyStrengths: results.flatMap((r) => r.strengths || []).slice(0, 5),
    areasOfConcern: results.flatMap((r) => r.weaknesses || []).slice(0, 5),
    suggestedProbes: results.flatMap((r) => r.recommendations || []).slice(0, 3)
  };
}

export interface OLQDashboardState {
  isLoading: boolean;
  olqScores: OLQScoreItem[];
  dossier: PsychologistDossierData | null;
  completedTestsCount: number;
}

/**
 * TS port of `GetOLQDashboardUseCase.kt` (Phase 11e, Web SSB Test Flow Parity plan) --
 * fetches every OLQ-scored source in parallel, isolating one source's failure from the
 * rest (a broken/missing type degrades to "not attempted", never fails the dashboard).
 * No 5-minute TTL cache or per-type timeout race, unlike the KMP original -- tracked as
 * follow-up, not required for aggregation correctness.
 */
export function useOLQDashboardViewModel(
  userId: string | undefined,
  injectedRepository?: SubmissionRepository,
  enabled = true
): OLQDashboardState {
  const [state, setState] = useState<OLQDashboardState>({
    isLoading: true,
    olqScores: [],
    dossier: null,
    completedTestsCount: 0
  });

  // A `= new SubmissionRepository()` default parameter would construct a fresh
  // instance on every call (JS default params re-evaluate per invocation, not once) --
  // with `repository` in the effect's dependency array below, that identity churn
  // caused an infinite render loop (App.tsx passes no repository, so the default fired
  // every render). `useState(() => ...)` lazy-inits exactly once per component instance.
  const [defaultRepository] = useState(() => new SubmissionRepository());
  const repository = injectedRepository ?? defaultRepository;

  useEffect(() => {
    // `enabled` gates the 8 parallel Firestore queries behind actually viewing the
    // Reports tab -- App.tsx would otherwise fire them on every render regardless of
    // which tab is active, since this hook must be called unconditionally per the
    // Rules of Hooks.
    if (!userId || !enabled) {
      setState({ isLoading: false, olqScores: [], dossier: null, completedTestsCount: 0 });
      return;
    }
    let cancelled = false;

    (async () => {
      const settled = await Promise.allSettled(
        OLQ_RESULT_SOURCES.map((source) => repository.getLatestResultByType<OLQResultData>(source.resultCollection, userId, source.testType))
      );
      if (cancelled) return;

      const results = settled
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((r): r is OLQResultData => r !== null);

      setState({
        isLoading: false,
        olqScores: aggregateOLQScores(results),
        dossier: results.length > 0 ? buildDossier(userId, results, computeOverallAverage(results)) : null,
        completedTestsCount: results.length
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, repository, enabled]);

  return state;
}
