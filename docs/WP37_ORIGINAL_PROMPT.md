Wp37 prompt: # SPENDWISE — WP37 FINAL
# LOCALIZATION, NATIVE AUTH, RTL, BACKUP, AI UX & STATISTICS HARDENING

You are working on the latest approved SpendWise source after WP36.

The previously inspected WP36 application baseline reported:

- versionName: 2.1.2
- versionCode: 12

Do not blindly trust those values or any branch name in this prompt.

Before modifying anything:

1. Identify the exact current Git branch and commit.
2. Confirm WP36 is present.
3. Check for uncommitted user work.
4. Inspect the current implementation before treating any finding below as fact.
5. Create a dedicated branch from the correct latest integration baseline:

fix/wp37-localization-native-auth-ux

Do not overwrite uncommitted work.

Do not merge until:

- implementation is complete,
- relevant tests/builds/CI are green,
- the final report is reviewed,
- explicit user approval is given.

==================================================
MISSION
==================================================

WP37 is a focused final hardening and polish package covering:

- English / French / Arabic localization.
- Arabic RTL correctness.
- mixed-direction user-generated text.
- native Android biometric/device-credential UX.
- authentication lifecycle correctness.
- remaining lock/auth error UX.
- shared AI-operation progress presentation.
- backup/restore language and theme behavior.
- Statistics AI usefulness.
- All-Time Statistics information density.
- accessibility/localization leaks.
- regression coverage.

This is NOT:

- another Gemini reliability/model-routing work package.
- a timeout redesign.
- a Render/Neon redesign.
- a financial database redesign.
- a broad application redesign.
- a new feature-development phase.

Preserve WP36:

- Gemini reliability behavior.
- task-aware model routing.
- financial validation.
- timeout architecture.
- cancellation.
- draft recovery.
- progress-state machinery.
- optional expense-description behavior.
- backup compatibility.
- security hardening.

Use the smallest safe diff.

==================================================
PART 1 — LOCALIZATION BASELINE
==================================================

The previous source audit found the main translation dictionaries structurally healthy.

Previously observed:

- English: approximately 278 keys.
- French: approximately 278 keys.
- Arabic: approximately 278 keys.
- no missing/extra main keys.
- no interpolation-placeholder mismatches.

Revalidate against the actual current source.

Do NOT rewrite working translations just to create WP37 changes.

The objective is to:

- fix remaining concrete localization bugs,
- protect parity permanently,
- improve native authentication localization,
- harden RTL/mixed-language handling.

==================================================
PART 2 — CONFIRMED DUPLICATE NATIVE AUTH TEXT
==================================================

A real-device screenshot confirmed the original duplicate unlock report.

The underlying SpendWise LockScreen correctly displays Arabic.

Android's native authentication surface above it displays approximately:

Unlock SpendWise

Unlock SpendWise

This confirms that native authentication is receiving equivalent title and subtitle/reason text.

Fix it.

Title and subtitle must have separate purposes.

Conceptual English example:

Title:
Unlock SpendWise

Subtitle:
Confirm your identity to access your protected data.

Provide natural French and Arabic equivalents.

Do not unnecessarily repeat the application name.

==================================================
PART 3 — PROPER NATIVE AUTH PROMPT CONTRACT
==================================================

Audit the complete authentication path, including current equivalents of:

- SecureSessionService
- SecureKeyService
- AndroidSecurityAdapter
- native SpendWise Android security plugin
- every sensitive authentication callsite

Previously inspected user-visible/native strings included concepts such as:

- Unlock SpendWise
- Open protected local data
- Protect local SpendWise data
- Enable SpendWise App Lock
- Disable SpendWise App Lock
- Upgrade SpendWise App Lock
- Repair SpendWise App Lock
- Authorize SpendWise security update
- Rotate protected key material
- Authenticate to continue

Do not continue passing arbitrary free-form strings throughout the security layers.

Use a small semantic authentication-action contract.

Example semantic actions:

- unlock
- enable app lock
- disable app lock
- security configuration
- replace restore
- clear protected financial data
- plaintext export
- legacy lock upgrade
- lock repair
- open protected data
- protect local data
- secure key rotation

At the UI/native boundary map each action to:

- localized title
- localized subtitle/reason

Security behavior must NOT depend on translated strings.

==================================================
PART 4 — INTERNAL IDENTIFIERS MUST NEVER REACH USERS
==================================================

Current sensitive-operation identifiers may include internal values such as:

- disable-app-lock
- security-configuration
- replace-restore
- clear-app-data
- plaintext-export

These must never appear in native Android authentication UI.

Do not mechanically capitalize or prettify the internal identifier.

Map each to intentionally written EN/FR/AR copy.

Example:

Internal:

plaintext-export

User-facing concept:

Confirm your identity before exporting readable financial data.

==================================================
PART 5 — NATIVE AUTH LOCALIZATION
==================================================

SpendWise-controlled authentication text must support:

- English.
- French.
- Arabic.

This includes:

- title.
- subtitle/reason.
- authentication recovery explanation.
- Try fingerprint again.
- Use phone PIN/pattern/password.
- lock repair/migration messages.

Use the currently selected SpendWise language wherever technically feasible.

Android/OEM-owned strings may follow the device/system language.

Examples of system-owned text include:

- Touch fingerprint sensor.
- Use PIN.
- Use password.
- Use pattern.
- Try again.

Do NOT build fake system authentication UI simply to force the selected SpendWise language.

==================================================
PART 6 — BIOMETRIC-FIRST AUTHENTICATION
==================================================

Revalidate the current Android authenticator configuration.

The inspected implementation appeared to permit:

- strong biometric.
- Android device credential.

Known real-device behavior:

Device A:
- fingerprint available.
- numeric password available.
- Android visibly displays "Use Numeric Password".

Device B:
- fingerprint available.
- secure phone credential available.
- native prompt does not visibly expose device credential immediately.

Android/OEM controls much of the prompt presentation.

SpendWise must NOT:

- request the phone PIN itself.
- store the phone PIN.
- validate the phone PIN.
- create a custom Android credential replacement.

Desired normal flow:

Strong biometric available
→ biometric/fingerprint first
→ success
→ unlock

Do not force users to choose between fingerprint and PIN every time the application opens.

==================================================
PART 7 — BIOMETRIC FAILURE / CREDENTIAL RECOVERY
==================================================

One ordinary failed fingerprint read should NOT immediately force device credential.

A failed read may result from:

- wet finger.
- poor angle.
- partial contact.
- dirty sensor.
- ordinary biometric noise.

Allow a reasonable native retry experience.

If biometric repeatedly fails or becomes:

- temporarily locked out,
- permanently unavailable,
- hardware unavailable,

and secure Android device credential exists:

provide a clean recovery path to Android's own:

- PIN.
- pattern.
- password.

If Android already exposes a usable credential fallback natively, use it.

If an OEM/API combination does not expose it, investigate the safest supported credential-only recovery flow.

Do not introduce insecure compatibility hacks.

==================================================
PART 8 — CANCELLATION
==================================================

Cancellation is NOT failed authentication.

If the user explicitly cancels:

- stop authentication.
- remain locked.
- do not automatically throw a PIN screen at them.

The SpendWise lock screen may then expose restrained actions such as:

Try fingerprint again

Use phone PIN, pattern, or password

where supported.

==================================================
PART 9 — AUTH CAPABILITY STATES
==================================================

Correctly distinguish:

1. Strong biometric + device credential.
2. Strong biometric only.
3. Device credential only.
4. Neither.
5. Temporary biometric lockout.
6. Permanent/unrecoverable biometric condition.

Do not infer credential availability merely from whether one phone manufacturer happens to display a fallback button.

Use platform capability APIs.

==================================================
PART 10 — KEYSTORE VERIFICATION
==================================================

Both valid authentication methods must still authorize the protected Keystore operation.

Test:

Fingerprint
→ authentication succeeds
→ protected key operation succeeds.

Device credential
→ authentication succeeds
→ protected key operation succeeds.

Do not weaken:

- Keystore restrictions.
- encryption.
- authentication validity.
- protected-storage rules.
- app-lock security.

==================================================
PART 11 — AUTH LIFECYCLE / DOUBLE-PROMPT HARDENING
==================================================

Trace:

launch
→ bootstrap
→ LockScreen
→ native authentication
→ Android lifecycle transition
→ auth callback
→ protected-storage opening
→ AppShell
→ foreground/background locking

Investigate:

- simultaneous native prompts.
- success followed by immediate relock.
- stale callback starting another prompt.
- cancellation loops.
- rapid double taps.
- fingerprint + credential prompt overlap.
- BiometricPrompt causing pause/resume that SpendWise treats as true backgrounding.

The current implementation has an `authenticating` state.

Verify exactly what it currently protects.

Do NOT blindly skip all background locking while authenticating.

That could create a security bypass.

Fix confirmed races with an explicit safe state-machine approach.

==================================================
PART 12 — LOCKSCREEN ONE-SHOT AUTH
==================================================

Preserve existing protections such as the LockScreen automatic-auth one-shot guard.

Do not replace functioning protection unnecessarily.

Verify:

- one automatic native auth request per lock presentation.
- cancellation does not immediately retrigger.
- auth failure keeps the application locked.
- successful auth unlocks exactly once.

==================================================
PART 13 — LOCK MIGRATION / SECURITY ERROR UX
==================================================

Audit LockScreen migration/security error handling.

Previously inspected behavior could detect a migration issue but display generic authentication-failure copy instead.

Provide appropriate localized safe messages for states such as:

- migration pending.
- repair required.
- protected key unavailable.
- invalidated protected key.
- unrecoverable protected key.
- authentication cancelled.
- generic authentication failure.

Do not expose:

- raw exception names.
- Keystore internals.
- internal diagnostic identifiers.

==================================================
PART 14 — EARLY STARTUP ERROR LOCALIZATION
==================================================

Audit early bootstrap/fatal protected-storage error UI.

Previously inspected catastrophic storage failure text contained hardcoded English.

Localize appropriate startup-safe copy for:

- English.
- French.
- Arabic.

Keep this implementation intentionally simple.

Do not make fatal-startup rendering depend on database initialization or another fragile subsystem.

==================================================
PART 15 — ACCESSIBILITY LOCALIZATION
==================================================

Audit user-facing:

- aria-label.
- title.
- alt text.
- content descriptions.
- placeholders.
- semantic labels.

Known previous example:

aria-label="Time Period"

Localize appropriate text.

Do NOT translate:

- test IDs.
- API identifiers.
- developer diagnostics.

==================================================
PART 16 — ARABIC LEGAL BACK CONTROL
==================================================

Audit LegalDocumentScreen.

Previously observed:

- English/French use Back arrow.
- Arabic uses X.
- accessibility semantics still mean Back.

Unless the action truly means Close in every locale:

Arabic should use proper RTL Back navigation, such as:

- ArrowRight.
- or a mirrored Back icon.

Do not change navigation semantics solely because the UI language is Arabic.

==================================================
PART 17 — MIXED-DIRECTION USER TEXT
==================================================

Real-device bug:

App language:
Arabic / RTL

Stored description:

Three Day Summer Trip

A truncated row can display approximately:

…e Day Summer Trip

instead of preserving the useful beginning.

Desired:

Three Day Summer…

Likely cause to verify:

user-generated LTR text inherits RTL direction from the surrounding application, and CSS ellipsis preserves the wrong visual side.

Correct principle:

Application chrome follows UI language.

User-created content follows THE CONTENT.

Use appropriate browser/WebView bidi mechanisms such as:

dir="auto"

and, where required:

unicode-bidi: plaintext

or appropriate isolation.

Do NOT force all descriptions LTR.

Examples:

English description inside Arabic UI:
LTR.

Arabic description inside English UI:
RTL.

Arabic inside Arabic UI:
RTL.

==================================================
PART 18 — USER-GENERATED TEXT SURFACE AUDIT
==================================================

Audit user-controlled or AI-extracted strings across the application.

At minimum:

- History descriptions.
- Home top expenses.
- expense details.
- description input.
- notes input.
- Statistics expense descriptions.
- largest-expense lists.
- Media Library.
- AI-extracted merchant names.
- AI-extracted descriptions.
- receipt merchant/description.
- other truncated user-created titles.

Search particularly for:

- truncate.
- text-overflow.
- line-clamp.

Do not apply content-direction handling blindly to translated UI labels.

Numeric amounts/dates may retain explicit LTR handling where correct.

==================================================
PART 19 — INPUT DIRECTION
==================================================

Description and note input fields should adapt naturally.

Arabic UI + typing:

Three Day Summer Trip

should behave naturally LTR.

Typing Arabic should behave RTL.

Prefer browser/native bidi behavior over custom language detection.

==================================================
PART 20 — GENERAL RTL AUDIT
==================================================

Preserve working RTL support.

Audit targeted areas:

- back arrows.
- chevrons.
- swipe actions.
- FAB placement.
- Settings.
- History.
- Statistics.
- expense forms.
- backup/restore.
- authentication recovery.
- legal documents.
- mixed-language text.

Do not blindly mirror non-directional icons.

==================================================
PART 21 — FRENCH LONG-TEXT AUDIT
==================================================

French is LTR but frequently longer than English.

Check compact components for:

- clipping.
- bad wrapping.
- button overflow.
- authentication subtitle overflow.
- Settings rows.
- dialogs.
- Statistics labels.
- AI progress copy.

Do not redesign correctly functioning screens.

==================================================
PART 22 — TRANSLATION PARITY TEST
==================================================

Add deterministic CI coverage ensuring:

- EN/FR/AR main dictionaries contain identical key sets.
- required interpolation placeholders match.
- important feature-local EN/FR/AR objects remain structurally equivalent.

Do not attempt automated translation-quality scoring.

==================================================
PART 23 — AI PROGRESS CURRENT VISUAL PROBLEM
==================================================

The shared AiProgressPanel currently appears visually like a separate card inserted into another feature card.

Previously inspected styling uses approximately:

- separate white/dark inner container.
- emerald border.
- emerald progress bar.

It is rendered inside:

AI Insights:
- indigo/blue.

Statistics AI:
- indigo/blue.

Smart Capture:
- cyan.

Receipt Scanner:
- purple.

This creates:

colored feature card
→ unrelated white/green card
→ green progress UI

Fix the shared component once.

Do not build four separate progress systems.

==================================================
PART 24 — AI PROGRESS DESIGN
==================================================

The loading/progress state should feel like an ACTIVE STATE OF THE EXISTING FEATURE.

Preferred structure:

small status/icon row
→ localized stage text
→ thin indeterminate progress line
→ quiet supporting text if appropriate
→ restrained Cancel action

Avoid another large nested card.

Use contextual tone:

- AI Insights → indigo.
- Statistics → indigo.
- Smart Capture → cyan.
- Receipt Scanner → purple.

Use a small shared tone API, CSS variables or equivalent.

No giant animations.

No fake percentages.

==================================================
PART 25 — PRESERVE AI OPERATION LOGIC
==================================================

This progress redesign is PRESENTATIONAL.

Do NOT modify:

- Gemini model choice.
- Gemini routing.
- retry policy.
- timeouts.
- Render readiness.
- request IDs.
- cancellation behavior.
- fallback logic.
- backend diagnostics.

Preserve meaningful progress stages such as:

- preparing.
- checking backend.
- connecting securely.
- request submitted.
- waiting for AI.
- checking result.

Do not replace all progress information with:

Loading...

==================================================
PART 26 — AI PROGRESS STATES
==================================================

Active:
- subtle contextual indeterminate progress.

Ready:
- no loading animation.

Local fallback:
- valid result, not severe failure.

Cancelled:
- neutral/quiet.

Error:
- clear but not unnecessarily duplicated.

Audit whether AiProgressPanel and the parent feature screen both display substantially identical errors.

Avoid duplicate error UI.

Preserve:

- role="status".
- aria-live="polite".
- reduced-motion behavior.
- accessible Cancel.

==================================================
PART 27 — BACKUP THEME/LANGUAGE ROOT CAUSE
==================================================

The current backup system preserves preference fields including approximately:

- currencyCode.
- themeMode.
- language.

Replace Restore currently applies theme/language from the backup.

The application then reloads those restored preferences.

Therefore:

Current device = LIGHT
Backup = DARK
Replace Restore

→ application immediately switches to DARK.

This explains the observed behavior.

==================================================
PART 28 — BACKUP PREFERENCE POLICY
==================================================

Theme and language are DEVICE/UI preferences.

They should not silently change during ordinary financial-data restoration.

Currency is different because it affects financial display/data interpretation.

Preserve existing validated currency behavior unless a real defect is found.

Default restore behavior:

- keep current theme.
- keep current SpendWise language.

==================================================
PART 29 — BACKWARD COMPATIBILITY
==================================================

Do not unnecessarily invalidate existing:

- legacy/V1.
- V2.
- encrypted V3.

Existing backups may continue containing theme/language fields.

Prefer changing RESTORE POLICY rather than breaking backup schemas.

==================================================
PART 30 — OPTIONAL THEME/LANGUAGE RESTORE
==================================================

For Replace Restore, provide an optional control similar to:

Restore app language and appearance

Default:

OFF

OFF:

- current theme remains.
- current language remains.

ON:

- backup theme applies.
- backup language applies.

Merge should continue preserving current local theme/language.

Use EN/FR/AR copy.

Do not hide this behavior in fine print.

==================================================
PART 31 — SECURITY DATA MUST NEVER BE ADDED TO BACKUPS
==================================================

Do not add:

- app-lock state.
- phone PIN.
- SpendWise PIN.
- biometric information.
- Keystore keys.
- encryption keys.
- auth tokens.
- protected secrets.

to backup preference restoration.

==================================================
PART 32 — AI INSIGHTS PAGE
==================================================

Audit the current AI Insights page.

The inspected WP36 implementation already has an appropriate density:

- short Spending Overview.
- historical context where useful.
- a globally capped set of primary insights.
- approximately up to 3 important insight items.

Do NOT expand this page unnecessarily.

Its purpose is:

quick monthly understanding.

Keep it concise.

Only fix actual issues discovered.

==================================================
PART 33 — STATISTICS AI CURRENT PROBLEM
==================================================

The current Statistics AI result is under-informative.

Observed example:

- Total spending: about $28,000.
- 1,533 transactions.
- average: about $18.
- one month: about $749.
- generic advice to review expenses/budget.

This is weak because:

1. Raw totals duplicate the visible dashboard.
2. A month amount without comparison gives little insight.
3. The recommendation is generic filler.
4. Existing categoryHighlights are generated/validated but were not rendered in the inspected Statistics UI.
5. Multi-month users expect comparison and trend interpretation.

Verify these findings against the actual baseline.

==================================================
PART 34 — STATISTICS AI CORE UX PRINCIPLE
==================================================

Statistics AI should behave like a concise analyst.

For MULTI-MONTH periods it should primarily answer:

- Is spending moving up or down?
- By how much?
- What categories are driving that change?
- Which month stands out?
- Is recent spending better or worse than earlier in the selected period?
- What is the most important takeaway?

It should NOT simply read back:

- total spending.
- transaction count.
- average transaction.
- isolated month values.

Those already exist elsewhere on screen.

==================================================
PART 35 — PERIOD-AWARE AI BEHAVIOR
==================================================

The answer structure should depend on the selected period.

--------------------------------
CURRENT MONTH
--------------------------------

A compact descriptive summary is acceptable.

Useful facts may include:

- current spending.
- top category.
- budget remaining/over-budget.
- comparison with previous complete month if statistically fair.
- strongest current category.

Do not force a trend narrative if insufficient history exists.

--------------------------------
LAST 3 MONTHS
--------------------------------

Emphasize short-term movement.

Useful verified comparisons:

- latest complete month vs earliest complete month.
- month-to-month direction.
- strongest category increase/decrease.
- standout month.
- top category contribution.

Example concept:

"Spending increased 11% from the first to the latest complete month, driven mainly by Transportation."

--------------------------------
LAST 6 MONTHS
--------------------------------

Emphasize the recent trajectory.

Prefer stable comparisons such as:

- latest 3-month average vs earliest 3-month average.
- strongest category increase/decrease.
- peak month.
- top category share.

Avoid overreacting to one abnormal month.

--------------------------------
LAST 12 MONTHS
--------------------------------

The user expects a meaningful year trend.

Prioritize:

- whether spending increased/decreased over the period.
- approximate verified percentage change.
- strongest category driver.
- highest/lowest meaningful month.
- recent trend vs earlier part of year.

Example concept:

"Your recent monthly spending is 14% higher than at the start of the period. Transportation rose 36% and contributed most to the increase."

--------------------------------
ALL TIME
--------------------------------

Do NOT narrate every month.

Summarize long-term and recent movement.

Possible verified facts:

- long-term spending direction.
- recent period vs previous comparable period.
- highest-spending historical period/month.
- long-term largest category.
- major category shift.
- recent change that materially differs from long-term baseline.

Keep it compact.

==================================================
PART 36 — DETERMINISTIC TREND CALCULATIONS
==================================================

Gemini must NOT calculate these numbers itself.

All financial comparisons must be calculated deterministically by SpendWise/backend logic.

Gemini may:

- select verified fact IDs.
- prioritize them.
- phrase them naturally.

Gemini may NOT independently calculate:

- percentages.
- totals.
- ranks.
- category shares.
- month-over-month changes.
- trend slopes.
- averages.

Use a verified fact catalog.

==================================================
PART 37 — BUILD A BETTER VERIFIED FACT CATALOG
==================================================

Extend the existing fact catalog with meaningful comparative facts.

Examples:

- latest complete month vs previous complete month.
- latest complete month vs earliest complete month in short periods.
- latest 3-month average vs earliest 3-month average.
- recent period average vs previous comparable period.
- absolute spending difference.
- percentage spending difference.
- top category share.
- strongest category increase.
- strongest category decrease.
- peak spending month.
- lowest meaningful non-zero month.
- recent spending vs period average.
- category rank change.
- budget trend if actual budget data supports it.

Handle edge cases safely:

- zero denominators.
- missing months.
- partial current month.
- sparse histories.
- tied categories.
- zero-spending periods.

==================================================
PART 38 — PARTIAL CURRENT MONTH SAFETY
==================================================

Do NOT make misleading comparisons using an incomplete current month.

Example:

If today is October 11:

Do not compare October 1–11 directly against full September and conclude:

"Spending fell 60%."

unless the comparison is explicitly normalized and validated.

Prefer COMPLETE months for multi-month trend statements.

If the selected period includes the current partial month:

either:

- exclude it from certain comparative facts,
- or clearly use an appropriate normalized comparison if already supported and verified.

==================================================
PART 39 — STATISTICS AI OUTPUT STRUCTURE
==================================================

Keep the result short.

Preferred structure:

Trend
- one short headline.

What stands out
- up to 2–3 strongest verified observations.

Category
- optional 1–2 meaningful category highlights.

Takeaway
- maximum one specific recommendation if actually justified.

Overall target:

approximately 3–5 short useful lines.

Do not produce an essay.

Do not show every available fact.

==================================================
PART 40 — CATEGORY HIGHLIGHTS
==================================================

The current AiTrendExplanationResult already includes:

categoryHighlights

The backend validates/populates them.

The previously inspected StatisticsScreen did not render them.

Fix this intentionally.

However:

do not render every category.

Select only the most meaningful category changes.

Examples:

- category responsible for largest increase.
- largest category share.
- strongest decrease.
- newly significant category.

Avoid duplication with the main observations.

==================================================
PART 41 — REMOVE GENERIC FILLER ADVICE
==================================================

Generic recommendation text such as:

"Review your expenses and budget before deciding on changes."

does not add value.

Do NOT force a recommendation merely because the response schema expects one.

If data supports a specific next step:

show it.

Example:

"Transportation accounts for most of the recent increase, so review that category first."

If no specific verified action exists:

omit the recommendation section.

If necessary, safely update the validated schema so recommendation may be optional or selected from a deterministic recommendation catalog.

==================================================
PART 42 — EXAMPLE OF GOOD STATISTICS AI
==================================================

For a 12-month period, a good result may conceptually resemble:

Spending trend:
Your recent monthly spending is 14% higher than at the beginning of the period.

Main driver:
Transportation increased 36% and contributed most to the rise.

Standout:
August was the highest-spending month.

Takeaway:
Transportation is the first category worth reviewing if you want to reduce the recent increase.

This is only an example of UX structure.

Do NOT hardcode these facts.

Actual output must use verified dataset-specific facts.

==================================================
PART 43 — STATISTICS AI DENSITY
==================================================

Do not turn the Statistics AI card into a report.

Target approximately:

- 1 concise trend summary.
- maximum 3–4 important fact rows total.
- maximum 1 next step.

Prefer the most informative facts.

Do not repeat the same information in multiple sections.

==================================================
PART 44 — STATISTICS AI TESTS
==================================================

Add deterministic tests covering:

- multi-month result prioritizes comparisons over raw totals.
- 3-month trend behavior.
- 6-month trend behavior.
- 12-month trend behavior.
- All-Time trend behavior.
- latest complete month comparisons.
- partial current month not misrepresented.
- latest-vs-earlier averages where appropriate.
- strongest category increase.
- strongest category decrease.
- top category share.
- peak month.
- sparse history.
- zero denominator.
- tied values.
- categoryHighlights rendered.
- unsupported numeric claims rejected.
- no invented percentage.
- generic filler recommendation omitted.
- specific recommendation only when justified.
- final output remains compact.

Preserve WP36 financial-validation tests.

==================================================
PART 45 — ALL-TIME MONTHLY LIST PROGRESSIVE DISCLOSURE
==================================================

Statistics > Monthly Spending & Remaining can contain many entries.

If the user has three years of history, All Time may contain 36 months.

Do NOT display all 36 detailed month cards immediately.

However:

ALL calculations must still use ALL months.

This includes:

- totals.
- averages.
- categories.
- rankings.
- charts.
- AI Trend Insight.
- largest-expense calculations.

Only the detailed month-list PRESENTATION is collapsed.

==================================================
PART 46 — ALL-TIME DEFAULT PREVIEW
==================================================

When selected period is NOT All Time:

show all months represented by that selected period.

Examples:

3 months → show 3.
6 months → show 6.
12 months → show 12.

When selected period IS All Time and more than 6 months exist:

show the LATEST 6 months initially.

Do NOT show the oldest 6.

Reason:

the user already has a dedicated Last 12 Months filter.

All Time should provide:

- full-period calculations.
- full-period AI.
- recent monthly detail initially.
- full monthly detail on demand.

==================================================
PART 47 — SHOW ALL MONTHS
==================================================

When All Time contains more than 6 months, add a clear localized control.

Collapsed example:

Show all 36 months

Expanded example:

Show latest 6

Optional supporting text:

Showing latest 6 of 36 months

Keep the UI simple.

Do not add unnecessary nested accordions.

==================================================
PART 48 — ALL-TIME STATE
==================================================

When the user changes period:

reset/show the correct month-list state.

Example:

All Time expanded
→ choose 3 Months
→ show all 3.

Return to All Time
→ default to latest 6 unless there is a strong existing-state reason to preserve expansion.

Do not let stale state leak between period filters.

==================================================
PART 49 — STATISTICS DUPLICATE UI BUGS
==================================================

The previously inspected final WP36 source contained:

1. Statistics page title rendered twice consecutively.

2. Monthly Spending & Remaining header displaying BarChart3 twice.

Verify against the actual baseline.

If still present:

remove the duplicates.

Do not redesign those headers.

Add regression coverage.

==================================================
PART 50 — BACKUP TESTS
==================================================

Cover:

1. DARK backup → LIGHT device default restore → remains LIGHT.
2. LIGHT backup → DARK device default restore → remains DARK.
3. Arabic backup → English device default restore → remains English.
4. English backup → Arabic device default restore → remains Arabic.
5. explicit Restore Language/Appearance ON → applies backup values.
6. Merge never silently changes theme/language.
7. currency behavior remains correct.
8. V1 compatibility.
9. V2 compatibility.
10. V3 compatibility.
11. failed restore rolls back safely.
12. preference restore cannot leave inconsistent partial state.

==================================================
PART 51 — NATIVE AUTH TESTS
==================================================

Cover:

- EN title/subtitle.
- FR title/subtitle.
- AR title/subtitle.
- title != subtitle.
- internal IDs never shown.
- biometric primary path.
- one failed scan does not immediately force credential.
- repeated failure/lockout recovery.
- explicit cancellation remains cancellation.
- credential-only device.
- no authenticator state.
- one native auth session at a time.
- stale callbacks ignored.
- no unlock/relock loop.
- Keystore operation after biometric.
- Keystore operation after device credential.
- immediate-lock security preserved.

Use Android instrumentation/device tests where unit mocks cannot honestly prove behavior.

==================================================
PART 52 — RTL / BIDI TESTS
==================================================

Cover:

- English description in Arabic UI.
- Arabic description in English UI.
- Three Day Summer Trip truncates preserving the beginning.
- Arabic truncation preserves appropriate direction.
- description input direction.
- note input direction.
- History.
- Top Expenses.
- Statistics.
- Media Library.
- AI/receipt merchant text.
- Arabic legal Back.
- root dir behavior.

==================================================
PART 53 — AI PROGRESS TESTS
==================================================

Cover:

- AI Insights.
- Statistics.
- Smart Capture.
- Receipt Scanner.

Verify:

- correct contextual tone.
- no unnecessary white/green nested card.
- progress stages preserved.
- Cancel preserved.
- ready/error/local/cancelled semantics.
- reduced motion.
- Arabic RTL.
- French wrapping.
- light mode.
- dark mode.

==================================================
PART 54 — ALL-TIME STATISTICS TESTS
==================================================

Cover:

- 3-month filter shows all 3 months.
- 6-month filter shows all 6 months.
- 12-month filter shows all 12 months.
- All Time with 36 months initially shows latest 6.
- "Show all 36 months" reveals all 36.
- "Show latest 6" collapses again.
- All-Time totals still use all 36.
- All-Time AI still receives full period.
- category calculations still use full period.
- charts still use intended full period.
- month order is correct.
- period switching resets appropriately.

==================================================
PART 55 — MANUAL DEVICE VALIDATION
==================================================

After CODE/CI is green, prepare a signed validation APK.

Do not silently bump version metadata.

A likely next bug-fix version may be:

2.1.3

but report before changing version metadata.

Test both known phones where possible.

--------------------------------
AUTH — ENGLISH
--------------------------------

- launch with App Lock.
- fingerprint success.
- fingerprint rejection.
- cancel.
- phone-credential recovery.
- immediate lock.
- background/foreground.
- no duplicate Unlock SpendWise wording.

--------------------------------
AUTH — FRENCH
--------------------------------

Repeat.

Confirm SpendWise-provided auth title/subtitle are French.

--------------------------------
AUTH — ARABIC
--------------------------------

Repeat.

Confirm:

- LockScreen RTL.
- native SpendWise title/subtitle Arabic.
- no duplicate text.
- no internal identifiers.
- recovery controls correct.
- no prompt loop.

--------------------------------
MIXED-DIRECTION TEXT
--------------------------------

Use Arabic UI.

Test:

Three Day Summer Trip

2026 Summer Trip

Arabic description

mixed Arabic/English merchant

Check:

- History.
- Home.
- Statistics.
- Media Library.

Expected English truncation:

Three Day Summer…

NOT:

…e Day Summer Trip

--------------------------------
AI PROGRESS
--------------------------------

Trigger:

- AI Insights.
- Statistics AI.
- Smart Capture.
- Receipt Scanner.

Test:

- light.
- dark.
- English.
- French.
- Arabic.

Verify progress visually belongs to its parent card.

--------------------------------
BACKUP
--------------------------------

Start:

LIGHT + English.

Restore backup containing:

DARK + another language.

Default behavior:

must remain LIGHT + English.

Then explicitly enable preference restoration.

Backup appearance/language should apply intentionally.

--------------------------------
STATISTICS AI
--------------------------------

Use representative 3-, 6-, 12-month and All-Time datasets.

Confirm:

3 MONTHS:
- short-term movement is explained.

6 MONTHS:
- trajectory is explained.

12 MONTHS:
- trend over the year is explained.
- category driver is identified.
- meaningful percentage comparisons appear.
- no unsupported numbers.

ALL TIME:
- long-term pattern + recent change are summarized.
- no month-by-month dump.

--------------------------------
ALL-TIME MONTH LIST
--------------------------------

Use the 3-year dataset.

Verify:

- totals use all 3 years.
- AI analyzes all 3 years.
- monthly details initially show latest 6.
- Show all reveals all 36.
- collapse returns to latest 6.
- scrolling remains smooth.

==================================================
PART 56 — PRESERVE WP36 OPTIONAL DESCRIPTION
==================================================

WP36 intentionally made Description / Merchant optional.

When blank:

stored description = localized selected category display name.

Preserve this behavior.

Do not:

- make description nullable.
- reintroduce required validation.
- rewrite old descriptions after language change.
- introduce an unnecessary DB migration.

==================================================
PART 57 — SECURITY NON-NEGOTIABLES
==================================================

WP37 must not weaken:

- Android Keystore.
- encryption.
- protected local storage.
- biometric/device credential requirements.
- app-lock timeout.
- backup encryption.
- sensitive-operation reauthentication.
- Privacy Shield / secure-window behavior.
- migration protections.
- web PIN fallback where applicable.

Do not fix duplicate prompts by bypassing authentication.

Do not extend auth validity merely for convenience.

Do not silently swallow security failures.

==================================================
PART 58 — VALIDATION
==================================================

Run all relevant repository-supported checks.

At minimum where available:

- TypeScript.
- lint.
- formatting.
- frontend production build.
- Android debug build.
- Android release checks/build.
- localization tests.
- authentication/security tests.
- backup V1/V2/V3 tests.
- component/browser tests.
- RTL tests.
- Statistics tests.
- Gemini verified-fact tests.
- WP28 security suite.
- WP33.5 regressions.
- WP36 regressions.
- new WP37 tests.
- required CI workflows.

Use actual repository commands.

Do not:

- suppress red tests.
- weaken security assertions.
- invent test results.
- call unexecuted tests passing.

Inspect the complete final diff for unrelated changes.

==================================================
PART 59 — GIT / PR WORKFLOW
==================================================

When implementation is complete:

1. Run local validation.
2. Review full diff.
3. Create focused commits.
4. Push WP37 branch.
5. Open/update PR against correct integration target.
6. Wait for required CI.
7. Fix legitimate red checks without weakening tests.
8. Produce final report.

Do NOT merge.

Wait for explicit user approval.

Do not delete active branches.

Do not make unrelated CI/signing changes.

==================================================
PART 60 — FINAL REPORT
==================================================

Report:

1. Exact baseline branch/commit.
2. WP37 branch/final commit.
3. native duplicate-text root cause.
4. final native auth prompt contract.
5. EN/FR/AR native-auth behavior.
6. biometric-first behavior.
7. credential recovery behavior.
8. cancellation/lockout behavior.
9. Android/OEM limitations.
10. authentication lifecycle findings.
11. duplicate React LockScreen findings.
12. migration/security error fixes.
13. startup localization fixes.
14. accessibility fixes.
15. RTL/navigation fixes.
16. mixed-direction root cause.
17. user-text surfaces corrected.
18. AI progress redesign.
19. confirmation AI reliability logic was not modified.
20. backup theme/language root cause.
21. final backup preference policy.
22. V1/V2/V3 compatibility.
23. AI Insights changes, if any.
24. Statistics AI old behavior.
25. Statistics AI final period-aware behavior.
26. verified fact catalog additions.
27. category highlight presentation.
28. recommendation behavior.
29. All-Time monthly preview behavior.
30. duplicate Statistics title/icon fixes.
31. translation parity results.
32. files modified.
33. tests added/updated.
34. local build results.
35. CI results.
36. physical-device verification remaining.
37. remaining risks.

Give two separate verdicts:

CODE / CI:
GREEN LIGHT
or
RED LIGHT

DEVICE / AUTH / RTL / VISUAL / BACKUP / STATISTICS:
GREEN LIGHT
RED LIGHT
or
NOT YET VERIFIED

Do not claim device green based only on CI.

==================================================
FINAL PRIORITIES
==================================================

Optimize in this order:

1. Security correctness.
2. Financial/data integrity.
3. Backup compatibility.
4. Exactly one intentional authentication flow.
5. Reliable biometric/device-credential recovery.
6. Correct EN/FR/AR behavior.
7. Correct RTL and mixed-direction text.
8. Accurate period-aware Statistics AI.
9. Concise, useful AI output.
10. All-Time Statistics usability.
11. No silent theme/language changes.
12. Integrated AI progress UX.
13. Accessibility.
14. Visual polish.

The final Statistics AI principle is:

DO NOT tell users numbers they can already read.

Tell them what changed, why it changed, what category drove it, what period stands out, and what matters next.

All numeric claims must come from deterministic verified calculations.

Gemini may select and explain facts.

Gemini must never invent financial calculations.

Do not stop after producing an audit.

Implement the confirmed fixes, add regression coverage, run validation, and return the evidence-backed report.

Do not merge without explicit user approval.