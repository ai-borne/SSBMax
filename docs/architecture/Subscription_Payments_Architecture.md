# Subscription & Payments Architecture

Covers both platforms end to end: **mobile (Android/iOS) via RevenueCat over StoreKit/Play Billing**, and **web via Razorpay**. Written for an agent or developer arriving cold. Every claim below was read out of the code, not out of a plan doc; where present state and planned state differ, both are marked.

Related: root [`../../CLAUDE.md`](../../CLAUDE.md) (12 rules, SSOT policy), [`../../functions/CLAUDE.md`](../../functions/CLAUDE.md), [`../../web/CLAUDE.md`](../../web/CLAUDE.md), and the active hardening plan (§8).

---

## 1. The One Idea That Explains Everything Else

**Neither RevenueCat nor Razorpay is the entitlement authority. Firestore is.**

Both providers are upstream of a *projection*: a webhook arrives → a Cloud Function writes `tier`/`expiryDate` to one Firestore document → every gate in the product reads that document. The authoritative quota gate, `functions/src/eligibility.js`, reads Firestore and never calls either provider.

```text
Apple / Google  ──▶ RevenueCat ──▶ handleRevenueCatWebhook ──┐
                                                            ├──▶ users/{uid}/data/subscription ──▶ eligibility.js ──▶ allow/deny
Razorpay ─────────────────────────▶ handleRazorpayWebhook ──┘                (THE authority)
```

Consequences a newcomer must internalise:

- The projection layer is **hand-written on both platforms**. Mobile is not "handled by RevenueCat" in any sense that removes risk; it carries the same failure mode as web.
- A dropped webhook desynchronises the projection. Nothing in the provider dashboards will show this — they are correct; Firestore is stale.
- Provider dashboards remain the truth for **money** (charges, refunds, mandates, dunning). Firestore is the truth for **access**. These are different questions and are answered in different places.

---

## 2. Why Two Providers

Not a design preference. RevenueCat Web Billing supports RevenueCat Billing, Stripe and Paddle — **not Razorpay** — and RevenueCat Billing cannot be used in India (it does not collect the billing-address data Indian regulation requires). Apple and Google separately mandate their own IAP for in-app digital goods. Serving Indian users UPI AutoPay on web while satisfying store policy on mobile therefore forces exactly this split.

Do not "consolidate" onto RevenueCat promotional entitlements. They are prefixed `rc_promo`, are deliberately decoupled from billing, and would make Razorpay revenue unreportable.

---

## 3. Domain Model

### 3.1 Tiers and prices

Four tiers, monthly billing only. Prices in INR, from `contracts/pricing.yaml`:

| Tier | Price/mo |
|---|---|
| FREE | 0 |
| BASIC | 299 |
| PRO | 499 |
| PREMIUM | 999 |

Add-on: `INTERVIEW_TOPUP` = 99.

Note the asymmetry in how product ids reach the two providers: Razorpay's app-side plan ids are **derived** (`{tier.toLowerCase()}_monthly` over this file), while RevenueCat's identically-named products are **hand-configured in the RC dashboard**. Adding or renaming a tier updates Razorpay automatically and RevenueCat not at all.

Enum SSOT: `shared/.../domain/model/SubscriptionTier.kt`.

### 3.2 Monthly limits

SSOT is `contracts/subscription.yaml` (schemaVersion 1.1.0), mechanically codegen'd into all four consumers. `-1` = unlimited. Values are monotonic FREE ≤ BASIC ≤ PRO ≤ PREMIUM per bucket.

| Bucket | FREE | BASIC | PRO | PREMIUM |
|---|---|---|---|---|
| OIR | 1 | 5 | 8 | 15 |
| PPDT | 1 | 5 | 8 | 15 |
| PIQ | 1 | 5 | 8 | −1 |
| TAT | 0 | 5 | 8 | 15 |
| WAT | 0 | 5 | 8 | 15 |
| SRT | 0 | 5 | 8 | 15 |
| SD | 0 | 5 | 8 | 15 |
| GTO | 0 | 5 | 8 | 15 |
| INTERVIEW | 0 | 1 | 3 | 10 |

**All 8 GTO sub-tests share the single GTO bucket.** KMP consumer: `SubscriptionLimits` in `shared/.../data/repository/SubscriptionDtos.kt`, which only *reads* `SsbContracts.Subscription.LIMITS` — never redefine limits anywhere else.

### 3.3 The subscription document

`users/{userId}/data/subscription` — one doc per user, schema in `SubscriptionTierDto`:

| Field | Type | Meaning |
|---|---|---|
| `tier` | String | Stored tier. **Not** necessarily the effective tier — see §4. |
| `startDate` | Long (0 = unset) | Drives the billing-anniversary usage-reset key |
| `expiryDate` | Long? | Epoch ms. `null` = legacy/grandfathered, treated as non-expiring |
| `billingCycle` | String? | `MONTHLY`. Also the discriminator the reconciliation cron filters on |
| `source` | String? | `RAZORPAY` / `REVENUECAT` / null — which webhook last wrote this doc |
| `willRenew` | Boolean (default true) | Flipped by cancel/pause/resume webhooks without touching `tier`/`expiryDate` |

Usage counters live in a **sibling** subcollection, `users/{userId}/subscription/usage_{yyyy-MM}`. The two are easy to confuse: `data/subscription` is the tier doc; `subscription/usage_*` are the counters.

### 3.4 Access control

Both are server-written only:

```
users/{uid}/data/{document}   allow write: if isOwner(userId) && document != 'subscription'
users/{uid}/subscription/*    allow write: if false      // recordTestUsage callable, Admin SDK
```

The `document != 'subscription'` exclusion is load-bearing and must stay on the **broad** rule. Firestore rules are additive: a narrower `allow write: if false` block cannot revoke a grant made by a wider matching rule. Before this exclusion landed, any signed-in user could grant themselves PREMIUM with one client SDK write. `profile` and every other doc in `data/` remain client-written — do not widen this to lock the whole subcollection.

---

## 4. Effective Tier Is Derived, Not Read

The stored `tier` is not trusted at read time. Every reader derives:

```
effectiveTier = (expiryDate != null && expiryDate < now) ? FREE : tier
```

This is the primary defence against a missed expiry webhook — an expired doc reads as FREE everywhere even if no cron ever runs.

| Copy | Location | Status |
|---|---|---|
| KMP | `deriveEffectiveTier` in `GitLiveSubscriptionRepository.kt` | live |
| Web | `deriveEffectiveTier` in `web/src/repositories/SubscriptionRepository.ts` | live |
| Cron predicate | `shouldReconcile` in `scheduledSubscriptionReconciliation.js` | live |
| **Server quota gate** | `readSubscriptionDoc` in `functions/src/eligibility.js` | **MISSING — reads `tier` and `startDate` only** |

That fourth row is finding **H1** and it is a live defect: the gate the plan's own header calls "the real gate at submission time" honours an expired PREMIUM. Planned fix extracts one `functions/src/lib/effectiveTier.js` and has both server consumers use it (§8, Phase 2).

Client reads fail **open** (advisory); server gates fail **closed**. This asymmetry is deliberate — preserve it.

---

## 5. Mobile Path (RevenueCat)

### 5.1 Components

| Layer | File |
|---|---|
| Common interface | `shared/.../platform/billing/BillingClient.kt` |
| RevenueCat interface / impl | `shared/.../platform/billing/revenuecat/RevenueCatClient.kt`, `DefaultRevenueCatClient.kt` |
| Entitlement mapper | `RevenueCatEntitlementMapper` — an `object` **inside `RevenueCatClient.kt`**, not its own file (the comment in `revenueCatWebhook.js` points at a `RevenueCatEntitlementMapper.kt` path that does not exist) |
| Android actual | `shared/src/androidMain/.../billing/PlayBillingClient.kt` |
| iOS actual | `shared/src/iosMain/.../billing/StoreKitBillingClient.kt` |
| Purchase ViewModel | `shared/.../presentation/premium/UpgradeViewModel.kt` |
| Webhook | `functions/src/revenueCatWebhook.js` |

### 5.2 Entitlement mapping

Products are `basic_monthly` / `pro_monthly` / `premium_monthly` (same `{tier}_monthly` shape as the Razorpay plan ids). The RevenueCat dashboard grants them cumulatively — `basic_monthly`→`basic`, `pro_monthly`→`basic+pro`, `premium_monthly`→`basic+pro+premium` — so the mapper picks the **highest present** and never combines tiers itself:

```
premium → PREMIUM,  pro → PRO,  basic → BASIC,  else FREE
```

Entitlement id constants: `RevenueCatEntitlements` in `RevenueCatClient.kt`. Duplicated by hand in two runtimes: `RevenueCatEntitlementMapper.toTier()` (Kotlin) and `entitlementIdsToTier()` in `revenueCatWebhook.js` (Node). These are RevenueCat dashboard identifiers, not app-domain data, so they are deliberately **not** a `contracts/` value — the cost is that the two copies can drift (finding L4).

### 5.3 Events handled

`INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION` (grant) · `EXPIRATION`, `REFUND`, `BILLING_ISSUE` (revoke).

**Not handled:** `TRANSFER` (the original user keeps their tier forever), `SUBSCRIPTION_PAUSED` (finding L3).

### 5.4 Cancellation

Apple and Google forbid backend cancellation of StoreKit/Play subscriptions. Mobile must deep-link to store-managed settings; there is no server-side cancel path and there must not be one.

---

## 6. Web Path (Razorpay)

### 6.1 Components

| Layer | File |
|---|---|
| Checkout SDK wrapper | `web/src/services/RazorpayService.ts` |
| Callable wrapper | `web/src/services/PaymentService.ts` |
| ViewModels | `web/src/viewmodels/PaymentViewModel.ts`, `SubscriptionViewModel.ts`, `useSubscriptionOwnership.ts` |
| Order callable (legacy) | `createRazorpayOrder` — `functions/src/payments.js` |
| Subscription callable | `createRazorpaySubscription` — `functions/src/razorpaySubscriptions.js` |
| Webhook | `handleRazorpayWebhook` — `functions/src/webhooks.js` + `lib/razorpaySubscriptionWebhook.js` |

### 6.2 Two payment paths coexist

- **Legacy one-time order** (`payment.captured`) — the path currently live in production.
- **Subscriptions API** (`subscription.*`) — gated behind feature flag `razorpay_subscriptions_checkout`, which is **absent from `functions/scripts/set-feature-flags.js`** and therefore resolves `false` in prod.

This matters: bugs in the legacy branch are live defects, not latent ones. In particular its `applySubscriptionTier` writes no `expiryDate` (finding H2) — the subscription-family handler in `lib/razorpaySubscriptionWebhook.js` does write it, which is why the bug is path-specific.

### 6.3 Plan IDs

App-side plan ids are derived: `{tier.toLowerCase()}_monthly` for every non-FREE tier in `contracts/pricing.yaml`. The Razorpay-dashboard plan ids they map to are per-Razorpay-account, so they live in a Secret Manager secret `RAZORPAY_PLAN_IDS` (JSON), not in `contracts/`. Secrets used: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_IDS`.

### 6.4 Events handled

`payment.captured`, `refund.processed`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, `subscription.halted`, `subscription.paused`, `subscription.resumed`.

**Not handled:** `subscription.pending` (finding L3). Note this is *broader* coverage than the RevenueCat handler currently has.

### 6.5 What Razorpay owns, not us

The subscription state machine (`created → authenticated → active → pending → halted → cancelled/completed/expired`), auto-retries on failed charges, the dunning ladder, mandate/UPI AutoPay handling, invoices, refunds. We do not build any of that. What is hand-written is the webhook→document mapper.

---

## 7. Cross-Cutting Mechanisms

### 7.1 Dual-purchase gate

A user can reach both storefronts. `assertNoActiveRevenueCatSubscription` in `razorpaySubscriptions.js` rejects a Razorpay purchase when `source === 'REVENUECAT'` and the sub is active; the mobile UI shows `UpgradeUiState.activeOnWebInstead` in the mirror case. This is why `source` exists on the document and why a repair path must never silently clobber the other platform's tier.

### 7.2 Idempotency

Webhook events are deduped via `webhook_logs` (functions-only collection, never client-readable). `webhooks.js` currently invents `event_${Date.now()}` when no stable id is present, which defeats dedupe (finding M5 — planned fix is to reject such events).

### 7.3 Reconciliation cron

`scheduledSubscriptionReconciliation` sweeps `collectionGroup('data')` filtered by `billingCycle == 'MONTHLY'` (profile docs never set that field, so they never match). **Invariant:** Firestore excludes documents *missing* a filtered field, so any tier-writing path that omits `billingCycle` yields a document reconciliation can never see. All three current writers set it (`webhooks.js:70`, `lib/razorpaySubscriptionWebhook.js:108`, `revenueCatWebhook.js:194`) — nothing enforces that, so any new writer must too, finds `tier != 'FREE' && expiryDate < now`, and writes FREE. Paginated at `BATCH_SIZE = 250`, `MAX_BATCHES_PER_RUN = 8`. No cursor doc is needed: each downgrade flips `tier` to FREE, dropping the doc out of the query, so the write is its own checkpoint.

**It only ever runs downhill.** There is no counterpart that repairs a user the provider says is paying — see §9.

### 7.4 Quota enforcement

`recordTestUsage` (`functions/src/eligibility.js`) atomically checks quota and increments the counter, idempotent by `submissionId`. Admin SDK, so it bypasses rules; clients have no write path to counters at all. The client-side eligibility check (`CheckTestEligibilityUseCase` in KMP, `web/src/services/EligibilityService.ts` on web) is an **optimistic pre-check only** — a hand-duplicated copy of the decision logic that can drift from the server. The server is authoritative.

---

## 8. Present State: Known Open Findings

From a full-ecosystem audit against live code: 16 findings (1 Critical, 5 High, 5 Medium, 5 Low). Tracked in the hardening plan (`role-you-are-an-zesty-crystal.md` in the user's plans dir).

| ID | Severity | Summary | Status |
|---|---|---|---|
| C1 | Critical | Any user could self-grant PREMIUM via additive rules | **Closed & deployed** |
| M3 | Medium | Client-side optimistic tier write | **Closed** with C1 |
| H1 | High | `eligibility.js` ignores `expiryDate` | Open |
| H2 | High | Legacy `payment.captured` writes no `expiryDate` → paid users read FREE | Open |
| H3 | High | Legacy handler also claims subscription-family payments | Open |
| H4 | High | RevenueCat identity may resolve after purchase → orphan entitlement | Open |
| H5 | High | No cancellation path on either platform | Open |
| M1/M2/M4/M5 | Medium | Out-of-order events; `conflictDetectedAt` read by nothing; unconditional refund revocation; idempotency fallback | Open |
| L1–L5 | Low | Signature freshness; swallowed read errors; unhandled event types; duplicated entitlement map; premature web success | Open |

C1's fix is live: the deployed ruleset carries `allow write: if isOwner(userId) && document != 'subscription'` and is byte-identical to `firestore.rules`; `updateSubscriptionTier` is gone from the KMP repository interface.

---

## 9. Future State: What Is Being Built

Three capabilities are planned that do not exist today. They are operability, not findings.

### 9.1 Bidirectional drift repair

Today reconciliation only downgrades. A missed *upgrade* webhook strands a paying customer permanently, with no detection and no repair. Planned:

- **Razorpay (web):** scheduled sweep over `GET /v1/subscriptions?status=active`, compared against Firestore.
- **RevenueCat (mobile):** client-triggered repair callable — RevenueCat has no cheap bulk "all active subscribers" endpoint, but the SDK already hands each device authoritative `CustomerInfo`.

Both decide through one pure `resolveSubscriptionDrift()` consuming `effectiveTier.js`. **Security constraint: the mobile callable must re-verify against RevenueCat's REST API server-side and never write what the client asserts** — otherwise it is C1 reintroduced.

### 9.2 Alerting

There is currently no alerting integration anywhere in `functions/src`, and `conflictDetectedAt` is written by both webhook handlers and read by nothing. Planned: `functions/src/lib/opsAlert.js` emitting a structured `ops_alerts` doc (server-only) plus a labelled `console.error`, with the log-based metric, email notification channel and alert policy provisioned as code by an idempotent `functions/scripts/set-ops-alerting.js` (`--dry-run` / `--verify` / `--smoke`).

### 9.3 Support view

No admin or ops surface exists. Answering "I paid and I'm still on Free" currently means joining the Firestore console, the Razorpay dashboard and the RevenueCat dashboard by hand. Planned: an admin-claim-gated, **read-only** callable joining all four sources (Firestore doc, Razorpay subscription, RevenueCat customer, recent `ops_alerts`), surfaced in a web-only page. This is an internal ops tool and is **deliberately not** an Android/iOS parity gap.

---

## 10. Things That Will Bite You

1. **`data/subscription` vs `subscription/usage_*`** are different subcollections. Read §3.3 before touching either.
2. **Firestore rules are additive.** A narrow `allow write: if false` never revokes a broader grant. `firestore-tests/firestoreRulesCoverage.rules.test.mjs` only scans 4-space top-level `match` blocks, which is exactly why C1 went unnoticed.
3. **`FirebaseRulesValidationTest.kt` string-slices `firestore.rules`** on the literals `"// User data subcollection"`, `"match /users/{userId}"` and `"match /data/subscription"`. Keep those anchors intact.
4. **`firestore.rules` cannot be split** — rules have no import mechanism; it is one deployable artifact by design, exempt from the 300-LOC cap.
5. **Rules deploy is manual** (`firebase deploy --only firestore:rules`) and is not in CI. Two undetectable failure modes follow: a rules change merges and is never deployed, or someone edits rules in the console and the repo stops matching production. Verify with the Firebase Rules API (`projects/{project}/releases` → `rulesets/{id}`) and diff against `firestore.rules`. A rules change and its client change must also land close together, or the client fails silently in the field.
6. **Four consumers, not two.** Any change to eligibility or scoring logic must be checked against `shared`, `web/src/repositories`, `web/src/viewmodels` and `functions/`. Tier 3 has no mechanical enforcement — convention only.
7. **Provider dashboards will not tell you the projection is wrong.** They are answering a different question (money, not access).
