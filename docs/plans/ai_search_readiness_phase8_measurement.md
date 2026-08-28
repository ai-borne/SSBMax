# Phase 8 — Measurement & Instrumentation

Companion to Phase 8 of `docs/plans/i-just-watched-a-nested-russell.md` ("Measurement &
Instrumentation") and `docs/plans/ai_search_readiness_phase0_findings.md` §7 (no historical
baseline exists — this is where "day zero" actually starts).

Three of this phase's four pieces are manual, one-time dashboard actions that cannot be done from
this repository or automated safely (they require proving domain ownership / a logged-in
Cloudflare account) — this doc is the checklist for those, plus how to read what was built.

## 1. Google Search Console verification + sitemap submission (manual)

1. Go to [Google Search Console](https://search.google.com/search-console) and add `ssbmax.in`
   as a property (use the "URL prefix" method, `https://ssbmax.in`).
2. Choose the **HTML tag** verification method. GSC gives you a
   `<meta name="google-site-verification" content="...">` tag — copy just the `content` value.
3. Set it as `VITE_GSC_VERIFICATION_CODE` in the Cloudflare Pages project's environment
   variables (Pages dashboard → ssbmax-web → Settings → Environment variables), **not** in a
   committed file — `web/index.html` already embeds
   `<meta name="google-site-verification" content="%VITE_GSC_VERIFICATION_CODE%" />` via Vite's
   built-in `%VAR%` HTML replacement (same mechanism used for `VITE_FIREBASE_*`, see
   `web/CLAUDE.md`'s Deployment section). A build without the var set ships a harmless empty
   `content=""` attribute.
4. Redeploy, then click "Verify" in GSC.
5. Once verified: Search Console → Sitemaps → submit `https://ssbmax.in/sitemap.xml` (already
   generated and served — Phase 3 built `scripts/generateSeoFiles.mjs` for this).
6. Note the "Indexed pages" count you see today — write it in the AI diagnostic doc's Run 1
   section or nearby, since Phase 0 confirmed there is no earlier number to compare against.

## 2. Cloudflare Web Analytics (referrer/traffic segmentation) — manual, one-time

Decided over a custom Firestore-backed pageview pipeline specifically because the actual GEO
landing pages (`/study/<slug>`, `/faq`) are genuinely static (Phase 5/6, Blocker 2) and ship no
app JS — a custom pipeline would either miss those pages entirely or require widening
`connect-src` to a Cloud Functions domain on the pages that matter most. Cloudflare Web Analytics
is cookie-less, cost-free, native to the platform already hosting this site, and needs only one
first-party CSP domain addition (`static.cloudflareinsights.com` / `cloudflareinsights.com`,
already added to `web/public/_headers` in this phase).

1. Cloudflare dashboard → your account → **Web Analytics** → Add a site → `ssbmax.in`.
2. Cloudflare gives you a beacon token. Set it as `VITE_CF_BEACON_TOKEN` in the Pages project's
   environment variables (same place as step 1.3 above).
3. Redeploy. The beacon script (`index.html` for the hydrated app, `prerenderHtml.mjs` for every
   static content/FAQ page) picks up the token automatically at build time — no further code
   change needed.
4. Traffic, page views, and **referrer breakdown** (including `chatgpt.com`, `perplexity.ai`,
   `claude.ai` as distinct referrer hosts) are visible in Cloudflare dashboard → Web Analytics,
   not rebuilt anywhere in this app. Filter by referrer host there for the AI-referral segment
   this plan cares about.

## 3. Signup counter (built, this phase — no manual step)

`functions/src/analytics/recordSignup.js` fires from `AuthService.signInWithGoogle()` whenever
Firebase Auth reports `isNewUser: true`, incrementing `analytics_daily/{yyyy-MM-dd}.signups`.
View it at `https://ssbmax.in/?tab=analytics` (admin-only — requires the `admin` custom claim,
same as `?tab=support`; see `functions/scripts/set-admin-claim.js`).

This is a raw signup count, not a computed "signup rate" — a rate needs a visitor-count
denominator, and that number lives in the Cloudflare dashboard (step 2), not in Firestore. Cross-
reference the two manually rather than trusting a fabricated single number.

## 4. AI-visibility diagnostic (manual, recurring)

See `docs/plans/ai_search_readiness_ai_diagnostic.md` — the 10-query template. Run it once now
(this becomes "Run 1 / day zero", since Phase 0 never actually ran it), then monthly.

## Exit checklist

- [ ] GSC property verified, sitemap submitted
- [ ] Cloudflare Web Analytics enabled, token set, redeployed
- [ ] `?tab=analytics` shows signup counts accumulating (verify a day or two after deploy)
- [ ] AI diagnostic Run 1 recorded in `ai_search_readiness_ai_diagnostic.md`
