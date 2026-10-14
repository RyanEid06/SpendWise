# SpendWise roadmap

Updated **2026-10-14**. [Current status and proof](STATUS.md).

| Work | State | Result / next action |
| --- | --- | --- |
| Delivered foundation through WP34 | COMPLETE / GREEN | Existing expense, budget, History, Statistics, media, encryption, backup, localization and release work retained in the accepted build |
| WP35.1 | COMPLETE / GREEN | Bounded backend readiness, auth recovery and durable PostgreSQL installation identities |
| WP35.2 | COMPLETE / GREEN | Shared AI budgets, transient retry, cancellation, response validation and safe diagnostics |
| WP35.3 | COMPLETE / GREEN | Observable AI progress, preserved drafts and Android editor safe-area/keyboard handling |
| WP36 | COMPLETE / GREEN | Qualified task routes, deterministic financial facts, backend version visibility and optional localized descriptions; CI, deployment and owner phone sign-off complete |
| WP37 | AUTOMATED DELIVERY VERIFIED | Code/required CI passed, main merged, private2.1.3/code13 independently verified; owner manual checks green; exhaustive OEM/API/TalkBack unverified |
| WP38 | AUTOMATED PRIVATE DELIVERY VERIFIED / OWNER-PENDING | Minimal Android authentication, Arabic lock UX and Gemini reliability fixes; permanent-signed2.1.4/code14, exact-source CI and [independent APK receipt](WP38_PRIVATE_APK.md) passed. [Plan](WP38_PLAN.md), [progress](WP38_PROGRESS.md), [owner phone/Render handoff](WP38_DEVICE_ACCEPTANCE.md). No merge/deployment/public release authorization |
| Next WP | UPCOMING / UNSPECIFIED | No work beyond WP38 is authorized |
| Historical WP37 main integration / deployment | MAIN MERGED / RUNTIME VERIFIED | Main9045c699, matching live health/source and two bounded authenticated compatibility checks; owner screenshots confirm main / After CI Checks Pass. Render deployment ID/trigger receipt not captured |
| Public release | NOT AUTHORIZED | No public tag or release is included in the WP37 checkpoint |

The historical private signed WP36 2.1.2/code12 APK was owner accepted.
Its [receipt](WP36_PRIVATE_APK.md) and [green checkpoint](STATUS.md) identify
the exact source and evidence. The [approved WP37 scope](WP37_SPEC.md) is separate
from this historical acceptance. The owner authorized the specific main/private
APK/deployment sequence above. Publication, a new paid service and unrelated
changes remain outside this checkpoint.
