# Final Requirements Coverage

The current application already has separate Production, Packaging, and Sales item lists; effective-date visibility and soft deactivation; item ordering; monthly purchase-cost calculation; daily ledgers; shop pricing; recipes; user roles; backups; XLSX templates; and date-range report tabs.

| Requirement area | Current state | Completion action |
|---|---|---|
| Piece inventory | Legacy storage column is named `quantityGrams`, although Packaging values are numerically stored as pieces. | Treat the field as base quantity for Packaging throughout the server/UI, show `pcs`, and avoid conversion from pieces to grams. |
| Purchase confirmation | Purchases are immediately included in ledgers without a lifecycle status. | Add `draft` / `confirmed` status and only include confirmed purchases in inventory and cost calculations. |
| Purchase table | Base quantity, unit price, and status are incomplete in the interface. | Expose all required table values and a confirmation control. |
| Sales | Shop price exists but unit-price and line-total display are incomplete. | Lock the selected shop-item price into the sale and display unit price and total. |
| Reports | Dedicated tabs exist but lack complete operational balances and shop sales detail. | Extend report payload and views with opening, in, issued, return, damage, used, closing, cost, value, and shop breakdown. |
| Dashboard | Purchase, closing, damage, margin, and low stock exist. | Add sales quantity and sales value metrics. |
| Spreadsheet exchange | XLSX is implemented; CSV and explicit Unicode safeguards are incomplete. | Add UTF-8 BOM CSV template/export/import support and Unicode regression tests. |

The work below preserves historical records and is non-destructive: existing numeric inventory values retain their historical values, while labels and unit-aware logic correctly interpret piece-based items as `pcs`.
