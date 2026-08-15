# Bakery ERP Workflow Contract

## Item lifecycle

An item belongs to exactly one operational list: **Production**, **Packaging**, or **Sales**.  Every item has an `effectiveFrom` date.  It is visible in tables for that date and later dates only.  A dated deactivation stores `inactiveFrom`; the item is absent from that date onward while transactions and reports before that date remain intact.  This implements non-destructive, date-effective deletion.

Items have a single `sortOrder`, so the sequence managed in the Item Dashboard applies to the corresponding ledger or sales table.  Sales-only cost per unit is stored on the item and is never sent to Production or Packaging item-list views.

## Quantities and valuation

Every purchase stores the entered quantity and unit for traceability, plus `quantityGrams` as the internal canonical quantity.  Production inputs use `g`, `kg`, or `viss`.  Packaging purchases entered in `pcs` use the item’s grams-per-piece factor, allowing them to remain readable as pieces while still participating in one canonical internal quantity system.

Purchase cost is calculated within the calendar month of each business date only.  The monthly average unit cost is `sum(total purchase cost) / sum(quantity grams)` for the selected item and month.  It is not carried forward from a prior month.

## Daily balances

Production and Packaging daily rows are calculated rather than duplicated.  `Opening` is the prior balance before the selected date and `In` is the sum of confirmed purchases on that date.  The formulas are:

> `Used = Issued − Return − Damage`  
> `Closing = Opening + In + Return − Issued`

The Sales daily ledger is segmented by shop and item.  `Opening` is the preceding balance for that shop-item, while `Produce` and `Sell` are manual inputs.  Its formula is:

> `Closing = Opening + Produce − Sell`

## Authorisation and data exchange

Administrators manage roles, shops, prices, recipes, backups, imports, and item lifecycle.  Operational users can work with day-to-day purchase, ledger, and sales data.  Import templates use the same fields as the on-screen tables; imported data receives the same server-side date, item, unit, and formula validation as manually entered data.

| Table | Required import columns | Additional validation |
|---|---|---|
| Purchase | `Date`, `Item ID`, `Qty`, `Unit`, `Total Cost` | Production accepts only `g`, `kg`, or `viss`; Packaging accepts only `pcs`. |
| Production | `Date`, `Item ID`, `Issued g`, `Return g`, `Damage g` | The target item must be effective and belong to Production. |
| Packaging | `Date`, `Item ID`, `Issued g`, `Return g`, `Damage g` | The target item must be effective and belong to Packaging. |
| Sales | `Date`, `Shop ID`, `Item ID`, `Produce g`, `Sell g`, `Price per Unit` | The shop and Sales item must exist; balances remain automatic. |

Each template is downloadable from **More → Import / export**.  Table exports are XLSX workbooks, and the reports screen also exports its date-range item report as XLSX.
