import { describe, it, expect } from 'vitest';
import { isActiveMobileSubscription } from '../../src/viewmodels/useSubscriptionOwnership';

/**
 * Phase 4 amendment (dual-purchase gate): pure-function core of the web-side mirror of
 * `SubscriptionOwnership.isActive` (`shared/.../domain/repository/SubscriptionRepository.kt`).
 * Kept identical on both platforms so "is this mobile subscription still blocking a web
 * purchase" can't silently drift between KMP and web.
 */
describe('isActiveMobileSubscription', () => {
  it('is false when source is not REVENUECAT', () => {
    expect(isActiveMobileSubscription({ source: null, expiryDate: null, willRenew: true })).toBe(false);
    expect(isActiveMobileSubscription({ source: 'RAZORPAY', expiryDate: null, willRenew: true })).toBe(false);
  });

  it('is true for a REVENUECAT source with no expiry (perpetual/unknown-yet)', () => {
    expect(isActiveMobileSubscription({ source: 'REVENUECAT', expiryDate: null, willRenew: true })).toBe(true);
  });

  it('is true for a REVENUECAT source whose expiry is still in the future', () => {
    expect(isActiveMobileSubscription({ source: 'REVENUECAT', expiryDate: 2_000, willRenew: true }, 1_000)).toBe(true);
  });

  it('is false for a REVENUECAT source whose expiry has already passed', () => {
    expect(isActiveMobileSubscription({ source: 'REVENUECAT', expiryDate: 500, willRenew: true }, 1_000)).toBe(false);
  });
});
