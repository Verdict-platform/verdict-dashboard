# Update the dashboard

## Local development
```bash
npm run dev
```
Visit http://localhost:3000

## Supabase schema changes
Edit `supabase/schema.sql`, then apply in Supabase SQL Editor.

## Adding a new dashboard section
1. Add component in `components/`
2. Import and render in `app/page.tsx`
3. Connect to Supabase via `lib/` utilities

## Build and deploy
```bash
npm run build    # verify locally
git add -A
git commit -m "Update dashboard: {describe}"
git push origin main
```
Netlify auto-deploys on push to main.
