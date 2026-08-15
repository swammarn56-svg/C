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
