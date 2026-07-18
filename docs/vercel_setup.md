# Vercel Setup

Use this guide to deploy CBPET Daily Tracker as a Vite single-page app on Vercel.

## 1. Import Project

In Vercel:

1. Choose **Add New -> Project**.
2. Import the GitHub repository.
3. Select the Vite framework preset if Vercel detects it.

Use these build settings:

```text
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

## 2. Environment Variables

Add these in **Project Settings -> Environment Variables**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Apply them to Production, Preview, and Development as needed.

Get both values from **Supabase Dashboard -> Project Settings -> API**.

The anon key is expected to be bundled into frontend JavaScript. This is safe only when Supabase Row Level Security policies correctly restrict data access.

Never store `SUPABASE_SERVICE_ROLE_KEY` in Vercel frontend environment variables.

## 3. Vite Base Path

Vercel serves the app from the domain root by default. If deploying only to Vercel, the Vite base can be `/`.

This repository is currently configured for GitHub Pages with:

```js
base: '/daily-tracker/'
```

If Vercel becomes the primary deployment target, change the base path or make it environment-specific before deploying.

## 4. Supabase Auth URLs

In **Supabase Dashboard -> Authentication -> URL Configuration**, add the Vercel production URL:

```text
https://your-project.vercel.app/
```

Also add any custom domain, for example:

```text
https://tracker.example.com/
```

Auth redirect URLs should use the app base URL without a `#` fragment.

## 5. Deploy

Trigger a Vercel deployment from the dashboard or by pushing to the connected branch.

After deployment, verify:

- The app loads.
- Login works.
- Invite and password reset links return to the deployed Vercel URL.
- Supabase requests do not fail due to missing environment variables.
