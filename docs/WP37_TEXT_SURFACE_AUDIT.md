# WP37 targeted text, RTL and accessibility audit

> Historical domain implementation evidence. Final required CI, main deployment, private2.1.3/code13 delivery and owner-reported manual acceptance are recorded in [current status](STATUS.md) and [WP37 review](WP37_REVIEW.md).


Scope: current source against WP36 baseline `269ddfaa7c9707c2d95739be5e3ddfc6fb726fc1`. Findings were inspected before changes.

| Surface | Finding and disposition | Automated evidence |
| --- | --- | --- |
| Dictionaries | Main EN/FR/AR keys already agree; preserve working wording. Add key/interpolation parity for eleven main/feature objects, including native recovery and API limitations. | `tests/wp37-localization.test.ts` |
| Native prompt | Duplicated English unlock title/reason replaced with semantic actions mapped to distinct EN/FR/AR copy. OEM strings remain platform controlled. | WP37 auth and native gate tests; owner manual checks green; exhaustive OEM/API/TalkBack coverage unverified |
| Startup failure | Hardcoded English replaced with standalone localized screen independent of storage initialization. | `tests/wp37-startup.test.ts` |
| Statistics accessibility | Time Period tablist label localized. Other inspected labels/placeholders use main or feature copy; numeric placeholders and empty decorative image alt retained. | WP37 Statistics browser and existing accessibility suites |
| AI Insights empty analysis | Independent review found baseline hardcoded English empty-ledger/month errors. Both now use localized copy; month interpolation follows the selected app language. | Real screen/hook browser regression: FR/AR4 meaningful RED, EN2 retained passes, final6/6 GREEN without provider requests |
| History/Home descriptions | Inherited UI direction caused wrong-side truncation. Content now uses `dir=auto`, plaintext bidi and start alignment. | WP37 localization browser spec |
| Expense details/input | Description and note adapt independently without language detection or stored-text rewrites. | WP37 localization browser spec |
| Statistics descriptions | Summary/ranked rows use `dir=auto` with isolation. Translated category chrome remains separate. | WP37 Statistics browser spec |
| Media Library | Thumbnail, preview title and linked expense isolate user content. | Real stored photo/expense fixture in WP37 browser spec |
| Smart Capture/Receipt | Extracted merchant/description isolate content; amount/date direction retained. | Feature browser regressions and source inspection |
| Legal Back | Arabic Close glyph with Back semantics changed to right arrow, preserving action/name. | WP37 localization and existing legal browser specs |
| Other RTL chrome | Existing AppTopBar, Settings, History swipe/FAB, Statistics controls and forms retained; no blanket icon mirroring. | Existing component/browser/layout/accessibility suites |
| Progress/French | Shared contextual tones, thin active line, restrained actions, single error and RTL reduced-motion specificity. | Feature x locale x light/dark browser cases and narrow components |
| Backup | Localized Replace-only preference checkbox OFF by default; bounded scrollable dialogs. | WP37 backup browser and existing dialog tests |
| Duplicate Statistics headings | Baseline already has one page title and one monthly section icon. No removal needed. | Source audit and density tests |

Browser evidence covers content direction, actual overflow/ellipsis CSS, wrapping and control behavior. Exact font-dependent truncation, TalkBack pronunciation, physical Android rendering and OEM prompt presentation remain manual acceptance items.
