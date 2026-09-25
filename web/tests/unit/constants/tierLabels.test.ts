import { describe, it, expect } from 'vitest';
import { tierBadgeLabel, tierPlanTitle, resolveDisplayTier } from '../../../src/constants/tierLabels';
import { strings } from '../../../src/constants/strings';

/**
 * The web only used to know "paid or not", so every paid user was labelled PRO. These helpers give
 * one place that maps the real stored tier to its label (strings.* only, no hardcoded text).
 */
describe('tierLabels', () => {
  it('maps each tier to its own header badge label', () => {
    expect(tierBadgeLabel('BASIC')).toBe(strings.subscription.ribbonBasicBadge);
    expect(tierBadgeLabel('PRO')).toBe(strings.subscription.ribbonProBadge);
    expect(tierBadgeLabel('PREMIUM')).toBe(strings.subscription.ribbonPremiumBadge);
  });

  it('maps each tier to its own plan title', () => {
    expect(tierPlanTitle('FREE')).toBe(strings.subscription.freePlanTitle);
    expect(tierPlanTitle('BASIC')).toBe(strings.subscription.basicPlanTitle);
    expect(tierPlanTitle('PRO')).toBe(strings.subscription.proPlanTitle);
    expect(tierPlanTitle('PREMIUM')).toBe(strings.subscription.premiumPlanTitle);
  });

  it('resolveDisplayTier prefers the real tier, and falls back to PRO / FREE for legacy boolean-only callers', () => {
    expect(resolveDisplayTier('BASIC', true)).toBe('BASIC');
    expect(resolveDisplayTier(undefined, true)).toBe('PRO');
    expect(resolveDisplayTier(undefined, false)).toBe('FREE');
    expect(resolveDisplayTier('FREE', true)).toBe('FREE');
  });
});
