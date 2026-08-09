# SSBMax Project-Scoped Agent Rules & Design Principles

All AI agents working on the **SSBMax** codebase MUST strictly adhere to the following permanent UI/UX, responsive layout, and architectural guardrails without exception.

---

## 📱 1. Mobile-First & Cross-Device Responsiveness (Mobile, Tablet, Laptop/Desktop)

- **Mobile Viewport Priority (320px–480px)**: Over 80% of NDA & SSB aspirants access the platform on smartphones. Every layout, test runner, header, modal, and widget MUST be built and verified for small mobile screens first before scaling to tablet (`md: 768px`) and laptop/desktop (`lg: 1024px+`).
- **Low-Friction Mobile Interactions**: Never force long mandatory text typing on mobile landing pages or public demos. Always provide **1-tap preset action chips** alongside text inputs to eliminate mobile keyboard clutter, viewport jumping, and input fatigue.
- **Touch Target Standard**: All interactive elements (buttons, chips, form inputs, links, navigation icons) MUST enforce a minimum **44×44px touch target size** to ensure easy tapping on mobile viewports.
- **Cognitive Load & Data Density**: Complex multi-dimensional metrics (e.g. 15 Officer Like Qualities / OLQs) MUST default to aggregated high-level summaries (e.g. 4 Core SSB Factors) on small screens, with an interactive toggle to expand into micro-metrics.

---

## ⚡ 2. Performance, CLS & Visual Architecture

- **Zero Cumulative Layout Shift (CLS)**: Layout containers, headers, and app shells MUST reserve fixed heights/dimensions (e.g., `h-16`) and use neutral pulsing skeleton loaders during asynchronous auth resolution (`onAuthStateChanged`).
- **Zero Heavy Charting Libraries**: High-impact charts and radar visualizations MUST be authored using lightweight inline SVG primitives (< 5KB code footprint) rather than pulling in external chart dependencies (Recharts, Chart.js), preserving initial bundle size and sub-1.2s LCP.
- **Zero-Cost Instant Feedback Engines**: Public landing page sandboxes and interactive demos MUST execute via local client-side heuristic evaluators (< 50ms latency) to guarantee instant gratification while shielding Cloud Functions from API cost inflation and rate-limiting attacks.

---

## 🔒 3. Codebase Architectural Guardrails & SSOT Rules

- **Strict File LOC Cap (<= 300 LOC)**: Every TypeScript/React file created or modified MUST strictly stay under **300 lines of code (LOC)**. Large component structures or string resources MUST be split into modular domain files.
- **Single Source of Truth Strings & Design Tokens**: 100% of user-facing UI text MUST be defined in `src/constants/strings/` (or barrel `src/constants/strings.ts`). 100% of colors MUST map to design tokens in `src/constants/colors.ts`. **Zero raw string literals or hex codes (`#FFF`, `#000`) allowed in JSX/TSX components.**
- **Authentic SSB Domain Terminology**: UI copy strictly adheres to authentic military nomenclature (*Services Selection Board Protocol*, *Assessor Benchmark*, *OIR*, *PPDT*, *TAT*, *WAT*, *SRT*, *SD*) with friendly bracketed explanations for beginners, eliminating internal research or vendor jargon (`DIPR`, `Gemini 2.5`).
- **Mandatory TDD & Security Verification**: All changes MUST be verified with Vitest test suites (`npm run test`) and pass `./scripts/validate-security.sh` prior to declaring completion.
