# shared/ai/CLAUDE.md — Gemini AI Integration

**Scope:** the one AI path in this app, `shared/src/commonMain/kotlin/com/ssbmax/shared/ai/`. Inherits the root [claude.md](../../claude.md).

Replaces `core/data/ai/CLAUDE.md`, deleted with the package it documented in the KMP-convergence plan's Phase 9.0. That file's guidance was Hilt-era and built on `com.google.ai.client.generativeai` — both removed from this repo. **Do not reintroduce either.**

---

## The shape

```
GeminiClient (interface, shared/ai/)     "send a prompt (+ image) to Gemini, get text back"
  ↑ implemented by
GeminiProxyClient (data-firebase)        calls the geminiGenerateContent Cloud Function via
                                          GitLive's Firebase Functions httpsCallable
  ↑ consumed by
KtorAIService         the AIService implementation (12 methods) — SSOT, both platforms
  ├── KtorPPDTAnalyzer / KtorTATStoryAnalyzer   multimodal (image + story) calls
  ├── prompts/                                  the prompt corpus
  └── KtorGeminiResponseParser                  kotlinx.serialization, 3 response shapes
```

`AIService` (the interface) lives in `shared/domain/service/`. `KtorAIService` is its only implementation; `coreInfraModule` binds `KtorAIService`/`KtorPPDTAnalyzer`/`KtorTATStoryAnalyzer`, but **not** `GeminiClient` — that binding lives in `data-firebase`'s `repositoryModule` (see below). There is no Android-specific and no cloud-backed variant of `AIService` itself — `core:data`'s `GeminiAIService`/`CloudGeminiAIService` were deleted in Phase 9.0.

## API key — never on the client, not even via Koin property

There used to be a raw `KtorGeminiClient` here calling `generativelanguage.googleapis.com` directly, with the API key delivered as a Koin property from `BuildConfig`/`Info.plist` — that shipped the key inside the app binary, extractable from any built APK/IPA. **Fixed**: `shared` no longer holds a Gemini API key at all, in any form. Calls go through `geminiGenerateContent` (`functions/src/geminiProxy.js`), authenticated by the caller's Firebase Auth ID token (attached automatically by GitLive's `httpsCallable`, the same mechanism `GitLiveTestUsageRecorder` already relies on). The key lives only in that Cloud Function's environment.

This is also why `GeminiClient`'s implementation (`GeminiProxyClient`) lives in `data-firebase`, not here — it depends on GitLive's Firebase Functions client, which `shared` may not import (see `data-firebase`'s own module doc for why: `shared`'s Kotlin/Native test binaries must link without CocoaPods). `shared/ai/` only ever sees the `GeminiClient` interface.

`app/src/test/kotlin/com/ssbmax/architecture/GeminiKeyNotInClientTest.kt` is the regression guard — it asserts `GEMINI_API_KEY` never reappears in `BuildConfig`/`Info.plist`. Keep it green; don't "fix" a broken AI call by re-adding the key client-side.

## Determinism

`temperature = 0.0` on every call — a candidate re-submitting the same story must get the same OLQ profile. Asserted in `KtorAIServiceTest`; don't "tune" it.

## Token tiers

One client instance, `maxOutputTokens` per call site (the REST call is stateless per request, unlike the old SDK which baked config into the model object):

| Tier | Tokens | Timeout | Used by |
|---|---|---|---|
| 1 — single item | 8192 | 60s | TAT per-story, PPDT, WAT, SD, interview response |
| 2 — multi-item / growing context | 12288 | 90s | SRT (60 situations), interview + adaptive Q-gen |
| 3 — full-transcript synthesis | 16384 | 120s | TAT synthesis, interview feedback |

## Prompts

`prompts/` is the corpus: `GTOAnalysisPrompts`, `PsychologyTestPrompts`, `SSBInterviewPrompts`, `PPDTPrompts`, `TATStoryAnalysisPrompts`, `TATSynthesisPrompts`. Callers that build their own prompt string pass it to `analyzeGTOResponse`/`analyzeWATResponse`/etc.; the multimodal methods build theirs internally.

These files are the recorded exemption to the 300-line rule (see each file's own class doc) — a prompt corpus is data, and splitting it hurts reviewability. That exemption covers **nothing else** in this package.

Prompt content changes are behaviour changes: the rule-content tests (`PPDTPromptsTest`, `TATStoryPromptRulesTest` in `commonTest`) pin the rubric fragments Gemini's scoring depends on.

## Response parsing

`KtorGeminiResponseParser` handles the three shapes Gemini actually emits, all observed in production:

1. `parseAnalysisResponse` — object with an `olqScores` **array** (interview response analysis)
2. `parseGTOAnalysisResponse` — object with an `olqScores` **map**, *or* a bare array; also carries `notRecommended` (the R14 hard stop)
3. `parseQuestionResponse` — JSON array of question objects

Unrecognised OLQ names are dropped, not fatal; an empty result after filtering is a `Result.failure`, never a half-populated `ResponseAnalysis`. Everything returns `Result<T>` — nothing throws past the parser boundary, because the callers are background workers whose retry logic depends on a failed `Result`.

## Retry / orchestration is not here

Retry, backoff, OLQ clamping and fill-missing live in `shared/analysis/` (`AnalysisRetry`, `RetryBackoffPolicy`, the seven `*AnalysisOrchestrator`s) — Phase 8's work. Don't add a retry loop to a call site; use those.
