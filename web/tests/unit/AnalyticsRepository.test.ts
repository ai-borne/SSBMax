import { describe, it, expect, vi } from 'vitest';
import { AnalyticsRepository } from '../../src/repositories/AnalyticsRepository';
import { httpsCallable, HttpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {}
}));

/**
 * Phase 8 (ai_search_readiness plan): pins the two thin wrappers around the
 * `recordSignup`/`getAnalyticsSummary` callables -- mirrors SupportRepository.test.ts's pattern,
 * since the same class of gap (wrong callable name, dropped payload) would otherwise only
 * surface as a live failure in production.
 */
describe('AnalyticsRepository', () => {
  it('recordSignup calls the recordSignup callable with no payload', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { date: '2026-08-29' } });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    const repository = new AnalyticsRepository();
    await repository.recordSignup();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'recordSignup');
    expect(callable).toHaveBeenCalledWith();
  });

  it('getAnalyticsSummary calls the getAnalyticsSummary callable and returns its data', async () => {
    const summary = { days: [{ date: '2026-08-29', signups: 3 }], totalSignups: 3, sinceDate: '2026-08-29' };
    const callable = vi.fn().mockResolvedValue({ data: summary });
    vi.mocked(httpsCallable).mockReturnValue(callable as unknown as HttpsCallable);

    const repository = new AnalyticsRepository();
    const result = await repository.getAnalyticsSummary();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getAnalyticsSummary');
    expect(result).toEqual(summary);
  });
});
