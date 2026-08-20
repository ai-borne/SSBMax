# Subscription Tier & Pricing Restructure (SSBMax-kmp)

## Context

We finalized new subscription economics (see prior analysis): a 4-tier model —
FREE / BASIC ₹299 / PRO ₹499 / PREMIUM ₹999 — with monotonically increasing
test allowances per tier so the pricing table reads coherently to users, and
per-user AI/GCP cost math confirming healthy margins (69–85%) at each tier.

Implementing this surfaced that the **actual current code has three
independent, disagreeing sources of PRO pricing**:

| Source | PRO monthly | PRO yearly |
|---|---|---|
| `shared/.../domain/model/SubscriptionTier.kt` | ₹99 | ₹999 |
| `web/src/constants/strings/common.ts` | ₹499 (ribbon string) | — |
| `functions/src/webhooks.js` `TIER_PRICES` | ₹499 | ₹4,999 |

Only the **quota limits** are genuinely single-sourced today, via the
existing `contracts/` codegen pipeline (`contracts/subscription.yaml` →
generates `SubscriptionLimits` in KMP, `subscriptionEligibility.ts` in web,
`eligibility.js` in functions). **Prices, feature copy, and billing SKUs are
not part of that pipeline** — they're hand-duplicated per platform. This plan
(a) introduces the new BASIC tier and monotonic limits through the existing,
proven contracts pipeline, and (b) extends that same pipeline to cover prices
for the first time, closing the drift instead of adding a fourth
disagreeing copy.

It also designs the previously-flagged gaps: subscription start/expiry-date
tracking (currently absent entirely) and a mid-cycle Interview top-up
purchase path — both explicitly requested.

## What's in scope vs. explicitly deferred

**In scope:**
1. New BASIC tier + monotonic test limits, added to `contracts/subscription.yaml`.
2. New pricing contract (`contracts/pricing.yaml`) as the SSOT for ₹ amounts, generated into KMP/web/functions, replacing all three hand-coded copies.
3. Subscription start/expiry-date fields — new, additive fields on the subscription Firestore doc + DTOs, since none exist today.
4. Interview top-up (metered add-on) purchase path — new product type, not a tier.
5. Reset-boundary change: billing-anniversary-based reset instead of the current global calendar-month reset (flagged as a real UX bug earlier in the conversation).
6. Fixing the Play/StoreKit product ID gap (currently placeholder-only, no PRO/BASIC SKUs, no quarterly SKUs) to match the new tiers.

**Explicitly deferred (call out, don't silently skip):**
- Real Play Console / App Store Connect SKU registration — that's a console/dashboard action outside this codebase, this plan only prepares the product ID constants and billing code to reference them.
- Server-side reconciliation for Play/StoreKit purchases (RTDN / App Store Server Notifications) — flagged as a pre-existing gap (only Razorpay has a webhook today); needed for expiry-date enforcement to work on Android/iOS, but is its own project. This plan will add the Firestore schema for it and the Razorpay path fully, and stub the Play/StoreKit path with a clear TODO + tracked gap, rather than pretending it's solved.
- Duplicate "Premium (AI)" vs "Premium" UI plan entries in the old Android `UpgradeViewModel` — that file no longer exists in this KMP repo (superseded by `presentation/premium/UpgradeViewModel.kt`); will verify no equivalent duplication exists there and fix if found, but it's not a named blocker.

## Implementation steps

### 1. `contracts/subscription.yaml` — add BASIC tier, monotonic limits

Add a `BASIC` column to every bucket (additive — safe per the compatibility
policy). Final values, matching the finalized math:

| bucket | FREE | BASIC | PRO | PREMIUM |
|---|---|---|---|---|
| OIR | 1 | 5 | 8 | 15 |
| PPDT | 1 | 5 | 8 | 15 |
| PIQ | 1 | 5 | 8 | -1 |
| TAT | 0 | 5 | 8 | 15 |
| WAT | 0 | 5 | 8 | 15 |
| SRT | 0 | 5 | 8 | 15 |
| SD | 0 | 5 | 8 | 15 |
| GTO | 0 | 5 | 8 | 15 |
| INTERVIEW | 0 | 1 | 3 | 10 |

Note: GTO stays a **single shared bucket across all 8 sub-tests** (GD, GPE,
PGT, GOR, HGT, LECTURETTE, GTO_IO, CT) — that's how `subscription.yaml`
already models it today (`bucket: GTO`, `testTypes: [GTO_GD, ... GTO_CT]`).
The finalized pricing math treated "GTO (each)" as an averaged per-sub-test
cost proxy for the economics, but splitting GTO into per-sub-test buckets
would be a larger architecture change (new bucket keys, new Firestore usage
counters, new `SubscriptionDtos` fields) that nothing in today's code
supports. Keeping one shared GTO bucket at the tier's "each" number is the
correct-scope translation of the finalized table into the existing schema.

PIQ keeps `-1` (unlimited) only at PREMIUM, matching its existing
"unlimited" special-casing — earlier tiers get the standard monotonic count
like other buckets, which is a small deliberate deviation from the exact
"PIQ was always unlimited-ish" behavior in the old code; flag this to the
user in the summary as a decision point.

Bump `schemaVersion` per the compatibility policy's additive-change
convention (check `contracts/README.md` §Schema Compatibility Policy for the
exact bump rule — additive fields typically only need a minor bump).

### 2. New `contracts/pricing.yaml` — the actual pricing SSOT

New file, following the same shape as `subscription.yaml`:

```yaml
schemaVersion: "1.0.0"
currency: INR
tiers:
  - tier: FREE
    monthly: 0
  - tier: BASIC
    monthly: 299
  - tier: PRO
    monthly: 499
  - tier: PREMIUM
    monthly: 999
addOns:
  - id: INTERVIEW_TOPUP
    name: "Extra Interview Session"
    price: 99
    grants:
      bucket: INTERVIEW
      count: 1
```

Extend `scripts/generate-contracts.js` to read this file and emit a `Pricing`
object into `SsbContracts.kt` / `contracts.ts` / `contracts.cjs`, following
the exact pattern already used for `Subscription.LIMITS` (same script, same
three output targets). This is additive to the generator, not a rewrite.

### 3. Replace hand-coded prices with generated values

- `shared/src/commonMain/kotlin/com/ssbmax/shared/domain/model/SubscriptionTier.kt` — replace the hard-coded `monthlyPrice`/`monthlyPriceInt`/`yearlyPrice`/`quarterlyPrice` properties with lookups into the generated `SsbContracts.Pricing` table. Add `BASIC` to the enum (currently `FREE, PRO, PREMIUM` only) — this is the one non-additive-looking change, but adding an enum case is safe under the policy (only *removing* or *renaming* cases is the risky operation).
- `web/src/constants/strings/common.ts` — remove the hand-written `ribbonProPrice`/`ribbonPremiumPrice` strings; source from `web/src/generated/contracts.ts`'s new `Pricing` export instead.
- `functions/src/webhooks.js` — replace the hard-coded `TIER_PRICES` object with the generated `contracts.cjs` `Pricing` table, so Razorpay underpayment validation can never drift from displayed prices again.
- `web/src/viewmodels/PaymentViewModel.ts` — remove the hardcoded `amount: 49900` fallback; derive from generated pricing + selected tier.
- `functions/src/payments.js` (`createRazorpayOrder`) — same fix, derive order amount from generated pricing rather than a hardcoded default.

### 4. Subscription start/expiry-date tracking (new — nothing exists today)

- Add `startDate: Long`, `expiryDate: Long?`, `billingCycle: String` fields to `SubscriptionTierDto` in `shared/src/commonMain/.../data/repository/SubscriptionDtos.kt` (currently just `{ tier: String }`).
- `functions/src/webhooks.js` `handleRazorpayWebhook` — on successful payment, additionally write `startDate = now`, `expiryDate = now + billingCycleMonths` (30/90/365 days per cycle) to `users/{uid}/data/subscription`, alongside the existing `isPaidMember`/`membershipPlan` fields.
- New scheduled Cloud Function (e.g. `functions/src/subscriptionExpiry.js`, daily cron) that queries for `expiryDate < now` and `autoRenew: false` (or where Razorpay's own recurring-payment mandate has lapsed) and downgrades `tier` back to `FREE` — this closes the "no downgrade mechanism exists" gap found during exploration.
- `GitLiveSubscriptionRepository.kt` (`data-firebase`) — extend its Firestore mapper to read the new fields into `UserSubscription`-equivalent domain state (or the existing lean `SubscriptionTierDto` mapping, whichever the current KMP domain model uses for this — verify exact target type when implementing).

### 5. Reset boundary: billing-anniversary instead of calendar month

Current: `CheckTestEligibilityUseCase`/`eligibility.js` key usage docs by
`yyyy-MM` (global calendar month) — a user who subscribes on the 25th only
gets 5 days before their first reset.

Change: derive the "current period" key from `startDate` (now available per
step 4) instead of wall-clock month — e.g. `floor((now - startDate) /
periodLengthDays)`. This touches:
- `functions/src/eligibility.js` (server-authoritative usage transaction — the real enforcement point)
- `shared/src/commonMain/.../domain/usecase/subscription/CheckTestEligibilityUseCase.kt` (client-side eligibility check, must compute the same period key or it'll show stale "remaining tests" before syncing)
- `web/src/domain/subscriptionEligibility.ts` (web port, same period-key logic)

This is the highest-risk step — it changes a value all three platforms must
agree on identically, and FREE-tier users (no `startDate` since they never
purchased) need a defined fallback (likely: account-creation date, or keep
calendar-month reset for FREE only since it's low-stakes). Flag this
fallback decision explicitly during implementation review, don't guess
silently.

### 6. Interview top-up add-on

- New product type (not a subscription tier) — `INTERVIEW_TOPUP` id, ₹49, defined in `contracts/pricing.yaml` (step 2).
- `functions/src/payments.js` — extend `createRazorpayOrder` to accept `planId: 'interview_topup'` and route to a webhook handler that grants `+1` to the user's current-period INTERVIEW bucket usage doc (decrement `interviewTestsUsed` or increment a separate `interviewTopupsGranted` counter — needs a small `eligibility.js` change so `recordTestUsage`'s limit check accounts for topped-up sessions, e.g. `effectiveLimit = tierLimit + topupsGranted`).
- Android/iOS: add `INTERVIEW_TOPUP` as a Play Billing **in-app product** (not subscription) / StoreKit **consumable** — separate purchase flow from `PlayBillingClient`'s existing subscription-only (`ProductType.SUBS`) handling, since Play Billing treats consumables and subscriptions as distinct product types.
- UI: surface a "buy 1 more interview session" action on `TestLimitReachedDialog.kt` specifically when `testType == IO` and tier allows top-ups (i.e., not FREE, which has no Interview access to top up at all).

### 7. Billing SKU / product ID cleanup

`SSBMaxProductIds` currently has only `PREMIUM_MONTHLY`/`PREMIUM_YEARLY`
placeholders, no PRO/BASIC IDs, no quarterly IDs. Define the full matrix
needed for the new tiers (monthly only, per earlier conversation — quarterly/
yearly can be added later, don't over-build): `BASIC_MONTHLY`, `PRO_MONTHLY`,
`PREMIUM_MONTHLY`, `INTERVIEW_TOPUP`. These remain placeholder strings until
real Play Console / App Store Connect products are registered (explicitly
deferred, see scope section) — this step only makes the code consistent
with the 4-tier + add-on model instead of the old 2-SKU-only setup.

## Cross-cutting: things flagged during this sprint (as requested)

1. **PIQ's "always unlimited" behavior** doesn't fit cleanly into monotonic per-tier counts — decision made to keep PIQ standard except at PREMIUM; flag as a judgment call, not a hidden change.
2. **GTO stays one shared bucket** across 8 sub-tests rather than splitting into GD/GPE/Lecturette-specific buckets — matches existing schema, avoids a much larger change; the finalized pricing math's "GTO each" was an averaging proxy for cost, not a literal per-sub-test entitlement in the shipped product.
3. **No server-side reconciliation exists for Play/StoreKit purchases** (only Razorpay has a webhook) — expiry-date-driven downgrade (step 4) will only work automatically for Razorpay/web purchases until RTDN/App Store Server Notifications are built; Android/iOS purchases will need that follow-up project to fully close the loop. Flagging now so it isn't discovered late.
4. **Billing-anniversary reset (step 5) is the riskiest single change** — three platforms must compute the identical period key, and FREE-tier users need an explicit fallback since they have no `startDate`. Recommend implementing and testing this in isolation, behind the existing `ENFORCE_QUOTA` kill-switch pattern already present in `eligibility.js`, before wiring it everywhere.
5. **Interview top-up requires a Play Billing product-type split** (subscriptions vs. consumables) that `PlayBillingClient.kt` doesn't currently handle — it's subscriptions-only today.
6. **Duplicate stale `TestType` enum copies** found in `SSBPhase.kt` and `SSBPromptCore.kt:451` alongside the generated contract version — not touched by this plan (out of scope), but worth a separate cleanup pass since they're a drift risk of the same shape as the pricing issue this plan fixes.
7. **`contracts/README.md`'s "Authority: KMP is authoritative"** clause needs a mental update once pricing moves into `contracts/` — pricing is a business decision, not a KMP implementation detail, so the YAML becomes authoritative over *all* platforms equally (this plan already treats it that way; noting the doc's current wording is slightly stale for this new category of contract data).

## Verification

- `npm run contracts:check` after editing YAML + regenerating — this is the existing CI/pre-commit check that diffs generated output against committed files; must pass before any consumer code references the new pricing/limits.
- `shared/src/commonTest/.../presentation/SubscriptionTierSsotTest.kt` and `SubscriptionLimitsTest.kt` — existing SSOT tests; extend them to assert BASIC's presence and the new monotonic limits, and add an equivalent test asserting generated pricing matches `contracts/pricing.yaml` exactly (mirroring the existing limits SSOT test pattern).
- `CheckTestEligibilityUseCaseTest.kt` — add cases for BASIC tier eligibility and for the billing-anniversary reset boundary (including the FREE-tier fallback path).
- Firestore emulator / `firestore-tests/` — add coverage for the new `startDate`/`expiryDate` fields and the scheduled downgrade function, following the existing pattern in `firestoreRulesCoverage.rules.test.mjs`.
- Manual: run the Android app, force each tier via the existing `SubscriptionOverride` dev flag (`FORCE_FREE`/`FORCE_PRO`/`FORCE_PREMIUM` — will need a `FORCE_BASIC` case added), confirm `TestLimitReachedDialog` and `SubscriptionManagementScreen` show correct monotonic limits and prices for all four tiers.
- Manual: trigger a Razorpay test-mode webhook payload for each `planId` (basic/pro/premium monthly + interview_topup) and confirm `TIER_PRICES`-equivalent underpayment validation uses the new generated pricing, and that `startDate`/`expiryDate` are written correctly.
