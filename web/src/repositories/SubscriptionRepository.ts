import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths, SubscriptionTier, SubscriptionTierValues } from '../generated/contracts';
import { EMPTY_USAGE, SubscriptionUsage } from '../domain/subscriptionEligibility';

export { currentYearMonth } from '../domain/subscriptionEligibility';

export interface SubscriptionOwnership {
  source: string | null;
  expiryDate: number | null;
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
      const tier = snap.exists() ? String(snap.data().tier ?? 'FREE').toUpperCase() : 'FREE';
      // Was `tier === 'PRO' || tier === 'PREMIUM' ? tier : 'FREE'` -- silently dropped BASIC
      // (added in Phase 2) to FREE. Fixed to check against the generated contract's tier set
      // instead of a hand-typed list, so a future tier addition can't repeat this gap.
      return SubscriptionTierValues.includes(tier as SubscriptionTier) ? (tier as SubscriptionTier) : 'FREE';
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
   * Which payment path last granted the user's current tier, plus its expiry (Phase 4 amendment,
   * dual-purchase gate) -- used by `SubscriptionPage.tsx` to block starting a second, separate
   * mobile-vs-web subscription. Neither `webhooks.js` (Razorpay/web) nor `revenueCatWebhook.js`
   * (RevenueCat/mobile) reconciles against what the other already wrote to this doc -- last write
   * wins -- so this check exists to stop the collision before it happens rather than after.
   *
   * Fails open (no restriction), not closed to FREE like `getTier` -- blocking a real purchase
   * attempt on a transient read error is worse than occasionally missing this guard; the two
   * payment paths still can't corrupt each other's core tier data even if this check is skipped.
   */
  async getOwnership(userId: string): Promise<SubscriptionOwnership> {
    try {
      const snap = await getDoc(
        doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_DATA_SUBCOLLECTION, FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      );
      if (!snap.exists()) return { source: null, expiryDate: null };
      const data = snap.data();
      const source = typeof data.source === 'string' ? data.source : null;
      const expiryDate = typeof data.expiryDate === 'number' ? data.expiryDate : null;
      return { source, expiryDate };
    } catch (error) {
      console.warn(`Failed to fetch subscription ownership for ${userId}, failing open to no restriction`, error);
      return { source: null, expiryDate: null };
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
