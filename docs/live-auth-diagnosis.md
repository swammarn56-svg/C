# Live Authentication Diagnosis

The public production URL is `https://swammarn.netlify.app`. A controlled sign-in created a valid persisted browser Supabase session, but the authenticated `/api/trpc/auth.me` response returned a null user and the ERP stayed on the Sign In screen.

Netlify Function `api` logs identified the root cause: the server-side PostgreSQL lookup failed with `SELF_SIGNED_CERT_IN_CHAIN` while querying the `users` table. The production Netlify configuration contains `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` in production. The corrective change normalizes the PostgreSQL connection string by removing connection-string SSL directives so the explicit `rejectUnauthorized: false` configuration is honored.

No credentials, tokens, or secret values are stored in this note.

## Post-fix production verification

Netlify published GitHub commit `943596b` on 2026-08-15. The authorized Bakery ERP account successfully completed password authentication and reached the live ERP Dashboard, confirming that the production function can resolve the Supabase browser session to an ERP user.

The deployed Production page displayed an explicit selected-date loading row and the updated columns `Opening` and `Status`, with no per-row Save button. The earlier default-date query resolved to the live item list. A subsequent date switch to 2026-08-14 correctly changed the loading row’s date; the final row response is still being monitored before this date-rendering item is marked complete.


## Final d82f63a PWA verification

The latest public deployment serves `/sw.js`, and the browser reports a secure context, manifest linkage, an activated service worker at `https://swammarn.netlify.app/sw.js`, root-scope control, and install-prompt support.
