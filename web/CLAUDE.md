# CLAUDE.md — Web Platform (ssbmax.in)

**Scope:** Instructions specific to the `web/` sub-project. Read alongside the root [`../CLAUDE.md`](../CLAUDE.md), which defines the 12 core rules, security principles, and SSB domain terminology that apply globally. Where this file conflicts with root, this file wins for web-only concerns.

---

## What This Sub-Project Is

React 19 + TypeScript 5.7 + Vite 5.4 + Tailwind CSS 3.4 Progressive Web App deployed on Cloudflare Pages (`ssbmax.in`). Shares the same Firestore database as the Android/iOS apps — Firestore security rules are the SSOT for data access control on all three platforms.

**Tech stack at a glance:**

| Concern | Choice |
|---|---|
| Framework | React 19 (function components + hooks only — no class components) |
| Language | TypeScript 5.7 (strict mode — `noImplicitAny`, `strictNullChecks`) |
| Build | Vite 5.4 + path alias `@/*` → `src/*` |
| Styling | Tailwind CSS 3.4 (utility classes only; zero inline hex codes) |
| Icons | Lucide React |
| Auth | Firebase Auth v10 (Google OAuth 2.0) |
| Database | Cloud Firestore (client SDK — reads only; writes via Cloud Functions) |
| Offline | Workbox PWA (`vite-plugin-pwa`) + IndexedDB (`OfflineQueueService`) |
| Payments | Razorpay (order creation + HMAC webhook verification via Cloud Functions) |
| Tests | Vitest + Testing Library + JSDOM |
| Hosting | Cloudflare Pages (static build, edge CDN) |

---

## Architecture: MVVM Mirror of the KMP App

The web app follows the same **MVVM + Repository + Service** layering as the KMP shared module. This is intentional — the web and mobile platforms must share a conceptual architecture so any developer familiar with one can read the other.

```
src/
├── components/         # Dumb UI components (presentational only — zero Firebase)
│   ├── common/         # Shared design-system atoms (Button, Badge, Skeleton…)
│   ├── landing/        # Public marketing surface
│   ├── layout/         # AppLayout, Header, navigation shell
│   ├── dashboard/      # CandidateDashboard
│   ├── practice/       # PracticeTestsPage
│   ├── study/          # StudyMaterialPage + 5-Day SSB vertical layout
│   ├── testRunners/    # OIRTestRunner, PsychologyTestRunner, GTOTaskGuideRunner (anti-cheat wired;
│   │                   #   GTO/Interview capture is plain multiline textarea + char counter, no media)
│   ├── evaluation/     # PsychologistDossier report viewer
│   ├── reports/        # AIReportsPage — OLQ dashboard, routed via `activeTab === 'reports'` in App.tsx
│   ├── subscription/   # SubscriptionPage + Razorpay triggers
│   ├── settings/       # SettingsPage
│   ├── account/        # AccountPage
│   ├── onboarding/     # First-run onboarding
│   └── legal/          # Privacy, Terms
├── viewmodels/         # State containers (custom hooks returning UiState + actions)
│   ├── useOLQDashboardViewModel.ts     # aggregates `{type}_results` into AIReportsPage's props
│   └── useSubmissionResultViewModel.ts # polls `submissions/{id}.analysisStatus` until COMPLETED
├── repositories/       # Firestore read wrappers + Cloud Function write wrappers
│   ├── ContentRepository.ts    # Firestore reads (study materials, question batches)
│   ├── SubmissionRepository.ts # wraps submit*/evaluate* callables (writes) + result-collection reads
│   ├── FeatureFlagRepository.ts
│   ├── SubscriptionRepository.ts
│   └── interfaces/     # Repository TypeScript interfaces
├── services/           # Side-effect singletons
│   ├── AuthService.ts
│   ├── AntiCheatService.ts
│   ├── OfflineQueueService.ts
│   └── RazorpayService.ts
├── hooks/              # Reusable React hooks (useTheme, useAntiCheat, useTabRouting…)
├── constants/
│   ├── strings.ts      # SSOT barrel — re-exports all domain string modules
│   ├── strings/        # Domain-scoped string files (common, landing, tests, dossier…)
│   ├── colors.ts       # Design token SSOT — all Tailwind color aliases
│   └── ssbSelectionProcess.ts  # Static SSB phase/test metadata
├── config/             # Firebase app init
└── types/              # Shared TypeScript types / interfaces
```

**Data flow (read-only path):**
```
Component → ViewModel hook → Repository → Firestore SDK → IndexedDB cache
```

**Data flow (write path — anti-cheat + payments):**
```
Component → ViewModel hook → Cloud Function (HTTPS callable) → Firestore Admin SDK
```

**Data flow (test submission + AI evaluation — Tier-2 SSOT, see root `CLAUDE.md` and `functions/CLAUDE.md`):**
```
Component → ViewModel → SubmissionRepository.submit*() callable → submissions/{id} doc created
                       → SubmissionRepository.evaluate*() callable (functions/src/evaluation/*Evaluate.js)
                       → result screen polls submissions/{id}.analysisStatus until COMPLETED
                       → reads {type}_results/{id} once
```
KMP calls the exact same `evaluate*` Cloud Functions — this is the one piece of Tier-2 *decision logic* (prompt construction, scoring, quota enforcement) that is **not** hand-duplicated between web and `shared`, unlike the eligibility pre-check duplication called out in root `CLAUDE.md`.

---

## Non-Negotiable SSOT Rules

### 1. Strings

**All UI text lives in `src/constants/strings/`** — barrel-exported via `src/constants/strings.ts`.

- Zero inline string literals in JSX/TSX. No exceptions.
- To add new copy: create or extend the appropriate domain file under `strings/`, then re-export from `strings.ts`.
- Existing domain files: `common`, `landing`, `tests`, `dossier`. Add new files for new domains; don't dump everything into `common`.

### 2. Colors

**All color references live in `src/constants/colors.ts`** (Tailwind class aliases and CSS custom property tokens).

- Zero raw hex codes (`#FFF`, `rgba(...)`, `hsl(...)`) in component files.
- Use Tailwind utility classes that map back to the design token, not ad-hoc `style={{ color: '#...' }}`.

### 3. File Size Cap

**≤ 300 lines per file.** No exceptions. If a component is growing past this, split into sub-components. If a hook is large, split into smaller composable hooks.

### 4. No Firebase in Components or ViewModels

Firebase SDK (`firebase/firestore`, `firebase/auth`) must not be imported inside `src/components/` or `src/viewmodels/`. All Firebase access goes through `src/repositories/` (reads) or `src/services/` (auth) or Cloud Function calls (writes).

---

## Component Rules

- **Function components only.** No class components.
- **Props typed with explicit interfaces** — never `any`, never untyped objects.
- **No component-local business logic.** Logic belongs in a ViewModel hook or Service.
- **Mobile-first layout** — design at 320px, then scale to `md:` (768px) and `lg:` (1024px+). Test at 320px before considering the task done.
- **Touch targets ≥ 44×44px** on all interactive elements.
- **Skeleton loaders during async resolution** — never a blank flash or layout jump (zero CLS).
- **No heavy charting libraries.** Visualizations use inline SVG primitives (<5KB) only.

---

## ViewModel Rules

ViewModels are **custom React hooks** that return a typed `UiState` object and action callbacks. They are the only place that orchestrates repositories, services, and local state.

```ts
// Pattern — every ViewModel follows this shape
function useSomethingViewModel(): SomethingUiState & SomethingActions {
  const [state, setState] = useState<SomethingUiState>(initialState);
  // ... orchestration
  return { ...state, onAction };
}
```

- One ViewModel per screen/feature domain.
- ViewModels must not import React UI (`jsx`, `tsx` components).
- ViewModels must not import Firebase directly — call repository methods or services.

---

## Service Rules

Services (`src/services/`) are **singletons** that encapsulate side-effectful APIs:

| Service | Responsibility |
|---|---|
| `AuthService` | Firebase Auth sign-in / sign-out / auth state |
| `AntiCheatService` | Context-menu suppression, DevTools blocking, tab-switch detection |
| `OfflineQueueService` | IndexedDB queue, SHA-256 HMAC checksum, reconnect sync |
| `RazorpayService` | Razorpay checkout SDK initialization and order flow |

- Services must not import React hooks or components.
- `OfflineQueueService` validates `auth.currentUser` before every queue flush — never flush anonymously.

---

## Anti-Cheating Invariants (Must Not Break)

These behaviors are security controls, not UX polish. Never remove or weaken them:

1. **`correctAnswerIndex` is stripped client-side** for OIR tests. Scoring is server-side via the `evaluateOIRAnswers` Cloud Function.
2. **`AntiCheatService`** suppresses right-click, `F12`/DevTools shortcuts, paste, and drop during active test sessions.
3. **Tab-switch violations** auto-submit the test after the configured threshold.
4. **`OfflineQueueService` HMAC** — SHA-256 checksum computed at submission time; tampered payloads are rejected at sync time.
5. **`AntiCheatService`** must preserve IME composition (`isComposing`) — do not block input for CJK/IME keyboards while blocking paste/drop.

---

## PWA & Offline Rules

- **Service Worker is Workbox-managed** via `vite-plugin-pwa`. Never handwrite SW cache logic.
- **`StaleWhileRevalidate`** for static assets and images.
- **`NetworkFirst`** for API/Firestore calls.
- **Auth-aware flush only** — `OfflineQueueService` checks `auth.currentUser` before syncing; if session expired, preserve queue and prompt re-auth.
- **Offline/Online status badge** must be visible in the Header at all times.

---

## Security Rules (Web-Specific)

These supplement the root CLAUDE.md security principles:

1. **Zero secrets in client bundle.** `GEMINI_API_KEY`, `RAZORPAY_KEY_SECRET`, and Firebase service account keys never leave Cloud Functions.
2. **HMAC payment verification** is server-side only (`functions/src/webhooks.js`). Client only triggers; it never trusts its own payment result.
3. **CSP / HSTS headers** are defined in `web/public/_headers` and must not be loosened. `'unsafe-inline'` scripts are forbidden.
4. **Candidate written responses** are XML-boundary-escaped before Gemini evaluation (handled in `functions/src/aiAnalysis.js`). Web client must not pre-process or modify the raw response text before sending to Cloud Functions.
5. **CI validates security.** Every PR must pass `./scripts/validate-security.sh` (10-point audit: secret leak scan, LOC limits, HSTS/CSP/CORP headers, anti-cheat handlers, Firestore rules lockdown).

---

## Testing Rules

**Framework:** Vitest + Testing Library + JSDOM (108+ tests across 28 files).

**Commands:**
```bash
npm run test            # Single vitest run (CI mode)
npm run test:watch      # Watch mode (local dev)
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright, against a real browser
```

**Test location:** `web/tests/` (mirrors `src/` structure):
```
tests/
├── security/   # CSP/HSTS header tests, Firestore rules tests
├── services/   # AntiCheatService, OfflineQueueService, AuthService
├── unit/       # ViewModel and Repository unit tests
└── e2e/        # Playwright specs (playwright.config.ts, testDir-scoped to just this folder)
```

**Rules:**
- Tests encode *why* behavior matters, not just *what* it does (root Rule 9).
- Security tests (`tests/security/`) are mandatory for every security-surface change.
- A phase/task is not done until `npm run test` is green. No skipped tests counted as passing.
- Mock Firebase and Cloud Function calls in tests — never hit real Firestore from the test suite.
- `npm run test:e2e` runs against a real Chromium via Playwright, not JSDOM — `playwright.config.ts`'s
  `webServer` starts `npm run dev` itself and waits for it, so no manual server start is needed
  locally or in CI. It is a required step in `web-ci` (`.github/workflows/main-ci.yml`); do not run
  Playwright with no config/testDir argument outside this project — Playwright's own default testDir
  would also match the Vitest files under `tests/unit/` and crash trying to load them.

---

## Deployment (read this before assuming a merge ships)

The web app is built and deployed by **Cloudflare Pages (project `ssbmax-web`)** directly
from GitHub. There is **no deploy step in this repository** — which branch Pages builds
from is Cloudflare dashboard state, not version-controlled, and therefore invisible here.

`ssbmax.in` and `ssbmax.ai` both redirect to the `ssbmax-web.pages.dev` origin.

This has already caused one silent production incident: `main` moved 239 commits ahead
while production kept serving a build from a branch Pages was still watching, and the only
way to detect it was fetching the JS bundle and grepping for `data-testid` markers that had
moved between components. Two things now exist so that cannot recur silently:

- **`web/scripts/write-version.mjs`** runs as part of `npm run build` and emits
  `dist/version.json` — `{ commit, branch, builtAt }`. The commit comes from
  `CF_PAGES_COMMIT_SHA` (authoritative, since Pages is what builds production),
  falling back to `GITHUB_SHA`, then `git rev-parse HEAD`. So
  `curl https://ssbmax.in/version.json` answers "what is actually live" in one request.
- **`.github/workflows/deploy-drift.yml`** compares that endpoint against `main` daily and
  warns when they differ. It is **non-blocking by design** — it reads production over the
  public internet, and a release check that cries wolf is one people learn to ignore.

Note the SPA gotcha when checking by hand: the catch-all rewrite serves `index.html` with a
**200** for any unmatched path, so a successful `curl` of `/version.json` is not proof the
endpoint exists. Parse it before trusting it; HTML back means the deployed build predates
the version stamp.

Environment variables (`VITE_FIREBASE_*`) are configured in the Pages project, not in this
repo — `web/.env` is gitignored. A build without them falls back to the `ssbmax-demo`
placeholder project in `src/config/firebase.ts`, which is why CI builds are safe to run but
must never be deployed.

---

## SEO / AI Search (GEO)

Public content routes (`/study/*`, `/faq`, and any future content path under `src/routes/`)
exist to be read by AI answer engines (ChatGPT, Perplexity, Google AI Overviews, Claude) as
well as humans — most of these crawlers do not execute JavaScript, so a route that only renders
after hydration is invisible to them. This section is the convention set from the
`ai_search_readiness` GEO plan (`docs/plans/ai_search_readiness*`); read that plan for the "why"
behind each rule below.

- **Public routes must be prerendered, full-text, non-hydrated static HTML.** `web/scripts/
  prerenderContentRoutes.mjs` + `prerenderHtml.mjs` run inside `npm run build` (never as a
  separate/optional step) and emit `dist/<route>/index.html` containing the actual prose — not
  a loading skeleton. Never seed `window.__INITIAL_DATA__` for these pages instead: that
  reintroduces the inline-script CSP problem for no benefit. `curl <url> | grep` for body text
  is the source-of-truth check, not "it renders in a browser."
- **Content is data, authored in git, not in TSX.** New long-form public content goes under
  `web/content/` (or `content/` at repo root for the KMP-shared prose) as markdown +
  frontmatter, loaded at build time via `web/scripts/loadContent.mjs`. It is exempt from the
  300-LOC rule (content, not code) but the *loader/renderer* code is not.
- **Metadata + JSON-LD are mandatory on every public route**, not optional polish: `<title>`,
  `description`, `og:*`/`twitter:*` via `useDocumentMeta`/`contentSeo.ts`, and a schema.org
  JSON-LD block appropriate to the page type (`Course`/`LearningResource`, `BreadcrumbList`,
  `FAQPage`). JSON-LD ships CSP-safe — either a per-build `sha256-…` script-src hash
  (`web/scripts/cspHashes.mjs`/`cspHeaders.mjs`) or external static JSON. Never loosen
  `web/public/_headers`' CSP (no `'unsafe-inline'`) to make a JSON-LD block work; `web/tests/
  security/headers.test.ts` and `structuredData.test.ts` enforce this.
- **`web/scripts/generateSeoFiles.mjs` regenerates `robots.txt`/`sitemap.xml`/`llms.txt` from
  the live route list on every build** — a route added under `src/routes/` without a
  corresponding content/seo entry will not silently appear half-configured; extend the
  generator, don't hand-edit `dist/sitemap.xml`.
- **Gated routes (anything behind auth — SSB Tests, results, dashboards) must stay `noindex`
  and excluded from the sitemap.** Only Study/FAQ/marketing content is public; the auth wall on
  SSB Tests itself is a tier/quota control (`CheckTestEligibilityUseCase`), not a GEO decision,
  and must not be relaxed as a side effect of GEO work.
- **URLs are permanent once indexed.** A content route's slug is a one-time decision (see the
  plan's Phase 2 "URL structure is permanent" gate) — changing an indexed slug later costs the
  indexing already earned and needs a 301, not a rename. Pick intent-matching slugs
  (`/study/ssb-psychology-tat-wat-srt-sd`, not `/study/day-1`) before merging, not after.
- **robots.txt distinguishes training crawlers from retrieval crawlers on purpose** (`GPTBot`,
  `ClaudeBot`, `Google-Extended` disallowed; `ChatGPT-User`, `Claude-User`, `Claude-SearchBot`,
  `PerplexityBot`, `Googlebot` allowed). This is a deliberate monetization/citation tradeoff
  (root `CLAUDE.md` Rule 7) — don't "fix" it toward allow-all without re-litigating that
  decision with the user.
- **`content/` under repo root is the shared SSOT with KMP**, not a web-only fork: web reads it
  at build time (no Firestore credentials in the web build); a publish script pushes the same
  source to Firestore `topic_content`/`study_materials` for mobile; `scripts/content/
  generateKmpFallback.js` regenerates KMP's offline fallback prose
  (`shared/.../presentation/topic/TopicIntro*.kt`) from it. Writing content once should improve
  both platforms — never hand-write competing prose in `web/content/` and `shared/` for the
  same topic.

### Structured content rendering (docs/plans/write-the-phased-plan-wobbly-pancake.md)

Every `content/*.md` body is parsed once, at build time, into a typed `DocumentModel`
(`scripts/content/parseDocument.js` — the one parser; do not write a second one in TSX or
Kotlin) and rendered natively on each platform instead of as one markdown blob per page.

- **The block taxonomy is a plain string, not an enum (D1).** `block.type` values:
  `paragraph`, `list`, `specTable`, `callout`, `comparison`, `timeline`, `table`. An unrecognised
  type must render as `paragraph` on both web (`web/src/components/content/blockRegistry.ts`)
  and KMP (`shared/.../ui/content/blocks/blockRegistry.kt`) — this lets a shipped mobile build
  survive a new block type introduced after it was released. Promote to
  `contracts/enums.yaml` only once the taxonomy is stable across a release or two.
- **Sections ship expanded by default (D3).** No hidden/collapsed content on first render — AI
  retrieval crawlers' handling of `<details>` is undocumented and Google has historically
  down-weighted hidden text. Where a collapse control is offered, it is a local user preference
  applied on top of native `<details>` markup (content stays in the DOM), never React
  conditional rendering — that would strip prose from the prerendered HTML.
- **No markdown parsing in the browser or on device, ever (D4).** All parsing happens once, at
  build/publish time, in `parseDocument.js`. `StudyReaderModal` and every other surface render
  the parsed `DocumentModel` via `DocumentView`/`blockRegistry`; there is no runtime
  markdown-to-HTML fallback path. `web/src/utils/renderMarkdown.ts` and the `marked` dependency
  were deleted for this reason (Phase 8 sweep) — do not reintroduce a runtime markdown parser
  as a "just in case" fallback when a fetch is slow or fails; render a loading state instead.
- **Structure is authored in `content/`, never in TSX or Compose.** A renderer's job is to map
  an existing block type to markup, not to encode document structure itself. New prose goes into
  a `.md` file conforming to `content/SCHEMA.md`; new *shapes* (a new block type) go into
  `parseDocument.js`'s classifier plus both `blockRegistry`s together (the parity gate,
  `content/__fixtures__/blocks.json`, fails both builds until they agree).
- **The parity gate is mechanical, not convention** — the one place in this codebase where
  `shared` and `web` are kept in sync by a build-time check rather than a CLAUDE.md instruction
  (see root `CLAUDE.md`'s four-consumer section on Tier 3 having no such enforcement elsewhere).

---

## Build & Dev Commands

```bash
# Local development
npm run dev             # Vite dev server (hot reload)

# Production build
npm run build           # tsc -b && vite build (output: dist/)
npm run preview         # Preview production bundle locally

# Lint (ESLint flat config: web/eslint.config.js — typescript-eslint + react-hooks + react-refresh)
npm run lint             # Required in pre-commit (.githooks/pre-commit) and CI (web-ci job)

# Security audit (required before declaring any phase complete)
../scripts/validate-security.sh
```

**Path alias:** Use `@/` for all `src/` imports — no relative `../../` climbing.

```ts
// Correct
import { strings } from '@/constants/strings';
import { useTheme } from '@/hooks/useTheme';

// Wrong
import { strings } from '../../constants/strings';
```

---

## SSB Domain Terminology (Web Copy)

Follows root CLAUDE.md exactly. In JSX string literals and `strings/` files:

- Use: *Services Selection Board*, *OIR*, *PPDT*, *TAT*, *WAT*, *SRT*, *SD*, *GTO*, *Assessor Benchmark*
- Never use: `DIPR`, `Gemini 2.5`, internal vendor names, or research jargon
- Beginner explanations go in brackets: `OIR (Officer Intelligence Rating)`

---

## Key File Map (Quick Navigation)

| What you need | File |
|---|---|
| All UI strings | `src/constants/strings.ts` + `src/constants/strings/` |
| Color design tokens | `src/constants/colors.ts` |
| Firebase init | `src/config/` |
| Auth | `src/services/AuthService.ts` |
| Anti-cheat | `src/services/AntiCheatService.ts` |
| Offline sync | `src/services/OfflineQueueService.ts` |
| Firestore reads | `src/repositories/ContentRepository.ts` |
| Test submission + evaluation writes | `src/repositories/SubmissionRepository.ts` |
| OLQ dashboard aggregation | `src/viewmodels/useOLQDashboardViewModel.ts` |
| Submission result polling | `src/viewmodels/useSubmissionResultViewModel.ts` |
| Tab routing | `src/hooks/useTabRouting.ts` |
| App entry | `src/App.tsx` |
| PWA config | `vite.config.ts` |
| Security headers | `public/_headers` |
| Architecture doc | `docs/architecture.md` |
| Cloud Functions | `../functions/src/` |
| Firestore rules | `../firestore.rules` |
| Security audit | `../scripts/validate-security.sh` |
