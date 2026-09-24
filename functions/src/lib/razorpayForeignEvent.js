/**
 * Razorpay account sharing guard.
 *
 * SSBMax shares one Razorpay account with ActionStation, and Razorpay delivers every account
 * event to every registered webhook. ActionStation stamps `notes.source = 'actionstation'`
 * server-side on its orders and subscriptions; such events must be acknowledged and ignored here.
 * Events with no `source` are SSBMax's own (all payments made before this guard existed).
 */

const FOREIGN_APP_SOURCES = new Set(['actionstation']);

/** Razorpay entities that can carry the app-identifying `notes` for an event. */
const ENTITY_KEYS = ['payment', 'subscription', 'order', 'refund'];

/**
 * True when the webhook body belongs to another app on the shared Razorpay account.
 * Pure; never throws -- malformed bodies are "not foreign" so the existing handling decides.
 */
function isForeignAppEvent(body) {
  const payload = body?.payload;
  if (!payload || typeof payload !== 'object') return false;
  return ENTITY_KEYS.some((key) => {
    const source = payload[key]?.entity?.notes?.source;
    return typeof source === 'string' && FOREIGN_APP_SOURCES.has(source);
  });
}

module.exports = { isForeignAppEvent, FOREIGN_APP_SOURCES };
