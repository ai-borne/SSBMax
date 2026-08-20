# CLAUDE_HIERARCHY.md — Architecture Guidance Navigation

**Quick reference:** Find the CLAUDE.md file relevant to your work.

---

## 📋 Full Module Hierarchy

```
SSBMax Project (Root)
│
├── 🌱 Root: [claude.md](claude.md)
│   └── Purpose: 12 core rules, architecture overview, global patterns
│
├── 📦 App Module: [app/CLAUDE.md](app/CLAUDE.md) — Android platform glue only
│   │   (MainActivity, Application, notifications, WorkManager workers) since
│   │   KMP-convergence Phase 5/6a moved all UI/ViewModel/navigation into
│   │   `shared`; `app/ui`, `app/navigation`, and their CLAUDE.md files no
│   │   longer exist
│   └── Sub-Module:
│       └── [app/di/CLAUDE.md](app/di/CLAUDE.md) — Koin dependency injection (not Hilt)
│
├── 🧬 Shared Module (KMP): no CLAUDE.md yet — SSOT for UI, ViewModels,
│   navigation, data, and DI on both Android and iOS (KMP-convergence plan).
│   `core:domain`'s use-case/repository-interface/Result<T>/zero-Android-deps
│   patterns now live in `shared/commonMain/.../domain`, `shared`'s UI
│   (`.../ui`) is the convergence target `core:designsystem` used to cover
│   before its deletion, and `shared`'s `GitLive*` repositories are the
│   convergence target `core:data` used to cover before its Phase 9f deletion
│   (one Android-only piece — a Room cache for two WorkManager workers —
│   landed in `app` instead; see [app/CLAUDE.md](app/CLAUDE.md))
│
├── 🛠 Lint Module: [lint/CLAUDE.md](lint/CLAUDE.md)
│   ├── Custom Detector Development
│   ├── Phase 2-4 Security Detectors (14 total)
│   ├── Testing Detectors
│   └── Build Integration
│
├── ☁️ Firebase Functions: [functions/CLAUDE.md](functions/CLAUDE.md)
│   ├── Cloud Function Patterns
│   ├── Security-First Approach
│   ├── Gemini Backend Integration
│   ├── Firestore Transactions
│   └── Rate Limiting
│
└── 📄 Scripts/Data Layer: [scripts/CLAUDE.md](scripts/CLAUDE.md)
    ├── Deterministic Data Extraction (No LLM for correctness)
    ├── Batch Operations (500-doc limits)
    ├── Error Recovery
    └── Data Quality Validation

```

---

## 🎯 Quick Lookup by Scenario

### "I'm building a new feature screen"
**Start here:** `shared/src/commonMain/kotlin/com/ssbmax/shared/` — `ui/` (screens),
`presentation/` (ViewModels), `navigation/` (routes). This is the only place
new screens go post-convergence; there is no `app/ui` anymore.
- Feature state definition (sealed class UiState)
- ViewModel + repository injection pattern (Koin `viewModelOf`)
- StateFlow<UiState> management via `viewModelScope`
- UI composable decomposition
- Then read: [app/CLAUDE.md](app/CLAUDE.md) for what (little) still lives in `app`

### "I'm implementing a new use case"
**Start here:** `shared/src/commonMain/kotlin/com/ssbmax/shared/domain/usecase/` — no
dedicated CLAUDE.md yet (`core:domain`, which used to cover this, was fully absorbed
into `shared` and deleted)
- Use case structure (suspend function → Result<T>)
- Repository interfaces (SSOT)
- Error handling patterns
- Then read: root [claude.md](claude.md)'s "Guiding Principles" section (repository impl pattern)

### "I'm storing data (database or cache)"
**Start here:** `shared/src/commonMain/.../data/repository/` (`GitLive*` repositories —
GitLive-Firebase for Firestore, SQLDelight for local caches) — no dedicated CLAUDE.md yet
(`core:data`, which used to cover this, was deleted in the KMP-convergence plan's Phase 9f;
its one Android-only survivor, a Room cache for two WorkManager workers, is documented in
[app/CLAUDE.md](app/CLAUDE.md) instead)
- Entity/DTO design & SQLDelight migrations
- Repository query patterns
- Caching with TTL
- Firebase security rules (`firestore.rules` at repo root; validated by
  `app/src/test/kotlin/com/ssbmax/security/FirebaseRulesValidationTest.kt`)
- Batch operations

### "I'm integrating AI (Gemini evaluation)"
**Start here:** [shared/ai/CLAUDE.md](shared/ai/CLAUDE.md)
- KtorAIService / KtorGeminiClient setup (Koin property for the API key)
- Structured prompt engineering
- Response parsing & validation
- Token tiers and determinism
- Error handling
- Testing with mocks
- Then read: [functions/CLAUDE.md](functions/CLAUDE.md) (backend scoring)

### "I'm building a reusable component"
**Start here:** `shared/src/commonMain/kotlin/com/ssbmax/shared/ui/` (no dedicated
CLAUDE.md yet — `core:designsystem`, which used to cover this, was deleted
once its only two SSOT-worthy objects, `SSBColors`/`Spacing`, were confirmed
already duplicated in `shared`; see the KMP-convergence plan's Phase 0f. Colors
moved again in the Cross-Platform SSOT plan's Phase 7: `SSBColors` itself is
gone — theme colors come from the generated `SsbContracts.DesignTokens`
(`contracts/tokens.yaml` is the SSOT, shared with web). `Spacing` stays a
plain `shared`-local object; there was no cross-platform fork to unify there)
- Component API design
- Material3 theming
- Accessibility (WCAG)
- Size limits (50 lines)
- **Requires @Preview annotation**
- Then read: [app/CLAUDE.md](app/CLAUDE.md) (Composable limits in screens)

### "I'm setting up dependency injection"
**Start here:** [app/di/CLAUDE.md](app/di/CLAUDE.md) — this project uses **Koin, not Hilt**
- `module { }` / `singleOf` / `factoryOf` / `viewModelOf` bindings
- ViewModel bindings live in `shared/*Module.kt`, not `app`
- Testing via `checkModules()` (`PlatformModuleCheckTest`)

### "I'm setting up routing/navigation"
**Start here:** `shared/src/commonMain/kotlin/com/ssbmax/shared/navigation/SSBMaxDestinations.kt`
- `SSBMaxDestinations` (SSOT for routes) — `@Serializable` type-safe routes, not string routes
- `composable<T>()` / `toRoute<T>()` / `navigate(T)`
- Navigation events (Channel-based)
- Deep links via `DeepLinkGateway`
- Testing navigation flows (`shared/src/androidUnitTest/.../navigation/`)

### "I'm writing a custom lint detector"
**Start here:** [lint/CLAUDE.md](lint/CLAUDE.md)
- Android Lint framework (UAST, Detectors)
- Creating new detectors (template)
- Detection patterns
- Testing detectors (LintTestCase)
- Build integration
- 14 existing detectors documented (Phase 2-4)

### "I'm building backend Cloud Functions"
**Start here:** [functions/CLAUDE.md](functions/CLAUDE.md)
- Security (auth checks first)
- Gemini integration (structured prompts)
- Firestore transactions
- Batch operations (500-doc limit)
- Error handling
- Rate limiting

### "I'm doing data ingestion/PDF extraction"
**Start here:** [scripts/CLAUDE.md](scripts/CLAUDE.md)
- Deterministic extraction (text layer, NOT vision model)
- Batch validation (HTML preview gate)
- Firestore batch ops with checkpoints
- Error recovery patterns
- Data quality checks
- LLM for enrichment only

---

## 📊 Statistics

| Module | File Count | Total Lines | Purpose |
|--------|-----------|------------|---------|
| **Root** | 1 | 400+ | Global patterns & rules |
| **app** | 2 | ~200 | Android platform glue (MainActivity, notifications, workers, Koin bootstrap) |
| **shared** | 0 | — | KMP module: UI, ViewModels, navigation, business logic, data, Koin DI (SSOT; no dedicated CLAUDE.md yet, see above) |
| **lint** | 1 | 286 | Custom detectors |
| **functions** | 1 | 281 | Backend Cloud Functions |
| **scripts** | 1 | 297 | Data ingestion & batch ops |
| **TOTAL** | **9 CLAUDE.md files** | **~2,600 lines** | Full development guidance |

---

## 🔗 Cross-Reference Links

**Frequently Referenced Patterns:**

| Pattern | Location | Used By |
|---------|----------|---------|
| Result<T> (error handling) | root [claude.md](claude.md) — "Guiding Principles" | All data/use case code |
| Koin `viewModelOf` | [app/di/CLAUDE.md](app/di/CLAUDE.md) | All feature screens (bindings live in `shared`) |
| StateFlow<UiState> | `shared`'s `presentation/` ViewModels | All ViewModels |
| Repository Pattern | `shared/src/commonMain/.../data/repository/` (`GitLive*`) | Repositories, use cases |
| Firestore Security Rules | `firestore.rules` (repo root) | Firebase backend |
| SSBMaxDestinations | `shared/src/commonMain/.../navigation/SSBMaxDestinations.kt` | All routing |
| Gemini Prompts | [shared/ai/CLAUDE.md](shared/ai/CLAUDE.md) | Evaluation features |

---

## 📝 Update Frequency

| File | Update Frequency | Who Updates |
|------|-----------------|------------|
| Root `claude.md` | Quarterly (new phases/rules) | Tech Lead |
| Module CLAUDEs | Per-release (new patterns) | Module Owner |
| Sub-Module CLAUDEs | As-needed (pattern refinements) | Feature Leads |
| `CLAUDE_HIERARCHY.md` (this file) | With each new CLAUDE.md | Tech Lead |
| `GUIDELINES.md` | Annually (process improvements) | Team Lead |

---

## 🚀 Getting Started

1. **First time contributor?** Read [Root claude.md](claude.md) (12 core rules)
2. **Building a feature?** Jump to your module's CLAUDE.md above
3. **Not sure where to start?** Use the "Quick Lookup" section
4. **Want to add a new pattern?** See [GUIDELINES.md](GUIDELINES.md)

---

**Last Updated:** June 2026 | **Maintainer:** Sunil Pawar
