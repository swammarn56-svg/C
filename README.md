# Bakery ERP / Inventory Management

This repository contains a full-stack Bakery ERP application for date-effective item management, purchasing, Production and Packaging ledgers, shop-based Sales, dashboard metrics, reports, recipes, backups, and spreadsheet exchange.

## Included workflow

The application keeps Production, Packaging, and Sales item lists separate.  Weight-based inventory uses grams as its base unit, while piece-based inventory remains in pieces.  Purchases may be saved as drafts and only confirmed purchases affect `In` balances and monthly average cost.  Production and Packaging calculate `Used` and `Closing` automatically.  Sales use the active price defined for the selected shop and item, and calculate the line total automatically.

## Source setup

Install Node.js 22+ and pnpm, then run:

```bash
pnpm install
pnpm check
pnpm test
```

The project requires a MySQL/TiDB-compatible `DATABASE_URL` and the OAuth environment variables used by the provided framework.  Do **not** commit `.env` files, credentials, database backups, or user exports to GitHub.

## Database migrations

The `drizzle/migrations/` directory contains the schema history.  Review every generated SQL migration before applying it to a production database.  The latest migration adds a non-destructive Purchase lifecycle with `draft` and `confirmed` statuses.

## Spreadsheet exchange

Purchase, Production, Packaging, and Sales tables support XLSX and CSV templates.  CSV is generated with a UTF-8 BOM and the import path removes that BOM before parsing; this protects Myanmar Unicode values such as `ပေါင်မုန့်`, `ရန်ကုန်ဆိုင်`, and `ချို`.

## Validation

Run only source validation with:

```bash
pnpm check && pnpm test
```

The current suite includes formula, date-effective lifecycle, unit-preservation, authenticated-session, and Myanmar Unicode CSV/XLSX round-trip tests.  No production build or deployment is required to validate the code.

## Repository hygiene

The delivered ZIP excludes dependency folders, build output, local runtime logs, editor files, and environment secrets.  It is prepared for creating a new GitHub repository.
