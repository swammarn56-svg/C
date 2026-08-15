# GitHub Upload Guide

This ZIP is already prepared with the project files at the repository root. It does not contain a second nested project folder.

## Upload through the GitHub website

Create a new empty repository on GitHub. Download and extract this ZIP on your computer. Open the extracted folder, select everything inside it, and drag those files into the GitHub repository upload page. The files must appear directly in the repository root, with `package.json`, `README.md`, `client`, `server`, `drizzle`, `supabase`, and `scripts` visible at the top level.

Do not upload `.env` files, Supabase passwords, service-role keys, `node_modules`, or build output. Configure Supabase and OAuth values through your deployment platform’s environment-variable settings.

## Run locally after cloning

```bash
pnpm install
pnpm check
pnpm test
pnpm db:migrate:supabase
pnpm dev
```

The Supabase migration command requires `SUPABASE_DB_URL`. Keep that value server-side and do not commit it to GitHub.
