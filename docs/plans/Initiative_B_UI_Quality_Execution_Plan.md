# Initiative B — Codebase UI Quality Execution Plan

**Status:** Phase 7 automated gate complete; initiative-wide completion remains open pending manual Android/iOS release evidence.
**Parent work:** OIR improvements and `docs/plans/OIR_Difficulty_Removal_Execution_Plan.md`
**Scope:** Codebase-wide Compose accessibility, color/theme consistency, semantic UI quality, regression testing, and lint/Detekt enforcement across shared KMP UI and Android platform UI.
**Target branch:** `feature/OIR_Impr_01`
**Platforms:** Android and iOS through shared Compose Multiplatform UI; Android-only platform glue where applicable.

---

## 1. Initiative goals and boundaries

### 1.1 Goal

Make the UI consistently usable with screen readers, keyboard/switch-style navigation where supported, large text, light/dark themes, and accessible color contrast—without introducing platform-specific business/UI behavior forks.

The initiative also establishes a single semantic color system so screens use theme roles instead of arbitrary `Color.*`, RGB values, or feature-specific color conventions.

### 1.2 Accessibility contract

- Every interactive control has an understandable accessible name or visible text.
- Icon-only controls expose meaningful semantics.
- Decorative icons do not create redundant screen-reader announcements.
- Color is never the only signal for correctness, status, selection, error, or progress.
- Content descriptions do not expose secrets, tokens, private user data, or full sensitive responses.
- Touch targets meet the project’s supported platform accessibility guidance.
- Dynamic state changes are exposed through semantics where appropriate.
- Loading, error, empty, retry, success, disabled, and selected states are distinguishable without relying only on color.
- Reusable components provide correct semantics once so consuming screens do not duplicate or override them incorrectly.

### 1.3 Color/theme contract

- UI uses `MaterialTheme.colorScheme` or approved semantic design tokens.
- Hardcoded UI colors and raw hex/RGB values are prohibited unless an external brand/content specification requires them and the value is documented.
- Semantic roles include, at minimum:
  - success/correct
  - error/incorrect
  - warning/attention
  - informational
  - selected/active
  - disabled
  - skipped/neutral
  - test progress
- Light and dark themes must maintain readable contrast.
- Colors must not encode business logic in multiple screens; semantic mapping is centralized.

### 1.4 Scope boundaries

Included:

- `shared/src/commonMain` Compose UI and reusable components.
- `shared` Android/iOS UI tests and shared semantics.
- `app` Android Compose/platform UI that remains outside shared.
- Theme, color, typography, and reusable design-system code.
- Custom lint/Detekt rules and baselines related to accessibility/colors.

Excluded unless discovered as a blocking dependency:

- Business logic changes unrelated to UI semantics.
- Navigation or repository redesign.
- Backend/Firebase behavior.
- Product redesign or new visual branding.
- Accessibility claims for third-party screens/components that cannot be controlled; these must be documented as external limitations.

---

## 2. Strict rules for every phase

### 2.1 Phase independence and build gates

- Work on one phase at a time.
- Every phase must end with a successful relevant build and all relevant tests passing.
- Do not proceed with failing tests, unexplained diagnostics, broken previews, or unresolved tech debt.
- Pre-existing failures must be recorded separately and changed-scope behavior must still be verified.
- A timeout is not a passing result.

### 2.2 TDD

For every behavior change:

1. Add or update a failing test or static rule describing the desired behavior.
2. Implement the smallest correct change.
3. Refactor while preserving behavior.
4. Run focused tests.
5. Run the complete phase test suite.
6. Run the phase build/check gate.

Tests must cover both positive and negative paths, including invalid semantics, missing labels, theme variants, and security-sensitive content.

### 2.3 Architecture and clean code

- Preserve `Compose Screen → ViewModel → UseCase → Repository` boundaries.
- Keep UI semantics in reusable UI components where possible.
- Keep Android/iOS behavior in shared code unless a genuine platform API requires an actual/expect boundary.
- Follow MVVM, SOLID, DRY, and SSOT.
- No mutable singleton UI state.
- No Firebase calls from UI/ViewModels.
- No file may exceed 300 lines of code.
- Do not hide code-quality problems by expanding suppressions or baselines.
- Any new suppression requires a written reason and a removal/follow-up condition.

### 2.4 Resources and localization

- No new hardcoded user-facing strings.
- Content descriptions use localized string resources where they are user-facing.
- Do not construct accessibility text from untrusted raw content without sanitization or length limits.
- Do not use resource names that leak private data or implementation details.
- Existing hardcoded strings discovered in touched screens must be moved to the correct shared/app resource system rather than copied into new code.

### 2.5 Security and privacy

- Semantics must not expose access tokens, API keys, user IDs, private interview responses, answer keys, or hidden correct answers on active test screens.
- Accessibility labels for answer options must describe the option safely; they must not announce the correct answer before submission.
- Do not log semantic text or user content solely for accessibility debugging in production.
- Keep authentication, subscription, ownership, and navigation security unchanged.
- Run repository security/pre-commit checks for every phase.

### 2.6 Required phase handoff

At the end of every phase, stop and provide:

1. Changes completed.
2. Tests added and executed.
3. Build/check commands and results.
4. Tech debt incurred.
5. Exact steps used to resolve that debt immediately.
6. Remaining risks or blockers.
7. Confirmation that the phase gate passed.

No next phase begins until the handoff is accepted and the gate is green.

---

## 3. Baseline and inventory

Before Phase 1:

- Confirm branch and working-tree safety.
- Record current diagnostics and build/check results.
- Inventory all hardcoded colors and raw RGB/hex values in UI code.
- Inventory all `contentDescription = null`, empty labels, icon-only controls, and custom clickable surfaces.
- Inventory existing theme/color tokens, lint rules, Detekt rules, and baselines.
- Identify shared reusable components before feature-by-feature edits.
- Identify screens that display sensitive test content and require special semantics review.
- Record baseline test count and known failures.

Suggested inventory commands:

```bash
git --no-optional-locks status --short --branch
./gradlew check
./gradlew :shared:testDebugUnitTest
./gradlew :lint:test
```

Search targets include:

```text
Color.
Color(...)
0x...
contentDescription = null
IconButton(
clickable(
selectable(
semantics(
clearAndSetSemantics
```

The inventory is an artifact for planning. It is not permission to replace every null description mechanically: decorative icons are valid when their meaning is already conveyed by adjacent text.

### Final initiative success criteria

- All changed UI files pass diagnostics and quality checks.
- No new hardcoded UI colors or strings are introduced.
- Approved semantic color roles are used consistently across migrated UI.
- Interactive controls have correct labels and state semantics.
- Decorative icons remain silent and meaningful icons are announced once.
- Active test screens do not expose answers, credentials, or private content through semantics.
- Light and dark theme contrast checks pass for migrated screens.
- Shared UI behavior remains consistent on Android and iOS.
- Lint/Detekt prevents regression without unjustified baseline growth.
- All phase builds and tests pass.
- All tech debt incurred during migration is resolved before final handoff.

---

# Phase 1 — UI quality inventory and semantic standards

**Goal:** Establish the baseline, define the semantic color/accessibility contract, and prevent ambiguous migration decisions.

## Scope

- Produce the color and accessibility inventory.
- Identify shared design-system primitives and feature-specific exceptions.
- Define semantic color roles and their Material theme mappings.
- Define rules for decorative versus meaningful icons.
- Define minimum semantic requirements for buttons, icon buttons, images, progress, selection, errors, and test answers.
- Define contrast and touch-target acceptance criteria for supported platforms.
- Confirm whether existing theme definitions can support the roles without introducing a new dependency.

## TDD/static tests first

Add or update standards tests/rules for:

- Semantic color roles resolve for light and dark themes.
- Required color roles are present and non-null.
- A decorative icon does not create an extra announcement.
- An icon-only action has an accessible label.
- Test answer semantics do not expose the correct answer before submission.
- Loading/error/selected/disabled states expose state information without color-only reliance.

## Implementation

1. Create an inventory artifact under `docs/` or the relevant plan evidence location.
2. Define semantic color tokens in the existing theme/design-system location.
3. Document exceptions and acceptance criteria.
4. Add test helpers for semantics and theme rendering.
5. Do not migrate large screen groups in this phase.

## Security checks

- Review all planned content descriptions for PII/secret exposure.
- Confirm test-answer semantics do not reveal answer keys.
- Ensure inventory files do not contain production credentials or private user content.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :lint:test
./gradlew check
```

No feature migration begins if the standards are ambiguous or the baseline is not recorded.

---

# Phase 2 — Semantic color system and theme validation

**Goal:** Establish the universal color foundation before migrating screens.

## Scope

- Implement approved semantic color roles using Material theme values.
- Support light and dark themes.
- Replace hardcoded colors in shared reusable components first.
- Add contrast-focused tests for text, icons, indicators, cards, buttons, and status surfaces.
- Preserve existing branding where it meets contrast and theme requirements.

## TDD tests first

Add/update tests for:

- Every semantic role maps to a usable color in light theme.
- Every semantic role maps to a usable color in dark theme.
- Primary/secondary/error/success/warning text meets the defined contrast threshold.
- Disabled controls remain distinguishable from enabled controls.
- Correct/incorrect/skipped states remain distinguishable without relying only on hue.
- No raw hardcoded color is introduced in migrated components.

## Implementation

1. Add semantic theme tokens with platform-neutral shared definitions.
2. Migrate shared buttons, chips, cards, indicators, status surfaces, and common icons.
3. Replace direct `Color.*`, RGB, and hex usage in touched reusable components.
4. Add previews or screenshot fixtures for light/dark variants where the project supports them.
5. Keep files below 300 lines; split component files when needed.

## Security checks

- Do not place secret/environment values in colors or preview fixtures.
- Ensure debug-only visual indicators cannot display auth state or user identifiers in release UI.
- Run secret scanning and pre-commit checks.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:compileDebugKotlinAndroid
./gradlew :lint:test
./gradlew check
```

**Phase 2 completion evidence (August 2026):**

- Semantic roles now resolve through the active Material `ColorScheme`, with light/dark-aware foreground mappings for success, error, warning, informational, selected, disabled, skipped, and test-progress states.
- `ColorContrast.kt` provides a platform-neutral WCAG contrast calculation; `SemanticUiStandardsTest` verifies all role pairs at the 4.5:1 AA threshold in both themes and verifies state surfaces remain distinguishable.
- Shared analytics difficulty chips, recommendation banners, score colors, and study category cards no longer carry raw feature colors; they consume semantic theme roles. Study category state is now visualized in the composable layer rather than stored in ViewModel UI data.
- Validation completed: `:shared:testDebugUnitTest --tests com.ssbmax.shared.ui.theme.SemanticUiStandardsTest`, `:shared:testDebugUnitTest`, `:shared:compileDebugKotlinAndroid`, `:lint:test`, and `check`.
- Known pre-existing warnings remain in Android Google Sign-In/TTS APIs and unrelated coroutine test opt-ins; no new warnings were introduced by Phase 2.

---

# Phase 3 — Shared accessibility primitives

**Goal:** Fix reusable components once and propagate correct semantics to all consumers.

## Scope

Migrate and test shared primitives such as:

- Icon-only buttons.
- Navigation buttons.
- Retry/refresh controls.
- Buttons with icons and text.
- Cards with clickable behavior.
- Progress indicators.
- Empty/error/loading states.
- Selectable answer options.
- Images and image-loading fallbacks.
- Tabs, chips, toggles, and expandable rows.

## TDD/UI tests first

Add/update tests for:

- Each icon-only component exposes a localized accessible name.
- Text-plus-icon controls announce one meaningful label, not duplicate text.
- Decorative icons are not independently announced.
- Disabled controls expose disabled state.
- Selected controls expose selected state.
- Progress exposes current/maximum progress where meaningful.
- Retry controls are discoverable and invoke the intended callback.
- Clickable cards expose one action rather than nested conflicting actions.
- Image failures expose a useful fallback label without leaking URLs or internal errors.

## Implementation

1. Add semantics to reusable components.
2. Remove redundant child semantics with `clearAndSetSemantics` only when justified.
3. Localize labels through shared Compose resources.
4. Ensure semantics do not expose hidden/correct answers.
5. Add previews for reusable visual components where required by Detekt rules.
6. Refactor long components before crossing the 300-line limit.

## Security checks

- Answer-option semantics announce only option text/position while the test is active.
- Correctness/explanation semantics appear only after submission/review state permits them.
- No raw Firebase errors, IDs, or URLs are exposed through content descriptions.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:compileDebugKotlinAndroid
./gradlew :lint:test
./gradlew check
```

**Phase 3 completion evidence (August 2026):**

- Shared drawer menu items and sub-menu items now expose button roles; selected menu items expose selected state.
- Expandable drawer sections and the recommendation banner expose localized expanded/collapsed state on one parent action; decorative chevrons are silent so they are not announced as duplicate controls.
- Role-selection cards expose selected state, and analytics progression indicators expose a 0–100 progress range for screen readers.
- `AccessibilityPrimitivesUiTest` covers selected actions, expandable state/action behavior, duplicate-chevron prevention, and retry callback behavior. No answer text, URLs, IDs, backend errors, or private content is added to semantics.
- Validation passed: focused accessibility UI test compilation, `:shared:testDebugUnitTest`, `:shared:compileDebugKotlinAndroid`, `:lint:test`, and `check`. Existing Android API, unresolved opt-in, lint-baseline, and coroutine-test warnings remain pre-existing and unrelated.
- Tech-debt sweep completed: no new suppressions, hardcoded resources, files over 300 lines, diagnostics, or generated artifacts were introduced.

**Phase 3 deep-check:** The Phase 3 goal is met for the shared primitives in scope: reusable interactive components now provide one actionable semantic node, localized labels/state, selected/disabled-compatible state behavior, progress range semantics, decorative-icon silence, and retry action coverage. The broader initiative is not complete: feature-screen migration (Phase 4), Android-only UI (Phase 5), enforcement hardening (Phase 6), and cross-platform release validation (Phase 7) remain planned work.

---

# Phase 4 — Shared feature-screen migration

**Goal:** Apply the primitives across shared student/instructor screens without platform divergence.

## Scope

Migrate shared Compose screens in verticals, prioritizing:

1. Home and dashboard.
2. OIR and other test-taking screens.
3. Result and answer-review screens.
4. PPDT/TAT/WAT/SRT/SD.
5. GTO and Interview.
6. Profile, settings, authentication, and common error flows.

For each screen, verify:

- Heading hierarchy.
- Focus/order behavior.
- Icon-only controls.
- State announcements.
- Color semantics.
- Empty/loading/error/retry states.
- Sensitive-content boundaries.

## TDD/UI tests first

Add/update tests for each migrated vertical:

- Critical controls are discoverable by semantics.
- Primary action invokes the correct ViewModel event.
- Error and retry state is visible and actionable.
- Loading state does not expose stale or interactive content.
- Selected/disabled/completed states are semantically distinct.
- OIR active screen does not expose answer keys.
- Result/review screen exposes answer correctness only where intended.
- Navigation controls continue to pass IDs only.

## Implementation

1. Migrate one vertical at a time.
2. Reuse shared primitives rather than adding screen-local fixes.
3. Replace hardcoded colors and strings encountered in touched files.
4. Avoid unrelated business-logic changes.
5. Keep Android and iOS on the same shared implementation.

## Security checks

- Confirm sensitive interview/test content is not announced in unintended parent semantics.
- Confirm analytics/logging does not capture accessibility text containing private responses.
- Confirm auth/subscription errors remain generic and do not disclose backend details.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:iosSimulatorArm64Test
./gradlew :shared:compileDebugKotlinAndroid
./gradlew check
```

---

## Phase 4 execution evidence and deep check (August 2026)

Completed in this checkpoint:

- Home/student dashboard status colors now use active Material theme roles; instructor dashboard stat cards use semantic theme roles and no longer create a false clickable action when no callback exists.
- OIR active-test option cards expose radio/checkbox selection semantics and localized selected/correct/incorrect state descriptions. Active questions expose neither explanations nor correctness announcements before submission.
- OIR regression tests cover answer-key privacy and selected-option semantics; existing Home/dashboard UI tests remain green.
- No new hardcoded colors were introduced in changed UI files, no changed file exceeds 300 lines, diagnostics are clean, and the full `check` gate passed.

Deep check result: the Phase 4 goal is **not fully complete**. The listed verticals PPDT/TAT/WAT/SRT/SD, GTO, Interview, result/review, profile/settings/auth, and common error flows still require explicit screen-by-screen semantic and sensitive-content review. Phase 5–7 and the final initiative checklist therefore remain open. This is recorded as an execution checkpoint, not a false completion claim.

Tech-debt sweep for this checkpoint: resolved the new Detekt complexity violation by extracting OIR semantic-state mapping; removed raw feature colors from all changed dashboard files; fixed the test-fixture compatibility issue by avoiding an unprovided composition local in reusable Home components. No new suppressions, baselines, generated artifacts, or unresolved diagnostics remain. Pre-existing API deprecation/opt-in and baseline lint warnings remain outside this changed scope.

Additional Phase 4 migration checkpoint:

- PPDT, TAT, WAT, SRT, and SD active phases now expose localized timer and progress semantics through `ProgressBarRangeInfo`; WAT/SRT regression tests verify dynamic timer announcements. PPDT timers are non-clickable semantic surfaces rather than false action controls.
- GTO GD, GPE, and Lecturette active-phase close actions now have localized accessible names. Interview session progress exposes a localized percentage and range semantics; TTS mute state uses the theme error role rather than a raw red color.
- Shared test error state now uses a polite live region so loading/error/retry flows announce state changes without exposing backend details.
- Focused psychology-test compilation/tests and shared Android compilation passed. PPDT, TAT, WAT, SRT, SD, GTO, Interview, profile/settings/auth, common error, and result/review implementation sweeps are now complete for the shared UI scope. Dedicated PPDT/SD screen UI tests and broader result/profile screen-reader evidence remain required before the initiative can be marked fully complete.
- A shared `AccessibilitySemantics.kt` helper now centralizes timer, progress-range, and loading/live-region mechanics while screens retain localized, domain-specific descriptions.
- Final validation after the balance-screen sweep: `./gradlew check` passed; project diagnostics and `git diff --check` are clean. Existing Android API deprecation, coroutine opt-in, and lint-baseline warnings remain pre-existing.
- Step 6 static sweep completed: grading priority and notification status/delete colors now use Material theme roles. Remaining raw colors are classified exceptions: Google branding, premium plan content-provided gradients/foreground contrast, and decorative white-noise rendering. Remaining null icon descriptions are decorative or accompanied by visible/actionable text; no unlabelled icon-only action remains in the audited scope.

---

# Phase 5 — Android platform and remaining UI migration

**Goal:** Bring Android-only UI and platform screens to the same semantic/color standard without creating an Android/iOS behavior fork.

## Scope

- Audit and migrate remaining `app` Compose/platform UI.
- Align Android theme mappings with shared semantic roles.
- Correct Android-only dialogs, notification/settings screens, platform permission explanations, and fallback screens.
- Verify platform-specific wrappers preserve shared semantics.
- Remove obsolete local color/string helpers only after all callers migrate.

## TDD/UI tests first

Add/update tests for:

- Android-only controls have labels and state semantics.
- Shared and Android entry points expose equivalent behavior.
- Theme roles resolve consistently between app and shared UI.
- Permission/auth error dialogs do not expose sensitive implementation details.
- Back/home/retry actions remain reachable and correctly labeled.

## Implementation

1. Migrate reusable Android components before individual screens.
2. Replace hardcoded colors with shared or app theme roles.
3. Move user-facing strings into the correct resource system.
4. Remove dead helpers and stale imports immediately.
5. Keep platform-specific code limited to platform APIs and composition glue.

## Security checks

- Verify no Firebase credentials, user IDs, or tokens appear in semantics or error text.
- Run app-layer Firebase import/security checks.
- Confirm release builds do not expose debug-only accessibility overlays.

## Phase gate

```bash
./gradlew :app:testDebugUnitTest
./gradlew :shared:testDebugUnitTest
./gradlew :app:assembleDebug
./gradlew check
```

---

# Phase 6 — Enforcement and regression prevention

**Goal:** Make accessibility and color quality enforceable so the codebase does not regress after this initiative.

## Scope

- Add or strengthen custom lint/Detekt rules for:
  - hardcoded Compose colors
  - raw RGB/hex UI colors
  - missing labels on icon-only controls where statically detectable
  - new hardcoded user-facing strings
  - missing previews for reusable components where required
- Review and reduce existing baselines rather than expanding them without reason.
- Add CI/pre-commit checks for changed UI files.
- Document legitimate exceptions and suppression format.

## TDD/static tests first

Add rule tests proving:

- A new hardcoded color fails.
- A new raw hex/RGB UI color fails.
- A valid Material theme/semantic token passes.
- A labeled icon-only control passes.
- An unlabeled icon-only control fails where detection is reliable.
- Decorative icons with explicit justification pass.
- Existing legacy violations are tracked separately and do not silently grow.

## Implementation

1. Implement rule tests first.
2. Implement detectors with minimal false positives.
3. Migrate or suppress existing violations only with documented reasons.
4. Update pre-commit and CI commands.
5. Add contributor documentation with examples.
6. Keep detector files under 300 lines by splitting rules/helpers.

## Security checks

- Ensure detectors do not print source content containing secrets in reports.
- Confirm generated reports are not committed if they contain private data.
- Run dependency and secret audits.

## Phase gate

```bash
./gradlew :lint:test
./gradlew :detekt-rules:test
./gradlew check
```

No final phase begins while the enforcement rules are flaky or produce unexplained false positives.

## Phase 6 execution evidence and deep check (August 2026)

Completed:

- Added `HardcodedComposeColorRule` for raw hex/RGB literals in shared UI, with the centralized `shared.ui.theme` token package as the only built-in exception. Existing `HardcodedComposeTextRule` and `MissingComposePreviewRule` remain active.
- Added `IconOnlyControlLabelRule` for statically detectable `IconButton` content; localized named and positional descriptions pass, while missing/null descriptions fail. Decorative icons outside interactive controls remain valid and silent.
- Added positive and negative rule tests for raw colors, semantic/theme colors, labeled icon actions, unlabeled actions, and preview-compatible enforcement. No baseline entries or suppressions were added.
- Added staged-change enforcement to `.githooks/pre-commit`; the maintained `scripts/git-hooks/pre-commit` also runs lint, rule tests, and shared Detekt. Contributor documentation now records the exception and suppression format. CI already runs `:lint:test` and `:detekt-rules:test` as part of its unit-test job.

Validation passed:

- `./gradlew :detekt-rules:test`
- `./gradlew :shared:detekt`
- `./gradlew :lint:test :detekt-rules:test check`
- `git diff --check` and project diagnostics

Phase 6 deep check: the Phase 6 goal is **complete**. The requested enforcement categories are covered as follows: hardcoded Compose text and reusable previews were already enforced by Detekt; raw hex/RGB colors and statically detectable unlabeled icon-only controls are now enforced by Detekt; valid semantic/theme usage and invalid usage have regression tests; existing violations remain separately baselined and no baseline growth occurred; pre-commit and CI paths run the enforcement checks; and legitimate exceptions/suppression requirements are documented. The rules are green and produced no unexplained findings.

Tech-debt sweep: resolved the failed first-pass icon-label regression test by tightening positional-label detection, verified the hook syntax/path variants, removed stale `gradle.sh` commands from the touched lint documentation, and confirmed no new suppressions, baselines, generated artifacts, diagnostics, or files over 300 lines. No Phase 6 tech debt remains. Pre-existing repository baseline entries and documented API/opt-in warnings are outside this phase and were not expanded.

The overall Initiative B goal is still **not fully complete**: Phase 7 manual screen-reader, large-text, light/dark theme, contrast, and Android/iOS interaction evidence remains explicitly required.

---

## Phase 5 execution evidence and deep check (August 2026)

Completed:

- Confirmed `app` contains Android platform glue rather than a second Compose screen/navigation graph; `MainActivity` remains the only Android UI host and provides the shared notification-permission and Google Sign-In bridges to `SSBMaxRoot`.
- Android local notifications now use localized resources for channel descriptions, GTO result copy, fallback titles, and action labels. Psychology and GTO notification builders were split into focused helpers; all changed production Kotlin files are below 300 lines.
- FCM diagnostics no longer log payload maps, sender values, notification titles/bodies, or session/submission identifiers. User-facing fallback and channel text is resource-backed; deep-link forwarding remains ID-based and unchanged.
- Added `AndroidPlatformUiQualityContractTest` covering shared-root/provider wiring, launcher registration ordering, resource-backed platform copy, and notification privacy contracts.
- Tech-debt sweep: removed hardcoded Android notification copy, stale GTO code from the main helper, sensitive payload/identifier logging, overlong touched-file violations, and unused imports/constants. No new suppressions, baselines, generated artifacts, or unresolved diagnostics remain. Existing lint-baseline/API/opt-in warnings remain pre-existing and outside this phase's changed scope.

Validation passed:

- `./gradlew :app:testDebugUnitTest --tests com.ssbmax.architecture.AndroidPlatformUiQualityContractTest`
- `./gradlew :app:testDebugUnitTest :shared:testDebugUnitTest :app:assembleDebug check`
- `git diff --check` and project diagnostics

Phase 5 deep check: the Phase 5 goal is **complete for the Android platform scope**. The app has no separate Android Compose UI to migrate, and its platform wrappers preserve the shared UI entry point and ID-based deep-link behavior. The overall Initiative B goal is **not yet complete**: Phase 6 enforcement work is still open, and Phase 7 manual Android/iOS screen-reader, large-text, theme, contrast, and cross-platform smoke-test evidence is explicitly still required. The final handoff checklist must remain unchecked for those items; this phase is not a release-completion claim.

---

# Phase 7 — Cross-platform validation and release handoff

**Goal:** Verify the complete UI quality initiative on supported platforms and finalize documentation.

**Automated Phase 7 completion evidence (August 2026):**

- The complete automated release gate passed: `:shared:testDebugUnitTest`, `:shared:iosSimulatorArm64Test`, `:app:testDebugUnitTest`, `:lint:test`, `:detekt-rules:test`, `check`, and `:app:assembleDebug`.
- The debug APK assembled successfully. The Android packaging step reported only the existing non-fatal native-library strip notice for `libandroidx.graphics.path.so`.
- Diagnostics, pre-commit security checks, and the Phase 4 static sweep are clean. Existing API deprecation, coroutine opt-in, and lint-baseline warnings remain documented pre-existing warnings.
- Manual screen-reader, large-text, light/dark theme, and cross-platform interaction smoke tests remain an explicit release-handoff task requiring Android/iOS device or simulator interaction; they are not claimed as completed by automated CI output.

## Phase 7 execution evidence and deep check (August 2026)

Completed:

- Re-ran the complete automated release gate from the Phase 6 HEAD: `./gradlew :shared:testDebugUnitTest :shared:iosSimulatorArm64Test :app:testDebugUnitTest :lint:test :detekt-rules:test check :app:assembleDebug` — **BUILD SUCCESSFUL** (316 actionable tasks; 14 executed, 1 cached, 301 up-to-date).
- Project diagnostics reported no errors or warnings, and `git diff --check` passed.
- The shared JVM accessibility contracts cover semantic color resolution in light/dark themes, WCAG AA foreground contrast, state semantics, icon-only labels, decorative-icon silence, selected/retry/progress/timer semantics, and active-answer safety. The enforcement tests cover hardcoded colors and unlabeled icon-only controls.
- Available iOS simulator inventory was checked with `xcrun simctl list devices available`; simulators are installed but shutdown. `adb devices` reported no Android emulator/device. No manual screen-reader, large-text, theme-toggle, or interaction smoke test is claimed because no runnable Android/iOS app session was available.

Deep check against the Phase 7 goal: the automated cross-platform/build/enforcement aspects are complete and green. The overall Initiative B goal is **not fully complete** because the plan explicitly requires manual Android and iOS evidence for screen readers, large text, light/dark interaction, contrast/readability, and representative active/error/retry journeys. Those items remain unchecked in the final checklist; completing them requires a device or simulator session with the app launched.

Tech-debt sweep:

- No Phase 7 tech debt was incurred. No new suppressions or baseline entries were added; no diagnostics, security findings, raw UI colors, oversized changed code files, generated artifacts, or unexplained enforcement findings remain.
- Existing TODOs and decorative `contentDescription = null` usages were reviewed. They are pre-existing product placeholders or intentionally decorative icons, and removing them mechanically would either exceed Phase 7 scope or introduce redundant announcements. They are not Phase 7 debt.
- The plan remains intentionally honest about the manual release blocker rather than marking unsupported evidence complete.

## Scope

- Run shared JVM and iOS simulator tests.
- Run Android unit, lint, Detekt, and debug build gates.
- Execute accessibility checks on representative screens.
- Validate light/dark themes and contrast.
- Validate large text/layout behavior where tooling supports it.
- Perform screen-reader smoke tests on Android and iOS.
- Update architecture/development documentation.
- Record remaining third-party/platform limitations separately.

## Cross-phase validation matrix

| Area | Required evidence |
|---|---|
| Colors | No new hardcoded UI colors; semantic roles used consistently |
| Contrast | Text/status/action combinations pass defined contrast checks |
| Labels | Icon-only and semantic controls are labeled |
| Decorative content | Decorative icons/images do not create duplicate announcements |
| State | Loading, error, retry, selected, disabled, success, and empty states are distinguishable |
| Test safety | Active test does not expose correct answers through semantics |
| Navigation | Back/home/retry/review actions remain reachable and ID-based |
| KMP | Android/iOS shared behavior remains equivalent |
| Resources | Strings/content descriptions are localized |
| Enforcement | Lint/Detekt/pre-commit checks prevent regression |
| Architecture | MVVM, SSOT, file-size, and dependency rules remain intact |
| Security | No credentials, tokens, private answers, or PII leak through UI/logs |

## Manual validation

For representative screens:

1. Navigate using screen reader controls only.
2. Confirm every interactive element has one understandable announcement.
3. Confirm decorative icons are not redundantly announced.
4. Toggle light/dark themes and verify contrast/readability.
5. Increase system font size and verify no critical clipping.
6. Test active and submitted OIR states to ensure correct answers are not exposed prematurely.
7. Test network error/retry states without exposing raw backend errors.
8. Verify Android and iOS behavior from the same shared implementation.

## Phase gate

```bash
./gradlew :shared:testDebugUnitTest
./gradlew :shared:iosSimulatorArm64Test
./gradlew :app:testDebugUnitTest
./gradlew :lint:test
./gradlew :detekt-rules:test
./gradlew check
./gradlew :app:assembleDebug
```

The initiative cannot be marked complete until all changed-scope tests and builds pass and manual accessibility/theme evidence is recorded.

---

## 4. Final handoff checklist

- [ ] Baseline inventory recorded.
- [ ] Semantic color contract documented.
- [ ] Shared theme roles implemented and tested.
- [ ] Shared accessibility primitives migrated.
- [ ] Shared feature screens migrated.
- [ ] Android-only UI migrated where applicable.
- [x] No new hardcoded strings/colors introduced.
- [x] No unjustified baseline growth.
- [x] Lint/Detekt/pre-commit enforcement enabled.
- [ ] Light/dark contrast validation passed.
- [ ] Screen-reader smoke tests completed on Android and iOS.
- [ ] Active test semantics do not reveal answers or private content.
- [ ] No credentials, tokens, or PII exposed through UI/logs.
- [x] No changed code file exceeds 300 lines.
- [ ] All phase handoffs completed.
- [x] All targeted tests pass.
- [x] Full build/check gates pass.
- [x] All tech debt incurred during the initiative is resolved.
- [x] Architecture and contributor documentation updated.
- [ ] Final commit created only after the release gate is green.
