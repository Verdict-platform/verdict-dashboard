# Verdict Dashboard — CLAUDE.md

Internal dashboard for the Verdict platform.

Owner: Stewart Masters (stewartmasters@gmail.com)
Repo: `git@github.com:Verdict-platform/verdict-dashboard.git`

---

## What this is

An internal Next.js dashboard for monitoring and managing the Verdict network. Currently early stage — single page with example data and Supabase integration.

---

## Stack

| Layer | Detail |
|---|---|
| Framework | Next.js (static export, `output: 'export'`) |
| Hosting | Netlify — publish dir `out/`, Netlify Functions for serverless |
| Database | Supabase |
| Styling | Tailwind CSS |
| Language | TypeScript |

---

## Push rules

Push to `main` only unless explicitly asked otherwise.

---

## Build & run

```bash
npm run dev     # local dev server
npm run build   # production build → out/
npm run start   # serve built output
```

Netlify build command: `npm install && npm run build`
Netlify functions directory: `netlify/functions/`

---

## Structure

```
app/
  layout.tsx
  page.tsx           # Main dashboard page
  globals.css
  example-data.json  # Example data for prototyping
components/          # Dashboard UI components
lib/                 # Shared utilities
supabase/
  schema.sql         # Database schema
netlify/
  functions/         # Netlify serverless functions
```

---

## Supabase

Schema is in `supabase/schema.sql`. To apply to a new Supabase project, run the SQL in the Supabase SQL Editor.

Connection is configured via environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Set these in Netlify environment settings (not committed to repo).
