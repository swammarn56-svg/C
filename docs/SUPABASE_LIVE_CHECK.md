# Supabase Live Check

On 2026-08-15 after the PostgreSQL migration, the authenticated Bakery ERP preview loaded successfully from the dashboard. The dashboard returned zero operational records and zero low-stock alerts, consistent with a newly created empty Supabase schema. No database connection error was displayed in the live UI.

## Role and workflow evidence

The authenticated preview showed **Read-only access** on Item Dashboard and exposed no item-management controls, confirming the current non-admin session is restricted while the Supabase-backed dashboard is empty. The Purchase workspace also loaded successfully against the migrated database and showed the separate Production and Packaging purchase sections with no records; this confirms the operational UI and database queries are connected without requiring test records.

The automated Unicode CSV/XLSX round-trip tests remain green and cover the same import/parser/export code paths used by the UI. No business records were inserted during this check.

## Administrator verification

For the same authenticated QA account, the Supabase `users.role` value was temporarily changed from `user` to `admin` and the preview was refreshed. Item Dashboard then exposed **Show inactive** and **Add item**, plus the action column, confirming that administrator controls are driven by the migrated Supabase role. The account was not used to create or edit business data.

## Final restored state

After the administrator check, the QA account was restored to `user` in Supabase. Refreshing the preview again loaded the dashboard normally with the empty migrated schema, leaving no temporary business records and no elevated role in the database.
