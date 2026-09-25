import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths, SubscriptionTier, SubscriptionTierValues } from '../generated/contracts';
import { EMPTY_USAGE, SubscriptionUsage } from '../domain/subscriptionEligibility';

export { currentYearMonth } from '../domain/subscriptionEligibility';

export interface SubscriptionOwnership {
  source: string | null;
  expiryDate: number | null;
  /** Whether the subscription auto-renews at `expiryDate`. Defaults `true`, additive-safe for
   * docs predating this field. */
  willRenew: boolean;
}

/**
 * A stale/missed webhook must not leave an expired paid tier readable indefinitely -- derive the
 * effective tier from `expiryDate` at read time rather than trusting the stored `tier` field as-is.
 * `expiryDate == null` (legacy/grandfathered docs)
 * falls through to trusting the stored tier unchanged.
 */
export function deriveEffectiveTier(tier: SubscriptionTier, expiryDate: number | null, nowMillis: number): SubscriptionTier {
  return expiryDate !== null && expiryDate < nowMillis ? 'FREE' : tier;
}

/**
 * Web port of `GitLiveSubscriptionRepository` (docs/plans/CrossPlatform_SSOT Phase 4) — reads
 * the same two Firestore docs KMP reads: `users/{uid}/data/subscription` (tier) and
 * `users/{uid}/subscription/usage_{yyyy-MM}` (usage). Fails closed to FREE / zero usage on any
 * error, matching the KMP `TestEligibility.NetworkError` → caller treats it as not-yet-eligible
 * rather than granting access.
 */
export class SubscriptionRepository {
  async getTier(userId: string): Promise<SubscriptionTier> {
    try {
      const snap = await getDoc(
        doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_DATA_SUBCOLLECTION, FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      );
      if (!snap.exists()) return 'FREE';
      const data = snap.data();
      const tier = String(data.tier ?? 'FREE').toUpperCase();
      // Was `tier === 'PRO' || tier === 'PREMIUM' ? tier : 'FREE'` -- silently dropped BASIC
      // (added in Phase 2) to FREE. Fixed to check against the generated contract's tier set
      // instead of a hand-typed list, so a future tier addition can't repeat this gap.
      const validTier = SubscriptionTierValues.includes(tier as SubscriptionTier) ? (tier as SubscriptionTier) : 'FREE';
      const expiryDate = typeof data.expiryDate === 'number' ? data.expiryDate : null;
      return deriveEffectiveTier(validTier, expiryDate, Date.now());
    } catch (error) {
      console.warn(`Failed to fetch subscription tier for ${userId}, failing closed to FREE`, error);
      return 'FREE';
    }
  }

  /**
   * Subscription start date (epoch millis), if known -- Phase 3
   * (`docs/plans/SubscriptionPricingRestructure.md` step 4/5). Null for FREE tier or before a
   * purchase webhook has populated it. Drives `currentPeriodKey`'s billing-anniversary reset.
   */
  async getStartDate(userId: string): Promise<number | null> {
    try {
      const snap = await getDoc(
        doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_DATA_SUBCOLLECTION, FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      );
      if (!snap.exists()) return null;
      const startDate = snap.data().startDate;
      return typeof startDate === 'number' && startDate > 0 ? startDate : null;
    } catch (error) {
      console.warn(`Failed to fetch subscription start date for ${userId}, falling back to calendar-month reset`, error);
      return null;
    }
  }

  /**
   * The entitlement doc's provenance and renewal fields -- used by `SubscriptionPage.tsx` to show
   * the renewal status. RevenueCat (`revenueCatWebhook.js`) is the only writer; `source` may still
   * read `RAZORPAY` on a pre-retirement doc.
   *
   * Fails soft (empty ownership) on a read error -- it only drives display text, never access.
   */
  async getOwnership(userId: string): Promise<SubscriptionOwnership> {
    try {
      const snap = await getDoc(
        doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_DATA_SUBCOLLECTION, FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      );
      if (!snap.exists()) return { source: null, expiryDate: null, willRenew: true };
      const data = snap.data();
      const source = typeof data.source === 'string' ? data.source : null;
      const expiryDate = typeof data.expiryDate === 'number' ? data.expiryDate : null;
      const willRenew = typeof data.willRenew === 'boolean' ? data.willRenew : true;
      return { source, expiryDate, willRenew };
    } catch (error) {
      console.warn(`Failed to fetch subscription ownership for ${userId}, falling back to empty ownership`, error);
      return { source: null, expiryDate: null, willRenew: true };
    }
  }

  async getMonthlyUsage(userId: string, month: string): Promise<SubscriptionUsage> {
    try {
      const snap = await getDoc(doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION, `usage_${month}`));
      if (!snap.exists()) return EMPTY_USAGE;
      const data = snap.data();
      return {
        oirTestsUsed: data.oirTestsUsed ?? 0,
        ppdtTestsUsed: data.ppdtTestsUsed ?? 0,
        piqTestsUsed: data.piqTestsUsed ?? 0,
        tatTestsUsed: data.tatTestsUsed ?? 0,
        watTestsUsed: data.watTestsUsed ?? 0,
        srtTestsUsed: data.srtTestsUsed ?? 0,
        sdTestsUsed: data.sdTestsUsed ?? 0,
        gtoTestsUsed: data.gtoTestsUsed ?? 0,
        interviewTestsUsed: data.interviewTestsUsed ?? 0,
      };
    } catch (error) {
      console.warn(`Failed to fetch subscription usage for ${userId}/${month}, failing closed to zero usage`, error);
      return EMPTY_USAGE;
    }
  }
}
