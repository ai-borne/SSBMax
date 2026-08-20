---
name: android-app-monitoring
description: Monitor a running SSBMax Android app on a connected device via adb/logcat, capture live logs for a test run, and analyze the TAT (and other psych-test) pipeline. Use when the user is taking a test on a connected Pixel/emulator and wants failures, improvements, and gold-standard verification from the logs. Covers live-capture setup (to avoid buffer eviction), log filtering by worker tag, and Firestore REST verification of persisted data.
---

# Android App Monitoring (SSBMax)

Use this skill when the user is running an SSBMax test on a connected Android device and wants you to capture and analyze the logs — typically to verify a fix, find failures, or audit a test pipeline end-to-end.

## When to use
- The user says they're taking a test and wants you to watch the logs.
- You need to verify a TAT (or WAT/SRT/SD/PPDT) pipeline fix on-device.
- You need to confirm persisted data (e.g. `TATSubmission.questions`) in Firestore.

## 1. Confirm the device

Always target a specific serial — two devices are often attached (USB + wireless), and bare `adb` errors with "more than one device/emulator".

```sh
adb devices -l
# Pick the physical Pixel serial, e.g. 4A231VDAQ0001D
adb -s <SERIAL> shell getprop ro.product.model
```

## 2. Live logcat capture (critical — avoids buffer eviction)

**Do NOT rely on `adb logcat -d` after the run.** The logcat ring buffer evicts the earliest app logs (the per-story worker lines) before you dump — this happened and hid the key evidence. Always capture live, in the background, **before** the user starts the test.

```sh
# Clear so the capture is clean
adb -s <SERIAL> logcat -c

# Start a background stream to a file (survives independently)
nohup adb -s <SERIAL> logcat > /tmp/tat_live.txt 2>&1 &
echo "started pid $!"
sleep 3
wc -l /tmp/tat_live.txt   # confirm it's growing (timestamps current)
```

Tell the user to start the test. When they finish:

```sh
kill <PID> 2>/dev/null; sleep 1
wc -l /tmp/tat_live.txt
```

## 3. Filter for the pipeline

The TAT pipeline logs under these tags (verified in code):

| Tag | What it reports |
|---|---|
| `TATStoryAnalysisWorker` | Per-story: `Step 1: Image bytes prepared (NNNN bytes)`, `Step 2: AI analysis complete — 15/15 OLQs`, `✅ complete in Xms (story N)` |
| `TATSynthesisWorker` | `N total assessments, N valid`, prompt length, `SSB validation — <RECOMMENDED/NOT_RECOMMENDED>, limitations: N`, `🎉 complete in Xms` |
| `TATAnalysisPipelineOrchestrator` | Sets `ANALYZING`, enqueues the bounded-batch chain |
| `TATAnalysisWorkPlanner` | Batches story requests (BATCH_SIZE = 3) |
| `TATTestViewModel` | Test load, eligibility, submit, timers |
| `GetOLQDashboard` | Result fetchability, cache invalidation |
| `ErrorLogger` (inferred tag) | `ErrorLogger.log(...)` failures/retries/placeholders |

Filter commands (grep the live file, not the project):

```sh
grep -nE "TATStoryAnalysisWorker|TATSynthesisWorker|TATAnalysisPipelineOrchestrator|TATTestViewModel|TATAnalysisWorkPlanner|GetOLQDashboard" /tmp/tat_live.txt
grep -nE "Step 1: Image bytes prepared" /tmp/tat_live.txt
grep -nE "❌|⚠️|retry|placeholder|FAILED|image download failed" /tmp/tat_live.txt | grep -iE "TAT|story|synthesis"
```

## 4. Key signals to check

- **Image bytes**: `Step 1: Image bytes prepared (NNNN bytes)` must be `NNNN > 0` for stories 1–11. Story 12 is the blank card — `0 bytes` there is **by design**. All-zero bytes = the "0-bytes image bug" (analysis ran text-only).
- **12/12 stories** succeed with 15/15 OLQs each; **no retries/placeholders**.
- **Synthesis** runs with N valid assessments, `RECOMMENDED`/`NOT_RECOMMENDED` (the latter is correct SSB validation, not a bug).
- **Finalize** atomic contract: `OLQ result finalized in Firestore` → dashboard cache invalidated.
- **WorkManager chain**: bounded batches of 3, all `SUCCESS`.

## 5. Verify persisted data via Firestore REST (optional)

When the logcat can't confirm something (e.g. whether `TATSubmission.questions` was persisted), query Firestore directly. The Firebase CLI is authenticated; project is `ssbmax-49e68`.

```sh
# Get an access token from the CLI's stored refresh token
TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=<CLIENT_ID>" -d "client_secret=<CLIENT_SECRET>" \
  -d "refresh_token=<REFRESH_TOKEN>" -d "grant_type=refresh_token" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Read a submission document
curl -s "https://firestore.googleapis.com/v1/projects/ssbmax-49e68/databases/(default)/documents/submissions/<SUBMISSION_ID>" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

The CLI credentials live at `~/.config/firebase/mail_sunilpawar_gmail.com_application_default_credentials.json` (authorized_user: `client_id`, `client_secret`, `refresh_token`). Read them with `cat` (they're outside the project, so `read_file` won't work).

## 6. Report format

Give a concise verdict table (stage → result), flag the critical issue(s) with root cause, and separate **confirmed-fixed** from **still-broken** from **expected behavior**. Reference the relevant `TAT_Pipeline.md` sections (§12 Firestore model, §19 Known Issues, Architecture Principles) when explaining architecture.