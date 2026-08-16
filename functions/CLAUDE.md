# functions/CLAUDE.md — Firebase Cloud Functions

**Scope:** Node.js/TypeScript Firebase Cloud Functions for backend logic. This file specializes [claude.md](../claude.md) for the functions module—where backend computation and AI evaluation happens.

**Core Principle:** Cloud Functions are state-less, event-driven, and secure. Authentication checks FIRST. Firestore rules are SSOT for data access. Gemini API calls for evaluation only.

---

## Security: Authentication & Authorization (First Line of Defense)

**Pattern: Verify User Before Processing**
```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Callable function with user authentication
exports.analyzeInterviewResponse = functions.https.onCall(
  async (data, context) => {
    // 1. Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }
    
    const userId = context.auth.uid;
    
    // 2. Verify user exists in Firestore (optional but recommended)
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "User document not found"
      );
    }
    
    // 3. Check subscription/permission (Firestore rules handle this too)
    const userTier = userDoc.data()?.subscriptionTier;
    if (userTier !== "PREMIUM") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Premium subscription required"
      );
    }
    
    // 4. Now safe to process
    const result = await processData(data, userId);
    return { success: true, result };
  }
);

// Admin function (only callable from admin SDK, not from client)
exports.batchProcessData = functions.https.onCall(async (data, context) => {
  // Only Cloud Functions can call this (used in batch scripts)
  return {};
});
```

**Error Codes:**
- `"unauthenticated"` — User not logged in
- `"permission-denied"` — User lacks permission
- `"failed-precondition"` — Resource not in expected state
- `"invalid-argument"` — Bad input
- `"internal"` — Server error

**Firestore Security Rules (SSOT for access control):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Interviews are premium-only
    match /interviews/{interviewId} {
      allow read: if request.auth.uid != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscriptionTier == "PREMIUM";
      allow create: if request.auth.uid == request.resource.data.userId &&
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscriptionTier == "PREMIUM";
      allow update, delete: if request.auth.uid == resource.data.userId &&
                               get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscriptionTier == "PREMIUM";
    }
  }
}
```

---

## Tier-2 Evaluation SSOT: `evaluation/` (the real pattern — read this before the generic example below)

`functions/src/evaluation/` is the actual, current Tier-2 AI-evaluation architecture (Web SSB Test Flow Parity + Centralized Tier-2 Evaluation SSOT plan). The generic "Gemini AI Integration" pattern further down this file predates it and is kept only as a bare-Cloud-Functions teaching example — do not model a new evaluation type off it; extend the pattern here instead.

**Shape:** one shared dispatcher, thin per-type wrappers.
- `core.js` — `runEvaluation({ testType, submissionId, uid, buildPrompt, parseAndValidate, resultCollection })` owns every cross-cutting concern exactly once: auth check, ownership check (`submissions/{id}.userId === uid`), status guard (`PENDING_ANALYSIS` only — idempotent if called again), **server-side quota/eligibility re-check** against `users/{uid}/subscription/usage_{yyyy-MM}` (rejects `FAILED_PRECONDITION` over quota — this is what actually stops a client from calling an `evaluate*` callable directly and getting free Gemini evaluations regardless of tier), flip to `ANALYZING`, retry-wrapped Gemini call, result-doc write, status flip to `COMPLETED`/`FAILED`.
- `olqPrompts.js`, `retry.js`, `validation.js`, `responseParser.js`, `geminiClient.js` — pure-function helpers `core.js` composes.
- `ppdtEvaluate.js`, `tatEvaluate.js`, `watEvaluate.js`, `srtEvaluate.js`, `sdEvaluate.js`, `gtoEvaluate.js`, `interviewEvaluate.js` — one `https.onCall` per type, each taking only `{ submissionId }` (the function fetches the submission itself server-side — a client can't forge a payload). Each is a ~20-line wrapper supplying only its `buildPrompt`/`parseAndValidate` to `core.js::runEvaluation`. **Adding a new evaluation type or fixing a quota/retry/auth bug means changing `core.js` once, not seven files.**

**SSRF guard:** `buildPrompt` for PPDT/TAT/GTO must resolve the image itself server-side from the submission's stored `questionId`/`batchId` against the known `test_content` Storage bucket. Never fetch a URL field read directly off the client-writable submission document — that's a live SSRF vector server-side (lower stakes on KMP's legacy client-side path since it's the user's own device).

**TAT parallelization:** `tatEvaluate.js` runs its 12 per-story Gemini calls via `Promise.all` with a concurrency cap (~4-6, to stay under Gemini per-project QPS), then runs synthesis once after all stories resolve — not a sequential loop (worst case ~40 calls serially would blow past Cloud Functions' 9-minute ceiling). `timeoutSeconds: 540, memory: '512MB'` on this function only; other `evaluate*` functions stay at default 60s/256MB.

**`evaluateOIR` doesn't exist** — `oirScoring.js::evaluateOIRAnswers` (pre-existing, now wired into both clients) is OIR's server-side path; it predates and sits outside the `core.js` dispatcher pattern since OIR is objective scoring, not Gemini evaluation.

**`geminiProxy.js` is legacy but still live — do not delete it.** It's the passthrough `httpsCallable` KMP's un-cut-over legacy client-side orchestrators (`shared/.../analysis/*Orchestrator.kt`) still call directly for WAT/SRT/SD/Interview/GTO/PPDT/TAT (all "Shipped" behind a feature flag, not yet "Cutover" — see root `CLAUDE.md`). It has its own per-user hourly abuse cap since, unlike `evaluate*`, it accepts an arbitrary prompt from the client. It becomes deletable only once every type's Cutover lands and `grep -rn geminiProxy shared/ data-firebase/` returns nothing.

---

## Gemini AI Integration (for Evaluation)

**Pattern: Structured Prompt + JSON Response**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const evaluateInterviewResponse = functions.https.onCall(
  async (data, context) => {
    const { questionText, userResponse } = data;
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // Structured prompt for consistent JSON output
      const prompt = `You are an expert SSB interview evaluator. 
      
Question: ${questionText}
User Response: ${userResponse}

Provide evaluation in this exact JSON format:
{
  "score": 1-10,
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "comments": "Brief feedback"
}

IMPORTANT: Respond ONLY with valid JSON, no markdown or extra text.`;
      
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      // Parse JSON (with error handling)
      const evaluation = JSON.parse(text);
      
      // Validate structure
      if (!evaluation.score || !evaluation.strengths || !evaluation.improvements) {
        throw new Error("Invalid evaluation structure");
      }
      
      // Store in Firestore
      await admin
        .firestore()
        .collection("interviews")
        .doc(context.auth!.uid)
        .collection("responses")
        .add({
          questionText,
          userResponse,
          evaluation,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          model: "gemini-2.0-flash"
        });
      
      return { success: true, evaluation };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to evaluate response"
      );
    }
  }
);
```

**Rate Limiting (Important for Gemini API quota):**
```typescript
import * as rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: "Too many requests, please try again later"
});

exports.evaluateResponse = functions.https.onRequest(limiter, (req, res) => {
  // Rate-limited endpoint
});
```

---

## Firestore Transactions (Atomic Operations)

**Pattern: Multiple Reads + Writes in One Transaction**
```typescript
export const submitTestResult = functions.https.onCall(async (data, context) => {
  const { testId, answers, timeSpent } = data;
  const userId = context.auth!.uid;
  
  const db = admin.firestore();
  
  // Atomic operation: verify + update in single transaction
  const result = await db.runTransaction(async (transaction) => {
    // 1. Read user subscription status
    const userRef = db.collection("users").doc(userId);
    const userDoc = await transaction.get(userRef);
    
    if (!userDoc.data()?.subscriptionTier) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Subscription required"
      );
    }
    
    // 2. Read test metadata
    const testRef = db.collection("tests").doc(testId);
    const testDoc = await transaction.get(testRef);
    
    if (!testDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Test not found"
      );
    }
    
    // 3. Score answers (business logic)
    const score = scoreAnswers(answers, testDoc.data()!.correctAnswers);
    
    // 4. Update user stats + create result (atomic)
    const resultRef = db.collection("results").doc();
    
    transaction.update(userRef, {
      testsCompleted: admin.firestore.FieldValue.increment(1),
      lastTestDate: admin.firestore.FieldValue.serverTimestamp()
    });
    
    transaction.set(resultRef, {
      userId,
      testId,
      score,
      timeSpent,
      answers,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { resultId: resultRef.id, score };
  });
  
  return result;
});
```

**Why Transactions:**
- ✅ All-or-nothing: if one fails, all rollback
- ✅ No partial updates
- ✅ Automatic conflict resolution

---

## Firestore Batch Operations (Multiple Writes, Not Transactional)

**Pattern: Bulk Insert/Update (up to 500 documents)**
```typescript
export const batchUploadQuestions = functions.https.onCall(async (data) => {
  const { questions } = data; // Array of question objects
  
  const db = admin.firestore();
  const batch = db.batch();
  
  let count = 0;
  for (const question of questions) {
    const ref = db
      .collection("questions")
      .doc(question.id);
    
    batch.set(ref, {
      ...question,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    count++;
    
    // Firestore batch limit: 500 writes per batch
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  return { uploaded: count };
});
```

---

## Environment Variables (Secrets Management)

**Local Development (.env):**
```bash
# .env (NOT committed to git)
GEMINI_API_KEY=your_gemini_key_here
SARVAM_API_KEY=your_sarvam_key_here
```

**Firebase Console (Production):**
```bash
# Set via Firebase CLI
firebase functions:config:set gemini.api_key="your_key_here"

# In code:
const apiKey = functions.config().gemini.api_key;
```

**Or via Firestore Security Rules (read from restricted collection):**
```typescript
// collections/config/keys (read-restricted)
const apiKey = await db.collection("config").doc("keys").get();
// Only server-side JS can read (rules block client)
```

---

## Error Handling & Logging

**Pattern:**
```typescript
exports.myFunction = functions.https.onCall(async (data, context) => {
  try {
    // Validation
    if (!data.required_field) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required field"
      );
    }
    
    // Processing
    const result = await process(data);
    
    return { success: true, result };
  } catch (error) {
    // Logging
    console.error("Function error:", {
      userId: context.auth?.uid,
      function: "myFunction",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Error response
    if (error instanceof functions.https.HttpsError) {
      throw error; // Already formatted
    }
    
    throw new functions.https.HttpsError(
      "internal",
      "Internal server error"
    );
  }
});
```

---

## Testing Cloud Functions (Emulator)

**Setup:**
```bash
firebase emulators:start --only functions,firestore
```

**Test Script (Node.js):**
```typescript
import { initializeApp } from "firebase/app";
import { connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
connectFunctionsEmulator(functions, "localhost", 5001);

const myFunction = httpsCallable(functions, "myFunction");
const result = await myFunction({ key: "value" });
console.log(result.data);
```

---

## Best Practices

1. **Fail Fast:** Validate input + auth FIRST
2. **Use Transactions:** For multiple related writes
3. **Log Everything:** userId, function name, errors
4. **Rate Limit:** Especially for expensive operations (Gemini calls)
5. **Cache When Possible:** Store results in Firestore, don't recalculate
6. **Monitor Cold Starts:** First invocation is slow (initialize on global scope)
7. **Use Scheduled Functions:** For batch processing (not triggered per-request)

---

## References

- **Root guidance:** [claude.md](../claude.md) (security principles)
- **Firestore patterns:** `shared/src/commonMain/.../data/repository/` (`GitLive*` repositories — `core:data`, which used to cover this, was deleted in the KMP-convergence plan's Phase 9f; no dedicated `shared` CLAUDE.md exists yet)
- **AI integration:** [shared/ai/CLAUDE.md](../shared/ai/CLAUDE.md)
- **Firebase Admin SDK:** https://firebase.google.com/docs/reference/admin

---

**Last Updated:** June 2026 | **Maintainer:** Sunil Pawar
