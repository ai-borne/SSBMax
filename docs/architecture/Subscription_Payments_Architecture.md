# Subscription & Payments Architecture

Covers the store-only billing model: **purchases happen only in the App Store / Google Play (via RevenueCat), RevenueCat is the only writer of the entitlement, and the website only reads it.** Razorpay was retired on 2026-09-25 (RevenueCat does not support Razorpay; owner decision). Written for an agent or developer arriving cold. Every claim below was read out of the code, not out of a plan doc; where present state and planned state differ, both are marked.

Related: root [`../../CLAUDE.md`](../../CLAUDE.md) (12 rules, SSOT policy), [`../../functions/CLAUDE.md`](../../functions/CLAUDE.md), [`../../web/CLAUDE.md`](../../web/CLAUDE.md), and the active hardening plan (§8).

---

## 1. The One Idea That Explains Everything Else

**RevenueCat is the only writer. Firestore is the authority every gate reads.**

RevenueCat is upstream of a *projection*: a webhook arrives → `handleRevenueCatWebhook` writes `tier`/`expiryDate` to one Firestore document → every gate in the product reads that document. The authoritative quota gate, `functions/src/eligibility.js`, reads Firestore and never calls RevenueCat. The website reads the same document and grants access; it has no checkout and no cancel action.

```text
Apple / Google ──▶ RevenueCat ──▶ handleRevenueCatWebhook ──▶ users/{uid}/data/subscription ──▶ eligibility.js ──▶ allow/deny
                                                                     ▲                                  (THE authority)
                                 repairMobileEntitlement (RC-verified, client-triggered) ──┘
                                                                     │
                                                              web reads it (SubscriptionPage: "manage in your app store")
```

Consequences a newcomer must internalise:

- The projection layer is **hand-written**. "Handled by RevenueCat" does not remove the failure mode: a dropped webhook desynchronises the projection, and nothing in the RevenueCat dashboard will show it (it is correct; Firestore is stale).
- The store and RevenueCat remain the truth for **money** (charges, refunds, dunning). Firestore is the truth for **access**. Different questions, answered in different places.
- One writer means no cross-platform reconciliation: an incoming RevenueCat event always wins. A pre-retirement doc still carrying `source: 'RAZORPAY'` is simply overwritten by the next RevenueCat event, and the reconciliation cron downgrades it at `expiryDate` like any other.

---

## 2. Why Store Billing Only

Apple and Google mandate their own IAP for in-app digital goods, and RevenueCat is the single entitlement authority across both. RevenueCat Web Billing supports RevenueCat Billing, Stripe and Paddle, **not Razorpay**, and RevenueCat Billing cannot be used in India. Rather than run a second provider with its own webhook, secrets and dual-purchase collisions, web checkout was removed. **Refunds and cancellation are handled by Apple / Google**, not by us.

Do not "consolidate" onto RevenueCat promotional entitlements for paying users: they are prefixed `rc_promo` and deliberately decoupled from billing. (They are fine for a manual grant, e.g. migrating a legacy payer.)

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

RevenueCat's `{tier.toLowerCase()}_monthly` products are **hand-configured in the RC dashboard**, not derived from this file. Adding or renaming a tier updates `contracts/pricing.yaml` and RevenueCat not at all. Web shows these prices for information only.

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
| `source` | String? | `REVENUECAT` / null. Legacy docs written before 2026-09-25 may read `RAZORPAY` (informational; overwritten by the next RevenueCat event) |
| `willRenew` | Boolean (default true) | Auto-renew flag; web shows it as renewal status |

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
| Entitlement mapper | `RevenueCatEntitlementMapper` — an `object` **inside `RevenueCatClient.kt`**, not its own file (a `RevenueCatEntitlementMapper.kt` file does not exist) |
| Android actual | `shared/src/androidMain/.../billing/PlayBillingClient.kt` |
| iOS actual | `shared/src/iosMain/.../billing/StoreKitBillingClient.kt` |
| Purchase ViewModel | `shared/.../presentation/premium/UpgradeViewModel.kt` |
| Webhook | `functions/src/revenueCatWebhook.js` |

### 5.2 Entitlement mapping

Products are `basic_monthly` / `pro_monthly` / `premium_monthly` . The RevenueCat dashboard grants them cumulatively — `basic_monthly`→`basic`, `pro_monthly`→`basic+pro`, `premium_monthly`→`basic+pro+premium` — so the mapper picks the **highest present** and never combines tiers itself:

```
premium → PREMIUM,  pro → PRO,  basic → BASIC,  else FREE
```

Entitlement id constants: `RevenueCatEntitlements` in `RevenueCatClient.kt`. Duplicated by hand in two runtimes: `RevenueCatEntitlementMapper.toTier()` (Kotlin) and `entitlementIdsToTier()` in `revenueCatWebhook.js` (Node). These are RevenueCat dashboard identifiers, not app-domain data, so they are deliberately **not** a `contracts/` value — the cost is that the two copies can drift (finding L4).

### 5.3 Events handled

`INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION` (grant) · `EXPIRATION`, `REFUND`, `BILLING_ISSUE` (revoke).

`SUBSCRIPTION_PAUSED` is treated as a revoke and `TRANSFER` downgrades every still-RevenueCat-sourced `transferred_from` user (`lib/revenueCatTransfer.js`).

### 5.4 Cancellation

Apple and Google forbid backend cancellation of StoreKit/Play subscriptions. Mobile must deep-link to store-managed settings; there is no server-side cancel path and there must not be one.

---

## 6. Web Path (read-only)

| Layer | File |
|---|---|
| Entitlement page | `web/src/components/subscription/SubscriptionPage.tsx` — tier cards, current plan, renewal status, and a fixed "manage in your app store" notice. No checkout, no cancel. |
| Reads | `SubscriptionViewModel.ts`, `useSubscriptionOwnership.ts` → `SubscriptionRepository.ts` (`users/{uid}/data/subscription`) |
| Legal copy | `strings.terms.sec2Text`, `strings.refundPolicy`, `strings.faq.a4` — state that Apple / Google bill and refund |

Web writes nothing to the tier doc (rules forbid it, §3.4). To change, cancel or refund, the user goes to their store's subscription settings.

### 6.1 Removed (2026-09-25)

`createRazorpayOrder`, `createRazorpaySubscription`, `cancelRazorpaySubscription`, `handleRazorpayWebhook`, `scheduledRazorpayDriftSweep`, the Razorpay client / signature / foreign-event / provider-state libraries, `web/src/services/{RazorpayService,PaymentService}.ts`, `PaymentViewModel.ts`, the `razorpay_subscriptions_checkout` flag consumer, and the Razorpay origins in the CSP (`web/public/_headers`). The Firebase secrets `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_IDS`, `RAZORPAY_WEBHOOK_SECRET` and the Razorpay test webhook are deleted by the owner after deploy, not by code.

---

## 7. Cross-Cutting Mechanisms

### 7.1 No dual-purchase gate

With RevenueCat the only writer there is nothing to collide with, so `assertNoActiveRevenueCatSubscription`, the web purchase block and the Kotlin `activeOnWebInstead` guard (`UpgradeViewModel`, `UpgradeScreen`) are all gone. `source` remains on the document as provenance only, and a legacy `RAZORPAY` value never blocks a mobile purchase or restore (`UpgradeViewModelTest` pins this). `SubscriptionRepository.getSubscriptionOwnership` stays for the subscription-management screen.

### 7.2 Idempotency

Webhook events are deduped via `webhook_logs` (functions-only collection, never client-readable), keyed `rc_{event.id}`.

### 7.3 Reconciliation cron

`scheduledSubscriptionReconciliation` sweeps `collectionGroup('data')` filtered by `billingCycle == 'MONTHLY'` (profile docs never set that field, so they never match). **Invariant:** Firestore excludes documents *missing* a filtered field, so any tier-writing path that omits `billingCycle` yields a document reconciliation can never see. Both current writers set it (`revenueCatWebhook.js` and `subscriptions/repairMobileEntitlement.js`; `test/subscriptionWriteInvariant.test.js` pins this) — the sweep needs a `collectionGroup('data')` index on `billingCycle` (`firestore.indexes.json`) deployed, so any new writer must too, finds `tier != 'FREE' && expiryDate < now`, and writes FREE. Paginated at `BATCH_SIZE = 250`, `MAX_BATCHES_PER_RUN = 8`. No cursor doc is needed: each downgrade flips `tier` to FREE, dropping the doc out of the query, so the write is its own checkpoint.

**It only ever runs downhill.** The upward counterpart is the client-triggered `repairMobileEntitlement` callable (§9.1).

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
| H2 | High | Legacy `payment.captured` writes no `expiryDate` → paid users read FREE | **Moot** — Razorpay path removed |
| H3 | High | Legacy handler also claims subscription-family payments | **Moot** — Razorpay path removed |
| H4 | High | RevenueCat identity may resolve after purchase → orphan entitlement | Open |
| H5 | High | No cancellation path on either platform | **Closed by design** — cancellation is store-managed; web shows "manage in your app store" |
| M1/M2/M4/M5 | Medium | Out-of-order events; `conflictDetectedAt` read by nothing; unconditional refund revocation; idempotency fallback | Open (M5 and the cross-platform half of M2 are moot with Razorpay gone) |
| L1–L5 | Low | Signature freshness; swallowed read errors; unhandled event types; duplicated entitlement map; premature web success | Open |

C1's fix is live: the deployed ruleset carries `allow write: if isOwner(userId) && document != 'subscription'` and is byte-identical to `firestore.rules`; `updateSubscriptionTier` is gone from the KMP repository interface.

---

## 9. Future State: What Is Being Built

Capabilities in this section: 9.1 and 9.3 are implemented; 9.2 partly. They are operability, not findings.

### 9.1 Bidirectional drift repair

Reconciliation only downgrades. The upward repair is the client-triggered `repairMobileEntitlement` callable: RevenueCat has no cheap bulk "all active subscribers" endpoint, but the SDK hands each device authoritative `CustomerInfo`. The callable decides through one pure `resolveSubscriptionDrift()` consuming `effectiveTier.js`. **Security constraint: it must re-verify against RevenueCat's REST API server-side and never write what the client asserts** — otherwise it is C1 reintroduced.

### 9.2 Alerting

There is currently no alerting integration anywhere in `functions/src`, Planned: `functions/src/lib/opsAlert.js` emitting a structured `ops_alerts` doc (server-only) plus a labelled `console.error`, with the log-based metric, email notification channel and alert policy provisioned as code by an idempotent `functions/scripts/set-ops-alerting.js` (`--dry-run` / `--verify` / `--smoke`).

### 9.3 Support view

No admin or ops surface exists. Answering "I paid and I'm still on Free" currently means joining the Firestore console and the RevenueCat dashboard by hand. `getSubscriptionSupportSnapshot` is an admin-claim-gated, **read-only** callable joining three sources (Firestore doc, RevenueCat customer, recent `ops_alerts`), surfaced in a web-only page. This is an internal ops tool and is **deliberately not** an Android/iOS parity gap.

---

## 10. Things That Will Bite You

1. **`data/subscription` vs `subscription/usage_*`** are different subcollections. Read §3.3 before touching either.
2. **Firestore rules are additive.** A narrow `allow write: if false` never revokes a broader grant. `firestore-tests/firestoreRulesCoverage.rules.test.mjs` only scans 4-space top-level `match` blocks, which is exactly why C1 went unnoticed.
3. **`FirebaseRulesValidationTest.kt` string-slices `firestore.rules`** on the literals `"// User data subcollection"`, `"match /users/{userId}"` and `"match /data/subscription"`. Keep those anchors intact.
4. **`firestore.rules` cannot be split** — rules have no import mechanism; it is one deployable artifact by design, exempt from the 300-LOC cap.
5. **Rules deploy is manual** (`firebase deploy --only firestore:rules`) and is not in CI. Two undetectable failure modes follow: a rules change merges and is never deployed, or someone edits rules in the console and the repo stops matching production. Verify with the Firebase Rules API (`projects/{project}/releases` → `rulesets/{id}`) and diff against `firestore.rules`. A rules change and its client change must also land close together, or the client fails silently in the field.
6. **Four consumers, not two.** Any change to eligibility or scoring logic must be checked against `shared`, `web/src/repositories`, `web/src/viewmodels` and `functions/`. Tier 3 has no mechanical enforcement — convention only.
7. **The RevenueCat dashboard will not tell you the projection is wrong.** It answers a different question (money, not access).
