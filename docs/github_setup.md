# GitHub Pages Setup

Use this guide to deploy CBPET Daily Tracker to:

```text
https://cbpet.github.io/daily-tracker/
```

## 1. Repository

The GitHub repository should be:

```text
https://github.com/cbpet/daily-tracker
```

The local Git remote should point to the same repository:

```bash
git remote set-url origin https://github.com/cbpet/daily-tracker.git
```

## 2. GitHub Pages Source

In GitHub:

1. Open the repository.
2. Go to **Settings -> Pages**.
3. Set **Source** to **GitHub Actions**.

Do not use the `gh-pages` branch deployment path for the primary production deploy.

## 3. Required GitHub Secrets

Add these under **Settings -> Secrets and variables -> Actions -> Repository secrets**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Get both values from **Supabase Dashboard -> Project Settings -> API**.

The anon key is expected to be bundled into the browser app. Production safety depends on Supabase Row Level Security policies.

Never add `SUPABASE_SERVICE_ROLE_KEY` to frontend code or GitHub Pages build secrets.

## 4. Vite Base Path

GitHub project pages are served from a subpath. This app must keep:

```js
base: '/daily-tracker/'
```

in `vite.config.js`.

Without this, the production build may request assets from `/assets/...` instead of `/daily-tracker/assets/...`.

## 5. Supabase Auth URLs

In **Supabase Dashboard -> Authentication -> URL Configuration**, set:

```text
Site URL:
https://cbpet.github.io/daily-tracker/

Redirect URLs:
https://cbpet.github.io/daily-tracker/
```

The app uses hash-based routes after the base URL, so auth redirects should use the base URL without a `#` fragment.

## 6. Deploy

Push to `main`:

```bash
git push origin main
```

Then open **Actions** and confirm the Pages workflow completes.

After deployment, verify:

```text
https://cbpet.github.io/daily-tracker/
```

returns the app and that CSS/JS requests load from `/daily-tracker/assets/...`.
