/**
 * Payment ViewModel
 * Single Responsibility: Tracks Razorpay order creation, payment checkout flow, and membership verification states.
 */

import { useState, useCallback } from 'react';
import { RazorpayService } from '../services/RazorpayService';
import { strings } from '../constants/strings';
import { PricingTiers } from '../generated/contracts';

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
  createOrderFn?: (planId: string) => Promise<{ orderId: string; amount: number; currency: string; keyId: string }>
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

        const razorpayService = new RazorpayService();
        await razorpayService.openCheckout({
          orderId: orderDetails.orderId,
          amount: orderDetails.amount,
          currency: orderDetails.currency,
          keyId: orderDetails.keyId,
          userEmail,
          userName,
          onSuccess: (paymentId: string) => {
            setState((prev) => ({
              ...prev,
              status: 'success',
              paymentId,
              isPaidMember: true,
              errorMessage: null
            }));
          },
          onFailure: (error) => {
            setState((prev) => ({
              ...prev,
              status: 'error',
              errorMessage: error.description || strings.payment.paymentFailed
            }));
          }
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: err.message || strings.payment.paymentFailed
        }));
      }
    },
    [createOrderFn]
  );

  return {
    ...state,
    initiatePayment,
    resetStatus,
    setIsPaidMember
  };
}
