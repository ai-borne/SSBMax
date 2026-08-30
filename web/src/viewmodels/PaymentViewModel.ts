/**
 * Payment ViewModel
 * Single Responsibility: Tracks Razorpay order creation, payment checkout flow, and membership verification states.
 */

import { useState, useCallback } from 'react';
import { RazorpayService } from '../services/RazorpayService';
import { strings } from '../constants/strings';
import { PricingTiers, SubscriptionTier } from '../generated/contracts';

/**
 * L5 (Payment Ecosystem Hardening plan, Phase 12): the actual tier grant happens asynchronously,
 * server-side, once `handleRazorpayWebhook` (`functions/src/webhooks.js`) processes the
 * `payment.captured` event -- Razorpay's client-side checkout `onSuccess` callback only means the
 * payment was captured, not that the grant has landed in Firestore yet. Polls `verifyTierFn`
 * (`SubscriptionRepository.getTier`) a few times before reporting `success`, instead of reporting
 * it the instant the checkout modal closes. Exported so it's unit-testable without real timers --
 * pass `delayMs: 0` in tests.
 */
export async function waitForTierUpgrade(
  verifyTierFn: () => Promise<SubscriptionTier>,
  { maxAttempts = 6, delayMs = 1500 }: { maxAttempts?: number; delayMs?: number } = {}
): Promise<SubscriptionTier> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tier = await verifyTierFn();
    if (tier !== 'FREE') return tier;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return 'FREE';
}

/**
 * Mock/offline-testing order amount, in paise, derived from the generated pricing contract
 * (contracts/pricing.yaml) rather than a hand literal -- `planId` is `{tier}_monthly` (e.g.
 * `pro_monthly`); real orders always go through `createOrderFn` (`functions/src/payments.js`,
 * itself now server-computed from the same contract).
 */
function mockAmountInPaise(planId: string): number {
  const tier = planId.split('_')[0]?.toUpperCase();
  const monthlyInr = PricingTiers.find((t) => t.tier === tier)?.monthlyInr ?? PricingTiers.find((t) => t.tier === 'PRO')!.monthlyInr;
  return monthlyInr * 100;
}

export type PaymentStatus = 'idle' | 'creating_order' | 'checkout_open' | 'verifying' | 'success' | 'error';

export interface PaymentState {
  status: PaymentStatus;
  errorMessage: string | null;
  orderId: string | null;
  paymentId: string | null;
  isPaidMember: boolean;
}

export interface UsePaymentViewModelReturn extends PaymentState {
  initiatePayment: (planId?: string, userEmail?: string, userName?: string) => Promise<void>;
  resetStatus: () => void;
  setIsPaidMember: (isPaid: boolean) => void;
}

export function usePaymentViewModel(
  createOrderFn?: (planId: string) => Promise<{ orderId: string; amount: number; currency: string; keyId: string }>,
  createSubscriptionFn?: (planId: string) => Promise<{ subscriptionId: string; keyId: string }>,
  /** Phase B checkout-cutover kill switch (senior-review fix #8): the two checkout code paths
   * stay fully isolated (`RazorpayService.openCheckout` vs `openSubscriptionCheckout`) -- this
   * flag decides upfront which one runs, never inferred from a response shape. Defaults `false`
   * so every caller that hasn't been updated to pass the live feature-flag value keeps using the
   * existing, verified order-based path. */
  useSubscriptionCheckout: boolean = false,
  /** L5 (Phase 12): when provided, `initiatePayment`'s `onSuccess` polls this (via
   * `waitForTierUpgrade`) instead of reporting `success` the instant Razorpay's checkout modal
   * closes. Optional and defaulted `undefined` -- callers that don't pass it (older wiring,
   * offline/mock testing) keep the previous immediate-success behavior. */
  verifyTierFn?: () => Promise<SubscriptionTier>,
  /** Test-only override for `waitForTierUpgrade`'s polling cadence -- production callers never
   * pass this, so it always falls through to the real defaults (6 attempts, 1500ms apart). */
  verifyTierPollOptions?: { maxAttempts?: number; delayMs?: number }
): UsePaymentViewModelReturn {
  const [state, setState] = useState<PaymentState>({
    status: 'idle',
    errorMessage: null,
    orderId: null,
    paymentId: null,
    isPaidMember: false
  });

  const setIsPaidMember = useCallback((isPaid: boolean) => {
    setState((prev) => ({ ...prev, isPaidMember: isPaid }));
  }, []);

  const resetStatus = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'idle',
      errorMessage: null,
      orderId: null,
      paymentId: null
    }));
  }, []);

  const initiatePayment = useCallback(
    async (planId: string = 'pro_monthly', userEmail?: string, userName?: string) => {
      setState((prev) => ({
        ...prev,
        status: 'creating_order',
        errorMessage: null
      }));

      try {
        const razorpayService = new RazorpayService();
        const onSuccess = async (paymentId: string) => {
          if (!verifyTierFn) {
            // No verification wired -- keep the previous immediate-success behavior rather than
            // inventing a fake wait with nothing to poll.
            setState((prev) => ({
              ...prev,
              status: 'success',
              paymentId,
              isPaidMember: true,
              errorMessage: null
            }));
            return;
          }

          setState((prev) => ({ ...prev, status: 'verifying', paymentId }));
          const tier = await waitForTierUpgrade(verifyTierFn, verifyTierPollOptions);
          setState((prev) => ({
            ...prev,
            status: 'success',
            isPaidMember: tier !== 'FREE',
            errorMessage: null
          }));
        };
        const onFailure = (error: { description?: string }) => {
          setState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: error.description || strings.payment.paymentFailed
          }));
        };

        if (useSubscriptionCheckout && createSubscriptionFn) {
          const subscriptionDetails = await createSubscriptionFn(planId);
          setState((prev) => ({
            ...prev,
            status: 'checkout_open',
            orderId: subscriptionDetails.subscriptionId
          }));
          await razorpayService.openSubscriptionCheckout({
            subscriptionId: subscriptionDetails.subscriptionId,
            keyId: subscriptionDetails.keyId,
            userEmail,
            userName,
            onSuccess,
            onFailure
          });
          return;
        }

        let orderDetails: { orderId: string; amount: number; currency: string; keyId: string };

        if (createOrderFn) {
          orderDetails = await createOrderFn(planId);
        } else {
          // Default mock order details for offline or un-wired environment testing
          orderDetails = {
            orderId: `order_mock_${Date.now()}`,
            amount: mockAmountInPaise(planId),
            currency: 'INR',
            keyId: 'rzp_test_mockKey123'
          };
        }

        setState((prev) => ({
          ...prev,
          status: 'checkout_open',
          orderId: orderDetails.orderId
        }));

        await razorpayService.openCheckout({
          orderId: orderDetails.orderId,
          amount: orderDetails.amount,
          currency: orderDetails.currency,
          keyId: orderDetails.keyId,
          userEmail,
          userName,
          onSuccess,
          onFailure
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : strings.payment.paymentFailed
        }));
      }
    },
    [createOrderFn, createSubscriptionFn, useSubscriptionCheckout, verifyTierFn, verifyTierPollOptions]
  );

  return {
    ...state,
    initiatePayment,
    resetStatus,
    setIsPaidMember
  };
}
