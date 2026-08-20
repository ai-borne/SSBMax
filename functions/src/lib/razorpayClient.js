/**
 * Shared Razorpay REST call shape (Phase 7, Payment Ecosystem Hardening plan). Before this file,
 * `razorpaySubscriptions.js`'s `createRazorpaySubscription` and `razorpaySubscriptionCancel.js`'s
 * `cancelRazorpaySubscriptionForUser` each hand-rolled the same `Authorization: Basic
 * base64(keyId:keySecret)` + JSON POST + `{error: {description}}` unwrap. Phase 7's drift sweep
 * (`subscriptions/scheduledRazorpayDriftSweep.js`) needed a third caller (`GET /v1/subscriptions`,
 * paginated) -- rather than hand-roll a second HTTP client, this extracts the shape once so all
 * three share it (DRY, root CLAUDE.md Rule 8).
 *
 * Every call takes an injectable `fetchImpl` (mirroring `cancelRazorpaySubscriptionForUser`'s
 * existing convention) so callers stay testable against a fake fetch, never a live network call.
 */

function razorpayAuthHeader(keyId, keySecret) {
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

/**
 * One Razorpay REST call. Throws a plain `Error` (never an `HttpsError`) on a non-OK response or
 * network failure -- each call site wraps that into whatever error shape its own context needs
 * (an `HttpsError('internal', ...)` for a callable, an aborted sweep page for the cron), matching
 * `createRazorpaySubscription`'s existing try/catch-and-rethrow convention.
 */
async function razorpayRequest(fetchImpl, { keyId, keySecret, method = 'GET', path, body }) {
  const response = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: razorpayAuthHeader(keyId, keySecret)
    },
    ...(body != null ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || `Razorpay API error (HTTP ${response.status})`);
  }
  return data;
}

/**
 * One page of currently-active Razorpay subscriptions, `count`/`skip`-paginated -- the enumeration
 * primitive `scheduledRazorpayDriftSweep.js` sweeps with. Mirrors the pagination shape the
 * `docs/plans` audit's "cron pagination" scale gap already fixed for the reconciliation cron
 * (`45282b8e`), applied here to a Razorpay list call instead of a Firestore query.
 */
async function listActiveSubscriptions(fetchImpl, { keyId, keySecret, count = 100, skip = 0 }) {
  return razorpayRequest(fetchImpl, {
    keyId,
    keySecret,
    method: 'GET',
    path: `/subscriptions?status=active&count=${count}&skip=${skip}`
  });
}

module.exports = { razorpayAuthHeader, razorpayRequest, listActiveSubscriptions };
