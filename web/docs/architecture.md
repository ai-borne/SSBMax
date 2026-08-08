# SSBMax Web Application Architecture & Roadmap Blueprint

## Executive Summary
This document provides an enterprise-grade architecture overview of **`ssbmax.in`** (React 19 + TypeScript + Vite + Tailwind CSS + PWA), detailing the current implementation, security & anti-cheating protocols, offline sync architecture, cost optimizations, deployment roadmap, and desired end-state.

---

## 1. System Architecture Diagram

```
                                  +---------------------------------------+
                                  |     Global Edge & Hosting Layer       |
                                  |      Cloudflare Pages (ssbmax.in)     |
                                  |  - Static Assets / Images via CDN     |
                                  |  - Custom Security Headers (CSP, HSTS)|
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |       Client Web / PWA Layer          |
                                  | React 19 + TS + Tailwind CSS + PWA    |
                                  |  - App Shell / Service Worker Cache   |
                                  |  - Dual Theme Engine (Dark/Light)     |
                                  |  - IndexedDB Persistence & Off. Queue |
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +----------------------+
                     | (Client Direct - Read Only)                                     | (Callable Triggers)
                     v                                                                 v
+-------------------------------------------+                     +-------------------------------------------+
|          Data & Auth Persistence          |                     |         Serverless Compute Layer          |
|              Google Firebase              |                     |          Firebase Cloud Functions          |
|  - Firebase Auth (Google OAuth 2.0)       |                     |  - Gemini 2.5 Flash Evaluation            |
|  - Firestore DB (Strict Security Rules)   |                     |  - Razorpay Order & HMAC Verification     |
+-------------------------------------------+                     |  - Server-Side OIR Evaluation (Anti-Cheat)|
                                                                  +---------------------+---------------------+
                                                                                        |
                                                                                        v
                                                                  +-------------------------------------------+
                                                                  |         External Vendor Services          |
                                                                  |  - Google Gemini 2.5 Flash API            |
                                                                  |  - Razorpay Payment Gateway (UPI/Cards)   |
                                                                  +-------------------------------------------+
```

---

## 2. Core Architectural & Security Principles

### A. Resource Centralization (SSOT)
* **Single Source of Truth Strings (`src/constants/strings.ts`)**: All UI text, button labels, headings, error messages, and timer alerts are centralized. **Zero inline string literals** allowed in JSX/TSX.
* **Design Token Color Palette (`src/constants/colors.ts`)**: Universal theme tokens mapped to Tailwind CSS variables. **Zero inline hex codes** (`#FFF`, `#000`) allowed in component files.

### B. Security & Anti-Cheating Framework
* **OIR Anti-Cheating**: OIR test queries explicitly strip `correctAnswerIndex` on the client. Test responses are submitted to the `evaluateOIRAnswers` Cloud Function for secure server-side scoring.
* **Gemini Prompt Injection Defense**: Candidate written responses are sanitized and isolated inside `<candidate_response>` XML boundary tags in Cloud Functions before Gemini AI evaluation.
* **Razorpay HMAC Verification**: Server-side Crypto SHA256 HMAC signature verification on all Razorpay payments.
* **Razorpay Webhook SSOT**: Server-to-server webhook (`handleRazorpayWebhook`) listening to `payment.captured` acts as the primary authority for updating `isPaidMember: true`.
* **Zero Secret Exposure**: API keys (`GEMINI_API_KEY`, `RAZORPAY_KEY_SECRET`) strictly isolated in serverless environments. CI runs `./scripts/validate-security.sh` to block key leaks.

### C. PWA Offline & Background Sync Architecture
* **App Shell & Image Caching**: Workbox Service Worker configured with `StaleWhileRevalidate` for images and static assets.
* **Auth-Aware Offline Queue (`OfflineQueueService`)**: Offline test submissions queue in `IndexedDB`. Upon reconnection, the queue engine validates `auth.currentUser` before syncing; if expired, it preserves queued data and prompts re-authentication.
* **Status Badges**: Explicit UI indicators distinguishing *"Available Offline"* content from *"Requires Online Connection"* AI features.

---

## 3. What We Have Built (Current State)

### Core Framework & Foundation
* **Build System**: React 19 + TypeScript 5.7 + Vite 5.4 + Path Aliases (`@/*`).
* **Styling & Design System**: Tailwind CSS 3.4 + Lucide Icons + Universal Design Tokens (`colors.ts`) + Centralized String Resources (`strings.ts`).
* **Progressive Web App (PWA)**: Workbox PWA configuration (`vite-plugin-pwa`) with `StaleWhileRevalidate` for images, `NetworkFirst` for API, and standalone app manifest.
* **Test Suite (TDD)**: 108 unit & component tests passing across 28 test files via Vitest + Testing Library + JSDOM.

### UI Components & ViewModels
* **Landing & Marketing**: Responsive `HeroSection` with CTA triggers, feature highlights, and pricing section.
* **Layout & Navigation**: `AppLayout`, `Header` with Dark/Light theme toggle, PWA install prompt banner, and network status badge.
* **User Portal**: `CandidateDashboard`, `PracticeTestsPage`, `StudyMaterialPage`, `AIReportsPage`, `SubscriptionPage`, `SettingsPage`, `AccountPage`.
* **Test Runners**: Anti-cheating `OIRTestRunner` (MCQ timing + palette), `PsychologyTestRunner` (TAT/WAT/SRT/PPDT slide timings), and `PsychologistDossier` report viewer.
* **Data & State Management**: `ContentRepository` (Firestore IndexedDB persistence), `OfflineQueueService` (IndexedDB sync queue), `AuthService` (Google Sign-In), `OIRTestViewModel`, `PsychologyTestViewModel`, `PaymentViewModel`, `StudyMaterialViewModel`.

---

## 4. What Is Left (Pending Infrastructure & Integrations)

### A. Production Edge Deployment (Cloudflare Pages)
* **Git Repository Link**: Connect repository to Cloudflare Pages dashboard (`Build command: npm run build`, `Build output: web/dist`).
* **Security Headers**: Deploy `public/_headers` (CSP, HSTS, `X-Frame-Options: DENY`).
* **Custom Domain**: Map `ssbmax.in` in Cloudflare Pages DNS.

### B. Google OAuth Production Credentials
* Configure Google Sign-In in Firebase Console.
* Register `ssbmax.in` and `*.pages.dev` under Authorized Domains in Firebase Auth.

### C. Serverless Backend Cloud Functions Integration
* Deploy `evaluateOIRAnswers` Cloud Function (anti-cheating answer scoring).
* Deploy `createRazorpayOrder` & `handleRazorpayWebhook` Cloud Functions with `notes: { userId }` metadata.
* Deploy `analyzeResponse` Gemini 2.5 Flash evaluation trigger with XML boundary shielding and Firestore transactional lock (`isEvaluating: true`).

### D. CDN Assets Upload
* Upload static PPDT, TAT, and GPE image sets to `web/public/images/` or Cloudflare R2 bucket for zero-cost edge distribution.

---

## 5. Cost & Performance Capacity Math (10,000 Users)

| Metric | Capacity & Strategy | Expected Monthly Cost |
| :--- | :--- | :--- |
| **Cloudflare Pages Hosting** | Unlimited Bandwidth, Global Edge CDN | **$0.00** |
| **Firebase Auth** | Unlimited Google Sign-In Users | **$0.00** |
| **Firestore Database Reads** | ~16k reads/day across 1,000 DAU (vs 50k free limit) | **$0.00** |
| **PPDT / TAT Image Traffic** | Served via Cloudflare Edge CDN (60 GB/mo) | **$0.00** |
| **Gemini 2.5 Flash AI** | ~30,000 evaluations/mo (45M input / 15M output tokens) | **~$7.88 / month** |
| **Total Estimated Operating Cost** | High-scalability, production-grade infrastructure | **~$8.00 / month** |

---

## 6. Milestone Way Ahead & Sprint Execution Roadmap

| Milestone | Objective | Target Actions | Status |
| :--- | :--- | :--- | :--- |
| **M1: Core UI & Web App Shell** | Build React 19 SPA + PWA + Design Tokens + Unit Tests | 108 Vitest tests green, local dev server running | ✅ **Completed** |
| **M2: Cloudflare Deployment & Git Setup** | Connect Git to Cloudflare Pages, setup `ssbmax.in` DNS | Cloudflare Pages `ssbmax-web` deployed, HTTP security headers verified | ✅ **Completed** |
| **M3: Production Auth & Data Sync** | Enable Google OAuth & Firestore live data sync | Registered Web App `1:836687498591:web:8344203ceec988e5f3baea`, Authorized Domains updated | ✅ **Completed** |
| **M4: Payments & Gemini AI Backend** | Deploy Cloud Functions for Razorpay & Gemini 2.5 Flash | All Node.js 22 Cloud Functions (`createRazorpayOrder`, `evaluateOIRAnswers`, `handleRazorpayWebhook`, `analyzeResponse`) deployed | ✅ **Completed** |
| **M5: Production Launch & Hardening** | Full end-to-end security audit & domain verification | Security audit passed (`./scripts/validate-security.sh`), production build verified | ✅ **Completed** |

---

## 7. Desired End-State

A production-ready, enterprise-grade web application (`ssbmax.in`) that is:
1. **Ultra-Fast & Cost-Effective**: < 1.2s load time globally via Cloudflare Edge CDN, costing **< $10/month** for 10,000 active users.
2. **Installable & Offline-Capable**: Full PWA installation on mobile/desktop; study materials and OIR practice work 100% offline with auth-aware background sync.
3. **Completely Secure**: OWASP compliant, zero client-side API key leakage, HMAC SHA256 payment verification, server-side OIR anti-cheating, and prompt-injection-shielded Gemini 2.5 Flash evaluations.
4. **Unified SSOT Data Model**: Shares 100% database parity with Android & iOS apps via Firestore.

---

## 8. Finalized Security Control Matrix

| Security Domain | Applied Controls & Defense Mechanisms | Verification & Compliance |
| :--- | :--- | :--- |
| **Edge & Network Security (`Cloudflare Pages`)** | • 2-year HSTS (`max-age=63072000; includeSubDomains; preload`) in [`_headers`](file:///Users/sunil/Downloads/SSBMax-kmp/web/public/_headers).<br>• Strict Content Security Policy with `frame-ancestors 'none'`, `object-src 'none'`, and no `'unsafe-inline'` script tags.<br>• RFC 9116 compliant [`security.txt`](file:///Users/sunil/Downloads/SSBMax-kmp/web/public/.well-known/security.txt) policy. | Validated via [`web/tests/security/headers.test.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/tests/security/headers.test.ts) (100% green). |
| **Serverless Cloud Functions (`functions/src/`)** | • Modular architecture (< 300 LOC per file): [`webhooks.js`](file:///Users/sunil/Downloads/SSBMax-kmp/functions/src/webhooks.js), [`payments.js`](file:///Users/sunil/Downloads/SSBMax-kmp/functions/src/payments.js), [`aiAnalysis.js`](file:///Users/sunil/Downloads/SSBMax-kmp/functions/src/aiAnalysis.js), [`oirScoring.js`](file:///Users/sunil/Downloads/SSBMax-kmp/functions/src/oirScoring.js).<br>• Constant-time HMAC signature verification via `crypto.timingSafeEqual()` against timing side-channel attacks.<br>• Replay attack prevention via `webhook_logs` idempotency checking and server-side tier price verification.<br>• Prompt injection defense via XML entity escaping (`&lt;`, `&gt;`, `&amp;`) and `<candidate_response>` XML boundary tags.<br>• Denial-of-Wallet (DoW) defense via `maxInstances: 10` Cloud Function limits. | Validated via [`functions/test/security.test.js`](file:///Users/sunil/Downloads/SSBMax-kmp/functions/test/security.test.js) (Node 22 native test runner, 100% green). |
| **Client Anti-Cheating & Storage Protection** | • Multi-platform anti-cheating service ([`AntiCheatService.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/src/services/AntiCheatService.ts)) suppressing right-click context menus, blocking developer shortcuts (`F12`, `Cmd+Opt+I`, `Cmd+Shift+4`, `Ctrl+Shift+I`), and enforcing touch-callout restrictions.<br>• Tab switch / window unfocus violation tracking with auto-submission trigger.<br>• Web Crypto SHA-256 HMAC payload checksum computation in [`OfflineQueueService.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/src/services/OfflineQueueService.ts) to detect and reject tampered IndexedDB offline submissions. | Validated via [`web/tests/services/AntiCheatService.test.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/tests/services/AntiCheatService.test.ts) and [`web/tests/unit/OfflineQueueService.test.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/tests/unit/OfflineQueueService.test.ts). |
| **Database & Storage Access Control** | • Hardened [`firestore.rules`](file:///Users/sunil/Downloads/SSBMax-kmp/firestore.rules): Strictly disallows client updates to privileged fields (`isPaidMember`, `membershipPlan`, `paymentId`, `orderId`, `role`, `olqScores`, `analyzedBy`). Locked down `webhook_logs` to Cloud Functions Admin SDK.<br>• Hardened [`storage.rules`](file:///Users/sunil/Downloads/SSBMax-kmp/storage.rules): Disallows client writes to static test assets (`ppdt_images`, `tat_images`) and enforces 10MB maximum upload limits on user uploads. | Validated via [`web/tests/security/rules.test.ts`](file:///Users/sunil/Downloads/SSBMax-kmp/web/tests/security/rules.test.ts). |
| **Automated CI/CD Compliance** | • [`scripts/validate-security.sh`](file:///Users/sunil/Downloads/SSBMax-kmp/scripts/validate-security.sh): Automated 10-point security audit checking for API keys, tracked credentials, LOC limits (< 300 LOC per file), HSTS, CSP, and security rules lockdown. | 100% clean execution (0 errors, 0 warnings). |

