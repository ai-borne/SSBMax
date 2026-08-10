import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths, SubscriptionTier } from '../generated/contracts';
import { EMPTY_USAGE, SubscriptionUsage } from '../domain/subscriptionEligibility';

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
      return tier === 'PRO' || tier === 'PREMIUM' ? tier : 'FREE';
    } catch (error) {
      console.warn(`Failed to fetch subscription tier for ${userId}, failing closed to FREE`, error);
      return 'FREE';
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

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
