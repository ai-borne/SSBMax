/**
 * Payment Service
 * Single Responsibility: calls the server-side `createRazorpayOrder` Cloud Function
 * (`functions/src/payments.js`) that computes the order amount from the generated pricing
 * contract server-side. Mirrors `SubmissionService.ts`'s thin `httpsCallable` wrapper pattern --
 * no business logic here.
 */

import { httpsCallable, Functions } from 'firebase/functions';
import { functions as defaultFunctions } from '../config/firebase';

export interface CreateOrderPayload {
  planId: string;
  currency?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export class PaymentService {
  constructor(private readonly functionsInstance: Functions = defaultFunctions) {}

  createOrder = (planId: string): Promise<CreateOrderResponse> =>
    httpsCallable<CreateOrderPayload, CreateOrderResponse>(
      this.functionsInstance,
      'createRazorpayOrder'
    )({ planId }).then((r) => r.data);
}
