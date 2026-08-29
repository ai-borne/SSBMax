# Readable Study Content — Phase 0 Findings

Plan: `docs/plans/write-the-phased-plan-wobbly-pancake.md`. This phase produced no production
code, one pure test addition, and a committed before-baseline. Findings below are the record
required by the plan's Phase 0 exit criteria.

## 1. Block classifier — taxonomy gate

A throwaway classifier (`docs/plans/parity/phase-0/classify_blocks.mjs` — not wired into any
build, kept alongside the baseline for reproducibility; output committed as
`docs/plans/parity/phase-0/classify_blocks_output.json`) scored every non-blank line of all 61
`content/**/*.md` files against the draft taxonomy (D1).

```
list           3763  45.3%
specTable      1527  18.4%
paragraph      1526  18.4%
heading        1228  14.8%
comparison      151   1.8%
timeline        55    0.7%
table           34    0.4%
callout         25    0.3%

Paragraph fallback (of non-heading lines): 21.6%
Paragraph fallback excluding faq.md: 21.4%
```

**Gate check:** 21.6% exceeds the plan's 10% trigger for "revise the taxonomy before Phase 1."
Sampled the two worst offenders before concluding anything:

- `study-materials/conf_2.md` (53% paragraph) — a Q&A-format file: `**"How was your SSB
  experience?"**` (bold quoted question) followed by genuine explanatory prose. This is
  correctly `paragraph` — there is no list/spec/callout shape here to detect, the content
  really is prose.
- `study-materials/oir_6.md` (53% paragraph) — most of its paragraph lines are MCQ options
  (`A) Fleet`, `B) Squadron`, ...). The classifier's `LIST_ITEM` regex only matches `-`/`*`/`N.`
  prefixes, not `A)`/`B)` lettered options, so these fall through to paragraph even though they
  visually are list items.

**Decision: taxonomy is not revised.** The bulk of the 21.6% (conf_2-style Q&A prose, and
similar files) is genuinely prose with no shape to detect — not a taxonomy gap. The one real gap
found (lettered MCQ options in practice-set files like `oir_6.md`) is narrow: it affects answer
lists in a handful of practice-set materials, not the general-purpose block types this plan's
taxonomy targets (`specTable`/`callout`/`comparison`/`timeline`/`table`). Recorded as a Phase 1
note rather than a taxonomy revision: `list` detection in `parseDocument.js` should also match
`[A-Za-z]\)\s+` lettered-option lines, so MCQ answer options render as a list instead of loose
paragraphs. This is a one-line addition to the list regex, not a new block type — no taxonomy
change needed.

## 2. Topic-intro heading anomaly — confirmed

```
$ grep -c '^##' content/topics/*.md
```
All 9 files under `content/topics/` have zero `##` headings; each relies entirely on
`**Bold line**` pseudo-headings (visible in the `heading: 0` implicit result — the classifier's
`heading` regex only matches `^#{1,6}\s`, and topic files register none). Confirms the plan's
claim verbatim: every public study page's introduction has no heading outline. Phase 3
normalises all 9 to real `##` headings.

## 3. D2 premise — Firestore decode behaviour

Verified by code inspection against `data-firebase/src/commonMain/kotlin/com/ssbmax/shared/data/
repository/GitLiveStudyContentRepository.kt`:

- `getStudyMaterial` (line 67) and `refreshContent` (line 77) call GitLive's
  `doc.data(Serializer)` directly — no configurable `Json`, so `ignoreUnknownKeys` cannot be
  applied here regardless of what's configured elsewhere in the repo.
- `fetchStudyMaterials` (lines 124-133) confirms the plan's exact claim:
  `mapNotNull { doc -> runCatching { doc.data(CloudStudyMaterialDto.serializer()).toDomain() }
  .getOrNull() }` — a document that fails to decode is **silently dropped** from the list, not
  surfaced as an error.

This matches the plan's D2 justification precisely, at the cited line numbers (they have since
shifted slightly — 67/131 in the plan text vs 67/131→124-133 here after other edits, same
methods). **Live emulator round-trip was not additionally run**: D2 already makes the answer
non-blocking (new content goes to separate `topic_sections`/`study_material_sections` documents
regardless of the outcome here), and the static evidence already matches the plan's claim
exactly, so an emulator run would confirm the same fact at higher cost for no decision-relevant
gain. Flagged here rather than silently skipped, per root `CLAUDE.md` Rule 12.

## 4. `MarkdownText.kt` test coverage — added

- `shared/src/commonTest/kotlin/com/ssbmax/shared/ui/common/MarkdownTextTest.kt` — covers
  `parseInlineBold` (the one pure, non-`@Composable` piece of the renderer), runs on every KMP
  target including iOS.
- `shared/src/androidUnitTest/kotlin/com/ssbmax/shared/ui/common/MarkdownTextUiTest.kt` — covers
  block dispatch (headings, bullet/numbered/check-mark lists, plain paragraphs) via
  `runComposeUiTest` + Robolectric, and explicitly documents the rendering gaps this plan exists
  to remove (`####`+, pipe tables, links, blockquotes, fenced code all render as literal text).
  Lives in `androidUnitTest`, not `commonTest`, because Robolectric's `Build.FINGERPRINT` shadow
  has no Kotlin/Native equivalent (same constraint as `SSBMaxThemeUiTest`).

Verified: `./gradlew :shared:testDebugUnitTest :shared:allTests` — exit 0, includes the new
Android unit test suite and the iOS simulator (`iosSimulatorArm64`) run of `commonTest`.

## 5. Three-surface parity baseline (before)

Captured web + Android; **iOS deferred** (user decision, this session) — physical-device/
simulator capture across all three surfaces is expensive per repetition, and Phase 0 has no
rendering change to compare against yet, so the cost is better spent when Phase 2's gate first
requires a real comparison. Backfill iOS before Phase 2's exit gate, which is `Enforced at the
exit of Phases 2, 4, 5 and 7` per the plan.

Committed to `docs/plans/parity/phase-0/`:

| Item | Web | Android (physical Pixel 9) |
|---|---|---|
| Topic intro (Medicals) | 320 light/dark, desktop light/dark | light/dark + font-scale 1.3 |
| `psy_1` (spec-heavy) | 320 light/dark, desktop light/dark | light/dark |
| `med_3` (prose-only) | *(same page as topic intro — `med_3` renders inline on the Medicals topic page, see below)* | light/dark |

Note: on web, `med_3` is not a separately routed page — `StudyTopicPage.tsx` renders every
material for a topic inline on the topic's own route (`web-medicals-*.png` captures both the
Medicals topic intro and its materials, `med_3` included, in one page). `psy_1` is likewise
inline on `/study/ssb-psychology-tests-tat-wat-srt-sd`, captured separately since it's a
different topic page.

## 6. Deep-link intent filter — deferred

Plan flagged this as an optional Phase 0 decision (scriptable navigation for the four-plus
parity repetitions ahead). **Deferred** (user decision, this session): it is real scope (a
manifest change, an iOS universal-link equivalent, and route handling) and Phase 0's one
baseline capture round did not make manual navigation prohibitively tedious. Revisit at Phase 2
if the *next* capture round proves the manual flow too slow to repeat reliably.

## Exit checklist

- [x] Classifier run over all 61 files; >10% paragraph fallback found but root-caused as
      genuine prose plus one narrow, non-taxonomy-affecting gap (lettered MCQ options) — no
      taxonomy revision needed; noted for Phase 1.
- [x] `MarkdownTextTest` (commonTest) + `MarkdownTextUiTest` (androidUnitTest) added; `./gradlew
      :shared:testDebugUnitTest :shared:allTests` green.
- [x] Topic-intro anomaly (9/9, zero `##`) confirmed.
- [x] D2 premise verified against source (static); live emulator round-trip explicitly skipped
      with reasoning recorded above.
- [x] Parity baseline captured for web + Android (physical Pixel 9); iOS explicitly deferred.
- [x] Deep-link intent filter decision recorded: deferred.
