# Initiative B — Phase 1 UI Quality Inventory and Standards

**Date:** 2026-08-07
**Branch:** `feature/OIR_Impr_01`
**Scope:** `shared` Compose Multiplatform UI and Android platform UI under `app/src`

## Baseline and safety

- Working tree was clean before Phase 1.
- Baseline commands passed:
  - `./gradlew :shared:testDebugUnitTest`
  - `./gradlew :lint:test`
- No credentials, tokens, user responses, or production data are included in this artifact.
- Phase 1 intentionally does not migrate feature screens. Existing findings are migration input, not permission for mechanical replacements.

## Inventory snapshot

The following counts were produced from the repository on the date above with `rg`:

| Finding | Search scope | Count | Interpretation |
|---|---|---:|---|
| `Color.` or `Color(...)` usage | `shared/src/commonMain/kotlin`, `shared/src/androidMain/kotlin` | 156 | Includes approved palette/theme definitions and feature-level values; classify before migration. |
| `contentDescription = null` | `shared/src/commonMain/kotlin`, `app/src` | 163 | May be correct for decorative icons; each touched control requires an intent review. |
| `IconButton` | `shared/src/commonMain/kotlin`, `app/src` | 56 | Audit label and state semantics. |
| `clickable` / `selectable` | `shared/src/commonMain/kotlin`, `app/src` | 16 | Audit accessible name, role, selected/disabled state, and target size. |

### Shared design-system primitives

- Theme entry point: `shared/.../ui/theme/Theme.kt` (`SSBMaxTheme`).
- Brand palette: `shared/.../ui/theme/SSBColors.kt`.
- Existing score-specific mapping: `shared/.../ui/theme/SSBScoreTheme.kt`.
- New semantic role mapping: `shared/.../ui/theme/SemanticColors.kt`.
- Theme role access: `MaterialTheme.semanticColors`.
- Android dynamic color remains an optional platform seam; iOS uses the shared fallback mapping.

## Semantic color contract

`SemanticColors` defines these required roles and paired foreground roles:

- `success` / `onSuccess`
- `error` / `onError`
- `warning` / `onWarning`
- `informational` / `onInformational`
- `selected` / `onSelected`
- `disabled` / `onDisabled`
- `skipped` / `onSkipped`
- `testProgress` / `onTestProgress`

Roles map only through the active `MaterialTheme.colorScheme`; feature code must not invent another success/error/status convention. Phase 2 owns contrast validation and screen migration. Until then, status must also be represented by text, icon, shape, or semantics—not hue alone.

## Accessibility standards

- **Decorative icon:** `contentDescription = null` only when adjacent visible content already conveys its meaning and the icon adds no interaction or state. It must not be given a redundant label.
- **Meaningful icon:** expose one localized accessible name. Icon-only actions must use a localized content description and an actual interactive role.
- **Buttons and custom clickable surfaces:** provide a name, a 48 dp minimum touch target, and disabled/selected state semantics where applicable.
- **Images:** describe meaningful information; mark decorative imagery silent.
- **Progress/loading:** expose progress or loading state through semantics and/or text; never color alone.
- **Errors:** expose an actionable, localized error and retry affordance where applicable.
- **Selection:** expose selected/unselected state independently of color.
- **Test answers:** label options safely (for example, option position/text as appropriate) without announcing the answer key, hidden correctness, or private response before submission. Do not put answer keys or response content in test-only descriptions.
- **Privacy:** content descriptions must never contain credentials, tokens, IDs, private interview responses, or hidden answers. Accessibility debugging must not log semantic text.

## Acceptance criteria

- Text and important icon contrast target WCAG 2.2 AA: 4.5:1 for normal text and 3:1 for large text/non-text UI indicators.
- Touch targets target at least 48 dp on Android and the equivalent platform accessibility size on iOS.
- Both light and dark theme role mappings resolve to non-`Color.Unspecified` values. This is executable in `SemanticUiStandardsTest`.
- Every migrated interactive control has a name and state semantics; decorative icons remain silent.
- Contrast and screenshot/semantics checks are required for migrated screens in Phase 2 and later.

## Exceptions and migration rules

- Existing brand palette values in `SSBColors` are approved source tokens, not feature-level exceptions.
- External provider/brand surfaces may retain required colors only when documented with the provider constraint and contrast review.
- Existing findings above are not suppressed or baselined by Phase 1. A migration may replace them only after classifying the icon/color and preserving intended behavior.
- No new dependency is required; the contract uses existing Material 3 and Compose semantics APIs.

## Evidence

- `SemanticColors` is provided inside `SSBMaxTheme` for Android and iOS through common code.
- `SemanticUiStandardsTest` verifies light/dark role resolution, icon-only naming, decorative silence, and non-color state semantics for loading/error/selected/disabled states.
- Security-sensitive answer semantics remain a required screen-level test obligation; no active test screen was changed in Phase 1.
