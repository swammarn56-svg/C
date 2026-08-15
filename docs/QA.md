# Bakery ERP QA Record

## Automated verification

The project type-checks successfully, builds successfully for production, and has passing Vitest coverage for date-effective item status, g/kg/viss/piece conversion, Production and Packaging formulas, Sales closing, monthly average cost, authenticated logout, and a non-destructive cross-module acceptance sequence.  The acceptance sequence follows item activation, purchase normalisation, ledger balance calculation, sales closing, and monthly damage valuation without inserting sample business records.

## Cross-module acceptance flow

The following acceptance path is supported by the implemented application and should be used with business data after the initial administrator sign-in.  It deliberately uses user-entered records rather than any seeded operational data.

| Step | Action | Expected result |
|---|---|---|
| 1 | Add a Production or Packaging item with an effective start date. | The item appears from that date forward and is absent for earlier date selections. |
| 2 | Add a purchase for the same date. | Input unit is normalised to grams and appears in that day’s matching ledger `In` balance. |
| 3 | Save Issued, Return, Damage, and Note in Production or Packaging. | `Used` and `Closing` recalculate from the documented formulas. |
| 4 | Add a shop, price a Sales item, and save Produce/Sell. | The shop-item Sales ledger calculates its automatic Opening and Closing balance. |
| 5 | Select a report date range. | Purchase, Production, Packaging, Sales, and Damage tabs show their dedicated item values. |
| 6 | Download an XLSX template, complete one valid row, and import it. | The matching server validation applies and the corresponding page refreshes after import. |
| 7 | Set an item inactive from a future business date. | Earlier dated records remain available; the item is omitted from the selected date onward. |

## Visual verification

The live preview was reviewed after implementation.  The desktop view retains the original compact dark top bar, horizontal module tabs, card-based metrics, and scrollable operational tables.  It presents empty operational states rather than fabricated business records.

## Authenticated live acceptance evidence

An authenticated operational-user session was opened on **2026-08-15** without inserting, editing, importing, exporting, or deleting any business data.  The Item Dashboard displayed its three distinct **Production**, **Packaging**, and **Sales** tabs, plus the intended read-only control state for a non-administrator.  The Reports module displayed its date range, XLSX export control, and the five separate report tabs: Total Purchase, Production Item, Packaging Item, Sales Item, and Damage.  The empty state correctly reported zero records because no operational records were seeded for verification.

The same live session also confirmed the **More** module displays Shop Management, multi-line Recipe Storage, XLSX template/export/import controls, restricted Admin Panel messaging, and Backup controls.  The **Purchase** module displayed separate Production (`g / kg / viss`) and Packaging (`pcs`) tabs, its internal-grams table column, and the intended empty state.  These checks were read-only and did not create any business transactions.

The live **Production** ledger displayed the configured columns and formula guidance: `Used = Issued − Return − Damage` and `Closing = Opening + In + Return − Issued`, with purchase-driven `In` and Item Dashboard ordering described in the interface.  The **Sales** ledger displayed its shop selector, store-price dependency, and `Closing = Opening + Produce − Sell` guidance.  The session correctly prevented new sales when no shop exists, keeping the verification non-destructive.

The source validation suite also performs a non-destructive Myanmar Unicode round-trip using `ပေါင်မုန့်`, `ရန်ကုန်ဆိုင်`, and `ချို`: it writes a UTF-8 BOM CSV and XLSX workbook with the same spreadsheet library used by the interface, reads both back, and confirms every text field is unchanged.  This verifies the import/export parsing path without inserting test records into the operational database.

## Source-only validation

After the final workflow changes, `pnpm check` completed successfully and `pnpm test` completed with **12 passing tests across 4 files**.  No deployment command or application production-build command was run for this source-delivery request.

## Authorised temporary live-data acceptance test

On **2026-08-15**, an authorised temporary administrator session created uniquely labelled Unicode test records only.  The interface confirmed a `1 kg` Production purchase as `1,000 g`, a `20 pcs` Packaging purchase as `20 pcs` without gram conversion, Production `Used = 230 g` and `Closing = 750 g`, Packaging `Used = 6 pcs` and `Closing = 13 pcs`, and a shop-priced Sales row with `Produce = 10 pcs`, `Sell = 4 pcs`, `Closing = 6 pcs`, unit price `50.00`, and total price `200.00`.

The Total Purchase Report displayed the temporary Myanmar text with total value `1,400.00`.  The Sales Item Report displayed the same Unicode item and shop name with sales value `200.00`.  Every temporary item, shop, purchase, operation, price, and sale was then deleted in dependency order.  A final database check confirmed zero temporary items, shops, purchases, operations, and sales remained, and the test user’s role was restored to `user`.

## Live Unicode CSV import and export acceptance

An additional temporary Production item with a Myanmar Unicode name was created for the spreadsheet flow.  A UTF-8 BOM CSV Purchase row containing the Unicode note `QA CSV ချို` was injected through the live Import / Export file-input path.  The interface reported `Imported 1 purchases record(s).` and the Purchase table rendered the Unicode item and note correctly, with `2 kg`, `2,000 g`, total price `60.00`, and `confirmed` status.  The same live row was exported with **Export CSV**; readback of the downloaded file confirmed both the Unicode item name and note were intact.

The temporary import item and its Purchase row were deleted immediately after readback.  A final database check confirmed zero spreadsheet-test items and purchases remained, and the temporary administrator role was restored to `user`.

## Live Unicode XLSX import and export acceptance

The same isolated procedure was completed using a real XLSX workbook generated with the application’s loaded spreadsheet library.  The workbook contained a temporary Unicode item, the note `QA XLSX ချို`, and a confirmed `3 kg` Purchase row.  It was submitted through the live Import / Export file input, which reported `Imported 1 purchases record(s).`  The Purchase table then showed the expected `3,000 g` base quantity and total price `90.00`.

The live **Export XLSX** action created an XLSX file.  Readback confirmed the Unicode item name and `QA XLSX ချို` note remained intact.  The temporary XLSX item and Purchase were then deleted; the final check returned zero remaining XLSX test records and restored the test user role to `user`.
