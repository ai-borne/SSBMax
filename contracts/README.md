# `contracts/` — Cross-Platform SSOT

This directory is the single source of truth for Tier-1 data shared across all
four consumers: KMP (`shared`, both Android and iOS), the web app (`web/`),
Cloud Functions (`functions/`), and `firestore.rules`. See
`docs/plans/CrossPlatform_SSOT` §2 for the full Tier 1/2/3 classification.

**Do not hand-edit anything under `generated/`.** Edit the YAML source files
here, then run:

```bash
node scripts/generate-contracts.js
```

This regenerates:

| Output | Consumed by |
|---|---|
| `generated/SsbContracts.kt` | `shared/src/commonMain/.../contracts/` (KMP, Android + iOS) |
| `generated/contracts.ts` | `web/src/generated/` |
| `generated/contracts.cjs` | `functions/src/generated/` |
| `generated/rules-paths.json` | `firestore.rules` path linter |

`npm run contracts:check` regenerates into a temp location and diffs against
what's committed — it's what CI and the pre-commit hook run to catch a hand
edit or a stale generation.

## Source files

- `firestore-paths.yaml` — collection/sub-collection paths, doc-id conventions
- `enums.yaml` — `TestType`, `SubscriptionTier`, `OLQ`, statuses, OIR question types
- `subscription.yaml` — the per-tier, per-test-type quota table
- `test-config.yaml` — question/item counts, timers, TAT's 12-slide blank-card rule
- `events.yaml` — analytics + security event names
- `routes.yaml` — route / deep-link identifiers

## Authority

**KMP is authoritative.** Where consumers disagree on a path, field, or enum
value, these files encode the KMP value and the others move to match it (see
root plan §0). Every value in these files must trace back to a real constant
currently in `shared`/`data-firebase` source — this file does not invent new
values.

## Schema Compatibility Policy (mandatory — read before editing)

Web deploys in minutes. iOS and Android builds sit in users' hands for
**months** — this project cannot force-update. A change in this directory is
a distributed-systems change, not a refactor. Rules, enforced in review:

1. **Additive-only by default.** New fields and new collections are always
   safe to add in a single change.
2. **Renames are forbidden as a single step.** A rename is always three
   deploys:
   - *(a)* servers/clients dual-**read** old + new field/path,
   - *(b)* writers switch to writing new only,
   - *(c)* the old path is deleted only after the oldest supported app
     version is below the analytics floor.
3. **Deletions require a sunset date**, recorded as a comment next to the
   entry being removed, before the entry is actually deleted in a later
   change.
4. **Every contract file carries `schemaVersion`.** Clients log it; a client
   that sees a *major* version above its own should show an "update
   required" state rather than silently misreading data (wired in a later
   phase — Phase 8's kill-switch).
5. **Minimum supported app version** is itself a contract value (see
   `routes.yaml`'s `minimumSupportedAppVersion`), so a future remote
   kill-switch can enforce it.

A fallback chain in consumer code is legitimate **only** when it exists for
one of these version-compatibility reasons, and must carry a comment naming
the sunset condition. A fallback that exists because a path was never known
is a bug, not a policy — those were removed in Phase 0b.

## Generated-file LOC exemption

Generated files may exceed the project's 300-LOC limit (root `CLAUDE.md`
Quality Limits) — a generated artifact has exactly one responsibility (mirror
its contract source 1:1) and splitting it would break that mapping. Each
generated file's header states this exemption explicitly. There is currently
no mechanical LOC-enforcing lint/Detekt rule in this repo (verified against
`config/detekt/detekt.yml` and `lint/`/`detekt-rules/` — the 300-line limit is
presently a reviewed convention, not a build gate) — if one is added later, it
must exclude `**/generated/**` (repo-root `generated/`) and
`**/shared/contracts/**`, `web/src/generated/**`, `functions/src/generated/**`
(the per-consumer mirrors).
