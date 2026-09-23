# Setup outside the repo

Everything configured by hand in dashboards. Keep this in sync when something changes.

## GitHub (`dejvicek/foosball-tagger`)

- **Pages:** Settings → Pages → Source: GitHub Actions. Served at https://dejvicek.github.io/foosball-tagger/.
- **Actions secrets:** `VITE_SUPABASE_URL` (project URL) and `VITE_SUPABASE_ANON_KEY` (the publishable key `sb_publishable_…`, not a legacy anon JWT, never a secret key). Re-run the deploy workflow after changing them.

## Supabase

- **Authentication → URL Configuration**
  - Site URL: `https://dejvicek.github.io/foosball-tagger/` (the default `http://localhost:3000` breaks sign-in).
  - Redirect URLs: `https://dejvicek.github.io/foosball-tagger/**` and `http://localhost:5173/**`.
- **Authentication → Sign In / Providers**
  - Email: enabled. Built-in email service sends 2 emails per hour per project; 60 s between links to the same address.
  - GitHub: enabled with the Client ID and secret of the GitHub App below.

## GitHub App for sign-in (under `dejvicek`)

- Callback / Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (shown on the Supabase GitHub provider page). Webhook inactive.
- **Account permissions → Email addresses: Read-only.** Without it sign-in fails with "Error getting user profile from external provider". After changing permissions, revoke the app at https://github.com/settings/apps/authorizations and sign in again.

## Local development

- `cp .env.example .env`, fill in the same two values as the Actions secrets, `npm run dev`, open http://localhost:5173/foosball-tagger/.
