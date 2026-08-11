# CLAUDE.md — AI Agent Instructions for SSBMax

**Purpose:** Guidance for Claude, Cursor, and other LLM-based coding assistants working on this repository. Last updated: June 2026.

## What Is SSBMax

Kotlin Multiplatform (KMP) app for SSB (Services Selection Board) preparation — India's military officer selection process — shipping Android and iOS apps from a shared codebase. Candidates practice psychology tests (TAT, WAT, SRT, SD), GTO tasks (Group Discussion, Lecturette, GPE), and Interview simulation. Tech stack: Gemini AI for evaluation, Firebase for auth/storage, Room DB for caching, Jetpack Compose (100% — no XML layouts, both platforms render Compose Multiplatform UI from `shared`).

**Android/iOS SSOT is non-negotiable.** `shared` is the single source of truth for use cases, models, repository interfaces, and UI/ViewModel/navigation on both platforms — there must be no Android-only or iOS-only fork of business logic, screen state, or navigation behavior. Any divergence between the two platforms — intentional or accidental — must be surfaced to the user before it's introduced or left in place. Never silently patch one platform without checking whether the other needs the same fix.

**This is a four-consumer codebase (Android + iOS + Web + Functions), not two.** Per `docs/plans/CrossPlatform_SSOT` §2: Tier 1 (Firestore paths, enums, limits, tokens) is mechanically enforced via `contracts/` codegen — safe to ignore here. Tier 2 (scoring, AI evaluation, quota enforcement) lives once in `functions/`, both clients call it — but its *decision logic* is still hand-duplicated as an optimistic client-side pre-check in `shared` and `web/src/repositories`, and those two copies can silently drift from the server and from each other. Tier 3 (ViewModels, use-case flows, screen behavior) has **no shared code and no mechanical enforcement** between `shared` and `web/src/viewmodels` — convention only. So: whenever you change a use case or ViewModel under `shared/src/commonMain/.../domain/usecase/` or `.../presentation/`, or eligibility/scoring logic under `functions/src/`, explicitly check whether `web/src/viewmodels/` or `web/src/repositories/` needs the same fix, and say so even if it's outside the literal ask — don't rely on `web/CLAUDE.md` alone surfacing it, since it doesn't cross-reference `shared`. A non-blocking `.githooks/pre-commit` check flags this pattern in the staged diff as a backstop, not a substitute for this check.

## KMP Migration: Expect and Fix Debt

This codebase was recently converted from an Android-only app to KMP (Android + iOS). Bugs, broken wiring, and leftover single-platform code are **expected**, not exceptional. Treat encountering them as normal, not a detour from the task at hand.

**When you hit migration debt, fix it as part of the current task — don't just work around it:**
- **Broken wiring** (missing Koin bindings, an expect/actual with no actual on one platform, a screen wired on Android but not reachable on iOS or vice versa) → fix the wiring, don't route around it with a platform-specific hack.
- **Stale references to pre-migration modules** (`core/domain`, `core/data`, `app/ui`, `app/navigation`, Hilt) → these were absorbed into `shared`/`data-firebase` or deleted; if you find code, imports, or docs still pointing at them, that's drift to correct, not a valid alternate path to follow.
- **Platform forks of business logic** — if Android and iOS diverge on a use case, ViewModel, or nav route, that's an SSOT violation regardless of when it was introduced; surface it and fix toward one shared implementation.
- **Dangling/unused code from the old Android-only structure** (unused imports, orphaned files, dead Hilt modules) → delete it when you're already touching the area; don't leave it "for later" once you've noticed it.
- **Don't silently patch and move on.** When you fix migration debt, say what was broken and what you changed, even if it's outside the literal scope of the user's ask — this is exactly the kind of thing Rule 12 (Fail loud) exists for.
- **When the fix is large or ambiguous** (e.g., which platform's behavior is "correct" when they've diverged, or a fix would touch many files), stop and ask rather than guessing — per Rule 1.

## Your 12 Core Rules (Always follow)

1. **State assumptions explicitly** — if uncertain, ask rather than guess; present multiple interpretations when ambiguous
2. **Simplicity first** — minimum code solving the problem; no speculative features or premature abstractions
3. **Surgical changes** — touch only what you must; clean up only your own mess; match existing style
4. **Goal-driven execution** — define success criteria before coding; loop until verified
5. **Use LLM for judgment** — classification, drafting, summarization, extraction; NOT for routing, retries, deterministic transforms
6. **Token budgets are mandatory** — 4K per task, 30K per session; surface breaches, don't silently overrun
7. **Surface conflicts, don't average** — if two patterns contradict, pick one and explain why
8. **Read before you write** — understand exports, callers, shared utilities; "looks orthogonal" is dangerous
9. **Tests verify intent** — tests must encode WHY behavior matters, not just WHAT it does
10. **Checkpoint after every step** — summarize what was done, verified, and remains; if you lose track, stop and restate
11. **Match codebase conventions** — conform > taste inside the codebase; flag harmful conventions separately
12. **Fail loud** — surface uncertainty; never silently skip work or hide skipped tests

## Guiding Principles (MVVM + DRY + SOLID + SSOT)

**Single Source of Truth for every domain:**
- `SubscriptionLimits`/`CheckTestEligibilityUseCase` → subscription limits (only place to define/fetch; `core:data`'s `SubscriptionManager` was deleted in the KMP-convergence plan's Phase 9d)
- `SSBMaxDestinations` → navigation routes (only place for route definitions)
- `SSBPhase` → test type enum (only place to define test types)

Architecture: `Compose Screen → ViewModel (StateFlow<UiState>) → UseCase → Repository (interface in domain, impl in data) → Firebase/Room`

## Development Method (TDD-First)

**Before writing code:**
1. **Define success criteria** — what assertions pass? what fail?
2. **Plan test assertions WITH user** — no blind mocks; every assertion must encode WHY it matters (Rule 9)
3. **Write test first** — implementation follows; tests specify contract
4. **Phase ends with tech debt sweep** — phase complete only when task DONE + tech debt REMOVED (non-negotiable)

## Project Architecture

**Multi-module MVVM + Repository pattern:**

| Module | Purpose |
|---|---|
| `app` | Android platform glue only: `MainActivity`, `Application`, notifications, WorkManager workers, Koin bootstrap (`app/ui`/`app/navigation`/app-module ViewModels deleted in the KMP-convergence plan's Phase 6a — `shared` is the UI/ViewModel/nav SSOT on both platforms) |
| `shared` | KMP module: use cases, models, repository/service interfaces, Compose UI, Koin DI (ZERO Android-only dependencies in commonMain) — SSOT target of the KMP-convergence plan; `core:domain` was fully absorbed into it, and `core:data` was deleted into it in the plan's Phase 9f. **Carries no Firebase**: Move 2 of the iOS CocoaPods→SPM convergence extracted the GitLive-backed implementations to `:data-firebase`, which is what lets this module's Kotlin/Native test binaries link without CocoaPods |
| `data-firebase` | KMP module ABOVE `shared` (`api`-exports it): the ~57 GitLive/Firestore implementation files, `repositoryModule`, the `SharedKit` iOS framework, and the iOS entry points Swift calls (`ensureKoinStarted`, the BGTaskScheduler registrar, the APNs/deep-link bridges — the composition root must name `firebaseDataModule`, which `shared` sits below and cannot see). **Must never gain an `iosTest` source set** — that would pull GitLive's `-framework Firebase*` linker opts into a Kotlin/Native test executable and bring CocoaPods back |
| `lint` | Custom lint rules (build fails if violated) |
| `detekt-rules` | Custom Detekt rule set (`shared`'s commonMain-reaching equivalent of `:lint`'s Compose checks — AGP Lint doesn't analyze a KMP module's commonMain) |

**Key paths (SSOT):** Navigation: `shared/.../SSBMaxDestinations.kt` | Subscription limits: `shared/.../data/repository/SubscriptionDtos.kt` (`SubscriptionLimits`) + `shared/.../domain/usecase/subscription/CheckTestEligibilityUseCase.kt` | AI: `shared/.../ai/` | Tests enum: `shared/.../SSBPhase.kt` | Firebase repository impls + `repositoryModule`: `data-firebase/.../data/repository/`

**Koin composition:** `sharedModule` is deliberately an INCOMPLETE graph — it declares the repository interfaces but binds none of them. Every composition root loads `sharedModule` + `firebaseDataModule` together (`app`'s `KoinModules.kt`, iOS's `ensureKoinStarted()`). iOS additionally receives `CrashReporter`/`AnalyticsTracker` from Swift, which owns the Firebase SPM dependency (`FirebaseObservability.swift`).

**iOS dependency management: SPM only.** There is no CocoaPods integration and none should be reintroduced. A task-graph dry run confirmed framework linking needs zero pod tasks (`SharedKit` is static; Xcode resolves Firebase from SPM at final app link) — CocoaPods had existed solely to link Kotlin/Native *test* executables against GitLive's Firebase linker opts.

## Architecture Guidance Hierarchy (Phase 4)

**Multi-tier guidance system** (9 CLAUDE.md files) enforces patterns at every layer:

```
Root: claude.md (12 core rules, global patterns)
  ├── app/CLAUDE.md (Android platform glue only — UI/ViewModel/navigation
  │   │  moved to `shared` in the KMP-convergence plan's Phase 5/6a;
  │   │  core:data deleted into shared/app in Phase 9f)
  │   └── app/di/CLAUDE.md (Koin dependency injection, not Hilt)
  │
  ├── shared/ai/CLAUDE.md (Gemini AI integration — the only AI path,
  │      both platforms; core/data/ai was deleted in Phase 9.0)
  │
  ├── lint/CLAUDE.md (custom lint detectors)
  │
  ├── functions/CLAUDE.md (Cloud Functions backend)
  │
  └── scripts/CLAUDE.md (data ingestion, deterministic extraction)
```

**Quick Navigation:** See [CLAUDE_HIERARCHY.md](CLAUDE_HIERARCHY.md) for scenarios → right CLAUDE.md file lookup.

**Enforcement:**
- ✅ Lint: 16 custom detectors (Phase 2-4) catch violations at build time
- ✅ Pre-commit hook: Module-aware checks block commits on violations
- ✅ Code review: Pattern references guide PR feedback
- ✅ Documentation: GUIDELINES.md explains team processes

## Mandatory Lint Rules (enforced — build FAILS if violated)

1. **ErrorLogger, not printStackTrace** — `ErrorLogger.log(e, msg)` always; exception: `shared`'s domain layer uses `Result<T>`
2. **NO hardcoded strings** — all UI strings externalized: `app` via `stringResource(R.string.key)`, `shared` via `stringResource(Res.string.key)` (Compose Resources — no `R.string` equivalent in commonMain). Zero exceptions (not even domain layer)
3. **Thread-safe StateFlow updates** — `_uiState.update { it.copy(...) }`, never direct assignment
4. **Expose StateFlow, not MutableStateFlow** — ViewModels expose `StateFlow<UiState>` via `.asStateFlow()`
5. **No singleton mutable state** — never create `*Holder.kt` files
6. **No Firebase in UI layer** — use repositories; no direct Firebase calls in Compose/ViewModels
7. **ID-based navigation only** — pass string IDs between screens; result screens fetch data via their own ViewModel
8. **No Android deps in `shared`'s domain layer** — `shared/commonMain/.../domain` is 100% pure Kotlin — enables JVM/iOS testing, reusability
9. **No Firebase imports in app layer** — except Firebase Auth (Phase 4) — use repositories; no direct Firestore/Database calls
10. **Reusable Composables need @Preview** — required for visual validation. Enforced by `detekt-rules`' `MissingComposePreviewRule` (`MissingComposePreview`, package-scoped to `com.ssbmax.shared.ui.components*` since AGP Lint can't see `shared`'s commonMain), the replacement for the `core:designsystem`-only `ComponentMissingPreviewDetector` deleted in Phase 0f. Pre-existing violations are grandfathered in `shared/detekt-baseline.xml`; new components must add a `@Preview`

## Quality Limits

- **Max 300 lines per file** (split if exceeded)
- **Max 50 lines per Composable** (extract sub-components)
- No hardcoded colors/dimensions (use `MaterialTheme.*`, `dp`, `sp`)
- Dependencies injected via Koin (never manual construction) — Hilt was removed; `app`/`shared` both use `module { }`/`singleOf`/`viewModelOf`
- If ViewModel/Repository logic changes → update/add tests; `./gradlew check` must pass

## Content-Ingestion Principle (PDFs → Firestore)

**Keep LLM out of correctness path.** Vision-LLM extraction produces hallucinated data.

**Instead:**
1. Parse deterministically — extract questions, options, answer keys from text layer (use `pymupdf`, NOT LLM)
2. Map figures by geometry — position → question association; composite images onto canvas (no page renders)
3. **LLM only for enrichment** — tags, difficulty, subtype; NEVER for `questionText`, `correctAnswerId`, `explanation`
4. Gate writes with HTML preview before Firebase upload

Reference: `scripts/oir-extraction/` + `docs/architecture/OIR_Architecture.md`

## Security Principles (Gold Standard)

- **Never hardcode secrets** — all API keys from `local.properties` or Firebase Config
- **Firestore rules first** — Firebase security rules are SSOT for data access control
- **Input validation** — sanitize all user inputs; prevent injection/XSS
- **Encrypt PII** — user interview responses, assessment data encrypted at rest (if stored locally)
- **No secrets in logs** — ErrorLogger must strip API keys, auth tokens, user IDs
- **Dependencies audited** — run `./gradlew dependencyCheckAnalyze` monthly
- **Full details:** See `docs/security/SECURITY.md`

## Test Infrastructure & Build Commands

**Setup:** JUnit 4 + MockK + Turbine + kotlinx-coroutines-test. Compose tests use Koin's test module overrides (no Hilt). Timeout: 60 sec/test.

**Commands:**
```bash
./gradlew testDebugUnitTest    # All unit tests
./gradlew check                # Lint + tests
./gradlew :app:testDebugUnitTest  # App module
```
Full list: see `claude.local.md`.

**Tech Stack:** Kotlin 2.1.0, AGP 8.7.3, compileSdk 35, minSdk 26, JVM 21, Compose BOM 2024.05.00, Koin DI, Room 2.8.4, Firebase BOM 33.7.0, Gemini AI 0.9.0. Versions: `gradle/libs.versions.toml`.
