import { strings } from './strings';
import type { AccessTier } from './ssbSelectionProcess';

/** Short uppercase header badge for a paid tier (e.g. "BASIC"). */
export function tierBadgeLabel(tier: AccessTier): string {
  const badges: Record<AccessTier, string> = {
    FREE: strings.subscription.ribbonFreeBadge,
    BASIC: strings.subscription.ribbonBasicBadge,
    PRO: strings.subscription.ribbonProBadge,
    PREMIUM: strings.subscription.ribbonPremiumBadge
  };
  return badges[tier];
}

/** Human plan title (e.g. "Basic Plan"). */
export function tierPlanTitle(tier: AccessTier): string {
  const titles: Record<AccessTier, string> = {
    FREE: strings.subscription.freePlanTitle,
    BASIC: strings.subscription.basicPlanTitle,
    PRO: strings.subscription.proPlanTitle,
    PREMIUM: strings.subscription.premiumPlanTitle
  };
  return titles[tier];
}

/**
 * The tier to display: the real stored tier when a caller passes it, otherwise the legacy
 * boolean-only fallback (paid -> PRO, unpaid -> FREE) so older call sites keep working.
 */
export function resolveDisplayTier(userTier: AccessTier | undefined, isPaid: boolean): AccessTier {
  return userTier ?? (isPaid ? 'PRO' : 'FREE');
}
