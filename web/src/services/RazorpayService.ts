/**
 * Razorpay Payment Service
 * Single Responsibility: Manages dynamic Razorpay Checkout SDK loading and order execution.
 */

import { themeColors } from '../constants/colors';

export interface RazorpayOrderOptions {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  userName?: string;
  userEmail?: string;
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onFailure: (error: { code?: string; description?: string }) => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export class RazorpayService {
  private static SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';

  /**
   * Dynamically load Razorpay SDK script if not already present on window
   */
  public static loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = RazorpayService.SDK_URL;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  /**
   * Launch Razorpay Checkout Modal
   */
  public async openCheckout(options: RazorpayOrderOptions): Promise<void> {
    const isLoaded = await RazorpayService.loadRazorpayScript();
    if (!isLoaded || !window.Razorpay) {
      options.onFailure({
        code: 'SDK_LOAD_ERROR',
        description: 'Failed to load Razorpay SDK'
      });
      return;
    }

    const checkoutOptions = {
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: 'SSBMax',
      description: 'SSBMax Pro Membership Subscription',
      order_id: options.orderId,
      prefill: {
        name: options.userName || '',
        email: options.userEmail || ''
      },
      theme: {
        color: themeColors.light.accent
      },
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        options.onSuccess(
          response.razorpay_payment_id,
          response.razorpay_order_id,
          response.razorpay_signature
        );
      },
      modal: {
        ondismiss: () => {
          options.onFailure({
            code: 'PAYMENT_CANCELLED',
            description: 'Payment process was cancelled by the user'
          });
        }
      }
    };

    const razorpayInstance = new window.Razorpay(checkoutOptions);
    razorpayInstance.open();
  }
}
