# WP37 Statistics implementation report

> Historical domain implementation evidence. Final required CI, main deployment, private2.1.3/code13 delivery and owner-reported manual acceptance are recorded in [current status](STATUS.md) and [WP37 review](WP37_REVIEW.md).


Date: 2026-10-12. Implementation remains on the shared `fix/wp37-localization-native-auth-ux` branch. No commit, provider call, backend deployment, configuration change, version change, merge or release was performed by this domain agent.

## Confirmed baseline findings

- The actual Statistics screen had one page heading and one `BarChart3` icon in the monthly section. Duplicate removal was a no-op; do not describe removed duplicates in release notes.
- The backend already accepted only fact IDs, but the deterministic summary repeated total/count/average, the catalog favored isolated amounts, and every result contained generic advice.
- `categoryHighlights` existed in validated results but the screen did not render them.
- The local fallback authored English-only summaries, compared a partial/latest month directly, and invented generic stability/distribution/advice text.
- The request sanitizer discarded `period`, silently sliced month/category history at 120 months, and silently sliced categories at 40. This could make monthly comparisons contradict retained full-period totals.
- The period tablist label was hardcoded English. User descriptions did not establish their own content direction.

## Resulting behavior

`src/features/statistics/verifiedFacts.ts` is the shared deterministic catalog for server results and local fallback. EN/FR/AR templates and UI labels are exported as `statisticsCopy` and `statisticsText` from `src/features/statistics/copy.ts`.

Current Month remains descriptive. Last 3 Months compares the first and latest eligible complete calendar month. Last 6/12 Months and All Time compare averages over the earliest and latest eligible three-month windows when at least six eligible months exist. With fewer eligible months, the window is reduced to two or one months, explicitly stating the count and date ranges. Windows are equal, non-overlapping, and contiguous complete calendar months. An odd middle month is excluded from the windows. Any interior missing month suppresses the comparison. For example, May–October with partial October compares May–June against August–September; July does not enter either window. No comparison labels partial October as a decline.

New engine-generated month records distinguish `recorded` (expense or explicit budget record) from `missing` (no expense or budget record). Historical missing months are not confirmed zero spending. An explicit zero record remains eligible. Future/current calendar months are excluded from complete-month comparison. Missing or duplicate month records do not establish comparative history. Existing category rows also require adjacent, recorded complete months before showing a percentage state.

Category increases/decreases rank absolute changes in average monthly spending across the same windows, not percentage growth. Tied contributors are labeled tied. A missing category window record suppresses all category superlatives because its unknown change could be larger. Top-category shares/ranks are deterministic; ties share a rank. Peak and lowest non-zero months exclude partial/missing months, label ties, and abbreviate very long tied lists honestly. No causal reason is inferred from the records.

Zero baselines have no percentage. Nonzero baselines that round to zero in the selected currency, or overflow division, render percentage-unavailable text. Categories cannot claim a share above the supplied full-period total.

Gemini still returns exactly `observationIds` and `categoryIds`. Unknown, duplicate, wrong-section, extra-prose and oversized selections fail closed. The existing fail-closed JSON Schema matcher is preserved; unsupported schema keywords were not introduced. Validation enforces at most three selected facts globally, plus one deterministic summary and an optional verified takeaway. The takeaway appears only if a selected increase contributor supports review of an overall recorded increase. Otherwise it is the compatible empty string. No filler is generated. New clients normalize older results to the same global display cap and omit the old deterministic generic advice in all three languages.

All-Time detailed month cards initially show the latest six in chronological order when more than six exist. Localized controls reveal every month or collapse again; selecting any period resets expansion. Totals, averages, category calculations, largest-expense ranking, full-period bar chart, and the Statistics AI request retain the full `stats`. A compact full-period chart remains visible while details are collapsed, with first/last dates and each month amount in its title. Non-All-Time periods show all their detailed month cards.

Statistics renders category highlights, applies `dir="auto"` plus bidi isolation to descriptions/result strings/category text, and localizes the tablist label. The coordinator's indigo progress tone/error interface is integrated. Duplicate error text is suppressed when the progress panel owns the error state.

## Compatibility and deployment order

- Old client/new backend: request `period` and `dataAvailability` remain optional. Period-less requests use conservative one-month comparison rules; a supplied complete month is treated as recorded, while an omitted month is never inferred to be zero. Existing WP36 `trend-*` IDs are retained for this legacy catalog. Response keys and the string-valued `recommendation` remain unchanged, so the old parser accepts results. An old client still lacks the new category/disclosure UI.
- New client/old backend: added request metadata is ignored by the old sanitizer. The new parser accepts the existing response shape and optional future recommendation, deduplicates/caps displayed facts, and drops known old filler. Old-backend raw-total summaries and its 120-month truncation persist until that backend is updated; the new client does not pretend those server improvements are present.
- Preferred future order: backend first, then client. Both combinations preserve their JSON contract; backend-first avoids shipping full-history client requests to a backend that silently truncates them. No deployment is authorized or performed here.
- Accepted histories are retained whole up to 600 months (50 years); category count retains the existing bound of 40. Category month histories share the 600-month limit. Above either bound the request returns existing `INVALID_REQUEST`, rather than selecting a truncated financial history. This extends the old ten-year accepted range for realistic All-Time histories while retaining finite processing/prompt bounds. Existing body-size, ingress deadline, auth/readiness, cancellation, retry and provider-runtime middleware remain unchanged. The deterministic local fallback still receives the full client statistics if a server rejects an oversized request.

## Executed verification

Runtime: `C:\Users\Administrator\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe` (`v22.23.3`). Commands ran from the repository root.

1. RED: `node22 node_modules/tsx/dist/cli.mjs --test tests/wp37-statistics.test.ts` initially showed **11 expected failures / 12 tests**: raw-total summaries, absent window/contributor/extrema facts, generic advice, discarded period/missing metadata, 120-month truncation, and English fallback. One missing/zero safety check was already green. A malformed illustrative month key in the test fixture was corrected before the GREEN run.
2. Additional observed RED cycles covered optional-takeaway/legacy compaction, sparse category rows, oversized requests, tiny financial baselines, and category-superlative uncertainty. Each failed for the intended missing behavior, then passed after its narrow change.
3. UI RED was executed by the coordinator from the unique `tests/e2e/components/wp37-statistics.spec.ts`: EN failed on absent month-detail markers; FR/AR failed on the untranslated tablist label. Evidence: `.superpowers/wp37/statistics-ui-red.log`. The coordinator confirmed this run observed the baseline UI before the screen edits.
4. Final focused command:

```powershell
& 'C:/Users/Administrator/AppData/Local/npm-cache/_npx/52027bd8fc0022aa/node_modules/node/bin/node.exe' node_modules/tsx/dist/cli.mjs --test tests/wp37-statistics.test.ts tests/wp36-statistics-quality.test.ts tests/wp36-spending-quality.test.ts tests/wp36-extraction-safety.test.ts tests/wp36-routing-matrix.test.ts tests/wp35-result-validation.test.ts tests/wp21-statistics-density.test.ts tests/wp22-statistics-category-ranking.test.ts
```

Result after the independent-review correction below: **74 passed, 0 failed**, including all 22 new Statistics tests, unchanged WP36 ID-only numeric gates, routing/retry matrix, and existing Statistics density/ranking tests.

5. `node22 node_modules/typescript/bin/tsc --noEmit`: **passed** after the final implementation changes.
6. `git diff --check`: **passed**; Git emitted only its normal LF/CRLF working-copy warnings.
7. An earlier broader focused command included `tests/wp36-deployment-diagnostics.test.ts`: **68 passed / 69**, with the single failure `health exposes only a sanitized short runtime commit and preserves its contract` reporting `TypeError: fetch failed` for its in-process localhost listener. This domain did not change health handling. The coordinator owns normal-context/full-suite diagnosis and rerun; this report does not claim that check passed here.

The browser spec exercises 3/6/12-month filters, latest-six ordering, expand/collapse/reset, 36-month totals/categories/chart/request payload, category result rendering, localized tablist names, and content isolation in EN/FR/AR. It uses synthetic readiness/auth/backend responses and never a live provider. GREEN browser results and final full-suite results belong to coordinator integration evidence; this agent did not start Playwright servers or run the full suite independently.

## Independent-review correction

The reviewer correctly identified that period-less compatibility facts `trend-${index}` used the overall comparison wording while their values belonged to an individual category. In a dataset where Food rises from $10 to $30 while total spending falls from $100 to $80, that legacy row could incorrectly read as an overall spending increase. Three EN/FR/AR regression tests were written and observed RED on the missing category name. A dedicated deterministic localized `categoryComparison` template now explicitly identifies the category, retaining the same legacy fact IDs, amounts, percentages, complete-month ranges, and ID-only validation. The overall summary still describes the true total decrease. The focused command above then passed **74/74**, TypeScript passed, and the changed-file diff check passed. The localized copy key/interpolation parity test includes the new category template.

## Limitations and remaining acceptance

- The app cannot establish that an unrecorded month had no real-world spending. Such history is explicitly missing and comparative claims are omitted conservatively.
- Existing clients lack the new explicit missing-month metadata; compatibility assumes their supplied month entries represent recorded periods, while gaps are still excluded.
- The comparison intentionally uses first/last equal windows rather than fitting a slope or claiming a continuous monotonic trend. The exact ranges are always displayed.
- Provider-selected ordering can vary, while amounts/text and the mandatory comparative summary remain deterministic and capped. Runtime routing/retry behavior was untouched.
- No physical phone, OEM rendering, large-text manual acceptance, live Gemini quality run, APK build or deployed backend was verified by this domain agent. Coordinator integration and the manual device checklist remain authoritative.
