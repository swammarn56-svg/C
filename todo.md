# Project TODO

- [x] Inspect the supplied Bakery ERP archive and map reusable UI, routes, and data workflows into the active project.
- [x] Define the inventory data model, effective-dated item lifecycle, role model, stock calculations, and monthly average-cost rules.
- [x] Create the Item Dashboard with separate Packaging, Production, and Sales tabs.
- [x] Implement effective-start item visibility, effective-date soft deletion, rename, minimum stock, category assignment, and synchronized item ordering.
- [x] Restrict cost-per-unit visibility to the Sales item tab and sales-related authorised screens only.
- [x] Implement Purchase Packaging entries in pieces with quantity, note, and cost data.
- [x] Implement Purchase Production entries with g, kg, and viss input units and canonical gram storage.
- [x] Automatically feed purchase quantities into the corresponding daily Production and Packaging In values.
- [x] Implement the Production daily ledger with Opening, In, Issued, Return, Damage, Used, Closing, and Note fields and validated formulas.
- [x] Implement the Packaging daily ledger with the same balances, formulas, and synchronized item order.
- [x] Implement shop management including store-specific per-item prices.
- [x] Implement the Sales daily ledger with manual Produce and Sell, automatic Opening and Closing, shop selection, and notes.
- [x] Implement daily dashboard metrics for purchases, closing stock, damage, sales margin, and low-stock alerts.
- [x] Calculate purchase valuation by calendar-month average cost only.
- [x] Implement date-range reports for purchases, per-item production, packaging, sales, and damage valuation.
- [x] Implement user role management, recipe storage, and database backup export.
- [x] Implement spreadsheet exports, import validation, and downloadable format templates for Purchase, Production, Packaging, and Sales.
- [x] Add automated tests for date-effective item behavior, unit conversion, ledger formulas, and monthly average cost.
- [x] Verify the application UI, calculations, build, and critical workflows before delivery.
- [x] Add category assignment to the item data model and Item Dashboard.
- [x] Restrict Sales cost-per-unit responses and controls to authorised administrators.
- [x] Present separate date-range purchase, production, packaging, sales, and damage report workflows.
- [x] Expand recipe storage to support multi-line component editing and deletion.
- [x] Document and complete end-to-end QA for cross-module flows and spreadsheet exchange.
- [x] Restrict Item Dashboard add, edit, delete, reorder, and Sales cost inputs to administrators in the frontend.
- [x] Execute and record live acceptance checks for critical operational flows without seeding business data.
- [x] Compare the final requirement document with the current implementation and record the remaining workflow gaps.
- [x] Preserve piece-based inventory in pcs rather than converting it to grams, while retaining gram conversion for weight-based items.
- [x] Add confirmed purchase status and table fields for purchase unit, base quantity, unit price, total price, date, and note.
- [x] Add Sales total-price calculation using the selected shop-item price and expand sales reporting by shop, item, and date range.
- [x] Add report balances and valuations for opening, in, issued, return, damage, used, closing, cost, and total value.
- [x] Add CSV import/export and verify Myanmar Unicode data preservation across UI and spreadsheet exchange.
- [x] Run source type checking and tests without producing a deployable application build artifact.
- [x] Create a GitHub-ready ZIP archive that excludes dependencies, build output, local logs, and secrets.
- [x] Verify Myanmar Unicode CSV/XLSX import, UI/report display, and export round-trip without creating production records.
- [x] Run a live Unicode import-to-report acceptance check after an administrator supplies approved non-production test data.
- [x] Temporarily grant the authorised test session the minimum administration access needed to create isolated test records.
- [x] Create and verify a uniquely labelled Unicode item, shop, confirmed purchase, Production ledger row, Packaging ledger row, Sales row, report values, and CSV/XLSX exchange.
- [x] Delete every uniquely labelled temporary test record and restore the original user role.
- [x] Create isolated temporary data for a live Unicode CSV/XLSX import-to-report and export-readback acceptance check.
- [x] Import a live Unicode spreadsheet row, verify it in the applicable UI/report, export it, and record the evidence.
- [x] Delete the spreadsheet-exchange temporary records and restore the original user role after the live check.
- [x] Run a live XLSX Unicode import and export acceptance check with isolated temporary data, then remove it.
- [x] Re-read and confirm the completed live CSV/XLSX evidence in the QA record.
- [x] Inspect the current database access layer and define a safe Supabase replacement plan.
- [x] Configure the supplied Supabase project URL and publishable key through managed environment variables.
- [x] Obtain a server-side Supabase credential or database connection string required for schema migration and protected ERP writes.
- [x] Create and apply the Supabase schema, row-level security, and indexes for Bakery ERP data.
- [x] Replace the current database access layer with Supabase-backed queries and mutations.
- [x] Validate Supabase connectivity, role access, operational calculations, and Unicode spreadsheet workflows.
- [x] Package the Supabase-connected source code as an updated GitHub-ready ZIP.
- [x] Re-run and record Supabase-backed QA for admin/user role restrictions plus a live Unicode import/export workflow against the migrated database.
- [x] Create a fresh GitHub-ready ZIP from the final Supabase-connected source tree and record its output path and exclusion rules.
- [x] Repackage the Bakery ERP source as a flat-root GitHub ZIP with unnecessary preview artifacts removed and direct upload instructions.
- [x] Create a single-project-folder ZIP so the user downloads one archive, extracts one folder, and uploads that folder’s contents to GitHub without selecting multiple project folders individually.
- [x] Upload the finalized Bakery ERP source to the user-selected GitHub repository `swammarn56-svg/C` and verify the pushed main branch.
- [x] Replace Manus OAuth login and branding with Supabase email/password authentication for the requested bakery account.
- [x] Validate the Supabase Auth login on Netlify and redeploy the no-Manus version.
- [x] Replace Manus login/branding with Supabase email/password authentication and configure the requested account.
- [x] Add installable PWA manifest, icons, service worker, and mobile install guidance.
- [x] Validate and redeploy the Supabase-authenticated PWA to Netlify from GitHub C.
- [x] Verify the live Netlify PWA manifest and service worker responses and record installability evidence.
- [x] Set Netlify client Supabase variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then redeploy.
- [x] Verify the actual Netlify browser login flow loads the ERP with the requested admin role.
- [x] Verify live browser service-worker registration and PWA installability evidence.
- [x] Implement daily carryforward for Production, Packaging, and Sales, including downstream recalculation when an earlier date changes.
- [x] Allow Opening edits only with a required Reason and recalculate later daily balances without deleting historical records.
- [x] Add daily CSV/XLSX import/export and template controls directly to Production, Packaging, and Sales.
- [x] Add agreed web-app controls: daily lock/reopen, recalculation guidance, row-level negative-stock warnings, import validation, low-stock alerts, administrator audit log with actor/entity/details filters, date-aware global search navigation, print summaries, and button-based More navigation.
- [x] Do not implement the previously discussed mobile-first table redesign.
- [x] Preserve existing Opening overrides and reasons when editing other daily fields; add regression coverage for downstream recalculation.
- [x] Bind the daily Sales import/export panel to the currently selected shop and verify exact date/shop scoping.
- [x] Verify automatic browser-side PWA service-worker registration and installability after the latest GitHub-triggered Netlify redeploy; manifest and service-worker HTTP responses are verified.
- [x] Add an administrator-only manual In override for Production and Packaging; Reason is optional, automatic purchase In remains the default, and later carryforward balances recalculate.
- [x] Add a visible Reset to purchase auto In action for Production and Packaging and test that clearing the override restores purchase-derived In and downstream carryforward.
- [x] Add integration-level regression coverage proving that clearing a saved manual In override restores later-day purchase-derived carryforward balances.
- [x] Re-run and record the production build after the final reset-to-auto-In changes.
- [x] Add an integration-style test that exercises the manual In save semantics, clears the override with null, and verifies later-day balances use purchase-derived In.
- [x] Add a real operation save-path integration test covering manual In override, null reset, and later-day persisted carryforward, then rerun the test suite.
- [x] Add an administrator-only Audit Log workspace showing recent actions with date, actor, entity, and details filters.
- [x] Add a Global Search workspace covering items, shops, recipes, and recent operational records with date-aware result links.
- [x] Add date-effective recipe versions with an Effective from date so edits only affect that date and later; earlier effective-date moves are rejected.
- [x] Add an Order Table for Sales items with quantity and note, and generate recipe-based Production/Packaging Issued quantities by business date.
- [x] Preserve manual Issued edits over generated order quantities and add regression coverage for order generation and historical recipe behavior.
- [x] Add date-effective recipe versions with an Effective from date so edits only affect that date and later; earlier effective-date moves are rejected.
- [x] Add an Order Table listing only Sale items from Item Dashboard, with order quantity and note fields.
- [x] Generate recipe-based Production/Packaging Issued quantities from saved Sale-item orders by business date.
- [x] Preserve manual Issued edits over generated order quantities and add regression coverage for order generation and historical recipe behavior.
- [x] Fix the Netlify Supabase PostgreSQL TLS connection that prevents a valid live browser session from resolving to an ERP user.
- [x] Ensure changing the selected business date immediately reloads the Production, Packaging, and Sales daily tables.
- [x] Make Opening adjustments reason-optional in the UI and backend while retaining optional audit detail support.
- [x] Replace daily-ledger per-row Save buttons with debounced automatic saving and visible saving/error status.
- [x] Re-add a non-required Opening reason field or optional details control for Production, Packaging, and Sales edits so optional audit context can still be captured.
- [x] Live-test an Opening edit with and without an optional reason to confirm autosave, audit logging, and carryforward behavior.
- [x] Limit Supabase PostgreSQL connection-pool fan-out for Netlify and read-only reconciliation so session-mode connection limits do not block authentication or August data validation.
- [x] Import the supplied original Production and Packaging daily data from 2026-08-01 onward with duplicate-safe upserts, preserving historical Opening/In/Issued/Return/Damage values without destructive deletes.
- [x] Normalize imported August Opening overrides so unchanged daily Opening values use automatic Closing-to-Opening carryforward, retaining overrides only where the supplied history contains a real discontinuity.

- [x] Re-run a PostgreSQL-based read-only August reconciliation after the reduced pool/idle-session configuration and document that it completes without session-limit failure.
- [x] Confirm focused regression coverage directly asserts the reduced PostgreSQL pool size and idle-session settings in server/db.ts.
- [x] Live-test an Opening edit with and without an optional reason to confirm autosave, audit logging, and carryforward behavior.
- [x] Verify automatic browser-side PWA service-worker registration and installability after the d82f63a deployment.

- [x] Live-test a deployed Opening edit without a reason, verify autosave persistence, audit-log creation, and next-day carryforward.
- [x] Live-test a deployed Opening edit with an optional reason, verify reason persistence on reload, audit-log context, and downstream carryforward.

- [x] Coerce persisted numeric ledger values to numbers in the client autosave payload so live Opening edits do not send inOverrideQtyGrams strings to the strict tRPC schema.
- [x] Redeploy and rerun the controlled live Opening autosave test, including no-reason and optional-reason persistence, downstream carryforward, audit-log checks, and restoration of the original value.

- [x] Fix the remaining live daily-table autosave failure so persisted numeric values are sent as numbers and no per-row Save action is required.
- [x] Re-run live Production, Packaging, and Sales autosave/date-change verification and resolve any remaining API or UI errors.
- [x] Confirm supplied Production and Packaging data is complete from 2026-08-01 onward, with no duplicate rows and verified Opening/In/Issued/Return/Damage/Closing balances.
- [x] Run the full final test suite and production build, save a final checkpoint, and provide the user with the Management UI Publish instruction.

- [x] Confirm the final daily-ledger UI contains no per-row manual Save action and uses automatic saving for Production, Packaging, and Sales.
- [x] Prepare the corrected source for the user’s Netlify deployment only; do not publish or host it through Manus.

- [x] Remove the visible "Reset to purchase auto In" control from Production and Packaging daily ledger rows while keeping automatic purchase-derived In behavior.
- [x] Remove every row-level "Save" button from the mobile and desktop Production, Packaging, and Sales daily ledgers; retain debounced automatic saving with a non-button status label.
- [x] Verify the mobile daily ledger layout is built from the updated source and does not display legacy Save/reset controls.
- [x] Run tests and production build, then push the Netlify-ready correction to GitHub main for the user’s Netlify deployment.
- [x] Make confirmed Purchase records the sole source of Production and Packaging daily In quantities; a cancelled Purchase must remove its quantity from the relevant ledger and downstream carryforward without any manual In override or reset control.
- [x] Ensure Production, Packaging, and Sales immediately clear stale rows and reload the selected business date on mobile and desktop without requiring a manual refresh.
- [x] Reconcile existing manual In overrides before enforcing purchase-only In and prove that cancelling a Purchase recalculates the same-day and later carryforward balances without altering unrelated historical records.
- [x] Convert verified historical In overrides into tagged confirmed Purchase records so the purchase-only In rule preserves imported August balances and carryforward.
- [x] Remove all "Auto from purchase" text and hide the optional Opening reason field so daily ledgers display only the Opening input and a plain Purchase-derived In quantity.
- [x] Restore and preserve the user-provided Production and Packaging item sequence through Item Dashboard sort order so date changes and imports never reorder ledger rows unexpectedly.
- [x] Remove Import/Export panels from the Production, Packaging, and Sales daily pages and provide one More → Import/Export workspace with date and table selection for Purchase, Production, Packaging, and Sales.
- [x] Create and present three mobile-friendly daily-ledger table design options, then implement only the user-selected design.
- [x] Keep the existing table design and make only the Name column sticky during horizontal scrolling, with no changes to the current ledger workflow.
- [x] Reapply the exact Production and Packaging item sequences from the supplied original August CSV files to current item sort-order values without modifying ledger quantities or Purchase data.
- [x] Prevent each row edit from reloading the whole ledger; keep edited values locally visible and show immediate non-blocking save status.
- [x] Make date changes display the selected date immediately with stale-request protection and replace the table data when the new response arrives.
- [x] Validate the optimized mobile flow, run tests/build, push the correction to GitHub main, and verify the Netlify deployment.
- [x] Filter Purchase records by the selected Business date so only that date’s purchases are shown, while preserving the existing Production/Packaging type tabs and cancellation workflow.
- [x] Fix the mobile Production/Packaging/Sales ledger query stuck on Loading for a selected date; add bounded timeout, visible error state, and retry without losing already loaded rows.
- [x] Run regression tests/build, push the mobile Loading correction to GitHub main, and verify the Netlify mobile workflow with the selected date.
- [x] Restore editable manual In fields in Production and Packaging while keeping confirmed Purchase-derived In as the default and preserving cancel/carryforward behavior.
- [x] Diagnose and fix the mobile Production/Packaging/Sales query that remains stuck on Loading; verify the actual API/session response, not only the UI timeout.
- [x] Run tests/build, verify manual In and mobile loading, push the correction to GitHub main, and redeploy/verify through Netlify.

- [x] Diagnose and fix slow initial app and business-date Loading without blocking already cached ledger rows.
- [x] Restore and verify Purchase records for the selected business date, including date switching and empty/error states.
- [x] Run regression tests/build and live mobile verification for fast date loading and Purchase visibility.
- [x] Push the verified Loading/Purchase correction to GitHub main and verify the Netlify deployment.

- [x] Supersede write-voice commands with the approved read-only Ella voice input design.
- [x] Supersede write-command transcription/parsing; Ella only transcribes read-only questions.
- [x] Resolve voice safety by making Ella read-only with no write or cancel capability.
- [x] Do not connect voice input to autosave; approved Ella scope is read-only.
- [x] Replace write-command tests with read-only Ella Unicode matching, date-range, and ambiguity tests.

- [x] Use the existing ERPWorkspace business date as the shared Global Business Date for all daily workspaces, Reports Daily mode, and Ella.
- [x] Route all daily workspaces, More tools, Reports Daily mode, and Ella through the shared ERPWorkspace date state.
- [x] Preserve cached daily rows during date refresh and retain explicit Report Date range mode as the approved exception.
- [x] Implement Ella’s read-only global-date default and clarification behavior for ambiguous items or dates.

- [x] Fix Reports daily-basis selection so a single business date can be chosen and applied reliably.
- [x] Fix Report data queries/rendering so valid report results appear instead of blank or stuck states.
- [x] Fix Report item selectors so Myanmar-Unicode items load, can be selected, and filter report output.
- [x] Make Report daily defaults follow the approved Global Business Date while preserving explicit date-range reporting.
- [x] Add regression tests and live verification for daily reports, item selection, empty states, and report data rendering.

- [x] Define and implement the read-only assistant name “Ella” with text and optional voice responses.
- [x] Support Ella questions for daily Closing, monthly/current-period Used totals, Purchase, Damage, Sales, and date-aware item summaries.
- [x] Make Ella default to the Global Business Date and allow explicit dates/date ranges in questions.
- [x] Ensure Ella can match Myanmar-Unicode item names and ask clarification for ambiguous names or missing table/unit/date context.
- [x] Guarantee Ella exposes read-only procedures only and cannot save, edit, cancel, delete, or mutate ERP records.
- [x] Repair and verify Reports daily/range selection, report rendering, and item selection before connecting Ella to report data.
- [x] Add Ella tests for date-range resolution, Myanmar item matching, ambiguity handling, and read-only scope.
- [x] Verify Ella’s live read-only Burmese question succeeds on Netlify when OPENAI_API_KEY is unavailable, and confirm it cannot mutate records.

- [x] Fix Ella so natural Burmese phrasing such as “ဂျုံရဲ့ Closing ဘယ်လောက်လဲ” reliably returns the matching item’s current-date Closing.
- [x] Expand Ella’s deterministic fallback to recognize Burmese possessive/question phrasing and common Burmese-English mixed terms without requiring exact token order.
- [x] Add regression coverage for natural Burmese Closing, Used, Purchase, Damage, Sales, and explicit date/date-range questions.
- [x] Re-verify Ella live on Netlify after the correction and confirm read-only behavior remains intact.

- [x] Inspect the supplied phone screen recording and reproduce why Ella does not acknowledge or answer by voice.
- [x] Add “Ella” wake-name detection with a spoken acknowledgment and a short listening window for the following question.
- [x] Make the two-stage voice flow work without requiring a text-field click, while preserving text input fallback and read-only query safety.
- [x] Test Burmese wake/question speech through automated wake-parser coverage and live UI permission handling; document that final physical-phone speech recognition still requires Chrome microphone permission and an on-device user check.

- [ ] Reproduce and diagnose the confirmed phone Chrome failure where calling Ella produces no acknowledgment, no listening state, and no text response.
- [ ] Make the mobile voice control show an immediate visible state and a usable fallback when SpeechRecognition or microphone permission is unavailable.
- [ ] Verify wake-word and direct-question behavior on the deployed mobile path, with text input remaining functional.

- [ ] Evaluate a true always-listening “Ella” wake-word mode that does not require tapping the website microphone button.
- [ ] Compare suitable wake-word and voice-assistant tools/devices for Burmese question capture and read-only ERP answers.
- [ ] Recommend the practical architecture and confirm the chosen tool before implementing another voice change.
- [ ] Identify the minimum required AI/API credentials only after selecting the wake-word, Burmese transcription, and text-to-speech architecture.

- [ ] Integrate Gemini as the ERP assistant after the user supplies/approves the required API credential.
- [ ] Ground Gemini with the Bakery ERP workflow, Global Business Date, item catalog, units, shops, recipes, carryforward, Purchase Auto In, and Reports rules.
- [ ] Add structured read-only tools for Closing, Used, Purchase, Damage, Sales, and date/date-range reports.
- [ ] Add structured write proposals for Purchase, Production, Packaging, Sales, Opening, Issued, Return, Damage, Order, and supported cancellation/edit workflows.
- [ ] Require a second verification step for every AI-initiated write; never execute on the first interpretation alone.
- [ ] Add ambiguity checks, permission checks, audit logging, duplicate-submit protection, and safe failure/rollback behavior for AI writes.
- [ ] Test Burmese natural-language answers and writes, including item/date/unit/shop ambiguity and confirmation cancellation.

- [ ] Store the supplied Gemini API key as a managed server-side secret without exposing or echoing it.
- [ ] Validate Gemini connectivity and choose the model/API path for Ella’s structured ERP workflow.
- [ ] Keep every Gemini-initiated ERP write behind a second verification step and existing server validations.

- [ ] Ground Ella with every current ERP workflow, field, formula, permission, date rule, and report definition.
- [ ] Make Ella answer supported workflow questions in Burmese text and browser-spoken Burmese where speech synthesis is available.
- [ ] Add workflow-aware Gemini structured tools for read-only queries and second-verified writes without direct database access.
- [ ] Test full-workflow questions and write proposals across Dashboard, Items, Purchase, Production, Packaging, Sale, Order, Recipe, Reports, More, and Import/Export.

- [ ] Open Google AI Studio for user-controlled login without receiving or storing the Google password.
- [ ] Help create/retrieve a Gemini API key from a permitted project and validate generation access.
- [ ] Replace the denied Gemini key only after the user provides the new key through the secure secret flow.

- [ ] Create a new Google Cloud project through the authenticated Google session only after any billing/consent gate is explicitly approved.
- [ ] Import the new project into Google AI Studio and create a Gemini API key with generation access.
- [ ] Validate the new key with both the lightweight models endpoint and a real generation request before resuming Ella integration.

- [x] Add and pass a focused Vitest check that GEMINI_API_KEY authenticates against Google’s Generative Language API models endpoint.
- [ ] Resolve Google project-level permission denial for Gemini generateContent in Bakery ERP Ella, then rerun the live generateContent and Ella workflow checks.

- [x] Remove Ella assistant UI, wake-word detection, voice input/output, and related navigation from the ERP.
- [x] Remove Gemini intent/write-proposal routes, adapter code, tests, and configuration references while preserving deterministic ERP workflows.
- [x] Disable GEMINI_API_KEY with a non-credential sentinel and verify no Ella/Gemini integration remains.
- [x] Run the full regression suite, production build, and UI verification after Ella removal.

- [x] Fix Supabase sign-in/session initialization hanging indefinitely on `Loading Bakery ERP…` after login, with bounded recovery and visible errors.
- [x] Add auth regression coverage, rerun the full test/build checks, and verify the login screen and authenticated workspace behavior.

- [x] Verify whether the latest Ella-removal and authentication-fix checkpoint is pushed to GitHub; synchronized GitHub C main to commit ade2795.
- [x] Verify whether Netlify has deployed the latest GitHub revision; latest production deployment `6a83fd5e4df397adf5f56a21` is Ready.

- [x] Deploy the corrected Bakery ERP from GitHub `swammarn56-svg/C` main to the user’s Netlify site `swammarn` only; do not use Manus Hosting as production hosting.
- [x] Verify the Netlify live site serves the latest GitHub revision and the Supabase sign-in loading fix; deployment `6a83fd5e4df397adf5f56a21` is Ready and `https://swammarn.netlify.app` returns HTTP 200.

- [x] Diagnose the confirmed Supabase sign-in timeout on the live Netlify site instead of treating the timeout message as the fix; direct browser auth was replaced with a same-origin Netlify proxy after confirming the backend endpoint responds.
- [ ] Correct the production auth/API configuration or request path, redeploy through GitHub and Netlify only, and verify a real sign-in request completes.

- [ ] Reproduce and fix the still-failing real-account Supabase sign-in timeout; do not treat the proxy smoke test with invalid credentials as proof of a successful login.
- [ ] Run a real-account-compatible auth verification, push only the verified fix to GitHub, and do not deploy to any Netlify account until the user provides the new account connection.

- [x] Produce a detailed developer-facing Bakery ERP workflow and recreation specification; do not modify or deploy the application for this documentation request.

- [ ] Identify the new Netlify account’s destination site/project using the newly provided credential; do not use the depleted `swammarn` site.
- [ ] Verify the GitHub source and required Supabase/Netlify environment variables before deploying to the new site.
- [ ] Deploy and smoke-test the verified Bakery ERP on the new Netlify site only.

- [x] Change the canonical `viss` conversion from 1632.93 g to 1600 g across shared calculations, Purchase conversion, reports, and documentation.
- [x] Add/update regression tests proving `1 viss = 1600 g` and no affected workflow uses the old factor.
- [ ] Push the verified 1600-gram conversion to GitHub and deploy only to the new Netlify site/account.

- [ ] Confirm the newly connected Netlify site is linked to GitHub `swammarn56-svg/C` main and is not the depleted previous site.
- [ ] Confirm Netlify uses `pnpm build` and `dist/public`, then pull/deploy the latest 1600-gram viss commit.
- [ ] Smoke-test the new Netlify URL and verify the deployed revision and application response.

- [ ] Verify the new Netlify site `swammarn30.netlify.app` uses the latest GitHub `main` revision and correct `pnpm build` / `dist/public` settings.
- [ ] Verify the new site has the original Supabase project environment configuration so existing data remains available, without exposing secret values.
- [ ] Smoke-test the new live URL and verify login/data behavior plus the 1600-gram viss conversion.

- [ ] Treat Supabase login reliability on `swammarn30.netlify.app` as a release blocker; verify valid login, invalid-password handling, timeout recovery, session installation, and local user mapping before final deployment confirmation.

- [ ] Add the received Supabase service-role key and database connection variables securely to Netlify `swammarn30`; add the existing JWT secret before redeploying and testing login.

- [ ] Change the new `swammarn30` Netlify site from Private to Public and verify the public URL reaches the Bakery ERP login page.

- [ ] Diagnose the swammarn30 live `Signing in...` hang after the site became public.
- [ ] Fix and redeploy the verified authentication path, then confirm the real Supabase account reaches the ERP dashboard and existing data loads.

- [x] Fix mobile login remaining stuck at Signing in by bounding Supabase session installation and surfacing client-side errors
- [x] Verify login fix with regression tests, production build, and live Netlify smoke test
- [x] Synchronize corrected login code to GitHub and confirm Netlify deployment

- [x] Resolve the remaining swammarn30 mobile login failure so the supplied Supabase account reaches the ERP dashboard
- [ ] Verify session persistence and dashboard loading in the deployed browser flow

- [x] Reproduce and resolve the remaining mobile browser login failure until the supplied account reaches the ERP dashboard
- [ ] Verify the deployed browser session and dashboard loading after the final login patch

- [ ] Fix 11-to-12 August carryforward mismatches so each current-day Opening equals the previous-day Closing in Production, Packaging, and Sales
- [ ] Reconcile affected live records, test downstream carryforward, and deploy the correction

- [ ] Reconcile every mismatched row across Production, Packaging, and Sales for 11 August to 12 August and all downstream dates
- [ ] Verify no ledger row violates previous Closing equals next Opening after the shared carryforward fix

- [ ] Cascade a changed Opening through that day Closing and every later day Opening across Production, Packaging, and Sales
- [ ] Verify earlier dates remain unchanged and deploy the tested cascade behavior
