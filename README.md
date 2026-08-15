# Bakery ERP / Inventory Management

This repository contains a full-stack Bakery ERP application for date-effective item management, purchasing, Production and Packaging ledgers, shop-based Sales, dashboard metrics, reports, recipes, backups, and spreadsheet exchange.

## Included workflow

The application keeps Production, Packaging, and Sales item lists separate. Weight-based inventory uses grams as its base unit, while piece-based inventory remains in pieces. Purchases may be saved as drafts and only confirmed purchases affect `In` balances and monthly average cost. Production and Packaging calculate `Used` and `Closing` automatically. Sales use the active price defined for the selected shop and item, and calculate the line total automatically.

## Supabase setup

The application uses Supabase PostgreSQL through the server-side `SUPABASE_DB_URL` connection string. The browser-safe `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` may be present for project configuration, but the server database connection and service-role credential must never be committed to GitHub or exposed in client code.

Create a local environment file outside version control with the Supabase connection values and the framework’s OAuth variables:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
```

Use an IPv4-reachable Supabase Session Pooler URI when the execution environment cannot reach the direct database host. Never place these values in source files, the browser bundle, database backups, or GitHub Actions logs.

## Source setup

Install Node.js 22+ and pnpm, then run:

```bash
pnpm install
pnpm check
pnpm test
```

## Database migration

The canonical Supabase migration is `supabase/migrations/0001_bakery_erp.sql`. Review it before applying it to a production project. From a trusted environment with `SUPABASE_DB_URL` configured, apply it with:

```bash
node scripts/apply-supabase-migration.mjs
```

The migration creates the ERP tables, enum types, foreign keys, indexes, updated-at triggers, and row-level security. The server uses the Supabase service-role credential and enforces application roles in tRPC; the service-role credential is never sent to the browser.

## Supabase email/password login

The live application does not use Manus OAuth. Login is handled by Supabase Auth with the browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the server verifies bearer tokens with the server-only Supabase service-role key and maps the Supabase user ID into the ERP users table.

## Progressive Web App (PWA)

On a supported mobile browser, open the Netlify site and choose **Add to Home screen** or **Install app** from the browser menu. The PWA caches the application shell and static assets for faster reopening and limited offline shell access. Inventory, reports, authentication, and Supabase data operations still require an internet connection.

## Netlify deployment

The repository includes `netlify.toml` and a Netlify Function at `netlify/functions/api.ts`. Use build command `pnpm build`, publish directory `dist/public`, and functions directory `netlify/functions`. Configure the Supabase and OAuth-free environment variables in Netlify Site settings before deploying.

## Spreadsheet exchange

Purchase, Production, Packaging, and Sales tables support XLSX and CSV templates. CSV is generated with a UTF-8 BOM and the import path removes that BOM before parsing; this protects Myanmar Unicode values such as `ပေါင်မုန့်`, `ရန်ကုန်ဆိုင်`, and `ချို`.

## Validation

Run source validation with:

```bash
pnpm check && pnpm test
```

The suite includes formula, date-effective lifecycle, unit-preservation, authenticated-session, Supabase REST/PostgreSQL credential, and Myanmar Unicode CSV/XLSX round-trip tests. No production build or deployment is required to validate the code.

## Repository hygiene

The delivered ZIP excludes dependency folders, build output, local runtime logs, editor files, and environment secrets. It is prepared for creating a new GitHub repository. Before pushing, rotate any credential that has been exposed in chat or shell history and configure fresh GitHub Actions secrets.
