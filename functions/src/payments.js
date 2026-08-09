/**
 * Razorpay Order Handler
 *
 * Initializes Razorpay payment orders with mandatory notes metadata (userId, planId).
 */

const functions = require('firebase-functions');

/**
 * Create Razorpay Order Callable Function
 */
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to create a payment order'
    );
  }

  const userId = context.auth.uid;
  const { amount = 49900, currency = 'INR', planId = 'pro_monthly' } = data || {};

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Development fallback mock order ID for testing when Razorpay credentials are unset in emulator
      const mockOrderId = `order_mock_${Date.now()}_${userId.slice(0, 6)}`;
      return {
        success: true,
        orderId: mockOrderId,
        amount: amount,
        currency: currency,
        keyId: keyId || 'rzp_test_mockKey123',
        notes: { userId, planId }
      };
    }
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Razorpay payment credentials are missing in production environment'
    );
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        receipt: `rcpt_${Date.now()}`,
        notes: {
          userId: userId,
          planId: planId
        }
      })
    });

    const orderData = await response.json();
    if (!response.ok) {
      throw new Error(orderData.error?.description || 'Razorpay order creation failed');
    }

    return {
      success: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: keyId,
      notes: orderData.notes
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
