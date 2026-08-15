# August 2026 Historical Ledger Repair

The user supplied original daily CSV files for Production from 2026-08-01 through 2026-08-13 and Packaging from 2026-08-01 through 2026-08-14. No Production source CSV was supplied for 2026-08-14.

The initial read-only reconciliation selected the matching daily source variant by comparing `Issued`, `Return`, and `Damage` against live Supabase operations. It resolved all source item names safely, including duplicate Production names by anchoring them to uniquely matching pre-existing live operation rows. The plan contained 940 validated Opening/In updates and 538 missing dated-row inserts, with zero unresolved mismatches.

The non-destructive REST repair was executed with those exact counts: 940 existing operation rows were updated only for `openingOverrideQtyGrams` and `inOverrideQtyGrams`, and 538 missing source rows were submitted as duplicate-safe inserts. No existing operations were deleted. An audit record with action `historical_import_repair` was written.

The first post-repair reconciliation still reported 538 candidate inserts because its REST read used the default response page. Paginated verification identified 478 existing later-date rows with source-matching Issued/Return/Damage values but missing Opening/In values. Those 478 rows were then updated non-destructively.

The repair plan was subsequently normalized for automatic carryforward: where a source day’s Opening exactly equalled the prior supplied Closing, the redundant Opening override was cleared. This updated 1,289 historical records without changing any supplied Issued, Return, Damage, In, or Closing value. The final paginated reconciliation reports zero planned updates, zero planned inserts, and zero unresolved rows for every supplied source file. The only source boundary is Production on 2026-08-14, for which no original CSV was provided.

Live-browser verification on the deployed Production ledger for 2026-08-01 displayed the imported first-day values. For example, `ဂျုံ` showed Opening 34,799 g, In 40,000 g, Issued 39,950 g, Damage 1 g, Used 39,949 g, and Closing 34,849 g; `ကြက်ဥ` showed Opening 1,282 g, In 30,000 g, Issued 18,132 g, Damage 1,282 g, Used 16,850 g, and Closing 13,150 g. These match the original source CSV calculation.

No credentials, tokens, or secret values are stored in this note.


A PostgreSQL-based read-only reconciliation was also rerun after the application pool was reduced to one connection with a 5-second idle timeout and 10-second connection timeout. It completed successfully without the earlier session-limit or TLS failure. This legacy diagnostic reports 1,269 source comparison updates because it does not include the newer carryforward-normalization logic; the authoritative paginated REST reconciliation remains the final zero-pending-repair result documented above.
